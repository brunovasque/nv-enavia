export default function PlanPage() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>📋</div>
        <h2 style={styles.heading}>Plano</h2>
        <p style={styles.description}>
          Visualize e gerencie planos de execução. Acompanhe fases, tarefas
          decompostas e status de cada etapa do contrato.
        </p>
        <div style={styles.placeholder}>
          <div style={styles.phaseItem}>
            <span style={styles.phaseStatus}>●</span>
            <span style={styles.phaseLabel}>Fase 1 — Análise</span>
            <span style={styles.phaseBadge}>Completa</span>
          </div>
          <div style={styles.phaseItem}>
            <span style={{ ...styles.phaseStatus, color: "var(--color-primary)" }}>●</span>
            <span style={styles.phaseLabel}>Fase 2 — Implementação</span>
            <span style={{ ...styles.phaseBadge, color: "var(--color-primary)", borderColor: "var(--color-primary-border)" }}>Em progresso</span>
          </div>
          <div style={styles.phaseItem}>
            <span style={{ ...styles.phaseStatus, color: "var(--text-muted)" }}>○</span>
            <span style={styles.phaseLabel}>Fase 3 — Validação</span>
            <span style={{ ...styles.phaseBadge, color: "var(--text-muted)", borderColor: "var(--border)" }}>Pendente</span>
          </div>
        </div>
        <span style={styles.badge}>Em breve</span>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: "24px",
  },
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "40px",
    maxWidth: "520px",
    width: "100%",
    textAlign: "center",
  },
  iconWrap: {
    fontSize: "40px",
    marginBottom: "16px",
  },
  heading: {
    fontSize: "20px",
    fontWeight: 600,
    color: "var(--text-primary)",
    marginBottom: "8px",
  },
  description: {
    fontSize: "14px",
    color: "var(--text-secondary)",
    lineHeight: 1.6,
    marginBottom: "24px",
  },
  placeholder: {
    background: "var(--bg-base)",
    borderRadius: "var(--radius-md)",
    padding: "16px",
    marginBottom: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    textAlign: "left",
  },
  phaseItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    background: "var(--bg-surface)",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
  },
  phaseStatus: {
    color: "#10B981",
    fontSize: "10px",
  },
  phaseLabel: {
    color: "var(--text-secondary)",
    flex: 1,
  },
  phaseBadge: {
    fontSize: "10px",
    fontWeight: 600,
    color: "#10B981",
    border: "1px solid rgba(16,185,129,0.3)",
    padding: "2px 8px",
    borderRadius: "4px",
  },
  badge: {
    display: "inline-block",
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "4px 12px",
    borderRadius: "20px",
    letterSpacing: "0.5px",
  },
};
