// ============================================================================
// ExecutionTimeline — stream vertical de eventos da execução
// Área principal da tela em running — legível e operacional
// ============================================================================

import { EVENT_META, EVENT_STATUS, formatTs, formatDuration } from "./mockExecution";

const STATUS_DOT_COLOR = {
  [EVENT_STATUS.DONE]:    "#10B981",
  [EVENT_STATUS.ACTIVE]:  "#00B4D8",
  [EVENT_STATUS.ERROR]:   "#EF4444",
  [EVENT_STATUS.BLOCKED]: "#F59E0B",
};

function EventRow({ event, isLast }) {
  const meta = EVENT_META[event.type] ?? { icon: "◎", color: "var(--text-muted)" };
  const isActive = event.status === EVENT_STATUS.ACTIVE;
  const isError = event.status === EVENT_STATUS.ERROR;
  const isBlocked = event.status === EVENT_STATUS.BLOCKED;
  const dotColor = STATUS_DOT_COLOR[event.status] ?? "var(--text-muted)";

  return (
    <div
      style={{
        ...s.row,
        ...(isActive ? s.rowActive : {}),
        ...(isError ? s.rowError : {}),
        ...(isBlocked ? s.rowBlocked : {}),
      }}
    >
      {/* Marker column */}
      <div style={s.markerCol}>
        {/* Icon circle */}
        <div
          style={{
            ...s.iconCircle,
            background: isActive
              ? "var(--color-primary-glow)"
              : isError
              ? "rgba(239,68,68,0.10)"
              : isBlocked
              ? "rgba(245,158,11,0.10)"
              : "var(--bg-base)",
            borderColor: isActive
              ? "var(--color-primary-border)"
              : isError
              ? "rgba(239,68,68,0.30)"
              : isBlocked
              ? "rgba(245,158,11,0.30)"
              : "var(--border)",
          }}
        >
          <span
            style={{ ...s.icon, color: meta.color }}
            aria-hidden="true"
          >
            {meta.icon}
          </span>
        </div>

        {/* Connector line */}
        {!isLast && <div style={s.connector} aria-hidden="true" />}
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Top row: label + timestamp */}
        <div style={s.contentTop}>
          <div style={s.labelGroup}>
            <span
              style={{
                ...s.label,
                color: isActive
                  ? "var(--text-primary)"
                  : isError || isBlocked
                  ? "var(--text-primary)"
                  : "var(--text-secondary)",
                fontWeight: isActive ? 700 : 600,
              }}
            >
              {event.label}
            </span>
            {/* Status badges */}
            {isActive && (
              <span style={s.activeTag}>EM CURSO</span>
            )}
            {isError && (
              <span style={{ ...s.activeTag, ...s.errorTag }}>ERRO</span>
            )}
            {isBlocked && (
              <span style={{ ...s.activeTag, ...s.blockedTag }}>BLOQUEADO</span>
            )}
            {event.durationMs && (
              <span style={s.durationTag}>{formatDuration(event.durationMs)}</span>
            )}
          </div>
          <span style={s.timestamp}>{formatTs(event.timestamp)}</span>
        </div>

        {/* Detail */}
        {event.detail && (
          <p style={s.detail}>{event.detail}</p>
        )}

        {/* Active pulse indicator row */}
        {isActive && (
          <div style={s.activeIndicator}>
            <span className="exec-dot-pulse" style={s.activeDot} aria-hidden="true" />
            <span style={s.activeText}>aguardando conclusão</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ExecutionTimeline({ events, isHistory }) {
  if (!events || events.length === 0) {
    return (
      <div style={s.card}>
        <p style={s.cardTitle}>Trilha de execução</p>
        <div style={s.empty}>
          <span style={s.emptyIcon} aria-hidden="true">◎</span>
          <p style={s.emptyText}>Nenhum evento registrado ainda.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ ...s.card, ...(isHistory ? s.cardHistory : {}) }}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>
          {isHistory ? "Histórico de eventos" : "Trilha de execução"}
        </p>
        <span style={s.eventCount}>{events.length} eventos</span>
      </div>

      <div style={s.timeline}>
        {events.map((event, idx) => (
          <EventRow
            key={event.id}
            event={event}
            isLast={idx === events.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    // In running: this fills all available height (set via parent)
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  cardHistory: {
    flex: "none",
    overflow: "visible",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  eventCount: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  timeline: {
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    flex: 1,
    minHeight: 0,
    // Subtle scrollbar
    paddingRight: "4px",
  },

  // Event row
  row: {
    display: "flex",
    gap: 0,
    alignItems: "flex-start",
    padding: "2px 0",
    borderRadius: "var(--radius-md)",
    transition: "background 0.15s ease",
  },
  rowActive: {
    background: "rgba(0,180,216,0.04)",
    borderRadius: "var(--radius-md)",
    margin: "2px -8px",
    padding: "6px 8px",
  },
  rowError: {
    background: "rgba(239,68,68,0.04)",
    borderRadius: "var(--radius-md)",
    margin: "2px -8px",
    padding: "6px 8px",
  },
  rowBlocked: {
    background: "rgba(245,158,11,0.04)",
    borderRadius: "var(--radius-md)",
    margin: "2px -8px",
    padding: "6px 8px",
  },

  // Marker
  markerCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "36px",
    minWidth: "36px",
    flexShrink: 0,
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
    zIndex: 1,
  },
  icon: {
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
  },
  connector: {
    width: "1px",
    flex: 1,
    minHeight: "18px",
    background: "var(--border)",
    marginTop: "3px",
    marginBottom: "3px",
  },

  // Content
  content: {
    flex: 1,
    minWidth: 0,
    paddingLeft: "12px",
    paddingTop: "4px",
    paddingBottom: "10px",
  },
  contentTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "3px",
  },
  labelGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
  },
  label: {
    fontSize: "13px",
    lineHeight: 1.3,
  },
  timestamp: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    flexShrink: 0,
    marginTop: "1px",
    letterSpacing: "0.3px",
  },
  detail: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    marginTop: "1px",
  },

  // Badges
  activeTag: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 6px",
    borderRadius: "3px",
    flexShrink: 0,
  },
  errorTag: {
    color: "#EF4444",
    background: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.30)",
  },
  blockedTag: {
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.30)",
  },
  durationTag: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "1px 6px",
    borderRadius: "3px",
  },

  // Active indicator
  activeIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "6px",
  },
  activeDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    display: "inline-block",
    flexShrink: 0,
  },
  activeText: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
    fontStyle: "italic",
  },

  // Empty state
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "32px 0",
  },
  emptyIcon: {
    fontSize: "24px",
    color: "var(--text-muted)",
    opacity: 0.4,
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
};
