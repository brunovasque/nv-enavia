// ============================================================================
// ENAVIA Panel — Transport layer (internal)
// NOT exported from api/index.js — internal to the api/ layer only.
//
// MockTransport: intentionally imports existing mock fixtures as data source.
// This is correct and expected for this phase. Pages must never import mocks
// directly — that coupling lives here and here only.
//
// RealTransport: architectural placeholder. Not homologated. Activated only
// when VITE_API_BASE_URL is set + VITE_API_MODE=real.
// ============================================================================

import { getApiConfig } from "./config.js";
import { MOCK_PLANS } from "../plan/mockPlan.js";
import { MOCK_EXECUTIONS } from "../execution/mockExecution.js";
import { MOCK_MEMORY } from "../memory/mockMemory.js";

// ── Mock DB ──────────────────────────────────────────────────────────────────
// Centralises all fixture access in this single file.
const MOCK_DB = {
  plan:      MOCK_PLANS,
  execution: MOCK_EXECUTIONS,
  memory:    MOCK_MEMORY,
};

function mockDelay() {
  return 120 + Math.random() * 80;
}

// ── MockTransport ─────────────────────────────────────────────────────────────
const MockTransport = {
  request(path, opts = {}) {
    const t0 = Date.now();
    const { _resource, _mockState } = opts;

    return new Promise((resolve) => {
      setTimeout(() => {
        const data =
          _resource != null
            ? (MOCK_DB[_resource]?.[_mockState] ?? null)
            : null;
        resolve({ ok: true, data, durationMs: Date.now() - t0 });
      }, mockDelay());
    });
  },
};

// ── RealTransport ─────────────────────────────────────────────────────────────
const RealTransport = {
  request(_path, _opts = {}) {
    // Architectural stub — real HTTP not implemented in this phase.
    return Promise.reject(
      new Error("RealTransport: not implemented in this phase.")
    );
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────
export function getTransport() {
  const { mode } = getApiConfig();
  return mode === "real" ? RealTransport : MockTransport;
}
