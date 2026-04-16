// ============================================================================
// 🎯 ENAVIA — Contract Cognitive Orchestrator (PR6)
//
// Orquestração canônica: gate contratual (PR3) + camada cognitiva (PR5).
// Combina o resultado do gate de aderência com a interpretação cognitiva
// para produzir uma decisão operacional final previsível e auditável.
//
// HIERARQUIA OBRIGATÓRIA:
//   1. Gate contratual (PR3) — autoridade primária, nunca anulada
//   2. Cognição consultiva (PR5) — apoio interpretativo, nunca soberana
//   3. Confirmação humana — quando necessário por ambiguidade ou risco
//
// REGRAS DURAS:
//   - gate BLOCK → decisão final NUNCA vira EXECUTE
//   - gate exige aprovação humana → decisão final respeita
//   - cognição ambígua/baixa confiança → decisão reflete isso
//   - cognição NUNCA anula bloqueio do gate
//   - sem contrato ativo → NO_CONTRACT
//
// Escopo: WORKER-ONLY. Não misturar com painel, workflows ou frentes paralelas.
// ============================================================================

import {
  runContractAdherenceGate,
  evaluateContractAdherence,
  DECISION,
  REASON_CODE,
} from "./contract-adherence-engine.js";

import {
  analyzeContractContextCognitively,
  runContractCognitiveAdvisor,
  AMBIGUITY_LEVEL,
  CONFIDENCE_THRESHOLDS,
} from "./contract-cognitive-advisor.js";

// ---------------------------------------------------------------------------
// FINAL_DECISION — enum canônico da decisão operacional final
// ---------------------------------------------------------------------------
const FINAL_DECISION = {
  BLOCK:            "BLOCK",
  EXECUTE_READY:    "EXECUTE_READY",
  HUMAN_CONFIRM:    "HUMAN_CONFIRM",
  CAUTION_READY:    "CAUTION_READY",
  NO_CONTRACT:      "NO_CONTRACT",
  INSUFFICIENT_BASIS: "INSUFFICIENT_BASIS",
};

// ---------------------------------------------------------------------------
// EXECUTION_MODE — modo de execução resultante
// ---------------------------------------------------------------------------
const EXECUTION_MODE = {
  BLOCKED:          "BLOCKED",
  AUTO:             "AUTO",
  SUPERVISED:       "SUPERVISED",
  MANUAL:           "MANUAL",
  UNAVAILABLE:      "UNAVAILABLE",
};

// ---------------------------------------------------------------------------
// Confidence threshold for "sufficient" — below this, basis is considered weak
// ---------------------------------------------------------------------------
const SUFFICIENT_CONFIDENCE = CONFIDENCE_THRESHOLDS.MEDIUM; // 0.5

// ---------------------------------------------------------------------------
// _isNoContract(gateResult)
//
// Checks whether the gate result indicates no active contract.
// ---------------------------------------------------------------------------
function _isNoContract(gateResult) {
  if (!gateResult) return true;
  const rc = gateResult.reason_code || "";
  return (
    rc === REASON_CODE.ERROR_NO_CONTRACT ||
    rc === REASON_CODE.BLOCK_NO_CONTRACT
  );
}

// ---------------------------------------------------------------------------
// _isGateBlock(gateResult)
//
// Checks whether the gate decision is BLOCK.
// ---------------------------------------------------------------------------
function _isGateBlock(gateResult) {
  return gateResult && gateResult.decision === DECISION.BLOCK;
}

// ---------------------------------------------------------------------------
// _isGateWarn(gateResult)
//
// Checks whether the gate decision is WARN.
// ---------------------------------------------------------------------------
function _isGateWarn(gateResult) {
  return gateResult && gateResult.decision === DECISION.WARN;
}

// ---------------------------------------------------------------------------
// _isGateAllow(gateResult)
//
// Checks whether the gate decision is ALLOW.
// ---------------------------------------------------------------------------
function _isGateAllow(gateResult) {
  return gateResult && gateResult.decision === DECISION.ALLOW;
}

// ---------------------------------------------------------------------------
// _isCognitionAmbiguous(cognitiveResult)
//
// Checks whether cognition reports medium or higher ambiguity.
// ---------------------------------------------------------------------------
function _isCognitionAmbiguous(cognitiveResult) {
  if (!cognitiveResult) return true;
  const level = cognitiveResult.ambiguity_level || AMBIGUITY_LEVEL.HIGH;
  return level === AMBIGUITY_LEVEL.MEDIUM ||
         level === AMBIGUITY_LEVEL.HIGH ||
         level === AMBIGUITY_LEVEL.CRITICAL;
}

// ---------------------------------------------------------------------------
// _isCognitionLowConfidence(cognitiveResult)
//
// Checks whether cognition confidence is below the sufficient threshold.
// ---------------------------------------------------------------------------
function _isCognitionLowConfidence(cognitiveResult) {
  if (!cognitiveResult) return true;
  const conf = typeof cognitiveResult.confidence === "number"
    ? cognitiveResult.confidence
    : 0;
  return conf < SUFFICIENT_CONFIDENCE;
}

// ---------------------------------------------------------------------------
// _resolveDecision(gateResult, cognitiveResult)
//
// Decision table — deterministic, auditable.
//
// Gate                              | Cognition                      | Final Decision
// ----------------------------------|--------------------------------|---------------------------
// null/missing                      | *                              | NO_CONTRACT
// NO_CONTRACT                       | *                              | NO_CONTRACT
// BLOCK                             | *                              | BLOCK (sovereign)
// requires_human_approval = true    | *                              | HUMAN_CONFIRM (sovereign)
// ALLOW                             | low ambiguity + sufficient conf| EXECUTE_READY
// ALLOW                             | medium/high ambiguity          | HUMAN_CONFIRM
// ALLOW                             | low confidence (weak basis)    | INSUFFICIENT_BASIS
// WARN                              | low ambiguity + sufficient conf| CAUTION_READY
// WARN                              | ambiguous or low confidence    | HUMAN_CONFIRM
// ---------------------------------------------------------------------------
function _resolveDecision(gateResult, cognitiveResult) {
  // 1. No contract
  if (!gateResult || _isNoContract(gateResult)) {
    return {
      final_decision: FINAL_DECISION.NO_CONTRACT,
      final_reason_code: "NO_ACTIVE_CONTRACT",
      final_reason_text: "Sem contrato ativo — não é possível produzir decisão operacional.",
      execution_mode: EXECUTION_MODE.UNAVAILABLE,
      requires_human_confirmation: true,
      rule_applied: "no_contract",
    };
  }

  // 2. Gate BLOCK — never overridden
  if (_isGateBlock(gateResult)) {
    return {
      final_decision: FINAL_DECISION.BLOCK,
      final_reason_code: gateResult.reason_code || "GATE_BLOCK",
      final_reason_text: gateResult.reason_text || "Ação bloqueada pelo gate contratual.",
      execution_mode: EXECUTION_MODE.BLOCKED,
      requires_human_confirmation: gateResult.requires_human_approval || false,
      rule_applied: "gate_block_sovereign",
    };
  }

  // 3. Gate requires human approval — sovereign even when decision is ALLOW/WARN
  //    Prevents EXECUTE_READY from being returned when the gate itself demands
  //    a human sign-off (e.g., deploy/promote actions per contract approval points).
  if (gateResult.requires_human_approval === true) {
    return {
      final_decision: FINAL_DECISION.HUMAN_CONFIRM,
      final_reason_code: "GATE_REQUIRES_HUMAN_APPROVAL",
      final_reason_text: "Gate contratual exige aprovação humana — execução autônoma não permitida.",
      execution_mode: EXECUTION_MODE.SUPERVISED,
      requires_human_confirmation: true,
      rule_applied: "gate_requires_human_approval_sovereign",
    };
  }

  // 4. Gate ALLOW
  if (_isGateAllow(gateResult)) {
    // Low confidence / weak basis → INSUFFICIENT_BASIS
    if (_isCognitionLowConfidence(cognitiveResult)) {
      return {
        final_decision: FINAL_DECISION.INSUFFICIENT_BASIS,
        final_reason_code: "COGNITIVE_LOW_CONFIDENCE",
        final_reason_text: "Base contratual insuficiente para confirmar execução — confiança cognitiva baixa.",
        execution_mode: EXECUTION_MODE.MANUAL,
        requires_human_confirmation: true,
        rule_applied: "allow_low_confidence",
      };
    }

    // Ambiguous cognition → HUMAN_CONFIRM
    if (_isCognitionAmbiguous(cognitiveResult)) {
      return {
        final_decision: FINAL_DECISION.HUMAN_CONFIRM,
        final_reason_code: "COGNITIVE_AMBIGUOUS",
        final_reason_text: "Gate permite, mas cognição detectou ambiguidade — confirmação humana recomendada.",
        execution_mode: EXECUTION_MODE.SUPERVISED,
        requires_human_confirmation: true,
        rule_applied: "allow_ambiguous_cognition",
      };
    }

    // Clear cognition + sufficient confidence → EXECUTE_READY
    return {
      final_decision: FINAL_DECISION.EXECUTE_READY,
      final_reason_code: "GATE_ALLOW_COGNITION_CLEAR",
      final_reason_text: "Gate permite e cognição clara — ação pronta para execução.",
      execution_mode: EXECUTION_MODE.AUTO,
      requires_human_confirmation: false,
      rule_applied: "allow_clear_cognition",
    };
  }

  // 5. Gate WARN
  if (_isGateWarn(gateResult)) {
    // Low confidence → HUMAN_CONFIRM
    if (_isCognitionLowConfidence(cognitiveResult)) {
      return {
        final_decision: FINAL_DECISION.HUMAN_CONFIRM,
        final_reason_code: "WARN_LOW_CONFIDENCE",
        final_reason_text: "Gate emitiu alerta e confiança cognitiva é baixa — confirmação humana necessária.",
        execution_mode: EXECUTION_MODE.MANUAL,
        requires_human_confirmation: true,
        rule_applied: "warn_low_confidence",
      };
    }

    // Ambiguous cognition → HUMAN_CONFIRM
    if (_isCognitionAmbiguous(cognitiveResult)) {
      return {
        final_decision: FINAL_DECISION.HUMAN_CONFIRM,
        final_reason_code: "WARN_AMBIGUOUS",
        final_reason_text: "Gate emitiu alerta e cognição detectou ambiguidade — confirmação humana necessária.",
        execution_mode: EXECUTION_MODE.SUPERVISED,
        requires_human_confirmation: true,
        rule_applied: "warn_ambiguous_cognition",
      };
    }

    // WARN + clear cognition + sufficient confidence → CAUTION_READY
    return {
      final_decision: FINAL_DECISION.CAUTION_READY,
      final_reason_code: "WARN_COGNITION_CLEAR",
      final_reason_text: "Gate emitiu alerta, mas cognição está clara e com boa confiança — prosseguir com cautela.",
      execution_mode: EXECUTION_MODE.SUPERVISED,
      requires_human_confirmation: false,
      rule_applied: "warn_clear_cognition",
    };
  }

  // 6. Fallback (unexpected gate state) — safe default
  return {
    final_decision: FINAL_DECISION.HUMAN_CONFIRM,
    final_reason_code: "UNKNOWN_GATE_STATE",
    final_reason_text: "Estado do gate não reconhecido — confirmação humana exigida por segurança.",
    execution_mode: EXECUTION_MODE.MANUAL,
    requires_human_confirmation: true,
    rule_applied: "fallback_unknown",
  };
}

// ---------------------------------------------------------------------------
// _buildSupportingEvidence(gateResult, cognitiveResult)
//
// Consolidates evidence from gate + cognition into an auditable array.
// ---------------------------------------------------------------------------
function _buildSupportingEvidence(gateResult, cognitiveResult) {
  const evidence = [];

  if (gateResult) {
    evidence.push({
      source: "gate_pr3",
      decision: gateResult.decision || null,
      reason_code: gateResult.reason_code || null,
      reason_text: gateResult.reason_text || null,
      violations_count: Array.isArray(gateResult.violations) ? gateResult.violations.length : 0,
      matched_rules_count: Array.isArray(gateResult.matched_rules) ? gateResult.matched_rules.length : 0,
      requires_human_approval: gateResult.requires_human_approval || false,
      contract_id: gateResult.contract_id || null,
    });
  }

  if (cognitiveResult) {
    evidence.push({
      source: "cognitive_pr5",
      ok: cognitiveResult.ok || false,
      ambiguity_level: cognitiveResult.ambiguity_level || null,
      confidence: typeof cognitiveResult.confidence === "number" ? cognitiveResult.confidence : null,
      perceived_conflicts_count: Array.isArray(cognitiveResult.perceived_conflicts) ? cognitiveResult.perceived_conflicts.length : 0,
      requires_human_confirmation: cognitiveResult.requires_human_confirmation || false,
      suggested_action: cognitiveResult.suggested_action || null,
      suggested_next_step: cognitiveResult.suggested_next_step || null,
    });
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// orchestrateContractAwareAction({ gateResult, cognitiveResult, candidateAction, scope })
//
// Core pure orchestration function.
// Combines gate (PR3) + cognition (PR5) into a final operational decision.
//
// Parameters:
//   gateResult       {object} — output from evaluateContractAdherence / runContractAdherenceGate
//   cognitiveResult  {object} — output from analyzeContractContextCognitively / runContractCognitiveAdvisor
//   candidateAction  {object} — the candidate action being evaluated
//   scope            {string} — execution scope
//
// Returns: {
//   ok,
//   final_decision,
//   final_reason_code,
//   final_reason_text,
//   execution_mode,
//   requires_human_confirmation,
//   gate_decision,
//   cognitive_confidence,
//   cognitive_ambiguity,
//   recommended_next_step,
//   supporting_evidence,
//   notes,
// }
// ---------------------------------------------------------------------------
function orchestrateContractAwareAction({ gateResult, cognitiveResult, candidateAction, scope } = {}) {
  const effectiveScope = scope || "default";
  const now = new Date().toISOString();

  // Resolve the decision using the decision table
  const decision = _resolveDecision(gateResult, cognitiveResult);

  // Build consolidated evidence
  const supportingEvidence = _buildSupportingEvidence(gateResult, cognitiveResult);

  // Build notes
  const notes = [];

  if (gateResult) {
    if (Array.isArray(gateResult.notes)) {
      for (const n of gateResult.notes) {
        notes.push(`[gate] ${n}`);
      }
    }
  }

  if (cognitiveResult) {
    if (Array.isArray(cognitiveResult.notes)) {
      for (const n of cognitiveResult.notes) {
        notes.push(`[cognitive] ${n}`);
      }
    }
  }

  notes.push(`[orchestrator] rule_applied: ${decision.rule_applied}`);
  notes.push(`[orchestrator] scope: ${effectiveScope}`);
  notes.push(`[orchestrator] evaluated_at: ${now}`);

  // Recommended next step: prefer cognitive suggestion, fallback to gate reason
  let recommendedNextStep = "Aguardar decisão humana.";
  if (cognitiveResult && cognitiveResult.suggested_next_step) {
    recommendedNextStep = cognitiveResult.suggested_next_step;
  } else if (gateResult && gateResult.reason_text) {
    recommendedNextStep = gateResult.reason_text;
  }

  return {
    ok: decision.final_decision !== FINAL_DECISION.BLOCK &&
        decision.final_decision !== FINAL_DECISION.NO_CONTRACT,
    final_decision: decision.final_decision,
    final_reason_code: decision.final_reason_code,
    final_reason_text: decision.final_reason_text,
    execution_mode: decision.execution_mode,
    requires_human_confirmation: decision.requires_human_confirmation,
    gate_decision: gateResult ? gateResult.decision : null,
    cognitive_confidence: cognitiveResult && typeof cognitiveResult.confidence === "number"
      ? cognitiveResult.confidence
      : null,
    cognitive_ambiguity: cognitiveResult
      ? cognitiveResult.ambiguity_level || null
      : null,
    recommended_next_step: recommendedNextStep,
    supporting_evidence: supportingEvidence,
    notes,
  };
}

// ---------------------------------------------------------------------------
// runContractAwareDecision(env, scope, candidateAction)
//
// Runtime helper: full orchestration pipeline.
// 1. Runs gate (PR3) via runContractAdherenceGate
// 2. Runs cognitive advisor (PR5) via runContractCognitiveAdvisor
//    (passes gate result to cognitive layer for context)
// 3. Orchestrates final decision via orchestrateContractAwareAction
//
// Parameters:
//   env             {object} — Cloudflare Workers env (must have ENAVIA_BRAIN KV binding)
//   scope           {string} — execution scope
//   candidateAction {object} — { intent, phase, task_id, action_type, target }
//
// Returns: orchestrated final decision (same shape as orchestrateContractAwareAction)
// ---------------------------------------------------------------------------
async function runContractAwareDecision(env, scope, candidateAction) {
  const effectiveScope = scope || "default";

  // Step 1: Gate (PR3)
  const gateResult = await runContractAdherenceGate(env, effectiveScope, candidateAction);

  // Step 2: Cognitive advisor (PR5) — passes gate result for context awareness
  const cognitiveResult = await runContractCognitiveAdvisor(
    env,
    effectiveScope,
    candidateAction,
    { adherenceResult: gateResult }
  );

  // Step 3: Orchestrate final decision
  return orchestrateContractAwareAction({
    gateResult,
    cognitiveResult,
    candidateAction,
    scope: effectiveScope,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core orchestration (pure function)
  orchestrateContractAwareAction,

  // Runtime helper (async, uses PR2 + PR3 + PR5)
  runContractAwareDecision,

  // Enums
  FINAL_DECISION,
  EXECUTION_MODE,
};
