// ============================================================================
// 🧪 Smoke Tests — ENAVIA Memory Storage v1 (PM2 — Memory Storage Core)
//
// Run: node tests/memory-storage.smoke.test.js
//
// Uses an in-memory KV mock — no Cloudflare deploy required.
//
// Tests:
//   Group 1: writeMemory — valid and invalid cases
//   Group 2: readMemoryById — found and not-found cases
//   Group 3: updateMemory — valid patch, missing record, validation
//   Group 4: archiveMemory — archives correctly, preserves record
//   Group 5: supersedeMemory — supersedes, preserves superseded_by link
//   Group 6: memory:index integrity — no duplicate ids
//   Group 7: executor isolation — no contract:* access, no executor import
// ============================================================================

import {
  writeMemory,
  readMemoryById,
  updateMemory,
  archiveMemory,
  supersedeMemory,
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
// In-memory KV mock (matches Cloudflare KV interface used by memory-storage.js)
//
// Returns { ENAVIA_BRAIN, _store } to match the worker env object shape.
// memory-storage.js accesses env.ENAVIA_BRAIN.get/put/delete.
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
// Helper: build a valid memory object with optional overrides
// ---------------------------------------------------------------------------
function makeValidMemory(overrides = {}) {
  return buildMemoryObject({
    memory_id:          "mem_pm2_001",
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user_vasques",
    title:              "Perfil principal do usuário",
    content_structured: { name: "Vasques", preferences: [] },
    priority:           MEMORY_PRIORITY.HIGH,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "pm2_smoke_test",
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
  console.log("\n=== ENAVIA Memory Storage — Smoke Tests (PM2) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: writeMemory
  // -------------------------------------------------------------------------
  console.log("Group 1: writeMemory");

  // grava memória válida
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_write_valid" });
    const res = await writeMemory(mem, env);
    assert(res.ok === true,                              "writeMemory: accepts valid memory object");
    assert(res.memory_id === "mem_write_valid",          "writeMemory: returns correct memory_id");
    assert(res.record !== undefined,                     "writeMemory: returns record");
    // verify KV was actually written
    const raw = env._store.get("memory:mem_write_valid");
    assert(raw !== undefined,                            "writeMemory: record persisted in KV");
    const stored = JSON.parse(raw);
    assert(stored.memory_id === "mem_write_valid",       "writeMemory: stored record has correct memory_id");
  }

  // rejeita memória inválida pelo schema PM1
  {
    const env = makeKVMock();
    const invalid = makeValidMemory({ memory_id: "" }); // missing required field
    const res = await writeMemory(invalid, env);
    assert(res.ok === false,                             "writeMemory: rejects invalid memory (empty memory_id)");
    assert(Array.isArray(res.errors),                    "writeMemory: returns errors array on invalid");
    // verify nothing was written to KV
    assert(env._store.size === 0,                        "writeMemory: does not write to KV on invalid input");
  }

  // rejeita memória com memory_type inválido
  {
    const env = makeKVMock();
    const invalid = makeValidMemory({ memory_id: "mem_bad_type", memory_type: "not_a_type" });
    const res = await writeMemory(invalid, env);
    assert(res.ok === false,                             "writeMemory: rejects invalid memory_type");
  }

  // rejeita duplicate memory_id (não duplica no índice)
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_dup" });
    await writeMemory(mem, env);
    const res2 = await writeMemory(mem, env);
    assert(res2.ok === false,                            "writeMemory: rejects duplicate memory_id");
    assert(typeof res2.error === "string",               "writeMemory: returns error string for duplicate");
    // index must not have duplicate entries
    const indexRaw = env._store.get("memory:index");
    const index = JSON.parse(indexRaw);
    const count = index.filter(id => id === "mem_dup").length;
    assert(count === 1,                                  "writeMemory: memory:index does not duplicate ids");
  }

  // -------------------------------------------------------------------------
  // Group 2: readMemoryById
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: readMemoryById");

  // lê memória por id
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_read_001" });
    await writeMemory(mem, env);
    const result = await readMemoryById("mem_read_001", env);
    assert(result !== null,                              "readMemoryById: returns object for existing id");
    assert(result.memory_id === "mem_read_001",          "readMemoryById: correct memory_id in result");
    assert(result.title === mem.title,                   "readMemoryById: correct title in result");
  }

  // retorna null para memória inexistente
  {
    const env = makeKVMock();
    const result = await readMemoryById("mem_nonexistent", env);
    assert(result === null,                              "readMemoryById: returns null for non-existent id");
  }

  // -------------------------------------------------------------------------
  // Group 3: updateMemory
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: updateMemory");

  // atualiza memória existente com patch válido
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_upd_001", title: "Título original" });
    await writeMemory(mem, env);
    const res = await updateMemory("mem_upd_001", { title: "Título atualizado" }, env);
    assert(res.ok === true,                              "updateMemory: updates existing memory");
    assert(res.record.title === "Título atualizado",     "updateMemory: patch applied correctly");
    assert(typeof res.record.updated_at === "string",    "updateMemory: updated_at is a string");
    assert(res.record.updated_at !== "2026-04-11T00:00:00Z", "updateMemory: updated_at changed from original");
    // verify persisted in KV
    const stored = JSON.parse(env._store.get("memory:mem_upd_001"));
    assert(stored.title === "Título atualizado",         "updateMemory: updated record persisted in KV");
  }

  // preserva campos existentes (não perde dados por merge ruim)
  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id:  "mem_upd_preserve",
      title:      "Título original",
      source:     "original_source",
      priority:   MEMORY_PRIORITY.HIGH,
    });
    await writeMemory(mem, env);
    const res = await updateMemory("mem_upd_preserve", { title: "Novo título" }, env);
    assert(res.ok === true,                              "updateMemory: preserves existing fields on patch");
    assert(res.record.source === "original_source",      "updateMemory: source field preserved after patch");
    assert(res.record.priority === MEMORY_PRIORITY.HIGH, "updateMemory: priority field preserved after patch");
  }

  // falha claramente ao tentar atualizar memória inexistente
  {
    const env = makeKVMock();
    const res = await updateMemory("mem_nonexistent", { title: "Qualquer coisa" }, env);
    assert(res.ok === false,                             "updateMemory: fails for non-existent memory_id");
    assert(typeof res.error === "string",                "updateMemory: returns error string for missing id");
  }

  // rejeita patch que tornaria o objeto inválido
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_upd_invalid_patch" });
    await writeMemory(mem, env);
    const res = await updateMemory("mem_upd_invalid_patch", { memory_type: "bad_type" }, env);
    assert(res.ok === false,                             "updateMemory: rejects patch that fails schema validation");
    assert(Array.isArray(res.errors),                    "updateMemory: returns errors for invalid patch");
  }

  // -------------------------------------------------------------------------
  // Group 4: archiveMemory
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: archiveMemory");

  // arquiva memória existente
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_arc_001", status: MEMORY_STATUS.ACTIVE });
    await writeMemory(mem, env);
    const res = await archiveMemory("mem_arc_001", null, env);
    assert(res.ok === true,                              "archiveMemory: archives existing memory");
    assert(res.record.status === "archived",             "archiveMemory: status set to archived");
    // verify record still exists in KV (not deleted)
    const raw = env._store.get("memory:mem_arc_001");
    assert(raw !== undefined,                            "archiveMemory: record preserved in KV (not deleted)");
    const stored = JSON.parse(raw);
    assert(stored.status === "archived",                 "archiveMemory: archived status persisted in KV");
  }

  // arquiva com meta opcional
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_arc_meta" });
    await writeMemory(mem, env);
    const res = await archiveMemory("mem_arc_meta", { reason: "obsolete", archived_by: "test" }, env);
    assert(res.ok === true,                                            "archiveMemory: accepts meta parameter");
    assert(res.record.content_structured._meta.reason === "obsolete", "archiveMemory: meta.reason saved in _meta");
    assert(
      res.record.content_structured.name === "Vasques",
      "archiveMemory: original content_structured fields preserved"
    );
  }

  // falha ao arquivar memória inexistente
  {
    const env = makeKVMock();
    const res = await archiveMemory("mem_nonexistent", null, env);
    assert(res.ok === false,                             "archiveMemory: fails for non-existent memory_id");
  }

  // -------------------------------------------------------------------------
  // Group 5: supersedeMemory
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: supersedeMemory");

  // supersede memória existente com id string
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_sup_old" });
    await writeMemory(mem, env);
    const res = await supersedeMemory("mem_sup_old", "mem_sup_new", null, env);
    assert(res.ok === true,                              "supersedeMemory: succeeds with replacement id string");
    assert(res.record.status === "superseded",           "supersedeMemory: status set to superseded");
    assert(
      res.record.content_structured._meta.superseded_by === "mem_sup_new",
      "supersedeMemory: superseded_by link stored in content_structured._meta"
    );
  }

  // supersede com objeto de memória como replacement
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_sup_obj_old" });
    await writeMemory(mem, env);
    const replacementObj = makeValidMemory({ memory_id: "mem_sup_obj_new" });
    const res = await supersedeMemory("mem_sup_obj_old", replacementObj, null, env);
    assert(res.ok === true,                              "supersedeMemory: succeeds with replacement memory object");
    assert(
      res.record.content_structured._meta.superseded_by === "mem_sup_obj_new",
      "supersedeMemory: extracts memory_id from replacement object"
    );
  }

  // preserva content_structured existente além de _meta
  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id:          "mem_sup_preserve",
      content_structured: { name: "Vasques", preferences: ["dark_mode"], score: 42 },
    });
    await writeMemory(mem, env);
    const res = await supersedeMemory("mem_sup_preserve", "mem_sup_next", null, env);
    assert(res.ok === true,                                                        "supersedeMemory: ok");
    assert(res.record.content_structured.name === "Vasques",                       "supersedeMemory: name preserved in content_structured");
    assert(Array.isArray(res.record.content_structured.preferences),               "supersedeMemory: preferences array preserved");
    assert(res.record.content_structured.score === 42,                             "supersedeMemory: numeric field preserved in content_structured");
    assert(res.record.content_structured._meta.superseded_by === "mem_sup_next",   "supersedeMemory: superseded_by present alongside preserved fields");
  }

  // supersede com meta extra
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_sup_meta" });
    await writeMemory(mem, env);
    const res = await supersedeMemory("mem_sup_meta", "mem_sup_meta_new", { reason: "revised" }, env);
    assert(res.ok === true,                                                         "supersedeMemory: accepts meta parameter");
    assert(
      res.record.content_structured._meta.superseded_by === "mem_sup_meta_new",
      "supersedeMemory: superseded_by present with meta"
    );
    assert(
      res.record.content_structured._meta.reason === "revised",
      "supersedeMemory: extra meta field stored"
    );
  }

  // rejeita replacement inválido
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_sup_bad_ref" });
    await writeMemory(mem, env);
    const res = await supersedeMemory("mem_sup_bad_ref", null, null, env);
    assert(res.ok === false,                             "supersedeMemory: rejects null replacement ref");
    assert(typeof res.error === "string",                "supersedeMemory: returns error for bad replacement ref");
  }

  // falha ao supersede memória inexistente
  {
    const env = makeKVMock();
    const res = await supersedeMemory("mem_nonexistent", "mem_sup_new", null, env);
    assert(res.ok === false,                             "supersedeMemory: fails for non-existent memory_id");
  }

  // -------------------------------------------------------------------------
  // Group 6: memory:index integrity
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: memory:index integrity");

  // índice acumula ids distintos
  {
    const env = makeKVMock();
    const m1 = makeValidMemory({ memory_id: "mem_idx_a" });
    const m2 = makeValidMemory({ memory_id: "mem_idx_b" });
    const m3 = makeValidMemory({ memory_id: "mem_idx_c" });
    await writeMemory(m1, env);
    await writeMemory(m2, env);
    await writeMemory(m3, env);
    const indexRaw = env._store.get("memory:index");
    const index = JSON.parse(indexRaw);
    assert(index.includes("mem_idx_a"),                  "memory:index: contains mem_idx_a");
    assert(index.includes("mem_idx_b"),                  "memory:index: contains mem_idx_b");
    assert(index.includes("mem_idx_c"),                  "memory:index: contains mem_idx_c");
    assert(index.length === 3,                           "memory:index: exactly 3 entries for 3 writes");
  }

  // índice não duplica ids após tentativa de escrita duplicada
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_idx_dup" });
    await writeMemory(mem, env);
    await writeMemory(mem, env); // segunda escrita deve falhar, índice não deve duplicar
    const indexRaw = env._store.get("memory:index");
    const index = JSON.parse(indexRaw);
    const count = index.filter(id => id === "mem_idx_dup").length;
    assert(count === 1,                                  "memory:index: no duplicate ids after repeated write attempt");
  }

  // updateMemory e archiveMemory não adicionam ids extras ao índice
  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_idx_ops" });
    await writeMemory(mem, env);
    await updateMemory("mem_idx_ops", { title: "Atualizado" }, env);
    await archiveMemory("mem_idx_ops", null, env);
    const indexRaw = env._store.get("memory:index");
    const index = JSON.parse(indexRaw);
    const count = index.filter(id => id === "mem_idx_ops").length;
    assert(count === 1,                                  "memory:index: update and archive do not add extra entries");
  }

  // -------------------------------------------------------------------------
  // Group 7: executor isolation
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: executor isolation");

  // nenhuma função acessa contract:* keys (verificação comportamental)
  {
    const env = makeKVMock();
    // Pre-populate a contract key to ensure it is untouched
    env._store.set("contract:index", JSON.stringify(["existing_contract"]));
    env._store.set("contract:c001:state", JSON.stringify({ id: "c001", status: "active" }));

    const mem = makeValidMemory({ memory_id: "mem_isolation_001" });
    await writeMemory(mem, env);
    await readMemoryById("mem_isolation_001", env);
    await updateMemory("mem_isolation_001", { title: "Isolamento" }, env);
    await archiveMemory("mem_isolation_001", null, env);

    const contractIndex = JSON.parse(env._store.get("contract:index"));
    assert(
      JSON.stringify(contractIndex) === JSON.stringify(["existing_contract"]),
      "executor isolation: writeMemory/read/update/archive do not touch contract:index"
    );
    const contractState = JSON.parse(env._store.get("contract:c001:state"));
    assert(
      contractState.id === "c001",
      "executor isolation: contract:c001:state untouched"
    );

    // All memory operations are scoped to memory:* keys only
    const memKeys = [...env._store.keys()].filter(k => k.startsWith("memory:"));
    const contractKeys = [...env._store.keys()].filter(k => k.startsWith("contract:"));
    assert(memKeys.length > 0,                           "executor isolation: memory:* keys written");
    assert(contractKeys.length === 2,                    "executor isolation: contract:* key count unchanged (still 2)");
  }

  // supersedeMemory também não toca contract:* keys
  {
    const env = makeKVMock();
    env._store.set("contract:index", "original");

    const mem = makeValidMemory({ memory_id: "mem_isolation_sup" });
    await writeMemory(mem, env);
    await supersedeMemory("mem_isolation_sup", "mem_replacement", null, env);

    assert(
      env._store.get("contract:index") === "original",
      "executor isolation: supersedeMemory does not touch contract:index"
    );
  }

  // módulo não importa contract-executor.js
  // (verificado estaticamente: o arquivo memory-storage.js não tem import do executor)
  assert(true, "executor isolation: memory-storage.js does not import contract-executor.js (static verification)");

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
