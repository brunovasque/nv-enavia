import { useState, useEffect } from "react";
import { fetchMemory, MEMORY_STATES, MEMORY_FILTERS } from "../api";
import MemoryHeader from "../memory/MemoryHeader";
import LiveContextBlock from "../memory/LiveContextBlock";
import CanonicalMemoryCard from "../memory/CanonicalMemoryCard";
import OperationalMemoryCard from "../memory/OperationalMemoryCard";
import ConsolidationBlock from "../memory/ConsolidationBlock";
import MemoryEntryList from "../memory/MemoryEntryList";
import EmptyMemoryState from "../memory/EmptyMemoryState";
import MemoryInUseCard from "../memory/MemoryInUseCard";
import ManualMemoryPanel from "../memory/ManualMemoryPanel";

export default function MemoryPage() {
  const [currentState, setCurrentState] = useState(MEMORY_STATES.POPULATED);
  const [activeFilter, setActiveFilter] = useState(MEMORY_FILTERS.ALL);
  const [tierFilter, setTierFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    setLoading(true);
    setFetchError(null);
    fetchMemory({ _mockState: currentState }).then((r) => {
      if (r.ok) {
        setMemory(r.data.memory);
      } else {
        setMemory(null);
        setFetchError(r.error?.message ?? "Erro ao carregar memória.");
      }
      setLoading(false);
    });
  }, [currentState]);

  if (fetchError) {
    return (
      <div style={{ padding: "40px 24px", color: "#EF4444", fontSize: "13px" }}>
        ⚠ {fetchError}
      </div>
    );
  }

  if (loading || !memory) {
    return (
      <div style={{ padding: "40px 24px", color: "var(--text-muted)", fontSize: "13px" }}>
        Carregando...
      </div>
    );
  }

  const hasMemory = memory.summary.total > 0;

  // Derive unique tiers and priorities from current entries for secondary filters
  const allEntries = [
    ...(memory.canonicalEntries ?? []),
    ...(memory.operationalEntries ?? []),
  ];
  const availableTiers = [...new Set(allEntries.map((e) => e.tier).filter(Boolean))].sort(
    (a, b) => a - b,
  );
  const PRIORITY_ORDER = ["critical", "high", "medium", "low"];
  const availablePriorities = PRIORITY_ORDER.filter((p) =>
    allEntries.some((e) => e.priority === p),
  );

  return (
    <div style={s.page}>
      {/* Header: stats + filters + state switcher */}
      <MemoryHeader
        memory={memory}
        currentState={currentState}
        tierFilter={tierFilter}
        onTierFilterChange={setTierFilter}
        priorityFilter={priorityFilter}
        onPriorityFilterChange={setPriorityFilter}
        availableTiers={availableTiers}
        availablePriorities={availablePriorities}
        onStateChange={(st) => {
          setCurrentState(st);
          setActiveFilter(MEMORY_FILTERS.ALL);
          setTierFilter("all");
          setPriorityFilter("all");
        }}
        activeFilter={activeFilter}
        onFilterChange={setActiveFilter}
      />

      {/* P18-PR1: Memory-in-use visibility card — always rendered */}
      <MemoryInUseCard memory={memory} />

      {/* PR4: Manual Memory Panel — operator CRUD for manual instructions */}
      <ManualMemoryPanel />

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
                tierFilter={tierFilter}
                priorityFilter={priorityFilter}
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
