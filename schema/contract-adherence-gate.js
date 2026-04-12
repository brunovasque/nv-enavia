// ============================================================================
// 📦 ENAVIA — Contract Adherence Gate v1 (Blindagem Contratual — PR 1)
//
// Gate de aderência contratual por microetapa.
// Valida se a entrega de uma microetapa está aderente ao contrato definido,
// parcialmente desviada ou fora do contrato.
//
// Escopo: WORKER-ONLY. Não misturar com painel, P18 ou workflows.
//
// ─── Estrutura canônica de microetapa contratual (MicrostepContract) ────────
//   id                         — string identificadora
//   objetivo_contratual_exato  — string: o objetivo exato do contrato
//   escopo_permitido           — string[]: o que pode ser entregue
//   escopo_proibido            — string[]: o que NÃO pode ser entregue
//   criterio_de_aceite_literal — string: critério literal de aceite
//
// ─── Estrutura canônica de resultado/entrega (MicrostepResultado) ───────────
//   objetivo_atendido         — boolean: o objetivo contratual foi atendido?
//   criterio_aceite_atendido  — boolean: o critério de aceite literal foi atendido?
//   escopo_efetivo            — string[]: o que foi efetivamente entregue
//   is_simulado               — boolean: a entrega é simulada?
//   is_mockado                — boolean: a entrega é mockada?
//   is_local                  — boolean: a entrega é apenas local?
//   is_parcial                — boolean: a entrega é parcial/incompleta?
//
// ─── Saída canônica (AdherenceAudit) ─────────────────────────────────────────
//   adherence_status   — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//   can_mark_concluded — boolean (false quando status não é aderente_ao_contrato)
//   honest_status      — string: status honesto que pode ser atribuído à microetapa
//   campos_falhos      — string[]: campos/critérios que falharam
//   reason             — string auditável
//   next_action        — string coerente com o estado
//
// ─── Regra binária e honesta de estado ───────────────────────────────────────
//   não marcar "feito"     quando estiver "simulado"
//   não marcar "integrado" quando estiver "mockado"
//   não marcar "real"      quando estiver "local"
//   não marcar "concluído" quando estiver "parcial/desviado"
//
// ─── Regra de classificação ───────────────────────────────────────────────────
//   fora_do_contrato:     !objetivo_atendido OU escopo_efetivo ∩ escopo_proibido ≠ ∅
//   aderente_ao_contrato: todas as verificações passam (sem falhas)
//   parcial_desviado:     falhas existem mas não suficientes para fora_do_contrato
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - painel / UX visual
//   - auditoria pesada final do plano inteiro
//   - integração completa com propose final
//   - fechamento final do contrato
//   - persistência / I/O
//
// Blindagem Contratual PR 1 — base do gate. Não misturar com PM8+.
// ============================================================================

// ---------------------------------------------------------------------------
// ADHERENCE_STATUS — enum canônico dos estados de aderência
// ---------------------------------------------------------------------------
const ADHERENCE_STATUS = {
  ADERENTE:   "aderente_ao_contrato",
  PARCIAL:    "parcial_desviado",
  FORA:       "fora_do_contrato",
};

// ---------------------------------------------------------------------------
// HONEST_STATUS — estados honestos atribuíveis a uma microetapa
// ---------------------------------------------------------------------------
const HONEST_STATUS = {
  CONCLUIDO:        "concluido",
  PARCIAL:          "parcial",
  SIMULADO:         "simulado",
  MOCKADO:          "mockado",
  LOCAL:            "local",
  FORA_DO_CONTRATO: "fora_do_contrato",
  PENDENTE:         "pendente",
};

// ---------------------------------------------------------------------------
// HONEST_STATUS_RULES — regra binária e explícita
//
// Mapeia cada adherence_status + flags de desvio para o honest_status
// canônico que pode ser atribuído à microetapa. Nunca usa "feito",
// "concluído", "integrado" ou "real" quando a entrega está desviada.
// ---------------------------------------------------------------------------
const HONEST_STATUS_RULES = {
  // Se aderente e sem desvios → único caso onde "concluido" é permitido
  [ADHERENCE_STATUS.ADERENTE]: HONEST_STATUS.CONCLUIDO,
  // Se parcialmente desviado → nunca "concluído", sempre "parcial"
  [ADHERENCE_STATUS.PARCIAL]:  HONEST_STATUS.PARCIAL,
  // Se fora do contrato → status explícito de divergência
  [ADHERENCE_STATUS.FORA]:     HONEST_STATUS.FORA_DO_CONTRATO,
};

// ---------------------------------------------------------------------------
// _NEXT_ACTIONS — ação coerente com cada estado de aderência
// ---------------------------------------------------------------------------
const _NEXT_ACTIONS = {
  [ADHERENCE_STATUS.ADERENTE]: "Microetapa aderente ao contrato — pode ser marcada como concluída.",
  [ADHERENCE_STATUS.PARCIAL]:  "Microetapa parcialmente desviada — revisar escopo e entrega antes de prosseguir.",
  [ADHERENCE_STATUS.FORA]:     "Microetapa fora do contrato — não prosseguir; revisar objetivo e escopo contratual.",
};

// ---------------------------------------------------------------------------
// _validateContract(contract, fnName)
//
// Valida a estrutura canônica de microetapa contratual (MicrostepContract).
// Lança Error com mensagem clara caso inválido.
// ---------------------------------------------------------------------------
function _validateContract(contract, fnName) {
  if (!contract || typeof contract !== "object") {
    throw new Error(`${fnName}: 'contract' é obrigatório e deve ser um objeto`);
  }
  if (typeof contract.objetivo_contratual_exato !== "string" || contract.objetivo_contratual_exato.trim() === "") {
    throw new Error(`${fnName}: 'contract.objetivo_contratual_exato' é obrigatório e deve ser string não-vazia`);
  }
  if (!Array.isArray(contract.escopo_permitido)) {
    throw new Error(`${fnName}: 'contract.escopo_permitido' é obrigatório e deve ser array`);
  }
  if (!Array.isArray(contract.escopo_proibido)) {
    throw new Error(`${fnName}: 'contract.escopo_proibido' é obrigatório e deve ser array`);
  }
  if (typeof contract.criterio_de_aceite_literal !== "string" || contract.criterio_de_aceite_literal.trim() === "") {
    throw new Error(`${fnName}: 'contract.criterio_de_aceite_literal' é obrigatório e deve ser string não-vazia`);
  }
}

// ---------------------------------------------------------------------------
// _validateResultado(resultado, fnName)
//
// Valida a estrutura canônica de resultado/entrega (MicrostepResultado).
// Lança Error com mensagem clara caso inválido.
// ---------------------------------------------------------------------------
function _validateResultado(resultado, fnName) {
  if (!resultado || typeof resultado !== "object") {
    throw new Error(`${fnName}: 'resultado' é obrigatório e deve ser um objeto`);
  }
  if (typeof resultado.objetivo_atendido !== "boolean") {
    throw new Error(`${fnName}: 'resultado.objetivo_atendido' é obrigatório e deve ser boolean`);
  }
  if (typeof resultado.criterio_aceite_atendido !== "boolean") {
    throw new Error(`${fnName}: 'resultado.criterio_aceite_atendido' é obrigatório e deve ser boolean`);
  }
  if (!Array.isArray(resultado.escopo_efetivo)) {
    throw new Error(`${fnName}: 'resultado.escopo_efetivo' é obrigatório e deve ser array`);
  }
  if (typeof resultado.is_simulado !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_simulado' é obrigatório e deve ser boolean`);
  }
  if (typeof resultado.is_mockado !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_mockado' é obrigatório e deve ser boolean`);
  }
  if (typeof resultado.is_local !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_local' é obrigatório e deve ser boolean`);
  }
  if (typeof resultado.is_parcial !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_parcial' é obrigatório e deve ser boolean`);
  }
}

// ---------------------------------------------------------------------------
// _checkScopeViolations({ escopo_efetivo, escopo_permitido, escopo_proibido })
//
// Retorna as violações de escopo encontradas:
//   proibidos_entregues — itens entregues que estão em escopo_proibido
//   fora_do_permitido   — itens entregues que não estão em escopo_permitido
//                         (mas também não estão em escopo_proibido)
// ---------------------------------------------------------------------------
function _checkScopeViolations({ escopo_efetivo, escopo_permitido, escopo_proibido }) {
  const proibidos_entregues = escopo_efetivo.filter(item =>
    escopo_proibido.some(p => typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase())
  );

  const fora_do_permitido = escopo_efetivo.filter(item => {
    const isProibido = escopo_proibido.some(p =>
      typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase()
    );
    const isPermitido = escopo_permitido.some(p =>
      typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase()
    );
    // Não está proibido explicitamente, mas também não está no permitido
    return !isProibido && !isPermitido;
  });

  return { proibidos_entregues, fora_do_permitido };
}

// ---------------------------------------------------------------------------
// _buildReason({ adherence_status, campos_falhos })
//
// Constrói reason auditável a partir do status e campos que falharam.
// ---------------------------------------------------------------------------
function _buildReason({ adherence_status, campos_falhos }) {
  if (adherence_status === ADHERENCE_STATUS.ADERENTE) {
    return "Microetapa aderente ao contrato — todos os critérios atendidos.";
  }

  const listaFalhos = campos_falhos.length > 0
    ? ` Campos/critérios falhos: ${campos_falhos.join("; ")}.`
    : "";

  if (adherence_status === ADHERENCE_STATUS.FORA) {
    return `Microetapa fora do contrato — desvio fatal detectado.${listaFalhos}`;
  }

  return `Microetapa parcialmente desviada — nem todos os critérios foram atendidos.${listaFalhos}`;
}

// ---------------------------------------------------------------------------
// evaluateAdherence({ contract, resultado })
//
// Gate principal de aderência contratual por microetapa.
// Determinístico, auditável e sem I/O.
//
// Parâmetros:
//   contract  {object} — MicrostepContract (estrutura canônica de microetapa contratual):
//     objetivo_contratual_exato  {string}   — objetivo exato do contrato
//     escopo_permitido           {string[]} — o que pode ser entregue
//     escopo_proibido            {string[]} — o que NÃO pode ser entregue
//     criterio_de_aceite_literal {string}   — critério literal de aceite
//
//   resultado {object} — MicrostepResultado (estrutura canônica de entrega):
//     objetivo_atendido         {boolean}  — objetivo contratual foi atendido?
//     criterio_aceite_atendido  {boolean}  — critério literal de aceite foi atendido?
//     escopo_efetivo            {string[]} — o que foi efetivamente entregue
//     is_simulado               {boolean}  — entrega é simulada?
//     is_mockado                {boolean}  — entrega é mockada?
//     is_local                  {boolean}  — entrega é apenas local?
//     is_parcial                {boolean}  — entrega é parcial/incompleta?
//
// Retorna AdherenceAudit:
//   {
//     adherence_status,   — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//     can_mark_concluded, — boolean
//     honest_status,      — string: status honesto que pode ser atribuído
//     campos_falhos,      — string[]: campos/critérios que falharam
//     reason,             — string auditável
//     next_action,        — string coerente com o estado
//   }
//
// Regras de classificação:
//   fora_do_contrato:     !objetivo_atendido OU escopo_efetivo ∩ escopo_proibido ≠ ∅
//   aderente_ao_contrato: sem falhas de qualquer tipo
//   parcial_desviado:     falhas existem mas não fatais (não é fora_do_contrato)
//
// Lança:
//   Error — se contract ou resultado ausentes/inválidos
// ---------------------------------------------------------------------------
function evaluateAdherence({ contract, resultado } = {}) {
  _validateContract(contract, "evaluateAdherence");
  _validateResultado(resultado, "evaluateAdherence");

  const campos_falhos = [];

  // ─── 1. Verificações fatais → fora_do_contrato ─────────────────────────
  // 1a. Objetivo contratual não atendido
  if (!resultado.objetivo_atendido) {
    campos_falhos.push("objetivo_contratual_exato: objetivo não atendido");
  }

  // 1b. Escopo entregue contém itens proibidos
  const { proibidos_entregues, fora_do_permitido } = _checkScopeViolations({
    escopo_efetivo:  resultado.escopo_efetivo,
    escopo_permitido: contract.escopo_permitido,
    escopo_proibido:  contract.escopo_proibido,
  });

  if (proibidos_entregues.length > 0) {
    campos_falhos.push(`escopo_proibido: itens entregues que são proibidos — ${proibidos_entregues.join(", ")}`);
  }

  // Verificações fatais: objetivo não atendido OU itens proibidos entregues
  const temFatalidade = !resultado.objetivo_atendido || proibidos_entregues.length > 0;

  // ─── 2. Verificações parciais → parcial_desviado ──────────────────────
  // 2a. Critério de aceite literal não atendido
  if (!resultado.criterio_aceite_atendido) {
    campos_falhos.push("criterio_de_aceite_literal: critério de aceite não atendido");
  }

  // 2b. Itens entregues fora do escopo permitido (mas não proibidos)
  if (fora_do_permitido.length > 0) {
    campos_falhos.push(`escopo_permitido: itens entregues fora do permitido — ${fora_do_permitido.join(", ")}`);
  }

  // 2c. Regra binária de estado honesto
  if (resultado.is_simulado) {
    campos_falhos.push("honest_state: entrega simulada — não pode ser marcada como 'feito'");
  }
  if (resultado.is_mockado) {
    campos_falhos.push("honest_state: entrega mockada — não pode ser marcada como 'integrado'");
  }
  if (resultado.is_local) {
    campos_falhos.push("honest_state: entrega local — não pode ser marcada como 'real'");
  }
  if (resultado.is_parcial) {
    campos_falhos.push("honest_state: entrega parcial — não pode ser marcada como 'concluído'");
  }

  // ─── 3. Classificação canônica ─────────────────────────────────────────
  let adherence_status;

  if (temFatalidade) {
    adherence_status = ADHERENCE_STATUS.FORA;
  } else if (campos_falhos.length > 0) {
    adherence_status = ADHERENCE_STATUS.PARCIAL;
  } else {
    adherence_status = ADHERENCE_STATUS.ADERENTE;
  }

  // ─── 4. Estado honesto e can_mark_concluded ────────────────────────────
  const can_mark_concluded = adherence_status === ADHERENCE_STATUS.ADERENTE;
  const honest_status      = HONEST_STATUS_RULES[adherence_status];

  return {
    adherence_status,
    can_mark_concluded,
    honest_status,
    campos_falhos,
    reason:      _buildReason({ adherence_status, campos_falhos }),
    next_action: _NEXT_ACTIONS[adherence_status],
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  evaluateAdherence,
  ADHERENCE_STATUS,
  HONEST_STATUS,
  HONEST_STATUS_RULES,
};
