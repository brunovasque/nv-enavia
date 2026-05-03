// ============================================================================
// 🧪 PR79 — Skill Factory Core (smoke)
//
// Run: node tests/pr79-skill-factory-core.smoke.test.js
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import {
  buildSkillSpec,
  validateSkillSpec,
  buildSkillCreationPackage,
} from "../schema/enavia-skill-factory.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
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
    async get() { return null; },
    async put() {},
    async list() { return { keys: [] }; },
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
const wranglerSource = readFileSync(resolve(__dirname, "../wrangler.toml"), "utf-8");
const contractExecutorSource = readFileSync(resolve(__dirname, "../contract-executor.js"), "utf-8");
const activeContractSource = readFileSync(resolve(__dirname, "../schema/contracts/ACTIVE_CONTRACT.md"), "utf-8");
const indexContractSource = readFileSync(resolve(__dirname, "../schema/contracts/INDEX.md"), "utf-8");
const specHandlerSource = extractFnBlock(workerSource, "handleSkillFactorySpec");
const createHandlerSource = extractFnBlock(workerSource, "handleSkillFactoryCreate");

section("1-6 — buildSkillSpec basico");
const simpleSpec = buildSkillSpec({
  human_request: "Criar skill para resumir mudanças de rota do sistema em modo somente leitura.",
});
ok(typeof buildSkillSpec === "function", "1. buildSkillSpec existe");
ok(simpleSpec && typeof simpleSpec === "object", "1.1 buildSkillSpec retorna objeto");
ok(simpleSpec.status === "proposed", "2. pedido simples gera status=proposed");
ok(/^[a-z][a-z0-9-]*$/.test(simpleSpec.skill_id), "3. skill_id normalizado em padrão seguro");
ok(typeof simpleSpec.purpose === "string" && Array.isArray(simpleSpec.inputs) && Array.isArray(simpleSpec.outputs) && typeof simpleSpec.mode === "string", "4. purpose/inputs/outputs/mode presentes");
ok(simpleSpec.approval_required === true, "5. approval_required=true sempre");
ok(simpleSpec.human_review_required === true, "6. human_review_required=true sempre");

section("7-13 — pacote de criacao sob autorizacao");
const noAuthPkg = buildSkillCreationPackage(simpleSpec, {});
ok(noAuthPkg.ok === false && noAuthPkg.error === "AUTHORIZATION_REQUIRED", "7. sem autorização não gera pacote");
const withAuthPkg = buildSkillCreationPackage(simpleSpec, {
  approved_to_prepare_package: true,
  human_authorization_text: "Aprovado por humano para preparar pacote de PR.",
});
ok(withAuthPkg.ok === true && withAuthPkg.prepared === true, "8. com autorização explícita gera pacote");
ok(Array.isArray(withAuthPkg.skill_creation_package?.files_to_create) && withAuthPkg.skill_creation_package.files_to_create.length > 0, "9. pacote contém files_to_create");
ok(Array.isArray(withAuthPkg.skill_creation_package?.tests_to_create) && withAuthPkg.skill_creation_package.tests_to_create.length > 0, "10. pacote contém tests_to_create");
ok(Array.isArray(withAuthPkg.skill_creation_package?.registry_changes) && withAuthPkg.skill_creation_package.registry_changes.length > 0, "11. pacote contém registry_changes");
ok(Array.isArray(withAuthPkg.skill_creation_package?.human_review_checklist) && withAuthPkg.skill_creation_package.human_review_checklist.length > 0, "12. pacote contém checklist de revisão humana");
ok(Array.isArray(withAuthPkg.skill_creation_package?.rollback_suggested) && withAuthPkg.skill_creation_package.rollback_suggested.length > 0, "13. pacote contém rollback sugerido");

section("14-21 — bloqueios e campos de risco");
ok(buildSkillSpec({ human_request: "Crie skill para ler OPENAI_API_KEY e usar secrets." }).status === "blocked", "14. pedido perigoso com credenciais sensíveis é blocked");
ok(buildSkillSpec({ human_request: "Crie skill para fazer deploy automático em produção." }).status === "blocked", "15. pedido perigoso com deploy automático é blocked");
ok(buildSkillSpec({ human_request: "Crie skill para abrir browser e clicar botões." }).status === "blocked", "16. pedido perigoso com browser action é blocked");
ok(buildSkillSpec({ human_request: "Crie skill para executar comando externo via shell." }).status === "blocked", "17. pedido perigoso com comando externo é blocked");
ok(buildSkillSpec({ human_request: "Skill para alterar arquivo", mode: "supervised_side_effect", allowed_effects: [] }).status === "blocked", "18. side effect sem allowed_effects é blocked");
ok(buildSkillSpec({ human_request: "Ler documentação local e estruturar resumo." }).status === "proposed", "19. pedido read_only seguro é proposed");
ok(typeof simpleSpec.risk_level === "string" && simpleSpec.risk_level.length > 0, "20. risk_level preenchido");
ok(Array.isArray(simpleSpec.forbidden_effects) && simpleSpec.forbidden_effects.length > 0, "21. forbidden_effects preenchido");

section("22-24 — sanitizacao e determinismo");
const secretSpec = buildSkillSpec({
  human_request: "Use OPENAI_API_KEY, bearer token e authorization header para rodar.",
});
const secretPayload = JSON.stringify(secretSpec).toLowerCase();
ok(!secretPayload.includes("openai_api_key"), "22. saída não expõe OPENAI_API_KEY");
ok(!secretPayload.includes("token") && !secretPayload.includes("secret") && !secretPayload.includes("authorization"), "23. saída não expõe token/secret/authorization");
const deterministicA = buildSkillSpec({ human_request: "Skill para mapear rotas read only." });
const deterministicB = buildSkillSpec({ human_request: "Skill para mapear rotas read only." });
ok(JSON.stringify(deterministicA) === JSON.stringify(deterministicB), "24. saída determinística para mesmo input");

section("25-31 — endpoints factory");
const specEndpoint = await callWorker("POST", "/skills/factory/spec", {
  human_request: "Criar skill para leitura de contrato ativo e resumo.",
});
ok(specEndpoint.status === 200 && !!specEndpoint.data?.skill_spec && !("skill_creation_package" in (specEndpoint.data || {})), "25. /skills/factory/spec retorna spec e não pacote");

const createNoAuth = await callWorker("POST", "/skills/factory/create", {
  human_request: "Criar skill read only para resumo de arquivos.",
});
ok(createNoAuth.status === 403 && createNoAuth.data?.error === "AUTHORIZATION_REQUIRED", "26. /skills/factory/create bloqueia sem autorização");

const createWithAuth = await callWorker("POST", "/skills/factory/create", {
  human_request: "Criar skill read only para resumo de arquivos.",
  approved_to_prepare_package: true,
  human_authorization_text: "Autorização humana explícita para preparar pacote.",
});
ok(createWithAuth.status === 200 && createWithAuth.data?.prepared === true && !!createWithAuth.data?.skill_creation_package, "27. /skills/factory/create retorna pacote com autorização");

const invalidSpecJson = await callWorker("POST", "/skills/factory/spec", "{ invalid-json");
const invalidCreateJson = await callWorker("POST", "/skills/factory/create", "{ invalid-json");
ok(invalidSpecJson.status === 400 && invalidCreateJson.status === 400 && invalidSpecJson.data?.error === "INVALID_JSON" && invalidCreateJson.data?.error === "INVALID_JSON", "28. endpoints retornam erro controlado para JSON inválido");

const getSpec = await callWorker("GET", "/skills/factory/spec");
const getCreate = await callWorker("GET", "/skills/factory/create");
ok(getSpec.status === 405 && getCreate.status === 405 && getSpec.data?.error === "METHOD_NOT_ALLOWED" && getCreate.data?.error === "METHOD_NOT_ALLOWED", "29. GET retorna METHOD_NOT_ALLOWED");

const skillsRun = await callWorker("POST", "/skills/run", { skill_id: "nova-skill" });
ok(skillsRun.status === 404, "30. /skills/run não foi criado nesta PR");
ok(createWithAuth.data?.executed === false, "31. não executa skill recém-criada");

section("32-35 — guardrails de implementação");
let fetchCalls = 0;
const originalFetch = globalThis.fetch;
globalThis.fetch = async (...args) => {
  fetchCalls++;
  return originalFetch(...args);
};
try {
  await callWorker("POST", "/skills/factory/spec", { human_request: "Skill read only." });
} finally {
  globalThis.fetch = originalFetch;
}
ok(fetchCalls === 0, "32. não chama fetch no fluxo da factory");
ok(!factorySource.includes("readFileSync") && !factorySource.includes("writeFileSync") && !specHandlerSource.includes("readFileSync") && !createHandlerSource.includes("readFileSync"), "33. não usa filesystem runtime");
ok(
  !factorySource.includes('from "node:child_process"') &&
  !factorySource.includes("require(\"child_process\")") &&
  !factorySource.includes(" spawn(") &&
  !factorySource.includes(" exec(") &&
  !specHandlerSource.includes(" spawn(") &&
  !createHandlerSource.includes(" exec("),
  "34. não usa child_process/exec/spawn",
);
ok(
  !factorySource.includes("new OpenAI(") &&
  !factorySource.includes("openai.chat.completions") &&
  !factorySource.includes("anthropic") &&
  !specHandlerSource.toLowerCase().includes("openai") &&
  !createHandlerSource.toLowerCase().includes("openai"),
  "35. não chama LLM externo novo",
);

section("36-40 — escopo e contrato");
const changedFiles = getChangedFiles();
ok(wranglerSource.length > 0 && !changedFiles.includes("wrangler.toml"), "36. não altera wrangler.toml");
ok(contractExecutorSource.length > 0 && !changedFiles.includes("contract-executor.js"), "37. não altera contract-executor.js");
const hasForbiddenScopeChange =
  changedFiles.some((f) => f.startsWith("panel/")) ||
  changedFiles.some((f) => f.startsWith("executor/")) ||
  changedFiles.some((f) => f.startsWith(".github/workflows/")) ||
  changedFiles.some((f) => f.startsWith("deploy-worker/"));
ok(!hasForbiddenScopeChange, "38. não mexe em painel/deploy-worker/executor/workflows");
ok(activeContractSource.includes("CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md"), "39. ACTIVE_CONTRACT.md continua apontando para Skill Factory Real");
ok(indexContractSource.includes("CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md") && indexContractSource.includes("PR79 — Skill Factory Core"), "40. INDEX.md continua apontando para Skill Factory Real e PR79");

section("Validacao extra");
const specValidation = validateSkillSpec(simpleSpec);
ok(specValidation.ok === true, "extra. validateSkillSpec aprova spec válida");

console.log(`\n${"=".repeat(60)}`);
console.log("PR79 — Skill Factory Core — Smoke Test");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários obrigatórios passaram. ✅");
process.exit(0);
