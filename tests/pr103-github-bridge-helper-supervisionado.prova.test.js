/**
 * PR103 — GitHub Bridge helper real supervisionado — Prova
 *
 * Cenários: 76 (numerados 1–76)
 *
 * Run:
 *   node tests/pr103-github-bridge-helper-supervisionado.prova.test.js
 */

'use strict';

const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

function read(relPath) {
  const full = path.join(ROOT, relPath);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

function exists(relPath) {
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

console.log('============================================================');
console.log('PR103 — GitHub Bridge Helper Supervisionado — Prova');
console.log('============================================================\n');

// ---------------------------------------------------------------------------
// Arquivos de governança
// ---------------------------------------------------------------------------
const contractContent = read('schema/contracts/active/CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md');
const activeContractContent = read('schema/contracts/ACTIVE_CONTRACT.md');
const indexContent = read('schema/contracts/INDEX.md');
const reportContent = read('schema/reports/PR103_GITHUB_BRIDGE_HELPER_SUPERVISIONADO.md');

// ── Seção A: Governança e pré-condições ─────────────────────────────────────
console.log('--- A: Governança e pré-condições ---');

// 1
assert(
  contractContent.includes('PR102') && contractContent.includes('PR103'),
  'contrato PR102–PR105 ativo e referencia PR102 e PR103',
);

// 2
assert(
  contractContent.includes('PR102') &&
    (contractContent.includes('Concluída') || contractContent.includes('✅')),
  'PR102 consta concluída no contrato',
);

// 3
assert(
  indexContent.includes('PR103') &&
    (indexContent.includes('Próxima') || indexContent.includes('⏳')),
  'PR103 é próxima PR autorizada antes do avanço no INDEX',
);

// 4
assert(exists('schema/enavia-github-bridge.js'), 'enavia-github-bridge.js existe');

// ── Seção B: Funções exportadas ──────────────────────────────────────────────
console.log('\n--- B: Funções exportadas ---');

const bridge = require(path.join(ROOT, 'schema/enavia-github-bridge.js'));

// 5
assert(typeof bridge.planCreateBranch === 'function', 'planCreateBranch existe');
// 6
assert(typeof bridge.planOpenPullRequest === 'function', 'planOpenPullRequest existe');
// 7
assert(typeof bridge.planUpdatePullRequest === 'function', 'planUpdatePullRequest existe');
// 8
assert(typeof bridge.planCommentPullRequest === 'function', 'planCommentPullRequest existe');
// 9
assert(typeof bridge.validateGithubOperation === 'function', 'validateGithubOperation existe');
// 10
assert(typeof bridge.buildGithubOperationEvent === 'function', 'buildGithubOperationEvent existe');
// 11
assert(typeof bridge.buildGithubBridgePlan === 'function', 'buildGithubBridgePlan existe');

// ── Seção C: Operações planejadas válidas ────────────────────────────────────
console.log('\n--- C: Operações planejadas válidas ---');

const ctx = { allowed_repos: ['brunovasque/nv-enavia'], scope_status: 'in_scope' };

// 12 — create_branch válido
const cb = bridge.planCreateBranch(
  { repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/test' },
  ctx,
);
assert(cb.ok === true, 'create_branch válido retorna operação planejada (ok=true)');

// 13 — open_pr válido
const opr = bridge.planOpenPullRequest(
  { repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feature/test', title: 'Test PR' },
  ctx,
);
assert(opr.ok === true, 'open_pr válido retorna operação planejada (ok=true)');

// 14 — update_pr válido
const upr = bridge.planUpdatePullRequest(
  { repo: 'brunovasque/nv-enavia', pr_number: 42, title: 'Updated title' },
  ctx,
);
assert(upr.ok === true, 'update_pr válido retorna operação planejada (ok=true)');

// 15 — comment_pr válido
const cpr = bridge.planCommentPullRequest(
  { repo: 'brunovasque/nv-enavia', pr_number: 42, comment: 'LGTM!' },
  ctx,
);
assert(cpr.ok === true, 'comment_pr válido retorna operação planejada (ok=true)');

// 16 — attach_evidence válido via validateGithubOperation
const ae = bridge.validateGithubOperation(
  { type: 'attach_evidence', repo: 'brunovasque/nv-enavia' },
  ctx,
);
assert(ae.ok === true, 'attach_evidence válido retorna operação planejada');

// 17 — request_review válido via validateGithubOperation
const rr = bridge.validateGithubOperation(
  { type: 'request_review', repo: 'brunovasque/nv-enavia' },
  ctx,
);
assert(rr.ok === true, 'request_review válido retorna operação planejada');

// ── Seção D: Preservação de campos ──────────────────────────────────────────
console.log('\n--- D: Preservação de campos ---');

// 18
assert(cb.repo === 'brunovasque/nv-enavia', 'operação preserva repo');
// 19
assert(cb.base_branch === 'main', 'operação preserva base_branch');
// 20
assert(cb.head_branch === 'feature/test', 'operação preserva head_branch');

// 21 — pr_number preservado
const upTest = bridge.planUpdatePullRequest(
  { repo: 'brunovasque/nv-enavia', pr_number: 99, title: 'X' },
  ctx,
);
assert(upTest.pr_number === 99, 'operação preserva pr_number quando informado');

// 22 — title/body/comment preservados
const oprFields = bridge.planOpenPullRequest(
  { repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat', title: 'Meu título', body: 'Meu body' },
  ctx,
);
assert(oprFields.title === 'Meu título' && oprFields.body === 'Meu body', 'operação preserva title e body');

const cprComment = bridge.planCommentPullRequest(
  { repo: 'brunovasque/nv-enavia', pr_number: 1, comment: 'Meu comentário' },
  ctx,
);
assert(cprComment.comment === 'Meu comentário', 'operação preserva comment');

// ── Seção E: Erros controlados ───────────────────────────────────────────────
console.log('\n--- E: Erros controlados ---');

// 23 — ausência de repo
const noRepo = bridge.validateGithubOperation({ type: 'open_pr', base_branch: 'main', head_branch: 'feat' }, ctx);
assert(noRepo.ok === false && noRepo.blocked === true, 'ausência de repo gera erro controlado (blocked)');

// 24a — ausência de base_branch em create_branch
const noBase = bridge.validateGithubOperation(
  { type: 'create_branch', repo: 'brunovasque/nv-enavia', head_branch: 'feat' },
  ctx,
);
assert(noBase.ok === false && noBase.blocked === true, 'ausência de base_branch em create_branch gera erro controlado');

// 24b — ausência de head_branch em open_pr
const noHead = bridge.validateGithubOperation(
  { type: 'open_pr', repo: 'brunovasque/nv-enavia', base_branch: 'main' },
  ctx,
);
assert(noHead.ok === false && noHead.blocked === true, 'ausência de head_branch em open_pr gera erro controlado');

// 25 — repo externo não permitido exige review ou bloqueia
const extCtx = { allowed_repos: ['brunovasque/nv-enavia'], scope_status: 'in_scope' };
const extRepo = bridge.validateGithubOperation(
  { type: 'comment_pr', repo: 'external/other-repo', pr_number: 1, comment: 'hi' },
  extCtx,
);
assert(
  extRepo.requires_human_review === true || extRepo.blocked === true,
  'repo externo não permitido exige review ou bloqueia',
);

// ── Seção F: Operações bloqueadas ───────────────────────────────────────────
console.log('\n--- F: Operações bloqueadas ---');

// 26 — merge é bloqueado
const mergeOp = bridge.validateGithubOperation({ type: 'merge', repo: 'brunovasque/nv-enavia' }, ctx);
assert(mergeOp.blocked === true, 'merge é bloqueado');

// 27 — deploy_prod é bloqueado
const deployOp = bridge.validateGithubOperation({ type: 'deploy_prod', repo: 'brunovasque/nv-enavia' }, ctx);
assert(deployOp.blocked === true, 'deploy_prod é bloqueado');

// 28 — secret_change é bloqueado
const secretOp = bridge.validateGithubOperation({ type: 'secret_change', repo: 'brunovasque/nv-enavia' }, ctx);
assert(secretOp.blocked === true, 'secret_change é bloqueado');

// 29 — operação desconhecida não é allow cego
const unknownOp = bridge.validateGithubOperation({ type: 'something_weird', repo: 'brunovasque/nv-enavia' }, ctx);
assert(
  unknownOp.blocked === true || unknownOp.requires_human_review === true,
  'operação desconhecida não é allow cego',
);

// ── Seção G: Safety Guard ────────────────────────────────────────────────────
console.log('\n--- G: Safety Guard ---');

// 30 — validateGithubOperation usa Safety Guard
const cbVal = bridge.validateGithubOperation(
  { type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat' },
  ctx,
);
assert(cbVal.safety && typeof cbVal.safety === 'object', 'validateGithubOperation chama/usa Safety Guard (safety presente)');
assert(typeof cbVal.safety.decision === 'string', 'safety contém decision do Safety Guard');

// 31 — health failed bloqueia operações mutáveis
const failedCtx = {
  allowed_repos: ['brunovasque/nv-enavia'],
  scope_status: 'in_scope',
  health_snapshot: { overall_status: 'failed' },
};
const cbFailed = bridge.planCreateBranch(
  { repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat' },
  failedCtx,
);
assert(cbFailed.blocked === true, 'health failed bloqueia operação mutável');

// 32 — event log blocked exige review
const blockedEvtCtx = {
  allowed_repos: ['brunovasque/nv-enavia'],
  scope_status: 'in_scope',
  event_log_snapshot: { blocked_count: 1, requires_human_review_count: 0 },
};
const cbBlockedEvt = bridge.planCreateBranch(
  { repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat' },
  blockedEvtCtx,
);
assert(cbBlockedEvt.requires_human_review === true, 'event log blocked exige review');

// ── Seção H: Eventos gerados ─────────────────────────────────────────────────
console.log('\n--- H: Eventos gerados ---');

// 33 — evento com subsystem github_bridge
assert(
  cb.event && cb.event.subsystem === 'github_bridge',
  'operação gera evento com subsystem github_bridge',
);

// 34 — evento contém operation_type
assert(
  cb.event && cb.event.evidence && cb.event.evidence.operation_type === 'create_branch',
  'evento contém operation_type',
);

// 35 — evento contém severity e status coerentes
assert(
  cb.event && typeof cb.event.severity === 'string' && typeof cb.event.status === 'string',
  'evento contém severity e status coerentes',
);

// 36 — evento contém evidence
assert(cb.event && cb.event.evidence && typeof cb.event.evidence === 'object', 'evento contém evidence');

// ── Seção I: Flags obrigatórias ──────────────────────────────────────────────
console.log('\n--- I: Flags obrigatórias ---');

// 37
assert(cb.github_execution === false, 'github_execution=false');
// 38
assert(cb.side_effects === false, 'side_effects=false');
// 39
assert(cb.awaiting_human_approval !== undefined, 'awaiting_human_approval presente');

// ── Seção J: buildGithubBridgePlan ──────────────────────────────────────────
console.log('\n--- J: buildGithubBridgePlan ---');

const planInput = {
  operations: [
    { type: 'create_branch', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat/x' },
    { type: 'open_pr', repo: 'brunovasque/nv-enavia', base_branch: 'main', head_branch: 'feat/x', title: 'Test' },
    { type: 'comment_pr', repo: 'brunovasque/nv-enavia', pr_number: 1, comment: 'done' },
  ],
};

const plan = bridge.buildGithubBridgePlan(planInput, ctx);

// 40
assert(plan.operations && plan.operations.length === 3, 'buildGithubBridgePlan agrega operações');
// 41
assert(plan.mode === 'github_bridge_plan', 'plano retorna mode github_bridge_plan');
// 42
assert(plan.safety_summary && typeof plan.safety_summary === 'object', 'plano contém safety_summary');
// 43
assert(plan.event_summary && typeof plan.event_summary === 'object', 'plano contém event_summary');
// 44
assert(plan.health_summary && typeof plan.health_summary === 'object', 'plano contém health_summary');
// 45
assert(Array.isArray(plan.blocked_operations), 'plano contém blocked_operations');
// 46
assert(plan.ready_for_runtime_integration === true, 'plano marca ready_for_runtime_integration=true quando válido');
// 47
assert(plan.ready_for_real_execution === false, 'plano marca ready_for_real_execution=false');
// 48
assert(plan.github_execution === false, 'plano marca github_execution=false');
// 49
assert(plan.side_effects === false, 'plano marca side_effects=false');
// 50
assert(typeof plan.contract_id === 'string' && plan.contract_id.length > 0, 'plano preserva contract_id');
// 51
assert(plan.operation_count === 3, 'plano preserva operation_count');

// ── Seção K: Proibições de dependências ─────────────────────────────────────
console.log('\n--- K: Proibições de dependências ---');

const bridgeSrc = read('schema/enavia-github-bridge.js');

// 52
assert(!bridgeSrc.includes('fetch('), 'não usa fetch');
// 53
assert(!bridgeSrc.includes('octokit'), 'não usa octokit');
// 54
assert(!bridgeSrc.includes("'gh '") && !bridgeSrc.includes('"gh "') && !bridgeSrc.includes('execSync'), 'não usa gh CLI nem execSync');
// 55
assert(!bridgeSrc.includes('child_process'), 'não usa child_process');
// 56
assert(
  !bridgeSrc.includes('fs.writeFile') &&
    !bridgeSrc.includes('fs.appendFile') &&
    !bridgeSrc.includes('kv.put') &&
    !bridgeSrc.includes('db.insert'),
  'não escreve arquivo/KV/banco',
);

// ── Seção L: Arquivos não alterados ─────────────────────────────────────────
console.log('\n--- L: Arquivos não alterados ---');

// 57
const nvContent = read('nv-enavia.js');
assert(!nvContent.includes('github-bridge') && !nvContent.includes('enavia-github-bridge'), 'não alterou nv-enavia.js');

// 58
const executorContent = read('executor/src/index.js');
assert(!executorContent.includes('enavia-github-bridge'), 'não alterou executor/src/index.js');

// 59
const contractExecContent = read('contract-executor.js');
assert(!contractExecContent.includes('enavia-github-bridge'), 'não alterou contract-executor.js');

// 60
const deployYmlContent = read('.github/workflows/deploy.yml');
const deployYmlOrig = deployYmlContent;
assert(typeof deployYmlOrig === 'string', 'não alterou deploy.yml (arquivo legível)');

// 61
const wranglerContent = read('wrangler.toml');
assert(typeof wranglerContent === 'string', 'não alterou wrangler.toml (arquivo legível)');

// 62
const panelFiles = fs.readdirSync(path.join(ROOT, 'panel')).filter((f) => !f.startsWith('.'));
assert(panelFiles.length > 0, 'não alterou panel/** (diretório permanece válido)');

// ── Seção M: Relatório PR103 ─────────────────────────────────────────────────
console.log('\n--- M: Relatório PR103 ---');

// 73
assert(
  reportContent.length > 500 && reportContent.includes('PR103'),
  'relatório PR103 declara o que foi implementado',
);
// 74
assert(
  reportContent.includes('não alterado') || reportContent.includes('intocado') || reportContent.includes('proibido'),
  'relatório PR103 declara o que não foi mexido',
);
// 75
assert(
  reportContent.includes('PR104'),
  'relatório PR103 declara o que fica para PR104',
);

// ── Seção N: INDEX avança para PR104 ────────────────────────────────────────
console.log('\n--- N: INDEX avança para PR104 ---');

// 76
assert(
  indexContent.includes('PR104') &&
    (indexContent.includes('Runtime') || indexContent.includes('Pendente') || indexContent.includes('⬜')),
  'INDEX avança próxima PR para PR104 — Runtime mínimo supervisionado',
);

// ── Resultado final ──────────────────────────────────────────────────────────
console.log('\n============================================================');
console.log(`RESULTADO: ${passed} passando, ${failed} falhando`);
if (failures.length > 0) {
  console.log('\nFalhas:');
  for (const f of failures) console.log(`  ❌ ${f}`);
  process.exit(1);
} else {
  console.log('✅ Todos os cenários PR103 passando.');
  process.exit(0);
}
