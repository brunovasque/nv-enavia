// ============================================================================
// ENAVIA Panel — planner endpoint (internal implementation, public via index.js)
//
// runPlanner()       → POST /planner/run  — gera plano real via pipeline PM4→PM9
// fetchLatestPlan()  → GET  /planner/latest — lê último plano salvo para a sessão
//
// Ambas as funções são no-op em mock mode (retornam erro/vazio imediatamente).
// ============================================================================

import { apiClient }                   from "../client.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { getApiConfig }                from "../config.js";
import { getSessionId }                from "../session.js";

// ── Executable step spec ──────────────────────────────────────────────────────

// Known safe read-only endpoints for each target_type.
// Executor will probe these without side-effects.
const _TARGET_TYPE_ENDPOINTS = {
  cloudflare_worker: ["/health", "/metrics", "/status", "/config"],
};

/**
 * Builds an `execution_spec` object injected into every `/planner/run` request.
 * This signals to the LLM pipeline the desired step schema and safety constraints,
 * so the planner emits executable steps rather than descriptive ones.
 *
 * @param {object|null} target — context.target from the caller
 * @returns {object}
 */
function buildExecutionSpec(target) {
  const mode = target?.mode ?? "read_only";
  const targetType = target?.target_type ?? null;
  const knownEndpoints = targetType ? (_TARGET_TYPE_ENDPOINTS[targetType] ?? []) : [];

  return {
    // Desired shape for every step object in canonicalPlan.steps.
    // `input` is the canonical field name (matches mapper + mock data).
    // `expected_output` is accepted as alias for `expected` (both handled by mapper).
    step_schema: {
      id:              "string — unique step identifier, e.g. step_1",
      action:          "string — one of: http_get | http_post | discover_endpoints | validate_config | read_logs",
      input:           "string — relative path or resource identifier, e.g. /health",
      expected:        "object — { status?: number, contains?: string[], matches?: string }",
      expected_output: "object — alias for expected; either field is accepted",
      safe:            "boolean — true when action has no side-effects (required for read_only mode)",
    },
    constraints: {
      mode,
      safe_only:                    mode === "read_only",
      destructive_actions_blocked:  mode === "read_only",
      allowed_actions:              ["http_get", "discover_endpoints", "validate_config", "read_logs"],
      blocked_actions:              ["http_post", "http_patch", "http_delete", "deploy", "write", "delete"],
    },
    // Provide known endpoints so the planner can skip discovery when possible
    ...(knownEndpoints.length > 0 && {
      known_endpoints:             knownEndpoints,
      discover_first_if_unknown:   true,
    }),
  };
}

/**
 * Gera um plano real chamando POST /planner/run.
 * Apenas disponível em modo real.
 *
 * @param {string} message — instrução do usuário
 * @param {object} [context] — contexto operacional { target, attachments_summary }
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 *   SuccessEnvelope.data = { planner: object } (raw backend payload)
 */
export async function runPlanner(message, context) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    return normalizeError(
      { code: ERROR_CODES.PLANNER_UNAVAILABLE, message: "runPlanner só disponível em modo real." },
      "planner",
    );
  }

  try {
    const session_id = getSessionId();
    // `message` carries the short trigger/command only.
    // The full operational brief (operator_intent, current_state, conversation_summary,
    // memory_summary, attachments, constraints, scope, acceptance_criteria) travels in
    // context.planner_brief as a structured object built by runPlannerAction.
    // execution_spec guides the pipeline to produce executable steps.
    const enrichedContext = {
      ...(context && typeof context === "object" ? context : {}),
      execution_spec: buildExecutionSpec(context?.target ?? null),
    };
    const body = { message, session_id, context: enrichedContext };
    const res = await apiClient.request("/planner/run", {
      method: "POST",
      body,
    });

    if (!res.ok || !res.data?.ok) {
      const rawErr = res.data?.error;
      const errMsg = typeof rawErr === "string" ? rawErr : "Falha ao gerar plano.";
      return normalizeError(
        { code: ERROR_CODES.PLANNER_UNAVAILABLE, message: errMsg },
        "planner",
      );
    }

    return {
      ok: true,
      data: {
        planner: res.data.planner,
        // P-BRIEF: expose backend telemetry so the frontend can log objective_source,
        // has_planner_brief, resolved_objective, and other diagnostic fields.
        telemetry: res.data.telemetry ?? null,
      },
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "planner");
  }
}

/**
 * Busca o último plano salvo para a sessão via GET /planner/latest.
 * Em mock mode retorna has_plan=false imediatamente.
 *
 * @param {string} session_id
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 *   SuccessEnvelope.data = { has_plan: boolean, plan: object|null }
 */
export async function fetchLatestPlan(session_id) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    return { ok: true, data: { has_plan: false, plan: null }, meta: { durationMs: 0 } };
  }

  try {
    const encoded = encodeURIComponent(session_id);
    const res = await apiClient.request(`/planner/latest?session_id=${encoded}`, {
      method: "GET",
    });

    if (!res.ok || !res.data?.ok) {
      const rawErr = res.data?.error;
      const errMsg = typeof rawErr === "string" ? rawErr : "Falha ao buscar último plano.";
      return normalizeError(
        { code: ERROR_CODES.PLAN_NOT_FOUND, message: errMsg },
        "planner",
      );
    }

    return {
      ok: true,
      data: {
        has_plan: !!res.data.has_plan,
        plan: res.data.plan ?? null,
      },
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "planner");
  }
}
