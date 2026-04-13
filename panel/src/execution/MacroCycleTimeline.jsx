// ============================================================================
// MacroCycleTimeline — P19 — Fase 5 Observabilidade
// Timeline operacional macro do ciclo: pedido → classificação → plano → gate → execução
// NÃO duplica: Replay, CurrentStep, OperationalLive, ExecutionTimeline (micro-eventos)
// ============================================================================

import { EXECUTION_STATUS, EVENT_TYPE } from "./mockExecution";

// ── Phase definitions ─────────────────────────────────────────────────────────

const PHASES = [
  { id: "pedido",        label: "Pedido",        icon: "◆" },
  { id: "classificacao", label: "Classificação",  icon: "⊞" },
  { id: "plano",         label: "Plano",          icon: "◎" },
  { id: "gate",          label: "Gate",           icon: "⏳" },
  { id: "execucao",      label: "Execução",       icon: "▷" },
];

// ── Phase status constants ────────────────────────────────────────────────────

const PHASE_STATUS = {
  DONE:    "done",
  ACTIVE:  "active",
  PENDING: "pending",
  BLOCKED: "blocked",
  FAILED:  "failed",
};

// ── Status display metadata ───────────────────────────────────────────────────

const STATUS_META = {
  [PHASE_STATUS.DONE]: {
    label: "concluída",
    color: "#10B981",
    bg: "rgba(16,185,129,0.10)",
    border: "rgba(16,185,129,0.28)",
    dotColor: "#10B981",
  },
  [PHASE_STATUS.ACTIVE]: {
    label: "em curso",
    color: "var(--color-primary)",
    bg: "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
    dotColor: "var(--color-primary)",
  },
  [PHASE_STATUS.PENDING]: {
    label: "pendente",
    color: "var(--text-muted)",
    bg: "transparent",
    border: "var(--border)",
    dotColor: "var(--text-muted)",
  },
  [PHASE_STATUS.BLOCKED]: {
    label: "bloqueado",
    color: "#F59E0B",
    bg: "rgba(245,158,11,0.10)",
    border: "rgba(245,158,11,0.30)",
    dotColor: "#F59E0B",
  },
  [PHASE_STATUS.FAILED]: {
    label: "falhou",
    color: "#EF4444",
    bg: "rgba(239,68,68,0.10)",
    border: "rgba(239,68,68,0.28)",
    dotColor: "#EF4444",
  },
};

// ── Phase derivation from execution data ──────────────────────────────────────

function hasEventType(events, type) {
  return events?.some((e) => e.type === type) ?? false;
}

function deriveMacroPhases(execution, currentState) {
  if (currentState === EXECUTION_STATUS.IDLE || !execution) {
    return {
      pedido:        PHASE_STATUS.PENDING,
      classificacao: PHASE_STATUS.PENDING,
      plano:         PHASE_STATUS.PENDING,
      gate:          PHASE_STATUS.PENDING,
      execucao:      PHASE_STATUS.PENDING,
    };
  }

  const events = execution.events ?? [];

  // Pedido: received as soon as an execution exists
  const pedido = PHASE_STATUS.DONE;

  // Classificação: inferred from planId presence (plan assigned = classified)
  const classificacao = execution.planId ? PHASE_STATUS.DONE : PHASE_STATUS.ACTIVE;

  // Plano: plan was loaded into the executor
  const planLoaded = hasEventType(events, EVENT_TYPE.PLAN_LOADED);
  const plano = planLoaded
    ? PHASE_STATUS.DONE
    : classificacao === PHASE_STATUS.DONE
      ? PHASE_STATUS.ACTIVE
      : PHASE_STATUS.PENDING;

  // Gate: check for approval, block or pending
  const gateApproved = hasEventType(events, EVENT_TYPE.GATE_APPROVED);
  const gateBlocked  = hasEventType(events, EVENT_TYPE.GATE_BLOCKED);
  const gateRequested = hasEventType(events, EVENT_TYPE.GATE_REQUESTED);
  let gate = PHASE_STATUS.PENDING;
  if (currentState === EXECUTION_STATUS.BLOCKED || gateBlocked) {
    gate = PHASE_STATUS.BLOCKED;
  } else if (gateApproved) {
    gate = PHASE_STATUS.DONE;
  } else if (plano === PHASE_STATUS.DONE) {
    gate = PHASE_STATUS.ACTIVE;
  }

  // Execução: depends on overall status
  let execucao = PHASE_STATUS.PENDING;
  if (currentState === EXECUTION_STATUS.COMPLETED) {
    execucao = PHASE_STATUS.DONE;
  } else if (currentState === EXECUTION_STATUS.FAILED) {
    execucao = PHASE_STATUS.FAILED;
  } else if (gate === PHASE_STATUS.DONE) {
    execucao = PHASE_STATUS.ACTIVE;
  }

  return { pedido, classificacao, plano, gate, execucao };
}

// ── PhaseNode component ───────────────────────────────────────────────────────

function PhaseNode({ phase, status, isLast }) {
  const meta = STATUS_META[status];
  const isDone    = status === PHASE_STATUS.DONE;
  const isActive  = status === PHASE_STATUS.ACTIVE;
  const isPending = status === PHASE_STATUS.PENDING;

  return (
    <div style={s.phaseWrapper} aria-label={`${phase.label}: ${meta.label}`}>
      {/* Node */}
      <div style={s.phaseNode}>
        {/* Icon circle */}
        <div
          style={{
            ...s.iconCircle,
            background: meta.bg,
            borderColor: meta.border,
            opacity: isPending ? 0.5 : 1,
          }}
        >
          <span
            style={{
              ...s.icon,
              color: meta.color,
            }}
            aria-hidden="true"
          >
            {isDone ? "✓" : phase.icon}
          </span>
          {isActive && (
            <span className="exec-dot-pulse" style={s.activePulse} aria-hidden="true" />
          )}
        </div>

        {/* Phase label */}
        <span
          style={{
            ...s.phaseLabel,
            color: isPending ? "var(--text-muted)" : "var(--text-primary)",
            opacity: isPending ? 0.55 : 1,
            fontWeight: isActive ? 700 : isDone ? 600 : 500,
          }}
        >
          {phase.label}
        </span>

        {/* Status chip */}
        <span
          style={{
            ...s.statusChip,
            color: meta.color,
            background: meta.bg,
            borderColor: meta.border,
            opacity: isPending ? 0.6 : 1,
          }}
        >
          {meta.label}
        </span>
      </div>

      {/* Connector arrow */}
      {!isLast && (
        <div
          style={{
            ...s.connector,
            opacity: isPending ? 0.25 : isDone ? 0.7 : 0.45,
          }}
          aria-hidden="true"
        >
          <span style={s.arrow}>›</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MacroCycleTimeline({ execution, currentState }) {
  const phases = deriveMacroPhases(execution, currentState);

  const isIdle = currentState === EXECUTION_STATUS.IDLE || !execution;

  return (
    <div style={s.card} role="region" aria-label="Timeline operacional do ciclo">
      <span style={s.cardTitle}>Ciclo operacional</span>

      {isIdle ? (
        <p style={s.idleText}>Nenhuma execução ativa — ciclo aguardando início.</p>
      ) : (
        <div style={s.phaseRow}>
          {PHASES.map((phase, idx) => (
            <PhaseNode
              key={phase.id}
              phase={phase}
              status={phases[phase.id]}
              isLast={idx === PHASES.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "12px 20px",
    display: "flex",
    alignItems: "center",
    gap: "16px",
    flexShrink: 0,
    flexWrap: "wrap",
  },

  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    whiteSpace: "nowrap",
    flexShrink: 0,
  },

  idleText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },

  // Phases row
  phaseRow: {
    display: "flex",
    alignItems: "center",
    gap: "0",
    flex: 1,
    flexWrap: "wrap",
    minWidth: 0,
  },

  phaseWrapper: {
    display: "flex",
    alignItems: "center",
    gap: "0",
  },

  phaseNode: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "4px 8px",
    minWidth: "72px",
  },

  iconCircle: {
    position: "relative",
    width: "30px",
    height: "30px",
    borderRadius: "50%",
    border: "1px solid",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    transition: "background 0.2s ease, border-color 0.2s ease",
  },

  icon: {
    fontSize: "13px",
    fontWeight: 700,
    lineHeight: 1,
  },

  activePulse: {
    position: "absolute",
    inset: "-4px",
    borderRadius: "50%",
    border: "1px solid var(--color-primary-border)",
    background: "transparent",
    pointerEvents: "none",
  },

  phaseLabel: {
    fontSize: "11px",
    letterSpacing: "0.2px",
    lineHeight: 1,
    textAlign: "center",
    whiteSpace: "nowrap",
  },

  statusChip: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    padding: "2px 6px",
    borderRadius: "3px",
    border: "1px solid",
    textTransform: "lowercase",
    whiteSpace: "nowrap",
  },

  // Arrow connector between phases
  connector: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    width: "20px",
    flexShrink: 0,
  },
  arrow: {
    fontSize: "18px",
    color: "var(--border)",
    fontWeight: 300,
    lineHeight: 1,
    marginTop: "-12px",
  },
};
