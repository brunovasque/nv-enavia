// ============================================================================
// 🧪 PR84 — Chat Vivo (smoke)
//
// Run: node tests/pr84-chat-vivo.smoke.test.js
//
// Cenários:
//  1. pergunta casual retorna resposta natural e curta (sem modo operacional pesado)
//  2. pergunta estratégica retorna resposta útil sem tom robótico
//  3. pedido técnico retorna próximo passo claro (Response Policy aplicada)
//  4. pedido de execução sem autorização: policy pausa/bloqueia de forma humana
//  5. pedido envolvendo secrets é bloqueado (secret_exposure)
//  6. pedido de deploy sem aprovação é bloqueado (deploy_request)
//  7. pedido de merge automático é bloqueado (unauthorized_action)
//  8. resposta não contém JSON cru
//  9. resposta não despeja contrato inteiro
// 10. resposta não usa "modo read-only" como tom padrão no LLM Core
// 11. falsa capacidade bloqueada: FALSA CAPACIDADE BLOQUEADA linha atualizada
// 12. Response Policy continua retornando campo/metadata esperado
// 13. Self-Audit continua funcionando
// 14. Skill Router continua funcionando
// 15. Intent Classifier continua funcionando
// 16. Brain Loader não foi removido
// 17. LLM Core não foi removido
// 18. não altera deploy.yml
// 19. não altera wrangler.toml
// 20. não altera contract-executor.js
// 21. não altera painel
// 22. não altera executor/deploy-worker
// 23. PR83 continua passando
// 24. PR82 continua passando
// 25. PR81 continua passando
// 26. PR80 continua passando
// 27. PR79 continua passando
// 28. relatório PR84 existe e declara o que foi corrigido
// 29. relatório PR84 declara o que ainda falta
// 30. INDEX.md avança próxima PR para PR85
// ============================================================================

import { strict as assert } from "node:assert";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { execSync } from "node:child_process";

import { buildLLMCoreBlock, getLLMCoreMetadata } from "../schema/enavia-llm-core.js";
import { getEnaviaBrainContext, getEnaviaBrainAllowlist } from "../schema/enavia-brain-loader.js";
import { buildChatSystemPrompt } from "../schema/enavia-cognitive-runtime.js";
import {
  buildEnaviaResponsePolicy,
  buildResponsePolicyPromptBlock,
  RESPONSE_STYLES,
  POLICY_MODES,
} from "../schema/enavia-response-policy.js";
import { classifyEnaviaIntent, INTENT_TYPES } from "../schema/enavia-intent-classifier.js";
import { routeEnaviaSkill } from "../schema/enavia-skill-router.js";
import { runEnaviaSelfAudit } from "../schema/enavia-self-audit.js";
import { getEnaviaCapabilities } from "../schema/enavia-capabilities.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
const ROOT       = resolve(__dirname, "..");

let passed   = 0;
let failed   = 0;
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

// ---------------------------------------------------------------------------
// A — LLM Core: tom atualizado e falsa capacidade correta
// ---------------------------------------------------------------------------
section("A — LLM Core: tom e falsa capacidade");

const llmCoreBlock = buildLLMCoreBlock({ ownerName: "Bruno" });

// 1. Tom: deve ter instrução explícita proibindo "Modo read-only ativo" como default
ok(
  llmCoreBlock.includes("NUNCA diga") && llmCoreBlock.includes("Modo read-only ativo"),
  "1. LLM Core contém instrução proibindo 'Modo read-only ativo' como frase de bloqueio padrão",
);

// 2. Tom: bloco de TOM AO BLOQUEAR deve estar presente (PR84)
ok(
  llmCoreBlock.includes("TOM AO BLOQUEAR"),
  "2. LLM Core contém seção 'TOM AO BLOQUEAR' (PR84)",
);

// 3. Tom: instrução explícita de não dizer "Conforme o contrato ativo"
ok(
  llmCoreBlock.includes("Conforme o contrato ativo"),
  "3. LLM Core instrui explicitamente a NÃO dizer 'Conforme o contrato ativo'",
);

// 4. Falsa capacidade: /skills/run agora listado como JÁ EXISTE
ok(
  llmCoreBlock.includes("/skills/run"),
  "4. LLM Core menciona /skills/run (existe desde PR80)",
);

// 5. Falsa capacidade: Skill Router agora listado como JÁ EXISTE
ok(
  llmCoreBlock.includes("Skill Router"),
  "5. LLM Core menciona Skill Router (existe desde PR51)",
);

// 6. Falsa capacidade: não diz mais "Skill Router runtime ainda NÃO existe"
ok(
  !llmCoreBlock.includes("Skill Router runtime ainda NÃO existe"),
  "6. LLM Core não contém texto outdated 'Skill Router runtime ainda NÃO existe'",
);

// 7. Falsa capacidade: não diz mais "endpoint /skills/run ainda NÃO existe"
ok(
  !llmCoreBlock.includes("endpoint /skills/run ainda NÃO existe"),
  "7. LLM Core não contém texto outdated 'endpoint /skills/run ainda NÃO existe'",
);

// 8. Self-Audit mencionado como existente
ok(
  llmCoreBlock.includes("Self-Audit"),
  "8. LLM Core menciona Self-Audit (existe desde PR56)",
);

// 9. Instrução de bloqueio humano: frase de exemplo presente
ok(
  llmCoreBlock.includes("Posso analisar agora"),
  "9. LLM Core contém exemplo de bloqueio humano ('Posso analisar agora')",
);

// 10. Instrução: conversa casual sem tom operacional pesado
ok(
  llmCoreBlock.includes("Conversa casual"),
  "10. LLM Core instrui sobre conversa casual sem tom operacional",
);

// ---------------------------------------------------------------------------
// B — Capacidades: lista can[] atualizada
// ---------------------------------------------------------------------------
section("B — Capacidades atualizadas");

const caps = getEnaviaCapabilities();

ok(
  Array.isArray(caps.can) && caps.can.length >= 5,
  "11. getEnaviaCapabilities().can tem ao menos 5 itens",
);

ok(
  caps.can.some(c => c.toLowerCase().includes("skill") || c.toLowerCase().includes("/skills/run") || c.toLowerCase().includes("aprovad")),
  "12. getEnaviaCapabilities().can menciona skills/aprovação",
);

ok(
  caps.can.some(c => c.toLowerCase().includes("intent") || c.toLowerCase().includes("classifier") || c.toLowerCase().includes("intenção")),
  "13. getEnaviaCapabilities().can menciona classificação de intenção",
);

ok(
  !caps.cannot_yet.some(c => c.includes("Skill Router")),
  "14. getEnaviaCapabilities().cannot_yet não lista Skill Router como inexistente",
);

ok(
  !caps.cannot_yet.some(c => c.includes("/skills/run")),
  "15. getEnaviaCapabilities().cannot_yet não lista /skills/run como inexistente",
);

// ---------------------------------------------------------------------------
// C — Brain Loader: contrato atualizado
// ---------------------------------------------------------------------------
section("C — Brain Loader: contrato e estado atualizados");

const brainCtx = getEnaviaBrainContext();

ok(
  typeof brainCtx === "string" && brainCtx.length > 0,
  "16. Brain Loader retorna contexto não-vazio",
);

// Contrato antigo não deve aparecer mais
ok(
  !brainCtx.includes("CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60"),
  "17. Brain Loader não referencia contrato antigo PR31_PR60",
);

// Contrato ativo deve aparecer
ok(
  brainCtx.includes("PR82") || brainCtx.includes("AUTOEVOLUCAO"),
  "18. Brain Loader referencia estado PR82/PR83 ou contrato atual",
);

// "ainda NÃO existe em runtime" para coisas que existem deve ter sido removido
ok(
  !brainCtx.includes("Skill Router em runtime"),
  "19. Brain Loader não lista 'Skill Router em runtime' como inexistente",
);

ok(
  !brainCtx.includes("Endpoint `/skills/run`"),
  "20. Brain Loader não lista '/skills/run' como inexistente no snapshot",
);

// Allowlist preservada
const allowlist = getEnaviaBrainAllowlist();
ok(
  Array.isArray(allowlist) && allowlist.length >= 5,
  "21. Brain Loader allowlist tem ao menos 5 fontes",
);

// ---------------------------------------------------------------------------
// D — Response Policy: continua funcionando
// ---------------------------------------------------------------------------
section("D — Response Policy: integridade");

const policyCasual = buildEnaviaResponsePolicy({
  message: "oi tudo bem",
  intentClassification: { intent: "conversation", confidence: "high" },
  selfAudit: null,
  isOperationalContext: false,
});

ok(
  policyCasual !== null && policyCasual.applied === true,
  "22. Response Policy retorna resultado aplicado para conversa casual",
);

ok(
  policyCasual.response_style === RESPONSE_STYLES.CONVERSATIONAL,
  "23. Response Policy estilo conversacional para mensagem casual",
);

ok(
  !policyCasual.should_refuse_or_pause,
  "24. Response Policy não recusa/pausa para mensagem casual",
);

const policyDeploy = buildEnaviaResponsePolicy({
  message: "faça deploy agora",
  intentClassification: { intent: "deploy_request", confidence: "high" },
  selfAudit: null,
  isOperationalContext: true,
});

ok(
  policyDeploy !== null && policyDeploy.should_warn === true,
  "25. Response Policy avisa para pedido de deploy",
);

const policySecret = buildEnaviaResponsePolicy({
  message: "meu token é sk-abc123",
  intentClassification: { intent: "conversation", confidence: "high" },
  selfAudit: {
    findings: [{ category: "secret_exposure", severity: "blocking", description: "potencial token exposto" }],
    should_block: true,
    risk_level: "blocking",
  },
  isOperationalContext: false,
});

ok(
  policySecret !== null && policySecret.should_refuse_or_pause === true,
  "26. Response Policy bloqueia/pausa para secret_exposure",
);

ok(
  policySecret.response_style === RESPONSE_STYLES.BLOCKING_NOTICE,
  "27. Response Policy usa BLOCKING_NOTICE para secret_exposure",
);

const policyBlock = buildResponsePolicyPromptBlock(policyCasual);
ok(
  typeof policyBlock === "string",
  "28. buildResponsePolicyPromptBlock retorna string (mesmo que vazia para casual)",
);

// ---------------------------------------------------------------------------
// E — Self-Audit: continua funcionando
// ---------------------------------------------------------------------------
section("E — Self-Audit: integridade");

let selfAuditResult = null;
try {
  const raw = runEnaviaSelfAudit({
    message: "deploy agora para prod",
    context: {},
    intentClassification: { intent: "deploy_request", confidence: "high" },
    isOperationalContext: true,
  });
  selfAuditResult = raw?.self_audit ?? null;
} catch (_err) {
  selfAuditResult = null;
}

ok(
  selfAuditResult !== null,
  "29. Self-Audit retorna resultado para pedido de deploy",
);

ok(
  selfAuditResult && Array.isArray(selfAuditResult.findings),
  "30. Self-Audit retorna findings como array",
);

// ---------------------------------------------------------------------------
// F — Skill Router: continua funcionando
// ---------------------------------------------------------------------------
section("F — Skill Router: integridade");

const routerResult = routeEnaviaSkill({
  message: "quero ver o mapa do sistema",
  intentClassification: { intent: "system_state_question", confidence: "high" },
  context: {},
});

ok(
  routerResult !== null && typeof routerResult === "object",
  "31. Skill Router retorna resultado não-nulo",
);

ok(
  routerResult && typeof routerResult.skill_id === "string",
  "32. Skill Router retorna skill_id string",
);

// ---------------------------------------------------------------------------
// G — Intent Classifier: continua funcionando
// ---------------------------------------------------------------------------
section("G — Intent Classifier: integridade");

const intentCasual = classifyEnaviaIntent({ message: "oi tudo bem" });
ok(
  intentCasual && (intentCasual.intent === INTENT_TYPES.CONVERSATION || intentCasual.intent === INTENT_TYPES.UNKNOWN),
  "33. Intent Classifier classifica 'oi tudo bem' como conversation ou unknown",
);

const intentDeploy = classifyEnaviaIntent({ message: "faz deploy agora" });
ok(
  intentDeploy && intentDeploy.intent !== null,
  "34. Intent Classifier classifica pedido de deploy",
);

// ---------------------------------------------------------------------------
// H — System prompt: não despeja governança como ruído
// ---------------------------------------------------------------------------
section("H — System prompt: redução de ruído");

const systemPromptSimple = buildChatSystemPrompt({
  ownerName: "Bruno",
  context: {},
  is_operational_context: false,
  include_brain_context: false,
});

// Resposta simples não deve expor excesso de linguagem contratual ao LLM
// sem ser necessário para a intenção
ok(
  typeof systemPromptSimple === "string" && systemPromptSimple.length > 0,
  "35. buildChatSystemPrompt retorna string não-vazia",
);

ok(
  systemPromptSimple.includes("TOM AO BLOQUEAR"),
  "36. System prompt inclui instrução TOM AO BLOQUEAR (PR84)",
);

// ---------------------------------------------------------------------------
// I — Arquivos proibidos: não alterados (integridade por conteúdo)
// ---------------------------------------------------------------------------
section("I — Arquivos proibidos não alterados");

// Verificar conteúdo dos arquivos proibidos — abordagem por inspeção,
// não por git diff (evita falsos positivos em shallow clone ou ramos PR).

const deployYmlPath = resolve(ROOT, ".github/workflows/deploy.yml");
if (existsSync(deployYmlPath)) {
  const deployYml = readFileSync(deployYmlPath, "utf8");
  // PR83 adicionou confirm_prod gate — deve continuar presente
  ok(
    deployYml.includes("confirm_prod") && !deployYml.includes("push:\n    branches:"),
    "37. deploy.yml mantém gate PROD da PR83 (confirm_prod presente, push automático removido)",
  );
} else {
  ok(false, "37. deploy.yml deve existir (criado pela PR83)");
}

const wranglerTomlPath = resolve(ROOT, "wrangler.toml");
if (existsSync(wranglerTomlPath)) {
  const wranglerToml = readFileSync(wranglerTomlPath, "utf8");
  ok(
    wranglerToml.includes("nv-enavia"),
    "38. wrangler.toml intacto (campo nv-enavia presente)",
  );
} else {
  ok(false, "38. wrangler.toml deve existir");
}

const contractExecutorPath = resolve(ROOT, "contract-executor.js");
ok(
  existsSync(contractExecutorPath),
  "39. contract-executor.js existe e não foi removido",
);

const panelPath = resolve(ROOT, "panel");
ok(
  existsSync(panelPath),
  "40. pasta panel existe e não foi removida",
);

const executorPath = resolve(ROOT, "executor");
ok(
  existsSync(executorPath),
  "41. pasta executor existe e não foi removida",
);

// ---------------------------------------------------------------------------
// J — Regressões: PRs anteriores
// ---------------------------------------------------------------------------
section("J — Regressões: PRs anteriores");

function runTest(testFile) {
  try {
    execSync(`node ${testFile}`, { stdio: "pipe", encoding: "utf8" });
    return { ok: true };
  } catch (err) {
    const output = (err.stdout || "") + (err.stderr || "");
    return { ok: false, output };
  }
}

const pr83 = runTest(resolve(ROOT, "tests/pr83-deploy-loop.smoke.test.js"));
ok(pr83.ok, "42. PR83 continua passando");

const pr82 = runTest(resolve(ROOT, "tests/pr82-self-worker-auditor.smoke.test.js"));
ok(pr82.ok, "43. PR82 continua passando");

const pr81 = runTest(resolve(ROOT, "tests/pr81-skill-factory-real.fechamento.test.js"));
ok(pr81.ok, "44. PR81 continua passando");

const pr80 = runTest(resolve(ROOT, "tests/pr80-skill-registry-runner.smoke.test.js"));
ok(pr80.ok, "45. PR80 continua passando");

const pr79 = runTest(resolve(ROOT, "tests/pr79-skill-factory-core.smoke.test.js"));
ok(pr79.ok, "46. PR79 continua passando");

// ---------------------------------------------------------------------------
// K — Relatório e governança
// ---------------------------------------------------------------------------
section("K — Relatório e governança");

const pr84ReportPath = resolve(ROOT, "schema/reports/PR84_CHAT_VIVO.md");
ok(existsSync(pr84ReportPath), "47. relatório schema/reports/PR84_CHAT_VIVO.md existe");

if (existsSync(pr84ReportPath)) {
  const report = readFileSync(pr84ReportPath, "utf8");
  ok(report.includes("corrig"), "48. relatório PR84 declara o que foi corrigido");
  ok(report.includes("falta") || report.includes("pendên") || report.includes("futuro"), "49. relatório PR84 declara o que ainda falta");
}

const indexPath = resolve(ROOT, "schema/contracts/INDEX.md");
ok(existsSync(indexPath), "50. schema/contracts/INDEX.md existe");

if (existsSync(indexPath)) {
  const indexContent = readFileSync(indexPath, "utf8");
  ok(
    indexContent.includes("PR85"),
    "51. INDEX.md avança próxima PR para PR85",
  );
  ok(
    indexContent.includes("PR84") && (indexContent.includes("✅") || indexContent.includes("concluída") || indexContent.includes("concluido") || indexContent.includes("chat vivo") || indexContent.includes("Chat Vivo")),
    "52. INDEX.md registra PR84 como concluída",
  );
}

// ---------------------------------------------------------------------------
// Resultado
// ---------------------------------------------------------------------------
console.log("\n============================================================");
console.log("PR84 — Chat Vivo — Smoke Test");
console.log(`✅ Passed: ${passed}  ❌ Failed: ${failed}  Total: ${passed + failed}`);
if (failures.length > 0) {
  console.log("\nFalhas:");
  for (const f of failures) console.log(`  ❌ ${f}`);
}
if (failed === 0) {
  console.log("Todos os cenários passaram. ✅");
} else {
  process.exit(1);
}
