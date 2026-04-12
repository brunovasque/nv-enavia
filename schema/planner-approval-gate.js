// ============================================================================
// 📦 ENAVIA — Planner Approval Gate v1 (PM7 — Human Approval Gate)
//
// Gate humano canônico para planos gerados na PM6.
// Avalia o estado inicial do gate e suporta transições puras de estado.
//
// Responsabilidades:
//   - evaluateApprovalGate(plan) — avalia estado inicial do gate
//   - approvePlan(plan)          — transição pura para "approved"
//   - rejectPlan(plan, reason?)  — transição pura para "rejected"
//
// Saída canônica (GateDecision):
//   gate_status          — "approved_not_required" | "approval_required" | "approved" | "rejected"
//   needs_human_approval — boolean (espelha plan.needs_human_approval)
//   can_proceed          — boolean
//   reason               — string auditável
//   next_action          — string coerente com gate_status
//
// Regras base (avaliação inicial):
//   plan.needs_human_approval === false → gate_status = "approved_not_required", can_proceed = true
//   plan.needs_human_approval === true  → gate_status = "approval_required",     can_proceed = false
//
// Transições puras:
//   approvePlan(plan)          → gate_status = "approved",  can_proceed = true
//   rejectPlan(plan, reason?)  → gate_status = "rejected",  can_proceed = false
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - execução de ação (PM8+)
//   - bridge com executor (PM8)
//   - learning loop (PM9)
//   - painel / PROD / executor contratual
//   - persistência / I/O
//
// PM7 APENAS — não misturar com PM8+.
// ============================================================================

// ---------------------------------------------------------------------------
// GATE_STATUS — enum canônico dos estados possíveis do gate
// ---------------------------------------------------------------------------
const GATE_STATUS = {
  APPROVED_NOT_REQUIRED: "approved_not_required",
  APPROVAL_REQUIRED:     "approval_required",
  APPROVED:              "approved",
  REJECTED:              "rejected",
};

// ---------------------------------------------------------------------------
// _nextActionFor(gate_status)
//
// Retorna next_action coerente com o gate_status.
// Determinístico e auditável.
// ---------------------------------------------------------------------------
const _NEXT_ACTIONS = {
  [GATE_STATUS.APPROVED_NOT_REQUIRED]: "Prosseguir diretamente com a execução do plano.",
  [GATE_STATUS.APPROVAL_REQUIRED]:     "Aguardar aprovação humana formal — execução bloqueada até decisão explícita.",
  [GATE_STATUS.APPROVED]:              "Prosseguir com a execução do plano conforme aprovado.",
  [GATE_STATUS.REJECTED]:              "Plano rejeitado — revisar e gerar novo plano antes de prosseguir.",
};

// ---------------------------------------------------------------------------
// _validatePlan(plan, fnName)
//
// Valida que o plano é um objeto com needs_human_approval booleano.
// Lança Error com mensagem clara caso inválido.
// ---------------------------------------------------------------------------
function _validatePlan(plan, fnName) {
  if (!plan || typeof plan !== "object") {
    throw new Error(`${fnName}: 'plan' é obrigatório e deve ser um objeto`);
  }
  if (typeof plan.needs_human_approval !== "boolean") {
    throw new Error(
      `${fnName}: 'plan.needs_human_approval' é obrigatório e deve ser boolean`
    );
  }
}

// ---------------------------------------------------------------------------
// evaluateApprovalGate(plan)
//
// Avalia o estado inicial do gate com base no plano canônico da PM6.
//
// Parâmetros:
//   plan {object} — plano canônico (saída de buildCanonicalPlan, PM6):
//     needs_human_approval {boolean} — obrigatório
//     reason               {string}  — opcional, usado na saída
//
// Retorna GateDecision:
//   {
//     gate_status,
//     needs_human_approval,
//     can_proceed,
//     reason,
//     next_action,
//   }
//
// Regras:
//   needs_human_approval === false → gate_status = "approved_not_required", can_proceed = true
//   needs_human_approval === true  → gate_status = "approval_required",     can_proceed = false
//
// Lança:
//   Error — se plan ausente, não-objeto, ou needs_human_approval ausente/não-boolean
// ---------------------------------------------------------------------------
function evaluateApprovalGate(plan) {
  _validatePlan(plan, "evaluateApprovalGate");

  const needs_human_approval = plan.needs_human_approval;

  const gate_status = needs_human_approval
    ? GATE_STATUS.APPROVAL_REQUIRED
    : GATE_STATUS.APPROVED_NOT_REQUIRED;

  const can_proceed = !needs_human_approval;

  const plan_reason = typeof plan.reason === "string" && plan.reason.length > 0
    ? plan.reason
    : "";

  const reason = needs_human_approval
    ? `Plano requer aprovação humana antes de prosseguir${plan_reason ? ` — ${plan_reason}` : ""}.`
    : `Plano aprovado automaticamente — aprovação humana não requerida${plan_reason ? ` — ${plan_reason}` : ""}.`;

  return {
    gate_status,
    needs_human_approval,
    can_proceed,
    reason,
    next_action: _NEXT_ACTIONS[gate_status],
  };
}

// ---------------------------------------------------------------------------
// approvePlan(plan)
//
// Transição pura de estado: retorna GateDecision com gate_status = "approved".
// Não executa nada. Não chama executor. Não persiste.
//
// Parâmetros:
//   plan {object} — plano canônico (saída de buildCanonicalPlan, PM6)
//
// Retorna GateDecision:
//   {
//     gate_status:          "approved",
//     needs_human_approval: boolean,   // espelha plan.needs_human_approval
//     can_proceed:          true,
//     reason:               string,
//     next_action:          string,
//   }
//
// Lança:
//   Error — se plan inválido
// ---------------------------------------------------------------------------
function approvePlan(plan) {
  _validatePlan(plan, "approvePlan");

  const plan_reason = typeof plan.reason === "string" && plan.reason.length > 0
    ? plan.reason
    : "";

  return {
    gate_status:          GATE_STATUS.APPROVED,
    needs_human_approval: plan.needs_human_approval,
    can_proceed:          true,
    reason:               `Plano aprovado por decisão humana explícita${plan_reason ? ` — ${plan_reason}` : ""}.`,
    next_action:          _NEXT_ACTIONS[GATE_STATUS.APPROVED],
  };
}

// ---------------------------------------------------------------------------
// rejectPlan(plan, reason?)
//
// Transição pura de estado: retorna GateDecision com gate_status = "rejected".
// Não executa nada. Não chama executor. Não persiste.
//
// Parâmetros:
//   plan   {object} — plano canônico (saída de buildCanonicalPlan, PM6)
//   reason {string} — motivo da rejeição (opcional, curto)
//
// Retorna GateDecision:
//   {
//     gate_status:          "rejected",
//     needs_human_approval: boolean,   // espelha plan.needs_human_approval
//     can_proceed:          false,
//     reason:               string,
//     next_action:          string,
//   }
//
// Lança:
//   Error — se plan inválido
// ---------------------------------------------------------------------------
function rejectPlan(plan, reason) {
  _validatePlan(plan, "rejectPlan");

  const extra = typeof reason === "string" && reason.trim().length > 0
    ? reason.trim()
    : "";

  return {
    gate_status:          GATE_STATUS.REJECTED,
    needs_human_approval: plan.needs_human_approval,
    can_proceed:          false,
    reason:               extra
      ? `Plano rejeitado por decisão humana — ${extra}.`
      : "Plano rejeitado por decisão humana.",
    next_action:          _NEXT_ACTIONS[GATE_STATUS.REJECTED],
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  evaluateApprovalGate,
  approvePlan,
  rejectPlan,
  GATE_STATUS,
};
