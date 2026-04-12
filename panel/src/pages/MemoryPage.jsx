export default function MemoryPage() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>🧠</div>
        <h2 style={styles.heading}>Memória</h2>
        <p style={styles.description}>
          Explore a memória da ENAVIA. Consulte decisões passadas, contextos
          consolidados e histórico de aprendizado do sistema.
        </p>
        <div style={styles.placeholder}>
          <div style={styles.memoryItem}>
            <span style={styles.memoryKey}>last_deployment</span>
            <span style={styles.memoryVal}>2026-04-11T23:45:00Z</span>
          </div>
          <div style={styles.memoryItem}>
            <span style={styles.memoryKey}>contracts_completed</span>
            <span style={styles.memoryVal}>12</span>
          </div>
          <div style={styles.memoryItem}>
            <span style={styles.memoryKey}>cognitive_state</span>
            <span style={styles.memoryVal}>active</span>
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
    fontFamily: "var(--font-mono)",
    textAlign: "left",
  },
  memoryItem: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "6px 10px",
    background: "var(--bg-surface)",
    borderRadius: "var(--radius-sm)",
    fontSize: "12px",
  },
  memoryKey: {
    color: "var(--color-primary)",
  },
  memoryVal: {
    color: "var(--text-secondary)",
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
