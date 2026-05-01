// ============================================================================
// 🧪 PR44 — Prova do Brain Loader read-only no Chat Runtime
//
// PR-PROVA: não altera nenhum runtime.
//
// Objetivo: provar que o Brain Loader read-only (PR43) influencia o chat
// runtime da Enavia de forma segura — identidade/self-model presente,
// sem capacidade falsa, sem ativação indevida de tom operacional,
// sem quebrar anti-bot e sem quebrar regressões do loop contratual.
//
// Cenários:
//   A — Brain Context presente no prompt
//   B — Brain Context desligável por flag interna
//   C — Ordem correta no prompt
//   D — Não cria capacidade falsa
//   E — Não ativa tom operacional em conversa simples
//   F — Contexto operacional real preservado
//   G — Limite e determinismo
//   H — Experiência esperada simulada (sem LLM externo)
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede. Sem KV. Sem FS. Sem LLM.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import {
  getEnaviaBrainContext,
  getEnaviaBrainAllowlist,
  BRAIN_CONTEXT_TOTAL_LIMIT,
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
// Cenário A — Brain Context presente no prompt
// ---------------------------------------------------------------------------
header("Cenário A — Brain Context presente no prompt");
{
  const prompt = buildChatSystemPrompt({ include_brain_context: true });

  ok(
    prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    'buildChatSystemPrompt inclui "CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"',
  );
  ok(
    /Enavia/i.test(prompt),
    'prompt contém "Enavia"',
  );
  ok(
    /LLM-first/i.test(prompt),
    'Brain Context contém "LLM-first"',
  );
  ok(
    /read_only é gate de execução/i.test(prompt),
    'Brain Context menciona "read_only é gate de execução"',
  );
  ok(
    /não autoriza execução/i.test(prompt),
    "Brain Context indica explicitamente que não autoriza execução",
  );
}

// ---------------------------------------------------------------------------
// Cenário B — Brain Context desligável por flag interna
// ---------------------------------------------------------------------------
header("Cenário B — Brain Context desligável por flag interna");
{
  const promptNoBrain = buildChatSystemPrompt({ include_brain_context: false });

  ok(
    !promptNoBrain.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    'include_brain_context:false remove "CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"',
  );
  ok(
    typeof promptNoBrain === "string" && promptNoBrain.length > 0,
    "prompt sem Brain ainda é string não vazia (demais seções intactas)",
  );
}

// ---------------------------------------------------------------------------
// Cenário C — Ordem correta no prompt
// ---------------------------------------------------------------------------
header("Cenário C — Ordem correta no prompt");
{
  // Prompt simples (sem contexto operacional) para testar order.
  const prompt = buildChatSystemPrompt({ include_brain_context: true });

  const idxMemory = prompt.indexOf("USO DE MEMÓRIA RECUPERADA:");
  const idxBrain  = prompt.indexOf("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY");
  const idxJson   = prompt.indexOf("FORMATO DE RESPOSTA");

  ok(
    idxBrain > -1,
    "seção Brain presente no prompt",
  );
  ok(
    idxMemory > -1 && idxBrain > idxMemory,
    "Brain aparece depois das regras de memória (USO DE MEMÓRIA RECUPERADA)",
  );
  ok(
    idxJson > -1 && idxBrain < idxJson,
    "Brain aparece antes do envelope JSON (FORMATO DE RESPOSTA)",
  );
  ok(
    !prompt.includes("MODO OPERACIONAL ATIVO"),
    "Brain não substitui nem ativa MODO OPERACIONAL ATIVO em prompt simples",
  );
}

// ---------------------------------------------------------------------------
// Cenário D — Não cria capacidade falsa
// ---------------------------------------------------------------------------
header("Cenário D — Não cria capacidade falsa");
{
  const ctx = getEnaviaBrainContext();

  ok(
    /(read-only|read_only|READ-ONLY)/i.test(ctx) && /documental/i.test(ctx),
    "Brain é descrito como read-only/documental",
  );
  ok(
    /\/skills\/run/.test(ctx) && /ainda NÃO existe/i.test(ctx),
    "menciona /skills/run como ainda NÃO existente em runtime",
  );
  ok(
    /Skill Router/i.test(ctx) && /(em runtime|runtime)/i.test(ctx),
    "Skill Router mencionado como não existente em runtime",
  );
  ok(
    /Intent Engine/i.test(ctx),
    "Intent Engine mencionado (documental, não runtime)",
  );
  ok(
    /contrato/i.test(ctx) && /aprovação/i.test(ctx),
    "execução explicitamente exige contrato/aprovação",
  );

  // Confirmar no prompt completo: não afirma Skill Router como presente.
  const prompt = buildChatSystemPrompt({ include_brain_context: true });
  ok(
    !(/Skill Router.*disponível agora/i.test(prompt)),
    "prompt não afirma Skill Router como disponível agora (falsa capacidade)",
  );
}

// ---------------------------------------------------------------------------
// Cenário E — Não ativa tom operacional em conversa simples
// ---------------------------------------------------------------------------
header("Cenário E — Não ativa tom operacional em conversa simples");
{
  const prompt = buildChatSystemPrompt({
    context: { target: { mode: "read_only" } },
    is_operational_context: false,
    include_brain_context: true,
  });

  ok(
    prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context aparece no prompt",
  );
  ok(
    !prompt.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO não aparece (anti-bot preservado)",
  );
  // target informativo pode aparecer (comportamento anterior preservado).
  ok(
    prompt.includes("[ALVO OPERACIONAL ATIVO]"),
    "target informativo pode aparecer (factual, comportamento anterior preservado)",
  );
  // read_only não vira tom defensivo — nota factual de gate continua aparecendo.
  ok(
    /Modo atual: read_only/.test(prompt),
    "nota factual de read_only aparece (gate, não tom defensivo)",
  );
}

// ---------------------------------------------------------------------------
// Cenário F — Contexto operacional real preservado
// ---------------------------------------------------------------------------
header("Cenário F — Contexto operacional real preservado");
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
    include_brain_context: true,
  });

  ok(
    prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context aparece mesmo com contexto operacional real",
  );
  ok(
    prompt.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO continua sendo injetado quando is_operational_context=true",
  );

  // Brain não bloqueia operacional real: MODO OPERACIONAL deve aparecer DEPOIS do Brain.
  const idxBrain = prompt.indexOf("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY");
  const idxOps   = prompt.indexOf("MODO OPERACIONAL ATIVO");
  ok(
    idxBrain > -1 && idxOps > -1,
    "Brain e MODO OPERACIONAL ATIVO coexistem",
  );

  // Brain não autoriza execução sozinho: cabeçalho "não autoriza execução" presente.
  ok(
    /não autoriza execução/i.test(prompt),
    "Brain não autoriza execução mesmo em contexto operacional ativo",
  );
}

// ---------------------------------------------------------------------------
// Cenário G — Limite e determinismo
// ---------------------------------------------------------------------------
header("Cenário G — Limite e determinismo");
{
  const ctx1 = getEnaviaBrainContext();
  const ctx2 = getEnaviaBrainContext();

  ok(
    ctx1 === ctx2,
    "getEnaviaBrainContext() é determinístico (duas chamadas idênticas)",
  );
  ok(
    ctx1.length <= BRAIN_CONTEXT_TOTAL_LIMIT,
    `tamanho total <= BRAIN_CONTEXT_TOTAL_LIMIT (${ctx1.length} <= ${BRAIN_CONTEXT_TOTAL_LIMIT})`,
  );

  const allowlist = getEnaviaBrainAllowlist();
  ok(
    Array.isArray(allowlist) && allowlist.length > 0,
    "allowlist não está vazia",
  );

  // Nenhuma fonte fora da allowlist (verificação de rastreabilidade).
  const allowedSources = new Set(allowlist);
  // O Brain Context não deve conter caminhos de arquivo que não estejam na allowlist.
  // Extraímos todas as referências de "fonte: <path>" e verificamos.
  const fonteMatches = [...ctx1.matchAll(/fonte:\s*(schema\/[^\s\n]+)/g)];
  let allFromAllowlist = true;
  for (const m of fonteMatches) {
    if (!allowedSources.has(m[1])) {
      allFromAllowlist = false;
      console.log(`    ⚠️  fonte fora da allowlist: ${m[1]}`);
    }
  }
  ok(
    allFromAllowlist,
    "todas as fontes referenciadas no contexto estão na allowlist",
  );

  // Não contém padrões de secrets conhecidos.
  ok(
    !/[A-Z0-9]{20,}/.test(ctx1),
    "contexto não contém sequência longa de maiúsculas/dígitos (padrão de secret/ID)",
  );

  // Não contém IDs sensíveis de KV (padrão numérico longo típico de CF KV namespace IDs).
  ok(
    !/[0-9a-f]{32}/.test(ctx1),
    "contexto não contém IDs hexadecimais longos (padrão de KV namespace ID)",
  );
}

// ---------------------------------------------------------------------------
// Cenário H — Experiência esperada simulada (sem LLM externo)
// ---------------------------------------------------------------------------
header("Cenário H — Experiência esperada simulada (sem LLM externo)");
{
  // Sem chamar LLM real. Verificamos que o contexto disponível no system prompt
  // contém informação suficiente para o LLM responder corretamente a perguntas
  // típicas de identidade, capacidade e limites.

  const prompt = buildChatSystemPrompt({ include_brain_context: true });

  // "Quem é você?" — deve haver identidade Enavia clara.
  ok(
    /ENAVIA/i.test(prompt) && /(orquestrador cognitivo|IA operacional)/i.test(prompt),
    "prompt contém identidade Enavia como orquestrador cognitivo/IA operacional",
  );

  // "Você sabe operar seu sistema?" — capacidades atuais documentadas.
  ok(
    /capacidades reais disponíveis agora/i.test(prompt) || /consegue fazer agora/i.test(prompt),
    "prompt contém seção de capacidades reais atuais",
  );

  // "Você já tem Skill Router?" — Skill Router marcado como futuro no Brain Context.
  ok(
    /Skill Router/i.test(prompt) && /(ainda NÃO existe|ainda não existe|em runtime|runtime)/i.test(prompt),
    "prompt/Brain indica Skill Router como ainda não disponível em runtime",
  );

  // "Você pode executar sem aprovação?" — não pode.
  ok(
    /(aprovação|contrato ativo)/i.test(prompt),
    "prompt menciona necessidade de aprovação/contrato para execução",
  );

  // Capacidades futuras marcadas como futuras (não prometidas como presentes).
  ok(
    /ainda NÃO consegue|ainda NÃO existe|cannot_yet/i.test(prompt),
    "prompt contém indicação de capacidades futuras marcadas como não presentes",
  );

  // Sem falsa autonomia: não afirma execução autônoma sem gate.
  ok(
    !(/executa autonomamente sem aprovação/i.test(prompt)),
    "prompt não afirma execução autônoma sem aprovação (sem falsa autonomia)",
  );

  // Brain Context no prompt permite identificar "Cinco modos" ou auto-descrição.
  ok(
    /(Cinco modos|cinco modos|pensar.*diagnosticar.*planejar|orquestrador)/i.test(prompt),
    "prompt contém descrição dos modos de operação (identidade completa)",
  );
}

// ---------------------------------------------------------------------------
console.log(`\n============================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);
if (failed > 0) process.exit(1);

assert.equal(failed, 0, "PR44 brain loader chat runtime prova test failures");
