import { useState, useCallback, useRef, useEffect } from "react";

const MOCK_RESPONSES = [
  "Entendido. Processando o contexto fornecido. Me dê mais detalhes se quiser que eu elabore.",
  "Analisando os parâmetros. Posso detalhar o escopo assim que você especificar melhor.",
  "Registrado. Esse tipo de instrução entra no fluxo de planejamento assim que o módulo estiver ativo.",
  "Compreendido. Por ora estou operando em modo de visualização — a execução real será ativada nas próximas fases.",
  "Boa instrução. Vou mapear isso no plano quando o módulo de memória estiver plugado.",
  "Recebido. Posso estruturar isso como um objetivo tático se você confirmar o contexto.",
];

let _counter = 0;
function uid() {
  return `msg-${++_counter}-${Date.now()}`;
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

      const userMsg = {
        id: uid(),
        role: "user",
        content: trimmed,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      const delay = 1200 + Math.random() * 900;
      timerRef.current = setTimeout(() => {
        const reply =
          MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
        const enaMsg = {
          id: uid(),
          role: "enavia",
          content: reply,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, enaMsg]);
        setThinking(false);
      }, delay);
    },
    [thinking],
  );

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
    clearMessages,
  };
}
