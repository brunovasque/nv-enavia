// tests/pr108-integration.test.js
// Teste de integracao do ciclo completo PR108:
//   applyPatch → orchestrateGithubPR (mock do proxy GitHub)
//
// Valida: patch aplicado → branch gerada → commit → PR aberta
// Nao faz chamada real ao GitHub.

'use strict';

const { pathToFileURL } = require('url');
const path = require('path');

const patchEnginePath = path.resolve(__dirname, '../executor/src/patch-engine.js');
const orchestratorPath = path.resolve(__dirname, '../executor/src/github-orchestrator.js');

let passed = 0;
let failed = 0;

function ok(label, got, expected) {
  const match = JSON.stringify(got) === JSON.stringify(expected);
  if (match) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label}`);
    console.log(`     got:      ${JSON.stringify(got)}`);
    console.log(`     expected: ${JSON.stringify(expected)}`);
    failed++;
  }
}

function okTrue(label, value) {
  if (value === true) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (got: ${JSON.stringify(value)})`);
    failed++;
  }
}

function okFalse(label, value) {
  if (value === false) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (got: ${JSON.stringify(value)})`);
    failed++;
  }
}

// Cria env mock com ENAVIA_WORKER.fetch simulando o ciclo completo
function makeMockEnv(overrides = {}) {
  const callLog = [];
  const fetchResponses = overrides.fetchResponses || [
    { ok: true, branch_sha: 'abc123' },
    { ok: true, commit_sha: 'def456' },
    { ok: true, pr_number: 42, html_url: 'https://github.com/owner/repo/pull/42' },
  ];
  let callCount = 0;

  const mockFetch = async (url, opts) => {
    const body = opts && opts.body ? JSON.parse(opts.body) : {};
    callLog.push({ url, type: body.type });
    const resp = fetchResponses[callCount] || { ok: false, error: 'NO_MORE_RESPONSES' };
    callCount++;
    return {
      text: async () => JSON.stringify(resp),
    };
  };

  return {
    env: {
      ENAVIA_WORKER: { fetch: mockFetch },
    },
    callLog,
  };
}

(async () => {
  const { applyPatch } = await import(pathToFileURL(patchEnginePath).href);
  const { orchestrateGithubPR } = await import(pathToFileURL(orchestratorPath).href);

  console.log('\n[PR108] Integracao: applyPatch + orchestrateGithubPR\n');

  // ─── 1. Ciclo completo: patch aplicado → GitHub OK ───────────────────────
  console.log('[1] Ciclo completo bem-sucedido');
  {
    // search deve ser unico para evitar AMBIGUOUS_MATCH
    const original = 'const VERSION = "1.0.0"; // unico\n' + 'const OTHER = "x";\n'.repeat(30);
    const patches = [{ title: 'bump', search: 'const VERSION = "1.0.0"; // unico', replace: 'const VERSION = "2.0.0"; // unico' }];

    const patchResult = applyPatch(original, patches);
    okTrue('1.1 applyPatch ok', patchResult.ok);
    okTrue('1.2 candidate tem nova versao', patchResult.candidate && patchResult.candidate.includes('"2.0.0"'));

    const { env, callLog } = makeMockEnv();
    const orchResult = await orchestrateGithubPR(env, {
      workerId: 'nv-enavia',
      candidate: patchResult.candidate,
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
      patchTitle: 'Bump version',
    });

    okTrue('1.3 orchResult.ok', orchResult.ok);
    okFalse('1.4 merge_allowed=false', orchResult.merge_allowed);
    okTrue('1.5 branch gerada', typeof orchResult.branch === 'string' && orchResult.branch.startsWith('enavia/self-patch-'));
    ok('1.6 pr_number correto', orchResult.pr_number, 42);
    ok('1.7 pr_url correto', orchResult.pr_url, 'https://github.com/owner/repo/pull/42');
    ok('1.8 commit_sha correto', orchResult.commit_sha, 'def456');
    ok('1.9 3 chamadas ao proxy', callLog.length, 3);
    ok('1.10 etapa 1 = create_branch', callLog[0].type, 'create_branch');
    ok('1.11 etapa 2 = create_commit', callLog[1].type, 'create_commit');
    ok('1.12 etapa 3 = open_pr', callLog[2].type, 'open_pr');
  }

  // ─── 2. Falha na etapa create_branch — para imediatamente ─────────────────
  console.log('[2] Falha em create_branch');
  {
    const { env } = makeMockEnv({
      fetchResponses: [
        { ok: false, error: 'BRANCH_ALREADY_EXISTS' },
      ],
    });

    const r = await orchestrateGithubPR(env, {
      workerId: 'nv-enavia',
      candidate: 'console.log("ok");',
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
    });

    okFalse('2.1 ok=false', r.ok);
    ok('2.2 step=create_branch', r.step, 'create_branch');
    ok('2.3 error preservado', r.error, 'BRANCH_ALREADY_EXISTS');
    okFalse('2.4 merge_allowed=false', r.merge_allowed);
  }

  // ─── 3. Falha em create_commit — branch criada mas sem commit ─────────────
  console.log('[3] Falha em create_commit');
  {
    const { env } = makeMockEnv({
      fetchResponses: [
        { ok: true, branch_sha: 'aaa' },
        { ok: false, error: 'COMMIT_FAILED' },
      ],
    });

    const r = await orchestrateGithubPR(env, {
      workerId: 'nv-enavia',
      candidate: 'console.log("ok");',
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
    });

    okFalse('3.1 ok=false', r.ok);
    ok('3.2 step=create_commit', r.step, 'create_commit');
    okTrue('3.3 branch presente no erro', typeof r.branch === 'string');
    okFalse('3.4 merge_allowed=false', r.merge_allowed);
  }

  // ─── 4. Falha em open_pr ──────────────────────────────────────────────────
  console.log('[4] Falha em open_pr');
  {
    const { env } = makeMockEnv({
      fetchResponses: [
        { ok: true, branch_sha: 'aaa' },
        { ok: true, commit_sha: 'bbb' },
        { ok: false, error: 'PR_CREATION_FAILED' },
      ],
    });

    const r = await orchestrateGithubPR(env, {
      workerId: 'nv-enavia',
      candidate: 'console.log("ok");',
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
    });

    okFalse('4.1 ok=false', r.ok);
    ok('4.2 step=open_pr', r.step, 'open_pr');
    okTrue('4.3 commit_sha presente', typeof r.commit_sha === 'string');
    okFalse('4.4 merge_allowed=false', r.merge_allowed);
  }

  // ─── 5. Candidato vazio bloqueado antes de chamar o proxy ─────────────────
  console.log('[5] Candidato vazio — bloqueio pre-check');
  {
    const { env, callLog } = makeMockEnv();
    const r = await orchestrateGithubPR(env, {
      workerId: 'nv-enavia',
      candidate: '   ',
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
    });

    okFalse('5.1 ok=false', r.ok);
    ok('5.2 error=EMPTY_CANDIDATE', r.error, 'EMPTY_CANDIDATE');
    ok('5.3 step=pre_check', r.step, 'pre_check');
    ok('5.4 nenhuma chamada ao proxy', callLog.length, 0);
  }

  // ─── 6. Sem binding ENAVIA_WORKER ─────────────────────────────────────────
  console.log('[6] ENAVIA_WORKER binding ausente');
  {
    const r = await orchestrateGithubPR({}, {
      workerId: 'nv-enavia',
      candidate: 'console.log("x");',
      filePath: 'nv-enavia.js',
      repo: 'brunovasque/nv-enavia',
    });

    ok('6.1 error=ENAVIA_WORKER_BINDING_ABSENT', r.error, 'ENAVIA_WORKER_BINDING_ABSENT');
    ok('6.2 step=pre_check', r.step, 'pre_check');
    okFalse('6.3 merge_allowed=false', r.merge_allowed);
  }

  // ─── 7. Branch nunca e main ou master ─────────────────────────────────────
  console.log('[7] Branch gerada nunca e main/master');
  {
    const { env } = makeMockEnv();
    const r = await orchestrateGithubPR(env, {
      workerId: 'test-worker',
      candidate: 'const x = 1;\n'.repeat(20),
      filePath: 'test.js',
      repo: 'owner/repo',
      baseBranch: 'main',
    });

    okTrue('7.1 branch comeca com enavia/self-patch-', r.branch && r.branch.startsWith('enavia/self-patch-'));
    okTrue('7.2 branch nao e main', r.branch !== 'main');
    okTrue('7.3 branch nao e master', r.branch !== 'master');
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  if (failed === 0) {
    console.log(`✅ PR108 integracao: ${passed}/${total} testes passando`);
  } else {
    console.log(`❌ PR108 integracao: ${failed} falhas de ${total}`);
    process.exit(1);
  }
})();
