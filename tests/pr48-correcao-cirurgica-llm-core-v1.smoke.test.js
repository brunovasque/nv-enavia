// ============================================================================
// 🧪 PR48 — Smoke test: Correção Cirúrgica do LLM Core v1
//
// Valida que as 4 regras tonais críticas da PR47 (que falhavam por truncamento
// do Brain Loader) agora estão presentes no LLM Core e chegam ao prompt final
// mesmo quando o Brain Context termina com [brain-context-truncated].
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildLLMCoreBlock, getLLMCoreMetadata } from "../schema/enavia-llm-core.js";
import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import { getEnaviaBrainContext } from "../schema/enavia-brain-loader.js";

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

function header(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
// 1. LLM Core contém as 4 regras críticas
// ---------------------------------------------------------------------------
header("1. LLM Core — regras tonais críticas presentes");
{
  const core = buildLLMCoreBlock({ ownerName: "Bruno" });

  ok(/excesso documental/i.test(core),
    "LLM Core contém 'excesso documental'");
  ok(/Isso é opcional\. Não mexa agora\./.test(core),
    "LLM Core contém frase canônica 'Isso é opcional. Não mexa agora.'");
  ok(/(curto|curta).*prompt completo|prompt completo.*(curto|curta)/i.test(core),
    "LLM Core contém 'resposta curta + prompt completo'");
  ok(/sem reabrir|não reabr/i.test(core),
    "LLM Core contém 'sem reabrir discussão'");
  ok(/exceção corretiva|Exceção corretiva/i.test(core),
    "LLM Core contém 'exceção corretiva'");
  ok(/COMPORTAMENTO OPERACIONAL/i.test(core),
    "LLM Core contém seção 'COMPORTAMENTO OPERACIONAL'");
}

// ---------------------------------------------------------------------------
// 2. Metadata confirma inclusão da seção
// ---------------------------------------------------------------------------
header("2. Metadata do LLM Core");
{
  const meta = getLLMCoreMetadata();
  ok(meta.includes.includes("operational-behavior-rules"),
    "metadata inclui 'operational-behavior-rules'");
}

// ---------------------------------------------------------------------------
// 3. Brain Loader pode truncar sem perder as regras no prompt final
// ---------------------------------------------------------------------------
header("3. Brain Loader truncado não perde regras tonais");
{
  const brain = getEnaviaBrainContext();
  const prompt = buildChatSystemPrompt({});

  // Brain continua truncando (confirmar)
  ok(brain.length <= 4000,
    `Brain Context respeita limite (${brain.length} chars <= 4000)`);

  // Regras críticas chegam ao prompt MESMO se Brain não as contém
  // (porque agora estão no LLM Core)
  const rulesInCore = /excesso documental/i.test(buildLLMCoreBlock());
  const rulesInBrain = /excesso documental/i.test(brain);
  ok(rulesInCore,
    "regras tonais estão no LLM Core (não dependem do Brain Loader)");

  // Prompt final contém as 4 regras independentemente de truncamento
  ok(/excesso documental/i.test(prompt),
    "prompt final contém 'excesso documental'");
  ok(/Isso é opcional\. Não mexa agora\./.test(prompt),
    "prompt final contém 'Isso é opcional. Não mexa agora.'");
  ok(/(curto|curta).*prompt completo|prompt completo.*(curto|curta)/i.test(prompt),
    "prompt final contém 'resposta curta + prompt completo'");
  ok(/sem reabrir|não reabr/i.test(prompt),
    "prompt final contém 'sem reabrir discussão'");

  // Se Brain está truncado, prompt ainda tem as regras via LLM Core
  if (brain.includes("[brain-context-truncated]")) {
    ok(/excesso documental/i.test(prompt),
      "prompt tem 'excesso documental' mesmo com brain truncado");
    ok(/Isso é opcional\. Não mexa agora\./.test(prompt),
      "prompt tem frase canônica mesmo com brain truncado");
  } else {
    ok(true, "brain não truncado — regras chegam via LLM Core ou Brain");
    ok(true, "brain não truncado — frase canônica via LLM Core ou Brain");
  }
}

// ---------------------------------------------------------------------------
// 4. Brain Loader não foi alterado (invariante cirúrgica)
// ---------------------------------------------------------------------------
header("4. Brain Loader preservado (sem alteração)");
{
  // Verificar que o snapshot do brain continua exatamente 4000 chars
  const brain = getEnaviaBrainContext();
  ok(brain.length === 4000,
    `Brain Context snapshot exatamente 4000 chars (atual: ${brain.length})`);
  ok(brain.includes("[brain-context-truncated]"),
    "Brain Context ainda termina com [brain-context-truncated] (limite preservado)");
}

// ---------------------------------------------------------------------------
// 5. Medição de tamanho pós-PR48
// ---------------------------------------------------------------------------
header("5. Medição de prompt pós-PR48");
{
  const promptA = buildChatSystemPrompt({});
  const promptB = buildChatSystemPrompt({
    context: { target: { mode: "read_only" } },
    is_operational_context: false,
  });
  const promptE = buildChatSystemPrompt({
    is_operational_context: true,
    context: { target: { worker: "nv-enavia", mode: "read_only" } },
  });

  // Referências históricas
  const PR46_A = 10496;
  const PR46_B = 10738;
  const PR46_E = 12363;

  console.log(`     • A (simples):        ${promptA.length} chars | PR46: ${PR46_A} | delta: +${promptA.length - PR46_A}`);
  console.log(`     • B (target ro):      ${promptB.length} chars | PR46: ${PR46_B} | delta: +${promptB.length - PR46_B}`);
  console.log(`     • E (operacional):    ${promptE.length} chars | PR46: ${PR46_E} | delta: +${promptE.length - PR46_E}`);

  // Aumento máximo razoável vs PR46: 1000 chars (de comportamento obrigatório)
  ok(promptA.length - PR46_A <= 1000,
    `delta A vs PR46 aceitável (${promptA.length - PR46_A} chars <= 1000)`);
  ok(promptB.length - PR46_B <= 1000,
    `delta B vs PR46 aceitável (${promptB.length - PR46_B} chars <= 1000)`);
  ok(promptE.length - PR46_E <= 1000,
    `delta E vs PR46 aceitável (${promptE.length - PR46_E} chars <= 1000)`);
}

// ---------------------------------------------------------------------------
// Sumário
// ---------------------------------------------------------------------------
console.log(`\n────────────────────────────────────────────────`);
console.log(`PR48 — Smoke Correção Cirúrgica LLM Core v1: ${passed} passed / ${failed} failed`);
console.log(`────────────────────────────────────────────────`);
if (failed > 0) {
  console.log("Falhas:");
  for (const f of failures) console.log(`  • ${f}`);
}

assert.equal(failed, 0, `PR48 smoke falhou: ${failed} asserts não passaram`);
