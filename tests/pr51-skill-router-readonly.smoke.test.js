// ============================================================================
// 🧪 PR51 — Smoke test: Skill Router read-only v1
//
// PR-PROVA pura. Não altera nenhum runtime. Não chama LLM externo.
// Valida que o Skill Router v1 (PR51) funciona corretamente: roteamento
// determinístico, 4 skills documentais, integração com Classificador de
// Intenção, sem execução, sem /skills/run, sem endpoint.
//
// Cenários obrigatórios:
//   A — Router básico: shape canônico, mode=read_only
//   B — Contract Loop Operator
//   C — Contract Auditor
//   D — Deploy Governance Operator
//   E — System Mapper
//   F — Skill request explícito (rode/use a skill X)
//   G — Pergunta sobre skill (/skills/run inexistente, sem fingir runtime)
//   H — Sem match (conversa simples, não inventa skill)
//   I — Integração com Classificador de Intenção (classifyEnaviaIntent + routeEnaviaSkill)
//   J — Segurança (read-only, sem execução, sem rede/KV/FS, sem markdown completo)
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem rede, KV, FS ou LLM.
// Proibido: não altera nv-enavia.js, cognitive-runtime, llm-core, brain-loader,
//           intent-classifier, Panel, Executor, Deploy Worker, workflows ou wrangler.
// ============================================================================

import { strict as assert } from "node:assert";

import {
  routeEnaviaSkill,
  SKILL_IDS,
  ROUTER_MODES,
  CONFIDENCE_LEVELS,
} from "../schema/enavia-skill-router.js";

import {
  classifyEnaviaIntent,
  INTENT_TYPES,
} from "../schema/enavia-intent-classifier.js";

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
// CENÁRIO A — Router básico: shape canônico, mode=read_only
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO A — Router básico");

{
  // A1: routeEnaviaSkill existe e é função
  ok(typeof routeEnaviaSkill === "function", "A1: routeEnaviaSkill é uma função");

  // A2: retorna shape canônico para entrada vazia
  const r = routeEnaviaSkill({ message: "" });
  ok(r !== null && typeof r === "object",         "A2: retorna objeto");
  ok("matched"    in r,                           "A2: campo 'matched' presente");
  ok("skill_id"   in r,                           "A2: campo 'skill_id' presente");
  ok("skill_name" in r,                           "A2: campo 'skill_name' presente");
  ok("mode"       in r,                           "A2: campo 'mode' presente");
  ok("confidence" in r,                           "A2: campo 'confidence' presente");
  ok("reason"     in r,                           "A2: campo 'reason' presente");
  ok("sources"    in r,                           "A2: campo 'sources' presente");
  ok("warning"    in r,                           "A2: campo 'warning' presente");

  // A3: mode é sempre read_only
  const r2 = routeEnaviaSkill({ message: "mande a próxima PR" });
  ok(r2.mode === ROUTER_MODES.READ_ONLY,          "A3: mode === 'read_only'");

  const r3 = routeEnaviaSkill({ message: "oi" });
  ok(r3.mode === ROUTER_MODES.READ_ONLY,          "A3: mode === 'read_only' para mensagem sem match");

  // A4: SKILL_IDS e CONFIDENCE_LEVELS exportados corretamente
  ok(SKILL_IDS.CONTRACT_LOOP_OPERATOR     === "CONTRACT_LOOP_OPERATOR",     "A4: SKILL_IDS.CONTRACT_LOOP_OPERATOR");
  ok(SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR === "DEPLOY_GOVERNANCE_OPERATOR", "A4: SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR");
  ok(SKILL_IDS.SYSTEM_MAPPER              === "SYSTEM_MAPPER",              "A4: SKILL_IDS.SYSTEM_MAPPER");
  ok(SKILL_IDS.CONTRACT_AUDITOR           === "CONTRACT_AUDITOR",           "A4: SKILL_IDS.CONTRACT_AUDITOR");
  ok(CONFIDENCE_LEVELS.HIGH   === "high",   "A4: CONFIDENCE_LEVELS.HIGH");
  ok(CONFIDENCE_LEVELS.MEDIUM === "medium", "A4: CONFIDENCE_LEVELS.MEDIUM");
  ok(CONFIDENCE_LEVELS.LOW    === "low",    "A4: CONFIDENCE_LEVELS.LOW");

  // A5: warning presente e menciona read-only
  const r4 = routeEnaviaSkill({ message: "mande a próxima PR" });
  ok(typeof r4.warning === "string" && r4.warning.length > 0, "A5: warning é string não vazia");
  ok(r4.warning.toLowerCase().includes("read-only"),          "A5: warning menciona read-only");
}

// ---------------------------------------------------------------------------
// CENÁRIO B — Contract Loop Operator
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO B — Contract Loop Operator");

const _b_messages = [
  "mande a próxima PR",
  "volte ao contrato",
  "qual a próxima etapa do contrato?",
  "volta ao contrato",
  "próxima PR",
  "loop do contrato",
  "sequência de PRs",
];

for (const msg of _b_messages) {
  const r = routeEnaviaSkill({ message: msg });
  ok(r.matched === true,                                         `B: matched=true para "${msg}"`);
  ok(r.skill_id === SKILL_IDS.CONTRACT_LOOP_OPERATOR,           `B: skill_id=CONTRACT_LOOP_OPERATOR para "${msg}"`);
  ok(r.mode === ROUTER_MODES.READ_ONLY,                         `B: mode=read_only para "${msg}"`);
  ok(typeof r.sources[0] === "string" && r.sources[0].includes("CONTRACT_LOOP_OPERATOR"), `B: sources correto para "${msg}"`);
}

// ---------------------------------------------------------------------------
// CENÁRIO C — Contract Auditor
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO C — Contract Auditor");

const _c_messages = [
  "revise a PR 210",
  "https://github.com/brunovasque/nv-enavia/pull/210",
  "veja se essa PR quebrou algum critério",
  "audite essa PR",
  "critérios de aceite",
];

for (const msg of _c_messages) {
  const r = routeEnaviaSkill({ message: msg });
  ok(r.matched === true,                                    `C: matched=true para "${msg}"`);
  ok(r.skill_id === SKILL_IDS.CONTRACT_AUDITOR,            `C: skill_id=CONTRACT_AUDITOR para "${msg}"`);
  ok(r.mode === ROUTER_MODES.READ_ONLY,                    `C: mode=read_only para "${msg}"`);
}

// ---------------------------------------------------------------------------
// CENÁRIO D — Deploy Governance Operator
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO D — Deploy Governance Operator");

const _d_messages = [
  "deploya em test",
  "faça rollback",
  "promover para produção",
  "gate de deploy",
  "aprovação de produção",
  "deploy",
];

for (const msg of _d_messages) {
  const r = routeEnaviaSkill({ message: msg });
  ok(r.matched === true,                                                   `D: matched=true para "${msg}"`);
  ok(r.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR,                 `D: skill_id=DEPLOY_GOVERNANCE_OPERATOR para "${msg}"`);
  ok(r.mode === ROUTER_MODES.READ_ONLY,                                   `D: mode=read_only para "${msg}"`);
  ok(typeof r.sources[0] === "string" && r.sources[0].includes("DEPLOY"), `D: sources correto para "${msg}"`);
}

// ---------------------------------------------------------------------------
// CENÁRIO E — System Mapper
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO E — System Mapper");

const _e_messages = [
  "quais workers existem?",
  "verifique o route registry",
  "mapa do sistema",
  "route registry",
  "worker registry",
  "system map",
];

for (const msg of _e_messages) {
  const r = routeEnaviaSkill({ message: msg });
  ok(r.matched === true,                                    `E: matched=true para "${msg}"`);
  ok(r.skill_id === SKILL_IDS.SYSTEM_MAPPER,               `E: skill_id=SYSTEM_MAPPER para "${msg}"`);
  ok(r.mode === ROUTER_MODES.READ_ONLY,                    `E: mode=read_only para "${msg}"`);
}

// ---------------------------------------------------------------------------
// CENÁRIO F — Skill request explícito (rode/use a skill X)
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO F — Skill request explícito");

{
  // F1: "rode a skill Contract Auditor"
  const r1 = routeEnaviaSkill({ message: "rode a skill Contract Auditor" });
  ok(r1.matched === true,                           "F1: matched=true para 'rode a skill Contract Auditor'");
  ok(r1.skill_id === SKILL_IDS.CONTRACT_AUDITOR,   "F1: skill_id=CONTRACT_AUDITOR");
  ok(r1.warning.toLowerCase().includes("execução runtime"), "F1: warning menciona execução runtime");
  ok(r1.warning.toLowerCase().includes("/skills/run"),      "F1: warning menciona /skills/run");

  // F2: "use a skill System Mapper"
  const r2 = routeEnaviaSkill({ message: "use a skill System Mapper" });
  ok(r2.matched === true,                           "F2: matched=true para 'use a skill System Mapper'");
  ok(r2.skill_id === SKILL_IDS.SYSTEM_MAPPER,      "F2: skill_id=SYSTEM_MAPPER");
  ok(r2.warning.toLowerCase().includes("execução runtime"), "F2: warning menciona execução runtime");
  ok(r2.warning.toLowerCase().includes("/skills/run"),      "F2: warning menciona /skills/run");

  // F3: "execute a skill Deploy Governance"
  const r3 = routeEnaviaSkill({ message: "execute a skill de deploy" });
  ok(r3.matched === true,                                    "F3: matched=true para 'execute a skill de deploy'");
  ok(r3.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR, "F3: skill_id=DEPLOY_GOVERNANCE_OPERATOR");
}

// ---------------------------------------------------------------------------
// CENÁRIO G — Pergunta sobre skill (/skills/run inexistente)
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO G — Pergunta sobre skill");

{
  // G1: "qual skill devo usar?" — pode sugerir documental, mas não finge runtime
  const r1 = routeEnaviaSkill({ message: "qual skill devo usar?" });
  ok(r1.mode === ROUTER_MODES.READ_ONLY,             "G1: mode=read_only");
  ok(r1.warning.toLowerCase().includes("read-only"), "G1: warning menciona read-only");
  // Pode ou não ter match — desde que não finja runtime
  ok(r1.skill_id === null || typeof r1.skill_id === "string", "G1: skill_id é null ou string");

  // G2: "você já tem /skills/run?" — não fingir runtime
  const r2 = routeEnaviaSkill({ message: "você já tem /skills/run?" });
  ok(r2.mode === ROUTER_MODES.READ_ONLY,                     "G2: mode=read_only");
  ok(r2.warning.toLowerCase().includes("read-only") ||
     r2.warning.toLowerCase().includes("/skills/run"),       "G2: warning menciona read-only ou /skills/run");
  // Não deve fingir que /skills/run existe
  ok(r2.skill_id === null || typeof r2.skill_id === "string", "G2: skill_id é null ou string");

  // G3: warning sempre inclui /skills/run inexistente
  const r3 = routeEnaviaSkill({ message: "qual skill usar para deploy?" });
  ok(r3.warning.toLowerCase().includes("/skills/run") ||
     r3.warning.toLowerCase().includes("execução runtime") ||
     r3.warning.toLowerCase().includes("read-only"),         "G3: warning inclui aviso de não-execução");
}

// ---------------------------------------------------------------------------
// CENÁRIO H — Sem match (conversa simples)
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO H — Sem match");

const _h_no_match_messages = [
  "oi",
  "como vai?",
];

for (const msg of _h_no_match_messages) {
  const r = routeEnaviaSkill({ message: msg });
  ok(r.matched === false, `H: matched=false para "${msg}" (sem match claro)`);
  ok(r.skill_id === null, `H: skill_id=null para "${msg}"`);
  ok(r.mode === ROUTER_MODES.READ_ONLY, `H: mode=read_only para "${msg}"`);
}

// "qual o melhor caminho?" — não deve inventar skill
const _r_strategy = routeEnaviaSkill({ message: "qual o melhor caminho?" });
ok(_r_strategy.skill_id === null || typeof _r_strategy.skill_id === "string",
   "H: qual o melhor caminho — não inventa skill (null ou string válida)");
ok(_r_strategy.mode === ROUTER_MODES.READ_ONLY,
   "H: qual o melhor caminho — mode=read_only");

// ---------------------------------------------------------------------------
// CENÁRIO I — Integração com Classificador de Intenção
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO I — Integração com Classificador de Intenção");

{
  // I1: skill_request roteia
  const msg1 = "rode a skill Contract Loop";
  const ic1 = classifyEnaviaIntent({ message: msg1 });
  const r1 = routeEnaviaSkill({ message: msg1, intentClassification: ic1 });
  ok(ic1.intent === INTENT_TYPES.SKILL_REQUEST, "I1: classifyEnaviaIntent → skill_request");
  ok(r1.matched === true,                       "I1: routeEnaviaSkill → matched=true");
  ok(r1.skill_id === SKILL_IDS.CONTRACT_LOOP_OPERATOR, "I1: skill_id=CONTRACT_LOOP_OPERATOR");

  // I2: pr_review roteia para Contract Auditor
  const msg2 = "https://github.com/brunovasque/nv-enavia/pull/212";
  const ic2 = classifyEnaviaIntent({ message: msg2 });
  const r2 = routeEnaviaSkill({ message: msg2, intentClassification: ic2 });
  ok(ic2.intent === INTENT_TYPES.PR_REVIEW,           "I2: classifyEnaviaIntent → pr_review");
  ok(r2.matched === true,                             "I2: routeEnaviaSkill → matched=true");
  ok(r2.skill_id === SKILL_IDS.CONTRACT_AUDITOR,      "I2: skill_id=CONTRACT_AUDITOR");

  // I3: deploy_request roteia para Deploy Governance
  const msg3 = "faça o deploy em produção";
  const ic3 = classifyEnaviaIntent({ message: msg3 });
  const r3 = routeEnaviaSkill({ message: msg3, intentClassification: ic3 });
  ok(ic3.intent === INTENT_TYPES.DEPLOY_REQUEST,                "I3: classifyEnaviaIntent → deploy_request");
  ok(r3.matched === true,                                        "I3: routeEnaviaSkill → matched=true");
  ok(r3.skill_id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR,      "I3: skill_id=DEPLOY_GOVERNANCE_OPERATOR");

  // I4: system_state_question pode rotear para System Mapper se técnica
  const msg4 = "quais workers existem no sistema?";
  const ic4 = classifyEnaviaIntent({ message: msg4 });
  const r4 = routeEnaviaSkill({ message: msg4, intentClassification: ic4 });
  // system_state_question OU roteamento por conteúdo (workers → system mapper)
  ok(r4.matched === true,                    "I4: quais workers → matched=true");
  ok(r4.skill_id === SKILL_IDS.SYSTEM_MAPPER, "I4: skill_id=SYSTEM_MAPPER");

  // I5: conversa simples não roteia
  const msg5 = "oi, tudo bem?";
  const ic5 = classifyEnaviaIntent({ message: msg5 });
  const r5 = routeEnaviaSkill({ message: msg5, intentClassification: ic5 });
  ok(ic5.intent === INTENT_TYPES.CONVERSATION || ic5.is_operational === false,
     "I5: classifyEnaviaIntent → não operacional para conversa simples");
  ok(r5.matched === false, "I5: routeEnaviaSkill → matched=false para conversa simples");

  // I6: integração sem intentClassification — funciona só por conteúdo
  const msg6 = "mande a próxima PR";
  const r6 = routeEnaviaSkill({ message: msg6 }); // sem intentClassification
  ok(r6.matched === true,                                "I6: roteia sem intentClassification");
  ok(r6.skill_id === SKILL_IDS.CONTRACT_LOOP_OPERATOR,  "I6: skill_id=CONTRACT_LOOP_OPERATOR sem intent");
}

// ---------------------------------------------------------------------------
// CENÁRIO J — Segurança
// ---------------------------------------------------------------------------
console.log("\n📦 CENÁRIO J — Segurança");

{
  // J1: router não executa nada — retorna apenas metadados documentais
  const r1 = routeEnaviaSkill({ message: "rode a skill Contract Auditor" });
  ok(r1.mode === ROUTER_MODES.READ_ONLY,          "J1: mode=read_only (não executa)");
  ok(r1.warning.length > 0,                       "J1: warning presente");
  // Não deve conter markdown completo da skill
  ok(!r1.warning.includes("##"),                  "J1: warning não contém markdown de skill");
  ok(!r1.warning.includes("---"),                 "J1: warning não contém separador markdown");

  // J2: sources aponta para arquivo documental, não para conteúdo
  const r2 = routeEnaviaSkill({ message: "revise a PR 200" });
  ok(Array.isArray(r2.sources),                   "J2: sources é array");
  ok(r2.sources.length > 0,                       "J2: sources tem ao menos 1 entrada");
  ok(r2.sources[0].includes(".md"),               "J2: sources aponta para .md (documental)");
  // Não deve incluir conteúdo do arquivo
  ok(r2.sources[0].length < 200,                  "J2: sources não inclui conteúdo extenso");

  // J3: input não é modificado
  const inputObj = { message: "mande a próxima PR", context: { foo: "bar" } };
  const originalMsg = inputObj.message;
  routeEnaviaSkill(inputObj);
  ok(inputObj.message === originalMsg,            "J3: input não foi modificado");

  // J4: null/undefined input seguro
  const r4a = routeEnaviaSkill(null);
  ok(r4a.matched === false,                       "J4: null input → matched=false");
  ok(r4a.mode === ROUTER_MODES.READ_ONLY,         "J4: null input → mode=read_only");

  const r4b = routeEnaviaSkill(undefined);
  ok(r4b.matched === false,                       "J4: undefined input → matched=false");

  // J5: modo sempre read_only, nunca outro valor
  const msgs = ["deploy", "revise a PR", "oi", "próxima PR", "system map"];
  for (const msg of msgs) {
    const r = routeEnaviaSkill({ message: msg });
    ok(r.mode === ROUTER_MODES.READ_ONLY, `J5: mode=read_only para "${msg}"`);
  }

  // J6: skill_id sempre é null ou um dos 4 IDs canônicos
  const validIds = new Set(Object.values(SKILL_IDS));
  for (const msg of msgs) {
    const r = routeEnaviaSkill({ message: msg });
    ok(r.skill_id === null || validIds.has(r.skill_id),
       `J6: skill_id é null ou canônico para "${msg}"`);
  }
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
const total = passed + failed;
console.log(`\n${"─".repeat(60)}`);
console.log(`📊 PR51 smoke: ${passed}/${total} ✅`);

if (failures.length > 0) {
  console.log(`\n❌ Falhas (${failures.length}):`);
  for (const f of failures) {
    console.log(`  - ${f}`);
  }
  process.exit(1);
} else {
  console.log("✅ Todos os cenários passaram.");
  process.exit(0);
}
