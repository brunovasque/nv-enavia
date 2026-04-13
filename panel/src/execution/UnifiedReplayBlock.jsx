// ============================================================================
// UnifiedReplayBlock — F5-PR4 (Frente 5 — Observabilidade Operacional)
//
// Replay unificado da execução: consolida em uma única timeline ordenada
// as trilhas de operação cognitiva (F5-PR1), browser (F5-PR2) e código (F5-PR3).
//
// Props:
//   events        — eventos operacionais (execution.events)
//   browserEvents — eventos da sessão browser (execution.browserEvents)
//   codeEvents    — eventos da trilha de código (execution.codeEvents)
//   executionSummary — resumo final da execução
//
// Regra: nenhum campo é inventado. Ausência = estado honesto.
// Dados demo/mock são identificados com badge "DEMO".
// Replay completo com dados reais do backend não existe nesta PR.
// ============================================================================

import { EVENT_META, EVENT_STATUS, formatTs } from "./mockExecution";

// ── Track display metadata ─────────────────────────────────────────────────

const TRACK_META = {
  cognitive: {
    label: "Cognitivo",
    color: "#00B4D8",
    bg: "rgba(0,180,216,0.08)",
    border: "rgba(0,180,216,0.20)",
    icon: "◆",
  },
  browser: {
    label: "Browser",
    color: "#8B5CF6",
    bg: "rgba(139,92,246,0.08)",
    border: "rgba(139,92,246,0.20)",
    icon: "⊞",
  },
  code: {
    label: "Código",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.20)",
    icon: "⚙",
  },
};

const STATUS_COLOR = {
  [EVENT_STATUS.DONE]:    "#10B981",
  [EVENT_STATUS.ACTIVE]:  "#00B4D8",
  [EVENT_STATUS.ERROR]:   "#EF4444",
  [EVENT_STATUS.BLOCKED]: "#F59E0B",
};

const FINAL_STATUS_META = {
  completed: {
    label: "Concluída",
    color: "#10B981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.30)",
    icon: "✓",
  },
  blocked: {
    label: "Bloqueada",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.30)",
    icon: "✕",
  },
  failed: {
    label: "Com erro",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.30)",
    icon: "✕",
  },
};

// ── Helpers ────────────────────────────────────────────────────────────────

function mergeAndSort(events, browserEvents, codeEvents) {
  const cognitive = (events ?? []).map((e) => ({ ...e, track: "cognitive" }));
  const browser   = (browserEvents ?? []).map((e) => ({ ...e, track: "browser" }));
  const code      = (codeEvents ?? []).map((e) => ({ ...e, track: "code" }));
  const all = [...cognitive, ...browser, ...code];
  all.sort((a, b) => {
    const ta = a.timestamp ? new Date(a.timestamp).getTime() : 0;
    const tb = b.timestamp ? new Date(b.timestamp).getTime() : 0;
    return ta - tb;
  });
  return all;
}

// ── Sub-components ─────────────────────────────────────────────────────────

function TrackBadge({ track }) {
  const meta = TRACK_META[track] ?? TRACK_META.cognitive;
  return (
    <span
      style={{
        fontSize: "8px",
        fontWeight: 700,
        letterSpacing: "0.9px",
        textTransform: "uppercase",
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        padding: "1px 5px",
        borderRadius: "3px",
        flexShrink: 0,
        fontFamily: "var(--font-mono)",
      }}
    >
      {meta.label}
    </span>
  );
}

function ReplayRow({ event, index, isLast }) {
  const track = event.track ?? "cognitive";
  const trackMeta = TRACK_META[track] ?? TRACK_META.cognitive;
  const eventMeta = EVENT_META[event.type] ?? { icon: trackMeta.icon, color: trackMeta.color };

  const isError   = event.status === EVENT_STATUS.ERROR;
  const isBlocked = event.status === EVENT_STATUS.BLOCKED;
  const isActive  = event.status === EVENT_STATUS.ACTIVE;

  return (
    <div
      style={{
        ...s.row,
        ...(isError ? s.rowError : {}),
        ...(isBlocked ? s.rowBlocked : {}),
        ...(isActive ? s.rowActive : {}),
      }}
    >
      {/* Step number + connector column */}
      <div style={s.markerCol}>
        <div
          style={{
            ...s.stepCircle,
            borderColor: isError
              ? "rgba(239,68,68,0.35)"
              : isBlocked
              ? "rgba(245,158,11,0.35)"
              : trackMeta.border,
            background: isError
              ? "rgba(239,68,68,0.08)"
              : isBlocked
              ? "rgba(245,158,11,0.08)"
              : trackMeta.bg,
          }}
        >
          <span style={{ ...s.stepIcon, color: eventMeta.color }}>
            {eventMeta.icon}
          </span>
        </div>
        {!isLast && (
          <div
            style={{
              ...s.connector,
              borderLeftColor: trackMeta.border,
            }}
            aria-hidden="true"
          />
        )}
      </div>

      {/* Content */}
      <div style={s.content}>
        {/* Top row */}
        <div style={s.contentTop}>
          <div style={s.labelGroup}>
            {/* Order number */}
            <span style={s.orderNum}>#{index + 1}</span>
            {/* Track badge */}
            <TrackBadge track={track} />
            {/* Label */}
            <span
              style={{
                ...s.label,
                color: isError || isBlocked
                  ? STATUS_COLOR[event.status]
                  : "var(--text-secondary)",
              }}
            >
              {event.label}
            </span>
            {/* Status badges */}
            {isError && <span style={{ ...s.statusTag, ...s.errorTag }}>ERRO</span>}
            {isBlocked && <span style={{ ...s.statusTag, ...s.blockedTag }}>BLOQUEADO</span>}
          </div>
          <span style={s.timestamp}>{formatTs(event.timestamp)}</span>
        </div>

        {/* Detail */}
        {event.detail && (
          <p style={s.detail}>{event.detail}</p>
        )}
      </div>
    </div>
  );
}

function ExecutionSummary({ summary }) {
  if (!summary) return null;

  const statusMeta = FINAL_STATUS_META[summary.finalStatus] ?? {
    label: summary.finalStatus ?? "Desconhecido",
    color: "var(--text-muted)",
    bg: "var(--bg-base)",
    border: "var(--border)",
    icon: "?",
  };

  function YesNo({ value, labelYes, labelNo }) {
    const yes = !!value;
    return (
      <div style={s.summaryRow}>
        <span style={s.summaryDot} aria-hidden="true">
          {yes ? "◎" : "○"}
        </span>
        <span style={{ ...s.summaryText, color: yes ? "var(--text-primary)" : "var(--text-muted)" }}>
          {yes ? labelYes : labelNo}
        </span>
      </div>
    );
  }

  return (
    <div style={s.summaryBlock}>
      <div style={s.summaryHeader}>
        <div
          style={{
            ...s.statusBadge,
            color: statusMeta.color,
            background: statusMeta.bg,
            border: `1px solid ${statusMeta.border}`,
          }}
        >
          <span aria-hidden="true">{statusMeta.icon}</span>
          <span>{statusMeta.label}</span>
        </div>
        <p style={s.summaryTitle}>Resumo da execução</p>
      </div>

      <div style={s.summaryRows}>
        <YesNo
          value={summary.hadBlocker}
          labelYes="Houve bloqueio durante a execução"
          labelNo="Sem bloqueio registrado"
        />
        <YesNo
          value={summary.hadBrowserNavigation}
          labelYes="Houve navegação browser"
          labelNo="Sem navegação browser"
        />
        <YesNo
          value={summary.hadCodeChange}
          labelYes="Houve mudança de código"
          labelNo="Sem mudança de código"
        />
      </div>

      {summary.nextAction && (
        <div style={s.nextAction}>
          <span style={s.nextActionIcon} aria-hidden="true">⏭</span>
          <div>
            <p style={s.nextActionLabel}>Próxima ação</p>
            <p style={s.nextActionText}>{summary.nextAction}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────

/**
 * @param {{
 *   events: Array,
 *   browserEvents: Array,
 *   codeEvents: Array,
 *   executionSummary: object|null,
 * }} props
 */
export default function UnifiedReplayBlock({ events, browserEvents, codeEvents, executionSummary }) {
  const allEvents = mergeAndSort(events, browserEvents, codeEvents);
  const hasEvents = allEvents.length > 0;
  const hasSummary = !!executionSummary;
  const isEmpty = !hasEvents && !hasSummary;

  // Determine whether any demo data is present
  const hasDemoData = (browserEvents?.length > 0) || (codeEvents?.length > 0);

  return (
    <div style={s.card}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.replayIcon} aria-hidden="true">⊡</span>
          <p style={s.cardTitle}>Replay da execução</p>
          {/* Track legend */}
          {hasEvents && (
            <div style={s.legend}>
              {Object.entries(TRACK_META).map(([key, meta]) => (
                <div key={key} style={s.legendItem}>
                  <span style={{ ...s.legendDot, background: meta.color }} aria-hidden="true" />
                  <span style={{ ...s.legendLabel, color: meta.color }}>{meta.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        {hasDemoData && (
          <span style={s.demoBadge}>DEMO</span>
        )}
        {isEmpty && (
          <span style={s.emptyBadge}>SEM DADOS</span>
        )}
      </div>

      {/* Empty state */}
      {isEmpty && (
        <div style={s.emptyState}>
          <span style={s.emptyIcon} aria-hidden="true">⊡</span>
          <p style={s.emptyText}>
            Nenhum evento de replay disponível para o estado atual.
          </p>
          <p style={s.emptyHint}>
            A timeline consolidada aparecerá aqui após a conclusão ou encerramento da execução.
          </p>
        </div>
      )}

      {/* Unified timeline */}
      {hasEvents && (
        <div style={s.timeline}>
          {allEvents.map((event, idx) => (
            <ReplayRow
              key={`${event.track ?? "cognitive"}-${event.id}`}
              event={event}
              index={idx}
              isLast={idx === allEvents.length - 1}
            />
          ))}
        </div>
      )}

      {/* Execution summary */}
      {hasSummary && <ExecutionSummary summary={executionSummary} />}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    flexShrink: 0,
  },

  // Header
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flex: 1,
    minWidth: 0,
    flexWrap: "wrap",
  },
  replayIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.8,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    flexShrink: 0,
  },
  demoBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.30)",
    padding: "2px 7px",
    borderRadius: "4px",
    flexShrink: 0,
  },
  emptyBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "2px 7px",
    borderRadius: "4px",
    flexShrink: 0,
  },

  // Legend
  legend: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginLeft: "4px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  legendDot: {
    width: "5px",
    height: "5px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  legendLabel: {
    fontSize: "9px",
    fontWeight: 600,
    letterSpacing: "0.5px",
  },

  // Timeline
  timeline: {
    display: "flex",
    flexDirection: "column",
  },

  // Event row
  row: {
    display: "flex",
    gap: 0,
    alignItems: "flex-start",
    padding: "2px 0",
  },
  rowError: {
    background: "rgba(239,68,68,0.03)",
    borderRadius: "var(--radius-md)",
    margin: "1px -8px",
    padding: "4px 8px",
  },
  rowBlocked: {
    background: "rgba(245,158,11,0.03)",
    borderRadius: "var(--radius-md)",
    margin: "1px -8px",
    padding: "4px 8px",
  },
  rowActive: {
    background: "rgba(0,180,216,0.03)",
    borderRadius: "var(--radius-md)",
    margin: "1px -8px",
    padding: "4px 8px",
  },

  // Marker column
  markerCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    width: "32px",
    minWidth: "32px",
    flexShrink: 0,
  },
  stepCircle: {
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  stepIcon: {
    fontSize: "10px",
    fontWeight: 700,
    lineHeight: 1,
  },
  connector: {
    width: 0,
    flex: 1,
    minHeight: "14px",
    borderLeft: "1px dashed",
    marginTop: "2px",
    marginBottom: "2px",
    opacity: 0.4,
  },

  // Content
  content: {
    flex: 1,
    minWidth: 0,
    paddingLeft: "10px",
    paddingTop: "3px",
    paddingBottom: "8px",
  },
  contentTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "2px",
  },
  labelGroup: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    flexWrap: "wrap",
    flex: 1,
    minWidth: 0,
  },
  orderNum: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  label: {
    fontSize: "12px",
    lineHeight: 1.3,
    fontWeight: 500,
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
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    marginTop: "1px",
  },

  // Status badges
  statusTag: {
    fontSize: "8px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    padding: "1px 5px",
    borderRadius: "3px",
    flexShrink: 0,
  },
  errorTag: {
    color: "#EF4444",
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.30)",
  },
  blockedTag: {
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.30)",
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
    opacity: 0.35,
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  emptyHint: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1.5,
    maxWidth: "320px",
  },

  // Summary block
  summaryBlock: {
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  summaryHeader: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    padding: "3px 10px",
    borderRadius: "4px",
    flexShrink: 0,
  },
  summaryTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  summaryRows: {
    display: "flex",
    flexDirection: "column",
    gap: "5px",
  },
  summaryRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  summaryDot: {
    fontSize: "10px",
    color: "var(--text-muted)",
    width: "14px",
    textAlign: "center",
    flexShrink: 0,
  },
  summaryText: {
    fontSize: "12px",
    lineHeight: 1.4,
  },

  // Next action
  nextAction: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    paddingTop: "8px",
    borderTop: "1px solid var(--border)",
  },
  nextActionIcon: {
    fontSize: "12px",
    color: "var(--color-primary)",
    opacity: 0.7,
    marginTop: "1px",
    flexShrink: 0,
  },
  nextActionLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
    marginBottom: "2px",
  },
  nextActionText: {
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: 1.4,
    fontWeight: 500,
  },
};
