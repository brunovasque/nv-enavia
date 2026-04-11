// ============================================================================
// 📦 ENAVIA — Planner Canonical Plan Builder v1 (PM6 — Canonical Plan Builder)
//
// Monta o plano canônico proporcional ao nível classificado, usando
// a classificação da PM4 e o envelope da PM5 como base.
//
// Responsabilidades:
//   - buildCanonicalPlan({ classification, envelope, input })
//
// Saída canônica mínima:
//   plan_version         — string (fixo "1.0")
//   plan_type            — espelha output_mode do envelope (PM5)
//   complexity_level     — "A" | "B" | "C" (da classificação PM4)
//   output_mode          — espelha plan_type (mantidos alinhados)
//   objective            — vem do envelope.objective (PM5)
//   scope_summary        — curto e proporcional ao nível
//   steps[]              — explícitos e proporcionais: curto (A), tático (B), macro (C)
//   risks[]              — proporcionais ao nível
//   acceptance_criteria[]— proporcionais ao nível
//   needs_human_approval — boolean (da classificação PM4)
//   next_action          — A: ação direta | B: revisar etapas | C: aprovação formal
//   reason               — vem de classification.reason (PM4)
//
// Regras por nível:
//   A (simple)   — plano curto: 1–3 steps, aceite simples, next_action direto
//   B (tactical) — plano tático: 3–5 steps, dependências, aceite intermediário
//   C (complex)  — plano formal: macro-etapas/frentes, needs_human_approval=true,
//                  next_action aponta para revisão/aprovação humana
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - gate humano real (PM7)
//   - bridge com executor (PM8)
//   - learning loop (PM9)
//   - painel / PROD / executor contratual
//
// PM6 APENAS — não misturar com PM7+.
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMS públicos
// ---------------------------------------------------------------------------
const PLAN_VERSION = "1.0";

const PLAN_TYPES = {
  QUICK_REPLY:     "quick_reply",
  TACTICAL_PLAN:   "tactical_plan",
  FORMAL_CONTRACT: "formal_contract",
};

// Mapeamento determinístico: complexity_level → plan_type
// Mantido alinhado com OUTPUT_MODES da PM5 para evitar drift de contrato.
const LEVEL_TO_PLAN_TYPE = {
  A: PLAN_TYPES.QUICK_REPLY,
  B: PLAN_TYPES.TACTICAL_PLAN,
  C: PLAN_TYPES.FORMAL_CONTRACT,
};

// ---------------------------------------------------------------------------
// buildCanonicalPlan({ classification, envelope, input })
//
// Builder público e determinístico do plano canônico.
//
// Parâmetros:
//   classification {object} — saída canônica do classifyRequest (PM4):
//     complexity_level     {string}  — "A" | "B" | "C"  (obrigatório)
//     risk_level           {string}  — "baixo" | "médio" | "alto"
//     needs_human_approval {boolean}  — (opcional) se ausente, assume true para C e false para A/B
//     reason               {string}
//   envelope {object} — saída canônica do buildOutputEnvelope (PM5):
//     output_mode {string}  — "quick_reply" | "tactical_plan" | "formal_contract"
//     objective   {string}  — objetivo extraído do pedido
//   input {object} — pedido original (opcional):
//     text {string}
//
// Retorna:
//   {
//     plan_version,
//     plan_type,
//     complexity_level,
//     output_mode,
//     objective,
//     scope_summary,
//     steps,
//     risks,
//     acceptance_criteria,
//     needs_human_approval,
//     next_action,
//     reason,
//   }
//
// Lança:
//   Error — se classification ou complexity_level ausente/inválido
//   Error — se envelope ausente ou sem output_mode
// ---------------------------------------------------------------------------
function buildCanonicalPlan({ classification, envelope, input } = {}) {
  // --- Validação de entrada ---
  if (!classification || typeof classification.complexity_level !== "string") {
    throw new Error(
      "buildCanonicalPlan: 'classification.complexity_level' é obrigatório e deve ser string"
    );
  }

  const level = classification.complexity_level.toUpperCase();
  const plan_type = LEVEL_TO_PLAN_TYPE[level];

  if (!plan_type) {
    throw new Error(
      `buildCanonicalPlan: complexity_level inválido '${classification.complexity_level}'. Esperado: A, B ou C`
    );
  }

  if (!envelope || typeof envelope.output_mode !== "string") {
    throw new Error(
      "buildCanonicalPlan: 'envelope.output_mode' é obrigatório e deve ser string"
    );
  }

  const risk_level          = classification.risk_level           || "desconhecido";
  const needs_human_approval = typeof classification.needs_human_approval === "boolean"
    ? classification.needs_human_approval
    : level === "C";
  const reason               = classification.reason              || "";
  const objective            = (envelope && typeof envelope.objective === "string" && envelope.objective.length > 0)
    ? envelope.objective
    : _fallbackObjective(input, reason);

  // output_mode espelha plan_type — mantidos alinhados para evitar drift
  const output_mode = plan_type;

  switch (level) {
    case "A":
      return _buildPlanA({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason });
    case "B":
      return _buildPlanB({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason });
    case "C":
      return _buildPlanC({ plan_type, output_mode, objective, risk_level, reason });
    default:
      // Nunca deve chegar aqui — validado acima
      throw new Error(`buildCanonicalPlan: nível inesperado '${level}'`);
  }
}

// ---------------------------------------------------------------------------
// _buildPlanA — Nível A (simple / quick_reply)
//
// Plano curto: 1–3 steps, aceite simples, next_action direto.
// ---------------------------------------------------------------------------
function _buildPlanA({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason }) {
  return {
    plan_version:        PLAN_VERSION,
    plan_type,
    complexity_level:    "A",
    output_mode,
    objective,
    scope_summary:       "Escopo simples e direto — ação pontual sem etapas complexas.",
    steps: [
      "Avaliar o pedido e identificar a ação necessária",
      "Executar a ação diretamente",
      "Confirmar conclusão com o solicitante",
    ],
    risks: [
      `Risco detectado: ${risk_level} — monitorar resultado`,
    ],
    acceptance_criteria: [
      "Ação concluída conforme o pedido",
      "Solicitante confirmou o resultado",
    ],
    needs_human_approval,
    next_action: "Executar a ação identificada diretamente e confirmar conclusão.",
    reason,
  };
}

// ---------------------------------------------------------------------------
// _buildPlanB — Nível B (tactical / tactical_plan)
//
// Plano tático: 3–5 steps definidos, dependências, aceite intermediário.
// ---------------------------------------------------------------------------
function _buildPlanB({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason }) {
  return {
    plan_version:        PLAN_VERSION,
    plan_type,
    complexity_level:    "B",
    output_mode,
    objective,
    scope_summary:       "Escopo tático com etapas definidas — requer validação de dependências antes de iniciar.",
    steps: [
      "Decompor o pedido em etapas executáveis e ordenadas",
      "Validar dependências e recursos necessários para cada etapa",
      "Executar cada etapa com monitoramento de resultado",
      "Validar entregáveis conforme critérios de aceite",
    ],
    risks: [
      `Risco detectado: ${risk_level} — verificar dependências antes de iniciar`,
      "Mudanças de escopo intermediárias devem ser revisadas antes de prosseguir",
    ],
    acceptance_criteria: [
      "Todas as etapas concluídas na ordem planejada",
      "Dependências resolvidas antes da execução",
      "Entregáveis validados pelo solicitante ao final",
    ],
    needs_human_approval,
    next_action: "Revisar as etapas planejadas, validar dependências e aguardar confirmação para iniciar.",
    reason,
  };
}

// ---------------------------------------------------------------------------
// _buildPlanC — Nível C (complex / formal_contract)
//
// Plano formal: macro-etapas/frentes visíveis, needs_human_approval=true,
// next_action aponta para aprovação/revisão humana formal.
// ---------------------------------------------------------------------------
function _buildPlanC({ plan_type, output_mode, objective, risk_level, reason }) {
  return {
    plan_version:        PLAN_VERSION,
    plan_type,
    complexity_level:    "C",
    output_mode,
    objective,
    scope_summary:       "Escopo macro e complexo — requer frentes bem definidas, revisão formal e aprovação humana antes de qualquer execução.",
    steps: [
      "Frente 1: diagnóstico completo e levantamento de requisitos",
      "Frente 2: decomposição tática por módulos e dependências",
      "Frente 3: planejamento de execução supervisionada com critérios claros",
      "Frente 4: revisão e aprovação formal humana antes de prosseguir",
    ],
    risks: [
      `Risco detectado: ${risk_level} — impacto potencialmente irreversível`,
      "Requer validação de compliance e critérios regulatórios antes de iniciar",
      "Dependências externas e múltiplos stakeholders envolvidos",
    ],
    acceptance_criteria: [
      "Plano formal revisado e aprovado por responsável humano",
      "Todas as frentes mapeadas com critérios de aceite definidos",
      "Riscos documentados e mitigações aprovadas antes da execução",
    ],
    needs_human_approval: true,
    next_action: "Submeter este plano para revisão e aprovação humana formal antes de qualquer execução.",
    reason,
  };
}

// ---------------------------------------------------------------------------
// _fallbackObjective(input, reason)
//
// Extrai objetivo do input.text ou cai para reason da PM4.
// ---------------------------------------------------------------------------
function _fallbackObjective(input, reason) {
  if (input && typeof input.text === "string" && input.text.trim().length > 0) {
    const trimmed = input.text.trim();
    return trimmed.length <= 120 ? trimmed : trimmed.slice(0, 117) + "...";
  }
  return reason && reason.length > 0 ? reason : "Objetivo a definir";
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  buildCanonicalPlan,
  PLAN_TYPES,
  PLAN_VERSION,
  LEVEL_TO_PLAN_TYPE,
};
