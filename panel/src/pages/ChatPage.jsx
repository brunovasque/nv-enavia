export default function ChatPage() {
  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <div style={styles.iconWrap}>💬</div>
        <h2 style={styles.heading}>Chat</h2>
        <p style={styles.description}>
          Interface de comunicação com a ENAVIA. Envie instruções, acompanhe
          respostas e interaja diretamente com o sistema.
        </p>
        <div style={styles.placeholder}>
          <div style={styles.messageMock}>
            <div style={styles.msgBubbleSystem}>
              Olá! Sou a ENAVIA. Como posso ajudar?
            </div>
            <div style={styles.msgBubbleUser}>
              Quero criar um novo contrato...
            </div>
            <div style={styles.msgBubbleSystem}>
              Entendido. Iniciando análise do escopo...
            </div>
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
    padding: "20px",
    marginBottom: "20px",
  },
  messageMock: {
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    alignItems: "flex-start",
  },
  msgBubbleSystem: {
    background: "var(--bg-surface)",
    color: "var(--text-secondary)",
    padding: "8px 14px",
    borderRadius: "12px 12px 12px 4px",
    fontSize: "13px",
    maxWidth: "80%",
  },
  msgBubbleUser: {
    background: "var(--color-primary-glow)",
    color: "var(--color-primary)",
    border: "1px solid var(--color-primary-border)",
    padding: "8px 14px",
    borderRadius: "12px 12px 4px 12px",
    fontSize: "13px",
    maxWidth: "80%",
    alignSelf: "flex-end",
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
