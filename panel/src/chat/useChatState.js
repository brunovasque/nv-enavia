import { useState, useCallback, useRef } from "react";
import { chatSend, normalizeError } from "../api";
import { onChatSuccess } from "../store/plannerStore";

// Seed conversation for validating the "conversation" state without typing from scratch.
const SEED_MESSAGES = [
  { role: "enavia", content: "Sessão iniciada. Módulos de planejamento e memória em standby. Como posso ajudar?" },
  { role: "user",   content: "Preciso mapear as pendências do contrato anterior antes de avançar." },
  { role: "enavia", content: "Entendido. Iniciando consolidação do histórico do contrato anterior. Assim que o módulo de memória for ativado, o mapeamento será automático. Por ora posso estruturar o escopo manualmente se você detalhar os pontos críticos." },
];

// Gap between seeded messages to simulate a past conversation (1.5 minutes apart).
const SEED_INTERVAL_MS = 90000;

// PR5: Build conversation history for LLM context continuity.
// Converts panel messages to the format expected by /chat/run.
// Limits: max 20 messages, max 4000 chars total.
const _PR5_MAX_HISTORY = 20;
const _PR5_MAX_CHARS = 4000;

function _buildConversationHistory(msgs) {
  if (!Array.isArray(msgs) || msgs.length === 0) return [];
  const result = [];
  let totalChars = 0;
  const recent = msgs.slice(-_PR5_MAX_HISTORY);
  for (const msg of recent) {
    const role = msg.role === "user" ? "user" : "assistant";
    const content = typeof msg.content === "string" ? msg.content.trim() : "";
    if (!content) continue;
    if (totalChars + content.length > _PR5_MAX_CHARS) break;
    totalChars += content.length;
    result.push({ role, content });
  }
  return result;
}

let _counter = 0;
function uid() {
  return `msg-${++_counter}-${Date.now()}`;
}

function makeMsg(role, content, timestampOrOffsetMs = 0) {
  // String → ISO timestamp from the API; number → negative offset from now (seed mode).
  // Guard: fall back to now if the string produces an invalid date.
  let ts;
  if (typeof timestampOrOffsetMs === "string") {
    ts = new Date(timestampOrOffsetMs);
    if (isNaN(ts.getTime())) ts = new Date();
  } else {
    ts = new Date(Date.now() - timestampOrOffsetMs);
  }
  return { id: uid(), role, content, timestamp: ts };
}

export function useChatState() {
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState("");
  // Ref guard: set synchronously before the first await to block concurrent sends
  // even if re-render hasn't propagated `thinking=true` yet.
  const sendingRef = useRef(false);
  // Tracks the last trimmed text successfully dispatched — used by retryMessage.
  const lastSentRef = useRef(null);
  // PR5: Stores conversation history snapshot for the current send cycle.
  // Updated in sendMessage before adding the new user message.
  // Persists across send→retry so retryMessage uses the same history.
  const historyRef = useRef([]);

  // HTTP-only layer: calls chatSend(), handles response, updates state.
  // Does NOT add a user message bubble — that is the caller's responsibility.
  // Called by sendMessage (after adding the bubble) and by retryMessage (no new bubble).
  const _doHttpSend = useCallback(async (trimmed) => {
    // PR5: Forward conversation history for LLM context continuity
    const chatOpts = {};
    if (historyRef.current.length > 0) {
      chatOpts.conversation_history = historyRef.current;
    }

    let result;
    try {
      result = await chatSend(trimmed, chatOpts);
    } catch (err) {
      const envelope = normalizeError(err, "chat");
      setError(envelope.error.message);
      setThinking(false);
      sendingRef.current = false;
      return;
    }

    if (!result.ok) {
      setError(result.error.message);
      setThinking(false);
      sendingRef.current = false;
      return;
    }

    const { role, content, timestamp } = result.data;
    setMessages((prev) => [...prev, makeMsg(role, content, timestamp)]);
    onChatSuccess(trimmed, result.plannerSnapshot ?? null);
    setThinking(false);
    sendingRef.current = false;
  }, []);

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;

      sendingRef.current = true;
      lastSentRef.current = trimmed;
      setError(null);

      // PR5: Snapshot conversation history BEFORE adding the new user message.
      // This ensures the history sent to the LLM doesn't include the current
      // message (which is sent separately as the primary `message` field).
      historyRef.current = _buildConversationHistory(messages);

      const userMsg = makeMsg("user", trimmed);
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      await _doHttpSend(trimmed);
    },
    [_doHttpSend, messages],
  );

  // Retries the last failed send.
  // Reuses the existing user message bubble — no duplicate is added to the chat history.
  const retryMessage = useCallback(async () => {
    if (!lastSentRef.current || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    setThinking(true);
    await _doHttpSend(lastSentRef.current);
  }, [_doHttpSend]);

  const dismissError = useCallback(() => setError(null), []);

  // Loads a static conversation seed to validate the "conversation" state without typing.
  const seedMessages = useCallback(() => {
    const seeded = SEED_MESSAGES.map((m, i) =>
      makeMsg(m.role, m.content, (SEED_MESSAGES.length - i) * SEED_INTERVAL_MS),
    );
    setMessages(seeded);
    setThinking(false);
    setError(null);
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setThinking(false);
    setError(null);
  }, []);

  return {
    messages,
    thinking,
    error,
    inputValue,
    setInputValue,
    sendMessage,
    retryMessage,
    seedMessages,
    dismissError,
    clearMessages,
  };
}
