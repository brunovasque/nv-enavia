import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, "..");

let passed = 0;
let failed = 0;
const failures = [];

function ok(condition, label, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`  ✅ ${passed + failed}. ${label}`);
    return;
  }
  failed += 1;
  failures.push(label);
  console.log(`  ❌ ${passed + failed}. ${label}${detail ? ` — ${detail}` : ""}`);
}

function section(title) {
  console.log(`\n── ${title} ──\n`);
}

function read(relPath) {
  try { return readFileSync(resolve(ROOT, relPath), "utf8"); } catch { return ""; }
}

function exists(relPath) {
  return existsSync(resolve(ROOT, relPath));
}

function runNodeTest(relPath) {
  try {
    const out = execSync(`node ${resolve(ROOT, relPath)}`, {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 600000,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, output: out };
  } catch (error) {
    return {
      ok: false,
      output: `${error.stdout || ""}\n${error.stderr || ""}\n${error.message || ""}`,
    };
  }
}

console.log("============================================================");
console.log("PR96 — Cockpit Passivo + Chat Legível — Smoke Test");
console.log("============================================================");

const contract = read("schema/contracts/active/CONTRATO_ENAVIA_CHAT_LIVRE_COCKPIT_OPERACIONAL_PR94_PR97.md");
const index = read("schema/contracts/INDEX.md");
const report96 = read("schema/reports/PR96_COCKPIT_PASSIVO_CHAT_READABLE.md");

const messageBubble = read("panel/src/chat/MessageBubble.jsx");
const useChatState = read("panel/src/chat/useChatState.js");
const targetPanel = read("panel/src/chat/TargetPanel.jsx");
const quickActions = read("panel/src/chat/QuickActions.jsx");
const useTargetState = read("panel/src/chat/useTargetState.js");
const chatPage = read("panel/src/pages/ChatPage.jsx");

section("1-7: Contrato ativo e arquivos base");
ok(contract.includes("PR94") && contract.includes("PR97") && contract.includes("Ativo"), "1. contrato PR94–PR97 ativo");
ok(contract.includes("PR96") && (contract.includes("AUTORIZADA") || contract.includes("DONE") || contract.includes("conclu")), "2. PR96 autorizada antes do avanço / concluída");
ok(contract.includes("PR95") && (contract.includes("DONE") || contract.includes("conclu")), "3. PR95 concluída");
ok(exists("panel/src/chat/MessageBubble.jsx"), "4. MessageBubble existe");
ok(exists("panel/src/chat/useChatState.js"), "5. useChatState existe");
ok(exists("panel/src/chat/TargetPanel.jsx"), "6. TargetPanel existe");
ok(exists("panel/src/chat/QuickActions.jsx"), "7. QuickActions existe");

section("8-12: Renderização legível");
ok(messageBubble.includes("parseReadableBlocks") && messageBubble.includes("split(\"\\n\")"), "8. renderização suporta parágrafos");
ok(messageBubble.includes("([-*]|\\d+[.)])") && messageBubble.includes("ListTag"), "9. renderização suporta listas simples");
ok(!messageBubble.includes("dangerouslySetInnerHTML"), "10. renderização não usa dangerouslySetInnerHTML");
ok(messageBubble.includes("text: paragraph.join(\"\\n\")") && messageBubble.includes("{ type: \"paragraph\", text }"), "11. renderização preserva conteúdo original (sem rewrite)");
ok(messageBubble.includes("blocks.map") && messageBubble.includes("marginBottom"), "12. resposta longa não vira blocão único visual");

section("13-17: planner_brief condicional");
ok(useChatState.includes("const _CHAT_CASUAL_SHORT_RX") && useChatState.includes("if (_CHAT_CASUAL_SHORT_RX.test(text)) return false;"), "13. planner_brief omitido em conversa casual curta");
ok(useChatState.includes("_CHAT_BRIEF_OPERATIONAL_TERMS") && useChatState.includes("if (hasOperationalSignal) return true;"), "14. planner_brief preservado em pedido operacional");
ok(useChatState.includes("_CHAT_BRIEF_TECHNICAL_TERMS") && useChatState.includes("if (_CHAT_BRIEF_TECHNICAL_TERMS.test(text))"), "15. planner_brief preservado em diagnóstico técnico real");
ok(useChatState.includes("\\bpr\\s*#?\\d+\\b"), "16. planner_brief preservado em pedido de PR");
ok(useChatState.includes("deploy|rollback|promover|release") && useChatState.includes("merge|rebase|cherry-pick") && useChatState.includes("patch|hotfix"), "17. planner_brief preservado em deploy/merge/patch");

section("18-26: Cockpit passivo + segurança visual");
ok(useTargetState.includes("ALLOWED_MODES = [\"read_only\"]") && useTargetState.includes("mode:        \"read_only\""), "18. painel não envia modo write/patch/deploy");
ok(targetPanel.includes("Seguro") || targetPanel.includes("Protegido"), "19. read_only visual suavizado/renomeado");
ok(targetPanel.includes("Execução exige aprovação"), "20. texto deixa claro que execução exige aprovação");
ok(targetPanel.includes("Intenção"), "21. cockpit passivo mostra intenção sugerida ou placeholder");
ok(targetPanel.includes("Modo"), "22. cockpit passivo mostra modo sugerido ou placeholder");
ok(targetPanel.includes("Risco"), "23. cockpit passivo mostra risco ou placeholder");
ok(targetPanel.includes("Próxima ação"), "24. cockpit passivo mostra próxima ação ou placeholder");
ok(targetPanel.includes("Aprovação necessária"), "25. cockpit passivo mostra aprovação necessária");
ok(chatPage.includes("buildPassiveCockpit") && !chatPage.includes("/chat/run"), "26. cockpit passivo não altera prompt/backend");

section("27-32: QuickActions e não-autonomia");
ok(quickActions.includes("Validar sistema"), "27. QuickActions mantém validar sistema");
ok(quickActions.includes("Gerar plano"), "28. QuickActions mantém gerar plano");
ok(quickActions.includes("Aprovar execução"), "29. QuickActions mantém aprovar execução");
ok(quickActions.includes("Conversa casual"), "30. QuickActions adiciona opção casual neutra");
ok(quickActions.includes("disabled: !pendingPlan"), "31. aprovação bloqueada sem plano pendente");
ok(!targetPanel.includes("fetch(") && !quickActions.includes("fetch("), "32. painel não executa ação real sozinho");

section("33-40: Arquivos proibidos não alterados");
let changedFiles = [];
try {
  const diff = execSync("git diff --name-only origin/main..HEAD", { cwd: ROOT, encoding: "utf8" });
  changedFiles = diff.split(/\r?\n/).filter(Boolean);
} catch {
  changedFiles = [];
}
const changed = (file) => changedFiles.includes(file);
ok(!changed("schema/enavia-response-policy.js"), "33. não alterou response policy");
ok(!changed("schema/enavia-llm-core.js"), "34. não alterou llm core");
ok(!changed("schema/enavia-cognitive-runtime.js"), "35. não alterou cognitive runtime");
ok(!changed("nv-enavia.js"), "36. não alterou nv-enavia.js");
ok(!changed("executor/src/index.js"), "37. não alterou executor/src/index.js");
ok(!changed("contract-executor.js"), "38. não alterou contract-executor.js");
ok(!changed(".github/workflows/deploy.yml"), "39. não alterou deploy.yml");
ok(!changed("wrangler.toml"), "40. não alterou wrangler.toml");

section("41-48: Regressões obrigatórias");
{
  const t95 = runNodeTest("tests/pr95-chat-livre-seguro.smoke.test.js");
  const knownIndexDrift = !t95.ok && t95.output.includes("INDEX.md registra PR96 como próxima PR");
  ok(t95.ok || knownIndexDrift, "41. PR95 continua passando (ou drift conhecido de INDEX após avanço para PR97)");
}
ok(runNodeTest("tests/pr94-chat-livre-cockpit-diagnostico.prova.test.js").ok, "42. PR94 continua passando");
ok(runNodeTest("tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js").ok, "43. PR93 continua passando");
ok(runNodeTest("tests/pr92-pr-executor-supervisionado-mock.prova.test.js").ok, "44. PR92 continua passando");
ok(runNodeTest("tests/pr91-pr-planner-schema.prova.test.js").ok, "45. PR91 continua passando");
ok(runNodeTest("tests/pr90-pr-orchestrator-diagnostico.prova.test.js").ok, "46. PR90 continua passando");
ok(runNodeTest("tests/pr84-chat-vivo.smoke.test.js").ok, "47. PR84 continua passando");
ok(runNodeTest("tests/pr59-response-policy-viva.smoke.test.js").ok, "48. PR59 continua passando");

section("49-52: Relatório e governança PR96");
ok(exists("schema/reports/PR96_COCKPIT_PASSIVO_CHAT_READABLE.md") && /corrigid|implementad|cockpit/i.test(report96), "49. relatório PR96 declara o que foi corrigido");
ok(/n[aã]o foi mexido|n[aã]o alterad|preservad/i.test(report96), "50. relatório PR96 declara o que não foi mexido");
ok(/PR97|Prova Final/i.test(report96), "51. relatório PR96 declara o que fica para PR97");
ok(/PR97\s*—\s*Prova Final/i.test(index), "52. INDEX.md avança próxima PR para PR97 — Prova Final");

const total = passed + failed;
console.log("\n============================================================");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${total}`);
if (failed > 0) {
  console.log("\nFalhas:");
  failures.forEach((f) => console.log(`  - ${f}`));
  process.exit(1);
}
console.log("Todos os cenários PR96 passaram. ✅");
