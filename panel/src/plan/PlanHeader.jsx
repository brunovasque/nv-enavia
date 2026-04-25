// ============================================================================
// PlanHeader — pedido original + status geral + state switcher
// ============================================================================

import { PLAN_STATUS } from "./mockPlan";

const STATUS_META = {
  [PLAN_STATUS.COMPLETE]: {
    label: "Completo",
    color: "#10B981",
    bg: "rgba(16,185,129,0.12)",
    border: "rgba(16,185,129,0.3)",
    dot: "#10B981",
  },
  [PLAN_STATUS.EMPTY]: {
    label: "Sem plano",
    color: "var(--text-muted)",
    bg: "rgba(100,116,139,0.1)",
    border: "rgba(100,116,139,0.25)",
    dot: "var(--text-muted)",
  },
  [PLAN_STATUS.BLOCKED]: {
    label: "Bloqueado",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.12)",
    border: "rgba(245,158,11,0.3)",
    dot: "#F59E0B",
  },
  [PLAN_STATUS.READY]: {
    label: "Pronto",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    dot: "var(--color-primary)",
  },
};

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PlanHeader({ plan, currentState, lastChatText, hasDemoOverride, onDemoOverride, onClearDemoOverride }) {
  const meta = STATUS_META[currentState];

  function handleSwitcherClick(st, active) {
    if (active && hasDemoOverride) {
      onClearDemoOverride();
    } else {
      onDemoOverride(st);
    }
  }

  return (
    <div style={s.wrap}>
      {/* Top row: identity + status badge */}
      <div style={s.topRow}>
        <div style={s.identity}>
          <span style={s.mark} aria-hidden="true">◆</span>
          <div>
            <p style={s.pageTitle}>Plano de Execução</p>
            {plan && (
              <p style={s.planId}>
                {plan.id} · {formatTs(plan.createdAt)}
              </p>
            )}
          </div>
        </div>

        <div style={s.rightGroup}>
          {/* Status badge */}
          <span
            style={{
              ...s.statusBadge,
              color: meta.color,
              background: meta.bg,
              borderColor: meta.border,
            }}
          >
            <span
              style={{ ...s.statusDot, background: meta.dot }}
              aria-hidden="true"
            />
            {meta.label}
          </span>
        </div>
      </div>

      {/* Request block */}
      {plan ? (
        <div style={s.requestBlock}>
          <p style={s.requestLabel}>Pedido</p>
          <p style={s.requestText}>{plan.request?.text ?? lastChatText ?? "—"}</p>
          <p style={s.requestTs}>{formatTs(plan.request?.timestamp)}</p>
        </div>
      ) : lastChatText ? (
        <div style={s.requestBlock}>
          <p style={s.requestLabel}>Instrução</p>
          <p style={{ ...s.requestText, fontStyle: "italic", color: "var(--text-muted)" }}>
            {lastChatText}
          </p>
          <p style={{ ...s.requestTs, fontSize: "10px", color: "var(--text-muted)", opacity: 0.6 }}>
            Texto do chat — não é plano homologado
          </p>
        </div>
      ) : (
        <div style={s.requestBlock}>
          <p style={s.requestLabel}>Pedido</p>
          <p style={{ ...s.requestText, color: "var(--text-muted)", fontStyle: "italic" }}>
            Nenhum plano ativo nesta sessão.
          </p>
        </div>
      )}

      {/* State switcher — demo */}
      <div style={s.switcher} role="group" aria-label="Estado do plano (demo)">
        <span style={s.switcherLabel}>
          Estado demo{hasDemoOverride ? " (ativo)" : ""}:
        </span>
        {Object.values(PLAN_STATUS).map((st) => {
          const m = STATUS_META[st];
          const active = st === currentState;
          return (
            <button
              key={st}
              style={{
                ...s.switchBtn,
                ...(active
                  ? { color: m.color, background: m.bg, borderColor: m.border }
                  : {}),
              }}
              onClick={() => handleSwitcherClick(st, active)}
              aria-pressed={active}
            >
              {m.label}
            </button>
          );
        })}
      </div>
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
  planId: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    fontFamily: "var(--font-mono)",
    marginTop: "2px",
  },
  rightGroup: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexShrink: 0,
  },
  statusBadge: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "12px",
    fontWeight: 600,
    padding: "4px 10px",
    borderRadius: "20px",
    border: "1px solid",
    letterSpacing: "0.3px",
  },
  statusDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    flexShrink: 0,
  },
  requestBlock: {
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    padding: "12px 16px",
    borderLeft: "3px solid var(--color-primary-border)",
  },
  requestLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "6px",
  },
  requestText: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
  },
  requestTs: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginTop: "6px",
  },
  switcher: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexWrap: "wrap",
  },
  switcherLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
    marginRight: "2px",
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
};
