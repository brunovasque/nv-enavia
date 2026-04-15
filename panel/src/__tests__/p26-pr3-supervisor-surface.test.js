// =============================================================================
// ENAVIA Panel — P26-PR3 smoke tests: SupervisorEnforcementBlock
//
// Verifica acceptance criteria da P26-PR3 — Surface do Supervisor de Segurança:
//
//  1. retorna vazio sem crash quando supervisor_enforcement é null
//  2. retorna vazio sem crash quando supervisor_enforcement é undefined
//  3. renderiza sem crash — decision=block
//  4. decision=block → mostra "Supervisor: bloqueado"
//  5. decision=block → mostra reason_text
//  6. decision=block → mostra reason_code
//  7. decision=block → mostra risk_level
//  8. renderiza sem crash — decision=needs_human_review
//  9. decision=needs_human_review → mostra "Supervisor: revisão humana"
// 10. decision=needs_human_review → mostra reason_text
// 11. renderiza sem crash — decision=allow
// 12. decision=allow → mostra "Supervisor: permitido"
// 13. supervisor_version é exibido
// 14. timestamp é exibido (formatado)
// 15. flags scope_valid, autonomy_valid, evidence_sufficient são exibidos
// 16. requires_human_approval=true → "Aprovação humana" exibido
// 17. role="region" e aria-label presente
// 18. payload sem supervisor_enforcement → componente retorna string vazia
// 19. IDLE mock (execution=null) não quebra — sem supervisor_enforcement
// 20. BLOCKED mock tem supervisor_enforcement com decision=block no mock
// 21. COMPLETED mock tem supervisor_enforcement com decision=allow no mock
// 22. RUNNING mock tem supervisor_enforcement com decision=needs_human_review no mock
// =============================================================================

import { describe, it, expect } from "vitest";

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import SupervisorEnforcementBlock from "../execution/SupervisorEnforcementBlock.jsx";
import {
  MOCK_EXECUTIONS,
  EXECUTION_STATUS,
} from "../execution/mockExecution.js";

// ── Render helper ──────────────────────────────────────────────────────────

function render(props) {
  return renderToStaticMarkup(createElement(SupervisorEnforcementBlock, props));
}

// ── Fixtures from mocks ────────────────────────────────────────────────────

const BLOCK_SE   = MOCK_EXECUTIONS[EXECUTION_STATUS.BLOCKED].supervisor_enforcement;
const ALLOW_SE   = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED].supervisor_enforcement;
const REVIEW_SE  = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].supervisor_enforcement;

// =============================================================================

describe("P26-PR3 — SupervisorEnforcementBlock", () => {

  // ── 1–2. Degradação segura: sem supervisor_enforcement ─────────────────────

  it("1. retorna vazio sem crash quando supervisor_enforcement é null", () => {
    expect(() => render({ supervisorEnforcement: null })).not.toThrow();
    expect(render({ supervisorEnforcement: null })).toBe("");
  });

  it("2. retorna vazio sem crash quando supervisor_enforcement é undefined", () => {
    expect(() => render({ supervisorEnforcement: undefined })).not.toThrow();
    expect(render({ supervisorEnforcement: undefined })).toBe("");
  });

  // ── 3–7. decision = block ─────────────────────────────────────────────────

  it("3. renderiza sem crash — decision=block", () => {
    expect(() => render({ supervisorEnforcement: BLOCK_SE })).not.toThrow();
  });

  it("4. decision=block → mostra 'Supervisor: bloqueado'", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain("Supervisor: bloqueado");
  });

  it("5. decision=block → mostra reason_text", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain(BLOCK_SE.reason_text);
  });

  it("6. decision=block → mostra reason_code", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain(BLOCK_SE.reason_code);
  });

  it("7. decision=block → mostra risk_level", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain(BLOCK_SE.risk_level);
  });

  // ── 8–10. decision = needs_human_review ───────────────────────────────────

  it("8. renderiza sem crash — decision=needs_human_review", () => {
    expect(() => render({ supervisorEnforcement: REVIEW_SE })).not.toThrow();
  });

  it("9. decision=needs_human_review → mostra 'Supervisor: revisão humana'", () => {
    const html = render({ supervisorEnforcement: REVIEW_SE });
    expect(html).toContain("Supervisor: revis\u00e3o humana");
  });

  it("10. decision=needs_human_review → mostra reason_text", () => {
    const html = render({ supervisorEnforcement: REVIEW_SE });
    expect(html).toContain(REVIEW_SE.reason_text);
  });

  // ── 11–12. decision = allow ───────────────────────────────────────────────

  it("11. renderiza sem crash — decision=allow", () => {
    expect(() => render({ supervisorEnforcement: ALLOW_SE })).not.toThrow();
  });

  it("12. decision=allow → mostra 'Supervisor: permitido'", () => {
    const html = render({ supervisorEnforcement: ALLOW_SE });
    expect(html).toContain("Supervisor: permitido");
  });

  // ── 13–14. Campos secundários ─────────────────────────────────────────────

  it("13. supervisor_version é exibido — decision=block", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain(BLOCK_SE.supervisor_version);
  });

  it("14. timestamp é exibido formatado — decision=block", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    // formatTsFull("2026-04-12T03:48:02Z") → contém "12/04/2026"
    expect(html).toContain("12/04/2026");
  });

  // ── 15–16. Flags booleanos ────────────────────────────────────────────────

  it("15. flags Escopo, Autonomia, Evidência são exibidos — decision=block", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain("Escopo");
    expect(html).toContain("Autonomia");
    expect(html).toContain("Evid\u00eancia");
  });

  it("16. requires_human_approval=true → 'Aprovação humana' exibido", () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain("Aprova\u00e7\u00e3o humana");
  });

  // ── 17. Acessibilidade ────────────────────────────────────────────────────

  it('17. role="region" e aria-label presente', () => {
    const html = render({ supervisorEnforcement: BLOCK_SE });
    expect(html).toContain('role="region"');
    expect(html).toContain("Resultado do Supervisor de Seguran\u00e7a");
  });

  // ── 18–19. Degradação: sem campo ──────────────────────────────────────────

  it("18. payload explicitamente sem supervisor_enforcement → string vazia", () => {
    const html = render({ supervisorEnforcement: null });
    expect(html).toBe("");
  });

  it("19. IDLE mock (execution=null) — supervisor_enforcement ausente, sem crash", () => {
    // IDLE mock é null; simula o comportamento do ExecutionPage (execution?.supervisor_enforcement)
    const exec = MOCK_EXECUTIONS[EXECUTION_STATUS.IDLE];
    const se   = exec?.supervisor_enforcement ?? null;
    expect(se).toBeNull();
    expect(render({ supervisorEnforcement: se })).toBe("");
  });

  // ── 20–22. Verificação dos mocks ─────────────────────────────────────────

  it("20. BLOCKED mock tem supervisor_enforcement com decision=block", () => {
    expect(BLOCK_SE).toBeTruthy();
    expect(BLOCK_SE.decision).toBe("block");
  });

  it("21. COMPLETED mock tem supervisor_enforcement com decision=allow", () => {
    expect(ALLOW_SE).toBeTruthy();
    expect(ALLOW_SE.decision).toBe("allow");
  });

  it("22. RUNNING mock tem supervisor_enforcement com decision=needs_human_review", () => {
    expect(REVIEW_SE).toBeTruthy();
    expect(REVIEW_SE.decision).toBe("needs_human_review");
  });

});
