// ============================================================================
// 📦 ENAVIA — Memory Retrieval Pipeline v1 (PR3 — Retrieval + Separação)
//
// Pipeline de leitura de memória antes da resposta/plano, com separação
// explícita entre:
//   - current_context      (conversa_atual / live_context)
//   - historical_memory    (memoria_longa / user_profile / project / op_history)
//   - manual_instructions  (memoria_manual / source: "panel" | "operador")
//   - validated_learning   (aprendizado_validado / canonical_rules + is_canonical)
//
// Implementa:
//   1. Pipeline de leitura antes da resposta
//   2. Separação explícita em 4 blocos
//   3. Ranking básico de relevância (determinístico)
//   4. Regra de recência
//   5. Regra de conflito (contexto atual prevalece)
//   6. Tratamento de memória antiga como referência histórica
//
// Regra de Ouro (PR1 §3):
//   Memória antiga nunca domina o contexto atual sem checagem.
//   Se houver contradição entre memória longa e conversa atual,
//   a conversa atual prevalece e a memória antiga vira referência histórica.
//
// Fontes:
//   - PM1 (memory-schema.js)  — tipos, enums e shape canônico
//   - PM3 (memory-read.js)    — searchRelevantMemory (leitura base)
//
// NÃO contém:
//   - painel manual (PR4)
//   - aprendizado controlado (PR5)
//   - telemetria pesada (PR6)
//   - busca vetorial / embeddings
//   - escrita ou mutação de memória
//   - executor / bridge / planner
//
// PR3 APENAS — não misturar com PR4+.
// ============================================================================

import { searchRelevantMemory } from "./memory-read.js";
import {
  MEMORY_TYPES,
  MEMORY_CONFIDENCE,
} from "./memory-schema.js";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// Staleness threshold: 30 days without update (PR1 §6.2)
const STALENESS_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1000;

// Maximum items per block to prevent context overflow
const MAX_ITEMS_PER_BLOCK = 10;

// Memory types that map to each block
const _VALIDATED_LEARNING_TYPES = new Set([
  MEMORY_TYPES.CANONICAL_RULES,
  MEMORY_TYPES.APRENDIZADO_VALIDADO,
]);

const _CURRENT_CONTEXT_TYPES = new Set([
  MEMORY_TYPES.LIVE_CONTEXT,
  MEMORY_TYPES.CONVERSA_ATUAL,
  MEMORY_TYPES.MEMORIA_TEMPORARIA,
]);

const _MANUAL_SOURCES = new Set(["panel", "operador", "painel", "manual"]);

const _HISTORICAL_MEMORY_TYPES = new Set([
  MEMORY_TYPES.USER_PROFILE,
  MEMORY_TYPES.PROJECT,
  MEMORY_TYPES.OPERATIONAL_HISTORY,
  MEMORY_TYPES.MEMORIA_LONGA,
]);

// Confidence values considered low (PR1 §2.1 observado)
const _LOW_CONFIDENCE = new Set([
  MEMORY_CONFIDENCE.LOW,
  MEMORY_CONFIDENCE.UNVERIFIED,
]);

// ---------------------------------------------------------------------------
// _isStale(mem, now)
//
// A memory is stale if:
//   - updated_at is older than STALENESS_THRESHOLD_MS from now
//   - AND confidence is NOT confirmed/high (validated memories are never stale)
//   - AND is_canonical is false
//
// PR1 §6.2: memoria_longa with sugerido/observado is stale after 30 days
// without update.
// ---------------------------------------------------------------------------
function _isStale(mem, now) {
  if (mem.is_canonical === true) return false;
  if (mem.confidence === MEMORY_CONFIDENCE.CONFIRMED) return false;

  const updatedAt = mem.updated_at ? Date.parse(mem.updated_at) : 0;
  if (Number.isNaN(updatedAt) || updatedAt === 0) return true; // no valid date = stale

  return (now - updatedAt) > STALENESS_THRESHOLD_MS;
}

// ---------------------------------------------------------------------------
// _recencyScore(mem, now)
//
// Returns a numeric score where higher = more recent.
// Used for sorting within blocks. Range: 0..1 (capped).
//
// Score = 1.0 for memories updated right now, decaying towards 0 as age grows.
// Decay window: 90 days (memories older than 90 days all get ~0).
// ---------------------------------------------------------------------------
const _RECENCY_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function _recencyScore(mem, now) {
  const updatedAt = mem.updated_at ? Date.parse(mem.updated_at) : 0;
  if (Number.isNaN(updatedAt) || updatedAt === 0) return 0;
  const age = now - updatedAt;
  if (age <= 0) return 1;
  if (age >= _RECENCY_WINDOW_MS) return 0;
  return 1 - (age / _RECENCY_WINDOW_MS);
}

// ---------------------------------------------------------------------------
// _relevanceScore(mem)
//
// Basic deterministic relevance score.
// Higher = more relevant.
//
// Components:
//   - is_canonical: +3
//   - priority critical: +3, high: +2, medium: +1, low: +0
//   - confidence confirmed: +3, high: +2, medium: +1, low/unverified: +0
// ---------------------------------------------------------------------------
const _PRIORITY_SCORES = { critical: 3, high: 2, medium: 1, low: 0 };
const _CONFIDENCE_SCORES = { confirmed: 3, high: 2, medium: 1, low: 0, unverified: 0 };

function _relevanceScore(mem) {
  let score = 0;
  if (mem.is_canonical === true) score += 3;
  score += _PRIORITY_SCORES[mem.priority] ?? 1;
  score += _CONFIDENCE_SCORES[mem.confidence] ?? 1;
  return score;
}

// ---------------------------------------------------------------------------
// _combinedScore(mem, now)
//
// Combined ranking: 60% relevance (normalized to 0..1 from max 9) + 40% recency.
// Deterministic, simple, no ML.
// ---------------------------------------------------------------------------
function _combinedScore(mem, now) {
  const rel = _relevanceScore(mem) / 9; // normalize to 0..1
  const rec = _recencyScore(mem, now);
  return 0.6 * rel + 0.4 * rec;
}

// ---------------------------------------------------------------------------
// _classifyMemory(mem)
//
// Classifies a memory object into one of the 4 PR3 blocks.
// Returns: "validated_learning" | "manual_instructions" | "current_context" | "historical_memory"
// ---------------------------------------------------------------------------
function _classifyMemory(mem) {
  // 1. Validated learning: canonical rules + is_canonical, or aprendizado_validado type
  if (_VALIDATED_LEARNING_TYPES.has(mem.memory_type) && mem.is_canonical === true) {
    return "validated_learning";
  }
  if (mem.memory_type === MEMORY_TYPES.APRENDIZADO_VALIDADO) {
    return "validated_learning";
  }

  // 2. Manual instructions: source from panel/operador, or memoria_manual type
  if (mem.memory_type === MEMORY_TYPES.MEMORIA_MANUAL) {
    return "manual_instructions";
  }
  if (typeof mem.source === "string" && _MANUAL_SOURCES.has(mem.source.toLowerCase())) {
    return "manual_instructions";
  }

  // 3. Current context: live_context, conversa_atual, memoria_temporaria
  if (_CURRENT_CONTEXT_TYPES.has(mem.memory_type)) {
    return "current_context";
  }

  // 4. Everything else: historical memory
  return "historical_memory";
}

// ---------------------------------------------------------------------------
// _annotateMemory(mem, now)
//
// Adds PR3 retrieval annotations to a memory object (non-mutating).
// Annotations:
//   _pr3_block:          string — which block this memory belongs to
//   _pr3_stale:          boolean — whether this memory is stale
//   _pr3_recency:        number — recency score (0..1)
//   _pr3_relevance:      number — relevance score (0..9)
//   _pr3_combined:       number — combined ranking score
//   _pr3_is_reference:   boolean — true if memory should be treated as reference only
// ---------------------------------------------------------------------------
function _annotateMemory(mem, now) {
  const block = _classifyMemory(mem);
  const stale = _isStale(mem, now);
  const recency = _recencyScore(mem, now);
  const relevance = _relevanceScore(mem);
  const combined = _combinedScore(mem, now);

  // PR1 §3: stale historical memory = reference only, not authoritative
  const isReference = stale && block === "historical_memory";

  return {
    ...mem,
    _pr3_block:        block,
    _pr3_stale:        stale,
    _pr3_recency:      recency,
    _pr3_relevance:    relevance,
    _pr3_combined:     combined,
    _pr3_is_reference: isReference,
  };
}

// ---------------------------------------------------------------------------
// _sortByRanking(items)
//
// Sorts annotated memory items by combined score descending.
// Stable sort: ties broken by relevance, then recency.
// ---------------------------------------------------------------------------
function _sortByRanking(items) {
  return [...items].sort((a, b) => {
    const diff = b._pr3_combined - a._pr3_combined;
    if (Math.abs(diff) > 0.001) return diff;
    const relDiff = b._pr3_relevance - a._pr3_relevance;
    if (relDiff !== 0) return relDiff;
    return b._pr3_recency - a._pr3_recency;
  });
}

// ---------------------------------------------------------------------------
// buildRetrievalContext(context, env, options)
//
// Main PR3 entry point. Reads memory and returns a structured retrieval
// result with explicit separation into 4 blocks.
//
// Parameters:
//   context   {object} — optional context for scoping (project_id, entity_id)
//   env       {object} — Cloudflare worker env with ENAVIA_BRAIN
//   options   {object} — optional:
//     conversation_messages {array} — current conversation messages for conflict detection
//     now                  {number} — current timestamp ms (default: Date.now())
//
// Returns:
//   {
//     ok: true,
//     blocks: {
//       current_context:     { items: [], count: number },
//       historical_memory:   { items: [], count: number, stale_count: number, reference_only_count: number },
//       manual_instructions: { items: [], count: number },
//       validated_learning:  { items: [], count: number },
//     },
//     conflict_rules_applied: boolean,
//     staleness_detected:     boolean,
//     total_memories_read:    number,
//     pipeline_version:       string,
//   }
//   or { ok: false, error: string }
// ---------------------------------------------------------------------------
async function buildRetrievalContext(context, env, options) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }

  const opts = options && typeof options === "object" ? options : {};
  const now = typeof opts.now === "number" ? opts.now : Date.now();

  // Step 1: Read all relevant memories via PM3 (searchRelevantMemory)
  let readResult;
  try {
    readResult = await searchRelevantMemory(
      context && typeof context === "object" ? context : {},
      env
    );
  } catch (err) {
    return { ok: false, error: `memory read failed: ${err.message}` };
  }

  if (!readResult.ok) {
    return { ok: false, error: readResult.error || "memory read returned ok=false" };
  }

  const memories = readResult.results || [];

  // Step 2: Annotate each memory with PR3 classification and scores
  const annotated = memories.map((mem) => _annotateMemory(mem, now));

  // Step 3: Separate into 4 blocks
  const blocks = {
    current_context:     [],
    historical_memory:   [],
    manual_instructions: [],
    validated_learning:  [],
  };

  for (const mem of annotated) {
    const block = mem._pr3_block;
    if (blocks[block]) {
      blocks[block].push(mem);
    } else {
      blocks.historical_memory.push(mem); // fallback
    }
  }

  // Step 4: Sort each block by ranking (combined score desc)
  for (const key of Object.keys(blocks)) {
    blocks[key] = _sortByRanking(blocks[key]);
  }

  // Step 5: Apply conflict rules (PR1 §3 — Regra de Ouro)
  // If historical memory conflicts with current context, mark as reference only.
  // Conflict detection: if there is any current_context memory, all stale
  // historical memories are automatically downgraded to reference-only.
  const hasCurrentContext = blocks.current_context.length > 0;
  let conflictRulesApplied = false;

  if (hasCurrentContext) {
    for (let i = 0; i < blocks.historical_memory.length; i++) {
      const mem = blocks.historical_memory[i];
      if (mem._pr3_stale) {
        blocks.historical_memory[i] = {
          ...mem,
          _pr3_is_reference: true,
          _pr3_conflict_reason: mem._pr3_conflict_reason || "stale_with_active_context",
        };
        conflictRulesApplied = true;
      }
    }
  }

  // Step 6: Low-confidence historical memory in presence of current context
  // is always treated as reference (PR1 §2.1 / §4.3)
  if (hasCurrentContext) {
    for (let i = 0; i < blocks.historical_memory.length; i++) {
      const mem = blocks.historical_memory[i];
      if (_LOW_CONFIDENCE.has(mem.confidence)) {
        blocks.historical_memory[i] = {
          ...mem,
          _pr3_is_reference: true,
          _pr3_conflict_reason: mem._pr3_conflict_reason || "low_confidence_with_active_context",
        };
        conflictRulesApplied = true;
      }
    }
  }

  // Step 7: Cap items per block
  for (const key of Object.keys(blocks)) {
    if (blocks[key].length > MAX_ITEMS_PER_BLOCK) {
      blocks[key] = blocks[key].slice(0, MAX_ITEMS_PER_BLOCK);
    }
  }

  // Step 8: Compute stale/reference counts for historical block
  const staleCount = blocks.historical_memory.filter((m) => m._pr3_stale).length;
  const referenceOnlyCount = blocks.historical_memory.filter((m) => m._pr3_is_reference).length;
  const stalenessDetected = staleCount > 0;

  return {
    ok: true,
    blocks: {
      current_context: {
        items: blocks.current_context,
        count: blocks.current_context.length,
      },
      historical_memory: {
        items: blocks.historical_memory,
        count: blocks.historical_memory.length,
        stale_count: staleCount,
        reference_only_count: referenceOnlyCount,
      },
      manual_instructions: {
        items: blocks.manual_instructions,
        count: blocks.manual_instructions.length,
      },
      validated_learning: {
        items: blocks.validated_learning,
        count: blocks.validated_learning.length,
      },
    },
    conflict_rules_applied: conflictRulesApplied,
    staleness_detected:     stalenessDetected,
    total_memories_read:    memories.length,
    pipeline_version:       "PR3-v1",
  };
}

// ---------------------------------------------------------------------------
// buildRetrievalSummary(retrievalResult)
//
// Produces a compact summary of a buildRetrievalContext result, suitable
// for injection into plannerContext or LLM system prompt enrichment.
//
// Returns a plain object with counts, top items, and conflict status.
// ---------------------------------------------------------------------------
function buildRetrievalSummary(retrievalResult) {
  if (!retrievalResult || retrievalResult.ok !== true) {
    return {
      applied: false,
      error: retrievalResult?.error || "retrieval not available",
    };
  }

  const b = retrievalResult.blocks;

  const _summarizeItems = (items, limit) =>
    (items || []).slice(0, limit).map((m) => ({
      memory_id:     m.memory_id,
      title:         m.title,
      memory_type:   m.memory_type,
      is_canonical:  m.is_canonical,
      priority:      m.priority,
      is_reference:  m._pr3_is_reference || false,
      stale:         m._pr3_stale || false,
    }));

  return {
    applied: true,
    total_memories_read: retrievalResult.total_memories_read,
    conflict_rules_applied: retrievalResult.conflict_rules_applied,
    staleness_detected: retrievalResult.staleness_detected,
    pipeline_version: retrievalResult.pipeline_version,
    validated_learning: {
      count: b.validated_learning.count,
      items: _summarizeItems(b.validated_learning.items, 5),
    },
    manual_instructions: {
      count: b.manual_instructions.count,
      items: _summarizeItems(b.manual_instructions.items, 5),
    },
    current_context: {
      count: b.current_context.count,
      items: _summarizeItems(b.current_context.items, 5),
    },
    historical_memory: {
      count: b.historical_memory.count,
      stale_count: b.historical_memory.stale_count,
      reference_only_count: b.historical_memory.reference_only_count,
      items: _summarizeItems(b.historical_memory.items, 5),
    },
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  buildRetrievalContext,
  buildRetrievalSummary,
  STALENESS_THRESHOLD_MS,
  MAX_ITEMS_PER_BLOCK,
  // Internal helpers exported for testing
  _isStale,
  _recencyScore,
  _relevanceScore,
  _combinedScore,
  _classifyMemory,
  _annotateMemory,
  _sortByRanking,
};
