// ============================================================================
// 🧪 PR46 — LLM Core v1 — smoke test
//
// PR-IMPL: valida o LLM Core v1 (schema/enavia-llm-core.js) e a consolidação
// das antigas seções 1, 1b, 2, 3, 4 do system prompt do chat em um único
// bloco compacto, sem perder identidade, anti-bot, capacidades reais,
// limitações, falsa capacidade, gates e envelope JSON.
//
// Cenários:
//   A — LLM Core existe e tem o conteúdo essencial
//   B — Prompt consolidado contém LLM Core + Brain Context
//   C — Anti-bot preservado em conversa simples com target read_only
//   D — Operacional real preservado quando is_operational_context=true
//   E — Falsa capacidade bloqueada
//   F — Redundância reduzida (NV Imóveis ↓, sem blocos duplicados grosseiros)
//   G — Tamanho controlado (medição vs baseline PR45)
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede. Sem KV. Sem FS. Sem LLM.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildLLMCoreBlock, getLLMCoreMetadata } from "../schema/enavia-llm-core.js";
import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";

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

// Baseline da PR45 (relatório `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md`)
const PR45_BASELINE = {
  A_simples_sem_target: 10945,
  B_simples_target_readonly: 11187, // medido no relatório como 11.205; nosso medidor mediu 11.187 (diff por arredondamento de target.environment)
  E_operacional: 12812,
  F_operacional_completo: 13689,
};

// ---------------------------------------------------------------------------
// Cenário A — LLM Core existe
// ---------------------------------------------------------------------------
header("Cenário A — LLM Core existe e expõe conteúdo essencial");
{
  const core = buildLLMCoreBlock();
  ok(typeof core === "string" && core.length > 0, "buildLLMCoreBlock() retorna string não vazia");
  ok(/Enavia/i.test(core), "LLM Core contém 'Enavia'");
  ok(/LLM[- ]?first|orquestrador cognitivo/i.test(core), "LLM Core contém 'LLM-first' ou 'orquestrador cognitivo'");
  ok(/contrato/i.test(core) && /aprova/i.test(core), "LLM Core contém regra de execução com contrato/aprovação");
  ok(/falsa capacidade|FALSA CAPACIDADE/i.test(core), "LLM Core contém regra de falsa capacidade");
  ok(/Skill Router/i.test(core) && /ainda NÃO existe/i.test(core), "LLM Core declara Skill Router runtime como ainda NÃO existente");
  ok(/read_only/i.test(core) && /gate/i.test(core), "LLM Core trata read_only como gate (não como tom)");

  // Metadata helper exposta sem mexer no snapshot do Brain
  const meta = getLLMCoreMetadata();
  ok(meta && meta.version === "v1", "getLLMCoreMetadata retorna version v1");
  ok(Array.isArray(meta.includes) && meta.includes.includes("read_only-as-gate"), "metadata inclui flag 'read_only-as-gate'");

  // Determinismo
  ok(buildLLMCoreBlock() === buildLLMCoreBlock(), "buildLLMCoreBlock() é determinístico");

  // ownerName fluindo
  const coreOp = buildLLMCoreBlock({ ownerName: "Bruno" });
  ok(coreOp.includes("Bruno"), "LLM Core injeta ownerName quando passado");
}

// ---------------------------------------------------------------------------
// Cenário B — Prompt consolidado
// ---------------------------------------------------------------------------
header("Cenário B — Prompt consolidado contém LLM Core e Brain Context");
{
  const prompt = buildChatSystemPrompt({});
  ok(prompt.includes("ENAVIA — LLM CORE v1"), "prompt inclui marcador 'ENAVIA — LLM CORE v1'");
  ok(prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"), "prompt inclui Brain Context");

  // Não duplica excessivamente NV Imóveis (PR45 mediu 9 ocorrências; alvo: <=4 após consolidação)
  const nvCount = (prompt.match(/NV Imóveis/g) || []).length;
  ok(nvCount <= 4, `'NV Imóveis' aparece <=4x no prompt (atual: ${nvCount})`);

  // Não há mais blocos duplicados grosseiros das antigas seções 1-4
  ok(!prompt.includes("PAPEL OPERACIONAL:\nVocê é um ORQUESTRADOR COGNITIVO"), "antiga seção 1b verbosa removida");
  ok(!prompt.includes("Como você deve conversar:"), "antiga seção 2 verbosa removida (consolidada no Core)");
  ok(!prompt.includes("O que você consegue fazer agora de verdade:"), "antiga seção 3 verbosa removida (consolidada no Core)");
  ok(!prompt.includes("Princípios que você segue:"), "antiga seção 4 verbosa removida (consolidada no Core)");

  // Mas as capacidades reais continuam presentes (no Core, não no Brain)
  ok(/Conversar de forma natural/i.test(prompt), "capacidades reais ainda presentes (via Core)");
}

// ---------------------------------------------------------------------------
// Cenário C — Anti-bot preservado em conversa simples + target read_only
// ---------------------------------------------------------------------------
header("Cenário C — Anti-bot preservado");
{
  const prompt = buildChatSystemPrompt({
    context: { target: { mode: "read_only" } },
    is_operational_context: false,
  });
  ok(prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"), "Brain Context aparece");
  ok(prompt.includes("ENAVIA — LLM CORE v1"), "LLM Core aparece");
  ok(!prompt.includes("MODO OPERACIONAL ATIVO"), "MODO OPERACIONAL ATIVO NÃO aparece (anti-bot OK)");
  ok(/read_only/.test(prompt) && /gate/i.test(prompt), "read_only aparece como gate/factual, não como tom");
  // Target informativo factual ainda presente
  ok(prompt.includes("[ALVO OPERACIONAL ATIVO]"), "target informativo factual ainda aparece");
  ok(/Modo atual: read_only/.test(prompt), "nota factual de read_only continua aparecendo");
}

// ---------------------------------------------------------------------------
// Cenário D — Operacional real preservado
// ---------------------------------------------------------------------------
header("Cenário D — Operacional real preservado");
{
  const prompt = buildChatSystemPrompt({
    is_operational_context: true,
    context: {
      target: {
        worker: "nv-enavia",
        repo: "brunovasque/nv-enavia",
        environment: "PROD",
        mode: "read_only",
      },
    },
  });
  ok(prompt.includes("MODO OPERACIONAL ATIVO"), "MODO OPERACIONAL ATIVO aparece quando is_operational_context=true");
  ok(prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"), "Brain Context aparece");
  ok(prompt.includes("ENAVIA — LLM CORE v1"), "LLM Core aparece");
  ok(/contrato/i.test(prompt) && /aprova/i.test(prompt), "execução continua exigindo contrato/aprovação");
}

// ---------------------------------------------------------------------------
// Cenário E — Falsa capacidade bloqueada
// ---------------------------------------------------------------------------
header("Cenário E — Falsa capacidade bloqueada");
{
  const prompt = buildChatSystemPrompt({});
  ok(/Skill Router/i.test(prompt) && /ainda NÃO existe/i.test(prompt), "Skill Router runtime declarado como ainda NÃO existente");
  ok(/\/skills\/run/.test(prompt) && /ainda NÃO existe/i.test(prompt), "/skills/run declarado como ainda NÃO existente");
  ok(/Intent Engine/i.test(prompt) && /ainda NÃO existe/i.test(prompt), "Intent Engine completo declarado como ainda NÃO existente");
  ok(/Brain Loader/i.test(prompt) && /(read[- ]only|READ-ONLY)/i.test(prompt), "Brain Loader é declarado como read-only");
  ok(/escrita.*memória|memória.*automática/i.test(prompt), "escrita automática de memória declarada como ainda NÃO existente");
}

// ---------------------------------------------------------------------------
// Cenário F — Redução de redundância
// ---------------------------------------------------------------------------
header("Cenário F — Redução de redundância");
{
  const prompt = buildChatSystemPrompt({});
  const nvCount = (prompt.match(/NV Imóveis/g) || []).length;
  ok(nvCount <= 4, `'NV Imóveis' aparece <=4x (PR45 baseline: 9; atual: ${nvCount})`);

  // "não é assistente" / equivalentes — devem aparecer ao menos uma vez (blindagem)
  // mas não 3+ vezes (redundância)
  const naoEAssistCount = (prompt.match(/não é (um )?assistente|nem um atendente|NÃO é assistente/gi) || []).length;
  ok(naoEAssistCount >= 1 && naoEAssistCount <= 3, `'não é assistente' aparece 1-3x (blindagem mantida; atual: ${naoEAssistCount})`);

  // Não há mais dois blocos separados de capacidades em seções diferentes do prompt
  // (antes da PR46 havia "O que você consegue fazer agora de verdade:" + "CAPACIDADES REAIS AGORA:" no Brain)
  const capsBlocks = (prompt.match(/CAPACIDADES REAIS|O que você consegue fazer agora de verdade/gi) || []).length;
  ok(capsBlocks <= 2, `blocos de capacidades reduzidos (atual: ${capsBlocks})`);
}

// ---------------------------------------------------------------------------
// Cenário G — Tamanho controlado vs PR45 baseline
// ---------------------------------------------------------------------------
header("Cenário G — Tamanho controlado vs PR45");
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

  console.log(`     • Cenário A: ${promptA.length} chars (PR45 baseline: ${PR45_BASELINE.A_simples_sem_target}) → delta: ${promptA.length - PR45_BASELINE.A_simples_sem_target}`);
  console.log(`     • Cenário B: ${promptB.length} chars (PR45 baseline: ${PR45_BASELINE.B_simples_target_readonly}) → delta: ${promptB.length - PR45_BASELINE.B_simples_target_readonly}`);
  console.log(`     • Cenário E: ${promptE.length} chars (PR45 baseline: ${PR45_BASELINE.E_operacional}) → delta: ${promptE.length - PR45_BASELINE.E_operacional}`);

  // PR48 adicionou seção de comportamento operacional (+732 chars vs PR46) para corrigir
  // regras tonais truncadas pelo Brain Loader. Aumento aceito e documentado. Limite aqui
  // protege contra regressão além do PR48 real (PR45_BASELINE + 1000 chars de margem segura).
  ok(promptA.length < PR45_BASELINE.A_simples_sem_target + 1000,
    `prompt A dentro do teto pós-PR48 (${promptA.length} < ${PR45_BASELINE.A_simples_sem_target + 1000})`);
  ok(promptB.length < PR45_BASELINE.B_simples_target_readonly + 1000,
    `prompt B dentro do teto pós-PR48 (${promptB.length} < ${PR45_BASELINE.B_simples_target_readonly + 1000})`);
  ok(promptE.length < PR45_BASELINE.E_operacional + 1000,
    `prompt E dentro do teto pós-PR48 (${promptE.length} < ${PR45_BASELINE.E_operacional + 1000})`);

  // Segurança não foi sacrificada: principais marcadores presentes
  ok(promptA.includes("ENAVIA — LLM CORE v1"), "LLM Core presente após redução");
  ok(promptA.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"), "Brain Context presente após redução");
  ok(promptA.includes("FORMATO DE RESPOSTA"), "envelope JSON presente após redução");
}

// ---------------------------------------------------------------------------
// Sumário
// ---------------------------------------------------------------------------
console.log(`\n────────────────────────────────────────────────`);
console.log(`PR46 — LLM Core v1 — smoke: ${passed} passed / ${failed} failed`);
console.log(`────────────────────────────────────────────────`);

assert.equal(failed, 0, `PR46 smoke falhou: ${failed} asserts não passaram`);
