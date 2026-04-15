// ============================================================================
// 🧪 PR4 — Operational Awareness Smoke Tests
//
// Run: node tests/pr4-operational-awareness.smoke.test.js
//
// Proves that:
//   OA1.  buildOperationalAwareness: browser unavailable when URL empty
//   OA2.  buildOperationalAwareness: browser idle when URL set + no arm state
//   OA3.  buildOperationalAwareness: browser active when arm state=active
//   OA4.  buildOperationalAwareness: browser disabled when arm state=disabled
//   OA5.  buildOperationalAwareness: executor configured when EXECUTOR binding present
//   OA6.  buildOperationalAwareness: executor unconfigured when binding absent
//   OA7.  buildOperationalAwareness: approval mode supervised (default)
//   OA8.  buildOperationalAwareness: approval mode autonomous when ENAVIA_MODE=autonomous
//   OA9.  buildOperationalAwareness: human_gate_active=true when supervised
//   OA10. buildOperationalAwareness: human_gate_active=false when autonomous
//   OA11. buildOperationalAwareness: interaction_types has conversation, plan, action
//   OA12. buildOperationalAwareness: browser.can_act=false when URL empty
//   OA13. buildOperationalAwareness: browser.can_act=true when URL set + idle
//   OA14. buildOperationalAwareness: browser.can_act=false when disabled
//   OA15. buildOperationalAwareness: accepts null/undefined env gracefully
//   OA16. renderOperationalAwarenessBlock: returns non-empty string
//   OA17. renderOperationalAwarenessBlock: mentions browser when URL missing
//   OA18. renderOperationalAwarenessBlock: mentions executor state
//   OA19. renderOperationalAwarenessBlock: mentions approval mode
//   OA20. renderOperationalAwarenessBlock: mentions interaction types (conversa/plano/ação)
//   OA21. renderOperationalAwarenessBlock: warns when browser not available
//   OA22. renderOperationalAwarenessBlock: warns when executor not configured
//   OA23. renderOperationalAwarenessBlock: mentions supervised gate
//   OA24. renderOperationalAwarenessBlock: returns empty string for null ctx
//   OA25. buildChatSystemPrompt: injects operational_awareness block when provided
//   OA26. buildChatSystemPrompt: omits awareness block when not provided (backward compat)
//   OA27. Full runtime: /chat/run telemetry includes operational_awareness
// ============================================================================

import { strict as assert } from "node:assert";

import {
  buildOperationalAwareness,
  renderOperationalAwarenessBlock,
  BROWSER_ARM_STATUS,
  APPROVAL_MODE,
  INTERACTION_TYPE,
} from "../schema/operational-awareness.js";

import {
  buildChatSystemPrompt,
} from "../schema/enavia-cognitive-runtime.js";

// Worker import for Group 5
import worker from "../nv-enavia.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

let passed = 0;
let failed = 0;

function ok(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ ${label}`);
  }
}

// Minimal mock env — no browser, no executor, supervised (default)
const ENV_NO_ARMS = {
  BROWSER_EXECUTOR_URL: "",
  ENAVIA_MODE: "supervised",
};

// Env with browser URL set but no executor
const ENV_BROWSER_ONLY = {
  BROWSER_EXECUTOR_URL: "https://run.nv-imoveis.com/browser/run",
  ENAVIA_MODE: "supervised",
};

// Env with browser + executor
const ENV_FULL = {
  BROWSER_EXECUTOR_URL: "https://run.nv-imoveis.com/browser/run",
  EXECUTOR: { fetch: async () => {} },
  ENAVIA_MODE: "supervised",
};

// Env for autonomous mode
const ENV_AUTONOMOUS = {
  BROWSER_EXECUTOR_URL: "https://run.nv-imoveis.com/browser/run",
  ENAVIA_MODE: "autonomous",
};

// Fake browser arm states
const ARM_STATE_IDLE     = { status: "idle",     last_action: null };
const ARM_STATE_ACTIVE   = { status: "active",   last_action: "navigate" };
const ARM_STATE_DISABLED = { status: "disabled", last_action: "navigate" };

// ── Group 1: buildOperationalAwareness — browser ──────────────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 1: Browser\n");

// OA1: browser unavailable when URL empty
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.browser.status === BROWSER_ARM_STATUS.UNAVAILABLE, "OA1: browser.status=unavailable when URL empty");
  ok(ctx.browser.url_configured === false, "OA1: browser.url_configured=false when URL empty");
}

// OA2: browser idle when URL set + no arm state
{
  const ctx = buildOperationalAwareness(ENV_BROWSER_ONLY, {});
  ok(ctx.browser.status === BROWSER_ARM_STATUS.IDLE, "OA2: browser.status=idle when URL set but no arm state");
  ok(ctx.browser.url_configured === true, "OA2: browser.url_configured=true when URL set");
}

// OA3: browser active when arm state=active
{
  const ctx = buildOperationalAwareness(ENV_BROWSER_ONLY, { browserArmState: ARM_STATE_ACTIVE });
  ok(ctx.browser.status === BROWSER_ARM_STATUS.ACTIVE, "OA3: browser.status=active when arm state=active");
  ok(ctx.browser.last_action === "navigate", "OA3: browser.last_action preserved from arm state");
}

// OA4: browser disabled when arm state=disabled
{
  const ctx = buildOperationalAwareness(ENV_BROWSER_ONLY, { browserArmState: ARM_STATE_DISABLED });
  ok(ctx.browser.status === BROWSER_ARM_STATUS.DISABLED, "OA4: browser.status=disabled when arm state=disabled");
}

// OA12: browser.can_act=false when URL empty
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.browser.can_act === false, "OA12: browser.can_act=false when URL empty");
}

// OA13: browser.can_act=true when URL set + idle
{
  const ctx = buildOperationalAwareness(ENV_BROWSER_ONLY, { browserArmState: ARM_STATE_IDLE });
  ok(ctx.browser.can_act === true, "OA13: browser.can_act=true when URL set + idle");
}

// OA14: browser.can_act=false when disabled
{
  const ctx = buildOperationalAwareness(ENV_BROWSER_ONLY, { browserArmState: ARM_STATE_DISABLED });
  ok(ctx.browser.can_act === false, "OA14: browser.can_act=false when disabled");
}

// ── Group 2: buildOperationalAwareness — executor ─────────────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 2: Executor\n");

// OA5: executor configured when EXECUTOR binding present
{
  const ctx = buildOperationalAwareness(ENV_FULL, {});
  ok(ctx.executor.configured === true, "OA5: executor.configured=true when EXECUTOR binding present");
  ok(ctx.executor.can_act === true, "OA5: executor.can_act=true when configured");
}

// OA6: executor unconfigured when binding absent
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.executor.configured === false, "OA6: executor.configured=false when binding absent");
  ok(ctx.executor.can_act === false, "OA6: executor.can_act=false when unconfigured");
}

// ── Group 3: buildOperationalAwareness — approval mode ────────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 3: Approval Mode\n");

// OA7: approval mode supervised (default)
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.approval.mode === APPROVAL_MODE.SUPERVISED, "OA7: approval.mode=supervised by default");
}

// OA8: approval mode autonomous
{
  const ctx = buildOperationalAwareness(ENV_AUTONOMOUS, {});
  ok(ctx.approval.mode === APPROVAL_MODE.AUTONOMOUS, "OA8: approval.mode=autonomous when ENAVIA_MODE=autonomous");
}

// OA9: human_gate_active=true when supervised
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.approval.human_gate_active === true, "OA9: human_gate_active=true when supervised");
}

// OA10: human_gate_active=false when autonomous
{
  const ctx = buildOperationalAwareness(ENV_AUTONOMOUS, {});
  ok(ctx.approval.human_gate_active === false, "OA10: human_gate_active=false when autonomous");
}

// ── Group 4: buildOperationalAwareness — interaction types ────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 4: Interaction Types\n");

// OA11: interaction_types has conversation, plan, action
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  ok(ctx.interaction_types[INTERACTION_TYPE.CONVERSATION] != null, "OA11: interaction_types.conversation exists");
  ok(ctx.interaction_types[INTERACTION_TYPE.PLAN] != null, "OA11: interaction_types.plan exists");
  ok(ctx.interaction_types[INTERACTION_TYPE.ACTION] != null, "OA11: interaction_types.action exists");
  ok(typeof ctx.interaction_types[INTERACTION_TYPE.CONVERSATION].description === "string", "OA11: conversation.description is string");
  ok(typeof ctx.interaction_types[INTERACTION_TYPE.PLAN].description === "string", "OA11: plan.description is string");
  ok(typeof ctx.interaction_types[INTERACTION_TYPE.ACTION].description === "string", "OA11: action.description is string");
}

// OA15: accepts null/undefined env gracefully
{
  let threw = false;
  let ctx;
  try {
    ctx = buildOperationalAwareness(null, null);
  } catch {
    threw = true;
  }
  ok(!threw, "OA15: buildOperationalAwareness does not throw on null env");
  ok(ctx != null, "OA15: returns non-null context on null env");
  ok(ctx.browser.status === BROWSER_ARM_STATUS.UNAVAILABLE, "OA15: browser unavailable on null env");
  ok(ctx.executor.configured === false, "OA15: executor unconfigured on null env");
  ok(ctx.approval.mode === APPROVAL_MODE.SUPERVISED, "OA15: default supervised on null env");
}

// ── Group 5: renderOperationalAwarenessBlock ──────────────────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 5: Render Block\n");

// OA16: returns non-empty string
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(typeof block === "string" && block.length > 50, "OA16: render returns non-empty string");
}

// OA17: mentions browser state
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.toLowerCase().includes("browser"), "OA17: block mentions browser");
}

// OA18: mentions executor state
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.toLowerCase().includes("executor"), "OA18: block mentions executor");
}

// OA19: mentions approval mode
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.toLowerCase().includes("aprova"), "OA19: block mentions approval");
}

// OA20: mentions interaction types
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.toLowerCase().includes("conversa"), "OA20: block mentions conversation type");
  ok(block.toLowerCase().includes("plano"), "OA20: block mentions plan type");
  ok(block.toLowerCase().includes("ação"), "OA20: block mentions action type");
}

// OA21: warns when browser not available
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.includes("Nunca prometa navegar") || block.includes("não disponível"), "OA21: block warns about browser not available");
}

// OA22: warns when executor not configured
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.includes("Nunca prometa executar") || block.includes("não configurado"), "OA22: block warns about executor not configured");
}

// OA23: mentions supervised gate
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const block = renderOperationalAwarenessBlock(ctx);
  ok(block.toUpperCase().includes("SUPERVISIONADO") || block.toLowerCase().includes("aprovação humana"), "OA23: block mentions supervised gate");
}

// OA24: returns empty string for null ctx
{
  const block = renderOperationalAwarenessBlock(null);
  ok(block === "", "OA24: render returns empty string for null ctx");
}

// ── Group 6: buildChatSystemPrompt with operational_awareness ─────────────
console.log("\n🧪 PR4 Operational Awareness — Group 6: Chat System Prompt Integration\n");

// OA25: buildChatSystemPrompt injects awareness block when provided
{
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques", operational_awareness: ctx });
  ok(typeof prompt === "string" && prompt.length > 100, "OA25: buildChatSystemPrompt returns non-empty string with awareness");
  ok(prompt.includes("ESTADO OPERACIONAL REAL"), "OA25: prompt contains operational awareness block");
  ok(prompt.includes("DIFERENCIAÇÃO OBRIGATÓRIA"), "OA25: prompt contains interaction type differentiation");
}

// OA26: buildChatSystemPrompt omits awareness block when not provided (backward compat)
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(typeof prompt === "string" && prompt.length > 100, "OA26: buildChatSystemPrompt still works without operational_awareness");
  // Should NOT have the awareness block header
  ok(!prompt.includes("ESTADO OPERACIONAL REAL"), "OA26: no awareness block when not provided (backward compat)");
}

// ── Group 7: HTTP /chat/run telemetry includes operational_awareness ───────
console.log("\n🧪 PR4 Operational Awareness — Group 7: HTTP /chat/run telemetry\n");

// OA27: /chat/run telemetry includes operational_awareness
{
  const stubEnv = {
    ENAVIA_MODE: "supervised",
    OPENAI_API_KEY: "test-key-fake",
    OPENAI_MODEL: "gpt-4.1-mini",
    OWNER: "Vasques",
    SYSTEM_NAME: "ENAVIA",
    BROWSER_EXECUTOR_URL: "",
    ENAVIA_BRAIN: {
      get: async () => null,
      put: async () => {},
      list: async () => ({ keys: [] }),
    },
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_BUCKET: "test-bucket",
  };

  const req = new Request("https://worker.test/chat/run", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message: "oi" }),
  });

  const res = await worker.fetch(req, stubEnv, {});
  const data = await res.json().catch(() => null);

  ok(data !== null, "OA27: /chat/run returns JSON");
  ok(data?.system === "ENAVIA-NV-FIRST", "OA27: system=ENAVIA-NV-FIRST");
  ok(data?.mode === "llm-first", "OA27: mode=llm-first");
  ok(typeof data?.telemetry === "object", "OA27: telemetry is object");
  ok(typeof data?.telemetry?.operational_awareness === "object", "OA27: telemetry.operational_awareness is object");
  ok("browser_status" in (data?.telemetry?.operational_awareness || {}), "OA27: operational_awareness.browser_status present");
  ok("browser_can_act" in (data?.telemetry?.operational_awareness || {}), "OA27: operational_awareness.browser_can_act present");
  ok("executor_configured" in (data?.telemetry?.operational_awareness || {}), "OA27: operational_awareness.executor_configured present");
  ok("approval_mode" in (data?.telemetry?.operational_awareness || {}), "OA27: operational_awareness.approval_mode present");
  ok("human_gate_active" in (data?.telemetry?.operational_awareness || {}), "OA27: operational_awareness.human_gate_active present");

  // Verify the values match the env we provided (no browser URL, no executor binding)
  const oa = data?.telemetry?.operational_awareness;
  ok(oa?.browser_status === "unavailable", "OA27: browser_status=unavailable (BROWSER_EXECUTOR_URL empty)");
  ok(oa?.browser_can_act === false, "OA27: browser_can_act=false (no URL)");
  ok(oa?.executor_configured === false, "OA27: executor_configured=false (no EXECUTOR binding in stub)");
  ok(oa?.approval_mode === "supervised", "OA27: approval_mode=supervised");
  ok(oa?.human_gate_active === true, "OA27: human_gate_active=true (supervised mode)");
}

// ── Group 8: Role guard — proibição de papel comercial ────────────────────
console.log("\n🧪 PR4 Operational Awareness — Group 8: Role Guard (papel correto vs. papel proibido)\n");

// OA28: buildChatSystemPrompt contains explicit PAPEL OPERACIONAL section
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(prompt.includes("PAPEL OPERACIONAL"), "OA28: prompt contains PAPEL OPERACIONAL section");
  ok(prompt.includes("ORQUESTRADOR COGNITIVO"), "OA28: prompt frames Enavia as cognitive orchestrator");
}

// OA29: prompt forbids commercial assistant role explicitly
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(prompt.includes("PAPEL PROIBIDO"), "OA29: prompt contains explicit PAPEL PROIBIDO section");
  ok(prompt.includes("Assistente comercial") || prompt.includes("assistente comercial"), "OA29: prompt forbids commercial assistant");
  ok(prompt.includes("Atendente") || prompt.includes("atendente"), "OA29: prompt forbids attendant role");
}

// OA30: tone section has role guard bullet
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(prompt.includes("Papel fixo"), "OA30: tone section includes 'Papel fixo' role guard");
  ok(prompt.includes("nunca como assistente de vendas"), "OA30: tone guard forbids sales assistant framing");
}

// OA31: prompt contains examples for correct behavior per request type
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(prompt.includes("EXEMPLOS DE RESPOSTA CORRETA"), "OA31: prompt contains correct behavior examples");
  ok(prompt.includes("Cumprimento simples"), "OA31: examples cover casual greeting case");
  ok(prompt.includes("Pedido de plano"), "OA31: examples cover plan request case");
  ok(prompt.includes("Pergunta sobre capacidades"), "OA31: examples cover capabilities question case");
  ok(prompt.includes("Pedido de execução"), "OA31: examples cover execution request case");
}

// OA32: role guard is present even without operational_awareness (always active)
{
  const prompt = buildChatSystemPrompt({ ownerName: "Vasques" });
  ok(prompt.includes("PAPEL OPERACIONAL"), "OA32: role guard active without operational_awareness");
  // And also present with it
  const ctx = buildOperationalAwareness(ENV_NO_ARMS, {});
  const promptWithAwareness = buildChatSystemPrompt({ ownerName: "Vasques", operational_awareness: ctx });
  ok(promptWithAwareness.includes("PAPEL OPERACIONAL"), "OA32: role guard active with operational_awareness too");
}

// ── Summary ───────────────────────────────────────────────────────────────
console.log(`\n📊 PR4 Operational Awareness: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
