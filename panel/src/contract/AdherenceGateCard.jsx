// ============================================================================
// ENAVIA Panel — AdherenceGateCard (PR4)
//
// Shows the contract adherence gate result: decision, reason, approval status.
// Consumes the shape from contract-adherence-engine.js (PR3).
// ============================================================================

const DECISION_META = {
  ALLOW: { label: "ALLOW",  color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.28)", icon: "✓" },
  WARN:  { label: "WARN",   color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.28)", icon: "⚠" },
  BLOCK: { label: "BLOCK",  color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",  icon: "✕" },
};

const FALLBACK_META = { label: "—", color: "var(--text-muted)", bg: "transparent", border: "var(--border)", icon: "◌" };

/**
 * @param {{ adherence: object | null }} props
 */
export default function AdherenceGateCard({ adherence }) {
  if (!adherence) return null;

  const meta = DECISION_META[adherence.decision] || FALLBACK_META;

  return (
    <div style={s.card} data-testid="adherence-gate-card">
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerIcon} aria-hidden="true">🛡️</span>
        <span style={s.headerTitle}>ADERÊNCIA CONTRATUAL</span>
      </div>

      {/* Decision badge */}
      <div style={s.decisionRow}>
        <span
          style={{
            ...s.decisionBadge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
          data-testid="adherence-decision"
          role="status"
          aria-label={`Decisão: ${meta.label}`}
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
        {adherence.requires_human_approval && (
          <span style={s.approvalBadge} data-testid="requires-approval">
            APROVAÇÃO HUMANA
          </span>
        )}
      </div>

      {/* Reason */}
      <div style={s.reasonBlock}>
        <div style={s.row}>
          <span style={s.label}>reason_code</span>
          <span style={s.valueMono}>{adherence.reason_code || "—"}</span>
        </div>
        <p style={s.reasonText} data-testid="adherence-reason">
          {adherence.reason_text || "Sem detalhes."}
        </p>
      </div>

      {/* Metadata */}
      <div style={s.metaGrid}>
        <div style={s.row}>
          <span style={s.label}>evaluated_at</span>
          <span style={s.valueTime}>{_fmtTs(adherence.evaluated_at)}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>resolution_strategy</span>
          <span style={s.value}>{adherence.resolution_strategy || "—"}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>relevant_blocks</span>
          <span style={s.value}>{adherence.relevant_blocks_count ?? 0}</span>
        </div>
        <div style={s.row}>
          <span style={s.label}>scope</span>
          <span style={s.value}>{adherence.scope || "default"}</span>
        </div>
      </div>
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
  decisionRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  decisionBadge: {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "13px",
    fontWeight: 700,
    letterSpacing: "1px",
    padding: "6px 14px",
    borderRadius: "6px",
    border: "1px solid",
  },
  approvalBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.28)",
    padding: "3px 8px",
    borderRadius: "4px",
  },
  reasonBlock: {
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  reasonText: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  metaGrid: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
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
};
