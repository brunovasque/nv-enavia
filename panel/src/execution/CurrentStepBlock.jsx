// ============================================================================
// CurrentStepBlock — etapa ativa com indicador de atividade pulsante
// ============================================================================

import { formatTs } from "./mockExecution";

export default function CurrentStepBlock({ step }) {
  if (!step) return null;

  return (
    <div style={s.wrap}>
      {/* Left: pulsing indicator */}
      <div style={s.indicatorCol} aria-hidden="true">
        <div style={s.outerRing}>
          <div style={s.innerDot} className="exec-dot-pulse" />
        </div>
        <div style={s.indicatorLine} />
      </div>

      {/* Right: step info */}
      <div style={s.content}>
        <div style={s.topRow}>
          <span style={s.sectionLabel}>ETAPA ATUAL</span>
          <span style={s.activeBadge}>EM CURSO</span>
        </div>
        <p style={s.stepLabel}>{step.label}</p>
        {step.description && (
          <p style={s.stepDesc}>{step.description}</p>
        )}
        {step.startedAt && (
          <p style={s.startedAt}>iniciado às {formatTs(step.startedAt)}</p>
        )}
      </div>
    </div>
  );
}

const s = {
  wrap: {
    display: "flex",
    gap: 0,
    background: "var(--bg-surface)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    alignItems: "flex-start",
    flexShrink: 0,
    position: "relative",
    overflow: "hidden",
  },
  indicatorCol: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    marginRight: "16px",
    flexShrink: 0,
  },
  outerRing: {
    width: "20px",
    height: "20px",
    borderRadius: "50%",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginTop: "2px",
  },
  innerDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    boxShadow: "0 0 6px rgba(0,180,216,0.6)",
  },
  indicatorLine: {
    width: "1px",
    flex: 1,
    minHeight: "8px",
    background: "var(--color-primary-border)",
    marginTop: "4px",
  },
  content: {
    flex: 1,
    minWidth: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    marginBottom: "6px",
  },
  sectionLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.4px",
    textTransform: "uppercase",
  },
  activeBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 7px",
    borderRadius: "4px",
  },
  stepLabel: {
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "4px",
    lineHeight: 1.3,
  },
  stepDesc: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: "6px",
  },
  startedAt: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
};
