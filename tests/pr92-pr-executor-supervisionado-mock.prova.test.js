// 🧪 PR92 — PR Executor Supervisionado (mock/adapter testável)
// Run: node tests/pr92-pr-executor-supervisionado-mock.prova.test.js

"use strict";

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const planner = require("../schema/enavia-pr-planner.js");
const executor = require("../schema/enavia-pr-executor-supervised.js");

let PASSED = 0;
let FAILED = 0;

function section(title) {
  console.log(`\n── ${title} ──`);
}

function ok(condition, label, details = "") {
  if (condition) {
    PASSED += 1;
    console.log(`  ✅ ${label}`);
    return;
  }
  FAILED += 1;
  console.log(`  ❌ ${label}`);
  if (details) console.log(`     ↳ ${details}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function runNodeTest(testPath) {
  const result = spawnSync("node", [testPath], { encoding: "utf8", timeout: 60000 });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`.trim(),
  };
}

console.log("\n🧪 PR92 — PR Executor Supervisionado\n");

// Pacote válido gerado pelo PR Planner (PR91)
const sampleInput = {
  request: "Implementar PR Executor Supervisionado PR92 no repo nv-enavia sem execucao GitHub real",
  objective: "Criar executor supervisionado consumindo pacote PR-ready da PR91",
  scope: "schema/enavia-pr-executor-supervised.js + teste + docs/governanca minima",
  files_to_change: [
    "schema/enavia-pr-executor-supervised.js",
    "tests/pr92-pr-executor-supervisionado-mock.prova.test.js",
    "schema/reports/PR92_PR_EXECUTOR_SUPERVISIONADO.md",
  ],
  patch_plan: [
    "Criar helper puro PR Executor Supervisionado.",
    "Criar teste de prova com cenarios minimos.",
    "Atualizar docs/governanca minima.",
  ],
  tests_to_run: [
    "node tests/pr92-pr-executor-supervisionado-mock.prova.test.js",
    "node tests/pr91-pr-planner-schema.prova.test.js",
    "node tests/pr90-pr-orchestrator-diagnostico.prova.test.js",
  ],
  rollback_plan: [
    "Reverter commit da PR92.",
    "Reexecutar regressao obrigatoria PR86-PR91.",
  ],
  acceptance_criteria: [
    "Executor supervisionado valido sem execucao GitHub real.",
    "Guardrails de merge/deploy e aprovacao humana preservados.",
    "Aguardando aprovacao humana para qualquer etapa sensivel.",
  ],
};

const pkg = planner.buildPrReadyPackage(sampleInput);
const plan = executor.buildSupervisedPrExecutionPlan(pkg);

section("1-6 API do helper executor");
ok(fs.existsSync("schema/enavia-pr-executor-supervised.js"), "1. helper schema/enavia-pr-executor-supervised.js existe");
ok(typeof executor.buildSupervisedPrExecutionPlan === "function", "2. buildSupervisedPrExecutionPlan existe");
ok(typeof executor.validateSupervisedPrExecutionPlan === "function", "3. validateSupervisedPrExecutionPlan existe");
ok(typeof executor.simulatePrExecutionStep === "function", "4. simulatePrExecutionStep existe");
ok(typeof executor.buildPrExecutionEvidence === "function", "5. buildPrExecutionEvidence existe");
ok(typeof executor.assertPrExecutionGuards === "function", "6. assertPrExecutionGuards existe");

section("7-18 pacote valido e shape basico");
ok(pkg.ok === true, "7. consome pacote valido gerado por buildPrReadyPackage", JSON.stringify(pkg.errors || []));
ok(plan.ok === true, "8. retorna ok=true para pacote valido", JSON.stringify(plan.errors || []));
ok(plan.mode === "pr_executor_supervised", "9. mode = pr_executor_supervised", plan.mode);
ok(plan.source_package_mode === "pr_planner", "10. source_package_mode = pr_planner", plan.source_package_mode);
ok(plan.branch_name === pkg.branch_name, "11. preserva branch_name", plan.branch_name);
ok(plan.pr_title === pkg.pr_title, "12. preserva pr_title", plan.pr_title);
ok(plan.pr_body === pkg.pr_body, "13. preserva pr_body");
ok(JSON.stringify(plan.files_to_change) === JSON.stringify(pkg.files_to_change), "14. preserva files_to_change");
ok(JSON.stringify(plan.patch_plan) === JSON.stringify(pkg.patch_plan), "15. preserva patch_plan");
ok(JSON.stringify(plan.tests_to_run) === JSON.stringify(pkg.tests_to_run), "16. preserva tests_to_run");
ok(JSON.stringify(plan.rollback_plan) === JSON.stringify(pkg.rollback_plan), "17. preserva rollback_plan");
ok(JSON.stringify(plan.acceptance_criteria) === JSON.stringify(pkg.acceptance_criteria), "18. preserva acceptance_criteria");

section("19-26 execution_steps deterministicos");
const stepNames = asArray(plan.execution_steps).map((s) => s.step);
ok(Array.isArray(plan.execution_steps) && plan.execution_steps.length > 0, "19. cria execution_steps");
ok(stepNames.includes("validate_package"), "20. execution_steps contem validate_package");
ok(stepNames.includes("prepare_branch_plan"), "21. execution_steps contem prepare_branch_plan");
ok(stepNames.includes("prepare_patch_plan"), "22. execution_steps contem prepare_patch_plan");
ok(stepNames.includes("prepare_tests_plan"), "23. execution_steps contem prepare_tests_plan");
ok(stepNames.includes("prepare_pr_metadata"), "24. execution_steps contem prepare_pr_metadata");
ok(stepNames.includes("prepare_rollback_plan"), "25. execution_steps contem prepare_rollback_plan");
ok(stepNames.includes("await_human_review"), "26. execution_steps contem await_human_review");

section("27-35 guardrails obrigatorios");
ok(plan.ready_for_branch_preparation === true, "27. ready_for_branch_preparation=true em pacote valido");
ok(plan.ready_for_pr_opening === true, "28. ready_for_pr_opening=true em pacote valido");
ok(plan.ready_for_merge === false, "29. ready_for_merge=false");
ok(plan.awaiting_human_approval === true, "30. awaiting_human_approval=true");
ok(plan.merge_allowed === false, "31. merge_allowed=false");
ok(plan.prod_deploy_allowed === false, "32. prod_deploy_allowed=false");
ok(plan.github_execution === false, "33. github_execution=false");
ok(plan.side_effects === false, "34. side_effects=false");
ok(plan.risk_level === pkg.risk_level, "35. risk_level preservado", plan.risk_level);

section("36-39 pacotes bloqueados continuam bloqueados");
const blockedMerge = planner.buildPrReadyPackage({ request: "fazer merge automatico na main sem aprovacao" });
const blockedProd = planner.buildPrReadyPackage({ request: "fazer deploy prod automatico agora" });
const blockedSecrets = planner.buildPrReadyPackage({ request: "use secrets e token de producao" });
const blockedRepo = planner.buildPrReadyPackage({ request: "aplicar patch em outro repo externo" });

const planBlockedMerge = executor.buildSupervisedPrExecutionPlan(blockedMerge);
const planBlockedProd = executor.buildSupervisedPrExecutionPlan(blockedProd);
const planBlockedSecrets = executor.buildSupervisedPrExecutionPlan(blockedSecrets);
const planBlockedRepo = executor.buildSupervisedPrExecutionPlan(blockedRepo);

ok(planBlockedMerge.ok === false, "36. pacote bloqueado por merge automatico continua bloqueado", JSON.stringify(planBlockedMerge.error));
ok(planBlockedProd.ok === false, "37. pacote bloqueado por deploy PROD automatico continua bloqueado", JSON.stringify(planBlockedProd.error));
ok(planBlockedSecrets.ok === false, "38. pacote bloqueado por secrets continua bloqueado", JSON.stringify(planBlockedSecrets.error));
ok(planBlockedRepo.ok === false, "39. pacote bloqueado por outro repo continua bloqueado", JSON.stringify(planBlockedRepo.error));

section("40 pacote invalido");
const invalidPlan = executor.buildSupervisedPrExecutionPlan({ mode: "pr_planner" });
ok(invalidPlan.ok === false && typeof invalidPlan.error === "string", "40. pacote invalido retorna ok=false com erro controlado", JSON.stringify(invalidPlan.error));

section("41-42 simulatePrExecutionStep");
const simStep = executor.simulatePrExecutionStep(plan, "validate_package");
ok(simStep.real_execution === false && simStep.side_effects === false, "41. simulatePrExecutionStep nao executa side effect real");
const simUnknown = executor.simulatePrExecutionStep(plan, "executa_github_real");
ok(simUnknown.ok === false && typeof simUnknown.error === "string", "42. simulatePrExecutionStep retorna erro controlado para step desconhecido", simUnknown.error);

section("43-46 evidence");
ok(plan.evidence && /PR91/i.test(JSON.stringify(plan.evidence)), "43. evidence contem origem PR91");
ok(plan.evidence && Array.isArray(plan.evidence.steps_planned) && plan.evidence.steps_planned.length > 0, "44. evidence contem lista de steps");
ok(plan.evidence && plan.evidence.merge_allowed === false && /merge/i.test(plan.evidence.bloqueio_merge_humano), "45. evidence contem bloqueio de merge humano");
ok(plan.evidence && plan.evidence.prod_deploy_allowed === false && /prod/i.test(plan.evidence.bloqueio_prod_humano), "46. evidence contem bloqueio de PROD humano");

section("47-53 isolamento de codigo");
const executorSource = fs.readFileSync("schema/enavia-pr-executor-supervised.js", "utf8");
ok(!/nv-enavia\.js/.test(executorSource), "47. nao importa/usa nv-enavia.js");
ok(!/executor\/src\/index\.js/.test(executorSource), "48. nao importa/usa executor/src/index.js");
ok(!/contract-executor\.js/.test(executorSource), "49. nao importa/usa contract-executor.js");
ok(!/\bfetch\s*\(/.test(executorSource), "50. nao chama fetch");
ok(!/child_process/.test(executorSource), "51. nao usa child_process");
ok(!/fs\.write|writeFileSync|appendFileSync|createWriteStream/.test(executorSource), "52. nao usa fs write/runtime");
ok(!/api\.github\.com/.test(executorSource), "53. nao contem api.github.com");

section("54-60 regressao obrigatoria");
const regressions = [
  ["54. PR91 continua passando", "tests/pr91-pr-planner-schema.prova.test.js"],
  ["55. PR90 continua passando", "tests/pr90-pr-orchestrator-diagnostico.prova.test.js"],
  ["56. PR89 continua passando", "tests/pr89-internal-loop-final-proof.smoke.test.js"],
  ["57. PR88 continua passando", "tests/pr88-worker-executor-stitch.smoke.test.js"],
  ["58. PR87 continua passando", "tests/pr87-deploy-test-finalize-runner.smoke.test.js"],
  ["59. PR86 continua passando", "tests/pr86-deploy-orchestrator-gap.prova.test.js"],
  ["60. executor.contract continua passando", "executor/tests/executor.contract.test.js"],
  ["61. cloudflare-credentials continua passando", "executor/tests/cloudflare-credentials.test.js"],
];

for (const [label, path] of regressions) {
  const result = runNodeTest(path);
  ok(result.ok, label, `status=${result.status}`);
}

section("62-66 docs/governanca");
const reportText = fs.readFileSync("schema/reports/PR92_PR_EXECUTOR_SUPERVISIONADO.md", "utf8");
const indexText = fs.readFileSync("schema/contracts/INDEX.md", "utf8");

ok(/o que foi implementado/i.test(reportText), "62. relatorio PR92 declara o que foi implementado");
ok(/o que nao foi mexido/i.test(reportText), "63. relatorio PR92 declara o que nao foi mexido");
ok(/o que fica para PR93/i.test(reportText), "64. relatorio PR92 declara o que fica para PR93");
ok(
  /pr[oó]xima PR autorizada:\s*PR93\s*—\s*Ready for Merge/i.test(indexText) ||
  /PR93.*conclu[ií]da/i.test(indexText),
  "65. INDEX.md avanca proxima PR para PR93 — Ready for Merge + Deploy TEST (ou ja concluida)",
  "Texto INDEX.md nao contem a marcacao esperada"
);

// Valida o plano completo via validateSupervisedPrExecutionPlan
const validation = executor.validateSupervisedPrExecutionPlan(plan);
ok(validation.ok === true, "66. validateSupervisedPrExecutionPlan retorna ok=true para plano valido", JSON.stringify(validation.errors || []));

console.log(`\nRESULTADO PR92: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) process.exit(1);
