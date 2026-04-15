// ============================================================================
// ENAVIA Panel — RelevantBlocksCard (PR4)
//
// Shows the list of relevant block IDs + resolution strategy from the
// active state (PR2). If full block data is not available in the payload,
// shows IDs/count/strategy honestly.
// ============================================================================

/**
 * @param {{ activeState: object | null, adherence: object | null }} props
 */
export default function RelevantBlocksCard({ activeState, adherence }) {
  const blockIds = activeState?.relevant_block_ids || [];
  const strategy = activeState?.resolution_strategy || adherence?.resolution_strategy || null;
  const blocksCount = adherence?.relevant_blocks_count ?? blockIds.length;
  const resolvedAt = activeState?.last_resolution_at || null;

  if (blocksCount === 0 && blockIds.length === 0) return null;

  return (
    <div style={s.card} data-testid="relevant-blocks-card">
      {/* Header */}
      <div style={s.header}>
        <span style={s.headerIcon} aria-hidden="true">⊞</span>
        <span style={s.headerTitle}>BLOCOS RELEVANTES</span>
      </div>

      {/* Summary row */}
      <div style={s.summaryRow}>
        <div style={s.statBox}>
          <span style={s.statValue}>{blocksCount}</span>
          <span style={s.statLabel}>blocos</span>
        </div>
        {strategy && (
          <div style={s.statBox}>
            <span style={s.strategyValue}>{strategy}</span>
            <span style={s.statLabel}>estratégia</span>
          </div>
        )}
      </div>

      {/* Block IDs list */}
      {blockIds.length > 0 && (
        <div style={s.blockList} data-testid="block-ids-list">
          {blockIds.map((id, i) => (
            <span key={i} style={s.blockId}>{id}</span>
          ))}
        </div>
      )}

      {resolvedAt && (
        <span style={s.resolvedAt}>Resolvido em: {_fmtTs(resolvedAt)}</span>
      )}
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
  summaryRow: {
    display: "flex",
    gap: "12px",
  },
  statBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
    padding: "8px 16px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  statValue: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: 1,
  },
  strategyValue: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--color-primary)",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: "9px",
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  blockList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  blockId: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--color-primary)",
    background: "rgba(0,180,216,0.08)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  resolvedAt: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
};
