// ============================================================================
// ENAVIA Panel — LoopPage (PR12, Panel-only)
//
// Interface operacional do loop supervisionado.
// Consome GET /contracts/loop-status e POST /contracts/execute-next.
//
// O painel NÃO cria decisão: exibe o estado do backend e chama endpoints.
// Se o backend bloquear, o motivo é exibido diretamente.
//
// Regras:
//   - Panel-only. Nenhuma lógica de negócio aqui.
//   - Sem alteração em Worker, Executor ou contract-executor.js.
//   - Em modo mock, informa que o backend real é necessário.
// ============================================================================

import { useState, useEffect, useCallback } from "react";
import { fetchLoopStatus, executeNext, getApiConfig } from "../api";

// ── Status visual metadata ───────────────────────────────────────────────────

const OP_TYPE_LABEL = {
  execute_next: "Executar Próxima Tarefa",
  approve:      "Aprovar Encerramento",
  block:        "Bloqueado",
};

const STATUS_STYLE = {
  executed:          { color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.28)",  label: "EXECUTADO" },
  blocked:           { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   label: "BLOQUEADO" },
  awaiting_approval: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)",  label: "AGUARDANDO APROVAÇÃO" },
  error:             { color: "#EF4444", bg: "rgba(239,68,68,0.08)",   border: "rgba(239,68,68,0.25)",   label: "ERRO" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ label, value, mono = false, muted = false }) {
  if (value === null || value === undefined) return null;
  return (
    <div style={s.fieldRow}>
      <span style={s.fieldLabel}>{label}</span>
      <span style={{ ...s.fieldValue, ...(mono ? s.mono : {}), ...(muted ? { opacity: 0.55 } : {}) }}>
        {String(value)}
      </span>
    </div>
  );
}

function Card({ title, icon, children, accent }) {
  return (
    <div style={{ ...s.card, ...(accent ? { borderLeftColor: accent, borderLeftWidth: "3px" } : {}) }}>
      <div style={s.cardHeader}>
        {icon && <span style={s.cardIcon} aria-hidden="true">{icon}</span>}
        <span style={s.cardTitle}>{title}</span>
      </div>
      {children}
    </div>
  );
}

function CollapsibleCard({ title, icon, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={s.card}>
      <button style={s.collapsibleBtn} onClick={() => setOpen(o => !o)} aria-expanded={open}>
        {icon && <span style={s.cardIcon} aria-hidden="true">{icon}</span>}
        <span style={s.cardTitle}>{title}</span>
        <span style={s.collapseChevron}>{open ? "▾" : "▸"}</span>
      </button>
      {open && <div style={s.collapsibleBody}>{children}</div>}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = STATUS_STYLE[status];
  if (!meta) return null;
  return (
    <span style={{ ...s.badge, color: meta.color, background: meta.bg, borderColor: meta.border }}>
      {meta.label}
    </span>
  );
}

function JsonBlock({ data }) {
  return (
    <pre style={s.jsonBlock}>{JSON.stringify(data, null, 2)}</pre>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function LoopPage() {
  const [loopData, setLoopData]     = useState(null);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);
  const [executing, setExecuting]   = useState(false);
  const [execResult, setExecResult] = useState(null);
  const [approvedBy, setApprovedBy] = useState("operator");
  const isMockMode = getApiConfig().mode !== "real";

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    const r = await fetchLoopStatus();
    if (r.ok) {
      setLoopData(r.data);
    } else {
      setFetchError(r.error?.message ?? "Erro ao carregar status do loop.");
      setLoopData(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleExecute = async () => {
    setExecuting(true);
    setExecResult(null);
    const body = {
      confirm:     true,
      approved_by: approvedBy.trim() || "operator",
      evidence:    [],
    };
    const r = await executeNext(body);
    if (r.data) {
      setExecResult(r.data);
    } else if (r.ok) {
      setExecResult(null);
    } else {
      setExecResult({
        ok: false,
        executed: false,
        status: "error",
        reason: r.error?.message ?? "Erro de rede ao executar.",
        nextAction: null,
        operationalAction: null,
        evidence: null,
        rollback: null,
        executor_path: null,
        audit_id: null,
      });
    }
    setExecuting(false);
    // Atualiza status após execução
    loadStatus();
  };

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.page} role="main">
        <_Header onRefresh={loadStatus} refreshing={loading} />
        <div style={s.centered} data-testid="loop-loading">
          <span style={{ fontSize: "28px", opacity: 0.4 }} aria-hidden="true">◌</span>
          <p style={s.mutedText}>Carregando status do loop…</p>
        </div>
      </div>
    );
  }

  // ── Mock mode notice ─────────────────────────────────────────────────────────
  if (isMockMode && loopData === null) {
    return (
      <div style={s.page} role="main">
        <_Header onRefresh={loadStatus} refreshing={loading} />
        <div style={s.noticeCard} data-testid="loop-mock-notice">
          <span style={{ fontSize: "20px" }} aria-hidden="true">◎</span>
          <div>
            <p style={{ margin: 0, fontWeight: 600, fontSize: "13px", color: "var(--text-primary)" }}>
              Modo mock ativo — backend real necessário
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)", lineHeight: 1.5 }}>
              O loop operacional requer conexão com o backend ENAVIA.{" "}
              Configure <code style={s.inlineCode}>VITE_NV_ENAVIA_URL</code> com a URL do Worker para usar esta página.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={s.page} role="main">
        <_Header onRefresh={loadStatus} refreshing={loading} />
        <div style={s.errorCard} data-testid="loop-error">
          <span style={{ fontSize: "20px" }} aria-hidden="true">⚠</span>
          <p style={{ margin: 0, color: "#EF4444", fontSize: "13px" }}>{fetchError}</p>
        </div>
      </div>
    );
  }

  const contract = loopData?.contract ?? null;
  const loop = loopData?.loop ?? null;
  const nextAction = loopData?.nextAction ?? null;
  const operationalAction = loopData?.operationalAction ?? null;
  const canProceed = loop?.canProceed === true;
  const canExecute = operationalAction?.can_execute === true;
  const opType = operationalAction?.type ?? null;
  const isApproveType = opType === "approve";

  return (
    <div style={s.page} role="main">
      <_Header onRefresh={loadStatus} refreshing={false} />

      {/* ── Loop status overview ───────────────────────────────────────────── */}
      {(contract || loop) && (
        <Card title="Status do Loop" icon="◆" accent={canProceed ? "#10B981" : "#EF4444"}>
          <FieldRow label="Contrato"        value={contract?.id} mono />
          <FieldRow label="Status"          value={contract?.status} />
          <FieldRow label="Fase atual"      value={contract?.current_phase} />
          <FieldRow label="Task atual"      value={contract?.current_task} mono />
          <FieldRow label="Atualizado em"   value={contract?.updated_at} mono muted />
          <FieldRow label="Pode prosseguir" value={canProceed ? "Sim" : "Não"} />
          {loop?.blockReason && (
            <div style={s.blockReasonBox} data-testid="loop-block-reason">
              <span style={s.blockReasonLabel}>Motivo do bloqueio:</span>
              <span style={s.blockReasonText}>{loop.blockReason}</span>
            </div>
          )}
          {loop?.guidance && (
            <div style={{ ...s.blockReasonBox, borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.05)" }}>
              <span style={{ ...s.blockReasonLabel, color: "#F59E0B" }}>Orientação:</span>
              <span style={s.blockReasonText}>{loop.guidance}</span>
            </div>
          )}
          {loop?.availableActions?.length > 0 && (
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Ações disponíveis</span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {loop.availableActions.map(a => (
                  <span key={a} style={s.actionTag}>{a}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Próxima ação operacional ───────────────────────────────────────── */}
      {operationalAction && (
        <Card title="Ação Operacional" icon="▶" accent={canExecute ? "#10B981" : "#EF4444"}>
          <FieldRow label="Tipo"              value={OP_TYPE_LABEL[opType] ?? opType} />
          <FieldRow label="Pode executar"     value={canExecute ? "Sim" : "Não"} />
          <FieldRow label="Exige aprovação"   value={operationalAction.requires_human_approval ? "Sim" : "Não"} />
          <FieldRow label="ID da ação"        value={operationalAction.action_id} mono muted />
          {!canExecute && operationalAction.block_reason && (
            <div style={s.blockReasonBox} data-testid="op-block-reason">
              <span style={s.blockReasonLabel}>Motivo do bloqueio:</span>
              <span style={s.blockReasonText}>{operationalAction.block_reason}</span>
            </div>
          )}
          {operationalAction.evidence_required?.length > 0 && (
            <div style={s.fieldRow}>
              <span style={s.fieldLabel}>Evidência exigida</span>
              <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                {operationalAction.evidence_required.map(e => (
                  <span key={e} style={{ ...s.actionTag, color: "#F59E0B", borderColor: "rgba(245,158,11,0.3)", background: "rgba(245,158,11,0.06)" }}>{e}</span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── Próxima ação contractual ───────────────────────────────────────── */}
      {nextAction && (
        <CollapsibleCard title="Próxima Ação Contratual" icon="📋">
          <FieldRow label="Tipo"    value={nextAction.type} />
          <FieldRow label="Fase"    value={nextAction.phase_id} mono />
          <FieldRow label="Task"    value={nextAction.task_id} mono />
          <FieldRow label="Motivo"  value={nextAction.reason} />
          <FieldRow label="Status"  value={nextAction.status} />
        </CollapsibleCard>
      )}

      {/* ── Zona de execução ──────────────────────────────────────────────── */}
      <div style={s.executeZone} data-testid="execute-zone">
        <div style={s.executeZoneHeader}>
          <span style={s.executeZoneTitle}>Executar Próxima Ação</span>
          {!canExecute && (
            <span style={{ fontSize: "11px", color: "#EF4444", fontWeight: 600 }}>
              Bloqueado pelo backend
            </span>
          )}
        </div>

        {/* approved_by field — sempre visível (obrigatório para approve, opcional para execute_next) */}
        <div style={s.inputRow}>
          <label style={s.inputLabel} htmlFor="approved-by-input">approved_by</label>
          <input
            id="approved-by-input"
            style={s.textInput}
            type="text"
            value={approvedBy}
            onChange={e => setApprovedBy(e.target.value)}
            placeholder="operator"
            disabled={executing}
          />
        </div>

        {isApproveType && (
          <p style={s.approveNote}>
            Esta ação requer aprovação humana explícita. O campo <code style={s.inlineCode}>approved_by</code> é obrigatório.
          </p>
        )}

        <button
          style={{
            ...s.execBtn,
            ...(canExecute && !executing ? s.execBtnActive : s.execBtnDisabled),
          }}
          onClick={handleExecute}
          disabled={!canExecute || executing}
          data-testid="execute-btn"
          aria-busy={executing}
        >
          {executing ? "Executando…" : (OP_TYPE_LABEL[opType] ?? "Executar Próxima Ação")}
        </button>

        <p style={s.execDisclaimer}>
          Body enviado: <code style={s.inlineCode}>{"{ confirm: true, approved_by: \"" + (approvedBy.trim() || "operator") + "\", evidence: [] }"}</code>
        </p>
      </div>

      {/* ── Resultado da execução ──────────────────────────────────────────── */}
      {execResult && (
        <div data-testid="exec-result">
          <div style={{
            ...s.resultBanner,
            color:       (STATUS_STYLE[execResult.status] ?? STATUS_STYLE.error).color,
            background:  (STATUS_STYLE[execResult.status] ?? STATUS_STYLE.error).bg,
            borderColor: (STATUS_STYLE[execResult.status] ?? STATUS_STYLE.error).border,
          }}>
            <StatusBadge status={execResult.status ?? "error"} />
            {execResult.reason && (
              <span style={{ fontSize: "12px", lineHeight: 1.4 }}>{execResult.reason}</span>
            )}
          </div>

          {/* Detalhes técnicos do resultado */}
          <CollapsibleCard title="Detalhes da Execução" icon="🔍" defaultOpen>
            <FieldRow label="ok"       value={String(execResult.ok)} />
            <FieldRow label="executed" value={String(execResult.executed)} />
            <FieldRow label="status"   value={execResult.status} />
            <FieldRow label="audit_id" value={execResult.audit_id} mono muted />

            {execResult.evidence && (
              <div style={s.subSection}>
                <span style={s.subSectionTitle}>Evidence</span>
                <JsonBlock data={execResult.evidence} />
              </div>
            )}

            {execResult.rollback && (
              <div style={s.subSection}>
                <span style={s.subSectionTitle}>Rollback</span>
                <FieldRow label="Disponível"    value={String(execResult.rollback.available)} />
                <FieldRow label="Tipo"          value={execResult.rollback.type} />
                <FieldRow label="Recomendação"  value={execResult.rollback.recommendation} />
                {execResult.rollback.command && (
                  <FieldRow label="Comando"     value={execResult.rollback.command} mono />
                )}
              </div>
            )}

            {execResult.executor_path && (
              <div style={s.subSection}>
                <span style={s.subSectionTitle}>Executor Path</span>
                <FieldRow label="Tipo"        value={execResult.executor_path.type} />
                <FieldRow label="Handler"     value={execResult.executor_path.handler} mono />
                <FieldRow label="Service Binding" value={String(execResult.executor_path.uses_service_binding)} />
                <FieldRow label="Nota"        value={execResult.executor_path.note} muted />
              </div>
            )}

            {execResult.execution_result && (
              <div style={s.subSection}>
                <span style={s.subSectionTitle}>Resultado interno</span>
                <JsonBlock data={execResult.execution_result} />
              </div>
            )}
          </CollapsibleCard>
        </div>
      )}
    </div>
  );
}

// ── Page header sub-component ─────────────────────────────────────────────────

function _Header({ onRefresh, refreshing }) {
  return (
    <div style={s.headerRow}>
      <div style={s.titleGroup}>
        <span style={s.titleIcon} aria-hidden="true">▶</span>
        <h1 style={s.pageTitle}>Loop Operacional</h1>
      </div>
      <button
        style={{ ...s.refreshBtn, ...(refreshing ? s.refreshBtnLoading : {}) }}
        onClick={onRefresh}
        disabled={refreshing}
        aria-label="Atualizar status do loop"
        data-testid="loop-refresh-btn"
      >
        ↺ Atualizar
      </button>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display:       "flex",
    flexDirection: "column",
    gap:           "12px",
    padding:       "20px 24px",
    height:        "100%",
    overflowY:     "auto",
    boxSizing:     "border-box",
  },

  headerRow: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    flexShrink:     0,
  },
  titleGroup: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  titleIcon:  { fontSize: "16px", lineHeight: 1, color: "var(--color-primary)" },
  pageTitle: {
    margin:       0,
    fontSize:     "15px",
    fontWeight:   700,
    color:        "var(--text-primary)",
    letterSpacing: "0.3px",
  },

  refreshBtn: {
    fontSize:   "12px",
    fontWeight: 500,
    color:      "var(--text-secondary)",
    background: "var(--bg-surface)",
    border:     "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding:    "6px 12px",
    cursor:     "pointer",
    transition: "opacity 0.15s",
  },
  refreshBtnLoading: { opacity: 0.4, cursor: "not-allowed" },

  // Cards
  card: {
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding:      "14px 16px",
    display:      "flex",
    flexDirection: "column",
    gap:          "8px",
    flexShrink:   0,
  },
  cardHeader: {
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
    marginBottom: "2px",
  },
  cardIcon:  { fontSize: "13px", color: "var(--color-primary)", lineHeight: 1 },
  cardTitle: {
    fontSize:   "12px",
    fontWeight: 700,
    color:      "var(--text-primary)",
    letterSpacing: "0.2px",
    flex:       1,
  },

  // Collapsible
  collapsibleBtn: {
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
    background: "transparent",
    border:     "none",
    cursor:     "pointer",
    padding:    0,
    width:      "100%",
    textAlign:  "left",
  },
  collapseChevron: {
    fontSize: "11px",
    color:    "var(--text-muted)",
    marginLeft: "auto",
  },
  collapsibleBody: {
    display:       "flex",
    flexDirection: "column",
    gap:           "6px",
    paddingTop:    "4px",
  },

  // Field rows
  fieldRow: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        "8px",
    minHeight:  "20px",
  },
  fieldLabel: {
    fontSize:    "11px",
    fontWeight:  600,
    color:       "var(--text-muted)",
    minWidth:    "130px",
    flexShrink:  0,
    paddingTop:  "1px",
    letterSpacing: "0.2px",
  },
  fieldValue: {
    fontSize:   "12px",
    color:      "var(--text-primary)",
    lineHeight: 1.4,
    wordBreak:  "break-all",
  },
  mono: {
    fontFamily: "var(--font-mono)",
    fontSize:   "11px",
    color:      "var(--text-secondary)",
  },

  // Block reason
  blockReasonBox: {
    display:       "flex",
    flexDirection: "column",
    gap:           "3px",
    padding:       "8px 10px",
    background:    "rgba(239,68,68,0.05)",
    border:        "1px solid rgba(239,68,68,0.2)",
    borderRadius:  "var(--radius-md)",
    marginTop:     "2px",
  },
  blockReasonLabel: {
    fontSize:   "10px",
    fontWeight: 700,
    color:      "#EF4444",
    letterSpacing: "0.5px",
  },
  blockReasonText: {
    fontSize:   "12px",
    color:      "var(--text-primary)",
    lineHeight: 1.4,
  },

  // Action tags (availableActions, evidence_required)
  actionTag: {
    fontSize:   "10px",
    fontWeight: 600,
    color:      "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border:     "1px solid var(--color-primary-border)",
    borderRadius: "4px",
    padding:    "2px 7px",
  },

  // Execute zone
  executeZone: {
    background:   "var(--bg-surface)",
    border:       "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding:      "16px",
    display:      "flex",
    flexDirection: "column",
    gap:          "10px",
    flexShrink:   0,
  },
  executeZoneHeader: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
  },
  executeZoneTitle: {
    fontSize:   "12px",
    fontWeight: 700,
    color:      "var(--text-primary)",
    letterSpacing: "0.2px",
  },

  inputRow: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
  },
  inputLabel: {
    fontSize:   "11px",
    fontWeight: 600,
    color:      "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    minWidth:   "90px",
    flexShrink: 0,
  },
  textInput: {
    flex:         1,
    fontSize:     "12px",
    fontFamily:   "var(--font-body)",
    color:        "var(--text-primary)",
    background:   "var(--bg-input, var(--bg-main))",
    border:       "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding:      "6px 10px",
    outline:      "none",
  },

  approveNote: {
    margin:   0,
    fontSize: "11px",
    color:    "#F59E0B",
    lineHeight: 1.5,
  },

  execBtn: {
    fontSize:     "13px",
    fontWeight:   700,
    padding:      "10px 20px",
    borderRadius: "var(--radius-md)",
    border:       "none",
    cursor:       "pointer",
    transition:   "opacity 0.15s",
    alignSelf:    "flex-start",
    letterSpacing: "0.3px",
  },
  execBtnActive: {
    color:      "#fff",
    background: "var(--color-primary, #0BB5D8)",
    boxShadow:  "0 2px 8px rgba(0,180,216,0.25)",
  },
  execBtnDisabled: {
    color:      "var(--text-muted)",
    background: "var(--bg-input, rgba(255,255,255,0.04))",
    cursor:     "not-allowed",
    opacity:    0.5,
  },
  execDisclaimer: {
    margin:     0,
    fontSize:   "11px",
    color:      "var(--text-muted)",
    lineHeight: 1.4,
  },

  // Result banner
  resultBanner: {
    display:      "flex",
    alignItems:   "flex-start",
    gap:          "10px",
    padding:      "12px 16px",
    borderRadius: "var(--radius-lg)",
    border:       "1px solid",
    marginBottom: "6px",
    flexShrink:   0,
  },

  // Sub-sections inside result details
  subSection: {
    display:       "flex",
    flexDirection: "column",
    gap:           "4px",
    paddingTop:    "8px",
    borderTop:     "1px solid var(--border-light)",
    marginTop:     "4px",
  },
  subSectionTitle: {
    fontSize:      "10px",
    fontWeight:    700,
    color:         "var(--text-muted)",
    letterSpacing: "0.8px",
    textTransform: "uppercase",
    marginBottom:  "2px",
  },

  // Badge
  badge: {
    fontSize:     "10px",
    fontWeight:   700,
    letterSpacing: "0.8px",
    padding:      "3px 8px",
    borderRadius: "4px",
    border:       "1px solid",
    flexShrink:   0,
    whiteSpace:   "nowrap",
  },

  // JSON block
  jsonBlock: {
    margin:       0,
    fontSize:     "10px",
    fontFamily:   "var(--font-mono)",
    color:        "var(--text-secondary)",
    background:   "var(--bg-main, rgba(0,0,0,0.15))",
    border:       "1px solid var(--border-light)",
    borderRadius: "var(--radius-md)",
    padding:      "8px 10px",
    overflowX:    "auto",
    whiteSpace:   "pre",
    lineHeight:   1.5,
  },

  // Centered empty/loading state
  centered: {
    display:        "flex",
    flexDirection:  "column",
    alignItems:     "center",
    justifyContent: "center",
    gap:            "8px",
    padding:        "48px 24px",
    textAlign:      "center",
  },
  mutedText: {
    margin:   0,
    fontSize: "13px",
    color:    "var(--text-muted)",
  },

  // Notice / error cards
  noticeCard: {
    display:    "flex",
    alignItems: "flex-start",
    gap:        "12px",
    padding:    "16px",
    background: "var(--bg-surface)",
    border:     "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
  },
  errorCard: {
    display:    "flex",
    alignItems: "center",
    gap:        "10px",
    padding:    "16px",
    background: "rgba(239,68,68,0.05)",
    border:     "1px solid rgba(239,68,68,0.2)",
    borderRadius: "var(--radius-lg)",
  },

  inlineCode: {
    fontFamily:   "var(--font-mono)",
    fontSize:     "0.9em",
    background:   "rgba(255,255,255,0.06)",
    borderRadius: "3px",
    padding:      "1px 4px",
  },
};
