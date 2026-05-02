// ============================================================================
// 💬 ENAVIA — Chat Skill Surface (PR77)
//
// Helper puro para expor proposta de skill no chat de forma controlada.
// Não executa skill, não altera reply automaticamente e não produz side effects.
// ============================================================================

export const CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE =
  "Existe uma ação técnica proposta, aguardando aprovação.";

function _asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function buildChatSkillSurface(input) {
  const normalized = _asObject(input) || {};
  const skillExecution = _asObject(normalized.skillExecution || normalized.skill_execution);

  if (!skillExecution) return null;

  const status = _asString(skillExecution.status);
  if (status !== "proposed") return null;

  return {
    kind: "skill_proposal",
    status: "proposed",
    is_proposal: true,
    awaiting_approval: true,
    skill_id: _asString(skillExecution.skill_id) || null,
    message: CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE,
  };
}

