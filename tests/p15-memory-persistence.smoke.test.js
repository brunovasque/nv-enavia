// ============================================================================
// 🧪 Smoke Tests — P15: Persistência real pós-ciclo via handler real do worker
//
// Run: node tests/p15-memory-persistence.smoke.test.js
//
// Prova que o caminho real /planner/run do worker persiste memoryConsolidation:
//   1. Invoca worker.fetch(Request, env) com Request real para POST /planner/run
//   2. env mockado com ENAVIA_BRAIN em memória (mesmo padrão dos outros testes)
//   3. Valida status 200 e shape canônico do response
//   4. Valida presença de planner.memoryConsolidation no response
//   5. Valida presença e conteúdo de telemetry.consolidation_persisted
//   6. Confirma que memory:<id> foi realmente gravado no KV mockado
//   7. Confirma que memory:index foi realmente atualizado no KV mockado
//   8. Leitura de volta dos registros via readMemoryById (PM2)
//   9. Prova que nada é persistido quando should_consolidate=false
//  10. Não regressão de planner.gate e planner.bridge
//
// Usa o handler real do worker (export default) — sem réplica local da lógica.
// ============================================================================

import worker          from "../nv-enavia.js";
import { readMemoryById } from "../schema/memory-storage.js";

// ---------------------------------------------------------------------------
// In-memory KV mock — idêntico ao usado em memory-storage.smoke.test.js
// ---------------------------------------------------------------------------
function makeKVMock() {
  const store = new Map();
  const ENAVIA_BRAIN = {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
  return { ENAVIA_BRAIN, _store: store };
}

// ---------------------------------------------------------------------------
// plannerRun — invoca o handler real do worker para POST /planner/run
// ---------------------------------------------------------------------------
async function plannerRun(body, envMock) {
  const req = new Request("https://worker.test/planner/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const res = await worker.fetch(req, envMock, {});
  const json = await res.json();
  return { status: res.status, json };
}

// ---------------------------------------------------------------------------
// Test runner helpers
// ---------------------------------------------------------------------------
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

// ===========================================================================
// Group 1 — Handler real retorna 200 com shape canônico completo
// Prova que P11–P14 não regrediram (gate, bridge, memoryConsolidation presentes)
// ===========================================================================
async function testHandlerShape() {
  console.log("\nGroup 1: Handler real POST /planner/run — shape canônico e não-regressão P11–P14");

  const env = makeKVMock();
  const { status, json } = await plannerRun(
    { message: "Quero ver os logs do worker.", session_id: "test-shape-001" },
    env
  );

  assert(status === 200,                                           "status HTTP === 200");
  assert(json.ok === true,                                         "json.ok === true");
  assert(json.system === "ENAVIA-NV-FIRST",                        "json.system === 'ENAVIA-NV-FIRST'");
  assert(typeof json.timestamp === "number",                       "json.timestamp é number");
  assert(typeof json.input === "string",                           "json.input é string");

  // planner sub-fields (P11–P14 non-regression)
  assert(json.planner !== undefined,                               "json.planner presente");
  assert(json.planner.classification !== undefined,                "planner.classification presente");
  assert(typeof json.planner.classification.complexity_level === "string",
    "planner.classification.complexity_level é string");
  assert(json.planner.canonicalPlan !== undefined,                 "planner.canonicalPlan presente");
  assert(json.planner.gate !== undefined,                          "planner.gate presente");
  assert(typeof json.planner.gate.gate_status === "string",        "planner.gate.gate_status é string");
  assert(typeof json.planner.gate.can_proceed === "boolean",       "planner.gate.can_proceed é boolean");
  assert(json.planner.bridge !== undefined,                        "planner.bridge presente");
  assert(typeof json.planner.bridge.bridge_status === "string",    "planner.bridge.bridge_status é string");
  assert(json.planner.memoryConsolidation !== undefined,           "planner.memoryConsolidation presente");
  assert(typeof json.planner.memoryConsolidation.should_consolidate === "boolean",
    "planner.memoryConsolidation.should_consolidate é boolean");
  assert(Array.isArray(json.planner.memoryConsolidation.memory_candidates),
    "planner.memoryConsolidation.memory_candidates é array");

  // telemetry P15
  assert(json.telemetry !== undefined,                             "json.telemetry presente");
  assert(json.telemetry.pipeline === "PM4→PM5→PM6→PM7→PM8→PM9→P15",
    "telemetry.pipeline reflete P15");
  assert(Array.isArray(json.telemetry.consolidation_persisted),    "telemetry.consolidation_persisted é array");
}

// ===========================================================================
// Group 2 — Persistência real no KV: nível A (operacional)
// Invoca o handler real e verifica gravação real no KV mockado
// ===========================================================================
async function testKVPersistenceLevelA() {
  console.log("\nGroup 2: Persistência real no KV — nível A via handler real");

  const env = makeKVMock();
  const { status, json } = await plannerRun(
    { message: "Quero ver os logs do worker.", session_id: "session-kv-a" },
    env
  );

  assert(status === 200,                                    "status HTTP === 200");
  assert(json.planner.gate.can_proceed === true,            "gate aprova nível A automaticamente");
  assert(json.planner.memoryConsolidation.should_consolidate === true,
    "should_consolidate=true para nível A aprovado");

  const persisted = json.telemetry.consolidation_persisted;
  assert(persisted.length >= 1,                             "ao menos 1 candidato persistido no response");
  assert(persisted.every((p) => p.write_ok === true),       "todos os candidatos com write_ok=true");

  // Verifica campos de auditoria no response
  for (const p of persisted) {
    assert(typeof p.memory_id    === "string" && p.memory_id.length > 0,  `memory_id presente: ${p.memory_id}`);
    assert(typeof p.memory_type  === "string" && p.memory_type.length > 0, `memory_type presente: ${p.memory_type}`);
    assert(typeof p.is_canonical === "boolean",                             `is_canonical é boolean`);
    assert(p.kv_key === `memory:${p.memory_id}`,                            `kv_key correto: ${p.kv_key}`);
  }

  // Verifica que os objetos foram REALMENTE gravados no KV (leitura direta do store mock)
  for (const p of persisted) {
    const stored = await readMemoryById(p.memory_id, env);
    assert(stored !== null,                                                       `KV contém ${p.memory_id}`);
    assert(stored.memory_id   === p.memory_id,                                    `memory_id correto no KV`);
    assert(stored.entity_type === "operation",                                    `entity_type=operation no KV`);
    assert(stored.source      === "planner_run",                                  `source=planner_run no KV`);
    assert(stored.entity_id   === "session-kv-a",                                 `entity_id=session_id no KV`);
    assert(typeof stored.created_at === "string" && stored.created_at.length > 0, `created_at gravado no KV`);
    assert(typeof stored.updated_at === "string" && stored.updated_at.length > 0, `updated_at gravado no KV`);
    assert(Array.isArray(stored.flags),                                           `flags é array no KV`);
    assert(stored.memory_type === "operational_history",                          `memory_type=operational_history`);
    assert(stored.is_canonical === false,                                         `is_canonical=false para operacional`);
  }

  // Verifica que memory:index foi atualizado no KV real
  const rawIndex = await env.ENAVIA_BRAIN.get("memory:index");
  assert(rawIndex !== null, "memory:index existe no KV");
  const index = JSON.parse(rawIndex);
  assert(Array.isArray(index), "memory:index é array JSON");
  for (const p of persisted) {
    assert(index.includes(p.memory_id), `memory:index inclui ${p.memory_id}`);
  }
}

// ===========================================================================
// Group 3 — Sem persistência quando gate bloqueia (nível C sem aprovação)
// Invoca o handler real e confirma KV vazio
// ===========================================================================
async function testNoPersistenceWhenGateBlocks() {
  console.log("\nGroup 3: Nenhuma persistência quando gate=approval_required (nível C)");

  const env = makeKVMock();
  const { status, json } = await plannerRun(
    {
      message: "Redesenhar toda a arquitetura, migrar banco em fases, múltiplos pipelines e compliance.",
      context: { mentions_prod: true, known_dependencies: ["supabase"] },
    },
    env
  );

  assert(status === 200,                                                      "status HTTP === 200");
  assert(json.planner.gate.gate_status === "approval_required",               "gate=approval_required para nível C");
  assert(json.planner.gate.can_proceed === false,                             "gate.can_proceed=false");
  assert(json.planner.bridge.bridge_status === "blocked_by_gate",             "bridge bloqueada");
  assert(json.planner.memoryConsolidation.should_consolidate === false,       "should_consolidate=false enquanto transitório");
  assert(json.telemetry.consolidation_persisted.length === 0,                 "consolidation_persisted vazio");

  // KV não deve conter nenhum registro de memória
  const rawIndex = await env.ENAVIA_BRAIN.get("memory:index");
  assert(rawIndex === null,                                                    "memory:index não existe no KV");
}

// ===========================================================================
// Group 4 — Session ID propaga corretamente como entity_id no KV
// ===========================================================================
async function testSessionIdPropagation() {
  console.log("\nGroup 4: session_id propaga como entity_id no KV");

  const env = makeKVMock();
  const sessionId = "my-canonical-session-xyz";
  const { status, json } = await plannerRun(
    { message: "Quero ver os logs do worker.", session_id: sessionId },
    env
  );

  assert(status === 200,                                     "status HTTP === 200");
  assert(json.telemetry.session_id === sessionId,            "telemetry.session_id ecoado corretamente");

  const persisted = json.telemetry.consolidation_persisted;
  if (persisted.length > 0) {
    const stored = await readMemoryById(persisted[0].memory_id, env);
    assert(stored !== null,                                  "registro presente no KV");
    assert(stored.entity_id === sessionId,                   "entity_id = session_id no registro KV");
  }
}

// ===========================================================================
// Group 5 — Response sem ENAVIA_BRAIN não quebra (degradação limpa)
// ===========================================================================
async function testDegradationWithoutKV() {
  console.log("\nGroup 5: Degradação limpa sem ENAVIA_BRAIN");

  // env sem KV binding — handler não deve quebrar
  const emptyEnv = {};
  const { status, json } = await plannerRun(
    { message: "Quero ver os logs do worker." },
    emptyEnv
  );

  assert(status === 200,                                                    "status HTTP === 200 mesmo sem KV");
  assert(json.ok === true,                                                  "ok=true mesmo sem KV");
  assert(json.planner.memoryConsolidation !== undefined,                    "memoryConsolidation presente no response");
  assert(Array.isArray(json.telemetry.consolidation_persisted),             "consolidation_persisted é array");
  assert(json.telemetry.consolidation_persisted.length === 0,               "consolidation_persisted vazio sem KV");
}

// ===========================================================================
// Runner
// ===========================================================================
async function runAll() {
  console.log("╔═══════════════════════════════════════════════════════════════════╗");
  console.log("║  P15 — Smoke Tests: handler real POST /planner/run → KV persist  ║");
  console.log("╚═══════════════════════════════════════════════════════════════════╝");

  await testHandlerShape();
  await testKVPersistenceLevelA();
  await testNoPersistenceWhenGateBlocks();
  await testSessionIdPropagation();
  await testDegradationWithoutKV();

  console.log(`\n${"=".repeat(65)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(65)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Fatal error in P15 smoke tests:", err);
  process.exit(1);
});
