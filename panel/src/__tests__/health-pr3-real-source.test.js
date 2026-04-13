// =============================================================================
// ENAVIA Panel — PR3 smoke tests: /health real source bridge
//
// Critérios de aceite:
//   1.  mapHealthResponse(null) → MOCK_HEALTH_IDLE (honest idle fallback)
//   2.  mapHealthResponse({}) → fields default to idle values
//   3.  mapHealthResponse com exec_event de erro → grupo erros real
//   4.  mapHealthResponse com exec_event success → grupo concluídas real
//   5.  mapHealthResponse com status running → status "healthy"
//   6.  blockedExecutions sempre [] (não disponível na fonte PR1)
//   7.  _source preservado do worker
//   8.  fetchHealth em mock mode retorna MOCK_HEALTH (sem crash)
//   9.  fetchHealth retorna { ok, data, meta } envelope
//  10.  HealthPage ainda renderiza sem crash (sem regressão)
//  11.  HealthPage importa fetchHealth e getApiConfig de "../api"
//  12.  HealthPage usa useState (estado dinâmico)
//  13.  HealthPage usa useEffect (fetch em real mode)
//  14.  Sem regressão: p22 tests — MOCK_HEALTH shape intacto
//  15.  summary.blocked=0 (honesto — não disponível na fonte PR1)
// =============================================================================

import { describe, it, expect } from "vitest";
import { createElement }        from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter }         from "react-router-dom";

import { mapHealthResponse }      from "../api/mappers/health.js";
import { fetchHealth }            from "../api/endpoints/health.js";
import { MOCK_HEALTH, MOCK_HEALTH_IDLE } from "../health/mockHealth.js";
import HealthPage from "../pages/HealthPage.jsx";

// ── Render helper ──────────────────────────────────────────────────────────

function render() {
  return renderToStaticMarkup(
    createElement(MemoryRouter, null, createElement(HealthPage)),
  );
}

// =============================================================================

describe("PR3 — /health real source bridge (mapHealthResponse + fetchHealth)", () => {

  // ── 1. mapHealthResponse null → idle ───────────────────────────────────

  it("1. mapHealthResponse(null) retorna MOCK_HEALTH_IDLE (fallback honesto)", () => {
    const result = mapHealthResponse(null);
    expect(result).toEqual(MOCK_HEALTH_IDLE);
  });

  // ── 2. mapHealthResponse vazio ──────────────────────────────────────────

  it("2. mapHealthResponse({}) retorna valores idle por padrão", () => {
    const result = mapHealthResponse({});
    expect(result.status).toBe("idle");
    expect(result.recentErrors).toEqual([]);
    expect(result.blockedExecutions).toEqual([]);
    expect(result.recentCompleted).toEqual([]);
  });

  // ── 3. Grupo erros real (exec_event com erro) ───────────────────────────

  it("3. mapHealthResponse com status degraded → erros recentes reais preservados", () => {
    const raw = {
      generatedAt:       "2026-04-13T18:00:00Z",
      status:            "degraded",
      summary:           { total: 1, completed: 0, failed: 1, blocked: 0, running: 0 },
      recentErrors:      [{ id: "exec-event-abc", requestLabel: "Análise X", errorCode: "STEP_EXECUTION_ERROR", message: "Dados insuficientes.", failedAt: "2026-04-13T17:59:00Z" }],
      blockedExecutions: [],
      recentCompleted:   [],
      _source:           "exec_event",
    };
    const result = mapHealthResponse(raw);
    expect(result.status).toBe("degraded");
    expect(result.recentErrors).toHaveLength(1);
    expect(result.recentErrors[0].requestLabel).toBe("Análise X");
    expect(result.summary.failed).toBe(1);
  });

  // ── 4. Grupo concluídas real (exec_event success) ───────────────────────

  it("4. mapHealthResponse com status healthy e concluídas → concluídas reais preservadas", () => {
    const raw = {
      generatedAt:       "2026-04-13T18:00:00Z",
      status:            "healthy",
      summary:           { total: 1, completed: 1, failed: 0, blocked: 0, running: 0 },
      recentErrors:      [],
      blockedExecutions: [],
      recentCompleted:   [{ id: "exec-event-abc", requestLabel: "Plano Q2", completedAt: "2026-04-13T18:00:00Z", durationMs: null, summary: "Concluído." }],
      _source:           "exec_event",
    };
    const result = mapHealthResponse(raw);
    expect(result.status).toBe("healthy");
    expect(result.recentCompleted).toHaveLength(1);
    expect(result.recentCompleted[0].requestLabel).toBe("Plano Q2");
    expect(result.summary.completed).toBe(1);
  });

  // ── 5. Status running → healthy ────────────────────────────────────────

  it("5. mapHealthResponse com status healthy (running ativo) → status healthy", () => {
    const raw = {
      status:            "healthy",
      summary:           { total: 1, completed: 0, failed: 0, blocked: 0, running: 1 },
      recentErrors:      [],
      blockedExecutions: [],
      recentCompleted:   [],
      _source:           "exec_event",
    };
    const result = mapHealthResponse(raw);
    expect(result.status).toBe("healthy");
    expect(result.summary.running).toBe(1);
  });

  // ── 6. blockedExecutions sempre [] ─────────────────────────────────────

  it("6. blockedExecutions é [] (fonte PR1 não fornece dados de bloqueio)", () => {
    const raw = { status: "healthy", summary: { total: 1, completed: 1, failed: 0, blocked: 0, running: 0 }, recentErrors: [], blockedExecutions: [], recentCompleted: [], _source: "exec_event" };
    const result = mapHealthResponse(raw);
    expect(result.blockedExecutions).toEqual([]);
    expect(result.summary.blocked).toBe(0);
  });

  // ── 7. _source preservado ───────────────────────────────────────────────

  it("7. _source do worker é preservado no resultado do mapper", () => {
    const raw = { status: "idle", summary: { total: 0, completed: 0, failed: 0, blocked: 0, running: 0 }, recentErrors: [], blockedExecutions: [], recentCompleted: [], _source: "exec_event_absent" };
    const result = mapHealthResponse(raw);
    expect(result._source).toBe("exec_event_absent");
  });

  // ── 8. fetchHealth mock mode retorna MOCK_HEALTH ────────────────────────

  it("8. fetchHealth em mock mode retorna MOCK_HEALTH (sem crash)", async () => {
    const res = await fetchHealth();
    expect(res.ok).toBe(true);
    expect(res.data).toBeDefined();
    expect(res.data.status).toBeDefined();
    expect(res.data.summary).toBeDefined();
  });

  // ── 9. fetchHealth envelope ─────────────────────────────────────────────

  it("9. fetchHealth retorna envelope { ok, data, meta }", async () => {
    const res = await fetchHealth();
    expect(typeof res.ok).toBe("boolean");
    expect(res.data).toBeDefined();
    expect(res.meta).toBeDefined();
    expect(typeof res.meta.durationMs).toBe("number");
  });

  // ── 10. HealthPage sem regressão ────────────────────────────────────────

  it("10. HealthPage renderiza sem crash (sem regressão)", () => {
    expect(() => render()).not.toThrow();
  });

  // ── 11. HealthPage importa fetchHealth e getApiConfig ───────────────────

  it("11. HealthPage importa fetchHealth e getApiConfig de '../api'", async () => {
    const src = await import("../pages/HealthPage.jsx?raw");
    expect(src.default).toContain("fetchHealth");
    expect(src.default).toContain("getApiConfig");
  });

  // ── 12. HealthPage usa useState ─────────────────────────────────────────

  it("12. HealthPage usa useState (estado dinâmico)", async () => {
    const src = await import("../pages/HealthPage.jsx?raw");
    expect(src.default).toContain("useState");
  });

  // ── 13. HealthPage usa useEffect ────────────────────────────────────────

  it("13. HealthPage usa useEffect (fetch em real mode)", async () => {
    const src = await import("../pages/HealthPage.jsx?raw");
    expect(src.default).toContain("useEffect");
  });

  // ── 14. MOCK_HEALTH shape intacto (sem regressão P22) ───────────────────

  it("14. MOCK_HEALTH shape intacto — status, summary, recentErrors, blockedExecutions, recentCompleted", () => {
    expect(MOCK_HEALTH.status).toBeDefined();
    expect(MOCK_HEALTH.summary).toBeDefined();
    expect(Array.isArray(MOCK_HEALTH.recentErrors)).toBe(true);
    expect(Array.isArray(MOCK_HEALTH.blockedExecutions)).toBe(true);
    expect(Array.isArray(MOCK_HEALTH.recentCompleted)).toBe(true);
  });

  // ── 15. summary.blocked=0 honesto ──────────────────────────────────────

  it("15. summary.blocked=0 em exec_event real (fonte PR1 não registra bloqueios)", () => {
    const raw = {
      status:            "healthy",
      summary:           { total: 1, completed: 1, failed: 0, blocked: 0, running: 0 },
      recentErrors:      [],
      blockedExecutions: [],
      recentCompleted:   [{ id: "x", requestLabel: "y", completedAt: null, durationMs: null, summary: "z" }],
      _source:           "exec_event",
    };
    const result = mapHealthResponse(raw);
    expect(result.summary.blocked).toBe(0);
  });

});
