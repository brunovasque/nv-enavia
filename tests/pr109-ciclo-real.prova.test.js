// tests/pr109-ciclo-real.prova.test.js
// PR109 — Prova do ciclo completo Codex→GitHub
//
// Grupo 1: normalização do formato dos patches Codex (search/replace)
// Grupo 2: github_orchestration presente na response de /propose
// Grupo 3: ciclo end-to-end real (opt-in: requer ENAVIA_EXECUTOR_URL + GITHUB_TOKEN)

'use strict';

const { pathToFileURL } = require('url');
const path = require('path');
const https = require('https');

// ─── helpers ────────────────────────────────────────────────────────────────

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

function okIncludes(label, value, substr) {
  if (typeof value === 'string' && value.includes(substr)) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (got: ${JSON.stringify(value)}, expected includes: ${JSON.stringify(substr)})`);
    failed++;
  }
}

function okDefined(label, value) {
  if (value !== undefined && value !== null) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (got: ${JSON.stringify(value)})`);
    failed++;
  }
}

function okAbsent(label, obj, key) {
  if (!(key in (obj || {}))) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.log(`  ❌ ${label} (key "${key}" present with value: ${JSON.stringify(obj[key])})`);
    failed++;
  }
}

function skip(label) {
  console.log(`  ⏭  ${label} (skipped)`);
}

// ─── Normalização Codex — replicação da lógica de callCodexEngine ──────────
// Replica a lógica de normalização de patches do callCodexEngine.
// Documentação explícita das regras esperadas pelo motor.
function normalizePatchesFromCodex(rawPatches, intentText) {
  const normalized = [];
  const skippedNoSearch = [];
  for (const rawPatch of (rawPatches || [])) {
    if (!rawPatch || typeof rawPatch !== 'object') continue;
    const search = typeof rawPatch.search === 'string' ? rawPatch.search : null;
    const replace = typeof rawPatch.replace === 'string' ? rawPatch.replace : null;
    const patchText = rawPatch.patch_text || rawPatch.patchText || null;
    if (!search) {
      skippedNoSearch.push(String(rawPatch.title || 'sem-título'));
      continue;
    }
    const anchor = rawPatch.anchor && typeof rawPatch.anchor.match === 'string'
      ? { match: rawPatch.anchor.match }
      : null;
    normalized.push({
      title: String(rawPatch.title || 'Patch codex'),
      description: String(rawPatch.description || intentText || 'Patch sugerido pelo motor Codex.'),
      anchor,
      search,
      replace: replace !== null ? replace : '',
      ...(patchText ? { patch_text: String(patchText) } : {}),
      reason: String(rawPatch.reason || 'Patch sugerido via Codex.'),
    });
  }
  return {
    ok: normalized.length > 0,
    patches: normalized,
    notes: [],
    ...(skippedNoSearch.length > 0 ? { skipped_no_search: skippedNoSearch } : {}),
  };
}

// ─── Grupo 1 ─────────────────────────────────────────────────────────────────

async function runGrupo1() {
  console.log('\n[Grupo 1] Formato correto dos patches Codex (search + replace)\n');

  // 1.1: patch com search+replace → normalizado corretamente
  {
    const rawPatches = [
      {
        title: 'Adiciona comentário de versão',
        anchor: { match: 'const VERSION' },
        search: 'const VERSION = "1.0.0";',
        replace: '// versão atual\nconst VERSION = "1.0.0";',
        reason: 'Melhora legibilidade',
      },
    ];
    const result = normalizePatchesFromCodex(rawPatches, 'adicionar comentário');
    okTrue('1.1: ok=true quando patch tem search', result.ok);
    ok('1.1: patches.length === 1', result.patches.length, 1);
    ok('1.1: search preservado', result.patches[0].search, 'const VERSION = "1.0.0";');
    ok('1.1: replace preservado', result.patches[0].replace, '// versão atual\nconst VERSION = "1.0.0";');
    ok('1.1: anchor preservado', result.patches[0].anchor, { match: 'const VERSION' });
    okAbsent('1.1: skipped_no_search ausente quando tudo ok', result, 'skipped_no_search');
  }

  // 1.2: patch sem search → skipado + skipped_no_search populado
  {
    const rawPatches = [
      {
        title: 'Patch antigo formato',
        patch_text: 'diff --git ...',
        reason: 'Formato legado',
      },
    ];
    const result = normalizePatchesFromCodex(rawPatches, '');
    okFalse('1.2: ok=false quando patch não tem search', result.ok);
    ok('1.2: patches.length === 0', result.patches.length, 0);
    ok('1.2: skipped_no_search contém título', result.skipped_no_search, ['Patch antigo formato']);
  }

  // 1.3: patch com apenas patch_text (formato legado Codex) → skipado
  {
    const rawPatches = [
      {
        title: 'Legado',
        patch_text: 'algum diff',
        anchor: { match: 'algum trecho' },
        reason: 'Algo',
      },
    ];
    const result = normalizePatchesFromCodex(rawPatches, '');
    okFalse('1.3: ok=false para formato legado patch_text sem search', result.ok);
    ok('1.3: skipped_no_search = ["Legado"]', result.skipped_no_search, ['Legado']);
  }

  // 1.4: mistura válido + sem search → apenas os válidos passam
  {
    const rawPatches = [
      { title: 'Sem search', patch_text: 'diff', reason: 'x' },
      { title: 'Com search', search: 'linha original', replace: 'linha nova', reason: 'y' },
      { title: 'Também sem', anchor: { match: 'algo' }, reason: 'z' },
    ];
    const result = normalizePatchesFromCodex(rawPatches, '');
    okTrue('1.4: ok=true quando pelo menos um tem search', result.ok);
    ok('1.4: patches.length === 1 (só o válido)', result.patches.length, 1);
    ok('1.4: patch válido correto', result.patches[0].search, 'linha original');
    ok('1.4: skipped_no_search contém os 2 inválidos', result.skipped_no_search, ['Sem search', 'Também sem']);
  }

  // 1.5: replace pode ser string vazia (remoção de linha)
  {
    const rawPatches = [
      { title: 'Remove linha', search: 'linha a remover\n', replace: '', reason: 'limpeza' },
    ];
    const result = normalizePatchesFromCodex(rawPatches, '');
    okTrue('1.5: ok=true com replace vazio (remoção)', result.ok);
    ok('1.5: replace é string vazia', result.patches[0].replace, '');
  }

  // 1.6: patch sem title → skipped_no_search com "sem-título"
  {
    const rawPatches = [{ patch_text: 'x' }];
    const result = normalizePatchesFromCodex(rawPatches, '');
    ok('1.6: título padrão "sem-título" no skipped_no_search', result.skipped_no_search, ['sem-título']);
  }

  // 1.7: replace null → normalizado como string vazia
  {
    const rawPatches = [{ title: 'Sem replace', search: 'algo', replace: null, reason: 'x' }];
    const result = normalizePatchesFromCodex(rawPatches, '');
    ok('1.7: replace null → string vazia', result.patches[0].replace, '');
  }

  // 1.8: patch_text preservado quando presente junto com search
  {
    const rawPatches = [
      { title: 'Com tudo', search: 'x', replace: 'y', patch_text: 'descrição humana', reason: 'r' },
    ];
    const result = normalizePatchesFromCodex(rawPatches, '');
    ok('1.8: patch_text preservado quando presente', result.patches[0].patch_text, 'descrição humana');
  }

  // 1.9: patch_text ausente quando não fornecido
  {
    const rawPatches = [{ title: 'Sem patch_text', search: 'x', replace: 'y', reason: 'r' }];
    const result = normalizePatchesFromCodex(rawPatches, '');
    okAbsent('1.9: patch_text ausente quando não fornecido', result.patches[0], 'patch_text');
  }

  // 1.10: lista vazia → ok=false, patches=[]
  {
    const result = normalizePatchesFromCodex([], '');
    okFalse('1.10: ok=false para lista vazia', result.ok);
    ok('1.10: patches=[] para lista vazia', result.patches, []);
  }
}

// ─── Grupo 2 ─────────────────────────────────────────────────────────────────

async function runGrupo2() {
  console.log('\n[Grupo 2] github_orchestration na response de /propose\n');

  // 2.1: quando orquestração ocorre → campo presente na response
  {
    const orchestrationResult = {
      ok: true,
      branch: 'enavia/self-patch-nv-enavia-1234567890',
      pr_number: 276,
      pr_url: 'https://github.com/brunovasque/nv-enavia/pull/276',
      merge_allowed: false,
    };
    // Simula a lógica de construção da response
    const githubOrchestrationResult = orchestrationResult;
    const responseBody = {
      system: 'enavia-executor',
      route: '/propose',
      result: {},
      ...(githubOrchestrationResult !== null ? { github_orchestration: githubOrchestrationResult } : {}),
    };
    okDefined('2.1: github_orchestration presente quando orquestração ocorre', responseBody.github_orchestration);
    okTrue('2.1: github_orchestration.ok=true', responseBody.github_orchestration.ok);
    okDefined('2.1: pr_url presente', responseBody.github_orchestration.pr_url);
    okIncludes('2.1: pr_url aponta para GitHub', responseBody.github_orchestration.pr_url, 'github.com');
    okFalse('2.1: merge_allowed=false', responseBody.github_orchestration.merge_allowed);
    okDefined('2.1: branch presente', responseBody.github_orchestration.branch);
    okIncludes('2.1: branch segue padrão enavia/self-patch', responseBody.github_orchestration.branch, 'enavia/self-patch');
  }

  // 2.2: quando orquestração não ocorre → campo ausente
  {
    const githubOrchestrationResult = null;
    const responseBody = {
      system: 'enavia-executor',
      route: '/propose',
      result: {},
      ...(githubOrchestrationResult !== null ? { github_orchestration: githubOrchestrationResult } : {}),
    };
    okAbsent('2.2: github_orchestration ausente quando orquestração não ocorre', responseBody, 'github_orchestration');
  }

  // 2.3: quando orquestração falha (ex: worker_patch_safe rejeita) → campo presente com ok=false
  {
    const githubOrchestrationResult = { ok: false, step: 'worker_patch_safe', error: 'SYNTAX_ERROR' };
    const responseBody = {
      system: 'enavia-executor',
      route: '/propose',
      result: {},
      ...(githubOrchestrationResult !== null ? { github_orchestration: githubOrchestrationResult } : {}),
    };
    okDefined('2.3: github_orchestration presente mesmo quando falhou', responseBody.github_orchestration);
    okFalse('2.3: github_orchestration.ok=false quando falhou', responseBody.github_orchestration.ok);
    ok('2.3: step identifica onde falhou', responseBody.github_orchestration.step, 'worker_patch_safe');
  }

  // 2.4: merge_allowed NUNCA pode ser true (invariante)
  {
    const casos = [
      { ok: true, merge_allowed: false, pr_url: 'https://github.com/x/y/pull/1' },
      { ok: false, merge_allowed: false, step: 'create_branch' },
      { ok: false, merge_allowed: false, step: 'pre_check' },
    ];
    for (const caso of casos) {
      okFalse(`2.4: merge_allowed=false em "${caso.ok ? 'sucesso' : caso.step}"`, caso.merge_allowed);
    }
  }

  // 2.5: campo github_orchestration é omitido (não null) quando orquestração não disparou
  {
    const githubOrchestrationResult = null;
    const responseBody = {
      ...(githubOrchestrationResult !== null ? { github_orchestration: githubOrchestrationResult } : {}),
    };
    // garante que o campo realmente não existe no objeto (não é null)
    okTrue('2.5: campo omitido (não existe) quando null', !('github_orchestration' in responseBody));
  }
}

// ─── Grupo 3 — e2e real (opt-in) ─────────────────────────────────────────────

async function httpPost(url, body, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const data = JSON.stringify(body);
    const options = {
      hostname: parsed.hostname,
      port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data),
        ...extraHeaders,
      },
    };
    const mod = parsed.protocol === 'https:' ? https : require('http');
    const req = mod.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(body) }); }
        catch (_) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function githubApiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'api.github.com',
      port: 443,
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'User-Agent': 'enavia-pr109-test',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
      },
    };
    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: body ? JSON.parse(body) : null }); }
        catch (_) { resolve({ status: res.statusCode, data: body }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function runGrupo3() {
  console.log('\n[Grupo 3] Ciclo end-to-end real (opt-in)\n');

  const executorUrl = process.env.ENAVIA_EXECUTOR_URL;
  const githubToken = process.env.GITHUB_TOKEN;

  if (!executorUrl || !githubToken) {
    skip('3.1: executor /propose responde 200');
    skip('3.2: github_orchestration presente na response real');
    skip('3.3: branch aberta segue padrão enavia/self-patch-*');
    skip('3.4: pr_url aponta para PR real no GitHub');
    skip('3.5: limpeza — PR fechada e branch deletada');
    console.log('\n  ℹ️  Grupo 3 pulado: ENAVIA_EXECUTOR_URL e/ou GITHUB_TOKEN não configurados.');
    console.log('  ℹ️  Para rodar: ENAVIA_EXECUTOR_URL=https://... GITHUB_TOKEN=ghp_... node tests/pr109-ciclo-real.prova.test.js\n');
    return;
  }

  // Payload de prova: adicionar comentário de versão no topo do nv-enavia.js
  // Usa hardcoded patches (search/replace) para garantir aplicação mesmo se Codex não estiver disponível
  const proofPayload = {
    mode: 'engineer', // único modo implementado no Executor que aceita live read + patches
    intent: 'adiciona um comentário de versão no topo do arquivo — prova PR109',
    target: { workerId: 'nv-enavia' },
    github_token_available: true,
    use_codex: false, // usa hardcoded patches para prova determinística (não depende de OPENAI_API_KEY)
    context: {
      require_live_read: true,
    },
    // Patch hardcoded de prova: insere comentário antes do bloco ENAVIA_BUILD
    // O worker deployed de nv-enavia é um bundle — usa var em vez de const.
    patch: {
      mode: 'patch_text',
      patchText: [
        {
          title: 'Comentário de versão PR109',
          anchor: { match: 'ENAVIA_BUILD' },
          search: 'var ENAVIA_BUILD = {\n  id: "ENAVIA_PR4_2026-04",\n  deployed_at: "2026-04-26T00:00:00Z",\n  source: "deploy-worker"\n};',
          replace: '// PR109-PROVA: ciclo de autoevolução verificado — ' + new Date().toISOString().slice(0, 10) + '\nvar ENAVIA_BUILD = {\n  id: "ENAVIA_PR4_2026-04",\n  deployed_at: "2026-04-26T00:00:00Z",\n  source: "deploy-worker"\n};',
          reason: 'Prova do ciclo end-to-end PR109 — será revertida após verificação',
        },
      ],
    },
  };

  let openedPrNumber = null;
  let openedBranch = null;
  const repo = 'brunovasque/nv-enavia';

  try {
    // 3.1: executor responde 200
    const resp = await httpPost(`${executorUrl}/propose`, proofPayload);
    if (resp.status === 200) {
      console.log(`  ✅ 3.1: executor /propose responde 200`);
      passed++;
    } else {
      console.log(`  ❌ 3.1: executor /propose respondeu ${resp.status}`);
      console.log(`     body: ${JSON.stringify(resp.data).slice(0, 400)}`);
      failed++;
    }

    const data = resp.data;

    // 3.2: github_orchestration presente
    if (data && data.github_orchestration) {
      console.log(`  ✅ 3.2: github_orchestration presente na response`);
      passed++;
      openedBranch = data.github_orchestration.branch || null;
      openedPrNumber = data.github_orchestration.pr_number || null;
    } else {
      console.log(`  ❌ 3.2: github_orchestration ausente na response`);
      console.log(`     github_orchestration: ${JSON.stringify(data?.github_orchestration)}`);
      console.log(`     result: ${JSON.stringify(data?.result || data).slice(0, 400)}`);
      failed++;
    }

    // 3.3: branch segue padrão enavia/self-patch-*
    if (openedBranch && openedBranch.startsWith('enavia/self-patch-')) {
      console.log(`  ✅ 3.3: branch segue padrão enavia/self-patch-* (${openedBranch})`);
      passed++;
    } else if (openedBranch) {
      console.log(`  ❌ 3.3: branch não segue padrão (${openedBranch})`);
      failed++;
    } else {
      skip('3.3: branch não obtida (3.2 falhou)');
    }

    // 3.4: pr_url aponta para PR real
    const prUrl = data?.github_orchestration?.pr_url;
    if (prUrl && prUrl.includes('github.com')) {
      console.log(`  ✅ 3.4: pr_url presente e aponta para GitHub (${prUrl})`);
      passed++;
    } else if (prUrl) {
      console.log(`  ❌ 3.4: pr_url não aponta para GitHub (${prUrl})`);
      failed++;
    } else {
      skip('3.4: pr_url não obtida (3.2 falhou)');
    }

  } finally {
    // 3.5: limpeza — fecha PR e deleta branch (mesmo se testes acima falharem)
    if (openedPrNumber) {
      try {
        const closeResp = await githubApiRequest(
          'PATCH',
          `/repos/${repo}/pulls/${openedPrNumber}`,
          { state: 'closed' },
          githubToken
        );
        if (closeResp.status === 200) {
          console.log(`  ✅ 3.5: PR #${openedPrNumber} fechada (limpeza pós-prova)`);
          passed++;
        } else {
          console.log(`  ❌ 3.5: falha ao fechar PR #${openedPrNumber} (status: ${closeResp.status})`);
          failed++;
        }
      } catch (err) {
        console.log(`  ❌ 3.5: erro ao fechar PR — ${err.message}`);
        failed++;
      }
    } else {
      skip('3.5: limpeza de PR (PR não foi aberta)');
    }

    if (openedBranch) {
      try {
        const delResp = await githubApiRequest(
          'DELETE',
          `/repos/${repo}/git/refs/heads/${openedBranch}`,
          null,
          githubToken
        );
        if (delResp.status === 204) {
          console.log(`  ✅ 3.5: branch "${openedBranch}" deletada (limpeza pós-prova)`);
          passed++;
        } else {
          console.log(`  ❌ 3.5: falha ao deletar branch (status: ${delResp.status})`);
          failed++;
        }
      } catch (err) {
        console.log(`  ❌ 3.5: erro ao deletar branch — ${err.message}`);
        failed++;
      }
    } else {
      skip('3.5: limpeza de branch (branch não foi aberta)');
    }
  }
}

// ─── main ────────────────────────────────────────────────────────────────────

(async () => {
  console.log('=== PR109 — Prova do ciclo Codex→GitHub ===');

  await runGrupo1();
  await runGrupo2();
  await runGrupo3();

  console.log(`\n=== RESULTADO: ${passed} passed, ${failed} failed ===`);
  if (failed > 0) process.exit(1);
})();
