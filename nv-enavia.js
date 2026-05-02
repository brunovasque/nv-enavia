import {
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
  handleGetActiveSurface,
  handleExecuteContract,
  handleCloseContractInTest,
  handleCancelContract,
  handleRejectDecompositionPlan,
  handleResolvePlanRevision,
  handleCompleteTask,
  handleCloseFinalContract,
  // PR6 — loop supervisionado
  resolveNextAction,
  // PR18 — endpoint supervisionado de avanço de fase
  advanceContractPhase,
  // PR16 — startTask (transiciona task queued → in_progress antes da execução)
  startTask,
  buildExecutionHandoff,
  rehydrateContract,
  readExecEvent,
  // Macro2-F5 — Functional logs
  readFunctionalLogs,
  // P24 — GitHub/PR Arm
  handleGitHubPrAction,
  handleRequestMergeApproval,
  handleApproveMerge,
  // P25 — Browser Arm
  handleBrowserArmAction,
  getBrowserArmState,
  getBrowserArmStateWithKV,
} from "./contract-executor.js";

import { classifyRequest } from "./schema/planner-classifier.js";
import { buildOutputEnvelope } from "./schema/planner-output-modes.js";
import { buildCanonicalPlan } from "./schema/planner-canonical-plan.js";
import { evaluateApprovalGate } from "./schema/planner-approval-gate.js";
import { buildExecutorBridgePayload } from "./schema/planner-executor-bridge.js";
import { consolidateMemoryLearning } from "./schema/memory-consolidation.js";
import { writeMemory, readMemoryById, updateMemory, blockMemory, invalidateMemory } from "./schema/memory-storage.js";
import { buildMemoryObject, ENTITY_TYPES, MEMORY_TYPES, MEMORY_STATUS, MEMORY_FLAGS } from "./schema/memory-schema.js";
import { searchRelevantMemory, searchMemory } from "./schema/memory-read.js";
import { buildRetrievalContext, buildRetrievalSummary } from "./schema/memory-retrieval.js";
import { buildCognitivePromptBlock, buildChatSystemPrompt } from "./schema/enavia-cognitive-runtime.js";
import { buildOperationalAwareness } from "./schema/operational-awareness.js";
import { classifyEnaviaIntent } from "./schema/enavia-intent-classifier.js";
import { routeEnaviaSkill } from "./schema/enavia-skill-router.js";
import { buildIntentRetrievalContext } from "./schema/enavia-intent-retrieval.js";
import { runEnaviaSelfAudit } from "./schema/enavia-self-audit.js";
import { buildEnaviaResponsePolicy } from "./schema/enavia-response-policy.js";
import { buildSkillExecutionProposal } from "./schema/enavia-skill-executor.js";
import { buildChatSkillSurface } from "./schema/enavia-chat-skill-surface.js";
import { registerSkillProposal, approveSkillProposal, rejectSkillProposal } from "./schema/enavia-skill-approval-gate.js";
import { buildSkillSpec, validateSkillSpec, buildSkillCreationPackage } from "./schema/enavia-skill-factory.js";
import { registerLearningCandidate, listLearningCandidates, getLearningCandidateById, approveLearningCandidate, rejectLearningCandidate } from "./schema/learning-candidates.js";
import { listAuditEvents } from "./schema/memory-audit-log.js";

// ============================================================================
// 🚀 ENAVIA — Worker Principal (Versão PRO ENGINEER)
// Arquitetura modular com carregamento sob demanda, fila inteligente,
// Supabase Storage, Executor Core, e telemetria de inicialização.
//
// Este worker foi projetado para:
// 1) Carregar somente o nv_index.json no boot
// 2) Carregar módulos sob demanda com limite real de 3 simultâneos
// 3) Servir como cérebro da ENAVIA 
// 4) Comunicar-se com o executor via /engineer
// 5) Permitir auto-reescrita controlada (somente via patch autorizado)
// ============================================================================

// ============================================================
// 🔖 ENAVIA BUILD MARKER — TELEMETRIA DE DEPLOY
// ============================================================
// PR4: deployed_at is manually updated at each deploy — no runtime CF API available for this.
// To automate: inject DEPLOYED_AT via wrangler.toml [vars] or CI/CD env at build time.
const ENAVIA_BUILD = {
  id: "ENAVIA_PR4_2026-04",
  deployed_at: "2026-04-26T00:00:00Z",
  source: "deploy-worker",
};

// ============================================================================
// 🧠 CACHES PRINCIPAIS
// ============================================================================
let NV_INDEX_CACHE = null;           // Conteúdo do nv_index.json
let NV_MODULE_CACHE = {};            // Armazena módulos carregados sob demanda
let NV_BRAIN_READY = false;          // Cérebro inicializado
let NV_LAST_LOAD = null;             // Marca o último carregamento

// ============================================================================
// 📊 ULTRA DEBUG — buffer em memória (por instância de Worker)
// ============================================================================
const DEBUG_MAX_EVENTS = 50;
let DEBUG_EVENTS = [];
let DEBUG_COUNTER = 0;

function recordDebugEvent(kind, detail) {
  try {
    const evt = {
      id: ++DEBUG_COUNTER,
      kind,
      ts: Date.now(),
      iso: new Date().toISOString(),
      detail: detail || null,
    };
    DEBUG_EVENTS.push(evt);
    if (DEBUG_EVENTS.length > DEBUG_MAX_EVENTS) {
      DEBUG_EVENTS.shift();
    }
  } catch (err) {
    // Nunca deixar debug derrubar o Worker
    try {
      logNV("❌ ULTRA-DEBUG falhou ao registrar evento:", String(err));
    } catch (_e) {}
  }
}

// Snapshot consolidado do estado interno da ENAVIA/NV-FIRST
function snapshotDebugState(env) {
  let modulesKeys = [];
  try {
    modulesKeys = Object.keys(NV_MODULE_CACHE || {});
  } catch (_e) {}

  let indexModules = null;
  if (NV_INDEX_CACHE && Array.isArray(NV_INDEX_CACHE.modules)) {
    indexModules = NV_INDEX_CACHE.modules.map((m) => m.name || m.key || m);
  }

  return {
    debug_counter: DEBUG_COUNTER,
    recent_events: DEBUG_EVENTS,
    index: {
      loaded: NV_INDEX_CACHE !== null,
      last_load: NV_LAST_LOAD,
      modules_from_index: indexModules,
    },
    cache: {
      modules_in_cache: modulesKeys.length,
      modules_keys: modulesKeys,
    },
    bindings: {
      has_executor_binding: !!(env && env.EXECUTOR),
    },
    env: {
      mode: (env && env.ENAVIA_MODE) || "supervised",
    },
  };
}

// ============================================================================
// 🧵 FILA DE CARREGAMENTO — Máximo 3 módulos simultâneos
// ============================================================================
let NV_ACTIVE_LOADS = 0;
const NV_LOAD_QUEUE = [];

// Enfileira qualquer função de carregamento e processa na ordem:
function queueModuleLoad(taskFn) {
  return new Promise((resolve, reject) => {
    NV_LOAD_QUEUE.push({ taskFn, resolve, reject });
    runNextLoad();
  });
}

function runNextLoad() {
  if (NV_ACTIVE_LOADS >= 3) return; // limite atingido

  const next = NV_LOAD_QUEUE.shift();
  if (!next) return;

  NV_ACTIVE_LOADS++;

  next.taskFn()
    .then(result => {
      NV_ACTIVE_LOADS--;
      next.resolve(result);
      runNextLoad();
    })
    .catch(err => {
      NV_ACTIVE_LOADS--;
      next.reject(err);
      runNextLoad();
    });
}

// ============================================================================
// 🧰 UTILITÁRIOS E LOGS
// ============================================================================
function logNV(...args) {
  console.log("[ENAVIA]", ...args);
}

function jsonResponse(data, status = 200) {
  return withCORS(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    })
  );
}

// Gera IDs únicos para rastrear requisições e sessões de deploy
function safeId(prefix = "id") {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

// ===============================
// NORMALIZAÇÃO DE PATCH PARA O EXECUTOR
// ===============================
function normalizePatchForExecutor(rawBody) {
  if (!rawBody || typeof rawBody !== "object") return rawBody;

  if (!rawBody.patch || typeof rawBody.patch !== "object") {
    return rawBody;
  }

  const outerPatch = rawBody.patch;

  // Caso 1: patch já está no formato correto
  const isAlreadyValid =
    typeof outerPatch.mode === "string" &&
    (Array.isArray(outerPatch.patchText) ||
      typeof outerPatch.code === "string" ||
      typeof outerPatch.candidate === "string");

  if (isAlreadyValid) {
    return rawBody;
  }

  // Caso 2: patch veio dentro de outro patch (embrulhado)
  if (
    outerPatch.patch &&
    typeof outerPatch.patch === "object" &&
    (
      typeof outerPatch.patch.mode === "string" ||
      Array.isArray(outerPatch.patch.patchText) ||
      typeof outerPatch.patch.code === "string" ||
      typeof outerPatch.patch.candidate === "string"
    )
  ) {
    return {
      ...rawBody,
      patch: outerPatch.patch,
    };
  }

  return rawBody;
}

// ============================================================================
// 🤖 AUTO-ACTIONS — Regras de ação automática da ENAVIA
// ============================================================================
const AUTO_ACTIONS = {
  "recarregar índice": {
    action: "reload_index",
    description: "Força recarregamento do nv_index.json sem reiniciar o Worker.",
  },

  "listar módulos": {
    action: "list_modules",
    description: "Retorna a lista atual de módulos carregados via INDEX.",
  },

  "estado do cérebro": {
    action: "debug_brain",
    description: "Retorna o status interno do NV-FIRST (cache, index, módulos).",
  },

  "carregar módulos": {
    action: "debug_load",
    description: "Força carregamento de módulos reais via fila (3 simultâneos).",
  },

  "/mostrar-system": {
    action: "show_system_prompt",
    description: "Retorna o conteúdo atual do SYSTEM_PROMPT carregado do KV."
  }
};

// ============================================================================
// 🔗 URL CORRETA DO SUPABASE STORAGE
// ============================================================================
function buildStorageURL(env, path) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const bucket = env.SUPABASE_BUCKET.replace(/^\/|\/$/g, "");
  const cleanPath = path.replace(/^\/+/, "");

  const finalURL = `${base}/storage/v1/object/public/${bucket}/${encodeURI(
    cleanPath
  )}?download=1`;

  logNV("URL Supabase gerada:", finalURL);
  return finalURL;
}

// ============================================================================
// 🧠 Função universal para transformar INDEX hierárquico em lista plana
// ============================================================================

function flattenIndex(rawIndex) {
  const flat = [];

  if (!rawIndex || typeof rawIndex !== "object") return flat;

  // Para cada módulo principal (ex: M01, M02...)
  for (const [moduleName, moduleGroup] of Object.entries(rawIndex)) {

    // Se for objeto (ex: { P01: "...", P02: "..." })
    if (moduleGroup && typeof moduleGroup === "object") {
      for (const [subKey, path] of Object.entries(moduleGroup)) {
        
        // Nome final consolidado (ex: M01-P03)
        const finalKey = `${moduleName}-${subKey}`;

        flat.push({
          name: finalKey,
          key: finalKey,
          path: path,
          tags: "",
          description: ""
        });
      }
    }
  }

  return flat;
}

// ============================================================================
// 📌 Carrega o INDEX nv_index.json (SOMENTE UMA VEZ)
// ============================================================================
async function loadIndex(env) {
  try {
    if (NV_INDEX_CACHE) return NV_INDEX_CACHE;

    const indexURL = buildStorageURL(env, "nv_index.json");
    logNV("Carregando INDEX NV-FIRST:", indexURL);

    const res = await fetch(indexURL);
    if (!res.ok) {
      throw new Error(`Falha ao carregar nv_index.json → HTTP ${res.status}`);
    }

    const json = await res.json();

// ===========================================================
// 🧠 Aplicar flattenIndex() para gerar lista plana de módulos
// ===========================================================
const flatModules = flattenIndex(json);

// Garante que o INDEX tenha um campo "modules" no formato NV-FIRST
json.modules = flatModules;

// Atualizar caches internos
NV_INDEX_CACHE = json;
NV_LAST_LOAD = Date.now();

// Log real, mostrando quantos módulos foram disponibilizados
logNV(
  `INDEX carregado: ${flatModules.length} módulos disponíveis após flatten.`
);

return json;

  } catch (err) {
    logNV("❌ ERRO loadIndex():", err);
    throw err;
  }
}

// ============================================================================
// 📌 Carrega um módulo individual (LAZY + LIMITE DE 3 SIMULTÂNEOS)
// ============================================================================
async function loadModule(env, path) {
  return queueModuleLoad(async () => {
    try {
      if (NV_MODULE_CACHE[path]) {
        logNV(`(CACHE) Módulo já carregado: ${path}`);
        return NV_MODULE_CACHE[path];
      }

      const moduleURL = buildStorageURL(env, path);
      logNV("Carregando módulo NV-FIRST:", moduleURL);

      const res = await fetch(moduleURL);
      if (!res.ok) {
        throw new Error(`Falha ao carregar módulo ${path} → HTTP ${res.status}`);
      }

      const text = await res.text();
      NV_MODULE_CACHE[path] = text;

      logNV(`✔ Módulo carregado: ${path}`);

      return text;

    } catch (err) {
      logNV("❌ ERRO loadModule():", path, err);
      throw err;
    }
  });
}

// ============================================================================
// 🧠 buildBrain — CÉREBRO NV-FIRST (versão LEVE & INTELIGENTE)
// - NÃO CARREGA os módulos no boot
// - Carrega somente:
//      ✔ nv_index.json
//      ✔ SYSTEM_PROMPT do KV
//      ✔ M12-AUTOPATCHENGINE-V1 (AutoPatchEngine v1)
// - Módulos serão carregados sob demanda pelo agente
// ============================================================================
async function buildBrain(env) {
  try {
    if (NV_BRAIN_READY) {
      return {
        index: NV_INDEX_CACHE,
        modules: NV_MODULE_CACHE,
      };
    }

    // Carrega INDEX
    const index = await loadIndex(env);
    if (!index.modules) {
      throw new Error("INDEX inválido → Campo 'modules' ausente.");
    }

    // Carrega SYSTEM_PROMPT do KV
    const systemPrompt = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
    if (systemPrompt) {
      NV_MODULE_CACHE["SYSTEM_PROMPT"] = systemPrompt;
      logNV("✔ SYSTEM_PROMPT carregado do KV.");
    } else {
      logNV("⚠️ SYSTEM_PROMPT ausente no KV.");
    }

// ============================================================================
// 🧠 MEMORY LOADER — PASSO 1 (BOOT)
// Carrega memórias dinâmicas registradas em brain:index (KV)
// _brainIndexRaw é lido uma única vez aqui e reutilizado em Memory Integration V1.
// ============================================================================
let _brainIndexRaw = null;
try {
  _brainIndexRaw = await env.ENAVIA_BRAIN.get("brain:index");
  const storedIndex = _brainIndexRaw;
  const memoryKeys = storedIndex ? JSON.parse(storedIndex) : [];

  for (const key of memoryKeys) {
    const content = await env.ENAVIA_BRAIN.get(key);
    if (content) {
      NV_MODULE_CACHE[key] = content;
      logNV(`🧠 Memória carregada no boot: ${key}`);
    }
  }

  logNV(`🧠 Boot Memory Loader concluído (${memoryKeys.length} memórias).`);
} catch (err) {
  logNV("⚠️ Falha no Memory Loader (boot):", String(err));
}

// ============================================================================
// 🧠 MEMORY CLASSIFIER — PASSO 2
// Separa memória operacional vs estratégica
// ============================================================================
const NV_MEMORY = {
  strategic: {},
  operational: {},
};

for (const [key, value] of Object.entries(NV_MODULE_CACHE)) {

  // Memória estratégica (Director)
  if (
    key.startsWith("director:memory") ||
    key.startsWith("brain:decision") ||
    key.startsWith("brain:policy")
  ) {
    NV_MEMORY.strategic[key] = value;
    continue;
  }

  // Memória operacional (Engineer / execução)
  NV_MEMORY.operational[key] = value;
}

logNV(
  `🧠 Memory classified → strategic: ${Object.keys(NV_MEMORY.strategic).length}, ` +
  `operational: ${Object.keys(NV_MEMORY.operational).length}`
);

// Expor memória classificada globalmente
globalThis.NV_MEMORY = NV_MEMORY;

// ============================================================================
// 🧠 MEMORY ACCESS LAYER — PASSO 3
// Funções oficiais de leitura segura da memória
// ============================================================================

function getDirectorMemory(options = {}) {
  if (!globalThis.NV_MEMORY?.strategic) {
    return "";
  }

  const {
    limit = 3,          // quantas memórias retornar
    order = "recent"    // future-proof
  } = options;

  const entries = Object.entries(globalThis.NV_MEMORY.strategic);

  // ordem simples por inserção (KV já vem em ordem temporal no index)
  const selected = order === "recent"
    ? entries.slice(-limit)
    : entries.slice(0, limit);

  return selected
    .map(([key, value]) => `\n\n[MEMORY:${key}]\n${value}`)
    .join("")
    .trim();
}


function getOperationalMemory() {
  if (!globalThis.NV_MEMORY?.operational) {
    return {};
  }

  // Engineer recebe estrutura, não texto concatenado
  return { ...globalThis.NV_MEMORY.operational };
}

// ============================================================================
// 🧠 PASSO 5 — DETECTAR INTENÇÃO DE NOVA MEMÓRIA DO DIRECTOR
// ============================================================================
function detectDirectorMemoryIntent(text = "") {
  const t = text.toLowerCase();

  const signals = [
    "decidimos que",
    "a partir de agora",
    "fica definido",
    "regra oficial",
    "não vamos mais",
    "sempre deve",
    "nunca deve",
    "padrão oficial",
    "decisão estratégica"
  ];

  if (!signals.some(s => t.includes(s))) {
    return null;
  }

  return {
    type: "director_memory_candidate",
    content: text.trim(),
    source: "conversation",
    confidence: "medium",
  };
}

// ============================================================================
// 🧠 Memory Integration V1 — Carregar memórias dinâmicas do KV
// Reutiliza _brainIndexRaw lido no PASSO 1 — sem double-load de brain:index.
// ============================================================================
try {
  const storedIndex = _brainIndexRaw;
  const dynamicKeys = storedIndex ? JSON.parse(storedIndex) : [];

  for (const key of dynamicKeys) {
    const content = await env.ENAVIA_BRAIN.get(key);
    if (content) {
      NV_MODULE_CACHE[key] = content;
      logNV(`✔ Memória dinâmica carregada: ${key}`);
    }
  }

  logNV(`🧠 Total de memórias carregadas: ${dynamicKeys.length}`);
} catch (err) {
  logNV("⚠️ ERRO ao carregar memória dinâmica:", String(err));
}

// ============================================================================
// 🧠 MEMORY V4 — Auto-Curadoria: Avaliação de Qualidade
// ============================================================================

// Avalia a "qualidade" de um treinamento baseado em heurísticas simples
function evaluateMemoryQuality(text) {
  const t = text.trim();

  let score = 0;

  // Conteúdo mínimo
  if (t.length > 60) score += 1;
  if (t.length > 200) score += 1;

  // Estrutura
  if (t.includes(".") || t.includes(";")) score += 1;
  if (t.includes(":") || t.includes(" - ")) score += 1;

  // Sinais de conteúdo útil
  const positiveSignals = [
    "como",
    "porque",
    "estratégia",
    "técnica",
    "passo",
    "exemplo",
    "cliente",
    "objeção",
    "financiamento",
    "resolver"
  ];

  if (positiveSignals.some((w) => t.toLowerCase().includes(w))) {
    score += 2;
  }

  // Penaliza memórias curtas, vagas ou soltas
  if (t.length < 40) score -= 1;
  if (t.split(" ").length < 6) score -= 1;

  // Score final entre -2 e 6
  if (score < -2) score = -2;
  if (score > 6) score = 6;

  return score;
}

    // 🔧 Carrega módulo M12-AUTOPATCHENGINE-V1, se existir no Storage
    try {
      const autopatchPath = "FINAL_NV/M12-AUTOPATCHENGINE-V1.txt";
      const autopatchText = await loadModule(env, autopatchPath);
      if (autopatchText) {
        NV_MODULE_CACHE[autopatchPath] = autopatchText;
        logNV("✔ M12-AUTOPATCHENGINE-V1 carregado no cérebro.");
      }
    } catch (e) {
      // Se não encontrar ou der erro, apenas loga e segue
      logNV("⚠️ Não foi possível carregar M12-AUTOPATCHENGINE-V1:", String(e));
    }

    NV_BRAIN_READY = true;
    NV_LAST_LOAD = Date.now();

    logNV("🧠 CÉREBRO NV-FIRST inicializado com sucesso.");

    return {
      index: NV_INDEX_CACHE,
      modules: NV_MODULE_CACHE,
    };

  } catch (err) {
    logNV("❌ ERRO buildBrain():", err);
    throw err;
  }
}

// ============================================================================
// 🧩 PARTE 2 — System Prompt NV-FIRST, Mensagens e Chamada ao Modelo
// ============================================================================

// Pequeno helper para ler módulos já carregados no cache
function getCachedModule(path) {
  return NV_MODULE_CACHE[path] || null;
}

// ============================================================================
// 🧠 Identificação de AUTO-AÇÕES no texto do usuário
// ============================================================================
function parseAutoAction(text) {
  text = (text || "").toLowerCase();

  for (const key of Object.keys(AUTO_ACTIONS)) {
    if (text.includes(key.toLowerCase())) {
      return AUTO_ACTIONS[key];
    }
  }

  return null;
}

// ============================================================================
// 🧠 Memory V2 — Scoring simples de relevância entre pergunta e memória
// ============================================================================
function scoreMemoryRelevance(query, memoryText) {
  if (!query || !memoryText) return 0;

  const q = String(query).toLowerCase();
  const t = String(memoryText).toLowerCase();

  const tokenize = (str) =>
    str
      .split(/[^a-z0-9áéíóúâêôãõç]+/i)
      .map((s) => s.trim())
      .filter((s) => s.length > 2);

  const stopwords = new Set([
    "que", "com", "para", "por", "uma", "umas", "um", "uns",
    "de", "da", "do", "no", "na", "nos", "nas",
    "e", "ou", "mas", "se", "em", "ao", "aos",
    "os", "as", "já", "bem", "mais", "menos"
  ]);

  const qTokens = new Set(
    tokenize(q).filter((t) => !stopwords.has(t))
  );
  const mTokens = tokenize(t).filter((t) => !stopwords.has(t));

  let score = 0;
  for (const tok of mTokens) {
    if (qTokens.has(tok)) score++;
  }

  return score;
}

// ---------------------------------------------------------------------------
// 🧠 buildSystemPrompt(brain, userMessage)
// Agora com Memory V2: injeta apenas memórias mais relevantes
// ---------------------------------------------------------------------------
function buildSystemPrompt(brain, userMessage) {
  const modules = brain?.modules || {};

  const baseSystem =
    modules["SYSTEM_PROMPT"] ||
    `
Você é a ENAVIA, engenheira NV-FIRST da NV Imóveis.

Objetivo:
- Atuar como ENGENHEIRA DE SOFTWARE especializada em:
  • Cloudflare Workers
  • Supabase (banco + Storage)
  • Arquiteturas serverless e distribuídas
  • Manutenção e evolução dos sistemas ENOVA e ENAVIA
  • Criação e revisão de código (JavaScript/TypeScript, SQL, infra)

Regras:
- Seja extremamente técnica, clara e direta.
- Não faça mudanças destrutivas; prefira refatorações cirúrgicas.
- Quando sugerir alteração de código, SEMPRE mostre:
  1) trechos impactados
  2) explicação linha a linha do que mudou e por quê
  3) riscos e como reverter
- Sempre respeite as decisões de arquitetura existentes,
  a menos que sejam explicitamente marcadas como legacy/para revisão.
- AUDIT só pode “carimbar” no Deploy Worker se tiver PROVA de leitura do worker-alvo e validação de compatibilidade do patch.
- Prova mínima obrigatória: context_proof (hash/assinaturas/trechos) + context_used=true (snapshot real) + audit.verdict + risk_level permitido.
- Se não conseguir ler o alvo ou não houver prova → responder “não consigo auditar com segurança” e NÃO carimbar.
- PROPOSE pode sugerir em read-only, mas deve também exigir leitura do alvo; sem leitura/prova → não sugere.
`.trim();

  const extraPieces = [];

  // ============================================================================
  // 🧠 Memory V2 — Seleciona memórias dinâmicas mais relevantes
  // ============================================================================
  const memoryEntries = Object.entries(modules).filter(([key]) =>
    key.startsWith("brain:train:")
  );

  if (memoryEntries.length > 0) {
    // Score por relevância em relação à mensagem atual
    const scored = memoryEntries
      .map(([key, value]) => ({
        key,
        text: value,
        score: scoreMemoryRelevance(userMessage, value),
      }))
      .sort((a, b) => b.score - a.score);

    // Filtra: se tiver alguma com score > 0, usa só essas;
    // se não tiver, pega as últimas 3 como fallback.
    let selected = scored.filter((m) => m.score > 0);

    if (selected.length === 0) {
      // fallback: últimas 3 memórias
      const last = memoryEntries.slice(-3);
      selected = last.map(([key, value]) => ({
        key,
        text: value,
        score: 0,
      }));
    } else {
      // limita máximo para não explodir tokens
      selected = selected.slice(0, 6);
    }

    const memoryBlock = selected
      .map(
        (m, idx) =>
          `MEMÓRIA #${idx + 1} (${m.key})\n` +
          `${m.text}`
      )
      .join("\n\n-----\n\n");

    extraPieces.push(
      "## 🧠 MEMÓRIAS RELEVANTES DA ENAVIA ##\n\n" + memoryBlock
    );
  }

// ============================================================================
// 🧠 MEMORY V3 — Clusterização e Consolidação Inteligente
// ============================================================================

// Palavras-chave simples para identificar temas
const MEMORY_TOPICS = {
  mcmv: ["mcmv", "minha casa minha vida", "programa habitacional"],
  vendas: ["venda", "fechamento", "objeção", "cliente", "negociação"],
  emocional: ["medo", "emoção", "sentimento", "trava", "insegurança"],
  tecnico: ["taxa", "financiamento", "cef", "subsídio", "entrada"],
  engenharia: [
    "worker",
    "executor",
    "rota",
    "endpoint",
    "cloudflare",
    "supabase",
    "nv-first",
    "enavia",
    "patch",
    "deploy",
    "script.js",
    "index.html",
    "async function",
    "export default",
    "fetch(request, env, ctx)"
  ]
};

// Detecta tema dominante baseado no texto do treinamento
function detectMemoryTopic(txt) {
  txt = txt.toLowerCase();
  for (const topic in MEMORY_TOPICS) {
    for (const kw of MEMORY_TOPICS[topic]) {
      if (txt.includes(kw)) return topic;
    }
  }
  return "geral";
}

// Consolida vários treinamentos em um resumo único
function consolidateMemoryPieces(pieces) {
  if (!pieces || pieces.length === 0) return "";

  let merged = pieces.join("\n\n---\n\n");

  // Remove duplicações simples
  merged = merged.replace(/\s{3,}/g, "\n\n");

  // Tenta criar um resumo final
  const finalSummary =
    `Resumo consolidado (${pieces.length} peças):\n\n` +
    merged +
    "\n\n---\n\n" +
    "Esses pontos acima representam o núcleo do aprendizado ENAVIA sobre este tema.";

  return finalSummary;
}

  // --------------------------------------------------------------------------
  // ➕ M12-AUTOPATCHENGINE-V1 → Auto Patch Engine v1 (mantido)
  // --------------------------------------------------------------------------
  const autopatchPath = "FINAL_NV/M12-AUTOPATCHENGINE-V1.txt";
  if (modules[autopatchPath]) {
    extraPieces.push(
      "M12-AUTOPATCHENGINE-V1\n\n" + modules[autopatchPath]
    );
  }

  const extra = extraPieces.join("\n\n-----\n\n");

  if (!extra) return baseSystem;

  return `${baseSystem}\n\n----- CONTEXTO NV-FIRST -----\n\n${extra}`;
}

// ---------------------------------------------------------------------------
// 📨 buildMessages(brain, userMessage)
// Agora passa a userMessage para o System Prompt (Memory V2)
// ---------------------------------------------------------------------------
function buildMessages(brain, userMessage) {
  const systemPrompt = buildSystemPrompt(brain, userMessage);

  const messages = [
    {
      role: "system",
      content: systemPrompt,
    },
    {
      role: "user",
      content: userMessage,
    },
  ];

  return messages;
}

// ---------------------------------------------------------------------------
// 🤖 callChatModel(env, messages, options)
// Faz a chamada ao modelo da OpenAI (ou compatível)
//
// PR8 — Hardening:
//   • Timeout de 25 s via AbortController — evita travar o Worker até o limite do Cloudflare.
//   • Fallback de modelo: se o modelo configurado retornar 404 (model_not_found) ou
//     400 relacionado a model, tenta automaticamente com _LLM_FALLBACK_MODEL.
//   • res.json() protegido — erro claro se a API retornar body não-JSON.
//   • choices vazio/content vazio detectado explicitamente com erro descritivo.
// ---------------------------------------------------------------------------

// Timeout padrão para chamadas LLM (ms). Mantido baixo o suficiente para caber
// dentro do limite de execução do Cloudflare Workers (30 s CPU wall).
const _LLM_CALL_TIMEOUT_MS = 25000;

// Modelo de fallback usado automaticamente se o modelo primário não for encontrado
// (HTTP 404) ou retornar erro relacionado a model inválido (HTTP 400 + "model").
const _LLM_FALLBACK_MODEL = "gpt-4.1-mini";

async function _callModelOnce(model, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ...body, model }),
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function callChatModel(env, messages, options = {}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no Worker ENAVIA NV-FIRST.");
  }

  const primaryModel =
    env.OPENAI_MODEL ||
    env.NV_OPENAI_MODEL ||
    "gpt-4.1-mini";

  const body = {
    messages,
    temperature: options.temperature ?? 0.2,
    max_completion_tokens: options.max_completion_tokens ?? options.max_tokens ?? 1600,
    top_p: options.top_p ?? 1,
    // response_format is forwarded when set (e.g. { type: "json_object" } for
    // structured output). Omitted entirely when not provided to stay compatible
    // with model versions that do not support the parameter.
    ...(options.response_format ? { response_format: options.response_format } : {}),
  };

  logNV("🔁 Chamando modelo:", primaryModel);

  // PR8: wrap fetch in AbortController for timeout protection
  let res;
  try {
    res = await _callModelOnce(primaryModel, apiKey, body, _LLM_CALL_TIMEOUT_MS);
  } catch (fetchErr) {
    if (fetchErr?.name === "AbortError") {
      throw new Error(
        `[TIMEOUT] Chamada ao modelo LLM expirou após ${_LLM_CALL_TIMEOUT_MS / 1000}s (modelo: ${primaryModel}).`,
      );
    }
    throw new Error(
      `[NETWORK] Falha de rede na chamada ao modelo LLM (modelo: ${primaryModel}): ${String(fetchErr)}`,
    );
  }

  // PR8: Model fallback — if the primary model is not found or yields a
  // model-related 400/404, retry once with _LLM_FALLBACK_MODEL before failing.
  if (!res.ok) {
    let shouldFallback = false;
    if (primaryModel !== _LLM_FALLBACK_MODEL) {
      if (res.status === 404) {
        shouldFallback = true;
      } else if (res.status === 400) {
        // Read at most 500 bytes to check for a model-related error message,
        // avoiding buffering large error bodies just for the heuristic check.
        const snippet = (await res.clone().text().catch(() => "")).slice(0, 500).toLowerCase();
        shouldFallback = snippet.includes("model");
      }
    }

    if (shouldFallback) {
      logNV(`⚠️ Modelo '${primaryModel}' indisponível (HTTP ${res.status}) — tentando fallback '${_LLM_FALLBACK_MODEL}'`);
      try {
        res = await _callModelOnce(_LLM_FALLBACK_MODEL, apiKey, body, _LLM_CALL_TIMEOUT_MS);
      } catch (fallbackErr) {
        if (fallbackErr?.name === "AbortError") {
          throw new Error(
            `[TIMEOUT] Chamada ao modelo fallback '${_LLM_FALLBACK_MODEL}' expirou após ${_LLM_CALL_TIMEOUT_MS / 1000}s.`,
          );
        }
        throw new Error(
          `[NETWORK] Falha de rede na chamada ao modelo fallback '${_LLM_FALLBACK_MODEL}': ${String(fallbackErr)}`,
        );
      }
    }
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logNV("❌ Erro na chamada ao modelo:", res.status, detail.slice(0, 400));
    throw new Error(
      `[HTTP_${res.status}] Falha na chamada ao modelo (modelo: ${primaryModel}) → HTTP ${res.status} — ${detail.slice(0, 400)}`,
    );
  }

  // PR8: guard res.json() — OpenAI may return a non-JSON body in edge cases
  let data;
  try {
    data = await res.json();
  } catch (jsonErr) {
    throw new Error(
      `[INVALID_JSON] Resposta do modelo não é JSON válido (modelo: ${primaryModel}): ${String(jsonErr)}`,
    );
  }

  // PR8: guard empty choices — content policy refusal or empty completion
  const choice = data.choices?.[0];
  if (!choice) {
    const finishReason = data.choices?.length === 0 ? "choices array vazio" : "choices ausente";
    logNV("⚠️ Modelo retornou choices vazio/ausente:", { finishReason, model: primaryModel });
    throw new Error(
      `[EMPTY_RESPONSE] Modelo retornou resposta sem choices utilizáveis (modelo: ${primaryModel}, motivo: ${finishReason}).`,
    );
  }

  const content = choice?.message?.content ?? "";
  if (!content) {
    // finish_reason "content_filter" é o caso mais comum; log para diagnóstico
    const finishReason = choice?.finish_reason || "desconhecido";
    logNV("⚠️ Modelo retornou content vazio:", { finishReason, model: primaryModel });
    throw new Error(
      `[EMPTY_CONTENT] Modelo retornou content vazio (modelo: ${primaryModel}, finish_reason: ${finishReason}). Possível filtro de conteúdo.`,
    );
  }

  logNV("✔ Resposta do modelo recebida com sucesso.");

  return {
    raw: data,
    text: content,
  };
}

// ---------------------------------------------------------------------------
// 🗣️ handleChatRequest(request, env)
// Rota principal de chat NV-FIRST (POST /)
// ---------------------------------------------------------------------------
async function handleChatRequest(request, env, ctx) {
  const method = request.method;
  const reqId = safeId("req");
  const envMode = (env.ENAVIA_MODE || "supervised").toLowerCase();

  const url = new URL(request.url);
  const path = url.pathname;

  // ✅ LER UMA ÚNICA VEZ
  let raw = await request.json().catch(() => ({}));

  const baseTelemetry = {
    req_id: reqId,
    source: "NV-FIRST",
    env_mode: envMode,
    timestamp: Date.now(),
    path,
  };

  try {
    // ✅ USAR raw (NUNCA request.json() de novo)
    const userMessage =
      raw?.message || raw?.prompt || raw?.input || "";

// ========================================================================
// 🧠 LEARNING / COGNITIVE ANALYSIS BRANCH (M05)
// Intercepta pedidos de aprendizado, reflexão ou autoanálise
// SEM executor, SEM patch, SEM staging
// ========================================================================
const learningSignals = [
  "aprendizado",
  "aprendizados",
  "lições",
  "o que aprendemos",
  "o que aprender",
  "analise seu próprio",
  "autoanálise",
  "auto análise",
  "reflexão",
  "refletir",
  "avaliar decisões",
  "lições aprendidas",
  "pontos de melhoria",
  "melhorias conceituais"
];

const lowerMsg = userMessage.toLowerCase();

const isLearningIntent =
  learningSignals.some(s => lowerMsg.includes(s)) &&
  !lowerMsg.includes("deploy") &&
  !lowerMsg.includes("patch") &&
  !lowerMsg.includes("executor");

if (isLearningIntent) {
  logNV("🧠 [LEARNING:MODE] Pedido cognitivo detectado.", { reqId });

  // 1) Garante cérebro carregado
  const brain = await buildBrain(env);

  // 2) Monta mensagens normais (ativa M01–M05)
  const messages = buildMessages(brain, userMessage);

  // 3) Chama modelo SEM engenharia
  const result = await callChatModel(env, messages, {
    temperature: 0.3,
    max_tokens: 1200,
  });

  recordDebugEvent("learning_mode", {
    reqId,
    preview: userMessage.slice(0, 120),
  });

  return withCORS(
    jsonResponse({
      ok: true,
      mode: "learning",
      output: result.text,
      telemetry: {
        ...baseTelemetry,
        stage: "learning",
      },
    })
  );
}

    if (!userMessage || !userMessage.trim()) {
      logNV("⚠️ [CHAT:EMPTY]", { reqId });

      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Mensagem vazia. Envie { "message": "..." }',
            telemetry: { ...baseTelemetry, stage: "chat" },
          },
          400,
        ),
      );
    }

    logNV("📥 [CHAT:IN]", {
      reqId,
      envMode,
      preview: userMessage.slice(0, 200),
    });

    recordDebugEvent("chat_in", {
      reqId,
      envMode,
      preview: userMessage.slice(0, 120),
    });
    
// ========================================================================
// 🔓 BYPASS REAL — detecta JSON dentro de "message" (ping, dump_executor)
// ========================================================================
try {
  let payload = raw; // usa o body já lido em: const raw = await request.json()

  // 1) Se o body chegou como { message: "{json}" }
  if (typeof raw === "object" && typeof raw.message === "string") {
    const msg = raw.message.trim();
    if (msg.startsWith("{") && msg.endsWith("}")) {
      try {
        raw = JSON.parse(msg);
      } catch {
        // ignora parse falho, segue raw original
      }
    }
  }

  // 2) Agora raw pode finalmente ser um objeto JSON real
  if (raw && typeof raw === "object" && raw.mode) {
    const SAFE = ["ping", "dump_executor"];

    // 🔎 Normaliza executor_action + mensagem para detectar comandos de deploy
    const execAction =
      typeof raw.executor_action === "string"
        ? raw.executor_action.toLowerCase()
        : "";
    const msgText =
      typeof raw.message === "string"
        ? raw.message.toLowerCase()
        : "";

    const isDeployLike =
      execAction.includes("deploy") ||
      msgText.includes("deploy") ||
      msgText.includes("staging");

    // ========================================================
    // 🔐 SAFE BYPASS (PING / DUMP_EXECUTOR)
    // ========================================================
    if (SAFE.includes(raw.mode)) {
      logNV("🔓 [BYPASS] Comando de sistema detectado → " + raw.mode, { reqId });

      const execResult = await nvSendToExecutor(env, {
        ...raw,
        reqId,
      });

      recordDebugEvent("bypass_exec", {
        reqId,
        mode: raw.mode,
        executor_ok: !!execResult?.ok,
      });

      return withCORS(
        jsonResponse({
          ok: true,
          bypass: true,
          mode: raw.mode,
          result: execResult,
          telemetry: { ...baseTelemetry, stage: "bypass" },
        })
      );
    }

    // ========================================================
    // 🔨 HANDLER EXPLÍCITO — MODO ENGINEER enviado pelo painel
    //      ⚠️ Apenas quando NÃO for comando de deploy
    // ========================================================
    if (raw.mode === "engineer" && !isDeployLike) {
      logNV("🧠 [ENG:MODE] Modo engenharia solicitado pelo console.", { reqId });

// 🧠 ENAVIA — AUTO-ANÁLISE PERMITIDA (MODO LEITURA)
// - Pode analisar o próprio Worker
// - Proibido salvar memória
// - Proibido gerar patch automaticamente
// - Proibido deploy
// Governado pelos módulos M01–M04
      const engResult = await nvEngineerBrain(
        msgText || "engenharia",
        env,
        { reqId },
      );

      return withCORS(
        jsonResponse({
          ok: true,
          mode: "engineering",
          result: engResult,
          telemetry: { ...baseTelemetry, stage: "engineering" },
        })
      );
    }

// ========================================================
// 🧠 HANDLER EXPLÍCITO — MODO BRAIN enviado pelo painel
// ========================================================
if (raw.mode === "brain") {
  logNV("🧠 [BRAIN:MODE] Treinamento recebido via painel.", { reqId });

  const trainingText = String(raw.message || raw.text || "").trim();

  if (!trainingText) {
    return withCORS(
      jsonResponse(
        {
          ok: false,
          mode: "brain",
          error: "Nenhum conteúdo de treinamento recebido.",
          detail: "Envie um texto no modo BRAIN para ser aprendido.",
        },
        400
      )
    );
  }

  // 🔒 GOVERNANÇA — leitura do enaviaindex (sem try interno)
  const indexRaw = await env.ENAVIA_BRAIN.get("enaviaindex");
  const enaviaIndex = indexRaw ? JSON.parse(indexRaw) : null;

  const writeAllowed =
    enaviaIndex &&
    enaviaIndex.write_permissions === true &&
    raw.brain_write === true &&
    typeof raw.module_id === "string";

  // ❌ Escrita NÃO permitida → modo leitura apenas
if (!writeAllowed) {
  return withCORS(
    jsonResponse(
      {
        ok: true,
        mode: "brain",
        status: "read-only",
        message:
          "Conteúdo analisado em modo leitura. Nenhum treinamento foi salvo.",
      },
      200
    )
  );
} // 👈 ESTE FECHAMENTO ESTAVA FALTANDO

// ✅ Escrita permitida — módulo canônico
const ts = new Date().toISOString().replace(/[:.]/g, "-");
const moduleKey = `enavia:${raw.module_id}:${ts}`;

await env.ENAVIA_BRAIN.put(moduleKey, trainingText);

return withCORS(
  jsonResponse(
    {
      ok: true,
      mode: "brain",
      status: "saved",
      module: raw.module_id,
      message: `Módulo ${raw.module_id} registrado com sucesso no cérebro.`,
    },
    200
  )
);

// ============================================================================
// 🔄 MEMORY V3 — Após salvar treinamento, consolidar automaticamente
// ============================================================================

async function consolidateAfterSave(env, savedKey) {
  try {
    const rawText = await env.ENAVIA_BRAIN.get(savedKey);
    if (!rawText) return;

    // 1. tema dominante
    const topic = detectMemoryTopic(rawText);

    // 2. buscar todas as memórias relacionadas a esse tema
    const list = await env.ENAVIA_BRAIN.list();
    const topicPieces = [];

    for (const item of list.keys) {
      if (item.name.includes(`train:`)) {
        const txt = await env.ENAVIA_BRAIN.get(item.name);
        if (txt && detectMemoryTopic(txt) === topic) {
          topicPieces.push(txt);
        }
      }
    }

    if (topicPieces.length === 0) return;

    // 3. gera o resumo consolidado
    const summary = consolidateMemoryPieces(topicPieces);

    // 4. salva como módulo-resumo no KV
    const summaryKey = `summary:${topic}`;
    await env.ENAVIA_BRAIN.put(summaryKey, summary);

    logNV(`📘 MEMORY V3 → Resumo atualizado: ${summaryKey}`);
  } catch (err) {
    logNV("❌ Erro ao consolidar memória:", err);
  }
}

  let index = [];
  try {
    const stored = await env.ENAVIA_BRAIN.get("brain:index");
    index = stored ? JSON.parse(stored) : [];
  } catch (e) {
    index = [];
  }

  index.push(moduleKey);
  await env.ENAVIA_BRAIN.put("brain:index", JSON.stringify(index));
  
  logNV("🧠 [BRAIN:SAVED] Módulo salvo.", { moduleKey });
  
  const brainResponse = withCORS(
    jsonResponse({
      ok: true,
      mode: "brain",
      saved_as: moduleKey,
      total_dynamic_modules: index.length,
      message: "Treinamento salvo e integrado ao cérebro.",
      telemetry: {
        ...baseTelemetry,
        stage: "brain-save",
        saved: moduleKey,
        count: index.length,
      },
    })
  );

// ============================================================================
// 🧹 MEMORY V4 — Auto-Limpeza de Memórias
// ============================================================================

async function autoCleanMemory(env) {
  try {
    const list = await env.ENAVIA_BRAIN.list();
    const removals = [];

    for (const item of list.keys) {
      if (item.name.startsWith("brain:train:")) {
        const txt = await env.ENAVIA_BRAIN.get(item.name);
        if (!txt) continue;

        const score = evaluateMemoryQuality(txt);

        // Regras simples de limpeza
        if (score <= 0) {
          removals.push(item.name);
        }
      }
    }

    // Remove entradas fracas
    for (const key of removals) {
      await env.ENAVIA_BRAIN.delete(key);
      logNV("🧹 [MEMORY V4] Removido por qualidade baixa:", { key });
    }

  } catch (err) {
    logNV("⚠️ [MEMORY V4] Erro na limpeza:", String(err));
  }
}
  
// =====================================================================
// 🧠 MEMORY V3 — Hook final de aprendizagem
// Apenas registra que o ciclo de aprendizagem foi concluído.
// Este hook será usado nas versões V4 e V5 de memória.
// =====================================================================
try {
  logNV("📗 [MEMORY V3] Ciclo de aprendizagem concluído.", {
    saved: moduleKey,
    total: index.length,
  });
} catch (err) {
  logNV("⚠️ [MEMORY V3] Falha no hook final:", String(err));
}
// =====================================================================

// =====================================================================
// 🧹 MEMORY V4 — Auto-curadoria após cada treinamento
// Organiza, limpa e reestrutura as memórias treinadas.
// =====================================================================
try {
  ctx?.waitUntil?.(autoCleanMemory(env));
  logNV("🧹 [MEMORY V4] Auto-curadoria acionada.");
} catch (err) {
  logNV("⚠️ [MEMORY V4] Falha ao acionar auto-curadoria:", String(err));
}
// =====================================================================

// =====================================================================
// 🧠 MEMORY V5 — Auto-Refinamento Inteligente (PÓS-TREINAMENTO)
// Cria uma versão melhorada do texto aprendido usando o próprio modelo.
// Garante que cada memória dinâmica tenha uma versão “refinada” mais útil.
// =====================================================================
try {
  const refinedKey = `refined:${moduleKey}`;

  // Faz a chamada ao modelo para gerar versão aprimorada
  const refineMessages = [
    {
      role: "system",
      content:
        "Você é o módulo de refinamento da ENAVIA. Sua tarefa é reescrever conteúdos aprendidos, tornando-os mais claros, estruturados, técnicos e úteis para engenharia, vendas, objeções ou raciocínio estratégico."
    },
    {
      role: "user",
      content:
        `Refine o seguinte conhecimento, torne mais útil e estruturado:\n\n${trainingText}`
    }
  ];

  const refineRes = await callChatModel(env, refineMessages, {
    temperature: 0.4,
    max_tokens: 1200
  }).catch(() => null);

  if (refineRes?.text) {
    await env.ENAVIA_BRAIN.put(refinedKey, refineRes.text);
    logNV("✨ [MEMORY V5] Memória refinada salva:", refinedKey);
  } else {
    logNV("⚠️ [MEMORY V5] Não foi possível gerar versão refinada.");
  }
} catch (err) {
  logNV("❌ [MEMORY V5] Erro no refinamento:", String(err));
}

return brainResponse;
  }
    }
  } catch (err) {
    logNV("❌ [BYPASS:ERR]", { reqId, error: String(err) });
  }

// ========================================================================
// 🚀 ROTA NOVA — SIMULAÇÃO DE PATCH NO EXECUTOR VERCEL (PATCH 1)
// ========================================================================

// POST /vercel/patch
if (method === "POST" && path === "/vercel/patch") {
  try {
    const body = await request.json();
    logNV("🔗 [VERCEL-PATCH] Requisição recebida para simulação.", body);

    const vercelURL = env.VERCEL_EXECUTOR_URL;

    const vercelRes = await fetch(vercelURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body.patch || body),
    });

    const vercelJson = await vercelRes.json().catch(() => ({
      ok: false,
      error: "Resposta inválida do executor Vercel"
    }));

    logNV("🛰 [VERCEL-PATCH] Retorno do executor:", vercelJson);

    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/vercel/patch",
          simulation: vercelJson,
          telemetry: {
            ...baseTelemetry,
            stage: "vercel-simulate",
            forward_to: vercelURL,
            status: vercelRes.status,
          },
        },
        200
      )
    );
  } catch (err) {
    logNV("❌ [VERCEL-PATCH] Falha ao encaminhar patch:", String(err));
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha ao encaminhar patch ao Executor Vercel.",
          detail: String(err),
        },
        500
      )
    );
  }
}

// ========================================================================
// 🚦 MODO ESPECIAL — deploy-vercel (painel → NV-FIRST → executor-vercel)
// ========================================================================
if (raw.mode === "deploy-vercel") {
  logNV("🚀 [MODE:DEPLOY-VERCEL] Pedido recebido do painel.", raw);

  try {
    const vercelURL = env.VERCEL_EXECUTOR_URL;

    const forward = await fetch(vercelURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(raw.patch || {}),
    });

    const out = await forward.json().catch(() => ({
      ok: false,
      error: "Resposta inválida do executor-vercel",
    }));

    logNV("📡 [DEPLOY-VERCEL] Resposta do executor:", out);

    return withCORS(
      jsonResponse({
        ok: true,
        mode: "deploy-vercel",
        executor_response: out,
        telemetry: {
          ...baseTelemetry,
          stage: "deploy-vercel",
          to: vercelURL,
          http: forward.status,
        },
      })
    );
  } catch (err) {
    logNV("❌ [DEPLOY-VERCEL] Erro:", String(err));
    return withCORS(
      jsonResponse(
        {
          ok: false,
          mode: "deploy-vercel",
          error: "Erro ao falar com executor-vercel",
          detail: String(err),
        },
        500
      )
    );
  }
}

// ========================================================================
// ⚡ AUTO-ACTION PRIORITÁRIA (ULTRA-DEBUG + DEBUG_BRAIN / DEBUG_EVENTS)
// ========================================================================
try {
  const rawMsg = userMessage.trim().toLowerCase();

  const isDebugBrain =
    rawMsg.includes("debug_brain") ||
    rawMsg.includes("debug-brain") ||
    rawMsg.includes("/debug_brain") ||
    rawMsg.includes("/debug-brain") ||
    rawMsg.includes("debug brain");

  const isDebugEvents =
    rawMsg.includes("debug-events") ||
    rawMsg.includes("debug_logs") ||
    rawMsg.includes("debug-logs") ||
    rawMsg.includes("debug events");

  if (isDebugBrain || isDebugEvents) {
    const sys = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
    const debugState = snapshotDebugState(env);

    recordDebugEvent(
      isDebugBrain ? "debug_brain" : "debug_events",
      {
        reqId,
        command: rawMsg,
      },
    );

    return withCORS(
      jsonResponse({
        ok: true,
        autoAction: isDebugBrain ? "debug_brain" : "debug_events",
        systemPrompt: isDebugBrain
          ? sys || "(nenhum SYSTEM_PROMPT encontrado no KV)"
          : undefined,
        ultraDebug: debugState,
        telemetry: { ...baseTelemetry, stage: "auto_action" },
      }),
    );
  }
} catch (err) {
  logNV("❌ [AUTO-ACTION:ERR]", { reqId, error: String(err) });
}

    // ========================================================================
    // 🔐 Hook de aprovação de deploy — comando "APROVAR DEPLOY"
    // ========================================================================
    try {
      const deployResult = await nvApproveDeploy(userMessage, env, {
        reqId,
      }).catch((err) => ({
        ok: false,
        error: String(err),
      }));

      if (deployResult) {
        const deployTelemetry = {
          ...baseTelemetry,
          stage: "deploy",
          deploy_session_id: deployResult.deploySessionId || null,
        };

        // Deploy bloqueado por modo ou política
        if (deployResult.blocked) {
          logNV("⛔ [DEPLOY:BLOCKED]", {
            reqId,
            reason: deployResult.reason,
            code: deployResult.errorCode || null,
          });

          recordDebugEvent("deploy_blocked", {
            reqId,
            reason: deployResult.reason,
            code: deployResult.errorCode || null,
          });

          return withCORS(
            jsonResponse({
              ok: false,
              mode: "deploy",
              blocked: true,
              reason: deployResult.reason,
              telemetry: deployTelemetry,
            }),
          );
        }

        // Deploy aprovado e encaminhado
        if (deployResult.ok && deployResult.deployed) {
          logNV("🚀 [DEPLOY:OK]", {
            reqId,
            deploySessionId: deployResult.deploySessionId || null,
          });

          recordDebugEvent("deploy_ok", {
            reqId,
            deploySessionId: deployResult.deploySessionId || null,
            executor_ok: !!(deployResult.executor && deployResult.executor.ok),
          });

          return withCORS(
            jsonResponse({
              ok: true,
              mode: "deploy",
              result: deployResult.executor || deployResult,
              deploy: {
                session_id: deployResult.deploySessionId || null,
                status: "apply_requested",
                last_action: "approve_default",
                patch_origin: "suggested", // padrão atual
                risk_level:
                  deployResult.executor?.risk?.level || null,
              },
              telemetry: deployTelemetry,
            }),
          );
        }
        // se deployResult existe mas não é ok/deployed → segue fluxo normal
      }
    } catch (err) {
      logNV("❌ [DEPLOY:HOOK_ERR]", { reqId, error: String(err) });
      // se der pau aqui, segue fluxo normal de engenharia/chat
    }

    // ========================================================================
    // 🧠 M11 — Hook de Engenharia (Opção D: Inteligência Contextual)
    // ========================================================================
    try {
      const lower = userMessage.toLowerCase();

      const engineeringKeywords = [
        "ajustar",
        "ajuste",
        "corrigir",
        "correção",
        "alterar",
        "alteração",
        "modificar",
        "modificação",
        "engenharia",
        "patch",
        "mexer",
        "editar",
        "reescrever",
        "modulo",
        "módulo",
        "rota",
        "worker",
        "código",
        "codigo",
        "deploy",
        "staging",
        "refatorar",
      ];

      const shouldTriggerEngineering = engineeringKeywords.some((k) =>
  lower.includes(k),
);

if (shouldTriggerEngineering) {
  logNV("⚙️ [ENG:HOOK] ativado.", { reqId });

  const engResult = await nvEngineerBrain(userMessage, env, {
    reqId,
  }).catch((err) => ({
    ok: false,
    error: String(err),
  }));

  const engTelemetry = {
    ...baseTelemetry,
    stage: "engineering",
    deploy_session_id: engResult?.deploySessionId || null,
  };

  // 🚫 Se houve bloqueio (rota crítica), retornar aviso
  if (engResult?.blocked) {
    logNV("⛔ [ENG:BLOCKED]", {
      reqId,
      protectedHits: engResult.protectedHits || [],
    });

    // 🔥 DEBUG ULTRA — REGISTRO DE BLOQUEIO
    recordDebugEvent("engineer_blocked", {
      reqId,
      protectedHits: engResult.protectedHits || [],
    });

    return withCORS(
      jsonResponse({
        ok: false,
        mode: "engineering",
        blocked: true,
        reason: engResult.reason,
        protectedHits: engResult.protectedHits || [],
        telemetry: engTelemetry,
      }),
    );
  }

  // 🧩 Se a engenharia retornou algo útil, entregar para o usuário
  if (engResult?.ok) {
    const executorResult = engResult.executor || {};

    logNV("✅ [ENG:OK]", {
      reqId,
      deploySessionId: engResult.deploySessionId || null,
    });

    recordDebugEvent("engineer_ok", {
      reqId,
      deploySessionId: engResult.deploySessionId || null,
      executor_ok: !!executorResult?.ok,
      has_staging: !!executorResult?.staging?.ready,
    });

    const deploySummary = {
      session_id: engResult.deploySessionId || null,
      executor_ok: !!executorResult?.ok,
      staging_ready: !!executorResult?.staging?.ready,
    };

    return withCORS(
      jsonResponse({
        ok: true,
        mode: "engineering",
        result: executorResult,
        deploy: deploySummary,
        telemetry: engTelemetry,
      }),
    );
  }

  // 🔎 Caso a engenharia não tenha feito nada útil
  recordDebugEvent("engineer_noop", {
    reqId,
    raw: engResult,
  });

  return withCORS(
    jsonResponse({
      ok: false,
      mode: "engineering",
      error:
        engResult?.error ||
        "Nenhuma ação de engenharia foi executada ou retornou resultado útil.",
      telemetry: engTelemetry,
    }),
  );


        // 🟡 Se não retornou nada, continua para o chat normal
        logNV("ℹ️ [ENG:NO_RESULT] Seguindo para chat normal.", {
          reqId,
        });
      }
    } catch (err) {
      logNV("❌ [ENG:HOOK_ERR]", { reqId, error: String(err) });
    
      // 🔥 DEBUG ULTRA — REGISTRO DE ERRO EM CHAT
      recordDebugEvent("chat_error", {
        reqId,
        error: String(err),
      });
    
      // Retorno padrão caso a engenharia falhe por completo
      return withCORS(
        jsonResponse({
          ok: false,
          mode: "engineering",
          error: "Falha interna durante processamento de engenharia.",
          detail: String(err),
          telemetry: {
            ...baseTelemetry,
            stage: "chat_error",
          },
        }),
      );
    }

    // -------------------------------------------------------------
    // 🔍 AUTO-ACTION CHECK (mesma lógica de antes)
    // -------------------------------------------------------------
    const auto = parseAutoAction(userMessage);

    if (auto) {
      logNV("⚙️ AUTO-ACTION acionada:", auto.action);

      switch (auto.action) {
        case "reload_index":
          await handleReloadRequest(env);
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              message: "INDEX recarregado automaticamente.",
              telemetry: { ...baseTelemetry, stage: "auto_action" },
            }),
          );

        case "list_modules":
          await loadIndex(env);
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              modules: NV_INDEX_CACHE?.modules || [],
              telemetry: { ...baseTelemetry, stage: "auto_action" },
            }),
          );

        case "debug_brain":
          // mantém handler dedicado, mas agora com CORS
          return handleDebugBrain(env);

          // Permitir também debug-brain com hífen
case "debug-brain":
  return handleDebugBrain(env);

        case "debug_load":
          return withCORS(
            jsonResponse({
              ok: false,
              autoAction: "debug_load",
              error:
                "Para carregar módulos: enviar POST /debug-load com { modules: [...] }",
              telemetry: { ...baseTelemetry, stage: "auto_action" },
            }),
          );

        case "show_system_prompt": {
          const sys = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              systemPrompt:
                sys || "(nenhum SYSTEM_PROMPT encontrado no KV)",
              telemetry: { ...baseTelemetry, stage: "auto_action" },
            }),
          );
        }
      }
    }

    // -------------------------------------------------------------
    // 🤖 CONTINUAÇÃO DO FLUXO NORMAL (IA NV-ENAVIA)
    // -------------------------------------------------------------

    // 1) Garante cérebro NV-ENAVIA inicializado
    const brain = await buildBrain(env);

    // 2) Monta contexto
    const messages = buildMessages(brain, userMessage);

// ============================================================================
// 🧠 PASSO 4 — Injetar memória estratégica do Director
// ============================================================================
let directorMemory = "";

try {
  directorMemory = getDirectorMemory({ limit: 3 });
} catch (err) {
  logNV("⚠️ Director memory unavailable:", String(err));
}

if (directorMemory) {
  messages.unshift({
    role: "system",
    content: `
======================================================================
MEMÓRIA ESTRATÉGICA DO DIRECTOR
======================================================================

${directorMemory}

Use esta memória para manter coerência histórica.
Não repita decisões já tomadas.
Nunca viole D02 ou D06.
`.trim(),
  });
}

// ============================================================================
// 🧠 PASSO 5 — Detectar nova memória estratégica do Director (COM APROVAÇÃO)
// ============================================================================
let pendingDirectorMemory = null;

try {
  pendingDirectorMemory = detectDirectorMemoryIntent(userMessage);
} catch (err) {
  logNV("⚠️ Director memory intent detection failed:", String(err));
}

    // 3) Chama modelo
    const result = await callChatModel(env, messages, {
      temperature: 0.2,
      max_tokens: 1600,
    });

    logNV("✅ [CHAT:OK]", { reqId });

    recordDebugEvent("chat_ok", {
      reqId,
      envMode,
    });

    return withCORS(
      jsonResponse({
        ok: true,
        system: "ENAVIA-NV-FIRST",
        timestamp: Date.now(),
        input: userMessage,
        output: result.text,
        telemetry: { ...baseTelemetry, stage: "chat" },
      }),
    );
  } catch (err) {
    logNV("❌ [CHAT:FATAL_ERR] handleChatRequest():", {
      reqId,
      error: String(err),
    });

    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna no handler de chat NV-ENAVIA.",
          detail: String(err),
          telemetry: { ...baseTelemetry, stage: "chat_error" },
        },
        500,
      ),
    );
  }
}

// ============================================================================
// 🧩 PARTE 3 — Rota /engineer (NV-FIRST → proxy direto para o EXECUTOR via Service Binding)
// ============================================================================
async function handleEngineerRequest(request, env) {
  try {

    // ============================================================
    // 0) VALIDAR SE O SERVICE BINDING DO EXECUTOR EXISTE
    // ============================================================
    if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
      return withCORS(jsonResponse(
        {
          ok: false,
          error: "Service Binding EXECUTOR não configurado no NV-FIRST.",
        },
        500,
      ));
    }

    logNV("🔗 [ENAVIA] Usando Service Binding EXECUTOR para chamar o executor.");

    // ============================================================
    // 1) LER O BODY DA REQUISIÇÃO
    // ============================================================
    let body = {};
    try {
      body = await request.json();
    } catch {
      return withCORS(jsonResponse(
        { ok: false, error: "JSON inválido no corpo da requisição /engineer." },
        400,
      ));
    }

    logNV("🧪 DEBUG body recebido do chat:", JSON.stringify(body, null, 2));

    // 🔧 LOG 1 — request bruto que chegou no /engineer
logNV("🔧 [ENGINEER:REQUEST_BODY]", {
  raw: body,
  method: request.method,
  ts: Date.now(),
});

    // ------------------------------------------------------------------
    // Compat detalhada: se vier "message", converter para "patch"
    // ------------------------------------------------------------------
    if (!body.patch && typeof body.message === "string") {
      body.patch = body.message;
      logNV("🔄 Compatibilidade: 'message' → 'patch'");
    }

    // Compat: se patch vier como objeto { type, content }, converte para string
if (body.patch && typeof body.patch === "object" && typeof body.patch.content === "string") {
  body.patch = body.patch.content;
  logNV("🔄 Compatibilidade: 'patch.content' → 'patch' (string)");
}

    // ============================================================
// 2) AÇÃO DIRETA (SEM PATCH)
//
// Aqui corrigimos o comportamento:
//  - Se body tiver "action", enviamos SOMENTE { action }
//    exatamente como o Postman.
// ============================================================
if (!body.patch || typeof body.patch !== "string") {

  if (body.action) {
    logNV("🔁 /engineer → ação direta:", body.action);

    const minimalPayload = { action: body.action };
    // Preserve contextual fields so status queries can be traced by bridge_id / session_id.
    // These fields are forwarded as-is; the executor decides whether to use them.
    if (body.bridge_id != null) minimalPayload.bridge_id = body.bridge_id;
    if (body.session_id != null) minimalPayload.session_id = body.session_id;

    // 🚀 LOG 2A — payload enviado ao EXECUTOR (ação direta)
    logNV("🚀 [ENGINEER→EXECUTOR] payload (ação direta)", {
      payload: minimalPayload,
      via: "ServiceBinding",
      ts: Date.now(),
    });

    const executorRes = await env.EXECUTOR.fetch("https://executor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(minimalPayload),
    });

    const executorBody = await executorRes.text();

    logNV("📡 EXECUTOR (ação direta):", {
      status: executorRes.status,
      preview: executorBody.slice(0, 300),
    });

    return withCORS(
      new Response(executorBody, {
        status: executorRes.status,
        headers: {
          "Content-Type":
            executorRes.headers.get("Content-Type") || "application/json",
        },
      })
    );
  }

  // ---------------------------------------
// Sem action → proxy 1:1 do body inteiro
// ---------------------------------------
logNV("🔁 /engineer → proxy 1:1 para executor...");

// 🚀 LOG 2B — payload enviado ao EXECUTOR (proxy 1:1)
logNV("🚀 [ENGINEER→EXECUTOR] payload (proxy 1:1)", {
  payload: body,
  via: "ServiceBinding",
  ts: Date.now(),
});

const executorResProxy = await env.EXECUTOR.fetch("https://executor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const executorBodyProxy = await executorResProxy.text();

logNV("📡 EXECUTOR (proxy):", {
  status: executorResProxy.status,
  preview: executorBodyProxy.slice(0, 300),
});

return withCORS(
  new Response(executorBodyProxy, {
    status: executorResProxy.status,
    headers: {
      "Content-Type":
        executorResProxy.headers.get("Content-Type") ||
        "application/json",
    },
  })
);

} // <-- ENCERRA o bloco do "if (!body.patch)" CORRETAMENTE!

// ============================================================================
// 3) FLUXO PATCH (quando body.patch existe e é string)
// ============================================================================
logNV("🛠️ PATCH → enviando ao executor...");
logNV("📝 PATCH preview:", body.patch.slice(0, 200));

// 🚀 LOG 2C — payload enviado ao EXECUTOR (patch)
logNV("🚀 [ENGINEER→EXECUTOR] payload (PATCH)", {
  payload: body,
  via: "ServiceBinding",
  ts: Date.now(),
});

// 🔧 NORMALIZAÇÃO CIRÚRGICA DO PATCH
body = normalizePatchForExecutor(body);

const executorResPatch = await env.EXECUTOR.fetch("https://executor", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(body),
});

const raw = await executorResPatch.text();

// ==================================================
// SE DER ERRO NO EXECUTOR
// ==================================================
if (!executorResPatch.ok) {
  return withCORS(jsonResponse(
    {
      ok: false,
      error: "Executor retornou erro.",
      code: executorResPatch.status,
      detail: raw,
      via: "ServiceBinding",
    },
    500,
  ));
}

// ==================================================
// SE EXECUTOR RETORNOU OK → PARSE JSON
// ==================================================
let parsed = raw;
try {
  parsed = JSON.parse(raw);
} catch {
  logNV("ℹ️ Executor retornou texto, não JSON.");
}

// ==================================================
// RESPOSTA FINAL DO PATCH
// ==================================================
return withCORS(jsonResponse(
  {
    ok: true,
    executor: parsed,
    via: "ServiceBinding",
  },
  200,
));

// <-- AQUI AGORA A FUNÇÃO TERMINA CERTO! 👇👇👇

} catch (err) {
  logNV("❌ Falha crítica na rota /engineer:", err);
  return withCORS(jsonResponse(
    {
      ok: false,
      error: "Falha interna na rota /engineer.",
      detail: String(err),
    },
    500,
  ));
}

} // <-- ENCERRA handleEngineerRequest CORRETAMENTE!

// ============================================================================
// 🔍 DEBUGS NV-FIRST — usados pelo router principal
// ============================================================================

// /debug-brain — status do cérebro (index + system_prompt + cache)
async function handleDebugBrain(env) {
  return withCORS(jsonResponse(
    {
      ok: true,
      timestamp: Date.now(),
      index_loaded: NV_INDEX_CACHE !== null,
      system_prompt_loaded: !!(NV_MODULE_CACHE && NV_MODULE_CACHE["SYSTEM_PROMPT"]),
      modules_in_cache: Object.keys(NV_MODULE_CACHE || {}).length,
      modules: Object.keys(NV_MODULE_CACHE || {}),
    },
    200,
    ));
}

// /debug-load — força carregamento de módulos via fila (body.modules[])
async function handleDebugLoad(request, env) {
  const body = await request.json().catch(() => ({}));

  if (!body.modules || !Array.isArray(body.modules)) {
    return withCORS(jsonResponse(
      { ok: false, error: 'Envie: { "modules": ["M01-P01.txt", ...] }' },
      400,
    ));
  }

  const results = [];

  for (const mod of body.modules) {
    try {
      const content = await loadModule(env, mod);
      results.push({
        module: mod,
        loaded: true,
        size: content.length,
      });
    } catch (err) {
      results.push({
        module: mod,
        loaded: false,
        error: String(err?.message || err),
      });
    }
  }

  return withCORS(jsonResponse(
    {
      ok: true,
      timestamp: Date.now(),
      total_requested: body.modules.length,
      total_loaded: Object.keys(NV_MODULE_CACHE || {}).length,
      results,
    },
    200,
  ));
}

// ============================================================================
// 🔍 ROTAS DE DEBUG (GET) — ABERTAS (conforme solicitado)
// ============================================================================

// ---------------------------------------------------------
// GET /engineer  → mostra status da rota /engineer (POST)
// ---------------------------------------------------------
async function handleEngineerStatus(request, env) {
  return jsonResponse({
    ok: true,
    route: "GET /engineer",
    description: "Rota de debug — mostra informações da rota POST /engineer.",
    executor_url: env.ENAVIA_EXECUTOR_URL || "não configurado",
    instructions: {
      metodo: "POST",
      endpoint: "/engineer",
      exemplo_body: {
        patch: "código ou instruções aqui",
        dryRun: true
      }
    }
  });
}

// ---------------------------------------------------------
// GET /brain/read → retorna o SYSTEM_PROMPT e módulos carregados
// ---------------------------------------------------------
async function handleBrainRead(request, env) {
  try {
    // Garante que o cérebro está carregado
    const brain = await buildBrain(env);

    return jsonResponse({
      ok: true,
      route: "GET /brain/read",
      system_prompt: brain.modules?.SYSTEM_PROMPT || "⚠️ Nenhum SYSTEM_PROMPT encontrado.",
      index: brain.index || {},
      loaded_modules: Object.keys(brain.modules || {})
    });

  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "Falha ao ler o cérebro NV-FIRST",
        detail: String(err),
      },
      500
    );
  }
}

// ============================================================================
// 👁️ ENAVIA OBSERVER — READ ONLY
// Recebe eventos do executor/browser para observação
// NÃO executa ações
// NÃO grava memória
// NÃO interfere em engenharia
// ============================================================================

async function handleEnaviaObserve(request, env) {
  try {
    if (request.method !== "POST") {
      return withCORS(
        jsonResponse(
          { ok: false, error: "Método não permitido" },
          405
        )
      );
    }

    const body = await request.json().catch(() => ({}));

    logNV("👁️ [ENAVIA:OBSERVE]", {
      timestamp: Date.now(),
      source: body.source || "unknown",
      event: body.event || "unknown",
      runId: body.runId || null,
      step: body.step || null,
      payload: body.payload || null,
    });

    return withCORS(
      jsonResponse({
        ok: true,
        mode: "observe",
        received: true,
        timestamp: Date.now(),
      })
    );
  } catch (err) {
    logNV("❌ [ENAVIA:OBSERVE:ERR]", String(err));
    return withCORS(
      jsonResponse(
        { ok: false, error: "Falha no observer" },
        500
      )
    );
  }
}

// ============================================================================
// 🧩 PARTE 4 — /reload NV-FIRST + ROUTER FINAL
// ============================================================================

// ---------------------------------------------------------------------------
// 🔄 handleReloadRequest(env)
// Limpa TODOS os caches em memória e recarrega APENAS o INDEX.
// Não força carregamento de módulos, não estoura subrequests.
// ---------------------------------------------------------------------------
async function handleReloadRequest(env) {
  try {
    logNV("🔄 /reload acionado — limpando caches NV-FIRST...");

    // Zera caches principais
    NV_INDEX_CACHE = null;
    NV_MODULE_CACHE = {};
    NV_BRAIN_READY = false;
    NV_LAST_LOAD = null;

    // Zera fila de carregamento
    NV_ACTIVE_LOADS = 0;
    NV_LOAD_QUEUE.length = 0;

    // Recarrega apenas o INDEX (nv_index.json)
    await loadIndex(env);

    logNV("✔ /reload concluído — INDEX recarregado, módulos sob demanda.");

    return jsonResponse({
      ok: true,
      action: "reload",
      message:
        "INDEX recarregado com sucesso. Módulos serão carregados sob demanda (máx. 3 simultâneos).",
      timestamp: Date.now(),
    });
  } catch (err) {
    logNV("❌ ERRO handleReloadRequest():", err);
    return jsonResponse(
      {
        ok: false,
        error: "Falha interna ao recarregar o INDEX NV-FIRST.",
        detail: String(err),
      },
      500,
    );
  }
}

// ============================================================================
// 🌐 CORS — Libera acesso do Console Privado ENAVIA (CANÔNICO)
// ============================================================================
function handleCORSPreflight(request) {
  if (request.method !== "OPTIONS") return null;

  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function withCORS(response) {
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// ============================================================================
// 🧠 ROTAS DO CÉREBRO MODULAR — /brain-query, /brain/get-module, /brain/index
// ============================================================================

// Busca até 3 módulos relevantes no INDEX a partir de um tema
async function handleBrainQuery(request, env) {
  try {
    const body = await request.json().catch(() => ({}));

    const rawQuery =
      body.query ||
      body.topic ||
      body.term ||
      body.q ||
      "";

    const query = String(rawQuery || "").trim();

    if (!query) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Envie { "query": "tema ou assunto" }',
          },
          400
        )
      );
    }

    // Garante INDEX carregado
    const index = await loadIndex(env);
    const modules = Array.isArray(index.modules) ? index.modules : [];

    const q = query.toLowerCase();

    const scored = modules
      .map((mod, idx) => {
        const name = String(mod.name || mod.key || "").toLowerCase();
        const path = String(mod.path || mod.file || mod.key || "").toLowerCase();
        const tags = Array.isArray(mod.tags)
          ? mod.tags.join(" ").toLowerCase()
          : String(mod.tags || "").toLowerCase();
        const desc = String(mod.description || mod.desc || "").toLowerCase();

        let score = 0;
        if (name.includes(q)) score += 3;
        if (tags.includes(q)) score += 2;
        if (desc.includes(q)) score += 1;
        if (path.includes(q)) score += 1;

        if (!score && (name + " " + path + " " + tags + " " + desc).includes(q)) {
          score = 1;
        }

        return {
          idx,
          score,
          mod,
        };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score || a.idx - b.idx)
      .slice(0, 3);

    const results = scored.map((entry) => {
      const m = entry.mod;
      return {
        name: m.name || m.key || null,
        key: m.key || null,
        path: m.path || m.file || null,
        tags: m.tags || null,
        description: m.description || m.desc || null,
        score: entry.score,
      };
    });

    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain-query",
          query,
          total_modules: modules.length,
          results,
        },
        200
      )
    );
  } catch (err) {
    logNV("❌ ERRO handleBrainQuery():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain-query.",
          detail: String(err),
        },
        500
      )
    );
  }
}

// Carrega o conteúdo exato de um módulo específico
async function handleBrainGetModule(request, env) {
  try {
    const body = await request.json().catch(() => ({}));

    const file =
      body.file ||
      body.path ||
      body.key ||
      "";

    const fileKey = String(file || "").trim();

    if (!fileKey) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Envie { "file": "chave-ou-caminho-do-módulo" }',
          },
          400
        )
      );
    }

    let content = null;
    let source = null;

    // 1) Se vier com "/" ou ".txt/.json", tentamos direto no Storage
    const looksLikePath =
      fileKey.includes("/") ||
      fileKey.endsWith(".txt") ||
      fileKey.endsWith(".json");

    if (looksLikePath) {
      content = await loadModule(env, fileKey);
      source = "storage";
    } else {
      // 2) Primeiro tentamos no KV
      content = await env.ENAVIA_BRAIN.get(fileKey);
      source = "kv";

      // 3) Se não encontrar no KV, tentamos resolver via INDEX → path
      if (!content) {
        const index = await loadIndex(env);
        const mods = Array.isArray(index.modules) ? index.modules : [];

        const found = mods.find(
          (m) =>
            m.key === fileKey ||
            m.name === fileKey
        );

        if (found && (found.path || found.file)) {
          const path = found.path || found.file;
          content = await loadModule(env, path);
          source = "storage_from_index";
        }
      }
    }

    if (!content) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: "Módulo não encontrado no KV nem no Storage.",
            file: fileKey,
          },
          404
        )
      );
    }

    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain/get-module",
          file: fileKey,
          source,
          size: content.length,
          content,
        },
        200
      )
    );
  } catch (err) {
    logNV("❌ ERRO handleBrainGetModule():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain/get-module.",
          detail: String(err),
        },
        500
      )
    );
  }
}

// Retorna o INDEX completo + status de cache
async function handleBrainIndex(request, env) {
  try {
    const index = await loadIndex(env);
    const modules = Array.isArray(index.modules) ? index.modules : [];

    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain/index",
          total_modules: modules.length,
          index,
          cache: {
            last_load: NV_LAST_LOAD,
            brain_ready: NV_BRAIN_READY,
          },
        },
        200
      )
    );
  } catch (err) {
    logNV("❌ ERRO handleBrainIndex():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain/index.",
          detail: String(err),
        },
        500
      )
    );
  }
}

// ============================================================================
// 🤖 MÓDULO 11 — ENGINEERING BRAIN (NV-FIRST)
// ---------------------------------------------------------------------------
// Este módulo implementa o "cérebro engenheiro" da ENAVIA, responsável por:
//  - Analisar instruções de engenharia enviadas pelo usuário
//  - Planejar patch, validar risco (executor M5), gerar sugestões (M7)
//  - Criar staging seguro (M9)
//  - Solicitar aprovação do Vasques antes de deploy (M10)
//  - Respeitar rotas proibidas e áreas críticas
//
// OBS: Este bloco NÃO altera rotas existentes. Ele apenas adiciona a lógica
//      para que o NV-FIRST saiba conversar com o Executor e operar o ciclo
//      de engenharia de forma segura e inteligente.
// ============================================================================


// 👇 Áreas críticas proibidas
const NV_PROTECTED_ROUTES = [
  "/", "/engineer", "/engineer-core", "/reload",
  "/module-get", "/module-list", "/module-save",
  "/module-patch", "/module-validate", "/module-diff",
  "/worker-patch-safe", "/worker-deploy", "/audit-log"
];

const NV_PROTECTED_FUNCTIONS = [
  "export default", "fetch(", "handleChatRequest", "handleEngineerRequest",
  "handleReloadRequest", "handleDebugBrain"
];

// ============================================================================
// 🔍 Detecção de alteração proibida
// ============================================================================

function nvDetectForbiddenChange(codeText = "") {
  const hits = [];

  for (const f of NV_PROTECTED_FUNCTIONS) {
    if (codeText.includes(f)) {
      hits.push(f);
    }
  }
  return hits;
}

// ============================================================================
// 📡 ENAVIA → EXECUTOR via SERVICE BINDING (zero-latência, seguro, sem CORS)
// ============================================================================
// Agora com telemetria (reqId, deploySessionId) e logs estruturados
async function nvSendToExecutor(env, payload, context = {}) {
  const reqId = context.reqId || payload?.reqId || safeId("req");
  const deploySessionId =
    context.deploySessionId || payload?.deploySessionId || null;

  const meta = {
    reqId,
    deploySessionId,
    mode: payload?.mode || null,
    action: payload?.action || null,
  };

  try {
    logNV("📡 [EXECUTOR:REQ]", meta);

    const response = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    let json;
    try {
      json = await response.json();
    } catch (err) {
      logNV("❌ [EXECUTOR:INVALID_JSON]", {
        ...meta,
        status: response.status,
        error: String(err),
      });

      return {
        ok: false,
        error: "EXECUTOR_INVALID_JSON",
        detail: String(err),
        status: response.status,
      };
    }

    logNV("📡 [EXECUTOR:RES]", {
      ...meta,
      ok: json?.ok,
      keys: json && typeof json === "object" ? Object.keys(json) : [],
    });

    return json;
  } catch (networkErr) {
    logNV("❌ [EXECUTOR:NETWORK_FAILURE]", {
      ...meta,
      error: String(networkErr),
    });

    return {
      ok: false,
      error: "EXECUTOR_NETWORK_FAILURE",
      detail: String(networkErr),
    };
  }
}

// ============================================================================
// 🧠 nvEngineerBrain(message, env)
// O cérebro que decide como agir quando o usuário envia instruções de engenharia
// Agora com reqId + deploySessionId e logs completos
// ============================================================================
async function nvEngineerBrain(message, env, context = {}) {
  const lower = message.toLowerCase();
  const reqId = context.reqId || safeId("req");
  const deploySessionId = context.deploySessionId || safeId("ds");

  // 🟢 Palavra-chave: "engenharia"
  const isEngineering =
    lower.includes("patch") ||
    lower.includes("corrigir") ||
    lower.includes("ajustar") ||
    lower.includes("modificar") ||
    lower.includes("alterar") ||
    lower.includes("melhorar") ||
    lower.includes("engenharia");

  if (!isEngineering) return null;

  logNV("🧠 [ENG:REQUEST]", { reqId, deploySessionId });

  // 🧠 Construção da intenção para o Executor M7
  const payload = {
    mode: "engineer",
    intent: message,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
    reqId,
    deploySessionId,
  };

  const result = await nvSendToExecutor(env, payload, {
    reqId,
    deploySessionId,
  });

  // 🚫 Se houver tentativa de tocar áreas críticas, aborta
  if (result?.risk?.protectedHits?.length > 0) {
    logNV("⛔ [ENG:FORBIDDEN]", {
      reqId,
      deploySessionId,
      protectedHits: result.risk.protectedHits,
    });

    return {
      ok: false,
      blocked: true,
      reason: "Tentativa de alterar rota ou função crítica.",
      protectedHits: result.risk.protectedHits,
      deploySessionId,
    };
  }

  logNV("🧠 [ENG:RESPONSE_OK]", {
    reqId,
    deploySessionId,
    ok: result?.ok,
  });

  return {
    ok: true,
    executor: result,
    deploySessionId,
  };
}

// ============================================================================
// 🧠 nvApproveDeploy(message, env)
// Detecta "APROVAR DEPLOY" e dispara M10 com staging gerado,
// agora com governança de modo e telemetria completa.
// ============================================================================
async function nvApproveDeploy(message, env, context = {}) {
  const lower = message.toLowerCase();

  // Por enquanto, mantemos apenas comando "aprovar deploy"
  if (!lower.includes("aprovar deploy")) return null;

  const envMode = (env.ENAVIA_MODE || "supervised").toLowerCase();
  const reqId = context.reqId || safeId("req");
  const deploySessionId = context.deploySessionId || safeId("ds");

  logNV("🧠 [DEPLOY:CMD] 'APROVAR DEPLOY' recebido.", {
    reqId,
    deploySessionId,
    envMode,
  });

  // 🔐 Governança por modo
  if (envMode === "read-only") {
    logNV("⛔ [DEPLOY:BLOCK_MODE]", {
      reqId,
      deploySessionId,
      reason: "ENAVIA_MODE=read-only",
    });

    return {
      ok: false,
      deployed: false,
      blocked: true,
      reason:
        "ENAVIA_MODE=read-only: deploy desativado. Altere para 'supervised' para permitir APPLY.",
      deploySessionId,
      errorCode: "MODE_READ_ONLY",
    };
  }

  // ============================================================
  // 🔘 BOTÕES DE DEPLOY — NV-FIRST v1
  // ============================================================

  // 1) "listar staging"
  if (lower.includes("listar staging")) {
    const payload = { mode: "list_staging", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // 2) "descartar staging"
  if (lower.includes("descartar staging")) {
    const payload = { mode: "discard_staging", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // 3) "gerar diff"
  if (lower.includes("gerar diff")) {
    const payload = { mode: "generate_diff", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // 4) "mostrar patch"
  if (lower.includes("mostrar patch")) {
    const payload = { mode: "show_patch", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // 5) "simular deploy"
  if (lower.includes("simular deploy")) {
    const payload = {
      mode: "apply",
      dryRun: true,
      reqId,
      deploySessionId,
    };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // 6) "aplicar patch agora"
  if (lower.includes("aplicar patch agora")) {
    const payload = {
      mode: "apply",
      dryRun: false,
      reqId,
      deploySessionId,
    };
    return await nvSendToExecutor(env, payload, { reqId, deploySessionId });
  }

  // Recupera staging gerado anteriormente pelo M9
  // Executor continua responsável por decidir qual staging usar.
  const payload = {
    mode: "deploy_request",
    approve: true,
    approvedBy: "Vasques",
    reason: "Aprovação explícita via NV-FIRST",
    reqId,
    deploySessionId,
  };

  const result = await nvSendToExecutor(env, payload, {
    reqId,
    deploySessionId,
  });

  logNV("🧠 [DEPLOY:EXECUTOR_RES]", {
    reqId,
    deploySessionId,
    ok: result?.ok,
  });

  return {
    ok: true,
    deployed: true,
    executor: result,
    deploySessionId,
  };
}

async function loadDirectorBrain(env) {
  const indexKey = "director:index";
  const indexRaw = await env.ENAVIA_BRAIN.get(indexKey);

  if (!indexRaw) {
    throw new Error("DIRECTOR_INDEX_NOT_FOUND");
  }

  // Extrai keys do index (linhas com 'KEY:')
  const moduleKeys = indexRaw
    .split("\n")
    .filter(line => line.trim().startsWith("KEY:"))
    .map(line => line.replace("KEY:", "").trim());

  if (moduleKeys.length === 0) {
    throw new Error("NO_DIRECTOR_MODULES_FOUND");
  }

  const modules = [];

  for (const key of moduleKeys) {
    if (!key.startsWith("director:")) {
      throw new Error(`ACCESS_DENIED_INVALID_KEY ${key}`);
    }

    const content = await env.ENAVIA_BRAIN.get(key);

    if (!content) {
      throw new Error(`DIRECTOR_MODULE_NOT_FOUND ${key}`);
    }

    modules.push({
      key,
      content
    });
  }

  const merged = modules
    .map(m => `### [${m.key}]\n${m.content}`)
    .join("\n\n");

  return {
    version: "v1.0",
    modules: modules.map(m => m.key),
    content: merged
  };
}

// ============================================================================
// 🚦 ROUTER FINAL — ENAVIA NV-FIRST
// Rotas disponíveis:
//   POST /          → Chat NV-FIRST
//   POST /engineer → Relay para executor core
//   POST /reload   → Recarrega INDEX
//   POST /debug-load → Carrega módulos reais via FILA
//   GET  /debug-brain → Estado real do cérebro NV-FIRST
//   GET  /         → Ping/saúde do Worker
// ============================================================================

// ============================================================================
// 🧠 PLANNER RUN — Pipeline estruturado PM4→PM5→PM6→PM7→PM8→PM9
// POST /planner/run
//
// Aceita instrução do usuário e retorna payload estruturado com:
//   classification, canonicalPlan, gate, bridge, memoryConsolidation, outputMode
//
// Este endpoint destrava P7/P8 ao fornecer retorno real e auditável
// que o painel pode consumir sem mock.
// ============================================================================

// ---------------------------------------------------------------------------
// _resolveOperatorIntent(context, rawMessage)
//
// P-BRIEF — Resolução canônica do texto operacional para PM4/PM5/PM6.
//
// Ordem de prioridade (decrescente):
//   1. context.planner_brief.operator_intent — intenção real alinhada no Chat
//   2. rawMessage — fallback seguro (trigger bruto, ex: "Gerar plano")
//
// "Gerar plano" é um trigger/comando e NUNCA deve virar objetivo do plano.
//
// Retorna { resolvedText, objectiveSource, hasPlannerBrief }
// ---------------------------------------------------------------------------
function _resolveOperatorIntent(context, rawMessage) {
  const intent = typeof context?.planner_brief?.operator_intent === "string"
    ? context.planner_brief.operator_intent.trim()
    : "";
  return {
    resolvedText:     intent.length > 0 ? intent : rawMessage,
    objectiveSource:  intent.length > 0 ? "planner_brief.operator_intent" : "body.message",
    hasPlannerBrief:  intent.length > 0,
  };
}

async function handlePlannerRun(request, env) {
  const startedAt = Date.now();

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "JSON inválido em /planner/run.", detail: String(err) },
      400
    );
  }

  if (!body || typeof body !== "object") body = {};

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonResponse(
      { ok: false, error: "'message' é obrigatório e deve ser string não vazia." },
      400
    );
  }

  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const context = body.context && typeof body.context === "object" ? body.context : {};

  try {
    // P16 — Leitura de memória útil antes da montagem do plano (PM3)
    // Fire-and-forget defensivo: erros não derrubam o pipeline.
    let memReadRaw = { ok: false, error: "ENAVIA_BRAIN unavailable" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        memReadRaw = await searchRelevantMemory(context, env);
      } catch (memErr) {
        memReadRaw = { ok: false, error: String(memErr) };
      }
    }
    const memoryReadAudit = {
      consulted: memReadRaw.ok === true,
      count:     memReadRaw.ok ? memReadRaw.count : 0,
      types:     memReadRaw.ok
        ? [...new Set(memReadRaw.results.map((m) => m.memory_type))]
        : [],
      ...(memReadRaw.ok ? {} : { error: memReadRaw.error }),
    };

    // P16 — Construção do contexto enriquecido pré-plano
    // O memory_context encapsula um resumo mínimo e estrutural das memórias lidas.
    // É injetado no plannerContext e flui explicitamente para PM4 e adiante.
    // Os itens são limitados a 5 para evitar vazamento excessivo de conteúdo.

    // P17 — Prioridade de memória em runtime (canônica > estado vivo > operacional recente)
    // Classifica os resultados já ordenados por PM3 nas 3 camadas canônicas do contrato.
    // Expõe evidência auditável sem reescrever PM3 — apenas sela e explicita a regra.
    const _P17_TIER_CANONICAL  = "canonical";  // canonical_rules + is_canonical=true
    const _P17_TIER_LIVE       = "live";        // live_context
    const _P17_TIER_OPERATIONAL = "operational"; // operational_history (recente)

    function _p17Tier(mem) {
      if (mem.is_canonical === true || mem.memory_type === "canonical_rules") return _P17_TIER_CANONICAL;
      if (mem.memory_type === "live_context")        return _P17_TIER_LIVE;
      if (mem.memory_type === "operational_history") return _P17_TIER_OPERATIONAL;
      return null; // outros tipos não pertencem às 3 camadas P17
    }

    // Ordem de prioridade P17 (índice menor = maior prioridade)
    const _P17_ORDER = [_P17_TIER_CANONICAL, _P17_TIER_LIVE, _P17_TIER_OPERATIONAL];

    // Calcula priority_applied a partir dos resultados já ordenados de PM3
    const _p17Results = memReadRaw.ok ? memReadRaw.results : [];
    const _p17TypesByTier = { canonical: [], live: [], operational: [] };
    for (const mem of _p17Results) {
      const tier = _p17Tier(mem);
      if (tier && !_p17TypesByTier[tier].includes(mem.memory_type)) {
        _p17TypesByTier[tier].push(mem.memory_type);
      }
    }

    // Winning tier: first tier (in P17 order) that has at least one memory
    const _p17WinningTier = _P17_ORDER.find((t) => _p17TypesByTier[t].length > 0) || null;

    const priority_applied = {
      order:          _P17_ORDER,
      types_by_tier:  _p17TypesByTier,
      winning_tier:   _p17WinningTier,
    };

    const memory_context = {
      applied:          memReadRaw.ok && memReadRaw.count > 0,
      count:            memoryReadAudit.count,
      types:            memoryReadAudit.types,
      priority_applied, // P17 — prioridade canônica de runtime explícita e auditável
      items:    memReadRaw.ok
        ? memReadRaw.results.slice(0, 5).map((m) => ({
            memory_id:    m.memory_id,
            title:        m.title,
            memory_type:  m.memory_type,
            is_canonical: m.is_canonical,
            priority:     m.priority,
            content_text: m.content_structured?.text || null, // conteúdo real para o pipeline PM4+
          }))
        : [],
    };

    // PR3 — Retrieval Pipeline: separação explícita entre blocos de memória
    // Leitura estruturada com classificação, ranking, recência e regra de conflito.
    // Fire-and-forget defensivo: erros não derrubam o pipeline.
    let retrievalResult = { ok: false, error: "retrieval skipped: ENAVIA_BRAIN binding not available" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        retrievalResult = await buildRetrievalContext(context, env);
      } catch (retErr) {
        retrievalResult = { ok: false, error: String(retErr) };
      }
    }
    const retrieval_context = buildRetrievalSummary(retrievalResult);

    // plannerContext = contexto original enriquecido com resumo de memória (P16/P17)
    // + retrieval_context (PR3 — separação explícita de blocos).
    // PM4 recebe este contexto; sinais de memória estão estruturalmente presentes.
    const plannerContext = { ...context, memory_context, retrieval_context };

    // P-BRIEF — Resolução do objetivo operacional via helper canônico.
    // operator_intent vence sobre body.message para PM4/PM5/PM6.
    const { resolvedText, objectiveSource, hasPlannerBrief } =
      _resolveOperatorIntent(context, message);

    // PM4 — Classificação (recebe plannerContext enriquecido)
    const classification = classifyRequest({ text: resolvedText, context: plannerContext });

    // PM5 — Output Envelope
    const envelope = buildOutputEnvelope(classification, { text: resolvedText });

    // PM6 — Plano Canônico
    // P-BRIEF: planner_brief encaminhado para PM6 quando disponível — steps derivados do contexto real.
    const canonicalPlan = buildCanonicalPlan({
      classification,
      envelope,
      input: { text: resolvedText },
      planner_brief: context?.planner_brief ?? null,
    });

    // PM7 — Gate de Aprovação
    const gate = evaluateApprovalGate(canonicalPlan);

    // PM8 — Bridge com Executor
    const bridge = buildExecutorBridgePayload({ plan: canonicalPlan, gate });

    // PM9 — Consolidação de Memória
    const memoryConsolidation = consolidateMemoryLearning({
      plan: canonicalPlan,
      gate,
      bridge,
    });

    // P15 — Persistência real pós-ciclo: persiste cada candidato PM9 no KV via PM2 (writeMemory)
    // Acionado apenas quando should_consolidate === true e env.ENAVIA_BRAIN disponível.
    // Falhas de persistência são registradas no log e no campo consolidation_persisted,
    // mas não quebram o response do pipeline (fire-and-forget defensivo).
    const consolidation_persisted = [];
    if (memoryConsolidation.should_consolidate && env && env.ENAVIA_BRAIN) {
      const cycleId = session_id || safeId("cycle");
      const nowIso = new Date().toISOString();

      for (const candidate of memoryConsolidation.memory_candidates) {
        const memObj = buildMemoryObject({
          ...candidate,
          memory_id:  crypto.randomUUID(),
          entity_type: ENTITY_TYPES.OPERATION,
          entity_id:   cycleId,
          source:      "planner_run",
          created_at:  nowIso,
          updated_at:  nowIso,
          expires_at:  null,
          flags:       [],
        });

        let writeResult;
        try {
          writeResult = await writeMemory(memObj, env);
        } catch (kvErr) {
          logNV("⚠️ [P15] Falha ao persistir candidato PM9 (não crítico)", {
            memory_type: candidate.memory_type,
            error: String(kvErr),
          });
          writeResult = { ok: false, error: String(kvErr) };
        }

        consolidation_persisted.push({
          memory_id:   memObj.memory_id,
          memory_type: memObj.memory_type,
          is_canonical: memObj.is_canonical,
          kv_key:      `memory:${memObj.memory_id}`,
          write_ok:    writeResult.ok === true,
          error:       writeResult.ok ? undefined : writeResult.error,
        });
      }

      logNV("🧠 [P15] Consolidação de memória persistida pós-ciclo", {
        candidates: consolidation_persisted.length,
        cycle_id: cycleId,
        results: consolidation_persisted,
      });
    }

    const plannerPayload = {
      memoryContext: memory_context,
      retrievalContext: retrieval_context, // PR3 — separação explícita de blocos
      classification,
      canonicalPlan,
      gate,
      bridge,
      memoryConsolidation,
      outputMode: envelope.output_mode,
    };

    // Persistir snapshot para GET /planner/latest (fire-and-forget, não crítico)
    if (session_id && env?.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put(
          `planner:latest:${session_id}`,
          JSON.stringify(plannerPayload),
          { expirationTtl: _PENDING_PLAN_TTL_SECONDS }
        );
        logNV("💾 [PLANNER/RUN] planner:latest salvo no KV", { session_id });
      } catch (kvErr) {
        logNV("⚠️ [PLANNER/RUN] Falha ao persistir planner:latest (não crítico)", {
          session_id,
          error: String(kvErr),
        });
      }
    }

    // Derive top-level memory telemetry from memory_context (P16/P17).
    // memory_applied: true when relevant memories were read and injected.
    // memory_hits: compact list of the items that were available to the pipeline.
    const _plannerMemApplied = memory_context.applied === true && memory_context.count > 0;
    const _plannerMemHits = _plannerMemApplied
      ? memory_context.items.map((m) => ({
          id:    m.memory_id,
          title: m.title,
          type:  m.memory_type,
          block: m.is_canonical ? "canonical" : m.memory_type,
        }))
      : [];

    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      timestamp: Date.now(),
      input: message,
      memory_applied: _plannerMemApplied,
      memory_hits: _plannerMemHits,
      planner: plannerPayload,
      telemetry: {
        fix_active: "P-BRIEF-v2", // sentinel: confirms this worker has the P-BRIEF fix deployed
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: "PR3→PM3→PM4→PM5→PM6→PM7→PM8→PM9→P15",
        memory_read: memoryReadAudit,
        retrieval: retrieval_context, // PR3 — auditoria de retrieval
        consolidation_persisted,
        // P-BRIEF — objetivo auditável (telemetria de diagnóstico)
        has_planner_brief: hasPlannerBrief,
        objective_source: objectiveSource,
        raw_message: message,
        resolved_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
        canonical_plan_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
        // always shows what context.planner_brief.operator_intent actually contained when received;
        // null means the field was absent — use alongside objective_source to diagnose fallbacks
        planner_brief_operator_intent_preview: context?.planner_brief?.operator_intent != null
          ? String(context.planner_brief.operator_intent).slice(0, 120)
          : null,
        // P-BRIEF steps telemetry — auditável: origem dos steps e preview do primeiro
        steps_source:                 canonicalPlan.steps_source ?? "generic_fallback",
        planner_brief_used_for_steps: canonicalPlan.planner_brief_used_for_steps ?? false,
        steps_preview:                Array.isArray(canonicalPlan.steps) && canonicalPlan.steps.length > 0
          ? canonicalPlan.steps[0]
          : null,
      },
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        timestamp: Date.now(),
        error: "Falha no pipeline do planner.",
        detail: String(err),
        telemetry: {
          duration_ms: Date.now() - startedAt,
        },
      },
      500
    );
  }
}

// ============================================================================
// 📋 GET /planner/latest — Retorna o último plano gerado para uma sessão
//
// Fonte: KV planner:latest:{session_id} (escrito por handlePlannerRun).
// Retorna has_plan=false sem erro quando não há plano para a sessão.
// session_id obrigatório — sem ele, retorna 400.
// ============================================================================
async function handlePlannerLatest(request, env) {
  const url = new URL(request.url);
  const session_id = (url.searchParams.get("session_id") || "").trim();

  if (!session_id) {
    return jsonResponse({ ok: false, error: "session_id é obrigatório." }, 400);
  }

  if (!env?.ENAVIA_BRAIN) {
    logNV("⚠️ [PLANNER/LATEST] ENAVIA_BRAIN indisponível — retornando has_plan=false", { session_id });
    return jsonResponse({ ok: true, session_id, has_plan: false, plan: null });
  }

  let plannerPayload = null;
  try {
    plannerPayload = await env.ENAVIA_BRAIN.get(`planner:latest:${session_id}`, "json");
  } catch (kvErr) {
    logNV("⚠️ [PLANNER/LATEST] Erro ao buscar planner:latest do KV", {
      session_id,
      error: String(kvErr),
    });
    return jsonResponse(
      { ok: false, error: "Falha ao buscar plano.", detail: String(kvErr) },
      500
    );
  }

  if (!plannerPayload) {
    return jsonResponse({ ok: true, session_id, has_plan: false, plan: null });
  }

  return jsonResponse({ ok: true, session_id, has_plan: true, plan: plannerPayload });
}

// ============================================================================
// 🛡️ PR3 — Tool Arbitration: Reply Sanitizers
//
// Two complementary sanitization layers for /chat/run:
//
// Layer 1 — Mechanical term leak (_sanitizeChatReply):
//   Catches replies where the LLM dumped internal planner field names
//   (next_action, reason:, scope_summary, etc.) as the dominant structure.
//   Threshold: 3+ distinct mechanical terms = planner output leaked to surface.
//
// Layer 2 — Manual plan leak (_isManualPlanReply):
//   Catches replies where the LLM "did the planner manually" by writing a
//   full structured plan inline (Fase 1 / Etapa 2 / ## Header, etc.) instead
//   of a natural conversational reply. Used only when PM4 already forced the
//   planner internally — so the plan structure belongs in plannerSnapshot,
//   not in the conversational reply surface.
// ============================================================================

// PR7: Canonical parse mode values for telemetry.llm_parse_mode
const _LLM_PARSE_MODE = {
  JSON_PARSED:         "json_parsed",
  PLAIN_TEXT_FALLBACK: "plain_text_fallback",
  UNKNOWN:             "unknown",
};
// PR36: planner leak forte exige sinais de snapshot interno bruto, não menção em prosa.
// Padrões abaixo capturam JSON-like / estrutura de payload interno: chave seguida de :, ", ou =,
// que é como o planner de fato vaza. Prosa que apenas cite o conceito não bate.
const _PLANNER_LEAK_PATTERNS = [
  /\bnext_action\s*[:=]/i,
  /\bplanner_snapshot\b/i,
  /\bcanonical_plan\b/i,
  /\bapproval_gate\b/i,
  /\bexecution_payload\b/i,
  /\bscope_summary\s*[:=]/i,
  /\bacceptance_criteria\s*[:=]/i,
  /\bplan_type\s*[:=]/i,
  /\bcomplexity_level\s*[:=]/i,
  /\boutput_mode\s*[:=]/i,
  /\bplan_version\s*[:=]/i,
  /\bneeds_human_approval\s*[:=]/i,
  /\bneeds_formal_contract\s*[:=]/i,
];

// PR36: threshold elevado + exigência de sinal estrutural (JSON-like) também.
// Prosa estratégica que cite "critérios de aceite" ou "next_action" como conceito
// não dispara; apenas snapshot bruto do planner vazando.
const _PLANNER_LEAK_THRESHOLD = 4;
// PR36: comprimento máximo de janela JSON-like inspecionada para detectar leak
// estrutural do planner. Valor escolhido como compromisso: grande o suficiente
// para capturar payloads internos típicos sem que a regex se torne cara.
const _PLANNER_LEAK_STRUCTURAL_WINDOW = 200;
// Sinal estrutural complementar: chaves JSON ou múltiplos campos no formato chave:"valor".
const _PLANNER_LEAK_STRUCTURAL_PATTERNS = [
  // Padrão JSON-like: aspas em torno de chaves operacionais conhecidas
  /"\s*(next_action|planner_snapshot|canonical_plan|approval_gate|execution_payload|acceptance_criteria|scope_summary|plan_type|complexity_level|output_mode)\s*"\s*:/i,
  // Bloco com chaves abertas + uma das chaves do planner (janela curta)
  new RegExp(
    "\\{[^}]{0," + _PLANNER_LEAK_STRUCTURAL_WINDOW + "}\\b(next_action|canonical_plan|approval_gate|execution_payload)\\b",
    "i",
  ),
];

function _sanitizeChatReply(reply) {
  if (!reply || typeof reply !== "string") return reply;

  // Count how many planner-internal structural patterns are present in the reply
  let leakCount = 0;
  for (const pattern of _PLANNER_LEAK_PATTERNS) {
    if (pattern.test(reply)) leakCount++;
  }

  // PR36: estrutural JSON-like dispara independentemente da quantidade de termos.
  const hasStructuralLeak = _PLANNER_LEAK_STRUCTURAL_PATTERNS.some((p) => p.test(reply));

  // Threshold elevado para 4 termos com forma "campo:" — só dispara em snapshot bruto.
  // Prosa natural ao operador que cite conceitos do planner não é mais destruída.
  if (hasStructuralLeak || leakCount >= _PLANNER_LEAK_THRESHOLD) {
    return "Entendido. Estou com isso — pode continuar.";
  }

  return reply;
}

// Patterns indicating the LLM wrote a full structured plan inline in reply
// instead of a natural conversational acknowledgement.
const _MANUAL_PLAN_PATTERNS = [
  /\bFase\s+\d+/i,           // Fase 1:, Fase 2, etc.
  /\bEtapa\s+\d+/i,          // Etapa 1:, etc.
  /\bPasso\s+\d+/i,          // Passo 1:, etc.
  /\bPhase\s+\d+/i,          // Phase 1 (English)
  /\bStep\s+\d+/i,           // Step 1 (English)
  /^#{1,3}\s+\w/m,           // Markdown headers (##, ###)
  /\bCritérios de aceite\b/i, // acceptance criteria language
  /\bCriteria\b.*:/i,         // criteria: pattern
];

// PR36: threshold elevado e exigência de evidência forte de que é planner snapshot,
// não resposta estratégica útil ao operador. Markdown/headers/etapas em prosa
// estratégica legítima ao operador NÃO devem mais ser destruídos.
const _MANUAL_PLAN_THRESHOLD = 5;

// Natural fallback reply when a manual plan leak is detected in the reply surface.
// The plan structure lives in plannerSnapshot — the reply must stay conversational.
const _MANUAL_PLAN_FALLBACK =
  "Entendido. Já organizei as etapas internamente — pode avançar ou me dizer se quer ajustar algo.";

// PR36: detecta se o reply parece prosa natural ao operador (texto explicativo)
// vs snapshot bruto do planner. Prosa natural tem pontuação variada, parágrafos,
// frases conectadas — não é apenas lista mecânica.
// Heurística orientada a português do BR (alfabeto latino com acentos). É
// intencionalmente simples — falsos negativos são preferíveis a falsos positivos
// porque o sinal estrutural JSON-like (`_PLANNER_LEAK_STRUCTURAL_PATTERNS`) e o
// threshold ainda capturam leak real do planner mesmo se este bypass não disparar.
function _looksLikeNaturalProse(reply) {
  if (!reply || typeof reply !== "string") return false;
  // Resposta curta com bullets pode ser plano interno; resposta longa com prosa = útil ao operador.
  if (reply.length < 200) return false;
  // Conta marcas de prosa: pontuação final seguida de início de nova frase com letra
  // maiúscula (com ou sem acento). Cobre PT-BR e EN; pode subcontar frases que
  // começam com minúscula ou números — aceitável (ver nota acima).
  const sentences = (reply.match(/[.!?]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g) || []).length;
  // Se tem pelo menos 3 transições de frase, é prosa.
  return sentences >= 3;
}

// Returns true if the reply looks like the LLM wrote a structured plan inline
// (instead of a short natural conversational reply).
// Counts total occurrences across all patterns (not just distinct patterns),
// so "Fase 1 / Fase 2 / Fase 3" with a single pattern counts as 3 hits.
// PR36: aumentado threshold + bypass para prosa natural útil ao operador.
function _isManualPlanReply(reply) {
  if (!reply || typeof reply !== "string") return false;
  // PR36: prosa natural útil ao operador não é considerada manual plan, mesmo com headers.
  if (_looksLikeNaturalProse(reply)) return false;
  let count = 0;
  for (const pattern of _MANUAL_PLAN_PATTERNS) {
    // Re-create with global flag to count all occurrences (not just first match)
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const globalPat = new RegExp(pattern.source, flags);
    const matches = reply.match(globalPat);
    if (matches) count += matches.length;
  }
  return count >= _MANUAL_PLAN_THRESHOLD;
}

// PR36: named exports aditivos para tornar helpers testáveis sem refatorar o runtime.
// O worker do Cloudflare consome apenas o `export default {fetch}`; estes named exports
// são opt-in para os smoke tests e não alteram o comportamento de produção.
export {
  _sanitizeChatReply,
  _isManualPlanReply,
  _looksLikeNaturalProse,
  _MANUAL_PLAN_FALLBACK,
  isOperationalMessage,
};

// ============================================================================
// Chat Bridge — constantes de aprovação e termos perigosos (Bloco B)
//
// Listas determinísticas usadas para detectar aprovação explícita e bloquear
// mensagens com termos de risco sem depender do LLM.
// ============================================================================
const _CHAT_BRIDGE_APPROVAL_TERMS = [
  "aprovado", "pode executar", "confirmo", "sim, execute", "execute agora", "go",
];
const _CHAT_BRIDGE_DANGEROUS_TERMS = [
  "deploy", "delete", "rm ", "drop", "prod", "produção", "write", "patch", "post", "merge", "rollback",
];
// TTL for pending_plan stored in KV after planner generates a plan requiring approval.
const _PENDING_PLAN_TTL_SECONDS = 600;

// ============================================================================
// _dispatchFromChat — helper interno: despacha executor a partir de pending_plan
//
// Recebe env e pendingPlan (já recuperado do KV).
// Chama o executor via service binding, grava trilha de execução no KV com o
// mesmo shape que handlePlannerBridge usa (para /execution enxergar o evento).
// Retorna { ok, bridge_id, executor_ok, executor_response?, error?, detail? }
// ============================================================================
async function _dispatchFromChat(env, pendingPlan) {
  const bridgeId = pendingPlan.bridge_id || safeId("bridge");
  const sessionId = pendingPlan.session_id || null;
  const ep = pendingPlan.bridge_executor_payload;

  logNV("🚀 [CHAT/BRIDGE] Disparando executor a partir de aprovação no chat", {
    bridgeId,
    sessionId,
    source: ep?.source,
  });

  let executorJson = null;
  let executorStatus = null;
  let executorOk = false;
  let networkError = null;

  try {
    const executorPayload = {
      action: "execute_plan",
      source: "chat_bridge",
      bridge_id: bridgeId,
      session_id: sessionId,
      executor_payload: ep,
    };

    const executorRes = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executorPayload),
    });

    executorStatus = executorRes.status;
    executorOk = executorStatus >= 200 && executorStatus < 300;

    try {
      executorJson = await executorRes.json();
    } catch {
      executorJson = { ok: false, error: "EXECUTOR_INVALID_JSON" };
    }

    logNV("🚀 [CHAT/BRIDGE] Resposta do executor", {
      bridgeId,
      executor_ok: executorOk,
      status: executorStatus,
    });
  } catch (netErr) {
    networkError = String(netErr);
    logNV("🔴 [CHAT/BRIDGE] Falha de rede ao chamar executor", {
      bridgeId,
      error: networkError,
    });
  }

  // Persistir trilha de execução — mesmo shape que handlePlannerBridge usa
  // para que GET /execution enxergue o evento gerado pelo chat bridge.
  const trail = {
    bridge_id: bridgeId,
    dispatched_at: new Date().toISOString(),
    session_id: sessionId,
    source: ep?.source || "chat_bridge",
    steps_count: Array.isArray(ep?.steps) ? ep.steps.length : 0,
    executor_ok: executorOk,
    executor_status: executorStatus,
    executor_error: networkError
      ? "NETWORK_ERROR"
      : (executorOk ? null : (executorJson?.error ?? null)),
  };

  if (env.ENAVIA_BRAIN) {
    try {
      await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(trail));
      await env.ENAVIA_BRAIN.put(`execution:trail:${bridgeId}`, JSON.stringify(trail));
    } catch (kvErr) {
      logNV("⚠️ [CHAT/BRIDGE] Falha ao persistir trilha no KV (não crítico)", {
        bridgeId,
        error: String(kvErr),
      });
    }
  }

  if (networkError) {
    return { ok: false, bridge_id: bridgeId, executor_ok: false, error: "NETWORK_ERROR", detail: networkError };
  }
  return { ok: executorOk, bridge_id: bridgeId, executor_ok: executorOk, executor_response: executorJson };
}

// Terms used to detect operational context from the incoming message.
// Separate from _CHAT_BRIDGE_OPERATIONAL_TERMS (planner activation) —
// this set is broader and focused on whether the message implies
// system/worker/validation intent that warrants operational mode.
// PR36: Heurística mínima de intenção operacional.
// Diferencia "target presente = contexto técnico disponível" de "intenção operacional = tom/estrutura operacional aplicável".
// Conversa simples ("oi", "você está parecendo um bot") NÃO deve ativar tom operacional só porque há target.
// Mensagem realmente operacional (deploy, executor, contrato, worker, health, diagnóstico técnico, logs, erro,
// branch, merge, rollback, revisar PR, rota) ainda pode ativar contexto operacional.
// Esta NÃO é o Intent Engine completo — é desacoplamento inicial seguro.
// PR38: refinamento cirúrgico da heurística de intenção operacional.
// Removidos: "sistema" e "contrato" — genéricos demais, causavam falso positivo em
//   perguntas conceituais como "Você sabe operar seu sistema?" e
//   "explique o que é o contrato Jarvis Brain".
// Substituídos por termos compostos que indicam intenção operacional real:
//   "estado do contrato", "contrato ativo" — verificação de estado, não explicação conceitual.
// Adicionados (verbos imperativos operacionais):
//   "revise", "verifique", "cheque", "inspecione" — cobrem forma imperativa de inspeção.
// Adicionados (termos técnicos operacionais):
//   "runtime", "gate", "gates" — termos de infraestrutura usados em contexto técnico real.
// PR49: _CHAT_OPERATIONAL_INTENT_TERMS preservado para compatibilidade com
//   _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS e isOperationalMessageLegacy. isOperationalMessage
//   agora delega ao Classificador de Intenção v1 como fonte primária.
const _CHAT_OPERATIONAL_INTENT_TERMS = [
  "validar", "validação", "worker", "plano", "executor", "execução", "executar",
  "auditoria", "auditar", "deploy-worker", "deploy", "healthcheck", "health",
  "estado do contrato", "contrato ativo",
  "rota", "endpoint", "diagnóstico", "diagnosticar", "logs", "erro",
  "branch", "merge", "rollback", "patch", "revisar pr", "revisar a pr", "review pr",
  "revise", "verifique", "cheque", "inspecione",
  "runtime", "gate", "gates",
  "produção", "prod", "staging", "kv", "binding",
];
// PR49: isOperationalMessage agora usa o Classificador de Intenção v1 como fonte primária.
// Mantém fallback para _CHAT_OPERATIONAL_INTENT_TERMS para garantir retro-compatibilidade
// com qualquer termo coberto pela heurística legada que não esteja no classificador novo.
// A lógica antiga (isOperationalMessageLegacy) ainda existe em handleChatLLM para o
// legado de _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS — sem alteração de comportamento.
function isOperationalMessage(message, context) {
  if (typeof message !== "string" || message.length === 0) return false;
  // Fonte primária: Classificador de Intenção v1
  try {
    const classification = classifyEnaviaIntent({ message, context });
    if (classification && typeof classification.is_operational === "boolean") {
      // Se o classificador identificou is_operational=true, retornar true imediatamente.
      if (classification.is_operational) return true;
      // Se o classificador identificou a intenção (não unknown), confiar na decisão
      // não-operacional — não sobrescrever com legado. Isso garante que frustração,
      // next_pr, identity, capability e system_state retornem false corretamente.
      if (classification.intent !== "unknown") return false;
      // intent === "unknown": sem match no classificador — usar fallback legado.
    }
  } catch (_err) {
    // Se o classificador falhar por qualquer razão, cair no legado.
  }
  // Fallback legado: heurística de termos simples (PR36/PR38)
  const lower = message.toLowerCase();
  return _CHAT_OPERATIONAL_INTENT_TERMS.some((t) => lower.includes(t));
}
const _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS = [
  "validar", "sistema", "worker", "plano", "executor", "execução",
  "auditoria", "deploy-worker", "healthcheck", "auditar",
];

// ============================================================================
// 💬 CHAT LLM-FIRST — POST /chat/run
//
// Rota de conversa livre LLM-first para a aba Chat do painel.
// A superfície principal da conversa é o LLM — respostas naturais e livres.
// O planner estruturado (PM4→PM9) fica como ferramenta interna, acionado
// apenas quando o usuário pede explicitamente um plano ou quando a intenção
// detectada sugere estruturação.
//
// Payload esperado:
//   { message: string, session_id?: string, context?: object }
//
// Retorno:
//   { ok, system, reply, planner_used, planner?, timestamp, telemetry }
// ============================================================================
async function handleChatLLM(request, env) {
  const startedAt = Date.now();

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "JSON inválido em /chat/run.", detail: String(err) },
      400
    );
  }

  if (!body || typeof body !== "object") body = {};

  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonResponse(
      { ok: false, error: "'message' é obrigatório e deve ser string não vazia." },
      400
    );
  }

  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const context = body.context && typeof body.context === "object" ? body.context : {};
  // debug=true: expose full prompt structure in telemetry for diagnostic purposes.
  const debugMode = body.debug === true;

  // -------------------------------------------------------------------------
  // BLOCO B — Detecção determinística de aprovação e despacho ao executor
  //
  // Regras de segurança (sem LLM):
  //   - Só age se session_id existir e ENAVIA_BRAIN estiver disponível
  //   - Só age se mensagem contiver aprovação explícita (lista determinística)
  //   - Bloqueia silenciosamente se mensagem contiver termos perigosos
  //   - Só executa se houver pending_plan válido no KV para este session_id
  //   - Apaga pending_plan antes de despachar (previne dupla execução)
  //   - Retorna imediatamente — não passa pelo LLM
  // -------------------------------------------------------------------------
  if (session_id && env.ENAVIA_BRAIN) {
    const normalizedMsg = message.toLowerCase();
    const hasApproval = _CHAT_BRIDGE_APPROVAL_TERMS.some((t) => normalizedMsg.includes(t));
    const hasDangerousTerm = _CHAT_BRIDGE_DANGEROUS_TERMS.some((t) => normalizedMsg.includes(t));

    if (hasApproval && hasDangerousTerm) {
      logNV("🛡️ [CHAT/BRIDGE] Aprovação bloqueada por termo perigoso", {
        session_id,
        message: message.slice(0, 80),
      });
      // Fall through to normal LLM conversation — do not execute
    } else if (hasApproval) {
      const pendingKey = `chat:pending_plan:${session_id}`;
      let pendingPlan = null;
      try {
        pendingPlan = await env.ENAVIA_BRAIN.get(pendingKey, "json");
      } catch (kvErr) {
        logNV("⚠️ [CHAT/BRIDGE] Erro ao buscar pending_plan do KV", {
          session_id,
          error: String(kvErr),
        });
      }

      if (pendingPlan) {
        if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
          return jsonResponse({
            ok: false,
            system: "ENAVIA-NV-FIRST",
            mode: "llm-first",
            execution_dispatched: false,
            error: "EXECUTOR binding não disponível para executar plano aprovado.",
            timestamp: Date.now(),
            telemetry: { duration_ms: Date.now() - startedAt, session_id, pipeline: "chat_bridge_approval" },
          }, 503);
        }

        // Apagar pending_plan antes de despachar (previne dupla execução)
        try {
          await env.ENAVIA_BRAIN.delete(pendingKey);
        } catch { /* não crítico */ }

        const dispatchResult = await _dispatchFromChat(env, pendingPlan);

        return jsonResponse({
          ok: dispatchResult.ok,
          system: "ENAVIA-NV-FIRST",
          mode: "llm-first",
          execution_dispatched: true,
          bridge_id: dispatchResult.bridge_id,
          executor_ok: dispatchResult.executor_ok,
          ...(dispatchResult.executor_response ? { executor_response: dispatchResult.executor_response } : {}),
          ...(dispatchResult.error ? { executor_error: dispatchResult.error } : {}),
          reply: dispatchResult.ok
            ? "Plano aprovado. Execução foi despachada para o executor."
            : `Aprovação recebida, mas houve falha ao chamar o executor: ${dispatchResult.error || "erro desconhecido"}.`,
          plan_summary: pendingPlan.plan_summary || null,
          timestamp: Date.now(),
          telemetry: {
            duration_ms: Date.now() - startedAt,
            session_id,
            pipeline: "chat_bridge_approval",
          },
        });
      }

      // Sem pending_plan válido — seguir fluxo normal de conversa sem executar
      logNV("ℹ️ [CHAT/BRIDGE] Aprovação detectada mas sem pending_plan válido", { session_id });
    }
  }
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // PR5 — Conversation History (Memory + Continuity)
  //
  // Accepts an optional conversation_history array from the panel.
  // Each entry: { role: "user"|"assistant", content: string }
  //
  // Limits:
  //   - Max 20 messages (10 most recent exchanges)
  //   - Max 4000 characters total content (prevents context window overflow)
  //   - Only "user" and "assistant" roles accepted (no "system" injection)
  //   - Empty/invalid entries silently dropped
  //
  // The history is injected between the system prompt and the current user
  // message, giving the LLM real conversational context without KV persistence.
  // -------------------------------------------------------------------------
  const _PR5_MAX_HISTORY_MSGS = 20;
  const _PR5_MAX_HISTORY_CHARS = 4000;

  let conversationHistory = [];
  if (Array.isArray(body.conversation_history)) {
    const validRoles = new Set(["user", "assistant"]);
    let totalChars = 0;

    // Take the most recent entries (tail of array), validate, and budget chars
    const rawHistory = body.conversation_history.slice(-_PR5_MAX_HISTORY_MSGS);
    for (const entry of rawHistory) {
      if (!entry || typeof entry !== "object") continue;
      const role = typeof entry.role === "string" ? entry.role.trim() : "";
      const content = typeof entry.content === "string" ? entry.content.trim() : "";
      if (!validRoles.has(role) || !content) continue;
      if (totalChars + content.length > _PR5_MAX_HISTORY_CHARS) break;
      totalChars += content.length;
      conversationHistory.push({ role, content });
    }
  }

  // -------------------------------------------------------------------------
  // PR3 — Arbitration pre-check (deterministic, runs before LLM call)
  //
  // PM4 classifier (classifyRequest) is used as a deterministic gate on the
  // incoming message. This gives an auditable pre-signal that works regardless
  // of what the LLM decides via use_planner.
  //
  // Rule:
  //   Level A (simple / operational) → planner MUST NOT activate.
  //     Even if the LLM returns use_planner=true for a trivial message,
  //     the PM4 gate blocks it. Conversation wins.
  //   Level B (tactical) / C (complex/strategic) → planner MAY activate
  //     if and only if the LLM also requests it.
  //
  // This creates a two-signal gate:  LLM + PM4 must both agree for planner.
  // Either signal can veto activation.  PM4 veto prevents over-triggering on
  // simple conversation; LLM veto prevents under-triggering on nuanced intent.
  // -------------------------------------------------------------------------
  let pm4Arbitration = null;
  try {
    const pm4Classification = classifyRequest({ text: message, context });
    pm4Arbitration = {
      level:           pm4Classification.complexity_level,
      category:        pm4Classification.category,
      signals:         pm4Classification.signals,
      allows_planner:  pm4Classification.complexity_level !== "A",
    };
  } catch (pm4Err) {
    // PM4 failure is non-critical — fall through to LLM-only decision
    logNV("⚠️ [CHAT/LLM] PM4 pre-check falhou (não crítico)", { error: String(pm4Err) });
  }

  // Guard: API key must be configured — return 503 (not 500) with a clear message.
  if (!env.OPENAI_API_KEY) {
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        mode: "llm-first",
        error: "Serviço LLM indisponível: OPENAI_API_KEY não configurada no worker.",
        timestamp: Date.now(),
      },
      503
    );
  }

  // --- PR4: Operational Awareness ---
  // Computed before the try block so it's available in both success and error paths.
  // Pure and synchronous — getBrowserArmState() is in-memory, no I/O overhead.
  const operationalAwareness = buildOperationalAwareness(env, {
    browserArmState: getBrowserArmState(),
  });

  // --- Chat Bridge: operational override + shouldActivatePlanner (pre-LLM) ---
  //
  // Computed here — before the try block — so the decision is available even when
  // the LLM call fails, and so that the planner runs regardless of LLM outcome
  // when the message carries clear operational intent.
  //
  // PM4 decides as base authority. The operational override adds a deterministic
  // layer: if the message contains operational/mechanical intent terms AND no
  // dangerous terms, planner is forced even if PM4 returned Level A.
  // ---------------------------------------------------------------------------
  const _CHAT_BRIDGE_OPERATIONAL_TERMS = [
    "executar", "execução", "executor", "deploy-worker", "healthcheck",
    "auditar", "validar", "plano operacional", "preparar execução",
  ];
  const msgLower = message.toLowerCase();
  const pm4AllowsPlanner = pm4Arbitration ? pm4Arbitration.allows_planner : false;
  const hasOperationalIntent = _CHAT_BRIDGE_OPERATIONAL_TERMS.some((t) => msgLower.includes(t));
  // Dangerous term check for override uses word-boundary matching so that
  // compound service names like "deploy-worker" do not falsely match "deploy".
  // A term is dangerous only when it appears as a standalone word/phrase,
  // i.e. not immediately followed by a hyphen that would make it a compound name.
  const hasDangerousTermForOverride = _CHAT_BRIDGE_DANGEROUS_TERMS.some((t) => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
    return new RegExp(escaped + "(?![\\w-])", "i").test(msgLower);
  });
  const operationalOverride = hasOperationalIntent && !hasDangerousTermForOverride;
  const shouldActivatePlanner = pm4AllowsPlanner || operationalOverride;

  // --- Operational Context Detection (target + mensagem) ---
  // isOperationalContext: true quando context.target existe com campos relevantes OU
  // quando a mensagem menciona termos operacionais/sistêmicos.
  // Usado para: injetar target block no prompt, fortalecer instrução de memória e telemetria.
  const _chatTarget = context.target && typeof context.target === "object" ? context.target : null;
  const hasTarget = !!(_chatTarget && (_chatTarget.worker || _chatTarget.repo || _chatTarget.environment || _chatTarget.mode));
  // PR36: target sozinho NÃO ativa tom operacional. É apenas contexto técnico disponível.
  // isOperationalContext exige sinal real de intenção operacional na mensagem (ou termo operacional clássico).
  // Antes: const isOperationalContext = hasTarget || isOperationalMessage;
  // Agora: depende da intenção, não da mera presença de target default do painel.
  // PR49: Classificador de Intenção v1 rodado aqui para gerar intent_classification aditivo na resposta.
  let _intentClassification = null;
  try {
    _intentClassification = classifyEnaviaIntent({ message, context });
  } catch (_classifyErr) {
    _intentClassification = null;
  }
  // PR51: Skill Router read-only rodado aqui para gerar skill_routing aditivo na resposta.
  // Campo aditivo seguro — não quebra consumidor atual, não executa nada,
  // não cria endpoint, não aciona runtime. Somente referência documental.
  let _skillRouting = null;
  try {
    _skillRouting = routeEnaviaSkill({
      message,
      intentClassification: _intentClassification || undefined,
      context,
    });
  } catch (_routeErr) {
    _skillRouting = null;
  }
  // PR53: Intent Retrieval v1 — bloco documental compacto por intenção.
  // Fire-and-forget defensivo: erros não derrubam a conversa.
  // Determinístico, sem LLM, sem KV, sem rede, sem filesystem. Read-only.
  // Não executa skill. Não cria endpoint. Campo aditivo seguro.
  let _intentRetrieval = null;
  try {
    _intentRetrieval = buildIntentRetrievalContext({
      message,
      intentClassification: _intentClassification || undefined,
      skillRouting: _skillRouting || undefined,
      context,
    });
  } catch (_retrievalErr) {
    _intentRetrieval = null;
  }
  const isOperationalMessageLegacy = _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS.some((t) => msgLower.includes(t));
  const hasOperationalMessageIntent = isOperationalMessage(message, context);
  const isOperationalContext = hasOperationalMessageIntent || isOperationalMessageLegacy;
  const operationalDefaultsUsed = isOperationalContext
    ? [
        ...(_chatTarget?.mode === "read_only" ? ["read_only"] : []),
        "health_first", "no_deploy", "no_write", "approval_required",
      ]
    : [];
  const obviousQuestionsSuppressed = isOperationalContext && hasTarget;
  // PR56: Self-Audit read-only v1 — campo aditivo defensivo.
  // Rodado após intent classification, skill routing e intent retrieval.
  // Não altera resposta. Não bloqueia fluxo. Não chama LLM externo.
  // Não usa KV/rede/filesystem. Read-only. Falha com segurança.
  let _selfAudit = null;
  try {
    const _selfAuditResult = runEnaviaSelfAudit({
      message,
      context,
      intentClassification: _intentClassification || undefined,
      skillRouting:         _skillRouting         || undefined,
      intentRetrieval:      _intentRetrieval      || undefined,
      isOperationalContext,
    });
    _selfAudit = _selfAuditResult?.self_audit ?? null;
  } catch (_selfAuditErr) {
    _selfAudit = null;
  }

  // PR59: Response Policy viva v1 — campo aditivo defensivo.
  // Rodado após self_audit, usando todos os sinais do fluxo.
  // Orienta COMO responder: tom, sinceridade, estratégia, segurança.
  // Não altera reply. Não bloqueia fluxo programaticamente. Não chama LLM externo.
  // Não usa KV/rede/filesystem. Read-only. Falha com segurança.
  let _responsePolicy = null;
  try {
    _responsePolicy = buildEnaviaResponsePolicy({
      message,
      context,
      intentClassification: _intentClassification || undefined,
      skillRouting:         _skillRouting         || undefined,
      intentRetrieval:      _intentRetrieval      || undefined,
      selfAudit:            _selfAudit            || undefined,
      isOperationalContext,
    });
  } catch (_responsePolicyErr) {
    _responsePolicy = null;
  }

  // PR69: Skill Execution Proposal v1 — proposal-only, read-only, sem side effects.
  // Campo aditivo seguro: não executa skill, não altera reply/use_planner,
  // não cria endpoint e aplica deny-by-default com bloqueio por Self-Audit.
  let _skillExecution = null;
  try {
    _skillExecution = buildSkillExecutionProposal({
      skillRouting:         _skillRouting         || undefined,
      intentClassification: _intentClassification || undefined,
      selfAudit:            _selfAudit            || undefined,
      responsePolicy:       _responsePolicy       || undefined,
      chatContext:          context               || undefined,
    });
  } catch (_skillExecutionErr) {
    _skillExecution = null;
  }
  let _chatSkillSurface = null;
  try {
    _chatSkillSurface = buildChatSkillSurface({
      skillExecution: _skillExecution?.skill_execution,
    });
  } catch (_chatSkillSurfaceErr) {
    _chatSkillSurface = null;
  }

  try {
    // --- PR3: Memory Retrieval Pipeline (antes da resposta LLM) ---
    // Leitura de memória estruturada com separação explícita de blocos.
    // Fire-and-forget defensivo: erros não derrubam a conversa.
    let chatRetrievalResult = { ok: false, error: "retrieval skipped: ENAVIA_BRAIN binding not available" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        chatRetrievalResult = await buildRetrievalContext(context, env);
      } catch (retErr) {
        chatRetrievalResult = { ok: false, error: String(retErr) };
      }
    }
    const chatRetrievalSummary = buildRetrievalSummary(chatRetrievalResult);

    // --- System prompt LLM-first conversacional (PR2) ---
    // Montagem dinâmica via buildChatSystemPrompt: usa a base cognitiva da PR1
    // (identidade, capacidades, constituição) de forma viva, com tom conversacional
    // e contexto dinâmico da sessão. O contrato JSON {reply, use_planner} é mantido
    // como envelope estrutural, sem sufocar a fala natural.
    const ownerName = env.OWNER || "usuário";

    // --- Núcleo Cognitivo Runtime (PR1+PR2+PR4+PR53+PR59) ---
    // System prompt completo: base institucional + tom conversacional + contexto dinâmico
    // + awareness operacional real (PR4) + intent retrieval context (PR53)
    // + response policy viva (PR59)
    const chatSystemPrompt = buildChatSystemPrompt({
      ownerName,
      context,
      operational_awareness: operationalAwareness,
      is_operational_context: isOperationalContext,
      intent_retrieval_context: _intentRetrieval || undefined,
      response_policy: _responsePolicy || undefined,
    });

    // --- PR5: Inject conversation history between system and current message ---
    // This gives the LLM real context of the ongoing conversation.
    // conversationHistory is pre-validated and budget-limited above.

    // --- PR3: Build memory context block for LLM (if retrieval produced results) ---
    // Injected as a system message between system prompt and conversation history.
    // Validated learning and manual instructions: title + full content text injected.
    // Historical memory reference-only: title + short summary (if present).
    // Historical memory non-reference: title + content text.
    const _pr3MemoryBlock = [];
    if (chatRetrievalSummary.applied && chatRetrievalSummary.total_memories_read > 0) {
      // Use full objects from chatRetrievalResult.blocks so content_structured is available.
      const _blocks = chatRetrievalResult.ok && chatRetrievalResult.blocks
        ? chatRetrievalResult.blocks
        : null;

      // Helper: bullet line for one memory item.
      // suffix appended to the title line; contentField read from content_structured.
      const _memLine = (item, contentField, suffix = "") => {
        const txt = item.content_structured?.[contentField];
        return `  • ${item.title} (${item.memory_type})${suffix}${txt ? `\n    → ${txt}` : ""}`;
      };

      const parts = [];

      // Validated learning: include full content text
      const _vlItems = _blocks
        ? _blocks.validated_learning.items
        : chatRetrievalSummary.validated_learning.items;
      if (_vlItems.length > 0) {
        parts.push(`[APRENDIZADO VALIDADO — ${_vlItems.length} item(s)]`);
        for (const item of _vlItems) parts.push(_memLine(item, "text"));
      }

      // Manual instructions: include full content text
      const _miItems = _blocks
        ? _blocks.manual_instructions.items
        : chatRetrievalSummary.manual_instructions.items;
      if (_miItems.length > 0) {
        parts.push(`[INSTRUÇÕES MANUAIS — ${_miItems.length} item(s)]`);
        for (const item of _miItems) parts.push(_memLine(item, "text"));
      }

      // Historical memory: reference-only → title + summary; non-reference → title + content text
      const _hmItems = _blocks
        ? _blocks.historical_memory.items
        : chatRetrievalSummary.historical_memory.items;
      const _hmRefCount = _blocks
        ? _blocks.historical_memory.reference_only_count
        : chatRetrievalSummary.historical_memory.reference_only_count;
      if (_hmItems.length > 0) {
        parts.push(`[MEMÓRIA HISTÓRICA — ${_hmItems.length} item(s), ${_hmRefCount} referência apenas]`);
        for (const item of _hmItems) {
          const isRef = item._pr3_is_reference ?? item.is_reference ?? false;
          parts.push(isRef
            ? _memLine(item, "summary", " (REFERÊNCIA HISTÓRICA — não usar como verdade)")
            : _memLine(item, "text"),
          );
        }
      }

      if (parts.length > 0) {
        const memBlockContent = isOperationalContext
          ? [
              "MEMÓRIA RECUPERADA (PR3) — MODO OPERACIONAL:",
              "Estas memórias são regras operacionais ativas para esta resposta.",
              "Instruções manuais e aprendizado validado têm peso de regra preferencial — aplique-as diretamente para influenciar sua resposta e decisão.",
              "Nunca apenas liste ou explique as memórias: use-as para agir.",
              "Só ignore uma memória se ela for claramente irrelevante para a intenção atual.",
              "Itens marcados como REFERÊNCIA HISTÓRICA são apenas auxiliares.",
              ...parts,
            ].join("\n")
          : [
              "MEMÓRIA RECUPERADA (PR3):",
              "Regra: contexto atual prevalece sobre memória antiga. Itens marcados como REFERÊNCIA HISTÓRICA são apenas auxiliares.",
              ...parts,
            ].join("\n");
        _pr3MemoryBlock.push({ role: "system", content: memBlockContent });
      }
    }

    // --- Operational Context Override Block ---
    // When target is present, inject a dedicated system message immediately
    // before the user message. This high-recency instruction overrides the
    // generic "short reply" rule (section 6 of chatSystemPrompt) for operational
    // queries, anchoring the LLM to the real target and active memory rules.
    //
    // The PRIORIDADE DE DECISÃO section here is intentionally complementary to
    // section 7b in buildChatSystemPrompt (enavia-cognitive-runtime.js): the base
    // prompt establishes the general principle (always active), while this block
    // is the high-recency last-instruction injected immediately before the user
    // message and is only active when hasTarget=true. Both are needed: the base
    // prompt sets behaviour for all contexts; this block is the authoritative anchor
    // for the specific operational turn.
    const _operationalContextBlock = [];
    // PR36: bloco operacional pesado só quando intenção operacional real foi detectada.
    // Antes: ativava por hasTarget sozinho (target default do painel ativava para qualquer "oi").
    if (hasTarget && isOperationalContext) {
      const _tgt = _chatTarget;
      const targetDesc = [
        _tgt.worker      ? `worker: ${_tgt.worker}`           : null,
        _tgt.repo        ? `repo: ${_tgt.repo}`               : null,
        _tgt.branch      ? `branch: ${_tgt.branch}`           : null,
        _tgt.environment ? `environment: ${_tgt.environment}` : null,
        _tgt.mode        ? `mode: ${_tgt.mode}`               : null,
      ].filter(Boolean).join(" | ");

      const memActive = chatRetrievalSummary.applied && chatRetrievalSummary.total_memories_read > 0;
      const memNote = memActive
        ? `\nMEMÓRIA ATIVA (${chatRetrievalSummary.total_memories_read} item(s)): instrução manual e aprendizado validado aplicam-se como regra operacional. Siga preferências de read_only, aprovação e segurança se presentes.`
        : "";

      const readOnlyNote = _tgt.mode === "read_only"
        ? "\nModo atual: read_only. Ações com efeito colateral (deploy, patch, merge, push, escrita) estão bloqueadas sem aprovação/contrato. Isto é gate de execução, não regra de tom: você continua livre para conversar, opinar, sugerir, discordar, explicar e planejar."
        : "";

      _operationalContextBlock.push({
        role: "system",
        content: `INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA:\n` +
          `Alvo ativo confirmado: ${targetDesc}.\n` +
          `O operador fez uma pergunta operacional. Você CONHECE o alvo acima — não pergunte qual sistema, worker ou ambiente.\n` +
          `\nFORMATO OBRIGATÓRIO PARA RESPOSTA OPERACIONAL:\n` +
          `Resposta deve ser OBJETIVA, PRÁTICA e ACIONÁVEL — não um artigo ou explicação longa.\n` +
          `• Comece diretamente com a ação recomendada — sem introdução longa.\n` +
          `• Use até 7 passos numerados. Cada passo começa com verbo de ação (ex: "testar", "verificar", "conferir").\n` +
          `• Finalize com uma próxima ação clara e objetiva (ex: "Próximo passo: posso montar os comandos para esse teste.").\n` +
          `• Se precisar perguntar algo, pergunte no máximo 1 coisa bloqueante — nunca perguntas genéricas de contexto.\n` +
          `• Sem markdown headers (##, ###). Sem "Fase 1/2/3". Sem categorias conceituais desnecessárias.\n` +
          `\nRESOLUÇÃO DE AMBIGUIDADE — REGRA OBRIGATÓRIA:\n` +
          `Quando o operador usar termos genéricos como "o sistema", "o worker", "o ambiente" ou "o projeto" e houver target ativo, resolva imediatamente para o target confirmado acima.\n` +
          `NÃO pergunte "você quer dizer nv-enavia ou outro sistema?" — a resposta é sempre o target ativo.\n` +
          `Se quiser confirmar, use: "Vou assumir o target atual (${_tgt.worker || _tgt.repo || "target ativo"}); me corrija se quiser outro alvo."\n` +
          `\nPRIORIDADE DE DECISÃO — siga esta ordem antes de responder:\n` +
          `1. Interprete a intenção do operador.\n` +
          `2. Cruze com o contexto operacional (alvo acima).\n` +
          `3. Cruze com as memórias recuperadas (se presentes): trate-as como instruções ou preferências ativas, não como informação descritiva.\n` +
          `4. Só pergunte algo se faltar informação ESSENCIAL para executar a ação — nunca para entender o contexto (que já foi fornecido).\n` +
          `Evite perguntas genéricas quando o contexto ou a memória já fornecem a base necessária.` +
          readOnlyNote +
          memNote,
      });
    }

    const llmMessages = [
      { role: "system", content: chatSystemPrompt },
      ..._pr3MemoryBlock,
      ...conversationHistory,
      ..._operationalContextBlock,
      { role: "user", content: message },
    ];

    // --- Chamada LLM com resposta estruturada ---
    // Max tokens raised to 1600 for richer conversational replies.
    // response_format is intentionally omitted: not all model versions (including
    // gpt-5.x) accept the json_object parameter. The system prompt already mandates
    // JSON output, and the JSON.parse block below falls back gracefully to plain text.
    const CHAT_LLM_MAX_TOKENS = 1600;
    const llmResult = await callChatModel(env, llmMessages, {
      // Temperature 0.6 (up from 0.5): slightly more creative for natural conversation
      // while still constrained enough for coherent, on-topic replies.
      temperature: 0.6,
      max_tokens: CHAT_LLM_MAX_TOKENS,
    });

    // PR36: telemetria mínima de sanitização/fallback.
    // Sempre que o runtime substituir uma resposta por fallback ou sanitizer,
    // registramos qual camada agiu — sem expor o conteúdo original ao operador.
    const _sanitization = { applied: false, layer: null, reason: null };

    // Parse the structured response — fall back gracefully if the model returns
    // plain text (e.g. older model versions that ignore response_format).
    let reply = "";
    let wantsPlan = false;
    // PR7: Track whether the LLM returned parseable JSON or plain text.
    // "json_parsed" → structured JSON received; "plain_text_fallback" → model returned raw text,
    // meaning use_planner signal is absent and planner decision falls entirely to PM4.
    let llmParseMode = _LLM_PARSE_MODE.UNKNOWN;
    try {
      const parsed = JSON.parse(llmResult.text);
      reply = typeof parsed.reply === "string" && parsed.reply.length > 0
        ? parsed.reply
        : llmResult.text;
      wantsPlan = parsed.use_planner === true;
      llmParseMode = _LLM_PARSE_MODE.JSON_PARSED;
    } catch {
      // Model returned plain text — use as-is, no planner
      const _rawText = llmResult.text;
      if (!_rawText || _rawText.length === 0) {
        reply = "Instrução recebida.";
        // PR36: registra que o fallback plain-text foi acionado por reply vazio
        _sanitization.applied = true;
        _sanitization.layer = "plain_text_fallback";
        _sanitization.reason = "llm_empty_text";
      } else {
        reply = _rawText;
      }
      wantsPlan = false;
      llmParseMode = _LLM_PARSE_MODE.PLAIN_TEXT_FALLBACK;
    }

    // --- PR3: Tool Arbitration — Sanitização de reply ---
    // Garante que o reply nunca exponha termos mecânicos do planner como fala
    // principal. Se a resposta contiver termos internos do planner como
    // superfície dominante, é sinal de leak — o reply é sanitizado.
    // PR7: Track layer-1 sanitization (mechanical term leak) separately from layer-2 (manual plan).
    const replyBeforeSanitize = reply;
    reply = _sanitizeChatReply(reply);
    const replyLayer1Sanitized = reply !== replyBeforeSanitize;
    if (replyLayer1Sanitized) {
      // PR36: telemetria — planner_terms layer agiu
      _sanitization.applied = true;
      _sanitization.layer = "planner_terms";
      _sanitization.reason = "planner_leak_detected";
      logNV("🛡️ [CHAT/LLM] Layer-1 sanitizer aplicado (planner_terms)", { session_id });
    }

    // --- PR3: Arbitration Gate — PM4 é autoritativo ---
    //
    // PM4 decides planner activation unilaterally:
    //   Level A (simple/operational) → planner BLOCKED always. Conversation wins.
    //     Even if LLM signals use_planner=true, Level A blocks it.
    //   Level B/C (tactical/strategic) → planner FORCED always.
    //     Even if LLM signals use_planner=false, Level B/C forces it.
    //
    // The LLM's use_planner signal is now advisory only — it's recorded in the
    // arbitration audit trail but does NOT control planner activation.
    //
    // Rationale: In TEST, the LLM bypassed the gate by returning use_planner=false
    // while generating a full structured plan in reply. PM4 as sole authority
    // closes this gap: if the message is B/C, planner always runs internally,
    // and the reply must remain conversational (enforced by _isManualPlanReply).
    // (shouldActivatePlanner, pm4AllowsPlanner, operationalOverride computed pre-LLM above)

    // Auditoria da decisão de arbitration — provável sem LLM real
    const arbitrationDecision = {
      pm4_level:            pm4Arbitration?.level        || null,
      pm4_category:         pm4Arbitration?.category     || null,
      pm4_signals:          pm4Arbitration?.signals      || [],
      pm4_allows_planner:   pm4AllowsPlanner,
      llm_requested_planner: wantsPlan,
      ...(operationalOverride ? { operational_override: true } : {}),
      // final_decision reflects PM4-only authority (or operational override):
      //   "planner_activated"              → LLM requested + PM4 level B/C (coherent)
      //   "planner_forced_level_BC"        → PM4 level B/C but LLM didn't request it
      //   "planner_forced_operational"     → PM4 level A overridden by operational term
      //   "planner_blocked_level_A"        → PM4 level A (blocks even if LLM wanted it)
      final_decision: shouldActivatePlanner
        ? (operationalOverride && !pm4AllowsPlanner
            ? "planner_forced_operational"
            : (wantsPlan ? "planner_activated" : "planner_forced_level_BC"))
        : "planner_blocked_level_A",
    };

    logNV("🗣️ [CHAT/LLM] LLM respondeu", {
      use_planner: wantsPlan,
      pm4_allows: pm4AllowsPlanner,
      final: arbitrationDecision.final_decision,
      session_id,
    });

    // --- Planner como ferramenta interna (PM4 autoritativo) ---
    let plannerSnapshot = null;
    let plannerUsed = false;
    // PR7: Track planner failure when it was supposed to run (Level B/C forced)
    let plannerError = null;
    let pendingPlanSaved = false;
    // P-BRIEF: debug trace — objective resolution for /chat/run path
    let _chatPlannerDebug = null;

    if (shouldActivatePlanner) {
      try {
        // P-BRIEF — Resolução do objetivo no chat planner via helper canônico.
        // operator_intent vence sobre body.message para PM4/PM5/PM6.
        const {
          resolvedText: chatResolvedText,
          objectiveSource: chatObjectiveSource,
          hasPlannerBrief: chatHasPlannerBrief,
        } = _resolveOperatorIntent(context, message);
        const classification = classifyRequest({ text: chatResolvedText, context });
        const envelope = buildOutputEnvelope(classification, { text: chatResolvedText });
        const canonicalPlan = buildCanonicalPlan({
          classification,
          envelope,
          input: { text: chatResolvedText },
          planner_brief: context?.planner_brief ?? null,
        });
        const gate = evaluateApprovalGate(canonicalPlan);
        const bridge = buildExecutorBridgePayload({ plan: canonicalPlan, gate });
        const memoryConsolidation = consolidateMemoryLearning({
          plan: canonicalPlan,
          gate,
          bridge,
        });

        plannerSnapshot = {
          classification,
          canonicalPlan,
          gate,
          bridge,
          memoryConsolidation,
          outputMode: envelope.output_mode,
        };
        plannerUsed = true;

        // P-BRIEF: populate debug trace after canonicalPlan is available
        _chatPlannerDebug = {
          fix_active: "P-BRIEF-v2", // sentinel: confirms this /chat/run handler has the P-BRIEF fix
          received_message: message,
          has_planner_brief: chatHasPlannerBrief,
          // always shows raw value received; null means absent; use with objective_source to diagnose fallbacks
          planner_brief_operator_intent: context?.planner_brief?.operator_intent != null
            ? String(context.planner_brief.operator_intent).slice(0, 120)
            : null,
          resolved_text_used_for_pm: chatResolvedText.slice(0, 120),
          objective_source: chatObjectiveSource,
          canonical_plan_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
          pending_plan_saved: false, // updated below if plan is saved
        };

        // ---------------------------------------------------------------
        // BLOCO A.0 — Espelhar plannerSnapshot em planner:latest:{session_id}
        //
        // Objetivo: tornar a aba Plan backend-driven. Sem esta escrita, planos
        // gerados via /chat/run não aparecem em GET /planner/latest e a aba
        // Plan mostra "Nenhum plano ativo" após reload ou em outra aba.
        //
        // Espelha o padrão já utilizado por /planner/run (sem TTL).
        // Fire-and-forget, não crítico — não bloqueia resposta ao usuário.
        // ---------------------------------------------------------------
        if (session_id && env?.ENAVIA_BRAIN) {
          try {
            await env.ENAVIA_BRAIN.put(
              `planner:latest:${session_id}`,
              JSON.stringify(plannerSnapshot),
            );
            logNV("💾 [CHAT/LLM] planner:latest atualizado no KV", { session_id });
          } catch (kvErr) {
            logNV("⚠️ [CHAT/LLM] Falha ao persistir planner:latest (não crítico)", {
              session_id,
              error: String(kvErr),
            });
          }
        }

        // ---------------------------------------------------------------
        // BLOCO A — Salvar pending_plan no KV quando gate exige aprovação
        //           OU quando há intenção operacional/mecânica segura.
        //
        // Condições:
        //   - session_id existe
        //   - gate exige aprovação humana  OR planner foi ativado por
        //     intenção operacional/mecânica determinística (operationalOverride)
        //   - outputMode não é formal_contract (Level C)
        //   - KV disponível
        //
        // Razão do alargamento: mensagens Level B (tactical) têm
        // needs_human_approval=false mesmo com intenção operacional explícita.
        // O operationalOverride já garante: termos operacionais presentes
        // E sem termos perigosos — é seguro salvar pending_plan.
        //
        // O executor_payload é construído diretamente do canonicalPlan
        // porque bridge.executor_payload é null quando gate bloqueia.
        // TTL: 600 segundos.
        // ---------------------------------------------------------------
        if (
          session_id &&
          !hasDangerousTermForOverride &&
          (gate.needs_human_approval === true || !gate.can_proceed || operationalOverride) &&
          plannerSnapshot.outputMode !== "formal_contract" &&
          env.ENAVIA_BRAIN
        ) {
          const pendingKey = `chat:pending_plan:${session_id}`;
          const now = Date.now();
          // Build executor_payload from canonicalPlan (same shape as _buildExecutorPayload in PM8)
          const builtExecutorPayload = {
            version: "1.0",
            source: "planner_bridge",
            plan_summary: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : "",
            complexity_level: canonicalPlan.complexity_level,
            plan_type: canonicalPlan.plan_type,
            steps: Array.isArray(canonicalPlan.steps) ? canonicalPlan.steps : [],
            risks: Array.isArray(canonicalPlan.risks) ? canonicalPlan.risks : [],
            acceptance_criteria: Array.isArray(canonicalPlan.acceptance_criteria) ? canonicalPlan.acceptance_criteria : [],
          };
          const pendingBridgeId = safeId("bridge");
          const pendingValue = {
            session_id,
            bridge_id: pendingBridgeId,
            bridge_executor_payload: builtExecutorPayload,
            plan_summary: builtExecutorPayload.plan_summary,
            gate_status: gate.gate_status,
            created_at: new Date(now).toISOString(),
            expires_at: new Date(now + _PENDING_PLAN_TTL_SECONDS * 1000).toISOString(),
            source: "chat_run",
          };
          try {
            await env.ENAVIA_BRAIN.put(pendingKey, JSON.stringify(pendingValue), {
              expirationTtl: _PENDING_PLAN_TTL_SECONDS,
            });
            pendingPlanSaved = true;
            if (_chatPlannerDebug) _chatPlannerDebug.pending_plan_saved = true;
            logNV("💾 [CHAT/LLM] pending_plan salvo no KV", {
              session_id,
              gate_status: gate.gate_status,
              bridge_id: pendingBridgeId,
            });
          } catch (kvErr) {
            logNV("⚠️ [CHAT/LLM] Falha ao salvar pending_plan (não crítico)", {
              session_id,
              error: String(kvErr),
            });
          }
        }

        logNV("🔧 [CHAT/LLM] Planner acionado como ferramenta interna", {
          session_id,
          level: classification.complexity_level,
        });
      } catch (planErr) {
        plannerError = String(planErr);
        logNV("⚠️ [CHAT/LLM] Planner falhou como tool (não crítico)", {
          error: plannerError,
        });
        // Planner failure is non-critical — the LLM reply is still valid
      }
    }

    // --- PR3: Manual plan leak guard ---
    // When PM4 forced planner (Level B/C), the LLM may still have written a
    // full structured plan inline in reply (Fase 1, Etapa 2, ## headers, etc.)
    // instead of a natural conversational reply. This is a "manual plan leak":
    // the plan structure belongs inside plannerSnapshot, not on the reply surface.
    // Replace with a natural acknowledgement that preserves conversational surface.
    if (shouldActivatePlanner && _isManualPlanReply(reply)) {
      reply = _MANUAL_PLAN_FALLBACK;
      arbitrationDecision.reply_sanitized = "manual_plan_replaced";
      // PR36: telemetria
      _sanitization.applied = true;
      _sanitization.layer = "manual_plan";
      _sanitization.reason = "manual_plan_leak_detected";
      logNV("🛡️ [CHAT/LLM] Manual plan leak detectado no reply — sanitizado", { session_id });
    }

    // Derive top-level memory telemetry from retrieval summary.
    // memory_applied: true when retrieval ran and found ≥1 active memory.
    // memory_hits: flat list of all memories that entered the LLM context block,
    //   including their block classification and reference status.
    const _chatMemApplied = chatRetrievalSummary.applied === true && chatRetrievalSummary.total_memories_read > 0;
    const _chatMemHits = _chatMemApplied
      ? [
          ...chatRetrievalSummary.validated_learning.items.map((m) => ({
            id: m.memory_id, title: m.title, type: m.memory_type, block: "validated_learning", is_reference: false,
          })),
          ...chatRetrievalSummary.manual_instructions.items.map((m) => ({
            id: m.memory_id, title: m.title, type: m.memory_type, block: "manual_instructions", is_reference: false,
          })),
          ...chatRetrievalSummary.historical_memory.items.map((m) => ({
            id: m.memory_id, title: m.title, type: m.memory_type, block: "historical_memory", is_reference: m.is_reference || false,
          })),
        ]
      : [];

    // --- Diagnostic telemetry: target and memory observability ---
    const _targetFieldsSeen = hasTarget
      ? Object.entries(_chatTarget).filter(([, v]) => v != null && v !== "").map(([k]) => k)
      : [];
    const _memoryContentInjected = _pr3MemoryBlock.length > 0;
    const _memoryHitsCount = _chatMemHits.length;

    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      mode: "llm-first",
      reply,
      planner_used: plannerUsed,
      memory_applied: _chatMemApplied,
      memory_hits: _chatMemHits,
      operational_context_applied: isOperationalContext,
      // PR36: telemetria mínima de sanitização/fallback (campo aditivo, não-quebrante).
      sanitization: _sanitization,
      // PR49: classificação de intenção v1 (campo aditivo, não-quebrante, somente se disponível).
      // `signals` é excluído propositalmente do response API — é campo de debugging interno
      // com detalhes de termos casados que não agrega valor para o consumidor externo e
      // pode expor detalhes de implementação do classificador desnecessariamente.
      ...(_intentClassification ? { intent_classification: {
        intent: _intentClassification.intent,
        confidence: _intentClassification.confidence,
        is_operational: _intentClassification.is_operational,
        reasons: _intentClassification.reasons,
      }} : {}),
      // PR51: Skill Router read-only v1 (campo aditivo, não-quebrante, somente se disponível).
      // Indica qual skill documental foi selecionada para esta mensagem. Nunca executa skill.
      // /skills/run não existe. mode sempre "read_only".
      ...(_skillRouting ? { skill_routing: {
        matched: _skillRouting.matched,
        skill_id: _skillRouting.skill_id,
        skill_name: _skillRouting.skill_name,
        mode: _skillRouting.mode,
        confidence: _skillRouting.confidence,
        reason: _skillRouting.reason,
        sources: _skillRouting.sources,
        warning: _skillRouting.warning,
      }} : {}),
      // PR53: Intent Retrieval v1 (campo aditivo seguro, não-quebrante).
      // Indica qual bloco documental foi recuperado por intenção. Read-only.
      // Não inclui context_block inteiro no response — apenas metadados.
      ...(_intentRetrieval ? { intent_retrieval: {
        applied: _intentRetrieval.applied,
        mode: _intentRetrieval.mode,
        intent: _intentRetrieval.intent,
        skill_id: _intentRetrieval.skill_id,
        sources: _intentRetrieval.sources,
        token_budget_hint: _intentRetrieval.token_budget_hint,
        warnings: _intentRetrieval.warnings,
      }} : {}),
      ...(plannerSnapshot ? { planner: plannerSnapshot } : {}),
      ...(pendingPlanSaved ? { pending_plan_saved: true, pending_plan_expires_in: _PENDING_PLAN_TTL_SECONDS } : {}),
      // PR56: Self-Audit read-only v1 (campo aditivo seguro, não-quebrante).
      // Indica achados de risco, alertas e próxima ação segura. Read-only.
      // Não altera reply. Não bloqueia fluxo automaticamente. Não chama LLM externo.
      ...(_selfAudit ? { self_audit: _selfAudit } : {}),
      // PR59: Response Policy viva v1 (campo aditivo seguro, não-quebrante).
      // Orienta tom e estrutura da resposta. Read-only. Não altera reply.
      // Não bloqueia fluxo programaticamente. Não chama LLM externo.
      // policy_block inteiro NÃO é exposto — apenas metadados seguros.
      ...(_responsePolicy ? { response_policy: {
        applied:               _responsePolicy.applied,
        mode:                  _responsePolicy.mode,
        response_style:        _responsePolicy.response_style,
        should_adjust_tone:    _responsePolicy.should_adjust_tone,
        should_warn:           _responsePolicy.should_warn,
        should_refuse_or_pause: _responsePolicy.should_refuse_or_pause,
        warnings:              _responsePolicy.warnings,
        reasons:               _responsePolicy.reasons,
      }} : {}),
      // PR69: Skill Execution Proposal v1 (campo aditivo, proposal-only).
      // Não executa skill. Não altera reply/use_planner. Sem side effects.
      ...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {}),
      // PR77: superfície controlada de proposta no chat (metadata-only).
      // Não executa skill. Não altera reply/use_planner.
      ...(_chatSkillSurface ? { chat_skill_surface: _chatSkillSurface } : {}),
      timestamp: Date.now(),
      input: message,
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: plannerUsed ? "PR3 + LLM + PM4→PM9" : "PR3 + LLM-only",
        operational_defaults_used: operationalDefaultsUsed,
        obvious_questions_suppressed: obviousQuestionsSuppressed,
        target_seen: hasTarget,
        target_fields_seen: _targetFieldsSeen,
        memory_content_injected: _memoryContentInjected,
        memory_hits_count: _memoryHitsCount,
        ...(hasTarget ? { operational_output_mode: "actionable_compact" } : {}),
        // PR3: retrieval context summary (separação de blocos explícita)
        retrieval: chatRetrievalSummary,
        // PR7: explicit continuity flag — true when conversation history was injected into LLM context
        continuity_active: conversationHistory.length > 0,
        conversation_history_length: conversationHistory.length,
        // PR7: whether the LLM returned parseable JSON (json_parsed) or plain text (plain_text_fallback)
        llm_parse_mode: llmParseMode,
        arbitration: (() => {
          const arb = { ...arbitrationDecision };
          // PR7: track layer-1 sanitization (mechanical term leak) separately from layer-2 (manual plan)
          if (replyLayer1Sanitized) arb.reply_sanitized_layer1 = "mechanical_term_leak_replaced";
          return arb;
        })(),
        // PR7: gate decision summary — surfaced here for quick observability without parsing planner object
        ...(plannerSnapshot?.gate ? {
          gate_summary: {
            gate_status:         plannerSnapshot.gate.gate_status,
            needs_human_approval: plannerSnapshot.gate.needs_human_approval,
            can_proceed:         plannerSnapshot.gate.can_proceed,
          },
        } : {}),
        // PR7: planner error when planner was forced (Level B/C) but failed internally
        ...(plannerError ? { planner_error: plannerError } : {}),
        // P-BRIEF: planner debug — objective resolution trace for this /chat/run request
        ...(plannerUsed && _chatPlannerDebug ? { planner_debug: _chatPlannerDebug } : {}),
        operational_awareness: {
          browser_status:    operationalAwareness.browser.status,
          browser_can_act:   operationalAwareness.browser.can_act,
          executor_configured: operationalAwareness.executor.configured,
          approval_mode:     operationalAwareness.approval.mode,
          human_gate_active: operationalAwareness.approval.human_gate_active,
        },
        // prompt_debug: only present when body.debug===true — exposes full LLM message structure
        ...(debugMode ? {
          prompt_debug: (() => {
            const roles = llmMessages.map((m) => m.role);
            const systemMsgs = llmMessages.filter((m) => m.role === "system");
            const opBlockIndex = llmMessages.findIndex(
              (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("INSTRUÇÃO OPERACIONAL PARA ESTA RESPOSTA")
            );
            const memBlockIndex = llmMessages.findIndex(
              (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("MEMÓRIA RECUPERADA")
            );
            const userMsg = llmMessages.find((m) => m.role === "user");
            const opBlock = opBlockIndex >= 0 ? llmMessages[opBlockIndex] : null;
            const memBlock = memBlockIndex >= 0 ? llmMessages[memBlockIndex] : null;
            const baseSystemMsg = llmMessages[0];
            return {
              llm_messages_count: llmMessages.length,
              llm_messages_roles: roles,
              context_target_received: hasTarget,
              target_seen: hasTarget,
              target_fields_seen: _targetFieldsSeen,
              has_operational_context_block: opBlockIndex >= 0,
              operational_block_index: opBlockIndex >= 0 ? opBlockIndex : null,
              operational_block_preview: opBlock ? String(opBlock.content).slice(0, 600) : null,
              has_resolution_ambiguity_block: opBlock
                ? String(opBlock.content).includes("RESOLUÇÃO DE AMBIGUIDADE")
                : false,
              has_target_in_final_prompt: roles.some((r) => r === "system") &&
                llmMessages.some((m) => typeof m.content === "string" && m.content.includes("ALVO OPERACIONAL ATIVO")),
              has_memory_block: memBlockIndex >= 0,
              memory_block_preview: memBlock ? String(memBlock.content).slice(0, 400) : null,
              system_messages_preview: systemMsgs.map((m) => ({
                index: llmMessages.indexOf(m),
                preview: String(m.content).slice(0, 300),
              })),
              user_message_final: userMsg ? String(userMsg.content).slice(0, 300) : null,
              base_system_has_section_5c: baseSystemMsg
                ? String(baseSystemMsg.content).includes("ALVO OPERACIONAL ATIVO")
                : false,
            };
          })(),
        } : {}),
      },
    });
  } catch (err) {
    // PR8: Classify the error type for clear, actionable error messages and
    // appropriate HTTP status codes. Operators can distinguish timeout from
    // rate limit from generic model failure without reading raw stack traces.
    const errStr = String(err);
    let httpStatus = 500;
    let errorCode = "LLM_ERROR";
    let errorMsg = "Falha na conversa LLM-first.";

    if (errStr.includes("[TIMEOUT]") || err?.name === "AbortError") {
      httpStatus = 504;
      errorCode = "LLM_TIMEOUT";
      errorMsg = `Timeout na chamada ao modelo LLM (>${_LLM_CALL_TIMEOUT_MS / 1000}s). Tente novamente.`;
    } else if (errStr.includes("[HTTP_429]") || errStr.toLowerCase().includes("rate limit")) {
      httpStatus = 503;
      errorCode = "LLM_RATE_LIMIT";
      errorMsg = "Serviço LLM temporariamente indisponível: limite de requisições atingido. Tente novamente em alguns instantes.";
    } else if (errStr.includes("[HTTP_5") || errStr.includes("[HTTP_503]") || errStr.includes("[HTTP_502]")) {
      httpStatus = 503;
      errorCode = "LLM_UNAVAILABLE";
      errorMsg = "Serviço LLM temporariamente indisponível. Tente novamente em alguns instantes.";
    } else if (errStr.includes("[NETWORK]")) {
      httpStatus = 503;
      errorCode = "LLM_NETWORK_ERROR";
      errorMsg = "Falha de rede ao chamar o serviço LLM. Verifique conectividade e tente novamente.";
    } else if (errStr.includes("[EMPTY_RESPONSE]") || errStr.includes("[EMPTY_CONTENT]")) {
      httpStatus = 502;
      errorCode = "LLM_EMPTY_RESPONSE";
      errorMsg = "Modelo LLM retornou resposta vazia ou sem conteúdo utilizável. Possível filtro de conteúdo ou falha no modelo.";
    } else if (errStr.includes("[INVALID_JSON]")) {
      httpStatus = 502;
      errorCode = "LLM_INVALID_RESPONSE";
      errorMsg = "Modelo LLM retornou resposta em formato inválido (não-JSON). Tente novamente.";
    }

    logNV("❌ [CHAT/LLM] Erro fatal:", { error: errStr, errorCode, httpStatus });
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        mode: "llm-first",
        timestamp: Date.now(),
        error: errorMsg,
        error_code: errorCode,
        detail: errStr,
        telemetry: {
          duration_ms: Date.now() - startedAt,
          // PR7: continuity_active and pipeline are derivable before LLM call — include on failure
          continuity_active: conversationHistory.length > 0,
          conversation_history_length: conversationHistory.length,
          pipeline: shouldActivatePlanner ? "PR3 + LLM + PM4→PM9" : "PR3 + LLM-only",
          // PR7: llm_parse_mode is unknown on failure (LLM never responded)
          llm_parse_mode: _LLM_PARSE_MODE.UNKNOWN,
          // Include PM4 pre-check result even on LLM failure — it's deterministic
          arbitration: pm4Arbitration ? {
            pm4_level: pm4Arbitration.level,
            pm4_allows_planner: pm4AllowsPlanner,
            ...(operationalOverride ? { operational_override: true } : {}),
            // Compute final_decision from PM4 + operational override (LLM decision unknown on failure)
            final_decision: shouldActivatePlanner
              ? (operationalOverride && !pm4AllowsPlanner
                  ? "planner_forced_operational"
                  : "planner_forced_level_BC")
              : "planner_blocked_level_A",
          } : null,
          // Include operational awareness even on LLM failure — computed before try block
          operational_awareness: {
            browser_status:      operationalAwareness.browser.status,
            browser_can_act:     operationalAwareness.browser.can_act,
            executor_configured: operationalAwareness.executor.configured,
            approval_mode:       operationalAwareness.approval.mode,
            human_gate_active:   operationalAwareness.approval.human_gate_active,
          },
        },
      },
      httpStatus
    );
  }
}

// ============================================================================
// 🌉 PLANNER BRIDGE — POST /planner/bridge (P12)
//
// Recebe o bridge payload canônico (PM8) do painel após aprovação humana (P11)
// e encaminha ao executor via service binding. NÃO executa lógica de planner
// nem expande para execução operacional — apenas a ponte.
//
// Payload esperado:
//   { executor_payload: { version, source, plan_summary, ... }, session_id? }
//
// Retorno:
//   { ok, bridge_accepted, executor_response?, error?, timestamp, telemetry }
// ============================================================================
async function handlePlannerBridge(request, env) {
  const startedAt = Date.now();

  // 1) Validate EXECUTOR binding
  if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
    logNV("🔴 [PLANNER/BRIDGE] EXECUTOR binding ausente");
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "Service Binding EXECUTOR não configurado.",
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 503);
  }

  // 2) Parse body
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "JSON inválido em /planner/bridge.",
      detail: String(err),
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 400);
  }

  if (!body || typeof body !== "object") body = {};

  // 3) Validate executor_payload
  const ep = body.executor_payload;
  if (
    !ep ||
    typeof ep !== "object" ||
    typeof ep.version !== "string" ||
    typeof ep.source !== "string" ||
    !Array.isArray(ep.steps)
  ) {
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "executor_payload inválido ou ausente. Campos obrigatórios: version, source, steps.",
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 400);
  }

  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const reqId = safeId("bridge");

  logNV("🌉 [PLANNER/BRIDGE] Recebendo bridge payload", {
    reqId,
    sessionId,
    source: ep.source,
    version: ep.version,
    steps_count: ep.steps.length,
  });

  // 4) Forward to executor via service binding
  try {
    const executorPayload = {
      action: "execute_plan",
      source: "planner_bridge",
      bridge_id: reqId,
      session_id: sessionId,
      executor_payload: ep,
    };

    const executorRes = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executorPayload),
    });

    let executorJson;
    try {
      executorJson = await executorRes.json();
    } catch {
      executorJson = { ok: false, error: "EXECUTOR_INVALID_JSON" };
    }

    logNV("🌉 [PLANNER/BRIDGE] Resposta do executor", {
      reqId,
      executor_ok: !!executorJson?.ok,
      status: executorRes.status,
    });

    // 5) P13 — persist execution trail to KV for safe, durable observability
    const trail = {
      bridge_id: reqId,
      dispatched_at: new Date().toISOString(),
      session_id: sessionId,
      source: ep.source,
      steps_count: ep.steps.length,
      executor_ok: executorRes.status >= 200 && executorRes.status < 300,
      executor_status: executorRes.status,
      executor_error: (executorRes.status >= 200 && executorRes.status < 300) ? null : (executorJson?.error ?? null),
    };
    if (env.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(trail));
        await env.ENAVIA_BRAIN.put(`execution:trail:${reqId}`, JSON.stringify(trail));
      } catch (kvErr) {
        logNV("⚠️ [PLANNER/BRIDGE] Falha ao persistir trilha no KV (não crítico)", {
          reqId,
          error: String(kvErr),
        });
      }
    }

    return jsonResponse({
      ok: true,
      bridge_accepted: true,
      executor_response: executorJson,
      bridge_id: reqId,
      timestamp: Date.now(),
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: sessionId,
        executor_status: executorRes.status,
      },
    });
  } catch (networkErr) {
    logNV("🔴 [PLANNER/BRIDGE] Falha de rede com executor", {
      reqId,
      error: String(networkErr),
    });

    // P13 — persist failure trail so even network errors are observable
    const errorTrail = {
      bridge_id: reqId,
      dispatched_at: new Date().toISOString(),
      session_id: sessionId,
      source: ep.source,
      steps_count: ep.steps.length,
      executor_ok: false,
      executor_status: null,
      executor_error: "NETWORK_ERROR",
    };
    if (env.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(errorTrail));
        await env.ENAVIA_BRAIN.put(`execution:trail:${reqId}`, JSON.stringify(errorTrail));
      } catch (_) { /* silent — already in error path */ }
    }

    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "Falha de rede ao encaminhar bridge payload ao executor.",
      detail: String(networkErr),
      bridge_id: reqId,
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 502);
  }
}

// ============================================================================
// PR8 — buildOperationalAction (Worker-only, pure)
//
// Transforma o nextAction produzido por resolveNextAction() em um shape
// canônico de ação operacional. Read-only — não executa nem altera estado.
//
// Shape canônico:
//   action_id              — id determinístico baseado em contrato + tipo + contexto
//   contract_id            — contrato ao qual a ação pertence
//   type                   — execute_next | approve | close_final | block
//   requires_human_approval — true quando depende de decisão humana
//   evidence_required      — campos mínimos esperados pelo endpoint-alvo
//   can_execute            — false se a ação está bloqueada
//   block_reason           — motivo do bloqueio (null quando can_execute=true)
//
// Mapeamento resolveNextAction.type → tipo operacional:
//   start_task / start_micro_pr  → execute_next   (POST /contracts/execute-next)
//   awaiting_human_approval      → approve         (POST /contracts/close-final)
//   phase_complete               → advance_phase   (POST /contracts/advance-phase) — PR18
//   contract_complete            → block           (contrato já concluído, sem ação)
//   contract_blocked / plan_rejected / no_action / contract_cancelled → block
// ============================================================================
function buildOperationalAction(nextAction, contractId) {
  const OP_TYPE_MAP = {
    start_task:              "execute_next",
    start_micro_pr:          "execute_next",
    awaiting_human_approval: "approve",
    contract_complete:       "block",    // contrato já concluído — sem ação disponível
    contract_blocked:        "block",
    phase_complete:          "advance_phase", // PR18 — endpoint supervisionado de avanço de fase
    plan_rejected:           "block",
    contract_cancelled:      "block",
    no_action:               "block",
  };

  const EVIDENCE_MAP = {
    execute_next:  ["contract_id", "evidence[]"],
    approve:       ["contract_id"],
    close_final:   ["contract_id"],
    reject:        ["contract_id"],
    advance_phase: ["contract_id"], // PR18 — só requer contract_id; gate aplicado por advanceContractPhase
    block:         [],
  };

  const opType        = OP_TYPE_MAP[nextAction.type] ?? "block";
  const canExecute    = opType !== "block";
  const requiresHuman = opType === "approve" || opType === "reject" || opType === "close_final";
  const contextKey    = nextAction.task_id || nextAction.phase_id || nextAction.micro_pr_candidate_id || nextAction.type;
  const actionId      = `op:${contractId}:${opType}:${contextKey}`;

  return {
    action_id:               actionId,
    contract_id:             contractId,
    type:                    opType,
    requires_human_approval: requiresHuman,
    evidence_required:       EVIDENCE_MAP[opType] ?? [],
    can_execute:             canExecute,
    block_reason:            canExecute ? null : (
      nextAction.type === "contract_complete"
        ? "Contrato já concluído. Nenhuma ação adicional disponível."
        : (nextAction.reason || "Ação bloqueada.")
    ),
  };
}

function normalizeTargetWorkers(workers) {
  if (!Array.isArray(workers)) return [];
  return [...new Set(
    workers
      .filter((worker) => typeof worker === "string" && worker.trim())
      .map((worker) => worker.trim())
  )];
}

function resolveAuditTargetWorker(state, decomposition, nextAction) {
  const sources = [];
  const register = (source, workers) => {
    const normalized = normalizeTargetWorkers(workers);
    if (normalized.length > 0) {
      sources.push({ source, workers: normalized });
    }
  };

  register(
    "state.current_execution.handoff_used.scope.workers",
    state?.current_execution?.handoff_used?.scope?.workers
  );

  const targetMpr = nextAction?.micro_pr_candidate_id
    ? (decomposition?.micro_pr_candidates || []).find(
        (mpr) => mpr && mpr.id === nextAction.micro_pr_candidate_id
      )
    : null;
  register(
    "nextAction.micro_pr_candidate.target_workers",
    targetMpr?.target_workers
  );

  const executionHandoff = buildExecutionHandoff(state, decomposition);
  register(
    "buildExecutionHandoff(...).scope.workers",
    executionHandoff?.scope?.workers
  );

  register("state.scope.workers", state?.scope?.workers);

  const uniqueWorkers = [...new Set(sources.flatMap((entry) => entry.workers))];

  if (uniqueWorkers.length === 1) {
    const workerId = uniqueWorkers[0];
    const source = sources.find((entry) => entry.workers.includes(workerId))?.source || null;
    return {
      ok: true,
      workerId,
      source,
      candidates: uniqueWorkers,
    };
  }

  if (uniqueWorkers.length === 0) {
    return {
      ok: false,
      workerId: null,
      source: null,
      candidates: [],
      reason: "target worker ausente para auditoria segura",
    };
  }

  return {
    ok: false,
    workerId: null,
    source: null,
    candidates: uniqueWorkers,
    reason: `target worker ambíguo para auditoria segura: ${uniqueWorkers.join(", ")}`,
  };
}

function buildExecutorTargetPayload(workerId) {
  return {
    workerId,
    target: { system: "cloudflare_worker", workerId },
  };
}

// ============================================================================
// PR6 — GET /contracts/loop-status (handler canônico, Worker-only)
//
// Ciclo supervisionado mínimo: lê contrato ativo, resolve próxima ação via
// resolveNextAction() e retorna estado legível para painel/operador.
//
// READ-ONLY — não dispara execução, não altera estado, não promove deploy.
//
// Supervisão:
//   - canProceed: true → há ação disponível, operador pode chamar endpoint indicado
//   - blocked: true → loop bloqueado por evidência ausente; blockReason indica causa
//   - availableActions: endpoints que o operador pode chamar neste estado
//
// Honestidade:
//   - Se não houver contrato ativo, retorna { contract: null, loop.canProceed: false }.
//   - resolveNextAction() usa apenas dados do KV — sem inventar estado.
// ============================================================================
async function handleGetLoopStatus(env) {
  const generatedAt = new Date().toISOString();

  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: true,
      generatedAt,
      contract: null,
      nextAction: { type: "no_kv", reason: "KV não disponível neste ambiente.", status: "error" },
      operationalAction: null,
      loop: { supervised: true, canProceed: false, blocked: false, blockReason: null, availableActions: [] },
    });
  }

  try {
    // 1) Ler index de contratos para encontrar o contrato ativo mais recente
    let index = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get("contract:index");
      if (raw) index = JSON.parse(raw);
    } catch (_) { /* index ausente = sem contratos */ }

    if (!Array.isArray(index) || index.length === 0) {
      return jsonResponse({
        ok: true,
        generatedAt,
        contract: null,
        nextAction: { type: "no_contract", reason: "Nenhum contrato ativo encontrado.", status: "idle" },
        operationalAction: null,
        loop: {
          supervised: true,
          canProceed: false,
          blocked: false,
          blockReason: null,
          availableActions: ["POST /contracts"],
        },
      });
    }

    // 2) Encontrar o contrato ativo mais recente (mesmo padrão de handleGetActiveSurface)
    const TERMINAL = ["completed", "cancelled", "failed"];
    let contractId = null;
    let state = null;
    let decomposition = null;

    for (let i = index.length - 1; i >= 0; i--) {
      const { state: s, decomposition: d } = await rehydrateContract(env, index[i]);
      if (!s) continue;
      if (TERMINAL.includes(s.status_global)) continue;
      contractId = index[i];
      state = s;
      decomposition = d;
      break;
    }

    if (!state) {
      return jsonResponse({
        ok: true,
        generatedAt,
        contract: null,
        nextAction: { type: "no_contract", reason: "Nenhum contrato ativo encontrado (todos terminais).", status: "idle" },
        operationalAction: null,
        loop: {
          supervised: true,
          canProceed: false,
          blocked: false,
          blockReason: null,
          availableActions: ["POST /contracts"],
        },
      });
    }

    // 3) Resolver próxima ação — função já existente em contract-executor.js
    const nextAction = resolveNextAction(state, decomposition);

    // PR8 — shape canônico de ação operacional
    const operationalAction = buildOperationalAction(nextAction, contractId);

    // 4) Derivar estado do loop a partir da próxima ação
    const isBlocked          = nextAction.status === "blocked";
    const isReady            = nextAction.status === "ready";
    const isAwaitingApproval = nextAction.type   === "awaiting_human_approval";
    const isIdle             = nextAction.status === "in_progress" || nextAction.type === "no_action";

    let availableActions = [];
    let guidance         = null;

    if (isReady) {
      if (nextAction.type === "start_task" || nextAction.type === "start_micro_pr") {
        availableActions = ["POST /contracts/execute-next"];
      } else if (nextAction.type === "phase_complete") {
        // PR18 — endpoint supervisionado de avanço de fase agora disponível.
        // Reutiliza advanceContractPhase (gate checkPhaseGate aplicado internamente).
        availableActions = ["POST /contracts/advance-phase"];
        guidance = "Phase complete. Use POST /contracts/advance-phase com { contract_id } para avançar à próxima fase (gate aplicado internamente por advanceContractPhase).";
      } else if (nextAction.type === "contract_complete") {
        availableActions = [];
      }
    } else if (isAwaitingApproval) {
      // awaiting_human_approval retorna status "awaiting_approval" (não "ready").
      // Tratar fora do guard isReady para expor a ação humana disponível.
      availableActions = ["POST /contracts/close-final"];
    } else if (nextAction.status === "in_progress") {
      // PR20 — task em progresso pode ser concluída supervisionadamente via complete-task.
      // Sem essa exposição, o operador/Enavia ficaria "cego" no loop e o ciclo
      // execute-next → complete-task → phase_complete → advance-phase quebraria autonomia.
      availableActions = ["POST /contracts/complete-task"];
      guidance = "Task in_progress. Use POST /contracts/complete-task com { contract_id, task_id, resultado } para concluir com gate de aderência.";
    }

    // PR20 — task in_progress permite que o operador prossiga via complete-task.
    const canProceed = isReady || isAwaitingApproval || (nextAction.status === "in_progress");

    return jsonResponse({
      ok: true,
      generatedAt,
      contract: {
        id:            state.contract_id || contractId,
        title:         state.contract_name || null,
        status:        state.status_global || null,
        current_phase: state.current_phase || null,
        current_task:  state.current_task  || null,
        updated_at:    state.updated_at    || null,
      },
      nextAction,
      operationalAction, // PR8 — shape canônico de ação operacional
      loop: {
        supervised:       true,
        canProceed,
        blocked:          isBlocked,
        blockReason:      isBlocked ? nextAction.reason : null,
        availableActions,
        ...(guidance ? { guidance } : {}),
      },
    });
  } catch (err) {
    logNV("🔴 [GET /contracts/loop-status] Falha ao resolver loop", { error: String(err) });
    return jsonResponse({ ok: false, error: "Falha ao resolver estado do loop supervisionado." }, 500);
  }
}

// ============================================================================
// PR10 — buildEvidenceReport / buildRollbackRecommendation (Worker-only, pure)
//
// Helpers de auditabilidade para execute-next supervisionado.
// Nenhum deles persiste estado ou executa ação.
//
// buildEvidenceReport: compara o que o contrato exige vs o que o chamador
//   forneceu, retornando um relatório explícito de validação mínima por
//   presença de campo (sem validação semântica profunda nesta PR10).
//
// buildRollbackRecommendation: retorna orientação de rollback sem executar.
//   type: "no_state_change" | "manual_review"
// ============================================================================
function buildEvidenceReport(opType, contractId, body) {
  const EVIDENCE_REQUIRED = {
    execute_next: ["contract_id", "evidence[]"],
    approve:      ["contract_id"],
    close_final:  ["contract_id"],
    reject:       ["contract_id"],
    block:        [],
  };

  const required = EVIDENCE_REQUIRED[opType] ?? [];

  const provided = [];
  if (contractId) provided.push("contract_id");
  if (body && "evidence" in body) provided.push("evidence[]");
  if (body?.confirm === true) provided.push("confirm");
  if (body?.approved_by) provided.push("approved_by");

  const missing = required.filter(f => !provided.includes(f));

  return {
    required,
    provided,
    missing,
    validation_level: "presence_only",
    semantic_validation: false,
  };
}

function buildRollbackRecommendation(opType, contractId, executed) {
  if (!executed) {
    return {
      available: false,
      type: "no_state_change",
      recommendation: "Nenhuma mudança de estado ocorreu. Nenhuma ação de rollback necessária.",
      command: null,
    };
  }

  if (opType === "execute_next") {
    return {
      available: true,
      type: "manual_review",
      recommendation: `Verificar estado da task no contrato ${contractId} e reverter manualmente se necessário.`,
      command: `POST /contracts/cancel { "contract_id": "${contractId}" }`,
    };
  }

  if (opType === "approve") {
    return {
      available: true,
      type: "manual_review",
      recommendation: `Contrato ${contractId} processado para fechamento. Reabrir requer novo contrato ou revisão manual.`,
      command: null,
    };
  }

  return {
    available: false,
    type: "no_state_change",
    recommendation: "Nenhuma mudança de estado. Nenhuma ação necessária.",
    command: null,
  };
}

// ============================================================================
// PR11 — buildExecutorPathInfo (Worker-only, pure)
//
// Retorna auditoria do caminho de execução: qual handler será chamado e se
// env.EXECUTOR (Service Binding) é ou não usado neste fluxo.
//
// Diagnóstico PR11 confirmou:
//   - execute_next → handleExecuteContract → executeCurrentMicroPr (KV puro)
//   - approve      → handleCloseFinalContract (KV puro)
//   - env.EXECUTOR.fetch é usado APENAS em handleEngineerRequest (/engineer proxy)
//   - O fluxo de contratos NÃO passa pelo Service Binding do executor externo.
//   - Timeout local cancelável NÃO foi aplicado: esses handlers podem alterar KV
//     e uma corrida local de Promises não cancela a execução original.
//   - Sem AbortSignal/cancelamento real, responder timeout aqui seria inseguro.
//   - Timeout seguro fica para PR futura, se houver handler cancelável/idempotente.
// ============================================================================
function buildExecutorPathInfo(env, opType) {
  const serviceBindingAvailable     = !!(env && env.EXECUTOR);
  const deployBindingAvailable      = !!(env && env.DEPLOY_WORKER);
  if (opType === "execute_next") {
    return {
      type:                       "executor_bridge + internal_handler",
      handler:                    "callExecutorBridge(/audit) → callExecutorBridge(/propose) → callDeployBridge(simulate) → handleExecuteContract",
      uses_service_binding:       true,
      service_binding_available:  serviceBindingAvailable,
      deploy_binding_available:   deployBindingAvailable,
      note:                       "PR14: audit + propose via env.EXECUTOR, deploy via env.DEPLOY_WORKER (simulate/test). Handler interno KV só roda depois dos bridges.",
    };
  }
  if (opType === "approve") {
    return {
      type:                       "executor_bridge + internal_handler",
      handler:                    "callExecutorBridge(/audit) → handleCloseFinalContract",
      uses_service_binding:       true,
      service_binding_available:  serviceBindingAvailable,
      deploy_binding_available:   deployBindingAvailable,
      note:                       "PR14: audit via env.EXECUTOR antes de fechar contrato. Approve não chama propose nem deploy direto.",
    };
  }
  return {
    type:                       "blocked",
    handler:                    null,
    uses_service_binding:       false,
    service_binding_available:  serviceBindingAvailable,
    deploy_binding_available:   deployBindingAvailable,
    note:                       "Ação bloqueada. Nenhum handler chamado.",
  };
}

// ============================================================================
// PR14 — callExecutorBridge (Worker-only, puro)
//
// Chama env.EXECUTOR.fetch para /audit ou /propose.
// Retorna envelope estável: { ok, route, status, reason, data }.
//
// Regras:
//   - env.EXECUTOR ausente → blocked imediato.
//   - Resposta não-ok → failed.
//   - Resposta sem ok explícito mas ambígua → ambiguous.
//   - /audit com verdict:reject → blocked.
//   - /audit sem verdict → ambiguous.
//   - Qualquer exceção → failed.
// ============================================================================
async function callExecutorBridge(env, route, payload) {
  if (typeof env?.EXECUTOR?.fetch !== "function") {
    return {
      ok: false, route, status: "blocked",
      reason: "env.EXECUTOR não disponível. Service Binding 'EXECUTOR' não configurado.",
      data: null,
    };
  }
  try {
    const res = await env.EXECUTOR.fetch("https://enavia-executor.internal" + route, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    let data = null;
    let rawText = "";
    try {
      rawText = await res.text();
      data = JSON.parse(rawText);
    } catch (_) {
      return {
        ok: false, route, status: "ambiguous",
        reason: "Resposta do Executor não é JSON válido.",
        data: { raw: rawText.slice(0, 500) },
      };
    }
    if (!res.ok) {
      return {
        ok: false, route, status: "failed",
        reason: `Executor retornou status ${res.status}.`,
        data,
      };
    }
    if (data === null || typeof data !== "object") {
      return {
        ok: false, route, status: "ambiguous",
        reason: "Resposta do Executor não é JSON objeto válido.",
        data,
      };
    }
    if ("ok" in data && data.ok === false) {
      return {
        ok: false, route, status: "blocked",
        reason: data.error || data.reason || data.message || "Executor retornou ok:false.",
        data,
      };
    }
    if (route === "/audit") {
      const verdict = data?.result?.verdict || data?.audit?.verdict || null;
      if (verdict === "reject") {
        return {
          ok: false, route, status: "blocked",
          reason: `Audit reprovado. Verdict: reject. Risk: ${data?.result?.risk_level || data?.audit?.risk_level || "unknown"}.`,
          data,
        };
      }
      if (!verdict) {
        return {
          ok: false, route, status: "ambiguous",
          reason: "Audit sem verdict explícito. Resposta ambígua bloqueada por segurança.",
          data,
        };
      }
    }
    return { ok: true, route, status: "passed", reason: null, data };
  } catch (err) {
    return {
      ok: false, route, status: "failed",
      reason: `Falha ao chamar Executor (${route}): ${String(err)}`,
      data: null,
    };
  }
}

function extractDeployAuditRiskLevel(executorAudit) {
  const candidates = [
    executorAudit?.result?.risk_level,
    executorAudit?.audit?.risk_level,
    executorAudit?.risk_level,
    executorAudit?.result?.risk,
    executorAudit?.audit?.risk,
    executorAudit?.risk,
  ];
  for (const candidate of candidates) {
    if (candidate === "low" || candidate === "medium" || candidate === "high" || candidate === "critical") {
      return candidate;
    }
  }
  return null;
}

function validateExecutorAuditForReceipt(executorAudit) {
  if (!executorAudit || typeof executorAudit !== "object") {
    return {
      ok: false,
      verdict: null,
      risk_level: null,
      reason: "executor_audit ausente. Não é possível registrar recibo sem audit real do Executor.",
    };
  }
  const verdict =
    executorAudit?.result?.verdict ||
    executorAudit?.audit?.verdict ||
    executorAudit?.verdict ||
    null;
  if (verdict !== "approve") {
    return {
      ok: false,
      verdict,
      risk_level: null,
      reason: `Verdict do Executor não é "approve" (atual: ${JSON.stringify(verdict)}). Recibo não registrado.`,
    };
  }
  const risk_level = extractDeployAuditRiskLevel(executorAudit);
  if (risk_level === "high" || risk_level === "critical") {
    return {
      ok: false,
      verdict,
      risk_level,
      reason: `Risk level "${risk_level}" não permite registro de recibo. Apenas low/medium aceitável.`,
    };
  }
  if (risk_level === null) {
    return {
      ok: false,
      verdict,
      risk_level: null,
      reason: "Risk level não identificado no resultado do audit do Executor. Recibo não registrado para evitar fabricação de dados.",
    };
  }
  return {
    ok: true,
    verdict,
    risk_level,
    reason: null,
  };
}

async function callDeployWorkerJson(env, path, payload) {
  const res = await env.DEPLOY_WORKER.fetch(`https://deploy-worker.internal${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  let data = null;
  let rawText = "";
  try {
    rawText = await res.text();
    data = JSON.parse(rawText);
  } catch (_) {
    return {
      ok: false, route: path, status: "ambiguous",
      reason: "Resposta do Deploy Worker não é JSON válido.",
      data: { raw: rawText.slice(0, 500) },
    };
  }
  if (!res.ok) {
    return {
      ok: false, route: path, status: "failed",
      reason: `Deploy Worker retornou status ${res.status}.`,
      data,
    };
  }
  if (data === null || typeof data !== "object") {
    return {
      ok: false, route: path, status: "ambiguous",
      reason: "Resposta do Deploy Worker não é JSON objeto válido.",
      data,
    };
  }
  if ("ok" in data && data.ok === false) {
    return {
      ok: false, route: path, status: "failed",
      reason: data.error || data.reason || data.message || "Deploy Worker retornou ok:false.",
      data,
    };
  }
  return { ok: true, route: path, status: "passed", reason: null, data };
}

// ============================================================================
// PR14 — callDeployBridge (Worker-only, puro)
//
// Chama env.DEPLOY_WORKER.fetch apenas em modo seguro (simulate/apply-test/test).
// Produção bloqueada explicitamente nesta PR.
// Retorna envelope estável: { ok, action, route, status, reason, data }.
//
// Regras:
//   - Ações de produção (approve/promote/prod) → blocked imediato.
//   - target_env prod/production → blocked.
//   - env.DEPLOY_WORKER ausente → blocked com deploy_status:"blocked".
//   - Antes do /apply-test, valida executor_audit (verdict approve, risco aceitável)
//     e registra recibo em /__internal__/audit.
//   - Resposta não-ok → failed.
//   - Resposta ambígua → ambiguous.
// ============================================================================
async function callDeployBridge(env, action, payload) {
  const PROD_ACTIONS = ["approve", "promote", "prod", "production", "rollback"];
  if (PROD_ACTIONS.includes(String(action).toLowerCase())) {
    return {
      ok: false, action, route: null, status: "blocked",
      reason: `Ação "${action}" para produção bloqueada nesta PR. Apenas simulate/apply-test/test permitido.`,
      data: null,
    };
  }
  const targetEnv = (payload?.target_env || "").toLowerCase();
  if (targetEnv === "prod" || targetEnv === "production") {
    return {
      ok: false, action, route: null, status: "blocked",
      reason: "target_env production/prod bloqueado. Use test ou simulate.",
      data: null,
    };
  }
  if (typeof env?.DEPLOY_WORKER?.fetch !== "function") {
    return {
      ok: false, action: "blocked", route: null, status: "blocked",
      reason: "env.DEPLOY_WORKER não disponível. Service Binding 'DEPLOY_WORKER' não configurado. Deploy bloqueado por segurança.",
      data: null,
    };
  }
  try {
    const executionId = String(payload?.execution_id || payload?.audit_id || `exec-next:${Date.now()}`);
    const safePayload = {
      ...payload,
      execution_id: executionId,
      audit_id: payload?.audit_id || executionId,
      target_env: "test",
      deploy_action: "simulate",
    };

    // ── Gate de validação do audit real do Executor ───────────────────────────
    // Nunca registrar recibo com audit.ok=true sem prova real de aprovação.
    const auditValidation = validateExecutorAuditForReceipt(safePayload.executor_audit);
    if (!auditValidation.ok) {
      return {
        ok: false, action, route: null, status: "blocked",
        reason: `Gate de validação do audit bloqueou registro do recibo: ${auditValidation.reason}`,
        data: null,
        audit_validation: auditValidation,
      };
    }

    const auditReceiptPayload = {
      execution_id: executionId,
      audit_id: safePayload.audit_id,
      source: safePayload.source || "nv-enavia",
      mode: safePayload.mode || "contract_execute_next",
      contract_id: safePayload.contract_id || null,
      nextAction: safePayload.nextAction || null,
      operationalAction: safePayload.operationalAction || null,
      timestamp: safePayload.timestamp || new Date().toISOString(),
      audit: {
        ok: true,
        verdict: auditValidation.verdict,
        risk_level: auditValidation.risk_level,
      },
      executor_audit: safePayload.executor_audit || null,
    };
    const auditReceiptResult = await callDeployWorkerJson(env, "/__internal__/audit", auditReceiptPayload);
    if (!auditReceiptResult.ok) {
      return {
        ok: false, action, route: auditReceiptResult.route, status: auditReceiptResult.status,
        reason: `Não foi possível registrar recibo de audit aprovado antes do /apply-test. ${auditReceiptResult.reason}`,
        data: auditReceiptResult.data,
        audit_receipt: auditReceiptResult,
      };
    }
    const applyTestResult = await callDeployWorkerJson(env, "/apply-test", safePayload);
    if (!applyTestResult.ok) {
      return {
        ok: false, action, route: applyTestResult.route, status: applyTestResult.status,
        reason: applyTestResult.reason,
        data: applyTestResult.data,
        audit_receipt: auditReceiptResult,
      };
    }
    return {
      ok: true, action: "simulate", route: applyTestResult.route, status: "passed", reason: null,
      data: applyTestResult.data,
      audit_receipt: auditReceiptResult,
    };
  } catch (err) {
    return {
      ok: false, action, route: null, status: "failed",
      reason: `Falha ao chamar Deploy Worker: ${String(err)}`,
      data: null,
    };
  }
}

// ============================================================================
// PR9 — POST /contracts/execute-next (handler canônico, Worker-only)
//
// Loop operacional supervisionado: lê contrato ativo, resolve próxima ação,
// aplica gates de segurança e executa somente quando for seguro.
//
// Regras duras:
//   - Nunca executa se operationalAction.can_execute !== true.
//   - Nunca executa "approve" sem confirm: true + approved_by explícito.
//   - Nunca chama deploy, produção automática ou executor externo diretamente.
//   - Reutiliza handleExecuteContract / handleCloseFinalContract (já importados).
//   - Se tipo não tiver caminho seguro mapeado, bloqueia.
//
// Body esperado:
//   { confirm?: true, approved_by?: string, evidence?: any[] }
//
// Resposta (PR11 — enriquecida com executor_path):
//   { ok, executed, status, reason, nextAction, operationalAction,
//     evidence: { required, provided, missing, validation_level, semantic_validation },
//     rollback: { available, type, recommendation, command },
//     executor_path: { type, handler, uses_service_binding, service_binding_available, note },
//     execution_result?, audit_id }
// ============================================================================
// PR18 — handleAdvancePhase (POST /contracts/advance-phase)
//
// Endpoint supervisionado para avançar a fase de um contrato quando
// resolveNextAction retorna { type: "phase_complete", status: "ready" }.
//
// Reutiliza integralmente advanceContractPhase (contract-executor.js) — toda a
// lógica de gate (checkPhaseGate), persistência KV e marcação de fase está
// implementada lá. Este handler apenas:
//   1. valida JSON do body;
//   2. exige contract_id;
//   3. delega para advanceContractPhase(env, contractId);
//   4. mapeia resultado para response HTTP supervisionado.
//
// NÃO duplica gates. NÃO avança fase fora deste endpoint. NÃO toca produção.
//
// Body esperado:
//   { contract_id?: string, contractId?: string }
//
// Respostas:
//   200 → { ok: true, status: "advanced", contract_id, result }
//   400 → { ok: false, status: "blocked", reason: "JSON inválido." }
//   400 → { ok: false, status: "blocked", reason: "contract_id obrigatório." }
//   409 → { ok: false, status: "blocked", reason, result }   (gate falhou ou erro)
// ============================================================================
async function handleAdvancePhase(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: {
        ok: false,
        status: "blocked",
        reason: "JSON inválido.",
      },
    };
  }

  const contractId = body?.contract_id || body?.contractId;

  if (!contractId || typeof contractId !== "string") {
    return {
      status: 400,
      body: {
        ok: false,
        status: "blocked",
        reason: "contract_id obrigatório.",
      },
    };
  }

  let result;
  try {
    result = await advanceContractPhase(env, contractId);
  } catch (err) {
    return {
      status: 500,
      body: {
        ok: false,
        status: "blocked",
        reason: `Falha ao avançar fase: ${String(err)}`,
        contract_id: contractId,
      },
    };
  }

  if (!result || result.ok !== true) {
    return {
      status: 409,
      body: {
        ok: false,
        status: "blocked",
        reason: result?.error || result?.reason || result?.gate?.reason || "Avanço de fase bloqueado.",
        contract_id: contractId,
        result: result || null,
      },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      status: "advanced",
      contract_id: contractId,
      result,
    },
  };
}

// ============================================================================
async function handleExecuteNext(request, env) {
  const auditId = `exec-next:${Date.now()}`;

  // 1. Parse body — falha segura
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({
      ok: false, executed: false, status: "blocked",
      reason: "Body JSON inválido.",
      nextAction: null, operationalAction: null,
      evidence: null, rollback: null, executor_path: null, audit_id: auditId,
    }, 400);
  }

  // 2. KV obrigatório
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: false, executed: false, status: "blocked",
      reason: "KV não disponível neste ambiente.",
      nextAction: null, operationalAction: null,
      evidence: null, rollback: null, executor_path: null, audit_id: auditId,
    });
  }

  // 3. Localizar contrato ativo (mesmo padrão de handleGetLoopStatus)
  const TERMINAL = ["completed", "cancelled", "failed"];
  let contractId = null, state = null, decomposition = null;

  try {
    let index = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get("contract:index");
      if (raw) index = JSON.parse(raw);
    } catch (_) {}

    if (!Array.isArray(index) || index.length === 0) {
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: "Nenhum contrato encontrado.",
        nextAction: null, operationalAction: null,
        evidence: null, rollback: null, executor_path: null, audit_id: auditId,
      });
    }

    for (let i = index.length - 1; i >= 0; i--) {
      const { state: s, decomposition: d } = await rehydrateContract(env, index[i]);
      if (!s) continue;
      if (TERMINAL.includes(s.status_global)) continue;
      contractId = index[i]; state = s; decomposition = d;
      break;
    }
  } catch (err) {
    logNV("🔴 [POST /contracts/execute-next] Falha ao localizar contrato", { error: String(err) });
    return jsonResponse({
      ok: false, executed: false, status: "blocked",
      reason: "Falha ao localizar contrato ativo.",
      nextAction: null, operationalAction: null,
      evidence: null, rollback: null, executor_path: null, audit_id: auditId,
    }, 500);
  }

  if (!state) {
    return jsonResponse({
      ok: false, executed: false, status: "blocked",
      reason: "Nenhum contrato ativo (todos terminais).",
      nextAction: null, operationalAction: null,
      evidence: null, rollback: null, executor_path: null, audit_id: auditId,
    });
  }

  // 4. Resolver próxima ação e shape operacional (PR6 + PR8)
  const nextAction        = resolveNextAction(state, decomposition);
  const operationalAction = buildOperationalAction(nextAction, contractId);

  // PR10 — Computar evidência e rollback antes dos gates
  const evidenceReport  = buildEvidenceReport(operationalAction.type, contractId, body);
  const rollbackBlocked = buildRollbackRecommendation(operationalAction.type, contractId, false);

  // PR11 — Registrar caminho de execução para auditoria
  const executorPathInfo = buildExecutorPathInfo(env, operationalAction.type);

  // 5. Gate primário: can_execute — bloquear sem executar
  if (!operationalAction.can_execute) {
    return jsonResponse({
      ok: true, executed: false, status: "blocked",
      reason: operationalAction.block_reason || "Ação bloqueada.",
      nextAction, operationalAction,
      evidence: evidenceReport, rollback: rollbackBlocked,
      executor_path: executorPathInfo, audit_id: auditId,
    });
  }

  // PR10 — Gate de evidência: campos obrigatórios ausentes → bloquear
  if (evidenceReport.missing.length > 0) {
    return jsonResponse({
      ok: false, executed: false, status: "blocked",
      reason: evidenceReport.missing.includes("evidence[]")
        ? "Campo evidence é obrigatório, mesmo que vazio, para ack operacional mínimo. Validação atual é apenas de presença."
        : `Evidência requerida ausente: ${evidenceReport.missing.join(", ")}.`,
      nextAction, operationalAction,
      evidence: evidenceReport, rollback: rollbackBlocked,
      executor_path: executorPathInfo, audit_id: auditId,
    });
  }

  const auditTargetResolution =
    operationalAction.type === "execute_next" || operationalAction.type === "approve"
      ? resolveAuditTargetWorker(state, decomposition, nextAction)
      : null;

  // 6. execute_next — PR14: Executor audit + propose + Deploy Bridge antes do handler interno.
  // Sem timeout local artificial: o handler pode persistir KV e não há
  // cancelamento real. Timeout local seria inseguro porque a resposta poderia
  // voltar "bloqueada" enquanto a mutação continuaria em background.
  if (operationalAction.type === "execute_next") {
    if (!auditTargetResolution?.ok) {
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        executor_audit: null, executor_propose: null,
        executor_status: "blocked", executor_route: null,
        executor_block_reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        deploy_result: null, deploy_status: "not_reached", deploy_route: null,
        deploy_block_reason: "Audit não foi chamado porque o alvo da auditoria não é confiável.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR14 — Step A: Executor /audit (obrigatório antes de executar)
    const _auditPayload = {
      source: "nv-enavia", mode: "contract_execute_next", executor_action: "audit",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      context: { require_live_read: true },
      contract_id: contractId, nextAction, operationalAction,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by || null,
      audit_id: auditId, timestamp: new Date().toISOString(),
    };
    const executorAuditResult = await callExecutorBridge(env, "/audit", _auditPayload);
    if (!executorAuditResult.ok) {
      logNV("🔴 [POST /contracts/execute-next] Executor /audit bloqueou (execute_next)", { auditResult: executorAuditResult });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: executorAuditResult.reason || "Audit bloqueado pelo Executor.",
        executor_audit: executorAuditResult, executor_propose: null,
        executor_status: executorAuditResult.status, executor_route: "/audit",
        executor_block_reason: executorAuditResult.reason,
        deploy_result: null, deploy_status: "not_reached", deploy_route: null,
        deploy_block_reason: "Audit bloqueou antes do deploy.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR14 — Step B: Executor /propose (apenas execute_next)
    const _proposePayload = {
      source: "nv-enavia", mode: "contract_execute_next", executor_action: "propose",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      patch: { type: "contract_action", content: JSON.stringify(nextAction) },
      prompt: `Proposta supervisionada para ação contratual: ${operationalAction.type}`,
      intent: "propose",
      contract_id: contractId, nextAction, operationalAction,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by || null,
      audit_id: auditId, timestamp: new Date().toISOString(),
    };
    const executorProposeResult = await callExecutorBridge(env, "/propose", _proposePayload);
    if (!executorProposeResult.ok) {
      logNV("🔴 [POST /contracts/execute-next] Executor /propose bloqueou (execute_next)", { proposeResult: executorProposeResult });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: executorProposeResult.reason || "Propose bloqueado pelo Executor.",
        executor_audit: executorAuditResult, executor_propose: executorProposeResult,
        executor_status: executorProposeResult.status, executor_route: "/propose",
        executor_block_reason: executorProposeResult.reason,
        deploy_result: null, deploy_status: "not_reached", deploy_route: null,
        deploy_block_reason: "Propose bloqueou antes do deploy.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR14 — Step C: Deploy Worker (modo simulate/apply-test/test apenas)
    const _deployPayload = {
      source: "nv-enavia", mode: "contract_execute_next",
      deploy_action: "simulate", target_env: "test",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      patch: { type: "contract_action", content: JSON.stringify(nextAction) },
      contract_id: contractId, nextAction, operationalAction,
      execution_id: auditId,
      executor_audit: executorAuditResult.data,
      executor_propose: executorProposeResult.data,
      audit_id: auditId, timestamp: new Date().toISOString(),
    };
    const deployResult = await callDeployBridge(env, "simulate", _deployPayload);
    if (!deployResult.ok) {
      logNV("🔴 [POST /contracts/execute-next] Deploy Worker bloqueou (execute_next)", { deployResult });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: deployResult.reason || "Deploy Worker bloqueou ou não disponível.",
        executor_audit: executorAuditResult, executor_propose: executorProposeResult,
        executor_status: "passed", executor_route: "/propose",
        executor_block_reason: null,
        deploy_result: deployResult, deploy_status: deployResult.status,
        deploy_route: deployResult.route || null,
        deploy_block_reason: deployResult.reason,
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR16 — Step D0: Iniciar task queued antes de delegar execução.
    // resolveNextAction retorna "start_task" quando a task está queued.
    // handleExecuteContract → executeCurrentMicroPr exige task.status === "in_progress" (Gate 2).
    // startTask transiciona queued → in_progress e persiste no KV.
    if (nextAction.type === "start_task" && nextAction.task_id) {
      let startResult;
      try {
        startResult = await startTask(env, contractId, nextAction.task_id);
      } catch (err) {
        logNV("🔴 [POST /contracts/execute-next] Falha ao chamar startTask", { error: String(err) });
        startResult = { ok: false, error: "START_TASK_ERROR", message: String(err) };
      }
      if (!startResult.ok) {
        return jsonResponse({
          ok: false, executed: false, status: "blocked",
          reason: `Falha ao iniciar task "${nextAction.task_id}": ${startResult.message || startResult.error}`,
          executor_audit: executorAuditResult, executor_propose: executorProposeResult,
          executor_status: "passed", executor_route: "/propose",
          executor_block_reason: null,
          deploy_result: deployResult, deploy_status: deployResult.status,
          deploy_route: deployResult.route || null, deploy_block_reason: null,
          nextAction, operationalAction,
          evidence: evidenceReport, rollback: rollbackBlocked,
          executor_path: executorPathInfo, audit_id: auditId,
        });
      }
    }

    // PR14 — Step D: Após audit + propose + deploy seguro, delegar ao handler interno
    let result;
    try {
      const syntheticReq = new Request("https://internal/contracts/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          evidence: Array.isArray(body.evidence) ? body.evidence : [],
        }),
      });
      result = await handleExecuteContract(syntheticReq, env);
    } catch (err) {
      logNV("🔴 [POST /contracts/execute-next] Falha ao delegar a handleExecuteContract", { error: String(err) });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: "Falha interna ao executar ação.",
        executor_audit: executorAuditResult, executor_propose: executorProposeResult,
        executor_status: "passed", executor_route: "/propose",
        executor_block_reason: null,
        deploy_result: deployResult, deploy_status: deployResult.status,
        deploy_route: deployResult.route || null, deploy_block_reason: null,
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      }, 500);
    }

    const executed = result.status === 200 && result.body?.ok === true;
    // PR10 — resultado ambíguo: ok=undefined ou status 200 sem ok explícito → bloquear
    const ambiguous = !executed && result.status === 200 && result.body?.ok !== false;
    if (ambiguous) {
      logNV("⚠️ [POST /contracts/execute-next] Resultado ambíguo de handleExecuteContract", { result: result.body });
    }
    return jsonResponse({
      ok: executed, executed,
      status:           executed ? "executed" : "blocked",
      reason:           executed ? null : (result.body?.message || (ambiguous ? "Resultado ambíguo. Execução bloqueada por segurança." : "Execução não concluída.")),
      executor_audit:   executorAuditResult,
      executor_propose: executorProposeResult,
      executor_status:  "passed",
      executor_route:   "/propose",
      executor_block_reason: null,
      deploy_result:    deployResult,
      deploy_status:    deployResult.status,
      deploy_route:     deployResult.route || null,
      deploy_block_reason: null,
      nextAction, operationalAction,
      execution_result: result.body || null,
      evidence:         evidenceReport,
      rollback:         buildRollbackRecommendation(operationalAction.type, contractId, executed),
      executor_path:    executorPathInfo,
      audit_id:         auditId,
    }, executed ? 200 : (result.status || 422));
  }

  // 7. approve — PR14: Executor audit antes do handler interno.
  // Gate humano (confirm + approved_by) é verificado ANTES do audit para
  // evitar chamadas desnecessárias ao Executor com dados incompletos.
  // Mesmo motivo do step 6: sem cancelamento real, timeout local aqui seria
  // inseguro para handlers que podem alterar estado persistido no KV.
  if (operationalAction.type === "approve") {
    if (body.confirm !== true) {
      return jsonResponse({
        ok: true, executed: false, status: "awaiting_approval",
        reason: "Aprovação humana explícita necessária. Envie { confirm: true, approved_by: '...' } (boolean estrito).",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }
    if (!body.approved_by) {
      return jsonResponse({
        ok: false, executed: false, status: "awaiting_approval",
        reason: "Campo approved_by é obrigatório para aprovação humana.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      }, 400);
    }

    if (!auditTargetResolution?.ok) {
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        executor_audit: null, executor_propose: null,
        executor_status: "blocked", executor_route: null,
        executor_block_reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        deploy_result: null, deploy_status: "not_applicable", deploy_route: null,
        deploy_block_reason: "Approve não usa deploy direto.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR14 — Step A: Executor /audit (obrigatório para approve também)
    const _auditPayloadApprove = {
      source: "nv-enavia", mode: "contract_execute_next", executor_action: "audit",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      context: { require_live_read: true },
      contract_id: contractId, nextAction, operationalAction,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by,
      audit_id: auditId, timestamp: new Date().toISOString(),
    };
    const executorAuditApproveResult = await callExecutorBridge(env, "/audit", _auditPayloadApprove);
    if (!executorAuditApproveResult.ok) {
      logNV("🔴 [POST /contracts/execute-next] Executor /audit bloqueou (approve)", { auditResult: executorAuditApproveResult });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: executorAuditApproveResult.reason || "Audit bloqueado pelo Executor.",
        executor_audit: executorAuditApproveResult, executor_propose: null,
        executor_status: executorAuditApproveResult.status, executor_route: "/audit",
        executor_block_reason: executorAuditApproveResult.reason,
        deploy_result: null, deploy_status: "not_applicable", deploy_route: null,
        deploy_block_reason: "Approve não usa deploy direto.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      });
    }

    // PR14 — Step B: Após audit, delegar ao handler interno
    let result;
    try {
      const syntheticReq = new Request("https://internal/contracts/close-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: contractId }),
      });
      result = await handleCloseFinalContract(syntheticReq, env);
    } catch (err) {
      logNV("🔴 [POST /contracts/execute-next] Falha ao delegar a handleCloseFinalContract", { error: String(err) });
      return jsonResponse({
        ok: false, executed: false, status: "blocked",
        reason: "Falha interna ao processar aprovação.",
        executor_audit: executorAuditApproveResult, executor_propose: null,
        executor_status: "passed", executor_route: "/audit",
        executor_block_reason: null,
        deploy_result: null, deploy_status: "not_applicable", deploy_route: null,
        deploy_block_reason: "Approve não usa deploy direto.",
        nextAction, operationalAction,
        evidence: evidenceReport, rollback: rollbackBlocked,
        executor_path: executorPathInfo, audit_id: auditId,
      }, 500);
    }

    const executed = result.status === 200 && result.body?.ok === true;
    // PR10 — resultado ambíguo no close-final → bloquear
    const ambiguous = !executed && result.status === 200 && result.body?.ok !== false;
    if (ambiguous) {
      logNV("⚠️ [POST /contracts/execute-next] Resultado ambíguo de handleCloseFinalContract", { result: result.body });
    }
    return jsonResponse({
      ok: executed, executed,
      status:           executed ? "executed" : "blocked",
      reason:           executed ? null : (result.body?.message || (ambiguous ? "Resultado ambíguo. Aprovação bloqueada por segurança." : "Aprovação não processada.")),
      executor_audit:   executorAuditApproveResult,
      executor_propose: null,
      executor_status:  "passed",
      executor_route:   "/audit",
      executor_block_reason: null,
      deploy_result:    null,
      deploy_status:    "not_applicable",
      deploy_route:     null,
      deploy_block_reason: "Approve não usa deploy direto.",
      nextAction, operationalAction,
      execution_result: result.body || null,
      evidence:         evidenceReport,
      rollback:         buildRollbackRecommendation(operationalAction.type, contractId, executed),
      executor_path:    executorPathInfo,
      audit_id:         auditId,
    }, executed ? 200 : (result.status || 422));
  }

  // 8. Fallback: tipo sem caminho seguro mapeado (não deve ocorrer se gates acima estão corretos)
  logNV("⚠️ [POST /contracts/execute-next] Tipo operacional sem caminho seguro", {
    opType: operationalAction.type, contractId,
  });
  return jsonResponse({
    ok: false, executed: false, status: "blocked",
    reason: `Tipo de ação "${operationalAction.type}" não tem caminho seguro mapeado em execute-next.`,
    nextAction, operationalAction,
    evidence: evidenceReport, rollback: rollbackBlocked,
    executor_path: executorPathInfo, audit_id: auditId,
  });
}

// ============================================================================
// 📋 P13 — GET /execution (handler canônico)
//
// Retorna a trilha de execução mais recente persistida no KV após o disparo
// do executor via /planner/bridge. Permite observabilidade durável do estado
// da execução sem depender de logs efêmeros do Worker.
//
// NÃO é P14 — não registra aprovações/rejeições, apenas o estado do disparo.
// ============================================================================
async function handleGetExecution(env) {
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({ ok: true, execution: null, note: "KV não disponível neste ambiente." });
  }
  try {
    const trail = await env.ENAVIA_BRAIN.get("execution:trail:latest", "json");

    // PR2 — read real exec_event via readExecEvent (canonical PR1 source)
    let execEvent = null;
    let latestContractId = null;
    try {
      latestContractId = await env.ENAVIA_BRAIN.get("execution:exec_event:latest_contract_id");
      if (latestContractId) {
        execEvent = await readExecEvent(env, latestContractId);
      }
    } catch (evErr) { /* exec_event read failure is non-critical — trail still returned */
      logNV("⚠️ [GET /execution] Falha não-crítica ao ler exec_event (trilha retornada sem ele)", { error: String(evErr) });
    }

    // Macro2-F5 — read real functional logs from KV
    let functionalLogs = [];
    try {
      if (latestContractId) {
        functionalLogs = await readFunctionalLogs(env, latestContractId);
      }
    } catch (flErr) {
      logNV("⚠️ [GET /execution] Falha não-crítica ao ler functional logs", { error: String(flErr) });
    }

    // Merge trail + exec_event into a single execution object
    // Macro2-F5: Surface enriched fields (metrics, executionSummary, result,
    // functionalLogs) at top level so the panel can read them directly.
    // Backward compatible: if exec_event has no enriched fields, these default to null/[].
    let execution = null;
    if (trail || execEvent) {
      execution = { ...(trail ?? {}), ...(execEvent ? { exec_event: execEvent } : {}) };

      // Macro2-F5 — Surface enrichment fields at top level for panel consumption
      if (execEvent) {
        if (execEvent.metrics && !execution.metrics) {
          execution.metrics = execEvent.metrics;
        }
        if (execEvent.executionSummary && !execution.executionSummary) {
          execution.executionSummary = execEvent.executionSummary;
        }
        if (execEvent.result && !execution.result) {
          execution.result = execEvent.result;
        }
        // Map exec_event.status_atual to execution.status for panel compatibility
        if (execEvent.status_atual && !execution.status) {
          const statusMap = { running: "RUNNING", success: "COMPLETED", failed: "FAILED" };
          execution.status = statusMap[execEvent.status_atual] || execEvent.status_atual;
        }
      }

      // Macro2-F5 — Always surface functionalLogs (empty array if none)
      if (!execution.functionalLogs) {
        execution.functionalLogs = functionalLogs.length > 0 ? functionalLogs : [];
      }
    }

    // PR5 — decision:latest como campo aditivo para observabilidade completa
    let latestDecision = null;
    try {
      latestDecision = await env.ENAVIA_BRAIN.get("decision:latest", "json");
    } catch (_) { /* non-critical */ }

    return jsonResponse({ ok: true, execution, latestDecision });
  } catch (err) {
    logNV("🔴 [GET /execution] Falha ao ler trilha do KV", { error: String(err) });
    return jsonResponse({ ok: false, execution: null, error: "Falha ao ler trilha de execução." }, 500);
  }
}

// ============================================================================
// PR3/PR5 — GET /health (handler canônico)
//
// Retorna dados reais mínimos de saúde do sistema Enavia.
// Fontes:
//   - exec_event mais recente (PR1) via readExecEvent
//   - decision:latest (P14) — execuções rejeitadas pelo gate humano
//
// Grupos entregues:
//   - contadores: real mínimo (1 exec_event + decisões P14)
//   - erros recentes: real mínimo (exec_event com status de erro)
//   - bloqueadas: real mínimo (PR5 — decisões P14 com decision=rejected)
//   - concluídas: real mínimo (exec_event com status success)
//   - latestDecision: última decisão P14 registrada (PR5)
//
// Honestidade:
//   - Apenas o ÚLTIMO exec_event está disponível (sem histórico acumulado).
//   - durationMs=null: a fonte PR1 não registra duração da execução.
// ============================================================================
async function handleGetHealth(env) {
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: true,
      health: {
        generatedAt:       new Date().toISOString(),
        status:            "idle",
        summary:           { total: 0, completed: 0, failed: 0, blocked: 0, running: 0 },
        recentErrors:      [],
        blockedExecutions: [],
        recentCompleted:   [],
        latestDecision:    null,
        _limitations:      { blockedExecutions: "derived_from_latest_decision_only" },
        _source:           "no_kv",
      },
    });
  }

  try {
    const latestContractId = await env.ENAVIA_BRAIN.get("execution:exec_event:latest_contract_id");
    let execEvent = null;
    if (latestContractId) {
      execEvent = await readExecEvent(env, latestContractId);
    }

    // PR5 — decision:latest para surfacar execuções bloqueadas pelo gate humano
    let latestDecision = null;
    try {
      latestDecision = await env.ENAVIA_BRAIN.get("decision:latest", "json");
    } catch (_) { /* non-critical */ }

    // PR5 — helper para derivar blockedExecutions de decisão P14 rejeitada
    function buildBlockedFromDecision(dec) {
      if (!dec || dec.decision !== "rejected" || !dec.bridge_id) return [];
      return [{
        id:         `decision-${dec.decision_id}`,
        bridge_id:  dec.bridge_id,
        blockedAt:  dec.decided_at,
        reason:     dec.context ?? "Rejeitada pelo gate humano.",
        decided_by: dec.decided_by,
      }];
    }

    if (!execEvent) {
      // PR5 — mesmo sem exec_event, surfacar dados reais de decisões P14
      const blockedExecutions = buildBlockedFromDecision(latestDecision);
      return jsonResponse({
        ok: true,
        health: {
          generatedAt:       new Date().toISOString(),
          status:            blockedExecutions.length > 0 ? "degraded" : "idle",
          summary:           { total: blockedExecutions.length, completed: 0, failed: 0, blocked: blockedExecutions.length, running: 0 },
          recentErrors:      [],
          blockedExecutions,
          recentCompleted:   [],
          latestDecision,
          _limitations:      { blockedExecutions: "derived_from_latest_decision_only" },
          _source:           "exec_event_absent",
        },
      });
    }

    // Derive health from exec_event (PR1 source: 6 canonical fields)
    const statusAtual = execEvent.status_atual ?? null;
    const op          = execEvent.operacao_atual ?? null;
    const motivo      = execEvent.motivo_curto  ?? null;
    const patch       = execEvent.patch_atual   ?? null;
    const ts          = execEvent.emitted_at    ?? null;

    const isRunning = statusAtual === "running";
    const isSuccess = statusAtual === "success";
    const isError   = !isRunning && !isSuccess && statusAtual !== null;

    // Erros recentes reais mínimos
    const recentErrors = isError ? [
      {
        id:           `exec-event-${latestContractId}`,
        requestLabel: op ?? "Execução",
        errorCode:    "STEP_EXECUTION_ERROR",
        message:      motivo ?? "Erro na execução.",
        failedAt:     ts,
      },
    ] : [];

    // PR5 — Bloqueadas reais: execuções rejeitadas pelo gate humano (P14)
    const blockedExecutions = buildBlockedFromDecision(latestDecision);

    // Concluídas reais mínimas
    const recentCompleted = isSuccess ? [
      {
        id:           `exec-event-${latestContractId}`,
        requestLabel: op ?? "Execução",
        completedAt:  ts,
        durationMs:   null, // não disponível na fonte PR1
        summary:      patch ?? motivo ?? "Execução concluída.",
      },
    ] : [];

    // Contadores reais mínimos (1 exec_event + decisões P14)
    const summary = {
      total:     1 + blockedExecutions.length,
      completed: isSuccess ? 1 : 0,
      failed:    isError   ? 1 : 0,
      blocked:   blockedExecutions.length,
      running:   isRunning ? 1 : 0,
    };

    // Status do sistema
    const status = blockedExecutions.length > 0
      ? "degraded"
      : (isRunning || isSuccess) ? "healthy" : "degraded";

    return jsonResponse({
      ok: true,
      health: {
        generatedAt:       ts ?? new Date().toISOString(),
        status,
        summary,
        recentErrors,
        blockedExecutions,
        recentCompleted,
        latestDecision,
        _limitations:      { blockedExecutions: "derived_from_latest_decision_only" },
        _source:           "exec_event",
      },
    });
  } catch (err) {
    logNV("🔴 [GET /health] Falha ao ler exec_event", { error: String(err) });
    return jsonResponse({ ok: false, error: "Falha ao ler dados de saúde." }, 500);
  }
}

// ============================================================================
// 📝 P14 — POST /execution/decision (handler canônico, Worker-only)
//
// Registra uma decisão humana (approved / rejected) vinculada a uma execução
// COMPROVADA pelo bridge_id retornado de POST /planner/bridge.
//
// CONTRATO ESTRITO:
//   - bridge_id é OBRIGATÓRIO e deve ser string não-vazia.
//   - Rejeição pré-bridge (antes do disparo ao executor) NÃO possui bridge_id
//     canônico → esta rota retorna 422 explicando a ausência; o registro NÃO
//     é persistido como P14 válida.
//   - Somente decisões com vínculo real de execução são gravadas no KV.
//
// KV keys:
//   decision:{decision_id}             — registro individual
//   decision:by_bridge:{bridge_id}     — lista de decisões por execução
//   decision:latest                    — última decisão registrada (com bridge)
//
// Shape da decisão:
//   { decision_id, decision, bridge_id, decided_at, decided_by, context }
// ============================================================================
async function handlePostDecision(request, env) {
  const startedAt = Date.now();

  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: false,
      error: "KV não disponível — impossível persistir decisão.",
      timestamp: Date.now(),
    }, 503);
  }

  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: "JSON inválido em /execution/decision.",
      detail: String(err),
      timestamp: Date.now(),
    }, 400);
  }

  if (!body || typeof body !== "object") body = {};

  // Validate decision field
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return jsonResponse({
      ok: false,
      error: "Campo 'decision' obrigatório — valores aceitos: 'approved', 'rejected'.",
      timestamp: Date.now(),
    }, 400);
  }

  // REGRA DURA: bridge_id canônico é OBRIGATÓRIO.
  // Rejeições pré-bridge não possuem bridge_id → não são P14 válidas.
  const bridgeId = typeof body.bridge_id === "string" && body.bridge_id.trim().length > 0
    ? body.bridge_id.trim()
    : null;

  if (!bridgeId) {
    logNV("⚠️ [P14/DECISION] bridge_id ausente — decisão NÃO persistida (sem vínculo canônico de execução)", {
      decision,
    });
    return jsonResponse({
      ok: false,
      p14_valid: false,
      error: "bridge_id ausente ou nulo — esta decisão não pode ser vinculada a uma execução canônica.",
      diagnostic: [
        "bridge_id é o identificador canônico de execução neste worker.",
        "Ele só existe após POST /planner/bridge disparar o plano ao executor.",
        "Rejeições pré-bridge (antes do disparo) não possuem bridge_id.",
        "Por contrato, P14 só registra decisões com vínculo canônico de execução comprovado.",
        "Esta rejeição pré-bridge NÃO é persistida como registro P14 válido.",
      ],
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 422);
  }

  const decisionId = safeId("decision");
  const now = new Date().toISOString();

  const record = {
    decision_id: decisionId,
    decision: decision,
    bridge_id: bridgeId,
    decided_at: now,
    decided_by: typeof body.decided_by === "string" && body.decided_by.trim().length > 0
      ? body.decided_by.trim()
      : "human",
    context: typeof body.context === "string" && body.context.trim().length > 0
      ? body.context.trim()
      : null,
  };

  logNV("📝 [P14/DECISION] Registrando decisão com vínculo canônico", {
    decisionId,
    decision,
    bridgeId,
  });

  try {
    // 1) Registro individual
    await env.ENAVIA_BRAIN.put(`decision:${decisionId}`, JSON.stringify(record));

    // 2) Última decisão vinculada a execução canônica
    await env.ENAVIA_BRAIN.put("decision:latest", JSON.stringify(record));

    // 3) Lista por bridge_id (identificador canônico de execução)
    // Nota: Cloudflare KV não suporta operações atômicas. Em caso de escrita
    // concorrente com o mesmo bridge_id, a última operação prevalece (last-write-wins).
    // Para P14, o padrão aceitável é fire-and-forget do caller — a concorrência de
    // decisões sobre a mesma execução é improvável no fluxo de gate humano.
    const listKey = `decision:by_bridge:${bridgeId}`;
    let existing = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get(listKey, "json");
      if (Array.isArray(raw)) existing = raw;
    } catch (readErr) {
      logNV("⚠️ [P14/DECISION] Falha ao ler lista existente (não crítico, tratando como vazia)", {
        bridgeId, error: String(readErr),
      });
    }
    existing.push(record);
    await env.ENAVIA_BRAIN.put(listKey, JSON.stringify(existing));

    logNV("✅ [P14/DECISION] Decisão persistida com vínculo canônico", { decisionId, bridgeId });

    return jsonResponse({
      ok: true,
      p14_valid: true,
      decision: record,
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    });
  } catch (err) {
    logNV("🔴 [P14/DECISION] Falha ao persistir decisão no KV", {
      decisionId,
      error: String(err),
    });
    return jsonResponse({
      ok: false,
      error: "Falha ao persistir decisão no KV.",
      detail: String(err),
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt },
    }, 500);
  }
}

// ============================================================================
// 📖 P14 — GET /execution/decisions (handler canônico, Worker-only)
//
// Leitura do histórico de decisões persistidas com vínculo canônico.
//
// Query params:
//   ?bridge_id=xxx  — obrigatório para filtrar decisões de uma execução real
//
// Sem bridge_id: retorna 400 com diagnóstico explicando que este parâmetro é
// o identificador canônico de execução neste worker.
// ============================================================================
async function handleGetDecisions(env, request) {
  const url = new URL(request.url);
  const bridgeId = url.searchParams.get("bridge_id");

  if (!bridgeId || bridgeId.trim().length === 0) {
    return jsonResponse({
      ok: false,
      error: "Parâmetro ?bridge_id=xxx é obrigatório.",
      diagnostic: [
        "bridge_id é o identificador canônico de execução neste worker.",
        "Ele é gerado por POST /planner/bridge e retornado no campo bridge_id da resposta.",
        "Use ?bridge_id=<valor> para consultar o histórico de decisões de uma execução específica.",
      ],
      timestamp: Date.now(),
    }, 400);
  }

  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({ ok: true, bridge_id: bridgeId, decisions: [], note: "KV não disponível neste ambiente." });
  }

  try {
    const listKey = `decision:by_bridge:${bridgeId.trim()}`;
    const decisions = await env.ENAVIA_BRAIN.get(listKey, "json");
    return jsonResponse({
      ok: true,
      bridge_id: bridgeId.trim(),
      decisions: Array.isArray(decisions) ? decisions : [],
    });
  } catch (err) {
    logNV("🔴 [GET /execution/decisions] Falha ao ler decisões do KV", { error: String(err) });
    return jsonResponse({ ok: false, decisions: [], error: "Falha ao ler histórico de decisões." }, 500);
  }
}

// ============================================================================
// 🧪 PR71 — POST /skills/propose (proposal-only, read-only)
// Reutiliza buildSkillExecutionProposal sem executar skill e sem side effects.
// ============================================================================
async function handleSkillsPropose(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "JSON inválido em /skills/propose.",
        detail: String(err),
        skill_execution: {
          mode: "proposal",
          status: "blocked",
          skill_id: null,
          reason: "JSON inválido; proposta bloqueada.",
          requires_approval: false,
          side_effects: false,
        },
      },
      400
    );
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const proposal = buildSkillExecutionProposal({
    skillRouting: input.skillRouting,
    intentClassification: input.intentClassification,
    selfAudit: input.selfAudit,
    responsePolicy: input.responsePolicy,
    chatContext: input.chatContext,
  });
  const gate = registerSkillProposal(proposal.skill_execution);

  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/propose",
      proposal_id: gate.proposal_id,
      proposal_status: gate.status,
      side_effects: false,
      executed: false,
      skill_execution: proposal.skill_execution,
    },
    200
  );
}

function _blockedSkillGateResponse(route, code, message, detail) {
  return jsonResponse(
    {
      ok: false,
      error: code,
      message,
      detail: detail || null,
      route,
      side_effects: false,
      executed: false,
      proposal_status: "blocked",
      skill_execution: {
        mode: "proposal",
        status: "blocked",
        skill_id: null,
        reason: message,
        requires_approval: false,
        side_effects: false,
      },
    },
    code === "INVALID_JSON" ? 400 : 409
  );
}

async function handleSkillsApprove(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillGateResponse(
      "POST /skills/approve",
      "INVALID_JSON",
      "JSON inválido em /skills/approve.",
      String(err),
    );
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const result = approveSkillProposal(input);
  const route = "POST /skills/approve";
  const blocked = result.ok !== true;
  const proposal = result.proposal || null;

  return jsonResponse(
    {
      ok: !blocked,
      route,
      proposal_id: result.proposal_id || null,
      proposal_status: result.status,
      side_effects: false,
      executed: false,
      ...(blocked ? { error: "APPROVAL_BLOCKED", message: result.reason || "Approval bloqueado." } : {}),
      skill_execution: {
        mode: "proposal",
        status: result.status,
        skill_id: proposal?.skill_id || null,
        reason: result.reason || proposal?.reason || "Approval processado.",
        requires_approval: false,
        side_effects: false,
      },
    },
    blocked ? 409 : 200
  );
}

async function handleSkillsReject(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillGateResponse(
      "POST /skills/reject",
      "INVALID_JSON",
      "JSON inválido em /skills/reject.",
      String(err),
    );
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const result = rejectSkillProposal(input);
  const route = "POST /skills/reject";
  const blocked = result.ok !== true;
  const proposal = result.proposal || null;

  return jsonResponse(
    {
      ok: !blocked,
      route,
      proposal_id: result.proposal_id || null,
      proposal_status: result.status,
      side_effects: false,
      executed: false,
      ...(blocked ? { error: "REJECT_BLOCKED", message: result.reason || "Reject bloqueado." } : {}),
      skill_execution: {
        mode: "proposal",
        status: result.status,
        skill_id: proposal?.skill_id || null,
        reason: result.reason || proposal?.reason || "Reject processado.",
        requires_approval: false,
        side_effects: false,
      },
    },
    blocked ? 409 : 200
  );
}

function _blockedSkillFactoryResponse(route, code, message, detail, status = 409) {
  return jsonResponse(
    {
      ok: false,
      route,
      error: code,
      message,
      detail: detail || null,
      side_effects: false,
      executed: false,
      prepared: false,
    },
    status,
  );
}

async function handleSkillFactorySpec(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/spec",
      "INVALID_JSON",
      "JSON inválido em /skills/factory/spec.",
      String(err),
      400,
    );
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const skillSpec = buildSkillSpec(input);
  const validation = validateSkillSpec(skillSpec);

  if (!validation.ok) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/spec",
      "INVALID_SKILL_SPEC",
      "Falha ao validar skill_spec gerada.",
      validation.errors,
      422,
    );
  }

  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/factory/spec",
      side_effects: false,
      executed: false,
      prepared: false,
      skill_spec: skillSpec,
    },
    200,
  );
}

async function handleSkillFactoryCreate(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "INVALID_JSON",
      "JSON inválido em /skills/factory/create.",
      String(err),
      400,
    );
  }

  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const skillSpecSource =
    input.skill_spec && typeof input.skill_spec === "object" && !Array.isArray(input.skill_spec)
      ? input.skill_spec
      : buildSkillSpec(input);

  const validation = validateSkillSpec(skillSpecSource);
  if (!validation.ok) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "INVALID_SKILL_SPEC",
      "Skill spec inválida para preparação de pacote.",
      validation.errors,
      422,
    );
  }

  if (input.approved_to_prepare_package !== true || typeof input.human_authorization_text !== "string" || input.human_authorization_text.trim().length === 0) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "AUTHORIZATION_REQUIRED",
      "approved_to_prepare_package=true e human_authorization_text são obrigatórios.",
      null,
      403,
    );
  }

  const packageResult = buildSkillCreationPackage(skillSpecSource, {
    approved_to_prepare_package: true,
    human_authorization_text: input.human_authorization_text,
  });

  if (!packageResult.ok) {
    const statusCode = packageResult.error === "SKILL_SPEC_BLOCKED" ? 409 : 422;
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      packageResult.error || "SKILL_FACTORY_CREATE_BLOCKED",
      "Pacote de criação bloqueado.",
      packageResult.detail || null,
      statusCode,
    );
  }

  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/factory/create",
      side_effects: false,
      executed: false,
      prepared: true,
      skill_spec: skillSpecSource,
      skill_creation_package: packageResult.skill_creation_package,
    },
    200,
  );
}

export default {
  async fetch(request, env, ctx) {

// ==============================
// 🌐 CORS — PRE-FLIGHT (CANÔNICO)
// ==============================
if (request.method === "OPTIONS") {
  return handleCORSPreflight(request);
}

// ============================================================================
// 🔴 PRIORIDADE ABSOLUTA — DIRECTOR COGNITIVE (CSP SAFE)
// Deve rodar ANTES de qualquer parser, brain, engineer ou fallback
// ============================================================================
if (request.method === "POST") {
  const url = new URL(request.url);
  if (url.pathname === "/director/cognitive") {
    const response = await handleDirectorCognitiveProxy(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 💬 CHAT LLM-FIRST — POST /chat/run
// Conversa livre LLM-first para a aba Chat do painel.
// Planner disponível como ferramenta interna, não como superfície.
// ============================================================
if (request.method === "POST") {
  const url = new URL(request.url);
  if (url.pathname === "/chat/run") {
    const response = await handleChatLLM(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 🧠 PLANNER RUN — POST /planner/run
// Pipeline estruturado PM4→PM9 (classificação → plano → gate → bridge → memória)
// ============================================================
if (request.method === "POST") {
  const url = new URL(request.url);
  if (url.pathname === "/planner/run") {
    const response = await handlePlannerRun(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 🌉 PLANNER BRIDGE — POST /planner/bridge (P12)
// Ponte real: painel envia bridge payload após aprovação do gate
// ============================================================
if (request.method === "POST") {
  const url = new URL(request.url);
  if (url.pathname === "/planner/bridge") {
    const response = await handlePlannerBridge(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 📋 P13 — GET /execution
// Retorna trilha de execução mais recente persistida no KV.
// Usado pelo painel (ExecutionPage) em modo real para observar
// o estado do disparo ao executor sem depender de logs efêmeros.
// ============================================================
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/execution") {
    const response = await handleGetExecution(env);
    return withCORS(response);
  }
}

// ============================================================
// 📝 P14 — POST /execution/decision
// Registra decisão humana vinculada a execução canônica (bridge_id).
// bridge_id obrigatório; rejeições pré-bridge retornam 422.
// ============================================================
if (request.method === "POST") {
  const url = new URL(request.url);
  if (url.pathname === "/execution/decision") {
    const response = await handlePostDecision(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 📖 P14 — GET /execution/decisions
// Leitura canônica do histórico de decisões por execução.
// Requer ?bridge_id=xxx (identificador canônico do disparo).
// ============================================================
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/execution/decisions") {
    const response = await handleGetDecisions(env, request);
    return withCORS(response);
  }
}

// ============================================================
// PR3 — GET /health
// Retorna dados reais mínimos de saúde da Enavia.
// Fonte: exec_event (PR1) via readExecEvent.
// ============================================================
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/health") {
    const response = await handleGetHealth(env);
    return withCORS(response);
  }
}

// GET /chat/run → Schema/contrato da rota (smoke de conectividade)
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/chat/run") {
    return withCORS(jsonResponse({
      ok: true,
      route: "POST /chat/run",
      description: "Chat LLM-first — conversa livre com planner como ferramenta interna.",
      schema: {
        request: {
          message: "string (obrigatório) — texto do usuário",
          session_id: "string (opcional) — ID de sessão",
          context: "object (opcional) — contexto estrutural",
          conversation_history: "array (opcional) — histórico recente [{role:'user'|'assistant', content:string}], max 20 msgs / 4000 chars",
        },
        response: {
          ok: "boolean",
          system: "string — 'ENAVIA-NV-FIRST'",
          mode: "string — 'llm-first'",
          reply: "string — resposta livre do LLM",
          planner_used: "boolean — se o planner foi acionado internamente",
          planner: "object (opcional) — snapshot do planner quando acionado",
          timestamp: "number — epoch ms",
          input: "string — texto do usuário (echo)",
          telemetry: {
            duration_ms: "number",
            session_id: "string | null",
            pipeline: "string — 'LLM-only' ou 'LLM + PM4→PM9'",
            continuity_active: "boolean — true se conversation_history foi injetado no contexto LLM (PR7)",
            conversation_history_length: "number — quantidade de mensagens de histórico injetadas",
            llm_parse_mode: "string — 'json_parsed' | 'plain_text_fallback' | 'unknown' — se o LLM retornou JSON estruturado ou texto plano (PR7)",
            arbitration: {
              pm4_level: "string — 'A' | 'B' | 'C' (nível PM4 do pedido)",
              pm4_category: "string — 'simple' | 'tactical' | 'complex'",
              pm4_signals: "string[] — sinais detectados pelo PM4",
              pm4_allows_planner: "boolean — PM4 é autoritativo: false bloqueia (A), true força (B/C)",
              llm_requested_planner: "boolean — LLM retornou use_planner=true (advisory only)",
              final_decision: "string — 'planner_activated' | 'planner_forced_level_BC' | 'planner_blocked_level_A'",
              reply_sanitized: "string (opcional) — 'manual_plan_replaced' se manual plan leak (layer-2) detectado",
              reply_sanitized_layer1: "string (opcional) — 'mechanical_term_leak_replaced' se leak de termos mecânicos (layer-1) detectado (PR7)",
            },
            gate_summary: "object (opcional) — resumo do gate quando planner rodou: { gate_status, needs_human_approval, can_proceed } (PR7)",
            planner_error: "string (opcional) — erro interno do planner quando forçado (Level B/C) mas falhou (PR7)",
            operational_awareness: {
              browser_status: "string — estado do browser arm",
              browser_can_act: "boolean",
              executor_configured: "boolean",
              approval_mode: "string",
              human_gate_active: "boolean",
            },
          },
        },
      },
    }));
  }
}

// GET /planner/run → Schema/contrato da rota (smoke de conectividade)
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/planner/run") {
    return withCORS(jsonResponse({
      ok: true,
      route: "POST /planner/run",
      description: "Planner endpoint canônico — executa pipeline PM4→PM9 e retorna payload estruturado.",
      schema: {
        request: {
          message: "string (obrigatório) — texto do usuário",
          session_id: "string (opcional) — ID de sessão",
          context: "object (opcional) — contexto estrutural: { known_dependencies, mentions_prod, is_urgent }",
        },
        response: {
          ok: "boolean",
          system: "string — 'ENAVIA-NV-FIRST'",
          timestamp: "number — epoch ms",
          input: "string — texto do usuário (echo)",
          planner: {
            classification: "PM4 — classifyRequest output",
            canonicalPlan: "PM6 — buildCanonicalPlan output",
            gate: "PM7 — evaluateApprovalGate output",
            bridge: "PM8 — buildExecutorBridgePayload output",
            memoryConsolidation: "PM9 — consolidateMemoryLearning output",
            outputMode: "string — quick_reply | tactical_plan | formal_contract",
          },
          telemetry: {
            duration_ms: "number",
            session_id: "string | null",
            pipeline: "string — 'PM4→PM5→PM6→PM7→PM8→PM9→P15'",
            consolidation_persisted: "array — [{memory_id, memory_type, is_canonical, kv_key, write_ok, error?}]",
          },
        },
      },
    }));
  }
}

// GET /planner/latest?session_id=... — Retorna o último plano gerado para a sessão
if (request.method === "GET") {
  const url = new URL(request.url);
  if (url.pathname === "/planner/latest") {
    const response = await handlePlannerLatest(request, env);
    return withCORS(response);
  }
}

// ============================================================
// 🌐 BROWSER EXECUTOR — POST /browser/run
// (executor lógico — browser físico roda fora)
// ============================================================
if (request.method === "POST") {
  const url = new URL(request.url);

  if (url.pathname === "/browser/run" || url.pathname === "/browser/execute") {
    // 🛡️ GUARD ANTI-REENTRADA — impede loop se BROWSER_EXECUTOR_URL apontar para o próprio worker
    if (request.headers.get("X-NV-Browser-Source") === "enavia-worker") {
      logNV("🔴 [BROWSER/RUN] reentrada detectada — abortando loop");
      return withCORS(
        jsonResponse(
          { ok: false, error: "Loop detectado: request já veio do próprio worker" },
          508
        )
      );
    }
    try {
      const body = await request.json().catch(() => ({}));

// normalização mínima para compatibilidade com /execute
if (!body.plan && body.version === "plan.v1" && Array.isArray(body.steps)) {
  body.plan = { version: body.version, steps: body.steps };
}

// ============================================================
// 🔧 NORMALIZAÇÃO CANÔNICA — BROWSER /run
// ============================================================

// força formato esperado pelo Browser Executor
if (body && typeof body === "object" && body.plan && Array.isArray(body.plan.steps)) {
  const execId =
    body.execution_id ||
    body.plan.execution_id ||
    `browser-${Date.now()}`;

  body.executor_action = "run_browser_plan";
  body.execution_id = execId;

  body.plan = {
    execution_id: execId,
    version: body.plan.version || "plan.v1",
    source: body.plan.source || "director",
    type: body.plan.type || "approved",
    steps: body.plan.steps,
  };

  body.meta = {
    ...(body.meta || {}),
    source: "NV-CONTROL",
    channel: "BROWSER",
    ts: Date.now(),
  };
}

      if (!body?.plan?.steps || !Array.isArray(body.plan.steps)) {
        return withCORS(
          jsonResponse(
            { ok: false, error: "Plano inválido" },
            400
          )
        );
      }

      // 🔁 CHAMADA AO EXECUTOR FÍSICO (DigitalOcean)
      const executorUrl = env.BROWSER_EXECUTOR_URL;

      if (!executorUrl) {
        return withCORS(
          jsonResponse(
            { ok: false, error: "BROWSER_EXECUTOR_URL não configurado" },
            500
          )
        );
      }

      logNV("🌐 [BROWSER/RUN] forwarding to executor", {
        executorUrl,
        hasPlan: !!body.plan,
        steps: body.plan?.steps?.length || 0,
      });

      const executorPayload = {
        plan: body.plan
      };
      
      const execRes = await fetch(executorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NV-Browser-Source": "enavia-worker",
        },
        body: JSON.stringify(executorPayload),
      });

      const raw = await execRes.text();
      let parsed;
      try { parsed = JSON.parse(raw); } catch { parsed = { raw }; }

      return withCORS(
        jsonResponse(
          {
            ok: execRes.ok,
            execution_id: body.execution_id || null,
            result: parsed,
          },
          execRes.status
        )
      );

    } catch (err) {
      return withCORS(
        jsonResponse(
          { ok: false, error: String(err) },
          500
        )
      );
    }
  }
}

// ============================================================
// 🌐 BROWSER TEST — POST /browser-test
// Gera um plan.v1 simples e manda direto para o Browser Executor
// ============================================================
if (request.method === "POST") {
  const urlObj = new URL(request.url);

  if (urlObj.pathname === "/browser-test") {
    // 🛡️ GUARD ANTI-REENTRADA — impede loop se BROWSER_EXECUTOR_URL apontar para o próprio worker
    if (request.headers.get("X-NV-Browser-Source") === "enavia-worker") {
      logNV("🔴 [BROWSER/TEST] reentrada detectada — abortando loop");
      return withCORS(
        jsonResponse(
          { ok: false, error: "Loop detectado: request já veio do próprio worker" },
          508
        )
      );
    }
    try {
      const body = await request.json().catch(() => ({}));

      const targetUrl =
        (body && typeof body.url === "string" && body.url.trim()) ||
        "https://google.com";

      const msRaw = Number(body?.ms ?? 5000);
      const waitMs = Number.isFinite(msRaw) && msRaw > 0 ? msRaw : 5000;

      const execId =
        body?.execution_id ||
        `browser-test-${Date.now()}`;

      const plan = {
        execution_id: execId,
        version: "plan.v1",
        source: "nv-first",
        type: "smoke",
        steps: [
          { type: "open", url: targetUrl },
          { type: "wait", ms: waitMs }
        ],
      };

      const executorUrl = env.BROWSER_EXECUTOR_URL;

      if (!executorUrl) {
        return withCORS(
          jsonResponse(
            { ok: false, error: "BROWSER_EXECUTOR_URL não configurado" },
            500
          )
        );
      }

      logNV("🌐 [BROWSER/TEST] smoke externo", {
        executorUrl,
        execution_id: execId,
        url: targetUrl,
        waitMs,
      });

      const execRes = await fetch(executorUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-NV-Browser-Source": "enavia-worker",
        },
        body: JSON.stringify({ plan }),
      });

      const raw = await execRes.text();
      let parsed;
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = { raw };
      }

      return withCORS(
        jsonResponse(
          {
            ok: execRes.ok,
            execution_id: execId,
            result: parsed,
          },
          execRes.status
        )
      );
    } catch (err) {
      return withCORS(
        jsonResponse(
          { ok: false, error: String(err) },
          500
        )
      );
    }
  }
}

    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;

        // ============================================================
    // 🔎 INTERNAL — BUILD INFO (PROVA DE DEPLOY)
    // ============================================================
    if (method === "GET" && path === "/__internal__/build") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      const envName = (env.SUPABASE_BUCKET || "").toLowerCase().includes("test") ? "TEST" : "PROD";
      const workerName = envName === "TEST" ? "enavia-worker-teste" : "nv-enavia";
      return new Response(
        JSON.stringify(
          {
            ok: true,
            worker: workerName,
            env: envName,
            build: ENAVIA_BUILD,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

// ============================================================
// 👁️ ENAVIA OBSERVER — READ ONLY
// POST /enavia/observe
// ============================================================
if (method === "POST" && path === "/enavia/observe") {
  return handleEnaviaObserve(request, env);
}

// PR71 — /skills/propose (proposal-only)
if (path === "/skills/propose") {
  if (method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST em /skills/propose.",
        method,
        path,
        allowed_methods: ["POST"],
      },
      405
    );
  }
  return handleSkillsPropose(request);
}

if (path === "/skills/approve") {
  if (method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST em /skills/approve.",
        method,
        path,
        allowed_methods: ["POST"],
      },
      405
    );
  }
  return handleSkillsApprove(request);
}

if (path === "/skills/reject") {
  if (method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST em /skills/reject.",
        method,
        path,
        allowed_methods: ["POST"],
      },
      405
    );
  }
  return handleSkillsReject(request);
}

if (path === "/skills/factory/spec") {
  if (method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST em /skills/factory/spec.",
        method,
        path,
        allowed_methods: ["POST"],
      },
      405
    );
  }
  return handleSkillFactorySpec(request);
}

if (path === "/skills/factory/create") {
  if (method !== "POST") {
    return jsonResponse(
      {
        ok: false,
        error: "METHOD_NOT_ALLOWED",
        message: "Use POST em /skills/factory/create.",
        method,
        path,
        allowed_methods: ["POST"],
      },
      405
    );
  }
  return handleSkillFactoryCreate(request);
}

  // 🧠 ENAVIA — PROPOSE ENDPOINT (DEPENDE DE AUDIT)
  // POST /propose
  // - Não mistura com /audit
  // - Read-only
  // - Depende de carimbo de AUDIT no Deploy Worker (mesmo execution_id)
  if (method === "POST" && path === "/propose") {
    const startedAt = Date.now();
  
    let body;
    try {
      body = await request.json();
    } catch (err) {
      return withCORS(
        errorResponse("JSON inválido em /propose.", 400, { detail: String(err) })
      );
    }
  
    if (!body || typeof body !== "object") body = {};
  
    const execution_id = String(body.execution_id || `ex_${Date.now()}`);
  
    // ✅ CONTRATO: /propose é opcional e NÃO depende de AUDIT.
    // ✅ CONTRATO: /propose NÃO carimba e NÃO grava nada no Deploy Worker.
    // (Se um dia quiser "require_audit", isso deve ser flag explícita, não comportamento padrão.)
  
    // normaliza inputs
    const target = body?.target || {};
    const workerId = String(target?.workerId || body?.workerId || "").trim();
  
    const patchObj = body?.patch || null;
    const patchText =
      patchObj && typeof patchObj === "object" && typeof patchObj.content === "string"
        ? patchObj.content
        : typeof patchObj === "string"
        ? patchObj
        : "";
  
    const prompt =
      (typeof body?.prompt === "string" && body.prompt.trim())
        ? body.prompt.trim()
        : (typeof body?.intent === "string" && body.intent.trim())
        ? body.intent.trim()
        : "Gere 1–2 sugestões LOW-RISK para melhorar logs/clareza, sem mudar comportamento nem quebrar rotas.";

    const incomingConstraints =
      body?.constraints && typeof body.constraints === "object" ? body.constraints : {};

    // ✅ preserva contrato: read_only/no_auto_apply sempre true, mas repassa flags extras (ex: debug_snapshot)
    const constraints = { ...incomingConstraints, read_only: true, no_auto_apply: true };
  
    // chama o EXECUTOR para propose (se não suportar, vira diagnóstico objetivo)
    const execPayload = {
      execution_id,
      executor_action: "propose",
      mode: "enavia_propose",
      source: body?.source || "ps_propose",
      ask_suggestions: typeof body?.ask_suggestions === "boolean" ? body.ask_suggestions : true,
      generatePatch: true,
      constraints,
    
      // ✅ NOVO: não trava nada, só habilita cognição no Executor quando você pedir
      intent: body?.intent || "propose",
      context: body?.context || undefined,
    
      target: workerId ? { system: "cloudflare_worker", workerId } : undefined,
      patch: patchText ? { type: "patch_text", content: patchText } : undefined,
      prompt,
    };
  
    let execRes, execStatus, execText, execJson;
    try {
      execRes = await env.EXECUTOR.fetch("https://enavia-executor.internal/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(execPayload),
      });
      execStatus = execRes.status;
      execText = await execRes.text();
      try {
        execJson = JSON.parse(execText);
      } catch {
        execJson = null;
      }
    } catch (err) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            execution_id,
            error: "Falha ao chamar EXECUTOR para propose.",
            detail: String(err),
          },
          502
        )
      );
    }
  
    const ok = execStatus >= 200 && execStatus < 300;
  
    return withCORS(
      jsonResponse(
        {
          ok,
          execution_id,
          duration_ms: Date.now() - startedAt,
          executor: { status: execStatus, ok },
          propose: execJson || { raw: execText },
          next_actions: [
            "Se quiser avançar no pipeline: rode POST /audit com o MESMO execution_id (e o patch que você escolher).",
            "Somente o /audit carimba no Deploy Worker."
          ],
        },
        ok ? 200 : 502
      )
    );
  }

// ============================================================
// 📋 GET /audit — Schema/contrato da rota (smoke de conectividade)
// Não executa nada. Útil para validar que a rota está ativa.
// ============================================================
if (method === "GET" && path === "/audit") {
  return jsonResponse({
    ok: true,
    route: "POST /audit",
    description: "Audit endpoint canônico (read-only, não aplica nada). Envia para EXECUTOR + carimba no DEPLOY_WORKER.",
    schema: {
      execution_id: "string (obrigatório)",
      mode: '"enavia_audit" (obrigatório, literal)',
      source: "string (obrigatório)",
      target: {
        system: "string (obrigatório)",
        workerId: "string (obrigatório)"
      },
      patch: {
        type: '"patch_text" (obrigatório, literal)',
        content: "string (obrigatório, conteúdo do patch)"
      },
      constraints: {
        read_only: "true (obrigatório)",
        no_auto_apply: "true (obrigatório)"
      }
    },
    smoke_example: {
      execution_id: "smoke-test-001",
      mode: "enavia_audit",
      source: "smoke-test",
      target: { system: "enavia", workerId: "enavia-worker-teste" },
      patch: { type: "patch_text", content: "// smoke test patch" },
      constraints: { read_only: true, no_auto_apply: true }
    },
    timestamp: new Date().toISOString()
  }, 200);
}

// ============================================================
// 🧠 ENAVIA — AUDIT ENDPOINT (READ-ONLY, CANÔNICO v1)
// POST /audit
// ============================================================
if (method === "POST" && path === "/audit") {
  const startedAt = Date.now();

  const rawText = await request.text().catch(() => "");
  let body = {};
  try {
    body = rawText ? JSON.parse(rawText) : {};
  } catch (_) {
    return jsonResponse(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "Body não é JSON válido.",
      },
      400
    );
  }

// ============================================================
// 🧠 PROPOSE — bloqueio de "propose no escuro"
// Regra: propose pode ser read-only, mas NÃO pode ser sem target.
// (senão vira sugestão vazia e não gera patch auditável)
// ============================================================
const wantsPropose = body?.ask_suggestions === true;

// Se pediu propose, target é obrigatório (não existe “propose no escuro”).
// Mas NÃO pode dar early-exit: o /audit continua rodando normalmente.
if (wantsPropose) {
  const t = body?.target || null;
  const hasTarget = !!(t && t.system && t.workerId);

  if (!hasTarget) {
    return jsonResponse(
      {
        ok: false,
        error: "TARGET_REQUIRED_FOR_PROPOSE",
        execution_id: body?.execution_id || null,
        message: "Para pedir PROPOSE, envie target { system, workerId }.",
      },
      400
    );
  }
}

  // --------- Schema básico (Contrato 4.1) ----------
  const execution_id = body?.execution_id || null;
  const mode = body?.mode || null;
  const source = body?.source || null;
  const target = body?.target || null;
  const patch = body?.patch || null;
  const constraints = body?.constraints || {};

  const readOnly = constraints?.read_only === true;
  const noAutoApply = constraints?.no_auto_apply === true;

  const errors = [];
  if (!execution_id || typeof execution_id !== "string") errors.push("execution_id obrigatório (string).");
  if (mode !== "enavia_audit") errors.push('mode deve ser "enavia_audit".');
  if (!source || typeof source !== "string") errors.push("source obrigatório (string).");
  if (!target || typeof target !== "object") errors.push("target obrigatório (object).");
  if (!target?.system || typeof target.system !== "string") errors.push("target.system obrigatório (string).");
  if (!target?.workerId || typeof target.workerId !== "string") errors.push("target.workerId obrigatório (string).");
  if (!patch || typeof patch !== "object") errors.push("patch obrigatório (object).");
  if (patch?.type !== "patch_text") errors.push('patch.type deve ser "patch_text".');
  if (!patch?.content || typeof patch.content !== "string") errors.push("patch.content obrigatório (string).");
  if (!readOnly) errors.push("constraints.read_only deve ser true (imutável).");
  if (!noAutoApply) errors.push("constraints.no_auto_apply deve ser true (imutável).");

  if (errors.length) {
    return jsonResponse(
      {
        ok: false,
        error: "SCHEMA_VALIDATION_FAILED",
        execution_id,
        details: errors,
      },
      400
    );
  }

  const patchText = patch.content;

  // ✅ evita colisão com startedAt global/externo
  const auditStartedAt = Date.now();

  // --------- Auditoria pesada do PATCH ----------
  const audit = analyzePatchText(patchText);

  // --------- Contexto opcional (para auditoria “worker inteiro”) ----------
  // Se você/painel mandar: body.context.source_snapshot (string com código do worker inteiro),
  // a ENAVIA faz uma leitura adicional de consistência (sem aplicar nada).
  let contextAudit = null;
  const sourceSnapshot =
    typeof body?.context?.source_snapshot === "string" ? body.context.source_snapshot : null;

  if (sourceSnapshot) {
    try {
      contextAudit = analyzeWorkerSnapshot(sourceSnapshot, patchText);
    } catch (err) {
      const snapText = String(sourceSnapshot || "");
      const errMsg = String(err?.message || err || "unknown_error");

      contextAudit = {
        summary: {
          snapshot_chars: snapText.length,
          snapshot_lines: snapText ? snapText.split("\n").length : 0,
        },
        blockers: [],
        findings: [
          `Snapshot analyzer falhou e foi isolado (não deve quebrar /audit): ${errMsg}`,
        ],
        impacted_areas: [],
        recommended_changes: [],
        unknowns: [
          "Falha ao analisar context.source_snapshot; trate como se NÃO houvesse snapshot (sem garantia total).",
        ],
      };
    }
  }

  // ✅ Unknown canônico: só quando NÃO existe snapshot
  if (!sourceSnapshot && Array.isArray(audit?.unknowns)) {
    audit.unknowns.unshift(
      "Compatibilidade total não pode ser garantida sem snapshot do worker alvo (context.source_snapshot)."
    );
  }

  // --------- Veredito canônico ----------
  const blockers = [
    ...audit.blockers,
    ...(contextAudit?.blockers || []),
  ];

  // --------- Veredito canônico (LOCAL, fallback) ----------
  const local_risk_level = calcRiskLevel(audit, contextAudit);
  const local_verdict =
    blockers.length > 0 || local_risk_level === "high" ? "reject" : "approve";

  // defaults = local
  let risk_level = local_risk_level;
  let verdict = local_verdict;

  // --------- NOVO: Ponte audit REAL via EXECUTOR (read-only) ----------
  let executor_audit = null;
  let executor_bridge = null;

  try {
    const canUseExecutorBinding = typeof env?.EXECUTOR?.fetch === "function";

    if (canUseExecutorBinding) {
      const targetWorkerId = String(target?.workerId || "");

      const execPayload = {
        executor_action: "audit",
        constraints: { read_only: true, no_auto_apply: true },
        workerId: targetWorkerId || undefined,
        patch: patchText ? { type: "patch_text", content: patchText } : undefined,
        // ✅ repassa snapshot se existir (melhora prova), mas o executor pode auto-ler também
        context: { execution_id, ...(sourceSnapshot ? { source_snapshot: sourceSnapshot } : {}) },
      };

      const execRes = await env.EXECUTOR.fetch("https://enavia-executor.internal/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(execPayload),
      });

      const execJson = await execRes.json().catch(() => null);

      // suporta os 2 formatos: {ok,...} OU {result:{ok,...}}
      const execOk = execJson?.ok === true || execJson?.result?.ok === true;

      if (execOk) {
        executor_audit = execJson?.result || execJson;

        const execRisk =
          executor_audit?.risk_level ||
          executor_audit?.risk ||
          executor_audit?.riskReport?.level ||
          executor_audit?.riskReport?.risk_level ||
          null;

        if (execRisk === "low" || execRisk === "medium" || execRisk === "high") {
          risk_level = execRisk;
          verdict = execRisk === "high" ? "reject" : "approve";
        }

        executor_bridge = {
          used: true,
          status: execRes.status,
          ok: true,
          auditId: executor_audit?.auditId || executor_audit?.audit_id || null,
          risk_level: risk_level,
        };
      } else {
        executor_bridge = {
          used: true,
          status: execRes.status,
          ok: false,
          error:
            execJson?.error ||
            execJson?.result?.error ||
            "EXECUTOR_AUDIT_FAILED",
        };
      }
    } else {
      executor_bridge = { used: false, error: "NO_EXECUTOR_BINDING" };
    }
  } catch (err) {
    executor_bridge = { used: false, error: String(err) };
  }

  // ============================================================
  // 🛑 CONTRATO CRÍTICO: sem leitura/prova do worker-alvo NÃO audita e NÃO carimba
  // Aceita prova por:
  // - snapshot enviado (sourceSnapshot)
  // - OU prova retornada pelo executor (context_used / context_proof)
  // ============================================================
  const executorContextUsed =
    executor_audit?.context_used === true ||
    executor_audit?.details?.context_used === true ||
    executor_audit?.context?.used === true ||
    false;

  const executorContextProof =
    executor_audit?.context_proof ||
    executor_audit?.details?.context_proof ||
    executor_audit?.context?.proof ||
    null;

  const context_used = Boolean(sourceSnapshot) || Boolean(executorContextUsed) || Boolean(executorContextProof);

  // Se o executor falhou, não tem auditoria “real”
  const executorOk = executor_bridge?.ok === true;

  if (!executorOk) {
    return jsonResponse(
      {
        ok: false,
        error: "AUDIT_EXECUTOR_FAILED",
        execution_id,
        message: "AUDIT bloqueado: executor não conseguiu auditar (sem prova de leitura do alvo). Não carimba.",
        executor_bridge,
        next_actions: ["check_executor", "retry_audit"],
      },
      502
    );
  }

  if (!context_used) {
    return jsonResponse(
      {
        ok: false,
        error: "AUDIT_NO_CONTEXT_PROOF",
        execution_id,
        message:
          "AUDIT bloqueado: sem prova de leitura do worker-alvo (snapshot/prova do executor). Sem leitura não há auditoria válida nem carimbo.",
        next_actions: ["provide_snapshot_or_enable_executor_read", "retry_audit"],
      },
      422
    );
  }

  const findings = [
    ...audit.findings,
    ...(contextAudit?.findings || []),
  ];

  const impacted_areas = uniq([
    ...audit.impacted_areas,
    ...(contextAudit?.impacted_areas || []),
  ]);

  const recommended_changes = [
    ...audit.recommended_changes,
    ...(contextAudit?.recommended_changes || []),
  ];

  const unknowns = uniq([
    ...audit.unknowns,
    ...(contextAudit?.unknowns || []),
  ]);

  const context_proof = sourceSnapshot
    ? {
      snapshot_fingerprint: simpleFingerprint(String(sourceSnapshot)),
        snapshot_chars: String(sourceSnapshot).length,
      }
    : executorContextProof || { via: "executor", note: "executor_provided_proof" };

  // --------- Resposta canônica (4.2) + detalhes ricos ----------
  const response = {
    ok: true,
    execution_id,
    audit: {
      verdict,
      risk_level,
      findings,
      impacted_areas,
      recommended_changes,

      // 👇 feed “cirúrgico” (detalhes)
      details: {
        constraints: {
          read_only: true,
          no_auto_apply: true,
        },
        patch_fingerprint: audit.fingerprint,
        patch_stats: audit.stats,
        patch_hotspots: audit.hotspots,
        patch_dangers: audit.dangers,
        patch_syntax: audit.syntax,
        patch_semantics: audit.semantics,
        blockers,
        unknowns,
        context_used: true,
        context_proof,
        context_summary: contextAudit?.summary || null,
        duration_ms: Date.now() - auditStartedAt,

        // ✅ prova objetiva da ponte com o executor
        executor_bridge,
      },
    },
    next_actions:
      verdict === "approve"
        ? ["human_approve", "send_to_deploy_worker"]
        : ["revise_patch", "re_audit"],
  };

  // ============================================================
  // 🧷 GATING DE CARIMBO (CONTRATO)
  // Só carimba se:
  // - verdict approve
  // - context_used true (já garantido acima)
  // - blockers vazio
  // ============================================================
  const can_stamp_dw =
    verdict === "approve" &&
    Array.isArray(blockers) &&
    blockers.length === 0;

  if (!can_stamp_dw) {
    response.dw_stamp = {
      skipped: true,
      reason: verdict !== "approve" ? "verdict_not_approve" : "blockers_present",
      message: "Carimbo bloqueado pelo contrato: auditoria não aprovada ou blockers presentes.",
      next_actions: ["propose_safe_patch", "re_audit"],
    };
    return jsonResponse(response, 200);
  }

  // ============================================================
  // 🔗 Ponte mecânica: grava o carimbo de AUDIT no deploy-worker
  // (read-only, sem aplicar nada)
  // ============================================================
  try {
    const auditPayload = {
      execution_id,
      audit: {
        ok: verdict === "approve",
        risk_level,
      },
    };

    try {
      const hasDeployBinding = typeof env?.DEPLOY_WORKER?.fetch === "function";

      let dwRes;
      let attemptedUrl;

      if (hasDeployBinding) {
        attemptedUrl = "binding://DEPLOY_WORKER/audit";

        dwRes = await env.DEPLOY_WORKER.fetch("https://deploy-worker.internal/audit", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env?.INTERNAL_TOKEN
              ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) }
              : {}),
          },
          body: JSON.stringify(auditPayload),
        });
      } else {
        const dwBase =
          (env?.DEPLOY_WORKER_URL && String(env.DEPLOY_WORKER_URL)) ||
          "https://deploy-worker.brunovasque.workers.dev";

        attemptedUrl = `${dwBase.replace(/\/+$/, "")}/audit`;

        dwRes = await fetch(attemptedUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env?.INTERNAL_TOKEN
              ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) }
              : {}),
          },
          body: JSON.stringify(auditPayload),
        });
      }

      const dwText = await dwRes.text();

      logNV("✅ [AUDIT->DEPLOY_WORKER] resposta", {
        execution_id,
        status: dwRes.status,
        preview: dwText.slice(0, 300),
      });

      response.dw_stamp = {
        attempted_url: attemptedUrl,
        status: dwRes.status,
        ok: dwRes.ok,
        preview: dwText.slice(0, 300),
      };

      // ✅ Prova objetiva: consulta /status/<execution_id> no deploy-worker
      try {
        let stRes;
        let stAttemptedUrl;

        if (hasDeployBinding) {
          stAttemptedUrl = `binding://DEPLOY_WORKER/status/${execution_id}`;

          stRes = await env.DEPLOY_WORKER.fetch(
            `https://deploy-worker.internal/status/${encodeURIComponent(execution_id)}`,
            {
              method: "GET",
              headers: {
                ...(env?.INTERNAL_TOKEN
                  ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) }
                  : {}),
              },
            }
          );
        } else {
          const dwBase =
            (env?.DEPLOY_WORKER_URL && String(env.DEPLOY_WORKER_URL)) ||
            "https://deploy-worker.brunovasque.workers.dev";

          stAttemptedUrl = `${dwBase.replace(/\/+$/, "")}/status/${encodeURIComponent(execution_id)}`;

          stRes = await fetch(stAttemptedUrl, {
            method: "GET",
            headers: {
              ...(env?.INTERNAL_TOKEN
                ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) }
                : {}),
            },
          });
        }

        const stText = await stRes.text();
        let stJson = null;
        try {
          stJson = JSON.parse(stText);
        } catch (_) {}

        response.dw_status = {
          attempted_url: stAttemptedUrl,
          status: stRes.status,
          ok: stRes.ok,
          data: stJson || null,
          preview: (stText || "").slice(0, 600),
        };
      } catch (err) {
        response.dw_status = {
          attempted_url: `binding://DEPLOY_WORKER/status/${execution_id}`,
          ok: false,
          error: String(err),
        };
      }
    } catch (err) {
      logNV("⚠️ [AUDIT->DEPLOY_WORKER] Falhou ao gravar carimbo", {
        execution_id,
        workerId: target?.workerId,
        err: String(err),
      });

      response.dw_stamp = {
        attempted_url: "binding://DEPLOY_WORKER/audit",
        error: String(err),
      };
    }
  } catch (_) {
    // não quebra o /audit por falha no carimbo
  }

  // ✅ FECHA O /audit
  return jsonResponse(response, 200);
}

// ============================================================
// 🔬 AUDIT ENGINE — Patch analysis (pesado e conservador)
// ============================================================
function analyzePatchText(patchText) {
  const text = String(patchText || "");
  const lines = text.split("\n");
  const chars = text.length;

  const stats = {
    lines: lines.length,
    chars,
    approx_tokens: Math.ceil(chars / 4),
    has_diff_markers: /^(diff --git|@@\s+-\d+,\d+\s+\+\d+,\d+|---\s+|\+\+\+\s+)/m.test(text),
    has_code_fences: /```/.test(text),
  };

  const fingerprint = simpleFingerprint(text);

  // Sintaxe: não dá pra “compilar” JS aqui, mas dá pra fazer checks fortes.
  const syntax = basicSyntaxChecks(text);

  // Perigos: coisas que quase sempre dão merda ou violam contrato.
  const dangers = detectDangers(text);

  // Semântica: intenção (deploy, patch apply, token, KV, bindings, rotas internas etc.)
  const semantics = detectSemantics(text);

  // Hotspots: linhas “quentes” (returns, auth, CORS, internal, env, kv, fetch)
  const hotspots = findHotspots(lines);

  // Blockers = itens que REPROVAM o patch
  const blockers = [];
  if (!syntax.ok) blockers.push("Patch com risco alto de erro de sintaxe/estrutura (checks falharam).");
  if (dangers.includes("LEAK_SECRET")) blockers.push("Patch aparenta vazar segredo/token/chave.");
  if (dangers.includes("AUTO_PROD_DEPLOY")) blockers.push("Patch sugere deploy/ação direta em produção (proibido).");
  if (dangers.includes("EVAL_OR_FUNCTION")) blockers.push("Uso de eval/new Function detectado (alto risco).");
  if (dangers.includes("WILDCARD_DELETE")) blockers.push("Ação destrutiva ampla (delete/flush) detectada.");

  // Findings = lista objetiva do que foi encontrado
  const findings = [];
  if (stats.has_diff_markers) findings.push("Patch parece estar em formato diff (ok).");
  if (stats.has_code_fences) findings.push("Patch contém code fences (cuidado com copiar bloco incompleto).");
  if (semantics.includes("ROUTING_CHANGE")) findings.push("Patch altera roteamento/rotas.");
  if (semantics.includes("CORS_CHANGE")) findings.push("Patch mexe em CORS/preflight.");
  if (semantics.includes("AUTH_CHANGE")) findings.push("Patch mexe em autorização/token.");
  if (semantics.includes("KV_CHANGE")) findings.push("Patch mexe em KV/estado.");
  if (semantics.includes("BINDING_CHANGE")) findings.push("Patch mexe em Service Binding/env.");
  if (semantics.includes("FETCH_CHANGE")) findings.push("Patch mexe em fetch/chamadas internas.");

  // Impacted areas = tags de impacto (para você bater o olho)
  const impacted_areas = [];
  if (semantics.includes("ROUTING_CHANGE")) impacted_areas.push("routing");
  if (semantics.includes("CORS_CHANGE")) impacted_areas.push("cors");
  if (semantics.includes("AUTH_CHANGE")) impacted_areas.push("auth");
  if (semantics.includes("KV_CHANGE")) impacted_areas.push("kv");
  if (semantics.includes("BINDING_CHANGE")) impacted_areas.push("bindings");
  if (semantics.includes("FETCH_CHANGE")) impacted_areas.push("networking");
  if (semantics.includes("INTERNAL_ROUTES")) impacted_areas.push("internal_handshake");

  // Recomendações cirúrgicas
  const recommended_changes = [];
  if (stats.has_code_fences) recommended_changes.push("Remover ``` do patch antes de aplicar (evita colar artefato).");
  if (!syntax.ok) recommended_changes.push("Revisar chaves/parenteses/quotes e garantir bloco completo antes de aplicar.");
  if (semantics.includes("ROUTING_CHANGE")) recommended_changes.push("Garantir que rotas __internal__ sejam PRIMEIRO return.");
  if (semantics.includes("FETCH_CHANGE")) recommended_changes.push("Preferir Service Binding (env.<BINDING>.fetch) ao invés de URL pública.");

  // Unknowns: limitações sem acesso ao worker inteiro
  const unknowns = [];
  unknowns.push("Efeitos colaterais em runtime só podem ser confirmados em TEST com PATCH_STATUS=tested.");

  return {
    fingerprint,
    stats,
    syntax,
    dangers,
    semantics,
    hotspots,
    blockers,
    findings,
    impacted_areas,
    recommended_changes,
    unknowns,
  };
}

function analyzeWorkerSnapshot(workerText, patchText) {
  const w = String(workerText || "");
  const findings = [];
  const blockers = [];
  const impacted_areas = [];
  const recommended_changes = [];
  const unknowns = [];

  // Checks estruturais do worker
  const hasFetchExport = /export\s+default\s*\{\s*async\s+fetch\s*\(/.test(w);
  if (!hasFetchExport) findings.push("Snapshot: padrão export default { async fetch(...) } não detectado (pode ser outro estilo).");

  const hasInternalNormalize = /normalizeInternalPath\s*\(/.test(w);
  if (!hasInternalNormalize) findings.push("Snapshot: normalizeInternalPath não encontrado (rotas internas podem não existir).");

  // Ordem: __internal__ antes de CORS?
  const idxInternal = w.indexOf("/__internal__/");
  const idxCors = w.toLowerCase().indexOf("cors");
  if (idxInternal >= 0 && idxCors >= 0 && idxInternal > idxCors) {
    blockers.push("Snapshot: lógica __internal__ aparenta estar depois do CORS/roteamento (risco de não ser alcançada).");
    impacted_areas.push("internal_handshake");
    impacted_areas.push("cors");
    recommended_changes.push("Mover bloco __internal__ para PRIMEIRO return dentro do fetch.");
  }

  // Patch vs worker: checar se patch menciona coisas que não existem no snapshot
  const patchMentionsTargetWorker = /env\.TARGET_WORKER\b/.test(patchText);
  const workerHasTargetWorkerBinding = /TARGET_WORKER\b/.test(w);
  if (patchMentionsTargetWorker && !workerHasTargetWorkerBinding) {
    findings.push("Patch usa env.TARGET_WORKER mas snapshot não mostra binding/uso explícito (confirmar bindings no Cloudflare).");
    impacted_areas.push("bindings");
  }

  // Detectar riscos de segredos no snapshot
  if (/(INTERNAL_TOKEN\s*=\s*["']|Bearer\s+)/.test(w)) {
    findings.push("Snapshot: há padrões relacionados a token/auth; garantir que nada seja logado.");
    impacted_areas.push("auth");
  }

  unknowns.push("Mesmo com snapshot, dependências externas (bindings/KV/env) precisam ser confirmadas no dashboard.");
  return {
    summary: {
      snapshot_chars: w.length,
      snapshot_lines: w.split("\n").length,
    },
    blockers,
    findings,
    impacted_areas: uniq(impacted_areas),
    recommended_changes,
    unknowns,
  };
}

// ============================================================
// 🧩 Helpers — risco, checks, parsing
// ============================================================
function calcRiskLevel(audit, contextAudit) {
  // Base por blockers/dangers/syntax
  if (!audit.syntax.ok) return "high";
  const dangerSet = new Set([...(audit.dangers || []), ...((contextAudit?.dangers) || [])]);

  if (dangerSet.has("LEAK_SECRET")) return "high";
  if (dangerSet.has("AUTO_PROD_DEPLOY")) return "high";
  if (dangerSet.has("EVAL_OR_FUNCTION")) return "high";
  if (dangerSet.has("WILDCARD_DELETE")) return "high";

  // Médio se mexe em auth/rotas internas/KV/fetch
  const sem = new Set([...(audit.semantics || [])]);
  const mediumTriggers = ["AUTH_CHANGE", "ROUTING_CHANGE", "KV_CHANGE", "FETCH_CHANGE", "BINDING_CHANGE"];
  if (mediumTriggers.some((k) => sem.has(k))) return "medium";

  return "low";
}

function basicSyntaxChecks(text) {
  // Checks conservadores: equilíbrio de (), {}, [] e aspas simples/duplas/backtick (heurístico)
  const res = { ok: true, issues: [] };

  const balance = (s, open, close) => {
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === open) n++;
      if (c === close) n--;
      if (n < 0) return { ok: false, at: i };
    }
    return { ok: n === 0, at: -1, remaining: n };
  };

  const b1 = balance(text, "{", "}");
  if (!b1.ok) res.issues.push("Chaves { } parecem desbalanceadas.");

  const b2 = balance(text, "(", ")");
  if (!b2.ok) res.issues.push("Parênteses ( ) parecem desbalanceados.");

  const b3 = balance(text, "[", "]");
  if (!b3.ok) res.issues.push("Colchetes [ ] parecem desbalanceados.");

  // Heurística: presença de "export default" sem fechamento provável
  if (/export\s+default/.test(text) && !/;\s*$/.test(text.trim())) {
    // Não bloqueia por si só, mas alerta
    res.issues.push("Patch contém 'export default' — confirmar se é arquivo completo ou trecho.");
  }

  // Erros comuns de colagem
  if (/undefined\s*:\s*/.test(text)) res.issues.push("Encontrado padrão 'undefined:' (colagem/JSON inválido?).");

  res.ok = res.issues.length === 0;
  return res;
}

function detectDangers(text) {
  const d = [];
  if (/(console\.log\([^)]*(token|secret|key|authorization|bearer)[^)]*\))/i.test(text)) d.push("LEAK_SECRET");
  if (/(INTERNAL_TOKEN|API_KEY|SECRET|BEARER\s+)/i.test(text) && /console\.(log|debug|info)/i.test(text)) d.push("LEAK_SECRET");

  if (/\b(eval|new\s+Function)\b/.test(text)) d.push("EVAL_OR_FUNCTION");

  // Deploy/produção direto (heurístico)
  if (/prod(uction)?/i.test(text) && /(deploy|apply|promote)/i.test(text)) d.push("AUTO_PROD_DEPLOY");

  // Deletes amplos (heurístico)
  if (/\b(delete|flush|drop)\b/i.test(text) && /\b(KV|namespace|bucket|table)\b/i.test(text)) d.push("WILDCARD_DELETE");

  return uniq(d);
}

function detectSemantics(text) {
  const s = [];
  if (/\/__internal__\//.test(text)) s.push("INTERNAL_ROUTES");
  if (/\b(handleCORS|CORS|preflight)\b/i.test(text)) s.push("CORS_CHANGE");
  if (/\bAuthorization\b|\bBearer\b|\bINTERNAL_TOKEN\b/.test(text)) s.push("AUTH_CHANGE");
  if (/\bDEPLOY_KV\b|\bput\(|\bget\(|PATCH_STATUS:|STAGING:/i.test(text)) s.push("KV_CHANGE");
  if (/\bservices?\b|\bbinding\b|\bTARGET_WORKER\b|\benv\.[A-Z0-9_]+\b/i.test(text)) s.push("BINDING_CHANGE");
  if (/\bfetch\(/.test(text)) s.push("FETCH_CHANGE");
  if (/\bpathname\b|\burl\.pathname\b|\bmethod\b|\breturn\s+error\(|NOT_FOUND/i.test(text)) s.push("ROUTING_CHANGE");
  return uniq(s);
}

function findHotspots(lines) {
  const out = [];
  const keys = [
    "return",
    "__internal__",
    "Authorization",
    "Bearer",
    "INTERNAL_TOKEN",
    "CORS",
    "preflight",
    "fetch(",
    "DEPLOY_KV",
    "PATCH_STATUS",
    "STAGING:",
    "TARGET_WORKER",
    "binding",
  ];
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (keys.some((k) => ln.includes(k))) {
      out.push({ line: i + 1, preview: ln.slice(0, 180) });
    }
  }
  // limita para não explodir retorno
  return out.slice(0, 80);
}

function simpleFingerprint(text) {
  // hash simples (não criptográfico) para rastreio
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return "fnv1a32:" + (h >>> 0).toString(16).padStart(8, "0");
}

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

// ============================================================
// 🔒 INTERNAL HANDSHAKE — ENAVIA (CÉREBRO) — READ ONLY / PASSIVE
// ============================================================

function normalizeInternalPath(pathname) {
  if (pathname.startsWith("/__internal__/")) return pathname;
  if (pathname.startsWith("/_internal_/")) {
    return "/__internal__/" + pathname.slice("/_internal_/".length);
  }
  return null;
}

const internalPath = normalizeInternalPath(path);

// ------------------------------------------------------------
// 🔐 AUTH INTERNA (Bearer INTERNAL_TOKEN)
// ------------------------------------------------------------
function isInternalAuthorized(req, env) {
  try {
    const auth = req.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
    return (
      typeof env.INTERNAL_TOKEN === "string" &&
      token === env.INTERNAL_TOKEN
    );
  } catch {
    return false;
  }
}

// ------------------------------------------------------------
// GET /__internal__/describe
// ------------------------------------------------------------
if (internalPath === "/__internal__/describe" && method === "GET") {
  if (!isInternalAuthorized(request, env)) {
    return new Response("unauthorized", { status: 401 });
  }

  return new Response(
    JSON.stringify({
      ok: true,
      system: "NV-ENAVIA",
      role: "brain",
      env_hint: "test",
      internal: true,
      version: "internal-handshake-v1",
      timestamp: new Date().toISOString(),
      routes: {
        describe: true,
        deploy_apply: true,
      },
    }),
    { headers: { "content-type": "application/json" } }
  );
}

// ------------------------------------------------------------
// GET /__internal__/routes
// (Contrato de descoberta canônico)
// ------------------------------------------------------------
if (internalPath === "/__internal__/routes" && method === "GET") {
  if (!isInternalAuthorized(request, env)) {
    return new Response("unauthorized", { status: 401 });
  }

  return jsonResponse({
    ok: true,
    worker: "ENAVIA-NV-FIRST",
    role: "discovery",
    version: "routes.v1",
    timestamp: new Date().toISOString(),
    routes: [
      { path: "/__internal__/build", methods: ["GET"] },
      { path: "/__internal__/describe", methods: ["GET"] },
      { path: "/__internal__/routes", methods: ["GET"] },
      { path: "/__internal__/capabilities", methods: ["GET"] },
      { path: "/__internal__/deploy-apply", methods: ["POST"] },
      { path: "/__internal__/deploy-rollback", methods: ["POST"] },
      { path: "/audit", methods: ["POST", "OPTIONS"] },
      { path: "/propose", methods: ["POST", "OPTIONS"] },
    ],
  });
}

// ------------------------------------------------------------
// GET /__internal__/capabilities
// (Contrato de descoberta canônico)
// ------------------------------------------------------------
if (internalPath === "/__internal__/capabilities" && method === "GET") {
  if (!isInternalAuthorized(request, env)) {
    return new Response("unauthorized", { status: 401 });
  }

  return jsonResponse({
    ok: true,
    worker: "ENAVIA-NV-FIRST",
    role: "discovery",
    version: "capabilities.v1",
    timestamp: new Date().toISOString(),
    internal_auth: {
      type: "bearer",
      header: "Authorization",
      env_var: "INTERNAL_TOKEN",
    },
    capabilities: {
      propose: { enabled: true, read_only_supported: true },
      audit: { enabled: true },
      deploy_apply: { enabled: true, mode: "passive_handshake" },
      deploy_rollback: { enabled: true, mode: "passive_handshake" },
    },
    notes: [
      "Sem token válido: deve retornar 401 (igual /__internal__/describe).",
      "Se retornar 404: endpoint não foi inserido no worker.",
    ],
  });
}

// ------------------------------------------------------------
// POST /__internal__/deploy-apply
// 🚫 PASSIVE MODE — NÃO EXECUTA NADA
// ------------------------------------------------------------
if (internalPath === "/__internal__/deploy-apply" && method === "POST") {
  if (!isInternalAuthorized(request, env)) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  // 👉 Suporte ao probe do Deploy Worker
  if (body && body.probe === true) {
    return new Response(
      JSON.stringify({
        ok: true,
        system: "NV-ENAVIA",
        internal: true,
        probe: true,
        mode: "passive",
        message: "deploy-apply endpoint exists (passive brain).",
      }),
      { headers: { "content-type": "application/json" } }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      system: "NV-ENAVIA",
      internal: true,
      mode: "passive",
      received: {
        execution_id: body.execution_id || null,
        has_patch: Boolean(body?.patch?.content),
        requested_mode: body.mode || null,
      },
      message: "Recebido em modo passivo (nenhuma execução realizada).",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "content-type": "application/json" } }
  );
}

// ------------------------------------------------------------
// POST /__internal__/deploy-rollback
// 🔒 PASSIVE MODE — rollback confirmado, sem executar nada
// ------------------------------------------------------------
if (internalPath === "/__internal__/deploy-rollback" && method === "POST") {
  if (!isInternalAuthorized(request, env)) {
    return new Response("unauthorized", { status: 401 });
  }

  const body = await request.json().catch(() => ({}));

  return new Response(
    JSON.stringify({
      ok: true,
      system: "NV-ENAVIA",
      internal: true,
      mode: "passive",
      received: {
        execution_id: body.execution_id || null,
        env: body.env || null,
        manual: body.manual === true,
      },
      message: "deploy-rollback recebido em modo passivo (nenhuma ação executada).",
      timestamp: new Date().toISOString(),
    }),
    { headers: { "content-type": "application/json" } }
  );
}

    // 🌐 CORS preflight — AGORA SIM
    const corsPreflight = handleCORSPreflight(request);
    if (corsPreflight) return corsPreflight;

    try {
      // -------------------------------------------------------
      // POST / → Chat NV-FIRST
      // -------------------------------------------------------
      if (method === "POST" && path === "/") {
        return withCORS(await handleChatRequest(request, env));
      }

      // -------------------------------------------------------
      // POST /engineer → Relay para executor core
      // -------------------------------------------------------
      if (method === "POST" && path === "/engineer") {
        return await handleEngineerRequest(request, env);
      }

      // -------------------------------------------------------
      // POST /reload → Recarrega INDEX
      // -------------------------------------------------------
      if (method === "POST" && path === "/reload") {
        return await handleReloadRequest(env);
      }

      // -------------------------------------------------------
      // POST /debug-load → Carregar módulos via FILA (3 simultâneos)
      // -------------------------------------------------------
      if (method === "POST" && path === "/debug-load") {
        return await handleDebugLoad(request, env);
      }

      // -------------------------------------------------------
      // POST /brain-query → Buscar módulos relevantes por tema  // NEW
      // -------------------------------------------------------
      if (method === "POST" && path === "/brain-query") {
        return await handleBrainQuery(request, env);
      }

      // -------------------------------------------------------
      // POST /brain/get-module → Ler conteúdo de um módulo       // NEW
      // -------------------------------------------------------
      if (method === "POST" && path === "/brain/get-module") {
        return await handleBrainGetModule(request, env);
      }

// -------------------------------------------------------
// POST /brain/director-query → Cérebro CANÔNICO do Director
// -------------------------------------------------------
if (method === "POST" && path === "/brain/director-query") {
  if (!isInternalAuthorized(request, env)) {
    return withCORS(new Response("unauthorized", { status: 401 }));
  }

  try {
    const body = await request.json();

    // 🔒 Firewall cognitivo
    if (body.role !== "director") {
      return withCORS(new Response(
        JSON.stringify({
          ok: false,
          error: "ACCESS_DENIED_INVALID_ROLE"
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      ));
    }

    // 🧠 Carrega cérebro do Director via KV
    const brain = await loadDirectorBrain(env);

    return withCORS(new Response(
      JSON.stringify({
        ok: true,
        brain: {
          role: "director",
          version: brain.version,
          modules: brain.modules,
          content: brain.content
        }
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    ));

  } catch (err) {
    return withCORS(new Response(
      JSON.stringify({
        ok: false,
        error: "DIRECTOR_BRAIN_ERROR",
        detail: String(err)
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    ));
  }
}

// -------------------------------------------------------
// POST /director/cognitive → Proxy Cognitivo (CSP-safe)
// -------------------------------------------------------
if (method === "POST" && path === "/director/cognitive") {
  const res = await handleDirectorCognitiveProxy(request, env);
  return withCORS(res);
}

console.log("FETCH HIT:", request.method, new URL(request.url).pathname);

      // -------------------------------------------------------
      // GET /debug-brain → Status interno REAL do NV-FIRST
      // -------------------------------------------------------
      if (method === "GET" && path === "/debug-brain") {
        return await handleDebugBrain(env);
      }

      // -------------------------------------------------------
      // GET /engineer → Teste rápido da rota
      // -------------------------------------------------------
      if (method === "GET" && path === "/engineer") {
        return withCORS(new Response(
          JSON.stringify({
            ok: true,
            route: "/engineer",
            message: "Rota POST /engineer ativa."
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }

      // -------------------------------------------------------
      // GET /brain/read → Retorna System Prompt + index (como já estava)
      // -------------------------------------------------------
      if (method === "GET" && path === "/brain/read") {
        const systemPrompt = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");

        return withCORS(new Response(
          JSON.stringify({
            ok: true,
            route: "/brain/read",
            systemPrompt: systemPrompt || "(nenhum SYSTEM_PROMPT encontrado)",
            index: NV_INDEX_CACHE || null,
            modulesLoaded: Object.keys(NV_MODULE_CACHE || {})
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }

      // -------------------------------------------------------
      // GET /brain/index → INDEX completo + meta de cache        // NEW
      // -------------------------------------------------------
      if (method === "GET" && path === "/brain/index") {
        return await handleBrainIndex(request, env);
      }

      // -------------------------------------------------------
      // 📜 CONTRACT EXECUTOR v1 — Fase A Routes
      // -------------------------------------------------------

      // POST /contracts → Create a new contract
      if (method === "POST" && path === "/contracts") {
        const result = await handleCreateContract(request, env);
        return jsonResponse(result.body, result.status);
      }

      // GET /contracts → Read full contract (requires ?id=...)
      if (method === "GET" && path === "/contracts") {
        const contractId = url.searchParams.get("id");
        const result = await handleGetContract(env, contractId);
        return jsonResponse(result.body, result.status);
      }

      // GET /contracts/summary → Read contract summary (requires ?id=...)
      if (method === "GET" && path === "/contracts/summary") {
        const contractId = url.searchParams.get("id");
        const result = await handleGetContractSummary(env, contractId);
        return jsonResponse(result.body, result.status);
      }

      // GET /contracts/active-surface → Surface do contrato ativo mais recente
      if (method === "GET" && path === "/contracts/active-surface") {
        const result = await handleGetActiveSurface(env);
        return jsonResponse(result.body, result.status);
      }

      // PR6 — GET /contracts/loop-status → Loop supervisionado: próxima ação + estado do loop
      if (method === "GET" && path === "/contracts/loop-status") {
        return await handleGetLoopStatus(env);
      }

      // PR9 — POST /contracts/execute-next → Loop operacional supervisionado com gates de segurança
      if (method === "POST" && path === "/contracts/execute-next") {
        return await handleExecuteNext(request, env);
      }

      // POST /contracts/execute → Execute current micro-PR in TEST (C1)
      if (method === "POST" && path === "/contracts/execute") {
        const result = await handleExecuteContract(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/close-test → Automatic contract closure in TEST (C2)
      if (method === "POST" && path === "/contracts/close-test") {
        const result = await handleCloseContractInTest(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/cancel → Formal contract cancellation (F1)
      if (method === "POST" && path === "/contracts/cancel") {
        const result = await handleCancelContract(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/reject-plan → Formal decomposition plan rejection (F2)
      if (method === "POST" && path === "/contracts/reject-plan") {
        const result = await handleRejectDecompositionPlan(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/resolve-plan-revision → Resolve plan revision (F2b)
      if (method === "POST" && path === "/contracts/resolve-plan-revision") {
        const result = await handleResolvePlanRevision(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/complete-task → 🛡️ Gate obrigatório de aderência contratual por microetapa
      if (method === "POST" && path === "/contracts/complete-task") {
        const result = await handleCompleteTask(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/advance-phase → 🛡️ PR18 — Endpoint supervisionado de avanço de fase
      // Reutiliza advanceContractPhase (gate checkPhaseGate aplicado internamente).
      if (method === "POST" && path === "/contracts/advance-phase") {
        const result = await handleAdvancePhase(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /contracts/close-final → 🛡️ Gate final pesado do contrato inteiro (PR 3)
      if (method === "POST" && path === "/contracts/close-final") {
        const result = await handleCloseFinalContract(request, env);
        return jsonResponse(result.body, result.status);
      }

      // ============================================================
      // 🛡️ P24 — GitHub/PR Arm Runtime Endpoints
      // Separate from Cloudflare executor. Operates on branch/PR/repo.
      // ============================================================

      // POST /github-pr/action → Execute a GitHub/PR arm action with enforcement
      if (method === "POST" && path === "/github-pr/action") {
        const result = await handleGitHubPrAction(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /github-pr/request-merge → Request merge approval (evaluates readiness)
      if (method === "POST" && path === "/github-pr/request-merge") {
        const result = await handleRequestMergeApproval(request, env);
        return jsonResponse(result.body, result.status);
      }

      // POST /github-pr/approve-merge → Formal merge approval (button in panel)
      if (method === "POST" && path === "/github-pr/approve-merge") {
        const result = await handleApproveMerge(request, env);
        return jsonResponse(result.body, result.status);
      }

      // ============================================================
      // 🌐 P25 — Browser Arm Runtime Endpoints
      // Separate from Cloudflare executor and GitHub arm (P24).
      // Operates on external navigation/search/visual operations.
      // ============================================================

      // POST /browser-arm/action → Execute a Browser Arm action with enforcement
      if (method === "POST" && path === "/browser-arm/action") {
        const result = await handleBrowserArmAction(request, env);
        return jsonResponse(result.body, result.status);
      }

      // GET /browser-arm/state → Get current Browser Arm state (KV-rehydrated)
      if (method === "GET" && path === "/browser-arm/state") {
        return jsonResponse(await getBrowserArmStateWithKV(env), 200);
      }

      // ============================================================
      // 📝 PR4 — Manual Memory CRUD routes
      // ============================================================

      // GET /memory/manual — List all manual memories
      if (method === "GET" && path === "/memory/manual") {
        try {
          const result = await searchMemory(
            { memory_type: MEMORY_TYPES.MEMORIA_MANUAL, include_inactive: true },
            env,
          );
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.results, count: result.count });
        } catch (err) {
          logNV("❌ [GET /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/manual — Create manual memory
      if (method === "POST" && path === "/memory/manual") {
        try {
          const body = await request.json().catch(() => ({}));
          const now = new Date().toISOString();
          const memId = body.memory_id || ("manual-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7));
          const memObj = buildMemoryObject({
            memory_id:          memId,
            memory_type:        MEMORY_TYPES.MEMORIA_MANUAL,
            entity_type:        body.entity_type || ENTITY_TYPES.RULE,
            entity_id:          body.entity_id || memId,
            title:              body.title || "Memória manual sem título",
            content_structured: body.content_structured || { text: body.content || "" },
            priority:           body.priority || "high",
            confidence:         body.confidence || "confirmed",
            source:             "panel",
            created_at:         now,
            updated_at:         now,
            expires_at:         body.expires_at || null,
            is_canonical:       body.is_canonical === true,
            status:             body.status || "active",
            flags:              Array.isArray(body.flags) ? body.flags : [],
            tags:               Array.isArray(body.tags) ? body.tags : [],
          });
          const result = await writeMemory(memObj, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error, errors: result.errors }, 400);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record }, 201);
        } catch (err) {
          logNV("❌ [POST /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // PATCH /memory/manual — Update manual memory
      if (method === "PATCH" && path === "/memory/manual") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          // Only allow patching manual memories
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be edited via this route" }, 403);
          }
          const patch = {};
          if (body.title !== undefined)              patch.title = body.title;
          if (body.content_structured !== undefined)  patch.content_structured = body.content_structured;
          else if (body.content !== undefined)        patch.content_structured = { text: body.content };
          if (body.priority !== undefined)            patch.priority = body.priority;
          if (body.confidence !== undefined)          patch.confidence = body.confidence;
          if (body.status !== undefined)              patch.status = body.status;
          if (body.tags !== undefined)                patch.tags = body.tags;
          if (body.flags !== undefined)               patch.flags = body.flags;
          if (body.expires_at !== undefined)          patch.expires_at = body.expires_at;
          if (body.is_canonical !== undefined)        patch.is_canonical = body.is_canonical;

          const result = await updateMemory(memId, patch, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error, errors: result.errors }, 400);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("❌ [PATCH /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/manual/block — Block manual memory
      if (method === "POST" && path === "/memory/manual/block") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be blocked via this route" }, 403);
          }
          const result = await blockMemory(memId, { blocked_by: "panel", blocked_at: new Date().toISOString() }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("❌ [POST /memory/manual/block] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/manual/invalidate — Invalidate/expire manual memory
      if (method === "POST" && path === "/memory/manual/invalidate") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be invalidated via this route" }, 403);
          }
          const result = await invalidateMemory(memId, { invalidated_by: "panel", invalidated_at: new Date().toISOString() }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("❌ [POST /memory/manual/invalidate] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ============================================================
      // 🎓 PR5 — Learning Candidates (Aprendizado Controlado)
      // ============================================================

      // GET /memory/learning — List learning candidates
      if (method === "GET" && path === "/memory/learning") {
        try {
          const url = new URL(request.url);
          const statusFilter = url.searchParams.get("status") || undefined;
          const filters = statusFilter ? { status: statusFilter } : {};
          const result = await listLearningCandidates(env, filters);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.items, count: result.count });
        } catch (err) {
          logNV("❌ [GET /memory/learning] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/learning — Register a learning candidate (pending)
      if (method === "POST" && path === "/memory/learning") {
        try {
          const body = await request.json().catch(() => ({}));
          const result = await registerLearningCandidate({
            candidate_id:       body.candidate_id,
            title:              body.title,
            content_structured: body.content_structured || (body.content ? { text: body.content } : undefined),
            source:             body.source || "panel",
            confidence:         body.confidence || "medium",
            priority:           body.priority || "medium",
            tags:               Array.isArray(body.tags) ? body.tags : [],
          }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({ ok: true, candidate_id: result.candidate_id, record: result.record }, 201);
        } catch (err) {
          logNV("❌ [POST /memory/learning] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/learning/approve — Approve a learning candidate (human approval)
      if (method === "POST" && path === "/memory/learning/approve") {
        try {
          const body = await request.json().catch(() => ({}));
          const candidateId = body.candidate_id;
          if (!candidateId) {
            return jsonResponse({ ok: false, error: "candidate_id is required" }, 400);
          }
          const result = await approveLearningCandidate(candidateId, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({
            ok: true,
            candidate_id: result.candidate_id,
            promoted_memory_id: result.promoted_memory_id,
            candidate: result.candidate,
          });
        } catch (err) {
          logNV("❌ [POST /memory/learning/approve] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // POST /memory/learning/reject — Reject a learning candidate (human rejection)
      if (method === "POST" && path === "/memory/learning/reject") {
        try {
          const body = await request.json().catch(() => ({}));
          const candidateId = body.candidate_id;
          if (!candidateId) {
            return jsonResponse({ ok: false, error: "candidate_id is required" }, 400);
          }
          const result = await rejectLearningCandidate(candidateId, body.reason, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({
            ok: true,
            candidate_id: result.candidate_id,
            candidate: result.candidate,
          });
        } catch (err) {
          logNV("❌ [POST /memory/learning/reject] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ============================================================
      // 📋 PR6 — Memory Audit Trail (Telemetria / Auditoria)
      // ============================================================

      // GET /memory/audit — List audit events with optional filters
      if (method === "GET" && path === "/memory/audit") {
        try {
          const url = new URL(request.url);
          const filters = {};
          const eventType = url.searchParams.get("event_type");
          const targetType = url.searchParams.get("target_type");
          const targetId = url.searchParams.get("target_id");
          const limitParam = url.searchParams.get("limit");
          if (eventType) filters.event_type = eventType;
          if (targetType) filters.target_type = targetType;
          if (targetId) filters.target_id = targetId;
          if (limitParam) filters.limit = parseInt(limitParam, 10);
          const result = await listAuditEvents(filters, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.items, count: result.count });
        } catch (err) {
          logNV("❌ [GET /memory/audit] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }

      // ============================================================
      // 🧠 GET /memory — Estado da memória persistida no KV
      // Painel: aba Memória. Contrato: mapMemoryResponse(raw).
      // ============================================================
      if (method === "GET" && path === "/memory") {
        try {
          const memResult = await searchRelevantMemory({}, env);
          const allMems = memResult.ok ? memResult.results : [];

          const toStrength = (confidence) =>
            (confidence === "confirmed" || confidence === "high") ? "strong" : "weak";

          const toTier = (mem) => {
            if (mem.memory_type === "canonical_rules" && mem.is_canonical) return 1;
            if (mem.is_canonical) return 2;
            if (mem.memory_type === "project") return 3;
            if (mem.memory_type === "live_context") return 4;
            if (mem.memory_type === "user_profile") return 5;
            if (mem.memory_type === "operational_history") return 6;
            return 7;
          };

          const toValue = (mem) => {
            const cs = mem.content_structured;
            if (!cs) return "";
            if (typeof cs.text === "string") return cs.text;
            if (typeof cs.summary === "string") return cs.summary;
            return JSON.stringify(cs);
          };

          const canonicalMems = allMems.filter(
            (m) => m.memory_type === "canonical_rules" || m.is_canonical === true,
          );
          const canonicalIds = new Set(canonicalMems.map((m) => m.memory_id));
          const liveContextMems = allMems.filter(
            (m) => m.memory_type === "live_context" && !canonicalIds.has(m.memory_id),
          );
          const liveContextIds = new Set(liveContextMems.map((m) => m.memory_id));
          const operationalMems = allMems.filter(
            (m) => !canonicalIds.has(m.memory_id) && !liveContextIds.has(m.memory_id),
          );

          const canonicalEntries = canonicalMems.map((m) => ({
            id:        m.memory_id,
            key:       m.entity_id || m.title,
            value:     toValue(m),
            strength:  toStrength(m.confidence),
            scope:     m.entity_type || "global",
            createdAt: m.created_at,
            tags:      Array.isArray(m.flags) ? m.flags : [],
            tier:      toTier(m),
            priority:  m.priority,
          }));

          const operationalEntries = operationalMems.map((m) => ({
            id:        m.memory_id,
            key:       m.entity_id || m.title,
            value:     toValue(m),
            strength:  toStrength(m.confidence),
            source:    m.source,
            sessionId: m.entity_id || null,
            createdAt: m.created_at,
            tags:      Array.isArray(m.flags) ? m.flags : [],
            tier:      toTier(m),
            priority:  m.priority,
          }));

          const liveCtxMem = liveContextMems[0] || null;
          const liveContext = liveCtxMem
            ? {
                sessionId:       liveCtxMem.entity_id || null,
                startedAt:       liveCtxMem.created_at,
                duration:        null,
                intent:          toValue(liveCtxMem),
                activeContracts: liveCtxMem.content_structured?.activeContracts ?? [],
                signals:         liveCtxMem.content_structured?.signals ?? [],
              }
            : null;

          const total = canonicalEntries.length + operationalEntries.length;

          const memoryPayload = {
            state:   total > 0 ? "populated" : "empty",
            summary: {
              total,
              canonical:        canonicalEntries.length,
              operational:      operationalEntries.length,
              sessionEntries:   liveContextMems.length,
              lastConsolidation: null,
            },
            canonicalEntries,
            operationalEntries,
            liveContext,
            consolidation: {
              pending:      [],
              consolidated: [],
              lastRun:      null,
              nextRun:      null,
            },
            memoryReadBeforePlan: {
              happened:     total > 0,
              readAt:       total > 0 ? new Date().toISOString() : null,
              memoriesRead: total,
              topTier:      total > 0 ? 1 : null,
              topPriority:  canonicalEntries[0]?.priority ?? null,
            },
            auditSnapshots: [],
          };

          return withCORS(jsonResponse(memoryPayload, 200));
        } catch (err) {
          logNV("❌ [GET /memory] erro:", String(err));
          return withCORS(jsonResponse(
            { ok: false, error: "Falha ao carregar memória.", detail: String(err) },
            500,
          ));
        }
      }

      // -------------------------------------------------------
      // GET / → Teste rápido de saúde
      // -------------------------------------------------------
      if (method === "GET" && path === "/") {
        return withCORS(new Response(
          [
            "ENAVIA NV-FIRST ativa ✅",
            "",
            "Rotas disponíveis:",
            "  • POST /               → Chat NV-FIRST",
            "  • POST /engineer       → Relay para executor core",
            "  • POST /reload         → Recarregar INDEX",
            "  • POST /debug-load     → Carregar módulos via FILA",
            "  • POST /brain-query    → Buscar módulos no cérebro",
            "  • POST /brain/get-module → Ler conteúdo de módulo",
            "  • POST /planner/run    → Planner estruturado PM4→PM9 (classificação→plano→gate→bridge→memória)",
            "  • POST /contracts      → Criar contrato (Contract Executor v1)",
            "  • POST /contracts/execute → Executar micro-PR corrente em TEST (C1)",
            "  • POST /contracts/close-test → Fechamento automático de contrato em TEST (C2)",
            "  • POST /contracts/cancel → Cancelamento formal de contrato (F1)",
            "  • POST /contracts/reject-plan → Rejeição formal do plano de decomposição (F2)",
            "  • POST /contracts/resolve-plan-revision → Resolução de revisão do plano (F2b)",
            "  • POST /contracts/complete-task → 🛡️ Concluir task com gate obrigatório de aderência contratual",
            "  • POST /contracts/advance-phase → 🛡️ PR18 — Avançar fase supervisionado (gate checkPhaseGate)",
            "  • POST /contracts/close-final → 🛡️ Fechamento final pesado do contrato inteiro (gate PR 3)",
            "  • GET  /contracts?id=  → Ler estado completo do contrato",
            "  • GET  /contracts/summary?id= → Resumo do contrato",
            "  • GET  /contracts/active-surface → Surface do contrato ativo mais recente",
            "  • GET  /debug-brain    → Status interno do NV-FIRST",
            "  • GET  /engineer       → Testar rota do executor",
            "  • GET  /audit          → Schema/contrato da rota POST /audit",
            "  • GET  /brain/read     → Ler System Prompt + estado",
            "  • GET  /brain/index    → INDEX completo do cérebro",
            "  • GET  /planner/run    → Schema/contrato da rota POST /planner/run",
            "  • GET  /memory         → Estado da memória persistida no KV (aba Memória do painel)",
            "  • GET  /memory/manual  → PR4: Listar memórias manuais",
            "  • POST /memory/manual  → PR4: Criar memória manual",
            "  • PATCH /memory/manual → PR4: Editar memória manual",
            "  • POST /memory/manual/block → PR4: Bloquear memória manual",
            "  • POST /memory/manual/invalidate → PR4: Invalidar/expirar memória manual",
            "  • GET  /memory/learning  → PR5: Listar candidatos de aprendizado",
            "  • POST /memory/learning  → PR5: Registrar candidato de aprendizado",
            "  • POST /memory/learning/approve → PR5: Aprovar candidato (promoção para memória validada)",
            "  • POST /memory/learning/reject  → PR5: Rejeitar candidato",
            "  • GET  /memory/audit → PR6: Listar eventos de auditoria da memória/aprendizado"
          ].join("\n"),
          { status: 200 }
        ));
      }

      // -------------------------------------------------------
      // 404 Fallback
      // -------------------------------------------------------
      return withCORS(new Response(
        JSON.stringify({
          ok: false,
          error: "Rota não encontrada.",
          method,
          path
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      ));

    } catch (err) {
      return withCORS(new Response(
        JSON.stringify({
          ok: false,
          error: "Falha interna.",
          detail: String(err)
        }),
        { status: 500 }
      ));
    }
  }
};

// ============================================================================
// 🧠 Director Cognitivo — Proxy (SERVER SIDE ONLY)
// ============================================================================
async function handleDirectorCognitiveProxy(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }

  const r = await fetch(
    env.DIRECTOR_COGNITIVE_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );

  const text = await r.text();

  return new Response(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" }
  });
}
