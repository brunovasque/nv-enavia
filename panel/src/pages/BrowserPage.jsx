/* ============================================================================
   BrowserPage — Viewport Principal do Browser Executor
   
   Esta é uma das áreas mais importantes do painel ENAVIA.
   O Browser Executor opera como viewport primário: ocupa toda a área de
   conteúdo sem padding, sidebar colapsa para dar espaço máximo.
   ============================================================================ */

export default function BrowserPage() {
  return (
    <div style={styles.viewport}>
      {/* URL Bar mock */}
      <div style={styles.urlBar}>
        <div style={styles.urlControls}>
          <span style={styles.urlDot} />
          <span style={{ ...styles.urlDot, background: "#F59E0B" }} />
          <span style={{ ...styles.urlDot, background: "#10B981" }} />
        </div>
        <div style={styles.urlInput}>
          <span style={styles.urlLock}>🔒</span>
          <span style={styles.urlText}>https://target-site.example.com</span>
        </div>
        <div style={styles.urlActions}>
          <span style={styles.statusIndicator}>
            <span style={styles.statusPulse} />
            Aguardando conexão
          </span>
        </div>
      </div>

      {/* Main browser viewport */}
      <div style={styles.browserFrame}>
        <div style={styles.browserContent}>
          {/* Hero section */}
          <div style={styles.hero}>
            <div style={styles.heroIcon}>🌐</div>
            <h1 style={styles.heroTitle}>Browser Executor</h1>
            <p style={styles.heroSubtitle}>
              Viewport principal de execução do navegador automatizado
            </p>
          </div>

          {/* Capabilities grid */}
          <div style={styles.capsGrid}>
            <div style={styles.capCard}>
              <span style={styles.capIcon}>🖥️</span>
              <span style={styles.capTitle}>Navegação Automatizada</span>
              <span style={styles.capDesc}>
                Controle total do navegador para executar tarefas em sites reais
              </span>
            </div>
            <div style={styles.capCard}>
              <span style={styles.capIcon}>📸</span>
              <span style={styles.capTitle}>Captura Visual</span>
              <span style={styles.capDesc}>
                Screenshots e gravação da execução em tempo real
              </span>
            </div>
            <div style={styles.capCard}>
              <span style={styles.capIcon}>🔍</span>
              <span style={styles.capTitle}>Inspeção de Elementos</span>
              <span style={styles.capDesc}>
                Análise de DOM, seletores e interação com a página
              </span>
            </div>
            <div style={styles.capCard}>
              <span style={styles.capIcon}>⚡</span>
              <span style={styles.capTitle}>Execução Inteligente</span>
              <span style={styles.capDesc}>
                Pipeline de ações orquestrado pela ENAVIA
              </span>
            </div>
          </div>

          {/* Status footer */}
          <div style={styles.statusBar}>
            <span style={styles.statusBarItem}>
              <span style={styles.statusBarDot} />
              Executor: standby
            </span>
            <span style={styles.statusBarItem}>Viewport: pronto</span>
            <span style={styles.statusBarItem}>Sessão: —</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  viewport: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    width: "100%",
    background: "var(--bg-base)",
    overflow: "hidden",
  },

  /* URL Bar */
  urlBar: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 16px",
    background: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  urlControls: {
    display: "flex",
    gap: "6px",
    flexShrink: 0,
  },
  urlDot: {
    width: "12px",
    height: "12px",
    borderRadius: "50%",
    background: "#EF4444",
    opacity: 0.7,
  },
  urlInput: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "6px 12px",
    fontSize: "13px",
  },
  urlLock: {
    fontSize: "12px",
  },
  urlText: {
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    fontSize: "12px",
  },
  urlActions: {
    flexShrink: 0,
  },
  statusIndicator: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    fontSize: "11px",
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    padding: "4px 12px",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
  },
  statusPulse: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    boxShadow: "0 0 8px var(--color-primary)",
  },

  /* Browser frame */
  browserFrame: {
    flex: 1,
    display: "flex",
    overflow: "hidden",
  },
  browserContent: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "32px",
    padding: "40px",
    background:
      "radial-gradient(ellipse at center, rgba(0,180,216,0.04) 0%, transparent 70%)",
    overflow: "auto",
  },

  /* Hero */
  hero: {
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "12px",
  },
  heroIcon: {
    fontSize: "56px",
    filter: "drop-shadow(0 0 20px rgba(0,180,216,0.3))",
  },
  heroTitle: {
    fontSize: "28px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "-0.5px",
  },
  heroSubtitle: {
    fontSize: "15px",
    color: "var(--text-secondary)",
    maxWidth: "420px",
    lineHeight: 1.6,
  },

  /* Capabilities grid */
  capsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(2, 1fr)",
    gap: "16px",
    maxWidth: "600px",
    width: "100%",
  },
  capCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    transition: "border-color 0.2s ease",
  },
  capIcon: {
    fontSize: "24px",
  },
  capTitle: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
  },
  capDesc: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },

  /* Status bar */
  statusBar: {
    display: "flex",
    gap: "24px",
    padding: "8px 16px",
    background: "var(--bg-sidebar)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    fontSize: "11px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
  },
  statusBarItem: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statusBarDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
  },
};
