// ============================================================================
// ErrorBlock — banner de bloqueio ou falha com motivo e código
// ============================================================================

import { EXECUTION_STATUS, formatTsFull } from "./mockExecution";

export default function ErrorBlock({ error, status }) {
  if (!error) return null;

  const isBlocked = status === EXECUTION_STATUS.BLOCKED;
  const isFailed = status === EXECUTION_STATUS.FAILED;
  if (!isBlocked && !isFailed) return null;

  const color = isBlocked ? "#F59E0B" : "#EF4444";
  const bgColor = isBlocked
    ? "rgba(245,158,11,0.08)"
    : "rgba(239,68,68,0.08)";
  const borderColor = isBlocked
    ? "rgba(245,158,11,0.28)"
    : "rgba(239,68,68,0.28)";
  const tagLabel = isBlocked ? "BLOQUEADO" : "ERRO FATAL";
  const icon = isBlocked ? "⊘" : "✕";

  return (
    <div
      style={{ ...s.wrap, background: bgColor, borderColor }}
      role="alert"
    >
      {/* Left icon */}
      <div style={{ ...s.iconWrap, borderColor, color }}>
        <span style={s.icon} aria-hidden="true">{icon}</span>
      </div>

      {/* Content */}
      <div style={s.content}>
        <div style={s.topRow}>
          <span style={{ ...s.tag, color, background: bgColor, borderColor }}>
            {tagLabel}
          </span>
          {error.code && (
            <span style={s.code}>{error.code}</span>
          )}
          {error.recoverable !== undefined && (
            <span
              style={{
                ...s.recoverableTag,
                color: error.recoverable ? "#10B981" : "var(--text-muted)",
                background: error.recoverable
                  ? "rgba(16,185,129,0.08)"
                  : "transparent",
                borderColor: error.recoverable
                  ? "rgba(16,185,129,0.25)"
                  : "var(--border)",
              }}
            >
              {error.recoverable ? "recuperável" : "não recuperável"}
            </span>
          )}
        </div>
        <p style={s.message}>{error.message}</p>
        {error.blockedAt && (
          <p style={s.timestamp}>
            {isBlocked ? "Bloqueado" : "Falhou"} em {formatTsFull(error.blockedAt)}
          </p>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    padding: "14px 18px",
    border: "1px solid",
    borderRadius: "var(--radius-lg)",
    flexShrink: 0,
  },
  iconWrap: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  icon: {
    fontSize: "14px",
    fontWeight: 700,
    lineHeight: 1,
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "6px",
  },
  tag: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid",
  },
  code: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "2px 7px",
    borderRadius: "3px",
  },
  recoverableTag: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid",
    letterSpacing: "0.3px",
  },
  message: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    marginBottom: "4px",
  },
  timestamp: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.3px",
  },
};
