// ============================================================================
// ENAVIA Panel — Mock Health Data (P22)
//
// Visão macro / agregada do sistema Enavia.
// NÃO é execução individual — não repete P19 / P20 / P21.
//
// Uso: HealthPage.jsx apenas.
// ============================================================================

// ── System health status ──────────────────────────────────────────────────────

export const HEALTH_STATUS = {
  HEALTHY:  "healthy",   // nenhum erro, nenhum bloqueio
  DEGRADED: "degraded",  // erros recentes, mas ainda funcionando
  CRITICAL: "critical",  // bloqueios ativos e/ou alta taxa de falha
  IDLE:     "idle",      // sem execuções recentes
};

// ── Mock aggregate data ───────────────────────────────────────────────────────

export const MOCK_HEALTH = {
  generatedAt: "2026-04-12T04:00:00Z",

  // Status geral do sistema
  status: HEALTH_STATUS.DEGRADED,

  // Sumário de execuções recentes (últimas 24h)
  summary: {
    total:     15,
    completed: 12,
    failed:    2,
    blocked:   1,
    running:   0,
  },

  // Erros recentes — lista compacta (sem log detalhado por execução)
  recentErrors: [
    {
      id:           "exec-0x3a1b",
      requestLabel: "Análise contrato expansão Sul",
      errorCode:    "STEP_EXECUTION_ERROR",
      message:      "Dados insuficientes do fornecedor logístico local.",
      failedAt:     "2026-04-12T01:52:20Z",
    },
    {
      id:           "exec-0x2c9d",
      requestLabel: "Consolidação histórico semanal",
      errorCode:    "TIMEOUT",
      message:      "Tempo limite de execução atingido (5min). Retomada necessária.",
      failedAt:     "2026-04-11T22:14:05Z",
    },
  ],

  // Execuções bloqueadas aguardando ação manual
  blockedExecutions: [
    {
      id:           "exec-0x4f2a",
      requestLabel: "Plano de execução — expansão Q2",
      blockedAt:    "2026-04-12T03:48:04Z",
      reason:       "Gate humano — timeout atingido após 2h",
      nextAction:   "Escalar para Ops Lead e obter aprovação manual",
    },
  ],

  // Execuções concluídas recentes — lista compacta
  recentCompleted: [
    {
      id:           "exec-0x4f2a-01",
      requestLabel: "Análise contrato expansão — Região Sul",
      completedAt:  "2026-04-12T01:53:15Z",
      durationMs:   316000,
      summary:      "Plano de execução gerado e validado (14 semanas).",
    },
    {
      id:           "exec-0x1b8e",
      requestLabel: "Mapeamento de dependências — Q1",
      completedAt:  "2026-04-11T20:30:44Z",
      durationMs:   198000,
      summary:      "3 dependências críticas identificadas.",
    },
    {
      id:           "exec-0x0d4c",
      requestLabel: "Estimativa de capacidade regional",
      completedAt:  "2026-04-11T18:12:09Z",
      durationMs:   421000,
      summary:      "Capacidade regional mapeada para Q2/Q3.",
    },
  ],
};

// ── Empty health (idle system) ────────────────────────────────────────────────

export const MOCK_HEALTH_IDLE = {
  generatedAt:       null,
  status:            HEALTH_STATUS.IDLE,
  summary:           { total: 0, completed: 0, failed: 0, blocked: 0, running: 0 },
  recentErrors:      [],
  blockedExecutions: [],
  recentCompleted:   [],
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Format duration in ms to a short human-readable string.
 * @param {number|null} ms
 * @returns {string}
 */
export function formatHealthDuration(ms) {
  if (!ms && ms !== 0) return "—";
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes > 0) return `${minutes}m${String(seconds).padStart(2, "0")}s`;
  return `${seconds}s`;
}

/**
 * Format an ISO timestamp to a short locale string (HH:MM · DD/MM).
 * @param {string|null} iso
 * @returns {string}
 */
export function formatHealthTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day:    "2-digit",
    month:  "2-digit",
    hour:   "2-digit",
    minute: "2-digit",
  });
}
