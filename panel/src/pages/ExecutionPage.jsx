export default function ExecutionPage() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>⚡</div>
        <h2 style={styles.heading}>Execução</h2>
        <p style={styles.description}>
          Monitore execuções ativas. Acompanhe micro-PRs, deploys, validações e o
          estado do pipeline de contratos em tempo real.
        </p>
        <div style={styles.placeholder}>
          <div style={styles.execItem}>
            <span style={styles.execDot} />
            <span style={styles.execLabel}>contract:NV-042</span>
            <span style={styles.execStatus}>executing</span>
          </div>
          <div style={styles.execItem}>
            <span style={{ ...styles.execDot, background: "#10B981" }} />
            <span style={styles.execLabel}>contract:NV-041</span>
            <span style={{ ...styles.execStatus, color: "#10B981" }}>completed</span>
          </div>
          <div style={styles.execItem}>
            <span style={{ ...styles.execDot, background: "var(--text-muted)" }} />
            <span style={styles.execLabel}>contract:NV-040</span>
            <span style={{ ...styles.execStatus, color: "var(--text-muted)" }}>cancelled</span>
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
    gap: "6px",
    textAlign: "left",
  },
  execItem: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "8px 12px",
    background: "var(--bg-surface)",
    borderRadius: "var(--radius-sm)",
    fontSize: "13px",
    fontFamily: "var(--font-mono)",
  },
  execDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    flexShrink: 0,
  },
  execLabel: {
    color: "var(--text-secondary)",
    flex: 1,
  },
  execStatus: {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--color-primary)",
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
