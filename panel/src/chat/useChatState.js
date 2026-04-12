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

  const sendMessage = useCallback(
    async (text) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;

      sendingRef.current = true;
      setError(null);

      const userMsg = makeMsg("user", trimmed);
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      let result;
      try {
        result = await chatSend(trimmed);
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
      onChatSuccess(trimmed);
      setThinking(false);
      sendingRef.current = false;
    },
    [],
  );

  // Loads a static conversation seed to validate the "conversation" state without typing.
  const seedMessages = useCallback(() => {
    const seeded = SEED_MESSAGES.map((m, i) =>
      makeMsg(m.role, m.content, (SEED_MESSAGES.length - i) * SEED_INTERVAL_MS),
    );
    setMessages(seeded);
    setThinking(false);
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

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
    seedMessages,
    dismissError,
    clearMessages,
  };
}
