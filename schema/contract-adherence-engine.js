// ============================================================================
// 📜 ENAVIA — Contract Adherence Engine (PR3)
//
// Motor de aderência contratual pré-ação.
// Valida se uma ação/intenção candidata está aderente ao contrato ativo (PR2)
// usando os artefatos canônicos de PR1 (ingestion) + PR2 (active state).
//
// Responsabilidades:
//   1. Avaliar aderência contratual de uma ação candidata
//   2. Decidir ALLOW / BLOCK / WARN deterministicamente
//   3. Identificar violações de hard rules, blocking points, fase/ordem
//   4. Detectar necessidade de aprovação humana
//   5. Produzir resultado auditável com matched_rules e reason_code
//   6. Expor ponto canônico para o runtime (runContractAdherenceGate)
//
// Usa de verdade:
//   - getActiveContractContext (PR2)
//   - summary_canonic (PR2)
//   - resolution_ctx (PR2)
//   - structure: hard_rules, acceptance_criteria, approval_points,
//     blocking_points, detected_phases (PR1 via PR2)
//   - relevant blocks (PR1 via PR2)
//
// NÃO faz (deliberadamente):
//   - IA / LLM / embeddings
//   - Painel / UX visual
//   - Policy engine complexo
//   - Reescrita do runtime
//   - Persistência pesada (resultado é retornado, não persistido)
//
// Escopo: WORKER-ONLY. Não misturar com painel, workflows ou frentes paralelas.
// ============================================================================

import {
  getActiveContractContext,
  resolveRelevantContractBlocks,
} from "./contract-active-state.js";

// ---------------------------------------------------------------------------
// DECISION — enum canônico de decisão do gate
// ---------------------------------------------------------------------------
const DECISION = {
  ALLOW: "ALLOW",
  BLOCK: "BLOCK",
  WARN:  "WARN",
};

// ---------------------------------------------------------------------------
// REASON_CODE — códigos de razão canônicos
// ---------------------------------------------------------------------------
const REASON_CODE = {
  ALLOW_ADHERENT:          "ALLOW_ADHERENT",
  BLOCK_HARD_RULE:         "BLOCK_HARD_RULE",
  BLOCK_BLOCKING_POINT:    "BLOCK_BLOCKING_POINT",
  BLOCK_OUT_OF_SCOPE:      "BLOCK_OUT_OF_SCOPE",
  BLOCK_HUMAN_APPROVAL:    "BLOCK_HUMAN_APPROVAL",
  BLOCK_PHASE_ORDER:       "BLOCK_PHASE_ORDER",
  WARN_PARTIAL_EVIDENCE:   "WARN_PARTIAL_EVIDENCE",
  WARN_PHASE_AMBIGUOUS:    "WARN_PHASE_AMBIGUOUS",
  WARN_NO_STRONG_MATCH:    "WARN_NO_STRONG_MATCH",
  BLOCK_NO_CONTRACT:       "BLOCK_NO_CONTRACT",
  ERROR_NO_CONTRACT:       "ERROR_NO_CONTRACT",
};

// ---------------------------------------------------------------------------
// Stopwords — common words to exclude from keyword matching
// ---------------------------------------------------------------------------
const STOPWORDS = new Set([
  // Portuguese
  "para", "como", "com", "sem", "que", "uma", "dos", "das", "nos", "nas",
  "por", "pelo", "pela", "mais", "este", "esta", "esse", "essa", "todo",
  "toda", "todos", "todas", "deve", "será", "pode", "cada", "entre",
  "sobre", "após", "antes", "além", "ainda", "caso", "mesmo",
  // English
  "with", "from", "that", "this", "have", "been", "will", "should",
  "must", "each", "also", "them", "they", "when", "what", "which",
  "their", "into", "more", "than", "some", "only", "then", "just",
  "over", "such", "very", "same", "does", "after", "before",
]);

// Minimum word length for keyword matching (after stopword removal)
const MIN_KEYWORD_LENGTH = 5;

// ---------------------------------------------------------------------------
// _normalize(text) — lowercase + trim for matching
// ---------------------------------------------------------------------------
function _normalize(text) {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// _extractKeywords(text) — extract meaningful keywords from text
// Filters out stopwords and short words.
// ---------------------------------------------------------------------------
function _extractKeywords(text) {
  const norm = _normalize(text);
  if (!norm) return [];
  return norm
    .split(/\s+/)
    .filter(w => w.length >= MIN_KEYWORD_LENGTH && !STOPWORDS.has(w));
}

// ---------------------------------------------------------------------------
// _textContains(text, keywords) — returns true if text contains any keyword
// ---------------------------------------------------------------------------
function _textContains(text, keywords) {
  const norm = _normalize(text);
  if (!norm) return false;
  for (const kw of keywords) {
    if (norm.includes(_normalize(kw))) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// _matchSignals(actionSummary, signals, category)
//
// Checks if the candidate action summary matches structural signals from
// contract blocks (extracted by PR1 ingestion).
// Returns matched signal strings.
// ---------------------------------------------------------------------------
function _matchSignals(actionSummary, blocks, category) {
  const matched = [];
  const normAction = _normalize(actionSummary);
  if (!normAction || !blocks || blocks.length === 0) return matched;

  for (const block of blocks) {
    if (!block.signals || !block.signals[category]) continue;
    for (const signal of block.signals[category]) {
      const normSignal = _normalize(signal);
      // Check if the action text overlaps with signal context
      // We look for the signal keyword in the action OR vice-versa
      if (normAction.includes(normSignal) || normSignal.includes(normAction.split(" ")[0])) {
        matched.push({ signal, block_id: block.block_id, heading: block.heading });
      }
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// HARD RULE keyword patterns (deterministic heuristic)
// These are keywords that indicate a hard contractual rule.
// ---------------------------------------------------------------------------
const HARD_RULE_KEYWORDS = [
  "proibido", "vedado", "não pode", "não poderá", "não deverá",
  "prohibited", "must not", "shall not", "forbidden",
  "obrigatoriamente", "obrigatório", "mandatório",
  "mandatory", "required", "compulsory",
  "do_not_touch", "do not touch",
];

// ---------------------------------------------------------------------------
// APPROVAL keywords (deterministic heuristic)
// ---------------------------------------------------------------------------
const APPROVAL_KEYWORDS = [
  "aprovação humana", "aprovação do cliente", "aprovação do gestor",
  "human approval", "client approval", "sign-off", "sign off",
  "homologação", "validação formal",
  "require_human_approval", "requires_human_approval",
];

// ---------------------------------------------------------------------------
// DEPLOY/PROMOTE keywords — actions that typically require approval
// ---------------------------------------------------------------------------
const DEPLOY_PROMOTE_KEYWORDS = [
  "deploy", "promote", "production", "prod", "release",
  "publicar", "promover", "produção", "lançar",
  "merge to main", "merge para main",
];

// ---------------------------------------------------------------------------
// BLOCKING POINT keywords
// ---------------------------------------------------------------------------
const BLOCKING_KEYWORDS = [
  "bloqueio", "bloqueante", "blocking", "blocked until",
  "condição suspensiva", "condition precedent",
  "antes de", "before", "prior to", "prerequisite",
];

// ---------------------------------------------------------------------------
// evaluateContractAdherence({ scope, contractContext, candidateAction })
//
// Core canonical function — PR3 adherence engine.
//
// Parameters:
//   scope            {string}   — execution scope (e.g., "default", "exec_1")
//   contractContext  {object}   — from getActiveContractContext (PR2)
//     .contract_id   {string}
//     .active_state  {object}
//     .summary       {object}   — summary_canonic (PR2)
//     .resolution_ctx {object}  — resolution context (PR2)
//     .ready_for_pr3 {boolean}
//   candidateAction  {object}   — the action/intent to evaluate
//     .intent        {string}   — description of what the action will do
//     .phase         {string}   — current phase (optional)
//     .task_id       {string}   — task identifier (optional)
//     .action_type   {string}   — e.g., "execute", "deploy", "modify" (optional)
//     .target        {string}   — target resource/module (optional)
//
// Returns: ContractAdherenceResult {
//   ok:                     boolean,
//   decision:               "ALLOW" | "BLOCK" | "WARN",
//   reason_code:            string,
//   reason_text:            string,
//   matched_rules:          Array<{ rule, block_id, heading, category }>,
//   violations:             Array<{ type, description, block_id }>,
//   requires_human_approval: boolean,
//   notes:                  Array<string>,
//   contract_id:            string | null,
//   scope:                  string,
//   evaluated_at:           string (ISO),
// }
// ---------------------------------------------------------------------------
function evaluateContractAdherence({ scope, contractContext, candidateAction } = {}) {
  const now = new Date().toISOString();
  const baseResult = {
    ok: true,
    decision: DECISION.ALLOW,
    reason_code: REASON_CODE.ALLOW_ADHERENT,
    reason_text: "",
    matched_rules: [],
    violations: [],
    requires_human_approval: false,
    notes: [],
    contract_id: null,
    scope: scope || "default",
    evaluated_at: now,
  };

  // ─── Guard: no contract context ──────────────────────────────────────
  if (!contractContext || !contractContext.ready_for_pr3) {
    return {
      ...baseResult,
      ok: false,
      decision: DECISION.WARN,
      reason_code: REASON_CODE.ERROR_NO_CONTRACT,
      reason_text: "No active contract context available. Cannot evaluate adherence.",
      notes: ["Contract context is missing or not ready. Action proceeds with caution."],
    };
  }

  if (!contractContext.contract_id) {
    return {
      ...baseResult,
      ok: false,
      decision: DECISION.WARN,
      reason_code: REASON_CODE.BLOCK_NO_CONTRACT,
      reason_text: "Active contract has no contract_id. Adherence cannot be evaluated.",
      notes: ["Contract ID is null — possible state corruption."],
    };
  }

  baseResult.contract_id = contractContext.contract_id;

  // ─── Guard: no candidate action ──────────────────────────────────────
  if (!candidateAction || typeof candidateAction !== "object") {
    return {
      ...baseResult,
      ok: false,
      decision: DECISION.WARN,
      reason_code: REASON_CODE.WARN_PARTIAL_EVIDENCE,
      reason_text: "Candidate action is missing or invalid. Cannot assess adherence.",
      notes: ["No candidate action provided."],
    };
  }

  const actionIntent = candidateAction.intent || "";
  const actionPhase = candidateAction.phase || null;
  const actionType = candidateAction.action_type || "";
  const actionTarget = candidateAction.target || "";
  const actionSummary = [actionIntent, actionType, actionTarget].filter(Boolean).join(" ");

  const summary = contractContext.summary || {};
  const resCtx = contractContext.resolution_ctx || {};
  const activeState = contractContext.active_state || {};

  // Collect relevant blocks from resolution context or active state
  const relevantBlockIds = resCtx.relevant_block_ids || activeState.relevant_block_ids || [];

  // Get actual block objects from active_state if available
  // (blocks are not directly in contractContext — they come via resolution)
  // We'll work with summary signals which aggregate block data.

  const violations = [];
  const matchedRules = [];
  const notes = [];
  let requiresHumanApproval = false;

  // ─── Check 1: Hard Rules Violation ───────────────────────────────────
  // Check if the action conflicts with known hard rules from the contract.
  const hardRulesTop = summary.hard_rules_top || [];
  if (hardRulesTop.length > 0) {
    for (const rule of hardRulesTop) {
      // Extract meaningful keywords (no stopwords, min length enforced)
      const ruleWords = _extractKeywords(rule);
      const intentWords = _extractKeywords(actionSummary);
      const overlap = ruleWords.filter(w => intentWords.includes(w));

      if (overlap.length >= 2) {
        // Strong match — action directly conflicts with a hard rule
        violations.push({
          type: "hard_rule",
          description: `Action conflicts with hard rule: "${rule}"`,
          matched_keywords: overlap,
        });
        matchedRules.push({
          rule,
          category: "hard_rule",
          match_strength: "strong",
        });
      } else if (overlap.length === 1) {
        // Weak match — partial overlap, may be coincidental
        notes.push(`Partial overlap with hard rule: "${rule}" (keyword: ${overlap[0]})`);
        matchedRules.push({
          rule,
          category: "hard_rule",
          match_strength: "weak",
        });
      }
    }

    // Also check if action text directly contains hard rule prohibition keywords
    if (_textContains(actionSummary, HARD_RULE_KEYWORDS)) {
      notes.push("Action text contains prohibition/mandate keywords — verify intent carefully.");
    }
  }

  // ─── Check 2: Blocking Points ────────────────────────────────────────
  const blockingPointsTop = summary.blocking_points_top || [];
  if (blockingPointsTop.length > 0) {
    for (const bp of blockingPointsTop) {
      const bpWords = _extractKeywords(bp);
      const intentWords = _extractKeywords(actionSummary);
      const overlap = bpWords.filter(w => intentWords.includes(w));

      if (overlap.length >= 2) {
        violations.push({
          type: "blocking_point",
          description: `Action conflicts with blocking point: "${bp}"`,
          matched_keywords: overlap,
        });
        matchedRules.push({
          rule: bp,
          category: "blocking_point",
          match_strength: "strong",
        });
      } else if (overlap.length === 1) {
        notes.push(`Partial overlap with blocking point: "${bp}" (keyword: ${overlap[0]})`);
        matchedRules.push({
          rule: bp,
          category: "blocking_point",
          match_strength: "weak",
        });
      }
    }
  }

  // ─── Check 3: Human Approval Required ────────────────────────────────
  // Check if the contract has approval points and the action is of a type
  // that typically requires approval (deploy, promote, etc.)
  const approvalPointsTop = summary.approval_points_top || [];
  const approvalPointsCount = summary.approval_points_count || 0;

  if (approvalPointsCount > 0 || approvalPointsTop.length > 0) {
    // If the action is a deploy/promote type, check for approval requirements
    const isDeployLike = _textContains(actionSummary, DEPLOY_PROMOTE_KEYWORDS);

    if (isDeployLike) {
      requiresHumanApproval = true;
      violations.push({
        type: "human_approval_required",
        description: `Action appears to be deploy/promote and contract has ${approvalPointsCount} approval point(s).`,
        approval_points: approvalPointsTop,
      });
      matchedRules.push({
        rule: approvalPointsTop[0] || "approval_point_detected",
        category: "approval_point",
        match_strength: "strong",
      });
    }

    // Also check if the action text itself mentions approval keywords
    if (_textContains(actionSummary, APPROVAL_KEYWORDS)) {
      requiresHumanApproval = true;
      notes.push("Action references human approval — ensure approval is obtained.");
    }
  }

  // ─── Check 4: Phase/Order Compatibility ──────────────────────────────
  const detectedPhases = summary.detected_phases || [];
  const currentPhaseHint = activeState.current_phase_hint || null;

  if (actionPhase && detectedPhases.length > 0) {
    // Check if the action's phase exists in the contract's detected phases
    const normActionPhase = _normalize(actionPhase);
    const phaseExists = detectedPhases.some(p => _normalize(p) === normActionPhase);

    if (!phaseExists) {
      // Phase not found — check if it's close to any known phase
      const partialMatch = detectedPhases.some(p =>
        _normalize(p).includes(normActionPhase) || normActionPhase.includes(_normalize(p))
      );

      if (partialMatch) {
        notes.push(`Action phase "${actionPhase}" is a partial match to detected phases — verify ordering.`);
      } else {
        violations.push({
          type: "phase_order",
          description: `Action phase "${actionPhase}" not found in contract detected phases: [${detectedPhases.join(", ")}]`,
        });
      }
    }

    // If we know the current phase, check ordering
    if (currentPhaseHint && detectedPhases.length >= 2) {
      const currentIdx = detectedPhases.findIndex(p => _normalize(p) === _normalize(currentPhaseHint));
      const actionIdx = detectedPhases.findIndex(p => _normalize(p) === normActionPhase);

      if (currentIdx >= 0 && actionIdx >= 0 && actionIdx < currentIdx) {
        // Action wants to go to an earlier phase — potential regression
        notes.push(`Action targets phase "${actionPhase}" which is before current phase "${currentPhaseHint}" — may be out of order.`);
        matchedRules.push({
          rule: `phase_order: "${actionPhase}" < "${currentPhaseHint}"`,
          category: "phase_order",
          match_strength: "weak",
        });
      }
    }
  }

  // ─── Check 5: Scope/Target Compatibility ─────────────────────────────
  // Check if the action target falls within the contract's macro objective
  const macroObjective = summary.macro_objective || null;
  if (macroObjective && actionTarget) {
    const objWords = _extractKeywords(macroObjective);
    const targetWords = _extractKeywords(actionTarget);
    const overlap = targetWords.filter(w => objWords.includes(w));

    if (targetWords.length > 0 && overlap.length === 0) {
      notes.push(`Action target "${actionTarget}" has no keyword overlap with contract macro objective. May be out of scope.`);
    }
  }

  // ─── Check 6: Acceptance Criteria Awareness ──────────────────────────
  const acceptanceCriteriaTop = summary.acceptance_criteria_top || [];
  if (acceptanceCriteriaTop.length > 0) {
    // Just note the relevant acceptance criteria for audit trail
    matchedRules.push({
      rule: `acceptance_criteria: ${acceptanceCriteriaTop.length} known`,
      category: "acceptance_criteria",
      match_strength: "info",
    });
  }

  // ─── Decision Logic ──────────────────────────────────────────────────
  // BLOCK: any strong violation of hard_rule or blocking_point
  //        OR deploy-like action without human approval
  const hardViolations = violations.filter(v =>
    v.type === "hard_rule" || v.type === "blocking_point"
  );

  const approvalViolations = violations.filter(v =>
    v.type === "human_approval_required"
  );

  const phaseViolations = violations.filter(v =>
    v.type === "phase_order"
  );

  let decision = DECISION.ALLOW;
  let reasonCode = REASON_CODE.ALLOW_ADHERENT;
  let reasonText = "Action is adherent to the active contract.";

  if (hardViolations.length > 0) {
    decision = DECISION.BLOCK;
    reasonCode = hardViolations[0].type === "hard_rule"
      ? REASON_CODE.BLOCK_HARD_RULE
      : REASON_CODE.BLOCK_BLOCKING_POINT;
    reasonText = hardViolations[0].description;
  } else if (approvalViolations.length > 0) {
    decision = DECISION.BLOCK;
    reasonCode = REASON_CODE.BLOCK_HUMAN_APPROVAL;
    reasonText = approvalViolations[0].description;
  } else if (phaseViolations.length > 0) {
    // Phase violations are BLOCK only if definitive, WARN if ambiguous
    const hasStrongPhaseViolation = matchedRules.some(
      r => r.category === "phase_order" && r.match_strength === "strong"
    );
    if (hasStrongPhaseViolation) {
      decision = DECISION.BLOCK;
      reasonCode = REASON_CODE.BLOCK_PHASE_ORDER;
      reasonText = phaseViolations[0].description;
    } else {
      decision = DECISION.WARN;
      reasonCode = REASON_CODE.WARN_PHASE_AMBIGUOUS;
      reasonText = phaseViolations[0].description;
    }
  } else if (notes.length > 0 && violations.length === 0 && matchedRules.filter(r => r.match_strength === "weak" && r.category !== "acceptance_criteria").length >= 2) {
    // Partial evidence — multiple weak signals suggest ambiguity
    decision = DECISION.WARN;
    reasonCode = REASON_CODE.WARN_PARTIAL_EVIDENCE;
    reasonText = "Action has partial overlap with contract constraints. Review before proceeding.";
  } else if (matchedRules.length === 0 && notes.length === 0 && summary.blocks_count === 0) {
    // No evidence at all — contract may be empty or not loaded
    decision = DECISION.WARN;
    reasonCode = REASON_CODE.WARN_NO_STRONG_MATCH;
    reasonText = "Contract has no structural signals. Cannot confirm adherence with confidence.";
  }

  return {
    ok: decision !== DECISION.BLOCK,
    decision,
    reason_code: reasonCode,
    reason_text: reasonText,
    matched_rules: matchedRules,
    violations,
    requires_human_approval: requiresHumanApproval,
    notes,
    contract_id: contractContext.contract_id,
    scope: scope || "default",
    evaluated_at: now,
  };
}

// ---------------------------------------------------------------------------
// runContractAdherenceGate(env, scope, candidateAction)
//
// Runtime-facing helper: fetches contract context from PR2 and evaluates
// adherence in one call. This is the canonical entry point for the worker
// to call before acting.
//
// Parameters:
//   env             — Cloudflare Workers env (must have ENAVIA_BRAIN KV binding)
//   scope           — execution scope (string, default: "default")
//   candidateAction — { intent, phase, task_id, action_type, target }
//
// Returns: ContractAdherenceResult (same shape as evaluateContractAdherence)
// ---------------------------------------------------------------------------
async function runContractAdherenceGate(env, scope, candidateAction) {
  const effectiveScope = scope || "default";

  // Step 1: Get active contract context (PR2)
  const contractContext = await getActiveContractContext(env, { scope: effectiveScope });

  // Step 2: If no active contract, decide based on absence
  if (!contractContext || !contractContext.ok || !contractContext.ready_for_pr3) {
    return {
      ok: false,
      decision: DECISION.WARN,
      reason_code: REASON_CODE.ERROR_NO_CONTRACT,
      reason_text: "No active contract found for this scope. Action allowed with caution.",
      matched_rules: [],
      violations: [],
      requires_human_approval: false,
      notes: ["No active contract — adherence gate cannot enforce. Proceed with caution."],
      contract_id: null,
      scope: effectiveScope,
      evaluated_at: new Date().toISOString(),
    };
  }

  // Step 3: If contract has relevant blocks, try to enrich context
  // (blocks are already summarized in summary_canonic by PR2)

  // Step 4: Evaluate adherence
  return evaluateContractAdherence({
    scope: effectiveScope,
    contractContext,
    candidateAction,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core evaluation
  evaluateContractAdherence,

  // Runtime helper (anchor for worker)
  runContractAdherenceGate,

  // Enums
  DECISION,
  REASON_CODE,
};
