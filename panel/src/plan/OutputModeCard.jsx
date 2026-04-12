// ============================================================================
// OutputModeCard — tipo de saída, formato, canal, streaming
// ============================================================================

const MODE_ICON = {
  STRUCTURED: "⬡",
  STREAM: "⟳",
  SYNC: "→",
  BATCH: "⊞",
};

const FORMAT_COLOR = {
  canonical_plan: "var(--color-primary)",
  json: "#10B981",
  markdown: "#F59E0B",
  text: "var(--text-secondary)",
};

function Row({ label, children }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{children}</span>
    </div>
  );
}

export default function OutputModeCard({ outputMode }) {
  if (!outputMode) return null;
  const { type, format, channel, streaming } = outputMode;

  return (
    <div style={s.card}>
      <p style={s.cardTitle}>Modo de Saída</p>

      <div style={s.modeDisplay}>
        <span style={s.modeIcon} aria-hidden="true">
          {MODE_ICON[type] ?? "○"}
        </span>
        <span style={s.modeLabel}>{type}</span>
      </div>

      <div style={s.rows}>
        <Row label="Formato">
          <span
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: FORMAT_COLOR[format] ?? "var(--text-primary)",
            }}
          >
            {format}
          </span>
        </Row>
        <Row label="Canal">
          <span style={s.channel}>{channel}</span>
        </Row>
        <Row label="Streaming">
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: streaming ? "var(--color-primary)" : "var(--text-muted)",
            }}
          >
            {streaming ? "Ativo" : "Desligado"}
          </span>
        </Row>
      </div>
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
  cardTitle: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "12px",
  },
  modeDisplay: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "12px",
    padding: "8px 12px",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    border: "1px solid var(--color-primary-border)",
  },
  modeIcon: {
    fontSize: "18px",
    color: "var(--color-primary)",
    lineHeight: 1,
  },
  modeLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--color-primary)",
    letterSpacing: "0.5px",
    fontFamily: "var(--font-mono)",
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
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
  },
  channel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
  },
};
