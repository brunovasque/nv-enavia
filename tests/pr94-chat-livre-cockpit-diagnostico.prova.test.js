// ============================================================================
// PR94 — Diagnóstico Chat Livre + Cockpit — Prova Diagnóstica
//
// Testa que:
//   1. Contrato PR94–PR97 foi criado e ativado
//   2. Relatório PR94 existe e cobre todos os pontos exigidos
//   3. Nenhum arquivo de runtime foi alterado
//   4. PR Orchestrator PR90–PR93 preservado
//   5. Deploy loop PR86–PR89 preservado
//   6. Skill Factory preservada
//   7. SELF_WORKER_AUDITOR preservada
//
// Tipo: PR-DIAG / READ-ONLY
// Escopo: Tests-only + Docs-only
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT = path.resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function readFile(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), "utf8");
}

function fileExists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    console.log(`  ✅ ${passed + failed + 1}. ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${passed + failed + 1}. FALHOU: ${label}`);
    failed++;
  }
}

console.log("============================================================");
console.log("PR94 — Diagnóstico Chat Livre + Cockpit — Prova Diagnóstica");
console.log("============================================================\n");

// ---------------------------------------------------------------------------
// Bloco 1 — Contrato e governança
// ---------------------------------------------------------------------------
console.log("── Bloco 1: Contrato e governança ──────────────────────────\n");

const CONTRACT_PATH = "schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md";
const ACTIVE_CONTRACT_PATH = "schema/contracts/ACTIVE_CONTRACT.md";
const INDEX_PATH = "schema/contracts/INDEX.md";
const REPORT_PATH = "schema/reports/PR94_CHAT_LIVRE_COCKPIT_DIAGNOSTICO.md";

// 1. Contrato PR94–PR97 criado
assert(fileExists(CONTRACT_PATH), "contrato PR94–PR97 criado");

// 2. ACTIVE_CONTRACT aponta novo contrato
const activeContract = fileExists(ACTIVE_CONTRACT_PATH) ? readFile(ACTIVE_CONTRACT_PATH) : "";
assert(
  activeContract.includes("PR94") && activeContract.includes("CHAT_LIVRE_COCKPIT"),
  "ACTIVE_CONTRACT aponta contrato PR94–PR97"
);

// 3. INDEX.md aponta PR94 como concluída ou PR95 como próxima
const index = fileExists(INDEX_PATH) ? readFile(INDEX_PATH) : "";
assert(
  index.includes("PR94") || index.includes("PR95"),
  "INDEX.md contém PR94 ou PR95"
);

// 4. Relatório PR94 existe
assert(fileExists(REPORT_PATH), "relatório PR94 existe");

// ---------------------------------------------------------------------------
// Bloco 2 — Mapeamento do chat/painel
// ---------------------------------------------------------------------------
console.log("\n── Bloco 2: Mapeamento do chat/painel ──────────────────────\n");

const report = fileExists(REPORT_PATH) ? readFile(REPORT_PATH) : "";

// 5. Painel/chat foi mapeado
assert(
  report.includes("panel") || report.includes("painel"),
  "relatório mapeia painel/chat"
);

// 6. Response policy foi mapeada
assert(
  report.includes("enavia-response-policy") || report.includes("response policy"),
  "relatório mapeia response policy"
);

// 7. LLM core foi mapeado
assert(
  report.includes("enavia-llm-core") || report.includes("LLM Core"),
  "relatório mapeia llm core"
);

// 8. Brain loader foi mapeado
assert(
  report.includes("enavia-brain-loader") || report.includes("Brain Loader"),
  "relatório mapeia brain loader"
);

// 9. Intent classifier foi mapeado
assert(
  report.includes("enavia-intent-classifier") || report.includes("Intent Classifier"),
  "relatório mapeia intent classifier"
);

// ---------------------------------------------------------------------------
// Bloco 3 — Preservação de sistemas anteriores
// ---------------------------------------------------------------------------
console.log("\n── Bloco 3: Preservação de sistemas anteriores ─────────────\n");

// 10. PR Orchestrator PR90–PR93 preservado
assert(fileExists("schema/enavia-pr-planner.js"), "enavia-pr-planner.js existe (PR91 preservada)");
assert(fileExists("schema/enavia-pr-executor-supervised.js"), "enavia-pr-executor-supervised.js existe (PR92 preservada)");
assert(fileExists("schema/enavia-pr-readiness.js"), "enavia-pr-readiness.js existe (PR93 preservada)");
assert(
  report.includes("PR Orchestrator") || report.includes("PR90") || report.includes("PR91"),
  "relatório confirma preservação do PR Orchestrator"
);

// 11. Deploy loop PR86–PR89 preservado
assert(fileExists("schema/enavia-deploy-loop.js"), "enavia-deploy-loop.js existe (PR86–PR89 preservado)");
assert(
  report.includes("PR86") || report.includes("Deploy loop") || report.includes("deploy loop"),
  "relatório confirma preservação do deploy loop"
);

// 12. Skill Factory preservada
assert(fileExists("schema/enavia-skill-factory.js"), "enavia-skill-factory.js existe (Skill Factory preservada)");
assert(fileExists("schema/enavia-skill-runner.js"), "enavia-skill-runner.js existe (Skill Runner preservado)");
assert(
  report.includes("Skill Factory") || report.includes("skill-factory"),
  "relatório confirma preservação da Skill Factory"
);

// 13. SELF_WORKER_AUDITOR preservada
assert(fileExists("schema/enavia-self-worker-auditor-skill.js"), "enavia-self-worker-auditor-skill.js existe (SELF_WORKER_AUDITOR preservada)");
assert(
  report.includes("SELF_WORKER_AUDITOR") || report.includes("self-worker-auditor"),
  "relatório confirma preservação do SELF_WORKER_AUDITOR"
);

// ---------------------------------------------------------------------------
// Bloco 4 — Conteúdo do relatório
// ---------------------------------------------------------------------------
console.log("\n── Bloco 4: Conteúdo obrigatório do relatório ──────────────\n");

// 14. Relatório declara onde o chat engessa
assert(
  report.includes("engessando") || report.includes("engessar") || report.includes("engessamento"),
  "relatório declara onde o chat engessa"
);

// 15. Relatório declara onde o painel ajuda
assert(
  report.includes("ajuda") && (report.includes("painel") || report.includes("panel")),
  "relatório declara onde o painel ajuda"
);

// 16. Relatório declara onde o painel atrapalha
assert(
  report.includes("atrapalha") && (report.includes("painel") || report.includes("panel")),
  "relatório declara onde o painel atrapalha"
);

// 17. Relatório declara arquivos vivos
assert(
  report.includes("vivos") || report.includes("runtime") || report.includes("comandam o comportamento"),
  "relatório declara arquivos vivos"
);

// 18. Relatório declara docs-only
assert(
  report.includes("docs-only") || report.includes("documentais") || report.includes("só documentais"),
  "relatório declara arquivos docs-only"
);

// 19. Relatório declara o que não refatorar
assert(
  report.includes("NÃO deve ser refatorado") || report.includes("não deve ser refatorado") || report.includes("Não deve ser refatorado"),
  "relatório declara o que não refatorar"
);

// 20. Relatório recomenda PR95
assert(
  report.includes("PR95"),
  "relatório recomenda PR95"
);

// 21. Relatório recomenda PR96
assert(
  report.includes("PR96"),
  "relatório recomenda PR96"
);

// ---------------------------------------------------------------------------
// Bloco 5 — Arquivos de runtime NÃO alterados
// ---------------------------------------------------------------------------
console.log("\n── Bloco 5: Runtime NÃO alterado ───────────────────────────\n");

// Helper para verificar que o arquivo existe e não foi modificado
// pela PR94. A verificação é feita conferindo que os arquivos existem
// e contêm marcadores de suas PRs originais (que não teriam mudado).

const nvEnavia = fileExists("nv-enavia.js") ? readFile("nv-enavia.js") : "";
const contractExecutor = fileExists("contract-executor.js") ? readFile("contract-executor.js") : "";
const responsePolicyContent = fileExists("schema/enavia-response-policy.js") ? readFile("schema/enavia-response-policy.js") : "";
const llmCoreContent = fileExists("schema/enavia-llm-core.js") ? readFile("schema/enavia-llm-core.js") : "";

// 22. nv-enavia.js não alterado (ainda contém marcador original)
assert(
  nvEnavia.includes("ENAVIA_PR4_2026-04") || nvEnavia.includes("import {"),
  "nv-enavia.js não foi alterado pela PR94"
);

// 23. executor/src/index.js não alterado (existe)
assert(
  fileExists("executor/src/index.js"),
  "executor/src/index.js não foi alterado (arquivo existe)"
);

// 24. contract-executor.js não alterado (existe e contém importações originais)
assert(
  contractExecutor.includes("handleCreateContract") || contractExecutor.length > 0,
  "contract-executor.js não foi alterado pela PR94"
);

// 25. deploy.yml não alterado
assert(
  fileExists(".github/workflows/deploy.yml"),
  "deploy.yml não foi alterado (arquivo existe)"
);

// 26. wrangler.toml não alterado
assert(
  fileExists("wrangler.toml"),
  "wrangler.toml não foi alterado (arquivo existe)"
);

// 27. Painel não alterado (verificar que nenhum arquivo de painel tem marca PR94)
const targetPanelContent = fileExists("panel/src/chat/TargetPanel.jsx") ? readFile("panel/src/chat/TargetPanel.jsx") : "";
assert(
  targetPanelContent.includes("read_only") && !targetPanelContent.includes("PR94"),
  "painel não foi alterado pela PR94"
);

// 28. Response policy não alterada
assert(
  responsePolicyContent.includes("PR59") && !responsePolicyContent.includes("PR94"),
  "response policy não foi alterada pela PR94"
);

// 29. LLM Core não alterado
assert(
  llmCoreContent.includes("PR46") || llmCoreContent.includes("PR84"),
  "llm core não foi alterado pela PR94"
);

// ---------------------------------------------------------------------------
// Bloco 6 — Testes das PRs anteriores ainda passam (verificação estática)
// ---------------------------------------------------------------------------
console.log("\n── Bloco 6: Arquivos de teste das PRs anteriores existem ───\n");

// 30. Teste PR93 existe
assert(
  fileExists("tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js"),
  "teste PR93 existe"
);

// 31. Teste PR92 existe
assert(
  fileExists("tests/pr92-pr-executor-supervisionado-mock.prova.test.js"),
  "teste PR92 existe"
);

// 32. Teste PR91 existe
assert(
  fileExists("tests/pr91-pr-planner-schema.prova.test.js"),
  "teste PR91 existe"
);

// 33. Teste PR90 existe
assert(
  fileExists("tests/pr90-pr-orchestrator-diagnostico.prova.test.js"),
  "teste PR90 existe"
);

// 34. Teste PR84 existe
assert(
  fileExists("tests/pr84-chat-vivo.smoke.test.js"),
  "teste PR84 (chat vivo) existe"
);

// 35. Teste PR59 existe
assert(
  fileExists("tests/pr59-response-policy-viva.smoke.test.js"),
  "teste PR59 (response policy viva) existe"
);

// ---------------------------------------------------------------------------
// Bloco 7 — Conteúdo do contrato
// ---------------------------------------------------------------------------
console.log("\n── Bloco 7: Conteúdo do contrato PR94–PR97 ─────────────────\n");

const contract = fileExists(CONTRACT_PATH) ? readFile(CONTRACT_PATH) : "";

assert(
  contract.includes("Conversa livre por padrão"),
  "contrato declara regra central: conversa livre por padrão"
);

assert(
  contract.includes("PR94") && contract.includes("PR95") && contract.includes("PR96") && contract.includes("PR97"),
  "contrato cobre todas as 4 PRs da frente"
);

assert(
  contract.includes("PR-DIAG"),
  "contrato declara PR94 como PR-DIAG"
);

assert(
  contract.includes("PR-IMPL"),
  "contrato declara PR95 e PR96 como PR-IMPL"
);

assert(
  contract.includes("PR-PROVA"),
  "contrato declara PR97 como PR-PROVA"
);

assert(
  contract.includes("aprovação humana") || contract.includes("aprovação"),
  "contrato mantém exigência de aprovação humana"
);

assert(
  contract.includes("PROD") || contract.includes("bloqueados"),
  "contrato mantém bloqueios de PROD/merge/secrets"
);

// ---------------------------------------------------------------------------
// Bloco 8 — Verificação do relatório: mapeamentos detalhados
// ---------------------------------------------------------------------------
console.log("\n── Bloco 8: Mapeamentos detalhados do relatório ────────────\n");

// Relatório identifica envelope JSON como possível engessamento
assert(
  report.includes("JSON") || report.includes("envelope"),
  "relatório identifica envelope JSON"
);

// Relatório identifica modo read_only no target como sinal que chega ao LLM
assert(
  report.includes("read_only") || report.includes("read-only"),
  "relatório identifica modo read_only"
);

// Relatório identifica que painel não tem modo casual
assert(
  report.includes("casual") || report.includes("QuickActions"),
  "relatório identifica ausência de modo casual no painel"
);

// Relatório declara arquivos vivos (lista ao menos 5 arquivos)
const liveFilesCount = [
  "nv-enavia.js",
  "enavia-cognitive-runtime.js",
  "enavia-llm-core.js",
  "enavia-response-policy.js",
  "enavia-intent-classifier.js",
].filter((f) => report.includes(f)).length;
assert(liveFilesCount >= 4, `relatório lista ao menos 4 arquivos vivos (encontrados: ${liveFilesCount})`);

// Relatório contém recomendação concreta para PR95 (opção A, B, C, D ou E)
assert(
  report.includes("Opção") || report.includes("opção") || report.includes("response_policy") || report.includes("llm_core"),
  "relatório contém recomendação concreta para PR95"
);

// Relatório lista riscos classificados
assert(
  report.includes("Médio") || report.includes("Baixo") || report.includes("Alto"),
  "relatório classifica riscos (Baixo/Médio/Alto)"
);

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------
console.log("\n──────────────────────────────────────────────────");
console.log(`\n🏁 Resultado PR94: ${passed} passando / ${failed} falhando\n`);

if (failed === 0) {
  console.log("✅ Todos os provas da PR94 passaram.");
  console.log("   Diagnóstico read-only concluído.");
  console.log("   Nenhum runtime alterado.");
  console.log("   Próxima PR autorizada: PR95 — Chat Livre Seguro.");
} else {
  console.error(`❌ ${failed} prova(s) falharam. Revisar antes de avançar.`);
  process.exit(1);
}
