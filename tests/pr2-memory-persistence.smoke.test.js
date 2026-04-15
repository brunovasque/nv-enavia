// ============================================================================
// 🧪 Smoke Tests — PR2: Persistência Backend da Memória
//
// Run: node tests/pr2-memory-persistence.smoke.test.js
//
// Prova que:
//   1. Memória persiste de verdade (save/read)
//   2. Leitura funciona (incluindo auto-expiração)
//   3. Atualização funciona
//   4. Bloqueio/invalidação funciona
//   5. Expiração por registro funciona
//   6. Tipos canônicos PR1 são aceitos (conversa_atual, memoria_longa, etc.)
//   7. Nível bloqueado existe e funciona
//   8. memoria_manual aceita no backend
//   9. memoria_temporaria exige expires_at
//  10. Nada do schema/storage anterior quebrou
// ============================================================================

import {
  writeMemory,
  readMemoryById,
  updateMemory,
  archiveMemory,
  supersedeMemory,
  invalidateMemory,
  blockMemory,
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

// ---------------------------------------------------------------------------
// In-memory KV mock
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

function makeValidMemory(overrides = {}) {
  return buildMemoryObject({
    memory_id:          "mem_pr2_001",
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user_vasques",
    title:              "Perfil principal do usuário",
    content_structured: { name: "Vasques", preferences: [] },
    priority:           MEMORY_PRIORITY.HIGH,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "pr2_smoke_test",
    created_at:         "2026-04-15T00:00:00Z",
    updated_at:         "2026-04-15T00:00:00Z",
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    ...overrides,
  });
}

async function runTests() {
  console.log("\n=== PR2 — Persistência Backend da Memória — Smoke Tests ===\n");

  // -------------------------------------------------------------------------
  // Group 1: Tipos canônicos PR1 existem no schema
  // -------------------------------------------------------------------------
  console.log("Group 1: Tipos canônicos PR1 existem no schema");

  assert(MEMORY_TYPES.CONVERSA_ATUAL       === "conversa_atual",       "MEMORY_TYPES.CONVERSA_ATUAL");
  assert(MEMORY_TYPES.MEMORIA_LONGA        === "memoria_longa",        "MEMORY_TYPES.MEMORIA_LONGA");
  assert(MEMORY_TYPES.MEMORIA_MANUAL       === "memoria_manual",       "MEMORY_TYPES.MEMORIA_MANUAL");
  assert(MEMORY_TYPES.APRENDIZADO_VALIDADO === "aprendizado_validado", "MEMORY_TYPES.APRENDIZADO_VALIDADO");
  assert(MEMORY_TYPES.MEMORIA_TEMPORARIA   === "memoria_temporaria",   "MEMORY_TYPES.MEMORIA_TEMPORARIA");

  // Tipos originais preservados
  assert(MEMORY_TYPES.USER_PROFILE        === "user_profile",        "MEMORY_TYPES.USER_PROFILE (preserved)");
  assert(MEMORY_TYPES.PROJECT             === "project",             "MEMORY_TYPES.PROJECT (preserved)");
  assert(MEMORY_TYPES.CANONICAL_RULES     === "canonical_rules",     "MEMORY_TYPES.CANONICAL_RULES (preserved)");
  assert(MEMORY_TYPES.OPERATIONAL_HISTORY === "operational_history", "MEMORY_TYPES.OPERATIONAL_HISTORY (preserved)");
  assert(MEMORY_TYPES.LIVE_CONTEXT        === "live_context",        "MEMORY_TYPES.LIVE_CONTEXT (preserved)");

  // -------------------------------------------------------------------------
  // Group 2: Nível bloqueado existe no schema
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: Nível bloqueado existe no schema");

  assert(MEMORY_STATUS.BLOCKED     === "blocked",    "MEMORY_STATUS.BLOCKED");
  assert(MEMORY_CONFIDENCE.BLOCKED === "blocked",    "MEMORY_CONFIDENCE.BLOCKED");
  assert(MEMORY_FLAGS.IS_BLOCKED   === "is_blocked", "MEMORY_FLAGS.IS_BLOCKED");

  // -------------------------------------------------------------------------
  // Group 3: Memória persiste de verdade (save + read)
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: Memória persiste de verdade");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_persist_001" });
    const res = await writeMemory(mem, env);
    assert(res.ok === true, "writeMemory: save succeeds");
    assert(res.memory_id === "mem_persist_001", "writeMemory: returns correct id");

    const read = await readMemoryById("mem_persist_001", env);
    assert(read !== null, "readMemoryById: returns record");
    assert(read.memory_id === "mem_persist_001", "readMemoryById: correct id");
    assert(read.title === "Perfil principal do usuário", "readMemoryById: correct title");
    assert(read.status === "active", "readMemoryById: correct status");
  }

  // -------------------------------------------------------------------------
  // Group 4: Atualização funciona
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: Atualização funciona");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_upd_pr2", title: "Original" });
    await writeMemory(mem, env);
    const res = await updateMemory("mem_upd_pr2", { title: "Atualizado PR2" }, env);
    assert(res.ok === true, "updateMemory: succeeds");
    assert(res.record.title === "Atualizado PR2", "updateMemory: patch applied");
    assert(res.record.updated_at !== "2026-04-15T00:00:00Z", "updateMemory: timestamp changed");

    const read = await readMemoryById("mem_upd_pr2", env);
    assert(read.title === "Atualizado PR2", "updateMemory: persisted in KV");
  }

  // -------------------------------------------------------------------------
  // Group 5: Bloqueio funciona (blockMemory)
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: Bloqueio funciona");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_block_001" });
    await writeMemory(mem, env);
    const res = await blockMemory("mem_block_001", { reason: "revoked" }, env);
    assert(res.ok === true, "blockMemory: succeeds");
    assert(res.record.status === "blocked", "blockMemory: status set to blocked");
    assert(res.record.confidence === "blocked", "blockMemory: confidence set to blocked");
    assert(res.record.flags.includes("is_blocked"), "blockMemory: IS_BLOCKED flag present");
    assert(res.record.content_structured._meta.reason === "revoked", "blockMemory: meta preserved");

    // Blocked memory persists in KV (never deleted)
    const read = await readMemoryById("mem_block_001", env);
    assert(read !== null, "blockMemory: record still in KV");
    assert(read.status === "blocked", "blockMemory: persisted blocked status");
  }

  // blockMemory fails for non-existent id
  {
    const env = makeKVMock();
    const res = await blockMemory("mem_nonexistent", null, env);
    assert(res.ok === false, "blockMemory: fails for non-existent id");
  }

  // -------------------------------------------------------------------------
  // Group 6: Invalidação funciona (invalidateMemory)
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: Invalidação funciona");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_inv_001" });
    await writeMemory(mem, env);
    const res = await invalidateMemory("mem_inv_001", { reason: "obsolete" }, env);
    assert(res.ok === true, "invalidateMemory: succeeds");
    assert(res.record.status === "expired", "invalidateMemory: status set to expired");
    assert(res.record.flags.includes("is_expired"), "invalidateMemory: IS_EXPIRED flag present");
    assert(res.record.content_structured._meta.reason === "obsolete", "invalidateMemory: meta preserved");

    // Record still exists in KV
    const read = await readMemoryById("mem_inv_001", env);
    assert(read !== null, "invalidateMemory: record still in KV");
  }

  // invalidateMemory fails for non-existent id
  {
    const env = makeKVMock();
    const res = await invalidateMemory("mem_nonexistent", null, env);
    assert(res.ok === false, "invalidateMemory: fails for non-existent id");
  }

  // -------------------------------------------------------------------------
  // Group 7: Expiração automática por registro funciona
  // -------------------------------------------------------------------------
  console.log("\nGroup 7: Expiração automática por registro");

  // expires_at no passado → read retorna com status expired
  {
    const env = makeKVMock();
    const pastDate = new Date(Date.now() - 60000).toISOString(); // 1 minuto atrás
    const mem = makeValidMemory({
      memory_id: "mem_exp_auto",
      expires_at: pastDate,
    });
    await writeMemory(mem, env);

    const read = await readMemoryById("mem_exp_auto", env);
    assert(read !== null, "auto-expire: record exists");
    assert(read.status === "expired", "auto-expire: status automatically set to expired");
    assert(read.flags.includes("is_expired"), "auto-expire: IS_EXPIRED flag added");
  }

  // expires_at no futuro → read retorna com status original
  {
    const env = makeKVMock();
    const futureDate = new Date(Date.now() + 3600000).toISOString(); // 1h no futuro
    const mem = makeValidMemory({
      memory_id: "mem_exp_future",
      expires_at: futureDate,
    });
    await writeMemory(mem, env);

    const read = await readMemoryById("mem_exp_future", env);
    assert(read !== null, "future-expire: record exists");
    assert(read.status === "active", "future-expire: status remains active");
  }

  // expires_at null → sem expiração, status inalterado
  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id: "mem_no_exp",
      expires_at: null,
    });
    await writeMemory(mem, env);

    const read = await readMemoryById("mem_no_exp", env);
    assert(read.status === "active", "no-expire: status remains active");
  }

  // blocked memory com expires_at no passado NÃO muda status (blocked prevalece)
  {
    const env = makeKVMock();
    const pastDate = new Date(Date.now() - 60000).toISOString();
    const mem = makeValidMemory({
      memory_id: "mem_block_exp",
      expires_at: pastDate,
    });
    await writeMemory(mem, env);
    await blockMemory("mem_block_exp", null, env);

    const read = await readMemoryById("mem_block_exp", env);
    assert(read.status === "blocked", "blocked+expired: blocked status preserved");
  }

  // -------------------------------------------------------------------------
  // Group 8: memoria_manual aceita no backend
  // -------------------------------------------------------------------------
  console.log("\nGroup 8: memoria_manual aceita no backend");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id:   "mem_manual_001",
      memory_type: MEMORY_TYPES.MEMORIA_MANUAL,
      source:      "painel",
      confidence:  MEMORY_CONFIDENCE.HIGH,
    });
    const v = validateMemoryObject(mem);
    assert(v.valid === true, "memoria_manual: schema validation passes");

    const res = await writeMemory(mem, env);
    assert(res.ok === true, "memoria_manual: writeMemory succeeds");

    const read = await readMemoryById("mem_manual_001", env);
    assert(read !== null, "memoria_manual: persisted and readable");
    assert(read.memory_type === "memoria_manual", "memoria_manual: correct type stored");
  }

  // -------------------------------------------------------------------------
  // Group 9: memoria_temporaria exige expires_at
  // -------------------------------------------------------------------------
  console.log("\nGroup 9: memoria_temporaria exige expires_at");

  // sem expires_at → rejeita
  {
    const mem = makeValidMemory({
      memory_type: MEMORY_TYPES.MEMORIA_TEMPORARIA,
      expires_at:  null,
    });
    const v = validateMemoryObject(mem);
    assert(v.valid === false, "memoria_temporaria: rejects when expires_at is null");
    assert(
      v.errors.some(e => e.includes("expires_at") && e.includes("memoria_temporaria")),
      "memoria_temporaria: error mentions expires_at requirement"
    );
  }

  // com expires_at → aceita
  {
    const env = makeKVMock();
    const futureDate = new Date(Date.now() + 3600000).toISOString();
    const mem = makeValidMemory({
      memory_id:   "mem_temp_001",
      memory_type: MEMORY_TYPES.MEMORIA_TEMPORARIA,
      expires_at:  futureDate,
      priority:    MEMORY_PRIORITY.LOW,
    });
    const v = validateMemoryObject(mem);
    assert(v.valid === true, "memoria_temporaria: accepts with expires_at set");

    const res = await writeMemory(mem, env);
    assert(res.ok === true, "memoria_temporaria: writeMemory succeeds");

    const read = await readMemoryById("mem_temp_001", env);
    assert(read !== null, "memoria_temporaria: persisted and readable");
    assert(read.memory_type === "memoria_temporaria", "memoria_temporaria: correct type stored");
  }

  // -------------------------------------------------------------------------
  // Group 10: Escrita de memória bloqueada é rejeitada
  // -------------------------------------------------------------------------
  console.log("\nGroup 10: Escrita de memória bloqueada rejeitada");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id:  "mem_write_blocked",
      status:     MEMORY_STATUS.BLOCKED,
      confidence: MEMORY_CONFIDENCE.BLOCKED,
      flags:      [MEMORY_FLAGS.IS_BLOCKED],
    });
    const res = await writeMemory(mem, env);
    assert(res.ok === false, "writeMemory: rejects blocked memory");
    assert(typeof res.error === "string" && res.error.includes("blocked"), "writeMemory: error mentions blocked");
  }

  // -------------------------------------------------------------------------
  // Group 11: Tipos canônicos PR1 todos persistem corretamente
  // -------------------------------------------------------------------------
  console.log("\nGroup 11: Todos os tipos canônicos PR1 persistem");

  const canonicalTypes = [
    { type: MEMORY_TYPES.CONVERSA_ATUAL,       id: "mem_ca_001", entity: ENTITY_TYPES.CONTEXT },
    { type: MEMORY_TYPES.MEMORIA_LONGA,        id: "mem_ml_001", entity: ENTITY_TYPES.USER },
    { type: MEMORY_TYPES.MEMORIA_MANUAL,       id: "mem_mm_001", entity: ENTITY_TYPES.USER },
    { type: MEMORY_TYPES.APRENDIZADO_VALIDADO, id: "mem_av_001", entity: ENTITY_TYPES.RULE },
    { type: MEMORY_TYPES.MEMORIA_TEMPORARIA,   id: "mem_mt_001", entity: ENTITY_TYPES.OPERATION },
  ];

  for (const { type, id, entity } of canonicalTypes) {
    const env = makeKVMock();
    const overrides = {
      memory_id:   id,
      memory_type: type,
      entity_type: entity,
    };
    // memoria_temporaria needs expires_at
    if (type === MEMORY_TYPES.MEMORIA_TEMPORARIA) {
      overrides.expires_at = new Date(Date.now() + 3600000).toISOString();
    }
    const mem = makeValidMemory(overrides);
    const v = validateMemoryObject(mem);
    assert(v.valid === true, `type ${type}: validates`);
    const res = await writeMemory(mem, env);
    assert(res.ok === true, `type ${type}: persists`);
    const read = await readMemoryById(id, env);
    assert(read !== null && read.memory_type === type, `type ${type}: readable with correct type`);
  }

  // -------------------------------------------------------------------------
  // Group 12: Funções existentes não quebraram (archive + supersede)
  // -------------------------------------------------------------------------
  console.log("\nGroup 12: Compatibilidade — archive e supersede preservados");

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_compat_arc" });
    await writeMemory(mem, env);
    const res = await archiveMemory("mem_compat_arc", { reason: "test" }, env);
    assert(res.ok === true, "archiveMemory: still works");
    assert(res.record.status === "archived", "archiveMemory: status correct");
  }

  {
    const env = makeKVMock();
    const mem = makeValidMemory({ memory_id: "mem_compat_sup" });
    await writeMemory(mem, env);
    const res = await supersedeMemory("mem_compat_sup", "mem_new", null, env);
    assert(res.ok === true, "supersedeMemory: still works");
    assert(res.record.status === "superseded", "supersedeMemory: status correct");
  }

  // -------------------------------------------------------------------------
  // Group 13: Campos mínimos obrigatórios validam
  // -------------------------------------------------------------------------
  console.log("\nGroup 13: Campos mínimos obrigatórios");

  {
    const mem = makeValidMemory();
    assert(typeof mem.memory_id === "string",          "campo: memory_id presente");
    assert(typeof mem.memory_type === "string",        "campo: memory_type presente");
    assert(typeof mem.entity_type === "string",        "campo: entity_type presente");
    assert(typeof mem.entity_id === "string",          "campo: entity_id presente");
    assert(typeof mem.title === "string",              "campo: title presente");
    assert(typeof mem.content_structured === "object", "campo: content_structured presente");
    assert(typeof mem.source === "string",             "campo: source presente");
    assert(typeof mem.priority === "string",           "campo: priority presente");
    assert(typeof mem.confidence === "string",         "campo: confidence presente");
    assert(typeof mem.status === "string",             "campo: status presente");
    assert(typeof mem.created_at === "string",         "campo: created_at presente");
    assert(typeof mem.updated_at === "string",         "campo: updated_at presente");
    assert(typeof mem.is_canonical === "boolean",      "campo: is_canonical presente");
    assert(Array.isArray(mem.flags),                   "campo: flags presente");
    assert(Array.isArray(mem.tags),                    "campo: tags presente");
    // expires_at pode ser null
    assert(mem.expires_at === null || typeof mem.expires_at === "string", "campo: expires_at presente (null ou string)");
  }

  // -------------------------------------------------------------------------
  // Group 14: tags — suporte real no schema, validação e persistência
  // -------------------------------------------------------------------------
  console.log("\nGroup 14: tags — suporte real");

  // tags vazio por default
  {
    const mem = makeValidMemory();
    assert(Array.isArray(mem.tags),  "tags: default é array");
    assert(mem.tags.length === 0,    "tags: default é array vazio");
  }

  // tags com valores válidos persiste e lê corretamente
  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id: "mem_tags_persist",
      tags:      ["usuario", "perfil", "projeto-enavia"],
    });
    const v = validateMemoryObject(mem);
    assert(v.valid === true, "tags: objeto com tags válidas valida corretamente");

    const res = await writeMemory(mem, env);
    assert(res.ok === true, "tags: writeMemory com tags válidas succeeds");

    const read = await readMemoryById("mem_tags_persist", env);
    assert(read !== null, "tags: record persisted");
    assert(Array.isArray(read.tags), "tags: campo tags presente no registro lido");
    assert(read.tags.length === 3, "tags: todas as tags preservadas");
    assert(read.tags.includes("usuario"), "tags: valor 'usuario' preservado");
    assert(read.tags.includes("projeto-enavia"), "tags: valor 'projeto-enavia' preservado");
  }

  // tags persistem após updateMemory
  {
    const env = makeKVMock();
    const mem = makeValidMemory({
      memory_id: "mem_tags_upd",
      tags:      ["inicial"],
    });
    await writeMemory(mem, env);
    const res = await updateMemory("mem_tags_upd", { tags: ["inicial", "adicionada"] }, env);
    assert(res.ok === true, "tags: updateMemory com tags succeeds");
    assert(res.record.tags.includes("adicionada"), "tags: nova tag presente após update");

    const read = await readMemoryById("mem_tags_upd", env);
    assert(read.tags.length === 2, "tags: tags atualizadas persistidas em KV");
  }

  // rejeita tags com item não-string
  {
    const mem = Object.assign(makeValidMemory(), { tags: ["valida", 42] });
    const v = validateMemoryObject(mem);
    assert(v.valid === false, "tags: rejeita array com item não-string");
    assert(v.errors.some(e => e.includes("tags")), "tags: erro menciona 'tags'");
  }

  // rejeita tags com string vazia
  {
    const mem = Object.assign(makeValidMemory(), { tags: ["valida", ""] });
    const v = validateMemoryObject(mem);
    assert(v.valid === false, "tags: rejeita array com string vazia");
  }

  // rejeita tags não-array
  {
    const mem = Object.assign(makeValidMemory(), { tags: "não-array" });
    const v = validateMemoryObject(mem);
    assert(v.valid === false, "tags: rejeita valor não-array");
    assert(v.errors.some(e => e.includes("tags")), "tags: erro menciona 'tags'");
  }

  // tags isoladas entre objetos construídos
  {
    const obj1 = makeValidMemory({ memory_id: "tags_iso_a" });
    const obj2 = makeValidMemory({ memory_id: "tags_iso_b" });
    assert(obj1.tags !== obj2.tags, "tags: arrays distintos entre instâncias");
    obj1.tags.push("x");
    assert(obj2.tags.length === 0,  "tags: mutação de obj1.tags não afeta obj2");
  }

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`PR2 Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in PR2 smoke tests:", err);
  process.exit(1);
});
