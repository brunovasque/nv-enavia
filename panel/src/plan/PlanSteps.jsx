// ============================================================================
// PlanSteps — plano canônico em steps legíveis
// Priorizando legibilidade: lista clara, sem timeline fancy
// ============================================================================

import { STEP_STATUS } from "./mockPlan";
import { targetFields } from "../chat/useTargetState";

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

// ── Action badge metadata ─────────────────────────────────────────────────────
const ACTION_META = {
  http_get:            { label: "GET",       color: "#3B82F6", bg: "rgba(59,130,246,0.1)",  border: "rgba(59,130,246,0.25)" },
  http_post:           { label: "POST",      color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.25)" },
  discover_endpoints:  { label: "DISCOVER",  color: "#8B5CF6", bg: "rgba(139,92,246,0.1)",  border: "rgba(139,92,246,0.25)" },
  validate_config:     { label: "VALIDATE",  color: "#10B981", bg: "rgba(16,185,129,0.1)",  border: "rgba(16,185,129,0.25)" },
  read_logs:           { label: "LOGS",      color: "#6B7280", bg: "rgba(107,114,128,0.1)", border: "rgba(107,114,128,0.25)" },
};

function formatExpected(expected) {
  if (!expected || typeof expected !== "object") return null;
  const parts = [];
  if (typeof expected.status === "number") parts.push(`HTTP ${expected.status}`);
  if (Array.isArray(expected.contains) && expected.contains.length > 0) {
    parts.push(`contains: ${expected.contains.join(", ")}`);
  }
  if (typeof expected.matches === "string") parts.push(`matches: ${expected.matches}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}

function StepRow({ step, index, total }) {
  const meta = STEP_META[step.status] ?? STEP_META[STEP_STATUS.PENDING];
  const isLast = index === total - 1;
  const actionMeta = step.action ? (ACTION_META[step.action] ?? null) : null;
  const expectedSummary = formatExpected(step.expected);

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
          {/* Executable step details */}
          {(actionMeta || step.input || expectedSummary || step.safe === true) && (
            <div style={s.execRow}>
              {actionMeta && (
                <span style={{ ...s.execBadge, color: actionMeta.color, background: actionMeta.bg, borderColor: actionMeta.border }}>
                  {actionMeta.label}
                </span>
              )}
              {step.input && (
                <span style={s.execPath}>{step.input}</span>
              )}
              {expectedSummary && (
                <span style={s.execExpected}>→ {expectedSummary}</span>
              )}
              {step.safe === true && (
                <span style={s.safeChip}>safe</span>
              )}
            </div>
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

function TargetMetaRow({ target }) {
  const parts = targetFields(target);

  if (parts.length === 0) return null;

  return (
    <div style={s.targetMeta}>
      {parts.map(({ label, value }) => (
        <span key={label} style={s.targetChip}>
          <span style={s.targetChipLabel}>{label}</span>
          <span style={s.targetChipValue}>{value}</span>
        </span>
      ))}
    </div>
  );
}

export default function PlanSteps({ canonicalPlan, targetInfo }) {
  if (!canonicalPlan) return null;
  const { objective, steps } = canonicalPlan;

  if (!steps || steps.length === 0) {
    return (
      <div style={s.card}>
        <div style={s.cardHeader}>
          <p style={s.cardTitle}>Plano Canônico</p>
        </div>
        {targetInfo && <TargetMetaRow target={targetInfo} />}
        {objective && <p style={s.objective}>{objective}</p>}
        <p style={s.empty}>Nenhum plano estruturado disponível.</p>
      </div>
    );
  }

  const done = steps.filter((step) => step.status === STEP_STATUS.DONE).length;
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

      {/* Target metadata — separate from objective */}
      {targetInfo && <TargetMetaRow target={targetInfo} />}

      {/* Objective — shown when present */}
      {objective && <p style={s.objective}>{objective}</p>}

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
  targetMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
  },
  targetChip: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "2px 8px",
    fontSize: "11px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "4px",
  },
  targetChipLabel: {
    color: "var(--text-muted)",
    fontWeight: 600,
    letterSpacing: "0.3px",
  },
  targetChipValue: {
    color: "var(--text-secondary)",
    fontFamily: "var(--font-mono)",
  },
  objective: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    padding: "10px 12px",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-sm)",
    borderLeft: "3px solid var(--color-primary)",
  },
  empty: {
    fontSize: "13px",
    color: "var(--text-muted)",
    fontStyle: "italic",
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
  // Executable step styles
  execRow: {
    display: "flex",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "5px",
    marginTop: "5px",
    marginBottom: "2px",
  },
  execBadge: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    padding: "1px 6px",
    borderRadius: "3px",
    border: "1px solid",
    flexShrink: 0,
  },
  execPath: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--text-secondary)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "1px 6px",
    borderRadius: "3px",
    maxWidth: "260px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  execExpected: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    whiteSpace: "nowrap",
  },
  safeChip: {
    fontSize: "10px",
    fontWeight: 600,
    color: "#10B981",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.2)",
    padding: "1px 5px",
    borderRadius: "3px",
    letterSpacing: "0.3px",
    flexShrink: 0,
  },
};
