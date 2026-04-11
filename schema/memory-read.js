// ============================================================================
// 📦 ENAVIA — Memory Read Pipeline v1 (PM3 — Memory Read Pipeline)
//
// Consulta estruturada e determinística da memória persistida.
//
// Responsabilidades:
//   - searchMemory(filters, env)         — filtro estruturado
//   - searchRelevantMemory(context, env) — pipeline ordenado por relevância
//
// Fontes:
//   - PM1 (memory-schema.js)  — tipos, enums e shape canônico
//   - PM2 (memory-storage.js) — leitura via listMemoryIds + readMemoryById
//
// KV prefix lido: memory:* (nunca toca contract:*)
//
// NÃO contém:
//   - planner
//   - classificação de pedido
//   - busca semântica / vetorial / embeddings
//   - execução automática
//   - bridge com executor
//   - integração com painel
//   - escrita ou mutação de memória
//
// PM3 APENAS — não misturar com PM4+.
// ============================================================================

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
} from "./memory-schema.js";

import {
  listMemoryIds,
  readMemoryById,
} from "./memory-storage.js";

// ---------------------------------------------------------------------------
// Internal constants
// ---------------------------------------------------------------------------

// Status values considered inactive — excluded from results by default
const INACTIVE_STATUSES = new Set([
  MEMORY_STATUS.ARCHIVED,
  MEMORY_STATUS.EXPIRED,
  MEMORY_STATUS.SUPERSEDED,
]);

// Priority ordering — lower number = higher priority in results
const PRIORITY_RANK = {
  [MEMORY_PRIORITY.CRITICAL]: 0,
  [MEMORY_PRIORITY.HIGH]:     1,
  [MEMORY_PRIORITY.MEDIUM]:   2,
  [MEMORY_PRIORITY.LOW]:      3,
};

// Confidence ordering — lower number = higher confidence in results
const CONFIDENCE_RANK = {
  [MEMORY_CONFIDENCE.CONFIRMED]:  0,
  [MEMORY_CONFIDENCE.HIGH]:       1,
  [MEMORY_CONFIDENCE.MEDIUM]:     2,
  [MEMORY_CONFIDENCE.LOW]:        3,
  [MEMORY_CONFIDENCE.UNVERIFIED]: 4,
};

// ---------------------------------------------------------------------------
// _relevanceTier(mem, context)
//
// Assigns a tier number to a memory object based on its type and canonicity.
// Lower tier = returned earlier in searchRelevantMemory results.
//
// Tier 1 — permanent rules  : canonical_rules + is_canonical=true
// Tier 2 — canonical contracts : any type with is_canonical=true
// Tier 3 — project memory
// Tier 4 — live context
// Tier 5 — user profile / preferences
// Tier 6 — operational history (recent)
// Tier 7 — anything else
// ---------------------------------------------------------------------------
function _relevanceTier(mem, context) {
  const isCanonical = mem.is_canonical === true;

  // Tier 1: permanent canonical rules
  if (mem.memory_type === MEMORY_TYPES.CANONICAL_RULES && isCanonical) return 1;

  // Tier 2: any canonical contract (is_canonical=true, non-rule types)
  if (isCanonical) return 2;

  // Tier 3: project memories
  if (mem.memory_type === MEMORY_TYPES.PROJECT) return 3;

  // Tier 4: live context
  if (mem.memory_type === MEMORY_TYPES.LIVE_CONTEXT) return 4;

  // Tier 5: user profile / preferences
  if (mem.memory_type === MEMORY_TYPES.USER_PROFILE) return 5;

  // Tier 6: operational history
  if (mem.memory_type === MEMORY_TYPES.OPERATIONAL_HISTORY) return 6;

  // Tier 7: uncategorised / future types
  return 7;
}

// ---------------------------------------------------------------------------
// _sortComparator(a, b, context)
//
// Stable deterministic comparator for sorting memory objects.
// Order:
//   1. relevance tier (ascending — lower = more relevant)
//   2. priority rank  (ascending — critical before low)
//   3. confidence rank (ascending — confirmed before unverified)
//   4. updated_at     (descending — most recent first)
// ---------------------------------------------------------------------------
function _sortComparator(a, b, context) {
  const tierDiff = _relevanceTier(a, context) - _relevanceTier(b, context);
  if (tierDiff !== 0) return tierDiff;

  const prioA = PRIORITY_RANK[a.priority] ?? 2;
  const prioB = PRIORITY_RANK[b.priority] ?? 2;
  if (prioA !== prioB) return prioA - prioB;

  const confA = CONFIDENCE_RANK[a.confidence] ?? 2;
  const confB = CONFIDENCE_RANK[b.confidence] ?? 2;
  if (confA !== confB) return confA - confB;

  const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  return dateB - dateA;
}

// ---------------------------------------------------------------------------
// _loadAllMemories(env)
//
// Internal helper. Reads all memory_ids from the index and fetches each
// object from KV. Skips any id that resolves to null (deleted/corrupted).
// ---------------------------------------------------------------------------
async function _loadAllMemories(env) {
  const ids = await listMemoryIds(env);
  const results = [];
  for (const id of ids) {
    const mem = await readMemoryById(id, env);
    if (mem !== null) results.push(mem);
  }
  return results;
}

// ---------------------------------------------------------------------------
// searchMemory(filters, env)
//
// Structured filter-based search over the persisted memory store.
// All filters are optional; passing an empty object returns all active memories.
//
// filters:
//   memory_type       — string  — exact match on memory_type
//   entity_type       — string  — exact match on entity_type
//   entity_id         — string  — exact match on entity_id
//   status            — string | string[]  — exact match; multi-value allowed
//   is_canonical      — boolean — exact match on is_canonical flag
//   text              — string  — simple case-insensitive substring match on title
//   include_inactive  — boolean — if true, includes archived/expired/superseded
//                                 (default: false)
//
// Returns:
//   { ok: true,  results: MemoryObject[], count: number }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function searchMemory(filters, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }

  const f =
    filters && typeof filters === "object" && !Array.isArray(filters)
      ? filters
      : {};

  let memories;
  try {
    memories = await _loadAllMemories(env);
  } catch (err) {
    return { ok: false, error: `failed to load memories: ${err.message}` };
  }

  const results = memories.filter((mem) => {
    // Exclude inactive unless explicitly requested
    if (!f.include_inactive && INACTIVE_STATUSES.has(mem.status)) return false;

    // memory_type filter
    if (f.memory_type !== undefined && mem.memory_type !== f.memory_type) return false;

    // entity_type filter
    if (f.entity_type !== undefined && mem.entity_type !== f.entity_type) return false;

    // entity_id filter
    if (f.entity_id !== undefined && mem.entity_id !== f.entity_id) return false;

    // status filter — string or array of strings
    if (f.status !== undefined) {
      const allowedStatuses = Array.isArray(f.status) ? f.status : [f.status];
      if (!allowedStatuses.includes(mem.status)) return false;
    }

    // is_canonical filter
    if (f.is_canonical !== undefined && mem.is_canonical !== f.is_canonical) return false;

    // simple text filter — case-insensitive substring match on title only
    if (
      f.text !== undefined &&
      typeof f.text === "string" &&
      f.text.trim() !== ""
    ) {
      const needle = f.text.trim().toLowerCase();
      const haystack = (mem.title || "").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }

    return true;
  });

  return { ok: true, results, count: results.length };
}

// ---------------------------------------------------------------------------
// searchRelevantMemory(context, env)
//
// Returns memory ordered for planner use, following the canonical read order:
//   1. permanent rules  (canonical_rules + is_canonical=true)
//   2. canonical contracts (any type with is_canonical=true)
//   3. relevant project memory (filtered by context.project_id if given)
//   4. live context
//   5. user profile / preferences
//   6. recent operational history
//
// Archived, expired and superseded memories are excluded by default.
// Within each tier, ordering uses: priority → confidence → updated_at desc.
//
// Canonical rules and canonical contracts are always included regardless of
// context filters, because they have global precedence.
// Live context is also always included (global state).
//
// context (optional plain object):
//   project_id — string — narrows project memories to this entity_id
//   entity_id  — string — narrows user_profile and operational_history
//
// Returns:
//   { ok: true,  results: MemoryObject[], count: number }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function searchRelevantMemory(context, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }

  const ctx =
    context && typeof context === "object" && !Array.isArray(context)
      ? context
      : {};

  let memories;
  try {
    memories = await _loadAllMemories(env);
  } catch (err) {
    return { ok: false, error: `failed to load memories: ${err.message}` };
  }

  // Step 1: exclude inactive memories (archived / expired / superseded)
  const active = memories.filter((mem) => !INACTIVE_STATUSES.has(mem.status));

  // Step 2: scope results based on context
  const scoped = active.filter((mem) => {
    // Canonical rules always included — permanent global rules
    if (mem.memory_type === MEMORY_TYPES.CANONICAL_RULES) return true;

    // Canonical contracts always included — canonical precedence
    if (mem.is_canonical === true) return true;

    // Live context always included — current real state
    if (mem.memory_type === MEMORY_TYPES.LIVE_CONTEXT) return true;

    // Project memories: if project_id given, restrict to matching entity_id
    if (mem.memory_type === MEMORY_TYPES.PROJECT) {
      if (ctx.project_id) return mem.entity_id === ctx.project_id;
      return true; // no project_id filter → include all projects
    }

    // User profile and operational history: if entity_id given, restrict
    if (ctx.entity_id) return mem.entity_id === ctx.entity_id;

    // No context constraints → include
    return true;
  });

  // Step 3: sort deterministically using tier → priority → confidence → date
  const sorted = [...scoped].sort((a, b) => _sortComparator(a, b, ctx));

  return { ok: true, results: sorted, count: sorted.length };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  searchMemory,
  searchRelevantMemory,
};
