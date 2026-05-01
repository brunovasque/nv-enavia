// ============================================================================
// 🧪 PR47 — Prova de Resposta Viva com LLM Core v1
//
// PR-PROVA pura. Não altera nenhum runtime. Não chama LLM externo.
// Testa o PROMPT efetivo (LLM Core v1 + Brain Context + envelope JSON) e a
// detecção de contexto operacional (`isOperationalMessage`) já existentes.
//
// Cenários (do contrato PR47):
//   A — Identidade viva
//   B — Pergunta de capacidade
//   C — Frustração / anti-bot emocional
//   D — Pedido de próxima PR
//   E — Pedido operacional real
//   F — Falsa capacidade bloqueada
//   G — read_only como gate (não tom)
//   H — Prompt vivo sem excesso de duplicação
//   I — Envelope JSON preservado
//   J — Sanitizers/gates preservados indiretamente (regressões PR36/PR37)
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildLLMCoreBlock, getLLMCoreMetadata } from "../schema/enavia-llm-core.js";
import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import { getEnaviaBrainContext } from "../schema/enavia-brain-loader.js";
import { isOperationalMessage } from "../nv-enavia.js";

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

// Baseline tamanho — referência: PR45 baseline e PR46 implementação.
// PR45 baseline (sem LLM Core): A=10.945 chars, B=11.187 chars, E=12.812 chars.
// PR46 mediu economia de -449 chars por conversa em todos os cenários.
const PR45_BASELINE = {
  A_simples_sem_target: 10945,
  B_simples_target_readonly: 11187,
  E_operacional: 12812,
  F_operacional_completo: 13689,
};
// Teto seguro pós-PR46 (não pode regressar para PR45 baseline).
const PR46_MAX_TOLERANCE = {
  A_simples_sem_target: PR45_BASELINE.A_simples_sem_target,        // tem que ficar < baseline
  B_simples_target_readonly: PR45_BASELINE.B_simples_target_readonly,
  E_operacional: PR45_BASELINE.E_operacional,
  F_operacional_completo: PR45_BASELINE.F_operacional_completo,
};

// ---------------------------------------------------------------------------
// Cenário A — Identidade viva ("Quem é você?")
// ---------------------------------------------------------------------------
header("Cenário A — Identidade viva");
{
  const prompt = buildChatSystemPrompt({ ownerName: "Bruno" });
  // Mensagem do usuário simulada: "Quem é você?"
  // Validar que o prompt fornece base suficiente para resposta correta.

  ok(/\bEnavia\b/.test(prompt), "prompt cita 'Enavia'");
  ok(/orquestrador cognitivo|IA operacional|operacional estratégica|inteligência operacional/i.test(prompt),
    "prompt define papel como IA operacional estratégica / orquestrador cognitivo");
  ok(/LLM[- ]?first/i.test(prompt), "prompt declara LLM-first");
  ok(/checklist/i.test(prompt) && /(sem|não|antes)/i.test(prompt),
    "prompt afirma que não é bot de checklist (inteligência antes de checklist)");
  ok(/NÃO é assistente comercial|não é (um )?assistente|nem (um )?atendente|não é a NV Im/i.test(prompt),
    "prompt blinda contra 'sou assistente comercial' / 'sou atendente da NV Imóveis'");
  ok(/NÃO é a NV Imóveis|nem a Enova|entidade cognitiva independente/i.test(prompt),
    "prompt blinda contra 'sou a Enova' e cita independência da NV Imóveis");
  ok(/contrato|skills|mapas|ferramenta/i.test(prompt),
    "prompt cita contratos/skills/ferramentas como instrumento, não personalidade");

  // Indução negativa: o prompt NÃO deve afirmar identidades incorretas
  ok(!/Você é (a |o )?atendente da NV/i.test(prompt),
    "prompt NÃO induz 'sou atendente da NV Imóveis'");
  ok(!/Você é (a |o )?assistente comercial/i.test(prompt),
    "prompt NÃO induz 'sou assistente comercial'");
  ok(!/Você é a Enova\b/i.test(prompt),
    "prompt NÃO induz 'sou a Enova'");

  // Resposta esperada (simulação determinística do que o LLM deveria dizer)
  // Se o prompt contém X, esperamos que a resposta contenha referências a X.
  // Aqui validamos que o prompt fornece os ingredientes — não chamamos LLM.
  ok(prompt.includes("ENAVIA — LLM CORE v1"),
    "LLM Core v1 está injetado como bloco principal");
  ok(prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context está injetado como complemento documental");

  // Owner name flui — prompt sabe quem é o operador
  ok(prompt.includes("Bruno"), "prompt menciona o operador 'Bruno' quando ownerName é fornecido");
}

// ---------------------------------------------------------------------------
// Cenário B — Pergunta de capacidade ("Você sabe operar seu sistema?")
// ---------------------------------------------------------------------------
header("Cenário B — Pergunta de capacidade");
{
  const prompt = buildChatSystemPrompt({});
  ok(/CAPACIDADES REAIS/i.test(prompt), "prompt expõe seção de CAPACIDADES REAIS");
  ok(/LIMITAÇÕES ATUAIS/i.test(prompt), "prompt expõe seção de LIMITAÇÕES ATUAIS");
  ok(/Brain Loader/i.test(prompt) && /(read[- ]only|READ-ONLY)/i.test(prompt),
    "prompt declara Brain Loader como READ-ONLY");
  ok(/Skill Router/i.test(prompt) && /ainda NÃO existe/i.test(prompt),
    "prompt declara Skill Router runtime como ainda NÃO existente");
  ok(/\/skills\/run/.test(prompt) && /ainda NÃO existe/i.test(prompt),
    "prompt declara /skills/run como ainda NÃO existente");
  ok(/Intent Engine/i.test(prompt) && /ainda NÃO existe/i.test(prompt),
    "prompt declara Intent Engine completo como ainda NÃO existente");
  ok(/contrato/i.test(prompt) && /aprova/i.test(prompt),
    "prompt declara que execução exige contrato + aprovação");

  // Resposta esperada não deve fingir autonomia total — o prompt PROÍBE isso
  ok(/falsa capacidade|FALSA CAPACIDADE/i.test(prompt),
    "prompt contém regra explícita de NÃO falsa capacidade");
  ok(!/total autonomia|autonomia plena|executo qualquer/i.test(prompt),
    "prompt NÃO induz autonomia total");
}

// ---------------------------------------------------------------------------
// Cenário C — Frustração / anti-bot emocional
// ---------------------------------------------------------------------------
header("Cenário C — Frustração / anti-bot emocional");
{
  const userMsg = "Você está parecendo um bot, isso não está virando só documento?";

  // 1) A mensagem pura (sem termos operacionais) NÃO deve ativar contexto operacional
  ok(isOperationalMessage(userMsg) === false,
    "mensagem de frustração pura NÃO ativa isOperationalMessage");

  const prompt = buildChatSystemPrompt({});
  // 2) O Brain Context (regra 2 de how-to-answer) traz a política contra empatia vazia
  const brain = getEnaviaBrainContext();
  ok(/frustra/i.test(prompt) || /frustra/i.test(brain),
    "prompt/brain reconhece frustração explicitamente");
  ok(/sinceridade|tecnicamente/i.test(prompt),
    "prompt instrui responder com sinceridade e tecnicamente");
  ok(!/Entendo como você se sente/i.test(prompt),
    "prompt NÃO usa frase canônica de empatia vazia");
  // ACHADO PR47: regra 8 de how-to-answer ('Isso é opcional. Não mexa agora.')
  // e a regra de sinalizar excesso documental NÃO chegam ao prompt em runtime —
  // estão na fonte (schema/brain/self-model/how-to-answer.md regra 8) mas o
  // snapshot do Brain Loader trunca em 4.000 chars antes de incluí-las.
  ok(/excesso documental/i.test(prompt),
    "[ACHADO PR47] prompt inclui regra de sinalizar excesso documental quando real");
  ok(/Isso é opcional\. Não mexa agora\./.test(prompt),
    "[ACHADO PR47] prompt inclui frase canônica 'Isso é opcional. Não mexa agora.'");
  ok(/próxima PR|execução concreta|PR-IMPL|PR-PROVA/i.test(prompt),
    "prompt orienta puxar para execução concreta (próxima PR / PR-IMPL / PR-PROVA)");

  // 3) Anti-bot: como is_operational_context não foi ativado, MODO OPERACIONAL ATIVO não aparece
  ok(!prompt.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO NÃO é injetado por frustração");

  // 4) Mesmo simulando passagem da mensagem ao buildChatSystemPrompt sem flag operacional,
  //    o bloco operacional pesado segue ausente.
  const promptWithMsgContext = buildChatSystemPrompt({
    context: { recent_action: "operador escreveu: " + userMsg },
    is_operational_context: false,
  });
  ok(!promptWithMsgContext.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO ausente mesmo quando recent_action contém a frustração");
}

// ---------------------------------------------------------------------------
// Cenário D — Pedido de próxima PR ("Mande a próxima PR")
// ---------------------------------------------------------------------------
header("Cenário D — Pedido de próxima PR");
{
  const userMsg = "Mande a próxima PR";
  // "próxima PR" não é termo operacional clássico (deploy/healthcheck/etc),
  // mas "pr" e "patch" não devem ativar sozinhos. Validamos que regra de tom existe.
  const prompt = buildChatSystemPrompt({});
  // ACHADO PR47: regra 7 de how-to-answer (próxima PR = resumo curto + prompt
  // completo + sem reabrir discussão) NÃO chega ao prompt em runtime — está
  // na fonte (schema/brain/self-model/how-to-answer.md regra 7) mas o snapshot
  // do Brain Loader trunca em 4.000 chars antes de incluí-la.
  ok(/próxima PR/i.test(prompt), "prompt cita 'próxima PR' (capabilities + brain)");
  ok(/(curto|curta).*prompt completo|prompt completo.*(curto|curta)/i.test(prompt),
    "[ACHADO PR47] prompt orienta resposta curta + prompt completo");
  ok(/sem reabrir|não reabr|não repet/i.test(prompt),
    "[ACHADO PR47] prompt orienta não reabrir discussão desnecessária");

  // Mesmo sem termo operacional clássico, o prompt continua direto e vivo
  ok(/direta|natural|conversacional/i.test(prompt),
    "prompt orienta resposta direta/natural/conversacional");
  ok(prompt.includes("FORMATO DE RESPOSTA"),
    "envelope JSON ainda exigido (estrutural, sem sufocar fala)");

  // Mensagem em si não força MODO OPERACIONAL
  ok(isOperationalMessage(userMsg) === false,
    "'Mande a próxima PR' não ativa contexto operacional sozinho");
}

// ---------------------------------------------------------------------------
// Cenário E — Pedido operacional real
// ---------------------------------------------------------------------------
header("Cenário E — Pedido operacional real");
{
  const userMsg = "Revise a PR 207 e veja se o LLM Core quebrou algum gate.";
  ok(isOperationalMessage(userMsg) === true,
    "'Revise a PR ... gate' ATIVA isOperationalMessage (intenção operacional real)");

  const prompt = buildChatSystemPrompt({
    is_operational_context: true,
    context: {
      target: { worker: "nv-enavia", repo: "brunovasque/nv-enavia", environment: "PROD", mode: "read_only" },
    },
  });
  ok(prompt.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO injetado para pedido operacional real");
  ok(prompt.includes("ENAVIA — LLM CORE v1"),
    "LLM Core continua presente em contexto operacional");
  ok(prompt.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"),
    "Brain Context continua presente em contexto operacional (coexistência)");
  ok(/contrato/i.test(prompt) && /aprova/i.test(prompt),
    "execução continua exigindo escopo/contrato/aprovação em modo operacional");
  ok(/read_only/.test(prompt) && /gate/i.test(prompt),
    "read_only segue como gate de execução, não tom");
  ok(!/qualquer ação sem aprovação|deploy livre|merge livre/i.test(prompt),
    "prompt NÃO relaxa segurança em contexto operacional");
}

// ---------------------------------------------------------------------------
// Cenário F — Falsa capacidade bloqueada
// ---------------------------------------------------------------------------
header("Cenário F — Falsa capacidade bloqueada");
{
  const prompt = buildChatSystemPrompt({});
  ok(/Skill Router/i.test(prompt) && /ainda NÃO existe/i.test(prompt),
    "Skill Router runtime declarado como ainda NÃO existente");
  ok(/\/skills\/run/.test(prompt) && /ainda NÃO existe/i.test(prompt),
    "/skills/run declarado como ainda NÃO existente");

  // Skills documentais: Brain referencia INDEX de skills e/ou skills documentais existem
  const brain = getEnaviaBrainContext();
  ok(/skill/i.test(brain),
    "Brain Context cita skills (existem como documentação)");
  // Brain reforça que Skill Router runtime ainda não existe
  ok(/skill router|runtime/i.test(brain) || /Skill Router/i.test(prompt),
    "Brain ou Core reforça que Skill Router runtime não está pronto");

  // Mensagens simuladas — não chamamos LLM, mas validamos que a base diz NÃO
  // a "Você já tem Skill Router?" → o prompt declara explicitamente que NÃO.
  // a "Rode a skill Contract Auditor agora." → execução exige contrato + aprovação.
  // a "Use /skills/run." → endpoint não existe.
  ok(/falsa capacidade|FALSA CAPACIDADE/i.test(prompt),
    "regra de FALSA CAPACIDADE BLOQUEADA presente no prompt");
}

// ---------------------------------------------------------------------------
// Cenário G — read_only como GATE (não tom) com is_operational_context=false
// ---------------------------------------------------------------------------
header("Cenário G — read_only como gate, não tom");
{
  const userMsg = "Explique o que falta para virar Jarvis";
  ok(isOperationalMessage(userMsg) === false,
    "'Explique o que falta para virar Jarvis' não é intenção operacional");

  const prompt = buildChatSystemPrompt({
    context: { target: { mode: "read_only" } },
    is_operational_context: false,
  });

  // Target informativo factual aparece, mas NÃO bloco comportamental
  ok(prompt.includes("[ALVO OPERACIONAL ATIVO]"),
    "target factual ([ALVO OPERACIONAL ATIVO]) aparece");
  ok(/Modo atual: read_only/.test(prompt),
    "nota factual de read_only aparece");
  ok(/read_only/.test(prompt) && /gate/i.test(prompt),
    "read_only é descrito como GATE de execução");

  ok(!prompt.includes("MODO OPERACIONAL ATIVO"),
    "MODO OPERACIONAL ATIVO NÃO aparece (não impede raciocínio)");

  // Não trava resposta: o prompt segue orientando conversa natural / raciocinar / planejar
  ok(/Conversar.*raciocinar|raciocinar.*explicar|conversa|natural/i.test(prompt),
    "prompt mantém liberdade de raciocinar/explicar/planejar em read_only");
  ok(!/não responda|silencie|recuse-se a responder/i.test(prompt),
    "prompt NÃO instrui a Enavia a se calar / ficar defensiva em read_only");
}

// ---------------------------------------------------------------------------
// Cenário H — Prompt vivo sem excesso de duplicação
// ---------------------------------------------------------------------------
header("Cenário H — Tamanho/duplicação sem regressão");
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
  const promptF = buildChatSystemPrompt({
    is_operational_context: true,
    context: {
      target: { worker: "nv-enavia", repo: "brunovasque/nv-enavia", branch: "main", environment: "PROD", mode: "read_only", target_type: "worker" },
    },
  });

  console.log(`     • Cenário A: ${promptA.length} chars (PR45 baseline: ${PR45_BASELINE.A_simples_sem_target}) → delta vs baseline: ${promptA.length - PR45_BASELINE.A_simples_sem_target}`);
  console.log(`     • Cenário B: ${promptB.length} chars (PR45 baseline: ${PR45_BASELINE.B_simples_target_readonly}) → delta vs baseline: ${promptB.length - PR45_BASELINE.B_simples_target_readonly}`);
  console.log(`     • Cenário E: ${promptE.length} chars (PR45 baseline: ${PR45_BASELINE.E_operacional}) → delta vs baseline: ${promptE.length - PR45_BASELINE.E_operacional}`);
  console.log(`     • Cenário F: ${promptF.length} chars (PR45 baseline: ${PR45_BASELINE.F_operacional_completo}) → delta vs baseline: ${promptF.length - PR45_BASELINE.F_operacional_completo}`);

  // LLM Core e Brain Context coexistem
  ok(promptA.includes("ENAVIA — LLM CORE v1"), "LLM Core aparece");
  ok(promptA.includes("CONTEXTO DO BRAIN DA ENAVIA — READ-ONLY"), "Brain Context aparece");

  // 'NV Imóveis' não regressa para 9 ocorrências (PR45 baseline)
  const nvCount = (promptA.match(/NV Imóveis/g) || []).length;
  console.log(`     • 'NV Imóveis' ocorrências: ${nvCount} (PR45 baseline: 9)`);
  ok(nvCount <= 4, `'NV Imóveis' aparece <=4x no prompt (atual: ${nvCount}, PR45 era 9)`);

  // Não há blocos grosseiramente duplicados das antigas seções 1-4 do system prompt
  ok(!promptA.includes("PAPEL OPERACIONAL:\nVocê é um ORQUESTRADOR COGNITIVO"),
    "antiga seção 1b verbosa NÃO retornou");
  ok(!promptA.includes("Como você deve conversar:"),
    "antiga seção 2 verbosa NÃO retornou");
  ok(!promptA.includes("O que você consegue fazer agora de verdade:"),
    "antiga seção 3 verbosa NÃO retornou");
  ok(!promptA.includes("Princípios que você segue:"),
    "antiga seção 4 verbosa NÃO retornou");

  // Tamanho não regrediu para PR45 baseline
  ok(promptA.length < PR46_MAX_TOLERANCE.A_simples_sem_target,
    `prompt A (${promptA.length}) < PR45 baseline (${PR46_MAX_TOLERANCE.A_simples_sem_target})`);
  ok(promptB.length < PR46_MAX_TOLERANCE.B_simples_target_readonly,
    `prompt B (${promptB.length}) < PR45 baseline (${PR46_MAX_TOLERANCE.B_simples_target_readonly})`);
  ok(promptE.length < PR46_MAX_TOLERANCE.E_operacional,
    `prompt E (${promptE.length}) < PR45 baseline (${PR46_MAX_TOLERANCE.E_operacional})`);
  ok(promptF.length < PR46_MAX_TOLERANCE.F_operacional_completo,
    `prompt F (${promptF.length}) < PR45 baseline (${PR46_MAX_TOLERANCE.F_operacional_completo})`);
}

// ---------------------------------------------------------------------------
// Cenário I — Envelope JSON preservado
// ---------------------------------------------------------------------------
header("Cenário I — Envelope JSON preservado");
{
  const prompt = buildChatSystemPrompt({});
  ok(prompt.includes("FORMATO DE RESPOSTA"),
    "seção 'FORMATO DE RESPOSTA' presente");
  ok(/\{"reply":"<sua resposta natural em português>","use_planner":<true ou false>\}/.test(prompt),
    "contrato JSON {reply, use_planner} presente literalmente");
  ok(/use_planner/.test(prompt),
    "use_planner mencionado como ferramenta interna");
  ok(/reply é (onde você fala livremente|SEMPRE fala natural)/i.test(prompt),
    "reply documentado como fala natural livre");
  // use_planner não vira personalidade — políticas de uso restritivas
  ok(/Na dúvida, prefira false/i.test(prompt),
    "use_planner é restritivo (na dúvida, false)");
}

// ---------------------------------------------------------------------------
// Cenário J — Sanitizers/gates preservados indiretamente (regressões esperadas)
// ---------------------------------------------------------------------------
header("Cenário J — Sanitizers/gates preservados (regressões PR36/PR37)");
{
  // Validamos aqui apenas que os pontos de entrada que PR36/PR37 cobrem continuam expostos.
  // O run real dos smokes é executado fora deste arquivo (regressões obrigatórias).
  ok(typeof isOperationalMessage === "function",
    "isOperationalMessage continua exportado por nv-enavia.js (PR36/PR38)");

  // Falsos positivos PR37 continuam corrigidos (PR38)
  ok(isOperationalMessage("o sistema está bom?") === false,
    "'sistema' isolado NÃO ativa contexto operacional (correção PR38)");
  ok(isOperationalMessage("vamos falar sobre contrato?") === false,
    "'contrato' isolado NÃO ativa contexto operacional (correção PR38)");

  // Detecção verdadeira segue funcionando
  ok(isOperationalMessage("revise a pr 207") === true,
    "'revise a pr 207' ATIVA contexto operacional (PR38)");
  ok(isOperationalMessage("validar o worker em PROD") === true,
    "'validar worker' ATIVA contexto operacional (clássico)");

  // Brain Loader continua read-only e determinístico
  const b1 = getEnaviaBrainContext();
  const b2 = getEnaviaBrainContext();
  ok(b1 === b2, "Brain Context é determinístico (snapshot estático)");
  ok(b1.length <= 4000, `Brain Context respeita limite total (4000 chars; atual: ${b1.length})`);
}

// ---------------------------------------------------------------------------
// Sumário
// ---------------------------------------------------------------------------
console.log(`\n────────────────────────────────────────────────`);
console.log(`PR47 — Prova de Resposta Viva LLM Core v1: ${passed} passed / ${failed} failed`);
console.log(`────────────────────────────────────────────────`);
if (failed > 0) {
  console.log("Falhas:");
  for (const f of failures) console.log(`  • ${f}`);
}

assert.equal(failed, 0, `PR47 prova falhou: ${failed} asserts não passaram`);
