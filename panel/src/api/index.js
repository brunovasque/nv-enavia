// ============================================================================
// ENAVIA Panel — api/index.js
// Public surface of the api/ layer. This is the ONLY file pages should import.
//
// Canonical import rule (P7–P10):
//   ✅ import { chatSend, fetchPlan, normalizeError } from "../api";
//   ❌ import { ... } from "../api/endpoints/plan";   // internal
//   ❌ import { ... } from "../api/transport";         // internal
//   ❌ import { ... } from "../api/mappers/plan";      // internal
//   ❌ import { apiClient } from "../api/client";      // internal – use endpoints
//
// apiClient IS exported for transparency/debugging, but its direct use by
// pages and features is prohibited. Architectural boundary: api/ layer only.
// ============================================================================

// ── Config ──────────────────────────────────────────────────────────────────
export { getApiConfig } from "./config.js";

// ── Session ─────────────────────────────────────────────────────────────────
export { getSessionId, SESSION_STORAGE_KEY } from "./session.js";

// ── Errors ──────────────────────────────────────────────────────────────────
export { normalizeError, ERROR_CODES } from "./errors.js";

// ── Client — internal, exported for transparency only ───────────────────────
export { apiClient } from "./client.js";

// ── Public endpoints ────────────────────────────────────────────────────────
export { chatSend }                     from "./endpoints/chat.js";
export { fetchPlan,      PLAN_STATUS }  from "./endpoints/plan.js";
export { fetchExecution, EXECUTION_STATUS } from "./endpoints/execution.js";
export { fetchMemory,    MEMORY_STATES, MEMORY_FILTERS } from "./endpoints/memory.js";
