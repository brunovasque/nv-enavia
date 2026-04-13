// ============================================================================
// 🧪 Smoke Tests — PR3: GET /health lê a fonte real mínima da PR1
//
// Run: node tests/get-health-exec-event.smoke.test.js
//
// Prova o caminho backend canônico introduzido na PR3:
//   GET /health → lê execution:exec_event:latest_contract_id no KV
//               → chama readExecEvent(env, contractId)
//               → devolve health com os 4 grupos mínimos:
//                   1. contadores reais
//                   2. erros recentes reais
//                   3. bloqueadas ([] honesto — não disponível na fonte PR1)
//                   4. concluídas reais
//
// Chama o worker real (nv-enavia.js export default { fetch }) com mock KV,
// idêntico ao padrão dos outros smoke tests do projeto (PR1, PR2).
//
// Casos cobertos:
//   Group 1: sem KV / sem exec_event → fallback idle honesto
//   Group 2: exec_event success → contadores + concluídas reais
//   Group 3: exec_event failed/error → contadores + erros recentes reais
//   Group 4: exec_event running → contadores + running honesto
//   Group 5: blockedExecutions sempre [] (honesto — fonte PR1 não registra bloqueios)
//   Group 6: execução real via executeCurrentMicroPr → pointer gravado → health real
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

// Helper — faz GET /health no worker real com mock KV
async function getHealth(kv) {
  const env = { ENAVIA_BRAIN: kv };
  const req = new Request("https://test.enavia.io/health", { method: "GET" });
  const res = await worker.fetch(req, env);
  return { status: res.status, body: await res.json() };
}

// Helper — prepara contrato pronto para execução real
async function setupReadyContract(kv, contractId) {
  const env = { ENAVIA_BRAIN: kv };
  const req = {
    async json() {
      return {
        version: "v1",
        operator: "smoke-pr3-health",
        goal: "Prove GET /health reads exec_event",
        scope: {
          workers: ["nv-enavia"],
          routes: ["/health"],
          environments: ["TEST"],
        },
        definition_of_done: ["health endpoint reflects exec_event real data"],
        contract_id: contractId,
      };
    },
  };
  await handleCreateContract(req, env);
  await advanceContractPhase(env, contractId);
  await startTask(env, contractId, "task_001");
}

// ---------------------------------------------------------------------------
// Fixtures exec_event — shapes canônicos PR1 (6 campos + emitted_at)
// ---------------------------------------------------------------------------

const FIXTURE_SUCCESS = {
  status_atual:   "success",
  arquivo_atual:  "nv-enavia.js",
  bloco_atual:    "task_pr3_smoke",
  operacao_atual: "Plug /health com fonte real PR1",
  motivo_curto:   null,
  patch_atual:    "micro_pr_003",
  emitted_at:     "2026-04-13T18:00:00.000Z",
};

const FIXTURE_FAILED = {
  status_atual:   "failed",
  arquivo_atual:  "nv-enavia.js",
  bloco_atual:    "task_pr3_smoke",
  operacao_atual: "Plug /health com fonte real PR1",
  motivo_curto:   "Timeout after 30s waiting for executor response",
  patch_atual:    "micro_pr_003",
  emitted_at:     "2026-04-13T18:00:00.000Z",
};

const FIXTURE_RUNNING = {
  status_atual:   "running",
  arquivo_atual:  "nv-enavia.js",
  bloco_atual:    "task_pr3_smoke",
  operacao_atual: "Plug /health com fonte real PR1",
  motivo_curto:   null,
  patch_atual:    "micro_pr_003",
  emitted_at:     "2026-04-13T18:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

async function runTests() {

  // ---- Group 1: sem exec_event no KV → fallback idle honesto ----
  console.log("\nGroup 1: sem exec_event no KV → fallback idle honesto");
  {
    const kv = createMockKV();

    const { status, body } = await getHealth(kv);

    assert(status === 200,                "G1: GET /health retorna HTTP 200");
    assert(body.ok === true,              "G1: body.ok = true");
    assert(body.health !== undefined,     "G1: body.health presente");
    assert(body.health.status === "idle", "G1: health.status = 'idle' (fallback honesto)");
    assert(body.health.summary.total === 0,     "G1: summary.total = 0");
    assert(body.health.summary.completed === 0, "G1: summary.completed = 0");
    assert(body.health.summary.failed === 0,    "G1: summary.failed = 0");
    assert(body.health.summary.blocked === 0,   "G1: summary.blocked = 0");
    assert(body.health.summary.running === 0,   "G1: summary.running = 0");
    assert(Array.isArray(body.health.recentErrors),      "G1: recentErrors é array");
    assert(body.health.recentErrors.length === 0,        "G1: recentErrors vazio");
    assert(Array.isArray(body.health.blockedExecutions), "G1: blockedExecutions é array");
    assert(body.health.blockedExecutions.length === 0,   "G1: blockedExecutions vazio");
    assert(Array.isArray(body.health.recentCompleted),   "G1: recentCompleted é array");
    assert(body.health.recentCompleted.length === 0,     "G1: recentCompleted vazio");
  }

  // ---- Group 2: exec_event success → contadores + concluídas reais ----
  console.log("\nGroup 2: exec_event success → contadores + concluídas reais");
  {
    const kv = createMockKV();
    const contractId = "pr3_g2_health_success";

    // Gravar exec_event de sucesso via emitExecEvent (caminho canônico)
    const env = { ENAVIA_BRAIN: kv };
    await emitExecEvent(env, contractId, FIXTURE_SUCCESS);

    const { status, body } = await getHealth(kv);
    const h = body.health;

    assert(status === 200,              "G2: GET /health retorna HTTP 200");
    assert(body.ok === true,            "G2: body.ok = true");
    assert(h.status === "healthy",      "G2: health.status = 'healthy' (exec success)");
    assert(h._source === "exec_event",  "G2: _source = 'exec_event' (dado real)");

    // Contadores reais
    assert(h.summary.total === 1,       "G2: summary.total = 1 (1 exec_event)");
    assert(h.summary.completed === 1,   "G2: summary.completed = 1 (success)");
    assert(h.summary.failed === 0,      "G2: summary.failed = 0");
    assert(h.summary.blocked === 0,     "G2: summary.blocked = 0 (honesto)");
    assert(h.summary.running === 0,     "G2: summary.running = 0");

    // Concluídas reais
    assert(Array.isArray(h.recentCompleted),       "G2: recentCompleted é array");
    assert(h.recentCompleted.length === 1,         "G2: recentCompleted tem 1 item");
    const done = h.recentCompleted[0];
    assert(typeof done.id === "string",            "G2: recentCompleted[0].id é string");
    assert(done.requestLabel === FIXTURE_SUCCESS.operacao_atual, "G2: requestLabel = operacao_atual");
    assert(done.completedAt  === FIXTURE_SUCCESS.emitted_at,     "G2: completedAt = emitted_at");
    assert(done.durationMs   === null,             "G2: durationMs = null (honesto — não em PR1)");
    assert(typeof done.summary === "string",       "G2: summary é string");

    // Erros vazios
    assert(h.recentErrors.length === 0,            "G2: recentErrors vazio em success");

    // Bloqueadas sempre []
    assert(h.blockedExecutions.length === 0,       "G2: blockedExecutions = [] (honesto)");
  }

  // ---- Group 3: exec_event failed → contadores + erros recentes reais ----
  console.log("\nGroup 3: exec_event failed → contadores + erros recentes reais");
  {
    const kv = createMockKV();
    const contractId = "pr3_g3_health_failed";

    const env = { ENAVIA_BRAIN: kv };
    await emitExecEvent(env, contractId, FIXTURE_FAILED);

    const { status, body } = await getHealth(kv);
    const h = body.health;

    assert(status === 200,              "G3: GET /health retorna HTTP 200");
    assert(body.ok === true,            "G3: body.ok = true");
    assert(h.status === "degraded",     "G3: health.status = 'degraded' (exec failed)");
    assert(h._source === "exec_event",  "G3: _source = 'exec_event' (dado real)");

    // Contadores reais
    assert(h.summary.total === 1,       "G3: summary.total = 1");
    assert(h.summary.completed === 0,   "G3: summary.completed = 0");
    assert(h.summary.failed === 1,      "G3: summary.failed = 1 (failed)");
    assert(h.summary.blocked === 0,     "G3: summary.blocked = 0 (honesto)");
    assert(h.summary.running === 0,     "G3: summary.running = 0");

    // Erros recentes reais
    assert(Array.isArray(h.recentErrors),    "G3: recentErrors é array");
    assert(h.recentErrors.length === 1,      "G3: recentErrors tem 1 item");
    const err = h.recentErrors[0];
    assert(typeof err.id === "string",       "G3: recentErrors[0].id é string");
    assert(err.requestLabel === FIXTURE_FAILED.operacao_atual, "G3: requestLabel = operacao_atual");
    assert(err.errorCode === "STEP_EXECUTION_ERROR",           "G3: errorCode canônico presente");
    assert(err.message === FIXTURE_FAILED.motivo_curto,        "G3: message = motivo_curto real");
    assert(err.failedAt === FIXTURE_FAILED.emitted_at,         "G3: failedAt = emitted_at");

    // Concluídas vazias
    assert(h.recentCompleted.length === 0,   "G3: recentCompleted vazio em failed");

    // Bloqueadas sempre []
    assert(h.blockedExecutions.length === 0, "G3: blockedExecutions = [] (honesto)");
  }

  // ---- Group 4: exec_event running → contadores + running honesto ----
  console.log("\nGroup 4: exec_event running → contadores running + status healthy");
  {
    const kv = createMockKV();
    const contractId = "pr3_g4_health_running";

    const env = { ENAVIA_BRAIN: kv };
    await emitExecEvent(env, contractId, FIXTURE_RUNNING);

    const { status, body } = await getHealth(kv);
    const h = body.health;

    assert(status === 200,              "G4: GET /health retorna HTTP 200");
    assert(body.ok === true,            "G4: body.ok = true");
    assert(h.status === "healthy",      "G4: health.status = 'healthy' (running = em curso)");
    assert(h._source === "exec_event",  "G4: _source = 'exec_event'");

    // Contadores reais
    assert(h.summary.total === 1,       "G4: summary.total = 1");
    assert(h.summary.running === 1,     "G4: summary.running = 1 (em curso)");
    assert(h.summary.completed === 0,   "G4: summary.completed = 0");
    assert(h.summary.failed === 0,      "G4: summary.failed = 0");
    assert(h.summary.blocked === 0,     "G4: summary.blocked = 0 (honesto)");

    // Sem erros, sem concluídas, sem bloqueadas
    assert(h.recentErrors.length === 0,      "G4: recentErrors vazio (running não é erro)");
    assert(h.recentCompleted.length === 0,   "G4: recentCompleted vazio (running não é conclusão)");
    assert(h.blockedExecutions.length === 0, "G4: blockedExecutions = [] (honesto)");
  }

  // ---- Group 5: blockedExecutions sempre [] — isolamento completo ----
  console.log("\nGroup 5: blockedExecutions sempre [] (honesto — não disponível na fonte PR1)");
  {
    // Testar em todos os status possíveis
    for (const [label, fixture] of [
      ["success", FIXTURE_SUCCESS],
      ["failed",  FIXTURE_FAILED],
      ["running", FIXTURE_RUNNING],
    ]) {
      const kv = createMockKV();
      const contractId = `pr3_g5_health_${label}`;
      const env = { ENAVIA_BRAIN: kv };
      await emitExecEvent(env, contractId, fixture);

      const { body } = await getHealth(kv);
      const h = body.health;

      assert(Array.isArray(h.blockedExecutions),    `G5 [${label}]: blockedExecutions é array`);
      assert(h.blockedExecutions.length === 0,      `G5 [${label}]: blockedExecutions = [] (honesto)`);
      assert(h.summary.blocked === 0,               `G5 [${label}]: summary.blocked = 0 (honesto)`);
    }
  }

  // ---- Group 6: execução real via executeCurrentMicroPr → health real ----
  console.log("\nGroup 6: execução real (executeCurrentMicroPr success) → GET /health com dado real");
  {
    const kv = createMockKV();
    const contractId = "pr3_g6_health_real";
    await setupReadyContract(kv, contractId);
    const env = { ENAVIA_BRAIN: kv };

    // Executar o fluxo real — emitExecEvent será chamado internamente
    const execResult = await executeCurrentMicroPr(env, contractId, {
      evidence: ["Smoke test G6 — pr3 health real path"],
    });

    assert(execResult.ok === true, "G6: executeCurrentMicroPr retornou ok=true");

    // Verificar que o pointer foi gravado por emitExecEvent
    const pointer = await kv.get("execution:exec_event:latest_contract_id");
    assert(pointer === contractId, "G6: pointer latest_contract_id gravado com contractId correto");

    // Verificar via readExecEvent que o evento está no KV
    const directEvent = await readExecEvent(env, contractId);
    assert(directEvent !== null,           "G6: readExecEvent retornou evento não-null");
    assert(directEvent.status_atual === "success", "G6: exec_event real tem status_atual=success");

    // Agora provar via GET /health que os dados reais aparecem
    const { status, body } = await getHealth(kv);
    const h = body.health;

    assert(status === 200,              "G6: GET /health retorna HTTP 200");
    assert(body.ok === true,            "G6: body.ok = true");
    assert(h._source === "exec_event",  "G6: _source = 'exec_event' (dado real)");
    assert(h.status === "healthy",      "G6: health.status = 'healthy' (execução real success)");

    // Contadores reais derivados da execução real
    assert(h.summary.total === 1,       "G6: summary.total = 1 (execução real)");
    assert(h.summary.completed === 1,   "G6: summary.completed = 1 (success real)");
    assert(h.summary.failed === 0,      "G6: summary.failed = 0");
    assert(h.summary.blocked === 0,     "G6: summary.blocked = 0 (honesto)");
    assert(h.summary.running === 0,     "G6: summary.running = 0");

    // Concluídas reais derivadas da execução real
    assert(h.recentCompleted.length === 1,                    "G6: 1 item em recentCompleted");
    assert(h.recentCompleted[0].completedAt === directEvent.emitted_at, "G6: completedAt = emitted_at real");
    assert(h.recentCompleted[0].durationMs === null,          "G6: durationMs = null (honesto)");

    // Sem erros, sem bloqueadas
    assert(h.recentErrors.length === 0,      "G6: recentErrors vazio (success)");
    assert(h.blockedExecutions.length === 0, "G6: blockedExecutions = [] (honesto)");

    // Isolamento: health não contém campos de autonomia/gate/execution trail
    assert(!("exec_event"    in h), "G6: health não expõe exec_event diretamente");
    assert(!("approved_by"   in h), "G6: health não contém approved_by (gate)");
    assert(!("autonomy_level" in h), "G6: health não contém autonomy_level (autonomia)");
    assert(!("bridge_id"     in h), "G6: health não contém bridge_id (bridge — fora do escopo)");
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
