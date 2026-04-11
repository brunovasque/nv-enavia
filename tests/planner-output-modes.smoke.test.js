// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Output Modes v1 (PM5)
//
// Run: node tests/planner-output-modes.smoke.test.js
//
// Tests:
//   Group 1: Enum integrity
//   Group 2: T1 — classificação A gera quick_reply
//   Group 3: T2 — classificação B gera tactical_plan
//   Group 4: T3 — classificação C gera formal_contract
//   Group 5: T4 — envelope A é enxuto
//   Group 6: T5 — envelope B traz plano tático resumido
//   Group 7: T6 — envelope C traz estrutura formal e gate de aprovação
//   Group 8: T7 — determinismo (mesmo input → mesmo output)
//   Group 9: T8 — nenhum fluxo do executor atual foi alterado
//   Group 10: T9 — input inválido lança erro
//   Group 11: T10 — buildOutputEnvelope com input.text
//   Group 12: T11 — pedido simples não recebe saída pesada
//   Group 13: T12 — pedido complexo não recebe saída rasa
// ============================================================================

import {
  selectOutputMode,
  buildOutputEnvelope,
  OUTPUT_MODES,
  LEVEL_TO_OUTPUT_MODE,
} from "../schema/planner-output-modes.js";

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
// Classificações canônicas de teste (saída simulada de PM4)
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

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Output Modes — Smoke Tests (PM5) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Enum integrity
  // -------------------------------------------------------------------------
  console.log("Group 1: Enum integrity");

  assert(OUTPUT_MODES.QUICK_REPLY     === "quick_reply",     "OUTPUT_MODES.QUICK_REPLY === 'quick_reply'");
  assert(OUTPUT_MODES.TACTICAL_PLAN   === "tactical_plan",   "OUTPUT_MODES.TACTICAL_PLAN === 'tactical_plan'");
  assert(OUTPUT_MODES.FORMAL_CONTRACT === "formal_contract", "OUTPUT_MODES.FORMAL_CONTRACT === 'formal_contract'");
  assert(LEVEL_TO_OUTPUT_MODE["A"]    === "quick_reply",     "LEVEL_TO_OUTPUT_MODE.A === 'quick_reply'");
  assert(LEVEL_TO_OUTPUT_MODE["B"]    === "tactical_plan",   "LEVEL_TO_OUTPUT_MODE.B === 'tactical_plan'");
  assert(LEVEL_TO_OUTPUT_MODE["C"]    === "formal_contract", "LEVEL_TO_OUTPUT_MODE.C === 'formal_contract'");

  // -------------------------------------------------------------------------
  // Group 2: T1 — classificação A gera quick_reply
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: T1 — classificação A gera quick_reply");

  const modeA = selectOutputMode(classA);
  assert(modeA === OUTPUT_MODES.QUICK_REPLY, "T1: selectOutputMode(A) === 'quick_reply'");
  assert(typeof modeA === "string",          "T1: retorna string");

  // -------------------------------------------------------------------------
  // Group 3: T2 — classificação B gera tactical_plan
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: T2 — classificação B gera tactical_plan");

  const modeB = selectOutputMode(classB);
  assert(modeB === OUTPUT_MODES.TACTICAL_PLAN, "T2: selectOutputMode(B) === 'tactical_plan'");
  assert(typeof modeB === "string",            "T2: retorna string");

  // -------------------------------------------------------------------------
  // Group 4: T3 — classificação C gera formal_contract
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: T3 — classificação C gera formal_contract");

  const modeC = selectOutputMode(classC);
  assert(modeC === OUTPUT_MODES.FORMAL_CONTRACT, "T3: selectOutputMode(C) === 'formal_contract'");
  assert(typeof modeC === "string",              "T3: retorna string");

  // -------------------------------------------------------------------------
  // Group 5: T4 — envelope A é enxuto
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: T4 — envelope A é enxuto");

  const envA = buildOutputEnvelope(classA, { text: "Quero ver os logs do worker" });

  assert(envA.output_mode === OUTPUT_MODES.QUICK_REPLY, "T4: envelope A tem output_mode quick_reply");
  assert(envA.level       === "A",                      "T4: envelope A tem level 'A'");
  assert(typeof envA.objective === "string" && envA.objective.length > 0, "T4: objective presente e não vazio");
  assert(Array.isArray(envA.next_steps) && envA.next_steps.length > 0,   "T4: next_steps é array não vazio");
  // Envelope A NÃO deve ter campos pesados de B/C
  assert(envA.scope               === undefined, "T4: envelope A não tem 'scope'");
  assert(envA.main_steps          === undefined, "T4: envelope A não tem 'main_steps'");
  assert(envA.risks               === undefined, "T4: envelope A não tem 'risks'");
  assert(envA.acceptance_criteria === undefined, "T4: envelope A não tem 'acceptance_criteria'");
  assert(envA.macro_scope         === undefined, "T4: envelope A não tem 'macro_scope'");
  assert(envA.fronts              === undefined, "T4: envelope A não tem 'fronts'");
  assert(envA.needs_formal_contract === undefined, "T4: envelope A não tem 'needs_formal_contract'");

  // -------------------------------------------------------------------------
  // Group 6: T5 — envelope B traz plano tático resumido
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: T5 — envelope B traz plano tático resumido");

  const envB = buildOutputEnvelope(classB, {
    text: "Preciso criar um sistema de notificações com múltiplas etapas e integração",
  });

  assert(envB.output_mode === OUTPUT_MODES.TACTICAL_PLAN, "T5: envelope B tem output_mode tactical_plan");
  assert(envB.level       === "B",                        "T5: envelope B tem level 'B'");
  assert(typeof envB.objective === "string" && envB.objective.length > 0,     "T5: objective presente");
  assert(typeof envB.scope    === "string" && envB.scope.length > 0,          "T5: scope presente");
  assert(Array.isArray(envB.main_steps) && envB.main_steps.length > 0,        "T5: main_steps é array não vazio");
  assert(Array.isArray(envB.risks) && envB.risks.length > 0,                  "T5: risks é array não vazio");
  assert(Array.isArray(envB.acceptance_criteria) && envB.acceptance_criteria.length > 0, "T5: acceptance_criteria presente");
  // Envelope B NÃO deve ter campos exclusivos de C
  assert(envB.macro_scope           === undefined, "T5: envelope B não tem 'macro_scope'");
  assert(envB.fronts                === undefined, "T5: envelope B não tem 'fronts'");
  assert(envB.needs_formal_contract === undefined, "T5: envelope B não tem 'needs_formal_contract'");

  // -------------------------------------------------------------------------
  // Group 7: T6 — envelope C traz estrutura formal e gate de aprovação
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: T6 — envelope C traz estrutura formal e gate de aprovação");

  const envC = buildOutputEnvelope(classC, {
    text: "Redesenhar toda a arquitetura, migrar banco, integrar com compliance e risco alto",
  });

  assert(envC.output_mode           === OUTPUT_MODES.FORMAL_CONTRACT, "T6: envelope C tem output_mode formal_contract");
  assert(envC.level                 === "C",                          "T6: envelope C tem level 'C'");
  assert(typeof envC.objective      === "string" && envC.objective.length > 0,   "T6: objective presente");
  assert(typeof envC.macro_scope    === "string" && envC.macro_scope.length > 0, "T6: macro_scope presente");
  assert(Array.isArray(envC.fronts) && envC.fronts.length > 0,                  "T6: fronts é array não vazio");
  assert(Array.isArray(envC.risks)  && envC.risks.length > 0,                   "T6: risks é array não vazio");
  assert(envC.needs_formal_contract === true,  "T6: needs_formal_contract === true");
  assert(envC.needs_human_approval  === true,  "T6: needs_human_approval === true");
  // Envelope C NÃO deve ter campos exclusivos de A/B
  assert(envC.next_steps          === undefined, "T6: envelope C não tem 'next_steps'");
  assert(envC.scope               === undefined, "T6: envelope C não tem 'scope'");
  assert(envC.main_steps          === undefined, "T6: envelope C não tem 'main_steps'");
  assert(envC.acceptance_criteria === undefined, "T6: envelope C não tem 'acceptance_criteria'");

  // -------------------------------------------------------------------------
  // Group 8: T7 — determinismo (mesmo input → mesmo output)
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: T7 — determinismo");

  const input7 = { text: "Preciso ver o status do sistema" };

  const run1 = buildOutputEnvelope(classA, input7);
  const run2 = buildOutputEnvelope(classA, input7);
  const run3 = buildOutputEnvelope(classA, input7);

  assert(run1.output_mode === run2.output_mode,                    "T7: output_mode determinístico");
  assert(run1.objective   === run2.objective,                      "T7: objective determinístico");
  assert(JSON.stringify(run1.next_steps) === JSON.stringify(run2.next_steps), "T7: next_steps determinístico");
  assert(JSON.stringify(run1) === JSON.stringify(run3),            "T7: envelope completo determinístico");

  const modeA1 = selectOutputMode(classA);
  const modeA2 = selectOutputMode(classA);
  assert(modeA1 === modeA2, "T7: selectOutputMode determinístico");

  // -------------------------------------------------------------------------
  // Group 9: T8 — nenhum fluxo do executor atual foi alterado
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: T8 — executor contratual intacto");

  // PM5 não deve importar nem referenciar contract-executor.js.
  // Verificamos que as funções exportadas existem e são puras (sem I/O).
  assert(typeof selectOutputMode   === "function", "T8: selectOutputMode é função exportada");
  assert(typeof buildOutputEnvelope === "function", "T8: buildOutputEnvelope é função exportada");

  // Executa sem KV, sem env, sem I/O — puro e isolado
  const isolatedMode = selectOutputMode({ complexity_level: "B" });
  assert(typeof isolatedMode === "string", "T8: selectOutputMode puro sem I/O");

  const isolatedEnv = buildOutputEnvelope({ complexity_level: "A" }, null);
  assert(typeof isolatedEnv.output_mode === "string", "T8: buildOutputEnvelope puro sem I/O");
  assert(typeof isolatedEnv.objective   === "string", "T8: envelope retorna sem executor");

  // -------------------------------------------------------------------------
  // Group 10: T9 — input inválido lança erro
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: T9 — input inválido lança erro");

  assertThrows(
    () => selectOutputMode(null),
    "T9: selectOutputMode(null) lança erro"
  );
  assertThrows(
    () => selectOutputMode({}),
    "T9: selectOutputMode({}) lança erro"
  );
  assertThrows(
    () => selectOutputMode({ complexity_level: "X" }),
    "T9: selectOutputMode com nível inválido lança erro"
  );
  assertThrows(
    () => buildOutputEnvelope(null, null),
    "T9: buildOutputEnvelope(null) lança erro"
  );
  assertThrows(
    () => buildOutputEnvelope({ complexity_level: "Z" }, null),
    "T9: buildOutputEnvelope com nível inválido lança erro"
  );

  // -------------------------------------------------------------------------
  // Group 11: T10 — buildOutputEnvelope com input.text
  // -------------------------------------------------------------------------
  console.log("\nGroup 11: T10 — buildOutputEnvelope com input.text");

  const shortText = "Ver logs";
  const envWithText = buildOutputEnvelope(classA, { text: shortText });
  assert(envWithText.objective === shortText, "T10: objective reflete input.text curto");

  const longText = "A".repeat(200);
  const envWithLong = buildOutputEnvelope(classA, { text: longText });
  assert(envWithLong.objective.length <= 120, "T10: objective truncado em 120 chars para texto longo");
  assert(envWithLong.objective.endsWith("..."), "T10: objetivo truncado termina com '...'");

  // sem input.text — fallback para reason
  const envNoText = buildOutputEnvelope(classA, null);
  assert(
    typeof envNoText.objective === "string" && envNoText.objective.length > 0,
    "T10: objective não vazio mesmo sem input.text"
  );

  // -------------------------------------------------------------------------
  // Group 12: T11 — pedido simples não recebe saída pesada
  // -------------------------------------------------------------------------
  console.log("\nGroup 12: T11 — pedido simples não recebe saída pesada");

  const simpleEnv = buildOutputEnvelope(classA, { text: "listar tarefas" });
  const heavyFields = ["macro_scope", "fronts", "needs_formal_contract", "main_steps", "acceptance_criteria", "scope"];
  for (const field of heavyFields) {
    assert(simpleEnv[field] === undefined, `T11: envelope A não contém campo pesado '${field}'`);
  }

  // -------------------------------------------------------------------------
  // Group 13: T12 — pedido complexo não recebe saída rasa
  // -------------------------------------------------------------------------
  console.log("\nGroup 13: T12 — pedido complexo não recebe saída rasa");

  const complexEnv = buildOutputEnvelope(classC, { text: "redesenhar toda a arquitetura com risco alto" });
  assert(complexEnv.needs_formal_contract === true, "T12: complexo tem needs_formal_contract=true");
  assert(complexEnv.needs_human_approval  === true, "T12: complexo tem needs_human_approval=true");
  assert(complexEnv.fronts  !== undefined,          "T12: complexo tem fronts");
  assert(complexEnv.risks   !== undefined,          "T12: complexo tem risks");
  // Campo raso NÃO deve aparecer em C
  assert(complexEnv.next_steps === undefined,       "T12: complexo não tem 'next_steps' (saída rasa)");

  // ---- Summary ----
  console.log(`\n${"=".repeat(55)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(55)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
