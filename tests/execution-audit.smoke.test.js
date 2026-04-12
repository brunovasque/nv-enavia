// ============================================================================
// 🧪 Smoke Tests — Execution Audit v1 (Blindagem Contratual PR 2)
//
// Run: node tests/execution-audit.smoke.test.js
//
// Testa a auditoria canônica de execução contra contrato.
//
// Smoke tests obrigatórios:
//   Smoke 1: execução aderente — sem faltantes, sem não autorizados
//            → adherence_status = aderente_ao_contrato
//   Smoke 2: execução parcial/desviada — há faltantes, sem não autorizados
//            → adherence_status = parcial_desviado
//   Smoke 3: execução fora do contrato — há item claramente não autorizado
//            → adherence_status = fora_do_contrato
//   Smoke 4: auditoria plugada no fluxo real (handleCompleteTask retorna execution_audit)
//            → execution_audit presente na resposta do fluxo real
//   Smoke 5: não regressão da PR 1 (gate obrigatório por microetapa ainda funciona)
//            → PR1 smoke tests passam sem alteração de comportamento
//
// Cenários adicionais:
//   Smoke 6: shape canônico completo (ExecutionAudit)
//   Smoke 7: determinismo — mesma entrada → mesma saída
//   Smoke 8: input inválido lança erro
//   Smoke 9: handleGetExecutionAudit — endpoint de consulta on-demand
// ============================================================================

import {
  auditExecution,
  EXECUTION_ADHERENCE_STATUS,
  AUDIT_TASK_DONE_STATUSES,
} from "../schema/execution-audit.js";

import {
  handleCompleteTask,
  handleCreateContract,
  startTask,
  rehydrateContract,
  handleGetExecutionAudit,
} from "../contract-executor.js";let passed = 0;
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
// Mock KV store
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
    async json() {
      if (body === null) throw new Error("Invalid JSON");
      return body;
    },
  };
}

function mockGetRequest(contractId) {
  return {
    url: `https://nv-enavia.workers.dev/contracts/execution-audit?contract_id=${contractId}`,
  };
}

// ---------------------------------------------------------------------------
// Fixtures — state e decomposition canônicos
// ---------------------------------------------------------------------------

// Contrato com 3 itens DoD
const STATE_BASE = {
  contract_id:        "ctr_audit_001",
  goal:               "Implementar sistema de auditoria contratual",
  definition_of_done: [
    "Módulo de auditoria implementado",
    "Smoke tests passando",
    "Integração no fluxo real",
  ],
  scope: { environments: ["TEST"] },
  status_global: "executing",
};

// Decomposition com 3 tasks (description = DoD item, 1:1)
const DECOMP_ALL_COMPLETED = {
  contract_id: "ctr_audit_001",
  tasks: [
    { id: "task_001", description: "Módulo de auditoria implementado", status: "completed" },
    { id: "task_002", description: "Smoke tests passando",             status: "completed" },
    { id: "task_003", description: "Integração no fluxo real",         status: "completed" },
  ],
};

// Decomposition com 1 task concluída e 2 pendentes → parcial
const DECOMP_PARCIAL = {
  contract_id: "ctr_audit_001",
  tasks: [
    { id: "task_001", description: "Módulo de auditoria implementado", status: "completed" },
    { id: "task_002", description: "Smoke tests passando",             status: "in_progress" },
    { id: "task_003", description: "Integração no fluxo real",         status: "queued" },
  ],
};

// Decomposition com task concluída fora do DoD → fora_do_contrato
const DECOMP_FORA_CONTRATO = {
  contract_id: "ctr_audit_001",
  tasks: [
    { id: "task_001", description: "Módulo de auditoria implementado",    status: "completed" },
    { id: "task_999", description: "Funcionalidade não contratada: painel extra", status: "completed" },
    { id: "task_003", description: "Integração no fluxo real",            status: "queued" },
  ],
};

// ---------------------------------------------------------------------------
// Smoke 1: execução aderente — todos completos, nenhum não autorizado
// ---------------------------------------------------------------------------
console.log("\nSmoke 1: aderente_ao_contrato — sem faltantes, sem não autorizados");

{
  const audit = auditExecution({ state: STATE_BASE, decomposition: DECOMP_ALL_COMPLETED });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke1: adherence_status = 'aderente_ao_contrato'");
  assert(audit.missing_items.length === 0,
    "Smoke1: missing_items vazio");
  assert(audit.unauthorized_items.length === 0,
    "Smoke1: unauthorized_items vazio");
  assert(audit.implemented_reference.length === 3,
    "Smoke1: implemented_reference tem 3 itens");
  assert(audit.contract_reference.contracted_items.length === 3,
    "Smoke1: contract_reference.contracted_items tem 3 itens");
  assert(typeof audit.reason === "string" && audit.reason.length > 0,
    "Smoke1: reason é string não-vazia");
  assert(typeof audit.next_action === "string" && audit.next_action.length > 0,
    "Smoke1: next_action é string não-vazia");
}

// ---------------------------------------------------------------------------
// Smoke 2: execução parcial/desviada — há faltantes
// ---------------------------------------------------------------------------
console.log("\nSmoke 2: parcial_desviado — há faltantes, sem não autorizados");

{
  const audit = auditExecution({ state: STATE_BASE, decomposition: DECOMP_PARCIAL });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke2: adherence_status = 'parcial_desviado'");
  assert(audit.missing_items.length === 2,
    "Smoke2: missing_items tem 2 itens (tarefas não concluídas)");
  assert(audit.unauthorized_items.length === 0,
    "Smoke2: unauthorized_items vazio");
  assert(audit.implemented_reference.length === 1,
    "Smoke2: implemented_reference tem 1 item (task completada)");
  assert(audit.missing_items.includes("Smoke tests passando"),
    "Smoke2: missing_items registra 'Smoke tests passando'");
  assert(audit.missing_items.includes("Integração no fluxo real"),
    "Smoke2: missing_items registra 'Integração no fluxo real'");
  assert(audit.reason.includes("parcial"),
    "Smoke2: reason menciona 'parcial'");
}

// ---------------------------------------------------------------------------
// Smoke 3: execução fora do contrato — item não autorizado
// ---------------------------------------------------------------------------
console.log("\nSmoke 3: fora_do_contrato — item implementado fora do DoD");

{
  const audit = auditExecution({ state: STATE_BASE, decomposition: DECOMP_FORA_CONTRATO });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke3: adherence_status = 'fora_do_contrato'");
  assert(audit.unauthorized_items.length === 1,
    "Smoke3: unauthorized_items tem 1 item");
  assert(audit.unauthorized_items[0].includes("painel extra") || audit.unauthorized_items[0].includes("não contratada"),
    "Smoke3: unauthorized_items registra o item não contratado");
  assert(audit.missing_items.length > 0,
    "Smoke3: missing_items também registra tasks incompletas");
  assert(audit.reason.includes("não autoriza") || audit.reason.includes("autorização"),
    "Smoke3: reason menciona autorização");
}

// ---------------------------------------------------------------------------
// Smoke 4: auditoria plugada no fluxo real (handleCompleteTask)
// ---------------------------------------------------------------------------
console.log("\nSmoke 4: execution_audit presente na resposta do fluxo real (handleCompleteTask)");

{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const PAYLOAD = {
    contract_id: "ctr_audit_flow_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-audit-operator",
    goal: "Testar auditoria no fluxo real",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 5, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Gate de auditoria implementado", "Smoke tests passando"],
  };

  await handleCreateContract(mockRequest(PAYLOAD), env);
  await startTask(env, "ctr_audit_flow_001", "task_001");

  const result = await handleCompleteTask(mockRequest({
    contract_id: "ctr_audit_flow_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["gate de auditoria implementado"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               false,
    },
  }), env);

  assert(result.status === 200,
    "Smoke4: handleCompleteTask retorna HTTP 200");
  assert(result.body.ok === true,
    "Smoke4: ok = true");
  assert(result.body.execution_audit !== undefined,
    "Smoke4: execution_audit presente na resposta");
  assert(typeof result.body.execution_audit === "object",
    "Smoke4: execution_audit é objeto");
  assert(result.body.execution_audit.contract_id === "ctr_audit_flow_001",
    "Smoke4: execution_audit.contract_id correto");
  assert(Array.isArray(result.body.execution_audit.implemented_reference),
    "Smoke4: execution_audit.implemented_reference é array");
  assert(Array.isArray(result.body.execution_audit.missing_items),
    "Smoke4: execution_audit.missing_items é array");
  assert(Array.isArray(result.body.execution_audit.unauthorized_items),
    "Smoke4: execution_audit.unauthorized_items é array");
  assert(
    result.body.execution_audit.adherence_status === "aderente_ao_contrato" ||
    result.body.execution_audit.adherence_status === "parcial_desviado",
    "Smoke4: adherence_status é 'aderente_ao_contrato' ou 'parcial_desviado' (1 de 2 tasks concluída)"
  );
  // Com 1 task completada e 1 pendente → parcial_desviado (auditoria do contrato inteiro)
  assert(result.body.execution_audit.adherence_status === "parcial_desviado",
    "Smoke4: adherence_status = 'parcial_desviado' (1 task completa, 1 pendente)");
}

// ---------------------------------------------------------------------------
// Smoke 5: não regressão da PR 1 (gate por microetapa ainda funciona)
// ---------------------------------------------------------------------------
console.log("\nSmoke 5: não regressão PR1 — gate obrigatório por microetapa intacto");

{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const PAYLOAD_R = {
    contract_id: "ctr_regression_pr1_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-regression",
    goal: "Teste de regressão PR1",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Regressão verificada"],
  };

  await handleCreateContract(mockRequest(PAYLOAD_R), env);
  await startTask(env, "ctr_regression_pr1_001", "task_001");

  // Tentativa de bypass: resultado ausente deve ser rejeitado (PR1 gate)
  const resultSemResultado = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_pr1_001",
    task_id:     "task_001",
  }), env);
  assert(resultSemResultado.status === 400,
    "Smoke5-PR1: HTTP 400 quando resultado ausente (gate PR1 intacto)");
  assert(resultSemResultado.body.error === "ADHERENCE_GATE_REQUIRED",
    "Smoke5-PR1: ADHERENCE_GATE_REQUIRED — gate PR1 não foi quebrado");

  // Resultado parcial_desviado deve ser rejeitado (PR1 gate)
  const resultParcial = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_pr1_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: false,  // critério não atendido
      escopo_efetivo:           ["parcialmente feito"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               true,
    },
  }), env);
  assert(resultParcial.status === 422,
    "Smoke5-PR1: HTTP 422 quando parcial_desviado (gate PR1 bloqueia)");
  assert(resultParcial.body.error === "ADHERENCE_GATE_REJECTED",
    "Smoke5-PR1: ADHERENCE_GATE_REJECTED — gate PR1 intacto");
  assert(resultParcial.body.adherence_status === "parcial_desviado",
    "Smoke5-PR1: adherence_status = 'parcial_desviado' — PR1 gate auditável");

  // Resultado aderente deve ser aceito (PR1 gate) e trazer execution_audit (PR2)
  const resultOk = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_pr1_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["regressão verificada"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               false,
    },
  }), env);
  assert(resultOk.status === 200,
    "Smoke5-PR1: HTTP 200 quando aderente (regressão OK)");
  assert(resultOk.body.adherence_status === "aderente_ao_contrato",
    "Smoke5-PR1: PR1 gate ainda retorna adherence_status correto");
  assert(resultOk.body.execution_audit !== undefined,
    "Smoke5-PR2: PR2 execution_audit presente sem quebrar PR1");
}

// ---------------------------------------------------------------------------
// Smoke 6: shape canônico completo (ExecutionAudit)
// ---------------------------------------------------------------------------
console.log("\nSmoke 6: shape canônico completo (ExecutionAudit)");

{
  const audit = auditExecution({ state: STATE_BASE, decomposition: DECOMP_PARCIAL });

  assert("contract_id"           in audit, "Smoke6: shape tem contract_id");
  assert("contract_reference"    in audit, "Smoke6: shape tem contract_reference");
  assert("implemented_reference" in audit, "Smoke6: shape tem implemented_reference");
  assert("missing_items"         in audit, "Smoke6: shape tem missing_items");
  assert("unauthorized_items"    in audit, "Smoke6: shape tem unauthorized_items");
  assert("adherence_status"      in audit, "Smoke6: shape tem adherence_status");
  assert("reason"                in audit, "Smoke6: shape tem reason");
  assert("next_action"           in audit, "Smoke6: shape tem next_action");
  assert("goal" in audit.contract_reference, "Smoke6: contract_reference tem goal");
  assert("contracted_items" in audit.contract_reference, "Smoke6: contract_reference tem contracted_items");
  assert(Array.isArray(audit.implemented_reference), "Smoke6: implemented_reference é array");
  assert(Array.isArray(audit.missing_items), "Smoke6: missing_items é array");
  assert(Array.isArray(audit.unauthorized_items), "Smoke6: unauthorized_items é array");

  // Serializável
  const serialized = JSON.stringify(audit);
  assert(typeof serialized === "string" && serialized.length > 0,
    "Smoke6: ExecutionAudit é serializável via JSON.stringify");
}

// ---------------------------------------------------------------------------
// Smoke 7: determinismo
// ---------------------------------------------------------------------------
console.log("\nSmoke 7: determinismo — mesma entrada → mesma saída");

{
  const a1 = auditExecution({ state: STATE_BASE, decomposition: DECOMP_PARCIAL });
  const a2 = auditExecution({ state: STATE_BASE, decomposition: DECOMP_PARCIAL });

  assert(a1.adherence_status === a2.adherence_status,
    "Smoke7: adherence_status estável");
  assert(JSON.stringify(a1.missing_items) === JSON.stringify(a2.missing_items),
    "Smoke7: missing_items idênticos");
  assert(JSON.stringify(a1.unauthorized_items) === JSON.stringify(a2.unauthorized_items),
    "Smoke7: unauthorized_items idênticos");
  assert(JSON.stringify(a1.implemented_reference) === JSON.stringify(a2.implemented_reference),
    "Smoke7: implemented_reference idêntico");
}

// ---------------------------------------------------------------------------
// Smoke 8: input inválido lança erro
// ---------------------------------------------------------------------------
console.log("\nSmoke 8: input inválido lança erro");

assertThrows(() => auditExecution({}),
  "Smoke8: state ausente → lança erro");
assertThrows(() => auditExecution({ state: null, decomposition: DECOMP_PARCIAL }),
  "Smoke8: state null → lança erro");
assertThrows(() => auditExecution({ state: STATE_BASE, decomposition: null }),
  "Smoke8: decomposition null → lança erro");
assertThrows(() => auditExecution({ state: { ...STATE_BASE, definition_of_done: "não array" }, decomposition: DECOMP_PARCIAL }),
  "Smoke8: definition_of_done não-array → lança erro");
assertThrows(() => auditExecution({ state: { ...STATE_BASE, contract_id: "" }, decomposition: DECOMP_PARCIAL }),
  "Smoke8: contract_id vazio → lança erro");

// ---------------------------------------------------------------------------
// Smoke 9: handleGetExecutionAudit — endpoint de consulta on-demand
// ---------------------------------------------------------------------------
console.log("\nSmoke 9: handleGetExecutionAudit — consulta on-demand auditável");

{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const PAYLOAD_G = {
    contract_id: "ctr_get_audit_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-get-audit",
    goal: "Testar endpoint de auditoria",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Endpoint de auditoria implementado", "Auditoria retorna resultado correto"],
  };

  await handleCreateContract(mockRequest(PAYLOAD_G), env);

  // Sem tasks concluídas → parcial_desviado
  const resultInit = await handleGetExecutionAudit(mockGetRequest("ctr_get_audit_001"), env);

  assert(resultInit.status === 200,
    "Smoke9: HTTP 200 para contrato existente");
  assert(resultInit.body.ok === true,
    "Smoke9: ok = true");
  assert(resultInit.body.adherence_status === "parcial_desviado",
    "Smoke9: adherence_status = 'parcial_desviado' (nenhuma task concluída)");
  assert(Array.isArray(resultInit.body.missing_items) && resultInit.body.missing_items.length === 2,
    "Smoke9: missing_items tem 2 itens (nenhuma task concluída)");
  assert(resultInit.body.unauthorized_items.length === 0,
    "Smoke9: unauthorized_items vazio");

  // Contrato não encontrado → 404
  const resultNotFound = await handleGetExecutionAudit(mockGetRequest("nao_existe_001"), env);
  assert(resultNotFound.status === 404,
    "Smoke9: HTTP 404 para contrato inexistente");
  assert(resultNotFound.body.error === "CONTRACT_NOT_FOUND",
    "Smoke9: error = CONTRACT_NOT_FOUND");

  // contract_id ausente → 400
  const resultMissingParam = await handleGetExecutionAudit({ url: "https://nv-enavia.workers.dev/contracts/execution-audit" }, env);
  assert(resultMissingParam.status === 400,
    "Smoke9: HTTP 400 quando contract_id ausente");
  assert(resultMissingParam.body.error === "MISSING_PARAM",
    "Smoke9: error = MISSING_PARAM");
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
