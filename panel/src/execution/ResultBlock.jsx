// ============================================================================
// ResultBlock — desfecho real da execução (hero em completed)
// Ocupa a parte superior do main column quando status = completed
// Não é um card lateral — é a conclusão visível da jornada
// ============================================================================

import { formatTsFull } from "./mockExecution";

export default function ResultBlock({ result }) {
  if (!result) return null;

  return (
    <div style={s.wrap}>
      {/* Header: marca de conclusão */}
      <div style={s.header}>
        <div style={s.headerLeft}>
          <div style={s.checkCircle} aria-hidden="true">
            <span style={s.checkMark}>✓</span>
          </div>
          <div>
            <p style={s.title}>Execução Concluída</p>
            <p style={s.subtitle}>{result.summary}</p>
          </div>
        </div>
        <div style={s.headerRight}>
          <span style={s.completedBadge}>COMPLETED</span>
        </div>
      </div>

      {/* Divider */}
      <div style={s.divider} />

      {/* Output block */}
      <div style={s.outputSection}>
        <p style={s.outputLabel}>Saída da execução</p>
        <pre style={s.outputText}>{result.output}</pre>
      </div>

      {/* Footer: delivered timestamp */}
      <div style={s.footer}>
        <span style={s.footerDot} aria-hidden="true">◆</span>
        <span style={s.footerText}>
          Resultado entregue em {formatTsFull(result.deliveredAt)}
        </span>
      </div>
    </div>
  );
}

const s = {
  wrap: {
    background: "linear-gradient(135deg, rgba(16,185,129,0.08) 0%, rgba(16,185,129,0.03) 100%)",
    border: "1px solid rgba(16,185,129,0.35)",
    borderRadius: "var(--radius-lg)",
    padding: "24px 28px",
    display: "flex",
    flexDirection: "column",
    gap: "18px",
    flexShrink: 0,
    boxShadow: "0 0 32px rgba(16,185,129,0.06)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: "16px",
  },
  headerLeft: {
    display: "flex",
    alignItems: "flex-start",
    gap: "14px",
    flex: 1,
    minWidth: 0,
  },
  checkCircle: {
    width: "40px",
    height: "40px",
    minWidth: "40px",
    borderRadius: "50%",
    background: "rgba(16,185,129,0.15)",
    border: "2px solid rgba(16,185,129,0.40)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkMark: {
    fontSize: "18px",
    color: "#10B981",
    fontWeight: 700,
    lineHeight: 1,
  },
  title: {
    fontSize: "17px",
    fontWeight: 700,
    color: "#10B981",
    letterSpacing: "0.2px",
    lineHeight: 1.2,
    marginBottom: "3px",
  },
  subtitle: {
    fontSize: "13px",
    color: "var(--text-secondary)",
    lineHeight: 1.4,
  },
  headerRight: {
    flexShrink: 0,
  },
  completedBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1.4px",
    color: "#10B981",
    background: "rgba(16,185,129,0.12)",
    border: "1px solid rgba(16,185,129,0.30)",
    padding: "4px 10px",
    borderRadius: "4px",
  },
  divider: {
    height: "1px",
    background: "rgba(16,185,129,0.15)",
  },
  outputSection: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },
  outputLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "rgba(16,185,129,0.7)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  outputText: {
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: 1.8,
    background: "rgba(0,0,0,0.25)",
    border: "1px solid rgba(16,185,129,0.15)",
    borderRadius: "var(--radius-md)",
    padding: "14px 16px",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
  },
  footer: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  footerDot: {
    fontSize: "8px",
    color: "rgba(16,185,129,0.5)",
    flexShrink: 0,
  },
  footerText: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    letterSpacing: "0.3px",
  },
};
