// 🧪 PR93 — Ready for Merge + Deploy TEST
// Run: node tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js

"use strict";

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const planner = require("../schema/enavia-pr-planner.js");
const executor = require("../schema/enavia-pr-executor-supervised.js");
const readiness = require("../schema/enavia-pr-readiness.js");

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

console.log("\n🧪 PR93 — Ready for Merge + Deploy TEST\n");

// ─── Pacote válido PR Planner (PR91) + Plano Executor (PR92) ───
const sampleInput = {
  request: "Implementar PR Readiness PR93 no repo nv-enavia sem execucao GitHub real",
  objective: "Criar helper de readiness consumindo plano PR92 e produzindo estado ready_for_merge/deploy_test_ready",
  scope: "schema/enavia-pr-readiness.js + teste + docs/governanca minima",
  files_to_change: [
    "schema/enavia-pr-readiness.js",
    "tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js",
    "schema/reports/PR93_READY_FOR_MERGE_DEPLOY_TEST.md",
  ],
  patch_plan: [
    "Criar helper puro PR Readiness.",
    "Criar teste de prova com cenarios minimos.",
    "Atualizar docs/governanca minima.",
  ],
  tests_to_run: [
    "node tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js",
    "node tests/pr92-pr-executor-supervisionado-mock.prova.test.js",
    "node tests/pr91-pr-planner-schema.prova.test.js",
    "node tests/pr90-pr-orchestrator-diagnostico.prova.test.js",
  ],
  rollback_plan: [
    "Reverter commit da PR93.",
    "Reexecutar regressao obrigatoria PR86-PR92.",
  ],
  acceptance_criteria: [
    "Readiness helper valido sem execucao GitHub real.",
    "Guardrails de merge/deploy e aprovacao humana preservados.",
    "ready_for_merge=true e deploy_test_ready=true para plano valido da PR92.",
    "Aguardando aprovacao humana para qualquer etapa sensivel.",
  ],
};

const pkg = planner.buildPrReadyPackage(sampleInput);
const plan = executor.buildSupervisedPrExecutionPlan(pkg);
const state = readiness.buildPrReadinessState(plan);

section("1-5 API do helper readiness");
ok(fs.existsSync("schema/enavia-pr-readiness.js"), "1. helper schema/enavia-pr-readiness.js existe");
ok(typeof readiness.buildPrReadinessState === "function", "2. buildPrReadinessState existe");
ok(typeof readiness.validatePrReadinessState === "function", "3. validatePrReadinessState existe");
ok(typeof readiness.buildReadinessEvidence === "function", "4. buildReadinessEvidence existe");
ok(typeof readiness.assertReadinessGuards === "function", "5. assertReadinessGuards existe");

section("6-9 Plano válido da PR92 → estado de readiness");
ok(pkg.ok === true, "6. pacote válido gerado pelo PR Planner (PR91)");
ok(plan.ok === true, "6b. plano de execução válido gerado pelo Executor (PR92)", JSON.stringify(plan.errors));
ok(state.ok === true, "7. buildPrReadinessState retorna ok=true para plano válido", JSON.stringify(state.errors || state.error));
ok(state.mode === "pr_readiness", "8. mode = pr_readiness");
ok(state.source_executor_mode === "pr_executor_supervised", "9. source_executor_mode = pr_executor_supervised");

section("10-14 Campos preservados do plano PR92");
ok(typeof state.branch_name === "string" && state.branch_name.length > 0, "10. preserva branch_name", `branch_name=${state.branch_name}`);
ok(typeof state.pr_title === "string" && state.pr_title.length > 0, "11. preserva pr_title", `pr_title=${state.pr_title}`);
ok(Array.isArray(state.tests_to_run) && state.tests_to_run.length > 0, "12. preserva tests_to_run");
ok(
  (Array.isArray(state.rollback_plan) && state.rollback_plan.length > 0) ||
    (typeof state.rollback_plan === "string" && state.rollback_plan.length > 0),
  "13. preserva rollback_plan"
);
ok(Array.isArray(state.acceptance_criteria), "14. preserva acceptance_criteria");

section("15-22 Guardrails de readiness");
ok(state.ready_for_merge === true, "15. ready_for_merge=true");
ok(state.deploy_test_ready === true, "16. deploy_test_ready=true");
ok(state.awaiting_human_approval === true, "17. awaiting_human_approval=true");
ok(state.prod_blocked_until_human_approval === true, "18. prod_blocked_until_human_approval=true");
ok(state.merge_allowed === false, "19. merge_allowed=false");
ok(state.prod_deploy_allowed === false, "20. prod_deploy_allowed=false");
ok(state.github_execution === false, "21. github_execution=false");
ok(state.side_effects === false, "22. side_effects=false");

section("23-26 final_status e human_actions_required");
ok(state.final_status === "awaiting_human_merge_approval", "23. final_status=awaiting_human_merge_approval");
ok(asArray(state.human_actions_required).includes("review_pr"), "24. human_actions_required contém review_pr");
ok(asArray(state.human_actions_required).includes("approve_merge"), "25. human_actions_required contém approve_merge");
ok(asArray(state.human_actions_required).includes("approve_prod_deploy"), "26. human_actions_required contém approve_prod_deploy");

section("27-32 evidence");
ok(state.evidence !== null && state.evidence !== undefined && typeof state.evidence === "object", "evidence existe e é objeto");
const ev = state.evidence;
ok(
  typeof ev.origem_pr91 === "string" && ev.origem_pr91.includes("PR91"),
  "27. evidence contém origem PR91",
  `origem_pr91=${ev.origem_pr91}`
);
ok(
  typeof ev.origem_pr92 === "string" && ev.origem_pr92.includes("PR92"),
  "28. evidence contém origem PR92",
  `origem_pr92=${ev.origem_pr92}`
);
ok(Array.isArray(ev.tests_to_run), "29. evidence contém tests_to_run");
ok(
  (Array.isArray(ev.rollback_plan) && ev.rollback_plan.length > 0) ||
    (typeof ev.rollback_plan === "string" && ev.rollback_plan.length > 0),
  "30. evidence contém rollback_plan"
);
ok(
  typeof ev.bloqueio_merge_automatico === "string" && ev.bloqueio_merge_automatico.length > 0,
  "31. evidence contém bloqueio de merge automático",
  `bloqueio_merge_automatico=${ev.bloqueio_merge_automatico}`
);
ok(
  typeof ev.bloqueio_prod_automatico === "string" && ev.bloqueio_prod_automatico.length > 0,
  "32. evidence contém bloqueio de PROD automático",
  `bloqueio_prod_automatico=${ev.bloqueio_prod_automatico}`
);

section("33-34 Plano inválido e plano bloqueado");
const invalidResult = readiness.buildPrReadinessState({ mode: "WRONG" });
ok(
  invalidResult.ok === false && typeof invalidResult.error === "string",
  "33. plano com mode inválido retorna ok=false com erro controlado",
  `error=${invalidResult.error}`
);

const blockedPlan = Object.assign({}, plan, { ok: false, error: "BLOCKED: TEST" });
const blockedResult = readiness.buildPrReadinessState(blockedPlan);
ok(blockedResult.ok === false, "34. plano bloqueado (ok=false) retorna ok=false");

section("35-38 assertReadinessGuards bloqueia violações");
const mergeViolation = readiness.assertReadinessGuards({ merge_allowed: true, prod_deploy_allowed: false, github_execution: false, side_effects: false, awaiting_human_approval: true, prod_blocked_until_human_approval: true });
ok(
  mergeViolation.ok === false && asArray(mergeViolation.violations).some((v) => v.includes("merge_allowed")),
  "35. assertReadinessGuards bloqueia merge_allowed=true"
);

const prodViolation = readiness.assertReadinessGuards({ merge_allowed: false, prod_deploy_allowed: true, github_execution: false, side_effects: false, awaiting_human_approval: true, prod_blocked_until_human_approval: true });
ok(
  prodViolation.ok === false && asArray(prodViolation.violations).some((v) => v.includes("prod_deploy_allowed")),
  "36. assertReadinessGuards bloqueia prod_deploy_allowed=true"
);

const githubViolation = readiness.assertReadinessGuards({ merge_allowed: false, prod_deploy_allowed: false, github_execution: true, side_effects: false, awaiting_human_approval: true, prod_blocked_until_human_approval: true });
ok(
  githubViolation.ok === false && asArray(githubViolation.violations).some((v) => v.includes("github_execution")),
  "37. assertReadinessGuards bloqueia github_execution=true"
);

const sideEffectsViolation = readiness.assertReadinessGuards({ merge_allowed: false, prod_deploy_allowed: false, github_execution: false, side_effects: true, awaiting_human_approval: true, prod_blocked_until_human_approval: true });
ok(
  sideEffectsViolation.ok === false && asArray(sideEffectsViolation.violations).some((v) => v.includes("side_effects")),
  "38. assertReadinessGuards bloqueia side_effects=true"
);

section("39-46 Isolamento de dependências proibidas");
const readinessSource = fs.readFileSync("schema/enavia-pr-readiness.js", "utf8");
ok(
  !readinessSource.includes("require") || !(
    readinessSource.includes("require(\"../nv-enavia\")") ||
    readinessSource.includes("require('../nv-enavia')") ||
    readinessSource.includes("nv-enavia.js")
  ),
  "39. não importa/usa nv-enavia.js"
);
ok(
  !readinessSource.includes("require") || !(
    readinessSource.includes("executor/src/index") ||
    readinessSource.includes("executor/src/index.js")
  ),
  "40. não importa/usa executor/src/index.js"
);
ok(
  !readinessSource.includes("require") || !(
    readinessSource.includes("contract-executor") ||
    readinessSource.includes("contract-executor.js")
  ),
  "41. não importa/usa contract-executor.js"
);
ok(!readinessSource.includes("fetch("), "42. não chama fetch");
ok(!readinessSource.includes("child_process"), "43. não usa child_process");
ok(
  !readinessSource.includes("fs.writeFile") && !readinessSource.includes("fs.appendFile") && !readinessSource.includes("writeSync"),
  "44. não usa fs write/runtime"
);
ok(!readinessSource.includes("gh "), "45. não usa gh CLI");
ok(!readinessSource.includes("api.github.com"), "46. não contém api.github.com");

section("47-55 Regressão — testes anteriores continuam passando");
{
  const t92 = runNodeTest("tests/pr92-pr-executor-supervisionado-mock.prova.test.js");
  ok(t92.ok, "47. PR92 continua passando", t92.ok ? "" : t92.output.slice(-400));
}
{
  const t91 = runNodeTest("tests/pr91-pr-planner-schema.prova.test.js");
  ok(t91.ok, "48. PR91 continua passando", t91.ok ? "" : t91.output.slice(-400));
}
{
  const t90 = runNodeTest("tests/pr90-pr-orchestrator-diagnostico.prova.test.js");
  ok(t90.ok, "49. PR90 continua passando", t90.ok ? "" : t90.output.slice(-400));
}
{
  const t89 = runNodeTest("tests/pr89-internal-loop-final-proof.smoke.test.js");
  ok(t89.ok, "50. PR89 continua passando", t89.ok ? "" : t89.output.slice(-400));
}
{
  const t88 = runNodeTest("tests/pr88-worker-executor-stitch.smoke.test.js");
  ok(t88.ok, "51. PR88 continua passando", t88.ok ? "" : t88.output.slice(-400));
}
{
  const t87 = runNodeTest("tests/pr87-deploy-test-finalize-runner.smoke.test.js");
  ok(t87.ok, "52. PR87 continua passando", t87.ok ? "" : t87.output.slice(-400));
}
{
  const t86 = runNodeTest("tests/pr86-deploy-orchestrator-gap.prova.test.js");
  ok(t86.ok, "53. PR86 continua passando", t86.ok ? "" : t86.output.slice(-400));
}
{
  const tContract = runNodeTest("executor/tests/executor.contract.test.js");
  ok(tContract.ok, "54. executor.contract continua passando", tContract.ok ? "" : tContract.output.slice(-400));
}
{
  const tCloud = runNodeTest("executor/tests/cloudflare-credentials.test.js");
  ok(tCloud.ok, "55. cloudflare-credentials continua passando", tCloud.ok ? "" : tCloud.output.slice(-400));
}

section("56-60 Relatório + Governança");
ok(
  fs.existsSync("schema/reports/PR93_READY_FOR_MERGE_DEPLOY_TEST.md"),
  "56. relatório PR93 existe"
);
{
  let reportOk = false;
  let reportContent = "";
  try {
    reportContent = fs.readFileSync("schema/reports/PR93_READY_FOR_MERGE_DEPLOY_TEST.md", "utf8");
    reportOk = true;
  } catch (_) {}
  ok(
    reportOk && reportContent.includes("O que foi provado"),
    "57. relatório PR93 declara o que foi provado"
  );
  ok(
    reportOk && reportContent.includes("O que ainda falta"),
    "58. relatório PR93 declara o que ainda falta"
  );
  ok(
    reportOk && reportContent.includes("O que não foi mexido"),
    "59. relatório PR93 declara o que não foi mexido"
  );
}
{
  let indexContent = "";
  try {
    indexContent = fs.readFileSync("schema/contracts/INDEX.md", "utf8");
  } catch (_) {}
  ok(
    indexContent.includes("PR90–PR93") && (indexContent.includes("Encerrado") || indexContent.includes("encerrado")),
    "60. INDEX.md marca contrato PR90–PR93 como encerrado/concluído"
  );
}

// ─── Resultado final ───
console.log(`\n${"─".repeat(50)}`);
console.log(`\n🏁 Resultado: ${PASSED} passando / ${FAILED} falhando\n`);

if (FAILED > 0) {
  process.exit(1);
}
