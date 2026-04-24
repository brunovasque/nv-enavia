import { useRef, useImperativeHandle, forwardRef } from "react";
import { ACCEPTED_EXTENSIONS } from "./useAttachments";

const AttachmentBar = forwardRef(function AttachmentBar(
  { attachments, onAdd, onRemove, error, onDismissError },
  ref,
) {
  const inputRef = useRef(null);

  // Expose click() so parent (ChatPage) can trigger via ref
  useImperativeHandle(ref, () => ({
    click: () => inputRef.current?.click(),
  }));

  function handleFileChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      onAdd(e.target.files);
      // Reset so same file can be re-attached after removal
      e.target.value = "";
    }
  }

  return (
    <div style={styles.wrap}>
      <div style={styles.row}>
        <span style={styles.label}>📎 Contexto</span>

        <button
          style={styles.addBtn}
          onClick={() => inputRef.current?.click()}
          title={`Tipos aceitos: ${ACCEPTED_EXTENSIONS.join(" ")}`}
        >
          + Anexar arquivo
        </button>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS.join(",")}
          multiple
          style={{ display: "none" }}
          onChange={handleFileChange}
          aria-label="Selecionar arquivo para anexar como contexto"
        />
      </div>

      {error && (
        <div style={styles.error} role="alert">
          <span style={styles.errorText}>⚠ {error}</span>
          <button style={styles.errorDismiss} onClick={onDismissError} aria-label="Fechar aviso">×</button>
        </div>
      )}

      {attachments.length > 0 && (
        <div style={styles.chips}>
          {attachments.map((att) => (
            <div key={att.id} style={styles.chip} title={att.truncated ? "Arquivo truncado por tamanho" : att.name}>
              <span style={styles.chipName}>{att.name}</span>
              {att.truncated && <span style={styles.chipTrunc} title="Truncado">✂</span>}
              <button
                style={styles.chipRemove}
                onClick={() => onRemove(att.id)}
                aria-label={`Remover ${att.name}`}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default AttachmentBar;

const styles = {
  wrap: {
    padding: "4px 16px 2px",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  row: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  label: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontWeight: 600,
  },
  addBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "4px",
    color: "var(--text-secondary)",
    fontSize: "11px",
    cursor: "pointer",
    padding: "2px 8px",
    fontFamily: "var(--font-body)",
  },
  error: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    background: "rgba(239,68,68,0.08)",
    border: "1px solid rgba(239,68,68,0.2)",
    borderRadius: "4px",
    padding: "3px 8px",
    gap: "6px",
  },
  errorText: {
    fontSize: "11px",
    color: "#EF4444",
    flex: 1,
  },
  errorDismiss: {
    background: "transparent",
    border: "none",
    color: "#EF4444",
    fontSize: "14px",
    cursor: "pointer",
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
  },
  chips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
  },
  chip: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "12px",
    padding: "2px 8px",
    maxWidth: "180px",
  },
  chipName: {
    fontSize: "11px",
    color: "var(--text-secondary)",
    overflow: "hidden",
    whiteSpace: "nowrap",
    textOverflow: "ellipsis",
    flex: 1,
  },
  chipTrunc: {
    fontSize: "10px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  chipRemove: {
    background: "transparent",
    border: "none",
    color: "var(--text-muted)",
    fontSize: "13px",
    cursor: "pointer",
    padding: "0 1px",
    lineHeight: 1,
    flexShrink: 0,
  },
};
