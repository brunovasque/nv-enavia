// ============================================================================
// 📦 ENAVIA — Browser Arm Contract v1.0 (P25)
//
// ─── HIERARQUIA DE FONTES ───────────────────────────────────────────────────
//
//   SOBERANA:      schema/CONSTITUIÇÃO (Constituição da ENAVIA Pessoal v1)
//   INTERMEDIÁRIA: schema/autonomy-contract.js (P23 — contrato de autonomia)
//   SUBORDINADA:   schema/browser-arm-contract.js (ESTE ARQUIVO)
//
//   Este contrato é o braço externo de browser/navegação/pesquisa da Enavia.
//   É subordinado ao contrato de autonomia (P23) e à CONSTITUIÇÃO.
//   Em caso de ambiguidade, a CONSTITUIÇÃO prevalece, depois P23, depois P25.
//
// ─── PROPÓSITO ──────────────────────────────────────────────────────────────
//
//   Definir de forma canônica:
//     - Função do braço (olhos externos da Enavia)
//     - Ações permitidas (navegação, pesquisa, operação visual/web)
//     - Ações condicionadas (exclusão, expansão de escopo)
//     - Obrigações (sugestão, permissão, escopo)
//     - Rota/base externa canônica (run.nv-imoveis.com/*)
//     - Enforcement em runtime via enforceBrowserArm()
//     - Estrutura de sugestão/evolução da Enavia
//     - Estrutura de rotina de pesquisa/evolução
//
// ─── DIVISÃO OPERACIONAL ────────────────────────────────────────────────────
//
//   Workers / Cloudflare / service binding / runtime / deploy worker = executor nativo (separado)
//   Branch / PR / repo / review / correção / parecer / approval merge = braço GitHub/PR (P24)
//   Navegação / pesquisa / operação visual / validação externa = ESTE BRAÇO (P25)
//
// ─── NÃO CONTÉM ─────────────────────────────────────────────────────────────
//
//   - Executor Cloudflare (separado, Workers/runtime)
//   - GitHub/PR arm (P24)
//   - Deploy/test como braço (P26)
//   - LLM / embeddings / heurística opaca
//   - Persistência / I/O direto
//   - Implementação completa do browser
//
// P25 APENAS — não misturar com executor Cloudflare, P24, P26.
// ============================================================================

import {
  AUTONOMY_LEVEL,
  classifyAction,
  evaluateGates,
  validateSpecialistArmCompliance,
} from "./autonomy-contract.js";

// ---------------------------------------------------------------------------
// ARM_ID — identificador canônico do braço Browser
// ---------------------------------------------------------------------------
const BROWSER_ARM_ID = "p25_browser_arm";

// ---------------------------------------------------------------------------
// EXTERNAL_BASE — rota/base externa canônica do browser
// ---------------------------------------------------------------------------
const BROWSER_EXTERNAL_BASE = {
  host: "run.nv-imoveis.com",
  pattern: "run.nv-imoveis.com/*",
  protocol: "https",
  base_url: "https://run.nv-imoveis.com",
  description: "Rota/base externa do Browser Arm — olhos externos da Enavia",
};

// ---------------------------------------------------------------------------
// FUNÇÃO DO BRAÇO — papel canônico do P25
// ---------------------------------------------------------------------------
const BROWSER_ARM_ROLE = {
  id: BROWSER_ARM_ID,
  name: "Browser Arm",
  version: "1.0",
  purpose: [
    "olhos externos da Enavia",
    "pesquisa externa",
    "navegação e operação visual/web",
    "teste e validação de fluxos externos",
    "exploração de ferramentas úteis",
    "fonte de evolução/sugestões para a própria Enavia",
  ],
  external_base: BROWSER_EXTERNAL_BASE,
};

// ---------------------------------------------------------------------------
// AÇÕES PERMITIDAS (autônomas dentro do escopo aprovado)
//
// O braço Browser pode executar estas ações dentro do escopo aprovado:
//   - abrir página
//   - navegar
//   - clicar
//   - preencher formulário
//   - fazer login
//   - ler resultado visual/textual
//   - pesquisar
//   - testar ferramenta externa
//   - usar credenciais salvas
// ---------------------------------------------------------------------------
const BROWSER_ALLOWED_ACTIONS = [
  "open_page",
  "navigate",
  "click",
  "fill_form",
  "login",
  "read_visual_result",
  "search",
  "test_external_tool",
  "use_saved_credentials",
];

// ---------------------------------------------------------------------------
// AÇÕES CONDICIONADAS (dependem de justificativa ou permissão)
//
//   - upload: somente quando o objetivo vigente exigir
//   - publish: subordinada ao objetivo/contrato vigente
//   - delete: só com justificativa restrita ao objetivo vigente
//   - expand_scope: sempre exige sugestão + permissão do usuário
// ---------------------------------------------------------------------------
const BROWSER_CONDITIONAL_ACTIONS = [
  "upload",
  "publish",
  "delete",
  "expand_scope",
];

// ---------------------------------------------------------------------------
// Condição para cada ação condicionada
// ---------------------------------------------------------------------------
const CONDITIONAL_ACTION_RULES = {
  upload: {
    action: "upload",
    condition: "objective_requires",
    description: "Upload permitido somente quando necessário ao objetivo vigente.",
  },
  publish: {
    action: "publish",
    condition: "objective_requires",
    description: "Publicação permitida somente quando subordinada ao objetivo/contrato vigente.",
  },
  delete: {
    action: "delete",
    condition: "justified_by_objective",
    description: "Exclusão só com justificativa restrita ao objetivo vigente.",
    requires_justification: true,
  },
  expand_scope: {
    action: "expand_scope",
    condition: "user_permission_required",
    description: "Expansão de escopo sempre exige sugestão ao usuário + permissão explícita.",
    requires_user_permission: true,
  },
};

// ---------------------------------------------------------------------------
// AÇÕES PROIBIDAS INCONDICIONALMENTE
// ---------------------------------------------------------------------------
const PROHIBITED_ACTIONS_P25 = [
  "exit_scope",
  "regress_contract",
  "regress_plan",
  "regress_task",
  "generate_drift",
  "act_outside_scope",
  "deviate_contract_without_escalation",
  "mix_cloudflare_executor_with_browser_arm",
  "mix_github_arm_with_browser_arm",
  "expand_scope_without_permission",
  "auto_expand_scope",
  "ignore_cost_limits",
  "delete_without_justification",
];

// ---------------------------------------------------------------------------
// OBRIGAÇÕES DO BRAÇO
//
// O braço Browser DEVE:
//   1. Nunca sair do escopo sem escalar
//   2. Sempre pedir permissão quando encontrar oportunidade fora do escopo
//   3. Sempre poder sugerir melhoria/evolução/ferramenta útil
//   4. Descrever descobertas com: o que, por que, o que falta, impacto, permissão
// ---------------------------------------------------------------------------
const BROWSER_ARM_OBLIGATIONS = [
  "never_exit_scope_without_escalation",
  "always_request_permission_for_out_of_scope_opportunity",
  "always_suggest_improvements_and_tools",
  "always_describe_discovery_with_full_context",
  "respect_cost_limits_for_recurring_routines",
];

// ---------------------------------------------------------------------------
// SUGGESTION_SHAPE — estrutura canônica para sugestões da Enavia
//
// Quando o browser encontra algo interessante fora do escopo:
//   1. Sempre sugere
//   2. Sempre pede permissão
//   3. Nunca assume expansão de escopo sozinho
// ---------------------------------------------------------------------------
const SUGGESTION_SHAPE = {
  required_fields: [
    "type",              // tipo da sugestão (tool, integration, capability, insight)
    "discovery",         // o que foi encontrado
    "benefit",           // por que ajuda
    "missing_requirement", // o que falta para usar (acesso, config, permissão)
    "expected_impact",   // impacto esperado
    "permission_needed", // se precisa permissão do usuário (boolean)
  ],
  valid_types: [
    "tool",
    "integration",
    "capability",
    "insight",
    "optimization",
    "security_improvement",
  ],
};

// ---------------------------------------------------------------------------
// validateSuggestion(suggestion)
//
// Valida se uma sugestão segue a estrutura canônica.
//
// Retorna:
//   { valid, missing_fields, reason }
// ---------------------------------------------------------------------------
function validateSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") {
    return {
      valid: false,
      missing_fields: SUGGESTION_SHAPE.required_fields,
      reason: "Sugestão inválida — deve ser um objeto com os campos obrigatórios.",
    };
  }

  const missing = SUGGESTION_SHAPE.required_fields.filter(
    (f) => suggestion[f] === undefined || suggestion[f] === null || suggestion[f] === ""
  );

  if (missing.length > 0) {
    return {
      valid: false,
      missing_fields: missing,
      reason: `Sugestão incompleta — campos faltantes: ${missing.join(", ")}.`,
    };
  }

  if (!SUGGESTION_SHAPE.valid_types.includes(suggestion.type)) {
    return {
      valid: false,
      missing_fields: [],
      reason: `Tipo de sugestão inválido: '${suggestion.type}'. Tipos válidos: ${SUGGESTION_SHAPE.valid_types.join(", ")}.`,
    };
  }

  return {
    valid: true,
    missing_fields: [],
    reason: "Sugestão válida — todos os campos obrigatórios presentes e tipo válido.",
  };
}

// ---------------------------------------------------------------------------
// RESEARCH_ROUTINE_SHAPE — estrutura para rotina de pesquisa/evolução
//
// Base para rotina recorrente controlável (sem automação pesada nesta PR).
// ---------------------------------------------------------------------------
const RESEARCH_ROUTINE_SHAPE = {
  required_fields: [
    "routine_id",       // identificador da rotina
    "objective",        // objetivo da pesquisa
    "frequency",        // frequência (on_demand, daily, weekly)
    "cost_limit",       // limite de custo/uso por execução
    "active",           // se a rotina está ativa (boolean)
  ],
  valid_frequencies: [
    "on_demand",
    "daily",
    "weekly",
    "monthly",
  ],
  defaults: {
    frequency: "on_demand",
    active: false,
    cost_limit: "low",
  },
};

// ---------------------------------------------------------------------------
// BROWSER_ARM_STATE_SHAPE — shape mínimo de estado/metadata do braço
//
// Usado pelo runtime para rastrear o estado do P25.
// ---------------------------------------------------------------------------
const BROWSER_ARM_STATE_SHAPE = {
  required_fields: [
    "arm_id",           // BROWSER_ARM_ID
    "status",           // idle | active | error | disabled
    "external_base",    // BROWSER_EXTERNAL_BASE
    "last_action",      // última ação executada (ou null)
    "last_action_ts",   // timestamp da última ação (ou null)
  ],
  valid_statuses: [
    "idle",
    "active",
    "error",
    "disabled",
  ],
  initial_state: {
    arm_id: BROWSER_ARM_ID,
    status: "idle",
    external_base: BROWSER_EXTERNAL_BASE,
    last_action: null,
    last_action_ts: null,
  },
};

// ---------------------------------------------------------------------------
// classifyBrowserArmAction(action)
//
// Classifica uma ação no contexto do braço Browser.
//
// Retorna:
//   {
//     action,
//     arm_id,
//     belongs_to_browser_arm,
//     autonomy_level,
//     condition,          — regra condicional (se aplicável) ou null
//     reason,
//   }
// ---------------------------------------------------------------------------
function classifyBrowserArmAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyBrowserArmAction: 'action' é obrigatório e deve ser string não-vazia");
  }

  const a = action.trim();

  // Prohibited → immediate block
  if (PROHIBITED_ACTIONS_P25.includes(a)) {
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      condition: null,
      reason: `Ação '${a}' é proibida incondicionalmente pelo contrato do braço Browser.`,
    };
  }

  // Allowed → autonomous within scope
  if (BROWSER_ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      condition: null,
      reason: `Ação '${a}' é permitida pelo braço Browser dentro do escopo aprovado.`,
    };
  }

  // Conditional → depends on justification or permission
  if (BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    const rule = CONDITIONAL_ACTION_RULES[a];
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: rule.requires_user_permission
        ? AUTONOMY_LEVEL.REQUIRES_HUMAN
        : AUTONOMY_LEVEL.AUTONOMOUS,
      condition: rule,
      reason: rule.description,
    };
  }

  // Not in this arm's catalogue
  return {
    action: a,
    arm_id: BROWSER_ARM_ID,
    belongs_to_browser_arm: false,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    condition: null,
    reason: `Ação '${a}' não pertence ao catálogo do braço Browser — requer OK humano por cautela.`,
  };
}

// ---------------------------------------------------------------------------
// validateConditionalAction({ action, justification, user_permission })
//
// Valida se uma ação condicionada pode ser executada.
//
// Retorna:
//   { allowed, action, condition, reason }
// ---------------------------------------------------------------------------
function validateConditionalAction({ action, justification, user_permission } = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("validateConditionalAction: 'action' é obrigatório e deve ser string não-vazia");
  }

  const a = action.trim();

  if (!BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    return {
      allowed: true,
      action: a,
      condition: null,
      reason: `Ação '${a}' não é condicionada — pode prosseguir sem validação condicional.`,
    };
  }

  const rule = CONDITIONAL_ACTION_RULES[a];

  // expand_scope requires explicit user permission
  if (rule.requires_user_permission) {
    if (user_permission !== true) {
      return {
        allowed: false,
        action: a,
        condition: rule,
        reason: `Ação '${a}' exige permissão explícita do usuário — não fornecida.`,
      };
    }
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `Ação '${a}' permitida — permissão do usuário fornecida.`,
    };
  }

  // delete requires justification
  if (rule.requires_justification) {
    if (typeof justification !== "string" || justification.trim() === "") {
      return {
        allowed: false,
        action: a,
        condition: rule,
        reason: `Ação '${a}' exige justificativa restrita ao objetivo vigente — não fornecida.`,
      };
    }
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `Ação '${a}' permitida — justificativa fornecida: ${justification.trim()}`,
    };
  }

  // upload / publish — need objective context (boolean flag)
  if (rule.condition === "objective_requires") {
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `Ação '${a}' permitida — subordinada ao objetivo vigente.`,
    };
  }

  return {
    allowed: false,
    action: a,
    condition: rule,
    reason: `Ação '${a}' não pôde ser validada — regra desconhecida.`,
  };
}

// ---------------------------------------------------------------------------
// enforceBrowserArm({ action, scope_approved, gates_context,
//                     justification, user_permission,
//                     drift_detected, regression_detected })
//
// Ponto ÚNICO de enforcement em runtime do braço Browser.
// Deve ser chamado antes de qualquer ação sensível do braço.
//
// Valida no mínimo:
//   1. Se a ação pertence ao braço Browser
//   2. Escopo aprovado
//   3. Ausência de drift
//   4. Ausência de regressão
//   5. Ação condicionada (justificativa/permissão)
//   6. Conformidade com P23 (autonomy contract)
//
// Se violar: bloqueia, explica o motivo, não age.
//
// Retorna:
//   {
//     allowed,
//     blocked,
//     arm_id,
//     action,
//     level,
//     reason,
//     classification,
//     p23_compliance,
//     conditional_check,    — null se ação não é condicionada
//     suggestion_required,  — true se ação fora do escopo → deve sugerir
//   }
// ---------------------------------------------------------------------------
function enforceBrowserArm({
  action,
  scope_approved,
  gates_context,
  justification = null,
  user_permission = false,
  drift_detected = false,
  regression_detected = false,
} = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("enforceBrowserArm: 'action' é obrigatório e deve ser string não-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("enforceBrowserArm: 'scope_approved' é obrigatório e deve ser boolean");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("enforceBrowserArm: 'gates_context' é obrigatório e deve ser um objeto");
  }
  if (typeof drift_detected !== "boolean") {
    throw new Error("enforceBrowserArm: 'drift_detected' deve ser boolean");
  }
  if (typeof regression_detected !== "boolean") {
    throw new Error("enforceBrowserArm: 'regression_detected' deve ser boolean");
  }

  const a = action.trim();

  // ── STEP 1: Classify the action in the Browser arm context ──
  const classification = classifyBrowserArmAction(a);

  // Prohibited → immediate block
  if (classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.PROHIBITED,
      reason: classification.reason,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false,
    };
  }

  // ── STEP 2: Check if action belongs to this arm ──
  if (!classification.belongs_to_browser_arm) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_not_browser_arm",
      reason: `Ação '${a}' não pertence ao braço Browser — bloqueada. Não misturar com executor Cloudflare ou braço GitHub.`,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: true,
    };
  }

  // ── STEP 3: Check scope ──
  if (!scope_approved) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_out_of_scope",
      reason: `Ação '${a}' fora do escopo aprovado — braço Browser não pode agir fora do escopo. Deve sugerir + pedir permissão.`,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: true,
    };
  }

  // ── STEP 4: Check drift ──
  if (drift_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_drift_detected",
      reason: "Drift detectado — braço Browser bloqueado. É proibido gerar ou aceitar drift.",
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false,
    };
  }

  // ── STEP 5: Check regression ──
  if (regression_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_regression_detected",
      reason: "Regressão detectada — braço Browser bloqueado. É proibido permitir regressão.",
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false,
    };
  }

  // ── STEP 6: Validate P23 compliance ──
  const p23_compliance = validateSpecialistArmCompliance({
    arm_id: BROWSER_ARM_ID,
    action: a,
    gates_context,
  });

  if (!p23_compliance.is_compliant) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_p23_noncompliant",
      reason: p23_compliance.reason,
      classification,
      p23_compliance,
      conditional_check: null,
      suggestion_required: false,
    };
  }

  // ── STEP 7: Conditional action check ──
  let conditional_check = null;
  if (BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    conditional_check = validateConditionalAction({
      action: a,
      justification,
      user_permission,
    });
    if (!conditional_check.allowed) {
      return {
        allowed: false,
        blocked: true,
        arm_id: BROWSER_ARM_ID,
        action: a,
        level: "blocked_conditional_not_met",
        reason: conditional_check.reason,
        classification,
        p23_compliance,
        conditional_check,
        suggestion_required: a === "expand_scope",
      };
    }
  }

  // ── TUDO OK — ação permitida ──
  return {
    allowed: true,
    blocked: false,
    arm_id: BROWSER_ARM_ID,
    action: a,
    level: classification.autonomy_level,
    reason: `Braço Browser: ação '${a}' permitida — escopo aprovado, sem drift, sem regressão, P23 compliant.`,
    classification,
    p23_compliance,
    conditional_check,
    suggestion_required: false,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Arm ID
  BROWSER_ARM_ID,

  // External base
  BROWSER_EXTERNAL_BASE,

  // Role
  BROWSER_ARM_ROLE,

  // Catalogues
  BROWSER_ALLOWED_ACTIONS,
  BROWSER_CONDITIONAL_ACTIONS,
  CONDITIONAL_ACTION_RULES,
  PROHIBITED_ACTIONS_P25,

  // Obligations
  BROWSER_ARM_OBLIGATIONS,

  // Suggestion shape
  SUGGESTION_SHAPE,
  validateSuggestion,

  // Research routine shape
  RESEARCH_ROUTINE_SHAPE,

  // State shape
  BROWSER_ARM_STATE_SHAPE,

  // Functions
  classifyBrowserArmAction,
  validateConditionalAction,

  // Runtime enforcement (single entry point for P25)
  enforceBrowserArm,
};
