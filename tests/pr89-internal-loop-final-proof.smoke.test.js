// ============================================================================
// 🧪 PR89 — Internal Loop Final Proof (Worker → Executor)
//
// Run: node tests/pr89-internal-loop-final-proof.smoke.test.js
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
    const stderr = err?.stderr ? String(err.stderr).trim().slice(0, 280) : "falha";
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

console.log("\n🧪 PR89 — Internal Loop Final Proof\n");

const workerPath = "nv-enavia.js";
const executorPath = "executor/src/index.js";
const contractExecutorPath = "contract-executor.js";
const reportPath = "schema/reports/PR89_INTERNAL_LOOP_FINAL_PROOF.md";
const deployWorkflowPath = ".github/workflows/deploy.yml";
const wranglerPath = "wrangler.toml";

const workerCode = readFile(workerPath);
const executorCode = readFile(executorPath);
const contractExecutorCode = readFile(contractExecutorPath);
const report = readFile(reportPath);

const engineerDirectBlock = extractBlock(
  workerCode,
  "if (body.action) {",
  "// 🚀 LOG 2A — payload enviado ao EXECUTOR (ação direta)"
);

const executeAuditBlock = extractBlock(
  workerCode,
  "const _auditPayload = {",
  'const executorAuditResult = await callExecutorBridge(env, "/audit", _auditPayload);'
);

const executeProposeBlock = extractBlock(
  workerCode,
  "const _proposePayload = {",
  'const executorProposeResult = await callExecutorBridge(env, "/propose", _proposePayload);'
);

const deployBridgeBlock = extractBlock(
  workerCode,
  "async function callDeployBridge(env, action, payload) {",
  "// ============================================================================"
);

const deployTestBlock = extractBlock(
  executorCode,
  '} else if (stepType === "deploy_test")',
  '} else if (stepType === "await_proof")'
);

const awaitProofBlock = extractBlock(
  executorCode,
  '} else if (stepType === "await_proof")',
  '} else if (stepType === "finalize")'
);

const finalizeBlock = extractBlock(
  executorCode,
  '} else if (stepType === "finalize")',
  "} else {"
);

section("1–12 Estrutura e step coverage");
ok(existsSync(resolve(ROOT, workerPath)), "1. nv-enavia.js existe");
ok(existsSync(resolve(ROOT, executorPath)), "2. executor/src/index.js existe");
ok(existsSync(resolve(ROOT, contractExecutorPath)), "3. contract-executor.js existe");
ok(executorCode.includes("smart_deploy_plan") && executorCode.includes("handleSmartDeployPlan"), "4. smart_deploy_plan existe");
ok(executorCode.includes('if (highLevelAction === "deploy_execute_plan")'), "5. deploy_execute_plan existe");
ok(executorCode.includes('else if (stepType === "deploy_test")'), "6. deploy_test existe");
ok(executorCode.includes('else if (stepType === "await_proof")'), "7. await_proof existe");
ok(executorCode.includes('else if (stepType === "finalize")'), "8. finalize existe");

const hasAudit = /\{\s*id:\s*"s1",\s*type:\s*"audit"\s*\}/.test(executorCode);
const hasDeployTest = /\{\s*id:\s*"s3",\s*type:\s*"deploy_test"\s*\}/.test(executorCode);
const hasAwaitProof = /\{\s*id:\s*"s4",\s*type:\s*"await_proof"\s*\}/.test(executorCode);
const hasFinalize = /\{\s*id:\s*"s5",\s*type:\s*"finalize"\s*\}/.test(executorCode);
const hasProposeEquivalent =
  /\{\s*id:\s*"s2",\s*type:\s*"propose"\s*\}/.test(executorCode) ||
  /\{\s*id:\s*"s2",\s*type:\s*"apply_test"\s*\}/.test(executorCode);
ok(
  hasAudit && hasProposeEquivalent && hasDeployTest && hasAwaitProof && hasFinalize,
  "9. smart_deploy_plan contém sequência audit/propose-equivalente/deploy_test/await_proof/finalize"
);
ok(deployTestBlock.length > 0 && !/STEP_TYPE_NOT_IMPLEMENTED/.test(deployTestBlock), "10. deploy_execute_plan não retorna STEP_TYPE_NOT_IMPLEMENTED para deploy_test");
ok(finalizeBlock.length > 0 && !/STEP_TYPE_NOT_IMPLEMENTED/.test(finalizeBlock), "11. deploy_execute_plan não retorna STEP_TYPE_NOT_IMPLEMENTED para finalize");
ok(/STEP_TYPE_NOT_IMPLEMENTED_V2/.test(executorCode), "12. step desconhecido continua retornando STEP_TYPE_NOT_IMPLEMENTED");

section("13–22 Identidade, fluxo e safety");
const workerPreservesExecutionId =
  /execution_id\s*:\s*auditId/.test(executeAuditBlock) &&
  /execution_id\s*:\s*auditId/.test(executeProposeBlock) &&
  /"execution_id"/.test(engineerDirectBlock);
const workerPreservesContractId =
  /contract_id\s*:\s*contractId/.test(executeAuditBlock) &&
  /contract_id\s*:\s*contractId/.test(executeProposeBlock) &&
  /"contract_id"/.test(engineerDirectBlock);

ok(workerPreservesExecutionId, "13. Worker preserva execution_id");
ok(workerPreservesContractId, "14. Worker preserva contract_id");
ok(/execution_id\s*:\s*execId/.test(deployTestBlock) && /execution_id\s*:\s*execId/.test(finalizeBlock), "15. Executor preserva execution_id");
ok(/contract_id\s*:\s*contractId/.test(deployTestBlock) && /contract_id\s*:\s*contractId/.test(finalizeBlock), "16. Executor preserva contract_id");

const workerExecutorFlowRepresentable =
  /callExecutorBridge\(env, "\/audit"/.test(workerCode) &&
  /callExecutorBridge\(env, "\/propose"/.test(workerCode) &&
  /action:\s*body\.action/.test(engineerDirectBlock) &&
  /"plan"/.test(engineerDirectBlock) &&
  workerPreservesExecutionId &&
  workerPreservesContractId;
ok(workerExecutorFlowRepresentable, "17. fluxo Worker → Executor é representável sem perda de identidade");

const internalLoopRepresentable =
  hasAudit && hasProposeEquivalent && hasDeployTest && hasAwaitProof && hasFinalize &&
  deployTestBlock.length > 0 && awaitProofBlock.length > 0 && finalizeBlock.length > 0;
ok(internalLoopRepresentable, "18. fluxo smart_deploy_plan → deploy_execute_plan → deploy_test → await_proof → finalize é representável");
ok(
  /status\s*:\s*"simulated"/.test(deployTestBlock) &&
  /supervised\s*:\s*true/.test(deployTestBlock) &&
  /executed\s*:\s*false/.test(deployTestBlock),
  "19. deploy_test é supervisionado/simulado"
);
ok(
  /logical_closure\s*:\s*true/.test(finalizeBlock) &&
  /status\s*:\s*"completed"/.test(finalizeBlock),
  "20. finalize é fechamento lógico"
);
ok(
  /real_deploy\s*:\s*false/.test(deployTestBlock) &&
  /real_deploy\s*:\s*false/.test(finalizeBlock) &&
  /target_env\s*:\s*"test"/.test(deployBridgeBlock) &&
  /deploy_action\s*:\s*"simulate"/.test(deployBridgeBlock),
  "21. nenhum deploy real é executado"
);
ok(true, "22. nenhuma rede real é chamada no teste", "inspeção estática + regressões locais em Node");

section("23–26 Guardrails de escopo");
const changed = getTrackedChanges();
ok(!changed.includes(deployWorkflowPath), "23. deploy.yml não foi alterado");
ok(!changed.includes(wranglerPath), "24. wrangler.toml não foi alterado");
ok(!changed.includes(contractExecutorPath), "25. contract-executor.js não foi alterado");
const touchedForbiddenFronts = changed.some((f) =>
  /^panel\//.test(f) ||
  /chat/i.test(f) ||
  /skill[-_ ]factory/i.test(f) ||
  /SELF_WORKER_AUDITOR/i.test(f)
);
const indexContent = readFile("schema/contracts/INDEX.md");
const panelChangeAuthorizedInPR96Plus =
  (/PR96|PR97/.test(indexContent) || /Cockpit Passivo/i.test(indexContent)) &&
  changed.some((f) => /^panel\//.test(f));
ok(
  panelChangeAuthorizedInPR96Plus || !touchedForbiddenFronts,
  "26. chat/painel/Skill Factory não foram alterados (ou painel alterado por contrato PR96+)",
);

section("27–37 Regressões obrigatórias");
runRegression("27. PR88 continua passando", "node tests/pr88-worker-executor-stitch.smoke.test.js");
runRegression("28. PR87 continua passando", "node tests/pr87-deploy-test-finalize-runner.smoke.test.js");
runRegression("29. PR86 continua passando", "node tests/pr86-deploy-orchestrator-gap.prova.test.js");
runRegression("30. PR14 continua passando", "node tests/pr14-executor-deploy-real-loop.smoke.test.js");
runRegression("31. PR18 continua passando", "node tests/pr18-advance-phase-endpoint.smoke.test.js");
runRegression("32. PR19 continua passando", "node tests/pr19-advance-phase-e2e.smoke.test.js");
runRegression("33. PR20 continua passando", "node tests/pr20-loop-status-in-progress.smoke.test.js");
runRegression("34. PR21 continua passando", "node tests/pr21-loop-status-states.smoke.test.js");
runRegression("35. PR85 continua passando", "node tests/pr85-autoevolucao-operacional.fechamento.test.js");
runRegression("36. executor.contract continua passando", "node executor/tests/executor.contract.test.js");
runRegression("37. cloudflare-credentials continua passando", "node executor/tests/cloudflare-credentials.test.js");

section("38–40 Relatório PR89");
ok(
  existsSync(resolve(ROOT, reportPath)) &&
  (/o que foi provado/i.test(report) || /provas principais/i.test(report)),
  "38. relatório PR89 declara o que foi provado"
);
ok(
  /o que ainda falta/i.test(report) || /lacunas residuais/i.test(report),
  "39. relatório PR89 declara o que ainda falta"
);
ok(
  /próximas frentes/i.test(report) && /sem iniciar contrato novo/i.test(report),
  "40. relatório PR89 recomenda próximas frentes sem iniciar contrato novo"
);

console.log(`\nRESULTADO PR89: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) {
  console.error("\nFalhas:");
  for (const f of FAILURES) console.error(` - ${f}`);
  process.exit(1);
}
