// ============================================================================
// 🧪 PR76 — Prova formal: Skill SYSTEM_MAPPER (PR75)
//
// Escopo: Tests-only.
// Objetivo: provar formalmente que SYSTEM_MAPPER e read-only, limitada,
// deterministica, segura, sem side effects e sem dependencia de /skills/run.
// ============================================================================

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { buildSystemMapperResult } from "../schema/enavia-system-mapper-skill.js";

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
  console.log(`\n-- ${title} --`);
}

function collectStrings(value, bucket) {
  if (typeof value === "string") {
    bucket.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStrings(item, bucket);
    return;
  }
  if (value && typeof value === "object") {
    for (const [k, v] of Object.entries(value)) {
      bucket.push(String(k));
      collectStrings(v, bucket);
    }
  }
}

function getChangedFiles() {
  const raw = [
    execSync("git diff --name-only", { encoding: "utf-8" }),
    execSync("git diff --name-only --cached", { encoding: "utf-8" }),
    execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" }),
  ].join("\n");

  return Array.from(
    new Set(
      raw
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  );
}

const modulePath = resolve(__dirname, "../schema/enavia-system-mapper-skill.js");
const workerPath = resolve(__dirname, "../nv-enavia.js");
const wranglerPath = resolve(__dirname, "../wrangler.toml");
const contractExecutorPath = resolve(__dirname, "../contract-executor.js");

const moduleSource = readFileSync(modulePath, "utf-8");
const workerSource = readFileSync(workerPath, "utf-8");
const wranglerSource = readFileSync(wranglerPath, "utf-8");
const contractExecutorSource = readFileSync(contractExecutorPath, "utf-8");

const baseResult = buildSystemMapperResult({});
const approvedGateResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "approved",
});
const proposedGateResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "proposed",
});
const rejectedGateResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "rejected",
});
const blockedGateResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "blocked",
});
const missingStatusGateResult = buildSystemMapperResult({
  require_approved_proposal: true,
});

section("1-7 — contrato base read-only");
ok(typeof buildSystemMapperResult === "function", "1. buildSystemMapperResult existe e e funcao");
ok(baseResult.skill_id === "SYSTEM_MAPPER", "2. resultado padrao retorna skill_id=SYSTEM_MAPPER");
ok(baseResult.mode === "read_only", "3. resultado padrao retorna mode=read_only");
ok(baseResult.status === "ok", "4. resultado padrao retorna status=ok");
ok(baseResult.side_effects === false, "5. side_effects=false");
ok(baseResult.executed === false, "6. executed=false");
ok(baseResult.executed_readonly === true, "7. executed_readonly=true quando permitido");

section("8-14 — estrutura do mapa");
ok(Array.isArray(baseResult?.result?.allowlist), "8. resultado contem allowlist");
ok(baseResult.result.allowlist.includes("SYSTEM_MAPPER"), "9. allowlist inclui SYSTEM_MAPPER");
ok(!!baseResult?.result?.endpoints?.skills, "10. resultado contem endpoints de skills");
ok(baseResult.result.endpoints.skills.propose?.exists === true, "11. /skills/propose aparece como existente");
ok(baseResult.result.endpoints.skills.approve?.exists === true, "12. /skills/approve aparece como existente");
ok(baseResult.result.endpoints.skills.reject?.exists === true, "13. /skills/reject aparece como existente");
ok(baseResult.result.endpoints.skills.run?.exists === false, "14. /skills/run aparece como inexistente");

section("15-20 — gate + limitacoes");
ok(
  baseResult?.result?.proposal_gate?.persistence === "in_memory_per_instance_only",
  "15. proposal_gate indica persistence=in_memory_per_instance_only",
);
const limitations = baseResult?.result?.limitations || [];
ok(limitations.includes("no_side_effects"), "16. limitations incluem no_side_effects");
ok(limitations.includes("no_skills_run_endpoint"), "17. limitations incluem no_skills_run_endpoint");
ok(limitations.includes("no_runtime_filesystem"), "18. limitations incluem no_runtime_filesystem");
ok(limitations.includes("no_external_network_or_llm"), "19. limitations incluem no_external_network_or_llm");
ok(limitations.includes("no_kv_or_database_writes"), "20. limitations incluem no_kv_or_database_writes");

section("21-29 — gate de proposal aprovada");
ok(approvedGateResult.status === "ok" && approvedGateResult.executed_readonly === true, "21. require_approved_proposal=true + proposal_status=approved libera leitura");
ok(proposedGateResult.status === "blocked", "22. require_approved_proposal=true + proposal_status=proposed bloqueia");
ok(rejectedGateResult.status === "blocked", "23. require_approved_proposal=true + proposal_status=rejected bloqueia");
ok(blockedGateResult.status === "blocked", "24. require_approved_proposal=true + proposal_status=blocked bloqueia");
ok(missingStatusGateResult.status === "blocked", "25. require_approved_proposal=true sem proposal_status bloqueia");
ok(proposedGateResult.side_effects === false, "26. bloqueio mantem side_effects=false");
ok(proposedGateResult.executed === false, "27. bloqueio mantem executed=false");
ok(proposedGateResult.executed_readonly === false, "28. bloqueio mantem executed_readonly=false");
ok(proposedGateResult.result === null, "29. bloqueio retorna result=null");

section("30-35 — determinismo + saida segura");
{
  const input = {
    require_approved_proposal: true,
    proposal_status: "approved",
    approval: { status: "approved" },
  };
  const outA = JSON.stringify(buildSystemMapperResult(input));
  const outB = JSON.stringify(buildSystemMapperResult(input));
  ok(outA === outB, "30. saida e deterministica para mesma entrada");
}
const baseJson = JSON.stringify(baseResult);
ok(baseJson.length < 3000, "31. saida e pequena");
ok(baseResult && typeof baseResult === "object" && typeof baseResult.result === "object", "32. saida e estruturada");
{
  const strings = [];
  collectStrings(
    {
      baseResult,
      approvedGateResult,
      proposedGateResult,
      rejectedGateResult,
      blockedGateResult,
      missingStatusGateResult,
    },
    strings,
  );
  const joined = strings.join(" ").toLowerCase();
  ok(!joined.includes("openai_api_key"), "33. saida nao expoe OPENAI_API_KEY");
  ok(!/(token|secret|authorization)/i.test(joined), "34. saida nao expoe token/secret/authorization");
  ok(!joined.includes("supabase_url") && !joined.includes("supabase") && !joined.includes("bucket"), "35. saida nao expoe SUPABASE_URL nem bucket");
}

section("36-40 — modulo sem side effects");
ok(!moduleSource.includes("fetch("), "36. modulo nao contem fetch");
ok(!/\.(put|get|list|delete)\s*\(/.test(moduleSource), "37. modulo nao contem KV put/get/list/delete");
ok(!moduleSource.includes("readFileSync") && !moduleSource.includes("writeFileSync"), "38. modulo nao contem readFileSync/writeFileSync");
ok(!moduleSource.includes("child_process") && !moduleSource.includes("exec(") && !moduleSource.includes("execSync") && !moduleSource.includes("spawn("), "39. modulo nao contem child_process/exec/spawn");
{
  const lower = moduleSource.toLowerCase();
  ok(!lower.includes("openai") && !lower.includes("gpt") && !lower.includes("anthropic"), "40. modulo nao contem openai/gpt/anthropic");
}

section("41-45 — invariantes do worker e escopo PR76");
ok(!workerSource.includes('path === "/skills/run"') && !workerSource.includes('url.pathname === "/skills/run"'), "41. nv-enavia.js nao contem rota /skills/run");

const changedFiles = getChangedFiles();
ok(wranglerSource.length > 0 && !changedFiles.includes("wrangler.toml"), "42. wrangler.toml nao foi alterado");
ok(contractExecutorSource.length > 0 && !changedFiles.includes("contract-executor.js"), "43. contract-executor.js nao foi alterado");
ok(
  workerSource.includes("...(_skillExecution ? { skill_execution: _skillExecution.skill_execution } : {})") &&
    !workerSource.includes("reply = _skillExecution") &&
    !workerSource.includes("use_planner = _skillExecution"),
  "44. reply/use_planner preservados",
);
{
  const hasUnexpectedSkillsEndpoint =
    workerSource.includes('url.pathname === "/skills/run"') ||
    workerSource.includes('url.pathname === "/skills/execute"');
  ok(!hasUnexpectedSkillsEndpoint, "45. nao ha endpoint novo de execucao de skill");
}

section("46 — regressao obrigatoria PR75");
{
  try {
    execSync("node tests/pr75-system-mapper-readonly.smoke.test.js", {
      encoding: "utf-8",
      stdio: "pipe",
    });
    ok(true, "46. teste smoke PR75 continua passando");
  } catch {
    ok(false, "46. teste smoke PR75 continua passando");
  }
}

console.log(`\n${"=".repeat(60)}`);
console.log("PR76 — Prova formal da Skill SYSTEM_MAPPER");
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log("Todos os 46 cenarios obrigatorios passaram.");
process.exit(0);
