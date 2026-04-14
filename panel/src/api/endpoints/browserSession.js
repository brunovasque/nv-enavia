// ============================================================================
// ENAVIA Panel — browserSession endpoint (P25-PR3 / P25-PR6)
//
// fetchBrowserSession()        — Fetches the real browser arm session state from
//                                the worker at GET /browser-arm/state.
// grantBrowserArmPermission()  — P25-PR6: Sends user permission grant to the worker
//                                via POST /browser-arm/action with user_permission:true.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js.
//
// REAL SOURCE ONLY — These endpoints do NOT fall back to mock/fake data.
// If the real source is unavailable, they return honest error envelopes.
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
// Grantable block levels (P25-PR6):
//   "blocked_out_of_scope"         → remedy: scope_approved: true
//   "blocked_conditional_not_met"  → remedy: user_permission: true
//   Other levels are NOT grantable via user permission — no placebo button shown.
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

// ── Grantable block levels — user permission can fix these ───────────────────
// "blocked_not_browser_arm"    → NOT grantable (architectural mismatch)
// "blocked_drift_detected"     → NOT grantable (drift must be resolved first)
// "blocked_regression_detected"→ NOT grantable (regression must be resolved first)
// "blocked_p23_noncompliant"   → NOT grantable (P23 gates must pass independently)
export const GRANTABLE_BLOCK_LEVELS = [
  "blocked_out_of_scope",        // out-of-scope action — user grants scope + permission
  "blocked_conditional_not_met", // conditional action (e.g. expand_scope) — user grants permission
];

/**
 * P25-PR6 — Grant user permission for a blocked Browser Arm action.
 *
 * Sends POST /browser-arm/action with:
 *   - scope_approved: true   — user approves the scope for this action
 *   - user_permission: true  — user explicitly grants permission
 *   - gates_context: all required P23 gates set to true (user is the authorizer)
 *
 * Both scope_approved and user_permission are always sent together regardless of
 * the specific block level — this is the safest remedy payload, covering both
 * "blocked_out_of_scope" (needs scope_approved) and "blocked_conditional_not_met"
 * (needs user_permission). The backend enforcement re-validates both.
 *
 * ONLY valid for grantable block levels (GRANTABLE_BLOCK_LEVELS).
 * Returns an honest GRANT_NOT_APPLICABLE error if blockLevel is provided and
 * is not in GRANTABLE_BLOCK_LEVELS — no placebo button for irresolvable blocks.
 *
 * If blockLevel is null/undefined (unknown), the call proceeds and backend
 * enforcement decides. This preserves forward compatibility.
 *
 * Does NOT fall back to mock. If the real source is not configured, returns
 * an honest "unconfigured" error — no fake grant.
 *
 * @param {string}      action     — the blocked action to retry with permission
 * @param {string|null} [blockLevel] — the block level from session.block.level;
 *                                     if provided, validated against GRANTABLE_BLOCK_LEVELS
 * @returns {Promise<import("../contracts.js").ResponseEnvelope>}
 */
export async function grantBrowserArmPermission(action, blockLevel) {
  const t0 = Date.now();
  const { mode, baseUrl } = getApiConfig();

  if (mode !== "real" || !baseUrl) {
    return {
      ok: false,
      error: {
        code: "BROWSER_SESSION_UNCONFIGURED",
        message: "Fonte real não configurada — VITE_NV_ENAVIA_URL não definida.",
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  if (!action || typeof action !== "string") {
    return {
      ok: false,
      error: { code: "MISSING_ACTION", message: "'action' é obrigatório." },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  // If blockLevel is provided and known, validate it is grantable.
  // If blockLevel is null/undefined, we proceed — backend enforcement decides.
  if (blockLevel != null && !GRANTABLE_BLOCK_LEVELS.includes(blockLevel)) {
    return {
      ok: false,
      error: {
        code: "GRANT_NOT_APPLICABLE",
        message: `Nível de bloqueio '${blockLevel}' não pode ser resolvido por permissão do usuário.`,
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  // Canonical P23 gates context — user is the explicit authorizer.
  // These are all true because the user has reviewed the block state in the panel
  // and is explicitly granting permission for this specific action.
  const gates_context = {
    scope_defined: true,
    environment_defined: true,
    risk_assessed: true,
    authorization_present_when_required: true,
    observability_preserved: true,
    evidence_available_when_required: true,
  };

  try {
    const res = await apiClient.request("/browser-arm/action", {
      method: "POST",
      body: {
        action,
        scope_approved: true,
        user_permission: true,
        gates_context,
        justification: "Permissão concedida explicitamente pelo usuário via painel.",
      },
    });

    if (!res.ok) {
      const errBody = res.data || {};
      return {
        ok: false,
        error: {
          code: errBody.error || "GRANT_FAILED",
          message: errBody.message || "Falha ao conceder permissão ao Browser Arm.",
        },
        meta: { durationMs: Date.now() - t0 },
      };
    }

    return {
      ok: true,
      data: res.data,
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "browser-permission-grant");
  }
}
