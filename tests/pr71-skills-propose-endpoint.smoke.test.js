// ============================================================================
// 🧪 PR71 — Smoke test: Endpoint /skills/propose (read-only)
//
// Run: node tests/pr71-skills-propose-endpoint.smoke.test.js
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

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
  const calls = { get: 0, put: 0, list: 0 };
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

// 1) POST /skills/propose com skill conhecida retorna mode=proposal e status=proposed
section("1 — Skill conhecida retorna proposta");
{
  const r = await callWorker("POST", "/skills/propose", {
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    intentClassification: { intent: "system_state_question" },
    selfAudit: { risk_level: "low", should_block: false, findings: [] },
    responsePolicy: { should_refuse_or_pause: false },
    chatContext: { channel: "chat" },
  });

  ok(r.status === 200, "1.1 status 200");
  ok(r.data?.ok === true, "1.2 ok=true");
  ok(r.data?.route === "POST /skills/propose", "1.3 route correto");
  ok(r.data?.skill_execution?.mode === "proposal", "1.4 mode=proposal");
  ok(r.data?.skill_execution?.status === "proposed", "1.5 status=proposed");
  ok(r.data?.skill_execution?.requires_approval === true, "1.6 requires_approval=true");
  ok(r.data?.skill_execution?.side_effects === false, "1.7 side_effects=false");
}

// 2) skill desconhecida retorna blocked
section("2 — Skill desconhecida retorna blocked");
{
  const r = await callWorker("POST", "/skills/propose", {
    skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
  });

  ok(r.status === 200, "2.1 status 200");
  ok(r.data?.skill_execution?.status === "blocked", "2.2 status=blocked");
  ok((r.data?.skill_execution?.reason || "").toLowerCase().includes("allowlist"), "2.3 deny-by-default (allowlist)");
  ok(r.data?.skill_execution?.requires_approval === false, "2.4 blocked => requires_approval=false");
}

// 3) selfAudit risk_level=blocking retorna blocked
section("3 — selfAudit risk_level=blocking bloqueia");
{
  const r = await callWorker("POST", "/skills/propose", {
    skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
    selfAudit: { risk_level: "blocking", should_block: false, findings: [] },
  });

  ok(r.status === 200, "3.1 status 200");
  ok(r.data?.skill_execution?.status === "blocked", "3.2 status=blocked");
}

// 4) selfAudit secret_exposure retorna blocked
section("4 — selfAudit secret_exposure bloqueia");
{
  const r = await callWorker("POST", "/skills/propose", {
    skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
    selfAudit: {
      risk_level: "low",
      should_block: false,
      findings: [{ category: "secret_exposure", severity: "low" }],
    },
  });

  ok(r.status === 200, "4.1 status 200");
  ok(r.data?.skill_execution?.status === "blocked", "4.2 status=blocked");
  ok((r.data?.skill_execution?.reason || "").includes("secret_exposure"), "4.3 reason cita secret_exposure");
}

// 5) conversa comum sem skill routing retorna not_applicable
section("5 — Sem skill routing retorna not_applicable");
{
  const r = await callWorker("POST", "/skills/propose", {
    intentClassification: { intent: "conversation", confidence: "high" },
    skillRouting: { matched: false, skill_id: null },
    chatContext: { session_id: "s1" },
  });

  ok(r.status === 200, "5.1 status 200");
  ok(r.data?.skill_execution?.status === "not_applicable", "5.2 status=not_applicable");
  ok(r.data?.skill_execution?.requires_approval === false, "5.3 not_applicable => requires_approval=false");
}

// 6) método diferente de POST é bloqueado/erro controlado
section("6 — Método diferente de POST é bloqueado");
{
  const r = await callWorker("GET", "/skills/propose", undefined);

  ok(r.status === 405, "6.1 status 405");
  ok(r.data?.ok === false, "6.2 ok=false");
  ok(r.data?.error === "METHOD_NOT_ALLOWED", "6.3 erro controlado METHOD_NOT_ALLOWED");
  ok(Array.isArray(r.data?.allowed_methods) && r.data.allowed_methods.includes("POST"), "6.4 allowed_methods inclui POST");
}

// 7) JSON inválido é bloqueado/erro controlado
section("7 — JSON inválido retorna erro controlado");
{
  const r = await callWorker("POST", "/skills/propose", "{ invalid-json", BASE_ENV);

  ok(r.status === 400, "7.1 status 400");
  ok(r.data?.ok === false, "7.2 ok=false");
  ok(r.data?.error === "INVALID_JSON", "7.3 erro controlado INVALID_JSON");
  ok(r.data?.skill_execution?.mode === "proposal", "7.4 mode=proposal no erro");
  ok(r.data?.skill_execution?.status === "blocked", "7.5 status=blocked no erro");
  ok(r.data?.skill_execution?.side_effects === false, "7.6 side_effects=false no erro");
}

// 8) /skills/run continua inexistente
section("8 — /skills/run continua inexistente");
{
  const r = await callWorker("POST", "/skills/run", { skill_id: "SYSTEM_MAPPER" });

  ok(r.status === 404, "8.1 status 404");
  ok(r.data?.ok === false, "8.2 ok=false");
  ok(r.data?.path === "/skills/run", "8.3 path=/skills/run no fallback");
}

// 9) endpoint não altera reply/use_planner
section("9 — Endpoint não altera reply/use_planner");
{
  const r = await callWorker("POST", "/skills/propose", {
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
  });

  const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
  ok(!("reply" in (r.data || {})), "9.1 resposta de /skills/propose não inclui reply");
  ok(!("use_planner" in (r.data || {})), "9.2 resposta de /skills/propose não inclui use_planner");
  ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "9.3 integração de /chat/run com skill_execution aditiva preservada");
}

// 10) endpoint não usa KV/fetch/filesystem runtime/LLM externo
section("10 — Endpoint sem KV/fetch/filesystem/LLM externo");
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
    const r = await callWorker("POST", "/skills/propose", {
      skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    }, env);

    ok(r.status === 200, "10.1 status 200");
    ok(fetchCalls === 0, "10.2 sem chamadas fetch");
    ok(kvSpy.calls.get === 0 && kvSpy.calls.put === 0 && kvSpy.calls.list === 0, "10.3 sem uso de KV");

    const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
    const handlerSource = extractHandleSkillsPropose(workerSource);
    ok(handlerSource.length > 0, "10.4 handler /skills/propose encontrado no source");
    ok(!handlerSource.includes("ENAVIA_BRAIN"), "10.5 handler sem ENAVIA_BRAIN");
    ok(!handlerSource.includes("fetch("), "10.6 handler sem fetch");
    ok(!handlerSource.includes("readFileSync") && !handlerSource.includes("writeFileSync"), "10.7 handler sem filesystem runtime");
    ok(!handlerSource.toLowerCase().includes("openai") && !handlerSource.toLowerCase().includes("gpt-"), "10.8 handler sem LLM externo");
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log("PR71 — Endpoint /skills/propose — Smoke Test");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários obrigatórios passaram. ✅");
process.exit(0);
