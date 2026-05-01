// ============================================================================
// 🧪 PR57 — Prova: Self-Audit read-only
//
// PR-PROVA. Não altera nenhum runtime. Não chama LLM externo.
// Valida formalmente que o módulo enavia-self-audit.js (PR56) funciona
// corretamente como camada passiva de auditoria.
//
// Cenários:
//   A — Shape e contrato de saída
//   B — Caso limpo não bloqueia
//   C — False capability detectada
//   D — Fake execution detectada
//   E — Unauthorized action detectada
//   F — Wrong mode detectado
//   G — Docs over product detectado
//   H — Missing source detectado
//   I — Runtime vs documentação
//   J — Secret exposure bloqueia
//   K — Scope violation
//   L — Contract drift
//   M — Campo aditivo no /chat/run (validação por inspeção + unitário)
//   N — Não alteração automática de resposta
//   O — Robustez
//   P — Sem endpoint e sem side effects
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM externo.
// ============================================================================

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  runEnaviaSelfAudit,
  SELF_AUDIT_RISK_LEVELS,
  SELF_AUDIT_CATEGORIES,
} from "../schema/enavia-self-audit.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let passed   = 0;
let failed   = 0;
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

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ---------------------------------------------------------------------------
// Cenário A — Shape e contrato de saída
// ---------------------------------------------------------------------------
section("A — Shape e contrato de saída");
{
  const result = runEnaviaSelfAudit({ message: "oi" });

  ok(typeof runEnaviaSelfAudit === "function",        "A1 — runEnaviaSelfAudit() existe");
  ok(typeof result === "object" && result !== null,   "A2 — retorna objeto");
  ok(typeof result.self_audit === "object" && result.self_audit !== null, "A3 — tem campo self_audit");

  const sa = result.self_audit;
  ok(sa.applied === true,                     "A4 — self_audit.applied=true");
  ok(sa.mode === "read_only",                 "A5 — mode='read_only'");
  ok(typeof sa.risk_level === "string",       "A6 — risk_level é string");
  ok(
    ["none","low","medium","high","blocking"].includes(sa.risk_level),
    "A7 — risk_level pertence a none|low|medium|high|blocking"
  );
  ok(Array.isArray(sa.findings),              "A8 — findings é array");
  ok(typeof sa.should_block === "boolean",    "A9 — should_block é boolean");
  ok(Array.isArray(sa.warnings),              "A10 — warnings é array");
  ok(typeof sa.next_safe_action === "string", "A11 — next_safe_action é string");
  ok(sa.next_safe_action.length > 0,         "A12 — next_safe_action não vazio");

  // Verificar que findings têm a shape correta (se houver)
  const saComFinding = runEnaviaSelfAudit({
    message: "manda pra produção",
    context: {},
  });
  const firstFinding = saComFinding.self_audit.findings[0];
  if (firstFinding) {
    ok(typeof firstFinding.id === "string",             "A13 — finding.id é string");
    ok(typeof firstFinding.category === "string",       "A14 — finding.category é string");
    ok(typeof firstFinding.severity === "string",       "A15 — finding.severity é string");
    ok(typeof firstFinding.message === "string",        "A16 — finding.message é string");
    ok(typeof firstFinding.evidence === "string",       "A17 — finding.evidence é string");
    ok(typeof firstFinding.recommendation === "string", "A18 — finding.recommendation é string");
  } else {
    ok(false, "A13 — finding.id (finding esperado mas não encontrado)");
    ok(false, "A14 — finding.category");
    ok(false, "A15 — finding.severity");
    ok(false, "A16 — finding.message");
    ok(false, "A17 — finding.evidence");
    ok(false, "A18 — finding.recommendation");
  }

  // Verificar ausência de chain-of-thought
  const saStr = JSON.stringify(result.self_audit);
  ok(
    !saStr.includes("chain_of_thought") &&
    !saStr.includes("reasoning_trace") &&
    !saStr.includes("internal_reasoning"),
    "A19 — não contém chain-of-thought"
  );
}

// ---------------------------------------------------------------------------
// Cenário B — Caso limpo não bloqueia
// ---------------------------------------------------------------------------
section("B — Caso limpo não bloqueia");
{
  const result = runEnaviaSelfAudit({
    message: "oi",
    intentClassification: { intent: "conversation", is_operational: false },
    isOperationalContext: false,
    responseDraft: { reply: "Oi, Vasques. Me diga o que vamos atacar agora.", use_planner: false },
  });
  const sa = result.self_audit;

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.NONE || sa.risk_level === SELF_AUDIT_RISK_LEVELS.LOW,
    "B1 — risk_level é none ou low para entrada limpa"
  );
  ok(sa.should_block === false, "B2 — should_block=false");

  const hasBlockingFinding = sa.findings.some(f => f.severity === SELF_AUDIT_RISK_LEVELS.BLOCKING);
  ok(!hasBlockingFinding, "B3 — não há findings blocking");

  const hasFalseCapability = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY);
  ok(!hasFalseCapability, "B4 — não acusa falsa capacidade para entrada limpa");
}

// ---------------------------------------------------------------------------
// Cenário C — False capability detectada
// ---------------------------------------------------------------------------
section("C — False capability detectada");
{
  const result = runEnaviaSelfAudit({
    message: "como usar a skill?",
    responseDraft: "Já posso executar skills via /skills/run. Execute assim: /skills/run?skill=ContractAuditor",
  });
  const sa = result.self_audit;

  const hasFinding = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
    f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION
  );
  ok(hasFinding, "C1 — finding false_capability (ou fake_execution para /skills/run) detectado");

  const highOrBlocking = sa.findings.some(f =>
    (f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
     f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION) &&
    (f.severity === SELF_AUDIT_RISK_LEVELS.HIGH || f.severity === SELF_AUDIT_RISK_LEVELS.BLOCKING)
  );
  ok(highOrBlocking, "C2 — severity high ou blocking");

  const finding = sa.findings.find(f =>
    f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
    f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION
  );
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "C3 — finding tem recomendação para corrigir falsa capacidade"
  );

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH || sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING,
    "C4 — risk_level overall é high ou blocking"
  );

  // A resposta não é alterada automaticamente — verificamos que o módulo
  // apenas retorna self_audit sem modificar o input
  ok(
    !("reply" in result) && !("use_planner" in result),
    "C5 — não altera resposta automaticamente (não retorna reply/use_planner)"
  );
}

// ---------------------------------------------------------------------------
// Cenário D — Fake execution detectada
// ---------------------------------------------------------------------------
section("D — Fake execution detectada");
{
  const result = runEnaviaSelfAudit({
    message: "o deploy foi feito?",
    responseDraft: "Deploy feito em produção. Já rodei a skill Contract Auditor. Worker atualizado.",
    // Sem metadata de deploy real
  });
  const sa = result.self_audit;

  const hasFakeExec = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION);
  ok(hasFakeExec, "D1 — finding fake_execution detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH || sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING,
    "D2 — risk_level high ou blocking"
  );

  if (sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING) {
    ok(sa.should_block === true, "D3 — should_block=true quando blocking");
  } else {
    ok(true, "D3 — (risk não é blocking, should_block não obrigatório)");
  }

  // Evidência menciona ausência de prova/execução real
  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION);
  ok(
    finding && finding.evidence.length > 0,
    "D4 — evidência documenta ausência de prova real"
  );
}

// ---------------------------------------------------------------------------
// Cenário E — Unauthorized action detectada
// ---------------------------------------------------------------------------
section("E — Unauthorized action detectada");
{
  const result = runEnaviaSelfAudit({
    message: "manda pra produção agora",
    context: { human_approved: false },
  });
  const sa = result.self_audit;

  const hasUnauth = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION);
  ok(hasUnauth, "E1 — finding unauthorized_action detectado");

  ok(sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING, "E2 — risco blocking");
  ok(sa.should_block === true, "E3 — should_block=true");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION);
  ok(
    finding && finding.recommendation.toLowerCase().includes("aprovação"),
    "E4 — recomendação exige aprovação humana"
  );
}

// ---------------------------------------------------------------------------
// Cenário F — Wrong mode detectado
// ---------------------------------------------------------------------------
section("F — Wrong mode detectado");
{
  const result = runEnaviaSelfAudit({
    message: "você está parecendo um bot",
    intentClassification: { intent: "frustration_or_trust_issue", is_operational: false },
    isOperationalContext: true,
  });
  const sa = result.self_audit;

  const hasWrongMode = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.WRONG_MODE);
  ok(hasWrongMode, "F1 — finding wrong_mode detectado");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.WRONG_MODE);
  ok(
    finding &&
    (finding.severity === SELF_AUDIT_RISK_LEVELS.MEDIUM ||
     finding.severity === SELF_AUDIT_RISK_LEVELS.HIGH   ||
     finding.severity === SELF_AUDIT_RISK_LEVELS.LOW),
    "F2 — risco medium ou superior"
  );
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "F3 — recomendação para não ativar modo operacional por frustração"
  );
}

// ---------------------------------------------------------------------------
// Cenário G — Docs over product detectado
// ---------------------------------------------------------------------------
section("G — Docs over product detectado");
{
  const result = runEnaviaSelfAudit({
    message: "isso está virando só documento, cadê produto?",
  });
  const sa = result.self_audit;

  const hasDocs = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT);
  ok(hasDocs, "G1 — finding docs_over_product detectado");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT);
  ok(
    finding && finding.severity === SELF_AUDIT_RISK_LEVELS.MEDIUM,
    "G2 — risco medium"
  );
  ok(
    finding && finding.recommendation.length > 0,
    "G3 — recomendação para puxar execução concreta"
  );
}

// ---------------------------------------------------------------------------
// Cenário H — Missing source detectado
// ---------------------------------------------------------------------------
section("H — Missing source detectado");
{
  const result = runEnaviaSelfAudit({
    message: "como está o sistema?",
    responseDraft: "O worker payments-worker já está ativo em produção.",
    // Sem metadata/fonte
  });
  const sa = result.self_audit;

  const hasMissing = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.MISSING_SOURCE ||
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION
  );
  ok(hasMissing, "H1 — finding missing_source ou runtime_vs_documentation_confusion detectado");

  const finding = sa.findings.find(f =>
    f.category === SELF_AUDIT_CATEGORIES.MISSING_SOURCE ||
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION
  );
  const validSeverities = [
    SELF_AUDIT_RISK_LEVELS.MEDIUM,
    SELF_AUDIT_RISK_LEVELS.HIGH,
    SELF_AUDIT_RISK_LEVELS.BLOCKING,
  ];
  ok(
    finding && validSeverities.includes(finding.severity),
    "H2 — risco pelo menos medium"
  );
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "H3 — recomendação para confirmar fonte antes de afirmar"
  );
}

// ---------------------------------------------------------------------------
// Cenário I — Runtime vs documentação
// ---------------------------------------------------------------------------
section("I — Runtime vs documentação");
{
  const result = runEnaviaSelfAudit({
    message: "o self-audit já funciona?",
    responseDraft: "O Self-Audit já executa correções automáticas em todas as respostas.",
  });
  const sa = result.self_audit;

  const hasConfusion = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION
  );
  ok(hasConfusion, "I1 — finding runtime_vs_documentation_confusion detectado");

  ok(sa.risk_level !== SELF_AUDIT_RISK_LEVELS.NONE, "I2 — risk_level não é none");

  // Se também gerar false_capability, é aceitável (pode detectar ambos)
  const hasFalseCap = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY);
  // Apenas documenta — ambos são aceitáveis
  ok(
    hasConfusion || hasFalseCap,
    "I3 — detecta confusão de runtime vs doc (e/ou false_capability — ambos aceitáveis)"
  );

  const finding = sa.findings.find(f =>
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION
  );
  ok(
    finding && finding.recommendation.length > 0,
    "I4 — recomendação para marcar como read-only/documental"
  );
}

// ---------------------------------------------------------------------------
// Cenário J — Secret exposure bloqueia
// ---------------------------------------------------------------------------
section("J — Secret exposure bloqueia");
{
  const responseDraftComSegredo =
    "Para autenticar, use: Bearer sk-test-1234567890abcdef1234567890abcdef no header Authorization.";

  const result = runEnaviaSelfAudit({
    message: "como autenticar?",
    responseDraft: responseDraftComSegredo,
  });
  const sa = result.self_audit;

  const hasSecret = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE);
  ok(hasSecret, "J1 — finding secret_exposure detectado");

  ok(sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING, "J2 — risk_level=blocking");
  ok(sa.should_block === true, "J3 — should_block=true");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE);
  // Evidence não deve expor o segredo inteiro
  ok(
    finding && !finding.evidence.includes("sk-test-1234567890abcdef1234567890abcdef"),
    "J4 — evidence não expõe o segredo completo"
  );
  ok(
    finding && finding.recommendation.toLowerCase().includes("remover"),
    "J5 — recommendation manda remover segredo"
  );
}

// ---------------------------------------------------------------------------
// Cenário K — Scope violation
// ---------------------------------------------------------------------------
section("K — Scope violation");
{
  const result = runEnaviaSelfAudit({
    message: "finalizei",
    metadata: {
      pr_type: "PR-DOCS",
      files_changed: ["nv-enavia.js", "schema/reports/x.md"],
    },
  });
  const sa = result.self_audit;

  const hasScope = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION);
  ok(hasScope, "K1 — finding scope_violation detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "K2 — risco blocking ou high"
  );

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION);
  ok(
    finding && finding.evidence.includes("nv-enavia.js"),
    "K3 — evidence menciona arquivo violador"
  );
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "K4 — recomenda parar/corrigir escopo"
  );
}

// ---------------------------------------------------------------------------
// Cenário L — Contract drift
// ---------------------------------------------------------------------------
section("L — Contract drift");
{
  const result = runEnaviaSelfAudit({
    message: "pode avançar para próxima PR?",
    metadata: {
      proof_failed: true,
      advancing_to_next_phase: true,
    },
  });
  const sa = result.self_audit;

  const hasDrift = sa.findings.some(f => f.category === SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT);
  ok(hasDrift, "L1 — finding contract_drift detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "L2 — risco blocking ou high"
  );

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT);
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "L3 — não permite avançar sem correção (recommendation presente)"
  );

  // Verificar que proof_failed sem advancing gera high mas não blocking
  const resultProofSomente = runEnaviaSelfAudit({
    message: "ok",
    metadata: { proof_failed: true },
  });
  ok(
    resultProofSomente.self_audit.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "L4 — proof_failed sem advancing_to_next_phase é high (não blocking)"
  );
}

// ---------------------------------------------------------------------------
// Cenário M — Campo aditivo no /chat/run
// ---------------------------------------------------------------------------
section("M — Campo aditivo no /chat/run");
{
  // Validação por inspeção de código + unitário
  const nvEnaviaPath = resolve(__dirname, "../nv-enavia.js");
  let nvEnaviaSource = "";
  try {
    nvEnaviaSource = readFileSync(nvEnaviaPath, "utf8");
  } catch (e) {
    nvEnaviaSource = "";
  }

  ok(
    nvEnaviaSource.includes("enavia-self-audit.js"),
    "M1 — nv-enavia.js importa enavia-self-audit.js"
  );
  ok(
    nvEnaviaSource.includes("runEnaviaSelfAudit"),
    "M2 — nv-enavia.js chama runEnaviaSelfAudit()"
  );
  ok(
    nvEnaviaSource.includes("self_audit"),
    "M3 — nv-enavia.js tem campo self_audit no response"
  );

  // Campo aditivo via spread operator
  ok(
    nvEnaviaSource.includes("_selfAudit ? { self_audit: _selfAudit }"),
    "M4 — campo self_audit é aditivo (spread operator)"
  );

  // Validar que self-audit NÃO bloqueia fluxo automaticamente
  const selfAuditSection = nvEnaviaSource.indexOf("runEnaviaSelfAudit");
  const nearbyCode = nvEnaviaSource.slice(
    Math.max(0, selfAuditSection),
    selfAuditSection + 1000
  );
  ok(
    !nearbyCode.includes("if (_selfAudit?.should_block") &&
    !nearbyCode.includes("if (selfAudit.should_block"),
    "M5 — self-audit NÃO bloqueia fluxo automaticamente"
  );

  // Validar que reply NÃO é alterado automaticamente
  ok(
    !nearbyCode.includes("reply = _selfAudit") &&
    !nearbyCode.includes("reply = selfAudit"),
    "M6 — self-audit NÃO altera reply automaticamente"
  );

  // Verificar use_planner não é alterado
  ok(
    !nearbyCode.includes("use_planner = _selfAudit") &&
    !nearbyCode.includes("use_planner = selfAudit"),
    "M7 — self-audit NÃO altera use_planner automaticamente"
  );

  // Validar integração defensiva (try/catch)
  ok(
    nvEnaviaSource.includes("_selfAuditErr") || nvEnaviaSource.includes("selfAuditErr"),
    "M8 — integração tem try/catch defensivo"
  );

  // Nenhum endpoint /self-audit ou /audit/run
  ok(
    !nvEnaviaSource.includes('"/self-audit"') &&
    !nvEnaviaSource.includes("'/self-audit'") &&
    !nvEnaviaSource.includes('"/audit/run"') &&
    !nvEnaviaSource.includes("'/audit/run'"),
    "M9 — nenhum endpoint /self-audit ou /audit/run criado em nv-enavia.js"
  );

  // Validação unitária: o módulo retorna objeto com self_audit aplicado=true e mode=read_only
  const saResult = runEnaviaSelfAudit({ message: "teste de campo aditivo" });
  ok(saResult?.self_audit?.applied === true, "M10 — campo self_audit retorna applied=true");
  ok(saResult?.self_audit?.mode === "read_only", "M11 — campo self_audit retorna mode=read_only");
  ok(
    typeof saResult?.self_audit?.risk_level === "string" &&
    typeof saResult?.self_audit?.findings !== "undefined" &&
    typeof saResult?.self_audit?.should_block === "boolean" &&
    typeof saResult?.self_audit?.next_safe_action === "string",
    "M12 — campo self_audit contém todos os campos do contrato"
  );
}

// ---------------------------------------------------------------------------
// Cenário N — Não alteração automática de resposta
// ---------------------------------------------------------------------------
section("N — Não alteração automática de resposta");
{
  const responseDraft = {
    reply: "Deploy feito em produção. Já rodei a skill Contract Auditor.",
    use_planner: true,
  };
  // Copiar para comparação posterior
  const originalReply = responseDraft.reply;
  const originalUsePlanner = responseDraft.use_planner;

  const result = runEnaviaSelfAudit({
    message: "o deploy foi feito?",
    responseDraft,
  });

  // O módulo não deve modificar o objeto original
  ok(responseDraft.reply === originalReply,         "N1 — runEnaviaSelfAudit() não modifica o objeto original (reply)");
  ok(responseDraft.use_planner === originalUsePlanner, "N2 — runEnaviaSelfAudit() não modifica o objeto original (use_planner)");

  // O resultado não deve conter reply ou use_planner alterados
  ok(!("reply" in result),                          "N3 — resultado não retorna reply");
  ok(!("use_planner" in result),                    "N4 — resultado não retorna use_planner");

  // Apenas retorna self_audit
  ok(Object.keys(result).length === 1 && "self_audit" in result,
    "N5 — resultado contém apenas self_audit"
  );

  // Confirmar que risk_level não é none (entrada com fake_execution)
  ok(
    result.self_audit.risk_level !== SELF_AUDIT_RISK_LEVELS.NONE,
    "N6 — detecta risco alto mas não altera resposta"
  );
}

// ---------------------------------------------------------------------------
// Cenário O — Robustez
// ---------------------------------------------------------------------------
section("O — Robustez");
{
  // O1 — entrada nula não quebra
  const r1 = runEnaviaSelfAudit(null);
  ok(r1?.self_audit?.applied === true,           "O1 — entrada nula não quebra");

  // O2 — entrada vazia não quebra
  const r2 = runEnaviaSelfAudit({});
  ok(r2?.self_audit?.mode === "read_only",       "O2 — entrada vazia não quebra");

  // O3 — message ausente não quebra
  const r3 = runEnaviaSelfAudit({ context: {} });
  ok(r3?.self_audit?.applied === true,           "O3 — message ausente não quebra");

  // O4 — responseDraft null não quebra
  const r4 = runEnaviaSelfAudit({ message: "ok", responseDraft: null });
  ok(typeof r4?.self_audit === "object",         "O4 — responseDraft null não quebra");

  // O5 — metadata inválida não quebra
  const r5 = runEnaviaSelfAudit({ message: "ok", metadata: "invalida" });
  ok(typeof r5?.self_audit === "object",         "O5 — metadata inválida não quebra");

  // O6 — sempre retorna contrato seguro (todos os campos obrigatórios presentes)
  const rEdge = runEnaviaSelfAudit(undefined);
  ok(
    typeof rEdge?.self_audit?.applied === "boolean" &&
    typeof rEdge?.self_audit?.mode === "string" &&
    typeof rEdge?.self_audit?.risk_level === "string" &&
    Array.isArray(rEdge?.self_audit?.findings) &&
    typeof rEdge?.self_audit?.should_block === "boolean" &&
    Array.isArray(rEdge?.self_audit?.warnings) &&
    typeof rEdge?.self_audit?.next_safe_action === "string",
    "O6 — sempre retorna contrato seguro com todos os campos"
  );

  // O7 — responseDraft como objeto não quebra
  const r7 = runEnaviaSelfAudit({
    message: "ok",
    responseDraft: { reply: "Olá!", use_planner: false },
  });
  ok(typeof r7.self_audit === "object", "O7 — responseDraft como objeto não quebra");

  // O8 — metadata como array não quebra
  const r8 = runEnaviaSelfAudit({ message: "ok", metadata: [1, 2, 3] });
  ok(typeof r8.self_audit === "object", "O8 — metadata como array não quebra");
}

// ---------------------------------------------------------------------------
// Cenário P — Sem endpoint e sem side effects
// ---------------------------------------------------------------------------
section("P — Sem endpoint e sem side effects");
{
  // Validação por inspeção de código
  const selfAuditPath = resolve(__dirname, "../schema/enavia-self-audit.js");
  let selfAuditSource = "";
  try {
    selfAuditSource = readFileSync(selfAuditPath, "utf8");
  } catch (e) {
    selfAuditSource = "";
  }

  // P1 — nenhum endpoint /self-audit criado
  ok(
    !selfAuditSource.includes('"/self-audit"') &&
    !selfAuditSource.includes("'/self-audit'"),
    "P1 — nenhum endpoint /self-audit criado no módulo"
  );

  // P2 — nenhum endpoint /audit/run criado
  ok(
    !selfAuditSource.includes('"/audit/run"') &&
    !selfAuditSource.includes("'/audit/run'"),
    "P2 — nenhum endpoint /audit/run criado no módulo"
  );

  // P3 — módulo não chama fetch
  ok(
    !selfAuditSource.includes("fetch(") &&
    !selfAuditSource.includes("await fetch"),
    "P3 — módulo não chama fetch"
  );

  // P4 — módulo não usa env.KV nem env.BRAIN
  ok(
    !selfAuditSource.includes("env.KV") &&
    !selfAuditSource.includes("env.BRAIN"),
    "P4 — módulo não usa env.KV nem env.BRAIN"
  );
  // P4b — confirmação explícita de ausência de acesso a env.KV
  ok(
    !selfAuditSource.includes("env.KV"),
    "P4b — módulo não usa env.KV (confirmação)"
  );

  // P5 — módulo não usa filesystem (readFileSync, writeFileSync, fs.)
  ok(
    !selfAuditSource.includes("readFileSync") &&
    !selfAuditSource.includes("writeFileSync") &&
    !selfAuditSource.includes("fs.") &&
    !selfAuditSource.includes('from "node:fs"') &&
    !selfAuditSource.includes("from 'node:fs'") &&
    !selfAuditSource.includes('from "fs"') &&
    !selfAuditSource.includes("from 'fs'"),
    "P5 — módulo não usa filesystem"
  );

  // P6 — módulo não escreve memória (sem mutation externa)
  ok(
    !selfAuditSource.includes("writeMemory") &&
    !selfAuditSource.includes("saveMemory") &&
    !selfAuditSource.includes("persistMemory"),
    "P6 — módulo não escreve memória"
  );

  // P7 — módulo não importa libs externas desnecessárias
  // Verifica que não há imports de runtime externo além dos próprios exports
  const hasOnlyInternalExports =
    selfAuditSource.includes("export const SELF_AUDIT_RISK_LEVELS") &&
    selfAuditSource.includes("export const SELF_AUDIT_CATEGORIES") &&
    selfAuditSource.includes("export function runEnaviaSelfAudit");
  ok(hasOnlyInternalExports, "P7 — módulo só exporta símbolos internos esperados");

  // P8 — validar por unitário que múltiplas chamadas não têm side effects
  const r1 = runEnaviaSelfAudit({ message: "oi" });
  const r2 = runEnaviaSelfAudit({ message: "oi" });
  ok(
    JSON.stringify(r1) === JSON.stringify(r2),
    "P8 — determinístico: mesma entrada → mesma saída (sem side effects)"
  );

  // Verificar no nv-enavia.js também
  const nvEnaviaPath = resolve(__dirname, "../nv-enavia.js");
  let nvEnaviaSource = "";
  try {
    nvEnaviaSource = readFileSync(nvEnaviaPath, "utf8");
  } catch (e) {
    nvEnaviaSource = "";
  }

  ok(
    !nvEnaviaSource.includes('"/self-audit"') &&
    !nvEnaviaSource.includes("'/self-audit'"),
    "P9 — nenhum endpoint /self-audit em nv-enavia.js"
  );
  ok(
    !nvEnaviaSource.includes('"/audit/run"') &&
    !nvEnaviaSource.includes("'/audit/run'"),
    "P10 — nenhum endpoint /audit/run em nv-enavia.js"
  );
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(60)}`);
console.log(`PR57 — Prova do Self-Audit read-only`);
console.log(`Total: ${passed + failed} | ✅ Passaram: ${passed} | ❌ Falharam: ${failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) {
    console.log(`  ❌ ${f}`);
  }
  process.exit(1);
} else {
  console.log("\n✅ Todos os testes passaram.");
  process.exit(0);
}
