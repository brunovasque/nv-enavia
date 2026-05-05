// tests/pr108-code-chunker.test.js
// Testes de unidade para executor/src/code-chunker.js
// Minimo 5 cenarios conforme contrato PR108.

'use strict';

const { pathToFileURL } = require('url');
const path = require('path');

const modulePath = path.resolve(__dirname, '../executor/src/code-chunker.js');

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

(async () => {
  const { extractRelevantChunk } = await import(pathToFileURL(modulePath).href);

  console.log('\n[PR108] code-chunker.js — extractRelevantChunk\n');

  // ─── 1. Codigo vazio ─────────────────────────────────────────────────────
  console.log('[1] Codigo vazio');
  {
    const r = extractRelevantChunk('', 'algo');
    ok('1.1 chunk vazio', r.chunk, '');
    okFalse('1.2 anchor_found=false', r.anchor_found);
    ok('1.3 warning=EMPTY_CODE', r.warning, 'EMPTY_CODE');
  }

  // ─── 2. Codigo menor que maxChars — retorna completo ─────────────────────
  console.log('[2] Codigo cabe inteiro');
  {
    const code = 'const x = 1;';
    const r = extractRelevantChunk(code, 'qualquer', 16000);
    ok('2.1 chunk = codigo completo', r.chunk, code);
    okFalse('2.2 truncated=false', r.truncated);
    ok('2.3 offset=0', r.offset, 0);
  }

  // ─── 3. Sem intentText — trunca do inicio ────────────────────────────────
  console.log('[3] Sem intentText');
  {
    const code = 'X'.repeat(20000);
    const r = extractRelevantChunk(code, '', 16000);
    ok('3.1 chunk de 16000 chars', r.chunk.length, 16000);
    ok('3.2 offset=0', r.offset, 0);
    okTrue('3.3 truncated=true', r.truncated);
    okFalse('3.4 anchor_found=false', r.anchor_found);
    okTrue('3.5 warning presente', typeof r.warning === 'string' && r.warning.includes('NO_INTENT_TEXT'));
  }

  // ─── 4. Ancora encontrada — janela centralizada ──────────────────────────
  console.log('[4] Ancora encontrada — janela centralizada');
  {
    const prefix = 'A'.repeat(10000);
    const anchor = 'function callCodexEngine() { return true; }';
    const suffix = 'B'.repeat(10000);
    const code = prefix + anchor + suffix;
    const r = extractRelevantChunk(code, 'callCodexEngine', 1000);
    okTrue('4.1 anchor_found=true', r.anchor_found);
    okTrue('4.2 chunk contem ancora', r.chunk.includes('callCodexEngine'));
    ok('4.3 chunk tem tamanho max', r.chunk.length, 1000);
    okTrue('4.4 truncated=true', r.truncated);
    ok('4.5 anchor_token correto', r.anchor_token, 'callCodexEngine');
  }

  // ─── 5. Ancora nao encontrada — fallback do inicio ───────────────────────
  console.log('[5] Ancora nao encontrada — fallback');
  {
    const code = 'Z'.repeat(20000);
    const r = extractRelevantChunk(code, 'functionNaoExistente', 16000);
    ok('5.1 offset=0', r.offset, 0);
    ok('5.2 chunk de 16000', r.chunk.length, 16000);
    okFalse('5.3 anchor_found=false', r.anchor_found);
    okTrue('5.4 warning tem tokens tentados', typeof r.warning === 'string' && r.warning.includes('ANCHOR_NOT_FOUND'));
  }

  // ─── 6. Rota HTTP como token de busca ────────────────────────────────────
  console.log('[6] Rota HTTP como ancora');
  {
    const prefix = 'W'.repeat(5000);
    const block = 'if (pathname === "/github-bridge/execute") { return handle(); }';
    const suffix = 'V'.repeat(5000);
    const code = prefix + block + suffix;
    const r = extractRelevantChunk(code, 'rota /github-bridge/execute para proxy', 500);
    okTrue('6.1 anchor_found=true', r.anchor_found);
    okTrue('6.2 chunk contem a rota', r.chunk.includes('/github-bridge/execute'));
  }

  // ─── 7. Token UPPER_CASE como ancora ─────────────────────────────────────
  console.log('[7] Token UPPER_CASE como ancora');
  {
    const prefix = 'Q'.repeat(8000);
    const block = 'const token = env.GITHUB_TOKEN;';
    const suffix = 'R'.repeat(8000);
    const code = prefix + block + suffix;
    const r = extractRelevantChunk(code, 'GITHUB_TOKEN config', 2000);
    okTrue('7.1 anchor_found=true', r.anchor_found);
    okTrue('7.2 chunk contem GITHUB_TOKEN', r.chunk.includes('GITHUB_TOKEN'));
    ok('7.3 anchor_token', r.anchor_token, 'GITHUB_TOKEN');
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  if (failed === 0) {
    console.log(`✅ PR108 code-chunker: ${passed}/${total} testes passando`);
  } else {
    console.log(`❌ PR108 code-chunker: ${failed} falhas de ${total}`);
    process.exit(1);
  }
})();
