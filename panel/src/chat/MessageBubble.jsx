function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function MessageBubble({ message }) {
  const { role, content, timestamp } = message;

  if (role === "system") {
    return (
      <div style={styles.systemWrap}>
        <span style={styles.systemLine} />
        <span style={styles.systemText}>{content}</span>
        <span style={styles.systemLine} />
      </div>
    );
  }

  if (role === "user") {
    return (
      <div style={styles.userWrap}>
        <div style={styles.userBubble}>
          <p style={styles.bubbleText}>{content}</p>
          <span style={styles.timestamp}>{formatTime(timestamp)}</span>
        </div>
      </div>
    );
  }

  const hits = Array.isArray(message.memoryHits) ? message.memoryHits : [];
  const targetFields = Array.isArray(message.targetFieldsSeen) ? message.targetFieldsSeen : [];
  const hasBadges = message.targetSeen === true || message.memoryApplied === true;

  return (
    <div style={styles.enaWrap}>
      <div style={styles.enaAvatar} aria-hidden="true">
        ◆
      </div>
      <div style={styles.enaBubble}>
        <p style={styles.bubbleText}>{content}</p>
        {hasBadges && (
          <div style={styles.badgesWrap}>
            {message.targetSeen === true && (
              <span
                role="status"
                style={styles.targetBadge}
                title={targetFields.length > 0 ? `campos: ${targetFields.join(", ")}` : "Alvo operacional ativo"}
                aria-label={`Alvo operacional ativo${targetFields.length > 0 ? `, campos: ${targetFields.join(", ")}` : ""}`}
              >
                🎯 alvo ativo{targetFields.length > 0 ? ` (${targetFields.length} campos)` : ""}
              </span>
            )}
            {message.memoryApplied === true && (
              <span
                style={styles.memoryBadge}
                title={hits.length > 0 ? hits.map((h) => h.title).join(", ") : "Memória aplicada"}
                aria-label={`Memória aplicada${hits.length > 0 ? `: ${hits.map((h) => h.title).join(", ")}` : ""}`}
              >
                🧠 memória aplicada{hits.length > 0 ? ` (${hits.length})` : ""}
              </span>
            )}
          </div>
        )}
        <span style={styles.timestamp}>{formatTime(timestamp)}</span>
      </div>
    </div>
  );
}

const styles = {
  systemWrap: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "2px 0",
  },
  systemLine: {
    flex: 1,
    height: "1px",
    background: "var(--border)",
  },
  systemText: {
    fontSize: "11px",
    color: "var(--text-muted)",
    whiteSpace: "nowrap",
    letterSpacing: "0.4px",
  },

  userWrap: {
    display: "flex",
    justifyContent: "flex-end",
  },
  userBubble: {
    maxWidth: "68%",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "16px 16px 4px 16px",
    padding: "10px 14px",
  },

  enaWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  enaAvatar: {
    width: "32px",
    height: "32px",
    minWidth: "32px",
    borderRadius: "50%",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--color-primary)",
    fontSize: "14px",
    fontWeight: 700,
    marginTop: "2px",
    flexShrink: 0,
  },
  enaBubble: {
    maxWidth: "68%",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "4px 16px 16px 16px",
    padding: "10px 14px",
  },

  bubbleText: {
    fontSize: "14px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    whiteSpace: "pre-wrap",
  },
  memoryBadge: {
    display: "inline-block",
    fontSize: "10px",
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
    borderRadius: "10px",
    padding: "1px 8px",
    cursor: "default",
  },
  targetBadge: {
    display: "inline-block",
    fontSize: "10px",
    color: "#10B981",
    background: "rgba(16,185,129,0.08)",
    border: "1px solid rgba(16,185,129,0.25)",
    borderRadius: "10px",
    padding: "1px 8px",
    cursor: "default",
  },
  badgesWrap: {
    display: "flex",
    flexWrap: "wrap",
    gap: "6px",
    marginTop: "6px",
  },
  timestamp: {
    display: "block",
    fontSize: "10px",
    color: "var(--text-muted)",
    marginTop: "4px",
    textAlign: "right",
  },
};
