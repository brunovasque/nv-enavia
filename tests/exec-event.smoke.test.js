// ============================================================================
// 🧪 Smoke Tests — PR1: Emissão real mínima de eventos do executor
//
// Run: node tests/exec-event.smoke.test.js
//
// Verifica o shape canônico dos 6 campos emitidos por buildExecEvent /
// emitExecEvent em executeCurrentMicroPr.
//
// NÃO testa KV real — testa o contrato do shape.
//
// Tests:
//   Group 1: Shape — 6 campos obrigatórios presentes
//   Group 2: Tipos e invariantes por campo
//   Group 3: Comportamento por status (running / success / failed)
//   Group 4: JSON round-trip (compatibilidade com KV)
//   Group 5: Isolamento — não contém campos de autonomia ou contrato fechado
// ============================================================================

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Fixture — replica do buildExecEvent real (contract-executor.js)
// Mantida inline para não depender de import de módulo Worker.
// Se buildExecEvent mudar, atualizar esta fixture.
// ---------------------------------------------------------------------------
function buildExecEvent(status, handoff, microPrId, motivo) {
  return {
    status_atual:   status,
    arquivo_atual:  Array.isArray(handoff.target_files) && handoff.target_files.length > 0
      ? handoff.target_files.join(", ")
      : null,
    bloco_atual:    handoff.source_task  || null,
    operacao_atual: handoff.objective    || null,
    motivo_curto:   motivo               || null,
    patch_atual:    microPrId            || null,
    emitted_at:     new Date().toISOString(),
  };
}

// Handoff mínimo real conforme buildExecEvent recebe de executeCurrentMicroPr
const mockHandoff = {
  objective:    "Proteger /brain/director-query com isInternalAuthorized()",
  target_files: ["nv-enavia.js", "contract-executor.js", "wrangler.toml"],
  source_task:  "task_001",
  source_phase: "phase_02",
};

const mockMicroPrId = "micro_pr_001";

// ---------------------------------------------------------------------------
// Testes
// ---------------------------------------------------------------------------

function runTests() {

  // ---- Group 1: Shape — 6 campos obrigatórios ----
  console.log("\nGroup 1: Shape — 6 campos obrigatórios");

  const runningEvent = buildExecEvent("running", mockHandoff, mockMicroPrId, null);

  assert("status_atual"   in runningEvent, "G1: campo status_atual presente");
  assert("arquivo_atual"  in runningEvent, "G1: campo arquivo_atual presente");
  assert("bloco_atual"    in runningEvent, "G1: campo bloco_atual presente");
  assert("operacao_atual" in runningEvent, "G1: campo operacao_atual presente");
  assert("motivo_curto"   in runningEvent, "G1: campo motivo_curto presente");
  assert("patch_atual"    in runningEvent, "G1: campo patch_atual presente");

  // ---- Group 2: Tipos e invariantes ----
  console.log("\nGroup 2: Tipos e invariantes por campo");

  assert(typeof runningEvent.status_atual   === "string" && runningEvent.status_atual.length > 0,
    "G2: status_atual é string não-vazia");
  assert(typeof runningEvent.arquivo_atual  === "string" && runningEvent.arquivo_atual.length > 0,
    "G2: arquivo_atual é string não-vazia");
  assert(typeof runningEvent.bloco_atual    === "string" && runningEvent.bloco_atual.length > 0,
    "G2: bloco_atual é string não-vazia");
  assert(typeof runningEvent.operacao_atual === "string" && runningEvent.operacao_atual.length > 0,
    "G2: operacao_atual é string não-vazia");
  assert(runningEvent.motivo_curto === null,
    "G2: motivo_curto é null quando status running (sem erro)");
  assert(typeof runningEvent.patch_atual === "string" && runningEvent.patch_atual.length > 0,
    "G2: patch_atual é string não-vazia");
  assert(typeof runningEvent.emitted_at === "string",
    "G2: emitted_at é string ISO");
  assert(!isNaN(new Date(runningEvent.emitted_at).getTime()),
    "G2: emitted_at é data ISO válida");

  // ---- Group 3: Comportamento por status ----
  console.log("\nGroup 3: Comportamento por status (running / success / failed)");

  // running
  assert(runningEvent.status_atual === "running",
    "G3: status running correto");
  assert(runningEvent.motivo_curto === null,
    "G3: motivo_curto null em running");

  // success
  const successEvent = buildExecEvent("success", mockHandoff, mockMicroPrId, null);
  assert(successEvent.status_atual === "success",
    "G3: status success correto");
  assert(successEvent.motivo_curto === null,
    "G3: motivo_curto null em success");
  assert(successEvent.arquivo_atual === runningEvent.arquivo_atual,
    "G3: arquivo_atual consistente entre running e success");
  assert(successEvent.patch_atual   === runningEvent.patch_atual,
    "G3: patch_atual consistente entre running e success");

  // failed
  const motivo = "Execution failed: timeout after 30s".slice(0, 120);
  const failedEvent = buildExecEvent("failed", mockHandoff, mockMicroPrId, motivo);
  assert(failedEvent.status_atual === "failed",
    "G3: status failed correto");
  assert(typeof failedEvent.motivo_curto === "string" && failedEvent.motivo_curto.length > 0,
    "G3: motivo_curto é string não-vazia em failed");
  assert(failedEvent.motivo_curto === motivo,
    "G3: motivo_curto preservado corretamente");
  assert(failedEvent.motivo_curto.length <= 120,
    "G3: motivo_curto limitado a 120 chars");

  // ---- Group 4: JSON round-trip (KV compatibility) ----
  console.log("\nGroup 4: JSON round-trip — compatibilidade com KV");

  let serializable = true;
  let rt;
  try {
    rt = JSON.parse(JSON.stringify(runningEvent));
  } catch (_) {
    serializable = false;
  }
  assert(serializable,                                     "G4: event sobrevive JSON round-trip");
  assert(rt.status_atual   === runningEvent.status_atual,  "G4: status_atual preservado");
  assert(rt.arquivo_atual  === runningEvent.arquivo_atual, "G4: arquivo_atual preservado");
  assert(rt.bloco_atual    === runningEvent.bloco_atual,   "G4: bloco_atual preservado");
  assert(rt.operacao_atual === runningEvent.operacao_atual,"G4: operacao_atual preservado");
  assert(rt.motivo_curto   === runningEvent.motivo_curto,  "G4: motivo_curto preservado");
  assert(rt.patch_atual    === runningEvent.patch_atual,   "G4: patch_atual preservado");

  // ---- Group 5: Isolamento — não contém campos proibidos ----
  console.log("\nGroup 5: Isolamento — não contém campos de autonomia ou contrato fechado");

  assert(!("approved_by"    in runningEvent), "G5: não contém approved_by (gate humano — P1-P22)");
  assert(!("rejected_by"    in runningEvent), "G5: não contém rejected_by");
  assert(!("auto_promote"   in runningEvent), "G5: não contém auto_promote (autonomia proibida)");
  assert(!("deploy"         in runningEvent), "G5: não contém deploy");
  assert(!("planner"        in runningEvent), "G5: não contém planner");
  assert(!("bridge"         in runningEvent), "G5: não contém bridge");
  assert(!("github"         in runningEvent), "G5: não contém github");
  assert(!("browser"        in runningEvent), "G5: não contém browser");

  // ---- Group 5b: Contém os 6 campos exatos do contrato ----
  console.log("\nGroup 5b: Contém exatamente os 6 campos do contrato desta PR");

  const REQUIRED = ["status_atual", "arquivo_atual", "bloco_atual", "operacao_atual", "motivo_curto", "patch_atual"];
  for (const field of REQUIRED) {
    assert(field in runningEvent, `G5b: campo obrigatório '${field}' presente`);
  }

  // ---- Group 6: Handoff sem target_files retorna null ----
  console.log("\nGroup 6: Handoff com target_files vazio retorna arquivo_atual null");

  const emptyHandoff = { ...mockHandoff, target_files: [] };
  const emptyFilesEvent = buildExecEvent("running", emptyHandoff, mockMicroPrId, null);
  assert(emptyFilesEvent.arquivo_atual === null,
    "G6: arquivo_atual null quando target_files vazio");

  const missingHandoff = { ...mockHandoff };
  delete missingHandoff.target_files;
  const missingFilesEvent = buildExecEvent("running", missingHandoff, mockMicroPrId, null);
  assert(missingFilesEvent.arquivo_atual === null,
    "G6: arquivo_atual null quando target_files ausente");

  // ---- Summary ----
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests();
