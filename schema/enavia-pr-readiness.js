"use strict";

// PR93 — PR Readiness Helper
// Helper puro/supervisionado sem side effects reais.
// Consome plano de execucao supervisionado da PR92 e produz estado de readiness final.
// ready_for_merge e deploy_test_ready refletem prontidao logica supervisionada.
// Merge real e deploy PROD continuam bloqueados ate aprovacao humana explicita.

const PR_READINESS_MODE = "pr_readiness";
const PR_EXECUTOR_MODE = "pr_executor_supervised";

function asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => asString(item)).filter(Boolean);
}

// Verifica se o plano esta bloqueado (ok=false)
function isPlanBlocked(plan) {
  const src = asObject(plan);
  if (src.ok !== true) {
    const reason = asString(src.error) || "PLAN_BLOCKED: plan.ok is not true";
    return { blocked: true, reason };
  }
  return { blocked: false, reason: null };
}

// Valida a forma minima do plano da PR92
function validateSourceExecutionPlan(plan) {
  const src = asObject(plan);
  const errors = [];

  if (src.mode !== PR_EXECUTOR_MODE) errors.push("invalid:source_mode");
  if (typeof src.branch_name !== "string" || src.branch_name.length === 0) errors.push("missing:branch_name");
  if (typeof src.pr_title !== "string" || src.pr_title.length === 0) errors.push("missing:pr_title");
  if (!Array.isArray(src.tests_to_run)) errors.push("invalid:tests_to_run");

  const rollbackValid = Array.isArray(src.rollback_plan) || typeof src.rollback_plan === "string";
  if (!rollbackValid) errors.push("invalid:rollback_plan");
  if (Array.isArray(src.rollback_plan) && src.rollback_plan.length === 0) errors.push("empty:rollback_plan");
  if (typeof src.rollback_plan === "string" && asString(src.rollback_plan).length === 0) errors.push("empty:rollback_plan");

  if (!Array.isArray(src.acceptance_criteria)) errors.push("invalid:acceptance_criteria");
  if (!Array.isArray(src.execution_steps)) errors.push("invalid:execution_steps");

  // Guardrails obrigatorios do PR92
  if (src.awaiting_human_approval !== true) errors.push("invalid:awaiting_human_approval");
  if (src.merge_allowed !== false) errors.push("invalid:merge_allowed");
  if (src.prod_deploy_allowed !== false) errors.push("invalid:prod_deploy_allowed");
  if (src.github_execution !== false) errors.push("invalid:github_execution");
  if (src.side_effects !== false) errors.push("invalid:side_effects");

  return { ok: errors.length === 0, errors };
}

// Constroi evidencias do estado de readiness
function buildReadinessEvidence(state) {
  const src = asObject(state);
  return {
    origem_pr91: "PR91 — PR Planner (schema/enavia-pr-planner.js)",
    origem_pr92: "PR92 — PR Executor Supervisionado (schema/enavia-pr-executor-supervised.js)",
    tests_to_run: Array.isArray(src.tests_to_run) ? src.tests_to_run.slice() : [],
    rollback_plan: Array.isArray(src.rollback_plan)
      ? src.rollback_plan.slice()
      : typeof src.rollback_plan === "string"
        ? src.rollback_plan
        : "",
    bloqueio_merge_automatico:
      "Merge em main bloqueado. merge_allowed=false permanente. Requer aprovacao humana explicita.",
    bloqueio_prod_automatico:
      "Deploy PROD bloqueado. prod_deploy_allowed=false permanente. Requer aprovacao humana explicita.",
    github_execution: false,
    side_effects: false,
    merge_allowed: false,
    prod_deploy_allowed: false,
    awaiting_human_approval: true,
    nota: "Nenhuma execucao real — sem GitHub, sem shell, sem escrita em disco, sem rede.",
  };
}

// Valida o estado de readiness produzido por buildPrReadinessState
function validatePrReadinessState(state) {
  const src = asObject(state);
  const errors = [];

  const requiredFields = [
    "ok",
    "mode",
    "source_executor_mode",
    "branch_name",
    "pr_title",
    "tests_to_run",
    "rollback_plan",
    "acceptance_criteria",
    "evidence",
    "ready_for_merge",
    "deploy_test_ready",
    "awaiting_human_approval",
    "prod_blocked_until_human_approval",
    "merge_allowed",
    "prod_deploy_allowed",
    "github_execution",
    "side_effects",
    "human_actions_required",
    "final_status",
  ];

  for (const field of requiredFields) {
    if (!(field in src)) errors.push(`missing:${field}`);
  }

  if (src.mode !== PR_READINESS_MODE) errors.push("invalid:mode");
  if (src.source_executor_mode !== PR_EXECUTOR_MODE) errors.push("invalid:source_executor_mode");

  // Guardrails imutaveis
  if (src.awaiting_human_approval !== true) errors.push("invalid:awaiting_human_approval_must_be_true");
  if (src.prod_blocked_until_human_approval !== true) errors.push("invalid:prod_blocked_until_human_approval_must_be_true");
  if (src.merge_allowed !== false) errors.push("invalid:merge_allowed_must_be_false");
  if (src.prod_deploy_allowed !== false) errors.push("invalid:prod_deploy_allowed_must_be_false");
  if (src.github_execution !== false) errors.push("invalid:github_execution_must_be_false");
  if (src.side_effects !== false) errors.push("invalid:side_effects_must_be_false");
  if (src.final_status !== "awaiting_human_merge_approval") errors.push("invalid:final_status");

  const humanActions = asStringArray(src.human_actions_required);
  if (!humanActions.includes("review_pr")) errors.push("missing:human_action:review_pr");
  if (!humanActions.includes("approve_merge")) errors.push("missing:human_action:approve_merge");
  if (!humanActions.includes("approve_prod_deploy")) errors.push("missing:human_action:approve_prod_deploy");

  return { ok: errors.length === 0, errors };
}

// Verifica guardrails criticos — retorna erro descritivo se violado
function assertReadinessGuards(state) {
  const src = asObject(state);
  const violations = [];

  if (src.merge_allowed === true) violations.push("GUARD_VIOLATION: merge_allowed must be false");
  if (src.prod_deploy_allowed === true) violations.push("GUARD_VIOLATION: prod_deploy_allowed must be false");
  if (src.github_execution === true) violations.push("GUARD_VIOLATION: github_execution must be false");
  if (src.side_effects === true) violations.push("GUARD_VIOLATION: side_effects must be false");
  if (src.awaiting_human_approval !== true) violations.push("GUARD_VIOLATION: awaiting_human_approval must be true");
  if (src.prod_blocked_until_human_approval !== true) violations.push("GUARD_VIOLATION: prod_blocked_until_human_approval must be true");

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true, violations: [] };
}

// Funcao principal: constroi estado de readiness final a partir do plano da PR92
function buildPrReadinessState(prExecutionPlan, options) {
  const src = asObject(prExecutionPlan);

  // Verificar se o plano nao e um objeto valido
  if (!prExecutionPlan || typeof prExecutionPlan !== "object" || Array.isArray(prExecutionPlan)) {
    return {
      ok: false,
      mode: PR_READINESS_MODE,
      error: "INVALID_PLAN: plano nao e um objeto valido",
      errors: ["invalid:plan_not_object"],
    };
  }

  // Verificar modo fonte
  if (src.mode !== PR_EXECUTOR_MODE) {
    return {
      ok: false,
      mode: PR_READINESS_MODE,
      error: `INVALID_SOURCE_MODE: esperado "${PR_EXECUTOR_MODE}", recebido "${src.mode || "(ausente)"}"`,
      errors: ["invalid:source_mode"],
    };
  }

  // Verificar se o plano esta bloqueado (ok=false)
  const blockCheck = isPlanBlocked(src);
  if (blockCheck.blocked) {
    const state = {
      ok: false,
      mode: PR_READINESS_MODE,
      source_executor_mode: PR_EXECUTOR_MODE,
      branch_name: asString(src.branch_name),
      pr_title: asString(src.pr_title),
      tests_to_run: Array.isArray(src.tests_to_run) ? src.tests_to_run.slice() : [],
      rollback_plan: Array.isArray(src.rollback_plan) ? src.rollback_plan.slice() : (typeof src.rollback_plan === "string" ? src.rollback_plan : []),
      acceptance_criteria: Array.isArray(src.acceptance_criteria) ? src.acceptance_criteria.slice() : [],
      evidence: null,
      ready_for_merge: false,
      deploy_test_ready: false,
      awaiting_human_approval: true,
      prod_blocked_until_human_approval: true,
      merge_allowed: false,
      prod_deploy_allowed: false,
      github_execution: false,
      side_effects: false,
      human_actions_required: ["review_pr", "approve_merge", "approve_prod_deploy"],
      final_status: "awaiting_human_merge_approval",
      error: `BLOCKED: ${blockCheck.reason}`,
      errors: [`blocked:${blockCheck.reason}`],
    };
    state.evidence = buildReadinessEvidence(state);
    return state;
  }

  // Validar forma minima
  const sourceValidation = validateSourceExecutionPlan(src);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      mode: PR_READINESS_MODE,
      source_executor_mode: PR_EXECUTOR_MODE,
      error: "INVALID_PLAN_SHAPE: plano de execucao nao tem forma valida",
      errors: sourceValidation.errors,
    };
  }

  // Construir estado de readiness
  const state = {
    ok: true,
    mode: PR_READINESS_MODE,
    source_executor_mode: PR_EXECUTOR_MODE,
    branch_name: asString(src.branch_name),
    pr_title: asString(src.pr_title),
    tests_to_run: Array.isArray(src.tests_to_run) ? src.tests_to_run.slice() : [],
    rollback_plan: Array.isArray(src.rollback_plan) ? src.rollback_plan.slice() : src.rollback_plan,
    acceptance_criteria: Array.isArray(src.acceptance_criteria) ? src.acceptance_criteria.slice() : [],
    evidence: null, // preenchido abaixo
    ready_for_merge: true,
    deploy_test_ready: true,
    awaiting_human_approval: true,
    prod_blocked_until_human_approval: true,
    merge_allowed: false,
    prod_deploy_allowed: false,
    github_execution: false,
    side_effects: false,
    human_actions_required: ["review_pr", "approve_merge", "approve_prod_deploy"],
    final_status: "awaiting_human_merge_approval",
  };

  state.evidence = buildReadinessEvidence(state);

  return state;
}

module.exports = {
  buildPrReadinessState,
  validatePrReadinessState,
  buildReadinessEvidence,
  assertReadinessGuards,
  PR_READINESS_MODE,
  PR_EXECUTOR_MODE,
};
