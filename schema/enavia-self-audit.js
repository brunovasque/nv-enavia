// ============================================================================
// 🔍 ENAVIA — Self-Audit read-only v1 (PR56 — Self-Audit read-only)
//
// Módulo de auto-auditoria determinística da Enavia.
// Analisa metadados do fluxo de chat e retorna campo aditivo `self_audit`
// com achados de risco, alertas e próxima ação segura.
//
// PRINCÍPIOS:
//   • Determinístico — mesma entrada → mesma saída.
//   • Sem LLM externo. Sem KV. Sem rede. Sem filesystem. Sem side-effects.
//   • Read-only — não altera resposta automaticamente.
//   • Não bloqueia resposta automaticamente.
//   • Falha com segurança — se falhar internamente, omite `self_audit`.
//   • Conservador — prefere falso-negativo a falso-positivo de bloqueio.
//   • Explicável — findings com evidence obrigatória para high/blocking.
//
// EXPORTAÇÕES PÚBLICAS:
//   runEnaviaSelfAudit(input) — função principal
//   SELF_AUDIT_RISK_LEVELS    — enum de níveis de risco
//   SELF_AUDIT_CATEGORIES     — enum de categorias
//
// ESCOPO: WORKER-ONLY. Pure function. Sem side-effects.
// ============================================================================

// ---------------------------------------------------------------------------
// Enums públicos
// ---------------------------------------------------------------------------

export const SELF_AUDIT_RISK_LEVELS = {
  NONE:     "none",
  LOW:      "low",
  MEDIUM:   "medium",
  HIGH:     "high",
  BLOCKING: "blocking",
};

export const SELF_AUDIT_CATEGORIES = {
  FALSE_CAPABILITY:                  "false_capability",
  FAKE_EXECUTION:                    "fake_execution",
  UNAUTHORIZED_ACTION:               "unauthorized_action",
  WRONG_MODE:                        "wrong_mode",
  DOCS_OVER_PRODUCT:                 "docs_over_product",
  MISSING_SOURCE:                    "missing_source",
  CONTRACT_DRIFT:                    "contract_drift",
  SCOPE_VIOLATION:                   "scope_violation",
  SECRET_EXPOSURE:                   "secret_exposure",
  RUNTIME_VS_DOCUMENTATION_CONFUSION: "runtime_vs_documentation_confusion",
};

// ---------------------------------------------------------------------------
// Constantes internas de detecção
// ---------------------------------------------------------------------------

// Termos de falsa execução
const _FAKE_EXECUTION_TERMS = [
  "executei a skill",
  "rodei a skill",
  "skill executada",
  "skill foi executada",
  "/skills/run",
  "executei o contrato",
  "rodei os testes",
  "rodei os smoke",
  "deploy feito",
  "deploy realizado",
  "deploy em produção feito",
  "memória salva",
  "escrevi na memória",
  "memória foi salva",
  "endpoint criado",
  "rota criada",
  "já executei",
  "já rodei",
  "já fiz o deploy",
  "commit realizado",
  "push realizado",
  "já foi commitado",
  "foi mergeado automaticamente",
];

// Termos de falsa capacidade (afirmar que skill executor existe ou que /skills/run existe)
const _FALSE_CAPABILITY_TERMS = [
  "skill executor",
  "executor de skill",
  "self-audit executor",
  "self-audit executa correções",
  "self-audit bloqueia automaticamente",
  "self-audit altera resposta",
  "/skills/run",
  "skills/run existe",
  "endpoint /skills/run",
  "rota /skills/run",
];

// Termos de ação não autorizada
const _UNAUTHORIZED_ACTION_TERMS = [
  "deploy em produção",
  "deployar em produção",
  "manda pra produção",
  "manda para produção",
  "jogar em produção",
  "subir em produção",
  "subir pra produção",
  "subir para produção",
  "publicar em produção",
  "publicar para produção",
  "fazer rollback",
  "rollback de produção",
  "alterar kv",
  "escrever no kv",
  "criar binding",
  "alterar binding",
  "criar endpoint",
  "criar rota",
  "novo endpoint",
  "nova rota",
  "criar /",
  "criar secret",
  "alterar secret",
  "alterar wrangler",
  "modificar wrangler.toml",
];

// Termos de excesso documental na mensagem do usuário
const _DOCS_OVER_PRODUCT_TERMS = [
  "só documento",
  "só documentação",
  "cadê o produto",
  "cadê produto",
  "muita documentação",
  "produto parado",
  "tudo documento",
  "só docs",
  "virando só documento",
  "virou só documento",
  "mais um documento",
  "mais documentação",
  "quando vai ter produto",
  "quando vai funcionar de verdade",
];

// Termos de confusão runtime vs documental
const _RUNTIME_DOC_CONFUSION_TERMS = [
  "self-audit já executa",
  "self-audit já funciona",
  "self-audit está ativo",
  "self-audit bloqueia",
  "self-audit corrige",
  "skill router executa",
  "skill router já executa",
  "brain executa",
  "brain já executa",
  "brain loader executa",
  "intent retrieval escreve",
  "memory brain escreve",
  "/skills/run funciona",
  "/skills/run está ativo",
  "skills já executam",
];

// Padrões de segredo (regex)
const _SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9\-_]{20,}\b/i,                     // OpenAI API key
  /\bbearer\s+[A-Za-z0-9\-_\.]{20,}\b/i,              // Bearer token
  /\bapi[-_]?key\s*[:=]\s*[A-Za-z0-9\-_]{16,}\b/i,   // API key assignment
  /\btoken\s*[:=]\s*[A-Za-z0-9\-_\.]{20,}\b/i,        // Token assignment
  /\bsecret\s*[:=]\s*[A-Za-z0-9\-_\.]{16,}\b/i,       // Secret assignment
  /\bprivate[-_]?key\s*[:=]/i,                         // Private key
  /\bghp_[A-Za-z0-9]{36,}\b/,                          // GitHub personal token
  /\bxoxb-[A-Za-z0-9\-]{24,}\b/,                       // Slack bot token
  /\bAIza[A-Za-z0-9\-_]{35,}\b/,                       // Google API key
  /[A-Za-z0-9+/]{40,}={0,2}/,                          // Long base64 blob (possível segredo)
];

// Arquivos proibidos por tipo de PR (usado em scope_violation)
const _PROHIBITED_FILES_BY_PR_TYPE = {
  "PR-DOCS":  ["nv-enavia.js", "enavia-cognitive-runtime.js", "enavia-llm-core.js",
               "enavia-brain-loader.js", "enavia-intent-classifier.js",
               "enavia-skill-router.js", "enavia-intent-retrieval.js",
               "wrangler.toml", "wrangler.executor.template.toml"],
  "PR-DIAG":  ["nv-enavia.js", "enavia-cognitive-runtime.js", "enavia-llm-core.js",
               "enavia-brain-loader.js", "wrangler.toml", "wrangler.executor.template.toml"],
  "PR-PROVA": ["enavia-cognitive-runtime.js", "enavia-llm-core.js",
               "enavia-brain-loader.js", "wrangler.toml", "wrangler.executor.template.toml"],
};

const _ALWAYS_PROHIBITED_FILES = [
  "wrangler.toml",
  "wrangler.executor.template.toml",
];

const _PANEL_FILES_PATTERN = /^panel\//;
const _EXECUTOR_FILES_PATTERN = /^executor\//;
const _WORKFLOW_FILES_PATTERN = /^\.github\/workflows\//;

// ---------------------------------------------------------------------------
// Funções auxiliares internas
// ---------------------------------------------------------------------------

function _toLower(val) {
  if (typeof val === "string") return val.toLowerCase();
  return "";
}

function _stringify(val) {
  if (val === null || val === undefined) return "";
  if (typeof val === "string") return val;
  try { return JSON.stringify(val); } catch (_) { return String(val); }
}

function _containsAny(haystack, needles) {
  const h = _toLower(haystack);
  for (const needle of needles) {
    if (h.includes(_toLower(needle))) return needle;
  }
  return null;
}

function _matchesAnyPattern(text, patterns) {
  const t = _stringify(text);
  for (const re of patterns) {
    if (re.test(t)) return re.toString();
  }
  return null;
}

function _findingId(counter) {
  return `SA-${String(counter).padStart(3, "0")}`;
}

function _riskOrder(level) {
  const order = {
    [SELF_AUDIT_RISK_LEVELS.NONE]:     0,
    [SELF_AUDIT_RISK_LEVELS.LOW]:      1,
    [SELF_AUDIT_RISK_LEVELS.MEDIUM]:   2,
    [SELF_AUDIT_RISK_LEVELS.HIGH]:     3,
    [SELF_AUDIT_RISK_LEVELS.BLOCKING]: 4,
  };
  return order[level] ?? 0;
}

function _maxRisk(a, b) {
  return _riskOrder(a) >= _riskOrder(b) ? a : b;
}

// Redacta potencial segredo para não expô-lo no evidence
function _redactSecret(text) {
  if (typeof text !== "string") return "[redacted]";
  return text.slice(0, 8) + "...[REDACTED]";
}

// ---------------------------------------------------------------------------
// Detectores por categoria
// ---------------------------------------------------------------------------

function _detectSecretExposure(input, findings, counter) {
  const toCheck = [
    _stringify(input.message),
    _stringify(input.responseDraft),
    _stringify(input.metadata),
  ].join(" ");

  const match = _matchesAnyPattern(toCheck, _SECRET_PATTERNS);
  if (!match) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE,
    severity:       SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message:        "Possível segredo, token ou API key detectado no conteúdo auditado.",
    evidence:       "Padrão de segredo encontrado (redactado para segurança). Verifique responseDraft e metadata.",
    recommendation: "Remover imediatamente qualquer API key, token, secret ou dado sensível da resposta. Nunca incluir segredos em respostas ou código.",
  });
  return counter;
}

function _detectFakeExecution(input, findings, counter) {
  const toCheck = _stringify(input.responseDraft);
  const term = _containsAny(toCheck, _FAKE_EXECUTION_TERMS);
  if (!term) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.FAKE_EXECUTION,
    severity:       SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message:        "A resposta afirma execução real sem evidência verificável.",
    evidence:       `Termo detectado: "${term}". Sem commit hash, log de execução, resultado de teste ou evidência equivalente.`,
    recommendation: "Remover afirmação de execução. Apresentar evidência real (commit, log, ID de deploy) ou usar linguagem condicional.",
  });
  return counter;
}

function _detectFalseCapability(input, findings, counter) {
  const toCheck = [
    _stringify(input.responseDraft),
    _stringify(input.message),
  ].join(" ");

  const term = _containsAny(toCheck, _FALSE_CAPABILITY_TERMS);
  if (!term) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY,
    severity:       SELF_AUDIT_RISK_LEVELS.HIGH,
    message:        "A resposta afirma capacidade que o sistema não possui ou não executou.",
    evidence:       `Termo detectado: "${term}". /skills/run não existe. Skill Router, Self-Audit, Brain Loader e Intent Retrieval são read-only documentais nesta fase.`,
    recommendation: "Corrigir afirmação. Marcar claramente: 'documental (não executa)', 'read-only', ou 'planejado para PR futura'. Nunca afirmar execução sem evidência.",
  });
  return counter;
}

function _detectUnauthorizedAction(input, findings, counter) {
  const toCheck = [
    _stringify(input.message),
    _stringify(input.responseDraft),
  ].join(" ");

  const term = _containsAny(toCheck, _UNAUTHORIZED_ACTION_TERMS);
  if (!term) return counter;

  // Verificar se há aprovação explícita no contexto
  const ctx = input.context || {};
  const hasExplicitApproval = ctx.human_approved === true || ctx.approval_confirmed === true;
  if (hasExplicitApproval) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION,
    severity:       SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message:        "Pedido ou declaração de ação não autorizada detectado.",
    evidence:       `Termo detectado: "${term}". Nenhuma aprovação humana explícita encontrada no contexto.`,
    recommendation: "Parar. Exigir aprovação humana explícita antes de qualquer deploy, rollback, escrita em KV ou criação de endpoint. Consultar contrato ativo.",
  });
  return counter;
}

function _detectWrongMode(input, findings, counter) {
  const intent = input.intentClassification?.intent || "";
  const isOperational = input.isOperationalContext === true;

  const frustrationIntents = [
    "frustration_or_trust_issue",
    "frustration",
    "trust_issue",
  ];

  const isFrustration = frustrationIntents.some(f => intent.includes(f));

  if (isFrustration && isOperational) {
    findings.push({
      id:             _findingId(counter++),
      category:       SELF_AUDIT_CATEGORIES.WRONG_MODE,
      severity:       SELF_AUDIT_RISK_LEVELS.MEDIUM,
      message:        "Intenção de frustração/confiança ativou contexto operacional pesado.",
      evidence:       `intent="${intent}", isOperationalContext=true. Frustração não deveria ativar modo operacional — é sinal emocional, não pedido de execução.`,
      recommendation: "Reclassificar como conversa. Responder com empatia e clareza. Não propor próxima PR ou executar ação baseado em frustração.",
    });
    return counter;
  }

  // Verificar se intenção conversacional está com modo operacional pesado
  const conversationalIntents = ["conversation", "small_talk", "greeting", "chitchat"];
  const isConversational = conversationalIntents.some(f => intent.includes(f));

  if (isConversational && isOperational) {
    findings.push({
      id:             _findingId(counter++),
      category:       SELF_AUDIT_CATEGORIES.WRONG_MODE,
      severity:       SELF_AUDIT_RISK_LEVELS.LOW,
      message:        "Intenção conversacional com contexto operacional ativo.",
      evidence:       `intent="${intent}", isOperationalContext=true. Mensagens conversacionais não precisam de modo operacional pesado.`,
      recommendation: "Verificar se target default está ativando modo operacional desnecessariamente. Responder de forma natural e conversacional.",
    });
  }

  return counter;
}

function _detectDocsOverProduct(input, findings, counter) {
  const message = _stringify(input.message);
  const term = _containsAny(message, _DOCS_OVER_PRODUCT_TERMS);
  if (!term) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT,
    severity:       SELF_AUDIT_RISK_LEVELS.MEDIUM,
    message:        "Usuário sinaliza excesso documental em relação a produto funcional.",
    evidence:       `Termo detectado na mensagem: "${term}". Sinal de frustração com ritmo documental vs. ritmo de produto.`,
    recommendation: "Priorizar PR-IMPL concreta antes de nova PR-DOCS. Verificar se há produto entregável antes de nova documentação.",
  });
  return counter;
}

function _detectMissingSource(input, findings, counter) {
  const draft = _stringify(input.responseDraft);
  if (!draft) return counter;

  // Detectar afirmações de estado sem fonte
  const statePatterns = [
    /o worker\s+\w+\s+já está (ativo|funcionando|online|em produção)/i,
    /o sistema (está|fica|roda) em produção/i,
    /o endpoint (está|fica|responde|existe)/i,
    /o deploy (está|foi|ficou) (completo|ativo|rodando)/i,
    /a rota (está|existe|responde)/i,
    /o binding (está|existe|está configurado)/i,
    /o worker (está|existe|responde|roda)/i,
  ];

  const hasMeta = input.metadata && typeof input.metadata === "object"
    && Object.keys(input.metadata).length > 0;

  let found = false;
  for (const re of statePatterns) {
    if (re.test(draft)) { found = true; break; }
  }

  if (!found) return counter;

  // Se há metadata de fonte, abaixar severidade
  const severity = hasMeta ? SELF_AUDIT_RISK_LEVELS.LOW : SELF_AUDIT_RISK_LEVELS.MEDIUM;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.MISSING_SOURCE,
    severity,
    message:        "Resposta afirma estado do sistema sem fonte verificável.",
    evidence:       "Afirmação sobre estado de worker, endpoint, deploy ou binding sem metadado de confirmação no input.",
    recommendation: "Citar fonte verificável (status, logs, handoff, commit). Se não há fonte, usar linguagem de incerteza: 'baseado em X', 'conforme último status'.",
  });
  return counter;
}

function _detectContractDrift(input, findings, counter) {
  const meta = input.metadata || {};

  const proofFailed = meta.proof_failed === true;
  const advancingToNext = meta.advancing_to_next_phase === true;

  if (proofFailed && advancingToNext) {
    findings.push({
      id:             _findingId(counter++),
      category:       SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity:       SELF_AUDIT_RISK_LEVELS.BLOCKING,
      message:        "Tentativa de avançar para próxima fase com prova falhada.",
      evidence:       "metadata.proof_failed=true e metadata.advancing_to_next_phase=true simultaneamente. Contrato exige prova aprovada antes de avançar.",
      recommendation: "Parar. Corrigir falha da prova antes de avançar para próxima PR ou fase. Não registrar PR-PROVA como ✅ com teste falhando.",
    });
    return counter;
  }

  if (proofFailed) {
    findings.push({
      id:             _findingId(counter++),
      category:       SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity:       SELF_AUDIT_RISK_LEVELS.HIGH,
      message:        "Prova falhada detectada nos metadados.",
      evidence:       "metadata.proof_failed=true. Verificar se tentativa de avanço está sendo feita.",
      recommendation: "Corrigir falha antes de avançar. Documentar a falha com evidência real.",
    });
    return counter;
  }

  // Detectar divergência de PR sugerida vs contrato
  const suggestedPR = meta.suggested_next_pr;
  const contractPR  = meta.contract_next_pr;

  if (suggestedPR && contractPR && suggestedPR !== contractPR) {
    findings.push({
      id:             _findingId(counter++),
      category:       SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity:       SELF_AUDIT_RISK_LEVELS.HIGH,
      message:        "PR sugerida diverge do contrato ativo.",
      evidence:       `suggested_next_pr="${suggestedPR}" mas contract_next_pr="${contractPR}" conforme schema/contracts/INDEX.md.`,
      recommendation: "Consultar schema/contracts/INDEX.md antes de propor próxima PR. A PR sugerida deve bater com o contrato ativo.",
    });
  }

  return counter;
}

function _detectScopeViolation(input, findings, counter) {
  const meta = input.metadata || {};
  const prType = typeof meta.pr_type === "string" ? meta.pr_type.toUpperCase() : null;
  const filesChanged = Array.isArray(meta.files_changed) ? meta.files_changed : [];

  if (!prType || filesChanged.length === 0) return counter;

  const violations = [];

  // Verificar arquivos sempre proibidos
  for (const f of filesChanged) {
    for (const prohibited of _ALWAYS_PROHIBITED_FILES) {
      if (_toLower(f).includes(_toLower(prohibited))) {
        violations.push(`${f} (sempre proibido sem escopo explícito)`);
      }
    }
    // Verificar Panel, Executor, Workflows
    if (_PANEL_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Panel)`);
    if (_EXECUTOR_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Executor)`);
    if (_WORKFLOW_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Workflow GitHub Actions)`);
  }

  // Verificar por tipo de PR
  const prohibited = _PROHIBITED_FILES_BY_PR_TYPE[prType] || [];
  for (const f of filesChanged) {
    const fBase = f.split("/").pop();
    for (const p of prohibited) {
      if (_toLower(fBase) === _toLower(p) || _toLower(f).endsWith(_toLower(p))) {
        if (!violations.includes(`${f} (proibido para ${prType})`)) {
          violations.push(`${f} (proibido para ${prType})`);
        }
      }
    }
  }

  if (violations.length === 0) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION,
    severity:       SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message:        `Violação de escopo: arquivos fora do escopo da ${prType} detectados.`,
    evidence:       `Arquivos violadores: ${violations.join(", ")}.`,
    recommendation: "Reverter alterações fora do escopo declarado. Verificar `git diff --name-only` antes de commitar. Consultar contrato ativo para confirmar escopo.",
  });
  return counter;
}

function _detectRuntimeVsDocumentationConfusion(input, findings, counter) {
  const toCheck = _stringify(input.responseDraft);
  const term = _containsAny(toCheck, _RUNTIME_DOC_CONFUSION_TERMS);
  if (!term) return counter;

  findings.push({
    id:             _findingId(counter++),
    category:       SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION,
    severity:       SELF_AUDIT_RISK_LEVELS.MEDIUM,
    message:        "Resposta confunde componente documental com runtime real.",
    evidence:       `Termo detectado: "${term}". Self-Audit (PR56), Skill Router, Brain Loader e Intent Retrieval são read-only documentais — não executam ações reais nesta fase.`,
    recommendation: "Deixar claro na resposta: 'documental (não executa)', 'read-only', 'planejado para PR futura'. Evitar afirmar que componente documental realiza ação real.",
  });
  return counter;
}

// ---------------------------------------------------------------------------
// Função principal
// ---------------------------------------------------------------------------

/**
 * runEnaviaSelfAudit(input) — Self-Audit read-only v1.
 *
 * @param {object} input
 * @param {string}  [input.message]              — Mensagem do usuário
 * @param {object}  [input.context]              — Contexto da conversa
 * @param {object}  [input.intentClassification] — Resultado do classificador de intenção
 * @param {object}  [input.skillRouting]         — Resultado do skill router
 * @param {object}  [input.intentRetrieval]      — Resultado do intent retrieval
 * @param {boolean} [input.isOperationalContext] — Flag de contexto operacional
 * @param {*}       [input.responseDraft]        — Rascunho da resposta (string ou objeto)
 * @param {object}  [input.metadata]             — Metadados adicionais (pr_type, files_changed, etc.)
 *
 * @returns {{ self_audit: object }} — Campo aditivo `self_audit` conforme OUTPUT_CONTRACT.md
 */
export function runEnaviaSelfAudit(input) {
  // Validação defensiva de entrada
  if (!input || typeof input !== "object") {
    input = {};
  }

  const findings = [];
  let counter = 1;

  // --- Executar detectores em ordem de severidade (mais crítico primeiro) ---

  // 1. Secret exposure — máxima prioridade (blocking)
  counter = _detectSecretExposure(input, findings, counter);

  // 2. Fake execution — blocking
  counter = _detectFakeExecution(input, findings, counter);

  // 3. Unauthorized action — blocking
  counter = _detectUnauthorizedAction(input, findings, counter);

  // 4. Scope violation — blocking
  counter = _detectScopeViolation(input, findings, counter);

  // 5. Contract drift — blocking/high
  counter = _detectContractDrift(input, findings, counter);

  // 6. False capability — high
  counter = _detectFalseCapability(input, findings, counter);

  // 7. Runtime vs documentation confusion — medium
  counter = _detectRuntimeVsDocumentationConfusion(input, findings, counter);

  // 8. Wrong mode — medium/low
  counter = _detectWrongMode(input, findings, counter);

  // 9. Missing source — medium/low
  counter = _detectMissingSource(input, findings, counter);

  // 10. Docs over product — medium
  counter = _detectDocsOverProduct(input, findings, counter);

  // --- Calcular risk_level geral ---
  let risk_level = SELF_AUDIT_RISK_LEVELS.NONE;
  const warnings = [];

  for (const f of findings) {
    risk_level = _maxRisk(risk_level, f.severity);
    // Achados não-bloqueadores viram warnings também
    if (f.severity === SELF_AUDIT_RISK_LEVELS.LOW || f.severity === SELF_AUDIT_RISK_LEVELS.MEDIUM) {
      warnings.push(`[${f.category}] ${f.message}`);
    }
  }

  // should_block somente quando blocking com evidência real
  const should_block = risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING;

  // next_safe_action baseado no risco geral
  let next_safe_action;
  if (risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING) {
    next_safe_action = "Parar. Resolver bloqueio antes de prosseguir. Ver findings para evidência e recomendação.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.HIGH) {
    next_safe_action = "Revisar findings de alto risco antes de prosseguir. Corrigir afirmações indevidas.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.MEDIUM) {
    next_safe_action = "Verificar alertas. Prosseguir com atenção às recomendações dos findings.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.LOW) {
    next_safe_action = "Observações leves. Prosseguir normalmente com atenção às boas práticas.";
  } else {
    next_safe_action = "Resposta segura. Prosseguir normalmente.";
  }

  return {
    self_audit: {
      applied:          true,
      mode:             "read_only",
      risk_level,
      findings,
      should_block,
      warnings,
      next_safe_action,
    },
  };
}
