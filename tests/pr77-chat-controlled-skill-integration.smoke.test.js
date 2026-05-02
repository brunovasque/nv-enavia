// ============================================================================
// 🧪 PR77 — Smoke test: Integracao controlada com chat (proposal surface)
//
// Run: node tests/pr77-chat-controlled-skill-integration.smoke.test.js
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import {
  buildChatSkillSurface,
  CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE,
} from "../schema/enavia-chat-skill-surface.js";

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
  return { status: res.status, data, headers: res.headers };
}

function getChangedFiles() {
  const raw = [
    execSync("git diff --name-only", { encoding: "utf-8" }),
    execSync("git diff --name-only --cached", { encoding: "utf-8" }),
    execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" }),
  ].join("\n");
  return Array.from(new Set(raw.split(/\r?\n/).map((s) => s.trim()).filter(Boolean)));
}

const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
const helperSource = readFileSync(resolve(__dirname, "../schema/enavia-chat-skill-surface.js"), "utf-8");

section("1 — /chat/run continua respondendo normalmente");
{
  const r = await callWorker("POST", "/chat/run", { message: "oi" });
  ok(r.data !== null, "1.1 /chat/run retorna JSON");
  ok(r.data?.system === "ENAVIA-NV-FIRST", "1.2 system preservado");
  ok(r.data?.mode === "llm-first", "1.3 mode preservado");
}

section("2-6 — surface control por status de skill_execution");
{
  const proposed = buildChatSkillSurface({
    skillExecution: {
      mode: "proposal",
      status: "proposed",
      skill_id: "SYSTEM_MAPPER",
      side_effects: false,
    },
  });
  ok(!!proposed, "2.1 proposed gera metadado aditivo");
  ok(proposed?.status === "proposed", "3.1 status=proposed no metadado");
  ok(proposed?.is_proposal === true && proposed?.awaiting_approval === true, "4.1 proposta explicita aguardando aprovacao");
  ok(proposed?.message === CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE, "4.2 mensagem controlada canonicamente");

  const blocked = buildChatSkillSurface({
    skillExecution: { mode: "proposal", status: "blocked", skill_id: "SYSTEM_MAPPER" },
  });
  ok(blocked === null, "5.1 blocked nao polui reply com promessa");

  const notApplicable = buildChatSkillSurface({
    skillExecution: { mode: "proposal", status: "not_applicable", skill_id: null },
  });
  ok(notApplicable === null, "6.1 not_applicable nao polui reply");
}

section("7-8 — reply principal e use_planner preservados");
{
  ok(workerSource.includes("reply,"), "7.1 reply principal continua no response");
  ok(!workerSource.includes("reply = _chatSkillSurface"), "7.2 reply nao eh substituido por skill surface");
  ok(!workerSource.includes("use_planner = _chatSkillSurface"), "8.1 use_planner nao eh alterado por skill surface");
}

section("9-12 — proibicoes estruturais preservadas");
{
  ok(!workerSource.includes('url.pathname === "/skills/run"') && !workerSource.includes('path === "/skills/run"'), "9.1 /skills/run continua inexistente");

  const hasUnexpectedSkillsEndpoint =
    workerSource.includes('url.pathname === "/skills/execute"') ||
    workerSource.includes('url.pathname === "/skills/run"');
  ok(!hasUnexpectedSkillsEndpoint, "10.1 nenhum endpoint novo de execucao de skill");

  ok(!workerSource.includes("buildSystemMapperResult("), "11.1 SYSTEM_MAPPER nao eh chamado automaticamente no chat");
  ok(!helperSource.includes("fetch(") && !helperSource.includes("readFileSync") && !helperSource.includes("writeFileSync"), "12.1 helper PR77 sem fetch/filesystem runtime");
}

section("13-15 — arquivos proibidos e guardrails");
{
  const changedFiles = getChangedFiles();
  ok(!changedFiles.includes("wrangler.toml"), "13.1 wrangler.toml nao alterado");
  ok(!changedFiles.includes("contract-executor.js"), "14.1 contract-executor.js nao alterado");

  ok(workerSource.includes("runEnaviaSelfAudit("), "15.1 Self-Audit continua no fluxo");
  ok(workerSource.includes("buildEnaviaResponsePolicy("), "15.2 Response Policy continua no fluxo");
}

section("16 — regressao PR76 permanece executavel");
{
  const pr76TestPath = resolve(__dirname, "./pr76-system-mapper.prova.test.js");
  ok(readFileSync(pr76TestPath, "utf-8").includes("PR76"), "16.1 teste de regressao PR76 segue presente");
}

section("Contrato aditivo no /chat/run");
{
  ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "A1 skill_execution segue campo aditivo");
  ok(workerSource.includes("...(_chatSkillSurface ? { chat_skill_surface: _chatSkillSurface } : {})"), "A2 chat_skill_surface aditivo quando proposta");
  ok(!workerSource.includes("buildSystemMapperResult("), "A3 sem execucao automatica de skill read-only no chat");
}

console.log(`\n${"=".repeat(60)}`);
console.log("PR77 — Integracao controlada com chat — Smoke Test");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenarios obrigatorios da PR77 passaram. ✅");
process.exit(0);
