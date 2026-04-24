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
    text: "Validar worker nv-enavia em modo read-only — verificar health, config e métricas.",
    timestamp: "2026-04-12T01:47:31Z",
  },
  classification: {
    intent: "PLAN_GENERATE",
    domain: "Operações / Worker",
    priority: "HIGH",
    confidence: 0.94,
    tags: ["worker", "health-check", "read-only", "validação"],
  },
  outputMode: {
    type: "STRUCTURED",
    format: "canonical_plan",
    channel: "panel",
    streaming: false,
  },
  canonicalPlan: {
    objective: "Validar worker nv-enavia em modo read-only",
    steps: [
      {
        id: "step_1",
        label: "Verificar health do worker",
        action: "http_get",
        input: "/health",
        expected: { status: 200 },
        safe: true,
        description: "Confirmar que o worker responde em /health com HTTP 200",
        status: STEP_STATUS.DONE,
        durationMs: 312,
        deps: [],
      },
      {
        id: "step_2",
        label: "Ler configuração ativa",
        action: "http_get",
        input: "/config",
        expected: { contains: ["version", "env"] },
        safe: true,
        description: "Verificar campos obrigatórios na resposta de /config",
        status: STEP_STATUS.DONE,
        durationMs: 280,
        deps: ["step_1"],
      },
      {
        id: "step_3",
        label: "Coletar métricas operacionais",
        action: "http_get",
        input: "/metrics",
        expected: { status: 200 },
        safe: true,
        description: "Obter snapshot de métricas para baseline",
        status: STEP_STATUS.ACTIVE,
        durationMs: null,
        deps: ["step_2"],
      },
      {
        id: "step_4",
        label: "Consultar status operacional",
        action: "http_get",
        input: "/status",
        expected: { status: 200, contains: ["ready"] },
        safe: true,
        description: "Confirmar estado operacional do worker antes de aprovar",
        status: STEP_STATUS.PENDING,
        durationMs: null,
        deps: ["step_3"],
      },
      {
        id: "step_5",
        label: "Aguardar aprovação do gate",
        action: "validate_config",
        input: null,
        expected: null,
        safe: true,
        description: "Gate humano: revisar resultados e clicar em Aprovar execução",
        status: STEP_STATUS.PENDING,
        durationMs: null,
        deps: ["step_4"],
      },
    ],
  },
  gate: {
    required: true,
    state: "pending",
    approver: "Ops Lead",
    timeout: "2h",
    reason: "Plano envolve validação de worker em produção",
  },
  bridge: {
    module: "enavia-executor",
    payload: "canonical_plan_v1",
    state: "waiting_gate",
    description: "Aguardando aprovação antes de acionar o executor",
  },
  memoryConsolidation: {
    candidates: [
      {
        key: "worker-health-ok",
        value: "Worker nv-enavia respondeu /health com HTTP 200",
        tags: ["worker", "health", "read-only"],
        priority: "HIGH",
      },
      {
        key: "config-fields-verified",
        value: "Campos version e env presentes na configuração ativa",
        tags: ["config", "validação"],
        priority: "MEDIUM",
      },
      {
        key: "metrics-baseline",
        value: "Snapshot de métricas coletado para comparação futura",
        tags: ["métricas", "baseline"],
        priority: "MEDIUM",
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
        status: STEP_STATUS.DONE,
        durationMs: s.durationMs ?? 2800,
      })),
    },
    gate: { ...BASE_PLAN.gate, state: "approved" },
    bridge: { ...BASE_PLAN.bridge, state: "ready" },
  },
};
