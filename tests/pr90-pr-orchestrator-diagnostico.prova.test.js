// 🧪 PR90 — Diagnóstico READ-ONLY do PR Orchestrator
// Run: node tests/pr90-pr-orchestrator-diagnostico.prova.test.js

const fs = require("node:fs");

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

function read(path) {
  try {
    return fs.readFileSync(path, "utf8");
  } catch (_) {
    return "";
  }
}

function exists(path) {
  return fs.existsSync(path);
}

const paths = {
  activeContract: "schema/contracts/ACTIVE_CONTRACT.md",
  index: "schema/contracts/INDEX.md",
  contract: "schema/contracts/active/CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md",
  report: "schema/reports/PR90_PR_ORCHESTRATOR_DIAGNOSTICO.md",
  status: "schema/status/ENAVIA_STATUS_ATUAL.md",
  handoff: "schema/handoffs/ENAVIA_LATEST_HANDOFF.md",
  execLog: "schema/execution/ENAVIA_EXECUTION_LOG.md",
  worker: "nv-enavia.js",
  executor: "executor/src/index.js",
  contractExecutor: "contract-executor.js",
  deployYml: ".github/workflows/deploy.yml",
  deployExecutorYml: ".github/workflows/deploy-executor.yml",
  runbook: "schema/deploy/RUNBOOK_DEPLOY_LOOP.md",
  pr89Test: "tests/pr89-internal-loop-final-proof.smoke.test.js",
  pr89Report: "schema/reports/PR89_INTERNAL_LOOP_FINAL_PROOF.md",
  pr88Report: "schema/reports/PR88_WORKER_EXECUTOR_STITCH.md",
  pr87Report: "schema/reports/PR87_DEPLOY_TEST_FINALIZE_RUNNER.md",
  pr86Report: "schema/reports/PR86_DEPLOY_ORCHESTRATOR_GAP.md",
  githubArmContract: "schema/github-pr-arm-contract.js",
};

const text = Object.fromEntries(
  Object.entries(paths).map(([k, p]) => [k, read(p)])
);

console.log("\n🧪 PR90 — PR Orchestrator Diagnóstico READ-ONLY\n");

section("1–8 Base contratual e artefatos obrigatórios");
ok(
  text.activeContract.includes("CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93.md") && exists(paths.contract),
  "1. contrato PR90–PR93 ativo"
);
ok(
  (
    /PR90\s*—\s*Diagnóstico READ-ONLY do PR Orchestrator/i.test(text.activeContract) &&
    /PR90\s*—\s*Diagnóstico READ-ONLY do PR Orchestrator/i.test(text.index)
  ) || (
    /CONTRATO_ENAVIA_PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93/i.test(text.activeContract) &&
    /PR90.*conclu[ií]da/i.test(text.index)
  ),
  "2. PR90 é a próxima PR autorizada (ou já concluída)"
);
ok(
  /PR86\s*✅/i.test(text.index) && /PR87\s*✅/i.test(text.index) && /PR88\s*✅/i.test(text.index) && /PR89\s*✅/i.test(text.index),
  "3. PR86–PR89 aparecem como base concluída"
);
ok(exists(paths.worker), "4. existe Worker (nv-enavia.js)");
ok(exists(paths.executor), "5. existe Executor (executor/src/index.js)");
ok(exists(paths.contractExecutor), "6. existe contract-executor.js");
ok(exists(paths.deployYml), "7. existe deploy.yml");
ok(exists(paths.deployExecutorYml), "8. existe deploy-executor.yml (não ausente)");

section("9–13 Loop interno, execução e IDs");
ok(
  /deploy_test/i.test(text.pr89Test) && /finalize/i.test(text.pr89Test) && /loop interno/i.test(text.pr89Report),
  "9. loop interno até finalize foi provado na PR89"
);
ok(
  /handleExecuteNext/.test(text.worker) &&
    /\/contracts\/execute-next/.test(text.worker) &&
    /\/contracts\/loop-status/.test(text.worker),
  "10. existem rotas/funções atuais ligadas a execução"
);
ok(
  /callDeployBridge/.test(text.worker) &&
    /deploy_test/.test(text.executor) &&
    /workflow_dispatch/.test(text.deployYml),
  "11. existem rotas/funções atuais ligadas a deploy/test"
);
ok(
  /status/i.test(text.execLog) &&
    /log/i.test(text.execLog) &&
    /execution_id/.test(text.worker) &&
    /execution_id/.test(text.executor),
  "12. existe mecanismo de status/log/execution_id"
);
ok(
  /contract_id/.test(text.worker) && /contract_id/.test(text.contractExecutor),
  "13. existe mecanismo de contract_id"
);

section("14–21 GitHub/PR e deploy supervisionado");
const hasGithubRuntimeSurface =
  /\/github-pr\/action/.test(text.worker) &&
  /executeGitHubPrAction/.test(text.contractExecutor) &&
  /open_branch/.test(text.githubArmContract);
const hasRealGithubApiMarkers =
  /api\.github\.com|octokit|Authorization:\s*token|GITHUB_TOKEN/i.test(
    text.worker + "\n" + text.contractExecutor + "\n" + text.githubArmContract
  );
ok(
  hasGithubRuntimeSurface && !hasRealGithubApiMarkers,
  "14. existe bridge GitHub/PR contratual; integração GitHub real nova não existe"
);
ok(
  /open_branch/.test(text.githubArmContract) && !hasRealGithubApiMarkers,
  "15. criação de branch: parcial (contratual), sem execução real"
);
ok(
  /open_pr/.test(text.githubArmContract) && !hasRealGithubApiMarkers,
  "16. abertura de PR: parcial (contratual), sem execução real"
);
ok(
  /update_pr/.test(text.githubArmContract) && !hasRealGithubApiMarkers,
  "17. atualização de PR: parcial (contratual), sem execução real"
);
ok(
  /ready_for_merge/.test(text.contract) &&
    !/ready_for_merge/.test(text.worker + "\n" + text.contractExecutor + "\n" + text.executor),
  "18. ready_for_merge existe só em contrato (docs-only no runtime atual)"
);
ok(
  /callDeployBridge/.test(text.worker) &&
    /target_env:\s*"test"/.test(text.worker) &&
    /workflow_dispatch/.test(text.deployYml),
  "19. existe capacidade de disparar deploy TEST (bridge/workflow supervisionado)"
);
ok(
  /confirm_prod/.test(text.deployYml) &&
    /Ação \"\$\{action\}\" para produção bloqueada|PROD_ACTIONS/.test(text.worker + text.deployYml),
  "20. existe gate humano para PROD"
);
ok(
  /Rollback/.test(text.runbook) && /rollback/.test(text.worker + text.executor),
  "21. existe rollback supervisionado (runbook + runtime guardrails)"
);

section("22–26 Guardrails de governança");
ok(
  /if:\s*\$\{\{ github\.event\.inputs\.target_env == 'prod' \}\}/.test(text.deployYml) &&
    !/\bpush:\b[\s\S]*branches:/m.test(text.deployYml),
  "22. deploy PROD automático continua proibido"
);
ok(
  /merge_without_approval/.test(text.githubArmContract) &&
    !/git\s+merge|merge\s+--/.test(text.worker + "\n" + text.contractExecutor),
  "23. merge automático continua proibido"
);
ok(
  /secrets\./.test(text.deployYml + text.deployExecutorYml) &&
    /NUNCA imprimir IDs/.test(text.deployExecutorYml),
  "24. secrets não são expostos"
);
ok(
  /painel[\s\S]*necessário para PR90/i.test(text.report),
  "25. painel não é necessário para PR90"
);
ok(
  /Escopo exclusivo:\s*`nv-enavia`/i.test(text.contract) &&
    /não cobre integração multi-repo/i.test(text.contract),
  "26. outros repos ficam fora de escopo"
);

section("27–30 Consistência do relatório PR90");
ok(/declara objetivamente o que \*\*existe\*\*/i.test(text.report), "27. relatório PR90 declara o que existe");
ok(/declara objetivamente o que \*\*falta\*\*/i.test(text.report), "28. relatório PR90 declara o que falta");
ok(/Menor patch recomendado para PR91/i.test(text.report), "29. relatório PR90 declara menor patch recomendado para PR91");
ok(/O que NÃO deve ser refatorado/i.test(text.report), "30. relatório PR90 declara o que NÃO deve ser refatorado");

console.log(`\nRESULTADO PR90: ${PASSED} passed, ${FAILED} failed`);
if (FAILED > 0) process.exit(1);
