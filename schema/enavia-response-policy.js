// ============================================================================
// 🎯 ENAVIA — Response Policy viva v1 (PR59 — Response Policy viva)
//
// Camada de política de resposta da Enavia.
// Usa os sinais do fluxo (intenção, skill routing, retrieval, self_audit,
// modo operacional, contexto) para orientar COMO a Enavia deve responder:
// mais viva, honesta, estratégica e segura.
//
// PRINCÍPIOS:
//   • Determinístico — mesma entrada → mesma saída.
//   • Sem LLM externo. Sem KV. Sem rede. Sem filesystem. Sem side-effects.
//   • Read-only — não altera resposta automaticamente.
//   • Não bloqueia resposta programaticamente.
//   • Não cria executor, endpoint, skill ou persona.
//   • Não substitui LLM Core, Brain Context, Intent Retrieval ou Self-Audit.
//   • Falha com segurança — se falhar, retorna null.
//   • Explicável via reasons.
//   • Testável isoladamente — pure function.
//
// EXPORTAÇÕES PÚBLICAS:
//   buildEnaviaResponsePolicy(input)  — função principal
//   RESPONSE_STYLES                   — enum de estilos de resposta
//   POLICY_MODES                      — enum de modos da policy
//
// ESCOPO: WORKER-ONLY. Pure function. Sem side-effects.
// ============================================================================

// ---------------------------------------------------------------------------
// Enums públicos
// ---------------------------------------------------------------------------

export const RESPONSE_STYLES = {
  CONVERSATIONAL:   "conversational",
  STRATEGIC:        "strategic",
  OPERATIONAL:      "operational",
  CORRECTIVE:       "corrective",
  BLOCKING_NOTICE:  "blocking_notice",
};

export const POLICY_MODES = {
  READ_ONLY: "read_only",
};

// ---------------------------------------------------------------------------
// Constantes internas
// ---------------------------------------------------------------------------

// Intenções que geram política específica
const _INTENT = {
  CONVERSATION:         "conversation",
  FRUSTRATION:          "frustration_or_trust_issue",
  IDENTITY:             "identity_question",
  CAPABILITY:           "capability_question",
  SYSTEM_STATE:         "system_state_question",
  NEXT_PR:              "next_pr_request",
  PR_REVIEW:            "pr_review",
  TECHNICAL_DIAGNOSIS:  "technical_diagnosis",
  EXECUTION_REQUEST:    "execution_request",
  DEPLOY_REQUEST:       "deploy_request",
  CONTRACT_REQUEST:     "contract_request",
  SKILL_REQUEST:        "skill_request",
  MEMORY_REQUEST:       "memory_request",
  STRATEGY:             "strategy_question",
  UNKNOWN:              "unknown",
};

// Categorias do Self-Audit
const _SA = {
  SECRET_EXPOSURE:                    "secret_exposure",
  FAKE_EXECUTION:                     "fake_execution",
  UNAUTHORIZED_ACTION:                "unauthorized_action",
  SCOPE_VIOLATION:                    "scope_violation",
  CONTRACT_DRIFT:                     "contract_drift",
  FALSE_CAPABILITY:                   "false_capability",
  RUNTIME_VS_DOCUMENTATION_CONFUSION: "runtime_vs_documentation_confusion",
  WRONG_MODE:                         "wrong_mode",
  MISSING_SOURCE:                     "missing_source",
  DOCS_OVER_PRODUCT:                  "docs_over_product",
};

// Severidades do Self-Audit
const _SEVERITY = {
  BLOCKING: "blocking",
  HIGH:     "high",
  MEDIUM:   "medium",
  LOW:      "low",
  NONE:     "none",
};

// ---------------------------------------------------------------------------
// Helpers internos
// ---------------------------------------------------------------------------

/**
 * Extrai o intent string da classificação de intenção (defensivo).
 */
function _getIntent(intentClassification) {
  if (!intentClassification || typeof intentClassification !== "object") return null;
  return typeof intentClassification.intent === "string"
    ? intentClassification.intent
    : null;
}

/**
 * Retorna todos os findings do self_audit como array (defensivo).
 */
function _getFindings(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return [];
  const findings = selfAudit.findings;
  if (!Array.isArray(findings)) return [];
  return findings;
}

/**
 * Verifica se o self_audit tem finding de categoria X (qualquer severidade).
 */
function _hasCategory(selfAudit, category) {
  return _getFindings(selfAudit).some(f => f && f.category === category);
}

/**
 * Verifica se o self_audit tem finding de categoria X com severidade mínima.
 */
function _hasCategoryAtSeverity(selfAudit, category, minSeverity) {
  const order = [_SEVERITY.NONE, _SEVERITY.LOW, _SEVERITY.MEDIUM, _SEVERITY.HIGH, _SEVERITY.BLOCKING];
  const minIdx = order.indexOf(minSeverity);
  return _getFindings(selfAudit).some(f => {
    if (!f || f.category !== category) return false;
    const sIdx = order.indexOf(f.severity);
    return sIdx >= minIdx;
  });
}

/**
 * Verifica se self_audit.should_block === true.
 */
function _shouldBlock(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return false;
  return selfAudit.should_block === true;
}

/**
 * Verifica se self_audit.risk_level é "blocking".
 */
function _isBlocking(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return false;
  return selfAudit.risk_level === _SEVERITY.BLOCKING;
}

// ---------------------------------------------------------------------------
// Blocos de policy por categoria (strings compactas — nunca expõem secrets)
// ---------------------------------------------------------------------------

function _blockClean(intent) {
  if (intent === _INTENT.STRATEGY) {
    return "Resposta estratégica: seja concisa, pondere custo/tempo/risco, diferencie obrigatório de opcional, finalize com próximo passo concreto.";
  }
  if (intent === _INTENT.NEXT_PR) {
    return "Próxima PR: resposta curta. Objetivo em 1 frase. Prompt completo pronto para uso. Não reabrir discussão. Seguir contrato ativo.";
  }
  if (intent === _INTENT.PR_REVIEW) {
    return "Revisão de PR: resposta operacional objetiva. Verificar: escopo, arquivos alterados, testes, regressões, governança. Não aprovar sem evidência.";
  }
  if (intent === _INTENT.DEPLOY_REQUEST) {
    return "Deploy/produção: exigir gate/aprovação explícita. Separar test de prod. Não afirmar deploy feito sem prova real.";
  }
  if (intent === _INTENT.CONVERSATION || intent === _INTENT.IDENTITY || intent === _INTENT.CAPABILITY) {
    return "Resposta conversacional: direta, natural, sem modo operacional pesado.";
  }
  if (intent === _INTENT.FRUSTRATION) {
    return "Frustração/confiança: responda com sinceridade. Reconheça o ponto sem empatia vazia. Puxe execução concreta. Se houver item opcional, diga: \"Isso é opcional. Não mexa agora.\"";
  }
  return "";
}

function _blockSecretExposure() {
  return "AVISO CRÍTICO: potencial exposição de dado sensível detectada. Oriente o usuário a remover o segredo. Não repita, não registre, não exponha o dado em nenhuma parte da resposta.";
}

function _blockFakeExecution() {
  return "Não afirme execução sem evidência verificável. Indique o que é documental, read-only ou planejado. Mostre ou peça evidência antes de afirmar \"feito\".";
}

function _blockFalseCapability() {
  return "Não afirme capacidade inexistente no runtime. Marque claramente o que é documental, read-only ou previsto para PR futura.";
}

function _blockRuntimeConfusion() {
  return "Diferencie o que está implementado no runtime do que é documental ou planejado. Não descreva documentação como produto funcionando.";
}

function _blockScopeOrContractDrift() {
  return "Desvio de escopo detectado. Oriente parar avanço, corrigir escopo e voltar ao contrato ativo. Não avançar para próxima fase se a prova anterior falhou.";
}

function _blockUnauthorizedAction() {
  return "Ação não autorizada detectada. Exigir aprovação/gate explícita. Não executar sem contrato autorizando.";
}

function _blockDocsOverProduct() {
  return "Excesso documental detectado. Frustração legítima. Responda com sinceridade, reconheça, e puxe entrega concreta em vez de mais documentação. Se houver item opcional: \"Isso é opcional. Não mexa agora.\"";
}

// ---------------------------------------------------------------------------
// Função principal exportada
// ---------------------------------------------------------------------------

/**
 * Constrói a Response Policy viva da Enavia.
 *
 * @param {{
 *   message?: string,
 *   context?: object,
 *   intentClassification?: object,
 *   skillRouting?: object,
 *   intentRetrieval?: object,
 *   selfAudit?: object,
 *   isOperationalContext?: boolean,
 *   metadata?: object
 * }} input
 *
 * @returns {{
 *   applied: true,
 *   mode: "read_only",
 *   response_style: string,
 *   should_adjust_tone: boolean,
 *   should_warn: boolean,
 *   should_refuse_or_pause: boolean,
 *   policy_block: string,
 *   warnings: string[],
 *   reasons: string[]
 * } | null}
 */
export function buildEnaviaResponsePolicy(input) {
  // Falha com segurança: se o input for inválido, retornar null
  if (!input || typeof input !== "object") return null;

  const {
    intentClassification,
    selfAudit,
    isOperationalContext,
  } = input;

  const intent = _getIntent(intentClassification);
  const warnings = [];
  const reasons = [];
  const policyParts = [];

  let response_style   = RESPONSE_STYLES.CONVERSATIONAL;
  let should_adjust_tone      = false;
  let should_warn             = false;
  let should_refuse_or_pause  = false;

  // -------------------------------------------------------------------------
  // Regra 1: Secret exposure — máxima prioridade, blocking_notice imediato
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.SECRET_EXPOSURE)) {
    response_style          = RESPONSE_STYLES.BLOCKING_NOTICE;
    should_warn             = true;
    should_refuse_or_pause  = true;
    warnings.push("Potencial exposição de dado sensível detectada. Oriente remoção imediata.");
    reasons.push("self_audit: secret_exposure encontrado");
    policyParts.push(_blockSecretExposure());
  }

  // -------------------------------------------------------------------------
  // Regra 2: Fake execution — blocking se severidade blocking, warn se high
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.FAKE_EXECUTION)) {
    const isBlockingFake = _hasCategoryAtSeverity(selfAudit, _SA.FAKE_EXECUTION, _SEVERITY.BLOCKING)
      || _shouldBlock(selfAudit)
      || _isBlocking(selfAudit);
    should_warn = true;
    reasons.push("self_audit: fake_execution encontrado");
    policyParts.push(_blockFakeExecution());
    if (isBlockingFake) {
      response_style         = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }

  // -------------------------------------------------------------------------
  // Regra 3: False capability — sempre warn, blocking se blocking
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.FALSE_CAPABILITY)) {
    should_warn = true;
    reasons.push("self_audit: false_capability encontrado");
    policyParts.push(_blockFalseCapability());
    if (_hasCategoryAtSeverity(selfAudit, _SA.FALSE_CAPABILITY, _SEVERITY.BLOCKING)) {
      response_style         = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }

  // -------------------------------------------------------------------------
  // Regra 4: Runtime vs documentation confusion — warn + corrective
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.RUNTIME_VS_DOCUMENTATION_CONFUSION)) {
    should_warn = true;
    reasons.push("self_audit: runtime_vs_documentation_confusion encontrado");
    policyParts.push(_blockRuntimeConfusion());
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }

  // -------------------------------------------------------------------------
  // Regra 5: Unauthorized action — sempre warn, blocking se blocking
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.UNAUTHORIZED_ACTION)) {
    should_warn = true;
    reasons.push("self_audit: unauthorized_action encontrado");
    policyParts.push(_blockUnauthorizedAction());
    if (_hasCategoryAtSeverity(selfAudit, _SA.UNAUTHORIZED_ACTION, _SEVERITY.BLOCKING)) {
      response_style         = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }

  // -------------------------------------------------------------------------
  // Regra 6: Scope violation / contract drift — orienta parar + corrigir
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.SCOPE_VIOLATION) || _hasCategory(selfAudit, _SA.CONTRACT_DRIFT)) {
    should_warn = true;
    reasons.push("self_audit: scope_violation ou contract_drift encontrado");
    policyParts.push(_blockScopeOrContractDrift());
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL || response_style === RESPONSE_STYLES.STRATEGIC) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }

  // -------------------------------------------------------------------------
  // Regra 7: Docs over product — sinceridade, não modo operacional pesado
  // -------------------------------------------------------------------------
  if (_hasCategory(selfAudit, _SA.DOCS_OVER_PRODUCT) || intent === _INTENT.FRUSTRATION) {
    reasons.push(
      _hasCategory(selfAudit, _SA.DOCS_OVER_PRODUCT)
        ? "self_audit: docs_over_product encontrado"
        : `intent: ${intent}`
    );
    policyParts.push(_blockDocsOverProduct());
    should_adjust_tone = true;
    // Não ativa modo operacional pesado nem blocking por frustração
    if (!should_refuse_or_pause && response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
  }

  // -------------------------------------------------------------------------
  // Regra 8: Deploy request / unauthorized action por intenção
  // -------------------------------------------------------------------------
  if (intent === _INTENT.DEPLOY_REQUEST || intent === _INTENT.EXECUTION_REQUEST) {
    reasons.push(`intent: ${intent}`);
    const deployBlock = _blockClean(intent === _INTENT.DEPLOY_REQUEST ? _INTENT.DEPLOY_REQUEST : _INTENT.DEPLOY_REQUEST);
    if (!policyParts.includes(deployBlock)) {
      policyParts.push(deployBlock);
    }
    should_warn = true;
    should_adjust_tone = true;
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
    }
  }

  // -------------------------------------------------------------------------
  // Regra 9: Estratégia — resposta estratégica compacta
  // -------------------------------------------------------------------------
  if (intent === _INTENT.STRATEGY) {
    reasons.push("intent: strategy_question");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.STRATEGIC;
      policyParts.push(_blockClean(_INTENT.STRATEGY));
      should_adjust_tone = true;
    }
  }

  // -------------------------------------------------------------------------
  // Regra 10: Próxima PR — resposta curta + prompt completo
  // -------------------------------------------------------------------------
  if (intent === _INTENT.NEXT_PR) {
    reasons.push("intent: next_pr_request");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
      policyParts.push(_blockClean(_INTENT.NEXT_PR));
      should_adjust_tone = true;
    }
  }

  // -------------------------------------------------------------------------
  // Regra 11: Revisão de PR — resposta operacional objetiva
  // -------------------------------------------------------------------------
  if (intent === _INTENT.PR_REVIEW) {
    reasons.push("intent: pr_review");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
      policyParts.push(_blockClean(_INTENT.PR_REVIEW));
      should_adjust_tone = true;
    }
  }

  // -------------------------------------------------------------------------
  // Caso limpo — sem risco relevante, sem intenção especial
  // PR95: technical_diagnosis, system_state, memory_request, skill_request e
  // contract_request sem self_audit bloqueante ficam CONVERSATIONAL.
  // Governança pesada somente para intenção operacional real (execution,
  // deploy, merge, patch).
  // -------------------------------------------------------------------------
  if (policyParts.length === 0) {
    // Caso limpo: conversa, identidade, capacidade, diagnóstico técnico leve
    // e consultas a memória/skill/contrato → resposta direta e natural.
    if (!intent
      || intent === _INTENT.CONVERSATION
      || intent === _INTENT.IDENTITY
      || intent === _INTENT.CAPABILITY
      || intent === _INTENT.UNKNOWN
      || intent === _INTENT.MEMORY_REQUEST
      || intent === _INTENT.SKILL_REQUEST
      || intent === _INTENT.CONTRACT_REQUEST
      || intent === _INTENT.TECHNICAL_DIAGNOSIS
      || intent === _INTENT.SYSTEM_STATE) {
      // response_style já é CONVERSATIONAL — sem ajuste
      reasons.push("caso limpo: sem risco e sem intenção especial");
    }
    // Não adicionar policy_block em caso limpo sem intenção que justifique
  }

  // -------------------------------------------------------------------------
  // Montar policy_block final (compacto)
  // -------------------------------------------------------------------------
  const policy_block = policyParts.join(" | ");

  // Garantir que reasons nunca esteja vazio
  if (reasons.length === 0) {
    reasons.push("sem sinal relevante detectado");
  }

  return {
    applied: true,
    mode: POLICY_MODES.READ_ONLY,
    response_style,
    should_adjust_tone,
    should_warn,
    should_refuse_or_pause,
    policy_block,
    warnings,
    reasons,
  };
}

/**
 * Monta o bloco de policy para injeção compacta no system prompt.
 * Retorna string vazia se não houver policy aplicada ou policy_block vazio.
 *
 * @param {object|null} responsePolicy — output de buildEnaviaResponsePolicy()
 * @returns {string}
 */
export function buildResponsePolicyPromptBlock(responsePolicy) {
  if (
    !responsePolicy
    || typeof responsePolicy !== "object"
    || !responsePolicy.applied
    || !responsePolicy.policy_block
    || typeof responsePolicy.policy_block !== "string"
    || responsePolicy.policy_block.trim().length === 0
  ) {
    return "";
  }

  const lines = [
    "POLÍTICA DE RESPOSTA VIVA — READ-ONLY",
    responsePolicy.policy_block,
  ];

  if (responsePolicy.should_warn && responsePolicy.warnings && responsePolicy.warnings.length > 0) {
    lines.push(`Alerta: ${responsePolicy.warnings[0]}`);
  }

  return lines.join("\n");
}
