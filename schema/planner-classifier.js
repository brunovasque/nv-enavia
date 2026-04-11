// ============================================================================
// 📦 ENAVIA — Planner Request Classifier v1 (PM4 — Planner Request Classification)
//
// Classifica pedidos do planner por tipo, complexidade e risco.
//
// Responsabilidades:
//   - classifyRequest(input) — classificador determinístico e auditável
//
// Saída canônica:
//   request_type         — "operational" | "planning" | "strategic"
//   complexity_level     — "A" | "B" | "C"
//   category             — "simple" | "tactical" | "complex"
//   risk_level           — "baixo" | "médio" | "alto"
//   needs_human_approval — boolean
//   signals              — string[] com sinais detectados
//   reason               — string resumida e auditável
//
// Contratos por nível:
//   A (simple)   — baixa ambiguidade, baixo risco, baixa duração
//   B (tactical) — escopo definido, alguma dependência, risco moderado
//   C (complex)  — escopo grande/ambíguo, múltiplas etapas, alto risco
//
// Regras de override:
//   - has_risk_keywords OU context_mentions_prod → needs_human_approval = true
//     mas NÃO obrigam complexity_level = C sozinhos; score total decide o nível.
//
// NÃO contém:
//   - LLM / embeddings / heurística opaca
//   - geração de plano (PM6)
//   - output modes (PM5)
//   - gate humano real (PM7)
//   - bridge com executor (PM8)
//   - learning loop (PM9)
//   - painel / PROD / executor contratual
//
// PM4 APENAS — não misturar com PM5+.
// ============================================================================

// ---------------------------------------------------------------------------
// ENUMS públicos — usados pela saída canônica e pelos testes
// ---------------------------------------------------------------------------
const COMPLEXITY_LEVELS = {
  A: "A",
  B: "B",
  C: "C",
};

const CATEGORIES = {
  SIMPLE:   "simple",
  TACTICAL: "tactical",
  COMPLEX:  "complex",
};

const RISK_LEVELS = {
  BAIXO: "baixo",
  MEDIO: "médio",
  ALTO:  "alto",
};

const REQUEST_TYPES = {
  OPERATIONAL: "operational",
  PLANNING:    "planning",
  STRATEGIC:   "strategic",
};

// ---------------------------------------------------------------------------
// Termos de sinal — listas explícitas, ajustáveis por revisão humana
//
// Cada lista corresponde a um sinal semântico específico.
// Os termos são normalizados para minúsculas antes da comparação.
// ---------------------------------------------------------------------------

// Sinal: pedido expressa ambiguidade ou escopo indefinido
const AMBIGUITY_TERMS = [
  "não sei",
  "talvez",
  "algo assim",
  "tipo",
  "revisão geral",
  "amplo",
  "genérico",
  "abrangente",
  "não tenho certeza",
  "mais ou menos",
  "poderia ser",
  "quem sabe",
  "não está claro",
];

// Sinal: pedido envolve keywords de sistema / arquitetura / infraestrutura
const SYSTEM_TERMS = [
  "deploy",
  "produção",
  "arquitetura",
  "infraestrutura",
  "infra",
  "banco de dados",
  "migrar",
  "migração",
  "pipeline",
  "integração",
  "orquestrar",
  "automação",
  "refatorar",
  "sistema",
  "ambiente",
  "cluster",
  "container",
  "kubernetes",
  "terraform",
  "ci/cd",
];

// Sinal: pedido menciona múltiplas entregas / etapas
const MULTI_DELIVERY_TERMS = [
  "e também",
  "além disso",
  "etapas",
  "fases",
  "módulos",
  "componentes",
  "plano completo",
  "várias",
  "múltiplas",
  "entrega 1",
  "entrega 2",
  "fase 1",
  "fase 2",
  "passo 1",
  "passo 2",
];

// Sinal: pedido menciona risco / impacto relevante
// Ativa needs_human_approval mesmo em score baixo, mas NÃO força nível C.
const RISK_TERMS = [
  "risco",
  "impacto",
  "crítico",
  "urgente",
  "irreversível",
  "dados sensíveis",
  "segurança",
  "compliance",
  "contrato",
  "prod",
  "regulatório",
  "auditoria",
  "vazamento",
  "perda de dados",
];

// Limiar para "texto longo" (palavras)
const THRESHOLD_LONG_TEXT      = 80;
const THRESHOLD_VERY_LONG_TEXT = 200;

// Limiar de marcadores de lista consecutivos que indicam múltiplas entregas
const THRESHOLD_LIST_MARKERS   = 3;

// ---------------------------------------------------------------------------
// _countWords(text)
//
// Conta palavras do texto por split em whitespace.
// ---------------------------------------------------------------------------
function _countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// ---------------------------------------------------------------------------
// _containsAny(text, terms)
//
// Retorna true se o texto (já normalizado) contiver algum dos termos.
// ---------------------------------------------------------------------------
function _containsAny(text, terms) {
  for (const term of terms) {
    if (text.includes(term)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// _countListMarkers(text)
//
// Conta linhas que começam com marcadores de lista (-, *, 1., 2., etc.).
// Usado como indicador de múltiplas entregas estruturadas.
// ---------------------------------------------------------------------------
function _countListMarkers(text) {
  const lines = text.split("\n");
  let count = 0;
  for (const line of lines) {
    if (/^\s*[-*]\s+\S/.test(line) || /^\s*\d+\.\s+\S/.test(line)) {
      count++;
    }
  }
  return count;
}

// ---------------------------------------------------------------------------
// _detectSignals(text, context)
//
// Analisa texto + contexto e retorna objeto de booleans auditáveis.
// Cada boolean corresponde a um sinal semântico distinto.
// ---------------------------------------------------------------------------
function _detectSignals(text, context) {
  const normalized = text.toLowerCase();
  const wordCount   = _countWords(text);
  const listMarkers = _countListMarkers(text);

  const long_text      = wordCount >= THRESHOLD_LONG_TEXT && wordCount < THRESHOLD_VERY_LONG_TEXT;
  const very_long_text = wordCount >= THRESHOLD_VERY_LONG_TEXT;
  const has_ambiguity  = _containsAny(normalized, AMBIGUITY_TERMS);

  const has_system_keywords = _containsAny(normalized, SYSTEM_TERMS);

  const has_multiple_deliveries =
    _containsAny(normalized, MULTI_DELIVERY_TERMS) ||
    listMarkers >= THRESHOLD_LIST_MARKERS;

  const has_risk_keywords = _containsAny(normalized, RISK_TERMS);

  // Sinais contextuais externos (opcionais)
  const ctx = context || {};
  const context_has_dependencies =
    Array.isArray(ctx.known_dependencies) && ctx.known_dependencies.length >= 2;
  const context_mentions_prod = ctx.mentions_prod === true;
  const context_is_urgent     = ctx.is_urgent === true;

  return {
    long_text,
    very_long_text,
    has_ambiguity,
    has_system_keywords,
    has_multiple_deliveries,
    has_risk_keywords,
    context_has_dependencies,
    context_mentions_prod,
    context_is_urgent,
  };
}

// ---------------------------------------------------------------------------
// _score(signals)
//
// Transforma sinais detectados em score numérico.
// Retorna { score, active_signals } onde active_signals é lista auditável.
//
// Tabela de pontuação:
//   very_long_text          → +2
//   long_text               → +1  (mutuamente exclusivo com very_long_text)
//   has_ambiguity           → +1
//   has_system_keywords     → +1
//   has_multiple_deliveries → +2
//   has_risk_keywords       → +2
//   context_has_dependencies→ +1
//   context_mentions_prod   → +2
//   context_is_urgent       → +1
// ---------------------------------------------------------------------------
function _score(signals) {
  const active_signals = [];
  let score = 0;

  if (signals.very_long_text) {
    score += 2;
    active_signals.push("very_long_text");
  } else if (signals.long_text) {
    score += 1;
    active_signals.push("long_text");
  }

  if (signals.has_ambiguity) {
    score += 1;
    active_signals.push("has_ambiguity");
  }

  if (signals.has_system_keywords) {
    score += 1;
    active_signals.push("has_system_keywords");
  }

  if (signals.has_multiple_deliveries) {
    score += 2;
    active_signals.push("has_multiple_deliveries");
  }

  if (signals.has_risk_keywords) {
    score += 2;
    active_signals.push("has_risk_keywords");
  }

  if (signals.context_has_dependencies) {
    score += 1;
    active_signals.push("context_has_dependencies");
  }

  if (signals.context_mentions_prod) {
    score += 2;
    active_signals.push("context_mentions_prod");
  }

  if (signals.context_is_urgent) {
    score += 1;
    active_signals.push("context_is_urgent");
  }

  return { score, active_signals };
}

// ---------------------------------------------------------------------------
// _buildReason(level, active_signals)
//
// Gera reason curta e auditável baseada no nível e nos sinais ativos.
// Formato: "classificado como <X> por <lista de sinais ativos>"
// ---------------------------------------------------------------------------
const _SIGNAL_LABELS = {
  very_long_text:           "texto muito extenso",
  long_text:                "texto extenso",
  has_ambiguity:            "ambiguidade detectada",
  has_system_keywords:      "termos de sistema",
  has_multiple_deliveries:  "múltiplas entregas",
  has_risk_keywords:        "sinais de risco",
  context_has_dependencies: "dependências externas",
  context_mentions_prod:    "menção a PROD",
  context_is_urgent:        "urgência sinalizada",
};

function _buildReason(level, active_signals) {
  if (active_signals.length === 0) {
    return `classificado como ${level} por baixo escopo e baixo risco`;
  }
  const labels = active_signals.map((s) => _SIGNAL_LABELS[s] || s).join(", ");
  return `classificado como ${level} por ${labels}`;
}

// ---------------------------------------------------------------------------
// classifyRequest(input)
//
// Classificador público e determinístico do pedido do planner.
//
// Parâmetros:
//   input.text     {string}  — texto do pedido (obrigatório)
//   input.context  {object}  — contexto estrutural opcional:
//     known_dependencies {string[]} — dependências conhecidas
//     mentions_prod      {boolean}  — pedido menciona PROD explicitamente
//     is_urgent          {boolean}  — pedido marcado como urgente externamente
//
// Retorna:
//   {
//     request_type:         string,
//     complexity_level:     "A" | "B" | "C",
//     category:             "simple" | "tactical" | "complex",
//     risk_level:           "baixo" | "médio" | "alto",
//     needs_human_approval: boolean,
//     signals:              string[],
//     reason:               string,
//   }
//
// Regras de classificação por score:
//   0–1 → A / simple  / baixo / needs_human_approval = false
//   2–3 → B / tactical / médio
//   ≥ 4 → C / complex  / alto  / needs_human_approval = true
//
// Override needs_human_approval:
//   has_risk_keywords OU context_mentions_prod → needs_human_approval = true
//   (independente do nível, mas sem forçar complexity = C sozinhos)
// ---------------------------------------------------------------------------
function classifyRequest(input) {
  if (!input || typeof input.text !== "string" || input.text.trim() === "") {
    throw new Error(
      "classifyRequest: 'input.text' é obrigatório e deve ser string não vazia"
    );
  }

  const signals = _detectSignals(input.text, input.context);
  const { score, active_signals } = _score(signals);

  // --- Complexidade por score ---
  let complexity_level;
  let category;
  let risk_level;
  let needs_human_approval;

  if (score <= 1) {
    complexity_level     = COMPLEXITY_LEVELS.A;
    category             = CATEGORIES.SIMPLE;
    risk_level           = RISK_LEVELS.BAIXO;
    needs_human_approval = false;
  } else if (score <= 3) {
    complexity_level     = COMPLEXITY_LEVELS.B;
    category             = CATEGORIES.TACTICAL;
    risk_level           = RISK_LEVELS.MEDIO;
    needs_human_approval = false;
  } else {
    complexity_level     = COMPLEXITY_LEVELS.C;
    category             = CATEGORIES.COMPLEX;
    risk_level           = RISK_LEVELS.ALTO;
    needs_human_approval = true;
  }

  // --- Override de needs_human_approval ---
  // has_risk_keywords e context_mentions_prod sobem o gate, mas NÃO
  // alteram complexity_level sozinhos — o score já os pontuou.
  if (signals.has_risk_keywords || signals.context_mentions_prod) {
    needs_human_approval = true;
  }

  // --- request_type derivado do nível ---
  const request_type_map = {
    [COMPLEXITY_LEVELS.A]: REQUEST_TYPES.OPERATIONAL,
    [COMPLEXITY_LEVELS.B]: REQUEST_TYPES.PLANNING,
    [COMPLEXITY_LEVELS.C]: REQUEST_TYPES.STRATEGIC,
  };
  const request_type = request_type_map[complexity_level];

  // --- reason ---
  const reason = _buildReason(complexity_level, active_signals);

  return {
    request_type,
    complexity_level,
    category,
    risk_level,
    needs_human_approval,
    signals: active_signals,
    reason,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  classifyRequest,
  COMPLEXITY_LEVELS,
  CATEGORIES,
  RISK_LEVELS,
  REQUEST_TYPES,
};
