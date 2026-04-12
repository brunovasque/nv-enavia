// ============================================================================
// OperationalMemoryCard — session-linked learnings & decisions
// ============================================================================

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

function OperationalEntry({ entry }) {
  const isStrong = entry.strength === "strong";
  const isCurrentSession = entry.sessionId === CURRENT_SESSION_ID;

  return (
    <div
      style={{
        ...s.entry,
        borderLeftColor: isStrong ? "#10B981" : "var(--border-light)",
        ...(isCurrentSession ? s.entryCurrentSession : {}),
      }}
    >
      <div style={s.entryTop}>
        <span style={s.entryKey}>{entry.key}</span>
        <div style={s.badges}>
          {isCurrentSession && (
            <span style={s.sessionNowBadge}>SESSÃO ATUAL</span>
          )}
          <span
            style={{
              ...s.strengthBadge,
              color: isStrong ? "#10B981" : "var(--text-muted)",
              background: isStrong
                ? "rgba(16,185,129,0.12)"
                : "rgba(100,116,139,0.1)",
              borderColor: isStrong
                ? "rgba(16,185,129,0.3)"
                : "rgba(100,116,139,0.2)",
            }}
          >
            {isStrong ? "FORTE" : "FRACA"}
          </span>
        </div>
      </div>
      <p style={s.entryValue}>{entry.value}</p>
      <div style={s.entryMeta}>
        <span style={s.sourceBadge}>
          {SOURCE_LABELS[entry.source] || entry.source}
        </span>
        <span style={s.sessionId}>{entry.sessionId}</span>
        <span style={s.entryDate}>{formatTs(entry.createdAt)}</span>
      </div>
    </div>
  );
}

export default function OperationalMemoryCard({ entries }) {
  return (
    <div style={s.card}>
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.icon} aria-hidden="true">○</span>
          <p style={s.title}>Memória Operacional</p>
        </div>
        <span style={s.opBadge}>OPERACIONAL</span>
      </div>
      <p style={s.desc}>
        Decisões, aprendizados e contexto gerado em sessões. Candidatos à
        promoção canônica após consolidação.
      </p>

      {entries.length === 0 ? (
        <div style={s.empty}>
          <span style={s.emptyText}>Sem entradas operacionais</span>
        </div>
      ) : (
        <div style={s.list}>
          {entries.map((e) => (
            <OperationalEntry key={e.id} entry={e} />
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
    fontSize: "16px",
    color: "var(--text-secondary)",
  },
  title: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
  },
  opBadge: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-secondary)",
    background: "rgba(148,163,184,0.12)",
    border: "1px solid rgba(148,163,184,0.2)",
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
    maxHeight: "300px",
    overflowY: "auto",
  },
  entry: {
    padding: "10px 14px",
    borderLeft: "3px solid var(--border-light)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  entryCurrentSession: {
    background: "rgba(16,185,129,0.04)",
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
    color: "var(--text-secondary)",
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  badges: {
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
    padding: "1px 5px",
    borderRadius: "3px",
    letterSpacing: "0.8px",
  },
  strengthBadge: {
    fontSize: "8px",
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: "3px",
    border: "1px solid",
    letterSpacing: "0.8px",
  },
  entryValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  entryMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    marginTop: "2px",
    flexWrap: "wrap",
  },
  sourceBadge: {
    fontSize: "9px",
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.12)",
    border: "1px solid rgba(100,116,139,0.2)",
    padding: "1px 5px",
    borderRadius: "3px",
    letterSpacing: "0.3px",
  },
  sessionId: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.6,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  entryDate: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.7,
    flexShrink: 0,
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
