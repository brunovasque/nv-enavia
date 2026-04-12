// ============================================================================
// ENAVIA Panel — API Contracts (P6)
// Central source of truth for ALL shapes flowing through panel/src/api/.
//
// Rules:
// - Endpoints MUST return shapes that match ResponseEnvelope or ErrorEnvelope.
// - Mappers MUST produce shapes that match their corresponding ViewPayload.
// - This file is the reference for drift detection in P7–P10.
// - Do NOT import this file in pages — import from "../api" (index.js).
// ============================================================================

// ── Envelope shapes ──────────────────────────────────────────────────────────

/**
 * RequestEnvelope — shape of every outgoing request to the transport layer.
 * @typedef {Object} RequestEnvelope
 * @property {string}            path      - Logical path (e.g. "/plan", "/chat/send")
 * @property {string}            [method]  - HTTP method for RealTransport (default: "GET")
 * @property {object}            [body]    - Request body for POST/PATCH requests
 * @property {Record<string,string>} [headers] - Additional headers merged with session header
 * @property {string}            [_resource]   - MockTransport resource key ("plan"|"execution"|"memory")
 * @property {string}            [_mockState]  - MockTransport state key (e.g. PLAN_STATUS.READY)
 */

/**
 * SuccessEnvelope — shape returned by every endpoint on success.
 * @typedef {Object} SuccessEnvelope
 * @property {true}   ok
 * @property {*}      data          - Typed payload (ChatResponse|PlanViewPayload|…)
 * @property {null}   [error]       - Always null on success
 * @property {{ durationMs: number }} meta
 */

/**
 * ErrorEnvelope — shape returned by every endpoint on failure.
 * Also the shape returned by normalizeError().
 * @typedef {Object} ErrorEnvelope
 * @property {false}  ok
 * @property {null}   data          - Always null on error
 * @property {{ code: string, message: string, module: string, retryable: boolean }} error
 * @property {{ durationMs: number }} meta
 */

/**
 * ResponseEnvelope — union of SuccessEnvelope and ErrorEnvelope.
 * Every endpoint public function returns this.
 * @typedef {SuccessEnvelope|ErrorEnvelope} ResponseEnvelope
 */

// ── Data payload shapes ───────────────────────────────────────────────────────

/**
 * ChatResponse — data payload inside SuccessEnvelope for chatSend().
 * @typedef {Object} ChatResponse
 * @property {"enavia"|"user"} role
 * @property {string}          content
 * @property {string}          timestamp  - ISO 8601
 * @property {string}          sessionId
 */

/**
 * PlanViewPayload — data payload inside SuccessEnvelope for fetchPlan().
 * @typedef {Object} PlanViewPayload
 * @property {object|null} plan       - Full plan object or null (EMPTY state)
 * @property {string}      fetchedAt  - ISO 8601 timestamp of the fetch
 */

/**
 * ExecutionViewPayload — data payload inside SuccessEnvelope for fetchExecution().
 * @typedef {Object} ExecutionViewPayload
 * @property {object|null} execution  - Full execution object or null (IDLE state)
 * @property {string}      fetchedAt  - ISO 8601 timestamp of the fetch
 */

/**
 * MemoryViewPayload — data payload inside SuccessEnvelope for fetchMemory().
 * @typedef {Object} MemoryViewPayload
 * @property {object|null} memory    - Full memory object
 * @property {string}      fetchedAt - ISO 8601 timestamp of the fetch
 */

// ── Runtime shape constants (importable) ──────────────────────────────────────

/**
 * ENVELOPES — canonical key names for envelope fields.
 * Use these when accessing envelope properties to avoid string drift.
 */
export const ENVELOPES = /** @type {const} */ ({
  OK:    "ok",
  DATA:  "data",
  ERROR: "error",
  META:  "meta",

  // Error sub-keys
  ERROR_CODE:      "code",
  ERROR_MESSAGE:   "message",
  ERROR_MODULE:    "module",
  ERROR_RETRYABLE: "retryable",

  // Meta sub-keys
  META_DURATION_MS: "durationMs",
});

/**
 * SHAPES — canonical field names for every view payload returned by an endpoint.
 * Prevents accidental key drift between mappers and page consumers.
 */
export const SHAPES = /** @type {const} */ ({
  // ── ChatResponse ──────────────────────────────────────────────────────────
  CHAT: {
    ROLE:       "role",
    CONTENT:    "content",
    TIMESTAMP:  "timestamp",
    SESSION_ID: "sessionId",
  },

  // ── PlanViewPayload ───────────────────────────────────────────────────────
  PLAN: {
    PLAN:       "plan",
    FETCHED_AT: "fetchedAt",
  },

  // ── ExecutionViewPayload ──────────────────────────────────────────────────
  EXECUTION: {
    EXECUTION:  "execution",
    FETCHED_AT: "fetchedAt",
  },

  // ── MemoryViewPayload ─────────────────────────────────────────────────────
  MEMORY: {
    MEMORY:     "memory",
    FETCHED_AT: "fetchedAt",
  },
});
