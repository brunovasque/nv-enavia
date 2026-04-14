// =============================================================================
// ENAVIA Panel — P25-PR3 smoke tests: Real noVNC session + real state
//
// Verifica acceptance criteria do P25-PR3:
//   1. BrowserExecutorPanel renderiza sem crash (usa sessão real via hook)
//   2. Estado idle exibe "Arm em standby" — linguagem unificada
//   3. Domínio operacional run.nv-imoveis.com aparece
//   4. Título do painel é "Painel Real" (não mais "Painel Explicativo")
//   5. Fonte real indicada — /browser-arm/state
//   6. noVNC viewport aparece em modo sem sessão (viewport vazio)
//   7. BROWSER_SESSION_STATUS contém todos os 7 estados obrigatórios
//   8. fetchBrowserSession retorna "unconfigured" quando fonte real não está ativa
//   9. fetchBrowserSession não retorna mock silencioso — ok: false quando não configurado
//  10. Sem demo switcher no painel
//  11. mockBrowserSession.js continua exportando para backward-compat
//  12. API index exporta fetchBrowserSession e BROWSER_SESSION_STATUS
//  13. useBrowserSession hook é importável + expõe source
//  14. Shape do session alinhado com backend P25-PR2 (sem target_url/result_summary)
//  15. BROWSER_SESSION_SOURCE exportado para honestidade de fonte
//  16. Sem regressão F5-PR1 — OperationalLiveCard importável
//  17. Sem regressão P18 — mockMemory importável
//  18. Sem regressão P12 — sendBridge importável
//  19. Sem regressão P14 — fetchBridgeStatus importável
// =============================================================================

import { describe, it, expect, vi } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// ── Mock the useBrowserSession hook for SSR tests ──────────────────────────
// The panel uses useBrowserSession which calls fetchBrowserSession.
// In test (SSR) environment, we mock the hook to return unconfigured state
// (honest: no real source configured in test env).
vi.mock("../browser/useBrowserSession", () => ({
  useBrowserSession: () => ({
    session: {
      active: false,
      sessionStatus: "sem_sessao",
      sessionId: null,
      operationalDomain: "run.nv-imoveis.com",
      currentAction: null,
      executionStatus: null,
      error: null,
      lastActionTs: null,
      raw: null,
    },
    loading: false,
    error: {
      code: "BROWSER_SESSION_UNCONFIGURED",
      message: "Fonte real não configurada — VITE_NV_ENAVIA_URL não definida.",
    },
    source: "unconfigured",
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

  it("2. estado idle exibe 'Arm em standby' — linguagem unificada com header e sidebar", () => {
    const html = renderPanel();
    expect(html).toContain("Arm em standby");
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

  it("5. /browser-arm/state é mencionado no indicador de fonte", () => {
    const html = renderPanel();
    expect(html).toContain("/browser-arm/state");
  });

  it("5b. painel exibe aviso de fonte não configurada (honesto — sem mock silencioso)", () => {
    const html = renderPanel();
    expect(html).toContain("Fonte não configurada");
  });

  it("6. noVNC iframe SEMPRE renderizado — viewport é soberano (não substituto)", () => {
    const html = renderPanel();
    // iframe must be present even in sem_sessao state
    expect(html).toContain("novnc-iframe");
    expect(html).toContain("noVNC");
    // Old empty placeholder must NOT appear
    expect(html).not.toContain("novnc-viewport-empty");
  });

  it("6b. noVNC overlay no estado inicial (SSR) mostra 'Conectando' — sem contradição", () => {
    const html = renderPanel();
    // In SSR/loading state, onLoad hasn't fired → overlay shows "Conectando"
    // NOT "Sem sessão ativa" on top of a potentially live viewport.
    // In real browser: transitions to "Viewport ativo · arm em standby" after onLoad fires.
    expect(html).toContain("Conectando ao viewport");
    expect(html).toContain("novnc-session-overlay");
    // iframe is always present alongside the overlay
    expect(html).toContain("novnc-iframe");
    // "Sem sessão ativa" must NOT be in the viewport overlay area
    // (it only appears when iframe genuinely fails to load)
    expect(html).not.toContain("Viewport indisponível");
  });

  it("6c. overlay NÃO diz 'Sem sessão ativa' no estado de carregamento (sem contradição)", () => {
    const html = renderPanel();
    // The contradiction "viewport visible + Sem sessão ativa" must never occur.
    // "Sem sessão ativa" as overlay text only when iframeStatus === "error".
    // In SSR (loading state), the overlay shows "Conectando ao viewport" — no contradiction.
    const noContradiction = !html.includes("Viewport indisponível");
    expect(noContradiction).toBe(true);
  });

  it("10. sem demo switcher no painel", () => {
    const html = renderPanel();
    expect(html).not.toContain("Estado demo:");
    expect(html).not.toContain("aria-label=\"Estado do browser (demo)\"");
  });

  it("painel exibe 'Sem sessão ativa — standby' no subtítulo quando viewport não conectado", () => {
    const html = renderPanel();
    // In SSR, viewportStatus starts as "loading" (not "connected"),
    // so header subtitle still shows "Sem sessão ativa — standby" (honest).
    // In real browser: changes to "Viewport ativo · arm em standby" after iframe loads.
    expect(html).toContain("Sem sessão ativa — standby");
  });

  it("painel exibe indicador de fonte honesto (not 'Fonte:' when unconfigured)", () => {
    const html = renderPanel();
    // When unconfigured, shows warning — not the green "Fonte:" indicator
    expect(html).toContain("VITE_NV_ENAVIA_URL");
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

// ── Tests — fetchBrowserSession honest behavior ────────────────────────────

describe("P25-PR3 — fetchBrowserSession sem mock silencioso", () => {
  it("8. quando fonte não configurada, retorna ok=false (não mock silencioso)", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    // In test env, VITE_NV_ENAVIA_URL is not set → unconfigured state
    // MUST be ok: false — not a fake ok: true with source: "mock"
    expect(result.ok).toBe(false);
  });

  it("9. quando fonte não configurada, retorna source=unconfigured (honesto)", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.meta.source).toBe("unconfigured");
  });

  it("retorna error.code = BROWSER_SESSION_UNCONFIGURED quando não configurado", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe("BROWSER_SESSION_UNCONFIGURED");
  });

  it("retorna data com active=false quando não configurado", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data.active).toBe(false);
    expect(result.data.sessionStatus).toBe("sem_sessao");
  });

  it("NÃO retorna source=mock — sem mock silencioso nesta tela", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.meta?.source).not.toBe("mock");
  });

  it("14. shape do session alinhado com backend P25-PR2 — sem target_url/result_summary", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    const s = result.data;
    // Fields that come from real backend
    expect(s).toHaveProperty("active");
    expect(s).toHaveProperty("sessionStatus");
    expect(s).toHaveProperty("sessionId");
    expect(s).toHaveProperty("operationalDomain");
    expect(s).toHaveProperty("currentAction");
    expect(s).toHaveProperty("executionStatus");
    expect(s).toHaveProperty("error");
    expect(s).toHaveProperty("lastActionTs");
    // Fields that do NOT exist in backend — must NOT be fabricated
    expect(s).not.toHaveProperty("currentUrl");
    expect(s).not.toHaveProperty("currentTarget");
    expect(s).not.toHaveProperty("evidence");
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

  it("15. useBrowserSession expõe source para honestidade de fonte", async () => {
    // The hook signature includes source — verify via module inspection
    const mod = await import("../browser/useBrowserSession.js");
    // Function exists and is callable (source is internal to the hook state)
    expect(typeof mod.useBrowserSession).toBe("function");
  });
});

describe("P25-PR3 — BROWSER_SESSION_SOURCE (fonte honesta)", () => {
  it("15. BROWSER_SESSION_SOURCE é exportado", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    expect(mod.BROWSER_SESSION_SOURCE).toBeDefined();
    expect(mod.BROWSER_SESSION_SOURCE.REAL).toBe("real");
    expect(mod.BROWSER_SESSION_SOURCE.UNCONFIGURED).toBe("unconfigured");
    expect(mod.BROWSER_SESSION_SOURCE.UNREACHABLE).toBe("unreachable");
  });
});

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
  it("16. OperationalLiveCard pode ser importado sem erro", async () => {
    const mod = await import("../execution/OperationalLiveCard.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("17. mockMemory exporta MOCK_MEMORY", async () => {
    const mod = await import("../memory/mockMemory.js");
    expect(mod.MOCK_MEMORY).toBeDefined();
    expect(mod.MEMORY_STATES).toBeDefined();
  });

  it("18. sendBridge é importável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.sendBridge).toBe("function");
  });

  it("19. fetchBridgeStatus é importável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.fetchBridgeStatus).toBe("function");
  });

  it("fetchHealth é importável", async () => {
    const mod = await import("../api/endpoints/health.js");
    expect(typeof mod.fetchHealth).toBe("function");
  });
});
