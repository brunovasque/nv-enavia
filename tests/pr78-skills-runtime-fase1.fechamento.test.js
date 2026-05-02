// ============================================================================
// 🧪 PR78 — Fechamento funcional da Fase 1 do Runtime de Skills
//
// Run: node tests/pr78-skills-runtime-fase1.fechamento.test.js
// Escopo: Tests-only + Docs-only minimo
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import { buildSkillExecutionProposal } from "../schema/enavia-skill-executor.js";
import { buildSystemMapperResult } from "../schema/enavia-system-mapper-skill.js";
import { buildChatSkillSurface } from "../schema/enavia-chat-skill-surface.js";

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
  const raw = [
    execSync("git diff --name-only", { encoding: "utf-8" }),
    execSync("git diff --name-only --cached", { encoding: "utf-8" }),
    execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" }),
  ].join("\n");

  return Array.from(new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
}

function extractFnBlock(source, fnName) {
  const start = source.indexOf(`async function ${fnName}(request)`);
  if (start < 0) return "";

  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const exportDefault = source.indexOf("export default {", start);

  const candidates = [nextAsync, exportDefault]
    .filter((idx) => idx > start)
    .sort((a, b) => a - b);

  const end = candidates.length > 0 ? candidates[0] : -1;
  return end > 0 ? source.slice(start, end) : source.slice(start);
}

function collectSkillRoutes(source) {
  const routes = new Set();

  const pathRegex = /path === "(\/skills\/[a-z-]+)"/g;
  let match;
  while ((match = pathRegex.exec(source)) !== null) {
    routes.add(match[1]);
  }

  const pathnameRegex = /url\.pathname === "(\/skills\/[a-z-]+)"/g;
  while ((match = pathnameRegex.exec(source)) !== null) {
    routes.add(match[1]);
  }

  return Array.from(routes).sort();
}

function runRegression(label, command) {
  try {
    execSync(command, { encoding: "utf-8", stdio: "pipe" });
    ok(true, label);
  } catch {
    ok(false, label);
  }
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
  return { status: res.status, data, headers: res.headers };
}

const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
const wranglerSource = readFileSync(resolve(__dirname, "../wrangler.toml"), "utf-8");
const contractExecutorSource = readFileSync(resolve(__dirname, "../contract-executor.js"), "utf-8");
const skillExecutorSource = readFileSync(resolve(__dirname, "../schema/enavia-skill-executor.js"), "utf-8");
const skillGateSource = readFileSync(resolve(__dirname, "../schema/enavia-skill-approval-gate.js"), "utf-8");
const systemMapperSource = readFileSync(resolve(__dirname, "../schema/enavia-system-mapper-skill.js"), "utf-8");
const chatSurfaceSource = readFileSync(resolve(__dirname, "../schema/enavia-chat-skill-surface.js"), "utf-8");

const proposeHandler = extractFnBlock(workerSource, "handleSkillsPropose");
const approveHandler = extractFnBlock(workerSource, "handleSkillsApprove");
const rejectHandler = extractFnBlock(workerSource, "handleSkillsReject");

section("1-2 — proposal engine");
const knownProposal = buildSkillExecutionProposal({
  skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  intentClassification: { intent: "system_state_question" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
  responsePolicy: { should_refuse_or_pause: false },
});
const unknownProposal = buildSkillExecutionProposal({
  skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
});
ok(typeof buildSkillExecutionProposal === "function", "1. buildSkillExecutionProposal existe e propõe SYSTEM_MAPPER");
ok(
  knownProposal?.skill_execution?.skill_id === "SYSTEM_MAPPER" && knownProposal?.skill_execution?.status === "proposed",
  "1.1 skill conhecida gera proposta proposed para SYSTEM_MAPPER",
);
ok(unknownProposal?.skill_execution?.status === "blocked", "2. skill desconhecida continua blocked");

section("3-9 — /skills/propose, approve/reject e /skills/run");
const proposeResponse = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  intentClassification: { intent: "system_state_question" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
  responsePolicy: { should_refuse_or_pause: false },
});
ok(proposeResponse.status === 200, "3. /skills/propose retorna 200 para proposta valida");
ok(proposeResponse.data?.skill_execution?.mode === "proposal", "3.1 /skills/propose retorna skill_execution proposal");
ok(
  typeof proposeResponse.data?.proposal_id === "string" && proposeResponse.data.proposal_id.length > 0 &&
    proposeResponse.data?.proposal_status === "proposed",
  "4. /skills/propose retorna proposal_id/proposal_status",
);

const approveResponse = await callWorker("POST", "/skills/approve", {
  proposal_id: proposeResponse.data?.proposal_id,
});
ok(approveResponse.status === 200 && approveResponse.data?.proposal_status === "approved", "5. /skills/approve aprova proposal valida");

const rejectCandidate = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
});
const rejectResponse = await callWorker("POST", "/skills/reject", {
  proposal_id: rejectCandidate.data?.proposal_id,
});
ok(rejectResponse.status === 200 && rejectResponse.data?.proposal_status === "rejected", "6. /skills/reject rejeita proposal valida");
ok(approveResponse.data?.executed === false && rejectResponse.data?.executed === false, "7. approval/reject mantem executed=false");
ok(
  approveResponse.data?.side_effects === false && rejectResponse.data?.side_effects === false,
  "8. approval/reject mantem side_effects=false",
);

const runMissing = await callWorker("POST", "/skills/run", { skill_id: "SYSTEM_MAPPER" });
ok(runMissing.status === 404, "9. /skills/run continua inexistente");

section("10-14 — SYSTEM_MAPPER read-only");
ok(typeof buildSystemMapperResult === "function", "10. buildSystemMapperResult existe");
const mapperAllowed = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "approved",
});
const mapperBlocked = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "proposed",
});
ok(mapperAllowed.mode === "read_only", "11. SYSTEM_MAPPER retorna mode=read_only");
ok(mapperAllowed.executed === false, "12. SYSTEM_MAPPER retorna executed=false");
ok(mapperAllowed.executed_readonly === true, "13. SYSTEM_MAPPER retorna executed_readonly=true quando permitido");
ok(mapperBlocked.status === "blocked", "14. SYSTEM_MAPPER bloqueia sem approved quando require_approved_proposal=true");

section("15-18 — chat_skill_surface");
ok(typeof buildChatSkillSurface === "function", "15. chat_skill_surface existe");
const surfaceProposed = buildChatSkillSurface({
  skillExecution: { mode: "proposal", status: "proposed", skill_id: "SYSTEM_MAPPER", side_effects: false },
});
const surfaceBlocked = buildChatSkillSurface({
  skillExecution: { mode: "proposal", status: "blocked", skill_id: "SYSTEM_MAPPER", side_effects: false },
});
const surfaceNotApplicable = buildChatSkillSurface({
  skillExecution: { mode: "proposal", status: "not_applicable", skill_id: null, side_effects: false },
});
ok(!!surfaceProposed && surfaceProposed.status === "proposed", "16. chat_skill_surface aparece apenas para skill_execution.status=proposed");
ok(surfaceBlocked === null, "17. chat_skill_surface nao aparece para blocked");
ok(surfaceNotApplicable === null, "18. chat_skill_surface nao aparece para not_applicable");

section("19-25 — /chat/run e guardrails");
ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "19. /chat/run mantem skill_execution como campo aditivo");
ok(workerSource.includes("...(_chatSkillSurface ? { chat_skill_surface: _chatSkillSurface } : {})"), "20. /chat/run mantem chat_skill_surface como campo aditivo quando proposto");
ok(!workerSource.includes("buildSystemMapperResult("), "21. /chat/run nao executa SYSTEM_MAPPER automaticamente");
ok(
  !workerSource.includes("use_planner = _skillExecution") && !workerSource.includes("use_planner = _chatSkillSurface"),
  "22. /chat/run nao altera use_planner",
);
ok(
  workerSource.includes("reply,") &&
    !workerSource.includes("reply = _skillExecution") &&
    !workerSource.includes("reply = _chatSkillSurface"),
  "23. /chat/run nao substitui reply por JSON",
);
ok(workerSource.includes("runEnaviaSelfAudit("), "24. Self-Audit continua no fluxo");
ok(workerSource.includes("buildEnaviaResponsePolicy("), "25. Response Policy continua no fluxo");

section("26-30 — guardrails estruturais de fase");
const changedFiles = getChangedFiles();
ok(wranglerSource.length > 0 && !changedFiles.includes("wrangler.toml"), "26. wrangler.toml nao foi alterado");
ok(contractExecutorSource.length > 0 && !changedFiles.includes("contract-executor.js"), "27. contract-executor.js nao foi alterado");

const skillRoutes = collectSkillRoutes(workerSource);
const allowedRoutes = new Set(["/skills/propose", "/skills/approve", "/skills/reject"]);
const hasOnlyAllowedSkillRoutes = skillRoutes.every((route) => allowedRoutes.has(route));
ok(hasOnlyAllowedSkillRoutes, "28. nenhum endpoint novo alem dos autorizados na fase");
ok(!skillRoutes.includes("/skills/run"), "29. nao ha rota /skills/run");

const noForbiddenRuntimeOps =
  !skillExecutorSource.includes("fetch(") &&
  !skillGateSource.includes("fetch(") &&
  !systemMapperSource.includes("fetch(") &&
  !chatSurfaceSource.includes("fetch(") &&
  !skillExecutorSource.includes("readFileSync") &&
  !skillGateSource.includes("readFileSync") &&
  !systemMapperSource.includes("readFileSync") &&
  !chatSurfaceSource.includes("readFileSync") &&
  !proposeHandler.includes("ENAVIA_BRAIN") &&
  !approveHandler.includes("ENAVIA_BRAIN") &&
  !rejectHandler.includes("ENAVIA_BRAIN") &&
  !proposeHandler.toLowerCase().includes("openai") &&
  !approveHandler.toLowerCase().includes("openai") &&
  !rejectHandler.toLowerCase().includes("openai") &&
  !proposeHandler.toLowerCase().includes("anthropic") &&
  !approveHandler.toLowerCase().includes("anthropic") &&
  !rejectHandler.toLowerCase().includes("anthropic");
ok(noForbiddenRuntimeOps, "30. sem KV/fetch/filesystem runtime/LLM externo novo na fase");

section("31-39 — regressao PR69..PR77");
runRegression("31. PR69 smoke continua passando", "node tests/pr69-skill-execution-proposal.smoke.test.js");
runRegression("32. PR70 prova continua passando", "node tests/pr70-skill-execution-proposal.prova.test.js");
runRegression("33. PR71 smoke continua passando", "node tests/pr71-skills-propose-endpoint.smoke.test.js");
runRegression("34. PR72 prova continua passando", "node tests/pr72-skills-propose-endpoint.prova.test.js");
runRegression("35. PR73 smoke continua passando", "node tests/pr73-approval-gate-proposal-only.smoke.test.js");
runRegression("36. PR74 prova continua passando", "node tests/pr74-approval-gate.prova.test.js");
runRegression("37. PR75 smoke continua passando", "node tests/pr75-system-mapper-readonly.smoke.test.js");
runRegression("38. PR76 prova continua passando", "node tests/pr76-system-mapper.prova.test.js");
runRegression("39. PR77 smoke continua passando", "node tests/pr77-chat-controlled-skill-integration.smoke.test.js");

section("40 — relatorio de fechamento");
const reportPath = resolve(__dirname, "../schema/reports/PR78_FECHAMENTO_SKILLS_RUNTIME_FASE1.md");
let reportSource = "";
try {
  reportSource = readFileSync(reportPath, "utf-8");
} catch {
  reportSource = "";
}
ok(
  reportSource.includes("O que existe") && reportSource.includes("O que ainda NAO existe"),
  "40. relatorio de fechamento declara claramente o que existe e o que ainda NAO existe",
);

console.log(`\n${"=".repeat(60)}`);
console.log("PR78 — Fechamento funcional da Fase 1 do Runtime de Skills");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os 40 cenarios obrigatorios passaram. ✅");
process.exit(0);
