// ============================================================================
// 📦 ENAVIA — Planner Memory Audit v1 (PM10 — Auditoria Final)
//
// Camada de auditoria final do ciclo Planner + Memory Layer (PM1–PM9).
// Valida se todas as partes formam um fluxo coerente, íntegro e pronto
// para uso controlado.
//
// Responsabilidades:
//   - runPlannerMemoryAudit(fixturesOrInputs?) — única função pública
//
// Saída canônica (AuditReport):
//   audit_status  — "passed" | "failed"
//   is_ready      — boolean
//   checks[]      — lista de checagens individuais
//   summary       — string curta e clara
//   next_action   — string orientando o próximo passo
//
// Cada item de checks[]:
//   check_name  — string identificando a camada auditada
//   status      — "passed" | "failed"
//   reason      — string objetiva e rastreável
//
// Checklist mínimo (PM1–PM9):
//   PM1 — schema de memória compatível
//   PM2 — storage core compatível (API surface)
//   PM3 — read pipeline coerente (API surface)
//   PM4 — classificação coerente (comportamento determinístico)
//   PM5 — output mode coerente com PM4 (mapeamento A/B/C)
//   PM6 — canonical plan coerente com PM4/PM5 (alinhamento de tipos)
//   PM7 — gate coerente com PM6 (transições de estado canônicas)
//   PM8 — bridge coerente com PM6/PM7 (blocking / ready)
//   PM9 — consolidação coerente com PM6/PM7/PM8 (regras de candidatos)
//
// Regras base:
//   blocos PM1–PM9 coerentes → audit_status = "passed" e is_ready = true
//   qualquer quebra de contrato → audit_status = "failed" e is_ready = false
//
// NÃO contém:
//   - persistência / KV / D1 / R2 / I/O de qualquer tipo
//   - chamada ao executor contratual
//   - fetch / endpoint / deploy
//   - LLM / embeddings / heurística opaca
//   - painel / PROD
//   - execução real de qualquer camada
//
// PM10 APENAS — não misturar com novas frentes.
// ============================================================================

// ---------------------------------------------------------------------------
// Imports — todos os módulos auditados
// ---------------------------------------------------------------------------
import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  MEMORY_FLAGS,
  MEMORY_CANONICAL_SHAPE,
  validateMemoryObject,
  buildMemoryObject,
} from "./memory-schema.js";

import {
  writeMemory,
  readMemoryById,
  updateMemory,
  archiveMemory,
  supersedeMemory,
} from "./memory-storage.js";

import {
  searchMemory,
  searchRelevantMemory,
} from "./memory-read.js";

import {
  classifyRequest,
  COMPLEXITY_LEVELS,
  CATEGORIES,
  RISK_LEVELS,
  REQUEST_TYPES,
} from "./planner-classifier.js";

import {
  selectOutputMode,
  buildOutputEnvelope,
  OUTPUT_MODES,
  LEVEL_TO_OUTPUT_MODE,
} from "./planner-output-modes.js";

import {
  buildCanonicalPlan,
  PLAN_TYPES,
  PLAN_VERSION,
  LEVEL_TO_PLAN_TYPE,
} from "./planner-canonical-plan.js";

import {
  evaluateApprovalGate,
  approvePlan,
  rejectPlan,
  GATE_STATUS,
} from "./planner-approval-gate.js";

import {
  buildExecutorBridgePayload,
  BRIDGE_STATUS,
  BRIDGE_VERSION,
  BRIDGE_SOURCE,
  EXECUTOR_ACTION,
} from "./planner-executor-bridge.js";

import {
  consolidateMemoryLearning,
  CONSOLIDATION_VERSION,
} from "./memory-consolidation.js";

// ---------------------------------------------------------------------------
// AUDIT_VERSION — versão canônica da PM10
// ---------------------------------------------------------------------------
const AUDIT_VERSION = "1.0";

// ---------------------------------------------------------------------------
// CHECK_STATUS — enum interno de status de checagem
// ---------------------------------------------------------------------------
const CHECK_STATUS = {
  PASSED: "passed",
  FAILED: "failed",
};

// ---------------------------------------------------------------------------
// _pass(check_name, reason)
// _fail(check_name, reason)
//
// Helpers internos para montar itens de checks[].
// ---------------------------------------------------------------------------
function _pass(check_name, reason) {
  return { check_name, status: CHECK_STATUS.PASSED, reason };
}

function _fail(check_name, reason) {
  return { check_name, status: CHECK_STATUS.FAILED, reason };
}

// ---------------------------------------------------------------------------
// _checkPM1(fixtures)
//
// Audita PM1 — Memory Schema
//
// Verifica:
//   - enums exportados (MEMORY_TYPES, MEMORY_STATUS, MEMORY_PRIORITY,
//     MEMORY_CONFIDENCE, ENTITY_TYPES, MEMORY_FLAGS) têm contagens canônicas
//   - MEMORY_CANONICAL_SHAPE contém todos os campos obrigatórios
//   - validateMemoryObject aceita objeto válido e rejeita inválido
//   - buildMemoryObject produz objeto com shape canônico
// ---------------------------------------------------------------------------
function _checkPM1(fixtures) {
  const name = "PM1 — memory schema";

  try {
    // Enum counts
    if (Object.values(MEMORY_TYPES).length !== 5)
      return _fail(name, `MEMORY_TYPES deve ter 5 valores; encontrado: ${Object.values(MEMORY_TYPES).length}`);

    if (Object.values(MEMORY_STATUS).length !== 5)
      return _fail(name, `MEMORY_STATUS deve ter 5 valores; encontrado: ${Object.values(MEMORY_STATUS).length}`);

    if (Object.values(MEMORY_PRIORITY).length !== 4)
      return _fail(name, `MEMORY_PRIORITY deve ter 4 valores; encontrado: ${Object.values(MEMORY_PRIORITY).length}`);

    if (Object.values(MEMORY_CONFIDENCE).length !== 5)
      return _fail(name, `MEMORY_CONFIDENCE deve ter 5 valores; encontrado: ${Object.values(MEMORY_CONFIDENCE).length}`);

    if (Object.values(ENTITY_TYPES).length !== 5)
      return _fail(name, `ENTITY_TYPES deve ter 5 valores; encontrado: ${Object.values(ENTITY_TYPES).length}`);

    if (Object.values(MEMORY_FLAGS).length !== 3)
      return _fail(name, `MEMORY_FLAGS deve ter 3 valores; encontrado: ${Object.values(MEMORY_FLAGS).length}`);

    // MEMORY_CANONICAL_SHAPE — campos obrigatórios presentes
    const requiredShapeFields = [
      "memory_id", "memory_type", "entity_type", "entity_id", "title",
      "content_structured", "priority", "confidence", "source",
      "created_at", "updated_at", "expires_at", "is_canonical", "status", "flags",
    ];
    for (const field of requiredShapeFields) {
      if (!(field in MEMORY_CANONICAL_SHAPE))
        return _fail(name, `MEMORY_CANONICAL_SHAPE não contém campo obrigatório '${field}'`);
    }

    // validateMemoryObject — aceita objeto válido
    const validObj = fixtures.validMemory || _defaultValidMemory();
    const validResult = validateMemoryObject(validObj);
    if (!validResult.valid)
      return _fail(name, `validateMemoryObject rejeitou objeto válido: ${(validResult.errors || []).join("; ")}`);

    // validateMemoryObject — rejeita objeto inválido (sem memory_id)
    const invalidResult = validateMemoryObject({ memory_type: "user_profile" });
    if (invalidResult.valid)
      return _fail(name, "validateMemoryObject aceitou objeto inválido sem memory_id");

    // buildMemoryObject — produz shape com defaults
    const built = buildMemoryObject({ memory_id: "test", memory_type: MEMORY_TYPES.PROJECT });
    if (typeof built !== "object" || built === null)
      return _fail(name, "buildMemoryObject não retornou objeto");
    if (built.memory_id !== "test")
      return _fail(name, "buildMemoryObject não preservou memory_id passado");

    return _pass(name, "schema de memória com enums, shape canônico e validador coerentes");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM2()
//
// Audita PM2 — Memory Storage Core
//
// Verifica:
//   - API surface: writeMemory, readMemoryById, updateMemory,
//     archiveMemory, supersedeMemory exportados como funções
//   - Funções têm a aridade esperada (mínimo de parâmetros)
// ---------------------------------------------------------------------------
function _checkPM2() {
  const name = "PM2 — storage core";

  try {
    const apis = { writeMemory, readMemoryById, updateMemory, archiveMemory, supersedeMemory };
    const arities = { writeMemory: 2, readMemoryById: 2, updateMemory: 3, archiveMemory: 3, supersedeMemory: 4 };

    for (const [fn, arity] of Object.entries(arities)) {
      if (typeof apis[fn] !== "function")
        return _fail(name, `'${fn}' não está exportado como função`);
      if (apis[fn].length < arity)
        return _fail(name, `'${fn}' tem aridade ${apis[fn].length}, esperado >= ${arity}`);
    }

    return _pass(name, "writeMemory, readMemoryById, updateMemory, archiveMemory, supersedeMemory exportados com aridade correta");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM3()
//
// Audita PM3 — Memory Read Pipeline
//
// Verifica:
//   - API surface: searchMemory, searchRelevantMemory exportados como funções
//   - Funções têm aridade >= 2 (filters/context + env)
// ---------------------------------------------------------------------------
function _checkPM3() {
  const name = "PM3 — read pipeline";

  try {
    if (typeof searchMemory !== "function")
      return _fail(name, "'searchMemory' não está exportado como função");
    if (typeof searchRelevantMemory !== "function")
      return _fail(name, "'searchRelevantMemory' não está exportado como função");
    if (searchMemory.length < 2)
      return _fail(name, `searchMemory tem aridade ${searchMemory.length}, esperado >= 2`);
    if (searchRelevantMemory.length < 2)
      return _fail(name, `searchRelevantMemory tem aridade ${searchRelevantMemory.length}, esperado >= 2`);

    return _pass(name, "searchMemory e searchRelevantMemory exportados com aridade correta");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM4(fixtures)
//
// Audita PM4 — Planner Request Classification
//
// Verifica:
//   - classifyRequest retorna shape canônico
//   - Texto simples → nível A / simple / baixo / needs_human_approval = false
//   - Texto complexo (keywords de risco + prod) → nível C + needs_human_approval = true
//   - COMPLEXITY_LEVELS, CATEGORIES, RISK_LEVELS, REQUEST_TYPES presentes
// ---------------------------------------------------------------------------
function _checkPM4(fixtures) {
  const name = "PM4 — classification";

  try {
    // Enum exports
    if (Object.values(COMPLEXITY_LEVELS).length !== 3)
      return _fail(name, `COMPLEXITY_LEVELS deve ter 3 valores; encontrado: ${Object.values(COMPLEXITY_LEVELS).length}`);
    if (Object.values(CATEGORIES).length !== 3)
      return _fail(name, `CATEGORIES deve ter 3 valores; encontrado: ${Object.values(CATEGORIES).length}`);
    if (Object.values(RISK_LEVELS).length !== 3)
      return _fail(name, `RISK_LEVELS deve ter 3 valores; encontrado: ${Object.values(RISK_LEVELS).length}`);
    if (Object.values(REQUEST_TYPES).length !== 3)
      return _fail(name, `REQUEST_TYPES deve ter 3 valores; encontrado: ${Object.values(REQUEST_TYPES).length}`);

    // Nível A — texto simples sem sinais
    const simpleInput = fixtures.simpleRequest || { text: "Criar um relatório simples." };
    const resultA = classifyRequest(simpleInput);
    const requiredFields = ["request_type","complexity_level","category","risk_level","needs_human_approval","signals","reason"];
    for (const f of requiredFields) {
      if (!(f in resultA))
        return _fail(name, `classifyRequest não retornou campo '${f}'`);
    }
    if (resultA.complexity_level !== "A")
      return _fail(name, `texto simples deveria classificar como A; obteve: ${resultA.complexity_level}`);
    if (resultA.needs_human_approval !== false)
      return _fail(name, "nível A não deveria requerer aprovação humana");
    if (!Array.isArray(resultA.signals))
      return _fail(name, "campo 'signals' deve ser array");

    // Nível C — keywords de prod + risco
    const complexInput = fixtures.complexRequest || {
      text: "Deploy urgente em produção com dados sensíveis e compliance regulatório — irreversível.",
      context: { mentions_prod: true },
    };
    const resultC = classifyRequest(complexInput);
    if (resultC.complexity_level !== "C")
      return _fail(name, `texto complexo deveria classificar como C; obteve: ${resultC.complexity_level}`);
    if (resultC.needs_human_approval !== true)
      return _fail(name, "nível C deve requerer aprovação humana");

    return _pass(name, "classifyRequest produz shape canônico e nível A/C com comportamento correto");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM5(fixtures)
//
// Audita PM5 — Planner Output Modes
//
// Verifica:
//   - selectOutputMode(A) = "quick_reply"
//   - selectOutputMode(B) = "tactical_plan"
//   - selectOutputMode(C) = "formal_contract"
//   - LEVEL_TO_OUTPUT_MODE alinha com COMPLEXITY_LEVELS (A/B/C)
//   - buildOutputEnvelope retorna shape com output_mode e level corretos
// ---------------------------------------------------------------------------
function _checkPM5(fixtures) {
  const name = "PM5 — output modes";

  try {
    // Mapeamento canônico A→quick_reply, B→tactical_plan, C→formal_contract
    const expectedModes = {
      A: OUTPUT_MODES.QUICK_REPLY,
      B: OUTPUT_MODES.TACTICAL_PLAN,
      C: OUTPUT_MODES.FORMAL_CONTRACT,
    };
    for (const [level, expected] of Object.entries(expectedModes)) {
      const mode = selectOutputMode({ complexity_level: level });
      if (mode !== expected)
        return _fail(name, `selectOutputMode(${level}) retornou '${mode}', esperado '${expected}'`);
    }

    // LEVEL_TO_OUTPUT_MODE deve conter A, B, C
    for (const level of ["A", "B", "C"]) {
      if (!LEVEL_TO_OUTPUT_MODE[level])
        return _fail(name, `LEVEL_TO_OUTPUT_MODE não contém mapeamento para nível '${level}'`);
    }

    // buildOutputEnvelope — shape mínimo para cada nível
    for (const level of ["A", "B", "C"]) {
      const classification = { complexity_level: level, risk_level: "baixo", needs_human_approval: level === "C", reason: "teste" };
      const envelope = buildOutputEnvelope(classification, { text: "Teste de auditoria PM10." });
      if (typeof envelope.output_mode !== "string")
        return _fail(name, `buildOutputEnvelope(${level}) não retornou output_mode`);
      if (envelope.output_mode !== expectedModes[level])
        return _fail(name, `buildOutputEnvelope(${level}).output_mode = '${envelope.output_mode}', esperado '${expectedModes[level]}'`);
      if (typeof envelope.objective !== "string")
        return _fail(name, `buildOutputEnvelope(${level}) não retornou objective`);
    }

    return _pass(name, "selectOutputMode e buildOutputEnvelope coerentes com PM4 (A→quick_reply, B→tactical_plan, C→formal_contract)");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM6(fixtures)
//
// Audita PM6 — Canonical Plan Builder
//
// Verifica:
//   - LEVEL_TO_PLAN_TYPE alinha com LEVEL_TO_OUTPUT_MODE (PM5) sem drift
//   - buildCanonicalPlan retorna shape canônico completo
//   - plan_type espelha output_mode para todos os níveis
//   - needs_human_approval=true obrigatório para nível C
// ---------------------------------------------------------------------------
function _checkPM6(fixtures) {
  const name = "PM6 — canonical plan";

  try {
    // LEVEL_TO_PLAN_TYPE deve alinhar com LEVEL_TO_OUTPUT_MODE (PM5) — evitar drift
    for (const level of ["A", "B", "C"]) {
      if (LEVEL_TO_PLAN_TYPE[level] !== LEVEL_TO_OUTPUT_MODE[level])
        return _fail(name, `drift detectado: LEVEL_TO_PLAN_TYPE[${level}]='${LEVEL_TO_PLAN_TYPE[level]}' != LEVEL_TO_OUTPUT_MODE[${level}]='${LEVEL_TO_OUTPUT_MODE[level]}'`);
    }

    // PLAN_VERSION deve ser string não vazia
    if (typeof PLAN_VERSION !== "string" || PLAN_VERSION.trim() === "")
      return _fail(name, "PLAN_VERSION deve ser string não vazia");

    // buildCanonicalPlan — shape canônico para cada nível
    const requiredPlanFields = [
      "plan_version","plan_type","complexity_level","output_mode","objective",
      "scope_summary","steps","risks","acceptance_criteria","needs_human_approval",
      "next_action","reason",
    ];
    for (const level of ["A", "B", "C"]) {
      const classification = {
        complexity_level: level,
        risk_level: "baixo",
        needs_human_approval: level === "C",
        reason: `auditoria PM10 nível ${level}`,
      };
      const envelope = buildOutputEnvelope(classification, { text: "Teste PM10." });
      const plan = buildCanonicalPlan({ classification, envelope, input: { text: "Teste PM10." } });

      for (const field of requiredPlanFields) {
        if (!(field in plan))
          return _fail(name, `buildCanonicalPlan(${level}) não retornou campo '${field}'`);
      }
      if (!Array.isArray(plan.steps) || plan.steps.length === 0)
        return _fail(name, `buildCanonicalPlan(${level}).steps deve ser array não-vazio`);
      if (plan.plan_type !== LEVEL_TO_PLAN_TYPE[level])
        return _fail(name, `buildCanonicalPlan(${level}).plan_type = '${plan.plan_type}', esperado '${LEVEL_TO_PLAN_TYPE[level]}'`);
      if (plan.output_mode !== plan.plan_type)
        return _fail(name, `buildCanonicalPlan(${level}).output_mode != plan_type (drift detectado)`);
      if (level === "C" && plan.needs_human_approval !== true)
        return _fail(name, "nível C deve ter needs_human_approval = true no plano canônico");
    }

    return _pass(name, "buildCanonicalPlan coerente com PM4/PM5: shape completo, plan_type alinhado, nível C com aprovação obrigatória");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM7(fixtures)
//
// Audita PM7 — Human Approval Gate
//
// Verifica:
//   - evaluateApprovalGate(plan com needs_human_approval=false)
//     → gate_status = "approved_not_required", can_proceed = true
//   - evaluateApprovalGate(plan com needs_human_approval=true)
//     → gate_status = "approval_required", can_proceed = false
//   - approvePlan → gate_status = "approved", can_proceed = true
//   - rejectPlan  → gate_status = "rejected", can_proceed = false
//   - GATE_STATUS tem todos os 4 valores canônicos
// ---------------------------------------------------------------------------
function _checkPM7(fixtures) {
  const name = "PM7 — approval gate";

  try {
    const expectedStatuses = ["approved_not_required", "approval_required", "approved", "rejected"];
    for (const s of expectedStatuses) {
      if (!Object.values(GATE_STATUS).includes(s))
        return _fail(name, `GATE_STATUS não contém valor '${s}'`);
    }

    // evaluateApprovalGate — needs_human_approval = false → auto-aprovado
    const planNoApproval = { needs_human_approval: false, reason: "teste A" };
    const gateAutoApproved = evaluateApprovalGate(planNoApproval);
    if (gateAutoApproved.gate_status !== GATE_STATUS.APPROVED_NOT_REQUIRED)
      return _fail(name, `gate_status esperado 'approved_not_required'; obteve '${gateAutoApproved.gate_status}'`);
    if (gateAutoApproved.can_proceed !== true)
      return _fail(name, "evaluateApprovalGate(não requer aprovação) deve ter can_proceed = true");

    // evaluateApprovalGate — needs_human_approval = true → bloqueado
    const planRequiresApproval = { needs_human_approval: true, reason: "teste C" };
    const gateBlocked = evaluateApprovalGate(planRequiresApproval);
    if (gateBlocked.gate_status !== GATE_STATUS.APPROVAL_REQUIRED)
      return _fail(name, `gate_status esperado 'approval_required'; obteve '${gateBlocked.gate_status}'`);
    if (gateBlocked.can_proceed !== false)
      return _fail(name, "evaluateApprovalGate(requer aprovação) deve ter can_proceed = false");

    // approvePlan → "approved", can_proceed = true
    const gateApproved = approvePlan(planRequiresApproval);
    if (gateApproved.gate_status !== GATE_STATUS.APPROVED)
      return _fail(name, `approvePlan deve retornar gate_status 'approved'; obteve '${gateApproved.gate_status}'`);
    if (gateApproved.can_proceed !== true)
      return _fail(name, "approvePlan deve retornar can_proceed = true");

    // rejectPlan → "rejected", can_proceed = false
    const gateRejected = rejectPlan(planRequiresApproval, "motivo de teste");
    if (gateRejected.gate_status !== GATE_STATUS.REJECTED)
      return _fail(name, `rejectPlan deve retornar gate_status 'rejected'; obteve '${gateRejected.gate_status}'`);
    if (gateRejected.can_proceed !== false)
      return _fail(name, "rejectPlan deve retornar can_proceed = false");

    // Shape mínimo do gate result
    const requiredGateFields = ["gate_status","needs_human_approval","can_proceed","reason","next_action"];
    for (const f of requiredGateFields) {
      if (!(f in gateAutoApproved))
        return _fail(name, `evaluateApprovalGate não retornou campo '${f}'`);
    }

    return _pass(name, "evaluateApprovalGate, approvePlan e rejectPlan coerentes com PM6: transições e can_proceed corretos");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM8(fixtures)
//
// Audita PM8 — Planner Executor Bridge
//
// Verifica:
//   - gate bloqueado (can_proceed=false) → bridge_status = "blocked_by_gate", can_execute = false
//   - gate aprovado (can_proceed=true)   → bridge_status = "ready_for_executor", can_execute = true
//   - executor_payload presente quando can_execute = true
//   - BRIDGE_STATUS, BRIDGE_VERSION, BRIDGE_SOURCE, EXECUTOR_ACTION exportados
// ---------------------------------------------------------------------------
function _checkPM8(fixtures) {
  const name = "PM8 — bridge planner↔executor";

  try {
    // BRIDGE_STATUS exports
    if (!BRIDGE_STATUS.READY || !BRIDGE_STATUS.BLOCKED)
      return _fail(name, "BRIDGE_STATUS não contém READY e BLOCKED");
    if (typeof BRIDGE_VERSION !== "string" || BRIDGE_VERSION.trim() === "")
      return _fail(name, "BRIDGE_VERSION deve ser string não vazia");
    if (typeof BRIDGE_SOURCE !== "string" || BRIDGE_SOURCE.trim() === "")
      return _fail(name, "BRIDGE_SOURCE deve ser string não vazia");
    if (typeof EXECUTOR_ACTION.EXECUTE_PLAN !== "string")
      return _fail(name, "EXECUTOR_ACTION.EXECUTE_PLAN deve ser string");

    // Fixture de plano mínimo compatível com PM6
    const plan = _defaultCanonicalPlan("B");

    // Gate bloqueado → bridge deve bloquear
    const blockedGate = { gate_status: GATE_STATUS.APPROVAL_REQUIRED, can_proceed: false, reason: "aguardando aprovação" };
    const blockedBridge = buildExecutorBridgePayload({ plan, gate: blockedGate });
    if (blockedBridge.bridge_status !== BRIDGE_STATUS.BLOCKED)
      return _fail(name, `gate bloqueado deveria produzir bridge 'blocked_by_gate'; obteve '${blockedBridge.bridge_status}'`);
    if (blockedBridge.can_execute !== false)
      return _fail(name, "bridge bloqueada deve ter can_execute = false");
    if (blockedBridge.executor_payload !== null)
      return _fail(name, "bridge bloqueada deve ter executor_payload = null");

    // Gate aprovado → bridge ready
    const approvedGate = { gate_status: GATE_STATUS.APPROVED_NOT_REQUIRED, can_proceed: true, reason: "auto-aprovado" };
    const readyBridge = buildExecutorBridgePayload({ plan, gate: approvedGate });
    if (readyBridge.bridge_status !== BRIDGE_STATUS.READY)
      return _fail(name, `gate aprovado deveria produzir bridge 'ready_for_executor'; obteve '${readyBridge.bridge_status}'`);
    if (readyBridge.can_execute !== true)
      return _fail(name, "bridge ready deve ter can_execute = true");
    if (!readyBridge.executor_payload || typeof readyBridge.executor_payload !== "object")
      return _fail(name, "bridge ready deve ter executor_payload preenchido");
    if (readyBridge.executor_action !== EXECUTOR_ACTION.EXECUTE_PLAN)
      return _fail(name, `executor_action esperado '${EXECUTOR_ACTION.EXECUTE_PLAN}'; obteve '${readyBridge.executor_action}'`);

    // Shape mínimo do bridge result
    const requiredBridgeFields = ["bridge_status","can_execute","executor_action","executor_payload","reason","next_action"];
    for (const f of requiredBridgeFields) {
      if (!(f in readyBridge))
        return _fail(name, `buildExecutorBridgePayload não retornou campo '${f}'`);
    }

    return _pass(name, "buildExecutorBridgePayload coerente com PM6/PM7: blocked_by_gate quando can_proceed=false, ready quando aprovado");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _checkPM9(fixtures)
//
// Audita PM9 — Memory Consolidation
//
// Verifica:
//   - gate "rejected" → should_consolidate = false, memory_candidates = []
//   - gate "approval_required" → should_consolidate = false
//   - gate "approved_not_required" + level A + bridge ready → apenas operacional (sem canônica)
//   - gate "approved" + level B + bridge ready + acceptance_criteria → canônica + operacional
//   - CONSOLIDATION_VERSION exportado
// ---------------------------------------------------------------------------
function _checkPM9(fixtures) {
  const name = "PM9 — consolidação de memória";

  try {
    if (typeof CONSOLIDATION_VERSION !== "string" || CONSOLIDATION_VERSION.trim() === "")
      return _fail(name, "CONSOLIDATION_VERSION deve ser string não vazia");

    // Gate rejeitado → não consolida
    const planA = _defaultCanonicalPlan("A");
    const rejectedGate  = { gate_status: "rejected",  can_proceed: false };
    const bridgeBlocked = { bridge_status: BRIDGE_STATUS.BLOCKED, can_execute: false };
    const resultRejected = consolidateMemoryLearning({ plan: planA, gate: rejectedGate, bridge: bridgeBlocked });
    if (resultRejected.should_consolidate !== false)
      return _fail(name, "gate 'rejected' não deve consolidar (should_consolidate deve ser false)");
    if (!Array.isArray(resultRejected.memory_candidates) || resultRejected.memory_candidates.length !== 0)
      return _fail(name, "gate 'rejected' deve retornar memory_candidates vazio");

    // Gate approval_required → não consolida (estado transitório)
    const pendingGate = { gate_status: "approval_required", can_proceed: false };
    const resultPending = consolidateMemoryLearning({ plan: planA, gate: pendingGate, bridge: bridgeBlocked });
    if (resultPending.should_consolidate !== false)
      return _fail(name, "gate 'approval_required' não deve consolidar (estado transitório)");

    // Gate auto-aprovado + nível A + bridge ready → só operacional (nível A não gera canônica)
    const autoApprovedGate = { gate_status: "approved_not_required", can_proceed: true };
    const bridgeReady = { bridge_status: BRIDGE_STATUS.READY, can_execute: true };
    const resultA = consolidateMemoryLearning({ plan: planA, gate: autoApprovedGate, bridge: bridgeReady });
    if (resultA.should_consolidate !== true)
      return _fail(name, "gate aprovado + nível A deve consolidar (should_consolidate = true)");
    const canonicalInA = resultA.memory_candidates.filter((c) => c.is_canonical === true);
    if (canonicalInA.length > 0)
      return _fail(name, "nível A não deve gerar memória canônica");

    // Gate approved + nível B + bridge ready + acceptance_criteria → canônica + operacional
    const planB = _defaultCanonicalPlan("B");
    const approvedGate = { gate_status: "approved", can_proceed: true };
    const resultB = consolidateMemoryLearning({ plan: planB, gate: approvedGate, bridge: bridgeReady });
    if (resultB.should_consolidate !== true)
      return _fail(name, "gate 'approved' + nível B deve consolidar");
    const canonicalInB = resultB.memory_candidates.filter((c) => c.is_canonical === true);
    if (canonicalInB.length === 0)
      return _fail(name, "nível B com bridge ready deve gerar ao menos 1 memória canônica");

    // Shape dos candidatos — compatibilidade com PM1/PM2
    const requiredCandidateFields = ["memory_type","title","content_structured","priority","confidence","is_canonical","status"];
    for (const candidate of resultB.memory_candidates) {
      for (const f of requiredCandidateFields) {
        if (!(f in candidate))
          return _fail(name, `candidato de memória não contém campo '${f}' (incompatível com PM1/PM2)`);
      }
    }

    // Shape do ConsolidationResult — campos obrigatórios
    const requiredResultFields = ["should_consolidate","memory_candidates","reason","next_action"];
    for (const f of requiredResultFields) {
      if (!(f in resultB))
        return _fail(name, `consolidateMemoryLearning não retornou campo '${f}'`);
    }

    return _pass(name, "consolidateMemoryLearning coerente com PM6/PM7/PM8: sem consolidação em rejeição, canônica apenas em B/C aprovados com bridge ready");
  } catch (err) {
    return _fail(name, `exceção inesperada: ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// _defaultValidMemory()
//
// Fixture interna de objeto de memória válido para uso no PM1 check.
// ---------------------------------------------------------------------------
function _defaultValidMemory() {
  return buildMemoryObject({
    memory_id:          "audit_mem_001",
    memory_type:        MEMORY_TYPES.USER_PROFILE,
    entity_type:        ENTITY_TYPES.USER,
    entity_id:          "user_audit",
    title:              "Perfil de auditoria PM10",
    content_structured: { audit: true },
    priority:           MEMORY_PRIORITY.MEDIUM,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "pm10_audit",
    created_at:         "2026-04-12T00:00:00Z",
    updated_at:         "2026-04-12T00:00:00Z",
    expires_at:         null,
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
  });
}

// ---------------------------------------------------------------------------
// _defaultCanonicalPlan(level)
//
// Fixture interna de plano canônico para uso nos checks PM7/PM8/PM9.
// Simula saída do buildCanonicalPlan (PM6) sem chamar o módulo externamente.
// ---------------------------------------------------------------------------
function _defaultCanonicalPlan(level) {
  const levelUp = level.toUpperCase();
  const plan_type = LEVEL_TO_PLAN_TYPE[levelUp] || "tactical_plan";
  return {
    plan_version:        PLAN_VERSION,
    plan_type,
    complexity_level:    levelUp,
    output_mode:         plan_type,
    objective:           `Objetivo de auditoria PM10 — nível ${levelUp}`,
    scope_summary:       "Escopo de auditoria interna PM10",
    steps:               ["Passo 1", "Passo 2", "Passo 3"],
    risks:               ["Risco de auditoria"],
    acceptance_criteria: ["Critério de aceite de auditoria"],
    needs_human_approval: levelUp === "C",
    next_action:         "Auditoria de smoke test",
    reason:              `auditoria PM10 nível ${levelUp}`,
  };
}

// ---------------------------------------------------------------------------
// runPlannerMemoryAudit(fixturesOrInputs?)
//
// Função pública e determinística da PM10.
// Audita a coerência e integridade do ciclo Planner + Memory (PM1–PM9)
// sem executar, persistir, chamar KV, endpoints, ou LLM.
//
// Parâmetros (todos opcionais):
//   fixturesOrInputs {object} — fixtures customizados para alguns checks:
//     validMemory      {object}  — objeto de memória válido para PM1
//     simpleRequest    {object}  — input simples para PM4 (deve classificar como A)
//     complexRequest   {object}  — input complexo para PM4 (deve classificar como C)
//
// Retorna AuditReport:
//   {
//     audit_version,  — string
//     audit_status,   — "passed" | "failed"
//     is_ready,       — boolean
//     checks,         — Check[]
//     summary,        — string curta e clara
//     next_action,    — string orientando o próximo passo
//   }
//
// Cada Check:
//   {
//     check_name,  — string
//     status,      — "passed" | "failed"
//     reason,      — string objetiva
//   }
// ---------------------------------------------------------------------------
function runPlannerMemoryAudit(fixturesOrInputs) {
  const fixtures =
    fixturesOrInputs && typeof fixturesOrInputs === "object" && !Array.isArray(fixturesOrInputs)
      ? fixturesOrInputs
      : {};

  const checks = [
    _checkPM1(fixtures),
    _checkPM2(),
    _checkPM3(),
    _checkPM4(fixtures),
    _checkPM5(fixtures),
    _checkPM6(fixtures),
    _checkPM7(fixtures),
    _checkPM8(fixtures),
    _checkPM9(fixtures),
  ];

  const failedChecks = checks.filter((c) => c.status === CHECK_STATUS.FAILED);
  const audit_status = failedChecks.length === 0 ? "passed" : "failed";
  const is_ready     = audit_status === "passed";

  const summary = is_ready
    ? `Frente Planner + Memory Layer auditada com sucesso: ${checks.length}/${checks.length} checks passaram. Ciclo PM1–PM9 coerente e pronto para uso controlado.`
    : `Auditoria detectou ${failedChecks.length} falha(s) em ${checks.length} checks: ${failedChecks.map((c) => c.check_name).join(", ")}.`;

  const next_action = is_ready
    ? "Frente aprovada para auditoria humana final e próximo planejamento. Nenhuma ação técnica pendente."
    : "Revisar os checks com status 'failed' e corrigir incompatibilidades antes de liberar a frente.";

  return {
    audit_version: AUDIT_VERSION,
    audit_status,
    is_ready,
    checks,
    summary,
    next_action,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  runPlannerMemoryAudit,
  AUDIT_VERSION,
};
