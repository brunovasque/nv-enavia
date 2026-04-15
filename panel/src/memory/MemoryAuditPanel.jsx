// ============================================================================
// MemoryAuditPanel — PR6: Telemetria / Auditoria da Memória e Aprendizado
//
// Minimal, read-only UI showing recent audit events for memory operations
// and learning candidate lifecycle.
//
// Contract: visibilidade mínima e útil dos eventos auditáveis.
// Sem dashboard gigante, sem analytics sofisticados.
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { listAuditEvents } from "../api";

// ---------------------------------------------------------------------------
// Event type labels and colors
// ---------------------------------------------------------------------------
const EVENT_STYLES = {
  memory_created:        { icon: "📝", label: "Memória criada",      color: "#10B981" },
  memory_updated:        { icon: "✏️",  label: "Memória atualizada",  color: "#3B82F6" },
  memory_blocked:        { icon: "🚫", label: "Memória bloqueada",   color: "#EF4444" },
  memory_invalidated:    { icon: "⏰", label: "Memória invalidada",  color: "#F59E0B" },
  candidate_registered:  { icon: "📋", label: "Candidato registrado", color: "#8B5CF6" },
  candidate_approved:    { icon: "✅", label: "Candidato aprovado",  color: "#10B981" },
  candidate_rejected:    { icon: "❌", label: "Candidato rejeitado", color: "#EF4444" },
};

function EventTypeBadge({ eventType }) {
  const st = EVENT_STYLES[eventType] || { icon: "•", label: eventType, color: "var(--text-muted)" };
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: "4px",
        fontSize: "10px", fontWeight: 600, padding: "2px 8px",
        borderRadius: "10px", border: `1px solid ${st.color}30`,
        color: st.color, background: `${st.color}12`, whiteSpace: "nowrap",
      }}
    >
      {st.icon} {st.label}
    </span>
  );
}

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------
export default function MemoryAuditPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters = {};
    if (eventTypeFilter !== "all") filters.event_type = eventTypeFilter;
    filters.limit = 50;
    const result = await listAuditEvents(filters);
    if (result.ok) {
      setItems(result.data?.items || []);
    } else {
      setError(result.error?.message || "Erro ao carregar eventos de auditoria");
    }
    setLoading(false);
  }, [eventTypeFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>📋</span>
          <div>
            <p style={s.title}>Auditoria da Memória</p>
            <p style={s.subtitle}>
              Eventos recentes — rastreabilidade de escrita, bloqueio, aprendizado
            </p>
          </div>
        </div>
        <div style={s.headerRight}>
          <select
            style={s.filterSelect}
            value={eventTypeFilter}
            onChange={(e) => setEventTypeFilter(e.target.value)}
            data-testid="audit-event-filter"
          >
            <option value="all">Todos os eventos</option>
            <option value="memory_created">Memória criada</option>
            <option value="memory_updated">Memória atualizada</option>
            <option value="memory_blocked">Memória bloqueada</option>
            <option value="memory_invalidated">Memória invalidada</option>
            <option value="candidate_registered">Candidato registrado</option>
            <option value="candidate_approved">Candidato aprovado</option>
            <option value="candidate_rejected">Candidato rejeitado</option>
          </select>
          <button style={s.refreshBtn} onClick={loadItems} data-testid="audit-refresh-btn">
            ↻ Atualizar
          </button>
        </div>
      </div>

      {/* Loading / Error */}
      {loading && <p style={s.info}>Carregando eventos...</p>}
      {error && <p style={s.errorMsg}>⚠ {error}</p>}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && (
        <p style={s.emptyText}>Nenhum evento de auditoria registrado.</p>
      )}

      {/* Event list */}
      {!loading && items.length > 0 && (
        <div style={s.list}>
          <div style={s.listHeader}>
            <span style={s.colType}>Evento</span>
            <span style={s.colId}>Alvo</span>
            <span style={s.colRelated}>Relacionado</span>
            <span style={s.colSource}>Origem</span>
            <span style={s.colSummary}>Resumo</span>
            <span style={s.colTs}>Timestamp</span>
          </div>
          {items.map((item) => (
            <div key={item.event_id} style={s.row} data-testid="audit-row">
              <span style={s.colType}>
                <EventTypeBadge eventType={item.event_type} />
              </span>
              <span style={s.colId} title={item.target_id}>
                <span style={s.monoText}>{item.target_id}</span>
              </span>
              <span style={s.colRelated} title={item.related_id || "—"}>
                {item.related_id ? (
                  <span style={s.monoText}>{item.related_id}</span>
                ) : (
                  <span style={s.mutedText}>—</span>
                )}
              </span>
              <span style={s.colSource}>
                <span style={s.sourceBadge}>{item.source}</span>
              </span>
              <span style={s.colSummary} title={item.summary}>
                {item.summary}
              </span>
              <span style={s.colTsMono}>
                {formatTs(item.timestamp)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const s = {
  wrap: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: "12px",
    flexWrap: "wrap",
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  headerIcon: { fontSize: "20px" },
  title: {
    fontSize: "14px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.2px",
  },
  subtitle: {
    fontSize: "11px",
    color: "var(--text-muted)",
    marginTop: "1px",
  },
  filterSelect: {
    padding: "4px 8px",
    fontSize: "11px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    cursor: "pointer",
  },
  refreshBtn: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "4px 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  },
  info: { fontSize: "12px", color: "var(--text-muted)", padding: "8px 0" },
  errorMsg: { fontSize: "12px", color: "#EF4444", padding: "8px 0" },
  emptyText: { fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" },
  list: {
    display: "flex",
    flexDirection: "column",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    overflow: "hidden",
    maxHeight: "400px",
    overflowY: "auto",
  },
  listHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    background: "var(--bg-base)",
    borderBottom: "1px solid var(--border)",
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: "11px",
    color: "var(--text-secondary)",
  },
  colType: { flex: "0 0 160px" },
  colId: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  colRelated: { flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  colSource: { flex: "0 0 80px" },
  colSummary: { flex: 2, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  colTs: { flex: "0 0 130px", textAlign: "right" },
  colTsMono: { flex: "0 0 130px", textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "10px" },
  monoText: {
    fontFamily: "var(--font-mono)",
    fontSize: "10px",
    color: "var(--text-primary)",
  },
  mutedText: {
    fontSize: "10px",
    color: "var(--text-muted)",
  },
  sourceBadge: {
    fontSize: "9px",
    fontWeight: 600,
    background: "rgba(59,130,246,0.08)",
    color: "#3B82F6",
    border: "1px solid rgba(59,130,246,0.3)",
    padding: "1px 4px",
    borderRadius: "3px",
  },
};
