// =============================================================================
// ENAVIA Panel — Nova frente PR2 smoke tests: IncrementalDiffCard
//
// Smoke tests para "Diff incremental visual" (PR2 nova frente).
// Critérios de aceite:
//   1.  Card renderiza sem crash (dados completos)
//   2.  Card renderiza sem crash (incrementalDiff=null — estado honesto)
//   3.  Card renderiza sem crash (incrementalDiff=undefined — estado honesto)
//   4.  Linha adicionada (+) aparece em verde quando presente
//   5.  Linha removida (−) aparece corretamente quando presente
//   6.  Linha neutra aparece corretamente quando presente
//   7.  Resumo da mudança aparece quando presente
//   8.  Estado vazio exibe mensagem honesta (null)
//   9.  Estado vazio exibe mensagem honesta (undefined)
//  10.  Badge "DEMO" aparece quando há dados
//  11.  Badge "SEM DADOS" aparece quando incrementalDiff é null
//  12.  Título "Diff em andamento" sempre visível (dados presentes)
//  13.  Título "Diff em andamento" sempre visível (estado vazio)
//  14.  Contadores +N e −N aparecem quando há linhas
//  15.  Campo "arquivo" aparece quando presente
//  16.  Campo "bloco" aparece quando presente
//  17.  Ausência de linhas exibe mensagem honesta (array vazio)
//  18.  Ausência de resumo exibe "sem dado disponível"
//  19.  lines=null não causa crash
//  20.  incrementalDiff={} (objeto vazio) renderiza sem crash e mostra estado honesto parcial
//  21.  mockExecution RUNNING inclui campo incrementalDiff com shape correto
//  22.  mock RUNNING incrementalDiff.file está definido
//  23.  mock RUNNING incrementalDiff.block está definido
//  24.  mock RUNNING incrementalDiff.lines é array com ao menos 1 linha
//  25.  mock RUNNING incrementalDiff tem ao menos 1 linha 'add'
//  26.  mock RUNNING incrementalDiff tem ao menos 1 linha 'remove'
//  27.  mock RUNNING incrementalDiff.changeSummary está definido e não vazio
//  28.  mock COMPLETED não tem incrementalDiff (fora do escopo desta PR)
//  29.  mock IDLE é null (sem incrementalDiff — correto)
//  30.  Sem regressão PR1: LiveTrailCard renderiza normalmente com dados
//  31.  Sem regressão PR1: LiveTrailCard renderiza normalmente com null
//  32.  Sem regressão F5: CodeTrailCard renderiza normalmente com dados
//  33.  Sem regressão P18: UnifiedReplayBlock renderiza sem crash
// =============================================================================

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import IncrementalDiffCard from "../execution/IncrementalDiffCard.jsx";
import LiveTrailCard from "../execution/LiveTrailCard.jsx";
import CodeTrailCard from "../execution/CodeTrailCard.jsx";
import UnifiedReplayBlock from "../execution/UnifiedReplayBlock.jsx";
import { MOCK_EXECUTIONS, EXECUTION_STATUS } from "../execution/mockExecution.js";

function render(Component, props) {
  return renderToStaticMarkup(createElement(Component, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_DIFF = {
  file: "contract-executor.js",
  block: "resolveStep(stepId, context)",
  lines: [
    { type: "neutral", content: "function resolveStep(stepId, context) {" },
    { type: "remove",  content: "  // lógica anterior de contagem inline removida" },
    { type: "add",     content: "  stepsCompleted += 1;" },
    { type: "add",     content: "  validatePrecedences(context.steps);" },
    { type: "neutral", content: "}" },
  ],
  changeSummary: "Contagem de etapas ajustada; precedências validadas",
};

const NO_SUMMARY_DIFF = {
  ...FULL_DIFF,
  changeSummary: null,
};

const EMPTY_LINES_DIFF = {
  ...FULL_DIFF,
  lines: [],
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Nova frente PR2 — IncrementalDiffCard", () => {
  it("1. renderiza sem crash com dados completos", () => {
    expect(() => render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF })).not.toThrow();
  });

  it("2. renderiza sem crash com incrementalDiff=null (estado honesto)", () => {
    expect(() => render(IncrementalDiffCard, { incrementalDiff: null })).not.toThrow();
  });

  it("3. renderiza sem crash com incrementalDiff=undefined (estado honesto)", () => {
    expect(() => render(IncrementalDiffCard, { incrementalDiff: undefined })).not.toThrow();
  });

  it("4. linha adicionada (+) aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("stepsCompleted += 1;");
    expect(html).toContain("validatePrecedences(context.steps);");
  });

  it("5. linha removida (−) aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("lógica anterior de contagem inline removida");
  });

  it("6. linha neutra aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("function resolveStep(stepId, context)");
  });

  it("7. resumo da mudança aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("Contagem de etapas ajustada");
  });

  it("8. incrementalDiff=null exibe mensagem de estado vazio honesto", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: null });
    expect(html).toContain("Nenhum diff incremental disponível");
  });

  it("9. incrementalDiff=undefined exibe mensagem de estado vazio honesto", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: undefined });
    expect(html).toContain("Nenhum diff incremental disponível");
  });

  it("10. badge 'DEMO' aparece quando há dados", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("DEMO");
  });

  it("11. badge 'SEM DADOS' aparece quando incrementalDiff é null", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: null });
    expect(html).toContain("SEM DADOS");
  });

  it("12. título 'Diff em andamento' visível com dados presentes", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("Diff em andamento");
  });

  it("13. título 'Diff em andamento' visível em estado vazio", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: null });
    expect(html).toContain("Diff em andamento");
  });

  it("14. contadores +N e −N aparecem quando há linhas add/remove", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("+2");
    expect(html).toContain("−1");
  });

  it("15. campo 'arquivo' aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("contract-executor.js");
  });

  it("16. campo 'bloco' aparece quando presente", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: FULL_DIFF });
    expect(html).toContain("resolveStep(stepId, context)");
  });

  it("17. array de linhas vazio exibe mensagem honesta", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: EMPTY_LINES_DIFF });
    expect(html).toContain("sem linhas de diff disponíveis");
  });

  it("18. ausência de resumo exibe 'sem dado disponível'", () => {
    const html = render(IncrementalDiffCard, { incrementalDiff: NO_SUMMARY_DIFF });
    expect(html).toContain("sem dado disponível");
  });

  it("19. lines=null não causa crash", () => {
    expect(() =>
      render(IncrementalDiffCard, { incrementalDiff: { ...FULL_DIFF, lines: null } })
    ).not.toThrow();
  });

  it("20. incrementalDiff={} renderiza sem crash e mostra estado parcial", () => {
    expect(() => render(IncrementalDiffCard, { incrementalDiff: {} })).not.toThrow();
    const html = render(IncrementalDiffCard, { incrementalDiff: {} });
    // não mostra estado vazio total (o objeto existe), mas campos ausentes aparecem
    expect(html).not.toContain("Nenhum diff incremental disponível");
  });
});

describe("Nova frente PR2 — mockExecution incrementalDiff shape", () => {
  it("21. mock RUNNING inclui campo incrementalDiff com shape correto", () => {
    const running = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(running).not.toBeNull();
    expect(running.incrementalDiff).toBeDefined();
    expect(typeof running.incrementalDiff).toBe("object");
  });

  it("22. mock RUNNING incrementalDiff.file está definido e não vazio", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(incrementalDiff.file).toBeTruthy();
  });

  it("23. mock RUNNING incrementalDiff.block está definido e não vazio", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(incrementalDiff.block).toBeTruthy();
  });

  it("24. mock RUNNING incrementalDiff.lines é array com ao menos 1 linha", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(Array.isArray(incrementalDiff.lines)).toBe(true);
    expect(incrementalDiff.lines.length).toBeGreaterThan(0);
  });

  it("25. mock RUNNING incrementalDiff tem ao menos 1 linha 'add'", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(incrementalDiff.lines.some((l) => l.type === "add")).toBe(true);
  });

  it("26. mock RUNNING incrementalDiff tem ao menos 1 linha 'remove'", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(incrementalDiff.lines.some((l) => l.type === "remove")).toBe(true);
  });

  it("27. mock RUNNING incrementalDiff.changeSummary está definido e não vazio", () => {
    const { incrementalDiff } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(incrementalDiff.changeSummary).toBeTruthy();
  });

  it("28. mock COMPLETED não tem incrementalDiff (fora do escopo desta PR)", () => {
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(completed.incrementalDiff).toBeUndefined();
  });

  it("29. mock IDLE é null (sem incrementalDiff — correto)", () => {
    expect(MOCK_EXECUTIONS[EXECUTION_STATUS.IDLE]).toBeNull();
  });
});

describe("Nova frente PR2 — sem regressão de PR1, F5, P18", () => {
  it("30. PR1: LiveTrailCard renderiza normalmente com dados", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].liveTrail;
    expect(() => render(LiveTrailCard, { liveTrail: trail })).not.toThrow();
    const html = render(LiveTrailCard, { liveTrail: trail });
    expect(html).toContain("Trilha viva de código");
    expect(html).toContain("contract-executor.js");
  });

  it("31. PR1: LiveTrailCard renderiza normalmente com null", () => {
    const html = render(LiveTrailCard, { liveTrail: null });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("32. F5: CodeTrailCard renderiza normalmente com dados", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].codeTrail;
    expect(() => render(CodeTrailCard, { codeTrail: trail })).not.toThrow();
    const html = render(CodeTrailCard, { codeTrail: trail });
    expect(html).toContain("Código ao vivo");
  });

  it("33. P18: UnifiedReplayBlock renderiza sem crash", () => {
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
