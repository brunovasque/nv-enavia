// ============================================================================
// 🧪 Smoke Tests — P17: Regras de prioridade de memória em runtime
//
// Run: node tests/p17-memory-priority-runtime.smoke.test.js
//
// Valida que /planner/run aplica e expõe a prioridade canônica de runtime:
//   canônica > estado vivo > operacional recente
//
// Essa prioridade deve ser explícita e auditável em planner.memoryContext.priority_applied.
//
// Tests:
//   Group 1: canônica + vivo + operacional → canônica vence (winning_tier=canonical)
//   Group 2: vivo + operacional (sem canônica) → vivo vence (winning_tier=live)
//   Group 3: só operacional → operacional é usado (winning_tier=operational)
//   Group 4: sem memória → /planner/run continua 200, winning_tier=null
//   Group 5: não regressão — gate, bridge, memoryConsolidation, consolidation_persisted,
//            planner.memoryContext e shape de P16 intactos
// ============================================================================

import worker from "../nv-enavia.js";
import { writeMemory } from "../schema/memory-storage.js";
import { buildMemoryObject } from "../schema/memory-schema.js";

// ---------------------------------------------------------------------------
// In-memory KV mock (mesmo padrão de P15/P16)
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
// writeTestMemory — persiste um objeto de memória no mock KV
// ---------------------------------------------------------------------------
async function writeTestMemory(partial, envMock) {
  const nowIso = new Date().toISOString();
  const memObj = buildMemoryObject({
    memory_id:          crypto.randomUUID(),
    entity_type:        partial.entity_type || "operation",
    entity_id:          partial.entity_id   || "test-entity",
    source:             "p17-smoke-test",
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
  console.log("\n=== P17 — Prioridade de memória em runtime — Smoke Tests ===\n");

  // -------------------------------------------------------------------------
  // Group 1: canônica + vivo + operacional → canônica vence
  // -------------------------------------------------------------------------
  console.log("Group 1: canônica + vivo + operacional → canônica vence (winning_tier=canonical)");

  const env1 = makeKVMock();

  // memória canônica
  await writeTestMemory({
    memory_type:        "canonical_rules",
    entity_type:        "rule",
    entity_id:          "rule-p17-001",
    title:              "Regra canônica de aprovação",
    content_structured: { rule: "Toda mudança crítica exige aprovação humana" },
    priority:           "critical",
    confidence:         "confirmed",
    is_canonical:       true,
    status:             "active",
  }, env1);

  // estado vivo
  await writeTestMemory({
    memory_type:        "live_context",
    entity_type:        "context",
    entity_id:          "ctx-p17-001",
    title:              "Estado vivo: sessão ativa",
    content_structured: { session: "active", user: "bruno" },
    priority:           "high",
    confidence:         "high",
    is_canonical:       false,
    status:             "active",
  }, env1);

  // operacional recente
  await writeTestMemory({
    memory_type:        "operational_history",
    entity_type:        "operation",
    entity_id:          "op-p17-001",
    title:              "Histórico: deploy anterior",
    content_structured: { result: "success" },
    priority:           "medium",
    confidence:         "high",
    is_canonical:       false,
    status:             "active",
  }, env1);

  const r1 = await plannerRun({ message: "Executar operação crítica" }, env1);

  assert(r1.status === 200,                                            "status 200 (grupo 1)");
  assert(r1.json.ok === true,                                          "ok === true (grupo 1)");
  assert(r1.json.planner.memoryContext !== undefined,                  "memoryContext presente");
  assert(r1.json.planner.memoryContext.applied === true,               "memoryContext.applied === true");
  assert(r1.json.planner.memoryContext.priority_applied !== undefined, "priority_applied presente");

  const pa1 = r1.json.planner.memoryContext.priority_applied;
  assert(Array.isArray(pa1.order),                                     "priority_applied.order é array");
  assert(pa1.order[0] === "canonical",                                 "order[0] === canonical");
  assert(pa1.order[1] === "live",                                      "order[1] === live");
  assert(pa1.order[2] === "operational",                               "order[2] === operational");
  assert(pa1.winning_tier === "canonical",                             "winning_tier === canonical (canônica vence)");
  assert(Array.isArray(pa1.types_by_tier.canonical) &&
    pa1.types_by_tier.canonical.includes("canonical_rules"),           "types_by_tier.canonical inclui canonical_rules");
  assert(Array.isArray(pa1.types_by_tier.live) &&
    pa1.types_by_tier.live.includes("live_context"),                   "types_by_tier.live inclui live_context");
  assert(Array.isArray(pa1.types_by_tier.operational) &&
    pa1.types_by_tier.operational.includes("operational_history"),     "types_by_tier.operational inclui operational_history");

  // Prova que a primeira memória nos items é canônica (PM3 ordena corretamente)
  assert(r1.json.planner.memoryContext.items.length >= 1,             "items tem pelo menos 1 item");
  const firstItem1 = r1.json.planner.memoryContext.items[0];
  assert(
    firstItem1.is_canonical === true || firstItem1.memory_type === "canonical_rules",
    "primeiro item é canônico (canônica vence na lista ordenada)"
  );

  // -------------------------------------------------------------------------
  // Group 2: vivo + operacional (sem canônica) → vivo vence
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: vivo + operacional (sem canônica) → vivo vence (winning_tier=live)");

  const env2 = makeKVMock();

  // estado vivo
  await writeTestMemory({
    memory_type:        "live_context",
    entity_type:        "context",
    entity_id:          "ctx-p17-002",
    title:              "Estado vivo: contexto atual",
    content_structured: { state: "running" },
    priority:           "high",
    confidence:         "high",
    is_canonical:       false,
    status:             "active",
  }, env2);

  // operacional recente
  await writeTestMemory({
    memory_type:        "operational_history",
    entity_type:        "operation",
    entity_id:          "op-p17-002",
    title:              "Histórico: ciclo anterior",
    content_structured: { result: "partial" },
    priority:           "medium",
    confidence:         "medium",
    is_canonical:       false,
    status:             "active",
  }, env2);

  const r2 = await plannerRun({ message: "Verificar estado do sistema" }, env2);

  assert(r2.status === 200,                                            "status 200 (grupo 2)");
  assert(r2.json.ok === true,                                          "ok === true (grupo 2)");

  const pa2 = r2.json.planner.memoryContext.priority_applied;
  assert(pa2.winning_tier === "live",                                  "winning_tier === live (vivo vence sem canônica)");
  assert(pa2.types_by_tier.canonical.length === 0,                    "types_by_tier.canonical vazio (sem canônica)");
  assert(pa2.types_by_tier.live.includes("live_context"),             "types_by_tier.live inclui live_context");
  assert(pa2.types_by_tier.operational.includes("operational_history"), "types_by_tier.operational inclui operational_history");

  // Prova que a primeira memória nos items é live_context
  assert(r2.json.planner.memoryContext.items.length >= 1,             "items tem pelo menos 1 item (grupo 2)");
  assert(
    r2.json.planner.memoryContext.items[0].memory_type === "live_context",
    "primeiro item é live_context (vivo vence operacional)"
  );

  // -------------------------------------------------------------------------
  // Group 3: só operacional → operacional é usado
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: só operacional → operacional é usado (winning_tier=operational)");

  const env3 = makeKVMock();

  await writeTestMemory({
    memory_type:        "operational_history",
    entity_type:        "operation",
    entity_id:          "op-p17-003",
    title:              "Histórico: operação única",
    content_structured: { steps: 5, result: "success" },
    priority:           "medium",
    confidence:         "high",
    is_canonical:       false,
    status:             "active",
  }, env3);

  const r3 = await plannerRun({ message: "Revisar histórico de operações" }, env3);

  assert(r3.status === 200,                                            "status 200 (grupo 3)");
  assert(r3.json.ok === true,                                          "ok === true (grupo 3)");
  assert(r3.json.planner.memoryContext.applied === true,               "memoryContext.applied === true (grupo 3)");

  const pa3 = r3.json.planner.memoryContext.priority_applied;
  assert(pa3.winning_tier === "operational",                           "winning_tier === operational (só operacional)");
  assert(pa3.types_by_tier.canonical.length === 0,                    "canonical vazio (grupo 3)");
  assert(pa3.types_by_tier.live.length === 0,                         "live vazio (grupo 3)");
  assert(pa3.types_by_tier.operational.includes("operational_history"), "operational tem operational_history (grupo 3)");
  assert(r3.json.planner.memoryContext.items[0].memory_type === "operational_history",
    "primeiro item é operational_history (grupo 3)");

  // -------------------------------------------------------------------------
  // Group 4: sem memória → /planner/run continua 200, winning_tier=null
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: sem memória → /planner/run continua 200, priority_applied.winning_tier=null");

  const env4 = makeKVMock();
  const r4 = await plannerRun({ message: "Listar contratos" }, env4);

  assert(r4.status === 200,                                            "status 200 sem memória (grupo 4)");
  assert(r4.json.ok === true,                                          "ok === true sem memória (grupo 4)");
  assert(r4.json.planner.memoryContext.applied === false,              "memoryContext.applied === false sem memória");
  assert(r4.json.planner.memoryContext.count === 0,                   "memoryContext.count === 0 sem memória");

  const pa4 = r4.json.planner.memoryContext.priority_applied;
  assert(pa4 !== undefined,                                            "priority_applied presente mesmo sem memória");
  assert(pa4.winning_tier === null,                                    "winning_tier === null sem memória");
  assert(pa4.types_by_tier.canonical.length === 0,                    "canonical vazio sem memória");
  assert(pa4.types_by_tier.live.length === 0,                         "live vazio sem memória");
  assert(pa4.types_by_tier.operational.length === 0,                  "operational vazio sem memória");

  // -------------------------------------------------------------------------
  // Group 5: não regressão — gate, bridge, memoryConsolidation,
  //          consolidation_persisted, planner.memoryContext (P16 shape intacto)
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: não regressão (gate, bridge, memoryConsolidation, consolidation_persisted, P16)");

  const env5 = makeKVMock();

  await writeTestMemory({
    memory_type:        "canonical_rules",
    entity_type:        "rule",
    entity_id:          "rule-p17-reg",
    title:              "Regra de regressão P17",
    content_structured: { rule: "Toda mudança deve ser auditável" },
    priority:           "high",
    confidence:         "confirmed",
    is_canonical:       true,
    status:             "active",
  }, env5);

  const r5 = await plannerRun({
    message:    "Redesenhar toda a arquitetura, migrar banco de dados em fases, compliance alto",
    session_id: "p17-regression-session",
  }, env5);

  assert(r5.status === 200,                                            "status 200 não regressão");
  assert(r5.json.ok === true,                                          "ok === true não regressão");
  assert(r5.json.planner !== undefined,                                "planner presente");
  assert(r5.json.planner.gate !== undefined,                           "gate presente");
  assert(typeof r5.json.planner.gate.can_proceed === "boolean",        "gate.can_proceed é boolean");
  assert(r5.json.planner.bridge !== undefined,                         "bridge presente");
  assert(r5.json.planner.memoryConsolidation !== undefined,            "memoryConsolidation presente");
  assert(Array.isArray(r5.json.telemetry.consolidation_persisted),    "consolidation_persisted é array (P15 intacto)");

  // P16 shape intacto
  const mc5 = r5.json.planner.memoryContext;
  assert(mc5 !== undefined,                                            "memoryContext presente (P16 intacto)");
  assert(mc5.applied === true,                                         "memoryContext.applied === true (P16)");
  assert(typeof mc5.count === "number",                                "memoryContext.count é number (P16)");
  assert(Array.isArray(mc5.types),                                     "memoryContext.types é array (P16)");
  assert(Array.isArray(mc5.items),                                     "memoryContext.items é array (P16)");
  // P17 campo adicional presente
  assert(mc5.priority_applied !== undefined,                           "priority_applied presente (P17 aditivo ao P16)");
  assert(mc5.priority_applied.winning_tier === "canonical",            "winning_tier === canonical não regressão");

  // Telemetria P16 intacta
  assert(r5.json.telemetry.memory_read !== undefined,                  "telemetry.memory_read presente (P16 intacto)");
  assert(typeof r5.json.telemetry.memory_read.consulted === "boolean", "memory_read.consulted é boolean (P16 intacto)");
  assert(
    typeof r5.json.telemetry.pipeline === "string" &&
    r5.json.telemetry.pipeline.includes("PM3"),
    "telemetry.pipeline inclui PM3 (P16 intacto)"
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
  console.error("Fatal error in P17 smoke tests:", err);
  process.exit(1);
});
