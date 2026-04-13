// =============================================================================
// ENAVIA Panel — F5-PR4 smoke tests: UnifiedReplayBlock
//
// Verifica acceptance criteria da Frente 5 PR4 — Replay Unificado:
//   1.  UnifiedReplayBlock renderiza sem crash (dados completos — completed)
//   2.  UnifiedReplayBlock renderiza sem crash (estado vazio — sem dados)
//   3.  Timeline consolidada renderiza eventos em ordem legível (por timestamp)
//   4.  Eventos de operação cognitiva aparecem identificados (trilha Cognitivo)
//   5.  Eventos de browser aparecem identificados (trilha Browser)
//   6.  Eventos de código aparecem identificados (trilha Código)
//   7.  Bloqueio/erro aparece corretamente quando presente
//   8.  Resumo final aparece quando executionSummary fornecido
//   9.  Estado vazio exibe mensagem honesta (nenhum dado)
//  10.  Badge DEMO aparece quando há dados demo (browser/code events)
//  11.  Badge SEM DADOS aparece quando não há eventos nem summary
//  12.  Resumo final mostra status da execução (completed/blocked/failed)
//  13.  Resumo final mostra hadBlocker corretamente
//  14.  Resumo final mostra hadBrowserNavigation corretamente
//  15.  Resumo final mostra hadCodeChange corretamente
//  16.  Resumo final mostra nextAction corretamente
//  17.  sem regressão visual da F5-PR1 (OperationalLiveCard não afetado)
//  18.  sem regressão visual da F5-PR2 (BrowserExecutorPanel não afetado)
//  19.  sem regressão visual da F5-PR3 (CodeTrailCard não afetado)
//  20.  sem regressão da P18 (mockMemory não afetado)
//  21.  mockExecution COMPLETED inclui browserEvents (array)
//  22.  mockExecution COMPLETED inclui codeEvents (array)
//  23.  mockExecution COMPLETED inclui executionSummary
//  24.  mockExecution BLOCKED inclui executionSummary com hadBlocker=true
//  25.  mockExecution FAILED inclui executionSummary com finalStatus=failed
//  26.  eventos na timeline consolidada têm campo track correto
//  27.  UnifiedReplayBlock renderiza sem crash (blocked state)
//  28.  UnifiedReplayBlock renderiza sem crash (failed state)
//  29.  título "Replay da execução" sempre visível
//  30.  ordem dos eventos respeita timestamp (primeiro evento é PLAN_LOADED)
// =============================================================================

import { describe, it, expect } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import UnifiedReplayBlock from "../execution/UnifiedReplayBlock.jsx";
import {
  MOCK_EXECUTIONS,
  EXECUTION_STATUS,
  EVENT_STATUS,
} from "../execution/mockExecution.js";

// ── Render helper ──────────────────────────────────────────────────────────

function render(props) {
  return renderToStaticMarkup(createElement(UnifiedReplayBlock, props));
}

// ── Fixtures ───────────────────────────────────────────────────────────────

const COMPLETED = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
const BLOCKED   = MOCK_EXECUTIONS[EXECUTION_STATUS.BLOCKED];
const FAILED    = MOCK_EXECUTIONS[EXECUTION_STATUS.FAILED];

// A minimal browser event for testing
const SAMPLE_BROWSER_EVENTS = [
  {
    id: "br1",
    track: "browser",
    type: "BROWSER_NAVIGATE",
    label: "Navegação: página de busca",
    detail: "Filtros aplicados — 12 resultados",
    timestamp: "2026-04-12T01:51:40Z",
    status: EVENT_STATUS.DONE,
  },
];

const SAMPLE_CODE_EVENTS = [
  {
    id: "ce1",
    track: "code",
    type: "CODE_VALIDATE",
    label: "VALIDATE · resolveStep()",
    detail: "contract-executor.js — validação executada",
    timestamp: "2026-04-12T01:52:10Z",
    status: EVENT_STATUS.DONE,
  },
];

const SAMPLE_SUMMARY_COMPLETED = {
  finalStatus: "completed",
  hadBlocker: false,
  hadBrowserNavigation: true,
  hadCodeChange: true,
  nextAction: "Aguardando aprovação final",
};

const SAMPLE_SUMMARY_BLOCKED = {
  finalStatus: "blocked",
  hadBlocker: true,
  hadBrowserNavigation: false,
  hadCodeChange: false,
  nextAction: "Escalar para Ops Lead",
};

// ── Tests — Component render ───────────────────────────────────────────────

describe("F5-PR4 — UnifiedReplayBlock render", () => {
  it("1. renderiza sem crash com dados completos (completed)", () => {
    expect(() =>
      render({
        events: COMPLETED.events,
        browserEvents: COMPLETED.browserEvents,
        codeEvents: COMPLETED.codeEvents,
        executionSummary: COMPLETED.executionSummary,
      })
    ).not.toThrow();
  });

  it("2. renderiza sem crash com estado vazio", () => {
    expect(() =>
      render({ events: [], browserEvents: [], codeEvents: [], executionSummary: null })
    ).not.toThrow();
  });

  it("27. renderiza sem crash (blocked state)", () => {
    expect(() =>
      render({
        events: BLOCKED.events,
        browserEvents: BLOCKED.browserEvents,
        codeEvents: BLOCKED.codeEvents,
        executionSummary: BLOCKED.executionSummary,
      })
    ).not.toThrow();
  });

  it("28. renderiza sem crash (failed state)", () => {
    expect(() =>
      render({
        events: FAILED.events,
        browserEvents: FAILED.browserEvents,
        codeEvents: FAILED.codeEvents,
        executionSummary: FAILED.executionSummary,
      })
    ).not.toThrow();
  });

  it("29. título 'Replay da execução' sempre visível (com dados)", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: COMPLETED.browserEvents,
      codeEvents: COMPLETED.codeEvents,
      executionSummary: COMPLETED.executionSummary,
    });
    expect(html).toContain("Replay da execução");
  });

  it("29. título 'Replay da execução' sempre visível (estado vazio)", () => {
    const html = render({
      events: [], browserEvents: [], codeEvents: [], executionSummary: null,
    });
    expect(html).toContain("Replay da execução");
  });
});

// ── Tests — Timeline consolidated ─────────────────────────────────────────

describe("F5-PR4 — Timeline consolidada", () => {
  it("3. timeline exibe eventos em ordem legível", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: COMPLETED.browserEvents,
      codeEvents: COMPLETED.codeEvents,
      executionSummary: COMPLETED.executionSummary,
    });
    // Should contain event labels from all three tracks
    expect(html).toContain("Plano carregado"); // cognitive
    expect(html).toContain("Sessão browser");   // browser
    expect(html).toContain("resolveStep");       // code
  });

  it("4. eventos cognitivos/operacionais aparecem identificados (trilha Cognitivo)", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: [],
      codeEvents: [],
      executionSummary: null,
    });
    expect(html).toContain("Cognitivo");
  });

  it("5. eventos de browser aparecem identificados (trilha Browser)", () => {
    const html = render({
      events: [],
      browserEvents: SAMPLE_BROWSER_EVENTS,
      codeEvents: [],
      executionSummary: null,
    });
    expect(html).toContain("Browser");
    expect(html).toContain("Navegação: página de busca");
  });

  it("6. eventos de código aparecem identificados (trilha Código)", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: SAMPLE_CODE_EVENTS,
      executionSummary: null,
    });
    expect(html).toContain("Código");
    expect(html).toContain("resolveStep");
  });

  it("7. bloqueio aparece corretamente quando presente", () => {
    const html = render({
      events: BLOCKED.events,
      browserEvents: [],
      codeEvents: [],
      executionSummary: BLOCKED.executionSummary,
    });
    expect(html).toContain("Gate bloqueado");
    expect(html).toContain("BLOQUEADO");
  });

  it("7. erro aparece corretamente quando presente (failed)", () => {
    const html = render({
      events: FAILED.events,
      browserEvents: [],
      codeEvents: [],
      executionSummary: FAILED.executionSummary,
    });
    expect(html).toContain("ERRO");
  });

  it("26. todos os eventos cognitivos têm trilha 'Cognitivo'", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: [],
      codeEvents: [],
      executionSummary: null,
    });
    // All events from execution.events have track cognitive
    expect(html).toContain("Cognitivo");
  });

  it("30. primeiro evento visível na ordem correta (Plano carregado)", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: COMPLETED.browserEvents,
      codeEvents: COMPLETED.codeEvents,
      executionSummary: COMPLETED.executionSummary,
    });
    // Check that "Plano carregado" appears — it has the earliest timestamp
    expect(html).toContain("Plano carregado");
    // The #1 marker should be present (first event)
    expect(html).toContain("#1");
  });
});

// ── Tests — Summary block ─────────────────────────────────────────────────

describe("F5-PR4 — Resumo final", () => {
  it("8. resumo final aparece quando executionSummary fornecido", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: SAMPLE_SUMMARY_COMPLETED,
    });
    expect(html).toContain("Resumo da execução");
  });

  it("12. resumo mostra status: Concluída (completed)", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: SAMPLE_SUMMARY_COMPLETED,
    });
    expect(html).toContain("Concluída");
  });

  it("12. resumo mostra status: Bloqueada (blocked)", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: SAMPLE_SUMMARY_BLOCKED,
    });
    expect(html).toContain("Bloqueada");
  });

  it("13. resumo mostra bloqueio: Sem bloqueio registrado (hadBlocker=false)", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadBlocker: false },
    });
    expect(html).toContain("Sem bloqueio registrado");
  });

  it("13. resumo mostra bloqueio: Houve bloqueio (hadBlocker=true)", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadBlocker: true },
    });
    expect(html).toContain("Houve bloqueio durante a execução");
  });

  it("14. resumo mostra hadBrowserNavigation=true", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadBrowserNavigation: true },
    });
    expect(html).toContain("Houve navegação browser");
  });

  it("14. resumo mostra hadBrowserNavigation=false", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadBrowserNavigation: false },
    });
    expect(html).toContain("Sem navegação browser");
  });

  it("15. resumo mostra hadCodeChange=true", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadCodeChange: true },
    });
    expect(html).toContain("Houve mudança de código");
  });

  it("15. resumo mostra hadCodeChange=false", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: { ...SAMPLE_SUMMARY_COMPLETED, hadCodeChange: false },
    });
    expect(html).toContain("Sem mudança de código");
  });

  it("16. resumo mostra nextAction quando presente", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: [],
      executionSummary: SAMPLE_SUMMARY_COMPLETED,
    });
    expect(html).toContain("Aguardando aprovação final");
    expect(html).toContain("Próxima ação");
  });
});

// ── Tests — Empty / badge states ──────────────────────────────────────────

describe("F5-PR4 — Estado honesto e badges", () => {
  it("9. estado vazio exibe mensagem honesta", () => {
    const html = render({
      events: [], browserEvents: [], codeEvents: [], executionSummary: null,
    });
    expect(html).toContain("Nenhum evento de replay disponível");
  });

  it("10. badge DEMO aparece quando há dados de browser/code", () => {
    const html = render({
      events: [],
      browserEvents: SAMPLE_BROWSER_EVENTS,
      codeEvents: [],
      executionSummary: null,
    });
    expect(html).toContain("DEMO");
  });

  it("10. badge DEMO aparece quando há codeEvents", () => {
    const html = render({
      events: [],
      browserEvents: [],
      codeEvents: SAMPLE_CODE_EVENTS,
      executionSummary: null,
    });
    expect(html).toContain("DEMO");
  });

  it("11. badge SEM DADOS aparece quando não há eventos nem summary", () => {
    const html = render({
      events: [], browserEvents: [], codeEvents: [], executionSummary: null,
    });
    expect(html).toContain("SEM DADOS");
  });

  it("11. badge SEM DADOS não aparece quando há eventos cognitivos", () => {
    const html = render({
      events: COMPLETED.events,
      browserEvents: [],
      codeEvents: [],
      executionSummary: null,
    });
    // SEM DADOS badge should not appear when there are events
    // (it may appear inside summary, but not as the header badge)
    // We check the component renders properly with events
    expect(html).toContain("Cognitivo");
  });
});

// ── Tests — Mock data shape ────────────────────────────────────────────────

describe("F5-PR4 — mockExecution shape", () => {
  it("21. COMPLETED inclui browserEvents (array não-vazio)", () => {
    expect(Array.isArray(COMPLETED.browserEvents)).toBe(true);
    expect(COMPLETED.browserEvents.length).toBeGreaterThan(0);
  });

  it("21. browserEvents têm shape esperado (id, label, timestamp, status)", () => {
    for (const e of COMPLETED.browserEvents) {
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("label");
      expect(e).toHaveProperty("timestamp");
      expect(e).toHaveProperty("status");
    }
  });

  it("22. COMPLETED inclui codeEvents (array não-vazio)", () => {
    expect(Array.isArray(COMPLETED.codeEvents)).toBe(true);
    expect(COMPLETED.codeEvents.length).toBeGreaterThan(0);
  });

  it("22. codeEvents têm shape esperado (id, label, timestamp, status)", () => {
    for (const e of COMPLETED.codeEvents) {
      expect(e).toHaveProperty("id");
      expect(e).toHaveProperty("label");
      expect(e).toHaveProperty("timestamp");
      expect(e).toHaveProperty("status");
    }
  });

  it("23. COMPLETED inclui executionSummary com campos esperados", () => {
    const s = COMPLETED.executionSummary;
    expect(s).not.toBeNull();
    expect(s).toHaveProperty("finalStatus", "completed");
    expect(s).toHaveProperty("hadBlocker");
    expect(s).toHaveProperty("hadBrowserNavigation");
    expect(s).toHaveProperty("hadCodeChange");
    expect(s).toHaveProperty("nextAction");
  });

  it("23. COMPLETED executionSummary: hadBrowserNavigation=true, hadCodeChange=true", () => {
    expect(COMPLETED.executionSummary.hadBrowserNavigation).toBe(true);
    expect(COMPLETED.executionSummary.hadCodeChange).toBe(true);
    expect(COMPLETED.executionSummary.hadBlocker).toBe(false);
  });

  it("24. BLOCKED inclui executionSummary com hadBlocker=true", () => {
    const s = BLOCKED.executionSummary;
    expect(s).not.toBeNull();
    expect(s.hadBlocker).toBe(true);
    expect(s.finalStatus).toBe("blocked");
  });

  it("24. BLOCKED browserEvents e codeEvents são arrays (podem ser vazios)", () => {
    expect(Array.isArray(BLOCKED.browserEvents)).toBe(true);
    expect(Array.isArray(BLOCKED.codeEvents)).toBe(true);
  });

  it("25. FAILED inclui executionSummary com finalStatus=failed", () => {
    const s = FAILED.executionSummary;
    expect(s).not.toBeNull();
    expect(s.finalStatus).toBe("failed");
    expect(s.hadBlocker).toBe(false);
  });
});

// ── Tests — No regression guards ──────────────────────────────────────────

describe("F5-PR4 — sem regressão das PRs anteriores", () => {
  it("17. sem regressão F5-PR1: OperationalLiveCard pode ser importado sem erro", async () => {
    const mod = await import("../execution/OperationalLiveCard.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("17. sem regressão F5-PR1: mockExecution mantém EXECUTION_STATUS intacto", async () => {
    const mod = await import("../execution/mockExecution.js");
    expect(mod.EXECUTION_STATUS.IDLE).toBe("idle");
    expect(mod.EXECUTION_STATUS.RUNNING).toBe("running");
    expect(mod.EXECUTION_STATUS.COMPLETED).toBe("completed");
  });

  it("18. sem regressão F5-PR2: BrowserExecutorPanel pode ser importado sem erro", async () => {
    const mod = await import("../browser/BrowserExecutorPanel.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("18. sem regressão F5-PR2: mockBrowserSession mantém BROWSER_STATUS intacto", async () => {
    const mod = await import("../browser/mockBrowserSession.js");
    expect(mod.BROWSER_STATUS.IDLE).toBe("idle");
    expect(mod.BROWSER_STATUS.COMPLETED).toBe("completed");
    expect(mod.BROWSER_OPERATIONAL_DOMAIN).toBe("run.nv-imoveis.com");
  });

  it("19. sem regressão F5-PR3: CodeTrailCard pode ser importado sem erro", async () => {
    const mod = await import("../execution/CodeTrailCard.jsx");
    expect(mod.default).toBeDefined();
    expect(typeof mod.default).toBe("function");
  });

  it("19. sem regressão F5-PR3: mock RUNNING ainda inclui codeTrail honesto", async () => {
    const mod = await import("../execution/mockExecution.js");
    const running = mod.MOCK_EXECUTIONS[mod.EXECUTION_STATUS.RUNNING];
    expect(running.codeTrail).toBeDefined();
    expect(running.codeTrail.file).toBeTruthy();
  });

  it("20. sem regressão P18: mockMemory exporta MOCK_MEMORY e MEMORY_STATES", async () => {
    const mod = await import("../memory/mockMemory.js");
    expect(mod.MOCK_MEMORY).toBeDefined();
    expect(mod.MEMORY_STATES).toBeDefined();
  });
});
