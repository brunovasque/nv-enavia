import { useState, useEffect, useCallback } from "react";
import { fetchPlan, PLAN_STATUS, getApiConfig, mapPlannerSnapshot, sendBridge, fetchBridgeStatus, postDecision } from "../api";
import { usePlannerStore, setDemoOverride, clearDemoOverride } from "../store/plannerStore";
import PlanHeader from "../plan/PlanHeader";
import ClassificationCard from "../plan/ClassificationCard";
import OutputModeCard from "../plan/OutputModeCard";
import PlanSteps from "../plan/PlanSteps";
import GateCard from "../plan/GateCard";
import BridgeCard, { TRACKING_STATUS } from "../plan/BridgeCard";
import MemoryConsolidationCard from "../plan/MemoryConsolidationCard";

// ── Empty state — cara de produto, não de placeholder ─────────────────────
function EmptyState() {
  const SIGNALS = [
    { icon: "◎", label: "Classificação", desc: "Intent, domínio e prioridade inferidos pelo ciclo cognitivo" },
    { icon: "⬡", label: "Plano Canônico", desc: "Steps estruturados com dependências e estimativas de duração" },
    { icon: "⏳", label: "Gate Humano", desc: "Aprovação do responsável antes de acionar a execução" },
    { icon: "⇒", label: "Bridge", desc: "Handoff para o executor após liberação do gate" },
    { icon: "🧠", label: "Memória", desc: "Consolidação de contexto relevante para sessões futuras" },
  ];

  return (
    <div style={es.wrap}>
      <div style={es.center}>
        <div style={es.markWrap} aria-hidden="true">
          <span style={es.mark}>◆</span>
          <div style={es.markRing} />
        </div>
        <h2 style={es.heading}>Nenhum plano ativo</h2>
        <p style={es.sub}>
          Inicie uma instrução no Chat para que a Enavia gere um plano de execução estruturado.
        </p>

        <div style={es.signals}>
          {SIGNALS.map(({ icon, label, desc }) => (
            <div key={label} style={es.signal}>
              <span style={es.signalIcon} aria-hidden="true">{icon}</span>
              <div>
                <p style={es.signalLabel}>{label}</p>
                <p style={es.signalDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={es.hint}>
          <span style={es.hintDot} aria-hidden="true" />
          <span style={es.hintText}>Aguardando instrução do operador</span>
        </div>
      </div>
    </div>
  );
}

// ── Blocked banner ─────────────────────────────────────────────────────────
function BlockedBanner({ gate }) {
  if (!gate || gate.state !== "blocked") return null;
  return (
    <div style={bb.wrap} role="alert">
      <span style={bb.icon} aria-hidden="true">✕</span>
      <div>
        <p style={bb.title}>Plano bloqueado — gate não resolvido</p>
        {gate.reason && <p style={bb.reason}>{gate.reason}</p>}
      </div>
    </div>
  );
}

// ── PlanPage ───────────────────────────────────────────────────────────────
export default function PlanPage() {
  const { visibleState, demoOverride, lastChatText, plannerSnapshot } = usePlannerStore();
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // P11 — gate action: local override da decisão humana (sem bridge real)
  // null = nenhuma ação tomada; "approved" | "blocked" = ação do operador
  const [gateAction, setGateAction] = useState(null);

  // P12 — bridge send state: tracks the real bridge send lifecycle
  // "idle" | "sending" | "sent" | "error"
  const [bridgeSendStatus, setBridgeSendStatus] = useState("idle");
  const [bridgeSendResult, setBridgeSendResult] = useState(null);
  const [bridgeSendError, setBridgeSendError] = useState(null);

  // P14 — operational tracking state: post-dispatch status query
  const [trackingStatus, setTrackingStatus] = useState(TRACKING_STATUS.IDLE);
  const [trackingData, setTrackingData] = useState(null);
  const [trackingError, setTrackingError] = useState(null);

  const { mode } = getApiConfig();
  const isRealMode = mode === "real";

  useEffect(() => {
    // Reset gate action and bridge state when the plan changes (nova instrução = novo ciclo).
    // plannerSnapshot is a stable reference from useSyncExternalStore — it only
    // changes when onChatSuccess() is called (new chat round-trip), not on every
    // render. This dependency is intentional and safe.
    setGateAction(null);
    setBridgeSendStatus("idle");
    setBridgeSendResult(null);
    setBridgeSendError(null);
    // P14 — reset tracking state on new cycle
    setTrackingStatus(TRACKING_STATUS.IDLE);
    setTrackingData(null);
    setTrackingError(null);
  }, [visibleState, plannerSnapshot]);

  useEffect(() => {
    // ── Real mode: plan comes from plannerSnapshot in store (raw → mapper) ──
    if (isRealMode) {
      if (plannerSnapshot) {
        const mapped = mapPlannerSnapshot(plannerSnapshot);
        setPlan(mapped);
      } else {
        // No snapshot yet — show EmptyState. Never fall back to MOCK_PLANS.
        setPlan(null);
      }
      setFetchError(null);
      setLoading(false);
      return;
    }

    // ── Mock mode: fetch from MockTransport via fetchPlan() as before ────────
    let stale = false;

    setLoading(true);
    setFetchError(null);
    fetchPlan({ _mockState: visibleState }).then((r) => {
      if (stale) return;
      if (r.ok) {
        setPlan(r.data.plan);
      } else {
        setPlan(null);
        setFetchError(r.error?.message ?? "Erro ao carregar plano.");
      }
      setLoading(false);
    });

    return () => { stale = true; };
  }, [isRealMode, visibleState, plannerSnapshot]);

  // P11 → P12 — handlers de ação humana; gate approval triggers bridge send
  const handleBridgeSend = useCallback(async () => {
    // Extract executor_payload from the raw plannerSnapshot bridge
    const executorPayload = plannerSnapshot?.bridge?.executor_payload;
    if (!executorPayload) {
      setBridgeSendStatus("error");
      setBridgeSendError("Bridge payload ausente no plano — não é possível enviar.");
      return;
    }

    setBridgeSendStatus("sending");
    setBridgeSendError(null);

    const result = await sendBridge(executorPayload);
    if (result.ok) {
      setBridgeSendStatus("sent");
      setBridgeSendResult(result.data);
      // P14 — record approved decision after bridge dispatch with real bridge_id.
      // Fire-and-forget: does not block UX. bridge_id is guaranteed by sendBridge response.
      const bridgeId = result.data?.bridge_id;
      if (bridgeId && typeof bridgeId === "string") {
        postDecision({ decision: "approved", bridge_id: bridgeId }).catch(() => {/* non-blocking */});
      }
    } else {
      setBridgeSendStatus("error");
      setBridgeSendError(result.error?.message ?? "Falha ao enviar bridge payload.");
    }
  }, [plannerSnapshot]);

  // P14 — manual status query after bridge dispatch
  const handleRefreshTracking = useCallback(async () => {
    const bridgeId = bridgeSendResult?.bridge_id;
    if (!bridgeId) return;

    setTrackingStatus(TRACKING_STATUS.QUERYING);
    setTrackingError(null);

    const result = await fetchBridgeStatus(bridgeId);
    if (result.ok) {
      setTrackingStatus(TRACKING_STATUS.REACHABLE);
      setTrackingData(result.data);
    } else {
      setTrackingStatus(TRACKING_STATUS.ERROR);
      setTrackingError(result.error?.message ?? "Não foi possível consultar o status do executor. Tente novamente.");
    }
  }, [bridgeSendResult]);

  function handleGateApprove() {
    setGateAction("approved");
    // P12: trigger real bridge send after gate approval
    handleBridgeSend();
  }
  function handleGateReject() {
    setGateAction("blocked");
    // P14 — rejection: only record if bridge_id already exists (pós-bridge rejection).
    // Pre-bridge rejection has no bridge_id and MUST NOT be recorded as P14.
    const bridgeId = bridgeSendResult?.bridge_id;
    if (bridgeId && typeof bridgeId === "string") {
      postDecision({ decision: "rejected", bridge_id: bridgeId }).catch(() => {/* non-blocking */});
    }
  }

  // P11 — gate efetivo: sobrepõe state do gate com decisão local do operador
  function getEffectiveGate(gate) {
    if (!gate || !gateAction) return gate;
    return { ...gate, state: gateAction };
  }

  if (loading) {
    return <div style={s.loading}>Carregando...</div>;
  }

  if (fetchError) {
    return <div style={s.fetchError}>⚠ {fetchError}</div>;
  }

  const effectiveGate = getEffectiveGate(plan?.gate ?? null);

  return (
    <div style={s.page}>
      {/* Header + state switcher */}
      <PlanHeader
        plan={plan}
        currentState={visibleState}
        lastChatText={lastChatText}
        hasDemoOverride={demoOverride !== null}
        onDemoOverride={setDemoOverride}
        onClearDemoOverride={clearDemoOverride}
      />

      {/* Blocked banner — reage ao gate efetivo (inclui ação humana local) */}
      {plan && <BlockedBanner gate={effectiveGate} />}

      {/* Content */}
      {!plan ? (
        <EmptyState />
      ) : (
        <div style={s.body}>
          {/* Main column */}
          <div style={s.main}>
            <PlanSteps canonicalPlan={plan.canonicalPlan} />
          </div>

          {/* Sidebar column */}
          <div style={s.sidebar}>
            <ClassificationCard classification={plan.classification} />
            <OutputModeCard outputMode={plan.outputMode} />
            {/* P11: passa gate efetivo + callbacks de ação humana */}
            <GateCard
              gate={effectiveGate}
              onApprove={handleGateApprove}
              onReject={handleGateReject}
            />
            {/* P12: passa bridge + status de envio da ponte */}
            {/* P14: passa tracking props para acompanhamento operacional */}
            <BridgeCard
              bridge={plan.bridge}
              bridgeSendStatus={bridgeSendStatus}
              bridgeSendResult={bridgeSendResult}
              bridgeSendError={bridgeSendError}
              trackingStatus={trackingStatus}
              trackingData={trackingData}
              trackingError={trackingError}
              onRefreshTracking={handleRefreshTracking}
            />
            <MemoryConsolidationCard memoryConsolidation={plan.memoryConsolidation} />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
const s = {
  loading: {
    padding: "40px 24px",
    color: "var(--text-muted)",
    fontSize: "13px",
  },
  fetchError: {
    padding: "40px 24px",
    color: "#EF4444",
    fontSize: "13px",
  },
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    height: "100%",
    overflowY: "auto",
    padding: "4px 0 24px",
  },
  body: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    flex: 1,
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  sidebar: {
    width: "268px",
    minWidth: "268px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
  },
};

// Empty state styles
const es = {
  wrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "40px 24px",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "560px",
    width: "100%",
    textAlign: "center",
  },
  markWrap: {
    position: "relative",
    width: "64px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  mark: {
    fontSize: "32px",
    color: "var(--color-primary)",
    position: "relative",
    zIndex: 1,
    opacity: 0.5,
    textShadow: "0 0 24px rgba(0,180,216,0.3)",
  },
  markRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1px solid var(--color-primary-border)",
    background: "var(--color-primary-glow)",
  },
  heading: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "8px",
    letterSpacing: "0.2px",
  },
  sub: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.6,
    marginBottom: "32px",
    maxWidth: "400px",
  },
  signals: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginBottom: "28px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  signal: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "11px 16px",
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
  },
  signalIcon: {
    fontSize: "18px",
    color: "var(--color-primary)",
    opacity: 0.5,
    width: "24px",
    textAlign: "center",
    flexShrink: 0,
  },
  signalLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "1px",
  },
  signalDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  hint: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  hintDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--text-muted)",
    flexShrink: 0,
    opacity: 0.5,
  },
  hintText: {
    fontSize: "11px",
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
  },
};

// Blocked banner styles
const bb = {
  wrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "10px 16px",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.25)",
    borderRadius: "var(--radius-md)",
    flexShrink: 0,
  },
  icon: {
    fontSize: "14px",
    color: "#EF4444",
    marginTop: "1px",
    flexShrink: 0,
  },
  title: {
    fontSize: "13px",
    fontWeight: 600,
    color: "#EF4444",
    marginBottom: "2px",
  },
  reason: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
};
