// ============================================================================
// ENAVIA Panel — chat endpoint (internal implementation, public via index.js)
// chatSend() is the only public function for the chat module.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Mock mode handled inline — no external fixture file needed.
// Real mode: posts to /chat/send via apiClient (RealTransport stub).
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
  return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
}

/**
 * Send a chat message and receive an Enavia response.
 * @param {string} text
 * @param {object} [opts]
 * @returns {Promise<SuccessEnvelope|ErrorEnvelope>}
 */
export async function chatSend(text, opts = {}) {
  const t0 = Date.now();
  const { mode } = getApiConfig();

  if (mode !== "real") return mockChatSend(text, t0);

  try {
    const res = await apiClient.request("/chat/send", {
      method: "POST",
      body: { text },
      ...opts,
    });
    const data = mapChatResponse(res.data, getSessionId());
    if (!data) {
      return normalizeError(
        { code: ERROR_CODES.INVALID_RESPONSE, message: "Resposta inválida do servidor." },
        "chat",
      );
    }
    return { ok: true, data, meta: { durationMs: Date.now() - t0 } };
  } catch (err) {
    return normalizeError(err, "chat");
  }
}
