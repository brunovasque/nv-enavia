// =============================================================================
// ENAVIA Panel — P14 operational tracking panel-only smoke tests
//
// Cobre o contrato P14 (escopo painel):
//   1. deriveTrackingStatus retorna tracking_idle para input null/undefined
//   2. deriveTrackingStatus retorna tracking_unreachable quando executor_reachable = false
//   3. deriveTrackingStatus retorna tracking_reachable quando executor_reachable = true
//   4. deriveTrackingStatus extrai detail do executor_status
//   5. deriveTrackingStatus preserva queried_at
//   6. OperationalTracking NÃO renderiza quando dispatchStatus !== dispatch_accepted
//   7. OperationalTracking renderiza após dispatch aceito com botão de consulta manual
//   8. TRACKING_STATUS enum é consistente com TRACKING_META
//   9. fetchBridgeStatus retorna shape correto em mock mode
//  10. fetchBridgeStatus valida bridge_id em real mode
//  11. PlanPage gerencia tracking state e passa props para BridgeCard
//  12. PlanPage reseta tracking state em novo ciclo
//  13. Distinção P13 (imediato) vs P14 (acompanhamento) é clara
//  14. Sem auto-refresh, sem setInterval, sem P15+
//
// Escopo: apenas código de painel — sem leitura de nv-enavia.js.
//
// Run with:
//   npm test   (from panel/)
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Source text helpers ──────────────────────────────────────────────────────
const BRIDGE_CARD_SRC = readFileSync(
  resolve(import.meta.dirname, "../plan/BridgeCard.jsx"),
  "utf8"
);
const PLAN_PAGE_SRC = readFileSync(
  resolve(import.meta.dirname, "../pages/PlanPage.jsx"),
  "utf8"
);
const BRIDGE_ENDPOINT_SRC = readFileSync(
  resolve(import.meta.dirname, "../api/endpoints/bridge.js"),
  "utf8"
);
const API_INDEX_SRC = readFileSync(
  resolve(import.meta.dirname, "../api/index.js"),
  "utf8"
);

// ── Import pure functions ───────────────────────────────────────────────────
import {
  deriveTrackingStatus,
  TRACKING_STATUS,
  DISPATCH_STATUS,
} from "../plan/BridgeCard.jsx";

afterEach(() => {
  vi.resetModules();
});

// =============================================================================
// PROVA 1 — deriveTrackingStatus: null/undefined → tracking_idle
// =============================================================================
describe("P14 PROVA 1 — deriveTrackingStatus: null/undefined → tracking_idle", () => {
  it("retorna tracking_idle para null", () => {
    const result = deriveTrackingStatus(null);
    expect(result.status).toBe(TRACKING_STATUS.IDLE);
    expect(result.detail).toBeNull();
    expect(result.queriedAt).toBeNull();
  });

  it("retorna tracking_idle para undefined", () => {
    const result = deriveTrackingStatus(undefined);
    expect(result.status).toBe(TRACKING_STATUS.IDLE);
  });

  it("retorna tracking_idle para non-object", () => {
    const result = deriveTrackingStatus("string");
    expect(result.status).toBe(TRACKING_STATUS.IDLE);
  });
});

// =============================================================================
// PROVA 2 — deriveTrackingStatus: executor_reachable = false → tracking_unreachable
// =============================================================================
describe("P14 PROVA 2 — deriveTrackingStatus: executor_reachable = false → tracking_unreachable", () => {
  it("retorna tracking_unreachable quando executor não é alcançável", () => {
    const result = deriveTrackingStatus({ executor_reachable: false, queried_at: "2026-04-12T12:00:00Z" });
    expect(result.status).toBe(TRACKING_STATUS.UNREACHABLE);
    expect(result.queriedAt).toBe("2026-04-12T12:00:00Z");
  });

  it("retorna tracking_unreachable quando executor_reachable é undefined", () => {
    const result = deriveTrackingStatus({ queried_at: "2026-04-12T12:00:00Z" });
    expect(result.status).toBe(TRACKING_STATUS.UNREACHABLE);
  });
});

// =============================================================================
// PROVA 3 — deriveTrackingStatus: executor_reachable = true → tracking_reachable
// =============================================================================
describe("P14 PROVA 3 — deriveTrackingStatus: executor_reachable = true → tracking_reachable", () => {
  it("retorna tracking_reachable para executor operacional", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true, status: "operational" },
      queried_at: "2026-04-12T12:00:00Z",
    });
    expect(result.status).toBe(TRACKING_STATUS.REACHABLE);
  });

  it("retorna tracking_reachable mesmo sem executor_status detalhado", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: null,
    });
    expect(result.status).toBe(TRACKING_STATUS.REACHABLE);
    expect(result.detail).toBeNull();
  });
});

// =============================================================================
// PROVA 4 — deriveTrackingStatus extrai detail do executor_status
// =============================================================================
describe("P14 PROVA 4 — deriveTrackingStatus extrai detail do executor", () => {
  it("extrai campo status como detail", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true, status: "operational" },
    });
    expect(result.detail).toBe("operational");
  });

  it("extrai campo execution_status como fallback", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true, execution_status: "running" },
    });
    expect(result.detail).toBe("running");
  });

  it("detail é null quando nenhum campo de status presente", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true },
    });
    expect(result.detail).toBeNull();
  });
});

// =============================================================================
// PROVA 5 — deriveTrackingStatus preserva queried_at
// =============================================================================
describe("P14 PROVA 5 — deriveTrackingStatus preserva queried_at", () => {
  it("preserva queried_at quando presente", () => {
    const ts = "2026-04-12T15:30:00Z";
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true },
      queried_at: ts,
    });
    expect(result.queriedAt).toBe(ts);
  });

  it("queriedAt é null quando ausente", () => {
    const result = deriveTrackingStatus({
      executor_reachable: true,
      executor_status: { ok: true },
    });
    expect(result.queriedAt).toBeNull();
  });
});

// =============================================================================
// PROVA 6 — OperationalTracking NÃO renderiza antes de dispatch aceito
// =============================================================================
describe("P14 PROVA 6 — OperationalTracking não renderiza antes de dispatch aceito", () => {
  it("OperationalTracking verifica dispatchStatus !== DISPATCH_STATUS.ACCEPTED", () => {
    expect(BRIDGE_CARD_SRC).toContain("DISPATCH_STATUS.ACCEPTED");
    // OperationalTracking returns null when dispatch is not accepted
    expect(BRIDGE_CARD_SRC).toContain("dispatchStatus !== DISPATCH_STATUS.ACCEPTED");
  });
});

// =============================================================================
// PROVA 7 — OperationalTracking renderiza com botão de consulta manual
// =============================================================================
describe("P14 PROVA 7 — OperationalTracking renderiza consulta manual", () => {
  it("OperationalTracking tem botão de refresh", () => {
    expect(BRIDGE_CARD_SRC).toContain("Consultar status");
  });

  it("OperationalTracking tem role=region e aria-label", () => {
    expect(BRIDGE_CARD_SRC).toContain('role="region"');
    expect(BRIDGE_CARD_SRC).toContain("Acompanhamento operacional");
  });

  it("OperationalTracking usa deriveTrackingStatus para interpretar resposta", () => {
    expect(BRIDGE_CARD_SRC).toContain("deriveTrackingStatus");
  });

  it("OperationalTracking exibe queried_at quando presente", () => {
    expect(BRIDGE_CARD_SRC).toContain("queriedAt");
    expect(BRIDGE_CARD_SRC).toContain("Consultado:");
  });

  it("OperationalTracking desabilita botão durante consulta", () => {
    expect(BRIDGE_CARD_SRC).toContain("disabled={isQuerying}");
  });
});

// =============================================================================
// PROVA 8 — TRACKING_STATUS enum integrity
// =============================================================================
describe("P14 PROVA 8 — TRACKING_STATUS enum integrity", () => {
  it("TRACKING_STATUS contém IDLE", () => {
    expect(TRACKING_STATUS.IDLE).toBe("tracking_idle");
  });

  it("TRACKING_STATUS contém QUERYING", () => {
    expect(TRACKING_STATUS.QUERYING).toBe("tracking_querying");
  });

  it("TRACKING_STATUS contém REACHABLE", () => {
    expect(TRACKING_STATUS.REACHABLE).toBe("tracking_reachable");
  });

  it("TRACKING_STATUS contém UNREACHABLE", () => {
    expect(TRACKING_STATUS.UNREACHABLE).toBe("tracking_unreachable");
  });

  it("TRACKING_STATUS contém ERROR", () => {
    expect(TRACKING_STATUS.ERROR).toBe("tracking_error");
  });

  it("TRACKING_META cobre todos os TRACKING_STATUS", () => {
    expect(BRIDGE_CARD_SRC).toContain("[TRACKING_STATUS.IDLE]");
    expect(BRIDGE_CARD_SRC).toContain("[TRACKING_STATUS.QUERYING]");
    expect(BRIDGE_CARD_SRC).toContain("[TRACKING_STATUS.REACHABLE]");
    expect(BRIDGE_CARD_SRC).toContain("[TRACKING_STATUS.UNREACHABLE]");
    expect(BRIDGE_CARD_SRC).toContain("[TRACKING_STATUS.ERROR]");
  });
});

// =============================================================================
// PROVA 9 — fetchBridgeStatus retorna shape correto em mock mode
// =============================================================================
describe("P14 PROVA 9 — fetchBridgeStatus retorna shape correto em mock mode", () => {
  it("fetchBridgeStatus retorna ok=true com executor_reachable em mock mode", async () => {
    const { fetchBridgeStatus } = await import("../api/endpoints/bridge.js");
    const res = await fetchBridgeStatus("mock-bridge-123");
    expect(res.ok).toBe(true);
    expect(res.data.executor_reachable).toBe(true);
    expect(res.data.bridge_id).toBe("mock-bridge-123");
    expect(typeof res.data.queried_at).toBe("string");
    expect(typeof res.meta.durationMs).toBe("number");
  });

  it("fetchBridgeStatus retorna executor_status em mock mode", async () => {
    const { fetchBridgeStatus } = await import("../api/endpoints/bridge.js");
    const res = await fetchBridgeStatus("mock-bridge-456");
    expect(res.data.executor_status).toBeTruthy();
    expect(res.data.executor_status.ok).toBe(true);
  });
});

// =============================================================================
// PROVA 10 — fetchBridgeStatus valida bridge_id em real mode
// =============================================================================
describe("P14 PROVA 10 — fetchBridgeStatus valida bridge_id em real mode", () => {
  it("fetchBridgeStatus rejeita bridge_id null em real mode", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://test.local");
    vi.stubEnv("VITE_API_MODE", "real");
    const { fetchBridgeStatus } = await import("../api/endpoints/bridge.js");
    const res = await fetchBridgeStatus(null);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("BRIDGE_SEND_FAILURE");
    vi.unstubAllEnvs();
  });

  it("fetchBridgeStatus rejeita bridge_id empty em real mode", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://test.local");
    vi.stubEnv("VITE_API_MODE", "real");
    const { fetchBridgeStatus } = await import("../api/endpoints/bridge.js");
    const res = await fetchBridgeStatus("");
    expect(res.ok).toBe(false);
    vi.unstubAllEnvs();
  });
});

// =============================================================================
// PROVA 11 — PlanPage gerencia tracking state e passa props para BridgeCard
// =============================================================================
describe("P14 PROVA 11 — PlanPage gerencia tracking state", () => {
  it("PlanPage importa fetchBridgeStatus da API", () => {
    expect(PLAN_PAGE_SRC).toContain("fetchBridgeStatus");
    expect(PLAN_PAGE_SRC).toMatch(/import.*fetchBridgeStatus.*from.*["']\.\.\/api["']/);
  });

  it("PlanPage importa TRACKING_STATUS do BridgeCard", () => {
    expect(PLAN_PAGE_SRC).toContain("TRACKING_STATUS");
    expect(PLAN_PAGE_SRC).toMatch(/import.*TRACKING_STATUS.*from.*BridgeCard/);
  });

  it("PlanPage gerencia trackingStatus state", () => {
    expect(PLAN_PAGE_SRC).toContain("trackingStatus");
    expect(PLAN_PAGE_SRC).toContain("setTrackingStatus");
  });

  it("PlanPage gerencia trackingData state", () => {
    expect(PLAN_PAGE_SRC).toContain("trackingData");
    expect(PLAN_PAGE_SRC).toContain("setTrackingData");
  });

  it("PlanPage gerencia trackingError state", () => {
    expect(PLAN_PAGE_SRC).toContain("trackingError");
    expect(PLAN_PAGE_SRC).toContain("setTrackingError");
  });

  it("PlanPage tem handleRefreshTracking que chama fetchBridgeStatus", () => {
    expect(PLAN_PAGE_SRC).toContain("handleRefreshTracking");
    expect(PLAN_PAGE_SRC).toContain("fetchBridgeStatus(bridgeId)");
  });

  it("PlanPage passa tracking props para BridgeCard", () => {
    expect(PLAN_PAGE_SRC).toContain("trackingStatus={trackingStatus}");
    expect(PLAN_PAGE_SRC).toContain("trackingData={trackingData}");
    expect(PLAN_PAGE_SRC).toContain("trackingError={trackingError}");
    expect(PLAN_PAGE_SRC).toContain("onRefreshTracking={handleRefreshTracking}");
  });
});

// =============================================================================
// PROVA 12 — PlanPage reseta tracking state em novo ciclo
// =============================================================================
describe("P14 PROVA 12 — PlanPage reseta tracking state quando plan muda", () => {
  it("useEffect reseta trackingStatus para IDLE", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("setTrackingStatus");
  });

  it("useEffect reseta trackingData para null", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("setTrackingData(null)");
  });

  it("useEffect reseta trackingError para null", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("setTrackingError(null)");
  });
});

// =============================================================================
// PROVA 13 — Distinção P13 (imediato) vs P14 (acompanhamento)
// =============================================================================
describe("P14 PROVA 13 — Distinção P13 (imediato) vs P14 (acompanhamento)", () => {
  it("P13 deriveDispatchOutcome e P14 deriveTrackingStatus são funções distintas", () => {
    expect(BRIDGE_CARD_SRC).toContain("function deriveDispatchOutcome");
    expect(BRIDGE_CARD_SRC).toContain("function deriveTrackingStatus");
    // They are different exported functions
    expect(typeof deriveTrackingStatus).toBe("function");
    expect(typeof DISPATCH_STATUS).toBe("object");
    expect(typeof TRACKING_STATUS).toBe("object");
  });

  it("P13 DispatchOutcome e P14 OperationalTracking são componentes distintos", () => {
    expect(BRIDGE_CARD_SRC).toContain("function DispatchOutcome");
    expect(BRIDGE_CARD_SRC).toContain("function OperationalTracking");
  });

  it("P13 usa DISPATCH_STATUS, P14 usa TRACKING_STATUS — enums separados", () => {
    expect(BRIDGE_CARD_SRC).toContain("DISPATCH_STATUS");
    expect(BRIDGE_CARD_SRC).toContain("TRACKING_STATUS");
    // No overlap in enum values
    const dispatchValues = Object.values(DISPATCH_STATUS);
    const trackingValues = Object.values(TRACKING_STATUS);
    const overlap = dispatchValues.filter((v) => trackingValues.includes(v));
    expect(overlap.length).toBe(0);
  });

  it("BridgeCard renderiza DispatchOutcome (P13) e OperationalTracking (P14) separados", () => {
    expect(BRIDGE_CARD_SRC).toContain("<DispatchOutcome");
    expect(BRIDGE_CARD_SRC).toContain("<OperationalTracking");
  });

  it("fetchBridgeStatus é exportado via api/index.js", () => {
    expect(API_INDEX_SRC).toContain("fetchBridgeStatus");
  });
});

// =============================================================================
// PROVA 14 — Escopo fechado: sem auto-refresh no BridgeCard/bridge.js
// Nota: PlanPage PODE conter setInterval para polling de planner:latest
// (adicionado no PR "aba Plano consistente/backend-driven").
// O guard original era escopo P14 (BridgeCard e bridge.js). Mantido.
// =============================================================================
describe("P14 PROVA 14 — Escopo fechado: sem auto-refresh ou P15+", () => {
  it("BridgeCard NÃO contém setInterval", () => {
    expect(BRIDGE_CARD_SRC).not.toContain("setInterval");
  });

  it("PlanPage contém setInterval para polling de planner:latest (backend-driven)", () => {
    // O polling de 30s para GET /planner/latest é intencional e requerido
    // pelo PR "aba Plano consistente / backend-driven".
    expect(PLAN_PAGE_SRC).toContain("setInterval");
    expect(PLAN_PAGE_SRC).toContain("_doSyncFromBackend");
  });

  it("bridge.js endpoint NÃO contém setInterval", () => {
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("setInterval");
  });

  it("PlanPage NÃO importa fetchExecution (preserva P13 boundary)", () => {
    expect(PLAN_PAGE_SRC).not.toContain("fetchExecution");
  });

  it("fetchBridgeStatus NÃO contém recursive call ou scheduling", () => {
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("setTimeout(fetchBridgeStatus");
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("setInterval(fetchBridgeStatus");
  });

  it("deriveTrackingStatus é função pura — sem side effects", () => {
    // Call it multiple times, same input = same output (deterministic)
    const input = { executor_reachable: true, executor_status: { ok: true, status: "operational" }, queried_at: "2026-04-12T12:00:00Z" };
    const r1 = deriveTrackingStatus(input);
    const r2 = deriveTrackingStatus(input);
    expect(r1.status).toBe(r2.status);
    expect(r1.detail).toBe(r2.detail);
    expect(r1.queriedAt).toBe(r2.queriedAt);
  });

  it("deriveTrackingStatus NÃO faz fetch, I/O ou efeito colateral", () => {
    const fnSrc = deriveTrackingStatus.toString();
    expect(fnSrc).not.toContain("fetch(");
    expect(fnSrc).not.toContain("await ");
  });
});
