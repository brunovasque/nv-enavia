import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const LOOP_PAGE_SRC = readFileSync(
  resolve(import.meta.dirname, "..", "pages", "LoopPage.jsx"),
  "utf8",
);

describe("PR12 — LoopPage usa contract do loop-status", () => {
  it("exibe contrato/status/fase/task/updated_at a partir de loopData.contract", () => {
    expect(LOOP_PAGE_SRC).toContain("const contract         = loopData?.contract         ?? null;");
    expect(LOOP_PAGE_SRC).toContain('value={contract?.id}');
    expect(LOOP_PAGE_SRC).toContain('value={contract?.status}');
    expect(LOOP_PAGE_SRC).toContain('value={contract?.current_phase}');
    expect(LOOP_PAGE_SRC).toContain('value={contract?.current_task}');
    expect(LOOP_PAGE_SRC).toContain('value={contract?.updated_at}');
  });

  it("não usa mais loop.contract_id nem loop.status_global na seção de status", () => {
    expect(LOOP_PAGE_SRC).not.toContain("loop.contract_id");
    expect(LOOP_PAGE_SRC).not.toContain("loop.status_global");
  });
});

describe("PR12 — LoopPage preserva payload canônico do backend em executeNext", () => {
  it("prioriza r.data mesmo quando a chamada não vem com r.ok=true", () => {
    const canonicalPayloadIdx = LOOP_PAGE_SRC.indexOf("if (r.data) {");
    const okBranchIdx = LOOP_PAGE_SRC.indexOf("} else if (r.ok) {");

    expect(canonicalPayloadIdx).toBeGreaterThan(-1);
    expect(okBranchIdx).toBeGreaterThan(canonicalPayloadIdx);
    expect(LOOP_PAGE_SRC).toContain("setExecResult(r.data);");
  });

  it("mantém fallback genérico apenas quando r.data não existe", () => {
    expect(LOOP_PAGE_SRC).toContain('status: "error"');
    expect(LOOP_PAGE_SRC).toContain('reason: r.error?.message ?? "Erro de rede ao executar."');
  });
});
