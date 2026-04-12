// ============================================================================
// 📦 ENAVIA — Execution Audit v1 (Blindagem Contratual — PR 2)
//
// Auditoria canônica de execução contra contrato.
// Compara o que foi contratado vs. o que foi implementado durante o fluxo
// operacional, de forma determinística e auditável.
//
// Escopo: WORKER-ONLY. Não misturar com painel, P18 ou workflows.
//
// ─── Entradas ────────────────────────────────────────────────────────────────
//   state         — estado canônico do contrato (buildInitialState):
//     contract_id         {string}
//     goal                {string}
//     definition_of_done  {string[]} — itens contratados
//     scope               {object}
//     status_global       {string}
//   decomposition — decomposição canônica (generateDecomposition):
//     tasks               {object[]} — tasks com id, description, status
//
// ─── Estrutura canônica de saída (ExecutionAudit) ────────────────────────────
//   contract_reference   — o que foi contratado (goal + definition_of_done)
//   implemented_reference — o que foi implementado (tasks concluídas)
//   missing_items        — o que faltou (tasks não concluídas)
//   unauthorized_items   — o que entrou sem autorização (tasks concluídas
//                          cujo description NÃO está em definition_of_done)
//   adherence_status     — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//   reason               — explicação auditável
//   next_action          — ação coerente com o estado
//
// ─── Regra de classificação ───────────────────────────────────────────────────
//   fora_do_contrato:     unauthorized_items.length > 0
//   aderente_ao_contrato: contracted_items.length > 0 &&
//                         missing_items.length === 0 &&
//                         unauthorized_items.length === 0
//   parcial_desviado:     demais casos (faltantes sem entradas não autorizadas)
//
// ─── Comparação determinística ────────────────────────────────────────────────
//   contracted_items   = state.definition_of_done
//   implemented_items  = tasks com status "completed" (description)
//   missing_items      = tasks NÃO concluídas (description)
//   unauthorized_items = tasks concluídas cujo description não está em
//                        definition_of_done (comparação case-insensitive/trim)
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - painel / UX visual
//   - persistência / I/O
//   - auditoria pesada final do plano inteiro
//   - P18 / PM10
//
// Blindagem Contratual PR 2 — auditoria de execução. Não misturar com PR 1.
// ============================================================================

// ---------------------------------------------------------------------------
// EXECUTION_ADHERENCE_STATUS — enum canônico dos estados de aderência
// ---------------------------------------------------------------------------
const EXECUTION_ADHERENCE_STATUS = {
  ADERENTE: "aderente_ao_contrato",
  PARCIAL:  "parcial_desviado",
  FORA:     "fora_do_contrato",
};

// ---------------------------------------------------------------------------
// TASK_DONE_STATUSES — statuses que indicam conclusão de task
//
// Espelha TASK_DONE_STATUSES de contract-executor.js.
// Definido localmente para evitar importação circular:
//   contract-executor.js → execution-audit.js → contract-executor.js (inválido).
// Manter sincronizado com TASK_DONE_STATUSES se aquele for alterado.
// ---------------------------------------------------------------------------
const AUDIT_TASK_DONE_STATUSES = ["completed"];

// ---------------------------------------------------------------------------
// _normalize(str)
//
// Normaliza string para comparação determinística:
//   - converte para lowercase
//   - remove espaços no início/fim
// ---------------------------------------------------------------------------
function _normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}

// ---------------------------------------------------------------------------
// _validateState(state, fnName)
//
// Valida campos mínimos de state necessários para a auditoria.
// Lança Error descritivo caso inválido.
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
//
// Valida campos mínimos de decomposition necessários para a auditoria.
// Lança Error descritivo caso inválido.
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
// _buildReason({ adherence_status, missing_items, unauthorized_items })
//
// Constrói reason auditável e explícita.
// ---------------------------------------------------------------------------
function _buildReason({ adherence_status, missing_items, unauthorized_items }) {
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    return "Execução aderente ao contrato — todos os itens contratados foram implementados sem entradas não autorizadas.";
  }

  if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    const items = unauthorized_items.map(i => `"${i}"`).join(", ");
    return `Execução fora do contrato — ${unauthorized_items.length} item(ns) implementado(s) sem autorização contratual: ${items}.`;
  }

  // PARCIAL
  const parts = [];
  if (missing_items.length > 0) {
    parts.push(`${missing_items.length} item(ns) contratado(s) não implementado(s)`);
  }
  return `Execução parcialmente desviada — ${parts.join("; ")}.`;
}

// ---------------------------------------------------------------------------
// _nextAction(adherence_status)
//
// Retorna next_action coerente com o estado de aderência.
// ---------------------------------------------------------------------------
function _nextAction(adherence_status) {
  switch (adherence_status) {
    case EXECUTION_ADHERENCE_STATUS.ADERENTE:
      return "Execução aderente ao contrato — pode prosseguir para validação e fechamento.";
    case EXECUTION_ADHERENCE_STATUS.FORA:
      return "Execução fora do contrato — revisar itens não autorizados e alinhar com contrato antes de prosseguir.";
    default:
      return "Execução parcialmente desviada — completar itens faltantes antes de prosseguir.";
  }
}

// ---------------------------------------------------------------------------
// auditExecution({ state, decomposition })
//
// Auditoria canônica de execução contra contrato.
// Determinística, auditável e sem I/O.
//
// Parâmetros:
//   state         {object} — estado canônico do contrato:
//     contract_id         {string}
//     goal                {string}
//     definition_of_done  {string[]}
//     scope               {object}
//     status_global       {string}
//   decomposition {object} — decomposição canônica:
//     tasks               {object[]} — cada task: { id, description, status }
//
// Retorna ExecutionAudit:
//   {
//     contract_id,          — string: ID do contrato
//     contract_reference,   — { goal, contracted_items }: o que foi contratado
//     implemented_reference,— string[]: o que foi implementado (descriptions das tasks concluídas)
//     missing_items,        — string[]: o que faltou (descriptions das tasks não concluídas)
//     unauthorized_items,   — string[]: o que entrou sem autorização (descriptions fora do DoD)
//     adherence_status,     — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//     reason,               — string auditável
//     next_action,          — string coerente com o estado
//   }
//
// Regras de classificação:
//   fora_do_contrato:     unauthorized_items.length > 0
//   aderente_ao_contrato: contracted_items.length > 0 &&
//                         missing_items.length === 0 &&
//                         unauthorized_items.length === 0
//   parcial_desviado:     demais casos
//
// Comparação determinística (sem LLM/embeddings):
//   contracted_items = state.definition_of_done
//   implemented_items = tasks com status "completed"
//   missing_items = tasks NÃO concluídas
//   unauthorized_items = tasks concluídas cujo description normalizado
//                        NÃO está em definition_of_done normalizado
//
// Lança:
//   Error — se state ou decomposition ausentes/inválidos
// ---------------------------------------------------------------------------
function auditExecution({ state, decomposition } = {}) {
  _validateState(state, "auditExecution");
  _validateDecomposition(decomposition, "auditExecution");

  const contracted_items = state.definition_of_done;

  // Normalizar DoD para comparação determinística
  const contracted_normalized = new Set(contracted_items.map(_normalize));

  const tasks = decomposition.tasks;

  // Separar tasks concluídas das não concluídas
  const completed_tasks = tasks.filter(t => AUDIT_TASK_DONE_STATUSES.includes(t.status));
  const incomplete_tasks = tasks.filter(t => !AUDIT_TASK_DONE_STATUSES.includes(t.status));

  // implemented_reference — descriptions das tasks concluídas
  const implemented_reference = completed_tasks.map(t => t.description || t.id);

  // missing_items — descriptions das tasks não concluídas
  const missing_items = incomplete_tasks.map(t => t.description || t.id);

  // unauthorized_items — tasks concluídas cujo description NÃO está no DoD
  const unauthorized_items = completed_tasks
    .filter(t => !contracted_normalized.has(_normalize(t.description || "")))
    .map(t => t.description || t.id);

  // ─── Classificação canônica ─────────────────────────────────────────────
  let adherence_status;

  if (unauthorized_items.length > 0) {
    // Qualquer item não autorizado → fora do contrato
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (contracted_items.length > 0 && missing_items.length === 0) {
    // Todos os itens contratados implementados e sem não autorizados → aderente
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    // Faltantes sem itens não autorizados → parcial
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }

  const reason      = _buildReason({ adherence_status, missing_items, unauthorized_items });
  const next_action = _nextAction(adherence_status);

  return {
    contract_id: state.contract_id,
    contract_reference: {
      goal:              state.goal || "",
      contracted_items,
    },
    implemented_reference,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  auditExecution,
  EXECUTION_ADHERENCE_STATUS,
  AUDIT_TASK_DONE_STATUSES,
};
