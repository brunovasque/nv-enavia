// ============================================================================
// 🧪 Smoke Tests — Execution Audit v1 (Blindagem Contratual PR 2)
//
// Run: node tests/execution-audit.smoke.test.js
//
// Testa a auditoria canônica de execução contra contrato, ancorada na
// microetapa contratual (microstep_id = task_id).
//
// Smoke tests:
//   Smoke 1:  MODO PRINCIPAL — microstep aderente com artefatos do executor
//   Smoke 2:  MODO PRINCIPAL — microstep parcialmente desviado (blockers)
//   Smoke 3:  MODO PRINCIPAL — microstep fora do contrato (violação cardinal)
//   Smoke 4:  MODO PRINCIPAL — microstep sem executor_artifacts (structural)
//   Smoke 5:  MODO PRINCIPAL — microstep_id inválido → fora_do_contrato
//   Smoke 6:  MODO PRINCIPAL — execution_cycles: múltiplos ciclos por microstep
//   Smoke 7:  MODO PRINCIPAL — integração no fluxo real (handleCompleteTask)
//   Smoke 8:  MODO PRINCIPAL — target_worker fora do scope → fora_do_contrato
//   Smoke 9:  FALLBACK 1 — executor_artifacts sem microstep_id
//   Smoke 10: FALLBACK 2 — task_decomposition sem executor_artifacts
//   Smoke 11: shape canônico completo + audit_mode + execution_ids
//   Smoke 12: determinismo — mesma entrada → mesma saída
//   Smoke 13: input inválido lança erro
//   Smoke 14: handleGetExecutionAudit — endpoint on-demand com microstep_id
//   Smoke 15: não regressão PR1 — gate obrigatório por microetapa intacto
//   Smoke 16: KV-persisted task_execution_log — ciclos reais persistidos
//   Smoke 17: handleGetExecutionAudit resolve natively via task_execution_log
//   Smoke 18: múltiplas execuções (retries) — N ciclos persistidos no log
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
    async json() {
      if (body === null) throw new Error("Invalid JSON");
      return body;
    },
  };
}

function mockGetRequest(contractId, microstepId) {
  const qs = microstepId
    ? `?contract_id=${contractId}&microstep_id=${microstepId}`
    : `?contract_id=${contractId}`;
  return { url: `https://nv-enavia.workers.dev/contracts/execution-audit${qs}` };
}

// ---------------------------------------------------------------------------
// Fixtures — state e decomposition canônicos
// ---------------------------------------------------------------------------
const STATE_BASE = {
  contract_id:        "ctr_ms_001",
  goal:               "Implementar sistema de auditoria contratual",
  definition_of_done: [
    "Módulo de auditoria implementado",
    "Smoke tests passando",
    "Integração no fluxo real",
  ],
  scope: { workers: ["nv-enavia"], environments: ["TEST"] },
  constraints: { read_only: true, no_auto_apply: true, test_before_prod: true },
};

const DECOMP_BASE = {
  contract_id: "ctr_ms_001",
  tasks: [
    { id: "task_001", description: "Módulo de auditoria implementado", status: "completed" },
    { id: "task_002", description: "Smoke tests passando",             status: "completed" },
    { id: "task_003", description: "Integração no fluxo real",         status: "in_progress" },
  ],
  micro_pr_candidates: [
    { id: "micro_pr_001", task_id: "task_001", status: "in_progress", environment: "TEST", target_workers: ["nv-enavia"] },
    { id: "micro_pr_002", task_id: "task_002", status: "queued",      environment: "TEST", target_workers: ["nv-enavia"] },
    { id: "micro_pr_003", task_id: "task_003", status: "queued",      environment: "TEST", target_workers: ["nv-enavia"] },
    { id: "micro_pr_004", task_id: null,       status: "queued",      environment: "PROD", target_workers: ["nv-enavia"] },
  ],
};

// ── Canonical executor artifact shapes ──────────────────────────────────────

const ARTIFACTS_ADERENTE = {
  execution_id:     "ex_001",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:    "approve",
    risk_level: "low",
    findings:   ["Patch em formato diff (ok)."],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      [],
      context_used:  true,
      context_proof: { snapshot_fingerprint: "abc123", snapshot_chars: 5000 },
    },
  },
};

const ARTIFACTS_PARCIAL = {
  execution_id:     "ex_002",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:    "reject",
    risk_level: "medium",
    findings:   ["Patch mexe em KV/estado."],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      ["Patch com risco alto de sintaxe."],
      context_used:  true,
      context_proof: { snapshot_fingerprint: "def456", snapshot_chars: 4000 },
    },
  },
};

const ARTIFACTS_FORA = {
  execution_id:     "ex_003",
  target_worker_id: "nv-enavia",
  audit: {
    verdict:    "approve",
    risk_level: "low",
    findings:   [],
    details: {
      constraints:   { read_only: true, no_auto_apply: true },
      blockers:      [],
      context_used:  false,  // violação cardinal
      context_proof: null,   // violação cardinal
    },
  },
};

const EXECUTION_CYCLE_1 = {
  contract_id:            "ctr_ms_001",
  task_id:                "task_001",
  micro_pr_id:            "micro_pr_001",
  execution_status:       "success",
  execution_started_at:   "2026-04-12T10:00:00Z",
  execution_finished_at:  "2026-04-12T10:05:00Z",
  execution_evidence:     ["Task executada com sucesso em TEST"],
};

const EXECUTION_CYCLE_2 = {
  execution_id:           "ex_retry_001",  // segunda tentativa com execution_id explícito
  contract_id:            "ctr_ms_001",
  task_id:                "task_001",
  micro_pr_id:            "micro_pr_001",
  execution_status:       "success",
  execution_started_at:   "2026-04-12T11:00:00Z",
  execution_finished_at:  "2026-04-12T11:05:00Z",
  execution_evidence:     ["Retentativa: task concluída"],
};

// ────────────────────────────────────────────────────────────────────────────
// Smoke 1: MODO PRINCIPAL — microstep aderente
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 1: MODO PRINCIPAL — microstep aderente ao contrato");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_ADERENTE,
    execution_cycles:   [EXECUTION_CYCLE_1],
  });

  assert(audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke1: audit_mode = 'microstep_anchored'");
  assert(audit.microstep_id === "task_001",
    "Smoke1: microstep_id = 'task_001' — chave principal da auditoria");
  assert(Array.isArray(audit.execution_ids) && audit.execution_ids.length >= 1,
    "Smoke1: execution_ids não vazio — evidence subordinada");
  assert(audit.execution_ids.includes("ex_001"),
    "Smoke1: execution_ids inclui execution_id do executor");
  assert(audit.execution_ids.includes("micro_pr_001"),
    "Smoke1: execution_ids inclui micro_pr_id do ciclo operacional");
  assert(audit.contract_microstep_reference !== null,
    "Smoke1: contract_microstep_reference presente");
  assert(audit.contract_microstep_reference.task_id === "task_001",
    "Smoke1: contract_microstep_reference.task_id correto");
  assert(audit.contract_microstep_reference.micro_pr_id === "micro_pr_001",
    "Smoke1: contract_microstep_reference.micro_pr_id linkado corretamente");
  assert(audit.executor_artifacts_reference !== null,
    "Smoke1: executor_artifacts_reference presente");
  assert(audit.executor_artifacts_reference.verdict === "approve",
    "Smoke1: executor_artifacts_reference.verdict = 'approve'");
  assert(audit.execution_cycles_reference !== null,
    "Smoke1: execution_cycles_reference presente");
  assert(audit.execution_cycles_reference.total === 1,
    "Smoke1: execution_cycles_reference.total = 1");
  assert(audit.execution_cycles_reference.successful === 1,
    "Smoke1: execution_cycles_reference.successful = 1");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke1: adherence_status = 'aderente_ao_contrato'");
  assert(audit.missing_items.length === 0,
    "Smoke1: missing_items vazio");
  assert(audit.unauthorized_items.length === 0,
    "Smoke1: unauthorized_items vazio");
  assert(audit.reason.includes("task_001"),
    "Smoke1: reason menciona microstep_id");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 2: MODO PRINCIPAL — microstep parcialmente desviado
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 2: MODO PRINCIPAL — microstep parcialmente desviado (blockers)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_002",
    executor_artifacts: ARTIFACTS_PARCIAL,
    execution_cycles:   [],
  });

  assert(audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke2: audit_mode = 'microstep_anchored'");
  assert(audit.microstep_id === "task_002",
    "Smoke2: microstep_id = 'task_002'");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke2: adherence_status = 'parcial_desviado'");
  assert(audit.unauthorized_items.length === 0,
    "Smoke2: unauthorized_items vazio — sem violação de constraint imutável");
  assert(audit.missing_items.length > 0,
    "Smoke2: missing_items não vazio — verdict reject + blockers");
  assert(audit.missing_items.some((i) => i.includes("task_002")),
    "Smoke2: missing_items referencia microstep_id (task_002)");
  assert(audit.missing_items.some((i) => i.includes("verdict")),
    "Smoke2: missing_items registra falha de verdict");
  assert(audit.missing_items.some((i) => i.includes("blocker")),
    "Smoke2: missing_items registra blockers presentes");
  assert(audit.next_action.toLowerCase().includes("revisar"),
    "Smoke2: next_action orienta revisão do patch");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 3: MODO PRINCIPAL — microstep fora do contrato (violação cardinal)
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 3: MODO PRINCIPAL — microstep fora do contrato (context_used: false)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_FORA,
  });

  assert(audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke3: audit_mode = 'microstep_anchored'");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke3: adherence_status = 'fora_do_contrato'");
  assert(audit.unauthorized_items.length >= 2,
    "Smoke3: unauthorized_items >= 2 violações (context_used + context_proof)");
  assert(audit.unauthorized_items.every((i) => i.includes("task_001")),
    "Smoke3: unauthorized_items referenciam microstep_id (task_001)");
  assert(audit.unauthorized_items.some((i) => i.includes("context_used")),
    "Smoke3: unauthorized_items registra violação de context_used");
  assert(audit.unauthorized_items.some((i) => i.includes("context_proof")),
    "Smoke3: unauthorized_items registra violação de context_proof");
  assert(audit.next_action.toLowerCase().includes("não carimbar") ||
    audit.next_action.toLowerCase().includes("carimb"),
    "Smoke3: next_action alerta para não carimbar");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 4: MODO PRINCIPAL — microstep sem executor_artifacts (structural)
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 4: MODO PRINCIPAL — microstep sem executor_artifacts (verificação estrutural)");

{
  // task_001 está completed e no DoD → aderente
  const auditOk = auditExecution({
    state:         STATE_BASE,
    decomposition: DECOMP_BASE,
    microstep_id:  "task_001",
  });

  assert(auditOk.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke4: audit_mode = 'microstep_anchored' mesmo sem executor_artifacts");
  assert(auditOk.executor_artifacts_reference === null,
    "Smoke4: executor_artifacts_reference = null quando ausente");
  assert(auditOk.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke4: task completed + in DoD → aderente (sem proof)");
  assert(auditOk.next_action.toLowerCase().includes("/audit"),
    "Smoke4: next_action orienta para executar /audit para prova formal");

  // task_003 está in_progress → parcial
  const auditParcial = auditExecution({
    state:         STATE_BASE,
    decomposition: DECOMP_BASE,
    microstep_id:  "task_003",
  });

  assert(auditParcial.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke4: task in_progress → parcial_desviado sem executor_artifacts");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 5: MODO PRINCIPAL — microstep_id inválido
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 5: MODO PRINCIPAL — microstep_id inválido → fora_do_contrato");

{
  const audit = auditExecution({
    state:         STATE_BASE,
    decomposition: DECOMP_BASE,
    microstep_id:  "task_nao_existe_999",
  });

  assert(audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke5: audit_mode = 'microstep_anchored' mesmo com microstep inválido");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA,
    "Smoke5: fora_do_contrato quando microstep_id não existe");
  assert(audit.contract_microstep_reference === null,
    "Smoke5: contract_microstep_reference = null para microstep inexistente");
  assert(audit.unauthorized_items.some((i) => i.includes("task_nao_existe_999")),
    "Smoke5: unauthorized_items menciona microstep_id inválido");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 6: MODO PRINCIPAL — execution_cycles: múltiplos ciclos por microstep
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 6: MODO PRINCIPAL — execution_cycles múltiplos (1..N por microstep)");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_ADERENTE,
    execution_cycles:   [EXECUTION_CYCLE_1, EXECUTION_CYCLE_2],
  });

  assert(audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke6: audit_mode = 'microstep_anchored'");
  assert(audit.execution_cycles_reference.total === 2,
    "Smoke6: execution_cycles_reference.total = 2 ciclos registrados");
  assert(audit.execution_cycles_reference.successful === 2,
    "Smoke6: execution_cycles_reference.successful = 2");
  assert(audit.execution_ids.includes("ex_001"),
    "Smoke6: execution_ids inclui executor execution_id");
  assert(audit.execution_ids.includes("ex_retry_001"),
    "Smoke6: execution_ids inclui execution_id do segundo ciclo");
  assert(audit.execution_ids.includes("micro_pr_001"),
    "Smoke6: execution_ids inclui micro_pr_id do ciclo sem execution_id explícito");
  // All unique (deduplication)
  const unique = new Set(audit.execution_ids);
  assert(unique.size === audit.execution_ids.length,
    "Smoke6: execution_ids sem duplicatas");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 7: MODO PRINCIPAL — integração no fluxo real (handleCompleteTask)
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 7: MODO PRINCIPAL — integração no fluxo real (handleCompleteTask)");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_flow_ms_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test",
    goal: "Integração microstep no fluxo real",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints: { max_micro_prs: 5, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Gate de auditoria implementado", "Smoke tests passando"],
  }), env);

  await startTask(env, "ctr_flow_ms_001", "task_001");

  const result = await handleCompleteTask(mockRequest({
    contract_id: "ctr_flow_ms_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido:        true,
      criterio_aceite_atendido: true,
      escopo_efetivo:           ["gate de auditoria implementado"],
      is_simulado:              false, is_mockado: false, is_local: false, is_parcial: false,
    },
    executor_artifacts: {
      execution_id:     "ex_flow_001",
      target_worker_id: "nv-enavia",
      audit: {
        verdict:    "approve",
        risk_level: "low",
        findings:   ["Patch em formato diff (ok)."],
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
    "Smoke7: handleCompleteTask retorna HTTP 200");
  assert(result.body.ok === true,
    "Smoke7: ok = true");
  const ea = result.body.execution_audit;
  assert(ea !== undefined,
    "Smoke7: execution_audit presente na resposta");
  assert(ea.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke7: audit_mode = 'microstep_anchored' no fluxo real");
  assert(ea.microstep_id === "task_001",
    "Smoke7: microstep_id = 'task_001' — chave principal");
  assert(ea.contract_id === "ctr_flow_ms_001",
    "Smoke7: contract_id correto");
  assert(ea.contract_microstep_reference !== null,
    "Smoke7: contract_microstep_reference presente");
  assert(ea.executor_artifacts_reference !== null,
    "Smoke7: executor_artifacts_reference presente");
  assert(ea.executor_artifacts_reference.verdict === "approve",
    "Smoke7: executor verdict registrado");
  assert(ea.execution_ids.includes("ex_flow_001"),
    "Smoke7: execution_ids inclui execution_id do executor");
  assert(ea.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke7: adherence_status = 'aderente_ao_contrato' no fluxo real");
}

// Smoke 7b: sem executor_artifacts → modo microstep sem proof
{
  const kv2  = createMockKV();
  const env2 = { ENAVIA_BRAIN: kv2 };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_flow_ms_002",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test",
    goal: "Fallback sem executor_artifacts",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Fallback task"],
  }), env2);

  await startTask(env2, "ctr_flow_ms_002", "task_001");

  const result2 = await handleCompleteTask(mockRequest({
    contract_id: "ctr_flow_ms_002",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido: true, criterio_aceite_atendido: true,
      escopo_efetivo: ["fallback task"],
      is_simulado: false, is_mockado: false, is_local: false, is_parcial: false,
    },
  }), env2);

  assert(result2.status === 200,
    "Smoke7b: HTTP 200 sem executor_artifacts");
  assert(result2.body.execution_audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke7b: ainda usa 'microstep_anchored' — microstep_id sempre passado");
  assert(result2.body.execution_audit.executor_artifacts_reference === null,
    "Smoke7b: executor_artifacts_reference = null quando ausente");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 8: MODO PRINCIPAL — target_worker fora do scope → fora_do_contrato
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 8: MODO PRINCIPAL — target_worker fora do scope → fora_do_contrato");

{
  const audit = auditExecution({
    state:              STATE_BASE,  // scope.workers = ["nv-enavia"]
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",  // micro_pr_001 target_workers = ["nv-enavia"]
    executor_artifacts: {
      execution_id:     "ex_008",
      target_worker_id: "outro-worker-nao-autorizado",
      audit: {
        verdict:    "approve",
        risk_level: "low",
        findings:   [],
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
    "Smoke8: fora_do_contrato quando target_worker fora do escopo da microetapa");
  assert(audit.unauthorized_items.some((i) => i.includes("outro-worker-nao-autorizado")),
    "Smoke8: unauthorized_items registra worker fora do scope");
  assert(audit.unauthorized_items.some((i) => i.includes("task_001")),
    "Smoke8: unauthorized_items menciona microstep_id");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 9: FALLBACK 1 — executor_artifacts sem microstep_id
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 9: FALLBACK 1 — executor_artifacts sem microstep_id");

{
  const audit = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    executor_artifacts: ARTIFACTS_ADERENTE,
    // microstep_id ausente → FALLBACK 1
  });

  assert(audit.audit_mode === AUDIT_MODE.EXECUTOR_ARTIFACTS,
    "Smoke9: audit_mode = 'executor_artifacts' (FALLBACK 1 sem microstep_id)");
  assert(audit.microstep_id === null,
    "Smoke9: microstep_id = null no FALLBACK 1");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke9: FALLBACK 1 aderente quando artefatos OK");
  assert(Array.isArray(audit.implemented_reference),
    "Smoke9: implemented_reference presente no FALLBACK 1");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 10: FALLBACK 2 — task_decomposition sem executor_artifacts
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 10: FALLBACK 2 — task_decomposition sem executor_artifacts");

{
  const audit = auditExecution({
    state:         STATE_BASE,
    decomposition: DECOMP_BASE,
    // microstep_id ausente, executor_artifacts ausente → FALLBACK 2
  });

  assert(audit.audit_mode === AUDIT_MODE.TASK_DECOMPOSITION,
    "Smoke10: audit_mode = 'task_decomposition' (FALLBACK 2)");
  assert(audit.microstep_id === null,
    "Smoke10: microstep_id = null no FALLBACK 2");
  assert(audit.adherence_status === EXECUTION_ADHERENCE_STATUS.PARCIAL,
    "Smoke10: parcial_desviado (task_003 ainda in_progress)");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 11: shape canônico completo
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 11: shape canônico completo (MODO PRINCIPAL + FALLBACKS)");

{
  // MODO PRINCIPAL
  const a = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_ADERENTE,
    execution_cycles:   [EXECUTION_CYCLE_1],
  });

  const REQUIRED_FIELDS = [
    "contract_id", "audit_mode", "microstep_id", "execution_ids",
    "contract_microstep_reference", "executor_artifacts_reference",
    "execution_cycles_reference",
    "missing_items", "unauthorized_items", "adherence_status", "reason", "next_action",
  ];
  for (const f of REQUIRED_FIELDS) {
    assert(f in a, `Smoke11-MS: shape tem campo ${f}`);
  }
  assert(typeof JSON.stringify(a) === "string",
    "Smoke11-MS: MODO PRINCIPAL é serializável");

  // contract_microstep_reference fields
  const cref = a.contract_microstep_reference;
  assert("task_id" in cref && "micro_pr_id" in cref && "required_constraints" in cref,
    "Smoke11-MS: contract_microstep_reference tem task_id, micro_pr_id, required_constraints");
  assert("max_acceptable_risk_level" in cref.required_constraints,
    "Smoke11-MS: required_constraints tem max_acceptable_risk_level");

  // executor_artifacts_reference fields
  const eref = a.executor_artifacts_reference;
  assert("verdict" in eref && "risk_level" in eref && "context_used" in eref && "context_proof" in eref,
    "Smoke11-MS: executor_artifacts_reference tem campos canônicos");

  // execution_cycles_reference fields
  const ecref = a.execution_cycles_reference;
  assert("cycles" in ecref && "total" in ecref && "successful" in ecref && "failed" in ecref,
    "Smoke11-MS: execution_cycles_reference tem cycles, total, successful, failed");

  // FALLBACK 1
  const b = auditExecution({ state: STATE_BASE, decomposition: DECOMP_BASE, executor_artifacts: ARTIFACTS_ADERENTE });
  assert(typeof JSON.stringify(b) === "string", "Smoke11-FA1: FALLBACK 1 é serializável");
  assert("contract_reference" in b, "Smoke11-FA1: FALLBACK 1 tem contract_reference");

  // FALLBACK 2
  const c = auditExecution({ state: STATE_BASE, decomposition: DECOMP_BASE });
  assert(typeof JSON.stringify(c) === "string", "Smoke11-FA2: FALLBACK 2 é serializável");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 12: determinismo
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 12: determinismo — mesma entrada → mesma saída");

{
  const a1 = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_PARCIAL,
    execution_cycles:   [EXECUTION_CYCLE_1],
  });
  const a2 = auditExecution({
    state:              STATE_BASE,
    decomposition:      DECOMP_BASE,
    microstep_id:       "task_001",
    executor_artifacts: ARTIFACTS_PARCIAL,
    execution_cycles:   [EXECUTION_CYCLE_1],
  });

  assert(a1.adherence_status === a2.adherence_status,   "Smoke12: adherence_status estável");
  assert(a1.audit_mode === a2.audit_mode,               "Smoke12: audit_mode estável");
  assert(a1.microstep_id === a2.microstep_id,           "Smoke12: microstep_id estável");
  assert(JSON.stringify(a1.execution_ids) === JSON.stringify(a2.execution_ids), "Smoke12: execution_ids idênticos");
  assert(JSON.stringify(a1.missing_items) === JSON.stringify(a2.missing_items), "Smoke12: missing_items idênticos");
  assert(JSON.stringify(a1.unauthorized_items) === JSON.stringify(a2.unauthorized_items), "Smoke12: unauthorized_items idênticos");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 13: input inválido lança erro
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 13: input inválido lança erro");

assertThrows(() => auditExecution({}), "Smoke13: state ausente → lança erro");
assertThrows(() => auditExecution({ state: null, decomposition: DECOMP_BASE }), "Smoke13: state null → lança erro");
assertThrows(() => auditExecution({ state: STATE_BASE, decomposition: null }), "Smoke13: decomposition null → lança erro");
assertThrows(
  () => auditExecution({ state: { ...STATE_BASE, definition_of_done: "não array" }, decomposition: DECOMP_BASE }),
  "Smoke13: definition_of_done não-array → lança erro"
);
assertThrows(
  () => auditExecution({ state: { ...STATE_BASE, contract_id: "" }, decomposition: DECOMP_BASE }),
  "Smoke13: contract_id vazio → lança erro"
);

// ────────────────────────────────────────────────────────────────────────────
// Smoke 14: handleGetExecutionAudit — endpoint on-demand com microstep_id
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 14: handleGetExecutionAudit — on-demand com microstep_id");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_get_ms_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test",
    goal: "Testar endpoint de auditoria",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Endpoint de auditoria implementado", "Auditoria retorna resultado correto"],
  }), env);

  // Com microstep_id → MODO PRINCIPAL
  const rMs = await handleGetExecutionAudit(mockGetRequest("ctr_get_ms_001", "task_001"), env);
  assert(rMs.status === 200,
    "Smoke14: HTTP 200 com microstep_id");
  assert(rMs.body.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke14: audit_mode = 'microstep_anchored' via GET com microstep_id");
  assert(rMs.body.microstep_id === "task_001",
    "Smoke14: microstep_id = 'task_001' na resposta");
  assert(rMs.body.contract_microstep_reference !== null,
    "Smoke14: contract_microstep_reference presente");

  // Sem microstep_id → FALLBACK 2
  const rFallback = await handleGetExecutionAudit(mockGetRequest("ctr_get_ms_001"), env);
  assert(rFallback.status === 200,
    "Smoke14: HTTP 200 sem microstep_id");
  assert(rFallback.body.audit_mode === AUDIT_MODE.TASK_DECOMPOSITION,
    "Smoke14: audit_mode = 'task_decomposition' via GET sem microstep_id");
  assert(rFallback.body.microstep_id === null,
    "Smoke14: microstep_id = null no FALLBACK 2");

  // 404
  const r404 = await handleGetExecutionAudit(mockGetRequest("nao_existe_ms_001"), env);
  assert(r404.status === 404, "Smoke14: HTTP 404 para contrato inexistente");

  // 400 sem contract_id
  const r400 = await handleGetExecutionAudit({ url: "https://nv-enavia.workers.dev/contracts/execution-audit" }, env);
  assert(r400.status === 400, "Smoke14: HTTP 400 sem contract_id");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 15: não regressão PR1 — gate obrigatório por microetapa
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 15: não regressão PR1 — gate obrigatório por microetapa intacto");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_regression_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test",
    goal: "Regressão PR1",
    scope: { environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Regressão verificada"],
  }), env);
  await startTask(env, "ctr_regression_001", "task_001");

  // Gate PR1: resultado ausente → 400
  const r400 = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_001", task_id: "task_001",
  }), env);
  assert(r400.status === 400, "Smoke15-PR1: HTTP 400 quando resultado ausente");
  assert(r400.body.error === "ADHERENCE_GATE_REQUIRED", "Smoke15-PR1: ADHERENCE_GATE_REQUIRED intacto");

  // Gate PR1: parcial_desviado → 422
  const r422 = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_001", task_id: "task_001",
    resultado: {
      objetivo_atendido: true, criterio_aceite_atendido: false,
      escopo_efetivo: ["parcialmente feito"],
      is_simulado: false, is_mockado: false, is_local: false, is_parcial: true,
    },
  }), env);
  assert(r422.status === 422, "Smoke15-PR1: HTTP 422 quando parcial_desviado");
  assert(r422.body.error === "ADHERENCE_GATE_REJECTED", "Smoke15-PR1: ADHERENCE_GATE_REJECTED intacto");

  // Gate PR1 + PR2: aderente → 200 com microstep_anchored
  const r200 = await handleCompleteTask(mockRequest({
    contract_id: "ctr_regression_001", task_id: "task_001",
    resultado: {
      objetivo_atendido: true, criterio_aceite_atendido: true,
      escopo_efetivo: ["regressão verificada"],
      is_simulado: false, is_mockado: false, is_local: false, is_parcial: false,
    },
    executor_artifacts: ARTIFACTS_ADERENTE,
  }), env);
  assert(r200.status === 200, "Smoke15: HTTP 200 quando aderente");
  assert(r200.body.adherence_status === "aderente_ao_contrato", "Smoke15-PR1: PR1 gate intacto");
  assert(r200.body.execution_audit !== undefined, "Smoke15-PR2: execution_audit presente");
  assert(r200.body.execution_audit.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke15-PR2: PR2 usa modo 'microstep_anchored'");
  assert(r200.body.execution_audit.microstep_id === "task_001",
    "Smoke15-PR2: microstep_id = 'task_001' — chave principal da auditoria");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 16: KV-persisted task_execution_log — ciclos reais persistidos
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 16: KV-persisted task_execution_log — ciclos reais persistidos");

import { executeCurrentMicroPr } from "../contract-executor.js";

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_log_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-log",
    goal: "Testar persistência do log de execuções",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Log de execução persistido", "Auditoria via log"],
  }), env);

  await startTask(env, "ctr_log_001", "task_001");

  // Executar o micro-PR para gerar um ciclo real no task_execution_log
  const execResult = await executeCurrentMicroPr(env, "ctr_log_001", {
    evidence: ["Módulo implementado com sucesso em TEST"],
  });

  assert(execResult.ok === true,
    "Smoke16: executeCurrentMicroPr completou com sucesso");

  // Verificar que o ciclo foi gravado em state.task_execution_log
  const logEntry = execResult.state.task_execution_log;
  assert(logEntry !== undefined && logEntry !== null,
    "Smoke16: task_execution_log existe no state após executeCurrentMicroPr");
  assert(Array.isArray(logEntry["task_001"]),
    "Smoke16: task_execution_log['task_001'] é um array");
  assert(logEntry["task_001"].length === 1,
    "Smoke16: task_execution_log['task_001'] tem 1 ciclo após primeira execução");
  assert(logEntry["task_001"][0].execution_status === "success",
    "Smoke16: ciclo registrado com status 'success'");
  assert(logEntry["task_001"][0].executor_artifacts === null,
    "Smoke16: executor_artifacts = null no ciclo antes de completeTask");

  // Marcar task como concluída COM executor_artifacts
  const completeResult = await handleCompleteTask(mockRequest({
    contract_id: "ctr_log_001",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido: true, criterio_aceite_atendido: true,
      escopo_efetivo: ["log de execução persistido"],
      is_simulado: false, is_mockado: false, is_local: false, is_parcial: false,
    },
    executor_artifacts: ARTIFACTS_ADERENTE,
  }), env);

  assert(completeResult.status === 200,
    "Smoke16: handleCompleteTask retorna 200");

  // Verificar que executor_artifacts foram persistidos no log
  const ea = completeResult.body.execution_audit;
  assert(ea.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke16: audit_mode = 'microstep_anchored' após completeTask");
  assert(ea.executor_artifacts_reference !== null,
    "Smoke16: executor_artifacts_reference não é null — persistido no log");
  assert(ea.execution_cycles_reference.total >= 1,
    "Smoke16: execution_cycles_reference.total >= 1 — ciclos do log");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 17: handleGetExecutionAudit resolve natively from task_execution_log
// Sem body manual — executor_artifacts resolvidos do KV
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 17: handleGetExecutionAudit — resolução nativa via task_execution_log (sem body manual)");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_log_002",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-log2",
    goal: "Auditoria sem body manual",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["Auditoria sem body manual resolvida"],
  }), env);

  await startTask(env, "ctr_log_002", "task_001");
  await executeCurrentMicroPr(env, "ctr_log_002", { evidence: ["Executado em TEST"] });

  // Marcar completa COM executor_artifacts (persiste no log)
  await handleCompleteTask(mockRequest({
    contract_id: "ctr_log_002",
    task_id:     "task_001",
    resultado: {
      objetivo_atendido: true, criterio_aceite_atendido: true,
      escopo_efetivo: ["auditoria sem body manual resolvida"],
      is_simulado: false, is_mockado: false, is_local: false, is_parcial: false,
    },
    executor_artifacts: ARTIFACTS_ADERENTE,
  }), env);

  // Chamar handleGetExecutionAudit SEM executor_artifacts no body
  // A auditoria deve resolver os artefatos do log (KV-persisted) nativamente
  const rNative = await handleGetExecutionAudit(mockGetRequest("ctr_log_002", "task_001"), env);

  assert(rNative.status === 200,
    "Smoke17: HTTP 200 sem executor_artifacts no body");
  assert(rNative.body.audit_mode === AUDIT_MODE.MICROSTEP,
    "Smoke17: audit_mode = 'microstep_anchored' via resolução nativa");
  assert(rNative.body.microstep_id === "task_001",
    "Smoke17: microstep_id = 'task_001'");
  assert(rNative.body.executor_artifacts_reference !== null,
    "Smoke17: executor_artifacts_reference não é null — resolvido nativamente do log (sem body)");
  assert(rNative.body.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE,
    "Smoke17: aderente_ao_contrato — artefatos resolvidos do log são aderentes");
  assert(rNative.body.execution_cycles_reference.total >= 1,
    "Smoke17: execution_cycles_reference.total >= 1 — ciclos do log");
}

// ────────────────────────────────────────────────────────────────────────────
// Smoke 18: múltiplas execuções (retries) → N ciclos no log
// ────────────────────────────────────────────────────────────────────────────
console.log("\nSmoke 18: múltiplas execuções (retries) — N ciclos persistidos no log");

{
  const kv  = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  await handleCreateContract(mockRequest({
    contract_id: "ctr_retry_001",
    version: "v1",
    created_at: "2026-04-12T00:00:00Z",
    operator: "test-retry",
    goal: "Testar N ciclos por microstep",
    scope: { workers: ["nv-enavia"], environments: ["TEST"] },
    constraints: { max_micro_prs: 3, require_human_approval_per_pr: false, test_before_prod: true, rollback_on_failure: true },
    definition_of_done: ["N ciclos persistidos"],
  }), env);

  await startTask(env, "ctr_retry_001", "task_001");

  // Primeira execução: falha
  await executeCurrentMicroPr(env, "ctr_retry_001", {
    simulate_failure: { code: "TEST_ERROR", message: "falha simulada", classification: "in_scope" },
  });

  // Retomar task (necessário para nova execução)
  await startTask(env, "ctr_retry_001", "task_001");

  // Segunda execução: sucesso
  await executeCurrentMicroPr(env, "ctr_retry_001", {
    evidence: ["Executado com sucesso na retentativa"],
  });

  // Verificar que há 2 ciclos no log após 2 execuções
  const rAudit = await handleGetExecutionAudit(mockGetRequest("ctr_retry_001", "task_001"), env);
  assert(rAudit.status === 200,
    "Smoke18: HTTP 200");
  assert(rAudit.body.execution_cycles_reference.total === 2,
    "Smoke18: execution_cycles_reference.total = 2 após falha + sucesso");
  assert(rAudit.body.execution_cycles_reference.failed === 1,
    "Smoke18: 1 ciclo com status 'failed'");
  assert(rAudit.body.execution_cycles_reference.successful === 1,
    "Smoke18: 1 ciclo com status 'success'");
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
