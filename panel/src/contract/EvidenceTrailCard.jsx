// ============================================================================
// ENAVIA Panel — EvidenceTrailCard (PR4)
//
// Shows matched_rules, violations, and notes from the adherence gate result.
// Each item shows category, source, block_id, heading, and rule/description.
// ============================================================================

/**
 * @param {{ adherence: object | null }} props
 */
export default function EvidenceTrailCard({ adherence }) {
  if (!adherence) return null;

  const matchedRules = adherence.matched_rules || [];
  const violations = adherence.violations || [];
  const notes = adherence.notes || [];

  const isEmpty = matchedRules.length === 0 && violations.length === 0 && notes.length === 0;

  return (
    <div style={s.card} data-testid="evidence-trail-card">
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerIcon} aria-hidden="true">🔍</span>
        <span style={s.headerTitle}>TRILHA DE EVIDÊNCIAS</span>
      </div>

      {isEmpty && (
        <p style={s.emptyText}>Nenhuma evidência registrada para esta avaliação.</p>
      )}

      {/* Violations */}
      {violations.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ ...s.sectionIcon, color: "#EF4444" }} aria-hidden="true">✕</span>
            <span style={{ ...s.sectionTitle, color: "#EF4444" }}>
              Violações ({violations.length})
            </span>
          </div>
          <div style={s.itemList} data-testid="violations-list">
            {violations.map((v, i) => (
              <div key={i} style={{ ...s.item, borderColor: "rgba(239,68,68,0.25)" }}>
                <div style={s.itemMeta}>
                  <span style={{ ...s.typeBadge, color: "#EF4444", background: "rgba(239,68,68,0.08)", borderColor: "rgba(239,68,68,0.25)" }}>
                    {v.type || "violation"}
                  </span>
                  {v.block_id && <span style={s.blockId}>{v.block_id}</span>}
                  {v.source && <span style={s.sourceBadge}>{v.source}</span>}
                </div>
                {v.heading && <span style={s.heading}>{v.heading}</span>}
                <p style={s.description}>{v.description}</p>
                {v.matched_keywords && v.matched_keywords.length > 0 && (
                  <div style={s.keywords}>
                    {v.matched_keywords.map((kw, j) => (
                      <span key={j} style={s.keyword}>{kw}</span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Matched Rules */}
      {matchedRules.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ ...s.sectionIcon, color: "var(--color-primary)" }} aria-hidden="true">◆</span>
            <span style={{ ...s.sectionTitle, color: "var(--color-primary)" }}>
              Regras Avaliadas ({matchedRules.length})
            </span>
          </div>
          <div style={s.itemList} data-testid="matched-rules-list">
            {matchedRules.map((r, i) => (
              <div key={i} style={s.item}>
                <div style={s.itemMeta}>
                  <span style={s.typeBadge}>{r.category || "rule"}</span>
                  {r.block_id && <span style={s.blockId}>{r.block_id}</span>}
                  {r.source && <span style={s.sourceBadge}>{r.source}</span>}
                </div>
                {r.heading && <span style={s.heading}>{r.heading}</span>}
                <p style={s.description}>{r.rule}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Notes */}
      {notes.length > 0 && (
        <div style={s.section}>
          <div style={s.sectionHeader}>
            <span style={{ ...s.sectionIcon, color: "var(--text-muted)" }} aria-hidden="true">○</span>
            <span style={{ ...s.sectionTitle, color: "var(--text-muted)" }}>
              Notas ({notes.length})
            </span>
          </div>
          <div style={s.itemList} data-testid="notes-list">
            {notes.map((note, i) => (
              <div key={i} style={{ ...s.item, borderColor: "var(--border)" }}>
                <p style={s.noteText}>{note}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
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
    gap: "12px",
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
  emptyText: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1.5,
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  sectionIcon: {
    fontSize: "11px",
    fontWeight: 700,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.6px",
    textTransform: "uppercase",
  },
  itemList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  item: {
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "8px 10px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  itemMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  typeBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    padding: "1px 6px",
    borderRadius: "3px",
  },
  blockId: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--color-primary)",
    opacity: 0.8,
  },
  sourceBadge: {
    fontSize: "9px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
  heading: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  description: {
    margin: 0,
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },
  noteText: {
    margin: 0,
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  keywords: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
    marginTop: "2px",
  },
  keyword: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "#EF4444",
    background: "rgba(239,68,68,0.06)",
    border: "1px solid rgba(239,68,68,0.18)",
    padding: "1px 5px",
    borderRadius: "3px",
  },
};
