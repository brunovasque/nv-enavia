// ============================================================================
// 🧪 PR73 — Smoke test: Approval Gate técnico proposal-only
// Run: node tests/pr73-approval-gate-proposal-only.smoke.test.js
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";

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

const workerPath = resolve(__dirname, "../nv-enavia.js");
const gatePath = resolve(__dirname, "../schema/enavia-skill-approval-gate.js");
const workerSource = readFileSync(workerPath, "utf-8");
const gateSource = readFileSync(gatePath, "utf-8");
const approveHandlerSource = extractFnBlock(workerSource, "handleSkillsApprove");
const rejectHandlerSource = extractFnBlock(workerSource, "handleSkillsReject");

section("1 — proposta válida recebe proposal_id");
const validProposal = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  intentClassification: { intent: "system_state_question" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
  responsePolicy: { should_refuse_or_pause: false },
  chatContext: { channel: "chat" },
});
const validProposalId = validProposal.data?.proposal_id;
ok(validProposal.status === 200, "1.1 status 200");
ok(typeof validProposalId === "string" && validProposalId.length > 0, "1.2 proposal_id string não-vazio");

section("2 — proposta válida mantém status proposed antes de aprovação");
ok(validProposal.data?.skill_execution?.status === "proposed", "2.1 skill_execution.status=proposed");
ok(validProposal.data?.proposal_status === "proposed", "2.2 proposal_status=proposed");

section("3 — approve de proposta válida retorna approved");
const approved = await callWorker("POST", "/skills/approve", { proposal_id: validProposalId });
ok(approved.status === 200, "3.1 status 200");
ok(approved.data?.ok === true, "3.2 ok=true");
ok(approved.data?.proposal_status === "approved", "3.3 proposal_status=approved");
ok(approved.data?.skill_execution?.status === "approved", "3.4 skill_execution.status=approved");

section("4 — reject de proposta válida retorna rejected");
const rejectCandidate = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
});
const rejected = await callWorker("POST", "/skills/reject", { proposal_id: rejectCandidate.data?.proposal_id });
ok(rejectCandidate.status === 200, "4.1 proposta para reject status 200");
ok(rejected.status === 200, "4.2 reject status 200");
ok(rejected.data?.ok === true, "4.3 reject ok=true");
ok(rejected.data?.proposal_status === "rejected", "4.4 proposal_status=rejected");
ok(rejected.data?.skill_execution?.status === "rejected", "4.5 skill_execution.status=rejected");

section("5 — proposal blocked não pode ser approved");
const blockedProposal = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
});
const blockedApprove = await callWorker("POST", "/skills/approve", { proposal_id: blockedProposal.data?.proposal_id });
ok(blockedProposal.data?.skill_execution?.status === "blocked", "5.1 proposta inicial blocked");
ok(blockedApprove.status === 409, "5.2 approve bloqueado status 409");
ok(blockedApprove.data?.ok === false, "5.3 ok=false");
ok(blockedApprove.data?.proposal_status === "blocked", "5.4 proposal_status=blocked");

section("6 — proposal not_applicable não pode ser approved");
const notApplicable = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: false, skill_id: null },
  intentClassification: { intent: "conversation" },
});
const notApplicableApprove = await callWorker("POST", "/skills/approve", {
  proposal_id: notApplicable.data?.proposal_id,
});
ok(notApplicable.data?.skill_execution?.status === "not_applicable", "6.1 proposta inicial not_applicable");
ok(notApplicableApprove.status === 409, "6.2 approve bloqueado status 409");
ok(notApplicableApprove.data?.ok === false, "6.3 ok=false");
ok(notApplicableApprove.data?.proposal_status === "blocked", "6.4 proposal_status=blocked");

section("7 — proposal inválida/desconhecida retorna bloqueio controlado");
const unknownApprove = await callWorker("POST", "/skills/approve", { proposal_id: "proposal_inexistente_pr73" });
ok(unknownApprove.status === 409, "7.1 status 409");
ok(unknownApprove.data?.ok === false, "7.2 ok=false");
ok(unknownApprove.data?.proposal_status === "blocked", "7.3 proposal_status=blocked");

section("8 — approval não executa skill");
ok(approved.data?.executed === false, "8.1 executed=false");
ok(approved.data?.side_effects === false, "8.2 side_effects=false");

section("9 — reject não executa skill");
ok(rejected.data?.executed === false, "9.1 executed=false");
ok(rejected.data?.side_effects === false, "9.2 side_effects=false");

section("10 — side_effects=false sempre");
const sideEffectsValues = [
  validProposal.data?.side_effects,
  validProposal.data?.skill_execution?.side_effects,
  approved.data?.side_effects,
  approved.data?.skill_execution?.side_effects,
  rejected.data?.side_effects,
  rejected.data?.skill_execution?.side_effects,
  blockedApprove.data?.side_effects,
  blockedApprove.data?.skill_execution?.side_effects,
  notApplicableApprove.data?.side_effects,
  notApplicableApprove.data?.skill_execution?.side_effects,
  unknownApprove.data?.side_effects,
  unknownApprove.data?.skill_execution?.side_effects,
];
ok(sideEffectsValues.every((v) => v === false), "10.1 side_effects=false em todos os cenários do gate");

section("11 — /skills/run continua inexistente");
const skillsRun = await callWorker("POST", "/skills/run", { skill_id: "SYSTEM_MAPPER" });
ok(skillsRun.status === 404, "11.1 status 404");
ok(skillsRun.data?.path === "/skills/run", "11.2 path=/skills/run");

section("12 — gate sem KV/fetch/filesystem/LLM externo");
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
    await callWorker("POST", "/skills/reject", { proposal_id: proposal.data?.proposal_id }, env);

    ok(fetchCalls === 0, "12.1 sem chamadas fetch");
    ok(kvSpy.calls.get === 0 && kvSpy.calls.put === 0 && kvSpy.calls.list === 0 && kvSpy.calls.delete === 0, "12.2 sem uso de KV");
  } finally {
    globalThis.fetch = originalFetch;
  }

  ok(approveHandlerSource.length > 0, "12.3 handler /skills/approve encontrado");
  ok(rejectHandlerSource.length > 0, "12.4 handler /skills/reject encontrado");
  ok(!approveHandlerSource.includes("fetch(") && !rejectHandlerSource.includes("fetch("), "12.5 handlers sem fetch");
  ok(!approveHandlerSource.includes("ENAVIA_BRAIN") && !rejectHandlerSource.includes("ENAVIA_BRAIN"), "12.6 handlers sem ENAVIA_BRAIN");
  ok(!approveHandlerSource.includes("readFileSync") && !rejectHandlerSource.includes("readFileSync"), "12.7 handlers sem filesystem runtime");
  const handlersLower = `${approveHandlerSource}\n${rejectHandlerSource}`.toLowerCase();
  ok(!handlersLower.includes("openai") && !handlersLower.includes("gpt-") && !handlersLower.includes("anthropic"), "12.8 handlers sem LLM externo");
  ok(!gateSource.includes("fetch("), "12.9 módulo gate sem fetch");
  ok(!gateSource.includes("ENAVIA_BRAIN") && !gateSource.includes("caches.default"), "12.10 módulo gate sem bindings KV/runtime cache");
}

section("13-14 — wrangler.toml e contract-executor.js preservados");
{
  const changedSinceMain = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  ok(!changedSinceMain.includes("wrangler.toml"), "13.1 wrangler.toml fora do diff vs origin/main");
  ok(!changedSinceMain.includes("contract-executor.js"), "14.1 contract-executor.js fora do diff vs origin/main");
}

section("15 — reply/use_planner preservados");
ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "15.1 integração aditiva skill_execution preservada");
ok(!workerSource.includes("reply = _skillExecution"), "15.2 sem alteração de reply por skill_execution");
ok(!workerSource.includes("use_planner = _skillExecution"), "15.3 sem alteração de use_planner por skill_execution");
ok(!Object.prototype.hasOwnProperty.call(approved.data || {}, "reply"), "15.4 /skills/approve sem reply");
ok(!Object.prototype.hasOwnProperty.call(approved.data || {}, "use_planner"), "15.5 /skills/approve sem use_planner");

console.log(`\n${"=".repeat(60)}`);
console.log("PR73 — Approval Gate proposal-only — Smoke Test");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários obrigatórios passaram. ✅");
process.exit(0);
