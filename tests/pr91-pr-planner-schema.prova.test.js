// 🧪 PR91 — PR Planner schema/modelo + helper puro
// Run: node tests/pr91-pr-planner-schema.prova.test.js

const fs = require("node:fs");
const { spawnSync } = require("node:child_process");

const planner = require("../schema/enavia-pr-planner.js");

let PASSED = 0;
let FAILED = 0;

function section(title) {
  console.log(`\n── ${title} ──`);
}

function ok(condition, label, details = "") {
  if (condition) {
    PASSED += 1;
    console.log(`  ✅ ${label}`);
    return;
  }
  FAILED += 1;
  console.log(`  ❌ ${label}`);
  if (details) console.log(`     ↳ ${details}`);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function runNodeTest(testPath) {
  const result = spawnSync("node", [testPath], { encoding: "utf8" });
  return {
    ok: result.status === 0,
    status: result.status,
    output: `${result.stdout || ""}\n${result.stderr || ""}`.trim(),
  };
}

console.log("\n🧪 PR91 — PR Planner\n");

const sampleInput = {
  request: "Implementar PR Planner supervisionado PR91 no repo nv-enavia sem execucao GitHub real",
  objective: "Criar pacote PR-ready interno com guardrails",
  scope: "schema/modelo + helper puro + testes + docs/governanca minima",
  files_to_change: [
    "schema/enavia-pr-planner.js",
    "tests/pr91-pr-planner-schema.prova.test.js",
    "schema/reports/PR91_PR_PLANNER.md",
  ],
  patch_plan: [
    "Criar helper puro PR Planner.",
    "Criar teste de prova com cenarios minimos.",
    "Atualizar docs/governanca minima.",
  ],
  tests_to_run: [
    "node tests/pr91-pr-planner-schema.prova.test.js",
    "node tests/pr90-pr-orchestrator-diagnostico.prova.test.js",
  ],
  rollback_plan: [
    "Reverter commit da PR91.",
    "Reexecutar regressao obrigatoria.",
  ],
  acceptance_criteria: [
    "Pacote PR-ready valido.",
    "Sem execucao GitHub real.",
    "Sem alteracao de runtime vivo.",
  ],
};

const pkg = planner.buildPrReadyPackage(sampleInput);

section("1-6 API do helper");
ok(typeof planner === "object", "1. helper existe");
ok(typeof planner.buildPrReadyPackage === "function", "2. buildPrReadyPackage existe");
ok(typeof planner.validatePrReadyPackage === "function", "3. validatePrReadyPackage existe");
ok(typeof planner.normalizePrBranchName === "function", "4. normalizePrBranchName existe");
ok(typeof planner.classifyPrRisk === "function", "5. classifyPrRisk existe");
ok(typeof planner.buildPrBody === "function", "6. buildPrBody existe");

section("7-28 pacote valido e shape");
ok(pkg.ok === true, "7. pacote minimo valido retorna ok=true", JSON.stringify(pkg.errors || []));
ok(pkg.mode === "pr_planner", "8. mode = pr_planner");
ok(/^codex\/[a-z0-9][a-z0-9\/-]*$/.test(pkg.branch_name), "9. branch_name seguro", pkg.branch_name);
ok(Array.isArray(pkg.files_to_change), "10. files_to_change array");
ok(Array.isArray(pkg.patch_plan) || typeof pkg.patch_plan === "string", "11. patch_plan array/string estruturado");
ok(Array.isArray(pkg.tests_to_run), "12. tests_to_run array");
ok(Array.isArray(pkg.rollback_plan) || typeof pkg.rollback_plan === "string", "13. rollback_plan array/string estruturado");
ok(Array.isArray(pkg.acceptance_criteria), "14. acceptance_criteria array");
ok(typeof pkg.pr_title === "string" && pkg.pr_title.length > 0 && pkg.pr_title.length <= 120, "15. pr_title string curta", pkg.pr_title);
ok(pkg.pr_body.toLowerCase().includes("objetivo"), "16. pr_body contem objetivo");
ok(pkg.pr_body.toLowerCase().includes("escopo"), "17. pr_body contem escopo");
ok(pkg.pr_body.toLowerCase().includes("testes"), "18. pr_body contem testes");
ok(pkg.pr_body.toLowerCase().includes("rollback"), "19. pr_body contem rollback");
ok(pkg.pr_body.toLowerCase().includes("criterios de aceite"), "20. pr_body contem criterios de aceite");
ok(pkg.ready_for_human_review === true, "21. ready_for_human_review=true em pacote valido");
ok(pkg.awaiting_human_approval === true, "22. awaiting_human_approval=true");
ok(pkg.merge_allowed === false, "23. merge_allowed=false");
ok(pkg.prod_deploy_allowed === false, "24. prod_deploy_allowed=false");
ok(pkg.github_execution === false, "25. github_execution=false");
ok(pkg.side_effects === false, "26. side_effects=false");
ok(["low", "medium", "high", "blocking"].includes(pkg.risk_level), "27. risk_level valido", pkg.risk_level);
const stableBranchA = planner.normalizePrBranchName(sampleInput);
const stableBranchB = planner.normalizePrBranchName(sampleInput);
ok(stableBranchA === stableBranchB, "28. branch_name deterministico para mesmo input");

section("29-35 bloqueios e erro controlado");
const blockedMerge = planner.buildPrReadyPackage({ request: "fazer merge automatico na main sem aprovacao" });
const blockedProd = planner.buildPrReadyPackage({ request: "fazer deploy prod automatico agora" });
const blockedSecrets = planner.buildPrReadyPackage({ request: "use secrets e token de producao" });
const blockedRepo = planner.buildPrReadyPackage({ request: "aplicar patch em outro repo externo" });
const blockedEnova = planner.buildPrReadyPackage({ request: "fazer ajuste no sistema Enova" });
const blockedBrowser = planner.buildPrReadyPackage({ request: "executar browser action com playwright" });

ok(blockedMerge.ok === false && blockedMerge.risk_level === "blocking", "29. pedido de merge automatico bloqueia");
ok(blockedProd.ok === false && blockedProd.risk_level === "blocking", "30. pedido de deploy PROD automatico bloqueia");
ok(blockedSecrets.ok === false && blockedSecrets.risk_level === "blocking", "31. pedido envolvendo secrets bloqueia");
ok(blockedRepo.ok === false && blockedRepo.risk_level === "blocking", "32. pedido em outro repo bloqueia");
ok(blockedEnova.ok === false && blockedEnova.risk_level === "blocking", "33. pedido envolvendo Enova bloqueia");
ok(blockedBrowser.ok === false && blockedBrowser.risk_level === "blocking", "34. pedido com browser action bloqueia");

const invalidPkg = planner.validatePrReadyPackage({ mode: "pr_planner" });
ok(invalidPkg.ok === false && asArray(invalidPkg.errors).length > 0, "35. pacote invalido retorna ok=false com erro controlado", JSON.stringify(invalidPkg.errors));

section("36-41 isolamento e side effects");
const plannerSource = fs.readFileSync("schema/enavia-pr-planner.js", "utf8");

ok(!/nv-enavia\.js/.test(plannerSource), "36. nao importa/usa nv-enavia.js");
ok(!/executor\/src\/index\.js/.test(plannerSource), "37. nao importa/usa executor/src/index.js");
ok(!/contract-executor\.js/.test(plannerSource), "38. nao importa/usa contract-executor.js");
ok(!/\bfetch\s*\(/.test(plannerSource), "39. nao chama fetch");
ok(!/child_process/.test(plannerSource), "40. nao usa child_process");
ok(!/fs\.write|writeFileSync|appendFileSync|createWriteStream/.test(plannerSource), "41. nao usa fs write/runtime");

section("42-48 regressao obrigatoria");
const regressions = [
  ["42. PR90 continua passando", "tests/pr90-pr-orchestrator-diagnostico.prova.test.js"],
  ["43. PR89 continua passando", "tests/pr89-internal-loop-final-proof.smoke.test.js"],
  ["44. PR88 continua passando", "tests/pr88-worker-executor-stitch.smoke.test.js"],
  ["45. PR87 continua passando", "tests/pr87-deploy-test-finalize-runner.smoke.test.js"],
  ["46. PR86 continua passando", "tests/pr86-deploy-orchestrator-gap.prova.test.js"],
  ["47. executor.contract continua passando", "executor/tests/executor.contract.test.js"],
  ["48. cloudflare-credentials continua passando", "executor/tests/cloudflare-credentials.test.js"],
];

for (const [label, path] of regressions) {
  const result = runNodeTest(path);
  ok(result.ok, label, `status=${result.status}`);
}

section("49-52 docs/governanca");
const reportText = fs.readFileSync("schema/reports/PR91_PR_PLANNER.md", "utf8");
const indexText = fs.readFileSync("schema/contracts/INDEX.md", "utf8");

ok(/o que foi implementado/i.test(reportText), "49. relatorio PR91 declara o que foi implementado");
ok(/o que nao foi mexido/i.test(reportText), "50. relatorio PR91 declara o que nao foi mexido");
ok(/o que fica para PR92/i.test(reportText), "51. relatorio PR91 declara o que fica para PR92");
ok(
  /pr[oó]xima PR autorizada:\s*PR92\s*—\s*PR Executor supervisionado/i.test(indexText) ||
  /PR92.*conclu[ií]da/i.test(indexText),
  "52. INDEX.md registra PR92 (como proxima ou como concluida apos avanco)"
);

console.log(`\nRESULTADO PR91: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) process.exit(1);
