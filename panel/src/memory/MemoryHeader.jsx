// ============================================================================
// MemoryHeader — stats + filter tabs + secondary filters (tier, priority) + state switcher (demo)
// ============================================================================

import { MEMORY_STATES, MEMORY_FILTERS } from "./mockMemory";

const TIER_LABELS = {
  1: "Tier 1",
  2: "Tier 2",
  3: "Tier 3",
  4: "Tier 4",
  5: "Tier 5",
  6: "Tier 6",
  7: "Tier 7",
};

const PRIORITY_LABELS = {
  critical: "Crítica",
  high:     "Alta",
  medium:   "Média",
  low:      "Baixa",
};

const PRIORITY_ACCENTS = {
  critical: { color: "#EF4444", bg: "rgba(239,68,68,0.1)",   border: "rgba(239,68,68,0.3)" },
  high:     { color: "#F59E0B", bg: "rgba(245,158,11,0.1)",  border: "rgba(245,158,11,0.3)" },
  medium:   { color: "var(--color-primary)", bg: "var(--color-primary-glow)", border: "var(--color-primary-border)" },
  low:      { color: "var(--text-muted)", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)" },
};

const STATE_META = {
  [MEMORY_STATES.POPULATED]: {
    label: "Populada",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    dot: "var(--color-primary)",
  },
  [MEMORY_STATES.EMPTY]: {
    label: "Vazia",
    color: "var(--text-muted)",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.25)",
    dot: "var(--text-muted)",
  },
  [MEMORY_STATES.CONSOLIDATING]: {
    label: "Consolidando",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    dot: "#F59E0B",
  },
  [MEMORY_STATES.LIVE_SESSION]: {
    label: "Sessão Viva",
    color: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    dot: "#10B981",
  },
};

const FILTER_LABELS = {
  [MEMORY_FILTERS.ALL]: "Todas",
  [MEMORY_FILTERS.CANONICAL]: "Canônica",
  [MEMORY_FILTERS.OPERATIONAL]: "Operacional",
  [MEMORY_FILTERS.SESSION]: "Sessão atual",
};

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

function StatPill({ label, value, accent }) {
  return (
    <div style={s.stat}>
      <span style={{ ...s.statValue, ...(accent ? { color: accent } : {}) }}>
        {value}
      </span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

export default function MemoryHeader({
  memory,
  currentState,
  onStateChange,
  activeFilter,
  onFilterChange,
  tierFilter,
  onTierFilterChange,
  priorityFilter,
  onPriorityFilterChange,
  availableTiers,
  availablePriorities,
}) {
  const meta = STATE_META[currentState];
  const { summary } = memory;

  return (
    <div style={s.wrap}>
      {/* Top row */}
      <div style={s.topRow}>
        <div style={s.identity}>
          <span style={s.mark} aria-hidden="true">◆</span>
          <div>
            <p style={s.pageTitle}>Memória da Enavia</p>
            <p style={s.sub}>
              {summary.lastConsolidation
                ? `Última consolidação: ${formatTs(summary.lastConsolidation)}`
                : "Nenhuma consolidação registrada"}
            </p>
          </div>
        </div>

        <span
          style={{
            ...s.stateBadge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <span
            style={{ ...s.stateDot, background: meta.dot }}
            aria-hidden="true"
          />
          {meta.label}
        </span>
      </div>

      {/* Stats row */}
      <div style={s.statsRow}>
        <StatPill label="Total" value={summary.total} />
        <div style={s.statDivider} aria-hidden="true" />
        <StatPill
          label="Canônica"
          value={summary.canonical}
          accent="var(--color-primary)"
        />
        <StatPill label="Operacional" value={summary.operational} />
        <StatPill
          label="Sessão atual"
          value={summary.sessionEntries}
          accent="#10B981"
        />
      </div>

      {/* Filter tabs — type */}
      <div style={s.filters} role="group" aria-label="Filtrar entradas">
        {Object.values(MEMORY_FILTERS).map((f) => {
          const active = f === activeFilter;
          return (
            <button
              key={f}
              style={{
                ...s.filterBtn,
                ...(active ? s.filterBtnActive : {}),
              }}
              onClick={() => onFilterChange(f)}
              aria-pressed={active}
            >
              {FILTER_LABELS[f]}
            </button>
          );
        })}

        <div style={s.filterSep} aria-hidden="true" />

        {/* State switcher demo */}
        <span style={s.switcherLabel}>Estado demo:</span>
        {Object.values(MEMORY_STATES).map((st) => {
          const m = STATE_META[st];
          const active = st === currentState;
          return (
            <button
              key={st}
              style={{
                ...s.switchBtn,
                ...(active
                  ? {
                      color: m.color,
                      background: m.bg,
                      borderColor: m.border,
                    }
                  : {}),
              }}
              onClick={() => onStateChange(st)}
              aria-pressed={active}
            >
              {m.label}
            </button>
          );
        })}
      </div>

      {/* Secondary filters — tier + priority (P18-PR2) */}
      {(availableTiers?.length > 0 || availablePriorities?.length > 0) && (
        <div style={s.secondaryFilters} role="group" aria-label="Filtros secundários: tier e prioridade">
          {/* Tier filter */}
          {availableTiers?.length > 0 && (
            <div style={s.filterGroup}>
              <span style={s.filterGroupLabel}>Tier:</span>
              <button
                style={{
                  ...s.secFilterBtn,
                  ...(tierFilter === "all" ? s.secFilterBtnActive : {}),
                }}
                onClick={() => onTierFilterChange("all")}
                aria-pressed={tierFilter === "all"}
              >
                Todos
              </button>
              {availableTiers.map((t) => {
                const active = tierFilter === String(t);
                return (
                  <button
                    key={t}
                    style={{
                      ...s.secFilterBtn,
                      ...(active ? s.secFilterBtnActive : {}),
                    }}
                    onClick={() => onTierFilterChange(active ? "all" : String(t))}
                    aria-pressed={active}
                  >
                    {TIER_LABELS[t] ?? `Tier ${t}`}
                  </button>
                );
              })}
            </div>
          )}

          {availableTiers?.length > 0 && availablePriorities?.length > 0 && (
            <div style={s.filterSep} aria-hidden="true" />
          )}

          {/* Priority filter */}
          {availablePriorities?.length > 0 && (
            <div style={s.filterGroup}>
              <span style={s.filterGroupLabel}>Prioridade:</span>
              <button
                style={{
                  ...s.secFilterBtn,
                  ...(priorityFilter === "all" ? s.secFilterBtnActive : {}),
                }}
                onClick={() => onPriorityFilterChange("all")}
                aria-pressed={priorityFilter === "all"}
              >
                Todas
              </button>
              {availablePriorities.map((p) => {
                const active = priorityFilter === p;
                const accent = active ? PRIORITY_ACCENTS[p] : null;
                return (
                  <button
                    key={p}
                    style={{
                      ...s.secFilterBtn,
                      ...(accent
                        ? { color: accent.color, background: accent.bg, borderColor: accent.border }
                        : {}),
                    }}
                    onClick={() => onPriorityFilterChange(active ? "all" : p)}
                    aria-pressed={active}
                  >
                    {PRIORITY_LABELS[p] ?? p}
                  </button>
                );
              })}
            </div>
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
    padding: "20px 24px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "14px",
    flexShrink: 0,
  },
  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
  },
  identity: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  mark: {
    fontSize: "22px",
    color: "var(--color-primary)",
    fontWeight: 700,
    lineHeight: 1,
    textShadow: "0 0 16px rgba(0,180,216,0.4)",
    flexShrink: 0,
  },
  pageTitle: {
    fontSize: "16px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
    lineHeight: 1.2,
  },
  sub: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  stateBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "20px",
    border: "1px solid",
    letterSpacing: "0.3px",
    flexShrink: 0,
  },
  stateDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  statsRow: {
    display: "flex",
    alignItems: "center",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    padding: "10px 16px",
    flexWrap: "wrap",
    gap: "4px",
  },
  stat: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    padding: "0 16px",
  },
  statValue: {
    fontSize: "20px",
    fontWeight: 700,
    color: "var(--text-primary)",
    lineHeight: 1.2,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    marginTop: "1px",
  },
  statDivider: {
    width: "1px",
    height: "28px",
    background: "var(--border-light)",
    flexShrink: 0,
    margin: "0 4px",
  },
  filters: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
  },
  filterBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all 0.15s ease",
  },
  filterBtnActive: {
    background: "var(--color-primary-glow)",
    color: "var(--color-primary)",
    borderColor: "var(--color-primary-border)",
    fontWeight: 600,
  },
  filterSep: {
    width: "1px",
    height: "16px",
    background: "var(--border-light)",
    margin: "0 8px",
    flexShrink: 0,
  },
  switcherLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    marginRight: "2px",
    letterSpacing: "0.3px",
  },
  switchBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "20px",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all 0.15s ease",
  },
  // P18-PR2 — secondary filters (tier + priority)
  secondaryFilters: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
    paddingTop: "2px",
    borderTop: "1px solid var(--border)",
  },
  filterGroup: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    flexWrap: "wrap",
  },
  filterGroupLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
    marginRight: "2px",
  },
  secFilterBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "3px 9px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all 0.15s ease",
  },
  secFilterBtnActive: {
    background: "var(--color-primary-glow)",
    color: "var(--color-primary)",
    borderColor: "var(--color-primary-border)",
    fontWeight: 600,
  },
};
