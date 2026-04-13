// ============================================================================
// ENAVIA Panel — API Config
// Single source of truth for mode/URL resolution.
// Decision mock vs real lives ONLY here → transport.js reads this.
//
// Priority for base URL:
//   1. VITE_NV_ENAVIA_URL  — Vercel public env (canonical for Enavia backend)
//   2. VITE_API_BASE_URL   — legacy / local override
// If neither is set, falls back to mock mode regardless of VITE_API_MODE.
// ============================================================================

export function getApiConfig() {
  const base =
    import.meta.env.VITE_NV_ENAVIA_URL ??
    import.meta.env.VITE_API_BASE_URL ??
    "";
  // If no base URL is configured, force mock regardless of VITE_API_MODE.
  // When a URL is present, default to "real" so the Vercel env wires up automatically.
  const mode =
    base === "" ? "mock" : (import.meta.env.VITE_API_MODE ?? "real");
  return {
    baseUrl: base,
    mode,
    timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 5000),
  };
}
