// ============================================================================
// BridgeCard — handoff entre módulos: estado da ponte, destino, payload
// ============================================================================

const BRIDGE_META = {
  waiting_gate: {
    label: "Aguardando gate",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: "⧗",
  },
  active: {
    label: "Ativa",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: "⇒",
  },
  ready: {
    label: "Pronta para execução",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    icon: "→",
  },
  blocked: {
    label: "Bloqueada",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
  idle: {
    label: "Inativa",
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

export default function BridgeCard({ bridge }) {
  if (!bridge) return null;
  const { module: mod, payload, state, description } = bridge;
  const meta = BRIDGE_META[state] ?? BRIDGE_META.idle;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Bridge</p>
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
        <Row label="Módulo destino" value={mod} mono />
        <Row label="Payload" value={payload} mono />
      </div>

      {description && (
        <p style={s.desc}>{description}</p>
      )}
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
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
    fontSize: "9px",
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
  desc: {
    marginTop: "10px",
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    paddingTop: "10px",
    borderTop: "1px solid var(--border)",
  },
};
