// ============================================================================
// 🧪 PR87 — Deploy Test + Finalize Runner Smoke
//
// Run: node tests/pr87-deploy-test-finalize-runner.smoke.test.js
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

function extractBlock(source, fromMarker, toMarker) {
  const from = source.indexOf(fromMarker);
  if (from < 0) return "";
  const tail = source.slice(from);
  const to = tail.indexOf(toMarker);
  return to < 0 ? tail : tail.slice(0, to);
}

console.log("\n🧪 PR87 — Deploy Test + Finalize Runner Smoke\n");

const executorPath = "executor/src/index.js";
const reportPath = "schema/reports/PR87_DEPLOY_TEST_FINALIZE_RUNNER.md";
const executorCode = readFile(executorPath);

section("1–20 Runner deploy_test/finalize");
ok(existsSync(resolve(ROOT, executorPath)), "1. executor/src/index.js existe");
ok(executorCode.includes('if (stepType === "audit" || stepType === "propose")'), "2. runner possui tratamento audit/propose preservado");
ok(executorCode.includes('else if (stepType === "apply_test")'), "3. runner possui tratamento apply_test preservado");
ok(executorCode.includes('else if (stepType === "await_proof")'), "4. runner possui tratamento await_proof preservado");
ok(executorCode.includes('else if (stepType === "deploy_test")'), "5. runner agora possui tratamento deploy_test");
ok(executorCode.includes('else if (stepType === "finalize")'), "6. runner agora possui tratamento finalize");

const deployBlock = extractBlock(
  executorCode,
  'else if (stepType === "deploy_test")',
  '} else if (stepType === "await_proof")'
);
const finalizeBlock = extractBlock(
  executorCode,
  'else if (stepType === "finalize")',
  '} else {'
);

ok(deployBlock.length > 0 && !/STEP_TYPE_NOT_IMPLEMENTED/.test(deployBlock), "7. deploy_test não cai em STEP_TYPE_NOT_IMPLEMENTED");
ok(finalizeBlock.length > 0 && !/STEP_TYPE_NOT_IMPLEMENTED/.test(finalizeBlock), "8. finalize não cai em STEP_TYPE_NOT_IMPLEMENTED");
ok(/execution_id\s*:\s*execId/.test(deployBlock), "9. deploy_test preserva execution_id");
ok(/contract_id\s*:\s*contractId/.test(deployBlock), "10. deploy_test preserva contract_id");
ok(/execution_id\s*:\s*execId/.test(finalizeBlock), "11. finalize preserva execution_id");
ok(/contract_id\s*:\s*contractId/.test(finalizeBlock), "12. finalize preserva contract_id");
ok(/status\s*:\s*"[^"]+"/.test(deployBlock), "13. deploy_test retorna status estruturado");
ok(/status\s*:\s*"[^"]+"/.test(finalizeBlock), "14. finalize retorna status estruturado");
ok(/real_deploy\s*:\s*false/.test(deployBlock), "15. deploy_test não executa deploy real");
ok(/real_deploy\s*:\s*false/.test(finalizeBlock), "16. finalize não executa deploy real");
ok(/network_called\s*:\s*false/.test(deployBlock), "17. deploy_test não chama rede real");
ok(/network_called\s*:\s*false/.test(finalizeBlock), "18. finalize não chama rede real");
ok(/STEP_TYPE_NOT_IMPLEMENTED_V2/.test(executorCode), "19. step desconhecido ainda retorna STEP_TYPE_NOT_IMPLEMENTED");

const hasPlannerSteps =
  /\{\s*id:\s*"s3",\s*type:\s*"deploy_test"\s*\}/.test(executorCode) &&
  /\{\s*id:\s*"s5",\s*type:\s*"finalize"\s*\}/.test(executorCode);
const hasRunnerHandlers = deployBlock.length > 0 && finalizeBlock.length > 0;
ok(hasPlannerSteps && hasRunnerHandlers, "20. smart_deploy_plan + deploy_execute_plan chega até finalize sem STEP_TYPE_NOT_IMPLEMENTED");

section("21–28 Regressões obrigatórias");
runRegression("21. PR86 continua passando", "node tests/pr86-deploy-orchestrator-gap.prova.test.js");
runRegression("22. PR14 continua passando", "node tests/pr14-executor-deploy-real-loop.smoke.test.js");
runRegression("23. PR18 continua passando", "node tests/pr18-advance-phase-endpoint.smoke.test.js");
runRegression("24. PR19 continua passando", "node tests/pr19-advance-phase-e2e.smoke.test.js");
runRegression("25. PR20 continua passando", "node tests/pr20-loop-status-in-progress.smoke.test.js");
runRegression("26. PR21 continua passando", "node tests/pr21-loop-status-states.smoke.test.js");
runRegression("27. executor.contract continua passando", "node executor/tests/executor.contract.test.js");
runRegression("28. cloudflare-credentials continua passando", "node executor/tests/cloudflare-credentials.test.js");

section("29–30 Relatório PR87");
const report = readFile(reportPath);
ok(existsSync(resolve(ROOT, reportPath)), "29. relatório PR87 existe");
ok(/o que foi corrigido/i.test(report) && /deploy_test/i.test(report) && /finalize/i.test(report), "29. relatório PR87 declara exatamente o que foi corrigido");
ok(/o que NÃO foi mexido/i.test(report) && /nv-enavia\.js/i.test(report) && /contract-executor\.js/i.test(report), "30. relatório PR87 declara o que NÃO foi mexido");

console.log(`\nRESULTADO PR87: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) {
  console.error("\nFalhas:");
  for (const f of FAILURES) console.error(` - ${f}`);
  process.exit(1);
}
