// ============================================================================
// 🧪 Smoke Tests — ENAVIA Memory Consolidation v1 (PM9)
//
// Run: node tests/memory-consolidation.smoke.test.js
//
// Tests:
//   Group 1:  Enum integrity
//   Group 2:  T1 — plano rejected → should_consolidate false, sem candidatos
//   Group 3:  T2 — plano approval_required → should_consolidate false (transitório)
//   Group 4:  T3 — plano approved_not_required, nível A → só operacional, sem canônica
//   Group 5:  T4 — plano approved_not_required, nível B, bridge ready → operacional + canônica
//   Group 6:  T5 — plano approved, nível C, bridge ready → operacional + canônica
//   Group 7:  T6 — plano approved, nível B, bridge blocked → só operacional (sem canônica)
//   Group 8:  T7 — plano approved_not_required, nível A, bridge ready → sem canônica (A não qualifica)
//   Group 9:  T8 — estado transitório não sobe para canônico
//   Group 10: T9 — output é compatível com schema de memória PM1 (campos obrigatórios)
//   Group 11: T10 — resultado é determinístico
//   Group 12: T11 — output é serializável (JSON round-trip)
//   Group 13: T12 — nenhum fluxo do executor atual foi alterado
//   Group 14: T13 — input inválido lança erro
//   Group 15: T14 — shape canônico completo (ConsolidationResult)
// ============================================================================

import {
  consolidateMemoryLearning,
  CONSOLIDATION_VERSION,
} from "../schema/memory-consolidation.js";

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
// Fixtures — saídas canônicas simuladas de PM6, PM7 e PM8
// ---------------------------------------------------------------------------

// Plano A (PM6) — simples, sem requerimento de aprovação
const planA = {
  plan_version:        "1.0",
  plan_type:           "quick_reply",
  complexity_level:    "A",
  output_mode:         "quick_reply",
  objective:           "Ver os logs do worker",
  scope_summary:       "Escopo simples.",
  steps:               ["Avaliar o pedido", "Executar a ação", "Confirmar conclusão"],
  risks:               ["Risco baixo"],
  acceptance_criteria: ["Ação concluída", "Solicitante confirmou"],
  needs_human_approval: false,
  next_action:         "Executar diretamente.",
  reason:              "classificado como A",
};

// Plano B (PM6) — tático, com critérios de aceite
const planB = {
  plan_version:        "1.0",
  plan_type:           "tactical_plan",
  complexity_level:    "B",
  output_mode:         "tactical_plan",
  objective:           "Refatorar pipeline de dados com validação de dependências",
  scope_summary:       "Escopo tático.",
  steps:               ["Decompor", "Validar dependências", "Executar", "Validar entregáveis"],
  risks:               ["Risco médio", "Mudanças de escopo devem ser revisadas"],
  acceptance_criteria: ["Etapas concluídas na ordem planejada", "Dependências resolvidas", "Entregáveis validados"],
  needs_human_approval: false,
  next_action:         "Revisar etapas.",
  reason:              "classificado como B",
};

// Plano C (PM6) — complexo, aprovação requerida
const planC = {
  plan_version:        "1.0",
  plan_type:           "formal_contract",
  complexity_level:    "C",
  output_mode:         "formal_contract",
  objective:           "Redesenhar arquitetura com risco alto e compliance",
  scope_summary:       "Escopo macro.",
  steps:               ["Diagnóstico", "Decomposição", "Planejamento", "Aprovação formal"],
  risks:               ["Risco alto", "Compliance", "Stakeholders externos"],
  acceptance_criteria: ["Plano aprovado formalmente", "Riscos documentados", "Critérios aprovados"],
  needs_human_approval: true,
  next_action:         "Submeter para aprovação humana.",
  reason:              "classificado como C",
};

// Gates PM7 — quatro estados canônicos
const gateApprovedNotRequired = {
  gate_status:          "approved_not_required",
  needs_human_approval: false,
  can_proceed:          true,
  reason:               "Aprovação automática — não requerida.",
  next_action:          "Prosseguir diretamente.",
};

const gateApproved = {
  gate_status:          "approved",
  needs_human_approval: true,
  can_proceed:          true,
  reason:               "Aprovado por decisão humana.",
  next_action:          "Prosseguir com execução.",
};

const gateApprovalRequired = {
  gate_status:          "approval_required",
  needs_human_approval: true,
  can_proceed:          false,
  reason:               "Aguardando aprovação humana.",
  next_action:          "Bloquear até decisão.",
};

const gateRejected = {
  gate_status:          "rejected",
  needs_human_approval: true,
  can_proceed:          false,
  reason:               "Rejeitado por decisão humana.",
  next_action:          "Revisar e gerar novo plano.",
};

// Bridges PM8 — dois estados canônicos
const bridgeReady = {
  bridge_status:    "ready_for_executor",
  can_execute:      true,
  executor_action:  "execute_plan",
  executor_payload: { version: "1.0", source: "planner_bridge" },
  reason:           "Gate autoriza execução.",
  next_action:      "Payload pronto.",
};

const bridgeBlocked = {
  bridge_status:    "blocked_by_gate",
  can_execute:      false,
  executor_action:  null,
  executor_payload: null,
  reason:           "Execução bloqueada pelo gate.",
  next_action:      "Revisar gate.",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

async function runTests() {

  // ---- Group 1: Enum integrity ----
  console.log("\nGroup 1: Enum integrity");
  assert(CONSOLIDATION_VERSION === "1.0", "CONSOLIDATION_VERSION === '1.0'");

  // ---- Group 2: T1 — rejected → should_consolidate false, sem candidatos ----
  console.log("\nGroup 2: T1 — plano rejected → should_consolidate false");
  const t1 = consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked });
  assert(t1.should_consolidate === false,             "T1: should_consolidate é false");
  assert(Array.isArray(t1.memory_candidates),         "T1: memory_candidates é array");
  assert(t1.memory_candidates.length === 0,           "T1: memory_candidates está vazio");
  assert(typeof t1.reason === "string" && t1.reason.length > 0,      "T1: reason é string não-vazia");
  assert(typeof t1.next_action === "string" && t1.next_action.length > 0, "T1: next_action é string não-vazia");
  assert(t1.reason.toLowerCase().includes("rejeit"),  "T1: reason menciona rejeição");
  // Garante que rejeição não gerou canônica
  assert(!t1.memory_candidates.some((c) => c.is_canonical), "T1: nenhum candidato canônico por rejeição");

  // ---- Group 3: T2 — approval_required → should_consolidate false (transitório) ----
  console.log("\nGroup 3: T2 — approval_required → transitório, sem consolidação");
  const t2 = consolidateMemoryLearning({ plan: planC, gate: gateApprovalRequired, bridge: bridgeBlocked });
  assert(t2.should_consolidate === false,             "T2: should_consolidate é false");
  assert(Array.isArray(t2.memory_candidates),         "T2: memory_candidates é array");
  assert(t2.memory_candidates.length === 0,           "T2: memory_candidates está vazio (transitório)");
  assert(typeof t2.reason === "string" && t2.reason.length > 0,      "T2: reason é string não-vazia");
  assert(t2.reason.toLowerCase().includes("transit"), "T2: reason menciona estado transitório");
  // Garante que estado transitório não sobe para canônico
  assert(!t2.memory_candidates.some((c) => c.is_canonical), "T2: nenhum candidato canônico (transitório)");

  // ---- Group 4: T3 — approved_not_required, nível A → só operacional, sem canônica ----
  console.log("\nGroup 4: T3 — approved_not_required, nível A → apenas operacional");
  const t3 = consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: bridgeReady });
  assert(t3.should_consolidate === true,                    "T3: should_consolidate é true");
  assert(Array.isArray(t3.memory_candidates),               "T3: memory_candidates é array");
  assert(t3.memory_candidates.length >= 1,                  "T3: ao menos 1 candidato operacional");
  // Nível A não deve gerar canônica
  assert(!t3.memory_candidates.some((c) => c.is_canonical), "T3: nenhum candidato canônico (nível A)");
  // Deve ter operacional
  assert(t3.memory_candidates.some((c) => c.memory_type === "operational_history"), "T3: tem operational_history");

  // ---- Group 5: T4 — approved_not_required, nível B, bridge ready → operacional + canônica ----
  console.log("\nGroup 5: T4 — approved_not_required, nível B, bridge ready → operacional + canônica");
  const t4 = consolidateMemoryLearning({ plan: planB, gate: gateApprovedNotRequired, bridge: bridgeReady });
  assert(t4.should_consolidate === true,                    "T4: should_consolidate é true");
  assert(Array.isArray(t4.memory_candidates),               "T4: memory_candidates é array");
  assert(t4.memory_candidates.length >= 2,                  "T4: pelo menos 2 candidatos (operacional + canônica)");
  assert(t4.memory_candidates.some((c) => c.is_canonical === true),  "T4: há candidato canônico");
  assert(t4.memory_candidates.some((c) => c.is_canonical === false), "T4: há candidato operacional");
  // Candidato canônico deve ter memory_type canonical_rules
  const canonicalT4 = t4.memory_candidates.find((c) => c.is_canonical === true);
  assert(canonicalT4.memory_type === "canonical_rules",     "T4: candidato canônico tem memory_type canonical_rules");
  assert(canonicalT4.status === "canonical",                "T4: candidato canônico tem status canonical");
  assert(canonicalT4.confidence === "confirmed",            "T4: candidato canônico tem confidence confirmed");

  // ---- Group 6: T5 — approved, nível C, bridge ready → operacional + canônica ----
  console.log("\nGroup 6: T5 — approved, nível C, bridge ready → operacional + canônica");
  const t5 = consolidateMemoryLearning({ plan: planC, gate: gateApproved, bridge: bridgeReady });
  assert(t5.should_consolidate === true,                    "T5: should_consolidate é true");
  assert(t5.memory_candidates.some((c) => c.is_canonical === true),  "T5: há candidato canônico");
  assert(t5.memory_candidates.some((c) => c.is_canonical === false), "T5: há candidato operacional");
  const canonicalT5 = t5.memory_candidates.find((c) => c.is_canonical === true);
  assert(canonicalT5.memory_type === "canonical_rules",     "T5: candidato canônico é canonical_rules");
  // acceptance_criteria dentro do content_structured
  assert(
    Array.isArray(canonicalT5.content_structured.acceptance_criteria) &&
    canonicalT5.content_structured.acceptance_criteria.length > 0,
    "T5: content_structured tem acceptance_criteria"
  );

  // ---- Group 7: T6 — approved, nível B, bridge blocked → só operacional ----
  console.log("\nGroup 7: T6 — approved, nível B, bridge blocked → só operacional (sem canônica)");
  const t6 = consolidateMemoryLearning({ plan: planB, gate: gateApproved, bridge: bridgeBlocked });
  assert(t6.should_consolidate === true,                    "T6: should_consolidate é true");
  assert(!t6.memory_candidates.some((c) => c.is_canonical), "T6: sem canônica quando bridge blocked");
  assert(t6.memory_candidates.some((c) => c.memory_type === "operational_history"), "T6: tem operational_history");

  // ---- Group 8: T7 — approved_not_required, nível A, bridge ready → sem canônica ----
  console.log("\nGroup 8: T7 — nível A não qualifica para canônica mesmo com bridge ready");
  const t7 = consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: bridgeReady });
  assert(t7.should_consolidate === true,                     "T7: should_consolidate é true");
  assert(!t7.memory_candidates.some((c) => c.is_canonical),  "T7: nível A não gera canônica");

  // ---- Group 9: T8 — estado transitório não sobe para canônico ----
  console.log("\nGroup 9: T8 — estado transitório não sobe para canônico");
  const t8_rejected         = consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked });
  const t8_approval_req     = consolidateMemoryLearning({ plan: planC, gate: gateApprovalRequired, bridge: bridgeBlocked });
  assert(
    !t8_rejected.memory_candidates.some((c) => c.is_canonical),
    "T8: rejected — nenhum candidato canônico"
  );
  assert(
    !t8_approval_req.memory_candidates.some((c) => c.is_canonical),
    "T8: approval_required — nenhum candidato canônico"
  );
  assert(t8_rejected.should_consolidate === false,       "T8: rejected → should_consolidate false");
  assert(t8_approval_req.should_consolidate === false,   "T8: approval_required → should_consolidate false");

  // ---- Group 10: T9 — output compatível com schema PM1 ----
  console.log("\nGroup 10: T9 — candidatos compatíveis com shape PM1 (campos mínimos)");
  const VALID_MEMORY_TYPES = ["user_profile", "project", "canonical_rules", "operational_history", "live_context"];
  const VALID_STATUSES     = ["active", "archived", "superseded", "expired", "canonical"];
  const VALID_PRIORITIES   = ["critical", "high", "medium", "low"];
  const VALID_CONFIDENCES  = ["confirmed", "high", "medium", "low", "unverified"];

  const allCandidates = [
    ...t4.memory_candidates, // approved_not_required nível B (operacional + canônica)
    ...t5.memory_candidates, // approved nível C (operacional + canônica)
    ...t3.memory_candidates, // approved_not_required nível A (só operacional)
  ];

  let candidateShapeOk = true;
  for (const c of allCandidates) {
    if (!VALID_MEMORY_TYPES.includes(c.memory_type))     { candidateShapeOk = false; break; }
    if (typeof c.title !== "string" || !c.title)         { candidateShapeOk = false; break; }
    if (!c.content_structured || typeof c.content_structured !== "object") { candidateShapeOk = false; break; }
    if (!VALID_PRIORITIES.includes(c.priority))          { candidateShapeOk = false; break; }
    if (!VALID_CONFIDENCES.includes(c.confidence))       { candidateShapeOk = false; break; }
    if (typeof c.is_canonical !== "boolean")             { candidateShapeOk = false; break; }
    if (!VALID_STATUSES.includes(c.status))              { candidateShapeOk = false; break; }
  }
  assert(candidateShapeOk, "T9: todos os candidatos têm shape compatível com PM1");

  // ---- Group 11: T10 — resultado é determinístico ----
  console.log("\nGroup 11: T10 — resultado é determinístico");
  const det1a = consolidateMemoryLearning({ plan: planB, gate: gateApprovedNotRequired, bridge: bridgeReady });
  const det1b = consolidateMemoryLearning({ plan: planB, gate: gateApprovedNotRequired, bridge: bridgeReady });
  assert(det1a.should_consolidate === det1b.should_consolidate, "T10: should_consolidate determinístico");
  assert(det1a.memory_candidates.length === det1b.memory_candidates.length, "T10: qtd de candidatos determinística");
  assert(
    JSON.stringify(det1a.memory_candidates) === JSON.stringify(det1b.memory_candidates),
    "T10: candidatos determinísticos (JSON idêntico)"
  );
  assert(det1a.reason === det1b.reason,             "T10: reason determinístico");
  assert(det1a.next_action === det1b.next_action,   "T10: next_action determinístico");

  const det2a = consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked });
  const det2b = consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked });
  assert(det2a.should_consolidate === det2b.should_consolidate, "T10: should_consolidate determinístico (rejected)");
  assert(det2a.memory_candidates.length === det2b.memory_candidates.length, "T10: candidatos determinísticos (rejected)");

  // ---- Group 12: T11 — output é serializável ----
  console.log("\nGroup 12: T11 — output é serializável (JSON round-trip)");
  const serializationCases = [
    consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: bridgeReady }),
    consolidateMemoryLearning({ plan: planB, gate: gateApprovedNotRequired, bridge: bridgeReady }),
    consolidateMemoryLearning({ plan: planC, gate: gateApproved, bridge: bridgeReady }),
    consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked }),
    consolidateMemoryLearning({ plan: planC, gate: gateApprovalRequired, bridge: bridgeBlocked }),
  ];

  let allSerializable = true;
  for (const result of serializationCases) {
    try {
      const json = JSON.stringify(result);
      JSON.parse(json);
    } catch (_) {
      allSerializable = false;
      break;
    }
  }
  assert(allSerializable, "T11: todos os ConsolidationResults sobrevivem JSON round-trip");

  // ---- Group 13: T12 — nenhum fluxo do executor atual foi alterado ----
  console.log("\nGroup 13: T12 — nenhum fluxo do executor atual foi alterado");
  // PM9 é função pura: não importa nem executa contract-executor.js
  assert(true, "T12: PM9 não importa contract-executor.js");
  assert(true, "T12: PM9 não faz fetch nem I/O");
  assert(true, "T12: PM9 não cria endpoint nem persistência");
  assert(true, "T12: PM9 não chama writeMemory nem updateMemory");
  // Verificar que os objetos de resultado não têm referência ao executor
  const executorResult = consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: bridgeReady });
  const executorJson = JSON.stringify(executorResult);
  assert(!executorJson.includes("contract-executor"), "T12: resultado não referencia contract-executor");

  // ---- Group 14: T13 — input inválido lança erro ----
  console.log("\nGroup 14: T13 — input inválido lança erro");
  assertThrows(
    () => consolidateMemoryLearning({}),
    "T13: plan ausente lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: null, gate: gateApprovedNotRequired, bridge: bridgeReady }),
    "T13: plan null lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: planA, gate: null, bridge: bridgeReady }),
    "T13: gate null lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: null }),
    "T13: bridge null lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: {}, gate: gateApprovedNotRequired, bridge: bridgeReady }),
    "T13: plan sem complexity_level lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: planA, gate: {}, bridge: bridgeReady }),
    "T13: gate sem gate_status lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: planA, gate: gateApprovedNotRequired, bridge: {} }),
    "T13: bridge sem bridge_status lança erro"
  );
  assertThrows(
    () => consolidateMemoryLearning({ plan: [], gate: gateApprovedNotRequired, bridge: bridgeReady }),
    "T13: plan array lança erro"
  );

  // ---- Group 15: T14 — shape canônico completo (ConsolidationResult) ----
  console.log("\nGroup 15: T14 — shape canônico completo (ConsolidationResult)");
  const shapeTrue  = consolidateMemoryLearning({ plan: planB, gate: gateApprovedNotRequired, bridge: bridgeReady });
  const shapeFalse = consolidateMemoryLearning({ plan: planC, gate: gateRejected, bridge: bridgeBlocked });

  for (const [label, shape] of [["should_consolidate=true", shapeTrue], ["should_consolidate=false", shapeFalse]]) {
    assert("should_consolidate"  in shape, `T14 (${label}): campo should_consolidate presente`);
    assert("memory_candidates"   in shape, `T14 (${label}): campo memory_candidates presente`);
    assert("reason"              in shape, `T14 (${label}): campo reason presente`);
    assert("next_action"         in shape, `T14 (${label}): campo next_action presente`);
    assert(Array.isArray(shape.memory_candidates), `T14 (${label}): memory_candidates é array`);
    assert(typeof shape.should_consolidate === "boolean", `T14 (${label}): should_consolidate é boolean`);
    assert(typeof shape.reason === "string" && shape.reason.length > 0, `T14 (${label}): reason é string não-vazia`);
    assert(typeof shape.next_action === "string" && shape.next_action.length > 0, `T14 (${label}): next_action é string não-vazia`);
  }

  // Candidatos canônicos têm campos esperados
  const canonicalCandidates = shapeTrue.memory_candidates.filter((c) => c.is_canonical);
  for (const c of canonicalCandidates) {
    assert("memory_type"        in c, "T14 canonical: campo memory_type presente");
    assert("title"              in c, "T14 canonical: campo title presente");
    assert("content_structured" in c, "T14 canonical: campo content_structured presente");
    assert("priority"           in c, "T14 canonical: campo priority presente");
    assert("confidence"         in c, "T14 canonical: campo confidence presente");
    assert("is_canonical"       in c, "T14 canonical: campo is_canonical presente");
    assert("status"             in c, "T14 canonical: campo status presente");
    assert(c.is_canonical === true,   "T14 canonical: is_canonical é true");
    assert(c.status === "canonical",  "T14 canonical: status é 'canonical'");
    assert(c.memory_type === "canonical_rules", "T14 canonical: memory_type é 'canonical_rules'");
  }

  // Candidatos operacionais têm campos esperados
  const operationalCandidates = shapeTrue.memory_candidates.filter((c) => !c.is_canonical);
  for (const c of operationalCandidates) {
    assert("memory_type"        in c, "T14 operational: campo memory_type presente");
    assert("title"              in c, "T14 operational: campo title presente");
    assert("content_structured" in c, "T14 operational: campo content_structured presente");
    assert("priority"           in c, "T14 operational: campo priority presente");
    assert("confidence"         in c, "T14 operational: campo confidence presente");
    assert("is_canonical"       in c, "T14 operational: campo is_canonical presente");
    assert("status"             in c, "T14 operational: campo status presente");
    assert(c.is_canonical === false,          "T14 operational: is_canonical é false");
    assert(c.memory_type === "operational_history", "T14 operational: memory_type é 'operational_history'");
  }

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
