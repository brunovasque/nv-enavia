// ============================================================================
// ClassificationCard — intent, domain, priority, confidence, tags
// ============================================================================

const PRIORITY_STYLE = {
  HIGH: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.25)" },
  MEDIUM: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.25)" },
  LOW: { color: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.25)" },
};

function Row({ label, children }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={s.rowValue}>{children}</span>
    </div>
  );
}

function PriorityBadge({ priority }) {
  const p = PRIORITY_STYLE[priority] ?? PRIORITY_STYLE.MEDIUM;
  return (
    <span
      style={{
        fontSize: "11px",
        fontWeight: 700,
        color: p.color,
        background: p.bg,
        border: `1px solid ${p.border}`,
        padding: "2px 8px",
        borderRadius: "4px",
        letterSpacing: "0.5px",
      }}
    >
      {priority}
    </span>
  );
}

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  const color = value >= 0.85 ? "#10B981" : value >= 0.6 ? "#F59E0B" : "#EF4444";
  return (
    <div style={s.confWrap}>
      <div style={s.confTrack}>
        <div style={{ ...s.confFill, width: `${pct}%`, background: color }} />
      </div>
      <span style={{ ...s.confLabel, color }}>{pct}%</span>
    </div>
  );
}

export default function ClassificationCard({ classification }) {
  if (!classification) return null;
  const { intent, domain, priority, confidence, tags } = classification;

  return (
    <div style={s.card}>
      <p style={s.cardTitle}>Classificação</p>

      <div style={s.rows}>
        <Row label="Intent">
          <span style={s.mono}>{intent}</span>
        </Row>
        <Row label="Domínio">
          <span style={s.domain}>{domain}</span>
        </Row>
        <Row label="Prioridade">
          <PriorityBadge priority={priority} />
        </Row>
        <Row label="Confiança">
          <ConfidenceBar value={confidence} />
        </Row>
      </div>

      {tags && tags.length > 0 && (
        <div style={s.tags}>
          {tags.map((t) => (
            <span key={t} style={s.tag}>
              {t}
            </span>
          ))}
        </div>
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
  cardTitle: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "12px",
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
    flexShrink: 0,
  },
  rowValue: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 500,
    textAlign: "right",
  },
  mono: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--color-primary)",
  },
  domain: {
    fontSize: "12px",
    color: "var(--text-primary)",
  },
  confWrap: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  confTrack: {
    width: "64px",
    height: "4px",
    background: "var(--border)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  confFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  confLabel: {
    fontSize: "11px",
    fontWeight: 600,
    minWidth: "28px",
    textAlign: "right",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    marginTop: "12px",
    paddingTop: "10px",
    borderTop: "1px solid var(--border)",
  },
  tag: {
    fontSize: "10px",
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "2px 7px",
    borderRadius: "4px",
  },
};
