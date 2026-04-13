// ============================================================================
// ENAVIA — Mock Memory Data (P5)
// Shapes reflect the real memory model: canonical → operational → live context
// Centralized here — no hardcode in components
// ============================================================================

export const MEMORY_STATES = {
  POPULATED: "populated",
  EMPTY: "empty",
  CONSOLIDATING: "consolidating",
  LIVE_SESSION: "live_session",
};

export const MEMORY_FILTERS = {
  ALL: "all",
  CANONICAL: "canonical",
  OPERATIONAL: "operational",
  SESSION: "session",
};

// ── Shared constants ────────────────────────────────────────────────────────
const SESSION_ID = "sess-0x9f4c";
const PREV_SESSION_ID = "sess-0x8a3b";

// ── Canonical entries — permanent rules & identity ──────────────────────────
const CANONICAL_ENTRIES = [
  {
    id: "cn-001",
    key: "enavia.identity",
    value:
      "Enavia é um sistema cognitivo operacional — não um assistente genérico. Responde com precisão técnica e foco em execução.",
    strength: "strong",
    scope: "global",
    createdAt: "2026-03-01T10:00:00Z",
    tags: ["identidade", "cognição"],
    tier: 1,
    priority: "critical",
  },
  {
    id: "cn-002",
    key: "enavia.gate-rule",
    value:
      "Todo contrato com impacto financeiro acima de R$50k requer aprovação humana antes da execução.",
    strength: "strong",
    scope: "contratos",
    createdAt: "2026-03-05T14:30:00Z",
    tags: ["gate", "contratos", "aprovação"],
    tier: 1,
    priority: "critical",
  },
  {
    id: "cn-003",
    key: "enavia.output-default",
    value:
      "Output padrão para planejamento é STRUCTURED_PLAN. Para dúvidas rápidas, usar DIRECT_RESPONSE.",
    strength: "strong",
    scope: "output",
    createdAt: "2026-03-08T09:15:00Z",
    tags: ["output", "formato"],
    tier: 1,
    priority: "high",
  },
  {
    id: "cn-004",
    key: "enavia.retry-limit",
    value:
      "Tentativas máximas por contrato: 3. Após isso, escalar para operador humano.",
    strength: "strong",
    scope: "execução",
    createdAt: "2026-03-12T11:20:00Z",
    tags: ["retry", "execução", "escalação"],
    tier: 1,
    priority: "high",
  },
  {
    id: "cn-005",
    key: "dominio.fornecedor-logistico",
    value:
      "Fornecedor logístico região Sul tem capacidade limitada em Q2. Confirmar disponibilidade antes de comprometer prazo.",
    strength: "weak",
    scope: "operacional",
    createdAt: "2026-04-01T16:45:00Z",
    tags: ["fornecedor", "logística", "sul"],
    tier: 2,
    priority: "medium",
  },
];

// ── Operational entries — session-linked learnings ──────────────────────────
const OPERATIONAL_ENTRIES = [
  {
    id: "op-001",
    key: "decisao.expansao-sul",
    value:
      "Contrato de expansão região Sul classificado como ALTA prioridade com 3 dependências críticas identificadas.",
    strength: "strong",
    source: "planner",
    sessionId: PREV_SESSION_ID,
    createdAt: "2026-04-11T10:30:00Z",
    tags: ["expansão", "sul", "contrato"],
    tier: 3,
    priority: "high",
  },
  {
    id: "op-002",
    key: "contexto.prazo-q3",
    value:
      "Estimativa Q3 de 14 semanas validada pelo ops lead. Cronograma aprovado.",
    strength: "strong",
    source: "planner",
    sessionId: PREV_SESSION_ID,
    createdAt: "2026-04-11T10:45:00Z",
    tags: ["prazo", "planejamento", "q3"],
    tier: 3,
    priority: "high",
  },
  {
    id: "op-003",
    key: "feedback.gate-delay",
    value:
      "Gate de aprovação demorou 47min na última execução. Considerar reduzir timeout padrão para 30min.",
    strength: "weak",
    source: "executor",
    sessionId: PREV_SESSION_ID,
    createdAt: "2026-04-11T11:20:00Z",
    tags: ["gate", "performance", "feedback"],
    tier: 6,
    priority: "low",
  },
  {
    id: "op-004",
    key: "contexto.sessao-atual",
    value:
      "Novo contrato de análise de escopo iniciado. Usuário solicitou revisão completa do pipeline de contratos.",
    strength: "weak",
    source: "chat",
    sessionId: SESSION_ID,
    createdAt: "2026-04-12T02:00:00Z",
    tags: ["sessão", "contrato", "revisão"],
    tier: 4,
    priority: "medium",
  },
];

// ── Live context — what is alive right now ──────────────────────────────────
const LIVE_CONTEXT_BASE = {
  sessionId: SESSION_ID,
  startedAt: "2026-04-12T02:00:00Z",
  duration: "58min",
  intent:
    "Revisão completa do pipeline de contratos e análise de escopo para nova operação de expansão.",
  activeContracts: [
    {
      id: "ctr-0x12a",
      label: "Análise de escopo — Pipeline Contratos",
      status: "running",
    },
    {
      id: "ctr-0x12b",
      label: "Gate de aprovação — Ops Lead",
      status: "waiting",
    },
  ],
  signals: [
    { key: "intent_classified", value: "PLAN_GENERATE", confidence: 0.94 },
    { key: "domain_detected", value: "Contratos / Expansão", confidence: 0.91 },
    { key: "priority_inferred", value: "HIGH", confidence: 0.88 },
  ],
};

// ── Consolidation data ──────────────────────────────────────────────────────

// ── Memory-in-use: pre-plan read + audit snapshots ──────────────────────────
const MEMORY_READ_BEFORE_PLAN = {
  happened: true,
  readAt: "2026-04-12T02:01:00Z",
  memoriesRead: CANONICAL_ENTRIES.length + OPERATIONAL_ENTRIES.length,
  topTier: 1,
  topPriority: "critical",
};

const MEMORY_READ_BEFORE_PLAN_EMPTY = {
  happened: false,
  readAt: null,
  memoriesRead: 0,
  topTier: null,
  topPriority: null,
};

const AUDIT_SNAPSHOTS = [
  {
    id: "snap-001",
    label: "Início de sessão",
    createdAt: "2026-04-12T02:00:00Z",
    type: "session_start",
  },
  {
    id: "snap-002",
    label: "Pré-plano — leitura de memória",
    createdAt: "2026-04-12T02:01:00Z",
    type: "pre_plan_read",
  },
  {
    id: "snap-003",
    label: "Gate aprovado — Ops Lead",
    createdAt: "2026-04-12T02:30:00Z",
    type: "gate_approved",
  },
];
const CONSOLIDATION_PENDING = [
  {
    id: "pend-001",
    key: "feedback.gate-delay",
    value:
      "Gate de aprovação demorou 47min — candidato a virar regra de otimização do timeout padrão.",
    type: "operational",
    from: PREV_SESSION_ID,
  },
  {
    id: "pend-002",
    key: "contexto.sessao-atual",
    value:
      "Revisão do pipeline de contratos — aguardando fechamento da sessão para consolidar.",
    type: "session",
    from: SESSION_ID,
  },
  {
    id: "pend-003",
    key: "sinal.prioridade-alta-recorrente",
    value:
      "Terceira vez que domínio 'Contratos/Expansão' recebe prioridade HIGH — padrão identificado, candidato a regra canônica.",
    type: "pattern",
    from: SESSION_ID,
  },
];

const CONSOLIDATION_DONE = [
  {
    id: "done-001",
    key: "decisao.expansao-sul",
    value:
      "Contrato expansão Sul — prioridade ALTA, 3 dependências críticas identificadas e aprovadas.",
    type: "operational",
    consolidatedAt: "2026-04-11T23:30:00Z",
  },
  {
    id: "done-002",
    key: "contexto.prazo-q3",
    value:
      "Cronograma Q3 de 14 semanas aprovado pelo ops lead — comprometimento confirmado.",
    type: "operational",
    consolidatedAt: "2026-04-11T23:30:00Z",
  },
];

// ── Mock memory per state ───────────────────────────────────────────────────
export const MOCK_MEMORY = {
  [MEMORY_STATES.POPULATED]: {
    state: MEMORY_STATES.POPULATED,
    summary: {
      total: CANONICAL_ENTRIES.length + OPERATIONAL_ENTRIES.length,
      canonical: CANONICAL_ENTRIES.length,
      operational: OPERATIONAL_ENTRIES.length,
      sessionEntries: 1,
      lastConsolidation: "2026-04-11T23:30:00Z",
    },
    canonicalEntries: CANONICAL_ENTRIES,
    operationalEntries: OPERATIONAL_ENTRIES,
    liveContext: LIVE_CONTEXT_BASE,
    consolidation: {
      pending: [],
      consolidated: CONSOLIDATION_DONE,
      lastRun: "2026-04-11T23:30:00Z",
      nextRun: "2026-04-12T05:30:00Z",
    },
    memoryReadBeforePlan: MEMORY_READ_BEFORE_PLAN,
    auditSnapshots: AUDIT_SNAPSHOTS,
  },

  [MEMORY_STATES.EMPTY]: {
    state: MEMORY_STATES.EMPTY,
    summary: {
      total: 0,
      canonical: 0,
      operational: 0,
      sessionEntries: 0,
      lastConsolidation: null,
    },
    canonicalEntries: [],
    operationalEntries: [],
    liveContext: null,
    consolidation: {
      pending: [],
      consolidated: [],
      lastRun: null,
      nextRun: null,
    },
    memoryReadBeforePlan: MEMORY_READ_BEFORE_PLAN_EMPTY,
    auditSnapshots: [],
  },

  [MEMORY_STATES.CONSOLIDATING]: {
    state: MEMORY_STATES.CONSOLIDATING,
    summary: {
      total: CANONICAL_ENTRIES.length + OPERATIONAL_ENTRIES.length,
      canonical: CANONICAL_ENTRIES.length,
      operational: OPERATIONAL_ENTRIES.length,
      sessionEntries: 2,
      lastConsolidation: "2026-04-11T23:30:00Z",
    },
    canonicalEntries: CANONICAL_ENTRIES,
    operationalEntries: OPERATIONAL_ENTRIES,
    liveContext: {
      ...LIVE_CONTEXT_BASE,
      intent:
        "Ciclo de fechamento de sessão — consolidação de memória em andamento.",
    },
    consolidation: {
      pending: CONSOLIDATION_PENDING,
      consolidated: CONSOLIDATION_DONE,
      lastRun: "2026-04-11T23:30:00Z",
      nextRun: null,
    },
    memoryReadBeforePlan: MEMORY_READ_BEFORE_PLAN,
    auditSnapshots: AUDIT_SNAPSHOTS,
  },

  [MEMORY_STATES.LIVE_SESSION]: {
    state: MEMORY_STATES.LIVE_SESSION,
    summary: {
      total: CANONICAL_ENTRIES.length + OPERATIONAL_ENTRIES.length,
      canonical: CANONICAL_ENTRIES.length,
      operational: OPERATIONAL_ENTRIES.length,
      sessionEntries: 2,
      lastConsolidation: "2026-04-11T23:30:00Z",
    },
    canonicalEntries: CANONICAL_ENTRIES,
    operationalEntries: OPERATIONAL_ENTRIES,
    liveContext: LIVE_CONTEXT_BASE,
    consolidation: {
      pending: CONSOLIDATION_PENDING.slice(0, 1),
      consolidated: CONSOLIDATION_DONE,
      lastRun: "2026-04-11T23:30:00Z",
      nextRun: "2026-04-12T05:30:00Z",
    },
    memoryReadBeforePlan: MEMORY_READ_BEFORE_PLAN,
    auditSnapshots: AUDIT_SNAPSHOTS,
  },
};
