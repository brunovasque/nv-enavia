// =============================================================================
// ENAVIA Panel — F5-PR3 smoke tests: CodeTrailCard
//
// Verifica acceptance criteria da Frente 5 PR3 — Observabilidade de Código:
//   1. Card renderiza sem crash (dados completos)
//   2. Card renderiza sem crash (codeTrail null — estado honesto)
//   3. Campo "arquivo atual" é exibido quando presente
//   4. Campo "função/bloco" é exibido quando presente
//   5. Campo "tipo da operação" é exibido quando presente
//   6. Diff resumido renderiza e exibe linhas + e -
//   7. Campo "justificativa" é exibido quando presente
//   8. Campo "fora do escopo" é exibido quando presente
//   9. Campos ausentes exibem "sem dado disponível" (honesto)
//  10. Estado vazio (codeTrail=null) exibe mensagem honesta
//  11. Badge "DEMO" aparece quando há dados
//  12. Badge "SEM DADOS" aparece quando codeTrail é null
//  13. Título "Código ao vivo" sempre visível (dados presentes)
//  14. Título "Código ao vivo" sempre visível (estado vazio)
//  15. codeTrail={} (objeto vazio) — campos mostram "sem dado disponível"
//  16. Tipo de operação desconhecido não causa crash
//  17. Sem regressão de F5-PR1 (OperationalLiveCard não afetado)
//  18. mockExecution RUNNING inclui campo codeTrail honesto
//  19. mockExecution COMPLETED não inclui codeTrail (está fora do escopo)
//  20. mockExecution IDLE é null (sem codeTrail — correto)
// =============================================================================

import { describe, it, expect } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CodeTrailCard from "../execution/CodeTrailCard.jsx";
import OperationalLiveCard from "../execution/OperationalLiveCard.jsx";
import { MOCK_EXECUTIONS, EXECUTION_STATUS } from "../execution/mockExecution.js";

function render(Component, props) {
  return renderToStaticMarkup(createElement(Component, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_CODE_TRAIL = {
  file: "contract-executor.js",
  block: "resolveStep(stepId, context)",
  operationType: "VALIDATE",
  diffSummary:
    "+  stepsCompleted += 1;\n" +
    "+  validatePrecedences(context.steps);\n" +
    "-  // lógica anterior de contagem inline removida",
  justification:
    "Contagem de etapas ajustada para refletir estado atual do ciclo cognitivo",
  outOfScope: "Replay completo · Worker integration · noVNC",
};

const PARTIAL_CODE_TRAIL = {
  file: "contract-executor.js",
  block: null,
  // operationType, diffSummary, justification, outOfScope ausentes
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("F5-PR3 — CodeTrailCard", () => {
  it("1. renderiza sem crash com dados completos", () => {
    expect(() => render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL })).not.toThrow();
  });

  it("2. renderiza sem crash com codeTrail=null (estado honesto)", () => {
    expect(() => render(CodeTrailCard, { codeTrail: null })).not.toThrow();
  });

  it("3. exibe campo 'arquivo atual' quando presente", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("contract-executor.js");
  });

  it("4. exibe campo 'função/bloco' quando presente", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("resolveStep(stepId, context)");
  });

  it("5. exibe tipo da operação quando presente", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("VALIDATE");
  });

  it("6. diff resumido renderiza e contém linhas +/-", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("stepsCompleted");
    expect(html).toContain("validatePrecedences");
    expect(html).toContain("lógica anterior");
  });

  it("7. exibe campo 'justificativa' quando presente", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("Contagem de etapas ajustada");
  });

  it("8. exibe campo 'fora do escopo' quando presente", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("Replay completo");
  });

  it("9. campos ausentes exibem 'sem dado disponível' (honesto)", () => {
    const html = render(CodeTrailCard, { codeTrail: PARTIAL_CODE_TRAIL });
    expect(html).toContain("sem dado disponível");
  });

  it("9. campo 'bloco' null exibe 'sem dado disponível'", () => {
    const html = render(CodeTrailCard, { codeTrail: { ...FULL_CODE_TRAIL, block: null } });
    expect(html).toContain("sem dado disponível");
  });

  it("10. codeTrail=null exibe mensagem de estado vazio honesto", () => {
    const html = render(CodeTrailCard, { codeTrail: null });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("10. codeTrail=undefined exibe mensagem de estado vazio honesto", () => {
    const html = render(CodeTrailCard, { codeTrail: undefined });
    expect(html).toContain("Nenhuma trilha de código disponível");
  });

  it("11. badge 'DEMO' aparece quando há dados", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("DEMO");
  });

  it("12. badge 'SEM DADOS' aparece quando codeTrail é null", () => {
    const html = render(CodeTrailCard, { codeTrail: null });
    expect(html).toContain("SEM DADOS");
  });

  it("13. título 'Código ao vivo' sempre visível (dados presentes)", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("Código ao vivo");
  });

  it("14. título 'Código ao vivo' sempre visível (estado vazio)", () => {
    const html = render(CodeTrailCard, { codeTrail: null });
    expect(html).toContain("Código ao vivo");
  });

  it("15. codeTrail={} — campos mostram 'sem dado disponível' (não estado vazio total)", () => {
    const html = render(CodeTrailCard, { codeTrail: {} });
    expect(html).toContain("sem dado disponível");
    expect(html).not.toContain("Nenhuma trilha de código disponível");
  });

  it("16. tipo de operação desconhecido não causa crash", () => {
    expect(() =>
      render(CodeTrailCard, { codeTrail: { ...FULL_CODE_TRAIL, operationType: "UNKNOWN_TYPE" } })
    ).not.toThrow();
  });

  it("17a. sem regressão F5-PR1: OperationalLiveCard renderiza normalmente (dados)", () => {
    expect(() =>
      render(OperationalLiveCard, {
        operation: { action: "test", contract: "c1", microStep: "m", reason: "r", nextStep: "n" },
      })
    ).not.toThrow();
  });

  it("17b. sem regressão F5-PR1: OperationalLiveCard renderiza normalmente (null)", () => {
    const html = render(OperationalLiveCard, { operation: null });
    expect(html).toContain("Operação ao vivo");
    expect(html).toContain("SEM DADOS");
  });

  it("18. mock RUNNING inclui campo codeTrail honesto", () => {
    const running = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];
    expect(running).not.toBeNull();
    expect(running.codeTrail).toBeDefined();
    expect(running.codeTrail.file).toBeTruthy();
    expect(running.codeTrail.block).toBeTruthy();
    expect(running.codeTrail.operationType).toBeTruthy();
    expect(running.codeTrail.diffSummary).toBeTruthy();
    expect(running.codeTrail.justification).toBeTruthy();
    expect(running.codeTrail.outOfScope).toBeTruthy();
  });

  it("19. mock COMPLETED não tem codeTrail (não está no escopo desta PR)", () => {
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    // completed pode não ter codeTrail — isso é correto: PR3 só exibe em RUNNING
    expect(completed.codeTrail).toBeUndefined();
  });

  it("20. mock IDLE é null (sem codeTrail — correto)", () => {
    expect(MOCK_EXECUTIONS[EXECUTION_STATUS.IDLE]).toBeNull();
  });

  it("labels dos campos de código visíveis", () => {
    const html = render(CodeTrailCard, { codeTrail: FULL_CODE_TRAIL });
    expect(html).toContain("Arquivo atual");
    expect(html).toContain("Função / bloco");
    expect(html).toContain("Tipo da operação");
    expect(html).toContain("Diff resumido");
    expect(html).toContain("Justificativa");
    expect(html).toContain("Fora do escopo");
  });
});
