// ============================================================================
// LiveContextBlock — live session with real presence
// This block differentiates live memory from archive. It must have weight.
// ============================================================================

const CONTRACT_STATUS_META = {
  running: { label: "ativo", color: "#10B981", dot: "#10B981" },
  waiting: { label: "aguardando", color: "#F59E0B", dot: "#F59E0B" },
  done: { label: "concluído", color: "var(--text-muted)", dot: "var(--text-muted)" },
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

function ConfidenceBar({ value }) {
  const pct = Math.round(value * 100);
  return (
    <div style={s.confBar} title={`${pct}%`}>
      <div
        style={{
          ...s.confFill,
          width: `${pct}%`,
          background: pct >= 90
            ? "var(--color-primary)"
            : pct >= 75
            ? "#F59E0B"
            : "#EF4444",
        }}
      />
    </div>
  );
}

// ── No active session ───────────────────────────────────────────────────────
function InactiveSession() {
  return (
    <div style={s.inactiveWrap}>
      <div style={s.inactiveDot} aria-hidden="true" />
      <div>
        <p style={s.inactiveTitle}>Sem sessão ativa</p>
        <p style={s.inactiveSub}>
          Memória em modo arquivo — nenhum contexto vivo no momento.
          Inicie uma instrução no Chat para ativar uma sessão.
        </p>
      </div>
    </div>
  );
}

// ── Active live context ─────────────────────────────────────────────────────
export default function LiveContextBlock({ liveContext }) {
  if (!liveContext) return <InactiveSession />;

  return (
    <div style={s.wrap} role="region" aria-label="Contexto vivo da sessão">
      {/* Header row */}
      <div style={s.headerRow}>
        <div style={s.badge}>
          <span className="exec-dot-pulse" style={s.liveDot} aria-hidden="true" />
          <span style={s.badgeText}>SESSÃO VIVA</span>
        </div>
        <div style={s.sessionMeta}>
          <span style={s.sessionId}>{liveContext.sessionId}</span>
          <span style={s.metaSep} aria-hidden="true">·</span>
          <span style={s.metaText}>Iniciada {formatTs(liveContext.startedAt)}</span>
          <span style={s.metaSep} aria-hidden="true">·</span>
          <span style={s.duration}>{liveContext.duration} em execução</span>
        </div>
      </div>

      {/* Intent — most prominent, full width */}
      <div style={s.intentBlock}>
        <p style={s.intentLabel}>INTENT ATIVO</p>
        <p style={s.intentText}>{liveContext.intent}</p>
      </div>

      {/* Bottom row: signals + contracts */}
      <div style={s.bottomRow}>
        {/* Signals */}
        <div style={s.section}>
          <p style={s.sectionLabel}>SINAIS COGNITIVOS</p>
          <div style={s.signalList}>
            {liveContext.signals.map((sig) => (
              <div key={sig.key} style={s.signalRow}>
                <div style={s.signalLeft}>
                  <span style={s.sigKey}>{sig.key}</span>
                  <span style={s.sigValue}>{sig.value}</span>
                </div>
                <div style={s.signalRight}>
                  <ConfidenceBar value={sig.confidence} />
                  <span style={s.sigConf}>
                    {Math.round(sig.confidence * 100)}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={s.sectionDivider} aria-hidden="true" />

        {/* Active contracts */}
        <div style={s.section}>
          <p style={s.sectionLabel}>CONTRATOS ATIVOS</p>
          <div style={s.contractList}>
            {liveContext.activeContracts.map((ctr) => {
              const meta = CONTRACT_STATUS_META[ctr.status] || CONTRACT_STATUS_META.waiting;
              return (
                <div key={ctr.id} style={s.contractRow}>
                  <span
                    style={{ ...s.contractDot, background: meta.dot }}
                    aria-hidden="true"
                  />
                  <div style={s.contractInfo}>
                    <span style={s.contractLabel}>{ctr.label}</span>
                    <span style={s.contractId}>{ctr.id}</span>
                  </div>
                  <span
                    style={{
                      ...s.contractStatus,
                      color: meta.color,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  // Active session wrapper — blue-tinted, has glow presence
  wrap: {
    background: "linear-gradient(135deg, #0D1F35 0%, #0B1825 100%)",
    border: "1px solid rgba(0,180,216,0.35)",
    borderRadius: "var(--radius-lg)",
    padding: "20px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    boxShadow: "0 0 32px rgba(0,180,216,0.08), inset 0 1px 0 rgba(0,180,216,0.12)",
    flexShrink: 0,
  },

  // Header row
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    flexWrap: "wrap",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "7px",
    background: "rgba(16,185,129,0.15)",
    border: "1px solid rgba(16,185,129,0.35)",
    borderRadius: "20px",
    padding: "4px 12px",
    flexShrink: 0,
  },
  liveDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#10B981",
    boxShadow: "0 0 8px rgba(16,185,129,0.6)",
    flexShrink: 0,
    display: "inline-block",
  },
  badgeText: {
    fontSize: "11px",
    fontWeight: 700,
    color: "#10B981",
    letterSpacing: "1.5px",
  },
  sessionMeta: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  sessionId: {
    fontSize: "12px",
    fontFamily: "var(--font-mono)",
    color: "var(--color-primary)",
    fontWeight: 500,
  },
  metaSep: {
    color: "var(--border-light)",
    fontSize: "12px",
  },
  metaText: {
    fontSize: "11px",
    color: "var(--text-muted)",
  },
  duration: {
    fontSize: "11px",
    color: "#10B981",
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
  },

  // Intent block — most prominent element
  intentBlock: {
    background: "rgba(0,180,216,0.06)",
    border: "1px solid rgba(0,180,216,0.18)",
    borderLeft: "3px solid var(--color-primary)",
    borderRadius: "0 var(--radius-md) var(--radius-md) 0",
    padding: "12px 16px",
  },
  intentLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--color-primary)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginBottom: "6px",
    opacity: 0.8,
  },
  intentText: {
    fontSize: "14px",
    color: "var(--text-primary)",
    lineHeight: 1.55,
    fontWeight: 500,
  },

  // Bottom row
  bottomRow: {
    display: "flex",
    gap: "0",
    alignItems: "flex-start",
  },
  sectionDivider: {
    width: "1px",
    background: "rgba(0,180,216,0.12)",
    alignSelf: "stretch",
    margin: "0 20px",
    flexShrink: 0,
  },
  section: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  sectionLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
  },

  // Signals
  signalList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  signalRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "8px",
  },
  signalLeft: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  sigKey: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
  },
  sigValue: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  signalRight: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  confBar: {
    width: "48px",
    height: "3px",
    background: "var(--border-light)",
    borderRadius: "2px",
    overflow: "hidden",
  },
  confFill: {
    height: "100%",
    borderRadius: "2px",
    transition: "width 0.3s ease",
  },
  sigConf: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    width: "28px",
    textAlign: "right",
  },

  // Contracts
  contractList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  contractRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 10px",
    background: "rgba(255,255,255,0.03)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid rgba(255,255,255,0.05)",
  },
  contractDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  contractInfo: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
  },
  contractLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 500,
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  contractId: {
    fontSize: "9px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
  },
  contractStatus: {
    fontSize: "10px",
    fontWeight: 600,
    flexShrink: 0,
    letterSpacing: "0.3px",
  },

  // Inactive state
  inactiveWrap: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 24px",
    flexShrink: 0,
  },
  inactiveDot: {
    width: "10px",
    height: "10px",
    borderRadius: "50%",
    background: "var(--border-light)",
    flexShrink: 0,
  },
  inactiveTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-muted)",
    marginBottom: "2px",
  },
  inactiveSub: {
    fontSize: "12px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1.5,
  },
};
