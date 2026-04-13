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
  const enaviaPrimaryUrl = import.meta.env.VITE_NV_ENAVIA_URL ?? "";
  const legacyUrl = import.meta.env.VITE_API_BASE_URL ?? "";
  const base = enaviaPrimaryUrl !== "" ? enaviaPrimaryUrl : legacyUrl;

  // If no base URL is configured, force mock regardless of VITE_API_MODE.
  // When VITE_NV_ENAVIA_URL is set, default to "real" so the Vercel env wires up automatically.
  // Legacy VITE_API_BASE_URL keeps the old default of "mock" unless VITE_API_MODE is explicit.
  let mode;
  if (base === "") {
    mode = "mock";
  } else if (enaviaPrimaryUrl !== "") {
    mode = import.meta.env.VITE_API_MODE ?? "real";
  } else {
    mode = import.meta.env.VITE_API_MODE ?? "mock";
  }

  return {
    baseUrl: base,
    mode,
    timeoutMs: Number(import.meta.env.VITE_API_TIMEOUT_MS ?? 5000),
  };
}
