// ============================================================================
// ENAVIA Panel — useBrowserNotifications (P25-PR5)
//
// Hook that detects new real events from the Browser Arm session state
// and triggers notifications (store update + sound).
//
// Input:  session object from useBrowserSession()
// Output: (side-effects only) — writes to notificationStore, plays sound
//
// Events tracked:
//   1. block     — session.block.blocked === true && !block.suggestionRequired
//   2. permission — session.block.blocked === true && block.suggestionRequired
//   3. suggestion — session.suggestions.length > 0 (new suggestions array)
//   4. error     — session.error exists and !error.recoverable
//
// Deduplication strategy:
//   - A useRef holds the last-notified fingerprint per event type.
//   - Fingerprint = deterministic string derived from the event's content.
//   - Notification fires ONLY when the new fingerprint differs from stored.
//   - When an event clears (block removed, suggestions empty), the ref resets
//     so the same event re-notifies if it comes back later.
//
// Rules:
//   - No notification without a real, changed event.
//   - No notification on the initial render (requires one poll cycle to establish baseline).
//   - No repeated sound or toast for the same unchanging state.
// ============================================================================

import { useEffect, useRef } from "react";
import { addNotificationEvent } from "./notificationStore";
import { playNotificationSound } from "./useNotificationSound";

// ── Fingerprint builders ──────────────────────────────────────────────────────

function _blockFingerprint(block) {
  if (!block?.blocked) return null;
  return `${block.level ?? ""}:${block.reason ?? ""}`;
}

function _suggestionsFingerprint(suggestions) {
  if (!Array.isArray(suggestions) || suggestions.length === 0) return null;
  return suggestions
    .map((s) => `${s.type ?? ""}|${s.discovery ?? ""}`)
    .join(";");
}

function _errorFingerprint(error) {
  if (!error || error.recoverable) return null;
  return `${error.code ?? ""}:${error.message ?? ""}`;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

/**
 * Detects new real events from the Browser Arm session and notifies.
 *
 * Must be called inside a React component (uses useRef + useEffect).
 * Call site: BrowserExecutorPanel (the panel that owns useBrowserSession).
 *
 * @param {object|null} session — session object from useBrowserSession()
 */
export function useBrowserNotifications(session) {
  // Tracks fingerprints of last-notified events per type.
  // null = "not yet seen" or "event cleared" — will notify on next real event.
  const lastSeenRef = useRef({
    blockKey:       null,
    suggestionsKey: null,
    errorKey:       null,
  });

  // Track whether this is the first render cycle (skip first to establish baseline).
  const isFirstRef = useRef(true);

  useEffect(() => {
    // Skip very first effect run — establishes baseline without firing notifications
    // on mount (avoids notifying about state that was already present before load).
    if (isFirstRef.current) {
      isFirstRef.current = false;

      // Set baseline fingerprints from initial session (no notification fired)
      if (session) {
        lastSeenRef.current.blockKey       = _blockFingerprint(session.block);
        lastSeenRef.current.suggestionsKey = _suggestionsFingerprint(session.suggestions);
        lastSeenRef.current.errorKey       = _errorFingerprint(session.error);
      }
      return;
    }

    if (!session) return;

    // ── 1. Block / Permission ─────────────────────────────────────────────────
    const blockFp = _blockFingerprint(session.block);
    if (blockFp !== lastSeenRef.current.blockKey) {
      lastSeenRef.current.blockKey = blockFp;

      if (blockFp !== null) {
        const block = session.block;
        const needsPermission = block.suggestionRequired === true;
        const type    = needsPermission ? "permission" : "block";
        const message = block.reason
          || (needsPermission
            ? "Ação requer permissão do usuário."
            : "Ação bloqueada pelo Browser Arm.");
        addNotificationEvent(type, message);
        playNotificationSound(type);
      }
    }

    // ── 2. Suggestions ────────────────────────────────────────────────────────
    const sugFp = _suggestionsFingerprint(session.suggestions);
    if (sugFp !== lastSeenRef.current.suggestionsKey) {
      lastSeenRef.current.suggestionsKey = sugFp;

      if (sugFp !== null) {
        const count = session.suggestions.length;
        const label = count === 1
          ? "1 sugestão nova da Enavia"
          : `${count} sugestões novas da Enavia`;
        addNotificationEvent("suggestion", label);
        playNotificationSound("suggestion");
      }
    }

    // ── 3. Error (non-recoverable) ────────────────────────────────────────────
    const errorFp = _errorFingerprint(session.error);
    if (errorFp !== lastSeenRef.current.errorKey) {
      lastSeenRef.current.errorKey = errorFp;

      if (errorFp !== null) {
        const message = session.error.message || "Erro no Browser Arm.";
        addNotificationEvent("error", message);
        playNotificationSound("error");
      }
    }
  }, [session]);
}
