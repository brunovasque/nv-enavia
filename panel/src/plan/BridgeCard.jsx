// ============================================================================
// BridgeCard — handoff entre módulos: estado da ponte, destino, payload
// P12: reflete status de envio real da bridge (sending/sent/error)
// ============================================================================

const BRIDGE_META = {
  waiting_gate: {
    label: "Aguardando gate",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.1)",
    border: "rgba(245,158,11,0.25)",
    icon: "⧗",
  },
  active: {
    label: "Ativa",
    color: "#10B981",
    bg: "rgba(16,185,129,0.1)",
    border: "rgba(16,185,129,0.25)",
    icon: "⇒",
  },
  ready: {
    label: "Pronta para execução",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    icon: "→",
  },
  blocked: {
    label: "Bloqueada",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.1)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
  idle: {
    label: "Inativa",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    icon: "○",
  },
};

// P12 — send status visual metadata
const BRIDGE_SEND_META = {
  sending: {
    label: "Enviando bridge…",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    icon: "⟳",
  },
  sent: {
    label: "Bridge enviada ✓",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    icon: "✓",
  },
  error: {
    label: "Falha no envio",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
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

// P12 — BridgeSendStatus: feedback visual do envio real da bridge
function BridgeSendStatus({ sendStatus, sendResult, sendError }) {
  if (!sendStatus || sendStatus === "idle") return null;
  const meta = BRIDGE_SEND_META[sendStatus];
  if (!meta) return null;

  return (
    <div
      style={{
        ...s.sendBlock,
        background: meta.bg,
        borderColor: meta.border,
      }}
      role="status"
      aria-live="polite"
      aria-label={`Status da bridge: ${meta.label}`}
    >
      <span style={{ ...s.sendIcon, color: meta.color }} aria-hidden="true">
        {meta.icon}
      </span>
      <div style={s.sendContent}>
        <p style={{ ...s.sendText, color: meta.color }}>
          {meta.label}
        </p>
        {sendStatus === "sent" && sendResult?.bridge_id && (
          <p style={s.sendDetail}>ID: {sendResult.bridge_id}</p>
        )}
        {sendStatus === "error" && sendError && (
          <p style={s.sendDetail}>{sendError}</p>
        )}
      </div>
    </div>
  );
}

// ── P13 — Dispatch Outcome ────────────────────────────────────────────────
// After bridge is sent, interpret executor_response to show a clear post-dispatch
// status: accepted, immediate error, or missing response.
// Scope: P13 only — immediate executor return. No P14+ features.

export const DISPATCH_STATUS = {
  ACCEPTED: "dispatch_accepted",
  ERROR:    "dispatch_error",
  MISSING:  "dispatch_missing",
};

const DISPATCH_META = {
  [DISPATCH_STATUS.ACCEPTED]: {
    label: "Execução aceita pelo executor",
    color: "#10B981",
    bg: "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
    icon: "▷",
  },
  [DISPATCH_STATUS.ERROR]: {
    label: "Erro imediato do executor",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.25)",
    icon: "✕",
  },
  [DISPATCH_STATUS.MISSING]: {
    label: "Resposta do executor ausente",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.25)",
    icon: "?",
  },
};

/**
 * Derive a dispatch status from the executor_response returned by bridge.
 * Pure function — no side effects, no network calls.
 *
 * @param {object|null|undefined} executorResponse — raw executor_response from sendBridge result
 * @returns {{ status: string, detail: string|null }}
 */
export function deriveDispatchOutcome(executorResponse) {
  if (!executorResponse || typeof executorResponse !== "object") {
    return { status: DISPATCH_STATUS.MISSING, detail: null };
  }
  if (executorResponse.ok === true) {
    const detail = typeof executorResponse.execution_status === "string"
      ? executorResponse.execution_status
      : null;
    return { status: DISPATCH_STATUS.ACCEPTED, detail };
  }
  // executor responded but ok !== true → immediate error
  const errMsg = typeof executorResponse.error === "string"
    ? executorResponse.error
    : (typeof executorResponse.message === "string"
      ? executorResponse.message
      : null);
  return { status: DISPATCH_STATUS.ERROR, detail: errMsg };
}

function DispatchOutcome({ sendStatus, sendResult }) {
  // Only render after bridge has been successfully sent
  if (sendStatus !== "sent" || !sendResult) return null;

  const { status, detail } = deriveDispatchOutcome(sendResult.executor_response);
  const meta = DISPATCH_META[status];
  if (!meta) return null;

  return (
    <div
      style={{
        ...s.sendBlock,
        background: meta.bg,
        borderColor: meta.border,
        marginTop: "6px",
      }}
      role="status"
      aria-live="polite"
      aria-label={`Resultado do executor: ${meta.label}`}
    >
      <span style={{ ...s.sendIcon, color: meta.color }} aria-hidden="true">
        {meta.icon}
      </span>
      <div style={s.sendContent}>
        <p style={{ ...s.sendText, color: meta.color }}>
          {meta.label}
        </p>
        {detail && (
          <p style={s.sendDetail}>{detail}</p>
        )}
      </div>
    </div>
  );
}

export default function BridgeCard({ bridge, bridgeSendStatus, bridgeSendResult, bridgeSendError }) {
  if (!bridge) return null;
  const { module: mod, payload, state, description } = bridge;
  const meta = BRIDGE_META[state] ?? BRIDGE_META.idle;

  return (
    <div style={s.card}>
      <div style={s.cardHeader}>
        <p style={s.cardTitle}>Bridge</p>
        <span
          style={{
            ...s.stateBadge,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
          }}
        >
          <span aria-hidden="true">{meta.icon}</span>
          {meta.label}
        </span>
      </div>

      <div style={s.rows}>
        <Row label="Módulo destino" value={mod} mono />
        <Row label="Payload" value={payload} mono />
      </div>

      {description && (
        <p style={s.desc}>{description}</p>
      )}

      {/* P12: feedback de envio real da bridge */}
      <BridgeSendStatus
        sendStatus={bridgeSendStatus}
        sendResult={bridgeSendResult}
        sendError={bridgeSendError}
      />

      {/* P13: estado pós-disparo — resultado imediato do executor */}
      <DispatchOutcome
        sendStatus={bridgeSendStatus}
        sendResult={bridgeSendResult}
      />
    </div>
  );
}

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
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
  desc: {
    marginTop: "10px",
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    paddingTop: "10px",
    borderTop: "1px solid var(--border)",
  },
  // P12 — send status block
  sendBlock: {
    marginTop: "12px",
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    padding: "8px 10px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid",
  },
  sendIcon: {
    fontSize: "14px",
    flexShrink: 0,
    fontWeight: 700,
    marginTop: "1px",
  },
  sendContent: {
    flex: 1,
    minWidth: 0,
  },
  sendText: {
    fontSize: "11px",
    fontWeight: 600,
    lineHeight: 1.4,
  },
  sendDetail: {
    fontSize: "10px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
    marginTop: "2px",
    fontFamily: "var(--font-mono)",
    wordBreak: "break-all",
  },
};
