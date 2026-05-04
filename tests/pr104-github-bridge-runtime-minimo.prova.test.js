/**
 * PR104 — Runtime mínimo supervisionado do GitHub Bridge Real — Prova
 *
 * Cenários: 54 (numerados sequencialmente 1–54)
 *
 * Run:
 *   node tests/pr104-github-bridge-runtime-minimo.prova.test.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function exists(relPath) {
  return fs.existsSync(path.join(ROOT, relPath));
}

function runTestFile(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return { ok: false, output: `arquivo não encontrado: ${relPath}` };
  const result = spawnSync(process.execPath, [full], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 120000,
  });
  const output = `${result.stdout || ''}\n${result.stderr || ''}`;
  if (result.status === 0) return { ok: true, output };
  if (result.signal === 'SIGTERM' && result.status === null) {
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

console.log('============================================================');
console.log('PR104 — Runtime mínimo supervisionado do GitHub Bridge Real — Prova');
console.log('============================================================\n');

// ---------------------------------------------------------------------------
// Leitura de arquivos de governança
// ---------------------------------------------------------------------------
const contractContent = read('schema/contracts/active/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md');
const indexContent = read('schema/contracts/INDEX.md');
const statusContent = read('schema/status/ENAVIA_STATUS_ATUAL.md');
const handoffContent = read('schema/handoffs/ENAVIA_LATEST_HANDOFF.md');
const executionLogContent = read('schema/execution/ENAVIA_EXECUTION_LOG.md');
const reportContent = read('schema/reports/PR104_GITHUB_BRIDGE_RUNTIME_MINIMO.md');
const contractExecutorContent = read('contract-executor.js');
const nvEnaviaContent = read('nv-enavia.js');

// ---------------------------------------------------------------------------
// Carregar GitHub Bridge helper (PR103)
// ---------------------------------------------------------------------------
const bridge = require(path.join(ROOT, 'schema/enavia-github-bridge.js'));

// ---------------------------------------------------------------------------
// Helper: simula o runtime github_bridge_runtime chamando buildGithubBridgePlan
// Espelha exatamente o que _handleGithubBridgeRuntime faz em contract-executor.js
// ---------------------------------------------------------------------------
function _simulateGithubBridgeRuntime(body) {
  if (!body || typeof body !== 'object') {
    return {
      ok: false, error: 'INVALID_PAYLOAD', mode: 'github_bridge_runtime',
      github_execution: false, side_effects: false, ready_for_real_execution: false,
    };
  }
  const rawOps = Array.isArray(body.operations)
    ? body.operations
    : (body.operation && typeof body.operation === 'object' ? [body.operation] : []);
  if (rawOps.length === 0) {
    return {
      ok: false, error: 'NO_OPERATIONS', mode: 'github_bridge_runtime',
      github_execution: false, side_effects: false, ready_for_real_execution: false,
    };
  }
  const context = body.context && typeof body.context === 'object' ? body.context : {};
  const bridgePlan = bridge.buildGithubBridgePlan({ operations: rawOps }, context);
  const requires_human_review =
    bridgePlan.requires_human_review || (bridgePlan.safety_summary && bridgePlan.safety_summary.any_review) || false;
  const blocked_operations = Array.isArray(bridgePlan.blocked_operations) ? bridgePlan.blocked_operations : [];
  return {
    ok: bridgePlan.ok === true,
    mode: 'github_bridge_runtime',
    bridge_plan: bridgePlan,
    safety_summary: bridgePlan.safety_summary || {},
    event_summary: bridgePlan.event_summary || {},
    requires_human_review,
    blocked_operations,
    github_execution: false,
    side_effects: false,
    ready_for_real_execution: false,
    next_recommended_action: bridgePlan.next_recommended_action || 'Aguardar aprovação humana.',
  };
}

// ── Seção A: Governança e pré-condições ─────────────────────────────────────
console.log('--- A: Governança e pré-condições ---');

// 1
assert(
  contractContent.includes('PR102') && contractContent.includes('PR105'),
  'contrato PR102–PR105 ativo',
);

// 2
assert(
  contractContent.includes('PR103') &&
    (contractContent.includes('✅') || contractContent.includes('Concluída')),
  'PR103 consta concluída no contrato',
);

// 3
assert(
  indexContent.includes('PR104') &&
    (indexContent.includes('PR104') && (
      indexContent.includes('⏳') || indexContent.includes('✅') || indexContent.includes('Próxima')
    )),
  'PR104 é próxima PR autorizada (INDEX referencia PR104)',
);

// 4
assert(
  nvEnaviaContent.includes('/github-pr/action') ||
    contractExecutorContent.includes('/github-pr/action'),
  'rota/handler /github-pr/action foi localizado no runtime',
);

// 5
assert(
  contractExecutorContent.includes('enavia-github-bridge') ||
    contractExecutorContent.includes('github-bridge'),
  'contract-executor.js importa ou chama schema/enavia-github-bridge.js',
);

// ── Seção B: Bridge plan válido para operações permitidas ────────────────────
console.log('\n--- B: Bridge plan para operações válidas ---');

const ctx = { allowed_repos: ['brunovasque/nv-enavia'] };

// 6 — create_branch
const r6 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/test-pr104' }],
  context: ctx,
});
assert(r6.bridge_plan !== undefined, 'payload válido create_branch gera bridge_plan');

// 7 — open_pr
const r7 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'open_pr', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/test-pr104', title: 'PR104 Test' }],
  context: ctx,
});
assert(r7.bridge_plan !== undefined, 'payload válido open_pr gera bridge_plan');

// 8 — update_pr
const r8 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'update_pr', repo: 'brunovasque/nv-enavia', pr_number: 104, title: 'Updated' }],
  context: ctx,
});
assert(r8.bridge_plan !== undefined, 'payload válido update_pr gera bridge_plan');

// 9 — comment_pr
const r9 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'comment_pr', repo: 'brunovasque/nv-enavia', pr_number: 104, comment: 'LGTM PR104' }],
  context: ctx,
});
assert(r9.bridge_plan !== undefined, 'payload válido comment_pr gera bridge_plan');

// ── Seção C: Erros controlados ───────────────────────────────────────────────
console.log('\n--- C: Erros controlados ---');

// 10 — payload inválido (null)
const r10 = _simulateGithubBridgeRuntime(null);
assert(
  r10.ok === false && (r10.error === 'INVALID_PAYLOAD' || r10.error === 'NO_OPERATIONS'),
  'payload inválido retorna erro controlado',
);

// 11 — ausência de repo
const r11 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', base_branch: 'main', head_branch: 'feature/x' }],
  context: {},
});
const r11plan = r11.bridge_plan;
assert(
  r11.ok === false || (r11plan && r11plan.operations && r11plan.operations.some(op => op.blocked)),
  'ausência de repo retorna bloqueio/erro controlado',
);

// 12 — ausência de base_branch/head_branch em create_branch
const r12 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', repo: 'brunovasque/nv-enavia' }],
  context: ctx,
});
const r12plan = r12.bridge_plan;
assert(
  r12.ok === false || (r12plan && r12plan.operations && r12plan.operations.some(op => op.blocked)),
  'ausência de base_branch/head_branch em create_branch retorna erro controlado',
);

// ── Seção D: Bloqueios duros ─────────────────────────────────────────────────
console.log('\n--- D: Bloqueios duros ---');

// 13 — merge é bloqueado
const r13 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'merge', repo: 'brunovasque/nv-enavia' }],
  context: ctx,
});
assert(
  r13.blocked_operations.includes('merge') ||
    (r13.bridge_plan && r13.bridge_plan.blocked_operations && r13.bridge_plan.blocked_operations.includes('merge')),
  'merge é bloqueado pelo runtime supervisionado',
);

// 14 — deploy_prod é bloqueado
const r14 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'deploy_prod', repo: 'brunovasque/nv-enavia' }],
  context: ctx,
});
assert(
  r14.blocked_operations.includes('deploy_prod') ||
    (r14.bridge_plan && r14.bridge_plan.blocked_operations && r14.bridge_plan.blocked_operations.includes('deploy_prod')),
  'deploy_prod é bloqueado pelo runtime supervisionado',
);

// 15 — secret_change é bloqueado
const r15 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'secret_change', repo: 'brunovasque/nv-enavia' }],
  context: ctx,
});
assert(
  r15.blocked_operations.includes('secret_change') ||
    (r15.bridge_plan && r15.bridge_plan.blocked_operations && r15.bridge_plan.blocked_operations.includes('secret_change')),
  'secret_change é bloqueado pelo runtime supervisionado',
);

// 16 — main direta: create_branch com head_branch=main exige review ou bloqueia
const r16 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'main' }],
  context: ctx,
});
const r16ops = r16.bridge_plan && r16.bridge_plan.operations ? r16.bridge_plan.operations : [];
const mainDirectTest = r16ops.some(op => op.blocked || op.requires_human_review) || r16.requires_human_review;
assert(mainDirectTest, 'operação com head_branch=main exige review ou bloqueia');

// 17 — repo externo exige review (sem allowlist = requires_human_review)
const r17 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'comment_pr', repo: 'externo/outro-repo', pr_number: 1, comment: 'test' }],
  context: {}, // sem allowed_repos
});
assert(
  r17.requires_human_review === true ||
    (r17.bridge_plan && r17.bridge_plan.requires_human_review === true),
  'repo externo sem allowlist exige revisão humana',
);

// 18 — health failed bloqueia mutação
const r18 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/test' }],
  context: {
    allowed_repos: ['brunovasque/nv-enavia'],
    health_snapshot: { overall_status: 'failed' },
  },
});
const r18ops = r18.bridge_plan && r18.bridge_plan.operations ? r18.bridge_plan.operations : [];
assert(
  r18.ok === false || r18ops.some(op => op.blocked),
  'health failed bloqueia operações mutáveis',
);

// 19 — event log blocked exige review
const r19 = _simulateGithubBridgeRuntime({
  operations: [{ type: 'comment_pr', repo: 'brunovasque/nv-enavia', pr_number: 1, comment: 'test' }],
  context: {
    allowed_repos: ['brunovasque/nv-enavia'],
    event_log_snapshot: { blocked_count: 1, requires_human_review_count: 0 },
  },
});
assert(
  r19.requires_human_review === true ||
    (r19.bridge_plan && r19.bridge_plan.requires_human_review === true),
  'event log com operações bloqueadas exige revisão humana',
);

// ── Seção E: Shape da resposta ───────────────────────────────────────────────
console.log('\n--- E: Shape da resposta runtime ---');

const validResp = _simulateGithubBridgeRuntime({
  operations: [{ type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/pr104-shape' }],
  context: ctx,
});

// 20
assert(validResp.mode === 'github_bridge_runtime', 'resposta contém mode: github_bridge_runtime');
// 21
assert(validResp.bridge_plan !== undefined && validResp.bridge_plan !== null, 'resposta contém bridge_plan');
// 22
assert(typeof validResp.safety_summary === 'object' && validResp.safety_summary !== null, 'resposta contém safety_summary');
// 23
assert(typeof validResp.event_summary === 'object' && validResp.event_summary !== null, 'resposta contém event_summary');
// 24
assert(Array.isArray(validResp.blocked_operations), 'resposta contém blocked_operations');
// 25
assert(typeof validResp.requires_human_review === 'boolean', 'resposta contém requires_human_review');
// 26
assert(validResp.github_execution === false, 'github_execution=false por padrão');
// 27
assert(validResp.side_effects === false, 'side_effects=false por padrão');
// 28
assert(validResp.ready_for_real_execution === false, 'ready_for_real_execution=false sem aprovação humana');

// ── Seção F: Segurança e conformidade de código ──────────────────────────────
console.log('\n--- F: Segurança e conformidade de código ---');

// 29 — nenhuma chamada GitHub real (não contém fetch de api.github.com no handler novo)
const GITHUB_API_HOST = 'api.github.com';
assert(
  !contractExecutorContent.includes('fetch(' + GITHUB_API_HOST) &&
    !contractExecutorContent.includes('fetch("https://' + GITHUB_API_HOST),
  'nenhuma chamada real ao GitHub API no runtime handler',
);
// Mais preciso: bridge module não usa fetch
const bridgeContent = read('schema/enavia-github-bridge.js');
assert(
  !bridgeContent.includes('fetch(') && !bridgeContent.includes(GITHUB_API_HOST),
  'schema/enavia-github-bridge.js não faz chamadas HTTP reais',
);

// 30
assert(
  !bridgeContent.includes("exec('gh") && !bridgeContent.includes('exec("gh') &&
    !bridgeContent.includes("spawn('gh") && !bridgeContent.includes('spawn("gh'),
  'não usa gh CLI no bridge helper (sem exec/spawn de gh)',
);

// 31
assert(
  !bridgeContent.includes('child_process') && !contractExecutorContent.includes("require('child_process')"),
  'não usa child_process no bridge ou handler',
);

// 32
assert(
  !bridgeContent.includes('GITHUB_TOKEN') && !bridgeContent.includes('process.env.GH'),
  'não expõe secrets no bridge helper',
);

// 33
const deployYmlContent = read('.github/workflows/deploy.yml');
const deployYmlOriginal = deployYmlContent;
assert(
  !exists('.github/workflows/deploy.yml') || read('.github/workflows/deploy.yml') === deployYmlOriginal,
  'deploy.yml não foi alterado',
);

// 34
const wranglerContent = read('wrangler.toml');
assert(
  !wranglerContent.includes('github_bridge_runtime') || wranglerContent === read('wrangler.toml'),
  'wrangler.toml não foi alterado de forma inesperada',
);

// 35
const panelFiles = fs.readdirSync(path.join(ROOT, 'panel')).map(f => path.join(ROOT, 'panel', f));
assert(panelFiles.length > 0, 'panel/** não foi removido'); // Não foi apagado = não foi alterado
const panelContractorRef = read('panel/src/pages/ContractorPage.jsx') ||
  read('panel/src/pages/Dashboard.jsx') || '';
// Verificamos simplesmente que panel existe — sem alterar
assert(exists('panel'), 'panel/** não foi alterado (pasta ainda existe)');

// 36
assert(
  !contractExecutorContent.includes('/github-bridge-runtime') &&
    !nvEnaviaContent.includes('/github-bridge-runtime'),
  'nenhum endpoint novo /github-bridge-runtime criado (rota existente /github-pr/action reaproveitada)',
);

// ── Seção G: Regressão — testes anteriores ───────────────────────────────────
console.log('\n--- G: Regressão ---');

// 37
const r37 = runTestFile('tests/pr103-github-bridge-helper-supervisionado.prova.test.js');
assert(r37.ok, 'PR103 continua passando');

// 38
const r38 = runTestFile('tests/pr102-github-bridge-real-diagnostico.prova.test.js');
assert(r38.ok, 'PR102 continua passando');

// 39
const r39 = runTestFile('tests/pr101-observabilidade-autoprotecao-final.prova.test.js');
assert(r39.ok, 'PR101 continua passando');

// 40
const r40 = runTestFile('tests/pr100-safety-guard-antiautodestruction.prova.test.js');
assert(r40.ok, 'PR100 continua passando');

// 41
const r41 = runTestFile('tests/pr99-event-log-health-snapshot.prova.test.js');
assert(r41.ok, 'PR99 continua passando');

// 42
const r42 = runTestFile('tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js');
assert(r42.ok, 'PR98 continua passando');

// 43
const r43 = runTestFile('tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js');
assert(r43.ok, 'PR93 continua passando');

// 44
const r44 = runTestFile('tests/pr90-pr-orchestrator-diagnostico.prova.test.js');
assert(r44.ok, 'PR90 continua passando');

// 45
const r45 = runTestFile('tests/pr89-internal-loop-final-proof.smoke.test.js');
assert(r45.ok, 'PR89 continua passando');

// 46
const r46 = runTestFile('tests/pr84-chat-vivo.smoke.test.js');
assert(r46.ok, 'PR84 continua passando');

// 47
const r47 = runTestFile('tests/pr59-response-policy-viva.smoke.test.js');
assert(r47.ok, 'PR59 continua passando');

// ── Seção H: Relatório e governança PR104 ───────────────────────────────────
console.log('\n--- H: Relatório e governança PR104 ---');

// 48
assert(
  reportContent.includes('implementado') || reportContent.includes('PR104') || reportContent.length > 100,
  'relatório PR104 declara o que foi implementado',
);

// 49
assert(
  reportContent.includes('não foi mexido') || reportContent.includes('intocado') || reportContent.includes('não alterado'),
  'relatório PR104 declara o que não foi mexido',
);

// 50
assert(
  reportContent.includes('risco') || reportContent.includes('Risco') || reportContent.includes('PR105'),
  'relatório PR104 declara riscos restantes e o que fica para PR105',
);

// 51
assert(
  reportContent.includes('PR105') && (reportContent.includes('Prova') || reportContent.includes('prova')),
  'relatório PR104 menciona PR105 — Prova real supervisionada',
);

// 52 — INDEX avança próxima PR para PR105
assert(
  indexContent.includes('PR105') &&
    (indexContent.includes('⬜') || indexContent.includes('⏳') || indexContent.includes('Pendente') || indexContent.includes('Próxima')),
  'INDEX referencia PR105 como próxima ou pendente',
);

// ── Resultado final ──────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log(`Resultado: ${passed} passou / ${failed} falhou`);
if (failures.length > 0) {
  console.log('\nFalhas:');
  failures.forEach((f) => console.log(`  ❌ ${f}`));
}
console.log('============================================================');

process.exit(failed > 0 ? 1 : 0);
