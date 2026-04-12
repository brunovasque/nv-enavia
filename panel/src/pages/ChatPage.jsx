import { useEffect, useRef } from "react";
import { useChatState } from "../chat/useChatState";
import MessageBubble from "../chat/MessageBubble";
import ChatComposer from "../chat/ChatComposer";

// ── Empty State — cara forte de produto ────────────────────────────
function EmptyState({ onSend, onInputChange }) {
  const CAPS = [
    {
      icon: "📋",
      label: "Planejamento",
      desc: "Gera planos táticos com base no seu contexto operacional",
    },
    {
      icon: "🧠",
      label: "Memória",
      desc: "Retém contexto entre sessões e consolida histórico estruturado",
    },
    {
      icon: "⚡",
      label: "Execução",
      desc: "Orquestra ações, monitora status e reporta em tempo real",
    },
  ];

  const QUICK = [
    "Analise o escopo do próximo contrato",
    "Qual é o status das execuções pendentes?",
    "Consolide o histórico desta semana",
  ];

  return (
    <div style={styles.empty}>
      <div style={styles.emptyMark} aria-hidden="true">
        ◆
      </div>
      <h2 style={styles.emptyHeading}>ENAVIA</h2>
      <p style={styles.emptyTagline}>Sistema de Inteligência Operacional</p>

      <div style={styles.capCards}>
        {CAPS.map(({ icon, label, desc }) => (
          <div key={label} style={styles.capCard}>
            <span style={styles.capIcon}>{icon}</span>
            <strong style={styles.capLabel}>{label}</strong>
            <p style={styles.capDesc}>{desc}</p>
          </div>
        ))}
      </div>

      <p style={styles.emptyDividerLabel}>Comece com uma instrução rápida</p>
      <div style={styles.quickList}>
        {QUICK.map((q) => (
          <button
            key={q}
            style={styles.quickBtn}
            onClick={() => {
              onInputChange(q);
              onSend(q);
            }}
          >
            {q} →
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Thinking Indicator ─────────────────────────────────────────────
function ThinkingBubble() {
  return (
    <div style={styles.thinkingWrap}>
      <div style={styles.thinkingAvatar} aria-hidden="true">
        ◆
      </div>
      <div style={styles.thinkingBubble} aria-label="Enavia processando">
        <span className="chat-dot" />
        <span className="chat-dot" />
        <span className="chat-dot" />
      </div>
    </div>
  );
}

// ── Aux Panel (leve) ───────────────────────────────────────────────
function AuxPanel({ messageCount, thinking }) {
  const status = thinking ? "Processando" : messageCount > 0 ? "Ativa" : "Aguardando";
  const statusColor = thinking
    ? "var(--color-primary)"
    : messageCount > 0
    ? "#10B981"
    : "var(--text-muted)";

  return (
    <aside style={styles.aux}>
      <p style={styles.auxSection}>Sessão</p>
      <AuxRow label="Status" value={status} valueColor={statusColor} />
      <AuxRow label="Mensagens" value={messageCount} />
      <div style={styles.auxDivider} />
      <p style={styles.auxSection}>Sistema</p>
      <AuxRow label="Módulo" value="Chat" />
      <AuxRow label="Backend" value="P6 / P7" valueColor="var(--text-muted)" />
    </aside>
  );
}

function AuxRow({ label, value, valueColor }) {
  return (
    <div style={styles.auxRow}>
      <span style={styles.auxKey}>{label}</span>
      <span style={{ ...styles.auxVal, ...(valueColor ? { color: valueColor } : {}) }}>
        {value}
      </span>
    </div>
  );
}

// ── Chat Page ──────────────────────────────────────────────────────
export default function ChatPage() {
  const {
    messages,
    thinking,
    error,
    inputValue,
    setInputValue,
    sendMessage,
  } = useChatState();

  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  function handleSend(text) {
    setInputValue("");
    sendMessage(text);
  }

  const isEmpty = messages.length === 0 && !thinking;
  const msgCount = messages.filter((m) => m.role !== "system").length;

  return (
    <div style={styles.page}>
      {/* ── Main chat column ── */}
      <div style={styles.chatMain}>
        {/* Header */}
        <div style={styles.chatHeader}>
          <div style={styles.headerLeft}>
            <span style={styles.headerMark} aria-hidden="true">
              ◆
            </span>
            <div>
              <p style={styles.headerTitle}>Enavia Chat</p>
              <p style={styles.headerSub}>Inteligência Operacional</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <span
              style={{
                ...styles.statusDot,
                background: thinking ? "var(--color-primary)" : "#10B981",
                boxShadow: thinking
                  ? "0 0 6px rgba(0,180,216,0.5)"
                  : "0 0 6px rgba(16,185,129,0.45)",
              }}
            />
            <span style={styles.statusTxt}>
              {thinking ? "Processando" : "Online"}
            </span>
          </div>
        </div>

        {/* Messages / Empty */}
        <div style={styles.messagesArea}>
          {isEmpty ? (
            <EmptyState onSend={handleSend} onInputChange={setInputValue} />
          ) : (
            <div style={styles.messagesList}>
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
              {thinking && <ThinkingBubble />}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* Error bar */}
        {error && (
          <div style={styles.errorBar} role="alert">
            ⚠ {error}
          </div>
        )}

        {/* Composer */}
        <ChatComposer
          value={inputValue}
          onChange={setInputValue}
          onSend={handleSend}
          disabled={thinking}
        />
      </div>

      {/* ── Aux panel (leve) ── */}
      <AuxPanel messageCount={msgCount} thinking={thinking} />
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────
const styles = {
  page: {
    display: "flex",
    height: "100%",
    overflow: "hidden",
    background: "var(--bg-content)",
  },

  // Chat column
  chatMain: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    minWidth: 0,
    overflow: "hidden",
    borderRight: "1px solid var(--border)",
  },

  // Header
  chatHeader: {
    height: "54px",
    minHeight: "54px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 20px",
    background: "var(--bg-sidebar)",
    borderBottom: "1px solid var(--border)",
    flexShrink: 0,
  },
  headerLeft: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  headerMark: {
    fontSize: "20px",
    color: "var(--color-primary)",
    fontWeight: 700,
  },
  headerTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-primary)",
    lineHeight: 1.2,
  },
  headerSub: {
    fontSize: "10px",
    color: "var(--text-muted)",
    letterSpacing: "0.3px",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statusDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    transition: "background 0.3s, box-shadow 0.3s",
  },
  statusTxt: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },

  // Messages area
  messagesArea: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
  },
  messagesList: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px",
    minHeight: "100%",
  },

  // Error
  errorBar: {
    padding: "8px 20px",
    background: "rgba(239,68,68,0.1)",
    borderTop: "1px solid rgba(239,68,68,0.25)",
    fontSize: "13px",
    color: "#EF4444",
    flexShrink: 0,
  },

  // Thinking bubble
  thinkingWrap: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
  },
  thinkingAvatar: {
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
  thinkingBubble: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "4px 16px 16px 16px",
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: "5px",
  },

  // Empty state
  empty: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    height: "100%",
    padding: "40px 32px",
    textAlign: "center",
  },
  emptyMark: {
    fontSize: "52px",
    color: "var(--color-primary)",
    marginBottom: "14px",
    textShadow: "0 0 32px rgba(0,180,216,0.45)",
    lineHeight: 1,
  },
  emptyHeading: {
    fontSize: "30px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "4px",
    marginBottom: "6px",
  },
  emptyTagline: {
    fontSize: "12px",
    color: "var(--text-secondary)",
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    marginBottom: "36px",
  },
  capCards: {
    display: "flex",
    gap: "12px",
    marginBottom: "36px",
    flexWrap: "wrap",
    justifyContent: "center",
    maxWidth: "580px",
  },
  capCard: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "14px 16px",
    width: "168px",
    textAlign: "left",
  },
  capIcon: {
    fontSize: "20px",
    display: "block",
    marginBottom: "8px",
  },
  capLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-primary)",
    display: "block",
    marginBottom: "4px",
  },
  capDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  emptyDividerLabel: {
    fontSize: "11px",
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
    marginBottom: "10px",
  },
  quickList: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
    width: "100%",
    maxWidth: "420px",
  },
  quickBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-md)",
    padding: "9px 14px",
    color: "var(--text-secondary)",
    fontSize: "13px",
    textAlign: "left",
    cursor: "pointer",
    transition: "border-color 0.15s, color 0.15s",
    fontFamily: "var(--font-body)",
  },

  // Aux panel
  aux: {
    width: "192px",
    minWidth: "192px",
    padding: "16px 14px",
    background: "var(--bg-sidebar)",
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    flexShrink: 0,
  },
  auxSection: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
    marginBottom: "4px",
    marginTop: "6px",
  },
  auxRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "3px 0",
  },
  auxKey: {
    fontSize: "12px",
    color: "var(--text-muted)",
  },
  auxVal: {
    fontSize: "12px",
    color: "var(--text-primary)",
    fontWeight: 500,
  },
  auxDivider: {
    height: "1px",
    background: "var(--border)",
    margin: "8px 0 4px",
  },
};
