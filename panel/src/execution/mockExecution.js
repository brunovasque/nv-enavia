// ============================================================================
// ENAVIA — Mock Execution Data
// Shape reflects the real operational cycle:
// plan_loaded → gate → bridge → steps → result → memory
// ============================================================================

export const EXECUTION_STATUS = {
  IDLE: "idle",
  RUNNING: "running",
  BLOCKED: "blocked",
  FAILED: "failed",
  COMPLETED: "completed",
};

export const EVENT_TYPE = {
  PLAN_LOADED: "PLAN_LOADED",
  GATE_REQUESTED: "GATE_REQUESTED",
  GATE_APPROVED: "GATE_APPROVED",
  GATE_BLOCKED: "GATE_BLOCKED",
  STEP_STARTED: "STEP_STARTED",
  STEP_DONE: "STEP_DONE",
  STEP_FAILED: "STEP_FAILED",
  BRIDGE_CALLED: "BRIDGE_CALLED",
  RESULT_PARTIAL: "RESULT_PARTIAL",
  RESULT_FINAL: "RESULT_FINAL",
  ERROR: "ERROR",
  MEMORY_SAVED: "MEMORY_SAVED",
};

export const EVENT_STATUS = {
  DONE: "done",
  ACTIVE: "active",
  ERROR: "error",
  BLOCKED: "blocked",
};

// ── Event type display metadata ───────────────────────────────────────────
export const EVENT_META = {
  [EVENT_TYPE.PLAN_LOADED]:    { icon: "◆", color: "#00B4D8" },
  [EVENT_TYPE.GATE_REQUESTED]: { icon: "⏳", color: "#F59E0B" },
  [EVENT_TYPE.GATE_APPROVED]:  { icon: "✓",  color: "#10B981" },
  [EVENT_TYPE.GATE_BLOCKED]:   { icon: "✕",  color: "#EF4444" },
  [EVENT_TYPE.STEP_STARTED]:   { icon: "▷",  color: "#00B4D8" },
  [EVENT_TYPE.STEP_DONE]:      { icon: "◎",  color: "#10B981" },
  [EVENT_TYPE.STEP_FAILED]:    { icon: "✕",  color: "#EF4444" },
  [EVENT_TYPE.BRIDGE_CALLED]:  { icon: "⇒",  color: "#8B5CF6" },
  [EVENT_TYPE.RESULT_PARTIAL]: { icon: "◎",  color: "#06B6D4" },
  [EVENT_TYPE.RESULT_FINAL]:   { icon: "◆",  color: "#10B981" },
  [EVENT_TYPE.ERROR]:          { icon: "✕",  color: "#EF4444" },
  [EVENT_TYPE.MEMORY_SAVED]:   { icon: "◎",  color: "#64748B" },
};

// ── Helpers ───────────────────────────────────────────────────────────────
export function formatElapsed(ms) {
  if (!ms && ms !== 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${hours}h ${String(minutes).padStart(2, "0")}m`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatTsFull(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function formatDuration(ms) {
  if (!ms) return null;
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ── Event sets ────────────────────────────────────────────────────────────

const FULL_EVENTS = [
  {
    id: "e1",
    type: EVENT_TYPE.PLAN_LOADED,
    label: "Plano carregado",
    detail: "plan-0x4f2a recebido do ciclo cognitivo",
    timestamp: "2026-04-12T01:48:02Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e2",
    type: EVENT_TYPE.GATE_REQUESTED,
    label: "Gate humano solicitado",
    detail: "Aguardando aprovação do Ops Lead — timeout: 2h",
    timestamp: "2026-04-12T01:48:04Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e3",
    type: EVENT_TYPE.GATE_APPROVED,
    label: "Gate aprovado",
    detail: "Ops Lead confirmou em 00:03:22",
    timestamp: "2026-04-12T01:51:26Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e4",
    type: EVENT_TYPE.BRIDGE_CALLED,
    label: "Bridge acionado",
    detail: "contract-executor recebeu canonical_plan_v1",
    timestamp: "2026-04-12T01:51:28Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e5",
    type: EVENT_TYPE.STEP_STARTED,
    label: "Etapa 1 — Análise de escopo",
    detail: "Extraindo e estruturando requisitos do contrato de expansão",
    timestamp: "2026-04-12T01:51:30Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e6",
    type: EVENT_TYPE.STEP_DONE,
    label: "Etapa 1 concluída",
    detail: "Escopo estruturado — 3 requisitos críticos identificados",
    timestamp: "2026-04-12T01:51:48Z",
    status: EVENT_STATUS.DONE,
    durationMs: 1800,
  },
  {
    id: "e7",
    type: EVENT_TYPE.STEP_STARTED,
    label: "Etapa 2 — Mapeamento de dependências",
    detail: "Identificando recursos críticos para a região Sul",
    timestamp: "2026-04-12T01:51:49Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e8",
    type: EVENT_TYPE.STEP_DONE,
    label: "Etapa 2 concluída",
    detail: "Dependências mapeadas — 1 bloqueio potencial identificado",
    timestamp: "2026-04-12T01:52:09Z",
    status: EVENT_STATUS.DONE,
    durationMs: 2400,
  },
  {
    id: "e9",
    type: EVENT_TYPE.STEP_STARTED,
    label: "Etapa 3 — Estimativa de prazos",
    detail: "Calculando cronograma baseado em capacidade e precedências",
    timestamp: "2026-04-12T01:52:10Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e10",
    type: EVENT_TYPE.RESULT_PARTIAL,
    label: "Resultado parcial disponível",
    detail: "Cronograma preliminar estimado em 14 semanas",
    timestamp: "2026-04-12T01:52:32Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e11",
    type: EVENT_TYPE.STEP_DONE,
    label: "Etapa 3 concluída",
    detail: "Estimativas validadas e consolidadas",
    timestamp: "2026-04-12T01:52:44Z",
    status: EVENT_STATUS.DONE,
    durationMs: 3200,
  },
  {
    id: "e12",
    type: EVENT_TYPE.STEP_STARTED,
    label: "Etapa 4 — Geração do plano canônico",
    detail: "Consolidando análise em documento estruturado para aprovação",
    timestamp: "2026-04-12T01:52:45Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e13",
    type: EVENT_TYPE.STEP_DONE,
    label: "Etapa 4 concluída",
    detail: "Plano canônico gerado e validado",
    timestamp: "2026-04-12T01:53:12Z",
    status: EVENT_STATUS.DONE,
    durationMs: 2800,
  },
  {
    id: "e14",
    type: EVENT_TYPE.RESULT_FINAL,
    label: "Resultado final entregue",
    detail: "Plano de execução completo gerado e disponível",
    timestamp: "2026-04-12T01:53:15Z",
    status: EVENT_STATUS.DONE,
  },
  {
    id: "e15",
    type: EVENT_TYPE.MEMORY_SAVED,
    label: "Memória consolidada",
    detail: "3 entradas de contexto salvas para sessões futuras",
    timestamp: "2026-04-12T01:53:16Z",
    status: EVENT_STATUS.DONE,
  },
];

// Running: up to step 3 in progress
const RUNNING_EVENTS = [
  ...FULL_EVENTS.slice(0, 8),
  { ...FULL_EVENTS[8], status: EVENT_STATUS.ACTIVE },
];

// Blocked: gate timed out
const BLOCKED_EVENTS = [
  FULL_EVENTS[0],
  FULL_EVENTS[1],
  {
    id: "e2b",
    type: EVENT_TYPE.GATE_BLOCKED,
    label: "Gate bloqueado",
    detail: "Aprovador indisponível — timeout atingido após 2h. Requer escalação manual.",
    timestamp: "2026-04-12T03:48:04Z",
    status: EVENT_STATUS.BLOCKED,
  },
];

// Failed: step 3 errored
const FAILED_EVENTS = [
  ...FULL_EVENTS.slice(0, 8),
  {
    id: "e_fail",
    type: EVENT_TYPE.STEP_FAILED,
    label: "Etapa 3 falhou",
    detail: "Falha ao calcular cronograma — dados insuficientes do fornecedor logístico",
    timestamp: "2026-04-12T01:52:18Z",
    status: EVENT_STATUS.ERROR,
  },
  {
    id: "e_err",
    type: EVENT_TYPE.ERROR,
    label: "Execução encerrada com erro",
    detail: "Não foi possível completar o ciclo — intervenção necessária",
    timestamp: "2026-04-12T01:52:20Z",
    status: EVENT_STATUS.ERROR,
  },
];

// ── Mock executions ───────────────────────────────────────────────────────

const BASE = {
  id: "exec-0x4f2a-01",
  planId: "plan-0x4f2a",
  request:
    "Analise o escopo do contrato de expansão para a região Sul e gere um plano de execução completo com estimativas de prazo e dependências críticas.",
  startedAt: "2026-04-12T01:48:00Z",
};

export const MOCK_EXECUTIONS = {
  [EXECUTION_STATUS.IDLE]: null,

  [EXECUTION_STATUS.RUNNING]: {
    ...BASE,
    status: EXECUTION_STATUS.RUNNING,
    metrics: { stepsTotal: 4, stepsDone: 2, elapsedMs: 154000, estimatedMs: 313000 },
    currentStep: {
      id: "s3",
      label: "Estimativa de prazos",
      description:
        "Calculando cronograma baseado em capacidade e precedências identificadas",
      startedAt: "2026-04-12T01:52:10Z",
    },
    // Campos operacionais — surface da Frente 5
    operation: {
      action: "Calculando cronograma de capacidade regional",
      contract: "canonical_plan_v1",
      microStep: "Validando precedências entre etapas e janelas de entrega",
      reason:
        "Dados de capacidade identificados nas etapas 1 e 2; estimando janela de entrega para a região Sul",
      nextStep: "Etapa 4 — Geração do plano canônico",
    },
    // Trilha de código — surface da Frente 5 PR3 (demo/mock — não é runtime real)
    codeTrail: {
      file: "contract-executor.js",
      block: "resolveStep(stepId, context)",
      operationType: "VALIDATE",
      diffSummary:
        "+  stepsCompleted += 1;\n" +
        "+  validatePrecedences(context.steps);\n" +
        "-  // lógica anterior de contagem inline removida",
      justification:
        "Contagem de etapas ajustada para refletir estado atual do ciclo cognitivo — dependência identificada na etapa 2",
      outOfScope: "Replay completo · Worker integration · noVNC · backend profundo",
    },
    // Trilha viva de arquivo/operação — Nova frente PR1 (demo/mock — não é runtime real)
    liveTrail: {
      file: "contract-executor.js",
      block: "resolveStep(stepId, context)",
      operationType: "VALIDATE",
      status: "running",
      actionSummary: "Validando precedências entre etapas e calculando janela de entrega",
    },
    // Diff incremental visual — Nova frente PR2 (demo/mock — não é runtime real)
    incrementalDiff: {
      file: "contract-executor.js",
      block: "resolveStep(stepId, context)",
      lines: [
        { type: "neutral", content: "function resolveStep(stepId, context) {" },
        { type: "remove",  content: "  // lógica anterior de contagem inline removida" },
        { type: "add",     content: "  stepsCompleted += 1;" },
        { type: "add",     content: "  validatePrecedences(context.steps);" },
        { type: "neutral", content: "}" },
      ],
      changeSummary: "Contagem de etapas ajustada; precedências validadas via validatePrecedences()",
    },
    events: RUNNING_EVENTS,
    result: null,
    error: null,
  },

  [EXECUTION_STATUS.BLOCKED]: {
    ...BASE,
    status: EXECUTION_STATUS.BLOCKED,
    metrics: { stepsTotal: 4, stepsDone: 0, elapsedMs: 7202000, estimatedMs: 313000 },
    currentStep: null,
    events: BLOCKED_EVENTS,
    browserEvents: [],
    codeEvents: [],
    executionSummary: {
      finalStatus: EXECUTION_STATUS.BLOCKED,
      hadBlocker: true,
      hadBrowserNavigation: false,
      hadCodeChange: false,
      nextAction: "Escalar para Ops Lead — aprovação manual necessária para desbloqueio",
    },
    result: null,
    error: {
      code: "GATE_TIMEOUT",
      message:
        "Aprovador indisponível — timeout atingido após 2 horas. Requer escalação manual para desbloqueio.",
      recoverable: true,
      blockedAt: "2026-04-12T03:48:04Z",
    },
  },

  [EXECUTION_STATUS.FAILED]: {
    ...BASE,
    status: EXECUTION_STATUS.FAILED,
    metrics: { stepsTotal: 4, stepsDone: 2, elapsedMs: 260000, estimatedMs: 313000 },
    currentStep: null,
    events: FAILED_EVENTS,
    browserEvents: [],
    codeEvents: [],
    executionSummary: {
      finalStatus: EXECUTION_STATUS.FAILED,
      hadBlocker: false,
      hadBrowserNavigation: false,
      hadCodeChange: false,
      nextAction: "Verificar dados do fornecedor logístico — reexecutar etapa 3 com dados atualizados",
    },
    result: null,
    error: {
      code: "STEP_EXECUTION_ERROR",
      message:
        "Falha ao calcular cronograma — dados insuficientes do fornecedor logístico local para a região Sul.",
      recoverable: false,
      blockedAt: "2026-04-12T01:52:20Z",
    },
  },

  [EXECUTION_STATUS.COMPLETED]: {
    ...BASE,
    status: EXECUTION_STATUS.COMPLETED,
    metrics: { stepsTotal: 4, stepsDone: 4, elapsedMs: 316000, estimatedMs: 313000 },
    currentStep: null,
    events: FULL_EVENTS,
    // Browser events that occurred during the execution (demo/mock — not real runtime)
    browserEvents: [
      {
        id: "br1",
        track: "browser",
        type: "BROWSER_SESSION_START",
        label: "Sessão browser iniciada",
        detail: "sess-br-0x1a2b — run.nv-imoveis.com/*",
        timestamp: "2026-04-12T01:51:30Z",
        status: EVENT_STATUS.DONE,
      },
      {
        id: "br2",
        track: "browser",
        type: "BROWSER_NAVIGATE",
        label: "Navegação: página de busca",
        detail: "Filtros: apartamento, Curitiba, 2 dormitórios — 12 resultados encontrados",
        timestamp: "2026-04-12T01:51:40Z",
        status: EVENT_STATUS.DONE,
      },
      {
        id: "br3",
        track: "browser",
        type: "BROWSER_ACT",
        label: "Extração: dados do imóvel #1",
        detail: "Apartamento 2 dorm., Batel, Curitiba · R$ 850.000 · 78m²",
        timestamp: "2026-04-12T01:51:55Z",
        status: EVENT_STATUS.DONE,
      },
      {
        id: "br4",
        track: "browser",
        type: "BROWSER_ACT",
        label: "Análise: 5 imóveis processados",
        detail: "3 atenderam critérios — dados enviados ao ciclo cognitivo",
        timestamp: "2026-04-12T01:52:20Z",
        status: EVENT_STATUS.DONE,
      },
      {
        id: "br5",
        track: "browser",
        type: "BROWSER_SESSION_END",
        label: "Sessão browser encerrada",
        detail: "5 imóveis analisados · 3 aprovados · dados exportados para o ciclo cognitivo",
        timestamp: "2026-04-12T01:52:50Z",
        status: EVENT_STATUS.DONE,
      },
    ],
    // Code events that occurred during the execution (demo/mock — not real runtime)
    codeEvents: [
      {
        id: "ce1",
        track: "code",
        type: "CODE_VALIDATE",
        label: "VALIDATE · resolveStep()",
        detail: "contract-executor.js — stepsCompleted ajustado, precedências validadas",
        timestamp: "2026-04-12T01:52:10Z",
        status: EVENT_STATUS.DONE,
      },
      {
        id: "ce2",
        track: "code",
        type: "CODE_WRITE",
        label: "WRITE · savePlan()",
        detail: "contract-executor.js — plano canônico serializado e persistido",
        timestamp: "2026-04-12T01:53:10Z",
        status: EVENT_STATUS.DONE,
      },
    ],
    executionSummary: {
      finalStatus: EXECUTION_STATUS.COMPLETED,
      hadBlocker: false,
      hadBrowserNavigation: true,
      hadCodeChange: true,
      nextAction: "Plano entregue — aguardando aprovação final do Ops Lead",
    },
    result: {
      summary: "Plano de execução de expansão — Região Sul",
      output: `Escopo: 3 requisitos críticos identificados e estruturados
Dependências: 1 bloqueio potencial (fornecedor logístico local)
Cronograma estimado: 14 semanas — Q2 a Q3 2026
Plano canônico: gerado, validado e pronto para aprovação
Memória: 3 entradas de contexto consolidadas`,
      deliveredAt: "2026-04-12T01:53:15Z",
    },
    error: null,
  },
};
