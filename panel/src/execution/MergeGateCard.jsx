// ============================================================================
// MergeGateCard — P24: approval formal de merge no painel
//
// Renderiza o estado do merge gate do P24 e, quando awaiting_formal_approval,
// exibe o resumo (summary_for_merge), a explicação (reason_merge_ok) e o
// botão "Aprovar merge" que chama POST /github-pr/approve-merge.
//
// Estados suportados:
//   not_ready              → badge cinza
//   awaiting_formal_approval → badge amarelo + bloco de approval
//   approved_for_merge     → badge verde + feedback de confirmação
//   blocked                → badge vermelho
// ============================================================================

import { useState } from "react";
import { approveMerge } from "../api";

// ── Status metadata ───────────────────────────────────────────────────────────

const STATUS_META = {
  not_ready: {
    label: "Não pronto",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    icon: "○",
  },
  awaiting_formal_approval: {
    label: "Aguardando approval",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: "⏳",
  },
  approved_for_merge: {
    label: "Aprovado para merge",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: "✓",
  },
  blocked: {
    label: "Bloqueado",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
};

// ── MergeGateCard ─────────────────────────────────────────────────────────────

export default function MergeGateCard({ mergeGate }) {
  const [localStatus, setLocalStatus] = useState(null);
  const [approving, setApproving] = useState(false);
  const [approveError, setApproveError] = useState(null);

  if (!mergeGate) return null;

  const effectiveStatus = localStatus ?? mergeGate.merge_status;
  const meta = STATUS_META[effectiveStatus] ?? STATUS_META.not_ready;

  const isAwaiting  = effectiveStatus === "awaiting_formal_approval";
  const isApproved  = effectiveStatus === "approved_for_merge";

  async function handleApprove() {
    setApproving(true);
    setApproveError(null);

    const result = await approveMerge({
      summary_for_merge: mergeGate.summary_for_merge,
      reason_merge_ok:   mergeGate.reason_merge_ok,
    });

    setApproving(false);

    if (result.ok) {
      setLocalStatus("approved_for_merge");
    } else {
      setApproveError(result.error?.message ?? "Falha ao aprovar merge. Tente novamente.");
    }
  }

  return (
    <div
      style={{ ...s.card, borderColor: meta.border }}
      data-testid="merge-gate-card"
    >
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div style={s.header}>
        <p style={s.title}>Merge Gate · P24</p>
        <span
          style={{
            ...s.badge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
          role="status"
          aria-label={`Estado do merge gate: ${meta.label}`}
          data-testid="merge-gate-status"
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      {/* ── Approval block — visible when awaiting ─────────────────────── */}
      {isAwaiting && (
        <div style={s.approvalBlock} data-testid="merge-gate-approval-block">
          {/* Summary */}
          {mergeGate.summary_for_merge && (
            <div style={s.section}>
              <p style={s.sectionLabel}>O que foi feito</p>
              <p style={s.sectionText} data-testid="merge-gate-summary">
                {mergeGate.summary_for_merge}
              </p>
            </div>
          )}

          {/* Reason */}
          {mergeGate.reason_merge_ok && (
            <div style={s.section}>
              <p style={s.sectionLabel}>Por que está ok</p>
              <p style={s.sectionText} data-testid="merge-gate-reason">
                {mergeGate.reason_merge_ok}
              </p>
            </div>
          )}

          {/* Approve button */}
          <div style={s.actions}>
            <p style={s.actionsLabel}>Ação requerida</p>
            <button
              style={{
                ...s.approveBtn,
                ...(approving ? s.approveBtnDisabled : {}),
              }}
              onClick={handleApprove}
              disabled={approving}
              aria-label="Aprovar merge em main"
              data-testid="merge-gate-approve-btn"
            >
              {approving ? "Aprovando..." : "✓ Aprovar merge"}
            </button>

            {/* Error feedback */}
            {approveError && (
              <p style={s.errorText} role="alert" data-testid="merge-gate-error">
                ⚠ {approveError}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Approved feedback ───────────────────────────────────────────── */}
      {isApproved && (
        <div
          style={{ ...s.resolvedBlock, background: meta.bg, borderColor: meta.border }}
          role="status"
          aria-live="polite"
          data-testid="merge-gate-approved-feedback"
        >
          <span style={{ ...s.resolvedIcon, color: meta.color }} aria-hidden="true">✓</span>
          <p style={{ ...s.resolvedText, color: meta.color }}>
            Merge aprovado formalmente — pronto para merge em main.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid",
    borderRadius: "var(--radius-lg)",
    padding: "16px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "12px",
    gap: "8px",
  },
  title: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  badge: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    padding: "3px 8px",
    borderRadius: "4px",
    border: "1px solid",
  },
  // Approval block — visible when awaiting_formal_approval
  approvalBlock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    marginTop: "4px",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sectionLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
  },
  sectionText: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.5,
    background: "var(--bg-base)",
    padding: "6px 8px",
    borderRadius: "var(--radius-sm)",
    borderLeft: "2px solid rgba(245,158,11,0.35)",
  },
  // Actions
  actions: {
    marginTop: "4px",
    paddingTop: "10px",
    borderTop: "1px solid var(--border)",
  },
  actionsLabel: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1px",
    textTransform: "uppercase",
    marginBottom: "8px",
  },
  approveBtn: {
    width: "100%",
    padding: "7px 10px",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    border: "1px solid rgba(16,185,129,0.35)",
    background: "rgba(16,185,129,0.12)",
    color: "#10B981",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.3px",
    transition: "opacity 0.15s ease",
    textAlign: "center",
  },
  approveBtnDisabled: {
    opacity: 0.5,
    cursor: "not-allowed",
  },
  errorText: {
    marginTop: "6px",
    fontSize: "11px",
    color: "#EF4444",
    lineHeight: 1.4,
  },
  // Approved feedback
  resolvedBlock: {
    marginTop: "8px",
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
