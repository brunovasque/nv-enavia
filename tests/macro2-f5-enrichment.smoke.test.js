// ============================================================================
// 🧪 Smoke Tests — Macro2-F5: Enriched exec_event + Functional Logs
//
// Run: node tests/macro2-f5-enrichment.smoke.test.js
//
// Proves that:
//   1. exec_event contains real metrics, executionSummary, result after execution
//   2. Functional logs are emitted and persisted in KV during the cycle
//   3. GET /execution returns enriched fields at top level
//   4. Backward compatibility: old exec_events without enrichment don't break
//   5. Empty KV returns safe defaults
// ============================================================================

import worker from "../nv-enavia.js";
import {
  handleCreateContract,
  advanceContractPhase,
  startTask,
  executeCurrentMicroPr,
  readExecEvent,
  buildExecEvent,
  readFunctionalLogs,
  appendFunctionalLog,
  KV_SUFFIX_EXEC_EVENT,
  KV_SUFFIX_FUNCTIONAL_LOGS,
  KV_SUFFIX_FLOG_ENTRY,
  KV_SUFFIX_FLOG_COUNT,
  MAX_FUNCTIONAL_LOGS_PER_CONTRACT,
} from "../contract-executor.js";

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
// Mock KV store
// ---------------------------------------------------------------------------
function createMockKV() {
  const store = {};
  return {
    async get(key, type) {
      const val = store[key] ?? null;
      if (type === "json" && val !== null) {
        try { return JSON.parse(val); } catch { return null; }
      }
      return val;
    },
    async put(key, value) { store[key] = value; },
    _store: store,
  };
}

function mockRequest(body) {
  return { async json() { return body; } };
}

const BASE_PAYLOAD = {
  version: "v1",
  operator: "test-macro2-f5",
  goal: "Prove enriched exec_event and functional logs",
  scope: {
    workers: ["nv-enavia"],
    routes: ["/test-route"],
    environments: ["TEST", "PROD"],
  },
  definition_of_done: [
    "enriched exec_event with metrics/summary/result",
    "functional logs persisted",
  ],
};

async function setupReadyContract(contractId) {
  const env = { ENAVIA_BRAIN: createMockKV() };
  const req = mockRequest({ ...BASE_PAYLOAD, contract_id: contractId });
  await handleCreateContract(req, env);
  await advanceContractPhase(env, contractId);
  await startTask(env, contractId, "task_001");
  return { env, contractId };
}

async function getExecution(kv) {
  const env = { ENAVIA_BRAIN: kv };
  const req = new Request("https://test.enavia.io/execution", { method: "GET" });
  const res = await worker.fetch(req, env);
  return { status: res.status, body: await res.json() };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

async function runTests() {

  // ── Group 1: SUCCESS → exec_event has real metrics/executionSummary/result ──
  console.log("\nGroup 1: SUCCESS — exec_event has real metrics, executionSummary, result");
  {
    const { env, contractId } = await setupReadyContract("macro2_f5_g1");
    const result = await executeCurrentMicroPr(env, contractId, {
      evidence: ["Smoke test passed", "Endpoint OK"],
    });

    assert(result.ok === true, "G1: execution success");

    const event = await readExecEvent(env, contractId);
    assert(event !== null, "G1: exec_event present");

    // metrics
    assert(event.metrics !== null && typeof event.metrics === "object", "G1: metrics is object");
    assert(typeof event.metrics.stepsTotal === "number", "G1: metrics.stepsTotal is number");
    assert(typeof event.metrics.stepsDone  === "number", "G1: metrics.stepsDone is number");
    assert(typeof event.metrics.elapsedMs  === "number", "G1: metrics.elapsedMs is number");
    assert(event.metrics.elapsedMs >= 0, "G1: metrics.elapsedMs >= 0");

    // executionSummary — hardened: only provably real fields
    assert(event.executionSummary !== null && typeof event.executionSummary === "object", "G1: executionSummary is object");
    assert(event.executionSummary.finalStatus === "success", "G1: executionSummary.finalStatus = success");
    assert(typeof event.executionSummary.hadBlock === "boolean", "G1: hadBlock is boolean");
    assert(typeof event.executionSummary.taskId === "string", "G1: taskId is string (provable)");
    assert(typeof event.executionSummary.microPrId === "string", "G1: microPrId is string (provable)");
    assert(typeof event.executionSummary.evidenceCount === "number", "G1: evidenceCount is number (provable)");
    // Removed heuristic fields (hadBrowserNavigation, hadCodeChange, hadHumanReview, hadBridgeDispatch)
    assert(!("hadBrowserNavigation" in event.executionSummary), "G1: hadBrowserNavigation removed (heuristic)");
    assert(!("hadCodeChange" in event.executionSummary), "G1: hadCodeChange removed (heuristic)");
    assert(!("hadHumanReview" in event.executionSummary), "G1: hadHumanReview removed (heuristic)");
    assert(!("hadBridgeDispatch" in event.executionSummary), "G1: hadBridgeDispatch removed (heuristic)");

    // result
    assert(event.result !== null && typeof event.result === "object", "G1: result is object");
    assert(typeof event.result.summary === "string" && event.result.summary.length > 0, "G1: result.summary is non-empty string");
    assert(event.result.status === "success", "G1: result.status = success");

    // Original 6 canonical fields still present
    assert("status_atual"   in event, "G1: status_atual still present");
    assert("arquivo_atual"  in event, "G1: arquivo_atual still present");
    assert("bloco_atual"    in event, "G1: bloco_atual still present");
    assert("operacao_atual" in event, "G1: operacao_atual still present");
    assert("motivo_curto"   in event, "G1: motivo_curto still present");
    assert("patch_atual"    in event, "G1: patch_atual still present");
  }

  // ── Group 2: FAILED → exec_event has real metrics/summary/result with failure ──
  console.log("\nGroup 2: FAILED — exec_event has real failure data");
  {
    const { env, contractId } = await setupReadyContract("macro2_f5_g2");
    const result = await executeCurrentMicroPr(env, contractId, {
      simulate_failure: {
        code: "TIMEOUT",
        message: "Worker timeout after 30s",
        classification: "in_scope",
      },
    });

    assert(result.ok === false, "G2: execution failed");

    const event = await readExecEvent(env, contractId);
    assert(event !== null, "G2: exec_event present");
    assert(event.metrics !== null, "G2: metrics present");
    assert(event.metrics.elapsedMs >= 0, "G2: metrics.elapsedMs >= 0");
    assert(event.executionSummary !== null, "G2: executionSummary present");
    assert(event.executionSummary.finalStatus === "failed", "G2: executionSummary.finalStatus = failed");
    assert(event.result !== null, "G2: result present");
    assert(event.result.status === "failed", "G2: result.status = failed");
    assert(event.result.summary.includes("falhou"), "G2: result.summary mentions failure");
    assert(event.result.summary.includes("task_001"), "G2: result.summary mentions task id");
  }

  // ── Group 3: Functional logs emitted during cycle ──
  console.log("\nGroup 3: Functional logs emitted during execution cycle");
  {
    const { env, contractId } = await setupReadyContract("macro2_f5_g3");
    await executeCurrentMicroPr(env, contractId, {
      evidence: ["Log test evidence"],
    });

    const logs = await readFunctionalLogs(env, contractId);
    assert(Array.isArray(logs), "G3: functional logs is array");
    assert(logs.length >= 2, `G3: at least 2 functional logs emitted (got ${logs.length})`);

    // Each log has the expected shape
    for (let i = 0; i < logs.length; i++) {
      const log = logs[i];
      assert(typeof log.id === "string", `G3: log[${i}].id is string`);
      assert(["decisao", "bloqueio", "consolidacao"].includes(log.type), `G3: log[${i}].type is valid type`);
      assert(typeof log.label === "string" && log.label.length > 0, `G3: log[${i}].label is non-empty`);
      assert(typeof log.message === "string" && log.message.length > 0, `G3: log[${i}].message is non-empty`);
      assert(typeof log.timestamp === "string", `G3: log[${i}].timestamp is string`);
    }

    // First log should be decisao (start), last should be consolidacao (success)
    assert(logs[0].type === "decisao", "G3: first log is decisao (start)");
    assert(logs[logs.length - 1].type === "consolidacao", "G3: last log is consolidacao (success)");
  }

  // ── Group 4: Functional logs on failure include bloqueio ──
  console.log("\nGroup 4: Functional logs include bloqueio on failure");
  {
    const { env, contractId } = await setupReadyContract("macro2_f5_g4");
    await executeCurrentMicroPr(env, contractId, {
      simulate_failure: {
        code: "FAIL",
        message: "Simulated failure for log test",
        classification: "in_scope",
      },
    });

    const logs = await readFunctionalLogs(env, contractId);
    assert(logs.length >= 2, `G4: at least 2 logs emitted on failure (got ${logs.length})`);

    const hasBloqueio = logs.some(l => l.type === "bloqueio");
    assert(hasBloqueio, "G4: at least one bloqueio log on failure");

    const hasDecisao = logs.some(l => l.type === "decisao");
    assert(hasDecisao, "G4: decisao log present (start)");
  }

  // ── Group 5: GET /execution returns enriched fields at top level ──
  console.log("\nGroup 5: GET /execution returns enriched fields at top level");
  {
    const kv = createMockKV();
    const contractId = "macro2_f5_g5";
    const env = { ENAVIA_BRAIN: kv };

    // Setup contract and execute
    const req = mockRequest({ ...BASE_PAYLOAD, contract_id: contractId });
    await handleCreateContract(req, env);
    await advanceContractPhase(env, contractId);
    await startTask(env, contractId, "task_001");
    await executeCurrentMicroPr(env, contractId, {
      evidence: ["GET /execution enrichment test"],
    });

    const { status, body } = await getExecution(kv);

    assert(status === 200, "G5: HTTP 200");
    assert(body.ok === true, "G5: body.ok = true");
    assert(body.execution !== null, "G5: execution not null");

    // Top-level fields surfaced from exec_event
    assert(body.execution.metrics !== null, "G5: execution.metrics present at top level");
    assert(typeof body.execution.metrics.stepsTotal === "number", "G5: metrics.stepsTotal at top level");
    assert(typeof body.execution.metrics.stepsDone === "number", "G5: metrics.stepsDone at top level");
    assert(typeof body.execution.metrics.elapsedMs === "number", "G5: metrics.elapsedMs at top level");

    assert(body.execution.executionSummary !== null, "G5: executionSummary present at top level");
    assert(body.execution.executionSummary.finalStatus === "success", "G5: executionSummary.finalStatus at top level");

    assert(body.execution.result !== null, "G5: result present at top level");
    assert(typeof body.execution.result.summary === "string", "G5: result.summary at top level");

    // functionalLogs at top level
    assert(Array.isArray(body.execution.functionalLogs), "G5: functionalLogs is array at top level");
    assert(body.execution.functionalLogs.length >= 2, `G5: functionalLogs has entries (got ${body.execution.functionalLogs.length})`);

    // status mapped
    assert(body.execution.status === "COMPLETED", `G5: execution.status mapped to COMPLETED (got ${body.execution.status})`);

    // exec_event still present (backward compat)
    assert(body.execution.exec_event !== null, "G5: exec_event still present in response");
  }

  // ── Group 6: Backward compatibility — old exec_event without enrichment ──
  console.log("\nGroup 6: Backward compatibility — old exec_event without enrichment fields");
  {
    const kv = createMockKV();
    const contractId = "macro2_f5_g6_compat";

    // Old-style exec_event (only 6 fields, no metrics/summary/result)
    const oldExecEvent = {
      status_atual:   "success",
      arquivo_atual:  "old-file.js",
      bloco_atual:    "task_old",
      operacao_atual: "Old operation",
      motivo_curto:   null,
      patch_atual:    "micro_pr_old",
      emitted_at:     "2026-01-01T00:00:00.000Z",
    };

    const eventKey = `contract:${contractId}:exec_event`;
    await kv.put(eventKey, JSON.stringify(oldExecEvent));
    await kv.put("execution:exec_event:latest_contract_id", contractId);

    const { status, body } = await getExecution(kv);

    assert(status === 200, "G6: HTTP 200 with old exec_event");
    assert(body.ok === true, "G6: body.ok = true");
    assert(body.execution !== null, "G6: execution not null");

    // exec_event present
    assert(body.execution.exec_event !== null, "G6: exec_event present");
    assert(body.execution.exec_event.status_atual === "success", "G6: old fields preserved");

    // Enrichment fields default to null/undefined (not crash)
    assert(body.execution.metrics === undefined || body.execution.metrics === null,
      "G6: metrics absent or null for old exec_event (no crash)");
    assert(body.execution.executionSummary === undefined || body.execution.executionSummary === null,
      "G6: executionSummary absent or null for old exec_event (no crash)");

    // functionalLogs defaults to empty array
    assert(Array.isArray(body.execution.functionalLogs), "G6: functionalLogs defaults to empty array");
    assert(body.execution.functionalLogs.length === 0, "G6: functionalLogs empty for old exec_event");
  }

  // ── Group 7: Empty KV → execution null (no crash) ──
  console.log("\nGroup 7: Empty KV → execution null (no crash)");
  {
    const kv = createMockKV();
    const { status, body } = await getExecution(kv);

    assert(status === 200, "G7: HTTP 200 with empty KV");
    assert(body.ok === true, "G7: body.ok = true");
    assert(body.execution === null, "G7: execution = null with empty KV");
  }

  // ── Group 8: buildExecEvent backward compat — called without enrichment ──
  console.log("\nGroup 8: buildExecEvent backward compat — called without enrichment");
  {
    const handoff = {
      target_files: ["file.js"],
      source_task: "task_x",
      objective: "Test objective",
    };

    // Call without 5th argument — old-style
    const event = buildExecEvent("running", handoff, "mpr_x", null);

    assert(event.status_atual === "running", "G8: status_atual correct");
    assert(event.arquivo_atual === "file.js", "G8: arquivo_atual correct");
    assert(event.metrics === null, "G8: metrics defaults to null when no enrichment");
    assert(event.executionSummary === null, "G8: executionSummary defaults to null");
    assert(event.result === null, "G8: result defaults to null");
  }

  // ── Group 9: readFunctionalLogs with no logs → empty array ──
  console.log("\nGroup 9: readFunctionalLogs on empty KV → empty array");
  {
    const env = { ENAVIA_BRAIN: createMockKV() };
    const logs = await readFunctionalLogs(env, "nonexistent");
    assert(Array.isArray(logs), "G9: result is array");
    assert(logs.length === 0, "G9: empty array when no logs");
  }

  // ── Group 10: appendFunctionalLog + readFunctionalLogs round-trip (per-entry model) ──
  console.log("\nGroup 10: appendFunctionalLog + readFunctionalLogs round-trip (per-entry)");
  {
    const env = { ENAVIA_BRAIN: createMockKV() };
    const cid = "roundtrip_test";

    await appendFunctionalLog(env, cid, {
      id: "fl_test_1", type: "decisao", label: "Test log", message: "Test message", timestamp: "2026-01-01T00:00:00Z",
    });
    await appendFunctionalLog(env, cid, {
      id: "fl_test_2", type: "bloqueio", label: "Block log", message: "Block message", timestamp: "2026-01-01T00:01:00Z",
    });

    const logs = await readFunctionalLogs(env, cid);
    assert(logs.length === 2, "G10: 2 logs after 2 appends");
    assert(logs[0].id === "fl_test_1", "G10: first log preserved");
    assert(logs[1].id === "fl_test_2", "G10: second log preserved");
    assert(logs[0].type === "decisao", "G10: type preserved");
    assert(logs[1].type === "bloqueio", "G10: type preserved for second");

    // Verify per-entry KV keys were written (not single array)
    const countKey = `contract:${cid}:flog_count`;
    const count = await env.ENAVIA_BRAIN.get(countKey);
    assert(count === "2", `G10: flog_count = 2 (per-entry model, got ${count})`);

    const entry0Key = `contract:${cid}:flog:0`;
    const entry0 = await env.ENAVIA_BRAIN.get(entry0Key);
    assert(entry0 !== null, "G10: flog:0 exists as individual key");
    const parsed0 = JSON.parse(entry0);
    assert(parsed0.id === "fl_test_1", "G10: flog:0 contains first log");
  }

  // ── Group 11: Per-entry cap is enforced (MAX_FUNCTIONAL_LOGS_PER_CONTRACT) ──
  console.log("\nGroup 11: Per-entry cap enforced (MAX_FUNCTIONAL_LOGS_PER_CONTRACT)");
  {
    const env = { ENAVIA_BRAIN: createMockKV() };
    const cid = "cap_test";

    // Write MAX + 5 logs — only MAX should be persisted
    for (let i = 0; i < MAX_FUNCTIONAL_LOGS_PER_CONTRACT + 5; i++) {
      await appendFunctionalLog(env, cid, {
        id: `fl_cap_${i}`, type: "decisao", label: `Log ${i}`, message: `Msg ${i}`, timestamp: new Date().toISOString(),
      });
    }

    const logs = await readFunctionalLogs(env, cid);
    assert(logs.length === MAX_FUNCTIONAL_LOGS_PER_CONTRACT,
      `G11: capped at ${MAX_FUNCTIONAL_LOGS_PER_CONTRACT} (got ${logs.length})`);

    // Verify the counter stopped at MAX
    const countKey = `contract:${cid}:flog_count`;
    const count = parseInt(await env.ENAVIA_BRAIN.get(countKey), 10);
    assert(count === MAX_FUNCTIONAL_LOGS_PER_CONTRACT,
      `G11: flog_count capped at ${MAX_FUNCTIONAL_LOGS_PER_CONTRACT} (got ${count})`);
  }

  // ── Group 12: Legacy single-array backward compat in readFunctionalLogs ──
  console.log("\nGroup 12: Legacy single-array backward compat in readFunctionalLogs");
  {
    const env = { ENAVIA_BRAIN: createMockKV() };
    const cid = "legacy_test";

    // Write old-style single array directly to legacy key
    const legacyKey = `contract:${cid}:functional_logs`;
    const legacyLogs = [
      { id: "fl_old_1", type: "decisao", label: "Old log", message: "Old msg", timestamp: "2025-12-01T00:00:00Z" },
      { id: "fl_old_2", type: "consolidacao", label: "Old consolidation", message: "Old consolidation msg", timestamp: "2025-12-01T00:01:00Z" },
    ];
    await env.ENAVIA_BRAIN.put(legacyKey, JSON.stringify(legacyLogs));

    // No flog_count key → readFunctionalLogs should fallback to legacy key
    const logs = await readFunctionalLogs(env, cid);
    assert(logs.length === 2, "G12: legacy logs read via fallback");
    assert(logs[0].id === "fl_old_1", "G12: legacy first log preserved");
    assert(logs[1].id === "fl_old_2", "G12: legacy second log preserved");
  }

  // ── Group 13: executionSummary hardened — removed heuristic fields in FAILED path ──
  console.log("\nGroup 13: executionSummary hardened — failure path has provable fields only");
  {
    const { env, contractId } = await setupReadyContract("macro2_f5_g13");
    await executeCurrentMicroPr(env, contractId, {
      simulate_failure: {
        code: "OOS_ERROR",
        message: "Out of scope error",
        classification: "out_of_scope",
      },
    });

    const event = await readExecEvent(env, contractId);
    assert(event.executionSummary.hadBlock === true, "G13: hadBlock=true for out_of_scope classification (provable)");
    assert(event.executionSummary.taskId === "task_001", "G13: taskId = task_001 (provable)");
    assert(typeof event.executionSummary.evidenceCount === "number", "G13: evidenceCount is number");
    assert(!("hadBrowserNavigation" in event.executionSummary), "G13: hadBrowserNavigation removed");
    assert(!("hadCodeChange" in event.executionSummary), "G13: hadCodeChange removed");
    assert(!("hadHumanReview" in event.executionSummary), "G13: hadHumanReview removed");
    assert(!("hadBridgeDispatch" in event.executionSummary), "G13: hadBridgeDispatch removed");
  }

  // ── Summary ──
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Unhandled error:", err);
  process.exit(1);
});
