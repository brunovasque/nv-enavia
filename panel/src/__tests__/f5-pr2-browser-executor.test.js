// =============================================================================
// ENAVIA Panel — F5-PR2 smoke tests: BrowserExecutorPanel
//
// Originally tested the demo/explanatory panel. Updated in P25-PR3 to test
// the real session panel. The mock data shape tests remain unchanged for
// backward compatibility.
//
// Updated acceptance criteria (P25-PR3):
//   1. BrowserExecutorPanel renderiza sem crash (estado idle)
//   6. Estado idle exibe mensagem de standby honesta
//   7. Estado idle exibe domínio operacional run.nv-imoveis.com/*
//  16. Referência ao noVNC é visível
//  17. Browser Executor é visível no título
//  19. Sem regressão F5-PR1 — OperationalLiveCard não é afetado
//  20. Sem regressão P18 — mockMemory não é afetado
//  21-24. mockBrowserSession shape tests (unchanged)
// =============================================================================

import { describe, it, expect, vi } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// ── Mock the useBrowserSession hook for SSR tests ──────────────────────────
vi.mock("../browser/useBrowserSession", () => ({
  useBrowserSession: () => ({
    session: {
      active: false,
      sessionStatus: "sem_sessao",
      sessionId: null,
      operationalDomain: "run.nv-imoveis.com",
      currentAction: null,
      currentTarget: null,
      currentUrl: null,
      evidence: null,
      error: null,
      lastActionTs: null,
      raw: null,
    },
    loading: false,
    error: null,
    refresh: () => {},
    lastUpdated: "2026-04-14T00:00:00Z",
  }),
  BROWSER_SESSION_STATUS: {
    SEM_SESSAO: "sem_sessao",
    NAVEGANDO: "navegando",
    AGINDO: "agindo",
    AGUARDANDO: "aguardando",
    BLOQUEADO: "bloqueado",
    CONCLUIDO: "concluido",
    ERRO: "erro",
  },
}));

import BrowserExecutorPanel from "../browser/BrowserExecutorPanel.jsx";
import {
  MOCK_BROWSER_SESSIONS,
  BROWSER_STATUS,
  BROWSER_OPERATIONAL_DOMAIN,
  BROWSER_STEP_STATUS,
} from "../browser/mockBrowserSession.js";

// ── Render helper ──────────────────────────────────────────────────────────

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

  it("17. título do painel contém Browser Executor", () => {
    const html = renderPanel();
    expect(html).toContain("Browser Executor");
  });

  it("17. painel mostra 'Painel Real' (P25-PR3 — sessão real)", () => {
    const html = renderPanel();
    expect(html).toContain("Painel Real");
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
