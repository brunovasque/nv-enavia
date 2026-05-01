// ============================================================================
// 🎯 ENAVIA — Skill Router v1 (PR51 — Skill Router read-only)
//
// Roteador determinístico de skills documentais da Enavia.
// Recebe uma intenção/pedido relacionado a skill e retorna qual skill
// documental deve ser usada como referência, sem executar nada.
//
// PRINCÍPIOS:
//   • Determinístico — mesma entrada → mesma saída.
//   • Sem LLM externo. Sem KV. Sem rede. Sem filesystem runtime.
//   • Sem side effects. Read-only. Conservador. Explicável.
//   • Testável isoladamente — pure function.
//
// EXPORTAÇÕES PÚBLICAS:
//   routeEnaviaSkill(input)   — roteador principal
//   SKILL_IDS                 — IDs canônicos das skills documentais
//   ROUTER_MODES              — modos de operação do router
//   CONFIDENCE_LEVELS         — níveis de confiança
//
// ESCOPO: WORKER-ONLY. Pure function. Sem side-effects.
//
// ⚠️  AVISO PERMANENTE:
//   Este módulo é READ-ONLY. Não há /skills/run. Não há execução de skill.
//   Skills são documentais. Nenhuma ação é executada por este router.
// ============================================================================

// ---------------------------------------------------------------------------
// Enum público — IDs canônicos das skills documentais v1
// ---------------------------------------------------------------------------
export const SKILL_IDS = {
  CONTRACT_LOOP_OPERATOR:     "CONTRACT_LOOP_OPERATOR",
  DEPLOY_GOVERNANCE_OPERATOR: "DEPLOY_GOVERNANCE_OPERATOR",
  SYSTEM_MAPPER:              "SYSTEM_MAPPER",
  CONTRACT_AUDITOR:           "CONTRACT_AUDITOR",
};

// ---------------------------------------------------------------------------
// Enum público — modos de operação do router
// ---------------------------------------------------------------------------
export const ROUTER_MODES = {
  READ_ONLY: "read_only",
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
// Aviso canônico de read-only (injetado em todo resultado)
// ---------------------------------------------------------------------------
const _WARNING_READ_ONLY =
  "Skill Router é read-only. " +
  "Skills são documentais — apenas referência, sem execução runtime. " +
  "/skills/run ainda não existe. " +
  "Nenhuma ação foi executada.";

const _WARNING_NO_MATCH =
  "Nenhuma skill documental foi selecionada para esta mensagem. " +
  "Skill Router é read-only. " +
  "/skills/run não existe. " +
  "Nenhuma ação foi executada.";

// ---------------------------------------------------------------------------
// Catálogo interno de skills documentais
// Cada entrada descreve os sinais de ativação e os metadados da skill.
// ---------------------------------------------------------------------------
const _SKILL_CATALOG = [
  {
    id:   SKILL_IDS.CONTRACT_LOOP_OPERATOR,
    name: "Contract Loop Operator",
    source: "schema/skills/CONTRACT_LOOP_OPERATOR.md",
    description: "Operação do loop contratual supervisionado: próxima PR, sequência, manter fluxo PR a PR.",
    triggers: [
      // Nome canônico da skill
      "contract loop operator",
      "contract loop",
      "loop operator",
      // Pedidos de próxima PR / sequência de contrato
      "mande a próxima pr",
      "mande a próxima",
      "monte a próxima pr",
      "monte a próxima",
      "manda a próxima",
      "mandar a próxima",
      "próxima pr",
      "proxima pr",
      "next pr",
      "qual a próxima pr",
      "qual é a próxima pr",
      "qual a proxima pr",
      "gera a próxima",
      "gere a próxima",
      "cria a próxima pr",
      "gerar a próxima pr",
      // Retorno/continuidade ao contrato
      "voltar ao contrato",
      "volta ao contrato",
      "volte ao contrato",
      "retornar ao contrato",
      "retorne ao contrato",
      "seguir contrato",
      "seguir o contrato",
      "seguir o loop",
      "loop do contrato",
      "loop contratual",
      "sequência de prs",
      "sequencia de prs",
      "fluxo do contrato",
      "qual a próxima etapa do contrato",
      "qual a proxima etapa do contrato",
      "próxima etapa do contrato",
      "proxima etapa do contrato",
      "qual próxima etapa",
      "qual proxima etapa",
      "contrato ativo",
    ],
  },
  {
    id:   SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR,
    name: "Deploy Governance Operator",
    source: "schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md",
    description: "Governança de deploy, rollback e promoção PROD/TEST: gates, aprovação, produção, staging.",
    triggers: [
      // Nome canônico da skill
      "deploy governance operator",
      "deploy governance",
      // Pedidos de deploy
      "deploy",
      "deploya",
      "deploye",
      "fazer deploy",
      "faça o deploy",
      "deploy em test",
      "deploy em prod",
      "deploy em produção",
      "subir pra produção",
      "subir em produção",
      "mande pra produção",
      "manda pra produção",
      "push pra produção",
      "rollback",
      "roll back",
      "reverter deploy",
      "reverter o deploy",
      "promover",
      "promova",
      "promoção",
      "promover para produção",
      "promover pra produção",
      "gate de deploy",
      "aprovação de produção",
      "aprovar o deploy",
      "aprovar deploy",
      "gate de produção",
      "ambiente de produção",
      "ambiente de test",
      "executar deploy",
      "rodar deploy",
    ],
  },
  {
    id:   SKILL_IDS.SYSTEM_MAPPER,
    name: "System Mapper",
    source: "schema/skills/SYSTEM_MAPPER.md",
    description: "Manutenção de System Map, Route Registry, Worker Registry, estado técnico do sistema.",
    triggers: [
      // Nome canônico da skill
      "system mapper",
      // Termos técnicos de sistema
      "rotas",
      "route registry",
      "worker registry",
      "system map",
      "mapa do sistema",
      "mapa técnico",
      "bindings",
      "quais workers",
      "quais são os workers",
      "workers existentes",
      "estado técnico do sistema",
      "estado técnico",
      "estado do sistema técnico",
      "verifique o route registry",
      "verificar o route registry",
      "verificar route registry",
      "worker registry",
      "workers do sistema",
      "workers ativos",
      "sistema técnico",
      "infraestrutura do sistema",
      "mapeamento do sistema",
      "mapear o sistema",
      "mapear workers",
      "system awareness",
      "kv bindings",
      "kv do sistema",
    ],
  },
  {
    id:   SKILL_IDS.CONTRACT_AUDITOR,
    name: "Contract Auditor",
    source: "schema/skills/CONTRACT_AUDITOR.md",
    description: "Auditoria de aderência contratual de PRs, tarefas e execuções.",
    triggers: [
      // Nome canônico da skill
      "contract auditor",
      "contract audit",
      // Pedidos de revisão/auditoria
      "revise a pr",
      "revisar a pr",
      "revise a pull request",
      "review pr",
      "revisar pull request",
      "analisar a pr",
      "analise a pr",
      "veja essa pr",
      "ver essa pr",
      "veja se essa pr",
      "veja se a pr",
      "audite essa pr",
      "auditar a pr",
      "auditoria da pr",
      "critérios de aceite",
      "criterios de aceite",
      "regressões",
      "regressoes",
      "escopo da pr",
      "escopo do contrato",
      "veja se quebrou",
      "veja se essa pr quebrou",
      "ver se quebrou",
      "verificar se quebrou",
      "pull/",
      "/pull/",
      "github.com/",
    ],
  },
];

// ---------------------------------------------------------------------------
// _normalize — normaliza texto para comparação
// ---------------------------------------------------------------------------
function _normalize(text) {
  if (typeof text !== "string") return "";
  return text.toLowerCase().trim();
}

// ---------------------------------------------------------------------------
// _isPRUrl — detecta URL de pull request do GitHub
// ---------------------------------------------------------------------------
function _isPRUrl(text) {
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(text);
}

// ---------------------------------------------------------------------------
// _matchSkill — verifica se uma mensagem casa com os triggers de uma skill
// Retorna { matched: boolean, matchedTerms: string[] }
// ---------------------------------------------------------------------------
function _matchSkill(normalized, skill) {
  const matched = [];
  for (const trigger of skill.triggers) {
    if (normalized.includes(trigger)) {
      matched.push(trigger);
    }
  }
  return { matched: matched.length > 0, matchedTerms: matched };
}

// ---------------------------------------------------------------------------
// _routeByContent — roteamento por conteúdo da mensagem
// Retorna a primeira skill que casa, ou null se nenhuma casar.
// ---------------------------------------------------------------------------
function _routeByContent(normalized, message) {
  // Verificação especial: URL de PR do GitHub → CONTRACT_AUDITOR com alta confiança
  if (_isPRUrl(message)) {
    const skill = _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_AUDITOR);
    return {
      skill,
      confidence: CONFIDENCE_LEVELS.HIGH,
      reason: "URL de pull request GitHub detectada — Contract Auditor é a skill documental para revisão de PRs",
      matchedTerms: ["pr_url"],
    };
  }

  // Verificação de cada skill na ordem do catálogo
  for (const skill of _SKILL_CATALOG) {
    const { matched, matchedTerms } = _matchSkill(normalized, skill);
    if (matched) {
      return {
        skill,
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: `Termos de roteamento detectados para ${skill.name}: ${matchedTerms.slice(0, 3).join(", ")}`,
        matchedTerms,
      };
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// _routeByIntent — roteamento por intenção classificada
// Usa intentClassification fornecida pelo Classificador de Intenção v1
// para orientar o roteamento quando o conteúdo da mensagem não é suficiente.
// ---------------------------------------------------------------------------
function _routeByIntent(intent, normalized) {
  if (!intent || typeof intent !== "string") return null;

  switch (intent) {
    case "pr_review":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_AUDITOR),
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "Intenção pr_review → Contract Auditor é a skill documental para revisão de PRs",
        matchedTerms: [`intent:${intent}`],
      };

    case "deploy_request":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR),
        confidence: CONFIDENCE_LEVELS.HIGH,
        reason: "Intenção deploy_request → Deploy Governance Operator é a skill documental para deploy",
        matchedTerms: [`intent:${intent}`],
      };

    case "system_state_question": {
      // Só roteia para System Mapper se a mensagem for técnica/sistema
      const techTerms = [
        "worker", "workers", "rota", "rotas", "kv", "binding", "bindings",
        "sistema", "técnico", "tecnico", "infraestrutura", "map", "registry",
        "worker registry", "route registry", "system map",
      ];
      const hasTechSignal = techTerms.some((t) => normalized.includes(t));
      if (hasTechSignal) {
        return {
          skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.SYSTEM_MAPPER),
          confidence: CONFIDENCE_LEVELS.MEDIUM,
          reason: "Intenção system_state_question com sinal técnico → System Mapper é a skill documental para estado do sistema",
          matchedTerms: [`intent:${intent}`],
        };
      }
      return null;
    }

    case "next_pr_request":
    case "contract_request":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_LOOP_OPERATOR),
        confidence: CONFIDENCE_LEVELS.MEDIUM,
        reason: `Intenção ${intent} → Contract Loop Operator é a skill documental para loop contratual`,
        matchedTerms: [`intent:${intent}`],
      };

    case "skill_request":
      // Para skill_request, tentamos resolver por conteúdo da mensagem.
      // Se não conseguir, retorna null (sem inventar skill).
      return null;

    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// routeEnaviaSkill(input)
//
// Roteador principal. Recebe intenção/pedido e retorna qual skill documental
// deve ser usada como referência. NÃO executa nada.
//
// @param {{
//   message: string,
//   intentClassification?: {
//     intent: string,
//     confidence: string,
//     is_operational: boolean,
//     reasons: string[]
//   },
//   context?: object
// }} input
//
// @returns {{
//   matched: boolean,
//   skill_id: string | null,
//   skill_name: string | null,
//   mode: "read_only",
//   confidence: "high" | "medium" | "low",
//   reason: string,
//   sources: string[],
//   warning: string
// }}
// ---------------------------------------------------------------------------
export function routeEnaviaSkill(input) {
  // --- Validação de entrada ---
  const rawInput = input && typeof input === "object" ? input : {};
  const message = typeof rawInput.message === "string" ? rawInput.message : "";
  const intentClassification =
    rawInput.intentClassification && typeof rawInput.intentClassification === "object"
      ? rawInput.intentClassification
      : null;

  // --- Resultado base (sem match) ---
  const _noMatch = {
    matched: false,
    skill_id: null,
    skill_name: null,
    mode: ROUTER_MODES.READ_ONLY,
    confidence: CONFIDENCE_LEVELS.LOW,
    reason: "Nenhuma skill documental identificada para esta mensagem",
    sources: [],
    warning: _WARNING_NO_MATCH,
  };

  // --- Mensagem vazia ou inválida ---
  if (message.trim().length === 0) {
    return {
      ..._noMatch,
      reason: "Mensagem vazia — nenhuma skill pode ser selecionada",
    };
  }

  const normalized = _normalize(message);

  // --- Tentativa 1: Roteamento por conteúdo da mensagem ---
  const contentResult = _routeByContent(normalized, message);
  if (contentResult) {
    return _buildResult(contentResult, message);
  }

  // --- Tentativa 2: Roteamento por intenção classificada ---
  if (intentClassification && intentClassification.intent) {
    const intentResult = _routeByIntent(intentClassification.intent, normalized);
    if (intentResult) {
      // Se a intenção tem confiança baixa e o conteúdo não confirmou,
      // rebaixamos a confiança do resultado.
      if (intentClassification.confidence === CONFIDENCE_LEVELS.LOW) {
        intentResult.confidence = CONFIDENCE_LEVELS.LOW;
      } else if (intentResult.confidence === CONFIDENCE_LEVELS.HIGH && intentClassification.confidence === CONFIDENCE_LEVELS.MEDIUM) {
        intentResult.confidence = CONFIDENCE_LEVELS.MEDIUM;
      }
      return _buildResult(intentResult, message);
    }
  }

  // --- Sem match ---
  return _noMatch;
}

// ---------------------------------------------------------------------------
// _buildResult — constrói o objeto de resposta canônico para um match
// ---------------------------------------------------------------------------
function _buildResult(routeMatch, message) {
  const { skill, confidence, reason } = routeMatch;

  // Detectar se é pedido de execução (não só pergunta)
  const normalized = _normalize(message);
  const isExecutionRequest = _isExecutionRequest(normalized);

  const warning = isExecutionRequest
    ? `A skill ${skill.name} pode ser usada como referência documental. ` +
      "Execução runtime de skill ainda não existe. " +
      "/skills/run ainda não existe. " +
      "Nenhuma ação foi executada."
    : _WARNING_READ_ONLY;

  return {
    matched: true,
    skill_id: skill.id,
    skill_name: skill.name,
    mode: ROUTER_MODES.READ_ONLY,
    confidence,
    reason,
    sources: [skill.source],
    warning,
  };
}

// ---------------------------------------------------------------------------
// _isExecutionRequest — detecta se a mensagem é pedido de execução de skill
// (vs pergunta sobre skill). Usada para diferenciar o warning.
// ---------------------------------------------------------------------------
const _EXECUTION_REQUEST_TERMS = [
  "rode a skill",
  "rodar a skill",
  "execute a skill",
  "executar a skill",
  "use a skill",
  "usar a skill",
  "acione a skill",
  "acionar a skill",
  "aplicar a skill",
  "aplique a skill",
];

function _isExecutionRequest(normalized) {
  return _EXECUTION_REQUEST_TERMS.some((t) => normalized.includes(t));
}
