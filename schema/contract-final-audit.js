// ============================================================================
// 📦 ENAVIA — Contract Final Audit v1 (Blindagem Contratual — PR 3)
//
// Auditoria pesada final do contrato inteiro. Gate obrigatório de fechamento.
//
// Escopo: WORKER-ONLY. Não misturar com painel, P18 ou workflows.
//
// Responsabilidade:
//   Impede que um contrato inteiro seja marcado como concluído quando
//   o conjunto final ainda estiver parcial, desviado, fora do contrato,
//   com microetapas sem aderência suficiente, com faltantes contratuais,
//   com entradas não autorizadas ou com evidência operacional insuficiente.
//
// ─── Entradas ────────────────────────────────────────────────────────────────
//   state         — estado canônico do contrato (buildInitialState):
//     contract_id         {string}
//     definition_of_done  {string[]}  — itens contratuais exigidos
//     task_execution_log  {object}    — { [task_id]: cycle[] } (evidência operacional)
//   decomposition — decomposição canônica (generateDecomposition):
//     tasks               {object[]} — cada task: { id, description, status }
//
// ─── Saída canônica (ContractFinalAudit) ─────────────────────────────────────
//   contract_id                 — ID do contrato auditado
//   final_adherence_status      — "contrato_aderente" | "contrato_parcial_desviado" | "contrato_fora_do_contrato"
//   completed_microsteps        — string[]: IDs das tasks em TASK_DONE_STATUSES
//   adherent_microsteps         — string[]: IDs das tasks "completed" com evidência operacional
//   partial_microsteps          — string[]: IDs das tasks em TASK_DONE_STATUSES sem gate formal ou sem evidência
//   out_of_contract_microsteps  — string[]: IDs das tasks concluídas que não mapeiam nenhum item do DoD
//   missing_items               — string[]: itens do DoD não cobertos por nenhuma task concluída
//   unauthorized_items          — string[]: descrições de tasks concluídas fora do DoD
//   evidence_sufficiency        — boolean: todas as tasks adherentes possuem evidência operacional
//   final_reason                — string auditável
//   final_next_action           — string coerente com o estado
//   can_close_contract          — boolean: false quando classificação não é "contrato_aderente"
//
// ─── Regra de classificação ──────────────────────────────────────────────────
//   contrato_fora_do_contrato:   out_of_contract_microsteps.length > 0
//   contrato_aderente:           missing_items.length === 0
//                                AND partial_microsteps.length === 0
//                                AND out_of_contract_microsteps.length === 0
//                                AND evidence_sufficiency === true
//   contrato_parcial_desviado:   tudo o mais (itens faltantes, parciais, sem evidência)
//
// ─── Regra de fechamento ─────────────────────────────────────────────────────
//   can_close_contract = true  SOMENTE quando final_adherence_status === "contrato_aderente"
//   NÃO pode fechar quando:
//     • houver microetapa parcial/desviada relevante
//     • houver microetapa fora do contrato
//     • houver faltantes do definition_of_done
//     • houver entregas não autorizadas no conjunto
//     • evidência operacional insuficiente
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - painel / UX visual
//   - persistência / I/O
//   - lógica de microetapa individual (preservada na PR 1)
//   - lógica de auditoria por ciclo (preservada na PR 2)
//
// Blindagem Contratual PR 3 — gate final pesado. Não misturar com PR 1 ou PR 2.
// ============================================================================

// ---------------------------------------------------------------------------
// CONTRACT_FINAL_STATUS — enum canônico dos estados finais do contrato
// ---------------------------------------------------------------------------
const CONTRACT_FINAL_STATUS = {
  ADERENTE: "contrato_aderente",
  PARCIAL:  "contrato_parcial_desviado",
  FORA:     "contrato_fora_do_contrato",
};

// ---------------------------------------------------------------------------
// FINAL_TASK_DONE_STATUSES — statuses que indicam conclusão de task
//
// Espelha TASK_DONE_STATUSES de contract-executor.js.
// Definido localmente para evitar importação circular.
// Manter sincronizado com TASK_DONE_STATUSES se aquele for alterado.
//
// Design intencional: "skipped", "done" e "merged" estão incluídos pois
// indicam que a task foi finalizada — mas NÃO passaram pelo gate formal
// da PR 1 (evaluateAdherence). Por isso, tasks com esses statuses são
// classificadas como `partial_microsteps` (não como `adherent_microsteps`),
// impedindo o fechamento do contrato. Este comportamento é testado em S2b.
// ---------------------------------------------------------------------------
const FINAL_TASK_DONE_STATUSES = ["done", "merged", "completed", "skipped"];

// ---------------------------------------------------------------------------
// _normalize(str) — normaliza para comparação determinística
// ---------------------------------------------------------------------------
function _normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

// ---------------------------------------------------------------------------
// _validateState(state, fnName)
// ---------------------------------------------------------------------------
function _validateState(state, fnName) {
  if (!state || typeof state !== "object") {
    throw new Error(`${fnName}: 'state' é obrigatório e deve ser um objeto`);
  }
  if (typeof state.contract_id !== "string" || state.contract_id.trim() === "") {
    throw new Error(`${fnName}: 'state.contract_id' é obrigatório e deve ser string não-vazia`);
  }
  if (!Array.isArray(state.definition_of_done)) {
    throw new Error(`${fnName}: 'state.definition_of_done' é obrigatório e deve ser array`);
  }
}

// ---------------------------------------------------------------------------
// _validateDecomposition(decomposition, fnName)
// ---------------------------------------------------------------------------
function _validateDecomposition(decomposition, fnName) {
  if (!decomposition || typeof decomposition !== "object") {
    throw new Error(`${fnName}: 'decomposition' é obrigatório e deve ser um objeto`);
  }
  if (!Array.isArray(decomposition.tasks)) {
    throw new Error(`${fnName}: 'decomposition.tasks' é obrigatório e deve ser array`);
  }
}

// ---------------------------------------------------------------------------
// _hasOperationalEvidence(state, taskId)
//
// Retorna true quando task_execution_log possui ao menos 1 ciclo para a task.
// Ciclo = evidência de que a task foi efetivamente executada operacionalmente.
// ---------------------------------------------------------------------------
function _hasOperationalEvidence(state, taskId) {
  const log = state.task_execution_log;
  if (!log || typeof log !== "object") return false;
  const cycles = log[taskId];
  return Array.isArray(cycles) && cycles.length > 0;
}

// ---------------------------------------------------------------------------
// _buildFinalReason({ final_adherence_status, missing_items, partial_microsteps,
//                     out_of_contract_microsteps, evidence_sufficiency })
//
// Constrói reason auditável a partir do status final e dos desvios encontrados.
// ---------------------------------------------------------------------------
function _buildFinalReason({
  final_adherence_status,
  missing_items,
  partial_microsteps,
  out_of_contract_microsteps,
  evidence_sufficiency,
}) {
  if (final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE) {
    return "Contrato aderente — todos os itens contratuais cobertos, microetapas concluídas com evidência operacional.";
  }

  const reasons = [];

  if (out_of_contract_microsteps.length > 0) {
    reasons.push(
      `${out_of_contract_microsteps.length} microetapa(s) concluída(s) fora do contrato (não mapeiam nenhum item do definition_of_done): ${out_of_contract_microsteps.join(", ")}`
    );
  }
  if (missing_items.length > 0) {
    reasons.push(
      `${missing_items.length} item(ns) do definition_of_done não coberto(s) por nenhuma microetapa concluída: ${missing_items.join(" | ")}`
    );
  }
  if (partial_microsteps.length > 0) {
    reasons.push(
      `${partial_microsteps.length} microetapa(s) concluída(s) sem gate formal ou sem evidência operacional: ${partial_microsteps.join(", ")}`
    );
  }
  if (!evidence_sufficiency) {
    reasons.push("Evidência operacional insuficiente — nem todas as microetapas possuem ciclos de execução registrados.");
  }

  const prefix = final_adherence_status === CONTRACT_FINAL_STATUS.FORA
    ? "Contrato fora do contrato — desvio fatal detectado."
    : "Contrato parcialmente desviado — nem todos os requisitos contratuais foram atendidos.";

  return `${prefix} ${reasons.join(" | ")}`;
}

// ---------------------------------------------------------------------------
// _buildFinalNextAction(final_adherence_status)
//
// Ação coerente com o estado final do contrato.
// ---------------------------------------------------------------------------
function _buildFinalNextAction(final_adherence_status) {
  const actions = {
    [CONTRACT_FINAL_STATUS.ADERENTE]: "Contrato aderente ao conjunto contratual — pode ser marcado como concluído.",
    [CONTRACT_FINAL_STATUS.PARCIAL]:  "Contrato parcialmente desviado — revisar itens faltantes e microetapas sem aderência antes de fechar.",
    [CONTRACT_FINAL_STATUS.FORA]:     "Contrato fora do contrato — não fechar; revisar microetapas concluídas fora do definition_of_done e corrigir.",
  };
  return actions[final_adherence_status] || "Estado desconhecido — não fechar o contrato.";
}

// ---------------------------------------------------------------------------
// auditFinalContract({ state, decomposition })
//
// Gate principal de auditoria final pesada do contrato inteiro.
// Determinístico, auditável e sem I/O.
//
// Parâmetros:
//   state         {object} — estado canônico do contrato:
//     contract_id         {string}
//     definition_of_done  {string[]}  — itens contratuais exigidos
//     task_execution_log  {object}    — { [task_id]: cycle[] }
//   decomposition {object} — decomposição canônica:
//     tasks               {object[]} — { id, description, status }
//
// Retorna ContractFinalAudit:
//   {
//     contract_id,
//     final_adherence_status,
//     completed_microsteps,
//     adherent_microsteps,
//     partial_microsteps,
//     out_of_contract_microsteps,
//     missing_items,
//     unauthorized_items,
//     evidence_sufficiency,
//     final_reason,
//     final_next_action,
//     can_close_contract,
//   }
//
// Regras de classificação:
//   contrato_fora_do_contrato:   out_of_contract_microsteps.length > 0
//   contrato_aderente:           missing_items = [] AND partial = [] AND fora = [] AND evidence = true
//   contrato_parcial_desviado:   tudo o mais
//
// Lança:
//   Error — se state ou decomposition ausentes/inválidos
// ---------------------------------------------------------------------------
function auditFinalContract({ state, decomposition } = {}) {
  _validateState(state, "auditFinalContract");
  _validateDecomposition(decomposition, "auditFinalContract");

  const dod  = state.definition_of_done;      // string[]
  const tasks = decomposition.tasks || [];     // { id, description, status }[]

  // ─── 1. Normalizar DoD para comparação estrutural determinística ──────────
  // Gera um Set de DoD normalizados para lookup O(1)
  const dodNormalized = new Set(dod.map(_normalize));

  // Mapeamento DoD normalizado → item original (para relatório de faltantes)
  const dodByNormalized = new Map();
  for (const item of dod) {
    dodByNormalized.set(_normalize(item), item);
  }

  // ─── 2. Classificar tasks concluídas ─────────────────────────────────────
  const doneTasks = tasks.filter((t) => FINAL_TASK_DONE_STATUSES.includes(t.status));

  const completed_microsteps = doneTasks.map((t) => t.id);

  // Separar:
  //   adherent  — status "completed" (passou pelo gate PR1) E tem evidência operacional
  //   partial   — concluída sem gate formal (status ≠ "completed") OU sem evidência operacional
  //   out_of_contract — concluída mas não mapeia nenhum item do DoD
  const adherent_microsteps        = [];
  const partial_microsteps         = [];
  const out_of_contract_microsteps = [];
  const unauthorized_items         = [];

  for (const task of doneTasks) {
    const taskDescNorm = _normalize(task.description);
    const matchesDod   = dodNormalized.has(taskDescNorm);

    if (!matchesDod) {
      // Task concluída fora do contrato — não mapeia nenhum item do DoD
      out_of_contract_microsteps.push(task.id);
      unauthorized_items.push(task.description || task.id);
      continue;
    }

    // Task mapeia o DoD — verificar aderência e evidência
    const hasEvidence  = _hasOperationalEvidence(state, task.id);
    const throughGate  = task.status === "completed"; // gate formal da PR1

    if (throughGate && hasEvidence) {
      adherent_microsteps.push(task.id);
    } else {
      // Sem gate formal OU sem evidência → parcial/desviada
      partial_microsteps.push(task.id);
    }
  }

  // ─── 3. Detectar itens faltantes do DoD ──────────────────────────────────
  // Itens do DoD que não foram cobertos por nenhuma task concluída
  const doneTaskDescNorms = new Set(
    doneTasks
      .filter((t) => FINAL_TASK_DONE_STATUSES.includes(t.status))
      .map((t) => _normalize(t.description))
  );

  const missing_items = dod.filter((item) => !doneTaskDescNorms.has(_normalize(item)));

  // ─── 4. Evidência operacional global ─────────────────────────────────────
  // Toda task concluída que mapeia o DoD deve ter evidência operacional
  // (ao menos 1 ciclo registrado em task_execution_log).
  // "Suficiência" é falsa quando qualquer microetapa entregue — aderente
  // ou parcial — não possui ciclo de execução registrado.
  const dodMatchedDoneTasks = doneTasks.filter(
    (t) => dodNormalized.has(_normalize(t.description))
  );
  let evidence_sufficiency;
  if (dod.length === 0) {
    // Edge case: contrato sem DoD. Sem itens esperados, sem evidência exigível.
    // NOTA: Um contrato sem DoD que possui tasks concluídas terá todas elas
    // classificadas como `out_of_contract_microsteps` (pois nenhuma mapeia o DoD
    // vazio), bloqueando o fechamento por essa via. A ausência de DoD não é
    // um atalho para fechar um contrato com entregas não autorizadas.
    evidence_sufficiency = true;
  } else if (dodMatchedDoneTasks.length === 0) {
    // Existem itens de DoD mas nenhuma task concluída os cobre → sem evidência
    evidence_sufficiency = false;
  } else {
    // Toda task concluída que mapeia o DoD deve ter evidência operacional
    evidence_sufficiency = dodMatchedDoneTasks.every(
      (t) => _hasOperationalEvidence(state, t.id)
    );
  }

  // ─── 5. Classificação final canônica ─────────────────────────────────────
  let final_adherence_status;

  if (out_of_contract_microsteps.length > 0) {
    // Desvio fatal: entrega concluída que não está no contrato
    final_adherence_status = CONTRACT_FINAL_STATUS.FORA;
  } else if (
    missing_items.length === 0 &&
    partial_microsteps.length === 0 &&
    evidence_sufficiency
  ) {
    // Sem faltantes, sem parciais, sem fora, com evidência → aderente
    final_adherence_status = CONTRACT_FINAL_STATUS.ADERENTE;
  } else {
    // Faltantes OU parciais OU sem evidência (mas não fora) → parcial/desviado
    final_adherence_status = CONTRACT_FINAL_STATUS.PARCIAL;
  }

  // ─── 6. Gate de fechamento ────────────────────────────────────────────────
  const can_close_contract = final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE;

  // ─── 7. Reason e next_action auditáveis ──────────────────────────────────
  const final_reason = _buildFinalReason({
    final_adherence_status,
    missing_items,
    partial_microsteps,
    out_of_contract_microsteps,
    evidence_sufficiency,
  });

  const final_next_action = _buildFinalNextAction(final_adherence_status);

  return {
    contract_id:                state.contract_id,
    final_adherence_status,
    completed_microsteps,
    adherent_microsteps,
    partial_microsteps,
    out_of_contract_microsteps,
    missing_items,
    unauthorized_items,
    evidence_sufficiency,
    final_reason,
    final_next_action,
    can_close_contract,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  auditFinalContract,
  CONTRACT_FINAL_STATUS,
  FINAL_TASK_DONE_STATUSES,
};
