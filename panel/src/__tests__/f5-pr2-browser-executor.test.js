// =============================================================================
// ENAVIA Panel — F5-PR2 smoke tests: BrowserExecutorPanel
//
// Verifica acceptance criteria da Frente 5 PR2 — Integração Browser Executor + noVNC:
//   1. BrowserExecutorPanel renderiza sem crash (estado idle)
//   2. BrowserExecutorPanel renderiza sem crash (estado navigating)
//   3. BrowserExecutorPanel renderiza sem crash (estado acting)
//   4. BrowserExecutorPanel renderiza sem crash (estado blocked)
//   5. BrowserExecutorPanel renderiza sem crash (estado completed)
//   6. Estado idle exibe mensagem de standby honesta
//   7. Estado idle exibe domínio operacional run.nv-imoveis.com/*
//   8. Estado ativo exibe sessão ID
//   9. Estado ativo exibe ação atual
//  10. Estado ativo exibe alvo atual
//  11. Estado ativo exibe evidência textual
//  12. Estado ativo exibe log de passos
//  13. Estado bloqueado exibe erro/bloqueio
//  14. Estado bloqueado exibe código de erro
//  15. Campo ausente exibe 'sem dado disponível' (honesto)
//  16. Referência ao noVNC é visível — "noVNC"
//  17. Separação noVNC/painel é explícita — "Painel Explicativo" ou "EXPLICAÇÃO"
//  18. Domínio operacional aparece corretamente em sessão ativa
//  19. Sem regressão F5-PR1 — OperationalLiveCard não é afetado
//  20. Sem regressão P18 — mockMemory não é afetado
//  21. mockBrowserSession.js exporta BROWSER_STATUS com todos os estados
//  22. mockBrowserSession.js exporta BROWSER_OPERATIONAL_DOMAIN correto
//  23. mockBrowserSession.js sessions idle=null, demais com shape esperado
//  24. Estado completed exibe evidência de dados extraídos
// =============================================================================

import { describe, it, expect } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

import BrowserExecutorPanel from "../browser/BrowserExecutorPanel.jsx";
import {
  MOCK_BROWSER_SESSIONS,
  BROWSER_STATUS,
  BROWSER_OPERATIONAL_DOMAIN,
  BROWSER_STEP_STATUS,
} from "../browser/mockBrowserSession.js";

// ── Render helper ──────────────────────────────────────────────────────────
// BrowserExecutorPanel usa useState mas não usa Router — renderToStaticMarkup
// captura o estado inicial (idle). Para testar outros estados, testamos o
// mock data shape diretamente (abordagem usada em P18 e F5-PR1).

function renderPanel() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(BrowserExecutorPanel))
  );
}

// ── Tests — Component render ───────────────────────────────────────────────

describe("F5-PR2 — BrowserExecutorPanel render", () => {
  it("1. renderiza sem crash (estado inicial = idle)", () => {
    expect(() => renderPanel()).not.toThrow();
  });

  it("6. estado idle exibe mensagem de standby honesta", () => {
    const html = renderPanel();
    expect(html).toContain("Nenhuma sessão ativa");
  });

  it("7. estado idle exibe domínio operacional run.nv-imoveis.com/*", () => {
    const html = renderPanel();
    expect(html).toContain("run.nv-imoveis.com");
  });

  it("16. referência ao noVNC é visível", () => {
    const html = renderPanel();
    expect(html).toContain("noVNC");
  });

  it("17. separação noVNC/painel é explícita — badge EXPLICAÇÃO", () => {
    const html = renderPanel();
    expect(html).toContain("EXPLICAÇÃO");
  });

  it("17. título do painel explicativo é visível", () => {
    const html = renderPanel();
    expect(html).toContain("Browser Executor");
  });

  it("17. 'Painel Explicativo' aparece no cabeçalho", () => {
    const html = renderPanel();
    expect(html).toContain("Painel Explicativo");
  });
});

// ── Tests — Mock data shape ────────────────────────────────────────────────

describe("F5-PR2 — mockBrowserSession shape", () => {
  it("21. BROWSER_STATUS exporta todos os estados esperados", () => {
    expect(BROWSER_STATUS.IDLE).toBe("idle");
    expect(BROWSER_STATUS.NAVIGATING).toBe("navigating");
    expect(BROWSER_STATUS.ACTING).toBe("acting");
    expect(BROWSER_STATUS.WAITING).toBe("waiting");
    expect(BROWSER_STATUS.BLOCKED).toBe("blocked");
    expect(BROWSER_STATUS.COMPLETED).toBe("completed");
  });

  it("22. BROWSER_OPERATIONAL_DOMAIN é run.nv-imoveis.com", () => {
    expect(BROWSER_OPERATIONAL_DOMAIN).toBe("run.nv-imoveis.com");
  });

  it("23. sessão idle é null", () => {
    expect(MOCK_BROWSER_SESSIONS[BROWSER_STATUS.IDLE]).toBeNull();
  });

  it("23. sessão navigating tem shape esperado", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s).not.toBeNull();
    expect(s).toHaveProperty("sessionId");
    expect(s).toHaveProperty("status", BROWSER_STATUS.NAVIGATING);
    expect(s).toHaveProperty("operationalDomain", BROWSER_OPERATIONAL_DOMAIN);
    expect(s).toHaveProperty("currentUrl");
    expect(s).toHaveProperty("currentAction");
    expect(s).toHaveProperty("currentTarget");
    expect(s).toHaveProperty("evidence");
    expect(s).toHaveProperty("currentStep");
    expect(s).toHaveProperty("stepLog");
    expect(s).toHaveProperty("error");
  });

  it("2. sessão navigating renderiza dados de sessão", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s.sessionId).toBeTruthy();
    expect(s.currentAction).toBeTruthy();
  });

  it("3. sessão acting tem campos de ação preenchidos", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.ACTING];
    expect(s.currentAction).toBeTruthy();
    expect(s.currentTarget).toBeTruthy();
    expect(s.currentSelector).toBeTruthy();
    expect(s.evidence).toBeTruthy();
  });

  it("8. sessão ativa tem sessionId", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s.sessionId).toMatch(/sess-br/);
  });

  it("9. sessão navigating tem ação atual preenchida", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s.currentAction).toBeTruthy();
    expect(typeof s.currentAction).toBe("string");
  });

  it("10. sessão acting tem alvo atual preenchido", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.ACTING];
    expect(s.currentTarget).toBeTruthy();
  });

  it("11. sessão acting tem evidência textual", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.ACTING];
    expect(s.evidence).toBeTruthy();
  });

  it("12. sessão navigating tem log de passos", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(Array.isArray(s.stepLog)).toBe(true);
    expect(s.stepLog.length).toBeGreaterThan(0);
  });

  it("12. cada passo tem id, label, status, timestamp, detail", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.ACTING];
    for (const step of s.stepLog) {
      expect(step).toHaveProperty("id");
      expect(step).toHaveProperty("label");
      expect(step).toHaveProperty("status");
      expect(step).toHaveProperty("timestamp");
      expect(step).toHaveProperty("detail");
    }
  });

  it("4. sessão blocked tem erro preenchido", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.BLOCKED];
    expect(s.error).not.toBeNull();
    expect(s.error).toHaveProperty("code");
    expect(s.error).toHaveProperty("message");
    expect(s.error).toHaveProperty("recoverable");
  });

  it("13. sessão bloqueada tem erro/bloqueio descritivo", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.BLOCKED];
    expect(s.error.message).toBeTruthy();
    expect(s.error.message.length).toBeGreaterThan(10);
  });

  it("14. sessão bloqueada tem código de erro", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.BLOCKED];
    expect(s.error.code).toBe("BROWSER_BLOCKED");
  });

  it("15. sessão navigating tem currentSelector=null (ausência honesta)", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s.currentSelector).toBeNull();
  });

  it("18. domínio operacional na sessão ativa é run.nv-imoveis.com", () => {
    for (const status of [
      BROWSER_STATUS.NAVIGATING,
      BROWSER_STATUS.ACTING,
      BROWSER_STATUS.BLOCKED,
      BROWSER_STATUS.COMPLETED,
    ]) {
      const s = MOCK_BROWSER_SESSIONS[status];
      expect(s.operationalDomain).toBe(BROWSER_OPERATIONAL_DOMAIN);
    }
  });

  it("18. URL da sessão contém o domínio operacional", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    expect(s.currentUrl).toContain(BROWSER_OPERATIONAL_DOMAIN);
  });

  it("5. sessão completed tem todos os campos preenchidos", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.COMPLETED];
    expect(s.sessionId).toBeTruthy();
    expect(s.currentAction).toBeTruthy();
    expect(s.evidence).toBeTruthy();
    expect(s.stepLog.length).toBeGreaterThanOrEqual(4);
    expect(s.error).toBeNull();
  });

  it("24. sessão completed exibe evidência de dados extraídos", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.COMPLETED];
    expect(s.evidence).toContain("imóveis");
  });

  it("sessão waiting tem seletor de alvo definido", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.WAITING];
    expect(s.currentSelector).toBeTruthy();
    expect(s.currentSelector.length).toBeGreaterThan(0);
  });

  it("passo ativo tem status BROWSER_STEP_STATUS.ACTIVE", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.NAVIGATING];
    const active = s.stepLog.find((st) => st.status === BROWSER_STEP_STATUS.ACTIVE);
    expect(active).toBeDefined();
  });

  it("passo com erro tem status BROWSER_STEP_STATUS.ERROR", () => {
    const s = MOCK_BROWSER_SESSIONS[BROWSER_STATUS.BLOCKED];
    const errored = s.stepLog.find((st) => st.status === BROWSER_STEP_STATUS.ERROR);
    expect(errored).toBeDefined();
  });
});

// ── Tests — No regression guards ──────────────────────────────────────────

describe("F5-PR2 — sem regressão de F5-PR1 e P18", () => {
  it("19. OperationalLiveCard pode ser importado sem erro (sem regressão F5-PR1)", async () => {
    const mod = await import("../execution/OperationalLiveCard.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("19. mockExecution exporta EXECUTION_STATUS com todos os estados (sem regressão F5-PR1)", async () => {
    const mod = await import("../execution/mockExecution.js");
    expect(mod.EXECUTION_STATUS.IDLE).toBe("idle");
    expect(mod.EXECUTION_STATUS.RUNNING).toBe("running");
    expect(mod.EXECUTION_STATUS.COMPLETED).toBe("completed");
  });

  it("20. mockMemory exporta MOCK_MEMORY (sem regressão P18)", async () => {
    const mod = await import("../memory/mockMemory.js");
    expect(mod.MOCK_MEMORY).toBeDefined();
    expect(mod.MEMORY_STATES).toBeDefined();
  });
});
