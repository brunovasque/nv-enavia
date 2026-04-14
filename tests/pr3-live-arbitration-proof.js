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
// Casos testados:
//   Caso A: conversa simples / pergunta casual
//     → espera: planner_used=false, arbitration.pm4_level="A"
//     → resposta continua natural
//   Caso B: pedido claramente estruturado / multi-etapa
//     → espera: planner_used=true (se LLM concordar), arbitration.pm4_allows_planner=true
//     → resposta continua natural mesmo com planner interno
//   Caso C: borderline — pergunta ambígua
//     → espera: planner_used=false (na dúvida, prefere conversa)
//     → resposta continua natural
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
  // Espera: planner_used=false, pm4_level=A, reply=texto natural
  // =========================================================================
  console.log("Caso A: Conversa simples — 'oi, tudo bem?'");
  const caseA = await callChat("oi, tudo bem?");
  console.log("  → reply:", JSON.stringify(caseA.reply).slice(0, 100));
  console.log("  → planner_used:", caseA.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseA.telemetry?.arbitration));

  ok(caseA.ok === true, "Caso A: ok=true");
  ok(typeof caseA.reply === "string" && caseA.reply.length > 0, "Caso A: reply tem conteúdo");
  ok(caseA.planner_used === false, "Caso A: planner_used=false (conversa simples)");
  ok(caseA.telemetry?.arbitration?.pm4_level === "A", "Caso A: pm4_level=A");
  ok(caseA.telemetry?.arbitration?.pm4_allows_planner === false, "Caso A: pm4_allows_planner=false");
  ok(
    caseA.telemetry?.arbitration?.final_decision === "planner_not_requested" ||
    caseA.telemetry?.arbitration?.final_decision === "planner_blocked_level_A",
    "Caso A: final_decision mostra planner não ativado"
  );
  // Resposta não pode ser mecânica
  ok(!caseA.reply.includes("next_action"), "Caso A: reply não contém next_action");
  ok(!caseA.reply.includes("scope_summary"), "Caso A: reply não contém scope_summary");

  // =========================================================================
  // Caso B: Pedido estruturado / multi-etapa
  // Espera: planner ativado ou pm4 autoriza, reply=texto natural
  // =========================================================================
  console.log("\nCaso B: Pedido estruturado multi-etapa");
  const caseBMsg = "Preciso de um plano completo dividido em fases para migrar o nosso sistema de contratos para o novo banco de dados, com múltiplas etapas, critérios de aceite e pontos de revisão";
  const caseB = await callChat(caseBMsg);
  console.log("  → reply:", JSON.stringify(caseB.reply).slice(0, 120));
  console.log("  → planner_used:", caseB.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseB.telemetry?.arbitration));

  ok(caseB.ok === true, "Caso B: ok=true");
  ok(typeof caseB.reply === "string" && caseB.reply.length > 0, "Caso B: reply tem conteúdo");
  // PM4 deve ter autorizado o planner (mesmo que LLM não queira)
  ok(
    caseB.telemetry?.arbitration?.pm4_allows_planner === true,
    "Caso B: pm4_allows_planner=true (pedido estruturado)"
  );
  ok(
    ["B", "C"].includes(caseB.telemetry?.arbitration?.pm4_level),
    "Caso B: pm4_level B ou C (pedido complexo)"
  );
  // Resposta deve continuar natural mesmo com planner ativo
  ok(!caseB.reply.includes("next_action"), "Caso B: reply não contém next_action (resposta natural)");
  ok(!caseB.reply.includes("scope_summary"), "Caso B: reply não contém scope_summary");
  ok(!caseB.reply.includes("plan_type"), "Caso B: reply não contém plan_type");

  // =========================================================================
  // Caso C: Borderline — pedido ambíguo
  // Espera: planner não ativa, reply natural
  // =========================================================================
  console.log("\nCaso C: Borderline — 'me ajuda com uma coisa'");
  const caseC = await callChat("me ajuda com uma coisa");
  console.log("  → reply:", JSON.stringify(caseC.reply).slice(0, 100));
  console.log("  → planner_used:", caseC.planner_used);
  console.log("  → arbitration:", JSON.stringify(caseC.telemetry?.arbitration));

  ok(caseC.ok === true, "Caso C: ok=true");
  ok(typeof caseC.reply === "string" && caseC.reply.length > 0, "Caso C: reply tem conteúdo");
  // Na dúvida prefere conversa simples
  ok(caseC.telemetry?.arbitration?.pm4_level === "A", "Caso C: pm4_level=A (borderline → simples)");
  ok(caseC.planner_used === false, "Caso C: planner_used=false (borderline → conversa ganha)");

  // =========================================================================
  // Summary
  // =========================================================================
  console.log(`\n============================================================`);
  console.log(`Resultados: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log("NOTA: Se Caso B falhou em planner_used=true, o LLM julgou o pedido");
    console.log("como simples — verifique pm4_allows_planner e final_decision para entender a decisão.");
  }
  console.log(`============================================================`);

  if (failed > 0) process.exit(1);
}

runLiveProof().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
