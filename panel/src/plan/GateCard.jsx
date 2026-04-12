// ============================================================================
// GateCard — gate humano: estado, aprovador, timeout, motivo
// ============================================================================

const GATE_META = {
  pending: {
    label: "Aguardando aprovação",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: "⏳",
  },
  approved: {
    label: "Aprovado",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: "✓",
  },
  blocked: {
    label: "Bloqueado",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
  dispensed: {
    label: "Dispensado",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    icon: "○",
  },
};

function Row({ label, value, mono = false }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ ...s.rowValue, ...(mono ? { fontFamily: "var(--font-mono)", fontSize: "11px" } : {}) }}>
        {value}
      </span>
    </div>
  );
}

export default function GateCard({ gate }) {
  if (!gate) return null;
  const { required, state, approver, timeout, reason } = gate;
  const meta = GATE_META[state] ?? GATE_META.pending;

  return (
    <div
      style={{
        ...s.card,
        borderColor: meta.border,
      }}
    >
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Gate Humano</p>
        <span
          style={{
            ...s.stateBadge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      <div style={s.rows}>
        <Row label="Obrigatório" value={required ? "Sim" : "Não"} />
        <Row label="Aprovador" value={approver ?? "—"} />
        {timeout && <Row label="Timeout" value={timeout} mono />}
      </div>

      {reason && (
        <div style={{ ...s.reasonBlock, borderColor: meta.border }}>
          <p style={s.reasonText}>{reason}</p>
        </div>
      )}
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid",
    borderRadius: "var(--radius-lg)",
    padding: "16px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "8px",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  stateBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid",
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  rowValue: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 500,
    textAlign: "right",
  },
  reasonBlock: {
    marginTop: "10px",
    padding: "8px 10px",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-sm)",
    borderLeft: "2px solid",
  },
  reasonText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
};
