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
//     task_execution_log  {object}    — { [task_id]: cycle[] } (evidência real)
//   decomposition — decomposição canônica (generateDecomposition):
//     tasks               {object[]} — cada task: { id, description, status }
//
// ─── Saída canônica (ContractFinalAudit) ─────────────────────────────────────
//   contract_id                 — ID do contrato auditado
//   final_adherence_status      — "contrato_aderente" | "contrato_parcial_desviado" | "contrato_fora_do_contrato"
//   completed_microsteps        — string[]: IDs das tasks em FINAL_TASK_DONE_STATUSES
//   adherent_microsteps         — string[]: IDs das tasks com PR2 = aderente_ao_contrato
//   partial_microsteps          — string[]: IDs das tasks com PR2 = parcial_desviado
//   out_of_contract_microsteps  — string[]: IDs das tasks com PR2 = fora_do_contrato ou não no DoD
//   missing_items               — string[]: itens do DoD não cobertos por nenhuma task concluída
//   unauthorized_items          — string[]: descrições de tasks concluídas fora do DoD ou com violação PR2
//   evidence_sufficiency        — boolean: todas as tasks DoD-mapeadas passaram no PR2 como aderentes
//   microstep_pr2_audits        — object: { [task_id]: { adherence_status, reason, audit_mode } }
//   final_reason                — string auditável
//   final_next_action           — string coerente com o estado
//   can_close_contract          — boolean: false quando classificação não é "contrato_aderente"
//
// ─── Regra de classificação ──────────────────────────────────────────────────
//   Para cada microetapa concluída em FINAL_TASK_DONE_STATUSES:
//     a) Se não mapeia nenhum item do DoD → out_of_contract (fatal, macro-level)
//     b) Se mapeia o DoD → chama auditExecution() da PR 2 com microstep_id
//        ancorado no task_id e usando os ciclos do task_execution_log:
//          PR2 aderente_ao_contrato → adherent_microsteps
//          PR2 parcial_desviado     → partial_microsteps
//          PR2 fora_do_contrato     → out_of_contract_microsteps
//
//   contrato_fora_do_contrato:  out_of_contract_microsteps.length > 0
//   contrato_aderente:          missing_items = [] AND partial = [] AND fora = []
//                               AND evidence_sufficiency = true
//   contrato_parcial_desviado:  tudo o mais
//
// ─── Regra de fechamento ─────────────────────────────────────────────────────
//   can_close_contract = true  SOMENTE quando final_adherence_status === "contrato_aderente"
//
// ─── Critério de evidência ───────────────────────────────────────────────────
//   evidence_sufficiency exige que TODAS as tasks DoD-mapeadas concluídas
//   passem no PR 2 como aderente_ao_contrato. A mera presença de ciclos no
//   task_execution_log NÃO é suficiente — a auditoria de execução real da PR 2
//   (comparação executor vs. contrato) é o critério canônico.
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - painel / UX visual
//   - persistência / I/O
//   - lógica de microetapa individual (delegada à PR 1 e PR 2)
//
// Blindagem Contratual PR 3 — gate final pesado. Consolida PR 1 + PR 2.
// ============================================================================

import { auditExecution, EXECUTION_ADHERENCE_STATUS } from "./execution-audit.js";

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
// da PR 1 (evaluateAdherence). A PR 2 via auditExecution irá classificá-las
// como `parcial_desviado` (pois AUDIT_TASK_DONE_STATUSES = ["completed"]),
// impedindo o fechamento do contrato. Testado em S2b.
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
// _getCyclesFromLog(state, taskId)
//
// Retorna os ciclos de execução do task_execution_log para um dado task_id.
// Retorna array vazio se não houver registro.
// ---------------------------------------------------------------------------
function _getCyclesFromLog(state, taskId) {
  const log = state.task_execution_log;
  if (!log || typeof log !== "object") return [];
  const cycles = log[taskId];
  return Array.isArray(cycles) ? cycles : [];
}

// ---------------------------------------------------------------------------
// _resolveExecutorArtifactsFromCycles(cycles)
//
// Extrai executor_artifacts do task_execution_log.
// Retorna os executor_artifacts do ÚLTIMO ciclo que os possua, ou null.
//
// Espelha _resolveExecutorArtifactsFromLog() de contract-executor.js.
// Definido localmente para evitar importação circular.
// ---------------------------------------------------------------------------
function _resolveExecutorArtifactsFromCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const cycle = cycles[i];
    if (cycle && cycle.executor_artifacts && typeof cycle.executor_artifacts === "object") {
      return cycle.executor_artifacts;
    }
  }
  return null;
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
    return "Contrato aderente — todos os itens contratuais cobertos, microetapas auditadas pela PR 2 e aderentes ao contrato.";
  }

  const reasons = [];

  if (out_of_contract_microsteps.length > 0) {
    reasons.push(
      `${out_of_contract_microsteps.length} microetapa(s) concluída(s) fora do contrato (não mapeiam o DoD ou violação fatal na PR 2): ${out_of_contract_microsteps.join(", ")}`
    );
  }
  if (missing_items.length > 0) {
    reasons.push(
      `${missing_items.length} item(ns) do definition_of_done não coberto(s) por nenhuma microetapa concluída: ${missing_items.join(" | ")}`
    );
  }
  if (partial_microsteps.length > 0) {
    reasons.push(
      `${partial_microsteps.length} microetapa(s) com auditoria PR 2 parcial/desviada: ${partial_microsteps.join(", ")}`
    );
  }
  if (!evidence_sufficiency) {
    reasons.push("Evidência insuficiente — nem todas as microetapas passaram na auditoria PR 2 como aderentes ao contrato.");
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
    [CONTRACT_FINAL_STATUS.PARCIAL]:  "Contrato parcialmente desviado — revisar itens faltantes e microetapas com auditoria PR 2 não aderente antes de fechar.",
    [CONTRACT_FINAL_STATUS.FORA]:     "Contrato fora do contrato — não fechar; revisar microetapas fora do DoD ou com violação fatal na auditoria PR 2.",
  };
  return actions[final_adherence_status] || "Estado desconhecido — não fechar o contrato.";
}

// ---------------------------------------------------------------------------
// auditFinalContract({ state, decomposition })
//
// Gate principal de auditoria final pesada do contrato inteiro.
// Determinístico, auditável e sem I/O.
//
// Consolida a PR 2 (auditExecution por microetapa) no fechamento macro:
//   — Para cada task concluída mapeada no DoD, chama auditExecution() da PR 2
//     usando microstep_id = task.id e os ciclos/executor_artifacts do
//     task_execution_log.
//   — A mera presença de ciclos NÃO é critério suficiente; a auditoria PR 2
//     deve retornar aderente_ao_contrato para que a task seja considerada
//     aderente no fechamento macro.
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
//     microstep_pr2_audits,
//     final_reason,
//     final_next_action,
//     can_close_contract,
//   }
//
// Lança:
//   Error — se state ou decomposition ausentes/inválidos
// ---------------------------------------------------------------------------
function auditFinalContract({ state, decomposition } = {}) {
  _validateState(state, "auditFinalContract");
  _validateDecomposition(decomposition, "auditFinalContract");

  const dod   = state.definition_of_done;     // string[]
  const tasks = decomposition.tasks || [];    // { id, description, status }[]

  // ─── 1. Normalizar DoD para comparação estrutural determinística ──────────
  const dodNormalized = new Set(dod.map(_normalize));

  // ─── 2. Classificar tasks concluídas via PR 2 ────────────────────────────
  //
  // Para cada task concluída:
  //   a) DoD mismatch (macro): → out_of_contract_microsteps (sem audit PR2)
  //   b) Mapeada no DoD: chama auditExecution() da PR 2 com microstep_id e
  //      ciclos/executor_artifacts do task_execution_log:
  //        PR2 aderente_ao_contrato → adherent_microsteps
  //        PR2 parcial_desviado     → partial_microsteps
  //        PR2 fora_do_contrato     → out_of_contract_microsteps
  //
  const doneTasks = tasks.filter((t) => FINAL_TASK_DONE_STATUSES.includes(t.status));

  const completed_microsteps       = doneTasks.map((t) => t.id);
  const adherent_microsteps        = [];
  const partial_microsteps         = [];
  const out_of_contract_microsteps = [];
  const unauthorized_items         = [];

  // Per-microstep PR2 audit results — incluídos no snapshot para rastreabilidade
  const microstep_pr2_audits = {};

  for (const task of doneTasks) {
    const taskDescNorm = _normalize(task.description);
    const matchesDod   = dodNormalized.has(taskDescNorm);

    if (!matchesDod) {
      // Macro-level DoD mismatch — task concluída que não está no contrato
      // Não chama auditExecution (já é fora do contrato por definição macro)
      out_of_contract_microsteps.push(task.id);
      unauthorized_items.push(task.description || task.id);
      continue;
    }

    // ── Consolidar PR 2: chama auditExecution por microetapa ──────────────
    const cycles             = _getCyclesFromLog(state, task.id);
    const executor_artifacts = _resolveExecutorArtifactsFromCycles(cycles);

    const pr2Audit = auditExecution({
      state,
      decomposition,
      microstep_id:       task.id,
      executor_artifacts: executor_artifacts || null,
      execution_cycles:   cycles,
    });

    // Armazenar resultado PR2 para rastreabilidade no snapshot
    microstep_pr2_audits[task.id] = {
      adherence_status: pr2Audit.adherence_status,
      audit_mode:       pr2Audit.audit_mode,
      reason:           pr2Audit.reason,
    };

    // Mapear resultado PR2 para classificação macro
    if (pr2Audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
      adherent_microsteps.push(task.id);
    } else if (pr2Audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
      // PR2 detectou violação de cláusula imutável → fora do contrato macro
      out_of_contract_microsteps.push(task.id);
      unauthorized_items.push(task.description || task.id);
    } else {
      // PR2 retornou parcial_desviado
      partial_microsteps.push(task.id);
    }
  }

  // ─── 3. Detectar itens faltantes do DoD ──────────────────────────────────
  // Itens do DoD que não foram cobertos por nenhuma task concluída
  const doneTaskDescNorms = new Set(doneTasks.map((t) => _normalize(t.description)));
  const missing_items = dod.filter((item) => !doneTaskDescNorms.has(_normalize(item)));

  // ─── 4. Evidência suficiente — baseada em aderência real da PR 2 ─────────
  //
  // A simples presença de ciclos no task_execution_log NÃO é suficiente.
  // Critério real: todas as tasks DoD-mapeadas concluídas devem ter passado
  // na auditoria PR 2 como aderente_ao_contrato.
  //
  // Edge case: contrato sem DoD → sem itens esperados, sem exigência.
  //   Um contrato sem DoD com tasks concluídas terá todas classificadas como
  //   out_of_contract (macro DoD mismatch), bloqueando o fechamento por essa via.
  const dodMatchedDoneTasks = doneTasks.filter(
    (t) => dodNormalized.has(_normalize(t.description))
  );
  let evidence_sufficiency;
  if (dod.length === 0) {
    evidence_sufficiency = true;
  } else if (dodMatchedDoneTasks.length === 0) {
    // Itens de DoD existem mas nenhuma task concluída os cobre → sem evidência
    evidence_sufficiency = false;
  } else {
    // Todas as tasks DoD-mapeadas devem ser PR2-aderentes
    evidence_sufficiency = dodMatchedDoneTasks.every(
      (t) => adherent_microsteps.includes(t.id)
    );
  }

  // ─── 5. Classificação final canônica ─────────────────────────────────────
  let final_adherence_status;

  if (out_of_contract_microsteps.length > 0) {
    // Desvio fatal: entrega concluída fora do contrato (DoD mismatch ou PR2 fora)
    final_adherence_status = CONTRACT_FINAL_STATUS.FORA;
  } else if (
    missing_items.length === 0 &&
    partial_microsteps.length === 0 &&
    evidence_sufficiency
  ) {
    // Sem faltantes, sem parciais, sem fora, PR2 aderente em todas → aderente
    final_adherence_status = CONTRACT_FINAL_STATUS.ADERENTE;
  } else {
    // Faltantes OU parciais PR2 OU sem evidência PR2 → parcial/desviado
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
    microstep_pr2_audits,
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

