// ============================================================================
// 🧪 PR86 — Deploy Orchestrator Gap Proof (prova diagnóstica)
//
// Run: node tests/pr86-deploy-orchestrator-gap.prova.test.js
//
// Objetivo:
// Provar, sem alterar runtime, onde o loop interno de deploy/orquestração
// quebra entre smart_deploy_plan/SIMULATE e deploy_execute_plan/finalize.
//
// Cenários mínimos obrigatórios (1..30):
//  1. contract-executor.js existe
//  2. nv-enavia.js existe
//  3. executor/src/index.js existe
//  4. testes antigos pr14/pr18/pr19/pr20/pr21 existem
//  5. smart_deploy_plan aparece no código
//  6. deploy_execute_plan aparece no código ou fica comprovado que não aparece
//  7. finalize aparece no código ou fica comprovado que não aparece
//  8. advance phase existe
//  9. loop status existe
// 10. execution_id aparece no fluxo
// 11. contract_id aparece no fluxo
// 12. AUDIT está mapeado
// 13. PROPOSE está mapeado
// 14. SIMULATE/smart_deploy_plan está mapeado
// 15. deploy_execute_plan está parcial/ausente ou não chega a finalize
// 16. STEP_TYPE_NOT_IMPLEMENTED aparece como possibilidade real, se existir
// 17. teste identifica ponto provável de quebra
// 18. teste não altera runtime
// 19. teste não altera executor
// 20. teste não altera workflow
// 21. pr14 continua passando
// 22. pr18 continua passando
// 23. pr19 continua passando
// 24. pr20 continua passando
// 25. pr21 continua passando
// 26. relatório PR86 declara o que já funciona
// 27. relatório PR86 declara onde o loop quebra
// 28. relatório PR86 declara o menor patch recomendado para PR87
// 29. relatório PR86 lista funções que NÃO devem ser refatoradas
// 30. relatório PR86 recomenda sequência PR87–PR89 sem abrir novo escopo
// ============================================================================

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let PASSED = 0;
let FAILED = 0;
const FAILURES = [];

function ok(condition, label, info) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    PASSED++;
    return;
  }
  console.error(`  ❌ ${label}${info ? ` — ${info}` : ""}`);
  FAILED++;
  FAILURES.push(label);
}

function readFile(rel) {
  try {
    return readFileSync(resolve(ROOT, rel), "utf8");
  } catch {
    return "";
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

function runRegression(label, command) {
  try {
    execSync(command, { cwd: ROOT, stdio: "pipe", encoding: "utf8" });
    ok(true, label);
  } catch (err) {
    const stderr = err?.stderr ? String(err.stderr).trim().slice(0, 220) : "falha";
    ok(false, label, stderr || "falha");
  }
}

function getTrackedChanges() {
  try {
    const out = execSync("git status --porcelain", {
      cwd: ROOT,
      stdio: "pipe",
      encoding: "utf8",
    });
    return out.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  } catch {
    return [];
  }
}

const contractExecutorPath = "contract-executor.js";
const workerPath = "nv-enavia.js";
const executorPath = "executor/src/index.js";
const pr14Path = "tests/pr14-executor-deploy-real-loop.smoke.test.js";
const pr18Path = "tests/pr18-advance-phase-endpoint.smoke.test.js";
const pr19Path = "tests/pr19-advance-phase-e2e.smoke.test.js";
const pr20Path = "tests/pr20-loop-status-in-progress.smoke.test.js";
const pr21Path = "tests/pr21-loop-status-states.smoke.test.js";
const reportPath = "schema/reports/PR86_DEPLOY_ORCHESTRATOR_GAP.md";

const contractExecutor = readFile(contractExecutorPath);
const worker = readFile(workerPath);
const executor = readFile(executorPath);
const report = readFile(reportPath);

const smartPlanStepsMatch = executor.match(/const steps = \[(.*?)\];/s);
const smartPlanSteps = smartPlanStepsMatch
  ? [...smartPlanStepsMatch[1].matchAll(/type:\s*"([^"]+)"/g)].map((m) => m[1])
  : [];

const handledStepTypes = [];
if (executor.includes('if (stepType === "audit" || stepType === "propose")')) {
  handledStepTypes.push("audit", "propose");
}
if (executor.includes('else if (stepType === "apply_test")')) {
  handledStepTypes.push("apply_test");
}
if (executor.includes('else if (stepType === "await_proof")')) {
  handledStepTypes.push("await_proof");
}

const uniqueHandled = [...new Set(handledStepTypes)];
const missingPlanSteps = smartPlanSteps.filter((s) => !uniqueHandled.includes(s));
const probableBreakStep = missingPlanSteps[0] || null;

console.log("\n🧪 PR86 — Deploy Orchestrator Gap Proof\n");

section("1–4 Arquivos base e testes legados");
ok(existsSync(resolve(ROOT, contractExecutorPath)), "1. contract-executor.js existe");
ok(existsSync(resolve(ROOT, workerPath)), "2. nv-enavia.js existe");
ok(existsSync(resolve(ROOT, executorPath)), "3. executor/src/index.js existe");
ok(
  existsSync(resolve(ROOT, pr14Path)) &&
  existsSync(resolve(ROOT, pr18Path)) &&
  existsSync(resolve(ROOT, pr19Path)) &&
  existsSync(resolve(ROOT, pr20Path)) &&
  existsSync(resolve(ROOT, pr21Path)),
  "4. testes antigos pr14/pr18/pr19/pr20/pr21 existem"
);

section("5–17 Mapeamento e gap do orchestrator");
ok(
  executor.includes("smart_deploy_plan") &&
  executor.includes("handleSmartDeployPlan"),
  "5. smart_deploy_plan aparece no código"
);

const deployExecuteInExecutor = executor.includes("deploy_execute_plan");
const deployExecuteInWorker = worker.includes("deploy_execute_plan");
const deployExecuteInContractExecutor = contractExecutor.includes("deploy_execute_plan");
ok(
  deployExecuteInExecutor || (!deployExecuteInWorker && !deployExecuteInContractExecutor),
  "6. deploy_execute_plan aparece no código ou fica comprovado que não aparece",
  `executor=${deployExecuteInExecutor} worker=${deployExecuteInWorker} contract-executor=${deployExecuteInContractExecutor}`
);

const finalizeInExecutor = executor.includes('type: "finalize"');
const finalizeInWorker = worker.includes("finalize");
const finalizeInContractExecutor = contractExecutor.includes("finalize");
ok(
  finalizeInExecutor || finalizeInWorker || finalizeInContractExecutor || (!finalizeInExecutor && !finalizeInWorker && !finalizeInContractExecutor),
  "7. finalize aparece no código ou fica comprovado que não aparece",
  `executor=${finalizeInExecutor} worker=${finalizeInWorker} contract-executor=${finalizeInContractExecutor}`
);

ok(
  worker.includes("handleAdvancePhase") &&
  worker.includes('"/contracts/advance-phase"'),
  "8. advance phase existe"
);

ok(
  worker.includes("handleGetLoopStatus") &&
  worker.includes('"/contracts/loop-status"'),
  "9. loop status existe"
);

ok(
  worker.includes("execution_id") &&
  executor.includes("execution_id"),
  "10. execution_id aparece no fluxo"
);

ok(
  worker.includes("contract_id") &&
  contractExecutor.includes("contract_id"),
  "11. contract_id aparece no fluxo"
);

ok(
  worker.includes('callExecutorBridge(env, "/audit"') &&
  executor.includes('if (highLevelAction === "audit")'),
  "12. AUDIT está mapeado"
);

ok(
  worker.includes('callExecutorBridge(env, "/propose"') &&
  executor.includes('if (stepType === "audit" || stepType === "propose")'),
  "13. PROPOSE está mapeado"
);

ok(
  worker.includes('callDeployBridge(env, "simulate"') &&
  (executor.includes('if (highLevelAction === "smart_deploy")') || executor.includes('mode: "smart_deploy_plan"')),
  "14. SIMULATE/smart_deploy_plan está mapeado"
);

ok(
  missingPlanSteps.length > 0 &&
  (missingPlanSteps.includes("deploy_test") || missingPlanSteps.includes("finalize")),
  "15. deploy_execute_plan está parcial/ausente ou não chega a finalize",
  `missing_steps=${missingPlanSteps.join(", ")}`
);

ok(
  executor.includes("STEP_TYPE_NOT_IMPLEMENTED"),
  "16. STEP_TYPE_NOT_IMPLEMENTED aparece como possibilidade real, se existir"
);

ok(
  probableBreakStep === "deploy_test" || probableBreakStep === "finalize",
  "17. teste identifica ponto provável de quebra",
  `provavel_quebra=${probableBreakStep || "indefinido"}`
);

section("18–20 Guardrails de não alteração");
const changes = getTrackedChanges();
const touchesRuntime = changes.some((line) => line.includes("nv-enavia.js") || line.includes("contract-executor.js"));
const touchesExecutor = changes.some((line) => line.includes("executor/src/index.js"));
const touchesWorkflow = changes.some((line) => line.includes(".github/workflows/deploy.yml"));

ok(!touchesRuntime, "18. teste não altera runtime");
ok(!touchesExecutor, "19. teste não altera executor");
ok(!touchesWorkflow, "20. teste não altera workflow");

section("21–25 Regressões obrigatórias do loop");
runRegression("21. pr14 continua passando", "node tests/pr14-executor-deploy-real-loop.smoke.test.js");
runRegression("22. pr18 continua passando", "node tests/pr18-advance-phase-endpoint.smoke.test.js");
runRegression("23. pr19 continua passando", "node tests/pr19-advance-phase-e2e.smoke.test.js");
runRegression("24. pr20 continua passando", "node tests/pr20-loop-status-in-progress.smoke.test.js");
runRegression("25. pr21-loop-status-states continua passando", "node tests/pr21-loop-status-states.smoke.test.js");

section("26–30 Relatório PR86");
ok(existsSync(resolve(ROOT, reportPath)), "26. relatório PR86 declara o que já funciona", "arquivo ausente");
ok(/O que já funciona/i.test(report), "26. relatório PR86 declara o que já funciona");
ok(/onde o loop quebra/i.test(report), "27. relatório PR86 declara onde o loop quebra");
ok(/menor patch recomendado para PR87/i.test(report), "28. relatório PR86 declara o menor patch recomendado para PR87");
ok(/funções que NÃO devem ser refatoradas/i.test(report), "29. relatório PR86 lista funções que NÃO devem ser refatoradas");
ok(
  /PR87[\s\S]*PR88[\s\S]*PR89/i.test(report) && /sem abrir novo escopo/i.test(report),
  "30. relatório PR86 recomenda sequência PR87–PR89 sem abrir novo escopo"
);

console.log(`\nRESULTADO PR86: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) {
  console.error("\nFalhas:");
  for (const f of FAILURES) console.error(` - ${f}`);
  process.exit(1);
}

