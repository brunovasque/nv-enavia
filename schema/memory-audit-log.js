// ============================================================================
// 📦 ENAVIA — Memory Audit Log v1 (PR6 — Telemetria / Auditoria da Memória)
//
// Trilha de auditoria mínima e contratual para eventos da memória e do
// aprendizado controlado.
//
// Responsabilidades:
//   - emitAuditEvent(event, env) — registra evento auditável no KV
//   - listAuditEvents(filters, env) — consulta eventos com filtros simples
//   - getAuditEventById(event_id, env) — lê um evento pelo id
//
// Armazenamento:
//   KV key: audit:memory:<event_id>  → objeto JSON do evento
//   KV key: audit:memory:index       → array de event_id (ordenado por inserção)
//
// Estrutura de cada evento:
//   event_id       — string única
//   event_type     — tipo do evento (memory_created, memory_updated, etc.)
//   target_type    — "memory" | "learning_candidate"
//   target_id      — id da memória ou candidato afetado
//   related_id     — id relacionado (ex: candidate_id ↔ promoted_memory_id)
//   source         — origem/ator do evento (ex: "panel", "runtime", "system")
//   summary        — resumo curto do que ocorreu
//   timestamp      — ISO 8601
//
// Eventos rastreados:
//   memory_created           — memória criada via writeMemory
//   memory_updated           — memória atualizada via updateMemory
//   memory_blocked           — memória bloqueada via blockMemory
//   memory_invalidated       — memória invalidada/expirada via invalidateMemory
//   candidate_registered     — candidato de aprendizado registrado
//   candidate_approved       — candidato aprovado + promoted_memory_id
//   candidate_rejected       — candidato rejeitado
//
// Regras:
//   - Emissão é fire-and-forget (try/catch) — nunca quebra o fluxo principal
//   - Sem persistência pesada, sem analytics, sem dashboard gigante
//   - Contrato PR6 APENAS — não misturar com PR7+
//
// NÃO contém:
//   - métricas sofisticadas / analytics
//   - telemetria de runtime/executor
//   - observabilidade pesada
//   - dashboards ou aggregations
// ============================================================================

// ---------------------------------------------------------------------------
// KV Key Helpers
// ---------------------------------------------------------------------------
const KV_PREFIX = "audit:memory:";
const KV_INDEX_KEY = "audit:memory:index";

function _eventKey(event_id) {
  return `${KV_PREFIX}${event_id}`;
}

async function _readIndex(env) {
  const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}

async function _writeIndex(index, env) {
  await env.ENAVIA_BRAIN.put(KV_INDEX_KEY, JSON.stringify(index));
}

// ---------------------------------------------------------------------------
// AUDIT_EVENT_TYPES — tipos canônicos de evento de auditoria
// ---------------------------------------------------------------------------
const AUDIT_EVENT_TYPES = {
  MEMORY_CREATED:        "memory_created",
  MEMORY_UPDATED:        "memory_updated",
  MEMORY_BLOCKED:        "memory_blocked",
  MEMORY_INVALIDATED:    "memory_invalidated",
  CANDIDATE_REGISTERED:  "candidate_registered",
  CANDIDATE_APPROVED:    "candidate_approved",
  CANDIDATE_REJECTED:    "candidate_rejected",
};

// ---------------------------------------------------------------------------
// AUDIT_TARGET_TYPES — tipos canônicos de alvo
// ---------------------------------------------------------------------------
const AUDIT_TARGET_TYPES = {
  MEMORY:              "memory",
  LEARNING_CANDIDATE:  "learning_candidate",
};

// ---------------------------------------------------------------------------
// emitAuditEvent(event, env)
//
// Registra um evento de auditoria no KV. Fire-and-forget: se falhar, não
// quebra o fluxo chamador.
//
// event:
//   event_type     {string} — obrigatório (AUDIT_EVENT_TYPES)
//   target_type    {string} — obrigatório (AUDIT_TARGET_TYPES)
//   target_id      {string} — obrigatório
//   related_id     {string|null} — opcional
//   source         {string} — obrigatório
//   summary        {string} — obrigatório
//
// Returns:
//   { ok: true, event_id, record }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function emitAuditEvent(event, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!event || typeof event !== "object") {
    return { ok: false, error: "event must be a plain object" };
  }
  if (!event.event_type || typeof event.event_type !== "string") {
    return { ok: false, error: "event.event_type is required" };
  }
  if (!event.target_type || typeof event.target_type !== "string") {
    return { ok: false, error: "event.target_type is required" };
  }
  if (!event.target_id || typeof event.target_id !== "string") {
    return { ok: false, error: "event.target_id is required" };
  }
  if (!event.source || typeof event.source !== "string") {
    return { ok: false, error: "event.source is required" };
  }
  if (!event.summary || typeof event.summary !== "string") {
    return { ok: false, error: "event.summary is required" };
  }

  const now = new Date().toISOString();
  const event_id = event.event_id ||
    ("aev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7));

  const record = {
    event_id,
    event_type:  event.event_type,
    target_type: event.target_type,
    target_id:   event.target_id,
    related_id:  typeof event.related_id === "string" ? event.related_id : null,
    source:      event.source,
    summary:     event.summary,
    timestamp:   now,
  };

  await env.ENAVIA_BRAIN.put(_eventKey(event_id), JSON.stringify(record));

  // Update index
  const index = await _readIndex(env);
  if (!index.includes(event_id)) {
    index.push(event_id);
    await _writeIndex(index, env);
  }

  return { ok: true, event_id, record };
}

// ---------------------------------------------------------------------------
// listAuditEvents(filters, env)
//
// Lista eventos de auditoria com filtros opcionais.
//
// filters (optional):
//   event_type  — string — filtra por tipo de evento
//   target_type — string — filtra por tipo de alvo
//   target_id   — string — filtra por id do alvo
//   limit       — number — máximo de resultados (default: 100)
//
// Returns:
//   { ok: true, items: [], count: number }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function listAuditEvents(filters, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }

  const f = filters && typeof filters === "object" ? filters : {};
  const limit = typeof f.limit === "number" && f.limit > 0 ? f.limit : 100;

  const ids = await _readIndex(env);
  const items = [];

  // Read in reverse order (most recent first)
  for (let i = ids.length - 1; i >= 0 && items.length < limit; i--) {
    const raw = await env.ENAVIA_BRAIN.get(_eventKey(ids[i]));
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      // Apply filters
      if (f.event_type && record.event_type !== f.event_type) continue;
      if (f.target_type && record.target_type !== f.target_type) continue;
      if (f.target_id && record.target_id !== f.target_id) continue;
      items.push(record);
    } catch (_e) {
      // skip corrupted
    }
  }

  return { ok: true, items, count: items.length };
}

// ---------------------------------------------------------------------------
// getAuditEventById(event_id, env)
//
// Lê um evento de auditoria pelo id.
//
// Returns: record object or null
// ---------------------------------------------------------------------------
async function getAuditEventById(event_id, env) {
  if (!env || !env.ENAVIA_BRAIN || !event_id) return null;
  const raw = await env.ENAVIA_BRAIN.get(_eventKey(event_id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  emitAuditEvent,
  listAuditEvents,
  getAuditEventById,
  AUDIT_EVENT_TYPES,
  AUDIT_TARGET_TYPES,
};
