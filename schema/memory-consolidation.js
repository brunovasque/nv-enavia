// ============================================================================
// 📦 ENAVIA — Memory Consolidation v1 (PM9 — Consolidação de Memória / Aprendizado)
//
// Camada que decide o que do ciclo planner → gate → bridge deve virar memória
// útil/canônica, sem inventar aprendizado solto.
//
// Responsabilidades:
//   - consolidateMemoryLearning({ plan, gate, bridge })
//
// Entradas:
//   plan   — saída canônica de buildCanonicalPlan (PM6)
//   gate   — saída canônica de evaluateApprovalGate / approvePlan / rejectPlan (PM7)
//   bridge — saída canônica de buildExecutorBridgePayload (PM8)
//
// Saída (ConsolidationResult):
//   should_consolidate  — boolean
//   memory_candidates[] — candidatos prontos para persistência via PM2 (writeMemory)
//   reason              — string auditável explicando a decisão
//   next_action         — string coerente com o resultado
//
// Cada item de memory_candidates[] é compatível com PM1/PM2, contendo:
//   memory_type, title, content_structured, priority, confidence,
//   is_canonical, status
//
// Separação canônica:
//   MEMÓRIA CANÔNICA     — memory_type: "canonical_rules", is_canonical: true,
//                          status: "canonical" — apenas quando gate aprovado/auto-aprovado,
//                          bridge ready, nível B ou C e acceptance_criteria definidos
//   MEMÓRIA OPERACIONAL  — memory_type: "operational_history", is_canonical: false,
//                          status: "active" — para todo ciclo aprovado (histórico)
//   MEMÓRIA DESCARTÁVEL  — nenhum candidato gerado (should_consolidate: false)
//
// Regras base:
//   gate_status "rejected"          → não consolida nada (rejeição não vira canônica)
//   gate_status "approval_required" → não consolida (estado transitório)
//   gate_status "approved" ou
//     "approved_not_required"       → consolida memória operacional sempre;
//                                     consolida canônica só se nível B/C + bridge
//                                     ready_for_executor + acceptance_criteria presente
//
// NÃO contém:
//   - persistência / KV / D1 / R2 / I/O de qualquer tipo
//   - chamada ao executor contratual
//   - fetch / endpoint / deploy
//   - LLM / embeddings / heurística opaca
//   - autoedição de memória existente
//   - painel / PROD
//   - auditoria final (PM10)
//
// PM9 APENAS — não misturar com PM10.
// ============================================================================

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
} from "./memory-schema.js";

// ---------------------------------------------------------------------------
// CONSOLIDATION_VERSION — versão canônica da PM9
// ---------------------------------------------------------------------------
const CONSOLIDATION_VERSION = "1.0";

// ---------------------------------------------------------------------------
// Gate statuses that allow consolidation (approved in any form)
// ---------------------------------------------------------------------------
const _CONSOLIDABLE_GATE_STATUSES = new Set([
  "approved_not_required",
  "approved",
]);

// ---------------------------------------------------------------------------
// _validateInputs(plan, gate, bridge, fnName)
//
// Valida que plan, gate e bridge são objetos com os campos mínimos requeridos.
// Lança Error descritivo caso inválido.
// ---------------------------------------------------------------------------
function _validateInputs({ plan, gate, bridge }, fnName) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error(`${fnName}: 'plan' é obrigatório e deve ser um objeto`);
  }
  if (typeof plan.complexity_level !== "string" || !plan.complexity_level.trim()) {
    throw new Error(`${fnName}: 'plan.complexity_level' é obrigatório e deve ser string`);
  }

  if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
    throw new Error(`${fnName}: 'gate' é obrigatório e deve ser um objeto`);
  }
  if (typeof gate.gate_status !== "string" || !gate.gate_status.trim()) {
    throw new Error(`${fnName}: 'gate.gate_status' é obrigatório e deve ser string`);
  }

  if (!bridge || typeof bridge !== "object" || Array.isArray(bridge)) {
    throw new Error(`${fnName}: 'bridge' é obrigatório e deve ser um objeto`);
  }
  if (typeof bridge.bridge_status !== "string" || !bridge.bridge_status.trim()) {
    throw new Error(`${fnName}: 'bridge.bridge_status' é obrigatório e deve ser string`);
  }
}

// ---------------------------------------------------------------------------
// _qualifiesForCanonical(plan, gate, bridge)
//
// Retorna true somente se o ciclo qualifica um candidato canônico.
//
// Critérios:
//   1. gate_status deve ser "approved" ou "approved_not_required"
//   2. bridge_status deve ser "ready_for_executor"
//   3. complexity_level deve ser "B" ou "C" (planos triviais nível A não qualificam)
//   4. plan.acceptance_criteria deve ser array não-vazio
//
// Razão: memória canônica deve ser rara e justificável.
// Decisão pontual (nível A) ou ciclo bloqueado não geram canônica.
// ---------------------------------------------------------------------------
function _qualifiesForCanonical(plan, gate, bridge) {
  if (!_CONSOLIDABLE_GATE_STATUSES.has(gate.gate_status)) return false;
  if (bridge.bridge_status !== "ready_for_executor") return false;

  const level = plan.complexity_level.toUpperCase();
  if (level !== "B" && level !== "C") return false;

  if (!Array.isArray(plan.acceptance_criteria) || plan.acceptance_criteria.length === 0) {
    return false;
  }

  return true;
}

// ---------------------------------------------------------------------------
// _buildOperationalCandidate(plan, gate, bridge)
//
// Cria candidato de memória operacional para rastrear o ciclo completo.
// Sempre gerado quando gate aprova — é o histórico mínimo do ciclo.
//
// memory_type: operational_history
// is_canonical: false
// status: active
// ---------------------------------------------------------------------------
function _buildOperationalCandidate(plan, gate, bridge) {
  const objective = typeof plan.objective === "string" ? plan.objective : "";

  return {
    memory_type:        MEMORY_TYPES.OPERATIONAL_HISTORY,
    title:              `Ciclo planner concluído — nível ${plan.complexity_level} — gate: ${gate.gate_status}`,
    content_structured: {
      plan_type:        typeof plan.plan_type === "string" ? plan.plan_type : "",
      complexity_level: plan.complexity_level,
      gate_status:      gate.gate_status,
      bridge_status:    bridge.bridge_status,
      can_execute:      bridge.can_execute === true,
      objective:        objective,
      consolidation_version: CONSOLIDATION_VERSION,
    },
    priority:    MEMORY_PRIORITY.LOW,
    confidence:  MEMORY_CONFIDENCE.HIGH,
    is_canonical: false,
    status:       MEMORY_STATUS.ACTIVE,
  };
}

// ---------------------------------------------------------------------------
// _buildCanonicalCandidate(plan, gate)
//
// Cria candidato de memória canônica a partir dos critérios de aceite do plano.
// Gerado apenas quando _qualifiesForCanonical() retorna true.
//
// memory_type: canonical_rules
// is_canonical: true
// status: canonical
// ---------------------------------------------------------------------------
function _buildCanonicalCandidate(plan, gate) {
  const objective = typeof plan.objective === "string" ? plan.objective : "";
  const shortObjective = objective.length <= 60 ? objective : objective.slice(0, 57) + "...";

  return {
    memory_type:        MEMORY_TYPES.CANONICAL_RULES,
    title:              `Critérios canônicos — nível ${plan.complexity_level} — ${shortObjective}`,
    content_structured: {
      acceptance_criteria: plan.acceptance_criteria,
      plan_type:           typeof plan.plan_type === "string" ? plan.plan_type : "",
      complexity_level:    plan.complexity_level,
      gate_status:         gate.gate_status,
      objective:           objective,
      consolidation_version: CONSOLIDATION_VERSION,
    },
    priority:    MEMORY_PRIORITY.HIGH,
    confidence:  MEMORY_CONFIDENCE.CONFIRMED,
    is_canonical: true,
    status:       MEMORY_STATUS.CANONICAL,
  };
}

// ---------------------------------------------------------------------------
// consolidateMemoryLearning({ plan, gate, bridge })
//
// Função pública e determinística da PM9.
// Decide o que do ciclo planner → gate → bridge merece ser consolidado
// como memória, sem executar, persistir ou chamar qualquer sistema externo.
//
// Parâmetros:
//   plan   {object} — saída canônica de buildCanonicalPlan (PM6):
//     complexity_level     {string}   — "A" | "B" | "C"          (obrigatório)
//     plan_type            {string}   — "quick_reply" | "tactical_plan" | "formal_contract"
//     objective            {string}   — objetivo do plano
//     acceptance_criteria  {string[]} — critérios de aceite
//
//   gate   {object} — saída canônica de evaluateApprovalGate / approvePlan / rejectPlan (PM7):
//     gate_status  {string}  — "approved_not_required" | "approval_required" | "approved" | "rejected"
//     can_proceed  {boolean} — true = autorizado
//     reason       {string}  — razão auditável do gate
//
//   bridge {object} — saída canônica de buildExecutorBridgePayload (PM8):
//     bridge_status   {string}  — "ready_for_executor" | "blocked_by_gate"
//     can_execute     {boolean} — true = pode executar
//
// Retorna ConsolidationResult:
//   {
//     should_consolidate,  — boolean
//     memory_candidates,   — array de candidatos (vazio se não consolida)
//     reason,              — string auditável
//     next_action,         — string coerente
//   }
//
// Lança:
//   Error — se plan, gate ou bridge ausentes / inválidos
// ---------------------------------------------------------------------------
function consolidateMemoryLearning({ plan, gate, bridge } = {}) {
  _validateInputs({ plan, gate, bridge }, "consolidateMemoryLearning");

  const gateStatus = gate.gate_status;

  // ---- Rejeição: nunca consolidar ----
  // Rejeição não deve virar memória canônica. Evitar poluir memória com falha.
  if (gateStatus === "rejected") {
    const gateReason = typeof gate.reason === "string" && gate.reason.length > 0
      ? ` Gate reason: ${gate.reason}`
      : "";
    return {
      should_consolidate: false,
      memory_candidates:  [],
      reason:             `Plano rejeitado pelo gate — nenhuma memória consolidada. Rejeição não vira memória canônica.${gateReason}`,
      next_action:        "Revisar o plano e gerar nova versão antes de tentar consolidar memória.",
    };
  }

  // ---- Estado transitório: aguardando aprovação ----
  // Não consolidar enquanto a decisão humana não foi tomada — seria prematuro.
  if (gateStatus === "approval_required") {
    return {
      should_consolidate: false,
      memory_candidates:  [],
      reason:             "Plano aguardando aprovação humana — estado transitório, nenhuma memória consolidada. Consolidar apenas após decisão final do gate.",
      next_action:        "Aguardar decisão humana formal antes de consolidar memória.",
    };
  }

  // ---- Aprovado (automático ou humano): pode consolidar ----
  if (_CONSOLIDABLE_GATE_STATUSES.has(gateStatus)) {
    const candidates = [];

    // Memória operacional — sempre gerada para ciclos aprovados (histórico mínimo)
    candidates.push(_buildOperationalCandidate(plan, gate, bridge));

    // Memória canônica — apenas se critérios estáveis presentes (nível B/C + bridge ready)
    if (_qualifiesForCanonical(plan, gate, bridge)) {
      candidates.push(_buildCanonicalCandidate(plan, gate));
    }

    const hasCanonical = candidates.some((c) => c.is_canonical === true);

    const reason = hasCanonical
      ? `Plano aprovado (${gateStatus}) — nível ${plan.complexity_level} com critérios de aceite definidos e bridge pronta — memória operacional e canônica consolidadas.`
      : `Plano aprovado (${gateStatus}) — nível ${plan.complexity_level} — apenas memória operacional consolidada (sem critério suficiente para canônica).`;

    return {
      should_consolidate: true,
      memory_candidates:  candidates,
      reason,
      next_action:        "Candidatos prontos para persistência via PM2 (writeMemory) quando acionado — PM9 não persiste diretamente.",
    };
  }

  // ---- Gate status desconhecido: fallback defensivo ----
  // Nunca deve ocorrer com inputs válidos do PM7, mas PM9 não quebra o fluxo.
  return {
    should_consolidate: false,
    memory_candidates:  [],
    reason:             `Gate status desconhecido '${gateStatus}' — nenhuma memória consolidada por segurança.`,
    next_action:        "Verificar o gate_status e garantir que é um valor canônico antes de consolidar.",
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  consolidateMemoryLearning,
  CONSOLIDATION_VERSION,
};
