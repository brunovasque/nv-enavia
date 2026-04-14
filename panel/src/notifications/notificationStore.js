// ============================================================================
// ENAVIA Panel — notificationStore (P25-PR5 / P25-PR7)
//
// Module-level singleton store for Browser Arm real notifications.
// Follows the same useSyncExternalStore pattern as plannerStore.js.
//
// State:
//   unreadCount — number of unread events since last markAllRead()
//   toasts      — active toast list for rendering (ephemeral; removed on dismiss)
//   history     — persistent in-session event log (never removed; resets on reload)
//
// Public API:
//   addNotificationEvent(type, message) → adds a toast + history item + increments unreadCount
//   dismissToast(id)                    → removes a toast (no effect on unreadCount or history)
//   markAllRead()                       → resets unreadCount to 0; marks all history items read
//   useNotificationStore()              → hook: returns { unreadCount, toasts, history }
//
// Event types: "block" | "permission" | "suggestion" | "error"
//
// Deduplication is handled by useBrowserNotifications.js (caller),
// not here. This store is a dumb sink: it appends whatever it receives.
//
// No persistence — notifications are transient. They reset on reload.
// ============================================================================

import { useSyncExternalStore } from "react";

// ── State ────────────────────────────────────────────────────────────────────

let _unreadCount = 0;
let _toasts = [];   // Array<{ id: number, type: string, message: string, ts: number }>
let _history = [];  // Array<{ id: number, type: string, message: string, ts: number, read: boolean }>
let _nextId = 1;

// ── Snapshot cache (stable reference when unchanged) ─────────────────────────

let _snapshot = { unreadCount: 0, toasts: [], history: [] };

function _rebuild() {
  _snapshot = { unreadCount: _unreadCount, toasts: _toasts.slice(), history: _history.slice() };
}

function _getSnapshot() {
  return _snapshot;
}

// ── Listeners ────────────────────────────────────────────────────────────────

const _listeners = new Set();

function _notify() {
  _listeners.forEach((l) => l());
}

function _subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Add a new notification event.
 * Appends a toast and increments the unread counter.
 *
 * @param {"block"|"permission"|"suggestion"|"error"} type
 * @param {string} message — human-readable description of the event
 */
export function addNotificationEvent(type, message) {
  const id = _nextId++;
  const ts = Date.now();
  const toast = { id, type, message, ts };
  const histItem = { id, type, message, ts, read: false };
  _unreadCount = _unreadCount + 1;
  _toasts = [..._toasts, toast];
  _history = [..._history, histItem];
  _rebuild();
  _notify();
}

/**
 * Dismiss a toast by id. Does not affect unreadCount.
 * @param {number} id
 */
export function dismissToast(id) {
  _toasts = _toasts.filter((t) => t.id !== id);
  _rebuild();
  _notify();
}

/**
 * Reset the unread counter to 0 (e.g., when user sees the notification panel).
 * Also marks all history items as read.
 */
export function markAllRead() {
  if (_unreadCount === 0) return;
  _unreadCount = 0;
  _history = _history.map((item) => (item.read ? item : { ...item, read: true }));
  _rebuild();
  _notify();
}

/**
 * Clear all active toasts. Does not affect unreadCount.
 * Useful for programmatic reset (e.g., on page navigation).
 */
export function clearAllToasts() {
  if (_toasts.length === 0) return;
  _toasts = [];
  _rebuild();
  _notify();
}

/**
 * React hook — subscribe to the notification store.
 * Returns { unreadCount, toasts, history }.
 *
 * Consumers:
 *   - Sidebar.jsx              → reads unreadCount for badge
 *   - NotificationToast.jsx    → reads toasts for rendering
 *   - NotificationHistory.jsx  → reads history for in-session event list (P25-PR7)
 */
export function useNotificationStore() {
  return useSyncExternalStore(_subscribe, _getSnapshot, _getSnapshot);
}
