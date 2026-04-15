// ============================================================================
// ENAVIA Panel — Mock Contract Data (PR4)
//
// Mock fixtures for the Contract Surface.
// Mirrors the shapes produced by:
//   - contract-active-state.js (PR2): active state + canonical summary
//   - contract-adherence-engine.js (PR3): adherence gate result
//
// States: ACTIVE_ALLOW, ACTIVE_WARN, ACTIVE_BLOCK, NO_CONTRACT
// ============================================================================

// ---------------------------------------------------------------------------
// CONTRACT_SURFACE_STATUS — panel-level status enum
// ---------------------------------------------------------------------------
export const CONTRACT_SURFACE_STATUS = {
  ACTIVE_ALLOW:  "active_allow",
  ACTIVE_WARN:   "active_warn",
  ACTIVE_BLOCK:  "active_block",
  NO_CONTRACT:   "no_contract",
};

// ---------------------------------------------------------------------------
// Shared canonical summary fixture (mirrors buildCanonicalSummary output)
// ---------------------------------------------------------------------------
const MOCK_SUMMARY = {
  macro_objective: "Implementar sistema de gestão de contratos longos com ingestão, ativação, aderência e painel.",
  detected_phases: ["scope", "obligation", "acceptance", "deadline", "termination"],
  hard_rules_count: 3,
  hard_rules_top: [
    "Nenhuma alteração em produção sem aprovação formal",
    "Testes obrigatórios antes de qualquer merge em main",
    "Escopo contratual não pode ser alterado sem aditivo",
  ],
  acceptance_criteria_count: 4,
  acceptance_criteria_top: [
    "Todas as microetapas concluídas com status aderente",
    "Painel exibe contrato ativo e resultado de aderência",
    "Auditoria de execução acessível ao operador",
    "Smoke tests passam sem regressão",
  ],
  approval_points_count: 2,
  approval_points_top: [
    "Deploy para produção requer aprovação humana",
    "Promoção de contrato requer revisão formal",
  ],
  blocking_points_count: 1,
  blocking_points_top: [
    "Bloqueio automático se violação de hard rule detectada",
  ],
  deadlines_count: 1,
  deadlines_top: [
    "Prazo final: 30 dias após ativação do contrato",
  ],
  sections_count: 5,
  blocks_count: 12,
  confidence: { structure: 0.92, signals: 0.88 },
};

// ---------------------------------------------------------------------------
// Shared active state fixture (mirrors activateIngestedContract output)
// ---------------------------------------------------------------------------
const MOCK_ACTIVE_STATE = {
  contract_id: "contract-longos-v1",
  activated_at: "2026-04-10T14:30:00.000Z",
  current_phase_hint: "obligation",
  last_task_id: "task-pr4-panel-surface",
  summary_canonic: MOCK_SUMMARY,
  metadata: {
    operator: "enavia-codex",
    ingested_at: "2026-04-09T10:00:00.000Z",
    blocks_count: 12,
    activation_source: "activateIngestedContract",
    scope: "default",
  },
  version: "v1",
  relevant_block_ids: ["blk_001", "blk_003", "blk_007", "blk_009"],
  resolution_strategy: "phase",
  last_resolution_at: "2026-04-15T18:00:00.000Z",
};

// ---------------------------------------------------------------------------
// Adherence gate result fixtures (mirrors evaluateContractAdherence output)
// ---------------------------------------------------------------------------
const MOCK_ADHERENCE_ALLOW = {
  ok: true,
  decision: "ALLOW",
  reason_code: "ALLOW_ADHERENT",
  reason_text: "Action is adherent to the active contract.",
  matched_rules: [
    {
      rule: "Testes obrigatórios antes de qualquer merge em main",
      block_id: "blk_003",
      heading: "Regras de Qualidade",
      category: "hard_rule",
      source: "block",
    },
    {
      rule: "Todas as microetapas concluídas com status aderente",
      block_id: "blk_007",
      heading: "Critérios de Aceite",
      category: "acceptance_criteria",
      source: "block",
    },
  ],
  violations: [],
  requires_human_approval: false,
  notes: [
    "Block blk_009 has hard rule \"Escopo contratual não pode ser alterado sem aditivo\" — no direct conflict with this action.",
  ],
  contract_id: "contract-longos-v1",
  scope: "default",
  evaluated_at: "2026-04-15T20:00:00.000Z",
  resolution_strategy: "phase",
  relevant_blocks_count: 4,
};

const MOCK_ADHERENCE_WARN = {
  ok: true,
  decision: "WARN",
  reason_code: "WARN_PHASE_AMBIGUOUS",
  reason_text: "Action phase \"review\" partially matches \"acceptance\" — ambiguous.",
  matched_rules: [
    {
      rule: "Testes obrigatórios antes de qualquer merge em main",
      block_id: "blk_003",
      heading: "Regras de Qualidade",
      category: "hard_rule",
      source: "block_weak",
    },
  ],
  violations: [],
  requires_human_approval: false,
  notes: [
    "Action phase \"review\" partially matches \"acceptance\" — ambiguous.",
    "Partial overlap with blocking point (summary): \"Bloqueio automático se violação de hard rule detectada\" (keyword: bloqueio)",
  ],
  contract_id: "contract-longos-v1",
  scope: "default",
  evaluated_at: "2026-04-15T19:30:00.000Z",
  resolution_strategy: "intent",
  relevant_blocks_count: 3,
};

const MOCK_ADHERENCE_BLOCK = {
  ok: false,
  decision: "BLOCK",
  reason_code: "BLOCK_HARD_RULE",
  reason_text: "Action conflicts with hard rule in block blk_001: \"Nenhuma alteração em produção sem aprovação formal\"",
  matched_rules: [
    {
      rule: "Nenhuma alteração em produção sem aprovação formal",
      block_id: "blk_001",
      heading: "Regras Imperativas",
      category: "hard_rule",
      source: "block",
    },
    {
      rule: "Deploy para produção requer aprovação humana",
      block_id: "blk_009",
      heading: "Pontos de Aprovação",
      category: "approval_point",
      source: "block",
    },
  ],
  violations: [
    {
      type: "hard_rule",
      description: "Action conflicts with hard rule in block blk_001: \"Nenhuma alteração em produção sem aprovação formal\"",
      block_id: "blk_001",
      heading: "Regras Imperativas",
      matched_keywords: ["produção", "alteração"],
    },
    {
      type: "human_approval_required",
      description: "Deploy/promote action requires human approval per block blk_009: \"Deploy para produção requer aprovação humana\"",
      block_id: "blk_009",
      heading: "Pontos de Aprovação",
    },
  ],
  requires_human_approval: true,
  notes: [
    "Block blk_003 has hard rule \"Testes obrigatórios antes de qualquer merge em main\" — weak overlap (keyword: testes).",
  ],
  contract_id: "contract-longos-v1",
  scope: "default",
  evaluated_at: "2026-04-15T19:00:00.000Z",
  resolution_strategy: "phase",
  relevant_blocks_count: 4,
};

// ---------------------------------------------------------------------------
// Full mock payloads per surface state
// ---------------------------------------------------------------------------
export const MOCK_CONTRACT = {
  [CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW]: {
    active_state: MOCK_ACTIVE_STATE,
    adherence: MOCK_ADHERENCE_ALLOW,
  },
  [CONTRACT_SURFACE_STATUS.ACTIVE_WARN]: {
    active_state: MOCK_ACTIVE_STATE,
    adherence: MOCK_ADHERENCE_WARN,
  },
  [CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK]: {
    active_state: MOCK_ACTIVE_STATE,
    adherence: MOCK_ADHERENCE_BLOCK,
  },
  [CONTRACT_SURFACE_STATUS.NO_CONTRACT]: {
    active_state: null,
    adherence: null,
  },
};
