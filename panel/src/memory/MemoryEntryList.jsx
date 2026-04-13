// ============================================================================
// MemoryEntryList — filterable list of all memory entries
// Shows canonical + operational with type, strength, hierarchy indicators
// ============================================================================

import { MEMORY_FILTERS } from "./mockMemory";

const CURRENT_SESSION_ID = "sess-0x9f4c";

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

const SOURCE_LABELS = {
  planner: "Planner",
  executor: "Executor",
  chat: "Chat",
  system: "Sistema",
};

function EntryRow({ entry, type }) {
  const isCanonical = type === "canonical";
  const isStrong = entry.strength === "strong";
  const isCurrentSession =
    !isCanonical && entry.sessionId === CURRENT_SESSION_ID;

  const accentColor = isCanonical
    ? "var(--color-primary)"
    : isStrong
    ? "#10B981"
    : "var(--border-light)";

  return (
    <div
      style={{
        ...s.row,
        borderLeftColor: accentColor,
        ...(isCurrentSession ? s.rowCurrentSession : {}),
      }}
    >
      {/* Left column: type + strength indicator */}
      <div style={s.rowLeft}>
        <span
          style={{
            ...s.typeBadge,
            color: isCanonical ? "var(--color-primary)" : "var(--text-secondary)",
            background: isCanonical
              ? "var(--color-primary-glow)"
              : "rgba(148,163,184,0.1)",
            borderColor: isCanonical
              ? "var(--color-primary-border)"
              : "rgba(148,163,184,0.2)",
          }}
        >
          {isCanonical ? "◆ CAN" : "○ OP"}
        </span>
        <div
          style={{
            ...s.strengthPip,
            background: isStrong ? accentColor : "var(--border)",
          }}
          title={isStrong ? "Memória forte" : "Memória fraca"}
        />
      </div>

      {/* Main content */}
      <div style={s.rowContent}>
        <div style={s.rowTop}>
          <span style={s.key}>{entry.key}</span>
          <div style={s.rowBadges}>
            {isCurrentSession && (
              <span style={s.sessionNowBadge}>AGORA</span>
            )}
            <span
              style={{
                ...s.strengthLabel,
                color: isStrong ? accentColor : "var(--text-muted)",
              }}
            >
              {isStrong ? "forte" : "fraca"}
            </span>
          </div>
        </div>
        <p style={s.value}>{entry.value}</p>
        <div style={s.rowMeta}>
          {isCanonical ? (
            <>
              <span style={s.metaTag}>{entry.scope}</span>
              <span style={s.metaDot} aria-hidden="true">·</span>
              <span style={s.metaTs}>{formatTs(entry.createdAt)}</span>
            </>
          ) : (
            <>
              <span style={s.metaTag}>
                {SOURCE_LABELS[entry.source] || entry.source}
              </span>
              <span style={s.metaDot} aria-hidden="true">·</span>
              <span style={s.metaSession}>{entry.sessionId}</span>
              <span style={s.metaDot} aria-hidden="true">·</span>
              <span style={s.metaTs}>{formatTs(entry.createdAt)}</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MemoryEntryList({
  canonicalEntries,
  operationalEntries,
  activeFilter,
  tierFilter = "all",
  priorityFilter = "all",
}) {
  const showCanonical =
    activeFilter === MEMORY_FILTERS.ALL ||
    activeFilter === MEMORY_FILTERS.CANONICAL;
  const showOperational =
    activeFilter === MEMORY_FILTERS.ALL ||
    activeFilter === MEMORY_FILTERS.OPERATIONAL;
  const showSessionOnly = activeFilter === MEMORY_FILTERS.SESSION;

  // Apply secondary filters (tier + priority) to an entry list
  function applySecondary(entries) {
    return entries.filter((e) => {
      const tierOk = tierFilter === "all" || e.tier === Number(tierFilter);
      const priorityOk = priorityFilter === "all" || e.priority === priorityFilter;
      return tierOk && priorityOk;
    });
  }

  const canonicalToShow = applySecondary(showCanonical ? canonicalEntries : []);
  const operationalToShow = applySecondary(
    showOperational
      ? operationalEntries
      : showSessionOnly
      ? operationalEntries.filter((e) => e.sessionId === CURRENT_SESSION_ID)
      : [],
  );

  const total = canonicalToShow.length + operationalToShow.length;

  return (
    <div style={s.wrap}>
      <div style={s.header}>
        <p style={s.title}>Entradas de Memória</p>
        <span style={s.count}>{total} entrada{total !== 1 ? "s" : ""}</span>
      </div>

      {total === 0 ? (
        <div style={s.empty}>
          <p style={s.emptyText}>
            {tierFilter !== "all" || priorityFilter !== "all"
              ? "Nenhuma entrada para os filtros selecionados."
              : "Nenhuma entrada para o filtro selecionado."}
          </p>
        </div>
      ) : (
        <div style={s.list}>
          {/* Canonical section */}
          {canonicalToShow.length > 0 && (
            <>
              <div style={s.sectionLabel}>
                <span style={s.sectionDot} aria-hidden="true" />
                Canônica — {canonicalToShow.length} entrada{canonicalToShow.length !== 1 ? "s" : ""}
              </div>
              {canonicalToShow.map((e) => (
                <EntryRow key={e.id} entry={e} type="canonical" />
              ))}
            </>
          )}

          {/* Operational section */}
          {operationalToShow.length > 0 && (
            <>
              <div style={{ ...s.sectionLabel, ...s.sectionLabelOp }}>
                <span
                  style={{ ...s.sectionDot, background: "var(--text-muted)" }}
                  aria-hidden="true"
                />
                Operacional — {operationalToShow.length} entrada{operationalToShow.length !== 1 ? "s" : ""}
              </div>
              {operationalToShow.map((e) => (
                <EntryRow key={e.id} entry={e} type="operational" />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const s = {
  wrap: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    flex: 1,
    minHeight: 0,
    display: "flex",
    flexDirection: "column",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 12px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
  },
  count: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontVariantNumeric: "tabular-nums",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    flex: 1,
  },
  sectionLabel: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "8px 16px 6px",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--color-primary)",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    background: "rgba(0,180,216,0.04)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  sectionLabelOp: {
    color: "var(--text-muted)",
    background: "rgba(148,163,184,0.04)",
  },
  sectionDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    flexShrink: 0,
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: "12px",
    padding: "10px 16px",
    borderLeft: "3px solid var(--color-primary)",
    borderBottom: "1px solid var(--border)",
    transition: "background 0.15s",
  },
  rowCurrentSession: {
    background: "rgba(16,185,129,0.03)",
  },
  rowLeft: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
    paddingTop: "2px",
  },
  typeBadge: {
    fontSize: "8px",
    fontWeight: 700,
    padding: "2px 5px",
    borderRadius: "3px",
    border: "1px solid",
    letterSpacing: "0.5px",
    whiteSpace: "nowrap",
  },
  strengthPip: {
    width: "4px",
    height: "24px",
    borderRadius: "2px",
    background: "var(--border)",
    transition: "background 0.2s",
  },
  rowContent: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  rowTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  key: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-secondary)",
    fontWeight: 600,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  rowBadges: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexShrink: 0,
  },
  sessionNowBadge: {
    fontSize: "8px",
    fontWeight: 700,
    color: "#10B981",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.3)",
    padding: "1px 4px",
    borderRadius: "3px",
    letterSpacing: "0.8px",
  },
  strengthLabel: {
    fontSize: "10px",
    fontWeight: 500,
    letterSpacing: "0.2px",
  },
  value: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  rowMeta: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginTop: "2px",
    flexWrap: "wrap",
  },
  metaTag: {
    fontSize: "9px",
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.1)",
    border: "1px solid rgba(100,116,139,0.15)",
    padding: "1px 4px",
    borderRadius: "3px",
    letterSpacing: "0.3px",
  },
  metaDot: {
    color: "var(--border-light)",
    fontSize: "9px",
  },
  metaSession: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.6,
    maxWidth: "100px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  metaTs: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.7,
  },
  empty: {
    padding: "32px 16px",
    textAlign: "center",
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: "13px",
    color: "var(--text-muted)",
    opacity: 0.6,
  },
};
