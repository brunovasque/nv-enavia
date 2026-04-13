// =============================================================================
// ENAVIA Panel — P21 smoke tests: OperationalAuditCard
//
// Verifica acceptance criteria da P21 — Auditoria operacional por execução:
//   1.  OperationalAuditCard renderiza sem crash (completed)
//   2.  OperationalAuditCard renderiza sem crash (failed)
//   3.  OperationalAuditCard renderiza sem crash (blocked)
//   4.  OperationalAuditCard renderiza sem crash (running)
//   5.  OperationalAuditCard renderiza sem crash (null execution — estado vazio)
//   6.  "O que aconteceu" aparece em todos os estados não-vazios
//   7.  "O que falhou" aparece quando há falha (failed state)
//   8.  "O que falhou" aparece quando há bloqueio (blocked state)
//   9.  "Nenhuma falha registrada" aparece no estado completed (sem erro)
//  10.  "O que foi aprovado" aparece quando há eventos DONE (completed state)
//  11.  Result summary aparece no estado completed
//  12.  Estado vazio honesto — sem execução: mensagem adequada
//  13.  Badge CONCLUÍDA aparece no completed
//  14.  Badge FALHOU aparece no failed
//  15.  Badge BLOQUEADA aparece no blocked
//  16.  Badge EM CURSO aparece no running
//  17.  Badge SEM DADOS aparece sem execução
//  18.  metrics de etapas concluídas aparecem (stepsDone / stepsTotal)
//  19.  sem regressão: FunctionalLogsCard (P20) não importado/duplicado
//  20.  sem regressão: MacroCycleTimeline (P19) não importado/duplicado
//  21.  sem regressão: UnifiedReplayBlock (Replay) não importado/duplicado
//  22.  sem regressão: OperationalLiveCard não importado/duplicado
//  23.  título "Auditoria operacional" sempre visível
//  24.  hadBrowserNavigation=true → "Navegação browser executada" aparece
//  25.  hadCodeChange=true → "Alteração de código aplicada" aparece
//  26.  error.message aparece no bloco "O que falhou" (failed)
//  27.  error.message aparece no bloco "O que falhou" (blocked)
// =============================================================================

import { describe, it, expect } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import OperationalAuditCard from "../execution/OperationalAuditCard.jsx";
import {
  MOCK_EXECUTIONS,
  EXECUTION_STATUS,
} from "../execution/mockExecution.js";

// ── Render helper ──────────────────────────────────────────────────────────

function render(props) {
  return renderToStaticMarkup(createElement(OperationalAuditCard, props));
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMPLETED = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
const FAILED    = MOCK_EXECUTIONS[EXECUTION_STATUS.FAILED];
const BLOCKED   = MOCK_EXECUTIONS[EXECUTION_STATUS.BLOCKED];
const RUNNING   = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING];

// =============================================================================

describe("P21 — OperationalAuditCard", () => {

  // ── 1. Smoke: renderiza sem crash ─────────────────────────────────────────

  it("1. renderiza sem crash — completed", () => {
    expect(() =>
      render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED }),
    ).not.toThrow();
  });

  it("2. renderiza sem crash — failed", () => {
    expect(() =>
      render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED }),
    ).not.toThrow();
  });

  it("3. renderiza sem crash — blocked", () => {
    expect(() =>
      render({ execution: BLOCKED, currentState: EXECUTION_STATUS.BLOCKED }),
    ).not.toThrow();
  });

  it("4. renderiza sem crash — running", () => {
    expect(() =>
      render({ execution: RUNNING, currentState: EXECUTION_STATUS.RUNNING }),
    ).not.toThrow();
  });

  it("5. renderiza sem crash — null execution (estado vazio)", () => {
    expect(() =>
      render({ execution: null, currentState: EXECUTION_STATUS.IDLE }),
    ).not.toThrow();
  });

  // ── 6–8. "O que aconteceu" ────────────────────────────────────────────────

  it("6. 'O que aconteceu' aparece — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("O que aconteceu");
  });

  it("6b. 'O que aconteceu' aparece — failed", () => {
    const html = render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED });
    expect(html).toContain("O que aconteceu");
  });

  it("6c. 'O que aconteceu' aparece — running", () => {
    const html = render({ execution: RUNNING, currentState: EXECUTION_STATUS.RUNNING });
    expect(html).toContain("O que aconteceu");
  });

  // ── 7–9. "O que falhou" ───────────────────────────────────────────────────

  it("7. 'O que falhou' aparece — failed", () => {
    const html = render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED });
    expect(html).toContain("O que falhou");
  });

  it("8. 'O que falhou' aparece — blocked", () => {
    const html = render({ execution: BLOCKED, currentState: EXECUTION_STATUS.BLOCKED });
    expect(html).toContain("O que falhou");
  });

  it("9. 'Nenhuma falha registrada' aparece — completed (sem erro)", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("Nenhuma falha registrada");
  });

  // ── 10–11. "O que foi aprovado" ───────────────────────────────────────────

  it("10. 'O que foi aprovado' aparece — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("O que foi aprovado");
  });

  it("11. result.summary aparece — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain(COMPLETED.result.summary);
  });

  // ── 12. Estado vazio honesto ──────────────────────────────────────────────

  it("12. estado vazio honesto — mensagem de sem dados", () => {
    const html = render({ execution: null, currentState: EXECUTION_STATUS.IDLE });
    expect(html).toContain("Nenhuma execução disponível para auditoria");
  });

  // ── 13–17. Badges ─────────────────────────────────────────────────────────

  it("13. badge CONCLUÍDA — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("CONCLUÍDA");
  });

  it("14. badge FALHOU — failed", () => {
    const html = render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED });
    expect(html).toContain("FALHOU");
  });

  it("15. badge BLOQUEADA — blocked", () => {
    const html = render({ execution: BLOCKED, currentState: EXECUTION_STATUS.BLOCKED });
    expect(html).toContain("BLOQUEADA");
  });

  it("16. badge EM CURSO — running", () => {
    const html = render({ execution: RUNNING, currentState: EXECUTION_STATUS.RUNNING });
    expect(html).toContain("EM CURSO");
  });

  it("17. badge SEM DADOS — sem execução", () => {
    const html = render({ execution: null, currentState: EXECUTION_STATUS.IDLE });
    expect(html).toContain("SEM DADOS");
  });

  // ── 18. Métricas de etapas ────────────────────────────────────────────────

  it("18. stepsDone e stepsTotal aparecem — completed (4 de 4)", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("4 de 4 etapas");
  });

  it("18b. stepsDone e stepsTotal aparecem — failed (2 de 4)", () => {
    const html = render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED });
    expect(html).toContain("2 de 4 etapas");
  });

  // ── 19–22. Sem regressão: outros cards NÃO importados ────────────────────

  it("19. FunctionalLogsCard (P20) não é importado neste componente", async () => {
    // Verifica que o módulo OperationalAuditCard não tem import de FunctionalLogsCard
    const src = await import("../execution/OperationalAuditCard.jsx?raw");
    // Procura apenas por linhas de import (não comentários)
    const importLines = src.default
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l));
    expect(importLines.join("\n")).not.toContain("FunctionalLogsCard");
  });

  it("20. MacroCycleTimeline (P19) não é importado neste componente", async () => {
    const src = await import("../execution/OperationalAuditCard.jsx?raw");
    const importLines = src.default
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l));
    expect(importLines.join("\n")).not.toContain("MacroCycleTimeline");
  });

  it("21. UnifiedReplayBlock (Replay) não é importado neste componente", async () => {
    const src = await import("../execution/OperationalAuditCard.jsx?raw");
    const importLines = src.default
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l));
    expect(importLines.join("\n")).not.toContain("UnifiedReplayBlock");
  });

  it("22. OperationalLiveCard não é importado neste componente", async () => {
    const src = await import("../execution/OperationalAuditCard.jsx?raw");
    const importLines = src.default
      .split("\n")
      .filter((l) => /^\s*import\s/.test(l));
    expect(importLines.join("\n")).not.toContain("OperationalLiveCard");
  });

  // ── 23. Título sempre visível ─────────────────────────────────────────────

  it("23. título 'Auditoria operacional' sempre visível — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("Auditoria operacional");
  });

  it("23b. título 'Auditoria operacional' sempre visível — null", () => {
    const html = render({ execution: null, currentState: EXECUTION_STATUS.IDLE });
    expect(html).toContain("Auditoria operacional");
  });

  // ── 24–25. executionSummary flags ─────────────────────────────────────────

  it("24. hadBrowserNavigation=true → 'Navegação browser executada' — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("Navegação browser executada");
  });

  it("25. hadCodeChange=true → 'Alteração de código aplicada' — completed", () => {
    const html = render({ execution: COMPLETED, currentState: EXECUTION_STATUS.COMPLETED });
    expect(html).toContain("Alteração de código aplicada");
  });

  // ── 26–27. error.message no bloco "O que falhou" ─────────────────────────

  it("26. error.message aparece no bloco 'O que falhou' — failed", () => {
    const html = render({ execution: FAILED, currentState: EXECUTION_STATUS.FAILED });
    expect(html).toContain(FAILED.error.message);
  });

  it("27. error.message aparece no bloco 'O que falhou' — blocked", () => {
    const html = render({ execution: BLOCKED, currentState: EXECUTION_STATUS.BLOCKED });
    expect(html).toContain(BLOCKED.error.message);
  });

});
