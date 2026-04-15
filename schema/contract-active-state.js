// ============================================================================
// 📜 ENAVIA — Contract Active State (PR2)
//
// Responsabilidades:
//   1. Ativar contrato ingerido no runtime
//   2. Persistir estado contratual ativo canônico
//   3. Resolver blocos relevantes por contexto/fase/tarefa
//   4. Manter resumo vivo canônico do contrato ativo
//   5. Expor base utilizável para PR3
//
// Anchors para PRs futuras:
//   - PR3: motor de aderência contratual (contract_adherence)
//   - PR4: surface/rastreio no painel (contract_panel)
//
// NÃO faz (deliberadamente):
//   - Motor de aderência / gate contratual
//   - Surface / painel
//   - Cognição / IA — apenas heurística determinística
// ============================================================================

import {
  readContractIngestion,
  KV_PREFIX_INGESTION,
  KV_INGESTION_REGISTRY,
} from "./contract-ingestion.js";

// ---------------------------------------------------------------------------
// KV Key Constants — Canonical prefixes for active contract state
// ---------------------------------------------------------------------------
const KV_PREFIX_ACTIVE_STATE = "contract_active_state:";
// Scoped current key: contract_active_state:current:<scope>
// Default scope is "default". Callers can pass a scope to isolate
// parallel contexts/executions without ambiguity.
const KV_ACTIVE_CURRENT_PREFIX = "contract_active_state:current:";
const KV_DEFAULT_SCOPE = "default";
// Resolution context subartefact suffix — persisted separately from
// the main active state so block resolution never overwrites the core state.
const KV_SUFFIX_RESOLUTION_CTX = ":resolution_ctx";

// Kept for backward-compat re-export (tests may reference it).
// New code should use KV_ACTIVE_CURRENT_PREFIX + scope.
const KV_ACTIVE_CONTRACT_KEY = `${KV_ACTIVE_CURRENT_PREFIX}${KV_DEFAULT_SCOPE}`;

// ---------------------------------------------------------------------------
// buildCanonicalSummary(structure, blocks)
//
// Builds a live canonical summary from real ingestion data.
// Only includes fields that are actually present — never invents.
//
// Returns: {
//   macro_objective: string | null,
//   detected_phases: Array | null,
//   hard_rules_count: number,
//   hard_rules_top: Array<string> (max 5),
//   acceptance_criteria_count: number,
//   acceptance_criteria_top: Array<string> (max 5),
//   approval_points_count: number,
//   approval_points_top: Array<string> (max 5),
//   blocking_points_count: number,
//   blocking_points_top: Array<string> (max 5),
//   deadlines_count: number,
//   deadlines_top: Array<string> (max 5),
//   sections_count: number,
//   blocks_count: number,
//   confidence: object
// }
// ---------------------------------------------------------------------------
function buildCanonicalSummary(structure, blocks) {
  if (!structure) {
    return _emptySummary();
  }

  const topN = (arr, n = 5) => {
    if (!arr || arr.length === 0) return [];
    return arr.slice(0, n).map((item) =>
      typeof item === "string" ? item : item.signal || String(item)
    );
  };

  return {
    macro_objective: structure.macro_objective || null,
    detected_phases: structure.detected_phases || null,
    hard_rules_count: (structure.hard_rules || []).length,
    hard_rules_top: topN(structure.hard_rules),
    acceptance_criteria_count: (structure.acceptance_criteria || []).length,
    acceptance_criteria_top: topN(structure.acceptance_criteria),
    approval_points_count: (structure.approval_points || []).length,
    approval_points_top: topN(structure.approval_points),
    blocking_points_count: (structure.blocking_points || []).length,
    blocking_points_top: topN(structure.blocking_points),
    deadlines_count: (structure.deadlines || []).length,
    deadlines_top: topN(structure.deadlines),
    sections_count: (structure.sections || []).length,
    blocks_count: (blocks || []).length,
    confidence: structure.confidence || null,
  };
}

function _emptySummary() {
  return {
    macro_objective: null,
    detected_phases: null,
    hard_rules_count: 0,
    hard_rules_top: [],
    acceptance_criteria_count: 0,
    acceptance_criteria_top: [],
    approval_points_count: 0,
    approval_points_top: [],
    blocking_points_count: 0,
    blocking_points_top: [],
    deadlines_count: 0,
    deadlines_top: [],
    sections_count: 0,
    blocks_count: 0,
    confidence: null,
  };
}

// ---------------------------------------------------------------------------
// activateIngestedContract(env, contractId, opts)
//
// Activates an ingested contract in the runtime.
// Only activates contracts that were previously ingested (PR1).
// Fails safely if the contract does not exist.
//
// Parameters:
//   env        — Cloudflare Workers env (must have ENAVIA_BRAIN KV binding)
//   contractId — Contract ID to activate
//   opts       — Optional { phase_hint, task_id, operator, scope }
//                scope defaults to "default"; use to isolate parallel contexts
//
// Returns: {
//   ok: boolean,
//   contract_id?: string,
//   active_state?: object,
//   error?: string,
//   message?: string
// }
// ---------------------------------------------------------------------------
async function activateIngestedContract(env, contractId, opts) {
  // Validate inputs
  if (!contractId || typeof contractId !== "string") {
    return { ok: false, error: "INVALID_CONTRACT_ID", message: "contractId must be a non-empty string." };
  }
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "MISSING_KV_BINDING", message: "env.ENAVIA_BRAIN is required." };
  }

  // Read ingested artifacts — only activate if ingestion exists
  const ingestion = await readContractIngestion(env, contractId);
  if (!ingestion) {
    return {
      ok: false,
      error: "CONTRACT_NOT_INGESTED",
      message: `Contract '${contractId}' has not been ingested. Ingest first via PR1 before activating.`,
    };
  }

  const options = opts || {};
  const scope = options.scope || KV_DEFAULT_SCOPE;
  const now = new Date().toISOString();

  // Build canonical summary from real data
  const summary = buildCanonicalSummary(ingestion.structure, ingestion.blocks);

  // Build active state artifact (core — no resolution context here)
  const activeState = {
    contract_id: contractId,
    activated_at: now,
    current_phase_hint: options.phase_hint || null,
    last_task_id: options.task_id || null,
    summary_canonic: summary,
    metadata: {
      operator: options.operator || null,
      ingested_at: ingestion.index.ingested_at || null,
      blocks_count: ingestion.index.blocks_count || 0,
      activation_source: "activateIngestedContract",
      scope,
    },
    version: "v1",
  };

  // Persist active state (core)
  const stateKey = `${KV_PREFIX_ACTIVE_STATE}${contractId}`;
  await env.ENAVIA_BRAIN.put(stateKey, JSON.stringify(activeState));

  // Set as current active contract — scoped by scope
  const currentKey = `${KV_ACTIVE_CURRENT_PREFIX}${scope}`;
  await env.ENAVIA_BRAIN.put(currentKey, JSON.stringify({
    contract_id: contractId,
    activated_at: now,
    scope,
  }));

  return {
    ok: true,
    contract_id: contractId,
    active_state: activeState,
  };
}

// ---------------------------------------------------------------------------
// readActiveContractState(env, contractId, opts)
//
// Reads the persisted active state for a contract.
// If contractId is omitted, reads the current active contract for the given scope.
// Merges the resolution context subartefact into the returned state for convenience.
//
// Parameters:
//   opts — Optional { scope } (default: "default")
//
// Returns: active state object (with resolution_ctx merged) or null if none exists.
// ---------------------------------------------------------------------------
async function readActiveContractState(env, contractId, opts) {
  if (!env || !env.ENAVIA_BRAIN) return null;

  let targetId = contractId;
  const scope = (opts && opts.scope) || KV_DEFAULT_SCOPE;

  // If no contractId specified, read current active contract for this scope
  if (!targetId) {
    const currentKey = `${KV_ACTIVE_CURRENT_PREFIX}${scope}`;
    const currentRaw = await env.ENAVIA_BRAIN.get(currentKey);
    if (!currentRaw) return null;
    try {
      const current = JSON.parse(currentRaw);
      targetId = current.contract_id;
    } catch (e) {
      console.error("[contract-active-state] Failed to parse active contract key:", e.message);
      return null;
    }
  }

  if (!targetId) return null;

  const stateKey = `${KV_PREFIX_ACTIVE_STATE}${targetId}`;
  const raw = await env.ENAVIA_BRAIN.get(stateKey);
  if (!raw) return null;

  let state;
  try {
    state = JSON.parse(raw);
  } catch (e) {
    console.error("[contract-active-state] Failed to parse state for", targetId, ":", e.message);
    return null;
  }

  // Merge resolution context subartefact (if exists) for convenience
  const resCtxKey = `${stateKey}${KV_SUFFIX_RESOLUTION_CTX}`;
  const resCtxRaw = await env.ENAVIA_BRAIN.get(resCtxKey);
  if (resCtxRaw) {
    try {
      const resCtx = JSON.parse(resCtxRaw);
      state.relevant_block_ids = resCtx.relevant_block_ids || [];
      state.current_phase_hint = resCtx.current_phase_hint ?? state.current_phase_hint;
      state.last_task_id = resCtx.last_task_id ?? state.last_task_id;
      state.last_resolution_at = resCtx.resolved_at || null;
      state.resolution_strategy = resCtx.strategy || null;
    } catch (e) {
      console.error("[contract-active-state] Failed to parse resolution context for", targetId, ":", e.message);
    }
  } else {
    // No resolution yet — provide safe defaults
    state.relevant_block_ids = state.relevant_block_ids || [];
  }

  return state;
}

// ---------------------------------------------------------------------------
// Phase keyword mapping — used to match blocks by heading/content when
// block_type is generic (e.g., "clause" instead of "payment").
// ---------------------------------------------------------------------------
const PHASE_KEYWORDS = {
  scope: ["objeto", "escopo", "scope", "purpose"],
  obligation: ["obriga", "obligation", "dever"],
  payment: ["pagamento", "payment", "parcela", "remunera", "preço", "price"],
  deadline: ["prazo", "deadline", "vigência", "duração", "term"],
  acceptance: ["aceite", "acceptance", "critério", "criteria", "pronto", "done"],
  termination: ["rescisão", "terminação", "termination"],
  penalty: ["multa", "penalidade", "penalty", "sanção"],
  confidentiality: ["confidencial", "confidentiality", "sigilo"],
  general: ["disposições gerais", "general provisions"],
  parties: ["partes", "parties", "contratante", "contratado"],
};

// Maps block type / phase to signal category
const TYPE_TO_SIGNAL = {
  obligation: "hard_rules",
  penalty: "hard_rules",
  acceptance: "acceptance_criteria",
  deadline: "deadlines",
  termination: "blocking_points",
};

// ---------------------------------------------------------------------------
// resolveRelevantContractBlocks(env, contractId, context)
//
// Resolves relevant contract blocks based on context signals.
// Uses deterministic heuristics only — no AI/cognition.
//
// Parameters:
//   env        — Cloudflare Workers env
//   contractId — Contract ID
//   context    — { phase, taskId, intent, block_types, limit }
//
// Strategy:
//   1. If phase is provided → match blocks by block_type or heading keywords
//   2. If intent is provided → match blocks by heading/content keyword overlap
//   3. If block_types is provided → filter by block_type directly
//   4. Always include blocks with hard_rules signals (safety net)
//   5. If no signal matches → return fallback with all block_ids (honest)
//
// Returns: {
//   ok: boolean,
//   contract_id: string,
//   blocks: Array<block>,
//   strategy: string,
//   fallback: boolean,
//   error?: string
// }
// ---------------------------------------------------------------------------
async function resolveRelevantContractBlocks(env, contractId, context) {
  if (!contractId || typeof contractId !== "string") {
    return { ok: false, error: "INVALID_CONTRACT_ID", message: "contractId is required.", blocks: [], strategy: "none", fallback: false };
  }
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "MISSING_KV_BINDING", message: "env.ENAVIA_BRAIN is required.", blocks: [], strategy: "none", fallback: false };
  }

  // Read ingested blocks
  const ingestion = await readContractIngestion(env, contractId);
  if (!ingestion || !ingestion.blocks || ingestion.blocks.length === 0) {
    return {
      ok: false,
      error: "CONTRACT_NOT_INGESTED",
      message: `Contract '${contractId}' not found or has no blocks.`,
      blocks: [],
      strategy: "none",
      fallback: false,
    };
  }

  const ctx = context || {};
  const allBlocks = ingestion.blocks;
  const limit = ctx.limit || 10;
  let matched = [];
  let strategy = "none";

  // Strategy 1: Filter by explicit block_types
  // Matches both block_type AND content signals (since PR1 may classify
  // headings as "clause" even when content is about payment/penalty/etc.)
  if (ctx.block_types && Array.isArray(ctx.block_types) && ctx.block_types.length > 0) {
    const typeSet = new Set(ctx.block_types.map((t) => t.toLowerCase()));
    // Pre-compile regexes for each type
    const typeRegexes = [...typeSet].map((t) => new RegExp(escapeRegex(t), "i"));
    matched = allBlocks.filter((b) => {
      if (typeSet.has(b.block_type)) return true;
      // Also match by content signals and heading keywords
      for (let i = 0; i < typeRegexes.length; i++) {
        const rx = typeRegexes[i];
        if ((b.heading && rx.test(b.heading)) || rx.test(b.content.slice(0, 500))) return true;
        // Check block signals for the type
        const t = [...typeSet][i];
        if (b.signals) {
          const signalKey = TYPE_TO_SIGNAL[t];
          if (signalKey && b.signals[signalKey] && b.signals[signalKey].length > 0) return true;
        }
      }
      return false;
    });
    if (matched.length > 0) strategy = "block_types";
  }

  // Strategy 2: Match by phase (maps to block_type + heading + content signals)
  if (matched.length === 0 && ctx.phase) {
    const phaseKey = ctx.phase.toLowerCase();
    const phaseKeywords = PHASE_KEYWORDS[phaseKey] || [phaseKey];
    // Pre-compile regexes for phase keywords
    const phaseRegexes = phaseKeywords.map((kw) => new RegExp(escapeRegex(kw), "i"));

    matched = allBlocks.filter((b) => {
      // Match by block_type
      if (b.block_type === phaseKey) return true;
      // Match by heading or content keywords
      for (const rx of phaseRegexes) {
        if ((b.heading && rx.test(b.heading)) || rx.test(b.content.slice(0, 500))) return true;
      }
      // Match by signals
      if (b.signals) {
        const signalKey = TYPE_TO_SIGNAL[phaseKey];
        if (signalKey && b.signals[signalKey] && b.signals[signalKey].length > 0) return true;
      }
      return false;
    });
    if (matched.length > 0) strategy = "phase";
  }

  // Strategy 3: Match by intent keywords
  if (matched.length === 0 && ctx.intent) {
    const keywords = ctx.intent
      .toLowerCase()
      .split(/\s+/)
      .filter((w) => w.length > 3);

    if (keywords.length > 0) {
      const scored = allBlocks.map((block) => {
        const text = ((block.heading || "") + " " + block.content.slice(0, 500)).toLowerCase();
        let score = 0;
        for (const kw of keywords) {
          if (text.includes(kw)) score++;
        }
        return { block, score };
      });
      const filtered = scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
      matched = filtered.map((s) => s.block);
      if (matched.length > 0) strategy = "intent";
    }
  }

  // Strategy 4: Match by taskId (look for task references in block content)
  if (matched.length === 0 && ctx.taskId) {
    const taskRx = new RegExp(escapeRegex(String(ctx.taskId)), "i");
    matched = allBlocks.filter(
      (b) => (b.heading && taskRx.test(b.heading)) || taskRx.test(b.content.slice(0, 1000))
    );
    if (matched.length > 0) strategy = "taskId";
  }

  // Safety net: always include blocks with hard_rules or blocking_points signals
  const safetyBlocks = allBlocks.filter(
    (b) =>
      b.signals &&
      ((b.signals.hard_rules && b.signals.hard_rules.length > 0) ||
        (b.signals.blocking_points && b.signals.blocking_points.length > 0))
  );

  // Merge safety blocks into matched (deduplicate by block_id)
  if (safetyBlocks.length > 0 && matched.length > 0) {
    const existingIds = new Set(matched.map((b) => b.block_id));
    for (const sb of safetyBlocks) {
      if (!existingIds.has(sb.block_id)) {
        matched.push(sb);
        existingIds.add(sb.block_id);
      }
    }
  }

  // Fallback: no signal matched — return first N blocks honestly
  let fallback = false;
  if (matched.length === 0) {
    matched = allBlocks.slice(0, limit);
    strategy = "fallback";
    fallback = true;
  }

  // Apply limit
  const result = matched.slice(0, limit);

  // Persist resolution context as a separate subartefact (never overwrites core state)
  try {
    const resCtxKey = `${KV_PREFIX_ACTIVE_STATE}${contractId}${KV_SUFFIX_RESOLUTION_CTX}`;
    const resolutionCtx = {
      contract_id: contractId,
      relevant_block_ids: result.map((b) => b.block_id),
      current_phase_hint: ctx.phase || null,
      last_task_id: ctx.taskId || null,
      strategy,
      fallback,
      matched_count: result.length,
      total_blocks: allBlocks.length,
      resolved_at: new Date().toISOString(),
    };
    await env.ENAVIA_BRAIN.put(resCtxKey, JSON.stringify(resolutionCtx));
  } catch (e) {
    // Non-blocking — resolution context persistence failure does not break resolution
    console.error("[contract-active-state] Non-blocking resolution context persist failed:", e.message);
  }

  return {
    ok: true,
    contract_id: contractId,
    blocks: result,
    total_blocks: allBlocks.length,
    matched_count: result.length,
    strategy,
    fallback,
  };
}

// ---------------------------------------------------------------------------
// refreshCanonicalSummary(env, contractId)
//
// Re-generates and persists the canonical summary for an active contract.
// Useful when ingestion data has been updated or to ensure consistency.
//
// Returns: { ok, summary } or { ok: false, error }
// ---------------------------------------------------------------------------
async function refreshCanonicalSummary(env, contractId) {
  if (!contractId || typeof contractId !== "string") {
    return { ok: false, error: "INVALID_CONTRACT_ID" };
  }
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "MISSING_KV_BINDING" };
  }

  const ingestion = await readContractIngestion(env, contractId);
  if (!ingestion) {
    return { ok: false, error: "CONTRACT_NOT_INGESTED" };
  }

  const summary = buildCanonicalSummary(ingestion.structure, ingestion.blocks);

  // Update the active state with refreshed summary
  const stateKey = `${KV_PREFIX_ACTIVE_STATE}${contractId}`;
  const raw = await env.ENAVIA_BRAIN.get(stateKey);
  if (raw) {
    try {
      const state = JSON.parse(raw);
      state.summary_canonic = summary;
      state.summary_refreshed_at = new Date().toISOString();
      await env.ENAVIA_BRAIN.put(stateKey, JSON.stringify(state));
    } catch (e) {
      console.error("[contract-active-state] Failed to update state during summary refresh:", e.message);
    }
  }

  return { ok: true, contract_id: contractId, summary };
}

// ---------------------------------------------------------------------------
// getActiveContractContext(env, opts)
//
// Runtime-friendly function: returns everything PR3 needs in one call.
// Combines active state + canonical summary + resolution context.
//
// Parameters:
//   opts — Optional { scope } (default: "default")
//
// Returns: {
//   ok: boolean,
//   contract_id: string | null,
//   active_state: object | null,
//   summary: object | null,
//   resolution_ctx: object | null,
//   ready_for_pr3: boolean
// }
// ---------------------------------------------------------------------------
async function getActiveContractContext(env, opts) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, contract_id: null, active_state: null, summary: null, resolution_ctx: null, ready_for_pr3: false };
  }

  const scope = (opts && opts.scope) || KV_DEFAULT_SCOPE;
  const state = await readActiveContractState(env, null, { scope });
  if (!state) {
    return { ok: true, contract_id: null, active_state: null, summary: null, resolution_ctx: null, ready_for_pr3: false };
  }

  // Read resolution context subartefact
  let resCtx = null;
  try {
    const resCtxKey = `${KV_PREFIX_ACTIVE_STATE}${state.contract_id}${KV_SUFFIX_RESOLUTION_CTX}`;
    const resCtxRaw = await env.ENAVIA_BRAIN.get(resCtxKey);
    if (resCtxRaw) resCtx = JSON.parse(resCtxRaw);
  } catch (_) {
    // resolution context not available — that's ok
  }

  return {
    ok: true,
    contract_id: state.contract_id,
    active_state: state,
    summary: state.summary_canonic || null,
    resolution_ctx: resCtx,
    ready_for_pr3: true,
  };
}

// ---------------------------------------------------------------------------
// Helper: escape string for use in RegExp
// ---------------------------------------------------------------------------
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core activation
  activateIngestedContract,
  readActiveContractState,

  // Block resolution
  resolveRelevantContractBlocks,

  // Canonical summary
  buildCanonicalSummary,
  refreshCanonicalSummary,

  // Runtime context (PR3 anchor)
  getActiveContractContext,

  // KV Constants (exported for testing / future PRs)
  KV_PREFIX_ACTIVE_STATE,
  KV_ACTIVE_CONTRACT_KEY,
  KV_ACTIVE_CURRENT_PREFIX,
  KV_DEFAULT_SCOPE,
  KV_SUFFIX_RESOLUTION_CTX,
};
