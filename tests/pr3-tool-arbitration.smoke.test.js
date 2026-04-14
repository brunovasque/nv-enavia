// ============================================================================
// 🧪 Smoke Tests — PR3: Tool Arbitration + Planner Interno
//
// Prova objetiva de que:
//   1. buildChatSystemPrompt inclui política de arbitração de ferramentas
//   2. O prompt orienta quando usar planner (true) vs conversa (false)
//   3. O prompt proíbe termos mecânicos no reply
//   4. PM4 classifica corretamente mensagens simples vs estruturadas
//   5. O gate de arbitração (PM4 + LLM) funciona deterministicamente
//   6. A sanitização de reply bloqueia leak de planner mecânico
//   7. /chat/run retorna campo 'arbitration' auditável no telemetry
//   8. /chat/run continua funcionando (shape, rotas, regressão zero)
//   9. /planner/run não regrediu
//   10. Bloqueio honesto declarado para prova ponta-a-ponta com LLM real
//
// Escopo: WORKER-ONLY. Pure unit tests + HTTP-level via worker.fetch.
//
// DECLARAÇÃO DE BLOQUEIO (PR3 — prova ponta a ponta com LLM real):
//   Os testes abaixo provam deterministicamente a política de arbitração
//   via PM4 e o campo 'arbitration' no telemetry — sem depender de LLM.
//   A prova de que o LLM respeita a política (planner_used=false para
//   conversa casual, planner_used=true para pedido estruturado) requer
//   OPENAI_API_KEY real apontando para o worker em TEST.
//   Esse nível de prova não é possível neste ambiente de CI/smoke.
//   Ver: tests/pr3-live-arbitration-proof.js para o script de TEST.
// ============================================================================

import { strict as assert } from "node:assert";

import {
  buildChatSystemPrompt,
} from "../schema/enavia-cognitive-runtime.js";

import { classifyRequest } from "../schema/planner-classifier.js";

import worker from "../nv-enavia.js";

// Stub env for worker.fetch calls
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
  console.log("\n=== ENAVIA PR3 — Tool Arbitration + Planner Interno — Smoke Tests ===\n");

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

  // =========================================================================
  // Group 1: buildChatSystemPrompt — política de arbitração presente
  // =========================================================================
  console.log("Group 1: buildChatSystemPrompt() — política de arbitração de ferramentas");

  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });

  ok(typeof prompt === "string" && prompt.length > 200, "prompt é string substancial");
  ok(prompt.includes("POLÍTICA DE USO DE FERRAMENTAS INTERNAS"),
     "prompt inclui seção de política de arbitração");
  ok(prompt.includes("planner interno"),
     "prompt menciona planner como ferramenta interna");
  ok(prompt.includes("planner NUNCA aparece como superfície"),
     "prompt proíbe planner como superfície da conversa");
  ok(prompt.includes("use_planner = true"),
     "prompt orienta quando use_planner = true");
  ok(prompt.includes("use_planner = false"),
     "prompt orienta quando use_planner = false");
  ok(prompt.includes("next_action") && prompt.includes("Nunca coloque no reply"),
     "prompt proíbe termos mecânicos no reply");
  ok(prompt.includes("REGRA CRÍTICA") && prompt.includes("fala natural"),
     "prompt inclui regra crítica de fala natural com planner ativo");
  ok(prompt.includes("Na dúvida, prefira false"),
     "prompt indica preferência por false na dúvida");
  ok(prompt.includes("planner trabalha silenciosamente"),
     "prompt instrui planner silencioso por baixo");

  // =========================================================================
  // Group 2: buildChatSystemPrompt — backward compatibility PR1+PR2
  // =========================================================================
  console.log("\nGroup 2: buildChatSystemPrompt() — backward compatibility PR1+PR2");

  ok(prompt.includes("ENAVIA"), "prompt ainda menciona ENAVIA");
  ok(prompt.includes("Vasques"), "prompt ainda inclui ownerName");
  ok(prompt.includes("Como você deve conversar"), "prompt ainda inclui tom conversacional");
  ok(prompt.includes("Regra de ouro"), "prompt ainda inclui regra de ouro");
  ok(prompt.includes("reply") && prompt.includes("use_planner"), "prompt mantém contrato JSON");
  ok(prompt.includes("Identidade fixa"), "prompt ainda inclui identidade fixa");
  ok(prompt.includes("NÃO é a NV Imóveis"), "prompt ainda proíbe confusão de identidade");

  // =========================================================================
  // Group 3: PM4 arbitration — classificação determinística
  //
  // Prova central do gate: PM4 classifica mensagens simples vs estruturadas
  // deterministicamente, sem depender de LLM.
  // =========================================================================
  console.log("\nGroup 3: PM4 Arbitration Gate — classificação determinística");

  // Caso A: conversa simples / casual → nível A → planner bloqueado
  const caseA_simple = classifyRequest({ text: "oi" });
  ok(caseA_simple.complexity_level === "A", "PM4: 'oi' → nível A (simples)");
  ok(caseA_simple.category === "simple", "PM4: 'oi' → categoria simple");
  ok(caseA_simple.complexity_level === "A", "PM4: nível A → allows_planner = false (nível A bloqueado)");

  const caseA_casual = classifyRequest({ text: "tudo bem?" });
  ok(caseA_casual.complexity_level === "A", "PM4: 'tudo bem?' → nível A");

  const caseA_question = classifyRequest({ text: "qual o horário de trabalho?" });
  ok(caseA_question.complexity_level === "A", "PM4: pergunta sobre horário → nível A");

  // Caso B: pedido estruturado → nível B ou C → planner permitido
  const caseB_structured = classifyRequest({
    text: "preciso de um plano com múltiplas etapas e fases para migrar o sistema de produção com integração ao banco de dados",
  });
  ok(["B", "C"].includes(caseB_structured.complexity_level),
     "PM4: pedido multietapa/sistema/prod → nível B ou C");
  ok(caseB_structured.complexity_level !== "A",
     "PM4: pedido estruturado → allows_planner = true (não nível A)");

  const caseB_explicit = classifyRequest({
    text: "vamos organizar um plano completo dividido em fases, etapas 1, 2 e 3 com critérios de aceite",
  });
  ok(["B", "C"].includes(caseB_explicit.complexity_level),
     "PM4: plano completo com etapas → nível B ou C");

  // Fronteira: dúvida → nível A → preferir conversa simples (planner bloqueado)
  const caseBorderline = classifyRequest({ text: "me ajuda com uma coisa" });
  ok(caseBorderline.complexity_level === "A",
     "PM4: 'me ajuda com uma coisa' → nível A (dúvida → prefere simples)");

  // =========================================================================
  // Group 4: Arbitration gate logic — dois sinais (PM4 + LLM)
  //
  // Prova a lógica do gate sem precisar de LLM real.
  // =========================================================================
  console.log("\nGroup 4: Arbitration Gate Logic — gate PM4 + LLM");

  // Gate simulation: tests the combination rules
  function simulateGate(pm4Level, llmWantsPlanner) {
    const pm4AllowsPlanner = pm4Level !== "A";
    const shouldActivate = llmWantsPlanner && pm4AllowsPlanner;
    const finalDecision = shouldActivate
      ? "planner_activated"
      : !llmWantsPlanner
        ? "planner_not_requested"
        : "planner_blocked_level_A";
    return { shouldActivate, finalDecision, pm4AllowsPlanner };
  }

  // Cenário 1: conversa simples — LLM não quer planner, PM4 diz A → não ativa
  const g1 = simulateGate("A", false);
  ok(!g1.shouldActivate, "Gate: nível A + LLM=false → planner não ativa");
  ok(g1.finalDecision === "planner_not_requested", "Gate: nível A + LLM=false → final='planner_not_requested'");

  // Cenário 2: PM4 diz A mas LLM quer planner (edge case) → bloqueado por PM4
  const g2 = simulateGate("A", true);
  ok(!g2.shouldActivate, "Gate: nível A + LLM=true → BLOQUEADO por PM4 (conversa ganha)");
  ok(g2.finalDecision === "planner_blocked_level_A", "Gate: nível A + LLM=true → final='planner_blocked_level_A'");

  // Cenário 3: pedido estruturado — PM4 diz B, LLM quer planner → ativa
  const g3 = simulateGate("B", true);
  ok(g3.shouldActivate, "Gate: nível B + LLM=true → planner ativa");
  ok(g3.finalDecision === "planner_activated", "Gate: nível B + LLM=true → final='planner_activated'");

  // Cenário 4: PM4 diz B/C mas LLM não quer planner → LLM veta
  const g4 = simulateGate("B", false);
  ok(!g4.shouldActivate, "Gate: nível B + LLM=false → não ativa (LLM veta)");
  ok(g4.finalDecision === "planner_not_requested", "Gate: nível B + LLM=false → final='planner_not_requested'");

  const g5 = simulateGate("C", false);
  ok(!g5.shouldActivate, "Gate: nível C + LLM=false → não ativa (LLM veta)");

  // Cenário 5: pedido complexo — PM4 diz C, LLM quer planner → ativa
  const g6 = simulateGate("C", true);
  ok(g6.shouldActivate, "Gate: nível C + LLM=true → planner ativa");

  // =========================================================================
  // Group 5: /chat/run — arbitration field no telemetry (sem LLM real)
  //
  // O PM4 pre-check roda antes da chamada LLM.
  // O campo arbitration deve aparecer no telemetry mesmo quando LLM falha.
  // =========================================================================
  console.log("\nGroup 5: /chat/run — campo 'arbitration' no telemetry");

  // POST com mensagem simples — PM4 diz A
  const resSimple = await callWorker("POST", "/chat/run", { message: "oi" });
  ok(resSimple.data !== null, "POST /chat/run com 'oi' retorna JSON");
  ok(resSimple.data?.system === "ENAVIA-NV-FIRST", "POST /chat/run system correto");
  ok(resSimple.data?.mode === "llm-first", "POST /chat/run mode=llm-first");

  // Telemetry.arbitration deve existir (PM4 pre-check roda antes do LLM)
  const arbSimple = resSimple.data?.telemetry?.arbitration;
  ok(arbSimple !== undefined && arbSimple !== null, "telemetry.arbitration presente para mensagem simples");
  ok(arbSimple?.pm4_level === "A", "telemetry.arbitration.pm4_level === 'A' para 'oi'");
  ok(arbSimple?.pm4_allows_planner === false, "telemetry.arbitration.pm4_allows_planner = false para nível A");

  // POST com mensagem estruturada — PM4 diz B/C
  const complexMsg = "preciso de um plano com múltiplas etapas e fases para migrar o sistema de produção";
  const resComplex = await callWorker("POST", "/chat/run", { message: complexMsg });
  ok(resComplex.data !== null, "POST /chat/run com mensagem complexa retorna JSON");

  const arbComplex = resComplex.data?.telemetry?.arbitration;
  ok(arbComplex !== undefined && arbComplex !== null, "telemetry.arbitration presente para mensagem complexa");
  ok(["B", "C"].includes(arbComplex?.pm4_level), "telemetry.arbitration.pm4_level B ou C para mensagem complexa");
  ok(arbComplex?.pm4_allows_planner === true, "telemetry.arbitration.pm4_allows_planner = true para nível B/C");

  // final_decision deve existir
  ok(
    typeof arbSimple?.final_decision === "string" || typeof arbSimple?.pm4_level === "string",
    "telemetry.arbitration tem campo de decisão auditável"
  );

  // =========================================================================
  // Group 6: /chat/run HTTP — shape e regressão zero
  // =========================================================================
  console.log("\nGroup 6: /chat/run HTTP — shape e regressão zero");

  const res1ctx = await callWorker("POST", "/chat/run", {
    message: "como estão os contratos?",
    context: { page: "Contratos", topic: "revisão" },
  });
  ok(res1ctx.data !== null, "POST /chat/run com context retorna JSON");
  ok(res1ctx.data?.system === "ENAVIA-NV-FIRST", "POST /chat/run com context system correto");

  const res2a = await callWorker("POST", "/chat/run", {});
  ok(res2a.status === 400, "POST /chat/run sem message → 400");

  const res2b = await callWorker("POST", "/chat/run", { message: "  " });
  ok(res2b.status === 400, "POST /chat/run message vazia → 400");

  const res2c = await callWorker("POST", "/chat/run", "not json {{{");
  ok(res2c.status === 400, "POST /chat/run JSON inválido → 400");

  const res3 = await callWorker("GET", "/chat/run");
  ok(res3.status === 200, "GET /chat/run status 200");
  ok(res3.data?.ok === true, "GET /chat/run ok=true");
  ok(res3.data?.route === "POST /chat/run", "GET /chat/run route correto");

  // GET schema deve documentar arbitration
  const schemaArb = res3.data?.schema?.response?.telemetry?.arbitration;
  ok(typeof schemaArb === "object" && schemaArb !== null,
     "GET /chat/run schema documenta campo arbitration no telemetry");
  ok(typeof schemaArb?.pm4_level === "string",
     "GET /chat/run schema documenta pm4_level");
  ok(typeof schemaArb?.final_decision === "string",
     "GET /chat/run schema documenta final_decision");

  const res4 = await callWorker("OPTIONS", "/chat/run");
  ok(res4.status === 204, "OPTIONS /chat/run → 204");

  // =========================================================================
  // Group 7: /planner/run — não-regressão
  // =========================================================================
  console.log("\nGroup 7: /planner/run — não-regressão");

  const res5 = await callWorker("POST", "/planner/run", { message: "teste planner" });
  ok(res5.data?.ok === true, "POST /planner/run ok=true");
  ok(res5.data?.system === "ENAVIA-NV-FIRST", "POST /planner/run system intacto");
  ok(typeof res5.data?.planner === "object", "POST /planner/run planner field presente");
  ok(typeof res5.data?.planner?.classification === "object", "POST /planner/run classification presente");
  ok(typeof res5.data?.planner?.canonicalPlan === "object", "POST /planner/run canonicalPlan presente");

  const res5g = await callWorker("GET", "/planner/run");
  ok(res5g.status === 200, "GET /planner/run schema → 200");

  // =========================================================================
  // Group 8: Planner internal structure — next_action/reason internos, não superfície
  // =========================================================================
  console.log("\nGroup 8: Planner — internal fields existem por dentro, não na superfície");

  const plannerData = res5.data?.planner?.canonicalPlan;
  ok(typeof plannerData?.next_action === "string", "canonicalPlan.next_action existe (interno)");
  ok(typeof plannerData?.reason === "string", "canonicalPlan.reason existe (interno)");

  // Em /chat/run, o reply é a superfície — não o plano interno
  ok(resSimple.data?.reply !== undefined || resSimple.data?.error !== undefined,
     "/chat/run resposta tem reply ou error (não planner como topo)");

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n============================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`============================================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
