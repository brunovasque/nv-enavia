import { useState, useRef } from "react";

const DEFAULT_TARGET_REPO     = "brunovasque/nv-enavia";
const DEFAULT_TARGET_WORKER   = "nv-enavia";
const DEFAULT_TARGET_BRANCH   = "main";
const DEFAULT_TARGET_ENV      = "prod";
const DEFAULT_PLACEHOLDERS = {
  target_id:   "nv-enavia-prod",
  target_type: "cloudflare_worker",
  repo:        DEFAULT_TARGET_REPO,
  worker:      DEFAULT_TARGET_WORKER,
  branch:      DEFAULT_TARGET_BRANCH,
  environment: DEFAULT_TARGET_ENV,
  mode:        "read_only",
};

const FIELD_LABELS = {
  target_id:   "Target ID",
  target_type: "Tipo",
  repo:        "Repositório",
  worker:      "Worker",
  branch:      "Branch",
  environment: "Ambiente",
  mode:        "Modo",
};

export default function TargetPanel({ target, onUpdate, onReset, cockpit }) {
  const [expanded, setExpanded] = useState(false);
  const inputRefs = useRef({});

  function handleChange(field, value) {
    onUpdate({ [field]: value });
  }

  const isDefault =
    target.repo === DEFAULT_TARGET_REPO &&
    target.worker === DEFAULT_TARGET_WORKER &&
    target.branch === DEFAULT_TARGET_BRANCH &&
    target.environment === DEFAULT_TARGET_ENV;
  const cockpitIntent = cockpit?.suggestedIntent || "—";
  const cockpitMode = cockpit?.suggestedMode || "—";
  const cockpitRisk = cockpit?.risk || "—";
  const cockpitNextAction = cockpit?.nextAction || "—";
  const cockpitApproval =
    cockpit?.approvalRequired === true ? "Sim" : cockpit?.approvalRequired === false ? "Não" : "—";

  return (
    <div style={styles.wrap}>
      <button
        style={styles.header}
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title="Expandir/recolher Target operacional"
      >
        <span style={styles.headerIcon}>🎯</span>
        <span style={styles.headerLabel}>Target</span>
        <span style={styles.headerValue}>
          {target.worker}/{target.branch}
          <span style={{ ...styles.modeBadge, ...(target.mode === "read_only" ? styles.modeReadOnly : styles.modeWrite) }}>
            {target.mode === "read_only" ? "Seguro" : target.mode}
          </span>
        </span>
        <span style={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </button>

      <div style={styles.cockpitWrap}>
        <p style={styles.cockpitTitle}>Cockpit passivo</p>
        <div style={styles.cockpitGrid}>
          <div style={styles.cockpitItem}><span style={styles.cockpitLabel}>Intenção</span><span style={styles.cockpitValue}>{cockpitIntent}</span></div>
          <div style={styles.cockpitItem}><span style={styles.cockpitLabel}>Modo</span><span style={styles.cockpitValue}>{cockpitMode}</span></div>
          <div style={styles.cockpitItem}><span style={styles.cockpitLabel}>Risco</span><span style={styles.cockpitValue}>{cockpitRisk}</span></div>
          <div style={styles.cockpitItem}><span style={styles.cockpitLabel}>Próxima ação</span><span style={styles.cockpitValue}>{cockpitNextAction}</span></div>
          <div style={styles.cockpitItem}><span style={styles.cockpitLabel}>Aprovação necessária</span><span style={styles.cockpitValue}>{cockpitApproval}</span></div>
        </div>
      </div>

      {expanded && (
        <div style={styles.fields}>
          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <div key={field} style={styles.fieldRow}>
              <label style={styles.fieldLabel}>{label}</label>
              {field === "mode" ? (
                <span style={styles.modeReadOnlyTag} title="Modo write/patch/deploy bloqueado nesta fase">
                  Seguro · Protegido · Execução exige aprovação
                </span>
              ) : (
                <input
                  ref={(el) => { inputRefs.current[field] = el; }}
                  style={styles.fieldInput}
                  value={target[field] ?? ""}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={DEFAULT_PLACEHOLDERS[field] ?? ""}
                  aria-label={label}
                />
              )}
            </div>
          ))}

          {!isDefault && (
            <button style={styles.resetBtn} onClick={onReset} title="Restaurar valores padrão">
              ↺ Restaurar padrão
            </button>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  wrap: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    margin: "0 16px 6px",
    overflow: "hidden",
    flexShrink: 0,
  },
  header: {
    width: "100%",
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "7px 10px",
    background: "transparent",
    border: "none",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    textAlign: "left",
  },
  headerIcon: {
    fontSize: "13px",
    flexShrink: 0,
  },
  headerLabel: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.7px",
    flexShrink: 0,
  },
  headerValue: {
    flex: 1,
    fontSize: "12px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  modeBadge: {
    fontSize: "10px",
    fontWeight: 600,
    borderRadius: "3px",
    padding: "1px 5px",
    flexShrink: 0,
  },
  modeReadOnly: {
    background: "rgba(16,185,129,0.12)",
    color: "#10B981",
    border: "1px solid rgba(16,185,129,0.25)",
  },
  modeWrite: {
    background: "rgba(239,68,68,0.12)",
    color: "#EF4444",
    border: "1px solid rgba(239,68,68,0.25)",
  },
  chevron: {
    fontSize: "10px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  cockpitWrap: {
    padding: "0 10px 8px",
    borderTop: "1px solid var(--border)",
  },
  cockpitTitle: {
    margin: "6px 0 4px",
    fontSize: "10px",
    letterSpacing: "0.6px",
    textTransform: "uppercase",
    color: "var(--text-muted)",
    fontWeight: 700,
  },
  cockpitGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "4px 8px",
  },
  cockpitItem: {
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
  },
  cockpitLabel: {
    fontSize: "10px",
    color: "var(--text-muted)",
    lineHeight: 1.2,
  },
  cockpitValue: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    lineHeight: 1.25,
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    overflow: "hidden",
  },
  fields: {
    padding: "0 10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  fieldRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    paddingTop: "4px",
  },
  fieldLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    width: "80px",
    flexShrink: 0,
  },
  fieldInput: {
    flex: 1,
    background: "var(--bg-sidebar)",
    border: "1px solid var(--border-light)",
    borderRadius: "4px",
    padding: "3px 7px",
    color: "var(--text-primary)",
    fontSize: "12px",
    fontFamily: "var(--font-body)",
    outline: "none",
  },
  modeReadOnlyTag: {
    flex: 1,
    fontSize: "11px",
    color: "#10B981",
    fontStyle: "italic",
    lineHeight: 1.35,
  },
  resetBtn: {
    alignSelf: "flex-end",
    marginTop: "2px",
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-muted)",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 8px",
    fontFamily: "var(--font-body)",
  },
};
