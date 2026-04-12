import { useRef, useEffect } from "react";

export default function ChatComposer({ value, onChange, onSend, disabled }) {
  const textareaRef = useRef(null);

  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }, [value]);

  function handleKeyDown(e) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!disabled && value.trim()) onSend(value);
    }
  }

  function handleSend() {
    if (!disabled && value.trim()) onSend(value);
  }

  const canSend = !disabled && value.trim().length > 0;

  return (
    <div style={styles.wrap}>
      <div style={{ ...styles.inner, ...(disabled ? styles.innerDisabled : {}) }}>
        <textarea
          ref={textareaRef}
          style={styles.textarea}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            disabled
              ? "Enavia está processando..."
              : "Envie uma instrução para a Enavia..."
          }
          disabled={disabled}
          rows={1}
          aria-label="Campo de mensagem"
        />
        <button
          style={{
            ...styles.sendBtn,
            ...(canSend ? styles.sendBtnActive : styles.sendBtnIdle),
          }}
          onClick={handleSend}
          disabled={!canSend}
          title="Enviar (Enter)"
          aria-label="Enviar mensagem"
        >
          ↑
        </button>
      </div>
      <p style={styles.hint}>Enter para enviar · Shift+Enter para nova linha</p>
    </div>
  );
}

const styles = {
  wrap: {
    padding: "10px 16px 8px",
    background: "var(--bg-sidebar)",
    borderTop: "1px solid var(--border)",
    flexShrink: 0,
  },
  inner: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "8px 8px 8px 14px",
    transition: "border-color 0.15s",
  },
  innerDisabled: {
    opacity: 0.55,
  },
  textarea: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    color: "var(--text-primary)",
    fontSize: "14px",
    lineHeight: 1.5,
    resize: "none",
    fontFamily: "var(--font-body)",
    minHeight: "24px",
    maxHeight: "140px",
    overflowY: "auto",
    paddingTop: "2px",
  },
  sendBtn: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
    borderRadius: "50%",
    border: "none",
    fontSize: "16px",
    fontWeight: 700,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "all 0.15s",
    flexShrink: 0,
  },
  sendBtnActive: {
    background: "var(--color-primary)",
    color: "#0B1120",
    cursor: "pointer",
  },
  sendBtnIdle: {
    background: "var(--border)",
    color: "var(--text-muted)",
    cursor: "not-allowed",
  },
  hint: {
    fontSize: "10px",
    color: "var(--text-muted)",
    marginTop: "5px",
    paddingLeft: "2px",
  },
};
