// ============================================================================
// 🧪 Smoke Tests — PR6: Telemetria / Auditoria da Memória e do Aprendizado
//
// Run: node tests/pr6-memory-audit.smoke.test.js
//
// Prova que:
//   1. writeMemory gera evento de auditoria (memory_created)
//   2. updateMemory gera evento de auditoria (memory_updated)
//   3. blockMemory gera evento de auditoria (memory_blocked)
//   4. invalidateMemory gera evento de auditoria (memory_invalidated)
//   5. registerLearningCandidate gera evento (candidate_registered)
//   6. approveLearningCandidate gera evento e vincula promoted_memory_id (candidate_approved)
//   7. rejectLearningCandidate gera evento (candidate_rejected)
//   8. listAuditEvents retorna eventos com filtros corretos
//   9. PR1–PR5 não quebrou (módulos importam e funcionam normalmente)
// ============================================================================

import {
  emitAuditEvent,
  listAuditEvents,
  getAuditEventById,
  AUDIT_EVENT_TYPES,
  AUDIT_TARGET_TYPES,
} from "../schema/memory-audit-log.js";

import {
  writeMemory,
  readMemoryById,
  updateMemory,
  blockMemory,
  invalidateMemory,
} from "../schema/memory-storage.js";

import {
  registerLearningCandidate,
  listLearningCandidates,
  approveLearningCandidate,
  rejectLearningCandidate,
  CANDIDATE_STATUS,
} from "../schema/learning-candidates.js";

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  buildMemoryObject,
  validateMemoryObject,
} from "../schema/memory-schema.js";

import {
  searchMemory,
  searchRelevantMemory,
} from "../schema/memory-read.js";

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
// Helper: build a valid memory object with optional overrides
// ---------------------------------------------------------------------------
function makeValidMemory(overrides = {}) {
  const now = new Date().toISOString();
  return buildMemoryObject({
    memory_id:          "mem-pr6-001",
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user-001",
    title:              "PR6 test memory",
    content_structured: { test: true },
    priority:           MEMORY_PRIORITY.MEDIUM,
    confidence:         MEMORY_CONFIDENCE.HIGH,
    source:             "pr6_test",
    created_at:         now,
    updated_at:         now,
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               ["pr6", "test"],
    ...overrides,
  });
}

// ============================================================================
// Group 1: writeMemory generates audit event
// ============================================================================
async function testGroup1() {
  console.log("\n📋 Group 1: writeMemory gera evento de auditoria");
  const env = makeKVMock();
  const mem = makeValidMemory({ memory_id: "mem-pr6-write-001" });

  const writeResult = await writeMemory(mem, env);
  try {
    assert.equal(writeResult.ok, true);
    ok("writeMemory succeeded");
  } catch (e) { fail("writeMemory succeeded", e.message); }

  // Check audit event was created
  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.MEMORY_CREATED }, env);
  try {
    assert.equal(auditResult.ok, true);
    assert.ok(auditResult.items.length >= 1, "should have at least 1 audit event");
    const ev = auditResult.items.find(e => e.target_id === "mem-pr6-write-001");
    assert.ok(ev, "should find audit event for the written memory");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.MEMORY_CREATED);
    assert.equal(ev.target_type, AUDIT_TARGET_TYPES.MEMORY);
    assert.equal(ev.target_id, "mem-pr6-write-001");
    assert.ok(ev.event_id, "event_id should exist");
    assert.ok(ev.timestamp, "timestamp should exist");
    assert.ok(ev.summary, "summary should exist");
    assert.equal(ev.source, "pr6_test");
    ok("writeMemory generated memory_created audit event with correct fields");
  } catch (e) { fail("writeMemory generated audit event", e.message); }
}

// ============================================================================
// Group 2: updateMemory generates audit event
// ============================================================================
async function testGroup2() {
  console.log("\n📋 Group 2: updateMemory gera evento de auditoria");
  const env = makeKVMock();
  const mem = makeValidMemory({ memory_id: "mem-pr6-update-001" });
  await writeMemory(mem, env);

  const updateResult = await updateMemory("mem-pr6-update-001", { title: "Updated title" }, env);
  try {
    assert.equal(updateResult.ok, true);
    ok("updateMemory succeeded");
  } catch (e) { fail("updateMemory succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.MEMORY_UPDATED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "mem-pr6-update-001");
    assert.ok(ev, "should find audit event for the updated memory");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.MEMORY_UPDATED);
    assert.equal(ev.target_type, AUDIT_TARGET_TYPES.MEMORY);
    ok("updateMemory generated memory_updated audit event");
  } catch (e) { fail("updateMemory generated audit event", e.message); }
}

// ============================================================================
// Group 3: blockMemory generates audit event
// ============================================================================
async function testGroup3() {
  console.log("\n📋 Group 3: blockMemory gera evento de auditoria");
  const env = makeKVMock();
  const mem = makeValidMemory({ memory_id: "mem-pr6-block-001" });
  await writeMemory(mem, env);

  const blockResult = await blockMemory("mem-pr6-block-001", { blocked_by: "panel" }, env);
  try {
    assert.equal(blockResult.ok, true);
    ok("blockMemory succeeded");
  } catch (e) { fail("blockMemory succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.MEMORY_BLOCKED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "mem-pr6-block-001");
    assert.ok(ev, "should find audit event for the blocked memory");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.MEMORY_BLOCKED);
    assert.equal(ev.source, "panel");
    ok("blockMemory generated memory_blocked audit event");
  } catch (e) { fail("blockMemory generated audit event", e.message); }
}

// ============================================================================
// Group 4: invalidateMemory generates audit event
// ============================================================================
async function testGroup4() {
  console.log("\n📋 Group 4: invalidateMemory gera evento de auditoria");
  const env = makeKVMock();
  const mem = makeValidMemory({ memory_id: "mem-pr6-invalidate-001" });
  await writeMemory(mem, env);

  const invalidateResult = await invalidateMemory("mem-pr6-invalidate-001", { invalidated_by: "panel" }, env);
  try {
    assert.equal(invalidateResult.ok, true);
    ok("invalidateMemory succeeded");
  } catch (e) { fail("invalidateMemory succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.MEMORY_INVALIDATED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "mem-pr6-invalidate-001");
    assert.ok(ev, "should find audit event for the invalidated memory");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.MEMORY_INVALIDATED);
    assert.equal(ev.source, "panel");
    ok("invalidateMemory generated memory_invalidated audit event");
  } catch (e) { fail("invalidateMemory generated audit event", e.message); }
}

// ============================================================================
// Group 5: registerLearningCandidate generates audit event
// ============================================================================
async function testGroup5() {
  console.log("\n📋 Group 5: registerLearningCandidate gera evento de auditoria");
  const env = makeKVMock();
  const candidate = {
    candidate_id: "lc-pr6-register-001",
    title: "PR6 test candidate",
    content_structured: { text: "Test learning rule" },
    source: "pr6_test",
  };

  const regResult = await registerLearningCandidate(candidate, env);
  try {
    assert.equal(regResult.ok, true);
    ok("registerLearningCandidate succeeded");
  } catch (e) { fail("registerLearningCandidate succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.CANDIDATE_REGISTERED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "lc-pr6-register-001");
    assert.ok(ev, "should find audit event for the registered candidate");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.CANDIDATE_REGISTERED);
    assert.equal(ev.target_type, AUDIT_TARGET_TYPES.LEARNING_CANDIDATE);
    assert.equal(ev.source, "pr6_test");
    ok("registerLearningCandidate generated candidate_registered audit event");
  } catch (e) { fail("registerLearningCandidate generated audit event", e.message); }
}

// ============================================================================
// Group 6: approveLearningCandidate generates audit event and links promoted_memory_id
// ============================================================================
async function testGroup6() {
  console.log("\n📋 Group 6: approveLearningCandidate gera evento e vincula promoted_memory_id");
  const env = makeKVMock();
  const candidate = {
    candidate_id: "lc-pr6-approve-001",
    title: "PR6 approved candidate",
    content_structured: { text: "Approved learning rule" },
    source: "pr6_test",
    confidence: "medium",
    priority: "medium",
    tags: ["pr6"],
  };

  await registerLearningCandidate(candidate, env);
  const approveResult = await approveLearningCandidate("lc-pr6-approve-001", env);
  try {
    assert.equal(approveResult.ok, true);
    assert.ok(approveResult.promoted_memory_id, "promoted_memory_id should exist");
    ok("approveLearningCandidate succeeded with promoted_memory_id");
  } catch (e) { fail("approveLearningCandidate succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.CANDIDATE_APPROVED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "lc-pr6-approve-001");
    assert.ok(ev, "should find audit event for the approved candidate");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.CANDIDATE_APPROVED);
    assert.equal(ev.target_type, AUDIT_TARGET_TYPES.LEARNING_CANDIDATE);
    assert.equal(ev.related_id, approveResult.promoted_memory_id, "related_id should link to promoted_memory_id");
    assert.ok(ev.summary.includes(approveResult.promoted_memory_id), "summary should mention promoted memory");
    ok("approveLearningCandidate generated candidate_approved event with promoted_memory_id link");
  } catch (e) { fail("approveLearningCandidate generated linked audit event", e.message); }
}

// ============================================================================
// Group 7: rejectLearningCandidate generates audit event
// ============================================================================
async function testGroup7() {
  console.log("\n📋 Group 7: rejectLearningCandidate gera evento de auditoria");
  const env = makeKVMock();
  const candidate = {
    candidate_id: "lc-pr6-reject-001",
    title: "PR6 rejected candidate",
    content_structured: { text: "Rejected learning rule" },
    source: "pr6_test",
  };

  await registerLearningCandidate(candidate, env);
  const rejectResult = await rejectLearningCandidate("lc-pr6-reject-001", "Regra não aplicável", env);
  try {
    assert.equal(rejectResult.ok, true);
    ok("rejectLearningCandidate succeeded");
  } catch (e) { fail("rejectLearningCandidate succeeded", e.message); }

  const auditResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.CANDIDATE_REJECTED }, env);
  try {
    assert.equal(auditResult.ok, true);
    const ev = auditResult.items.find(e => e.target_id === "lc-pr6-reject-001");
    assert.ok(ev, "should find audit event for the rejected candidate");
    assert.equal(ev.event_type, AUDIT_EVENT_TYPES.CANDIDATE_REJECTED);
    assert.ok(ev.summary.includes("Regra não aplicável"), "summary should include rejection reason");
    ok("rejectLearningCandidate generated candidate_rejected audit event");
  } catch (e) { fail("rejectLearningCandidate generated audit event", e.message); }
}

// ============================================================================
// Group 8: listAuditEvents with filters works correctly
// ============================================================================
async function testGroup8() {
  console.log("\n📋 Group 8: listAuditEvents retorna eventos com filtros corretos");
  const env = makeKVMock();

  // Emit a few events manually
  await emitAuditEvent({
    event_type: AUDIT_EVENT_TYPES.MEMORY_CREATED,
    target_type: AUDIT_TARGET_TYPES.MEMORY,
    target_id: "mem-filter-001",
    source: "test",
    summary: "Created mem 1",
  }, env);
  await emitAuditEvent({
    event_type: AUDIT_EVENT_TYPES.MEMORY_BLOCKED,
    target_type: AUDIT_TARGET_TYPES.MEMORY,
    target_id: "mem-filter-002",
    source: "test",
    summary: "Blocked mem 2",
  }, env);
  await emitAuditEvent({
    event_type: AUDIT_EVENT_TYPES.CANDIDATE_REGISTERED,
    target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
    target_id: "lc-filter-001",
    source: "test",
    summary: "Registered candidate 1",
  }, env);

  // List all
  const allResult = await listAuditEvents({}, env);
  try {
    assert.equal(allResult.ok, true);
    assert.equal(allResult.count, 3);
    ok("listAuditEvents returns all events");
  } catch (e) { fail("listAuditEvents returns all events", e.message); }

  // Filter by event_type
  const blockedResult = await listAuditEvents({ event_type: AUDIT_EVENT_TYPES.MEMORY_BLOCKED }, env);
  try {
    assert.equal(blockedResult.ok, true);
    assert.equal(blockedResult.count, 1);
    assert.equal(blockedResult.items[0].target_id, "mem-filter-002");
    ok("listAuditEvents filters by event_type");
  } catch (e) { fail("listAuditEvents filters by event_type", e.message); }

  // Filter by target_type
  const candidateResult = await listAuditEvents({ target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE }, env);
  try {
    assert.equal(candidateResult.ok, true);
    assert.equal(candidateResult.count, 1);
    assert.equal(candidateResult.items[0].target_id, "lc-filter-001");
    ok("listAuditEvents filters by target_type");
  } catch (e) { fail("listAuditEvents filters by target_type", e.message); }

  // Filter by target_id
  const byIdResult = await listAuditEvents({ target_id: "mem-filter-001" }, env);
  try {
    assert.equal(byIdResult.ok, true);
    assert.equal(byIdResult.count, 1);
    assert.equal(byIdResult.items[0].event_type, AUDIT_EVENT_TYPES.MEMORY_CREATED);
    ok("listAuditEvents filters by target_id");
  } catch (e) { fail("listAuditEvents filters by target_id", e.message); }

  // Limit
  const limitResult = await listAuditEvents({ limit: 2 }, env);
  try {
    assert.equal(limitResult.ok, true);
    assert.equal(limitResult.count, 2);
    ok("listAuditEvents respects limit");
  } catch (e) { fail("listAuditEvents respects limit", e.message); }

  // getAuditEventById
  const eventId = allResult.items[0].event_id;
  const singleEvent = await getAuditEventById(eventId, env);
  try {
    assert.ok(singleEvent, "should find event by id");
    assert.equal(singleEvent.event_id, eventId);
    ok("getAuditEventById returns correct event");
  } catch (e) { fail("getAuditEventById returns correct event", e.message); }
}

// ============================================================================
// Group 9: PR1–PR5 não quebrou — módulos importam e funcionam normalmente
// ============================================================================
async function testGroup9() {
  console.log("\n📋 Group 9: PR1–PR5 não quebrou");
  const env = makeKVMock();

  // PR1: schema validates correctly
  try {
    const valid = validateMemoryObject(makeValidMemory({ memory_id: "pr1-check" }));
    assert.equal(valid.valid, true);
    ok("PR1: validateMemoryObject works");
  } catch (e) { fail("PR1: validateMemoryObject works", e.message); }

  // PR2: writeMemory + readMemoryById still work
  try {
    const mem = makeValidMemory({ memory_id: "pr2-check" });
    const w = await writeMemory(mem, env);
    assert.equal(w.ok, true);
    const r = await readMemoryById("pr2-check", env);
    assert.ok(r);
    assert.equal(r.memory_id, "pr2-check");
    ok("PR2: writeMemory + readMemoryById work");
  } catch (e) { fail("PR2: writeMemory + readMemoryById work", e.message); }

  // PR3: searchMemory + searchRelevantMemory still work
  try {
    const s = await searchMemory({}, env);
    assert.equal(s.ok, true);
    const r = await searchRelevantMemory({}, env);
    assert.equal(r.ok, true);
    ok("PR3: searchMemory + searchRelevantMemory work");
  } catch (e) { fail("PR3: searchMemory + searchRelevantMemory work", e.message); }

  // PR4: updateMemory + blockMemory + invalidateMemory still work
  try {
    const mem2 = makeValidMemory({ memory_id: "pr4-check" });
    await writeMemory(mem2, env);
    const u = await updateMemory("pr4-check", { title: "Updated" }, env);
    assert.equal(u.ok, true);
    ok("PR4: updateMemory works");
  } catch (e) { fail("PR4: updateMemory works", e.message); }

  // PR5: registerLearningCandidate + approveLearningCandidate + rejectLearningCandidate
  try {
    const c = await registerLearningCandidate({
      candidate_id: "pr5-check-a",
      title: "PR5 check",
      content_structured: { text: "test" },
      source: "test",
    }, env);
    assert.equal(c.ok, true);
    const a = await approveLearningCandidate("pr5-check-a", env);
    assert.equal(a.ok, true);
    assert.ok(a.promoted_memory_id);

    const c2 = await registerLearningCandidate({
      candidate_id: "pr5-check-b",
      title: "PR5 check reject",
      content_structured: { text: "test" },
      source: "test",
    }, env);
    assert.equal(c2.ok, true);
    const rj = await rejectLearningCandidate("pr5-check-b", "test", env);
    assert.equal(rj.ok, true);
    ok("PR5: learning candidate lifecycle works");
  } catch (e) { fail("PR5: learning candidate lifecycle works", e.message); }
}

// ============================================================================
// Group 10: emitAuditEvent validation
// ============================================================================
async function testGroup10() {
  console.log("\n📋 Group 10: emitAuditEvent validação de campos obrigatórios");
  const env = makeKVMock();

  // Missing env
  try {
    const r = await emitAuditEvent({}, null);
    assert.equal(r.ok, false);
    ok("emitAuditEvent rejects missing env");
  } catch (e) { fail("emitAuditEvent rejects missing env", e.message); }

  // Missing event_type
  try {
    const r = await emitAuditEvent({ target_type: "memory", target_id: "x", source: "test", summary: "s" }, env);
    assert.equal(r.ok, false);
    ok("emitAuditEvent rejects missing event_type");
  } catch (e) { fail("emitAuditEvent rejects missing event_type", e.message); }

  // Missing target_id
  try {
    const r = await emitAuditEvent({ event_type: "test", target_type: "memory", source: "test", summary: "s" }, env);
    assert.equal(r.ok, false);
    ok("emitAuditEvent rejects missing target_id");
  } catch (e) { fail("emitAuditEvent rejects missing target_id", e.message); }

  // Valid event
  try {
    const r = await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.MEMORY_CREATED,
      target_type: AUDIT_TARGET_TYPES.MEMORY,
      target_id: "val-001",
      source: "test",
      summary: "test event",
    }, env);
    assert.equal(r.ok, true);
    assert.ok(r.event_id);
    assert.ok(r.record);
    assert.equal(r.record.related_id, null);
    ok("emitAuditEvent accepts valid event");
  } catch (e) { fail("emitAuditEvent accepts valid event", e.message); }
}

// ============================================================================
// Run all tests
// ============================================================================
async function runAll() {
  console.log("═══════════════════════════════════════════════════════");
  console.log("  🧪 PR6 — Smoke Tests: Telemetria / Auditoria");
  console.log("═══════════════════════════════════════════════════════");

  await testGroup1();
  await testGroup2();
  await testGroup3();
  await testGroup4();
  await testGroup5();
  await testGroup6();
  await testGroup7();
  await testGroup8();
  await testGroup9();
  await testGroup10();

  console.log("\n───────────────────────────────────────────────────────");
  for (const r of results) console.log(r);
  console.log("───────────────────────────────────────────────────────");
  console.log(`\n  Total: ${passed + failed} | ✅ ${passed} | ❌ ${failed}`);
  console.log("═══════════════════════════════════════════════════════\n");

  if (failed > 0) process.exit(1);
}

runAll().catch((err) => {
  console.error("Uncaught error:", err);
  process.exit(1);
});
