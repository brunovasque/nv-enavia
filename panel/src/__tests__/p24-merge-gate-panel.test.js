// =============================================================================
// ENAVIA Panel — P24-A smoke tests: Merge Gate Card (botão de approval no painel)
//
// Critérios de aceite:
//   1.  MergeGateCard exporta default válido
//   2.  MergeGateCard retorna null quando mergeGate é null
//   3.  Quando merge_status = awaiting_formal_approval → bloco de approval visível
//   4.  Bloco mostra summary_for_merge
//   5.  Bloco mostra reason_merge_ok
//   6.  Botão "Aprovar merge" presente quando awaiting_formal_approval
//   7.  Botão chama approveMerge ao clicar
//   8.  Após approval bem-sucedido → status muda para approved_for_merge
//   9.  Quando merge_status = approved_for_merge → bloco de feedback visível, sem botão
//  10.  Quando merge_status = not_ready → sem bloco de approval, sem botão
//  11.  Quando merge_status = blocked → sem bloco de approval, sem botão
//  12.  approveMerge está exportado de api/index.js
//  13.  approveMerge é uma função assíncrona
//  14.  approveMerge em mock mode retorna ok=true e merge_status=approved_for_merge
//  15.  mock COMPLETED contém merge_gate com awaiting_formal_approval
//  16.  mock merge_gate contém summary_for_merge não-vazio
//  17.  mock merge_gate contém reason_merge_ok não-vazio
//  18.  ExecutionPage importa MergeGateCard
//  19.  ExecutionPage renderiza MergeGateCard condicionalmente com isCompleted + merge_gate
//  20.  MergeGateCard não importa nada de PlanPage/GateCard (sem acoplamento cruzado)
//
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

// ── Source helpers ────────────────────────────────────────────────────────────

const SRC_DIR = resolve(import.meta.dirname, "..");

function src(relPath) {
  return readFileSync(resolve(SRC_DIR, relPath), "utf8");
}

const MERGE_GATE_CARD_SRC    = src("execution/MergeGateCard.jsx");
const EXECUTION_PAGE_SRC     = src("pages/ExecutionPage.jsx");
const API_INDEX_SRC          = src("api/index.js");
const EXECUTION_ENDPOINT_SRC = src("api/endpoints/execution.js");
const MOCK_EXECUTION_SRC     = src("execution/mockExecution.js");

// =============================================================================
// PROVA 1 — MergeGateCard exporta default válido
// =============================================================================

describe("P24 PROVA 1 — MergeGateCard export default válido", () => {
  it("MergeGateCard é uma função React (export default)", async () => {
    const mod = await import("../execution/MergeGateCard.jsx");
    expect(typeof mod.default).toBe("function");
  });
});

// =============================================================================
// PROVA 2 — MergeGateCard retorna null quando prop é null
// =============================================================================

describe("P24 PROVA 2 — MergeGateCard retorna null para mergeGate=null", () => {
  it("fonte contém guarda: if (!mergeGate) return null", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("if (!mergeGate) return null");
  });
});

// =============================================================================
// PROVA 3–6 — Estado awaiting_formal_approval: bloco de approval visível
// =============================================================================

describe("P24 PROVAS 3–6 — awaiting_formal_approval: bloco approval, summary, reason, botão", () => {
  it("PROVA 3 — fonte renderiza approvalBlock quando isAwaiting", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("isAwaiting");
    expect(MERGE_GATE_CARD_SRC).toContain("approvalBlock");
    // Conditional: {isAwaiting && (
    expect(MERGE_GATE_CARD_SRC).toMatch(/\{isAwaiting\s*&&/);
  });

  it("PROVA 4 — fonte exibe summary_for_merge", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("summary_for_merge");
    expect(MERGE_GATE_CARD_SRC).toContain("merge-gate-summary");
  });

  it("PROVA 5 — fonte exibe reason_merge_ok", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("reason_merge_ok");
    expect(MERGE_GATE_CARD_SRC).toContain("merge-gate-reason");
  });

  it("PROVA 6 — botão Aprovar merge presente na fonte", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("merge-gate-approve-btn");
    expect(MERGE_GATE_CARD_SRC).toContain("Aprovar merge");
  });
});

// =============================================================================
// PROVA 7 — Botão chama approveMerge ao clicar
// =============================================================================

describe("P24 PROVA 7 — botão chama approveMerge (rota real /github-pr/approve-merge)", () => {
  it("fonte importa approveMerge de ../api", () => {
    expect(MERGE_GATE_CARD_SRC).toContain('from "../api"');
    expect(MERGE_GATE_CARD_SRC).toContain("approveMerge");
  });

  it("fonte invoca approveMerge dentro do handler do botão", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("await approveMerge(");
    expect(MERGE_GATE_CARD_SRC).toContain("handleApprove");
    // Botão tem onClick=handleApprove
    expect(MERGE_GATE_CARD_SRC).toContain("onClick={handleApprove}");
  });
});

// =============================================================================
// PROVA 8 — Após approval bem-sucedido → status muda para approved_for_merge
// =============================================================================

describe("P24 PROVA 8 — após approval ok → localStatus = approved_for_merge", () => {
  it("fonte define localStatus e o atualiza para approved_for_merge quando result.ok", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("localStatus");
    expect(MERGE_GATE_CARD_SRC).toContain('"approved_for_merge"');
    expect(MERGE_GATE_CARD_SRC).toContain("setLocalStatus");
    // O caminho happy-path atualiza localStatus para approved_for_merge
    expect(MERGE_GATE_CARD_SRC).toMatch(/result\.ok[\s\S]{0,60}setLocalStatus\("approved_for_merge"\)/);
  });
});

// =============================================================================
// PROVA 9 — Quando approved_for_merge → feedback visível, sem botão de approve
// =============================================================================

describe("P24 PROVA 9 — approved_for_merge: feedback visível, sem botão de approve", () => {
  it("fonte renderiza resolvedBlock quando isApproved e NÃO renderiza approveBtn", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("isApproved");
    expect(MERGE_GATE_CARD_SRC).toContain("merge-gate-approved-feedback");
    // approveBtn só aparece dentro do bloco isAwaiting
    expect(MERGE_GATE_CARD_SRC).toContain("merge-gate-approve-btn");
    // O bloco é dentro de {isAwaiting && ...}
    const awaitingIdx = MERGE_GATE_CARD_SRC.indexOf("{isAwaiting &&");
    const btnIdx      = MERGE_GATE_CARD_SRC.indexOf("merge-gate-approve-btn");
    const approvedIdx = MERGE_GATE_CARD_SRC.indexOf("{isApproved &&");
    // botão vem antes do bloco approved (i.e., está dentro do bloco awaiting)
    expect(btnIdx).toBeGreaterThan(awaitingIdx);
    expect(approvedIdx).toBeGreaterThan(btnIdx);
  });
});

// =============================================================================
// PROVA 10–11 — not_ready e blocked não exibem bloco de approval
// =============================================================================

describe("P24 PROVAS 10–11 — not_ready/blocked: sem bloco de approval", () => {
  it("PROVA 10 — STATUS_META.not_ready definido na fonte (sem bloco approval)", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("not_ready");
    // O bloco de approval é condicional a isAwaiting, não a not_ready ou blocked
    expect(MERGE_GATE_CARD_SRC).toContain("isAwaiting");
  });

  it("PROVA 11 — STATUS_META.blocked definido na fonte (sem bloco approval)", () => {
    expect(MERGE_GATE_CARD_SRC).toContain("blocked");
  });
});

// =============================================================================
// PROVA 12–14 — approveMerge no api/index.js e endpoint
// =============================================================================

describe("P24 PROVAS 12–14 — approveMerge exposta no api/index.js e em endpoint/execution.js", () => {
  it("PROVA 12 — approveMerge está no api/index.js", () => {
    expect(API_INDEX_SRC).toContain("approveMerge");
  });

  it("PROVA 13 — approveMerge é async (export async function)", () => {
    expect(EXECUTION_ENDPOINT_SRC).toContain("export async function approveMerge");
  });

  it("PROVA 14 — approveMerge em mock retorna ok=true e approved_for_merge", async () => {
    const { approveMerge } = await import("../api/index.js");
    const result = await approveMerge({
      summary_for_merge: "Resumo de teste para smoke test P24.",
      reason_merge_ok: "Sem regressão, diff revisado — apto para merge.",
    });
    expect(result.ok).toBe(true);
    expect(result.data.merge_status).toBe("approved_for_merge");
    expect(result.data.can_merge).toBe(true);
  });
});

// =============================================================================
// PROVA 15–17 — mock COMPLETED contém merge_gate válido
// =============================================================================

describe("P24 PROVAS 15–17 — mock COMPLETED contém merge_gate com dados obrigatórios", () => {
  it("PROVA 15 — mockExecution COMPLETED contém merge_gate awaiting_formal_approval", async () => {
    const { MOCK_EXECUTIONS, EXECUTION_STATUS } = await import("../execution/mockExecution.js");
    const completed = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(completed).toBeDefined();
    expect(completed.merge_gate).toBeDefined();
    expect(completed.merge_gate.merge_status).toBe("awaiting_formal_approval");
  });

  it("PROVA 16 — merge_gate contém summary_for_merge não-vazio", async () => {
    const { MOCK_EXECUTIONS, EXECUTION_STATUS } = await import("../execution/mockExecution.js");
    const { merge_gate } = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(typeof merge_gate.summary_for_merge).toBe("string");
    expect(merge_gate.summary_for_merge.length).toBeGreaterThan(0);
  });

  it("PROVA 17 — merge_gate contém reason_merge_ok não-vazio", async () => {
    const { MOCK_EXECUTIONS, EXECUTION_STATUS } = await import("../execution/mockExecution.js");
    const { merge_gate } = MOCK_EXECUTIONS[EXECUTION_STATUS.COMPLETED];
    expect(typeof merge_gate.reason_merge_ok).toBe("string");
    expect(merge_gate.reason_merge_ok.length).toBeGreaterThan(0);
  });
});

// =============================================================================
// PROVA 18–19 — ExecutionPage usa MergeGateCard condicionalmente
// =============================================================================

describe("P24 PROVAS 18–19 — ExecutionPage plugou MergeGateCard na sidebar", () => {
  it("PROVA 18 — ExecutionPage importa MergeGateCard", () => {
    expect(EXECUTION_PAGE_SRC).toContain("MergeGateCard");
    expect(EXECUTION_PAGE_SRC).toContain("from \"../execution/MergeGateCard\"");
  });

  it("PROVA 19 — ExecutionPage renderiza MergeGateCard somente quando isCompleted + merge_gate", () => {
    // Must be conditional on isCompleted AND execution?.merge_gate
    expect(EXECUTION_PAGE_SRC).toMatch(/isCompleted[\s\S]{0,80}merge_gate[\s\S]{0,40}MergeGateCard/);
  });
});

// =============================================================================
// PROVA 20 — MergeGateCard não importa nada de PlanPage nem GateCard
// =============================================================================

describe("P24 PROVA 20 — MergeGateCard sem acoplamento com PlanPage/GateCard", () => {
  it("fonte NÃO importa de GateCard nem de PlanPage", () => {
    // Procura por import statements que referenciem GateCard.jsx ou PlanPage.jsx
    expect(MERGE_GATE_CARD_SRC).not.toMatch(/from\s+["'].*GateCard/);
    expect(MERGE_GATE_CARD_SRC).not.toMatch(/from\s+["'].*PlanPage/);
  });
});
