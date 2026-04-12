// ============================================================================
// 📦 ENAVIA — Execution Audit v1 (Blindagem Contratual — PR 2)
//
// Auditoria canônica de execução vs. contrato.
// Compara os artefatos REAIS produzidos pelo executor (/audit e /propose)
// contra os requisitos contratuais (goal, definition_of_done, constraints,
// scope), de forma determinística e auditável.
//
// Escopo: WORKER-ONLY. Não misturar com painel, P18 ou workflows.
//
// ─── Duas camadas de comparação ──────────────────────────────────────────────
//
//   [CAMADA 1 — Artefatos do executor: PRIMARY]
//   Quando executor_artifacts.audit.verdict está presente:
//   Compara os artefatos reais de /audit e /propose contra os requisitos
//   contratuais canônicos (context_proof, constraints, verdict, risk_level,
//   blockers, scope). Esta é a auditoria real de executor vs. contrato.
//
//   [CAMADA 2 — Decomposição de tasks: FALLBACK]
//   Quando executor_artifacts não for fornecido:
//   Compara definition_of_done vs. tasks completadas (comparação estrutural
//   de segundo nível — útil antes de /audit ser chamado ou em testes internos).
//
// ─── Entradas ────────────────────────────────────────────────────────────────
//   state            — estado canônico do contrato (buildInitialState):
//     contract_id         {string}
//     goal                {string}
//     definition_of_done  {string[]}
//     scope               {object}
//       scope.workers     {string[]}  — workers autorizados
//     constraints         {object}
//   decomposition    — decomposição canônica (generateDecomposition):
//     tasks               {object[]} — cada task: { id, description, status }
//   executor_artifacts — artefatos reais do executor (CAMADA 1, opcional):
//     audit               {object}   — resposta de POST /audit
//       verdict           {string}   — "approve" | "reject"
//       risk_level        {string}   — "low" | "medium" | "high"
//       findings          {string[]}
//       details           {object}
//         context_used    {boolean}  — prova de leitura do worker-alvo
//         context_proof   {object|null} — fingerprint/hash do worker-alvo
//         constraints     {object}
//           read_only     {boolean}  — constraint imutável do /audit
//           no_auto_apply {boolean}  — constraint imutável do /audit
//         blockers        {string[]}
//     propose             {object}   — resposta de POST /propose (opcional)
//     execution_id        {string}   — ID da execução
//     target_worker_id    {string}   — worker auditado
//
// ─── Estrutura canônica de saída (ExecutionAudit) ────────────────────────────
//   contract_id          — ID do contrato
//   audit_mode           — "executor_artifacts" | "task_decomposition"
//   contract_reference   — o que foi contratado
//   implemented_reference — o que foi implementado/produzido pelo executor
//   missing_items        — o que o contrato exige e não foi confirmado
//   unauthorized_items   — o que o executor fez que o contrato proíbe
//   adherence_status     — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//   reason               — explicação auditável
//   next_action          — ação coerente com o estado
//
// ─── Requisitos contratuais canônicos verificados (CAMADA 1) ─────────────────
//   1. context_used === true (prova de leitura do worker-alvo — cláusula L717)
//   2. context_proof existe (fingerprint/hash do worker-alvo — cláusula L717)
//   3. audit.details.constraints.read_only === true (constraint imutável)
//   4. audit.details.constraints.no_auto_apply === true (constraint imutável)
//   5. verdict === "approve" (para aderente)
//   6. risk_level !== "high" (risco aceitável — para aderente)
//   7. blockers.length === 0 (sem blockers — para aderente)
//   8. target_worker_id ∈ scope.workers (se scope.workers não-vazio)
//
// ─── Classificação canônica (CAMADA 1) ───────────────────────────────────────
//   fora_do_contrato:     unauthorized_items.length > 0
//     Triggers:
//       • context_used !== true (auditar sem ler o alvo — violação cardinal)
//       • context_proof ausente (sem fingerprint — violação cardinal)
//       • constraints.read_only !== true (constraint imutável violada)
//       • constraints.no_auto_apply !== true (constraint imutável violada)
//       • target_worker_id fora de scope.workers (fora do escopo)
//   aderente_ao_contrato: unauthorized_items.length === 0 &&
//                         missing_items.length === 0
//   parcial_desviado:     unauthorized_items.length === 0 &&
//                         missing_items.length > 0
//     Triggers:
//       • verdict !== "approve" (patch rejeitado — revisão necessária)
//       • risk_level === "high" (risco inaceitável)
//       • blockers.length > 0 (blockers impedem conclusão)
//
// ─── Classificação canônica (CAMADA 2 — fallback) ────────────────────────────
//   fora_do_contrato:     tasks concluídas fora do DoD
//   aderente_ao_contrato: todos os itens do DoD concluídos, sem extras
//   parcial_desviado:     itens faltantes sem extras não autorizados
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
// AUDIT_MODE — modo da auditoria (informativo, para rastreabilidade)
// ---------------------------------------------------------------------------
const AUDIT_MODE = {
  EXECUTOR_ARTIFACTS:  "executor_artifacts",
  TASK_DECOMPOSITION:  "task_decomposition",
};

// ---------------------------------------------------------------------------
// AUDIT_TASK_DONE_STATUSES — statuses que indicam conclusão de task
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
// Normaliza string para comparação determinística.
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
// _hasExecutorAuditArtifacts(executor_artifacts)
//
// Retorna true quando executor_artifacts contém um resultado real de /audit
// com verdict e risk_level — indicando que a CAMADA 1 deve ser usada.
// ---------------------------------------------------------------------------
function _hasExecutorAuditArtifacts(executor_artifacts) {
  return (
    executor_artifacts !== null &&
    typeof executor_artifacts === "object" &&
    executor_artifacts.audit !== null &&
    typeof executor_artifacts.audit === "object" &&
    typeof executor_artifacts.audit.verdict === "string" &&
    typeof executor_artifacts.audit.risk_level === "string"
  );
}

// ---------------------------------------------------------------------------
// _auditViaExecutorArtifacts(state, executor_artifacts)
//
// CAMADA 1 — Auditoria real: compara artefatos do executor contra requisitos
// contratuais canônicos.
//
// Requisitos verificados:
//   1. context_used === true (prova de leitura do worker-alvo)
//   2. context_proof existe (fingerprint/hash)
//   3. constraints.read_only === true (constraint imutável)
//   4. constraints.no_auto_apply === true (constraint imutável)
//   5. verdict === "approve" (patch aprovado)
//   6. risk_level !== "high" (risco aceitável)
//   7. blockers.length === 0 (sem blockers)
//   8. target_worker_id ∈ scope.workers (escopo autorizado)
// ---------------------------------------------------------------------------
function _auditViaExecutorArtifacts(state, executor_artifacts) {
  const audit         = executor_artifacts.audit;
  const propose       = executor_artifacts.propose || null;
  const execution_id  = executor_artifacts.execution_id || null;
  const target_worker = typeof executor_artifacts.target_worker_id === "string"
    ? executor_artifacts.target_worker_id.trim()
    : null;

  const verdict     = audit.verdict;
  const risk_level  = audit.risk_level;
  const findings    = Array.isArray(audit.findings) ? audit.findings : [];
  const details     = (audit.details && typeof audit.details === "object") ? audit.details : {};
  const constraints = (details.constraints && typeof details.constraints === "object") ? details.constraints : {};
  const blockers    = Array.isArray(details.blockers) ? details.blockers : [];

  const context_used  = details.context_used === true;
  const context_proof = details.context_proof || null;
  const read_only     = constraints.read_only === true;
  const no_auto_apply = constraints.no_auto_apply === true;

  const scope_workers = Array.isArray(state.scope && state.scope.workers)
    ? state.scope.workers
    : [];

  // ── Contract reference ─────────────────────────────────────────────────
  const contract_reference = {
    goal:               state.goal || "",
    contracted_items:   state.definition_of_done,
    required_constraints: {
      context_used:              true,
      context_proof:             true,
      read_only:                 true,
      no_auto_apply:             true,
      verdict_required:          "approve",
      max_acceptable_risk_level: "medium",
      scope_workers:             scope_workers,
    },
  };

  // ── Implemented reference (what the executor actually produced) ────────
  const implemented_reference = [
    `verdict: ${verdict}`,
    `risk_level: ${risk_level}`,
    `context_used: ${context_used}`,
    `context_proof: ${context_proof ? "presente" : "ausente"}`,
    `constraints.read_only: ${read_only}`,
    `constraints.no_auto_apply: ${no_auto_apply}`,
    `blockers: ${blockers.length} item(s)`,
  ];
  if (execution_id)  implemented_reference.push(`execution_id: ${execution_id}`);
  if (target_worker) implemented_reference.push(`target_worker: ${target_worker}`);
  if (propose)       implemented_reference.push(`propose: ok=${propose.ok === true}`);

  // ── unauthorized_items — violations of immutable contract clauses ──────
  const unauthorized_items = [];

  if (!context_used) {
    unauthorized_items.push(
      "context_used: false — execução sem prova de leitura do worker-alvo (violação da cláusula L717)"
    );
  }
  if (!context_proof) {
    unauthorized_items.push(
      "context_proof: ausente — fingerprint/hash do worker-alvo não fornecido (cláusula L717 exige prova mínima)"
    );
  }
  if (!read_only) {
    unauthorized_items.push(
      "constraints.read_only: false — constraint imutável do /audit violada (não pode ser false)"
    );
  }
  if (!no_auto_apply) {
    unauthorized_items.push(
      "constraints.no_auto_apply: false — constraint imutável do /audit violada (não pode ser false)"
    );
  }
  if (target_worker && scope_workers.length > 0 && !scope_workers.includes(target_worker)) {
    unauthorized_items.push(
      `target_worker: "${target_worker}" fora do escopo contratual [${scope_workers.join(", ")}]`
    );
  }

  // ── missing_items — required outcomes not achieved (not cardinal violations)
  const missing_items = [];

  if (verdict !== "approve") {
    missing_items.push(
      `verdict: "approve" — patch rejeitado pelo /audit (${verdict}); revisão necessária antes de prosseguir`
    );
  }
  if (risk_level === "high") {
    missing_items.push(
      `risk_level: aceitável (low/medium) — risco alto detectado (${risk_level}); patch precisa ser revisado`
    );
  }
  if (blockers.length > 0) {
    const blockerList = blockers.slice(0, 3).join(" | ");
    missing_items.push(
      `blockers: 0 esperado, ${blockers.length} presente(s) — ${blockerList}`
    );
  }

  // ── Classification ────────────────────────────────────────────────────
  let adherence_status;
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }

  // ── Reason ───────────────────────────────────────────────────────────
  let reason;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    reason = `Artefatos do executor aderentes ao contrato — verdict: ${verdict}, risk_level: ${risk_level}, context_used: true, context_proof presente, todas as constraints imutáveis confirmadas.`;
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    const violations = unauthorized_items.slice(0, 2).join("; ");
    reason = `Execução fora do contrato — ${unauthorized_items.length} violação(ões) de cláusula imutável: ${violations}.`;
  } else {
    const gaps = missing_items.slice(0, 2).join("; ");
    reason = `Execução parcialmente desviada — ${missing_items.length} requisito(s) contratual(is) não atingido(s): ${gaps}.`;
  }

  // ── Next action ───────────────────────────────────────────────────────
  let next_action;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    next_action = "Artefatos do executor aderentes — pode carimbar no Deploy Worker e prosseguir.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    next_action = "Violação de cláusula imutável — não carimbar; revisar e reexecutar /audit com prova de leitura válida.";
  } else {
    next_action = "Revisar patch e reexecutar /audit até obter verdict: approve sem blockers.";
  }

  return {
    contract_id:           state.contract_id,
    audit_mode:            AUDIT_MODE.EXECUTOR_ARTIFACTS,
    contract_reference,
    implemented_reference,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action,
  };
}

// ---------------------------------------------------------------------------
// _auditViaTaskDecomposition(state, decomposition)
//
// CAMADA 2 — Fallback: compara definition_of_done vs. tasks concluídas.
// Usado quando executor_artifacts não está disponível (ex: antes de /audit
// ser chamado, em testes internos, ou durante setup do contrato).
// ---------------------------------------------------------------------------
function _auditViaTaskDecomposition(state, decomposition) {
  const contracted_items     = state.definition_of_done;
  const contracted_normalized = new Set(contracted_items.map(_normalize));
  const tasks                = decomposition.tasks;

  const completed_tasks  = tasks.filter(t => AUDIT_TASK_DONE_STATUSES.includes(t.status));
  const incomplete_tasks = tasks.filter(t => !AUDIT_TASK_DONE_STATUSES.includes(t.status));

  const implemented_reference = completed_tasks.map(t => t.description || t.id);
  const missing_items         = incomplete_tasks.map(t => t.description || t.id);
  const unauthorized_items    = completed_tasks
    .filter(t => !contracted_normalized.has(_normalize(t.description || "")))
    .map(t => t.description || t.id);

  let adherence_status;
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (contracted_items.length > 0 && missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }

  let reason;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    reason = "Execução aderente ao contrato — todos os itens contratados foram implementados sem entradas não autorizadas.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    const items = unauthorized_items.map(i => `"${i}"`).join(", ");
    reason = `Execução fora do contrato — ${unauthorized_items.length} task(s) concluída(s) fora do Definition of Done: ${items}.`;
  } else {
    reason = `Execução parcialmente desviada — ${missing_items.length} item(ns) contratado(s) não implementado(s).`;
  }

  let next_action;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    next_action = "Decomposição de tasks aderente — pode avançar para /audit com os artefatos do executor.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    next_action = "Tasks fora do DoD detectadas — revisar decomposição antes de executar /audit.";
  } else {
    next_action = "Tasks incompletas — completar os itens faltantes antes de avançar.";
  }

  return {
    contract_id:           state.contract_id,
    audit_mode:            AUDIT_MODE.TASK_DECOMPOSITION,
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
// auditExecution({ state, decomposition, executor_artifacts })
//
// Auditoria canônica de execução contra contrato.
// Determinística, auditável e sem I/O.
//
// CAMADA 1 (executor_artifacts presente com audit.verdict):
//   Compara os artefatos reais de /audit e /propose contra os requisitos
//   contratuais canônicos. Esta é a auditoria principal.
//
// CAMADA 2 (executor_artifacts ausente):
//   Compara definition_of_done vs. tasks concluídas. Útil antes de /audit
//   ser chamado, ou para rastrear progresso estrutural das tasks.
//
// Parâmetros:
//   state              {object} — estado canônico do contrato
//   decomposition      {object} — decomposição canônica
//   executor_artifacts {object} — artefatos reais do executor (opcional):
//     audit               {object}   — resposta de POST /audit
//       verdict           {string}   — "approve" | "reject"
//       risk_level        {string}   — "low" | "medium" | "high"
//       findings          {string[]}
//       details           {object}
//         context_used    {boolean}
//         context_proof   {object|null}
//         constraints     {object}
//           read_only     {boolean}
//           no_auto_apply {boolean}
//         blockers        {string[]}
//     propose             {object}   — resposta de POST /propose (opcional)
//     execution_id        {string}
//     target_worker_id    {string}   — worker auditado
//
// Retorna ExecutionAudit:
//   {
//     contract_id,
//     audit_mode,           — "executor_artifacts" | "task_decomposition"
//     contract_reference,
//     implemented_reference,
//     missing_items,
//     unauthorized_items,
//     adherence_status,     — "aderente_ao_contrato" | "parcial_desviado" | "fora_do_contrato"
//     reason,
//     next_action,
//   }
//
// Lança:
//   Error — se state ou decomposition ausentes/inválidos
// ---------------------------------------------------------------------------
function auditExecution({ state, decomposition, executor_artifacts } = {}) {
  _validateState(state, "auditExecution");
  _validateDecomposition(decomposition, "auditExecution");

  if (_hasExecutorAuditArtifacts(executor_artifacts)) {
    return _auditViaExecutorArtifacts(state, executor_artifacts);
  }

  return _auditViaTaskDecomposition(state, decomposition);
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  auditExecution,
  EXECUTION_ADHERENCE_STATUS,
  AUDIT_TASK_DONE_STATUSES,
  AUDIT_MODE,
};
