import { useState, useCallback, useRef, useEffect } from "react";

const MOCK_RESPONSES = [
  "Entendido. Processando o contexto fornecido. Me dê mais detalhes se quiser que eu elabore.",
  "Analisando os parâmetros. Posso detalhar o escopo assim que você especificar melhor.",
  "Registrado. Esse tipo de instrução entra no fluxo de planejamento assim que o módulo estiver ativo.",
  "Compreendido. Por ora estou operando em modo de visualização — a execução real será ativada nas próximas fases.",
  "Boa instrução. Vou mapear isso no plano quando o módulo de memória estiver plugado.",
  "Recebido. Posso estruturar isso como um objetivo tático se você confirmar o contexto.",
];

// Error trigger: any message containing "erro" (case-insensitive) simulates a module failure.
const ERROR_TRIGGER = /\berro\b/i;
const MOCK_ERROR = "Falha na conexão com o módulo de execução. Tente novamente.";

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

function makeMsg(role, content, offsetMs = 0) {
  const ts = new Date(Date.now() - offsetMs);
  return { id: uid(), role, content, timestamp: ts };
}

export function useChatState() {
  const [messages, setMessages] = useState([]);
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState("");
  const timerRef = useRef(null);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  const sendMessage = useCallback(
    (text) => {
      const trimmed = text.trim();
      if (!trimmed || thinking) return;

      setError(null);

      const userMsg = makeMsg("user", trimmed);
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      const delay = 1200 + Math.random() * 900;
      timerRef.current = setTimeout(() => {
        if (ERROR_TRIGGER.test(trimmed)) {
          setError(MOCK_ERROR);
          setThinking(false);
          return;
        }
        const reply =
          MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
        setMessages((prev) => [...prev, makeMsg("enavia", reply)]);
        setThinking(false);
      }, delay);
    },
    [thinking],
  );

  // Loads a static conversation seed to validate the "conversation" state without typing.
  const seedMessages = useCallback(() => {
    clearTimeout(timerRef.current);
    const seeded = SEED_MESSAGES.map((m, i) =>
      makeMsg(m.role, m.content, (SEED_MESSAGES.length - i) * SEED_INTERVAL_MS),
    );
    setMessages(seeded);
    setThinking(false);
    setError(null);
  }, []);

  const dismissError = useCallback(() => setError(null), []);

  const clearMessages = useCallback(() => {
    clearTimeout(timerRef.current);
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
