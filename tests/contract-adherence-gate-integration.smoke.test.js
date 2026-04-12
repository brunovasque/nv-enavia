// ============================================================================
// 🧪 Smoke Tests de Integração — Contract Adherence Gate (Blindagem Contratual PR 1)
//
// Prova que o gate de aderência contratual é OBRIGATÓRIO no fluxo real.
// O gate vive em handleCompleteTask (POST /contracts/complete-task).
//
// Run: node tests/contract-adherence-gate-integration.smoke.test.js
//
// Cenários:
//   Smoke 1: aderente_ao_contrato → permite conclusão (task_status = completed)
//   Smoke 2: parcial_desviado     → bloqueia conclusão (ADHERENCE_GATE_REJECTED)
//   Smoke 3: fora_do_contrato     → bloqueia conclusão (ADHERENCE_GATE_REJECTED)
//   Smoke 4: resultado ausente    → gate não pode ser ignorado (ADHERENCE_GATE_REQUIRED)
//   Smoke 5: regressão do fluxo existente — completeTaskInternal direto ainda funciona
// ============================================================================

import {
  handleCompleteTask,
  handleCreateContract,
  startTask,
  completeTaskInternal,
  rehydrateContract,
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

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const VALID_PAYLOAD = {
  contract_id: "ctr_gate_integration_001",
  version: "v1",
  created_at: "2026-04-12T00:00:00Z",
  operator: "test-gate-operator",
  goal: "Testar gate obrigatório de aderência contratual",
  scope: {
    workers: ["nv-enavia"],
    routes: ["/contracts/complete-task"],
    environments: ["TEST"],
  },
  constraints: {
    max_micro_prs: 2,
    require_human_approval_per_pr: false,
    test_before_prod: true,
    rollback_on_failure: true,
  },
  definition_of_done: [
    "Gate de aderência contratual implementado e obrigatório",
    "Smoke tests de integração passando",
  ],
  context: {
    notes: "Contrato de teste para blindagem contratual PR1",
  },
};

// MicrostepResultado: aderente — todos os flags em false, objetivos atendidos
const resultadoAderente = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["gate de aderência implementado"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// MicrostepResultado: parcial_desviado — entrega parcial e critério não atendido
const resultadoParcial = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: false,  // critério de aceite não atendido
  escopo_efetivo:           ["gate parcialmente implementado"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               true,  // entrega parcial
};

// MicrostepResultado: fora_do_contrato — objetivo não atendido
const resultadoForaContrato = {
  objetivo_atendido:        false,  // objetivo não atendido
  criterio_aceite_atendido: false,
  escopo_efetivo:           ["algo completamente diferente"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// MicrostepContract explícito para proibir escopo
const contractMicrostepExplicito = {
  objetivo_contratual_exato:  "Gate de aderência contratual implementado e obrigatório",
  escopo_permitido:           ["gate de aderência implementado", "smoke tests passando"],
  escopo_proibido:            ["implementação simulada", "mock sem integração real"],
  criterio_de_aceite_literal: "Gate bloqueia conclusão quando resultado não é aderente",
};

// ============================================================================
// SMOKE TEST SUITE
// ============================================================================

async function runTests() {
  console.log("\n🛡️ Blindagem Contratual PR1 — Integration Smoke Tests\n");
  console.log("Prova que handleCompleteTask impõe o gate obrigatoriamente.\n");

  // ─────────────────────────────────────────────────────────────────────────
  // Smoke 1: aderente_ao_contrato → permite conclusão
  // ─────────────────────────────────────────────────────────────────────────
  console.log("Smoke 1: aderente_ao_contrato → permite conclusão da task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    // Setup: criar contrato e colocar task em in_progress
    await handleCreateContract(mockRequest(VALID_PAYLOAD), env);
    await startTask(env, "ctr_gate_integration_001", "task_001");

    const result = await handleCompleteTask(mockRequest({
      contract_id: "ctr_gate_integration_001",
      task_id:     "task_001",
      resultado:   resultadoAderente,
    }), env);

    assert(result.status === 200,
      "Smoke1: HTTP 200 quando aderente_ao_contrato");
    assert(result.body.ok === true,
      "Smoke1: ok=true quando aderente_ao_contrato");
    assert(result.body.task_status === "completed",
      "Smoke1: task_status = 'completed' quando aderente");
    assert(result.body.adherence_status === "aderente_ao_contrato",
      "Smoke1: adherence_status = 'aderente_ao_contrato' na resposta");
    assert(result.body.can_mark_concluded === true,
      "Smoke1: can_mark_concluded = true na resposta");
    assert(result.body.honest_status === "concluido",
      "Smoke1: honest_status = 'concluido'");

    // Verificar persistência real
    const { decomposition } = await rehydrateContract(env, "ctr_gate_integration_001");
    const task = decomposition.tasks.find(t => t.id === "task_001");
    assert(task.status === "completed",
      "Smoke1: task persiste como 'completed' no KV");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smoke 2: parcial_desviado → bloqueia conclusão
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSmoke 2: parcial_desviado → bloqueia conclusão da task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    await handleCreateContract(mockRequest({ ...VALID_PAYLOAD, contract_id: "ctr_gate_parcial_001" }), env);
    await startTask(env, "ctr_gate_parcial_001", "task_001");

    const result = await handleCompleteTask(mockRequest({
      contract_id: "ctr_gate_parcial_001",
      task_id:     "task_001",
      resultado:   resultadoParcial,
    }), env);

    assert(result.status === 422,
      "Smoke2: HTTP 422 quando parcial_desviado");
    assert(result.body.ok === false,
      "Smoke2: ok=false quando parcial_desviado");
    assert(result.body.error === "ADHERENCE_GATE_REJECTED",
      "Smoke2: error = 'ADHERENCE_GATE_REJECTED'");
    assert(result.body.adherence_status === "parcial_desviado",
      "Smoke2: adherence_status = 'parcial_desviado' na resposta");
    assert(result.body.can_mark_concluded === false,
      "Smoke2: can_mark_concluded = false");
    assert(Array.isArray(result.body.campos_falhos) && result.body.campos_falhos.length > 0,
      "Smoke2: campos_falhos não vazio — gate auditável");
    assert(result.body.honest_status !== "concluido",
      "Smoke2: honest_status ≠ 'concluido' quando parcial");

    // Garantir que task NÃO foi marcada como completed
    const { decomposition } = await rehydrateContract(env, "ctr_gate_parcial_001");
    const task = decomposition.tasks.find(t => t.id === "task_001");
    assert(task.status !== "completed",
      "Smoke2: task NÃO foi persistida como 'completed' — gate bloqueou corretamente");
    assert(task.status === "in_progress",
      "Smoke2: task permanece 'in_progress' após bloqueio");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smoke 3: fora_do_contrato → bloqueia conclusão
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSmoke 3: fora_do_contrato → bloqueia conclusão da task");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    await handleCreateContract(mockRequest({ ...VALID_PAYLOAD, contract_id: "ctr_gate_fora_001" }), env);
    await startTask(env, "ctr_gate_fora_001", "task_001");

    // Com contrato explícito: entrega escopo proibido + objetivo não atendido
    const result = await handleCompleteTask(mockRequest({
      contract_id:       "ctr_gate_fora_001",
      task_id:           "task_001",
      resultado:         resultadoForaContrato,
      contract_microstep: contractMicrostepExplicito,
    }), env);

    assert(result.status === 422,
      "Smoke3: HTTP 422 quando fora_do_contrato");
    assert(result.body.ok === false,
      "Smoke3: ok=false quando fora_do_contrato");
    assert(result.body.error === "ADHERENCE_GATE_REJECTED",
      "Smoke3: error = 'ADHERENCE_GATE_REJECTED'");
    assert(result.body.adherence_status === "fora_do_contrato",
      "Smoke3: adherence_status = 'fora_do_contrato'");
    assert(result.body.can_mark_concluded === false,
      "Smoke3: can_mark_concluded = false");
    assert(result.body.campos_falhos.some(c => c.includes("objetivo")),
      "Smoke3: campos_falhos registra falha de objetivo");
    assert(typeof result.body.next_action === "string",
      "Smoke3: next_action presente e auditável");

    // Task deve permanecer in_progress
    const { decomposition } = await rehydrateContract(env, "ctr_gate_fora_001");
    const task = decomposition.tasks.find(t => t.id === "task_001");
    assert(task.status !== "completed",
      "Smoke3: task NÃO foi persistida como 'completed' — gate bloqueou corretamente");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smoke 4: resultado ausente → gate é incontornável (ADHERENCE_GATE_REQUIRED)
  // Prova que o fluxo real passa obrigatoriamente pelo gate
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSmoke 4: resultado ausente → gate não pode ser ignorado");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    await handleCreateContract(mockRequest({ ...VALID_PAYLOAD, contract_id: "ctr_gate_bypass_001" }), env);
    await startTask(env, "ctr_gate_bypass_001", "task_001");

    // Tentar completar sem fornecer resultado
    const resultSemResultado = await handleCompleteTask(mockRequest({
      contract_id: "ctr_gate_bypass_001",
      task_id:     "task_001",
      // resultado ausente — tentativa de bypass
    }), env);

    assert(resultSemResultado.status === 400,
      "Smoke4: HTTP 400 quando resultado ausente (gate obrigatório)");
    assert(resultSemResultado.body.ok === false,
      "Smoke4: ok=false quando resultado ausente");
    assert(resultSemResultado.body.error === "ADHERENCE_GATE_REQUIRED",
      "Smoke4: error = 'ADHERENCE_GATE_REQUIRED' — gate não pode ser bypassado");

    // Task permanece in_progress
    const { decomposition } = await rehydrateContract(env, "ctr_gate_bypass_001");
    const task = decomposition.tasks.find(t => t.id === "task_001");
    assert(task.status === "in_progress",
      "Smoke4: task permanece 'in_progress' — bypass impossível");

    // Tentar com resultado null
    const resultResultadoNull = await handleCompleteTask(mockRequest({
      contract_id: "ctr_gate_bypass_001",
      task_id:     "task_001",
      resultado:   null,
    }), env);

    assert(resultResultadoNull.body.error === "ADHERENCE_GATE_REQUIRED",
      "Smoke4: resultado=null também dispara ADHERENCE_GATE_REQUIRED");

    // Tentar com contract_id ausente
    const resultSemContractId = await handleCompleteTask(mockRequest({
      task_id:   "task_001",
      resultado: resultadoAderente,
    }), env);

    assert(resultSemContractId.status === 400,
      "Smoke4: HTTP 400 quando contract_id ausente");
    assert(resultSemContractId.body.error === "MISSING_PARAM",
      "Smoke4: error = MISSING_PARAM quando contract_id ausente");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Smoke 5: _gate_bypassed distinction — completeTaskInternal marks bypass;
  //          handleCompleteTask does NOT mark bypass (gate was enforced)
  // Garante que qualquer bypass é explícito e auditável
  // ─────────────────────────────────────────────────────────────────────────
  console.log("\nSmoke 5: _gate_bypassed distingue bypass interno de caminho oficial");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    await handleCreateContract(mockRequest({ ...VALID_PAYLOAD, contract_id: "ctr_gate_regression_001" }), env);
    await startTask(env, "ctr_gate_regression_001", "task_001");

    // completeTaskInternal — bypass explícito, deve marcar _gate_bypassed: true
    const resultInternal = await completeTaskInternal(env, "ctr_gate_regression_001", "task_001");
    assert(resultInternal.ok === true,
      "Smoke5: completeTaskInternal retorna ok=true");
    assert(resultInternal.task.status === "completed",
      "Smoke5: task_status = 'completed' via completeTaskInternal");
    assert(resultInternal._gate_bypassed === true,
      "Smoke5: _gate_bypassed = true — bypass via API interna é explícito e auditável");

    // Confirmar persistência
    const { decomposition } = await rehydrateContract(env, "ctr_gate_regression_001");
    const task = decomposition.tasks.find(t => t.id === "task_001");
    assert(task.status === "completed",
      "Smoke5: task persiste como completed via API interna");
  }
  {
    // handleCompleteTask (caminho oficial) NÃO deve ter _gate_bypassed
    const kv2 = createMockKV();
    const env2 = { ENAVIA_BRAIN: kv2 };

    await handleCreateContract(mockRequest({ ...VALID_PAYLOAD, contract_id: "ctr_gate_official_001" }), env2);
    await startTask(env2, "ctr_gate_official_001", "task_001");

    const resultOfficial = await handleCompleteTask(mockRequest({
      contract_id: "ctr_gate_official_001",
      task_id:     "task_001",
      resultado:   resultadoAderente,
    }), env2);

    assert(resultOfficial.body.ok === true,
      "Smoke5: handleCompleteTask retorna ok=true no caminho oficial");
    assert(resultOfficial.body._gate_bypassed !== true,
      "Smoke5: handleCompleteTask NÃO marca _gate_bypassed — gate foi executado, não bypassado");
    assert(resultOfficial.body.adherence_status === "aderente_ao_contrato",
      "Smoke5: adherence_status = 'aderente_ao_contrato' no caminho oficial");

    // Provar coexistência e distinção explícita
    assert(typeof handleCompleteTask === "function",
      "Smoke5: handleCompleteTask (gate obrigatório) é exportado");
    assert(typeof completeTaskInternal === "function",
      "Smoke5: completeTaskInternal (@internal, bypass explícito) também exportado");
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Summary
  // ─────────────────────────────────────────────────────────────────────────
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log("=".repeat(60));

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
