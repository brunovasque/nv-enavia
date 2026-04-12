// ============================================================================
// ENAVIA Panel — API Config
// Single source of truth for mode/URL resolution.
// Decision mock vs real lives ONLY here → transport.js reads this.
// VITE_API_MODE=real in this phase is an architectural placeholder only —
// not a homologated production integration.
// ============================================================================

export function getApiConfig() {
  const base = import.meta.env.VITE_API_BASE_URL ?? "";
  // If no base URL is configured, force mock regardless of VITE_API_MODE.
  const mode =
    base === "" ? "mock" : (import.meta.env.VITE_API_MODE ?? "mock");
  return {
    baseUrl: base,
    mode,
    timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 5000),
  };
}
