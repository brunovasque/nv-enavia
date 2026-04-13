// ============================================================================
// MemoryInUseCard — P18-PR1 — "Memória em uso" visibility card
//
// Answers 5 questions clearly for the operator:
//   1. Which memories were consulted (count + type breakdown)
//   2. Type/tier of memories in use
//   3. Which priority won (applied priority)
//   4. Whether memory was read before the plan
//   5. Basic audit snapshots available
//
// Receives data from the memory payload — displays honest state when absent.
// PANEL-ONLY. No backend changes required.
// ============================================================================

const TIER_LABELS = {
  1: "Tier 1 — Regras canônicas permanentes",
  2: "Tier 2 — Contratos canônicos",
  3: "Tier 3 — Memória de projeto",
  4: "Tier 4 — Contexto vivo",
  5: "Tier 5 — Perfil do usuário",
  6: "Tier 6 — Histórico operacional",
  7: "Tier 7 — Outros",
};

const PRIORITY_LABELS = {
  critical: "CRÍTICA",
  high:     "ALTA",
  medium:   "MÉDIA",
  low:      "BAIXA",
};

const PRIORITY_COLORS = {
  critical: "#EF4444",
  high:     "#F59E0B",
  medium:   "var(--color-primary)",
  low:      "var(--text-muted)",
};

const SNAPSHOT_TYPE_LABELS = {
  session_start:  "Início de sessão",
  pre_plan_read:  "Pré-plano",
  gate_approved:  "Gate aprovado",
  gate_rejected:  "Gate rejeitado",
  consolidation:  "Consolidação",
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

// ── Info pill ───────────────────────────────────────────────────────────────
function InfoPill({ icon, label, value, subValue, accent, honest }) {
  return (
    <div style={s.pill}>
      <div style={s.pillIcon} aria-hidden="true">{icon}</div>
      <div style={s.pillBody}>
        <p style={s.pillLabel}>{label}</p>
        {honest ? (
          <p style={s.pillHonest}>{value}</p>
        ) : (
          <>
            <p style={{ ...s.pillValue, ...(accent ? { color: accent } : {}) }}>
              {value}
            </p>
            {subValue && <p style={s.pillSub}>{subValue}</p>}
          </>
        )}
      </div>
    </div>
  );
}

// ── Snapshot row ────────────────────────────────────────────────────────────
function SnapshotRow({ snap }) {
  const typeLabel = SNAPSHOT_TYPE_LABELS[snap.type] || snap.type;
  return (
    <div style={s.snapRow}>
      <span style={s.snapDot} aria-hidden="true" />
      <div style={s.snapBody}>
        <span style={s.snapLabel}>{snap.label}</span>
        <span style={s.snapType}>{typeLabel}</span>
      </div>
      <span style={s.snapTs}>{formatTs(snap.createdAt)}</span>
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function MemoryInUseCard({ memory }) {
  const readBeforePlan = memory?.memoryReadBeforePlan ?? null;
  const snapshots      = memory?.auditSnapshots ?? [];
  const canonical      = memory?.canonicalEntries ?? [];
  const operational    = memory?.operationalEntries ?? [];

  const totalConsulted = canonical.length + operational.length;
  const hasData        = totalConsulted > 0;

  // Derive the top tier and top priority from entries
  const allEntries = [...canonical, ...operational];
  const minTier    = hasData
    ? Math.min(...allEntries.map((e) => e.tier ?? 7))
    : null;
  const topPriority = readBeforePlan?.topPriority ?? null;

  // Pill 1 — Memory consulted
  const consultedValue = hasData
    ? `${totalConsulted} entrada${totalConsulted !== 1 ? "s" : ""}`
    : null;
  const consultedSub = hasData
    ? `${canonical.length} canônica · ${operational.length} operacional`
    : null;

  // Pill 2 — Tier/type
  const tierValue = minTier != null
    ? `Tier ${minTier} — mais alta`
    : null;
  const tierSub   = minTier != null ? TIER_LABELS[minTier] : null;

  // Pill 3 — Priority applied
  const prioValue  = topPriority ? PRIORITY_LABELS[topPriority] ?? (typeof topPriority === "string" ? topPriority.toUpperCase() : String(topPriority)) : null;
  const prioAccent = topPriority ? PRIORITY_COLORS[topPriority] : null;
  const prioSub    = topPriority ? `prioridade aplicada` : null;

  // Pill 4 — Read before plan
  const readValue = readBeforePlan?.happened === true
    ? `✓ ${readBeforePlan.memoriesRead} mem. lidas`
    : readBeforePlan?.happened === false
    ? "Sem leitura registrada"
    : null;
  const readSub = readBeforePlan?.happened === true && readBeforePlan.readAt
    ? formatTs(readBeforePlan.readAt)
    : null;

  return (
    <div style={s.card} role="region" aria-label="Memória em uso">
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon} aria-hidden="true">🧠</span>
          <div>
            <p style={s.title}>Memória em uso</p>
            <p style={s.subtitle}>O que a Enavia está usando agora</p>
          </div>
        </div>
        <span
          style={{
            ...s.badge,
            ...(hasData ? s.badgeActive : s.badgeEmpty),
          }}
        >
          {hasData ? "COM DADOS" : "SEM DADOS"}
        </span>
      </div>

      {/* Pills row */}
      <div style={s.pills}>
        {/* Memória consultada */}
        {hasData ? (
          <InfoPill
            icon="◈"
            label="Memória consultada"
            value={consultedValue}
            subValue={consultedSub}
            accent="var(--color-primary)"
          />
        ) : (
          <InfoPill
            icon="◈"
            label="Memória consultada"
            value="Sem entradas"
            honest
          />
        )}

        <div style={s.pillDivider} aria-hidden="true" />

        {/* Tier / tipo */}
        {minTier != null ? (
          <InfoPill
            icon="◆"
            label="Tier mais alto ativo"
            value={tierValue}
            subValue={tierSub}
            accent="var(--color-primary)"
          />
        ) : (
          <InfoPill
            icon="◆"
            label="Tier mais alto ativo"
            value="Sem dados de tier"
            honest
          />
        )}

        <div style={s.pillDivider} aria-hidden="true" />

        {/* Prioridade */}
        {prioValue != null ? (
          <InfoPill
            icon="▲"
            label="Prioridade aplicada"
            value={prioValue}
            subValue={prioSub}
            accent={prioAccent}
          />
        ) : (
          <InfoPill
            icon="▲"
            label="Prioridade aplicada"
            value="Sem dados de prioridade"
            honest
          />
        )}

        <div style={s.pillDivider} aria-hidden="true" />

        {/* Leitura antes do plano */}
        {readBeforePlan != null ? (
          <InfoPill
            icon={readBeforePlan.happened ? "✓" : "○"}
            label="Leitura antes do plano"
            value={readValue}
            subValue={readSub}
            accent={readBeforePlan.happened ? "#10B981" : "var(--text-muted)"}
          />
        ) : (
          <InfoPill
            icon="○"
            label="Leitura antes do plano"
            value="Não disponível"
            honest
          />
        )}
      </div>

      {/* Audit snapshots */}
      <div style={s.snapSection}>
        <div style={s.snapHeader}>
          <p style={s.snapTitle}>SNAPSHOTS DE AUDITORIA</p>
          <span style={s.snapCount}>
            {snapshots.length > 0
              ? `${snapshots.length} disponíve${snapshots.length !== 1 ? "is" : "l"}`
              : "nenhum"}
          </span>
        </div>

        {snapshots.length === 0 ? (
          <p style={s.snapEmpty}>
            Nenhum snapshot de auditoria disponível nesta sessão.
          </p>
        ) : (
          <div style={s.snapList}>
            {snapshots.map((snap) => (
              <SnapshotRow key={snap.id} snap={snap} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    flexShrink: 0,
  },

  // Header
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 20px 14px",
    borderBottom: "1px solid var(--border)",
    gap: "12px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerIcon: {
    fontSize: "20px",
    flexShrink: 0,
  },
  title: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
    marginTop: "2px",
  },
  badge: {
    fontSize: "9px",
    fontWeight: 700,
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid",
    letterSpacing: "1px",
    flexShrink: 0,
  },
  badgeActive: {
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    borderColor: "var(--color-primary-border)",
  },
  badgeEmpty: {
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.1)",
    borderColor: "rgba(100,116,139,0.2)",
  },

  // Pills row
  pills: {
    display: "flex",
    alignItems: "stretch",
    borderBottom: "1px solid var(--border)",
    flexWrap: "wrap",
  },
  pill: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "14px 20px",
    flex: "1 1 160px",
    minWidth: 0,
  },
  pillDivider: {
    width: "1px",
    background: "var(--border)",
    flexShrink: 0,
    alignSelf: "stretch",
  },
  pillIcon: {
    fontSize: "16px",
    color: "var(--text-muted)",
    flexShrink: 0,
    marginTop: "1px",
    lineHeight: 1,
  },
  pillBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  pillLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "2px",
  },
  pillValue: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    lineHeight: 1.2,
  },
  pillSub: {
    fontSize: "10px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    marginTop: "1px",
  },
  pillHonest: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
    opacity: 0.7,
  },

  // Audit snapshots section
  snapSection: {
    padding: "14px 20px 16px",
  },
  snapHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "10px",
    gap: "8px",
  },
  snapTitle: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  snapCount: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.7,
  },
  snapList: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  snapRow: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "7px 10px",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  snapDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    flexShrink: 0,
    opacity: 0.7,
  },
  snapBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  snapLabel: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    fontWeight: 500,
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  snapType: {
    fontSize: "9px",
    color: "var(--text-muted)",
    background: "rgba(100,116,139,0.1)",
    border: "1px solid rgba(100,116,139,0.15)",
    padding: "1px 5px",
    borderRadius: "3px",
    letterSpacing: "0.3px",
    flexShrink: 0,
  },
  snapTs: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    opacity: 0.7,
    flexShrink: 0,
  },
  snapEmpty: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.6,
    fontStyle: "italic",
  },
};
