// ============================================================================
// 📦 ENAVIA — Planner Output Modes v1 (PM5 — Planner Output Modes)
//
// Define o modo de saída e o envelope proporcional ao nível classificado
// pela PM4 (planner-classifier.js).
//
// Responsabilidades:
//   - selectOutputMode(classification) — escolhe o modo de saída pelo nível
//   - buildOutputEnvelope(classification, input) — monta envelope proporcional
//
// Saída de selectOutputMode:
//   "quick_reply"      — para nível A / simple
//   "tactical_plan"    — para nível B / tactical
//   "formal_contract"  — para nível C / complex
//
// Saída de buildOutputEnvelope:
//   Envelope proporcional ao nível classificado:
//   A → shape enxuto (objective + next_steps)
//   B → shape tático (objective + scope + main_steps + risks + acceptance_criteria)
//   C → shape formal (objective + macro_scope + fronts + risks +
//                     needs_formal_contract + needs_human_approval)
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - plan builder profundo (PM6)
//   - gate humano real (PM7)
//   - bridge com executor (PM8)
//   - learning loop (PM9)
//   - painel / PROD / executor contratual
//
// PM5 APENAS — não misturar com PM6+.
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMS públicos — modos de saída canônicos
// ---------------------------------------------------------------------------
const OUTPUT_MODES = {
  QUICK_REPLY:     "quick_reply",
  TACTICAL_PLAN:   "tactical_plan",
  FORMAL_CONTRACT: "formal_contract",
};

// ---------------------------------------------------------------------------
// Mapeamento determinístico de nível → output mode
//
// Mapeado diretamente pelo campo complexity_level da saída PM4.
// category é usado como verificação redundante para auditabilidade.
// ---------------------------------------------------------------------------
const LEVEL_TO_OUTPUT_MODE = {
  A: OUTPUT_MODES.QUICK_REPLY,
  B: OUTPUT_MODES.TACTICAL_PLAN,
  C: OUTPUT_MODES.FORMAL_CONTRACT,
};

// ---------------------------------------------------------------------------
// selectOutputMode(classification)
//
// Recebe a classificação da PM4 e retorna o output mode canônico.
//
// Parâmetros:
//   classification {object} — saída canônica do classifyRequest (PM4):
//     complexity_level {string} — "A" | "B" | "C"  (obrigatório)
//     category         {string} — "simple" | "tactical" | "complex" (opcional)
//
// Retorna:
//   {string} — "quick_reply" | "tactical_plan" | "formal_contract"
//
// Lança:
//   Error — se complexity_level ausente ou fora do conjunto A/B/C
// ---------------------------------------------------------------------------
function selectOutputMode(classification) {
  if (!classification || typeof classification.complexity_level !== "string") {
    throw new Error(
      "selectOutputMode: 'classification.complexity_level' é obrigatório e deve ser string"
    );
  }

  const level = classification.complexity_level.toUpperCase();
  const mode  = LEVEL_TO_OUTPUT_MODE[level];

  if (!mode) {
    throw new Error(
      `selectOutputMode: complexity_level inválido '${classification.complexity_level}'. Esperado: A, B ou C`
    );
  }

  return mode;
}

// ---------------------------------------------------------------------------
// buildOutputEnvelope(classification, input)
//
// Monta o envelope de saída proporcional ao nível classificado pela PM4.
// Cada nível recebe um shape distinto — pedido simples não recebe saída
// pesada; pedido complexo recebe estrutura formal.
//
// Parâmetros:
//   classification {object} — saída canônica do classifyRequest (PM4):
//     complexity_level     {string}  — "A" | "B" | "C"  (obrigatório)
//     category             {string}  — "simple" | "tactical" | "complex"
//     risk_level           {string}  — "baixo" | "médio" | "alto"
//     needs_human_approval {boolean} — true se gate humano necessário
//     reason               {string}  — razão auditável da classificação
//   input {object} — pedido original (opcional, enriquece o envelope):
//     text {string} — texto do pedido original
//
// Retorna:
//   Envelope proporcional ao nível:
//
//   A → {
//     output_mode: "quick_reply",
//     level:       "A",
//     objective:   string,
//     next_steps:  string[]   // mínimo: 1–3 passos curtos
//   }
//
//   B → {
//     output_mode:          "tactical_plan",
//     level:                "B",
//     objective:            string,
//     scope:                string,
//     main_steps:           string[],
//     risks:                string[],
//     acceptance_criteria:  string[]
//   }
//
//   C → {
//     output_mode:           "formal_contract",
//     level:                 "C",
//     objective:             string,
//     macro_scope:           string,
//     fronts:                string[],
//     risks:                 string[],
//     needs_formal_contract: true,
//     needs_human_approval:  true
//   }
//
// Lança:
//   Error — se complexity_level inválido
// ---------------------------------------------------------------------------
function buildOutputEnvelope(classification, input) {
  const output_mode = selectOutputMode(classification); // valida classification

  const level       = classification.complexity_level.toUpperCase();
  const risk_level  = classification.risk_level  || "desconhecido";
  const reason      = classification.reason      || "";
  const input_text  = (input && typeof input.text === "string") ? input.text : "";

  switch (output_mode) {
    case OUTPUT_MODES.QUICK_REPLY:
      return _buildLevelA(level, input_text, reason);

    case OUTPUT_MODES.TACTICAL_PLAN:
      return _buildLevelB(level, input_text, risk_level, reason);

    case OUTPUT_MODES.FORMAL_CONTRACT:
      return _buildLevelC(level, input_text, risk_level, reason);

    default:
      // Nunca deve chegar aqui — selectOutputMode já valida
      throw new Error(`buildOutputEnvelope: output_mode inesperado '${output_mode}'`);
  }
}

// ---------------------------------------------------------------------------
// _buildLevelA(level, input_text, reason)
//
// Envelope para pedidos simples (Nível A — quick_reply).
// Shape enxuto: objetivo + próximos passos mínimos.
// ---------------------------------------------------------------------------
function _buildLevelA(level, input_text, reason) {
  return {
    output_mode: OUTPUT_MODES.QUICK_REPLY,
    level,
    objective:   _summarizeObjective(input_text, reason),
    next_steps:  [
      "Avaliar o pedido e responder diretamente",
      "Confirmar conclusão com o solicitante",
    ],
  };
}

// ---------------------------------------------------------------------------
// _buildLevelB(level, input_text, risk_level, reason)
//
// Envelope para pedidos táticos (Nível B — tactical_plan).
// Shape tático: objetivo + escopo + etapas + riscos + critérios de aceite.
// ---------------------------------------------------------------------------
function _buildLevelB(level, input_text, risk_level, reason) {
  return {
    output_mode:         OUTPUT_MODES.TACTICAL_PLAN,
    level,
    objective:           _summarizeObjective(input_text, reason),
    scope:               "Escopo tático a detalhar na execução (PM6)",
    main_steps:          [
      "Decompor pedido em etapas executáveis",
      "Validar dependências e recursos necessários",
      "Executar e monitorar cada etapa",
    ],
    risks:               [
      `Nível de risco detectado: ${risk_level}`,
      "Verificar dependências antes de iniciar",
    ],
    acceptance_criteria: [
      "Todas as etapas concluídas conforme escopo",
      "Entregáveis validados pelo solicitante",
    ],
  };
}

// ---------------------------------------------------------------------------
// _buildLevelC(level, input_text, risk_level, reason)
//
// Envelope para pedidos complexos (Nível C — formal_contract).
// Shape formal: objetivo + escopo macro + frentes + riscos +
//               flag de contrato formal + flag de aprovação humana.
// ---------------------------------------------------------------------------
function _buildLevelC(level, input_text, risk_level, reason) {
  return {
    output_mode:           OUTPUT_MODES.FORMAL_CONTRACT,
    level,
    objective:             _summarizeObjective(input_text, reason),
    macro_scope:           "Escopo macro a definir no contrato formal (PM6)",
    fronts:                [
      "Frente 1: diagnóstico e levantamento de requisitos",
      "Frente 2: planejamento e decomposição por etapas",
      "Frente 3: execução supervisionada e validação",
    ],
    risks:                 [
      `Nível de risco detectado: ${risk_level}`,
      "Impacto potencialmente irreversível — requer validação humana",
      "Verificar compliance e critérios regulatórios antes de prosseguir",
    ],
    needs_formal_contract: true,
    needs_human_approval:  true,
  };
}

// ---------------------------------------------------------------------------
// _summarizeObjective(input_text, reason)
//
// Extrai ou sintetiza o objetivo a partir do texto do pedido ou da razão
// da classificação. Puro e determinístico.
// ---------------------------------------------------------------------------
function _summarizeObjective(input_text, reason) {
  if (input_text && input_text.trim().length > 0) {
    // Retorna o trecho inicial do texto — até 120 caracteres
    const trimmed = input_text.trim();
    return trimmed.length <= 120 ? trimmed : trimmed.slice(0, 117) + "...";
  }
  // Fallback: usa a reason da PM4 como contexto
  return reason && reason.length > 0 ? reason : "Objetivo a definir";
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  selectOutputMode,
  buildOutputEnvelope,
  OUTPUT_MODES,
  LEVEL_TO_OUTPUT_MODE,
};
