// ============================================================================
// 🔍 ENAVIA — Intent Retrieval v1 (PR53 — Retrieval por Intenção)
//
// Monta um bloco documental compacto orientado pela intenção detectada e
// pelo roteamento de skill, para ser injetado no system prompt do chat.
//
// PRINCÍPIOS:
//   • Determinístico — mesma entrada → mesma saída.
//   • Sem LLM externo. Sem KV. Sem rede. Sem filesystem runtime.
//   • Sem side effects. Read-only. Conservador. Explicável.
//   • Testável isoladamente — pure function.
//
// EXPORTAÇÕES PÚBLICAS:
//   buildIntentRetrievalContext(input) — função principal
//   RETRIEVAL_MODE                     — enum de modo
//
// ESCOPO: WORKER-ONLY. Pure function. Sem side-effects.
//
// ⚠️  AVISO PERMANENTE:
//   Este módulo é READ-ONLY. Não executa skill. Não cria endpoint.
//   Não consulta KV, rede ou filesystem em runtime.
//   /skills/run não existe. Nenhuma ação é executada aqui.
// ============================================================================

// ---------------------------------------------------------------------------
// Enum público — modo de retrieval
// ---------------------------------------------------------------------------
export const RETRIEVAL_MODE = {
  READ_ONLY: "read_only",
};

// ---------------------------------------------------------------------------
// Constantes de controle
// ---------------------------------------------------------------------------

/** Limite padrão de caracteres do context_block gerado. */
const DEFAULT_MAX_CHARS = 2000;

/** Marcador de truncamento canônico. */
const TRUNCATION_MARKER = "[intent-retrieval-truncated]";

// ---------------------------------------------------------------------------
// Snapshot estático — fontes allowlist documentais
// Não lê markdown em runtime. Resumos compactos embutidos no módulo.
// Fontes originais:
//   schema/skills/CONTRACT_LOOP_OPERATOR.md
//   schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md
//   schema/skills/SYSTEM_MAPPER.md
//   schema/skills/CONTRACT_AUDITOR.md
//   schema/brain/RETRIEVAL_POLICY.md
//   schema/brain/maps/skill-map.md
// ---------------------------------------------------------------------------

/** Contexto compacto por skill_id — apenas texto seguro e sem secrets. */
const _SKILL_CONTEXT_BLOCKS = {
  CONTRACT_LOOP_OPERATOR: [
    "Contexto — CONTRACT_LOOP_OPERATOR (Loop Contratual Supervisionado):",
    "• Siga o contrato ativo sem desviar. Entregue a próxima PR conforme a sequência do contrato.",
    "• Mantenha o loop PR a PR: diagnóstico → implementação → prova → governança.",
    "• Para pedido de próxima PR: resposta curta — objetivo breve + escopo + prompt completo para execução.",
    "• Se surgir exceção corretiva, corrija, prove e retorne ao contrato — não abra frente paralela.",
    "• Não avance sem evidência real. Não misture escopos de PR distintas.",
    "• Próxima PR deve ser identificada no contrato ativo antes de iniciar.",
    "• Não reabra discussão sobre PRs já concluídas.",
  ].join("\n"),

  DEPLOY_GOVERNANCE_OPERATOR: [
    "Contexto — DEPLOY_GOVERNANCE_OPERATOR (Governança de Deploy):",
    "• Deploy exige gate/aprovação documentada. Diferencie sempre test vs. prod.",
    "• Rollback deve estar documentado antes do deploy. Não altere produção sem autorização explícita.",
    "• Não crie deploy automático nesta etapa. Gates de produção são obrigatórios.",
    "• Qualquer promoção para prod requer aprovação humana e evidência de smoke test em test.",
    "• Nunca faça deploy sem contrato ativo e aprovação registrada.",
  ].join("\n"),

  SYSTEM_MAPPER: [
    "Contexto — SYSTEM_MAPPER (Mapeador de Sistema):",
    "• Consulte o mapa/registries antes de afirmar qualquer capacidade do sistema.",
    "• Diferencie sistema documentado vs. runtime real — não são iguais.",
    "• Não invente worker, rota, binding ou endpoint. Se não houver fonte, marque incerteza.",
    "• Use System Awareness e Brain Map como referência. Se não tiver certeza, admita.",
    "• Não afirme que /skills/run existe — não existe. Skill Router é read-only.",
  ].join("\n"),

  CONTRACT_AUDITOR: [
    "Contexto — CONTRACT_AUDITOR (Auditor de Contrato):",
    "• Revise a PR contra o contrato ativo: verifique escopo, arquivos alterados, regressões.",
    "• Cheque se houve alteração proibida pelo contrato (Panel, Executor, workflows, wrangler, etc.).",
    "• Não assuma sucesso sem evidência real (testes passando, relatório existente).",
    "• Decida merge/correção somente após inspeção factual — não por intenção declarada.",
    "• Verifique se governança foi atualizada (STATUS, HANDOFF, EXECUTION_LOG, INDEX.md).",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Contextos leves por intenção sem skill clara
// ---------------------------------------------------------------------------
const _INTENT_CONTEXT_BLOCKS = {
  frustration_or_trust_issue: [
    "Contexto — Frustração ou questão de confiança:",
    "• Responda com sinceridade e reconheça o risco real de excesso documental.",
    "• Puxe a execução concreta: mostre o que já funciona, não apenas o que foi documentado.",
    "• Isso é opcional. Não mexa agora. Se houver contrato ativo, priorize a próxima PR.",
    "• Admita incerteza quando houver. Não prometa o que ainda não existe.",
  ].join("\n"),

  next_pr_request: [
    "Contexto — Pedido de próxima PR:",
    "• Resposta curta. Identifique a próxima PR autorizada pelo contrato ativo.",
    "• Forneça objetivo breve, escopo e prompt completo para execução.",
    "• Não reabra discussão — entregue a PR conforme o contrato.",
  ].join("\n"),

  capability_question: [
    "Contexto — Pergunta sobre capacidade:",
    "• Diferencie capacidade atual (o que existe agora) vs. capacidade futura (o que ainda não existe).",
    "• Não finja runtime inexistente. /skills/run não existe. Skill Executor não existe.",
    "• Consulte System Awareness e Brain Map para confirmar o que está disponível.",
    "• Marque incerteza quando não houver fonte documental confirmando a capacidade.",
  ].join("\n"),

  system_state_question: [
    "Contexto — Pergunta sobre estado do sistema:",
    "• Diferencie estado documentado vs. estado runtime real.",
    "• Consulte Brain Map e System Awareness antes de responder.",
    "• Não invente workers, bindings ou rotas que não estão mapeados.",
    "• Admita incerteza quando o estado real não puder ser verificado sem rede/KV.",
  ].join("\n"),

  strategy_question: [
    "Contexto — Pergunta estratégica:",
    "• Resposta estratégica curta. Pondere custo, tempo e risco antes de recomendar.",
    "• Sinalize opcionalidade quando aplicável: o que é urgente vs. o que pode esperar.",
    "• Se houver contrato ativo, puxe a execução para o próximo passo concreto do contrato.",
    "• Não misture estratégia com execução — diferencie o que planejar do que fazer agora.",
  ].join("\n"),
};

// ---------------------------------------------------------------------------
// Mapa de intenções → skill preferida (via Intent Classifier)
// Complementa o Skill Router quando o roteamento direto não casa.
// ---------------------------------------------------------------------------
const _INTENT_TO_SKILL = {
  next_pr_request:     "CONTRACT_LOOP_OPERATOR",
  contract_request:    "CONTRACT_LOOP_OPERATOR",
  pr_review:           "CONTRACT_AUDITOR",
  deploy_request:      "DEPLOY_GOVERNANCE_OPERATOR",
  system_state_question: "SYSTEM_MAPPER",
  capability_question: "SYSTEM_MAPPER",
  // execution_request e skill_request: deixa para o Skill Router decidir
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Trunca o texto para o limite de caracteres especificado.
 * Se truncar, adiciona TRUNCATION_MARKER ao final.
 * @param {string} text
 * @param {number} maxChars
 * @returns {{ text: string, truncated: boolean }}
 */
function _truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  // Reserva espaço para o marcador
  const markerLen = TRUNCATION_MARKER.length + 1; // +1 para "\n"
  const available = maxChars - markerLen;
  const cut = available > 0 ? text.slice(0, available) : "";
  return { text: cut + "\n" + TRUNCATION_MARKER, truncated: true };
}

/**
 * Extrai o skill_id do resultado do Skill Router, se disponível.
 * @param {object|null|undefined} skillRouting
 * @returns {string|null}
 */
function _extractSkillId(skillRouting) {
  if (!skillRouting || typeof skillRouting !== "object") return null;
  const id = skillRouting.skill_id;
  if (typeof id === "string" && id.length > 0) return id;
  return null;
}

/**
 * Extrai o intent do resultado do Intent Classifier, se disponível.
 * @param {object|null|undefined} intentClassification
 * @returns {string|null}
 */
function _extractIntent(intentClassification) {
  if (!intentClassification || typeof intentClassification !== "object") return null;
  const intent = intentClassification.intent;
  if (typeof intent === "string" && intent.length > 0) return intent;
  return null;
}

// ---------------------------------------------------------------------------
// Função principal — buildIntentRetrievalContext
// ---------------------------------------------------------------------------

/**
 * Monta o bloco de retrieval por intenção v1.
 *
 * Entrada:
 * ```js
 * {
 *   message: string,
 *   intentClassification?: object,  // resultado de classifyEnaviaIntent()
 *   skillRouting?: object,           // resultado de routeEnaviaSkill()
 *   context?: object,
 *   _max_chars?: number,             // override interno para testes
 * }
 * ```
 *
 * Saída:
 * ```js
 * {
 *   applied: boolean,
 *   mode: "read_only",
 *   intent: string | null,
 *   skill_id: string | null,
 *   sources: string[],
 *   context_block: string,
 *   warnings: string[],
 *   token_budget_hint: {
 *     max_chars: number,
 *     actual_chars: number,
 *     truncated: boolean,
 *   }
 * }
 * ```
 *
 * Determinístico. Sem LLM. Sem KV. Sem rede. Sem filesystem. Read-only.
 *
 * @param {{ message?: string, intentClassification?: object, skillRouting?: object, context?: object, _max_chars?: number }} input
 * @returns {object}
 */
export function buildIntentRetrievalContext(input) {
  // Defesa de entrada
  if (!input || typeof input !== "object") {
    return _emptyResult();
  }

  const maxChars =
    typeof input._max_chars === "number" && input._max_chars > 0
      ? input._max_chars
      : DEFAULT_MAX_CHARS;

  const warnings = [];

  // 1. Extrair skill_id e intent das entradas
  let skillId = _extractSkillId(input.skillRouting);
  const intent = _extractIntent(input.intentClassification);

  // 2. Se não há skill_id direto, tentar mapear via intenção
  if (!skillId && intent && _INTENT_TO_SKILL[intent]) {
    skillId = _INTENT_TO_SKILL[intent];
  }

  // 3. Montar sources e context_block
  const sources = [];
  let rawBlock = "";

  if (skillId && _SKILL_CONTEXT_BLOCKS[skillId]) {
    // Retrieval por skill
    rawBlock = _SKILL_CONTEXT_BLOCKS[skillId];
    sources.push(`schema/skills/${skillId}.md`);
    sources.push("schema/brain/RETRIEVAL_POLICY.md");
    sources.push("schema/brain/maps/skill-map.md");
  } else if (intent && _INTENT_CONTEXT_BLOCKS[intent]) {
    // Retrieval por intenção sem skill
    rawBlock = _INTENT_CONTEXT_BLOCKS[intent];
    sources.push("schema/brain/RETRIEVAL_POLICY.md");
  } else {
    // Sem match — applied=false
    return _noMatchResult(maxChars);
  }

  // 4. Aplicar limite de contexto
  const { text: finalBlock, truncated } = _truncate(rawBlock, maxChars);

  if (truncated) {
    warnings.push("context_block foi truncado para respeitar max_chars.");
  }
  warnings.push(
    "Intent Retrieval é read-only. Não executa skill. Não cria endpoint. " +
    "/skills/run não existe. Nenhuma ação foi executada.",
  );

  return {
    applied: true,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: intent || null,
    skill_id: skillId || null,
    sources,
    context_block: finalBlock,
    warnings,
    token_budget_hint: {
      max_chars: maxChars,
      actual_chars: finalBlock.length,
      truncated,
    },
  };
}

// ---------------------------------------------------------------------------
// Helpers de resultado canônico
// ---------------------------------------------------------------------------

/** Resultado vazio para entradas inválidas. */
function _emptyResult() {
  return {
    applied: false,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: null,
    skill_id: null,
    sources: [],
    context_block: "",
    warnings: ["Intent Retrieval recebeu entrada inválida."],
    token_budget_hint: {
      max_chars: DEFAULT_MAX_CHARS,
      actual_chars: 0,
      truncated: false,
    },
  };
}

/** Resultado para mensagens sem match de skill nem intenção relevante. */
function _noMatchResult(maxChars) {
  return {
    applied: false,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: null,
    skill_id: null,
    sources: [],
    context_block: "",
    warnings: [
      "Nenhuma fonte documental aplicável para esta mensagem. " +
      "Intent Retrieval é read-only. Não executa skill.",
    ],
    token_budget_hint: {
      max_chars: maxChars,
      actual_chars: 0,
      truncated: false,
    },
  };
}
