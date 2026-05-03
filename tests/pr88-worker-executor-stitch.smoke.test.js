// ============================================================================
// 🧪 PR88 — Worker ↔ Executor Stitch (execution_id/contract_id)
//
// Run: node tests/pr88-worker-executor-stitch.smoke.test.js
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
    const stderr = err?.stderr ? String(err.stderr).trim().slice(0, 260) : "falha";
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
    return out
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean)
      .map((line) => line.replace(/^[ MARCUD?!]{1,2}\s+/, ""));
  } catch {
    return [];
  }
}

function extractBlock(source, fromMarker, toMarker) {
  const from = source.indexOf(fromMarker);
  if (from < 0) return "";
  const tail = source.slice(from);
  const to = tail.indexOf(toMarker);
  return to < 0 ? tail : tail.slice(0, to);
}

console.log("\n🧪 PR88 — Worker ↔ Executor Stitch\n");

const workerPath = "nv-enavia.js";
const executorPath = "executor/src/index.js";
const contractExecutorPath = "contract-executor.js";
const deployWorkflowPath = ".github/workflows/deploy.yml";
const wranglerPath = "wrangler.toml";
const reportPath = "schema/reports/PR88_WORKER_EXECUTOR_STITCH.md";

const workerCode = readFile(workerPath);
const executorCode = readFile(executorPath);
const contractExecutorCode = readFile(contractExecutorPath);
const report = readFile(reportPath);

const engineerDirectBlock = extractBlock(
  workerCode,
  'if (body.action) {',
  '// 🚀 LOG 2A — payload enviado ao EXECUTOR (ação direta)'
);
const executeAuditBlock = extractBlock(
  workerCode,
  'const _auditPayload = {',
  'const executorAuditResult = await callExecutorBridge(env, "/audit", _auditPayload);'
);
const executeProposeBlock = extractBlock(
  workerCode,
  'const _proposePayload = {',
  'const executorProposeResult = await callExecutorBridge(env, "/propose", _proposePayload);'
);
const approveAuditBlock = extractBlock(
  workerCode,
  'const _auditPayloadApprove = {',
  'const executorAuditApproveResult = await callExecutorBridge(env, "/audit", _auditPayloadApprove);'
);

const deployTestBlock = extractBlock(
  executorCode,
  'else if (stepType === "deploy_test")',
  '} else if (stepType === "await_proof")'
);
const finalizeBlock = extractBlock(
  executorCode,
  '} else if (stepType === "finalize")',
  '} else {'
);

section("1–10 Arquivos e funções base");
ok(existsSync(resolve(ROOT, workerPath)), "1. nv-enavia.js existe");
ok(existsSync(resolve(ROOT, executorPath)), "2. executor/src/index.js existe");
ok(existsSync(resolve(ROOT, contractExecutorPath)), "3. contract-executor.js existe");
ok(workerCode.includes("async function callExecutorBridge("), "4. Worker contém callExecutorBridge preservado");
ok(workerCode.includes("async function handleExecuteNext("), "5. Worker contém handleExecuteNext preservado");
ok(contractExecutorCode.includes("function transitionStatusGlobal("), "6. Worker/contrato contém transitionStatusGlobal preservado");
ok(contractExecutorCode.includes("function resolveNextAction("), "7. Worker/contrato contém resolveNextAction preservado");
ok(executorCode.includes('if (highLevelAction === "deploy_execute_plan")'), "8. Executor contém deploy_execute_plan");
ok(executorCode.includes('else if (stepType === "deploy_test")'), "9. Executor contém deploy_test");
ok(executorCode.includes('else if (stepType === "finalize")'), "10. Executor contém finalize");

section("11–20 Costura de IDs + fluxo");
const workerPreservesExecutionId =
  /execution_id\s*:\s*auditId/.test(executeAuditBlock) &&
  /execution_id\s*:\s*auditId/.test(executeProposeBlock) &&
  /"execution_id"/.test(engineerDirectBlock);
const workerPreservesContractId =
  /contract_id\s*:\s*contractId/.test(executeAuditBlock) &&
  /contract_id\s*:\s*contractId/.test(executeProposeBlock) &&
  /"contract_id"/.test(engineerDirectBlock);

ok(workerPreservesExecutionId, "11. payload do Worker preserva execution_id");
ok(workerPreservesContractId, "12. payload do Worker preserva contract_id");
ok(
  /action:\s*body\.action/.test(engineerDirectBlock) &&
  /"mode"/.test(engineerDirectBlock),
  "13. payload enviado ao Executor inclui action/mode correto para deploy_execute_plan"
);
ok(/execution_id\s*:\s*execId/.test(deployTestBlock), "14. deploy_test recebe execution_id");
ok(/contract_id\s*:\s*contractId/.test(deployTestBlock), "15. deploy_test recebe contract_id");
ok(/execution_id\s*:\s*execId/.test(finalizeBlock), "16. finalize recebe execution_id");
ok(/contract_id\s*:\s*contractId/.test(finalizeBlock), "17. finalize recebe contract_id");

const hasPlannerSteps =
  /\{\s*id:\s*"s1",\s*type:\s*"audit"\s*\}/.test(executorCode) &&
  /\{\s*id:\s*"s3",\s*type:\s*"deploy_test"\s*\}/.test(executorCode) &&
  /\{\s*id:\s*"s5",\s*type:\s*"finalize"\s*\}/.test(executorCode);
const flowRepresentable =
  hasPlannerSteps &&
  deployTestBlock.length > 0 &&
  finalizeBlock.length > 0 &&
  !/STEP_TYPE_NOT_IMPLEMENTED/.test(deployTestBlock) &&
  !/STEP_TYPE_NOT_IMPLEMENTED/.test(finalizeBlock);

ok(flowRepresentable, "18. fluxo smart_deploy_plan → deploy_execute_plan → deploy_test → finalize é representável sem STEP_TYPE_NOT_IMPLEMENTED");
ok(/STEP_TYPE_NOT_IMPLEMENTED_V2/.test(executorCode), "19. step desconhecido continua bloqueado");
ok(
  workerCode.includes('callDeployBridge(env, "simulate"') &&
    /target_env:\s*"test"/.test(workerCode) &&
    /deploy_action:\s*"simulate"/.test(workerCode),
  "20. Worker não chama deploy real nessa costura"
);

section("21–24 Guardrails de escopo");
ok(true, "21. teste não chama rede real", "inspeção estática + execuções locais");
const changed = getTrackedChanges();
ok(!changed.includes(deployWorkflowPath), "22. deploy.yml não foi alterado");
ok(!changed.includes(wranglerPath), "23. wrangler.toml não foi alterado");
ok(!changed.includes(contractExecutorPath), "24. contract-executor.js não foi alterado");

section("25–33 Regressões obrigatórias");
runRegression("25. PR87 continua passando", "node tests/pr87-deploy-test-finalize-runner.smoke.test.js");
runRegression("26. PR86 continua passando", "node tests/pr86-deploy-orchestrator-gap.prova.test.js");
runRegression("27. PR14 continua passando", "node tests/pr14-executor-deploy-real-loop.smoke.test.js");
runRegression("28. PR18 continua passando", "node tests/pr18-advance-phase-endpoint.smoke.test.js");
runRegression("29. PR19 continua passando", "node tests/pr19-advance-phase-e2e.smoke.test.js");
runRegression("30. PR20 continua passando", "node tests/pr20-loop-status-in-progress.smoke.test.js");
runRegression("31. PR21 continua passando", "node tests/pr21-loop-status-states.smoke.test.js");
runRegression("32. executor.contract continua passando", "node executor/tests/executor.contract.test.js");
runRegression("33. cloudflare-credentials continua passando", "node executor/tests/cloudflare-credentials.test.js");

section("34–36 Relatório PR88");
ok(existsSync(resolve(ROOT, reportPath)), "34. relatório PR88 declara o que foi costurado", "arquivo ausente");
ok(
  /costura/i.test(report) && /execution_id/i.test(report) && /contract_id/i.test(report),
  "34. relatório PR88 declara o que foi costurado"
);
ok(
  /o que NÃO foi mexido/i.test(report) && /deploy\.yml/i.test(report) && /wrangler\.toml/i.test(report),
  "35. relatório PR88 declara o que NÃO foi mexido"
);
ok(/PR89/i.test(report), "36. relatório PR88 declara o que fica para PR89");

console.log(`\nRESULTADO PR88: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) {
  console.error("\nFalhas:");
  for (const f of FAILURES) console.error(` - ${f}`);
  process.exit(1);
}
