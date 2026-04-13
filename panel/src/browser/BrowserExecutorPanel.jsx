// ============================================================================
// BrowserExecutorPanel — F5-PR2 (Frente 5 — Observabilidade Operacional)
//
// Camada EXPLICATIVA do Browser Executor no painel operacional.
//
// Regra central:
//   - NÃO é um player/browser novo
//   - NÃO duplica o noVNC
//   - noVNC = visão ao vivo da navegação
//   - Este painel = explicação operacional do que está acontecendo
//
// Campos exibidos:
//   sessão ativa · estado · ação atual · passo atual · log de passos
//   seletor/alvo · erro/bloqueio · evidência textual · vínculo com noVNC
//
// Domínio operacional: run.nv-imoveis.com/*
//
// Regra de honestidade: campo ausente = "sem dado disponível". Nunca inventar.
// ============================================================================

import { useState } from "react";
import {
  MOCK_BROWSER_SESSIONS,
  BROWSER_STATUS,
  BROWSER_STEP_STATUS,
  BROWSER_OPERATIONAL_DOMAIN,
  formatBrowserTs,
} from "./mockBrowserSession";

// ── Status metadata ────────────────────────────────────────────────────────

const STATUS_META = {
  [BROWSER_STATUS.IDLE]: {
    label: "Sem sessão",
    color: "var(--text-muted)",
    dot: "var(--text-muted)",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
  },
  [BROWSER_STATUS.NAVIGATING]: {
    label: "Navegando",
    color: "var(--color-primary)",
    dot: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
  },
  [BROWSER_STATUS.ACTING]: {
    label: "Agindo",
    color: "#8B5CF6",
    dot: "#8B5CF6",
    bg: "rgba(139,92,246,0.10)",
    border: "rgba(139,92,246,0.25)",
  },
  [BROWSER_STATUS.WAITING]: {
    label: "Aguardando",
    color: "#F59E0B",
    dot: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.25)",
  },
  [BROWSER_STATUS.BLOCKED]: {
    label: "Bloqueado",
    color: "#EF4444",
    dot: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
  },
  [BROWSER_STATUS.COMPLETED]: {
    label: "Concluído",
    color: "#10B981",
    dot: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.30)",
  },
};

const STEP_STATUS_META = {
  [BROWSER_STEP_STATUS.DONE]:    { color: "#10B981", icon: "◎" },
  [BROWSER_STEP_STATUS.ACTIVE]:  { color: "var(--color-primary)", icon: "▷" },
  [BROWSER_STEP_STATUS.ERROR]:   { color: "#EF4444", icon: "✕" },
  [BROWSER_STEP_STATUS.BLOCKED]: { color: "#F59E0B", icon: "⏳" },
};

// ── noVNC Banner ───────────────────────────────────────────────────────────

function NoVncBanner() {
  return (
    <div style={s.noVncBanner}>
      <span style={s.noVncIcon} aria-hidden="true">🖥️</span>
      <div style={s.noVncText}>
        <span style={s.noVncTitle}>noVNC — Visão ao vivo</span>
        <span style={s.noVncDesc}>
          A navegação real está visível no noVNC. Este painel explica o que o
          Browser Executor está fazendo nessa visão.
        </span>
      </div>
      <span style={s.noVncBadge}>EXPLICAÇÃO</span>
    </div>
  );
}

// ── Idle state ─────────────────────────────────────────────────────────────

function BrowserIdleState() {
  return (
    <div style={s.idleState}>
      <span style={s.idleIcon} aria-hidden="true">◎</span>
      <p style={s.idleTitle}>Nenhuma sessão ativa</p>
      <p style={s.idleDesc}>
        O Browser Executor está em standby. Quando uma sessão for iniciada,
        os dados de navegação aparecerão aqui.
      </p>
      <div style={s.idleDomain}>
        <span style={s.idleDomainLabel}>Domínio operacional</span>
        <span style={s.idleDomainValue}>{BROWSER_OPERATIONAL_DOMAIN}/*</span>
      </div>
    </div>
  );
}

// ── Action card ────────────────────────────────────────────────────────────

function BrowserActionCard({ session }) {
  const fields = [
    { key: "currentUrl",      label: "Página atual",   icon: "🔗", mono: true },
    { key: "currentAction",   label: "Ação atual",     icon: "▷" },
    { key: "currentTarget",   label: "Alvo atual",     icon: "🎯" },
    { key: "currentSelector", label: "Seletor",        icon: "⌖",  mono: true },
    { key: "evidence",        label: "Evidência",      icon: "◆" },
  ];

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Navegação em curso</p>
        {session.currentStep && (
          <span style={s.stepBadge}>
            Passo {session.currentStep.index} — {session.currentStep.label}
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

// ── Step log ───────────────────────────────────────────────────────────────

function BrowserStepLog({ steps }) {
  const isEmpty = !steps || steps.length === 0;
  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Log de passos</p>
        {!isEmpty && (
          <span style={s.countBadge}>{steps.length} passos</span>
        )}
      </div>
      {isEmpty ? (
        <p style={s.logEmpty}>Nenhum passo registrado ainda.</p>
      ) : (
        <div style={s.logList}>
          {steps.map((step, idx) => {
            const meta = STEP_STATUS_META[step.status] ?? STEP_STATUS_META[BROWSER_STEP_STATUS.DONE];
            const isLast = idx === steps.length - 1;
            return (
              <div
                key={step.id}
                style={{
                  ...s.logRow,
                  ...(isLast ? {} : s.logRowBorder),
                }}
              >
                <span style={{ ...s.logIcon, color: meta.color }} aria-hidden="true">
                  {meta.icon}
                </span>
                <div style={s.logBody}>
                  <div style={s.logTop}>
                    <span style={{ ...s.logLabel, color: meta.color }}>{step.label}</span>
                    <span style={s.logTs}>{formatBrowserTs(step.timestamp)}</span>
                  </div>
                  {step.detail && (
                    <span style={s.logDetail}>{step.detail}</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Error card ─────────────────────────────────────────────────────────────

function BrowserErrorCard({ error }) {
  if (!error) return null;
  return (
    <div style={s.errorCard}>
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

function SessionSidebarCard({ session, currentStatus }) {
  const meta = STATUS_META[currentStatus];
  const isActive = currentStatus !== BROWSER_STATUS.IDLE;

  return (
    <div style={s.card}>
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
          >
            <span style={{ ...s.statusDot, background: meta.dot }} aria-hidden="true" />
            {meta.label}
          </span>
        </div>

        {/* Session ID */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Sessão</span>
          <span style={s.sidebarMono}>
            {isActive ? (session?.sessionId ?? "—") : "—"}
          </span>
        </div>

        {/* Domain */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Domínio</span>
          <span style={s.sidebarMono}>
            {isActive ? (session?.operationalDomain ?? "—") : "—"}
          </span>
        </div>

        {/* Step progress */}
        <div style={s.sidebarRow}>
          <span style={s.sidebarLabel}>Passo atual</span>
          <span style={s.sidebarMono}>
            {isActive && session?.currentStep
              ? `${session.currentStep.index} — ${session.currentStep.label}`
              : "—"}
          </span>
        </div>

        {/* noVNC note */}
        <div style={s.noVncNote}>
          <span style={s.noVncNoteIcon} aria-hidden="true">🖥️</span>
          <span style={s.noVncNoteText}>
            Visão ao vivo no noVNC. Este painel explica o que está sendo executado.
          </span>
        </div>
      </div>
    </div>
  );
}

// ── State switcher ─────────────────────────────────────────────────────────

function StateSwitcher({ current, onChange }) {
  return (
    <div style={s.switcher} role="group" aria-label="Estado do browser (demo)">
      <span style={s.switcherLabel}>Estado demo:</span>
      {Object.values(BROWSER_STATUS).map((st) => {
        const m = STATUS_META[st];
        const active = st === current;
        return (
          <button
            key={st}
            style={{
              ...s.switchBtn,
              ...(active
                ? { color: m.color, background: m.bg, borderColor: m.border }
                : {}),
            }}
            onClick={() => onChange(st)}
            aria-pressed={active}
          >
            {m.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * BrowserExecutorPanel — F5-PR2
 *
 * Painel explicativo do Browser Executor.
 * noVNC é a visão ao vivo. Este painel é a explicação operacional.
 */
export default function BrowserExecutorPanel() {
  const [currentStatus, setCurrentStatus] = useState(BROWSER_STATUS.IDLE);
  const session = MOCK_BROWSER_SESSIONS[currentStatus] ?? null;

  const isIdle = currentStatus === BROWSER_STATUS.IDLE;
  const isBlocked = currentStatus === BROWSER_STATUS.BLOCKED;
  const isActive = !isIdle;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.headerIdentity}>
            <span style={s.headerMark} aria-hidden="true">◆</span>
            <div>
              <p style={s.headerTitle}>Browser Executor — Painel Explicativo</p>
              <p style={s.headerSub}>
                {isActive
                  ? `Sessão ${session?.sessionId ?? "—"} · ${session?.operationalDomain ?? "—"}/*`
                  : "Sem sessão ativa — standby"}
              </p>
            </div>
          </div>

          {/* Status badge */}
          <span
            style={{
              ...s.badge,
              color: STATUS_META[currentStatus].color,
              background: STATUS_META[currentStatus].bg,
              borderColor: STATUS_META[currentStatus].border,
            }}
          >
            <span
              style={{ ...s.badgeDot, background: STATUS_META[currentStatus].dot }}
              aria-hidden="true"
            />
            {STATUS_META[currentStatus].label}
          </span>
        </div>

        {/* noVNC explanation */}
        <NoVncBanner />

        {/* Demo state switcher */}
        <StateSwitcher current={currentStatus} onChange={setCurrentStatus} />
      </div>

      {/* Idle fills the rest */}
      {isIdle && <BrowserIdleState />}

      {/* Active session body */}
      {isActive && (
        <div style={s.body}>
          {/* Main column */}
          <div style={s.main}>
            {/* Error / blocker banner */}
            {isBlocked && session?.error && (
              <BrowserErrorCard error={session.error} />
            )}

            {/* Action card */}
            <BrowserActionCard session={session} />

            {/* Step log */}
            <BrowserStepLog steps={session?.stepLog ?? []} />
          </div>

          {/* Sidebar */}
          <div style={s.sidebar}>
            <SessionSidebarCard session={session} currentStatus={currentStatus} />
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
    overflow: "hidden",
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

  // noVNC banner
  noVncBanner: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    background: "rgba(0,180,216,0.06)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "var(--radius-md)",
    padding: "10px 16px",
  },
  noVncIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  noVncText: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  noVncTitle: {
    fontSize: "11px",
    fontWeight: 700,
    color: "var(--color-primary)",
    letterSpacing: "0.5px",
  },
  noVncDesc: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  noVncBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 7px",
    borderRadius: "4px",
    flexShrink: 0,
  },

  // Switcher
  switcher: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  switcherLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
    marginRight: "2px",
  },
  switchBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all 0.15s ease",
  },

  // Body layout
  body: {
    display: "flex",
    gap: "16px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
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

  // Idle state
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
  countBadge: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "2px 7px",
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

  // Step log
  logEmpty: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
    padding: "8px 0",
  },
  logList: {
    display: "flex",
    flexDirection: "column",
  },
  logRow: {
    display: "flex",
    gap: "10px",
    padding: "8px 0",
    alignItems: "flex-start",
  },
  logRowBorder: {
    borderBottom: "1px solid var(--border)",
  },
  logIcon: {
    fontSize: "12px",
    width: "16px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  logBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  logTop: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  logLabel: {
    fontSize: "12px",
    fontWeight: 600,
    lineHeight: 1.3,
  },
  logTs: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    flexShrink: 0,
  },
  logDetail: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    fontFamily: "var(--font-mono)",
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
