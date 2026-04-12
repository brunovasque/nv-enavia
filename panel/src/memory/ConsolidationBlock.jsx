// ============================================================================
// ConsolidationBlock — strong memory vs in-transit memory
// In consolidating state: two sections with unmistakable visual separation
// ============================================================================

import { MEMORY_STATES } from "./mockMemory";

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const TYPE_LABELS = {
  operational: "operacional",
  session: "sessão",
  pattern: "padrão",
};

// ── Consolidated entry (already strong memory) ──────────────────────────────
function DoneEntry({ entry }) {
  return (
    <div style={s.doneEntry}>
      <span style={s.doneCheck} aria-label="Consolidada">✓</span>
      <div style={s.entryBody}>
        <span style={s.doneKey}>{entry.key}</span>
        <p style={s.entryValue}>{entry.value}</p>
        <span style={s.doneTs}>{formatTs(entry.consolidatedAt)}</span>
      </div>
    </div>
  );
}

// ── Pending entry (still in transit) ───────────────────────────────────────
function PendingEntry({ entry }) {
  return (
    <div style={s.pendingEntry}>
      <span style={s.pendingIcon} aria-label="Em trânsito">⏳</span>
      <div style={s.entryBody}>
        <div style={s.pendingTop}>
          <span style={s.pendingKey}>{entry.key}</span>
          <span style={s.typeBadge}>{TYPE_LABELS[entry.type] || entry.type}</span>
        </div>
        <p style={s.entryValue}>{entry.value}</p>
        <span style={s.pendingFrom}>{entry.from}</span>
      </div>
    </div>
  );
}

// ── Consolidating state — main split view ───────────────────────────────────
function ConsolidatingView({ consolidation }) {
  const { pending, consolidated } = consolidation;

  return (
    <div style={s.consolidatingWrap}>
      {/* Running banner */}
      <div style={s.runningBanner}>
        <span style={s.runningDot} className="exec-dot-pulse" aria-hidden="true" />
        <div>
          <p style={s.runningTitle}>Consolidação em andamento</p>
          <p style={s.runningSub}>
            Última execução: {formatTs(consolidation.lastRun)}
          </p>
        </div>
      </div>

      {/* Strong memory section */}
      <div style={s.strongSection}>
        <div style={s.sectionHeader}>
          <div style={s.sectionTitleRow}>
            <span style={s.strongIcon} aria-hidden="true">◆</span>
            <p style={s.strongTitle}>Memória Forte</p>
          </div>
          <span style={s.strongCount}>{consolidated.length}</span>
        </div>
        <p style={s.sectionDesc}>
          Já consolidada — permanece entre sessões
        </p>
        {consolidated.length === 0 ? (
          <p style={s.emptyNote}>Nenhuma entrada consolidada ainda.</p>
        ) : (
          <div style={s.entryList}>
            {consolidated.map((e) => (
              <DoneEntry key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={s.sectionDivider} role="separator">
        <div style={s.dividerLine} />
        <span style={s.dividerLabel}>em trânsito</span>
        <div style={s.dividerLine} />
      </div>

      {/* In-transit section */}
      <div style={s.transitSection}>
        <div style={s.sectionHeader}>
          <div style={s.sectionTitleRow}>
            <span style={s.transitIcon} aria-hidden="true">⏳</span>
            <p style={s.transitTitle}>Em Trânsito</p>
          </div>
          <span style={s.transitCount}>{pending.length}</span>
        </div>
        <p style={s.sectionDesc}>
          Aguardando avaliação — ainda não é memória forte
        </p>
        {pending.length === 0 ? (
          <p style={s.emptyNote}>Nenhuma entrada em trânsito.</p>
        ) : (
          <div style={s.entryList}>
            {pending.map((e) => (
              <PendingEntry key={e.id} entry={e} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Default state — summary view ────────────────────────────────────────────
function DefaultView({ consolidation }) {
  return (
    <div style={s.defaultWrap}>
      <div style={s.defaultRow}>
        <div style={s.defaultStat}>
          <span style={s.defaultStatNum}>{consolidation.consolidated.length}</span>
          <span style={s.defaultStatLabel}>Consolidadas</span>
        </div>
        <div style={s.defaultDivider} aria-hidden="true" />
        <div style={s.defaultStat}>
          <span style={{ ...s.defaultStatNum, color: "#F59E0B" }}>
            {consolidation.pending.length}
          </span>
          <span style={s.defaultStatLabel}>Em trânsito</span>
        </div>
      </div>
      <div style={s.defaultMeta}>
        <span style={s.metaItem}>
          Última: {formatTs(consolidation.lastRun)}
        </span>
        {consolidation.nextRun && (
          <>
            <span style={s.metaSep} aria-hidden="true">·</span>
            <span style={s.metaItem}>
              Próxima: {formatTs(consolidation.nextRun)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function ConsolidationBlock({ consolidation, memoryState }) {
  const isConsolidating = memoryState === MEMORY_STATES.CONSOLIDATING;

  return (
    <div
      style={{
        ...s.card,
        ...(isConsolidating ? s.cardConsolidating : {}),
      }}
    >
      <div style={s.header}>
        <p style={s.title}>Consolidação</p>
        {isConsolidating && (
          <span style={s.activeBadge}>ATIVA</span>
        )}
      </div>

      {isConsolidating ? (
        <ConsolidatingView consolidation={consolidation} />
      ) : (
        <DefaultView consolidation={consolidation} />
      )}
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  cardConsolidating: {
    border: "1px solid rgba(245,158,11,0.35)",
    boxShadow: "0 0 16px rgba(245,158,11,0.06)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 12px",
    borderBottom: "1px solid var(--border)",
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
  },
  activeBadge: {
    fontSize: "9px",
    fontWeight: 700,
    color: "#F59E0B",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.3)",
    padding: "2px 7px",
    borderRadius: "4px",
    letterSpacing: "1px",
  },

  // Consolidating split view
  consolidatingWrap: {
    display: "flex",
    flexDirection: "column",
  },
  runningBanner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 14px",
    background: "rgba(245,158,11,0.08)",
    borderBottom: "1px solid rgba(245,158,11,0.15)",
  },
  runningDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#F59E0B",
    flexShrink: 0,
    display: "inline-block",
  },
  runningTitle: {
    fontSize: "12px",
    fontWeight: 600,
    color: "#F59E0B",
  },
  runningSub: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginTop: "1px",
  },

  // Strong memory section
  strongSection: {
    padding: "14px 14px 10px",
    borderBottom: "1px solid var(--border)",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "4px",
  },
  sectionTitleRow: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  strongIcon: {
    fontSize: "10px",
    color: "#10B981",
  },
  strongTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#10B981",
  },
  strongCount: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#10B981",
    fontVariantNumeric: "tabular-nums",
  },
  sectionDesc: {
    fontSize: "10px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    marginBottom: "10px",
  },

  // Section divider
  sectionDivider: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "0 14px",
    margin: "4px 0",
  },
  dividerLine: {
    flex: 1,
    height: "1px",
    background: "var(--border)",
  },
  dividerLabel: {
    fontSize: "9px",
    fontWeight: 600,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    flexShrink: 0,
  },

  // In-transit section
  transitSection: {
    padding: "10px 14px 14px",
  },
  transitIcon: {
    fontSize: "12px",
  },
  transitTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "#F59E0B",
  },
  transitCount: {
    fontSize: "16px",
    fontWeight: 700,
    color: "#F59E0B",
    fontVariantNumeric: "tabular-nums",
  },

  // Entry lists
  entryList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },

  // Done entry (strong memory)
  doneEntry: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "8px 10px",
    background: "rgba(16,185,129,0.06)",
    border: "1px solid rgba(16,185,129,0.2)",
    borderLeft: "3px solid #10B981",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
  },
  doneCheck: {
    fontSize: "12px",
    color: "#10B981",
    fontWeight: 700,
    flexShrink: 0,
    marginTop: "1px",
  },
  doneKey: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "#10B981",
    fontWeight: 500,
    display: "block",
    marginBottom: "2px",
  },
  doneTs: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.6,
    display: "block",
    marginTop: "3px",
  },

  // Pending entry (in transit)
  pendingEntry: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "8px 10px",
    background: "rgba(245,158,11,0.05)",
    border: "1px dashed rgba(245,158,11,0.3)",
    borderLeft: "3px solid #F59E0B",
    borderRadius: "0 var(--radius-sm) var(--radius-sm) 0",
    opacity: 0.9,
  },
  pendingIcon: {
    fontSize: "12px",
    flexShrink: 0,
    marginTop: "1px",
  },
  pendingTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    marginBottom: "2px",
  },
  pendingKey: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "#F59E0B",
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  typeBadge: {
    fontSize: "8px",
    fontWeight: 600,
    color: "#F59E0B",
    background: "rgba(245,158,11,0.12)",
    border: "1px solid rgba(245,158,11,0.25)",
    padding: "1px 4px",
    borderRadius: "3px",
    letterSpacing: "0.5px",
    flexShrink: 0,
  },
  pendingFrom: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.6,
    display: "block",
    marginTop: "3px",
  },

  // Shared entry body
  entryBody: {
    flex: 1,
    minWidth: 0,
  },
  entryValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },

  emptyNote: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.6,
    padding: "4px 0",
  },

  // Default view
  defaultWrap: {
    padding: "14px 16px",
  },
  defaultRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0",
    marginBottom: "12px",
  },
  defaultStat: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "2px",
  },
  defaultStatNum: {
    fontSize: "24px",
    fontWeight: 700,
    color: "#10B981",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  defaultStatLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
  },
  defaultDivider: {
    width: "1px",
    height: "32px",
    background: "var(--border-light)",
    flexShrink: 0,
    margin: "0 8px",
  },
  defaultMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  metaItem: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
  },
  metaSep: {
    color: "var(--border-light)",
    fontSize: "10px",
  },
};
