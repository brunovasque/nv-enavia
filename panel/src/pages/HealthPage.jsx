// ============================================================================
// ENAVIA Panel — HealthPage (P22)
// Saúde da Enavia — visão macro e operacional do sistema.
//
// ESCOPO: PANEL-ONLY
// NÃO repete:
//   - ExecutionPage (/execution) — visão individual
//   - MacroCycleTimeline (P19)
//   - FunctionalLogsCard (P20)
//   - OperationalAuditCard (P21)
//   - UnifiedReplayBlock / ExecutionTimeline
//
// Dados derivados de mockHealth.js (agregado do sistema, não execução única).
// ============================================================================

import { useState, useEffect } from "react";
import { fetchHealth, getApiConfig } from "../api";
import {
  MOCK_HEALTH,
  HEALTH_STATUS,
  formatHealthDuration,
  formatHealthTs,
} from "../health/mockHealth";

// ── System status display metadata ───────────────────────────────────────────

const STATUS_META = {
  [HEALTH_STATUS.HEALTHY]:  { label: "SAUDÁVEL",  color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.28)" },
  [HEALTH_STATUS.DEGRADED]: { label: "DEGRADADO", color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.28)" },
  [HEALTH_STATUS.CRITICAL]: { label: "CRÍTICO",   color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)"  },
  [HEALTH_STATUS.IDLE]:     { label: "SEM DADOS", color: "var(--text-muted)", bg: "transparent", border: "var(--border)" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

/** Summary stat card — one of the four top counters. */
function StatCard({ icon, value, label, color }) {
  return (
    <div style={s.statCard}>
      <span style={{ ...s.statIcon, color }} aria-hidden="true">{icon}</span>
      <span style={{ ...s.statValue, color }}>{value}</span>
      <span style={s.statLabel}>{label}</span>
    </div>
  );
}

/** Section wrapper with title and optional empty state. */
function Section({ icon, title, color, isEmpty, emptyText, children }) {
  return (
    <div style={s.section}>
      <div style={s.sectionHeader}>
        <span style={{ ...s.sectionIcon, color }} aria-hidden="true">{icon}</span>
        <span style={{ ...s.sectionTitle, color }}>{title}</span>
      </div>
      {isEmpty ? (
        <p style={s.sectionEmpty}>{emptyText}</p>
      ) : (
        children
      )}
    </div>
  );
}

/** Single row for a recent error. */
function ErrorRow({ item }) {
  return (
    <div style={s.row}>
      <div style={s.rowMain}>
        <span style={s.rowLabel}>{item.requestLabel}</span>
        <span style={s.rowMeta}>{item.message}</span>
      </div>
      <span style={s.rowTime}>{formatHealthTs(item.failedAt)}</span>
    </div>
  );
}

/** Single row for a blocked execution. */
function BlockedRow({ item }) {
  return (
    <div style={s.row}>
      <div style={s.rowMain}>
        <span style={s.rowLabel}>{item.requestLabel}</span>
        <span style={s.rowMeta}>{item.reason}</span>
        {item.nextAction && (
          <span style={s.rowAction}>→ {item.nextAction}</span>
        )}
      </div>
      <span style={s.rowTime}>{formatHealthTs(item.blockedAt)}</span>
    </div>
  );
}

/** Single row for a completed execution. */
function CompletedRow({ item }) {
  return (
    <div style={s.row}>
      <div style={s.rowMain}>
        <span style={s.rowLabel}>{item.requestLabel}</span>
        <span style={s.rowMeta}>{item.summary}</span>
      </div>
      <div style={s.rowRight}>
        <span style={s.rowDuration}>{formatHealthDuration(item.durationMs)}</span>
        <span style={s.rowTime}>{formatHealthTs(item.completedAt)}</span>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

/**
 * P22 — Painel de saúde da Enavia.
 * Visão macro e operacional do sistema.
 */
export default function HealthPage() {
  // Initial state: MOCK_HEALTH (keeps static render / tests working).
  // In real mode, useEffect fetches and replaces with real minimal data.
  const [health, setHealth] = useState(MOCK_HEALTH);

  useEffect(() => {
    const { mode } = getApiConfig();
    if (mode !== "real") return; // mock mode — keep MOCK_HEALTH

    fetchHealth()
      .then((res) => {
        if (res.ok && res.data) setHealth(res.data);
      })
      .catch(() => {
        // fetch failure — keep initial state (MOCK_HEALTH fallback)
      });
  }, []);

  const statusMeta = STATUS_META[health.status] ?? STATUS_META[HEALTH_STATUS.IDLE];
  const { summary, recentErrors, blockedExecutions, recentCompleted } = health;

  const isIdle = health.status === HEALTH_STATUS.IDLE;

  return (
    <div style={s.page} role="main">

      {/* ── Page header ────────────────────────────────────────────────────── */}
      <div style={s.pageHeader}>
        <div style={s.titleGroup}>
          <span style={s.titleIcon} aria-hidden="true">◆</span>
          <h1 style={s.pageTitle}>Saúde da Enavia</h1>
        </div>
        <span
          style={{
            ...s.statusBadge,
            color:            statusMeta.color,
            background:       statusMeta.bg,
            borderColor:      statusMeta.border,
          }}
          role="status"
          aria-label={`Status do sistema: ${statusMeta.label}`}
        >
          {statusMeta.label}
        </span>
      </div>

      {/* ── Idle / no data ──────────────────────────────────────────────────── */}
      {isIdle && (
        <div style={s.idleBlock} role="status">
          <span style={s.idleIcon} aria-hidden="true">◉</span>
          <p style={s.idleText}>Nenhuma execução recente registrada.</p>
          <p style={s.idleSub}>O sistema está ocioso. O painel será atualizado quando houver atividade.</p>
        </div>
      )}

      {/* ── Summary stats row ───────────────────────────────────────────────── */}
      {!isIdle && (
        <div style={s.statsRow} aria-label="Resumo de execuções">
          <StatCard
            icon="✓"
            value={summary.completed}
            label="Concluídas"
            color="#10B981"
          />
          <StatCard
            icon="✕"
            value={summary.failed}
            label="Com erro"
            color="#EF4444"
          />
          <StatCard
            icon="⏳"
            value={summary.blocked}
            label="Bloqueadas"
            color="#F59E0B"
          />
          <StatCard
            icon="▷"
            value={summary.running}
            label="Em curso"
            color="var(--color-primary)"
          />
        </div>
      )}

      {/* ── Sections ────────────────────────────────────────────────────────── */}
      {!isIdle && (
        <div style={s.sections}>

          {/* Recent errors */}
          <Section
            icon="⊘"
            title="Erros recentes"
            color="#EF4444"
            isEmpty={recentErrors.length === 0}
            emptyText="Nenhum erro recente registrado."
          >
            <div style={s.rowList} aria-label="Erros recentes">
              {recentErrors.map((item) => (
                <ErrorRow key={item.id} item={item} />
              ))}
            </div>
          </Section>

          {/* Blocked executions */}
          <Section
            icon="⏳"
            title="Execuções bloqueadas"
            color="#F59E0B"
            isEmpty={blockedExecutions.length === 0}
            emptyText="Nenhuma execução bloqueada no momento."
          >
            <div style={s.rowList} aria-label="Execuções bloqueadas">
              {blockedExecutions.map((item) => (
                <BlockedRow key={item.id} item={item} />
              ))}
            </div>
          </Section>

          {/* Recently completed */}
          <Section
            icon="◎"
            title="Concluídas recentes"
            color="#10B981"
            isEmpty={recentCompleted.length === 0}
            emptyText="Nenhuma execução concluída recentemente."
          >
            <div style={s.rowList} aria-label="Execuções concluídas recentes">
              {recentCompleted.map((item) => (
                <CompletedRow key={item.id} item={item} />
              ))}
            </div>
          </Section>

        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  // ── Page layout
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px 24px",
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
  },

  // ── Header
  pageHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  titleIcon: {
    fontSize: "16px",
    color: "var(--color-primary)",
    lineHeight: 1,
  },
  pageTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
  },
  statusBadge: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "1px",
    padding: "3px 10px",
    borderRadius: "5px",
    border: "1px solid",
  },

  // ── Idle state
  idleBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    padding: "48px 24px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    textAlign: "center",
  },
  idleIcon: {
    fontSize: "28px",
    color: "var(--text-muted)",
    opacity: 0.4,
  },
  idleText: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-secondary)",
    fontWeight: 500,
  },
  idleSub: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },

  // ── Stats row
  statsRow: {
    display: "flex",
    gap: "12px",
    flexShrink: 0,
  },
  statCard: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "4px",
    padding: "16px 12px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    minWidth: 0,
  },
  statIcon: {
    fontSize: "16px",
    fontWeight: 700,
    lineHeight: 1,
  },
  statValue: {
    fontSize: "22px",
    fontWeight: 700,
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  statLabel: {
    fontSize: "10px",
    fontWeight: 500,
    color: "var(--text-muted)",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    textAlign: "center",
  },

  // ── Sections container
  sections: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },

  // ── Individual section
  section: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "14px 16px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    flexShrink: 0,
  },
  sectionIcon: {
    fontSize: "12px",
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  },
  sectionTitle: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.8px",
    textTransform: "uppercase",
  },
  sectionEmpty: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    opacity: 0.7,
    paddingLeft: "18px",
    lineHeight: 1.5,
  },

  // ── Row list
  rowList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  // ── Individual row
  row: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "12px",
    padding: "8px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
  },
  rowMain: {
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
    flex: 1,
  },
  rowLabel: {
    fontSize: "12px",
    fontWeight: 600,
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  rowMeta: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },
  rowAction: {
    fontSize: "11px",
    color: "#F59E0B",
    lineHeight: 1.4,
    marginTop: "2px",
  },
  rowRight: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "2px",
    flexShrink: 0,
  },
  rowDuration: {
    fontSize: "11px",
    fontWeight: 600,
    color: "#10B981",
    fontVariantNumeric: "tabular-nums",
  },
  rowTime: {
    fontSize: "10px",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    flexShrink: 0,
    fontVariantNumeric: "tabular-nums",
  },
};
