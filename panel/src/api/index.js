// ============================================================================
// ENAVIA Panel — api/index.js
// Public surface of the api/ layer. This is the ONLY file pages should import.
//
// Canonical import rule (P7–P10):
//   ✅ import { chatSend, fetchPlan, SHAPES, ENVELOPES } from "../api";
//   ❌ import { ... } from "../api/endpoints/plan";      // internal
//   ❌ import { ... } from "../api/transport";            // internal
//   ❌ import { ... } from "../api/mappers/plan";         // internal
//   ❌ import { apiClient } from "../api/client";         // internal — prohibited outside api/
//   ❌ import { ... } from "../api/contracts";            // internal — use SHAPES/ENVELOPES
// ============================================================================

// ── Config ──────────────────────────────────────────────────────────────────
export { getApiConfig } from "./config.js";
// ── Session ─────────────────────────────────────────────────────────────────
export { getSessionId, SESSION_STORAGE_KEY } from "./session.js";

// ── Errors ──────────────────────────────────────────────────────────────────
export { normalizeError, ERROR_CODES } from "./errors.js";

// ── Contracts — shape constants and envelope keys ────────────────────────────
export { SHAPES, ENVELOPES } from "./contracts.js";

// ── Public endpoints ────────────────────────────────────────────────────────
export { chatSend }                          from "./endpoints/chat.js";
export { fetchPlan,      PLAN_STATUS }       from "./endpoints/plan.js";
export { fetchExecution, postDecision, approveMerge, EXECUTION_STATUS }  from "./endpoints/execution.js";
export { fetchMemory,    MEMORY_STATES, MEMORY_FILTERS } from "./endpoints/memory.js";
export { listManualMemories, createManualMemory, updateManualMemory, blockManualMemory, invalidateManualMemory } from "./endpoints/manualMemory.js";
export { listLearningCandidates, createLearningCandidate, approveLearningCandidate, rejectLearningCandidate } from "./endpoints/learningCandidates.js";
export { sendBridge, fetchBridgeStatus }    from "./endpoints/bridge.js";
export { fetchHealth }                      from "./endpoints/health.js";
export { fetchBrowserSession, grantBrowserArmPermission, BROWSER_SESSION_STATUS, GRANTABLE_BLOCK_LEVELS } from "./endpoints/browserSession.js";

// ── Plan mapper — public surface for page-level snapshot translation ─────────
// Pages must import mapPlannerSnapshot from here, NOT from api/mappers/plan.js.
export { mapPlannerSnapshot } from "./mappers/plan.js";
