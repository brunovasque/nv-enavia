import { useState, useEffect } from "react";
import { fetchPlan, PLAN_STATUS } from "../api";
import PlanHeader from "../plan/PlanHeader";
import ClassificationCard from "../plan/ClassificationCard";
import OutputModeCard from "../plan/OutputModeCard";
import PlanSteps from "../plan/PlanSteps";
import GateCard from "../plan/GateCard";
import BridgeCard from "../plan/BridgeCard";
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
  const [currentState, setCurrentState] = useState(PLAN_STATUS.READY);
  const [plan, setPlan] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchPlan({ _mockState: currentState }).then((r) => {
      setPlan(r.ok ? r.data.plan : null);
      setLoading(false);
    });
  }, [currentState]);

  if (loading) {
    return <div style={s.loading}>Carregando...</div>;
  }

  return (
    <div style={s.page}>
      {/* Header + state switcher */}
      <PlanHeader
        plan={plan}
        currentState={currentState}
        onStateChange={setCurrentState}
      />

      {/* Blocked banner */}
      {plan && <BlockedBanner gate={plan.gate} />}

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
            <GateCard gate={plan.gate} />
            <BridgeCard bridge={plan.bridge} />
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
