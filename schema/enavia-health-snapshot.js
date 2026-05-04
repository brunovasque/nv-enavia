/**
 * enavia-health-snapshot.js — PR99 — Event Log + Health Snapshot Unificado
 *
 * Helper puro para construir Health Snapshot consolidado da Enavia.
 * Sem side effects, sem fetch, sem child_process, sem escrita em KV/banco/arquivo.
 *
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 * PR: PR99 — Event Log + Health Snapshot Unificado
 */

const {
  VALID_SEVERITIES,
  VALID_STATUSES,
  VALID_SUBSYSTEMS,
  filterEnaviaEvents,
  buildEventLogSnapshot,
} = require('./enavia-event-log');

// ---------------------------------------------------------------------------
// Constantes de Health Snapshot
// ---------------------------------------------------------------------------

const VALID_OVERALL_STATUSES = ['healthy', 'degraded', 'failed', 'blocked', 'unknown'];

const VALID_RISK_LEVELS = ['low', 'medium', 'high', 'critical'];

// Subsistemas obrigatórios no snapshot (exceto github_bridge que é futuro/unknown)
const REQUIRED_SUBSYSTEMS = [
  'worker',
  'executor',
  'chat',
  'skill_factory',
  'skill_runner',
  'pr_orchestrator',
  'deploy_loop',
  'self_auditor',
  'safety',
];

// Subsistemas essenciais — falha aqui eleva degraded/failed
const ESSENTIAL_SUBSYSTEMS = ['worker', 'executor', 'chat', 'safety'];

// ---------------------------------------------------------------------------
// evaluateSubsystemHealth
// ---------------------------------------------------------------------------

/**
 * Avalia a saúde de um subsistema baseado nos seus eventos.
 *
 * @param {string} subsystem - Nome do subsistema
 * @param {object[]} events - Todos os eventos (será filtrado pelo subsistema)
 * @param {object} [options]
 * @returns {object} Resultado da saúde do subsistema
 */
function evaluateSubsystemHealth(subsystem, events, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const safeSubsystem = VALID_SUBSYSTEMS.includes(subsystem) ? subsystem : 'unknown';
  const safeEvents = Array.isArray(events) ? events : [];

  // Filtra apenas eventos deste subsistema
  const subsystemEvents = filterEnaviaEvents(safeEvents, { subsystem: safeSubsystem });

  if (subsystemEvents.length === 0) {
    return {
      subsystem: safeSubsystem,
      status: 'unknown',
      risk_level: 'low',
      event_count: 0,
      critical_count: 0,
      failed_count: 0,
      blocked_count: 0,
      requires_human_review: false,
      rollback_hints: [],
      last_event: null,
      notes: 'sem eventos registrados',
    };
  }

  // Contagens por severidade e status
  const critical_count = subsystemEvents.filter((e) => e.severity === 'critical').length;
  const error_count = subsystemEvents.filter((e) => e.severity === 'error').length;
  const failed_count = subsystemEvents.filter((e) => e.status === 'failed').length;
  const blocked_count = subsystemEvents.filter((e) => e.status === 'blocked').length;
  const requires_human_review = subsystemEvents.some((e) => e.requires_human_review === true);

  // Rollback hints únicos do subsistema
  const rollback_hints = [
    ...new Set(
      subsystemEvents
        .filter((e) => typeof e.rollback_hint === 'string' && e.rollback_hint)
        .map((e) => e.rollback_hint)
    ),
  ];

  // Último evento por timestamp
  const last_event = subsystemEvents.reduce((latest, evt) => {
    if (!latest) return evt;
    return evt.timestamp > latest.timestamp ? evt : latest;
  }, null);

  // Derivar status do subsistema
  let status = 'ok';
  if (critical_count > 0 || failed_count > 0) {
    status = 'failed';
  } else if (blocked_count > 0) {
    status = blocked_count > 0 && requires_human_review ? 'blocked' : 'degraded';
  } else if (error_count > 0) {
    status = 'degraded';
  }

  // Derivar risk_level
  let risk_level = 'low';
  if (critical_count > 0) {
    risk_level = 'critical';
  } else if (failed_count > 0) {
    risk_level = 'high';
  } else if (blocked_count > 0 || error_count > 0) {
    risk_level = 'medium';
  }

  return {
    subsystem: safeSubsystem,
    status,
    risk_level,
    event_count: subsystemEvents.length,
    critical_count,
    error_count,
    failed_count,
    blocked_count,
    requires_human_review,
    rollback_hints,
    last_event,
    notes: null,
  };
}

// ---------------------------------------------------------------------------
// deriveOverallHealth
// ---------------------------------------------------------------------------

/**
 * Deriva o status geral de saúde a partir de um mapa de subsistemas avaliados.
 *
 * @param {object} subsystems - Mapa { subsystem_name: evaluationResult }
 * @returns {{ overall_status: string, risk_level: string, degraded_subsystems: string[], failed_subsystems: string[], blocked_operations: string[] }}
 */
function deriveOverallHealth(subsystems) {
  if (!subsystems || typeof subsystems !== 'object') {
    return {
      overall_status: 'unknown',
      risk_level: 'low',
      degraded_subsystems: [],
      failed_subsystems: [],
      blocked_operations: [],
    };
  }

  const degraded_subsystems = [];
  const failed_subsystems = [];
  const blocked_operations = [];

  let has_critical = false;
  let has_failed = false;
  let has_blocked = false;
  let has_degraded = false;

  for (const [name, result] of Object.entries(subsystems)) {
    if (!result || typeof result !== 'object') continue;

    if (result.status === 'failed') {
      failed_subsystems.push(name);
      has_failed = true;
      if (result.critical_count > 0) has_critical = true;
    } else if (result.status === 'blocked') {
      blocked_operations.push(name);
      has_blocked = true;
    } else if (result.status === 'degraded') {
      degraded_subsystems.push(name);
      has_degraded = true;
    }

    if (result.risk_level === 'critical') has_critical = true;
  }

  // Derivar overall_status
  let overall_status = 'healthy';
  if (has_critical || (has_failed && ESSENTIAL_SUBSYSTEMS.some((s) => failed_subsystems.includes(s)))) {
    overall_status = 'failed';
  } else if (has_failed) {
    overall_status = 'degraded';
  } else if (has_blocked) {
    overall_status = 'blocked';
  } else if (has_degraded) {
    overall_status = 'degraded';
  }

  // Derivar risk_level geral
  let risk_level = 'low';
  if (has_critical) {
    risk_level = 'critical';
  } else if (has_failed) {
    risk_level = 'high';
  } else if (has_blocked || has_degraded) {
    risk_level = 'medium';
  }

  return {
    overall_status,
    risk_level,
    degraded_subsystems,
    failed_subsystems,
    blocked_operations,
  };
}

// ---------------------------------------------------------------------------
// buildRollbackHints
// ---------------------------------------------------------------------------

/**
 * Consolida rollback hints de todos os eventos e subsistemas avaliados.
 *
 * @param {object[]} events
 * @param {object} subsystems - Mapa { subsystem_name: evaluationResult }
 * @returns {string[]}
 */
function buildRollbackHints(events, subsystems) {
  const hintsSet = new Set();

  // Hints dos eventos
  const safeEvents = Array.isArray(events) ? events : [];
  for (const evt of safeEvents) {
    if (evt && typeof evt.rollback_hint === 'string' && evt.rollback_hint) {
      hintsSet.add(evt.rollback_hint);
    }
  }

  // Hints dos subsistemas avaliados
  if (subsystems && typeof subsystems === 'object') {
    for (const result of Object.values(subsystems)) {
      if (result && Array.isArray(result.rollback_hints)) {
        for (const hint of result.rollback_hints) {
          if (typeof hint === 'string' && hint) hintsSet.add(hint);
        }
      }
    }
  }

  return [...hintsSet];
}

// ---------------------------------------------------------------------------
// buildHealthEvidence
// ---------------------------------------------------------------------------

/**
 * Constrói objeto de evidência a partir do snapshot de saúde.
 *
 * @param {object} snapshot
 * @returns {object}
 */
function buildHealthEvidence(snapshot) {
  if (!snapshot || typeof snapshot !== 'object') {
    return {
      ok: false,
      evidence_type: 'health_evidence',
      summary: 'snapshot inválido ou ausente',
      event_count: 0,
      subsystem_count: 0,
      critical_subsystems: [],
      failed_subsystems: [],
    };
  }

  const event_summary = snapshot.event_summary || {};
  const subsystems = snapshot.subsystems || {};

  const critical_subsystems = Object.entries(subsystems)
    .filter(([, r]) => r && r.risk_level === 'critical')
    .map(([name]) => name);

  const failed_subs = Array.isArray(snapshot.failed_subsystems) ? snapshot.failed_subsystems : [];

  return {
    ok: true,
    evidence_type: 'health_evidence',
    generated_at: snapshot.generated_at || new Date().toISOString(),
    overall_status: snapshot.overall_status || 'unknown',
    risk_level: snapshot.risk_level || 'low',
    summary: `Snapshot de saúde: ${snapshot.overall_status || 'unknown'} — risco ${snapshot.risk_level || 'low'} — ${event_summary.total_events || 0} eventos registrados`,
    event_count: event_summary.total_events || 0,
    subsystem_count: Object.keys(subsystems).length,
    critical_subsystems,
    failed_subsystems: failed_subs,
    blocked_operations: Array.isArray(snapshot.blocked_operations) ? snapshot.blocked_operations : [],
    requires_human_review: snapshot.requires_human_review === true,
    rollback_hints: Array.isArray(snapshot.rollback_hints) ? snapshot.rollback_hints : [],
  };
}

// ---------------------------------------------------------------------------
// buildHealthSnapshot (função principal)
// ---------------------------------------------------------------------------

/**
 * Constrói Health Snapshot consolidado da Enavia a partir de uma lista de eventos.
 *
 * @param {object} input
 *   - events: object[] — lista de eventos Enavia (pode ser vazia)
 *   - label: string (opcional)
 * @param {object} [options]
 *   - include_github_bridge: boolean (padrão false)
 * @returns {object}
 */
function buildHealthSnapshot(input, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const safeInput = input && typeof input === 'object' ? input : {};
  const events = Array.isArray(safeInput.events) ? safeInput.events : [];

  // Subsistemas a cobrir
  const subsystemsToEvaluate = [...REQUIRED_SUBSYSTEMS];
  if (opts.include_github_bridge) {
    subsystemsToEvaluate.push('github_bridge');
  }

  // Avaliar cada subsistema
  const subsystems = {};
  for (const sub of subsystemsToEvaluate) {
    subsystems[sub] = evaluateSubsystemHealth(sub, events, opts);
  }

  // github_bridge aparece como future/unknown mesmo se não incluso explicitamente
  if (!opts.include_github_bridge) {
    subsystems.github_bridge = {
      subsystem: 'github_bridge',
      status: 'unknown',
      risk_level: 'low',
      event_count: 0,
      critical_count: 0,
      failed_count: 0,
      blocked_count: 0,
      requires_human_review: false,
      rollback_hints: [],
      last_event: null,
      notes: 'future/unknown — não implementado ainda',
    };
  }

  // Derivar saúde geral
  const overallHealth = deriveOverallHealth(subsystems);

  // Event log snapshot
  const event_summary = buildEventLogSnapshot(events, { label: safeInput.label || null });

  // Rollback hints consolidados
  const rollback_hints = buildRollbackHints(events, subsystems);

  // requires_human_review global
  const requires_human_review =
    events.some((e) => e && e.requires_human_review === true) ||
    Object.values(subsystems).some((s) => s && s.requires_human_review === true);

  // next_recommended_action
  let next_recommended_action = 'Nenhuma ação imediata necessária — sistema saudável.';
  if (overallHealth.overall_status === 'failed') {
    next_recommended_action =
      'AÇÃO URGENTE: subsistema(s) em falha crítica. Revisar logs e executar rollback se necessário.';
  } else if (requires_human_review) {
    next_recommended_action =
      'Revisão humana necessária: operação(ões) bloqueada(s) aguardando aprovação.';
  } else if (overallHealth.overall_status === 'blocked') {
    next_recommended_action =
      'Operação bloqueada. Aguardar resolução ou aprovação humana antes de prosseguir.';
  } else if (overallHealth.overall_status === 'degraded') {
    next_recommended_action =
      'Sistema degradado. Monitorar subsistemas afetados e avaliar correção antes de avançar.';
  }

  return {
    ok: true,
    mode: 'health_snapshot',
    label: safeInput.label || null,
    generated_at: new Date().toISOString(),
    overall_status: overallHealth.overall_status,
    risk_level: overallHealth.risk_level,
    subsystems,
    event_summary,
    rollback_hints,
    evidence: buildHealthEvidence({
      ...overallHealth,
      generated_at: new Date().toISOString(),
      event_summary,
      subsystems,
      requires_human_review,
    }),
    requires_human_review,
    degraded_subsystems: overallHealth.degraded_subsystems,
    failed_subsystems: overallHealth.failed_subsystems,
    blocked_operations: overallHealth.blocked_operations,
    next_recommended_action,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  buildHealthSnapshot,
  evaluateSubsystemHealth,
  deriveOverallHealth,
  buildRollbackHints,
  buildHealthEvidence,
  // Constantes exportadas
  VALID_OVERALL_STATUSES,
  VALID_RISK_LEVELS,
  REQUIRED_SUBSYSTEMS,
  ESSENTIAL_SUBSYSTEMS,
};
