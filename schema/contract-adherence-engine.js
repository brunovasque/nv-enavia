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
//   - resolveRelevantContractBlocks (PR2) — busca blocos reais do contrato
//   - summary_canonic (PR2) — fallback/apoio, nunca substituto
//   - resolution_ctx (PR2)
//   - sinais estruturais reais dos blocos (signals.hard_rules,
//     signals.approval_points, signals.blocking_points, etc.) (PR1)
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

const MIN_KEYWORD_LENGTH = 5;

// ---------------------------------------------------------------------------
// DEPLOY/PROMOTE keywords — actions that typically require approval
// ---------------------------------------------------------------------------
const DEPLOY_PROMOTE_KEYWORDS = [
  "deploy", "promote", "production", "prod", "release",
  "publicar", "promover", "produção", "lançar",
  "merge to main", "merge para main",
];

// Heuristic thresholds
const MAX_BLOCK_CONTENT_LENGTH = 800;
const STRONG_OVERLAP_THRESHOLD = 2;

// ---------------------------------------------------------------------------
// _normalize(text) — lowercase + trim for matching
// ---------------------------------------------------------------------------
function _normalize(text) {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// _extractKeywords(text) — extract meaningful keywords from text
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
// _scanBlocksForSignals(blocks, category, actionSummary)
//
// Scans real contract blocks for structural signals in a given category.
// Returns matched evidence from blocks (block_id, heading, signal text).
// This is the primary evidence source — uses PR1 ingestion signals directly.
//
// Match precision: overlap is computed per SIGNAL TEXT individually.
// Block heading/content serves as secondary context only — it does NOT
// inflate the overlap score for unrelated signals within the same block.
// ---------------------------------------------------------------------------
function _scanBlocksForSignals(blocks, category, actionSummary) {
  const matched = [];
  if (!blocks || blocks.length === 0) return matched;

  // Deduplicate action keywords — actionSummary may repeat words from
  // intent + action_type + target (e.g., "deploy" appearing twice).
  const actionWords = [...new Set(_extractKeywords(actionSummary))];
  if (actionWords.length === 0) return matched;

  for (const block of blocks) {
    if (!block.signals || !block.signals[category]) continue;
    if (block.signals[category].length === 0) continue;

    // Pre-compute block context keywords (heading only — lightweight context)
    const headingWords = [...new Set(_extractKeywords(block.heading || ""))];

    for (const signal of block.signals[category]) {
      const signalText = typeof signal === "string" ? signal : JSON.stringify(signal);

      // Primary: overlap between action and the signal's own text
      const signalWords = [...new Set(_extractKeywords(signalText))];
      const signalOverlap = actionWords.filter(w => signalWords.includes(w));

      // Secondary: heading context adds at most 1 bonus keyword if heading
      // matches but signal alone doesn't meet threshold. This prevents
      // block-level text from dominating unrelated signals.
      const headingBonus = headingWords.filter(
        w => actionWords.includes(w) && !signalOverlap.includes(w)
      );
      const contextOverlap = signalOverlap.concat(
        headingBonus.length > 0 ? [headingBonus[0]] : []
      );

      matched.push({
        signal: signalText,
        block_id: block.block_id,
        heading: block.heading || null,
        block_type: block.block_type || null,
        content_overlap: contextOverlap,
        overlap_count: contextOverlap.length,
      });
    }
  }
  return matched;
}

// ---------------------------------------------------------------------------
// _scanBlocksForContentMatch(blocks, actionSummary)
//
// Returns blocks whose content has significant keyword overlap with action.
// Used to detect scope relevance from real block content.
// ---------------------------------------------------------------------------
function _scanBlocksForContentMatch(blocks, actionSummary) {
  if (!blocks || blocks.length === 0) return [];
  const actionWords = _extractKeywords(actionSummary);
  if (actionWords.length === 0) return [];

  return blocks
    .map(block => {
      const blockText = _normalize(
        (block.heading || "") + " " + (block.content || "").slice(0, MAX_BLOCK_CONTENT_LENGTH)
      );
      const blockWords = _extractKeywords(blockText);
      const overlap = actionWords.filter(w => blockWords.includes(w));
      return { block, overlap, score: overlap.length };
    })
    .filter(m => m.score > 0)
    .sort((a, b) => b.score - a.score);
}

// ---------------------------------------------------------------------------
// evaluateContractAdherence({ scope, contractContext, candidateAction })
//
// Core canonical function — PR3 adherence engine.
//
// Parameters:
//   scope            {string}   — execution scope (e.g., "default", "exec_1")
//   contractContext  {object}   — from getActiveContractContext (PR2), enriched
//     .contract_id   {string}
//     .active_state  {object}
//     .summary       {object}   — summary_canonic (PR2) — fallback/apoio
//     .resolution_ctx {object}  — resolution context (PR2)
//     .relevant_blocks {Array}  — real blocks resolved for this action (PR1+PR2)
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
//   resolution_strategy:    string | null,
//   relevant_blocks_count:  number,
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
    resolution_strategy: null,
    relevant_blocks_count: 0,
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

  // ─── Relevant blocks: primary evidence source ────────────────────────
  // These come from resolveRelevantContractBlocks (PR2) called in
  // runContractAdherenceGate. They are real contract blocks with signals.
  const relevantBlocks = contractContext.relevant_blocks || [];
  const resolutionStrategy = resCtx.strategy || null;

  const violations = [];
  const matchedRules = [];
  const notes = [];
  let requiresHumanApproval = false;

  // ─── Check 1: Hard Rules — from real blocks first, summary fallback ──
  const blockHardRules = _scanBlocksForSignals(relevantBlocks, "hard_rules", actionSummary);

  if (blockHardRules.length > 0) {
    // Evidence from real blocks — check each signal for action overlap
    for (const hit of blockHardRules) {
      if (hit.overlap_count >= STRONG_OVERLAP_THRESHOLD) {
        // Strong overlap — action conflicts with block's hard_rules
        violations.push({
          type: "hard_rule",
          description: `Action conflicts with hard rule in block ${hit.block_id}: "${hit.signal}"`,
          block_id: hit.block_id,
          heading: hit.heading,
          matched_keywords: hit.content_overlap,
        });
        matchedRules.push({
          rule: hit.signal,
          block_id: hit.block_id,
          heading: hit.heading,
          category: "hard_rule",
          source: "block",
        });
      } else if (hit.overlap_count === 1) {
        // Weak overlap — note it but don't create violation
        notes.push(`Block ${hit.block_id} has hard rule "${hit.signal}" — weak overlap (keyword: ${hit.content_overlap[0]}).`);
        matchedRules.push({
          rule: hit.signal,
          block_id: hit.block_id,
          heading: hit.heading,
          category: "hard_rule",
          source: "block_weak",
        });
      } else {
        // Block has hard_rules but no direct overlap with action — note it
        notes.push(`Block ${hit.block_id} has hard rule "${hit.signal}" — no direct conflict with this action.`);
        matchedRules.push({
          rule: hit.signal,
          block_id: hit.block_id,
          heading: hit.heading,
          category: "hard_rule",
          source: "block_no_overlap",
        });
      }
    }
  }

  // Summary fallback: if no block evidence, use summary.hard_rules_top
  if (blockHardRules.length === 0) {
    const hardRulesTop = summary.hard_rules_top || [];
    for (const rule of hardRulesTop) {
      const ruleWords = _extractKeywords(rule);
      const intentWords = _extractKeywords(actionSummary);
      const overlap = ruleWords.filter(w => intentWords.includes(w));

      if (overlap.length >= STRONG_OVERLAP_THRESHOLD) {
        violations.push({
          type: "hard_rule",
          description: `Action conflicts with hard rule (summary): "${rule}"`,
          matched_keywords: overlap,
          source: "summary",
        });
        matchedRules.push({
          rule,
          category: "hard_rule",
          source: "summary",
        });
      } else if (overlap.length === 1) {
        notes.push(`Partial overlap with hard rule (summary): "${rule}" (keyword: ${overlap[0]})`);
      }
    }
  }

  // ─── Check 2: Blocking Points — from real blocks first ───────────────
  const blockBlockingPoints = _scanBlocksForSignals(relevantBlocks, "blocking_points", actionSummary);

  if (blockBlockingPoints.length > 0) {
    for (const hit of blockBlockingPoints) {
      if (hit.overlap_count >= STRONG_OVERLAP_THRESHOLD) {
        violations.push({
          type: "blocking_point",
          description: `Action conflicts with blocking point in block ${hit.block_id}: "${hit.signal}"`,
          block_id: hit.block_id,
          heading: hit.heading,
          matched_keywords: hit.content_overlap,
        });
        matchedRules.push({
          rule: hit.signal,
          block_id: hit.block_id,
          heading: hit.heading,
          category: "blocking_point",
          source: "block",
        });
      } else if (hit.overlap_count === 1) {
        notes.push(`Block ${hit.block_id} has blocking point "${hit.signal}" — weak overlap (keyword: ${hit.content_overlap[0]}).`);
        matchedRules.push({
          rule: hit.signal,
          block_id: hit.block_id,
          heading: hit.heading,
          category: "blocking_point",
          source: "block_weak",
        });
      } else {
        notes.push(`Block ${hit.block_id} has blocking point "${hit.signal}" — no direct conflict.`);
      }
    }
  }

  // Summary fallback for blocking points
  if (blockBlockingPoints.length === 0) {
    const blockingPointsTop = summary.blocking_points_top || [];
    for (const bp of blockingPointsTop) {
      const bpWords = _extractKeywords(bp);
      const intentWords = _extractKeywords(actionSummary);
      const overlap = bpWords.filter(w => intentWords.includes(w));

      if (overlap.length >= STRONG_OVERLAP_THRESHOLD) {
        violations.push({
          type: "blocking_point",
          description: `Action conflicts with blocking point (summary): "${bp}"`,
          matched_keywords: overlap,
          source: "summary",
        });
        matchedRules.push({
          rule: bp,
          category: "blocking_point",
          source: "summary",
        });
      } else if (overlap.length === 1) {
        notes.push(`Partial overlap with blocking point (summary): "${bp}" (keyword: ${overlap[0]})`);
      }
    }
  }

  // ─── Check 3: Human Approval — from real blocks first ────────────────
  const blockApprovalPoints = _scanBlocksForSignals(relevantBlocks, "approval_points", actionSummary);
  const isDeployLike = _textContains(actionSummary, DEPLOY_PROMOTE_KEYWORDS);

  if (blockApprovalPoints.length > 0 && isDeployLike) {
    requiresHumanApproval = true;
    for (const hit of blockApprovalPoints) {
      violations.push({
        type: "human_approval_required",
        description: `Deploy/promote action requires human approval per block ${hit.block_id}: "${hit.signal}"`,
        block_id: hit.block_id,
        heading: hit.heading,
      });
      matchedRules.push({
        rule: hit.signal,
        block_id: hit.block_id,
        heading: hit.heading,
        category: "approval_point",
        source: "block",
      });
    }
  }

  // Summary fallback for approval
  if (blockApprovalPoints.length === 0) {
    const approvalPointsTop = summary.approval_points_top || [];
    const approvalPointsCount = summary.approval_points_count || 0;

    if ((approvalPointsCount > 0 || approvalPointsTop.length > 0) && isDeployLike) {
      requiresHumanApproval = true;
      violations.push({
        type: "human_approval_required",
        description: `Action appears to be deploy/promote and contract has ${approvalPointsCount} approval point(s).`,
        approval_points: approvalPointsTop,
        source: "summary",
      });
      matchedRules.push({
        rule: approvalPointsTop[0] || "approval_point_detected",
        category: "approval_point",
        source: "summary",
      });
    }
  }

  // ─── Check 4: Phase/Order — deterministic rules ──────────────────────
  const detectedPhases = summary.detected_phases || [];
  const currentPhaseHint = activeState.current_phase_hint || null;

  if (actionPhase && detectedPhases.length > 0) {
    const normActionPhase = _normalize(actionPhase);
    const phaseIndex = detectedPhases.findIndex(p => _normalize(p) === normActionPhase);
    const phaseExists = phaseIndex >= 0;

    // Partial match: action phase is substring of a known phase or vice-versa
    const partialMatchIdx = !phaseExists
      ? detectedPhases.findIndex(p =>
          _normalize(p).includes(normActionPhase) || normActionPhase.includes(_normalize(p))
        )
      : -1;

    if (!phaseExists && partialMatchIdx < 0) {
      // Phase completely unknown — BLOCK: clear incompatibility
      violations.push({
        type: "phase_unknown",
        description: `Action phase "${actionPhase}" not found in contract detected phases: [${detectedPhases.join(", ")}]`,
      });
    } else if (!phaseExists && partialMatchIdx >= 0) {
      // Partial match — WARN: ambiguous
      notes.push(`Action phase "${actionPhase}" partially matches "${detectedPhases[partialMatchIdx]}" — ambiguous.`);
    }

    // Phase regression check: deterministic ordering
    if (currentPhaseHint) {
      const currentIdx = detectedPhases.findIndex(p => _normalize(p) === _normalize(currentPhaseHint));
      const actionIdx = phaseExists ? phaseIndex : partialMatchIdx;

      if (currentIdx >= 0 && actionIdx >= 0 && actionIdx < currentIdx) {
        // Clear regression: action targets an earlier phase
        violations.push({
          type: "phase_regression",
          description: `Phase regression: action targets "${actionPhase}" (index ${actionIdx}) but current phase is "${currentPhaseHint}" (index ${currentIdx}).`,
          current_phase: currentPhaseHint,
          target_phase: actionPhase,
          current_index: currentIdx,
          target_index: actionIdx,
        });
      }
    }
  }

  // ─── Check 5: Scope/Target via block content ─────────────────────────
  if (relevantBlocks.length > 0 && actionTarget) {
    const contentMatches = _scanBlocksForContentMatch(relevantBlocks, actionTarget);
    if (contentMatches.length === 0) {
      notes.push(`Action target "${actionTarget}" has no content overlap with resolved contract blocks.`);
    }
  }

  // ─── Check 6: Acceptance Criteria from blocks ────────────────────────
  const blockAcceptanceCriteria = _scanBlocksForSignals(relevantBlocks, "acceptance_criteria", actionSummary);
  if (blockAcceptanceCriteria.length > 0) {
    for (const hit of blockAcceptanceCriteria) {
      matchedRules.push({
        rule: hit.signal,
        block_id: hit.block_id,
        heading: hit.heading,
        category: "acceptance_criteria",
        source: "block",
      });
    }
  }

  // ─── Decision Logic ──────────────────────────────────────────────────
  const hardViolations = violations.filter(v =>
    v.type === "hard_rule" || v.type === "blocking_point"
  );
  const approvalViolations = violations.filter(v =>
    v.type === "human_approval_required"
  );
  const phaseUnknownViolations = violations.filter(v =>
    v.type === "phase_unknown"
  );
  const phaseRegressionViolations = violations.filter(v =>
    v.type === "phase_regression"
  );

  let decision = DECISION.ALLOW;
  let reasonCode = REASON_CODE.ALLOW_ADHERENT;
  let reasonText = "Action is adherent to the active contract.";

  if (hardViolations.length > 0) {
    // Hard rule or blocking point violated — always BLOCK
    decision = DECISION.BLOCK;
    const firstHard = hardViolations[0];
    reasonCode = firstHard.type === "hard_rule"
      ? REASON_CODE.BLOCK_HARD_RULE
      : REASON_CODE.BLOCK_BLOCKING_POINT;
    reasonText = firstHard.description;
  } else if (approvalViolations.length > 0) {
    // Deploy-like action needs human approval — BLOCK
    decision = DECISION.BLOCK;
    reasonCode = REASON_CODE.BLOCK_HUMAN_APPROVAL;
    reasonText = approvalViolations[0].description;
  } else if (phaseRegressionViolations.length > 0) {
    // Clear phase regression — BLOCK
    decision = DECISION.BLOCK;
    reasonCode = REASON_CODE.BLOCK_PHASE_ORDER;
    reasonText = phaseRegressionViolations[0].description;
  } else if (phaseUnknownViolations.length > 0) {
    // Phase completely unknown — WARN (not enough to BLOCK without regression)
    decision = DECISION.WARN;
    reasonCode = REASON_CODE.WARN_PHASE_AMBIGUOUS;
    reasonText = phaseUnknownViolations[0].description;
  } else {
    // No violations — check if we even have evidence
    const hasBlocks = relevantBlocks.length > 0 || (summary.blocks_count || 0) > 0;
    const hasNotes = notes.length > 0;

    if (!hasBlocks && !hasNotes) {
      decision = DECISION.WARN;
      reasonCode = REASON_CODE.WARN_NO_STRONG_MATCH;
      reasonText = "Contract has no structural signals. Cannot confirm adherence with confidence.";
    }
    // Otherwise ALLOW — action is adherent
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
    resolution_strategy: resolutionStrategy,
    relevant_blocks_count: relevantBlocks.length,
  };
}

// ---------------------------------------------------------------------------
// runContractAdherenceGate(env, scope, candidateAction)
//
// Runtime-facing helper: fetches contract context from PR2, resolves
// relevant blocks for the candidate action, and evaluates adherence.
// This is the canonical entry point for the worker to call before acting.
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

  // Step 2: If no active contract, fail safe
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
      resolution_strategy: null,
      relevant_blocks_count: 0,
    };
  }

  // Step 3: Resolve relevant blocks for this candidate action (PR2 real)
  // Uses the candidate action's phase/intent/task_id to select blocks.
  const action = candidateAction || {};
  let relevantBlocks = [];
  let resolutionResult = null;

  if (contractContext.contract_id) {
    resolutionResult = await resolveRelevantContractBlocks(
      env,
      contractContext.contract_id,
      {
        phase: action.phase || null,
        intent: action.intent || null,
        taskId: action.task_id || null,
        scope: effectiveScope,
      }
    );

    if (resolutionResult && resolutionResult.ok && resolutionResult.blocks) {
      relevantBlocks = resolutionResult.blocks;
    }
  }

  // Step 4: Enrich context with resolved blocks + updated resolution info
  const enrichedContext = {
    ...contractContext,
    relevant_blocks: relevantBlocks,
  };

  // Update resolution_ctx with fresh resolution data if available
  if (resolutionResult && resolutionResult.ok) {
    enrichedContext.resolution_ctx = {
      ...(contractContext.resolution_ctx || {}),
      strategy: resolutionResult.strategy,
      fallback: resolutionResult.fallback,
      matched_count: resolutionResult.matched_count,
      total_blocks: resolutionResult.total_blocks,
      relevant_block_ids: relevantBlocks.map(b => b.block_id),
    };
  }

  // Step 5: Evaluate adherence with enriched context
  return evaluateContractAdherence({
    scope: effectiveScope,
    contractContext: enrichedContext,
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
