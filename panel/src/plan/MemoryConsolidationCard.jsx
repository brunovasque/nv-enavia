// ============================================================================
// MemoryConsolidationCard — candidatos a memória: key, value, tags, priority
// ============================================================================

const PRIORITY_STYLE = {
  HIGH: { color: "#EF4444", bg: "rgba(239,68,68,0.1)", border: "rgba(239,68,68,0.2)" },
  MEDIUM: { color: "#F59E0B", bg: "rgba(245,158,11,0.1)", border: "rgba(245,158,11,0.2)" },
  LOW: { color: "#10B981", bg: "rgba(16,185,129,0.1)", border: "rgba(16,185,129,0.2)" },
};

function CandidateRow({ candidate, index }) {
  const p = PRIORITY_STYLE[candidate.priority] ?? PRIORITY_STYLE.MEDIUM;

  return (
    <div style={s.candidate}>
      <div style={s.candidateTop}>
        <span style={s.candidateKey}>{candidate.key}</span>
        <span
          style={{
            ...s.priorityBadge,
            color: p.color,
            background: p.bg,
            borderColor: p.border,
          }}
        >
          {candidate.priority}
        </span>
      </div>
      <p style={s.candidateValue}>{candidate.value}</p>
      {candidate.tags && candidate.tags.length > 0 && (
        <div style={s.tags}>
          {candidate.tags.map((t) => (
            <span key={t} style={s.tag}>{t}</span>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MemoryConsolidationCard({ memoryConsolidation }) {
  if (!memoryConsolidation) return null;
  const { candidates } = memoryConsolidation;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Consolidação de Memória</p>
        <span style={s.count}>{candidates.length} candidatos</span>
      </div>

      <div style={s.list}>
        {candidates.map((c, i) => (
          <CandidateRow key={c.key} candidate={c} index={i} />
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
  count: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  candidate: {
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    padding: "10px 12px",
    border: "1px solid var(--border)",
  },
  candidateTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
    marginBottom: "4px",
  },
  candidateKey: {
    fontFamily: "var(--font-mono)",
    fontSize: "11px",
    color: "var(--color-primary)",
    fontWeight: 500,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  priorityBadge: {
    fontSize: "10px",
    fontWeight: 700,
    padding: "1px 6px",
    borderRadius: "3px",
    border: "1px solid",
    letterSpacing: "0.5px",
    flexShrink: 0,
  },
  candidateValue: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    marginBottom: "6px",
  },
  tags: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  tag: {
    fontSize: "10px",
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    padding: "1px 6px",
    borderRadius: "3px",
  },
};
