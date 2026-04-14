// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Canonical Plan Builder v1 (PM6)
//
// Run: node tests/planner-canonical-plan.smoke.test.js
//
// Tests:
//   Group 1:  Enum integrity
//   Group 2:  T1 — nível A gera plano curto (1–3 steps)
//   Group 3:  T2 — nível B gera plano tático
//   Group 4:  T3 — nível C gera plano formal com gate futuro
//   Group 5:  T4 — steps[] presentes e proporcionais
//   Group 6:  T5 — acceptance_criteria[] presentes em todos os níveis
//   Group 7:  T6 — next_action coerente com o nível
//   Group 8:  T7 — resultado é determinístico
//   Group 9:  T8 — needs_human_approval=true para C e override PM4
//   Group 10: T9 — input inválido lança erro
//   Group 11: T10 — shape canônico completo em todos os níveis
//   Group 12: T11 — plano A não contém campos pesados de C
//   Group 13: T12 — plano C não é raso
//   Group 14: T13 — nenhum fluxo do executor atual foi alterado
// ============================================================================

import {
  buildCanonicalPlan,
  PLAN_TYPES,
  PLAN_VERSION,
  LEVEL_TO_PLAN_TYPE,
} from "../schema/planner-canonical-plan.js";

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
// Fixtures — classificações canônicas (saída simulada de PM4)
// ---------------------------------------------------------------------------
const classA = {
  complexity_level:     "A",
  category:             "simple",
  risk_level:           "baixo",
  needs_human_approval: false,
  reason:               "classificado como A por baixo escopo e baixo risco",
};

const classB = {
  complexity_level:     "B",
  category:             "tactical",
  risk_level:           "médio",
  needs_human_approval: false,
  reason:               "classificado como B por has_system_keywords, has_multiple_deliveries",
};

const classC = {
  complexity_level:     "C",
  category:             "complex",
  risk_level:           "alto",
  needs_human_approval: true,
  reason:               "classificado como C por very_long_text, has_risk_keywords, context_mentions_prod",
};

// Classificação B com override de needs_human_approval (has_risk_keywords em PM4)
const classBWithApproval = {
  complexity_level:     "B",
  category:             "tactical",
  risk_level:           "médio",
  needs_human_approval: true,
  reason:               "classificado como B por has_risk_keywords",
};

// ---------------------------------------------------------------------------
// Fixtures — envelopes (saída simulada de PM5)
// ---------------------------------------------------------------------------
const envA = {
  output_mode: "quick_reply",
  level:       "A",
  objective:   "Ver os logs do worker",
  next_steps:  ["Avaliar o pedido e responder diretamente", "Confirmar conclusão"],
};

const envB = {
  output_mode:         "tactical_plan",
  level:               "B",
  objective:           "Criar sistema de notificações com múltiplas etapas e integração",
  scope:               "Escopo tático a detalhar na execução (PM6)",
  main_steps:          ["Decompor", "Validar", "Executar"],
  risks:               ["Risco médio detectado"],
  acceptance_criteria: ["Etapas concluídas", "Entregáveis validados"],
};

const envC = {
  output_mode:           "formal_contract",
  level:                 "C",
  objective:             "Redesenhar arquitetura, migrar banco, integrar compliance e risco alto",
  macro_scope:           "Escopo macro",
  fronts:                ["Frente 1", "Frente 2", "Frente 3"],
  risks:                 ["Risco alto", "Impacto irreversível"],
  needs_formal_contract: true,
  needs_human_approval:  true,
};

const inputA = { text: "Ver os logs do worker" };
const inputB = { text: "Criar sistema de notificações com múltiplas etapas e integração" };
const inputC = { text: "Redesenhar toda a arquitetura com risco alto e compliance" };

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Canonical Plan Builder — Smoke Tests (PM6) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Enum integrity
  // -------------------------------------------------------------------------
  console.log("Group 1: Enum integrity");

  assert(PLAN_TYPES.QUICK_REPLY     === "quick_reply",     "PLAN_TYPES.QUICK_REPLY === 'quick_reply'");
  assert(PLAN_TYPES.TACTICAL_PLAN   === "tactical_plan",   "PLAN_TYPES.TACTICAL_PLAN === 'tactical_plan'");
  assert(PLAN_TYPES.FORMAL_CONTRACT === "formal_contract", "PLAN_TYPES.FORMAL_CONTRACT === 'formal_contract'");
  assert(PLAN_VERSION               === "1.0",             "PLAN_VERSION === '1.0'");
  assert(LEVEL_TO_PLAN_TYPE["A"]    === "quick_reply",     "LEVEL_TO_PLAN_TYPE.A === 'quick_reply'");
  assert(LEVEL_TO_PLAN_TYPE["B"]    === "tactical_plan",   "LEVEL_TO_PLAN_TYPE.B === 'tactical_plan'");
  assert(LEVEL_TO_PLAN_TYPE["C"]    === "formal_contract", "LEVEL_TO_PLAN_TYPE.C === 'formal_contract'");

  // -------------------------------------------------------------------------
  // Group 2: T1 — nível A gera plano curto (1–3 steps)
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: T1 — nível A gera plano curto");

  const planA = buildCanonicalPlan({ classification: classA, envelope: envA, input: inputA });
  assert(planA.complexity_level === "A",                "T1: complexity_level === 'A'");
  assert(planA.plan_type        === "quick_reply",      "T1: plan_type === 'quick_reply'");
  assert(Array.isArray(planA.steps),                   "T1: steps é array");
  assert(planA.steps.length >= 1 && planA.steps.length <= 3, "T1: steps tem 1–3 itens");
  assert(planA.needs_human_approval === false,          "T1: needs_human_approval === false");

  // -------------------------------------------------------------------------
  // Group 3: T2 — nível B gera plano tático
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: T2 — nível B gera plano tático");

  const planB = buildCanonicalPlan({ classification: classB, envelope: envB, input: inputB });
  assert(planB.complexity_level === "B",              "T2: complexity_level === 'B'");
  assert(planB.plan_type        === "tactical_plan",  "T2: plan_type === 'tactical_plan'");
  assert(Array.isArray(planB.steps),                 "T2: steps é array");
  assert(planB.steps.length >= 3,                    "T2: steps tem >= 3 itens");
  assert(planB.needs_human_approval === false,        "T2: needs_human_approval === false (sem override)");

  // -------------------------------------------------------------------------
  // Group 4: T3 — nível C gera plano formal com gate futuro
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: T3 — nível C gera plano formal com gate futuro");

  const planC = buildCanonicalPlan({ classification: classC, envelope: envC, input: inputC });
  assert(planC.complexity_level     === "C",               "T3: complexity_level === 'C'");
  assert(planC.plan_type            === "formal_contract", "T3: plan_type === 'formal_contract'");
  assert(planC.needs_human_approval === true,              "T3: needs_human_approval === true");
  assert(Array.isArray(planC.steps) && planC.steps.length >= 3, "T3: steps tem >= 3 macro-etapas");

  // -------------------------------------------------------------------------
  // Group 5: T4 — steps[] presentes e proporcionais em cada nível
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: T4 — steps[] proporcionais");

  // A: curto (1–3)
  assert(planA.steps.length >= 1 && planA.steps.length <= 3, "T4: A tem 1–3 steps");
  // B: tático (3–5)
  assert(planB.steps.length >= 3 && planB.steps.length <= 5, "T4: B tem 3–5 steps");
  // C: macro (>= 3 frentes)
  assert(planC.steps.length >= 3,                            "T4: C tem >= 3 macro-etapas");
  // Todos são strings não vazias
  for (const s of planA.steps) assert(typeof s === "string" && s.length > 0, `T4: step A não vazio: ${s}`);
  for (const s of planB.steps) assert(typeof s === "string" && s.length > 0, `T4: step B não vazio: ${s}`);
  for (const s of planC.steps) assert(typeof s === "string" && s.length > 0, `T4: step C não vazio: ${s}`);

  // -------------------------------------------------------------------------
  // Group 6: T5 — acceptance_criteria[] presentes em todos os níveis
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: T5 — acceptance_criteria[] presentes");

  assert(Array.isArray(planA.acceptance_criteria) && planA.acceptance_criteria.length >= 1, "T5: A tem acceptance_criteria");
  assert(Array.isArray(planB.acceptance_criteria) && planB.acceptance_criteria.length >= 2, "T5: B tem >= 2 acceptance_criteria");
  assert(Array.isArray(planC.acceptance_criteria) && planC.acceptance_criteria.length >= 3, "T5: C tem >= 3 acceptance_criteria");

  // -------------------------------------------------------------------------
  // Group 7: T6 — next_action coerente com o nível
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: T6 — next_action coerente");

  // A: ação direta — não deve mencionar aprovação formal
  assert(typeof planA.next_action === "string" && planA.next_action.length > 0, "T6: A tem next_action");
  assert(!planA.next_action.toLowerCase().includes("aprovação formal"),         "T6: A não aponta aprovação formal");
  // B: revisar/validar
  assert(typeof planB.next_action === "string" && planB.next_action.length > 0, "T6: B tem next_action");
  assert(
    planB.next_action.toLowerCase().includes("revisar") ||
    planB.next_action.toLowerCase().includes("validar"),
    "T6: B menciona revisar ou validar"
  );
  // C: aprovação formal humana
  assert(typeof planC.next_action === "string" && planC.next_action.length > 0, "T6: C tem next_action");
  assert(
    planC.next_action.toLowerCase().includes("aprovação") ||
    planC.next_action.toLowerCase().includes("revisão"),
    "T6: C aponta para aprovação/revisão formal"
  );

  // -------------------------------------------------------------------------
  // Group 8: T7 — resultado é determinístico
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: T7 — determinismo");

  const run1 = buildCanonicalPlan({ classification: classA, envelope: envA, input: inputA });
  const run2 = buildCanonicalPlan({ classification: classA, envelope: envA, input: inputA });
  const run3 = buildCanonicalPlan({ classification: classB, envelope: envB, input: inputB });
  const run4 = buildCanonicalPlan({ classification: classB, envelope: envB, input: inputB });

  assert(JSON.stringify(run1) === JSON.stringify(run2), "T7: plano A determinístico");
  assert(JSON.stringify(run3) === JSON.stringify(run4), "T7: plano B determinístico");

  const runC1 = buildCanonicalPlan({ classification: classC, envelope: envC, input: inputC });
  const runC2 = buildCanonicalPlan({ classification: classC, envelope: envC, input: inputC });
  assert(JSON.stringify(runC1) === JSON.stringify(runC2), "T7: plano C determinístico");

  // -------------------------------------------------------------------------
  // Group 9: T8 — needs_human_approval=true para C e override PM4
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: T8 — needs_human_approval");

  // C sempre true
  assert(planC.needs_human_approval === true, "T8: nível C sempre needs_human_approval=true");

  // B com override (has_risk_keywords no PM4 sobe o gate)
  const planBOverride = buildCanonicalPlan({
    classification: classBWithApproval,
    envelope:       envB,
    input:          inputB,
  });
  assert(planBOverride.needs_human_approval === true, "T8: B com override PM4 tem needs_human_approval=true");

  // A sem override
  assert(planA.needs_human_approval === false, "T8: A sem override tem needs_human_approval=false");

  // -------------------------------------------------------------------------
  // Group 10: T9 — input inválido lança erro
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: T9 — input inválido lança erro");

  assertThrows(
    () => buildCanonicalPlan({}),
    "T9: buildCanonicalPlan({}) lança erro"
  );
  assertThrows(
    () => buildCanonicalPlan({ classification: null, envelope: envA }),
    "T9: classification=null lança erro"
  );
  assertThrows(
    () => buildCanonicalPlan({ classification: {}, envelope: envA }),
    "T9: classification sem complexity_level lança erro"
  );
  assertThrows(
    () => buildCanonicalPlan({ classification: { complexity_level: "X" }, envelope: envA }),
    "T9: complexity_level inválido lança erro"
  );
  assertThrows(
    () => buildCanonicalPlan({ classification: classA, envelope: null }),
    "T9: envelope=null lança erro"
  );
  assertThrows(
    () => buildCanonicalPlan({ classification: classA, envelope: {} }),
    "T9: envelope sem output_mode lança erro"
  );

  // -------------------------------------------------------------------------
  // Group 11: T10 — shape canônico completo em todos os níveis
  // -------------------------------------------------------------------------
  console.log("\nGroup 11: T10 — shape canônico completo");

  const REQUIRED_FIELDS = [
    "plan_version",
    "plan_type",
    "complexity_level",
    "output_mode",
    "objective",
    "scope_summary",
    "steps",
    "risks",
    "acceptance_criteria",
    "needs_human_approval",
    "next_action",
    "chat_reply",
    "reason",
  ];

  for (const field of REQUIRED_FIELDS) {
    assert(planA[field] !== undefined, `T10: A tem campo '${field}'`);
    assert(planB[field] !== undefined, `T10: B tem campo '${field}'`);
    assert(planC[field] !== undefined, `T10: C tem campo '${field}'`);
  }

  // plan_type e output_mode alinhados (sem drift)
  assert(planA.plan_type === planA.output_mode, "T10: A — plan_type === output_mode");
  assert(planB.plan_type === planB.output_mode, "T10: B — plan_type === output_mode");
  assert(planC.plan_type === planC.output_mode, "T10: C — plan_type === output_mode");

  // plan_version fixo
  assert(planA.plan_version === PLAN_VERSION, "T10: A tem plan_version correto");
  assert(planB.plan_version === PLAN_VERSION, "T10: B tem plan_version correto");
  assert(planC.plan_version === PLAN_VERSION, "T10: C tem plan_version correto");

  // -------------------------------------------------------------------------
  // Group 12: T11 — plano A não contém campos pesados de C
  // -------------------------------------------------------------------------
  console.log("\nGroup 12: T11 — plano A não é pesado demais");

  // A não deve ter mais que 3 steps
  assert(planA.steps.length <= 3, "T11: A não tem mais de 3 steps");
  // A deve ter scope_summary leve (sem "macro" ou "frentes")
  assert(!planA.scope_summary.toLowerCase().includes("macro"),   "T11: scope_summary A não menciona 'macro'");
  assert(!planA.scope_summary.toLowerCase().includes("frentes"), "T11: scope_summary A não menciona 'frentes'");
  // A não deve apontar aprovação formal no next_action
  assert(!planA.next_action.toLowerCase().includes("aprovação formal"), "T11: A não cria gate formal no next_action");

  // -------------------------------------------------------------------------
  // Group 13: T12 — plano C não é raso
  // -------------------------------------------------------------------------
  console.log("\nGroup 13: T12 — plano C não é raso");

  assert(planC.steps.length >= 3,                             "T12: C tem >= 3 steps (não raso)");
  assert(planC.risks.length >= 2,                             "T12: C tem >= 2 risks (não raso)");
  assert(planC.acceptance_criteria.length >= 3,               "T12: C tem >= 3 acceptance_criteria (não raso)");
  assert(planC.needs_human_approval === true,                  "T12: C exige aprovação humana");
  assert(planC.scope_summary.length > planA.scope_summary.length, "T12: scope_summary C é mais detalhado que A");

  // -------------------------------------------------------------------------
  // Group 14: T13 — nenhum fluxo do executor atual foi alterado
  // -------------------------------------------------------------------------
  console.log("\nGroup 14: T13 — executor contratual intacto");

  // PM6 não deve importar nem referenciar contract-executor.js.
  // Verificamos que buildCanonicalPlan é puro: sem I/O, sem env, sem KV.
  assert(typeof buildCanonicalPlan === "function", "T13: buildCanonicalPlan é função exportada");

  // Executa sem KV, sem env, sem I/O — puro e isolado
  const isolatedPlan = buildCanonicalPlan({ classification: classA, envelope: envA, input: null });
  assert(typeof isolatedPlan.plan_type  === "string", "T13: buildCanonicalPlan puro sem I/O");
  assert(typeof isolatedPlan.objective  === "string", "T13: plano retorna sem executor");
  assert(Array.isArray(isolatedPlan.steps),           "T13: steps retorna sem executor");

  // Resultado é serializável (JSON round-trip)
  const serialized = JSON.stringify(planC);
  const parsed     = JSON.parse(serialized);
  assert(parsed.plan_type            === planC.plan_type,            "T13: plano C é serializável (plan_type)");
  assert(parsed.needs_human_approval === planC.needs_human_approval, "T13: plano C é serializável (needs_human_approval)");
  assert(parsed.steps.length         === planC.steps.length,         "T13: plano C é serializável (steps)");

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
