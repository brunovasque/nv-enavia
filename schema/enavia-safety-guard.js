/**
 * enavia-safety-guard.js — PR100 — Safety Guard / Anti-autodestruição
 *
 * Helper puro de autoproteção da Enavia.
 * Avalia operações perigosas, loops destrutivos, ações fora de escopo
 * e ações sem rollback, usando sinais do Event Log e Health Snapshot (PR99).
 *
 * Sem side effects, sem fetch, sem child_process, sem escrita em KV/banco/arquivo.
 *
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 * PR: PR100 — Safety Guard / Anti-autodestruição
 */

// ---------------------------------------------------------------------------
// Constantes de validação
// ---------------------------------------------------------------------------

const VALID_DECISIONS = ['allow', 'warn', 'require_human_review', 'block'];

const VALID_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

const VALID_ACTION_TYPES = [
  'read',
  'plan',
  'propose',
  'patch',
  'deploy_test',
  'deploy_prod',
  'merge',
  'rollback',
  'secret_change',
  'external_integration',
  'unknown',
];

const VALID_BLAST_RADII = ['none', 'local', 'repo', 'worker', 'production', 'external', 'unknown'];

const VALID_SCOPE_STATUSES = ['in_scope', 'out_of_scope', 'unknown'];

const VALID_HEALTH_STATUSES = ['healthy', 'degraded', 'failed', 'blocked', 'unknown'];

const VALID_LOOP_STATUSES = ['clear', 'suspicious', 'destructive_loop', 'unknown'];

// Ações que mutam estado (exigem rollback_hint ou rollback_required)
const MUTABLE_ACTIONS = ['patch', 'deploy_test', 'deploy_prod', 'merge', 'rollback', 'secret_change'];

// Ações que nunca podem ser allow direto (sempre require_human_review ou block)
const ALWAYS_REVIEW_ACTIONS = ['deploy_prod', 'merge', 'external_integration'];

// ---------------------------------------------------------------------------
// _normalizeActionType
// ---------------------------------------------------------------------------

function _normalizeActionType(actionType) {
  if (typeof actionType !== 'string') return 'unknown';
  const lower = actionType.toLowerCase();
  return VALID_ACTION_TYPES.includes(lower) ? lower : 'unknown';
}

// ---------------------------------------------------------------------------
// _normalizeBlastRadius
// ---------------------------------------------------------------------------

function _normalizeBlastRadius(blastRadius) {
  if (typeof blastRadius !== 'string') return 'unknown';
  const lower = blastRadius.toLowerCase();
  return VALID_BLAST_RADII.includes(lower) ? lower : 'unknown';
}

// ---------------------------------------------------------------------------
// _extractHealthStatus
// ---------------------------------------------------------------------------

/**
 * Extrai o overall_status do Health Snapshot (PR99) ou usa fallback.
 *
 * @param {object} context
 * @returns {string} health_status válido
 */
function _extractHealthStatus(context) {
  const health = context && context.health_snapshot;
  if (!health || typeof health !== 'object') return 'unknown';
  const raw = typeof health.overall_status === 'string' ? health.overall_status.toLowerCase() : '';
  return VALID_HEALTH_STATUSES.includes(raw) ? raw : 'unknown';
}

// ---------------------------------------------------------------------------
// _extractLoopStatus
// ---------------------------------------------------------------------------

/**
 * Extrai o loop_status do contexto (pode vir do Anti-loop ou ser passado diretamente).
 *
 * @param {object} context
 * @returns {string} loop_status válido
 */
function _extractLoopStatus(context) {
  if (!context || typeof context !== 'object') return 'unknown';
  // Aceita loop_status direto ou via anti_loop_result
  const raw =
    (context.loop_status) ||
    (context.anti_loop_result && context.anti_loop_result.loop_status) ||
    'unknown';
  const lower = typeof raw === 'string' ? raw.toLowerCase() : 'unknown';
  return VALID_LOOP_STATUSES.includes(lower) ? lower : 'unknown';
}

// ---------------------------------------------------------------------------
// _extractScopeStatus
// ---------------------------------------------------------------------------

/**
 * Extrai o scope_status do contexto.
 *
 * @param {object} context
 * @returns {string} scope_status válido
 */
function _extractScopeStatus(context) {
  if (!context || typeof context !== 'object') return 'unknown';
  const raw = typeof context.scope_status === 'string' ? context.scope_status.toLowerCase() : 'unknown';
  return VALID_SCOPE_STATUSES.includes(raw) ? raw : 'unknown';
}

// ---------------------------------------------------------------------------
// _hasBlockedInEventLog
// ---------------------------------------------------------------------------

/**
 * Verifica se o Event Log Snapshot indica operações bloqueadas.
 *
 * @param {object} context
 * @returns {boolean}
 */
function _hasBlockedInEventLog(context) {
  const snapshot = context && context.event_log_snapshot;
  if (!snapshot || typeof snapshot !== 'object') return false;
  return (snapshot.blocked_count || 0) > 0;
}

// ---------------------------------------------------------------------------
// _hasRequiresHumanReviewInEventLog
// ---------------------------------------------------------------------------

/**
 * Verifica se o Event Log Snapshot indica requires_human_review.
 *
 * @param {object} context
 * @returns {boolean}
 */
function _hasRequiresHumanReviewInEventLog(context) {
  const snapshot = context && context.event_log_snapshot;
  if (!snapshot || typeof snapshot !== 'object') return false;
  return (snapshot.requires_human_review_count || 0) > 0;
}

// ---------------------------------------------------------------------------
// _extractRollbackHint
// ---------------------------------------------------------------------------

/**
 * Extrai rollback_hint do contexto ou da ação.
 *
 * @param {object} action
 * @param {object} context
 * @returns {string|null}
 */
function _extractRollbackHint(action, context) {
  if (action && typeof action.rollback_hint === 'string' && action.rollback_hint) {
    return action.rollback_hint;
  }
  if (context && typeof context.rollback_hint === 'string' && context.rollback_hint) {
    return context.rollback_hint;
  }
  return null;
}

// ---------------------------------------------------------------------------
// classifyActionRisk
// ---------------------------------------------------------------------------

/**
 * Classifica o nível de risco de uma ação baseado no tipo e contexto.
 * Função pura — sem side effects.
 *
 * @param {object} action - { type, blast_radius?, rollback_hint? }
 * @param {object} context - { health_snapshot?, event_log_snapshot?, scope_status?, loop_status? }
 * @returns {{ risk_level: string, reasons: string[] }}
 */
function classifyActionRisk(action, context) {
  const safeAction = action && typeof action === 'object' ? action : {};
  const safeContext = context && typeof context === 'object' ? context : {};

  const actionType = _normalizeActionType(safeAction.type);
  const blastRadius = _normalizeBlastRadius(safeAction.blast_radius);
  const healthStatus = _extractHealthStatus(safeContext);
  const loopStatus = _extractLoopStatus(safeContext);
  const scopeStatus = _extractScopeStatus(safeContext);
  const rollbackHint = _extractRollbackHint(safeAction, safeContext);
  const hasBlockedEvents = _hasBlockedInEventLog(safeContext);

  const reasons = [];
  let riskScore = 0; // 0=low, 1=medium, 2=high, 3=critical

  // --- Tipo de ação ---
  if (actionType === 'secret_change') {
    riskScore = Math.max(riskScore, 3);
    reasons.push('secret_change é sempre crítico');
  } else if (actionType === 'deploy_prod' || actionType === 'merge') {
    riskScore = Math.max(riskScore, 2);
    reasons.push(`${actionType} exige revisão humana obrigatória`);
  } else if (actionType === 'deploy_test') {
    riskScore = Math.max(riskScore, 1);
    reasons.push('deploy_test é operação de risco médio');
  } else if (actionType === 'patch') {
    riskScore = Math.max(riskScore, 1);
    reasons.push('patch é operação mutável de risco médio');
  } else if (actionType === 'external_integration') {
    riskScore = Math.max(riskScore, 2);
    reasons.push('external_integration exige revisão humana');
  } else if (actionType === 'unknown') {
    riskScore = Math.max(riskScore, 1);
    reasons.push('tipo de ação desconhecido — risco não determinístico');
  }

  // --- Blast radius ---
  if (blastRadius === 'production' || blastRadius === 'external') {
    riskScore = Math.max(riskScore, 2);
    reasons.push(`blast_radius ${blastRadius} eleva risco para high`);
  } else if (blastRadius === 'worker') {
    riskScore = Math.max(riskScore, 1);
    reasons.push('blast_radius worker eleva risco para médio');
  }

  // --- Saúde do sistema ---
  if (healthStatus === 'failed') {
    riskScore = Math.max(riskScore, 3);
    reasons.push('sistema em estado failed — risco crítico');
  } else if (healthStatus === 'blocked') {
    riskScore = Math.max(riskScore, 2);
    reasons.push('sistema bloqueado — risco alto');
  } else if (healthStatus === 'degraded') {
    riskScore = Math.max(riskScore, 1);
    reasons.push('sistema degradado — risco médio');
  }

  // --- Loop status ---
  if (loopStatus === 'destructive_loop') {
    riskScore = Math.max(riskScore, 3);
    reasons.push('loop destrutivo detectado — risco crítico');
  } else if (loopStatus === 'suspicious') {
    riskScore = Math.max(riskScore, 2);
    reasons.push('loop suspeito detectado — risco alto');
  }

  // --- Escopo ---
  if (scopeStatus === 'out_of_scope') {
    riskScore = Math.max(riskScore, 2);
    reasons.push('ação fora de escopo — risco alto');
  }

  // --- Rollback ausente em ação mutável ---
  if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint && actionType !== 'secret_change') {
    riskScore = Math.max(riskScore, 2);
    reasons.push('ação mutável sem rollback_hint — risco alto');
  }

  // --- Event log bloqueado ---
  if (hasBlockedEvents) {
    riskScore = Math.max(riskScore, 1);
    reasons.push('event log contém operações bloqueadas');
  }

  const riskMap = ['low', 'medium', 'high', 'critical'];
  const risk_level = riskMap[Math.min(riskScore, 3)];

  return { risk_level, reasons };
}

// ---------------------------------------------------------------------------
// buildRequiredHumanGates
// ---------------------------------------------------------------------------

/**
 * Determina quais gates humanos são necessários para a ação.
 * Função pura — sem side effects.
 *
 * @param {object} action
 * @param {object} context
 * @returns {string[]} Lista de gates obrigatórios
 */
function buildRequiredHumanGates(action, context) {
  const safeAction = action && typeof action === 'object' ? action : {};
  const safeContext = context && typeof context === 'object' ? context : {};

  const actionType = _normalizeActionType(safeAction.type);
  const healthStatus = _extractHealthStatus(safeContext);
  const loopStatus = _extractLoopStatus(safeContext);
  const scopeStatus = _extractScopeStatus(safeContext);
  const rollbackHint = _extractRollbackHint(safeAction, safeContext);
  const hasBlockedEvents = _hasBlockedInEventLog(safeContext);
  const hasRequiresHumanReview = _hasRequiresHumanReviewInEventLog(safeContext);
  const { risk_level } = classifyActionRisk(action, context);

  const gates = new Set();

  // Ações que sempre exigem aprovação humana
  if (ALWAYS_REVIEW_ACTIONS.includes(actionType)) {
    gates.add('human_approval');
  }

  // secret_change — sempre bloquear, mas gates técnicos também
  if (actionType === 'secret_change') {
    gates.add('human_approval');
    gates.add('security_review');
  }

  // deploy_test com health degradado/failed/blocked
  if (actionType === 'deploy_test' && ['degraded', 'failed', 'blocked'].includes(healthStatus)) {
    gates.add('human_approval');
    gates.add('health_check');
  }

  // Ação fora de escopo
  if (scopeStatus === 'out_of_scope') {
    gates.add('human_approval');
    gates.add('scope_confirmation');
  }

  // Ação mutável sem rollback
  if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint && actionType !== 'secret_change') {
    gates.add('rollback_plan');
  }

  // Health failed — ação mutável
  if (healthStatus === 'failed' && MUTABLE_ACTIONS.includes(actionType)) {
    gates.add('human_approval');
    gates.add('incident_review');
  }

  // Loop detectado
  if (loopStatus === 'destructive_loop') {
    gates.add('human_approval');
    gates.add('loop_investigation');
  } else if (loopStatus === 'suspicious') {
    gates.add('loop_investigation');
  }

  // Event log bloqueado
  if (hasBlockedEvents || hasRequiresHumanReview) {
    gates.add('human_approval');
  }

  // Risco crítico — sempre exige revisão de segurança
  if (risk_level === 'critical') {
    gates.add('human_approval');
    gates.add('security_review');
  }

  return [...gates];
}

// ---------------------------------------------------------------------------
// evaluateSafetyGuard (função principal)
// ---------------------------------------------------------------------------

/**
 * Avalia a segurança de uma ação usando Safety Guard.
 * Função pura — sem side effects.
 *
 * @param {object} action - { type, blast_radius?, rollback_hint?, description? }
 * @param {object} context - { health_snapshot?, event_log_snapshot?, scope_status?, loop_status?, anti_loop_result? }
 * @returns {object} Resultado completo do Safety Guard
 */
function evaluateSafetyGuard(action, context) {
  const safeAction = action && typeof action === 'object' ? action : {};
  const safeContext = context && typeof context === 'object' ? context : {};

  const actionType = _normalizeActionType(safeAction.type);
  const blastRadius = _normalizeBlastRadius(safeAction.blast_radius);
  const healthStatus = _extractHealthStatus(safeContext);
  const loopStatus = _extractLoopStatus(safeContext);
  const scopeStatus = _extractScopeStatus(safeContext);
  const rollbackHint = _extractRollbackHint(safeAction, safeContext);
  const hasBlockedEvents = _hasBlockedInEventLog(safeContext);
  const hasRequiresHumanReview = _hasRequiresHumanReviewInEventLog(safeContext);

  // Classificar risco
  const { risk_level, reasons } = classifyActionRisk(action, context);

  // Determinar gates obrigatórios
  const required_gates = buildRequiredHumanGates(action, context);

  // Construir lista de razões de bloqueio/aviso
  const blockReasons = [...reasons];

  // ---------------------------------------------------------------------------
  // Regras de decisão (em ordem de precedência decrescente)
  // ---------------------------------------------------------------------------

  let decision = 'allow';
  const blocked = [];
  const allowed = [];

  // 1. secret_change — sempre block
  if (actionType === 'secret_change') {
    decision = 'block';
    blocked.push('secret_change é sempre bloqueado pelo Safety Guard');
  }

  // 2. health failed + ação mutável — block
  else if (healthStatus === 'failed' && MUTABLE_ACTIONS.includes(actionType)) {
    decision = 'block';
    blocked.push('sistema em estado failed bloqueia ações mutáveis');
  }

  // 3. loop destrutivo — block para ações mutáveis, require_human_review para leitura
  else if (loopStatus === 'destructive_loop') {
    if (MUTABLE_ACTIONS.includes(actionType)) {
      decision = 'block';
      blocked.push('loop destrutivo bloqueia ações mutáveis');
    } else {
      decision = 'require_human_review';
      blocked.push('loop destrutivo exige revisão humana mesmo para leituras');
    }
  }

  // 4. out_of_scope — block ou require_human_review
  else if (scopeStatus === 'out_of_scope') {
    if (MUTABLE_ACTIONS.includes(actionType) || risk_level === 'critical' || risk_level === 'high') {
      decision = 'block';
      blocked.push('ação fora de escopo com risco alto/crítico — bloqueada');
    } else {
      decision = 'require_human_review';
      blocked.push('ação fora de escopo exige revisão humana');
    }
  }

  // 5. Ações que nunca podem ser allow direto
  else if (ALWAYS_REVIEW_ACTIONS.includes(actionType)) {
    decision = 'require_human_review';
    blocked.push(`${actionType} nunca pode ser allow direto — exige revisão humana`);
  }

  // 6. deploy_test com health degradado/failed/blocked
  else if (actionType === 'deploy_test' && ['degraded', 'failed', 'blocked'].includes(healthStatus)) {
    decision = 'require_human_review';
    blocked.push(`deploy_test com sistema ${healthStatus} exige revisão humana`);
  }

  // 7. Ação mutável sem rollback_hint
  else if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint) {
    decision = 'require_human_review';
    blocked.push('ação mutável sem rollback_hint exige revisão humana');
  }

  // 8. Event log com blocked ou requires_human_review
  else if (hasBlockedEvents || hasRequiresHumanReview) {
    decision = 'require_human_review';
    blocked.push('event log indica operações bloqueadas ou pendentes de revisão humana');
  }

  // 9. Loop suspeito
  else if (loopStatus === 'suspicious') {
    if (MUTABLE_ACTIONS.includes(actionType)) {
      decision = 'require_human_review';
      blocked.push('loop suspeito com ação mutável exige revisão humana');
    } else {
      decision = 'warn';
      allowed.push('ação de leitura permitida com aviso — loop suspeito detectado');
    }
  }

  // 10. Patch com rollback_hint — máximo warn
  else if (actionType === 'patch' && rollbackHint) {
    if (risk_level === 'critical' || risk_level === 'high') {
      decision = 'require_human_review';
      blocked.push('patch com risco alto/crítico exige revisão humana mesmo com rollback_hint');
    } else {
      decision = 'warn';
      allowed.push('patch com rollback_hint disponível — aviso');
    }
  }

  // 11. Tipo desconhecido — warn ou require_human_review, nunca allow cego
  else if (actionType === 'unknown') {
    if (risk_level === 'critical' || risk_level === 'high') {
      decision = 'require_human_review';
      blocked.push('ação desconhecida com risco alto/crítico exige revisão humana');
    } else {
      decision = 'warn';
      allowed.push('ação desconhecida — aviso emitido, nunca allow cego');
    }
  }

  // 12. Ações seguras: read/plan/propose em escopo saudável
  else if (['read', 'plan', 'propose'].includes(actionType)) {
    if (scopeStatus !== 'out_of_scope' && !['failed', 'blocked'].includes(healthStatus)) {
      decision = 'allow';
      allowed.push(`${actionType} em escopo e sistema saudável — permitido`);
    } else {
      decision = 'require_human_review';
      blocked.push(`${actionType} com sistema em estado crítico exige revisão`);
    }
  }

  // 13. Rollback em sistema saudável — warn (rollback sempre precisa de cuidado)
  else if (actionType === 'rollback' && rollbackHint) {
    if (['healthy', 'unknown'].includes(healthStatus)) {
      decision = 'warn';
      allowed.push('rollback com hint disponível — aviso emitido');
    } else {
      decision = 'require_human_review';
      blocked.push('rollback em sistema degradado/failed exige revisão humana');
    }
  } else if (actionType === 'rollback' && !rollbackHint) {
    decision = 'require_human_review';
    blocked.push('rollback sem rollback_hint exige revisão humana');
  }

  // 14. Default conservador
  else {
    if (risk_level === 'low' && scopeStatus === 'in_scope') {
      decision = 'allow';
      allowed.push('ação de baixo risco em escopo — permitida');
    } else {
      decision = 'warn';
      allowed.push('ação não categorizada — aviso emitido');
    }
  }

  // Determinar rollback_required
  const rollback_required = MUTABLE_ACTIONS.includes(actionType) && !rollbackHint;

  // Determinar requires_human_review
  const requires_human_review =
    decision === 'require_human_review' ||
    decision === 'block' ||
    required_gates.includes('human_approval');

  // Construir next_recommended_action
  let next_recommended_action;
  if (decision === 'block') {
    next_recommended_action = 'BLOQUEADO: operação não pode prosseguir. Verifique os motivos e corrija antes de tentar novamente.';
  } else if (decision === 'require_human_review') {
    next_recommended_action = 'Aguardar revisão humana obrigatória antes de prosseguir.';
  } else if (decision === 'warn') {
    next_recommended_action = 'Prosseguir com cautela — aviso ativo. Verificar os motivos antes de continuar.';
  } else {
    next_recommended_action = 'Operação permitida. Monitorar execução e registrar eventos.';
  }

  return {
    ok: true,
    mode: 'safety_guard',
    decision,
    risk_level,
    action_type: actionType,
    allowed,
    blocked,
    requires_human_review,
    reasons: [...new Set([...blockReasons, ...allowed])],
    required_gates,
    evidence: {
      action_type: actionType,
      blast_radius: blastRadius,
      health_status: healthStatus,
      loop_status: loopStatus,
      scope_status: scopeStatus,
      rollback_hint_present: rollbackHint !== null,
      event_log_blocked: hasBlockedEvents,
      event_log_requires_human_review: hasRequiresHumanReview,
    },
    rollback_required,
    rollback_hint: rollbackHint,
    blast_radius: blastRadius,
    scope_status: scopeStatus,
    health_status: healthStatus,
    loop_status: loopStatus,
    next_recommended_action,
  };
}

// ---------------------------------------------------------------------------
// isSafeToExecute
// ---------------------------------------------------------------------------

/**
 * Retorna true somente se a ação pode ser executada sem intervenção humana.
 * Retorna false para block e require_human_review.
 *
 * @param {object} action
 * @param {object} context
 * @returns {boolean}
 */
function isSafeToExecute(action, context) {
  const result = evaluateSafetyGuard(action, context);
  return result.decision === 'allow' || result.decision === 'warn';
}

// ---------------------------------------------------------------------------
// buildSafetyReport
// ---------------------------------------------------------------------------

/**
 * Constrói relatório de segurança a partir do resultado do Safety Guard.
 * Função pura — sem side effects.
 *
 * @param {object} result - Resultado de evaluateSafetyGuard
 * @returns {object}
 */
function buildSafetyReport(result) {
  if (!result || typeof result !== 'object') {
    return {
      ok: false,
      report_type: 'safety_report',
      summary: 'resultado inválido ou ausente',
      decision: 'unknown',
      risk_level: 'unknown',
      reasons: [],
      required_gates: [],
      action_type: 'unknown',
      allowed: false,
      blocked: true,
    };
  }

  const isSafe = result.decision === 'allow';
  const needsReview = result.decision === 'require_human_review';
  const isBlocked = result.decision === 'block';

  let summary;
  if (isBlocked) {
    summary = `[BLOQUEADO] ${result.action_type || 'unknown'} — risco ${result.risk_level || 'unknown'} — ${(result.blocked || []).join('; ')}`;
  } else if (needsReview) {
    summary = `[REVISÃO HUMANA] ${result.action_type || 'unknown'} — risco ${result.risk_level || 'unknown'} — ${(result.blocked || []).join('; ')}`;
  } else if (result.decision === 'warn') {
    summary = `[AVISO] ${result.action_type || 'unknown'} — risco ${result.risk_level || 'unknown'} — ${(result.allowed || []).join('; ')}`;
  } else {
    summary = `[PERMITIDO] ${result.action_type || 'unknown'} — risco ${result.risk_level || 'unknown'} — ${(result.allowed || []).join('; ')}`;
  }

  return {
    ok: true,
    report_type: 'safety_report',
    generated_at: new Date().toISOString(),
    summary,
    decision: result.decision || 'unknown',
    risk_level: result.risk_level || 'unknown',
    action_type: result.action_type || 'unknown',
    allowed: isSafe,
    blocked: isBlocked,
    requires_human_review: result.requires_human_review || false,
    reasons: Array.isArray(result.reasons) ? result.reasons : [],
    required_gates: Array.isArray(result.required_gates) ? result.required_gates : [],
    rollback_required: result.rollback_required || false,
    rollback_hint: result.rollback_hint || null,
    blast_radius: result.blast_radius || 'unknown',
    scope_status: result.scope_status || 'unknown',
    health_status: result.health_status || 'unknown',
    loop_status: result.loop_status || 'unknown',
    evidence: result.evidence || null,
    next_recommended_action: result.next_recommended_action || null,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  evaluateSafetyGuard,
  isSafeToExecute,
  buildSafetyReport,
  classifyActionRisk,
  buildRequiredHumanGates,
  // Constantes exportadas
  VALID_DECISIONS,
  VALID_RISK_LEVELS,
  VALID_ACTION_TYPES,
  VALID_BLAST_RADII,
  VALID_SCOPE_STATUSES,
  VALID_HEALTH_STATUSES,
  VALID_LOOP_STATUSES,
  MUTABLE_ACTIONS,
  ALWAYS_REVIEW_ACTIONS,
};
