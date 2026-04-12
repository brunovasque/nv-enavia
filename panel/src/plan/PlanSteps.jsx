// ============================================================================
// PlanSteps — plano canônico em steps legíveis
// Priorizando legibilidade: lista clara, sem timeline fancy
// ============================================================================

import { STEP_STATUS } from "./mockPlan";

const STEP_META = {
  [STEP_STATUS.DONE]: {
    marker: "✓",
    markerColor: "#10B981",
    markerBg: "rgba(16,185,129,0.12)",
    markerBorder: "rgba(16,185,129,0.3)",
    labelColor: "var(--text-secondary)",
    badge: "Concluído",
    badgeColor: "#10B981",
    badgeBg: "rgba(16,185,129,0.1)",
    badgeBorder: "rgba(16,185,129,0.25)",
  },
  [STEP_STATUS.ACTIVE]: {
    marker: "→",
    markerColor: "var(--color-primary)",
    markerBg: "var(--color-primary-glow)",
    markerBorder: "var(--color-primary-border)",
    labelColor: "var(--text-primary)",
    badge: "Em andamento",
    badgeColor: "var(--color-primary)",
    badgeBg: "var(--color-primary-glow)",
    badgeBorder: "var(--color-primary-border)",
  },
  [STEP_STATUS.PENDING]: {
    marker: "○",
    markerColor: "var(--text-muted)",
    markerBg: "transparent",
    markerBorder: "var(--border-light)",
    labelColor: "var(--text-muted)",
    badge: "Pendente",
    badgeColor: "var(--text-muted)",
    badgeBg: "transparent",
    badgeBorder: "var(--border)",
  },
  [STEP_STATUS.SKIPPED]: {
    marker: "–",
    markerColor: "var(--text-muted)",
    markerBg: "transparent",
    markerBorder: "var(--border)",
    labelColor: "var(--text-muted)",
    badge: "Ignorado",
    badgeColor: "var(--text-muted)",
    badgeBg: "transparent",
    badgeBorder: "var(--border)",
  },
};

function formatDuration(ms) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function StepRow({ step, index, total }) {
  const meta = STEP_META[step.status] ?? STEP_META[STEP_STATUS.PENDING];
  const isLast = index === total - 1;

  return (
    <div style={s.stepOuter}>
      {/* Connector line */}
      {!isLast && <div style={s.connector} aria-hidden="true" />}

      <div style={s.stepRow}>
        {/* Marker */}
        <div
          style={{
            ...s.marker,
            color: meta.markerColor,
            background: meta.markerBg,
            borderColor: meta.markerBorder,
          }}
          aria-hidden="true"
        >
          {meta.marker}
        </div>

        {/* Content */}
        <div style={s.stepContent}>
          <div style={s.stepTop}>
            <p style={{ ...s.stepLabel, color: meta.labelColor }}>
              <span style={s.stepNum}>#{index + 1}</span>
              {step.label}
            </p>
            <div style={s.stepMeta}>
              {step.durationMs && (
                <span style={s.duration}>{formatDuration(step.durationMs)}</span>
              )}
              <span
                style={{
                  ...s.badge,
                  color: meta.badgeColor,
                  background: meta.badgeBg,
                  borderColor: meta.badgeBorder,
                }}
              >
                {meta.badge}
              </span>
            </div>
          </div>
          {step.description && (
            <p style={s.stepDesc}>{step.description}</p>
          )}
          {step.deps && step.deps.length > 0 && (
            <p style={s.stepDeps}>
              Depende de:{" "}
              {step.deps.map((d) => (
                <span key={d} style={s.depTag}>{d}</span>
              ))}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function PlanSteps({ canonicalPlan }) {
  if (!canonicalPlan) return null;
  const { steps } = canonicalPlan;

  const done = steps.filter((s) => s.status === STEP_STATUS.DONE).length;
  const total = steps.length;

  return (
    <div style={s.card}>
      {/* Header */}
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Plano Canônico</p>
        <span style={s.progress}>
          {done}/{total} concluídos
        </span>
      </div>

      {/* Progress bar */}
      <div style={s.progressTrack}>
        <div
          style={{
            ...s.progressFill,
            width: `${total > 0 ? (done / total) * 100 : 0}%`,
          }}
        />
      </div>

      {/* Steps */}
      <div style={s.steps}>
        {steps.map((step, i) => (
          <StepRow key={step.id} step={step} index={i} total={steps.length} />
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
    gap: "14px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  progress: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  progressTrack: {
    height: "3px",
    background: "var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    background: "var(--color-primary)",
    borderRadius: "2px",
    transition: "width 0.4s ease",
  },
  steps: {
    display: "flex",
    flexDirection: "column",
    gap: 0,
  },
  stepOuter: {
    position: "relative",
    paddingLeft: "36px",
    paddingBottom: "16px",
  },
  connector: {
    position: "absolute",
    left: "15px",
    top: "30px",
    bottom: 0,
    width: "1px",
    background: "var(--border)",
  },
  stepRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    position: "relative",
  },
  marker: {
    position: "absolute",
    left: "-36px",
    top: "0",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    fontWeight: 700,
    flexShrink: 0,
  },
  stepContent: {
    flex: 1,
    minWidth: 0,
    paddingTop: "4px",
  },
  stepTop: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "4px",
  },
  stepLabel: {
    fontSize: "13px",
    fontWeight: 600,
    lineHeight: 1.3,
    flex: 1,
  },
  stepNum: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text-muted)",
    marginRight: "6px",
    fontWeight: 400,
  },
  stepMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  duration: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  badge: {
    fontSize: "10px",
    fontWeight: 600,
    padding: "2px 7px",
    borderRadius: "4px",
    border: "1px solid",
    letterSpacing: "0.3px",
    whiteSpace: "nowrap",
  },
  stepDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    marginBottom: "4px",
  },
  stepDeps: {
    fontSize: "11px",
    color: "var(--text-muted)",
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
  },
  depTag: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "1px 5px",
    borderRadius: "3px",
  },
};
