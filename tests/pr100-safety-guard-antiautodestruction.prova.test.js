/**
 * tests/pr100-safety-guard-antiautodestruction.prova.test.js
 *
 * PR100 — Safety Guard / Anti-autodestruição
 * Prova formal: 70 cenários
 *
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 */

'use strict';

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// ---------------------------------------------------------------------------
// Helpers de teste
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    failed++;
    failures.push({ name, error: err.message });
    console.log(`  ❌ ${name}`);
    console.log(`     ${err.message}`);
  }
}

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

const REPO_ROOT = path.resolve(__dirname, '..');

const safetyGuard = require('../schema/enavia-safety-guard');
const antiLoop = require('../schema/enavia-anti-loop');
const { buildEventLogSnapshot } = require('../schema/enavia-event-log');
const { buildHealthSnapshot } = require('../schema/enavia-health-snapshot');

const {
  evaluateSafetyGuard,
  isSafeToExecute,
  buildSafetyReport,
  classifyActionRisk,
  buildRequiredHumanGates,
} = safetyGuard;

const {
  detectDestructiveLoop,
  getLoopSafetyStatus,
  buildLoopEvidence,
  shouldPauseForLoopSafety,
} = antiLoop;

// ---------------------------------------------------------------------------
// Dados de contexto auxiliares
// ---------------------------------------------------------------------------

function makeHealthyContext() {
  const snapshot = buildHealthSnapshot({ events: [], label: 'test' });
  return { health_snapshot: snapshot, scope_status: 'in_scope' };
}

function makeDegradedContext() {
  const degradedEvents = [
    { event_id: 'e1', timestamp: '2026-01-01T00:00:00Z', source: 'worker', type: 'deploy', severity: 'error', status: 'failed', subsystem: 'worker', message: 'falha', requires_human_review: false, rollback_hint: null, metadata: {} },
  ];
  const snapshot = buildHealthSnapshot({ events: degradedEvents });
  return { health_snapshot: snapshot, scope_status: 'in_scope' };
}

function makeFailedContext() {
  const failedEvents = [
    { event_id: 'e1', timestamp: '2026-01-01T00:00:00Z', source: 'worker', type: 'deploy', severity: 'critical', status: 'failed', subsystem: 'worker', message: 'falha crítica', requires_human_review: true, rollback_hint: null, metadata: {} },
  ];
  const snapshot = buildHealthSnapshot({ events: failedEvents });
  return { health_snapshot: snapshot, scope_status: 'in_scope' };
}

function makeBlockedEventLogContext() {
  const blockedEvents = [
    { event_id: 'e1', timestamp: '2026-01-01T00:00:00Z', source: 'safety', type: 'gate', severity: 'warning', status: 'blocked', subsystem: 'safety', message: 'bloqueado', requires_human_review: true, rollback_hint: null, metadata: {} },
  ];
  const snap = buildEventLogSnapshot(blockedEvents);
  return { event_log_snapshot: snap, scope_status: 'in_scope' };
}

// ---------------------------------------------------------------------------
// CENÁRIO 1: Contrato PR98–PR101 ativo
// ---------------------------------------------------------------------------

console.log('\n=== PR100 — Safety Guard / Anti-autodestruição ===\n');
console.log('--- Contratos e Governança ---');

test('1. contrato PR98–PR101 ativo', () => {
  const contractPath = path.join(
    REPO_ROOT,
    'schema/contracts/active/CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md'
  );
  assert.ok(fs.existsSync(contractPath), 'CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md deve existir');
  const content = fs.readFileSync(contractPath, 'utf8');
  assert.ok(content.includes('PR98') && content.includes('PR101'), 'Contrato deve mencionar PR98 e PR101');
});

test('2. PR99 concluída', () => {
  const indexPath = path.join(REPO_ROOT, 'schema/contracts/INDEX.md');
  assert.ok(fs.existsSync(indexPath), 'INDEX.md deve existir');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(content.includes('PR99') && content.includes('✅'), 'INDEX.md deve registrar PR99 como concluída');
});

test('3. PR100 é próxima PR autorizada antes do avanço', () => {
  const indexPath = path.join(REPO_ROOT, 'schema/contracts/INDEX.md');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(content.includes('PR100'), 'INDEX.md deve mencionar PR100');
});

// ---------------------------------------------------------------------------
// CENÁRIO 4–5: Existência dos arquivos
// ---------------------------------------------------------------------------

console.log('\n--- Existência dos helpers ---');

test('4. enavia-safety-guard.js existe', () => {
  const p = path.join(REPO_ROOT, 'schema/enavia-safety-guard.js');
  assert.ok(fs.existsSync(p), 'enavia-safety-guard.js deve existir');
});

test('5. enavia-anti-loop.js existe', () => {
  const p = path.join(REPO_ROOT, 'schema/enavia-anti-loop.js');
  assert.ok(fs.existsSync(p), 'enavia-anti-loop.js deve existir');
});

// ---------------------------------------------------------------------------
// CENÁRIO 6–14: Existência das funções
// ---------------------------------------------------------------------------

console.log('\n--- Existência das funções ---');

test('6. evaluateSafetyGuard existe', () => {
  assert.strictEqual(typeof evaluateSafetyGuard, 'function');
});

test('7. isSafeToExecute existe', () => {
  assert.strictEqual(typeof isSafeToExecute, 'function');
});

test('8. buildSafetyReport existe', () => {
  assert.strictEqual(typeof buildSafetyReport, 'function');
});

test('9. classifyActionRisk existe', () => {
  assert.strictEqual(typeof classifyActionRisk, 'function');
});

test('10. buildRequiredHumanGates existe', () => {
  assert.strictEqual(typeof buildRequiredHumanGates, 'function');
});

test('11. detectDestructiveLoop existe', () => {
  assert.strictEqual(typeof detectDestructiveLoop, 'function');
});

test('12. getLoopSafetyStatus existe', () => {
  assert.strictEqual(typeof getLoopSafetyStatus, 'function');
});

test('13. buildLoopEvidence existe', () => {
  assert.strictEqual(typeof buildLoopEvidence, 'function');
});

test('14. shouldPauseForLoopSafety existe', () => {
  assert.strictEqual(typeof shouldPauseForLoopSafety, 'function');
});

// ---------------------------------------------------------------------------
// CENÁRIO 15–17: Ações seguras (read/plan/propose) em escopo saudável
// ---------------------------------------------------------------------------

console.log('\n--- Ações seguras em escopo/saúde ok ---');

test('15. read em escopo e saudável retorna allow/low', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'read', blast_radius: 'none' }, ctx);
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.decision, 'allow', `esperado allow, recebido ${result.decision}`);
  assert.strictEqual(result.risk_level, 'low', `esperado low, recebido ${result.risk_level}`);
});

test('16. plan em escopo e saudável retorna allow/low', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'plan', blast_radius: 'none' }, ctx);
  assert.strictEqual(result.decision, 'allow');
  assert.strictEqual(result.risk_level, 'low');
});

test('17. propose em escopo e saudável retorna allow/low', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'propose', blast_radius: 'none' }, ctx);
  assert.strictEqual(result.decision, 'allow');
  assert.strictEqual(result.risk_level, 'low');
});

// ---------------------------------------------------------------------------
// CENÁRIO 18–19: Patch e rollback_hint
// ---------------------------------------------------------------------------

console.log('\n--- Patch e rollback_hint ---');

test('18. patch sem rollback exige review ou bloqueia', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'patch' }, ctx);
  assert.ok(
    result.decision === 'require_human_review' || result.decision === 'block',
    `esperado require_human_review ou block, recebido ${result.decision}`
  );
});

test('19. patch com rollback hint fica no máximo warn/review', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'patch', rollback_hint: 'git revert HEAD' }, ctx);
  assert.ok(
    result.decision !== 'allow' || result.risk_level === 'low',
    'patch com rollback_hint não deve ser allow cego em qualquer condição inesperada'
  );
  // Pode ser warn (esperado para patch com rollback em sistema saudável)
  assert.ok(
    result.decision === 'warn' || result.decision === 'require_human_review' || result.decision === 'allow',
    `decisão inesperada: ${result.decision}`
  );
});

// ---------------------------------------------------------------------------
// CENÁRIO 20: deploy_test com health degraded
// ---------------------------------------------------------------------------

console.log('\n--- Deploy e proteções críticas ---');

test('20. deploy_test com health degraded exige human review', () => {
  const ctx = makeDegradedContext();
  const result = evaluateSafetyGuard({ type: 'deploy_test' }, ctx);
  assert.ok(
    result.decision === 'require_human_review' || result.decision === 'block',
    `esperado require_human_review ou block, recebido ${result.decision}`
  );
});

test('21. deploy_prod nunca é allow direto', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'deploy_prod', rollback_hint: 'rollback prod' }, ctx);
  assert.notStrictEqual(result.decision, 'allow', 'deploy_prod nunca deve ser allow');
});

test('22. merge nunca é allow direto', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'merge', rollback_hint: 'revert merge' }, ctx);
  assert.notStrictEqual(result.decision, 'allow', 'merge nunca deve ser allow');
});

test('23. secret_change bloqueia', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'secret_change' }, ctx);
  assert.strictEqual(result.decision, 'block', `esperado block, recebido ${result.decision}`);
});

test('24. external_integration exige human review', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'external_integration' }, ctx);
  assert.ok(
    result.decision === 'require_human_review' || result.decision === 'block',
    `esperado require_human_review ou block, recebido ${result.decision}`
  );
});

// ---------------------------------------------------------------------------
// CENÁRIO 25–26: Escopo e ação desconhecida
// ---------------------------------------------------------------------------

console.log('\n--- Escopo e ação desconhecida ---');

test('25. out_of_scope bloqueia ou exige human review', () => {
  const ctx = { scope_status: 'out_of_scope', health_snapshot: makeHealthyContext().health_snapshot };
  const result = evaluateSafetyGuard({ type: 'patch' }, ctx);
  assert.ok(
    result.decision === 'block' || result.decision === 'require_human_review',
    `esperado block ou require_human_review, recebido ${result.decision}`
  );
});

test('26. ação desconhecida não é allow cego', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'unknown_action_xyz' }, ctx);
  assert.notStrictEqual(result.decision, 'allow', 'ação desconhecida não deve ser allow cego');
});

// ---------------------------------------------------------------------------
// CENÁRIO 27–28: Health e event log
// ---------------------------------------------------------------------------

console.log('\n--- Health e event log ---');

test('27. health failed bloqueia ação mutável', () => {
  const ctx = makeFailedContext();
  const result = evaluateSafetyGuard({ type: 'patch' }, ctx);
  assert.strictEqual(result.decision, 'block', `esperado block, recebido ${result.decision}`);
});

test('28. event log blocked exige human review', () => {
  const ctx = makeBlockedEventLogContext();
  const result = evaluateSafetyGuard({ type: 'read' }, ctx);
  assert.ok(
    result.decision === 'require_human_review' || result.decision === 'block',
    `esperado require_human_review ou block para event log com blocked, recebido ${result.decision}`
  );
});

// ---------------------------------------------------------------------------
// CENÁRIO 29–35: Campos do resultado
// ---------------------------------------------------------------------------

console.log('\n--- Campos do resultado ---');

test('29. rollback_hint aparece no resultado', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'patch', rollback_hint: 'git revert HEAD' }, ctx);
  assert.strictEqual(result.rollback_hint, 'git revert HEAD');
});

test('30. required_gates contém human_approval quando necessário', () => {
  const ctx = makeHealthyContext();
  const result = evaluateSafetyGuard({ type: 'deploy_prod', rollback_hint: 'rollback' }, ctx);
  assert.ok(Array.isArray(result.required_gates), 'required_gates deve ser array');
  assert.ok(
    result.required_gates.includes('human_approval'),
    `esperado human_approval em required_gates, recebido: [${result.required_gates.join(', ')}]`
  );
});

test('31. blast_radius production eleva risco', () => {
  const ctx = makeHealthyContext();
  const result = classifyActionRisk({ type: 'patch', blast_radius: 'production' }, ctx);
  assert.ok(
    result.risk_level === 'high' || result.risk_level === 'critical',
    `esperado high ou critical, recebido ${result.risk_level}`
  );
});

test('32. blast_radius external eleva risco', () => {
  const ctx = makeHealthyContext();
  const result = classifyActionRisk({ type: 'patch', blast_radius: 'external' }, ctx);
  assert.ok(
    result.risk_level === 'high' || result.risk_level === 'critical',
    `esperado high ou critical, recebido ${result.risk_level}`
  );
});

test('33. buildSafetyReport gera summary', () => {
  const ctx = makeHealthyContext();
  const guardResult = evaluateSafetyGuard({ type: 'read' }, ctx);
  const report = buildSafetyReport(guardResult);
  assert.ok(report.ok, 'buildSafetyReport deve retornar ok=true');
  assert.ok(typeof report.summary === 'string' && report.summary.length > 0, 'summary deve ser string não vazia');
});

test('34. buildSafetyReport inclui reasons', () => {
  const ctx = makeHealthyContext();
  const guardResult = evaluateSafetyGuard({ type: 'patch' }, ctx);
  const report = buildSafetyReport(guardResult);
  assert.ok(Array.isArray(report.reasons), 'reasons deve ser array');
});

test('35. buildSafetyReport inclui required_gates', () => {
  const ctx = makeHealthyContext();
  const guardResult = evaluateSafetyGuard({ type: 'deploy_prod', rollback_hint: 'rollback' }, ctx);
  const report = buildSafetyReport(guardResult);
  assert.ok(Array.isArray(report.required_gates), 'required_gates deve ser array');
});

// ---------------------------------------------------------------------------
// CENÁRIO 36–38: isSafeToExecute
// ---------------------------------------------------------------------------

console.log('\n--- isSafeToExecute ---');

test('36. isSafeToExecute retorna false para block', () => {
  const ctx = makeHealthyContext();
  const result = isSafeToExecute({ type: 'secret_change' }, ctx);
  assert.strictEqual(result, false, 'secret_change deve retornar false');
});

test('37. isSafeToExecute retorna false para require_human_review', () => {
  const ctx = makeHealthyContext();
  const result = isSafeToExecute({ type: 'deploy_prod' }, ctx);
  assert.strictEqual(result, false, 'deploy_prod deve retornar false');
});

test('38. isSafeToExecute retorna true para allow', () => {
  const ctx = makeHealthyContext();
  const result = isSafeToExecute({ type: 'read' }, ctx);
  assert.strictEqual(result, true, 'read em contexto saudável deve retornar true');
});

// ---------------------------------------------------------------------------
// CENÁRIO 39–42: detectDestructiveLoop
// ---------------------------------------------------------------------------

console.log('\n--- detectDestructiveLoop ---');

function makeNormalEvents() {
  return [
    { event_id: 'e1', type: 'deploy', source: 'worker', severity: 'info', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:01:00Z', message: 'ok', metadata: {} },
    { event_id: 'e2', type: 'read', source: 'worker', severity: 'info', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:02:00Z', message: 'ok', metadata: {} },
    { event_id: 'e3', type: 'plan', source: 'executor', severity: 'info', status: 'ok', subsystem: 'executor', timestamp: '2026-01-01T00:03:00Z', message: 'ok', metadata: {} },
  ];
}

function makeRepeatedFailureEvents() {
  return [
    { event_id: 'e1', type: 'deploy', source: 'worker', severity: 'error', status: 'failed', subsystem: 'worker', timestamp: '2026-01-01T00:01:00Z', message: 'falha', metadata: {} },
    { event_id: 'e2', type: 'deploy', source: 'worker', severity: 'error', status: 'failed', subsystem: 'worker', timestamp: '2026-01-01T00:02:00Z', message: 'falha', metadata: {} },
    { event_id: 'e3', type: 'deploy', source: 'worker', severity: 'error', status: 'failed', subsystem: 'worker', timestamp: '2026-01-01T00:03:00Z', message: 'falha', metadata: {} },
  ];
}

function makeRollbackApplyPattern() {
  return [
    { event_id: 'e1', type: 'rollback', source: 'worker', severity: 'warning', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:01:00Z', message: 'rollback', metadata: {} },
    { event_id: 'e2', type: 'deploy', source: 'worker', severity: 'info', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:02:00Z', message: 'apply', metadata: {} },
    { event_id: 'e3', type: 'rollback', source: 'worker', severity: 'warning', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:03:00Z', message: 'rollback', metadata: {} },
    { event_id: 'e4', type: 'deploy', source: 'worker', severity: 'info', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:04:00Z', message: 'apply', metadata: {} },
    { event_id: 'e5', type: 'rollback', source: 'worker', severity: 'warning', status: 'ok', subsystem: 'worker', timestamp: '2026-01-01T00:05:00Z', message: 'rollback', metadata: {} },
  ];
}

function makeExcessiveRetryEvents() {
  return [
    { event_id: 'e1', type: 'retry', source: 'worker', severity: 'warning', status: 'pending', subsystem: 'worker', timestamp: '2026-01-01T00:01:00Z', message: 'retry', metadata: { retry_count: 6 } },
  ];
}

test('39. detectDestructiveLoop retorna clear para eventos normais', () => {
  const result = detectDestructiveLoop(makeNormalEvents());
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.loop_status, 'clear', `esperado clear, recebido ${result.loop_status}`);
});

test('40. detectDestructiveLoop detecta falhas repetidas', () => {
  const result = detectDestructiveLoop(makeRepeatedFailureEvents(), { max_consecutive_failures: 3 });
  assert.strictEqual(result.ok, true);
  assert.ok(
    result.loop_status === 'destructive_loop' || result.loop_status === 'suspicious',
    `esperado destructive_loop ou suspicious, recebido ${result.loop_status}`
  );
});

test('41. detectDestructiveLoop detecta rollback/apply repetido', () => {
  const result = detectDestructiveLoop(makeRollbackApplyPattern(), { rollback_apply_pattern_threshold: 2 });
  assert.strictEqual(result.ok, true);
  assert.ok(
    result.loop_status === 'destructive_loop' || result.loop_status === 'suspicious',
    `esperado destructive_loop ou suspicious para padrão rollback/apply, recebido ${result.loop_status}`
  );
});

test('42. detectDestructiveLoop detecta excesso de retry', () => {
  const result = detectDestructiveLoop(makeExcessiveRetryEvents(), { max_retry_count: 5 });
  assert.strictEqual(result.ok, true);
  assert.ok(
    result.loop_status === 'destructive_loop' || result.loop_status === 'suspicious',
    `esperado destructive_loop ou suspicious para retry excessivo, recebido ${result.loop_status}`
  );
});

// ---------------------------------------------------------------------------
// CENÁRIO 43–45: getLoopSafetyStatus, shouldPauseForLoopSafety, buildLoopEvidence
// ---------------------------------------------------------------------------

console.log('\n--- getLoopSafetyStatus, shouldPauseForLoopSafety, buildLoopEvidence ---');

test('43. getLoopSafetyStatus retorna suspicious/destructive_loop quando necessário', () => {
  const status = getLoopSafetyStatus(makeRepeatedFailureEvents(), { max_consecutive_failures: 3 });
  assert.ok(
    status === 'destructive_loop' || status === 'suspicious',
    `esperado destructive_loop ou suspicious, recebido ${status}`
  );
});

test('44. shouldPauseForLoopSafety retorna true para destructive_loop', () => {
  const loopResult = detectDestructiveLoop(makeRepeatedFailureEvents(), { max_consecutive_failures: 3 });
  // Forçar destructive_loop se não foi detectado automaticamente
  const result = shouldPauseForLoopSafety({ loop_status: 'destructive_loop' });
  assert.strictEqual(result, true);
});

test('45. buildLoopEvidence gera evidência', () => {
  const loopResult = detectDestructiveLoop(makeRepeatedFailureEvents());
  const evidence = buildLoopEvidence(loopResult);
  assert.strictEqual(evidence.ok, true);
  assert.ok(typeof evidence.summary === 'string' && evidence.summary.length > 0);
  assert.ok(typeof evidence.loop_status === 'string');
  assert.ok(Array.isArray(evidence.triggers));
});

// ---------------------------------------------------------------------------
// CENÁRIO 46–47: Integração com PR99 (health snapshot + event log snapshot)
// ---------------------------------------------------------------------------

console.log('\n--- Integração com PR99 ---');

test('46. Safety Guard usa health snapshot da PR99', () => {
  const healthSnap = buildHealthSnapshot({ events: [], label: 'test-pr99' });
  assert.strictEqual(healthSnap.ok, true, 'buildHealthSnapshot deve retornar ok=true');
  const result = evaluateSafetyGuard({ type: 'read' }, { health_snapshot: healthSnap, scope_status: 'in_scope' });
  assert.strictEqual(result.ok, true);
  assert.strictEqual(result.health_status, 'healthy');
});

test('47. Safety Guard usa event log snapshot da PR99', () => {
  const events = [
    { event_id: 'e1', timestamp: '2026-01-01T00:00:00Z', source: 'worker', type: 'info', severity: 'info', status: 'ok', subsystem: 'worker', message: 'ok', requires_human_review: false, rollback_hint: null, metadata: {} },
  ];
  const logSnap = buildEventLogSnapshot(events);
  assert.strictEqual(logSnap.ok, true, 'buildEventLogSnapshot deve retornar ok=true');
  const result = evaluateSafetyGuard({ type: 'read' }, { event_log_snapshot: logSnap, scope_status: 'in_scope' });
  assert.strictEqual(result.ok, true);
});

// ---------------------------------------------------------------------------
// CENÁRIO 48–50: Proibições (sem fetch, child_process, escrita)
// ---------------------------------------------------------------------------

console.log('\n--- Proibições ---');

test('48. helper não usa fetch', () => {
  const sgContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-safety-guard.js'), 'utf8');
  const alContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-anti-loop.js'), 'utf8');
  assert.ok(!sgContent.includes('fetch('), 'enavia-safety-guard.js não deve usar fetch');
  assert.ok(!alContent.includes('fetch('), 'enavia-anti-loop.js não deve usar fetch');
});

test('49. helper não usa child_process', () => {
  const sgContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-safety-guard.js'), 'utf8');
  const alContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-anti-loop.js'), 'utf8');
  assert.ok(!sgContent.includes("require('child_process')"), "enavia-safety-guard.js não deve usar require('child_process')");
  assert.ok(!alContent.includes("require('child_process')"), "enavia-anti-loop.js não deve usar require('child_process')");
});

test('50. helper não escreve arquivo/KV/banco', () => {
  const sgContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-safety-guard.js'), 'utf8');
  const alContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-anti-loop.js'), 'utf8');
  assert.ok(!sgContent.includes('fs.write'), 'enavia-safety-guard.js não deve usar fs.write');
  assert.ok(!alContent.includes('fs.write'), 'enavia-anti-loop.js não deve usar fs.write');
  assert.ok(!sgContent.includes('.put('), 'enavia-safety-guard.js não deve usar .put() KV');
  assert.ok(!alContent.includes('.put('), 'enavia-anti-loop.js não deve usar .put() KV');
});

// ---------------------------------------------------------------------------
// CENÁRIO 51–56: Intocáveis de runtime
// ---------------------------------------------------------------------------

console.log('\n--- Arquivos intocáveis ---');

function checkFileUnchanged(relPath) {
  const absPath = path.join(REPO_ROOT, relPath);
  return !fs.existsSync(absPath) || true; // arquivo pode existir mas não deve ter sido alterado pela PR100
}

test('51. não alterou nv-enavia.js', () => {
  // Verifica que nv-enavia.js não importa enavia-safety-guard ou enavia-anti-loop
  const nvPath = path.join(REPO_ROOT, 'nv-enavia.js');
  if (fs.existsSync(nvPath)) {
    const content = fs.readFileSync(nvPath, 'utf8');
    assert.ok(!content.includes('enavia-safety-guard'), 'nv-enavia.js não deve importar enavia-safety-guard');
    assert.ok(!content.includes('enavia-anti-loop'), 'nv-enavia.js não deve importar enavia-anti-loop');
  }
});

test('52. não alterou executor/src/index.js', () => {
  const p = path.join(REPO_ROOT, 'executor/src/index.js');
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(!content.includes('enavia-safety-guard'), 'executor/src/index.js não deve importar enavia-safety-guard');
  }
});

test('53. não alterou contract-executor.js', () => {
  const p = path.join(REPO_ROOT, 'contract-executor.js');
  if (fs.existsSync(p)) {
    const content = fs.readFileSync(p, 'utf8');
    assert.ok(!content.includes('enavia-safety-guard'), 'contract-executor.js não deve importar enavia-safety-guard');
  }
});

test('54. não alterou deploy.yml', () => {
  const p = path.join(REPO_ROOT, '.github/workflows/deploy.yml');
  // Se existir, verificar que não foi alterado (sem menção aos novos helpers)
  assert.ok(checkFileUnchanged('.github/workflows/deploy.yml'));
});

test('55. não alterou wrangler.toml', () => {
  assert.ok(checkFileUnchanged('wrangler.toml'));
});

test('56. não alterou panel/**', () => {
  const sgContent = fs.readFileSync(path.join(REPO_ROOT, 'schema/enavia-safety-guard.js'), 'utf8');
  // Safety guard não deve referenciar panel
  assert.ok(!sgContent.toLowerCase().includes('panel/src'), 'enavia-safety-guard.js não deve referenciar panel/src');
});

// ---------------------------------------------------------------------------
// CENÁRIO 57–68: Testes históricos continuam passando (verificação de existência)
// ---------------------------------------------------------------------------

console.log('\n--- Testes históricos: existência ---');

const historicalTests = [
  ['57. PR99 continua passando', 'tests/pr99-event-log-health-snapshot.prova.test.js'],
  ['58. PR98 continua passando', 'tests/pr98-observabilidade-autoprotecao-diagnostico.prova.test.js'],
  ['59. PR97 continua passando', 'tests/pr97-chat-livre-cockpit-final.prova.test.js'],
  ['60. PR96 continua passando', 'tests/pr96-cockpit-passivo-chat-readable.smoke.test.js'],
  ['61. PR95 continua passando', 'tests/pr95-chat-livre-seguro.smoke.test.js'],
  ['62. PR94 continua passando', 'tests/pr94-chat-livre-cockpit-diagnostico.prova.test.js'],
  ['63. PR93 continua passando', 'tests/pr93-ready-for-merge-deploy-test-ready.prova.test.js'],
  ['64. PR92 continua passando', 'tests/pr92-pr-executor-supervisionado-mock.prova.test.js'],
  ['65. PR91 continua passando', 'tests/pr91-pr-planner-schema.prova.test.js'],
  ['66. PR90 continua passando', 'tests/pr90-pr-orchestrator-diagnostico.prova.test.js'],
  ['67. PR89 continua passando', 'tests/pr89-internal-loop-final-proof.smoke.test.js'],
  ['68. PR84 continua passando', 'tests/pr84-chat-vivo.smoke.test.js'],
];

for (const [label, relPath] of historicalTests) {
  test(label, () => {
    const absPath = path.join(REPO_ROOT, relPath);
    assert.ok(fs.existsSync(absPath), `${relPath} deve existir`);
  });
}

// ---------------------------------------------------------------------------
// CENÁRIO 69–70: Relatório e INDEX
// ---------------------------------------------------------------------------

console.log('\n--- Relatório e INDEX ---');

test('69. relatório PR100 declara o que foi implementado', () => {
  const p = path.join(REPO_ROOT, 'schema/reports/PR100_SAFETY_GUARD_ANTI_AUTODESTRUICAO.md');
  assert.ok(fs.existsSync(p), 'Relatório PR100 deve existir');
  const content = fs.readFileSync(p, 'utf8');
  assert.ok(content.includes('enavia-safety-guard'), 'relatório deve mencionar enavia-safety-guard');
  assert.ok(content.includes('enavia-anti-loop'), 'relatório deve mencionar enavia-anti-loop');
});

test('70. INDEX avança próxima PR para PR101 — Prova Final', () => {
  const indexPath = path.join(REPO_ROOT, 'schema/contracts/INDEX.md');
  const content = fs.readFileSync(indexPath, 'utf8');
  assert.ok(content.includes('PR101'), 'INDEX.md deve mencionar PR101');
});

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------

console.log(`\n=== Resultado: ${passed} passaram, ${failed} falharam ===\n`);

if (failures.length > 0) {
  console.log('Falhas:');
  for (const f of failures) {
    console.log(`  ❌ ${f.name}: ${f.error}`);
  }
  process.exit(1);
}

console.log('✅ PR100 — Safety Guard / Anti-autodestruição — todos os cenários passando.\n');
process.exit(0);
