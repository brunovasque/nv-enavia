// ============================================================================
// LearningCandidatesPanel — PR5: Aprendizado Controlado / Memória Validada
//
// Minimal, functional UI for the operator to:
//   - List learning candidates (pending/approved/rejected)
//   - Approve a candidate (promotes to validated memory)
//   - Reject a candidate (keeps history, does NOT enter active memory)
//
// Contract: candidato pendente NÃO entra como memória validada ativa.
// Aprovado promove para aprendizado_validado → retrieval validated_learning.
// Rejeitado mantém histórico, sem entrar na memória validada.
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import {
  listLearningCandidates,
  createLearningCandidate,
  approveLearningCandidate,
  rejectLearningCandidate,
} from "../api";

// ---------------------------------------------------------------------------
// Status badge helper
// ---------------------------------------------------------------------------
const STATUS_STYLES = {
  pending:  { color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", label: "Pendente" },
  approved: { color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", label: "Aprovado" },
  rejected: { color: "#EF4444", bg: "rgba(239,68,68,0.12)",  border: "rgba(239,68,68,0.3)",  label: "Rejeitado" },
};

function StatusBadge({ status }) {
  const st = STATUS_STYLES[status] || STATUS_STYLES.pending;
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
// Create Form (minimal: register a learning candidate manually)
// ---------------------------------------------------------------------------
function LearningCandidateForm({ onSave, onCancel }) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [source, setSource] = useState("panel");
  const [confidence, setConfidence] = useState("medium");
  const [priority, setPriority] = useState("medium");
  const [tags, setTags] = useState("");
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
      source,
      confidence,
      priority,
      tags: tags.split(",").map((t) => t.trim()).filter(Boolean),
    };

    const result = await createLearningCandidate(payload);
    setSaving(false);
    if (result.ok) {
      onSave();
    } else {
      setError(result.error?.message || result.data?.error || "Erro ao registrar candidato");
    }
  };

  return (
    <form onSubmit={handleSubmit} style={formStyles.form}>
      <p style={formStyles.formTitle}>Novo Candidato de Aprendizado</p>

      <label style={formStyles.label}>
        Título *
        <input
          style={formStyles.input}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Regra aprendida sobre deploy em staging"
          data-testid="lc-title"
        />
      </label>

      <label style={formStyles.label}>
        Conteúdo / Resumo
        <textarea
          style={{ ...formStyles.input, minHeight: "80px", resize: "vertical" }}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Descreva o padrão/regra candidata"
          data-testid="lc-content"
        />
      </label>

      <div style={formStyles.row}>
        <label style={formStyles.label}>
          Origem
          <input
            style={formStyles.input}
            value={source}
            onChange={(e) => setSource(e.target.value)}
            placeholder="panel, runtime, consolidation"
            data-testid="lc-source"
          />
        </label>
        <label style={formStyles.label}>
          Confiança
          <select style={formStyles.input} value={confidence} onChange={(e) => setConfidence(e.target.value)} data-testid="lc-confidence">
            <option value="confirmed">Confirmada</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
            <option value="unverified">Não verificada</option>
          </select>
        </label>
        <label style={formStyles.label}>
          Prioridade
          <select style={formStyles.input} value={priority} onChange={(e) => setPriority(e.target.value)} data-testid="lc-priority">
            <option value="critical">Crítica</option>
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </label>
      </div>

      <label style={formStyles.label}>
        Tags (separadas por vírgula)
        <input
          style={formStyles.input}
          value={tags}
          onChange={(e) => setTags(e.target.value)}
          placeholder="ex: deploy, staging, regra"
          data-testid="lc-tags"
        />
      </label>

      {error && <p style={formStyles.error}>⚠ {error}</p>}

      <div style={formStyles.actions}>
        <button type="button" onClick={onCancel} style={formStyles.cancelBtn} disabled={saving}>
          Cancelar
        </button>
        <button type="submit" style={formStyles.saveBtn} disabled={saving} data-testid="lc-save">
          {saving ? "Registrando..." : "Registrar candidato"}
        </button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main Panel
// ---------------------------------------------------------------------------
export default function LearningCandidatesPanel() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [statusFilter, setStatusFilter] = useState("all");

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    const filters = statusFilter !== "all" ? { status: statusFilter } : {};
    const result = await listLearningCandidates(filters);
    if (result.ok) {
      setItems(result.data?.items || []);
    } else {
      setError(result.error?.message || "Erro ao carregar candidatos de aprendizado");
    }
    setLoading(false);
  }, [statusFilter]);

  useEffect(() => { loadItems(); }, [loadItems]);

  const handleCreate = () => setShowForm(true);
  const handleSaved = () => { setShowForm(false); loadItems(); };
  const handleCancel = () => setShowForm(false);

  const handleApprove = async (candidateId) => {
    const res = await approveLearningCandidate(candidateId);
    if (res.ok) loadItems();
  };

  const handleReject = async (candidateId) => {
    const reason = window.prompt("Motivo da rejeição (opcional):");
    const res = await rejectLearningCandidate(candidateId, reason || "");
    if (res.ok) loadItems();
  };

  return (
    <div style={s.wrap}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <span style={s.headerIcon}>🎓</span>
          <div>
            <p style={s.title}>Aprendizado Controlado</p>
            <p style={s.subtitle}>
              Candidatos de aprendizado — requerem <strong>aprovação humana</strong> antes de virar memória validada
            </p>
          </div>
        </div>
        <div style={s.headerRight}>
          <select
            style={s.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            data-testid="lc-status-filter"
          >
            <option value="all">Todos</option>
            <option value="pending">Pendentes</option>
            <option value="approved">Aprovados</option>
            <option value="rejected">Rejeitados</option>
          </select>
          <button style={s.createBtn} onClick={handleCreate} data-testid="lc-create-btn">
            + Novo candidato
          </button>
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <LearningCandidateForm onSave={handleSaved} onCancel={handleCancel} />
      )}

      {/* Loading / Error */}
      {loading && <p style={s.info}>Carregando...</p>}
      {error && <p style={s.errorMsg}>⚠ {error}</p>}

      {/* Empty state */}
      {!loading && !error && items.length === 0 && !showForm && (
        <p style={s.emptyText}>Nenhum candidato de aprendizado registrado.</p>
      )}

      {/* List */}
      {!loading && items.length > 0 && (
        <div style={s.list}>
          <div style={s.listHeader}>
            <span style={s.colTitle}>Título</span>
            <span style={s.colSmall}>Origem</span>
            <span style={s.colSmall}>Confiança</span>
            <span style={s.colSmall}>Status</span>
            <span style={s.colSmall}>Criado</span>
            <span style={s.colSmall}>Atualizado</span>
            <span style={s.colActions}>Ações</span>
          </div>
          {items.map((item) => {
            const isPending = item.status === "pending";
            const isApproved = item.status === "approved";
            const isRejected = item.status === "rejected";
            return (
              <div
                key={item.candidate_id}
                style={{ ...s.row, opacity: isPending ? 1 : 0.65 }}
                data-testid="lc-row"
              >
                <span style={s.colTitle} title={item.title}>
                  {item.title}
                  {item.content_structured?.text && (
                    <span style={s.contentPreview}>
                      {item.content_structured.text.length > 60
                        ? item.content_structured.text.slice(0, 57) + "..."
                        : item.content_structured.text}
                    </span>
                  )}
                </span>
                <span style={s.colSmall}>
                  <span style={s.sourceBadge}>{item.source}</span>
                </span>
                <span style={s.colSmall}>{item.confidence}</span>
                <span style={s.colSmall}>
                  <StatusBadge status={item.status} />
                </span>
                <span style={{ ...s.colSmall, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                  {formatTs(item.created_at)}
                </span>
                <span style={{ ...s.colSmall, fontFamily: "var(--font-mono)", fontSize: "10px" }}>
                  {formatTs(item.updated_at)}
                </span>
                <span style={s.colActions}>
                  {isPending && (
                    <>
                      <button
                        style={{ ...s.actionBtn, ...s.approveBtn }}
                        onClick={() => handleApprove(item.candidate_id)}
                        title="Aprovar — promover para memória validada"
                        data-testid="lc-approve-btn"
                      >
                        ✅ Aprovar
                      </button>
                      <button
                        style={{ ...s.actionBtn, ...s.rejectBtn }}
                        onClick={() => handleReject(item.candidate_id)}
                        title="Rejeitar — não entra na memória validada"
                        data-testid="lc-reject-btn"
                      >
                        ❌ Rejeitar
                      </button>
                    </>
                  )}
                  {isApproved && (
                    <span style={s.resolvedLabel}>
                      ✅ Promovido{item.promoted_memory_id ? ` → ${item.promoted_memory_id}` : ""}
                    </span>
                  )}
                  {isRejected && (
                    <span style={s.resolvedLabel} title={item.rejection_reason || ""}>
                      ❌ Rejeitado{item.rejection_reason ? `: ${item.rejection_reason}` : ""}
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
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  contentPreview: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontWeight: 400,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
    flex: 2,
    display: "flex",
    gap: "4px",
    justifyContent: "flex-end",
    flexShrink: 0,
    flexWrap: "wrap",
  },
  sourceBadge: {
    fontSize: "9px",
    fontWeight: 600,
    background: "rgba(245,158,11,0.08)",
    color: "#F59E0B",
    border: "1px solid rgba(245,158,11,0.3)",
    padding: "1px 4px",
    borderRadius: "3px",
  },
  actionBtn: {
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-sm)",
    padding: "3px 10px",
    fontSize: "11px",
    fontWeight: 600,
    cursor: "pointer",
    transition: "background 0.1s",
    fontFamily: "var(--font-body)",
  },
  approveBtn: {
    background: "rgba(16,185,129,0.1)",
    color: "#10B981",
    borderColor: "rgba(16,185,129,0.3)",
  },
  rejectBtn: {
    background: "rgba(239,68,68,0.1)",
    color: "#EF4444",
    borderColor: "rgba(239,68,68,0.3)",
  },
  resolvedLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontStyle: "italic",
    maxWidth: "200px",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
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
