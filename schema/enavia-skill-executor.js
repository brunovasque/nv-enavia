// ============================================================================
// ⚙️ ENAVIA — Skill Execution Proposal v1 (PR69)
//
// Módulo proposal-only para skills. Não executa skill, não chama rede/KV/FS,
// não cria side effects. Retorna apenas proposta aditiva e governada.
// ============================================================================

export const SKILL_EXECUTION_MODE = "proposal";

export const SKILL_EXECUTION_STATUS = {
  PROPOSED: "proposed",
  NOT_APPLICABLE: "not_applicable",
  BLOCKED: "blocked",
};

export const SKILL_EXECUTION_ALLOWLIST = new Set([
  "CONTRACT_LOOP_OPERATOR",
  "CONTRACT_AUDITOR",
  "DEPLOY_GOVERNANCE_OPERATOR",
  "SYSTEM_MAPPER",
]);

function _asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _getFindings(selfAudit) {
  const findings = selfAudit?.findings;
  return Array.isArray(findings) ? findings : [];
}

function _hasSecretExposure(selfAudit) {
  return _getFindings(selfAudit).some((f) => f?.category === "secret_exposure");
}

function _hasBlockingRisk(selfAudit) {
  if (!selfAudit) return false;
  if (selfAudit.should_block === true) return true;
  if (selfAudit.risk_level === "blocking") return true;
  return _getFindings(selfAudit).some((f) => f?.severity === "blocking");
}

function _baseResult(status, skillId, reason) {
  return {
    skill_execution: {
      mode: SKILL_EXECUTION_MODE,
      status,
      skill_id: skillId || null,
      reason,
      requires_approval: status === SKILL_EXECUTION_STATUS.PROPOSED,
      side_effects: false,
    },
  };
}

export function buildSkillExecutionProposal(input) {
  const normalized = _asObject(input) || {};
  const skillRouting = _asObject(normalized.skillRouting);
  const intentClassification = _asObject(normalized.intentClassification);
  const selfAudit = _asObject(normalized.selfAudit);
  const responsePolicy = _asObject(normalized.responsePolicy);
  const chatContext = _asObject(normalized.chatContext || normalized.context);

  const matched = skillRouting?.matched === true;
  const skillId = _asString(skillRouting?.skill_id);

  if (_hasSecretExposure(selfAudit)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId,
      "Self-Audit detectou secret_exposure; proposta bloqueada por segurança.",
    );
  }

  if (_hasBlockingRisk(selfAudit)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId,
      "Self-Audit em risco blocking; proposta bloqueada até mitigação.",
    );
  }

  if (!matched) {
    const inferredIntent = _asString(intentClassification?.intent);
    const policyPause = responsePolicy?.should_refuse_or_pause === true;
    const hasChatContext = !!chatContext;
    return _baseResult(
      SKILL_EXECUTION_STATUS.NOT_APPLICABLE,
      null,
      inferredIntent
        ? `Nenhuma skill roteada para intent=${inferredIntent}.`
        : (policyPause
            ? "Sem proposta: Response Policy sinalizou pausa/recusa e não há skill roteada."
            : (hasChatContext
                ? "Nenhuma skill roteada no contexto atual do chat."
                : "Nenhuma skill roteada para esta mensagem.")),
    );
  }

  if (!skillId || !SKILL_EXECUTION_ALLOWLIST.has(skillId)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId || null,
      "Skill fora da allowlist (deny-by-default).",
    );
  }

  return _baseResult(
    SKILL_EXECUTION_STATUS.PROPOSED,
    skillId,
    "Skill elegível para proposal-only; execução real permanece bloqueada.",
  );
}
