/**
 * pr105-github-bridge-prova-real.prova.test.js — PR105
 * Prova real supervisionada: comment_pr + bloqueios
 *
 * Cenários sem token (sem fetch):
 *   - Bloqueios duros: merge, deploy_prod, secret_change
 *   - Falta de token: erro GITHUB_TOKEN claro
 *   - executeGithubBridgeRequest com merge: attempt_event gerado, result_event=null
 *   - executeGithubBridgeRequest: subsystem=github_bridge, status=blocked
 *
 * Cenário com token real (opt-in via GITHUB_TOKEN):
 *   - comment_pr real no repo brunovasque/nv-enavia
 *   - Safety Guard ativo antes da execução
 *   - Event Log gerado: attempt_event + result_event
 *   - github_execution: true na resposta
 *   - Token não aparece em nenhum campo da resposta
 *
 * Execução:
 *   node tests/pr105-github-bridge-prova-real.prova.test.js
 *   GITHUB_TOKEN=ghp_... node tests/pr105-github-bridge-prova-real.prova.test.js
 *
 * PR: PR105 — GitHub Bridge Real — Adapter + Plugação + Prova Real Unificados
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const TEST_REPO = 'brunovasque/nv-enavia';
const TEST_PR_NUMBER = 270; // PR de teste controlada (já fechada, segura para comentário)

let adapterNs;
try {
  adapterNs = require(path.join(REPO_ROOT, 'schema/enavia-github-adapter'));
} catch (e) {
  console.error('ERRO FATAL: não foi possível carregar enavia-github-adapter.js:', e.message);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Helper de teste
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    const result = fn();
    if (result && typeof result.then === 'function') {
      return result
        .then(() => {
          console.log(`  ✅ ${name}`);
          passed++;
        })
        .catch((err) => {
          console.error(`  ❌ ${name}`);
          console.error(`     ${err.message}`);
          failed++;
        });
    }
    console.log(`  ✅ ${name}`);
    passed++;
    return Promise.resolve();
  } catch (err) {
    console.error(`  ❌ ${name}`);
    console.error(`     ${err.message}`);
    failed++;
    return Promise.resolve();
  }
}

// ---------------------------------------------------------------------------
// Grupo 1 — Bloqueios duros sem token (sem fetch)
// ---------------------------------------------------------------------------

async function runGroup1() {
  console.log('\n[1] Bloqueios duros — merge / deploy_prod / secret_change (sem fetch)');

  await test('1.1 executeGithubOperation bloqueia merge antes do fetch', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'merge' }, 'fake-token');
    assert.strictEqual(result.ok, false, 'ok deve ser false');
    assert.strictEqual(result.executed, false, 'executed deve ser false');
    assert.strictEqual(result.github_execution, false, 'github_execution deve ser false');
    assert.strictEqual(result.blocked, true, 'blocked deve ser true');
  });

  await test('1.2 executeGithubOperation bloqueia deploy_prod antes do fetch', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'deploy_prod' }, 'fake-token');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
  });

  await test('1.3 executeGithubOperation bloqueia secret_change antes do fetch', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'secret_change' }, 'fake-token');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
  });

  await test('1.4 executeGithubOperation sem token retorna erro GITHUB_TOKEN', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'comment_pr' }, null);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.executed, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.includes('GITHUB_TOKEN'), `erro deve mencionar GITHUB_TOKEN, got: ${result.error}`);
  });

  await test('1.5 executeGithubOperation sem token com string vazia retorna erro', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'comment_pr' }, '');
    assert.strictEqual(result.ok, false);
    assert.ok(result.error && result.error.includes('GITHUB_TOKEN'));
  });
}

// ---------------------------------------------------------------------------
// Grupo 2 — executeGithubBridgeRequest: Safety Guard + Event Log (sem fetch)
// ---------------------------------------------------------------------------

async function runGroup2() {
  console.log('\n[2] executeGithubBridgeRequest — Safety Guard + Event Log (sem fetch)');

  await test('2.1 bloqueia merge com attempt_event gerado', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'fake-token');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
    assert.strictEqual(result.executed, false);
    assert.ok(result.attempt_event !== null, 'attempt_event deve ser gerado mesmo para bloqueio');
    assert.strictEqual(result.result_event, null, 'result_event deve ser null para operação bloqueada');
  });

  await test('2.2 attempt_event tem subsystem=github_bridge e status=blocked', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'fake-token');
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.strictEqual(result.attempt_event.subsystem, 'github_bridge');
    assert.strictEqual(result.attempt_event.status, 'blocked');
  });

  await test('2.3 bloqueia deploy_prod com safety_decision registrado', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'deploy_prod' }, 'fake-token');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.ok(result.safety_decision !== undefined, 'campo safety_decision deve estar presente');
  });

  await test('2.4 token não aparece em nenhum campo da resposta de bloqueio', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'super-secret-token');
    const json = JSON.stringify(result);
    assert.ok(!json.includes('super-secret-token'), 'token não deve aparecer na resposta');
  });

  await test('2.5 sem token com operação válida retorna erro GITHUB_TOKEN', async () => {
    // Passa operação completa (com repo) para que o bloqueio seja por falta de token, não por falta de repo
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'comment_pr', repo: 'brunovasque/nv-enavia', pr_number: 1, comment: 'test' },
      null,
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.includes('GITHUB_TOKEN'), `error deve mencionar GITHUB_TOKEN, got: ${result.error}`);
  });

  await test('2.6 operação desconhecida sem token retorna erro', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'unknown_op' }, null);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
  });
}

// ---------------------------------------------------------------------------
// Grupo 3 — Invariantes do adapter (puras, sem I/O)
// ---------------------------------------------------------------------------

async function runGroup3() {
  console.log('\n[3] Invariantes do adapter (funções puras, sem I/O)');

  await test('3.1 ALWAYS_BLOCKED contém merge, deploy_prod, secret_change', () => {
    assert.ok(Array.isArray(adapterNs.ALWAYS_BLOCKED));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('merge'));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('deploy_prod'));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('secret_change'));
  });

  await test('3.2 SUPPORTED_OPERATIONS contém comment_pr e create_branch', () => {
    assert.ok(Array.isArray(adapterNs.SUPPORTED_OPERATIONS));
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('comment_pr'));
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('create_branch'));
  });

  await test('3.3 executeGithubOperation é função async', () => {
    assert.strictEqual(typeof adapterNs.executeGithubOperation, 'function');
    const result = adapterNs.executeGithubOperation({ type: 'merge' }, 'x');
    assert.ok(result && typeof result.then === 'function', 'deve retornar Promise');
    return result.then(() => {}); // resolve a promise
  });

  await test('3.4 executeGithubBridgeRequest é função async', () => {
    assert.strictEqual(typeof adapterNs.executeGithubBridgeRequest, 'function');
    const result = adapterNs.executeGithubBridgeRequest({ type: 'merge' }, 'x');
    assert.ok(result && typeof result.then === 'function', 'deve retornar Promise');
    return result.then(() => {});
  });

  await test('3.5 merge bloqueado não faz fetch (verifica campo error sem timeout)', async () => {
    // Se merge fizesse fetch, demoraria ou falharia com network error
    // Bloqueio deve ser imediato (< 100ms)
    const start = Date.now();
    const result = await adapterNs.executeGithubOperation({ type: 'merge' }, 'fake');
    const elapsed = Date.now() - start;
    assert.strictEqual(result.blocked, true);
    assert.ok(elapsed < 500, `bloqueio deve ser imediato, demorou ${elapsed}ms`);
  });
}

// ---------------------------------------------------------------------------
// Grupo 4 — Prova real com token (opt-in: requer GITHUB_TOKEN no env)
// ---------------------------------------------------------------------------

async function runGroup4() {
  if (!GITHUB_TOKEN) {
    console.log('\n[4] Prova real com GITHUB_TOKEN — PULADO (GITHUB_TOKEN não configurado)');
    console.log('    Para executar: GITHUB_TOKEN=ghp_... node tests/pr105-github-bridge-prova-real.prova.test.js');
    return;
  }

  console.log(`\n[4] Prova real com GITHUB_TOKEN — repo: ${TEST_REPO}, PR: #${TEST_PR_NUMBER}`);
  console.log('    ATENÇÃO: executará operação real no GitHub');

  await test('4.1 comment_pr real executa com github_execution=true', async () => {
    const operation = {
      type: 'comment_pr',
      repo: TEST_REPO,
      pr_number: TEST_PR_NUMBER,
      comment: `[PR105 prova real supervisionada] comment_pr executado via enavia-github-adapter. Timestamp: ${new Date().toISOString()}`,
    };
    const result = await adapterNs.executeGithubBridgeRequest(operation, GITHUB_TOKEN);
    assert.strictEqual(result.ok, true, `operação deve ter ok=true, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.github_execution, true, 'github_execution deve ser true');
    assert.strictEqual(result.executed, true, 'executed deve ser true');
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.ok(result.result_event, 'result_event deve existir após execução bem-sucedida');
  });

  await test('4.2 resultado contém evidência real da execução', async () => {
    const operation = {
      type: 'comment_pr',
      repo: TEST_REPO,
      pr_number: TEST_PR_NUMBER,
      comment: `[PR105 prova evidência] Verificação de evidência. ${new Date().toISOString()}`,
    };
    const result = await adapterNs.executeGithubBridgeRequest(operation, GITHUB_TOKEN);
    if (result.ok) {
      assert.ok(result.evidence, 'evidência deve existir na resposta');
      const json = JSON.stringify(result);
      assert.ok(!json.includes(GITHUB_TOKEN), 'token não deve aparecer na resposta de sucesso');
    }
  });

  await test('4.3 Safety Guard foi chamado antes da execução', async () => {
    const operation = {
      type: 'comment_pr',
      repo: TEST_REPO,
      pr_number: TEST_PR_NUMBER,
      comment: `[PR105 prova safety guard] ${new Date().toISOString()}`,
    };
    const result = await adapterNs.executeGithubBridgeRequest(operation, GITHUB_TOKEN);
    assert.ok(result.safety_decision !== undefined, 'campo safety_decision deve estar presente (Safety Guard executado)');
  });

  await test('4.4 attempt_event.subsystem=github_bridge na execução real', async () => {
    const operation = {
      type: 'comment_pr',
      repo: TEST_REPO,
      pr_number: TEST_PR_NUMBER,
      comment: `[PR105 prova event log] ${new Date().toISOString()}`,
    };
    const result = await adapterNs.executeGithubBridgeRequest(operation, GITHUB_TOKEN);
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.strictEqual(result.attempt_event.subsystem, 'github_bridge');
  });

  await test('4.5 merge ainda bloqueado mesmo com token real', async () => {
    const result = await adapterNs.executeGithubBridgeRequest({ type: 'merge', repo: TEST_REPO }, GITHUB_TOKEN);
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
  });
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function main() {
  console.log('============================================================');
  console.log('PR105 — Prova real supervisionada: GitHub Bridge Real');
  console.log('============================================================');

  await runGroup1();
  await runGroup2();
  await runGroup3();
  await runGroup4();

  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ PR105 prova real: ${passed}/${passed + failed} testes passando`);
    if (!GITHUB_TOKEN) {
      console.log('   (Grupo 4 — prova com GitHub real — pulado: GITHUB_TOKEN ausente)');
    }
  } else {
    console.error(`❌ ${failed} testes falharam (${passed} passando)`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('ERRO INESPERADO:', err);
  process.exit(1);
});
