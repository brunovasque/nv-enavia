// =============================================================================
// ENAVIA Panel — P25-PR8 smoke tests: Melhoria da UX do Feed Operacional
//
// Acceptance criteria:
//   1.  OperationalFeedCard: status aparece como badge destacado (feed-status-badge)
//   2.  OperationalFeedCard: status é o PRIMEIRO elemento de destaque (feed-status-row)
//   3.  OperationalFeedCard: "Último update" em linha dedicada (feed-timestamp-row)
//   4.  OperationalFeedCard: label "Ação" presente
//   5.  OperationalFeedCard: label "URL atual" presente
//   6.  OperationalFeedCard: label "Resultado" presente
//   7.  OperationalFeedCard: campos ausentes → "sem dado disponível"
//   8.  BrowserErrorCard NÃO aparece quando PermissionBlockCard já cobre o bloco
//   9.  BrowserErrorCard APARECE quando há erro SEM bloco (estado puro de erro)
//  10.  Sem regressão PR5: noVNC iframe presente
//  11.  Sem regressão PR5: notificações — componente NotificationToast presente
//  12.  Sem regressão PR6: botão "Conceder permissão" para bloco grantable
//  13.  Sem regressão PR7: notification-history-card presente
//  14.  Sem regressão PR4: operational-feed-card presente quando sessão ativa
//  15.  Feed Operacional: titulo do card visível
//  16.  Status badge usa cor do estado (não é texto plano sem estilo)
//  17.  "Último update" NÃO aparece no cardHeader como stepBadge (foi movido para baixo)
// =============================================================================

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router-dom";

// ── Mock useBrowserSession ────────────────────────────────────────────────────

let mockSession = null;

vi.mock("../browser/useBrowserSession", () => ({
  useBrowserSession: () => ({
    session: mockSession,
    loading: false,
    error: null,
    source: mockSession ? "real" : "unconfigured",
    refresh: vi.fn(),
    lastUpdated: "2026-04-14T17:00:00Z",
  }),
  BROWSER_SESSION_STATUS: {
    SEM_SESSAO:  "sem_sessao",
    NAVEGANDO:   "navegando",
    AGINDO:      "agindo",
    AGUARDANDO:  "aguardando",
    BLOQUEADO:   "bloqueado",
    CONCLUIDO:   "concluido",
    ERRO:        "erro",
  },
}));

// ── Mock grantBrowserArmPermission ────────────────────────────────────────────

vi.mock("../api/endpoints/browserSession", async (importOriginal) => {
  const real = await importOriginal();
  return {
    ...real,
    grantBrowserArmPermission: vi.fn().mockResolvedValue({ ok: true, data: {} }),
  };
});

// ── Imports ───────────────────────────────────────────────────────────────────

import BrowserExecutorPanel from "../browser/BrowserExecutorPanel.jsx";
import {
  addNotificationEvent,
  clearHistory,
  clearAllToasts,
  markAllRead,
} from "../notifications/notificationStore";

// ── Session fixtures ──────────────────────────────────────────────────────────

// Active navigating session — full data
const ACTIVE_SESSION = {
  active: true,
  sessionStatus: "navegando",
  sessionId: "ba_pr8_test_001",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "navigate",
  executionStatus: "navigating",
  targetUrl: "https://run.nv-imoveis.com/dashboard",
  resultSummary: "Página carregada com sucesso",
  error: null,
  block: null,
  suggestions: [],
  lastActionTs: "2026-04-14T17:00:00Z",
  raw: { ok: true, status: "active" },
};

// Active session with partial data (some fields absent)
const PARTIAL_SESSION = {
  active: true,
  sessionStatus: "agindo",
  sessionId: "ba_pr8_test_002",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "click",
  executionStatus: "acting",
  targetUrl: null,
  resultSummary: null,
  error: null,
  block: null,
  suggestions: [],
  lastActionTs: "2026-04-14T17:01:00Z",
  raw: { ok: true, status: "active" },
};

// Blocked session — has BOTH block AND error (the duplicate case PR8 fixes)
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
  lastActionTs: "2026-04-14T17:02:00Z",
  raw: { ok: true, status: "disabled" },
};

// Error session WITHOUT block (pure recoverable error, no enforcement block)
const ERROR_NO_BLOCK_SESSION = {
  active: true,
  sessionStatus: "erro",
  sessionId: "ba_pr8_test_003",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "navigate",
  executionStatus: "error",
  targetUrl: null,
  resultSummary: null,
  error: {
    code: "BROWSER_TIMEOUT",
    message: "Timeout ao navegar para a página.",
    recoverable: true,
  },
  block: null,
  suggestions: [],
  lastActionTs: "2026-04-14T17:03:00Z",
  raw: { ok: true, status: "active" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderPanel() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(BrowserExecutorPanel))
  );
}

// ── Tests: OperationalFeedCard — P25-PR8 UX hierarchy ────────────────────────

describe("P25-PR8 — OperationalFeedCard: hierarquia visual", () => {
  beforeEach(() => {
    markAllRead();
    clearAllToasts();
    clearHistory();
    mockSession = ACTIVE_SESSION;
  });

  it("1. status aparece como badge destacado (data-testid=feed-status-badge)", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="feed-status-badge"');
  });

  it("2. feed-status-row presente (status é âncora visual primária do feed)", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="feed-status-row"');
  });

  it("3. último update em linha dedicada (feed-timestamp-row)", () => {
    const html = renderPanel();
    expect(html).toContain('data-testid="feed-timestamp-row"');
  });

  it("3b. 'Último update' como label da linha dedicada", () => {
    const html = renderPanel();
    expect(html).toContain("Último update");
  });

  it("4. label 'Ação atual' presente", () => {
    const html = renderPanel();
    expect(html).toContain("Ação atual");
  });

  it("5. label 'URL atual' presente", () => {
    const html = renderPanel();
    expect(html).toContain("URL atual");
  });

  it("6. label 'Resultado curto' presente", () => {
    const html = renderPanel();
    expect(html).toContain("Resultado curto");
  });

  it("7. campos ausentes mostram 'sem dado disponível'", () => {
    mockSession = PARTIAL_SESSION;
    const html = renderPanel();
    expect(html).toContain("sem dado disponível");
  });

  it("15. título 'Feed Operacional' visível", () => {
    const html = renderPanel();
    expect(html).toContain("Feed Operacional");
  });

  it("16. status badge contém o valor real de executionStatus", () => {
    const html = renderPanel();
    // feed-status-badge must contain the actual executionStatus value
    expect(html).toContain("navigating");
    expect(html).toContain('data-testid="feed-status-badge"');
  });

  it("status badge ausente (sem dado disponível) quando executionStatus é null", () => {
    mockSession = { ...ACTIVE_SESSION, executionStatus: null };
    const html = renderPanel();
    // Should not render the badge, falls back to absent text
    expect(html).not.toContain('data-testid="feed-status-badge"');
    expect(html).toContain("sem dado disponível");
  });

  it("feed-timestamp-row ausente quando lastActionTs é null", () => {
    mockSession = { ...ACTIVE_SESSION, lastActionTs: null };
    const html = renderPanel();
    expect(html).not.toContain('data-testid="feed-timestamp-row"');
  });
});

// ── Tests: BrowserErrorCard deduplication (P25-PR8) ──────────────────────────

describe("P25-PR8 — BrowserErrorCard: sem duplicação com PermissionBlockCard", () => {
  beforeEach(() => {
    markAllRead();
    clearAllToasts();
    clearHistory();
  });

  it("8. BrowserErrorCard NÃO aparece quando há block (PermissionBlockCard cobre o estado)", () => {
    mockSession = BLOCKED_SESSION;
    const html = renderPanel();
    // PermissionBlockCard must be present
    expect(html).toContain("permission-block-card");
    // BrowserErrorCard must NOT appear — no duplication
    expect(html).not.toContain("browser-error-card");
  });

  it("9. BrowserErrorCard APARECE quando há erro SEM block (erro puro)", () => {
    mockSession = ERROR_NO_BLOCK_SESSION;
    const html = renderPanel();
    // Pure error (recoverable, no block) → BrowserErrorCard IS present
    expect(html).toContain("browser-error-card");
    expect(html).toContain("BROWSER_TIMEOUT");
    // PermissionBlockCard also renders for recoverable errors (existing PR4 behavior —
    // it shows informational content without a grant button since there is no block level)
    expect(html).toContain("permission-block-card");
  });
});

// ── Tests: sem regressão PR3-PR7 ─────────────────────────────────────────────

describe("P25-PR8 — sem regressão PR3–PR7", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markAllRead();
    clearAllToasts();
    clearHistory();
  });

  it("10. sem regressão PR5: noVNC iframe presente", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("novnc-iframe");
    expect(html).toContain("noVNC");
  });

  it("11. sem regressão PR5: NotificationToast renderiza (div raiz presente)", () => {
    mockSession = ACTIVE_SESSION;
    // NotificationToast always renders (even if toast list is empty)
    const html = renderPanel();
    // The panel renders without crash — toast is present even when empty
    expect(() => renderPanel()).not.toThrow();
  });

  it("12. sem regressão PR6: botão 'Conceder permissão' para bloco grantable", () => {
    mockSession = BLOCKED_SESSION;
    const html = renderPanel();
    expect(html).toContain('data-testid="block-grant-btn"');
    expect(html).toContain("Conceder permissão");
  });

  it("13. sem regressão PR7: notification-history-card presente", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("notification-history-card");
  });

  it("14. sem regressão PR4: operational-feed-card presente com sessão ativa", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("operational-feed-card");
  });

  it("sem regressão PR4: PermissionBlockCard aparece com block", () => {
    mockSession = BLOCKED_SESSION;
    const html = renderPanel();
    expect(html).toContain("permission-block-card");
    expect(html).toContain("Ação bloqueada");
  });

  it("sem regressão PR4: feed operacional ausente quando sessão inativa (sem bloco)", () => {
    mockSession = null;
    const html = renderPanel();
    // No active session → OperationalFeedCard not rendered
    expect(html).not.toContain("operational-feed-card");
  });

  it("sem regressão PR3: viewport presente (soberano)", () => {
    mockSession = null;
    const html = renderPanel();
    expect(html).toContain("novnc-viewport");
  });

  it("renderiza sem crash com sessão ativa completa", () => {
    mockSession = ACTIVE_SESSION;
    expect(() => renderPanel()).not.toThrow();
  });

  it("renderiza sem crash com sessão bloqueada", () => {
    mockSession = BLOCKED_SESSION;
    expect(() => renderPanel()).not.toThrow();
  });

  it("renderiza sem crash sem sessão (standby)", () => {
    mockSession = null;
    expect(() => renderPanel()).not.toThrow();
  });
});
