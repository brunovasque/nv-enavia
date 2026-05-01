// ============================================================================
// 🧪 PR59 — Smoke Test: Response Policy viva
//
// PR-IMPL. Não altera nenhum runtime. Não chama LLM externo.
// Valida que o módulo enavia-response-policy.js funciona corretamente,
// seguindo os cenários obrigatórios definidos no contrato PR59.
//
// Cenários:
//   A — Shape básico
//   B — Caso limpo (intent conversation)
//   C — Frustração / docs over product
//   D — Próxima PR
//   E — Revisão de PR
//   F — Deploy / produção
//   G — False capability
//   H — Fake execution
//   I — Secret exposure (blocking)
//   J — Scope violation / contract drift
//   K — Estratégia
//   L — Integração com prompt (buildChatSystemPrompt)
//   M — /chat/run shape por inspeção/unitário
//   N — Não alteração automática de resposta
//   O — Segurança / side effects
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM externo.
// ============================================================================

import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildEnaviaResponsePolicy,
  buildResponsePolicyPromptBlock,
  RESPONSE_STYLES,
  POLICY_MODES,
} from "../schema/enavia-response-policy.js";

import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);

let passed   = 0;
let failed   = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    failed++;
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

// ---------------------------------------------------------------------------
// Fixtures de self_audit para testes
// ---------------------------------------------------------------------------

function _makeAudit(category, severity, shouldBlock = false) {
  return {
    applied: true,
    mode: "read_only",
    risk_level: severity,
    findings: [{
      id: "SA-001",
      category,
      severity,
      message: `Test finding: ${category}`,
      evidence: "test evidence",
      recommendation: "test recommendation",
    }],
    should_block: shouldBlock,
    warnings: [],
    next_safe_action: "test",
  };
}

// ---------------------------------------------------------------------------
// Cenário A — Shape básico
// ---------------------------------------------------------------------------
section("A — Shape básico");
{
  const result = buildEnaviaResponsePolicy({ message: "oi" });

  ok(typeof buildEnaviaResponsePolicy === "function",
    "buildEnaviaResponsePolicy é uma função exportada");
  ok(result !== null && typeof result === "object",
    "retorna objeto não-null");
  ok(result.applied === true,
    "applied === true");
  ok(result.mode === POLICY_MODES.READ_ONLY,
    `mode === "${POLICY_MODES.READ_ONLY}"`);
  ok(typeof result.response_style === "string" && result.response_style.length > 0,
    "response_style é string não-vazia");
  ok(Object.values(RESPONSE_STYLES).includes(result.response_style),
    "response_style é um valor válido de RESPONSE_STYLES");
  ok(typeof result.should_adjust_tone === "boolean",
    "should_adjust_tone é boolean");
  ok(typeof result.should_warn === "boolean",
    "should_warn é boolean");
  ok(typeof result.should_refuse_or_pause === "boolean",
    "should_refuse_or_pause é boolean");
  ok(typeof result.policy_block === "string",
    "policy_block é string");
  ok(Array.isArray(result.warnings),
    "warnings é array");
  ok(Array.isArray(result.reasons),
    "reasons é array");
  ok(result.reasons.length > 0,
    "reasons não é vazio");
}

// ---------------------------------------------------------------------------
// Cenário B — Caso limpo (intent conversation)
// ---------------------------------------------------------------------------
section("B — Caso limpo (intent conversation)");
{
  const result = buildEnaviaResponsePolicy({
    message: "oi, tudo bem?",
    intentClassification: {
      intent: "conversation",
      confidence: "high",
      is_operational: false,
      reasons: ["cumprimento"],
    },
    selfAudit: null,
    isOperationalContext: false,
  });

  ok(result.applied === true,
    "applied === true para caso limpo");
  ok(
    result.response_style === RESPONSE_STYLES.CONVERSATIONAL
    || result.response_style === RESPONSE_STYLES.STRATEGIC,
    "response_style é conversational ou strategic no caso limpo"
  );
  ok(result.should_warn === false,
    "should_warn === false no caso limpo");
  ok(result.should_refuse_or_pause === false,
    "should_refuse_or_pause === false no caso limpo");
  ok(typeof result.policy_block === "string",
    "policy_block é string (pode ser vazio no caso limpo)");
  const policyBlockLen = result.policy_block.length;
  ok(policyBlockLen < 200,
    `policy_block é curto no caso limpo (${policyBlockLen} chars < 200)`);
}

// ---------------------------------------------------------------------------
// Cenário C — Frustração / docs over product
// ---------------------------------------------------------------------------
section("C — Frustração / docs over product");
{
  // C1: via intent frustration_or_trust_issue
  const r1 = buildEnaviaResponsePolicy({
    message: "parece que estamos virando bot só com documentação",
    intentClassification: {
      intent: "frustration_or_trust_issue",
      confidence: "high",
      is_operational: false,
      reasons: ["frustração"],
    },
    selfAudit: null,
    isOperationalContext: false,
  });

  ok(r1.should_adjust_tone === true,
    "C1: should_adjust_tone=true para frustração");
  ok(
    r1.policy_block.includes("sinceridade")
    || r1.policy_block.toLowerCase().includes("sinceridade")
    || r1.policy_block.includes("confiança")
    || r1.policy_block.includes("Isso é opcional"),
    "C1: policy orienta sinceridade ou item opcional"
  );
  ok(
    r1.policy_block.includes("Isso é opcional. Não mexa agora.")
    || r1.policy_block.toLowerCase().includes("opcional"),
    "C1: policy menciona 'Isso é opcional' ou 'opcional'"
  );
  ok(r1.response_style !== RESPONSE_STYLES.BLOCKING_NOTICE,
    "C1: não ativa blocking_notice por frustração");

  // C2: via self_audit docs_over_product
  const r2 = buildEnaviaResponsePolicy({
    message: "mais documentação...",
    intentClassification: null,
    selfAudit: _makeAudit("docs_over_product", "medium"),
    isOperationalContext: false,
  });

  ok(r2.should_adjust_tone === true,
    "C2: should_adjust_tone=true para docs_over_product");
  ok(
    r2.policy_block.includes("Frustração legítima")
    || r2.policy_block.includes("sinceridade")
    || r2.policy_block.includes("opcional"),
    "C2: policy orienta sinceridade/entrega concreta para docs_over_product"
  );
  ok(r2.response_style !== RESPONSE_STYLES.BLOCKING_NOTICE,
    "C2: não ativa blocking_notice por docs_over_product");
}

// ---------------------------------------------------------------------------
// Cenário D — Próxima PR
// ---------------------------------------------------------------------------
section("D — Próxima PR");
{
  const result = buildEnaviaResponsePolicy({
    message: "qual a próxima PR?",
    intentClassification: {
      intent: "next_pr_request",
      confidence: "high",
      is_operational: true,
      reasons: ["next_pr"],
    },
    selfAudit: null,
    isOperationalContext: false,
  });

  ok(result.applied === true,
    "applied === true para next_pr_request");
  ok(
    result.policy_block.toLowerCase().includes("prompt")
    || result.policy_block.toLowerCase().includes("curta")
    || result.policy_block.toLowerCase().includes("objetivo")
    || result.policy_block.toLowerCase().includes("contrato"),
    "policy orienta resposta curta + prompt completo"
  );
  ok(
    !result.policy_block.toLowerCase().includes("reabrir discussão")
    || result.policy_block.toLowerCase().includes("não reabrir"),
    "policy orienta não reabrir discussão"
  );
  ok(
    result.policy_block.toLowerCase().includes("contrato"),
    "policy menciona seguir contrato"
  );
}

// ---------------------------------------------------------------------------
// Cenário E — Revisão de PR
// ---------------------------------------------------------------------------
section("E — Revisão de PR");
{
  const result = buildEnaviaResponsePolicy({
    message: "revise o PR59",
    intentClassification: {
      intent: "pr_review",
      confidence: "high",
      is_operational: true,
      reasons: ["pr_review"],
    },
    selfAudit: null,
    isOperationalContext: true,
  });

  ok(
    result.response_style === RESPONSE_STYLES.OPERATIONAL
    || result.response_style === RESPONSE_STYLES.CORRECTIVE,
    "response_style operacional ou corrective para pr_review"
  );
  ok(
    result.policy_block.toLowerCase().includes("escopo")
    || result.policy_block.toLowerCase().includes("arquivos")
    || result.policy_block.toLowerCase().includes("teste")
    || result.policy_block.toLowerCase().includes("governança"),
    "policy orienta verificar escopo/arquivos/testes/governança"
  );
  ok(
    result.policy_block.toLowerCase().includes("evidência")
    || result.policy_block.toLowerCase().includes("evidencia"),
    "policy orienta não aprovar sem evidência"
  );
}

// ---------------------------------------------------------------------------
// Cenário F — Deploy / produção
// ---------------------------------------------------------------------------
section("F — Deploy / produção");
{
  // F1: intent deploy_request
  const r1 = buildEnaviaResponsePolicy({
    message: "faz o deploy agora",
    intentClassification: {
      intent: "deploy_request",
      confidence: "high",
      is_operational: true,
      reasons: ["deploy"],
    },
    selfAudit: null,
    isOperationalContext: true,
  });

  ok(r1.should_warn === true,
    "F1: should_warn=true para deploy_request");
  ok(
    r1.policy_block.toLowerCase().includes("gate")
    || r1.policy_block.toLowerCase().includes("aprovação")
    || r1.policy_block.toLowerCase().includes("aprovacao"),
    "F1: policy exige gate/aprovação para deploy"
  );
  ok(
    r1.policy_block.toLowerCase().includes("test")
    || r1.policy_block.toLowerCase().includes("prod"),
    "F1: policy separa test de prod"
  );
  ok(
    r1.policy_block.toLowerCase().includes("prova")
    || r1.policy_block.toLowerCase().includes("evidência")
    || r1.policy_block.toLowerCase().includes("feito")
    || !r1.policy_block.toLowerCase().includes("deploy feito"),
    "F1: policy não afirma deploy feito sem prova"
  );

  // F2: self_audit com unauthorized_action blocking
  const r2 = buildEnaviaResponsePolicy({
    message: "o deploy foi feito",
    intentClassification: null,
    selfAudit: _makeAudit("unauthorized_action", "blocking", true),
    isOperationalContext: true,
  });

  ok(r2.should_warn === true,
    "F2: should_warn=true para unauthorized_action blocking");
  ok(
    r2.response_style === RESPONSE_STYLES.BLOCKING_NOTICE
    || r2.should_refuse_or_pause === true,
    "F2: blocking_notice ou should_refuse_or_pause=true para unauthorized_action blocking"
  );
}

// ---------------------------------------------------------------------------
// Cenário G — False capability
// ---------------------------------------------------------------------------
section("G — False capability");
{
  const result = buildEnaviaResponsePolicy({
    message: "a skill foi executada",
    intentClassification: null,
    selfAudit: _makeAudit("false_capability", "high"),
    isOperationalContext: false,
  });

  ok(result.should_warn === true,
    "should_warn=true para false_capability");
  ok(
    result.policy_block.toLowerCase().includes("documental")
    || result.policy_block.toLowerCase().includes("read-only")
    || result.policy_block.toLowerCase().includes("capacidade"),
    "policy orienta marcar documental/read-only/futuro"
  );
  ok(
    result.response_style === RESPONSE_STYLES.CORRECTIVE
    || result.response_style === RESPONSE_STYLES.BLOCKING_NOTICE,
    "response_style corrective ou blocking_notice para false_capability"
  );
}

// ---------------------------------------------------------------------------
// Cenário H — Fake execution
// ---------------------------------------------------------------------------
section("H — Fake execution");
{
  // H1: fake_execution high (não blocking)
  const r1 = buildEnaviaResponsePolicy({
    message: "o deploy foi realizado",
    intentClassification: null,
    selfAudit: _makeAudit("fake_execution", "high"),
    isOperationalContext: false,
  });

  ok(r1.should_warn === true,
    "H1: should_warn=true para fake_execution high");
  ok(
    r1.policy_block.toLowerCase().includes("evidência")
    || r1.policy_block.toLowerCase().includes("evidencia")
    || r1.policy_block.toLowerCase().includes("afirm"),
    "H1: policy orienta não afirmar execução"
  );

  // H2: fake_execution blocking → should_refuse_or_pause
  const r2 = buildEnaviaResponsePolicy({
    message: "executei o contrato",
    intentClassification: null,
    selfAudit: _makeAudit("fake_execution", "blocking", true),
    isOperationalContext: false,
  });

  ok(r2.should_warn === true,
    "H2: should_warn=true para fake_execution blocking");
  ok(r2.should_refuse_or_pause === true,
    "H2: should_refuse_or_pause=true para fake_execution blocking");
  ok(
    r2.response_style === RESPONSE_STYLES.BLOCKING_NOTICE,
    "H2: response_style=blocking_notice para fake_execution blocking"
  );
}

// ---------------------------------------------------------------------------
// Cenário I — Secret exposure (blocking)
// ---------------------------------------------------------------------------
section("I — Secret exposure (blocking)");
{
  const result = buildEnaviaResponsePolicy({
    message: "meu token é Bearer xyz123",
    intentClassification: null,
    selfAudit: _makeAudit("secret_exposure", "blocking", true),
    isOperationalContext: false,
  });

  ok(result.response_style === RESPONSE_STYLES.BLOCKING_NOTICE,
    "response_style=blocking_notice para secret_exposure");
  ok(result.should_warn === true,
    "should_warn=true para secret_exposure");
  ok(result.should_refuse_or_pause === true,
    "should_refuse_or_pause=true para secret_exposure");
  ok(
    !result.policy_block.toLowerCase().includes("xyz123")
    && !result.policy_block.toLowerCase().includes("bearer xyz"),
    "policy NÃO expõe o segredo"
  );
  ok(
    result.policy_block.toLowerCase().includes("remov")
    || result.policy_block.toLowerCase().includes("sensível"),
    "policy orienta remover o segredo"
  );
  ok(
    !result.warnings.some(w => w.toLowerCase().includes("xyz123")),
    "warnings NÃO contêm o segredo"
  );
  ok(
    !result.reasons.some(r => r.toLowerCase().includes("xyz123")),
    "reasons NÃO contêm o segredo"
  );
}

// ---------------------------------------------------------------------------
// Cenário J — Scope violation / contract drift
// ---------------------------------------------------------------------------
section("J — Scope violation / contract drift");
{
  // J1: scope_violation
  const r1 = buildEnaviaResponsePolicy({
    message: "altera o painel",
    intentClassification: null,
    selfAudit: _makeAudit("scope_violation", "blocking", true),
    isOperationalContext: false,
  });

  ok(
    r1.policy_block.toLowerCase().includes("escopo")
    || r1.policy_block.toLowerCase().includes("contrato")
    || r1.policy_block.toLowerCase().includes("corrig"),
    "J1: policy orienta corrigir escopo/contrato para scope_violation"
  );
  ok(r1.should_adjust_tone === true,
    "J1: should_adjust_tone=true para scope_violation");
  ok(
    r1.policy_block.toLowerCase().includes("fase")
    || r1.policy_block.toLowerCase().includes("prova")
    || r1.policy_block.toLowerCase().includes("parar"),
    "J1: policy orienta não avançar para próxima fase sem prova"
  );

  // J2: contract_drift
  const r2 = buildEnaviaResponsePolicy({
    message: "vamos pular PR60",
    intentClassification: null,
    selfAudit: _makeAudit("contract_drift", "high"),
    isOperationalContext: false,
  });

  ok(
    r2.policy_block.toLowerCase().includes("contrato")
    || r2.policy_block.toLowerCase().includes("escopo"),
    "J2: policy orienta voltar ao contrato para contract_drift"
  );
  ok(r2.should_adjust_tone === true,
    "J2: should_adjust_tone=true para contract_drift");
}

// ---------------------------------------------------------------------------
// Cenário K — Estratégia
// ---------------------------------------------------------------------------
section("K — Estratégia");
{
  const result = buildEnaviaResponsePolicy({
    message: "qual é a melhor estratégia para a próxima fase?",
    intentClassification: {
      intent: "strategy_question",
      confidence: "high",
      is_operational: false,
      reasons: ["estratégia"],
    },
    selfAudit: null,
    isOperationalContext: false,
  });

  ok(result.response_style === RESPONSE_STYLES.STRATEGIC,
    "response_style=strategic para strategy_question");
  ok(
    result.policy_block.toLowerCase().includes("custo")
    || result.policy_block.toLowerCase().includes("risco")
    || result.policy_block.toLowerCase().includes("tempo"),
    "policy pondera custo/tempo/risco"
  );
  ok(
    result.policy_block.toLowerCase().includes("opcional")
    || result.policy_block.toLowerCase().includes("obrigatório")
    || result.policy_block.toLowerCase().includes("obrigatorio"),
    "policy diferencia obrigatório vs opcional"
  );
  ok(
    result.policy_block.toLowerCase().includes("próximo passo")
    || result.policy_block.toLowerCase().includes("concreto")
    || result.policy_block.toLowerCase().includes("passo"),
    "policy puxar próximo passo concreto"
  );
}

// ---------------------------------------------------------------------------
// Cenário L — Integração com prompt (buildChatSystemPrompt)
// ---------------------------------------------------------------------------
section("L — Integração com prompt");
{
  // L1: sem response_policy → POLÍTICA DE RESPOSTA VIVA não deve aparecer
  const promptSemPolicy = buildChatSystemPrompt({
    ownerName: "Bruno",
    include_brain_context: false,
  });
  ok(
    !promptSemPolicy.includes("POLÍTICA DE RESPOSTA VIVA"),
    "L1: sem policy, prompt não contém POLÍTICA DE RESPOSTA VIVA"
  );

  // L2: com response_policy vazia (policy_block vazio) → não aparece
  const promptPolicyVazia = buildChatSystemPrompt({
    ownerName: "Bruno",
    include_brain_context: false,
    response_policy: {
      applied: true,
      mode: "read_only",
      response_style: "conversational",
      should_adjust_tone: false,
      should_warn: false,
      should_refuse_or_pause: false,
      policy_block: "",
      warnings: [],
      reasons: ["caso limpo"],
    },
  });
  ok(
    !promptPolicyVazia.includes("POLÍTICA DE RESPOSTA VIVA"),
    "L2: policy com policy_block vazio, prompt não injeta bloco"
  );

  // L3: com response_policy real → bloco deve aparecer no prompt
  const policyReal = buildEnaviaResponsePolicy({
    message: "faz deploy",
    intentClassification: { intent: "deploy_request", confidence: "high", is_operational: true, reasons: [] },
    selfAudit: null,
    isOperationalContext: true,
  });
  const promptComPolicy = buildChatSystemPrompt({
    ownerName: "Bruno",
    include_brain_context: false,
    response_policy: policyReal,
  });
  ok(
    promptComPolicy.includes("POLÍTICA DE RESPOSTA VIVA"),
    "L3: com policy real (deploy), prompt contém POLÍTICA DE RESPOSTA VIVA"
  );

  // L4: LLM Core continua presente no prompt
  ok(
    promptComPolicy.includes("Enavia") || promptComPolicy.includes("NV Imóveis"),
    "L4: LLM Core continua presente com policy injetada"
  );

  // L5: Brain Context: se present=false, passa; se presente, verifica
  ok(
    typeof promptComPolicy === "string" && promptComPolicy.length > 0,
    "L5: prompt é string não-vazia com policy injetada"
  );

  // L6: envelope JSON continua presente
  ok(
    promptComPolicy.includes('"reply"') && promptComPolicy.includes('"use_planner"'),
    "L6: envelope JSON continua presente no prompt com policy injetada"
  );

  // L7: policy NÃO ativa MODO OPERACIONAL ATIVO sozinha (sem is_operational_context=true)
  const promptPolicySemOp = buildChatSystemPrompt({
    ownerName: "Bruno",
    include_brain_context: false,
    is_operational_context: false,
    response_policy: policyReal,
  });
  ok(
    !promptPolicySemOp.includes("MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO"),
    "L7: policy sozinha não ativa MODO OPERACIONAL ATIVO"
  );

  // L8: Intent Retrieval continua presente quando injetado
  const mockRetrieval = {
    applied: true,
    mode: "read_only",
    intent: "deploy_request",
    skill_id: null,
    sources: [],
    context_block: "Contexto de retrieval de teste.",
    token_budget_hint: 100,
    warnings: [],
  };
  const promptComRetrieval = buildChatSystemPrompt({
    ownerName: "Bruno",
    include_brain_context: false,
    intent_retrieval_context: mockRetrieval,
    response_policy: policyReal,
  });
  ok(
    promptComRetrieval.includes("CONTEXTO RECUPERADO POR INTENÇÃO"),
    "L8: Intent Retrieval continua presente quando injetado com policy"
  );
}

// ---------------------------------------------------------------------------
// Cenário M — /chat/run shape por inspeção de código
// ---------------------------------------------------------------------------
section("M — /chat/run shape por inspeção de código");
{
  const nvenaviaPath = resolve(__dirname, "../nv-enavia.js");
  const nvenaviaSource = readFileSync(nvenaviaPath, "utf-8");

  ok(
    nvenaviaSource.includes("buildEnaviaResponsePolicy"),
    "M1: nv-enavia.js importa buildEnaviaResponsePolicy"
  );
  ok(
    nvenaviaSource.includes("_responsePolicy"),
    "M2: nv-enavia.js usa _responsePolicy"
  );
  ok(
    nvenaviaSource.includes("response_policy:"),
    "M3: nv-enavia.js inclui campo response_policy no response"
  );
  ok(
    nvenaviaSource.includes("applied:") && nvenaviaSource.includes("response_style:"),
    "M4: campo response_policy expõe applied e response_style"
  );
  ok(
    nvenaviaSource.includes("should_warn:") && nvenaviaSource.includes("should_refuse_or_pause:"),
    "M5: campo response_policy expõe should_warn e should_refuse_or_pause"
  );
  ok(
    // policy_block NÃO deve aparecer exposto no response
    !nvenaviaSource.match(/response_policy\s*:\s*\{[^}]*policy_block\s*:/),
    "M6: policy_block NÃO é exposto no response do chat/run"
  );
}

// ---------------------------------------------------------------------------
// Cenário N — Não alteração automática de resposta
// ---------------------------------------------------------------------------
section("N — Não alteração automática de resposta");
{
  // Verificar por inspeção de código que a policy não altera reply
  const nvenaviaPath = resolve(__dirname, "../nv-enavia.js");
  const nvenaviaSource = readFileSync(nvenaviaPath, "utf-8");

  // A policy é chamada ANTES do LLM — não reescreve reply
  const policyCallIdx  = nvenaviaSource.indexOf("buildEnaviaResponsePolicy");
  const replyAssignIdx = nvenaviaSource.indexOf("let reply =");
  ok(
    policyCallIdx > 0 && replyAssignIdx > 0 && policyCallIdx < replyAssignIdx,
    "N1: policy é chamada antes de reply ser atribuído (não o reescreve)"
  );

  // Policy não altera use_planner
  ok(
    !nvenaviaSource.includes("use_planner = _responsePolicy"),
    "N2: policy não altera use_planner"
  );

  // Policy não retorna nova resposta final
  const policyModule = readFileSync(
    resolve(__dirname, "../schema/enavia-response-policy.js"),
    "utf-8"
  );
  ok(
    !policyModule.includes("reply =") && !policyModule.includes("use_planner"),
    "N3: módulo response-policy não atribui reply nem use_planner"
  );

  // Policy só retorna orientação — não chama LLM
  ok(
    !policyModule.includes("fetch(") && !policyModule.includes("await "),
    "N4: módulo response-policy não faz chamadas assíncronas/fetch"
  );
}

// ---------------------------------------------------------------------------
// Cenário O — Segurança / side effects
// ---------------------------------------------------------------------------
section("O — Segurança / side effects");
{
  const policyModule = readFileSync(
    resolve(__dirname, "../schema/enavia-response-policy.js"),
    "utf-8"
  );

  ok(
    !policyModule.includes("fetch("),
    "O1: módulo não chama fetch"
  );
  ok(
    !policyModule.includes("env.ENAVIA_BRAIN") && !policyModule.includes(".put(") && !policyModule.includes(".get(env"),
    "O2: módulo não usa KV"
  );
  ok(
    !policyModule.includes("readFileSync") && !policyModule.includes("writeFileSync") && !policyModule.includes("fs."),
    "O3: módulo não usa filesystem"
  );
  ok(
    !policyModule.includes("app.get(") && !policyModule.includes("app.post(")
    && !policyModule.includes('"/response-policy"') && !policyModule.includes('"/self-audit"'),
    "O4: módulo não cria endpoint"
  );
  ok(
    !policyModule.includes("writeMemory") && !policyModule.includes("updateMemory"),
    "O5: módulo não escreve memória"
  );
  ok(
    !policyModule.includes("chain_of_thought") && !policyModule.includes("chain-of-thought"),
    "O6: módulo não expõe chain-of-thought"
  );
  ok(
    !policyModule.includes("import fetch") && !policyModule.includes('from "node-fetch"'),
    "O7: módulo não importa libs externas desnecessárias"
  );

  // Teste funcional: policy não expõe segredo em saída
  const resultWithSecret = buildEnaviaResponsePolicy({
    message: "meu token é sk-abc123secret",
    selfAudit: {
      applied: true,
      mode: "read_only",
      risk_level: "blocking",
      findings: [{
        id: "SA-001",
        category: "secret_exposure",
        severity: "blocking",
        message: "Token detectado",
        evidence: "sk-abc123secret presente na mensagem",
        recommendation: "Remover token",
      }],
      should_block: true,
      warnings: [],
      next_safe_action: "Remover token",
    },
    isOperationalContext: false,
  });
  ok(
    !resultWithSecret.policy_block.includes("sk-abc123secret"),
    "O8: policy_block não contém o segredo original"
  );
  ok(
    !resultWithSecret.warnings.some(w => w.includes("sk-abc123secret")),
    "O9: warnings não contêm o segredo original"
  );
  ok(
    !resultWithSecret.reasons.some(r => r.includes("sk-abc123secret")),
    "O10: reasons não contêm o segredo original"
  );

  // Teste: buildResponsePolicyPromptBlock existe e é função
  ok(
    typeof buildResponsePolicyPromptBlock === "function",
    "O11: buildResponsePolicyPromptBlock é exportada"
  );

  // Teste: buildResponsePolicyPromptBlock retorna string vazia para null
  ok(
    buildResponsePolicyPromptBlock(null) === "",
    "O12: buildResponsePolicyPromptBlock retorna string vazia para null"
  );

  // Teste: buildResponsePolicyPromptBlock retorna string vazia para policy_block vazio
  ok(
    buildResponsePolicyPromptBlock({ applied: true, policy_block: "" }) === "",
    "O13: buildResponsePolicyPromptBlock retorna string vazia para policy_block vazio"
  );

  // Teste: buildEnaviaResponsePolicy retorna null para input inválido
  ok(
    buildEnaviaResponsePolicy(null) === null,
    "O14: buildEnaviaResponsePolicy retorna null para input null"
  );
  ok(
    buildEnaviaResponsePolicy("string") === null,
    "O15: buildEnaviaResponsePolicy retorna null para input string"
  );
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`PR59 — Response Policy viva — Smoke Test`);
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);
if (failures.length > 0) {
  console.log(`\nFalhas:`);
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
} else {
  console.log("Todos os cenários passaram. ✅");
  process.exit(0);
}
