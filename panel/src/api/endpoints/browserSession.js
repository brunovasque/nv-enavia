// ============================================================================
// ENAVIA Panel — browserSession endpoint (P25-PR3)
//
// fetchBrowserSession() — Fetches the real browser arm session state from the
// worker at GET /browser-arm/state.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js.
//
// Real mode: queries /browser-arm/state on the worker.
// Mock mode: returns idle state with a short delay.
//
// This is the ONLY source of truth for browser session state in the panel.
// The panel MUST NOT fabricate session data.
// ============================================================================

import { getApiConfig }                from "../config.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { apiClient }                   from "../client.js";

const MOCK_DELAY = () => 300 + Math.random() * 200;

// ── Canonical session statuses for the panel ──────────────────────────────
// Maps from the browser arm runtime statuses to the panel display statuses.
// The runtime uses: idle | active | error | disabled
// The panel expands these into more granular UI states.
export const BROWSER_SESSION_STATUS = {
  SEM_SESSAO:  "sem_sessao",
  NAVEGANDO:   "navegando",
  AGINDO:      "agindo",
  AGUARDANDO:  "aguardando",
  BLOQUEADO:   "bloqueado",
  CONCLUIDO:   "concluido",
  ERRO:        "erro",
};

// ── Map runtime arm status → panel session status ─────────────────────────
function mapArmStatusToSessionStatus(armState) {
  if (!armState || !armState.ok) return BROWSER_SESSION_STATUS.ERRO;

  const status = armState.status;
  const exec = armState.last_execution;

  if (status === "disabled") return BROWSER_SESSION_STATUS.BLOQUEADO;
  if (status === "error") return BROWSER_SESSION_STATUS.ERRO;

  if (status === "active" && exec) {
    const execStatus = exec.execution_status;
    if (execStatus === "navigating") return BROWSER_SESSION_STATUS.NAVEGANDO;
    if (execStatus === "acting")     return BROWSER_SESSION_STATUS.AGINDO;
    if (execStatus === "waiting")    return BROWSER_SESSION_STATUS.AGUARDANDO;
    if (execStatus === "blocked")    return BROWSER_SESSION_STATUS.BLOQUEADO;
    if (execStatus === "completed")  return BROWSER_SESSION_STATUS.CONCLUIDO;
    if (execStatus === "error")      return BROWSER_SESSION_STATUS.ERRO;
    // Default active → navegando (browser is doing something)
    return BROWSER_SESSION_STATUS.NAVEGANDO;
  }

  // idle or unknown
  return BROWSER_SESSION_STATUS.SEM_SESSAO;
}

// ── Normalize the raw arm state into a panel-consumable session object ────
function normalizeSessionFromArm(armState) {
  if (!armState || !armState.ok) {
    return {
      active: false,
      sessionStatus: BROWSER_SESSION_STATUS.SEM_SESSAO,
      sessionId: null,
      operationalDomain: armState?.external_base?.host || "run.nv-imoveis.com",
      currentAction: null,
      currentTarget: null,
      currentUrl: null,
      evidence: null,
      error: null,
      lastActionTs: null,
      raw: armState,
    };
  }

  const sessionStatus = mapArmStatusToSessionStatus(armState);
  const isActive = sessionStatus !== BROWSER_SESSION_STATUS.SEM_SESSAO;
  const exec = armState.last_execution || {};
  const extBase = armState.external_base || {};

  return {
    active: isActive,
    sessionStatus,
    sessionId: exec.request_id || null,
    operationalDomain: extBase.host || "run.nv-imoveis.com",
    currentAction: armState.last_action || null,
    currentTarget: exec.target_url || extBase.base_url || null,
    currentUrl: exec.target_url || null,
    evidence: exec.result_summary || null,
    error: sessionStatus === BROWSER_SESSION_STATUS.ERRO || sessionStatus === BROWSER_SESSION_STATUS.BLOQUEADO
      ? {
          code: exec.error_type || "BROWSER_ERROR",
          message: exec.error_message || "Erro desconhecido no browser executor.",
          recoverable: sessionStatus === BROWSER_SESSION_STATUS.BLOQUEADO,
        }
      : null,
    lastActionTs: armState.last_action_ts || null,
    raw: armState,
  };
}

/**
 * Fetch the real browser session state from the worker.
 *
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function fetchBrowserSession() {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    // Mock mode: return idle/no-session state
    await new Promise((r) => setTimeout(r, MOCK_DELAY()));
    const idleState = {
      ok: true,
      arm_id: "p25_browser_arm",
      status: "idle",
      external_base: {
        host: "run.nv-imoveis.com",
        pattern: "run.nv-imoveis.com/*",
        protocol: "https",
        base_url: "https://run.nv-imoveis.com",
      },
      last_action: null,
      last_action_ts: null,
    };
    return {
      ok: true,
      data: normalizeSessionFromArm(idleState),
      meta: { durationMs: Date.now() - t0, source: "mock" },
    };
  }

  try {
    const res = await apiClient.request("/browser-arm/state", { method: "GET" });

    if (!res.ok || !res.data) {
      return {
        ok: true,
        data: normalizeSessionFromArm(null),
        meta: { durationMs: Date.now() - t0, source: "real", reachable: false },
      };
    }

    return {
      ok: true,
      data: normalizeSessionFromArm(res.data),
      meta: { durationMs: Date.now() - t0, source: "real", reachable: true },
    };
  } catch (err) {
    return normalizeError(err, "browser-session");
  }
}
