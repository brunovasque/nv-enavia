// ============================================================================
// ENAVIA Panel — useSessionState
//
// Exposes a stable session_id for React components.
// The ID is generated once, persisted in localStorage (enavia_session_id),
// and shared across Chat and Plan tabs — ensuring both views always operate
// on the same session.
//
// Consumers:
//   import { useSessionId } from "../chat/useSessionState";
//   const sessionId = useSessionId(); // stable string, never changes within a tab
// ============================================================================

import { useMemo } from "react";
import { getSessionId } from "../api";

/**
 * Returns the current session_id (stable across renders).
 * Initializes the ID in localStorage on first call if not already set.
 *
 * @returns {string}
 */
export function useSessionId() {
  // getSessionId() is a pure read-or-create operation against localStorage;
  // wrapping in useMemo prevents redundant localStorage reads on every render
  // while keeping the return value stable (same string reference each render).
  return useMemo(() => getSessionId(), []);
}
