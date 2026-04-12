// ============================================================================
// GateCard — gate humano: estado, aprovador, timeout, motivo, ações humanas
// P11: botões aprovar/rejeitar visíveis quando state=pending
// ============================================================================

export const GATE_META = {
  pending: {
    label: "Aguardando aprovação",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: "⏳",
  },
  approved: {
    label: "Aprovado — liberado",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: "✓",
  },
  blocked: {
    label: "Rejeitado — bloqueado",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
  dispensed: {
    label: "Dispensado",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    icon: "○",
  },
};

function Row({ label, value, mono = false }) {
  return (
    <div style={s.row}>
      <span style={s.rowLabel}>{label}</span>
      <span style={{ ...s.rowValue, ...(mono ? { fontFamily: "var(--font-mono)", fontSize: "11px" } : {}) }}>
        {value}
      </span>
    </div>
  );
}

// ── GateActions — botões de ação humana (P11) ──────────────────────────────
// Renderizados SOMENTE quando gate.state === "pending".
// Não disparam execução real nem bridge. Delegam ao handler do PlanPage.
function GateActions({ onApprove, onReject }) {
  return (
    <div style={s.actions} role="group" aria-label="Ações do gate humano">
      <p style={s.actionsLabel}>Ação humana requerida</p>
      <div style={s.actionsBtns}>
        <button
          style={{ ...s.actionBtn, ...s.approveBtn }}
          onClick={onApprove}
          aria-label="Aprovar gate — liberar execução"
        >
          ✓ Aprovar
        </button>
        <button
          style={{ ...s.actionBtn, ...s.rejectBtn }}
          onClick={onReject}
          aria-label="Rejeitar gate — bloquear execução"
        >
          ✕ Rejeitar
        </button>
      </div>
    </div>
  );
}

// ── GateResolved — feedback visual pós-ação ────────────────────────────────
function GateResolved({ state, meta }) {
  const isApproved = state === "approved";
  return (
    <div
      style={{
        ...s.resolvedBlock,
        background: meta.bg,
        borderColor: meta.border,
      }}
      role="status"
      aria-live="polite"
    >
      <span style={{ ...s.resolvedIcon, color: meta.color }} aria-hidden="true">
        {meta.icon}
      </span>
      <p style={{ ...s.resolvedText, color: meta.color }}>
        {isApproved
          ? "Gate aprovado. Execução liberada pelo operador."
          : "Gate rejeitado. Execução bloqueada pelo operador."}
      </p>
    </div>
  );
}

export default function GateCard({ gate, onApprove, onReject }) {
  if (!gate) return null;
  const { required, state, approver, timeout, reason } = gate;
  const meta = GATE_META[state] ?? GATE_META.pending;
  const isPending = state === "pending";
  const isResolved = state === "approved" || state === "blocked";

  return (
    <div
      style={{
        ...s.card,
        borderColor: meta.border,
      }}
    >
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Gate Humano</p>
        <span
          style={{
            ...s.stateBadge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
          role="status"
          aria-label={`Status do gate: ${meta.label}`}
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      <div style={s.rows}>
        <Row label="Obrigatório" value={required ? "Sim" : "Não"} />
        <Row label="Aprovador" value={approver ?? "—"} />
        {timeout && <Row label="Timeout" value={timeout} mono />}
      </div>

      {reason && (
        <div style={{ ...s.reasonBlock, borderColor: meta.border }}>
          <p style={s.reasonText}>{reason}</p>
        </div>
      )}

      {/* Ações humanas — visíveis SOMENTE quando pendente (P11) */}
      {isPending && typeof onApprove === "function" && typeof onReject === "function" && (
        <GateActions onApprove={onApprove} onReject={onReject} />
      )}

      {/* Feedback pós-ação — visível após aprovação ou rejeição (P11) */}
      {isResolved && <GateResolved state={state} meta={meta} />}
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid",
    borderRadius: "var(--radius-lg)",
    padding: "16px",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "8px",
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  stateBadge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid",
  },
  rows: {
    display: "flex",
    flexDirection: "column",
    gap: "7px",
  },
  row: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: "8px",
  },
  rowLabel: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  rowValue: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 500,
    textAlign: "right",
  },
  reasonBlock: {
    marginTop: "10px",
    padding: "8px 10px",
    background: "var(--bg-base)",
    borderRadius: "var(--radius-sm)",
    borderLeft: "2px solid",
  },
  reasonText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
  },
  // P11 — ações humanas
  actions: {
    marginTop: "14px",
    paddingTop: "12px",
    borderTop: "1px solid var(--border)",
  },
  actionsLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "10px",
  },
  actionsBtns: {
    display: "flex",
    gap: "8px",
  },
  actionBtn: {
    flex: 1,
    padding: "7px 10px",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.3px",
    transition: "opacity 0.15s ease",
  },
  approveBtn: {
    background: "rgba(16,185,129,0.12)",
    color: "#10B981",
    borderColor: "rgba(16,185,129,0.35)",
  },
  rejectBtn: {
    background: "rgba(239,68,68,0.1)",
    color: "#EF4444",
    borderColor: "rgba(239,68,68,0.3)",
  },
  // P11 — feedback pós-ação
  resolvedBlock: {
    marginTop: "12px",
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
  },
  resolvedIcon: {
    fontSize: "14px",
    flexShrink: 0,
    fontWeight: 700,
  },
  resolvedText: {
    fontSize: "11px",
    fontWeight: 500,
    lineHeight: 1.4,
  },
};
