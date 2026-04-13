// ============================================================================
// 🧪 Testes de Integração Real — PR1: Emissão real mínima de eventos do executor
//
// Run: node tests/exec-event.smoke.test.js
//
// Prova que a execução REAL de executeCurrentMicroPr emite e persiste
// os 6 campos canônicos em KV (contract:<id>:exec_event) e que readExecEvent
// os devolve corretamente.
//
// Usa mock KV idêntico ao de contracts-smoke.test.js — mesmo padrão do projeto.
//
// Tests (execução real com mock KV):
//   Group 1: Execução real SUCCESS → emite 6 campos no KV
//   Group 2: Execução real FAILED  → emite 6 campos + motivo_curto no KV
//   Group 3: Execução real RUNNING → emite evento imediatamente ao iniciar
//   Group 4: Sequência running→success — último evento é success
//   Group 5: readExecEvent sem execução → retorna null
//   Group 6: Isolamento — evento real não contém campos de autonomia/gate
//   Group 7: JSON round-trip — evento persiste e relê corretamente
// ============================================================================

import {
  handleCreateContract,
  advanceContractPhase,
  startTask,
  executeCurrentMicroPr,
  readExecEvent,
  buildExecEvent,
  KV_SUFFIX_EXEC_EVENT,
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
// Mock KV store — idêntico ao usado em contracts-smoke.test.js
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
// Contrato mínimo para testes de execução real
// ---------------------------------------------------------------------------
const BASE_PAYLOAD = {
  version: "v1",
  operator: "test-pr1",
  goal: "Prove exec_event emission for PR1",
  scope: {
    workers: ["nv-enavia"],
    routes: ["/test-route"],
    environments: ["TEST", "PROD"],
  },
  definition_of_done: [
    "exec_event emitted with 6 fields",
    "readExecEvent returns event",
  ],
};

// Monta env + contrato + avança até task_001 in_progress
// Retorna { env, contractId } pronto para chamar executeCurrentMicroPr
async function setupReadyContract(contractId) {
  const env = { ENAVIA_BRAIN: createMockKV() };
  const req = mockRequest({ ...BASE_PAYLOAD, contract_id: contractId });
  await handleCreateContract(req, env);
  await advanceContractPhase(env, contractId);
  await startTask(env, contractId, "task_001");
  return { env, contractId };
}

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

async function runTests() {

  // ---- Group 1: Execução real SUCCESS → 6 campos emitidos no KV ----
  console.log("\nGroup 1: Execução real SUCCESS — 6 campos emitidos no KV");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g1");

    const result = await executeCurrentMicroPr(env, contractId, {
      evidence: ["Smoke test passed", "Endpoint 200"],
    });

    assert(result.ok === true, "G1: execução real retornou ok=true");
    assert(result.execution_status === "success", "G1: execution_status=success");

    // Ler o evento do KV via readExecEvent (caminho canônico para PR2/PR3)
    const event = await readExecEvent(env, contractId);

    assert(event !== null, "G1: readExecEvent retornou evento não-null");
    assert(typeof event === "object", "G1: evento é objeto");

    // Os 6 campos canônicos do contrato PR1:
    assert("status_atual"   in event, "G1: campo status_atual presente");
    assert("arquivo_atual"  in event, "G1: campo arquivo_atual presente");
    assert("bloco_atual"    in event, "G1: campo bloco_atual presente");
    assert("operacao_atual" in event, "G1: campo operacao_atual presente");
    assert("motivo_curto"   in event, "G1: campo motivo_curto presente");
    assert("patch_atual"    in event, "G1: campo patch_atual presente");

    // Valores reais — derivados do fluxo real do executor
    assert(event.status_atual === "success",
      "G1: status_atual=success (runtime real)");
    assert(typeof event.arquivo_atual === "string" && event.arquivo_atual.includes("nv-enavia.js"),
      `G1: arquivo_atual contém 'nv-enavia.js' (valor real: '${event.arquivo_atual}')`);
    assert(event.bloco_atual === "task_001",
      `G1: bloco_atual=task_001 (valor real: '${event.bloco_atual}')`);
    assert(typeof event.operacao_atual === "string" && event.operacao_atual.length > 0,
      `G1: operacao_atual é string não-vazia (valor real: '${event.operacao_atual}')`);
    assert(event.motivo_curto === null,
      "G1: motivo_curto=null em success");
    assert(event.patch_atual === "micro_pr_001",
      `G1: patch_atual=micro_pr_001 (valor real: '${event.patch_atual}')`);
  }

  // ---- Group 2: Execução real FAILED → 6 campos + motivo_curto no KV ----
  console.log("\nGroup 2: Execução real FAILED — 6 campos + motivo_curto no KV");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g2");

    const result = await executeCurrentMicroPr(env, contractId, {
      simulate_failure: {
        code: "EXECUTION_FAILED",
        message: "Timeout after 30s waiting for worker response",
        classification: "in_scope",
      },
    });

    assert(result.ok === false, "G2: execução com falha simulada retornou ok=false");
    assert(result.execution_status === "failed", "G2: execution_status=failed");

    const event = await readExecEvent(env, contractId);

    assert(event !== null, "G2: readExecEvent retornou evento não-null em falha");

    // 6 campos presentes
    assert("status_atual"   in event, "G2: campo status_atual presente");
    assert("arquivo_atual"  in event, "G2: campo arquivo_atual presente");
    assert("bloco_atual"    in event, "G2: campo bloco_atual presente");
    assert("operacao_atual" in event, "G2: campo operacao_atual presente");
    assert("motivo_curto"   in event, "G2: campo motivo_curto presente");
    assert("patch_atual"    in event, "G2: campo patch_atual presente");

    // Valores reais em falha
    assert(event.status_atual === "failed",
      "G2: status_atual=failed (runtime real)");
    assert(event.bloco_atual === "task_001",
      `G2: bloco_atual=task_001 (valor real: '${event.bloco_atual}')`);
    assert(event.patch_atual === "micro_pr_001",
      `G2: patch_atual=micro_pr_001 (valor real: '${event.patch_atual}')`);
    assert(typeof event.motivo_curto === "string" && event.motivo_curto.length > 0,
      `G2: motivo_curto é string não-vazia em falha (valor real: '${event.motivo_curto}')`);
    assert(event.motivo_curto.includes("Timeout"),
      `G2: motivo_curto contém mensagem real de erro (valor: '${event.motivo_curto}')`);
    assert(event.motivo_curto.length <= 120,
      "G2: motivo_curto limitado a 120 chars");
  }

  // ---- Group 3: Evento RUNNING emitido ANTES do persist do state ----
  console.log("\nGroup 3: Evento running emitido imediatamente ao iniciar execução");
  {
    // Interceptamos a escrita no KV para capturar o evento 'running'
    const { env: baseEnv, contractId } = await setupReadyContract("pr1_exec_g3");

    const runningEvents = [];
    const origPut = baseEnv.ENAVIA_BRAIN.put.bind(baseEnv.ENAVIA_BRAIN);

    // Wrapper: captura o evento exec_event quando emitido
    const envSpy = {
      ENAVIA_BRAIN: {
        ...baseEnv.ENAVIA_BRAIN,
        async put(key, value) {
          if (key.endsWith(KV_SUFFIX_EXEC_EVENT)) {
            try { runningEvents.push(JSON.parse(value)); } catch (_) {}
          }
          return origPut(key, value);
        },
      },
    };

    await executeCurrentMicroPr(envSpy, contractId, { evidence: ["ok"] });

    // Deve ter ao menos 2 escritas no exec_event: running e success
    assert(runningEvents.length >= 2,
      `G3: emitiu pelo menos 2 eventos (running + success), emitiu: ${runningEvents.length}`);

    const firstEvent = runningEvents[0];
    assert(firstEvent.status_atual === "running",
      `G3: primeiro evento emitido tem status_atual=running (valor: '${firstEvent.status_atual}')`);

    const lastEvent = runningEvents[runningEvents.length - 1];
    assert(lastEvent.status_atual === "success",
      `G3: último evento emitido tem status_atual=success (valor: '${lastEvent.status_atual}')`);
  }

  // ---- Group 4: Sequência — último evento no KV é o final (success) ----
  console.log("\nGroup 4: Após execução completa, readExecEvent retorna o evento final");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g4");

    await executeCurrentMicroPr(env, contractId, { evidence: ["final check"] });

    const event = await readExecEvent(env, contractId);

    // O KV deve conter o evento final (success), não o intermediário (running)
    assert(event !== null, "G4: evento final presente no KV");
    assert(event.status_atual === "success",
      `G4: evento final no KV é success, não running (valor: '${event.status_atual}')`);
    assert(event.bloco_atual === "task_001",
      "G4: bloco_atual preservado no evento final");
    assert(event.patch_atual === "micro_pr_001",
      "G4: patch_atual preservado no evento final");
  }

  // ---- Group 5: readExecEvent sem execução → retorna null ----
  console.log("\nGroup 5: readExecEvent antes de qualquer execução retorna null");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g5");

    // Não chamar executeCurrentMicroPr — nenhum evento deve existir
    const event = await readExecEvent(env, contractId);

    assert(event === null,
      "G5: readExecEvent retorna null quando nenhuma execução ocorreu");
  }

  // ---- Group 6: Isolamento — evento real não contém campos proibidos ----
  console.log("\nGroup 6: Evento real não contém campos de autonomia ou gate");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g6");
    await executeCurrentMicroPr(env, contractId, { evidence: ["isolation check"] });

    const event = await readExecEvent(env, contractId);

    assert(event !== null, "G6: evento presente");
    assert(!("approved_by"  in event), "G6: não contém approved_by (gate humano)");
    assert(!("rejected_by"  in event), "G6: não contém rejected_by");
    assert(!("auto_promote" in event), "G6: não contém auto_promote (autonomia proibida)");
    assert(!("deploy"       in event), "G6: não contém deploy");
    assert(!("planner"      in event), "G6: não contém planner");
    assert(!("bridge"       in event), "G6: não contém bridge");
    assert(!("github"       in event), "G6: não contém github");
    assert(!("browser"      in event), "G6: não contém browser");
  }

  // ---- Group 7: JSON round-trip — evento persiste e relê corretamente ----
  console.log("\nGroup 7: JSON round-trip — evento sobrevive serialização KV");
  {
    const { env, contractId } = await setupReadyContract("pr1_exec_g7");
    await executeCurrentMicroPr(env, contractId, { evidence: ["round-trip check"] });

    const event = await readExecEvent(env, contractId);

    assert(event !== null, "G7: evento presente");

    // Simular round-trip KV (JSON stringify → parse)
    let rt;
    let serializable = true;
    try { rt = JSON.parse(JSON.stringify(event)); } catch (_) { serializable = false; }

    assert(serializable,                                  "G7: evento sobrevive JSON round-trip");
    assert(rt.status_atual   === event.status_atual,     "G7: status_atual preservado");
    assert(rt.arquivo_atual  === event.arquivo_atual,    "G7: arquivo_atual preservado");
    assert(rt.bloco_atual    === event.bloco_atual,      "G7: bloco_atual preservado");
    assert(rt.operacao_atual === event.operacao_atual,   "G7: operacao_atual preservado");
    assert(rt.motivo_curto   === event.motivo_curto,     "G7: motivo_curto preservado");
    assert(rt.patch_atual    === event.patch_atual,      "G7: patch_atual preservado");
    assert(rt.emitted_at     === event.emitted_at,       "G7: emitted_at preservado");
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
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});

