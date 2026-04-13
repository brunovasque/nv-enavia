// ============================================================================
// FunctionalLogsCard — P20 — Fase 5 Observabilidade
// Surface de logs funcionais legíveis: motivo de decisão, bloqueio e
// consolidação em linguagem clara para o operador humano.
//
// NÃO duplica:
//   - Replay detalhado (UnifiedReplayBlock)
//   - Operação ao vivo (OperationalLiveCard)
//   - Timeline macro (MacroCycleTimeline / P19)
//   - ExecutionTimeline (micro-eventos)
// ============================================================================

import { formatTs } from "./mockExecution";

// ── Log type metadata ─────────────────────────────────────────────────────────

const LOG_TYPE = {
  decisao:      "decisao",
  bloqueio:     "bloqueio",
  consolidacao: "consolidacao",
};

const TYPE_META = {
  [LOG_TYPE.decisao]: {
    label: "Decisão",
    icon: "◆",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    dotColor: "var(--color-primary)",
  },
  [LOG_TYPE.bloqueio]: {
    label: "Bloqueio",
    icon: "⊘",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.28)",
    dotColor: "#F59E0B",
  },
  [LOG_TYPE.consolidacao]: {
    label: "Consolidação",
    icon: "◎",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    dotColor: "#10B981",
  },
};

// ── LogEntry component ────────────────────────────────────────────────────────

function LogEntry({ log, isLast }) {
  const meta = TYPE_META[log.type] ?? TYPE_META[LOG_TYPE.decisao];

  return (
    <div
      style={{
        ...s.entry,
        ...(isLast ? {} : s.entryBorder),
      }}
      aria-label={`${meta.label}: ${log.label}`}
    >
      {/* Type badge + icon */}
      <div style={s.entryLeft}>
        <div
          style={{
            ...s.iconCircle,
            background: meta.bg,
            borderColor: meta.border,
          }}
          aria-hidden="true"
        >
          <span style={{ ...s.entryIcon, color: meta.color }}>{meta.icon}</span>
        </div>
        {/* Vertical connector — hidden on last entry */}
        {!isLast && <div style={s.connector} aria-hidden="true" />}
      </div>

      {/* Body */}
      <div style={s.entryBody}>
        {/* Header row */}
        <div style={s.entryHeader}>
          <span
            style={{
              ...s.typeBadge,
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
          >
            {meta.label}
          </span>
          {log.timestamp && (
            <span style={s.timestamp}>{formatTs(log.timestamp)}</span>
          )}
        </div>

        {/* Label (short title) */}
        <p style={s.entryLabel}>{log.label}</p>

        {/* Message (human-readable explanation) */}
        <p style={s.entryMessage}>{log.message}</p>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ functionalLogs: Array|null|undefined }} props
 *   functionalLogs — array of { id, type, label, message, timestamp }
 *                    pode ser null/undefined → estado vazio honesto.
 */
export default function FunctionalLogsCard({ functionalLogs }) {
  const isEmpty = !functionalLogs || !Array.isArray(functionalLogs) || functionalLogs.length === 0;

  return (
    <div style={s.card} role="region" aria-label="Logs funcionais legíveis">
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.titleIcon} aria-hidden="true">≡</span>
          <p style={s.cardTitle}>Logs funcionais</p>
        </div>
        <span
          style={{
            ...s.badge,
            ...(isEmpty ? s.badgeEmpty : s.badgeFilled),
          }}
        >
          {isEmpty ? "SEM LOGS" : `${functionalLogs.length} entrada${functionalLogs.length !== 1 ? "s" : ""}`}
        </span>
      </div>

      {/* Legend row */}
      {!isEmpty && (
        <div style={s.legend} aria-label="Legenda de tipos de log">
          {Object.values(LOG_TYPE).map((type) => {
            const meta = TYPE_META[type];
            return (
              <span key={type} style={s.legendItem}>
                <span style={{ ...s.legendDot, background: meta.dotColor }} aria-hidden="true" />
                <span style={{ ...s.legendLabel, color: meta.color }}>{meta.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Log entries or empty state */}
      <div style={s.logList}>
        {isEmpty ? (
          <div style={s.emptyState}>
            <span style={s.emptyIcon} aria-hidden="true">◎</span>
            <p style={s.emptyText}>
              Nenhum log funcional disponível para esta execução.
            </p>
            <p style={s.emptyHint}>
              Logs de decisão, bloqueio e consolidação aparecerão aqui quando a
              execução reportar raciocínio operacional.
            </p>
          </div>
        ) : (
          functionalLogs.map((log, idx) => (
            <LogEntry
              key={log.id}
              log={log}
              isLast={idx === functionalLogs.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  // Header
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
  },
  titleIcon: {
    fontSize: "15px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  badge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    padding: "2px 8px",
    borderRadius: "4px",
    border: "1px solid",
  },
  badgeFilled: {
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    borderColor: "var(--border)",
  },
  badgeEmpty: {
    color: "var(--text-muted)",
    background: "transparent",
    borderColor: "var(--border)",
    opacity: 0.6,
  },

  // Legend
  legend: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
    flexShrink: 0,
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  legendDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: "10px",
    fontWeight: 600,
    letterSpacing: "0.3px",
  },

  // Log list
  logList: {
    display: "flex",
    flexDirection: "column",
  },

  // Log entry
  entry: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    paddingBottom: "14px",
  },
  entryBorder: {
    // connector line rendered by entryLeft; no extra border needed
  },

  // Left column: icon + vertical line
  entryLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "0",
    flexShrink: 0,
    width: "28px",
  },
  iconCircle: {
    width: "28px",
    height: "28px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  entryIcon: {
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
  connector: {
    flex: 1,
    width: "1px",
    minHeight: "14px",
    background: "var(--border)",
    opacity: 0.5,
    marginTop: "4px",
  },

  // Entry body
  entryBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    paddingTop: "3px",
  },
  entryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  typeBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.6px",
    padding: "2px 7px",
    borderRadius: "3px",
    border: "1px solid",
    textTransform: "uppercase",
  },
  timestamp: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.3px",
    opacity: 0.75,
  },
  entryLabel: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-primary)",
    lineHeight: 1.35,
    margin: 0,
  },
  entryMessage: {
    fontSize: "12px",
    color: "var(--text-secondary, var(--text-muted))",
    lineHeight: 1.6,
    margin: 0,
  },

  // Empty state
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "20px 8px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "22px",
    color: "var(--text-muted)",
    opacity: 0.3,
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    margin: 0,
  },
  emptyHint: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1.5,
    maxWidth: "320px",
    margin: 0,
  },
};
