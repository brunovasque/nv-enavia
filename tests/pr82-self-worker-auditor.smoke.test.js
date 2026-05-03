// ============================================================================
// 🧪 PR82 — SELF_WORKER_AUDITOR (smoke)
//
// Run: node tests/pr82-self-worker-auditor.smoke.test.js
//
// Cenários:
//  1. SELF_WORKER_AUDITOR existe como módulo
//  2. retorna skill_id correto
//  3. retorna mode=read_only
//  4. retorna executed=true quando proposal_status=approved
//  5. retorna side_effects=false
//  6. retorna findings como array
//  7. findings têm severity válida
//  8. findings têm category válida
//  9. inclui categoria security
// 10. inclui categoria telemetry
// 11. inclui categoria deploy_loop
// 12. inclui categoria chat_rigidity
// 13. inclui categoria tests ou governance
// 14. priority_actions tem no máximo 5 itens
// 15. priority_actions recomenda PR83 para deploy loop
// 16. priority_actions recomenda PR84 para chat engessado
// 17. registry lista SELF_WORKER_AUDITOR
// 18. registry mantém SYSTEM_MAPPER
// 19. runner bloqueia SELF_WORKER_AUDITOR sem approval
// 20. runner executa SELF_WORKER_AUDITOR com proposal_status=approved
// 21. /skills/run executa SELF_WORKER_AUDITOR aprovada
// 22. /skills/run bloqueia SELF_WORKER_AUDITOR sem approval
// 23. /skills/run bloqueia skill desconhecida
// 24. não usa fetch
// 25. não usa filesystem runtime
// 26. não usa child_process/exec/spawn
// 27. não chama LLM externo novo
// 28. não altera wrangler.toml
// 29. não altera contract-executor.js
// 30. não mexe em painel/deploy-worker/executor/workflows
// 31-33. PR79/PR80/PR81 continuam passando (regressão)
// ============================================================================

import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import worker from "../nv-enavia.js";
import {
  buildSelfWorkerAuditorResult,
  SELF_WORKER_AUDITOR_SKILL_ID,
  SELF_WORKER_AUDITOR_MODE,
  getValidSeverities,
  getValidCategories,
} from "../schema/enavia-self-worker-auditor-skill.js";
import {
  listRegisteredSkills,
  getRegisteredSkill,
  isSkillRegistered,
} from "../schema/enavia-skill-registry.js";
import { runRegisteredSkill } from "../schema/enavia-skill-runner.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed += 1;
  } else {
    console.log(`  ❌ ${label}`);
    failed += 1;
    failures.push(label);
  }
}

function section(title) {
  console.log(`\n── ${title} ──`);
}

function runRegression(label, command) {
  try {
    execSync(command, { encoding: "utf-8", stdio: "pipe" });
    ok(true, label);
  } catch {
    ok(false, label);
  }
}

function getChangedFiles() {
  const a = execSync("git diff --name-only", { encoding: "utf-8" });
  const b = execSync("git diff --name-only --cached", { encoding: "utf-8" });
  const c = execSync("git diff --name-only origin/main HEAD", { encoding: "utf-8" });
  return [...new Set([...a.split("\n"), ...b.split("\n"), ...c.split("\n")])].filter(Boolean);
}

function makeRequest(worker, method, path, body) {
  const url = `https://enavia.example.com${path}`;
  const init =
    method === "POST"
      ? {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        }
      : { method };
  const req = new Request(url, init);
  return worker.fetch(req, {}, {});
}

// ============================================================================
// 1. Módulo SELF_WORKER_AUDITOR existe
// ============================================================================
section("1. Módulo SELF_WORKER_AUDITOR");
ok(typeof buildSelfWorkerAuditorResult === "function", "buildSelfWorkerAuditorResult é função");
ok(SELF_WORKER_AUDITOR_SKILL_ID === "SELF_WORKER_AUDITOR", "SELF_WORKER_AUDITOR_SKILL_ID correto");
ok(SELF_WORKER_AUDITOR_MODE === "read_only", "SELF_WORKER_AUDITOR_MODE = read_only");

// ============================================================================
// 2–5. Resultado básico com proposal aprovada
// ============================================================================
section("2–5. Resultado com approval=approved");
{
  const result = buildSelfWorkerAuditorResult({
    proposal_status: "approved",
    require_approved_proposal: true,
  });
  ok(result.skill_id === "SELF_WORKER_AUDITOR", "2. skill_id = SELF_WORKER_AUDITOR");
  ok(result.mode === "read_only", "3. mode = read_only");
  ok(result.executed === true, "4. executed = true quando approved");
  ok(result.side_effects === false, "5. side_effects = false");
}

// ============================================================================
// 6–13. Findings: array, severities, categories, cobertura obrigatória
// ============================================================================
section("6–13. Findings");
{
  const result = buildSelfWorkerAuditorResult({ proposal_status: "approved" });
  ok(Array.isArray(result.findings), "6. findings é array");

  const validSeverities = new Set(getValidSeverities());
  const validCategories = new Set(getValidCategories());
  const severitiesOk = result.findings.every((f) => validSeverities.has(f.severity));
  const categoriesOk = result.findings.every((f) => validCategories.has(f.category));
  ok(severitiesOk, "7. todas as findings têm severity válida");
  ok(categoriesOk, "8. todas as findings têm category válida");

  const cats = new Set(result.findings.map((f) => f.category));
  ok(cats.has("security"), "9. inclui categoria security");
  ok(cats.has("telemetry"), "10. inclui categoria telemetry");
  ok(cats.has("deploy_loop"), "11. inclui categoria deploy_loop");
  ok(cats.has("chat_rigidity"), "12. inclui categoria chat_rigidity");
  ok(cats.has("tests") || cats.has("governance"), "13. inclui categoria tests ou governance");
}

// ============================================================================
// 14–16. Priority actions
// ============================================================================
section("14–16. Priority actions");
{
  const result = buildSelfWorkerAuditorResult({ proposal_status: "approved" });
  ok(result.priority_actions.length <= 5, "14. priority_actions tem no máximo 5 itens");

  const pr83 = result.priority_actions.find(
    (a) => a.target_pr === "PR83" && /deploy/i.test(a.action),
  );
  ok(!!pr83, "15. priority_actions recomenda PR83 para deploy loop");

  const pr84 = result.priority_actions.find(
    (a) => a.target_pr === "PR84" && /chat|engessad/i.test(a.action),
  );
  ok(!!pr84, "16. priority_actions recomenda PR84 para chat engessado");
}

// ============================================================================
// 17–18. Registry
// ============================================================================
section("17–18. Registry");
{
  const skills = listRegisteredSkills();
  const ids = skills.map((s) => s.skill_id);
  ok(ids.includes("SELF_WORKER_AUDITOR"), "17. registry lista SELF_WORKER_AUDITOR");
  ok(ids.includes("SYSTEM_MAPPER"), "18. registry mantém SYSTEM_MAPPER");
  ok(isSkillRegistered("SELF_WORKER_AUDITOR"), "17b. isSkillRegistered SELF_WORKER_AUDITOR = true");

  const entry = getRegisteredSkill("SELF_WORKER_AUDITOR");
  ok(entry !== null, "17c. getRegisteredSkill retorna entry");
  ok(entry.mode === "read_only", "17d. registry.mode = read_only");
  ok(entry.executable === true, "17e. registry.executable = true");
  ok(entry.requires_approval === true, "17f. registry.requires_approval = true");
  ok(entry.human_review_required === true, "17g. registry.human_review_required = true");
  ok(entry.side_effects_allowed === false, "17h. registry.side_effects_allowed = false");
  ok(entry.risk_level === "medium", "17i. registry.risk_level = medium");
  ok(Array.isArray(entry.forbidden_effects) && entry.forbidden_effects.length > 0, "17j. forbidden_effects não vazio");
}

// ============================================================================
// 19–20. Runner direto
// ============================================================================
section("19–20. Runner direto");
{
  // Bloqueia sem approval
  const blocked = runRegisteredSkill({
    skill_id: "SELF_WORKER_AUDITOR",
    proposal_id: "prop-test-001",
    proposal_status: "proposed",
  });
  ok(blocked.ok === false, "19. runner bloqueia SELF_WORKER_AUDITOR sem approval");
  ok(blocked.executed === false, "19b. executed = false quando bloqueado");

  // Executa com approval
  const run = runRegisteredSkill({
    skill_id: "SELF_WORKER_AUDITOR",
    proposal_id: "prop-test-002",
    proposal_status: "approved",
  });
  ok(run.ok === true, "20. runner executa SELF_WORKER_AUDITOR com approved");
  ok(run.executed === true, "20b. executed = true com approved");
  ok(run.side_effects === false, "20c. side_effects = false no runner");
  ok(run.result !== null, "20d. result não nulo");
  ok(run.result.skill_id === "SELF_WORKER_AUDITOR", "20e. result.skill_id correto");
  ok(run.result.executed === true, "20f. result.executed = true");
  ok(Array.isArray(run.result.findings), "20g. result.findings é array");
}

// ============================================================================
// 21–23. /skills/run via HTTP
// ============================================================================
section("21–23. POST /skills/run via HTTP");
{
  // 21. executa aprovada
  const res21 = await makeRequest(worker, "POST", "/skills/run", {
    skill_id: "SELF_WORKER_AUDITOR",
    proposal_id: "prop-http-001",
    proposal_status: "approved",
  });
  const body21 = await res21.json();
  ok(res21.status === 200, "21. /skills/run retorna 200 para SELF_WORKER_AUDITOR aprovada");
  ok(body21.ok === true || body21.executed === true, "21b. body ok ou executed=true");

  // 22. bloqueia sem approval
  const res22 = await makeRequest(worker, "POST", "/skills/run", {
    skill_id: "SELF_WORKER_AUDITOR",
    proposal_id: "prop-http-002",
    proposal_status: "proposed",
  });
  const body22 = await res22.json();
  ok(res22.status !== 200, "22. /skills/run bloqueia SELF_WORKER_AUDITOR sem approval (status != 200)");
  ok(body22.ok === false || body22.executed === false, "22b. body blocked para proposed");

  // 23. bloqueia skill desconhecida
  const res23 = await makeRequest(worker, "POST", "/skills/run", {
    skill_id: "SKILL_INEXISTENTE_XYZ",
    proposal_id: "prop-http-003",
    proposal_status: "approved",
  });
  const body23 = await res23.json();
  ok(res23.status === 404 || res23.status === 409, "23. /skills/run bloqueia skill desconhecida (404|409)");
  ok(body23.ok === false, "23b. body ok=false para skill desconhecida");
}

// ============================================================================
// 24–27. Inspeção estática — sem proibidos
// ============================================================================
section("24–27. Inspeção estática — proibidos ausentes");
{
  const skillFile = readFileSync(
    resolve(ROOT, "schema/enavia-self-worker-auditor-skill.js"),
    "utf-8",
  );

  // Sem fetch
  const hasFetch = /\bfetch\s*\(/.test(skillFile);
  ok(!hasFetch, "24. não usa fetch");

  // Sem filesystem runtime (readFileSync/writeFileSync/fs.open etc no módulo de produção)
  const hasFS = /\breadFileSync\b|\bwriteFileSync\b|\bfs\.(open|write|read|unlink)\b/.test(skillFile);
  ok(!hasFS, "25. não usa filesystem runtime no módulo de skill");

  // Sem child_process/exec/spawn
  const hasChild = /\bchild_process\b|\bexecSync\b|\bspawnSync\b|\bexec\s*\(|\bspawn\s*\(/.test(skillFile);
  ok(!hasChild, "26. não usa child_process/exec/spawn");

  // Sem chamada LLM externo novo (import de openai/anthropic/cohere/etc)
  const hasLLM = /\bopenai\b|\banthropicai\b|\bcohereai\b|\bnew OpenAI\b/.test(skillFile);
  ok(!hasLLM, "27. não chama LLM externo novo");
}

// ============================================================================
// 28–30. Arquivos proibidos não alterados
// ============================================================================
section("28–30. Arquivos proibidos não alterados");
{
  const changed = getChangedFiles();
  ok(!changed.some((f) => f === "wrangler.toml"), "28. não altera wrangler.toml");
  ok(!changed.some((f) => f === "contract-executor.js"), "29. não altera contract-executor.js");
  ok(
    !changed.some(
      (f) =>
        f.startsWith("panel/") ||
        f.startsWith("executor/") ||
        f.includes("deploy-worker") ||
        f.includes(".github/workflows"),
    ),
    "30. não mexe em painel/deploy-worker/executor/workflows",
  );
}

// ============================================================================
// 31–33. Regressão PR79, PR80, PR81
// ============================================================================
section("31–33. Regressão PRs anteriores");
runRegression("31. PR79 continua passando", "node tests/pr79-skill-factory-core.smoke.test.js");
runRegression("32. PR80 continua passando", "node tests/pr80-skill-registry-runner.smoke.test.js");
runRegression("33. PR81 continua passando", "node tests/pr81-skill-factory-real.fechamento.test.js");

// ============================================================================
// Resultado final
// ============================================================================
console.log(`\n${"=".repeat(60)}`);
console.log(`PR82 smoke: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log("✅ Todos os cenários passaram.");
  process.exit(0);
}
