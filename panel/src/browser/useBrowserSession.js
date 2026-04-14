// ============================================================================
// ENAVIA Panel — useBrowserSession hook (P25-PR3)
//
// Custom React hook that provides the real browser session state.
// Polls the worker at /browser-arm/state via fetchBrowserSession().
//
// Returns:
//   { session, loading, error, refresh, lastUpdated }
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
  const [lastUpdated, setLastUpdated] = useState(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const result = await fetchBrowserSession();
      if (!mountedRef.current) return;

      if (result.ok) {
        setSession(result.data);
        setError(null);
      } else {
        // Even when unreachable, show the normalized idle session data
        if (result.data) setSession(result.data);
        setError(result.error || result.data?.error || "Falha ao consultar sessão do browser.");
      }
      setLastUpdated(new Date().toISOString());
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err.message || "Erro de conectividade.");
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

  return { session, loading, error, refresh, lastUpdated };
}

export { BROWSER_SESSION_STATUS };
