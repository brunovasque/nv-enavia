// ============================================================================
// 📦 ENAVIA — Execution Audit v1 (Blindagem Contratual — PR 2)
//
// Auditoria canônica de execução vs. contrato — ancorada na microetapa.
//
// Escopo: WORKER-ONLY. Não misturar com painel, P18 ou workflows.
//
// ─── Três modos de auditoria ─────────────────────────────────────────────────
//
//   [MODO PRINCIPAL — Ancorado na microetapa: "microstep_anchored"]
//   Quando microstep_id é fornecido:
//   Pivota a auditoria no microstep contratual canônico (task_id).
//   A chave principal é o microstep_id; execution_ids são evidência subordinada.
//   Compara:
//     • contract_microstep_reference — o que o contrato exige desta microetapa
//     • executor_artifacts_reference — o que o executor produziu (/audit+/propose)
//     • execution_cycles_reference   — ciclos operacionais desta microetapa
//   Uma microetapa pode ter múltiplos execution_ids ao longo do tempo.
//
//   [MODO FALLBACK 1 — Artefatos do executor sem microstep: "executor_artifacts"]
//   Quando executor_artifacts.audit.verdict presente mas microstep_id ausente:
//   Compara artefatos reais de /audit e /propose contra requisitos contratuais
//   globais (context_proof, constraints, verdict, risk_level, blockers, scope).
//
//   [MODO FALLBACK 2 — Decomposição de tasks: "task_decomposition"]
//   Quando nem microstep_id nem executor_artifacts estão presentes:
//   Compara definition_of_done vs. tasks completadas (estrutural).
//   Útil antes de /audit ser chamado ou durante setup do contrato.
//
// ─── Entradas ────────────────────────────────────────────────────────────────
//   state              — estado canônico do contrato (buildInitialState):
//     contract_id         {string}
//     goal                {string}
//     definition_of_done  {string[]}
//     scope               {object}
//       scope.workers     {string[]}  — workers autorizados
//     constraints         {object}
//   decomposition      — decomposição canônica (generateDecomposition):
//     tasks               {object[]} — cada task: { id, description, status }
//     micro_pr_candidates {object[]} — cada mpr: { id, task_id, environment, target_workers }
//   microstep_id       — identidade canônica da microetapa (= task_id, opcional):
//     Âncora principal da auditoria. Quando presente, o modo muda para
//     "microstep_anchored" e todos os dados são derivados desta microetapa.
//   executor_artifacts — artefatos reais do executor (/audit+/propose, opcional):
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
//     execution_id        {string}   — ID da tentativa de execução
//     target_worker_id    {string}   — worker auditado
//   execution_cycles   — ciclos operacionais da microetapa (opcional):
//     Cada ciclo: { execution_id?, micro_pr_id?, task_id?, execution_status?,
//                   execution_started_at?, execution_finished_at?,
//                   execution_evidence? }
//     Permite registrar múltiplas tentativas (1..N) para o mesmo microstep.
//
// ─── Saída canônica — modo "microstep_anchored" ───────────────────────────────
//   {
//     contract_id,
//     audit_mode:                    "microstep_anchored",
//     microstep_id,                  — task_id sendo auditado
//     execution_ids,                 — [execution_id, ...] 1..N tentativas (subordinadas)
//     contract_microstep_reference,  — o que o contrato exige desta microetapa
//     executor_artifacts_reference,  — o que o executor produziu (ou null se ausente)
//     execution_cycles_reference,    — ciclos operacionais { cycles, total, successful, failed }
//     missing_items,                 — requisitos não atendidos
//     unauthorized_items,            — violações de cláusula imutável
//     adherence_status,              — "aderente_ao_contrato"|"parcial_desviado"|"fora_do_contrato"
//     reason,
//     next_action,
//   }
//
// ─── Saída canônica — modo "executor_artifacts" / "task_decomposition" ────────
//   (backward-compat — sem microstep_id)
//   {
//     contract_id,
//     audit_mode,
//     microstep_id: null,
//     execution_ids: [],
//     contract_reference,            — goal + contracted_items + required_constraints
//     implemented_reference,
//     execution_cycles_reference: null,
//     missing_items,
//     unauthorized_items,
//     adherence_status,
//     reason,
//     next_action,
//   }
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
  MICROSTEP:           "microstep_anchored",
  EXECUTOR_ARTIFACTS:  "executor_artifacts",
  TASK_DECOMPOSITION:  "task_decomposition",
};

// ---------------------------------------------------------------------------
// AUDIT_TASK_DONE_STATUSES — statuses que indicam conclusão de task
//
// Espelha TASK_DONE_STATUSES de contract-executor.js.
// Definido localmente para evitar importação circular.
// Manter sincronizado com TASK_DONE_STATUSES se aquele for alterado.
// ---------------------------------------------------------------------------
const AUDIT_TASK_DONE_STATUSES = ["completed"];

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
// _hasExecutorAuditArtifacts(executor_artifacts)
//
// Retorna true quando executor_artifacts contém resultado real de /audit.
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
// _collectExecutionIds({ executor_artifacts, execution_cycles })
//
// Coleta todos os execution_ids conhecidos para uma microetapa (1..N).
// execution_id = identidade de uma tentativa/ciclo operacional.
// ---------------------------------------------------------------------------
function _collectExecutionIds({ executor_artifacts, execution_cycles }) {
  const ids = [];

  if (executor_artifacts && typeof executor_artifacts.execution_id === "string") {
    ids.push(executor_artifacts.execution_id);
  }

  for (const cycle of (Array.isArray(execution_cycles) ? execution_cycles : [])) {
    const id = (typeof cycle.execution_id === "string" ? cycle.execution_id : null)
      || (typeof cycle.micro_pr_id === "string" ? cycle.micro_pr_id : null);
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }

  return ids;
}

// ---------------------------------------------------------------------------
// _buildContractMicrostepReference(state, decomposition, task)
//
// Constrói o contract_microstep_reference — o que o contrato exige desta
// microetapa específica.
//
// Inclui:
//   task_id:                  identidade canônica (= microstep_id)
//   description:              descrição da task/microetapa
//   micro_pr_id:              ID do micro-PR vinculado a esta task (se houver)
//   environment:              ambiente alvo ("TEST" | "PROD")
//   target_workers:           workers autorizados para esta microetapa
//   definition_of_done_index: índice no DoD do contrato (-1 se não mapeado)
//   required_constraints:     requisitos imutáveis do contrato
// ---------------------------------------------------------------------------
function _buildContractMicrostepReference(state, decomposition, task) {
  const mprs = Array.isArray(decomposition.micro_pr_candidates)
    ? decomposition.micro_pr_candidates
    : [];

  // Micro-PR vinculado a esta task (prioriza TEST, pois é o primeiro a executar)
  const linkedMpr = mprs.find((m) => m.task_id === task.id && m.environment === "TEST")
    || mprs.find((m) => m.task_id === task.id)
    || null;

  const scopeWorkers = (linkedMpr && Array.isArray(linkedMpr.target_workers))
    ? linkedMpr.target_workers
    : (state.scope && Array.isArray(state.scope.workers) ? state.scope.workers : []);

  // Posição desta task no Definition of Done
  const dodIndex = state.definition_of_done.findIndex(
    (item) => _normalize(item) === _normalize(task.description)
  );

  return {
    task_id:                  task.id,
    description:              task.description || "",
    micro_pr_id:              linkedMpr ? linkedMpr.id : null,
    environment:              linkedMpr ? linkedMpr.environment : "TEST",
    target_workers:           scopeWorkers,
    definition_of_done_index: dodIndex,
    required_constraints: {
      context_used:              true,
      context_proof:             true,
      read_only:                 true,
      no_auto_apply:             true,
      verdict_required:          "approve",
      max_acceptable_risk_level: "medium",
    },
  };
}

// ---------------------------------------------------------------------------
// _buildExecutorArtifactsReference(executor_artifacts)
//
// Constrói o executor_artifacts_reference — o que o executor produziu.
// Sumariza os artefatos reais de /audit e /propose de forma auditável.
// ---------------------------------------------------------------------------
function _buildExecutorArtifactsReference(executor_artifacts) {
  const audit       = executor_artifacts.audit;
  const details     = (audit.details && typeof audit.details === "object") ? audit.details : {};
  const constraints = (details.constraints && typeof details.constraints === "object") ? details.constraints : {};
  const propose     = executor_artifacts.propose || null;

  return {
    execution_id:   typeof executor_artifacts.execution_id === "string"
      ? executor_artifacts.execution_id : null,
    target_worker:  typeof executor_artifacts.target_worker_id === "string"
      ? executor_artifacts.target_worker_id : null,
    verdict:        audit.verdict,
    risk_level:     audit.risk_level,
    context_used:   details.context_used === true,
    context_proof:  details.context_proof ? "presente" : "ausente",
    read_only:      constraints.read_only === true,
    no_auto_apply:  constraints.no_auto_apply === true,
    blockers:       Array.isArray(details.blockers) ? details.blockers : [],
    findings:       Array.isArray(audit.findings) ? audit.findings : [],
    propose_ok:     propose !== null ? propose.ok === true : null,
  };
}

// ---------------------------------------------------------------------------
// _buildExecutionCyclesReference(execution_cycles)
//
// Constrói o execution_cycles_reference — evidência dos ciclos operacionais
// desta microetapa (1..N tentativas).
// ---------------------------------------------------------------------------
function _buildExecutionCyclesReference(execution_cycles) {
  const cycles = (Array.isArray(execution_cycles) ? execution_cycles : []).map((c) => ({
    execution_id:  (typeof c.execution_id === "string" ? c.execution_id : null)
      || (typeof c.micro_pr_id === "string" ? c.micro_pr_id : null)
      || null,
    micro_pr_id:   typeof c.micro_pr_id === "string" ? c.micro_pr_id : null,
    task_id:       typeof c.task_id === "string" ? c.task_id : null,
    status:        typeof c.execution_status === "string" ? c.execution_status : null,
    started_at:    typeof c.execution_started_at === "string" ? c.execution_started_at : null,
    finished_at:   typeof c.execution_finished_at === "string" ? c.execution_finished_at : null,
    evidence:      Array.isArray(c.execution_evidence) ? c.execution_evidence : [],
  }));

  const successful = cycles.filter((c) => c.status === "success").length;
  const failed     = cycles.filter((c) => c.status === "failed").length;

  return {
    cycles,
    total:      cycles.length,
    successful,
    failed,
  };
}

// ---------------------------------------------------------------------------
// _checkExecutorConstraints(executor_artifacts_reference, contract_microstep_reference)
//
// Verifica os artefatos do executor contra os requisitos contratuais canônicos
// da microetapa.
//
// Retorna { missing_items, unauthorized_items } separados para classificação.
// ---------------------------------------------------------------------------
function _checkExecutorConstraints(artifactsRef, microstepRef) {
  const unauthorized_items = [];
  const missing_items      = [];

  // ── Cláusulas imutáveis — violations → unauthorized_items (fora_do_contrato)
  if (!artifactsRef.context_used) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: context_used: false — sem prova de leitura do worker-alvo (violação da cláusula L717)`
    );
  }
  if (artifactsRef.context_proof === "ausente") {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: context_proof: ausente — fingerprint/hash do worker-alvo não fornecido (cláusula L717)`
    );
  }
  if (!artifactsRef.read_only) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: constraints.read_only: false — constraint imutável violada`
    );
  }
  if (!artifactsRef.no_auto_apply) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: constraints.no_auto_apply: false — constraint imutável violada`
    );
  }

  // target_worker out of scope
  const scopeWorkers = microstepRef.target_workers;
  if (artifactsRef.target_worker && scopeWorkers.length > 0 &&
      !scopeWorkers.includes(artifactsRef.target_worker)) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: target_worker "${artifactsRef.target_worker}" fora do escopo [${scopeWorkers.join(", ")}]`
    );
  }

  // ── Requisitos de qualidade — não atendidos → missing_items (parcial_desviado)
  if (artifactsRef.verdict !== "approve") {
    missing_items.push(
      `microstep ${microstepRef.task_id}: verdict "approve" necessário — executor retornou "${artifactsRef.verdict}"`
    );
  }
  if (artifactsRef.risk_level === "high") {
    missing_items.push(
      `microstep ${microstepRef.task_id}: risk_level aceitável (low/medium) — executor reportou "${artifactsRef.risk_level}"`
    );
  }
  if (artifactsRef.blockers.length > 0) {
    const preview = artifactsRef.blockers.slice(0, 2).join(" | ");
    missing_items.push(
      `microstep ${microstepRef.task_id}: blockers: ${artifactsRef.blockers.length} presente(s) — ${preview}`
    );
  }

  return { missing_items, unauthorized_items };
}

// ---------------------------------------------------------------------------
// _auditViaMicrostep(state, decomposition, microstep_id, executor_artifacts, execution_cycles)
//
// MODO PRINCIPAL — Auditoria ancorada na microetapa contratual.
//
// microstep_id   = identidade canônica (task_id) — chave principal
// execution_ids  = prova operacional subordinada (1..N tentativas)
//
// Quando executor_artifacts presente: compara artefatos do executor contra
// requisitos contratuais da microetapa.
//
// Quando executor_artifacts ausente: compara apenas o status da task na
// decomposição (foi completada? está no DoD?).
// ---------------------------------------------------------------------------
function _auditViaMicrostep(state, decomposition, microstep_id, executor_artifacts, execution_cycles) {
  const task = (decomposition.tasks || []).find((t) => t.id === microstep_id);

  // Task não encontrada → fora_do_contrato (microetapa inválida)
  if (!task) {
    return {
      contract_id:                  state.contract_id,
      audit_mode:                   AUDIT_MODE.MICROSTEP,
      microstep_id,
      execution_ids:                _collectExecutionIds({ executor_artifacts, execution_cycles }),
      contract_microstep_reference: null,
      executor_artifacts_reference: _hasExecutorAuditArtifacts(executor_artifacts)
        ? _buildExecutorArtifactsReference(executor_artifacts) : null,
      execution_cycles_reference:   _buildExecutionCyclesReference(execution_cycles),
      missing_items:                [],
      unauthorized_items: [
        `microstep_id "${microstep_id}" não existe na decomposição do contrato "${state.contract_id}"`,
      ],
      adherence_status: EXECUTION_ADHERENCE_STATUS.FORA,
      reason:           `Microetapa "${microstep_id}" não encontrada no contrato — sem identidade contratual válida.`,
      next_action:      "Verificar microstep_id e garantir que está na decomposição do contrato.",
    };
  }

  const contractMicrostepRef = _buildContractMicrostepReference(state, decomposition, task);
  const executionCyclesRef   = _buildExecutionCyclesReference(execution_cycles);
  const executionIds         = _collectExecutionIds({ executor_artifacts, execution_cycles });

  let missing_items      = [];
  let unauthorized_items = [];
  let adherence_status;
  let reason;
  let next_action;

  if (_hasExecutorAuditArtifacts(executor_artifacts)) {
    // ── Modo MICROSTEP com artefatos do executor ─────────────────────────
    const artifactsRef = _buildExecutorArtifactsReference(executor_artifacts);
    const checked = _checkExecutorConstraints(artifactsRef, contractMicrostepRef);
    missing_items      = checked.missing_items;
    unauthorized_items = checked.unauthorized_items;

    if (unauthorized_items.length > 0) {
      adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
      const violations = unauthorized_items.slice(0, 2).join("; ");
      reason     = `Microetapa "${microstep_id}" fora do contrato — ${unauthorized_items.length} violação(ões) de cláusula imutável: ${violations}.`;
      next_action = "Violação de cláusula imutável — não carimbar; reexecutar /audit com prova de leitura válida.";
    } else if (missing_items.length === 0) {
      adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
      reason     = `Microetapa "${microstep_id}" aderente ao contrato — verdict: ${artifactsRef.verdict}, risk_level: ${artifactsRef.risk_level}, context_proof presente, todas as constraints imutáveis confirmadas.`;
      next_action = "Microetapa aderente — pode carimbar no Deploy Worker e avançar para a próxima microetapa.";
    } else {
      adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
      const gaps = missing_items.slice(0, 2).join("; ");
      reason     = `Microetapa "${microstep_id}" parcialmente desviada — ${missing_items.length} requisito(s) não atendido(s): ${gaps}.`;
      next_action = "Revisar patch e reexecutar /audit até obter verdict: approve sem blockers para esta microetapa.";
    }

    return {
      contract_id:                  state.contract_id,
      audit_mode:                   AUDIT_MODE.MICROSTEP,
      microstep_id,
      execution_ids:                executionIds,
      contract_microstep_reference: contractMicrostepRef,
      executor_artifacts_reference: artifactsRef,
      execution_cycles_reference:   executionCyclesRef,
      missing_items,
      unauthorized_items,
      adherence_status,
      reason,
      next_action,
    };
  }

  // ── Modo MICROSTEP sem artefatos do executor (verificação estrutural) ───
  // Verifica se a task foi completada e se está no DoD.
  const taskCompleted = AUDIT_TASK_DONE_STATUSES.includes(task.status);
  const dodNormalized = new Set(state.definition_of_done.map(_normalize));
  const taskInDoD     = dodNormalized.has(_normalize(task.description || ""));

  if (!taskInDoD) {
    unauthorized_items.push(
      `microstep "${microstep_id}" (description: "${task.description}"): não está no Definition of Done do contrato`
    );
  }
  if (!taskCompleted) {
    missing_items.push(
      `microstep "${microstep_id}": task com status "${task.status}" — ainda não completada`
    );
  }

  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
    reason     = `Microetapa "${microstep_id}" fora do contrato — descrição não está no Definition of Done.`;
    next_action = "Revisar decomposição: microetapa deve mapear para um item do Definition of Done.";
  } else if (missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
    reason     = `Microetapa "${microstep_id}" completada e aderente ao DoD do contrato (sem artefatos de /audit).`;
    next_action = "Task concluída — avançar para execução de /audit para prova formal antes de carimbar.";
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
    reason     = `Microetapa "${microstep_id}" em progresso — ainda não concluída.`;
    next_action = "Completar a microetapa e fornecer executor_artifacts com prova de /audit.";
  }

  return {
    contract_id:                  state.contract_id,
    audit_mode:                   AUDIT_MODE.MICROSTEP,
    microstep_id,
    execution_ids:                executionIds,
    contract_microstep_reference: contractMicrostepRef,
    executor_artifacts_reference: null,
    execution_cycles_reference:   executionCyclesRef,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action,
  };
}

// ---------------------------------------------------------------------------
// _auditViaExecutorArtifacts(state, executor_artifacts)
//
// MODO FALLBACK 1 — Auditoria global de artefatos do executor vs. contrato.
// Usado quando executor_artifacts está presente mas microstep_id ausente.
// Backward-compat com a versão anterior (sem microstep_id).
// ---------------------------------------------------------------------------
function _auditViaExecutorArtifacts(state, executor_artifacts) {
  const audit         = executor_artifacts.audit;
  const propose       = executor_artifacts.propose || null;
  const execution_id  = executor_artifacts.execution_id || null;
  const target_worker = typeof executor_artifacts.target_worker_id === "string"
    ? executor_artifacts.target_worker_id.trim() : null;

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
    ? state.scope.workers : [];

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
      scope_workers,
    },
  };

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

  const unauthorized_items = [];
  if (!context_used) {
    unauthorized_items.push("context_used: false — execução sem prova de leitura do worker-alvo (violação da cláusula L717)");
  }
  if (!context_proof) {
    unauthorized_items.push("context_proof: ausente — fingerprint/hash do worker-alvo não fornecido (cláusula L717 exige prova mínima)");
  }
  if (!read_only) {
    unauthorized_items.push("constraints.read_only: false — constraint imutável do /audit violada (não pode ser false)");
  }
  if (!no_auto_apply) {
    unauthorized_items.push("constraints.no_auto_apply: false — constraint imutável do /audit violada (não pode ser false)");
  }
  if (target_worker && scope_workers.length > 0 && !scope_workers.includes(target_worker)) {
    unauthorized_items.push(`target_worker: "${target_worker}" fora do escopo contratual [${scope_workers.join(", ")}]`);
  }

  const missing_items = [];
  if (verdict !== "approve") {
    missing_items.push(`verdict: "approve" — patch rejeitado pelo /audit (${verdict}); revisão necessária antes de prosseguir`);
  }
  if (risk_level === "high") {
    missing_items.push(`risk_level: aceitável (low/medium) — risco alto detectado (${risk_level}); patch precisa ser revisado`);
  }
  if (blockers.length > 0) {
    missing_items.push(`blockers: 0 esperado, ${blockers.length} presente(s) — ${blockers.slice(0, 3).join(" | ")}`);
  }

  let adherence_status;
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }

  let reason;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    reason = `Artefatos do executor aderentes ao contrato — verdict: ${verdict}, risk_level: ${risk_level}, context_used: true, context_proof presente, todas as constraints imutáveis confirmadas.`;
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    reason = `Execução fora do contrato — ${unauthorized_items.length} violação(ões) de cláusula imutável: ${unauthorized_items.slice(0, 2).join("; ")}.`;
  } else {
    reason = `Execução parcialmente desviada — ${missing_items.length} requisito(s) contratual(is) não atingido(s): ${missing_items.slice(0, 2).join("; ")}.`;
  }

  let next_action;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    next_action = "Artefatos do executor aderentes — pode carimbar no Deploy Worker e prosseguir.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    next_action = "Violação de cláusula imutável — não carimbar; revisar e reexecutar /audit com prova de leitura válida.";
  } else {
    next_action = "Revisar patch e reexecutar /audit até obter verdict: approve sem blockers.";
  }

  return {
    contract_id:                  state.contract_id,
    audit_mode:                   AUDIT_MODE.EXECUTOR_ARTIFACTS,
    microstep_id:                 null,
    execution_ids:                execution_id ? [execution_id] : [],
    contract_reference,
    implemented_reference,
    execution_cycles_reference:   null,
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
// MODO FALLBACK 2 — Comparação definition_of_done vs. tasks concluídas.
// Usado quando nem microstep_id nem executor_artifacts estão presentes.
// ---------------------------------------------------------------------------
function _auditViaTaskDecomposition(state, decomposition) {
  const contracted_items      = state.definition_of_done;
  const contracted_normalized = new Set(contracted_items.map(_normalize));
  const tasks                 = decomposition.tasks;

  const completed_tasks  = tasks.filter((t) => AUDIT_TASK_DONE_STATUSES.includes(t.status));
  const incomplete_tasks = tasks.filter((t) => !AUDIT_TASK_DONE_STATUSES.includes(t.status));

  const implemented_reference = completed_tasks.map((t) => t.description || t.id);
  const missing_items         = incomplete_tasks.map((t) => t.description || t.id);
  const unauthorized_items    = completed_tasks
    .filter((t) => !contracted_normalized.has(_normalize(t.description || "")))
    .map((t) => t.description || t.id);

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
    const items = unauthorized_items.map((i) => `"${i}"`).join(", ");
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
    contract_id:                  state.contract_id,
    audit_mode:                   AUDIT_MODE.TASK_DECOMPOSITION,
    microstep_id:                 null,
    execution_ids:                [],
    contract_reference: {
      goal:              state.goal || "",
      contracted_items,
    },
    implemented_reference,
    execution_cycles_reference:   null,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action,
  };
}

// ---------------------------------------------------------------------------
// auditExecution({ state, decomposition, microstep_id, executor_artifacts, execution_cycles })
//
// Auditoria canônica de execução contra contrato.
// Determinística, auditável e sem I/O.
//
// Roteamento:
//   1. microstep_id presente → _auditViaMicrostep (MODO PRINCIPAL)
//      Ancora a auditoria na microetapa contratual.
//      execution_id é evidência subordinada; microstep_id é a identidade.
//   2. microstep_id ausente + executor_artifacts presente → _auditViaExecutorArtifacts (FALLBACK 1)
//   3. Nenhum dos dois → _auditViaTaskDecomposition (FALLBACK 2)
//
// Parâmetros:
//   state              {object}   — estado canônico do contrato
//   decomposition      {object}   — decomposição canônica
//   microstep_id       {string}   — task_id da microetapa a auditar (opcional)
//   executor_artifacts {object}   — artefatos de /audit+/propose (opcional)
//   execution_cycles   {object[]} — ciclos operacionais da microetapa (opcional)
//
// Retorna ExecutionAudit (shape varia por audit_mode — ver comentário do módulo)
//
// Lança:
//   Error — se state ou decomposition ausentes/inválidos
// ---------------------------------------------------------------------------
function auditExecution({ state, decomposition, microstep_id, executor_artifacts, execution_cycles } = {}) {
  _validateState(state, "auditExecution");
  _validateDecomposition(decomposition, "auditExecution");

  // MODO PRINCIPAL — ancorado na microetapa
  if (typeof microstep_id === "string" && microstep_id.trim() !== "") {
    return _auditViaMicrostep(
      state,
      decomposition,
      microstep_id.trim(),
      executor_artifacts || null,
      execution_cycles || []
    );
  }

  // FALLBACK 1 — executor_artifacts presente sem microstep_id
  if (_hasExecutorAuditArtifacts(executor_artifacts)) {
    return _auditViaExecutorArtifacts(state, executor_artifacts);
  }

  // FALLBACK 2 — decomposição de tasks
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
