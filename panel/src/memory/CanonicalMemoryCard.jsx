// ============================================================================
// CanonicalMemoryCard — permanent memory: identity, rules, constraints
// ============================================================================

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

function StrengthBar({ strength }) {
  const isStrong = strength === "strong";
  return (
    <div style={s.strengthBar}>
      <div
        style={{
          ...s.strengthFill,
          width: isStrong ? "100%" : "40%",
          background: isStrong
            ? "var(--color-primary)"
            : "var(--text-muted)",
        }}
        title={isStrong ? "Regra forte" : "Regra fraca"}
      />
    </div>
  );
}

function CanonicalEntry({ entry }) {
  const isStrong = entry.strength === "strong";
  return (
    <div
      style={{
        ...s.entry,
        borderLeftColor: isStrong
          ? "var(--color-primary)"
          : "var(--border-light)",
      }}
    >
      <div style={s.entryTop}>
        <span style={s.entryKey}>{entry.key}</span>
        <span
          style={{
            ...s.strengthBadge,
            color: isStrong ? "var(--color-primary)" : "var(--text-muted)",
            background: isStrong
              ? "var(--color-primary-glow)"
              : "rgba(100,116,139,0.1)",
            borderColor: isStrong
              ? "var(--color-primary-border)"
              : "rgba(100,116,139,0.2)",
          }}
        >
          {isStrong ? "FORTE" : "FRACA"}
        </span>
      </div>
      <p style={s.entryValue}>{entry.value}</p>
      <div style={s.entryMeta}>
        <span style={s.scopeBadge}>{entry.scope}</span>
        <span style={s.entryDate}>{formatTs(entry.createdAt)}</span>
      </div>
    </div>
  );
}

export default function CanonicalMemoryCard({ entries }) {
  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.icon} aria-hidden="true">◆</span>
          <p style={s.title}>Memória Canônica</p>
        </div>
        <span style={s.permanentBadge}>PERMANENTE</span>
      </div>
      <p style={s.desc}>
        Regras, identidade e constraints que persistem entre sessões.
        Não são sobrescritas por contexto operacional.
      </p>

      {entries.length === 0 ? (
        <div style={s.empty}>
          <span style={s.emptyText}>Sem entradas canônicas</span>
        </div>
      ) : (
        <div style={s.list}>
          {entries.map((e) => (
            <CanonicalEntry key={e.id} entry={e} />
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
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "14px 16px 12px",
    borderBottom: "1px solid var(--border)",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  icon: {
    fontSize: "14px",
    color: "var(--color-primary)",
    textShadow: "0 0 10px rgba(0,180,216,0.4)",
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
  },
  permanentBadge: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 7px",
    borderRadius: "4px",
    letterSpacing: "1px",
  },
  desc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    padding: "10px 16px",
    borderBottom: "1px solid var(--border)",
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "0",
    maxHeight: "320px",
    overflowY: "auto",
  },
  entry: {
    padding: "10px 14px",
    borderLeft: "3px solid var(--color-primary)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    transition: "background 0.15s",
  },
  entryTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
  },
  entryKey: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--color-primary)",
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  strengthBadge: {
    fontSize: "8px",
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: "3px",
    border: "1px solid",
    letterSpacing: "0.8px",
    flexShrink: 0,
  },
  entryValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  entryMeta: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "6px",
    marginTop: "2px",
  },
  scopeBadge: {
    fontSize: "9px",
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.12)",
    border: "1px solid rgba(100,116,139,0.2)",
    padding: "1px 5px",
    borderRadius: "3px",
    letterSpacing: "0.3px",
  },
  entryDate: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.7,
  },
  strengthBar: {
    height: "2px",
    background: "var(--border)",
    borderRadius: "1px",
    overflow: "hidden",
  },
  strengthFill: {
    height: "100%",
    borderRadius: "1px",
    transition: "width 0.3s ease",
  },
  empty: {
    padding: "20px 16px",
    textAlign: "center",
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    opacity: 0.6,
  },
};
