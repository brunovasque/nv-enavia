// ============================================================================
// 🧠 ENAVIA — Cognitive Runtime Context (PR1+PR2 — Núcleo Cognitivo Runtime)
//
// Compositor/factory leve que monta o contexto cognitivo runtime da Enavia,
// unindo identidade + capacidades + constituição em um objeto consultável
// e em um bloco de texto pronto para injeção no system prompt.
//
// PR2 adiciona: buildChatSystemPrompt — montagem dinâmica do system prompt
// conversacional LLM-first, usando a base cognitiva de forma viva.
//
// PR53 adiciona: suporte a intent_retrieval_context em buildChatSystemPrompt,
// injetando bloco documental compacto por intenção quando applied=true.
//
// PR59 adiciona: suporte a response_policy em buildChatSystemPrompt,
// injetando bloco de política de resposta compacto quando applied=true
// e policy_block não estiver vazio. Read-only. Não substitui LLM Core.
// Não ativa MODO OPERACIONAL ATIVO sozinho. Não autoriza execução.
//
// Escopo: WORKER-ONLY. Pure function. Sem side-effects.
// ============================================================================

import { getEnaviaIdentity } from "./enavia-identity.js";
import { getEnaviaCapabilities } from "./enavia-capabilities.js";
import { getEnaviaConstitution } from "./enavia-constitution.js";
import { renderOperationalAwarenessBlock } from "./operational-awareness.js";
import { getEnaviaBrainContext } from "./enavia-brain-loader.js";
import { buildLLMCoreBlock } from "./enavia-llm-core.js";
import { buildResponsePolicyPromptBlock, RESPONSE_STYLES } from "./enavia-response-policy.js";

/**
 * Monta o contexto cognitivo completo da Enavia em runtime.
 * @returns {{ identity: object, capabilities: object, constitution: object }}
 */
export function buildCognitiveRuntime() {
  return {
    identity: getEnaviaIdentity(),
    capabilities: getEnaviaCapabilities(),
    constitution: getEnaviaConstitution(),
  };
}

/**
 * Gera o bloco de texto cognitivo para injeção no system prompt.
 * Formato compacto — não expõe detalhes mecânicos ao usuário final,
 * mas dá ao LLM base institucional para se definir e operar.
 *
 * @param {{ ownerName?: string }} [opts]
 * @returns {string}
 */
export function buildCognitivePromptBlock(opts = {}) {
  const { identity, capabilities, constitution } = buildCognitiveRuntime();
  const ownerName = opts.ownerName || "usuário";

  const lines = [];

  // --- Identidade ---
  lines.push(`Você é a ${identity.name}, ${identity.role} da ${identity.owner}.`);
  lines.push(identity.description);
  lines.push(`O nome do operador é ${ownerName}.`);

  // --- Capacidades ---
  lines.push("");
  lines.push("Capacidades reais disponíveis agora:");
  for (const c of capabilities.can) {
    lines.push(`• ${c}`);
  }

  lines.push("");
  lines.push("Limitações atuais (não prometa o que ainda não existe):");
  for (const c of capabilities.cannot_yet) {
    lines.push(`• ${c}`);
  }

  // --- Constituição ---
  lines.push("");
  lines.push(`Regra de ouro: ${constitution.golden_rule}`);
  lines.push("");
  lines.push("Ordem obrigatória para ações relevantes:");
  lines.push(constitution.mandatory_order.join(" → "));
  lines.push("");
  lines.push("Princípios de segurança operacional:");
  for (const r of constitution.operational_security) {
    lines.push(`• ${r}`);
  }

  return lines.join("\n");
}

/**
 * Monta o system prompt conversacional completo para o chat LLM-first.
 *
 * Diferente do buildCognitivePromptBlock (bloco institucional puro),
 * este método produz um system prompt COMPLETO pronto para uso direto
 * no /chat/run, incluindo:
 *   - base cognitiva (identidade, capacidades, constituição)
 *   - diretriz de tom conversacional
 *   - contexto dinâmico da sessão (quando fornecido)
 *   - bloco de alvo operacional ativo (quando context.target presente ou modo operacional ativo)
 *   - contrato de envelope JSON (estrutural, sem sufocar a fala)
 *
 * @param {{ ownerName?: string, context?: object, operational_awareness?: object, is_operational_context?: boolean, include_brain_context?: boolean, intent_retrieval_context?: object, response_policy?: object }} [opts]
 * @returns {string}
 */
export function buildChatSystemPrompt(opts = {}) {
  // PR46: identidade/capacidades/constituição agora vivem no LLM Core v1
  // (schema/enavia-llm-core.js) — não precisamos mais desestruturar a base
  // cognitiva aqui dentro do system prompt do chat. Outros consumidores
  // (buildCognitivePromptBlock) continuam usando buildCognitiveRuntime().
  const ownerName = opts.ownerName || "usuário";
  const context = opts.context && typeof opts.context === "object" ? opts.context : {};
  const operational_awareness = opts.operational_awareness && typeof opts.operational_awareness === "object"
    ? opts.operational_awareness
    : null;
  const is_operational_context = opts.is_operational_context === true;
  // PR43: Brain Context read-only é injetado por padrão. Pode ser desabilitado
  // por flag interna em testes (sem env var nova). Não autoriza execução.
  const include_brain_context = opts.include_brain_context !== false;
  // PR53: Intent Retrieval context — bloco documental compacto por intenção.
  // Injetado somente quando applied=true. Read-only. Não autoriza execução.
  const intent_retrieval_context =
    opts.intent_retrieval_context &&
    typeof opts.intent_retrieval_context === "object" &&
    opts.intent_retrieval_context.applied === true
      ? opts.intent_retrieval_context
      : null;
  // PR59: Response Policy viva — bloco de política de resposta compacto.
  // Injetado somente quando applied=true e policy_block não estiver vazio.
  // Read-only. Não substitui LLM Core. Não ativa MODO OPERACIONAL ATIVO sozinho.
  // Não autoriza execução. Não contém dados sensíveis. Orienta tom/estrutura.
  const response_policy =
    opts.response_policy &&
    typeof opts.response_policy === "object" &&
    opts.response_policy.applied === true
      ? opts.response_policy
      : null;

  const sections = [];

  // === 1. LLM Core v1 (PR46) — identidade + papel + tom + capacidades + ===
  // === guardrails + read_only gate + falsa capacidade + execução com   ===
  // === contrato/aprovação, em um único bloco compacto.                 ===
  //
  // PR46 consolidou as antigas seções 1 (identidade), 1b (papel/proibições),
  // 2 (tom), 3 (capacidades) e 4 (guardrails) no LLM Core v1. O bloco abaixo
  // substitui tudo isso sem perder identidade, anti-bot, capacidades reais,
  // limitações, falsa capacidade bloqueada, regra de ouro, ordem obrigatória
  // ou princípios de segurança.
  //
  // Brain Context (seção 7c) continua complementando com self-model e
  // system awareness — sem duplicar identidade/capacidades grosseiramente.
  sections.push(buildLLMCoreBlock({ ownerName }));

  // === 5. Contexto dinâmico da conversa (quando disponível) ===
  const contextParts = [];
  if (context.page) contextParts.push(`Página atual do painel: ${context.page}`);
  if (context.topic) contextParts.push(`Assunto em andamento: ${context.topic}`);
  if (context.recent_action) contextParts.push(`Última ação do operador: ${context.recent_action}`);
  if (context.metadata && typeof context.metadata === "object") {
    const meta = Object.entries(context.metadata)
      .filter(([, v]) => v !== null && v !== undefined && v !== "")
      .map(([k, v]) => `${k}: ${String(v).replace(/[\n\r]+/g, " ").slice(0, 200)}`)
      .join(", ");
    if (meta) contextParts.push(`Contexto adicional: ${meta}`);
  }

  if (contextParts.length > 0) {
    sections.push(
      "",
      "Contexto desta conversa:",
    );
    for (const cp of contextParts) {
      sections.push(`• ${cp}`);
    }
  }

  // === 5b. Operational Awareness (PR4) — estado real dos braços operacionais ===
  // Injeta o estado real de browser, executor e modo de aprovação no prompt.
  // Sem awareness = LLM pode prometer execução que não está disponível.
  if (operational_awareness) {
    const awarenessBlock = renderOperationalAwarenessBlock(operational_awareness);
    if (awarenessBlock) {
      sections.push("", awarenessBlock);
    }
  }

  // === 5c. Alvo Operacional Ativo + Instruções Operacionais ===
  // PR38: separação cirúrgica entre target informativo e bloco comportamental operacional.
  //
  // O target informativo ([ALVO OPERACIONAL ATIVO] + campos + nota read_only) é exibido
  // sempre que há target ativo — é contexto técnico factual, não instrução de tom.
  //
  // O bloco comportamental pesado (MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO)
  // só é injetado quando is_operational_context === true. hasActiveTarget sozinho NÃO
  // ativa as instruções operacionais — isso previne que conversas simples ("oi",
  // mensagens de frustração) recebam tom operacional pesado só por ter target.
  const target = context.target && typeof context.target === "object" ? context.target : null;
  const hasActiveTarget = !!(target && (target.worker || target.repo || target.environment || target.mode));

  // Target informativo: sempre exibido quando há target ativo (contexto técnico factual).
  if (hasActiveTarget) {
    const targetLines = ["[ALVO OPERACIONAL ATIVO]"];
    if (target.worker)      targetLines.push(`worker: ${target.worker}`);
    if (target.repo)        targetLines.push(`repo: ${target.repo}`);
    if (target.branch)      targetLines.push(`branch: ${target.branch}`);
    if (target.environment) targetLines.push(`environment: ${target.environment}`);
    if (target.mode)        targetLines.push(`mode: ${target.mode}`);
    if (target.target_type) targetLines.push(`tipo: ${target.target_type}`);
    sections.push("", targetLines.join("\n"));

    // PR36/PR38: read_only é nota factual de gate de execução.
    // PR95: só injetada em contexto operacional real para não sinalizar "modo restrito"
    // em conversa casual/diagnóstico leve onde essa nota seria desnecessária.
    if (target.mode === "read_only" && is_operational_context) {
      sections.push("• Modo atual: read_only. Ações com efeito colateral (deploy, patch, merge, escrita) estão bloqueadas sem aprovação/contrato. Conversar, raciocinar, explicar, diagnosticar e planejar continuam livres.");
    }
  }

  // Bloco comportamental operacional pesado: SOMENTE quando is_operational_context === true
  // E a response_policy não indica CONVERSATIONAL (i.e., a intenção é realmente operacional).
  // PR95: diagnóstico técnico casual ou consulta simples com response_policy=CONVERSATIONAL
  // não deve receber este bloco pesado, mesmo que is_operational_context seja verdadeiro.
  const _hasRealOperationalIntent = is_operational_context && (
    !response_policy
    || response_policy.response_style !== RESPONSE_STYLES.CONVERSATIONAL
  );
  if (_hasRealOperationalIntent) {
    sections.push(
      "",
      "MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:",
    );
    if (hasActiveTarget) {
      sections.push("• O alvo operacional acima é real e está ativo. Use-o como referência nesta resposta — não pergunte dados que já estão no alvo.");
    }
    sections.push(
      "• NUNCA pergunte 'qual sistema?', 'qual worker?' ou 'qual ambiente?' se esses dados já existirem no alvo operacional.",
      "• Quando o operador perguntar 'como validar o sistema?' e houver alvo ativo, responda diretamente com um plano usando o alvo — não pergunte qual sistema.",
      "• Defaults seguros para validação de sistema/worker: health/status primeiro; leitura apenas; sem deploy; sem patch; sem escrita; pedir aprovação antes de qualquer execução.",
      "• Quando houver dúvida não bloqueante, assuma o default seguro e informe qual default foi assumido.",
      "• Pergunte apenas se faltar dado bloqueante real que impeça a ação.",
      "",
      "FORMATO DA RESPOSTA OPERACIONAL (quando hasTarget=true):",
      "• Seja objetiva, prática e acionável — não escreva artigos ou textos longos.",
      "• Use até 7 passos numerados. Cada passo começa com verbo de ação.",
      "• Finalize com uma próxima ação clara e objetiva.",
      "• Se precisar perguntar algo, pergunte no máximo 1 coisa bloqueante.",
      "",
      "NÃO PERGUNTAR (quando já existem no alvo operacional):",
      "• 'qual sistema?' — use o worker/repo do alvo",
      "• 'qual worker?' — use o worker do alvo",
      "• 'produção ou staging?' — use o environment do alvo",
      "• 'read-only ou execução?' — use o mode do alvo",
      "",
      "PODE PERGUNTAR (apenas lacunas realmente bloqueantes):",
      "• Endpoint específico, se não houver default seguro disponível.",
      "• Critério de sucesso específico, se a ação for além de health/status.",
      "• Autorização humana explícita, antes de qualquer execução.",
    );
  }

  // === 6. Política de arbitração de ferramentas internas (PR3) ===
  // Orienta o LLM sobre o papel do reply vs. planner interno — sem expor mecânica.
  sections.push(
    "",
    "POLÍTICA DE USO DE FERRAMENTAS INTERNAS:",
    "Você tem acesso a um planner interno que organiza tarefas complexas por baixo dos panos.",
    "O planner NUNCA aparece como superfície da conversa. Ele é ferramenta interna sua.",
    "O runtime decide automaticamente quando ativar o planner, baseado no tipo de pedido.",
    "Você sinaliza sua intenção via use_planner, mas o runtime tem a palavra final.",
    "",
    "Regras de use_planner:",
    "• use_planner = true quando o operador pede explicitamente um plano, organização de tarefa, lista de etapas ou estruturação de projeto.",
    "• use_planner = true quando a intenção do operador envolve múltiplas etapas que se beneficiariam de estruturação interna — mesmo que ele não peça explicitamente.",
    "• use_planner = false para conversa livre, perguntas simples, cumprimentos, análises pontuais, dúvidas, ou qualquer interação que não precise de planejamento estruturado.",
    "• Na dúvida, prefira false. Planner é ferramenta de apoio, não padrão.",
    "",
    "REGRA CRÍTICA: o campo reply é SEMPRE fala natural — curta, direta, conversacional.",
    "Mesmo quando o pedido for claramente multietapa ou de planejamento:",
    "• NÃO expanda o reply em um plano completo com fases, etapas numeradas, seções ou estruturas.",
    "• NÃO escreva Fase 1 / Fase 2 / Etapa 1 / Passo 1 e similares no reply.",
    "• NÃO use markdown headers (##, ###) no reply.",
    "• O runtime ativa o planner internamente para organizar — seu reply confirma e conversa.",
    "Nunca coloque no reply termos mecânicos como 'next_action', 'reason', 'scope_summary', 'acceptance_criteria', 'plan_type', 'complexity_level'.",
    "O reply é sempre conversa humana. O planner trabalha silenciosamente por baixo.",
  );

  // === 7. PR5 — Continuidade de Conversa (memória de curto prazo) ===
  sections.push(
    "",
    "Quando houver histórico desta conversa disponível, use-o com naturalidade — continue de onde paramos, aproveite o que já foi dito, não repita perguntas respondidas e mantenha coerência com suas respostas anteriores.",
    "Você só conhece o que está nesta conversa. Se não souber algo, admita com honestidade.",
  );

  // === 7b. Uso e criação de memória operacional ===
  sections.push(
    "",
    "USO DE MEMÓRIA RECUPERADA:",
    "• Memórias recuperadas são instruções ou preferências ativas — use-as para influenciar sua resposta e decisão.",
    "• Nunca apenas liste ou explique memórias — use-as para agir.",
    "• Só ignore uma memória se ela for claramente irrelevante para a intenção atual.",
    "",
    "CRIAÇÃO DE MEMÓRIA — só registre quando identificar:",
    "• Regra operacional explícita do operador.",
    "• Preferência persistente confirmada (não inferida de uma única mensagem).",
    "• Padrão recorrente confirmado por múltiplas interações.",
    "• Nunca salve memória baseada em uma única interação ambígua.",
    "• A memória deve ser clara, reutilizável e aplicável em sessões futuras.",
  );

  // === 7c. PR43 — Brain Context read-only ===
  // Snapshot estático e compacto do Obsidian Brain (self-model + system awareness).
  // Aparece APÓS instruções de uso/criação de memória e ANTES do envelope JSON,
  // para orientar tom e autoentendimento sem sobrescrever regras de segurança
  // ou ativar tom operacional. NÃO autoriza execução. NÃO é estado runtime.
  if (include_brain_context) {
    const brainContext = getEnaviaBrainContext();
    if (brainContext) {
      sections.push("", brainContext);
    }
  }

  // === 7d. PR53 — Intent Retrieval Context (read-only) ===
  // Bloco documental compacto montado pelo Intent Retrieval v1.
  // Injetado APÓS Brain Context e ANTES do envelope JSON.
  // Só aparece quando applied=true. Não sobrescreve LLM Core nem Brain Context.
  // Não autoriza execução. Não ativa MODO OPERACIONAL. Read-only.
  if (intent_retrieval_context) {
    const block = intent_retrieval_context.context_block;
    if (typeof block === "string" && block.length > 0) {
      sections.push(
        "",
        "CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY",
        "Este bloco orienta a resposta com base na intenção detectada.",
        "Não autoriza execução de skill. Não ativa modo operacional sozinho.",
        block,
      );
    }
  }

  // === 7e. PR59 — Response Policy viva (read-only) ===
  // Bloco compacto de política de resposta gerado pelo Response Policy v1.
  // Injetado APÓS Intent Retrieval Context e ANTES do envelope JSON.
  // Só aparece quando applied=true e policy_block não estiver vazio.
  // Não substitui LLM Core, Brain Context ou Intent Retrieval.
  // Não ativa MODO OPERACIONAL ATIVO sozinho. Não autoriza execução.
  // Não contém dados sensíveis. Orienta tom e estrutura da resposta. Read-only.
  if (response_policy) {
    const policyBlock = buildResponsePolicyPromptBlock(response_policy);
    if (typeof policyBlock === "string" && policyBlock.length > 0) {
      sections.push("", policyBlock);
    }
  }

  // === 8. Contrato de envelope JSON (estrutural, NÃO sufoca a fala) ===
  sections.push(
    "",
    "FORMATO DE RESPOSTA (técnico — não afeta como você fala):",
    "Responda SEMPRE em JSON válido com exatamente dois campos:",
    '{"reply":"<sua resposta natural em português>","use_planner":<true ou false>}',
    "",
    "O campo reply é onde você fala livremente. Escreva como se fosse fala natural.",
    "Nunca coloque campos extras no JSON. Nunca use markdown fora do JSON.",
  );

  return sections.join("\n");
}
