// ============================================================================
// 📦 ENAVIA — Planner Executor Bridge v1 (PM8 — Bridge Planner ↔ Executor)
//
// Ponte canônica que decide se um plano aprovado pode virar payload executável
// para o executor, sem executar de fato.
//
// Responsabilidades:
//   - buildExecutorBridgePayload({ plan, gate }) — única função pública
//
// Entradas:
//   plan  — saída canônica de buildCanonicalPlan (PM6)
//   gate  — saída canônica de evaluateApprovalGate / approvePlan / rejectPlan (PM7)
//
// Saída quando gate permite (can_proceed === true):
//   bridge_status:    "ready_for_executor"
//   can_execute:      true
//   executor_action:  "execute_plan"
//   executor_payload: { version, source, plan_summary, complexity_level,
//                       plan_type, steps, risks, acceptance_criteria }
//   reason:           string auditável
//   next_action:      string coerente
//
// Saída quando gate bloqueia (can_proceed !== true):
//   bridge_status:    "blocked_by_gate"
//   can_execute:      false
//   executor_action:  null
//   executor_payload: null
//   reason:           string auditável e explícita
//   next_action:      string coerente com o motivo do bloqueio
//
// Regras de decisão:
//   gate.gate_status === "approved_not_required" → ready_for_executor
//   gate.gate_status === "approved"              → ready_for_executor
//   gate.gate_status === "approval_required"     → blocked_by_gate (aguardar aprovação humana)
//   gate.gate_status === "rejected"              → blocked_by_gate (plano rejeitado, revisar)
//   Regra primária: gate.can_proceed !== true    → bloqueia
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - execução de ação real
//   - chamada ao executor contratual
//   - fetch / endpoint / deploy
//   - KV / D1 / R2 / persistência de qualquer tipo
//   - painel / PROD
//   - learning loop (PM9)
//   - auditoria final (PM10)
//
// PM8 APENAS — não misturar com PM9+.
// ============================================================================

// ---------------------------------------------------------------------------
// Constantes públicas
// ---------------------------------------------------------------------------
const BRIDGE_VERSION = "1.0";
const BRIDGE_SOURCE  = "planner_bridge";

const BRIDGE_STATUS = {
  READY:   "ready_for_executor",
  BLOCKED: "blocked_by_gate",
};

const EXECUTOR_ACTION = {
  EXECUTE_PLAN: "execute_plan",
};

// ---------------------------------------------------------------------------
// _validateInputs(plan, gate, fnName)
//
// Valida que plan e gate são objetos com os campos mínimos requeridos.
// Lança Error descritivo caso inválido.
// ---------------------------------------------------------------------------
function _validateInputs(plan, gate, fnName) {
  if (!plan || typeof plan !== "object") {
    throw new Error(`${fnName}: 'plan' é obrigatório e deve ser um objeto`);
  }
  if (typeof plan.complexity_level !== "string" || !plan.complexity_level) {
    throw new Error(`${fnName}: 'plan.complexity_level' é obrigatório e deve ser string`);
  }
  if (typeof plan.plan_type !== "string" || !plan.plan_type) {
    throw new Error(`${fnName}: 'plan.plan_type' é obrigatório e deve ser string`);
  }
  if (!Array.isArray(plan.steps)) {
    throw new Error(`${fnName}: 'plan.steps' é obrigatório e deve ser array`);
  }
  if (!Array.isArray(plan.risks)) {
    throw new Error(`${fnName}: 'plan.risks' é obrigatório e deve ser array`);
  }
  if (!Array.isArray(plan.acceptance_criteria)) {
    throw new Error(`${fnName}: 'plan.acceptance_criteria' é obrigatório e deve ser array`);
  }
  if (!gate || typeof gate !== "object") {
    throw new Error(`${fnName}: 'gate' é obrigatório e deve ser um objeto`);
  }
  if (typeof gate.gate_status !== "string" || !gate.gate_status) {
    throw new Error(`${fnName}: 'gate.gate_status' é obrigatório e deve ser string`);
  }
  if (typeof gate.can_proceed !== "boolean") {
    throw new Error(`${fnName}: 'gate.can_proceed' é obrigatório e deve ser boolean`);
  }
}

// ---------------------------------------------------------------------------
// _buildExecutorPayload(plan)
//
// Monta o executor_payload canônico e serializável a partir do plano PM6.
// Apenas campos do contrato — sem inventar campos.
// ---------------------------------------------------------------------------
function _buildExecutorPayload(plan) {
  return {
    version:             BRIDGE_VERSION,
    source:              BRIDGE_SOURCE,
    plan_summary:        typeof plan.objective === "string" && plan.objective.length > 0
      ? plan.objective
      : "",
    complexity_level:    plan.complexity_level,
    plan_type:           plan.plan_type,
    steps:               plan.steps,
    risks:               plan.risks,
    acceptance_criteria: plan.acceptance_criteria,
  };
}

// ---------------------------------------------------------------------------
// _reasonForBlock(gate)
//
// Retorna reason explícita e curta para cada cenário de bloqueio.
// Derivada diretamente de gate.gate_status e gate.reason.
// ---------------------------------------------------------------------------
function _reasonForBlock(gate) {
  const gateReason = typeof gate.reason === "string" && gate.reason.length > 0
    ? ` — ${gate.reason}`
    : "";

  switch (gate.gate_status) {
    case "approval_required":
      return `Execução bloqueada: plano aguardando aprovação humana formal${gateReason}.`;
    case "rejected":
      return `Execução bloqueada: plano rejeitado pelo gate — revisar e gerar novo plano antes de prosseguir${gateReason}.`;
    default:
      return `Execução bloqueada pelo gate (${gate.gate_status})${gateReason}.`;
  }
}

// ---------------------------------------------------------------------------
// _nextActionForBlock(gate)
//
// Retorna next_action coerente com o motivo do bloqueio.
// ---------------------------------------------------------------------------
function _nextActionForBlock(gate) {
  switch (gate.gate_status) {
    case "approval_required":
      return "Aguardar aprovação humana formal — execução suspensa até decisão explícita.";
    case "rejected":
      return "Revisar o plano e gerar nova versão antes de solicitar execução.";
    default:
      return "Verificar o estado do gate e resolver o bloqueio antes de prosseguir.";
  }
}

// ---------------------------------------------------------------------------
// buildExecutorBridgePayload({ plan, gate })
//
// Função pública e determinística da PM8.
// Decide se um plano aprovado pode virar payload executável, sem executar.
//
// Parâmetros:
//   plan {object} — saída canônica de buildCanonicalPlan (PM6):
//     complexity_level    {string}   — "A" | "B" | "C"
//     plan_type           {string}   — "quick_reply" | "tactical_plan" | "formal_contract"
//     objective           {string}   — objetivo do plano (opcional, mas esperado)
//     steps               {string[]} — etapas do plano
//     risks               {string[]} — riscos identificados
//     acceptance_criteria {string[]} — critérios de aceite
//
//   gate {object} — saída canônica de evaluateApprovalGate / approvePlan / rejectPlan (PM7):
//     gate_status  {string}  — "approved_not_required" | "approval_required" | "approved" | "rejected"
//     can_proceed  {boolean} — true = autorizado, false = bloqueado
//     reason       {string}  — razão auditável do gate
//
// Retorna BridgeResult:
//   {
//     bridge_status,    — "ready_for_executor" | "blocked_by_gate"
//     can_execute,      — boolean
//     executor_action,  — "execute_plan" | null
//     executor_payload, — object | null
//     reason,           — string auditável
//     next_action,      — string coerente com o estado
//   }
//
// Lança:
//   Error — se plan ou gate ausentes / inválidos
// ---------------------------------------------------------------------------
function buildExecutorBridgePayload({ plan, gate } = {}) {
  _validateInputs(plan, gate, "buildExecutorBridgePayload");

  // Regra primária: gate.can_proceed !== true → bloqueia
  if (gate.can_proceed !== true) {
    return {
      bridge_status:    BRIDGE_STATUS.BLOCKED,
      can_execute:      false,
      executor_action:  null,
      executor_payload: null,
      reason:           _reasonForBlock(gate),
      next_action:      _nextActionForBlock(gate),
    };
  }

  // Gate autoriza → monta payload canônico
  const gateReason = typeof gate.reason === "string" && gate.reason.length > 0
    ? ` — ${gate.reason}`
    : "";

  return {
    bridge_status:    BRIDGE_STATUS.READY,
    can_execute:      true,
    executor_action:  EXECUTOR_ACTION.EXECUTE_PLAN,
    executor_payload: _buildExecutorPayload(plan),
    reason:           `Gate autoriza execução${gateReason}.`,
    next_action:      "Payload canônico pronto — encaminhar ao executor quando acionado.",
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  buildExecutorBridgePayload,
  BRIDGE_STATUS,
  BRIDGE_VERSION,
  BRIDGE_SOURCE,
  EXECUTOR_ACTION,
};
