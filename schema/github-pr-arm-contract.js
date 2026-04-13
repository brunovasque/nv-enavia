// ============================================================================
// 📦 ENAVIA — GitHub/PR Arm Contract v1.0 (P24)
//
// ─── HIERARQUIA DE FONTES ───────────────────────────────────────────────────
//
//   SOBERANA:      schema/CONSTITUIÇÃO (Constituição da ENAVIA Pessoal v1)
//   INTERMEDIÁRIA: schema/autonomy-contract.js (P23 — contrato de autonomia)
//   SUBORDINADA:   schema/github-pr-arm-contract.js (ESTE ARQUIVO)
//
//   Este contrato é o braço nativo de GitHub/branch/PR/repo.
//   É subordinado ao contrato de autonomia (P23) e à CONSTITUIÇÃO.
//   Em caso de ambiguidade, a CONSTITUIÇÃO prevalece, depois P23, depois P24.
//
// ─── PROPÓSITO ──────────────────────────────────────────────────────────────
//
//   Definir de forma canônica:
//     - Ações permitidas antes do merge (autônomas dentro do escopo)
//     - Ações que exigem approval formal (merge em main)
//     - Condições obrigatórias antes de marcar "apto para merge"
//     - Ações proibidas
//     - Enforcement em runtime via enforceGitHubPrArm()
//     - Gate formal para merge em main
//
// ─── DIVISÃO OPERACIONAL ────────────────────────────────────────────────────
//
//   Workers / Cloudflare / service binding / runtime / deploy worker = executor nativo (separado)
//   Branch / PR / repo / review / correção / parecer / approval merge = ESTE BRAÇO (P24)
//
// ─── NÃO CONTÉM ─────────────────────────────────────────────────────────────
//
//   - Executor Cloudflare (separado, Workers/runtime)
//   - Browser executor (P25)
//   - Deploy/test como braço (P26)
//   - LLM / embeddings / heurística opaca
//   - Persistência / I/O direto
//   - Criação de repo novo
//
// P24 APENAS — não misturar com executor Cloudflare, P25, P26.
// ============================================================================

import {
  AUTONOMY_LEVEL,
  ENVIRONMENT,
  classifyAction,
  evaluateGates,
  validateSpecialistArmCompliance,
} from "./autonomy-contract.js";

// ---------------------------------------------------------------------------
// ARM_ID — identificador canônico do braço GitHub/PR
// ---------------------------------------------------------------------------
const GITHUB_PR_ARM_ID = "p24_github_pr_arm";

// ---------------------------------------------------------------------------
// AÇÕES PERMITIDAS ANTES DO MERGE (autônomas dentro do escopo aprovado)
//
// O braço GitHub pode fazer tudo antes do merge, dentro do escopo:
//   - abrir branch
//   - abrir PR
//   - atualizar PR
//   - comentar em PR
//   - revisar diff
//   - auditar PR
//   - pedir ajuste/correção
//   - corrigir a própria PR quando necessário para manter o objetivo
//   - organizar o que já estiver aberto no repo dentro do escopo aprovado
// ---------------------------------------------------------------------------
const PRE_MERGE_ALLOWED_ACTIONS = [
  "open_branch",
  "open_pr",
  "update_pr",
  "comment_pr",
  "review_diff",
  "audit_pr",
  "request_correction",
  "self_correct_pr",
  "organize_repo_within_scope",
];

// ---------------------------------------------------------------------------
// AÇÕES QUE EXIGEM APPROVAL FORMAL
//
// Merge em main é a única ação que exige approval formal.
// ---------------------------------------------------------------------------
const FORMAL_APPROVAL_REQUIRED_ACTIONS = [
  "merge_to_main",
];

// ---------------------------------------------------------------------------
// CONDIÇÕES OBRIGATÓRIAS ANTES DE MARCAR "APTO PARA MERGE"
//
// Todas devem ser verdadeiras antes de poder marcar a PR como apta.
// ---------------------------------------------------------------------------
const MERGE_READINESS_GATES = [
  "contract_rechecked",         // reconferir o contrato
  "phase_validated",            // validar fase/microfase
  "no_regression",              // validar ausência de regressão
  "diff_reviewed",              // revisar diff
  "summary_reviewed",           // revisar resumo
  "summary_for_merge_present",  // resumo do que foi feito
  "reason_merge_ok_present",    // explicação curta do porquê está ok
];

// ---------------------------------------------------------------------------
// AÇÕES PROIBIDAS INCONDICIONALMENTE
// ---------------------------------------------------------------------------
const PROHIBITED_ACTIONS_P24 = [
  "regress_contract",
  "regress_plan",
  "regress_task",
  "regress_pr",
  "ignore_diff",
  "ignore_summary",
  "generate_drift",
  "act_outside_scope",
  "deviate_contract_without_escalation",
  "mix_cloudflare_executor_with_github_arm",
  "create_new_repo",
  "merge_without_summary",
  "merge_without_reason",
  "merge_without_approval",
  "silent_merge",
];

// ---------------------------------------------------------------------------
// MERGE STATUS — estados possíveis para o gate de merge
// ---------------------------------------------------------------------------
const MERGE_STATUS = {
  NOT_READY:          "not_ready",
  AWAITING_APPROVAL:  "awaiting_formal_approval",
  APPROVED:           "approved_for_merge",
  MERGED:             "merged",
  BLOCKED:            "blocked",
};

// ---------------------------------------------------------------------------
// classifyGitHubPrAction(action)
//
// Classifica uma ação no contexto do braço GitHub/PR.
//
// Retorna:
//   {
//     action,
//     arm_id,
//     belongs_to_github_arm,
//     autonomy_level,
//     reason,
//   }
// ---------------------------------------------------------------------------
function classifyGitHubPrAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyGitHubPrAction: 'action' é obrigatório e deve ser string não-vazia");
  }

  const a = action.trim();

  if (PRE_MERGE_ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      reason: `Ação '${a}' é permitida pelo braço GitHub/PR antes do merge, dentro do escopo aprovado.`,
    };
  }

  if (FORMAL_APPROVAL_REQUIRED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: `Ação '${a}' exige approval formal — não pode ser executada sem autorização humana.`,
    };
  }

  if (PROHIBITED_ACTIONS_P24.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      reason: `Ação '${a}' é proibida incondicionalmente pelo contrato do braço GitHub/PR.`,
    };
  }

  // Ação não pertence ao braço GitHub/PR
  return {
    action: a,
    arm_id: GITHUB_PR_ARM_ID,
    belongs_to_github_arm: false,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    reason: `Ação '${a}' não pertence ao catálogo do braço GitHub/PR — requer OK humano por cautela.`,
  };
}

// ---------------------------------------------------------------------------
// evaluateMergeReadiness(context)
//
// Avalia se TODAS as condições obrigatórias antes de marcar "apto para merge"
// estão satisfeitas.
//
// Parâmetros:
//   context {object} — deve conter:
//     contract_rechecked          {boolean}
//     phase_validated             {boolean}
//     no_regression               {boolean}
//     diff_reviewed               {boolean}
//     summary_reviewed            {boolean}
//     summary_for_merge           {string}  — resumo do que foi feito (não-vazio)
//     reason_merge_ok             {string}  — explicação curta do porquê está ok (não-vazio)
//
// Retorna:
//   {
//     is_ready,
//     failed_gates,
//     gates,
//     summary_for_merge,
//     reason_merge_ok,
//     reason,
//   }
// ---------------------------------------------------------------------------
function evaluateMergeReadiness(context) {
  if (!context || typeof context !== "object") {
    throw new Error("evaluateMergeReadiness: 'context' é obrigatório e deve ser um objeto");
  }

  const gates = {};
  const failed_gates = [];

  // Boolean gates
  const booleanGates = [
    "contract_rechecked",
    "phase_validated",
    "no_regression",
    "diff_reviewed",
    "summary_reviewed",
  ];

  for (const gate of booleanGates) {
    const value = context[gate];
    const passed = value === true;
    gates[gate] = { passed, reason: passed
      ? `Gate '${gate}' passou.`
      : `Gate '${gate}' falhou — condição não satisfeita.`
    };
    if (!passed) failed_gates.push(gate);
  }

  // String gates — must be non-empty strings
  const summary_for_merge = typeof context.summary_for_merge === "string"
    ? context.summary_for_merge.trim()
    : "";
  const reason_merge_ok = typeof context.reason_merge_ok === "string"
    ? context.reason_merge_ok.trim()
    : "";

  const summaryPresent = summary_for_merge.length > 0;
  gates.summary_for_merge_present = {
    passed: summaryPresent,
    reason: summaryPresent
      ? "Resumo para merge presente."
      : "Resumo para merge ausente — é obrigatório informar o que foi feito antes do merge.",
  };
  if (!summaryPresent) failed_gates.push("summary_for_merge_present");

  const reasonPresent = reason_merge_ok.length > 0;
  gates.reason_merge_ok_present = {
    passed: reasonPresent,
    reason: reasonPresent
      ? "Explicação curta do porquê está ok presente."
      : "Explicação curta ausente — é obrigatório informar porquê a PR pode ser mergeada.",
  };
  if (!reasonPresent) failed_gates.push("reason_merge_ok_present");

  const is_ready = failed_gates.length === 0;

  return {
    is_ready,
    failed_gates,
    gates,
    summary_for_merge: summaryPresent ? summary_for_merge : null,
    reason_merge_ok: reasonPresent ? reason_merge_ok : null,
    reason: is_ready
      ? "Todas as condições de merge readiness passaram — PR pode ser marcada como apta para merge."
      : `${failed_gates.length} condição(ões) falhou(aram): ${failed_gates.join(", ")}. PR NÃO está apta para merge.`,
  };
}

// ---------------------------------------------------------------------------
// buildMergeGateState({ merge_readiness, approval_status })
//
// Constrói o estado do gate de merge para a PR.
// Combina merge readiness + approval status.
//
// Parâmetros:
//   merge_readiness  — resultado de evaluateMergeReadiness()
//   approval_status  — "none" | "pending" | "approved" | "rejected"
//
// Retorna:
//   {
//     merge_status,
//     summary_for_merge,
//     reason_merge_ok,
//     approval_status,
//     can_merge,
//     reason,
//   }
// ---------------------------------------------------------------------------
const VALID_APPROVAL_STATUSES = ["none", "pending", "approved", "rejected"];

function buildMergeGateState({ merge_readiness, approval_status } = {}) {
  if (!merge_readiness || typeof merge_readiness !== "object") {
    throw new Error("buildMergeGateState: 'merge_readiness' é obrigatório e deve ser um objeto");
  }
  if (typeof approval_status !== "string" || !VALID_APPROVAL_STATUSES.includes(approval_status)) {
    throw new Error(
      `buildMergeGateState: 'approval_status' deve ser um de: ${VALID_APPROVAL_STATUSES.join(", ")}`
    );
  }

  // Not ready → not_ready
  if (!merge_readiness.is_ready) {
    return {
      merge_status: MERGE_STATUS.NOT_READY,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: `PR não está apta: ${merge_readiness.reason}`,
    };
  }

  // Ready but rejected
  if (approval_status === "rejected") {
    return {
      merge_status: MERGE_STATUS.BLOCKED,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: "PR bloqueada: approval formal foi rejeitado.",
    };
  }

  // Ready but no approval yet or pending
  if (approval_status === "none" || approval_status === "pending") {
    return {
      merge_status: MERGE_STATUS.AWAITING_APPROVAL,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: "PR apta para merge — aguardando approval formal para merge em main.",
    };
  }

  // Ready + approved
  return {
    merge_status: MERGE_STATUS.APPROVED,
    summary_for_merge: merge_readiness.summary_for_merge,
    reason_merge_ok: merge_readiness.reason_merge_ok,
    approval_status,
    can_merge: true,
    reason: "PR aprovada para merge em main — approval formal recebido.",
  };
}

// ---------------------------------------------------------------------------
// enforceGitHubPrArm({ action, scope_approved, gates_context,
//                       merge_context, drift_detected, regression_detected })
//
// Ponto ÚNICO de enforcement em runtime do braço GitHub/PR.
// Deve ser chamado antes de qualquer ação sensível do braço.
//
// Valida no mínimo:
//   1. Se a ação pertence ao braço GitHub/PR
//   2. Escopo aprovado
//   3. Ausência de drift
//   4. Ausência de regressão
//   5. Reconferência contratual antes de merge
//   6. Presença de resumo + explicação curta antes de approval/merge
//   7. Conformidade com P23 (autonomy contract)
//
// Se violar: bloqueia, explica o motivo, não age.
//
// Retorna:
//   {
//     allowed,
//     blocked,
//     arm_id,
//     action,
//     level,
//     reason,
//     classification,
//     p23_compliance,
//     merge_gate,         — null se ação não é merge
//   }
// ---------------------------------------------------------------------------
function enforceGitHubPrArm({
  action,
  scope_approved,
  gates_context,
  merge_context = null,
  drift_detected = false,
  regression_detected = false,
} = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("enforceGitHubPrArm: 'action' é obrigatório e deve ser string não-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'scope_approved' é obrigatório e deve ser boolean");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("enforceGitHubPrArm: 'gates_context' é obrigatório e deve ser um objeto");
  }
  if (typeof drift_detected !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'drift_detected' deve ser boolean");
  }
  if (typeof regression_detected !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'regression_detected' deve ser boolean");
  }

  const a = action.trim();

  // ── STEP 1: Classify the action in the GitHub/PR arm context ──
  const classification = classifyGitHubPrAction(a);

  // Prohibited action → immediate block
  if (classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.PROHIBITED,
      reason: classification.reason,
      classification,
      p23_compliance: null,
      merge_gate: null,
    };
  }

  // ── STEP 2: Check if action belongs to this arm ──
  if (!classification.belongs_to_github_arm) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_not_github_arm",
      reason: `Ação '${a}' não pertence ao braço GitHub/PR — bloqueada. Não misturar com executor Cloudflare ou outros braços.`,
      classification,
      p23_compliance: null,
      merge_gate: null,
    };
  }

  // ── STEP 3: Check scope ──
  if (!scope_approved) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_out_of_scope",
      reason: `Ação '${a}' fora do escopo aprovado — braço GitHub/PR não pode agir fora do escopo.`,
      classification,
      p23_compliance: null,
      merge_gate: null,
    };
  }

  // ── STEP 4: Check drift ──
  if (drift_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_drift_detected",
      reason: `Drift detectado — braço GitHub/PR bloqueado. É proibido gerar ou aceitar drift.`,
      classification,
      p23_compliance: null,
      merge_gate: null,
    };
  }

  // ── STEP 5: Check regression ──
  if (regression_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_regression_detected",
      reason: `Regressão detectada — braço GitHub/PR bloqueado. É proibido permitir regressão.`,
      classification,
      p23_compliance: null,
      merge_gate: null,
    };
  }

  // ── STEP 6: Validate P23 compliance (autonomy contract) ──
  const p23_compliance = validateSpecialistArmCompliance({
    arm_id: GITHUB_PR_ARM_ID,
    action: a,
    gates_context,
  });

  if (!p23_compliance.is_compliant) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_p23_noncompliant",
      reason: p23_compliance.reason,
      classification,
      p23_compliance,
      merge_gate: null,
    };
  }

  // ── STEP 7: If merge action, enforce merge gate ──
  if (FORMAL_APPROVAL_REQUIRED_ACTIONS.includes(a)) {
    if (!merge_context || typeof merge_context !== "object") {
      return {
        allowed: false,
        blocked: true,
        arm_id: GITHUB_PR_ARM_ID,
        action: a,
        level: "blocked_merge_context_missing",
        reason: `Ação '${a}' exige merge_context com resumo, explicação e approval — não fornecido.`,
        classification,
        p23_compliance,
        merge_gate: null,
      };
    }

    const merge_readiness = evaluateMergeReadiness(merge_context);
    const approval_status = typeof merge_context.approval_status === "string"
      ? merge_context.approval_status
      : "none";

    const merge_gate = buildMergeGateState({ merge_readiness, approval_status });

    if (!merge_gate.can_merge) {
      return {
        allowed: false,
        blocked: true,
        arm_id: GITHUB_PR_ARM_ID,
        action: a,
        level: merge_gate.merge_status,
        reason: merge_gate.reason,
        classification,
        p23_compliance,
        merge_gate,
      };
    }

    // Merge allowed — all gates passed + formal approval received
    return {
      allowed: true,
      blocked: false,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: merge_gate.reason,
      classification,
      p23_compliance,
      merge_gate,
    };
  }

  // ── TUDO OK — ação pré-merge permitida ──
  return {
    allowed: true,
    blocked: false,
    arm_id: GITHUB_PR_ARM_ID,
    action: a,
    level: classification.autonomy_level,
    reason: `Braço GitHub/PR: ação '${a}' permitida — escopo aprovado, sem drift, sem regressão, P23 compliant.`,
    classification,
    p23_compliance,
    merge_gate: null,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Arm ID
  GITHUB_PR_ARM_ID,

  // Catalogues
  PRE_MERGE_ALLOWED_ACTIONS,
  FORMAL_APPROVAL_REQUIRED_ACTIONS,
  PROHIBITED_ACTIONS_P24,
  MERGE_READINESS_GATES,

  // Merge status
  MERGE_STATUS,
  VALID_APPROVAL_STATUSES,

  // Functions
  classifyGitHubPrAction,
  evaluateMergeReadiness,
  buildMergeGateState,

  // Runtime enforcement (single entry point for P24)
  enforceGitHubPrArm,
};
