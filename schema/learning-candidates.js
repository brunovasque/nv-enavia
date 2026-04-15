// ============================================================================
// 📦 ENAVIA — Learning Candidates v1 (PR5 — Aprendizado Controlado)
//
// Governança mínima de aprendizado: candidatos pendentes, aprovação humana,
// rejeição humana, promoção para memória validada ativa.
//
// Regra central: ENAVIA NÃO pode auto-validar aprendizado.
//   - Sistema detecta padrão/regra candidata
//   - Salva como candidato pendente
//   - Humano aprova ou rejeita
//   - Só então vira memória validada
//
// Armazenamento:
//   KV key: learning:candidate:<id>  → objeto JSON do candidato
//   KV key: learning:candidate:index → array de ids
//
// Fluxo:
//   1. registerLearningCandidate(candidate, env)  → salva como pendente
//   2. listLearningCandidates(env, filters)       → lista candidatos
//   3. approveLearningCandidate(id, env)          → promove para memória validada
//   4. rejectLearningCandidate(id, reason, env)   → marca como rejeitado
//
// Separação obrigatória:
//   - Candidato pendente NÃO entra na memória validada ativa
//   - Candidato rejeitado NÃO entra na memória validada
//   - Candidato aprovado é promovido para memory_type=aprendizado_validado
//     com status=active, e entra no retrieval da PR3 como validated_learning
//
// NÃO contém:
//   - telemetria extensa (PR6)
//   - auto-aprovação / autonomia
//   - governança ampla / policy engine
//   - refatoração de módulos existentes
//
// PR5 APENAS — não misturar com PR6+.
// ============================================================================

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  buildMemoryObject,
  validateMemoryObject,
} from "./memory-schema.js";

import { writeMemory } from "./memory-storage.js";

import {
  emitAuditEvent,
  AUDIT_EVENT_TYPES,
  AUDIT_TARGET_TYPES,
} from "./memory-audit-log.js";

// ---------------------------------------------------------------------------
// KV Key Helpers
// ---------------------------------------------------------------------------
const KV_PREFIX = "learning:candidate:";
const KV_INDEX_KEY = "learning:candidate:index";

function _candidateKey(id) {
  return `${KV_PREFIX}${id}`;
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
// CANDIDATE_STATUS — estados do candidato de aprendizado
// ---------------------------------------------------------------------------
const CANDIDATE_STATUS = {
  PENDING:  "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

// ---------------------------------------------------------------------------
// registerLearningCandidate(candidate, env)
//
// Registra um candidato de aprendizado como PENDENTE.
// Não entra na memória validada ativa até aprovação humana.
//
// candidate:
//   title              {string} — obrigatório
//   content_structured {object} — obrigatório (conteúdo/resumo)
//   source             {string} — origem da sugestão (ex: "consolidation", "runtime")
//   confidence         {string} — grau de confiança sugerido (default: "medium")
//   priority           {string} — prioridade sugerida (default: "medium")
//   tags               {string[]} — tags opcionais
//
// Returns:
//   { ok: true,  candidate_id, record }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function registerLearningCandidate(candidate, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: "candidate must be a plain object" };
  }
  if (!candidate.title || typeof candidate.title !== "string" || !candidate.title.trim()) {
    return { ok: false, error: "candidate.title is required and must be a non-empty string" };
  }
  if (
    !candidate.content_structured ||
    typeof candidate.content_structured !== "object" ||
    Array.isArray(candidate.content_structured)
  ) {
    return { ok: false, error: "candidate.content_structured is required and must be a plain object" };
  }

  const now = new Date().toISOString();
  const id = candidate.candidate_id ||
    ("lc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7));

  // Check for duplicate
  const existing = await env.ENAVIA_BRAIN.get(_candidateKey(id));
  if (existing !== null) {
    return { ok: false, error: `candidate_id '${id}' already exists` };
  }

  const record = {
    candidate_id:       id,
    title:              candidate.title.trim(),
    content_structured: candidate.content_structured,
    source:             typeof candidate.source === "string" ? candidate.source : "unknown",
    confidence:         candidate.confidence || "medium",
    priority:           candidate.priority || "medium",
    tags:               Array.isArray(candidate.tags) ? candidate.tags : [],
    status:             CANDIDATE_STATUS.PENDING,
    created_at:         now,
    updated_at:         now,
    approved_at:        null,
    rejected_at:        null,
    rejection_reason:   null,
    promoted_memory_id: null,
  };

  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(record));

  // Update index
  const index = await _readIndex(env);
  if (!index.includes(id)) {
    index.push(id);
    await _writeIndex(index, env);
  }

  // PR6 — Audit trail: candidate registered
  try {
    await emitAuditEvent({
      event_type:  AUDIT_EVENT_TYPES.CANDIDATE_REGISTERED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id:   id,
      source:      record.source || "system",
      summary:     `Candidato de aprendizado registrado: ${record.title}`,
    }, env);
  } catch (_e) { /* fire-and-forget */ }

  return { ok: true, candidate_id: id, record };
}

// ---------------------------------------------------------------------------
// listLearningCandidates(env, filters)
//
// Lista candidatos de aprendizado.
//
// filters (optional):
//   status — "pending" | "approved" | "rejected" — filtra por status
//
// Returns:
//   { ok: true, items: [], count: number }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function listLearningCandidates(env, filters) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }

  const f = filters && typeof filters === "object" ? filters : {};
  const ids = await _readIndex(env);
  const items = [];

  for (const id of ids) {
    const raw = await env.ENAVIA_BRAIN.get(_candidateKey(id));
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      // Apply status filter
      if (f.status && record.status !== f.status) continue;
      items.push(record);
    } catch (_e) {
      // skip corrupted
    }
  }

  // Sort: pending first, then by created_at desc
  items.sort((a, b) => {
    if (a.status === CANDIDATE_STATUS.PENDING && b.status !== CANDIDATE_STATUS.PENDING) return -1;
    if (b.status === CANDIDATE_STATUS.PENDING && a.status !== CANDIDATE_STATUS.PENDING) return 1;
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });

  return { ok: true, items, count: items.length };
}

// ---------------------------------------------------------------------------
// getLearningCandidateById(id, env)
//
// Lê um candidato pelo id.
//
// Returns: record object or null
// ---------------------------------------------------------------------------
async function getLearningCandidateById(id, env) {
  if (!env || !env.ENAVIA_BRAIN || !id) return null;
  const raw = await env.ENAVIA_BRAIN.get(_candidateKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}

// ---------------------------------------------------------------------------
// approveLearningCandidate(id, env)
//
// Aprova um candidato e promove para memória validada ativa.
//
// Fluxo:
//   1. Lê o candidato pendente
//   2. Valida que está em status "pending"
//   3. Cria objeto de memória com memory_type=aprendizado_validado
//   4. Persiste via writeMemory (PM2)
//   5. Atualiza candidato com status=approved e promoted_memory_id
//
// O item promovido entra no retrieval da PR3 como validated_learning.
//
// Returns:
//   { ok: true, candidate_id, promoted_memory_id, candidate, memory }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function approveLearningCandidate(id, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!id) {
    return { ok: false, error: "candidate_id is required" };
  }

  const candidate = await getLearningCandidateById(id, env);
  if (!candidate) {
    return { ok: false, error: `candidate '${id}' not found` };
  }
  if (candidate.status !== CANDIDATE_STATUS.PENDING) {
    return { ok: false, error: `candidate '${id}' is not pending (status: ${candidate.status})` };
  }

  // Build validated memory object
  const now = new Date().toISOString();
  const memoryId = "av-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);

  const memObj = buildMemoryObject({
    memory_id:          memoryId,
    memory_type:        MEMORY_TYPES.APRENDIZADO_VALIDADO,
    entity_type:        ENTITY_TYPES.RULE,
    entity_id:          memoryId,
    title:              candidate.title,
    content_structured: candidate.content_structured,
    priority:           candidate.priority || MEMORY_PRIORITY.MEDIUM,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "learning_approved",
    created_at:         now,
    updated_at:         now,
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               Array.isArray(candidate.tags) ? [...candidate.tags, "pr5", "learning_approved"] : ["pr5", "learning_approved"],
  });

  // Validate before writing
  const validation = validateMemoryObject(memObj);
  if (!validation.valid) {
    return { ok: false, error: "promoted memory failed schema validation", errors: validation.errors };
  }

  // Write to memory storage (PM2)
  const writeResult = await writeMemory(memObj, env);
  if (!writeResult.ok) {
    return { ok: false, error: `failed to write promoted memory: ${writeResult.error}` };
  }

  // Update candidate record
  candidate.status = CANDIDATE_STATUS.APPROVED;
  candidate.approved_at = now;
  candidate.updated_at = now;
  candidate.promoted_memory_id = memoryId;

  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(candidate));

  // PR6 — Audit trail: candidate approved with link to promoted memory
  try {
    await emitAuditEvent({
      event_type:  AUDIT_EVENT_TYPES.CANDIDATE_APPROVED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id:   id,
      related_id:  memoryId,
      source:      "learning_approved",
      summary:     `Candidato aprovado: ${candidate.title} → memória promovida: ${memoryId}`,
    }, env);
  } catch (_e) { /* fire-and-forget */ }

  return {
    ok: true,
    candidate_id: id,
    promoted_memory_id: memoryId,
    candidate,
    memory: memObj,
  };
}

// ---------------------------------------------------------------------------
// rejectLearningCandidate(id, reason, env)
//
// Rejeita um candidato. O candidato permanece no storage para histórico
// mas NÃO entra na memória validada ativa.
//
// Returns:
//   { ok: true, candidate_id, candidate }
//   { ok: false, error: string }
// ---------------------------------------------------------------------------
async function rejectLearningCandidate(id, reason, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!id) {
    return { ok: false, error: "candidate_id is required" };
  }

  const candidate = await getLearningCandidateById(id, env);
  if (!candidate) {
    return { ok: false, error: `candidate '${id}' not found` };
  }
  if (candidate.status !== CANDIDATE_STATUS.PENDING) {
    return { ok: false, error: `candidate '${id}' is not pending (status: ${candidate.status})` };
  }

  const now = new Date().toISOString();
  candidate.status = CANDIDATE_STATUS.REJECTED;
  candidate.rejected_at = now;
  candidate.updated_at = now;
  candidate.rejection_reason = typeof reason === "string" && reason.trim() ? reason.trim() : null;

  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(candidate));

  // PR6 — Audit trail: candidate rejected
  try {
    await emitAuditEvent({
      event_type:  AUDIT_EVENT_TYPES.CANDIDATE_REJECTED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id:   id,
      source:      "learning_rejected",
      summary:     `Candidato rejeitado: ${candidate.title}${candidate.rejection_reason ? ` — motivo: ${candidate.rejection_reason}` : ""}`,
    }, env);
  } catch (_e) { /* fire-and-forget */ }

  return { ok: true, candidate_id: id, candidate };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  registerLearningCandidate,
  listLearningCandidates,
  getLearningCandidateById,
  approveLearningCandidate,
  rejectLearningCandidate,
  CANDIDATE_STATUS,
};
