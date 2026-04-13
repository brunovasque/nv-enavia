// ============================================================================
// ENAVIA — Mock Browser Session Data
// F5-PR2: Browser Executor — camada explicativa do painel operacional
//
// Estados da sessão do browser executor:
//   idle       — sem sessão ativa
//   navigating — browser navegando para uma URL
//   acting     — browser executando ação (click, fill, extração)
//   waiting    — aguardando carregamento / conteúdo dinâmico
//   blocked    — bloqueado por verificação de segurança ou erro
//   completed  — sessão concluída com sucesso
//
// Regra: nenhum campo é inventado como dado real.
// Estes mocks representam o shape esperado de uma sessão real.
// O domínio operacional de referência é run.nv-imoveis.com/*
// ============================================================================

export const BROWSER_STATUS = {
  IDLE:       "idle",
  NAVIGATING: "navigating",
  ACTING:     "acting",
  WAITING:    "waiting",
  BLOCKED:    "blocked",
  COMPLETED:  "completed",
};

export const BROWSER_STEP_STATUS = {
  DONE:    "done",
  ACTIVE:  "active",
  ERROR:   "error",
  BLOCKED: "blocked",
};

// Domínio operacional de referência — run.nv-imoveis.com/*
export const BROWSER_OPERATIONAL_DOMAIN = "run.nv-imoveis.com";

// ── Helpers ───────────────────────────────────────────────────────────────

export function formatBrowserTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Mock sessions ─────────────────────────────────────────────────────────

export const MOCK_BROWSER_SESSIONS = {
  [BROWSER_STATUS.IDLE]: null,

  [BROWSER_STATUS.NAVIGATING]: {
    sessionId: "sess-br-0x1a2b",
    status: BROWSER_STATUS.NAVIGATING,
    operationalDomain: BROWSER_OPERATIONAL_DOMAIN,
    currentUrl: `https://${BROWSER_OPERATIONAL_DOMAIN}/busca?tipo=apartamento&cidade=Curitiba&dormitorios=2`,
    currentAction: "Navegando para página de busca de imóveis",
    currentTarget: "Página de busca — filtros: apartamento, Curitiba, 2 dormitórios",
    currentSelector: null,
    evidence: "URL carregada: /busca — aguardando renderização da listagem de resultados",
    currentStep: {
      index: 1,
      label: "Navegação para busca",
      description: "Carregando página de busca com filtros configurados",
      startedAt: "2026-04-12T01:48:06Z",
    },
    stepLog: [
      {
        id: "bs1",
        label: "Sessão iniciada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:00Z",
        detail: "Browser executor ativo — sessão sess-br-0x1a2b",
      },
      {
        id: "bs2",
        label: "Configurando filtros de busca",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:03Z",
        detail: "tipo=apartamento, cidade=Curitiba, dormitorios=2",
      },
      {
        id: "bs3",
        label: "Navegação para busca",
        status: BROWSER_STEP_STATUS.ACTIVE,
        timestamp: "2026-04-12T01:48:06Z",
        detail: "Aguardando renderização da listagem",
      },
    ],
    error: null,
  },

  [BROWSER_STATUS.ACTING]: {
    sessionId: "sess-br-0x1a2b",
    status: BROWSER_STATUS.ACTING,
    operationalDomain: BROWSER_OPERATIONAL_DOMAIN,
    currentUrl: `https://${BROWSER_OPERATIONAL_DOMAIN}/imovel/ap-curitiba-batel-412`,
    currentAction: "Extraindo dados do imóvel — título, preço, área, endereço",
    currentTarget: "Card de imóvel — campos estruturados do anúncio",
    currentSelector: ".listing-detail .property-info",
    evidence:
      'Título: "Apartamento 2 dormitórios, Batel, Curitiba" · Preço: R$ 850.000 · Área: 78m²',
    currentStep: {
      index: 3,
      label: "Extração de dados do imóvel",
      description: "Lendo campos estruturados do anúncio selecionado",
      startedAt: "2026-04-12T01:48:18Z",
    },
    stepLog: [
      {
        id: "bs1",
        label: "Sessão iniciada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:00Z",
        detail: "Browser executor ativo — sessão sess-br-0x1a2b",
      },
      {
        id: "bs2",
        label: "Configurando filtros de busca",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:03Z",
        detail: "tipo=apartamento, cidade=Curitiba, dormitorios=2",
      },
      {
        id: "bs3",
        label: "Navegação para busca",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:06Z",
        detail: "12 resultados encontrados na listagem",
      },
      {
        id: "bs4",
        label: "Seleção do imóvel #1",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:14Z",
        detail: 'Click em: "Apartamento 2 dormitórios, Batel"',
      },
      {
        id: "bs5",
        label: "Extração de dados do imóvel",
        status: BROWSER_STEP_STATUS.ACTIVE,
        timestamp: "2026-04-12T01:48:18Z",
        detail: "Lendo título, preço, área e endereço",
      },
    ],
    error: null,
  },

  [BROWSER_STATUS.WAITING]: {
    sessionId: "sess-br-0x1a2b",
    status: BROWSER_STATUS.WAITING,
    operationalDomain: BROWSER_OPERATIONAL_DOMAIN,
    currentUrl: `https://${BROWSER_OPERATIONAL_DOMAIN}/imovel/ap-curitiba-agua-verde-301`,
    currentAction: "Aguardando carregamento — conteúdo dinâmico",
    currentTarget: "Container de fotos — carregamento assíncrono",
    currentSelector: '.gallery-container[data-loaded="true"]',
    evidence:
      "Página base carregada. Aguardando renderização de fotos e dados financeiros via JavaScript.",
    currentStep: {
      index: 4,
      label: "Aguardando conteúdo dinâmico",
      description: "Seletor alvo ainda não visível — aguardando DOM atualizar",
      startedAt: "2026-04-12T01:48:30Z",
    },
    stepLog: [
      {
        id: "bs1",
        label: "Sessão iniciada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:00Z",
        detail: "Browser executor ativo",
      },
      {
        id: "bs2",
        label: "Navegação para imóvel #3",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:28Z",
        detail: "Página base carregada",
      },
      {
        id: "bs3",
        label: "Aguardando conteúdo dinâmico",
        status: BROWSER_STEP_STATUS.ACTIVE,
        timestamp: "2026-04-12T01:48:30Z",
        detail: 'Seletor .gallery-container[data-loaded="true"] aguardado',
      },
    ],
    error: null,
  },

  [BROWSER_STATUS.BLOCKED]: {
    sessionId: "sess-br-0x1a2b",
    status: BROWSER_STATUS.BLOCKED,
    operationalDomain: BROWSER_OPERATIONAL_DOMAIN,
    currentUrl: `https://${BROWSER_OPERATIONAL_DOMAIN}/busca`,
    currentAction: "Bloqueado — verificação de segurança detectada",
    currentTarget: "Página de busca — verificação de acesso",
    currentSelector: "#captcha-challenge",
    evidence:
      "Página retornou verificação de segurança após 3 tentativas de acesso. Requer intervenção manual.",
    currentStep: {
      index: 2,
      label: "Navegação bloqueada",
      description: "Verificação de segurança impediu acesso à listagem",
      startedAt: "2026-04-12T01:48:05Z",
    },
    stepLog: [
      {
        id: "bs1",
        label: "Sessão iniciada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:00Z",
        detail: "Browser executor ativo",
      },
      {
        id: "bs2",
        label: "Tentativa de busca #1",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:05Z",
        detail: "Redirecionado para verificação de segurança",
      },
      {
        id: "bs3",
        label: "Tentativa de busca #2",
        status: BROWSER_STEP_STATUS.ERROR,
        timestamp: "2026-04-12T01:48:12Z",
        detail: "Bloqueio persistiu — challenge não resolvido",
      },
    ],
    error: {
      code: "BROWSER_BLOCKED",
      message:
        "Verificação de segurança detectada na página de busca. O acesso automatizado foi bloqueado após 3 tentativas.",
      recoverable: true,
    },
  },

  [BROWSER_STATUS.COMPLETED]: {
    sessionId: "sess-br-0x1a2b",
    status: BROWSER_STATUS.COMPLETED,
    operationalDomain: BROWSER_OPERATIONAL_DOMAIN,
    currentUrl: `https://${BROWSER_OPERATIONAL_DOMAIN}/imovel/ap-curitiba-batel-412`,
    currentAction: "Sessão concluída — dados extraídos e estruturados",
    currentTarget: null,
    currentSelector: null,
    evidence:
      "5 imóveis analisados · 3 atenderam aos critérios · Dados exportados para o ciclo cognitivo",
    currentStep: {
      index: 6,
      label: "Sessão concluída",
      description: "Todos os passos executados com sucesso",
      startedAt: "2026-04-12T01:48:55Z",
    },
    stepLog: [
      {
        id: "bs1",
        label: "Sessão iniciada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:00Z",
        detail: "Browser executor ativo",
      },
      {
        id: "bs2",
        label: "Configurando filtros",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:03Z",
        detail: "tipo=apartamento, cidade=Curitiba",
      },
      {
        id: "bs3",
        label: "Navegação para busca",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:06Z",
        detail: "12 resultados encontrados",
      },
      {
        id: "bs4",
        label: "Análise de imóveis",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:30Z",
        detail: "5 imóveis analisados, 3 aprovados",
      },
      {
        id: "bs5",
        label: "Exportação de dados",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:52Z",
        detail: "Dados enviados ao ciclo cognitivo",
      },
      {
        id: "bs6",
        label: "Sessão encerrada",
        status: BROWSER_STEP_STATUS.DONE,
        timestamp: "2026-04-12T01:48:55Z",
        detail: "Browser liberado — sessão sess-br-0x1a2b encerrada",
      },
    ],
    error: null,
  },
};
