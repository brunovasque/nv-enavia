// ============================================================================
// 🧪 Smoke Tests — PR2: GET /execution lê a fonte real mínima da PR1
//
// Run: node tests/get-execution-exec-event.smoke.test.js
//
// Prova o caminho backend canônico introduzido na PR2:
//   GET /execution → lê execution:exec_event:latest_contract_id no KV
//                  → chama readExecEvent(env, contractId)
//                  → devolve execution.exec_event no payload de resposta
//
// Chama o worker real (nv-enavia.js export default { fetch }) com mock KV,
// idêntico ao padrão dos outros smoke tests do projeto.
//
// Casos cobertos:
//   Group 1: apenas exec_event no KV (sem trail bridge) → exec_event presente
//   Group 2: sem exec_event, sem trail → execution = null
//   Group 3: trail + exec_event → ambos mesclados no response
//   Group 4: pointer presente mas exec_event ausente no KV → fallback honesto
//   Group 5: isolamento — exec_event não contém campos de autonomia/gate/health
//   Group 6: exec_event com execução real (emitExecEvent → GET /execution)
// ============================================================================

import worker from "../nv-enavia.js";
import {
  readExecEvent,
  emitExecEvent,
  buildExecEvent,
  KV_SUFFIX_EXEC_EVENT,
  handleCreateContract,
  advanceContractPhase,
  startTask,
  executeCurrentMicroPr,
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
// Mock KV — mesmo padrão de contracts-smoke.test.js e exec-event.smoke.test.js
// ---------------------------------------------------------------------------
function createMockKV() {
  const store = {};
  return {
    async get(key, type) {
      const val = store[key] ?? null;
      if (type === "json" && val !== null) {
        try { return JSON.parse(val); } catch { return null; }
      }
      return val;
    },
    async put(key, value) { store[key] = value; },
    _store: store,
  };
}

// Helper — faz GET /execution no worker real com mock KV
async function getExecution(kv) {
  const env = { ENAVIA_BRAIN: kv };
  const req = new Request("https://test.enavia.io/execution", { method: "GET" });
  const res = await worker.fetch(req, env);
  return { status: res.status, body: await res.json() };
}

// Helper — executa fluxo completo para ter exec_event real no KV
async function setupReadyContract(kv, contractId) {
  const env = { ENAVIA_BRAIN: kv };
  const req = {
    async json() {
      return {
        version: "v1",
        operator: "smoke-pr2",
        goal: "Prove GET /execution reads exec_event",
        scope: {
          workers: ["nv-enavia"],
          routes: ["/execution"],
          environments: ["TEST"],
        },
        definition_of_done: ["exec_event present in GET /execution response"],
        contract_id: contractId,
      };
    },
  };
  await handleCreateContract(req, env);
  await advanceContractPhase(env, contractId);
  await startTask(env, contractId, "task_001");
}

// ---------------------------------------------------------------------------
// Fixture exec_event — shape canônico PR1
// ---------------------------------------------------------------------------
const FIXTURE_EXEC_EVENT = {
  status_atual:   "running",
  arquivo_atual:  "contract-executor.js",
  bloco_atual:    "task_pr2_smoke",
  operacao_atual: "Testando caminho GET /execution → exec_event",
  motivo_curto:   null,
  patch_atual:    "micro_pr_pr2",
  emitted_at:     "2026-04-13T17:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

async function runTests() {

  // ---- Group 1: apenas exec_event no KV — GET /execution retorna exec_event ----
  console.log("\nGroup 1: exec_event no KV (sem trail) → execution.exec_event presente");
  {
    const kv = createMockKV();
    const contractId = "pr2_g1_smoke";

    // Gravar exec_event manualmente — simula o que emitExecEvent faz
    const eventKey = `contract:${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    await kv.put(eventKey, JSON.stringify(FIXTURE_EXEC_EVENT));
    await kv.put("execution:exec_event:latest_contract_id", contractId);

    const { status, body } = await getExecution(kv);

    assert(status === 200,               "G1: GET /execution retorna HTTP 200");
    assert(body.ok === true,             "G1: body.ok = true");
    assert(body.execution !== null,      "G1: execution não é null");
    assert(typeof body.execution === "object", "G1: execution é objeto");
    assert("exec_event" in body.execution,     "G1: exec_event presente em execution");
    assert(body.execution.exec_event !== null, "G1: exec_event não é null");

    const ev = body.execution.exec_event;
    assert(ev.status_atual   === "running",                            "G1: exec_event.status_atual correto");
    assert(ev.arquivo_atual  === "contract-executor.js",               "G1: exec_event.arquivo_atual correto");
    assert(ev.bloco_atual    === "task_pr2_smoke",                     "G1: exec_event.bloco_atual correto");
    assert(ev.operacao_atual === "Testando caminho GET /execution → exec_event", "G1: exec_event.operacao_atual correto");
    assert(ev.motivo_curto   === null,                                 "G1: exec_event.motivo_curto = null (running)");
    assert(ev.patch_atual    === "micro_pr_pr2",                       "G1: exec_event.patch_atual correto");
    assert(ev.emitted_at     === "2026-04-13T17:00:00.000Z",          "G1: exec_event.emitted_at correto");
  }

  // ---- Group 2: KV vazio — GET /execution retorna null honesto ----
  console.log("\nGroup 2: KV vazio (sem trail, sem exec_event) → execution = null");
  {
    const kv = createMockKV();

    const { status, body } = await getExecution(kv);

    assert(status === 200,          "G2: GET /execution retorna HTTP 200");
    assert(body.ok === true,        "G2: body.ok = true");
    assert(body.execution === null, "G2: execution = null (fallback honesto)");
    assert(!("exec_event" in (body.execution ?? {})), "G2: exec_event ausente quando KV vazio");
  }

  // ---- Group 3: trail + exec_event — ambos presentes no response ----
  console.log("\nGroup 3: trail + exec_event → ambos mesclados em execution");
  {
    const kv = createMockKV();
    const contractId = "pr2_g3_smoke";

    // Gravar trail de bridge
    const trail = {
      bridge_id:      "bridge-pr2-g3",
      dispatched_at:  "2026-04-13T16:59:00.000Z",
      session_id:     "sess-pr2-g3",
      source:         "planner_bridge",
      steps_count:    2,
      executor_ok:    true,
      executor_status: 200,
      executor_error:  null,
    };
    await kv.put("execution:trail:latest", JSON.stringify(trail));

    // Gravar exec_event
    const eventKey = `contract:${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    await kv.put(eventKey, JSON.stringify(FIXTURE_EXEC_EVENT));
    await kv.put("execution:exec_event:latest_contract_id", contractId);

    const { status, body } = await getExecution(kv);

    assert(status === 200,          "G3: GET /execution retorna HTTP 200");
    assert(body.ok === true,        "G3: body.ok = true");
    assert(body.execution !== null, "G3: execution não é null");

    // Campos da trail devem estar presentes
    assert(body.execution.bridge_id      === "bridge-pr2-g3",        "G3: bridge_id da trail preservado");
    assert(body.execution.executor_ok    === true,                    "G3: executor_ok da trail preservado");
    assert(body.execution.executor_status === 200,                    "G3: executor_status da trail preservado");

    // exec_event deve estar mesclado
    assert("exec_event" in body.execution,                            "G3: exec_event mesclado em execution");
    assert(body.execution.exec_event.status_atual === "running",      "G3: exec_event.status_atual correto via merge");
    assert(body.execution.exec_event.arquivo_atual === "contract-executor.js", "G3: exec_event.arquivo_atual correto via merge");
  }

  // ---- Group 4: pointer presente mas exec_event ausente no KV ----
  console.log("\nGroup 4: pointer latest_contract_id existe mas exec_event ausente → fallback honesto");
  {
    const kv = createMockKV();

    // Gravar só o pointer, sem o exec_event real
    await kv.put("execution:exec_event:latest_contract_id", "contrato-fantasma");
    // exec_event key correspondente não existe no KV

    const { status, body } = await getExecution(kv);

    assert(status === 200,          "G4: GET /execution retorna HTTP 200 (não crasha)");
    assert(body.ok === true,        "G4: body.ok = true (fallback honesto)");
    assert(body.execution === null, "G4: execution = null quando exec_event ausente e trail ausente");
  }

  // ---- Group 5: isolamento — exec_event não contém campos de autonomia/gate/health ----
  console.log("\nGroup 5: isolamento — exec_event não contém campos fora do contrato PR1");
  {
    const kv = createMockKV();
    const contractId = "pr2_g5_smoke";

    const eventKey = `contract:${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    await kv.put(eventKey, JSON.stringify(FIXTURE_EXEC_EVENT));
    await kv.put("execution:exec_event:latest_contract_id", contractId);

    const { body } = await getExecution(kv);
    const ev = body.execution.exec_event;

    // Campos que NÃO devem existir (autonomia, gate, health — fora do escopo PR1/PR2)
    assert(!("approved_by"       in ev), "G5: exec_event não contém approved_by (gate)");
    assert(!("rejected_by"       in ev), "G5: exec_event não contém rejected_by (gate)");
    assert(!("health_score"      in ev), "G5: exec_event não contém health_score (health)");
    assert(!("autonomy_level"    in ev), "G5: exec_event não contém autonomy_level (autonomia)");
    assert(!("planner_decision"  in ev), "G5: exec_event não contém planner_decision (planner)");
    assert(!("bridge_id"         in ev), "G5: exec_event não contém bridge_id (bridge — pertence à trail)");

    // Os 6 campos canônicos do contrato PR1 devem estar presentes
    assert("status_atual"   in ev, "G5: exec_event contém status_atual (contrato PR1)");
    assert("arquivo_atual"  in ev, "G5: exec_event contém arquivo_atual (contrato PR1)");
    assert("bloco_atual"    in ev, "G5: exec_event contém bloco_atual (contrato PR1)");
    assert("operacao_atual" in ev, "G5: exec_event contém operacao_atual (contrato PR1)");
    assert("motivo_curto"   in ev, "G5: exec_event contém motivo_curto (contrato PR1)");
    assert("patch_atual"    in ev, "G5: exec_event contém patch_atual (contrato PR1)");
  }

  // ---- Group 6: execução real via executeCurrentMicroPr → GET /execution ----
  console.log("\nGroup 6: execução real (executeCurrentMicroPr) → pointer gravado → GET /execution devolve exec_event");
  {
    const kv = createMockKV();
    const contractId = "pr2_g6_real";
    await setupReadyContract(kv, contractId);
    const env = { ENAVIA_BRAIN: kv };

    // Executa o fluxo real — emitExecEvent será chamado (com pointer PR2)
    const execResult = await executeCurrentMicroPr(env, contractId, {
      evidence: ["Smoke test G6 — pr2 real path"],
    });

    assert(execResult.ok === true, "G6: executeCurrentMicroPr retornou ok=true");

    // Verificar que o pointer foi gravado por emitExecEvent
    const pointer = await kv.get("execution:exec_event:latest_contract_id");
    assert(pointer === contractId, "G6: pointer latest_contract_id gravado com contractId correto");

    // Verificar via readExecEvent que o evento existe
    const directEvent = await readExecEvent(env, contractId);
    assert(directEvent !== null,         "G6: readExecEvent retornou evento não-null");
    assert("status_atual" in directEvent, "G6: evento tem status_atual");

    // Agora provar via GET /execution real que exec_event aparece no payload
    const { status, body } = await getExecution(kv);

    assert(status === 200,                        "G6: GET /execution retorna 200");
    assert(body.ok === true,                      "G6: GET /execution retorna ok=true");
    assert(body.execution !== null,               "G6: execution não é null após execução real");
    assert("exec_event" in body.execution,        "G6: exec_event presente no payload de GET /execution");
    assert(body.execution.exec_event !== null,    "G6: exec_event não é null");

    const ev = body.execution.exec_event;
    assert("status_atual"   in ev, "G6: exec_event.status_atual presente (6 campos PR1)");
    assert("arquivo_atual"  in ev, "G6: exec_event.arquivo_atual presente");
    assert("bloco_atual"    in ev, "G6: exec_event.bloco_atual presente");
    assert("operacao_atual" in ev, "G6: exec_event.operacao_atual presente");
    assert("motivo_curto"   in ev, "G6: exec_event.motivo_curto presente");
    assert("patch_atual"    in ev, "G6: exec_event.patch_atual presente");

    // O evento da execução real deve ser success (micro-PR aplicada)
    assert(ev.status_atual === "success", "G6: exec_event.status_atual = 'success' (execução real concluída)");

    // exec_event no response deve coincidir com o lido via readExecEvent diretamente
    assert(ev.status_atual   === directEvent.status_atual,   "G6: exec_event.status_atual via GET = via readExecEvent");
    assert(ev.arquivo_atual  === directEvent.arquivo_atual,  "G6: exec_event.arquivo_atual via GET = via readExecEvent");
    assert(ev.patch_atual    === directEvent.patch_atual,    "G6: exec_event.patch_atual via GET = via readExecEvent");
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
  console.error("Unhandled error:", err);
  process.exit(1);
});
