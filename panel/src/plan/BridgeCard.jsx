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

// ── P14 — Operational Tracking ────────────────────────────────────────────
// After dispatch is accepted (P13), the operator can manually query the executor
// for ongoing operational status. This is NOT automatic refresh — it uses the
// existing /engineer → { action: "status" } path, which is a documented and
// proven route in the operational contract.
//
// Scope: P14 only — post-dispatch operational tracking. No engine, no auto-cycle,
// no P15+ features. One-shot manual query by the operator.

export const TRACKING_STATUS = {
  IDLE:        "tracking_idle",
  QUERYING:    "tracking_querying",
  REACHABLE:   "tracking_reachable",
  UNREACHABLE: "tracking_unreachable",
  ERROR:       "tracking_error",
};

const TRACKING_META = {
  [TRACKING_STATUS.IDLE]: {
    label: "Acompanhamento disponível",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    icon: "◎",
  },
  [TRACKING_STATUS.QUERYING]: {
    label: "Consultando executor…",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.06)",
    border: "rgba(245,158,11,0.2)",
    icon: "⟳",
  },
  [TRACKING_STATUS.REACHABLE]: {
    label: "Executor operacional",
    color: "#10B981",
    bg: "rgba(16,185,129,0.06)",
    border: "rgba(16,185,129,0.2)",
    icon: "●",
  },
  [TRACKING_STATUS.UNREACHABLE]: {
    label: "Executor indisponível",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.06)",
    border: "rgba(239,68,68,0.2)",
    icon: "○",
  },
  [TRACKING_STATUS.ERROR]: {
    label: "Falha na consulta",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.06)",
    border: "rgba(239,68,68,0.2)",
    icon: "✕",
  },
};

/**
 * Derive a tracking status from the fetchBridgeStatus response.
 * Pure function — no side effects, no network calls.
 *
 * @param {object|null|undefined} statusResponse — data from fetchBridgeStatus result
 * @returns {{ status: string, detail: string|null, queriedAt: string|null }}
 */
export function deriveTrackingStatus(statusResponse) {
  if (!statusResponse || typeof statusResponse !== "object") {
    return { status: TRACKING_STATUS.IDLE, detail: null, queriedAt: null };
  }

  const queriedAt = typeof statusResponse.queried_at === "string"
    ? statusResponse.queried_at
    : null;

  if (!statusResponse.executor_reachable) {
    return { status: TRACKING_STATUS.UNREACHABLE, detail: null, queriedAt };
  }

  const execStatus = statusResponse.executor_status;
  if (!execStatus || typeof execStatus !== "object") {
    return { status: TRACKING_STATUS.REACHABLE, detail: null, queriedAt };
  }

  // Extract meaningful detail from executor response
  const detail = typeof execStatus.status === "string"
    ? execStatus.status
    : (typeof execStatus.execution_status === "string"
      ? execStatus.execution_status
      : null);

  return { status: TRACKING_STATUS.REACHABLE, detail, queriedAt };
}

function OperationalTracking({
  dispatchStatus,
  trackingStatus,
  trackingData,
  trackingError,
  onRefresh,
}) {
  // Only render after dispatch is accepted (P13 → P14 boundary)
  if (dispatchStatus !== DISPATCH_STATUS.ACCEPTED) return null;

  const isQuerying = trackingStatus === TRACKING_STATUS.QUERYING;
  const hasQueried = trackingData != null;
  const derived = hasQueried ? deriveTrackingStatus(trackingData) : null;
  const activeMeta = isQuerying
    ? TRACKING_META[TRACKING_STATUS.QUERYING]
    : (trackingError
      ? TRACKING_META[TRACKING_STATUS.ERROR]
      : (derived
        ? (TRACKING_META[derived.status] || TRACKING_META[TRACKING_STATUS.IDLE])
        : TRACKING_META[TRACKING_STATUS.IDLE]));

  return (
    <div
      style={{
        ...s.sendBlock,
        background: activeMeta.bg,
        borderColor: activeMeta.border,
        marginTop: "6px",
        flexDirection: "column",
        gap: "6px",
      }}
      role="region"
      aria-label="Acompanhamento operacional pós-disparo"
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
        <span style={{ ...s.sendIcon, color: activeMeta.color }} aria-hidden="true">
          {activeMeta.icon}
        </span>
        <div style={{ ...s.sendContent, flex: 1 }}>
          <p style={{ ...s.sendText, color: activeMeta.color }}>
            {activeMeta.label}
          </p>
          {derived?.detail && (
            <p style={s.sendDetail}>Status: {derived.detail}</p>
          )}
          {derived?.queriedAt && !isNaN(new Date(derived.queriedAt).getTime()) && (
            <p style={s.sendDetail}>
              Consultado: {new Date(derived.queriedAt).toLocaleTimeString("pt-BR")}
            </p>
          )}
          {trackingError && (
            <p style={s.sendDetail}>{trackingError}</p>
          )}
        </div>
      </div>
      {typeof onRefresh === "function" && (
        <button
          style={s.refreshBtn}
          onClick={onRefresh}
          disabled={isQuerying}
          aria-label="Consultar status do executor"
        >
          {isQuerying ? "Consultando…" : "⟳ Consultar status"}
        </button>
      )}
    </div>
  );
}

export default function BridgeCard({
  bridge,
  bridgeSendStatus,
  bridgeSendResult,
  bridgeSendError,
  // P14 — operational tracking props
  trackingStatus,
  trackingData,
  trackingError,
  onRefreshTracking,
}) {
  if (!bridge) return null;
  const { module: mod, payload, state, description } = bridge;
  const meta = BRIDGE_META[state] ?? BRIDGE_META.idle;

  // P14 — derive dispatch status to gate OperationalTracking visibility
  const dispatchOutcome = bridgeSendStatus === "sent" && bridgeSendResult
    ? deriveDispatchOutcome(bridgeSendResult.executor_response)
    : null;

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

      {/* P14: acompanhamento operacional pós-disparo — consulta manual */}
      <OperationalTracking
        dispatchStatus={dispatchOutcome?.status ?? null}
        trackingStatus={trackingStatus}
        trackingData={trackingData}
        trackingError={trackingError}
        onRefresh={onRefreshTracking}
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
  // P14 — manual refresh button
  refreshBtn: {
    width: "100%",
    padding: "5px 8px",
    fontSize: "11px",
    fontWeight: 600,
    fontFamily: "var(--font-body)",
    color: "var(--text-secondary)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    cursor: "pointer",
    letterSpacing: "0.2px",
    transition: "opacity 0.15s ease",
  },
};
