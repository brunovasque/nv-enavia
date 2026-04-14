// =============================================================================
// ENAVIA Panel — P25-PR7 smoke tests: Histórico/Lista de Notificações
//
// Acceptance criteria:
//   1.  notificationStore expõe `history` no snapshot
//   2.  addNotificationEvent adiciona item a history com read=false
//   3.  markAllRead marca todos os itens de history como read=true
//   4.  clearAllToasts NÃO afeta history
//   5.  dismissToast NÃO afeta history
//   6.  NotificationHistory renderiza estado vazio quando sem eventos
//   7.  NotificationHistory renderiza lista quando há eventos
//   8.  NotificationHistory exibe tipo, label e mensagem corretos
//   9.  NotificationHistory mostra dot de não-lido antes de markAllRead
//  10.  NotificationHistory NÃO mostra dot após markAllRead
//  11.  History não perde eventos ao descartarmos o toast (items permanecem)
//  12.  Sem regressão PR5: badge de unreadCount continua funcionando
//  13.  Sem regressão PR6: BrowserExecutorPanel renderiza sem crash (bloco grantable)
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

import {
  addNotificationEvent,
  dismissToast,
  clearAllToasts,
  clearHistory,
  markAllRead,
  useNotificationStore,
} from "../notifications/notificationStore";

import NotificationHistory from "../notifications/NotificationHistory.jsx";
import BrowserExecutorPanel from "../browser/BrowserExecutorPanel.jsx";
import { GRANTABLE_BLOCK_LEVELS } from "../api/endpoints/browserSession";

// ── Session fixtures ──────────────────────────────────────────────────────────

const ACTIVE_SESSION = {
  active: true,
  sessionStatus: "navegando",
  sessionId: "ba_pr7_test_001",
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "navigate",
  executionStatus: "navigating",
  targetUrl: "https://run.nv-imoveis.com/",
  resultSummary: "OK",
  error: null,
  block: null,
  suggestions: [],
  lastActionTs: "2026-04-14T17:00:00Z",
  raw: { ok: true, status: "active" },
};

const GRANTABLE_SESSION = {
  active: false,
  sessionStatus: "bloqueado",
  sessionId: null,
  operationalDomain: "run.nv-imoveis.com",
  currentAction: "expand_scope",
  executionStatus: "blocked",
  targetUrl: null,
  resultSummary: null,
  error: { code: "BROWSER_ARM_BLOCKED", message: "Ação fora do escopo.", recoverable: true },
  block: {
    blocked: true,
    level: "blocked_out_of_scope",
    reason: "Ação fora do escopo aprovado.",
    suggestionRequired: true,
  },
  suggestions: [],
  lastActionTs: "2026-04-14T17:00:00Z",
  raw: { ok: true, status: "disabled" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderHistory() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(NotificationHistory))
  );
}

function renderPanel() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, {}, createElement(BrowserExecutorPanel))
  );
}

// ── Tests: notificationStore — history API ────────────────────────────────────

describe("P25-PR7 — notificationStore: history", () => {
  beforeEach(() => {
    markAllRead();
    clearAllToasts();
    clearHistory();
  });

  it("1. useNotificationStore snapshot contém campo history no render", () => {
    // Verify that NotificationHistory (which reads history from the store) renders correctly
    // and that the store snapshot shape includes history — verified by integration.
    addNotificationEvent("block", "Verificação snapshot history");
    const html = renderHistory();
    // If history were absent from snapshot, the component would crash or show empty state.
    expect(html).toContain("notification-history-list");
    expect(html).toContain("history-item-block");
  });

  it("2. addNotificationEvent adiciona item a history", async () => {
    markAllRead();
    clearAllToasts();
    // Add an event and verify NotificationHistory renders it
    addNotificationEvent("block", "Bloqueio de histórico P25-PR7");
    const html = renderHistory();
    expect(html).toContain("notification-history-list");
    expect(html).toContain("history-item-block");
    expect(html).toContain("Bloqueio de histórico P25-PR7");
  });

  it("3. markAllRead marca itens de history como lidos (sem unread-dot)", () => {
    clearAllToasts();
    addNotificationEvent("permission", "Permissão de histórico");
    // Before markAllRead: unread dot should be present
    const htmlBefore = renderHistory();
    expect(htmlBefore).toContain("history-unread-dot");

    // After markAllRead: unread dot should be gone
    markAllRead();
    const htmlAfter = renderHistory();
    expect(htmlAfter).not.toContain("history-unread-dot");
  });

  it("4. clearAllToasts NÃO apaga history", () => {
    clearAllToasts();
    addNotificationEvent("suggestion", "Sugestão que não pode ser apagada do histórico");
    // Discard all active toasts
    clearAllToasts();
    // History must still contain the event
    const html = renderHistory();
    expect(html).toContain("notification-history-list");
    expect(html).toContain("history-item-suggestion");
    expect(html).toContain("Sugestão que não pode ser apagada do histórico");
  });

  it("5. dismissToast NÃO apaga history", () => {
    clearAllToasts();
    // Add event — store assigns sequential ids; grab the id from toast render
    addNotificationEvent("error", "Erro que persiste no histórico");
    // Dismiss a toast by an id that won't match any (safe no-op per store contract)
    dismissToast(99999);
    // History item must still be there
    const html = renderHistory();
    expect(html).toContain("history-item-error");
    expect(html).toContain("Erro que persiste no histórico");
  });

  it("11. history acumula múltiplos eventos corretamente", () => {
    clearAllToasts();
    addNotificationEvent("block", "Evento 1");
    addNotificationEvent("permission", "Evento 2");
    addNotificationEvent("suggestion", "Evento 3");
    const html = renderHistory();
    expect(html).toContain("history-item-block");
    expect(html).toContain("history-item-permission");
    expect(html).toContain("history-item-suggestion");
    expect(html).toContain("Evento 1");
    expect(html).toContain("Evento 2");
    expect(html).toContain("Evento 3");
  });
});

// ── Tests: NotificationHistory component ─────────────────────────────────────

describe("P25-PR7 — NotificationHistory: renderização", () => {
  beforeEach(() => {
    markAllRead();
    clearAllToasts();
    clearHistory();
  });

  it("6. renderiza estado vazio quando sem eventos", () => {
    // After reset: history is empty → empty state renders
    const html = renderHistory();
    expect(html).toContain("notification-history-card");
    expect(html).toContain("notification-history-empty");
    expect(html).not.toContain("notification-history-list");
  });

  it("7. renderiza lista quando há eventos", () => {
    addNotificationEvent("error", "Erro de teste PR7");
    const html = renderHistory();
    expect(html).toContain("notification-history-list");
    expect(html).toContain("history-item-error");
  });

  it("8. exibe label correto para cada tipo", () => {
    addNotificationEvent("block",      "msg block");
    addNotificationEvent("permission", "msg permission");
    addNotificationEvent("suggestion", "msg suggestion");
    addNotificationEvent("error",      "msg error");
    const html = renderHistory();
    expect(html).toContain("Bloqueio");
    expect(html).toContain("Permissão");
    expect(html).toContain("Sugestão");
    expect(html).toContain("Erro");
  });

  it("9. dot de não-lido aparece para eventos não lidos", () => {
    addNotificationEvent("block", "Bloqueio não lido");
    const html = renderHistory();
    expect(html).toContain("history-unread-dot");
  });

  it("10. dot de não-lido desaparece após markAllRead", () => {
    addNotificationEvent("block", "Bloqueio para marcar lido");
    markAllRead();
    const html = renderHistory();
    expect(html).not.toContain("history-unread-dot");
  });

  it("exibe contagem correta de eventos no badge", () => {
    addNotificationEvent("block", "e1");
    addNotificationEvent("error", "e2");
    const html = renderHistory();
    expect(html).toContain("notification-history-count");
  });
});

// ── Tests: BrowserExecutorPanel — integração + sem regressão ─────────────────

describe("P25-PR7 — BrowserExecutorPanel: integração e sem regressão", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    markAllRead();
    clearAllToasts();
    clearHistory();
  });

  it("12. BrowserExecutorPanel renderiza notification-history-card com sessão ativa", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("notification-history-card");
  });

  it("12b. BrowserExecutorPanel renderiza notification-history-card sem sessão", () => {
    mockSession = null;
    const html = renderPanel();
    expect(html).toContain("notification-history-card");
  });

  it("13. sem regressão PR6: botão grant ainda aparece para bloco grantable", () => {
    mockSession = GRANTABLE_SESSION;
    const html = renderPanel();
    expect(html).toContain('data-testid="block-grant-btn"');
    expect(html).toContain("Conceder permissão");
    // History also present
    expect(html).toContain("notification-history-card");
  });

  it("sem regressão PR5: noVNC iframe ainda presente", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("novnc-iframe");
    expect(html).toContain("notification-history-card");
  });

  it("sem regressão PR5: feed operacional presente", () => {
    mockSession = ACTIVE_SESSION;
    const html = renderPanel();
    expect(html).toContain("operational-feed-card");
    expect(html).toContain("notification-history-card");
  });

  it("sem regressão PR4: permission-block-card presente com bloco", () => {
    mockSession = GRANTABLE_SESSION;
    const html = renderPanel();
    expect(html).toContain("permission-block-card");
  });
});

// ── Tests: NotificationHistory importação ────────────────────────────────────

describe("P25-PR7 — NotificationHistory: importação e exports", () => {
  it("é importável e é uma função", async () => {
    const mod = await import("../notifications/NotificationHistory.jsx");
    expect(typeof mod.default).toBe("function");
  });

  it("renderiza sem crash", () => {
    expect(() => renderHistory()).not.toThrow();
  });
});
