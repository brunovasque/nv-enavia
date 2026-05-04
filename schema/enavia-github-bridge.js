/**
 * enavia-github-bridge.js — PR103 — GitHub Bridge helper real supervisionado
 *
 * Helper puro supervisionado para modelar e validar operações GitHub reais.
 * Sem side effects, sem fetch, sem dependências externas (GitHub API client, gh CLI),
 * sem escrita em KV/banco/arquivo, sem token real, sem chamada GitHub API real.
 *
 * Contrato: CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md
 * PR: PR103 — GitHub Bridge helper real supervisionado
 *
 * Proteções obrigatórias:
 *   - Toda operação passa por evaluateSafetyGuard (PR100)
 *   - Toda operação gera evento via createEnaviaEvent (PR99)
 *   - Health Snapshot e Event Log influenciam decisões (PR99)
 *   - merge / deploy_prod / secret_change são sempre bloqueados
 *   - github_execution=false sempre nesta PR
 *   - side_effects=false sempre nesta PR
 *   - ready_for_real_execution=false sempre nesta PR
 */

'use strict';

const { evaluateSafetyGuard } = require('./enavia-safety-guard');
const { createEnaviaEvent } = require('./enavia-event-log');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const CONTRACT_ID = 'CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105';
const SOURCE_PR = 'PR103';

const ALLOWED_REPOS = []; // Sem allowlist fixa — repo deve ser validado pelo contexto

const ALLOWED_OPERATION_TYPES = [
  'create_branch',
  'open_pr',
  'update_pr',
  'comment_pr',
  'attach_evidence',
  'request_review',
];

const BLOCKED_OPERATION_TYPES = [
  'merge',
  'deploy_prod',
  'secret_change',
];

const MUTABLE_OPERATION_TYPES = [
  'create_branch',
  'open_pr',
  'update_pr',
  'comment_pr',
  'attach_evidence',
  'request_review',
];

// Tipos que exigem repo + base_branch + head_branch
const BRANCH_REQUIRED_TYPES = ['create_branch', 'open_pr'];

// ---------------------------------------------------------------------------
// _normalizeOperationType
// ---------------------------------------------------------------------------

function _normalizeOperationType(type) {
  if (typeof type !== 'string') return 'unknown';
  const lower = type.toLowerCase().trim();
  if (ALLOWED_OPERATION_TYPES.includes(lower)) return lower;
  if (BLOCKED_OPERATION_TYPES.includes(lower)) return lower;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// _extractHealthStatus
// ---------------------------------------------------------------------------

function _extractHealthStatus(context) {
  if (!context || typeof context !== 'object') return 'unknown';
  const hs = context.health_snapshot;
  if (!hs || typeof hs !== 'object') return 'unknown';
  const raw = typeof hs.overall_status === 'string' ? hs.overall_status.toLowerCase() : '';
  const valid = ['healthy', 'degraded', 'failed', 'blocked', 'unknown'];
  return valid.includes(raw) ? raw : 'unknown';
}

// ---------------------------------------------------------------------------
// _extractEventLogBlocked
// ---------------------------------------------------------------------------

function _extractEventLogBlocked(context) {
  if (!context || typeof context !== 'object') return false;
  const els = context.event_log_snapshot;
  if (!els || typeof els !== 'object') return false;
  return (els.blocked_count || 0) > 0 || (els.requires_human_review_count || 0) > 0;
}

// ---------------------------------------------------------------------------
// _isRepoPermitted
// ---------------------------------------------------------------------------

function _isRepoPermitted(repo, context) {
  if (typeof repo !== 'string' || !repo.trim()) return { permitted: false, reason: 'repo ausente ou inválido' };

  // Se o contexto definir allowed_repos, verifica
  const allowedRepos =
    context && Array.isArray(context.allowed_repos) && context.allowed_repos.length > 0
      ? context.allowed_repos
      : null;

  if (allowedRepos) {
    const permitted = allowedRepos.includes(repo.trim());
    return {
      permitted,
      reason: permitted ? null : `repo "${repo}" não está na lista de repos permitidos`,
    };
  }

  // Sem allowlist definida — sempre exige revisão humana para repos externos
  return { permitted: true, reason: null, requires_human_review: true };
}

// ---------------------------------------------------------------------------
// validateGithubOperation
// ---------------------------------------------------------------------------

/**
 * Valida uma operação GitHub usando Safety Guard e regras do contrato.
 * Função pura — sem side effects.
 *
 * @param {{ type: string, repo?: string, base_branch?: string, head_branch?: string, pr_number?: number, title?: string, body?: string, comment?: string }} operation
 * @param {object} context - { health_snapshot?, event_log_snapshot?, scope_status?, allowed_repos? }
 * @returns {object}
 */
function validateGithubOperation(operation, context) {
  const safeOp = operation && typeof operation === 'object' ? operation : {};
  const safeCtx = context && typeof context === 'object' ? context : {};

  const rawType = safeOp.type;
  const operation_type = _normalizeOperationType(rawType);
  const repo = typeof safeOp.repo === 'string' ? safeOp.repo.trim() : '';
  const base_branch = typeof safeOp.base_branch === 'string' ? safeOp.base_branch.trim() : '';
  const head_branch = typeof safeOp.head_branch === 'string' ? safeOp.head_branch.trim() : '';

  const reasons = [];
  let blocked = false;
  let requires_human_review = false;

  // 1. Operações sempre bloqueadas
  if (BLOCKED_OPERATION_TYPES.includes(operation_type)) {
    blocked = true;
    reasons.push(`${operation_type} é sempre bloqueado pelo GitHub Bridge`);
  }

  // 2. Tipo desconhecido — não permite cego
  if (operation_type === 'unknown') {
    requires_human_review = true;
    reasons.push('tipo de operação desconhecido — não permitido sem revisão humana');
  }

  // 3. Ausência de repo em operações que exigem
  if (!blocked && !repo && ALLOWED_OPERATION_TYPES.includes(operation_type)) {
    blocked = true;
    reasons.push(`operação ${operation_type} exige campo "repo"`);
  }

  // 4. Ausência de base_branch/head_branch nas operações de branch
  if (!blocked && BRANCH_REQUIRED_TYPES.includes(operation_type)) {
    if (!base_branch) {
      blocked = true;
      reasons.push(`operação ${operation_type} exige campo "base_branch"`);
    }
    if (!head_branch) {
      blocked = true;
      reasons.push(`operação ${operation_type} exige campo "head_branch"`);
    }
  }

  // 5. Verificar repo permitido
  if (!blocked && repo) {
    const repoCheck = _isRepoPermitted(repo, safeCtx);
    if (!repoCheck.permitted) {
      blocked = true;
      reasons.push(repoCheck.reason);
    } else if (repoCheck.requires_human_review) {
      requires_human_review = true;
      reasons.push(`repo "${repo}" sem allowlist definida — exige revisão humana`);
    }
  }

  // 6. Chamar Safety Guard
  const safetyAction = {
    type: 'external_integration',
    blast_radius: 'external',
    description: `GitHub Bridge: ${operation_type}`,
    rollback_hint: safeOp.rollback_hint || null,
  };

  const safetyResult = evaluateSafetyGuard(safetyAction, safeCtx);

  // Safety Guard pode forçar bloqueio ou revisão
  if (safetyResult.decision === 'block') {
    blocked = true;
    reasons.push(...(safetyResult.blocked || ['Safety Guard bloqueou a operação']));
  } else if (safetyResult.decision === 'require_human_review') {
    requires_human_review = true;
    reasons.push(...(safetyResult.blocked || ['Safety Guard exige revisão humana']));
  }

  // 7. Health failed bloqueia ou exige review para operações mutáveis
  const healthStatus = _extractHealthStatus(safeCtx);
  if (!blocked && MUTABLE_OPERATION_TYPES.includes(operation_type)) {
    if (healthStatus === 'failed') {
      blocked = true;
      reasons.push('health snapshot em estado failed bloqueia operações GitHub mutáveis');
    } else if (healthStatus === 'degraded' || healthStatus === 'blocked') {
      requires_human_review = true;
      reasons.push(`health snapshot em estado ${healthStatus} exige revisão humana para operações GitHub`);
    }
  }

  // 8. Event log bloqueado exige review
  if (!blocked && _extractEventLogBlocked(safeCtx)) {
    requires_human_review = true;
    reasons.push('event log indica operações bloqueadas ou pendentes de revisão humana');
  }

  return {
    ok: !blocked,
    operation_type,
    repo: repo || null,
    base_branch: base_branch || null,
    head_branch: head_branch || null,
    pr_number: typeof safeOp.pr_number === 'number' ? safeOp.pr_number : null,
    title: typeof safeOp.title === 'string' ? safeOp.title : null,
    body: typeof safeOp.body === 'string' ? safeOp.body : null,
    comment: typeof safeOp.comment === 'string' ? safeOp.comment : null,
    files: Array.isArray(safeOp.files) ? safeOp.files : [],
    commit_message: typeof safeOp.commit_message === 'string' ? safeOp.commit_message : null,
    blocked,
    requires_human_review: requires_human_review || blocked,
    reasons,
    safety: safetyResult,
    github_execution: false,
    side_effects: false,
  };
}

// ---------------------------------------------------------------------------
// buildGithubOperationEvent
// ---------------------------------------------------------------------------

/**
 * Gera evento Enavia para uma operação GitHub.
 * Função pura — sem side effects.
 *
 * @param {object} operation - objeto de operação original
 * @param {object} validation - resultado de validateGithubOperation
 * @param {object} context
 * @returns {{ ok: boolean, event?: object, error?: string }}
 */
function buildGithubOperationEvent(operation, validation, context) {
  const safeOp = operation && typeof operation === 'object' ? operation : {};
  const safeVal = validation && typeof validation === 'object' ? validation : {};
  const safeCtx = context && typeof context === 'object' ? context : {};

  const operation_type = safeVal.operation_type || _normalizeOperationType(safeOp.type);

  // Derivar severity e status do resultado de validação
  let severity = 'info';
  let status = 'ok';

  if (safeVal.blocked) {
    severity = 'error';
    status = 'blocked';
  } else if (safeVal.requires_human_review) {
    severity = 'warning';
    status = 'pending';
  }

  const message = safeVal.blocked
    ? `GitHub Bridge: operação ${operation_type} bloqueada — ${(safeVal.reasons || []).join('; ')}`
    : safeVal.requires_human_review
      ? `GitHub Bridge: operação ${operation_type} planejada — aguardando revisão humana`
      : `GitHub Bridge: operação ${operation_type} planejada com sucesso`;

  const evidence = {
    operation_type,
    repo: safeVal.repo || null,
    base_branch: safeVal.base_branch || null,
    head_branch: safeVal.head_branch || null,
    pr_number: safeVal.pr_number || null,
    blocked: safeVal.blocked || false,
    requires_human_review: safeVal.requires_human_review || false,
    reasons: safeVal.reasons || [],
    safety_decision: safeVal.safety ? safeVal.safety.decision : null,
    github_execution: false,
    side_effects: false,
    source_pr: SOURCE_PR,
    contract_id: CONTRACT_ID,
  };

  return createEnaviaEvent({
    source: 'github_bridge',
    subsystem: 'github_bridge',
    type: `github_${operation_type}`,
    severity,
    status,
    message,
    execution_id: safeCtx.execution_id || null,
    contract_id: safeCtx.contract_id || CONTRACT_ID,
    correlation_id: safeCtx.correlation_id || null,
    requires_human_review: safeVal.requires_human_review || false,
    rollback_hint: safeVal.blocked
      ? `Rollback: operação ${operation_type} bloqueada — nenhuma ação GitHub executada`
      : null,
    evidence,
    metadata: {
      source_pr: SOURCE_PR,
      operation_type,
      awaiting_human_approval: safeVal.requires_human_review || false,
    },
  });
}

// ---------------------------------------------------------------------------
// planCreateBranch
// ---------------------------------------------------------------------------

/**
 * Planeja criação de branch de forma supervisionada (sem execução real).
 *
 * @param {{ repo: string, base_branch: string, head_branch: string, commit_message?: string }} input
 * @param {object} context
 * @returns {object}
 */
function planCreateBranch(input, context) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const operation = {
    type: 'create_branch',
    repo: safeInput.repo,
    base_branch: safeInput.base_branch,
    head_branch: safeInput.head_branch,
    commit_message: safeInput.commit_message || null,
    rollback_hint: `Nenhuma branch criada — operação apenas planejada pela PR103`,
  };

  const validation = validateGithubOperation(operation, context);
  const eventResult = buildGithubOperationEvent(operation, validation, context);

  return {
    ok: validation.ok,
    mode: 'github_bridge',
    operation_type: 'create_branch',
    repo: validation.repo,
    base_branch: validation.base_branch,
    head_branch: validation.head_branch,
    pr_number: null,
    title: null,
    body: null,
    comment: null,
    files: validation.files,
    commit_message: validation.commit_message,
    safety: validation.safety,
    event: eventResult.ok ? eventResult.event : null,
    evidence: eventResult.ok ? eventResult.event.evidence : null,
    requires_human_review: validation.requires_human_review,
    blocked: validation.blocked,
    reasons: validation.reasons,
    github_execution: false,
    side_effects: false,
    awaiting_human_approval: validation.requires_human_review || false,
    next_recommended_action: validation.blocked
      ? `Operação bloqueada: ${(validation.reasons || []).join('; ')}`
      : validation.requires_human_review
        ? 'Aguardar aprovação humana antes de criar branch real via PR104+'
        : 'Plano de criação de branch pronto — integração runtime via PR104',
  };
}

// ---------------------------------------------------------------------------
// planOpenPullRequest
// ---------------------------------------------------------------------------

/**
 * Planeja abertura de PR de forma supervisionada (sem execução real).
 *
 * @param {{ repo: string, base_branch: string, head_branch: string, title: string, body?: string }} input
 * @param {object} context
 * @returns {object}
 */
function planOpenPullRequest(input, context) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const operation = {
    type: 'open_pr',
    repo: safeInput.repo,
    base_branch: safeInput.base_branch,
    head_branch: safeInput.head_branch,
    title: safeInput.title || null,
    body: safeInput.body || null,
    rollback_hint: `Nenhuma PR aberta — operação apenas planejada pela PR103`,
  };

  const validation = validateGithubOperation(operation, context);
  const eventResult = buildGithubOperationEvent(operation, validation, context);

  return {
    ok: validation.ok,
    mode: 'github_bridge',
    operation_type: 'open_pr',
    repo: validation.repo,
    base_branch: validation.base_branch,
    head_branch: validation.head_branch,
    pr_number: null,
    title: validation.title,
    body: validation.body,
    comment: null,
    files: validation.files,
    commit_message: null,
    safety: validation.safety,
    event: eventResult.ok ? eventResult.event : null,
    evidence: eventResult.ok ? eventResult.event.evidence : null,
    requires_human_review: validation.requires_human_review,
    blocked: validation.blocked,
    reasons: validation.reasons,
    github_execution: false,
    side_effects: false,
    awaiting_human_approval: validation.requires_human_review || false,
    next_recommended_action: validation.blocked
      ? `Operação bloqueada: ${(validation.reasons || []).join('; ')}`
      : validation.requires_human_review
        ? 'Aguardar aprovação humana antes de abrir PR real via PR104+'
        : 'Plano de abertura de PR pronto — integração runtime via PR104',
  };
}

// ---------------------------------------------------------------------------
// planUpdatePullRequest
// ---------------------------------------------------------------------------

/**
 * Planeja atualização de PR de forma supervisionada (sem execução real).
 *
 * @param {{ repo: string, pr_number: number, title?: string, body?: string }} input
 * @param {object} context
 * @returns {object}
 */
function planUpdatePullRequest(input, context) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const operation = {
    type: 'update_pr',
    repo: safeInput.repo,
    pr_number: safeInput.pr_number || null,
    title: safeInput.title || null,
    body: safeInput.body || null,
    rollback_hint: `Nenhuma PR atualizada — operação apenas planejada pela PR103`,
  };

  const validation = validateGithubOperation(operation, context);
  const eventResult = buildGithubOperationEvent(operation, validation, context);

  return {
    ok: validation.ok,
    mode: 'github_bridge',
    operation_type: 'update_pr',
    repo: validation.repo,
    base_branch: null,
    head_branch: null,
    pr_number: validation.pr_number,
    title: validation.title,
    body: validation.body,
    comment: null,
    files: validation.files,
    commit_message: null,
    safety: validation.safety,
    event: eventResult.ok ? eventResult.event : null,
    evidence: eventResult.ok ? eventResult.event.evidence : null,
    requires_human_review: validation.requires_human_review,
    blocked: validation.blocked,
    reasons: validation.reasons,
    github_execution: false,
    side_effects: false,
    awaiting_human_approval: validation.requires_human_review || false,
    next_recommended_action: validation.blocked
      ? `Operação bloqueada: ${(validation.reasons || []).join('; ')}`
      : validation.requires_human_review
        ? 'Aguardar aprovação humana antes de atualizar PR real via PR104+'
        : 'Plano de atualização de PR pronto — integração runtime via PR104',
  };
}

// ---------------------------------------------------------------------------
// planCommentPullRequest
// ---------------------------------------------------------------------------

/**
 * Planeja comentário em PR de forma supervisionada (sem execução real).
 *
 * @param {{ repo: string, pr_number: number, comment: string }} input
 * @param {object} context
 * @returns {object}
 */
function planCommentPullRequest(input, context) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const operation = {
    type: 'comment_pr',
    repo: safeInput.repo,
    pr_number: safeInput.pr_number || null,
    comment: safeInput.comment || null,
    rollback_hint: `Nenhum comentário enviado — operação apenas planejada pela PR103`,
  };

  const validation = validateGithubOperation(operation, context);
  const eventResult = buildGithubOperationEvent(operation, validation, context);

  return {
    ok: validation.ok,
    mode: 'github_bridge',
    operation_type: 'comment_pr',
    repo: validation.repo,
    base_branch: null,
    head_branch: null,
    pr_number: validation.pr_number,
    title: null,
    body: null,
    comment: validation.comment,
    files: validation.files,
    commit_message: null,
    safety: validation.safety,
    event: eventResult.ok ? eventResult.event : null,
    evidence: eventResult.ok ? eventResult.event.evidence : null,
    requires_human_review: validation.requires_human_review,
    blocked: validation.blocked,
    reasons: validation.reasons,
    github_execution: false,
    side_effects: false,
    awaiting_human_approval: validation.requires_human_review || false,
    next_recommended_action: validation.blocked
      ? `Operação bloqueada: ${(validation.reasons || []).join('; ')}`
      : validation.requires_human_review
        ? 'Aguardar aprovação humana antes de comentar em PR real via PR104+'
        : 'Plano de comentário de PR pronto — integração runtime via PR104',
  };
}

// ---------------------------------------------------------------------------
// buildGithubBridgePlan
// ---------------------------------------------------------------------------

/**
 * Agrega múltiplas operações GitHub em um plano supervisionado.
 * Função pura — sem side effects.
 *
 * @param {{ operations: object[] }} input - Lista de operações a planejar
 * @param {object} context
 * @returns {object}
 */
function buildGithubBridgePlan(input, context) {
  const safeInput = input && typeof input === 'object' ? input : {};
  const safeCtx = context && typeof context === 'object' ? context : {};

  const rawOperations = Array.isArray(safeInput.operations) ? safeInput.operations : [];

  const operations = [];
  const blocked_operations = [];
  const all_events = [];

  // Processar cada operação
  for (const op of rawOperations) {
    if (!op || typeof op !== 'object') continue;
    const validation = validateGithubOperation(op, safeCtx);
    const eventResult = buildGithubOperationEvent(op, validation, safeCtx);

    const operationResult = {
      operation_type: validation.operation_type,
      ok: validation.ok,
      repo: validation.repo,
      base_branch: validation.base_branch,
      head_branch: validation.head_branch,
      pr_number: validation.pr_number,
      blocked: validation.blocked,
      requires_human_review: validation.requires_human_review,
      reasons: validation.reasons,
      github_execution: false,
      side_effects: false,
      awaiting_human_approval: validation.requires_human_review || false,
    };

    operations.push(operationResult);

    if (validation.blocked) {
      blocked_operations.push(validation.operation_type || 'unknown');
    }

    if (eventResult.ok) {
      all_events.push(eventResult.event);
    }
  }

  // Sumários
  const all_valid = operations.length > 0 && operations.every((op) => op.ok);
  const any_blocked = blocked_operations.length > 0;
  const any_review = operations.some((op) => op.requires_human_review);

  const safety_summary = {
    total_operations: operations.length,
    blocked_count: blocked_operations.length,
    requires_review_count: operations.filter((op) => op.requires_human_review).length,
    all_valid,
    any_blocked,
    any_review,
    github_execution: false,
    side_effects: false,
  };

  const event_summary = {
    total_events: all_events.length,
    events: all_events,
    subsystem: 'github_bridge',
    source_pr: SOURCE_PR,
    contract_id: safeCtx.contract_id || CONTRACT_ID,
  };

  const health_summary = {
    health_status: _extractHealthStatus(safeCtx),
    event_log_blocked: _extractEventLogBlocked(safeCtx),
    considered: !!(safeCtx.health_snapshot || safeCtx.event_log_snapshot),
  };

  const ready_for_runtime_integration =
    operations.length > 0 &&
    !any_blocked &&
    operations.every((op) => op.ok || op.requires_human_review);

  const next_recommended_action = any_blocked
    ? `Plano contém operações bloqueadas: ${blocked_operations.join(', ')}. Revisar antes de avançar.`
    : any_review
      ? 'Plano pronto — operações aguardam revisão humana antes de execução real via PR104'
      : ready_for_runtime_integration
        ? 'Plano válido — pronto para integração runtime supervisionada via PR104'
        : 'Nenhuma operação processada — verificar input';

  return {
    ok: !any_blocked && operations.length > 0,
    mode: 'github_bridge_plan',
    operations,
    safety_summary,
    event_summary,
    health_summary,
    blocked_operations,
    requires_human_review: any_review,
    github_execution: false,
    side_effects: false,
    ready_for_runtime_integration,
    ready_for_real_execution: false,
    contract_id: safeCtx.contract_id || CONTRACT_ID,
    operation_count: operations.length,
    source_pr: SOURCE_PR,
    next_recommended_action,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  planCreateBranch,
  planOpenPullRequest,
  planUpdatePullRequest,
  planCommentPullRequest,
  validateGithubOperation,
  buildGithubOperationEvent,
  buildGithubBridgePlan,
  // Constantes exportadas para uso nos testes
  ALLOWED_OPERATION_TYPES,
  BLOCKED_OPERATION_TYPES,
  CONTRACT_ID,
  SOURCE_PR,
};
