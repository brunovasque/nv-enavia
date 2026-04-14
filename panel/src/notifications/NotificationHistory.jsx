// ============================================================================
// ENAVIA Panel — NotificationHistory (P25-PR7)
//
// In-session list of real Browser Arm notification events.
// Source: notificationStore._history — in-memory, resets on page reload.
//
// Properties of each history item: { id, type, message, ts, read }
//   - type:    "block" | "permission" | "suggestion" | "error"
//   - message: human-readable description of the event
//   - ts:      Unix timestamp (ms) of when the event was recorded
//   - read:    true after markAllRead() was called; false until then
//
// Rules:
//   - History items are NEVER removed (unlike toasts which auto-dismiss).
//   - Deduplication is already enforced by useBrowserNotifications (fingerprint).
//   - markAllRead() marks all items as read — triggered by BrowserExecutorPanel on mount.
//   - Shows events in reverse-chronological order (latest first).
//   - Empty state is shown honestly when no events have been recorded this session.
//   - Does NOT call markAllRead() itself — seeing the list ≠ consuming the read.
//     markAllRead() continues to be called only by BrowserExecutorPanel on /browser entry.
// ============================================================================

import { useNotificationStore } from "./notificationStore";

// ── Type metadata ─────────────────────────────────────────────────────────────

const TYPE_META = {
  block: {
    icon:  "🚫",
    label: "Bloqueio",
    color: "#EF4444",
  },
  permission: {
    icon:  "⚠",
    label: "Permissão",
    color: "#F59E0B",
  },
  suggestion: {
    icon:  "💡",
    label: "Sugestão",
    color: "#8B5CF6",
  },
  error: {
    icon:  "✕",
    label: "Erro",
    color: "#EF4444",
  },
};

const DEFAULT_META = { icon: "●", label: "Evento", color: "#94A3B8" };

// ── Timestamp formatter ───────────────────────────────────────────────────────

function formatHistTs(ts) {
  if (!ts) return "—";
  const d = new Date(ts);
  return d.toLocaleString("pt-BR", {
    hour:   "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * NotificationHistory — renders the in-session event list for the Browser Arm.
 * Placed inside BrowserExecutorPanel (Panel-only, no backend, no Worker).
 */
export default function NotificationHistory() {
  const { history } = useNotificationStore();

  // Render in reverse-chronological order (latest first).
  const reversed = history.slice().reverse();

  return (
    <div style={styles.card} data-testid="notification-history-card">
      <div style={styles.cardHeader}>
        <span style={styles.headerIcon} aria-hidden="true">🔔</span>
        <p style={styles.cardTitle}>Histórico de Notificações</p>
        <span style={styles.countBadge} data-testid="notification-history-count">
          {history.length}
        </span>
      </div>

      {history.length === 0 ? (
        <div style={styles.empty} data-testid="notification-history-empty">
          <span style={styles.emptyIcon} aria-hidden="true">◎</span>
          <span style={styles.emptyText}>
            Nenhum evento registrado nesta sessão.
          </span>
        </div>
      ) : (
        <div style={styles.list} data-testid="notification-history-list">
          {reversed.map((item) => {
            const meta = TYPE_META[item.type] || DEFAULT_META;
            return (
              <div
                key={item.id}
                style={{
                  ...styles.row,
                  ...(item.read ? styles.rowRead : styles.rowUnread),
                }}
                data-testid={`history-item-${item.type}`}
              >
                <span style={styles.rowIcon} aria-hidden="true">{meta.icon}</span>

                <div style={styles.rowBody}>
                  <div style={styles.rowTop}>
                    <span style={{ ...styles.rowLabel, color: meta.color }}>
                      {meta.label}
                    </span>
                    <span style={styles.rowTime}>{formatHistTs(item.ts)}</span>
                    {!item.read && (
                      <span
                        style={styles.unreadDot}
                        data-testid="history-unread-dot"
                        aria-label="não lido"
                      />
                    )}
                  </div>
                  <span style={styles.rowMsg}>{item.message}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "14px 18px 12px",
    borderBottom: "1px solid var(--border-light)",
    background: "rgba(139,92,246,0.04)",
  },
  headerIcon: {
    fontSize: "15px",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "12px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.4px",
    textTransform: "uppercase",
    flex: 1,
    margin: 0,
  },
  countBadge: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    background: "var(--bg-surface-2, rgba(100,116,139,0.10))",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    padding: "1px 7px",
    minWidth: "20px",
    textAlign: "center",
  },
  empty: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "16px 18px",
  },
  emptyIcon: {
    fontSize: "14px",
    color: "var(--text-muted)",
    flexShrink: 0,
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
  },
  list: {
    display: "flex",
    flexDirection: "column",
  },
  row: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "11px 18px",
    borderBottom: "1px solid var(--border-light)",
    transition: "background 0.1s",
  },
  rowRead: {
    background: "transparent",
    opacity: 0.75,
  },
  rowUnread: {
    background: "rgba(139,92,246,0.04)",
  },
  rowIcon: {
    fontSize: "14px",
    flexShrink: 0,
    marginTop: "1px",
  },
  rowBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "3px",
  },
  rowTop: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  rowLabel: {
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  rowTime: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginLeft: "auto",
    flexShrink: 0,
  },
  unreadDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#8B5CF6",
    flexShrink: 0,
  },
  rowMsg: {
    fontSize: "12px",
    color: "var(--text-secondary, #94A3B8)",
    lineHeight: 1.4,
    overflowWrap: "break-word",
  },
};
