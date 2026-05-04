function formatTime(date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function parseInlineMarkdown(text) {
  const value = typeof text === "string" ? text : "";
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part, idx) => {
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code key={`md-${idx}`} style={styles.inlineCode}>
          {part.slice(1, -1)}
        </code>
      );
    }
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={`md-${idx}`}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    return <span key={`md-${idx}`}>{part}</span>;
  });
}

export function parseReadableBlocks(content) {
  const text = typeof content === "string" ? content.replace(/\r\n/g, "\n") : "";
  const lines = text.split("\n");
  const blocks = [];
  let paragraph = [];
  let list = null;

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push({ type: "paragraph", text: paragraph.join("\n") });
    paragraph = [];
  };

  const flushList = () => {
    if (!list || list.items.length === 0) return;
    blocks.push(list);
    list = null;
  };

  for (const rawLine of lines) {
    const line = rawLine ?? "";
    const trimmed = line.trim();
    const bullet = line.match(/^\s*([-*]|\d+[.)])\s+(.+)$/);
    if (trimmed.length === 0) {
      flushParagraph();
      flushList();
      continue;
    }
    if (bullet) {
      flushParagraph();
      const ordered = /^\d/.test(bullet[1]);
      if (!list || list.type !== "list" || list.ordered !== ordered) {
        flushList();
        list = { type: "list", ordered, items: [] };
      }
      list.items.push(bullet[2]);
      continue;
    }
    flushList();
    paragraph.push(line);
  }

  flushParagraph();
  flushList();
  return blocks.length > 0 ? blocks : [{ type: "paragraph", text }];
}

function renderReadableContent(content) {
  const blocks = parseReadableBlocks(content);
  return blocks.map((block, idx) => {
    if (block.type === "list") {
      const ListTag = block.ordered ? "ol" : "ul";
      return (
        <ListTag key={`block-${idx}`} style={block.ordered ? styles.orderedList : styles.unorderedList}>
          {block.items.map((item, itemIdx) => (
            <li key={`item-${idx}-${itemIdx}`} style={styles.listItem}>
              {parseInlineMarkdown(item)}
            </li>
          ))}
        </ListTag>
      );
    }

    const rows = block.text.split("\n");
    return (
      <p key={`block-${idx}`} style={styles.bubbleText}>
        {rows.map((row, rowIdx) => (
          <span key={`row-${idx}-${rowIdx}`}>
            {parseInlineMarkdown(row)}
            {rowIdx < rows.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
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
          {renderReadableContent(content)}
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
        {renderReadableContent(content)}
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
    margin: 0,
    marginBottom: "10px",
  },
  unorderedList: {
    margin: "0 0 10px 18px",
    padding: 0,
  },
  orderedList: {
    margin: "0 0 10px 22px",
    padding: 0,
  },
  listItem: {
    fontSize: "14px",
    color: "var(--text-primary)",
    lineHeight: 1.6,
    marginBottom: "4px",
  },
  inlineCode: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: "12px",
    background: "var(--bg-sidebar)",
    border: "1px solid var(--border-light)",
    borderRadius: "4px",
    padding: "1px 4px",
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
