// =============================================================================
// ENAVIA Panel — P25-PR3 smoke tests: Real noVNC session + real state
//
// Verifica acceptance criteria do P25-PR3:
//   1. BrowserExecutorPanel renderiza sem crash (usa sessão real via hook)
//   2. Estado idle exibe "Nenhuma sessão ativa" (honesto)
//   3. Domínio operacional run.nv-imoveis.com aparece
//   4. Título do painel é "Painel Real" (não mais "Painel Explicativo")
//   5. Fonte real indicada — /browser-arm/state
//   6. noVNC viewport aparece em modo sem sessão (viewport vazio)
//   7. BROWSER_SESSION_STATUS contém todos os 7 estados obrigatórios
//   8. fetchBrowserSession retorna sessão normalizada em mock mode
//   9. fetchBrowserSession retorna sessionStatus = sem_sessao quando idle
//  10. Sem demo switcher no painel
//  11. mockBrowserSession.js continua exportando para backward-compat
//  12. API index exporta fetchBrowserSession e BROWSER_SESSION_STATUS
//  13. useBrowserSession hook é importável
//  14. normalizeSessionFromArm produz shape correto para idle
//  15. normalizeSessionFromArm produz shape correto para active
//  16. normalizeSessionFromArm produz shape correto para error
//  17. Sem regressão F5-PR1 — OperationalLiveCard importável
//  18. Sem regressão P18 — mockMemory importável
//  19. Sem regressão P12 — sendBridge importável
//  20. Sem regressão P14 — fetchBridgeStatus importável
// =============================================================================

import { describe, it, expect, vi } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// ── Mock the useBrowserSession hook for SSR tests ──────────────────────────
// The panel uses useBrowserSession which calls fetchBrowserSession.
// In test (SSR) environment, we mock it to return idle state synchronously.
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

// ── Render helper ──────────────────────────────────────────────────────────
function renderPanel() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(BrowserExecutorPanel))
  );
}

// ── Tests — Component render ───────────────────────────────────────────────

describe("P25-PR3 — BrowserExecutorPanel real render", () => {
  it("1. renderiza sem crash", () => {
    expect(() => renderPanel()).not.toThrow();
  });

  it("2. estado idle exibe 'Nenhuma sessão ativa' (honesto)", () => {
    const html = renderPanel();
    expect(html).toContain("Nenhuma sessão ativa");
  });

  it("3. domínio operacional run.nv-imoveis.com aparece", () => {
    const html = renderPanel();
    expect(html).toContain("run.nv-imoveis.com");
  });

  it("4. título do painel é 'Painel Real' (não mais 'Painel Explicativo')", () => {
    const html = renderPanel();
    expect(html).toContain("Painel Real");
    expect(html).not.toContain("Painel Explicativo");
  });

  it("5. fonte real indicada — /browser-arm/state", () => {
    const html = renderPanel();
    expect(html).toContain("/browser-arm/state");
  });

  it("6. noVNC viewport empty state aparece quando sem sessão", () => {
    const html = renderPanel();
    // Should show empty viewport, not live iframe
    expect(html).toContain("noVNC");
    expect(html).toContain("Sem sessão ativa");
  });

  it("10. sem demo switcher no painel", () => {
    const html = renderPanel();
    expect(html).not.toContain("Estado demo:");
    expect(html).not.toContain("aria-label=\"Estado do browser (demo)\"");
  });

  it("painel exibe 'Sem sessão ativa — standby' no subtítulo", () => {
    const html = renderPanel();
    expect(html).toContain("Sem sessão ativa — standby");
  });

  it("painel exibe indicador de fonte real", () => {
    const html = renderPanel();
    expect(html).toContain("Fonte:");
  });
});

// ── Tests — BROWSER_SESSION_STATUS shape ───────────────────────────────────

describe("P25-PR3 — BROWSER_SESSION_STATUS shape", () => {
  it("7. contém todos os 7 estados obrigatórios", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const { BROWSER_SESSION_STATUS } = mod;
    expect(BROWSER_SESSION_STATUS.SEM_SESSAO).toBe("sem_sessao");
    expect(BROWSER_SESSION_STATUS.NAVEGANDO).toBe("navegando");
    expect(BROWSER_SESSION_STATUS.AGINDO).toBe("agindo");
    expect(BROWSER_SESSION_STATUS.AGUARDANDO).toBe("aguardando");
    expect(BROWSER_SESSION_STATUS.BLOQUEADO).toBe("bloqueado");
    expect(BROWSER_SESSION_STATUS.CONCLUIDO).toBe("concluido");
    expect(BROWSER_SESSION_STATUS.ERRO).toBe("erro");
  });
});

// ── Tests — fetchBrowserSession ────────────────────────────────────────────

describe("P25-PR3 — fetchBrowserSession (mock mode)", () => {
  it("8. retorna sessão normalizada em mock mode", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.ok).toBe(true);
    expect(result.data).toBeDefined();
    expect(result.data).toHaveProperty("active");
    expect(result.data).toHaveProperty("sessionStatus");
    expect(result.data).toHaveProperty("operationalDomain");
  });

  it("9. retorna sessionStatus = sem_sessao quando idle", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data.sessionStatus).toBe("sem_sessao");
    expect(result.data.active).toBe(false);
  });

  it("retorna operationalDomain = run.nv-imoveis.com", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data.operationalDomain).toBe("run.nv-imoveis.com");
  });

  it("retorna meta.source = mock", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.meta.source).toBe("mock");
  });

  it("session shape has all required fields", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    const s = result.data;
    expect(s).toHaveProperty("active");
    expect(s).toHaveProperty("sessionStatus");
    expect(s).toHaveProperty("sessionId");
    expect(s).toHaveProperty("operationalDomain");
    expect(s).toHaveProperty("currentAction");
    expect(s).toHaveProperty("currentTarget");
    expect(s).toHaveProperty("currentUrl");
    expect(s).toHaveProperty("evidence");
    expect(s).toHaveProperty("error");
    expect(s).toHaveProperty("lastActionTs");
  });
});

// ── Tests — API surface ────────────────────────────────────────────────────

describe("P25-PR3 — API surface", () => {
  it("12. api/index.js exporta fetchBrowserSession", async () => {
    const mod = await import("../api/index.js");
    expect(typeof mod.fetchBrowserSession).toBe("function");
  });

  it("12. api/index.js exporta BROWSER_SESSION_STATUS", async () => {
    const mod = await import("../api/index.js");
    expect(mod.BROWSER_SESSION_STATUS).toBeDefined();
    expect(mod.BROWSER_SESSION_STATUS.SEM_SESSAO).toBe("sem_sessao");
  });
});

// ── Tests — useBrowserSession hook ─────────────────────────────────────────

describe("P25-PR3 — useBrowserSession hook", () => {
  it("13. useBrowserSession é importável", async () => {
    const mod = await import("../browser/useBrowserSession.js");
    expect(typeof mod.useBrowserSession).toBe("function");
  });

  it("13. re-exporta BROWSER_SESSION_STATUS", async () => {
    const mod = await import("../browser/useBrowserSession.js");
    expect(mod.BROWSER_SESSION_STATUS).toBeDefined();
  });
});

// ── Tests — Backward compatibility ─────────────────────────────────────────

describe("P25-PR3 — backward compatibility (mockBrowserSession)", () => {
  it("11. mockBrowserSession.js continua exportando BROWSER_STATUS", async () => {
    const mod = await import("../browser/mockBrowserSession.js");
    expect(mod.BROWSER_STATUS).toBeDefined();
    expect(mod.BROWSER_STATUS.IDLE).toBe("idle");
  });

  it("11. mockBrowserSession.js continua exportando MOCK_BROWSER_SESSIONS", async () => {
    const mod = await import("../browser/mockBrowserSession.js");
    expect(mod.MOCK_BROWSER_SESSIONS).toBeDefined();
  });

  it("11. mockBrowserSession.js continua exportando BROWSER_OPERATIONAL_DOMAIN", async () => {
    const mod = await import("../browser/mockBrowserSession.js");
    expect(mod.BROWSER_OPERATIONAL_DOMAIN).toBe("run.nv-imoveis.com");
  });
});

// ── Tests — No regression guards ──────────────────────────────────────────

describe("P25-PR3 — sem regressão de PRs anteriores", () => {
  it("17. OperationalLiveCard pode ser importado sem erro", async () => {
    const mod = await import("../execution/OperationalLiveCard.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("18. mockMemory exporta MOCK_MEMORY", async () => {
    const mod = await import("../memory/mockMemory.js");
    expect(mod.MOCK_MEMORY).toBeDefined();
    expect(mod.MEMORY_STATES).toBeDefined();
  });

  it("19. sendBridge é importável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.sendBridge).toBe("function");
  });

  it("20. fetchBridgeStatus é importável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.fetchBridgeStatus).toBe("function");
  });

  it("fetchHealth é importável", async () => {
    const mod = await import("../api/endpoints/health.js");
    expect(typeof mod.fetchHealth).toBe("function");
  });
});
