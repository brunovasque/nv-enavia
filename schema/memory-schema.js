// ============================================================================
// 📦 ENAVIA — Memory Schema v1 (PM1 — Memory Schema)
//
// Modelo canônico da memória da ENAVIA.
//
// Este arquivo define apenas tipos/enums/validadores/helpers.
// NÃO contém persistência, leitura automática, escrita automática,
// planner, bridge, executor, ou integração com storage/KV/DB.
//
// Blocos de memória compatíveis com a CONSTITUIÇÃO da ENAVIA:
//   Memória 1 — Identidade do usuário  → user_profile
//   Memória 2 — Projetos               → project
//   Memória 3 — Regras canônicas       → canonical_rules
//   Memória 4 — Histórico operacional  → operational_history
//   Memória 5 — Contexto vivo          → live_context
//
// Shape base do objeto de memória:
//   memory_id, memory_type, entity_type, entity_id, title,
//   content_structured, priority, confidence, source,
//   created_at, updated_at, expires_at, is_canonical, status, flags
//
// PM1 APENAS — não misturar com PM2+.
// ============================================================================

// ---------------------------------------------------------------------------
// MEMORY_TYPES — tipos canônicos de memória
//
// Mapeados diretamente aos 5 tipos implementados.
//
// NOTA — Absorção deliberada da "Memória 5" (conhecimento derivado):
//   A CONSTITUIÇÃO descreve 6 blocos de memória permanente:
//     Memória 1 — Identidade do usuário   → user_profile
//     Memória 2 — Projetos                → project
//     Memória 3 — Regras permanentes      → canonical_rules
//     Memória 4 — Histórico operacional   → operational_history
//     Memória 5 — Conhecimento derivado   → (sem tipo próprio — absorvido)
//     Memória 6 — Estado vivo             → live_context
//
//   A implementação prática ficou com 5 tipos (PM1–PM10).
//   A "Memória 5 — conhecimento derivado" (lições aprendidas, padrões
//   recorrentes, atalhos confiáveis, riscos históricos) foi absorvida
//   deliberadamente por:
//     - canonical_rules      — lições que viram regras permanentes aprovadas
//     - operational_history  — padrões e histórico rastreável de ciclos
//
//   Isso foi uma decisão de design intencional durante a PM1–PM10:
//   evitar tipo extra com semântica redundante. Não há contrato paralelo.
//   Se o conhecimento derivado precisar de tipo próprio no futuro, criar
//   "learned_knowledge" como novo MEMORY_TYPE com revisão humana formal.
// ---------------------------------------------------------------------------
const MEMORY_TYPES = {
  USER_PROFILE:        "user_profile",
  PROJECT:             "project",
  CANONICAL_RULES:     "canonical_rules",
  OPERATIONAL_HISTORY: "operational_history",
  LIVE_CONTEXT:        "live_context",
  // ---------------------------------------------------------------------------
  // PR2 — Tipos canônicos do contrato PR1 (aliases semânticos)
  //
  // Estes tipos mapeiam diretamente os 5 tipos canônicos definidos no contrato
  // ENAVIA_MEMORY_CONTRACT_V1.md (PR1 §1). Convivem com os tipos originais
  // para preservar compatibilidade total com código existente.
  // ---------------------------------------------------------------------------
  CONVERSA_ATUAL:         "conversa_atual",
  MEMORIA_LONGA:          "memoria_longa",
  MEMORIA_MANUAL:         "memoria_manual",
  APRENDIZADO_VALIDADO:   "aprendizado_validado",
  MEMORIA_TEMPORARIA:     "memoria_temporaria",
};

// ---------------------------------------------------------------------------
// MEMORY_STATUS — estados canônicos do ciclo de vida da memória
//
//   active     — memória ativa e em uso
//   archived   — memória preservada mas não ativa
//   superseded — substituída por versão mais recente
//   expired    — validade expirada (expires_at ultrapassado)
//   canonical  — fato permanente aprovado, nunca substituído sem deliberação
// ---------------------------------------------------------------------------
const MEMORY_STATUS = {
  ACTIVE:     "active",
  ARCHIVED:   "archived",
  SUPERSEDED: "superseded",
  EXPIRED:    "expired",
  CANONICAL:  "canonical",
  // PR2 — Nível "bloqueado" do contrato PR1 §2.4: suporte real no schema
  BLOCKED:    "blocked",
};

// ---------------------------------------------------------------------------
// MEMORY_PRIORITY — prioridade da memória no contexto de recuperação
//
//   critical — deve sempre ser recuperada
//   high     — recuperada em contextos relevantes
//   medium   — recuperada quando há espaço de contexto
//   low      — recuperada apenas se explicitamente solicitada
// ---------------------------------------------------------------------------
const MEMORY_PRIORITY = {
  CRITICAL: "critical",
  HIGH:     "high",
  MEDIUM:   "medium",
  LOW:      "low",
};

// ---------------------------------------------------------------------------
// MEMORY_CONFIDENCE — grau de confiança no conteúdo da memória
//
//   confirmed  — fato verificado e aprovado explicitamente
//   high       — alta confiança, sem verificação formal
//   medium     — confiança moderada, pode precisar de revisão
//   low        — baixa confiança, uso cauteloso
//   unverified — não verificado, tratado como hipótese
// ---------------------------------------------------------------------------
const MEMORY_CONFIDENCE = {
  CONFIRMED:  "confirmed",
  HIGH:       "high",
  MEDIUM:     "medium",
  LOW:        "low",
  UNVERIFIED: "unverified",
  // PR2 — Nível "bloqueado" do contrato PR1 §2.4 / §8.8: valor real de confidence
  BLOCKED:    "blocked",
};

// ---------------------------------------------------------------------------
// ENTITY_TYPES — tipos de entidade associada à memória
// ---------------------------------------------------------------------------
const ENTITY_TYPES = {
  USER:      "user",
  PROJECT:   "project",
  RULE:      "rule",
  OPERATION: "operation",
  CONTEXT:   "context",
};

// ---------------------------------------------------------------------------
// MEMORY_FLAGS — flags canônicas disponíveis no array `flags`
//
// Strings usadas dentro do campo `flags: []` do objeto de memória.
// ---------------------------------------------------------------------------
const MEMORY_FLAGS = {
  IS_CANONICAL:  "is_canonical",
  IS_SUPERSEDED: "is_superseded",
  IS_EXPIRED:    "is_expired",
  // PR2 — Flag "bloqueado" do contrato PR1 §8.8: suporte real no schema
  IS_BLOCKED:    "is_blocked",
};

// ---------------------------------------------------------------------------
// MEMORY_CANONICAL_SHAPE — shape base/canônico do objeto de memória
//
// Campos com valor null são obrigatórios (sem default útil).
// Campos com valor não-null possuem default aplicado por buildMemoryObject().
// ---------------------------------------------------------------------------
const MEMORY_CANONICAL_SHAPE = {
  memory_id:          null,     // string única — obrigatório
  memory_type:        null,     // MEMORY_TYPES value — obrigatório
  entity_type:        null,     // ENTITY_TYPES value — obrigatório
  entity_id:          null,     // string — obrigatório
  title:              null,     // string — obrigatório
  content_structured: null,     // plain object — obrigatório
  priority:           "medium", // MEMORY_PRIORITY value
  confidence:         "medium", // MEMORY_CONFIDENCE value
  source:             null,     // string — obrigatório
  created_at:         null,     // ISO 8601 string — obrigatório
  updated_at:         null,     // ISO 8601 string — obrigatório
  expires_at:         null,     // ISO 8601 string ou null
  is_canonical:       false,    // boolean
  status:             "active", // MEMORY_STATUS value
  flags:              [],       // array de MEMORY_FLAGS strings
  // PR2 — campo mínimo contratual: tags (array de strings livres para categorização)
  tags:               [],       // string[] — default []
};

// ---------------------------------------------------------------------------
// validateMemoryObject(obj)
//
// Valida um objeto de memória contra o schema canônico.
// Retorna { valid: true } ou { valid: false, errors: string[] }.
//
// NÃO persiste, NÃO lê de KV, NÃO chama executor.
// ---------------------------------------------------------------------------
function validateMemoryObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { valid: false, errors: ["memory object must be a plain object"] };
  }

  const errors = [];

  // Campos obrigatórios — string não vazia
  const requiredStrings = [
    "memory_id",
    "entity_id",
    "title",
    "source",
    "created_at",
    "updated_at",
  ];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || obj[field].trim() === "") {
      errors.push(`'${field}' is required and must be a non-empty string`);
    }
  }

  // memory_type
  const validMemoryTypes = Object.values(MEMORY_TYPES);
  if (!validMemoryTypes.includes(obj.memory_type)) {
    errors.push(
      `'memory_type' must be one of: ${validMemoryTypes.join(", ")}`
    );
  }

  // entity_type
  const validEntityTypes = Object.values(ENTITY_TYPES);
  if (!validEntityTypes.includes(obj.entity_type)) {
    errors.push(
      `'entity_type' must be one of: ${validEntityTypes.join(", ")}`
    );
  }

  // status
  const validStatuses = Object.values(MEMORY_STATUS);
  if (!validStatuses.includes(obj.status)) {
    errors.push(`'status' must be one of: ${validStatuses.join(", ")}`);
  }

  // priority
  const validPriorities = Object.values(MEMORY_PRIORITY);
  if (!validPriorities.includes(obj.priority)) {
    errors.push(`'priority' must be one of: ${validPriorities.join(", ")}`);
  }

  // confidence
  const validConfidences = Object.values(MEMORY_CONFIDENCE);
  if (!validConfidences.includes(obj.confidence)) {
    errors.push(
      `'confidence' must be one of: ${validConfidences.join(", ")}`
    );
  }

  // content_structured — deve ser plain object (não null, não array)
  if (
    !obj.content_structured ||
    typeof obj.content_structured !== "object" ||
    Array.isArray(obj.content_structured)
  ) {
    errors.push("'content_structured' must be a non-null plain object");
  }

  // is_canonical — deve ser boolean
  if (typeof obj.is_canonical !== "boolean") {
    errors.push("'is_canonical' must be a boolean");
  }

  // created_at / updated_at — ISO 8601 date strings
  // Validated here in addition to the required-string check above.
  for (const field of ["created_at", "updated_at"]) {
    if (typeof obj[field] === "string" && obj[field].trim() !== "") {
      if (Number.isNaN(Date.parse(obj[field]))) {
        errors.push(`'${field}' must be a valid ISO 8601 date string`);
      }
    }
  }

  // expires_at — opcional; se presente, deve ser ISO 8601 válido
  if (obj.expires_at !== null && obj.expires_at !== undefined) {
    if (typeof obj.expires_at !== "string" || obj.expires_at.trim() === "") {
      errors.push(
        "'expires_at' must be a non-empty ISO 8601 string when provided"
      );
    } else if (Number.isNaN(Date.parse(obj.expires_at))) {
      errors.push("'expires_at' must be a valid ISO 8601 date string");
    }
  }

  // PR2 — memoria_temporaria DEVE ter expires_at (contrato PR1 §5.1, §6.1)
  if (
    obj.memory_type === MEMORY_TYPES.MEMORIA_TEMPORARIA &&
    (obj.expires_at === null || obj.expires_at === undefined)
  ) {
    errors.push(
      "'expires_at' is required for memory_type 'memoria_temporaria'"
    );
  }

  // flags — deve ser array cujos itens pertencem ao enum MEMORY_FLAGS
  if (!Array.isArray(obj.flags)) {
    errors.push("'flags' must be an array");
  } else {
    const validFlags = Object.values(MEMORY_FLAGS);
    for (const flag of obj.flags) {
      if (!validFlags.includes(flag)) {
        errors.push(
          `'flags' contains unknown value '${flag}'; allowed: ${validFlags.join(", ")}`
        );
      }
    }
  }

  // PR2 — tags: campo mínimo contratual — array de strings livres
  if (!Array.isArray(obj.tags)) {
    errors.push("'tags' must be an array");
  } else {
    for (const tag of obj.tags) {
      if (typeof tag !== "string" || tag.trim() === "") {
        errors.push("'tags' must contain only non-empty strings");
        break;
      }
    }
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

// ---------------------------------------------------------------------------
// buildMemoryObject(partial)
//
// Constrói um objeto de memória mesclando `partial` com os defaults do shape
// canônico. Não persiste, não valida. Para validar, use validateMemoryObject().
// ---------------------------------------------------------------------------
function buildMemoryObject(partial) {
  return Object.assign({}, MEMORY_CANONICAL_SHAPE, partial, {
    flags: Array.isArray(partial && partial.flags) ? [...partial.flags] : [],
    tags:  Array.isArray(partial && partial.tags)  ? [...partial.tags]  : [],
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  MEMORY_FLAGS,
  MEMORY_CANONICAL_SHAPE,
  validateMemoryObject,
  buildMemoryObject,
};
