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
    // Send the user instruction as-is; target travels in context.target (JSON).
    // The LLM derives the plan objective from the instruction, not from the target.
    const body = { message, session_id };
    if (context && typeof context === "object") {
      body.context = context;
    }
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
      data: { planner: res.data.planner },
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
