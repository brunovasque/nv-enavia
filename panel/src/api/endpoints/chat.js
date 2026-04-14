// ============================================================================
// ENAVIA Panel — chat endpoint (internal implementation, public via index.js)
// chatSend() is the only public function for the chat module.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Mock mode handled inline — no external fixture file needed.
//
// Real mode: posts to /planner/run. The backend returns a structured planner
// payload, NOT a ready-made chat text. The chat content displayed to the user
// is derived locally from response.planner.canonicalPlan.chat_reply — the
// conversational surface field added to PM6. next_action is an internal
// operational directive for the executor and is NOT used for chat display.
// The raw response.planner is returned as plannerSnapshot so the caller can
// pass it to plannerStore for persistence as-is.
// ============================================================================

import { getApiConfig }                from "../config.js";
import { getSessionId }                from "../session.js";
import { normalizeError, ERROR_CODES } from "../errors.js";
import { apiClient }                   from "../client.js";
import { mapChatResponse }             from "../mappers/chat.js";
// Explicit contract reference — keeps this endpoint anchored to the central shapes.
import { ENVELOPES }                   from "../contracts.js"; // eslint-disable-line no-unused-vars

const MOCK_RESPONSES = [
  "Entendido. Processando o contexto fornecido. Me dê mais detalhes se quiser que eu elabore.",
  "Analisando os parâmetros. Posso detalhar o escopo assim que você especificar melhor.",
  "Registrado. Esse tipo de instrução entra no fluxo de planejamento assim que o módulo estiver ativo.",
  "Compreendido. Por ora estou operando em modo de visualização — a execução real será ativada nas próximas fases.",
  "Boa instrução. Vou mapear isso no plano quando o módulo de memória estiver plugado.",
  "Recebido. Posso estruturar isso como um objetivo tático se você confirmar o contexto.",
];

const ERROR_TRIGGER = /\berro\b/i;
const MOCK_DELAY = () => 1200 + Math.random() * 900;

async function mockChatSend(text, t0) {
  await new Promise((r) => setTimeout(r, MOCK_DELAY()));

  if (ERROR_TRIGGER.test(text)) {
    return {
      ok: false,
      data: null,
      error: {
        code:      ERROR_CODES.CHAT_MODULE_FAILURE,
        message:   "Falha na conexão com o módulo de execução. Tente novamente.",
        module:    "chat",
        retryable: true,
      },
      meta: { durationMs: Date.now() - t0 },
    };
  }

  const content =
    MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
  const sessionId = getSessionId();
  const data = mapChatResponse(
    { role: "enavia", content, timestamp: new Date().toISOString(), sessionId },
    sessionId,
  );
  return { ok: true, data, plannerSnapshot: null, meta: { durationMs: Date.now() - t0 } };
}

/**
 * Derive a human-readable chat text from the structured planner response.
 *
 * TRANSPARENCY: the backend /planner/run does NOT return a chat-ready text in
 * a root field. This function derives the chat bubble content from real backend
 * fields in priority order:
 *   1. canonicalPlan.chat_reply (PM6 conversational surface) — preferred
 *   2. canonicalPlan.reason (PM4 reasoning summary) — fallback
 *   3. Generic acknowledgement — last resort
 *
 * NOTE: canonicalPlan.next_action is an internal operational directive for the
 * executor and is NOT used for chat display.
 *
 * @param {object} planner - raw response.planner from /planner/run
 * @returns {string}
 */
function _deriveChatContent(planner) {
  const cp = planner?.canonicalPlan;
  if (typeof cp?.chat_reply === "string" && cp.chat_reply.length > 0) {
    return cp.chat_reply;
  }
  if (typeof cp?.reason === "string" && cp.reason.length > 0) {
    return cp.reason;
  }
  return "Instrução recebida e processada pelo planner. Consulte o plano gerado na aba Plano.";
}

/**
 * Send a chat message and receive an Enavia response.
 *
 * In real mode, posts to /planner/run. The response includes:
 *   - data: ChatResponse shape (role, content, timestamp, sessionId)
 *     where content is derived from planner.canonicalPlan.next_action
 *   - plannerSnapshot: raw response.planner for storage in plannerStore
 *
 * @param {string} text
 * @param {object} [opts]
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function chatSend(text, opts = {}) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") return mockChatSend(text, t0);

  try {
    const res = await apiClient.request("/planner/run", {
      method: "POST",
      body: { message: text, session_id: getSessionId() },
      ...opts,
    });

    if (!res.ok || !res.data?.ok) {
      // Extract error message from backend response — may be in .error or .detail.
      // Validate it's a string before using; fall back to generic message.
      const rawErr = res.data?.error ?? res.data?.detail;
      const errMsg = typeof rawErr === "string" ? rawErr : "Falha no pipeline do planner.";
      return normalizeError(
        { code: ERROR_CODES.PLANNER_UNAVAILABLE, message: errMsg },
        "chat",
      );
    }

    const planner = res.data.planner;

    // Derive chat content transparently from real backend fields.
    const content = _deriveChatContent(planner);
    const sessionId = getSessionId();

    const data = mapChatResponse(
      { role: "enavia", content, timestamp: new Date().toISOString(), sessionId },
      sessionId,
    );

    if (!data) {
      return normalizeError(
        { code: ERROR_CODES.INVALID_RESPONSE, message: "Resposta inválida do servidor." },
        "chat",
      );
    }

    return {
      ok: true,
      data,
      plannerSnapshot: planner ?? null,
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "chat");
  }
}
