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
  // Constrói um plannerBrief estruturado (handoff operacional) a partir do
  // histórico da conversa + contexto e envia ao backend via context.planner_brief.
  // O campo `message` recebe apenas o gatilho/trigger, não o plano completo.
  // Exibe resumo do plano no chat. NÃO executa nada.

  // Quantas mensagens do operador formam a síntese de intenção (operator_intent).
  const PLANNER_INTENT_WINDOW = 4;
  // Tamanho máximo da janela de diálogo interleaved para conversation_summary.
  const PLANNER_CONVERSATION_WINDOW = 8;
  // Máximo de hits de memória incluídos no memory_summary para evitar payload excessivo.
  const PLANNER_MAX_MEMORY_HITS = 4;
  // Máximo de caracteres do content_summary de cada anexo incluídos no brief.
  const PLANNER_ATTACH_SUMMARY_LEN = 80;

  const runPlannerAction = useCallback(async (message, context) => {
    const trimmed = (message || "").trim();
    if (sendingRef.current) return;

    // ── Filtros de mensagens para extração de contexto ─────────────────────

    // Padrões de mensagens da Enavia que representam bloqueio/fallback —
    // NÃO devem ser incluídos como contexto operacional do planner.
    const ENAVIA_FALLBACK_PATTERNS = [
      "Para gerar um plano, primeiro alinhe",
      "📋 **Plano gerado**",
    ];
    const isEnaviaFallback = (content) =>
      ENAVIA_FALLBACK_PATTERNS.some((p) => content.trim().startsWith(p));

    // Mensagens do operador relevantes: excluem meta-ações (📋/✅) e texto vazio.
    const userMsgs = messages.filter(
      (m) => m.role === "user" &&
             typeof m.content === "string" &&
             m.content.trim().length > 0 &&
             !m.content.startsWith("📋") &&
             !m.content.startsWith("✅"),
    );

    // Mensagens da Enavia relevantes: apenas respostas substantivas (excluem fallback).
    const enaviaMsgs = messages.filter(
      (m) => m.role === "enavia" &&
             typeof m.content === "string" &&
             m.content.trim().length > 0 &&
             !isEnaviaFallback(m.content),
    );

    // ── Verificar suficiência de contexto ──────────────────────────────────
    // Exige ao menos 2 mensagens do operador para derivar intenção real.
    // Uma única mensagem não é suficiente para distinguir intenção de gatilho.
    if (userMsgs.length < 2 && !trimmed) {
      setMessages((prev) => [
        ...prev,
        makeMsg(
          "enavia",
          "Para gerar um plano estruturado, primeiro alinhe a intenção aqui no Chat. " +
          "Descreva o **objetivo**, o **target** e o **escopo** da operação " +
          "(2 ou mais mensagens de alinhamento). " +
          "Quando estiver pronto, clique em **Gerar plano** novamente.",
          new Date().toISOString(),
        ),
      ]);
      return;
    }

    // ── Construir plannerBrief estruturado ─────────────────────────────────
    // Este objeto é o handoff operacional enviado ao backend como
    // context.planner_brief. O backend LLM usa os campos nomeados para
    // derivar objetivo, passos e restrições — não interpreta texto livre.

    // ── Classificar mensagens do usuário por função ────────────────────────
    // Cada mensagem recebe um papel: 'objective', 'context', ou 'neutral'.
    //
    // objective: define o objetivo/intenção real do plano.
    //   Indicadores: "objetivo:", "quero", "preciso", "meu objetivo",
    //   "validar", "mapear", "corrigir", "auditar", "implementar", "criar",
    //   "resolver", "diagnóstico", "analisar", "revisar".
    //
    // context: adiciona URL, arquivo, ambiente, restrição ou detalhe
    //   complementar — NUNCA deve substituir objective.
    //   Indicadores: "use como url", "use este arquivo", "use essa url",
    //   "com esse contexto", "pode consolidar", "considere",
    //   "url pública", "adiciona", "complemento", "também considere",
    //   "use o arquivo", "usando", "com a url".
    //
    // neutral: outros comentários/pergutnas sem papel definido.

    const OBJECTIVE_PATTERNS = [
      /\bobjetivo\s*:/i,
      /\bquero\s+(montar|criar|validar|mapear|corrigir|auditar|implementar|gerar|verificar|checar|revisar|analisar|diagnosticar)\b/i,
      /\bpreciso\s+(validar|mapear|corrigir|auditar|implementar|criar|verificar|checar|revisar|analisar|diagnosticar|de um plano)\b/i,
      /\bmeu objetivo\b/i,
      /\bo objetivo é\b/i,
      /\bplano\s+(para|de|operacional)\b/i,
    ];

    const CONTEXT_PATTERNS = [
      /\buse\s+(como\s+url|este\s+arquivo|essa\s+url|o\s+arquivo|a\s+url)\b/i,
      /\bcom\s+(esse|este|esse\s+novo|este\s+novo)\s+contexto\b/i,
      /\bpode\s+consolidar\b/i,
      /\bconsidere\b/i,
      /\burl\s+p[úu]blica\b/i,
      /\btamb[ée]m\s+considere\b/i,
      /\badiciona\b/i,
      /\bcomplemento\b/i,
      /\busing\b.*\burl\b/i,
      /\bcom\s+a\s+url\b/i,
      /\bcom\s+o\s+target\b/i,
      /\buse\s+o\s+seguinte\b/i,
    ];

    const classifyUserMsg = (content) => {
      const c = content.trim();
      if (OBJECTIVE_PATTERNS.some((rx) => rx.test(c))) return "objective";
      if (CONTEXT_PATTERNS.some((rx) => rx.test(c))) return "context";
      return "neutral";
    };

    // Classify all relevant user messages.
    const classifiedUserMsgs = userMsgs.map((m) => ({
      ...m,
      _role: classifyUserMsg(m.content),
    }));

    // trigger_message: o comando curto que disparou o botão.
    // Quando o campo de input está vazio, usa um comando canônico em vez da
    // última mensagem do usuário (que pode ser um complemento de contexto como
    // "Use como URL pública..."). A intenção real viaja em plannerBrief.operator_intent.
    const triggerMessage = trimmed.length > 0 ? trimmed : "Gerar plano";

    // operator_intent: prioriza mensagens classificadas como 'objective'.
    // Se não houver nenhuma, usa mensagens 'neutral' da janela recente.
    // Mensagens 'context' nunca entram no operator_intent.
    const objectiveMsgs = classifiedUserMsgs.filter((m) => m._role === "objective");
    const neutralMsgs   = classifiedUserMsgs.filter((m) => m._role === "neutral");
    const intentSource  = objectiveMsgs.length > 0 ? objectiveMsgs : neutralMsgs;
    // Cap to PLANNER_INTENT_WINDOW; prefer earlier objective messages over latest complement.
    const intentLines   = intentSource.slice(-PLANNER_INTENT_WINDOW).map((m) => m.content.trim());
    // Append context messages as additional detail, not as objective.
    const contextMsgs   = classifiedUserMsgs.filter((m) => m._role === "context");
    const contextDetail = contextMsgs.length > 0
      ? ` [contexto adicional: ${contextMsgs.map((m) => m.content.trim()).join(" | ")}]`
      : "";
    const operatorIntent = intentLines.join(" | ") + contextDetail;

    // current_state: última resposta substantiva da Enavia (o que foi reconhecido).
    const lastEnaviaMsg = enaviaMsgs[enaviaMsgs.length - 1]?.content.trim() ?? null;

    // relevant_conversation_summary: diálogo interleaved das últimas 8 msgs relevantes.
    const allRelevant = messages.filter((m) => {
      if (typeof m.content !== "string" || m.content.trim().length === 0) return false;
      if (m.role === "user")   return !m.content.startsWith("📋") && !m.content.startsWith("✅");
      if (m.role === "enavia") return !isEnaviaFallback(m.content);
      return false;
    });
    const conversationWindow = allRelevant.slice(-PLANNER_CONVERSATION_WINDOW);
    const conversationSummary = conversationWindow
      .map((m) => `${m.role === "user" ? "Operador" : "Enavia"}: ${m.content.trim()}`)
      .join("\n");

    // memory_summary: hits de memória coletados de mensagens com memoryApplied=true.
    const memoryHitsAll = messages.flatMap(
      (m) => (m.memoryApplied === true && Array.isArray(m.memoryHits) ? m.memoryHits : []),
    );
    const memorySummary = memoryHitsAll.length > 0
      ? `${memoryHitsAll.length} entrada(s) aplicada(s): ${memoryHitsAll.slice(0, PLANNER_MAX_MEMORY_HITS).join("; ")}`
      : null;

    // attachments_summary: nomes + summaries de arquivos anexados.
    const attachList = Array.isArray(context?.attachments) ? context.attachments : [];
    const attachmentsSummary = attachList.length > 0
      ? attachList.map((a) => `${a.filename}${a.content_summary ? ` (${a.content_summary.slice(0, PLANNER_ATTACH_SUMMARY_LEN)})` : ""}`).join("; ")
      : null;

    // target: objeto estruturado do contexto operacional.
    const targetObj = context?.target ?? null;

    // constraints: derivadas do modo do target — sempre read_only nesta fase.
    const constraints = {
      mode:                       targetObj?.mode ?? "read_only",
      requires_human_approval:    true,
      auto_execution_blocked:     true,
      destructive_actions_blocked: true,
    };

    // scope/out_of_scope/acceptance_criteria: defaults operacionais seguros.
    const scope = "Leitura e validação do target operacional; diagnóstico sem side-effects.";
    const outOfScope = ["deploy", "escrita", "patch", "deleção", "execução automática sem aprovação"];
    const acceptanceCriteria = [
      "Nenhuma ação destrutiva ou de escrita executada",
      "Aprovação humana obrigatória antes de qualquer execução",
      "Plano derivado do alinhamento real da conversa, não de suposições",
    ];

    const plannerBrief = {
      trigger_message:               triggerMessage,
      operator_intent:               operatorIntent,
      current_state:                 lastEnaviaMsg,
      target:                        targetObj,
      relevant_conversation_summary: conversationSummary || null,
      memory_summary:                memorySummary,
      attachments_summary:           attachmentsSummary,
      constraints,
      scope,
      out_of_scope:                  outOfScope,
      acceptance_criteria:           acceptanceCriteria,
    };

    // Injeta plannerBrief no contexto enriquecido para o backend.
    // O campo `message` recebe apenas o gatilho curto (trigger_message).
    const enrichedContext = {
      ...(context && typeof context === "object" ? context : {}),
      planner_brief: plannerBrief,
    };
    const triggerText = triggerMessage;

    sendingRef.current = true;
    setThinking(true);
    setError(null);

    // P-BRIEF: pre-flight diagnostic log — confirms what the frontend is sending
    console.log("[ENAVIA_DEBUG] runPlannerAction → outgoing", {
      planner_button_clicked: true,
      outgoing_message: triggerText,
      has_planner_brief: true,
      planner_brief_operator_intent_preview: String(operatorIntent || "").slice(0, 120),
      planner_brief_keys: Object.keys(plannerBrief),
      target_present: !!targetObj,
      session_id: getSessionId(),
    });

    const userMsg = makeMsg("user", `📋 Gerar plano: ${trimmed || "(contexto da conversa)"}`);
    setMessages((prev) => [...prev, userMsg]);

    let result;
    try {
      result = await runPlanner(triggerText, enrichedContext);
    } catch (err) {
      const envelope = normalizeError(err, "planner");
      setError(envelope.error.message);
      setThinking(false);
      sendingRef.current = false;
      return;
    }

    // P-BRIEF: post-response diagnostic log — confirms what the backend returned
    console.log("[ENAVIA_DEBUG] runPlannerAction ← response", {
      ok: result.ok,
      canonical_plan_objective: result.data?.planner?.canonicalPlan?.objective ?? null,
      objective_source: result.data?.telemetry?.objective_source ?? "(telemetry not forwarded)",
      has_planner_brief: result.data?.telemetry?.has_planner_brief ?? null,
      raw_message: result.data?.telemetry?.raw_message ?? null,
      resolved_objective: result.data?.telemetry?.resolved_objective ?? null,
      planner_brief_operator_intent_preview: result.data?.telemetry?.planner_brief_operator_intent_preview ?? null,
    });

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

    // P-BRIEF: card display diagnostic log — confirms which field feeds the chat card
    console.log("[ENAVIA_DEBUG] chat card objective", {
      display_objective: objective,
      display_objective_source: planner?.canonicalPlan?.objective
        ? "canonicalPlan.objective"
        : (planner?.classification?.objective ? "classification.objective" : "null"),
      request_text: result.data?.telemetry?.raw_message ?? null,
      canonical_objective: planner?.canonicalPlan?.objective ?? null,
      fallback_used: !planner?.canonicalPlan?.objective,
    });
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
    // Pass operatorIntent as lastChatText so PlanHeader shows the real plan goal,
    // not the short trigger command. Falls back to triggerText only if intent is empty.
    onChatSuccess(operatorIntent || triggerText, planner ?? null);
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
