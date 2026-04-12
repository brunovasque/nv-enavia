// ============================================================================
// ExecutionHeader — ID da execução, status badge, tempo decorrido, switcher
// ============================================================================

import { useState, useEffect } from "react";
import { EXECUTION_STATUS, formatElapsed, formatTs } from "./mockExecution";

const STATUS_META = {
  [EXECUTION_STATUS.IDLE]: {
    label: "Aguardando",
    color: "var(--text-muted)",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
    dot: "var(--text-muted)",
  },
  [EXECUTION_STATUS.RUNNING]: {
    label: "Em execução",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    dot: "var(--color-primary)",
  },
  [EXECUTION_STATUS.BLOCKED]: {
    label: "Bloqueado",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.30)",
    dot: "#F59E0B",
  },
  [EXECUTION_STATUS.FAILED]: {
    label: "Falhou",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.12)",
    border: "rgba(239,68,68,0.30)",
    dot: "#EF4444",
  },
  [EXECUTION_STATUS.COMPLETED]: {
    label: "Concluído",
    color: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.30)",
    dot: "#10B981",
  },
};

export default function ExecutionHeader({ execution, currentState, onStateChange }) {
  const meta = STATUS_META[currentState];
  const isRunning = currentState === EXECUTION_STATUS.RUNNING;

  // Live elapsed counter for RUNNING state
  const [liveElapsed, setLiveElapsed] = useState(
    execution?.metrics?.elapsedMs ?? 0
  );

  useEffect(() => {
    setLiveElapsed(execution?.metrics?.elapsedMs ?? 0);
    if (!isRunning) return;
    const interval = setInterval(() => {
      setLiveElapsed((prev) => prev + 1000);
    }, 1000);
    return () => clearInterval(interval);
  }, [isRunning, execution?.metrics?.elapsedMs]);

  return (
    <div style={s.wrap}>
      {/* Top row */}
      <div style={s.topRow}>
        {/* Identity */}
        <div style={s.identity}>
          <span style={s.mark} aria-hidden="true">◆</span>
          <div>
            <p style={s.pageTitle}>Execução Acompanhada</p>
            {execution && (
              <p style={s.execId}>
                {execution.id} · iniciado {formatTs(execution.startedAt)}
              </p>
            )}
          </div>
        </div>

        {/* Right: elapsed + status badge */}
        <div style={s.rightGroup}>
          {execution && (
            <div style={s.elapsedWrap}>
              <span style={s.elapsedLabel}>Decorrido</span>
              <span
                style={{
                  ...s.elapsedValue,
                  color: isRunning ? "var(--color-primary)" : "var(--text-secondary)",
                }}
              >
                {formatElapsed(liveElapsed)}
              </span>
            </div>
          )}
          <span
            style={{
              ...s.badge,
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
          >
            <span
              className={isRunning ? "exec-dot-pulse" : undefined}
              style={{ ...s.dot, background: meta.dot }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Request block */}
      {execution ? (
        <div style={s.requestBlock}>
          <p style={s.requestLabel}>Instrução</p>
          <p style={s.requestText}>{execution.request}</p>
        </div>
      ) : (
        <div style={s.requestBlock}>
          <p style={s.requestLabel}>Instrução</p>
          <p style={{ ...s.requestText, color: "var(--text-muted)", fontStyle: "italic" }}>
            Nenhuma execução ativa nesta sessão.
          </p>
        </div>
      )}

      {/* State switcher (demo) */}
      <div style={s.switcher} role="group" aria-label="Estado da execução (demo)">
        <span style={s.switcherLabel}>Estado demo:</span>
        {Object.values(EXECUTION_STATUS).map((st) => {
          const m = STATUS_META[st];
          const active = st === currentState;
          return (
            <button
              key={st}
              style={{
                ...s.switchBtn,
                ...(active
                  ? { color: m.color, background: m.bg, borderColor: m.border }
                  : {}),
              }}
              onClick={() => onStateChange(st)}
              aria-pressed={active}
            >
              {m.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    flexShrink: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  mark: {
    fontSize: "22px",
    color: "var(--color-primary)",
    fontWeight: 700,
    lineHeight: 1,
    textShadow: "0 0 16px rgba(0,180,216,0.4)",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
    lineHeight: 1.2,
  },
  execId: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexShrink: 0,
  },
  elapsedWrap: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "1px",
  },
  elapsedLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  elapsedValue: {
    fontSize: "18px",
    fontWeight: 700,
    fontFamily: "var(--font-mono)",
    letterSpacing: "1px",
    lineHeight: 1,
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
  },
  dot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  requestBlock: {
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    padding: "12px 16px",
    borderLeft: "3px solid var(--color-primary-border)",
  },
  requestLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  requestText: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
  },
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
};
