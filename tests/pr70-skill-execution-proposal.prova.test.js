// ============================================================================
// 🧪 PR70 — Prova formal: Skill Execution Proposal (PR69)
//
// Escopo: Tests-only.
// Objetivo: provar formalmente que PR69 é proposal-only/read-only e sem side effects.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSkillExecutionProposal,
  SKILL_EXECUTION_MODE,
  SKILL_EXECUTION_STATUS,
} from "../schema/enavia-skill-executor.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

function section(title) {
  console.log(`\n── ${title} ──`);
}

// 1) skill conhecida gera proposta com mode=proposal, status=proposed,
// requires_approval=true e side_effects=false
section("1 — Skill conhecida gera proposta");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
    intentClassification: { intent: "pr_review" },
  }).skill_execution;

  ok(out.mode === SKILL_EXECUTION_MODE, "1.1 mode=proposal");
  ok(out.status === SKILL_EXECUTION_STATUS.PROPOSED, "1.2 status=proposed");
  ok(out.requires_approval === true, "1.3 requires_approval=true");
  ok(out.side_effects === false, "1.4 side_effects=false");
  ok(out.skill_id === "CONTRACT_AUDITOR", "1.5 skill_id preservado");
}

// 2) skill desconhecida fica blocked por deny-by-default
section("2 — Skill desconhecida blocked");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "UNLISTED_SKILL" },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.BLOCKED, "2.1 status=blocked");
  ok(out.reason.toLowerCase().includes("allowlist"), "2.2 reason menciona allowlist");
  ok(out.requires_approval === false, "2.3 blocked não requer aprovação");
}

// 3) Self-Audit risk_level=blocking bloqueia proposta
section("3 — Self-Audit risk_level=blocking");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    selfAudit: { risk_level: "blocking", should_block: false, findings: [] },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.BLOCKED, "3.1 status=blocked");
}

// 4) Self-Audit should_block=true bloqueia proposta
section("4 — Self-Audit should_block=true");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    selfAudit: { risk_level: "low", should_block: true, findings: [] },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.BLOCKED, "4.1 status=blocked");
}

// 5) Self-Audit secret_exposure bloqueia proposta
section("5 — Self-Audit secret_exposure");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    selfAudit: {
      risk_level: "low",
      should_block: false,
      findings: [{ category: "secret_exposure", severity: "low" }],
    },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.BLOCKED, "5.1 status=blocked");
  ok(out.reason.toLowerCase().includes("secret_exposure"), "5.2 reason cita secret_exposure");
}

// 6) conversa comum sem skill routing retorna not_applicable
section("6 — Conversa comum sem skill routing");
{
  const out = buildSkillExecutionProposal({
    intentClassification: { intent: "conversation", confidence: "high" },
    skillRouting: { matched: false, skill_id: null },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.NOT_APPLICABLE, "6.1 status=not_applicable");
  ok(out.skill_id === null, "6.2 skill_id=null");
  ok(out.requires_approval === false, "6.3 requires_approval=false");
}

// 7) responsePolicy com pausa/recusa não gera proposta quando não há skill roteada
section("7 — responsePolicy pausa/recusa sem skill roteada");
{
  const out = buildSkillExecutionProposal({
    skillRouting: { matched: false, skill_id: null },
    responsePolicy: { should_refuse_or_pause: true },
  }).skill_execution;

  ok(out.status === SKILL_EXECUTION_STATUS.NOT_APPLICABLE, "7.1 status=not_applicable");
  ok(out.skill_id === null, "7.2 skill_id=null");
  ok(out.requires_approval === false, "7.3 requires_approval=false");
}

const modulePath = resolve(__dirname, "../schema/enavia-skill-executor.js");
const workerPath = resolve(__dirname, "../nv-enavia.js");
const moduleSource = readFileSync(modulePath, "utf-8");
const workerSource = readFileSync(workerPath, "utf-8");

// 8) módulo não contém fetch, KV, filesystem runtime ou chamada LLM externa
section("8 — Módulo sem side effects");
{
  ok(!moduleSource.includes("fetch("), "8.1 sem fetch");
  ok(!moduleSource.includes(".put(") && !moduleSource.includes(".get("), "8.2 sem KV");
  ok(!moduleSource.includes("readFileSync") && !moduleSource.includes("writeFileSync"), "8.3 sem filesystem runtime");
  ok(!moduleSource.includes("openai") && !moduleSource.includes("gpt-"), "8.4 sem chamada LLM externa");
}

// 9) nv-enavia.js contém skill_execution como campo aditivo
section("9 — Campo aditivo no /chat/run");
{
  ok(workerSource.includes("buildSkillExecutionProposal"), "9.1 import/chamada do proposal builder");
  ok(workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})"), "9.2 skill_execution aditivo via spread");
}

// 10) nv-enavia.js não altera reply
section("10 — reply permanece inalterado");
{
  ok(!workerSource.includes("reply = _skillExecution"), "10.1 sem atribuição de reply por skill_execution");
}

// 11) nv-enavia.js não altera use_planner
section("11 — use_planner permanece inalterado");
{
  ok(!workerSource.includes("use_planner = _skillExecution"), "11.1 sem atribuição de use_planner por skill_execution");
}

// 12) /skills/propose continua inexistente
section("12 — /skills/propose inexistente");
{
  ok(!workerSource.includes('url.pathname === "/skills/propose"'), "12.1 rota /skills/propose não existe");
}

// 13) /skills/run continua inexistente
section("13 — /skills/run inexistente");
{
  ok(!workerSource.includes('url.pathname === "/skills/run"'), "13.1 rota /skills/run não existe");
}

console.log(`\n${"=".repeat(60)}`);
console.log("PR70 — Prova formal do Skill Execution Proposal");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários obrigatórios passaram. ✅");
process.exit(0);
