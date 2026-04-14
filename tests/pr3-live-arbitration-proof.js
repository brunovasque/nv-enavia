// ============================================================================
// 🧪 PR3 — Live Arbitration Proof (TEST environment, real LLM)
//
// Este script prova ponta a ponta que a política de arbitração funciona
// com LLM real. Requer OPENAI_API_KEY real apontando para o worker em TEST.
//
// BLOQUEIO DECLARADO:
//   Este teste NÃO pode rodar no ambiente de CI/smoke deste repositório
//   porque não há OPENAI_API_KEY real disponível.
//   Para rodar em TEST:
//     1. Faça deploy do worker em ambiente TEST (wrangler deploy --env test)
//     2. Configure OPENAI_API_KEY real no worker
//     3. Execute: WORKER_URL=https://your-worker.workers.dev node tests/pr3-live-arbitration-proof.js
//
// GATE PM4 AUTORITATIVO (PR3 v2):
//   - Level A (simples) → planner BLOQUEADO em código (mesmo que LLM queira)
//   - Level B/C (estruturado) → planner FORÇADO em código (mesmo que LLM não queira)
//   - final_decision = 'planner_activated' (coerente) ou 'planner_forced_level_BC' (PM4 forçou)
//
// Casos testados:
//   Caso A: conversa simples / pergunta casual
//     → espera: planner_used=false, final_decision='planner_blocked_level_A'
//   Caso B: pedido claramente estruturado / multi-etapa
//     → espera: planner_used=true, final_decision='planner_activated' ou 'planner_forced_level_BC'
//     → reply é fala natural, NÃO um plano estruturado com Fase 1/Etapa 2
//   Caso C: borderline — pergunta ambígua
//     → espera: planner_used=false (na dúvida, PM4=A, conversa ganha)
//
// O caso B é o cenário que falhou no TEST anterior (LLM escrevia plano no reply,
// use_planner=false). Com PM4 autoritativo, planner_used deve ser true
// (PM4 forçou), e o reply deve ser natural (manual plan sanitizado).
// ============================================================================

const WORKER_URL = process.env.WORKER_URL || "http://localhost:8787";
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || "";

if (!OPENAI_API_KEY || OPENAI_API_KEY.startsWith("test-")) {
  console.log("⚠️  BLOQUEIO DECLARADO: OPENAI_API_KEY não configurada com chave real.");
  console.log("   Este teste requer chave real para provar o comportamento do LLM.");
  console.log("   Rode com: OPENAI_API_KEY=sk-... WORKER_URL=https://... node tests/pr3-live-arbitration-proof.js");
  console.log("   Todos os smoke tests deterministicos passam sem bloqueio (tests/pr3-tool-arbitration.smoke.test.js).");
  process.exit(0);
}

function manualPlanMatchCount(text) {
  const patterns = [
    /\bFase\s+\d+/ig, /\bEtapa\s+\d+/ig, /\bPasso\s+\d+/ig,
    /\bPhase\s+\d+/ig, /\bStep\s+\d+/ig, /^#{1,3}\s+\w/gm,
    /\bCritérios de aceite\b/ig, /\bCriteria\b.*:/ig,
  ];
  let count = 0;
  for (const p of patterns) {
    const matches = text.match(p);
    if (matches) count += matches.length;
  }
  return count;
}

async function callChat(message, context) {
  const res = await fetch(`${WORKER_URL}/chat/run`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, context, session_id: `pr3-live-${Date.now()}` }),
  });
  return res.json();
}

async function runLiveProof() {
  console.log("\n=== PR3 — Live Arbitration Proof (LLM real) ===");
  console.log(`Worker: ${WORKER_URL}\n`);

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
  // Caso A: Conversa simples / pergunta casual
  // Espera: planner_used=false, final_decision='planner_blocked_level_A'
  // =========================================================================
  console.log("Caso A: Conversa simples — 'oi, tudo bem?'");
  const caseA = await callChat("oi, tudo bem?");
  console.log("  → reply:", JSON.stringify(caseA.reply).slice(0, 100));
  console.log("  → planner_used:", caseA.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseA.telemetry?.arbitration));

  ok(caseA.ok === true, "Caso A: ok=true");
  ok(typeof caseA.reply === "string" && caseA.reply.length > 0, "Caso A: reply tem conteúdo");
  ok(caseA.planner_used === false, "Caso A: planner_used=false (PM4 bloqueou nível A)");
  ok(caseA.telemetry?.arbitration?.pm4_level === "A", "Caso A: pm4_level=A");
  ok(caseA.telemetry?.arbitration?.pm4_allows_planner === false, "Caso A: pm4_allows_planner=false");
  ok(caseA.telemetry?.arbitration?.final_decision === "planner_blocked_level_A",
     "Caso A: final_decision='planner_blocked_level_A'");
  ok(!caseA.reply.includes("next_action"), "Caso A: reply sem next_action");
  ok(!caseA.reply.includes("scope_summary"), "Caso A: reply sem scope_summary");
  ok(manualPlanMatchCount(caseA.reply) < 2, "Caso A: reply é natural (sem estrutura de plano)");

  // =========================================================================
  // Caso B: Pedido estruturado / multi-etapa
  // Espera: planner_used=true (PM4 força), final_decision indica B/C,
  //         reply é NATURAL (não um plano estruturado)
  // Este é o cenário que falhou antes: LLM escrevia plano no reply, use_planner=false.
  // Com PM4 autoritativo: planner_used=true garantido pelo gate.
  // Com manual plan sanitizer: reply substituído por fala natural.
  // =========================================================================
  console.log("\nCaso B: Pedido estruturado multi-etapa");
  const caseBMsg = "Preciso de um plano completo dividido em fases para migrar o nosso sistema de contratos para o novo banco de dados, com múltiplas etapas, critérios de aceite e pontos de revisão";
  const caseB = await callChat(caseBMsg);
  console.log("  → reply:", JSON.stringify(caseB.reply).slice(0, 150));
  console.log("  → planner_used:", caseB.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseB.telemetry?.arbitration));

  ok(caseB.ok === true, "Caso B: ok=true");
  ok(typeof caseB.reply === "string" && caseB.reply.length > 0, "Caso B: reply tem conteúdo");
  ok(caseB.planner_used === true, "Caso B: planner_used=true (PM4 forçou para nível B/C)");
  ok(["B", "C"].includes(caseB.telemetry?.arbitration?.pm4_level),
     "Caso B: pm4_level B ou C");
  ok(caseB.telemetry?.arbitration?.pm4_allows_planner === true, "Caso B: pm4_allows_planner=true");
  ok(
    caseB.telemetry?.arbitration?.final_decision === "planner_activated" ||
    caseB.telemetry?.arbitration?.final_decision === "planner_forced_level_BC",
    "Caso B: final_decision indica planner forçado ou ativado"
  );
  // Reply DEVE ser natural — não um plano estruturado
  ok(!caseB.reply.includes("next_action"), "Caso B: reply sem next_action");
  ok(!caseB.reply.includes("scope_summary"), "Caso B: reply sem scope_summary");
  ok(manualPlanMatchCount(caseB.reply) < 2,
     "Caso B: reply é natural (sem Fase 1/Etapa 2 na superfície)");

  // =========================================================================
  // Caso C: Borderline — pedido ambíguo
  // Espera: PM4 diz A, planner_used=false, reply natural
  // =========================================================================
  console.log("\nCaso C: Borderline — 'me ajuda com uma coisa'");
  const caseC = await callChat("me ajuda com uma coisa");
  console.log("  → reply:", JSON.stringify(caseC.reply).slice(0, 100));
  console.log("  → planner_used:", caseC.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseC.telemetry?.arbitration));

  ok(caseC.ok === true, "Caso C: ok=true");
  ok(typeof caseC.reply === "string" && caseC.reply.length > 0, "Caso C: reply tem conteúdo");
  ok(caseC.telemetry?.arbitration?.pm4_level === "A",
     "Caso C: pm4_level=A (borderline → simples → planner bloqueado)");
  ok(caseC.planner_used === false, "Caso C: planner_used=false");
  ok(manualPlanMatchCount(caseC.reply) < 2, "Caso C: reply é natural");

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n============================================================`);
  console.log(`Resultados: ${passed} passed, ${failed} failed`);
  console.log(`============================================================`);

  if (failed > 0) process.exit(1);
}

runLiveProof().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
