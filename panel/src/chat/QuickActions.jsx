// ============================================================================
// QuickActions — barra de ações rápidas do Chat operacional
//
// Botões:
//   1. Validar sistema  — monta prompt read-only e chama /planner/run
//   2. Gerar plano      — pega msg atual + target + anexos → /planner/run
//   3. Aprovar execução — /chat/run com message="aprovado"
//   4. Salvar na memória — /memory/manual (POST) com preferência operacional
//   5. Anexar contexto  — delega para AttachmentBar (trigger via onTriggerAttach)
// ============================================================================

export default function QuickActions({
  onValidate,
  onGeneratePlan,
  onApprove,
  onSaveMemory,
  onTriggerAttach,
  disabled,
  memoryAvailable,
  pendingPlan,
}) {
  const actions = [
    {
      id:      "validate",
      icon:    "🔍",
      label:   "Validar sistema",
      onClick: onValidate,
      title:   "Cria plano de validação read-only do worker alvo",
    },
    {
      id:      "plan",
      icon:    "📋",
      label:   "Gerar plano",
      onClick: onGeneratePlan,
      title:   "Gera plano com contexto atual (não executa)",
      highlight: true,
    },
    {
      id:      "approve",
      icon:    "✅",
      label:   "Aprovar execução",
      onClick: onApprove,
      title:   pendingPlan
        ? "Envia aprovação para o plano pendente"
        : "Não há plano pendente para aprovar",
      disabled: !pendingPlan,
    },
    {
      id:      "memory",
      icon:    "🧠",
      label:   "Salvar na memória",
      onClick: onSaveMemory,
      title:   memoryAvailable
        ? "Salva preferência operacional via /memory/manual"
        : "Endpoint /memory/manual não disponível nesta sessão",
      disabled: !memoryAvailable,
    },
    {
      id:      "attach",
      icon:    "📎",
      label:   "Anexar contexto",
      onClick: onTriggerAttach,
      title:   "Anexa arquivo como contexto para chat/planner",
    },
  ];

  return (
    <div style={styles.bar} role="toolbar" aria-label="Ações rápidas operacionais">
      {actions.map((a) => {
        const isDisabled = disabled || a.disabled;
        return (
          <button
            key={a.id}
            style={{
              ...styles.btn,
              ...(a.highlight && !isDisabled ? styles.btnHighlight : {}),
              ...(isDisabled ? styles.btnDisabled : {}),
            }}
            onClick={isDisabled ? undefined : a.onClick}
            disabled={isDisabled}
            title={a.title}
            aria-label={a.label}
          >
            <span style={styles.btnIcon}>{a.icon}</span>
            <span style={styles.btnLabel}>{a.label}</span>
          </button>
        );
      })}
    </div>
  );
}

const styles = {
  bar: {
    display: "flex",
    flexWrap: "wrap",
    gap: "4px",
    padding: "6px 16px 4px",
    background: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  btn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 10px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    color: "var(--text-secondary)",
    fontSize: "12px",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "border-color 0.15s, color 0.15s",
  },
  btnHighlight: {
    border: "1px solid var(--color-primary-border)",
    color: "var(--color-primary)",
  },
  btnDisabled: {
    opacity: 0.4,
    cursor: "not-allowed",
  },
  btnIcon: {
    fontSize: "13px",
    lineHeight: 1,
  },
  btnLabel: {
    lineHeight: 1,
  },
};
