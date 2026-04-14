// ============================================================================
// ENAVIA Panel — useBrowserSession hook (P25-PR3)
//
// Custom React hook that provides the real browser session state.
// Polls the worker at /browser-arm/state via fetchBrowserSession().
//
// Returns:
//   { session, loading, error, source, refresh, lastUpdated }
//
//   source: "real" | "unconfigured" | "unreachable" | null
//     - "real":         data came from /browser-arm/state successfully
//     - "unconfigured": VITE_NV_ENAVIA_URL not set — no real source available
//     - "unreachable":  real source configured but not responding
//     - null:           initial load in progress
//
// This hook is the ONLY way the panel should access browser session state.
// No mock-based state switching. No demo toggles.
//
// Polling: every POLL_INTERVAL_MS (5s) when the component is mounted.
// ============================================================================

import { useState, useEffect, useCallback, useRef } from "react";
import { fetchBrowserSession, BROWSER_SESSION_STATUS } from "../api";

const POLL_INTERVAL_MS = 5000;

export function useBrowserSession() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [source, setSource] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchBrowserSession();
      if (!mountedRef.current) return;

      // Always surface the session data (even partial from unavailable source)
      if (result.data) setSession(result.data);
      setSource(result.meta?.source || null);
      setLastUpdated(new Date().toISOString());

      if (result.ok) {
        setError(null);
      } else {
        setError(result.error || "Falha ao consultar sessão do browser.");
      }
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message || "Erro de conectividade.");
      setSource("unreachable");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    refresh();

    const timer = setInterval(refresh, POLL_INTERVAL_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(timer);
    };
  }, [refresh]);

  return { session, loading, error, source, refresh, lastUpdated };
}

export { BROWSER_SESSION_STATUS };
