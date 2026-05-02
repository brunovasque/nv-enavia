// ============================================================================
// ⚙️ ENAVIA — Skill Approval Gate v1 (PR73)
//
// Proposal-only, sem execução real, sem I/O externo.
// Persistência local em memória (instância) para viabilizar smoke tests.
// ============================================================================

export const SKILL_APPROVAL_STATUS = {
  PROPOSED: "proposed",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  BLOCKED: "blocked",
};

const _PROPOSAL_STORE = new Map();
let _proposalCounter = 0;

function _asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}

function _buildProposalId() {
  _proposalCounter += 1;
  return `proposal_${Date.now().toString(36)}_${_proposalCounter.toString(36)}`;
}

function _normalizeSkillExecution(input) {
  const se = _asObject(input);
  if (!se) return null;

  const mode = _asString(se.mode);
  const status = _asString(se.status);
  const reason = _asString(se.reason);

  if (mode !== "proposal") return null;
  if (!status) return null;
  if (se.side_effects !== false) return null;

  return {
    mode,
    status,
    skill_id: _asString(se.skill_id) || null,
    reason: reason || "Proposta sem reason explícito.",
    requires_approval: se.requires_approval === true,
    side_effects: false,
  };
}

function _gateStatusFromSkillStatus(skillStatus) {
  if (skillStatus === "proposed") return SKILL_APPROVAL_STATUS.PROPOSED;
  if (skillStatus === "blocked" || skillStatus === "not_applicable") return SKILL_APPROVAL_STATUS.BLOCKED;
  return SKILL_APPROVAL_STATUS.BLOCKED;
}

function _publicRecord(record, overrideReason = null) {
  const reason = overrideReason || record.reason || record.skill_execution.reason;
  return {
    proposal_id: record.proposal_id,
    status: record.status,
    mode: "proposal",
    skill_id: record.skill_execution.skill_id || null,
    reason,
    requires_approval: record.status === SKILL_APPROVAL_STATUS.PROPOSED,
    side_effects: false,
    created_at: record.created_at,
    updated_at: record.updated_at,
    expires_at: record.expires_at || null,
  };
}

function _isExpired(record, nowMs = Date.now()) {
  if (!record.expires_at) return false;
  const expiry = Date.parse(record.expires_at);
  if (!Number.isFinite(expiry)) return false;
  return nowMs >= expiry;
}

function _refreshExpiration(record, nowMs = Date.now()) {
  if (_isExpired(record, nowMs)) {
    record.status = SKILL_APPROVAL_STATUS.EXPIRED;
    record.reason = "Proposal expirada.";
    record.updated_at = _nowIso(nowMs);
  }
}

export function registerSkillProposal(skillExecution, options = {}) {
  const normalized = _normalizeSkillExecution(skillExecution);
  if (!normalized) {
    return {
      ok: false,
      proposal_id: null,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Payload de proposal inválido para approval gate.",
      side_effects: false,
    };
  }

  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const proposalId = _buildProposalId();
  const gateStatus = _gateStatusFromSkillStatus(normalized.status);
  const createdAt = _nowIso(nowMs);
  const expiresAt = _asString(options.expires_at) || null;

  const record = {
    proposal_id: proposalId,
    status: gateStatus,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: expiresAt,
    reason: gateStatus === SKILL_APPROVAL_STATUS.BLOCKED && normalized.status === "not_applicable"
      ? "Proposal not_applicable não é elegível para approval."
      : normalized.reason,
    skill_execution: normalized,
  };

  _PROPOSAL_STORE.set(proposalId, record);

  return {
    ok: true,
    proposal_id: proposalId,
    status: record.status,
    side_effects: false,
    proposal: _publicRecord(record),
  };
}

function _resolveProposal(input) {
  const proposalId = _asString(input?.proposal_id || input?.proposalId);
  if (!proposalId) {
    return {
      ok: false,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "proposal_id obrigatório.",
      proposal_id: null,
      side_effects: false,
    };
  }

  const record = _PROPOSAL_STORE.get(proposalId);
  if (!record) {
    return {
      ok: false,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal desconhecida.",
      proposal_id: proposalId,
      side_effects: false,
    };
  }

  _refreshExpiration(record);

  return { ok: true, proposal_id: proposalId, record };
}

export function approveSkillProposal(input) {
  const resolved = _resolveProposal(input);
  if (!resolved.ok) return resolved;

  const { record } = resolved;

  if (record.status === SKILL_APPROVAL_STATUS.EXPIRED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal expirada; approval bloqueado.",
      side_effects: false,
      proposal: _publicRecord(record),
    };
  }

  if (record.status !== SKILL_APPROVAL_STATUS.PROPOSED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: `Approval bloqueado para status=${record.status}.`,
      side_effects: false,
      proposal: _publicRecord(record),
    };
  }

  if (record.skill_execution.status === "not_applicable") {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal not_applicable não pode ser aprovada.",
      side_effects: false,
      proposal: _publicRecord(record),
    };
  }

  record.status = SKILL_APPROVAL_STATUS.APPROVED;
  record.reason = "Proposal aprovada no gate técnico (proposal-only).";
  record.updated_at = _nowIso();

  return {
    ok: true,
    proposal_id: record.proposal_id,
    status: SKILL_APPROVAL_STATUS.APPROVED,
    side_effects: false,
    proposal: _publicRecord(record),
  };
}

export function rejectSkillProposal(input) {
  const resolved = _resolveProposal(input);
  if (!resolved.ok) return resolved;

  const { record } = resolved;

  if (record.status === SKILL_APPROVAL_STATUS.EXPIRED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal expirada; reject bloqueado.",
      side_effects: false,
      proposal: _publicRecord(record),
    };
  }

  if (record.status !== SKILL_APPROVAL_STATUS.PROPOSED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: `Reject bloqueado para status=${record.status}.`,
      side_effects: false,
      proposal: _publicRecord(record),
    };
  }

  record.status = SKILL_APPROVAL_STATUS.REJECTED;
  record.reason = "Proposal rejeitada no gate técnico (proposal-only).";
  record.updated_at = _nowIso();

  return {
    ok: true,
    proposal_id: record.proposal_id,
    status: SKILL_APPROVAL_STATUS.REJECTED,
    side_effects: false,
    proposal: _publicRecord(record),
  };
}

