/**
 * enavia-anti-loop.js — PR100 — Safety Guard / Anti-autodestruição
 *
 * Helper puro de detecção de loops destrutivos da Enavia.
 * Analisa eventos do Event Log (PR99) para detectar padrões de repetição perigosa.
 *
 * Sem side effects, sem fetch, sem child_process, sem escrita em KV/banco/arquivo.
 * Não depende de relógio real — usa apenas timestamps dos eventos.
 *
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 * PR: PR100 — Safety Guard / Anti-autodestruição
 */

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

// Limites padrão de detecção de loop
const DEFAULT_MAX_CONSECUTIVE_FAILURES = 3;
const DEFAULT_MAX_RETRY_COUNT = 5;
const DEFAULT_WINDOW_SIZE = 10; // últimos N eventos para análise
const DEFAULT_ROLLBACK_APPLY_PATTERN_THRESHOLD = 2; // quantas vezes rollback→apply repetido
const DEFAULT_FAILED_BLOCKED_RATIO = 0.5; // 50% de falhas/bloqueios = suspeito

const VALID_LOOP_STATUSES = ['clear', 'suspicious', 'destructive_loop', 'unknown'];

// ---------------------------------------------------------------------------
// _safeEvents
// ---------------------------------------------------------------------------

/**
 * Garante array de eventos válidos (objetos não-nulos).
 *
 * @param {any} events
 * @returns {object[]}
 */
function _safeEvents(events) {
  if (!Array.isArray(events)) return [];
  return events.filter((e) => e && typeof e === 'object');
}

// ---------------------------------------------------------------------------
// _countConsecutiveFailures
// ---------------------------------------------------------------------------

/**
 * Conta quantas vezes consecutivas a mesma ação/tipo falhou no final do array.
 *
 * @param {object[]} events
 * @returns {number}
 */
function _countConsecutiveFailures(events) {
  if (events.length === 0) return 0;

  let count = 0;
  for (let i = events.length - 1; i >= 0; i--) {
    const evt = events[i];
    if (evt.status === 'failed' || evt.severity === 'error' || evt.severity === 'critical') {
      count++;
    } else {
      break;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// _detectRollbackApplyPattern
// ---------------------------------------------------------------------------

/**
 * Detecta padrão rollback → apply → rollback repetido nos eventos.
 * Considera tipos de evento como 'rollback', 'apply', 'deploy', 'patch'.
 *
 * @param {object[]} events
 * @returns {{ found: boolean, count: number }}
 */
function _detectRollbackApplyPattern(events) {
  if (events.length < 3) return { found: false, count: 0 };

  let patternCount = 0;
  let i = 0;

  while (i < events.length - 2) {
    const e1 = events[i];
    const e2 = events[i + 1];
    const e3 = events[i + 2];

    const isRollback = (e) =>
      typeof e.type === 'string' && e.type.toLowerCase().includes('rollback');
    const isApply = (e) =>
      typeof e.type === 'string' &&
      (e.type.toLowerCase().includes('apply') ||
        e.type.toLowerCase().includes('deploy') ||
        e.type.toLowerCase().includes('patch'));

    if (isRollback(e1) && isApply(e2) && isRollback(e3)) {
      patternCount++;
      i += 3; // avança depois do padrão para evitar dupla contagem
    } else {
      i++;
    }
  }

  return { found: patternCount > 0, count: patternCount };
}

// ---------------------------------------------------------------------------
// _countRetries
// ---------------------------------------------------------------------------

/**
 * Conta eventos que são claramente retries (tipo contém 'retry' ou metadata.retry_count).
 *
 * @param {object[]} events
 * @returns {number}
 */
function _countRetries(events) {
  let total = 0;
  for (const evt of events) {
    if (typeof evt.type === 'string' && evt.type.toLowerCase().includes('retry')) {
      // Se metadata.retry_count disponível, usa o valor; senão incrementa 1 por evento
      const metaCount =
        evt.metadata && typeof evt.metadata.retry_count === 'number'
          ? evt.metadata.retry_count
          : 1;
      total = Math.max(total, metaCount);
    } else if (evt.metadata && typeof evt.metadata.retry_count === 'number') {
      total = Math.max(total, evt.metadata.retry_count);
    }
  }
  return total;
}

// ---------------------------------------------------------------------------
// _countFailedBlocked
// ---------------------------------------------------------------------------

/**
 * Conta eventos com status failed ou blocked, ou severity error/critical.
 *
 * @param {object[]} events
 * @returns {number}
 */
function _countFailedBlocked(events) {
  return events.filter(
    (e) =>
      e.status === 'failed' ||
      e.status === 'blocked' ||
      e.severity === 'error' ||
      e.severity === 'critical'
  ).length;
}

// ---------------------------------------------------------------------------
// _detectRepeatedSameActionFailures
// ---------------------------------------------------------------------------

/**
 * Detecta se a mesma ação (mesmo type + source) falhou várias vezes.
 *
 * @param {object[]} events
 * @param {number} threshold
 * @returns {{ found: boolean, action: string|null, count: number }}
 */
function _detectRepeatedSameActionFailures(events, threshold) {
  const failureMap = {};

  for (const evt of events) {
    if (evt.status === 'failed' || evt.severity === 'error' || evt.severity === 'critical') {
      const key = `${evt.type || 'unknown'}::${evt.source || 'unknown'}`;
      failureMap[key] = (failureMap[key] || 0) + 1;
    }
  }

  let maxCount = 0;
  let maxAction = null;
  for (const [action, count] of Object.entries(failureMap)) {
    if (count > maxCount) {
      maxCount = count;
      maxAction = action;
    }
  }

  return {
    found: maxCount >= threshold,
    action: maxAction,
    count: maxCount,
  };
}

// ---------------------------------------------------------------------------
// detectDestructiveLoop (função principal)
// ---------------------------------------------------------------------------

/**
 * Detecta padrões de loop destrutivo em uma lista de eventos.
 * Função pura — usa apenas os timestamps dos eventos, sem relógio real.
 *
 * @param {object[]} events - Lista de eventos Enavia (pode ser do Event Log PR99)
 * @param {object} [options]
 *   - max_consecutive_failures: number (padrão: 3)
 *   - max_retry_count: number (padrão: 5)
 *   - window_size: number (padrão: 10)
 *   - rollback_apply_pattern_threshold: number (padrão: 2)
 *   - failed_blocked_ratio: number (padrão: 0.5)
 * @returns {object} Resultado da análise de loop
 */
function detectDestructiveLoop(events, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const maxConsecutiveFailures = typeof opts.max_consecutive_failures === 'number'
    ? opts.max_consecutive_failures
    : DEFAULT_MAX_CONSECUTIVE_FAILURES;
  const maxRetryCount = typeof opts.max_retry_count === 'number'
    ? opts.max_retry_count
    : DEFAULT_MAX_RETRY_COUNT;
  const windowSize = typeof opts.window_size === 'number'
    ? opts.window_size
    : DEFAULT_WINDOW_SIZE;
  const rollbackApplyThreshold = typeof opts.rollback_apply_pattern_threshold === 'number'
    ? opts.rollback_apply_pattern_threshold
    : DEFAULT_ROLLBACK_APPLY_PATTERN_THRESHOLD;
  const failedBlockedRatioThreshold = typeof opts.failed_blocked_ratio === 'number'
    ? opts.failed_blocked_ratio
    : DEFAULT_FAILED_BLOCKED_RATIO;

  const safeEvts = _safeEvents(events);

  // Janela de análise — últimos N eventos
  const windowEvents = safeEvts.slice(-windowSize);

  if (windowEvents.length === 0) {
    return {
      ok: true,
      loop_status: 'clear',
      total_events_analyzed: 0,
      window_size: windowSize,
      consecutive_failures: 0,
      retry_count: 0,
      rollback_apply_pattern: { found: false, count: 0 },
      failed_blocked_count: 0,
      failed_blocked_ratio: 0,
      repeated_same_action_failures: { found: false, action: null, count: 0 },
      triggers: [],
      recommendations: ['Nenhum evento — sistema sem histórico detectável'],
    };
  }

  // --- Contagens e padrões ---
  const consecutiveFailures = _countConsecutiveFailures(windowEvents);
  const retryCount = _countRetries(windowEvents);
  const rollbackApplyPattern = _detectRollbackApplyPattern(windowEvents);
  const failedBlockedCount = _countFailedBlocked(windowEvents);
  const failedBlockedRatio = windowEvents.length > 0
    ? failedBlockedCount / windowEvents.length
    : 0;
  const repeatedSameActionFailures = _detectRepeatedSameActionFailures(
    windowEvents,
    maxConsecutiveFailures
  );

  // --- Determinar loop_status ---
  const triggers = [];
  let isDestructive = false;
  let isSuspicious = false;

  if (consecutiveFailures >= maxConsecutiveFailures) {
    triggers.push(`${consecutiveFailures} falhas consecutivas (limite: ${maxConsecutiveFailures})`);
    isDestructive = true;
  }

  if (rollbackApplyPattern.found && rollbackApplyPattern.count >= rollbackApplyThreshold) {
    triggers.push(`padrão rollback→apply→rollback repetido ${rollbackApplyPattern.count}x (limite: ${rollbackApplyThreshold})`);
    isDestructive = true;
  } else if (rollbackApplyPattern.found) {
    triggers.push(`padrão rollback→apply→rollback detectado ${rollbackApplyPattern.count}x`);
    isSuspicious = true;
  }

  if (retryCount >= maxRetryCount) {
    triggers.push(`${retryCount} retries acima do limite (${maxRetryCount})`);
    isDestructive = true;
  }

  if (failedBlockedRatio >= failedBlockedRatioThreshold && windowEvents.length >= 3) {
    triggers.push(`${Math.round(failedBlockedRatio * 100)}% de eventos failed/blocked (limite: ${Math.round(failedBlockedRatioThreshold * 100)}%)`);
    if (failedBlockedRatio >= 0.7) {
      isDestructive = true;
    } else {
      isSuspicious = true;
    }
  }

  if (repeatedSameActionFailures.found) {
    triggers.push(`ação "${repeatedSameActionFailures.action}" falhou ${repeatedSameActionFailures.count}x repetidamente`);
    isDestructive = true;
  }

  let loop_status = 'clear';
  if (isDestructive) {
    loop_status = 'destructive_loop';
  } else if (isSuspicious) {
    loop_status = 'suspicious';
  }

  // Recomendações
  const recommendations = [];
  if (loop_status === 'destructive_loop') {
    recommendations.push('PAUSE IMEDIATO: loop destrutivo detectado — aguardar revisão humana');
    recommendations.push('Não executar novas ações mutáveis até resolução');
  } else if (loop_status === 'suspicious') {
    recommendations.push('Monitorar próximas ações com atenção redobrada');
    recommendations.push('Considerar revisão humana antes de ações mutáveis');
  } else {
    recommendations.push('Nenhum loop detectado — operação dentro dos limites normais');
  }

  return {
    ok: true,
    loop_status,
    total_events_analyzed: windowEvents.length,
    window_size: windowSize,
    consecutive_failures: consecutiveFailures,
    retry_count: retryCount,
    rollback_apply_pattern: rollbackApplyPattern,
    failed_blocked_count: failedBlockedCount,
    failed_blocked_ratio: Math.round(failedBlockedRatio * 1000) / 1000,
    repeated_same_action_failures: repeatedSameActionFailures,
    triggers,
    recommendations,
  };
}

// ---------------------------------------------------------------------------
// getLoopSafetyStatus
// ---------------------------------------------------------------------------

/**
 * Retorna apenas o loop_status derivado dos eventos.
 * Wrapper simplificado de detectDestructiveLoop.
 *
 * @param {object[]} events
 * @param {object} [options]
 * @returns {string} loop_status: 'clear' | 'suspicious' | 'destructive_loop' | 'unknown'
 */
function getLoopSafetyStatus(events, options) {
  if (!Array.isArray(events)) return 'unknown';
  const result = detectDestructiveLoop(events, options);
  if (!result || !result.ok) return 'unknown';
  return result.loop_status || 'unknown';
}

// ---------------------------------------------------------------------------
// buildLoopEvidence
// ---------------------------------------------------------------------------

/**
 * Constrói objeto de evidência a partir do resultado de detectDestructiveLoop.
 * Função pura — sem side effects.
 *
 * @param {object} loopResult - Resultado de detectDestructiveLoop
 * @returns {object}
 */
function buildLoopEvidence(loopResult) {
  if (!loopResult || typeof loopResult !== 'object') {
    return {
      ok: false,
      evidence_type: 'loop_evidence',
      summary: 'resultado de loop inválido ou ausente',
      loop_status: 'unknown',
      triggers: [],
    };
  }

  const loopStatus = loopResult.loop_status || 'unknown';
  const triggers = Array.isArray(loopResult.triggers) ? loopResult.triggers : [];

  let summary;
  if (loopStatus === 'destructive_loop') {
    summary = `LOOP DESTRUTIVO detectado — ${triggers.length} gatilho(s): ${triggers.join('; ')}`;
  } else if (loopStatus === 'suspicious') {
    summary = `Loop suspeito — ${triggers.length} gatilho(s): ${triggers.join('; ')}`;
  } else if (loopStatus === 'clear') {
    summary = `Sistema sem loop — ${loopResult.total_events_analyzed || 0} eventos analisados na janela`;
  } else {
    summary = 'Status de loop desconhecido';
  }

  return {
    ok: true,
    evidence_type: 'loop_evidence',
    loop_status: loopStatus,
    summary,
    total_events_analyzed: loopResult.total_events_analyzed || 0,
    window_size: loopResult.window_size || DEFAULT_WINDOW_SIZE,
    triggers,
    consecutive_failures: loopResult.consecutive_failures || 0,
    retry_count: loopResult.retry_count || 0,
    rollback_apply_pattern: loopResult.rollback_apply_pattern || { found: false, count: 0 },
    failed_blocked_count: loopResult.failed_blocked_count || 0,
    failed_blocked_ratio: loopResult.failed_blocked_ratio || 0,
    repeated_same_action_failures: loopResult.repeated_same_action_failures || { found: false, action: null, count: 0 },
    recommendations: Array.isArray(loopResult.recommendations) ? loopResult.recommendations : [],
    should_pause: loopStatus === 'destructive_loop',
  };
}

// ---------------------------------------------------------------------------
// shouldPauseForLoopSafety
// ---------------------------------------------------------------------------

/**
 * Retorna true se o Safety Guard deve pausar operações dado o resultado do loop.
 *
 * @param {object} loopResult - Resultado de detectDestructiveLoop
 * @returns {boolean}
 */
function shouldPauseForLoopSafety(loopResult) {
  if (!loopResult || typeof loopResult !== 'object') return false;
  return loopResult.loop_status === 'destructive_loop';
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  detectDestructiveLoop,
  getLoopSafetyStatus,
  buildLoopEvidence,
  shouldPauseForLoopSafety,
  // Constantes exportadas
  VALID_LOOP_STATUSES,
  DEFAULT_MAX_CONSECUTIVE_FAILURES,
  DEFAULT_MAX_RETRY_COUNT,
  DEFAULT_WINDOW_SIZE,
  DEFAULT_ROLLBACK_APPLY_PATTERN_THRESHOLD,
  DEFAULT_FAILED_BLOCKED_RATIO,
};
