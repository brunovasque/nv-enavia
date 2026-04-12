// =============================================================================
// ENAVIA Panel — P12 bridge panel-only smoke tests
//
// Cobre o contrato P12 (escopo painel):
//   1. sendBridge valida executor_payload — rejeita payload inválido
//   2. sendBridge aceita payload válido em mock mode
//   3. PlanPage handleGateApprove dispara bridge send (P12 lifecycle)
//   4. PlanPage handleGateReject NÃO dispara bridge send
//   5. BridgeCard renderiza status de envio (sending/sent/error)
//   6. BridgeCard NÃO renderiza send block quando idle
//   7. PlanPage reseta bridge state em novo ciclo (visibleState/plannerSnapshot change)
//   8. sendBridge retorna shape correto em mock mode
//   9. ERROR_CODES inclui BRIDGE_SEND_FAILURE
//  10. Nenhum desvio para P13+ no painel
//
// Escopo: apenas código de painel — sem leitura de nv-enavia.js.
// Validação do worker fica reservada para a PR worker-only.
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

afterEach(() => {
  vi.resetModules();
});

// =============================================================================
// PROVA 1 — sendBridge rejeita payload inválido
// =============================================================================
describe("P12 PROVA 1 — sendBridge valida executor_payload antes de enviar", () => {
  it("sendBridge rejeita payload null", async () => {
    // Stub env to force mock mode (no VITE_API_BASE_URL)
    vi.stubEnv("VITE_API_BASE_URL", "http://test.local");
    vi.stubEnv("VITE_API_MODE", "real");
    const { sendBridge } = await import("../api/endpoints/bridge.js");
    const res = await sendBridge(null);
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("BRIDGE_SEND_FAILURE");
    vi.unstubAllEnvs();
  });

  it("sendBridge rejeita payload sem version", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://test.local");
    vi.stubEnv("VITE_API_MODE", "real");
    const { sendBridge } = await import("../api/endpoints/bridge.js");
    const res = await sendBridge({ source: "x", steps: [] });
    expect(res.ok).toBe(false);
    expect(res.error.code).toBe("BRIDGE_SEND_FAILURE");
    vi.unstubAllEnvs();
  });

  it("sendBridge rejeita payload sem steps array", async () => {
    vi.stubEnv("VITE_API_BASE_URL", "http://test.local");
    vi.stubEnv("VITE_API_MODE", "real");
    const { sendBridge } = await import("../api/endpoints/bridge.js");
    const res = await sendBridge({ version: "1.0", source: "x" });
    expect(res.ok).toBe(false);
    vi.unstubAllEnvs();
  });
});

// =============================================================================
// PROVA 2 — sendBridge aceita payload válido em mock mode
// =============================================================================
describe("P12 PROVA 2 — sendBridge aceita payload válido em mock mode", () => {
  it("sendBridge retorna ok=true com bridge_accepted=true para payload válido", async () => {
    // Mock mode (default — no VITE_API_BASE_URL)
    const { sendBridge } = await import("../api/endpoints/bridge.js");
    const validPayload = {
      version: "1.0",
      source: "planner_bridge",
      plan_summary: "Test plan",
      complexity_level: "A",
      plan_type: "quick_reply",
      steps: ["Step 1", "Step 2"],
      risks: ["Low risk"],
      acceptance_criteria: ["Done"],
    };
    const res = await sendBridge(validPayload);
    expect(res.ok).toBe(true);
    expect(res.data.bridge_accepted).toBe(true);
    expect(res.data.bridge_id).toBeTruthy();
  });

  it("sendBridge retorna shape completo em mock mode", async () => {
    const { sendBridge } = await import("../api/endpoints/bridge.js");
    const res = await sendBridge({
      version: "1.0",
      source: "planner_bridge",
      steps: ["S1"],
      risks: [],
      acceptance_criteria: [],
    });
    expect(res.ok).toBe(true);
    expect("bridge_accepted" in res.data).toBe(true);
    expect("bridge_id" in res.data).toBe(true);
    expect("executor_response" in res.data).toBe(true);
    expect("timestamp" in res.data).toBe(true);
    expect(typeof res.meta.durationMs).toBe("number");
  });
});

// =============================================================================
// PROVA 3 — PlanPage handleGateApprove dispara bridge send
// =============================================================================
describe("P12 PROVA 3 — PlanPage: handleGateApprove dispara handleBridgeSend", () => {
  it("handleGateApprove chama handleBridgeSend", () => {
    const approveIdx = PLAN_PAGE_SRC.indexOf("function handleGateApprove");
    const section = PLAN_PAGE_SRC.slice(approveIdx, approveIdx + 300);
    expect(section).toContain("setGateAction");
    expect(section).toContain('"approved"');
    expect(section).toContain("handleBridgeSend");
  });

  it("handleBridgeSend extrai executor_payload do plannerSnapshot.bridge", () => {
    expect(PLAN_PAGE_SRC).toContain("plannerSnapshot?.bridge?.executor_payload");
  });

  it("handleBridgeSend chama sendBridge com o executor_payload", () => {
    expect(PLAN_PAGE_SRC).toContain("sendBridge(executorPayload)");
  });

  it("PlanPage importa sendBridge da API", () => {
    expect(PLAN_PAGE_SRC).toContain("sendBridge");
    expect(PLAN_PAGE_SRC).toMatch(/import.*sendBridge.*from.*["']\.\.\/api["']/);
  });
});

// =============================================================================
// PROVA 4 — handleGateReject NÃO dispara bridge
// =============================================================================
describe("P12 PROVA 4 — handleGateReject NÃO dispara bridge send", () => {
  it("handleGateReject não chama handleBridgeSend, sendBridge ou fetch", () => {
    const rejectIdx = PLAN_PAGE_SRC.indexOf("function handleGateReject");
    const section = PLAN_PAGE_SRC.slice(rejectIdx, rejectIdx + 300);
    expect(section).toContain("setGateAction");
    expect(section).toContain('"blocked"');
    expect(section).not.toContain("handleBridgeSend");
    expect(section).not.toContain("sendBridge");
    expect(section).not.toContain("fetch(");
  });
});

// =============================================================================
// PROVA 5 — BridgeCard renderiza BridgeSendStatus
// =============================================================================
describe("P12 PROVA 5 — BridgeCard renderiza feedback de envio da bridge", () => {
  it("BridgeCard aceita props bridgeSendStatus, bridgeSendResult, bridgeSendError", async () => {
    const mod = await import("../plan/BridgeCard.jsx");
    const src = mod.default.toString();
    expect(src).toContain("bridgeSendStatus");
    expect(src).toContain("bridgeSendResult");
    expect(src).toContain("bridgeSendError");
  });

  it("BridgeSendStatus rendering está presente no BridgeCard", () => {
    expect(BRIDGE_CARD_SRC).toContain("BridgeSendStatus");
    expect(BRIDGE_CARD_SRC).toContain("sendStatus");
    expect(BRIDGE_CARD_SRC).toContain("sendResult");
    expect(BRIDGE_CARD_SRC).toContain("sendError");
  });

  it("BRIDGE_SEND_META cobre sending/sent/error com labels corretas", () => {
    expect(BRIDGE_CARD_SRC).toContain("Enviando bridge");
    expect(BRIDGE_CARD_SRC).toContain("Bridge enviada");
    expect(BRIDGE_CARD_SRC).toContain("Falha no envio");
  });

  it("BridgeSendStatus tem role=status e aria-live=polite", () => {
    expect(BRIDGE_CARD_SRC).toContain('role="status"');
    expect(BRIDGE_CARD_SRC).toContain('aria-live="polite"');
  });
});

// =============================================================================
// PROVA 6 — BridgeCard NÃO renderiza send block quando idle
// =============================================================================
describe("P12 PROVA 6 — BridgeSendStatus retorna null quando idle", () => {
  it("BridgeSendStatus verifica idle e retorna null", () => {
    // Source inspection: sendStatus === "idle" → return null
    expect(BRIDGE_CARD_SRC).toContain('"idle"');
    expect(BRIDGE_CARD_SRC).toContain("return null");
  });
});

// =============================================================================
// PROVA 7 — PlanPage reseta bridge state em novo ciclo
// =============================================================================
describe("P12 PROVA 7 — PlanPage reseta bridge state quando plan muda", () => {
  it("useEffect reseta bridgeSendStatus para idle", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain('setBridgeSendStatus("idle")');
  });

  it("useEffect reseta bridgeSendResult para null", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("setBridgeSendResult(null)");
  });

  it("useEffect reseta bridgeSendError para null", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("setBridgeSendError(null)");
  });
});

// =============================================================================
// PROVA 8 — sendBridge retorna shape correto
// =============================================================================
describe("P12 PROVA 8 — sendBridge retorna ResponseEnvelope shape", () => {
  it("sendBridge endpoint existe e é exportável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.sendBridge).toBe("function");
  });

  it("sendBridge está exportado via api/index.js", () => {
    expect(API_INDEX_SRC).toContain("sendBridge");
    expect(API_INDEX_SRC).toContain("bridge.js");
  });
});

// =============================================================================
// PROVA 9 — ERROR_CODES inclui BRIDGE_SEND_FAILURE
// =============================================================================
describe("P12 PROVA 9 — ERROR_CODES inclui BRIDGE_SEND_FAILURE", () => {
  it("BRIDGE_SEND_FAILURE está definido em ERROR_CODES", async () => {
    const { ERROR_CODES } = await import("../api/errors.js");
    expect(ERROR_CODES.BRIDGE_SEND_FAILURE).toBe("BRIDGE_SEND_FAILURE");
  });
});

// =============================================================================
// PROVA 10 — Nenhum desvio para P13+ no painel
// =============================================================================
describe("P12 PROVA 10 — Escopo fechado: sem desvio para P13+ ou execução ampla", () => {
  it("PlanPage NÃO importa fetchExecution", () => {
    expect(PLAN_PAGE_SRC).not.toContain("fetchExecution");
  });

  it("bridge.js endpoint NÃO contém timeline, observability ou execution ampla", () => {
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("timeline");
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("observability");
    expect(BRIDGE_ENDPOINT_SRC).not.toContain("fetchExecution");
  });

  it("sendBridge is the original P12 export; fetchBridgeStatus is P14 addition", () => {
    // P12 introduced sendBridge; P14 adds fetchBridgeStatus — both are legitimate
    expect(BRIDGE_ENDPOINT_SRC).toContain("export async function sendBridge");
    expect(BRIDGE_ENDPOINT_SRC).toContain("export async function fetchBridgeStatus");
    const exports = BRIDGE_ENDPOINT_SRC.match(/export\s+(async\s+)?function\s+\w+/g) || [];
    expect(exports.length).toBe(2);
  });
});
