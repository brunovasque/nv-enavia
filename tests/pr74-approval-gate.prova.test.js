// ============================================================================
// 🧪 PR74 — Prova formal: Approval Gate (PR73)
//
// Escopo: Tests-only.
// Objetivo: provar formalmente que o gate bloqueia execução sem approval,
// preserva deny-by-default e continua proposal-only/read-only.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import { registerSkillProposal } from "../schema/enavia-skill-approval-gate.js";

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

function makeKVSpy() {
  const calls = { get: 0, put: 0, list: 0, delete: 0 };
  return {
    calls,
    kv: {
      async get() {
        calls.get++;
        return null;
      },
      async put() {
        calls.put++;
      },
      async list() {
        calls.list++;
        return { keys: [] };
      },
      async delete() {
        calls.delete++;
      },
    },
  };
}

function extractFnBlock(source, fnName) {
  const start = source.indexOf(`async function ${fnName}(request)`);
  if (start < 0) return "";
  const nextAsync = source.indexOf("\nasync function ", start + 1);
  const exportEnd = source.indexOf("export default {", start);

  const candidates = [nextAsync, exportEnd]
    .filter((idx) => idx > start)
    .sort((a, b) => a - b);

  const finalEnd = candidates.length > 0 ? candidates[0] : -1;
  if (finalEnd < 0) return source.slice(start);
  return source.slice(start, finalEnd);
}

const BASE_ENV = {
  ENAVIA_MODE: "supervised",
  OPENAI_API_KEY: "test-key-fake",
  OPENAI_MODEL: "gpt-test",
  OWNER: "Vasques",
  SYSTEM_NAME: "ENAVIA",
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_BUCKET: "test-bucket",
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

const workerPath = resolve(__dirname, "../nv-enavia.js");
const gatePath = resolve(__dirname, "../schema/enavia-skill-approval-gate.js");
const contractExecutorPath = resolve(__dirname, "../contract-executor.js");
const wranglerPath = resolve(__dirname, "../wrangler.toml");

const workerSource = readFileSync(workerPath, "utf-8");
const gateSource = readFileSync(gatePath, "utf-8");
const contractExecutorSource = readFileSync(contractExecutorPath, "utf-8");
const wranglerSource = readFileSync(wranglerPath, "utf-8");

const approveHandlerSource = extractFnBlock(workerSource, "handleSkillsApprove");
const rejectHandlerSource = extractFnBlock(workerSource, "handleSkillsReject");

const gateResponses = [];
function track(response) {
  gateResponses.push(response);
  return response;
}

section("1 — proposta valida recebe proposal_id");
const validProposal = track(await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  intentClassification: { intent: "system_state_question" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
  responsePolicy: { should_refuse_or_pause: false },
  chatContext: { channel: "chat" },
}));
const validProposalId = validProposal.data?.proposal_id;
ok(validProposal.status === 200, "1.1 status 200");
ok(typeof validProposalId === "string" && validProposalId.length > 0, "1.2 proposal_id string nao-vazio");

section("2 — proposal inicial fica proposed");
ok(validProposal.data?.proposal_status === "proposed", "2.1 proposal_status=proposed");
ok(validProposal.data?.skill_execution?.status === "proposed", "2.2 skill_execution.status=proposed");

section("3 — approve de proposal valida retorna approved");
const approved = track(await callWorker("POST", "/skills/approve", { proposal_id: validProposalId }));
ok(approved.status === 200, "3.1 status 200");
ok(approved.data?.ok === true, "3.2 ok=true");
ok(approved.data?.proposal_status === "approved", "3.3 proposal_status=approved");

section("4 — reject de proposal valida retorna rejected");
const rejectCandidate = track(await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
}));
const rejected = track(await callWorker("POST", "/skills/reject", { proposal_id: rejectCandidate.data?.proposal_id }));
ok(rejectCandidate.status === 200, "4.1 proposal para reject status 200");
ok(rejected.status === 200, "4.2 reject status 200");
ok(rejected.data?.ok === true, "4.3 ok=true");
ok(rejected.data?.proposal_status === "rejected", "4.4 proposal_status=rejected");

section("5 — approve de proposal desconhecida bloqueia");
const unknownApprove = track(await callWorker("POST", "/skills/approve", { proposal_id: "proposal_unknown_pr74" }));
ok(unknownApprove.status === 409, "5.1 status 409");
ok(unknownApprove.data?.ok === false, "5.2 ok=false");
ok(unknownApprove.data?.proposal_status === "blocked", "5.3 proposal_status=blocked");

section("6 — reject de proposal desconhecida bloqueia");
const unknownReject = track(await callWorker("POST", "/skills/reject", { proposal_id: "proposal_unknown_pr74" }));
ok(unknownReject.status === 409, "6.1 status 409");
ok(unknownReject.data?.ok === false, "6.2 ok=false");
ok(unknownReject.data?.proposal_status === "blocked", "6.3 proposal_status=blocked");

section("7 — approve sem proposal_id bloqueia");
const missingApprove = track(await callWorker("POST", "/skills/approve", {}));
ok(missingApprove.status === 409, "7.1 status 409");
ok(missingApprove.data?.ok === false, "7.2 ok=false");
ok((missingApprove.data?.message || "").toLowerCase().includes("proposal_id"), "7.3 mensagem cita proposal_id");

section("8 — reject sem proposal_id bloqueia");
const missingReject = track(await callWorker("POST", "/skills/reject", {}));
ok(missingReject.status === 409, "8.1 status 409");
ok(missingReject.data?.ok === false, "8.2 ok=false");
ok((missingReject.data?.message || "").toLowerCase().includes("proposal_id"), "8.3 mensagem cita proposal_id");

section("9 — approve de proposal blocked bloqueia");
const blockedProposal = track(await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
}));
const blockedApprove = track(await callWorker("POST", "/skills/approve", { proposal_id: blockedProposal.data?.proposal_id }));
ok(blockedProposal.data?.skill_execution?.status === "blocked", "9.1 proposal inicial blocked");
ok(blockedApprove.status === 409, "9.2 status 409");
ok(blockedApprove.data?.proposal_status === "blocked", "9.3 proposal_status=blocked");

section("10 — approve de proposal not_applicable bloqueia");
const notApplicableProposal = track(await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: false, skill_id: null },
  intentClassification: { intent: "conversation" },
}));
const notApplicableApprove = track(await callWorker("POST", "/skills/approve", {
  proposal_id: notApplicableProposal.data?.proposal_id,
}));
ok(notApplicableProposal.data?.skill_execution?.status === "not_applicable", "10.1 proposal inicial not_applicable");
ok(notApplicableApprove.status === 409, "10.2 status 409");
ok(notApplicableApprove.data?.proposal_status === "blocked", "10.3 proposal_status=blocked");

section("11 — reject de proposal blocked bloqueia");
const blockedReject = track(await callWorker("POST", "/skills/reject", { proposal_id: blockedProposal.data?.proposal_id }));
ok(blockedReject.status === 409, "11.1 status 409");
ok(blockedReject.data?.ok === false, "11.2 ok=false");
ok(blockedReject.data?.proposal_status === "blocked", "11.3 proposal_status=blocked");

section("12 — reject de proposal not_applicable bloqueia");
const notApplicableReject = track(await callWorker("POST", "/skills/reject", {
  proposal_id: notApplicableProposal.data?.proposal_id,
}));
ok(notApplicableReject.status === 409, "12.1 status 409");
ok(notApplicableReject.data?.ok === false, "12.2 ok=false");
ok(notApplicableReject.data?.proposal_status === "blocked", "12.3 proposal_status=blocked");

section("13 — approve de proposal ja approved bloqueia segunda aprovacao");
const secondApprove = track(await callWorker("POST", "/skills/approve", { proposal_id: validProposalId }));
ok(secondApprove.status === 409, "13.1 status 409");
ok(secondApprove.data?.ok === false, "13.2 ok=false");
ok((secondApprove.data?.message || "").toLowerCase().includes("approved"), "13.3 mensagem cita approved");

section("14 — reject de proposal ja rejected bloqueia segunda rejeicao");
const secondReject = track(await callWorker("POST", "/skills/reject", { proposal_id: rejectCandidate.data?.proposal_id }));
ok(secondReject.status === 409, "14.1 status 409");
ok(secondReject.data?.ok === false, "14.2 ok=false");
ok((secondReject.data?.message || "").toLowerCase().includes("rejected"), "14.3 mensagem cita rejected");

section("15 — proposal expirada nao pode ser approved");
const expiredApproveProposal = registerSkillProposal(
  {
    mode: "proposal",
    status: "proposed",
    skill_id: "SYSTEM_MAPPER",
    reason: "proposal para expiracao approve",
    requires_approval: true,
    side_effects: false,
  },
  { expires_at: new Date(Date.now() - 60_000).toISOString() },
);
const expiredApprove = track(await callWorker("POST", "/skills/approve", { proposal_id: expiredApproveProposal.proposal_id }));
ok(expiredApprove.status === 409, "15.1 status 409");
ok(expiredApprove.data?.ok === false, "15.2 ok=false");
ok((expiredApprove.data?.message || "").toLowerCase().includes("expirada"), "15.3 mensagem cita expirada");

section("16 — proposal expirada nao pode ser rejected");
const expiredRejectProposal = registerSkillProposal(
  {
    mode: "proposal",
    status: "proposed",
    skill_id: "SYSTEM_MAPPER",
    reason: "proposal para expiracao reject",
    requires_approval: true,
    side_effects: false,
  },
  { expires_at: new Date(Date.now() - 60_000).toISOString() },
);
const expiredReject = track(await callWorker("POST", "/skills/reject", { proposal_id: expiredRejectProposal.proposal_id }));
ok(expiredReject.status === 409, "16.1 status 409");
ok(expiredReject.data?.ok === false, "16.2 ok=false");
ok((expiredReject.data?.message || "").toLowerCase().includes("expirada"), "16.3 mensagem cita expirada");

section("17 — JSON invalido em /skills/approve retorna erro controlado");
const invalidApprove = track(await callWorker("POST", "/skills/approve", "{ invalid-json"));
ok(invalidApprove.status === 400, "17.1 status 400");
ok(invalidApprove.data?.error === "INVALID_JSON", "17.2 error=INVALID_JSON");
ok(invalidApprove.data?.proposal_status === "blocked", "17.3 proposal_status=blocked");

section("18 — JSON invalido em /skills/reject retorna erro controlado");
const invalidReject = track(await callWorker("POST", "/skills/reject", "{ invalid-json"));
ok(invalidReject.status === 400, "18.1 status 400");
ok(invalidReject.data?.error === "INVALID_JSON", "18.2 error=INVALID_JSON");
ok(invalidReject.data?.proposal_status === "blocked", "18.3 proposal_status=blocked");

section("19 — metodo GET em /skills/approve retorna 405 METHOD_NOT_ALLOWED");
const getApprove = await callWorker("GET", "/skills/approve");
ok(getApprove.status === 405, "19.1 status 405");
ok(getApprove.data?.error === "METHOD_NOT_ALLOWED", "19.2 error=METHOD_NOT_ALLOWED");

section("20 — metodo GET em /skills/reject retorna 405 METHOD_NOT_ALLOWED");
const getReject = await callWorker("GET", "/skills/reject");
ok(getReject.status === 405, "20.1 status 405");
ok(getReject.data?.error === "METHOD_NOT_ALLOWED", "20.2 error=METHOD_NOT_ALLOWED");

section("21 — side_effects=false em todas as respostas do gate");
const sideEffectsAllFalse = gateResponses.every((r) =>
  r?.data?.side_effects === false &&
  r?.data?.skill_execution?.side_effects === false,
);
ok(sideEffectsAllFalse, "21.1 side_effects=false em todas as respostas coletadas");

section("22 — executed=false em todas as respostas do gate");
const executedAllFalse = gateResponses.every((r) => r?.data?.executed === false);
ok(executedAllFalse, "22.1 executed=false em todas as respostas coletadas");

section("23 — /skills/run continua inexistente");
const skillsRun = await callWorker("POST", "/skills/run", { skill_id: "SYSTEM_MAPPER" });
ok(skillsRun.status === 404, "23.1 status 404");
ok(skillsRun.data?.path === "/skills/run", "23.2 path=/skills/run");

section("24 — approval nao executa skill");
ok(approved.data?.executed === false, "24.1 executed=false");
ok(approved.data?.side_effects === false, "24.2 side_effects=false");

section("25 — reject nao executa skill");
ok(rejected.data?.executed === false, "25.1 executed=false");
ok(rejected.data?.side_effects === false, "25.2 side_effects=false");

section("26-29 — gate sem KV/fetch/filesystem runtime/LLM externo");
{
  const kvSpy = makeKVSpy();
  const env = { ...BASE_ENV, ENAVIA_BRAIN: kvSpy.kv };

  let fetchCalls = 0;
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (...args) => {
    fetchCalls++;
    return originalFetch(...args);
  };

  try {
    const proposal = await callWorker("POST", "/skills/propose", {
      skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    }, env);
    await callWorker("POST", "/skills/approve", { proposal_id: proposal.data?.proposal_id }, env);

    ok(kvSpy.calls.get === 0 && kvSpy.calls.put === 0 && kvSpy.calls.list === 0 && kvSpy.calls.delete === 0, "26.1 sem uso de KV");
    ok(fetchCalls === 0, "27.1 sem chamadas fetch");
  } finally {
    globalThis.fetch = originalFetch;
  }

  const lowerHandlers = `${approveHandlerSource}\n${rejectHandlerSource}`.toLowerCase();
  const lowerGate = gateSource.toLowerCase();

  ok(approveHandlerSource.length > 0 && rejectHandlerSource.length > 0, "26.2 handlers approve/reject localizados");
  ok(!approveHandlerSource.includes("ENAVIA_BRAIN") && !rejectHandlerSource.includes("ENAVIA_BRAIN") && !gateSource.includes("ENAVIA_BRAIN"), "26.3 sem binding KV no gate");
  ok(!approveHandlerSource.includes("fetch(") && !rejectHandlerSource.includes("fetch(") && !gateSource.includes("fetch("), "27.2 sem fetch no gate");
  ok(!approveHandlerSource.includes("readFileSync") && !rejectHandlerSource.includes("readFileSync") && !gateSource.includes("readFileSync") && !gateSource.includes("writeFileSync"), "28.1 sem filesystem runtime no gate");
  ok(!lowerHandlers.includes("openai") && !lowerHandlers.includes("gpt-") && !lowerHandlers.includes("anthropic") && !lowerGate.includes("openai") && !lowerGate.includes("gpt-") && !lowerGate.includes("anthropic"), "29.1 sem LLM externo no gate");
}

section("30 — wrangler.toml nao foi alterado");
{
  const changedSinceMain = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  ok(!changedSinceMain.includes("wrangler.toml"), "30.1 wrangler.toml fora do diff vs origin/main");
  ok(wranglerSource.length > 0, "30.2 wrangler.toml legivel");
}

section("31 — contract-executor.js nao foi alterado");
{
  const changedSinceMain = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  ok(!changedSinceMain.includes("contract-executor.js"), "31.1 contract-executor.js fora do diff vs origin/main");
  ok(contractExecutorSource.length > 0, "31.2 contract-executor.js legivel");
}

section("32 — reply/use_planner preservados");
ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "32.1 skill_execution integrado de forma aditiva");
ok(!workerSource.includes("reply = _skillExecution"), "32.2 sem alteracao de reply por skill_execution");
ok(!workerSource.includes("use_planner = _skillExecution"), "32.3 sem alteracao de use_planner por skill_execution");
ok(!Object.prototype.hasOwnProperty.call(approved.data || {}, "reply"), "32.4 /skills/approve sem campo reply");
ok(!Object.prototype.hasOwnProperty.call(approved.data || {}, "use_planner"), "32.5 /skills/approve sem campo use_planner");

console.log(`\n${"=".repeat(60)}`);
console.log("PR74 — Prova formal do Approval Gate");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenarios obrigatorios passaram. ✅");
process.exit(0);
