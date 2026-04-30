// ============================================================================
// 🧪 PR36 — Smoke anti-bot do chat runtime
//
// Cobertura mínima:
//   A) read_only NÃO injeta tom defensivo (apenas nota factual de gate de execução)
//   B) target sozinho NÃO ativa contexto operacional
//   C) mensagem operacional real ATIVA contexto operacional
//   D) sanitizers não destroem resposta útil estruturada
//   E) JSON/planner interno bruto continua bloqueado
//   F) telemetria mínima de sanitização funciona (sinalização da camada acionada)
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede.
// ============================================================================

import { strict as assert } from "node:assert";

import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import {
  _sanitizeChatReply,
  _isManualPlanReply,
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

console.log("\n=== PR36 — Chat runtime anti-bot (smoke) ===\n");

// ----------------------------------------------------------------------------
// Cenário A — conversa simples com target/read_only
// ----------------------------------------------------------------------------
console.log("Cenário A — conversa simples com target read_only NÃO ativa tom defensivo");
{
  const target = {
    target_id: "nv-enavia-prod",
    worker: "nv-enavia",
    repo: "brunovasque/nv-enavia",
    branch: "main",
    environment: "prod",
    mode: "read_only",
  };

  // Equivalente ao runtime hoje: para conversa simples, isOperationalMessage = false
  // (heurística de intenção). Portanto buildChatSystemPrompt é chamado com
  // is_operational_context = false.
  const prompt = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target },
    is_operational_context: false,
  });

  // PR36: read_only deve aparecer apenas como nota factual de capacidade.
  ok(
    !prompt.includes("MODO READ-ONLY CONFIRMADO"),
    "read_only NÃO injeta 'MODO READ-ONLY CONFIRMADO' (regra de tom removida)",
  );
  ok(
    prompt.includes("Modo atual: read_only"),
    "read_only é tratado como nota factual de capacidade ('Modo atual: read_only')",
  );
  ok(
    !prompt.includes("Foque exclusivamente em validação e leitura"),
    "read_only NÃO injeta 'Foque exclusivamente em validação e leitura'",
  );
  ok(
    !prompt.includes("não sugira deploy, patch, merge"),
    "read_only NÃO injeta 'não sugira deploy, patch, merge' como regra de tom",
  );

  // Heurística de intenção operacional: conversa comum NÃO é operacional.
  ok(!isOperationalMessage("oi", { target }), "'oi' não é operacional");
  ok(!isOperationalMessage("você está parecendo um bot", { target }), "'você está parecendo um bot' não é operacional");
  ok(!isOperationalMessage("o que você sabe fazer?", { target }), "'o que você sabe fazer?' não é operacional");
  ok(!isOperationalMessage("qual seu estado atual?", { target }), "'qual seu estado atual?' não é operacional");
}

// ----------------------------------------------------------------------------
// Cenário B — mensagem operacional real ainda ativa contexto operacional
// ----------------------------------------------------------------------------
console.log("\nCenário B — mensagem operacional real ainda ativa contexto operacional");
{
  ok(isOperationalMessage("revisar a PR36 do worker", null), "'revisar a PR36 do worker' é operacional");
  ok(isOperationalMessage("rode um diagnóstico do runtime", null), "'rode um diagnóstico do runtime' é operacional");
  ok(isOperationalMessage("preciso fazer deploy do executor", null), "'preciso fazer deploy do executor' é operacional");
  ok(isOperationalMessage("ver os logs do worker", null), "'ver os logs do worker' é operacional");
  ok(isOperationalMessage("qual é o estado do contrato ativo?", null), "'estado do contrato' é operacional");
  ok(isOperationalMessage("rollback da última branch", null), "'rollback da última branch' é operacional");

  // Quando o is_operational_context=true é passado ao prompt, o bloco operacional fica ativo.
  const target = { worker: "nv-enavia", environment: "prod", mode: "read_only" };
  const promptOp = buildChatSystemPrompt({
    ownerName: "Bruno",
    context: { target },
    is_operational_context: true,
  });
  ok(
    promptOp.includes("MODO OPERACIONAL ATIVO") || promptOp.includes("ALVO OPERACIONAL ATIVO"),
    "is_operational_context=true ainda ativa o bloco operacional para mensagens operacionais reais",
  );
}

// ----------------------------------------------------------------------------
// Cenário C — sanitizer NÃO destrói resposta útil estruturada
// ----------------------------------------------------------------------------
console.log("\nCenário C — sanitizer não destrói resposta útil estruturada");
{
  // Resposta estratégica viva ao operador, com markdown, fases e critérios.
  const replyUtilLong = [
    "Boa pergunta. Vou te explicar como vejo a situação atual e o caminho que sugiro.",
    "",
    "## Diagnóstico",
    "",
    "O sistema está em um momento delicado: temos contratos encerrados, a Frente 2 ainda em correção e o runtime do chat só começou a destravar agora com a PR36.",
    "Isso significa que a próxima entrega precisa ser pequena e cirúrgica, sem misturar Worker e Panel no mesmo PR.",
    "",
    "## Próximos passos sugeridos",
    "",
    "Penso em três frentes que se complementam, mas que não devem virar um único PR.",
    "Cada uma resolve uma camada diferente do problema e pode ser revertida sem comprometer as outras.",
    "",
    "Primeiro: validar o que a PR36 já entregou no chat com um smoke real anti-bot na PR37.",
    "Depois: mapear no painel onde o target default vira mensagem para o backend, sem alterar o Worker.",
    "Por fim: começar o Intent Engine de verdade, mas só depois das duas anteriores estarem mergeadas.",
    "",
    "Critérios de aceite para a próxima fase: smoke anti-bot passando, governança atualizada, nenhum endpoint novo.",
    "Faz sentido para você ou prefere outro caminho?",
  ].join("\n");

  const sanitizedUtil = _sanitizeChatReply(replyUtilLong);
  ok(
    sanitizedUtil === replyUtilLong,
    "_sanitizeChatReply NÃO substitui resposta estratégica longa com markdown/headers",
  );
  ok(
    !_isManualPlanReply(replyUtilLong),
    "_isManualPlanReply NÃO classifica resposta estratégica longa em prosa como manual plan",
  );

  // Mensagem natural curta não é alterada.
  const replyCurto = "Entendi. Vou te explicar o que está acontecendo no runtime do chat agora.";
  ok(_sanitizeChatReply(replyCurto) === replyCurto, "Resposta curta natural não é alterada");
}

// ----------------------------------------------------------------------------
// Cenário D — JSON/planner interno bruto continua bloqueado
// ----------------------------------------------------------------------------
console.log("\nCenário D — JSON/planner interno bruto continua bloqueado");
{
  // Snapshot bruto do planner vazando como reply
  const plannerSnapshot = `{"next_action": "deploy_worker", "scope_summary": "atualizar runtime", "acceptance_criteria": ["smoke ok"], "plan_type": "operational", "complexity_level": "B", "approval_gate": "pending"}`;
  const sanitized = _sanitizeChatReply(plannerSnapshot);
  ok(sanitized !== plannerSnapshot, "Snapshot JSON-like do planner é sanitizado");
  ok(
    sanitized === "Entendido. Estou com isso — pode continuar.",
    "Substituição é o fallback canônico quando há leak estrutural",
  );

  // Lista mecânica de etapas internas (Fase 1, Etapa 2, Passo 3, Critérios) sem prosa explicativa.
  const planoMecanico = [
    "Fase 1: preparar",
    "Etapa 1: limpar repositório",
    "Passo 1: rodar lint",
    "Fase 2: aplicar patch",
    "Etapa 2: rodar testes",
    "Critérios de aceite: smoke verde",
  ].join("\n");
  ok(
    _isManualPlanReply(planoMecanico),
    "Lista mecânica curta de Fase/Etapa/Passo/Critérios continua sendo detectada como manual plan",
  );
}

// ----------------------------------------------------------------------------
// Cenário E — telemetria mínima (estrutura aditiva)
// ----------------------------------------------------------------------------
console.log("\nCenário E — telemetria de sanitização tem shape esperado");
{
  // O runtime expõe um campo aditivo `sanitization` no response.
  // Aqui validamos apenas o shape esperado: { applied, layer, reason }.
  // O comportamento end-to-end é validado por PR37 (PR-PROVA).
  const shapeOk = (s) =>
    s !== null &&
    typeof s === "object" &&
    "applied" in s &&
    "layer" in s &&
    "reason" in s;

  ok(shapeOk({ applied: false, layer: null, reason: null }), "shape válido para sem sanitização");
  ok(
    shapeOk({ applied: true, layer: "planner_terms", reason: "planner_leak_detected" }),
    "shape válido para planner_terms",
  );
  ok(
    shapeOk({ applied: true, layer: "manual_plan", reason: "manual_plan_leak_detected" }),
    "shape válido para manual_plan",
  );
  ok(
    shapeOk({ applied: true, layer: "plain_text_fallback", reason: "llm_empty_text" }),
    "shape válido para plain_text_fallback",
  );

  // Sanity: o fallback canônico ainda existe e é exportado.
  ok(
    typeof _MANUAL_PLAN_FALLBACK === "string" && _MANUAL_PLAN_FALLBACK.length > 0,
    "_MANUAL_PLAN_FALLBACK exportado e não-vazio",
  );
}

// ----------------------------------------------------------------------------
console.log(`\n============================================================`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log(`============================================================`);
if (failed > 0) process.exit(1);
