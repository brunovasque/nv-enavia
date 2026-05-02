// ============================================================================
// 📚 ENAVIA — Skill Registry (PR80)
//
// Registry local e deterministico das skills executaveis no runtime.
// Sem I/O externo, sem KV, sem filesystem runtime.
// ============================================================================

export const REGISTERED_SKILLS = Object.freeze({
  SYSTEM_MAPPER: Object.freeze({
    skill_id: "SYSTEM_MAPPER",
    mode: "read_only",
    risk_level: "low",
    allowed_effects: Object.freeze([]),
    forbidden_effects: Object.freeze([
      "deploy_automatico",
      "merge_automatico",
      "producao_direta",
      "browser_action",
      "acesso_credenciais_sensiveis",
      "execucao_comando_externo",
      "escrita_kv_ou_banco",
      "filesystem_runtime",
      "chamada_llm_externo_novo",
      "fetch_externo",
    ]),
    requires_approval: true,
    human_review_required: true,
    module: "schema/enavia-system-mapper-skill.js",
    source: "buildSystemMapperResult",
    executable: true,
    side_effects_allowed: false,
  }),
});

const _BLOCKED_STATUSES = new Set([
  "proposed",
  "rejected",
  "blocked",
  "expired",
  "unknown",
]);

function _asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _normalizeStatus(input) {
  const normalized = _asString(input).toLowerCase();
  if (!normalized) return "unknown";
  return normalized;
}

export function listRegisteredSkills() {
  return Object.values(REGISTERED_SKILLS).map((item) => ({ ...item }));
}

export function getRegisteredSkill(skillId) {
  const key = _asString(skillId);
  if (!key) return null;
  const item = REGISTERED_SKILLS[key];
  return item ? { ...item } : null;
}

export function isSkillRegistered(skillId) {
  return !!getRegisteredSkill(skillId);
}

export function validateSkillRunRequest(input) {
  const payload = _asObject(input);
  const approval = _asObject(payload.approval);

  const skill_id = _asString(payload.skill_id || payload.skillId);
  const proposal_id = _asString(payload.proposal_id || payload.proposalId);
  const proposal_status = _normalizeStatus(
    payload.proposal_status ||
      payload.proposalStatus ||
      approval.status ||
      approval.proposal_status,
  );

  const requested_effects = Array.isArray(payload.requested_effects)
    ? payload.requested_effects.map((value) => _asString(value)).filter(Boolean)
    : [];

  const errors = [];
  if (!skill_id) errors.push("missing:skill_id");
  if (!proposal_id) errors.push("missing:proposal_id");
  if (proposal_status !== "approved" && _BLOCKED_STATUSES.has(proposal_status)) {
    errors.push(`blocked:proposal_status:${proposal_status}`);
  } else if (proposal_status !== "approved") {
    errors.push(`invalid:proposal_status:${proposal_status || "unknown"}`);
  }

  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      skill_id,
      proposal_id,
      proposal_status,
      requested_effects,
    },
  };
}
