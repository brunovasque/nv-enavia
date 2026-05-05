/**
 * pr106-github-bridge-prova-real.prova.test.js — PR106
 * Prova real supervisionada: ciclo completo branch → commit → PR aberta sem merge
 *
 * Grupos sem token (sem fetch):
 *   - Grupo 1: Invariantes de create_commit (main/master bloqueado, content vazio)
 *   - Grupo 2: Invariantes de open_pr (campos obrigatórios)
 *   - Grupo 3: SUPPORTED_OPERATIONS e ALWAYS_BLOCKED completos
 *   - Grupo 4: Bloqueio de commit em main/master provado em ambas as camadas
 *
 * Grupo 5 — Prova real com GITHUB_TOKEN (opt-in):
 *   1. Criar branch test/pr106-prova-{timestamp}
 *   2. Commitar test/pr106-evidence.txt com conteúdo de evidência
 *   3. Abrir PR da branch de teste para main
 *   4. Confirmar PR aberta sem merge automático (merge_allowed=false)
 *   5. Limpar: fechar PR e deletar branch após prova
 *
 * Execução:
 *   node tests/pr106-github-bridge-prova-real.prova.test.js
 *   GITHUB_TOKEN=ghp_... node tests/pr106-github-bridge-prova-real.prova.test.js
 *
 * PR: PR106 — GitHub Bridge — Branch + Commit + PR Real Supervisionados
 */

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || null;
const TEST_REPO = 'brunovasque/nv-enavia';
const TIMESTAMP = Date.now();
const TEST_BRANCH = `test/pr106-prova-${TIMESTAMP}`;
const TEST_FILE = 'test/pr106-evidence.txt';
const USER_AGENT = 'enavia-pr106-prova/1.0';

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
// Grupo 1 — Invariantes de create_commit (sem fetch)
// ---------------------------------------------------------------------------

async function runGroup1() {
  console.log('\n[1] Invariantes de create_commit — bloqueios antes do fetch');

  await test('1.1 create_commit em "main" retorna blocked=true', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'main', file_path: 'test.txt', content: 'x', commit_message: 'test' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false, 'ok deve ser false');
    assert.strictEqual(result.executed, false, 'executed deve ser false');
    assert.strictEqual(result.github_execution, false, 'github_execution deve ser false');
    assert.strictEqual(result.blocked, true, 'blocked deve ser true');
    assert.ok(result.error && result.error.toLowerCase().includes('main'), `error deve mencionar "main", got: ${result.error}`);
  });

  await test('1.2 create_commit em "master" retorna blocked=true', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'master', file_path: 'test.txt', content: 'x', commit_message: 'test' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('master'), `error deve mencionar "master", got: ${result.error}`);
  });

  await test('1.3 create_commit com content vazio retorna erro antes do fetch', async () => {
    const start = Date.now();
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'feature/test', file_path: 'test.txt', content: '', commit_message: 'test' },
      'fake-token',
    );
    const elapsed = Date.now() - start;
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('content'), `error deve mencionar content, got: ${result.error}`);
    assert.ok(elapsed < 500, `bloqueio deve ser imediato, demorou ${elapsed}ms`);
  });

  await test('1.4 create_commit com branch ausente retorna erro', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: '', file_path: 'test.txt', content: 'x', commit_message: 'test' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('branch'), `error deve mencionar branch, got: ${result.error}`);
  });

  await test('1.5 create_commit sem token retorna erro GITHUB_TOKEN', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'feature/x', file_path: 'test.txt', content: 'x', commit_message: 'test' },
      null,
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.includes('GITHUB_TOKEN'), `error deve mencionar GITHUB_TOKEN, got: ${result.error}`);
  });

  await test('1.6 create_commit em feature branch não bloqueia antes do fetch (chega ao network)', async () => {
    // Com token inválido, deve tentar o fetch e retornar network error ou HTTP error (não bloqueio pré-fetch)
    // Este teste confirma que a branch de feature não é bloqueada pelo dispatcher
    const result = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'feature/test-pr106', file_path: 'test.txt', content: 'test content', commit_message: 'test' },
      'invalid-token-for-network-test',
    );
    // Deve ter tentado (executed=true ou error de rede/HTTP), não bloqueado duro (blocked não deve ser true)
    assert.ok(result.blocked !== true, 'feature branch não deve ser bloqueada antes do fetch');
    assert.strictEqual(result.github_execution, true, 'deve ter tentado a chamada real');
  });
}

// ---------------------------------------------------------------------------
// Grupo 2 — Invariantes de open_pr (sem fetch)
// ---------------------------------------------------------------------------

async function runGroup2() {
  console.log('\n[2] Invariantes de open_pr — campos obrigatórios');

  await test('2.1 open_pr sem title retorna erro', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'open_pr', repo: TEST_REPO, title: '', head: 'feature/x', base: 'main' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('title'), `error deve mencionar title, got: ${result.error}`);
  });

  await test('2.2 open_pr sem head retorna erro', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'open_pr', repo: TEST_REPO, title: 'Test PR', head: '', base: 'main' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('head'), `error deve mencionar head, got: ${result.error}`);
  });

  await test('2.3 open_pr sem base retorna erro', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'open_pr', repo: TEST_REPO, title: 'Test PR', head: 'feature/x', base: '' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    assert.ok(result.error && result.error.toLowerCase().includes('base'), `error deve mencionar base, got: ${result.error}`);
  });

  await test('2.4 open_pr sem token retorna erro GITHUB_TOKEN', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'open_pr', repo: TEST_REPO, title: 'Test', head: 'feature/x', base: 'main' },
      null,
    );
    assert.strictEqual(result.ok, false);
    assert.ok(result.error && result.error.includes('GITHUB_TOKEN'), `error deve mencionar GITHUB_TOKEN, got: ${result.error}`);
  });

  await test('2.5 token não aparece em nenhum campo da resposta de open_pr', async () => {
    const result = await adapterNs.executeGithubOperation(
      { type: 'open_pr', repo: TEST_REPO, title: '', head: 'x', base: 'main' },
      'super-secret-token-pr106',
    );
    const json = JSON.stringify(result);
    assert.ok(!json.includes('super-secret-token-pr106'), 'token não deve aparecer na resposta');
  });
}

// ---------------------------------------------------------------------------
// Grupo 3 — SUPPORTED_OPERATIONS e ALWAYS_BLOCKED completos
// ---------------------------------------------------------------------------

async function runGroup3() {
  console.log('\n[3] Constantes de invariante — SUPPORTED_OPERATIONS e ALWAYS_BLOCKED');

  await test('3.1 ALWAYS_BLOCKED contém merge, deploy_prod, secret_change', () => {
    assert.ok(Array.isArray(adapterNs.ALWAYS_BLOCKED));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('merge'));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('deploy_prod'));
    assert.ok(adapterNs.ALWAYS_BLOCKED.includes('secret_change'));
  });

  await test('3.2 SUPPORTED_OPERATIONS inclui as 4 operações PR106', () => {
    assert.ok(Array.isArray(adapterNs.SUPPORTED_OPERATIONS));
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('comment_pr'), 'deve incluir comment_pr');
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('create_branch'), 'deve incluir create_branch');
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('create_commit'), 'deve incluir create_commit');
    assert.ok(adapterNs.SUPPORTED_OPERATIONS.includes('open_pr'), 'deve incluir open_pr');
  });

  await test('3.3 merge bloqueado mesmo com token válido e operação válida', async () => {
    const result = await adapterNs.executeGithubOperation({ type: 'merge' }, 'any-token');
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
  });

  await test('3.4 PROTECTED_BRANCHES implica bloqueio em create_commit — nenhum dos dois executa fetch', async () => {
    const start = Date.now();
    const r1 = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'main', file_path: 'f.txt', content: 'x', commit_message: 'm' },
      'any-token',
    );
    const r2 = await adapterNs.executeGithubOperation(
      { type: 'create_commit', repo: TEST_REPO, branch: 'master', file_path: 'f.txt', content: 'x', commit_message: 'm' },
      'any-token',
    );
    const elapsed = Date.now() - start;
    assert.strictEqual(r1.blocked, true, 'main deve ser bloqueado');
    assert.strictEqual(r2.blocked, true, 'master deve ser bloqueado');
    assert.ok(elapsed < 1000, `bloqueios devem ser imediatos, demorou ${elapsed}ms`);
  });
}

// ---------------------------------------------------------------------------
// Grupo 4 — Bloqueio main/master em ambas as camadas (executeGithubBridgeRequest)
// ---------------------------------------------------------------------------

async function runGroup4() {
  console.log('\n[4] Bloqueio de commit em main/master — ambas as camadas');

  await test('4.1 executeGithubBridgeRequest bloqueia create_commit em main', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'create_commit', repo: TEST_REPO, branch: 'main', file_path: 'f.txt', content: 'x', commit_message: 'm' },
      'fake-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.github_execution, false);
    // Pode ser bloqueado pelo validate (que usa bridge PR103) ou pelo adapter diretamente
    assert.ok(result.blocked === true || result.executed === false, 'deve ser bloqueado ou não executado');
  });

  await test('4.2 attempt_event registrado mesmo para bloqueio em main', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'create_commit', repo: TEST_REPO, branch: 'main', file_path: 'f.txt', content: 'x', commit_message: 'm' },
      'fake-token',
    );
    // attempt_event deve existir (Safety Guard + Event Log rodam antes do bloqueio do adapter)
    assert.ok(result.attempt_event !== undefined, 'attempt_event deve estar presente');
  });

  await test('4.3 merge sempre bloqueado via executeGithubBridgeRequest', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'merge', repo: TEST_REPO },
      'any-token',
    );
    assert.strictEqual(result.ok, false);
    assert.strictEqual(result.blocked, true);
    assert.strictEqual(result.github_execution, false);
    assert.strictEqual(result.executed, false);
  });

  await test('4.4 token não aparece em nenhum campo da resposta de bloqueio de commit/main', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'create_commit', repo: TEST_REPO, branch: 'main', file_path: 'f.txt', content: 'x', commit_message: 'm' },
      'ultra-secret-token-pr106-test',
    );
    const json = JSON.stringify(result);
    assert.ok(!json.includes('ultra-secret-token-pr106-test'), 'token não deve aparecer na resposta');
  });
}

// ---------------------------------------------------------------------------
// Helpers para prova real (Grupo 5)
// ---------------------------------------------------------------------------

async function githubApiRequest(method, path, body, token) {
  const url = `https://api.github.com${path}`;
  const opts = {
    method,
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
      'User-Agent': USER_AGENT,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  };
  if (body !== undefined) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ok: res.ok, data };
}

async function closePr(prNumber, token) {
  return githubApiRequest('PATCH', `/repos/${TEST_REPO}/pulls/${prNumber}`, { state: 'closed' }, token);
}

async function deleteBranch(branchName, token) {
  return githubApiRequest('DELETE', `/repos/${TEST_REPO}/git/refs/heads/${encodeURIComponent(branchName)}`, undefined, token);
}

// ---------------------------------------------------------------------------
// Grupo 5 — Prova real com token (opt-in: requer GITHUB_TOKEN no env)
// ---------------------------------------------------------------------------

async function runGroup5() {
  if (!GITHUB_TOKEN) {
    console.log('\n[5] Prova real com GITHUB_TOKEN — PULADO (GITHUB_TOKEN não configurado)');
    console.log('    Para executar: GITHUB_TOKEN=ghp_... node tests/pr106-github-bridge-prova-real.prova.test.js');
    return;
  }

  console.log(`\n[5] Prova real com GITHUB_TOKEN — repo: ${TEST_REPO}`);
  console.log(`    Branch de teste: ${TEST_BRANCH}`);
  console.log('    ATENÇÃO: executará operações reais no GitHub (branch + commit + PR)');

  let createdPrNumber = null;

  // 5.1 Criar branch
  await test('5.1 create_branch real com SHA base dinâmico', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      { type: 'create_branch', repo: TEST_REPO, base_branch: 'main', head_branch: TEST_BRANCH },
      GITHUB_TOKEN,
    );
    assert.strictEqual(result.ok, true, `create_branch deve ter ok=true, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.github_execution, true, 'github_execution deve ser true');
    assert.strictEqual(result.executed, true, 'executed deve ser true');
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.ok(result.result_event, 'result_event deve existir após create_branch');
    assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0, 'evidência deve existir');
    const json = JSON.stringify(result);
    assert.ok(!json.includes(GITHUB_TOKEN), 'token não deve aparecer na resposta');
  });

  // 5.2 Commitar arquivo na nova branch
  await test('5.2 create_commit real com base64 na branch de teste', async () => {
    const evidenceContent = [
      `PR106 — Prova real supervisionada`,
      `Repo: ${TEST_REPO}`,
      `Branch: ${TEST_BRANCH}`,
      `Timestamp: ${new Date().toISOString()}`,
      `Ciclo: branch → commit → PR`,
      `merge_allowed: false`,
      `gate_humano: obrigatório`,
    ].join('\n');

    const result = await adapterNs.executeGithubBridgeRequest(
      {
        type: 'create_commit',
        repo: TEST_REPO,
        branch: TEST_BRANCH,
        file_path: TEST_FILE,
        content: evidenceContent,
        commit_message: `test(pr106): evidência de prova real — ${TIMESTAMP}`,
      },
      GITHUB_TOKEN,
    );
    assert.strictEqual(result.ok, true, `create_commit deve ter ok=true, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.github_execution, true, 'github_execution deve ser true');
    assert.strictEqual(result.executed, true, 'executed deve ser true');
    assert.ok(result.commit_sha, 'commit_sha deve estar presente');
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.ok(result.result_event, 'result_event deve existir');
    assert.ok(Array.isArray(result.evidence) && result.evidence.length > 0, 'evidência deve existir');
    const json = JSON.stringify(result);
    assert.ok(!json.includes(GITHUB_TOKEN), 'token não deve aparecer na resposta');
  });

  // 5.3 Abrir PR da branch de teste para main
  await test('5.3 open_pr real retorna número e URL da PR criada', async () => {
    const result = await adapterNs.executeGithubBridgeRequest(
      {
        type: 'open_pr',
        repo: TEST_REPO,
        title: `[PR106 prova real] branch+commit+PR supervisionados — ${TIMESTAMP}`,
        body: `Prova real do ciclo completo PR106.\n\nBranch: \`${TEST_BRANCH}\`\nTimestamp: ${new Date().toISOString()}\n\nEsta PR será fechada automaticamente após a prova.`,
        head: TEST_BRANCH,
        base: 'main',
      },
      GITHUB_TOKEN,
    );
    assert.strictEqual(result.ok, true, `open_pr deve ter ok=true, got: ${JSON.stringify(result)}`);
    assert.strictEqual(result.github_execution, true, 'github_execution deve ser true');
    assert.strictEqual(result.executed, true, 'executed deve ser true');
    assert.ok(result.pr_number, `pr_number deve estar presente, got: ${result.pr_number}`);
    assert.ok(result.html_url, `html_url deve estar presente, got: ${result.html_url}`);
    assert.strictEqual(result.merge_allowed, false, 'merge_allowed deve ser false — gate humano');
    assert.ok(result.attempt_event, 'attempt_event deve existir');
    assert.ok(result.result_event, 'result_event deve existir');
    const json = JSON.stringify(result);
    assert.ok(!json.includes(GITHUB_TOKEN), 'token não deve aparecer na resposta');

    createdPrNumber = result.pr_number;
    console.log(`         PR criada: #${createdPrNumber} — ${result.html_url}`);
  });

  // 5.4 Confirmar PR aberta sem merge automático
  await test('5.4 merge_allowed=false na PR criada (gate humano confirmado)', async () => {
    if (!createdPrNumber) {
      throw new Error('PR não foi criada — teste 5.3 falhou');
    }
    // Confirmar via API direta que PR está aberta e não mergeada
    const { status, data } = await githubApiRequest('GET', `/repos/${TEST_REPO}/pulls/${createdPrNumber}`, undefined, GITHUB_TOKEN);
    assert.strictEqual(status, 200, `GET PR deve retornar 200, got ${status}`);
    assert.strictEqual(data.state, 'open', 'PR deve estar aberta (não mergeada)');
    assert.ok(!data.merged, 'PR não deve estar mergeada — gate humano funcionando');
    console.log(`         PR #${createdPrNumber} state=${data.state} merged=${data.merged}`);
  });

  // 5.5 Limpeza: fechar PR e deletar branch após prova
  await test('5.5 limpeza: fechar PR de teste e deletar branch após prova', async () => {
    let cleanupErrors = [];

    if (createdPrNumber) {
      const closeResult = await closePr(createdPrNumber, GITHUB_TOKEN);
      if (closeResult.status !== 200) {
        cleanupErrors.push(`Falha ao fechar PR #${createdPrNumber}: HTTP ${closeResult.status}`);
      } else {
        console.log(`         PR #${createdPrNumber} fechada ✅`);
      }
    }

    const deleteResult = await deleteBranch(TEST_BRANCH, GITHUB_TOKEN);
    if (deleteResult.status !== 204) {
      cleanupErrors.push(`Falha ao deletar branch ${TEST_BRANCH}: HTTP ${deleteResult.status}`);
    } else {
      console.log(`         Branch ${TEST_BRANCH} deletada ✅`);
    }

    if (cleanupErrors.length > 0) {
      throw new Error(`Limpeza parcialmente falhou: ${cleanupErrors.join('; ')}`);
    }
  });
}

// ---------------------------------------------------------------------------
// Execução
// ---------------------------------------------------------------------------

async function main() {
  console.log('============================================================');
  console.log('PR106 — Prova real supervisionada: Branch + Commit + PR');
  console.log('============================================================');

  await runGroup1();
  await runGroup2();
  await runGroup3();
  await runGroup4();
  await runGroup5();

  console.log(`\n${'='.repeat(60)}`);
  if (failed === 0) {
    console.log(`✅ PR106 prova real: ${passed}/${passed + failed} testes passando`);
    if (!GITHUB_TOKEN) {
      console.log('   (Grupo 5 — ciclo real branch+commit+PR — pulado: GITHUB_TOKEN ausente)');
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
