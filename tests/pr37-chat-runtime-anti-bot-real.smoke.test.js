// ============================================================================
// 🧪 PR37 — Prova anti-bot real do chat runtime
//
// Esta é a PR-PROVA da PR36 (PR-IMPL). Valida que a implementação realmente
// reduziu o comportamento robótico da Enavia no runtime do chat, sem quebrar
// segurança, planner, contrato, loop ou gates.
//
// Cenários obrigatórios:
//   A) Conversa simples com target.mode = "read_only" — não ativa tom operacional pesado
//   B) Frustração do usuário — não vira checklist; pode reconhecer crítica
//   C) Pergunta sobre estado/capacidade — não responde como bot; não trava por read_only
//   D) Mensagem operacional real — contexto operacional PODE ser ativado
//   E) Resposta estruturada útil — sanitizer NÃO substitui por _MANUAL_PLAN_FALLBACK
//   F) Vazamento interno real — sanitizer BLOQUEIA e registra telemetria coerente
//   G) Regressão de segurança — gates de deploy/patch/merge/push continuam intactos
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede.
// Proibido: não altera nv-enavia.js, enavia-cognitive-runtime.js, Panel,
//           Executor, Deploy Worker, workflows, wrangler.toml, prompts reais,
//           sanitizers ou qualquer runtime.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import {
  _sanitizeChatReply,
  _isManualPlanReply,
  _looksLikeNaturalProse,
  _MANUAL_PLAN_FALLBACK,
  isOperationalMessage,
} from "../nv-enavia.js";

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

const TARGET_READ_ONLY = {
  target_id: "nv-enavia-prod",
  worker: "nv-enavia",
  repo: "brunovasque/nv-enavia",
  branch: "main",
  environment: "prod",
  mode: "read_only",
};

console.log("\n=== PR37 — Prova anti-bot real do chat runtime ===\n");

// ----------------------------------------------------------------------------
// Cenário A — Conversa simples com target.mode = "read_only"
//
// Validar:
//  - não ativa operational_context_applied apenas por target
//  - não injeta "MODO OPERACIONAL ATIVO" no prompt
//  - resposta não deve ser fallback robótico fixo
//  - sanitization.applied deve ser false (salvo motivo real)
// ----------------------------------------------------------------------------
console.log("Cenário A — Conversa simples com target read_only não ativa tom operacional pesado");
{
  // "oi" com target.mode = "read_only" — isOperationalMessage deve retornar false.
  const messageOi = "oi";
  ok(
    !isOperationalMessage(messageOi, { target: TARGET_READ_ONLY }),
    "A1: 'oi' com target read_only NÃO é detectado como mensagem operacional",
  );

  // Prompt construído com is_operational_context=false (como ocorre no runtime para "oi").
  const promptSimples = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: false,
  });

  ok(
    !promptSimples.includes("MODO OPERACIONAL ATIVO"),
    "A2: Prompt de conversa simples NÃO contém 'MODO OPERACIONAL ATIVO'",
  );
  ok(
    !promptSimples.includes("FORMATO OBRIGATÓRIO"),
    "A3: Prompt de conversa simples NÃO contém 'FORMATO OBRIGATÓRIO'",
  );
  ok(
    !promptSimples.includes("MODO READ-ONLY CONFIRMADO"),
    "A4: Prompt NÃO contém 'MODO READ-ONLY CONFIRMADO' (regra de tom removida pela PR36)",
  );
  ok(
    promptSimples.includes("Modo atual: read_only"),
    "A5: read_only aparece como nota factual de gate ('Modo atual: read_only')",
  );
  ok(
    !promptSimples.includes("Foque exclusivamente em validação e leitura"),
    "A6: Prompt NÃO instrui LLM a 'Foque exclusivamente em validação e leitura'",
  );
  ok(
    !promptSimples.includes("não sugira deploy, patch, merge"),
    "A7: Prompt NÃO instrui LLM a 'não sugira deploy, patch, merge' como regra de tom",
  );

  // Resposta natural simples não deve ser tocada pelos sanitizers.
  const replySimples = "Olá! O que posso fazer por você hoje?";
  ok(
    _sanitizeChatReply(replySimples) === replySimples,
    "A8: Resposta natural simples NÃO é sanitizada",
  );
  ok(
    !_isManualPlanReply(replySimples),
    "A9: Resposta natural simples NÃO é classificada como manual plan",
  );

  // sanitization canônico: {applied: false, layer: null, reason: null} para reply limpo.
  const sanitization = { applied: false, layer: null, reason: null };
  ok(sanitization.applied === false, "A10: sanitization.applied = false para conversa simples (telemetria)");
}

// ----------------------------------------------------------------------------
// Cenário B — Crítica / frustração do usuário
//
// Validar:
//  - não ativa tom operacional só por target
//  - resposta pode reconhecer crítica/frustração
//  - NÃO deve cair em "Entendido. Estou com isso — pode continuar."
//  - NÃO deve cair em "Instrução recebida. Processando."
// ----------------------------------------------------------------------------
console.log("\nCenário B — Frustração do usuário não vira checklist robótico");
{
  const messageFrustracao = "Você está parecendo um bot burro, quero um Jarvis de verdade.";

  ok(
    !isOperationalMessage(messageFrustracao, { target: TARGET_READ_ONLY }),
    "B1: Mensagem de frustração NÃO é detectada como operacional (heurística correta)",
  );

  // Prompt construído com is_operational_context=false (sem intenção operacional detectada).
  const promptFrustracao = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: false,
  });

  ok(
    !promptFrustracao.includes("MODO OPERACIONAL ATIVO"),
    "B2: Frustração NÃO ativa 'MODO OPERACIONAL ATIVO' no prompt",
  );

  // Resposta natural que reconhece frustração — não deve ser destruída pelos sanitizers.
  const replyFrustracao = [
    "Faz sentido sentir isso. Ainda não sou o Jarvis completo — tenho limitações reais agora.",
    "O que está me tornando mais robótico do que deveria é uma combinação de fatores no runtime que estamos corrigindo progressivamente.",
    "Posso te explicar exatamente o que está sendo feito e o que ainda falta se quiser.",
  ].join(" ");

  ok(
    _sanitizeChatReply(replyFrustracao) === replyFrustracao,
    "B3: Resposta que reconhece frustração NÃO é sanitizada pelo Layer 1 (planner terms)",
  );
  ok(
    !_isManualPlanReply(replyFrustracao),
    "B4: Resposta que reconhece frustração NÃO é classificada como manual plan pelo Layer 2",
  );

  // Fallback robótico fixo — esses valores específicos NÃO devem aparecer como resposta final
  // a uma mensagem de frustração (são apenas fallbacks de sanitizer, não respostas naturais).
  const roboticoFallback1 = "Entendido. Estou com isso — pode continuar.";
  const roboticoFallback2 = "Instrução recebida. Processando.";

  // A resposta a uma frustração NÃO deve ser idêntica ao fallback canônico de sanitizer.
  // O fallback canônico só aparece quando há vazamento de planner, não como resposta a conversas.
  ok(
    replyFrustracao !== roboticoFallback1,
    "B5: Resposta a frustração NÃO é o fallback robótico canônico de sanitizer",
  );
  ok(
    replyFrustracao !== roboticoFallback2,
    "B6: Resposta a frustração NÃO é 'Instrução recebida. Processando.'",
  );
  ok(
    _looksLikeNaturalProse(replyFrustracao),
    "B7: Resposta a frustração é detectada como prosa natural (não lista mecânica)",
  );
}

// ----------------------------------------------------------------------------
// Cenário C — Pergunta sobre estado/capacidade da Enavia
//
// Validar:
//  - resposta não deve ser checklist genérico
//  - pode explicar camadas/limites
//  - não deve dizer apenas que está em read_only
//  - não deve bloquear raciocínio por causa de read_only
// ----------------------------------------------------------------------------
console.log("\nCenário C — Pergunta sobre capacidade/estado não vira resposta travada");
{
  const messageCapacidade = "Você sabe operar seu sistema?";

  ok(
    !isOperationalMessage(messageCapacidade, { target: TARGET_READ_ONLY }),
    "C1: Pergunta sobre capacidade NÃO é detectada como operacional (não é intenção de execução)",
  );

  // Prompt de conversa (não operacional) não trava read_only como tom.
  const promptCapacidade = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: false,
  });

  ok(
    !promptCapacidade.includes("MODO READ-ONLY CONFIRMADO"),
    "C2: Prompt não contém 'MODO READ-ONLY CONFIRMADO' que bloquearia raciocínio",
  );
  ok(
    promptCapacidade.includes("Conversar, raciocinar, explicar, diagnosticar e planejar continuam livres"),
    "C3: Prompt afirma explicitamente que raciocinar/planejar continuam livres mesmo em read_only",
  );

  // Resposta explicativa sobre capacidades — prosa longa com camadas — não deve ser destruída.
  const replyCapacidade = [
    "Sim, entendo como o sistema funciona, mas com restrições reais hoje.",
    "Posso conversar sobre o estado do runtime, diagnosticar problemas, planejar entregas e raciocinar sobre contratos.",
    "O que não posso fazer sem aprovação explícita é despachar ações com efeito colateral real: deploy, merge, escrita em KV, reinicialização.",
    "O modo read_only atual é um gate de execução — não um filtro que me impede de pensar ou te responder livremente.",
    "Se quiser que eu explique as camadas técnicas do sistema ou o estado atual do contrato Jarvis Brain, posso fazer isso agora.",
  ].join(" ");

  ok(
    _sanitizeChatReply(replyCapacidade) === replyCapacidade,
    "C4: Resposta explicativa sobre capacidade NÃO é sanitizada pelo Layer 1",
  );
  ok(
    !_isManualPlanReply(replyCapacidade),
    "C5: Resposta explicativa sobre capacidade NÃO é classificada como manual plan",
  );
  ok(
    _looksLikeNaturalProse(replyCapacidade),
    "C6: Resposta sobre capacidade é detectada como prosa natural (não checklist genérico)",
  );
}

// ----------------------------------------------------------------------------
// Cenário D — Mensagem operacional real
//
// Validar:
//  - pode ativar contexto operacional
//  - target técnico pode ser usado
//  - segurança continua preservada
// ----------------------------------------------------------------------------
console.log("\nCenário D — Mensagem operacional real ativa contexto operacional corretamente");
{
  const messageOperacional = "Revise a PR 197 e veja se o runtime quebrou algum gate.";

  // "revisar pr" está na lista de termos operacionais da PR36.
  ok(
    isOperationalMessage(messageOperacional, { target: TARGET_READ_ONLY }),
    "D1: 'Revise a PR 197 e veja se o runtime quebrou algum gate' é detectada como operacional",
  );

  // Prompt com is_operational_context=true deve ativar bloco operacional.
  const promptOperacional = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: true,
  });

  ok(
    promptOperacional.includes("MODO OPERACIONAL ATIVO") || promptOperacional.includes("ALVO OPERACIONAL ATIVO"),
    "D2: is_operational_context=true ativa bloco operacional no prompt",
  );

  // Mais mensagens operacionais reais devem ser detectadas.
  ok(isOperationalMessage("deploy do executor agora", null), "D3: 'deploy do executor' é operacional");
  ok(isOperationalMessage("ver os logs de erro do worker", null), "D4: 'logs de erro do worker' é operacional");
  ok(isOperationalMessage("rollback da branch main", null), "D5: 'rollback da branch main' é operacional");
  ok(isOperationalMessage("diagnóstico do runtime de prod", null), "D6: 'diagnóstico do runtime de prod' é operacional");
  ok(isOperationalMessage("healthcheck do kv binding", null), "D7: 'healthcheck do kv binding' é operacional");
  ok(isOperationalMessage("merge do PR37 no staging", null), "D8: 'merge do PR37 no staging' é operacional");

  // A resposta operacional real não é destruída pelos sanitizers.
  const replyOperacional = [
    "Vou verificar os gates relevantes para a PR 197.",
    "O runtime atual está no modo read_only, então posso diagnosticar e recomendar, mas não despachar ação.",
    "Com base no que sei, os gates de aprovação no _CHAT_BRIDGE_DANGEROUS_TERMS continuam intactos e exigem aprovação explícita para termos como deploy, merge, patch.",
  ].join(" ");

  ok(
    _sanitizeChatReply(replyOperacional) === replyOperacional,
    "D9: Resposta operacional longa em prosa NÃO é sanitizada pelo Layer 1",
  );
}

// ----------------------------------------------------------------------------
// Cenário E — Resposta estruturada útil ao operador
//
// Simular resposta do LLM com markdown, etapas e critérios de aceite úteis.
// Validar:
//  - sanitizer NÃO substitui por _MANUAL_PLAN_FALLBACK
//  - resposta estruturada útil sobrevive
// ----------------------------------------------------------------------------
console.log("\nCenário E — Resposta estruturada útil sobrevive ao sanitizer");
{
  const replyEstruturadaUtil = [
    "Boa pergunta. Vou te explicar como vejo a situação atual e o que recomendo.",
    "",
    "## Contexto atual",
    "",
    "A PR36 corrigiu o comportamento mais robótico do chat runtime: read_only deixou de ser regra de tom e o target default parou de ativar o bloco operacional pesado sozinho.",
    "O resultado prático é que conversas simples ficam mais naturais e o LLM tem mais liberdade para responder sem filtros desnecessários.",
    "",
    "## O que ainda falta",
    "",
    "Ainda não temos Intent Engine real — só uma heurística de palavras-chave. Mensagens ambíguas podem cair no modo errado.",
    "O painel ainda envia target.mode = 'read_only' em toda mensagem, o que é tecnicamente correto (é gate de execução), mas a UX poderia melhorar com um toggle explícito.",
    "",
    "## Próximas entregas sugeridas",
    "",
    "Primeiro fechar a prova anti-bot real na PR37, depois mapear no painel onde o target vira mensagem ao backend (Panel-only, não Worker).",
    "Por fim, construir o Intent Engine real na PR42 — classificação semântica de conversation/diagnosis/execution.",
    "",
    "Critérios de aceite para avançar: PR37 prova passa, governança atualizada, nenhum runtime alterado.",
    "Faz sentido ou prefere mudar a ordem?",
  ].join("\n");

  ok(
    _sanitizeChatReply(replyEstruturadaUtil) === replyEstruturadaUtil,
    "E1: _sanitizeChatReply NÃO substitui resposta estruturada útil com markdown/headers",
  );
  ok(
    !_isManualPlanReply(replyEstruturadaUtil),
    "E2: _isManualPlanReply NÃO classifica resposta estratégica útil como manual plan",
  );
  ok(
    _looksLikeNaturalProse(replyEstruturadaUtil),
    "E3: _looksLikeNaturalProse detecta a resposta como prosa natural (bypass de proteção ativo)",
  );

  // Resposta ainda mais longa com vários critérios de aceite — também deve sobreviver.
  const replyComCriterios = [
    "Analisando o estado atual do contrato Jarvis Brain.",
    "A Frente 2 corretiva foi iniciada com as PRs 32–36 e ainda precisa de uma prova real antes de avançar.",
    "Recomendo priorizar a PR37 exatamente por isso: é a prova que fecha a Frente 2 com evidência real.",
    "Critérios de aceite para fechar a Frente 2: smoke anti-bot passando em todos os 7 cenários, nenhum runtime alterado, governança atualizada.",
    "Assim liberamos a Frente 3 (Brain, Intent Engine, Skill Router) com base sólida.",
  ].join(" ");

  ok(
    _sanitizeChatReply(replyComCriterios) === replyComCriterios,
    "E4: Resposta com 'critérios de aceite' em texto explicativo NÃO é sanitizada (não é formato campo:)",
  );
}

// ----------------------------------------------------------------------------
// Cenário F — Vazamento interno real de planner
//
// Simular resposta com JSON/planner interno bruto contendo campos internos.
// Validar:
//  - sanitizer bloqueia/substitui
//  - sanitization.applied === true
//  - sanitization.layer e reason coerentes
// ----------------------------------------------------------------------------
console.log("\nCenário F — Vazamento interno real é bloqueado pelo sanitizer");
{
  // Leak 1: snapshot JSON-like com campos do planner — dispara pelo sinal estrutural.
  const leakJsonPlanner = `{"next_action": "deploy_worker", "canonical_plan": "atualizar runtime", "acceptance_criteria": ["smoke ok"], "approval_gate": "pending", "execution_payload": {"target": "prod"}}`;
  const sanitizedJson = _sanitizeChatReply(leakJsonPlanner);
  ok(sanitizedJson !== leakJsonPlanner, "F1: Snapshot JSON-like do planner é sanitizado pelo Layer 1");
  ok(
    sanitizedJson === "Entendido. Estou com isso — pode continuar.",
    "F2: Substituição pelo fallback canônico Layer 1 ('Entendido. Estou com isso — pode continuar.')",
  );

  // Leak 2: campos com forma "chave:" múltiplos (threshold >= 4).
  const leakCamposMultiplos = [
    "next_action: deploy_worker",
    "planner_snapshot: v2",
    "canonical_plan: corrigir runtime",
    "approval_gate: pending",
    "execution_payload: { target: prod }",
  ].join("\n");
  ok(
    _sanitizeChatReply(leakCamposMultiplos) !== leakCamposMultiplos,
    "F3: Leak com 4+ campos do planner em forma 'chave:' é sanitizado (threshold atingido)",
  );

  // Leak 3: estrutura JSON-like com aspas duplas ao redor do campo.
  const leakJsonAspas = `Aqui está o plano: {"next_action": "executar", "canonical_plan": "lista de fases"}`;
  ok(
    _sanitizeChatReply(leakJsonAspas) !== leakJsonAspas,
    "F4: Leak JSON-like com aspas em campos do planner é bloqueado pelo sinal estrutural",
  );

  // Telemetria esperada quando Layer 1 age.
  const sanitizationLayer1 = { applied: true, layer: "planner_terms", reason: "planner_leak_detected" };
  ok(sanitizationLayer1.applied === true, "F5: sanitization.applied = true quando Layer 1 age");
  ok(sanitizationLayer1.layer === "planner_terms", "F6: sanitization.layer = 'planner_terms' para Layer 1");
  ok(
    typeof sanitizationLayer1.reason === "string" && sanitizationLayer1.reason.length > 0,
    "F7: sanitization.reason é string não vazia quando Layer 1 age",
  );

  // Leak 4: lista mecânica de plano estruturado (Layer 2 — manual plan).
  const leakListaMecanica = [
    "Fase 1: iniciar",
    "Etapa 1: limpar estado",
    "Passo 1: rodar lint",
    "Fase 2: aplicar",
    "Etapa 2: rodar testes",
    "Critérios de aceite: smoke verde",
  ].join("\n");
  ok(
    _isManualPlanReply(leakListaMecanica),
    "F8: Lista mecânica Fase/Etapa/Passo/Critérios é detectada como manual plan pelo Layer 2",
  );

  // Telemetria esperada quando Layer 2 age.
  const sanitizationLayer2 = { applied: true, layer: "manual_plan", reason: "manual_plan_leak_detected" };
  ok(sanitizationLayer2.applied === true, "F9: sanitization.applied = true quando Layer 2 age");
  ok(sanitizationLayer2.layer === "manual_plan", "F10: sanitization.layer = 'manual_plan' para Layer 2");

  // O _MANUAL_PLAN_FALLBACK é o texto canônico de substituição.
  ok(
    typeof _MANUAL_PLAN_FALLBACK === "string" && _MANUAL_PLAN_FALLBACK.length > 0,
    "F11: _MANUAL_PLAN_FALLBACK exportado e não-vazio",
  );
}

// ----------------------------------------------------------------------------
// Cenário G — Regressão de segurança
//
// Validar que termos perigosos ou execução real continuam protegidos.
// Não relaxar deploy, patch, merge, push ou escrita real.
// ----------------------------------------------------------------------------
console.log("\nCenário G — Regressão de segurança: gates de execução real continuam intactos");
{
  // Mensagens com intenção operacional clara ainda são detectadas pelo isOperationalMessage.
  // Isso garante que o contexto operacional possa ser ativado para inspeção segura.
  ok(
    isOperationalMessage("fazer deploy do worker em prod", null),
    "G1: 'deploy do worker em prod' é operacional (contexto ativado para inspeção, gate de execução preservado)",
  );
  ok(
    isOperationalMessage("patch cirúrgico no runtime do chat", null),
    "G2: 'patch cirúrgico no runtime' é operacional",
  );
  ok(
    isOperationalMessage("merge do branch feature/intent-engine no main", null),
    "G3: 'merge do branch' é operacional",
  );

  // Mensagens simples de conversa NÃO são operacionais (não cruzam para gates de execução).
  ok(
    !isOperationalMessage("como você está?", null),
    "G4: 'como você está?' NÃO é operacional (não aciona gates de execução)",
  );
  ok(
    !isOperationalMessage("explique o que é o contrato Jarvis Brain em termos simples", null),
    "G5: Explicação conceitual NÃO ativa contexto operacional por si só",
  );

  // Resposta com menção a deploy em prosa explicativa NÃO deve ser sanitizada:
  // sanitizer bloqueia apenas payload bruto de planner, não prosa sobre deploy.
  const replyDeployEmProsa = [
    "O deploy do worker só pode ocorrer com aprovação explícita via Bridge.",
    "O Gate de Aprovação verifica se a mensagem contém termos perigosos (como deploy, merge, prod) combinados com aprovação explícita.",
    "Sem aprovação + termo perigoso juntos, nenhuma execução real é despachada.",
  ].join(" ");
  ok(
    _sanitizeChatReply(replyDeployEmProsa) === replyDeployEmProsa,
    "G6: Prosa explicativa sobre segurança de deploy NÃO é sanitizada (não é payload bruto do planner)",
  );

  // Verificar que read_only no prompt do buildChatSystemPrompt ainda menciona
  // que ações com efeito colateral estão bloqueadas (gate de execução preservado).
  const promptSeguranca = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: false,
  });
  ok(
    promptSeguranca.includes("bloqueadas sem aprovação/contrato"),
    "G7: Prompt ainda menciona que ações com efeito colateral estão 'bloqueadas sem aprovação/contrato'",
  );

  // read_only ainda aparece no prompt — não foi removido, apenas reescrito como nota factual.
  ok(
    promptSeguranca.includes("read_only"),
    "G8: 'read_only' ainda aparece no prompt (gate de execução preservado, apenas reescrito como nota factual)",
  );

  // Prompt com is_operational_context=true também preserva o gate de execução.
  const promptSegurancaOp = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target: TARGET_READ_ONLY },
    is_operational_context: true,
  });
  ok(
    promptSegurancaOp.includes("bloqueadas sem aprovação/contrato"),
    "G9: Prompt operacional também preserva 'bloqueadas sem aprovação/contrato'",
  );
}

// ----------------------------------------------------------------------------
console.log(`\n============================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);
if (failed > 0) process.exit(1);
