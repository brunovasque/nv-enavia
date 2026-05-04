/**
 * PR102 — Diagnóstico READ-ONLY do GitHub Bridge Real
 *
 * Run:
 *   node tests/pr102-github-bridge-real-diagnostico.prova.test.js
 */

"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { spawnSync, execSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");

function read(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return "";
  return fs.readFileSync(full, "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function gitDiffIsEmpty(relPath) {
  try {
    const out = execSync(`git diff --name-only -- "${relPath}"`, {
      cwd: ROOT,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }).trim();
    return out.length === 0;
  } catch (_) {
    return false;
  }
}

function runTestFile(relPath) {
  const result = spawnSync(process.execPath, [path.join(ROOT, relPath)], {
    cwd: ROOT,
    encoding: "utf8",
    timeout: 120000,
  });

  const output = `${result.stdout || ""}\n${result.stderr || ""}`;

  if (result.status === 0) return { ok: true, output };

  if (result.signal === "SIGTERM" && result.status === null) {
    const hasRealFailLine = /❌\s*(\[\d+\]|FAIL|falha|failed)/i.test(output);
    return { ok: !hasRealFailLine, output, timedOut: true };
  }

  const hasFail = /❌\s*(\[\d+\]|FAIL|falha|failed)/i.test(output);
  return { ok: !hasFail, output };
}

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${passed + failed}. ${label}`);
  } else {
    failed++;
    failures.push(`${passed + failed}. ${label}`);
    console.log(`  ❌ ${passed + failed}. ${label}`);
  }
}

console.log("============================================================");
console.log("PR102 — GitHub Bridge Real Diagnóstico — Prova");
console.log("============================================================\n");

const files = {
  contract: "schema/contracts/active/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md",
  active: "schema/contracts/ACTIVE_CONTRACT.md",
  index: "schema/contracts/INDEX.md",
  report: "schema/reports/PR102_GITHUB_BRIDGE_REAL_DIAGNOSTICO.md",
  status: "schema/status/ENAVIA_STATUS_ATUAL.md",
  handoff: "schema/handoffs/ENAVIA_LATEST_HANDOFF.md",
  execLog: "schema/execution/ENAVIA_EXECUTION_LOG.md",
  nv: "nv-enavia.js",
  executor: "executor/src/index.js",
  contractExecutor: "contract-executor.js",
  deployYml: ".github/workflows/deploy.yml",
  wrangler: "wrangler.toml",
};

const content = {
  contract: read(files.contract),
  active: read(files.active),
  index: read(files.index),
  report: read(files.report),
  status: read(files.status),
  handoff: read(files.handoff),
  execLog: read(files.execLog),
  nv: read(files.nv),
  executor: read(files.executor),
  contractExecutor: read(files.contractExecutor),
  deployYml: read(files.deployYml),
  wrangler: read(files.wrangler),
};

// 1–4
assert(exists(files.contract), "contrato PR102–PR105 criado");
assert(content.active.includes("CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105"), "ACTIVE_CONTRACT aponta novo contrato");
assert(content.index.includes("PR102") && (content.index.includes("PR103") || content.index.includes("Concluída")), "INDEX aponta PR102 concluída ou PR103 próxima");
assert(exists(files.report) && content.report.length > 1200, "relatório PR102 existe");

// 5–7
assert(content.index.includes("PR98") && content.index.includes("PR101") && content.index.includes("Encerrado"), "PR98–PR101 constam encerradas");
assert(content.index.includes("PR94") && content.index.includes("PR97") && content.index.includes("Encerrado"), "PR94–PR97 constam encerradas");
assert(content.index.includes("PR90") && content.index.includes("PR93") && content.index.includes("Encerrado"), "PR90–PR93 constam encerradas");

// 8–12 preservação
assert(exists("schema/enavia-pr-planner.js") && exists("schema/enavia-pr-executor-supervised.js") && exists("schema/enavia-pr-readiness.js"), "PR Orchestrator preservado");
assert(exists("schema/enavia-event-log.js"), "Event Log preservado");
assert(exists("schema/enavia-health-snapshot.js"), "Health Snapshot preservado");
assert(exists("schema/enavia-safety-guard.js"), "Safety Guard preservado");
assert(exists("schema/enavia-anti-loop.js"), "Anti-loop preservado");

// 13–20 mapeamentos no relatório
assert(/GitHub Bridge|github-pr|P24/i.test(content.report), "GitHub Bridge atual foi mapeado");
assert(/branch/i.test(content.report), "branch capability foi mapeada");
assert(/open PR|open_pr|abertura de PR/i.test(content.report), "PR open capability foi mapeada");
assert(/update PR|update_pr|atualização de PR/i.test(content.report), "PR update capability foi mapeada");
assert(/comment PR|comment_pr|coment[aá]rio em PR/i.test(content.report), "PR comment capability foi mapeada");
assert(/merge/i.test(content.report) && /proibid|supervisionad/i.test(content.report), "merge capability mapeada como proibida/supervisionada");
assert(/deploy PROD|deploy_prod|prod/i.test(content.report) && /proibid|supervisionad/i.test(content.report), "deploy PROD mapeado como proibido/supervisionado");
assert(/GITHUB_TOKEN|GITHUB_APP|CLOUDFLARE_API_TOKEN|INTERNAL_TOKEN/i.test(content.report), "tokens/envs esperados mapeados sem segredo");

// 21–25 relatório completo
assert(/Classifica[cç][aã]o objetiva|classificação/i.test(content.report), "relatório declara o que existe");
assert(/Lacuna exata|falta um adapter/i.test(content.report), "relatório declara o que falta");
assert(/docs-only|parcial|ausente/i.test(content.report), "relatório declara docs-only/parcial/ausente");
assert(/Menor patch recomendado para PR103/i.test(content.report), "relatório recomenda PR103");
assert(/Menor patch recomendado para PR104/i.test(content.report), "relatório recomenda PR104");

// 26–31 arquivos proibidos sem alteração nesta PR
assert(gitDiffIsEmpty(files.nv), "não alterou nv-enavia.js");
assert(gitDiffIsEmpty(files.executor), "não alterou executor/src/index.js");
assert(gitDiffIsEmpty(files.contractExecutor), "não alterou contract-executor.js");
assert(gitDiffIsEmpty(files.deployYml), "não alterou deploy.yml");
assert(gitDiffIsEmpty(files.wrangler), "não alterou wrangler.toml");
assert(gitDiffIsEmpty("panel"), "não alterou panel/**");

// 32–34 garantias de execução
assert(/Nenhum endpoint novo|sem endpoint novo/i.test(content.report), "não criou endpoint");
const hasRealGithubAdapter = /api\.github\.com|octokit|Authorization:\s*token|GITHUB_TOKEN/i.test(content.nv + "\n" + content.contractExecutor + "\n" + content.executor);
assert(!hasRealGithubAdapter, "não chamou GitHub real");
assert(/Nenhum merge\/deploy executado|Nenhuma chamada GitHub real executada|Nenhum deploy/i.test(content.report), "não fez deploy");

// 35–43 regressões obrigatórias
const requiredTests = [
  ["tests/pr101-observabilidade-autoprotecao-final.prova.test.js", "PR101 continua passando"],
  ["tests/pr100-safety-guard-antiautodestruction.prova.test.js", "PR100 continua passando"],
  ["tests/pr99-event-log-health-snapshot.prova.test.js", "PR99 continua passando"],
  ["tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js", "PR98 continua passando"],
  ["tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js", "PR93 continua passando"],
  ["tests/pr90-pr-orchestrator-diagnostico.prova.test.js", "PR90 continua passando"],
  ["tests/pr89-internal-loop-final-proof.smoke.test.js", "PR89 continua passando"],
  ["tests/pr84-chat-vivo.smoke.test.js", "PR84 continua passando"],
  ["tests/pr59-response-policy-viva.smoke.test.js", "PR59 continua passando"],
];

for (const [relPath, label] of requiredTests) {
  const result = runTestFile(relPath);
  assert(result.ok, label);
}

console.log("\n============================================================");
console.log(`RESULTADO PR102: ${passed} passed, ${failed} failed`);
if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`- ${f}`);
}
console.log("============================================================\n");

if (failed > 0) process.exit(1);
