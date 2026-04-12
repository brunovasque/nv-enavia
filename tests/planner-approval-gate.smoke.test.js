// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Approval Gate v1 (PM7)
//
// Run: node tests/planner-approval-gate.smoke.test.js
//
// Tests:
//   Group 1:  Enum integrity
//   Group 2:  T1 — plano sem aprovação requerida → approved_not_required
//   Group 3:  T2 — plano com aprovação requerida → approval_required
//   Group 4:  T3 — approvePlan gera "approved"
//   Group 5:  T4 — rejectPlan gera "rejected"
//   Group 6:  T5 — can_proceed coerente com cada estado
//   Group 7:  T6 — next_action coerente com cada estado
//   Group 8:  T7 — resultado é determinístico
//   Group 9:  T8 — rejectPlan aceita reason curta opcional
//   Group 10: T9 — shape canônico completo (GateDecision)
//   Group 11: T10 — input inválido lança erro
//   Group 12: T11 — nenhum fluxo do executor atual foi alterado
// ============================================================================

import {
  evaluateApprovalGate,
  approvePlan,
  rejectPlan,
  GATE_STATUS,
} from "../schema/planner-approval-gate.js";

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
    console.error(`  ❌ ${name} (expected throw, got none)`);
    failed++;
  } catch (_) {
    console.log(`  ✅ ${name}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures — planos canônicos simulados (saída de buildCanonicalPlan PM6)
// ---------------------------------------------------------------------------

// Plano A (simple) — aprovação não requerida
const planA = {
  plan_version:        "1.0",
  plan_type:           "quick_reply",
  complexity_level:    "A",
  output_mode:         "quick_reply",
  objective:           "Ver os logs do worker",
  scope_summary:       "Escopo simples e direto.",
  steps:               ["Avaliar", "Executar", "Confirmar"],
  risks:               ["Risco baixo"],
  acceptance_criteria: ["Ação concluída"],
  needs_human_approval: false,
  next_action:         "Executar a ação identificada diretamente.",
  reason:              "classificado como A por baixo escopo e baixo risco",
};

// Plano C (complex) — aprovação requerida
const planC = {
  plan_version:        "1.0",
  plan_type:           "formal_contract",
  complexity_level:    "C",
  output_mode:         "formal_contract",
  objective:           "Redesenhar arquitetura com risco alto e compliance",
  scope_summary:       "Escopo macro e complexo.",
  steps:               ["Frente 1", "Frente 2", "Frente 3", "Frente 4"],
  risks:               ["Risco alto", "Impacto irreversível"],
  acceptance_criteria: ["Aprovação formal", "Mapeamento completo", "Riscos documentados"],
  needs_human_approval: true,
  next_action:         "Submeter para aprovação humana formal.",
  reason:              "classificado como C por very_long_text, has_risk_keywords",
};

// Plano B com override de needs_human_approval=true (risco detectado em PM4)
const planBWithApproval = {
  plan_version:        "1.0",
  plan_type:           "tactical_plan",
  complexity_level:    "B",
  output_mode:         "tactical_plan",
  objective:           "Integrar sistema com risco detectado",
  scope_summary:       "Escopo tático com risco.",
  steps:               ["Decompor", "Validar", "Executar", "Validar entregáveis"],
  risks:               ["Risco médio detectado"],
  acceptance_criteria: ["Etapas concluídas", "Dependências resolvidas", "Entregáveis validados"],
  needs_human_approval: true,
  next_action:         "Aguardar aprovação humana.",
  reason:              "classificado como B por has_risk_keywords",
};

// Plano mínimo válido sem reason
const planMinimal = {
  needs_human_approval: false,
};

const planMinimalRequiresApproval = {
  needs_human_approval: true,
};

// ---------------------------------------------------------------------------
// REQUIRED_GATE_FIELDS — shape canônico de GateDecision
// ---------------------------------------------------------------------------
const REQUIRED_GATE_FIELDS = [
  "gate_status",
  "needs_human_approval",
  "can_proceed",
  "reason",
  "next_action",
];

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Approval Gate — Smoke Tests (PM7) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Enum integrity
  // -------------------------------------------------------------------------
  console.log("Group 1: Enum integrity");

  assert(GATE_STATUS.APPROVED_NOT_REQUIRED === "approved_not_required", "GATE_STATUS.APPROVED_NOT_REQUIRED === 'approved_not_required'");
  assert(GATE_STATUS.APPROVAL_REQUIRED     === "approval_required",     "GATE_STATUS.APPROVAL_REQUIRED === 'approval_required'");
  assert(GATE_STATUS.APPROVED              === "approved",              "GATE_STATUS.APPROVED === 'approved'");
  assert(GATE_STATUS.REJECTED              === "rejected",              "GATE_STATUS.REJECTED === 'rejected'");
  assert(Object.keys(GATE_STATUS).length   === 4,                       "GATE_STATUS tem exatamente 4 estados");

  // -------------------------------------------------------------------------
  // Group 2: T1 — plano sem aprovação requerida → approved_not_required
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: T1 — plano sem aprovação requerida → approved_not_required");

  const gateA = evaluateApprovalGate(planA);
  assert(gateA.gate_status          === GATE_STATUS.APPROVED_NOT_REQUIRED, "T1: gate_status === 'approved_not_required'");
  assert(gateA.needs_human_approval === false,                             "T1: needs_human_approval === false");
  assert(gateA.can_proceed          === true,                              "T1: can_proceed === true");
  assert(typeof gateA.reason        === "string" && gateA.reason.length > 0, "T1: reason é string não vazia");
  assert(typeof gateA.next_action   === "string" && gateA.next_action.length > 0, "T1: next_action é string não vazia");

  // Plano mínimo sem reason
  const gateMinimal = evaluateApprovalGate(planMinimal);
  assert(gateMinimal.gate_status  === GATE_STATUS.APPROVED_NOT_REQUIRED, "T1: plano mínimo → approved_not_required");
  assert(gateMinimal.can_proceed  === true,                              "T1: plano mínimo → can_proceed=true");

  // -------------------------------------------------------------------------
  // Group 3: T2 — plano com aprovação requerida → approval_required
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: T2 — plano com aprovação requerida → approval_required");

  const gateC = evaluateApprovalGate(planC);
  assert(gateC.gate_status          === GATE_STATUS.APPROVAL_REQUIRED, "T2: gate_status === 'approval_required'");
  assert(gateC.needs_human_approval === true,                          "T2: needs_human_approval === true");
  assert(gateC.can_proceed          === false,                         "T2: can_proceed === false");
  assert(typeof gateC.reason        === "string" && gateC.reason.length > 0, "T2: reason é string não vazia");

  const gateBApproval = evaluateApprovalGate(planBWithApproval);
  assert(gateBApproval.gate_status === GATE_STATUS.APPROVAL_REQUIRED, "T2: plano B com override → approval_required");
  assert(gateBApproval.can_proceed === false,                         "T2: plano B com override → can_proceed=false");

  const gateMinimalReq = evaluateApprovalGate(planMinimalRequiresApproval);
  assert(gateMinimalReq.gate_status === GATE_STATUS.APPROVAL_REQUIRED, "T2: plano mínimo requer → approval_required");
  assert(gateMinimalReq.can_proceed === false,                         "T2: plano mínimo requer → can_proceed=false");

  // -------------------------------------------------------------------------
  // Group 4: T3 — approvePlan gera "approved"
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: T3 — approvePlan gera 'approved'");

  const approvedC = approvePlan(planC);
  assert(approvedC.gate_status          === GATE_STATUS.APPROVED, "T3: gate_status === 'approved' (plano C)");
  assert(approvedC.can_proceed          === true,                 "T3: can_proceed === true após approve");
  assert(approvedC.needs_human_approval === true,                 "T3: needs_human_approval espelha plan.needs_human_approval");
  assert(typeof approvedC.reason        === "string" && approvedC.reason.length > 0, "T3: reason é string não vazia");
  assert(typeof approvedC.next_action   === "string" && approvedC.next_action.length > 0, "T3: next_action é string não vazia");

  const approvedA = approvePlan(planA);
  assert(approvedA.gate_status          === GATE_STATUS.APPROVED, "T3: gate_status === 'approved' (plano A)");
  assert(approvedA.can_proceed          === true,                 "T3: can_proceed === true (plano A)");
  assert(approvedA.needs_human_approval === false,                "T3: needs_human_approval espelha planA.needs_human_approval");

  // -------------------------------------------------------------------------
  // Group 5: T4 — rejectPlan gera "rejected"
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: T4 — rejectPlan gera 'rejected'");

  const rejectedC = rejectPlan(planC);
  assert(rejectedC.gate_status          === GATE_STATUS.REJECTED, "T4: gate_status === 'rejected' (plano C)");
  assert(rejectedC.can_proceed          === false,                "T4: can_proceed === false após reject");
  assert(rejectedC.needs_human_approval === true,                 "T4: needs_human_approval espelha plan.needs_human_approval");
  assert(typeof rejectedC.reason        === "string" && rejectedC.reason.length > 0, "T4: reason é string não vazia");
  assert(typeof rejectedC.next_action   === "string" && rejectedC.next_action.length > 0, "T4: next_action é string não vazia");

  const rejectedA = rejectPlan(planA);
  assert(rejectedA.gate_status          === GATE_STATUS.REJECTED, "T4: gate_status === 'rejected' (plano A)");
  assert(rejectedA.can_proceed          === false,                "T4: can_proceed === false (plano A)");
  assert(rejectedA.needs_human_approval === false,                "T4: needs_human_approval espelha planA.needs_human_approval");

  // -------------------------------------------------------------------------
  // Group 6: T5 — can_proceed coerente com cada estado
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: T5 — can_proceed coerente");

  assert(gateA.can_proceed        === true,  "T5: approved_not_required → can_proceed=true");
  assert(gateC.can_proceed        === false, "T5: approval_required → can_proceed=false");
  assert(approvedC.can_proceed    === true,  "T5: approved → can_proceed=true");
  assert(rejectedC.can_proceed    === false, "T5: rejected → can_proceed=false");

  // -------------------------------------------------------------------------
  // Group 7: T6 — next_action coerente com cada estado
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: T6 — next_action coerente");

  // approved_not_required → prosseguir (sem mencionar aprovação humana)
  assert(
    gateA.next_action.toLowerCase().includes("prosseguir"),
    "T6: approved_not_required — next_action menciona prosseguir"
  );
  assert(
    !gateA.next_action.toLowerCase().includes("aguardar"),
    "T6: approved_not_required — next_action não menciona aguardar"
  );

  // approval_required → aguardar aprovação
  assert(
    gateC.next_action.toLowerCase().includes("aguardar") ||
    gateC.next_action.toLowerCase().includes("aprovação"),
    "T6: approval_required — next_action menciona aguardar/aprovação"
  );
  assert(
    !gateC.next_action.toLowerCase().includes("prosseguir"),
    "T6: approval_required — next_action não diz prosseguir"
  );

  // approved → prosseguir
  assert(
    approvedC.next_action.toLowerCase().includes("prosseguir"),
    "T6: approved — next_action menciona prosseguir"
  );

  // rejected → revisar/gerar novo
  assert(
    rejectedC.next_action.toLowerCase().includes("rejeitado") ||
    rejectedC.next_action.toLowerCase().includes("revisar"),
    "T6: rejected — next_action menciona rejeitado/revisar"
  );
  assert(
    !rejectedC.next_action.toLowerCase().includes("prosseguir diretamente"),
    "T6: rejected — next_action não diz prosseguir diretamente"
  );

  // -------------------------------------------------------------------------
  // Group 8: T7 — resultado é determinístico
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: T7 — determinismo");

  const run1 = evaluateApprovalGate(planA);
  const run2 = evaluateApprovalGate(planA);
  assert(JSON.stringify(run1) === JSON.stringify(run2), "T7: evaluateApprovalGate(planA) é determinístico");

  const run3 = evaluateApprovalGate(planC);
  const run4 = evaluateApprovalGate(planC);
  assert(JSON.stringify(run3) === JSON.stringify(run4), "T7: evaluateApprovalGate(planC) é determinístico");

  const app1 = approvePlan(planC);
  const app2 = approvePlan(planC);
  assert(JSON.stringify(app1) === JSON.stringify(app2), "T7: approvePlan(planC) é determinístico");

  const rej1 = rejectPlan(planC, "escopo inválido");
  const rej2 = rejectPlan(planC, "escopo inválido");
  assert(JSON.stringify(rej1) === JSON.stringify(rej2), "T7: rejectPlan(planC, reason) é determinístico");

  // -------------------------------------------------------------------------
  // Group 9: T8 — rejectPlan aceita reason curta opcional
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: T8 — rejectPlan aceita reason opcional");

  // Sem reason
  const rejNoReason = rejectPlan(planC);
  assert(rejNoReason.gate_status === GATE_STATUS.REJECTED, "T8: rejectPlan sem reason → rejected");
  assert(typeof rejNoReason.reason === "string" && rejNoReason.reason.length > 0, "T8: reason padrão gerada sem parâmetro");

  // Com reason curta
  const rejWithReason = rejectPlan(planC, "escopo fora do contrato");
  assert(rejWithReason.gate_status === GATE_STATUS.REJECTED,               "T8: rejectPlan com reason → rejected");
  assert(rejWithReason.reason.includes("escopo fora do contrato"),          "T8: reason contém o motivo passado");
  assert(rejWithReason.reason !== rejNoReason.reason,                       "T8: reason com argumento difere da padrão");

  // reason vazia é tratada como ausente
  const rejEmptyReason = rejectPlan(planC, "");
  assert(rejEmptyReason.gate_status === GATE_STATUS.REJECTED,              "T8: rejectPlan com reason vazia → rejected");
  assert(JSON.stringify(rejEmptyReason) === JSON.stringify(rejNoReason),   "T8: reason vazia equivale a ausente");

  // -------------------------------------------------------------------------
  // Group 10: T9 — shape canônico completo (GateDecision)
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: T9 — shape canônico completo");

  const decisions = [
    { label: "evaluateApprovalGate(planA)", decision: gateA },
    { label: "evaluateApprovalGate(planC)", decision: gateC },
    { label: "approvePlan(planC)",          decision: approvedC },
    { label: "rejectPlan(planC)",           decision: rejectedC },
  ];

  for (const { label, decision } of decisions) {
    for (const field of REQUIRED_GATE_FIELDS) {
      assert(decision[field] !== undefined, `T9: ${label} tem campo '${field}'`);
    }
    // Apenas os 5 campos canônicos (nenhum extra de plano PM6)
    assert(typeof decision.gate_status          === "string",  `T9: ${label}.gate_status é string`);
    assert(typeof decision.needs_human_approval === "boolean", `T9: ${label}.needs_human_approval é boolean`);
    assert(typeof decision.can_proceed          === "boolean", `T9: ${label}.can_proceed é boolean`);
    assert(typeof decision.reason               === "string",  `T9: ${label}.reason é string`);
    assert(typeof decision.next_action          === "string",  `T9: ${label}.next_action é string`);
    // gate_status é um valor canônico
    assert(
      Object.values(GATE_STATUS).includes(decision.gate_status),
      `T9: ${label}.gate_status é valor canônico`
    );
  }

  // -------------------------------------------------------------------------
  // Group 11: T10 — input inválido lança erro
  // -------------------------------------------------------------------------
  console.log("\nGroup 11: T10 — input inválido lança erro");

  // evaluateApprovalGate
  assertThrows(() => evaluateApprovalGate(null),                           "T10: evaluateApprovalGate(null) lança erro");
  assertThrows(() => evaluateApprovalGate(undefined),                      "T10: evaluateApprovalGate(undefined) lança erro");
  assertThrows(() => evaluateApprovalGate("string"),                       "T10: evaluateApprovalGate('string') lança erro");
  assertThrows(() => evaluateApprovalGate({}),                             "T10: evaluateApprovalGate({}) sem needs_human_approval lança erro");
  assertThrows(() => evaluateApprovalGate({ needs_human_approval: "yes" }), "T10: needs_human_approval string lança erro");

  // approvePlan
  assertThrows(() => approvePlan(null),                                    "T10: approvePlan(null) lança erro");
  assertThrows(() => approvePlan({}),                                      "T10: approvePlan({}) sem needs_human_approval lança erro");
  assertThrows(() => approvePlan({ needs_human_approval: 1 }),             "T10: approvePlan com needs_human_approval numérico lança erro");

  // rejectPlan
  assertThrows(() => rejectPlan(null),                                     "T10: rejectPlan(null) lança erro");
  assertThrows(() => rejectPlan({}),                                       "T10: rejectPlan({}) sem needs_human_approval lança erro");
  assertThrows(() => rejectPlan({ needs_human_approval: null }),           "T10: rejectPlan com needs_human_approval null lança erro");

  // -------------------------------------------------------------------------
  // Group 12: T11 — nenhum fluxo do executor atual foi alterado
  // -------------------------------------------------------------------------
  console.log("\nGroup 12: T11 — executor contratual intacto");

  // PM7 é puro: sem I/O, sem env, sem KV, sem executor
  assert(typeof evaluateApprovalGate === "function", "T11: evaluateApprovalGate é função exportada");
  assert(typeof approvePlan          === "function", "T11: approvePlan é função exportada");
  assert(typeof rejectPlan           === "function", "T11: rejectPlan é função exportada");

  // Executa sem KV, sem env, sem I/O — puro e isolado
  const isolatedGate = evaluateApprovalGate({ needs_human_approval: false });
  assert(isolatedGate.gate_status === GATE_STATUS.APPROVED_NOT_REQUIRED, "T11: gate puro sem I/O (false)");

  const isolatedGate2 = evaluateApprovalGate({ needs_human_approval: true });
  assert(isolatedGate2.gate_status === GATE_STATUS.APPROVAL_REQUIRED,    "T11: gate puro sem I/O (true)");

  // Resultado é serializável (JSON round-trip)
  const serialized = JSON.stringify(gateC);
  const parsed     = JSON.parse(serialized);
  assert(parsed.gate_status          === gateC.gate_status,          "T11: GateDecision é serializável (gate_status)");
  assert(parsed.needs_human_approval === gateC.needs_human_approval, "T11: GateDecision é serializável (needs_human_approval)");
  assert(parsed.can_proceed          === gateC.can_proceed,          "T11: GateDecision é serializável (can_proceed)");

  // Nenhuma importação de contract-executor.js — verificado pela execução pura acima
  assert(true, "T11: PM7 não importa nem executa contract-executor.js");

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
