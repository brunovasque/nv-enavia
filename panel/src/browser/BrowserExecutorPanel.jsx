// ============================================================================
// BrowserExecutorPanel — P25-PR3 (Browser Arm — sessão real + noVNC real)
//
// Painel operacional do Browser Executor com sessão REAL.
//
// Regra central:
//   - noVNC = visão ao vivo da sessão gráfica do browser executor
//   - Este painel = estado real + metadados reais + viewport noVNC real
//   - ZERO teatro visual — sessão real ou "sem sessão" honesto
//
// Fonte de dados:
//   - useBrowserSession() → fetchBrowserSession() → GET /browser-arm/state
//   - Sem mock fixo. Sem demo switcher. Sem estado fabricado.
//
// Domínios operacionais:
//   noVNC  → browser.nv-imoveis.com/novnc/vnc.html (viewer do VNC desktop)
//   API    → run.nv-imoveis.com/browser-arm/state  (estado do arm/executor)
// São responsabilidades distintas — domínios diferentes.
//
// Regra de honestidade: campo ausente = "sem dado disponível". Nunca inventar.
// ============================================================================

import { useState } from "react";
import { useBrowserSession, BROWSER_SESSION_STATUS } from "./useBrowserSession";

// ── Canonical noVNC URL ───────────────────────────────────────────────────
// Confirmed canonical endpoint: browser.nv-imoveis.com/novnc/vnc.html?autoconnect=1
// ?autoconnect=1 triggers noVNC to connect immediately (no manual "Connect" click).
// VITE_NOVNC_URL overrides the full URL (should include path + query params).
const NOVNC_BASE_URL =
  (typeof import.meta !== "undefined" && import.meta.env?.VITE_NOVNC_URL) ||
  "https://browser.nv-imoveis.com/novnc/vnc.html?autoconnect=1";

// ── Status metadata ────────────────────────────────────────────────────────

const STATUS_META = {
  [BROWSER_SESSION_STATUS.SEM_SESSAO]: {
    label: "Standby",
    color: "var(--text-muted)",
    dot: "var(--text-muted)",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
  },
  [BROWSER_SESSION_STATUS.NAVEGANDO]: {
    label: "Navegando",
    color: "var(--color-primary)",
    dot: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
  },
  [BROWSER_SESSION_STATUS.AGINDO]: {
    label: "Agindo",
    color: "#8B5CF6",
    dot: "#8B5CF6",
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.25)",
  },
  [BROWSER_SESSION_STATUS.AGUARDANDO]: {
    label: "Aguardando",
    color: "#F59E0B",
    dot: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
  },
  [BROWSER_SESSION_STATUS.BLOQUEADO]: {
    label: "Bloqueado",
    color: "#EF4444",
    dot: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
  },
  [BROWSER_SESSION_STATUS.CONCLUIDO]: {
    label: "Concluído",
    color: "#10B981",
    dot: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.30)",
  },
  [BROWSER_SESSION_STATUS.ERRO]: {
    label: "Erro",
    color: "#EF4444",
    dot: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
  },
};

const DEFAULT_STATUS_META = STATUS_META[BROWSER_SESSION_STATUS.SEM_SESSAO];

// ── noVNC Viewport ────────────────────────────────────────────────────────
//
// REGRA: o viewport é SOBERANO.
// O iframe é SEMPRE renderizado — independente de session.active.
//
// A contradição "viewport carregado + estado 'Sem sessão ativa'" é evitada
// rastreando o estado de carregamento real do iframe:
//
//   iframeStatus = "loading"   → overlay: "Conectando…" (aguardando resposta)
//   iframeStatus = "connected" → overlay: "Arm em standby" quando !active
//                                sem overlay quando active
//   iframeStatus = "error"     → overlay: "Viewport indisponível" (genuíno)
//
// O overlay "Sem sessão ativa" (frase principal) SÓ aparece quando o iframe
// realmente não carregou — nunca sobreposto a um viewport vivo.
//
function NoVncViewport({ session, onStatusChange }) {
  const isActive = session?.active === true;
  const noVncUrl = NOVNC_BASE_URL;

  // Track the real load state of the iframe.
  // "loading"   — initial, awaiting onLoad/onError from the browser
  // "connected" — iframe loaded: viewport is accessible (VNC may or may not be active)
  // "error"     — iframe failed to load: genuinely no viewport available
  const [iframeStatus, setIframeStatus] = useState("loading");

  function handleLoad() {
    setIframeStatus("connected");
    onStatusChange?.("connected");
  }
  function handleError() {
    setIframeStatus("error");
    onStatusChange?.("error");
  }

  // Overlay only when we genuinely don't know or can't reach the viewport.
  // When connected (arm active OR standby), the viewport shows cleanly — no text in center.
  // The header badge ("STANDBY" / "AO VIVO" / "CONECTANDO") is the sole status indicator.
  const showOverlay = iframeStatus === "loading" || iframeStatus === "error";
  const overlayIcon = iframeStatus === "error" ? "⚠" : "◎";
  const overlayText =
    iframeStatus === "error"
      ? "Viewport indisponível"
      : "Conectando ao viewport…";

  return (
    <div style={s.viewportContainer} data-testid="novnc-viewport">
      <div style={s.viewportHeader}>
        <span style={s.viewportHeaderIcon} aria-hidden="true">🖥️</span>
        <span style={s.viewportHeaderTitle}>noVNC — Browser Executor</span>
        {isActive && iframeStatus === "connected" ? (
          <span style={s.viewportLiveBadge}>AO VIVO</span>
        ) : iframeStatus === "error" ? (
          <span style={s.viewportErrorBadge}>INDISPONÍVEL</span>
        ) : (
          <span style={s.viewportStandbyBadge}>
            {iframeStatus === "connected" ? "STANDBY" : "CONECTANDO"}
          </span>
        )}
      </div>

      {/* iframe always rendered — viewport is sovereign */}
      <div style={s.viewportFrame}>
        <iframe
          src={noVncUrl}
          title="noVNC — Browser Executor"
          style={s.viewportIframe}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          data-testid="novnc-iframe"
          onLoad={handleLoad}
          onError={handleError}
        />
        {/* Overlay only when needed:
            - loading  → "Conectando…" (we don't know yet)
            - connected + !active → "Viewport ativo · arm em standby" (no contradiction)
            - error → "Viewport indisponível" (honest: no viewport)
            - connected + active → NO overlay (clear view) */}
        {showOverlay && (
          <div style={s.viewportOverlay} data-testid="novnc-session-overlay">
            <span style={s.viewportOverlayIcon} aria-hidden="true">{overlayIcon}</span>
            <span style={s.viewportOverlayText}>{overlayText}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Idle state ─────────────────────────────────────────────────────────────

function BrowserIdleState({ domain }) {
  return (
    <div style={s.idleState} data-testid="browser-idle-state">
      <span style={s.idleIcon} aria-hidden="true">◎</span>
      <p style={s.idleTitle}>Nenhuma sessão ativa</p>
      <p style={s.idleDesc}>
        O Browser Executor está em standby. Quando uma sessão for iniciada,
        os dados de navegação aparecerão aqui e o noVNC mostrará a sessão ao vivo.
      </p>
      <div style={s.idleDomain}>
        <span style={s.idleDomainLabel}>Domínio operacional</span>
        <span style={s.idleDomainValue}>{domain || "—"}</span>
      </div>
    </div>
  );
}

// ── Real session metadata card ─────────────────────────────────────────────
// Fields shown here MUST come from the real backend shape:
//   last_action (armState.last_action) — ✅ exists in backend
//   execution_status (exec.execution_status) — ✅ exists in backend
//   session_id (exec.request_id) — ✅ exists in backend (shown in sidebar)
//
// NOT shown (not present in backend P25-PR2 shape — do not fabricate):
//   target_url, result_summary, evidence
//
function SessionMetadataCard({ session }) {
  const fields = [
    { key: "currentAction",   label: "Última ação",       icon: "▷" },
    { key: "executionStatus", label: "Status de execução", icon: "◎", mono: true },
  ];

  return (
    <div style={s.card} data-testid="session-metadata-card">
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Execução em curso</p>
        {session.lastActionTs && (
          <span style={s.stepBadge}>
            Último update: {formatTs(session.lastActionTs)}
          </span>
        )}
      </div>

      <div style={s.fieldList}>
        {fields.map(({ key, label, icon, mono }, idx) => {
          const value = session[key] ?? null;
          const absent = value == null || value === "";
          return (
            <div
              key={key}
              style={{
                ...s.fieldRow,
                ...(idx < fields.length - 1 ? s.fieldRowBorder : {}),
              }}
            >
              <span style={s.fieldIcon} aria-hidden="true">{icon}</span>
              <div style={s.fieldBody}>
                <span style={s.fieldLabel}>{label}</span>
                {absent ? (
                  <span style={s.fieldAbsent}>sem dado disponível</span>
                ) : (
                  <span
                    style={{
                      ...s.fieldValue,
                      ...(mono ? { fontFamily: "var(--font-mono)", fontSize: "12px" } : {}),
                    }}
                  >
                    {value}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Error card ─────────────────────────────────────────────────────────────

function BrowserErrorCard({ error }) {
  if (!error) return null;
  return (
    <div style={s.errorCard} data-testid="browser-error-card">
      <div style={s.errorHeader}>
        <span style={s.errorIcon} aria-hidden="true">✕</span>
        <span style={s.errorCode}>{error.code}</span>
        {error.recoverable && (
          <span style={s.errorRecoverable}>Recuperável</span>
        )}
      </div>
      <p style={s.errorMessage}>{error.message}</p>
    </div>
  );
}

// ── Session sidebar card ───────────────────────────────────────────────────

function SessionSidebarCard({ session }) {
  const sessionStatus = session?.sessionStatus || BROWSER_SESSION_STATUS.SEM_SESSAO;
  const meta = STATUS_META[sessionStatus] || DEFAULT_STATUS_META;
  const isActive = session?.active === true;

  return (
    <div style={s.card} data-testid="session-sidebar-card">
      <p style={s.cardTitle}>Sessão Browser</p>

      <div style={s.sidebarRows}>
        {/* Status */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Estado</span>
          <span
            style={{
              ...s.statusBadge,
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
            data-testid="session-status-badge"
          >
            <span style={{ ...s.statusDot, background: meta.dot }} aria-hidden="true" />
            {meta.label}
          </span>
        </div>

        {/* Session ID */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Sessão</span>
          <span style={s.sidebarMono} data-testid="session-id-value">
            {isActive ? (session?.sessionId ?? "—") : "—"}
          </span>
        </div>

        {/* Domain */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Domínio</span>
          <span style={s.sidebarMono}>
            {session?.operationalDomain ?? "—"}
          </span>
        </div>

        {/* Last action */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Última ação</span>
          <span style={s.sidebarMono}>
            {isActive && session?.currentAction
              ? session.currentAction
              : "—"}
          </span>
        </div>

        {/* noVNC note */}
        <div style={s.noVncNote}>
          <span style={s.noVncNoteIcon} aria-hidden="true">🖥️</span>
          <span style={s.noVncNoteText}>
            {isActive
              ? "Sessão ao vivo visível no viewport noVNC acima."
              : "Arm em standby · aguardando sessão ativa."}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Loading state ──────────────────────────────────────────────────────────

function LoadingState() {
  return (
    <div style={s.idleState} data-testid="browser-loading-state">
      <span style={s.idleIcon} aria-hidden="true">⟳</span>
      <p style={s.idleTitle}>Consultando sessão do browser…</p>
      <p style={s.idleDesc}>
        Conectando ao Browser Arm para obter o estado real da sessão.
      </p>
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────────────────

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * BrowserExecutorPanel — P25-PR3
 *
 * Painel real do Browser Executor.
 * noVNC = viewport ao vivo. Painel = estado real + metadados reais.
 * Sem demo switcher. Sem mock fixo. Sessão real ou "sem sessão" honesto.
 */
export default function BrowserExecutorPanel() {
  const { session, loading, error, source, refresh, lastUpdated } = useBrowserSession();

  const sessionStatus = session?.sessionStatus || BROWSER_SESSION_STATUS.SEM_SESSAO;
  const meta = STATUS_META[sessionStatus] || DEFAULT_STATUS_META;
  const isActive = session?.active === true;
  const hasError = sessionStatus === BROWSER_SESSION_STATUS.ERRO
                || sessionStatus === BROWSER_SESSION_STATUS.BLOQUEADO;

  // Track the real iframe load state so header/body stay coherent with the viewport.
  // This resolves the contradiction: iframe connected ≠ "Sem sessão ativa" as main truth.
  const [viewportStatus, setViewportStatus] = useState("loading");
  const viewportConnected = viewportStatus === "connected";

  // Source label for the indicator
  const isUnconfigured = source === "unconfigured";
  const isUnreachable  = source === "unreachable";
  const sourceLabel = isUnconfigured
    ? "Fonte não configurada — /browser-arm/state indisponível (VITE_NV_ENAVIA_URL ausente)"
    : isUnreachable
    ? "Fonte inacessível — /browser-arm/state não respondeu"
    : source === "real"
    ? `Fonte: /browser-arm/state · Atualizado: ${formatTs(lastUpdated)}`
    : "Consultando /browser-arm/state…";

  // Header subtitle: uses combined truth of arm state + viewport load state.
  // When viewport is connected but arm is idle → "Viewport ativo · arm em standby"
  // (not "Sem sessão ativa" — that would contradict the loaded iframe)
  const headerSub = isActive
    ? `Sessão ${session?.sessionId ?? "—"} · ${session?.operationalDomain ?? "—"}/*`
    : viewportConnected
    ? "Viewport ativo · arm em standby"
    : "Sem sessão ativa — standby";

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.headerIdentity}>
            <span style={s.headerMark} aria-hidden="true">◆</span>
            <div>
              <p style={s.headerTitle}>Browser Executor — Painel Real</p>
              <p style={s.headerSub} data-testid="header-sub">{headerSub}</p>
            </div>
          </div>

          {/* Status badge */}
          <span
            style={{
              ...s.badge,
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
            data-testid="header-status-badge"
          >
            <span
              style={{ ...s.badgeDot, background: meta.dot }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </div>

        {/* Source indicator — shows real source or honest unavailability */}
        <div
          style={{
            ...s.sourceIndicator,
            ...(isUnconfigured || isUnreachable ? s.sourceIndicatorWarn : {}),
          }}
          data-testid="source-indicator"
        >
          <span
            style={{
              ...s.sourceIcon,
              color: isUnconfigured || isUnreachable ? "#F59E0B" : "#10B981",
            }}
            aria-hidden="true"
          >
            {isUnconfigured || isUnreachable ? "⚠" : "●"}
          </span>
          <span style={s.sourceText}>{sourceLabel}</span>
          {!isUnconfigured && (
            <button style={s.refreshBtn} onClick={refresh} title="Atualizar agora">↻</button>
          )}
        </div>

        {/* Connection error */}
        {error && (
          <div style={s.connectionError} data-testid="connection-error">
            <span style={s.connectionErrorIcon} aria-hidden="true">⚠</span>
            <span style={s.connectionErrorText}>
              {typeof error === "object" && error.message ? error.message : String(error)}
            </span>
          </div>
        )}
      </div>

      {/* Loading */}
      {loading && !session && <LoadingState />}

      {/* noVNC Viewport — ALWAYS rendered once loading is done */}
      {/* Viewport is sovereign: iframe present regardless of session.active */}
      {/* onStatusChange lifts iframe load state up so header/body stay coherent */}
      {!loading && <NoVncViewport session={session} onStatusChange={setViewportStatus} />}

      {/* Body — always shown; sidebar shows state, main shows metadata or idle info */}
      {!loading && (
        <div style={s.body}>
          {/* Main column */}
          <div style={s.main}>
            {/* Error / blocker banner */}
            {isActive && hasError && session?.error && (
              <BrowserErrorCard error={session.error} />
            )}

            {/* Session metadata when active */}
            {isActive && <SessionMetadataCard session={session} />}

            {/* Idle info when not active — shows arm state, coherent with header + viewport badge */}
            {!isActive && (
              <div style={s.idleInfo} data-testid="browser-idle-info">
                <span style={s.idleInfoIcon} aria-hidden="true">◎</span>
                <p style={s.idleInfoTitle}>Arm em standby</p>
                <p style={s.idleInfoDesc}>
                  Nenhuma sessão de browser ativa. O viewport noVNC acima continua visível.
                </p>
                <div style={s.idleDomain}>
                  <span style={s.idleDomainLabel}>Domínio operacional</span>
                  <span style={s.idleDomainValue}>
                    {session?.operationalDomain || "—"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div style={s.sidebar}>
            <SessionSidebarCard session={session} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────

const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    height: "100%",
    overflowY: "auto",
    overflowX: "hidden",
    padding: "4px 0 0",
  },

  // Header
  header: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    flexShrink: 0,
  },
  headerTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  headerIdentity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerMark: {
    fontSize: "22px",
    color: "var(--color-primary)",
    fontWeight: 700,
    lineHeight: 1,
    textShadow: "0 0 16px rgba(0,180,216,0.4)",
    flexShrink: 0,
  },
  headerTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    padding: "5px 12px",
    borderRadius: "20px",
    border: "1px solid",
    letterSpacing: "0.3px",
    flexShrink: 0,
  },
  badgeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },

  // Source indicator
  sourceIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "10px",
    color: "var(--text-muted)",
    padding: "6px 12px",
    background: "rgba(16,185,129,0.06)",
    border: "1px solid rgba(16,185,129,0.20)",
    borderRadius: "var(--radius-md)",
  },
  sourceIndicatorWarn: {
    background: "rgba(245,158,11,0.06)",
    border: "1px solid rgba(245,158,11,0.25)",
  },
  sourceIcon: {
    color: "#10B981",
    fontSize: "8px",
  },
  sourceText: {
    flex: 1,
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.3px",
  },
  refreshBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    padding: "2px 8px",
    fontSize: "12px",
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  },

  // Connection error
  connectionError: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    fontSize: "11px",
    color: "#F59E0B",
    padding: "8px 12px",
    background: "rgba(245,158,11,0.08)",
    border: "1px solid rgba(245,158,11,0.25)",
    borderRadius: "var(--radius-md)",
  },
  connectionErrorIcon: {
    fontSize: "14px",
    flexShrink: 0,
  },
  connectionErrorText: {
    lineHeight: 1.4,
  },

  // noVNC Viewport
  viewportContainer: {
    background: "var(--bg-surface)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "var(--radius-lg)",
    overflowX: "auto",
    overflowY: "hidden",
    flexShrink: 0,
  },
  viewportHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 16px",
    borderBottom: "1px solid var(--border-light)",
    background: "rgba(0,180,216,0.04)",
  },
  viewportHeaderIcon: {
    fontSize: "16px",
    flexShrink: 0,
  },
  viewportHeaderTitle: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--color-primary)",
    letterSpacing: "0.5px",
    flex: 1,
  },
  viewportLiveBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#10B981",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.30)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  viewportStandbyBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.10)",
    border: "1px solid rgba(100,116,139,0.25)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  viewportErrorBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#EF4444",
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.30)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  // viewportFrame wraps iframe + overlay (position:relative for overlay)
  viewportFrame: {
    position: "relative",
  },
  viewportIframe: {
    width: "100%",
    height: "680px",
    border: "none",
    display: "block",
    background: "#0a0f14",
  },
  // Overlay: complements the viewport — does NOT replace it
  viewportOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    background: "rgba(10,15,20,0.60)",
    pointerEvents: "none",
  },
  viewportOverlayIcon: {
    fontSize: "28px",
    color: "var(--text-muted)",
    opacity: 0.6,
  },
  viewportOverlayText: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
    fontFamily: "var(--font-mono)",
  },

  // Body layout
  body: {
    display: "flex",
    gap: "16px",
    flex: 1,
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: "24px",
  },
  sidebar: {
    width: "256px",
    minWidth: "256px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
    overflowY: "auto",
  },

  // Idle state (used by LoadingState)
  idleState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "10px",
    flex: 1,
    textAlign: "center",
    padding: "40px 24px",
  },
  idleIcon: {
    fontSize: "36px",
    color: "var(--text-muted)",
    opacity: 0.3,
  },
  idleTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  idleDesc: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.6,
    maxWidth: "400px",
  },

  // Idle info card — inline within body when not active
  // "sem sessão" is shown here as metadata, not as viewport replacement
  idleInfo: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    padding: "20px 24px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    flexShrink: 0,
  },
  idleInfoIcon: {
    fontSize: "22px",
    color: "var(--text-muted)",
    opacity: 0.4,
    alignSelf: "flex-start",
  },
  idleInfoTitle: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-secondary)",
  },
  idleInfoDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.6,
  },
  idleDomain: {
    marginTop: "8px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "8px 16px",
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
  },
  idleDomainLabel: {
    color: "var(--text-muted)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  idleDomainValue: {
    color: "var(--color-primary)",
    fontWeight: 600,
  },

  // Card
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    flexWrap: "wrap",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  stepBadge: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 8px",
    borderRadius: "4px",
  },

  // Fields
  fieldList: {
    display: "flex",
    flexDirection: "column",
  },
  fieldRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "9px 0",
  },
  fieldRowBorder: {
    borderBottom: "1px solid var(--border)",
  },
  fieldIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.7,
    width: "18px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  fieldBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fieldLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    fontWeight: 500,
    overflowWrap: "break-word",
  },
  fieldAbsent: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },

  // Error card
  errorCard: {
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.30)",
    borderRadius: "var(--radius-lg)",
    padding: "14px 18px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    flexShrink: 0,
  },
  errorHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  errorIcon: {
    fontSize: "14px",
    color: "#EF4444",
    flexShrink: 0,
  },
  errorCode: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#EF4444",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.5px",
  },
  errorRecoverable: {
    marginLeft: "auto",
    fontSize: "9px",
    fontWeight: 700,
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.30)",
    padding: "2px 6px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
  },
  errorMessage: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },

  // Sidebar
  sidebarRows: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  sidebarRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    padding: "7px 0",
    borderBottom: "1px solid var(--border)",
    gap: "8px",
  },
  sidebarLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  sidebarMono: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-secondary)",
    textAlign: "right",
    overflowWrap: "break-word",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "12px",
    border: "1px solid",
  },
  statusDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  noVncNote: {
    marginTop: "8px",
    display: "flex",
    gap: "8px",
    background: "rgba(0,180,216,0.06)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "var(--radius-md)",
    padding: "8px 10px",
    alignItems: "flex-start",
  },
  noVncNoteIcon: {
    fontSize: "14px",
    flexShrink: 0,
  },
  noVncNoteText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
};
