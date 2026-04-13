// =============================================================================
// ENAVIA Panel — Nova frente PR3 smoke tests: ConsolidatedFeedCard
//
// Smoke tests para "Feed consolidado + resumo limpo" (PR3 nova frente).
// Critérios de aceite:
//   1.  Card renderiza sem crash (dados completos)
//   2.  Card renderiza sem crash (changeHistory=null — estado honesto)
//   3.  Card renderiza sem crash (changeHistory=undefined — estado honesto)
//   4.  Card renderiza sem crash (changeHistory=[] — estado vazio honesto)
//   5.  Título "Feed de mudanças" sempre visível (dados presentes)
//   6.  Título "Feed de mudanças" sempre visível (estado vazio)
//   7.  Badge "DEMO" aparece quando há dados
//   8.  Badge "SEM DADOS" aparece quando changeHistory é null
//   9.  Badge "SEM DADOS" aparece quando changeHistory é array vazio
//  10.  Estado vazio exibe mensagem honesta (null)
//  11.  Estado vazio exibe mensagem honesta ([])
//  12.  Nome do arquivo aparece agrupado no feed
//  13.  Resumo curto da mudança aparece
//  14.  Status "Aplicado" aparece para mudança aplicada
//  15.  Status "Pendente" aparece para mudança pendente
//  16.  Contador +N aparece para mudanças com linhas adicionadas
//  17.  Contador −N aparece para mudanças com linhas removidas
//  18.  Patch status "Aplicado" no grupo aparece quando patchStatus=applied
//  19.  Patch status "Parcial" no grupo aparece quando patchStatus=partial
//  20.  Patch status "Pendente" no grupo aparece quando patchStatus=pending
//  21.  Resumo do patch (footer) aparece com dados
//  22.  Contagem de aplicadas no resumo do patch
//  23.  Contagem de pendentes no resumo do patch
//  24.  Múltiplos grupos de arquivo renderizam todos
//  25.  Grupo sem mudanças renderiza estado honesto
//  26.  Mudança sem resumo exibe "sem resumo disponível"
//  27.  Mudança sem timestamp de pendente exibe honestamente
//  28.  mockExecution RUNNING inclui campo changeHistory
//  29.  mock RUNNING changeHistory é array com ao menos 1 grupo
//  30.  mock RUNNING changeHistory[0].file está definido
//  31.  mock RUNNING changeHistory[0].patchStatus está definido
//  32.  mock RUNNING changeHistory[0].changes é array não vazio
//  33.  mock RUNNING tem mudança com status="applied"
//  34.  mock RUNNING tem mudança com status="pending"
//  35.  mock COMPLETED não tem changeHistory (fora do escopo desta PR)
//  36.  mock IDLE é null (sem changeHistory — correto)
//  37.  Sem regressão PR2: IncrementalDiffCard renderiza normalmente
//  38.  Sem regressão PR1: LiveTrailCard renderiza normalmente
//  39.  Sem regressão F5: CodeTrailCard renderiza normalmente
//  40.  Sem regressão P18: UnifiedReplayBlock renderiza sem crash
// =============================================================================

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ConsolidatedFeedCard from "../execution/ConsolidatedFeedCard.jsx";
import IncrementalDiffCard from "../execution/IncrementalDiffCard.jsx";
import LiveTrailCard from "../execution/LiveTrailCard.jsx";
import CodeTrailCard from "../execution/CodeTrailCard.jsx";
import UnifiedReplayBlock from "../execution/UnifiedReplayBlock.jsx";
import { MOCK_EXECUTIONS, EXECUTION_STATUS } from "../execution/mockExecution.js";

function render(Component, props) {
  return renderToStaticMarkup(createElement(Component, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_HISTORY = [
  {
    file: "contract-executor.js",
    patchStatus: "partial",
    changes: [
      {
        id: "ch1",
        seq: 1,
        summary: "Contagem de etapas ajustada",
        status: "applied",
        addedLines: 1,
        removedLines: 1,
        ts: "2026-04-12T01:52:10Z",
      },
      {
        id: "ch2",
        seq: 2,
        summary: "Validação de precedências adicionada",
        status: "applied",
        addedLines: 1,
        removedLines: 0,
        ts: "2026-04-12T01:52:18Z",
      },
      {
        id: "ch3",
        seq: 3,
        summary: "Serialização do plano canônico pendente",
        status: "pending",
        addedLines: 3,
        removedLines: 0,
        ts: null,
      },
    ],
  },
  {
    file: "planner-store.js",
    patchStatus: "pending",
    changes: [
      {
        id: "ch4",
        seq: 1,
        summary: "Atualização do estado de progresso",
        status: "pending",
        addedLines: 2,
        removedLines: 1,
        ts: null,
      },
    ],
  },
];

const SINGLE_APPLIED = [
  {
    file: "utils.js",
    patchStatus: "applied",
    changes: [
      {
        id: "u1",
        seq: 1,
        summary: "Correção de tipagem",
        status: "applied",
        addedLines: 0,
        removedLines: 2,
        ts: "2026-04-12T01:50:00Z",
      },
    ],
  },
];

const GROUP_NO_CHANGES = [
  {
    file: "empty-file.js",
    patchStatus: "pending",
    changes: [],
  },
];

const CHANGE_NO_SUMMARY = [
  {
    file: "x.js",
    patchStatus: "pending",
    changes: [
      {
        id: "ns1",
        seq: 1,
        summary: null,
        status: "pending",
        addedLines: 0,
        removedLines: 0,
        ts: null,
      },
    ],
  },
];

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Nova frente PR3 — ConsolidatedFeedCard renderização básica", () => {
  it("1. renderiza sem crash com dados completos", () => {
    expect(() =>
      render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY })
    ).not.toThrow();
  });

  it("2. renderiza sem crash com changeHistory=null", () => {
    expect(() =>
      render(ConsolidatedFeedCard, { changeHistory: null })
    ).not.toThrow();
  });

  it("3. renderiza sem crash com changeHistory=undefined", () => {
    expect(() =>
      render(ConsolidatedFeedCard, { changeHistory: undefined })
    ).not.toThrow();
  });

  it("4. renderiza sem crash com changeHistory=[]", () => {
    expect(() =>
      render(ConsolidatedFeedCard, { changeHistory: [] })
    ).not.toThrow();
  });

  it("5. título 'Feed de mudanças' visível com dados", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Feed de mudanças");
  });

  it("6. título 'Feed de mudanças' visível em estado vazio", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: null });
    expect(html).toContain("Feed de mudanças");
  });
});

describe("Nova frente PR3 — ConsolidatedFeedCard badges e estado honesto", () => {
  it("7. badge 'DEMO' aparece quando há dados", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("DEMO");
  });

  it("8. badge 'SEM DADOS' aparece quando changeHistory é null", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: null });
    expect(html).toContain("SEM DADOS");
  });

  it("9. badge 'SEM DADOS' aparece quando changeHistory é array vazio", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: [] });
    expect(html).toContain("SEM DADOS");
  });

  it("10. estado vazio exibe mensagem honesta (null)", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: null });
    expect(html).toContain("Nenhum histórico de mudanças disponível");
  });

  it("11. estado vazio exibe mensagem honesta ([])", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: [] });
    expect(html).toContain("Nenhum histórico de mudanças disponível");
  });
});

describe("Nova frente PR3 — ConsolidatedFeedCard conteúdo do feed", () => {
  it("12. nome do arquivo aparece agrupado no feed", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("contract-executor.js");
    expect(html).toContain("planner-store.js");
  });

  it("13. resumo curto da mudança aparece", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Contagem de etapas ajustada");
    expect(html).toContain("Validação de precedências adicionada");
  });

  it("14. status 'Aplicado' aparece para mudança aplicada", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Aplicado");
  });

  it("15. status 'Pendente' aparece para mudança pendente", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Pendente");
  });

  it("16. contador +N aparece para mudanças com linhas adicionadas", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("+1");
    expect(html).toContain("+3");
  });

  it("17. contador −N aparece para mudanças com linhas removidas", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("−1");
  });

  it("18. patch status 'Aplicado' no grupo quando patchStatus=applied", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: SINGLE_APPLIED });
    // Badge in the group header
    expect(html).toContain("Aplicado");
  });

  it("19. patch status 'Parcial' no grupo quando patchStatus=partial", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Parcial");
  });

  it("20. patch status 'Pendente' no grupo quando patchStatus=pending", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Pendente");
  });
});

describe("Nova frente PR3 — ConsolidatedFeedCard resumo do patch", () => {
  it("21. resumo do patch (footer) aparece quando há dados", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("Resumo do patch");
  });

  it("22. contagem de aplicadas aparece no resumo do patch", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    // 2 applied changes in FULL_HISTORY
    expect(html).toContain("2 aplicadas");
  });

  it("23. contagem de pendentes aparece no resumo do patch", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    // 2 pending changes in FULL_HISTORY
    expect(html).toContain("2 pendentes");
  });
});

describe("Nova frente PR3 — ConsolidatedFeedCard edge cases", () => {
  it("24. múltiplos grupos de arquivo renderizam todos", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: FULL_HISTORY });
    expect(html).toContain("contract-executor.js");
    expect(html).toContain("planner-store.js");
  });

  it("25. grupo sem mudanças exibe estado honesto", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: GROUP_NO_CHANGES });
    expect(html).toContain("sem mudanças registradas");
  });

  it("26. mudança sem resumo exibe 'sem resumo disponível'", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: CHANGE_NO_SUMMARY });
    expect(html).toContain("sem resumo disponível");
  });

  it("27. mudança pendente sem timestamp exibe honestamente", () => {
    const html = render(ConsolidatedFeedCard, { changeHistory: CHANGE_NO_SUMMARY });
    expect(html).toContain("sem timestamp");
  });
});

describe("Nova frente PR3 — mockExecution changeHistory shape", () => {
  it("28. mock RUNNING inclui campo changeHistory", () => {
    const running = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(running).not.toBeNull();
    expect(running.changeHistory).toBeDefined();
  });

  it("29. mock RUNNING changeHistory é array com ao menos 1 grupo", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(Array.isArray(changeHistory)).toBe(true);
    expect(changeHistory.length).toBeGreaterThan(0);
  });

  it("30. mock RUNNING changeHistory[0].file está definido e não vazio", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(changeHistory[0].file).toBeTruthy();
  });

  it("31. mock RUNNING changeHistory[0].patchStatus está definido", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(changeHistory[0].patchStatus).toBeTruthy();
  });

  it("32. mock RUNNING changeHistory[0].changes é array não vazio", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(Array.isArray(changeHistory[0].changes)).toBe(true);
    expect(changeHistory[0].changes.length).toBeGreaterThan(0);
  });

  it("33. mock RUNNING tem mudança com status='applied'", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    const allChanges = changeHistory.flatMap((g) => g.changes);
    expect(allChanges.some((c) => c.status === "applied")).toBe(true);
  });

  it("34. mock RUNNING tem mudança com status='pending'", () => {
    const { changeHistory } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    const allChanges = changeHistory.flatMap((g) => g.changes);
    expect(allChanges.some((c) => c.status === "pending")).toBe(true);
  });

  it("35. mock COMPLETED não tem changeHistory (fora do escopo desta PR)", () => {
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(completed.changeHistory).toBeUndefined();
  });

  it("36. mock IDLE é null (sem changeHistory — correto)", () => {
    expect(MOCK_EXECUTIONS[EXECUTION_STATUS.IDLE]).toBeNull();
  });
});

describe("Nova frente PR3 — sem regressão de PR1, PR2, F5, P18", () => {
  it("37. PR2: IncrementalDiffCard renderiza normalmente com dados", () => {
    const diff = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].incrementalDiff;
    expect(() =>
      render(IncrementalDiffCard, { incrementalDiff: diff })
    ).not.toThrow();
    const html = render(IncrementalDiffCard, { incrementalDiff: diff });
    expect(html).toContain("Diff em andamento");
    expect(html).toContain("contract-executor.js");
  });

  it("38. PR1: LiveTrailCard renderiza normalmente com dados", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].liveTrail;
    expect(() =>
      render(LiveTrailCard, { liveTrail: trail })
    ).not.toThrow();
    const html = render(LiveTrailCard, { liveTrail: trail });
    expect(html).toContain("Trilha viva de código");
    expect(html).toContain("contract-executor.js");
  });

  it("39. F5: CodeTrailCard renderiza normalmente com dados", () => {
    const codeTrail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].codeTrail;
    expect(() =>
      render(CodeTrailCard, { codeTrail })
    ).not.toThrow();
    const html = render(CodeTrailCard, { codeTrail });
    expect(html).toContain("Código ao vivo");
  });

  it("40. P18: UnifiedReplayBlock renderiza sem crash", () => {
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(() =>
      render(UnifiedReplayBlock, {
        events: completed.events,
        browserEvents: completed.browserEvents,
        codeEvents: completed.codeEvents,
        executionSummary: completed.executionSummary,
      })
    ).not.toThrow();
  });
});
