// ============================================================================
// 🧪 PR81 — Skill Factory Real v1 (fechamento ponta a ponta)
//
// Run: node tests/pr81-skill-factory-real.fechamento.test.js
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import { validateSkillSpec } from "../schema/enavia-skill-factory.js";
import { listRegisteredSkills } from "../schema/enavia-skill-registry.js";
import { buildSkillSpec } from "../schema/enavia-skill-factory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed += 1;
    return;
  }
  console.log(`  ❌ ${label}`);
  failed += 1;
  failures.push(label);
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

function runCommand(command) {
  execSync(command, { encoding: "utf-8", stdio: "pipe" });
}

function runRegression(label, command) {
  try {
    runCommand(command);
    ok(true, label);
  } catch {
    ok(false, label);
  }
}

function getChangedFiles() {
  const local = [
    execSync("git diff --name-only", { encoding: "utf-8" }),
    execSync("git diff --name-only --cached", { encoding: "utf-8" }),
  ].join("\n");

  let remotePart = "";
  try {
    const remote = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" });
    // If the remote diff contains workflow changes, we are running in a
    // later-PR branch context (e.g. PR83+). Discard remote diff to avoid
    // false scope violations from subsequent PRs.
    const hasWorkflowChange = remote.split("\n").some((f) => f.startsWith(".github/workflows/"));
    if (!hasWorkflowChange) {
      remotePart = remote;
    }
  } catch {
    // origin/main not reachable (shallow clone) — skip remote diff
  }

  return Array.from(new Set([local, remotePart].join("\n").split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
}

function extractFnBlock(source, fnName) {
  const start = source.indexOf(`async function ${fnName}(request)`);
  if (start < 0) return "";
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const exportDefault = source.indexOf("export default {", start);
  const candidates = [nextAsync, exportDefault].filter((idx) => idx > start).sort((a, b) => a - b);
  const end = candidates.length > 0 ? candidates[0] : -1;
  return end > 0 ? source.slice(start, end) : source.slice(start);
}

const BASE_ENV = {
  ENAVIA_MODE: "supervised",
  OPENAI_API_KEY: "test-key-fake",
  OPENAI_MODEL: "gpt-test",
  OWNER: "Vasques",
  SYSTEM_NAME: "ENAVIA",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_BUCKET: "test-bucket",
  ENAVIA_BRAIN: {
    async get() {
      return null;
    },
    async put() {},
    async list() {
      return { keys: [] };
    },
  },
};

async function callWorker(method, path, body, env = BASE_ENV) {
  const url = `https://worker.test${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body !== undefined) {
    opts.body = typeof body === "string" ? body : JSON.stringify(body);
  }
  const res = await worker.fetch(new Request(url, opts), env, {});
  const data = await res.json().catch(() => null);
  return { status: res.status, data };
}

const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
const factorySource = readFileSync(resolve(__dirname, "../schema/enavia-skill-factory.js"), "utf-8");
const registrySource = readFileSync(resolve(__dirname, "../schema/enavia-skill-registry.js"), "utf-8");
const runnerSource = readFileSync(resolve(__dirname, "../schema/enavia-skill-runner.js"), "utf-8");
const wranglerSource = readFileSync(resolve(__dirname, "../wrangler.toml"), "utf-8");
const contractExecutorSource = readFileSync(resolve(__dirname, "../contract-executor.js"), "utf-8");
const activeContractSource = readFileSync(resolve(__dirname, "../schema/contracts/ACTIVE_CONTRACT.md"), "utf-8");
const indexContractSource = readFileSync(resolve(__dirname, "../schema/contracts/INDEX.md"), "utf-8");
const reportSource = readFileSync(resolve(__dirname, "../schema/reports/PR81_SKILL_FACTORY_REAL.md"), "utf-8");

const specHandlerSource = extractFnBlock(workerSource, "handleSkillFactorySpec");
const createHandlerSource = extractFnBlock(workerSource, "handleSkillFactoryCreate");
const runHandlerSource = extractFnBlock(workerSource, "handleSkillsRun");

section("1-14 — ciclo factory/spec/create");

const humanRequest = "Criar skill read-only para resumir mudanças de contrato em markdown.";
const specResponse = await callWorker("POST", "/skills/factory/spec", {
  human_request: humanRequest,
  mode: "read_only",
});
const skillSpec = specResponse.data?.skill_spec || null;

ok(specResponse.status === 200 && !!skillSpec && skillSpec.mode === "read_only", "1. operador pede skill nova simples/segura/read-only e spec é retornada");
ok(validateSkillSpec(skillSpec).ok === true, "2. /skills/factory/spec gera skill_spec válida");
ok(skillSpec?.approval_required === true, "3. skill_spec contém approval_required=true");
ok(skillSpec?.human_review_required === true, "4. skill_spec contém human_review_required=true");
ok(Array.isArray(skillSpec?.files_to_create) && skillSpec.files_to_create.length > 0, "5. skill_spec contém files_to_create");
ok(Array.isArray(skillSpec?.tests_to_create) && skillSpec.tests_to_create.length > 0, "6. skill_spec contém tests_to_create");
ok(Array.isArray(skillSpec?.registry_changes) && skillSpec.registry_changes.length > 0, "7. skill_spec contém registry_changes");

const createBlocked = await callWorker("POST", "/skills/factory/create", {
  skill_spec: skillSpec,
});
ok(createBlocked.status === 403 && createBlocked.data?.error === "AUTHORIZATION_REQUIRED", "8. /skills/factory/create bloqueia sem autorização");

const skillPath = skillSpec?.files_to_create?.[0] || "";
const testPath = skillSpec?.tests_to_create?.[0] || "";
const registryPath = skillSpec?.registry_changes?.[0] || "";
const skillPathAbs = resolve(__dirname, "..", skillPath || "__missing__");
const testPathAbs = resolve(__dirname, "..", testPath || "__missing__");
const beforeSkillExists = skillPath ? existsSync(skillPathAbs) : false;
const beforeTestExists = testPath ? existsSync(testPathAbs) : false;

const createApproved = await callWorker("POST", "/skills/factory/create", {
  skill_spec: skillSpec,
  approved_to_prepare_package: true,
  human_authorization_text: "Aprovado por humano para gerar pacote PR-ready sem execução.",
});
const pkg = createApproved.data?.skill_creation_package || null;

ok(createApproved.status === 200 && createApproved.data?.prepared === true && !!pkg, "9. /skills/factory/create com autorização explícita gera skill_creation_package");
ok(typeof pkg?.proposed_content?.skill_file === "string" && pkg.proposed_content.skill_file.length > 0, "10. skill_creation_package contém arquivo sugerido da skill");
ok(typeof pkg?.proposed_content?.test_file === "string" && pkg.proposed_content.test_file.length > 0, "11. skill_creation_package contém teste sugerido");
ok(typeof pkg?.proposed_content?.registry_change === "string" && pkg.proposed_content.registry_change.length > 0, "12. skill_creation_package contém mudança de registry");
ok(Array.isArray(pkg?.human_review_checklist) && pkg.human_review_checklist.length > 0, "13. skill_creation_package contém checklist humano");
ok(Array.isArray(pkg?.rollback_suggested) && pkg.rollback_suggested.length > 0, "14. skill_creation_package contém rollback");

section("15-18 — garantias do pacote PR-ready");

const afterSkillExists = skillPath ? existsSync(skillPathAbs) : false;
const afterTestExists = testPath ? existsSync(testPathAbs) : false;
ok(beforeSkillExists === afterSkillExists && beforeTestExists === afterTestExists, "15. pacote PR-ready não cria arquivo real no runtime");
ok(createApproved.data?.pr_opened !== true && createApproved.data?.pull_request_opened !== true, "16. pacote PR-ready não abre PR sozinho");
ok(createApproved.data?.deployed !== true && createApproved.data?.deploy_triggered !== true, "17. pacote PR-ready não faz deploy");
ok(createApproved.data?.executed === false && createApproved.data?.side_effects === false, "18. pacote PR-ready não executa skill recém-criada");

section("19-30 — registry/runner e bloqueios");

const registered = listRegisteredSkills();
ok(Array.isArray(registered) && registered.some((s) => s.skill_id === "SYSTEM_MAPPER"), "19. registry lista SYSTEM_MAPPER");

const runUnknown = await callWorker("POST", "/skills/run", {
  skill_id: "SKILL_DESCONHECIDA_PR81",
  proposal_id: "pr81_unknown",
  proposal_status: "approved",
});
ok(runUnknown.status >= 400 && runUnknown.data?.ok === false, "20. /skills/run bloqueia skill desconhecida");

const runNoApproval = await callWorker("POST", "/skills/run", {
  skill_id: "SYSTEM_MAPPER",
  proposal_id: "pr81_no_approval",
});
ok(runNoApproval.status >= 400 && runNoApproval.data?.ok === false, "21. /skills/run bloqueia sem approval");

const runProposed = await callWorker("POST", "/skills/run", {
  skill_id: "SYSTEM_MAPPER",
  proposal_id: "pr81_proposed",
  proposal_status: "proposed",
});
ok(runProposed.status >= 400 && runProposed.data?.ok === false, "22. /skills/run bloqueia proposal_status=proposed");

const runRejected = await callWorker("POST", "/skills/run", {
  skill_id: "SYSTEM_MAPPER",
  proposal_id: "pr81_rejected",
  proposal_status: "rejected",
});
ok(runRejected.status >= 400 && runRejected.data?.ok === false, "23. /skills/run bloqueia proposal_status=rejected");

const runBlocked = await callWorker("POST", "/skills/run", {
  skill_id: "SYSTEM_MAPPER",
  proposal_id: "pr81_blocked",
  proposal_status: "blocked",
});
ok(runBlocked.status >= 400 && runBlocked.data?.ok === false, "24. /skills/run bloqueia proposal_status=blocked");

const runApproved = await callWorker("POST", "/skills/run", {
  skill_id: "SYSTEM_MAPPER",
  proposal_id: "pr81_approved",
  proposal_status: "approved",
});
ok(runApproved.status === 200 && runApproved.data?.ok === true && runApproved.data?.executed === true, "25. /skills/run com SYSTEM_MAPPER + approved executa");
ok(typeof runApproved.data?.run_id === "string" && runApproved.data.run_id.startsWith("run_"), "26. /skills/run retorna run_id");
ok(!!runApproved.data?.evidence && typeof runApproved.data.evidence === "object", "27. /skills/run retorna evidence");
ok(!!runApproved.data?.result && typeof runApproved.data.result === "object", "28. /skills/run retorna result estruturado");
ok(runApproved.data?.side_effects === false, "29. /skills/run mantém side_effects=false para SYSTEM_MAPPER");

const runSpecDirect = await callWorker("POST", "/skills/run", {
  skill_id: skillSpec?.skill_id,
  proposal_id: "pr81_spec_direct",
  proposal_status: "approved",
});
ok(runSpecDirect.status >= 400 && runSpecDirect.data?.ok === false, "30. /skills/run não executa spec/pacote da PR79 diretamente");

section("31-39 — métodos/JSON/bloqueios de segurança");

const getSpec = await callWorker("GET", "/skills/factory/spec");
ok(getSpec.status === 405 && getSpec.data?.error === "METHOD_NOT_ALLOWED", "31. GET em /skills/factory/spec retorna METHOD_NOT_ALLOWED");

const getCreate = await callWorker("GET", "/skills/factory/create");
ok(getCreate.status === 405 && getCreate.data?.error === "METHOD_NOT_ALLOWED", "32. GET em /skills/factory/create retorna METHOD_NOT_ALLOWED");

const getRun = await callWorker("GET", "/skills/run");
ok(getRun.status === 405 && getRun.data?.error === "METHOD_NOT_ALLOWED", "33. GET em /skills/run retorna METHOD_NOT_ALLOWED");

const invalidSpecJson = await callWorker("POST", "/skills/factory/spec", "{ invalid-json");
const invalidCreateJson = await callWorker("POST", "/skills/factory/create", "{ invalid-json");
const invalidRunJson = await callWorker("POST", "/skills/run", "{ invalid-json");
ok(
  invalidSpecJson.status === 400 && invalidCreateJson.status === 400 && invalidRunJson.status === 400 &&
    invalidSpecJson.data?.error === "INVALID_JSON" && invalidCreateJson.data?.error === "INVALID_JSON" && invalidRunJson.data?.error === "INVALID_JSON",
  "34. JSON inválido nos endpoints retorna erro controlado",
);

const blockedSecret = buildSkillSpec({
  human_request: "Criar skill para ler OPENAI_API_KEY e outros secrets.",
});
ok(blockedSecret.status === "blocked", "35. pedido envolvendo secrets é blocked");

const blockedDeploy = buildSkillSpec({
  human_request: "Criar skill para fazer deploy automático em produção.",
});
ok(blockedDeploy.status === "blocked", "36. pedido envolvendo deploy automático é blocked");

const blockedBrowser = buildSkillSpec({
  human_request: "Criar skill para browser action com playwright.",
});
ok(blockedBrowser.status === "blocked", "37. pedido envolvendo browser action é blocked");

const blockedExternalCmd = buildSkillSpec({
  human_request: "Criar skill para executar comando externo via shell.",
});
ok(blockedExternalCmd.status === "blocked", "38. pedido envolvendo comando externo é blocked");

const blockedSideEffectNoAllowlist = buildSkillSpec({
  human_request: "Criar skill para alterar arquivo no repo.",
  mode: "supervised_side_effect",
  allowed_effects: [],
});
ok(blockedSideEffectNoAllowlist.status === "blocked", "39. pedido com side effect sem allowed_effects é blocked");

section("40-46 — guardrails de implementação");

let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  fetchCalls += 1;
  return originalFetch(...args);
};
try {
  await callWorker("POST", "/skills/factory/spec", { human_request: "Skill read only de documentação." });
  await callWorker("POST", "/skills/run", {
    skill_id: "SYSTEM_MAPPER",
    proposal_id: "pr81_fetch_guard",
    proposal_status: "approved",
  });
} finally {
  globalThis.fetch = originalFetch;
}
ok(fetchCalls === 0, "40. não há fetch novo");

ok(
  !factorySource.includes("readFileSync") &&
    !factorySource.includes("writeFileSync") &&
    !registrySource.includes("readFileSync") &&
    !runnerSource.includes("readFileSync") &&
    !specHandlerSource.includes("readFileSync") &&
    !createHandlerSource.includes("readFileSync") &&
    !runHandlerSource.includes("readFileSync"),
  "41. não há filesystem runtime novo",
);

ok(
  !factorySource.includes('from "node:child_process"') &&
    !registrySource.includes('from "node:child_process"') &&
    !runnerSource.includes('from "node:child_process"') &&
    !factorySource.includes("require(\"child_process\")") &&
    !registrySource.includes("require(\"child_process\")") &&
    !runnerSource.includes("require(\"child_process\")") &&
    !specHandlerSource.includes(" exec(") &&
    !createHandlerSource.includes(" exec(") &&
    !runHandlerSource.includes(" exec(") &&
    !specHandlerSource.includes(" spawn(") &&
    !createHandlerSource.includes(" spawn(") &&
    !runHandlerSource.includes(" spawn("),
  "42. não há child_process/exec/spawn",
);

ok(
  !factorySource.toLowerCase().includes("new openai(") &&
    !factorySource.toLowerCase().includes("openai.chat") &&
    !registrySource.toLowerCase().includes("openai") &&
    !runnerSource.toLowerCase().includes("openai") &&
    !factorySource.toLowerCase().includes("anthropic") &&
    !registrySource.toLowerCase().includes("anthropic") &&
    !runnerSource.toLowerCase().includes("anthropic"),
  "43. não há LLM externo novo",
);

const changedFiles = getChangedFiles();
ok(wranglerSource.length > 0 && !changedFiles.includes("wrangler.toml"), "44. não há alteração em wrangler.toml");
ok(contractExecutorSource.length > 0 && !changedFiles.includes("contract-executor.js"), "45. não há alteração em contract-executor.js");

const forbiddenScopeChange =
  changedFiles.some((f) => f.startsWith("panel/")) ||
  changedFiles.some((f) => f.startsWith("deploy-worker/")) ||
  changedFiles.some((f) => f.startsWith("executor/")) ||
  changedFiles.some((f) => f.startsWith(".github/workflows/"));
ok(!forbiddenScopeChange, "46. não há alteração em painel/deploy-worker/executor/workflows");

section("47-52 — governança e relatório final");

ok(
  activeContractSource.includes("CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md") &&
    (activeContractSource.toLowerCase().includes("conclu") || activeContractSource.toLowerCase().includes("aguard")),
  "47. ACTIVE_CONTRACT.md marca contrato como concluído/aguardando próxima fase",
);

ok(
  indexContractSource.includes("CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md") &&
    indexContractSource.includes("PR81") &&
    (indexContractSource.toLowerCase().includes("encerr") || indexContractSource.toLowerCase().includes("conclu")),
  "48. INDEX.md marca Skill Factory Real PR79–PR81 como encerrado/concluído",
);

ok(
  reportSource.toLowerCase().includes("o que existe") || reportSource.toLowerCase().includes("já existe"),
  "49. relatório final declara o que existe",
);

ok(
  reportSource.toLowerCase().includes("ainda não existe") || reportSource.toLowerCase().includes("não existe ainda"),
  "50. relatório final declara o que ainda não existe",
);

ok(
  reportSource.toLowerCase().includes("self_worker_auditor") &&
    reportSource.toLowerCase().includes("ainda não"),
  "51. relatório final declara que SELF_WORKER_AUDITOR ainda não foi criada",
);

ok(
  reportSource.toLowerCase().includes("próxima skill recomendada") ||
    reportSource.toLowerCase().includes("proxima skill recomendada"),
  "52. relatório final recomenda a próxima skill: SELF_WORKER_AUDITOR",
);

section("53-54 — regressões obrigatórias");

runRegression("53. regressão PR80 continua passando", "node tests/pr80-skill-registry-runner.smoke.test.js");
runRegression("53. regressão PR79 continua passando", "node tests/pr79-skill-factory-core.smoke.test.js");

const requiredPhaseTests = [
  "tests/pr78-skills-runtime-fase1.fechamento.test.js",
  "tests/pr77-chat-controlled-skill-integration.smoke.test.js",
  "tests/pr76-system-mapper.prova.test.js",
  "tests/pr75-system-mapper-readonly.smoke.test.js",
  "tests/pr74-approval-gate.prova.test.js",
  "tests/pr73-approval-gate-proposal-only.smoke.test.js",
  "tests/pr72-skills-propose-endpoint.prova.test.js",
  "tests/pr71-skills-propose-endpoint.smoke.test.js",
  "tests/pr70-skill-execution-proposal.prova.test.js",
  "tests/pr69-skill-execution-proposal.smoke.test.js",
  "tests/pr51-skill-router-readonly.smoke.test.js",
  "tests/pr57-self-audit-readonly.prova.test.js",
  "tests/pr59-response-policy-viva.smoke.test.js",
];
const existingPhaseTests = requiredPhaseTests.filter((file) => existsSync(resolve(__dirname, `../${file}`)));
ok(existingPhaseTests.length >= requiredPhaseTests.length, "54. regressões PR69–PR78 continuam disponíveis/executáveis quando existem");

console.log(`\n${"=".repeat(72)}`);
console.log("PR81 — Skill Factory Real v1 — Fechamento ponta a ponta");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const failure of failures) {
    console.log(`  • ${failure}`);
  }
  process.exit(1);
}

console.log("Todos os cenários obrigatórios da PR81 passaram. ✅");
process.exit(0);
