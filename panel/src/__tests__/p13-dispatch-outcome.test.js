// =============================================================================
// ENAVIA Panel — P13 dispatch outcome panel-only smoke tests
//
// Cobre o contrato P13 (escopo painel):
//   1. deriveDispatchOutcome retorna dispatch_accepted quando executor_response.ok === true
//   2. deriveDispatchOutcome retorna dispatch_error quando executor_response.ok !== true
//   3. deriveDispatchOutcome retorna dispatch_missing quando executor_response é null/undefined
//   4. deriveDispatchOutcome extrai execution_status de resposta aceita
//   5. deriveDispatchOutcome extrai mensagem de erro de resposta com falha
//   6. DispatchOutcome NÃO renderiza quando sendStatus !== "sent"
//   7. DispatchOutcome renderiza após bridge enviada com executor_response válida
//   8. DISPATCH_STATUS enum é consistente com DISPATCH_META
//   9. BridgeCard aceita e repassa props para DispatchOutcome
//  10. Escopo fechado: sem timeline, polling, observabilidade ou P14+
//
// Escopo: apenas código de painel — sem leitura de nv-enavia.js.
//
// Run with:
//   npm test   (from panel/)
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Source text helpers ──────────────────────────────────────────────────────
const BRIDGE_CARD_SRC = readFileSync(
  resolve(import.meta.dirname, "../plan/BridgeCard.jsx"),
  "utf8"
);

// ── Import deriveDispatchOutcome and DISPATCH_STATUS ─────────────────────────
import {
  deriveDispatchOutcome,
  DISPATCH_STATUS,
} from "../plan/BridgeCard.jsx";

// =============================================================================
// PROVA 1 — dispatch_accepted quando executor_response.ok === true
// =============================================================================
describe("P13 PROVA 1 — deriveDispatchOutcome: executor_response.ok === true → dispatch_accepted", () => {
  it("retorna dispatch_accepted para executor_response.ok = true", () => {
    const result = deriveDispatchOutcome({ ok: true });
    expect(result.status).toBe(DISPATCH_STATUS.ACCEPTED);
  });

  it("retorna dispatch_accepted com execution_status quando presente", () => {
    const result = deriveDispatchOutcome({ ok: true, execution_status: "running" });
    expect(result.status).toBe(DISPATCH_STATUS.ACCEPTED);
    expect(result.detail).toBe("running");
  });

  it("retorna dispatch_accepted com detail=null quando execution_status ausente", () => {
    const result = deriveDispatchOutcome({ ok: true });
    expect(result.status).toBe(DISPATCH_STATUS.ACCEPTED);
    expect(result.detail).toBeNull();
  });
});

// =============================================================================
// PROVA 2 — dispatch_error quando executor_response.ok !== true
// =============================================================================
describe("P13 PROVA 2 — deriveDispatchOutcome: executor_response.ok !== true → dispatch_error", () => {
  it("retorna dispatch_error para ok = false", () => {
    const result = deriveDispatchOutcome({ ok: false, error: "EXECUTION_FAILED" });
    expect(result.status).toBe(DISPATCH_STATUS.ERROR);
  });

  it("retorna dispatch_error para ok ausente (resposta sem campo ok)", () => {
    const result = deriveDispatchOutcome({ error: "SOME_ERROR" });
    expect(result.status).toBe(DISPATCH_STATUS.ERROR);
  });

  it("extrai error string como detail", () => {
    const result = deriveDispatchOutcome({ ok: false, error: "MY_ERROR" });
    expect(result.detail).toBe("MY_ERROR");
  });

  it("extrai message string como detail quando error ausente", () => {
    const result = deriveDispatchOutcome({ ok: false, message: "Something went wrong" });
    expect(result.detail).toBe("Something went wrong");
  });
});

// =============================================================================
// PROVA 3 — dispatch_missing quando executor_response é null/undefined
// =============================================================================
describe("P13 PROVA 3 — deriveDispatchOutcome: null/undefined → dispatch_missing", () => {
  it("retorna dispatch_missing para null", () => {
    const result = deriveDispatchOutcome(null);
    expect(result.status).toBe(DISPATCH_STATUS.MISSING);
    expect(result.detail).toBeNull();
  });

  it("retorna dispatch_missing para undefined", () => {
    const result = deriveDispatchOutcome(undefined);
    expect(result.status).toBe(DISPATCH_STATUS.MISSING);
    expect(result.detail).toBeNull();
  });

  it("retorna dispatch_missing para non-object", () => {
    const result = deriveDispatchOutcome("string");
    expect(result.status).toBe(DISPATCH_STATUS.MISSING);
  });
});

// =============================================================================
// PROVA 4 — execution_status é extraído quando resposta aceita
// =============================================================================
describe("P13 PROVA 4 — deriveDispatchOutcome preserva execution_status do executor", () => {
  it("detail reflete execution_status 'success'", () => {
    const result = deriveDispatchOutcome({ ok: true, execution_status: "success" });
    expect(result.detail).toBe("success");
  });

  it("detail reflete execution_status 'failed'", () => {
    const result = deriveDispatchOutcome({ ok: true, execution_status: "failed" });
    expect(result.detail).toBe("failed");
  });

  it("detail reflete execution_status 'running'", () => {
    const result = deriveDispatchOutcome({ ok: true, execution_status: "running" });
    expect(result.detail).toBe("running");
  });
});

// =============================================================================
// PROVA 5 — mensagem de erro é extraída quando falha
// =============================================================================
describe("P13 PROVA 5 — deriveDispatchOutcome extrai erro de resposta falha", () => {
  it("extrai campo error como detail", () => {
    const result = deriveDispatchOutcome({ ok: false, error: "BINDING_MISSING" });
    expect(result.detail).toBe("BINDING_MISSING");
  });

  it("extrai campo message como fallback", () => {
    const result = deriveDispatchOutcome({ ok: false, message: "Timeout do executor" });
    expect(result.detail).toBe("Timeout do executor");
  });

  it("detail é null quando nenhum campo de erro presente", () => {
    const result = deriveDispatchOutcome({ ok: false });
    expect(result.detail).toBeNull();
  });
});

// =============================================================================
// PROVA 6 — DispatchOutcome NÃO renderiza quando sendStatus !== "sent"
// =============================================================================
describe("P13 PROVA 6 — DispatchOutcome não renderiza antes de bridge enviada", () => {
  it("DispatchOutcome verifica sendStatus antes de renderizar", () => {
    expect(BRIDGE_CARD_SRC).toContain('sendStatus !== "sent"');
    expect(BRIDGE_CARD_SRC).toContain("return null");
  });

  it("DispatchOutcome verifica sendResult antes de renderizar", () => {
    // Must check both sendStatus and sendResult
    expect(BRIDGE_CARD_SRC).toContain("!sendResult");
  });
});

// =============================================================================
// PROVA 7 — DispatchOutcome renderiza com executor_response válida
// =============================================================================
describe("P13 PROVA 7 — DispatchOutcome renderiza estado pós-disparo", () => {
  it("DispatchOutcome usa deriveDispatchOutcome para interpretar executor_response", () => {
    expect(BRIDGE_CARD_SRC).toContain("deriveDispatchOutcome");
    expect(BRIDGE_CARD_SRC).toContain("sendResult.executor_response");
  });

  it("DispatchOutcome tem role=status e aria-live=polite", () => {
    // At least two status regions (BridgeSendStatus + DispatchOutcome)
    const statusMatches = BRIDGE_CARD_SRC.match(/role="status"/g) || [];
    expect(statusMatches.length).toBeGreaterThanOrEqual(2);
    const ariaMatches = BRIDGE_CARD_SRC.match(/aria-live="polite"/g) || [];
    expect(ariaMatches.length).toBeGreaterThanOrEqual(2);
  });

  it("DispatchOutcome exibe detail quando presente", () => {
    expect(BRIDGE_CARD_SRC).toContain("{detail &&");
  });
});

// =============================================================================
// PROVA 8 — DISPATCH_STATUS enum é consistente
// =============================================================================
describe("P13 PROVA 8 — DISPATCH_STATUS enum integrity", () => {
  it("DISPATCH_STATUS contém ACCEPTED", () => {
    expect(DISPATCH_STATUS.ACCEPTED).toBe("dispatch_accepted");
  });

  it("DISPATCH_STATUS contém ERROR", () => {
    expect(DISPATCH_STATUS.ERROR).toBe("dispatch_error");
  });

  it("DISPATCH_STATUS contém MISSING", () => {
    expect(DISPATCH_STATUS.MISSING).toBe("dispatch_missing");
  });

  it("DISPATCH_META cobre todos os DISPATCH_STATUS", () => {
    // Verify via source that DISPATCH_META has entries for all statuses
    expect(BRIDGE_CARD_SRC).toContain("[DISPATCH_STATUS.ACCEPTED]");
    expect(BRIDGE_CARD_SRC).toContain("[DISPATCH_STATUS.ERROR]");
    expect(BRIDGE_CARD_SRC).toContain("[DISPATCH_STATUS.MISSING]");
  });
});

// =============================================================================
// PROVA 9 — BridgeCard repassa props para DispatchOutcome
// =============================================================================
describe("P13 PROVA 9 — BridgeCard renderiza DispatchOutcome", () => {
  it("BridgeCard inclui DispatchOutcome na árvore de render", () => {
    expect(BRIDGE_CARD_SRC).toContain("<DispatchOutcome");
  });

  it("BridgeCard passa sendStatus para DispatchOutcome", () => {
    expect(BRIDGE_CARD_SRC).toMatch(/DispatchOutcome[\s\S]*?sendStatus=/);
  });

  it("BridgeCard passa sendResult para DispatchOutcome", () => {
    expect(BRIDGE_CARD_SRC).toMatch(/DispatchOutcome[\s\S]*?sendResult=/);
  });
});

// =============================================================================
// PROVA 10 — Escopo fechado: sem desvio para P14+
// =============================================================================
describe("P13 PROVA 10 — Escopo fechado: sem timeline, polling ou P14+", () => {
  it("BridgeCard NÃO contém timeline", () => {
    expect(BRIDGE_CARD_SRC.toLowerCase()).not.toContain("timeline");
  });

  it("BridgeCard NÃO contém polling ou setInterval", () => {
    expect(BRIDGE_CARD_SRC).not.toContain("setInterval");
    expect(BRIDGE_CARD_SRC).not.toContain("polling");
  });

  it("BridgeCard NÃO importa fetchExecution", () => {
    expect(BRIDGE_CARD_SRC).not.toContain("fetchExecution");
  });

  it("BridgeCard NÃO contém observability", () => {
    expect(BRIDGE_CARD_SRC.toLowerCase()).not.toContain("observability");
  });

  it("deriveDispatchOutcome é função pura — sem side effects", () => {
    // Call it multiple times, same input = same output (deterministic)
    const r1 = deriveDispatchOutcome({ ok: true, execution_status: "running" });
    const r2 = deriveDispatchOutcome({ ok: true, execution_status: "running" });
    expect(r1.status).toBe(r2.status);
    expect(r1.detail).toBe(r2.detail);
  });

  it("deriveDispatchOutcome NÃO faz fetch, I/O ou efeito colateral", () => {
    // Source inspection: no fetch, no await, no import of network modules
    const fnSrc = deriveDispatchOutcome.toString();
    expect(fnSrc).not.toContain("fetch(");
    expect(fnSrc).not.toContain("await ");
  });
});
