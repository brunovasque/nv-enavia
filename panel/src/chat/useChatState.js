import { useState, useCallback, useRef, useEffect } from "react";
import { chatSend, normalizeError, runPlanner, createManualMemory, getSessionId } from "../api";
import { onChatSuccess } from "../store/plannerStore";
import { loadChatHistory, saveChatHistory, clearChatHistory } from "./useChatPersistence";
import { targetFields } from "./useTargetState";

// Reset command patterns (case-insensitive, trimmed).
const RESET_PATTERNS = ["reset chat", "limpar chat", "zerar conversa"];

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
  const sessionId = getSessionId();
  const [messages, setMessages] = useState(() => loadChatHistory(sessionId));
  const [thinking, setThinking] = useState(false);
  const [error, setError] = useState(null);
  const [inputValue, setInputValue] = useState("");
  // Ref guard: set synchronously before the first await to block concurrent sends
  // even if re-render hasn't propagated `thinking=true` yet.
  const sendingRef = useRef(false);
  // Tracks the last trimmed text successfully dispatched — used by retryMessage.
  const lastSentRef = useRef(null);
  // Tracks the last context dispatched — used by retryMessage.
  const lastContextRef = useRef(null);
  // PR5: Stores conversation history snapshot for the current send cycle.
  // Updated in sendMessage before adding the new user message.
  // Persists across send→retry so retryMessage uses the same history.
  const historyRef = useRef([]);

  // Persist messages to localStorage whenever they change.
  useEffect(() => {
    saveChatHistory(sessionId, messages);
  }, [sessionId, messages]);

  // HTTP-only layer: calls chatSend(), handles response, updates state.
  // Does NOT add a user message bubble — that is the caller's responsibility.
  // Called by sendMessage (after adding the bubble) and by retryMessage (no new bubble).
  // context: optional { target, attachments_summary } forwarded to /chat/run.
  const _doHttpSend = useCallback(async (trimmed, context) => {
    // PR5: Forward conversation history for LLM context continuity
    const chatOpts = {};
    if (historyRef.current.length > 0) {
      chatOpts.conversation_history = historyRef.current;
    }
    if (context && typeof context === "object") {
      chatOpts.context = context;
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
    const enaMsg = makeMsg(role, content, timestamp);
    // Attach memory telemetry to the message so MessageBubble can render the badge.
    if (result.memoryApplied === true) {
      enaMsg.memoryApplied = true;
      enaMsg.memoryHits = Array.isArray(result.memoryHits) ? result.memoryHits : [];
    }
    // Attach operational context telemetry so MessageBubble can show the target badge.
    if (result.operationalContextApplied === true) {
      enaMsg.operationalContextApplied = true;
      enaMsg.targetSeen = result.targetSeen === true;
      enaMsg.targetFieldsSeen = Array.isArray(result.targetFieldsSeen) ? result.targetFieldsSeen : [];
      enaMsg.memoryContentInjected = result.memoryContentInjected === true;
      enaMsg.memoryHitsCount = typeof result.memoryHitsCount === "number" ? result.memoryHitsCount : 0;
    }
    setMessages((prev) => [...prev, enaMsg]);
    onChatSuccess(trimmed, result.plannerSnapshot ?? null);
    setThinking(false);
    sendingRef.current = false;
  }, []);

  const clearMessages = useCallback(() => {
    setMessages([]);
    setThinking(false);
    setError(null);
  }, []);

  // Clears the chat history (visual + localStorage) for the current session.
  // Does NOT touch memory, planner, execution, or session_id.
  const resetChat = useCallback(() => {
    clearChatHistory(sessionId);
    const resetMsg = makeMsg(
      "system",
      "Chat resetado. Memórias, planos e execuções não foram apagados.",
      new Date().toISOString(),
    );
    setMessages([resetMsg]);
    setThinking(false);
    setError(null);
  }, [sessionId]);

  const sendMessage = useCallback(
    async (text, context) => {
      const trimmed = text.trim();
      if (!trimmed || sendingRef.current) return;

      // Detect textual reset commands — execute locally without calling LLM.
      if (RESET_PATTERNS.includes(trimmed.toLowerCase())) {
        resetChat();
        return;
      }

      sendingRef.current = true;
      lastSentRef.current = trimmed;
      lastContextRef.current = context ?? null;
      setError(null);

      // PR5: Snapshot conversation history BEFORE adding the new user message.
      // This ensures the history sent to the LLM doesn't include the current
      // message (which is sent separately as the primary `message` field).
      historyRef.current = _buildConversationHistory(messages);

      const userMsg = makeMsg("user", trimmed);
      setMessages((prev) => [...prev, userMsg]);
      setThinking(true);

      await _doHttpSend(trimmed, context);
    },
    [_doHttpSend, messages, resetChat],
  );

  // Retries the last failed send.
  // Reuses the existing user message bubble — no duplicate is added to the chat history.
  const retryMessage = useCallback(async () => {
    if (!lastSentRef.current || sendingRef.current) return;
    sendingRef.current = true;
    setError(null);
    setThinking(true);
    await _doHttpSend(lastSentRef.current, lastContextRef.current);
  }, [_doHttpSend]);

  const dismissError = useCallback(() => setError(null), []);

  // Inject an info message from outside (e.g. attachment notification)
  const injectInfoMessage = useCallback((content) => {
    setMessages((prev) => [...prev, makeMsg("enavia", content, new Date().toISOString())]);
  }, []);

  // Loads a static conversation seed to validate the "conversation" state without typing.
  const seedMessages = useCallback(() => {
    const seeded = SEED_MESSAGES.map((m, i) =>
      makeMsg(m.role, m.content, (SEED_MESSAGES.length - i) * SEED_INTERVAL_MS),
    );
    setMessages(seeded);
    setThinking(false);
    setError(null);
  }, []);

  // ── Quick Action: Gerar plano via /planner/run ──────────────────────────────
  // Pega message atual + context (target + attachments) → POST /planner/run.
  // Quando não há mensagem explícita, deriva intenção do histórico da conversa.
  // Exibe resumo do plano no chat. NÃO executa nada.
  const runPlannerAction = useCallback(async (message, context) => {
    const trimmed = (message || "").trim();
    if (sendingRef.current) return;

    // ── Construir contexto consolidado para o planner ──────────────────────
    // Quando há texto explícito no input, ele é usado como gatilho direto.
    // Quando não há, deriva intenção do histórico da conversa com contexto estruturado.
    let promptText;
    if (trimmed) {
      promptText = trimmed;
    } else {
      // Padrões de mensagens da Enavia que representam bloqueio/fallback —
      // NÃO devem ser incluídos como contexto operacional do planner.
      const ENAVIA_FALLBACK_PATTERNS = [
        "Para gerar um plano, primeiro alinhe",
      ];
      const isEnaviaFallback = (content) =>
        ENAVIA_FALLBACK_PATTERNS.some((p) => content.trim().startsWith(p));

      // Mensagens relevantes para o planner:
      //   - user: todas exceto meta-mensagens de plano/aprovação (📋/✅)
      //   - enavia: apenas respostas substantivas (exclui fallback/nudge)
      //   - system: sempre excluído
      const relevantMsgs = messages.filter((m) => {
        if (typeof m.content !== "string" || m.content.trim().length === 0) return false;
        if (m.role === "user") {
          return !m.content.startsWith("📋") && !m.content.startsWith("✅");
        }
        if (m.role === "enavia") {
          return !isEnaviaFallback(m.content);
        }
        return false; // role=system excluído
      });

      // Exige ao menos uma mensagem do operador para gerar plano.
      const hasUserMsg = relevantMsgs.some((m) => m.role === "user");
      if (!hasUserMsg) {
        setMessages((prev) => [
          ...prev,
          makeMsg(
            "enavia",
            "Para gerar um plano, primeiro alinhe a intenção aqui no Chat. " +
            "Descreva o objetivo, o target e o escopo da operação. " +
            "Quando estiver pronto, clique em **Gerar plano** novamente.",
            new Date().toISOString(),
          ),
        ]);
        return;
      }

      // Janela de contexto: últimas 6 mensagens relevantes (user + enavia substantivas).
      const recentMsgs = relevantMsgs.slice(-6);

      // Gatilho: última mensagem do operador na janela de contexto.
      const triggerMsg = [...recentMsgs].reverse().find((m) => m.role === "user");
      const triggerText = triggerMsg?.content.trim() ?? "(contexto da conversa)";

      // Resumo do alinhamento — diálogo interleaved operator/enavia.
      const conversationLines = recentMsgs
        .map((m) => `${m.role === "user" ? "Operador" : "Enavia"}: ${m.content.trim()}`)
        .join("\n");

      // Target operacional — extraído do contexto passado pelo caller.
      const tFields = targetFields(context?.target);
      const targetLine = tFields.length > 0
        ? tFields.map((f) => `${f.label}=${f.value}`).join(", ")
        : null;

      // Resumo de anexos — nomes de arquivos, se disponíveis.
      const attachList = Array.isArray(context?.attachments) ? context.attachments : [];
      const attachSummary = attachList.length > 0
        ? `${attachList.length} arquivo(s): ${attachList.map((a) => a.filename).join(", ")}`
        : null;

      // Monta prompt estruturado para o planner.
      // O LLM deve usar este contexto completo para derivar o objetivo do plano —
      // nunca usar apenas uma frase solta como objetivo.
      const parts = [
        "Gerar plano operacional com base no contexto consolidado abaixo.",
        "",
        `Gatilho: ${triggerText}`,
      ];
      if (conversationLines.length > 0) {
        parts.push("", "Alinhamento da conversa:", conversationLines);
      }
      if (targetLine) {
        parts.push("", `Target: ${targetLine}`);
      }
      if (attachSummary) {
        parts.push(`Contexto adicional: ${attachSummary}`);
      }
      parts.push(
        "",
        "Restrições: somente leitura, aprovação humana obrigatória, sem execução automática.",
      );
      promptText = parts.join("\n");
    }

    sendingRef.current = true;
    setThinking(true);
    setError(null);

    const userMsg = makeMsg("user", `📋 Gerar plano: ${trimmed || "(contexto da conversa)"}`);
    setMessages((prev) => [...prev, userMsg]);

    let result;
    try {
      result = await runPlanner(promptText, context);
    } catch (err) {
      const envelope = normalizeError(err, "planner");
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

    const planner = result.data?.planner;

    // Build a readable plan summary — never use JSON.stringify.
    // canonicalPlan.objective is the primary source; fall back to listing steps.
    const objective = planner?.canonicalPlan?.objective
      || planner?.classification?.objective
      || null;
    const rawSteps = Array.isArray(planner?.canonicalPlan?.steps)
      ? planner.canonicalPlan.steps
      : [];
    const needsApproval = planner?.gate?.needs_human_approval === true
      || planner?.gate?.gate_status === "approval_required";

    let summaryLines = [];
    // Target metadata — shown as separate line, never mixed with objective
    const tFields = targetFields(context?.target);
    if (tFields.length > 0) {
      const parts = tFields.map((f) => f.value).join(" / ");
      summaryLines.push(`**Target:** ${parts}`);
    }
    if (objective) {
      summaryLines.push(`**Objetivo:** ${objective}`);
    }
    if (rawSteps.length > 0) {
      const stepList = rawSteps
        .slice(0, 8)
        .map((s, i) => `${i + 1}. ${typeof s === "string" ? s : (s.label ?? s.description ?? s.action ?? "Passo sem nome")}`)
        .join("\n");
      summaryLines.push(`**Passos (${rawSteps.length}):**\n${stepList}`);
      if (rawSteps.length > 8) summaryLines.push(`_... e mais ${rawSteps.length - 8} passo(s)_`);
    }
    if (summaryLines.length === 0) {
      summaryLines.push("Plano estruturado gerado. Nenhum objetivo ou passo disponível.");
    }
    if (needsApproval) {
      summaryLines.push("⏳ **Gate humano:** aprovação necessária antes de executar.");
    }
    summaryLines.push("_Abra a aba /plan para detalhes completos._");

    const replyContent = `📋 **Plano gerado**\n\n${summaryLines.join("\n\n")}`;
    setMessages((prev) => [...prev, makeMsg("enavia", replyContent, new Date().toISOString())]);
    onChatSuccess(promptText, planner ?? null);
    setThinking(false);
    sendingRef.current = false;
  }, [messages]);

  // ── Quick Action: Aprovar execução → /chat/run com message="aprovado" ────────
  const approveExecution = useCallback(async (context) => {
    if (sendingRef.current) return;
    sendingRef.current = true;
    lastSentRef.current = "aprovado";
    lastContextRef.current = context ?? null;
    historyRef.current = _buildConversationHistory(messages);

    const userMsg = makeMsg("user", "✅ Aprovado — prosseguir com execução.");
    setMessages((prev) => [...prev, userMsg]);
    setThinking(true);
    setError(null);

    await _doHttpSend("aprovado", context);
  }, [_doHttpSend, messages]);

  // ── Quick Action: Validar sistema ─────────────────────────────────────────────
  // Monta prompt seguro read-only e chama /planner/run.
  const validateSystem = useCallback(async (context) => {
    const prompt =
      "Crie um plano e prepare execução via executor para validar o worker alvo em modo somente leitura. " +
      "Não execute nada. Apenas prepare o plano de validação.";
    await runPlannerAction(prompt, context);
  }, [runPlannerAction]);

  // ── Quick Action: Salvar na memória → /memory/manual ─────────────────────────
  // Salva preferência operacional informada. Retorna se sucesso ou falha.
  const saveToMemory = useCallback(async (content, context) => {
    setError(null);
    const payload = {
      content:  content || "Confiabilidade sempre: priorizar segurança, staging e validação read-only antes de qualquer ação.",
      source:   "chat_quick_action",
      session_id: getSessionId(),
      ...(context?.target ? {
        tags: [context.target.environment, context.target.worker].filter((v) => typeof v === "string" && v.length > 0),
      } : {}),
    };

    let result;
    try {
      result = await createManualMemory(payload);
    } catch (err) {
      const envelope = normalizeError(err, "memory");
      setError(envelope.error.message);
      return { ok: false };
    }

    if (!result.ok) {
      setError(result.error?.message ?? "Falha ao salvar na memória.");
      return { ok: false };
    }

    const confirmMsg = makeMsg("enavia", "🧠 Preferência operacional salva na memória com sucesso.", new Date().toISOString());
    setMessages((prev) => [...prev, confirmMsg]);
    return { ok: true };
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
    resetChat,
    injectInfoMessage,
    // Quick actions
    runPlannerAction,
    approveExecution,
    validateSystem,
    saveToMemory,
  };
}
