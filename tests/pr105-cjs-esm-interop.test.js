/**
 * pr105-cjs-esm-interop.test.js — PR105 — Validação do interop CJS/ESM
 *
 * Valida que schema/enavia-github-bridge.js (CJS, module.exports) e
 * schema/enavia-github-adapter.js (CJS, module.exports) expõem corretamente
 * suas funções quando carregados via require() (Node.js) e quando simulados
 * como default import ESM (padrão wrangler/esbuild CJS→ESM interop).
 *
 * O wrangler/esbuild trata o module.exports de um CJS como o default export
 * do módulo. Ou seja:
 *   import _ns from "./schema/enavia-github-bridge.js"
 *   → _ns === module.exports do arquivo CJS
 *   → _ns.buildGithubBridgePlan é a função exportada
 *
 * Este teste prova que o mesmo acesso funciona via require(), simulando
 * o comportamento que o bundler reproduz em produção.
 *
 * PR: PR105 — GitHub Bridge Real — Adapter + Plugação + Prova Real Unificados
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Carregamento dos módulos via require (equivalente ao default import ESM no bundle)
// ---------------------------------------------------------------------------

let bridgeNs, adapterNs, safetyGuardNs, eventLogNs;

try {
  bridgeNs = require(path.join(REPO_ROOT, 'schema/enavia-github-bridge'));
} catch (e) {
  assert.fail(`Falha ao carregar enavia-github-bridge.js: ${e.message}`);
}

try {
  adapterNs = require(path.join(REPO_ROOT, 'schema/enavia-github-adapter'));
} catch (e) {
  assert.fail(`Falha ao carregar enavia-github-adapter.js: ${e.message}`);
}

try {
  safetyGuardNs = require(path.join(REPO_ROOT, 'schema/enavia-safety-guard'));
} catch (e) {
  assert.fail(`Falha ao carregar enavia-safety-guard.js: ${e.message}`);
}

try {
  eventLogNs = require(path.join(REPO_ROOT, 'schema/enavia-event-log'));
} catch (e) {
  assert.fail(`Falha ao carregar enavia-event-log.js: ${e.message}`);
}

// ---------------------------------------------------------------------------
// Helper de teste
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`  ✅ ${name}`);
    passed++;
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
  }
}

// ---------------------------------------------------------------------------
// Grupo 1 — enavia-github-bridge.js (CJS) interop
// ---------------------------------------------------------------------------

console.log('\n[1] enavia-github-bridge.js — exports CJS / interop ESM simulado');

test('1.1 módulo carrega sem erro', () => {
  assert.ok(bridgeNs, 'bridgeNs deve ser truthy');
  assert.strictEqual(typeof bridgeNs, 'object', 'deve ser objeto (module.exports)');
});

test('1.2 validateGithubOperation exportada', () => {
  assert.strictEqual(typeof bridgeNs.validateGithubOperation, 'function');
});

test('1.3 buildGithubBridgePlan exportada', () => {
  assert.strictEqual(typeof bridgeNs.buildGithubBridgePlan, 'function');
});

test('1.4 planCreateBranch exportada', () => {
  assert.strictEqual(typeof bridgeNs.planCreateBranch, 'function');
});

test('1.5 planOpenPullRequest exportada', () => {
  assert.strictEqual(typeof bridgeNs.planOpenPullRequest, 'function');
});

test('1.6 planCommentPullRequest exportada', () => {
  assert.strictEqual(typeof bridgeNs.planCommentPullRequest, 'function');
});

test('1.7 ALLOWED_OPERATION_TYPES exportada como array', () => {
  assert.ok(Array.isArray(bridgeNs.ALLOWED_OPERATION_TYPES));
  assert.ok(bridgeNs.ALLOWED_OPERATION_TYPES.length > 0);
});

test('1.8 BLOCKED_OPERATION_TYPES exportada com merge/deploy_prod/secret_change', () => {
  assert.ok(Array.isArray(bridgeNs.BLOCKED_OPERATION_TYPES));
  assert.ok(bridgeNs.BLOCKED_OPERATION_TYPES.includes('merge'));
  assert.ok(bridgeNs.BLOCKED_OPERATION_TYPES.includes('deploy_prod'));
  assert.ok(bridgeNs.BLOCKED_OPERATION_TYPES.includes('secret_change'));
});

// Simula o acesso que o wrangler faz: _ns = module.exports; _ns.fn()
test('1.9 interop ESM simulado: default export = module.exports', () => {
  const _simulatedDefaultImport = bridgeNs; // no bundle: import _ns from "./bridge.js" → _ns = module.exports
  assert.strictEqual(typeof _simulatedDefaultImport.buildGithubBridgePlan, 'function');
  assert.strictEqual(typeof _simulatedDefaultImport.validateGithubOperation, 'function');
});

test('1.10 validateGithubOperation retorna objeto com campos obrigatórios', () => {
  const result = bridgeNs.validateGithubOperation({ type: 'comment_pr', repo: 'owner/repo' }, {});
  assert.strictEqual(typeof result, 'object');
  assert.ok('ok' in result);
  assert.ok('blocked' in result);
  assert.ok('github_execution' in result);
  assert.strictEqual(result.github_execution, false);
});

test('1.11 buildGithubBridgePlan retorna plano com ready_for_real_execution=false', () => {
  const result = bridgeNs.buildGithubBridgePlan(
    { operations: [{ type: 'comment_pr', repo: 'owner/repo', pr_number: 1, comment: 'test' }] },
    {}
  );
  assert.strictEqual(typeof result, 'object');
  assert.strictEqual(result.ready_for_real_execution, false);
  assert.strictEqual(result.github_execution, false);
});

// ---------------------------------------------------------------------------
// Grupo 2 — enavia-github-adapter.js (CJS) interop
// ---------------------------------------------------------------------------

console.log('\n[2] enavia-github-adapter.js — exports CJS / interop ESM simulado');

test('2.1 módulo carrega sem erro', () => {
  assert.ok(adapterNs, 'adapterNs deve ser truthy');
  assert.strictEqual(typeof adapterNs, 'object');
});

test('2.2 executeGithubOperation exportada', () => {
  assert.strictEqual(typeof adapterNs.executeGithubOperation, 'function');
});

test('2.3 executeGithubBridgeRequest exportada', () => {
  assert.strictEqual(typeof adapterNs.executeGithubBridgeRequest, 'function');
});

test('2.4 ALWAYS_BLOCKED exportada com merge/deploy_prod/secret_change', () => {
  assert.ok(Array.isArray(adapterNs.ALWAYS_BLOCKED));
  assert.ok(adapterNs.ALWAYS_BLOCKED.includes('merge'));
  assert.ok(adapterNs.ALWAYS_BLOCKED.includes('deploy_prod'));
  assert.ok(adapterNs.ALWAYS_BLOCKED.includes('secret_change'));
});

test('2.5 SUPPORTED_OPERATIONS exportada com comment_pr e create_branch', () => {
  assert.ok(Array.isArray(adapterNs.SUPPORTED_OPERATIONS));
  assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('comment_pr'));
  assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('create_branch'));
});

test('2.6 interop ESM simulado: default export = module.exports', () => {
  const _simulatedDefaultImport = adapterNs;
  assert.strictEqual(typeof _simulatedDefaultImport.executeGithubOperation, 'function');
  assert.strictEqual(typeof _simulatedDefaultImport.executeGithubBridgeRequest, 'function');
});

// ---------------------------------------------------------------------------
// Grupo 3 — enavia-safety-guard.js (CJS) interop
// ---------------------------------------------------------------------------

console.log('\n[3] enavia-safety-guard.js — exports CJS / interop ESM simulado');

test('3.1 módulo carrega sem erro', () => {
  assert.ok(safetyGuardNs, 'safetyGuardNs deve ser truthy');
});

test('3.2 evaluateSafetyGuard exportada', () => {
  assert.strictEqual(typeof safetyGuardNs.evaluateSafetyGuard, 'function');
});

test('3.3 isSafeToExecute exportada', () => {
  assert.strictEqual(typeof safetyGuardNs.isSafeToExecute, 'function');
});

test('3.4 interop ESM simulado: default export = module.exports', () => {
  const _ns = safetyGuardNs;
  assert.strictEqual(typeof _ns.evaluateSafetyGuard, 'function');
});

// ---------------------------------------------------------------------------
// Grupo 4 — enavia-event-log.js (CJS) interop
// ---------------------------------------------------------------------------

console.log('\n[4] enavia-event-log.js — exports CJS / interop ESM simulado');

test('4.1 módulo carrega sem erro', () => {
  assert.ok(eventLogNs, 'eventLogNs deve ser truthy');
});

test('4.2 createEnaviaEvent exportada', () => {
  assert.strictEqual(typeof eventLogNs.createEnaviaEvent, 'function');
});

test('4.3 appendEnaviaEvent exportada', () => {
  assert.strictEqual(typeof eventLogNs.appendEnaviaEvent, 'function');
});

test('4.4 interop ESM simulado: default export = module.exports', () => {
  const _ns = eventLogNs;
  assert.strictEqual(typeof _ns.createEnaviaEvent, 'function');
});

// ---------------------------------------------------------------------------
// Grupo 5 — cadeia de dependências do adapter
// ---------------------------------------------------------------------------

console.log('\n[5] Cadeia de dependências: adapter → bridge → safety-guard + event-log');

test('5.1 adapter depende de enavia-github-bridge (bridge internamente usa require)', () => {
  // Se o adapter carregou sem erro, a cadeia de require está funcionando
  // adapter → bridge → safety-guard
  // adapter → bridge → event-log
  assert.ok(typeof adapterNs.executeGithubBridgeRequest === 'function');
});

test('5.2 executeGithubOperation bloqueia merge (sem fetch)', async () => {
  const result = await adapterNs.executeGithubOperation({ type: 'merge' }, 'fake-token');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.executed, false);
  assert.strictEqual(result.github_execution, false);
  assert.strictEqual(result.blocked, true);
});

test('5.3 executeGithubOperation bloqueia deploy_prod (sem fetch)', async () => {
  const result = await adapterNs.executeGithubOperation({ type: 'deploy_prod' }, 'fake-token');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blocked, true);
});

test('5.4 executeGithubOperation bloqueia secret_change (sem fetch)', async () => {
  const result = await adapterNs.executeGithubOperation({ type: 'secret_change' }, 'fake-token');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.blocked, true);
});

test('5.5 executeGithubOperation sem token retorna erro claro (sem fetch)', async () => {
  const result = await adapterNs.executeGithubOperation({ type: 'comment_pr' }, null);
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.executed, false);
  assert.strictEqual(result.github_execution, false);
  assert.ok(result.error.includes('GITHUB_TOKEN'));
});

test('5.6 executeGithubBridgeRequest bloqueia merge com Safety Guard + Event Log (sem fetch)', async () => {
  const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'fake-token');
  assert.strictEqual(result.ok, false);
  assert.strictEqual(result.executed, false);
  assert.strictEqual(result.github_execution, false);
  assert.strictEqual(result.blocked, true);
  // attempt_event gerado
  assert.ok(result.attempt_event !== null);
  // result_event não existe para operação bloqueada
  assert.strictEqual(result.result_event, null);
});

test('5.7 executeGithubBridgeRequest retorna attempt_event com subsystem=github_bridge', async () => {
  const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'fake-token');
  assert.ok(result.attempt_event);
  assert.strictEqual(result.attempt_event.subsystem, 'github_bridge');
  assert.strictEqual(result.attempt_event.status, 'blocked');
});

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(50)}`);
if (failed === 0) {
  console.log(`✅ Interop CJS/ESM validado: ${passed}/${passed + failed} testes passando`);
  console.log('   Todos os módulos CJS carregam corretamente e expõem exports via default import ESM.');
} else {
  console.error(`❌ ${failed} testes falharam (${passed} passando)`);
  process.exit(1);
}
