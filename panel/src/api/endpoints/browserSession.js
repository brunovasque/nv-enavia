// ============================================================================
// ENAVIA Panel — browserSession endpoint (P25-PR3)
//
// fetchBrowserSession() — Fetches the real browser arm session state from the
// worker at GET /browser-arm/state.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js.
//
// REAL SOURCE ONLY — This endpoint does NOT fall back to mock/fake idle data.
// If the real source is unavailable, it returns an honest error envelope.
// The panel may show "sem sessão" or "fonte indisponível" but never fake idle.
//
// Real backend shape for last_execution (P25-PR2 + PR4):
//   { ok, execution_status, request_id, error_type, error_message, target_url, result_summary }
//
// Block state (P25-PR4):
//   armState.block: { blocked, level, reason, suggestion_required }
//
// Suggestions (P25-PR4):
//   armState.suggestions: Array<{ type, discovery, benefit, missing_requirement, expected_impact, permission_needed }>
//
// Domínio operacional: run.nv-imoveis.com/*
// ============================================================================

import { getApiConfig }                from "../config.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { apiClient }                   from "../client.js";

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

// ── Honest unavailability indicator ──────────────────────────────────────
// Used when the real source is not configured or not reachable.
export const BROWSER_SESSION_SOURCE = {
  REAL:           "real",
  UNCONFIGURED:   "unconfigured",
  UNREACHABLE:    "unreachable",
};

// ── Map runtime arm status → panel session status ─────────────────────────
function mapArmStatusToSessionStatus(armState) {
  if (!armState?.ok) return BROWSER_SESSION_STATUS.ERRO;

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
    return BROWSER_SESSION_STATUS.NAVEGANDO;
  }

  return BROWSER_SESSION_STATUS.SEM_SESSAO;
}

// ── Normalize the raw arm state into a panel-consumable session object ────
//
// Fields mapped here come from the real backend shape:
//   armState:        { ok, arm_id, status, external_base, last_action, last_action_ts, last_execution, block, suggestions }
//   last_execution:  { ok, execution_status, request_id, error_type, error_message, target_url, result_summary }
//   block:           { blocked, level, reason, suggestion_required } (when action was blocked)
//   suggestions:     Array<{ type, discovery, benefit, ... }> (canonical suggestion shape)
//
function normalizeSessionFromArm(armState) {
  if (!armState?.ok) {
    return {
      active: false,
      sessionStatus: BROWSER_SESSION_STATUS.SEM_SESSAO,
      sessionId: null,
      operationalDomain: armState?.external_base?.host || "run.nv-imoveis.com",
      currentAction: null,
      executionStatus: null,
      targetUrl: null,
      resultSummary: null,
      error: null,
      block: null,
      suggestions: [],
      lastActionTs: null,
      raw: armState,
    };
  }

  const sessionStatus = mapArmStatusToSessionStatus(armState);
  const isActive = sessionStatus !== BROWSER_SESSION_STATUS.SEM_SESSAO;
  const exec = armState.last_execution || {};
  const extBase = armState.external_base || {};

  // Block/permission state — only from real enforcement data
  const blockData = armState.block && armState.block.blocked
    ? {
        blocked: true,
        level: armState.block.level || null,
        reason: armState.block.reason || null,
        suggestionRequired: armState.block.suggestion_required || false,
      }
    : null;

  // Suggestions — real array from runtime, never fabricated
  const suggestions = Array.isArray(armState.suggestions)
    ? armState.suggestions
    : [];

  return {
    active: isActive,
    sessionStatus,
    sessionId: exec.request_id || null,
    operationalDomain: extBase.host || "run.nv-imoveis.com",
    currentAction: armState.last_action || null,
    executionStatus: exec.execution_status || null,
    targetUrl: exec.target_url || null,
    resultSummary: exec.result_summary || null,
    error: sessionStatus === BROWSER_SESSION_STATUS.ERRO || sessionStatus === BROWSER_SESSION_STATUS.BLOQUEADO
      ? {
          code: exec.error_type || "BROWSER_ERROR",
          message: exec.error_message || "Erro desconhecido no browser executor.",
          recoverable: sessionStatus === BROWSER_SESSION_STATUS.BLOQUEADO,
        }
      : null,
    block: blockData,
    suggestions,
    lastActionTs: armState.last_action_ts || null,
    raw: armState,
  };
}

/**
 * Fetch the real browser session state from the worker.
 *
 * DOES NOT FALL BACK TO MOCK.
 * If the real source is not configured (no base URL), returns an honest
 * "unconfigured" error so the panel can show this honestly.
 *
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function fetchBrowserSession() {
  const t0 = Date.now();
  const { mode, baseUrl } = getApiConfig();

  // If real mode is not configured, return honest "unconfigured" state.
  // This is NOT mock mode — it is an explicit unavailability indicator.
  // The panel shows "fonte não configurada", not a fake idle session.
  if (mode !== "real" || !baseUrl) {
    return {
      ok: false,
      data: normalizeSessionFromArm(null),
      error: {
        code: "BROWSER_SESSION_UNCONFIGURED",
        message: "Fonte real não configurada — VITE_NV_ENAVIA_URL não definida.",
      },
      meta: { durationMs: Date.now() - t0, source: BROWSER_SESSION_SOURCE.UNCONFIGURED },
    };
  }

  try {
    const res = await apiClient.request("/browser-arm/state", { method: "GET" });

    if (!res.ok || !res.data) {
      return {
        ok: false,
        data: normalizeSessionFromArm(null),
        error: { code: "BROWSER_SESSION_UNREACHABLE", message: "Browser arm não alcançável." },
        meta: { durationMs: Date.now() - t0, source: BROWSER_SESSION_SOURCE.UNREACHABLE },
      };
    }

    return {
      ok: true,
      data: normalizeSessionFromArm(res.data),
      meta: { durationMs: Date.now() - t0, source: BROWSER_SESSION_SOURCE.REAL },
    };
  } catch (err) {
    return normalizeError(err, "browser-session");
  }
}
