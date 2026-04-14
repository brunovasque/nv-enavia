// ============================================================================
// 🧪 Smoke Tests — PR2: Chat Orchestrator LLM-First
//
// Prova objetiva de que:
//   1. buildChatSystemPrompt gera prompt conversacional completo
//   2. O prompt usa identidade da PR1 de forma viva (não decorativa)
//   3. O prompt inclui tom conversacional explícito
//   4. O prompt não confunde ENAVIA com Enova/NV Imóveis
//   5. O prompt injeta contexto dinâmico quando fornecido
//   6. O prompt mantém contrato JSON {reply, use_planner}
//   7. O prompt NÃO sufoca a fala com instruções mecânicas excessivas
//   8. /chat/run continua funcionando (shape, rotas, regressão zero)
//
// Escopo: WORKER-ONLY. Pure unit tests + HTTP-level via worker.fetch.
// ============================================================================

import { strict as assert } from "node:assert";

import {
  buildCognitivePromptBlock,
  buildChatSystemPrompt,
} from "../schema/enavia-cognitive-runtime.js";

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
  console.log("\n=== ENAVIA PR2 — Chat Orchestrator LLM-First — Smoke Tests ===\n");

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
  // Group 1: buildChatSystemPrompt — prompt conversacional completo
  // =========================================================================
  console.log("Group 1: buildChatSystemPrompt() — geração do prompt conversacional");

  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });

  ok(typeof prompt === "string" && prompt.length > 200, "prompt é string substancial (>200 chars)");
  ok(prompt.includes("ENAVIA"), "prompt menciona ENAVIA");
  ok(prompt.includes("Vasques"), "prompt inclui ownerName");

  // === Identidade viva ===
  ok(prompt.includes("Inteligência operacional"), "prompt usa role da identidade canônica");
  ok(prompt.includes("NV Imóveis"), "prompt menciona NV Imóveis como empresa");

  // === Tom conversacional ===
  ok(prompt.includes("Como você deve conversar"), "prompt inclui seção de tom conversacional");
  ok(prompt.includes("natural") || prompt.includes("humana"), "prompt instrui fala natural/humana");
  ok(prompt.includes("Adapte o tom"), "prompt instrui adaptação de tom ao contexto");
  ok(prompt.includes("português do Brasil"), "prompt instrui PT-BR");

  // === Não confunde identidade ===
  ok(!prompt.includes("Você é a Enova"), "prompt NÃO diz 'Você é a Enova'");
  ok(!prompt.includes("Você é a NV Imóveis"), "prompt NÃO diz 'Você é a NV Imóveis'");
  ok(!prompt.includes("da NV Imóveis") ||
     prompt.includes("A empresa dele é a NV Imóveis"),
     "prompt NÃO apresenta ENAVIA como 'da NV Imóveis' na abertura de identidade");
  ok(prompt.includes("ENAVIA — Inteligência operacional"),
     "prompt abre com ENAVIA como inteligência autônoma");
  ok(prompt.includes("A empresa dele é a NV Imóveis"),
     "prompt posiciona NV Imóveis como empresa do operador, não como identidade da ENAVIA");
  ok(prompt.includes("NÃO é a NV Imóveis"),
     "prompt proíbe explicitamente ENAVIA de se identificar como NV Imóveis");
  ok(prompt.includes("sou a assistente da NV Imóveis"),
     "prompt contém guardrail explícito contra 'sou a assistente da NV Imóveis'");
  ok(prompt.includes("Identidade fixa"),
     "prompt inclui seção de identidade fixa no tom conversacional");

  // === Capacidades reais ===
  ok(prompt.includes("O que você consegue fazer"), "prompt lista capacidades reais");
  ok(prompt.includes("O que você ainda NÃO consegue"), "prompt lista limitações");

  // === Guardrails ===
  ok(prompt.includes("Regra de ouro"), "prompt inclui regra de ouro da constituição");
  ok(prompt.includes("Princípios que você segue"), "prompt inclui princípios operacionais");

  // === Contrato JSON presente mas não sufocante ===
  ok(prompt.includes("reply") && prompt.includes("use_planner"), "prompt mantém contrato {reply, use_planner}");
  ok(prompt.includes("FORMATO DE RESPOSTA"), "prompt sinaliza seção de formato");
  ok(prompt.includes("fala livremente") || prompt.includes("fala natural"), "prompt encoraja fala livre no campo reply");

  // === NÃO expõe mecânica excessiva como instrução de uso ===
  // PR3: o prompt agora menciona next_action/reason para PROIBI-LOS no reply.
  // O teste verifica que o prompt NÃO instrui o LLM a USAR esses campos como fala.
  ok(!prompt.includes("Responda com next_action"), "prompt NÃO instrui usar next_action como fala");
  ok(!prompt.includes("Responda com reason"), "prompt NÃO instrui usar reason como fala");

  // =========================================================================
  // Group 2: buildChatSystemPrompt — contexto dinâmico
  // =========================================================================
  console.log("\nGroup 2: buildChatSystemPrompt() — contexto dinâmico");

  const promptWithContext = buildChatSystemPrompt({
    ownerName: "Vasques",
    context: {
      page: "Contratos",
      topic: "revisão de aluguéis",
      recent_action: "abriu contrato #42",
      metadata: { urgency: "alta", origin: "painel" },
    },
  });

  ok(promptWithContext.includes("Contratos"), "prompt com contexto inclui page");
  ok(promptWithContext.includes("revisão de aluguéis"), "prompt com contexto inclui topic");
  ok(promptWithContext.includes("abriu contrato #42"), "prompt com contexto inclui recent_action");
  ok(promptWithContext.includes("urgency: alta"), "prompt com contexto inclui metadata");
  ok(promptWithContext.includes("Contexto desta conversa"), "prompt com contexto tem seção de contexto");

  // Prompt SEM contexto NÃO deve ter a seção
  const promptNoContext = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(!promptNoContext.includes("Contexto desta conversa"), "prompt SEM contexto não tem seção de contexto");

  // Prompt com contexto vazio também NÃO deve ter a seção
  const promptEmptyContext = buildChatSystemPrompt({ ownerName: "Vasques", context: {} });
  ok(!promptEmptyContext.includes("Contexto desta conversa"), "prompt com contexto vazio não tem seção de contexto");

  // =========================================================================
  // Group 3: buildChatSystemPrompt — fallback de ownerName
  // =========================================================================
  console.log("\nGroup 3: buildChatSystemPrompt() — fallback ownerName");

  const promptDefault = buildChatSystemPrompt();
  ok(promptDefault.includes("usuário"), "prompt sem opts usa 'usuário' como fallback");

  // =========================================================================
  // Group 4: buildCognitivePromptBlock original inalterado (backward compat)
  // =========================================================================
  console.log("\nGroup 4: buildCognitivePromptBlock() — backward compatibility PR1");

  const blockPR1 = buildCognitivePromptBlock({ ownerName: "Vasques" });
  ok(typeof blockPR1 === "string" && blockPR1.length > 100, "PR1 prompt block ainda funciona");
  ok(blockPR1.includes("ENAVIA"), "PR1 block ainda menciona ENAVIA");
  ok(blockPR1.includes("Regra de ouro"), "PR1 block ainda inclui regra de ouro");
  ok(!blockPR1.includes("JSON"), "PR1 block ainda NÃO expõe JSON");
  ok(!blockPR1.includes("use_planner"), "PR1 block ainda NÃO expõe mecânica do planner");

  // =========================================================================
  // Group 5: /chat/run HTTP — rota continua funcional
  // =========================================================================
  console.log("\nGroup 5: /chat/run HTTP — shape e regressão");

  // POST com payload válido (LLM call falhará por key fake, mas shape é verificado)
  const res1 = await callWorker("POST", "/chat/run", { message: "oi" });
  ok(res1.data !== null, "POST /chat/run retorna JSON");
  ok(res1.data?.system === "ENAVIA-NV-FIRST", "POST /chat/run system=ENAVIA-NV-FIRST");
  ok(res1.data?.mode === "llm-first", "POST /chat/run mode=llm-first");
  ok(typeof res1.data?.telemetry === "object", "POST /chat/run telemetry presente");

  // POST com contexto (verifica que context é aceito sem erro de shape)
  const res1ctx = await callWorker("POST", "/chat/run", {
    message: "como estão os contratos?",
    context: { page: "Contratos", topic: "revisão" },
  });
  ok(res1ctx.data !== null, "POST /chat/run com context retorna JSON");
  ok(res1ctx.data?.system === "ENAVIA-NV-FIRST", "POST /chat/run com context system=ENAVIA-NV-FIRST");

  // Erros de input continuam funcionando
  const res2a = await callWorker("POST", "/chat/run", {});
  ok(res2a.status === 400, "POST /chat/run sem message → 400");

  const res2b = await callWorker("POST", "/chat/run", { message: "  " });
  ok(res2b.status === 400, "POST /chat/run message vazia → 400");

  // GET schema route
  const res3 = await callWorker("GET", "/chat/run");
  ok(res3.status === 200, "GET /chat/run status 200");
  ok(res3.data?.ok === true, "GET /chat/run ok=true");
  ok(res3.data?.route === "POST /chat/run", "GET /chat/run route correto");

  // OPTIONS CORS
  const res4 = await callWorker("OPTIONS", "/chat/run");
  ok(res4.status === 204, "OPTIONS /chat/run → 204");

  // /planner/run não regrediu
  const res5 = await callWorker("POST", "/planner/run", { message: "teste planner" });
  ok(res5.data?.ok === true, "POST /planner/run ok=true (não-regressão)");
  ok(res5.data?.system === "ENAVIA-NV-FIRST", "POST /planner/run system intacto");

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
