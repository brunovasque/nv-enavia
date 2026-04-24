// ============================================================================
// ENAVIA Panel — chat endpoint (internal implementation, public via index.js)
// chatSend() is the only public function for the chat module.
//
// Returns ResponseEnvelope (SuccessEnvelope | ErrorEnvelope) as defined in
// contracts.js. Mock mode handled inline — no external fixture file needed.
//
// LLM-first mode: posts to /chat/run. The backend returns a free-form LLM
// reply in `response.reply`, plus an optional `response.planner` snapshot
// when the planner was invoked as an internal tool.
// The chat content displayed to the user is the `reply` field directly —
// no derivation from deterministic planner fields.
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
 * Send a chat message and receive an Enavia response.
 *
 * In real mode, posts to /chat/run (LLM-first). The response includes:
 *   - data: ChatResponse shape (role, content, timestamp, sessionId)
 *     where content is the LLM's free-form reply
 *   - plannerSnapshot: raw response.planner when the planner was used as tool
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
    const reqBody = { message: text, session_id: getSessionId() };

    // Build conversation history (target injected as system context when present)
    let convHistory = Array.isArray(opts.conversation_history) ? [...opts.conversation_history] : [];
    if (opts.context?.target && typeof opts.context.target === "object") {
      const t = opts.context.target;
      const targetLines = [
        "[Contexto operacional ativo]",
        t.worker      ? `worker: ${t.worker}`           : null,
        t.repo        ? `repo: ${t.repo}`               : null,
        t.branch      ? `branch: ${t.branch}`           : null,
        t.environment ? `environment: ${t.environment}` : null,
        t.mode        ? `mode: ${t.mode}`               : null,
      ].filter(Boolean).join("\n");
      convHistory = [{ role: "system", content: targetLines }, ...convHistory];
    }
    if (convHistory.length > 0) {
      reqBody.conversation_history = convHistory;
    }

    // Operational context: target + attachments (sent as JSON for backend tooling)
    if (opts.context && typeof opts.context === "object") {
      reqBody.context = opts.context;
    }

    const { conversation_history: _ch, context: _ctx, ...restOpts } = opts;
    const res = await apiClient.request("/chat/run", {
      method: "POST",
      body: reqBody,
      ...restOpts,
    });

    if (!res.ok || !res.data?.ok) {
      const rawErr = res.data?.error ?? res.data?.detail;
      const errMsg = typeof rawErr === "string" ? rawErr : "Falha na conversa LLM-first.";
      return normalizeError(
        { code: ERROR_CODES.PLANNER_UNAVAILABLE, message: errMsg },
        "chat",
      );
    }

    // LLM-first: reply comes directly from response.reply
    const content = res.data.reply || "Instrução recebida. Processando.";
    const planner = res.data.planner || null;
    const memoryApplied = res.data.memory_applied === true;
    const memoryHits = Array.isArray(res.data.memory_hits) ? res.data.memory_hits : [];
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
      plannerSnapshot: planner,
      memoryApplied,
      memoryHits,
      meta: { durationMs: Date.now() - t0 },
    };
  } catch (err) {
    return normalizeError(err, "chat");
  }
}
