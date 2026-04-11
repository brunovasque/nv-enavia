// ============================================================================
// 📦 ENAVIA — Memory Storage v1 (PM2 — Memory Storage Core)
//
// Persistência básica da memória usando Cloudflare KV (ENAVIA_BRAIN).
//
// Responsabilidades:
//   - writeMemory(memoryObj, env)
//   - readMemoryById(memory_id, env)
//   - updateMemory(memory_id, patch, env)
//   - archiveMemory(memory_id, meta, env)
//   - supersedeMemory(memory_id, replacementMemoryOrId, meta, env)
//
// KV key scheme (isolado de contract:*):
//   memory:<memory_id>  → objeto JSON de memória individual
//   memory:index        → array de memory_id (rastreabilidade mínima)
//
// NÃO contém:
//   - planner
//   - busca semântica/relevância
//   - leitura automática de contexto
//   - bridge com executor
//   - integração com painel
//   - qualquer acesso a contract:* keys
//
// PM2 APENAS — não misturar com PM3+.
// ============================================================================

import {
  validateMemoryObject,
} from "./memory-schema.js";

// ---------------------------------------------------------------------------
// KV Key Helpers
// ---------------------------------------------------------------------------
const KV_PREFIX_MEMORY = "memory:";
const KV_INDEX_KEY = "memory:index";

function memoryKey(memory_id) {
  return `${KV_PREFIX_MEMORY}${memory_id}`;
}

// ---------------------------------------------------------------------------
// _readIndex(env) / _writeIndex(index, env)
//
// Internal helpers for the memory:index array.
// The index contains an ordered list of memory_id strings.
// ---------------------------------------------------------------------------
async function _readIndex(env) {
  const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

async function _writeIndex(index, env) {
  await env.ENAVIA_BRAIN.put(KV_INDEX_KEY, JSON.stringify(index));
}

// ---------------------------------------------------------------------------
// writeMemory(memoryObj, env)
//
// 1. Validates memoryObj against PM1 schema.
// 2. Rejects if memory_id already exists (returns error, does NOT duplicate).
// 3. Persists memory:<memory_id> and adds memory_id to memory:index.
//
// Returns:
//   { ok: true,  memory_id, record }          — on success
//   { ok: false, error: string, errors?: [] }  — on validation or duplicate failure
// ---------------------------------------------------------------------------
async function writeMemory(memoryObj, env) {
  const validation = validateMemoryObject(memoryObj);
  if (!validation.valid) {
    return { ok: false, error: "schema validation failed", errors: validation.errors };
  }

  const { memory_id } = memoryObj;

  // Reject duplicate — do not allow overwrite via write
  const existing = await env.ENAVIA_BRAIN.get(memoryKey(memory_id));
  if (existing !== null) {
    return {
      ok: false,
      error: `memory_id '${memory_id}' already exists; use updateMemory to modify`,
    };
  }

  // Persist the record
  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(memoryObj));

  // Update index without duplicating
  const index = await _readIndex(env);
  if (!index.includes(memory_id)) {
    index.push(memory_id);
    await _writeIndex(index, env);
  }

  return { ok: true, memory_id, record: memoryObj };
}

// ---------------------------------------------------------------------------
// readMemoryById(memory_id, env)
//
// Reads a memory object by its id.
//
// Returns:
//   The memory object (plain object)  — when found
//   null                              — when not found
// ---------------------------------------------------------------------------
async function readMemoryById(memory_id, env) {
  const raw = await env.ENAVIA_BRAIN.get(memoryKey(memory_id));
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// updateMemory(memory_id, patch, env)
//
// 1. Reads the existing memory object.
// 2. Applies patch shallowly (Object.assign) — preserves all existing fields.
// 3. Forces updated_at to current ISO timestamp.
// 4. Re-validates the final object against the PM1 schema.
// 5. Persists if valid.
//
// Returns:
//   { ok: true,  memory_id, record }          — on success
//   { ok: false, error: string, errors?: [] }  — on missing or validation failure
// ---------------------------------------------------------------------------
async function updateMemory(memory_id, patch, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }

  const updated = Object.assign({}, existing, patch, {
    updated_at: new Date().toISOString(),
  });

  const validation = validateMemoryObject(updated);
  if (!validation.valid) {
    return { ok: false, error: "schema validation failed after patch", errors: validation.errors };
  }

  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(updated));
  return { ok: true, memory_id, record: updated };
}

// ---------------------------------------------------------------------------
// archiveMemory(memory_id, meta, env)
//
// Sets status to "archived" and updates updated_at.
// Preserves the full memory record — no deletion.
//
// Parameters:
//   meta (optional) — plain object; merged into content_structured._meta
//                     to carry archival metadata (e.g. reason, archived_by)
//
// Returns:
//   { ok: true,  memory_id, record }     — on success
//   { ok: false, error: string }         — on missing record
// ---------------------------------------------------------------------------
async function archiveMemory(memory_id, meta, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }

  // Build updated content_structured preserving all existing fields
  const updatedContentStructured = Object.assign({}, existing.content_structured);
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    updatedContentStructured._meta = Object.assign(
      {},
      updatedContentStructured._meta || {},
      meta
    );
  }

  const archived = Object.assign({}, existing, {
    status:             "archived",
    updated_at:         new Date().toISOString(),
    content_structured: updatedContentStructured,
  });

  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(archived));
  return { ok: true, memory_id, record: archived };
}

// ---------------------------------------------------------------------------
// supersedeMemory(memory_id, replacementMemoryOrId, meta, env)
//
// Marks the old memory as "superseded" and records a minimal link to its
// replacement without deleting any history.
//
// The replacement reference is stored as:
//   content_structured._meta.superseded_by = <replacement memory_id string>
//
// Parameters:
//   memory_id             — id of the memory being superseded
//   replacementMemoryOrId — either a memory_id string or a memory object
//                           (memory_id is extracted from an object)
//   meta (optional)       — extra metadata merged into content_structured._meta
//
// Returns:
//   { ok: true,  memory_id, record }     — on success
//   { ok: false, error: string }         — on missing record or bad replacement ref
// ---------------------------------------------------------------------------
async function supersedeMemory(memory_id, replacementMemoryOrId, meta, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }

  // Resolve replacement id
  let replacementId;
  if (typeof replacementMemoryOrId === "string" && replacementMemoryOrId.trim() !== "") {
    replacementId = replacementMemoryOrId.trim();
  } else if (
    replacementMemoryOrId &&
    typeof replacementMemoryOrId === "object" &&
    !Array.isArray(replacementMemoryOrId) &&
    typeof replacementMemoryOrId.memory_id === "string" &&
    replacementMemoryOrId.memory_id.trim() !== ""
  ) {
    replacementId = replacementMemoryOrId.memory_id.trim();
  } else {
    return {
      ok: false,
      error: "replacementMemoryOrId must be a non-empty string id or a memory object with a valid memory_id",
    };
  }

  // Build updated content_structured: inject _meta.superseded_by without
  // touching any other key in content_structured
  const updatedContentStructured = Object.assign({}, existing.content_structured);
  updatedContentStructured._meta = Object.assign(
    {},
    updatedContentStructured._meta || {},
    { superseded_by: replacementId },
    meta && typeof meta === "object" && !Array.isArray(meta) ? meta : {}
  );

  const superseded = Object.assign({}, existing, {
    status:             "superseded",
    updated_at:         new Date().toISOString(),
    content_structured: updatedContentStructured,
  });

  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(superseded));
  return { ok: true, memory_id, record: superseded };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  writeMemory,
  readMemoryById,
  updateMemory,
  archiveMemory,
  supersedeMemory,
};
