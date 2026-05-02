// ============================================================================
// 🧪 PR72 — Prova formal: Endpoint /skills/propose (PR71)
//
// Escopo: Tests-only.
// Objetivo: provar formalmente que /skills/propose é proposal-only/read-only,
// seguro, sem side effects e sem /skills/run.
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

function extractHandleSkillsPropose(source) {
  const start = source.indexOf("async function handleSkillsPropose(request)");
  const end = source.indexOf("export default {", start);
  if (start < 0 || end < 0 || end <= start) return "";
  return source.slice(start, end);
}

const workerPath = resolve(__dirname, "../nv-enavia.js");
const contractExecutorPath = resolve(__dirname, "../contract-executor.js");
const wranglerPath = resolve(__dirname, "../wrangler.toml");
const workerSource = readFileSync(workerPath, "utf-8");
const handlerSource = extractHandleSkillsPropose(workerSource);

// 1) POST /skills/propose com skill conhecida retorna mode=proposal e status=proposed
section("1 — Skill conhecida retorna proposta");
const known = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  intentClassification: { intent: "system_state_question" },
  selfAudit: { risk_level: "low", should_block: false, findings: [] },
  responsePolicy: { should_refuse_or_pause: false },
  chatContext: { channel: "chat" },
});
ok(known.status === 200, "1.1 status 200");
ok(known.data?.skill_execution?.mode === "proposal", "1.2 mode=proposal");
ok(known.data?.skill_execution?.status === "proposed", "1.3 status=proposed");

// 2) requires_approval=true somente quando status=proposed
section("2 — requires_approval apenas em proposed");
const unknownForReq = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
});
const noSkillForReq = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: false, skill_id: null },
});
ok(known.data?.skill_execution?.requires_approval === true, "2.1 proposed => requires_approval=true");
ok(unknownForReq.data?.skill_execution?.status !== "proposed" && unknownForReq.data?.skill_execution?.requires_approval === false, "2.2 blocked => requires_approval=false");
ok(noSkillForReq.data?.skill_execution?.status !== "proposed" && noSkillForReq.data?.skill_execution?.requires_approval === false, "2.3 not_applicable => requires_approval=false");

// 3) side_effects=false sempre
section("3 — side_effects sempre false");
const invalidJsonForSideEffects = await callWorker("POST", "/skills/propose", "{ invalid-json");
const allSideEffects = [
  known.data?.skill_execution?.side_effects,
  unknownForReq.data?.skill_execution?.side_effects,
  noSkillForReq.data?.skill_execution?.side_effects,
  invalidJsonForSideEffects.data?.skill_execution?.side_effects,
];
ok(allSideEffects.every((v) => v === false), "3.1 side_effects=false em sucesso, bloqueio, not_applicable e erro");

// 4) skill desconhecida retorna blocked por deny-by-default
section("4 — Skill desconhecida bloqueada (deny-by-default)");
ok(unknownForReq.status === 200, "4.1 status 200");
ok(unknownForReq.data?.skill_execution?.status === "blocked", "4.2 status=blocked");
ok((unknownForReq.data?.skill_execution?.reason || "").toLowerCase().includes("allowlist"), "4.3 reason menciona allowlist");

// 5) selfAudit.risk_level=blocking retorna blocked
section("5 — Self-Audit risk_level=blocking");
const riskBlocking = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: { risk_level: "blocking", should_block: false, findings: [] },
});
ok(riskBlocking.status === 200, "5.1 status 200");
ok(riskBlocking.data?.skill_execution?.status === "blocked", "5.2 status=blocked");

// 6) selfAudit.should_block=true retorna blocked
section("6 — Self-Audit should_block=true");
const shouldBlock = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: { risk_level: "low", should_block: true, findings: [] },
});
ok(shouldBlock.status === 200, "6.1 status 200");
ok(shouldBlock.data?.skill_execution?.status === "blocked", "6.2 status=blocked");

// 7) selfAudit secret_exposure retorna blocked
section("7 — Self-Audit secret_exposure");
const secretExposure = await callWorker("POST", "/skills/propose", {
  skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
  selfAudit: {
    risk_level: "low",
    should_block: false,
    findings: [{ category: "secret_exposure", severity: "low" }],
  },
});
ok(secretExposure.status === 200, "7.1 status 200");
ok(secretExposure.data?.skill_execution?.status === "blocked", "7.2 status=blocked");
ok((secretExposure.data?.skill_execution?.reason || "").toLowerCase().includes("secret_exposure"), "7.3 reason cita secret_exposure");

// 8) conversa comum sem skill routing retorna not_applicable
section("8 — Conversa comum sem skill routing");
const conversation = await callWorker("POST", "/skills/propose", {
  intentClassification: { intent: "conversation", confidence: "high" },
  skillRouting: { matched: false, skill_id: null },
  chatContext: { session_id: "s1" },
});
ok(conversation.status === 200, "8.1 status 200");
ok(conversation.data?.skill_execution?.status === "not_applicable", "8.2 status=not_applicable");

// 9) responsePolicy com pausa/recusa sem skill roteada retorna not_applicable
section("9 — Response Policy pausa/recusa sem skill roteada");
const policyPause = await callWorker("POST", "/skills/propose", {
  responsePolicy: { should_refuse_or_pause: true },
  skillRouting: { matched: false, skill_id: null },
});
ok(policyPause.status === 200, "9.1 status 200");
ok(policyPause.data?.skill_execution?.status === "not_applicable", "9.2 status=not_applicable");

// 10) método GET em /skills/propose retorna 405 METHOD_NOT_ALLOWED
section("10 — GET /skills/propose retorna 405");
const getMethod = await callWorker("GET", "/skills/propose");
ok(getMethod.status === 405, "10.1 status 405");
ok(getMethod.data?.error === "METHOD_NOT_ALLOWED", "10.2 error=METHOD_NOT_ALLOWED");

// 11) JSON inválido retorna 400 INVALID_JSON
section("11 — JSON inválido retorna 400");
ok(invalidJsonForSideEffects.status === 400, "11.1 status 400");
ok(invalidJsonForSideEffects.data?.error === "INVALID_JSON", "11.2 error=INVALID_JSON");

// 12) erro mantém skill_execution seguro
section("12 — Erro mantém skill_execution seguro");
ok(invalidJsonForSideEffects.data?.skill_execution?.mode === "proposal", "12.1 mode=proposal");
ok(invalidJsonForSideEffects.data?.skill_execution?.status === "blocked", "12.2 status=blocked");
ok(invalidJsonForSideEffects.data?.skill_execution?.side_effects === false, "12.3 side_effects=false");

// 13) /skills/run continua inexistente
section("13 — /skills/run inexistente");
const skillsRun = await callWorker("POST", "/skills/run", { skill_id: "SYSTEM_MAPPER" });
ok(skillsRun.status === 404, "13.1 status 404");
ok(skillsRun.data?.path === "/skills/run", "13.2 path=/skills/run");

// 14) endpoint /skills/propose não retorna reply
section("14 — /skills/propose sem reply");
ok(!Object.prototype.hasOwnProperty.call(known.data || {}, "reply"), "14.1 sem campo reply");

// 15) endpoint /skills/propose não retorna use_planner
section("15 — /skills/propose sem use_planner");
ok(!Object.prototype.hasOwnProperty.call(known.data || {}, "use_planner"), "15.1 sem campo use_planner");

// 16) endpoint não usa KV
// 17) endpoint não chama fetch
// 18) endpoint não usa filesystem runtime
// 19) endpoint não chama LLM externo
section("16-19 — Endpoint sem KV/fetch/FS/LLM externo");
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
    const r = await callWorker(
      "POST",
      "/skills/propose",
      { skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" } },
      env,
    );
    ok(r.status === 200, "16.1 status 200");
    ok(kvSpy.calls.get === 0 && kvSpy.calls.put === 0 && kvSpy.calls.list === 0 && kvSpy.calls.delete === 0, "16.2 sem uso de KV");
    ok(fetchCalls === 0, "17.1 sem chamada fetch");
  } finally {
    globalThis.fetch = originalFetch;
  }

  ok(handlerSource.length > 0, "18.1 handler /skills/propose localizado");
  ok(!handlerSource.includes("readFileSync") && !handlerSource.includes("writeFileSync") && !handlerSource.includes("fs."), "18.2 sem filesystem runtime");
  ok(!handlerSource.includes("ENAVIA_BRAIN"), "16.3 handler sem ENAVIA_BRAIN");
  ok(!handlerSource.includes("fetch("), "17.2 handler sem fetch");
  const handlerLower = handlerSource.toLowerCase();
  ok(!handlerLower.includes("openai") && !handlerLower.includes("gpt-") && !handlerLower.includes("anthropic"), "19.1 handler sem LLM externo");
}

// 20) nv-enavia.js não contém rota /skills/run
section("20 — nv-enavia.js sem rota /skills/run");
ok(!workerSource.includes('path === "/skills/run"') && !workerSource.includes('url.pathname === "/skills/run"'), "20.1 rota /skills/run não existe");

// 21) contract-executor.js não foi alterado
// 22) wrangler.toml não foi alterado
section("21-22 — Arquivos proibidos não alterados");
{
  const changedSinceMain = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);

  ok(!changedSinceMain.includes("contract-executor.js"), "21.1 contract-executor.js ausente do diff vs origin/main");
  ok(!changedSinceMain.includes("wrangler.toml"), "22.1 wrangler.toml ausente do diff vs origin/main");

  const contractSource = readFileSync(contractExecutorPath, "utf-8");
  const wranglerSource = readFileSync(wranglerPath, "utf-8");
  ok(contractSource.length > 0, "21.2 contract-executor.js legível");
  ok(wranglerSource.length > 0, "22.2 wrangler.toml legível");
}

console.log(`\n${"=".repeat(60)}`);
console.log("PR72 — Prova formal do endpoint /skills/propose");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários obrigatórios passaram. ✅");
process.exit(0);
