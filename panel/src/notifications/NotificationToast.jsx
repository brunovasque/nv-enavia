// ============================================================================
// ENAVIA Panel — NotificationToast (P25-PR5)
//
// Renders the active notification toast stack in a fixed bottom-right position.
// Each toast auto-dismisses after TOAST_DURATION_MS.
//
// Source: notificationStore — real events only. No mock. No fake toasts.
//
// Rules:
//   - Toast only rendered when toasts array is non-empty.
//   - Auto-dismiss after 4.5s (user can also dismiss manually).
//   - markAllRead() called when toasts are visible (user is looking at the panel).
//   - No modal. No intrusive overlay. Discrete bottom-right stack.
//   - Uses aria-live="polite" for accessibility.
// ============================================================================

import { useEffect } from "react";
import { useNotificationStore, dismissToast, markAllRead } from "./notificationStore";

const TOAST_DURATION_MS = 4500;

// ── Toast type metadata ───────────────────────────────────────────────────────

const TOAST_CONFIG = {
  block: {
    icon:   "🚫",
    label:  "Bloqueio",
    color:  "#EF4444",
    bg:     "rgba(239,68,68,0.13)",
    border: "rgba(239,68,68,0.32)",
  },
  permission: {
    icon:   "⚠",
    label:  "Permissão",
    color:  "#F59E0B",
    bg:     "rgba(245,158,11,0.11)",
    border: "rgba(245,158,11,0.32)",
  },
  suggestion: {
    icon:   "💡",
    label:  "Sugestão",
    color:  "#8B5CF6",
    bg:     "rgba(139,92,246,0.11)",
    border: "rgba(139,92,246,0.28)",
  },
  error: {
    icon:   "✕",
    label:  "Erro",
    color:  "#EF4444",
    bg:     "rgba(239,68,68,0.13)",
    border: "rgba(239,68,68,0.32)",
  },
};

const DEFAULT_TOAST_CONFIG = TOAST_CONFIG.error;

// ── Single toast item ─────────────────────────────────────────────────────────

function ToastItem({ toast }) {
  const cfg = TOAST_CONFIG[toast.type] || DEFAULT_TOAST_CONFIG;

  useEffect(() => {
    const timer = setTimeout(() => dismissToast(toast.id), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast.id]);

  return (
    <div
      data-testid={`notification-toast-${toast.type}`}
      role="status"
      style={{
        ...styles.toast,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <span style={styles.toastIcon} aria-hidden="true">{cfg.icon}</span>

      <div style={styles.toastBody}>
        <span style={{ ...styles.toastLabel, color: cfg.color }}>{cfg.label}</span>
        <span style={styles.toastMsg}>{toast.message}</span>
      </div>

      <button
        style={styles.toastClose}
        onClick={() => dismissToast(toast.id)}
        title="Fechar notificação"
        aria-label="Fechar notificação"
      >
        ×
      </button>
    </div>
  );
}

// ── Toast container ───────────────────────────────────────────────────────────

export default function NotificationToast() {
  const { toasts } = useNotificationStore();

  // Mark all read when the user is actively viewing the panel (toasts visible)
  useEffect(() => {
    if (toasts.length > 0) markAllRead();
  }, [toasts]);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="notification-toast-container"
      aria-live="polite"
      aria-atomic="false"
      style={styles.container}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    position: "fixed",
    bottom: "24px",
    right: "24px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    zIndex: 9000,
    maxWidth: "360px",
    pointerEvents: "none",
  },
  toast: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 14px",
    borderRadius: "var(--radius-lg, 12px)",
    backdropFilter: "blur(8px)",
    pointerEvents: "all",
    minWidth: "240px",
  },
  toastIcon: {
    fontSize: "16px",
    flexShrink: 0,
    marginTop: "1px",
  },
  toastBody: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    minWidth: 0,
  },
  toastLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
  },
  toastMsg: {
    fontSize: "12px",
    color: "var(--text-secondary, #94A3B8)",
    lineHeight: 1.4,
    overflowWrap: "break-word",
  },
  toastClose: {
    background: "none",
    border: "none",
    color: "var(--text-muted, #64748B)",
    cursor: "pointer",
    fontSize: "18px",
    padding: "0 2px",
    lineHeight: 1,
    flexShrink: 0,
    alignSelf: "flex-start",
  },
};
