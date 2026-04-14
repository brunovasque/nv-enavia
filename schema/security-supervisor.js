// ============================================================================
// 🛡️ ENAVIA — Security Supervisor v1.0 (P26-PR1)
//
// ─── HIERARQUIA DE FONTES ───────────────────────────────────────────────────
//
//   SOBERANA:      schema/CONSTITUIÇÃO (Constituição da ENAVIA Pessoal v1)
//   INTERMEDIÁRIA: schema/autonomy-contract.js (P23 — contrato de autonomia)
//   INTERMEDIÁRIA: schema/enavia-constitution.js (guardrails runtime)
//   SUBORDINADAS:  schema/github-pr-arm-contract.js (P24)
//                  schema/browser-arm-contract.js   (P25)
//   ESTE ARQUIVO:  schema/security-supervisor.js    (P26 — Supervisor)
//
//   O Supervisor de Segurança é a camada de avaliação centralizada
//   que fica ACIMA dos braços (P24/P25) e SUBORDINADA à constituição
//   e ao contrato de autonomia (P23). Ele NÃO duplica regras já
//   existentes; delega e consolida decisões.
//
// ─── RESPONSABILIDADES ──────────────────────────────────────────────────────
//
//   1. Receber contexto de ação sensível
//   2. Delegar validação de autonomia para enforceConstitution (P23)
//   3. Delegar validação de braço para enforceGitHubPrArm/enforceBrowserArm
//   4. Avaliar escopo, risco, evidência e gate humano
//   5. Retornar decisão estruturada e auditável
//
// ─── O QUE NÃO FAZ (PR1) ───────────────────────────────────────────────────
//
//   - Enforcement real (isso é PR2)
//   - Persistência / I/O
//   - Painel / UI
//   - LLM / heurística opaca
//   - Duplicação de regras de P23/P24/P25
//
// Escopo: WORKER-ONLY. Não misturar com painel, browser, executor ou memória.
// ============================================================================

import {
  enforceConstitution,
  classifyAction,
  evaluateGates,
  evaluateFailurePolicy,
  AUTONOMY_LEVEL,
  ENVIRONMENT,
  PROHIBITED_ACTIONS,
  HUMAN_OK_REQUIRED_ACTIONS,
} from "./autonomy-contract.js";

import { getEnaviaConstitution } from "./enavia-constitution.js";

// ---------------------------------------------------------------------------
// DECISION — enum canônico das decisões do Supervisor
// ---------------------------------------------------------------------------
const DECISION = {
  ALLOW:              "allow",
  BLOCK:              "block",
  NEEDS_HUMAN_REVIEW: "needs_human_review",
};

// ---------------------------------------------------------------------------
// RISK_LEVEL — enum canônico de níveis de risco
// ---------------------------------------------------------------------------
const RISK_LEVEL = {
  LOW:    "low",
  MEDIUM: "medium",
  HIGH:   "high",
};

// ---------------------------------------------------------------------------
// REASON_CODE — códigos canônicos curtos de razão
// ---------------------------------------------------------------------------
const REASON_CODE = {
  ACTION_ALLOWED:             "ACTION_ALLOWED",
  ACTION_PROHIBITED:          "ACTION_PROHIBITED",
  SCOPE_VIOLATION:            "SCOPE_VIOLATION",
  AUTONOMY_BLOCKED:           "AUTONOMY_BLOCKED",
  GATES_FAILED:               "GATES_FAILED",
  HUMAN_APPROVAL_REQUIRED:    "HUMAN_APPROVAL_REQUIRED",
  INSUFFICIENT_EVIDENCE:      "INSUFFICIENT_EVIDENCE",
  HIGH_RISK_DETECTED:         "HIGH_RISK_DETECTED",
  ENVIRONMENT_UNSAFE:         "ENVIRONMENT_UNSAFE",
  SCOPE_CONFLICT:             "SCOPE_CONFLICT",
  ARM_ENFORCEMENT_BLOCKED:    "ARM_ENFORCEMENT_BLOCKED",
};

// ---------------------------------------------------------------------------
// _classifyRiskLevel(context)
//
// Classifica o nível de risco com base no contexto.
// Determinístico e sem I/O.
// ---------------------------------------------------------------------------
function _classifyRiskLevel(context) {
  // Ação proibida → alto risco
  if (PROHIBITED_ACTIONS.includes(context.action)) {
    return RISK_LEVEL.HIGH;
  }

  // Produção → risco alto
  if (context.environment === ENVIRONMENT.PROD) {
    return RISK_LEVEL.HIGH;
  }

  // Ação que requer OK humano → risco médio
  if (HUMAN_OK_REQUIRED_ACTIONS.includes(context.action)) {
    return RISK_LEVEL.MEDIUM;
  }

  // Sem escopo aprovado → risco médio
  if (!context.scope_approved) {
    return RISK_LEVEL.MEDIUM;
  }

  // Evidência insuficiente → risco médio
  if (context.evidence_sufficient === false) {
    return RISK_LEVEL.MEDIUM;
  }

  return RISK_LEVEL.LOW;
}

// ---------------------------------------------------------------------------
// _buildDecision(params)
//
// Constrói objeto de decisão estruturado e auditável.
// ---------------------------------------------------------------------------
function _buildDecision({
  allowed,
  decision,
  reason_code,
  reason_text,
  risk_level,
  requires_human_approval,
  scope_valid,
  autonomy_valid,
  evidence_sufficient,
  constitution_check = null,
  arm_check = null,
}) {
  return {
    allowed,
    decision,
    reason_code,
    reason_text,
    risk_level,
    requires_human_approval,
    scope_valid,
    autonomy_valid,
    evidence_sufficient,
    timestamp: new Date().toISOString(),
    supervisor_version: "1.0.0",
    // Detalhes de delegação (auditoria)
    _delegation: {
      constitution_check,
      arm_check,
    },
  };
}

// ---------------------------------------------------------------------------
// _validateEvaluationContext(ctx, fnName)
//
// Valida a estrutura mínima do contexto de avaliação.
// Lança Error com mensagem clara caso inválido.
// ---------------------------------------------------------------------------
function _validateEvaluationContext(ctx, fnName) {
  if (!ctx || typeof ctx !== "object") {
    throw new Error(`${fnName}: 'context' é obrigatório e deve ser um objeto`);
  }
  if (typeof ctx.action !== "string" || ctx.action.trim() === "") {
    throw new Error(`${fnName}: 'context.action' é obrigatório e deve ser string não-vazia`);
  }
  if (typeof ctx.environment !== "string" || !Object.values(ENVIRONMENT).includes(ctx.environment)) {
    throw new Error(
      `${fnName}: 'context.environment' deve ser "${ENVIRONMENT.TEST}" ou "${ENVIRONMENT.PROD}"`
    );
  }
  if (typeof ctx.scope_approved !== "boolean") {
    throw new Error(`${fnName}: 'context.scope_approved' é obrigatório e deve ser boolean`);
  }
  if (!ctx.gates_context || typeof ctx.gates_context !== "object") {
    throw new Error(`${fnName}: 'context.gates_context' é obrigatório e deve ser um objeto`);
  }
}

// ---------------------------------------------------------------------------
// evaluateSensitiveAction(context)
//
// Ponto central e canônico do Supervisor de Segurança.
// Avalia um contexto de ação sensível e retorna decisão estruturada.
//
// DELEGA para:
//   - enforceConstitution (P23) → autonomia + gates + ambiente
//   - classifyAction (P23) → classificação da ação
//   - evaluateFailurePolicy (P23) → política de falha (se attempt fornecido)
//
// Parâmetros:
//   context {object}:
//     action              {string}  — identificador da ação (obrigatório)
//     environment         {string}  — "TEST" | "PROD" (obrigatório)
//     scope_approved      {boolean} — se a ação está dentro do escopo aprovado (obrigatório)
//     gates_context       {object}  — contexto de gates obrigatórios (obrigatório)
//       scope_defined                       {boolean}
//       environment_defined                 {boolean}
//       risk_assessed                       {boolean}
//       authorization_present_when_required {boolean}
//       observability_preserved             {boolean}
//       evidence_available_when_required    {boolean}
//     evidence_sufficient {boolean} — se há evidência mínima suficiente (opcional, default true)
//     arm_id              {string}  — identificador do braço, se aplicável (opcional)
//     arm_check_result    {object}  — resultado de enforceGitHubPrArm/enforceBrowserArm (opcional)
//     attempt             {number}  — número da tentativa para política de falha (opcional)
//     is_high_risk        {boolean} — override de risco alto (opcional)
//
// Retorna SupervisorDecision:
//   {
//     allowed:                 boolean
//     decision:                "allow" | "block" | "needs_human_review"
//     reason_code:             string canônica curta
//     reason_text:             string curta e objetiva
//     risk_level:              "low" | "medium" | "high"
//     requires_human_approval: boolean
//     scope_valid:             boolean
//     autonomy_valid:          boolean
//     evidence_sufficient:     boolean
//     timestamp:               string ISO
//     supervisor_version:      string
//     _delegation:             { constitution_check, arm_check }
//   }
//
// Lança:
//   Error — se context ausente/inválido
// ---------------------------------------------------------------------------
function evaluateSensitiveAction(context) {
  _validateEvaluationContext(context, "evaluateSensitiveAction");

  const evidence_sufficient = context.evidence_sufficient !== false;
  const risk_level = context.is_high_risk === true
    ? RISK_LEVEL.HIGH
    : _classifyRiskLevel(context);

  // ── STEP 0: Avaliar escopo ──
  const scope_valid = context.scope_approved === true;

  // Conflito de escopo: escopo não aprovado + ação que requer escopo
  if (!scope_valid) {
    // Escopo não aprovado → bloquear ou pedir revisão
    const decision = risk_level === RISK_LEVEL.HIGH
      ? DECISION.BLOCK
      : DECISION.NEEDS_HUMAN_REVIEW;

    return _buildDecision({
      allowed: false,
      decision,
      reason_code: REASON_CODE.SCOPE_VIOLATION,
      reason_text: "Ação fora do escopo aprovado — escopo não validado.",
      risk_level,
      requires_human_approval: true,
      scope_valid: false,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: null,
      arm_check: context.arm_check_result || null,
    });
  }

  // ── STEP 1: Delegar para enforceConstitution (P23) ──
  let constitutionCheck;
  try {
    constitutionCheck = enforceConstitution({
      action: context.action,
      environment: context.environment,
      scope_approved: context.scope_approved,
      gates_context: context.gates_context,
    });
  } catch (err) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.AUTONOMY_BLOCKED,
      reason_text: `Erro ao avaliar autonomia: ${err.message}`,
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: null,
      arm_check: context.arm_check_result || null,
    });
  }

  const autonomy_valid = constitutionCheck.allowed === true;

  // ── STEP 2: Se autonomia bloqueou → decidir ──
  if (!autonomy_valid) {
    // Verificar se é "requires_human_ok" → needs_human_review
    const classification = classifyAction(context.action);
    const isHumanRequired = classification.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN;
    const isProhibited = classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED;

    if (isProhibited) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.BLOCK,
        reason_code: REASON_CODE.ACTION_PROHIBITED,
        reason_text: constitutionCheck.reason,
        risk_level: RISK_LEVEL.HIGH,
        requires_human_approval: false,
        scope_valid,
        autonomy_valid: false,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null,
      });
    }

    if (isHumanRequired) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.NEEDS_HUMAN_REVIEW,
        reason_code: REASON_CODE.HUMAN_APPROVAL_REQUIRED,
        reason_text: constitutionCheck.reason,
        risk_level,
        requires_human_approval: true,
        scope_valid,
        autonomy_valid: false,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null,
      });
    }

    // Gates failed or environment blocked
    const hasGateFailure = constitutionCheck.gates && !constitutionCheck.gates.all_gates_passed;
    const reasonCode = hasGateFailure ? REASON_CODE.GATES_FAILED : REASON_CODE.AUTONOMY_BLOCKED;

    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: reasonCode,
      reason_text: constitutionCheck.reason,
      risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null,
    });
  }

  // ── STEP 3: Verificar braço (se arm_check_result fornecido) ──
  if (context.arm_check_result && context.arm_check_result.allowed === false) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.ARM_ENFORCEMENT_BLOCKED,
      reason_text: context.arm_check_result.reason || "Braço especialista bloqueou a ação.",
      risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result,
    });
  }

  // ── STEP 4: Verificar evidência ──
  if (!evidence_sufficient) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.INSUFFICIENT_EVIDENCE,
      reason_text: "Evidência insuficiente para prosseguir com a ação.",
      risk_level: risk_level === RISK_LEVEL.LOW ? RISK_LEVEL.MEDIUM : risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient: false,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null,
    });
  }

  // ── STEP 5: Verificar risco alto ──
  if (risk_level === RISK_LEVEL.HIGH) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.HIGH_RISK_DETECTED,
      reason_text: "Risco alto detectado — ação bloqueada até autorização humana.",
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null,
    });
  }

  // ── STEP 6: Verificar política de falha (se attempt fornecido) ──
  if (typeof context.attempt === "number") {
    const failurePolicy = evaluateFailurePolicy({
      attempt: context.attempt,
      is_high_risk: risk_level === RISK_LEVEL.HIGH,
      has_sufficient_evidence: evidence_sufficient,
    });

    if (!failurePolicy.can_continue) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.BLOCK,
        reason_code: REASON_CODE.HIGH_RISK_DETECTED,
        reason_text: failurePolicy.reason,
        risk_level: RISK_LEVEL.HIGH,
        requires_human_approval: true,
        scope_valid,
        autonomy_valid,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null,
      });
    }
  }

  // ── STEP 7: Verificar ambiente duvidoso (PROD sem evidência) ──
  if (context.environment === ENVIRONMENT.PROD) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.NEEDS_HUMAN_REVIEW,
      reason_code: REASON_CODE.ENVIRONMENT_UNSAFE,
      reason_text: "Ambiente PROD requer revisão humana antes de prosseguir.",
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null,
    });
  }

  // ── TUDO PASSOU → ação permitida ──
  return _buildDecision({
    allowed: true,
    decision: DECISION.ALLOW,
    reason_code: REASON_CODE.ACTION_ALLOWED,
    reason_text: `Ação '${context.action}' permitida — autonomia OK, escopo OK, gates OK, evidência OK.`,
    risk_level,
    requires_human_approval: false,
    scope_valid,
    autonomy_valid,
    evidence_sufficient,
    constitution_check: constitutionCheck,
    arm_check: context.arm_check_result || null,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core function
  evaluateSensitiveAction,

  // Enums
  DECISION,
  RISK_LEVEL,
  REASON_CODE,
};
