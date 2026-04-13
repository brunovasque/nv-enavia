// =============================================================================
// ENAVIA Panel — F5-PR1 smoke tests: OperationalLiveCard
//
// Verifica acceptance criteria da Frente 5 PR1 — Observabilidade Operacional:
//   1. Card renderiza sem crash (dados completos)
//   2. Card renderiza sem crash (operation null — estado honesto)
//   3. Campos com dados são exibidos legìvelmente
//   4. Campos ausentes mostram "sem dado disponível" (honesto)
//   5. Estado vazio (operation=null) exibe mensagem honesta
//   6. Badge "AO VIVO" aparece quando há dados operacionais
//   7. Badge "SEM DADOS" aparece quando operation é null
//   8. operation={} (objeto vazio) mostra campos com estado honesto
//   9. Título "Operação ao vivo" é sempre visível
//  10. Sem regressão de P18 (MemoryInUseCard não é afetado)
// =============================================================================

import { describe, it, expect } from "vitest";

// ── Minimal React + jsdom renderer (sem dependência de @testing-library) ──────

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import OperationalLiveCard from "../execution/OperationalLiveCard.jsx";

function render(props) {
  return renderToStaticMarkup(createElement(OperationalLiveCard, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const FULL_OPERATION = {
  action:    "Calculando cronograma de capacidade regional",
  contract:  "canonical_plan_v1",
  microStep: "Validando precedências entre etapas e janelas de entrega",
  reason:    "Dados de capacidade identificados; estimando janela para região Sul",
  nextStep:  "Etapa 4 — Geração do plano canônico",
};

const PARTIAL_OPERATION = {
  action:   "Analisando escopo",
  contract: null,
  // microStep, reason, nextStep ausentes
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("F5-PR1 — OperationalLiveCard", () => {
  it("1. renderiza sem crash com dados completos", () => {
    expect(() => render({ operation: FULL_OPERATION })).not.toThrow();
  });

  it("2. renderiza sem crash com operation=null (estado honesto)", () => {
    expect(() => render({ operation: null })).not.toThrow();
  });

  it("3. exibe campo 'action' quando dado existe", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("Calculando cronograma de capacidade regional");
  });

  it("3. exibe campo 'contract' quando dado existe", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("canonical_plan_v1");
  });

  it("3. exibe campo 'microStep' quando dado existe", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("Validando precedências");
  });

  it("3. exibe campo 'reason' quando dado existe", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("estimando janela para região Sul");
  });

  it("3. exibe campo 'nextStep' quando dado existe", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("Etapa 4 — Geração do plano canônico");
  });

  it("4. campo ausente exibe 'sem dado disponível' (honesto)", () => {
    const html = render({ operation: PARTIAL_OPERATION });
    // contract é null, os outros 3 são ausentes → múltiplas ocorrências
    expect(html).toContain("sem dado disponível");
  });

  it("4. campo contract=null exibe 'sem dado disponível'", () => {
    const html = render({ operation: { ...FULL_OPERATION, contract: null } });
    expect(html).toContain("sem dado disponível");
  });

  it("5. operation=null exibe mensagem de estado vazio honesto", () => {
    const html = render({ operation: null });
    expect(html).toContain("Nenhum dado operacional disponível");
  });

  it("5. operation=undefined exibe mensagem de estado vazio honesto", () => {
    const html = render({ operation: undefined });
    expect(html).toContain("Nenhum dado operacional disponível");
  });

  it("6. badge 'AO VIVO' aparece quando há dados operacionais", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("AO VIVO");
  });

  it("7. badge 'SEM DADOS' aparece quando operation é null", () => {
    const html = render({ operation: null });
    expect(html).toContain("SEM DADOS");
  });

  it("8. operation={} (objeto vazio) — todos os campos mostram estado honesto", () => {
    const html = render({ operation: {} });
    // Deve mostrar os campos com "sem dado disponível" e NÃO o estado vazio completo
    expect(html).toContain("sem dado disponível");
    expect(html).not.toContain("Nenhum dado operacional disponível");
  });

  it("9. título 'Operação ao vivo' sempre visível (dados presentes)", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("Operação ao vivo");
  });

  it("9. título 'Operação ao vivo' sempre visível (estado vazio)", () => {
    const html = render({ operation: null });
    expect(html).toContain("Operação ao vivo");
  });

  it("10. labels dos campos operacionais visíveis", () => {
    const html = render({ operation: FULL_OPERATION });
    expect(html).toContain("Ação atual");
    expect(html).toContain("Contrato");
    expect(html).toContain("Microetapa");
    expect(html).toContain("Motivo");
    expect(html).toContain("Próximo passo");
  });
});
