// ============================================================================
// 🧪 Smoke Tests — Contract Active State (PR2)
//
// Run: node tests/contract-active-state.smoke.test.js
//
// Tests:
//   1. Activate ingested contract → success
//   2. Activate non-existent contract → safe failure
//   3. Activate with invalid inputs → safe failure
//   4. Resolve relevant blocks by phase → subset
//   5. Resolve relevant blocks by intent → subset
//   6. Resolve relevant blocks by block_types → subset
//   7. Resolve with no signal → fallback (honest)
//   8. Canonical summary from real ingestion data
//   9. Canonical summary with empty/missing data
//  10. readActiveContractState reads persisted state
//  11. getActiveContractContext returns runtime-friendly context
//  12. refreshCanonicalSummary re-generates summary
//  13. PR1 read still works (no regression)
// ============================================================================

import {
  activateIngestedContract,
  readActiveContractState,
  resolveRelevantContractBlocks,
  buildCanonicalSummary,
  refreshCanonicalSummary,
  getActiveContractContext,
  KV_PREFIX_ACTIVE_STATE,
  KV_ACTIVE_CONTRACT_KEY,
  KV_ACTIVE_CURRENT_PREFIX,
  KV_DEFAULT_SCOPE,
  KV_SUFFIX_RESOLUTION_CTX,
} from "../schema/contract-active-state.js";

import {
  ingestLongContract,
  readContractIngestion,
} from "../schema/contract-ingestion.js";

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
    async get(key) {
      return store[key] || null;
    },
    async put(key, value) {
      store[key] = value;
    },
    _store: store,
  };
}

// ---------------------------------------------------------------------------
// Sample contract (multi-section with various signals)
// ---------------------------------------------------------------------------
const MULTI_SECTION_CONTRACT = `
CLÁUSULA 1 - DO OBJETO
Este contrato tem por objeto a contratação de serviços de desenvolvimento de software
para o sistema de gestão do contratante. O escopo inclui análise, desenvolvimento,
testes e implantação.

CLÁUSULA 2 - DAS OBRIGAÇÕES DO CONTRATADO
O contratado deverá entregar o sistema conforme especificações técnicas.
É proibido subcontratar sem autorização prévia do contratante.
O contratado deve manter confidencialidade sobre todos os dados.

CLÁUSULA 3 - DO PRAZO
O prazo de execução será de 90 dias a partir da assinatura.
O prazo máximo para entrega final é 120 dias.

CLÁUSULA 4 - DO PAGAMENTO
O pagamento será realizado em 3 parcelas mensais de R$ 10.000,00.
A primeira parcela será paga após a aprovação do escopo.

CLÁUSULA 5 - DOS CRITÉRIOS DE ACEITE
Os critérios de aceite incluem: cobertura de testes mínima de 80%,
aprovação humana do gestor para cada entrega, e conformidade com SLA.
A definição de pronto será acordada em reunião de kick-off.

CLÁUSULA 6 - DAS PENALIDADES
Multa de 2% ao mês por atraso na entrega.
A penalidade será aplicada sobre o valor total do contrato.

CLÁUSULA 7 - DA RESCISÃO
A rescisão poderá ocorrer por qualquer das partes com aviso prévio de 30 dias.
A condição suspensiva de pagamento bloqueia a execução até regularização.

CLÁUSULA 8 - DISPOSIÇÕES GERAIS
As partes elegem o foro da comarca de São Paulo.
`.trim();

// ===========================================================================
// Test suite
// ===========================================================================

console.log("\n=== PR2 — Contract Active State Smoke Tests ===\n");

// ---------------------------------------------------------------------------
// 1. Activate ingested contract → success
// ---------------------------------------------------------------------------
console.log("1. Activate ingested contract → success");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  // First ingest via PR1
  const ingestResult = await ingestLongContract(env, "ctr_001", MULTI_SECTION_CONTRACT, { goal: "Software development" });
  assert(ingestResult.ok, "PR1 ingestion succeeds");

  // Now activate
  const result = await activateIngestedContract(env, "ctr_001", { phase_hint: "scope", operator: "test" });
  assert(result.ok, "activation returns ok=true");
  assert(result.contract_id === "ctr_001", "contract_id matches");
  assert(result.active_state !== null, "active_state is present");
  assert(result.active_state.contract_id === "ctr_001", "state.contract_id matches");
  assert(typeof result.active_state.activated_at === "string", "activated_at is ISO string");
  assert(result.active_state.current_phase_hint === "scope", "phase_hint preserved");
  assert(result.active_state.summary_canonic !== null, "summary_canonic is present");
  assert(result.active_state.version === "v1", "version is v1");
  assert(result.active_state.metadata.operator === "test", "operator preserved");
  assert(result.active_state.metadata.scope === "default", "scope defaults to 'default'");
  assert(!("relevant_block_ids" in result.active_state), "relevant_block_ids NOT in core state (lives in resolution_ctx)");
}

// ---------------------------------------------------------------------------
// 2. Activate non-existent contract → safe failure
// ---------------------------------------------------------------------------
console.log("\n2. Activate non-existent contract → safe failure");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const result = await activateIngestedContract(env, "ctr_nonexistent");
  assert(result.ok === false, "returns ok=false");
  assert(result.error === "CONTRACT_NOT_INGESTED", "error is CONTRACT_NOT_INGESTED");
  assert(typeof result.message === "string", "message is present");
}

// ---------------------------------------------------------------------------
// 3. Activate with invalid inputs → safe failure
// ---------------------------------------------------------------------------
console.log("\n3. Activate with invalid inputs → safe failure");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const r1 = await activateIngestedContract(env, "");
  assert(r1.ok === false, "empty contractId → fails");
  assert(r1.error === "INVALID_CONTRACT_ID", "error is INVALID_CONTRACT_ID");

  const r2 = await activateIngestedContract(env, null);
  assert(r2.ok === false, "null contractId → fails");

  const r3 = await activateIngestedContract(null, "ctr_001");
  assert(r3.ok === false, "null env → fails");
  assert(r3.error === "MISSING_KV_BINDING", "error is MISSING_KV_BINDING");
}

// ---------------------------------------------------------------------------
// 4. Resolve relevant blocks by phase → subset
// ---------------------------------------------------------------------------
console.log("\n4. Resolve relevant blocks by phase → subset");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_002", MULTI_SECTION_CONTRACT);
  await activateIngestedContract(env, "ctr_002");

  const result = await resolveRelevantContractBlocks(env, "ctr_002", { phase: "payment" });
  assert(result.ok, "resolution succeeds");
  assert(result.blocks.length > 0, "returns non-empty blocks");
  assert(result.blocks.length < result.total_blocks, "returns subset, not all blocks");
  assert(result.strategy === "phase", "strategy is 'phase'");
  assert(result.fallback === false, "fallback is false");

  // Check that a block with payment content is included
  const hasPaymentContent = result.blocks.some(
    (b) => /pagamento|payment|parcela/i.test(b.content)
  );
  assert(hasPaymentContent, "block with payment content is in results");
}

// ---------------------------------------------------------------------------
// 5. Resolve relevant blocks by intent → subset
// ---------------------------------------------------------------------------
console.log("\n5. Resolve relevant blocks by intent → subset");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_003", MULTI_SECTION_CONTRACT);
  await activateIngestedContract(env, "ctr_003");

  const result = await resolveRelevantContractBlocks(env, "ctr_003", { intent: "multa penalidade atraso" });
  assert(result.ok, "resolution succeeds");
  assert(result.blocks.length > 0, "returns non-empty blocks");
  assert(result.strategy === "intent", "strategy is 'intent'");
  assert(result.fallback === false, "fallback is false");
}

// ---------------------------------------------------------------------------
// 6. Resolve relevant blocks by block_types → subset
// ---------------------------------------------------------------------------
console.log("\n6. Resolve relevant blocks by block_types → subset");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_004", MULTI_SECTION_CONTRACT);

  const result = await resolveRelevantContractBlocks(env, "ctr_004", { block_types: ["penalty", "termination"] });
  assert(result.ok, "resolution succeeds");
  assert(result.blocks.length > 0, "returns non-empty blocks");
  assert(result.strategy === "block_types", "strategy is 'block_types'");

  // At least one block should contain penalty or termination content
  const hasRequestedContent = result.blocks.some(
    (b) => /multa|penalidade|penalty|rescisão|terminação|termination/i.test(b.content)
  );
  assert(hasRequestedContent, "at least one block with penalty/termination content is present");
}

// ---------------------------------------------------------------------------
// 7. Resolve with no signal → fallback (honest)
// ---------------------------------------------------------------------------
console.log("\n7. Resolve with no signal → fallback (honest)");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_005", MULTI_SECTION_CONTRACT);

  const result = await resolveRelevantContractBlocks(env, "ctr_005", {});
  assert(result.ok, "resolution succeeds");
  assert(result.blocks.length > 0, "returns blocks even without signal");
  assert(result.strategy === "fallback", "strategy is 'fallback'");
  assert(result.fallback === true, "fallback flag is true");
}

// ---------------------------------------------------------------------------
// 8. Canonical summary from real ingestion data
// ---------------------------------------------------------------------------
console.log("\n8. Canonical summary from real ingestion data");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_006", MULTI_SECTION_CONTRACT, { goal: "Software development" });
  const ingestion = await readContractIngestion(env, "ctr_006");

  const summary = buildCanonicalSummary(ingestion.structure, ingestion.blocks);
  assert(summary.macro_objective !== null, "macro_objective is present");
  assert(summary.sections_count > 0, "sections_count > 0");
  assert(summary.blocks_count > 0, "blocks_count > 0");
  assert(summary.hard_rules_count >= 0, "hard_rules_count is a number");
  assert(Array.isArray(summary.hard_rules_top), "hard_rules_top is an array");
  assert(summary.hard_rules_top.length <= 5, "hard_rules_top max 5 items");
  assert(summary.acceptance_criteria_count >= 0, "acceptance_criteria_count is a number");
  assert(summary.deadlines_count >= 0, "deadlines_count is a number");
}

// ---------------------------------------------------------------------------
// 9. Canonical summary with empty/missing data
// ---------------------------------------------------------------------------
console.log("\n9. Canonical summary with empty/missing data");
{
  const summary = buildCanonicalSummary(null, []);
  assert(summary.macro_objective === null, "null structure → macro_objective null");
  assert(summary.blocks_count === 0, "empty blocks → blocks_count 0");
  assert(summary.confidence === null, "no confidence data");

  const summary2 = buildCanonicalSummary({}, []);
  assert(summary2.macro_objective === null, "empty structure → macro_objective null");
  assert(summary2.hard_rules_count === 0, "no hard_rules → count 0");
  assert(Array.isArray(summary2.hard_rules_top), "hard_rules_top is array even if empty");
}

// ---------------------------------------------------------------------------
// 10. readActiveContractState reads persisted state
// ---------------------------------------------------------------------------
console.log("\n10. readActiveContractState reads persisted state (scoped)");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_007", MULTI_SECTION_CONTRACT);
  await activateIngestedContract(env, "ctr_007");

  // Read by explicit ID
  const state = await readActiveContractState(env, "ctr_007");
  assert(state !== null, "state is returned");
  assert(state.contract_id === "ctr_007", "contract_id matches");
  assert(state.summary_canonic !== null, "summary is present");

  // Read current (no ID) — uses default scope
  const current = await readActiveContractState(env);
  assert(current !== null, "current active contract is returned via default scope");
  assert(current.contract_id === "ctr_007", "current contract_id matches");

  // Verify scoped key exists in KV
  const scopedKey = `${KV_ACTIVE_CURRENT_PREFIX}${KV_DEFAULT_SCOPE}`;
  assert(kv._store[scopedKey] !== undefined, "scoped current key exists in KV");
  assert(kv._store["contract_active_state:current"] === undefined, "old global 'current' key does NOT exist");

  // Read non-existent
  const nothing = await readActiveContractState(env, "ctr_nonexistent");
  assert(nothing === null, "non-existent returns null");
}

// ---------------------------------------------------------------------------
// 11. getActiveContractContext returns runtime-friendly context
// ---------------------------------------------------------------------------
console.log("\n11. getActiveContractContext returns runtime-friendly context");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_008", MULTI_SECTION_CONTRACT);
  await activateIngestedContract(env, "ctr_008");

  // Resolve some blocks first to populate resolution_ctx
  await resolveRelevantContractBlocks(env, "ctr_008", { phase: "payment" });

  const ctx = await getActiveContractContext(env);
  assert(ctx.ok, "context ok");
  assert(ctx.contract_id === "ctr_008", "contract_id present");
  assert(ctx.active_state !== null, "active_state present");
  assert(ctx.summary !== null, "summary present");
  assert(ctx.resolution_ctx !== null, "resolution_ctx present after resolve");
  assert(ctx.resolution_ctx.strategy === "phase", "resolution_ctx.strategy is phase");
  assert(ctx.ready_for_pr3 === true, "ready_for_pr3 is true");

  // No active contract
  const kv2 = createMockKV();
  const env2 = { ENAVIA_BRAIN: kv2 };
  const ctx2 = await getActiveContractContext(env2);
  assert(ctx2.ok, "empty context still ok");
  assert(ctx2.contract_id === null, "no contract_id");
  assert(ctx2.resolution_ctx === null, "no resolution_ctx");
  assert(ctx2.ready_for_pr3 === false, "not ready for PR3");
}

// ---------------------------------------------------------------------------
// 12. refreshCanonicalSummary re-generates summary
// ---------------------------------------------------------------------------
console.log("\n12. refreshCanonicalSummary re-generates summary");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_009", MULTI_SECTION_CONTRACT, { goal: "Refresh test" });
  await activateIngestedContract(env, "ctr_009");

  const result = await refreshCanonicalSummary(env, "ctr_009");
  assert(result.ok, "refresh succeeds");
  assert(result.summary !== null, "summary returned");
  assert(result.summary.macro_objective !== null, "macro_objective present");

  // Read state and check summary was updated
  const state = await readActiveContractState(env, "ctr_009");
  assert(state.summary_refreshed_at !== undefined, "summary_refreshed_at is set");

  // Refresh non-existent
  const r2 = await refreshCanonicalSummary(env, "ctr_nonexistent");
  assert(r2.ok === false, "refresh non-existent fails safely");
}

// ---------------------------------------------------------------------------
// 13. PR1 read still works (no regression)
// ---------------------------------------------------------------------------
console.log("\n13. PR1 read still works (no regression)");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_010", MULTI_SECTION_CONTRACT);

  const ingestion = await readContractIngestion(env, "ctr_010");
  assert(ingestion !== null, "readContractIngestion still works");
  assert(ingestion.index.contract_id === "ctr_010", "contract_id preserved");
  assert(ingestion.blocks.length > 0, "blocks are present");
  assert(ingestion.structure.macro_objective !== null, "structure is intact");
}

// ---------------------------------------------------------------------------
// 14. Resolve blocks for non-ingested contract → safe failure
// ---------------------------------------------------------------------------
console.log("\n14. Resolve blocks for non-ingested contract → safe failure");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };

  const result = await resolveRelevantContractBlocks(env, "ctr_nonexistent", { phase: "payment" });
  assert(result.ok === false, "returns ok=false");
  assert(result.error === "CONTRACT_NOT_INGESTED", "error is CONTRACT_NOT_INGESTED");
  assert(result.blocks.length === 0, "no blocks returned");
}

// ---------------------------------------------------------------------------
// 15. Active state updates relevant_block_ids after resolution
// ---------------------------------------------------------------------------
console.log("\n15. Resolution context persisted as separate subartefact");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_011", MULTI_SECTION_CONTRACT);
  await activateIngestedContract(env, "ctr_011");

  // Resolve by phase
  await resolveRelevantContractBlocks(env, "ctr_011", { phase: "payment", taskId: "task_42" });

  // Verify resolution context subartefact exists separately — key is scoped
  const resCtxKey = `${KV_PREFIX_ACTIVE_STATE}${KV_DEFAULT_SCOPE}:ctr_011${KV_SUFFIX_RESOLUTION_CTX}`;
  assert(kv._store[resCtxKey] !== undefined, "resolution_ctx subartefact key exists in KV");

  const resCtx = JSON.parse(kv._store[resCtxKey]);
  assert(resCtx.contract_id === "ctr_011", "resolution_ctx.contract_id matches");
  assert(Array.isArray(resCtx.relevant_block_ids), "resolution_ctx.relevant_block_ids is array");
  assert(resCtx.relevant_block_ids.length > 0, "resolution_ctx has block IDs after resolution");
  assert(resCtx.current_phase_hint === "payment", "resolution_ctx.current_phase_hint is payment");
  assert(resCtx.last_task_id === "task_42", "resolution_ctx.last_task_id is task_42");
  assert(resCtx.strategy === "phase", "resolution_ctx.strategy is phase");
  assert(typeof resCtx.resolved_at === "string", "resolution_ctx.resolved_at is set");

  // Verify core state was NOT overwritten by resolution — key is scoped
  const coreStateKey = `${KV_PREFIX_ACTIVE_STATE}${KV_DEFAULT_SCOPE}:ctr_011`;
  const coreState = JSON.parse(kv._store[coreStateKey]);
  assert(!("relevant_block_ids" in coreState), "core state does NOT contain relevant_block_ids");
  assert(!("last_resolution_at" in coreState), "core state does NOT contain last_resolution_at");

  // Read via readActiveContractState — should merge resolution_ctx
  const state = await readActiveContractState(env, "ctr_011");
  assert(Array.isArray(state.relevant_block_ids), "merged state has relevant_block_ids");
  assert(state.relevant_block_ids.length > 0, "merged state relevant_block_ids populated");
  assert(state.current_phase_hint === "payment", "merged phase_hint updated");
  assert(state.last_task_id === "task_42", "merged last_task_id updated");
}

// ---------------------------------------------------------------------------
// 16. Scoped activation isolates parallel contexts (different contracts)
// ---------------------------------------------------------------------------
console.log("\n16. Scoped activation isolates parallel contexts");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_A", MULTI_SECTION_CONTRACT);
  await ingestLongContract(env, "ctr_B", MULTI_SECTION_CONTRACT);

  // Activate ctr_A in scope "exec_1"
  await activateIngestedContract(env, "ctr_A", { scope: "exec_1" });
  // Activate ctr_B in scope "exec_2"
  await activateIngestedContract(env, "ctr_B", { scope: "exec_2" });

  // Read from scope "exec_1" → should get ctr_A
  const stateA = await readActiveContractState(env, null, { scope: "exec_1" });
  assert(stateA !== null, "scope exec_1 has active state");
  assert(stateA.contract_id === "ctr_A", "scope exec_1 → ctr_A");

  // Read from scope "exec_2" → should get ctr_B
  const stateB = await readActiveContractState(env, null, { scope: "exec_2" });
  assert(stateB !== null, "scope exec_2 has active state");
  assert(stateB.contract_id === "ctr_B", "scope exec_2 → ctr_B");

  // Default scope should be empty (neither was activated with default scope)
  const stateDefault = await readActiveContractState(env);
  assert(stateDefault === null, "default scope has no active contract");

  // getActiveContractContext with scope
  const ctxA = await getActiveContractContext(env, { scope: "exec_1" });
  assert(ctxA.ok, "context exec_1 ok");
  assert(ctxA.contract_id === "ctr_A", "context exec_1 → ctr_A");
  assert(ctxA.ready_for_pr3 === true, "exec_1 ready for PR3");

  const ctxB = await getActiveContractContext(env, { scope: "exec_2" });
  assert(ctxB.ok, "context exec_2 ok");
  assert(ctxB.contract_id === "ctr_B", "context exec_2 → ctr_B");
}

// ---------------------------------------------------------------------------
// 17. Same contract in two scopes does NOT share core state or resolution_ctx
// ---------------------------------------------------------------------------
console.log("\n17. Same contract in two scopes is fully isolated");
{
  const kv = createMockKV();
  const env = { ENAVIA_BRAIN: kv };
  await ingestLongContract(env, "ctr_X", MULTI_SECTION_CONTRACT);

  // Activate the SAME contract in two different scopes with different options
  await activateIngestedContract(env, "ctr_X", { scope: "scopeA", operator: "alice", phase_hint: "payment" });
  await activateIngestedContract(env, "ctr_X", { scope: "scopeB", operator: "bob",   phase_hint: "termination" });

  // Read state from each scope — must be independent
  const stA = await readActiveContractState(env, null, { scope: "scopeA" });
  const stB = await readActiveContractState(env, null, { scope: "scopeB" });
  assert(stA !== null, "scopeA has active state for ctr_X");
  assert(stB !== null, "scopeB has active state for ctr_X");
  assert(stA.contract_id === "ctr_X", "scopeA state is for ctr_X");
  assert(stB.contract_id === "ctr_X", "scopeB state is for ctr_X");
  assert(stA.metadata.operator === "alice", "scopeA operator is alice");
  assert(stB.metadata.operator === "bob",   "scopeB operator is bob");
  assert(stA.current_phase_hint === "payment",     "scopeA phase_hint is payment");
  assert(stB.current_phase_hint === "termination", "scopeB phase_hint is termination");

  // Verify scoped KV keys are independent (not the same key)
  const keyA = `${KV_PREFIX_ACTIVE_STATE}scopeA:ctr_X`;
  const keyB = `${KV_PREFIX_ACTIVE_STATE}scopeB:ctr_X`;
  assert(kv._store[keyA] !== undefined, "scopeA has its own KV key");
  assert(kv._store[keyB] !== undefined, "scopeB has its own KV key");
  assert(kv._store[keyA] !== kv._store[keyB], "scopeA and scopeB KV values are distinct");

  // Resolve blocks in scopeA — must not affect scopeB
  await resolveRelevantContractBlocks(env, "ctr_X", { phase: "payment", scope: "scopeA" });
  await resolveRelevantContractBlocks(env, "ctr_X", { phase: "termination", scope: "scopeB" });

  const ctxA = await getActiveContractContext(env, { scope: "scopeA" });
  const ctxB = await getActiveContractContext(env, { scope: "scopeB" });
  assert(ctxA.resolution_ctx !== null, "scopeA has resolution_ctx");
  assert(ctxB.resolution_ctx !== null, "scopeB has resolution_ctx");
  assert(ctxA.resolution_ctx.current_phase_hint === "payment",     "scopeA resolution_ctx.phase is payment");
  assert(ctxB.resolution_ctx.current_phase_hint === "termination", "scopeB resolution_ctx.phase is termination");

  // Resolution context keys are also independent
  const resKeyA = `${KV_PREFIX_ACTIVE_STATE}scopeA:ctr_X${KV_SUFFIX_RESOLUTION_CTX}`;
  const resKeyB = `${KV_PREFIX_ACTIVE_STATE}scopeB:ctr_X${KV_SUFFIX_RESOLUTION_CTX}`;
  assert(kv._store[resKeyA] !== undefined, "scopeA has its own resolution_ctx key");
  assert(kv._store[resKeyB] !== undefined, "scopeB has its own resolution_ctx key");
  assert(kv._store[resKeyA] !== kv._store[resKeyB], "scopeA and scopeB resolution_ctx values are distinct");
}

// ===========================================================================
// Report
// ===========================================================================
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
process.exit(failed > 0 ? 1 : 0);
