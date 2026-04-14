// =============================================================================
// ENAVIA Panel — P25-PR4 smoke tests: Real operational feed for Browser Executor
//
// Verifica acceptance criteria do P25-PR4:
//   1. OperationalFeedCard renderiza com ação/status/url/resultado reais
//   2. PermissionBlockCard renderiza quando bloqueado
//   3. SuggestionsFeedCard renderiza com sugestões reais
//   4. Feed consome fonte real (normalizeSessionFromArm retorna novos campos)
//   5. noVNC não regrediu — viewport continua soberano
//   6. Sem mock — novos campos são null quando não existem no runtime
//   7. BrowserExecutorPanel renderiza sem crash com novos componentes
//   8. Backend getBrowserArmState() retorna campos expandidos
//   9. Block state aparece no getBrowserArmState() após enforcement block
//  10. Sugestões são array vazia por padrão
//  11. Sem regressão de PRs anteriores
// =============================================================================

import { describe, it, expect, vi } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// ── Mock useBrowserSession for various states ─────────────────────────────

// State: active session with real operational data
const ACTIVE_SESSION = {
  active: true,
  sessionStatus: "navegando",
  sessionId: "ba_1713100000_abc1234",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "navigate",
  executionStatus: "navigating",
  targetUrl: "https://run.nv-imoveis.com/dashboard",
  resultSummary: "Página carregada com sucesso",
  error: null,
  block: null,
  suggestions: [],
  lastActionTs: "2026-04-14T12:00:00Z",
  raw: { ok: true, status: "active" },
};

// State: blocked session requiring permission
const BLOCKED_SESSION = {
  active: false,
  sessionStatus: "bloqueado",
  sessionId: null,
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "expand_scope",
  executionStatus: "blocked",
  targetUrl: null,
  resultSummary: null,
  error: {
    code: "BROWSER_ARM_BLOCKED",
    message: "Ação fora do escopo aprovado — deve sugerir + pedir permissão.",
    recoverable: true,
  },
  block: {
    blocked: true,
    level: "blocked_out_of_scope",
    reason: "Ação fora do escopo aprovado — deve sugerir + pedir permissão.",
    suggestionRequired: true,
  },
  suggestions: [],
  lastActionTs: "2026-04-14T12:00:00Z",
  raw: { ok: true, status: "disabled" },
};

// State: session with suggestions
const SESSION_WITH_SUGGESTIONS = {
  active: true,
  sessionStatus: "navegando",
  sessionId: "ba_1713100000_def5678",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "search",
  executionStatus: "navigating",
  targetUrl: "https://run.nv-imoveis.com/tools",
  resultSummary: null,
  error: null,
  block: null,
  suggestions: [
    {
      type: "tool",
      discovery: "Ferramenta de scraping automático disponível",
      benefit: "Acelera coleta de dados de imóveis",
      missing_requirement: "Configuração de API key necessária",
      expected_impact: "Redução de 50% no tempo de coleta",
      permission_needed: true,
    },
  ],
  lastActionTs: "2026-04-14T12:00:00Z",
  raw: { ok: true, status: "active" },
};

// State: idle (unconfigured) — like PR3
const IDLE_SESSION = {
  active: false,
  sessionStatus: "sem_sessao",
  sessionId: null,
  operationalDomain: "run.nv-imoveis.com",
  currentAction: null,
  executionStatus: null,
  targetUrl: null,
  resultSummary: null,
  error: null,
  block: null,
  suggestions: [],
  lastActionTs: null,
  raw: null,
};

// ── Default: idle/unconfigured (like PR3 tests) ──
let mockSessionState = IDLE_SESSION;
let mockSource = "unconfigured";
let mockError = {
  code: "BROWSER_SESSION_UNCONFIGURED",
  message: "Fonte real não configurada — VITE_NV_ENAVIA_URL não definida.",
};

vi.mock("../browser/useBrowserSession", () => ({
  useBrowserSession: () => ({
    session: mockSessionState,
    loading: false,
    error: mockError,
    source: mockSource,
    refresh: () => {},
    lastUpdated: "2026-04-14T12:00:00Z",
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

function renderPanel() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(BrowserExecutorPanel))
  );
}

// ── Tests — P25-PR4: Operational Feed ──────────────────────────────────────

describe("P25-PR4 — OperationalFeedCard (real data)", () => {
  it("1. renderiza sem crash com sessão ativa", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    expect(() => renderPanel()).not.toThrow();
  });

  it("2. mostra 'Feed Operacional' como título do card", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("Feed Operacional");
  });

  it("3. mostra ação atual real", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("navigate");
    expect(html).toContain("Ação atual");
  });

  it("4. mostra status atual real", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("navigating");
    expect(html).toContain("Status atual");
  });

  it("5. mostra URL real quando presente", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("https://run.nv-imoveis.com/dashboard");
  });

  it("6. mostra resultado curto real quando presente", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("Página carregada com sucesso");
  });

  it("7. mostra 'sem dado disponível' quando campo não existe", () => {
    mockSessionState = { ...ACTIVE_SESSION, targetUrl: null, resultSummary: null };
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("sem dado disponível");
  });
});

describe("P25-PR4 — PermissionBlockCard (bloqueio/permissão)", () => {
  it("8. renderiza card de bloqueio quando sessão bloqueada", () => {
    mockSessionState = BLOCKED_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("permission-block-card");
    expect(html).toContain("Ação bloqueada");
  });

  it("9. mostra motivo do bloqueio real", () => {
    mockSessionState = BLOCKED_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("fora do escopo aprovado");
  });

  it("10. mostra nível do bloqueio", () => {
    mockSessionState = BLOCKED_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("blocked_out_of_scope");
  });

  it("11. mostra indicação de permissão necessária", () => {
    mockSessionState = BLOCKED_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("block-permission-note");
    expect(html).toContain("permissão do usuário");
  });

  it("12. não mostra card de bloqueio quando não há bloqueio", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).not.toContain("permission-block-card");
  });
});

describe("P25-PR4 — SuggestionsFeedCard (sugestões da Enavia)", () => {
  it("13. renderiza sugestões quando existem", () => {
    mockSessionState = SESSION_WITH_SUGGESTIONS;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("suggestions-feed-card");
    expect(html).toContain("Sugestões da Enavia");
  });

  it("14. mostra tipo da sugestão", () => {
    mockSessionState = SESSION_WITH_SUGGESTIONS;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("tool");
  });

  it("15. mostra conteúdo real da sugestão", () => {
    mockSessionState = SESSION_WITH_SUGGESTIONS;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("Ferramenta de scraping automático disponível");
    expect(html).toContain("Acelera coleta de dados");
  });

  it("16. mostra badge de permissão quando necessária", () => {
    mockSessionState = SESSION_WITH_SUGGESTIONS;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("requer permissão");
  });

  it("17. não mostra card de sugestões quando array vazia", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).not.toContain("suggestions-feed-card");
  });
});

// ── Tests — noVNC não regrediu ─────────────────────────────────────────────

describe("P25-PR4 — noVNC sem regressão", () => {
  it("18. noVNC iframe presente em sessão ativa", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("novnc-iframe");
    expect(html).toContain("noVNC");
  });

  it("19. noVNC iframe presente em sessão idle", () => {
    mockSessionState = IDLE_SESSION;
    mockSource = "unconfigured";
    mockError = {
      code: "BROWSER_SESSION_UNCONFIGURED",
      message: "Fonte real não configurada.",
    };
    const html = renderPanel();
    expect(html).toContain("novnc-iframe");
  });

  it("20. viewport continua soberano — não substituído pelo feed", () => {
    mockSessionState = ACTIVE_SESSION;
    mockSource = "real";
    mockError = null;
    const html = renderPanel();
    expect(html).toContain("novnc-viewport");
    expect(html).toContain("operational-feed-card");
  });
});

// ── Tests — normalizeSessionFromArm shape (P25-PR4 campos novos) ──────────

describe("P25-PR4 — normalizeSessionFromArm shape expandido", () => {
  it("21. session tem campo targetUrl", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data).toHaveProperty("targetUrl");
  });

  it("22. session tem campo resultSummary", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data).toHaveProperty("resultSummary");
  });

  it("23. session tem campo block (null quando não bloqueado)", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data).toHaveProperty("block");
    expect(result.data.block).toBeNull();
  });

  it("24. session tem campo suggestions (array vazia por padrão)", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.data).toHaveProperty("suggestions");
    expect(Array.isArray(result.data.suggestions)).toBe(true);
  });
});

// ── Tests — Backend getBrowserArmState (P25-PR4) ──────────────────────────
// NOTE: Backend tests are in /tests/p25-pr4-browser-arm-state.smoke.test.js
// (contract-executor.js cannot be imported from within the panel Vite project)

// ── Tests — PR3 sem regressão ──────────────────────────────────────────────

describe("P25-PR4 — sem regressão PR3", () => {
  it("28. BROWSER_SESSION_STATUS mantém 7 estados", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    expect(mod.BROWSER_SESSION_STATUS.SEM_SESSAO).toBe("sem_sessao");
    expect(mod.BROWSER_SESSION_STATUS.NAVEGANDO).toBe("navegando");
    expect(mod.BROWSER_SESSION_STATUS.AGINDO).toBe("agindo");
    expect(mod.BROWSER_SESSION_STATUS.AGUARDANDO).toBe("aguardando");
    expect(mod.BROWSER_SESSION_STATUS.BLOQUEADO).toBe("bloqueado");
    expect(mod.BROWSER_SESSION_STATUS.CONCLUIDO).toBe("concluido");
    expect(mod.BROWSER_SESSION_STATUS.ERRO).toBe("erro");
  });

  it("29. fetchBrowserSession ainda retorna ok=false quando não configurado", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    const result = await mod.fetchBrowserSession();
    expect(result.ok).toBe(false);
    expect(result.meta.source).toBe("unconfigured");
  });

  it("30. BROWSER_SESSION_SOURCE exportado", async () => {
    const mod = await import("../api/endpoints/browserSession.js");
    expect(mod.BROWSER_SESSION_SOURCE.REAL).toBe("real");
    expect(mod.BROWSER_SESSION_SOURCE.UNCONFIGURED).toBe("unconfigured");
  });
});

// ── Tests — backward compatibility ─────────────────────────────────────────

describe("P25-PR4 — backward compatibility", () => {
  it("31. mockBrowserSession.js continua exportando", async () => {
    const mod = await import("../browser/mockBrowserSession.js");
    expect(mod.BROWSER_STATUS).toBeDefined();
    expect(mod.MOCK_BROWSER_SESSIONS).toBeDefined();
  });

  it("32. useBrowserSession hook importável", async () => {
    const mod = await import("../browser/useBrowserSession.js");
    expect(typeof mod.useBrowserSession).toBe("function");
  });

  it("33. sendBridge importável", async () => {
    const mod = await import("../api/endpoints/bridge.js");
    expect(typeof mod.sendBridge).toBe("function");
  });
});
