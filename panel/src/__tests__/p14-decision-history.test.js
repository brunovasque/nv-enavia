// =============================================================================
// ENAVIA Panel — P14 Decision History panel-only smoke tests
//
// Cobre o contrato P14 (escopo painel — integração de decisão):
//   1. postDecision existe e é exportada pela API pública
//   2. postDecision retorna ok=true em mock mode (aprovação com bridge_id)
//   3. postDecision retorna ok=true em mock mode (rejeição com bridge_id)
//   4. postDecision retorna ok=false quando bridge_id está ausente (guarda hard)
//   5. postDecision retorna ok=false quando bridge_id é null
//   6. PlanPage importa postDecision da API pública
//   7. PlanPage chama postDecision após sendBridge com bridge_id real (aprovação)
//   8. PlanPage garda a rejeição: postDecision só é chamado se bridge_id existe
//   9. Rejeição pré-bridge: PlanPage NÃO chama postDecision sem bridge_id
//  10. Panel-only: PlanPage não toca nv-enavia.js
//  11. Panel-only: execution.js não toca nv-enavia.js
//  12. postDecision shape de retorno contém p14_valid=true em mock mode
//  13. postDecision é não-bloqueante (fire-and-forget após sendBridge)
//  14. P11/P12/P13 intactos: GateCard ainda tem onApprove/onReject; BridgeCard tem P13
//
// Escopo: panel-only. Sem leitura de nv-enavia.js.
//
// Run with:
//   npm test   (from panel/)
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Source text helpers ──────────────────────────────────────────────────────
const PLAN_PAGE_SRC = readFileSync(
  resolve(import.meta.dirname, "../pages/PlanPage.jsx"),
  "utf8"
);
const EXECUTION_ENDPOINT_SRC = readFileSync(
  resolve(import.meta.dirname, "../api/endpoints/execution.js"),
  "utf8"
);
const API_INDEX_SRC = readFileSync(
  resolve(import.meta.dirname, "../api/index.js"),
  "utf8"
);
const GATE_CARD_SRC = readFileSync(
  resolve(import.meta.dirname, "../plan/GateCard.jsx"),
  "utf8"
);
const BRIDGE_CARD_SRC = readFileSync(
  resolve(import.meta.dirname, "../plan/BridgeCard.jsx"),
  "utf8"
);

afterEach(() => {
  vi.resetModules();
});

// =============================================================================
// PROVA 1 — postDecision existe e é exportada pela API pública
// =============================================================================
describe("P14-DH PROVA 1 — postDecision exportada pela API pública", () => {
  it("api/index.js exporta postDecision", () => {
    expect(API_INDEX_SRC).toContain("postDecision");
    expect(API_INDEX_SRC).toMatch(/export.*postDecision.*from.*endpoints\/execution/);
  });

  it("postDecision existe como função no módulo importado", async () => {
    const mod = await import("../api/index.js");
    expect(typeof mod.postDecision).toBe("function");
  });
});

// =============================================================================
// PROVA 2 — postDecision retorna ok=true em mock mode (aprovação com bridge_id)
// =============================================================================
describe("P14-DH PROVA 2 — postDecision: aprovação com bridge_id real em mock mode", () => {
  it("retorna ok=true e p14_valid=true para approved+bridge_id", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "approved", bridge_id: "bridge-real-abc123" });
    expect(res.ok).toBe(true);
    expect(res.data.p14_valid).toBe(true);
    expect(res.data.decision.decision).toBe("approved");
    expect(res.data.decision.bridge_id).toBe("bridge-real-abc123");
  });

  it("registro contém todos os campos P14 canônicos", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "approved", bridge_id: "bridge-xyz" });
    const rec = res.data.decision;
    expect(typeof rec.decision_id).toBe("string");
    expect(rec.decision_id.length).toBeGreaterThan(0);
    expect(typeof rec.decided_at).toBe("string");
    expect(!isNaN(new Date(rec.decided_at).getTime())).toBe(true);
    expect(rec.decided_by).toBe("human");
    expect(rec.bridge_id).toBe("bridge-xyz");
    expect(typeof res.meta.durationMs).toBe("number");
  });
});

// =============================================================================
// PROVA 3 — postDecision retorna ok=true em mock mode (rejeição com bridge_id)
// =============================================================================
describe("P14-DH PROVA 3 — postDecision: rejeição pós-bridge com bridge_id real", () => {
  it("retorna ok=true e p14_valid=true para rejected+bridge_id", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "rejected", bridge_id: "bridge-real-def456" });
    expect(res.ok).toBe(true);
    expect(res.data.p14_valid).toBe(true);
    expect(res.data.decision.decision).toBe("rejected");
    expect(res.data.decision.bridge_id).toBe("bridge-real-def456");
  });

  it("registro de rejeição pós-bridge nunca tem bridge_id null", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "rejected", bridge_id: "bridge-real-def456" });
    expect(res.data.decision.bridge_id).not.toBeNull();
    expect(res.data.decision.bridge_id.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PROVA 4 — postDecision retorna ok=false quando bridge_id está ausente (guarda)
// =============================================================================
describe("P14-DH PROVA 4 — postDecision: bridge_id ausente → ok=false (guarda hard)", () => {
  it("retorna ok=false quando bridge_id está ausente", async () => {
    const { postDecision } = await import("../api/index.js");
    // @ts-expect-error — deliberate contract violation for guard test
    const res = await postDecision({ decision: "approved" });
    expect(res.ok).toBe(false);
    expect(typeof res.error.message).toBe("string");
    expect(res.error.message).toContain("bridge_id");
  });

  it("guarda existe no código fonte do endpoint", () => {
    expect(EXECUTION_ENDPOINT_SRC).toContain("bridge_id ausente");
    expect(EXECUTION_ENDPOINT_SRC).toContain("bridge_id");
    // Guard checks bridge_id before any network call
    expect(EXECUTION_ENDPOINT_SRC).toMatch(/if.*!bridge_id.*typeof bridge_id/);
  });
});

// =============================================================================
// PROVA 5 — postDecision retorna ok=false quando bridge_id é null
// =============================================================================
describe("P14-DH PROVA 5 — postDecision: bridge_id null → ok=false", () => {
  it("retorna ok=false quando bridge_id é null", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "rejected", bridge_id: null });
    expect(res.ok).toBe(false);
  });

  it("retorna ok=false quando bridge_id é string vazia", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "rejected", bridge_id: "" });
    expect(res.ok).toBe(false);
  });
});

// =============================================================================
// PROVA 6 — PlanPage importa postDecision da API pública
// =============================================================================
describe("P14-DH PROVA 6 — PlanPage importa postDecision da API pública", () => {
  it("PlanPage importa postDecision de ../api", () => {
    expect(PLAN_PAGE_SRC).toContain("postDecision");
    expect(PLAN_PAGE_SRC).toMatch(/import.*postDecision.*from.*["']\.\.\/api["']/);
  });
});

// =============================================================================
// PROVA 7 — PlanPage chama postDecision após sendBridge com bridge_id (aprovação)
// =============================================================================
describe("P14-DH PROVA 7 — PlanPage chama postDecision após bridge aprovado", () => {
  it("PlanPage chama postDecision com decision=approved após sendBridge bem-sucedido", () => {
    expect(PLAN_PAGE_SRC).toContain("postDecision({ decision: \"approved\", bridge_id: bridgeId })");
  });

  it("PlanPage extrai bridgeId de result.data?.bridge_id antes de chamar postDecision", () => {
    expect(PLAN_PAGE_SRC).toContain("result.data?.bridge_id");
  });

  it("PlanPage garda o bridge_id antes de chamar postDecision (não chama com undefined)", () => {
    expect(PLAN_PAGE_SRC).toContain("if (bridgeId && typeof bridgeId === \"string\")");
  });

  it("postDecision é fire-and-forget após sendBridge (não bloqueia UX)", () => {
    // Fire-and-forget pattern: .catch() but no await at the UI level
    expect(PLAN_PAGE_SRC).toContain(".catch(() => {/* non-blocking */})");
  });
});

// =============================================================================
// PROVA 8 — PlanPage: rejeição com bridge_id chama postDecision
// =============================================================================
describe("P14-DH PROVA 8 — PlanPage: rejeição com bridge_id chama postDecision", () => {
  it("handleGateReject verifica bridgeSendResult?.bridge_id antes de chamar postDecision", () => {
    expect(PLAN_PAGE_SRC).toContain("bridgeSendResult?.bridge_id");
    expect(PLAN_PAGE_SRC).toContain("postDecision({ decision: \"rejected\", bridge_id: bridgeId })");
  });
});

// =============================================================================
// PROVA 9 — PlanPage: rejeição pré-bridge NÃO chama postDecision
// =============================================================================
describe("P14-DH PROVA 9 — PlanPage: rejeição pré-bridge NÃO chama persistência P14", () => {
  it("handleGateReject só chama postDecision quando bridge_id existe", () => {
    // Guard: only calls postDecision when bridgeId is a valid non-empty string
    expect(PLAN_PAGE_SRC).toContain("if (bridgeId && typeof bridgeId === \"string\")");
  });

  it("PlanPage NÃO chama postDecision({ decision: 'rejected', bridge_id: null })", () => {
    // Ensures the null bridge_id pattern is never in source code
    expect(PLAN_PAGE_SRC).not.toContain("bridge_id: null");
    expect(PLAN_PAGE_SRC).not.toContain("bridge_id: undefined");
  });
});

// =============================================================================
// PROVA 10 — Panel-only: PlanPage não importa nv-enavia.js
// =============================================================================
describe("P14-DH PROVA 10 — Panel-only: PlanPage não toca nv-enavia.js", () => {
  it("PlanPage não importa nv-enavia", () => {
    expect(PLAN_PAGE_SRC).not.toContain("nv-enavia");
  });
});

// =============================================================================
// PROVA 11 — Panel-only: execution endpoint não toca nv-enavia.js
// =============================================================================
describe("P14-DH PROVA 11 — Panel-only: execution.js não toca nv-enavia.js", () => {
  it("execution.js não importa nv-enavia", () => {
    expect(EXECUTION_ENDPOINT_SRC).not.toContain("nv-enavia");
  });
});

// =============================================================================
// PROVA 12 — postDecision shape em mock mode tem p14_valid=true
// =============================================================================
describe("P14-DH PROVA 12 — postDecision shape em mock mode", () => {
  it("response.data.ok é true em mock mode", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "approved", bridge_id: "bridge-abc" });
    expect(res.data.ok).toBe(true);
  });

  it("response.data.p14_valid é true em mock mode", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "approved", bridge_id: "bridge-abc" });
    expect(res.data.p14_valid).toBe(true);
  });

  it("response.data.timestamp é número em mock mode", async () => {
    const { postDecision } = await import("../api/index.js");
    const res = await postDecision({ decision: "approved", bridge_id: "bridge-abc" });
    expect(typeof res.data.timestamp).toBe("number");
  });
});

// =============================================================================
// PROVA 13 — postDecision é não-bloqueante (fire-and-forget)
// =============================================================================
describe("P14-DH PROVA 13 — postDecision é fire-and-forget no fluxo de aprovação", () => {
  it("postDecision NÃO bloqueia setBridgeSendStatus (chamada independente)", () => {
    // setBridgeSendStatus("sent") é chamado ANTES de postDecision no código
    const setBridgeIdx = PLAN_PAGE_SRC.indexOf("setBridgeSendStatus(\"sent\")");
    const postDecisionIdx = PLAN_PAGE_SRC.indexOf("postDecision({ decision: \"approved\"");
    expect(setBridgeIdx).toBeGreaterThan(-1);
    expect(postDecisionIdx).toBeGreaterThan(-1);
    expect(setBridgeIdx).toBeLessThan(postDecisionIdx);
  });

  it("handleBridgeSend usa .catch() para postDecision (fire-and-forget pattern)", () => {
    expect(PLAN_PAGE_SRC).toContain(".catch(() => {/* non-blocking */})");
  });
});

// =============================================================================
// PROVA 14 — P11/P12/P13 intactos
// =============================================================================
describe("P14-DH PROVA 14 — P11/P12/P13 preservados", () => {
  it("P11: GateCard ainda exporta GATE_META com pending/approved/blocked/dispensed", () => {
    expect(GATE_CARD_SRC).toContain("export const GATE_META");
    expect(GATE_CARD_SRC).toContain("pending:");
    expect(GATE_CARD_SRC).toContain("approved:");
    expect(GATE_CARD_SRC).toContain("blocked:");
    expect(GATE_CARD_SRC).toContain("dispensed:");
  });

  it("P11: GateCard ainda tem botões Aprovar/Rejeitar", () => {
    expect(GATE_CARD_SRC).toContain("Aprovar");
    expect(GATE_CARD_SRC).toContain("Rejeitar");
  });

  it("P12: PlanPage ainda chama sendBridge após aprovação do gate", () => {
    expect(PLAN_PAGE_SRC).toContain("sendBridge");
    expect(PLAN_PAGE_SRC).toContain("handleBridgeSend");
  });

  it("P13: BridgeCard ainda tem deriveDispatchOutcome e DispatchOutcome", () => {
    expect(BRIDGE_CARD_SRC).toContain("function deriveDispatchOutcome");
    expect(BRIDGE_CARD_SRC).toContain("function DispatchOutcome");
  });

  it("P14-tracking: BridgeCard ainda tem deriveTrackingStatus e OperationalTracking", () => {
    expect(BRIDGE_CARD_SRC).toContain("function deriveTrackingStatus");
    expect(BRIDGE_CARD_SRC).toContain("function OperationalTracking");
  });

  it("P14-tracking: PlanPage ainda tem handleRefreshTracking e fetchBridgeStatus", () => {
    expect(PLAN_PAGE_SRC).toContain("handleRefreshTracking");
    expect(PLAN_PAGE_SRC).toContain("fetchBridgeStatus");
  });

  it("nv-enavia.js não foi tocado (panel-only)", () => {
    // This test verifies no imports from nv-enavia.js exist in panel files
    expect(PLAN_PAGE_SRC).not.toContain("nv-enavia");
    expect(EXECUTION_ENDPOINT_SRC).not.toContain("nv-enavia");
    expect(BRIDGE_CARD_SRC).not.toContain("nv-enavia");
    expect(GATE_CARD_SRC).not.toContain("nv-enavia");
  });
});
