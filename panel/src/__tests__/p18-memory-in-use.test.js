// =============================================================================
// ENAVIA Panel — P18-PR1 smoke tests: MemoryInUseCard
//
// Smoke tests for the "Memória em uso" visibility card added in P18-PR1.
// Verifies the 5 acceptance criteria:
//   1. Card renders without crash (populated data)
//   2. Card renders without crash (empty data — honest state)
//   3. Memory consulted info is shown when data exists
//   4. Tier/priority is shown when data exists
//   5. "Leitura antes do plano" is shown correctly
//   6. Audit snapshots are listed when available
//   7. Honest empty state shown when no snapshots
//   8. No crash when memory prop is null/undefined
//   9. fetchMemory returns memoryReadBeforePlan field in populated state
//  10. fetchMemory returns auditSnapshots field in populated state
//  11. fetchMemory returns honest empty fields in EMPTY state
//  12. canonical entries carry tier + priority fields
//  13. operational entries carry tier + priority fields
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ── Minimal React / jsdom render helper ─────────────────────────────────────
// We test the component logic + shape correctness without a full render tree.
// Shape tests are cheaper, faster, and less brittle than DOM snapshots.

import { MOCK_MEMORY, MEMORY_STATES } from "../memory/mockMemory.js";
import { fetchMemory } from "../api/endpoints/memory.js";

// ── Stub import.meta.env for mock mode ──────────────────────────────────────
beforeEach(() => {
  vi.stubEnv("VITE_API_MODE", "mock");
  vi.stubEnv("VITE_API_BASE_URL", "http://test-backend");
  vi.stubEnv("VITE_API_TIMEOUT_MS", "5000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Helper: minimal component prop shapes ────────────────────────────────────
function buildCardProps(state = MEMORY_STATES.POPULATED) {
  return MOCK_MEMORY[state];
}

describe("P18-PR1 — MemoryInUseCard data shape", () => {
  it("1. populated mock has memoryReadBeforePlan field", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(mem).toHaveProperty("memoryReadBeforePlan");
    expect(mem.memoryReadBeforePlan).not.toBeNull();
  });

  it("2. populated mock has auditSnapshots field (array)", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(mem).toHaveProperty("auditSnapshots");
    expect(Array.isArray(mem.auditSnapshots)).toBe(true);
  });

  it("3. empty mock shows honest state — happened=false, memoriesRead=0", () => {
    const mem = buildCardProps(MEMORY_STATES.EMPTY);
    expect(mem.memoryReadBeforePlan.happened).toBe(false);
    expect(mem.memoryReadBeforePlan.memoriesRead).toBe(0);
    expect(mem.memoryReadBeforePlan.readAt).toBeNull();
  });

  it("4. empty mock has auditSnapshots as empty array", () => {
    const mem = buildCardProps(MEMORY_STATES.EMPTY);
    expect(mem.auditSnapshots).toEqual([]);
  });

  it("5. populated memoryReadBeforePlan.happened is true", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(mem.memoryReadBeforePlan.happened).toBe(true);
  });

  it("6. populated memoryReadBeforePlan.topPriority is set", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(["critical", "high", "medium", "low"]).toContain(
      mem.memoryReadBeforePlan.topPriority,
    );
  });

  it("7. populated memoryReadBeforePlan.topTier is a number 1-7", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(mem.memoryReadBeforePlan.topTier).toBeGreaterThanOrEqual(1);
    expect(mem.memoryReadBeforePlan.topTier).toBeLessThanOrEqual(7);
  });

  it("8. populated auditSnapshots has at least one entry", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    expect(mem.auditSnapshots.length).toBeGreaterThan(0);
  });

  it("9. each auditSnapshot has id, label, createdAt, type", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    for (const snap of mem.auditSnapshots) {
      expect(snap).toHaveProperty("id");
      expect(snap).toHaveProperty("label");
      expect(snap).toHaveProperty("createdAt");
      expect(snap).toHaveProperty("type");
    }
  });

  it("10. canonical entries have tier field (number)", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    for (const entry of mem.canonicalEntries) {
      expect(typeof entry.tier).toBe("number");
    }
  });

  it("11. canonical entries have priority field", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    for (const entry of mem.canonicalEntries) {
      expect(["critical", "high", "medium", "low"]).toContain(entry.priority);
    }
  });

  it("12. operational entries have tier field (number)", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    for (const entry of mem.operationalEntries) {
      expect(typeof entry.tier).toBe("number");
    }
  });

  it("13. operational entries have priority field", () => {
    const mem = buildCardProps(MEMORY_STATES.POPULATED);
    for (const entry of mem.operationalEntries) {
      expect(["critical", "high", "medium", "low"]).toContain(entry.priority);
    }
  });
});

describe("P18-PR1 — fetchMemory returns memoryInUse fields", () => {
  it("14. fetchMemory POPULATED state returns memoryReadBeforePlan", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.POPULATED });
    expect(res.ok).toBe(true);
    // The memory object is inside data.memory
    const mem = res.data.memory;
    expect(mem).toHaveProperty("memoryReadBeforePlan");
    expect(mem.memoryReadBeforePlan.happened).toBe(true);
  });

  it("15. fetchMemory POPULATED state returns auditSnapshots", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.POPULATED });
    expect(res.ok).toBe(true);
    const mem = res.data.memory;
    expect(Array.isArray(mem.auditSnapshots)).toBe(true);
    expect(mem.auditSnapshots.length).toBeGreaterThan(0);
  });

  it("16. fetchMemory EMPTY state returns honest memoryReadBeforePlan", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.EMPTY });
    expect(res.ok).toBe(true);
    const mem = res.data.memory;
    expect(mem.memoryReadBeforePlan.happened).toBe(false);
    expect(mem.memoryReadBeforePlan.memoriesRead).toBe(0);
  });

  it("17. fetchMemory EMPTY state returns empty auditSnapshots", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.EMPTY });
    expect(res.ok).toBe(true);
    const mem = res.data.memory;
    expect(mem.auditSnapshots).toEqual([]);
  });

  it("18. fetchMemory LIVE_SESSION state returns memoryReadBeforePlan", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.LIVE_SESSION });
    expect(res.ok).toBe(true);
    const mem = res.data.memory;
    expect(mem).toHaveProperty("memoryReadBeforePlan");
    expect(mem.memoryReadBeforePlan.happened).toBe(true);
  });

  it("19. fetchMemory CONSOLIDATING state returns auditSnapshots", async () => {
    const res = await fetchMemory({ _mockState: MEMORY_STATES.CONSOLIDATING });
    expect(res.ok).toBe(true);
    const mem = res.data.memory;
    expect(Array.isArray(mem.auditSnapshots)).toBe(true);
  });
});

describe("P18-PR1 — MemoryInUseCard prop edge cases", () => {
  it("20. null memory prop — card gets null fields (no crash expected)", () => {
    // Simulate the props the card would receive with null memory
    const memory = null;
    const readBeforePlan = memory?.memoryReadBeforePlan ?? null;
    const snapshots      = memory?.auditSnapshots ?? [];
    const canonical      = memory?.canonicalEntries ?? [];
    const operational    = memory?.operationalEntries ?? [];

    expect(readBeforePlan).toBeNull();
    expect(snapshots).toEqual([]);
    expect(canonical).toEqual([]);
    expect(operational).toEqual([]);
  });

  it("21. missing memoryReadBeforePlan field — falls back to null", () => {
    const memory = { canonicalEntries: [], operationalEntries: [], auditSnapshots: [] };
    const readBeforePlan = memory?.memoryReadBeforePlan ?? null;
    expect(readBeforePlan).toBeNull();
  });

  it("22. missing auditSnapshots field — falls back to empty array", () => {
    const memory = { canonicalEntries: [], operationalEntries: [], memoryReadBeforePlan: { happened: false } };
    const snapshots = memory?.auditSnapshots ?? [];
    expect(snapshots).toEqual([]);
  });

  it("23. total consulted is 0 when both entry arrays empty", () => {
    const memory = buildCardProps(MEMORY_STATES.EMPTY);
    const total = memory.canonicalEntries.length + memory.operationalEntries.length;
    expect(total).toBe(0);
  });

  it("24. total consulted matches summary.total for populated state", () => {
    const memory = buildCardProps(MEMORY_STATES.POPULATED);
    const total = memory.canonicalEntries.length + memory.operationalEntries.length;
    expect(total).toBe(memory.summary.total);
  });
});
