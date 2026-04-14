// ============================================================================
// 🧪 HTTP-Level Tests — POST /chat/run (rota LLM-first via worker.fetch)
//
// Prova objetiva da rota HTTP real /chat/run chamando worker.fetch()
// com Request real e env stub mínimo.
//
// Grupos:
//   Group 1: POST /chat/run — payload válido (shape LLM-first)
//   Group 2: POST /chat/run — erros de input (400)
//   Group 3: GET /chat/run — schema route
//   Group 4: OPTIONS /chat/run — CORS preflight
//   Group 5: /planner/run continua funcional (não-regressão)
// ============================================================================

import { strict as assert } from "node:assert";

// Import the worker directly
import worker from "../nv-enavia.js";

// Stub env mínimo para o worker
const stubEnv = {
  ENAVIA_MODE: "supervised",
  OPENAI_API_KEY: "test-key-fake",
  OPENAI_MODEL: "gpt-4.1-mini",
  OWNER: "Vasques",
  SYSTEM_NAME: "ENAVIA",
  ENAVIA_BRAIN: {
    get: async () => null,
    put: async () => {},
    list: async () => ({ keys: [] }),
  },
  SUPABASE_URL: "https://test.supabase.co",
  SUPABASE_BUCKET: "test-bucket",
};

async function callWorker(method, path, body) {
  const url = `https://worker.test${path}`;
  const opts = { method, headers: { "Content-Type": "application/json" } };
  if (body) opts.body = typeof body === "string" ? body : JSON.stringify(body);
  const res = await worker.fetch(new Request(url, opts), stubEnv, {});
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

async function runTests() {
  console.log("\n=== ENAVIA /chat/run — HTTP-Level Tests (worker.fetch) ===\n");

  let passed = 0;
  let failed = 0;

  function ok(condition, label) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}`);
      failed++;
    }
  }

  // Group 1: POST /chat/run — payload válido
  // Note: without a real OpenAI key, the LLM call will fail.
  // We verify the route is reached and the error shape is correct (500, not 400/404).
  console.log("Group 1: POST /chat/run — rota alcançada com payload válido");

  const res1 = await callWorker("POST", "/chat/run", { message: "oi" });
  // Without real OPENAI_API_KEY, we expect 500 (LLM call fails) but route reached
  ok(res1.data !== null, "POST /chat/run retorna JSON válido");
  ok(res1.data?.system === "ENAVIA-NV-FIRST", "POST /chat/run system=ENAVIA-NV-FIRST");
  ok(res1.data?.mode === "llm-first", "POST /chat/run mode=llm-first");
  ok(typeof res1.data?.telemetry === "object", "POST /chat/run telemetry presente");

  // Group 2: POST /chat/run — erros de input (400)
  console.log("\nGroup 2: POST /chat/run — erros de input (400)");

  const res2a = await callWorker("POST", "/chat/run", {});
  ok(res2a.status === 400, "POST /chat/run sem message → 400");
  ok(res2a.data?.ok === false, "POST /chat/run sem message → ok=false");

  const res2b = await callWorker("POST", "/chat/run", { message: "  " });
  ok(res2b.status === 400, "POST /chat/run message vazia → 400");

  const res2c = await callWorker("POST", "/chat/run", "this is not json {{{");
  ok(res2c.status === 400, "POST /chat/run JSON inválido → 400");
  ok(res2c.data?.ok === false, "POST /chat/run JSON inválido → ok=false");

  // Group 3: GET /chat/run — schema route
  console.log("\nGroup 3: GET /chat/run — schema route");

  const res3 = await callWorker("GET", "/chat/run");
  ok(res3.status === 200, "GET /chat/run status 200");
  ok(res3.data?.ok === true, "GET /chat/run ok=true");
  ok(res3.data?.route === "POST /chat/run", "GET /chat/run route field correto");
  ok(typeof res3.data?.schema === "object", "GET /chat/run schema presente");
  ok(res3.data?.schema?.response?.mode === "string — 'llm-first'", "GET /chat/run schema documenta modo llm-first");

  // Group 4: OPTIONS /chat/run — CORS preflight
  console.log("\nGroup 4: OPTIONS /chat/run — CORS preflight");

  const res4 = await callWorker("OPTIONS", "/chat/run");
  ok(res4.status === 204, "OPTIONS /chat/run → 204");
  const corsHeader = res4.headers.get("access-control-allow-origin");
  ok(corsHeader === "*", "OPTIONS /chat/run CORS allow-origin=*");

  // Group 5: /planner/run continua funcional (não-regressão)
  console.log("\nGroup 5: /planner/run continua funcional (não-regressão)");

  const res5 = await callWorker("POST", "/planner/run", { message: "teste planner" });
  ok(res5.data?.ok === true, "POST /planner/run continua retornando ok=true");
  ok(res5.data?.system === "ENAVIA-NV-FIRST", "POST /planner/run system intacto");
  ok(typeof res5.data?.planner === "object", "POST /planner/run planner field presente");
  ok(typeof res5.data?.planner?.classification === "object", "POST /planner/run classification presente");
  ok(typeof res5.data?.planner?.canonicalPlan === "object", "POST /planner/run canonicalPlan presente");
  ok(typeof res5.data?.planner?.gate === "object", "POST /planner/run gate presente");

  const res5g = await callWorker("GET", "/planner/run");
  ok(res5g.status === 200, "GET /planner/run schema route → 200");
  ok(res5g.data?.route === "POST /planner/run", "GET /planner/run route field intacto");

  // Summary
  console.log(`\n============================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`============================================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
