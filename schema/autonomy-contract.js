// ============================================================================
// 📦 ENAVIA — Autonomy Contract v1 (P23 — Frente 6: Autonomia e Braços)
//
// Contrato canônico de autonomia da Enavia.
// Define o que a Enavia pode fazer sozinha, o que exige OK humano,
// o que é proibido, quais gates devem ser validados antes de ação sensível,
// e como futuros braços especialistas (P24/P25/P26) devem obedecer.
//
// Decisões fechadas pelo usuário:
//   1. Após definição de plano/contrato/tarefa → só inicia com OK humano.
//   2. Após início → loop autônomo até finalizar o objetivo.
//   3. Em TEST → autonomia total dentro do escopo aprovado.
//   4. Serviço externo não definido → declarar necessidade, esperar OK.
//   5. Nunca promover para PROD sem OK humano.
//   6. Nunca sair do escopo.
//   7. Proibido regredir contrato/plano/tarefa.
//   8. Proibido mexer na observabilidade.
//   9. OK humano é só o inicial; microetapas seguem por memória/loop.
//  10. Risco alto → medir antes e informar.
//  11. Conflito de escopo → detectar antes de executar.
//  12. Falha repetida → 2–3 retries, depois escalar.
//  13. Dúvida de ambiente não pode existir em runtime.
//  14. Evidência insuficiente para promover → tentar gerar; se não, escalar.
//
// NÃO contém:
//   - Implementação de braço GitHub (P24)
//   - Implementação de browser executor (P25)
//   - Implementação de deploy/test como braço (P26)
//   - LLM / embeddings / heurística opaca
//   - Persistência / I/O
//
// P23 APENAS — não misturar com P24/P25/P26.
// ============================================================================

// ---------------------------------------------------------------------------
// ENVIRONMENT — ambientes canônicos reconhecidos
// ---------------------------------------------------------------------------
const ENVIRONMENT = {
  TEST: "TEST",
  PROD: "PROD",
};

// ---------------------------------------------------------------------------
// AUTONOMY_LEVEL — níveis canônicos de autonomia
// ---------------------------------------------------------------------------
const AUTONOMY_LEVEL = {
  AUTONOMOUS:       "autonomous",        // ação permitida sem novo OK
  REQUIRES_HUMAN:   "requires_human_ok", // exige OK humano explícito
  PROHIBITED:       "prohibited",        // proibido em qualquer circunstância
};

// ---------------------------------------------------------------------------
// A1. PRE_EXECUTION_ACTIONS — ações permitidas ANTES do OK humano inicial
//
// A Enavia pode fazer tudo isto sem precisar de OK humano.
// São ações de leitura, diagnóstico, classificação, planejamento e preparação.
// Não iniciam execução de nenhum plano/contrato/tarefa.
// ---------------------------------------------------------------------------
const PRE_EXECUTION_ACTIONS = [
  "read",
  "read_only_diagnostic",
  "classify",
  "build_plan",
  "query_memory",
  "query_health",
  "query_execution_state",
  "prepare_payload",
];

// ---------------------------------------------------------------------------
// A2. POST_START_AUTONOMOUS_ACTIONS — ações autônomas APÓS o OK humano inicial
//
// Após o OK humano que inicia a execução, a Enavia entra em loop autônomo
// e pode executar estas ações até finalizar o objetivo, desde que dentro
// do escopo aprovado. O OK humano é só o inicial; microetapas internas
// seguem por memória/loop do contrato.
// ---------------------------------------------------------------------------
const POST_START_AUTONOMOUS_ACTIONS = [
  "execute_in_test_within_scope",
  "reexecute_in_test_within_scope",
  "internal_loop_until_objective_done",
  "operate_external_service_in_test_within_scope",
];

// ---------------------------------------------------------------------------
// A. ALLOWED_ACTIONS — união de pré-execução + pós-início
//
// Catálogo completo de ações autônomas (sem novo OK) em qualquer fase.
// Para consulta de fase específica, usar PRE_EXECUTION_ACTIONS ou
// POST_START_AUTONOMOUS_ACTIONS.
// ---------------------------------------------------------------------------
const ALLOWED_ACTIONS = [
  ...PRE_EXECUTION_ACTIONS,
  ...POST_START_AUTONOMOUS_ACTIONS,
];

// ---------------------------------------------------------------------------
// B. HUMAN_OK_REQUIRED_ACTIONS — ações que exigem OK humano explícito
// ---------------------------------------------------------------------------
const HUMAN_OK_REQUIRED_ACTIONS = [
  "start_plan_execution",
  "start_contract_execution",
  "start_task_execution",
  "promote_to_prod",
  "act_on_undefined_external_service",
  "change_scope",
];

// ---------------------------------------------------------------------------
// C. PROHIBITED_ACTIONS — ações proibidas incondicionalmente
// ---------------------------------------------------------------------------
const PROHIBITED_ACTIONS = [
  "exit_scope",
  "regress_contract",
  "regress_plan",
  "regress_task",
  "modify_observability",
  "promote_to_prod_without_human_ok",
  "act_with_scope_conflict",
  "continue_after_repeated_failure_without_escalation",
  "act_without_sufficient_evidence_when_promotion_depends_on_it",
];

// ---------------------------------------------------------------------------
// D. GATES — gates obrigatórios antes de ação sensível
//
// Cada gate retorna { passed: boolean, reason: string }.
// Todos os gates devem passar antes de permitir ação sensível.
// ---------------------------------------------------------------------------
const REQUIRED_GATES = [
  "scope_defined",
  "environment_defined",
  "risk_assessed",
  "authorization_present_when_required",
  "observability_preserved",
  "evidence_available_when_required",
];

// ---------------------------------------------------------------------------
// E. FAILURE_POLICY — política de falha e escalonamento
// ---------------------------------------------------------------------------
const FAILURE_POLICY = {
  max_retries:                   3,
  min_retries:                   2,
  action_on_max_retries:         "block_and_escalate_to_human",
  high_risk_policy:              "report_before_execution",
  insufficient_evidence_policy:  "block_and_escalate_with_reason",
};

// ---------------------------------------------------------------------------
// F. SPECIALIST_ARM_POLICY — compatibilidade futura P24/P25/P26
//
// Todo braço especialista futuro (P24 GitHub, P25 Browser, P26 Deploy/Test)
// deve obedecer este contrato de autonomia como subordinado.
// ---------------------------------------------------------------------------
const SPECIALIST_ARM_POLICY = {
  p24_github_arm:    "subordinate_to_autonomy_contract",
  p25_browser_arm:   "subordinate_to_autonomy_contract",
  p26_deploy_test:   "must_validate_gate_autonomy_scope_before_sensitive_action",
  general_rule:      "no_arm_can_override_autonomy_contract",
};

// ---------------------------------------------------------------------------
// classifyAction(action)
//
// Classifica uma ação no nível de autonomia canônico.
//
// Parâmetros:
//   action {string} — identificador da ação
//
// Retorna:
//   {
//     action,
//     autonomy_level,  — "autonomous" | "requires_human_ok" | "prohibited"
//     reason,          — string auditável
//   }
//
// Lança:
//   Error — se action ausente ou não-string
// ---------------------------------------------------------------------------
function classifyAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyAction: 'action' é obrigatório e deve ser string não-vazia");
  }

  const a = action.trim();

  if (ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      reason: `Ação '${a}' é permitida sem novo OK humano após início aprovado.`,
    };
  }

  if (HUMAN_OK_REQUIRED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: `Ação '${a}' exige OK humano explícito antes de execução.`,
    };
  }

  if (PROHIBITED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      reason: `Ação '${a}' é proibida incondicionalmente pelo contrato de autonomia.`,
    };
  }

  // Ação desconhecida → tratada como requerendo OK humano (princípio da cautela)
  return {
    action: a,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    reason: `Ação '${a}' não catalogada no contrato — requer OK humano por cautela.`,
  };
}

// ---------------------------------------------------------------------------
// evaluateGates(context)
//
// Avalia todos os gates obrigatórios antes de ação sensível.
//
// Parâmetros:
//   context {object}:
//     scope_defined                       {boolean}
//     environment_defined                 {boolean}
//     risk_assessed                       {boolean}
//     authorization_present_when_required {boolean}
//     observability_preserved             {boolean}
//     evidence_available_when_required    {boolean}
//
// Retorna:
//   {
//     all_gates_passed, — boolean
//     gates,            — { [gate_name]: { passed, reason } }
//     failed_gates,     — string[] (nomes dos gates que falharam)
//     can_proceed,      — boolean (espelha all_gates_passed)
//     reason,           — string auditável
//   }
//
// Lança:
//   Error — se context ausente ou não-objeto
// ---------------------------------------------------------------------------
function evaluateGates(context) {
  if (!context || typeof context !== "object") {
    throw new Error("evaluateGates: 'context' é obrigatório e deve ser um objeto");
  }

  const gates = {};
  const failed_gates = [];

  for (const gate of REQUIRED_GATES) {
    const value = context[gate];
    const passed = value === true;
    const reason = passed
      ? `Gate '${gate}' passou.`
      : `Gate '${gate}' falhou — condição não satisfeita.`;

    gates[gate] = { passed, reason };

    if (!passed) {
      failed_gates.push(gate);
    }
  }

  const all_gates_passed = failed_gates.length === 0;

  const reason = all_gates_passed
    ? "Todos os gates obrigatórios passaram — ação sensível permitida."
    : `${failed_gates.length} gate(s) falhou(aram): ${failed_gates.join(", ")}. Ação sensível bloqueada.`;

  return {
    all_gates_passed,
    gates,
    failed_gates,
    can_proceed: all_gates_passed,
    reason,
  };
}

// ---------------------------------------------------------------------------
// evaluateFailurePolicy({ attempt, is_high_risk, has_sufficient_evidence })
//
// Avalia a política de falha e escalonamento para a tentativa atual.
//
// Parâmetros:
//   attempt                 {number}  — número da tentativa (1-based)
//   is_high_risk            {boolean} — se a ação é considerada de risco alto
//   has_sufficient_evidence {boolean} — se há evidência suficiente para promover
//
// Retorna:
//   {
//     can_continue,       — boolean
//     must_escalate,      — boolean
//     reason,             — string auditável
//     escalation_type,    — "none" | "max_retries" | "high_risk" | "insufficient_evidence"
//   }
//
// Lança:
//   Error — se parâmetros ausentes ou inválidos
// ---------------------------------------------------------------------------
function evaluateFailurePolicy({ attempt, is_high_risk, has_sufficient_evidence } = {}) {
  if (typeof attempt !== "number" || attempt < 1) {
    throw new Error("evaluateFailurePolicy: 'attempt' é obrigatório e deve ser number >= 1");
  }
  if (typeof is_high_risk !== "boolean") {
    throw new Error("evaluateFailurePolicy: 'is_high_risk' é obrigatório e deve ser boolean");
  }
  if (typeof has_sufficient_evidence !== "boolean") {
    throw new Error("evaluateFailurePolicy: 'has_sufficient_evidence' é obrigatório e deve ser boolean");
  }

  // Risco alto → reportar antes da execução, escalar
  if (is_high_risk) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: "Risco alto detectado — execução bloqueada até reporte e autorização humana.",
      escalation_type: "high_risk",
    };
  }

  // Evidência insuficiente para promoção
  if (!has_sufficient_evidence) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: "Evidência insuficiente para promoção — bloqueio explícito e chamada ao usuário com motivo.",
      escalation_type: "insufficient_evidence",
    };
  }

  // Max retries atingido → bloquear e escalar
  if (attempt > FAILURE_POLICY.max_retries) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: `Tentativa ${attempt} excede o máximo de ${FAILURE_POLICY.max_retries} retries — bloqueio e escalonamento ao usuário.`,
      escalation_type: "max_retries",
    };
  }

  // Dentro do limite de retries e sem condições de bloqueio
  return {
    can_continue: true,
    must_escalate: false,
    reason: `Tentativa ${attempt} de ${FAILURE_POLICY.max_retries} — pode continuar.`,
    escalation_type: "none",
  };
}

// ---------------------------------------------------------------------------
// evaluateEnvironmentAutonomy({ environment, action, scope_approved })
//
// Avalia se a ação é permitida no ambiente dado, considerando o escopo.
//
// Regras:
//   TEST  + dentro do escopo aprovado → autônomo
//   TEST  + fora do escopo           → proibido (sair do escopo nunca é ok)
//   PROD  + promoção                 → requer OK humano
//   PROD  + execução operacional     → requer OK humano
//
// Parâmetros:
//   environment    {string}  — "TEST" | "PROD"
//   action         {string}  — identificador da ação
//   scope_approved {boolean} — se a ação está dentro do escopo aprovado
//
// Retorna:
//   {
//     environment,
//     action,
//     autonomy_level,
//     can_proceed,
//     reason,
//   }
//
// Lança:
//   Error — se parâmetros ausentes ou inválidos
// ---------------------------------------------------------------------------
function evaluateEnvironmentAutonomy({ environment, action, scope_approved } = {}) {
  if (typeof environment !== "string" || !Object.values(ENVIRONMENT).includes(environment)) {
    throw new Error(
      `evaluateEnvironmentAutonomy: 'environment' deve ser "${ENVIRONMENT.TEST}" ou "${ENVIRONMENT.PROD}"`
    );
  }
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("evaluateEnvironmentAutonomy: 'action' é obrigatório e deve ser string não-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("evaluateEnvironmentAutonomy: 'scope_approved' é obrigatório e deve ser boolean");
  }

  const a = action.trim();

  // Fora do escopo → proibido em qualquer ambiente
  if (!scope_approved) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      can_proceed: false,
      reason: `Ação '${a}' fora do escopo aprovado — proibida em ${environment}.`,
    };
  }

  // Ação proibida incondicionalmente → proibido em qualquer ambiente
  if (PROHIBITED_ACTIONS.includes(a)) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      can_proceed: false,
      reason: `Ação '${a}' é proibida incondicionalmente pelo contrato de autonomia.`,
    };
  }

  // TEST + dentro do escopo → autônomo (inclui ações pós-início, exceto as que SEMPRE exigem OK)
  if (environment === ENVIRONMENT.TEST) {
    // Ações que SEMPRE exigem OK humano, mesmo em TEST.
    // Inclui: promoção PROD, mudança de escopo, e INÍCIO de execução.
    // O usuário definiu: "só pode iniciar execução com OK humano explícito".
    const always_requires_human = [
      "start_plan_execution",
      "start_contract_execution",
      "start_task_execution",
      "promote_to_prod",
      "act_on_undefined_external_service",
      "change_scope",
    ];

    if (always_requires_human.includes(a)) {
      return {
        environment,
        action: a,
        autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
        can_proceed: false,
        reason: `Ação '${a}' exige OK humano mesmo em TEST — é uma ação de governança.`,
      };
    }

    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      can_proceed: true,
      reason: `Ação '${a}' permitida em TEST dentro do escopo aprovado — autonomia total.`,
    };
  }

  // PROD → qualquer ação operacional requer OK humano (exceto leituras)
  if (ALLOWED_ACTIONS.includes(a)) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      can_proceed: true,
      reason: `Ação '${a}' é uma operação de leitura/diagnóstico — permitida em PROD.`,
    };
  }

  // PROD → ações que exigem OK
  return {
    environment,
    action: a,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    can_proceed: false,
    reason: `Ação '${a}' em PROD requer OK humano explícito.`,
  };
}

// ---------------------------------------------------------------------------
// validateSpecialistArmCompliance({ arm_id, action, gates_context })
//
// Valida se um braço especialista está em conformidade com o contrato
// de autonomia antes de executar uma ação.
//
// Parâmetros:
//   arm_id        {string} — identificador do braço (ex: "p24_github_arm")
//   action        {string} — ação que o braço quer executar
//   gates_context {object} — contexto para avaliação dos gates
//
// Retorna:
//   {
//     arm_id,
//     action,
//     action_classification,  — resultado de classifyAction
//     gates_evaluation,       — resultado de evaluateGates
//     is_compliant,           — boolean
//     reason,                 — string auditável
//   }
//
// Lança:
//   Error — se parâmetros ausentes ou inválidos
// ---------------------------------------------------------------------------
function validateSpecialistArmCompliance({ arm_id, action, gates_context } = {}) {
  if (typeof arm_id !== "string" || arm_id.trim() === "") {
    throw new Error("validateSpecialistArmCompliance: 'arm_id' é obrigatório e deve ser string não-vazia");
  }
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("validateSpecialistArmCompliance: 'action' é obrigatório e deve ser string não-vazia");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("validateSpecialistArmCompliance: 'gates_context' é obrigatório e deve ser um objeto");
  }

  const action_classification = classifyAction(action);
  const gates_evaluation = evaluateGates(gates_context);

  // Ação proibida → braço não pode executar
  if (action_classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      arm_id: arm_id.trim(),
      action: action.trim(),
      action_classification,
      gates_evaluation,
      is_compliant: false,
      reason: `Braço '${arm_id.trim()}' tentou ação proibida '${action.trim()}' — bloqueado pelo contrato de autonomia.`,
    };
  }

  // Gates falharam → braço não pode executar ação sensível
  if (!gates_evaluation.all_gates_passed) {
    return {
      arm_id: arm_id.trim(),
      action: action.trim(),
      action_classification,
      gates_evaluation,
      is_compliant: false,
      reason: `Braço '${arm_id.trim()}' bloqueado: gates obrigatórios não passaram para ação '${action.trim()}'.`,
    };
  }

  // Tudo OK → braço em conformidade
  return {
    arm_id: arm_id.trim(),
    action: action.trim(),
    action_classification,
    gates_evaluation,
    is_compliant: true,
    reason: `Braço '${arm_id.trim()}' em conformidade com o contrato de autonomia para ação '${action.trim()}'.`,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Enums
  ENVIRONMENT,
  AUTONOMY_LEVEL,

  // Catalogues
  PRE_EXECUTION_ACTIONS,
  POST_START_AUTONOMOUS_ACTIONS,
  ALLOWED_ACTIONS,
  HUMAN_OK_REQUIRED_ACTIONS,
  PROHIBITED_ACTIONS,
  REQUIRED_GATES,
  FAILURE_POLICY,
  SPECIALIST_ARM_POLICY,

  // Functions
  classifyAction,
  evaluateGates,
  evaluateFailurePolicy,
  evaluateEnvironmentAutonomy,
  validateSpecialistArmCompliance,
};
