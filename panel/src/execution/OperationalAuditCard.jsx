// ============================================================================
// OperationalAuditCard — P21 — Fase 5 Observabilidade
// Auditoria operacional por execução: o que aconteceu / o que falhou /
// o que foi aprovado.
//
// NÃO duplica:
//   - Replay detalhado (UnifiedReplayBlock)
//   - Logs funcionais (FunctionalLogsCard / P20)
//   - Timeline macro (MacroCycleTimeline / P19)
//   - Operação ao vivo (OperationalLiveCard)
//   - ExecutionTimeline (micro-eventos)
//
// Props:
//   execution    — objeto da execução (pode ser null → estado vazio honesto)
//   currentState — string do EXECUTION_STATUS
//
// Derivação de dados — sem contratos novos:
//   O que aconteceu: metrics + executionSummary (hadBrowserNavigation, hadCodeChange)
//   O que falhou:    error + eventos com status ERROR/BLOCKED
//   O que foi aprovado: eventos com status DONE + result.summary
// ============================================================================

import { EXECUTION_STATUS, EVENT_STATUS, formatElapsed } from "./mockExecution";

// ── Section icons & colors ────────────────────────────────────────────────────

const SECTION = {
  happened:  { icon: "◉", label: "O que aconteceu",    color: "var(--color-primary)" },
  failed:    { icon: "⊘", label: "O que falhou",        color: "#F59E0B" },
  approved:  { icon: "✓", label: "O que foi aprovado",  color: "#10B981" },
};

// ── Data derivation helpers ───────────────────────────────────────────────────

/**
 * Returns lines describing what happened during the execution.
 * @param {object|null} execution
 * @param {string} currentState
 * @returns {string[]}
 */
function deriveHappened(execution, currentState) {
  if (!execution) return [];

  const lines = [];
  const { metrics, executionSummary, status } = execution;

  // Steps narrative
  if (metrics) {
    const { stepsTotal, stepsDone, elapsedMs } = metrics;
    const elapsed = formatElapsed(elapsedMs);

    if (status === EXECUTION_STATUS.COMPLETED) {
      lines.push(`${stepsDone} de ${stepsTotal} etapas concluídas em ${elapsed}`);
    } else if (status === EXECUTION_STATUS.FAILED) {
      lines.push(`${stepsDone} de ${stepsTotal} etapas concluídas antes da falha (${elapsed})`);
    } else if (status === EXECUTION_STATUS.BLOCKED) {
      lines.push(`Execução retida no gate — nenhuma etapa iniciada (${elapsed})`);
    } else if (status === EXECUTION_STATUS.RUNNING) {
      lines.push(`${stepsDone} de ${stepsTotal} etapas em andamento (${elapsed})`);
    }
  }

  // Additional flags from executionSummary
  if (executionSummary) {
    if (executionSummary.hadBrowserNavigation) lines.push("Navegação browser executada");
    if (executionSummary.hadCodeChange)        lines.push("Alteração de código aplicada");
  }

  return lines;
}

/**
 * Returns lines describing what failed.
 * @param {object|null} execution
 * @returns {{ lines: string[], hasFailed: boolean }}
 */
function deriveFailed(execution) {
  if (!execution) return { lines: [], hasFailed: false };

  const lines = [];

  // Error message
  if (execution.error?.message) {
    lines.push(execution.error.message);
  }

  // Count events with error/blocked status (beyond what the error message already covers)
  const errorEvents = (execution.events ?? []).filter(
    (e) => e.status === EVENT_STATUS.ERROR || e.status === EVENT_STATUS.BLOCKED,
  );
  if (errorEvents.length > 0 && !execution.error?.message) {
    lines.push(
      `${errorEvents.length} evento${errorEvents.length !== 1 ? "s" : ""} com erro ou bloqueio`,
    );
  }

  return { lines, hasFailed: lines.length > 0 };
}

/**
 * Returns lines describing what was approved / completed successfully.
 * @param {object|null} execution
 * @returns {string[]}
 */
function deriveApproved(execution) {
  if (!execution) return [];

  const lines = [];

  // Done events count
  const doneEvents = (execution.events ?? []).filter(
    (e) => e.status === EVENT_STATUS.DONE,
  );
  if (doneEvents.length > 0) {
    lines.push(
      `${doneEvents.length} evento${doneEvents.length !== 1 ? "s" : ""} concluído${doneEvents.length !== 1 ? "s" : ""} com sucesso`,
    );
  }

  // Result summary (if available)
  if (execution.result?.summary) {
    lines.push(execution.result.summary);
  }

  return lines;
}

// ── Section component ─────────────────────────────────────────────────────────

function AuditSection({ section, lines, emptyText }) {
  const isEmpty = !lines || lines.length === 0;

  return (
    <div style={s.section}>
      {/* Section header */}
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionIcon, color: section.color }} aria-hidden="true">
          {section.icon}
        </span>
        <span style={{ ...s.sectionLabel, color: section.color }}>{section.label}</span>
      </div>

      {/* Section body */}
      {isEmpty ? (
        <p style={s.emptyText}>{emptyText}</p>
      ) : (
        <ul style={s.lineList}>
          {lines.map((line, i) => (
            // eslint-disable-next-line react/no-array-index-key
            <li key={i} style={s.lineItem}>
              {line}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ execution: object|null, currentState: string }} props
 */
export default function OperationalAuditCard({ execution, currentState }) {
  const isRunning   = currentState === EXECUTION_STATUS.RUNNING;
  const hasExecution = execution !== null && execution !== undefined;

  const happenedLines = deriveHappened(execution, currentState);
  const { lines: failedLines, hasFailed } = deriveFailed(execution);
  const approvedLines = deriveApproved(execution);

  // Badge label
  let badgeLabel = "SEM DADOS";
  let badgeStyle = s.badgeEmpty;
  if (hasExecution) {
    if (currentState === EXECUTION_STATUS.COMPLETED) {
      badgeLabel = "CONCLUÍDA";
      badgeStyle = s.badgeCompleted;
    } else if (currentState === EXECUTION_STATUS.FAILED) {
      badgeLabel = "FALHOU";
      badgeStyle = s.badgeFailed;
    } else if (currentState === EXECUTION_STATUS.BLOCKED) {
      badgeLabel = "BLOQUEADA";
      badgeStyle = s.badgeBlocked;
    } else if (isRunning) {
      badgeLabel = "EM CURSO";
      badgeStyle = s.badgeRunning;
    }
  }

  return (
    <div style={s.card} role="region" aria-label="Auditoria operacional da execução">

      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.titleIcon} aria-hidden="true">◈</span>
          <p style={s.cardTitle}>Auditoria operacional</p>
        </div>
        <span style={{ ...s.badge, ...badgeStyle }}>{badgeLabel}</span>
      </div>

      {/* No execution data */}
      {!hasExecution && (
        <p style={s.globalEmpty}>
          Nenhuma execução disponível para auditoria.
        </p>
      )}

      {/* Three audit sections */}
      {hasExecution && (
        <div style={s.sections}>
          <AuditSection
            section={SECTION.happened}
            lines={happenedLines}
            emptyText="Sem informações sobre o que ocorreu."
          />

          <AuditSection
            section={SECTION.failed}
            lines={hasFailed ? failedLines : []}
            emptyText="Nenhuma falha registrada."
          />

          <AuditSection
            section={SECTION.approved}
            lines={approvedLines}
            emptyText={
              isRunning
                ? "Aguardando conclusão das etapas."
                : "Nenhuma aprovação registrada."
            }
          />
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "14px 16px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  // Header
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  titleIcon: {
    fontSize: "13px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.1px",
    textTransform: "uppercase",
    margin: 0,
  },

  // Badges
  badge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    padding: "2px 7px",
    borderRadius: "4px",
    border: "1px solid",
  },
  badgeEmpty: {
    color: "var(--text-muted)",
    background: "transparent",
    borderColor: "var(--border)",
    opacity: 0.6,
  },
  badgeCompleted: {
    color: "#10B981",
    background: "rgba(16,185,129,0.10)",
    borderColor: "rgba(16,185,129,0.28)",
  },
  badgeFailed: {
    color: "#EF4444",
    background: "rgba(239,68,68,0.08)",
    borderColor: "rgba(239,68,68,0.25)",
  },
  badgeBlocked: {
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    borderColor: "rgba(245,158,11,0.28)",
  },
  badgeRunning: {
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    borderColor: "var(--color-primary-border)",
  },

  // Sections container
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },

  // Individual section
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },
  sectionIcon: {
    fontSize: "11px",
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  },
  sectionLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.4px",
  },

  // Lines list
  lineList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    paddingLeft: "16px",
  },
  lineItem: {
    fontSize: "11px",
    color: "var(--text-primary)",
    lineHeight: 1.5,
    position: "relative",
  },

  // Empty texts
  emptyText: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.7,
    margin: 0,
    paddingLeft: "16px",
    lineHeight: 1.4,
  },
  globalEmpty: {
    fontSize: "12px",
    color: "var(--text-muted)",
    opacity: 0.7,
    margin: 0,
    textAlign: "center",
    padding: "8px 0",
    lineHeight: 1.5,
  },
};
