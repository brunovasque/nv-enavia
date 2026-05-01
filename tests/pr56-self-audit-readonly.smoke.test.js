// ============================================================================
// 🧪 PR56 — Smoke Test: Self-Audit read-only
//
// PR-IMPL. Não altera nenhum runtime. Não chama LLM externo.
// Valida que o módulo enavia-self-audit.js funciona corretamente,
// seguindo os cenários obrigatórios definidos no contrato PR56.
//
// Cenários:
//   A — Shape básico
//   B — Caso limpo (mensagem "oi")
//   C — False capability (/skills/run afirmado)
//   D — Fake execution (deploy afirmado)
//   E — Unauthorized action (manda pra produção)
//   F — Wrong mode (frustração + isOperationalContext=true)
//   G — Docs over product (mensagem de frustração documental)
//   H — Missing source (worker ativo sem fonte)
//   I — Runtime vs documentation (Self-Audit já executa)
//   J — Secret exposure (Bearer token)
//   K — Scope violation (PR-DOCS com nv-enavia.js)
//   L — Contract drift (proof_failed + advancing_to_next_phase)
//   M — Integração com chat response shape (inspeção de código)
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
// Cenário A — Shape básico
// ---------------------------------------------------------------------------
section("A — Shape básico");
{
  const result = runEnaviaSelfAudit({ message: "oi" });

  ok(typeof result === "object" && result !== null, "A1 — retorna objeto");
  ok(typeof result.self_audit === "object" && result.self_audit !== null, "A2 — tem campo self_audit");

  const sa = result.self_audit;
  ok(sa.applied === true,                     "A3 — self_audit.applied=true");
  ok(sa.mode === "read_only",                 "A4 — mode='read_only'");
  ok(typeof sa.risk_level === "string",       "A5 — risk_level é string");
  ok(
    [SELF_AUDIT_RISK_LEVELS.NONE, SELF_AUDIT_RISK_LEVELS.LOW,
     SELF_AUDIT_RISK_LEVELS.MEDIUM, SELF_AUDIT_RISK_LEVELS.HIGH,
     SELF_AUDIT_RISK_LEVELS.BLOCKING].includes(sa.risk_level),
    "A6 — risk_level é valor válido"
  );
  ok(Array.isArray(sa.findings),              "A7 — findings é array");
  ok(typeof sa.should_block === "boolean",    "A8 — should_block é boolean");
  ok(Array.isArray(sa.warnings),              "A9 — warnings é array");
  ok(typeof sa.next_safe_action === "string", "A10 — next_safe_action é string");
  ok(sa.next_safe_action.length > 0,         "A11 — next_safe_action não vazio");
}

// ---------------------------------------------------------------------------
// Cenário B — Caso limpo
// ---------------------------------------------------------------------------
section("B — Caso limpo ('oi')");
{
  const result = runEnaviaSelfAudit({ message: "oi" });
  const sa = result.self_audit;

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.NONE || sa.risk_level === SELF_AUDIT_RISK_LEVELS.LOW,
    "B1 — risk_level none ou low para mensagem simples"
  );
  ok(sa.should_block === false,                     "B2 — should_block=false");
  const hasGraveFinding = sa.findings.some(f =>
    f.severity === SELF_AUDIT_RISK_LEVELS.HIGH || f.severity === SELF_AUDIT_RISK_LEVELS.BLOCKING
  );
  ok(!hasGraveFinding, "B3 — sem findings graves para mensagem simples");
}

// ---------------------------------------------------------------------------
// Cenário C — False capability (/skills/run)
// ---------------------------------------------------------------------------
section("C — False capability");
{
  const result = runEnaviaSelfAudit({
    message: "qual skill foi usada?",
    responseDraft: "Já executei a skill Contract Auditor via /skills/run com sucesso.",
  });
  const sa = result.self_audit;

  const hasFinding = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
    f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION
  );
  ok(hasFinding, "C1 — finding false_capability ou fake_execution detectado");

  const hasHighOrBlocking = sa.findings.some(f =>
    (f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
     f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION) &&
    (f.severity === SELF_AUDIT_RISK_LEVELS.HIGH || f.severity === SELF_AUDIT_RISK_LEVELS.BLOCKING)
  );
  ok(hasHighOrBlocking, "C2 — severity high ou blocking");

  const findingWithRec = sa.findings.find(f =>
    f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY ||
    f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION
  );
  ok(findingWithRec && typeof findingWithRec.recommendation === "string" && findingWithRec.recommendation.length > 0,
    "C3 — finding tem recommendation"
  );
  ok(findingWithRec && typeof findingWithRec.evidence === "string" && findingWithRec.evidence.length > 0,
    "C4 — finding tem evidence"
  );

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH || sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING,
    "C5 — risk_level high ou blocking"
  );
}

// ---------------------------------------------------------------------------
// Cenário D — Fake execution (deploy afirmado)
// ---------------------------------------------------------------------------
section("D — Fake execution");
{
  const result = runEnaviaSelfAudit({
    message: "o deploy foi feito?",
    responseDraft: "Deploy feito em produção. O worker está ativo.",
  });
  const sa = result.self_audit;

  const hasFakeExec = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.FAKE_EXECUTION
  );
  ok(hasFakeExec, "D1 — finding fake_execution detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH || sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING,
    "D2 — risk_level high ou blocking"
  );
}

// ---------------------------------------------------------------------------
// Cenário E — Unauthorized action
// ---------------------------------------------------------------------------
section("E — Unauthorized action");
{
  const result = runEnaviaSelfAudit({
    message: "manda pra produção agora",
    context: {},
  });
  const sa = result.self_audit;

  const hasUnauth = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION
  );
  ok(hasUnauth, "E1 — finding unauthorized_action detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH || sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING,
    "E2 — risk_level alto/bloqueante"
  );

  // Se classificado como blocking, should_block deve ser true
  if (sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING) {
    ok(sa.should_block === true, "E3 — should_block=true quando blocking");
  } else {
    ok(true, "E3 — should_block não-blocking (risk_level não é blocking)");
  }
}

// ---------------------------------------------------------------------------
// Cenário F — Wrong mode (frustração + isOperationalContext=true)
// ---------------------------------------------------------------------------
section("F — Wrong mode");
{
  const result = runEnaviaSelfAudit({
    message: "isso nunca funciona",
    intentClassification: {
      intent: "frustration_or_trust_issue",
      confidence: "high",
      is_operational: false,
    },
    isOperationalContext: true,
  });
  const sa = result.self_audit;

  const hasWrongMode = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.WRONG_MODE
  );
  ok(hasWrongMode, "F1 — finding wrong_mode detectado");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.WRONG_MODE);
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.length > 0,
    "F2 — finding tem recomendação para não ativar modo operacional por frustração"
  );

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.LOW ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.MEDIUM ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "F3 — risk_level low, medium ou high"
  );
  ok(sa.should_block === false, "F4 — should_block=false (wrong_mode é medium, não blocking)");
}

// ---------------------------------------------------------------------------
// Cenário G — Docs over product
// ---------------------------------------------------------------------------
section("G — Docs over product");
{
  const result = runEnaviaSelfAudit({
    message: "isso está virando só documento, cadê produto?",
  });
  const sa = result.self_audit;

  const hasDocs = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT
  );
  ok(hasDocs, "G1 — finding docs_over_product detectado");

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT);
  ok(
    finding && typeof finding.recommendation === "string" && finding.recommendation.includes("PR-IMPL"),
    "G2 — recomendação menciona PR-IMPL"
  );

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.LOW ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.MEDIUM,
    "G3 — risk_level low ou medium (docs_over_product não bloqueia)"
  );
  ok(sa.should_block === false, "G4 — should_block=false");
}

// ---------------------------------------------------------------------------
// Cenário H — Missing source
// ---------------------------------------------------------------------------
section("H — Missing source");
{
  const result = runEnaviaSelfAudit({
    message: "como está o sistema?",
    responseDraft: "O worker X já está ativo em produção.",
    metadata: {},
  });
  const sa = result.self_audit;

  const hasMissing = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.MISSING_SOURCE ||
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION
  );
  ok(hasMissing, "H1 — finding missing_source ou runtime_vs_documentation_confusion detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.LOW ||
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.MEDIUM,
    "H2 — risk_level low ou medium"
  );
}

// ---------------------------------------------------------------------------
// Cenário I — Runtime vs documentation
// ---------------------------------------------------------------------------
section("I — Runtime vs documentation");
{
  const result = runEnaviaSelfAudit({
    message: "o self-audit já funciona?",
    responseDraft: "O Self-Audit já executa correções automáticas em todas as respostas.",
  });
  const sa = result.self_audit;

  const hasConfusion = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION ||
    f.category === SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY
  );
  ok(hasConfusion, "I1 — finding runtime_vs_documentation_confusion ou false_capability detectado");

  ok(
    sa.risk_level !== SELF_AUDIT_RISK_LEVELS.NONE,
    "I2 — risk_level não é none"
  );
}

// ---------------------------------------------------------------------------
// Cenário J — Secret exposure
// ---------------------------------------------------------------------------
section("J — Secret exposure");
{
  const result = runEnaviaSelfAudit({
    message: "como autenticar?",
    responseDraft: "Use o token Bearer sk-test-1234567890abcdefghijklmnop para autenticar.",
  });
  const sa = result.self_audit;

  const hasSecret = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE
  );
  ok(hasSecret, "J1 — finding secret_exposure detectado");

  ok(sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING, "J2 — risk_level=blocking");
  ok(sa.should_block === true, "J3 — should_block=true");

  // Verificar que o evidence NÃO expõe o segredo completo
  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE);
  ok(
    finding && !finding.evidence.includes("sk-test-1234567890abcdefghijklmnop"),
    "J4 — evidence não expõe o segredo completo"
  );
}

// ---------------------------------------------------------------------------
// Cenário K — Scope violation
// ---------------------------------------------------------------------------
section("K — Scope violation");
{
  const result = runEnaviaSelfAudit({
    message: "só documentando",
    metadata: {
      pr_type: "PR-DOCS",
      files_changed: ["nv-enavia.js", "schema/reports/PR56.md"],
    },
  });
  const sa = result.self_audit;

  const hasScope = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION
  );
  ok(hasScope, "K1 — finding scope_violation detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING || sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "K2 — risk_level blocking ou high"
  );

  const finding = sa.findings.find(f => f.category === SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION);
  ok(
    finding && finding.evidence.includes("nv-enavia.js"),
    "K3 — evidence menciona o arquivo violador"
  );
}

// ---------------------------------------------------------------------------
// Cenário L — Contract drift
// ---------------------------------------------------------------------------
section("L — Contract drift");
{
  const result = runEnaviaSelfAudit({
    message: "próxima PR?",
    metadata: {
      proof_failed: true,
      advancing_to_next_phase: true,
    },
  });
  const sa = result.self_audit;

  const hasDrift = sa.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT
  );
  ok(hasDrift, "L1 — finding contract_drift detectado");

  ok(
    sa.risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING || sa.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "L2 — risk_level blocking ou high"
  );
}

// ---------------------------------------------------------------------------
// Cenário M — Integração com chat response shape (inspeção de código)
// ---------------------------------------------------------------------------
section("M — Integração com chat response shape");
{
  // Validar por inspeção de código que nv-enavia.js integra self-audit
  const nvEnaviaPath = resolve(__dirname, "../nv-enavia.js");
  let nvEnaviaSource;
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

  // Validar que self-audit não está bloqueando fluxo (não há return condicional baseado em should_block)
  const selfAuditSection = nvEnaviaSource.indexOf("runEnaviaSelfAudit");
  const nearbyCode = nvEnaviaSource.slice(selfAuditSection, selfAuditSection + 800);
  ok(
    !nearbyCode.includes("if (_selfAudit?.should_block") &&
    !nearbyCode.includes("if (selfAudit.should_block"),
    "M4 — self-audit NÃO bloqueia fluxo automaticamente"
  );

  // Validar que reply não é alterado com base no self-audit
  ok(
    !nearbyCode.includes("reply = _selfAudit") &&
    !nearbyCode.includes("reply = selfAudit"),
    "M5 — self-audit NÃO altera reply automaticamente"
  );

  // Validar que o campo é aditivo (spread operator)
  ok(
    nvEnaviaSource.includes("_selfAudit ? { self_audit: _selfAudit }"),
    "M6 — campo self_audit é aditivo (spread operator)"
  );

  // Validar que está dentro de try/catch defensivo
  ok(
    nvEnaviaSource.includes("_selfAuditErr") || nvEnaviaSource.includes("selfAuditErr"),
    "M7 — integração tem try/catch defensivo"
  );

  // Validar que não há endpoint /self-audit ou /audit/run criado
  ok(
    !nvEnaviaSource.includes('"/self-audit"') &&
    !nvEnaviaSource.includes("'/self-audit'") &&
    !nvEnaviaSource.includes('"/audit/run"') &&
    !nvEnaviaSource.includes("'/audit/run'"),
    "M8 — nenhum endpoint /self-audit ou /audit/run criado"
  );
}

// ---------------------------------------------------------------------------
// Cenários adicionais de robustez
// ---------------------------------------------------------------------------
section("N — Robustez e edge cases");
{
  // N1 — entrada nula
  const r1 = runEnaviaSelfAudit(null);
  ok(r1?.self_audit?.applied === true, "N1 — entrada nula retorna self_audit.applied=true");

  // N2 — entrada vazia
  const r2 = runEnaviaSelfAudit({});
  ok(r2?.self_audit?.mode === "read_only", "N2 — entrada vazia retorna mode=read_only");

  // N3 — sem findings → none + should_block=false
  const r3 = runEnaviaSelfAudit({ message: "tudo bem?" });
  ok(r3.self_audit.should_block === false, "N3 — should_block=false para mensagem neutra");

  // N4 — responseDraft como objeto não deve quebrar
  const r4 = runEnaviaSelfAudit({
    message: "ok",
    responseDraft: { reply: "Olá!", use_planner: false },
  });
  ok(typeof r4.self_audit === "object", "N4 — responseDraft como objeto não quebra o módulo");

  // N5 — approved context bloqueia unauthorized_action
  const r5 = runEnaviaSelfAudit({
    message: "deploy em produção",
    context: { human_approved: true },
  });
  const hasUnauth = r5.self_audit.findings.some(f =>
    f.category === SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION
  );
  ok(!hasUnauth, "N5 — aprovação explícita no contexto suprime unauthorized_action");

  // N6 — should_block somente quando blocking
  const r6 = runEnaviaSelfAudit({
    message: "isso virou só documento, cadê produto?",
  });
  ok(r6.self_audit.should_block === false,
    "N6 — docs_over_product (medium) não seta should_block=true"
  );

  // N7 — contract drift sem advancing não é blocking
  const r7 = runEnaviaSelfAudit({
    message: "ok",
    metadata: { proof_failed: true },
  });
  ok(
    r7.self_audit.risk_level === SELF_AUDIT_RISK_LEVELS.HIGH,
    "N7 — proof_failed sem advancing é high (não blocking)"
  );

  // N8 — enums exportados são strings corretas
  ok(SELF_AUDIT_RISK_LEVELS.NONE === "none",         "N8a — NONE='none'");
  ok(SELF_AUDIT_RISK_LEVELS.BLOCKING === "blocking",  "N8b — BLOCKING='blocking'");
  ok(SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY === "false_capability", "N8c — FALSE_CAPABILITY correto");
  ok(SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE === "secret_exposure",   "N8d — SECRET_EXPOSURE correto");
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log(`\n${"─".repeat(60)}`);
console.log(`PR56 — Self-Audit read-only — Smoke Test`);
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
