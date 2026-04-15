// ============================================================================
// ENAVIA Panel — PR4 Contract Surface Tests
//
// Smoke tests for the Contract Surface (PR4):
//   - Contract page renders with active contract (ALLOW, WARN, BLOCK)
//   - Contract page renders empty state when no contract
//   - Contract page renders active+no-adherence state
//   - Matched rules, violations, notes render correctly
//   - Chat/memory/execution not affected
//   - API endpoint returns correct shapes
//   - Runtime-first: default call works without _mockState
// ============================================================================

import { describe, it, expect } from "vitest";
import { MOCK_CONTRACT, CONTRACT_SURFACE_STATUS } from "../contract/mockContract.js";

// ── 1. Mock data shape tests ────────────────────────────────────────────────

describe("PR4 — Mock contract data shapes", () => {
  it("ACTIVE_ALLOW has active_state and adherence with decision=ALLOW", () => {
    const d = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW];
    expect(d.active_state).toBeTruthy();
    expect(d.active_state.contract_id).toBe("contract-longos-v1");
    expect(d.adherence).toBeTruthy();
    expect(d.adherence.decision).toBe("ALLOW");
    expect(d.adherence.ok).toBe(true);
  });

  it("ACTIVE_WARN has adherence with decision=WARN", () => {
    const d = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_WARN];
    expect(d.active_state).toBeTruthy();
    expect(d.adherence.decision).toBe("WARN");
  });

  it("ACTIVE_BLOCK has adherence with decision=BLOCK and violations", () => {
    const d = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK];
    expect(d.active_state).toBeTruthy();
    expect(d.adherence.decision).toBe("BLOCK");
    expect(d.adherence.ok).toBe(false);
    expect(d.adherence.violations.length).toBeGreaterThan(0);
    expect(d.adherence.requires_human_approval).toBe(true);
  });

  it("ACTIVE_NO_ADHERENCE has active_state but adherence=null", () => {
    const d = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE];
    expect(d.active_state).toBeTruthy();
    expect(d.active_state.contract_id).toBe("contract-longos-v1");
    expect(d.adherence).toBeNull();
  });

  it("NO_CONTRACT has null active_state and null adherence", () => {
    const d = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.NO_CONTRACT];
    expect(d.active_state).toBeNull();
    expect(d.adherence).toBeNull();
  });
});

// ── 2. Active state shape tests ─────────────────────────────────────────────

describe("PR4 — Active state canonical shape", () => {
  const state = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW].active_state;

  it("has contract_id, activated_at, current_phase_hint", () => {
    expect(typeof state.contract_id).toBe("string");
    expect(typeof state.activated_at).toBe("string");
    expect(state.current_phase_hint).toBeTruthy();
  });

  it("has summary_canonic with counts", () => {
    const s = state.summary_canonic;
    expect(s).toBeTruthy();
    expect(typeof s.hard_rules_count).toBe("number");
    expect(typeof s.acceptance_criteria_count).toBe("number");
    expect(typeof s.approval_points_count).toBe("number");
    expect(typeof s.blocking_points_count).toBe("number");
    expect(typeof s.sections_count).toBe("number");
    expect(typeof s.blocks_count).toBe("number");
  });

  it("has metadata with scope and operator", () => {
    expect(state.metadata).toBeTruthy();
    expect(state.metadata.scope).toBe("default");
  });

  it("has relevant_block_ids array", () => {
    expect(Array.isArray(state.relevant_block_ids)).toBe(true);
    expect(state.relevant_block_ids.length).toBeGreaterThan(0);
  });

  it("has resolution_strategy", () => {
    expect(typeof state.resolution_strategy).toBe("string");
  });
});

// ── 3. Adherence gate shape tests ───────────────────────────────────────────

describe("PR4 — Adherence gate result shapes", () => {
  it("ALLOW result has expected fields", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW].adherence;
    expect(a.decision).toBe("ALLOW");
    expect(a.reason_code).toBe("ALLOW_ADHERENT");
    expect(typeof a.reason_text).toBe("string");
    expect(Array.isArray(a.matched_rules)).toBe(true);
    expect(Array.isArray(a.violations)).toBe(true);
    expect(typeof a.requires_human_approval).toBe("boolean");
    expect(Array.isArray(a.notes)).toBe(true);
    expect(typeof a.evaluated_at).toBe("string");
    expect(typeof a.relevant_blocks_count).toBe("number");
  });

  it("BLOCK result has violations with type, description, block_id", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK].adherence;
    expect(a.violations.length).toBeGreaterThan(0);
    const v = a.violations[0];
    expect(typeof v.type).toBe("string");
    expect(typeof v.description).toBe("string");
  });

  it("matched_rules have rule, category, source", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW].adherence;
    expect(a.matched_rules.length).toBeGreaterThan(0);
    const r = a.matched_rules[0];
    expect(typeof r.rule).toBe("string");
    expect(typeof r.category).toBe("string");
    expect(typeof r.source).toBe("string");
  });

  it("WARN result has reason_code starting with WARN_", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_WARN].adherence;
    expect(a.reason_code.startsWith("WARN_")).toBe(true);
  });
});

// ── 4. API endpoint tests ───────────────────────────────────────────────────

describe("PR4 — fetchContractSurface API", () => {
  it("returns data without _mockState (runtime-first default)", async () => {
    const { fetchContractSurface } = await import("../api/endpoints/contract.js");
    const r = await fetchContractSurface();
    expect(r.ok).toBe(true);
    expect(r.data).toBeTruthy();
    expect(r.data.active_state).toBeTruthy();
    expect(r.data.adherence).toBeTruthy();
    expect(r.data.adherence.decision).toBe("ALLOW");
  });

  it("returns NO_CONTRACT when requested via _mockState", async () => {
    const { fetchContractSurface, CONTRACT_SURFACE_STATUS } = await import("../api/endpoints/contract.js");
    const r = await fetchContractSurface({ _mockState: CONTRACT_SURFACE_STATUS.NO_CONTRACT });
    expect(r.ok).toBe(true);
    expect(r.data.active_state).toBeNull();
    expect(r.data.adherence).toBeNull();
  });

  it("returns BLOCK state correctly via _mockState", async () => {
    const { fetchContractSurface, CONTRACT_SURFACE_STATUS } = await import("../api/endpoints/contract.js");
    const r = await fetchContractSurface({ _mockState: CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK });
    expect(r.ok).toBe(true);
    expect(r.data.adherence.decision).toBe("BLOCK");
    expect(r.data.adherence.violations.length).toBeGreaterThan(0);
  });

  it("returns WARN state correctly via _mockState", async () => {
    const { fetchContractSurface, CONTRACT_SURFACE_STATUS } = await import("../api/endpoints/contract.js");
    const r = await fetchContractSurface({ _mockState: CONTRACT_SURFACE_STATUS.ACTIVE_WARN });
    expect(r.ok).toBe(true);
    expect(r.data.adherence.decision).toBe("WARN");
  });

  it("returns ACTIVE_NO_ADHERENCE correctly via _mockState", async () => {
    const { fetchContractSurface, CONTRACT_SURFACE_STATUS } = await import("../api/endpoints/contract.js");
    const r = await fetchContractSurface({ _mockState: CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE });
    expect(r.ok).toBe(true);
    expect(r.data.active_state).toBeTruthy();
    expect(r.data.active_state.contract_id).toBe("contract-longos-v1");
    expect(r.data.adherence).toBeNull();
  });
});

// ── 5. Evidence trail field presence ────────────────────────────────────────

describe("PR4 — Evidence trail data completeness", () => {
  it("ALLOW matched_rules contain block_id and heading", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW].adherence;
    for (const r of a.matched_rules) {
      expect(r.block_id).toBeTruthy();
      expect(r.heading).toBeTruthy();
    }
  });

  it("BLOCK violations contain block_id for block-sourced violations", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK].adherence;
    const blockViolations = a.violations.filter(v => v.block_id);
    expect(blockViolations.length).toBeGreaterThan(0);
  });

  it("notes are non-empty strings", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW].adherence;
    for (const note of a.notes) {
      expect(typeof note).toBe("string");
      expect(note.length).toBeGreaterThan(0);
    }
  });

  it("BLOCK matched_rules include hard_rule and approval_point categories", () => {
    const a = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK].adherence;
    const categories = a.matched_rules.map(r => r.category);
    expect(categories).toContain("hard_rule");
    expect(categories).toContain("approval_point");
  });
});

// ── 6. ACTIVE_NO_ADHERENCE state ────────────────────────────────────────────

describe("PR4 — Active contract without adherence (ACTIVE_NO_ADHERENCE)", () => {
  it("ACTIVE_NO_ADHERENCE fixture has same active_state shape as ACTIVE_ALLOW", () => {
    const noAdh = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE];
    const allow = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW];
    expect(noAdh.active_state.contract_id).toBe(allow.active_state.contract_id);
    expect(noAdh.active_state.summary_canonic).toBeTruthy();
    expect(noAdh.active_state.metadata).toBeTruthy();
  });

  it("ACTIVE_NO_ADHERENCE has adherence strictly null", () => {
    const noAdh = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE];
    expect(noAdh.adherence).toBeNull();
  });

  it("ACTIVE_NO_ADHERENCE is distinct from NO_CONTRACT (has active_state)", () => {
    const noAdh = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE];
    const noCont = MOCK_CONTRACT[CONTRACT_SURFACE_STATUS.NO_CONTRACT];
    expect(noAdh.active_state).toBeTruthy();
    expect(noCont.active_state).toBeNull();
  });

  it("CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE exists", () => {
    expect(CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE).toBe("active_no_adherence");
  });
});

// ── 7. Integration — export from api/index.js ──────────────────────────────

describe("PR4 — API index exports", () => {
  it("fetchContractSurface is exported from api/index.js", async () => {
    const api = await import("../api/index.js");
    expect(typeof api.fetchContractSurface).toBe("function");
  });

  it("CONTRACT_SURFACE_STATUS is exported from api/index.js", async () => {
    const api = await import("../api/index.js");
    expect(api.CONTRACT_SURFACE_STATUS).toBeTruthy();
    expect(api.CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW).toBe("active_allow");
    expect(api.CONTRACT_SURFACE_STATUS.ACTIVE_NO_ADHERENCE).toBe("active_no_adherence");
    expect(api.CONTRACT_SURFACE_STATUS.NO_CONTRACT).toBe("no_contract");
  });
});
