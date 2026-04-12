// ============================================================================
// ExecutionStatusCard — sidebar card: métricas gerais da execução
// ============================================================================

import { EXECUTION_STATUS, formatElapsed } from "./mockExecution";

const STATUS_LABEL = {
  [EXECUTION_STATUS.IDLE]:      "Aguardando",
  [EXECUTION_STATUS.RUNNING]:   "Em execução",
  [EXECUTION_STATUS.BLOCKED]:   "Bloqueado",
  [EXECUTION_STATUS.FAILED]:    "Falhou",
  [EXECUTION_STATUS.COMPLETED]: "Concluído",
};

function MetricRow({ label, value, mono, valueColor }) {
  return (
    <div style={s.metricRow}>
      <span style={s.metricLabel}>{label}</span>
      <span
        style={{
          ...s.metricValue,
          ...(mono ? { fontFamily: "var(--font-mono)", fontSize: "11px" } : {}),
          ...(valueColor ? { color: valueColor } : {}),
        }}
      >
        {value}
      </span>
    </div>
  );
}

export default function ExecutionStatusCard({ execution }) {
  if (!execution) return null;

  const { metrics, status, planId, id } = execution;
  const progressPct =
    metrics.stepsTotal > 0
      ? Math.round((metrics.stepsDone / metrics.stepsTotal) * 100)
      : 0;

  return (
    <div style={s.card}>
      <p style={s.cardTitle}>Status da execução</p>

      {/* Progress bar */}
      <div style={s.progressSection}>
        <div style={s.progressHeader}>
          <span style={s.progressLabel}>
            {metrics.stepsDone}/{metrics.stepsTotal} etapas
          </span>
          <span style={s.progressPct}>{progressPct}%</span>
        </div>
        <div style={s.progressTrack}>
          <div
            style={{
              ...s.progressFill,
              width: `${progressPct}%`,
              background:
                status === EXECUTION_STATUS.FAILED
                  ? "#EF4444"
                  : status === EXECUTION_STATUS.BLOCKED
                  ? "#F59E0B"
                  : status === EXECUTION_STATUS.COMPLETED
                  ? "#10B981"
                  : "var(--color-primary)",
            }}
          />
        </div>
      </div>

      {/* Metrics */}
      <div style={s.metrics}>
        <MetricRow
          label="Estado"
          value={STATUS_LABEL[status] ?? status}
          valueColor={
            status === EXECUTION_STATUS.RUNNING
              ? "var(--color-primary)"
              : status === EXECUTION_STATUS.COMPLETED
              ? "#10B981"
              : status === EXECUTION_STATUS.FAILED
              ? "#EF4444"
              : status === EXECUTION_STATUS.BLOCKED
              ? "#F59E0B"
              : "var(--text-muted)"
          }
        />
        <MetricRow
          label="Decorrido"
          value={formatElapsed(metrics.elapsedMs)}
          mono
        />
        {metrics.estimatedMs > 0 && (
          <MetricRow
            label="Estimado"
            value={formatElapsed(metrics.estimatedMs)}
            mono
          />
        )}
        <MetricRow label="Plano" value={planId} mono />
        <MetricRow label="Execução" value={id} mono />
      </div>
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  progressSection: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  progressHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
  },
  progressPct: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
  },
  progressTrack: {
    height: "4px",
    background: "var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.4s ease",
  },
  metrics: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  metricRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "7px 0",
    borderBottom: "1px solid var(--border)",
  },
  metricLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  metricValue: {
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-secondary)",
    textAlign: "right",
    maxWidth: "140px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
};
