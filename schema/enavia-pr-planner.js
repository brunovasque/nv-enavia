"use strict";

const PR_PLANNER_MODE = "pr_planner";
const ALLOWED_RISK_LEVELS = ["low", "medium", "high", "blocking"];

const BLOCK_RULES = [
  { code: "AUTO_MERGE_BLOCKED", reason: "Pedido de merge automatico bloqueado.", re: /\b(auto[- ]?merge|merge automatico|merge automatic|merge direto|merge sem aprovacao)\b/i },
  { code: "AUTO_PROD_DEPLOY_BLOCKED", reason: "Pedido de deploy PROD automatico bloqueado.", re: /\b(deploy\s*prod|deploy\s*production|promover\s*prod|producao\s*automatica|prod\s*automatic)\b/i },
  { code: "SECRETS_BLOCKED", reason: "Pedido envolvendo secrets/credenciais bloqueado.", re: /\b(secret|secrets|token|api[_ -]?key|authorization|senha|credencial)\b/i },
  { code: "CROSS_REPO_BLOCKED", reason: "Pedido em outro repositorio bloqueado.", re: /\b(outro repo|outro repositorio|other repo|external repo|repositorio externo|multi-repo)\b/i },
  { code: "ENOVA_BLOCKED", reason: "Pedido envolvendo Enova bloqueado.", re: /\b(enova)\b/i },
  { code: "BROWSER_ACTION_BLOCKED", reason: "Pedido com browser action bloqueado.", re: /\b(browser action|playwright|puppeteer|abrir navegador|navegador automatizado)\b/i },
  { code: "MAIN_BRANCH_DIRECT_CHANGE_BLOCKED", reason: "Alteracao direta de main bloqueada.", re: /\b(direto na main|alterar main diretamente|alteracao direta de main|altera[cç][aã]o direta de main|push na main|commit na main|editar main direto)\b/i },
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

function pickText(input) {
  const src = asObject(input);
  const fields = [
    src.request,
    src.objective,
    src.goal,
    src.scope,
    src.message,
    src.repo,
    src.target_repo,
    src.branch_name,
    src.branch_hint,
    src.pr_title,
  ];

  const listFields = [];
  listFields.push(...asStringArray(src.files_to_change));
  listFields.push(...asStringArray(src.patch_plan));
  listFields.push(...asStringArray(src.tests_to_run));
  listFields.push(...asStringArray(src.rollback_plan));
  listFields.push(...asStringArray(src.acceptance_criteria));

  return [...fields, ...listFields].map((v) => asString(v)).filter(Boolean).join(" | ");
}

function slugify(text) {
  const normalized = asString(text)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  return normalized || "pr-planner";
}

function stableHash(text) {
  const source = asString(text) || "pr-planner";
  let hash = 2166136261;
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const unsigned = hash >>> 0;
  return unsigned.toString(36).padStart(7, "0").slice(0, 7);
}

function containsRequiredBodySections(text) {
  const lower = asString(text).toLowerCase();
  return (
    lower.includes("objetivo") &&
    lower.includes("escopo") &&
    lower.includes("arquivos planejados") &&
    lower.includes("testes") &&
    lower.includes("rollback") &&
    lower.includes("criterios de aceite") &&
    lower.includes("bloqueios humanos")
  );
}

function normalizePrBranchName(input) {
  const src = asObject(input);
  const baseText = asString(src.branch_hint) || asString(src.branch_name) || asString(src.pr_title) || asString(src.objective) || asString(src.request) || "pr-planner";
  const slug = slugify(baseText).slice(0, 48);
  const hash = stableHash(baseText);
  return `codex/pr-planner-${slug}-${hash}`;
}

function classifyPrRisk(input) {
  const text = pickText(input);
  const blocked_by = [];

  for (const rule of BLOCK_RULES) {
    if (rule.re.test(text)) {
      blocked_by.push({ code: rule.code, reason: rule.reason });
    }
  }

  if (blocked_by.length > 0) {
    return {
      risk_level: "blocking",
      blocked: true,
      blocked_by,
      reasons: blocked_by.map((item) => item.reason),
    };
  }

  const lower = text.toLowerCase();
  const maybeHigh = /\b(deploy|rollback|hotfix|production|prod)\b/.test(lower);
  const maybeMedium = /\b(refactor|multiple files|multiplos arquivos|grande impacto)\b/.test(lower);

  if (maybeHigh) {
    return { risk_level: "high", blocked: false, blocked_by: [], reasons: ["Pedido com superficie de deploy/produção."] };
  }
  if (maybeMedium) {
    return { risk_level: "medium", blocked: false, blocked_by: [], reasons: ["Pedido com impacto moderado de mudanca."] };
  }
  return { risk_level: "low", blocked: false, blocked_by: [], reasons: ["Pedido de baixo risco sem acao perigosa."] };
}

function buildPrBody(pkg) {
  const src = asObject(pkg);
  const objective = asString(src.objective) || "Definir pacote PR-ready supervisionado.";
  const scope = asString(src.scope) || "Schema/modelo + helper puro + testes + docs/governanca minima.";
  const files = asStringArray(src.files_to_change);
  const tests = asStringArray(src.tests_to_run);
  const rollback = asStringArray(src.rollback_plan);
  const criteria = asStringArray(src.acceptance_criteria);

  return [
    "## Objetivo",
    objective,
    "",
    "## Escopo",
    scope,
    "",
    "## Arquivos planejados",
    ...(files.length > 0 ? files.map((item) => `- ${item}`) : ["- (sem arquivos informados)"]),
    "",
    "## Testes",
    ...(tests.length > 0 ? tests.map((item) => `- ${item}`) : ["- (sem testes informados)"]),
    "",
    "## Rollback",
    ...(rollback.length > 0 ? rollback.map((item) => `- ${item}`) : ["- Reverter commit da PR."]),
    "",
    "## Criterios de aceite",
    ...(criteria.length > 0 ? criteria.map((item) => `- ${item}`) : ["- Pacote PR-ready validado."]),
    "",
    "## Bloqueios humanos",
    "- Aprovacao humana obrigatoria antes de merge.",
    "- Deploy PROD automatico permanece bloqueado.",
    "- Execucao GitHub real permanece desabilitada nesta PR.",
  ].join("\n");
}

function validatePrReadyPackage(pkg) {
  const src = asObject(pkg);
  const errors = [];

  const requiredFields = [
    "ok",
    "mode",
    "branch_name",
    "files_to_change",
    "patch_plan",
    "tests_to_run",
    "rollback_plan",
    "acceptance_criteria",
    "pr_title",
    "pr_body",
    "risk_level",
    "ready_for_human_review",
    "awaiting_human_approval",
    "merge_allowed",
    "prod_deploy_allowed",
    "github_execution",
    "side_effects",
    "evidence",
  ];

  for (const field of requiredFields) {
    if (!(field in src)) errors.push(`missing:${field}`);
  }

  if (src.mode !== PR_PLANNER_MODE) errors.push("invalid:mode");
  if (!/^codex\/[a-z0-9][a-z0-9\/-]*$/.test(asString(src.branch_name))) errors.push("invalid:branch_name");
  if (!Array.isArray(src.files_to_change)) errors.push("invalid:files_to_change");

  const patchPlanTypeValid = Array.isArray(src.patch_plan) || typeof src.patch_plan === "string";
  if (!patchPlanTypeValid) errors.push("invalid:patch_plan_type");
  if (Array.isArray(src.patch_plan) && src.patch_plan.length === 0) errors.push("invalid:patch_plan_empty");
  if (typeof src.patch_plan === "string" && asString(src.patch_plan).length === 0) errors.push("invalid:patch_plan_empty");

  if (!Array.isArray(src.tests_to_run)) errors.push("invalid:tests_to_run");

  const rollbackTypeValid = Array.isArray(src.rollback_plan) || typeof src.rollback_plan === "string";
  if (!rollbackTypeValid) errors.push("invalid:rollback_plan_type");
  if (Array.isArray(src.rollback_plan) && src.rollback_plan.length === 0) errors.push("invalid:rollback_plan_empty");
  if (typeof src.rollback_plan === "string" && asString(src.rollback_plan).length === 0) errors.push("invalid:rollback_plan_empty");

  if (!Array.isArray(src.acceptance_criteria)) errors.push("invalid:acceptance_criteria");
  if (asString(src.pr_title).length === 0 || asString(src.pr_title).length > 120) errors.push("invalid:pr_title");
  if (!containsRequiredBodySections(src.pr_body)) errors.push("invalid:pr_body_sections");

  if (!ALLOWED_RISK_LEVELS.includes(src.risk_level)) errors.push("invalid:risk_level");

  if (src.awaiting_human_approval !== true) errors.push("invalid:awaiting_human_approval");
  if (src.merge_allowed !== false) errors.push("invalid:merge_allowed");
  if (src.prod_deploy_allowed !== false) errors.push("invalid:prod_deploy_allowed");
  if (src.github_execution !== false) errors.push("invalid:github_execution");
  if (src.side_effects !== false) errors.push("invalid:side_effects");

  const blockedRequested = src.request_blocked === true;
  if (!blockedRequested && src.ready_for_human_review !== true) errors.push("invalid:ready_for_human_review");
  if (blockedRequested && src.ready_for_human_review !== false) errors.push("invalid:ready_for_human_review_for_blocked");

  return {
    ok: errors.length === 0,
    errors,
  };
}

function buildPrReadyPackage(input) {
  const src = asObject(input);
  const objective = asString(src.objective) || asString(src.request) || asString(src.goal) || "Preparar pacote PR-ready supervisionado.";
  const scope = asString(src.scope) || "schema/modelo + helper puro + testes + docs/governanca minima";

  const files = asStringArray(src.files_to_change).length > 0
    ? asStringArray(src.files_to_change)
    : ["schema/enavia-pr-planner.js", "tests/pr91-pr-planner-schema.prova.test.js"];

  const patchPlan = Array.isArray(src.patch_plan)
    ? asStringArray(src.patch_plan)
    : (asString(src.patch_plan) || [
      "Definir schema interno do pacote PR-ready.",
      "Aplicar validacao e guardrails deny-by-default.",
      "Documentar estado e preparar prova supervisionada.",
    ]);

  const testsToRun = asStringArray(src.tests_to_run).length > 0
    ? asStringArray(src.tests_to_run)
    : [
      "node tests/pr91-pr-planner-schema.prova.test.js",
      "node tests/pr90-pr-orchestrator-diagnostico.prova.test.js",
    ];

  const rollbackPlan = Array.isArray(src.rollback_plan)
    ? asStringArray(src.rollback_plan)
    : (asString(src.rollback_plan) || [
      "Reverter commit da PR91 com git revert <commit>.",
      "Reexecutar regressao PR86-PR90.",
    ]);

  const acceptance = asStringArray(src.acceptance_criteria).length > 0
    ? asStringArray(src.acceptance_criteria)
    : [
      "Pacote PR-ready valido sem execucao GitHub real.",
      "Guardrails de merge/deploy/secrets preservados.",
      "Aguardando aprovacao humana para qualquer etapa sensivel.",
    ];

  const prTitleBase = asString(src.pr_title) || `PR Planner: ${objective}`;
  const prTitle = prTitleBase.length > 120 ? `${prTitleBase.slice(0, 117)}...` : prTitleBase;

  const risk = classifyPrRisk(src);
  const branchName = normalizePrBranchName({
    branch_hint: asString(src.branch_name) || asString(src.branch_hint),
    objective,
    request: asString(src.request),
    pr_title: prTitle,
  });

  const pkg = {
    ok: false,
    mode: PR_PLANNER_MODE,
    branch_name: branchName,
    files_to_change: files,
    patch_plan: patchPlan,
    tests_to_run: testsToRun,
    rollback_plan: rollbackPlan,
    acceptance_criteria: acceptance,
    pr_title: prTitle,
    pr_body: "",
    risk_level: risk.risk_level,
    ready_for_human_review: !risk.blocked,
    awaiting_human_approval: true,
    merge_allowed: false,
    prod_deploy_allowed: false,
    github_execution: false,
    side_effects: false,
    evidence: {
      planner: "pr91",
      blocked_by: risk.blocked_by,
      reasons: risk.reasons,
    },
    objective,
    scope,
    request_blocked: risk.blocked,
  };

  pkg.pr_body = buildPrBody(pkg);

  const validation = validatePrReadyPackage(pkg);
  const blockedErrors = risk.blocked ? risk.blocked_by.map((item) => `blocked:${item.code}`) : [];
  const errors = [...validation.errors, ...blockedErrors];

  pkg.ready_for_human_review = validation.ok && !risk.blocked;
  pkg.ok = pkg.ready_for_human_review;
  pkg.evidence.validation_errors = errors;

  if (!pkg.ok) {
    pkg.error = "PR_READY_PACKAGE_INVALID";
    pkg.errors = errors;
  }

  return pkg;
}

module.exports = {
  buildPrReadyPackage,
  validatePrReadyPackage,
  normalizePrBranchName,
  classifyPrRisk,
  buildPrBody,
  PR_PLANNER_MODE,
  ALLOWED_RISK_LEVELS,
};
