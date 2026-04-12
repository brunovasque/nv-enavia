import { useLocation } from "react-router-dom";

const PAGE_TITLES = {
  "/chat": "Chat",
  "/plan": "Plano",
  "/memory": "Memória",
  "/execution": "Execução",
  "/browser": "Browser Executor",
};

export default function TopBar() {
  const { pathname } = useLocation();
  const title = PAGE_TITLES[pathname] || "ENAVIA";
  const isBrowser = pathname === "/browser";

  return (
    <header style={styles.topbar}>
      <div style={styles.left}>
        <h1 style={styles.title}>{title}</h1>
        {isBrowser && (
          <span style={styles.browserTag}>Viewport Principal</span>
        )}
      </div>

      <div style={styles.right}>
        <div style={styles.statusDot} title="Sistema operacional" />
        <span style={styles.statusText}>Operacional</span>
      </div>
    </header>
  );
}

const styles = {
  topbar: {
    height: "var(--topbar-height)",
    minHeight: "var(--topbar-height)",
    background: "var(--bg-topbar)",
    borderBottom: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    flexShrink: 0,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  title: {
    fontSize: "15px",
    fontWeight: 600,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
  },
  browserTag: {
    fontSize: "10px",
    fontWeight: 600,
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    padding: "2px 8px",
    borderRadius: "4px",
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  right: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  statusDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#10B981",
    boxShadow: "0 0 6px rgba(16, 185, 129, 0.4)",
  },
  statusText: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
};
