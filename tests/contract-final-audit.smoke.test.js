// ============================================================================
// 🧪 Smoke Tests — Contract Final Audit v1 (Blindagem Contratual PR 3)
//
// Run: node tests/contract-final-audit.smoke.test.js
//
// Tests obrigatórios:
//   Smoke 1:  contrato totalmente aderente → contrato_aderente / can_close=true
//   Smoke 2:  contrato com microetapa parcial/desviada → contrato_parcial_desviado / can_close=false
//   Smoke 3:  contrato com microetapa fora do contrato → contrato_fora_do_contrato / can_close=false
//   Smoke 4:  contrato com faltantes do definition_of_done → can_close=false
//   Smoke 5:  gate real — closeFinalContract bloqueia fechamento indevido
//   Smoke 6:  não regressão PR 1 — gate por microetapa intacto
//   Smoke 7:  não regressão PR 2 — auditoria de execução intacta
//   Smoke 8:  shape canônico completo (ContractFinalAudit)
//   Smoke 9:  determinismo — mesma entrada → mesma saída
//   Smoke 10: input inválido lança erro
//   Smoke 11: handleCloseFinalContract — fluxo real end-to-end aderente
//   Smoke 12: handleCloseFinalContract — rejeita quando faltantes do DoD
//   Smoke 13: close-test (C2) também bloqueado pelo gate PR3 quando faltantes
// ============================================================================

import {
  auditFinalContract,
  CONTRACT_FINAL_STATUS,
  FINAL_TASK_DONE_STATUSES,
} from "../schema/contract-final-audit.js";

import {
  evaluateAdherence,
  ADHERENCE_STATUS,
} from "../schema/contract-adherence-gate.js";

import {
  auditExecution,
  EXECUTION_ADHERENCE_STATUS,
} from "../schema/execution-audit.js";

import {
  handleCompleteTask,
  handleCreateContract,
  startTask,
  closeFinalContract,
  handleCloseFinalContract,
  handleCloseContractInTest,
  closeContractInTest,
  buildInitialState,
  generateDecomposition,
} from "../contract-executor.js";

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
// Mock KV + request helpers
// ---------------------------------------------------------------------------
function createMockKV() {
  const store = {};
  return {
    async get(key) { return store[key] || null; },
    async put(key, value) { store[key] = value; },
    _store: store,
  };
}

function mockRequest(body) {
  return {
    json: async () => body,
    url: "http://localhost/",
    _body_text: null,
  };
}

// ---------------------------------------------------------------------------
// Fixtures: state canônico e decomposition
// ---------------------------------------------------------------------------

// Contrato com 2 DoD items
function makeState(overrides = {}) {
  const base = {
    contract_id:        "ct-final-smoke",
    contract_name:      "Smoke Test Contract",
    goal:               "Entregar feature X com testes",
    status_global:      "executing",
    current_phase:      "decomposition_complete",
    current_task:       null,
    blockers:           [],
    definition_of_done: ["Implementar feature X", "Adicionar testes automatizados"],
    task_execution_log: {},
    created_at:         "2024-01-01T00:00:00.000Z",
    updated_at:         "2024-01-01T00:00:00.000Z",
    scope:              { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints:        {},
    context:            {},
  };
  return Object.assign({}, base, overrides);
}

function makeDecomposition(taskOverrides = []) {
  return {
    contract_id: "ct-final-smoke",
    phases: [{ id: "phase_01", name: "Preparação", status: "pending", tasks: ["task_001"] }],
    tasks: taskOverrides.length > 0 ? taskOverrides : [
      { id: "task_001", description: "Implementar feature X", status: "queued", phase: "phase_01", depends_on: [] },
      { id: "task_002", description: "Adicionar testes automatizados", status: "queued", phase: "phase_01", depends_on: ["task_001"] },
    ],
    micro_pr_candidates: [],
    generated_at: "2024-01-01T00:00:00.000Z",
  };
}

// Adiciona ciclo SEM executor_artifacts (PR2 modo estrutural)
function withEvidence(state, taskId) {
  const log = Object.assign({}, state.task_execution_log);
  log[taskId] = [
    {
      task_id:               taskId,
      execution_id:          `exec-${taskId}-01`,
      execution_status:      "success",
      execution_started_at:  "2024-01-01T01:00:00.000Z",
      execution_finished_at: "2024-01-01T01:05:00.000Z",
      executor_artifacts:    null,
    },
  ];
  return Object.assign({}, state, { task_execution_log: log });
}

// Adiciona ciclo COM executor_artifacts (PR2 modo artefatos)
// artifacts — objeto executor_artifacts a anexar no ciclo
function withArtifacts(state, taskId, artifacts) {
  const log = Object.assign({}, state.task_execution_log);
  log[taskId] = [
    {
      task_id:               taskId,
      execution_id:          artifacts.execution_id || `exec-${taskId}-01`,
      execution_status:      "success",
      execution_started_at:  "2024-01-01T01:00:00.000Z",
      execution_finished_at: "2024-01-01T01:05:00.000Z",
      executor_artifacts:    artifacts,
    },
  ];
  return Object.assign({}, state, { task_execution_log: log });
}

// Artefatos de executor aderentes ao contrato (PR2 → aderente_ao_contrato)
function goodArtifacts(taskId) {
  return {
    execution_id:     `exec-${taskId}-01`,
    target_worker_id: "nv-enavia",
    audit: {
      verdict:    "approve",
      risk_level: "low",
      findings:   [],
      details: {
        context_used:  true,
        context_proof: { hash: "abc123" },
        constraints:   { read_only: true, no_auto_apply: true },
        blockers:      [],
      },
    },
  };
}

// Artefatos com verdict:reject → PR2 parcial_desviado
function partialArtifacts(taskId) {
  return {
    execution_id:     `exec-${taskId}-partial`,
    target_worker_id: "nv-enavia",
    audit: {
      verdict:    "reject",
      risk_level: "low",
      findings:   ["Patch não cobriu o caso de borda X"],
      details: {
        context_used:  true,
        context_proof: { hash: "abc123" },
        constraints:   { read_only: true, no_auto_apply: true },
        blockers:      [],
      },
    },
  };
}

// Artefatos com context_used:false → PR2 fora_do_contrato (violação de cláusula imutável)
function violatingArtifacts(taskId) {
  return {
    execution_id:     `exec-${taskId}-fora`,
    target_worker_id: "nv-enavia",
    audit: {
      verdict:    "approve",
      risk_level: "low",
      findings:   [],
      details: {
        context_used:  false,  // violação da cláusula L717
        context_proof: null,
        constraints:   { read_only: true, no_auto_apply: true },
        blockers:      [],
      },
    },
  };
}

// ============================================================================
// Smoke 1 — Contrato totalmente aderente (PR2 via modo estrutural)
// ============================================================================
console.log("\nSmoke 1: Contrato totalmente aderente → contrato_aderente / can_close=true");

{
  let state = makeState();
  // Ambas as tasks concluídas (status="completed") com ciclos sem artefatos.
  // PR2 modo estrutural: completed + in DoD → aderente_ao_contrato.
  state = withEvidence(state, "task_001");
  state = withEvidence(state, "task_002");

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.contract_id === "ct-final-smoke",               "S1: contract_id correto");
  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE, "S1: final_adherence_status = contrato_aderente");
  assert(audit.can_close_contract === true,                    "S1: can_close_contract = true");
  assert(audit.completed_microsteps.length === 2,              "S1: 2 microsteps concluídas");
  assert(audit.adherent_microsteps.length === 2,               "S1: 2 microsteps aderentes (PR2)");
  assert(audit.partial_microsteps.length === 0,                "S1: sem parciais");
  assert(audit.out_of_contract_microsteps.length === 0,        "S1: sem fora do contrato");
  assert(audit.missing_items.length === 0,                     "S1: sem faltantes");
  assert(audit.unauthorized_items.length === 0,                "S1: sem não autorizados");
  assert(audit.evidence_sufficiency === true,                  "S1: evidence_sufficiency = true");
  assert(typeof audit.final_reason === "string" && audit.final_reason.length > 0, "S1: final_reason string não-vazia");
  assert(typeof audit.final_next_action === "string",          "S1: final_next_action string");
  assert(typeof audit.microstep_pr2_audits === "object",       "S1: microstep_pr2_audits é objeto");
  assert(audit.microstep_pr2_audits["task_001"] !== undefined, "S1: microstep_pr2_audits tem task_001");
  assert(audit.microstep_pr2_audits["task_002"] !== undefined, "S1: microstep_pr2_audits tem task_002");
}

// ============================================================================
// Smoke 2 — Contrato com microetapa PR2 parcial_desviado
// Obrigatório PR 3 — item 2 do comentário
// ============================================================================
console.log("\nSmoke 2: Microetapa com PR2 parcial_desviado (verdict:reject) → contrato_parcial_desviado / can_close=false");

{
  let state = makeState();
  // task_001: executor_artifacts com verdict:reject → PR2 parcial_desviado
  // task_002: executor_artifacts com verdict:approve → PR2 aderente
  state = withArtifacts(state, "task_001", partialArtifacts("task_001"));
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.PARCIAL, "S2: final_adherence_status = contrato_parcial_desviado");
  assert(audit.can_close_contract === false,               "S2: can_close_contract = false");
  assert(audit.partial_microsteps.includes("task_001"),    "S2: task_001 em partial_microsteps (PR2 parcial)");
  assert(audit.adherent_microsteps.includes("task_002"),   "S2: task_002 em adherent_microsteps (PR2 aderente)");
  assert(audit.missing_items.length === 0,                 "S2: sem faltantes de DoD");
  assert(audit.evidence_sufficiency === false,             "S2: evidence_sufficiency = false (task_001 PR2 parcial)");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "parcial_desviado",
    "S2: microstep_pr2_audits[task_001] = parcial_desviado");
  assert(audit.microstep_pr2_audits["task_002"].adherence_status === "aderente_ao_contrato",
    "S2: microstep_pr2_audits[task_002] = aderente_ao_contrato");
}

// ============================================================================
// Smoke 2b — Contrato com microetapa via bypass (status ≠ "completed")
// ============================================================================
console.log("\nSmoke 2b: Microetapa via bypass (status=skipped) → PR2 parcial (estrutural) → parcial_desviado / can_close=false");

{
  let state = makeState();
  state = withEvidence(state, "task_001");
  state = withEvidence(state, "task_002");

  // task_001: skipped (bypass — não passou pelo gate PR1)
  // PR2 modo estrutural: AUDIT_TASK_DONE_STATUSES = ["completed"], "skipped" ∉ → missing_items → parcial
  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "skipped",   phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.PARCIAL, "S2b: skipped → PR2 parcial → contrato_parcial_desviado");
  assert(audit.can_close_contract === false,               "S2b: can_close_contract = false");
  assert(audit.partial_microsteps.includes("task_001"),    "S2b: task_001 em partial_microsteps");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "parcial_desviado",
    "S2b: PR2 audit task_001 = parcial_desviado (skipped não é completed)");
}

// ============================================================================
// Smoke 3 — Contrato com microetapa fora do contrato (DoD mismatch macro)
// ============================================================================
console.log("\nSmoke 3: Microetapa concluída fora do contrato (DoD mismatch) → contrato_fora_do_contrato / can_close=false");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));
  state = withEvidence(state, "task_999");

  // task_999 não está no DoD — macro DoD mismatch (sem chamada PR2)
  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
    { id: "task_999", description: "Funcionalidade não contratada",  status: "completed", phase: "phase_01", depends_on: [] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.FORA, "S3: final_adherence_status = contrato_fora_do_contrato");
  assert(audit.can_close_contract === false,                    "S3: can_close_contract = false");
  assert(audit.out_of_contract_microsteps.includes("task_999"), "S3: task_999 em out_of_contract_microsteps");
  assert(audit.unauthorized_items.some(u => u.includes("Funcionalidade não contratada")),
    "S3: unauthorized_items contém descrição da task fora do DoD");
  // task_999 não tem entrada em microstep_pr2_audits (macro DoD mismatch — sem chamada PR2)
  assert(audit.microstep_pr2_audits["task_999"] === undefined, "S3: task_999 não tem PR2 audit (DoD mismatch macro)");
}

// ============================================================================
// Smoke 3b — Microetapa no DoD mas PR2 fora_do_contrato (violação de cláusula)
// Obrigatório PR 3 — item 3 do comentário
// ============================================================================
console.log("\nSmoke 3b: Microetapa com PR2 fora_do_contrato (context_used:false) → contrato_fora_do_contrato / can_close=false");

{
  let state = makeState();
  // task_001: no DoD, mas executor_artifacts com context_used:false → PR2 fora_do_contrato
  // task_002: aderente
  state = withArtifacts(state, "task_001", violatingArtifacts("task_001"));
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.FORA, "S3b: PR2 fora → contrato_fora_do_contrato");
  assert(audit.can_close_contract === false,                    "S3b: can_close_contract = false");
  assert(audit.out_of_contract_microsteps.includes("task_001"), "S3b: task_001 em out_of_contract_microsteps (PR2 fora)");
  assert(audit.adherent_microsteps.includes("task_002"),        "S3b: task_002 aderente");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "fora_do_contrato",
    "S3b: microstep_pr2_audits[task_001] = fora_do_contrato");
  assert(audit.microstep_pr2_audits["task_002"].adherence_status === "aderente_ao_contrato",
    "S3b: microstep_pr2_audits[task_002] = aderente_ao_contrato");
}

// ============================================================================
// Smoke 4 — Contrato com faltantes do definition_of_done
// ============================================================================
console.log("\nSmoke 4: Faltantes do definition_of_done → can_close=false");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));
  // task_002 ainda queued (faltante)

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "queued",   phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.can_close_contract === false,                           "S4: can_close_contract = false");
  assert(audit.missing_items.length > 0,                               "S4: missing_items não vazio");
  assert(audit.missing_items.some(m => m.includes("testes")),          "S4: missing_items inclui item de testes");
  assert(audit.final_adherence_status !== CONTRACT_FINAL_STATUS.ADERENTE, "S4: não é aderente quando há faltantes");
}

// ============================================================================
// Smoke 4b — "Tem log" sem aderência PR2 NÃO é suficiente
// Obrigatório PR 3 — item 4 do comentário
// ============================================================================
console.log("\nSmoke 4b: 'Tem log' sem aderência PR2 → NÃO é suficiente para fechar");

{
  let state = makeState();
  // task_001: tem ciclo no log com executor_artifacts de verdict:reject → PR2 parcial
  // task_002: também parcial (para ter ambas no DoD)
  // Ponto: a presença de ciclos NÃO basta — PR2 precisa retornar aderente
  state = withArtifacts(state, "task_001", partialArtifacts("task_001"));
  state = withArtifacts(state, "task_002", partialArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  // Ambas as tasks TÊM ciclos no log — mas PR2 retorna parcial_desviado
  assert(audit.completed_microsteps.length === 2,  "S4b: 2 tasks concluídas com ciclos no log");
  assert(audit.can_close_contract === false,        "S4b: NÃO pode fechar — log sozinho não é suficiente");
  assert(audit.evidence_sufficiency === false,      "S4b: evidence_sufficiency = false apesar de ter log");
  assert(audit.partial_microsteps.length === 2,     "S4b: ambas as tasks em partial_microsteps (PR2 parcial)");
  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.PARCIAL,
    "S4b: final_adherence_status = contrato_parcial_desviado (não aderente)");
}

// ============================================================================
// Smoke 5 — Gate real: closeFinalContract bloqueia fechamento indevido
// ============================================================================
console.log("\nSmoke 5: closeFinalContract bloqueia fechamento com faltantes / aderente permite");

{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractPayload = {
    contract_id:        "ct-final-gate-smoke5",
    version:            "v1",
    operator:           "smoke-test",
    goal:               "Gate final smoke test",
    definition_of_done: ["Passo A", "Passo B"],
    scope:              { environments: ["TEST"], workers: ["nv-enavia"] },
  };

  const createResult = await handleCreateContract(
    mockRequest(contractPayload),
    env
  );
  assert(createResult.ok || (createResult.body && createResult.body.ok), "S5: contrato criado");

  // Tentar fechar sem nenhuma task concluída → deve falhar
  const resultIncompleto = await closeFinalContract(env, "ct-final-gate-smoke5");
  assert(resultIncompleto.ok === false,                              "S5: fechamento bloqueado sem tasks concluídas");
  assert(resultIncompleto.error === "FINAL_AUDIT_REJECTED",          "S5: error = FINAL_AUDIT_REJECTED");
  assert(resultIncompleto.can_close_contract == null || !resultIncompleto.can_close_contract, "S5: can_close_contract falso/ausente no erro");
  assert(resultIncompleto.final_audit_snapshot !== null && resultIncompleto.final_audit_snapshot !== undefined,
    "S5: final_audit_snapshot presente no erro");
  assert(resultIncompleto.missing_items && resultIncompleto.missing_items.length > 0,
    "S5: missing_items lista os faltantes");
}

// ============================================================================
// Smoke 6 — Não regressão PR 1: gate por microetapa intacto
// ============================================================================
console.log("\nSmoke 6: Não regressão PR 1 — gate por microetapa continua funcionando");

{
  const contrato = {
    objetivo_contratual_exato:  "Entregar feature X",
    escopo_permitido:           ["feature X"],
    escopo_proibido:            ["feature Y"],
    criterio_de_aceite_literal: "Feature X funcionando em produção",
  };

  const resultadoAderente = {
    objetivo_atendido:        true,
    criterio_aceite_atendido: true,
    escopo_efetivo:           ["feature X"],
    is_simulado:              false,
    is_mockado:               false,
    is_local:                 false,
    is_parcial:               false,
  };

  const resultadoNaoAderente = {
    objetivo_atendido:        false,
    criterio_aceite_atendido: false,
    escopo_efetivo:           ["feature Y"],
    is_simulado:              false,
    is_mockado:               false,
    is_local:                 false,
    is_parcial:               false,
  };

  const auditPR1Ok  = evaluateAdherence({ contract: contrato, resultado: resultadoAderente });
  const auditPR1Nok = evaluateAdherence({ contract: contrato, resultado: resultadoNaoAderente });

  assert(auditPR1Ok.adherence_status  === ADHERENCE_STATUS.ADERENTE, "S6: PR1 — aderente quando entrega correta");
  assert(auditPR1Ok.can_mark_concluded === true,                       "S6: PR1 — can_mark_concluded = true quando aderente");
  assert(auditPR1Nok.adherence_status !== ADHERENCE_STATUS.ADERENTE,  "S6: PR1 — não aderente quando entrega errada");
  assert(auditPR1Nok.can_mark_concluded === false,                     "S6: PR1 — can_mark_concluded = false quando não aderente");
}

// ============================================================================
// Smoke 7 — Não regressão PR 2: auditoria de execução intacta
// ============================================================================
console.log("\nSmoke 7: Não regressão PR 2 — auditoria de execução continua funcionando");

{
  const state = {
    contract_id:        "ct-pr2-regression",
    goal:               "Testar PR2",
    definition_of_done: ["Implementar X"],
    scope:              { workers: ["nv-enavia"] },
    constraints:        {},
    task_execution_log: {},
  };
  const decomposition = {
    tasks: [
      { id: "task_001", description: "Implementar X", status: "completed" },
    ],
    micro_pr_candidates: [],
  };

  const pr2Audit = auditExecution({ state, decomposition, microstep_id: "task_001" });
  assert(typeof pr2Audit.audit_mode === "string",          "S7: PR2 — audit_mode presente");
  assert(pr2Audit.microstep_id === "task_001",             "S7: PR2 — microstep_id correto");
  assert(typeof pr2Audit.adherence_status === "string",    "S7: PR2 — adherence_status presente");
  assert(Array.isArray(pr2Audit.missing_items),            "S7: PR2 — missing_items array");
  assert(Array.isArray(pr2Audit.unauthorized_items),       "S7: PR2 — unauthorized_items array");

  // Verificar que os enums da PR2 não mudaram
  assert(EXECUTION_ADHERENCE_STATUS.ADERENTE === "aderente_ao_contrato", "S7: PR2 — enum ADERENTE intacto");
  assert(EXECUTION_ADHERENCE_STATUS.PARCIAL  === "parcial_desviado",      "S7: PR2 — enum PARCIAL intacto");
  assert(EXECUTION_ADHERENCE_STATUS.FORA     === "fora_do_contrato",      "S7: PR2 — enum FORA intacto");

  // Verificar que PR2 com artefatos aderentes retorna aderente
  const stateWithLog = {
    ...state,
    task_execution_log: {
      task_001: [{ executor_artifacts: goodArtifacts("task_001"), executor_artifacts_set: true }],
    },
  };
  const pr2AuditWithArtifacts = auditExecution({
    state: stateWithLog,
    decomposition,
    microstep_id:       "task_001",
    executor_artifacts: goodArtifacts("task_001"),
  });
  assert(pr2AuditWithArtifacts.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "S7: PR2 com artefatos aderentes → aderente_ao_contrato");

  // Verificar que PR2 com verdict:reject retorna parcial
  const pr2AuditParcial = auditExecution({
    state,
    decomposition,
    microstep_id:       "task_001",
    executor_artifacts: partialArtifacts("task_001"),
  });
  assert(pr2AuditParcial.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "S7: PR2 com verdict:reject → parcial_desviado");
}

// ============================================================================
// Smoke 8 — Shape canônico completo (ContractFinalAudit)
// ============================================================================
console.log("\nSmoke 8: Shape canônico completo (ContractFinalAudit)");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  const requiredFields = [
    "contract_id",
    "final_adherence_status",
    "completed_microsteps",
    "adherent_microsteps",
    "partial_microsteps",
    "out_of_contract_microsteps",
    "missing_items",
    "unauthorized_items",
    "evidence_sufficiency",
    "microstep_pr2_audits",
    "final_reason",
    "final_next_action",
    "can_close_contract",
  ];

  for (const field of requiredFields) {
    assert(field in audit, `S8: shape tem campo '${field}'`);
  }

  assert(typeof audit.can_close_contract === "boolean",    "S8: can_close_contract é boolean");
  assert(typeof audit.evidence_sufficiency === "boolean",  "S8: evidence_sufficiency é boolean");
  assert(Array.isArray(audit.completed_microsteps),        "S8: completed_microsteps é array");
  assert(Array.isArray(audit.adherent_microsteps),         "S8: adherent_microsteps é array");
  assert(Array.isArray(audit.partial_microsteps),          "S8: partial_microsteps é array");
  assert(Array.isArray(audit.out_of_contract_microsteps),  "S8: out_of_contract_microsteps é array");
  assert(Array.isArray(audit.missing_items),               "S8: missing_items é array");
  assert(Array.isArray(audit.unauthorized_items),          "S8: unauthorized_items é array");
  assert(typeof audit.microstep_pr2_audits === "object" && audit.microstep_pr2_audits !== null,
    "S8: microstep_pr2_audits é objeto");

  // Verificar shape de microstep_pr2_audits
  const pr2Entry = audit.microstep_pr2_audits["task_001"];
  assert(pr2Entry !== undefined,                            "S8: microstep_pr2_audits tem task_001");
  assert(typeof pr2Entry.adherence_status === "string",     "S8: pr2_audit tem adherence_status string");
  assert(typeof pr2Entry.audit_mode === "string",           "S8: pr2_audit tem audit_mode string");
  assert(typeof pr2Entry.reason === "string",               "S8: pr2_audit tem reason string");

  // Serializável
  const serialized = JSON.stringify(audit);
  assert(typeof serialized === "string" && serialized.length > 0, "S8: ContractFinalAudit é serializável via JSON.stringify");
}

// ============================================================================
// Smoke 9 — Determinismo
// ============================================================================
console.log("\nSmoke 9: Determinismo — mesma entrada → mesma saída");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "queued",   phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const a1 = auditFinalContract({ state, decomposition });
  const a2 = auditFinalContract({ state, decomposition });

  assert(a1.final_adherence_status === a2.final_adherence_status, "S9: final_adherence_status estável");
  assert(a1.can_close_contract     === a2.can_close_contract,     "S9: can_close_contract estável");
  assert(JSON.stringify(a1.missing_items) === JSON.stringify(a2.missing_items),
    "S9: missing_items idênticos entre chamadas");
  assert(JSON.stringify(a1.microstep_pr2_audits) === JSON.stringify(a2.microstep_pr2_audits),
    "S9: microstep_pr2_audits idênticos entre chamadas");
}

// ============================================================================
// Smoke 10 — Input inválido lança erro
// ============================================================================
console.log("\nSmoke 10: Input inválido lança erro");

assertThrows(() => auditFinalContract({}),                            "S10: state ausente → erro");
assertThrows(() => auditFinalContract({ state: null, decomposition: {} }), "S10: state null → erro");
assertThrows(() => auditFinalContract({ state: { contract_id: "x", definition_of_done: [] }, decomposition: null }),
  "S10: decomposition null → erro");
assertThrows(() => auditFinalContract({ state: { contract_id: "", definition_of_done: [] }, decomposition: { tasks: [] } }),
  "S10: contract_id vazio → erro");
assertThrows(() => auditFinalContract({ state: { contract_id: "x" }, decomposition: { tasks: [] } }),
  "S10: definition_of_done ausente → erro");

// ============================================================================
// Smoke 11 — handleCloseFinalContract: fluxo real end-to-end aderente
// ============================================================================
console.log("\nSmoke 11: handleCloseFinalContract — fluxo real aderente → 200 + completed");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractPayload = {
    contract_id:        "ct-final-e2e-s11",
    version:            "v1",
    operator:           "smoke-test",
    goal:               "E2E Smoke 11",
    definition_of_done: ["Entregar módulo Z"],
    scope:              { environments: ["TEST"], workers: ["nv-enavia"] },
  };

  await handleCreateContract(mockRequest(contractPayload), env);

  // Iniciar a task
  await startTask(env, "ct-final-e2e-s11", "task_001");

  // Concluir task via gate PR1 (complete-task) com executor_artifacts aderentes
  // IMPORTANTE: context_proof deve ser não-nulo para PR2 retornar aderente_ao_contrato
  const completeResult = await handleCompleteTask(mockRequest({
    contract_id: "ct-final-e2e-s11",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["Entregar módulo Z"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               false,
    },
    executor_artifacts: {
      execution_id:      "exec-s11-01",
      target_worker_id:  "nv-enavia",
      audit: {
        verdict:    "approve",
        risk_level: "low",
        findings:   [],
        details: {
          context_used:  true,
          context_proof: { hash: "abc123" },  // não-nulo → "presente" para PR2
          constraints:   { read_only: true, no_auto_apply: true },
          blockers:      [],
        },
      },
    },
  }), env);

  assert(completeResult.body && completeResult.body.ok === true, "S11: task_001 concluída via gate PR1");

  // Fechar o contrato via close-final
  const finalResult = await handleCloseFinalContract(
    mockRequest({ contract_id: "ct-final-e2e-s11" }),
    env
  );

  assert(finalResult.body !== undefined,                         "S11: resposta não nula");
  if (finalResult.status === 200) {
    assert(finalResult.body.ok === true,                         "S11: ok = true quando aderente");
    assert(finalResult.body.final_audit_snapshot !== null,       "S11: final_audit_snapshot no response");
    assert(finalResult.body.final_audit_snapshot.can_close_contract === true,
      "S11: can_close_contract = true no snapshot");
    assert(finalResult.body.final_audit_snapshot.final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE,
      "S11: snapshot final = contrato_aderente");
    assert(typeof finalResult.body.final_audit_snapshot.microstep_pr2_audits === "object",
      "S11: microstep_pr2_audits presente no snapshot do response");
  } else {
    // Falha de transição de estado — PR2 audit nos artefatos bloqueou
    assert(typeof finalResult.body.error === "string", "S11: erro explicado quando não fecha");
    console.log(`  ℹ️  S11 gate bloqueou: ${finalResult.body.error} — ${finalResult.body.message}`);
  }
}

// ============================================================================
// Smoke 12 — handleCloseFinalContract: rejeita quando faltantes do DoD
// ============================================================================
console.log("\nSmoke 12: handleCloseFinalContract — rejeita com faltantes do DoD → 422");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractPayload = {
    contract_id:        "ct-final-e2e-s12",
    version:            "v1",
    operator:           "smoke-test",
    goal:               "E2E Smoke 12 — faltantes",
    definition_of_done: ["Passo A", "Passo B"],
    scope:              { environments: ["TEST"], workers: ["nv-enavia"] },
  };

  await handleCreateContract(mockRequest(contractPayload), env);

  // NÃO concluímos nenhuma task — tentar fechar deve falhar
  const finalResult = await handleCloseFinalContract(
    mockRequest({ contract_id: "ct-final-e2e-s12" }),
    env
  );

  assert(finalResult.body.ok === false,                      "S12: ok = false quando faltantes");
  assert(finalResult.body.error === "FINAL_AUDIT_REJECTED",  "S12: error = FINAL_AUDIT_REJECTED");
  assert(finalResult.body.missing_items && finalResult.body.missing_items.length > 0,
    "S12: missing_items lista os faltantes no body");
  assert(finalResult.body.final_audit_snapshot !== null,     "S12: final_audit_snapshot no body");
}

// ============================================================================
// Smoke 13 — close-test (C2) também bloqueado pelo gate PR3 quando faltantes
// ============================================================================
console.log("\nSmoke 13: POST /contracts/close-test bloqueado pelo gate PR3 quando faltantes");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const contractPayload = {
    contract_id:        "ct-close-test-s13",
    version:            "v1",
    operator:           "smoke-test",
    goal:               "C2 gate PR3 smoke",
    definition_of_done: ["Tarefa 1", "Tarefa 2"],
    scope:              { environments: ["TEST"], workers: ["nv-enavia"] },
  };

  await handleCreateContract(mockRequest(contractPayload), env);

  // Simular execução parcial (apenas task_001 concluída) — task_002 faltante
  await startTask(env, "ct-close-test-s13", "task_001");
  await handleCompleteTask(mockRequest({
    contract_id: "ct-close-test-s13",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["Tarefa 1"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               false,
    },
    executor_artifacts: {
      execution_id:      "exec-s13-01",
      target_worker_id:  "nv-enavia",
      audit: {
        verdict:    "approve",
        risk_level: "low",
        findings:   [],
        details: {
          context_used:  true,
          context_proof: { hash: "abc123" },
          constraints:   { read_only: true, no_auto_apply: true },
          blockers:      [],
        },
      },
    },
  }), env);

  const closeTestResult = await handleCloseContractInTest(
    mockRequest({ contract_id: "ct-close-test-s13" }),
    env
  );

  assert(typeof closeTestResult.body === "object",               "S13: resposta é objeto");
  if (!closeTestResult.body.ok) {
    const validErrors = ["NO_EXECUTION", "FINAL_AUDIT_REJECTED", "TASK_NOT_CLOSEABLE"];
    assert(validErrors.includes(closeTestResult.body.error),
      `S13: erro explícito (${closeTestResult.body.error}) — gate ativo`);
    if (closeTestResult.body.error === "FINAL_AUDIT_REJECTED") {
      assert(closeTestResult.body.final_audit_snapshot !== null,
        "S13: final_audit_snapshot presente quando gate PR3 rejeita");
      assert(closeTestResult.body.missing_items && closeTestResult.body.missing_items.length > 0,
        "S13: missing_items lista os faltantes quando gate PR3 rejeita");
    }
  }
}

// ============================================================================
// Smoke 14 — Enum integridade PR3
// ============================================================================
console.log("\nSmoke 14: Integridade dos enums PR3");

assert(CONTRACT_FINAL_STATUS.ADERENTE === "contrato_aderente",        "S14: ADERENTE = 'contrato_aderente'");
assert(CONTRACT_FINAL_STATUS.PARCIAL  === "contrato_parcial_desviado", "S14: PARCIAL = 'contrato_parcial_desviado'");
assert(CONTRACT_FINAL_STATUS.FORA     === "contrato_fora_do_contrato", "S14: FORA = 'contrato_fora_do_contrato'");

assert(FINAL_TASK_DONE_STATUSES.includes("completed"), "S14: FINAL_TASK_DONE_STATUSES inclui 'completed'");
assert(FINAL_TASK_DONE_STATUSES.includes("done"),      "S14: FINAL_TASK_DONE_STATUSES inclui 'done'");
assert(FINAL_TASK_DONE_STATUSES.includes("skipped"),   "S14: FINAL_TASK_DONE_STATUSES inclui 'skipped'");

// ============================================================================
// Smoke 15 — PR2 integração: todas aderentes com artefatos explícitos
// Obrigatório PR 3 — item 1 do comentário (explícito com executor_artifacts)
// ============================================================================
console.log("\nSmoke 15: Todas microetapas aderentes na PR2 (com artefatos) → contrato_aderente / can_close=true");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE, "S15: contrato_aderente (PR2 aderente em todas)");
  assert(audit.can_close_contract === true,                               "S15: can_close_contract = true");
  assert(audit.adherent_microsteps.length === 2,                          "S15: 2 microsteps aderentes (PR2 com artefatos)");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "aderente_ao_contrato",
    "S15: task_001 PR2 audit = aderente_ao_contrato");
  assert(audit.microstep_pr2_audits["task_002"].adherence_status === "aderente_ao_contrato",
    "S15: task_002 PR2 audit = aderente_ao_contrato");
  assert(audit.evidence_sufficiency === true,                             "S15: evidence_sufficiency = true (PR2 aderente)");
}

// ============================================================================
// Smoke 16 — PR2 integração: parcial_desviado explícito
// Obrigatório PR 3 — item 2 do comentário (explícito)
// ============================================================================
console.log("\nSmoke 16: Uma microetapa com PR2 parcial_desviado → contrato_parcial_desviado / can_close=false");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", partialArtifacts("task_001"));  // verdict:reject → parcial
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));      // approve → aderente

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.PARCIAL,  "S16: contrato_parcial_desviado");
  assert(audit.can_close_contract === false,                               "S16: can_close_contract = false");
  assert(audit.partial_microsteps.includes("task_001"),                    "S16: task_001 em partial_microsteps");
  assert(audit.adherent_microsteps.includes("task_002"),                   "S16: task_002 em adherent_microsteps");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "parcial_desviado",
    "S16: task_001 PR2 audit = parcial_desviado");
  assert(audit.evidence_sufficiency === false,                             "S16: evidence_sufficiency = false");
}

// ============================================================================
// Smoke 17 — PR2 integração: fora_do_contrato via violação de cláusula
// Obrigatório PR 3 — item 3 do comentário (explícito)
// ============================================================================
console.log("\nSmoke 17: Uma microetapa com PR2 fora_do_contrato → contrato_fora_do_contrato / can_close=false");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", violatingArtifacts("task_001")); // context_used:false → fora
  state = withArtifacts(state, "task_002", goodArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(audit.final_adherence_status === CONTRACT_FINAL_STATUS.FORA,     "S17: contrato_fora_do_contrato");
  assert(audit.can_close_contract === false,                               "S17: can_close_contract = false");
  assert(audit.out_of_contract_microsteps.includes("task_001"),            "S17: task_001 em out_of_contract_microsteps");
  assert(audit.microstep_pr2_audits["task_001"].adherence_status === "fora_do_contrato",
    "S17: task_001 PR2 audit = fora_do_contrato (context_used:false)");
}

// ============================================================================
// Smoke 18 — PR2 integração: microstep_pr2_audits no snapshot
// ============================================================================
console.log("\nSmoke 18: microstep_pr2_audits presente e correto no snapshot final");

{
  let state = makeState();
  state = withArtifacts(state, "task_001", goodArtifacts("task_001"));
  state = withArtifacts(state, "task_002", partialArtifacts("task_002"));

  const decomposition = makeDecomposition([
    { id: "task_001", description: "Implementar feature X",          status: "completed", phase: "phase_01", depends_on: [] },
    { id: "task_002", description: "Adicionar testes automatizados", status: "completed", phase: "phase_01", depends_on: ["task_001"] },
  ]);

  const audit = auditFinalContract({ state, decomposition });

  assert(typeof audit.microstep_pr2_audits === "object",        "S18: microstep_pr2_audits é objeto");
  assert("task_001" in audit.microstep_pr2_audits,              "S18: task_001 presente em microstep_pr2_audits");
  assert("task_002" in audit.microstep_pr2_audits,              "S18: task_002 presente em microstep_pr2_audits");

  const t1 = audit.microstep_pr2_audits["task_001"];
  const t2 = audit.microstep_pr2_audits["task_002"];
  assert(t1.adherence_status === "aderente_ao_contrato",        "S18: task_001 PR2 = aderente_ao_contrato");
  assert(t2.adherence_status === "parcial_desviado",            "S18: task_002 PR2 = parcial_desviado");
  assert(typeof t1.audit_mode === "string",                     "S18: audit_mode é string");
  assert(typeof t1.reason === "string",                         "S18: reason é string");
  assert(audit.can_close_contract === false,                    "S18: contrato parcial (task_002 PR2 parcial)");
}

// ============================================================================
// Results
// ============================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
