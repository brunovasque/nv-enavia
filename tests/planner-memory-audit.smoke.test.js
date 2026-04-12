// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Memory Audit v1 (PM10)
//
// Run: node tests/planner-memory-audit.smoke.test.js
//
// Tests:
//   Group 1: runPlannerMemoryAudit — happy path (tudo coerente)
//   Group 2: AuditReport shape canônico
//   Group 3: checks[] shape e preenchimento
//   Group 4: auditoria falha quando fixture incoerente detectado
//   Group 5: determinismo (resultados idênticos em chamadas repetidas)
//   Group 6: executor contract unaffected
// ============================================================================

import {
  runPlannerMemoryAudit,
  AUDIT_VERSION,
} from "../schema/planner-memory-audit.js";

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

function assertThrows(fn, name) {
  try {
    fn();
    console.error(`  ❌ ${name} (não lançou exceção)`);
    failed++;
  } catch (_e) {
    console.log(`  ✅ ${name}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Memory Audit — Smoke Tests (PM10) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Happy path — auditoria passa com blocos canônicos coerentes
  // -------------------------------------------------------------------------
  console.log("Group 1: Happy path — auditoria passa com blocos coerentes");

  const report = runPlannerMemoryAudit();

  assert(report !== null && typeof report === "object", "runPlannerMemoryAudit retorna objeto");
  assert(report.audit_status === "passed",   "audit_status = 'passed' com blocos coerentes");
  assert(report.is_ready === true,           "is_ready = true quando auditoria passa");
  assert(typeof report.summary === "string" && report.summary.length > 0,     "summary preenchida");
  assert(typeof report.next_action === "string" && report.next_action.length > 0, "next_action preenchida");
  assert(report.next_action.toLowerCase().includes("auditoria humana") || report.next_action.toLowerCase().includes("próximo"),
    "next_action menciona próximo passo positivo quando pronta");

  // -------------------------------------------------------------------------
  // Group 2: AuditReport shape canônico
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: AuditReport shape canônico");

  const requiredFields = ["audit_version","audit_status","is_ready","checks","summary","next_action"];
  for (const field of requiredFields) {
    assert(field in report, `AuditReport contém campo '${field}'`);
  }
  assert(report.audit_version === AUDIT_VERSION, `audit_version = '${AUDIT_VERSION}'`);
  assert(report.audit_status === "passed" || report.audit_status === "failed",
    "audit_status é 'passed' ou 'failed'");
  assert(typeof report.is_ready === "boolean", "is_ready é boolean");
  assert(Array.isArray(report.checks),         "checks é array");

  // -------------------------------------------------------------------------
  // Group 3: checks[] shape e preenchimento
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: checks[] shape e preenchimento");

  assert(report.checks.length === 9, `checks[] tem exatamente 9 itens (PM1–PM9); encontrado: ${report.checks.length}`);

  const expectedCheckNames = [
    "PM1 — memory schema",
    "PM2 — storage core",
    "PM3 — read pipeline",
    "PM4 — classification",
    "PM5 — output modes",
    "PM6 — canonical plan",
    "PM7 — approval gate",
    "PM8 — bridge planner↔executor",
    "PM9 — consolidação de memória",
  ];

  for (const name of expectedCheckNames) {
    const check = report.checks.find((c) => c.check_name === name);
    assert(check !== undefined, `check '${name}' presente`);
    if (check) {
      assert(check.status === "passed" || check.status === "failed",
        `check '${name}' tem status válido`);
      assert(typeof check.reason === "string" && check.reason.length > 0,
        `check '${name}' tem reason preenchida`);
    }
  }

  // Todos os checks passam no happy path
  const allPassed = report.checks.every((c) => c.status === "passed");
  assert(allPassed, "todos os 9 checks passam no happy path");

  // -------------------------------------------------------------------------
  // Group 4: auditoria detecta incoerência quando fixture inválido passado
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: auditoria falha com fixture incoerente (validMemory inválido)");

  // Fixture: objeto de memória inválido (sem memory_id) → PM1 deve falhar
  const reportWithBadMemory = runPlannerMemoryAudit({
    validMemory: { memory_type: "user_profile" }, // inválido: falta memory_id, etc.
  });

  assert(typeof reportWithBadMemory === "object", "retorna objeto mesmo com fixture inválido");
  const pm1Check = reportWithBadMemory.checks.find((c) => c.check_name === "PM1 — memory schema");
  assert(pm1Check !== undefined,              "PM1 check presente no report com fixture inválido");
  assert(pm1Check && pm1Check.status === "failed", "PM1 check falha com objeto de memória inválido");
  assert(reportWithBadMemory.audit_status === "failed", "audit_status = 'failed' quando há check com falha");
  assert(reportWithBadMemory.is_ready === false,        "is_ready = false quando auditoria falha");
  assert(typeof reportWithBadMemory.summary === "string" && reportWithBadMemory.summary.length > 0,
    "summary preenchida mesmo com falha");
  assert(reportWithBadMemory.next_action.toLowerCase().includes("revisar") || 
    reportWithBadMemory.next_action.toLowerCase().includes("corrig"),
    "next_action orienta correção quando há falha");

  // Fixture: simpleRequest que classificaria como C (não A) → PM4 deve falhar
  const reportWithBadClassification = runPlannerMemoryAudit({
    simpleRequest: {
      text: "Deploy urgente em produção com dados sensíveis compliance regulatório irreversível risco crítico.",
      context: { mentions_prod: true },
    },
  });

  const pm4Check = reportWithBadClassification.checks.find((c) => c.check_name === "PM4 — classification");
  assert(pm4Check !== undefined,               "PM4 check presente no report com fixture inválido");
  assert(pm4Check && pm4Check.status === "failed",  "PM4 check falha quando simpleRequest classifica como C (não A)");
  assert(reportWithBadClassification.audit_status === "failed",
    "audit_status = 'failed' quando PM4 check falha");

  // -------------------------------------------------------------------------
  // Group 5: determinismo — resultado idêntico em chamadas repetidas
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: determinismo");

  const report2 = runPlannerMemoryAudit();
  const report3 = runPlannerMemoryAudit();

  assert(report2.audit_status === report.audit_status,  "audit_status idêntico em chamadas repetidas");
  assert(report2.is_ready     === report.is_ready,      "is_ready idêntico em chamadas repetidas");
  assert(report2.checks.length === report.checks.length,"checks.length idêntico em chamadas repetidas");
  assert(report3.audit_status === report.audit_status,  "audit_status idêntico na terceira chamada");

  for (let i = 0; i < report.checks.length; i++) {
    assert(
      report2.checks[i].check_name === report.checks[i].check_name &&
      report2.checks[i].status     === report.checks[i].status,
      `check[${i}] determinístico: '${report.checks[i].check_name}' → '${report.checks[i].status}'`
    );
  }

  // -------------------------------------------------------------------------
  // Group 6: executor contract unaffected
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: executor contract unaffected");

  // Verifica que runPlannerMemoryAudit é uma função pura que não altera
  // estado global nem toca o executor contratual.
  // (Não há efeitos colaterais observáveis — PM10 não persiste, não chama KV)

  assert(typeof runPlannerMemoryAudit === "function", "runPlannerMemoryAudit é função exportada");
  assert(typeof AUDIT_VERSION === "string" && AUDIT_VERSION.length > 0, "AUDIT_VERSION é string não vazia");

  // Chamada com argumento vazio ou não-objeto não deve lançar
  let noThrow = true;
  try {
    runPlannerMemoryAudit(null);
    runPlannerMemoryAudit(undefined);
    runPlannerMemoryAudit({});
  } catch (e) {
    noThrow = false;
  }
  assert(noThrow, "runPlannerMemoryAudit não lança com null/undefined/{}");

  // Resultado não tem função ou Promise — é serializable
  const serialized = JSON.stringify(report);
  const deserialized = JSON.parse(serialized);
  assert(deserialized.audit_status === report.audit_status, "AuditReport é serializável (JSON roundtrip)");
  assert(deserialized.checks.length === report.checks.length, "checks[] sobrevive JSON roundtrip");

  // -------------------------------------------------------------------------
  // Final summary
  // -------------------------------------------------------------------------
  console.log(`\n=== Result: ${passed} passed, ${failed} failed ===\n`);
  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
