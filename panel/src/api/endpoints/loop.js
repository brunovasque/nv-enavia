// ============================================================================
// ENAVIA Panel — Loop Operacional API Endpoints (PR12, panel-only)
//
// Expõe:
//   fetchLoopStatus()  — GET /contracts/loop-status
//   executeNext(body)  — POST /contracts/execute-next
//
// Em modo mock: retorna dados nulos com flag mock:true — sem fixture inventada.
// O loop operacional exige backend real para funcionar.
// ============================================================================

import { apiClient }    from "../client.js";
import { getApiConfig } from "../config.js";
import { normalizeError } from "../errors.js";

/**
 * Consulta o status atual do loop operacional supervisionado.
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function fetchLoopStatus() {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    return { ok: true, data: null, meta: { durationMs: Date.now() - t0, mock: true } };
  }

  try {
    const res = await apiClient.request("/contracts/loop-status");

    if (!res.ok) {
      return normalizeError(
        { code: "LOOP_STATUS_ERROR", message: "Falha ao carregar status do loop operacional." },
        "loop",
      );
    }

    return { ok: true, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "loop");
  }
}

/**
 * Executa a próxima ação operacional supervisionada.
 * Body canônico: { confirm: true, approved_by: string, evidence: [] }
 *
 * @param {{ confirm: boolean, approved_by: string, evidence: any[] }} body
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function executeNext(body = {}) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") {
    return {
      ok: true,
      data: {
        ok: false,
        executed: false,
        status: "blocked",
        reason: "Modo mock ativo: backend real não disponível. Configure VITE_NV_ENAVIA_URL para usar o loop operacional.",
        nextAction: null,
        operationalAction: null,
        evidence: null,
        rollback: null,
        executor_path: null,
        audit_id: "mock:0",
      },
      meta: { durationMs: Date.now() - t0, mock: true },
    };
  }

  try {
    const res = await apiClient.request("/contracts/execute-next", {
      method: "POST",
      body,
    });

    return { ok: res.ok, data: res.data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "loop");
  }
}
