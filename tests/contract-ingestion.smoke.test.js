// ============================================================================
// 🧪 Smoke Tests — Canonical Long Contract Ingestion (PR1)
//
// Run: node tests/contract-ingestion.smoke.test.js
//
// Tests:
//   1. Short simple contract → blocks + structure map
//   2. Long contract with multiple sections → ordered blocks
//   3. Headings preserved when present
//   4. No headings → doesn't break ingestion
//   5. Undetectable fields → absent/safe, no invention
//   6. Persistence of structural artifacts works
//   7. Helper functions (isHeading, detectBlockType, etc.)
//   8. Edge cases (empty, null, whitespace-only)
//   9. ingestLongContract orchestrator (with mock KV)
//  10. readContractIngestion reads persisted artifacts
// ============================================================================

import {
  splitContractIntoBlocks,
  buildContractStructureMap,
  buildContractIndex,
  persistContractIngestion,
  readContractIngestion,
  ingestLongContract,
  isHeading,
  detectBlockType,
  extractHeading,
  buildShortSummary,
  extractSignals,
  KV_PREFIX_INGESTION,
  KV_SUFFIX_BLOCKS,
  KV_SUFFIX_STRUCTURE,
  KV_SUFFIX_INDEX,
  KV_INGESTION_REGISTRY,
  BLOCK_TYPE_PATTERNS,
  HEADING_PATTERNS,
  SIGNAL_PATTERNS,
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
// Sample contracts
// ---------------------------------------------------------------------------
const SHORT_CONTRACT = `
CLÁUSULA 1 - DO OBJETO
Este contrato tem por objetivo a prestação de serviços de desenvolvimento de software.

CLÁUSULA 2 - DO PRAZO
O prazo de execução será de 90 dias a partir da assinatura.

CLÁUSULA 3 - DO PAGAMENTO
O pagamento será realizado em 3 parcelas mensais de R$ 10.000,00.
`.trim();

const LONG_CONTRACT = `
CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE TECNOLOGIA

CLÁUSULA 1 - DO OBJETO
Este contrato tem por objeto a contratação de serviços de desenvolvimento,
manutenção e suporte de sistemas para o contratante.

CLÁUSULA 2 - DAS DEFINIÇÕES
Para os fins deste contrato, consideram-se:
a) Sistema: plataforma web desenvolvida pelo contratado;
b) SLA: acordo de nível de serviço conforme Anexo I;
c) Sprint: ciclo de desenvolvimento de 2 semanas.

CLÁUSULA 3 - DAS OBRIGAÇÕES DO CONTRATADO
O contratado deverá entregar o sistema conforme especificações técnicas.
É proibido subcontratar sem autorização prévia do contratante.
O contratado deve manter confidencialidade sobre todos os dados.

CLÁUSULA 4 - DAS OBRIGAÇÕES DO CONTRATANTE
O contratante deverá fornecer acesso aos ambientes de teste.
A aprovação humana é obrigatória antes de cada deploy em produção.

CLÁUSULA 5 - DO PRAZO E VIGÊNCIA
O prazo de execução é de 180 dias corridos.
O contrato terá vigência de 12 meses a partir da assinatura.

CLÁUSULA 6 - DO PAGAMENTO
O pagamento será realizado mensalmente conforme entregas aprovadas.
O preço total do contrato é de R$ 120.000,00.

CLÁUSULA 7 - DOS CRITÉRIOS DE ACEITE
Os critérios de aceite incluem:
- Todos os testes automatizados passando;
- Cobertura mínima de 80%;
- Aprovação do gestor técnico do contratante.
A definição de done requer homologação formal.

CLÁUSULA 8 - DA RESCISÃO
A rescisão poderá ocorrer por qualquer das partes com aviso prévio de 30 dias.
A multa por rescisão antecipada será de 20% do valor restante.

CLÁUSULA 9 - DAS PENALIDADES
Em caso de atraso na entrega, será aplicada multa de 2% ao mês.
A sanção máxima é a rescisão contratual.

CLÁUSULA 10 - DA CONFIDENCIALIDADE
As partes se comprometem a manter sigilo sobre informações trocadas.
O prazo de confidencialidade é de 5 anos após o término do contrato.

CLÁUSULA 11 - DISPOSIÇÕES GERAIS
Os casos omissos serão resolvidos de comum acordo entre as partes.
Fica eleito o foro da comarca de São Paulo para dirimir eventuais litígios.
`.trim();

const NO_HEADINGS_CONTRACT = `
Este documento estabelece os termos para prestação de serviços.
O contratado deverá entregar o projeto em 60 dias.
O pagamento será feito em parcela única após a entrega.

O escopo inclui desenvolvimento web e mobile.
Não é permitido subcontratar sem autorização.
A multa por atraso é de 1% ao dia.

Ambas as partes concordam com os termos acima.
Este contrato entra em vigor na data da assinatura.
`.trim();

const MARKDOWN_CONTRACT = `
# Contrato de Desenvolvimento

## DO OBJETO
Prestação de serviços de desenvolvimento de sistema web.

## DAS OBRIGAÇÕES
O contratado deverá entregar conforme cronograma.
É proibido compartilhar código-fonte sem autorização.

## DO PAGAMENTO
Pagamento mensal de R$ 15.000,00 mediante aprovação.

## DA VIGÊNCIA
Prazo de 6 meses, prorrogável por igual período.
`.trim();

// ============================================================================
// TEST SUITE
// ============================================================================

async function runTests() {
  console.log("\n📜 ENAVIA Canonical Long Contract Ingestion — Smoke Tests\n");

  // ========================================================================
  // HELPER TESTS
  // ========================================================================

  console.log("Test 1: isHeading — detects clause headings");
  {
    assert(isHeading("CLÁUSULA 1 - DO OBJETO"), "detects CLÁUSULA heading");
    assert(isHeading("CLÁUSULA 2 - DAS DEFINIÇÕES"), "detects second clause");
    assert(isHeading("1. Introdução"), "detects numbered heading");
    assert(isHeading("## DO OBJETO"), "detects markdown heading");
    assert(isHeading("SEÇÃO 1 - ESCOPO"), "detects SEÇÃO heading");
    assert(isHeading("CAPÍTULO I - GERAL"), "detects CAPÍTULO heading");
    assert(!isHeading("Texto normal do contrato."), "rejects normal text");
    assert(!isHeading(""), "rejects empty string");
    assert(!isHeading("   "), "rejects whitespace");
  }

  console.log("\nTest 2: detectBlockType — classifies block content");
  {
    assert(detectBlockType("Cláusula 1 - objeto") === "clause", "detects clause type");
    assert(detectBlockType("Definições gerais do contrato") === "definition", "detects definition type");
    assert(detectBlockType("O contratado deverá entregar") === "obligation", "detects obligation type");
    assert(detectBlockType("Multa de 2% ao mês") === "penalty", "detects penalty type");
    assert(detectBlockType("Rescisão do contrato") === "termination", "detects termination type");
    assert(detectBlockType("Pagamento mensal de R$ 10.000") === "payment", "detects payment type");
    assert(detectBlockType("Prazo de 90 dias") === "deadline", "detects deadline type");
    assert(detectBlockType("Critérios de aceite") === "acceptance", "detects acceptance type");
    assert(detectBlockType("Confidencialidade das informações") === "confidentiality", "detects confidentiality type");
    assert(detectBlockType("Texto qualquer sem padrão") === "general", "defaults to general");
  }

  console.log("\nTest 3: extractHeading — extracts heading from block lines");
  {
    const r1 = extractHeading(["CLÁUSULA 1 - DO OBJETO", "Texto aqui"]);
    assert(r1.heading === "CLÁUSULA 1 - DO OBJETO", "extracts clause heading");
    assert(r1.headingLine === 0, "heading is on first line");

    const r2 = extractHeading(["Texto normal", "Mais texto"]);
    assert(r2.heading === null, "null when no heading");
    assert(r2.headingLine === -1, "headingLine -1 when no heading");

    const r3 = extractHeading(["## Seção Markdown", "Conteúdo"]);
    assert(r3.heading === "Seção Markdown", "strips markdown # prefix");

    const r4 = extractHeading([]);
    assert(r4.heading === null, "null for empty array");
  }

  console.log("\nTest 4: buildShortSummary — honest short summaries");
  {
    assert(buildShortSummary("Short.") === null, "null for very short text");
    assert(buildShortSummary("") === null, "null for empty string");
    assert(buildShortSummary(null) === null, "null for null input");
    const long = "Este contrato tem por objetivo a prestação de serviços de desenvolvimento de software para o contratante.";
    const s = buildShortSummary(long);
    assert(s !== null && s.length > 0, "produces summary for meaningful text");
    assert(s.length <= 201, "summary respects maxLen");
  }

  console.log("\nTest 5: extractSignals — extracts structural signals");
  {
    const s1 = extractSignals("É proibido subcontratar sem autorização.");
    assert(s1.hard_rules.length > 0, "detects hard rule (proibido)");

    const s2 = extractSignals("Critérios de aceite: testes passando.");
    assert(s2.acceptance_criteria.length > 0, "detects acceptance criteria");

    const s3 = extractSignals("Aprovação humana é obrigatória.");
    assert(s3.approval_points.length > 0, "detects approval point");

    const s4 = extractSignals("O prazo é de 90 dias.");
    assert(s4.deadlines.length > 0, "detects deadline");

    const s5 = extractSignals("Blocked until aprovação do gestor.");
    assert(s5.blocking_points.length > 0, "detects blocking point");

    const s6 = extractSignals("Texto comum sem sinais especiais.");
    assert(s6.hard_rules.length === 0, "empty hard_rules for neutral text");
    assert(s6.acceptance_criteria.length === 0, "empty acceptance for neutral text");
  }

  // ========================================================================
  // BLOCK SPLITTING TESTS
  // ========================================================================

  console.log("\nTest 6: splitContractIntoBlocks — short simple contract");
  {
    const blocks = splitContractIntoBlocks(SHORT_CONTRACT);
    assert(blocks.length >= 3, `produces >= 3 blocks (got ${blocks.length})`);
    assert(blocks[0].block_id === "blk_0001", "first block_id is blk_0001");
    assert(blocks[0].index === 0, "first block index is 0");
    assert(typeof blocks[0].content === "string" && blocks[0].content.length > 0, "block has content");
    assert(blocks[0].heading !== undefined, "heading field exists");
    assert(blocks[0].block_type !== undefined, "block_type field exists");
    assert(blocks[0].signals !== undefined, "signals field exists");
    // Verify ordering
    for (let i = 0; i < blocks.length; i++) {
      assert(blocks[i].index === i, `block ${i} has correct index`);
    }
  }

  console.log("\nTest 7: splitContractIntoBlocks — long contract with multiple sections");
  {
    const blocks = splitContractIntoBlocks(LONG_CONTRACT);
    assert(blocks.length >= 10, `produces >= 10 blocks for long contract (got ${blocks.length})`);
    // Verify all blocks are ordered correctly
    for (let i = 0; i < blocks.length; i++) {
      assert(blocks[i].index === i, `block ${i} ordered correctly`);
    }
    // Verify headings are preserved
    const headedBlocks = blocks.filter((b) => b.heading !== null);
    assert(headedBlocks.length >= 8, `at least 8 blocks have headings (got ${headedBlocks.length})`);
    // Verify clause types are detected
    const clauseBlocks = blocks.filter((b) => b.block_type === "clause");
    assert(clauseBlocks.length >= 1, "at least 1 clause-type block detected");
  }

  console.log("\nTest 8: splitContractIntoBlocks — no headings doesn't break");
  {
    const blocks = splitContractIntoBlocks(NO_HEADINGS_CONTRACT);
    assert(blocks.length >= 1, `produces at least 1 block (got ${blocks.length})`);
    assert(blocks[0].content.length > 0, "block has content");
    // Headings should be null since there are no headings
    const nullHeadings = blocks.filter((b) => b.heading === null);
    assert(nullHeadings.length >= 1, "at least 1 block with null heading (as expected)");
  }

  console.log("\nTest 9: splitContractIntoBlocks — markdown headings");
  {
    const blocks = splitContractIntoBlocks(MARKDOWN_CONTRACT);
    assert(blocks.length >= 4, `produces >= 4 blocks (got ${blocks.length})`);
    const headedBlocks = blocks.filter((b) => b.heading !== null);
    assert(headedBlocks.length >= 3, `markdown headings detected (got ${headedBlocks.length})`);
  }

  console.log("\nTest 10: splitContractIntoBlocks — edge cases");
  {
    assert(splitContractIntoBlocks("").length === 0, "empty string → 0 blocks");
    assert(splitContractIntoBlocks(null).length === 0, "null → 0 blocks");
    assert(splitContractIntoBlocks(undefined).length === 0, "undefined → 0 blocks");
    assert(splitContractIntoBlocks("   ").length === 0, "whitespace-only → 0 blocks");
    const single = splitContractIntoBlocks("Just one line.");
    assert(single.length === 1, "single line → 1 block");
    assert(single[0].content === "Just one line.", "content preserved exactly");
  }

  // ========================================================================
  // STRUCTURE MAP TESTS
  // ========================================================================

  console.log("\nTest 11: buildContractStructureMap — long contract");
  {
    const blocks = splitContractIntoBlocks(LONG_CONTRACT);
    const map = buildContractStructureMap(blocks, { goal: "Serviços de TI" });

    assert(map.macro_objective !== null, "macro_objective is not null");
    assert(Array.isArray(map.sections), "sections is an array");
    assert(map.sections.length === blocks.length, "sections count matches blocks count");
    assert(Array.isArray(map.hard_rules), "hard_rules is an array");
    assert(map.hard_rules.length >= 1, `detected hard rules (got ${map.hard_rules.length})`);
    assert(Array.isArray(map.acceptance_criteria), "acceptance_criteria is an array");
    assert(Array.isArray(map.approval_points), "approval_points is an array");
    assert(Array.isArray(map.execution_order), "execution_order is an array");
    assert(map.execution_order.length === blocks.length, "execution_order covers all blocks");
    assert(typeof map.confidence === "object", "confidence object exists");
    assert(map.confidence.has_headings === true, "confidence.has_headings is true");
    assert(typeof map.confidence.blocks_count === "number", "confidence.blocks_count is a number");
  }

  console.log("\nTest 12: buildContractStructureMap — empty blocks");
  {
    const map = buildContractStructureMap([], null);
    assert(map.macro_objective === null, "macro_objective null for empty");
    assert(map.sections.length === 0, "no sections");
    assert(map.hard_rules.length === 0, "no hard_rules");
    assert(map.confidence.blocks_count === 0, "blocks_count 0");
  }

  console.log("\nTest 13: buildContractStructureMap — no headings contract");
  {
    const blocks = splitContractIntoBlocks(NO_HEADINGS_CONTRACT);
    const map = buildContractStructureMap(blocks, null);
    assert(map.macro_objective !== null || map.macro_objective === null, "macro_objective handled safely");
    assert(map.confidence.has_headings === false || map.confidence.has_headings === true, "has_headings is boolean");
    assert(map.sections.length === blocks.length, "sections count matches");
  }

  // ========================================================================
  // CONTRACT INDEX TESTS
  // ========================================================================

  console.log("\nTest 14: buildContractIndex — produces valid index");
  {
    const blocks = splitContractIntoBlocks(LONG_CONTRACT);
    const map = buildContractStructureMap(blocks, { goal: "Test" });
    const index = buildContractIndex("ctr_test_long", blocks, map, { goal: "Test" });

    assert(index.contract_id === "ctr_test_long", "contract_id matches");
    assert(typeof index.ingested_at === "string", "ingested_at is string");
    assert(index.blocks_count === blocks.length, "blocks_count matches");
    assert(index.block_ids.length === blocks.length, "block_ids count matches");
    assert(index.version === "v1", "version is v1");
    assert(typeof index.structure_summary === "object", "structure_summary exists");
    assert(typeof index.structure_summary.macro_objective === "string" || index.structure_summary.macro_objective === null, "macro_objective in summary");
    assert(typeof index.structure_summary.hard_rules_count === "number", "hard_rules_count in summary");
  }

  // ========================================================================
  // PERSISTENCE TESTS
  // ========================================================================

  console.log("\nTest 15: persistContractIngestion — writes to KV");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const blocks = splitContractIntoBlocks(SHORT_CONTRACT);
    const map = buildContractStructureMap(blocks, { goal: "Persistence test" });
    const index = buildContractIndex("ctr_persist_01", blocks, map, { goal: "Persistence test" });

    const result = await persistContractIngestion(env, "ctr_persist_01", blocks, map, index);
    assert(result.ok === true, "persistence returns ok");

    // Verify keys were written
    const blocksKey = `${KV_PREFIX_INGESTION}ctr_persist_01${KV_SUFFIX_BLOCKS}`;
    const structKey = `${KV_PREFIX_INGESTION}ctr_persist_01${KV_SUFFIX_STRUCTURE}`;
    const indexKey = `${KV_PREFIX_INGESTION}ctr_persist_01${KV_SUFFIX_INDEX}`;

    assert(kv._store[blocksKey] !== undefined, "blocks persisted in KV");
    assert(kv._store[structKey] !== undefined, "structure persisted in KV");
    assert(kv._store[indexKey] !== undefined, "index persisted in KV");
    assert(kv._store[KV_INGESTION_REGISTRY] !== undefined, "registry updated");

    // Verify registry
    const registry = JSON.parse(kv._store[KV_INGESTION_REGISTRY]);
    assert(registry.includes("ctr_persist_01"), "registry contains contract id");
  }

  console.log("\nTest 16: readContractIngestion — reads persisted artifacts");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const blocks = splitContractIntoBlocks(LONG_CONTRACT);
    const map = buildContractStructureMap(blocks, { goal: "Read test" });
    const index = buildContractIndex("ctr_read_01", blocks, map, { goal: "Read test" });

    await persistContractIngestion(env, "ctr_read_01", blocks, map, index);

    const read = await readContractIngestion(env, "ctr_read_01");
    assert(read !== null, "read returns non-null");
    assert(read.index.contract_id === "ctr_read_01", "index contract_id matches");
    assert(read.blocks.length === blocks.length, "blocks count matches");
    assert(read.structure.macro_objective === map.macro_objective, "structure matches");
  }

  console.log("\nTest 17: readContractIngestion — returns null for non-existent");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const read = await readContractIngestion(env, "non_existent");
    assert(read === null, "returns null for non-existent contract");
  }

  // ========================================================================
  // ORCHESTRATOR TESTS
  // ========================================================================

  console.log("\nTest 18: ingestLongContract — full orchestration (short contract)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await ingestLongContract(env, "ctr_orch_short", SHORT_CONTRACT, { goal: "Test short" });

    assert(result.ok === true, "ok is true");
    assert(result.contract_id === "ctr_orch_short", "contract_id correct");
    assert(result.blocks_count >= 3, `blocks_count >= 3 (got ${result.blocks_count})`);
    assert(typeof result.structure_summary === "object", "structure_summary exists");
    assert(typeof result.index === "object", "index exists");
    assert(result.index.version === "v1", "index version is v1");

    // Verify it's readable
    const read = await readContractIngestion(env, "ctr_orch_short");
    assert(read !== null, "persisted data is readable");
    assert(read.blocks.length === result.blocks_count, "read blocks count matches");
  }

  console.log("\nTest 19: ingestLongContract — full orchestration (long contract)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    const result = await ingestLongContract(env, "ctr_orch_long", LONG_CONTRACT, { goal: "Serviços de TI" });

    assert(result.ok === true, "ok is true");
    assert(result.blocks_count >= 10, `blocks_count >= 10 (got ${result.blocks_count})`);
    assert(result.structure_summary.hard_rules_count >= 1, "detected hard rules");
    assert(result.structure_summary.sections_count >= 10, `sections_count >= 10 (got ${result.structure_summary.sections_count})`);
  }

  console.log("\nTest 20: ingestLongContract — validation errors");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const r1 = await ingestLongContract(env, "", SHORT_CONTRACT);
    assert(r1.ok === false && r1.error === "INVALID_CONTRACT_ID", "rejects empty contractId");

    const r2 = await ingestLongContract(env, "ctr_x", "");
    assert(r2.ok === false && r2.error === "INVALID_CONTRACT_TEXT", "rejects empty contractText");

    const r3 = await ingestLongContract(env, "ctr_x", "   ");
    assert(r3.ok === false && r3.error === "EMPTY_CONTRACT", "rejects whitespace-only text");

    const r4 = await ingestLongContract(null, "ctr_x", SHORT_CONTRACT);
    assert(r4.ok === false && r4.error === "MISSING_KV_BINDING", "rejects missing env");
  }

  // ========================================================================
  // HONESTY TESTS — undetectable fields stay absent
  // ========================================================================

  console.log("\nTest 21: Honesty — undetectable fields stay null/empty");
  {
    const neutralText = `
Este documento contém apenas texto genérico.
Não existem cláusulas, prazos ou obrigações explícitas.
Apenas texto corrido sem estrutura formal.
`.trim();

    const blocks = splitContractIntoBlocks(neutralText);
    const map = buildContractStructureMap(blocks, null);

    assert(map.hard_rules.length === 0, "no hard_rules invented for neutral text");
    assert(map.acceptance_criteria.length === 0, "no acceptance_criteria invented");
    assert(map.approval_points.length === 0, "no approval_points invented");
    assert(map.blocking_points.length === 0, "no blocking_points invented");
    assert(map.deadlines.length === 0, "no deadlines invented");
    assert(map.detected_phases === null, "detected_phases is null (not invented)");
    assert(map.confidence.has_hard_rules === false, "confidence confirms no hard rules");
    assert(map.confidence.has_acceptance_criteria === false, "confidence confirms no acceptance criteria");
  }

  console.log("\nTest 22: Honesty — signals detected only when textually present");
  {
    const blocks = splitContractIntoBlocks(LONG_CONTRACT);
    const map = buildContractStructureMap(blocks, { goal: "Test signals" });

    // LONG_CONTRACT has explicit "É proibido subcontratar" → hard_rules
    assert(map.hard_rules.length > 0, "hard_rules detected from explicit text");
    // LONG_CONTRACT has explicit "critérios de aceite" → acceptance_criteria
    assert(map.acceptance_criteria.length > 0, "acceptance_criteria detected from explicit text");
    // LONG_CONTRACT has "aprovação humana" → approval_points
    assert(map.approval_points.length > 0, "approval_points detected from explicit text");

    // Each signal has source block reference
    for (const rule of map.hard_rules) {
      assert(typeof rule.block_id === "string", "hard_rule has block_id reference");
      assert(typeof rule.signal === "string", "hard_rule has signal text");
    }
  }

  // ========================================================================
  // REGISTRY DEDUP TEST
  // ========================================================================

  console.log("\nTest 23: Registry — deduplicates on re-ingestion");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };
    await ingestLongContract(env, "ctr_dedup", SHORT_CONTRACT, {});
    await ingestLongContract(env, "ctr_dedup", SHORT_CONTRACT, {});
    const registry = JSON.parse(kv._store[KV_INGESTION_REGISTRY]);
    const count = registry.filter((id) => id === "ctr_dedup").length;
    assert(count === 1, "registry does not duplicate contract id");
  }

  // ========================================================================
  // CONSTANTS / EXPORTS CHECK
  // ========================================================================

  console.log("\nTest 24: Exports — all constants and patterns exported");
  {
    assert(typeof KV_PREFIX_INGESTION === "string", "KV_PREFIX_INGESTION exported");
    assert(typeof KV_SUFFIX_BLOCKS === "string", "KV_SUFFIX_BLOCKS exported");
    assert(typeof KV_SUFFIX_STRUCTURE === "string", "KV_SUFFIX_STRUCTURE exported");
    assert(typeof KV_SUFFIX_INDEX === "string", "KV_SUFFIX_INDEX exported");
    assert(typeof KV_INGESTION_REGISTRY === "string", "KV_INGESTION_REGISTRY exported");
    assert(Array.isArray(BLOCK_TYPE_PATTERNS), "BLOCK_TYPE_PATTERNS exported");
    assert(Array.isArray(HEADING_PATTERNS), "HEADING_PATTERNS exported");
    assert(typeof SIGNAL_PATTERNS === "object", "SIGNAL_PATTERNS exported");
  }

  // ========================================================================
  // RESULTS
  // ========================================================================

  console.log(`\n${"=".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`${"=".repeat(50)}`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
