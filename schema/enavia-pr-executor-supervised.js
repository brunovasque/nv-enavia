"use strict";

// PR92 — PR Executor Supervisionado
// Helper puro/supervisionado sem side effects reais.
// Consome pacote PR-ready da PR91 e produz plano de execucao supervisionado.

const PR_EXECUTOR_MODE = "pr_executor_supervised";
const PR_PLANNER_MODE = "pr_planner";

const KNOWN_STEPS = [
  "validate_package",
  "prepare_branch_plan",
  "prepare_patch_plan",
  "prepare_tests_plan",
  "prepare_pr_metadata",
  "prepare_rollback_plan",
  "await_human_review",
];

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

// Verifica se o pacote da PR91 esta bloqueado por guardrails
function isPackageBlocked(pkg) {
  const src = asObject(pkg);
  if (src.merge_allowed === true) return { blocked: true, reason: "MERGE_ALLOWED_GUARD: merge_allowed must be false" };
  if (src.prod_deploy_allowed === true) return { blocked: true, reason: "PROD_DEPLOY_ALLOWED_GUARD: prod_deploy_allowed must be false" };
  if (src.github_execution === true) return { blocked: true, reason: "GITHUB_EXECUTION_GUARD: github_execution must be false" };
  if (src.side_effects === true) return { blocked: true, reason: "SIDE_EFFECTS_GUARD: side_effects must be false" };
  if (src.request_blocked === true) {
    const blockedBy = Array.isArray(src.evidence && src.evidence.blocked_by) ? src.evidence.blocked_by : [];
    const reasons = blockedBy.map((b) => b.code || "UNKNOWN_BLOCK").join(", ");
    return { blocked: true, reason: `PACKAGE_BLOCKED_BY_PLANNER: ${reasons || "request_blocked=true"}` };
  }
  return { blocked: false, reason: null };
}

// Valida que o pacote da PR91 tem a forma minima esperada
function validateSourcePackage(pkg) {
  const src = asObject(pkg);
  const errors = [];

  if (src.mode !== PR_PLANNER_MODE) errors.push("invalid:source_mode");
  if (typeof src.branch_name !== "string" || src.branch_name.length === 0) errors.push("missing:branch_name");
  if (typeof src.pr_title !== "string" || src.pr_title.length === 0) errors.push("missing:pr_title");
  if (typeof src.pr_body !== "string" || src.pr_body.length === 0) errors.push("missing:pr_body");
  if (!Array.isArray(src.files_to_change)) errors.push("invalid:files_to_change");

  const patchValid = Array.isArray(src.patch_plan) || typeof src.patch_plan === "string";
  if (!patchValid) errors.push("invalid:patch_plan");
  if (Array.isArray(src.patch_plan) && src.patch_plan.length === 0) errors.push("empty:patch_plan");
  if (typeof src.patch_plan === "string" && asString(src.patch_plan).length === 0) errors.push("empty:patch_plan");

  if (!Array.isArray(src.tests_to_run)) errors.push("invalid:tests_to_run");

  const rollbackValid = Array.isArray(src.rollback_plan) || typeof src.rollback_plan === "string";
  if (!rollbackValid) errors.push("invalid:rollback_plan");
  if (Array.isArray(src.rollback_plan) && src.rollback_plan.length === 0) errors.push("empty:rollback_plan");
  if (typeof src.rollback_plan === "string" && asString(src.rollback_plan).length === 0) errors.push("empty:rollback_plan");

  if (!Array.isArray(src.acceptance_criteria)) errors.push("invalid:acceptance_criteria");
  if (!["low", "medium", "high", "blocking"].includes(src.risk_level)) errors.push("invalid:risk_level");

  // Guardrails obrigatorios do PR91
  if (src.awaiting_human_approval !== true) errors.push("invalid:awaiting_human_approval");
  if (src.merge_allowed !== false) errors.push("invalid:merge_allowed");
  if (src.prod_deploy_allowed !== false) errors.push("invalid:prod_deploy_allowed");
  if (src.github_execution !== false) errors.push("invalid:github_execution");
  if (src.side_effects !== false) errors.push("invalid:side_effects");

  return { ok: errors.length === 0, errors };
}

// Constroi os execution_steps deterministicos (simulados, sem side effects)
function buildExecutionSteps(pkg) {
  const src = asObject(pkg);
  return [
    {
      step: "validate_package",
      description: "Valida que o pacote PR-ready da PR91 esta integro e sem guardrails violados.",
      status: "planned",
      real_execution: false,
    },
    {
      step: "prepare_branch_plan",
      description: `Prepara plano de branch supervisionado: ${asString(src.branch_name) || "(branch nao informada)"}`,
      status: "planned",
      real_execution: false,
    },
    {
      step: "prepare_patch_plan",
      description: "Descreve os arquivos e patches planejados sem escrita real em disco.",
      status: "planned",
      real_execution: false,
    },
    {
      step: "prepare_tests_plan",
      description: "Lista testes planejados para validacao da PR sem execucao direta.",
      status: "planned",
      real_execution: false,
    },
    {
      step: "prepare_pr_metadata",
      description: `Consolida title="${asString(src.pr_title).slice(0, 60)}..." e pr_body sem abertura real de PR.`,
      status: "planned",
      real_execution: false,
    },
    {
      step: "prepare_rollback_plan",
      description: "Registra plano de rollback supervisionado sem execucao real.",
      status: "planned",
      real_execution: false,
    },
    {
      step: "await_human_review",
      description: "Bloqueia execucao real ate aprovacao humana explicita. merge_allowed=false. prod_deploy_allowed=false.",
      status: "blocked_until_human_approval",
      real_execution: false,
    },
  ];
}

// Constroi evidencias da execucao supervisionada
function buildPrExecutionEvidence(plan) {
  const src = asObject(plan);
  const steps = Array.isArray(src.execution_steps) ? src.execution_steps.map((s) => asString(s.step || s)) : [];
  return {
    origem: "PR91 — PR Planner (schema/enavia-pr-planner.js)",
    source_package_mode: PR_PLANNER_MODE,
    executor_mode: PR_EXECUTOR_MODE,
    steps_planned: steps,
    bloqueio_merge_humano: "Merge em main bloqueado ate aprovacao humana explicita.",
    bloqueio_prod_humano: "Deploy PROD bloqueado ate aprovacao humana explicita.",
    github_execution: false,
    side_effects: false,
    merge_allowed: false,
    prod_deploy_allowed: false,
    awaiting_human_approval: true,
    nota: "Nenhum step executa GitHub real, shell, escrita em disco ou chamada de rede.",
  };
}

// Valida o plano de execucao supervisionado produzido por buildSupervisedPrExecutionPlan
function validateSupervisedPrExecutionPlan(plan) {
  const src = asObject(plan);
  const errors = [];

  const requiredFields = [
    "ok",
    "mode",
    "source_package_mode",
    "branch_name",
    "pr_title",
    "pr_body",
    "files_to_change",
    "patch_plan",
    "tests_to_run",
    "rollback_plan",
    "acceptance_criteria",
    "execution_steps",
    "evidence",
    "ready_for_branch_preparation",
    "ready_for_pr_opening",
    "ready_for_merge",
    "awaiting_human_approval",
    "merge_allowed",
    "prod_deploy_allowed",
    "github_execution",
    "side_effects",
    "risk_level",
  ];

  for (const field of requiredFields) {
    if (!(field in src)) errors.push(`missing:${field}`);
  }

  if (src.mode !== PR_EXECUTOR_MODE) errors.push("invalid:mode");
  if (src.source_package_mode !== PR_PLANNER_MODE) errors.push("invalid:source_package_mode");

  // Guardrails obrigatorios
  if (src.ready_for_merge !== false) errors.push("invalid:ready_for_merge_must_be_false");
  if (src.awaiting_human_approval !== true) errors.push("invalid:awaiting_human_approval_must_be_true");
  if (src.merge_allowed !== false) errors.push("invalid:merge_allowed_must_be_false");
  if (src.prod_deploy_allowed !== false) errors.push("invalid:prod_deploy_allowed_must_be_false");
  if (src.github_execution !== false) errors.push("invalid:github_execution_must_be_false");
  if (src.side_effects !== false) errors.push("invalid:side_effects_must_be_false");

  if (!Array.isArray(src.execution_steps)) {
    errors.push("invalid:execution_steps");
  } else {
    const stepNames = src.execution_steps.map((s) => asString(s.step || s));
    for (const required of KNOWN_STEPS) {
      if (!stepNames.includes(required)) errors.push(`missing:execution_step:${required}`);
    }
    for (const step of src.execution_steps) {
      if (step && step.real_execution === true) errors.push(`invalid:step_real_execution:${step.step}`);
    }
  }

  return { ok: errors.length === 0, errors };
}

// Verifica guardrails criticos do plano — lanca erro descritivo se violado
function assertPrExecutionGuards(plan) {
  const src = asObject(plan);
  const violations = [];

  if (src.ready_for_merge !== false) violations.push("GUARD_VIOLATION: ready_for_merge must be false");
  if (src.merge_allowed !== false) violations.push("GUARD_VIOLATION: merge_allowed must be false");
  if (src.prod_deploy_allowed !== false) violations.push("GUARD_VIOLATION: prod_deploy_allowed must be false");
  if (src.github_execution !== false) violations.push("GUARD_VIOLATION: github_execution must be false");
  if (src.side_effects !== false) violations.push("GUARD_VIOLATION: side_effects must be false");
  if (src.awaiting_human_approval !== true) violations.push("GUARD_VIOLATION: awaiting_human_approval must be true");

  const steps = Array.isArray(src.execution_steps) ? src.execution_steps : [];
  for (const step of steps) {
    if (step && step.real_execution === true) {
      violations.push(`GUARD_VIOLATION: step "${step.step}" has real_execution=true`);
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations };
  }
  return { ok: true, violations: [] };
}

// Simula a execucao de um step individual (sem side effects reais)
function simulatePrExecutionStep(plan, step) {
  const src = asObject(plan);
  const stepName = asString(step);

  if (!KNOWN_STEPS.includes(stepName)) {
    return {
      ok: false,
      step: stepName,
      error: `UNKNOWN_STEP: "${stepName}" nao e um step valido. Steps validos: ${KNOWN_STEPS.join(", ")}`,
      real_execution: false,
      side_effects: false,
    };
  }

  const steps = Array.isArray(src.execution_steps) ? src.execution_steps : [];
  const found = steps.find((s) => asString(s.step || s) === stepName);

  return {
    ok: true,
    step: stepName,
    description: found ? asString(found.description) : `Step ${stepName} simulado.`,
    status: found ? asString(found.status) : "simulated",
    real_execution: false,
    side_effects: false,
    github_execution: false,
    nota: "Simulacao pura sem side effects, sem GitHub real, sem shell, sem rede.",
  };
}

// Funcao principal: constroi plano de execucao supervisionado a partir de pacote PR-ready da PR91
function buildSupervisedPrExecutionPlan(pkg, options) {
  const src = asObject(pkg);
  const opts = asObject(options);

  // Verificar se o pacote eh invalido (forma minima ausente)
  if (!src || typeof src !== "object" || Array.isArray(src)) {
    return {
      ok: false,
      mode: PR_EXECUTOR_MODE,
      error: "INVALID_PACKAGE: pacote nao e um objeto valido",
      errors: ["invalid:package_not_object"],
    };
  }

  // Verificar se fonte e correta
  if (src.mode !== PR_PLANNER_MODE) {
    return {
      ok: false,
      mode: PR_EXECUTOR_MODE,
      error: `INVALID_SOURCE_MODE: esperado "${PR_PLANNER_MODE}", recebido "${src.mode || "(ausente)"}"`,
      errors: ["invalid:source_mode"],
    };
  }

  // Verificar guardrails de bloqueio do pacote da PR91
  const blockCheck = isPackageBlocked(src);
  if (blockCheck.blocked) {
    const plan = {
      ok: false,
      mode: PR_EXECUTOR_MODE,
      source_package_mode: PR_PLANNER_MODE,
      branch_name: asString(src.branch_name),
      pr_title: asString(src.pr_title),
      pr_body: asString(src.pr_body),
      files_to_change: Array.isArray(src.files_to_change) ? src.files_to_change : [],
      patch_plan: src.patch_plan || [],
      tests_to_run: Array.isArray(src.tests_to_run) ? src.tests_to_run : [],
      rollback_plan: src.rollback_plan || [],
      acceptance_criteria: Array.isArray(src.acceptance_criteria) ? src.acceptance_criteria : [],
      execution_steps: buildExecutionSteps(src),
      evidence: buildPrExecutionEvidence({}),
      ready_for_branch_preparation: false,
      ready_for_pr_opening: false,
      ready_for_merge: false,
      awaiting_human_approval: true,
      merge_allowed: false,
      prod_deploy_allowed: false,
      github_execution: false,
      side_effects: false,
      risk_level: asString(src.risk_level) || "blocking",
      error: `BLOCKED: ${blockCheck.reason}`,
      errors: [`blocked:${blockCheck.reason}`],
    };
    plan.evidence = buildPrExecutionEvidence(plan);
    return plan;
  }

  // Validar forma do pacote
  const sourceValidation = validateSourcePackage(src);
  if (!sourceValidation.ok) {
    return {
      ok: false,
      mode: PR_EXECUTOR_MODE,
      source_package_mode: PR_PLANNER_MODE,
      error: "INVALID_PACKAGE_SHAPE: pacote PR-ready nao tem forma valida",
      errors: sourceValidation.errors,
    };
  }

  // Construir plano supervisionado
  const executionSteps = buildExecutionSteps(src);

  const plan = {
    ok: true,
    mode: PR_EXECUTOR_MODE,
    source_package_mode: PR_PLANNER_MODE,
    branch_name: asString(src.branch_name),
    pr_title: asString(src.pr_title),
    pr_body: asString(src.pr_body),
    files_to_change: Array.isArray(src.files_to_change) ? src.files_to_change.slice() : [],
    patch_plan: Array.isArray(src.patch_plan) ? src.patch_plan.slice() : src.patch_plan,
    tests_to_run: Array.isArray(src.tests_to_run) ? src.tests_to_run.slice() : [],
    rollback_plan: Array.isArray(src.rollback_plan) ? src.rollback_plan.slice() : src.rollback_plan,
    acceptance_criteria: Array.isArray(src.acceptance_criteria) ? src.acceptance_criteria.slice() : [],
    execution_steps: executionSteps,
    evidence: null, // preenchido abaixo
    ready_for_branch_preparation: true,
    ready_for_pr_opening: true,
    ready_for_merge: false,
    awaiting_human_approval: true,
    merge_allowed: false,
    prod_deploy_allowed: false,
    github_execution: false,
    side_effects: false,
    risk_level: asString(src.risk_level),
  };

  plan.evidence = buildPrExecutionEvidence(plan);

  return plan;
}

module.exports = {
  buildSupervisedPrExecutionPlan,
  validateSupervisedPrExecutionPlan,
  simulatePrExecutionStep,
  buildPrExecutionEvidence,
  assertPrExecutionGuards,
  PR_EXECUTOR_MODE,
  PR_PLANNER_MODE,
  KNOWN_STEPS,
};
