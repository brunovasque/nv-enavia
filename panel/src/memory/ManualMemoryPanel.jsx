// ============================================================================
// ManualMemoryPanel — PR4: Manual Memory CRUD Panel
//
// Minimal, functional UI for the operator to:
//   - List manual memories (with status/confidence/tags)
//   - Create new manual memory
//   - Edit existing manual memory
//   - Block / Invalidate manual memory
//
// Contract: memoria_manual persists in backend as MEMORIA_MANUAL type,
// enters retrieval as manual_instructions (PR3).
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  listManualMemories,
  createManualMemory,
  updateManualMemory,
  blockManualMemory,
  invalidateManualMemory,
} from "../api";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
const STATUS_STYLES = {
  active:     { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Ativa" },
  blocked:    { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  label: "Bloqueada" },
  expired:    { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Expirada" },
  archived:   { color: "#64748B", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)", label: "Arquivada" },
  superseded: { color: "#64748B", bg: "rgba(100,116,139,0.1)", border: "rgba(100,116,139,0.25)", label: "Substituída" },
  canonical:  { color: "var(--color-primary)", bg: "var(--color-primary-glow)", border: "var(--color-primary-border)", label: "Canônica" },
};

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.active;
  return (
    <span
      style={{
        fontSize: "10px", fontWeight: 600, padding: "2px 8px",
        borderRadius: "10px", border: `1px solid ${st.border}`,
        color: st.color, background: st.bg, whiteSpace: "nowrap",
      }}
    >
      {st.label}
    </span>
  );
}

function formatTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// Create/Edit Form
// ---------------------------------------------------------------------------
function ManualMemoryForm({ initial, onSave, onCancel }) {
  const isEdit = !!initial;
  const [title, setTitle] = useState(initial?.title || "");
  const [content, setContent] = useState(
    initial?.content_structured?.text || (initial?.content_structured ? JSON.stringify(initial.content_structured) : ""),
  );
  const [priority, setPriority] = useState(initial?.priority || "high");
  const [confidence, setConfidence] = useState(initial?.confidence || "confirmed");
  const [tags, setTags] = useState((initial?.tags || []).join(", "));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError("Título é obrigatório"); return; }
    setSaving(true);
    setError(null);

    const payload = {
      title: title.trim(),
      content_structured: { text: content.trim() },
      priority,
      confidence,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    if (isEdit) {
      payload.memory_id = initial.memory_id;
    }

    const result = isEdit
      ? await updateManualMemory(payload)
      : await createManualMemory(payload);

    setSaving(false);
    if (result.ok) {
      onSave();
    } else {
      setError(result.error?.message || result.data?.error || "Erro ao salvar");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyles.form}>
      <p style={formStyles.formTitle}>{isEdit ? "Editar Memória Manual" : "Nova Memória Manual"}</p>

      <label style={formStyles.label}>
        Título *
        <input
          style={formStyles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Regra de operação Sul"
          data-testid="manual-mem-title"
        />
      </label>

      <label style={formStyles.label}>
        Conteúdo
        <textarea
          style={{ ...formStyles.input, minHeight: "80px", resize: "vertical" }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Conteúdo da memória manual"
          data-testid="manual-mem-content"
        />
      </label>

      <div style={formStyles.row}>
        <label style={formStyles.label}>
          Prioridade
          <select style={formStyles.input} value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="manual-mem-priority">
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </label>
        <label style={formStyles.label}>
          Confiança
          <select style={formStyles.input} value={confidence} onChange={(e) => setConfidence(e.target.value)} data-testid="manual-mem-confidence">
            <option value="confirmed">Confirmada</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
            <option value="unverified">Não verificada</option>
          </select>
        </label>
      </div>

      <label style={formStyles.label}>
        Tags (separadas por vírgula)
        <input
          style={formStyles.input}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ex: operação, sul, regra"
          data-testid="manual-mem-tags"
        />
      </label>

      {error && <p style={formStyles.error}>⚠ {error}</p>}

      <div style={formStyles.actions}>
        <button type="button" onClick={onCancel} style={formStyles.cancelBtn} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" style={formStyles.saveBtn} disabled={saving} data-testid="manual-mem-save">
          {saving ? "Salvando..." : isEdit ? "Salvar alterações" : "Criar memória"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------
export default function ManualMemoryPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await listManualMemories();
    if (result.ok) {
      setItems(result.data?.items || []);
    } else {
      setError(result.error?.message || "Erro ao carregar memórias manuais");
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleCreate = () => {
    setEditingItem(null);
    setShowForm(true);
  };
  const handleEdit = (item) => {
    setEditingItem(item);
    setShowForm(true);
  };
  const handleSaved = () => {
    setShowForm(false);
    setEditingItem(null);
    loadItems();
  };
  const handleCancel = () => {
    setShowForm(false);
    setEditingItem(null);
  };
  const handleBlock = async (memoryId) => {
    const res = await blockManualMemory(memoryId);
    if (res.ok) loadItems();
  };
  const handleInvalidate = async (memoryId) => {
    const res = await invalidateManualMemory(memoryId);
    if (res.ok) loadItems();
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>📝</span>
          <div>
            <p style={s.title}>Memória Manual</p>
            <p style={s.subtitle}>
              Instruções manuais do operador — entram no retrieval como <code style={s.code}>manual_instructions</code>
            </p>
          </div>
        </div>
        <button style={s.createBtn} onClick={handleCreate} data-testid="manual-mem-create-btn">
          + Nova memória
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <ManualMemoryForm
          initial={editingItem}
          onSave={handleSaved}
          onCancel={handleCancel}
        />
      )}

      {/* Loading / Error */}
      {loading && <p style={s.info}>Carregando...</p>}
      {error && <p style={s.errorMsg}>⚠ {error}</p>}

      {/* List */}
      {!loading && !error && items.length === 0 && !showForm && (
        <p style={s.emptyText}>Nenhuma memória manual registrada.</p>
      )}

      {!loading && items.length > 0 && (
        <div style={s.list}>
          <div style={s.listHeader}>
            <span style={s.colTitle}>Título</span>
            <span style={s.colSmall}>Tipo/Fonte</span>
            <span style={s.colSmall}>Confiança</span>
            <span style={s.colSmall}>Status</span>
            <span style={s.colSmall}>Atualizado</span>
            <span style={s.colSmall}>Tags</span>
            <span style={s.colActions}>Ações</span>
          </div>
          {items.map((item) => {
            const isActive = item.status === "active" || item.status === "canonical";
            const isBlocked = item.status === "blocked";
            const isExpired = item.status === "expired";
            return (
              <div key={item.memory_id} style={{ ...s.row, opacity: isActive ? 1 : 0.6 }} data-testid="manual-mem-row">
                <span style={s.colTitle} title={item.title}>
                  {item.title}
                </span>
                <span style={s.colSmall}>
                  <span style={s.sourceBadge}>{item.memory_type}</span>
                  <span style={s.sourceLabel}>{item.source}</span>
                </span>
                <span style={s.colSmall}>{item.confidence}</span>
                <span style={s.colSmall}>
                  <StatusBadge status={item.status} />
                </span>
                <span style={{ ...s.colSmall, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                  {formatTs(item.updated_at)}
                </span>
                <span style={s.colSmall}>
                  {Array.isArray(item.tags) && item.tags.length > 0
                    ? item.tags.map((t) => <span key={t} style={s.tag}>{t}</span>)
                    : "—"}
                </span>
                <span style={s.colActions}>
                  {isActive && (
                    <>
                      <button style={s.actionBtn} onClick={() => handleEdit(item)} title="Editar" data-testid="manual-mem-edit-btn">
                        ✏️
                      </button>
                      <button style={s.actionBtn} onClick={() => handleBlock(item.memory_id)} title="Bloquear" data-testid="manual-mem-block-btn">
                        🔒
                      </button>
                      <button style={s.actionBtn} onClick={() => handleInvalidate(item.memory_id)} title="Invalidar" data-testid="manual-mem-invalidate-btn">
                        ⛔
                      </button>
                    </>
                  )}
                  {(isBlocked || isExpired) && (
                    <span style={s.disabledLabel}>
                      {isBlocked ? "Bloqueada" : "Expirada"}
                    </span>
                  )}
                </span>
              </div>
            );
          })}
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
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
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
  code: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    background: "rgba(0,180,216,0.1)",
    padding: "1px 4px",
    borderRadius: "3px",
    color: "var(--color-primary)",
  },
  createBtn: {
    background: "var(--color-primary)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-md)",
    padding: "6px 14px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
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
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 12px",
    borderBottom: "1px solid var(--border)",
    fontSize: "12px",
    color: "var(--text-secondary)",
    transition: "background 0.1s",
  },
  colTitle: {
    flex: 2,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  colSmall: {
    flex: 1,
    minWidth: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
    fontSize: "11px",
  },
  colActions: {
    flex: 1,
    display: "flex",
    gap: "4px",
    justifyContent: "flex-end",
    flexShrink: 0,
  },
  sourceBadge: {
    fontSize: "9px",
    fontWeight: 600,
    background: "rgba(0,180,216,0.08)",
    color: "var(--color-primary)",
    border: "1px solid var(--color-primary-border)",
    padding: "1px 4px",
    borderRadius: "3px",
    marginRight: "4px",
  },
  sourceLabel: {
    fontSize: "9px",
    color: "var(--text-muted)",
  },
  tag: {
    fontSize: "9px",
    background: "rgba(100,116,139,0.1)",
    border: "1px solid rgba(100,116,139,0.15)",
    padding: "1px 4px",
    borderRadius: "3px",
    marginRight: "2px",
    color: "var(--text-muted)",
  },
  actionBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "2px 6px",
    fontSize: "12px",
    cursor: "pointer",
    transition: "background 0.1s",
  },
  disabledLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },
};

const formStyles = {
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "16px",
  },
  formTitle: {
    fontSize: "13px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "4px",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: "3px",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  input: {
    padding: "6px 10px",
    fontSize: "12px",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    background: "var(--bg-surface)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-body)",
    outline: "none",
  },
  row: {
    display: "flex",
    gap: "12px",
  },
  error: {
    fontSize: "11px",
    color: "#EF4444",
  },
  actions: {
    display: "flex",
    gap: "8px",
    justifyContent: "flex-end",
    marginTop: "4px",
  },
  cancelBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "5px 14px",
    fontSize: "12px",
    cursor: "pointer",
    color: "var(--text-secondary)",
    fontFamily: "var(--font-body)",
  },
  saveBtn: {
    background: "var(--color-primary)",
    color: "#fff",
    border: "none",
    borderRadius: "var(--radius-sm)",
    padding: "5px 14px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "var(--font-body)",
  },
};
