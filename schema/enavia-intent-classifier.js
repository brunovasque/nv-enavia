// ============================================================================
// 🧠 ENAVIA — Intent Classifier v1 (PR49 — Classificador de Intenção)
//
// Classificador determinístico de intenção conversacional da Enavia.
// Separa os principais tipos de mensagem antes de aplicar tom operacional,
// planner, skill futura ou resposta conversacional.
//
// PRINCÍPIOS:
//   • Determinístico — mesma entrada → mesma saída.
//   • Sem LLM externo. Sem KV. Sem rede. Sem filesystem. Sem side-effects.
//   • Conservador — na dúvida, classifica como "conversation" ou "unknown".
//   • Explicável — reasons descreve os sinais que levaram à decisão.
//   • Testável isoladamente — pure function.
//
// EXPORTAÇÕES PÚBLICAS:
//   classifyEnaviaIntent(input) — classificador principal
//   INTENT_TYPES                — enum de intenções canônicas v1
//   CONFIDENCE_LEVELS           — enum de confiança
//
// ESCOPO: WORKER-ONLY. Pure function. Sem side-effects.
// ============================================================================

// ---------------------------------------------------------------------------
// Enum público — intenções canônicas v1
// ---------------------------------------------------------------------------
export const INTENT_TYPES = {
  CONVERSATION:             "conversation",
  FRUSTRATION_OR_TRUST:     "frustration_or_trust_issue",
  IDENTITY_QUESTION:        "identity_question",
  CAPABILITY_QUESTION:      "capability_question",
  SYSTEM_STATE_QUESTION:    "system_state_question",
  NEXT_PR_REQUEST:          "next_pr_request",
  PR_REVIEW:                "pr_review",
  TECHNICAL_DIAGNOSIS:      "technical_diagnosis",
  EXECUTION_REQUEST:        "execution_request",
  DEPLOY_REQUEST:           "deploy_request",
  CONTRACT_REQUEST:         "contract_request",
  SKILL_REQUEST:            "skill_request",
  MEMORY_REQUEST:           "memory_request",
  STRATEGY_QUESTION:        "strategy_question",
  IMPROVEMENT_REQUEST:      "improvement_request",
  UNKNOWN:                  "unknown",
};

// ---------------------------------------------------------------------------
// Enum público — níveis de confiança
// ---------------------------------------------------------------------------
export const CONFIDENCE_LEVELS = {
  HIGH:   "high",
  MEDIUM: "medium",
  LOW:    "low",
};

// ---------------------------------------------------------------------------
// Constantes de controle — thresholds e parâmetros de classificação
// ---------------------------------------------------------------------------

// Limite de caracteres para considerar uma mensagem "curta sem match".
// Mensagens com até este valor e sem nenhum sinal reconhecido recebem intent=unknown
// (não conversation) para não bloquear a heurística legada em isOperationalMessage.
// 30 chars cobre cumprimentos curtos sem incluir frases que já teriam
// casado em alguma das listas de sinais.
const _SHORT_MESSAGE_THRESHOLD = 30;

// ---------------------------------------------------------------------------
// Sinais internos — listas determinísticas por categoria semântica
// Normalizados para minúsculas na comparação.
// ---------------------------------------------------------------------------

// Cumprimentos / conversa social
const _GREETING_TERMS = [
  "oi", "olá", "ola", "bom dia", "boa tarde", "boa noite",
  "tudo bem", "tudo bom", "como vai", "e aí", "eae", "oi enavia",
  "olá enavia", "hey", "hi", "hello",
];

// Frustração / desconfiança com o projeto ou a IA
const _FRUSTRATION_TERMS = [
  "parecendo um bot", "parece um bot", "virando bot",
  "virando só documento", "virou só documento",
  "só documento", "só docs", "só documentação",
  "cadê produto", "cadê a entrega", "cadê o produto",
  "não estou confiando", "não confio mais", "perdi a confiança",
  "isso não funciona", "não está funcionando", "nada funciona",
  "só faz documento", "faz só documento",
  "você não entende", "você não está entendendo",
  "inútil", "está me decepcionando", "me decepcionou",
  "parece que não anda", "não anda", "travado nisso",
  "parecendo robô", "parece robô",
  "não confio", "desconfiando",
];

// Perguntas de identidade — quem/o que é a Enavia
const _IDENTITY_TERMS = [
  "quem é você", "o que você é", "você é a enavia",
  "você é uma ia", "você é um bot", "você é humano",
  "me fale sobre você", "se apresente", "se apresenta",
  "qual é seu nome", "seu nome", "quem é a enavia",
  "o que é a enavia", "o que você faz", "para que você serve",
];

// Perguntas de capacidade — o que a Enavia sabe/consegue fazer
const _CAPABILITY_TERMS = [
  "você sabe", "você consegue", "você pode",
  "você já tem", "você tem skill", "você tem o skill",
  "skill router", "você tem intent engine", "você executa skills",
  "você consegue executar", "você consegue operar",
  "você opera seu sistema", "o que você sabe fazer",
  "quais são suas capacidades", "quais capacidades",
  "suas limitações", "você é capaz",
];

// Perguntas sobre estado/situação do sistema
const _SYSTEM_STATE_TERMS = [
  "qual o estado atual", "qual é o estado", "qual estado",
  "o que já existe no sistema", "o que já existe",
  "o que falta", "o que está faltando",
  "o que está pronto", "o que já foi entregue",
  "o que já está implementado", "situação atual",
  "como está o sistema", "como está a enavia",
  "status do sistema", "status atual",
  "qual o status",
];

// Pedido de próxima PR / próxima etapa
const _NEXT_PR_TERMS = [
  "mande a próxima pr", "mande a próxima",
  "monte a próxima pr", "monte a próxima",
  "pode montar a próxima pr", "pode montar a próxima",
  "próxima pr", "next pr", "qual é a próxima pr",
  "qual a próxima pr", "manda a próxima", "ok, mande",
  "ok mande", "tá, manda", "ta manda",
  "pode mandar a próxima", "gera a próxima",
  "gere a próxima pr", "cria a próxima pr",
];

// Revisão de PR — URL de pull request ou pedido explícito de revisão
const _PR_REVIEW_TERMS = [
  "revise a pr", "revise a pull request", "revisar a pr",
  "review pr", "revisar pull request", "ver essa pr",
  "analisar a pr", "analise a pr", "veja essa pr",
  "veja se essa pr", "veja se a pr",
  "github.com/", "/pull/", "pull request",
];

// Diagnóstico técnico — inspecionar, verificar, diagnosticar
const _TECHNICAL_DIAGNOSIS_TERMS = [
  "diagnostique", "diagnostica", "diagnóstico",
  "verifique o worker", "verifique os logs", "verifique o runtime",
  "veja os logs", "ver os logs", "cheque o runtime",
  "inspecione", "veja o erro", "ver o erro",
  "por que esse endpoint falhou", "por que falhou",
  "por que o worker", "por que o runtime",
  "verificar o sistema", "auditar o sistema",
  "auditoria do sistema", "checar o worker",
  "checar os logs", "checar o runtime",
];

// Execução — pedidos de aplicar/executar ação técnica sem deploy explícito
const _EXECUTION_TERMS = [
  "execute isso", "aplique o patch", "aplica o patch",
  "rode o fluxo", "rode o loop", "aplique a correção",
  "aplica a correção", "execute o fluxo", "faça o patch",
  "aplica o fix", "aplique o fix",
];

// Deploy — pedidos de deploy, rollback, produção
const _DEPLOY_TERMS = [
  "deploya", "deploy", "deploye", "fazer deploy",
  "faça o deploy", "mande pra produção", "manda pra produção",
  "subir pra produção", "subir em produção",
  "rollback", "roll back", "reverter deploy",
  "rodar deploy", "executar deploy", "executar em prod",
  "push pra produção",
];

// Contrato — criação, atualização, revisão de contrato
// Inclui termos compostos operacionais: "estado do contrato" e "contrato ativo"
// previnem falso negativo para verificações de estado de contrato (PR38).
const _CONTRACT_ACTION_TERMS = [
  "crie um contrato", "criar contrato", "monte contrato",
  "monte um contrato", "montar contrato", "atualize o contrato",
  "atualizar o contrato", "revise o contrato", "revisar o contrato",
  "feche o contrato", "encerre o contrato", "volta ao contrato",
  "retorne ao contrato", "volte ao contrato",
  "contrato macro", "criar macro", "montar macro",
  "estado do contrato", "contrato ativo",
];

// Skill — pedido para executar/rodar skill
const _SKILL_RUN_TERMS = [
  "rode a skill", "rodar a skill", "execute a skill",
  "executar a skill", "use a skill", "usar a skill",
  "acione a skill", "acionar a skill",
  "skill contract auditor", "skill deploy governance",
  "skill system mapper", "skill contract loop",
  "aplicar a skill",
];

// Skill — pergunta sobre skill (não execução)
const _SKILL_QUESTION_TERMS = [
  "qual skill", "quais skills", "qual skill devo usar",
  "qual skill usar", "qual é a skill", "existe skill",
  "tem skill", "tem alguma skill",
];

// Memória — pedidos de salvar, guardar, lembrar
const _MEMORY_TERMS = [
  "salve isso", "salve na memória", "guarda isso",
  "guarde isso", "guarde na memória", "salvar na memória",
  "lembre disso", "lembre-se disso", "memorize",
  "registre isso", "salvar memória", "guardar regra",
  "guarde essa regra", "lembre dessa regra",
];

// Estratégia — qual caminho, o que vale a pena, decisões macro
const _STRATEGY_TERMS = [
  "qual o melhor caminho", "qual é o melhor caminho",
  "isso vale a pena", "vale a pena agora",
  "devemos seguir com isso", "devo seguir com isso",
  "o que você recomenda", "qual sua recomendação",
  "qual seria a melhor abordagem", "qual abordagem",
  "faz sentido seguir", "faz sentido",
  "é uma boa ideia", "é boa ideia",
];

// PR110: Melhoria — pedido de melhoria/correção de subsistema para disparar ciclo audit→PR
// Termos gatilho: verbos de melhoria em português e inglês
const _IMPROVEMENT_TRIGGER_TERMS = [
  "melhora ", "melhore ", "melhoria no", "melhoria do", "melhoria em",
  "melhorar o", "melhorar a", "melhorar os", "melhorar as",
  "corrige o", "corrige a", "corrija o", "corrija a",
  "corrigir o", "corrigir a",
  "refatora o", "refatora a", "refatore o", "refatore a",
  "refatorar o", "refatorar a",
  "otimiza o", "otimiza a", "otimize o", "otimize a",
  "otimizar o", "otimizar a",
  "conserta o", "conserta a", "conserte o", "conserte a",
  "consertar o", "consertar a",
  "fix the", "fix this", "improve the", "improve this",
  "enhance the", "enhance this", "refactor the", "refactor this",
];

// PR110: Padrões de target — rotas, subsistemas e funções nomeadas
// Detecta alvos como /audit, /chat, /propose, nome-de-endpoint, etc.
const _IMPROVEMENT_TARGET_PATTERNS = [
  /\/[a-z][a-z0-9/_-]*/,                  // rotas: /audit, /chat/run, /contracts
  /\b(audit|chat|propose|deploy|executor|worker|bridge|endpoint|função|function|handler|módulo|module)\b/i,
  /\b(log(?:s)? de erro|mensagem de erro|erro de |error log|logging)\b/i,
  /\b(validação|validation|sanitização|sanitization|autenticação|authentication)\b/i,
];

// PR110: Negações — palavras que, próximas ao gatilho, cancelam a intenção
// Verificadas nos 5 tokens anteriores ao termo gatilho
const _NEGATION_TERMS = [
  "não", "nao", "sem", "never", "no ", "don't", "doesn't",
  "without", "sem precisar", "não precisa",
];

// ---------------------------------------------------------------------------
// PR110: _extractImprovementTarget — extrai o alvo da melhoria do texto
// Retorna string com o target ou null se não encontrado.
// ---------------------------------------------------------------------------
function _extractImprovementTarget(normalized) {
  for (const pattern of _IMPROVEMENT_TARGET_PATTERNS) {
    const match = normalized.match(pattern);
    if (match) return match[0].trim();
  }
  return null;
}

// ---------------------------------------------------------------------------
// PR110: _hasNegationBefore — verifica se há negação nos 5 tokens anteriores
// ao termo encontrado.
// ---------------------------------------------------------------------------
function _hasNegationBefore(normalized, term) {
  const idx = normalized.indexOf(term);
  if (idx < 0) return false;
  const prefix = normalized.slice(Math.max(0, idx - 40), idx);
  return _NEGATION_TERMS.some((neg) => prefix.includes(neg));
}

// ---------------------------------------------------------------------------
// _normalize — normaliza texto para comparação
// ---------------------------------------------------------------------------
function _normalize(text) {
  if (typeof text !== "string") return "";
  return text.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// _containsAny — verifica se texto contém algum termo da lista
// ---------------------------------------------------------------------------
function _containsAny(text, terms) {
  const normalized = _normalize(text);
  return terms.filter((t) => normalized.includes(t));
}

// ---------------------------------------------------------------------------
// _isPRUrl — detecta URL de pull request do GitHub
// ---------------------------------------------------------------------------
function _isPRUrl(text) {
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(text);
}

// ---------------------------------------------------------------------------
// classifyEnaviaIntent(input)
//
// Classifica a intenção da mensagem do operador.
//
// @param {{ message: string, context?: object }} input
// @returns {{
//   intent: string,
//   confidence: "high"|"medium"|"low",
//   is_operational: boolean,
//   reasons: string[],
//   signals: string[]
// }}
// ---------------------------------------------------------------------------
export function classifyEnaviaIntent(input) {
  const rawInput = input && typeof input === "object" ? input : {};
  const message = typeof rawInput.message === "string" ? rawInput.message : "";

  if (message.trim().length === 0) {
    return {
      intent: INTENT_TYPES.UNKNOWN,
      confidence: CONFIDENCE_LEVELS.LOW,
      is_operational: false,
      reasons: ["mensagem vazia"],
      signals: [],
    };
  }

  const normalized = _normalize(message);
  const reasons = [];
  const signals = [];

  // ------------------------------------------------------------------
  // 1. PR Review — alta prioridade (URL de PR ou pedido explícito)
  // ------------------------------------------------------------------
  if (_isPRUrl(message)) {
    signals.push("pr_url_detected");
    reasons.push("URL de pull request GitHub detectada");
    return {
      intent: INTENT_TYPES.PR_REVIEW,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  const prReviewMatches = _containsAny(normalized, _PR_REVIEW_TERMS);
  if (prReviewMatches.length > 0) {
    signals.push(...prReviewMatches.map((t) => `pr_review:${t}`));
    reasons.push(`termos de revisão de PR detectados: ${prReviewMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.PR_REVIEW,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 2. Deploy/Rollback — alta prioridade antes de execution genérico
  // ------------------------------------------------------------------
  const deployMatches = _containsAny(normalized, _DEPLOY_TERMS);
  if (deployMatches.length > 0) {
    signals.push(...deployMatches.map((t) => `deploy:${t}`));
    reasons.push(`termos de deploy/rollback detectados: ${deployMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.DEPLOY_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 3. Execução técnica genérica
  // ------------------------------------------------------------------
  const executionMatches = _containsAny(normalized, _EXECUTION_TERMS);
  if (executionMatches.length > 0) {
    signals.push(...executionMatches.map((t) => `execution:${t}`));
    reasons.push(`termos de execução técnica detectados: ${executionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.EXECUTION_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 4. Diagnóstico técnico
  // ------------------------------------------------------------------
  const diagMatches = _containsAny(normalized, _TECHNICAL_DIAGNOSIS_TERMS);
  if (diagMatches.length > 0) {
    signals.push(...diagMatches.map((t) => `diag:${t}`));
    reasons.push(`termos de diagnóstico técnico detectados: ${diagMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.TECHNICAL_DIAGNOSIS,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 5. Memória — pedido de escrita supervisionada
  // ------------------------------------------------------------------
  const memoryMatches = _containsAny(normalized, _MEMORY_TERMS);
  if (memoryMatches.length > 0) {
    signals.push(...memoryMatches.map((t) => `memory:${t}`));
    reasons.push(`termos de memória detectados: ${memoryMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.MEMORY_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 6. Contrato — distinguir ação de contrato vs pergunta conceitual
  // ------------------------------------------------------------------
  const contractActionMatches = _containsAny(normalized, _CONTRACT_ACTION_TERMS);
  if (contractActionMatches.length > 0) {
    signals.push(...contractActionMatches.map((t) => `contract_action:${t}`));
    reasons.push(`termos de ação de contrato detectados: ${contractActionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CONTRACT_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 7. Capacidade — o que a Enavia consegue/tem (verificada ANTES de skill
  //    para evitar que "você já tem Skill Router?" seja capturado como skill)
  // ------------------------------------------------------------------
  const capabilityMatches = _containsAny(normalized, _CAPABILITY_TERMS);
  if (capabilityMatches.length > 0) {
    signals.push(...capabilityMatches.map((t) => `capability:${t}`));
    reasons.push(`pergunta de capacidade detectada: ${capabilityMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CAPABILITY_QUESTION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 8. Skill — distinguir execução vs pergunta
  // ------------------------------------------------------------------
  const skillRunMatches = _containsAny(normalized, _SKILL_RUN_TERMS);
  if (skillRunMatches.length > 0) {
    signals.push(...skillRunMatches.map((t) => `skill_run:${t}`));
    reasons.push(`pedido de execução de skill detectado (Skill Router ainda NÃO existe em runtime): ${skillRunMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SKILL_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals,
    };
  }

  const skillQuestionMatches = _containsAny(normalized, _SKILL_QUESTION_TERMS);
  if (skillQuestionMatches.length > 0) {
    signals.push(...skillQuestionMatches.map((t) => `skill_question:${t}`));
    reasons.push(`pergunta sobre skill detectada: ${skillQuestionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SKILL_REQUEST,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 9. Próxima PR — resposta curta + prompt completo, não modo operacional pesado
  // ------------------------------------------------------------------
  const nextPrMatches = _containsAny(normalized, _NEXT_PR_TERMS);
  if (nextPrMatches.length > 0) {
    signals.push(...nextPrMatches.map((t) => `next_pr:${t}`));
    reasons.push(`pedido de próxima PR detectado: ${nextPrMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.NEXT_PR_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 10. Frustração / desconfiança — NÃO ativa modo operacional
  // ------------------------------------------------------------------
  const frustrationMatches = _containsAny(normalized, _FRUSTRATION_TERMS);
  if (frustrationMatches.length > 0) {
    signals.push(...frustrationMatches.map((t) => `frustration:${t}`));
    reasons.push(`frustração ou desconfiança detectada: ${frustrationMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.FRUSTRATION_OR_TRUST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 11. Identidade — quem é a Enavia
  // ------------------------------------------------------------------
  const identityMatches = _containsAny(normalized, _IDENTITY_TERMS);
  if (identityMatches.length > 0) {
    signals.push(...identityMatches.map((t) => `identity:${t}`));
    reasons.push(`pergunta de identidade detectada: ${identityMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.IDENTITY_QUESTION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 12. Estado do sistema — o que existe, o que falta
  // ------------------------------------------------------------------
  const systemStateMatches = _containsAny(normalized, _SYSTEM_STATE_TERMS);
  if (systemStateMatches.length > 0) {
    signals.push(...systemStateMatches.map((t) => `system_state:${t}`));
    reasons.push(`pergunta sobre estado do sistema detectada: ${systemStateMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SYSTEM_STATE_QUESTION,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // PR110: IMPROVEMENT_REQUEST — pedido de melhoria de subsistema
  // Classificado antes de STRATEGY para capturar "melhora X" com target.
  // ------------------------------------------------------------------
  const improvementMatches = _IMPROVEMENT_TRIGGER_TERMS.filter((t) => normalized.includes(t));
  if (improvementMatches.length > 0) {
    // Verificar negação próxima ao primeiro gatilho encontrado
    const firstTrigger = improvementMatches[0];
    if (!_hasNegationBefore(normalized, firstTrigger)) {
      const target = _extractImprovementTarget(normalized);
      const confidence = target
        ? (improvementMatches.length >= 2 ? CONFIDENCE_LEVELS.HIGH : CONFIDENCE_LEVELS.MEDIUM)
        : CONFIDENCE_LEVELS.LOW;
      signals.push(...improvementMatches.map((t) => `improvement:${t.trim()}`));
      if (target) signals.push(`improvement_target:${target}`);
      reasons.push(`intenção de melhoria detectada: ${improvementMatches.join(", ")}${target ? ` — alvo: ${target}` : " — alvo não identificado"}`);
      return {
        intent: INTENT_TYPES.IMPROVEMENT_REQUEST,
        confidence,
        is_operational: true,
        target: target || null,
        reasons,
        signals,
      };
    }
  }

  // ------------------------------------------------------------------
  // 13. Estratégia — decisões macro, recomendações
  // ------------------------------------------------------------------
  const strategyMatches = _containsAny(normalized, _STRATEGY_TERMS);
  if (strategyMatches.length > 0) {
    signals.push(...strategyMatches.map((t) => `strategy:${t}`));
    reasons.push(`pergunta estratégica detectada: ${strategyMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.STRATEGY_QUESTION,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 14. Cumprimento / conversa simples
  // ------------------------------------------------------------------
  const greetingMatches = _containsAny(normalized, _GREETING_TERMS);
  if (greetingMatches.length > 0) {
    signals.push(...greetingMatches.map((t) => `greeting:${t}`));
    reasons.push(`cumprimento ou conversa simples detectada: ${greetingMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CONVERSATION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 15. Mensagem curta sem sinais — fallback para unknown (não conversation),
  //     para permitir que a heurística legada de isOperationalMessage atue.
  // ------------------------------------------------------------------
  if (normalized.length <= _SHORT_MESSAGE_THRESHOLD) {
    reasons.push("mensagem curta sem sinais reconhecidos — classificado como desconhecido para não bloquear heurística legada");
    signals.push("short_message_no_match");
    return {
      intent: INTENT_TYPES.UNKNOWN,
      confidence: CONFIDENCE_LEVELS.LOW,
      is_operational: false,
      reasons,
      signals,
    };
  }

  // ------------------------------------------------------------------
  // 16. Fallback — desconhecido
  // ------------------------------------------------------------------
  reasons.push("nenhum sinal reconhecido — classificado como desconhecido");
  signals.push("no_match");
  return {
    intent: INTENT_TYPES.UNKNOWN,
    confidence: CONFIDENCE_LEVELS.LOW,
    is_operational: false,
    reasons,
    signals,
  };
}
