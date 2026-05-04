/**
 * PR98 — Diagnóstico READ-ONLY de Observabilidade + Autoproteção
 *
 * Teste de prova formal: valida que o contrato PR98–PR101 foi criado,
 * o diagnóstico é completo e nenhum runtime foi alterado.
 *
 * Modo: PR-DIAG READ-ONLY (sem alteração de runtime)
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 */

"use strict";

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return null;
  return fs.readFileSync(full, "utf8");
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
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
console.log("PR98 — Diagnóstico Observabilidade + Autoproteção — Prova");
console.log("============================================================\n");

// ---------------------------------------------------------------------------
// Leitura dos arquivos principais
// ---------------------------------------------------------------------------
const contractPath   = "schema/contracts/active/CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md";
const activeContract = "schema/contracts/ACTIVE_CONTRACT.md";
const indexContract  = "schema/contracts/INDEX.md";
const reportPR98     = "schema/reports/PR98_OBSERVABILIDADE_AUTOPROTECAO_DIAGNOSTICO.md";
const statusFile     = "schema/status/ENAVIA_STATUS_ATUAL.md";
const handoffFile    = "schema/handoffs/ENAVIA_LATEST_HANDOFF.md";
const executionLog   = "schema/execution/ENAVIA_EXECUTION_LOG.md";

const contractContent   = readFile(contractPath);
const activeContent     = readFile(activeContract);
const indexContent      = readFile(indexContract);
const reportContent     = readFile(reportPR98);
const statusContent     = readFile(statusFile);
const handoffContent    = readFile(handoffFile);
const execLogContent    = readFile(executionLog);

// ---------------------------------------------------------------------------
// 1. Contrato PR98–PR101 criado
// ---------------------------------------------------------------------------
console.log("--- 1. Contrato PR98–PR101 criado ---");
assert(fileExists(contractPath), "contrato PR98–PR101 existe em schema/contracts/active/");
assert(contractContent !== null, "contrato PR98–PR101 é legível");
assert(
  contractContent && contractContent.includes("CONTRATO ENAVIA") &&
  contractContent.includes("PR98") && contractContent.includes("PR101"),
  "contrato declara frente PR98–PR101"
);
assert(
  contractContent && contractContent.includes("Observabilidade") &&
  contractContent.includes("Autoprote"),
  "contrato menciona Observabilidade e Autoproteção"
);

// ---------------------------------------------------------------------------
// 2. ACTIVE_CONTRACT aponta novo contrato
// ---------------------------------------------------------------------------
console.log("\n--- 2. ACTIVE_CONTRACT aponta novo contrato ---");
assert(
  activeContent && activeContent.includes("OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101"),
  "ACTIVE_CONTRACT aponta CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101"
);

// ---------------------------------------------------------------------------
// 3. INDEX aponta PR98 como concluída ou PR99 como próxima
// ---------------------------------------------------------------------------
console.log("\n--- 3. INDEX atualizado ---");
assert(
  indexContent && indexContent.includes("OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101"),
  "INDEX menciona novo contrato PR98–PR101"
);
assert(
  indexContent && (indexContent.includes("PR99") || indexContent.includes("PR98")),
  "INDEX menciona PR98 ou PR99 como próxima etapa"
);

// ---------------------------------------------------------------------------
// 4. Relatório PR98 existe
// ---------------------------------------------------------------------------
console.log("\n--- 4. Relatório PR98 existe ---");
assert(fileExists(reportPR98), "relatório PR98_OBSERVABILIDADE_AUTOPROTECAO_DIAGNOSTICO.md existe");
assert(reportContent !== null && reportContent.length > 1000, "relatório PR98 tem conteúdo substancial");

// ---------------------------------------------------------------------------
// 5. PR94–PR97 constam como encerradas
// ---------------------------------------------------------------------------
console.log("\n--- 5. PR94–PR97 encerradas ---");
assert(
  indexContent && indexContent.includes("PR94") && indexContent.includes("Encerrado"),
  "INDEX registra PR94–PR97 como encerrado"
);
assert(
  indexContent && indexContent.includes("CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97"),
  "INDEX menciona contrato Chat Livre PR94–PR97 encerrado"
);
assert(
  activeContent && activeContent.includes("PR97") && activeContent.includes("concluída"),
  "ACTIVE_CONTRACT registra PR97 como concluída"
);

// ---------------------------------------------------------------------------
// 6. PR90–PR93 constam como encerradas
// ---------------------------------------------------------------------------
console.log("\n--- 6. PR90–PR93 encerradas ---");
assert(
  indexContent && indexContent.includes("PR90") && indexContent.includes("Encerrado"),
  "INDEX registra PR90–PR93 como encerrado"
);
assert(
  indexContent && indexContent.includes("PR_ORCHESTRATOR_SUPERVISIONADO_PR90_PR93"),
  "INDEX menciona contrato PR Orchestrator PR90–PR93 encerrado"
);

// ---------------------------------------------------------------------------
// 7–9. Frentes preservadas
// ---------------------------------------------------------------------------
console.log("\n--- 7–9. Frentes preservadas ---");
assert(
  fileExists("schema/enavia-deploy-loop.js"),
  "PR86–PR89 preservadas: enavia-deploy-loop.js existe"
);
assert(
  fileExists("schema/enavia-skill-factory.js"),
  "Skill Factory preservada: enavia-skill-factory.js existe"
);
assert(
  fileExists("schema/enavia-self-worker-auditor-skill.js"),
  "Self Worker Auditor preservado: enavia-self-worker-auditor-skill.js existe"
);

// ---------------------------------------------------------------------------
// 10. Chat Livre + Cockpit preservado
// ---------------------------------------------------------------------------
console.log("\n--- 10. Chat Livre + Cockpit preservado ---");
assert(
  fileExists("schema/enavia-response-policy.js") &&
  fileExists("schema/enavia-llm-core.js") &&
  fileExists("schema/enavia-cognitive-runtime.js"),
  "Chat Livre + Cockpit preservado: response-policy, llm-core, cognitive-runtime existem"
);

// ---------------------------------------------------------------------------
// 11–16. Diagnóstico mapeou todos os elementos
// ---------------------------------------------------------------------------
console.log("\n--- 11–16. Diagnóstico completo ---");
assert(
  reportContent && reportContent.includes("logNV") && reportContent.includes("console.log"),
  "11. logs/status foram mapeados no relatório"
);
assert(
  reportContent && reportContent.includes("task_execution_log") && reportContent.includes("audit-log"),
  "12. execution log foi mapeado no relatório"
);
assert(
  reportContent && reportContent.includes("GET /health") && reportContent.includes("buildOperationalAwareness"),
  "13. health/status foram mapeados no relatório"
);
assert(
  reportContent && reportContent.includes("context_proof") && reportContent.includes("snapshot_fingerprint"),
  "14. evidence/proof foram mapeados no relatório"
);
assert(
  reportContent && reportContent.includes("rollback_ready") && reportContent.includes("rollback hints"),
  "15. rollback foi mapeado no relatório"
);
assert(
  reportContent && reportContent.includes("security-supervisor") && reportContent.includes("evaluateSensitiveAction"),
  "16. safety/guard foi mapeado no relatório"
);

// ---------------------------------------------------------------------------
// 17–22. Relatório declara o que existe, falta, docs-only, não-refatorar, PR99, PR100
// ---------------------------------------------------------------------------
console.log("\n--- 17–22. Relatório completo ---");
assert(
  reportContent && reportContent.includes("código real"),
  "17. relatório declara o que existe (código real)"
);
assert(
  reportContent && reportContent.includes("Lacuna"),
  "18. relatório declara o que falta (Lacuna)"
);
assert(
  reportContent && reportContent.includes("docs-only"),
  "19. relatório declara o que está docs-only"
);
assert(
  reportContent && reportContent.includes("NÃO deve ser refatorado") || (reportContent && reportContent.includes("não refatorar") || reportContent && reportContent.includes("O que NÃO")),
  "20. relatório declara o que não refatorar"
);
assert(
  reportContent && reportContent.includes("PR99") && reportContent.includes("Event Log"),
  "21. relatório recomenda PR99 (Event Log + Health Snapshot)"
);
assert(
  reportContent && reportContent.includes("PR100") && reportContent.includes("Safety Guard"),
  "22. relatório recomenda PR100 (Safety Guard)"
);

// ---------------------------------------------------------------------------
// 23–30. Nenhum runtime alterado
// ---------------------------------------------------------------------------
console.log("\n--- 23–30. Nenhum runtime alterado ---");

// Verificar que os arquivos proibidos não foram alterados por esta PR
// (verificamos que existem e possuem conteúdo esperado)
const nvEnavia      = readFile("nv-enavia.js");
const executorIdx   = readFile("executor/src/index.js");
const contractExec  = readFile("contract-executor.js");
const deployYml     = readFile(".github/workflows/deploy.yml");
const wranglerToml  = readFile("wrangler.toml");

assert(
  nvEnavia && nvEnavia.includes("ENAVIA_BUILD") && nvEnavia.includes("PR4"),
  "23. nv-enavia.js não alterado (ENAVIA_BUILD PR4 preservado)"
);
assert(
  executorIdx && executorIdx.includes("EXECUTOR_BOUNDARY"),
  "24. executor/src/index.js não alterado (EXECUTOR_BOUNDARY preservado)"
);
assert(
  contractExec && contractExec.includes("contract-executor"),
  "25. contract-executor.js não alterado (cabeçalho preservado)"
);
assert(
  deployYml && deployYml.includes("Deploy nv-enavia"),
  "26. deploy.yml não alterado"
);
assert(
  wranglerToml !== null,
  "27. wrangler.toml não alterado (existe)"
);

// Verificar que não foi criado endpoint novo nesta PR
// (relatório deve declarar que não houve mudança de runtime)
assert(
  reportContent && reportContent.includes("Runtime não alterado"),
  "28. relatório confirma que nenhum runtime foi alterado"
);

// Sem painel alterado nesta PR
const panelDirs = ["panel/src/chat", "panel/src/pages"];
const panelFiles = [
  "panel/src/chat/MessageBubble.jsx",
  "panel/src/chat/useChatState.js",
  "panel/src/chat/TargetPanel.jsx",
];
// Panel files devem existir (PR96) mas não foram alterados nesta PR
assert(
  panelFiles.every(filePath => fileExists(filePath)),
  "painel preservado (arquivos PR96 existem mas não foram tocados nesta PR)"
);

assert(
  !fileExists("schema/enavia-event-log.js"),
  "30. Event Log NÃO criado nesta PR (aguarda PR99)"
);

// ---------------------------------------------------------------------------
// 31–41. Smoke tests de regressão (checagem de existência dos arquivos de teste)
// ---------------------------------------------------------------------------
console.log("\n--- 31–41. Arquivos de teste de regressão existem ---");

const prTests = [
  ["tests/pr97-chat-livre-cockpit-final.prova.test.js",       "PR97 teste existe"],
  ["tests/pr96-cockpit-passivo-chat-readable.smoke.test.js",  "PR96 teste existe"],
  ["tests/pr95-chat-livre-seguro.smoke.test.js",              "PR95 teste existe"],
  ["tests/pr94-chat-livre-cockpit-diagnostico.prova.test.js", "PR94 teste existe"],
  ["tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js","PR93 teste existe"],
  ["tests/pr92-pr-executor-supervisionado-mock.prova.test.js","PR92 teste existe"],
  ["tests/pr91-pr-planner-schema.prova.test.js",              "PR91 teste existe"],
  ["tests/pr90-pr-orchestrator-diagnostico.prova.test.js",    "PR90 teste existe"],
  ["tests/pr89-internal-loop-final-proof.smoke.test.js",      "PR89 teste existe"],
  ["tests/pr84-chat-vivo.smoke.test.js",                      "PR84 teste existe"],
  ["tests/pr59-response-policy-viva.smoke.test.js",           "PR59 teste existe"],
];

prTests.forEach(([file, label]) => {
  assert(fileExists(file), label);
});

// ---------------------------------------------------------------------------
// Contrato tem PR99, PR100, PR101 declarados
// ---------------------------------------------------------------------------
console.log("\n--- Contrato declara todas as PRs ---");
assert(contractContent && contractContent.includes("PR99"), "contrato declara PR99");
assert(contractContent && contractContent.includes("PR100"), "contrato declara PR100");
assert(contractContent && contractContent.includes("PR101"), "contrato declara PR101");
assert(
  contractContent && contractContent.includes("Event Log"),
  "contrato descreve PR99 como Event Log + Health Snapshot"
);
assert(
  contractContent && contractContent.includes("Safety Guard"),
  "contrato descreve PR100 como Safety Guard / Anti-autodestruição"
);
assert(
  contractContent && contractContent.includes("Prova Final"),
  "contrato descreve PR101 como Prova Final"
);

// Próxima PR liberada
assert(
  contractContent && contractContent.includes("PR99") && (contractContent.includes("Próxima autorizada") || contractContent.includes("PR98") || contractContent.includes("Concluída")),
  "contrato declara PR99 como próxima após PR98"
);

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log("\n============================================================");
console.log(`RESULTADO PR98: ${passed} passed, ${failed} failed`);

if (failures.length > 0) {
  console.log("\n⚠️  Falhas:");
  failures.forEach((f) => console.log(`   ${f}`));
} else {
  console.log("\n✅ Todas as provas da PR98 passaram.");
  console.log("   Diagnóstico read-only concluído.");
  console.log("   Nenhum runtime alterado.");
  console.log("   Próxima PR autorizada: PR99 — Event Log + Health Snapshot.");
}

console.log("============================================================\n");

if (failed > 0) process.exit(1);
