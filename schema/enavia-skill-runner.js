// ============================================================================
// 🏃 ENAVIA — Skill Runner (PR80)
//
// Executa somente skills registradas com approval valido.
// Sem I/O externo, sem fetch, sem filesystem runtime, sem comandos externos.
// ============================================================================

import { buildSystemMapperResult } from "./enavia-system-mapper-skill.js";
import { buildSelfWorkerAuditorResult } from "./enavia-self-worker-auditor-skill.js";
import {
  getRegisteredSkill,
  isSkillRegistered,
  validateSkillRunRequest,
} from "./enavia-skill-registry.js";

function _nowMs(context) {
  if (context && Number.isFinite(context.nowMs)) return context.nowMs;
  return Date.now();
}

function _buildRunId(context) {
  const now = _nowMs(context);
  const suffix = Math.floor(now % 100000).toString(36);
  return `run_${now.toString(36)}_${suffix}`;
}

function _blocked(error, message, detail, input, status_code = 409) {
  return {
    ok: false,
    status_code,
    error,
    message,
    detail: detail || null,
    run_id: null,
    executed: false,
    side_effects: false,
    result: null,
    evidence: {
      skill_id: input?.skill_id || null,
      proposal_id: input?.proposal_id || null,
      status: input?.proposal_status || "unknown",
      blocked: true,
    },
  };
}

function _containsForbiddenRequestedEffects(requestedEffects, allowedEffects) {
  if (!Array.isArray(requestedEffects) || requestedEffects.length === 0) return false;
  const allowed = new Set(Array.isArray(allowedEffects) ? allowedEffects : []);
  return requestedEffects.some((effect) => !allowed.has(effect));
}

export function runRegisteredSkill(input, context = {}) {
  const validation = validateSkillRunRequest(input);
  const normalized = validation.normalized;

  if (!normalized.skill_id) {
    return _blocked(
      "MISSING_SKILL_ID",
      "skill_id obrigatorio.",
      validation.errors,
      normalized,
      409,
    );
  }

  if (!isSkillRegistered(normalized.skill_id)) {
    return _blocked(
      "SKILL_NOT_REGISTERED",
      "Skill desconhecida ou nao registrada no runtime.",
      validation.errors,
      normalized,
      404,
    );
  }

  const registryEntry = getRegisteredSkill(normalized.skill_id);
  if (!registryEntry || registryEntry.executable !== true) {
    return _blocked(
      "SKILL_WITHOUT_REGISTRY_CONTRACT",
      "Skill sem contrato executavel no registry.",
      validation.errors,
      normalized,
      409,
    );
  }

  if (!validation.ok) {
    const blockedStatus = normalized.proposal_status || "unknown";
    const error = blockedStatus === "approved" ? "INVALID_RUN_REQUEST" : "APPROVAL_REQUIRED";
    return _blocked(
      error,
      "Run bloqueado por approval invalido ou payload incompleto.",
      validation.errors,
      normalized,
      404,
    );
  }

  if (registryEntry.requires_approval === true && normalized.proposal_status !== "approved") {
    return _blocked(
      "APPROVAL_REQUIRED",
      `Skill ${normalized.skill_id} requer proposal aprovada.`,
      [`blocked:proposal_status:${normalized.proposal_status}`],
      normalized,
      404,
    );
  }

  if (_containsForbiddenRequestedEffects(normalized.requested_effects, registryEntry.allowed_effects)) {
    return _blocked(
      "SIDE_EFFECT_NOT_ALLOWED",
      "requested_effects contem efeito fora da allowlist da skill.",
      normalized.requested_effects,
      normalized,
      409,
    );
  }

  let result;
  if (normalized.skill_id === "SYSTEM_MAPPER") {
    result = buildSystemMapperResult({
      require_approved_proposal: true,
      proposal_status: normalized.proposal_status,
      approval: { status: normalized.proposal_status },
    });
  } else if (normalized.skill_id === "SELF_WORKER_AUDITOR") {
    result = buildSelfWorkerAuditorResult({
      require_approved_proposal: true,
      proposal_status: normalized.proposal_status,
      approval: { status: normalized.proposal_status },
    });
  } else {
    return _blocked(
      "SKILL_RUNNER_NOT_IMPLEMENTED",
      `Runner para ${normalized.skill_id} ainda nao implementado.`,
      null,
      normalized,
      409,
    );
  }

  if (!result || typeof result !== "object") {
    return _blocked(
      "INVALID_SKILL_RESULT",
      "Resultado de skill invalido.",
      null,
      normalized,
      500,
    );
  }

  if (registryEntry.side_effects_allowed !== true && result.side_effects !== false) {
    return _blocked(
      "SIDE_EFFECT_VIOLATION",
      "Skill retornou side_effects fora da allowlist.",
      { expected: false, received: result.side_effects },
      normalized,
      409,
    );
  }

  const run_id = _buildRunId(context);

  return {
    ok: true,
    status_code: 200,
    run_id,
    executed: true,
    side_effects: false,
    result,
    evidence: {
      skill_id: normalized.skill_id,
      proposal_id: normalized.proposal_id,
      status: normalized.proposal_status,
      registry: {
        executable: registryEntry.executable === true,
        requires_approval: registryEntry.requires_approval === true,
        module: registryEntry.module,
        source: registryEntry.source,
      },
      blocked: false,
    },
  };
}
