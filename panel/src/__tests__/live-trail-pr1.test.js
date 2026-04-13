// =============================================================================
// ENAVIA Panel — Nova frente PR1 smoke tests: LiveTrailCard
//
// Smoke tests for "Trilha viva de arquivo/operação atual" (PR1 nova frente).
// Acceptance criteria:
//   1.  Card renderiza sem crash (dados completos)
//   2.  Card renderiza sem crash (liveTrail=null — estado honesto)
//   3.  Campo "arquivo atual" aparece quando presente
//   4.  Campo "função/bloco" aparece quando presente
//   5.  Campo "tipo da operação" aparece quando presente
//   6.  Campo "status atual" aparece quando presente
//   7.  Campo "resumo da ação" aparece quando presente
//   8.  Campos ausentes exibem "sem dado disponível" (honesto)
//   9.  Estado vazio (liveTrail=null) exibe mensagem honesta
//  10.  Estado vazio (liveTrail=undefined) exibe mensagem honesta
//  11.  Badge "DEMO" aparece quando há dados
//  12.  Badge "SEM DADOS" aparece quando liveTrail é null
//  13.  Título "Trilha viva de código" sempre visível (dados presentes)
//  14.  Título "Trilha viva de código" sempre visível (estado vazio)
//  15.  liveTrail={} (objeto vazio) — campos mostram "sem dado disponível"
//  16.  Tipo de operação desconhecido não causa crash
//  17.  Status desconhecido não causa crash
//  18.  Status "running" exibe label "Em execução"
//  19.  Status "done" exibe label "Concluído"
//  20.  Status "error" exibe label "Erro"
//  21.  mockExecution RUNNING inclui campo liveTrail honesto com os 5 campos
//  22.  mockExecution RUNNING liveTrail.file está definido
//  23.  mockExecution RUNNING liveTrail.block está definido
//  24.  mockExecution RUNNING liveTrail.operationType está definido
//  25.  mockExecution RUNNING liveTrail.status está definido
//  26.  mockExecution RUNNING liveTrail.actionSummary está definido
//  27.  mockExecution COMPLETED não tem liveTrail (fora do escopo desta PR)
//  28.  mockExecution IDLE é null (sem liveTrail — correto)
//  29.  Sem regressão de F5-PR3: CodeTrailCard não foi afetado
//  30.  Sem regressão de F5-PR1: OperationalLiveCard não foi afetado
// =============================================================================

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import LiveTrailCard from "../execution/LiveTrailCard.jsx";
import CodeTrailCard from "../execution/CodeTrailCard.jsx";
import OperationalLiveCard from "../execution/OperationalLiveCard.jsx";
import { MOCK_EXECUTIONS, EXECUTION_STATUS } from "../execution/mockExecution.js";

function render(Component, props) {
  return renderToStaticMarkup(createElement(Component, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_LIVE_TRAIL = {
  file: "contract-executor.js",
  block: "resolveStep(stepId, context)",
  operationType: "VALIDATE",
  status: "running",
  actionSummary: "Validando precedências entre etapas e calculando janela de entrega",
};

const PARTIAL_LIVE_TRAIL = {
  file: "contract-executor.js",
  block: null,
  // operationType, status, actionSummary ausentes
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("Nova frente PR1 — LiveTrailCard", () => {
  it("1. renderiza sem crash com dados completos", () => {
    expect(() => render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL })).not.toThrow();
  });

  it("2. renderiza sem crash com liveTrail=null (estado honesto)", () => {
    expect(() => render(LiveTrailCard, { liveTrail: null })).not.toThrow();
  });

  it("3. exibe campo 'arquivo atual' quando presente", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("contract-executor.js");
  });

  it("4. exibe campo 'função/bloco' quando presente", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("resolveStep(stepId, context)");
  });

  it("5. exibe tipo da operação quando presente", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("VALIDATE");
  });

  it("6. exibe status atual quando presente", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("Em execução");
  });

  it("7. exibe resumo da ação quando presente", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("Validando precedências entre etapas");
  });

  it("8. campos ausentes exibem 'sem dado disponível' (honesto)", () => {
    const html = render(LiveTrailCard, { liveTrail: PARTIAL_LIVE_TRAIL });
    expect(html).toContain("sem dado disponível");
  });

  it("9. liveTrail=null exibe mensagem de estado vazio honesto", () => {
    const html = render(LiveTrailCard, { liveTrail: null });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("10. liveTrail=undefined exibe mensagem de estado vazio honesto", () => {
    const html = render(LiveTrailCard, { liveTrail: undefined });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("11. badge 'DEMO' aparece quando há dados", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("DEMO");
  });

  it("12. badge 'SEM DADOS' aparece quando liveTrail é null", () => {
    const html = render(LiveTrailCard, { liveTrail: null });
    expect(html).toContain("SEM DADOS");
  });

  it("13. título 'Trilha viva de código' visível com dados presentes", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("Trilha viva de código");
  });

  it("14. título 'Trilha viva de código' visível em estado vazio", () => {
    const html = render(LiveTrailCard, { liveTrail: null });
    expect(html).toContain("Trilha viva de código");
  });

  it("15. liveTrail={} — campos mostram 'sem dado disponível' (não estado vazio total)", () => {
    const html = render(LiveTrailCard, { liveTrail: {} });
    expect(html).toContain("sem dado disponível");
    expect(html).not.toContain("Nenhuma trilha de código disponível");
  });

  it("16. tipo de operação desconhecido não causa crash", () => {
    expect(() =>
      render(LiveTrailCard, { liveTrail: { ...FULL_LIVE_TRAIL, operationType: "UNKNOWN_OP" } })
    ).not.toThrow();
  });

  it("17. status desconhecido não causa crash", () => {
    expect(() =>
      render(LiveTrailCard, { liveTrail: { ...FULL_LIVE_TRAIL, status: "UNKNOWN_STATUS" } })
    ).not.toThrow();
  });

  it("18. status 'running' exibe label 'Em execução'", () => {
    const html = render(LiveTrailCard, { liveTrail: { ...FULL_LIVE_TRAIL, status: "running" } });
    expect(html).toContain("Em execução");
  });

  it("19. status 'done' exibe label 'Concluído'", () => {
    const html = render(LiveTrailCard, { liveTrail: { ...FULL_LIVE_TRAIL, status: "done" } });
    expect(html).toContain("Concluído");
  });

  it("20. status 'error' exibe label 'Erro'", () => {
    const html = render(LiveTrailCard, { liveTrail: { ...FULL_LIVE_TRAIL, status: "error" } });
    expect(html).toContain("Erro");
  });

  it("21. labels dos 5 campos visíveis na UI", () => {
    const html = render(LiveTrailCard, { liveTrail: FULL_LIVE_TRAIL });
    expect(html).toContain("Arquivo atual");
    expect(html).toContain("Função / bloco");
    expect(html).toContain("Tipo da operação");
    expect(html).toContain("Status atual");
    expect(html).toContain("Resumo da ação");
  });
});

describe("Nova frente PR1 — mockExecution liveTrail shape", () => {
  it("22. mock RUNNING inclui campo liveTrail com os 5 campos", () => {
    const running = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(running).not.toBeNull();
    expect(running.liveTrail).toBeDefined();
  });

  it("23. mock RUNNING liveTrail.file está definido e não vazio", () => {
    const { liveTrail } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(liveTrail.file).toBeTruthy();
  });

  it("24. mock RUNNING liveTrail.block está definido e não vazio", () => {
    const { liveTrail } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(liveTrail.block).toBeTruthy();
  });

  it("25. mock RUNNING liveTrail.operationType está definido e não vazio", () => {
    const { liveTrail } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(liveTrail.operationType).toBeTruthy();
  });

  it("26. mock RUNNING liveTrail.status está definido e não vazio", () => {
    const { liveTrail } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(liveTrail.status).toBeTruthy();
  });

  it("27. mock RUNNING liveTrail.actionSummary está definido e não vazio", () => {
    const { liveTrail } = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(liveTrail.actionSummary).toBeTruthy();
  });

  it("28. mock COMPLETED não tem liveTrail (fora do escopo desta PR)", () => {
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(completed.liveTrail).toBeUndefined();
  });

  it("29. mock IDLE é null (sem liveTrail — correto)", () => {
    expect(MOCK_EXECUTIONS[EXECUTION_STATUS.IDLE]).toBeNull();
  });
});

describe("Nova frente PR1 — sem regressão de F5 e P18", () => {
  it("30a. F5-PR3: CodeTrailCard renderiza normalmente com dados", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].codeTrail;
    expect(() => render(CodeTrailCard, { codeTrail: trail })).not.toThrow();
    const html = render(CodeTrailCard, { codeTrail: trail });
    expect(html).toContain("Código ao vivo");
    expect(html).toContain("contract-executor.js");
  });

  it("30b. F5-PR3: CodeTrailCard renderiza normalmente com null", () => {
    const html = render(CodeTrailCard, { codeTrail: null });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("30c. F5-PR1: OperationalLiveCard renderiza normalmente com dados", () => {
    const op = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].operation;
    expect(() => render(OperationalLiveCard, { operation: op })).not.toThrow();
    const html = render(OperationalLiveCard, { operation: op });
    expect(html).toContain("Operação ao vivo");
  });

  it("30d. F5-PR1: OperationalLiveCard renderiza normalmente com null", () => {
    const html = render(OperationalLiveCard, { operation: null });
    expect(html).toContain("Operação ao vivo");
    expect(html).toContain("SEM DADOS");
  });
});
