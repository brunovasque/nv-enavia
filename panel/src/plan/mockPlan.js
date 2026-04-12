// ============================================================================
// ENAVIA — Mock Plan Data
// Shape reflects the real cognitive/operational cycle:
// classification → output mode → canonical plan → gate → bridge → memory
// ============================================================================

export const PLAN_STATUS = {
  COMPLETE: "complete",
  EMPTY: "empty",
  BLOCKED: "blocked",
  READY: "ready",
};

export const STEP_STATUS = {
  DONE: "done",
  ACTIVE: "active",
  PENDING: "pending",
  SKIPPED: "skipped",
};

const BASE_PLAN = {
  id: "plan-0x4f2a",
  createdAt: "2026-04-12T01:47:33Z",
  request: {
    text: "Analise o escopo do contrato de expansão para a região Sul e gere um plano de execução completo com estimativas de prazo e dependências críticas.",
    timestamp: "2026-04-12T01:47:31Z",
  },
  classification: {
    intent: "PLAN_GENERATE",
    domain: "Contratos / Expansão",
    priority: "HIGH",
    confidence: 0.94,
    tags: ["contrato", "expansão", "planejamento", "região-sul"],
  },
  outputMode: {
    type: "STRUCTURED",
    format: "canonical_plan",
    channel: "panel",
    streaming: false,
  },
  canonicalPlan: {
    steps: [
      {
        id: "s1",
        label: "Análise de escopo",
        description: "Extrair e estruturar os requisitos do contrato de expansão",
        status: STEP_STATUS.DONE,
        durationMs: 1800,
        deps: [],
      },
      {
        id: "s2",
        label: "Mapeamento de dependências",
        description: "Identificar recursos críticos e bloqueios externos para a região Sul",
        status: STEP_STATUS.DONE,
        durationMs: 2400,
        deps: ["s1"],
      },
      {
        id: "s3",
        label: "Estimativa de prazos",
        description: "Calcular cronograma baseado em capacidade e precedências identificadas",
        status: STEP_STATUS.ACTIVE,
        durationMs: null,
        deps: ["s2"],
      },
      {
        id: "s4",
        label: "Geração do plano canônico",
        description: "Consolidar análise em plano estruturado pronto para aprovação",
        status: STEP_STATUS.PENDING,
        durationMs: null,
        deps: ["s3"],
      },
      {
        id: "s5",
        label: "Revisão de gate humano",
        description: "Aguardar aprovação do responsável antes de iniciar execução",
        status: STEP_STATUS.PENDING,
        durationMs: null,
        deps: ["s4"],
      },
    ],
  },
  gate: {
    required: true,
    state: "pending",
    approver: "Ops Lead",
    timeout: "2h",
    reason: "Plano envolve comprometimento de recursos externos de alto custo",
  },
  bridge: {
    module: "contract-executor",
    payload: "canonical_plan_v1",
    state: "waiting_gate",
    description: "Aguardando aprovação antes de acionar o executor de contratos",
  },
  memoryConsolidation: {
    candidates: [
      {
        key: "escopo-expansao-sul",
        value: "Contrato de expansão região Sul identificado com 3 dependências críticas",
        tags: ["contrato", "expansão", "região-sul"],
        priority: "HIGH",
      },
      {
        key: "prazo-estimado-q3",
        value: "Estimativa de 14 semanas para conclusão completa do ciclo contratual",
        tags: ["prazo", "planejamento"],
        priority: "MEDIUM",
      },
      {
        key: "bloqueio-fornecedor-logistico",
        value: "Fornecedor logístico local sem capacidade confirmada para Q2",
        tags: ["bloqueio", "fornecedor", "logística"],
        priority: "HIGH",
      },
    ],
  },
};

export const MOCK_PLANS = {
  [PLAN_STATUS.COMPLETE]: {
    ...BASE_PLAN,
    status: PLAN_STATUS.COMPLETE,
    canonicalPlan: {
      steps: BASE_PLAN.canonicalPlan.steps.map((s) => ({
        ...s,
        status: STEP_STATUS.DONE,
        durationMs: s.durationMs ?? 3200,
      })),
    },
    gate: { ...BASE_PLAN.gate, state: "approved", approver: "Ops Lead" },
    bridge: { ...BASE_PLAN.bridge, state: "active" },
  },

  [PLAN_STATUS.EMPTY]: null,

  [PLAN_STATUS.BLOCKED]: {
    ...BASE_PLAN,
    status: PLAN_STATUS.BLOCKED,
    canonicalPlan: {
      steps: BASE_PLAN.canonicalPlan.steps.map((s, i) => ({
        ...s,
        status: i < 2 ? STEP_STATUS.DONE : STEP_STATUS.PENDING,
        durationMs: i < 2 ? (s.durationMs ?? 2000) : null,
      })),
    },
    gate: {
      ...BASE_PLAN.gate,
      state: "blocked",
      reason: "Aprovador indisponível — timeout atingido. Requer escalação manual.",
    },
    bridge: { ...BASE_PLAN.bridge, state: "blocked" },
  },

  [PLAN_STATUS.READY]: {
    ...BASE_PLAN,
    status: PLAN_STATUS.READY,
    canonicalPlan: {
      steps: BASE_PLAN.canonicalPlan.steps.map((s) => ({
        ...s,
        status: s.id === "s5" ? STEP_STATUS.DONE : STEP_STATUS.DONE,
        durationMs: s.durationMs ?? 2800,
      })),
    },
    gate: { ...BASE_PLAN.gate, state: "approved" },
    bridge: { ...BASE_PLAN.bridge, state: "ready" },
  },
};
