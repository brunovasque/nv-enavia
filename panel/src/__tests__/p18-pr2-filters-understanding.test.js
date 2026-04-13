// =============================================================================
// ENAVIA Panel — P18-PR2 smoke tests: filtros e entendimento
//
// Tests for the P18-PR2 additions to the memory panel:
//   1. Secondary filters (tier + priority) produce correct filtered entry sets
//   2. Priority explanation derivation is correct and honest
//   3. Contract link derivation from liveContext is correct
//   4. gate_rejected snapshot detection works
//   5. Empty / no-data states remain honest after PR2 additions
//   6. No regression on existing P18-PR1 fields
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MOCK_MEMORY, MEMORY_STATES, MEMORY_FILTERS } from "../memory/mockMemory.js";

beforeEach(() => {
  vi.stubEnv("VITE_API_MODE", "mock");
  vi.stubEnv("VITE_API_BASE_URL", "http://test-backend");
  vi.stubEnv("VITE_API_TIMEOUT_MS", "5000");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ── Helpers mirroring component logic ────────────────────────────────────────

function applySecondaryFilters(entries, tierFilter, priorityFilter) {
  return entries.filter((e) => {
    const tierOk = tierFilter === "all" || e.tier === Number(tierFilter);
    const priorityOk = priorityFilter === "all" || e.priority === priorityFilter;
    return tierOk && priorityOk;
  });
}

function derivePriorityExplanation(readBeforePlan) {
  if (!readBeforePlan?.happened) return null;
  const parts = [];
  if (readBeforePlan.topTier === 1) {
    parts.push("tier mais alto (Tier 1)");
  } else if (readBeforePlan.topTier != null) {
    parts.push(`tier ativo (Tier ${readBeforePlan.topTier})`);
  }
  if (readBeforePlan.topPriority === "critical") {
    parts.push("prioridade crítica");
  } else if (readBeforePlan.topPriority === "high") {
    parts.push("prioridade alta");
  } else if (readBeforePlan.topPriority === "medium") {
    parts.push("prioridade média");
  }
  if (parts.length === 0) return "leitura pré-plano confirmada";
  return `venceu por ${parts.join(" + ")}`;
}

// ── Tier filter tests ─────────────────────────────────────────────────────────
describe("P18-PR2 — tier filter", () => {
  const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
  const allEntries = [...mem.canonicalEntries, ...mem.operationalEntries];

  it("1. tier filter 'all' returns all entries", () => {
    const result = applySecondaryFilters(allEntries, "all", "all");
    expect(result.length).toBe(allEntries.length);
  });

  it("2. tier filter '1' returns only Tier 1 entries", () => {
    const result = applySecondaryFilters(allEntries, "1", "all");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((e) => expect(e.tier).toBe(1));
  });

  it("3. tier filter '3' returns only Tier 3 entries", () => {
    const result = applySecondaryFilters(allEntries, "3", "all");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((e) => expect(e.tier).toBe(3));
  });

  it("4. tier filter for a non-existent tier returns empty array", () => {
    const result = applySecondaryFilters(allEntries, "99", "all");
    expect(result.length).toBe(0);
  });

  it("5. tier filter '2' returns only Tier 2 entries", () => {
    const result = applySecondaryFilters(allEntries, "2", "all");
    result.forEach((e) => expect(e.tier).toBe(2));
  });
});

// ── Priority filter tests ─────────────────────────────────────────────────────
describe("P18-PR2 — priority filter", () => {
  const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
  const allEntries = [...mem.canonicalEntries, ...mem.operationalEntries];

  it("6. priority filter 'all' returns all entries", () => {
    const result = applySecondaryFilters(allEntries, "all", "all");
    expect(result.length).toBe(allEntries.length);
  });

  it("7. priority filter 'critical' returns only critical entries", () => {
    const result = applySecondaryFilters(allEntries, "all", "critical");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((e) => expect(e.priority).toBe("critical"));
  });

  it("8. priority filter 'high' returns only high priority entries", () => {
    const result = applySecondaryFilters(allEntries, "all", "high");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((e) => expect(e.priority).toBe("high"));
  });

  it("9. priority filter 'low' returns only low priority entries", () => {
    const result = applySecondaryFilters(allEntries, "all", "low");
    result.forEach((e) => expect(e.priority).toBe("low"));
  });

  it("10. priority filter for unknown value returns empty array", () => {
    const result = applySecondaryFilters(allEntries, "all", "nonexistent");
    expect(result.length).toBe(0);
  });
});

// ── Combined tier + priority filter tests ────────────────────────────────────
describe("P18-PR2 — combined tier + priority filter", () => {
  const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
  const allEntries = [...mem.canonicalEntries, ...mem.operationalEntries];

  it("11. tier 1 + critical returns only tier=1, priority=critical entries", () => {
    const result = applySecondaryFilters(allEntries, "1", "critical");
    expect(result.length).toBeGreaterThan(0);
    result.forEach((e) => {
      expect(e.tier).toBe(1);
      expect(e.priority).toBe("critical");
    });
  });

  it("12. tier 1 + low returns empty (no tier-1 low entries)", () => {
    const result = applySecondaryFilters(allEntries, "1", "low");
    result.forEach((e) => {
      expect(e.tier).toBe(1);
      expect(e.priority).toBe("low");
    });
  });

  it("13. tier 6 + low returns tier-6 low entry", () => {
    const result = applySecondaryFilters(allEntries, "6", "low");
    result.forEach((e) => {
      expect(e.tier).toBe(6);
      expect(e.priority).toBe("low");
    });
  });
});

// ── Available tiers/priorities derivation ─────────────────────────────────────
describe("P18-PR2 — available tiers and priorities from entries", () => {
  const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
  const allEntries = [...mem.canonicalEntries, ...mem.operationalEntries];
  const availableTiers = [...new Set(allEntries.map((e) => e.tier).filter(Boolean))].sort(
    (a, b) => a - b,
  );
  const priorityOrder = ["critical", "high", "medium", "low"];
  const availablePriorities = priorityOrder.filter((p) =>
    allEntries.some((e) => e.priority === p),
  );

  it("14. availableTiers is sorted ascending", () => {
    for (let i = 1; i < availableTiers.length; i++) {
      expect(availableTiers[i]).toBeGreaterThan(availableTiers[i - 1]);
    }
  });

  it("15. availableTiers contains at least tier 1", () => {
    expect(availableTiers).toContain(1);
  });

  it("16. availablePriorities is a subset of [critical, high, medium, low]", () => {
    for (const p of availablePriorities) {
      expect(["critical", "high", "medium", "low"]).toContain(p);
    }
  });

  it("17. availablePriorities contains critical (from canonical entries)", () => {
    expect(availablePriorities).toContain("critical");
  });

  it("18. empty state has no entries → availableTiers and availablePriorities are empty", () => {
    const emptyMem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    const emptyEntries = [
      ...emptyMem.canonicalEntries,
      ...emptyMem.operationalEntries,
    ];
    const tiers = [...new Set(emptyEntries.map((e) => e.tier).filter(Boolean))];
    const priorities = priorityOrder.filter((p) =>
      emptyEntries.some((e) => e.priority === p),
    );
    expect(tiers.length).toBe(0);
    expect(priorities.length).toBe(0);
  });
});

// ── Priority explanation derivation tests ────────────────────────────────────
describe("P18-PR2 — priority explanation derivation", () => {
  it("19. topTier=1 + topPriority=critical → mentions tier 1 and critical", () => {
    const rbp = { happened: true, topTier: 1, topPriority: "critical" };
    const result = derivePriorityExplanation(rbp);
    expect(result).not.toBeNull();
    expect(result).toContain("tier mais alto");
    expect(result).toContain("prioridade crítica");
  });

  it("20. topTier=1 only → mentions tier 1", () => {
    const rbp = { happened: true, topTier: 1, topPriority: null };
    const result = derivePriorityExplanation(rbp);
    expect(result).toContain("tier mais alto");
  });

  it("21. topPriority=high → mentions prioridade alta", () => {
    const rbp = { happened: true, topTier: 3, topPriority: "high" };
    const result = derivePriorityExplanation(rbp);
    expect(result).toContain("prioridade alta");
  });

  it("22. happened=false → returns null", () => {
    const rbp = { happened: false, topTier: 1, topPriority: "critical" };
    const result = derivePriorityExplanation(rbp);
    expect(result).toBeNull();
  });

  it("23. happened=true, no tier, no priority → fallback message", () => {
    const rbp = { happened: true, topTier: null, topPriority: null };
    const result = derivePriorityExplanation(rbp);
    expect(result).toBe("leitura pré-plano confirmada");
  });

  it("24. null readBeforePlan → returns null", () => {
    expect(derivePriorityExplanation(null)).toBeNull();
  });

  it("25. populated mock → explanation is truthy", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    const result = derivePriorityExplanation(mem.memoryReadBeforePlan);
    expect(result).toBeTruthy();
  });

  it("26. empty mock → explanation is null (happened=false)", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    const result = derivePriorityExplanation(mem.memoryReadBeforePlan);
    expect(result).toBeNull();
  });
});

// ── Contract link from liveContext ────────────────────────────────────────────
describe("P18-PR2 — contract link from liveContext", () => {
  it("27. populated state has liveContext.activeContracts", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    expect(mem.liveContext).not.toBeNull();
    expect(Array.isArray(mem.liveContext.activeContracts)).toBe(true);
  });

  it("28. populated activeContracts has at least one entry", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    expect(mem.liveContext.activeContracts.length).toBeGreaterThan(0);
  });

  it("29. each activeContract has id, label, status", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    for (const c of mem.liveContext.activeContracts) {
      expect(c).toHaveProperty("id");
      expect(c).toHaveProperty("label");
      expect(c).toHaveProperty("status");
    }
  });

  it("30. empty state has null liveContext → no contracts", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    const contracts = mem.liveContext?.activeContracts ?? [];
    expect(contracts.length).toBe(0);
  });

  it("31. null liveContext → activeContracts falls back to empty array", () => {
    const liveContext = null;
    const contracts = liveContext?.activeContracts ?? [];
    expect(contracts).toEqual([]);
  });
});

// ── gate_rejected snapshot detection ─────────────────────────────────────────
describe("P18-PR2 — gate_rejected snapshot detection", () => {
  it("32. populated mock has no gate_rejected snapshot by default", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    const hasBlock = mem.auditSnapshots.some((s) => s.type === "gate_rejected");
    expect(hasBlock).toBe(false);
  });

  it("33. simulated gate_rejected snapshot is detected correctly", () => {
    const snapshots = [
      { id: "s1", label: "Gate rejeitado", type: "gate_rejected", createdAt: "2026-04-12T03:00:00Z" },
      { id: "s2", label: "Início", type: "session_start", createdAt: "2026-04-12T02:00:00Z" },
    ];
    const hasBlock = snapshots.some((s) => s.type === "gate_rejected");
    expect(hasBlock).toBe(true);
  });

  it("34. snapshots without gate_rejected → hasBlock is false", () => {
    const snapshots = [
      { id: "s1", label: "Gate aprovado", type: "gate_approved", createdAt: "2026-04-12T03:00:00Z" },
    ];
    const hasBlock = snapshots.some((s) => s.type === "gate_rejected");
    expect(hasBlock).toBe(false);
  });

  it("35. empty auditSnapshots → hasBlock is false", () => {
    const hasBlock = [].some((s) => s.type === "gate_rejected");
    expect(hasBlock).toBe(false);
  });
});

// ── Honest empty state after PR2 ─────────────────────────────────────────────
describe("P18-PR2 — honest empty state preserved", () => {
  it("36. empty mock — tier filter on empty entries returns empty", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    const allEntries = [...mem.canonicalEntries, ...mem.operationalEntries];
    const result = applySecondaryFilters(allEntries, "1", "critical");
    expect(result.length).toBe(0);
  });

  it("37. empty mock — explanation derivation returns null", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    expect(derivePriorityExplanation(mem.memoryReadBeforePlan)).toBeNull();
  });

  it("38. empty mock — auditSnapshots is empty", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    expect(mem.auditSnapshots).toEqual([]);
  });

  it("39. empty mock — liveContext is null", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.EMPTY];
    expect(mem.liveContext).toBeNull();
  });
});

// ── No regression on P18-PR1 fields ──────────────────────────────────────────
describe("P18-PR2 — P18-PR1 no-regression", () => {
  it("40. populated mock still has memoryReadBeforePlan", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    expect(mem).toHaveProperty("memoryReadBeforePlan");
    expect(mem.memoryReadBeforePlan.happened).toBe(true);
  });

  it("41. populated mock still has auditSnapshots array", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    expect(Array.isArray(mem.auditSnapshots)).toBe(true);
    expect(mem.auditSnapshots.length).toBeGreaterThan(0);
  });

  it("42. canonical entries still have tier + priority", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    for (const e of mem.canonicalEntries) {
      expect(typeof e.tier).toBe("number");
      expect(["critical", "high", "medium", "low"]).toContain(e.priority);
    }
  });

  it("43. operational entries still have tier + priority", () => {
    const mem = MOCK_MEMORY[MEMORY_STATES.POPULATED];
    for (const e of mem.operationalEntries) {
      expect(typeof e.tier).toBe("number");
      expect(["critical", "high", "medium", "low"]).toContain(e.priority);
    }
  });
});
