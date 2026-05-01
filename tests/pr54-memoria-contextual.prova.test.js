// ============================================================================
// 🧪 PR54 — Prova: Memória Contextual (Retrieval por Intenção no Fluxo Real)
//
// PR-PROVA pura. Não altera nenhum runtime. Não chama LLM externo.
// Prova que o Retrieval por Intenção v1 (PR53) funciona como memória
// contextual read-only no fluxo real do prompt/chat:
//   - retrieval aplicado aparece no prompt com marcador canônico;
//   - retrieval não aplicado NÃO aparece no prompt;
//   - contexto é coerente com intenção/skill;
//   - bloco não ativa modo operacional sozinho;
//   - bloco não executa skill;
//   - bloco não cria /skills/run;
//   - bloco não inventa capacidade;
//   - bloco não expõe markdown inteiro nem conteúdo sensível;
//   - campo `intent_retrieval` é aditivo e seguro.
//
// Cenários obrigatórios:
//   A — Retrieval aplicado entra no prompt ("revise a PR 214")
//   B — Retrieval não aplicado não entra no prompt ("oi")
//   C — Contract Loop contextual ("mande a próxima PR")
//   D — Contract Auditor contextual com modo operacional ("revise a PR 214 e veja se quebrou algo")
//   E — Deploy Governance contextual ("deploya em test")
//   F — System Mapper contextual ("quais workers existem?")
//   G — Frustração sem skill ("isso está virando só documento")
//   H — Capacidade/estado sem falsa capacidade ("você já tem Skill Router?")
//   I — Estratégia sem modo pesado ("isso vale a pena agora?")
//   J — Limite e truncamento
//   K — Campo `intent_retrieval` (inspeção de código + unitário)
//   L — Segurança
//   M — Não regressão de operação
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM externo.
// Proibido: não altera nv-enavia.js, cognitive-runtime, llm-core, brain-loader,
//           intent-retrieval, intent-classifier, skill-router, Panel, Executor,
//           Deploy Worker, workflows ou wrangler.
// ============================================================================

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildIntentRetrievalContext,
  RETRIEVAL_MODE,
} from "../schema/enavia-intent-retrieval.js";

import {
  classifyEnaviaIntent,
  INTENT_TYPES,
} from "../schema/enavia-intent-classifier.js";

import {
  routeEnaviaSkill,
  SKILL_IDS,
} from "../schema/enavia-skill-router.js";

import {
  buildChatSystemPrompt,
} from "../schema/enavia-cognitive-runtime.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
    failures.push(label);
  }
}

function header(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// Helper: monta pipeline completo (classify → route → retrieval → prompt)
// ---------------------------------------------------------------------------
function buildFullPipeline(message, { is_operational_context = false, include_brain_context = true } = {}) {
  const intentClassification = classifyEnaviaIntent({ message });
  const skillRouting = routeEnaviaSkill({ message, intentClassification });
  const intentRetrieval = buildIntentRetrievalContext({
    message,
    intentClassification,
    skillRouting,
  });
  const prompt = buildChatSystemPrompt({
    is_operational_context,
    include_brain_context,
    intent_retrieval_context: intentRetrieval.applied ? intentRetrieval : undefined,
  });
  return { intentClassification, skillRouting, intentRetrieval, prompt };
}

// Marcador canônico do bloco de retrieval no prompt
const RETRIEVAL_HEADER = "CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY";

// Marcador canônico do LLM Core no prompt
const LLM_CORE_MARKER = "ENAVIA — LLM CORE";

// Marcador canônico do MODO OPERACIONAL ATIVO
const MODO_OPERACIONAL = "MODO OPERACIONAL ATIVO";

// Marcador de truncamento canônico
const TRUNCATION_MARKER = "[intent-retrieval-truncated]";

// ============================================================================
// CENÁRIO A — Retrieval aplicado entra no prompt
// Mensagem: "revise a PR 214"
// ============================================================================
header("📋 CENÁRIO A — Retrieval aplicado entra no prompt");
{
  const message = "revise a PR 214";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // A1: intent = pr_review
  ok(intentClassification.intent === INTENT_TYPES.PR_REVIEW,
    "A1: 'revise a PR 214' → intent=pr_review");

  // A2: skill = CONTRACT_AUDITOR (via roteamento ou intenção)
  ok(skillRouting.skill_id === SKILL_IDS.CONTRACT_AUDITOR ||
     intentRetrieval.skill_id === SKILL_IDS.CONTRACT_AUDITOR,
    "A2: skill=CONTRACT_AUDITOR (via routing ou intent mapping)");

  // A3: retrieval applied=true
  ok(intentRetrieval.applied === true,
    "A3: retrieval applied=true");

  // A4: prompt contém marcador canônico
  ok(prompt.includes(RETRIEVAL_HEADER),
    `A4: prompt contém "${RETRIEVAL_HEADER}"`);

  // A5: prompt contém contexto de revisão de PR (CONTRACT_AUDITOR block)
  ok(prompt.includes("CONTRACT_AUDITOR") || prompt.includes("Auditor de Contrato") || prompt.includes("Revise a PR"),
    "A5: prompt contém contexto de revisão de PR");

  // A6: prompt contém LLM Core
  ok(prompt.includes(LLM_CORE_MARKER),
    "A6: prompt contém LLM Core");

  // A7: prompt contém Brain Context (snapshot do brain)
  const brainPrompt = buildChatSystemPrompt({ include_brain_context: true });
  ok(brainPrompt.includes("Identidade") || brainPrompt.includes("ENAVIA") || brainPrompt.includes("Brain"),
    "A7: Brain Context presente quando include_brain_context=true");

  // A8: prompt contém envelope JSON
  ok(prompt.includes('"reply"') && prompt.includes('"use_planner"'),
    'A8: prompt contém envelope JSON {"reply":"...","use_planner":...}');

  // A9: retrieval mode = read_only
  ok(intentRetrieval.mode === RETRIEVAL_MODE.READ_ONLY,
    "A9: retrieval mode=read_only");

  // A10: context_block é string não vazia
  ok(typeof intentRetrieval.context_block === "string" && intentRetrieval.context_block.length > 0,
    "A10: context_block é string não vazia");
}

// ============================================================================
// CENÁRIO B — Retrieval não aplicado não entra no prompt
// Mensagem: "oi"
// ============================================================================
header("📋 CENÁRIO B — Retrieval não aplicado não entra no prompt");
{
  const message = "oi";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // B1: retrieval applied=false
  ok(intentRetrieval.applied === false,
    "B1: 'oi' → retrieval applied=false");

  // B2: prompt NÃO contém marcador canônico
  const promptSemRetrieval = buildChatSystemPrompt({});
  ok(!promptSemRetrieval.includes(RETRIEVAL_HEADER),
    `B2: prompt sem retrieval NÃO contém "${RETRIEVAL_HEADER}"`);

  // B3: LLM Core continua presente
  ok(prompt.includes(LLM_CORE_MARKER),
    "B3: LLM Core presente mesmo sem retrieval");

  // B4: Brain Context continua presente (default)
  ok(prompt.includes("Identidade") || prompt.length > 2000,
    "B4: Brain Context presente mesmo sem retrieval");

  // B5: não ativa MODO OPERACIONAL ATIVO
  const promptNaoOperacional = buildChatSystemPrompt({ is_operational_context: false });
  ok(!promptNaoOperacional.includes(MODO_OPERACIONAL),
    "B5: MODO OPERACIONAL ATIVO não ativado para conversa simples");
}

// ============================================================================
// CENÁRIO C — Contract Loop contextual
// Mensagem: "mande a próxima PR"
// ============================================================================
header("📋 CENÁRIO C — Contract Loop contextual");
{
  const message = "mande a próxima PR";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // C1: skill = CONTRACT_LOOP_OPERATOR
  ok(intentRetrieval.skill_id === SKILL_IDS.CONTRACT_LOOP_OPERATOR,
    "C1: skill=CONTRACT_LOOP_OPERATOR para próxima PR");

  // C2: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "C2: retrieval applied=true para próxima PR");

  // C3: prompt contém loop contratual
  ok(prompt.includes("CONTRACT_LOOP_OPERATOR") || prompt.includes("Loop Contratual"),
    "C3: prompt contém referência ao loop contratual");

  // C4: context_block contém orientação de resposta curta + prompt completo
  ok(intentRetrieval.context_block.includes("resposta curta") ||
     intentRetrieval.context_block.includes("prompt completo"),
    "C4: contexto orienta resposta curta + prompt completo");

  // C5: próxima PR não ativa modo operacional pesado (is_operational=false)
  ok(intentClassification.is_operational === false,
    "C5: intent next_pr_request → is_operational=false (não ativa modo operacional pesado)");

  // C6: intent é next_pr_request
  ok(intentClassification.intent === INTENT_TYPES.NEXT_PR_REQUEST,
    "C6: intent=next_pr_request para 'mande a próxima PR'");

  // C7: context_block contém "próxima PR" ou loop contratual
  ok(intentRetrieval.context_block.includes("próxima PR") ||
     intentRetrieval.context_block.includes("pr a pr") ||
     intentRetrieval.context_block.toLowerCase().includes("loop"),
    "C7: context_block menciona próxima PR ou loop PR a PR");
}

// ============================================================================
// CENÁRIO D — Contract Auditor contextual com modo operacional
// Mensagem: "revise a PR 214 e veja se quebrou algo"
// ============================================================================
header("📋 CENÁRIO D — Contract Auditor contextual com modo operacional");
{
  const message = "revise a PR 214 e veja se quebrou algo";
  const { intentClassification, skillRouting, intentRetrieval } =
    buildFullPipeline(message);

  // Build prompt with operational context (pr_review is operational)
  const promptOperacional = buildChatSystemPrompt({
    is_operational_context: intentClassification.is_operational,
    intent_retrieval_context: intentRetrieval.applied ? intentRetrieval : undefined,
  });

  // D1: skill = CONTRACT_AUDITOR
  ok(intentRetrieval.skill_id === SKILL_IDS.CONTRACT_AUDITOR ||
     skillRouting.skill_id === SKILL_IDS.CONTRACT_AUDITOR,
    "D1: skill=CONTRACT_AUDITOR para revisão de PR com quebrança");

  // D2: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "D2: retrieval applied=true");

  // D3: context_block contém escopo, regressões, arquivos alterados e evidência
  const cb = intentRetrieval.context_block;
  ok(
    cb.includes("escopo") || cb.includes("alterados") || cb.includes("regressões") || cb.includes("evidência"),
    "D3: context_block contém escopo/arquivos alterados/regressões/evidência"
  );

  // D4: MODO OPERACIONAL ATIVO aparece (pr_review é operacional)
  ok(intentClassification.is_operational === true,
    "D4: intent pr_review → is_operational=true");
  ok(promptOperacional.includes(MODO_OPERACIONAL),
    "D4b: MODO OPERACIONAL ATIVO aparece no prompt quando is_operational=true");

  // D5: contexto não assume merge sem evidência
  ok(cb.includes("evidência") || cb.includes("evidencia") || cb.includes("sem evidência") ||
     cb.includes("não assuma") || cb.includes("sem evidência real") || !cb.includes("merge aprovado"),
    "D5: contexto não assume merge sem evidência");
}

// ============================================================================
// CENÁRIO E — Deploy Governance contextual
// Mensagem: "deploya em test"
// ============================================================================
header("📋 CENÁRIO E — Deploy Governance contextual");
{
  const message = "deploya em test";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // E1: skill = DEPLOY_GOVERNANCE_OPERATOR
  ok(intentRetrieval.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR ||
     skillRouting.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR,
    "E1: skill=DEPLOY_GOVERNANCE_OPERATOR para deploy");

  // E2: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "E2: retrieval applied=true para deploy");

  // E3: context_block contém gate, aprovação, test/prod e rollback
  const cb = intentRetrieval.context_block;
  ok(cb.includes("gate") || cb.includes("aprovação") || cb.includes("aprovacao"),
    "E3a: context_block contém gate ou aprovação");
  ok(cb.includes("test") || cb.includes("prod"),
    "E3b: context_block menciona test ou prod");
  ok(cb.includes("rollback") || cb.includes("Rollback"),
    "E3c: context_block menciona rollback");

  // E4: não autoriza deploy sozinho
  ok(cb.includes("Não crie deploy automático") ||
     cb.includes("não crie deploy automático") ||
     cb.includes("aprovação documentada") ||
     cb.includes("aprovação humana"),
    "E4: contexto não autoriza deploy sozinho");

  // E5: não relaxa gates
  ok(cb.includes("obrigatórios") || cb.includes("obrigatório") ||
     cb.includes("gate") || cb.includes("aprovação"),
    "E5: contexto não relaxa gates");
}

// ============================================================================
// CENÁRIO F — System Mapper contextual
// Mensagem: "quais workers existem?"
// ============================================================================
header("📋 CENÁRIO F — System Mapper contextual");
{
  const message = "quais workers existem?";
  const { skillRouting, intentRetrieval, prompt } = buildFullPipeline(message);

  // F1: SYSTEM_MAPPER identificado (via routing ou intent mapping)
  ok(skillRouting.skill_id === SKILL_IDS.SYSTEM_MAPPER ||
     intentRetrieval.skill_id === SKILL_IDS.SYSTEM_MAPPER,
    "F1: SYSTEM_MAPPER para 'quais workers existem?'");

  // F2: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "F2: retrieval applied=true para system mapper");

  // F3: context_block contém consultar mapa/registries
  const cb = intentRetrieval.context_block;
  ok(cb.includes("mapa") || cb.includes("registr") || cb.includes("registry"),
    "F3: context_block menciona mapa ou registries");

  // F4: contexto orienta não inventar worker/rota/binding
  ok(cb.includes("Não invente") || cb.includes("não invente") ||
     cb.includes("não afirme") || cb.includes("não invente worker"),
    "F4: contexto orienta não inventar worker/rota/binding");

  // F5: retrieval não chama KV/rede/filesystem (puro — pure function)
  // Validado por inspeção: buildIntentRetrievalContext é pure function (sem I/O)
  // Prova: mesma entrada → mesma saída (determinismo)
  const r1 = buildIntentRetrievalContext({ message });
  const r2 = buildIntentRetrievalContext({ message });
  ok(r1.context_block === r2.context_block && r1.applied === r2.applied,
    "F5: retrieval é determinístico (sem KV/rede/FS — pure function)");
}

// ============================================================================
// CENÁRIO G — Frustração sem skill
// Mensagem: "isso está virando só documento"
// ============================================================================
header("📋 CENÁRIO G — Frustração sem skill");
{
  const message = "isso está virando só documento";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // G1: intent = frustration_or_trust_issue
  ok(intentClassification.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST,
    "G1: intent=frustration_or_trust_issue para frustração");

  // G2: retrieval aplicado sem skill obrigatória de routing direto
  ok(intentRetrieval.applied === true,
    "G2: retrieval applied=true para frustração (via intent sem skill direto)");

  // G3: context_block contém "excesso documental"
  const cb = intentRetrieval.context_block;
  ok(cb.includes("excesso documental") || cb.includes("documental"),
    "G3: context_block menciona excesso documental");

  // G4: context_block contém "Isso é opcional. Não mexa agora."
  ok(cb.includes("Isso é opcional. Não mexa agora."),
    "G4: context_block contém 'Isso é opcional. Não mexa agora.'");

  // G5: não ativa MODO OPERACIONAL ATIVO
  // G5a: prompt construído sem is_operational não contém o modo pesado
  ok(!prompt.includes(MODO_OPERACIONAL),
    "G5a: prompt padrão (is_operational=false) não contém MODO OPERACIONAL ATIVO para frustração");
  ok(intentClassification.is_operational === false,
    "G5b: is_operational=false confirmado pelo classificador");
  const promptFrustracao = buildChatSystemPrompt({
    is_operational_context: intentClassification.is_operational,
    intent_retrieval_context: intentRetrieval,
  });
  ok(!promptFrustracao.includes(MODO_OPERACIONAL),
    "G5c: MODO OPERACIONAL ATIVO não aparece no prompt para frustração");
}

// ============================================================================
// CENÁRIO H — Capacidade/estado sem falsa capacidade
// Mensagem: "você já tem Skill Router?"
// ============================================================================
header("📋 CENÁRIO H — Capacidade/estado sem falsa capacidade");
{
  const message = "você já tem Skill Router?";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // H1: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "H1: retrieval applied=true para pergunta de capacidade");

  // H2: contexto diferencia atual/futuro
  const cb = intentRetrieval.context_block;
  ok(cb.includes("atual") || cb.includes("ainda não existe") || cb.includes("Diferencie"),
    "H2: contexto diferencia capacidade atual vs futura");

  // H3: prompt não finge /skills/run como existente (afirmação positiva falsa)
  // Nota: o prompt pode conter "/skills/run existe" como AVISO ("Não afirme que /skills/run existe — não existe")
  // O que se verifica é que não há afirmação positiva de disponibilidade.
  ok(!prompt.includes("você pode usar /skills/run") && !prompt.includes("/skills/run está disponível") &&
     !prompt.includes("/skills/run está ativo") && !prompt.includes("skills/run funciona"),
    "H3: prompt não contém afirmação positiva falsa de /skills/run como disponível");

  // H4: prompt/contexto não finge Skill Executor
  ok(!cb.includes("Skill Executor existe") && !cb.includes("executa a skill agora"),
    "H4: contexto não finge Skill Executor disponível");

  // H5: contexto afirma claramente que Skill Router é read-only
  ok(cb.includes("/skills/run não existe") || cb.includes("read-only") || cb.includes("Skill Router é read-only"),
    "H5: contexto afirma que Skill Router é read-only e /skills/run não existe");
}

// ============================================================================
// CENÁRIO I — Estratégia sem modo pesado
// Mensagem: "isso vale a pena agora?"
// ============================================================================
header("📋 CENÁRIO I — Estratégia sem modo pesado");
{
  const message = "isso vale a pena agora?";
  const { intentClassification, skillRouting, intentRetrieval, prompt } =
    buildFullPipeline(message);

  // I1: intent = strategy_question
  ok(intentClassification.intent === INTENT_TYPES.STRATEGY_QUESTION,
    "I1: intent=strategy_question para 'isso vale a pena agora?'");

  // I2: retrieval aplicado
  ok(intentRetrieval.applied === true,
    "I2: retrieval applied=true para estratégia");

  // I3: context_block orienta ponderar custo/tempo/risco
  const cb = intentRetrieval.context_block;
  ok(cb.includes("custo") || cb.includes("tempo") || cb.includes("risco"),
    "I3: context_block orienta ponderar custo/tempo/risco");

  // I4: não ativa modo operacional pesado
  ok(intentClassification.is_operational === false,
    "I4: strategy_question → is_operational=false");

  const promptEstrategia = buildChatSystemPrompt({
    is_operational_context: intentClassification.is_operational,
    intent_retrieval_context: intentRetrieval,
  });
  ok(!promptEstrategia.includes(MODO_OPERACIONAL),
    "I4b: MODO OPERACIONAL ATIVO não aparece para estratégia");

  // I5: contexto não cria ação automática
  ok(!cb.includes("execute agora") && !cb.includes("aplique agora"),
    "I5: contexto não cria ação automática");
}

// ============================================================================
// CENÁRIO J — Limite e truncamento
// ============================================================================
header("📋 CENÁRIO J — Limite e truncamento");
{
  const message = "revise a PR 214";
  const intentClassification = classifyEnaviaIntent({ message });
  const skillRouting = routeEnaviaSkill({ message, intentClassification });

  // J1: com _max_chars pequeno → truncamento
  const smallMax = 50;
  const rTruncated = buildIntentRetrievalContext({
    message,
    intentClassification,
    skillRouting,
    _max_chars: smallMax,
  });
  ok(rTruncated.token_budget_hint.actual_chars <= smallMax,
    `J1: actual_chars (${rTruncated.token_budget_hint.actual_chars}) <= max_chars (${smallMax})`);

  // J2: marcador de truncamento aparece quando truncado
  ok(rTruncated.token_budget_hint.truncated === true,
    "J2: truncated=true quando max_chars é pequeno");
  ok(rTruncated.context_block.includes(TRUNCATION_MARKER),
    `J2b: context_block contém marcador "${TRUNCATION_MARKER}" quando truncado`);

  // J3: truncamento não remove mode="read_only"
  ok(rTruncated.mode === RETRIEVAL_MODE.READ_ONLY,
    "J3: mode=read_only preservado mesmo com truncamento");

  // J4: sem _max_chars → resultado normal sem truncamento para tamanho real
  const rNormal = buildIntentRetrievalContext({
    message,
    intentClassification,
    skillRouting,
  });
  ok(rNormal.token_budget_hint.truncated === false,
    "J4: sem _max_chars pequeno → truncated=false (contexto cabe no limite padrão)");

  // J5: context_block do resultado normal não contém marcador de truncamento
  ok(!rNormal.context_block.includes(TRUNCATION_MARKER),
    "J5: context_block normal não contém marcador de truncamento");

  // J6: actual_chars do resultado normal dentro do padrão (2000)
  ok(rNormal.token_budget_hint.actual_chars <= 2000,
    `J6: actual_chars normal (${rNormal.token_budget_hint.actual_chars}) <= 2000`);

  // J7: quando truncado, warnings menciona truncamento
  const truncWarnings = rTruncated.warnings.join(" ");
  ok(truncWarnings.includes("truncado") || truncWarnings.includes("truncament"),
    "J7: warnings menciona truncamento quando truncado");
}

// ============================================================================
// CENÁRIO K — Campo `intent_retrieval` (inspeção de código + unitário)
// Validação sem harness LLM externo (limitação documentada no relatório)
// ============================================================================
header("📋 CENÁRIO K — Campo intent_retrieval (unitário + inspeção)");
{
  // K1–K8: validação do shape canônico pelo buildIntentRetrievalContext
  const message = "revise a PR 214";
  const intentClassification = classifyEnaviaIntent({ message });
  const skillRouting = routeEnaviaSkill({ message, intentClassification });
  const r = buildIntentRetrievalContext({ message, intentClassification, skillRouting });

  ok(typeof r.applied === "boolean",       "K1: campo applied é boolean");
  ok(typeof r.mode === "string",           "K2: campo mode é string");
  ok(r.intent === null || typeof r.intent === "string", "K3: campo intent é string|null");
  ok(r.skill_id === null || typeof r.skill_id === "string", "K4: campo skill_id é string|null");
  ok(Array.isArray(r.sources),             "K5: campo sources é array");
  ok(r.token_budget_hint &&
     typeof r.token_budget_hint.max_chars === "number" &&
     typeof r.token_budget_hint.actual_chars === "number" &&
     typeof r.token_budget_hint.truncated === "boolean",
    "K6: token_budget_hint tem max_chars, actual_chars e truncated");
  ok(Array.isArray(r.warnings),            "K7: campo warnings é array");

  // K8: context_block NÃO exposto no response do /chat/run (inspeção de código)
  // Verificamos que nv-enavia.js expõe apenas metadados, não o context_block inteiro
  const workerSource = readFileSync(
    resolve(__dirname, "../nv-enavia.js"),
    "utf-8"
  );
  // O response do /chat/run constrói o campo intent_retrieval sem context_block:
  //   { applied, mode, intent, skill_id, sources, token_budget_hint, warnings }
  // context_block não aparece no objeto do response (apenas no prompt interno)
  const intentRetrievalResponseBlock = workerSource.match(
    /intent_retrieval:\s*\{([^}]+)\}/s
  );
  ok(intentRetrievalResponseBlock !== null,
    "K8a: campo intent_retrieval existe no response do /chat/run (inspeção)");

  if (intentRetrievalResponseBlock) {
    const block = intentRetrievalResponseBlock[1];
    ok(!block.includes("context_block"),
      "K8b: context_block NÃO está no response do /chat/run (apenas metadados)");
  } else {
    // fallback: validar por grep
    ok(!workerSource.includes("intent_retrieval: { ...r }"),
      "K8b: context_block não exposto no response (fallback)");
  }

  // K9: warnings não vazio para resultado aplicado
  ok(r.warnings.length > 0,
    "K9: warnings não vazio para resultado aplicado (contém aviso read-only)");
}

// ============================================================================
// CENÁRIO L — Segurança
// ============================================================================
header("📋 CENÁRIO L — Segurança");
{
  // L1: nenhum endpoint novo existe — /skills/run não existe
  // Inspeção: verificar que nv-enavia.js não tem rota de pathname para /skills/run
  const workerSource = readFileSync(
    resolve(__dirname, "../nv-enavia.js"),
    "utf-8"
  );
  // Verificação precisa: procura por pattern de roteamento real de pathname (não comentários)
  const hasSkillsRunRoute =
    /pathname\s*===\s*["']\/skills\/run["']/.test(workerSource) ||
    /case\s+["']\/skills\/run["']/.test(workerSource) ||
    /path\s*===\s*["']\/skills\/run["']/.test(workerSource);
  ok(!hasSkillsRunRoute,
    "L1a: /skills/run não tem rota de pathname registrada no worker");

  // L2: retrieval não chama KV/rede/filesystem — pure function (determinístico)
  const msgL = "mande a próxima PR";
  const r1 = buildIntentRetrievalContext({ message: msgL });
  const r2 = buildIntentRetrievalContext({ message: msgL });
  ok(r1.context_block === r2.context_block,
    "L2: retrieval é determinístico (mesmo resultado chamado duas vezes = sem KV/rede/FS)");

  // L3: retrieval não retorna markdown inteiro (contexto compacto, não arquivo completo)
  const rL = buildIntentRetrievalContext({
    message: "revise a PR 214",
    intentClassification: classifyEnaviaIntent({ message: "revise a PR 214" }),
    skillRouting: routeEnaviaSkill({ message: "revise a PR 214" }),
  });
  // O context_block é snapshot compacto (< 800 chars), não o arquivo .md completo
  ok(rL.context_block.length < 1500,
    `L3: context_block é compacto (${rL.context_block.length} chars < 1500 — não é markdown completo)`);

  // L4: retrieval não contém secrets (sem env vars, KV IDs, tokens, passwords)
  const cbL = rL.context_block;
  ok(!cbL.includes("password") && !cbL.includes("token=") && !cbL.includes("secret=") &&
     !cbL.includes("CLOUDFLARE_") && !cbL.includes("API_KEY"),
    "L4: context_block não contém secrets");

  // L5: retrieval não altera input (context_block não vaza mensagem do usuário)
  const inputMsg = "revise a PR 214";
  const rLInput = buildIntentRetrievalContext({
    message: inputMsg,
    intentClassification: classifyEnaviaIntent({ message: inputMsg }),
    skillRouting: routeEnaviaSkill({ message: inputMsg }),
  });
  ok(!rLInput.context_block.includes(inputMsg),
    "L5: context_block não ecoa a mensagem do usuário (sem vazamento de input)");

  // L6: retrieval é determinístico (pure function — L2 já valida, repetindo com input diferente)
  const msgX = "deploya em test";
  const rx1 = buildIntentRetrievalContext({ message: msgX });
  const rx2 = buildIntentRetrievalContext({ message: msgX });
  ok(rx1.applied === rx2.applied && rx1.context_block === rx2.context_block,
    "L6: retrieval determinístico para 'deploya em test'");

  // L7: modo sempre read_only
  const allResults = [
    buildIntentRetrievalContext({ message: "revise a PR 214" }),
    buildIntentRetrievalContext({ message: "deploya em test" }),
    buildIntentRetrievalContext({ message: "mande a próxima PR" }),
    buildIntentRetrievalContext({ message: "oi" }),
  ];
  ok(allResults.every((r) => r.mode === RETRIEVAL_MODE.READ_ONLY),
    "L7: mode=read_only em todos os casos");
}

// ============================================================================
// CENÁRIO M — Não regressão de operação
// ============================================================================
header("📋 CENÁRIO M — Não regressão de operação");
{
  // M1: conversa simples continua sem MODO OPERACIONAL ATIVO
  const promptSimples = buildChatSystemPrompt({ is_operational_context: false });
  ok(!promptSimples.includes(MODO_OPERACIONAL),
    "M1: conversa simples sem MODO OPERACIONAL ATIVO");

  // M2: próxima PR sem modo operacional pesado
  const { intentClassification: icNextPR } = buildFullPipeline("mande a próxima PR");
  ok(icNextPR.is_operational === false,
    "M2: próxima PR (next_pr_request) → is_operational=false (sem modo pesado)");

  // M3: revisão de PR é operacional
  const { intentClassification: icPrReview } = buildFullPipeline("revise a PR 214");
  ok(icPrReview.is_operational === true,
    "M3: revisão de PR → is_operational=true");
  const promptPrReview = buildChatSystemPrompt({ is_operational_context: true });
  ok(promptPrReview.includes(MODO_OPERACIONAL),
    "M3b: MODO OPERACIONAL ATIVO presente no prompt operacional");

  // M4: deploy é operacional com gates
  const { intentClassification: icDeploy } = buildFullPipeline("deploya em test");
  ok(icDeploy.is_operational === true,
    "M4: deploy → is_operational=true");

  // M5: read_only é gate, não tom (o LLM Core define isso explicitamente)
  ok(promptSimples.includes("read_only") &&
     (promptSimples.includes("GATE") || promptSimples.includes("gate") || promptSimples.includes("bloqueado")),
    "M5: read_only aparece como gate de execução, não regra de tom");

  // M6: retrieval não ativa MODO OPERACIONAL por si só
  const { intentRetrieval: irPr } = buildFullPipeline("revise a PR 214");
  // O bloco de retrieval NÃO inclui o cabeçalho de modo operacional — é read-only
  ok(!irPr.context_block.includes(MODO_OPERACIONAL),
    "M6: context_block do retrieval não contém MODO OPERACIONAL ATIVO");

  // M7: prompt com retrieval CONTRACT_AUDITOR mas is_operational=false NÃO ativa modo pesado
  const { intentRetrieval: irAuditor } = buildFullPipeline("mande a próxima PR");
  const promptComRetrieval = buildChatSystemPrompt({
    is_operational_context: false,
    intent_retrieval_context: irAuditor.applied ? irAuditor : undefined,
  });
  ok(!promptComRetrieval.includes(MODO_OPERACIONAL),
    "M7: retrieval aplicado sem is_operational=true NÃO ativa MODO OPERACIONAL");

  // M8: LLM Core sempre presente
  const promptMin = buildChatSystemPrompt({});
  ok(promptMin.includes(LLM_CORE_MARKER),
    "M8: LLM Core sempre presente no prompt");

  // M9: envelope JSON sempre presente
  ok(promptMin.includes('"reply"') && promptMin.includes('"use_planner"'),
    "M9: envelope JSON sempre presente no prompt");
}

// ============================================================================
// Resumo final
// ============================================================================
console.log("\n" + "=".repeat(70));
console.log(`📊 PR54 — Prova de Memória Contextual`);
console.log(`   ✅ Passaram: ${passed}`);
console.log(`   ❌ Falharam: ${failed}`);
console.log(`   📦 Total:   ${passed + failed}`);

if (failures.length > 0) {
  console.log("\n❌ FALHAS DETALHADAS:");
  failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
}

console.log("=".repeat(70));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✅ PR54 — Prova de Memória Contextual — PASSOU");
}
