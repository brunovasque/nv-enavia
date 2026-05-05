// tests/pr108-patch-engine.test.js
// Testes de unidade para executor/src/patch-engine.js
// Mínimo 10 cenários conforme contrato PR108.
//
// Usa dynamic import (pathToFileURL) porque executor usa ES modules.

'use strict';

const { pathToFileURL } = require('url');
const path = require('path');

const modulePath = path.resolve(__dirname, '../executor/src/patch-engine.js');

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
  const { applyPatch } = await import(pathToFileURL(modulePath).href);

  console.log('\n[PR108] patch-engine.js — applyPatch\n');

  // ─── 1. Sem código original ──────────────────────────────────────────────
  console.log('[1] Sem código original');
  {
    const r = applyPatch('', [{ search: 'x', replace: 'y' }]);
    ok('1.1 ok=false', r.ok, false);
    ok('1.2 error=EMPTY_ORIGINAL', r.error, 'EMPTY_ORIGINAL');
  }

  // ─── 2. Sem patches ──────────────────────────────────────────────────────
  console.log('[2] Sem patches');
  {
    const r = applyPatch('const x = 1;', []);
    ok('2.1 ok=false', r.ok, false);
    ok('2.2 error=NO_PATCHES', r.error, 'NO_PATCHES');
  }

  // ─── 3. Patch sem campo search ────────────────────────────────────────────
  console.log('[3] Patch sem campo search');
  {
    const r = applyPatch('const x = 1;', [{ title: 'sem search', replace: 'y' }]);
    okTrue('3.1 ok=true (patch skipped, código inalterado)', r.ok);
    ok('3.2 applied vazio', r.applied, []);
    ok('3.3 skipped contém NO_SEARCH_TEXT', r.skipped[0].reason, 'NO_SEARCH_TEXT');
    ok('3.4 candidate é o original', r.candidate, 'const x = 1;');
  }

  // ─── 4. Search não encontrado ─────────────────────────────────────────────
  console.log('[4] Search não encontrado');
  {
    const r = applyPatch('const x = 1;', [{ title: 'inexistente', search: 'NAOEXISTE', replace: 'y' }]);
    ok('4.1 ok=false', r.ok, false);
    ok('4.2 error=ANCHOR_NOT_FOUND', r.error, 'ANCHOR_NOT_FOUND');
    ok('4.3 patch_title preservado', r.patch_title, 'inexistente');
  }

  // ─── 5. Match ambíguo ─────────────────────────────────────────────────────
  console.log('[5] Match ambíguo (search aparece 2x)');
  {
    const code = 'function foo() {}\nfunction foo() {}';
    const r = applyPatch(code, [{ title: 'ambíguo', search: 'function foo()', replace: 'function bar()' }]);
    ok('5.1 ok=false', r.ok, false);
    ok('5.2 error=AMBIGUOUS_MATCH', r.error, 'AMBIGUOUS_MATCH');
  }

  // ─── 6. Aplicação bem-sucedida ────────────────────────────────────────────
  console.log('[6] Aplicação simples bem-sucedida');
  {
    const original = 'const version = "1.0.0";';
    const r = applyPatch(original, [{
      title: 'bump version',
      search: '"1.0.0"',
      replace: '"2.0.0"',
    }]);
    okTrue('6.1 ok=true', r.ok);
    ok('6.2 applied contém título', r.applied, ['bump version']);
    ok('6.3 candidate correto', r.candidate, 'const version = "2.0.0";');
  }

  // ─── 7. Candidato vazio após replace ──────────────────────────────────────
  console.log('[7] Candidato vazio após replace');
  {
    const r = applyPatch('abc', [{ title: 'destroi', search: 'abc', replace: '   ' }]);
    ok('7.1 ok=false', r.ok, false);
    ok('7.2 error=EMPTY_CANDIDATE', r.error, 'EMPTY_CANDIDATE');
  }

  // ─── 8. Candidato < 50% do original ──────────────────────────────────────
  console.log('[8] Candidato < 50% do original');
  {
    const big = 'A'.repeat(1000);
    const r = applyPatch(big, [{ title: 'shrink', search: 'A'.repeat(1000), replace: 'x'.repeat(100) }]);
    ok('8.1 ok=false', r.ok, false);
    ok('8.2 error=CANDIDATE_TOO_SMALL', r.error, 'CANDIDATE_TOO_SMALL');
    okTrue('8.3 detail presente', typeof r.detail === 'string' && r.detail.length > 0);
  }

  // ─── 9. Anchor verificado com sucesso ────────────────────────────────────
  console.log('[9] Anchor verificado com sucesso');
  {
    const code = 'function handler() { return 42; }';
    const r = applyPatch(code, [{
      title: 'com anchor',
      anchor: { match: 'function handler()' },
      search: 'return 42',
      replace: 'return 99',
    }]);
    okTrue('9.1 ok=true', r.ok);
    ok('9.2 candidate correto', r.candidate, 'function handler() { return 99; }');
  }

  // ─── 10. Anchor não encontrado ────────────────────────────────────────────
  console.log('[10] Anchor não encontrado');
  {
    const code = 'function handler() { return 42; }';
    const r = applyPatch(code, [{
      title: 'anchor errado',
      anchor: { match: 'function NAOEXISTE()' },
      search: 'return 42',
      replace: 'return 99',
    }]);
    ok('10.1 ok=false', r.ok, false);
    ok('10.2 error=ANCHOR_NOT_FOUND', r.error, 'ANCHOR_NOT_FOUND');
  }

  // ─── 11. Múltiplos patches em sequência ──────────────────────────────────
  console.log('[11] Múltiplos patches em sequência');
  {
    const code = 'const a = 1;\nconst b = 2;\nconst c = 3;';
    const r = applyPatch(code, [
      { title: 'patch-a', search: 'const a = 1;', replace: 'const a = 10;' },
      { title: 'patch-b', search: 'const b = 2;', replace: 'const b = 20;' },
    ]);
    okTrue('11.1 ok=true', r.ok);
    ok('11.2 applied tem 2 títulos', r.applied, ['patch-a', 'patch-b']);
    okTrue('11.3 candidate tem a=10 e b=20', r.candidate.includes('a = 10') && r.candidate.includes('b = 20'));
  }

  // ─── 12. Mix de patches válidos e sem search ──────────────────────────────
  console.log('[12] Mix de patches: válido + sem search');
  {
    const code = 'const x = 1;\nconst y = 2;';
    const r = applyPatch(code, [
      { title: 'sem-search' },
      { title: 'valido', search: 'const x = 1;', replace: 'const x = 99;' },
    ]);
    okTrue('12.1 ok=true', r.ok);
    ok('12.2 applied tem valido', r.applied, ['valido']);
    ok('12.3 skipped tem sem-search', r.skipped[0].title, 'sem-search');
    okTrue('12.4 candidate alterado', r.candidate.includes('x = 99'));
  }

  // ─── Resumo ───────────────────────────────────────────────────────────────
  const total = passed + failed;
  console.log('\n' + '='.repeat(60));
  if (failed === 0) {
    console.log(`✅ PR108 patch-engine: ${passed}/${total} testes passando`);
  } else {
    console.log(`❌ PR108 patch-engine: ${failed} falhas de ${total}`);
    process.exit(1);
  }
})();
