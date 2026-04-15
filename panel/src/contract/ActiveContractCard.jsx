// ============================================================================
// ENAVIA Panel — ActiveContractCard (PR4)
//
// Shows the currently active contract: ID, scope, phase, summary stats.
// Consumes the active_state shape from contract-active-state.js (PR2).
// ============================================================================

/**
 * @param {{ activeState: object | null }} props
 */
export default function ActiveContractCard({ activeState }) {
  if (!activeState) return null;

  const summary = activeState.summary_canonic || {};
  const meta = activeState.metadata || {};

  return (
    <div style={s.card} data-testid="active-contract-card">
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerIcon} aria-hidden="true">📜</span>
        <span style={s.headerTitle}>CONTRATO ATIVO</span>
      </div>

      {/* Contract ID + scope */}
      <div style={s.row}>
        <span style={s.label}>contract_id</span>
        <span style={s.valueMono} data-testid="contract-id">{activeState.contract_id}</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>scope</span>
        <span style={s.value}>{meta.scope || "default"}</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>fase atual</span>
        <span style={s.value}>{activeState.current_phase_hint || "—"}</span>
      </div>
      <div style={s.row}>
        <span style={s.label}>ativado em</span>
        <span style={s.valueTime}>{_fmtTs(activeState.activated_at)}</span>
      </div>
      {activeState.last_task_id && (
        <div style={s.row}>
          <span style={s.label}>última tarefa</span>
          <span style={s.valueMono}>{activeState.last_task_id}</span>
        </div>
      )}

      {/* Macro objective */}
      {summary.macro_objective && (
        <div style={s.objectiveBlock}>
          <span style={s.objectiveLabel}>Objetivo macro</span>
          <p style={s.objectiveText}>{summary.macro_objective}</p>
        </div>
      )}

      {/* Summary stats grid */}
      <div style={s.statsGrid}>
        <_Stat label="hard rules" value={summary.hard_rules_count ?? 0} />
        <_Stat label="acceptance" value={summary.acceptance_criteria_count ?? 0} />
        <_Stat label="approval pts" value={summary.approval_points_count ?? 0} />
        <_Stat label="blocking pts" value={summary.blocking_points_count ?? 0} />
        <_Stat label="seções" value={summary.sections_count ?? 0} />
        <_Stat label="blocos" value={summary.blocks_count ?? 0} />
      </div>

      {/* Detected phases */}
      {summary.detected_phases && summary.detected_phases.length > 0 && (
        <div style={s.phasesBlock}>
          <span style={s.phasesLabel}>Fases detectadas</span>
          <div style={s.phasesList}>
            {summary.detected_phases.map((phase, i) => (
              <span
                key={i}
                style={{
                  ...s.phaseBadge,
                  ...(phase === activeState.current_phase_hint ? s.phaseActive : {}),
                }}
              >
                {phase}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function _Stat({ label, value }) {
  return (
    <div style={s.statItem}>
      <span style={s.statValue}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

function _fmtTs(iso) {
  if (!iso) return "—";
  try {
    const d = new Date(iso);
    return d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
  } catch {
    return iso;
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginBottom: "2px",
  },
  headerIcon: { fontSize: "14px" },
  headerTitle: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    color: "var(--color-primary)",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  label: {
    fontSize: "11px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  value: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    textAlign: "right",
  },
  valueMono: {
    fontSize: "11px",
    color: "var(--text-primary)",
    fontFamily: "var(--font-mono)",
    textAlign: "right",
    wordBreak: "break-all",
  },
  valueTime: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
    textAlign: "right",
  },
  objectiveBlock: {
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
  },
  objectiveLabel: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    display: "block",
    marginBottom: "4px",
  },
  objectiveText: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "6px",
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "8px 4px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  statValue: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "9px",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
    textAlign: "center",
  },
  phasesBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  phasesLabel: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
  },
  phasesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  phaseBadge: {
    fontSize: "10px",
    fontWeight: 500,
    padding: "2px 8px",
    borderRadius: "4px",
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
  },
  phaseActive: {
    color: "var(--color-primary)",
    background: "rgba(0,180,216,0.12)",
    borderColor: "var(--color-primary-border)",
    fontWeight: 700,
  },
};
