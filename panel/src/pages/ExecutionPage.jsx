import { useState, useEffect } from "react";
import { fetchExecution, EXECUTION_STATUS } from "../api";
import { useExecutionStore, setExecutionState } from "../store/executionStore";
import ExecutionHeader from "../execution/ExecutionHeader";
import ExecutionStatusCard from "../execution/ExecutionStatusCard";
import CurrentStepBlock from "../execution/CurrentStepBlock";
import ExecutionTimeline from "../execution/ExecutionTimeline";
import OperationalLiveCard from "../execution/OperationalLiveCard";
import CodeTrailCard from "../execution/CodeTrailCard";
import LiveTrailCard from "../execution/LiveTrailCard";
import IncrementalDiffCard from "../execution/IncrementalDiffCard";
import ConsolidatedFeedCard from "../execution/ConsolidatedFeedCard";
import ResultBlock from "../execution/ResultBlock";
import ErrorBlock from "../execution/ErrorBlock";
import IdleState from "../execution/IdleState";
import UnifiedReplayBlock from "../execution/UnifiedReplayBlock";

// ── Tab definitions ───────────────────────────────────────────────────────────

const TABS = [
  { id: "codigo",   label: "Código",   icon: "⊞" },
  { id: "diff",     label: "Diff",     icon: "±" },
  { id: "mudancas", label: "Mudanças", icon: "☰" },
  { id: "replay",   label: "Replay",   icon: "⊡" },
];

// Stable IDs derived from TABS — avoids hardcoded strings elsewhere
const TAB_ID = Object.fromEntries(TABS.map((t) => [t.id, t.id]));

function tabBtnId(id)   { return `exec-tab-${id}`; }
function tabPanelId(id) { return `exec-tabpanel-${id}`; }

// ── Tab button ────────────────────────────────────────────────────────────────

function TabButton({ tab, active, onClick }) {
  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onClick(tab.id);
    }
  }

  return (
    <button
      id={tabBtnId(tab.id)}
      role="tab"
      aria-selected={active}
      aria-controls={tabPanelId(tab.id)}
      style={{
        ...s.tabBtn,
        ...(active ? s.tabBtnActive : {}),
      }}
      onClick={() => onClick(tab.id)}
      onKeyDown={handleKeyDown}
    >
      <span style={{ ...s.tabIcon, ...(active ? s.tabIconActive : {}) }} aria-hidden="true">
        {tab.icon}
      </span>
      {tab.label}
    </button>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ExecutionPage() {
  const { currentState } = useExecutionStore();
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [activeTab, setActiveTab] = useState(TAB_ID.codigo);

  useEffect(() => {
    // Stale-response guard: if currentState changes before the previous fetch
    // resolves, the cleanup sets stale=true and the old .then() becomes a no-op.
    let stale = false;

    setLoading(true);
    setFetchError(null);
    fetchExecution({ _mockState: currentState }).then((r) => {
      if (stale) return;
      if (r.ok) {
        setExecution(r.data.execution);
      } else {
        setExecution(null);
        setFetchError(r.error?.message ?? "Erro ao carregar execução.");
      }
      setLoading(false);
    });

    return () => { stale = true; };
  }, [currentState]);

  // Reset active tab when execution state changes:
  // completed/blocked/failed -> Replay is most useful; running -> Código
  useEffect(() => {
    if (
      currentState === EXECUTION_STATUS.COMPLETED ||
      currentState === EXECUTION_STATUS.BLOCKED ||
      currentState === EXECUTION_STATUS.FAILED
    ) {
      setActiveTab(TAB_ID.replay);
    } else {
      setActiveTab(TAB_ID.codigo);
    }
  }, [currentState]);

  if (loading) {
    return (
      <div style={{ padding: "40px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        Carregando...
      </div>
    );
  }

  if (fetchError) {
    return (
      <div style={{ padding: "40px 24px", color: "#EF4444", fontSize: "13px" }}>
        ⚠ {fetchError}
      </div>
    );
  }

  const isIdle = currentState === EXECUTION_STATUS.IDLE;
  const isRunning = currentState === EXECUTION_STATUS.RUNNING;
  const isCompleted = currentState === EXECUTION_STATUS.COMPLETED;
  const hasError =
    currentState === EXECUTION_STATUS.BLOCKED ||
    currentState === EXECUTION_STATUS.FAILED;

  return (
    <div style={s.page}>

      {/* ── TOPO FIXO / PRIORITÁRIO ──────────────────────────────────────── */}
      <div style={s.fixedTop}>
        {/* Execução acompanhada — always visible */}
        <ExecutionHeader
          execution={execution}
          currentState={currentState}
          onStateChange={setExecutionState}
        />

        {/* Idle state */}
        {isIdle && <IdleState />}

        {!isIdle && (
          <>
            {/* Error/blocked banner */}
            {hasError && execution?.error && (
              <ErrorBlock error={execution.error} status={currentState} />
            )}

            {/* Completed: result hero */}
            {isCompleted && execution?.result && (
              <ResultBlock result={execution.result} />
            )}

            {/* Etapa atual — running only */}
            {isRunning && execution?.currentStep && (
              <CurrentStepBlock step={execution.currentStep} />
            )}

            {/* Operação ao vivo — F5-PR1, running only */}
            {isRunning && (
              <OperationalLiveCard operation={execution?.operation ?? null} />
            )}
          </>
        )}
      </div>

      {/* ── ÁREA INFERIOR COM TABS INTERNAS ─────────────────────────────── */}
      {!isIdle && (
        <div style={s.body}>

          {/* ── Tab panel ──────────────────────────────────────────────── */}
          <div style={s.tabPanel}>
            {/* Tab bar */}
            <div style={s.tabBar} role="tablist" aria-label="Observabilidade">
              {TABS.map((tab) => (
                <TabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  onClick={setActiveTab}
                />
              ))}
            </div>

            {/* Tab content — scrollable */}
            <div style={s.tabContent}>

              {/* Código — CodeTrailCard + LiveTrailCard */}
              <div
                id={tabPanelId(TAB_ID.codigo)}
                role="tabpanel"
                aria-labelledby={tabBtnId(TAB_ID.codigo)}
                hidden={activeTab !== TAB_ID.codigo}
              >
                <div style={s.tabInner}>
                  <CodeTrailCard codeTrail={execution?.codeTrail ?? null} />
                  <LiveTrailCard liveTrail={execution?.liveTrail ?? null} />
                </div>
              </div>

              {/* Diff — IncrementalDiffCard */}
              <div
                id={tabPanelId(TAB_ID.diff)}
                role="tabpanel"
                aria-labelledby={tabBtnId(TAB_ID.diff)}
                hidden={activeTab !== TAB_ID.diff}
              >
                <div style={s.tabInner}>
                  <IncrementalDiffCard incrementalDiff={execution?.incrementalDiff ?? null} />
                </div>
              </div>

              {/* Mudanças — ConsolidatedFeedCard */}
              <div
                id={tabPanelId(TAB_ID.mudancas)}
                role="tabpanel"
                aria-labelledby={tabBtnId(TAB_ID.mudancas)}
                hidden={activeTab !== TAB_ID.mudancas}
              >
                <div style={s.tabInner}>
                  <ConsolidatedFeedCard changeHistory={execution?.changeHistory ?? null} />
                </div>
              </div>

              {/* Replay — UnifiedReplayBlock (completed/error) + ExecutionTimeline */}
              <div
                id={tabPanelId(TAB_ID.replay)}
                role="tabpanel"
                aria-labelledby={tabBtnId(TAB_ID.replay)}
                hidden={activeTab !== TAB_ID.replay}
              >
                <div style={s.tabInner}>
                  {(isCompleted || hasError) && (
                    <UnifiedReplayBlock
                      events={execution?.events ?? []}
                      browserEvents={execution?.browserEvents ?? []}
                      codeEvents={execution?.codeEvents ?? []}
                      executionSummary={execution?.executionSummary ?? null}
                    />
                  )}
                  <ExecutionTimeline
                    events={execution?.events ?? []}
                    isHistory={isCompleted}
                  />
                </div>
              </div>

            </div>
          </div>

          {/* ── Sidebar ────────────────────────────────────────────────── */}
          <div style={s.sidebar}>
            <ExecutionStatusCard execution={execution} />
          </div>

        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    height: "100%",
    overflow: "hidden",
    padding: "20px 24px 0",
  },

  // Fixed top section — never scrolls away
  fixedTop: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
    overflowY: "auto",
    maxHeight: "50%",
  },

  // Lower area: tab panel + sidebar
  body: {
    display: "flex",
    gap: "16px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
    paddingBottom: "20px",
  },

  // Tab panel (left side of body)
  tabPanel: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
  },

  // Tab bar
  tabBar: {
    display: "flex",
    alignItems: "center",
    gap: "2px",
    padding: "6px 8px",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
    background: "var(--bg-base)",
    borderRadius: "var(--radius-lg) var(--radius-lg) 0 0",
  },

  // Individual tab button
  tabBtn: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    background: "transparent",
    border: "none",
    borderRadius: "6px",
    padding: "5px 12px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    letterSpacing: "0.2px",
    transition: "color 0.15s ease, background 0.15s ease",
  },
  tabBtnActive: {
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    fontWeight: 700,
  },
  tabIcon: {
    fontSize: "12px",
    opacity: 0.6,
    flexShrink: 0,
  },
  tabIconActive: {
    opacity: 1,
  },

  // Scrollable tab content area
  tabContent: {
    flex: 1,
    minHeight: 0,
    overflowY: "auto",
    overflowX: "hidden",
  },

  // Inner wrapper for tab content items
  tabInner: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    padding: "12px",
  },

  // Sidebar
  sidebar: {
    width: "256px",
    minWidth: "256px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
    overflowY: "auto",
  },
};
