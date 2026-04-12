// ============================================================================
// ENAVIA Panel — Plan mapper (internal)
// Wraps raw plan fixture/API response into PlanViewPayload (see contracts.js
// SHAPES.PLAN).
//
// mapPlannerSnapshot(): converts raw backend planner payload (from POST
// /planner/run → response.planner) into the plan shape consumed by PlanPage
// cards. This is the ONLY place where backend→UI shape translation lives.
// Pages must NOT contain inline shape translation logic.
//
// Transparency contract:
//   - Fields that exist in the backend are mapped directly.
//   - Fields that do NOT exist in the backend are explicitly set to null or
//     to a declared constant. Every derivation is documented inline.
//   - The store holds the RAW backend payload. This mapper is called at
//     render time, never inside the store.
// ============================================================================

import { SHAPES } from "../contracts.js";

/**
 * @param {object|null} raw - raw plan object (may be null for EMPTY state)
 * @returns {import("../contracts.js").PlanViewPayload}
 */
export function mapPlanResponse(raw) {
  return {
    [SHAPES.PLAN.PLAN]:       raw ?? null,
    [SHAPES.PLAN.FETCHED_AT]: new Date().toISOString(),
  };
}

// ── Backend → UI translation maps ────────────────────────────────────────────

const _RISK_TO_PRIORITY = {
  alto:  "HIGH",
  médio: "MEDIUM",
  baixo: "LOW",
};

const _GATE_STATUS_MAP = {
  approval_required:     "pending",
  approved:              "approved",
  approved_not_required: "approved",
  rejected:              "blocked",
};

const _BRIDGE_STATUS_MAP = {
  ready_for_executor: "ready",
  blocked_by_gate:    "blocked",
};

const _MEMORY_PRIORITY_MAP = {
  high:   "HIGH",
  medium: "MEDIUM",
  low:    "LOW",
};

// ── mapPlannerSnapshot ───────────────────────────────────────────────────────

/**
 * Validates that a raw planner snapshot has the minimum structure required
 * for mapping. Used both at render-time and at rehydration.
 *
 * Minimum contract: non-null object with at least one of the canonical
 * sub-objects present (classification, canonicalPlan, gate, bridge,
 * memoryConsolidation, outputMode).
 *
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isValidPlannerSnapshot(raw) {
  if (typeof raw !== "object" || raw === null) return false;
  const r = /** @type {Record<string, unknown>} */ (raw);
  // At least one canonical sub-object must be a non-null object,
  // or outputMode must be a non-empty string (backend returns it as a string).
  return (
    (typeof r.classification === "object" && r.classification !== null) ||
    (typeof r.canonicalPlan === "object" && r.canonicalPlan !== null) ||
    (typeof r.gate === "object" && r.gate !== null) ||
    (typeof r.bridge === "object" && r.bridge !== null) ||
    (typeof r.memoryConsolidation === "object" && r.memoryConsolidation !== null) ||
    (typeof r.outputMode === "string" && r.outputMode.length > 0)
  );
}

/**
 * Converts raw backend planner payload (response.planner from POST /planner/run)
 * into the plan shape consumed by PlanPage cards.
 *
 * TRANSPARENCY:
 * - classification.confidence: backend does NOT return this → null.
 * - classification.tags: derived from backend signals[] if present.
 * - gate.approver, gate.timeout: backend does NOT return these → null.
 * - bridge.module: derived from executor_payload.source if present, else "enavia-executor".
 *
 * @param {object} raw - raw response.planner from backend (stored as-is in plannerStore)
 * @returns {object|null} - plan shape for cards, or null if raw is unusable
 */
export function mapPlannerSnapshot(raw) {
  if (!isValidPlannerSnapshot(raw)) return null;

  const c = raw.classification;
  const cp = raw.canonicalPlan;
  const g = raw.gate;
  const b = raw.bridge;
  const mc = raw.memoryConsolidation;
  const om = raw.outputMode;

  // ── Classification card shape ──────────────────────────────────────────
  const classification = c ? {
    intent:     (c.request_type ?? c.intent ?? "UNKNOWN").toUpperCase() || "UNKNOWN",
    domain:     c.category ?? c.domain ?? "",
    priority:   _RISK_TO_PRIORITY[c.risk_level] ?? c.priority ?? "MEDIUM",
    confidence: typeof c.confidence === "number" ? c.confidence : null,
    tags:       Array.isArray(c.signals) ? c.signals
                : (Array.isArray(c.tags) ? c.tags : []),
  } : null;

  // ── Canonical plan steps ───────────────────────────────────────────────
  let canonicalPlan = null;
  if (cp) {
    const rawSteps = Array.isArray(cp.steps) ? cp.steps : [];
    const steps = rawSteps.map((s, i) => {
      if (typeof s === "string") {
        // Backend returns steps as string[] — convert to card shape.
        return {
          id:          `s${i + 1}`,
          label:       s,
          description: null,
          status:      "pending",
          durationMs:  null,
          deps:        [],
        };
      }
      // Already object (mock shape or enriched shape) — pass through.
      return s;
    });
    canonicalPlan = { steps };
  }

  // ── Gate card shape ────────────────────────────────────────────────────
  const gate = g ? {
    required: typeof g.needs_human_approval === "boolean"
      ? g.needs_human_approval
      : (g.required ?? false),
    state:    _GATE_STATUS_MAP[g.gate_status] ?? g.state ?? "pending",
    approver: g.approver ?? null,
    timeout:  g.timeout ?? null,
    reason:   g.reason ?? null,
  } : null;

  // ── Bridge card shape ──────────────────────────────────────────────────
  const bridge = b ? {
    module:      b.executor_payload?.source ?? b.module ?? "enavia-executor",
    payload:     b.executor_action ?? b.payload ?? null,
    state:       _BRIDGE_STATUS_MAP[b.bridge_status] ?? b.state ?? "idle",
    description: b.reason ?? b.description ?? null,
  } : null;

  // ── Memory consolidation card shape ────────────────────────────────────
  let memoryConsolidation = null;
  if (mc) {
    const rawCandidates = Array.isArray(mc.memory_candidates)
      ? mc.memory_candidates
      : (Array.isArray(mc.candidates) ? mc.candidates : []);

    const candidates = rawCandidates.map((cand) => ({
      key:      cand.title ?? cand.key ?? "",
      value:    cand.content_structured?.objective ?? cand.value ?? "",
      tags:     Array.isArray(cand.tags) ? cand.tags : [],
      priority: _MEMORY_PRIORITY_MAP[cand.priority] ?? cand.priority ?? "MEDIUM",
    }));

    memoryConsolidation = { candidates };
  }

  // ── OutputMode card shape ──────────────────────────────────────────────
  let outputMode = null;
  if (typeof om === "string") {
    // Backend returns a single string — derive structured card shape.
    outputMode = {
      type:      "STRUCTURED",
      format:    om,
      channel:   "panel",
      streaming: false,
    };
  } else if (om && typeof om === "object") {
    // Already structured (mock shape) — pass through.
    outputMode = om;
  }

  return {
    id:                  raw.id ?? null,
    createdAt:           raw.createdAt ?? null,
    status:              raw.status ?? "ready",
    request:             raw.request ?? null,
    classification,
    outputMode,
    canonicalPlan,
    gate,
    bridge,
    memoryConsolidation,
  };
}
