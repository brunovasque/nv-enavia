// ============================================================================
// 🧪 Smoke Tests — PR4: Painel / Memória Manual
//
// Run: node tests/pr4-manual-memory.smoke.test.js
//
// Prova que:
//   1. Criar memória manual via fluxo da PR4
//   2. Editar memória manual
//   3. Bloquear memória manual
//   4. Invalidar memória manual
//   5. Memória manual aparece no retrieval como manual_instructions
//   6. Memória manual bloqueada sai do retrieval normal
//   7. Schema/storage/retrieval anteriores não quebraram
// ============================================================================

import {
  writeMemory,
  readMemoryById,
  updateMemory,
  blockMemory,
  invalidateMemory,
} from "../schema/memory-storage.js";

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  MEMORY_FLAGS,
  validateMemoryObject,
  buildMemoryObject,
} from "../schema/memory-schema.js";

import {
  searchMemory,
  searchRelevantMemory,
} from "../schema/memory-read.js";

import {
  buildRetrievalContext,
  _classifyMemory,
} from "../schema/memory-retrieval.js";

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// In-memory KV mock
// ---------------------------------------------------------------------------
function makeKVMock() {
  const store = new Map();
  const ENAVIA_BRAIN = {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
  };
  return { ENAVIA_BRAIN, _store: store };
}

let passed = 0;
let failed = 0;
const results = [];

function ok(label) {
  passed++;
  results.push(`  ✅ ${label}`);
}
function fail(label, err) {
  failed++;
  results.push(`  ❌ ${label}: ${err}`);
}

// ---------------------------------------------------------------------------
// Helper: build a valid manual memory object
// ---------------------------------------------------------------------------
function buildManualMem(id, overrides = {}) {
  const now = new Date().toISOString();
  return buildMemoryObject({
    memory_id:          id,
    memory_type:        MEMORY_TYPES.MEMORIA_MANUAL,
    entity_type:        ENTITY_TYPES.RULE,
    entity_id:          id,
    title:              overrides.title || `Manual memory ${id}`,
    content_structured: overrides.content_structured || { text: `Content for ${id}` },
    priority:           overrides.priority || MEMORY_PRIORITY.HIGH,
    confidence:         overrides.confidence || MEMORY_CONFIDENCE.CONFIRMED,
    source:             "panel",
    created_at:         now,
    updated_at:         now,
    expires_at:         overrides.expires_at || null,
    is_canonical:       false,
    status:             overrides.status || MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               overrides.tags || ["manual", "pr4"],
  });
}

// ============================================================================
// Test Group 1: Create manual memory
// ============================================================================
async function testCreateManualMemory() {
  const env = makeKVMock();
  const mem = buildManualMem("pr4-create-001");

  // Validate schema
  const val = validateMemoryObject(mem);
  try { assert.ok(val.valid, `schema errors: ${(val.errors || []).join(", ")}`); ok("1.1 — manual memory passes schema validation"); }
  catch (e) { fail("1.1 — manual memory passes schema validation", e.message); }

  // Write to storage
  const res = await writeMemory(mem, env);
  try { assert.ok(res.ok); ok("1.2 — writeMemory succeeds for manual memory"); }
  catch (e) { fail("1.2 — writeMemory succeeds for manual memory", e.message); }

  // Read back
  const read = await readMemoryById("pr4-create-001", env);
  try {
    assert.ok(read !== null);
    assert.equal(read.memory_type, MEMORY_TYPES.MEMORIA_MANUAL);
    assert.equal(read.source, "panel");
    assert.equal(read.title, "Manual memory pr4-create-001");
    ok("1.3 — readMemoryById returns correct manual memory");
  } catch (e) { fail("1.3 — readMemoryById returns correct manual memory", e.message); }

  // Search by type
  const search = await searchMemory({ memory_type: MEMORY_TYPES.MEMORIA_MANUAL }, env);
  try {
    assert.ok(search.ok);
    assert.equal(search.count, 1);
    assert.equal(search.results[0].memory_id, "pr4-create-001");
    ok("1.4 — searchMemory finds manual memory by type");
  } catch (e) { fail("1.4 — searchMemory finds manual memory by type", e.message); }
}

// ============================================================================
// Test Group 2: Edit manual memory
// ============================================================================
async function testEditManualMemory() {
  const env = makeKVMock();
  const mem = buildManualMem("pr4-edit-001");
  await writeMemory(mem, env);

  // Update title and content
  const upd = await updateMemory("pr4-edit-001", {
    title: "Updated title",
    content_structured: { text: "Updated content" },
    priority: MEMORY_PRIORITY.CRITICAL,
  }, env);

  try {
    assert.ok(upd.ok);
    assert.equal(upd.record.title, "Updated title");
    assert.equal(upd.record.content_structured.text, "Updated content");
    assert.equal(upd.record.priority, MEMORY_PRIORITY.CRITICAL);
    assert.equal(upd.record.memory_type, MEMORY_TYPES.MEMORIA_MANUAL); // type preserved
    ok("2.1 — updateMemory edits manual memory fields correctly");
  } catch (e) { fail("2.1 — updateMemory edits manual memory fields correctly", e.message); }

  // Verify updated_at is a valid ISO 8601 string (updateMemory always sets it)
  try {
    assert.ok(typeof upd.record.updated_at === "string");
    assert.ok(!Number.isNaN(Date.parse(upd.record.updated_at)));
    ok("2.2 — updated_at is valid ISO 8601 after edit");
  } catch (e) { fail("2.2 — updated_at is valid ISO 8601 after edit", e.message); }
}

// ============================================================================
// Test Group 3: Block manual memory
// ============================================================================
async function testBlockManualMemory() {
  const env = makeKVMock();
  const mem = buildManualMem("pr4-block-001");
  await writeMemory(mem, env);

  const res = await blockMemory("pr4-block-001", { blocked_by: "panel" }, env);
  try {
    assert.ok(res.ok);
    assert.equal(res.record.status, MEMORY_STATUS.BLOCKED);
    assert.equal(res.record.confidence, MEMORY_CONFIDENCE.BLOCKED);
    assert.ok(res.record.flags.includes(MEMORY_FLAGS.IS_BLOCKED));
    ok("3.1 — blockMemory sets status/confidence/flags correctly");
  } catch (e) { fail("3.1 — blockMemory sets status/confidence/flags correctly", e.message); }

  // Blocked memory excluded from searchRelevantMemory
  const rel = await searchRelevantMemory({}, env);
  try {
    const found = rel.results.find((m) => m.memory_id === "pr4-block-001");
    assert.equal(found, undefined, "blocked memory should NOT appear in searchRelevantMemory");
    ok("3.2 — blocked manual memory excluded from searchRelevantMemory");
  } catch (e) { fail("3.2 — blocked manual memory excluded from searchRelevantMemory", e.message); }

  // Blocked memory still findable with include_inactive
  const search = await searchMemory({ memory_type: MEMORY_TYPES.MEMORIA_MANUAL, include_inactive: true }, env);
  try {
    assert.ok(search.ok);
    const found = search.results.find((m) => m.memory_id === "pr4-block-001");
    assert.ok(found, "blocked memory should be findable with include_inactive");
    assert.equal(found.status, MEMORY_STATUS.BLOCKED);
    ok("3.3 — blocked memory findable via searchMemory with include_inactive");
  } catch (e) { fail("3.3 — blocked memory findable via searchMemory with include_inactive", e.message); }
}

// ============================================================================
// Test Group 4: Invalidate/expire manual memory
// ============================================================================
async function testInvalidateManualMemory() {
  const env = makeKVMock();
  const mem = buildManualMem("pr4-invalidate-001");
  await writeMemory(mem, env);

  const res = await invalidateMemory("pr4-invalidate-001", { invalidated_by: "panel" }, env);
  try {
    assert.ok(res.ok);
    assert.equal(res.record.status, MEMORY_STATUS.EXPIRED);
    assert.ok(res.record.flags.includes(MEMORY_FLAGS.IS_EXPIRED));
    ok("4.1 — invalidateMemory sets status to expired and adds flag");
  } catch (e) { fail("4.1 — invalidateMemory sets status to expired and adds flag", e.message); }

  // Expired memory excluded from searchRelevantMemory
  const rel = await searchRelevantMemory({}, env);
  try {
    const found = rel.results.find((m) => m.memory_id === "pr4-invalidate-001");
    assert.equal(found, undefined);
    ok("4.2 — invalidated manual memory excluded from searchRelevantMemory");
  } catch (e) { fail("4.2 — invalidated manual memory excluded from searchRelevantMemory", e.message); }
}

// ============================================================================
// Test Group 5: Manual memory appears in retrieval as manual_instructions
// ============================================================================
async function testRetrievalClassification() {
  const env = makeKVMock();
  const mem = buildManualMem("pr4-retrieval-001");
  await writeMemory(mem, env);

  // _classifyMemory should return manual_instructions for memoria_manual
  const classification = _classifyMemory(mem);
  try {
    assert.equal(classification, "manual_instructions");
    ok("5.1 — _classifyMemory returns 'manual_instructions' for memoria_manual");
  } catch (e) { fail("5.1 — _classifyMemory returns 'manual_instructions' for memoria_manual", e.message); }

  // Also test with source="panel" on a different type
  const memWithSource = buildMemoryObject({
    ...mem,
    memory_id: "pr4-retrieval-002",
    memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
    source: "panel",
  });
  const classification2 = _classifyMemory(memWithSource);
  try {
    assert.equal(classification2, "manual_instructions");
    ok("5.2 — _classifyMemory returns 'manual_instructions' for source='panel'");
  } catch (e) { fail("5.2 — _classifyMemory returns 'manual_instructions' for source='panel'", e.message); }

  // Full retrieval pipeline
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.ok(retrieval.blocks.manual_instructions.count > 0, "manual_instructions block should have items");
    const found = retrieval.blocks.manual_instructions.items.find((m) => m.memory_id === "pr4-retrieval-001");
    assert.ok(found, "manual memory should be in manual_instructions block");
    assert.equal(found._pr3_block, "manual_instructions");
    ok("5.3 — buildRetrievalContext places manual memory in manual_instructions block");
  } catch (e) { fail("5.3 — buildRetrievalContext places manual memory in manual_instructions block", e.message); }
}

// ============================================================================
// Test Group 6: Blocked manual memory leaves retrieval
// ============================================================================
async function testBlockedLeavesRetrieval() {
  const env = makeKVMock();
  const mem1 = buildManualMem("pr4-blocked-ret-001");
  const mem2 = buildManualMem("pr4-blocked-ret-002");
  await writeMemory(mem1, env);
  await writeMemory(mem2, env);

  // Block one
  await blockMemory("pr4-blocked-ret-001", {}, env);

  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    const ids = retrieval.blocks.manual_instructions.items.map((m) => m.memory_id);
    assert.ok(!ids.includes("pr4-blocked-ret-001"), "blocked memory should NOT be in retrieval");
    assert.ok(ids.includes("pr4-blocked-ret-002"), "active memory should be in retrieval");
    ok("6.1 — blocked manual memory excluded, active manual memory included in retrieval");
  } catch (e) { fail("6.1 — blocked manual memory excluded, active manual memory included in retrieval", e.message); }
}

// ============================================================================
// Test Group 7: Non-regression — existing schema/storage/retrieval works
// ============================================================================
async function testNonRegression() {
  const env = makeKVMock();

  // Write a canonical rule (non-manual)
  const canonicalMem = buildMemoryObject({
    memory_id:          "nr-canonical-001",
    memory_type:        MEMORY_TYPES.CANONICAL_RULES,
    entity_type:        ENTITY_TYPES.RULE,
    entity_id:          "nr-canonical-001",
    title:              "Canonical rule test",
    content_structured: { text: "A canonical rule" },
    priority:           MEMORY_PRIORITY.CRITICAL,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "system",
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
    is_canonical:       true,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               [],
  });
  const w1 = await writeMemory(canonicalMem, env);
  try { assert.ok(w1.ok); ok("7.1 — canonical_rules still writes correctly"); }
  catch (e) { fail("7.1 — canonical_rules still writes correctly", e.message); }

  // Write an operational history
  const opMem = buildMemoryObject({
    memory_id:          "nr-op-001",
    memory_type:        MEMORY_TYPES.OPERATIONAL_HISTORY,
    entity_type:        ENTITY_TYPES.OPERATION,
    entity_id:          "nr-op-001",
    title:              "Op history test",
    content_structured: { text: "An operation" },
    priority:           MEMORY_PRIORITY.MEDIUM,
    confidence:         MEMORY_CONFIDENCE.HIGH,
    source:             "executor",
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               [],
  });
  const w2 = await writeMemory(opMem, env);
  try { assert.ok(w2.ok); ok("7.2 — operational_history still writes correctly"); }
  catch (e) { fail("7.2 — operational_history still writes correctly", e.message); }

  // Search all active
  const all = await searchMemory({}, env);
  try {
    assert.ok(all.ok);
    assert.equal(all.count, 2);
    ok("7.3 — searchMemory returns both types correctly");
  } catch (e) { fail("7.3 — searchMemory returns both types correctly", e.message); }

  // Retrieval separates them
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.ok(retrieval.blocks.validated_learning.count > 0 || retrieval.blocks.historical_memory.count > 0);
    assert.equal(retrieval.blocks.manual_instructions.count, 0, "no manual_instructions expected");
    ok("7.4 — retrieval pipeline separates canonical/operational correctly, no false manual_instructions");
  } catch (e) { fail("7.4 — retrieval pipeline separates correctly", e.message); }

  // Validate schema still works for all known types
  for (const typeName of ["conversa_atual", "memoria_longa", "memoria_manual", "aprendizado_validado", "memoria_temporaria"]) {
    const testMem = buildMemoryObject({
      memory_id: `nr-type-${typeName}`,
      memory_type: typeName,
      entity_type: ENTITY_TYPES.CONTEXT,
      entity_id: `nr-type-${typeName}`,
      title: `Type test ${typeName}`,
      content_structured: { text: "test" },
      source: "test",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: typeName === "memoria_temporaria" ? new Date(Date.now() + 86400000).toISOString() : null,
      flags: [],
      tags: [],
    });
    const v = validateMemoryObject(testMem);
    try {
      assert.ok(v.valid, `${typeName} validation errors: ${(v.errors || []).join(", ")}`);
    } catch (e) {
      fail(`7.5 — PR2 type '${typeName}' schema validation`, e.message);
      continue;
    }
  }
  ok("7.5 — all PR2 memory types pass schema validation");
}

// ============================================================================
// Runner
// ============================================================================
async function main() {
  console.log("\n🧪 PR4 — Manual Memory Smoke Tests\n");

  await testCreateManualMemory();
  await testEditManualMemory();
  await testBlockManualMemory();
  await testInvalidateManualMemory();
  await testRetrievalClassification();
  await testBlockedLeavesRetrieval();
  await testNonRegression();

  console.log(results.join("\n"));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    console.log("\n❌ SOME TESTS FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ ALL TESTS PASSED");
  }
}

main();
