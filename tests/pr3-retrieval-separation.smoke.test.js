// ============================================================================
// 🧪 Smoke Tests — PR3: Retrieval + Separação Histórico × Contexto Atual
//
// Run: node tests/pr3-retrieval-separation.smoke.test.js
//
// Valida o pipeline de retrieval da PR3 com separação explícita de blocos:
//   current_context, historical_memory, manual_instructions, validated_learning
//
// Tests:
//   Group 1: memória validada é lida antes da resposta
//   Group 2: instrução manual entra separada da memória histórica
//   Group 3: memória histórica relevante é recuperada
//   Group 4: memória antiga não domina contexto atual (staleness)
//   Group 5: em conflito, contexto atual vence
//   Group 6: memória stale é tratada como referência histórica
//   Group 7: chat/runtime atual não quebrou (não-regressão)
//   Group 8: ranking de relevância e recência
//   Group 9: edge cases e error handling
//   Group 10: conflito explícito por entity_id (contexto atual prevalece)
// ============================================================================

import {
  buildRetrievalContext,
  buildRetrievalSummary,
  STALENESS_THRESHOLD_MS,
  MAX_ITEMS_PER_BLOCK,
  _isStale,
  _recencyScore,
  _relevanceScore,
  _combinedScore,
  _classifyMemory,
  _annotateMemory,
  _sortByRanking,
  _detectExplicitConflicts,
} from "../schema/memory-retrieval.js";

import {
  writeMemory,
} from "../schema/memory-storage.js";

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  buildMemoryObject,
} from "../schema/memory-schema.js";

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

// ---------------------------------------------------------------------------
// Helper: write a test memory
// ---------------------------------------------------------------------------
async function writeTestMemory(partial, envMock) {
  const now = new Date().toISOString();
  const obj = buildMemoryObject({
    memory_id:   partial.memory_id || crypto.randomUUID(),
    memory_type: partial.memory_type || MEMORY_TYPES.OPERATIONAL_HISTORY,
    entity_type: partial.entity_type || ENTITY_TYPES.OPERATION,
    entity_id:   partial.entity_id   || "test-entity",
    title:       partial.title       || "Test Memory",
    content_structured: partial.content_structured || { data: "test" },
    priority:    partial.priority    || MEMORY_PRIORITY.MEDIUM,
    confidence:  partial.confidence  || MEMORY_CONFIDENCE.HIGH,
    source:      partial.source      || "test",
    created_at:  partial.created_at  || now,
    updated_at:  partial.updated_at  || now,
    expires_at:  partial.expires_at  || null,
    is_canonical: partial.is_canonical ?? false,
    status:      partial.status      || MEMORY_STATUS.ACTIVE,
    flags:       partial.flags       || [],
    tags:        partial.tags        || [],
  });
  const res = await writeMemory(obj, envMock);
  if (!res.ok) throw new Error(`writeTestMemory failed: ${res.error}`);
  return obj;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

async function runTests() {
  console.log("PR3 Retrieval + Separação — Smoke Tests\n");

  // ========================================================================
  // Group 1: Memória validada é lida antes da resposta
  // ========================================================================
  console.log("Group 1: memória validada é lida antes da resposta");
  {
    const env = makeKVMock();
    const now = Date.now();
    const recentDate = new Date(now - 1000).toISOString();

    await writeTestMemory({
      memory_id: "validated-001",
      memory_type: MEMORY_TYPES.CANONICAL_RULES,
      title: "Regra canônica de teste",
      is_canonical: true,
      status: MEMORY_STATUS.CANONICAL,
      confidence: MEMORY_CONFIDENCE.CONFIRMED,
      priority: MEMORY_PRIORITY.CRITICAL,
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.blocks.validated_learning.count === 1, "validated_learning has 1 item");
    ok(result.blocks.validated_learning.items[0].memory_id === "validated-001", "correct memory_id in validated_learning");
    ok(result.total_memories_read >= 1, "total_memories_read >= 1");
    ok(result.pipeline_version === "PR3-v1", "pipeline_version is PR3-v1");
  }

  // ========================================================================
  // Group 2: Instrução manual entra separada da memória histórica
  // ========================================================================
  console.log("\nGroup 2: instrução manual entra separada da memória histórica");
  {
    const env = makeKVMock();
    const now = Date.now();
    const recentDate = new Date(now - 1000).toISOString();

    // Manual instruction (source: panel)
    await writeTestMemory({
      memory_id: "manual-001",
      memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
      title: "Instrução manual do operador",
      source: "panel",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    // Historical memory (normal source)
    await writeTestMemory({
      memory_id: "hist-001",
      memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
      title: "Histórico operacional",
      source: "planner",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.blocks.manual_instructions.count === 1, "manual_instructions has 1 item");
    ok(result.blocks.historical_memory.count === 1, "historical_memory has 1 item");
    ok(result.blocks.manual_instructions.items[0].memory_id === "manual-001", "manual-001 in manual_instructions block");
    ok(result.blocks.historical_memory.items[0].memory_id === "hist-001", "hist-001 in historical_memory block");
  }

  // ========================================================================
  // Group 3: Memória histórica relevante é recuperada
  // ========================================================================
  console.log("\nGroup 3: memória histórica relevante é recuperada");
  {
    const env = makeKVMock();
    const now = Date.now();
    const recentDate = new Date(now - 5000).toISOString();

    await writeTestMemory({
      memory_id: "project-001",
      memory_type: MEMORY_TYPES.PROJECT,
      entity_type: ENTITY_TYPES.PROJECT,
      entity_id: "proj-alpha",
      title: "Projeto Alpha — dados",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    await writeTestMemory({
      memory_id: "user-001",
      memory_type: MEMORY_TYPES.USER_PROFILE,
      entity_type: ENTITY_TYPES.USER,
      entity_id: "user-1",
      title: "Perfil do usuário",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.blocks.historical_memory.count === 2, "historical_memory has 2 items");

    const ids = result.blocks.historical_memory.items.map((m) => m.memory_id);
    ok(ids.includes("project-001"), "project-001 in historical_memory");
    ok(ids.includes("user-001"), "user-001 in historical_memory");
  }

  // ========================================================================
  // Group 4: Memória antiga não domina contexto atual (staleness)
  // ========================================================================
  console.log("\nGroup 4: memória antiga não domina contexto atual");
  {
    const env = makeKVMock();
    const now = Date.now();
    const staleDate = new Date(now - STALENESS_THRESHOLD_MS - 1000).toISOString();
    const recentDate = new Date(now - 1000).toISOString();

    // Stale historical memory (>30 days old, medium confidence)
    await writeTestMemory({
      memory_id: "stale-001",
      memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
      title: "Memória operacional antiga",
      confidence: MEMORY_CONFIDENCE.MEDIUM,
      created_at: staleDate,
      updated_at: staleDate,
    }, env);

    // Current context (live)
    await writeTestMemory({
      memory_id: "current-001",
      memory_type: MEMORY_TYPES.LIVE_CONTEXT,
      title: "Contexto vivo atual",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.staleness_detected === true, "staleness_detected=true");
    ok(result.blocks.current_context.count === 1, "current_context has 1 item");
    ok(result.blocks.historical_memory.count === 1, "historical_memory has 1 item");

    const staleItem = result.blocks.historical_memory.items[0];
    ok(staleItem._pr3_stale === true, "stale memory is marked as stale");
    ok(staleItem._pr3_is_reference === true, "stale memory is marked as reference only");
  }

  // ========================================================================
  // Group 5: Em conflito, contexto atual vence
  // ========================================================================
  console.log("\nGroup 5: em conflito, contexto atual vence");
  {
    const env = makeKVMock();
    const now = Date.now();
    const staleDate = new Date(now - STALENESS_THRESHOLD_MS - 5000).toISOString();
    const recentDate = new Date(now - 500).toISOString();

    // Stale historical memory with low confidence
    await writeTestMemory({
      memory_id: "conflict-old-001",
      memory_type: MEMORY_TYPES.USER_PROFILE,
      entity_type: ENTITY_TYPES.USER,
      title: "Perfil antigo — pode estar desatualizado",
      confidence: MEMORY_CONFIDENCE.LOW,
      created_at: staleDate,
      updated_at: staleDate,
    }, env);

    // Current context
    await writeTestMemory({
      memory_id: "conflict-new-001",
      memory_type: MEMORY_TYPES.LIVE_CONTEXT,
      title: "Estado vivo atual",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.conflict_rules_applied === true, "conflict_rules_applied=true");

    const oldItem = result.blocks.historical_memory.items[0];
    ok(oldItem._pr3_is_reference === true, "old conflicting memory is reference-only");
    ok(
      oldItem._pr3_conflict_reason === "stale_with_active_context" ||
      oldItem._pr3_conflict_reason === "low_confidence_with_active_context",
      "conflict_reason is set"
    );

    const currentItem = result.blocks.current_context.items[0];
    ok(currentItem.memory_id === "conflict-new-001", "current context item is present and correct");
  }

  // ========================================================================
  // Group 6: Memória stale é tratada como referência histórica
  // ========================================================================
  console.log("\nGroup 6: memória stale é tratada como referência histórica");
  {
    const env = makeKVMock();
    const now = Date.now();
    const veryOld = new Date(now - STALENESS_THRESHOLD_MS * 2).toISOString();

    // Very old memory without current context
    await writeTestMemory({
      memory_id: "stale-solo-001",
      memory_type: MEMORY_TYPES.PROJECT,
      entity_type: ENTITY_TYPES.PROJECT,
      title: "Projeto muito antigo",
      confidence: MEMORY_CONFIDENCE.MEDIUM,
      created_at: veryOld,
      updated_at: veryOld,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "retrieval returns ok=true");
    ok(result.staleness_detected === true, "staleness_detected=true (even without current_context)");

    const staleItem = result.blocks.historical_memory.items[0];
    ok(staleItem._pr3_stale === true, "memory is marked stale");
    // Without active context, is_reference is set by _annotateMemory for stale historical
    ok(staleItem._pr3_is_reference === true, "stale historical memory is reference-only");

    // Canonical memory is NEVER stale
    const env2 = makeKVMock();
    await writeTestMemory({
      memory_id: "canonical-old-001",
      memory_type: MEMORY_TYPES.CANONICAL_RULES,
      title: "Regra canônica antiga",
      is_canonical: true,
      status: MEMORY_STATUS.CANONICAL,
      confidence: MEMORY_CONFIDENCE.CONFIRMED,
      priority: MEMORY_PRIORITY.CRITICAL,
      created_at: veryOld,
      updated_at: veryOld,
    }, env2);

    const result2 = await buildRetrievalContext({}, env2, { now });
    ok(result2.ok === true, "retrieval for canonical returns ok=true");
    const canonicalItem = result2.blocks.validated_learning.items[0];
    ok(canonicalItem._pr3_stale === false, "canonical memory is never stale");
    ok(canonicalItem._pr3_is_reference === false, "canonical memory is never reference-only");
  }

  // ========================================================================
  // Group 7: Chat/runtime atual não quebrou (non-regression)
  // ========================================================================
  console.log("\nGroup 7: chat/runtime atual não quebrou");
  {
    // Test with empty memory store
    const env = makeKVMock();
    const result = await buildRetrievalContext({}, env);
    ok(result.ok === true, "empty store returns ok=true");
    ok(result.total_memories_read === 0, "total_memories_read=0 with empty store");
    ok(result.blocks.current_context.count === 0, "current_context empty");
    ok(result.blocks.historical_memory.count === 0, "historical_memory empty");
    ok(result.blocks.manual_instructions.count === 0, "manual_instructions empty");
    ok(result.blocks.validated_learning.count === 0, "validated_learning empty");
    ok(result.conflict_rules_applied === false, "no conflict rules on empty store");
    ok(result.staleness_detected === false, "no staleness on empty store");

    // Test buildRetrievalSummary with empty result
    const summary = buildRetrievalSummary(result);
    ok(summary.applied === true, "summary.applied=true (ok=true, but 0 memories)");
    ok(summary.total_memories_read === 0, "summary shows 0 memories");

    // Test buildRetrievalSummary with failed result
    const failedSummary = buildRetrievalSummary({ ok: false, error: "test error" });
    ok(failedSummary.applied === false, "failed result summary shows applied=false");
    ok(failedSummary.error === "test error", "error message propagated");

    // Test missing env
    const noEnvResult = await buildRetrievalContext({}, null);
    ok(noEnvResult.ok === false, "null env returns ok=false");
    ok(typeof noEnvResult.error === "string", "error message is string");

    // Test missing ENAVIA_BRAIN
    const noBrainResult = await buildRetrievalContext({}, {});
    ok(noBrainResult.ok === false, "missing ENAVIA_BRAIN returns ok=false");
  }

  // ========================================================================
  // Group 8: Ranking de relevância e recência
  // ========================================================================
  console.log("\nGroup 8: ranking de relevância e recência");
  {
    const now = Date.now();

    // _relevanceScore tests
    ok(
      _relevanceScore({ is_canonical: true, priority: "critical", confidence: "confirmed" }) === 9,
      "max relevance score = 9"
    );
    ok(
      _relevanceScore({ is_canonical: false, priority: "low", confidence: "unverified" }) === 0,
      "min relevance score = 0"
    );

    // _recencyScore tests
    ok(
      _recencyScore({ updated_at: new Date(now).toISOString() }, now) > 0.99,
      "just-updated memory has recency ~1.0"
    );
    ok(
      _recencyScore({ updated_at: new Date(now - 91 * 24 * 60 * 60 * 1000).toISOString() }, now) === 0,
      "91-day-old memory has recency 0"
    );
    ok(
      _recencyScore({}, now) === 0,
      "missing updated_at has recency 0"
    );

    // _isStale tests
    const oldDate = new Date(now - STALENESS_THRESHOLD_MS - 1000).toISOString();
    const freshDate = new Date(now - 1000).toISOString();

    ok(
      _isStale({ updated_at: oldDate, is_canonical: false, confidence: "medium" }, now) === true,
      "old non-canonical medium-confidence is stale"
    );
    ok(
      _isStale({ updated_at: freshDate, is_canonical: false, confidence: "medium" }, now) === false,
      "fresh non-canonical is not stale"
    );
    ok(
      _isStale({ updated_at: oldDate, is_canonical: true, confidence: "confirmed" }, now) === false,
      "canonical memory is never stale"
    );
    ok(
      _isStale({ updated_at: oldDate, is_canonical: false, confidence: "confirmed" }, now) === false,
      "confirmed confidence is never stale"
    );

    // _classifyMemory tests
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.CANONICAL_RULES, is_canonical: true }) === "validated_learning",
      "canonical_rules + is_canonical → validated_learning"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.APRENDIZADO_VALIDADO }) === "validated_learning",
      "aprendizado_validado → validated_learning"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.MEMORIA_MANUAL }) === "manual_instructions",
      "memoria_manual → manual_instructions"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY, source: "panel" }) === "manual_instructions",
      "source=panel → manual_instructions"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.LIVE_CONTEXT }) === "current_context",
      "live_context → current_context"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.CONVERSA_ATUAL }) === "current_context",
      "conversa_atual → current_context"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY, source: "planner" }) === "historical_memory",
      "operational_history + source=planner → historical_memory"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.USER_PROFILE }) === "historical_memory",
      "user_profile → historical_memory"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.PROJECT }) === "historical_memory",
      "project → historical_memory"
    );

    // Mixed-case source normalization
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY, source: "Panel" }) === "manual_instructions",
      "source=Panel (mixed case) → manual_instructions"
    );
    ok(
      _classifyMemory({ memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY, source: "OPERADOR" }) === "manual_instructions",
      "source=OPERADOR (uppercase) → manual_instructions"
    );

    // _sortByRanking tests
    const items = [
      { _pr3_combined: 0.3, _pr3_relevance: 2, _pr3_recency: 0.1 },
      { _pr3_combined: 0.9, _pr3_relevance: 8, _pr3_recency: 0.9 },
      { _pr3_combined: 0.6, _pr3_relevance: 5, _pr3_recency: 0.5 },
    ];
    const sorted = _sortByRanking(items);
    ok(sorted[0]._pr3_combined === 0.9, "highest combined score first");
    ok(sorted[2]._pr3_combined === 0.3, "lowest combined score last");
  }

  // ========================================================================
  // Group 9: Edge cases and error handling
  // ========================================================================
  console.log("\nGroup 9: edge cases and error handling");
  {
    // Test with all 4 blocks populated
    const env = makeKVMock();
    const now = Date.now();
    const recentDate = new Date(now - 1000).toISOString();

    await writeTestMemory({
      memory_id: "full-validated",
      memory_type: MEMORY_TYPES.CANONICAL_RULES,
      title: "Regra canônica",
      is_canonical: true,
      status: MEMORY_STATUS.CANONICAL,
      confidence: MEMORY_CONFIDENCE.CONFIRMED,
      priority: MEMORY_PRIORITY.CRITICAL,
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    await writeTestMemory({
      memory_id: "full-manual",
      memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
      title: "Instrução do operador",
      source: "operador",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    await writeTestMemory({
      memory_id: "full-current",
      memory_type: MEMORY_TYPES.LIVE_CONTEXT,
      title: "Contexto vivo",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    await writeTestMemory({
      memory_id: "full-historical",
      memory_type: MEMORY_TYPES.PROJECT,
      entity_type: ENTITY_TYPES.PROJECT,
      title: "Projeto histórico",
      source: "planner",
      created_at: recentDate,
      updated_at: recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "all 4 blocks populated: ok=true");
    ok(result.blocks.validated_learning.count === 1, "validated_learning block populated");
    ok(result.blocks.manual_instructions.count === 1, "manual_instructions block populated");
    ok(result.blocks.current_context.count === 1, "current_context block populated");
    ok(result.blocks.historical_memory.count === 1, "historical_memory block populated");
    ok(result.total_memories_read === 4, "total_memories_read=4");

    // buildRetrievalSummary with full result
    const summary = buildRetrievalSummary(result);
    ok(summary.applied === true, "summary applied=true");
    ok(summary.validated_learning.count === 1, "summary validated_learning count");
    ok(summary.manual_instructions.count === 1, "summary manual_instructions count");
    ok(summary.current_context.count === 1, "summary current_context count");
    ok(summary.historical_memory.count === 1, "summary historical_memory count");
    ok(summary.pipeline_version === "PR3-v1", "summary pipeline_version");
  }

  // ========================================================================
  // Group 10: Explicit conflict detection (entity_id overlap)
  // ========================================================================
  console.log("\nGroup 10: conflito explícito por entity_id — contexto atual prevalece");
  {
    // -----------------------------------------------------------------------
    // 10a: _detectExplicitConflicts unit tests
    // -----------------------------------------------------------------------
    // No overlap: different entity_ids
    const noConflict = _detectExplicitConflicts(
      [{ entity_id: "user-1", entity_type: "user" }],
      [{ entity_id: "user-2", entity_type: "user" }]
    );
    ok(noConflict.length === 0, "_detectExplicitConflicts: different entity_id → no conflict");

    // Overlap on same entity_id + entity_type
    const withConflict = _detectExplicitConflicts(
      [{ entity_id: "proj-alpha", entity_type: "project" }],
      [
        { entity_id: "proj-alpha", entity_type: "project" },  // conflicts
        { entity_id: "proj-beta",  entity_type: "project" },  // does not conflict
      ]
    );
    ok(withConflict.length === 1, "_detectExplicitConflicts: same entity → 1 conflict");
    ok(withConflict[0].historical_idx === 0, "conflicting historical_idx=0");
    ok(withConflict[0].conflict_key === "project::proj-alpha", "conflict_key is entity_type::entity_id");

    // No conflict if entity_type differs even with same entity_id
    const typeMismatch = _detectExplicitConflicts(
      [{ entity_id: "ent-1", entity_type: "user" }],
      [{ entity_id: "ent-1", entity_type: "project" }]
    );
    ok(typeMismatch.length === 0, "different entity_type → no conflict (type must also match)");

    // Missing entity_id → no conflict basis
    const noEid = _detectExplicitConflicts(
      [{ entity_id: "", entity_type: "user" }],
      [{ entity_id: "user-1", entity_type: "user" }]
    );
    ok(noEid.length === 0, "empty entity_id in current_context → no conflict basis");

    // Multiple current_context items each can create conflicts
    const multi = _detectExplicitConflicts(
      [
        { entity_id: "proj-x", entity_type: "project" },
        { entity_id: "user-y", entity_type: "user" },
      ],
      [
        { entity_id: "proj-x", entity_type: "project" },  // conflicts with first current
        { entity_id: "user-y", entity_type: "user" },      // conflicts with second current
        { entity_id: "proj-z", entity_type: "project" },   // no conflict
      ]
    );
    ok(multi.length === 2, "two entities in current_context → 2 explicit conflicts");

    // -----------------------------------------------------------------------
    // 10b: Integration test — buildRetrievalContext marks conflicting memories
    // -----------------------------------------------------------------------
    const env = makeKVMock();
    const now = Date.now();
    const recentDate = new Date(now - 500).toISOString();

    // Current context memory about entity "proj-alpha"
    await writeTestMemory({
      memory_id:   "ctx-proj-alpha",
      memory_type: MEMORY_TYPES.LIVE_CONTEXT,
      entity_type: ENTITY_TYPES.PROJECT,
      entity_id:   "proj-alpha",
      title:       "Estado atual do projeto Alpha",
      created_at:  recentDate,
      updated_at:  recentDate,
    }, env);

    // Historical memory about the SAME entity "proj-alpha" → should conflict
    await writeTestMemory({
      memory_id:   "hist-proj-alpha",
      memory_type: MEMORY_TYPES.PROJECT,
      entity_type: ENTITY_TYPES.PROJECT,
      entity_id:   "proj-alpha",
      title:       "Registro histórico — projeto Alpha",
      source:      "planner",
      confidence:  MEMORY_CONFIDENCE.HIGH, // not low-confidence, not stale → pure entity conflict
      created_at:  recentDate,
      updated_at:  recentDate,
    }, env);

    // Historical memory about a DIFFERENT entity → should NOT conflict
    await writeTestMemory({
      memory_id:   "hist-proj-beta",
      memory_type: MEMORY_TYPES.PROJECT,
      entity_type: ENTITY_TYPES.PROJECT,
      entity_id:   "proj-beta",
      title:       "Registro histórico — projeto Beta",
      source:      "planner",
      confidence:  MEMORY_CONFIDENCE.HIGH,
      created_at:  recentDate,
      updated_at:  recentDate,
    }, env);

    const result = await buildRetrievalContext({}, env, { now });
    ok(result.ok === true, "integration: retrieval ok=true");
    ok(result.conflicts_detected === true, "conflicts_detected=true");
    ok(result.explicit_conflicts_count === 1, "explicit_conflicts_count=1");
    ok(result.conflict_rules_applied === true, "conflict_rules_applied=true");

    // The conflicting historical memory is in historical_memory block
    const histItems = result.blocks.historical_memory.items;
    ok(histItems.length === 2, "both historical memories are in historical_memory block");

    const alphaHist = histItems.find((m) => m.memory_id === "hist-proj-alpha");
    ok(alphaHist !== undefined, "hist-proj-alpha is present");
    ok(alphaHist._pr3_explicit_conflict === true, "hist-proj-alpha is marked explicit_conflict");
    ok(alphaHist._pr3_is_reference === true, "hist-proj-alpha is downgraded to reference-only");
    ok(alphaHist._pr3_conflict_reason === "entity_id_overlap", "conflict_reason=entity_id_overlap");
    ok(alphaHist._pr3_conflict_key === "project::proj-alpha", "conflict_key matches entity");

    const betaHist = histItems.find((m) => m.memory_id === "hist-proj-beta");
    ok(betaHist !== undefined, "hist-proj-beta is present");
    ok(!betaHist._pr3_explicit_conflict, "hist-proj-beta is NOT marked as conflict");
    ok(!betaHist._pr3_is_reference, "hist-proj-beta is NOT reference-only");

    // Current context is not affected by conflict rules
    const ctxItems = result.blocks.current_context.items;
    ok(ctxItems.length === 1, "current_context has 1 item");
    ok(ctxItems[0].memory_id === "ctx-proj-alpha", "ctx-proj-alpha stays in current_context");

    // Summary exposes new conflict fields
    const summary = buildRetrievalSummary(result);
    ok(summary.conflicts_detected === true, "summary.conflicts_detected=true");
    ok(summary.explicit_conflicts_count === 1, "summary.explicit_conflicts_count=1");
    const alphaSum = summary.historical_memory.items.find((m) => m.memory_id === "hist-proj-alpha");
    ok(alphaSum?.explicit_conflict === true, "summary item shows explicit_conflict=true");
    ok(alphaSum?.conflict_reason === "entity_id_overlap", "summary item shows conflict_reason");
    ok(alphaSum?.conflict_key === "project::proj-alpha", "summary item shows conflict_key");
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
  console.error("Fatal error in smoke tests:", err);
  process.exit(1);
});
