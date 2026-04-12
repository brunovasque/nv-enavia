// ============================================================================
// 🧪 Smoke Tests — P16: Leitura de memória antes do plano em /planner/run
//
// Run: node tests/p16-memory-read-pre-plan.smoke.test.js
//
// Valida que /planner/run (handlePlannerRun) consulta memória útil antes
// de montar o plano, com evidência auditável no telemetry.
//
// Tests:
//   Group 1: sem memória → /planner/run segue 200 e telemetry.memory_read presente
//   Group 2: com memória canônica relevante → telemetry mostra leitura
//   Group 3: com memória operacional relevante → telemetry mostra leitura
//   Group 4: ENAVIA_BRAIN indisponível → /planner/run não quebra
//   Group 5: não regressão de gate, bridge, memoryConsolidation e P15
//   Group 6: pipeline string inclui PM3
// ============================================================================

import worker from "../nv-enavia.js";
import { writeMemory } from "../schema/memory-storage.js";
import { buildMemoryObject } from "../schema/memory-schema.js";

// ---------------------------------------------------------------------------
// In-memory KV mock (idêntico ao usado em p15-memory-persistence.smoke.test.js)
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
// KV mock que lança na leitura do índice de memória (simula erro controlado)
// ---------------------------------------------------------------------------
function makeKVErrorMock() {
  const ENAVIA_BRAIN = {
    async get(_key) {
      throw new Error("KV read error (simulated)");
    },
    async put(_key, _value) {},
    async delete(_key) {},
  };
  return { ENAVIA_BRAIN };
}

// ---------------------------------------------------------------------------
// plannerRun — invoca o handler real do worker via worker.fetch
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
// writeTestMemory — persiste um objeto de memória canônico no mock KV
// ---------------------------------------------------------------------------
async function writeTestMemory(partial, envMock) {
  const nowIso = new Date().toISOString();
  const memObj = buildMemoryObject({
    memory_id:          crypto.randomUUID(),
    entity_type:        partial.entity_type || "operation",
    entity_id:          partial.entity_id   || "test-entity",
    source:             "p16-smoke-test",
    created_at:         nowIso,
    updated_at:         nowIso,
    expires_at:         null,
    flags:              [],
    ...partial,
  });
  return writeMemory(memObj, envMock);
}

// ---------------------------------------------------------------------------
// Test helpers
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

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== P16 — Leitura de memória antes do plano — Smoke Tests ===\n");

  // -------------------------------------------------------------------------
  // Group 1: sem memória → /planner/run retorna 200 com telemetry.memory_read
  // -------------------------------------------------------------------------
  console.log("Group 1: sem memória → /planner/run segue 200 e telemetry.memory_read presente");

  const env1 = makeKVMock();
  const r1 = await plannerRun({ message: "Listar contratos ativos" }, env1);

  assert(r1.status === 200,                              "status 200 sem memória");
  assert(r1.json.ok === true,                            "ok === true sem memória");
  assert(r1.json.telemetry !== undefined,                "telemetry presente");
  assert(r1.json.telemetry.memory_read !== undefined,    "telemetry.memory_read presente");
  assert(typeof r1.json.telemetry.memory_read.consulted === "boolean",
    "memory_read.consulted é boolean");
  assert(typeof r1.json.telemetry.memory_read.count === "number",
    "memory_read.count é number");
  assert(Array.isArray(r1.json.telemetry.memory_read.types),
    "memory_read.types é array");
  assert(r1.json.telemetry.memory_read.count === 0,     "count === 0 sem memória");
  assert(r1.json.telemetry.memory_read.types.length === 0,
    "types vazio sem memória");

  // -------------------------------------------------------------------------
  // Group 2: com memória canônica → telemetry mostra leitura
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: com memória canônica → telemetry mostra leitura");

  const env2 = makeKVMock();
  await writeTestMemory({
    memory_type:        "canonical_rules",
    entity_type:        "rule",
    entity_id:          "rule-001",
    title:              "Regra de aprovação de contratos",
    content_structured: { rule: "Contratos acima de R$10k exigem aprovação humana" },
    priority:           "critical",
    confidence:         "confirmed",
    is_canonical:       true,
    status:             "active",
  }, env2);

  const r2 = await plannerRun({ message: "Criar contrato alto valor" }, env2);

  assert(r2.status === 200,                              "status 200 com memória canônica");
  assert(r2.json.ok === true,                            "ok === true com memória canônica");
  assert(r2.json.telemetry.memory_read.consulted === true,
    "memory_read.consulted === true com memória canônica");
  assert(r2.json.telemetry.memory_read.count >= 1,
    "memory_read.count >= 1 com memória canônica");
  assert(r2.json.telemetry.memory_read.types.includes("canonical_rules"),
    "memory_read.types inclui canonical_rules");

  // -------------------------------------------------------------------------
  // Group 3: com memória operacional → telemetry mostra leitura
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: com memória operacional → telemetry mostra leitura");

  const env3 = makeKVMock();
  await writeTestMemory({
    memory_type:        "operational_history",
    entity_type:        "operation",
    entity_id:          "op-session-42",
    title:              "Ciclo anterior: deploy bem-sucedido",
    content_structured: { result: "success", steps_executed: 3 },
    priority:           "medium",
    confidence:         "high",
    is_canonical:       false,
    status:             "active",
  }, env3);

  const r3 = await plannerRun({ message: "Verificar histórico de deploys" }, env3);

  assert(r3.status === 200,                              "status 200 com memória operacional");
  assert(r3.json.ok === true,                            "ok === true com memória operacional");
  assert(r3.json.telemetry.memory_read.consulted === true,
    "memory_read.consulted === true com memória operacional");
  assert(r3.json.telemetry.memory_read.count >= 1,
    "memory_read.count >= 1 com memória operacional");
  assert(r3.json.telemetry.memory_read.types.includes("operational_history"),
    "memory_read.types inclui operational_history");

  // -------------------------------------------------------------------------
  // Group 4: ENAVIA_BRAIN indisponível → /planner/run não quebra
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: ENAVIA_BRAIN indisponível → /planner/run não quebra");

  // Case 4a: env sem ENAVIA_BRAIN
  const r4a = await plannerRun({ message: "Listar contratos" }, {});
  assert(r4a.status === 200,                             "status 200 sem ENAVIA_BRAIN");
  assert(r4a.json.ok === true,                           "ok === true sem ENAVIA_BRAIN");
  assert(r4a.json.telemetry.memory_read.consulted === false,
    "consulted === false sem ENAVIA_BRAIN");
  assert(r4a.json.telemetry.memory_read.count === 0,     "count === 0 sem ENAVIA_BRAIN");

  // Case 4b: KV que lança na leitura
  const env4b = makeKVErrorMock();
  const r4b = await plannerRun({ message: "Listar contratos" }, env4b);
  assert(r4b.status === 200,                             "status 200 com KV error");
  assert(r4b.json.ok === true,                           "ok === true com KV error");
  assert(r4b.json.telemetry.memory_read.consulted === false,
    "consulted === false com KV error");
  assert(typeof r4b.json.telemetry.memory_read.error === "string",
    "error registrado no memory_read quando KV lança");

  // -------------------------------------------------------------------------
  // Group 5: não regressão — gate, bridge, memoryConsolidation, P15
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: não regressão de gate, bridge, memoryConsolidation e P15");

  const env5 = makeKVMock();
  // Memória canônica pré-existente
  await writeTestMemory({
    memory_type:        "canonical_rules",
    entity_type:        "rule",
    entity_id:          "rule-002",
    title:              "Regra de segurança básica",
    content_structured: { rule: "Toda operação sensível exige log" },
    priority:           "high",
    confidence:         "confirmed",
    is_canonical:       true,
    status:             "active",
  }, env5);

  const r5 = await plannerRun({
    message: "Redesenhar toda a arquitetura, migrar banco de dados em fases, compliance alto",
    session_id: "p16-smoke-session",
  }, env5);

  assert(r5.status === 200,                              "status 200 não regressão");
  assert(r5.json.ok === true,                            "ok === true não regressão");
  assert(r5.json.planner !== undefined,                  "planner presente");
  assert(r5.json.planner.gate !== undefined,             "gate presente");
  assert(typeof r5.json.planner.gate.can_proceed === "boolean",
    "gate.can_proceed é boolean");
  assert(r5.json.planner.bridge !== undefined,           "bridge presente");
  assert(r5.json.planner.memoryConsolidation !== undefined,
    "memoryConsolidation presente");
  assert(Array.isArray(r5.json.telemetry.consolidation_persisted),
    "consolidation_persisted é array (P15 intacto)");
  assert(r5.json.telemetry.memory_read.consulted === true,
    "memory_read.consulted === true não regressão");

  // -------------------------------------------------------------------------
  // Group 6: pipeline string inclui PM3
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: pipeline string inclui PM3");

  const env6 = makeKVMock();
  const r6 = await plannerRun({ message: "Verificar status dos workers" }, env6);
  assert(
    typeof r6.json.telemetry.pipeline === "string" &&
    r6.json.telemetry.pipeline.startsWith("PM3"),
    "telemetry.pipeline começa com PM3"
  );
  assert(
    r6.json.telemetry.pipeline.includes("P15"),
    "telemetry.pipeline inclui P15"
  );

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in P16 smoke tests:", err);
  process.exit(1);
});
