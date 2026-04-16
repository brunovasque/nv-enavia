// ============================================================================
// 🧪 Smoke Tests — Contract Cognitive Advisor (PR5)
//
// Camada cognitiva consultiva sobre contrato ativo.
// Testa interpretação, detecção de ambiguidade/conflito, e segurança da saída.
//
// Run: node tests/contract-cognitive-advisor.smoke.test.js
//
// Tests:
//   1.  Enums íntegros (AMBIGUITY_LEVEL, CONFIDENCE_THRESHOLDS)
//   2.  Caso aderente e claro → interpretação coerente com boa confiança
//   3.  Caso ambíguo (pouca evidência) → ambiguity_level alto
//   4.  Caso com conflito contratual explícito → reconhece conflito
//   5.  Caso sem contrato ativo → ok=false, requires_human_confirmation
//   6.  Caso com gate BLOCK → respeita bloqueio, não sobrepõe
//   7.  Caso com gate ALLOW → interpretação positiva
//   8.  Caso com pouca evidência → saída honesta
//   9.  Shape canônico completo da saída (inclui possible_readings)
//   10. Determinismo: mesma entrada → mesma saída
//   11. Scope A e scope B isolados (pure function)
//   12. runContractCognitiveAdvisor com contrato real (integração PR2)
//   13. Camada NÃO autoriza sozinha ação bloqueada pelo gate
//   14. Camada reconhece múltiplas leituras possíveis
//   15. Caso approval_point → requires_human_confirmation coerente
//   16. PR1/PR2/PR3 sem regressão
//   17. Sem candidateAction → ambiguity HIGH (nunca LOW)
//   18. Contrato com blocos mas sem sinais → medium ambiguity
//   --- NEW: 8 testes adicionais obrigatórios ---
//   19. summary_canonic altera interpretação/nota/confiança quando blocos insuficientes
//   20. resolution_ctx altera interpretação/nota/confiança/ambiguidade
//   21. candidateAction ausente/fraca NÃO cai em LOW por padrão
//   22. blocos vazios + summary fraco → ambiguidade alta e confiança baixa
//   23. evidência parcial com duas leituras → saída expõe leitura principal + alternativa
//   24. gate BLOCK continua soberano e camada respeita
//   25. gate ALLOW não mascara ambiguidade real com base fraca
//   26. PR1/PR2/PR3 regression check (extended)
// ============================================================================

import {
  analyzeContractContextCognitively,
  runContractCognitiveAdvisor,
  AMBIGUITY_LEVEL,
  CONFIDENCE_THRESHOLDS,
} from "../schema/contract-cognitive-advisor.js";

// --- PR2 imports for integration ---
import {
  activateIngestedContract,
  getActiveContractContext,
  resolveRelevantContractBlocks,
  KV_DEFAULT_SCOPE,
} from "../schema/contract-active-state.js";

// --- PR3 imports for regression check ---
import {
  evaluateContractAdherence,
  runContractAdherenceGate,
  DECISION,
  REASON_CODE,
} from "../schema/contract-adherence-engine.js";

// --- PR1 imports for regression check ---
import {
  ingestLongContract,
} from "../schema/contract-ingestion.js";

// =========================================================================
// Test Helpers
// =========================================================================
let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${label}`);
  } else {
    failed++;
    console.error(`  ❌ FAIL: ${label}`);
  }
}

function section(label) {
  console.log(`\n── ${label} ──`);
}

// =========================================================================
// Mock KV for integration tests
// =========================================================================
function createMockKV(initialData = {}) {
  const store = { ...initialData };
  return {
    get: async (key) => store[key] || null,
    put: async (key, value) => { store[key] = value; },
    delete: async (key) => { delete store[key]; },
    _store: store,
  };
}

// =========================================================================
// Test Contract Fixtures
// =========================================================================
function buildTestContract() {
  return `CLÁUSULA 1 - DO OBJETO
Este contrato tem por objeto a prestação de serviços de desenvolvimento de software para plataforma digital.

CLÁUSULA 2 - DAS OBRIGAÇÕES
O contratado deverá entregar todas as funcionalidades conforme especificação técnica.
É proibido subcontratar terceiros sem aprovação prévia.
É proibido deploy em produção sem aprovação do contratante.

CLÁUSULA 3 - DOS PRAZOS
O prazo para entrega final é de 90 dias corridos a partir da assinatura.
Entregas parciais devem ocorrer a cada 30 dias.

CLÁUSULA 4 - DA APROVAÇÃO
Toda entrega deve ser aprovada pelo contratante antes de ser considerada concluída.
Deploy em ambiente de produção requer aprovação formal por escrito.

CLÁUSULA 5 - DAS PENALIDADES
Atraso na entrega acarretará multa de 2% ao mês sobre o valor do contrato.
Descumprimento das cláusulas pode resultar em rescisão contratual.`;
}

function buildContractContextFixture(contractId, opts) {
  const o = opts || {};
  return {
    ok: true,
    contract_id: contractId || "test-contract-001",
    active_state: { contract_id: contractId || "test-contract-001" },
    summary: o.summary || {
      macro_objective: "Prestação de serviços de desenvolvimento de software",
      detected_phases: ["planejamento", "desenvolvimento", "entrega", "aprovação"],
      hard_rules_count: 2,
      hard_rules_top: [
        "É proibido subcontratar terceiros sem aprovação prévia",
        "É proibido deploy em produção sem aprovação do contratante",
      ],
      acceptance_criteria_count: 1,
      acceptance_criteria_top: ["aprovação formal por escrito"],
      approval_points_count: 2,
      approval_points_top: [
        "Toda entrega deve ser aprovada pelo contratante",
        "Deploy em ambiente de produção requer aprovação formal",
      ],
      blocking_points_count: 1,
      blocking_points_top: [
        "Deploy em produção sem aprovação do contratante",
      ],
      deadlines_count: 2,
      deadlines_top: [
        "prazo para entrega final é de 90 dias corridos",
        "Entregas parciais devem ocorrer a cada 30 dias",
      ],
      blocks_count: 5,
    },
    resolution_ctx: o.resolution_ctx || {
      contract_id: contractId || "test-contract-001",
      strategy: "phase_match",
      fallback: false,
      matched_count: 3,
      total_blocks: 5,
      relevant_block_ids: ["block-001", "block-002", "block-003"],
      current_phase_hint: "development",
    },
    ready_for_pr3: true,
  };
}

function buildRelevantBlocksFixture() {
  return [
    {
      block_id: "block-001",
      heading: "CLÁUSULA 2 - DAS OBRIGAÇÕES",
      block_type: "obligation",
      content: "O contratado deverá entregar todas as funcionalidades conforme especificação técnica. É proibido subcontratar terceiros sem aprovação prévia. É proibido deploy em produção sem aprovação do contratante.",
      signals: {
        hard_rules: [
          "É proibido subcontratar terceiros sem aprovação prévia",
          "É proibido deploy em produção sem aprovação do contratante",
        ],
        approval_points: [],
        blocking_points: ["deploy em produção sem aprovação do contratante"],
        acceptance_criteria: [],
        deadlines: [],
      },
    },
    {
      block_id: "block-002",
      heading: "CLÁUSULA 4 - DA APROVAÇÃO",
      block_type: "acceptance",
      content: "Toda entrega deve ser aprovada pelo contratante antes de ser considerada concluída. Deploy em ambiente de produção requer aprovação formal por escrito.",
      signals: {
        hard_rules: [],
        approval_points: [
          "Toda entrega deve ser aprovada pelo contratante",
          "Deploy em ambiente de produção requer aprovação formal por escrito",
        ],
        blocking_points: [],
        acceptance_criteria: ["aprovação formal por escrito"],
        deadlines: [],
      },
    },
    {
      block_id: "block-003",
      heading: "CLÁUSULA 3 - DOS PRAZOS",
      block_type: "deadline",
      content: "O prazo para entrega final é de 90 dias corridos a partir da assinatura. Entregas parciais devem ocorrer a cada 30 dias.",
      signals: {
        hard_rules: [],
        approval_points: [],
        blocking_points: [],
        acceptance_criteria: [],
        deadlines: [
          "prazo para entrega final é de 90 dias corridos",
          "Entregas parciais devem ocorrer a cada 30 dias",
        ],
      },
    },
  ];
}

// =========================================================================
// Tests
// =========================================================================
async function runTests() {
  console.log("🧪 Smoke Tests — Contract Cognitive Advisor (PR5 v2)\n");

  // ─── 1. Enums íntegros ────────────────────────────────────────────
  section("1. Enums íntegros");
  assert(AMBIGUITY_LEVEL.LOW === "low", "AMBIGUITY_LEVEL.LOW = 'low'");
  assert(AMBIGUITY_LEVEL.MEDIUM === "medium", "AMBIGUITY_LEVEL.MEDIUM = 'medium'");
  assert(AMBIGUITY_LEVEL.HIGH === "high", "AMBIGUITY_LEVEL.HIGH = 'high'");
  assert(AMBIGUITY_LEVEL.CRITICAL === "critical", "AMBIGUITY_LEVEL.CRITICAL = 'critical'");
  assert(typeof CONFIDENCE_THRESHOLDS.HIGH === "number", "CONFIDENCE_THRESHOLDS.HIGH is number");
  assert(typeof CONFIDENCE_THRESHOLDS.MEDIUM === "number", "CONFIDENCE_THRESHOLDS.MEDIUM is number");
  assert(typeof CONFIDENCE_THRESHOLDS.LOW === "number", "CONFIDENCE_THRESHOLDS.LOW is number");

  // ─── 2. Caso aderente e claro ────────────────────────────────────
  section("2. Caso aderente e claro → boa confiança");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "implementar funcionalidade de login",
        action_type: "implement",
        target: "login feature",
        summary: "Implementar funcionalidade de login conforme especificação",
        phase: "development",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "ALLOW",
        reason_code: "ALLOW_ADHERENT",
        reason_text: "Action is adherent to contract.",
        violations: [],
        requires_human_approval: false,
      },
    });

    assert(result.ok === true, "ok = true");
    assert(result.ambiguity_level === AMBIGUITY_LEVEL.LOW, "ambiguity_level = low");
    assert(result.confidence >= 0.5, `confidence >= 0.5 (got ${result.confidence})`);
    assert(result.requires_human_confirmation === false, "requires_human_confirmation = false");
    assert(result.perceived_conflicts.length === 0, "sem conflitos percebidos");
    assert(typeof result.interpretation_summary === "string" && result.interpretation_summary.length > 0, "interpretation_summary não vazio");
    assert(typeof result.suggested_action === "string", "suggested_action presente");
    assert(typeof result.suggested_next_step === "string", "suggested_next_step presente");
    assert(Array.isArray(result.possible_readings), "possible_readings presente");
  }

  // ─── 3. Caso ambíguo (pouca evidência) ─────────────────────────
  section("3. Caso ambíguo → ambiguity_level alto");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "fazer algo não especificado no contrato",
        action_type: "unknown",
        target: "unknown_target",
        summary: "Ação não claramente definida",
      },
      relevantBlocks: [], // sem blocos relevantes
      adherenceResult: null,
    });

    assert(result.ok === true, "ok = true");
    assert(
      result.ambiguity_level === AMBIGUITY_LEVEL.HIGH || result.ambiguity_level === AMBIGUITY_LEVEL.MEDIUM,
      `ambiguity_level alto ou médio (got ${result.ambiguity_level})`
    );
    assert(result.confidence <= 0.6, `confidence <= 0.6 (got ${result.confidence})`);
    assert(typeof result.likely_intent === "string", "likely_intent presente");
  }

  // ─── 4. Conflito contratual explícito ─────────────────────────
  section("4. Caso com conflito contratual explícito");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "deploy em produção sem aprovação",
        action_type: "deploy",
        target: "produção",
        summary: "deploy em produção sem aprovação do contratante",
        phase: "deploy",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "BLOCK",
        reason_code: "BLOCK_HARD_RULE",
        reason_text: "Action conflicts with hard rule: deploy sem aprovação",
        violations: [{ description: "deploy proibido sem aprovação" }],
        requires_human_approval: true,
      },
    });

    assert(result.ok === true, "ok = true");
    assert(result.perceived_conflicts.length > 0, `conflitos percebidos: ${result.perceived_conflicts.length}`);
    assert(result.requires_human_confirmation === true, "requires_human_confirmation = true (gate BLOCK)");
    assert(
      result.ambiguity_level === AMBIGUITY_LEVEL.CRITICAL || result.ambiguity_level === AMBIGUITY_LEVEL.HIGH,
      `ambiguity critical ou high (got ${result.ambiguity_level})`
    );
    assert(
      result.interpretation_summary.includes("bloqueio") || result.interpretation_summary.includes("bloqueou"),
      "interpretação reconhece bloqueio do gate"
    );
    assert(
      result.suggested_action.includes("bloqueio") || result.suggested_action.includes("Respeitar"),
      "suggested_action respeita bloqueio"
    );
  }

  // ─── 5. Sem contrato ativo ──────────────────────────────────────
  section("5. Sem contrato ativo → ok=false");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: null,
      candidateAction: { intent: "qualquer ação" },
      relevantBlocks: [],
    });

    assert(result.ok === false, "ok = false");
    assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
    assert(result.ambiguity_level === AMBIGUITY_LEVEL.HIGH, "ambiguity = high");
    assert(result.confidence <= 0.2, `confidence baixa (got ${result.confidence})`);
    assert(Array.isArray(result.possible_readings), "possible_readings presente mesmo sem contrato");
  }

  // ─── 6. Gate BLOCK → camada respeita ──────────────────────────
  section("6. Gate BLOCK → camada NÃO sobrepõe");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: { intent: "deploy produção", action_type: "deploy", target: "produção" },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "BLOCK",
        reason_code: "BLOCK_HARD_RULE",
        reason_text: "Blocked by hard rule",
        violations: [{ description: "hard rule violation" }],
        requires_human_approval: true,
      },
    });

    assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
    assert(
      !result.suggested_action.includes("pode prosseguir") || result.suggested_action.includes("Respeitar"),
      "suggested_action não libera quando gate bloqueou"
    );
    assert(result.perceived_conflicts.some(c => c.type === "gate_block"), "conflito gate_block detectado");
  }

  // ─── 7. Gate ALLOW → interpretação positiva ─────────────────
  section("7. Gate ALLOW → interpretação positiva");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "implementar feature de relatório",
        action_type: "implement",
        target: "relatório",
        summary: "Implementar relatório conforme especificação",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "ALLOW",
        reason_code: "ALLOW_ADHERENT",
        reason_text: "Ação aderente.",
        violations: [],
        requires_human_approval: false,
      },
    });

    assert(result.ok === true, "ok = true");
    assert(result.interpretation_summary.includes("permite"), "interpretação menciona permissão do gate");
  }

  // ─── 8. Pouca evidência → saída honesta ─────────────────────
  section("8. Pouca evidência → saída honesta");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "ação completamente nova sem precedente",
        action_type: "experimental",
        target: "experimental_target",
      },
      relevantBlocks: [
        {
          block_id: "block-empty",
          heading: "Bloco genérico",
          block_type: "general",
          content: "Disposições gerais do contrato.",
          signals: {
            hard_rules: [],
            approval_points: [],
            blocking_points: [],
            acceptance_criteria: [],
            deadlines: [],
          },
        },
      ],
      adherenceResult: null,
    });

    assert(result.ok === true, "ok = true");
    assert(result.confidence <= 0.7, `confidence moderada ou baixa (got ${result.confidence})`);
    assert(
      result.ambiguity_level !== AMBIGUITY_LEVEL.LOW || result.confidence < CONFIDENCE_THRESHOLDS.HIGH,
      "não finge certeza quando evidência é fraca"
    );
  }

  // ─── 9. Shape canônico completo ──────────────────────────────
  section("9. Shape canônico completo da saída (inclui possible_readings)");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: { intent: "test" },
      relevantBlocks: buildRelevantBlocksFixture(),
    });

    const requiredKeys = [
      "ok", "interpretation_summary", "likely_intent", "ambiguity_level",
      "confidence", "perceived_conflicts", "suggested_action",
      "suggested_next_step", "requires_human_confirmation",
      "contract_evidence", "possible_readings", "notes",
    ];

    for (const key of requiredKeys) {
      assert(key in result, `campo '${key}' presente na saída`);
    }

    assert(typeof result.ok === "boolean", "ok é boolean");
    assert(typeof result.interpretation_summary === "string", "interpretation_summary é string");
    assert(typeof result.likely_intent === "string", "likely_intent é string");
    assert(typeof result.ambiguity_level === "string", "ambiguity_level é string");
    assert(typeof result.confidence === "number", "confidence é number");
    assert(Array.isArray(result.perceived_conflicts), "perceived_conflicts é array");
    assert(typeof result.suggested_action === "string", "suggested_action é string");
    assert(typeof result.suggested_next_step === "string", "suggested_next_step é string");
    assert(typeof result.requires_human_confirmation === "boolean", "requires_human_confirmation é boolean");
    assert(Array.isArray(result.contract_evidence), "contract_evidence é array");
    assert(Array.isArray(result.possible_readings), "possible_readings é array");
    assert(Array.isArray(result.notes), "notes é array");

    // Validate possible_readings shape
    if (result.possible_readings.length > 0) {
      const r0 = result.possible_readings[0];
      assert(typeof r0.summary === "string", "reading[0].summary é string");
      assert(typeof r0.basis === "string", "reading[0].basis é string");
      assert(typeof r0.confidence_hint === "string", "reading[0].confidence_hint é string");
      assert(typeof r0.source === "string", "reading[0].source é string");
    }

    // Validate contract_evidence has source field
    if (result.contract_evidence.length > 0) {
      const e0 = result.contract_evidence[0];
      assert(typeof e0.source === "string", "evidence[0].source é string (block/summary/resolution_ctx)");
    }
  }

  // ─── 10. Determinismo ─────────────────────────────────────────
  section("10. Determinismo: mesma entrada → mesma saída");
  {
    const input = {
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: { intent: "test determinism", action_type: "test" },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: null,
    };

    const r1 = analyzeContractContextCognitively(input);
    const r2 = analyzeContractContextCognitively(input);

    assert(r1.ok === r2.ok, "ok idêntico");
    assert(r1.ambiguity_level === r2.ambiguity_level, "ambiguity_level idêntico");
    assert(r1.confidence === r2.confidence, "confidence idêntico");
    assert(r1.requires_human_confirmation === r2.requires_human_confirmation, "requires_human_confirmation idêntico");
    assert(r1.perceived_conflicts.length === r2.perceived_conflicts.length, "perceived_conflicts.length idêntico");
    assert(r1.interpretation_summary === r2.interpretation_summary, "interpretation_summary idêntico");
    assert(r1.possible_readings.length === r2.possible_readings.length, "possible_readings.length idêntico");
  }

  // ─── 11. Scope A e scope B isolados ──────────────────────────
  section("11. Scope A e scope B isolados (pure function)");
  {
    const ctxA = buildContractContextFixture("contract-A");
    const ctxB = buildContractContextFixture("contract-B");

    const rA = analyzeContractContextCognitively({
      scope: "scope_a",
      contractContext: ctxA,
      candidateAction: { intent: "ação scope A" },
      relevantBlocks: buildRelevantBlocksFixture(),
    });

    const rB = analyzeContractContextCognitively({
      scope: "scope_b",
      contractContext: ctxB,
      candidateAction: { intent: "ação scope B" },
      relevantBlocks: buildRelevantBlocksFixture(),
    });

    assert(rA.ok === true, "scope A → ok");
    assert(rB.ok === true, "scope B → ok");
    assert(typeof rA.interpretation_summary === "string", "scope A tem interpretação");
    assert(typeof rB.interpretation_summary === "string", "scope B tem interpretação");
  }

  // ─── 12. Integração PR2 — runContractCognitiveAdvisor ────────
  section("12. runContractCognitiveAdvisor — integração PR2");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const contractText = buildTestContract();
    const ingestion = await ingestLongContract(env, "pr5-test-001", contractText);
    assert(ingestion && ingestion.ok, "Ingestão OK");

    const activation = await activateIngestedContract(env, "pr5-test-001", { scope: "default" });
    assert(activation && activation.ok, "Ativação OK");

    const result = await runContractCognitiveAdvisor(env, "default", {
      intent: "implementar funcionalidade",
      action_type: "implement",
      target: "feature",
      summary: "Implementar funcionalidade conforme contrato",
      phase: "development",
    });

    assert(result.ok === true, "runContractCognitiveAdvisor ok = true");
    assert(typeof result.interpretation_summary === "string", "interpretation_summary presente");
    assert(typeof result.ambiguity_level === "string", "ambiguity_level presente");
    assert(typeof result.confidence === "number", "confidence presente");
    assert(Array.isArray(result.notes), "notes é array");
    assert(Array.isArray(result.possible_readings), "possible_readings é array");
  }

  // ─── 13. Camada NÃO autoriza ação bloqueada ──────────────────
  section("13. Camada NÃO autoriza ação bloqueada sozinha");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "deploy produção sem aprovação contratante",
        action_type: "deploy",
        target: "produção",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "BLOCK",
        reason_code: "BLOCK_HARD_RULE",
        reason_text: "Deploy proibido sem aprovação",
        violations: [{ description: "deploy proibido sem aprovação do contratante" }],
        requires_human_approval: true,
      },
    });

    assert(result.requires_human_confirmation === true, "requer confirmação humana");
    assert(
      !result.suggested_action.toLowerCase().includes("pode prosseguir sem") &&
      !result.suggested_action.toLowerCase().includes("liberado"),
      "NÃO sugere prosseguir quando gate bloqueou"
    );
    assert(
      result.suggested_action.includes("Respeitar") || result.suggested_action.includes("bloqueio"),
      "suggested_action respeita bloqueio do gate"
    );
  }

  // ─── 14. Múltiplas leituras possíveis ─────────────────────────
  section("14. Múltiplas leituras possíveis → expõe ambiguidade");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "deploy staging aprovação parcial",
        action_type: "deploy",
        target: "staging",
        summary: "deploy em staging com aprovação parcial do contratante",
        phase: "deploy",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "WARN",
        reason_code: "WARN_PARTIAL_EVIDENCE",
        reason_text: "Partial evidence",
        violations: [],
        requires_human_approval: false,
      },
    });

    assert(result.ok === true, "ok = true");
    assert(
      result.ambiguity_level !== AMBIGUITY_LEVEL.LOW || result.perceived_conflicts.length > 0 || result.notes.length > 0,
      "não mascara incerteza — expõe evidência parcial"
    );
    assert(Array.isArray(result.possible_readings), "possible_readings presente");
  }

  // ─── 15. Approval point → requires_human_confirmation ────────
  section("15. Approval point relevante → requires_human_confirmation");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "entrega funcionalidade aprovação contratante",
        action_type: "deliver",
        target: "funcionalidade",
        summary: "entrega deve ser aprovada pelo contratante",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: null,
    });

    assert(result.ok === true, "ok = true");
    if (result.perceived_conflicts.some(c => c.type === "approval_required")) {
      assert(true, "conflito approval_required detectado");
    } else {
      assert(result.notes.length > 0, "notas presentes indicando análise");
    }
  }

  // ─── 16. PR1/PR2/PR3 sem regressão ────────────────────────────
  section("16. PR1/PR2/PR3 sem regressão");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    const ingestion = await ingestLongContract(env, "regression-001", buildTestContract());
    assert(ingestion && ingestion.ok, "PR1 ingestion OK");
    assert(ingestion.blocks_count > 0, "PR1 blocks gerados");

    const activation = await activateIngestedContract(env, "regression-001", { scope: "default" });
    assert(activation && activation.ok, "PR2 activation OK");

    const context = await getActiveContractContext(env, { scope: "default" });
    assert(context && context.ok && context.contract_id === "regression-001", "PR2 context OK");
    assert(context.ready_for_pr3 === true, "PR2 ready_for_pr3");

    const gateResult = await runContractAdherenceGate(env, "default", {
      intent: "implementar funcionalidade",
      action_type: "implement",
      target: "feature",
      phase: "development",
    });
    assert(gateResult && typeof gateResult.decision === "string", "PR3 gate retorna decisão");
    assert(["ALLOW", "WARN", "BLOCK"].includes(gateResult.decision), `PR3 gate decision válida: ${gateResult.decision}`);
  }

  // ─── 17. Sem candidateAction → ambiguity HIGH (nunca LOW) ──
  section("17. Sem candidateAction → ambiguity HIGH (nunca LOW)");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: null,
      relevantBlocks: buildRelevantBlocksFixture(),
    });

    assert(result.ok === true, "ok = true");
    assert(
      result.ambiguity_level === AMBIGUITY_LEVEL.HIGH || result.ambiguity_level === AMBIGUITY_LEVEL.MEDIUM,
      `ambiguity NÃO é LOW sem candidateAction (got ${result.ambiguity_level})`
    );
    assert(result.ambiguity_level !== AMBIGUITY_LEVEL.LOW, "ambiguity NUNCA low sem candidateAction");
    assert(typeof result.likely_intent === "string", "likely_intent descreve ausência");
  }

  // ─── 18. Contrato com blocos sem sinais → medium ────────────
  section("18. Blocos sem sinais → ambiguidade não mínima");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "revisão interna",
        action_type: "review",
        target: "documentação",
        summary: "Revisão interna de documentação",
      },
      relevantBlocks: [
        {
          block_id: "block-nosignal",
          heading: "Disposições gerais",
          block_type: "general",
          content: "Disposições gerais sem sinais específicos.",
          signals: {
            hard_rules: [],
            approval_points: [],
            blocking_points: [],
            acceptance_criteria: [],
            deadlines: [],
          },
        },
      ],
    });

    assert(result.ok === true, "ok = true");
    assert(typeof result.ambiguity_level === "string", "ambiguity_level presente");
    assert(result.confidence <= 0.8, `confidence não inflada (got ${result.confidence})`);
  }

  // =================================================================
  // NEW TESTS: 8 testes adicionais obrigatórios
  // =================================================================

  // ─── 19. summary_canonic altera interpretação quando blocos insuficientes ──
  section("19. summary_canonic altera interpretação/nota/confiança quando blocos insuficientes");
  {
    // Case A: with rich summary but no blocks → summary should enrich
    const withSummary = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-summary-a"),
      candidateAction: {
        intent: "deploy produção aprovação contratante",
        action_type: "deploy",
        target: "produção",
        summary: "deploy em produção com aprovação do contratante",
      },
      relevantBlocks: [], // no blocks!
      adherenceResult: null,
    });

    // Case B: same but with empty summary → should be weaker
    const withoutSummary = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-summary-b", {
        summary: { macro_objective: null, hard_rules_count: 0, hard_rules_top: [] },
        resolution_ctx: {},
      }),
      candidateAction: {
        intent: "deploy produção aprovação contratante",
        action_type: "deploy",
        target: "produção",
        summary: "deploy em produção com aprovação do contratante",
      },
      relevantBlocks: [],
      adherenceResult: null,
    });

    // With summary should have more evidence or better notes
    assert(withSummary.notes.length > withoutSummary.notes.length ||
           withSummary.contract_evidence.length > withoutSummary.contract_evidence.length,
      "summary_canonic enriquece notas/evidência quando blocos ausentes");
    assert(withSummary.notes.some(n => n.includes("summary") || n.includes("macro") || n.includes("Objetivo")),
      "notas mencionam informação do summary");
    // Summary should show up in interpretation
    assert(withSummary.interpretation_summary.length > 0,
      "interpretation_summary enriquecido pelo summary_canonic");
    // Summary-level conflicts should appear
    const summaryConflicts = withSummary.perceived_conflicts.filter(c => c.source === "summary");
    const summaryEvidence = withSummary.contract_evidence.filter(e => e.source === "summary");
    assert(summaryConflicts.length > 0 || summaryEvidence.length > 0,
      "summary gera evidência ou conflito real na análise");
  }

  // ─── 20. resolution_ctx altera interpretação/nota/confiança/ambiguidade ──
  section("20. resolution_ctx altera interpretação/nota/confiança/ambiguidade");
  {
    // Case A: strong resolution context
    const strongRes = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-res-a", {
        resolution_ctx: {
          strategy: "phase_match",
          fallback: false,
          matched_count: 3,
          total_blocks: 5,
        },
      }),
      candidateAction: {
        intent: "implementar funcionalidade software",
        action_type: "implement",
        target: "software",
        summary: "implementar funcionalidade de software",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: null,
    });

    // Case B: fallback resolution context (weak)
    const weakRes = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-res-b", {
        resolution_ctx: {
          strategy: "fallback",
          fallback: true,
          matched_count: 0,
          total_blocks: 10,
        },
      }),
      candidateAction: {
        intent: "implementar funcionalidade software",
        action_type: "implement",
        target: "software",
        summary: "implementar funcionalidade de software",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: null,
    });

    assert(strongRes.confidence >= weakRes.confidence,
      `resolução forte → confiança >= fraca (${strongRes.confidence} >= ${weakRes.confidence})`);
    assert(weakRes.notes.some(n => n.toLowerCase().includes("fallback")),
      "resolução fallback gera nota sobre fallback");
    // resolution_ctx should appear in evidence
    const resEvidence = weakRes.contract_evidence.filter(e => e.source === "resolution_ctx");
    assert(resEvidence.length > 0, "resolution_ctx gera item de evidência");
    // Weak resolution: check notes mention quality
    assert(weakRes.notes.some(n => n.includes("fallback") || n.includes("Resolução")),
      "notas mencionam qualidade da resolução");
  }

  // ─── 21. candidateAction ausente/fraca NÃO cai em LOW ─────────
  section("21. candidateAction ausente/fraca NÃO cai em LOW por padrão");
  {
    // Totally absent
    const absent = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: null,
      relevantBlocks: buildRelevantBlocksFixture(),
    });
    assert(absent.ambiguity_level !== AMBIGUITY_LEVEL.LOW,
      `ação null → ambiguity != LOW (got ${absent.ambiguity_level})`);

    // Empty object
    const empty = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {},
      relevantBlocks: buildRelevantBlocksFixture(),
    });
    assert(empty.ambiguity_level !== AMBIGUITY_LEVEL.LOW,
      `ação {} → ambiguity != LOW (got ${empty.ambiguity_level})`);

    // Very poor action (no useful keywords)
    const poor = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: { intent: "ok" }, // only 2 chars = no keywords
      relevantBlocks: buildRelevantBlocksFixture(),
    });
    assert(poor.ambiguity_level !== AMBIGUITY_LEVEL.LOW,
      `ação fraca "ok" → ambiguity != LOW (got ${poor.ambiguity_level})`);

    // All should have reduced confidence
    assert(absent.confidence < 0.6, `ação null → confidence < 0.6 (got ${absent.confidence})`);
    assert(empty.confidence < 0.6, `ação {} → confidence < 0.6 (got ${empty.confidence})`);
    assert(poor.confidence < 0.6, `ação fraca → confidence < 0.6 (got ${poor.confidence})`);
  }

  // ─── 22. blocos vazios + summary fraco → ambiguidade alta + confiança baixa ──
  section("22. blocos vazios + summary fraco → ambiguidade alta e confiança baixa");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-empty", {
        summary: {
          macro_objective: null,
          hard_rules_count: 0,
          hard_rules_top: [],
          approval_points_count: 0,
          approval_points_top: [],
          blocking_points_count: 0,
          blocking_points_top: [],
        },
        resolution_ctx: null,
      }),
      candidateAction: {
        intent: "alguma ação genérica sem contexto",
        action_type: "generic",
        target: "algo",
      },
      relevantBlocks: [],
      adherenceResult: null,
    });

    assert(result.ok === true, "ok = true");
    assert(result.ambiguity_level === AMBIGUITY_LEVEL.HIGH,
      `sem blocos + sem summary = ambiguity HIGH (got ${result.ambiguity_level})`);
    assert(result.confidence < CONFIDENCE_THRESHOLDS.MEDIUM,
      `confiança < MEDIUM (got ${result.confidence})`);
    assert(result.requires_human_confirmation === true,
      "requer confirmação humana por falta de evidência");
    // Should explicitly note lack of evidence
    assert(result.notes.some(n => n.includes("0") || n.includes("ausente") || n.includes("insuficiente")),
      "notas mencionam falta de evidência");
  }

  // ─── 23. evidência parcial com duas leituras → possible_readings expõe ──
  section("23. evidência parcial → saída expõe leitura principal + alternativa");
  {
    // Scenario: gate ALLOW but approval points exist in blocks
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "entrega aprovação contratante formal",
        action_type: "deliver",
        target: "entrega",
        summary: "entrega requer aprovação formal do contratante",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "ALLOW",
        reason_code: "ALLOW_ADHERENT",
        reason_text: "Allowed",
        violations: [],
        requires_human_approval: false,
      },
    });

    assert(result.ok === true, "ok = true");
    assert(result.possible_readings.length >= 1, "pelo menos 1 reading presente");
    // Primary reading should have summary/basis/source
    const primary = result.possible_readings[0];
    assert(typeof primary.summary === "string", "primary reading tem summary");
    assert(typeof primary.basis === "string", "primary reading tem basis");
    assert(typeof primary.confidence_hint === "string", "primary reading tem confidence_hint");
    assert(typeof primary.source === "string", "primary reading tem source");
    // With approval points + gate ALLOW → should have alternative reading
    if (result.possible_readings.length > 1) {
      const alt = result.possible_readings[1];
      assert(typeof alt.summary === "string" && alt.summary.length > 0,
        "leitura alternativa tem summary");
      assert(typeof alt.source === "string",
        "leitura alternativa indica source");
    }
  }

  // ─── 24. gate BLOCK continua soberano ─────────────────────────
  section("24. gate BLOCK soberano (camada respeita sempre)");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: {
        intent: "deploy produção sem aprovação",
        action_type: "deploy",
        target: "produção",
        summary: "deploy produção sem aprovação contratante",
      },
      relevantBlocks: buildRelevantBlocksFixture(),
      adherenceResult: {
        ok: true,
        decision: "BLOCK",
        reason_code: "BLOCK_HARD_RULE",
        reason_text: "deploy bloqueado por regra dura",
        violations: [{ description: "deploy proibido sem aprovação" }],
        requires_human_approval: true,
      },
    });

    assert(result.requires_human_confirmation === true, "requires_human_confirmation = true");
    assert(result.perceived_conflicts.some(c => c.type === "gate_block" && c.severity === "critical"),
      "gate_block conflict com severity critical");
    assert(result.suggested_action.includes("Respeitar"), "suggested_action respeita bloqueio");
    assert(result.suggested_next_step.includes("Resolver"), "suggested_next_step pede resolver");
    // possible_readings primary should reflect block
    if (result.possible_readings.length > 0) {
      assert(result.possible_readings[0].summary.includes("bloqueou") || result.possible_readings[0].source === "gate",
        "primary reading reflete bloqueio do gate");
    }
  }

  // ─── 25. gate ALLOW não mascara ambiguidade real com base fraca ──
  section("25. gate ALLOW não mascara ambiguidade com base fraca");
  {
    // gate ALLOW but: empty blocks, weak summary, weak resolution
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture("ctx-weak-allow", {
        summary: {
          macro_objective: null,
          hard_rules_count: 0,
          hard_rules_top: [],
          approval_points_count: 0,
          approval_points_top: [],
        },
        resolution_ctx: {
          strategy: "none",
          fallback: true,
          matched_count: 0,
          total_blocks: 5,
        },
      }),
      candidateAction: {
        intent: "ação genérica qualquer",
        action_type: "generic",
        target: "target",
        summary: "algo genérico",
      },
      relevantBlocks: [],
      adherenceResult: {
        ok: true,
        decision: "ALLOW",
        reason_code: "ALLOW_ADHERENT",
        reason_text: "Allowed",
        violations: [],
        requires_human_approval: false,
      },
    });

    assert(result.ok === true, "ok = true");
    // EVEN with gate ALLOW: if base is weak, ambiguity should NOT be LOW
    assert(result.ambiguity_level !== AMBIGUITY_LEVEL.LOW,
      `gate ALLOW + base fraca → ambiguity != LOW (got ${result.ambiguity_level})`);
    assert(result.confidence < CONFIDENCE_THRESHOLDS.HIGH,
      `confiança não alta com base fraca (got ${result.confidence})`);
    // Notes should reflect weak base
    assert(result.notes.some(n =>
      n.includes("0") || n.includes("fallback") || n.includes("ausente") || n.includes("insuficiente") || n.includes("Resolução")
    ), "notas refletem base fraca mesmo com gate ALLOW");
  }

  // ─── 26. PR1/PR2/PR3 regression (extended) ──────────────────
  section("26. PR1/PR2/PR3 regression check (extended)");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    // Full pipeline: PR1 → PR2 → PR3 → PR5
    const ingestion = await ingestLongContract(env, "regression-ext-001", buildTestContract());
    assert(ingestion && ingestion.ok, "PR1 ingestion OK");

    const activation = await activateIngestedContract(env, "regression-ext-001", { scope: "default" });
    assert(activation && activation.ok, "PR2 activation OK");

    const context = await getActiveContractContext(env, { scope: "default" });
    assert(context && context.ok, "PR2 context OK");
    assert(context.summary !== null, "PR2 summary_canonic presente");

    const gateResult = await runContractAdherenceGate(env, "default", {
      intent: "implementar funcionalidade software",
      action_type: "implement",
      target: "software",
      phase: "development",
    });
    assert(gateResult && typeof gateResult.decision === "string", "PR3 gate OK");
    assert(["ALLOW", "WARN", "BLOCK"].includes(gateResult.decision), `PR3 decision: ${gateResult.decision}`);

    // PR5 cognitive advisor on top of full pipeline
    const advisorResult = await runContractCognitiveAdvisor(env, "default", {
      intent: "implementar funcionalidade software",
      action_type: "implement",
      target: "software",
      phase: "development",
    }, { adherenceResult: gateResult });

    assert(advisorResult.ok === true, "PR5 advisor OK sobre pipeline completo");
    assert(typeof advisorResult.interpretation_summary === "string", "PR5 tem interpretation_summary");
    assert(Array.isArray(advisorResult.possible_readings), "PR5 tem possible_readings");
    assert(advisorResult.notes.length > 0, "PR5 gera notas de auditoria");
  }

  // ─── Summary ──────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🧪 Contract Cognitive Advisor (PR5 v2): ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(60)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Fatal error in smoke tests:", err);
  process.exit(1);
});
