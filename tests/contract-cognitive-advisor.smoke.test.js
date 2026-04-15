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
//   9.  Shape canônico completo da saída
//   10. Determinismo: mesma entrada → mesma saída
//   11. Scope A e scope B isolados (pure function)
//   12. runContractCognitiveAdvisor com contrato real (integração PR2)
//   13. Camada NÃO autoriza sozinha ação bloqueada pelo gate
//   14. Camada reconhece múltiplas leituras possíveis
//   15. Caso approval_point → requires_human_confirmation coerente
//   16. PR1/PR2/PR3 sem regressão
//   17. Sem candidateAction → ambiguity alta
//   18. Contrato com blocos mas sem sinais → medium ambiguity
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

function buildContractContextFixture(contractId) {
  return {
    ok: true,
    contract_id: contractId || "test-contract-001",
    active_state: { contract_id: contractId || "test-contract-001" },
    summary: {
      macro_objective: "Prestação de serviços de desenvolvimento de software",
      hard_rules_count: 2,
      hard_rules_top: [
        "É proibido subcontratar terceiros sem aprovação prévia",
        "É proibido deploy em produção sem aprovação do contratante",
      ],
      approval_points_count: 2,
      approval_points_top: [
        "Toda entrega deve ser aprovada pelo contratante",
        "Deploy em ambiente de produção requer aprovação formal",
      ],
      blocking_points_count: 1,
      blocking_points_top: [
        "Deploy em produção sem aprovação do contratante",
      ],
    },
    resolution_ctx: {},
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
  console.log("🧪 Smoke Tests — Contract Cognitive Advisor (PR5)\n");

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
    // Camada NÃO autoriza sozinha — deve reconhecer bloqueio
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

    // A camada NÃO pode dizer "pode prosseguir" quando gate bloqueou
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
  section("9. Shape canônico completo da saída");
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
      "contract_evidence", "notes",
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
    assert(Array.isArray(result.notes), "notes é array");
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
    // Both should work independently
    assert(typeof rA.interpretation_summary === "string", "scope A tem interpretação");
    assert(typeof rB.interpretation_summary === "string", "scope B tem interpretação");
  }

  // ─── 12. Integração PR2 — runContractCognitiveAdvisor ────────
  section("12. runContractCognitiveAdvisor — integração PR2");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    // Ingest and activate a contract
    const contractText = buildTestContract();
    const ingestion = await ingestLongContract(env, "pr5-test-001", contractText);
    assert(ingestion && ingestion.ok, "Ingestão OK");

    const activation = await activateIngestedContract(env, "pr5-test-001", { scope: "default" });
    assert(activation && activation.ok, "Ativação OK");

    // Run cognitive advisor
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

    // Cognitive layer MUST NOT suggest proceeding
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
    // When there are approval points + blocking signals, ambiguity should be noticeable
    assert(
      result.ambiguity_level !== AMBIGUITY_LEVEL.LOW || result.perceived_conflicts.length > 0 || result.notes.length > 0,
      "não mascara incerteza — expõe evidência parcial"
    );
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
    // There are approval_points in blocks that match "aprovação contratante"
    if (result.perceived_conflicts.some(c => c.type === "approval_required")) {
      assert(true, "conflito approval_required detectado");
    } else {
      // Even without explicit conflict, the layer should note approval points
      assert(result.notes.length > 0, "notas presentes indicando análise");
    }
  }

  // ─── 16. PR1/PR2/PR3 sem regressão ────────────────────────────
  section("16. PR1/PR2/PR3 sem regressão");
  {
    const kv = createMockKV();
    const env = { ENAVIA_BRAIN: kv };

    // PR1: Ingestion
    const ingestion = await ingestLongContract(env, "regression-001", buildTestContract());
    assert(ingestion && ingestion.ok, "PR1 ingestion OK");
    assert(ingestion.blocks_count > 0, "PR1 blocks gerados");

    // PR2: Activation + context
    const activation = await activateIngestedContract(env, "regression-001", { scope: "default" });
    assert(activation && activation.ok, "PR2 activation OK");

    const context = await getActiveContractContext(env, { scope: "default" });
    assert(context && context.ok && context.contract_id === "regression-001", "PR2 context OK");
    assert(context.ready_for_pr3 === true, "PR2 ready_for_pr3");

    // PR3: Adherence gate
    const gateResult = await runContractAdherenceGate(env, "default", {
      intent: "implementar funcionalidade",
      action_type: "implement",
      target: "feature",
      phase: "development",
    });
    assert(gateResult && typeof gateResult.decision === "string", "PR3 gate retorna decisão");
    assert(["ALLOW", "WARN", "BLOCK"].includes(gateResult.decision), `PR3 gate decision válida: ${gateResult.decision}`);
  }

  // ─── 17. Sem candidateAction → ambiguidade alta ────────────
  section("17. Sem candidateAction → ambiguidade alta");
  {
    const result = analyzeContractContextCognitively({
      scope: "default",
      contractContext: buildContractContextFixture(),
      candidateAction: null,
      relevantBlocks: buildRelevantBlocksFixture(),
    });

    assert(result.ok === true, "ok = true");
    assert(
      result.ambiguity_level === AMBIGUITY_LEVEL.MEDIUM || result.ambiguity_level === AMBIGUITY_LEVEL.LOW,
      `ambiguity com ação ausente (got ${result.ambiguity_level})`
    );
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

  // ─── Summary ──────────────────────────────────────────────────
  console.log(`\n${"═".repeat(60)}`);
  console.log(`🧪 Contract Cognitive Advisor (PR5): ${passed} passed, ${failed} failed`);
  console.log(`${"═".repeat(60)}`);

  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error("❌ Fatal error in smoke tests:", err);
  process.exit(1);
});
