import { useState, useEffect } from "react";
import { fetchMemory, MEMORY_STATES, MEMORY_FILTERS } from "../api";
import MemoryHeader from "../memory/MemoryHeader";
import LiveContextBlock from "../memory/LiveContextBlock";
import CanonicalMemoryCard from "../memory/CanonicalMemoryCard";
import OperationalMemoryCard from "../memory/OperationalMemoryCard";
import ConsolidationBlock from "../memory/ConsolidationBlock";
import MemoryEntryList from "../memory/MemoryEntryList";
import EmptyMemoryState from "../memory/EmptyMemoryState";

export default function MemoryPage() {
  const [currentState, setCurrentState] = useState(MEMORY_STATES.POPULATED);
  const [activeFilter, setActiveFilter] = useState(MEMORY_FILTERS.ALL);
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchMemory({ _mockState: currentState }).then((r) => {
      setMemory(r.ok ? r.data.memory : null);
      setLoading(false);
    });
  }, [currentState]);

  if (loading || !memory) {
    return (
      <div style={{ padding: "40px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        Carregando...
      </div>
    );
  }

  const hasMemory = memory.summary.total > 0;

  return (
    <div style={s.page}>
      {/* Header: stats + filters + state switcher */}
      <MemoryHeader
        memory={memory}
        currentState={currentState}
        onStateChange={(st) => {
          setCurrentState(st);
          setActiveFilter(MEMORY_FILTERS.ALL);
        }}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* Empty state */}
      {!hasMemory ? (
        <EmptyMemoryState />
      ) : (
        <>
          {/* Live context — full width, has presence */}
          <LiveContextBlock liveContext={memory.liveContext} />

          {/* 2-column body */}
          <div style={s.body}>
            {/* Main column: filterable entry list */}
            <div style={s.main}>
              <MemoryEntryList
                canonicalEntries={memory.canonicalEntries}
                operationalEntries={memory.operationalEntries}
                activeFilter={activeFilter}
              />
            </div>

            {/* Sidebar column: type cards + consolidation */}
            <div style={s.sidebar}>
              <CanonicalMemoryCard entries={memory.canonicalEntries} />
              <OperationalMemoryCard entries={memory.operationalEntries} />
              <ConsolidationBlock
                consolidation={memory.consolidation}
                memoryState={currentState}
              />
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
    gap: "16px",
    height: "100%",
    overflowY: "auto",
    padding: "4px 0 24px",
  },
  body: {
    display: "flex",
    gap: "16px",
    alignItems: "flex-start",
    flex: 1,
    minHeight: 0,
  },
  main: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "0",
    minHeight: "400px",
  },
  sidebar: {
    width: "268px",
    minWidth: "268px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    flexShrink: 0,
  },
};
