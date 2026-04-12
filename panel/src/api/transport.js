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
  async request(path, opts = {}) {
    const { baseUrl, timeoutMs } = getApiConfig();
    const { method = "GET", body, headers = {} } = opts;
    const t0 = Date.now();

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const fetchOpts = {
        method,
        headers: { "Content-Type": "application/json", ...headers },
        signal: controller.signal,
      };
      if (body !== undefined) {
        fetchOpts.body = JSON.stringify(body);
      }

      const res = await fetch(`${baseUrl}${path}`, fetchOpts);
      const data = await res.json();

      return { ok: res.ok, data, durationMs: Date.now() - t0 };
    } finally {
      clearTimeout(timer);
    }
  },
};

// ── Factory ───────────────────────────────────────────────────────────────────
export function getTransport() {
  const { mode } = getApiConfig();
  return mode === "real" ? RealTransport : MockTransport;
}
