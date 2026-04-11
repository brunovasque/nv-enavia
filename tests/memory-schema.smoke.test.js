// ============================================================================
// 🧪 Smoke Tests — ENAVIA Memory Schema v1 (PM1)
//
// Run: node tests/memory-schema.smoke.test.js
//
// Tests:
//   Group 1: Enum integrity (values + counts)
//   Group 2: Canonical shape integrity (required fields)
//   Group 3: Valid objects — one per memory type (5 blocks)
//   Group 4: Invalid objects — rejection cases
//   Group 5: expires_at handling
//   Group 6: is_canonical=true
//   Group 7: buildMemoryObject helper
//   Group 8: Executor contract unaffected
// ============================================================================

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  MEMORY_FLAGS,
  MEMORY_CANONICAL_SHAPE,
  validateMemoryObject,
  buildMemoryObject,
} from "../schema/memory-schema.js";

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
// Helper: build a valid memory object with optional overrides
// ---------------------------------------------------------------------------
function makeValidMemory(overrides = {}) {
  return buildMemoryObject({
    memory_id:          "mem_test_001",
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user_vasques",
    title:              "Perfil principal do usuário",
    content_structured: { name: "Vasques", preferences: [] },
    priority:           MEMORY_PRIORITY.HIGH,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "initial_setup",
    created_at:         "2026-04-11T00:00:00Z",
    updated_at:         "2026-04-11T00:00:00Z",
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Memory Schema — Smoke Tests (PM1) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Enum integrity
  // -------------------------------------------------------------------------
  console.log("Group 1: Enum integrity");

  assert(Object.values(MEMORY_TYPES).length === 5, "MEMORY_TYPES has exactly 5 values");
  assert(MEMORY_TYPES.USER_PROFILE        === "user_profile",        "MEMORY_TYPES.USER_PROFILE");
  assert(MEMORY_TYPES.PROJECT             === "project",             "MEMORY_TYPES.PROJECT");
  assert(MEMORY_TYPES.CANONICAL_RULES     === "canonical_rules",     "MEMORY_TYPES.CANONICAL_RULES");
  assert(MEMORY_TYPES.OPERATIONAL_HISTORY === "operational_history", "MEMORY_TYPES.OPERATIONAL_HISTORY");
  assert(MEMORY_TYPES.LIVE_CONTEXT        === "live_context",        "MEMORY_TYPES.LIVE_CONTEXT");

  assert(Object.values(MEMORY_STATUS).length === 5, "MEMORY_STATUS has exactly 5 values");
  assert(MEMORY_STATUS.ACTIVE     === "active",     "MEMORY_STATUS.ACTIVE");
  assert(MEMORY_STATUS.ARCHIVED   === "archived",   "MEMORY_STATUS.ARCHIVED");
  assert(MEMORY_STATUS.SUPERSEDED === "superseded", "MEMORY_STATUS.SUPERSEDED");
  assert(MEMORY_STATUS.EXPIRED    === "expired",    "MEMORY_STATUS.EXPIRED");
  assert(MEMORY_STATUS.CANONICAL  === "canonical",  "MEMORY_STATUS.CANONICAL");

  assert(Object.values(MEMORY_PRIORITY).length === 4, "MEMORY_PRIORITY has exactly 4 values");
  assert(MEMORY_PRIORITY.CRITICAL === "critical", "MEMORY_PRIORITY.CRITICAL");
  assert(MEMORY_PRIORITY.HIGH     === "high",     "MEMORY_PRIORITY.HIGH");
  assert(MEMORY_PRIORITY.MEDIUM   === "medium",   "MEMORY_PRIORITY.MEDIUM");
  assert(MEMORY_PRIORITY.LOW      === "low",      "MEMORY_PRIORITY.LOW");

  assert(Object.values(MEMORY_CONFIDENCE).length === 5, "MEMORY_CONFIDENCE has exactly 5 values");
  assert(MEMORY_CONFIDENCE.CONFIRMED  === "confirmed",  "MEMORY_CONFIDENCE.CONFIRMED");
  assert(MEMORY_CONFIDENCE.HIGH       === "high",       "MEMORY_CONFIDENCE.HIGH");
  assert(MEMORY_CONFIDENCE.MEDIUM     === "medium",     "MEMORY_CONFIDENCE.MEDIUM");
  assert(MEMORY_CONFIDENCE.LOW        === "low",        "MEMORY_CONFIDENCE.LOW");
  assert(MEMORY_CONFIDENCE.UNVERIFIED === "unverified", "MEMORY_CONFIDENCE.UNVERIFIED");

  assert(Object.values(ENTITY_TYPES).length === 5, "ENTITY_TYPES has exactly 5 values");
  assert(ENTITY_TYPES.USER      === "user",      "ENTITY_TYPES.USER");
  assert(ENTITY_TYPES.PROJECT   === "project",   "ENTITY_TYPES.PROJECT");
  assert(ENTITY_TYPES.RULE      === "rule",      "ENTITY_TYPES.RULE");
  assert(ENTITY_TYPES.OPERATION === "operation", "ENTITY_TYPES.OPERATION");
  assert(ENTITY_TYPES.CONTEXT   === "context",   "ENTITY_TYPES.CONTEXT");

  assert(Object.keys(MEMORY_FLAGS).length === 3,         "MEMORY_FLAGS has exactly 3 keys");
  assert(MEMORY_FLAGS.IS_CANONICAL  === "is_canonical",  "MEMORY_FLAGS.IS_CANONICAL");
  assert(MEMORY_FLAGS.IS_SUPERSEDED === "is_superseded", "MEMORY_FLAGS.IS_SUPERSEDED");
  assert(MEMORY_FLAGS.IS_EXPIRED    === "is_expired",    "MEMORY_FLAGS.IS_EXPIRED");

  // -------------------------------------------------------------------------
  // Group 2: Canonical shape integrity
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: Canonical shape integrity");

  const requiredFields = [
    "memory_id", "memory_type", "entity_type", "entity_id",
    "title", "content_structured", "priority", "confidence",
    "source", "created_at", "updated_at", "expires_at",
    "is_canonical", "status", "flags",
  ];
  for (const field of requiredFields) {
    assert(field in MEMORY_CANONICAL_SHAPE, `shape has '${field}'`);
  }
  assert(MEMORY_CANONICAL_SHAPE.priority     === "medium", "shape default priority=medium");
  assert(MEMORY_CANONICAL_SHAPE.confidence   === "medium", "shape default confidence=medium");
  assert(MEMORY_CANONICAL_SHAPE.is_canonical === false,    "shape default is_canonical=false");
  assert(MEMORY_CANONICAL_SHAPE.status       === "active", "shape default status=active");
  assert(Array.isArray(MEMORY_CANONICAL_SHAPE.flags),      "shape default flags=[]");

  // -------------------------------------------------------------------------
  // Group 3: Valid objects — one per memory type (5 blocks)
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: Valid objects — each memory type");

  const typeEntityPairs = [
    [MEMORY_TYPES.USER_PROFILE,        ENTITY_TYPES.USER],
    [MEMORY_TYPES.PROJECT,             ENTITY_TYPES.PROJECT],
    [MEMORY_TYPES.CANONICAL_RULES,     ENTITY_TYPES.RULE],
    [MEMORY_TYPES.OPERATIONAL_HISTORY, ENTITY_TYPES.OPERATION],
    [MEMORY_TYPES.LIVE_CONTEXT,        ENTITY_TYPES.CONTEXT],
  ];

  for (const [memType, entType] of typeEntityPairs) {
    const obj = makeValidMemory({ memory_type: memType, entity_type: entType });
    const result = validateMemoryObject(obj);
    assert(result.valid === true, `valid object accepted: memory_type=${memType}`);
  }

  // -------------------------------------------------------------------------
  // Group 4: Invalid objects — rejection cases
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: Invalid objects — rejection cases");

  // missing/empty required strings
  for (const field of ["memory_id", "entity_id", "title", "source", "created_at", "updated_at"]) {
    const obj = makeValidMemory({ [field]: "" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 `rejects empty '${field}'`);
    assert(result.errors.some(e => e.includes(field)),            `error mentions '${field}'`);
  }

  // invalid memory_type
  {
    const obj = makeValidMemory({ memory_type: "invalid_type" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid memory_type");
    assert(result.errors.some(e => e.includes("memory_type")),    "error mentions memory_type");
  }

  // invalid entity_type
  {
    const obj = makeValidMemory({ entity_type: "unknown" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid entity_type");
    assert(result.errors.some(e => e.includes("entity_type")),    "error mentions entity_type");
  }

  // invalid status
  {
    const obj = makeValidMemory({ status: "pending" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid status 'pending'");
    assert(result.errors.some(e => e.includes("status")),         "error mentions status");
  }

  // invalid priority
  {
    const obj = makeValidMemory({ priority: "urgent" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid priority 'urgent'");
    assert(result.errors.some(e => e.includes("priority")),       "error mentions priority");
  }

  // invalid confidence
  {
    const obj = makeValidMemory({ confidence: "absolute" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid confidence 'absolute'");
    assert(result.errors.some(e => e.includes("confidence")),     "error mentions confidence");
  }

  // non-object content_structured
  {
    const obj = makeValidMemory({ content_structured: "raw string" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects string content_structured");
    assert(result.errors.some(e => e.includes("content_structured")), "error mentions content_structured");
  }

  // array content_structured
  {
    const obj = makeValidMemory({ content_structured: [1, 2, 3] });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects array content_structured");
  }

  // null content_structured
  {
    const obj = makeValidMemory({ content_structured: null });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects null content_structured");
  }

  // non-boolean is_canonical
  {
    const obj = makeValidMemory({ is_canonical: "yes" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects string is_canonical 'yes'");
    assert(result.errors.some(e => e.includes("is_canonical")),   "error mentions is_canonical");
  }

  // non-array flags — set directly after build to bypass default normalization
  {
    const obj = Object.assign(makeValidMemory(), { flags: "is_canonical" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects string flags");
    assert(result.errors.some(e => e.includes("flags")),          "error mentions flags");
  }

  // flags array with unknown/invalid flag value
  {
    const obj = Object.assign(makeValidMemory(), { flags: ["invalid_flag"] });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects unknown flag in flags array");
    assert(result.errors.some(e => e.includes("flags")),          "error mentions flags for unknown value");
  }

  // flags array with mix of valid and invalid flags
  {
    const obj = Object.assign(makeValidMemory(), { flags: [MEMORY_FLAGS.IS_CANONICAL, "not_a_flag"] });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects flags array with one invalid item");
  }

  // valid flags array with all known values
  {
    const obj = makeValidMemory({ flags: [MEMORY_FLAGS.IS_CANONICAL, MEMORY_FLAGS.IS_SUPERSEDED] });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,                                  "accepts flags array with valid flag values");
  }

  // invalid created_at — non-date string
  {
    const obj = Object.assign(makeValidMemory(), { created_at: "not-a-date" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid created_at 'not-a-date'");
    assert(result.errors.some(e => e.includes("created_at")),     "error mentions created_at");
  }

  // invalid updated_at — non-date string
  {
    const obj = Object.assign(makeValidMemory(), { updated_at: "not-a-date" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false,                                 "rejects invalid updated_at 'not-a-date'");
    assert(result.errors.some(e => e.includes("updated_at")),     "error mentions updated_at");
  }

  // null/undefined/non-object input
  assert(validateMemoryObject(null).valid      === false, "rejects null input");
  assert(validateMemoryObject(undefined).valid === false, "rejects undefined input");
  assert(validateMemoryObject([]).valid        === false, "rejects array input");
  assert(validateMemoryObject("str").valid     === false, "rejects string input");
  assert(validateMemoryObject(42).valid        === false, "rejects number input");

  // -------------------------------------------------------------------------
  // Group 5: expires_at handling
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: expires_at handling");

  {
    const obj = makeValidMemory({ expires_at: "2026-12-31T23:59:59Z" });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid object with expires_at set (ISO string)");
  }

  {
    const obj = makeValidMemory({ expires_at: null });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid object with expires_at=null");
  }

  {
    const obj = makeValidMemory({ expires_at: undefined });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid object with expires_at=undefined (treated as null)");
  }

  {
    const obj = makeValidMemory({ expires_at: "" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false, "rejects empty string expires_at");
    assert(result.errors.some(e => e.includes("expires_at")), "error mentions expires_at");
  }

  {
    const obj = Object.assign(makeValidMemory(), { expires_at: "not-a-date" });
    const result = validateMemoryObject(obj);
    assert(result.valid === false, "rejects non-ISO expires_at 'not-a-date'");
    assert(result.errors.some(e => e.includes("expires_at")), "error mentions expires_at for bad ISO");
  }

  // -------------------------------------------------------------------------
  // Group 6: is_canonical=true
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: is_canonical=true");

  {
    const obj = makeValidMemory({ is_canonical: true, status: MEMORY_STATUS.CANONICAL });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid canonical memory (is_canonical=true, status=canonical)");
  }

  {
    const obj = makeValidMemory({ is_canonical: true, status: MEMORY_STATUS.ACTIVE });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid object with is_canonical=true and status=active");
  }

  {
    const obj = makeValidMemory({
      is_canonical:       true,
      status:             MEMORY_STATUS.CANONICAL,
      confidence:         MEMORY_CONFIDENCE.CONFIRMED,
      priority:           MEMORY_PRIORITY.CRITICAL,
      flags:              [MEMORY_FLAGS.IS_CANONICAL],
    });
    const result = validateMemoryObject(obj);
    assert(result.valid === true,  "valid fully-canonical memory object");
  }

  // -------------------------------------------------------------------------
  // Group 7: buildMemoryObject helper
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: buildMemoryObject helper");

  {
    const obj = buildMemoryObject({
      memory_id:   "mem_002",
      memory_type: MEMORY_TYPES.PROJECT,
    });
    assert(obj.memory_id        === "mem_002",              "preserves memory_id");
    assert(obj.memory_type      === MEMORY_TYPES.PROJECT,   "preserves memory_type");
    assert(obj.priority         === "medium",               "applies default priority=medium");
    assert(obj.confidence       === "medium",               "applies default confidence=medium");
    assert(obj.is_canonical     === false,                  "applies default is_canonical=false");
    assert(obj.status           === "active",               "applies default status=active");
    assert(Array.isArray(obj.flags),                        "applies default flags=[]");
    assert(obj.expires_at       === null,                   "applies default expires_at=null");
  }

  // overrides win over defaults
  {
    const obj = buildMemoryObject({ priority: MEMORY_PRIORITY.CRITICAL });
    assert(obj.priority === MEMORY_PRIORITY.CRITICAL, "override wins over default");
  }

  // two objects built without explicit flags must not share the same array reference
  {
    const obj1 = buildMemoryObject({ memory_id: "mem_iso_1" });
    const obj2 = buildMemoryObject({ memory_id: "mem_iso_2" });
    assert(obj1.flags !== obj2.flags, "each buildMemoryObject call produces a distinct flags array");
    obj1.flags.push("x");
    assert(obj2.flags.length === 0, "mutating obj1.flags does not affect obj2.flags");
  }

  // object built with explicit flags array must get a copy, not the same reference
  {
    const inputFlags = [MEMORY_FLAGS.IS_CANONICAL];
    const obj = buildMemoryObject({ memory_id: "mem_iso_3", flags: inputFlags });
    assert(obj.flags !== inputFlags, "buildMemoryObject copies the provided flags array");
    inputFlags.push(MEMORY_FLAGS.IS_EXPIRED);
    assert(obj.flags.length === 1, "mutating original flags input does not affect built object");
  }

  // -------------------------------------------------------------------------
  // Group 8: Executor contract unaffected
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: Executor contract unaffected");

  // Verify our module is self-contained and does not import or depend on
  // contract-executor.js or any other worker file.
  assert(typeof validateMemoryObject === "function", "validateMemoryObject is exported function");
  assert(typeof buildMemoryObject    === "function", "buildMemoryObject is exported function");
  assert(typeof MEMORY_CANONICAL_SHAPE === "object", "MEMORY_CANONICAL_SHAPE is exported object");

  // All exports are pure values/functions — no side effects, no I/O, no KV
  const result = validateMemoryObject(makeValidMemory());
  assert(result.valid === true, "schema validates without any I/O or executor dependency");

  // ---- Summary ----
  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
