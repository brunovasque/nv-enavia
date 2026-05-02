// ============================================================================
// 🧪 PR69 — Smoke test: Skill Execution Proposal (proposal-only, read-only)
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildSkillExecutionProposal,
  SKILL_EXECUTION_MODE,
  SKILL_EXECUTION_STATUS,
  SKILL_EXECUTION_ALLOWLIST,
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

section("A — Shape e contrato básico");
{
  const result = buildSkillExecutionProposal({});
  const se = result?.skill_execution;
  ok(typeof buildSkillExecutionProposal === "function", "A1: função exportada");
  ok(se && typeof se === "object", "A2: retorna skill_execution");
  ok(se.mode === SKILL_EXECUTION_MODE, "A3: mode=proposal");
  ok(typeof se.status === "string", "A4: status string");
  ok("skill_id" in se, "A5: skill_id presente");
  ok(typeof se.reason === "string" && se.reason.length > 0, "A6: reason não-vazio");
  ok(typeof se.requires_approval === "boolean", "A7: requires_approval boolean");
  ok(se.side_effects === false, "A8: side_effects=false");
}

section("B — Skill conhecida gera proposta");
{
  const result = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "SYSTEM_MAPPER" },
    intentClassification: { intent: "system_state_question" },
  });
  const se = result.skill_execution;
  ok(se.status === SKILL_EXECUTION_STATUS.PROPOSED, "B1: status=proposed");
  ok(se.skill_id === "SYSTEM_MAPPER", "B2: skill_id preservado");
  ok(se.requires_approval === true, "B3: requires_approval=true quando proposed");
  ok(se.side_effects === false, "B4: side_effects=false");
}

section("C — Deny-by-default para skill desconhecida");
{
  const result = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "UNKNOWN_SKILL" },
  });
  const se = result.skill_execution;
  ok(se.status === SKILL_EXECUTION_STATUS.BLOCKED, "C1: desconhecida => blocked");
  ok(se.requires_approval === false, "C2: blocked => requires_approval=false");
  ok(se.reason.toLowerCase().includes("allowlist"), "C3: reason menciona allowlist");
}

section("D — Self-Audit blocking e secret_exposure bloqueiam");
{
  const blocking = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
    selfAudit: { risk_level: "blocking", should_block: true, findings: [] },
  }).skill_execution;
  ok(blocking.status === SKILL_EXECUTION_STATUS.BLOCKED, "D1: risk_level blocking => blocked");

  const secret = buildSkillExecutionProposal({
    skillRouting: { matched: true, skill_id: "CONTRACT_AUDITOR" },
    selfAudit: {
      risk_level: "low",
      should_block: false,
      findings: [{ category: "secret_exposure", severity: "low" }],
    },
  }).skill_execution;
  ok(secret.status === SKILL_EXECUTION_STATUS.BLOCKED, "D2: secret_exposure => blocked");
  ok(secret.reason.toLowerCase().includes("secret_exposure"), "D3: reason cita secret_exposure");
}

section("E — Conversa comum não gera proposta pesada");
{
  const result = buildSkillExecutionProposal({
    intentClassification: { intent: "conversation", confidence: "high" },
    chatContext: { target: { mode: "read_only" } },
  });
  const se = result.skill_execution;
  ok(se.status === SKILL_EXECUTION_STATUS.NOT_APPLICABLE, "E1: conversa => not_applicable");
  ok(se.skill_id === null, "E2: sem skill_id");
  ok(se.requires_approval === false, "E3: not_applicable => requires_approval=false");
}

section("F — Allowlist canônica");
{
  ok(SKILL_EXECUTION_ALLOWLIST.has("CONTRACT_LOOP_OPERATOR"), "F1: allowlist contém CONTRACT_LOOP_OPERATOR");
  ok(SKILL_EXECUTION_ALLOWLIST.has("CONTRACT_AUDITOR"), "F2: allowlist contém CONTRACT_AUDITOR");
  ok(SKILL_EXECUTION_ALLOWLIST.has("DEPLOY_GOVERNANCE_OPERATOR"), "F3: allowlist contém DEPLOY_GOVERNANCE_OPERATOR");
  ok(SKILL_EXECUTION_ALLOWLIST.has("SYSTEM_MAPPER"), "F4: allowlist contém SYSTEM_MAPPER");
  ok(!SKILL_EXECUTION_ALLOWLIST.has("UNKNOWN_SKILL"), "F5: deny-by-default para unknown");
}

section("G — Integração leve no /chat/run (campo aditivo)");
{
  const workerSource = readFileSync(resolve(__dirname, "../nv-enavia.js"), "utf-8");
  ok(workerSource.includes("buildSkillExecutionProposal"), "G1: nv-enavia.js importa/chama buildSkillExecutionProposal");
  ok(workerSource.includes("skill_execution:"), "G2: /chat/run inclui campo skill_execution");
  ok(!workerSource.includes("reply = _skillExecution"), "G3: integração não altera reply");
  ok(!workerSource.includes("use_planner = _skillExecution"), "G4: integração não altera use_planner");
  ok(!workerSource.includes('url.pathname === "/skills/propose"'), "G5: não criou endpoint /skills/propose");
  ok(!workerSource.includes('url.pathname === "/skills/run"'), "G6: não criou endpoint /skills/run");
}

section("H — Segurança: proposal module sem side effects");
{
  const moduleSource = readFileSync(resolve(__dirname, "../schema/enavia-skill-executor.js"), "utf-8");
  ok(!moduleSource.includes("fetch("), "H1: não chama fetch");
  ok(!moduleSource.includes(".put(") && !moduleSource.includes(".get("), "H2: não usa KV");
  ok(!moduleSource.includes("readFileSync") && !moduleSource.includes("writeFileSync"), "H3: não usa filesystem runtime");
  ok(!moduleSource.includes("openai") && !moduleSource.includes("gpt-"), "H4: não chama LLM externo");
}

console.log(`\n${"=".repeat(60)}`);
console.log(`PR69 — Skill Execution Proposal — Smoke Test`);
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  • ${f}`);
  process.exit(1);
}

console.log("Todos os cenários passaram. ✅");
process.exit(0);
