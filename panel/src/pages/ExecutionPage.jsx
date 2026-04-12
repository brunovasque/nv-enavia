import { useState, useEffect } from "react";
import { fetchExecution, EXECUTION_STATUS } from "../api";
import ExecutionHeader from "../execution/ExecutionHeader";
import ExecutionStatusCard from "../execution/ExecutionStatusCard";
import CurrentStepBlock from "../execution/CurrentStepBlock";
import ExecutionTimeline from "../execution/ExecutionTimeline";
import ResultBlock from "../execution/ResultBlock";
import ErrorBlock from "../execution/ErrorBlock";
import IdleState from "../execution/IdleState";

export default function ExecutionPage() {
  const [currentState, setCurrentState] = useState(EXECUTION_STATUS.RUNNING);
  const [execution, setExecution] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetchExecution({ _mockState: currentState }).then((r) => {
      if (r.ok) {
        setExecution(r.data.execution);
      } else {
        setExecution(null);
        setFetchError(r.error?.message ?? "Erro ao carregar execução.");
      }
      setLoading(false);
    });
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
      {/* Header — always visible */}
      <ExecutionHeader
        execution={execution}
        currentState={currentState}
        onStateChange={setCurrentState}
      />

      {/* Idle state fills the rest */}
      {isIdle && <IdleState />}

      {/* Active execution body */}
      {!isIdle && (
        <>
          {/* Error/blocked banner */}
          {hasError && execution?.error && (
            <ErrorBlock error={execution.error} status={currentState} />
          )}

          {/* Running: current step indicator */}
          {isRunning && execution?.currentStep && (
            <CurrentStepBlock step={execution.currentStep} />
          )}

          {/* Body: main (timeline) + sidebar */}
          <div style={s.body}>
            {/* ── Main column ─────────────────────────────────────── */}
            <div
              style={{
                ...s.main,
                ...(isCompleted ? s.mainCompleted : {}),
              }}
            >
              {/* Completed: result hero comes first */}
              {isCompleted && execution?.result && (
                <ResultBlock result={execution.result} />
              )}

              {/* Timeline — dominant in running, history in completed */}
              <ExecutionTimeline
                events={execution?.events ?? []}
                isHistory={isCompleted}
              />
            </div>

            {/* ── Sidebar ─────────────────────────────────────────── */}
            <div style={s.sidebar}>
              <ExecutionStatusCard execution={execution} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    height: "100%",
    overflow: "hidden",
    padding: "4px 0 0",
  },
  body: {
    display: "flex",
    gap: "16px",
    flex: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  // Running: main fills height, timeline scrolls internally
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflow: "hidden",
  },
  // Completed: main column scrolls, result hero + full timeline
  mainCompleted: {
    overflowY: "auto",
    overflowX: "hidden",
    paddingBottom: "24px",
  },
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
