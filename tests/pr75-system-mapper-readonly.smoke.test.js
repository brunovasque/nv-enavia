// ============================================================================
// 🧪 PR75 — Smoke test: SYSTEM_MAPPER read-only limitada
// Run: node tests/pr75-system-mapper-readonly.smoke.test.js
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

const modulePath = resolve(__dirname, "../schema/enavia-system-mapper-skill.js");
const workerPath = resolve(__dirname, "../nv-enavia.js");
const moduleSource = readFileSync(modulePath, "utf-8");
const workerSource = readFileSync(workerPath, "utf-8");

const baseResult = buildSystemMapperResult({});
const approvedResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "approved",
});
const blockedResult = buildSystemMapperResult({
  require_approved_proposal: true,
  proposal_status: "proposed",
});

section("1-3 — contrato principal da skill");
ok(baseResult.skill_id === "SYSTEM_MAPPER", "1. skill_id=SYSTEM_MAPPER");
ok(baseResult.mode === "read_only", "2. mode=read_only");
ok(baseResult.side_effects === false, "3. side_effects=false sempre");

section("4-8 — sem I/O perigoso");
ok(!moduleSource.includes("ENAVIA_BRAIN") && !moduleSource.includes(".put(") && !moduleSource.includes(".get("), "4. nao usa KV");
ok(!moduleSource.includes("fetch("), "5. nao chama fetch");
ok(!moduleSource.includes("readFileSync") && !moduleSource.includes("writeFileSync"), "6. nao usa filesystem runtime");
{
  const lower = moduleSource.toLowerCase();
  ok(!lower.includes("openai") && !lower.includes("gpt-") && !lower.includes("anthropic"), "7. nao chama LLM externo");
}
ok(!moduleSource.includes("execSync") && !moduleSource.includes("spawn(") && !moduleSource.includes("child_process"), "8. nao executa comando externo");

section("9-12 — proibicoes estruturais preservadas");
ok(!workerSource.includes('path === "/skills/run"') && !workerSource.includes('url.pathname === "/skills/run"'), "9. nao cria /skills/run");
{
  const changedSinceMain = execSync("git diff --name-only origin/main..HEAD", { encoding: "utf-8" })
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter(Boolean);
  ok(!changedSinceMain.includes("wrangler.toml"), "10. nao altera wrangler.toml");
  ok(!changedSinceMain.includes("contract-executor.js"), "11. nao altera contract-executor.js");
  ok(!changedSinceMain.includes("nv-enavia.js"), "12. nao altera reply/use_planner (nv-enavia.js intocado)");
}

section("13-17 — mapa seguro de endpoints de skills");
const endpoints = baseResult?.result?.endpoints?.skills || {};
ok(endpoints.propose?.exists === true && endpoints.propose?.path === "/skills/propose", "13. retorna endpoints existentes de skills");
ok(endpoints.propose?.exists === true, "14. informa que /skills/propose existe");
ok(endpoints.approve?.exists === true && endpoints.approve?.path === "/skills/approve", "15. informa que /skills/approve existe");
ok(endpoints.reject?.exists === true && endpoints.reject?.path === "/skills/reject", "16. informa que /skills/reject existe");
ok(endpoints.run?.exists === false && endpoints.run?.path === "/skills/run", "17. informa que /skills/run nao existe");

section("18 — allowlist conhecida inclui SYSTEM_MAPPER");
const allowlist = baseResult?.result?.allowlist || [];
ok(Array.isArray(allowlist) && allowlist.includes("SYSTEM_MAPPER"), "18. allowlist inclui SYSTEM_MAPPER");

section("19 — sem vazamento de segredo/env sensivel");
{
  const strings = [];
  collectStrings(baseResult, strings);
  const joined = strings.join(" ").toLowerCase();
  ok(
    !joined.includes("openai_api_key") &&
      !joined.includes("authorization") &&
      !joined.includes("supabase") &&
      !joined.includes("secret"),
    "19. nao expoe secrets/env sensivel",
  );
}

section("20 — resultado pequeno, estruturado e deterministico");
{
  const stableA = JSON.stringify(buildSystemMapperResult({}));
  const stableB = JSON.stringify(buildSystemMapperResult({}));
  ok(stableA === stableB, "20.1 deterministico");
  ok(stableA.length < 3000, "20.2 pequeno");
  ok(baseResult && typeof baseResult === "object" && baseResult.result && typeof baseResult.result === "object", "20.3 estruturado");
}

section("gate aprovado quando aplicavel");
ok(approvedResult.executed_readonly === true && approvedResult.gate?.approved === true, "gate aprovado libera leitura");
ok(blockedResult.status === "blocked" && blockedResult.executed_readonly === false, "gate nao aprovado bloqueia de forma controlada");

console.log(`\n${"=".repeat(60)}`);
console.log("PR75 — SYSTEM_MAPPER read-only limitada — Smoke Test");
console.log(`Passed: ${passed}  Failed: ${failed}  Total: ${passed + failed}`);

if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}

console.log("Todos os cenarios obrigatorios passaram.");
process.exit(0);
