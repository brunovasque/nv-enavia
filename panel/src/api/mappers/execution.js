// ============================================================================
// ENAVIA Panel — Execution mapper (internal)
// Wraps raw execution fixture/API response into ExecutionViewPayload (see
// contracts.js SHAPES.EXECUTION).
//
// PR2 — When the raw object contains exec_event (PR1 real source), its 6
// canonical fields are mapped to the component shapes expected by the
// /execution surface blocks: operation, liveTrail, codeTrail, incrementalDiff,
// changeHistory, events.
//
// Field mapping (PR1 → component shapes):
//   status_atual   → liveTrail.status; event status
//   arquivo_atual  → file in liveTrail, codeTrail, incrementalDiff, changeHistory
//   bloco_atual    → block in liveTrail, codeTrail, incrementalDiff; operation.microStep
//   operacao_atual → operation.action; liveTrail.actionSummary; codeTrail.justification
//                    ConsolidatedFeedCard change summary; Replay event label
//   motivo_curto   → operation.reason; incrementalDiff.changeSummary fallback; event detail
//   patch_atual    → incrementalDiff.changeSummary (preferred over motivo_curto)
//
// Fields NOT available in PR1 (shown as null — honest):
//   operation.contract, operation.nextStep
//   liveTrail.operationType, codeTrail.operationType
//   codeTrail.diffSummary, codeTrail.outOfScope
//   incrementalDiff.lines (PR1 gives patch_atual ID, not actual diff lines)
//
// Honesty marker: objects derived from exec_event carry _pr2Source: 'exec_event',
// used by card components to show "MÍNIMO REAL" instead of "DEMO".
// ============================================================================

import { SHAPES } from "../contracts.js";

// ── PR2 — map exec_event (PR1 source) to surface component shapes ─────────────

function _mapExecEventToSurfaces(execEvent) {
  const status = execEvent.status_atual  ?? null;
  const file   = execEvent.arquivo_atual ?? null;
  const block  = execEvent.bloco_atual   ?? null;
  const op     = execEvent.operacao_atual ?? null;
  const motivo = execEvent.motivo_curto  ?? null;
  const patch  = execEvent.patch_atual   ?? null;
  const ts     = execEvent.emitted_at    ?? null;

  // Replay event status + type (string literals — no mock import)
  const evStatus = status === "running" ? "active"
    : status === "success" ? "done"
    : "error";
  const evType = status === "running" ? "STEP_STARTED"
    : status === "success" ? "STEP_DONE"
    : "STEP_FAILED";

  return {
    // Operação ao vivo (OperationalLiveCard)
    operation: {
      action:     op,
      contract:   null,    // not in PR1 — honest absence
      microStep:  block,
      reason:     motivo,
      nextStep:   null,    // not in PR1 — honest absence
      _pr2Source: "exec_event",
    },

    // Trilha viva de código (LiveTrailCard — tab Código)
    liveTrail: {
      file,
      block,
      operationType: null, // not in PR1 — honest absence
      status,
      actionSummary: op,
      _pr2Source: "exec_event",
    },

    // Código ao vivo (CodeTrailCard — tab Código)
    codeTrail: {
      file,
      block,
      operationType: null, // not in PR1 — honest absence
      diffSummary:   null, // not in PR1 — patch_atual is an ID, not diff lines
      justification: op,
      outOfScope:    null, // not in PR1 — honest absence
      _pr2Source: "exec_event",
    },

    // Diff em andamento (IncrementalDiffCard — tab Diff)
    incrementalDiff: {
      file,
      block,
      lines:         [],           // PR1 doesn't provide actual diff lines
      changeSummary: patch ?? motivo,
      _pr2Source: "exec_event",
    },

    // Feed de mudanças (ConsolidatedFeedCard — tab Mudanças)
    changeHistory: file ? [
      {
        file,
        patchStatus: status === "success" ? "applied" : "pending",
        _pr2Source:  "exec_event",
        changes: [
          {
            id:           "exec-event-real-1",
            seq:          1,
            summary:      op,
            status:       status === "success" ? "applied" : "pending",
            addedLines:   null,
            removedLines: null,
            ts,
          },
        ],
      },
    ] : null,

    // Replay / ExecutionTimeline (tab Replay)
    events: [
      {
        id:         "exec-event-real",
        type:       evType,
        label:      op ?? "Evento de execução",
        detail:     motivo,
        timestamp:  ts,
        status:     evStatus,
        _pr2Source: "exec_event",
      },
    ],
  };
}

// ── Main mapper ───────────────────────────────────────────────────────────────

/**
 * @param {object|null} raw - raw execution object (may be null for IDLE state)
 * @returns {import("../contracts.js").ExecutionViewPayload}
 */
export function mapExecutionResponse(raw) {
  const execEvent = raw?.exec_event ?? null;

  // Derive surface fields from exec_event when present and the raw object does
  // not already carry those fields (preserves mock data in mock mode).
  let derived = {};
  if (execEvent) {
    const mapped = _mapExecEventToSurfaces(execEvent);

    if (raw.operation == null)                           derived.operation      = mapped.operation;
    if (raw.liveTrail == null)                           derived.liveTrail      = mapped.liveTrail;
    if (raw.codeTrail == null)                           derived.codeTrail      = mapped.codeTrail;
    if (raw.incrementalDiff == null)                     derived.incrementalDiff = mapped.incrementalDiff;
    if (raw.changeHistory == null)                       derived.changeHistory  = mapped.changeHistory;
    if (raw.events == null || raw.events.length === 0)   derived.events         = mapped.events;
  }

  return {
    [SHAPES.EXECUTION.EXECUTION]:  raw ? { ...raw, ...derived } : null,
    [SHAPES.EXECUTION.FETCHED_AT]: new Date().toISOString(),
  };
}
