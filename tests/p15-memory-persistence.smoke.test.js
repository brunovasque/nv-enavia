// ============================================================================
// 🧪 Smoke Tests — P15: Persistência real pós-ciclo (memoryConsolidation → KV)
//
// Run: node tests/p15-memory-persistence.smoke.test.js
//
// Prova que:
//   1. O pipeline PM4→PM9 continua funcionando (P11–P14 não regrediu)
//   2. memoryConsolidation.should_consolidate=true → candidatos persistidos via PM2
//   3. memoryConsolidation.should_consolidate=false → nada persistido no KV
//   4. Cada candidato escrito contém os campos obrigatórios do PM1 (memory_id,
//      entity_type, entity_id, source, created_at, updated_at, etc.)
//   5. A chave KV usada é "memory:<memory_id>" (padrão canônico PM2)
//   6. memory:index é atualizado com os IDs persistidos
//   7. response telemetry.consolidation_persisted reflete os resultados reais
//
// Usa um mock KV em memória — sem Cloudflare deploy necessário.
// ============================================================================

import { classifyRequest }          from "../schema/planner-classifier.js";
import { buildOutputEnvelope }      from "../schema/planner-output-modes.js";
import { buildCanonicalPlan }       from "../schema/planner-canonical-plan.js";
import { evaluateApprovalGate,
         approvePlan }              from "../schema/planner-approval-gate.js";
import { buildExecutorBridgePayload,
         BRIDGE_STATUS }            from "../schema/planner-executor-bridge.js";
import { consolidateMemoryLearning } from "../schema/memory-consolidation.js";
import { writeMemory,
         readMemoryById }           from "../schema/memory-storage.js";
import { buildMemoryObject,
         ENTITY_TYPES }             from "../schema/memory-schema.js";

// ---------------------------------------------------------------------------
// In-memory KV mock — idêntico ao usado em memory-storage.smoke.test.js
// ---------------------------------------------------------------------------
function makeKVMock() {
  const store = new Map();
  const ENAVIA_BRAIN = {
    async get(key) {
      return store.has(key) ? store.get(key) : null;
    },
    async put(key, value) {
      store.set(key, value);
    },
    async delete(key) {
      store.delete(key);
    },
  };
  return { ENAVIA_BRAIN, _store: store };
}

// ---------------------------------------------------------------------------
// safeId — replica do worker (sem import direto do worker principal)
// ---------------------------------------------------------------------------
function safeId(prefix = "id") {
  return (
    prefix +
    "-" +
    Date.now().toString(36) +
    "-" +
    Math.random().toString(36).slice(2, 8)
  );
}

// ---------------------------------------------------------------------------
// runPipelineAndPersist — replica o fluxo de handlePlannerRun(request, env)
//
// Simula o pipeline real PM4→PM9→P15 com um env de mock KV.
// ---------------------------------------------------------------------------
async function runPipelineAndPersist(message, contextOverrides, envMock, sessionId) {
  const context = contextOverrides || {};
  const session_id = sessionId || "";

  // PM4 → PM5 → PM6 → PM7 → PM8 → PM9
  const classification = classifyRequest({ text: message, context });
  const envelope       = buildOutputEnvelope(classification, { text: message });
  const canonicalPlan  = buildCanonicalPlan({ classification, envelope, input: { text: message } });
  const gate           = evaluateApprovalGate(canonicalPlan);
  const bridge         = buildExecutorBridgePayload({ plan: canonicalPlan, gate });
  const memoryConsolidation = consolidateMemoryLearning({ plan: canonicalPlan, gate, bridge });

  // P15 — Persistência pós-ciclo (réplica exata do patch no worker)
  const consolidation_persisted = [];
  if (memoryConsolidation.should_consolidate && envMock && envMock.ENAVIA_BRAIN) {
    const cycleId = session_id || safeId("cycle");
    const nowIso  = new Date().toISOString();

    for (const candidate of memoryConsolidation.memory_candidates) {
      const memObj = buildMemoryObject({
        ...candidate,
        memory_id:   safeId("mem"),
        entity_type: ENTITY_TYPES.OPERATION,
        entity_id:   cycleId,
        source:      "planner_run",
        created_at:  nowIso,
        updated_at:  nowIso,
        expires_at:  null,
        flags:       [],
      });

      let writeResult;
      try {
        writeResult = await writeMemory(memObj, envMock);
      } catch (kvErr) {
        writeResult = { ok: false, error: String(kvErr) };
      }

      consolidation_persisted.push({
        memory_id:    memObj.memory_id,
        memory_type:  memObj.memory_type,
        is_canonical: memObj.is_canonical,
        kv_key:       `memory:${memObj.memory_id}`,
        write_ok:     writeResult.ok === true,
        error:        writeResult.ok ? undefined : writeResult.error,
      });
    }
  }

  return {
    ok: true,
    planner: { classification, canonicalPlan, gate, bridge, memoryConsolidation },
    telemetry: {
      pipeline: "PM4→PM5→PM6→PM7→PM8→PM9→P15",
      session_id: session_id || null,
      consolidation_persisted,
    },
    _envMock: envMock,
  };
}

// ---------------------------------------------------------------------------
// Test runner helpers
// ---------------------------------------------------------------------------
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

// ===========================================================================
// Group 1 — Pipeline continua funcionando (regressão P11–P14)
// Smoke rápido: os shapes PM4→PM9 ainda conversam corretamente
// ===========================================================================
async function testPipelineIntegrity() {
  console.log("\nGroup 1: Pipeline PM4→PM9 não regrediu (P11–P14 intactos)");

  const env = makeKVMock();
  const r = await runPipelineAndPersist("Ver os logs do worker de produção.", {}, env);

  assert(r.ok === true,                                            "ok === true");
  assert(r.planner.classification !== undefined,                   "classification presente");
  assert(typeof r.planner.classification.complexity_level === "string", "complexity_level é string");
  assert(r.planner.canonicalPlan !== undefined,                    "canonicalPlan presente");
  assert(r.planner.gate !== undefined,                             "gate presente");
  assert(r.planner.bridge !== undefined,                           "bridge presente");
  assert(r.planner.memoryConsolidation !== undefined,              "memoryConsolidation presente");
  assert(typeof r.planner.memoryConsolidation.should_consolidate === "boolean",
    "memoryConsolidation.should_consolidate é boolean");
  assert(Array.isArray(r.planner.memoryConsolidation.memory_candidates),
    "memoryConsolidation.memory_candidates é array");
  assert(r.telemetry.pipeline === "PM4→PM5→PM6→PM7→PM8→PM9→P15", "pipeline string inclui P15");
  assert(Array.isArray(r.telemetry.consolidation_persisted),       "consolidation_persisted é array");
}

// ===========================================================================
// Group 2 — Persistência real: nível A (should_consolidate=true, sem canônica)
// ===========================================================================
async function testPersistenceLevelA() {
  console.log("\nGroup 2: Persistência real — nível A (operacional)");

  const env = makeKVMock();
  const r   = await runPipelineAndPersist("Quero ver os logs do worker.", {}, env);

  // Nível A: gate aprovado automaticamente → should_consolidate=true, apenas operacional
  assert(r.planner.gate.can_proceed === true, "gate aprova nível A automaticamente");
  assert(r.planner.memoryConsolidation.should_consolidate === true, "should_consolidate=true para nível A aprovado");

  const persisted = r.telemetry.consolidation_persisted;
  assert(persisted.length >= 1, "ao menos 1 candidato persistido");
  assert(persisted.every((p) => p.write_ok === true), "todos os candidatos escritos com write_ok=true");

  // Verifica que cada candidato tem os campos do contrato P15
  for (const p of persisted) {
    assert(typeof p.memory_id === "string" && p.memory_id.startsWith("mem-"), `memory_id tem prefixo 'mem-': ${p.memory_id}`);
    assert(typeof p.memory_type === "string" && p.memory_type.length > 0,     `memory_type presente: ${p.memory_type}`);
    assert(typeof p.is_canonical === "boolean",                                `is_canonical é boolean: ${p.memory_id}`);
    assert(p.kv_key === `memory:${p.memory_id}`,                               `kv_key correto: ${p.kv_key}`);
  }

  // Verifica que os objetos foram realmente gravados no KV (leitura de volta via PM2)
  for (const p of persisted) {
    const stored = await readMemoryById(p.memory_id, env);
    assert(stored !== null,                                                  `KV contém ${p.memory_id}`);
    assert(stored.memory_id   === p.memory_id,                               `memory_id persisted corretamente`);
    assert(stored.entity_type === "operation",                               `entity_type=operation`);
    assert(stored.source      === "planner_run",                             `source=planner_run`);
    assert(typeof stored.created_at === "string" && stored.created_at.length > 0, `created_at gravado`);
    assert(typeof stored.updated_at === "string" && stored.updated_at.length > 0, `updated_at gravado`);
    assert(Array.isArray(stored.flags),                                      `flags é array`);
  }

  // Verifica que memory:index foi atualizado
  const index = JSON.parse(await env.ENAVIA_BRAIN.get("memory:index") || "[]");
  assert(Array.isArray(index), "memory:index é array");
  for (const p of persisted) {
    assert(index.includes(p.memory_id), `memory:index inclui ${p.memory_id}`);
  }
}

// ===========================================================================
// Group 3 — Persistência real: nível C após aprovação humana (operacional + canônica)
// ===========================================================================
async function testPersistenceLevelC() {
  console.log("\nGroup 3: Persistência real — nível C após approvePlan (operacional + canônica)");

  const env = makeKVMock();

  // Simula pipeline com aprovação humana explícita (approvePlan)
  const message = "Migrar a arquitetura do banco de dados para cluster novo em produção, CI/CD e rollback.";
  const context = { mentions_prod: true };

  const classification = classifyRequest({ text: message, context });
  const envelope       = buildOutputEnvelope(classification, { text: message });
  const canonicalPlan  = buildCanonicalPlan({ classification, envelope, input: { text: message } });

  // Forçar aprovação humana para testar candidato canônico
  const gateApproved = approvePlan(canonicalPlan);
  const bridge       = buildExecutorBridgePayload({ plan: canonicalPlan, gate: gateApproved });
  const memoryConsolidation = consolidateMemoryLearning({ plan: canonicalPlan, gate: gateApproved, bridge });

  assert(memoryConsolidation.should_consolidate === true, "should_consolidate=true após aprovação humana");
  assert(memoryConsolidation.memory_candidates.length >= 2, "ao menos 2 candidatos (operacional + canônica)");

  // P15 — persistir
  const cycleId = "test-session-p15-c";
  const nowIso  = new Date().toISOString();
  const consolidation_persisted = [];

  for (const candidate of memoryConsolidation.memory_candidates) {
    const memObj = buildMemoryObject({
      ...candidate,
      memory_id:   safeId("mem"),
      entity_type: ENTITY_TYPES.OPERATION,
      entity_id:   cycleId,
      source:      "planner_run",
      created_at:  nowIso,
      updated_at:  nowIso,
      expires_at:  null,
      flags:       [],
    });

    const writeResult = await writeMemory(memObj, env);
    consolidation_persisted.push({
      memory_id:    memObj.memory_id,
      memory_type:  memObj.memory_type,
      is_canonical: memObj.is_canonical,
      kv_key:       `memory:${memObj.memory_id}`,
      write_ok:     writeResult.ok === true,
    });
  }

  assert(consolidation_persisted.length >= 2, "ao menos 2 candidatos persistidos");
  assert(consolidation_persisted.every((p) => p.write_ok === true), "todos escritos com sucesso");

  const opPersisted  = consolidation_persisted.find((p) => p.memory_type === "operational_history");
  const canPersisted = consolidation_persisted.find((p) => p.memory_type === "canonical_rules");
  assert(opPersisted  !== undefined, "candidato operational_history persistido");
  assert(canPersisted !== undefined, "candidato canonical_rules persistido");
  assert(canPersisted.is_canonical === true, "candidato canônico tem is_canonical=true");
  assert(opPersisted.is_canonical  === false, "candidato operacional tem is_canonical=false");

  // Leitura de volta do KV
  const storedOp  = await readMemoryById(opPersisted.memory_id,  env);
  const storedCan = await readMemoryById(canPersisted.memory_id, env);
  assert(storedOp  !== null, "KV contém registro operacional");
  assert(storedCan !== null, "KV contém registro canônico");
  assert(storedCan.status      === "canonical", "status canônico = 'canonical'");
  assert(storedCan.is_canonical === true,       "is_canonical=true no KV para canônica");
  assert(storedOp.entity_id    === cycleId,     "entity_id = cycleId no operacional");
  assert(storedCan.entity_id   === cycleId,     "entity_id = cycleId no canônico");
}

// ===========================================================================
// Group 4 — Sem persistência quando should_consolidate=false (nível C inicial)
// ===========================================================================
async function testNoPersistenceWhenNotConsolidating() {
  console.log("\nGroup 4: Nenhuma persistência quando should_consolidate=false");

  const env = makeKVMock();
  const r   = await runPipelineAndPersist(
    "Redesenhar toda a arquitetura, migrar banco em fases, múltiplos pipelines e compliance.",
    { mentions_prod: true, known_dependencies: ["supabase"] },
    env
  );

  // Nível C sem aprovação humana: gate=approval_required → should_consolidate=false
  assert(r.planner.gate.gate_status === "approval_required", "gate=approval_required para nível C");
  assert(r.planner.memoryConsolidation.should_consolidate === false, "should_consolidate=false enquanto transitório");
  assert(r.telemetry.consolidation_persisted.length === 0, "nenhum candidato persistido");

  // KV deve estar vazio (exceto memory:index que nem deve existir)
  const index = await env.ENAVIA_BRAIN.get("memory:index");
  assert(index === null, "memory:index não criado quando não há persistência");
}

// ===========================================================================
// Group 5 — Formato de auditoria do response
// ===========================================================================
async function testAuditFormat() {
  console.log("\nGroup 5: Formato de auditoria do response (consolidation_persisted)");

  const env = makeKVMock();
  const r   = await runPipelineAndPersist("Quero ver os logs do worker.", {}, env, "session-audit-001");

  assert(Array.isArray(r.telemetry.consolidation_persisted), "consolidation_persisted é array");
  assert(r.telemetry.session_id === "session-audit-001",     "session_id ecoado no telemetry");

  if (r.planner.memoryConsolidation.should_consolidate) {
    const first = r.telemetry.consolidation_persisted[0];
    assert(first !== undefined,                                          "ao menos 1 registro de auditoria");
    assert(typeof first.memory_id    === "string",                       "auditoria.memory_id é string");
    assert(typeof first.memory_type  === "string",                       "auditoria.memory_type é string");
    assert(typeof first.is_canonical === "boolean",                      "auditoria.is_canonical é boolean");
    assert(typeof first.kv_key       === "string" && first.kv_key.startsWith("memory:"), "auditoria.kv_key começa com 'memory:'");
    assert(first.write_ok            === true,                           "auditoria.write_ok=true");
  }

  assert(r.telemetry.pipeline === "PM4→PM5→PM6→PM7→PM8→PM9→P15", "pipeline reflete P15");
}

// ===========================================================================
// Runner
// ===========================================================================
async function runAll() {
  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║  P15 — Smoke Tests: Persistência real pós-ciclo (PM9→KV)    ║");
  console.log("╚══════════════════════════════════════════════════════════════╝");

  await testPipelineIntegrity();
  await testPersistenceLevelA();
  await testPersistenceLevelC();
  await testNoPersistenceWhenNotConsolidating();
  await testAuditFormat();

  console.log(`\n${"=".repeat(62)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(62)}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runAll().catch((err) => {
  console.error("Fatal error in P15 smoke tests:", err);
  process.exit(1);
});
