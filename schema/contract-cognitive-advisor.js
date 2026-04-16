// ============================================================================
// 🧠 ENAVIA — Contract Cognitive Advisor (PR5)
//
// Camada cognitiva consultiva sobre contrato ativo.
// Lê contrato ativo + blocos relevantes + summary_canonic + resolution_ctx +
// resultado do gate, interpreta ambiguidades e conflitos aparentes, expõe
// leituras alternativas quando pertinente, e devolve saída estruturada
// pronta para a PR6 consumir.
//
// REGRAS FUNDAMENTAIS:
//   - CONSULTIVA, nunca soberana — não pode autorizar nem bloquear sozinha
//   - Não substitui o gate de aderência (PR3) — complementa com interpretação
//   - Ancorada no contrato real — nunca inventa regra contratual ausente
//   - Expõe incerteza de forma honesta — sem falsa confiança
//   - Não pode decidir deploy/promote/ação crítica sozinha
//   - Prepara saída canônica para PR6 orquestrar
//
// Fontes de evidência (todas utilizadas de verdade):
//   - relevantBlocks (PR2)        — fonte primária de sinais estruturais
//   - summary_canonic (PR2)       — suporte contextual e fallback honesto
//   - resolution_ctx (PR2)        — qualidade/estratégia da resolução de blocos
//   - adherenceResult / gate (PR3) — resultado do gate, quando disponível
//   - candidateAction              — ação/intenção candidata
//
// NÃO faz:
//   - LLM / embeddings / IA opaca
//   - Painel / UX visual
//   - Persistência / I/O direto (apenas lê via PR2)
//   - Execução autônoma
//   - Aprovação/bloqueio acima do gate
//
// Escopo: WORKER-ONLY. Não misturar com painel, workflows ou frentes paralelas.
// ============================================================================

import {
  getActiveContractContext,
  resolveRelevantContractBlocks,
} from "./contract-active-state.js";

// ---------------------------------------------------------------------------
// AMBIGUITY_LEVEL — enum canônico de nível de ambiguidade
// ---------------------------------------------------------------------------
const AMBIGUITY_LEVEL = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  CRITICAL: "critical",
};

// ---------------------------------------------------------------------------
// CONFIDENCE — thresholds for confidence assessment
// ---------------------------------------------------------------------------
const CONFIDENCE_THRESHOLDS = {
  HIGH: 0.8,
  MEDIUM: 0.5,
  LOW: 0.3,
};

// ---------------------------------------------------------------------------
// _normalize(text) — lowercase + trim
// ---------------------------------------------------------------------------
function _normalize(text) {
  if (!text || typeof text !== "string") return "";
  return text.trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// _extractKeywords(text) — meaningful keywords from text (min 4 chars)
// ---------------------------------------------------------------------------
function _extractKeywords(text) {
  const norm = _normalize(text);
  if (!norm) return [];
  const stopwords = new Set([
    "para", "como", "com", "sem", "que", "uma", "dos", "das", "nos", "nas",
    "por", "pelo", "pela", "mais", "este", "esta", "esse", "essa", "todo",
    "toda", "todos", "todas", "deve", "será", "pode", "cada", "entre",
    "sobre", "após", "antes", "além", "ainda", "caso", "mesmo",
    "with", "from", "that", "this", "have", "been", "will", "should",
    "must", "each", "also", "them", "they", "when", "what", "which",
    "their", "into", "more", "than", "some", "only", "then", "just",
  ]);
  return norm
    .split(/\s+/)
    .filter(w => w.length >= 4 && !stopwords.has(w));
}

// ---------------------------------------------------------------------------
// _buildActionSummary(candidateAction) — creates searchable summary text
// ---------------------------------------------------------------------------
function _buildActionSummary(candidateAction) {
  if (!candidateAction || typeof candidateAction !== "object") return "";
  const parts = [
    candidateAction.intent,
    candidateAction.action_type,
    candidateAction.target,
    candidateAction.summary,
    candidateAction.phase,
    candidateAction.task,
  ].filter(Boolean);
  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// _isWeakAction(candidateAction, actionSummary)
//
// Determines if candidate action is absent, empty, or too weak to support
// meaningful analysis.
// ---------------------------------------------------------------------------
function _isWeakAction(candidateAction, actionSummary) {
  if (!candidateAction || typeof candidateAction !== "object") return true;
  if (!actionSummary || actionSummary.trim().length === 0) return true;
  const kw = _extractKeywords(actionSummary);
  return kw.length === 0;
}

// ---------------------------------------------------------------------------
// _assessSummaryEvidence(summary, actionSummary)
//
// Scans summary_canonic for evidence relevant to the candidate action.
// Uses: macro_objective, hard_rules_top, approval_points_top,
//       blocking_points_top, acceptance_criteria_top, deadlines_top,
//       detected_phases.
//
// Returns structured summary-level evidence. Does NOT substitute block
// evidence — provides contextual support and fallback.
// ---------------------------------------------------------------------------
function _assessSummaryEvidence(summary, actionSummary) {
  const result = {
    macro_objective_match: false,
    macro_objective: null,
    hard_rules_hits: [],
    approval_points_hits: [],
    blocking_points_hits: [],
    acceptance_criteria_hits: [],
    deadlines_hits: [],
    detected_phases: null,
    phase_match: false,
    total_summary_signals: 0,
    has_useful_summary: false,
  };

  if (!summary || typeof summary !== "object") return result;

  // Expose detected phases even without action
  if (Array.isArray(summary.detected_phases) && summary.detected_phases.length > 0) {
    result.detected_phases = summary.detected_phases;
  }
  if (typeof summary.macro_objective === "string" && summary.macro_objective.trim()) {
    result.macro_objective = summary.macro_objective;
  }

  // Check if summary has enough useful content
  const hasSummaryContent = !!(
    result.macro_objective ||
    (summary.hard_rules_count && summary.hard_rules_count > 0) ||
    (summary.approval_points_count && summary.approval_points_count > 0) ||
    (summary.blocking_points_count && summary.blocking_points_count > 0) ||
    result.detected_phases
  );
  result.has_useful_summary = hasSummaryContent;

  if (!actionSummary) return result;
  const actionWords = _extractKeywords(actionSummary);
  if (actionWords.length === 0) return result;

  // Check macro_objective overlap
  if (result.macro_objective) {
    const objWords = _extractKeywords(result.macro_objective);
    const overlap = actionWords.filter(w => objWords.includes(w));
    if (overlap.length > 0) {
      result.macro_objective_match = true;
      result.total_summary_signals++;
    }
  }

  // Check top signals — each category
  const categories = [
    { key: "hard_rules_top",          target: "hard_rules_hits" },
    { key: "approval_points_top",     target: "approval_points_hits" },
    { key: "blocking_points_top",     target: "blocking_points_hits" },
    { key: "acceptance_criteria_top", target: "acceptance_criteria_hits" },
    { key: "deadlines_top",           target: "deadlines_hits" },
  ];

  for (const cat of categories) {
    const items = summary[cat.key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const text = typeof item === "string" ? item : String(item);
      const signalWords = _extractKeywords(text);
      const overlap = actionWords.filter(w => signalWords.includes(w));
      if (overlap.length > 0) {
        result[cat.target].push({
          signal: text,
          overlap_keywords: overlap,
          overlap_count: overlap.length,
          source: "summary",
        });
        result.total_summary_signals++;
      }
    }
  }

  // Check phase match
  if (result.detected_phases) {
    const phaseNorm = _normalize(actionSummary);
    for (const phase of result.detected_phases) {
      if (typeof phase === "string" && phaseNorm.includes(_normalize(phase))) {
        result.phase_match = true;
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// _assessResolutionCtxQuality(resolutionCtx)
//
// Evaluates the resolution_ctx to understand how blocks were resolved.
// Returns quality assessment that feeds into ambiguity/confidence.
//
// resolution_ctx shape (from PR2/PR3):
//   strategy, fallback, matched_count, total_blocks,
//   relevant_block_ids, current_phase_hint, last_task_id, resolved_at
// ---------------------------------------------------------------------------
function _assessResolutionCtxQuality(resolutionCtx) {
  const result = {
    has_resolution_ctx: false,
    strategy: null,
    is_fallback: false,
    matched_ratio: 0,
    matched_count: 0,
    total_blocks: 0,
    is_weak_resolution: false,
    phase_hint: null,
    quality_notes: [],
  };

  if (!resolutionCtx || typeof resolutionCtx !== "object") {
    result.quality_notes.push("resolution_ctx ausente — seleção de blocos sem contexto de resolução.");
    result.is_weak_resolution = true;
    return result;
  }

  result.has_resolution_ctx = true;
  result.strategy = resolutionCtx.strategy || null;
  result.is_fallback = !!resolutionCtx.fallback;
  result.matched_count = resolutionCtx.matched_count || 0;
  result.total_blocks = resolutionCtx.total_blocks || 0;
  result.phase_hint = resolutionCtx.current_phase_hint || null;

  if (result.total_blocks > 0) {
    result.matched_ratio = result.matched_count / result.total_blocks;
  }

  // Assess quality
  if (result.is_fallback) {
    result.quality_notes.push("Resolução usou fallback — blocos selecionados podem não ser os mais relevantes.");
    result.is_weak_resolution = true;
  }
  if (result.strategy === "none" || !result.strategy) {
    result.quality_notes.push("Estratégia de resolução indefinida — base de blocos pode ser imprecisa.");
    result.is_weak_resolution = true;
  }
  if (result.matched_count === 0 && result.total_blocks > 0) {
    result.quality_notes.push(`Nenhum bloco corresponde dentre ${result.total_blocks} — base contratual potencialmente inalcançável.`);
    result.is_weak_resolution = true;
  }
  if (result.matched_ratio > 0 && result.matched_ratio < 0.1) {
    result.quality_notes.push(`Apenas ${result.matched_count}/${result.total_blocks} blocos selecionados — cobertura muito parcial.`);
  }
  if (!result.is_fallback && result.strategy && result.matched_count > 0) {
    result.quality_notes.push(`Resolução via estratégia "${result.strategy}" com ${result.matched_count}/${result.total_blocks} blocos.`);
  }

  return result;
}

// ---------------------------------------------------------------------------
// _assessBlockEvidence(blocks, actionSummary)
//
// Scans blocks for signals relevant to the action and builds evidence map.
// Returns structured evidence from real contract blocks.
// ---------------------------------------------------------------------------
function _assessBlockEvidence(blocks, actionSummary) {
  const evidence = {
    hard_rules: [],
    approval_points: [],
    blocking_points: [],
    acceptance_criteria: [],
    deadlines: [],
    scope_matches: [],
    total_signals_found: 0,
    blocks_with_evidence: 0,
  };

  if (!blocks || blocks.length === 0 || !actionSummary) return evidence;

  const actionWords = _extractKeywords(actionSummary);
  if (actionWords.length === 0) return evidence;

  const signalCategories = [
    "hard_rules", "approval_points", "blocking_points",
    "acceptance_criteria", "deadlines",
  ];

  for (const block of blocks) {
    let blockHasEvidence = false;

    // Check signals
    if (block.signals) {
      for (const category of signalCategories) {
        if (!block.signals[category] || block.signals[category].length === 0) continue;
        for (const signal of block.signals[category]) {
          const signalText = typeof signal === "string" ? signal : JSON.stringify(signal);
          const signalWords = _extractKeywords(signalText);
          const overlap = actionWords.filter(w => signalWords.includes(w));
          if (overlap.length > 0) {
            evidence[category].push({
              signal: signalText,
              block_id: block.block_id,
              heading: block.heading || null,
              overlap_keywords: overlap,
              overlap_count: overlap.length,
            });
            evidence.total_signals_found++;
            blockHasEvidence = true;
          }
        }
      }
    }

    // Check content match for scope relevance
    const blockText = _normalize(
      (block.heading || "") + " " + (block.content || "").slice(0, 600)
    );
    const blockWords = _extractKeywords(blockText);
    const contentOverlap = actionWords.filter(w => blockWords.includes(w));
    if (contentOverlap.length >= 2) {
      evidence.scope_matches.push({
        block_id: block.block_id,
        heading: block.heading || null,
        block_type: block.block_type || null,
        overlap_keywords: contentOverlap,
        overlap_count: contentOverlap.length,
      });
      blockHasEvidence = true;
    }

    if (blockHasEvidence) evidence.blocks_with_evidence++;
  }

  return evidence;
}

// ---------------------------------------------------------------------------
// _detectConflicts(evidence, summaryEvidence, gateResult)
//
// Detects perceived conflicts from block evidence, summary evidence,
// and gate result. Returns array of conflict descriptions.
// ---------------------------------------------------------------------------
function _detectConflicts(evidence, summaryEvidence, gateResult) {
  const conflicts = [];

  // Conflict: hard rule signal overlaps with the candidate action (from blocks)
  for (const hit of evidence.hard_rules) {
    if (hit.overlap_count >= 2) {
      conflicts.push({
        type: "hard_rule_conflict",
        severity: "high",
        description: `Ação candidata tem sobreposição forte com regra dura do contrato no bloco ${hit.block_id}: "${hit.signal}"`,
        block_id: hit.block_id,
        evidence: hit.overlap_keywords,
        source: "block",
      });
    }
  }

  // Conflict: hard rule from summary (fallback — only when blocks didn't catch it)
  if (evidence.hard_rules.length === 0 && summaryEvidence.hard_rules_hits.length > 0) {
    for (const hit of summaryEvidence.hard_rules_hits) {
      if (hit.overlap_count >= 2) {
        conflicts.push({
          type: "hard_rule_conflict",
          severity: "high",
          description: `Ação candidata encosta em regra dura do summary_canonic: "${hit.signal}"`,
          block_id: null,
          evidence: hit.overlap_keywords,
          source: "summary",
        });
      }
    }
  }

  // Conflict: blocking point matches (from blocks)
  for (const hit of evidence.blocking_points) {
    if (hit.overlap_count >= 2) {
      conflicts.push({
        type: "blocking_point_conflict",
        severity: "high",
        description: `Ponto de bloqueio contratual pode afetar ação no bloco ${hit.block_id}: "${hit.signal}"`,
        block_id: hit.block_id,
        evidence: hit.overlap_keywords,
        source: "block",
      });
    }
  }

  // Conflict: blocking point from summary (fallback)
  if (evidence.blocking_points.length === 0 && summaryEvidence.blocking_points_hits.length > 0) {
    for (const hit of summaryEvidence.blocking_points_hits) {
      if (hit.overlap_count >= 2) {
        conflicts.push({
          type: "blocking_point_conflict",
          severity: "high",
          description: `Ponto de bloqueio detectado via summary_canonic: "${hit.signal}"`,
          block_id: null,
          evidence: hit.overlap_keywords,
          source: "summary",
        });
      }
    }
  }

  // Conflict from gate result
  if (gateResult && gateResult.decision === "BLOCK") {
    conflicts.push({
      type: "gate_block",
      severity: "critical",
      description: `Gate de aderência (PR3) bloqueou esta ação: ${gateResult.reason_text || gateResult.reason_code || "motivo não especificado"}`,
      block_id: null,
      evidence: (gateResult.violations || []).map(v => v.description || String(v)),
      source: "gate",
    });
  }

  // Conflict: approval required — only flag when gate didn't already ALLOW
  // and overlap is strong. Checks both blocks and summary.
  const approvalHits = [
    ...evidence.approval_points.map(h => ({ ...h, source: "block" })),
    ...(evidence.approval_points.length === 0
      ? summaryEvidence.approval_points_hits.map(h => ({ ...h, block_id: null, heading: null }))
      : []),
  ];
  for (const hit of approvalHits) {
    if (hit.overlap_count >= 2) {
      if (!gateResult || gateResult.decision !== "ALLOW") {
        conflicts.push({
          type: "approval_required",
          severity: "medium",
          description: `Ponto de aprovação contratual detectado${hit.block_id ? ` no bloco ${hit.block_id}` : " via summary_canonic"}: "${hit.signal}" — pode exigir confirmação humana`,
          block_id: hit.block_id || null,
          evidence: hit.overlap_keywords,
          source: hit.source || "block",
        });
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// _assessAmbiguity(params)
//
// Determines ambiguity level based on all evidence sources.
// RULE: empty/weak evidence NEVER yields LOW. Vazio = incerteza, não clareza.
// ---------------------------------------------------------------------------
function _assessAmbiguity({
  evidence, summaryEvidence, resolutionQuality, conflicts,
  relevantBlocks, actionSummary, gateResult, candidateAction,
}) {
  const hasBlocks = relevantBlocks && relevantBlocks.length > 0;
  const hasStrongBlockEvidence = evidence.total_signals_found >= 2;
  const hasSummarySignals = summaryEvidence.total_summary_signals >= 1;
  const hasCriticalConflict = conflicts.some(c => c.severity === "critical");
  const hasHighConflict = conflicts.some(c => c.severity === "high");
  const weakAction = _isWeakAction(candidateAction, actionSummary);
  const hasUsefulSummary = summaryEvidence.has_useful_summary;
  const weakResolution = resolutionQuality.is_weak_resolution;
  const gateAllowed = gateResult && gateResult.decision === "ALLOW" && (!gateResult.violations || gateResult.violations.length === 0);

  // ─── CRITICAL: gate blocked ────────────────────────────────────────
  if (hasCriticalConflict) return AMBIGUITY_LEVEL.CRITICAL;

  // ─── HIGH: major gaps or conflicts ─────────────────────────────────
  // Weak/absent action → NEVER low, always at least MEDIUM
  if (weakAction && !gateAllowed) return AMBIGUITY_LEVEL.HIGH;
  if (hasHighConflict && !hasStrongBlockEvidence) return AMBIGUITY_LEVEL.HIGH;
  if (!hasBlocks && !hasUsefulSummary) return AMBIGUITY_LEVEL.HIGH;
  if (!hasBlocks && !gateAllowed) return AMBIGUITY_LEVEL.HIGH;

  // ─── MEDIUM: partial evidence or weak signals ──────────────────────
  if (conflicts.length > 0) return AMBIGUITY_LEVEL.MEDIUM;
  if (weakResolution && !gateAllowed) return AMBIGUITY_LEVEL.MEDIUM;
  if (!hasStrongBlockEvidence && !hasSummarySignals && !gateAllowed) return AMBIGUITY_LEVEL.MEDIUM;
  if (weakAction && gateAllowed) return AMBIGUITY_LEVEL.MEDIUM;

  // ─── LOW: clear combined evidence from blocks + summary ────────────
  return AMBIGUITY_LEVEL.LOW;
}

// ---------------------------------------------------------------------------
// _assessConfidence(params)
//
// Calculates a confidence score (0.0 - 1.0) for the interpretation.
// Uses blocks, summary, resolution_ctx, and gate quality.
// ---------------------------------------------------------------------------
function _assessConfidence({
  evidence, summaryEvidence, resolutionQuality, conflicts,
  relevantBlocks, ambiguityLevel, gateResult, candidateAction, actionSummary,
}) {
  const weakAction = _isWeakAction(candidateAction, actionSummary);

  // Base score depends on starting evidence quality
  let score = 0.35;

  // ─── Boost: block evidence ─────────────────────────────────────────
  if (relevantBlocks && relevantBlocks.length > 0) score += 0.1;
  if (evidence.total_signals_found >= 2) score += 0.12;
  if (evidence.scope_matches.length >= 2) score += 0.08;
  if (evidence.blocks_with_evidence >= 2) score += 0.05;

  // ─── Boost: summary evidence ───────────────────────────────────────
  if (summaryEvidence.macro_objective_match) score += 0.08;
  if (summaryEvidence.total_summary_signals >= 2) score += 0.07;
  if (summaryEvidence.phase_match) score += 0.05;
  if (summaryEvidence.has_useful_summary) score += 0.03;

  // ─── Boost: resolution_ctx quality ─────────────────────────────────
  if (resolutionQuality.has_resolution_ctx && !resolutionQuality.is_weak_resolution) score += 0.07;
  if (resolutionQuality.is_fallback) score -= 0.05;
  if (resolutionQuality.is_weak_resolution) score -= 0.05;

  // ─── Boost: gate ───────────────────────────────────────────────────
  if (gateResult && gateResult.decision === "ALLOW") score += 0.05;

  // ─── Penalty: conflicts and ambiguity ──────────────────────────────
  if (conflicts.length > 0) score -= 0.08 * Math.min(conflicts.length, 3);
  if (ambiguityLevel === AMBIGUITY_LEVEL.CRITICAL) score -= 0.25;
  else if (ambiguityLevel === AMBIGUITY_LEVEL.HIGH) score -= 0.15;
  else if (ambiguityLevel === AMBIGUITY_LEVEL.MEDIUM) score -= 0.08;

  // ─── Penalty: weak action ──────────────────────────────────────────
  if (weakAction) score -= 0.15;

  // Clamp
  return Math.round(Math.max(0.0, Math.min(1.0, score)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// _buildInterpretation(params)
//
// Produces a human-readable interpretation summary.
// Now includes summary_canonic and resolution_ctx insights.
// ---------------------------------------------------------------------------
function _buildInterpretation({
  evidence, summaryEvidence, resolutionQuality, conflicts,
  ambiguity, confidence, gateResult,
}) {
  const parts = [];

  // Gate context
  if (gateResult) {
    if (gateResult.decision === "ALLOW") {
      parts.push("O gate de aderência permite esta ação.");
    } else if (gateResult.decision === "BLOCK") {
      parts.push("O gate de aderência bloqueou esta ação — a camada cognitiva reconhece o bloqueio e NÃO o sobrepõe.");
    } else if (gateResult.decision === "WARN") {
      parts.push("O gate de aderência emitiu aviso — evidência parcial ou contrato ausente.");
    }
  }

  // Macro objective context from summary
  if (summaryEvidence.macro_objective_match) {
    parts.push(`Ação candidata conversa com o objetivo macro do contrato: "${summaryEvidence.macro_objective}".`);
  } else if (summaryEvidence.macro_objective) {
    parts.push(`Objetivo macro do contrato: "${summaryEvidence.macro_objective}" — sem correspondência direta com a ação candidata.`);
  }

  // Block evidence summary
  if (evidence.hard_rules.length > 0) {
    parts.push(`${evidence.hard_rules.length} regra(s) dura(s) detectada(s) com sobreposição à ação candidata.`);
  }
  if (evidence.approval_points.length > 0) {
    parts.push(`${evidence.approval_points.length} ponto(s) de aprovação contratual relevante(s).`);
  }
  if (evidence.blocking_points.length > 0) {
    parts.push(`${evidence.blocking_points.length} ponto(s) de bloqueio contratual relevante(s).`);
  }

  // Summary-level signals (when blocks are insufficient)
  if (evidence.hard_rules.length === 0 && summaryEvidence.hard_rules_hits.length > 0) {
    parts.push(`${summaryEvidence.hard_rules_hits.length} regra(s) dura(s) detectada(s) via summary_canonic (sem evidência em blocos).`);
  }
  if (evidence.approval_points.length === 0 && summaryEvidence.approval_points_hits.length > 0) {
    parts.push(`${summaryEvidence.approval_points_hits.length} ponto(s) de aprovação detectado(s) via summary_canonic.`);
  }

  // Resolution context quality
  if (resolutionQuality.is_fallback) {
    parts.push("Resolução de blocos usou fallback — interpretação pode estar baseada em blocos menos relevantes.");
  }

  // Ambiguity assessment
  if (ambiguity === AMBIGUITY_LEVEL.CRITICAL) {
    parts.push("Ambiguidade CRÍTICA — conflito explícito detectado. Recomendada confirmação humana obrigatória.");
  } else if (ambiguity === AMBIGUITY_LEVEL.HIGH) {
    parts.push("Ambiguidade ALTA — evidência insuficiente ou conflitante. Confirmação humana recomendada.");
  } else if (ambiguity === AMBIGUITY_LEVEL.MEDIUM) {
    parts.push("Ambiguidade MÉDIA — evidência parcial. Cautela recomendada.");
  } else {
    parts.push("Ambiguidade BAIXA — evidência clara e coerente.");
  }

  // Confidence
  if (confidence < CONFIDENCE_THRESHOLDS.LOW) {
    parts.push("Confiança muito baixa nesta interpretação — base contratual insuficiente.");
  } else if (confidence < CONFIDENCE_THRESHOLDS.MEDIUM) {
    parts.push("Confiança moderada — algumas lacunas na evidência contratual.");
  }

  return parts.join(" ");
}

// ---------------------------------------------------------------------------
// _suggestAction(ambiguity, conflicts, confidence, gateResult)
//
// Suggests next action based on cognitive assessment.
// NEVER overrides gate — only suggests.
// ---------------------------------------------------------------------------
function _suggestAction(ambiguity, conflicts, confidence, gateResult) {
  if (gateResult && gateResult.decision === "BLOCK") {
    return "Respeitar bloqueio do gate de aderência. Revisar ação candidata e resolver conflito contratual antes de prosseguir.";
  }

  if (ambiguity === AMBIGUITY_LEVEL.CRITICAL) {
    return "Solicitar confirmação humana obrigatória antes de qualquer ação. Conflito contratual explícito detectado.";
  }

  if (ambiguity === AMBIGUITY_LEVEL.HIGH) {
    return "Recomendar confirmação humana. Evidência contratual insuficiente ou ambígua para prosseguir com segurança.";
  }

  if (conflicts.length > 0 && ambiguity === AMBIGUITY_LEVEL.MEDIUM) {
    return "Prosseguir com cautela. Verificar pontos de conflito identificados antes de executar.";
  }

  if (confidence >= CONFIDENCE_THRESHOLDS.HIGH && ambiguity === AMBIGUITY_LEVEL.LOW) {
    return "Ação parece alinhada ao contrato. Pode prosseguir dentro dos limites do gate.";
  }

  return "Avaliar evidência contratual antes de prosseguir. Cautela recomendada.";
}

// ---------------------------------------------------------------------------
// _suggestNextStep(ambiguity, conflicts, evidence, gateResult)
//
// Suggests the immediate next step for the orchestrator.
// ---------------------------------------------------------------------------
function _suggestNextStep(ambiguity, conflicts, evidence, gateResult) {
  if (gateResult && gateResult.decision === "BLOCK") {
    return "Resolver conflito contratual apontado pelo gate antes de tentar novamente.";
  }

  if (ambiguity === AMBIGUITY_LEVEL.CRITICAL || ambiguity === AMBIGUITY_LEVEL.HIGH) {
    return "Apresentar interpretação ao operador e aguardar confirmação antes de executar.";
  }

  if (evidence.approval_points.length > 0) {
    return "Verificar se pontos de aprovação contratual foram satisfeitos antes de prosseguir.";
  }

  if (conflicts.length > 0) {
    return "Revisar conflitos apontados e decidir se a ação pode prosseguir com ajustes.";
  }

  return "Prosseguir para execução, respeitando limites do gate de aderência.";
}

// ---------------------------------------------------------------------------
// _shouldRequireHumanConfirmation(ambiguity, conflicts, confidence, gateResult)
//
// Determines if human confirmation should be required.
// ---------------------------------------------------------------------------
function _shouldRequireHumanConfirmation(ambiguity, conflicts, confidence, gateResult) {
  if (gateResult && gateResult.decision === "BLOCK") return true;
  if (gateResult && gateResult.requires_human_approval) return true;
  if (ambiguity === AMBIGUITY_LEVEL.CRITICAL) return true;
  if (ambiguity === AMBIGUITY_LEVEL.HIGH) return true;
  if (conflicts.some(c => c.severity === "critical" || c.severity === "high")) return true;
  if (confidence < CONFIDENCE_THRESHOLDS.LOW) return true;
  return false;
}

// ---------------------------------------------------------------------------
// _extractContractEvidence(evidence, summaryEvidence, resolutionQuality)
//
// Builds auditable contract_evidence array from blocks + summary + resolution.
// ---------------------------------------------------------------------------
function _extractContractEvidence(evidence, summaryEvidence, resolutionQuality) {
  const items = [];

  // Block-level evidence
  for (const hit of evidence.hard_rules) {
    items.push({
      type: "hard_rule",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
      source: "block",
    });
  }
  for (const hit of evidence.approval_points) {
    items.push({
      type: "approval_point",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
      source: "block",
    });
  }
  for (const hit of evidence.blocking_points) {
    items.push({
      type: "blocking_point",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
      source: "block",
    });
  }
  for (const match of evidence.scope_matches) {
    items.push({
      type: "scope_match",
      signal: null,
      block_id: match.block_id,
      heading: match.heading,
      relevance: match.overlap_count >= 3 ? "strong" : "moderate",
      source: "block",
    });
  }

  // Summary-level evidence (when blocks don't cover)
  for (const hit of summaryEvidence.hard_rules_hits) {
    if (!evidence.hard_rules.some(b => b.signal === hit.signal)) {
      items.push({
        type: "hard_rule",
        signal: hit.signal,
        block_id: null,
        heading: null,
        relevance: hit.overlap_count >= 2 ? "strong" : "weak",
        source: "summary",
      });
    }
  }
  for (const hit of summaryEvidence.approval_points_hits) {
    if (!evidence.approval_points.some(b => b.signal === hit.signal)) {
      items.push({
        type: "approval_point",
        signal: hit.signal,
        block_id: null,
        heading: null,
        relevance: hit.overlap_count >= 2 ? "strong" : "weak",
        source: "summary",
      });
    }
  }
  for (const hit of summaryEvidence.blocking_points_hits) {
    if (!evidence.blocking_points.some(b => b.signal === hit.signal)) {
      items.push({
        type: "blocking_point",
        signal: hit.signal,
        block_id: null,
        heading: null,
        relevance: hit.overlap_count >= 2 ? "strong" : "weak",
        source: "summary",
      });
    }
  }

  // Resolution context quality as evidence item (when relevant)
  if (resolutionQuality.has_resolution_ctx) {
    items.push({
      type: "resolution_context",
      signal: `strategy=${resolutionQuality.strategy || "unknown"}, fallback=${resolutionQuality.is_fallback}, matched=${resolutionQuality.matched_count}/${resolutionQuality.total_blocks}`,
      block_id: null,
      heading: null,
      relevance: resolutionQuality.is_weak_resolution ? "weak" : "moderate",
      source: "resolution_ctx",
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// _buildLikelyIntent(candidateAction, evidence, summaryEvidence, ambiguity)
//
// Infers the most likely intent from candidate action and evidence.
// ---------------------------------------------------------------------------
function _buildLikelyIntent(candidateAction, evidence, summaryEvidence, ambiguity) {
  if (!candidateAction || typeof candidateAction !== "object") {
    return "Intenção não identificável — ação candidata ausente.";
  }

  const intent = candidateAction.intent || candidateAction.summary || "";
  if (!intent) {
    return "Intenção não especificada na ação candidata.";
  }

  if (ambiguity === AMBIGUITY_LEVEL.HIGH || ambiguity === AMBIGUITY_LEVEL.CRITICAL) {
    return `Intenção declarada: "${intent}" — porém com ambiguidade ${ambiguity} na interpretação contratual.`;
  }

  if (evidence.scope_matches.length > 0) {
    return `Intenção "${intent}" — com correspondência em ${evidence.scope_matches.length} bloco(s) do contrato.`;
  }

  if (summaryEvidence.macro_objective_match) {
    return `Intenção "${intent}" — alinhada ao objetivo macro do contrato.`;
  }

  return `Intenção declarada: "${intent}".`;
}

// ---------------------------------------------------------------------------
// _buildNotes(params)
//
// Builds array of audit notes from all evidence sources.
// ---------------------------------------------------------------------------
function _buildNotes({
  evidence, summaryEvidence, resolutionQuality, conflicts,
  ambiguity, confidence, gateResult,
}) {
  const notes = [];

  // Block evidence notes
  notes.push(`Blocos relevantes analisados: ${evidence.blocks_with_evidence}.`);
  notes.push(`Sinais contratuais encontrados (blocos): ${evidence.total_signals_found}.`);

  // Summary evidence notes
  notes.push(`Sinais contratuais encontrados (summary): ${summaryEvidence.total_summary_signals}.`);
  if (summaryEvidence.macro_objective) {
    notes.push(`Objetivo macro do contrato: "${summaryEvidence.macro_objective}".`);
  }
  if (summaryEvidence.detected_phases) {
    notes.push(`Fases contratuais detectadas: ${summaryEvidence.detected_phases.join(", ")}.`);
  }
  if (summaryEvidence.macro_objective_match) {
    notes.push("Ação candidata tem correspondência com o objetivo macro.");
  }

  // Resolution context notes
  for (const note of resolutionQuality.quality_notes) {
    notes.push(note);
  }

  // Gate notes
  if (gateResult) {
    notes.push(`Gate de aderência (PR3): decision=${gateResult.decision}, reason_code=${gateResult.reason_code || "N/A"}.`);
  } else {
    notes.push("Gate de aderência (PR3) não fornecido — interpretação baseada apenas em blocos e summary.");
  }

  if (conflicts.length === 0) {
    notes.push("Nenhum conflito contratual percebido.");
  }

  if (ambiguity === AMBIGUITY_LEVEL.LOW && confidence >= CONFIDENCE_THRESHOLDS.HIGH) {
    notes.push("Interpretação de alta confiança baseada em evidência contratual clara.");
  }

  if (confidence < CONFIDENCE_THRESHOLDS.LOW) {
    notes.push("AVISO: Confiança muito baixa — base contratual insuficiente para interpretação segura.");
  }

  return notes;
}

// ---------------------------------------------------------------------------
// _buildPossibleReadings(params)
//
// Builds possible_readings array: primary reading + alternatives when
// there is partial evidence supporting more than one interpretation.
//
// Only exposes alternative readings when there is real contractual
// basis — never invents interpretations without evidence.
//
// Each reading: { summary, basis, confidence_hint, source }
// ---------------------------------------------------------------------------
function _buildPossibleReadings({
  evidence, summaryEvidence, resolutionQuality, conflicts,
  ambiguity, confidence, gateResult, candidateAction, actionSummary,
}) {
  const readings = [];

  // ─── Primary reading ────────────────────────────────────────────────
  const primaryParts = [];
  let primarySource = "block";
  let primaryConfidence = confidence >= CONFIDENCE_THRESHOLDS.HIGH ? "alta"
    : confidence >= CONFIDENCE_THRESHOLDS.MEDIUM ? "média"
    : confidence >= CONFIDENCE_THRESHOLDS.LOW ? "baixa" : "muito_baixa";

  if (gateResult && gateResult.decision === "BLOCK") {
    primaryParts.push("Gate de aderência bloqueou a ação.");
    primarySource = "gate";
  } else if (gateResult && gateResult.decision === "ALLOW" && ambiguity === AMBIGUITY_LEVEL.LOW) {
    primaryParts.push("Ação aderente ao contrato segundo o gate e evidência disponível.");
  } else if (ambiguity === AMBIGUITY_LEVEL.HIGH || ambiguity === AMBIGUITY_LEVEL.CRITICAL) {
    primaryParts.push("Evidência contratual insuficiente ou conflitante para interpretação segura.");
  } else {
    primaryParts.push("Ação parcialmente alinhada ao contrato com base na evidência disponível.");
  }

  if (summaryEvidence.macro_objective_match) {
    primaryParts.push(`Conversa com objetivo macro: "${summaryEvidence.macro_objective}".`);
  }

  readings.push({
    summary: primaryParts.join(" "),
    basis: _describePrimaryBasis(evidence, summaryEvidence, gateResult),
    confidence_hint: primaryConfidence,
    source: primarySource,
  });

  // ─── Alternative readings (only when real evidence supports them) ──
  // Alt 1: If hard rules from summary conflict but blocks don't show it
  if (evidence.hard_rules.length === 0 && summaryEvidence.hard_rules_hits.length > 0) {
    readings.push({
      summary: `Leitura alternativa: summary_canonic indica regra(s) dura(s) que podem conflitar — "${summaryEvidence.hard_rules_hits[0].signal}".`,
      basis: `Baseada em ${summaryEvidence.hard_rules_hits.length} sinal(is) de hard_rules no summary, sem evidência correspondente nos blocos selecionados.`,
      confidence_hint: "baixa",
      source: "summary",
    });
  }

  // Alt 2: If approval points detected but gate allowed
  if (gateResult && gateResult.decision === "ALLOW" &&
      (evidence.approval_points.length > 0 || summaryEvidence.approval_points_hits.length > 0)) {
    const approvalSignal = evidence.approval_points.length > 0
      ? evidence.approval_points[0].signal
      : summaryEvidence.approval_points_hits[0].signal;
    readings.push({
      summary: `Leitura alternativa: ponto de aprovação contratual detectado ("${approvalSignal}") — gate permitiu, mas aprovação formal pode ainda ser necessária.`,
      basis: `Sinal de approval_point com sobreposição à ação, mesmo com gate ALLOW.`,
      confidence_hint: "média",
      source: evidence.approval_points.length > 0 ? "block" : "summary",
    });
  }

  // Alt 3: If resolution used fallback
  if (resolutionQuality.is_fallback && evidence.total_signals_found > 0) {
    readings.push({
      summary: "Leitura alternativa: blocos foram selecionados por fallback — sinais encontrados podem não ser os mais relevantes para esta ação.",
      basis: `Resolução usou fallback. ${resolutionQuality.matched_count}/${resolutionQuality.total_blocks} blocos selecionados.`,
      confidence_hint: "baixa",
      source: "resolution_ctx",
    });
  }

  // Alt 4: Conflicting signals between block evidence and gate
  if (gateResult && gateResult.decision === "ALLOW" &&
      conflicts.some(c => c.severity === "high" && c.source === "block")) {
    readings.push({
      summary: "Leitura alternativa: gate permitiu, mas evidência de blocos sugere possível conflito — pode haver desalinhamento entre gate e contrato detalhado.",
      basis: `Conflito de severidade alta em blocos + gate ALLOW.`,
      confidence_hint: "média",
      source: "block",
    });
  }

  return readings;
}

// ---------------------------------------------------------------------------
// _describePrimaryBasis — summarizes what the primary reading is based on
// ---------------------------------------------------------------------------
function _describePrimaryBasis(evidence, summaryEvidence, gateResult) {
  const sources = [];
  if (evidence.total_signals_found > 0) sources.push(`${evidence.total_signals_found} sinal(is) de blocos`);
  if (summaryEvidence.total_summary_signals > 0) sources.push(`${summaryEvidence.total_summary_signals} sinal(is) de summary`);
  if (gateResult) sources.push(`gate: ${gateResult.decision}`);
  return sources.length > 0 ? sources.join(", ") + "." : "Sem base contratual identificada.";
}

// ===========================================================================
// PUBLIC API
// ===========================================================================

// ---------------------------------------------------------------------------
// analyzeContractContextCognitively(input)
//
// Função canônica de análise cognitiva consultiva.
// Recebe contexto completo e devolve interpretação estruturada.
//
// ESTA FUNÇÃO É CONSULTIVA — NÃO AUTORIZA NEM BLOQUEIA SOZINHA.
//
// Parâmetros (input):
//   scope              {string}   — escopo do contrato (default: "default")
//   contractContext    {object}   — resultado de getActiveContractContext (PR2)
//     .contract_id     {string}
//     .active_state    {object}
//     .summary         {object}   — summary_canonic
//     .resolution_ctx  {object}
//     .ready_for_pr3   {boolean}
//   candidateAction    {object}   — ação/intenção candidata
//   relevantBlocks     {Array}    — blocos já resolvidos ou []
//   adherenceResult    {object?}  — resultado do gate PR3, se disponível
//
// Retorna (CognitiveAdvisoryResult):
//   {
//     ok                          {boolean}
//     interpretation_summary      {string}
//     likely_intent               {string}
//     ambiguity_level             {string} — "low"|"medium"|"high"|"critical"
//     confidence                  {number} — 0.0-1.0
//     perceived_conflicts         {Array}
//     suggested_action            {string}
//     suggested_next_step         {string}
//     requires_human_confirmation {boolean}
//     contract_evidence           {Array}
//     possible_readings           {Array}
//     notes                       {Array<string>}
//   }
// ---------------------------------------------------------------------------
function analyzeContractContextCognitively(input) {
  const safeInput = input && typeof input === "object" ? input : {};
  const scope = safeInput.scope || "default";
  const contractContext = safeInput.contractContext || null;
  const candidateAction = safeInput.candidateAction || null;
  const relevantBlocks = Array.isArray(safeInput.relevantBlocks) ? safeInput.relevantBlocks : [];
  const gateResult = safeInput.adherenceResult || null;

  // --- Guard: no contract context ---
  if (!contractContext || !contractContext.contract_id) {
    const emptySummaryEv = _assessSummaryEvidence(null, "");
    return {
      ok: false,
      interpretation_summary: "Contrato ativo ausente — não é possível realizar interpretação cognitiva.",
      likely_intent: _buildLikelyIntent(candidateAction, _assessBlockEvidence([], ""), emptySummaryEv, AMBIGUITY_LEVEL.HIGH),
      ambiguity_level: AMBIGUITY_LEVEL.HIGH,
      confidence: 0.1,
      perceived_conflicts: [],
      suggested_action: "Ativar contrato antes de solicitar interpretação cognitiva.",
      suggested_next_step: "Ingerir e ativar contrato via PR1/PR2 antes de prosseguir.",
      requires_human_confirmation: true,
      contract_evidence: [],
      possible_readings: [],
      notes: ["Contrato ativo ausente.", `Scope: ${scope}.`],
    };
  }

  // --- Extract data from contractContext ---
  const summary = contractContext.summary || null;
  const resolutionCtx = contractContext.resolution_ctx || null;

  // --- Build action summary for matching ---
  const actionSummary = _buildActionSummary(candidateAction);

  // --- Assess block evidence (primary source) ---
  const evidence = _assessBlockEvidence(relevantBlocks, actionSummary);

  // --- Assess summary evidence (contextual support + fallback) ---
  const summaryEvidence = _assessSummaryEvidence(summary, actionSummary);

  // --- Assess resolution context quality ---
  const resolutionQuality = _assessResolutionCtxQuality(resolutionCtx);

  // --- Detect conflicts (blocks + summary + gate) ---
  const conflicts = _detectConflicts(evidence, summaryEvidence, gateResult);

  // --- Assess ambiguity (all sources) ---
  const ambiguity = _assessAmbiguity({
    evidence, summaryEvidence, resolutionQuality, conflicts,
    relevantBlocks, actionSummary, gateResult, candidateAction,
  });

  // --- Assess confidence (all sources) ---
  const confidence = _assessConfidence({
    evidence, summaryEvidence, resolutionQuality, conflicts,
    relevantBlocks, ambiguityLevel: ambiguity, gateResult, candidateAction, actionSummary,
  });

  // --- Build outputs ---
  const interpretation = _buildInterpretation({
    evidence, summaryEvidence, resolutionQuality, conflicts,
    ambiguity, confidence, gateResult,
  });
  const likelyIntent = _buildLikelyIntent(candidateAction, evidence, summaryEvidence, ambiguity);
  const suggestedAction = _suggestAction(ambiguity, conflicts, confidence, gateResult);
  const suggestedNextStep = _suggestNextStep(ambiguity, conflicts, evidence, gateResult);
  const requiresHumanConfirmation = _shouldRequireHumanConfirmation(ambiguity, conflicts, confidence, gateResult);
  const contractEvidence = _extractContractEvidence(evidence, summaryEvidence, resolutionQuality);
  const notes = _buildNotes({
    evidence, summaryEvidence, resolutionQuality, conflicts,
    ambiguity, confidence, gateResult,
  });
  const possibleReadings = _buildPossibleReadings({
    evidence, summaryEvidence, resolutionQuality, conflicts,
    ambiguity, confidence, gateResult, candidateAction, actionSummary,
  });

  return {
    ok: true,
    interpretation_summary: interpretation,
    likely_intent: likelyIntent,
    ambiguity_level: ambiguity,
    confidence,
    perceived_conflicts: conflicts,
    suggested_action: suggestedAction,
    suggested_next_step: suggestedNextStep,
    requires_human_confirmation: requiresHumanConfirmation,
    contract_evidence: contractEvidence,
    possible_readings: possibleReadings,
    notes,
  };
}

// ---------------------------------------------------------------------------
// runContractCognitiveAdvisor(env, scope, candidateAction, opts)
//
// Runtime helper que resolve contexto real (PR2) + gate (PR3 opcional)
// e chama analyzeContractContextCognitively.
//
// Parâmetros:
//   env              {object} — env com ENAVIA_BRAIN KV binding
//   scope            {string} — escopo do contrato
//   candidateAction  {object} — ação/intenção candidata
//   opts             {object?} — opções adicionais:
//     .adherenceResult  {object?} — resultado do gate PR3 já calculado
//     .relevantBlocks   {Array?}  — blocos já resolvidos (evita re-resolução)
//
// Retorna: CognitiveAdvisoryResult (mesma shape de analyzeContractContextCognitively)
// ---------------------------------------------------------------------------
async function runContractCognitiveAdvisor(env, scope, candidateAction, opts) {
  const effectiveScope = scope || "default";
  const options = opts && typeof opts === "object" ? opts : {};

  // Step 1: Get active contract context (PR2)
  const contractContext = await getActiveContractContext(env, { scope: effectiveScope });

  if (!contractContext || !contractContext.ok || !contractContext.contract_id) {
    return analyzeContractContextCognitively({
      scope: effectiveScope,
      contractContext: null,
      candidateAction,
      relevantBlocks: [],
      adherenceResult: options.adherenceResult || null,
    });
  }

  // Step 2: Resolve relevant blocks (PR2) — use pre-resolved if available
  let relevantBlocks = [];
  if (Array.isArray(options.relevantBlocks) && options.relevantBlocks.length > 0) {
    relevantBlocks = options.relevantBlocks;
  } else if (contractContext.contract_id) {
    const action = candidateAction || {};
    const resolution = await resolveRelevantContractBlocks(
      env,
      contractContext.contract_id,
      {
        phase: action.phase || null,
        intent: action.intent || null,
        taskId: action.task_id || null,
        scope: effectiveScope,
      }
    );
    if (resolution && resolution.ok && resolution.blocks) {
      relevantBlocks = resolution.blocks;
    }
  }

  // Step 3: Run cognitive analysis
  return analyzeContractContextCognitively({
    scope: effectiveScope,
    contractContext,
    candidateAction,
    relevantBlocks,
    adherenceResult: options.adherenceResult || null,
  });
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core cognitive analysis (pure function)
  analyzeContractContextCognitively,

  // Runtime helper (async, uses PR2)
  runContractCognitiveAdvisor,

  // Enums
  AMBIGUITY_LEVEL,
  CONFIDENCE_THRESHOLDS,
};
