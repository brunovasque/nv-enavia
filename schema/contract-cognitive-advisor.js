// ============================================================================
// 🧠 ENAVIA — Contract Cognitive Advisor (PR5)
//
// Camada cognitiva consultiva sobre contrato ativo.
// Lê contrato ativo + blocos relevantes + contexto atual + resultado do gate,
// interpreta ambiguidades e conflitos aparentes, e devolve saída estruturada
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
// Usa:
//   - getActiveContractContext (PR2) — contrato ativo + summary_canonic
//   - resolveRelevantContractBlocks (PR2) — blocos relevantes
//   - evaluateContractAdherence (PR3) — resultado do gate, quando disponível
//   - resolution_ctx (PR2) — contexto de resolução
//   - candidateAction — ação/intenção candidata
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
// _detectConflicts(evidence, gateResult)
//
// Detects perceived conflicts from block evidence and gate result.
// Returns array of conflict descriptions.
// ---------------------------------------------------------------------------
function _detectConflicts(evidence, gateResult) {
  const conflicts = [];

  // Conflict: hard rule signal overlaps with the candidate action
  for (const hit of evidence.hard_rules) {
    if (hit.overlap_count >= 2) {
      conflicts.push({
        type: "hard_rule_conflict",
        severity: "high",
        description: `Ação candidata tem sobreposição forte com regra dura do contrato no bloco ${hit.block_id}: "${hit.signal}"`,
        block_id: hit.block_id,
        evidence: hit.overlap_keywords,
      });
    }
  }

  // Conflict: blocking point matches
  for (const hit of evidence.blocking_points) {
    if (hit.overlap_count >= 2) {
      conflicts.push({
        type: "blocking_point_conflict",
        severity: "high",
        description: `Ponto de bloqueio contratual pode afetar ação no bloco ${hit.block_id}: "${hit.signal}"`,
        block_id: hit.block_id,
        evidence: hit.overlap_keywords,
      });
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
    });
  }

  // Conflict: approval required — only flag as conflict when the candidate
  // action is NOT already allowed by the gate and the overlap is strong.
  // Weak overlap with approval points is noted but not a conflict.
  for (const hit of evidence.approval_points) {
    if (hit.overlap_count >= 2) {
      // Only treat as conflict if gate didn't already ALLOW
      if (!gateResult || gateResult.decision !== "ALLOW") {
        conflicts.push({
          type: "approval_required",
          severity: "medium",
          description: `Ponto de aprovação contratual detectado no bloco ${hit.block_id}: "${hit.signal}" — pode exigir confirmação humana`,
          block_id: hit.block_id,
          evidence: hit.overlap_keywords,
        });
      }
    }
  }

  return conflicts;
}

// ---------------------------------------------------------------------------
// _assessAmbiguity(evidence, conflicts, relevantBlocks, actionSummary, gateResult)
//
// Determines ambiguity level based on evidence quality and conflicts.
// Gate ALLOW with no conflicts = strong signal of low ambiguity.
// ---------------------------------------------------------------------------
function _assessAmbiguity(evidence, conflicts, relevantBlocks, actionSummary, gateResult) {
  const hasBlocks = relevantBlocks && relevantBlocks.length > 0;
  const hasStrongEvidence = evidence.total_signals_found >= 2;
  const hasCriticalConflict = conflicts.some(c => c.severity === "critical");
  const hasHighConflict = conflicts.some(c => c.severity === "high");
  const hasAction = actionSummary && actionSummary.trim().length > 0;
  const hasMultipleReadings = conflicts.length > 0 && evidence.scope_matches.length > 0;
  const gateAllowed = gateResult && gateResult.decision === "ALLOW" && (!gateResult.violations || gateResult.violations.length === 0);

  // Critical: gate already blocked + we have conflicting evidence
  if (hasCriticalConflict) return AMBIGUITY_LEVEL.CRITICAL;

  // High: multiple conflicts or very little evidence with action present
  if (hasHighConflict && !hasStrongEvidence) return AMBIGUITY_LEVEL.HIGH;
  if (!hasBlocks && hasAction && !gateAllowed) return AMBIGUITY_LEVEL.HIGH;
  if (hasMultipleReadings && hasHighConflict) return AMBIGUITY_LEVEL.HIGH;

  // Medium: some conflicts or partial evidence
  if (conflicts.length > 0) return AMBIGUITY_LEVEL.MEDIUM;
  // When gate ALLOW + blocks present + no conflicts → low ambiguity even without strong signals
  if (hasAction && !hasStrongEvidence && hasBlocks && !gateAllowed) return AMBIGUITY_LEVEL.MEDIUM;

  // Low: clear evidence, no conflicts (or gate ALLOW)
  return AMBIGUITY_LEVEL.LOW;
}

// ---------------------------------------------------------------------------
// _assessConfidence(evidence, conflicts, relevantBlocks, ambiguityLevel)
//
// Calculates a confidence score (0.0 - 1.0) for the interpretation.
// ---------------------------------------------------------------------------
function _assessConfidence(evidence, conflicts, relevantBlocks, ambiguityLevel) {
  let score = 0.5; // base

  // Boost for evidence
  if (relevantBlocks && relevantBlocks.length > 0) score += 0.1;
  if (evidence.total_signals_found >= 2) score += 0.15;
  if (evidence.scope_matches.length >= 2) score += 0.1;
  if (evidence.blocks_with_evidence >= 2) score += 0.05;

  // Penalty for conflicts and ambiguity
  if (conflicts.length > 0) score -= 0.1 * Math.min(conflicts.length, 3);
  if (ambiguityLevel === AMBIGUITY_LEVEL.CRITICAL) score -= 0.3;
  else if (ambiguityLevel === AMBIGUITY_LEVEL.HIGH) score -= 0.2;
  else if (ambiguityLevel === AMBIGUITY_LEVEL.MEDIUM) score -= 0.1;

  // Clamp
  return Math.round(Math.max(0.0, Math.min(1.0, score)) * 100) / 100;
}

// ---------------------------------------------------------------------------
// _buildInterpretation(evidence, conflicts, ambiguity, confidence, gateResult)
//
// Produces a human-readable interpretation summary.
// ---------------------------------------------------------------------------
function _buildInterpretation(evidence, conflicts, ambiguity, confidence, gateResult) {
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

  // Evidence summary
  if (evidence.hard_rules.length > 0) {
    parts.push(`${evidence.hard_rules.length} regra(s) dura(s) detectada(s) com sobreposição à ação candidata.`);
  }
  if (evidence.approval_points.length > 0) {
    parts.push(`${evidence.approval_points.length} ponto(s) de aprovação contratual relevante(s).`);
  }
  if (evidence.blocking_points.length > 0) {
    parts.push(`${evidence.blocking_points.length} ponto(s) de bloqueio contratual relevante(s).`);
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
  // If gate blocked, cognitive layer respects it
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
// _extractContractEvidence(evidence, conflicts)
//
// Builds auditable contract_evidence array.
// ---------------------------------------------------------------------------
function _extractContractEvidence(evidence, conflicts) {
  const items = [];

  for (const hit of evidence.hard_rules) {
    items.push({
      type: "hard_rule",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
    });
  }

  for (const hit of evidence.approval_points) {
    items.push({
      type: "approval_point",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
    });
  }

  for (const hit of evidence.blocking_points) {
    items.push({
      type: "blocking_point",
      signal: hit.signal,
      block_id: hit.block_id,
      heading: hit.heading,
      relevance: hit.overlap_count >= 2 ? "strong" : "weak",
    });
  }

  for (const match of evidence.scope_matches) {
    items.push({
      type: "scope_match",
      signal: null,
      block_id: match.block_id,
      heading: match.heading,
      relevance: match.overlap_count >= 3 ? "strong" : "moderate",
    });
  }

  return items;
}

// ---------------------------------------------------------------------------
// _buildLikelyIntent(candidateAction, evidence, ambiguity)
//
// Infers the most likely intent from candidate action and evidence.
// ---------------------------------------------------------------------------
function _buildLikelyIntent(candidateAction, evidence, ambiguity) {
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

  return `Intenção declarada: "${intent}".`;
}

// ---------------------------------------------------------------------------
// _buildNotes(evidence, conflicts, ambiguity, confidence, gateResult)
//
// Builds array of audit notes.
// ---------------------------------------------------------------------------
function _buildNotes(evidence, conflicts, ambiguity, confidence, gateResult) {
  const notes = [];

  notes.push(`Blocos relevantes analisados: ${evidence.blocks_with_evidence}.`);
  notes.push(`Sinais contratuais encontrados: ${evidence.total_signals_found}.`);

  if (gateResult) {
    notes.push(`Gate de aderência (PR3): decision=${gateResult.decision}, reason_code=${gateResult.reason_code || "N/A"}.`);
  } else {
    notes.push("Gate de aderência (PR3) não fornecido — interpretação baseada apenas em blocos.");
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
//   candidateAction    {object}   — ação/intenção candidata:
//     .intent          {string}   — intenção declarada
//     .action_type     {string}   — tipo de ação (ex: "deploy", "implement")
//     .target          {string}   — alvo da ação
//     .summary         {string}   — resumo textual
//     .phase           {string}   — fase contratual
//     .task            {string}   — tarefa
//     .task_id         {string}   — ID da tarefa
//   relevantBlocks     {Array}    — blocos já resolvidos ou [] para resolver
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
    return {
      ok: false,
      interpretation_summary: "Contrato ativo ausente — não é possível realizar interpretação cognitiva.",
      likely_intent: _buildLikelyIntent(candidateAction, _assessBlockEvidence([], ""), AMBIGUITY_LEVEL.HIGH),
      ambiguity_level: AMBIGUITY_LEVEL.HIGH,
      confidence: 0.1,
      perceived_conflicts: [],
      suggested_action: "Ativar contrato antes de solicitar interpretação cognitiva.",
      suggested_next_step: "Ingerir e ativar contrato via PR1/PR2 antes de prosseguir.",
      requires_human_confirmation: true,
      contract_evidence: [],
      notes: ["Contrato ativo ausente.", `Scope: ${scope}.`],
    };
  }

  // --- Build action summary for matching ---
  const actionSummary = _buildActionSummary(candidateAction);

  // --- Assess block evidence ---
  const evidence = _assessBlockEvidence(relevantBlocks, actionSummary);

  // --- Detect conflicts ---
  const conflicts = _detectConflicts(evidence, gateResult);

  // --- Assess ambiguity ---
  const ambiguity = _assessAmbiguity(evidence, conflicts, relevantBlocks, actionSummary, gateResult);

  // --- Assess confidence ---
  const confidence = _assessConfidence(evidence, conflicts, relevantBlocks, ambiguity);

  // --- Build outputs ---
  const interpretation = _buildInterpretation(evidence, conflicts, ambiguity, confidence, gateResult);
  const likelyIntent = _buildLikelyIntent(candidateAction, evidence, ambiguity);
  const suggestedAction = _suggestAction(ambiguity, conflicts, confidence, gateResult);
  const suggestedNextStep = _suggestNextStep(ambiguity, conflicts, evidence, gateResult);
  const requiresHumanConfirmation = _shouldRequireHumanConfirmation(ambiguity, conflicts, confidence, gateResult);
  const contractEvidence = _extractContractEvidence(evidence, conflicts);
  const notes = _buildNotes(evidence, conflicts, ambiguity, confidence, gateResult);

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
