// ============================================================================
// 🧪 Smoke Tests — PR5: Aprendizado Controlado / Memória Validada
//
// Run: node tests/pr5-learning-candidates.smoke.test.js
//
// Prova que:
//   1. Candidato de aprendizado é salvo como pendente
//   2. Pendente NÃO entra como memória validada ativa
//   3. Aprovação promove corretamente para memória validada
//   4. Rejeição impede entrada na memória validada
//   5. Item aprovado aparece no retrieval no bloco/prioridade correta
//   6. Item rejeitado NÃO aparece como validado
//   7. Painel/runtime anterior não quebrou
// ============================================================================

import {
  registerLearningCandidate,
  listLearningCandidates,
  getLearningCandidateById,
  approveLearningCandidate,
  rejectLearningCandidate,
  CANDIDATE_STATUS,
} from "../schema/learning-candidates.js";

import {
  writeMemory,
  readMemoryById,
} from "../schema/memory-storage.js";

import {
  MEMORY_TYPES,
  MEMORY_STATUS,
  MEMORY_PRIORITY,
  MEMORY_CONFIDENCE,
  ENTITY_TYPES,
  validateMemoryObject,
  buildMemoryObject,
} from "../schema/memory-schema.js";

import {
  searchMemory,
  searchRelevantMemory,
} from "../schema/memory-read.js";

import {
  buildRetrievalContext,
  _classifyMemory,
} from "../schema/memory-retrieval.js";

import assert from "node:assert/strict";

// ---------------------------------------------------------------------------
// In-memory KV mock
// ---------------------------------------------------------------------------
function makeKVMock() {
  const store = new Map();
  const ENAVIA_BRAIN = {
    async get(key) { return store.has(key) ? store.get(key) : null; },
    async put(key, value) { store.set(key, value); },
    async delete(key) { store.delete(key); },
  };
  return { ENAVIA_BRAIN, _store: store };
}

let passed = 0;
let failed = 0;
const results = [];

function ok(label) {
  passed++;
  results.push(`  ✅ ${label}`);
}
function fail(label, err) {
  failed++;
  results.push(`  ❌ ${label}: ${err}`);
}

// ============================================================================
// Test Group 1: Candidato de aprendizado é salvo como pendente
// ============================================================================
async function testRegisterCandidate() {
  const env = makeKVMock();

  // Register a learning candidate
  const res = await registerLearningCandidate({
    title: "Deploy em staging deve ter rollback automático",
    content_structured: { text: "Padrão observado: deploys em staging sem rollback causam problemas." },
    source: "consolidation",
    confidence: "medium",
    priority: "high",
    tags: ["deploy", "staging"],
  }, env);

  try {
    assert.ok(res.ok, `register failed: ${res.error}`);
    assert.ok(res.candidate_id, "candidate_id must be present");
    assert.equal(res.record.status, CANDIDATE_STATUS.PENDING);
    assert.equal(res.record.title, "Deploy em staging deve ter rollback automático");
    assert.equal(res.record.source, "consolidation");
    assert.ok(res.record.created_at);
    assert.ok(res.record.updated_at);
    assert.equal(res.record.approved_at, null);
    assert.equal(res.record.rejected_at, null);
    assert.equal(res.record.promoted_memory_id, null);
    ok("1.1 — candidato de aprendizado salvo como pendente com todos os campos");
  } catch (e) { fail("1.1 — candidato de aprendizado salvo como pendente", e.message); }

  // List candidates — should appear
  const list = await listLearningCandidates(env);
  try {
    assert.ok(list.ok);
    assert.equal(list.count, 1);
    assert.equal(list.items[0].status, CANDIDATE_STATUS.PENDING);
    ok("1.2 — candidato aparece na listagem como pendente");
  } catch (e) { fail("1.2 — candidato aparece na listagem como pendente", e.message); }

  // Read by id
  const read = await getLearningCandidateById(res.candidate_id, env);
  try {
    assert.ok(read !== null);
    assert.equal(read.candidate_id, res.candidate_id);
    assert.equal(read.status, CANDIDATE_STATUS.PENDING);
    ok("1.3 — candidato pode ser lido por id");
  } catch (e) { fail("1.3 — candidato pode ser lido por id", e.message); }

  // Validation: required fields
  const badRes = await registerLearningCandidate({}, env);
  try {
    assert.ok(!badRes.ok);
    ok("1.4 — registro sem título falha com erro");
  } catch (e) { fail("1.4 — registro sem título falha com erro", e.message); }
}

// ============================================================================
// Test Group 2: Pendente NÃO entra como memória validada ativa
// ============================================================================
async function testPendingNotInMemory() {
  const env = makeKVMock();

  // Register candidate
  await registerLearningCandidate({
    title: "Candidato pendente de teste",
    content_structured: { text: "Não deve entrar na memória ativa" },
    source: "runtime",
  }, env);

  // Check memory:index — should be empty (no promoted memory)
  const memIndex = await env.ENAVIA_BRAIN.get("memory:index");
  try {
    const parsed = memIndex ? JSON.parse(memIndex) : [];
    assert.equal(parsed.length, 0, "memory:index should be empty — pending candidate must NOT create memory");
    ok("2.1 — candidato pendente NÃO cria entrada em memory:index");
  } catch (e) { fail("2.1 — candidato pendente NÃO cria entrada em memory:index", e.message); }

  // searchMemory should return nothing
  const search = await searchMemory({}, env);
  try {
    assert.ok(search.ok);
    assert.equal(search.count, 0, "no memory should exist while candidate is pending");
    ok("2.2 — searchMemory retorna zero enquanto candidato é pendente");
  } catch (e) { fail("2.2 — searchMemory retorna zero enquanto candidato é pendente", e.message); }

  // searchRelevantMemory should return nothing
  const relevant = await searchRelevantMemory({}, env);
  try {
    assert.ok(relevant.ok);
    assert.equal(relevant.count, 0);
    ok("2.3 — searchRelevantMemory retorna zero para candidato pendente");
  } catch (e) { fail("2.3 — searchRelevantMemory retorna zero para candidato pendente", e.message); }

  // buildRetrievalContext should have zero validated_learning
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.equal(retrieval.blocks.validated_learning.count, 0);
    ok("2.4 — retrieval validated_learning vazio com candidato pendente");
  } catch (e) { fail("2.4 — retrieval validated_learning vazio com candidato pendente", e.message); }
}

// ============================================================================
// Test Group 3: Aprovação promove corretamente para memória validada
// ============================================================================
async function testApprovalPromotion() {
  const env = makeKVMock();

  // Register candidate
  const reg = await registerLearningCandidate({
    title: "Regra de deploy validada",
    content_structured: { text: "Sempre fazer rollback em caso de falha em staging" },
    source: "runtime",
    priority: "high",
    tags: ["deploy"],
  }, env);

  assert.ok(reg.ok);
  const candidateId = reg.candidate_id;

  // Approve
  const approve = await approveLearningCandidate(candidateId, env);
  try {
    assert.ok(approve.ok, `approval failed: ${approve.error}`);
    assert.equal(approve.candidate_id, candidateId);
    assert.ok(approve.promoted_memory_id, "promoted_memory_id must be present");
    assert.equal(approve.candidate.status, CANDIDATE_STATUS.APPROVED);
    assert.ok(approve.candidate.approved_at);
    ok("3.1 — aprovação retorna ok com promoted_memory_id");
  } catch (e) { fail("3.1 — aprovação retorna ok com promoted_memory_id", e.message); }

  // Candidate status is now approved
  const updated = await getLearningCandidateById(candidateId, env);
  try {
    assert.equal(updated.status, CANDIDATE_STATUS.APPROVED);
    assert.equal(updated.promoted_memory_id, approve.promoted_memory_id);
    ok("3.2 — candidato atualizado para status approved");
  } catch (e) { fail("3.2 — candidato atualizado para status approved", e.message); }

  // Promoted memory exists in storage
  const mem = await readMemoryById(approve.promoted_memory_id, env);
  try {
    assert.ok(mem !== null, "promoted memory must exist in storage");
    assert.equal(mem.memory_type, MEMORY_TYPES.APRENDIZADO_VALIDADO);
    assert.equal(mem.status, MEMORY_STATUS.ACTIVE);
    assert.equal(mem.confidence, MEMORY_CONFIDENCE.CONFIRMED);
    assert.equal(mem.source, "learning_approved");
    assert.equal(mem.title, "Regra de deploy validada");
    assert.ok(mem.tags.includes("pr5"));
    assert.ok(mem.tags.includes("learning_approved"));
    ok("3.3 — memória promovida existe com tipo aprendizado_validado e status active");
  } catch (e) { fail("3.3 — memória promovida existe com tipo aprendizado_validado", e.message); }

  // Schema validation of promoted memory
  const validation = validateMemoryObject(mem);
  try {
    assert.ok(validation.valid, `schema errors: ${(validation.errors || []).join(", ")}`);
    ok("3.4 — memória promovida passa validação de schema");
  } catch (e) { fail("3.4 — memória promovida passa validação de schema", e.message); }

  // Double approve should fail
  const doubleApprove = await approveLearningCandidate(candidateId, env);
  try {
    assert.ok(!doubleApprove.ok, "double approve should fail");
    ok("3.5 — dupla aprovação é rejeitada");
  } catch (e) { fail("3.5 — dupla aprovação é rejeitada", e.message); }
}

// ============================================================================
// Test Group 4: Rejeição impede entrada na memória validada
// ============================================================================
async function testRejection() {
  const env = makeKVMock();

  // Register candidate
  const reg = await registerLearningCandidate({
    title: "Candidato a ser rejeitado",
    content_structured: { text: "Não deve virar memória" },
    source: "runtime",
  }, env);
  assert.ok(reg.ok);
  const candidateId = reg.candidate_id;

  // Reject
  const reject = await rejectLearningCandidate(candidateId, "Não é relevante", env);
  try {
    assert.ok(reject.ok, `rejection failed: ${reject.error}`);
    assert.equal(reject.candidate_id, candidateId);
    assert.equal(reject.candidate.status, CANDIDATE_STATUS.REJECTED);
    assert.ok(reject.candidate.rejected_at);
    assert.equal(reject.candidate.rejection_reason, "Não é relevante");
    ok("4.1 — rejeição retorna ok com status rejected e motivo");
  } catch (e) { fail("4.1 — rejeição retorna ok com status rejected e motivo", e.message); }

  // No memory should exist
  const memIndex = await env.ENAVIA_BRAIN.get("memory:index");
  try {
    const parsed = memIndex ? JSON.parse(memIndex) : [];
    assert.equal(parsed.length, 0, "no memory should be promoted for rejected candidate");
    ok("4.2 — candidato rejeitado NÃO gera memória em memory:index");
  } catch (e) { fail("4.2 — candidato rejeitado NÃO gera memória em memory:index", e.message); }

  // searchMemory returns nothing
  const search = await searchMemory({}, env);
  try {
    assert.ok(search.ok);
    assert.equal(search.count, 0);
    ok("4.3 — searchMemory retorna zero após rejeição");
  } catch (e) { fail("4.3 — searchMemory retorna zero após rejeição", e.message); }

  // Double reject should fail
  const doubleReject = await rejectLearningCandidate(candidateId, "again", env);
  try {
    assert.ok(!doubleReject.ok);
    ok("4.4 — dupla rejeição é bloqueada");
  } catch (e) { fail("4.4 — dupla rejeição é bloqueada", e.message); }

  // Candidate still readable for history
  const hist = await getLearningCandidateById(candidateId, env);
  try {
    assert.ok(hist !== null);
    assert.equal(hist.status, CANDIDATE_STATUS.REJECTED);
    ok("4.5 — candidato rejeitado permanece no storage para histórico");
  } catch (e) { fail("4.5 — candidato rejeitado permanece no storage para histórico", e.message); }
}

// ============================================================================
// Test Group 5: Item aprovado aparece no retrieval no bloco/prioridade correta
// ============================================================================
async function testApprovedInRetrieval() {
  const env = makeKVMock();

  // Register and approve
  const reg = await registerLearningCandidate({
    title: "Regra aprovada para retrieval",
    content_structured: { text: "Regra que deve aparecer como validated_learning" },
    source: "consolidation",
    priority: "high",
  }, env);
  assert.ok(reg.ok);
  const approval = await approveLearningCandidate(reg.candidate_id, env);
  assert.ok(approval.ok);

  // _classifyMemory should return validated_learning for aprendizado_validado
  const mem = await readMemoryById(approval.promoted_memory_id, env);
  const classification = _classifyMemory(mem);
  try {
    assert.equal(classification, "validated_learning");
    ok("5.1 — _classifyMemory retorna 'validated_learning' para aprendizado_validado");
  } catch (e) { fail("5.1 — _classifyMemory retorna 'validated_learning'", e.message); }

  // buildRetrievalContext should have item in validated_learning block
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.ok(retrieval.blocks.validated_learning.count > 0, "validated_learning block should have items");
    const found = retrieval.blocks.validated_learning.items.find(
      (m) => m.memory_id === approval.promoted_memory_id,
    );
    assert.ok(found, "promoted memory should be in validated_learning block");
    assert.equal(found._pr3_block, "validated_learning");
    ok("5.2 — item aprovado aparece no retrieval validated_learning");
  } catch (e) { fail("5.2 — item aprovado aparece no retrieval validated_learning", e.message); }

  // searchRelevantMemory should find it
  const relevant = await searchRelevantMemory({}, env);
  try {
    assert.ok(relevant.ok);
    const found = relevant.results.find((m) => m.memory_id === approval.promoted_memory_id);
    assert.ok(found, "promoted memory should appear in searchRelevantMemory");
    assert.equal(found.memory_type, MEMORY_TYPES.APRENDIZADO_VALIDADO);
    ok("5.3 — searchRelevantMemory inclui item aprovado");
  } catch (e) { fail("5.3 — searchRelevantMemory inclui item aprovado", e.message); }
}

// ============================================================================
// Test Group 6: Item rejeitado NÃO aparece como validado
// ============================================================================
async function testRejectedNotInRetrieval() {
  const env = makeKVMock();

  // Register and reject one
  const reg1 = await registerLearningCandidate({
    title: "Candidato rejeitado",
    content_structured: { text: "Não deve aparecer" },
    source: "runtime",
  }, env);
  await rejectLearningCandidate(reg1.candidate_id, "irrelevante", env);

  // Register and approve another (to have something in retrieval)
  const reg2 = await registerLearningCandidate({
    title: "Candidato aprovado",
    content_structured: { text: "Deve aparecer" },
    source: "runtime",
  }, env);
  const approval = await approveLearningCandidate(reg2.candidate_id, env);
  assert.ok(approval.ok);

  // Retrieval should only have the approved one
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.equal(retrieval.blocks.validated_learning.count, 1);
    const ids = retrieval.blocks.validated_learning.items.map((m) => m.memory_id);
    assert.ok(ids.includes(approval.promoted_memory_id), "approved must be in retrieval");
    ok("6.1 — apenas item aprovado aparece no retrieval, rejeitado ausente");
  } catch (e) { fail("6.1 — apenas item aprovado aparece no retrieval", e.message); }

  // List candidates — both should be visible for history
  const list = await listLearningCandidates(env);
  try {
    assert.ok(list.ok);
    assert.equal(list.count, 2, "both candidates should be in the learning index");
    ok("6.2 — ambos candidatos visíveis na listagem de candidatos (histórico)");
  } catch (e) { fail("6.2 — ambos candidatos visíveis na listagem", e.message); }

  // Filter by status
  const pendingOnly = await listLearningCandidates(env, { status: "pending" });
  try {
    assert.ok(pendingOnly.ok);
    assert.equal(pendingOnly.count, 0, "no pending candidates left");
    ok("6.3 — filtro por status pendente retorna zero");
  } catch (e) { fail("6.3 — filtro por status pendente retorna zero", e.message); }

  const rejectedOnly = await listLearningCandidates(env, { status: "rejected" });
  try {
    assert.ok(rejectedOnly.ok);
    assert.equal(rejectedOnly.count, 1);
    ok("6.4 — filtro por status rejeitado retorna 1");
  } catch (e) { fail("6.4 — filtro por status rejeitado retorna 1", e.message); }
}

// ============================================================================
// Test Group 7: Painel/runtime anterior não quebrou (non-regression)
// ============================================================================
async function testNonRegression() {
  const env = makeKVMock();

  // PR2: canonical_rules still work
  const canonicalMem = buildMemoryObject({
    memory_id:          "nr-canonical-001",
    memory_type:        MEMORY_TYPES.CANONICAL_RULES,
    entity_type:        ENTITY_TYPES.RULE,
    entity_id:          "nr-canonical-001",
    title:              "Canonical rule test",
    content_structured: { text: "A canonical rule" },
    priority:           MEMORY_PRIORITY.CRITICAL,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "system",
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
    is_canonical:       true,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               [],
  });
  const w1 = await writeMemory(canonicalMem, env);
  try { assert.ok(w1.ok); ok("7.1 — canonical_rules ainda funciona corretamente"); }
  catch (e) { fail("7.1 — canonical_rules ainda funciona", e.message); }

  // PR4: manual memory still works
  const manualMem = buildMemoryObject({
    memory_id:          "nr-manual-001",
    memory_type:        MEMORY_TYPES.MEMORIA_MANUAL,
    entity_type:        ENTITY_TYPES.RULE,
    entity_id:          "nr-manual-001",
    title:              "Manual memory test",
    content_structured: { text: "A manual instruction" },
    priority:           MEMORY_PRIORITY.HIGH,
    confidence:         MEMORY_CONFIDENCE.CONFIRMED,
    source:             "panel",
    created_at:         new Date().toISOString(),
    updated_at:         new Date().toISOString(),
    is_canonical:       false,
    status:             MEMORY_STATUS.ACTIVE,
    flags:              [],
    tags:               ["manual"],
  });
  const w2 = await writeMemory(manualMem, env);
  try { assert.ok(w2.ok); ok("7.2 — memoria_manual (PR4) ainda funciona"); }
  catch (e) { fail("7.2 — memoria_manual (PR4) ainda funciona", e.message); }

  // Retrieval separates correctly
  const retrieval = await buildRetrievalContext({}, env);
  try {
    assert.ok(retrieval.ok);
    assert.ok(retrieval.blocks.validated_learning.count > 0, "canonical should be in validated_learning");
    assert.ok(retrieval.blocks.manual_instructions.count > 0, "manual should be in manual_instructions");
    ok("7.3 — retrieval separa canonical/manual/learning corretamente");
  } catch (e) { fail("7.3 — retrieval separa corretamente", e.message); }

  // Schema validation for all PR2 memory types still works
  for (const typeName of [
    "conversa_atual", "memoria_longa", "memoria_manual",
    "aprendizado_validado", "memoria_temporaria",
  ]) {
    const testMem = buildMemoryObject({
      memory_id: `nr-type-${typeName}`,
      memory_type: typeName,
      entity_type: ENTITY_TYPES.CONTEXT,
      entity_id: `nr-type-${typeName}`,
      title: `Type test ${typeName}`,
      content_structured: { text: "test" },
      source: "test",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      expires_at: typeName === "memoria_temporaria" ? new Date(Date.now() + 86400000).toISOString() : null,
      flags: [],
      tags: [],
    });
    const v = validateMemoryObject(testMem);
    try {
      assert.ok(v.valid, `${typeName} validation errors: ${(v.errors || []).join(", ")}`);
    } catch (e) {
      fail(`7.4 — PR2 type '${typeName}' schema validation`, e.message);
      continue;
    }
  }
  ok("7.4 — todos os tipos de memória PR2 passam validação de schema");

  // Learning candidate operations don't interfere with manual memory
  const reg = await registerLearningCandidate({
    title: "Candidato durante non-regression",
    content_structured: { text: "Test" },
    source: "test",
  }, env);
  assert.ok(reg.ok);

  // Manual memory should still be searchable
  const search = await searchMemory({ memory_type: MEMORY_TYPES.MEMORIA_MANUAL }, env);
  try {
    assert.ok(search.ok);
    assert.equal(search.count, 1);
    assert.equal(search.results[0].memory_id, "nr-manual-001");
    ok("7.5 — searchMemory para memoria_manual não foi afetada por candidato de aprendizado");
  } catch (e) { fail("7.5 — searchMemory para memoria_manual intacta", e.message); }
}

// ============================================================================
// Runner
// ============================================================================
async function main() {
  console.log("\n🧪 PR5 — Learning Candidates / Controlled Learning Smoke Tests\n");

  await testRegisterCandidate();
  await testPendingNotInMemory();
  await testApprovalPromotion();
  await testRejection();
  await testApprovedInRetrieval();
  await testRejectedNotInRetrieval();
  await testNonRegression();

  console.log(results.join("\n"));
  console.log(`\n📊 Results: ${passed} passed, ${failed} failed, ${passed + failed} total`);

  if (failed > 0) {
    console.log("\n❌ SOME TESTS FAILED");
    process.exit(1);
  } else {
    console.log("\n✅ ALL TESTS PASSED");
  }
}

main();
