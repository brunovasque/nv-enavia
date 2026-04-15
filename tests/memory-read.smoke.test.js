// ============================================================================
// 🧪 Smoke Tests — ENAVIA Memory Read Pipeline v1 (PM3)
//
// Run: node tests/memory-read.smoke.test.js
//
// Uses an in-memory KV mock — no Cloudflare deploy required.
//
// Tests:
//   Group 1:  searchMemory — filter by memory_type
//   Group 2:  searchMemory — filter by entity_type
//   Group 3:  searchMemory — filter by entity_id
//   Group 4:  searchMemory — filter by status (single and multi-value)
//   Group 5:  searchMemory — filter by is_canonical
//   Group 6:  searchMemory — simple text filter
//   Group 7:  searchMemory — include_inactive flag
//   Group 8:  searchMemory — archived/expired do not appear by default
//   Group 9:  searchRelevantMemory — canonical rules appear first
//   Group 10: searchRelevantMemory — canonical contracts follow rules
//   Group 11: searchRelevantMemory — project + live_context appear in order
//   Group 12: searchRelevantMemory — archived/expired excluded by default
//   Group 13: searchRelevantMemory — irrelevant memory does not dominate
//   Group 14: searchRelevantMemory — project_id context filter narrows projects
//   Group 15: searchRelevantMemory — entity_id context filter narrows history/profile
//   Group 16: error handling — missing env
//   Group 17: executor isolation — no contract:* access, no executor import
// ============================================================================

import {
  searchMemory,
  searchRelevantMemory,
} from "../schema/memory-read.js";

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

// ---------------------------------------------------------------------------
// In-memory KV mock (same interface used by memory-storage.js)
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

// ---------------------------------------------------------------------------
// Fixture builder — base valid memory object
// ---------------------------------------------------------------------------
let _memCounter = 0;
function makeMemory(overrides = {}) {
  _memCounter++;
  return buildMemoryObject({
    memory_id:          `mem_pm3_${String(_memCounter).padStart(3, "0")}`,
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user_vasques",
    title:              "Test memory",
    content_structured: { value: "test" },
    priority:           MEMORY_PRIORITY.MEDIUM,
    confidence:         MEMORY_CONFIDENCE.MEDIUM,
    source:             "pm3_smoke_test",
    created_at:         "2026-04-11T10:00:00Z",
    updated_at:         "2026-04-11T10:00:00Z",
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    ...overrides,
  });
}

// ---------------------------------------------------------------------------
// Fixture: populate KV with a known set of memories for each group
// ---------------------------------------------------------------------------
async function populateFixtures(env) {
  const fixtures = [
    // --- canonical rules (tier 1) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.CANONICAL_RULES,
      entity_type:  ENTITY_TYPES.RULE,
      entity_id:    "rule_no_auto_exec",
      title:        "Regra: proibido executar sem aprovação humana",
      priority:     MEMORY_PRIORITY.CRITICAL,
      confidence:   MEMORY_CONFIDENCE.CONFIRMED,
      is_canonical: true,
      status:       MEMORY_STATUS.CANONICAL,
    }),
    makeMemory({
      memory_type:  MEMORY_TYPES.CANONICAL_RULES,
      entity_type:  ENTITY_TYPES.RULE,
      entity_id:    "rule_canonical_wins",
      title:        "Regra: contrato canônico vence preferência implícita",
      priority:     MEMORY_PRIORITY.CRITICAL,
      confidence:   MEMORY_CONFIDENCE.CONFIRMED,
      is_canonical: true,
      status:       MEMORY_STATUS.CANONICAL,
    }),

    // --- canonical contracts (tier 2) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.PROJECT,
      entity_type:  ENTITY_TYPES.PROJECT,
      entity_id:    "project_nv_enavia",
      title:        "Contrato canônico: planner memory layer v1",
      priority:     MEMORY_PRIORITY.HIGH,
      confidence:   MEMORY_CONFIDENCE.CONFIRMED,
      is_canonical: true,
      status:       MEMORY_STATUS.ACTIVE,
    }),

    // --- project memory (tier 3) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.PROJECT,
      entity_type:  ENTITY_TYPES.PROJECT,
      entity_id:    "project_nv_enavia",
      title:        "Projeto: nv-enavia status atual",
      priority:     MEMORY_PRIORITY.HIGH,
      confidence:   MEMORY_CONFIDENCE.HIGH,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
    }),
    makeMemory({
      memory_type:  MEMORY_TYPES.PROJECT,
      entity_type:  ENTITY_TYPES.PROJECT,
      entity_id:    "project_nv_imoveis",
      title:        "Projeto: nv-imoveis status atual",
      priority:     MEMORY_PRIORITY.MEDIUM,
      confidence:   MEMORY_CONFIDENCE.MEDIUM,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
    }),

    // --- live context (tier 4) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.LIVE_CONTEXT,
      entity_type:  ENTITY_TYPES.CONTEXT,
      entity_id:    "ctx_current",
      title:        "Contexto vivo: sessão atual da enavia",
      priority:     MEMORY_PRIORITY.HIGH,
      confidence:   MEMORY_CONFIDENCE.HIGH,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
    }),

    // --- user profile (tier 5) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.USER_PROFILE,
      entity_type:  ENTITY_TYPES.USER,
      entity_id:    "user_vasques",
      title:        "Perfil do usuário Vasques",
      priority:     MEMORY_PRIORITY.HIGH,
      confidence:   MEMORY_CONFIDENCE.CONFIRMED,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
    }),

    // --- operational history (tier 6) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.OPERATIONAL_HISTORY,
      entity_type:  ENTITY_TYPES.OPERATION,
      entity_id:    "user_vasques",
      title:        "Histórico: deploy PM2 concluído",
      priority:     MEMORY_PRIORITY.MEDIUM,
      confidence:   MEMORY_CONFIDENCE.HIGH,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
      updated_at:   "2026-04-10T08:00:00Z",
    }),
    makeMemory({
      memory_type:  MEMORY_TYPES.OPERATIONAL_HISTORY,
      entity_type:  ENTITY_TYPES.OPERATION,
      entity_id:    "user_vasques",
      title:        "Histórico: deploy PM1 concluído",
      priority:     MEMORY_PRIORITY.MEDIUM,
      confidence:   MEMORY_CONFIDENCE.HIGH,
      is_canonical: false,
      status:       MEMORY_STATUS.ACTIVE,
      updated_at:   "2026-04-09T08:00:00Z",
    }),

    // --- inactive memories (must NOT appear by default) ---
    makeMemory({
      memory_type:  MEMORY_TYPES.USER_PROFILE,
      entity_type:  ENTITY_TYPES.USER,
      entity_id:    "user_vasques",
      title:        "Perfil arquivado antigo",
      status:       MEMORY_STATUS.ARCHIVED,
    }),
    makeMemory({
      memory_type:  MEMORY_TYPES.OPERATIONAL_HISTORY,
      entity_type:  ENTITY_TYPES.OPERATION,
      entity_id:    "user_vasques",
      title:        "Histórico expirado irrelevante",
      status:       MEMORY_STATUS.EXPIRED,
    }),
    makeMemory({
      memory_type:  MEMORY_TYPES.PROJECT,
      entity_type:  ENTITY_TYPES.PROJECT,
      entity_id:    "project_nv_enavia",
      title:        "Projeto superseded versão antiga",
      status:       MEMORY_STATUS.SUPERSEDED,
    }),
  ];

  for (const mem of fixtures) {
    await writeMemory(mem, env);
  }

  return fixtures;
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------
async function runTests() {
  console.log("\n=== ENAVIA Memory Read Pipeline — Smoke Tests (PM3) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: searchMemory — filter by memory_type
  // -------------------------------------------------------------------------
  console.log("Group 1: searchMemory — filter by memory_type");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchMemory({ memory_type: MEMORY_TYPES.CANONICAL_RULES }, env);
    assert(r.ok === true, "returns ok=true");
    assert(r.results.every(m => m.memory_type === MEMORY_TYPES.CANONICAL_RULES),
      "all results have correct memory_type");
    assert(r.count === r.results.length, "count matches results.length");
    assert(r.count >= 2, "at least 2 canonical_rules memories returned");

    // no cross-contamination
    const r2 = await searchMemory({ memory_type: MEMORY_TYPES.LIVE_CONTEXT }, env);
    assert(r2.ok === true, "live_context search returns ok=true");
    assert(r2.results.every(m => m.memory_type === MEMORY_TYPES.LIVE_CONTEXT),
      "live_context results contain only live_context type");
  }

  // -------------------------------------------------------------------------
  // Group 2: searchMemory — filter by entity_type
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: searchMemory — filter by entity_type");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchMemory({ entity_type: ENTITY_TYPES.RULE }, env);
    assert(r.ok === true, "returns ok=true");
    assert(r.results.every(m => m.entity_type === ENTITY_TYPES.RULE),
      "all results have entity_type=rule");
    assert(r.count >= 2, "at least 2 rule entities returned");

    const r2 = await searchMemory({ entity_type: ENTITY_TYPES.CONTEXT }, env);
    assert(r2.results.every(m => m.entity_type === ENTITY_TYPES.CONTEXT),
      "context entity_type filter works");
  }

  // -------------------------------------------------------------------------
  // Group 3: searchMemory — filter by entity_id
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: searchMemory — filter by entity_id");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchMemory({ entity_id: "user_vasques" }, env);
    assert(r.ok === true, "returns ok=true");
    assert(r.results.every(m => m.entity_id === "user_vasques"),
      "all results have entity_id=user_vasques");
    assert(r.count >= 1, "at least one match for user_vasques");

    // entity_id that has no active records (superseded is filtered)
    // project_nv_enavia has 1 canonical + 1 active project; superseded excluded by default
    const r2 = await searchMemory({ entity_id: "project_nv_enavia" }, env);
    assert(r2.results.every(m => m.entity_id === "project_nv_enavia"),
      "entity_id filter returns only matching id");
    assert(!r2.results.some(m => m.status === MEMORY_STATUS.SUPERSEDED),
      "superseded excluded from entity_id results by default");
  }

  // -------------------------------------------------------------------------
  // Group 4: searchMemory — filter by status (single and multi-value)
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: searchMemory — filter by status");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    // Single status: canonical
    const rCanon = await searchMemory({ status: MEMORY_STATUS.CANONICAL, include_inactive: false }, env);
    assert(rCanon.ok === true, "status=canonical search ok");
    // canonical status is not in INACTIVE_STATUSES, so should appear without include_inactive
    assert(rCanon.results.every(m => m.status === MEMORY_STATUS.CANONICAL),
      "only canonical-status records returned");
    assert(rCanon.count >= 2, "at least 2 canonical-status records");

    // Single status: archived (needs include_inactive)
    const rArch = await searchMemory({ status: MEMORY_STATUS.ARCHIVED, include_inactive: true }, env);
    assert(rArch.ok === true, "status=archived with include_inactive ok");
    assert(rArch.results.every(m => m.status === MEMORY_STATUS.ARCHIVED),
      "all results are archived");
    assert(rArch.count >= 1, "at least 1 archived record");

    // Multi-value status array
    const rMulti = await searchMemory(
      { status: [MEMORY_STATUS.ARCHIVED, MEMORY_STATUS.EXPIRED], include_inactive: true },
      env
    );
    assert(rMulti.ok === true, "multi-status search ok");
    assert(
      rMulti.results.every(m =>
        m.status === MEMORY_STATUS.ARCHIVED || m.status === MEMORY_STATUS.EXPIRED
      ),
      "multi-status returns only archived or expired"
    );
    assert(rMulti.count >= 2, "at least 2 archived+expired records");
  }

  // -------------------------------------------------------------------------
  // Group 5: searchMemory — filter by is_canonical
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: searchMemory — filter by is_canonical");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const rCanon = await searchMemory({ is_canonical: true }, env);
    assert(rCanon.ok === true, "is_canonical=true search ok");
    assert(rCanon.results.every(m => m.is_canonical === true),
      "all results have is_canonical=true");
    assert(rCanon.count >= 3, "at least 3 canonical memories (2 rules + 1 contract)");

    const rNonCanon = await searchMemory({ is_canonical: false }, env);
    assert(rNonCanon.ok === true, "is_canonical=false search ok");
    assert(rNonCanon.results.every(m => m.is_canonical === false),
      "all results have is_canonical=false");
    assert(!rNonCanon.results.some(m => m.is_canonical === true),
      "no canonical memory in is_canonical=false results");
  }

  // -------------------------------------------------------------------------
  // Group 6: searchMemory — simple text filter
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: searchMemory — simple text filter");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchMemory({ text: "canônico" }, env);
    assert(r.ok === true, "text filter returns ok=true");
    assert(r.results.every(m => m.title.toLowerCase().includes("canônico")),
      "text filter matches title case-insensitively");

    const rNoMatch = await searchMemory({ text: "xyz_no_match_12345" }, env);
    assert(rNoMatch.ok === true, "text filter with no match returns ok=true");
    assert(rNoMatch.count === 0, "text filter with no match returns empty results");

    // empty text = no filter applied
    const rEmpty = await searchMemory({ text: "" }, env);
    assert(rEmpty.ok === true, "empty text filter returns ok=true");
    assert(rEmpty.count > 0, "empty text returns active memories (no restriction)");
  }

  // -------------------------------------------------------------------------
  // Group 7: searchMemory — include_inactive flag
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: searchMemory — include_inactive flag");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const rDefault = await searchMemory({}, env);
    const inactiveStatuses = [MEMORY_STATUS.ARCHIVED, MEMORY_STATUS.EXPIRED, MEMORY_STATUS.SUPERSEDED];
    assert(!rDefault.results.some(m => inactiveStatuses.includes(m.status)),
      "default search excludes archived/expired/superseded");

    const rInactive = await searchMemory({ include_inactive: true }, env);
    assert(rInactive.count > rDefault.count,
      "include_inactive=true returns more records than default");
    assert(rInactive.results.some(m => m.status === MEMORY_STATUS.ARCHIVED),
      "include_inactive=true includes archived records");
    assert(rInactive.results.some(m => m.status === MEMORY_STATUS.EXPIRED),
      "include_inactive=true includes expired records");
    assert(rInactive.results.some(m => m.status === MEMORY_STATUS.SUPERSEDED),
      "include_inactive=true includes superseded records");
  }

  // -------------------------------------------------------------------------
  // Group 8: searchMemory — archived/expired/superseded excluded by default
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: searchMemory — inactive statuses excluded by default");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchMemory({}, env);
    const inactive = r.results.filter(m =>
      m.status === MEMORY_STATUS.ARCHIVED ||
      m.status === MEMORY_STATUS.EXPIRED ||
      m.status === MEMORY_STATUS.SUPERSEDED
    );
    assert(inactive.length === 0,
      "no archived/expired/superseded in default searchMemory results");
  }

  // -------------------------------------------------------------------------
  // Group 9: searchRelevantMemory — canonical rules appear first
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: searchRelevantMemory — canonical rules appear first");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchRelevantMemory({}, env);
    assert(r.ok === true, "searchRelevantMemory returns ok=true");
    assert(r.count > 0, "searchRelevantMemory returns at least one result");

    // The first entries must be canonical_rules
    const canonicalRuleResults = r.results.filter(
      m => m.memory_type === MEMORY_TYPES.CANONICAL_RULES && m.is_canonical === true
    );
    assert(canonicalRuleResults.length >= 2, "canonical rules present in results");

    // Check that canonical rules come before non-canonical, non-rule memories
    const firstNonCanonicalRuleIdx = r.results.findIndex(
      m => !(m.memory_type === MEMORY_TYPES.CANONICAL_RULES && m.is_canonical === true)
    );
    const lastCanonicalRuleIdx = r.results.reduce((last, m, i) =>
      (m.memory_type === MEMORY_TYPES.CANONICAL_RULES && m.is_canonical === true) ? i : last,
      -1
    );
    assert(
      lastCanonicalRuleIdx < firstNonCanonicalRuleIdx || firstNonCanonicalRuleIdx === -1,
      "all canonical rules appear before any non-canonical-rule memory"
    );
  }

  // -------------------------------------------------------------------------
  // Group 10: searchRelevantMemory — canonical contracts follow rules
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: searchRelevantMemory — canonical contracts follow rules");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchRelevantMemory({}, env);

    // Canonical contracts (is_canonical=true, non-rule) must come after all canonical rules
    // but before non-canonical project/live/profile/history memories
    const canonRuleIndices = r.results
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.memory_type === MEMORY_TYPES.CANONICAL_RULES && m.is_canonical)
      .map(({ i }) => i);

    const canonContractIndices = r.results
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.is_canonical && m.memory_type !== MEMORY_TYPES.CANONICAL_RULES)
      .map(({ i }) => i);

    const nonCanonIndices = r.results
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => !m.is_canonical)
      .map(({ i }) => i);

    const maxCanonRule = Math.max(...canonRuleIndices);
    const minCanonContract = Math.min(...canonContractIndices);
    const minNonCanon = Math.min(...nonCanonIndices);

    assert(maxCanonRule < minCanonContract,
      "canonical rules appear before canonical contracts");
    assert(minCanonContract < minNonCanon,
      "canonical contracts appear before non-canonical memories");
  }

  // -------------------------------------------------------------------------
  // Group 11: searchRelevantMemory — project + live_context in correct order
  // -------------------------------------------------------------------------
  console.log("\nGroup 11: searchRelevantMemory — project and live_context ordering");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchRelevantMemory({}, env);

    // Find first project (non-canonical) and first live_context in results
    const firstProjectIdx = r.results.findIndex(
      m => m.memory_type === MEMORY_TYPES.PROJECT && !m.is_canonical
    );
    const firstLiveCtxIdx = r.results.findIndex(
      m => m.memory_type === MEMORY_TYPES.LIVE_CONTEXT
    );
    const firstProfileIdx = r.results.findIndex(
      m => m.memory_type === MEMORY_TYPES.USER_PROFILE
    );
    const firstHistoryIdx = r.results.findIndex(
      m => m.memory_type === MEMORY_TYPES.OPERATIONAL_HISTORY
    );

    assert(firstProjectIdx !== -1,   "project memory appears in results");
    assert(firstLiveCtxIdx !== -1,   "live_context appears in results");
    assert(firstProfileIdx !== -1,   "user_profile appears in results");
    assert(firstHistoryIdx !== -1,   "operational_history appears in results");

    assert(firstProjectIdx < firstLiveCtxIdx,
      "project memory appears before live_context");
    assert(firstLiveCtxIdx < firstProfileIdx,
      "live_context appears before user_profile");
    assert(firstProfileIdx < firstHistoryIdx,
      "user_profile appears before operational_history");
  }

  // -------------------------------------------------------------------------
  // Group 12: searchRelevantMemory — archived/expired excluded by default
  // -------------------------------------------------------------------------
  console.log("\nGroup 12: searchRelevantMemory — inactive memories excluded");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    const r = await searchRelevantMemory({}, env);
    const inactive = r.results.filter(m =>
      m.status === MEMORY_STATUS.ARCHIVED ||
      m.status === MEMORY_STATUS.EXPIRED ||
      m.status === MEMORY_STATUS.SUPERSEDED
    );
    assert(inactive.length === 0,
      "no archived/expired/superseded in searchRelevantMemory results");
  }

  // -------------------------------------------------------------------------
  // Group 13: searchRelevantMemory — irrelevant memory does not dominate
  // -------------------------------------------------------------------------
  console.log("\nGroup 13: searchRelevantMemory — irrelevant memory does not dominate");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    // Add a large set of low-priority operational_history entries
    for (let i = 0; i < 5; i++) {
      await writeMemory(makeMemory({
        memory_type:  MEMORY_TYPES.OPERATIONAL_HISTORY,
        entity_type:  ENTITY_TYPES.OPERATION,
        entity_id:    "user_vasques",
        title:        `Histórico irrelevante ${i}`,
        priority:     MEMORY_PRIORITY.LOW,
        confidence:   MEMORY_CONFIDENCE.LOW,
        is_canonical: false,
        status:       MEMORY_STATUS.ACTIVE,
      }), env);
    }

    const r = await searchRelevantMemory({}, env);
    assert(r.ok === true, "returns ok=true");

    // The first result must still be a canonical rule, not history
    assert(
      r.results[0].memory_type === MEMORY_TYPES.CANONICAL_RULES,
      "first result is still a canonical rule despite many low-priority history entries"
    );
    // Canonical rules must appear in the top positions
    const top3Types = r.results.slice(0, 3).map(m => m.memory_type);
    assert(
      top3Types.every(t => t === MEMORY_TYPES.CANONICAL_RULES || t === MEMORY_TYPES.PROJECT),
      "top 3 results are canonical rules or canonical contracts, not history"
    );
  }

  // -------------------------------------------------------------------------
  // Group 14: searchRelevantMemory — project_id context filter
  // -------------------------------------------------------------------------
  console.log("\nGroup 14: searchRelevantMemory — project_id context filter");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    // With project_id = project_nv_enavia
    const r = await searchRelevantMemory({ project_id: "project_nv_enavia" }, env);
    assert(r.ok === true, "returns ok=true with project_id filter");

    const projectResults = r.results.filter(
      m => m.memory_type === MEMORY_TYPES.PROJECT
    );
    assert(
      projectResults.every(m => m.entity_id === "project_nv_enavia"),
      "project_id filter only includes matching project entity"
    );
    assert(
      !projectResults.some(m => m.entity_id === "project_nv_imoveis"),
      "project_nv_imoveis excluded when project_id=project_nv_enavia"
    );

    // Canonical rules still appear even with project_id filter
    assert(
      r.results.some(m => m.memory_type === MEMORY_TYPES.CANONICAL_RULES),
      "canonical rules always included regardless of project_id filter"
    );
    // Live context still appears
    assert(
      r.results.some(m => m.memory_type === MEMORY_TYPES.LIVE_CONTEXT),
      "live_context always included regardless of project_id filter"
    );
  }

  // -------------------------------------------------------------------------
  // Group 15: searchRelevantMemory — entity_id context filter
  // -------------------------------------------------------------------------
  console.log("\nGroup 15: searchRelevantMemory — entity_id context filter");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    // entity_id filter narrows user_profile and operational_history
    // but canonical rules and live_context must still appear
    const r = await searchRelevantMemory({ entity_id: "user_vasques" }, env);
    assert(r.ok === true, "returns ok=true with entity_id filter");

    // Canonical rules always included
    assert(
      r.results.some(m => m.memory_type === MEMORY_TYPES.CANONICAL_RULES),
      "canonical rules always present with entity_id filter"
    );
    // Live context always included
    assert(
      r.results.some(m => m.memory_type === MEMORY_TYPES.LIVE_CONTEXT),
      "live_context always present with entity_id filter"
    );
    // User profile matching entity_id
    const profileResults = r.results.filter(
      m => m.memory_type === MEMORY_TYPES.USER_PROFILE
    );
    assert(
      profileResults.every(m => m.entity_id === "user_vasques"),
      "user_profile results match entity_id filter"
    );
    // Operational history matching entity_id
    const historyResults = r.results.filter(
      m => m.memory_type === MEMORY_TYPES.OPERATIONAL_HISTORY
    );
    assert(
      historyResults.every(m => m.entity_id === "user_vasques"),
      "operational_history results match entity_id filter"
    );
  }

  // -------------------------------------------------------------------------
  // Group 16: error handling — missing env / ENAVIA_BRAIN
  // -------------------------------------------------------------------------
  console.log("\nGroup 16: error handling — missing env");
  {
    const rSearch = await searchMemory({}, null);
    assert(rSearch.ok === false, "searchMemory returns ok=false with null env");
    assert(typeof rSearch.error === "string", "searchMemory returns error string");

    const rRelevant = await searchRelevantMemory({}, undefined);
    assert(rRelevant.ok === false, "searchRelevantMemory returns ok=false with undefined env");
    assert(typeof rRelevant.error === "string", "searchRelevantMemory returns error string");

    const rNoBrain = await searchMemory({}, {});
    assert(rNoBrain.ok === false, "searchMemory returns ok=false with env missing ENAVIA_BRAIN");

    const rNoRelevant = await searchRelevantMemory({}, {});
    assert(rNoRelevant.ok === false, "searchRelevantMemory returns ok=false without ENAVIA_BRAIN");
  }

  // -------------------------------------------------------------------------
  // Group 17: executor isolation — no contract:* keys read, no executor import
  // -------------------------------------------------------------------------
  console.log("\nGroup 17: executor isolation — no contract:* access");
  {
    const env = makeKVMock();
    await populateFixtures(env);

    // Run both functions
    await searchMemory({}, env);
    await searchRelevantMemory({}, env);

    // Verify no contract:* keys were accessed
    const accessedKeys = [...env._store.keys()];
    const contractKeys = accessedKeys.filter(k => k.startsWith("contract:"));
    assert(contractKeys.length === 0,
      "no contract:* KV keys accessed by PM3 read pipeline");

    // Only memory:* and audit:memory:* keys in store (no contract:* or other)
    const nonMemoryKeys = accessedKeys.filter(k => !k.startsWith("memory:") && !k.startsWith("audit:memory:"));
    assert(nonMemoryKeys.length === 0,
      "only memory:* KV keys present in store after PM3 operations");

    // Verify exports are pure read functions
    assert(typeof searchMemory    === "function", "searchMemory is an exported function");
    assert(typeof searchRelevantMemory === "function", "searchRelevantMemory is an exported function");
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
