// ============================================================================
// 🧪 PR49 — Smoke test: Classificador de Intenção v1
//
// Valida que o Classificador de Intenção v1 classifica corretamente os
// principais tipos de mensagem antes de aplicar tom operacional, planner,
// skill futura ou resposta conversacional.
//
// Cenários obrigatórios:
//   A) Conversa simples — conversation, is_operational=false
//   B) Frustração / desconfiança — frustration_or_trust_issue, is_operational=false
//   C) Identidade / capacidade — intents corretas, is_operational=false
//   D) Próxima PR — next_pr_request, is_operational=false
//   E) Revisão de PR — pr_review, is_operational=true
//   F) Diagnóstico técnico — technical_diagnosis, is_operational=true
//   G) Deploy / execução — deploy_request ou execution_request, is_operational=true
//   H) Contrato — ação operacional vs pergunta conceitual
//   I) Skill — execução vs pergunta
//   J) Memória — memory_request, is_operational=true
//   K) Regressões PR37/PR38 — sistema/contrato isolados não ativam operacional indevido
//   L) Integração com isOperationalMessage — preservação dos acertos PR36/PR38
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM.
// Proibido: não altera nv-enavia.js, cognitive-runtime, Panel, Executor,
//           Deploy Worker, workflows, wrangler.toml ou qualquer runtime.
// ============================================================================

import { strict as assert } from "node:assert";

import {
  classifyEnaviaIntent,
  INTENT_TYPES,
  CONFIDENCE_LEVELS,
} from "../schema/enavia-intent-classifier.js";

import { isOperationalMessage } from "../nv-enavia.js";
import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";

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
// Cenário A — Conversa simples
// ---------------------------------------------------------------------------
header("Cenário A — Conversa simples");
{
  const msgOi = classifyEnaviaIntent({ message: "oi" });
  ok(msgOi.intent === INTENT_TYPES.CONVERSATION, "A1: 'oi' → conversation");
  ok(msgOi.is_operational === false, "A2: 'oi' → is_operational=false");
  ok(msgOi.confidence !== CONFIDENCE_LEVELS.LOW || msgOi.signals.length > 0,
    "A3: 'oi' → tem sinal ou confiança válida");

  const msgBomDia = classifyEnaviaIntent({ message: "bom dia" });
  ok(msgBomDia.intent === INTENT_TYPES.CONVERSATION, "A4: 'bom dia' → conversation");
  ok(msgBomDia.is_operational === false, "A5: 'bom dia' → is_operational=false");

  const msgTudoBem = classifyEnaviaIntent({ message: "tudo bem?" });
  ok(msgTudoBem.intent === INTENT_TYPES.CONVERSATION, "A6: 'tudo bem?' → conversation");
  ok(msgTudoBem.is_operational === false, "A7: 'tudo bem?' → is_operational=false");

  const msgOlaEnavia = classifyEnaviaIntent({ message: "olá Enavia" });
  ok(msgOlaEnavia.intent === INTENT_TYPES.CONVERSATION, "A8: 'olá Enavia' → conversation");
  ok(msgOlaEnavia.is_operational === false, "A9: 'olá Enavia' → is_operational=false");

  // reasons devem existir
  ok(Array.isArray(msgOi.reasons) && msgOi.reasons.length > 0, "A10: reasons não vazio para 'oi'");
  ok(Array.isArray(msgOi.signals), "A11: signals é array");
}

// ---------------------------------------------------------------------------
// Cenário B — Frustração / desconfiança
// ---------------------------------------------------------------------------
header("Cenário B — Frustração / desconfiança");
{
  const msgBot = classifyEnaviaIntent({ message: "Você está parecendo um bot" });
  ok(msgBot.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST, "B1: 'parecendo um bot' → frustration_or_trust_issue");
  ok(msgBot.is_operational === false, "B2: 'parecendo um bot' → is_operational=false");

  const msgDoc = classifyEnaviaIntent({ message: "isso está virando só documento" });
  ok(msgDoc.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST, "B3: 'virando só documento' → frustration_or_trust_issue");
  ok(msgDoc.is_operational === false, "B4: 'virando só documento' → is_operational=false");

  const msgConfianca = classifyEnaviaIntent({ message: "não estou confiando nesse projeto" });
  ok(msgConfianca.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST, "B5: 'não estou confiando' → frustration_or_trust_issue");
  ok(msgConfianca.is_operational === false, "B6: 'não estou confiando' → is_operational=false");

  const msgCade = classifyEnaviaIntent({ message: "cadê produto?" });
  ok(msgCade.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST, "B7: 'cadê produto?' → frustration_or_trust_issue");
  ok(msgCade.is_operational === false, "B8: 'cadê produto?' → is_operational=false");
}

// ---------------------------------------------------------------------------
// Cenário C — Identidade / Capacidade
// ---------------------------------------------------------------------------
header("Cenário C — Identidade / Capacidade");
{
  const msgQuemVoce = classifyEnaviaIntent({ message: "quem é você?" });
  ok(msgQuemVoce.intent === INTENT_TYPES.IDENTITY_QUESTION, "C1: 'quem é você?' → identity_question");
  ok(msgQuemVoce.is_operational === false, "C2: 'quem é você?' → is_operational=false");

  const msgOQueVoce = classifyEnaviaIntent({ message: "o que você é?" });
  ok(msgOQueVoce.intent === INTENT_TYPES.IDENTITY_QUESTION, "C3: 'o que você é?' → identity_question");
  ok(msgOQueVoce.is_operational === false, "C4: 'o que você é?' → is_operational=false");

  const msgEnavia = classifyEnaviaIntent({ message: "você é a Enavia?" });
  ok(msgEnavia.intent === INTENT_TYPES.IDENTITY_QUESTION, "C5: 'você é a Enavia?' → identity_question");
  ok(msgEnavia.is_operational === false, "C6: 'você é a Enavia?' → is_operational=false");

  const msgSabeOperar = classifyEnaviaIntent({ message: "você sabe operar seu sistema?" });
  ok(msgSabeOperar.intent === INTENT_TYPES.CAPABILITY_QUESTION, "C7: 'você sabe operar seu sistema?' → capability_question");
  ok(msgSabeOperar.is_operational === false, "C8: 'você sabe operar seu sistema?' → is_operational=false");

  const msgSkillRouter = classifyEnaviaIntent({ message: "você já tem Skill Router?" });
  ok(msgSkillRouter.intent === INTENT_TYPES.CAPABILITY_QUESTION, "C9: 'você já tem Skill Router?' → capability_question");
  ok(msgSkillRouter.is_operational === false, "C10: 'você já tem Skill Router?' → is_operational=false");

  const msgExecutarSkills = classifyEnaviaIntent({ message: "você consegue executar skills?" });
  ok(msgExecutarSkills.intent === INTENT_TYPES.CAPABILITY_QUESTION, "C11: 'você consegue executar skills?' → capability_question");
  ok(msgExecutarSkills.is_operational === false, "C12: 'você consegue executar skills?' → is_operational=false");
}

// ---------------------------------------------------------------------------
// Cenário D — Próxima PR
// ---------------------------------------------------------------------------
header("Cenário D — Próxima PR");
{
  const msgProxima = classifyEnaviaIntent({ message: "mande a próxima PR" });
  ok(msgProxima.intent === INTENT_TYPES.NEXT_PR_REQUEST, "D1: 'mande a próxima PR' → next_pr_request");
  ok(msgProxima.is_operational === false, "D2: 'mande a próxima PR' → is_operational=false");

  const msgOkMande = classifyEnaviaIntent({ message: "ok, mande a próxima" });
  ok(msgOkMande.intent === INTENT_TYPES.NEXT_PR_REQUEST, "D3: 'ok, mande a próxima' → next_pr_request");
  ok(msgOkMande.is_operational === false, "D4: 'ok, mande a próxima' → is_operational=false");

  const msgMontar = classifyEnaviaIntent({ message: "pode montar a próxima pr" });
  ok(msgMontar.intent === INTENT_TYPES.NEXT_PR_REQUEST, "D5: 'pode montar a próxima pr' → next_pr_request");
  ok(msgMontar.is_operational === false, "D6: 'pode montar a próxima pr' → is_operational=false");
}

// ---------------------------------------------------------------------------
// Cenário E — Revisão de PR
// ---------------------------------------------------------------------------
header("Cenário E — Revisão de PR");
{
  const msgRevise = classifyEnaviaIntent({ message: "revise a PR 209" });
  ok(msgRevise.intent === INTENT_TYPES.PR_REVIEW, "E1: 'revise a PR 209' → pr_review");
  ok(msgRevise.is_operational === true, "E2: 'revise a PR 209' → is_operational=true");

  const msgUrl = classifyEnaviaIntent({ message: "https://github.com/brunovasque/nv-enavia/pull/209" });
  ok(msgUrl.intent === INTENT_TYPES.PR_REVIEW, "E3: URL de PR GitHub → pr_review");
  ok(msgUrl.is_operational === true, "E4: URL de PR GitHub → is_operational=true");
  ok(msgUrl.confidence === CONFIDENCE_LEVELS.HIGH, "E5: URL de PR GitHub → confidence=high");

  const msgVeja = classifyEnaviaIntent({ message: "veja se essa PR quebrou algo" });
  ok(msgVeja.intent === INTENT_TYPES.PR_REVIEW, "E6: 'veja se essa PR quebrou algo' → pr_review");
  ok(msgVeja.is_operational === true, "E7: 'veja se essa PR quebrou algo' → is_operational=true");
}

// ---------------------------------------------------------------------------
// Cenário F — Diagnóstico técnico
// ---------------------------------------------------------------------------
header("Cenário F — Diagnóstico técnico");
{
  const msgDiag = classifyEnaviaIntent({ message: "diagnostique o runtime" });
  ok(msgDiag.intent === INTENT_TYPES.TECHNICAL_DIAGNOSIS, "F1: 'diagnostique o runtime' → technical_diagnosis");
  ok(msgDiag.is_operational === true, "F2: 'diagnostique o runtime' → is_operational=true");

  const msgLogs = classifyEnaviaIntent({ message: "verifique os logs do worker" });
  ok(msgLogs.intent === INTENT_TYPES.TECHNICAL_DIAGNOSIS, "F3: 'verifique os logs do worker' → technical_diagnosis");
  ok(msgLogs.is_operational === true, "F4: 'verifique os logs do worker' → is_operational=true");

  const msgErro = classifyEnaviaIntent({ message: "por que esse endpoint falhou?" });
  ok(msgErro.intent === INTENT_TYPES.TECHNICAL_DIAGNOSIS, "F5: 'por que esse endpoint falhou?' → technical_diagnosis");
  ok(msgErro.is_operational === true, "F6: 'por que esse endpoint falhou?' → is_operational=true");
}

// ---------------------------------------------------------------------------
// Cenário G — Deploy / execução
// ---------------------------------------------------------------------------
header("Cenário G — Deploy / execução");
{
  const msgDeploy = classifyEnaviaIntent({ message: "deploya em test" });
  ok(msgDeploy.intent === INTENT_TYPES.DEPLOY_REQUEST, "G1: 'deploya em test' → deploy_request");
  ok(msgDeploy.is_operational === true, "G2: 'deploya em test' → is_operational=true");

  const msgRollback = classifyEnaviaIntent({ message: "faça rollback" });
  ok(msgRollback.intent === INTENT_TYPES.DEPLOY_REQUEST, "G3: 'faça rollback' → deploy_request");
  ok(msgRollback.is_operational === true, "G4: 'faça rollback' → is_operational=true");

  const msgPatch = classifyEnaviaIntent({ message: "aplique o patch" });
  ok(msgPatch.intent === INTENT_TYPES.EXECUTION_REQUEST, "G5: 'aplique o patch' → execution_request");
  ok(msgPatch.is_operational === true, "G6: 'aplique o patch' → is_operational=true");
}

// ---------------------------------------------------------------------------
// Cenário H — Contrato
// ---------------------------------------------------------------------------
header("Cenário H — Contrato (ação vs pergunta)");
{
  const msgMonteContrato = classifyEnaviaIntent({ message: "monte um contrato macro" });
  ok(msgMonteContrato.intent === INTENT_TYPES.CONTRACT_REQUEST, "H1: 'monte um contrato macro' → contract_request");
  ok(msgMonteContrato.is_operational === true, "H2: 'monte um contrato macro' → is_operational=true");

  // Pergunta conceitual sobre contrato — não deve ser operacional pesado
  const msgOQueContrato = classifyEnaviaIntent({ message: "o que é esse contrato?" });
  // A mensagem "o que é esse contrato?" não contém termos de ação de contrato
  // Classificador deve retornar algo não-operacional (conversation, unknown, strategy, etc.)
  ok(msgOQueContrato.is_operational === false,
    "H3: 'o que é esse contrato?' → is_operational=false (pergunta conceitual)");
}

// ---------------------------------------------------------------------------
// Cenário I — Skill
// ---------------------------------------------------------------------------
header("Cenário I — Skill (execução vs pergunta)");
{
  const msgRodeSkill = classifyEnaviaIntent({ message: "rode a skill Contract Auditor" });
  ok(msgRodeSkill.intent === INTENT_TYPES.SKILL_REQUEST, "I1: 'rode a skill Contract Auditor' → skill_request");
  ok(msgRodeSkill.is_operational === true, "I2: 'rode a skill Contract Auditor' → is_operational=true");

  const msgQualSkill = classifyEnaviaIntent({ message: "qual skill devo usar?" });
  ok(msgQualSkill.intent === INTENT_TYPES.SKILL_REQUEST, "I3: 'qual skill devo usar?' → skill_request");
  ok(msgQualSkill.is_operational === false, "I4: 'qual skill devo usar?' → is_operational=false (pergunta)");
  ok(msgQualSkill.confidence === CONFIDENCE_LEVELS.MEDIUM, "I5: pergunta de skill → confidence=medium");
}

// ---------------------------------------------------------------------------
// Cenário J — Memória
// ---------------------------------------------------------------------------
header("Cenário J — Memória");
{
  const msgSalve = classifyEnaviaIntent({ message: "salve isso na memória" });
  ok(msgSalve.intent === INTENT_TYPES.MEMORY_REQUEST, "J1: 'salve isso na memória' → memory_request");
  ok(msgSalve.is_operational === true, "J2: 'salve isso na memória' → is_operational=true");

  const msgLembre = classifyEnaviaIntent({ message: "lembre dessa regra" });
  ok(msgLembre.intent === INTENT_TYPES.MEMORY_REQUEST, "J3: 'lembre dessa regra' → memory_request");
  ok(msgLembre.is_operational === true, "J4: 'lembre dessa regra' → is_operational=true");
}

// ---------------------------------------------------------------------------
// Cenário K — Regressões PR37/PR38
// ---------------------------------------------------------------------------
header("Cenário K — Regressões PR37/PR38: falsos positivos corrigidos");
{
  // "sistema" isolado NÃO ativa operacional
  const msgSistema = classifyEnaviaIntent({ message: "qual seu estado atual?" });
  ok(msgSistema.is_operational === false,
    "K1: 'qual seu estado atual?' → is_operational=false (falso positivo PR37 mantido corrigido)");

  // "contrato" isolado NÃO ativa operacional
  const msgContrato = classifyEnaviaIntent({ message: "explique o que é o contrato Jarvis Brain" });
  ok(msgContrato.is_operational === false,
    "K2: 'explique o que é o contrato Jarvis Brain' → is_operational=false (falso positivo PR37 mantido corrigido)");

  // "Revise a PR 197 e veja se o runtime quebrou algum gate" DEVE ativar operacional
  const msgRevisePR = classifyEnaviaIntent({ message: "Revise a PR 197 e veja se o runtime quebrou algum gate" });
  ok(msgRevisePR.is_operational === true,
    "K3: 'Revise a PR 197 e veja se o runtime quebrou algum gate' → is_operational=true (verdadeiro positivo PR37)");
  ok(msgRevisePR.intent === INTENT_TYPES.PR_REVIEW,
    "K4: 'Revise a PR 197...' → intent=pr_review");
}

// ---------------------------------------------------------------------------
// Cenário L — Integração com isOperationalMessage
// ---------------------------------------------------------------------------
header("Cenário L — Integração com isOperationalMessage");
{
  const TARGET_READ_ONLY = {
    target_id: "nv-enavia-prod",
    worker: "nv-enavia",
    repo: "brunovasque/nv-enavia",
    branch: "main",
    environment: "prod",
    mode: "read_only",
  };

  // Conversa simples: isOperationalMessage deve retornar false
  ok(!isOperationalMessage("oi", { target: TARGET_READ_ONLY }),
    "L1: 'oi' com target → isOperationalMessage=false");
  ok(!isOperationalMessage("bom dia", { target: TARGET_READ_ONLY }),
    "L2: 'bom dia' → isOperationalMessage=false");

  // Frustração: NÃO deve ativar operacional
  ok(!isOperationalMessage("você está parecendo um bot", { target: TARGET_READ_ONLY }),
    "L3: 'parecendo um bot' → isOperationalMessage=false (frustração não ativa operacional)");
  ok(!isOperationalMessage("isso está virando só documento", null),
    "L4: 'virando só documento' → isOperationalMessage=false");

  // Próxima PR: NÃO deve ativar modo operacional pesado
  ok(!isOperationalMessage("mande a próxima PR", null),
    "L5: 'mande a próxima PR' → isOperationalMessage=false (não ativa operacional pesado)");

  // Revisão de PR: DEVE ativar operacional
  ok(isOperationalMessage("revise a PR 209", null),
    "L6: 'revise a PR 209' → isOperationalMessage=true");

  // Diagnóstico técnico: DEVE ativar operacional
  ok(isOperationalMessage("diagnostique o runtime", null),
    "L7: 'diagnostique o runtime' → isOperationalMessage=true");

  // Deploy: DEVE ativar operacional
  ok(isOperationalMessage("faça o deploy", null),
    "L8: 'faça o deploy' → isOperationalMessage=true");

  // Rollback: DEVE ativar operacional
  ok(isOperationalMessage("faça rollback", null),
    "L9: 'faça rollback' → isOperationalMessage=true");
}

// ---------------------------------------------------------------------------
// Cenário M — Integração com prompt: frustração/conversa não injeta MODO OPERACIONAL ATIVO
// ---------------------------------------------------------------------------
header("Cenário M — Integração com prompt: intenção não-operacional não injeta MODO OPERACIONAL ATIVO");
{
  // Conversa simples
  const promptOi = buildChatSystemPrompt({
    ownerName: "Bruno",
    is_operational_context: false,
  });
  ok(!promptOi.includes("MODO OPERACIONAL ATIVO"),
    "M1: prompt com is_operational_context=false NÃO injeta MODO OPERACIONAL ATIVO");

  // Revisão de PR (operacional)
  const promptRevisao = buildChatSystemPrompt({
    ownerName: "Bruno",
    is_operational_context: true,
    context: { target: { worker: "nv-enavia", environment: "prod", mode: "read_only" } },
  });
  ok(promptRevisao.includes("MODO OPERACIONAL ATIVO"),
    "M2: prompt com is_operational_context=true INJETA MODO OPERACIONAL ATIVO");

  // LLM Core continua presente
  ok(promptOi.includes("LLM CORE"),
    "M3: LLM Core presente em prompt de conversa simples");
  ok(promptRevisao.includes("LLM CORE"),
    "M4: LLM Core presente em prompt operacional");

  // read_only continua como gate (não tom)
  ok(!promptOi.includes("MODO READ-ONLY CONFIRMADO"),
    "M5: sem target, NÃO injeta 'MODO READ-ONLY CONFIRMADO'");
}

// ---------------------------------------------------------------------------
// Cenário N — Saída do classificador: estrutura canônica
// ---------------------------------------------------------------------------
header("Cenário N — Estrutura canônica da saída");
{
  const result = classifyEnaviaIntent({ message: "diagnóstico do worker" });
  ok(typeof result.intent === "string", "N1: intent é string");
  ok(["high", "medium", "low"].includes(result.confidence), "N2: confidence é high|medium|low");
  ok(typeof result.is_operational === "boolean", "N3: is_operational é boolean");
  ok(Array.isArray(result.reasons), "N4: reasons é array");
  ok(Array.isArray(result.signals), "N5: signals é array");
  ok(result.reasons.length > 0, "N6: reasons não está vazio quando há match");

  // Mensagem vazia → unknown, is_operational=false
  const emptyResult = classifyEnaviaIntent({ message: "" });
  ok(emptyResult.intent === INTENT_TYPES.UNKNOWN, "N7: mensagem vazia → unknown");
  ok(emptyResult.is_operational === false, "N8: mensagem vazia → is_operational=false");

  // Input inválido → sem crash
  let noError = true;
  try { classifyEnaviaIntent(null); } catch (_e) { noError = false; }
  ok(noError, "N9: classifyEnaviaIntent(null) não quebra");

  let noError2 = true;
  try { classifyEnaviaIntent({}); } catch (_e) { noError2 = false; }
  ok(noError2, "N10: classifyEnaviaIntent({}) não quebra");
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log(`\n=== PR49 — Classificador de Intenção v1 (smoke) ===`);
console.log(`Resultado: ${passed}/${passed + failed} asserts passaram.\n`);

if (failures.length > 0) {
  console.log("Falhas:");
  for (const f of failures) {
    console.log(`  ❌ ${f}`);
  }
  process.exit(1);
} else {
  console.log("✅ Todos os asserts passaram.");
  process.exit(0);
}
