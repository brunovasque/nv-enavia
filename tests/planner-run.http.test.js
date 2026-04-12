// ============================================================================
// 🧪 HTTP-Level Tests — POST /planner/run (rota real via worker.fetch)
//
// Run: node tests/planner-run.http.test.js
//
// Prova objetiva da rota HTTP real /planner/run chamando worker.fetch()
// diretamente com objetos Request/Response nativos do Node.js 18+.
//
// Também prova não-regressão do endpoint antigo do chat (POST /).
//
// Tests:
//   Group 1: POST /planner/run — payload válido (shape contratual completo)
//   Group 2: POST /planner/run — erros de input (400)
//   Group 3: GET /planner/run — schema route
//   Group 4: OPTIONS /planner/run — CORS preflight
//   Group 5: withCORS — headers obrigatórios em todas as respostas
//   Group 6: Não-regressão do chat (POST /)
// ============================================================================

import worker from "../nv-enavia.js";

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method, path, body) {
  const init = { method };
  if (body !== undefined) {
    init.headers = { "Content-Type": "application/json" };
    init.body = body;
  }
  return new Request(`http://localhost${path}`, init);
}

async function callWorker(method, path, body) {
  const req = makeRequest(method, path, body);
  return await worker.fetch(req, {}, {});
}

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

async function runTests() {
  console.log("\n=== ENAVIA /planner/run — HTTP-Level Tests (worker.fetch) ===\n");

  // -------------------------------------------------------------------------
  // Group 1: POST /planner/run — payload válido
  // -------------------------------------------------------------------------
  console.log("Group 1: POST /planner/run — payload válido");

  const validBody = JSON.stringify({ message: "Quero ver os logs do worker" });
  const res1 = await callWorker("POST", "/planner/run", validBody);
  const body1 = await res1.json();

  assert(res1.status === 200, "status HTTP 200");
  assert(body1.ok === true, "ok === true");
  assert(body1.system === "ENAVIA-NV-FIRST", "system === ENAVIA-NV-FIRST");
  assert(typeof body1.timestamp === "number" && body1.timestamp > 0, "timestamp é number > 0");
  assert(body1.input === "Quero ver os logs do worker", "input ecoa a mensagem enviada");
  assert(typeof body1.planner === "object" && body1.planner !== null, "planner é object");
  assert(typeof body1.telemetry === "object" && body1.telemetry !== null, "telemetry é object");

  // planner fields
  assert(typeof body1.planner.classification === "object", "planner.classification presente");
  assert(typeof body1.planner.canonicalPlan === "object", "planner.canonicalPlan presente");
  assert(typeof body1.planner.gate === "object", "planner.gate presente");
  assert(typeof body1.planner.bridge === "object", "planner.bridge presente");
  assert(typeof body1.planner.memoryConsolidation === "object", "planner.memoryConsolidation presente");
  assert(typeof body1.planner.outputMode === "string", "planner.outputMode é string");
  assert(
    ["quick_reply", "tactical_plan", "formal_contract"].includes(body1.planner.outputMode),
    "planner.outputMode é um dos 3 valores válidos"
  );

  // telemetry fields
  assert(typeof body1.telemetry.duration_ms === "number", "telemetry.duration_ms é number");
  assert(body1.telemetry.pipeline === "PM4→PM5→PM6→PM7→PM8→PM9", "telemetry.pipeline correto");

  // classification correctness
  assert(body1.planner.classification.complexity_level === "A", "classificação nível A para input simples");
  assert(body1.planner.gate.can_proceed === true, "gate libera nível A");
  assert(body1.planner.gate.gate_status === "approved_not_required", "gate_status correto para A");
  assert(body1.planner.outputMode === "quick_reply", "outputMode quick_reply para nível A");

  // JSON must be serializable (roundtrip)
  const roundtrip = JSON.parse(JSON.stringify(body1));
  assert(roundtrip.ok === true, "response é JSON serializável (roundtrip ok)");

  // -------------------------------------------------------------------------
  // Group 1b: POST /planner/run — nível C (complexo com gate bloqueante)
  // -------------------------------------------------------------------------
  console.log("\nGroup 1b: POST /planner/run — nível C (gate bloqueante)");

  const complexBody = JSON.stringify({
    message: "Redesenhar toda a arquitetura, migrar banco de dados em fases, integrar pipelines múltiplos com compliance e risco alto",
    session_id: "sess-abc-123",
    context: { mentions_prod: true, known_dependencies: ["supabase", "cloudflare"] }
  });
  const resC = await callWorker("POST", "/planner/run", complexBody);
  const bodyC = await resC.json();

  assert(resC.status === 200, "status HTTP 200 (nível C)");
  assert(bodyC.ok === true, "ok === true (nível C)");
  assert(bodyC.planner.classification.complexity_level === "C", "classificação nível C");
  assert(bodyC.planner.gate.gate_status === "approval_required", "gate bloqueia para C");
  assert(bodyC.planner.gate.can_proceed === false, "can_proceed === false para C");
  assert(bodyC.planner.bridge.bridge_status === "blocked_by_gate", "bridge blocked_by_gate");
  assert(bodyC.planner.outputMode === "formal_contract", "outputMode formal_contract para C");
  assert(bodyC.telemetry.session_id === "sess-abc-123", "session_id passado para telemetry");

  // -------------------------------------------------------------------------
  // Group 2: POST /planner/run — erros de input (400)
  // -------------------------------------------------------------------------
  console.log("\nGroup 2: POST /planner/run — erros de input (400)");

  // 2a: sem message
  const res2a = await callWorker("POST", "/planner/run", JSON.stringify({}));
  const body2a = await res2a.json();
  assert(res2a.status === 400, "status 400 quando message ausente");
  assert(body2a.ok === false, "ok === false quando message ausente");
  assert(typeof body2a.error === "string", "error é string quando message ausente");

  // 2b: message string vazia
  const res2b = await callWorker("POST", "/planner/run", JSON.stringify({ message: "  " }));
  const body2b = await res2b.json();
  assert(res2b.status === 400, "status 400 quando message é string vazia");
  assert(body2b.ok === false, "ok === false quando message é string vazia");

  // 2c: JSON inválido
  const res2c = await callWorker("POST", "/planner/run", "this is not json {{{");
  const body2c = await res2c.json();
  assert(res2c.status === 400, "status 400 quando body não é JSON válido");
  assert(body2c.ok === false, "ok === false quando body não é JSON válido");
  assert(typeof body2c.error === "string", "error é string quando JSON inválido");

  // -------------------------------------------------------------------------
  // Group 3: GET /planner/run — schema route
  // -------------------------------------------------------------------------
  console.log("\nGroup 3: GET /planner/run — schema route");

  const res3 = await callWorker("GET", "/planner/run");
  const body3 = await res3.json();

  assert(res3.status === 200, "GET /planner/run status 200");
  assert(body3.ok === true, "GET /planner/run ok === true");
  assert(body3.route === "POST /planner/run", "route field presente");
  assert(typeof body3.description === "string", "description é string");
  assert(typeof body3.schema === "object", "schema object presente");
  assert(typeof body3.schema.request === "object", "schema.request presente");
  assert(typeof body3.schema.response === "object", "schema.response presente");
  assert(typeof body3.schema.response.planner === "object", "schema.response.planner nested presente");
  assert(typeof body3.schema.response.telemetry === "object", "schema.response.telemetry presente");

  // -------------------------------------------------------------------------
  // Group 4: OPTIONS /planner/run — CORS preflight
  // -------------------------------------------------------------------------
  console.log("\nGroup 4: OPTIONS /planner/run — CORS preflight");

  const res4 = await callWorker("OPTIONS", "/planner/run");
  assert(res4.status === 204, "OPTIONS status 204");
  assert(
    res4.headers.get("access-control-allow-origin") === "*",
    "OPTIONS access-control-allow-origin: *"
  );

  // -------------------------------------------------------------------------
  // Group 5: withCORS — headers aplicados em todas as rotas planner
  // -------------------------------------------------------------------------
  console.log("\nGroup 5: withCORS — headers obrigatórios em todas as respostas");

  // GET, POST válido, POST 400 — todos devem ter CORS
  assert(
    res3.headers.get("access-control-allow-origin") === "*",
    "GET /planner/run tem access-control-allow-origin: *"
  );
  assert(
    res1.headers.get("access-control-allow-origin") === "*",
    "POST 200 tem access-control-allow-origin: *"
  );
  assert(
    res2a.headers.get("access-control-allow-origin") === "*",
    "POST 400 tem access-control-allow-origin: *"
  );
  assert(
    res1.headers.get("content-type")?.includes("application/json"),
    "POST 200 content-type: application/json"
  );
  assert(
    res2a.headers.get("content-type")?.includes("application/json"),
    "POST 400 content-type: application/json"
  );
  assert(
    res3.headers.get("content-type")?.includes("application/json"),
    "GET 200 content-type: application/json"
  );

  // -------------------------------------------------------------------------
  // Group 6: Não-regressão do chat — POST / ainda roteia para handleChatRequest
  // -------------------------------------------------------------------------
  console.log("\nGroup 6: Não-regressão do chat (POST /)");

  // Com env vazio, o chat vai falhar ao tentar acessar env.SUPABASE_URL (sem mock).
  // O importante é:
  //   a) a rota POST / ainda roteia para handleChatRequest (e não para o planner)
  //   b) a resposta de erro tem o shape correto do chat handler: ok, error, telemetry
  //   c) status code é 500 (não 404, não 400 — chat recebeu o request)
  //   d) o planner/run em /planner/run NÃO interceptou o POST /
  const chatRes = await callWorker("POST", "/", JSON.stringify({ message: "hello" }));
  const chatBody = await chatRes.json();

  assert(chatRes.status === 500, "POST / retorna 500 quando env vazio (chat handler alcançado)");
  assert(chatBody.ok === false, "POST / chat ok === false com env vazio");
  assert(typeof chatBody.error === "string", "POST / chat error é string");
  assert(typeof chatBody.telemetry === "object", "POST / chat telemetry presente — shape do handler intacto");
  assert(
    chatBody.error === "Falha interna no handler de chat NV-ENAVIA.",
    "POST / chat retorna mensagem de erro canônica do handleChatRequest"
  );

  // Garantir que POST /planner/run NÃO vaza para o chat
  const plannerPostRes = await callWorker("POST", "/planner/run", JSON.stringify({ message: "teste" }));
  const plannerPostBody = await plannerPostRes.json();
  assert(plannerPostBody.system === "ENAVIA-NV-FIRST", "POST /planner/run NÃO cai no chat handler");
  assert(!("error" in plannerPostBody && plannerPostBody.error?.includes("chat")), "planner response não contém erro de chat");

  // Garantir que POST / NÃO retorna dados do planner
  assert(!("planner" in chatBody), "POST / chat response NÃO contém campo planner");
  assert(!("system" in chatBody) || chatBody.system !== "ENAVIA-NV-FIRST", "POST / chat NÃO usa shape do planner");

  // CORS do chat também intacto
  assert(
    chatRes.headers.get("access-control-allow-origin") === "*",
    "POST / chat tem access-control-allow-origin: * (withCORS intacto no chat)"
  );

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("Fatal error in HTTP tests:", err);
  process.exit(1);
});
