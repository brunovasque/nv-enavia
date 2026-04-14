import {
  handleCreateContract,
  handleGetContract,
  handleGetContractSummary,
  handleExecuteContract,
  handleCloseContractInTest,
  handleCancelContract,
  handleRejectDecompositionPlan,
  handleResolvePlanRevision,
  handleCompleteTask,
  handleCloseFinalContract,
  readExecEvent,
  // P24 — GitHub/PR Arm
  handleGitHubPrAction,
  handleRequestMergeApproval,
  handleApproveMerge,
  // P25 — Browser Arm
  handleBrowserArmAction,
  getBrowserArmState,
} from "./contract-executor.js";

import { classifyRequest } from "./schema/planner-classifier.js";
import { buildOutputEnvelope } from "./schema/planner-output-modes.js";
import { buildCanonicalPlan } from "./schema/planner-canonical-plan.js";
import { evaluateApprovalGate } from "./schema/planner-approval-gate.js";
import { buildExecutorBridgePayload } from "./schema/planner-executor-bridge.js";
import { consolidateMemoryLearning } from "./schema/memory-consolidation.js";
import { writeMemory } from "./schema/memory-storage.js";
import { buildMemoryObject, ENTITY_TYPES } from "./schema/memory-schema.js";
import { searchRelevantMemory } from "./schema/memory-read.js";

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
const ENAVIA_BUILD = {
  id: "ENAVIA_TEST_PATCH_2025-01",
  deployed_at: "2025-01-21T00:00:00Z",
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
// ---------------------------------------------------------------------------
async function callChatModel(env, messages, options = {}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY não configurada no Worker ENAVIA NV-FIRST.");
  }

  const model =
    env.OPENAI_MODEL ||
    env.NV_OPENAI_MODEL ||
    "gpt-4.1-mini";

  const body = {
    model,
    messages,
    temperature: options.temperature ?? 0.2,
    max_completion_tokens: options.max_completion_tokens ?? options.max_tokens ?? 1600,
    top_p: options.top_p ?? 1,
    // response_format is forwarded when set (e.g. { type: "json_object" } for
    // structured output). Omitted entirely when not provided to stay compatible
    // with model versions that do not support the parameter.
    ...(options.response_format ? { response_format: options.response_format } : {}),
  };

  logNV("🔁 Chamando modelo:", model);

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logNV("❌ Erro na chamada ao modelo:", res.status, detail.slice(0, 400));
    throw new Error(
      `Falha na chamada ao modelo → HTTP ${res.status} — ${detail.slice(
        0,
        400,
      )}`,
    );
  }

  const data = await res.json();
  const choice = data.choices?.[0];
  const content = choice?.message?.content || "";

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
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
      "Access-Control-Max-Age": "86400",
    },
  });
}

function withCORS(response) {
  const headers = new Headers(response.headers);

  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
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
          }))
        : [],
    };

    // plannerContext = contexto original enriquecido com resumo de memória.
    // PM4 recebe este contexto; sinais de memória estão estruturalmente presentes.
    const plannerContext = { ...context, memory_context };

    // PM4 — Classificação (recebe plannerContext enriquecido)
    const classification = classifyRequest({ text: message, context: plannerContext });

    // PM5 — Output Envelope
    const envelope = buildOutputEnvelope(classification, { text: message });

    // PM6 — Plano Canônico
    const canonicalPlan = buildCanonicalPlan({
      classification,
      envelope,
      input: { text: message },
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

    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      timestamp: Date.now(),
      input: message,
      planner: {
        memoryContext: memory_context,
        classification,
        canonicalPlan,
        gate,
        bridge,
        memoryConsolidation,
        outputMode: envelope.output_mode,
      },
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: "PM3→PM4→PM5→PM6→PM7→PM8→PM9→P15",
        memory_read: memoryReadAudit,
        consolidation_persisted,
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

  try {
    // --- System prompt LLM-first com sinal estruturado ---
    // The LLM is the sole decision-maker for whether the planner tool is needed.
    // No substring lists — the model reads the user's full intent and returns a
    // small JSON object: { reply, use_planner }.
    //   reply       — the free-form conversational response shown to the user
    //   use_planner — true only when the user is clearly requesting a structured
    //                 plan, action breakdown, or task organisation
    const ownerName = env.OWNER || "usuário";
    const systemName = env.SYSTEM_NAME || "ENAVIA";

    const chatSystemPrompt = `Você é a ${systemName}, assistente inteligente da NV Imóveis.

Responda SEMPRE em JSON válido, sem markdown, sem texto fora do JSON. Formato obrigatório:
{"reply":"<sua resposta em português>","use_planner":<true ou false>}

Regras para o campo reply:
- Responda de forma natural, clara e humana.
- Se o usuário disser algo casual (oi, tudo bem, etc.), responda naturalmente.
- Se o usuário pedir algo técnico ou estruturado, responda de forma completa e direta.
- Fale sempre em português do Brasil.
- Nunca use templates rígidos, campos como "next_action" ou "reason" como fala.
- O nome do operador é ${ownerName}.
- Você está no painel da ${systemName}, ambiente de gestão da NV Imóveis.

Regras para o campo use_planner (boolean):
- true: apenas quando o usuário pede explicitamente um plano de ação estruturado, lista de etapas, ou organização de tarefa.
- false: em qualquer outra situação (conversa livre, perguntas, análises, pedidos simples).`;

    const llmMessages = [
      { role: "system", content: chatSystemPrompt },
      { role: "user", content: message },
    ];

    // --- Chamada LLM com resposta estruturada ---
    // Max tokens capped at 1200 to balance response quality with Cloudflare Worker
    // CPU time limits (~30s). Increase if moving to Unbound or Durable Objects.
    // response_format is intentionally omitted: not all model versions (including
    // gpt-5.x) accept the json_object parameter. The system prompt already mandates
    // JSON output, and the JSON.parse block below falls back gracefully to plain text.
    const CHAT_LLM_MAX_TOKENS = 1200;
    const llmResult = await callChatModel(env, llmMessages, {
      temperature: 0.5,
      max_tokens: CHAT_LLM_MAX_TOKENS,
    });

    // Parse the structured response — fall back gracefully if the model returns
    // plain text (e.g. older model versions that ignore response_format).
    let reply = "";
    let wantsPlan = false;
    try {
      const parsed = JSON.parse(llmResult.text);
      reply = typeof parsed.reply === "string" && parsed.reply.length > 0
        ? parsed.reply
        : llmResult.text;
      wantsPlan = parsed.use_planner === true;
    } catch {
      // Model returned plain text — use as-is, no planner
      reply = llmResult.text || "Instrução recebida.";
      wantsPlan = false;
    }

    logNV("🗣️ [CHAT/LLM] LLM respondeu", { use_planner: wantsPlan, session_id });

    // --- Planner como ferramenta interna (decisão do LLM) ---
    let plannerSnapshot = null;
    let plannerUsed = false;

    if (wantsPlan) {
      try {
        const classification = classifyRequest({ text: message, context });
        const envelope = buildOutputEnvelope(classification, { text: message });
        const canonicalPlan = buildCanonicalPlan({
          classification,
          envelope,
          input: { text: message },
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

        logNV("🔧 [CHAT/LLM] Planner acionado como ferramenta interna", {
          session_id,
          level: classification.level,
        });
      } catch (planErr) {
        logNV("⚠️ [CHAT/LLM] Planner falhou como tool (não crítico)", {
          error: String(planErr),
        });
        // Planner failure is non-critical — the LLM reply is still valid
      }
    }

    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      mode: "llm-first",
      reply,
      planner_used: plannerUsed,
      ...(plannerSnapshot ? { planner: plannerSnapshot } : {}),
      timestamp: Date.now(),
      input: message,
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: plannerUsed ? "LLM + PM4→PM9" : "LLM-only",
      },
    });
  } catch (err) {
    logNV("❌ [CHAT/LLM] Erro fatal:", { error: String(err) });
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        mode: "llm-first",
        timestamp: Date.now(),
        error: "Falha na conversa LLM-first.",
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
    try {
      const latestContractId = await env.ENAVIA_BRAIN.get("execution:exec_event:latest_contract_id");
      if (latestContractId) {
        execEvent = await readExecEvent(env, latestContractId);
      }
    } catch (evErr) { /* exec_event read failure is non-critical — trail still returned */
      logNV("⚠️ [GET /execution] Falha não-crítica ao ler exec_event (trilha retornada sem ele)", { error: String(evErr) });
    }

    // Merge trail + exec_event into a single execution object
    const execution = (trail || execEvent)
      ? { ...(trail ?? {}), ...(execEvent ? { exec_event: execEvent } : {}) }
      : null;

    return jsonResponse({ ok: true, execution });
  } catch (err) {
    logNV("🔴 [GET /execution] Falha ao ler trilha do KV", { error: String(err) });
    return jsonResponse({ ok: false, execution: null, error: "Falha ao ler trilha de execução." }, 500);
  }
}

// ============================================================================
// PR3 — GET /health (handler canônico)
//
// Retorna dados reais mínimos de saúde do sistema Enavia.
// Fonte: exec_event mais recente (PR1) via readExecEvent +
//        ponteiro execution:exec_event:latest_contract_id.
//
// Grupos entregues:
//   - contadores: real mínimo (1 evento — status do último exec_event)
//   - erros recentes: real mínimo (exec_event com status de erro)
//   - bloqueadas: fallback honesto [] (não disponível na fonte PR1)
//   - concluídas: real mínimo (exec_event com status success)
//
// Honestidade:
//   - Apenas o ÚLTIMO exec_event está disponível (sem histórico acumulado).
//   - blocked=0 sempre: a fonte PR1 não registra execuções bloqueadas.
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

    if (!execEvent) {
      return jsonResponse({
        ok: true,
        health: {
          generatedAt:       new Date().toISOString(),
          status:            "idle",
          summary:           { total: 0, completed: 0, failed: 0, blocked: 0, running: 0 },
          recentErrors:      [],
          blockedExecutions: [],
          recentCompleted:   [],
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

    // Contadores reais mínimos (1 evento — não histórico acumulado)
    const summary = {
      total:     1,
      completed: isSuccess ? 1 : 0,
      failed:    isError   ? 1 : 0,
      blocked:   0,         // não disponível na fonte PR1 — honesto
      running:   isRunning ? 1 : 0,
    };

    // Status do sistema
    const status = (isRunning || isSuccess) ? "healthy" : "degraded";

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

    // Bloqueadas — não disponível na fonte PR1
    const blockedExecutions = [];

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

    return jsonResponse({
      ok: true,
      health: {
        generatedAt:       ts ?? new Date().toISOString(),
        status,
        summary,
        recentErrors,
        blockedExecutions,
        recentCompleted,
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
      execRes = await env.EXECUTOR.fetch("https://executor.invalid/audit", {
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

      // GET /browser-arm/state → Get current Browser Arm state
      if (method === "GET" && path === "/browser-arm/state") {
        return jsonResponse(getBrowserArmState(), 200);
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
            "  • POST /contracts/close-final → 🛡️ Fechamento final pesado do contrato inteiro (gate PR 3)",
            "  • GET  /contracts?id=  → Ler estado completo do contrato",
            "  • GET  /contracts/summary?id= → Resumo do contrato",
            "  • GET  /debug-brain    → Status interno do NV-FIRST",
            "  • GET  /engineer       → Testar rota do executor",
            "  • GET  /audit          → Schema/contrato da rota POST /audit",
            "  • GET  /brain/read     → Ler System Prompt + estado",
            "  • GET  /brain/index    → INDEX completo do cérebro",
            "  • GET  /planner/run    → Schema/contrato da rota POST /planner/run",
            "  • GET  /memory         → Estado da memória persistida no KV (aba Memória do painel)"
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
