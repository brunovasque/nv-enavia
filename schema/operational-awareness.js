// ============================================================================
// 🔭 ENAVIA — Operational Awareness (PR4 — Awareness Operacional)
//
// Módulo puro que computa o snapshot de awareness operacional real em runtime.
// Informa ao contexto cognitivo:
//   - estado real do braço Browser (idle/active/disabled/unavailable)
//   - estado real do braço Executor (configurado ou não)
//   - modo de aprovação humana (supervised/autonomous)
//   - distinção canônica: conversa / plano / ação
//
// Escopo: WORKER-ONLY. Pure functions. Sem side-effects. Sem I/O.
//
// Regras de design:
//   - buildOperationalAwareness(env, opts) — constrói o snapshot a partir de env
//     e do estado in-memory do browser arm (passado como parâmetro, nunca importado)
//   - renderOperationalAwarenessBlock(ctx) — gera bloco de texto para system prompt
//   - Sem dependências de outros módulos schema (evita circular imports)
//   - Sem persistência, sem I/O, sem chamadas externas
//
// PR4 APENAS — não misturar com PR5+.
// ============================================================================

// ---------------------------------------------------------------------------
// BROWSER_ARM_STATUS — estados canônicos do braço Browser
// ---------------------------------------------------------------------------
const BROWSER_ARM_STATUS = {
  IDLE:        "idle",
  ACTIVE:      "active",
  DISABLED:    "disabled",
  UNAVAILABLE: "unavailable",
};

// ---------------------------------------------------------------------------
// EXECUTOR_STATUS — estados canônicos do braço Executor
// ---------------------------------------------------------------------------
const EXECUTOR_STATUS = {
  CONFIGURED:   "configured",
  UNCONFIGURED: "unconfigured",
};

// ---------------------------------------------------------------------------
// APPROVAL_MODE — modos de aprovação
// ---------------------------------------------------------------------------
const APPROVAL_MODE = {
  SUPERVISED: "supervised",
  AUTONOMOUS: "autonomous",
};

// ---------------------------------------------------------------------------
// INTERACTION_TYPE — tipos canônicos de interação
// ---------------------------------------------------------------------------
const INTERACTION_TYPE = {
  CONVERSATION: "conversation",
  PLAN:         "plan",
  ACTION:       "action",
};

// ---------------------------------------------------------------------------
// buildOperationalAwareness(env, opts)
//
// Constrói o snapshot de awareness operacional em runtime.
// Puro e determinístico — depende apenas dos parâmetros recebidos.
//
// Parâmetros:
//   env  {object} — env do worker Cloudflare (não persistido, não chamado):
//     BROWSER_EXECUTOR_URL {string}  — URL do executor de browser (vazio = sem browser)
//     EXECUTOR             {object}  — service binding do executor (undefined = sem executor)
//     ENAVIA_MODE          {string}  — "supervised" | "autonomous" (default: "supervised")
//
//   opts {object} — opções opcionais:
//     browserArmState {object} — estado in-memory do browser arm (de getBrowserArmState())
//                                Se não fornecido, usa estado padrão ("idle").
//
// Retorna OperationalAwarenessContext:
//   {
//     browser: {
//       url_configured:   boolean,           // BROWSER_EXECUTOR_URL não vazio
//       status:           string,            // idle | active | disabled | unavailable
//       last_action:      string | null,
//       can_act:          boolean,           // url_configured && status não disabled
//     },
//     executor: {
//       configured:       boolean,           // env.EXECUTOR existe e tem .fetch
//       can_act:          boolean,           // alias de configured
//     },
//     approval: {
//       mode:             string,            // supervised | autonomous
//       human_gate_active: boolean,          // true quando mode=supervised
//     },
//     interaction_types: {
//       conversation:     { label, description },
//       plan:             { label, description },
//       action:           { label, description },
//     },
//   }
// ---------------------------------------------------------------------------
function buildOperationalAwareness(env, opts) {
  const safeEnv = (env && typeof env === "object") ? env : {};
  const safeOpts = (opts && typeof opts === "object") ? opts : {};

  // --- Browser Arm ---
  const browserUrl = typeof safeEnv.BROWSER_EXECUTOR_URL === "string"
    ? safeEnv.BROWSER_EXECUTOR_URL.trim()
    : "";
  const browserUrlConfigured = browserUrl.length > 0;

  // Derive status from passed browserArmState (never imported from contract-executor)
  let browserStatus = BROWSER_ARM_STATUS.IDLE;
  let browserLastAction = null;

  if (!browserUrlConfigured) {
    browserStatus = BROWSER_ARM_STATUS.UNAVAILABLE;
  } else {
    const bState = safeOpts.browserArmState;
    if (bState && typeof bState === "object") {
      const rawStatus = bState.status;
      if (rawStatus === BROWSER_ARM_STATUS.ACTIVE)   browserStatus = BROWSER_ARM_STATUS.ACTIVE;
      else if (rawStatus === BROWSER_ARM_STATUS.DISABLED) browserStatus = BROWSER_ARM_STATUS.DISABLED;
      else browserStatus = BROWSER_ARM_STATUS.IDLE;
      browserLastAction = typeof bState.last_action === "string" ? bState.last_action : null;
    }
  }

  const browserCanAct =
    browserUrlConfigured &&
    browserStatus !== BROWSER_ARM_STATUS.DISABLED &&
    browserStatus !== BROWSER_ARM_STATUS.UNAVAILABLE;

  // --- Executor Arm ---
  const executorConfigured =
    safeEnv.EXECUTOR != null &&
    typeof safeEnv.EXECUTOR === "object" &&
    typeof safeEnv.EXECUTOR.fetch === "function";

  // --- Approval Mode ---
  const rawMode = typeof safeEnv.ENAVIA_MODE === "string"
    ? safeEnv.ENAVIA_MODE.toLowerCase().trim()
    : "";
  const approvalMode = rawMode === "autonomous"
    ? APPROVAL_MODE.AUTONOMOUS
    : APPROVAL_MODE.SUPERVISED;
  const humanGateActive = approvalMode === APPROVAL_MODE.SUPERVISED;

  // --- Interaction types (canonical, never dynamic) ---
  const interactionTypes = {
    [INTERACTION_TYPE.CONVERSATION]: {
      label:       "Conversa",
      description: "Perguntas, cumprimentos, dúvidas, análises pontuais — sem plano e sem execução.",
    },
    [INTERACTION_TYPE.PLAN]: {
      label:       "Plano",
      description: "Pedidos que exigem estruturação de etapas, decomposição de tarefa ou organização de projeto — sem executar ainda.",
    },
    [INTERACTION_TYPE.ACTION]: {
      label:       "Ação",
      description: "Execução real: deploy, navegação browser, push de código, operações irreversíveis — requer braço ativo e aprovação humana quando em modo supervisionado.",
    },
  };

  return {
    browser: {
      url_configured: browserUrlConfigured,
      status:         browserStatus,
      last_action:    browserLastAction,
      can_act:        browserCanAct,
    },
    executor: {
      configured: executorConfigured,
      can_act:    executorConfigured,
    },
    approval: {
      mode:             approvalMode,
      human_gate_active: humanGateActive,
    },
    interaction_types: interactionTypes,
  };
}

// ---------------------------------------------------------------------------
// renderOperationalAwarenessBlock(ctx)
//
// Gera o bloco de texto de awareness operacional para injeção no system prompt.
// Formato: direto, auditável, sem exposição de mecânica interna.
//
// Parâmetros:
//   ctx {object} — saída de buildOperationalAwareness()
//
// Retorna string com o bloco de awareness pronto para composição no prompt.
// ---------------------------------------------------------------------------
function renderOperationalAwarenessBlock(ctx) {
  if (!ctx || typeof ctx !== "object") return "";

  const lines = [];

  lines.push("ESTADO OPERACIONAL REAL (runtime):");

  // Browser arm
  const b = ctx.browser;
  if (b) {
    const browserLine = b.url_configured
      ? `• Braço Browser: ${_browserStatusLabel(b.status)}${b.last_action ? ` (última ação: ${b.last_action})` : ""}.`
      : "• Braço Browser: não disponível neste ambiente (URL não configurada).";
    lines.push(browserLine);

    if (b.url_configured && !b.can_act) {
      lines.push("  → Browser bloqueado. Não pode executar ações de navegação/browser até ser reativado.");
    }
    if (!b.url_configured) {
      lines.push("  → Nunca prometa navegar, clicar ou executar ações de browser neste ambiente.");
    }
  }

  // Executor arm
  const e = ctx.executor;
  if (e) {
    const execLine = e.configured
      ? "• Executor: configurado (pode receber tarefas estruturadas)."
      : "• Executor: não configurado neste ambiente.";
    lines.push(execLine);
    if (!e.configured) {
      lines.push("  → Nunca prometa executar ações via executor neste ambiente.");
    }
  }

  // Approval mode
  const a = ctx.approval;
  if (a) {
    lines.push(
      a.human_gate_active
        ? "• Modo de aprovação: SUPERVISIONADO — toda ação real depende de aprovação humana explícita antes de executar."
        : "• Modo de aprovação: autônomo — execução sem gate obrigatório (use com cautela)."
    );
  }

  // Interaction types
  lines.push("");
  lines.push("DIFERENCIAÇÃO OBRIGATÓRIA DE INTENÇÃO:");
  const it = ctx.interaction_types;
  if (it) {
    for (const def of Object.values(it)) {
      lines.push(`• ${def.label}: ${def.description}`);
    }
  }
  lines.push("");
  lines.push("Regra operacional crítica:");
  lines.push("• Se o pedido é Conversa → responda naturalmente, sem prometer execução.");
  lines.push("• Se o pedido é Plano → estruture internamente, não prometa execução automática.");
  lines.push("• Se o pedido é Ação → verifique se o braço está ativo E se aprovação foi dada.");
  lines.push("• Se braço ou aprovação estão ausentes → diga claramente o que falta, sem fingir capacidade.");

  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// _browserStatusLabel(status)
//
// Retorna label legível para o status do browser arm.
// ---------------------------------------------------------------------------
function _browserStatusLabel(status) {
  switch (status) {
    case BROWSER_ARM_STATUS.IDLE:        return "disponível (ocioso)";
    case BROWSER_ARM_STATUS.ACTIVE:      return "ativo (última execução OK)";
    case BROWSER_ARM_STATUS.DISABLED:    return "desativado (última execução bloqueada)";
    case BROWSER_ARM_STATUS.UNAVAILABLE: return "indisponível (não configurado)";
    default: return "desconhecido";
  }
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  buildOperationalAwareness,
  renderOperationalAwarenessBlock,
  BROWSER_ARM_STATUS,
  EXECUTOR_STATUS,
  APPROVAL_MODE,
  INTERACTION_TYPE,
};
