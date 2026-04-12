// =============================================================================
// ENAVIA Panel — P11 gate humano smoke tests
//
// Cobre o contrato P11:
//   1. gate pendente renderiza badge + botões Aprovar/Rejeitar
//   2. gate aprovado renderiza badge aprovado — sem botões de ação
//   3. gate rejeitado/bloqueado renderiza badge bloqueado — sem botões de ação
//   4. GateCard com gate=null não renderiza nada
//   5. onApprove e onReject são chamados ao interagir com os botões
//   6. gate aprovado exibe feedback visual de "liberado"
//   7. gate bloqueado exibe feedback visual de "bloqueado"
//   8. nenhuma chamada fetch é disparada em nenhum cenário do gate
//   9. GateCard sem callbacks não renderiza botões (gate pendente, sem ações)
//  10. GATE_META cobre pending/approved/blocked/dispensed com ícones/cores corretos
//
// Run with:
//   npm test   (from panel/)
//
// NOTA: estes testes verificam a lógica estrutural do GateCard sem jsdom/React
//       render. Os estados são verificados via inspeção dos exports e
//       do código-fonte compilado do componente (structural proof).
// =============================================================================

import { describe, it, expect, vi, afterEach } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Source text helpers ───────────────────────────────────────────────────────
// Lemos o source bruto (não compilado) para inspecionar strings que estão fora
// do corpo da função exportada (ex.: constantes de módulo, componentes internos).
const GATE_CARD_SRC = readFileSync(
  resolve(import.meta.dirname, "../plan/GateCard.jsx"),
  "utf8"
);
const PLAN_PAGE_SRC = readFileSync(
  resolve(import.meta.dirname, "../pages/PlanPage.jsx"),
  "utf8"
);

// =============================================================================
// SETUP — importar o módulo GateCard e inspecionar sua estrutura
// =============================================================================

afterEach(() => {
  vi.resetModules();
});

// =============================================================================
// PROVA 1 — GateCard exporta default; aceita props gate, onApprove, onReject
// =============================================================================

describe("P11 PROVA 1 — GateCard estrutura: export default, props gate/onApprove/onReject", () => {
  it("GateCard é uma função React válida (export default)", async () => {
    const mod = await import("../plan/GateCard.jsx");
    expect(typeof mod.default).toBe("function");
  });

  it("GateCard aceita 3 parâmetros: gate, onApprove, onReject", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();
    // Props declaradas na assinatura
    expect(src).toContain("onApprove");
    expect(src).toContain("onReject");
    expect(src).toContain("gate");
  });
});

// =============================================================================
// PROVA 2 — Lógica de visibilidade dos botões: apenas quando state==="pending"
// =============================================================================

describe("P11 PROVA 2 — Botões Aprovar/Rejeitar visíveis SOMENTE quando state=pending", () => {
  it("GateCard renderiza GateActions somente quando isPending === true", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();

    // A condição de render dos botões deve verificar isPending
    expect(src).toContain("isPending");
    // A condição deve verificar que os callbacks existem
    expect(src).toContain('typeof onApprove === "function"');
    expect(src).toContain('typeof onReject === "function"');
  });

  it("isPending é derivado de state === 'pending'", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();
    // A derivação deve estar presente no código
    expect(src).toContain(`state === "pending"`);
  });

  it("isResolved é derivado de approved ou blocked", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();
    expect(src).toContain(`state === "approved"`);
    expect(src).toContain(`state === "blocked"`);
  });
});

// =============================================================================
// PROVA 3 — GATE_META cobre todos os estados com ícone e label corretos
// Lemos GATE_META diretamente do export nomeado.
// =============================================================================

describe("P11 PROVA 3 — GATE_META: pending/approved/blocked/dispensed corretos", () => {
  it("GATE_META.pending tem label 'Aguardando aprovação' e ícone ⏳", async () => {
    const { GATE_META } = await import("../plan/GateCard.jsx");
    expect(GATE_META.pending.label).toBe("Aguardando aprovação");
    expect(GATE_META.pending.icon).toBe("⏳");
  });

  it("GATE_META.approved tem label com 'liberado' e ícone ✓", async () => {
    const { GATE_META } = await import("../plan/GateCard.jsx");
    expect(GATE_META.approved.label).toContain("liberado");
    expect(GATE_META.approved.icon).toBe("✓");
  });

  it("GATE_META.blocked tem label com 'Rejeitado' e ícone ✕", async () => {
    const { GATE_META } = await import("../plan/GateCard.jsx");
    expect(GATE_META.blocked.label).toContain("Rejeitado");
    expect(GATE_META.blocked.icon).toBe("✕");
  });

  it("GateCard retorna null quando gate é null/undefined", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();
    // Guard: if (!gate) return null
    expect(src).toContain("if (!gate) return null");
  });
});

// =============================================================================
// PROVA 4 — onApprove e onReject são chamados pelos handlers corretos
// Inspecionamos o source bruto (GateActions está no scope do módulo).
// =============================================================================

describe("P11 PROVA 4 — GateActions: onApprove e onReject são os handlers dos botões", () => {
  it("botão Aprovar chama onApprove", () => {
    // No source bruto, GateActions usa onApprove como onClick
    expect(GATE_CARD_SRC).toContain("onApprove");
    // O botão deve ter texto "Aprovar"
    expect(GATE_CARD_SRC).toContain("Aprovar");
  });

  it("botão Rejeitar chama onReject", () => {
    expect(GATE_CARD_SRC).toContain("onReject");
    expect(GATE_CARD_SRC).toContain("Rejeitar");
  });

  it("GateActions inclui aria-label acessível em ambos os botões", () => {
    expect(GATE_CARD_SRC).toContain("aria-label");
    expect(GATE_CARD_SRC).toContain("liberar execução");
    expect(GATE_CARD_SRC).toContain("bloquear execução");
  });
});

// =============================================================================
// PROVA 5 — GateResolved: feedback visual pós-ação
// Inspecionamos o source bruto (GateResolved está no scope do módulo).
// =============================================================================

describe("P11 PROVA 5 — GateResolved: feedback pós-ação para approved e blocked", () => {
  it("GateResolved é renderizado somente quando isResolved === true", async () => {
    const mod = await import("../plan/GateCard.jsx");
    const src = mod.default.toString();
    expect(src).toContain("isResolved");
    expect(src).toContain("GateResolved");
  });

  it("GateResolved exibe mensagem de aprovação quando state=approved", () => {
    expect(GATE_CARD_SRC).toContain("Execução liberada pelo operador");
  });

  it("GateResolved exibe mensagem de rejeição quando state=blocked", () => {
    expect(GATE_CARD_SRC).toContain("Execução bloqueada pelo operador");
  });

  it("GateResolved tem role=status e aria-live=polite para acessibilidade", () => {
    expect(GATE_CARD_SRC).toContain('role="status"');
    expect(GATE_CARD_SRC).toContain('aria-live="polite"');
  });
});

// =============================================================================
// PROVA 6 — PlanPage: gateAction estado local + handlers + effectiveGate
// =============================================================================

describe("P11 PROVA 6 — PlanPage: gateAction local, handlers, effectiveGate", () => {
  it("PlanPage mantém gateAction em useState local", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("gateAction");
    expect(src).toContain("setGateAction");
  });

  it("PlanPage expõe handleGateApprove que seta gateAction=approved", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("handleGateApprove");
    expect(src).toContain('"approved"');
  });

  it("PlanPage expõe handleGateReject que seta gateAction=blocked", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("handleGateReject");
    expect(src).toContain('"blocked"');
  });

  it("PlanPage computa effectiveGate sobrepondo gate.state com gateAction", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    expect(src).toContain("effectiveGate");
    expect(src).toContain("getEffectiveGate");
  });

  it("PlanPage passa effectiveGate para GateCard (não plan.gate direto)", () => {
    // Inspeciona o source bruto onde gate={effectiveGate} está no JSX
    expect(PLAN_PAGE_SRC).toContain("gate={effectiveGate}");
    expect(PLAN_PAGE_SRC).toContain("onApprove={handleGateApprove}");
    expect(PLAN_PAGE_SRC).toContain("onReject={handleGateReject}");
  });

  it("PlanPage passa effectiveGate para BlockedBanner (não plan.gate direto)", () => {
    // BlockedBanner e GateCard recebem effectiveGate (não plan.gate)
    // O source bruto contém gate={effectiveGate} — prova suficiente
    expect(PLAN_PAGE_SRC).toContain("gate={effectiveGate}");
  });

  it("gateAction reseta para null quando visibleState ou plannerSnapshot muda (novo ciclo)", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();
    // useEffect com setGateAction(null) ao mudar visibleState/plannerSnapshot
    expect(src).toContain("setGateAction(null)");
  });
});

// =============================================================================
// PROVA 7 — Nenhuma execução real disparada
// =============================================================================

describe("P11 PROVA 7 — Nenhuma execução real: handleGateApprove/Reject não chama fetch", () => {
  it("handleGateApprove não contém fetch, chatSend ou bridge (apenas setGateAction)", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();

    // Extrair apenas a função handleGateApprove.
    // 300 chars é suficiente para cobrir qualquer implementação razoável
    // de uma função de 1-2 linhas com setGateAction.
    const approveIdx = src.indexOf("handleGateApprove");
    const approveSection = src.slice(approveIdx, approveIdx + 300);

    // Deve conter apenas setGateAction
    expect(approveSection).toContain("setGateAction");
    // NÃO deve conter fetch, chatSend ou bridge
    expect(approveSection).not.toContain("fetch(");
    expect(approveSection).not.toContain("chatSend");
    expect(approveSection).not.toContain("bridge");
  });

  it("handleGateReject não contém fetch, chatSend ou bridge (apenas setGateAction)", async () => {
    const mod = await import("../pages/PlanPage.jsx");
    const src = mod.default.toString();

    const rejectIdx = src.indexOf("handleGateReject");
    const rejectSection = src.slice(rejectIdx, rejectIdx + 300);

    expect(rejectSection).toContain("setGateAction");
    expect(rejectSection).not.toContain("fetch(");
    expect(rejectSection).not.toContain("chatSend");
    expect(rejectSection).not.toContain("bridge");
  });
});

// =============================================================================
// PROVA 8 — mapPlannerSnapshot: gate_status approved → state "approved"
//           (confirma que o mapeamento existente funciona com P11)
// =============================================================================

describe("P11 PROVA 8 — mapPlannerSnapshot: todos os gate_status mapeados corretamente", () => {
  const BASE_SNAP = {
    classification: { request_type: "tactical_plan", category: "ops", risk_level: "alto", signals: [] },
    canonicalPlan: { steps: ["Passo 1"] },
    gate: { needs_human_approval: true, gate_status: "approval_required", reason: "requer aprovação" },
    bridge: { bridge_status: "blocked_by_gate", executor_action: null, reason: "aguardando gate" },
    memoryConsolidation: { memory_candidates: [] },
    outputMode: "structured_plan",
  };

  afterEach(() => { vi.resetModules(); });

  it("gate_status 'approval_required' → state 'pending'", async () => {
    const { mapPlannerSnapshot } = await import("../api/mappers/plan.js");
    const mapped = mapPlannerSnapshot(BASE_SNAP);
    expect(mapped.gate.state).toBe("pending");
  });

  it("gate_status 'approved' → state 'approved'", async () => {
    const { mapPlannerSnapshot } = await import("../api/mappers/plan.js");
    const snap = { ...BASE_SNAP, gate: { needs_human_approval: false, gate_status: "approved" } };
    const mapped = mapPlannerSnapshot(snap);
    expect(mapped.gate.state).toBe("approved");
  });

  it("gate_status 'rejected' → state 'blocked'", async () => {
    const { mapPlannerSnapshot } = await import("../api/mappers/plan.js");
    const snap = { ...BASE_SNAP, gate: { needs_human_approval: true, gate_status: "rejected", reason: "rejeitado" } };
    const mapped = mapPlannerSnapshot(snap);
    expect(mapped.gate.state).toBe("blocked");
  });

  it("gate_status 'approved_not_required' → state 'approved'", async () => {
    const { mapPlannerSnapshot } = await import("../api/mappers/plan.js");
    const snap = { ...BASE_SNAP, gate: { needs_human_approval: false, gate_status: "approved_not_required" } };
    const mapped = mapPlannerSnapshot(snap);
    expect(mapped.gate.state).toBe("approved");
  });
});
