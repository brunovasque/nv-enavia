/**
 * enavia-event-log.js — PR99 — Event Log + Health Snapshot Unificado
 *
 * Helper puro para consolidar eventos operacionais da Enavia.
 * Sem side effects, sem fetch, sem child_process, sem escrita em KV/banco/arquivo.
 *
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 * PR: PR99 — Event Log + Health Snapshot Unificado
 */

// ---------------------------------------------------------------------------
// Constantes de validação
// ---------------------------------------------------------------------------

const VALID_SEVERITIES = ['info', 'warning', 'error', 'critical'];

const VALID_STATUSES = ['ok', 'degraded', 'failed', 'blocked', 'pending', 'unknown'];

const VALID_SUBSYSTEMS = [
  'worker',
  'executor',
  'chat',
  'skill_factory',
  'skill_runner',
  'pr_orchestrator',
  'deploy_loop',
  'self_auditor',
  'safety',
  'github_bridge',
  'unknown',
];

// ---------------------------------------------------------------------------
// Gerador de event_id estável (determinístico)
// ---------------------------------------------------------------------------

/**
 * Gera um event_id estável a partir de timestamp, source, type e message.
 * Não usa crypto real — usa hash simples por XOR de charCode, suficiente para
 * identificação determinística em helper puro sem dependências externas.
 *
 * @param {string} timestamp
 * @param {string} source
 * @param {string} type
 * @param {string} message
 * @returns {string}
 */
function _generateEventId(timestamp, source, type, message) {
  const raw = `${timestamp}|${source}|${type}|${message}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) >>> 0;
  }
  return `evt_${hash.toString(16).padStart(8, '0')}`;
}

// ---------------------------------------------------------------------------
// createEnaviaEvent
// ---------------------------------------------------------------------------

/**
 * Cria um evento Enavia normalizado com campos mínimos garantidos.
 *
 * @param {object} input
 * @returns {{ ok: boolean, event?: object, error?: string }}
 */
function createEnaviaEvent(input) {
  if (!input || typeof input !== 'object') {
    return { ok: false, error: 'input inválido: deve ser um objeto' };
  }

  const now = new Date().toISOString();
  const timestamp = typeof input.timestamp === 'string' && input.timestamp ? input.timestamp : now;
  const source = typeof input.source === 'string' && input.source ? input.source : 'unknown';
  const type = typeof input.type === 'string' && input.type ? input.type : 'unknown';
  const message = typeof input.message === 'string' ? input.message : '';

  // severity: normaliza ou fallback para warning
  const rawSeverity = typeof input.severity === 'string' ? input.severity.toLowerCase() : '';
  const severity = VALID_SEVERITIES.includes(rawSeverity) ? rawSeverity : 'warning';
  const severity_normalized = !VALID_SEVERITIES.includes(
    typeof input.severity === 'string' ? input.severity.toLowerCase() : ''
  );

  // status: normaliza ou fallback para unknown
  const rawStatus = typeof input.status === 'string' ? input.status.toLowerCase() : '';
  const status = VALID_STATUSES.includes(rawStatus) ? rawStatus : 'unknown';
  const status_normalized = !VALID_STATUSES.includes(
    typeof input.status === 'string' ? input.status.toLowerCase() : ''
  );

  // subsystem: normaliza ou fallback para unknown
  const rawSubsystem = typeof input.subsystem === 'string' ? input.subsystem.toLowerCase() : '';
  const subsystem = VALID_SUBSYSTEMS.includes(rawSubsystem) ? rawSubsystem : 'unknown';

  // event_id: determinístico se fornecido, senão gera
  const event_id =
    typeof input.event_id === 'string' && input.event_id
      ? input.event_id
      : _generateEventId(timestamp, source, type, message);

  const event = {
    event_id,
    timestamp,
    source,
    subsystem,
    type,
    severity,
    status,
    execution_id: typeof input.execution_id === 'string' ? input.execution_id : null,
    contract_id: typeof input.contract_id === 'string' ? input.contract_id : null,
    correlation_id: typeof input.correlation_id === 'string' ? input.correlation_id : null,
    message,
    evidence: input.evidence !== undefined ? input.evidence : null,
    rollback_hint: typeof input.rollback_hint === 'string' ? input.rollback_hint : null,
    requires_human_review: input.requires_human_review === true,
    metadata: input.metadata && typeof input.metadata === 'object' ? { ...input.metadata } : {},
    _normalized: {
      severity: severity_normalized,
      status: status_normalized,
      subsystem: subsystem !== rawSubsystem || !rawSubsystem,
    },
  };

  return { ok: true, event };
}

// ---------------------------------------------------------------------------
// appendEnaviaEvent
// ---------------------------------------------------------------------------

/**
 * Adiciona um evento a uma lista imutável de eventos.
 * Não muta o array original.
 *
 * @param {object[]} events - Array original (não mutado)
 * @param {object} event - Evento a adicionar
 * @returns {object[]} Novo array com o evento adicionado
 */
function appendEnaviaEvent(events, event) {
  if (!Array.isArray(events)) {
    return [event];
  }
  return [...events, event];
}

// ---------------------------------------------------------------------------
// normalizeEnaviaEvents
// ---------------------------------------------------------------------------

/**
 * Normaliza uma lista de eventos, criando eventos válidos a partir de entradas
 * que podem estar parcialmente preenchidas.
 *
 * @param {any[]} events
 * @returns {{ ok: boolean, events: object[], errors: string[] }}
 */
function normalizeEnaviaEvents(events) {
  if (!Array.isArray(events)) {
    return { ok: false, events: [], errors: ['events deve ser um array'] };
  }

  const normalized = [];
  const errors = [];

  for (let i = 0; i < events.length; i++) {
    const item = events[i];
    if (item && typeof item === 'object' && item.event_id && item.timestamp) {
      // Evento já parece válido — apenas normaliza campos faltantes
      const result = createEnaviaEvent(item);
      if (result.ok) {
        normalized.push(result.event);
      } else {
        errors.push(`[${i}]: ${result.error}`);
        // Inclui fallback mínimo
        normalized.push({
          event_id: `evt_fallback_${i}`,
          timestamp: new Date().toISOString(),
          source: 'unknown',
          subsystem: 'unknown',
          type: 'unknown',
          severity: 'warning',
          status: 'unknown',
          execution_id: null,
          contract_id: null,
          correlation_id: null,
          message: '',
          evidence: null,
          rollback_hint: null,
          requires_human_review: false,
          metadata: {},
          _normalized: { severity: true, status: true, subsystem: true },
        });
      }
    } else {
      const result = createEnaviaEvent(item || {});
      if (result.ok) {
        normalized.push(result.event);
      } else {
        errors.push(`[${i}]: ${result.error}`);
      }
    }
  }

  return { ok: errors.length === 0, events: normalized, errors };
}

// ---------------------------------------------------------------------------
// filterEnaviaEvents
// ---------------------------------------------------------------------------

/**
 * Filtra eventos por critérios opcionais.
 *
 * @param {object[]} events
 * @param {{ subsystem?: string, severity?: string, status?: string, type?: string, source?: string, requires_human_review?: boolean }} filters
 * @returns {object[]}
 */
function filterEnaviaEvents(events, filters) {
  if (!Array.isArray(events)) return [];
  if (!filters || typeof filters !== 'object') return [...events];

  return events.filter((evt) => {
    if (!evt || typeof evt !== 'object') return false;

    if (filters.subsystem !== undefined && evt.subsystem !== filters.subsystem) return false;
    if (filters.severity !== undefined && evt.severity !== filters.severity) return false;
    if (filters.status !== undefined && evt.status !== filters.status) return false;
    if (filters.type !== undefined && evt.type !== filters.type) return false;
    if (filters.source !== undefined && evt.source !== filters.source) return false;
    if (
      filters.requires_human_review !== undefined &&
      evt.requires_human_review !== filters.requires_human_review
    )
      return false;

    return true;
  });
}

// ---------------------------------------------------------------------------
// buildEventLogSnapshot
// ---------------------------------------------------------------------------

/**
 * Constrói snapshot consolidado de uma lista de eventos.
 *
 * @param {object[]} events
 * @param {{ label?: string }} options
 * @returns {object}
 */
function buildEventLogSnapshot(events, options) {
  const opts = options && typeof options === 'object' ? options : {};
  const safeEvents = Array.isArray(events) ? events.filter((e) => e && typeof e === 'object') : [];

  const total_events = safeEvents.length;

  // by_severity
  const by_severity = { info: 0, warning: 0, error: 0, critical: 0 };
  for (const evt of safeEvents) {
    const sev = VALID_SEVERITIES.includes(evt.severity) ? evt.severity : 'warning';
    by_severity[sev] = (by_severity[sev] || 0) + 1;
  }

  // by_status
  const by_status = {};
  for (const s of VALID_STATUSES) by_status[s] = 0;
  for (const evt of safeEvents) {
    const st = VALID_STATUSES.includes(evt.status) ? evt.status : 'unknown';
    by_status[st] = (by_status[st] || 0) + 1;
  }

  // by_subsystem
  const by_subsystem = {};
  for (const sub of VALID_SUBSYSTEMS) by_subsystem[sub] = 0;
  for (const evt of safeEvents) {
    const sub = VALID_SUBSYSTEMS.includes(evt.subsystem) ? evt.subsystem : 'unknown';
    by_subsystem[sub] = (by_subsystem[sub] || 0) + 1;
  }

  // latest_event
  let latest_event = null;
  if (safeEvents.length > 0) {
    latest_event = safeEvents.reduce((latest, evt) => {
      if (!latest) return evt;
      return evt.timestamp > latest.timestamp ? evt : latest;
    }, null);
  }

  // contagens derivadas
  const critical_count = by_severity.critical || 0;
  const failed_count = by_status.failed || 0;
  const blocked_count = by_status.blocked || 0;
  const requires_human_review_count = safeEvents.filter((e) => e.requires_human_review === true)
    .length;

  // rollback_hints consolidados (únicos, non-null)
  const rollback_hints = [
    ...new Set(
      safeEvents
        .filter((e) => typeof e.rollback_hint === 'string' && e.rollback_hint)
        .map((e) => e.rollback_hint)
    ),
  ];

  return {
    ok: true,
    mode: 'event_log_snapshot',
    label: opts.label || null,
    generated_at: new Date().toISOString(),
    total_events,
    by_severity,
    by_status,
    by_subsystem,
    latest_event,
    critical_count,
    failed_count,
    blocked_count,
    requires_human_review_count,
    rollback_hints,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  createEnaviaEvent,
  appendEnaviaEvent,
  normalizeEnaviaEvents,
  filterEnaviaEvents,
  buildEventLogSnapshot,
  // Constantes exportadas para uso nos testes e helpers internos
  VALID_SEVERITIES,
  VALID_STATUSES,
  VALID_SUBSYSTEMS,
};
