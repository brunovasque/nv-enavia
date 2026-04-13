// =============================================================================
// ENAVIA Panel — PR2 exec_event source smoke tests
//
// Verifica que o mapper de execução:
//   1. Deriva campos reais dos 6 campos PR1 quando exec_event está presente
//   2. Preserva dados mock/existentes quando não há exec_event
//   3. Cobre todos os 5 blocos: operation, liveTrail, codeTrail,
//      incrementalDiff, changeHistory, events
//   4. Marca objetos derivados com _pr2Source: 'exec_event' (honestidade)
//   5. Não inventa dados que PR1 não fornece (campos ausentes = null)
//
// Blocks REAL mínimo (dados de exec_event):
//   - Operação ao vivo (operation):  action, microStep, reason
//   - Trilha viva (liveTrail):       file, block, status, actionSummary
//   - Código ao vivo (codeTrail):    file, block, justification
//   - Diff (incrementalDiff):        file, block, changeSummary (sem lines reais)
//   - Mudanças (changeHistory):      file, patchStatus, change summary
//   - Replay (events):               tipo, label, timestamp, status
//
// Blocks ainda parciais (não disponíveis em PR1):
//   - operation.contract, operation.nextStep         → null (honesto)
//   - liveTrail.operationType                        → null (honesto)
//   - codeTrail.operationType, diffSummary, outOfScope → null (honesto)
//   - incrementalDiff.lines                          → [] (PR1 dá ID, não diff real)
// =============================================================================

import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { mapExecutionResponse } from "../api/mappers/execution.js";
import LiveTrailCard from "../execution/LiveTrailCard.jsx";
import CodeTrailCard from "../execution/CodeTrailCard.jsx";
import IncrementalDiffCard from "../execution/IncrementalDiffCard.jsx";
import ConsolidatedFeedCard from "../execution/ConsolidatedFeedCard.jsx";
import { MOCK_EXECUTIONS, EXECUTION_STATUS } from "../execution/mockExecution.js";

function render(Component, props) {
  return renderToStaticMarkup(createElement(Component, props));
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const EXEC_EVENT_RUNNING = {
  status_atual:   "running",
  arquivo_atual:  "contract-executor.js",
  bloco_atual:    "task_001",
  operacao_atual: "Executando micro-PR de ajuste de validação de etapas",
  motivo_curto:   null,
  patch_atual:    "micro_pr_001",
  emitted_at:     "2026-04-13T17:00:00.000Z",
};

const EXEC_EVENT_SUCCESS = {
  status_atual:   "success",
  arquivo_atual:  "contract-executor.js",
  bloco_atual:    "task_001",
  operacao_atual: "Micro-PR de ajuste concluída com sucesso",
  motivo_curto:   null,
  patch_atual:    "micro_pr_001",
  emitted_at:     "2026-04-13T17:01:00.000Z",
};

const EXEC_EVENT_FAILED = {
  status_atual:   "failed",
  arquivo_atual:  "contract-executor.js",
  bloco_atual:    "task_002",
  operacao_atual: "Aplicando patch de correção de precedências",
  motivo_curto:   "Falha ao acessar arquivo alvo: permissão negada",
  patch_atual:    "micro_pr_002",
  emitted_at:     "2026-04-13T17:02:00.000Z",
};

// Raw object simulating what the worker now returns in real mode
function rawWithEvent(execEvent) {
  return {
    bridge_id:      "req-abc",
    dispatched_at:  "2026-04-13T17:00:00.000Z",
    executor_ok:    true,
    exec_event:     execEvent,
  };
}

// ── Group 1: mapper — exec_event present (RUNNING) ────────────────────────────

describe("PR2 exec_event source — mapper RUNNING", () => {
  const raw = rawWithEvent(EXEC_EVENT_RUNNING);
  const result = mapExecutionResponse(raw);
  const exec = result.execution;

  it("1. mapExecutionResponse retorna execution não-null", () => {
    expect(exec).not.toBeNull();
  });

  it("2. operation.action vem de operacao_atual", () => {
    expect(exec.operation.action).toBe(EXEC_EVENT_RUNNING.operacao_atual);
  });

  it("3. operation.microStep vem de bloco_atual", () => {
    expect(exec.operation.microStep).toBe(EXEC_EVENT_RUNNING.bloco_atual);
  });

  it("4. operation.reason vem de motivo_curto (null em RUNNING)", () => {
    expect(exec.operation.reason).toBeNull();
  });

  it("5. operation.contract é null (não em PR1 — honesto)", () => {
    expect(exec.operation.contract).toBeNull();
  });

  it("6. operation.nextStep é null (não em PR1 — honesto)", () => {
    expect(exec.operation.nextStep).toBeNull();
  });

  it("7. operation._pr2Source é 'exec_event'", () => {
    expect(exec.operation._pr2Source).toBe("exec_event");
  });

  it("8. liveTrail.file vem de arquivo_atual", () => {
    expect(exec.liveTrail.file).toBe(EXEC_EVENT_RUNNING.arquivo_atual);
  });

  it("9. liveTrail.block vem de bloco_atual", () => {
    expect(exec.liveTrail.block).toBe(EXEC_EVENT_RUNNING.bloco_atual);
  });

  it("10. liveTrail.status vem de status_atual", () => {
    expect(exec.liveTrail.status).toBe("running");
  });

  it("11. liveTrail.actionSummary vem de operacao_atual", () => {
    expect(exec.liveTrail.actionSummary).toBe(EXEC_EVENT_RUNNING.operacao_atual);
  });

  it("12. liveTrail.operationType é null (não em PR1 — honesto)", () => {
    expect(exec.liveTrail.operationType).toBeNull();
  });

  it("13. liveTrail._pr2Source é 'exec_event'", () => {
    expect(exec.liveTrail._pr2Source).toBe("exec_event");
  });

  it("14. codeTrail.file vem de arquivo_atual", () => {
    expect(exec.codeTrail.file).toBe(EXEC_EVENT_RUNNING.arquivo_atual);
  });

  it("15. codeTrail.block vem de bloco_atual", () => {
    expect(exec.codeTrail.block).toBe(EXEC_EVENT_RUNNING.bloco_atual);
  });

  it("16. codeTrail.justification vem de operacao_atual", () => {
    expect(exec.codeTrail.justification).toBe(EXEC_EVENT_RUNNING.operacao_atual);
  });

  it("17. codeTrail.diffSummary é null (PR1 dá ID, não diff real — honesto)", () => {
    expect(exec.codeTrail.diffSummary).toBeNull();
  });

  it("18. codeTrail._pr2Source é 'exec_event'", () => {
    expect(exec.codeTrail._pr2Source).toBe("exec_event");
  });

  it("19. incrementalDiff.file vem de arquivo_atual", () => {
    expect(exec.incrementalDiff.file).toBe(EXEC_EVENT_RUNNING.arquivo_atual);
  });

  it("20. incrementalDiff.block vem de bloco_atual", () => {
    expect(exec.incrementalDiff.block).toBe(EXEC_EVENT_RUNNING.bloco_atual);
  });

  it("21. incrementalDiff.changeSummary vem de patch_atual", () => {
    expect(exec.incrementalDiff.changeSummary).toBe(EXEC_EVENT_RUNNING.patch_atual);
  });

  it("22. incrementalDiff.lines é array vazio (PR1 não fornece linhas reais)", () => {
    expect(Array.isArray(exec.incrementalDiff.lines)).toBe(true);
    expect(exec.incrementalDiff.lines.length).toBe(0);
  });

  it("23. incrementalDiff._pr2Source é 'exec_event'", () => {
    expect(exec.incrementalDiff._pr2Source).toBe("exec_event");
  });

  it("24. changeHistory é array com 1 grupo", () => {
    expect(Array.isArray(exec.changeHistory)).toBe(true);
    expect(exec.changeHistory.length).toBe(1);
  });

  it("25. changeHistory[0].file vem de arquivo_atual", () => {
    expect(exec.changeHistory[0].file).toBe(EXEC_EVENT_RUNNING.arquivo_atual);
  });

  it("26. changeHistory[0].patchStatus é 'pending' em RUNNING", () => {
    expect(exec.changeHistory[0].patchStatus).toBe("pending");
  });

  it("27. changeHistory[0].changes[0].summary vem de operacao_atual", () => {
    expect(exec.changeHistory[0].changes[0].summary).toBe(EXEC_EVENT_RUNNING.operacao_atual);
  });

  it("28. changeHistory[0]._pr2Source é 'exec_event'", () => {
    expect(exec.changeHistory[0]._pr2Source).toBe("exec_event");
  });

  it("29. events é array com 1 evento", () => {
    expect(Array.isArray(exec.events)).toBe(true);
    expect(exec.events.length).toBe(1);
  });

  it("30. events[0].status é 'active' em RUNNING", () => {
    expect(exec.events[0].status).toBe("active");
  });

  it("31. events[0].type é 'STEP_STARTED' em RUNNING", () => {
    expect(exec.events[0].type).toBe("STEP_STARTED");
  });

  it("32. events[0].label vem de operacao_atual", () => {
    expect(exec.events[0].label).toBe(EXEC_EVENT_RUNNING.operacao_atual);
  });

  it("33. events[0].timestamp vem de emitted_at", () => {
    expect(exec.events[0].timestamp).toBe(EXEC_EVENT_RUNNING.emitted_at);
  });
});

// ── Group 2: mapper — exec_event SUCCESS ─────────────────────────────────────

describe("PR2 exec_event source — mapper SUCCESS", () => {
  const raw = rawWithEvent(EXEC_EVENT_SUCCESS);
  const exec = mapExecutionResponse(raw).execution;

  it("34. changeHistory[0].patchStatus é 'applied' em SUCCESS", () => {
    expect(exec.changeHistory[0].patchStatus).toBe("applied");
  });

  it("35. events[0].status é 'done' em SUCCESS", () => {
    expect(exec.events[0].status).toBe("done");
  });

  it("36. events[0].type é 'STEP_DONE' em SUCCESS", () => {
    expect(exec.events[0].type).toBe("STEP_DONE");
  });
});

// ── Group 3: mapper — exec_event FAILED ──────────────────────────────────────

describe("PR2 exec_event source — mapper FAILED", () => {
  const raw = rawWithEvent(EXEC_EVENT_FAILED);
  const exec = mapExecutionResponse(raw).execution;

  it("37. operation.reason vem de motivo_curto em FAILED", () => {
    expect(exec.operation.reason).toBe(EXEC_EVENT_FAILED.motivo_curto);
  });

  it("38. incrementalDiff.changeSummary cai para motivo_curto quando patch_atual presente", () => {
    // patch_atual existe → changeSummary = patch_atual
    expect(exec.incrementalDiff.changeSummary).toBe(EXEC_EVENT_FAILED.patch_atual);
  });

  it("39. events[0].status é 'error' em FAILED", () => {
    expect(exec.events[0].status).toBe("error");
  });

  it("40. events[0].detail vem de motivo_curto", () => {
    expect(exec.events[0].detail).toBe(EXEC_EVENT_FAILED.motivo_curto);
  });
});

// ── Group 4: mapper — sem exec_event (mock mode) ─────────────────────────────

describe("PR2 exec_event source — sem exec_event (modo mock preservado)", () => {
  it("41. raw sem exec_event retorna execution sem campos derivados", () => {
    const raw = { id: "exec-mock", status: "running" };
    const exec = mapExecutionResponse(raw).execution;
    expect(exec.operation).toBeUndefined();
    expect(exec.liveTrail).toBeUndefined();
    expect(exec.codeTrail).toBeUndefined();
    expect(exec.incrementalDiff).toBeUndefined();
    expect(exec.changeHistory).toBeUndefined();
    expect(exec.events).toBeUndefined();
  });

  it("42. mock RUNNING data preservada sem alteração (mock fields têm precedência)", () => {
    // Simula mock com operation já definida + exec_event chegando junto
    const raw = {
      ...MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING],
      exec_event: EXEC_EVENT_RUNNING,
    };
    const exec = mapExecutionResponse(raw).execution;
    // operation do mock deve ser preservada (não substituída por exec_event)
    expect(exec.operation.action).toBe(MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].operation.action);
    expect(exec.liveTrail.file).toBe(MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].liveTrail.file);
  });

  it("43. raw=null retorna execution=null", () => {
    const result = mapExecutionResponse(null);
    expect(result.execution).toBeNull();
  });
});

// ── Group 5: componentes — badge MÍNIMO REAL com exec_event ──────────────────

describe("PR2 exec_event source — badge MÍNIMO REAL nos componentes", () => {
  const liveTrailReal = {
    file:          "contract-executor.js",
    block:         "task_001",
    operationType: null,
    status:        "running",
    actionSummary: "Executando micro-PR",
    _pr2Source:    "exec_event",
  };

  it("44. LiveTrailCard mostra 'MÍNIMO REAL' quando _pr2Source=exec_event", () => {
    const html = render(LiveTrailCard, { liveTrail: liveTrailReal });
    expect(html).toContain("MÍNIMO REAL");
    expect(html).not.toContain("DEMO");
  });

  it("45. LiveTrailCard ainda mostra 'DEMO' com dados mock sem _pr2Source", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].liveTrail;
    const html = render(LiveTrailCard, { liveTrail: trail });
    expect(html).toContain("DEMO");
    expect(html).not.toContain("MÍNIMO REAL");
  });

  it("46. CodeTrailCard mostra 'MÍNIMO REAL' quando _pr2Source=exec_event", () => {
    const codeTrailReal = {
      file: "contract-executor.js", block: "task_001",
      operationType: null, diffSummary: null, justification: "Executando",
      outOfScope: null, _pr2Source: "exec_event",
    };
    const html = render(CodeTrailCard, { codeTrail: codeTrailReal });
    expect(html).toContain("MÍNIMO REAL");
  });

  it("47. CodeTrailCard ainda mostra 'DEMO' com dados mock sem _pr2Source", () => {
    const trail = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].codeTrail;
    const html = render(CodeTrailCard, { codeTrail: trail });
    expect(html).toContain("DEMO");
  });

  it("48. IncrementalDiffCard mostra 'MÍNIMO REAL' quando _pr2Source=exec_event", () => {
    const diffReal = {
      file: "contract-executor.js", block: "task_001",
      lines: [], changeSummary: "micro_pr_001", _pr2Source: "exec_event",
    };
    const html = render(IncrementalDiffCard, { incrementalDiff: diffReal });
    expect(html).toContain("MÍNIMO REAL");
  });

  it("49. IncrementalDiffCard ainda mostra 'DEMO' com dados mock sem _pr2Source", () => {
    const diff = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].incrementalDiff;
    const html = render(IncrementalDiffCard, { incrementalDiff: diff });
    expect(html).toContain("DEMO");
  });

  it("50. ConsolidatedFeedCard mostra 'MÍNIMO REAL' quando _pr2Source=exec_event", () => {
    const histReal = [
      {
        file: "contract-executor.js",
        patchStatus: "pending",
        _pr2Source: "exec_event",
        changes: [{ id: "1", seq: 1, summary: "op", status: "pending" }],
      },
    ];
    const html = render(ConsolidatedFeedCard, { changeHistory: histReal });
    expect(html).toContain("MÍNIMO REAL");
  });

  it("51. ConsolidatedFeedCard ainda mostra 'DEMO' com dados mock sem _pr2Source", () => {
    const hist = MOCK_EXECUTIONS[EXECUTION_STATUS.RUNNING].changeHistory;
    const html = render(ConsolidatedFeedCard, { changeHistory: hist });
    expect(html).toContain("DEMO");
  });
});

// ── Group 6: regressões — blocos existentes não quebram ──────────────────────

describe("PR2 exec_event source — sem regressão dos blocos anteriores", () => {
  it("52. LiveTrailCard com null não quebra", () => {
    expect(() => render(LiveTrailCard, { liveTrail: null })).not.toThrow();
    expect(render(LiveTrailCard, { liveTrail: null })).toContain("SEM DADOS");
  });

  it("53. CodeTrailCard com null não quebra", () => {
    expect(() => render(CodeTrailCard, { codeTrail: null })).not.toThrow();
    expect(render(CodeTrailCard, { codeTrail: null })).toContain("SEM DADOS");
  });

  it("54. IncrementalDiffCard com null não quebra", () => {
    expect(() => render(IncrementalDiffCard, { incrementalDiff: null })).not.toThrow();
    expect(render(IncrementalDiffCard, { incrementalDiff: null })).toContain("SEM DADOS");
  });

  it("55. ConsolidatedFeedCard com null não quebra", () => {
    expect(() => render(ConsolidatedFeedCard, { changeHistory: null })).not.toThrow();
    expect(render(ConsolidatedFeedCard, { changeHistory: null })).toContain("SEM DADOS");
  });

  it("56. mapExecutionResponse com exec_event=null não adiciona campos derivados", () => {
    const raw = { bridge_id: "req-1", exec_event: null };
    const exec = mapExecutionResponse(raw).execution;
    expect(exec.operation).toBeUndefined();
    expect(exec.liveTrail).toBeUndefined();
  });

  it("57. mapExecutionResponse preserva fetchedAt como ISO string", () => {
    const result = mapExecutionResponse({ bridge_id: "req-1" });
    expect(typeof result.fetchedAt).toBe("string");
    expect(new Date(result.fetchedAt).toISOString()).toBeTruthy();
  });

  it("58. arquivo_atual=null → changeHistory=null (não cria grupo vazio)", () => {
    const raw = rawWithEvent({ ...EXEC_EVENT_RUNNING, arquivo_atual: null });
    const exec = mapExecutionResponse(raw).execution;
    expect(exec.changeHistory).toBeNull();
  });
});
