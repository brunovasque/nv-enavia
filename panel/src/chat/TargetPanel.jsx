import { useState, useRef } from "react";
import { useTargetState, DEFAULT_TARGET } from "./useTargetState";

const FIELD_LABELS = {
  target_id:   "Target ID",
  target_type: "Tipo",
  repo:        "Repositório",
  worker:      "Worker",
  branch:      "Branch",
  environment: "Ambiente",
  mode:        "Modo",
};

export default function TargetPanel({ target, onUpdate, onReset }) {
  const [expanded, setExpanded] = useState(false);
  const inputRefs = useRef({});

  function handleChange(field, value) {
    onUpdate({ [field]: value });
  }

  const isDefault =
    target.repo === DEFAULT_TARGET.repo &&
    target.worker === DEFAULT_TARGET.worker &&
    target.branch === DEFAULT_TARGET.branch &&
    target.environment === DEFAULT_TARGET.environment;

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
            {target.mode === "read_only" ? "read-only" : target.mode}
          </span>
        </span>
        <span style={styles.chevron}>{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <div style={styles.fields}>
          {Object.entries(FIELD_LABELS).map(([field, label]) => (
            <div key={field} style={styles.fieldRow}>
              <label style={styles.fieldLabel}>{label}</label>
              {field === "mode" ? (
                <span style={styles.modeReadOnlyTag} title="Modo write/patch/deploy bloqueado nesta fase">
                  read_only (fixo)
                </span>
              ) : (
                <input
                  ref={(el) => { inputRefs.current[field] = el; }}
                  style={styles.fieldInput}
                  value={target[field] ?? ""}
                  onChange={(e) => handleChange(field, e.target.value)}
                  placeholder={DEFAULT_TARGET[field] ?? ""}
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
  fields: {
    padding: "0 10px 8px",
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    borderTop: "1px solid var(--border)",
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
