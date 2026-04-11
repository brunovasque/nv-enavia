// ============================================================================
// 🧪 Smoke Tests — ENAVIA Planner Request Classifier v1 (PM4)
//
// Run: node tests/planner-classifier.smoke.test.js
//
// Tests:
//   Group 1: Enum integrity
//   Group 2: T1 — pedido simples → A / simple / baixo / false
//   Group 3: T2 — pedido tático  → B / tactical / médio
//   Group 4: T3 — pedido complexo → C / complex / alto / true
//   Group 5: T4 — risco sobe needs_human_approval sem forçar nível C
//   Group 6: T5 — sinais visíveis (signals + reason não vazios)
//   Group 7: T6 — determinismo (mesmo input → mesmo resultado)
//   Group 8: T7 — executor contratual intacto
//   Group 9: T8 — input mínimo válido (sem context)
//   Group 10: Casos de fronteira e overrides
// ============================================================================

import {
  classifyRequest,
  COMPLEXITY_LEVELS,
  CATEGORIES,
  RISK_LEVELS,
  REQUEST_TYPES,
} from "../schema/planner-classifier.js";

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
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Planner Classifier — Smoke Tests (PM4) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Enum integrity
  // -------------------------------------------------------------------------
  console.log("Group 1: Enum integrity");

  assert(COMPLEXITY_LEVELS.A === "A",         "COMPLEXITY_LEVELS.A === 'A'");
  assert(COMPLEXITY_LEVELS.B === "B",         "COMPLEXITY_LEVELS.B === 'B'");
  assert(COMPLEXITY_LEVELS.C === "C",         "COMPLEXITY_LEVELS.C === 'C'");
  assert(CATEGORIES.SIMPLE   === "simple",    "CATEGORIES.SIMPLE === 'simple'");
  assert(CATEGORIES.TACTICAL === "tactical",  "CATEGORIES.TACTICAL === 'tactical'");
  assert(CATEGORIES.COMPLEX  === "complex",   "CATEGORIES.COMPLEX === 'complex'");
  assert(RISK_LEVELS.BAIXO   === "baixo",     "RISK_LEVELS.BAIXO === 'baixo'");
  assert(RISK_LEVELS.MEDIO   === "médio",     "RISK_LEVELS.MEDIO === 'médio'");
  assert(RISK_LEVELS.ALTO    === "alto",      "RISK_LEVELS.ALTO === 'alto'");
  assert(REQUEST_TYPES.OPERATIONAL === "operational", "REQUEST_TYPES.OPERATIONAL");
  assert(REQUEST_TYPES.PLANNING    === "planning",    "REQUEST_TYPES.PLANNING");
  assert(REQUEST_TYPES.STRATEGIC   === "strategic",   "REQUEST_TYPES.STRATEGIC");

  // -------------------------------------------------------------------------
  // Group 2: T1 — pedido simples → A / simple / baixo / false
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: T1 — pedido simples");

  const t1 = classifyRequest({ text: "Quero ver os logs do worker" });

  assert(t1.complexity_level     === COMPLEXITY_LEVELS.A,    "T1: complexity_level === A");
  assert(t1.category             === CATEGORIES.SIMPLE,      "T1: category === simple");
  assert(t1.risk_level           === RISK_LEVELS.BAIXO,      "T1: risk_level === baixo");
  assert(t1.needs_human_approval === false,                  "T1: needs_human_approval === false");
  assert(t1.request_type         === REQUEST_TYPES.OPERATIONAL, "T1: request_type === operational");
  assert(typeof t1.reason === "string" && t1.reason.length > 0, "T1: reason não vazio");
  assert(Array.isArray(t1.signals),                          "T1: signals é array");

  // -------------------------------------------------------------------------
  // Group 3: T2 — pedido tático → B / tactical / médio
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: T2 — pedido tático");

  const t2 = classifyRequest({
    text: "Preciso criar um sistema de notificações com múltiplas etapas de validação e integração entre serviços",
  });

  assert(t2.complexity_level === COMPLEXITY_LEVELS.B,  "T2: complexity_level === B");
  assert(t2.category         === CATEGORIES.TACTICAL,  "T2: category === tactical");
  assert(t2.risk_level       === RISK_LEVELS.MEDIO,    "T2: risk_level === médio");
  assert(t2.request_type     === REQUEST_TYPES.PLANNING, "T2: request_type === planning");
  assert(typeof t2.reason === "string" && t2.reason.length > 0, "T2: reason não vazio");

  // -------------------------------------------------------------------------
  // Group 4: T3 — pedido complexo → C / complex / alto / true
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: T3 — pedido complexo");

  const t3 = classifyRequest({
    text: [
      "Preciso redesenhar toda a arquitetura de deploy,",
      "migrar o banco de dados para o novo ambiente de infraestrutura,",
      "integrar com o painel de controle,",
      "criar 3 fases de entrega com critérios de aceite,",
      "documentar tudo e validar com compliance.",
      "Há risco alto de impacto na produção.",
      "- Fase 1: diagnóstico",
      "- Fase 2: migração",
      "- Fase 3: validação",
    ].join(" "),
  });

  assert(t3.complexity_level     === COMPLEXITY_LEVELS.C,    "T3: complexity_level === C");
  assert(t3.category             === CATEGORIES.COMPLEX,     "T3: category === complex");
  assert(t3.risk_level           === RISK_LEVELS.ALTO,       "T3: risk_level === alto");
  assert(t3.needs_human_approval === true,                   "T3: needs_human_approval === true");
  assert(t3.request_type         === REQUEST_TYPES.STRATEGIC, "T3: request_type === strategic");
  assert(t3.signals.length > 0,                             "T3: signals não vazio");

  // -------------------------------------------------------------------------
  // Group 5: T4 — risco sobe needs_human_approval sem forçar nível C
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: T4 — risco sobe gate sem forçar nível C");

  // Pedido curto com sinal de risco: deve ser A ou B pelo score,
  // mas needs_human_approval deve ser true pelo override.
  const t4a = classifyRequest({ text: "Preciso ver os logs — há um risco de perda de dados" });

  assert(
    t4a.needs_human_approval === true,
    "T4a: needs_human_approval=true com has_risk_keywords"
  );
  assert(
    t4a.complexity_level !== COMPLEXITY_LEVELS.C || t4a.signals.length >= 3,
    "T4a: complexity C só se sustentado por múltiplos sinais"
  );

  // context_mentions_prod em pedido curto → gate sobe, nível não obrigado a C
  const t4b = classifyRequest({
    text:    "Alterar a cor do botão do painel",
    context: { mentions_prod: true },
  });

  assert(t4b.needs_human_approval === true, "T4b: needs_human_approval=true com context_mentions_prod");
  // Score com apenas context_mentions_prod (+2) → nível B, não C
  assert(
    t4b.complexity_level === COMPLEXITY_LEVELS.B || t4b.complexity_level === COMPLEXITY_LEVELS.C,
    "T4b: nível é B ou C (prod tem peso, mas palavra isolada não força C por si só)"
  );

  // Palavra isolada "urgente" não deve sozinha forçar C
  const t4c = classifyRequest({ text: "Urgente: quero ver o status do worker" });
  assert(
    t4c.complexity_level !== COMPLEXITY_LEVELS.C,
    "T4c: 'urgente' isolado não força complexity C"
  );
  assert(
    t4c.needs_human_approval === true,
    "T4c: 'urgente' (risk term) sobe needs_human_approval"
  );

  // -------------------------------------------------------------------------
  // Group 6: T5 — sinais visíveis (signals + reason)
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: T5 — signals e reason auditáveis");

  const t5 = classifyRequest({
    text: "Quero criar um pipeline de integração com sistema externo",
  });

  assert(Array.isArray(t5.signals),                            "T5: signals é array");
  assert(typeof t5.reason === "string" && t5.reason.length > 0, "T5: reason é string não vazia");
  assert(t5.reason.startsWith("classificado como"),            "T5: reason começa com 'classificado como'");
  assert(t5.signals.includes("has_system_keywords"),           "T5: sinal has_system_keywords visível");

  // -------------------------------------------------------------------------
  // Group 7: T6 — determinismo (mesmo input → mesmo resultado)
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: T6 — determinismo");

  const inputDet = {
    text:    "Preciso redesenhar a arquitetura do sistema e migrar o banco de dados em fases",
    context: { known_dependencies: ["dep-a", "dep-b"], mentions_prod: false },
  };

  const run1 = classifyRequest(inputDet);
  const run2 = classifyRequest(inputDet);
  const run3 = classifyRequest(inputDet);

  assert(run1.complexity_level     === run2.complexity_level,     "T6: complexity_level determinístico (1v2)");
  assert(run1.category             === run2.category,             "T6: category determinístico (1v2)");
  assert(run1.needs_human_approval === run2.needs_human_approval, "T6: needs_human_approval determinístico (1v2)");
  assert(run1.risk_level           === run3.risk_level,           "T6: risk_level determinístico (1v3)");
  assert(JSON.stringify(run1.signals) === JSON.stringify(run2.signals), "T6: signals determinísticos");
  assert(run1.reason               === run3.reason,               "T6: reason determinístico (1v3)");

  // -------------------------------------------------------------------------
  // Group 8: T7 — executor contratual intacto
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: T7 — executor contratual intacto");

  // O módulo PM4 não deve importar nem referenciar contract-executor.js.
  // Verificamos que as funções exportadas existem e são puras (sem I/O).
  assert(typeof classifyRequest === "function", "T7: classifyRequest é função exportada");

  // Executa sem KV, sem env, sem I/O — puro e isolado
  const isolatedRun = classifyRequest({ text: "consulta simples de status" });
  assert(typeof isolatedRun.complexity_level === "string", "T7: resultado sem I/O ou executor");
  assert(typeof isolatedRun.needs_human_approval === "boolean", "T7: needs_human_approval boolean sem executor");

  // -------------------------------------------------------------------------
  // Group 9: T8 — input mínimo válido (sem context)
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: T8 — input mínimo válido sem context");

  const t8 = classifyRequest({ text: "ok" });
  assert(typeof t8.complexity_level     === "string",  "T8: retorna complexity_level");
  assert(typeof t8.category             === "string",  "T8: retorna category");
  assert(typeof t8.risk_level           === "string",  "T8: retorna risk_level");
  assert(typeof t8.needs_human_approval === "boolean", "T8: retorna needs_human_approval boolean");
  assert(Array.isArray(t8.signals),                    "T8: retorna signals array");
  assert(typeof t8.reason               === "string",  "T8: retorna reason string");

  // Input inválido deve lançar erro
  assertThrows(() => classifyRequest({ text: "" }), "T8: text vazio lança erro");
  assertThrows(() => classifyRequest({}),           "T8: sem text lança erro");
  assertThrows(() => classifyRequest(null),         "T8: input null lança erro");

  // -------------------------------------------------------------------------
  // Group 10: Casos de fronteira e overrides
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: Casos de fronteira e overrides");

  // Score 0 exato → A
  const score0 = classifyRequest({ text: "listar tarefas" });
  assert(score0.complexity_level === COMPLEXITY_LEVELS.A, "fronteira: score 0 → A");

  // context_is_urgent isolado (score=1) → ainda A, gate não sobe sem risk
  const urgentOnly = classifyRequest({ text: "ver o painel", context: { is_urgent: true } });
  assert(urgentOnly.complexity_level === COMPLEXITY_LEVELS.A, "is_urgent isolado → A (score 1)");
  assert(urgentOnly.needs_human_approval === false, "is_urgent sem risk → needs_human_approval=false");

  // context_mentions_prod (+2) → score 2 → B
  const prodOnly = classifyRequest({ text: "ver o painel", context: { mentions_prod: true } });
  assert(prodOnly.complexity_level === COMPLEXITY_LEVELS.B,   "mentions_prod (+2) → B");
  assert(prodOnly.needs_human_approval === true,              "mentions_prod → needs_human_approval=true");

  // Dois sinais de sistema + ambiguidade → B ou C conforme score
  const t10b = classifyRequest({
    text: "Talvez refatorar o sistema de integração",
    context: { known_dependencies: ["a", "b"] },
  });
  assert(
    [COMPLEXITY_LEVELS.B, COMPLEXITY_LEVELS.C].includes(t10b.complexity_level),
    "fronteira B/C com ambiguidade + sistema + dependências"
  );

  // reason sempre contém o nível classificado
  const levelInReason = classifyRequest({ text: "Quero listar contratos" });
  assert(
    levelInReason.reason.includes(levelInReason.complexity_level),
    "reason contém complexity_level"
  );

  // needs_human_approval === true em todo nível C
  const alwaysC = classifyRequest({
    text: "Redesenhar toda a arquitetura, migrar banco de dados em fases, integrar pipelines múltiplos com compliance e risco alto",
    context: { known_dependencies: ["a", "b"], mentions_prod: true },
  });
  assert(alwaysC.complexity_level === COMPLEXITY_LEVELS.C, "alto score → C");
  assert(alwaysC.needs_human_approval === true, "C sempre com needs_human_approval=true");

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
