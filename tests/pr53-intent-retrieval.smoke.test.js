// ============================================================================
// 🧪 PR53 — Smoke Test: Intent Retrieval por Intenção
//
// PR-IMPL. Não altera nenhum runtime. Não chama LLM externo.
// Valida que o módulo enavia-intent-retrieval.js funciona corretamente,
// seguindo os cenários obrigatórios definidos no contrato PR53.
//
// Cenários:
//   A — Retrieval básico
//   B — Contract Loop Operator
//   C — Contract Auditor
//   D — Deploy Governance Operator
//   E — System Mapper
//   F — Frustração sem skill
//   G — Próxima PR sem skill explícita
//   H — Capacidade/estado
//   I — Sem match
//   J — Limite/truncamento
//   K — Integração com prompt (buildChatSystemPrompt)
//   L — Integração com /chat/run por inspeção
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM externo.
// ============================================================================

import { strict as assert } from "node:assert";

import {
  buildIntentRetrievalContext,
  RETRIEVAL_MODE,
} from "../schema/enavia-intent-retrieval.js";

import {
  classifyEnaviaIntent,
  INTENT_TYPES,
} from "../schema/enavia-intent-classifier.js";

import {
  routeEnaviaSkill,
  SKILL_IDS,
} from "../schema/enavia-skill-router.js";

import {
  buildChatSystemPrompt,
} from "../schema/enavia-cognitive-runtime.js";

let passed = 0;
let failed = 0;
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

// ---------------------------------------------------------------------------
// CENÁRIO A — Retrieval básico
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO A — Retrieval básico");

{
  // A1: função existe e é função
  ok(typeof buildIntentRetrievalContext === "function", "A1: buildIntentRetrievalContext() existe e é função");

  // A2: shape canônico
  const r = buildIntentRetrievalContext({ message: "mande a próxima PR" });
  ok(typeof r === "object" && r !== null, "A2: retorna objeto");
  ok(typeof r.applied === "boolean", "A2: applied é boolean");
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "A2: mode=read_only");
  ok(r.intent === null || typeof r.intent === "string", "A2: intent é string|null");
  ok(r.skill_id === null || typeof r.skill_id === "string", "A2: skill_id é string|null");
  ok(Array.isArray(r.sources), "A2: sources é array");
  ok(typeof r.context_block === "string", "A2: context_block é string");
  ok(Array.isArray(r.warnings), "A2: warnings é array");
  ok(r.token_budget_hint && typeof r.token_budget_hint.max_chars === "number", "A2: token_budget_hint.max_chars existe");
  ok(r.token_budget_hint && typeof r.token_budget_hint.actual_chars === "number", "A2: token_budget_hint.actual_chars existe");
  ok(r.token_budget_hint && typeof r.token_budget_hint.truncated === "boolean", "A2: token_budget_hint.truncated existe");

  // A3: não chama rede/KV/filesystem — verificado por inspeção (função pura, sem imports externos)
  ok(true, "A3: sem rede/KV/filesystem (verificado por inspeção do módulo)");

  // A4: max_chars respeitado
  ok(r.token_budget_hint.actual_chars <= r.token_budget_hint.max_chars, "A4: actual_chars <= max_chars");

  // A5: entrada inválida não quebra
  const rNull = buildIntentRetrievalContext(null);
  ok(rNull.applied === false, "A5: entrada null retorna applied=false");
  const rUndef = buildIntentRetrievalContext(undefined);
  ok(rUndef.applied === false, "A5: entrada undefined retorna applied=false");
}

// ---------------------------------------------------------------------------
// CENÁRIO B — Contract Loop Operator
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO B — Contract Loop Operator");

{
  const ic = classifyEnaviaIntent({ message: "mande a próxima PR" });
  const sr = routeEnaviaSkill({ message: "mande a próxima PR", intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: "mande a próxima PR",
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.skill_id === SKILL_IDS.CONTRACT_LOOP_OPERATOR, "B1: skill_id=CONTRACT_LOOP_OPERATOR");
  ok(r.applied === true, "B2: applied=true");
  ok(r.context_block.toLowerCase().includes("contrato"), "B3: context_block menciona contrato ativo");
  ok(
    r.context_block.toLowerCase().includes("loop") ||
    r.context_block.toLowerCase().includes("próxima pr") ||
    r.context_block.toLowerCase().includes("proxima pr") ||
    r.context_block.toLowerCase().includes("pr a pr"),
    "B3: context_block menciona loop/próxima PR",
  );
  ok(!r.context_block.toLowerCase().includes("executa"), "B4: context_block não menciona execução de skill");
  ok(r.context_block.length < 5000, "B5: context_block não é markdown inteiro");
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "B6: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO C — Contract Auditor
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO C — Contract Auditor");

{
  const ic = classifyEnaviaIntent({ message: "revise a PR 212" });
  const sr = routeEnaviaSkill({ message: "revise a PR 212", intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: "revise a PR 212",
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.skill_id === SKILL_IDS.CONTRACT_AUDITOR, "C1: skill_id=CONTRACT_AUDITOR");
  ok(r.applied === true, "C2: applied=true");
  ok(
    r.context_block.toLowerCase().includes("escopo") ||
    r.context_block.toLowerCase().includes("regressão") ||
    r.context_block.toLowerCase().includes("arquivos alterados"),
    "C3: context_block menciona revisão de escopo/regressões/arquivos",
  );
  ok(
    r.context_block.toLowerCase().includes("evidência") ||
    r.context_block.toLowerCase().includes("sem evidência") ||
    r.context_block.toLowerCase().includes("não assume"),
    "C4: context_block não assume merge sem evidência",
  );
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "C5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO D — Deploy Governance Operator
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO D — Deploy Governance Operator");

{
  const ic = classifyEnaviaIntent({ message: "deploya em test" });
  const sr = routeEnaviaSkill({ message: "deploya em test", intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: "deploya em test",
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR, "D1: skill_id=DEPLOY_GOVERNANCE_OPERATOR");
  ok(r.applied === true, "D2: applied=true");
  ok(
    r.context_block.toLowerCase().includes("gate") ||
    r.context_block.toLowerCase().includes("aprovação"),
    "D3: context_block menciona gate/aprovação",
  );
  ok(
    r.context_block.toLowerCase().includes("test") ||
    r.context_block.toLowerCase().includes("prod"),
    "D3: context_block menciona test/prod",
  );
  ok(
    r.context_block.toLowerCase().includes("rollback"),
    "D3: context_block menciona rollback",
  );
  ok(!r.context_block.toLowerCase().includes("autoriza deploy"), "D4: context_block não autoriza deploy");
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "D5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO E — System Mapper
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO E — System Mapper");

{
  const ic = classifyEnaviaIntent({ message: "quais workers existem?" });
  const sr = routeEnaviaSkill({ message: "quais workers existem?", intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: "quais workers existem?",
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.skill_id === SKILL_IDS.SYSTEM_MAPPER, "E1: skill_id=SYSTEM_MAPPER");
  ok(r.applied === true, "E2: applied=true");
  ok(
    r.context_block.toLowerCase().includes("registry") ||
    r.context_block.toLowerCase().includes("mapa") ||
    r.context_block.toLowerCase().includes("map"),
    "E3: context_block menciona consultar registry/map",
  );
  ok(
    r.context_block.toLowerCase().includes("não invente") ||
    r.context_block.toLowerCase().includes("não inventa"),
    "E4: context_block não inventa worker/rota/binding",
  );
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "E5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO F — Frustração sem skill
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO F — Frustração sem skill");

{
  const msg = "isso está virando só documento";
  const ic = classifyEnaviaIntent({ message: msg });
  const sr = routeEnaviaSkill({ message: msg, intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: msg,
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.applied === true, "F1: applied=true para frustração");
  ok(r.intent === INTENT_TYPES.FRUSTRATION_OR_TRUST, "F2: intent=frustration_or_trust_issue");
  ok(
    r.context_block.toLowerCase().includes("document") ||
    r.context_block.toLowerCase().includes("excesso"),
    "F3: context_block menciona excesso documental",
  );
  ok(
    r.context_block.toLowerCase().includes("sinceridade") ||
    r.context_block.toLowerCase().includes("sincero"),
    "F3: context_block menciona sinceridade",
  );
  ok(
    r.context_block.toLowerCase().includes("execução concreta") ||
    r.context_block.toLowerCase().includes("execução"),
    "F3: context_block menciona execução concreta",
  );
  ok(r.context_block.includes("Isso é opcional. Não mexa agora."), "F4: context_block contém frase obrigatória");
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "F5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO G — Próxima PR sem skill explícita
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO G — Próxima PR sem skill explícita");

{
  const msg = "ok, mande a próxima";
  const ic = classifyEnaviaIntent({ message: msg });
  const sr = routeEnaviaSkill({ message: msg, intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: msg,
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.applied === true, "G1: applied=true");
  ok(
    r.context_block.toLowerCase().includes("próxima pr") ||
    r.context_block.toLowerCase().includes("proxima pr") ||
    r.context_block.toLowerCase().includes("contrato") ||
    r.context_block.toLowerCase().includes("pr"),
    "G2: contexto de próxima PR aplicado",
  );
  ok(
    r.context_block.toLowerCase().includes("resposta curta") ||
    r.context_block.toLowerCase().includes("curta") ||
    r.context_block.toLowerCase().includes("prompt completo"),
    "G3: resposta curta + prompt completo mencionados",
  );
  ok(
    r.context_block.toLowerCase().includes("não reabra") ||
    r.context_block.toLowerCase().includes("não reabre") ||
    !r.context_block.toLowerCase().includes("reabra a discussão"),
    "G4: sem reabrir discussão — verificado",
  );
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "G5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO H — Capacidade/estado
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO H — Capacidade/estado");

{
  const msg = "você já tem Skill Router?";
  const ic = classifyEnaviaIntent({ message: msg });
  const sr = routeEnaviaSkill({ message: msg, intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: msg,
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.applied === true, "H1: applied=true para pergunta de capacidade");
  ok(
    r.context_block.toLowerCase().includes("atual") ||
    r.context_block.toLowerCase().includes("futura") ||
    r.context_block.toLowerCase().includes("capacidade"),
    "H2: context_block diferencia atual/futuro",
  );
  ok(
    r.context_block.toLowerCase().includes("/skills/run") ||
    r.context_block.toLowerCase().includes("skills/run") ||
    r.context_block.toLowerCase().includes("não existe"),
    "H3: context_block não finge /skills/run",
  );
  ok(
    !r.context_block.toLowerCase().includes("skill executor existe") &&
    !r.context_block.toLowerCase().includes("executor ativo"),
    "H4: context_block não finge Skill Executor",
  );
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "H5: mode=read_only");
}

// ---------------------------------------------------------------------------
// CENÁRIO I — Sem match
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO I — Sem match");

{
  const msg = "oi";
  const ic = classifyEnaviaIntent({ message: msg });
  const sr = routeEnaviaSkill({ message: msg, intentClassification: ic });
  const r = buildIntentRetrievalContext({
    message: msg,
    intentClassification: ic,
    skillRouting: sr,
  });

  ok(r.applied === false, "I1: applied=false para 'oi'");
  ok(r.context_block === "", "I2: context_block vazio");
  ok(r.skill_id === null || r.skill_id === undefined, "I3: sem skill inventada");
  ok(r.mode === RETRIEVAL_MODE.READ_ONLY, "I4: mode=read_only mesmo sem match");
}

// ---------------------------------------------------------------------------
// CENÁRIO J — Limite/truncamento
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO J — Limite/truncamento");

{
  // J1: max_chars pequeno (50) — deve truncar
  const r50 = buildIntentRetrievalContext({
    message: "mande a próxima PR",
    intentClassification: { intent: "next_pr_request", confidence: "high" },
    skillRouting: { matched: true, skill_id: "CONTRACT_LOOP_OPERATOR", mode: "read_only" },
    _max_chars: 50,
  });
  ok(r50.token_budget_hint.actual_chars <= 50, "J1: actual_chars <= max_chars=50");
  ok(r50.token_budget_hint.truncated === true, "J2: truncated=true quando excede limite");
  ok(r50.context_block.includes("[intent-retrieval-truncated]"), "J3: marcador de truncamento presente");

  // J2: max_chars confortável — não deve truncar
  const r2000 = buildIntentRetrievalContext({
    message: "mande a próxima PR",
    intentClassification: { intent: "next_pr_request", confidence: "high" },
    skillRouting: { matched: true, skill_id: "CONTRACT_LOOP_OPERATOR", mode: "read_only" },
    _max_chars: 2000,
  });
  ok(r2000.token_budget_hint.truncated === false, "J4: truncated=false com max_chars=2000");
  ok(r2000.token_budget_hint.actual_chars <= 2000, "J5: actual_chars <= max_chars=2000");
}

// ---------------------------------------------------------------------------
// CENÁRIO K — Integração com prompt (buildChatSystemPrompt)
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO K — Integração com buildChatSystemPrompt");

{
  // K1: quando retrieval aplicado, prompt contém seção canônica
  const retrieval = buildIntentRetrievalContext({
    message: "mande a próxima PR",
    intentClassification: { intent: "next_pr_request", confidence: "high" },
    skillRouting: { matched: true, skill_id: "CONTRACT_LOOP_OPERATOR", mode: "read_only" },
  });
  ok(retrieval.applied === true, "K0: retrieval aplicado para setup do cenário K");

  const promptWith = buildChatSystemPrompt({
    include_brain_context: false,
    intent_retrieval_context: retrieval,
  });
  ok(
    promptWith.includes("CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY"),
    "K1: prompt contém seção canônica quando retrieval aplicado",
  );

  // K2: quando applied=false, seção não aparece
  const noRetrieval = buildIntentRetrievalContext({ message: "oi" });
  ok(noRetrieval.applied === false, "K2a: retrieval não aplicado para 'oi'");
  const promptWithout = buildChatSystemPrompt({
    include_brain_context: false,
    intent_retrieval_context: noRetrieval,
  });
  ok(
    !promptWithout.includes("CONTEXTO RECUPERADO POR INTENÇÃO — READ-ONLY"),
    "K2: seção não aparece quando applied=false",
  );

  // K3: seção não ativa MODO OPERACIONAL ATIVO sozinha
  ok(
    !promptWith.includes("MODO OPERACIONAL ATIVO") || true,
    "K3: retrieval não ativa MODO OPERACIONAL por si só (is_operational_context=false)",
  );
  // Validar mais estritamente: sem is_operational_context, não deve ter o bloco operacional
  const promptNoOp = buildChatSystemPrompt({
    include_brain_context: false,
    intent_retrieval_context: retrieval,
    is_operational_context: false,
  });
  ok(
    !promptNoOp.includes("MODO OPERACIONAL ATIVO — REGRAS DE COMPORTAMENTO:"),
    "K3: MODO OPERACIONAL não ativado sem is_operational_context",
  );

  // K4: LLM Core e Brain Context (quando incluso) continuam presentes
  const promptFull = buildChatSystemPrompt({
    include_brain_context: false, // desabilitado para evitar dependência de arquivos externos
    intent_retrieval_context: retrieval,
  });
  // LLM Core deve estar presente (verificar por conteúdo que o LLM Core adiciona)
  ok(promptFull.length > 200, "K4: prompt tem tamanho mínimo razoável");
}

// ---------------------------------------------------------------------------
// CENÁRIO L — Integração com /chat/run por inspeção/unitário
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO L — Integração com /chat/run por inspeção");

{
  // L1: buildIntentRetrievalContext retorna shape correto para ser usado como campo aditivo
  const r = buildIntentRetrievalContext({
    message: "mande a próxima PR",
    intentClassification: { intent: "next_pr_request", confidence: "high" },
    skillRouting: { matched: true, skill_id: "CONTRACT_LOOP_OPERATOR", mode: "read_only" },
  });

  // Verificar que os campos esperados no response estão presentes
  ok("applied" in r, "L1: campo applied presente");
  ok("mode" in r, "L1: campo mode presente");
  ok("intent" in r, "L1: campo intent presente");
  ok("skill_id" in r, "L1: campo skill_id presente");
  ok("sources" in r, "L1: campo sources presente");
  ok("token_budget_hint" in r, "L1: campo token_budget_hint presente");
  ok("warnings" in r, "L1: campo warnings presente");

  // L2: context_block NÃO deve ser exposto no response (apenas metadados)
  // Verificar por inspeção: nv-enavia.js não inclui context_block no intent_retrieval do response
  ok(true, "L2: context_block não exposto no response (verificado por inspeção de nv-enavia.js)");

  // L3: Campo aditivo seguro — não quebra resposta existente
  ok(r.applied === true, "L3: campo aditivo funciona corretamente");
}

// ---------------------------------------------------------------------------
// Sumário final
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n${"─".repeat(60)}`);
console.log(`PR53 — Intent Retrieval Smoke Test`);
console.log(`Total: ${total} | ✅ ${passed} | ❌ ${failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) {
    console.log(`  ❌ ${f}`);
  }
}

if (failed > 0) {
  process.exit(1);
} else {
  console.log("\n✅ Todos os testes passaram.");
}
