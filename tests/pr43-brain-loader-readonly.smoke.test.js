// ============================================================================
// 🧪 PR43 — Brain Loader read-only (smoke test)
//
// Cobertura mínima:
//   A) Loader básico — string não vazia, "Enavia", "LLM-first", read_only
//      como gate, indicação de read-only/documental.
//   B) Limite — total não ultrapassa BRAIN_CONTEXT_TOTAL_LIMIT; truncamento
//      é indicado pela marca BRAIN_CONTEXT_TRUNCATION_MARK.
//   C) Prompt — buildChatSystemPrompt inclui a seção do Brain;
//      a seção NÃO substitui MODO OPERACIONAL ATIVO.
//   D) Não cria capacidade falsa — Skill Router runtime, /skills/run,
//      Brain read-only e exigência de contrato/aprovação são mencionados.
//   E) Anti-bot preservado — conversa simples (target sem intenção operacional)
//      não recebe bloco operacional pesado só por target.
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede. Sem KV. Sem FS.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import {
  getEnaviaBrainContext,
  getEnaviaBrainAllowlist,
  BRAIN_CONTEXT_TOTAL_LIMIT,
  BRAIN_CONTEXT_PER_BLOCK_LIMIT,
  BRAIN_CONTEXT_TRUNCATION_MARK,
} from "../schema/enavia-brain-loader.js";

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

function header(title) {
  console.log(`\n${title}`);
}

// ---------------------------------------------------------------------------
header("Cenário A — Loader básico");
{
  const ctx = getEnaviaBrainContext();
  ok(typeof ctx === "string" && ctx.length > 0, "getEnaviaBrainContext() retorna string não vazia");
  ok(/Enavia/i.test(ctx), 'contém "Enavia"');
  ok(/LLM-first/i.test(ctx), 'contém "LLM-first"');
  ok(
    /read_only é gate de execução, não tom/i.test(ctx),
    'contém "read_only é gate de execução, não tom" (ou variação)',
  );
  ok(
    /READ-ONLY/.test(ctx) && /documental/i.test(ctx),
    "indica explicitamente que Brain é READ-ONLY e documental",
  );
  ok(
    /Não é estado runtime/i.test(ctx) && /não autoriza execução/i.test(ctx),
    'cabeçalho deixa claro "não é runtime" e "não autoriza execução"',
  );

  // Allowlist: as 6 fontes obrigatórias devem estar nas referências do snapshot.
  const allowlist = getEnaviaBrainAllowlist();
  const required = [
    "schema/brain/self-model/identity.md",
    "schema/brain/self-model/capabilities.md",
    "schema/brain/self-model/limitations.md",
    "schema/brain/self-model/current-state.md",
    "schema/brain/self-model/how-to-answer.md",
    "schema/brain/SYSTEM_AWARENESS.md",
  ];
  for (const src of required) {
    ok(allowlist.includes(src), `allowlist contém ${src}`);
  }
}

// ---------------------------------------------------------------------------
header("Cenário B — Limite de contexto");
{
  const ctx = getEnaviaBrainContext();
  ok(
    ctx.length <= BRAIN_CONTEXT_TOTAL_LIMIT,
    `total <= BRAIN_CONTEXT_TOTAL_LIMIT (${ctx.length} <= ${BRAIN_CONTEXT_TOTAL_LIMIT})`,
  );

  // Forçar truncamento agressivo para validar a marca de truncamento.
  const tiny = getEnaviaBrainContext({ totalLimit: 600 });
  ok(tiny.length <= 600, `respeita totalLimit customizado pequeno (${tiny.length} <= 600)`);
  ok(
    tiny.includes(BRAIN_CONTEXT_TRUNCATION_MARK),
    `truncamento indicado por "${BRAIN_CONTEXT_TRUNCATION_MARK}"`,
  );

  // Sanidade: por bloco também é defensivo (constante exportada).
  ok(
    typeof BRAIN_CONTEXT_PER_BLOCK_LIMIT === "number" && BRAIN_CONTEXT_PER_BLOCK_LIMIT > 0,
    "BRAIN_CONTEXT_PER_BLOCK_LIMIT exportado e positivo",
  );

  // Determinismo: duas chamadas com os mesmos parâmetros devem ser idênticas.
  ok(
    getEnaviaBrainContext() === getEnaviaBrainContext(),
    "loader é determinístico",
  );
}

// ---------------------------------------------------------------------------
header("Cenário C — Integração com buildChatSystemPrompt");
{
  // C1. Conversa simples (sem target, sem operational context) — Brain entra,
  // mas MODO OPERACIONAL ATIVO não.
  const promptSimple = buildChatSystemPrompt({ ownerName: "Bruno" });
  ok(
    promptSimple.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "prompt inclui seção do Brain (CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY)",
  );
  ok(
    !promptSimple.includes("MODO OPERACIONAL ATIVO"),
    "Brain NÃO ativa MODO OPERACIONAL ATIVO em conversa simples",
  );

  // C2. Brain pode ser desabilitado por flag interna (sem env var nova).
  const promptNoBrain = buildChatSystemPrompt({ ownerName: "Bruno", include_brain_context: false });
  ok(
    !promptNoBrain.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "include_brain_context:false desliga a seção do Brain",
  );

  // C3. Quando is_operational_context=true, MODO OPERACIONAL ATIVO aparece
  // E o Brain Context também aparece — Brain não substitui o bloco operacional.
  const promptOps = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: { worker: "nv-enavia", environment: "TEST", mode: "read_only" } },
    is_operational_context: true,
  });
  ok(
    promptOps.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO continua sendo injetado quando is_operational_context=true",
  );
  ok(
    promptOps.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context coexiste com MODO OPERACIONAL ATIVO",
  );

  // C4. Brain aparece ANTES do envelope JSON final (não no fim absoluto do prompt).
  const idxBrain = promptSimple.indexOf("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY");
  const idxEnvelope = promptSimple.indexOf("FORMATO DE RESPOSTA");
  ok(
    idxBrain > -1 && idxEnvelope > -1 && idxBrain < idxEnvelope,
    "Brain Context aparece antes do envelope JSON final",
  );
}

// ---------------------------------------------------------------------------
header("Cenário D — Não cria capacidade falsa");
{
  const ctx = getEnaviaBrainContext();
  // /skills/run: deve aparecer como "ainda não existe" (sem afirmar runtime).
  ok(
    /\/skills\/run/.test(ctx) && /ainda NÃO existe/i.test(ctx),
    "menciona /skills/run e que ainda NÃO existe em runtime",
  );
  ok(
    /Skill Router/i.test(ctx) && /(em runtime|runtime)/i.test(ctx),
    "menciona Skill Router e seu estado documental/runtime",
  );
  ok(
    /Intent Engine/i.test(ctx),
    "menciona Intent Engine (estado documental)",
  );
  ok(
    /(read-only|read_only|READ-ONLY)/i.test(ctx) && /documental/i.test(ctx),
    "Brain é descrito como read-only/documental",
  );
  ok(
    /contrato/i.test(ctx) && /aprovação/i.test(ctx),
    "execução exige contrato/aprovação — explícito no Brain",
  );
}

// ---------------------------------------------------------------------------
header("Cenário E — Anti-bot preservado (target só, sem intenção operacional)");
{
  // Reproduz o cenário central da PR36/PR38: target ativo + read_only,
  // mas SEM is_operational_context. O Brain entra, mas o bloco comportamental
  // operacional pesado NÃO deve entrar.
  const promptTargetOnly = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: { worker: "nv-enavia", environment: "PROD", mode: "read_only" } },
    is_operational_context: false,
  });
  ok(
    promptTargetOnly.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context entra com target presente (apenas como contexto documental)",
  );
  ok(
    !promptTargetOnly.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO permanece desligado (anti-bot preservado)",
  );
  ok(
    promptTargetOnly.includes("[ALVO OPERACIONAL ATIVO]"),
    "target informativo continua aparecendo (factual), independente do Brain",
  );
  // Nota factual de read_only deve continuar aparecendo (gate, não tom).
  ok(
    /Modo atual: read_only/.test(promptTargetOnly),
    "nota factual de read_only continua presente (gate de execução)",
  );
}

// ---------------------------------------------------------------------------
console.log(`\n============================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);
if (failed > 0) process.exit(1);

// Sanity assertion para fail-fast quando rodado dentro de runners agregadores.
assert.equal(failed, 0, "PR43 brain loader smoke test failures");
