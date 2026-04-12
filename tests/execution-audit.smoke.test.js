// ============================================================================
// 🧪 Smoke Tests — Execution Audit v1 (Blindagem Contratual PR 2)
//
// Run: node tests/execution-audit.smoke.test.js
//
// Testa a auditoria canônica de execução contra contrato, usando os artefatos
// REAIS do executor (/audit e /propose) como entrada primária.
//
// Smoke tests obrigatórios:
//   Smoke 1: CAMADA 1 aderente — executor_artifacts aprovados pelo contrato
//            → adherence_status = aderente_ao_contrato
//   Smoke 2: CAMADA 1 parcial — executor aprovado mas com blockers/rejeição
//            → adherence_status = parcial_desviado
//   Smoke 3: CAMADA 1 fora do contrato — violação de cláusula imutável
//            → adherence_status = fora_do_contrato
//   Smoke 4: auditoria plugada no fluxo real (handleCompleteTask + executor_artifacts)
//            → execution_audit com audit_mode = "executor_artifacts"
//   Smoke 5: não regressão da PR 1 (gate obrigatório por microetapa ainda funciona)
//
// Cenários adicionais:
//   Smoke 6: CAMADA 2 fallback — sem executor_artifacts → task-based comparison
//   Smoke 7: shape canônico completo + audit_mode presente
//   Smoke 8: determinismo — mesma entrada → mesma saída
//   Smoke 9: input inválido lança erro
//   Smoke 10: handleGetExecutionAudit — endpoint de consulta on-demand
//   Smoke 11: CAMADA 1 — context_proof ausente → fora_do_contrato
//   Smoke 12: CAMADA 1 — target_worker fora do scope → fora_do_contrato
// ============================================================================

import {
  auditExecution,
  EXECUTION_ADHERENCE_STATUS,
  AUDIT_TASK_DONE_STATUSES,
  AUDIT_MODE,
} from "../schema/execution-audit.js";

import {
  handleCompleteTask,
  handleCreateContract,
  startTask,
  rehydrateContract,
  handleGetExecutionAudit,
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

const STATE_BASE = {
  contract_id:        "ctr_audit_001",
  goal:               "Implementar sistema de auditoria contratual",
  definition_of_done: [
    "Módulo de auditoria implementado",
    "Smoke tests passando",
    "Integração no fluxo real",
  ],
  scope: { workers: ["nv-enavia"], environments: ["TEST"] },
  constraints: {
    read_only: true,
    no_auto_apply: true,
    test_before_prod: true,
    rollback_on_failure: true,
  },
  status_global: "executing",
};

const DECOMP_BASE = {
  contract_id: "ctr_audit_001",
  tasks: [
    { id: "task_001", description: "Módulo de auditoria implementado", status: "completed" },
    { id: "task_002", description: "Smoke tests passando",             status: "completed" },
    { id: "task_003", description: "Integração no fluxo real",         status: "completed" },
  ],
};

// ── Canonical executor artifact shapes ──────────────────────────────────────

// Artifact ADERENTE: all canonical requirements met
const ARTIFACTS_ADERENTE = {
  execution_id:     "ex_001",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:         "approve",
    risk_level:      "low",
    findings:        ["Patch parece estar em formato diff (ok)."],
    impacted_areas:  [],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      [],
      context_used:  true,
      context_proof: { snapshot_fingerprint: "abc123", snapshot_chars: 5000 },
    },
  },
};

// Artifact PARCIAL: constraints OK, proof OK, but verdict reject with blockers
const ARTIFACTS_PARCIAL = {
  execution_id:     "ex_002",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:         "reject",
    risk_level:      "medium",
    findings:        ["Patch mexe em KV/estado."],
    impacted_areas:  ["kv"],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      ["Patch com risco alto de erro de sintaxe/estrutura (checks falharam)."],
      context_used:  true,
      context_proof: { snapshot_fingerprint: "def456", snapshot_chars: 4000 },
    },
  },
};

// Artifact FORA: missing context_used and context_proof
const ARTIFACTS_FORA_SEM_PROOF = {
  execution_id:     "ex_003",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:         "approve",
    risk_level:      "low",
    findings:        [],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      [],
      context_used:  false,  // violação cardinal
      context_proof: null,   // violação cardinal
    },
  },
};

// Artifact FORA: read_only violated
const ARTIFACTS_FORA_READ_ONLY = {
  execution_id:     "ex_004",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:         "approve",
    risk_level:      "low",
    findings:        [],
    details: {
      constraints:   { read_only: false, no_auto_apply: true },  // violação
      blockers:      [],
      context_used:  true,
      context_proof: { snapshot_fingerprint: "ghi789", snapshot_chars: 3000 },
    },
  },
};

// ────────────────────────────────────────────────────────────────────────────
// Smoke 1: CAMADA 1 aderente — executor_artifacts aprovados
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 1: CAMADA 1 — aderente_ao_contrato (artefatos reais do executor)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_ADERENTE,
  });

  assert(audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke1: audit_mode = 'executor_artifacts' — usa CAMADA 1");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke1: adherence_status = 'aderente_ao_contrato'");
  assert(audit.missing_items.length === 0,
    "Smoke1: missing_items vazio — todos os requisitos contratuais atendidos");
  assert(audit.unauthorized_items.length === 0,
    "Smoke1: unauthorized_items vazio — sem violações contratuais");
  assert(audit.implemented_reference.some(i => i.includes("verdict: approve")),
    "Smoke1: implemented_reference inclui 'verdict: approve'");
  assert(audit.implemented_reference.some(i => i.includes("context_used: true")),
    "Smoke1: implemented_reference inclui 'context_used: true'");
  assert(audit.implemented_reference.some(i => i.includes("context_proof: presente")),
    "Smoke1: implemented_reference inclui 'context_proof: presente'");
  assert(audit.contract_reference.required_constraints !== undefined,
    "Smoke1: contract_reference inclui required_constraints");
  assert(typeof audit.reason === "string" && audit.reason.includes("aderente"),
    "Smoke1: reason menciona aderente");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 2: CAMADA 1 parcial — constraints OK, proof OK, verdict reject
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 2: CAMADA 1 — parcial_desviado (blockers/rejeição — sem violação imutável)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_PARCIAL,
  });

  assert(audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke2: audit_mode = 'executor_artifacts'");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke2: adherence_status = 'parcial_desviado'");
  assert(audit.unauthorized_items.length === 0,
    "Smoke2: unauthorized_items vazio — sem violação de constraint imutável");
  assert(audit.missing_items.length > 0,
    "Smoke2: missing_items não vazio — verdict reject exige revisão");
  assert(audit.missing_items.some(i => i.includes("verdict")),
    "Smoke2: missing_items registra falha de verdict");
  assert(audit.missing_items.some(i => i.includes("blocker")),
    "Smoke2: missing_items registra blocker presente");
  assert(audit.reason.includes("parcial"),
    "Smoke2: reason menciona parcial");
  assert(audit.next_action.toLowerCase().includes("revisar") || audit.next_action.toLowerCase().includes("patch"),
    "Smoke2: next_action orienta revisão do patch");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 3: CAMADA 1 fora do contrato — violação de cláusula imutável
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 3: CAMADA 1 — fora_do_contrato (context_used: false — violação cardinal)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_FORA_SEM_PROOF,
  });

  assert(audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke3: audit_mode = 'executor_artifacts'");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke3: adherence_status = 'fora_do_contrato'");
  assert(audit.unauthorized_items.length >= 2,
    "Smoke3: unauthorized_items tem pelo menos 2 violações (context_used + context_proof)");
  assert(audit.unauthorized_items.some(i => i.includes("context_used")),
    "Smoke3: unauthorized_items registra violação de context_used");
  assert(audit.unauthorized_items.some(i => i.includes("context_proof")),
    "Smoke3: unauthorized_items registra violação de context_proof");
  assert(audit.reason.toLowerCase().includes("violação") || audit.reason.toLowerCase().includes("fora"),
    "Smoke3: reason menciona violação");
  assert(audit.next_action.toLowerCase().includes("não carimbar") || audit.next_action.toLowerCase().includes("carimb"),
    "Smoke3: next_action alerta para não carimbar");
}

// fora_do_contrato via read_only violada
{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_FORA_READ_ONLY,
  });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke3b: fora_do_contrato quando read_only: false");
  assert(audit.unauthorized_items.some(i => i.includes("read_only")),
    "Smoke3b: unauthorized_items registra violação de read_only");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 4: auditoria plugada no fluxo real (handleCompleteTask + executor_artifacts)
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 4: execution_audit com CAMADA 1 no fluxo real (handleCompleteTask)");

{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const PAYLOAD = {
    contract_id: "ctr_audit_flow_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-audit-operator",
    goal: "Testar auditoria no fluxo real",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
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
    executor_artifacts: {
      execution_id:     "ex_flow_001",
      target_worker_id: "nv-enavia",
      audit: {
        verdict:         "approve",
        risk_level:      "low",
        findings:        ["Patch parece estar em formato diff (ok)."],
        details: {
          constraints:   { read_only: true, no_auto_apply: true },
          blockers:      [],
          context_used:  true,
          context_proof: { snapshot_fingerprint: "jkl012", snapshot_chars: 6000 },
        },
      },
    },
  }), env);

  assert(result.status === 200,
    "Smoke4: handleCompleteTask retorna HTTP 200");
  assert(result.body.ok === true,
    "Smoke4: ok = true");
  assert(result.body.execution_audit !== undefined,
    "Smoke4: execution_audit presente na resposta");
  assert(result.body.execution_audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke4: audit_mode = 'executor_artifacts' — CAMADA 1 usada no fluxo real");
  assert(result.body.execution_audit.contract_id === "ctr_audit_flow_001",
    "Smoke4: execution_audit.contract_id correto");
  assert(Array.isArray(result.body.execution_audit.implemented_reference),
    "Smoke4: implemented_reference é array");
  assert(result.body.execution_audit.implemented_reference.some(i => i.includes("verdict: approve")),
    "Smoke4: implemented_reference registra verdict: approve do executor");
  assert(result.body.execution_audit.unauthorized_items.length === 0,
    "Smoke4: unauthorized_items vazio — artefatos aderentes ao contrato");
}

// Smoke 4b: sem executor_artifacts → CAMADA 2
{
  const kv2 = createMockKV();
  const env2 = { ENAVIA_BRAIN: kv2 };

  const PAYLOAD2 = {
    contract_id: "ctr_audit_flow_002",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-audit-operator-2",
    goal: "Testar fallback CAMADA 2",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Fallback task verificada"],
  };

  await handleCreateContract(mockRequest(PAYLOAD2), env2);
  await startTask(env2, "ctr_audit_flow_002", "task_001");

  const result2 = await handleCompleteTask(mockRequest({
    contract_id: "ctr_audit_flow_002",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["fallback task verificada"],
      is_simulado:              false,
      is_mockado:               false,
      is_local:                 false,
      is_parcial:               false,
    },
    // executor_artifacts ausente → CAMADA 2
  }), env2);

  assert(result2.status === 200,
    "Smoke4b: HTTP 200 sem executor_artifacts");
  assert(result2.body.execution_audit.audit_mode === AUDIT_MODE.TASK_DECOMPOSITION,
    "Smoke4b: audit_mode = 'task_decomposition' — CAMADA 2 quando executor_artifacts ausente");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 5: não regressão da PR 1 — gate obrigatório por microetapa
// ────────────────────────────────────────────────────────────────────────────
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

  // Bypass tentado — resultado ausente
  const resultSemResultado = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_pr1_001",
    task_id:     "task_001",
  }), env);
  assert(resultSemResultado.status === 400,
    "Smoke5-PR1: HTTP 400 quando resultado ausente (gate PR1 intacto)");
  assert(resultSemResultado.body.error === "ADHERENCE_GATE_REQUIRED",
    "Smoke5-PR1: ADHERENCE_GATE_REQUIRED — gate PR1 não foi quebrado");

  // Resultado parcial_desviado → gate PR1 bloqueia
  const resultParcial = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_pr1_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: false,
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

  // Resultado aderente → PR1 gate passa + PR2 execution_audit com CAMADA 1
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
    executor_artifacts: ARTIFACTS_ADERENTE,
  }), env);
  assert(resultOk.status === 200,
    "Smoke5: HTTP 200 quando aderente (regressão OK)");
  assert(resultOk.body.adherence_status === "aderente_ao_contrato",
    "Smoke5-PR1: PR1 gate ainda retorna adherence_status correto");
  assert(resultOk.body.execution_audit !== undefined,
    "Smoke5-PR2: PR2 execution_audit presente sem quebrar PR1");
  assert(resultOk.body.execution_audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke5-PR2: PR2 usa CAMADA 1 quando executor_artifacts presente");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 6: CAMADA 2 fallback — sem executor_artifacts
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 6: CAMADA 2 fallback — sem executor_artifacts → task-based comparison");

{
  const decomp_parcial = {
    contract_id: "ctr_audit_001",
    tasks: [
      { id: "task_001", description: "Módulo de auditoria implementado", status: "completed" },
      { id: "task_002", description: "Smoke tests passando",             status: "in_progress" },
      { id: "task_003", description: "Integração no fluxo real",         status: "queued" },
    ],
  };

  const audit = auditExecution({ state: STATE_BASE, decomposition: decomp_parcial });

  assert(audit.audit_mode === AUDIT_MODE.TASK_DECOMPOSITION,
    "Smoke6: audit_mode = 'task_decomposition' quando executor_artifacts ausente");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke6: adherence_status = 'parcial_desviado' (2 tasks incompletas)");
  assert(audit.missing_items.length === 2,
    "Smoke6: missing_items tem 2 tasks incompletas");
  assert(audit.unauthorized_items.length === 0,
    "Smoke6: unauthorized_items vazio (tasks completadas estão no DoD)");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 7: shape canônico completo + audit_mode
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 7: shape canônico completo (ExecutionAudit com CAMADA 1 e CAMADA 2)");

{
  // CAMADA 1
  const audit1 = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_ADERENTE,
  });

  assert("contract_id"           in audit1, "Smoke7-C1: shape tem contract_id");
  assert("audit_mode"            in audit1, "Smoke7-C1: shape tem audit_mode");
  assert("contract_reference"    in audit1, "Smoke7-C1: shape tem contract_reference");
  assert("implemented_reference" in audit1, "Smoke7-C1: shape tem implemented_reference");
  assert("missing_items"         in audit1, "Smoke7-C1: shape tem missing_items");
  assert("unauthorized_items"    in audit1, "Smoke7-C1: shape tem unauthorized_items");
  assert("adherence_status"      in audit1, "Smoke7-C1: shape tem adherence_status");
  assert("reason"                in audit1, "Smoke7-C1: shape tem reason");
  assert("next_action"           in audit1, "Smoke7-C1: shape tem next_action");
  assert("required_constraints" in audit1.contract_reference,
    "Smoke7-C1: contract_reference tem required_constraints");
  assert(typeof JSON.stringify(audit1) === "string",
    "Smoke7-C1: ExecutionAudit CAMADA 1 é serializável");

  // CAMADA 2
  const audit2 = auditExecution({ state: STATE_BASE, decomposition: DECOMP_BASE });
  assert("contract_id"    in audit2, "Smoke7-C2: shape tem contract_id");
  assert("audit_mode"     in audit2, "Smoke7-C2: shape tem audit_mode");
  assert("contracted_items" in audit2.contract_reference, "Smoke7-C2: contract_reference tem contracted_items");
  assert(typeof JSON.stringify(audit2) === "string",
    "Smoke7-C2: ExecutionAudit CAMADA 2 é serializável");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 8: determinismo
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 8: determinismo — mesma entrada → mesma saída");

{
  const a1 = auditExecution({ state: STATE_BASE, decomposition: DECOMP_BASE, executor_artifacts: ARTIFACTS_PARCIAL });
  const a2 = auditExecution({ state: STATE_BASE, decomposition: DECOMP_BASE, executor_artifacts: ARTIFACTS_PARCIAL });

  assert(a1.adherence_status === a2.adherence_status, "Smoke8: adherence_status estável");
  assert(JSON.stringify(a1.missing_items) === JSON.stringify(a2.missing_items), "Smoke8: missing_items idênticos");
  assert(JSON.stringify(a1.unauthorized_items) === JSON.stringify(a2.unauthorized_items), "Smoke8: unauthorized_items idênticos");
  assert(JSON.stringify(a1.implemented_reference) === JSON.stringify(a2.implemented_reference), "Smoke8: implemented_reference idêntico");
  assert(a1.audit_mode === a2.audit_mode, "Smoke8: audit_mode estável");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 9: input inválido lança erro
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 9: input inválido lança erro");

assertThrows(() => auditExecution({}), "Smoke9: state ausente → lança erro");
assertThrows(() => auditExecution({ state: null, decomposition: DECOMP_BASE }), "Smoke9: state null → lança erro");
assertThrows(() => auditExecution({ state: STATE_BASE, decomposition: null }), "Smoke9: decomposition null → lança erro");
assertThrows(
  () => auditExecution({ state: { ...STATE_BASE, definition_of_done: "não array" }, decomposition: DECOMP_BASE }),
  "Smoke9: definition_of_done não-array → lança erro"
);
assertThrows(
  () => auditExecution({ state: { ...STATE_BASE, contract_id: "" }, decomposition: DECOMP_BASE }),
  "Smoke9: contract_id vazio → lança erro"
);

// ────────────────────────────────────────────────────────────────────────────
// Smoke 10: handleGetExecutionAudit — endpoint on-demand
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 10: handleGetExecutionAudit — consulta on-demand auditável");

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

  // Sem executor_artifacts → CAMADA 2
  const resultInit = await handleGetExecutionAudit(mockGetRequest("ctr_get_audit_001"), env);

  assert(resultInit.status === 200, "Smoke10: HTTP 200 para contrato existente");
  assert(resultInit.body.ok === true, "Smoke10: ok = true");
  assert(resultInit.body.audit_mode === AUDIT_MODE.TASK_DECOMPOSITION,
    "Smoke10: audit_mode = 'task_decomposition' via GET sem executor_artifacts");
  assert(resultInit.body.adherence_status === "parcial_desviado",
    "Smoke10: adherence_status = 'parcial_desviado' (nenhuma task concluída)");

  // 404
  const resultNotFound = await handleGetExecutionAudit(mockGetRequest("nao_existe_001"), env);
  assert(resultNotFound.status === 404, "Smoke10: HTTP 404 para contrato inexistente");
  assert(resultNotFound.body.error === "CONTRACT_NOT_FOUND", "Smoke10: error = CONTRACT_NOT_FOUND");

  // 400 sem contract_id
  const resultMissing = await handleGetExecutionAudit({ url: "https://nv-enavia.workers.dev/contracts/execution-audit" }, env);
  assert(resultMissing.status === 400, "Smoke10: HTTP 400 quando contract_id ausente");
  assert(resultMissing.body.error === "MISSING_PARAM", "Smoke10: error = MISSING_PARAM");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 11: CAMADA 1 — context_proof presente mas context_used false
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 11: CAMADA 1 — context_proof presente + context_used false → fora_do_contrato");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: {
      execution_id:     "ex_011",
      target_worker_id: "nv-enavia",
      audit: {
        verdict:         "approve",
        risk_level:      "low",
        findings:        [],
        details: {
          constraints:   { read_only: true, no_auto_apply: true },
          blockers:      [],
          context_used:  false,            // violação — false mesmo com proof
          context_proof: { snapshot_fingerprint: "xyz", snapshot_chars: 1000 },
        },
      },
    },
  });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke11: fora_do_contrato quando context_used: false (mesmo com context_proof)");
  assert(audit.unauthorized_items.some(i => i.includes("context_used")),
    "Smoke11: unauthorized_items registra violação de context_used");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 12: CAMADA 1 — target_worker fora do scope → fora_do_contrato
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 12: CAMADA 1 — target_worker fora do scope → fora_do_contrato");

{
  const audit = auditExecution({
    state:              STATE_BASE,  // scope.workers = ["nv-enavia"]
    decomposition:      DECOMP_BASE,
    executor_artifacts: {
      execution_id:     "ex_012",
      target_worker_id: "outro-worker-nao-autorizado",  // fora do scope
      audit: {
        verdict:         "approve",
        risk_level:      "low",
        findings:        [],
        details: {
          constraints:   { read_only: true, no_auto_apply: true },
          blockers:      [],
          context_used:  true,
          context_proof: { snapshot_fingerprint: "mno", snapshot_chars: 2000 },
        },
      },
    },
  });

  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke12: fora_do_contrato quando target_worker fora do scope");
  assert(audit.unauthorized_items.some(i => i.includes("outro-worker-nao-autorizado")),
    "Smoke12: unauthorized_items registra worker fora do scope");
  assert(audit.unauthorized_items.some(i => i.includes("nv-enavia")),
    "Smoke12: unauthorized_items menciona scope esperado");
}

// ────────────────────────────────────────────────────────────────────────────
// Results
// ────────────────────────────────────────────────────────────────────────────
console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
