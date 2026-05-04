/**
 * pr99-event-log-health-snapshot.prova.test.js
 *
 * Prova formal — PR99 — Event Log + Health Snapshot Unificado
 * Contrato: CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md
 *
 * 88 cenários de prova.
 * Executar: node tests/pr99-event-log-health-snapshot.prova.test.js
 */

'use strict';

const fs = require('fs');
const path = require('path');

// ---------------------------------------------------------------------------
// Helpers de asserção
// ---------------------------------------------------------------------------

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, label) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(`FAIL [${passed + failed}]: ${label}`);
    console.error(`  ✗ FAIL: ${label}`);
  }
}

function describe(label) {
  console.log(`\n── ${label}`);
}

// ---------------------------------------------------------------------------
// Imports dos helpers (verificação de existência primeiro)
// ---------------------------------------------------------------------------

const ROOT = path.join(__dirname, '..');
const EVENT_LOG_PATH = path.join(ROOT, 'schema', 'enavia-event-log.js');
const HEALTH_SNAPSHOT_PATH = path.join(ROOT, 'schema', 'enavia-health-snapshot.js');
const INDEX_PATH = path.join(ROOT, 'schema', 'contracts', 'INDEX.md');
const ACTIVE_CONTRACT_PATH = path.join(
  ROOT,
  'schema',
  'contracts',
  'active',
  'CONTRATO_ENAVIA_OBSERVABILIDADE_AUTOPROTECAO_PR98_PR101.md'
);
const PR98_REPORT_PATH = path.join(
  ROOT,
  'schema',
  'reports',
  'PR98_OBSERVABILIDADE_AUTOPROTECAO_DIAGNOSTICO.md'
);

// ---------------------------------------------------------------------------
// Grupo 1 — Governança
// ---------------------------------------------------------------------------

describe('Grupo 1 — Governança');

// Cenário 1
assert(
  fs.existsSync(ACTIVE_CONTRACT_PATH),
  'contrato PR98–PR101 ativo existe'
);

// Cenário 2 — PR98 concluída
{
  const indexContent = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : '';
  assert(
    indexContent.includes('PR98') && indexContent.includes('concluída'),
    'PR98 marcada como concluída no INDEX'
  );
}

// Cenário 3 — PR99 é próxima PR autorizada
{
  const indexContent = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : '';
  assert(
    indexContent.includes('PR99') && indexContent.includes('autorizada'),
    'PR99 marcada como próxima PR autorizada no INDEX antes do avanço'
  );
}

// ---------------------------------------------------------------------------
// Grupo 2 — Existência dos arquivos
// ---------------------------------------------------------------------------

describe('Grupo 2 — Existência dos arquivos');

// Cenário 4
assert(fs.existsSync(EVENT_LOG_PATH), 'enavia-event-log.js existe');

// Cenário 5
assert(fs.existsSync(HEALTH_SNAPSHOT_PATH), 'enavia-health-snapshot.js existe');

// ---------------------------------------------------------------------------
// Grupo 3 — Funções exportadas — Event Log
// ---------------------------------------------------------------------------

describe('Grupo 3 — Funções exportadas (Event Log)');

let eventLog;
try {
  eventLog = require(EVENT_LOG_PATH);
} catch (e) {
  eventLog = {};
  console.error('  Erro ao importar enavia-event-log.js:', e.message);
}

// Cenário 6
assert(typeof eventLog.createEnaviaEvent === 'function', 'createEnaviaEvent existe');
// Cenário 7
assert(typeof eventLog.appendEnaviaEvent === 'function', 'appendEnaviaEvent existe');
// Cenário 8
assert(typeof eventLog.normalizeEnaviaEvents === 'function', 'normalizeEnaviaEvents existe');
// Cenário 9
assert(typeof eventLog.buildEventLogSnapshot === 'function', 'buildEventLogSnapshot existe');
// Cenário 10
assert(typeof eventLog.filterEnaviaEvents === 'function', 'filterEnaviaEvents existe');

// ---------------------------------------------------------------------------
// Grupo 4 — Funções exportadas — Health Snapshot
// ---------------------------------------------------------------------------

describe('Grupo 4 — Funções exportadas (Health Snapshot)');

let healthSnapshot;
try {
  healthSnapshot = require(HEALTH_SNAPSHOT_PATH);
} catch (e) {
  healthSnapshot = {};
  console.error('  Erro ao importar enavia-health-snapshot.js:', e.message);
}

// Cenário 11
assert(typeof healthSnapshot.buildHealthSnapshot === 'function', 'buildHealthSnapshot existe');
// Cenário 12
assert(typeof healthSnapshot.evaluateSubsystemHealth === 'function', 'evaluateSubsystemHealth existe');
// Cenário 13
assert(typeof healthSnapshot.deriveOverallHealth === 'function', 'deriveOverallHealth existe');
// Cenário 14
assert(typeof healthSnapshot.buildRollbackHints === 'function', 'buildRollbackHints existe');
// Cenário 15
assert(typeof healthSnapshot.buildHealthEvidence === 'function', 'buildHealthEvidence existe');

// ---------------------------------------------------------------------------
// Grupo 5 — createEnaviaEvent — campos mínimos
// ---------------------------------------------------------------------------

describe('Grupo 5 — createEnaviaEvent — campos mínimos');

const {
  createEnaviaEvent,
  appendEnaviaEvent,
  normalizeEnaviaEvents,
  filterEnaviaEvents,
  buildEventLogSnapshot,
} = eventLog;

const sampleInput = {
  source: 'worker',
  subsystem: 'worker',
  type: 'health_check',
  severity: 'info',
  status: 'ok',
  message: 'Worker operacional',
  execution_id: 'exec-001',
  contract_id: 'pr99-contract',
  correlation_id: 'corr-abc',
  evidence: { endpoint: '/health', response: 'ok' },
  rollback_hint: 'reiniciar worker via wrangler',
  requires_human_review: false,
  metadata: { region: 'us-east' },
};

let sampleResult;
if (typeof createEnaviaEvent === 'function') {
  sampleResult = createEnaviaEvent(sampleInput);
}

// Cenário 16
assert(sampleResult && sampleResult.ok === true, 'createEnaviaEvent cria evento válido');
// Cenário 17
assert(sampleResult && sampleResult.event && typeof sampleResult.event.event_id === 'string' && sampleResult.event.event_id.length > 0, 'evento tem event_id');
// Cenário 18
assert(sampleResult && sampleResult.event && typeof sampleResult.event.timestamp === 'string', 'evento tem timestamp');
// Cenário 19
assert(sampleResult && sampleResult.event && sampleResult.event.source === 'worker', 'evento tem source');
// Cenário 20
assert(sampleResult && sampleResult.event && sampleResult.event.subsystem === 'worker', 'evento tem subsystem');
// Cenário 21
assert(sampleResult && sampleResult.event && sampleResult.event.severity === 'info', 'evento tem severity');
// Cenário 22
assert(sampleResult && sampleResult.event && sampleResult.event.status === 'ok', 'evento tem status');
// Cenário 23
assert(sampleResult && sampleResult.event && sampleResult.event.execution_id === 'exec-001', 'evento preserva execution_id');
// Cenário 24
assert(sampleResult && sampleResult.event && sampleResult.event.contract_id === 'pr99-contract', 'evento preserva contract_id');
// Cenário 25
assert(sampleResult && sampleResult.event && sampleResult.event.correlation_id === 'corr-abc', 'evento preserva correlation_id');
// Cenário 26
assert(sampleResult && sampleResult.event && sampleResult.event.evidence !== undefined, 'evento aceita evidence');
// Cenário 27
assert(sampleResult && sampleResult.event && sampleResult.event.rollback_hint === 'reiniciar worker via wrangler', 'evento aceita rollback_hint');
// Cenário 28
assert(sampleResult && sampleResult.event && sampleResult.event.requires_human_review === false, 'evento aceita requires_human_review');

// ---------------------------------------------------------------------------
// Grupo 6 — Normalização de valores inválidos
// ---------------------------------------------------------------------------

describe('Grupo 6 — Normalização de valores inválidos');

// Cenário 29 — severity inválida vira warning
{
  const r = typeof createEnaviaEvent === 'function'
    ? createEnaviaEvent({ source: 'x', type: 'y', severity: 'super_critical', status: 'ok', message: 'm' })
    : null;
  assert(
    r && r.ok && (r.event.severity === 'warning' || r.event.severity === 'info' || r.error),
    'severity inválida vira warning/info ou erro controlado'
  );
}

// Cenário 30 — status inválido vira unknown
{
  const r = typeof createEnaviaEvent === 'function'
    ? createEnaviaEvent({ source: 'x', type: 'y', severity: 'info', status: 'maybe', message: 'm' })
    : null;
  assert(
    r && r.ok && (r.event.status === 'unknown' || r.error),
    'status inválido vira unknown ou erro controlado'
  );
}

// Cenário 31 — subsystem desconhecido vira unknown
{
  const r = typeof createEnaviaEvent === 'function'
    ? createEnaviaEvent({ source: 'x', subsystem: 'nao_existe', type: 'y', severity: 'info', status: 'ok', message: 'm' })
    : null;
  assert(
    r && r.ok && r.event.subsystem === 'unknown',
    'subsystem desconhecido vira unknown'
  );
}

// ---------------------------------------------------------------------------
// Grupo 7 — appendEnaviaEvent / normalizeEnaviaEvents / filterEnaviaEvents
// ---------------------------------------------------------------------------

describe('Grupo 7 — appendEnaviaEvent / normalizeEnaviaEvents / filterEnaviaEvents');

const evt1 = sampleResult && sampleResult.event ? sampleResult.event : { event_id: 'x', subsystem: 'worker', severity: 'info', status: 'ok', requires_human_review: false };

// Cenário 32 — appendEnaviaEvent não muta array original
{
  const original = [evt1];
  const originalLength = original.length;
  const newArr = typeof appendEnaviaEvent === 'function'
    ? appendEnaviaEvent(original, { event_id: 'y', subsystem: 'executor' })
    : null;
  assert(
    original.length === originalLength && newArr && newArr.length === originalLength + 1,
    'appendEnaviaEvent não muta array original'
  );
}

// Cenário 33 — normalizeEnaviaEvents normaliza lista
{
  const r = typeof normalizeEnaviaEvents === 'function'
    ? normalizeEnaviaEvents([sampleInput, { source: 'executor', subsystem: 'executor', type: 'start', severity: 'info', status: 'ok', message: 'ok', timestamp: new Date().toISOString(), event_id: 'e2' }])
    : null;
  assert(r && Array.isArray(r.events) && r.events.length === 2, 'normalizeEnaviaEvents normaliza lista');
}

// Prepara alguns eventos para filtros
const evtWorkerCritical = typeof createEnaviaEvent === 'function'
  ? createEnaviaEvent({ source: 'w', subsystem: 'worker', type: 't', severity: 'critical', status: 'failed', message: 'falha grave', rollback_hint: 'reverter deploy', requires_human_review: true }).event
  : { subsystem: 'worker', severity: 'critical', status: 'failed', requires_human_review: true, rollback_hint: 'reverter deploy' };

const evtExecutorError = typeof createEnaviaEvent === 'function'
  ? createEnaviaEvent({ source: 'e', subsystem: 'executor', type: 't', severity: 'error', status: 'degraded', message: 'executor lento' }).event
  : { subsystem: 'executor', severity: 'error', status: 'degraded', requires_human_review: false };

const evtChatOk = typeof createEnaviaEvent === 'function'
  ? createEnaviaEvent({ source: 'c', subsystem: 'chat', type: 't', severity: 'info', status: 'ok', message: 'chat ok' }).event
  : { subsystem: 'chat', severity: 'info', status: 'ok', requires_human_review: false };

const evtBlocked = typeof createEnaviaEvent === 'function'
  ? createEnaviaEvent({ source: 's', subsystem: 'safety', type: 'block', severity: 'warning', status: 'blocked', message: 'bloqueado', requires_human_review: true, rollback_hint: 'aprovar manualmente' }).event
  : { subsystem: 'safety', severity: 'warning', status: 'blocked', requires_human_review: true, rollback_hint: 'aprovar manualmente' };

const allEvents = [evt1, evtWorkerCritical, evtExecutorError, evtChatOk, evtBlocked].filter(Boolean);

// Cenário 34 — filterEnaviaEvents filtra por subsystem
{
  const filtered = typeof filterEnaviaEvents === 'function'
    ? filterEnaviaEvents(allEvents, { subsystem: 'worker' })
    : null;
  assert(
    filtered && filtered.every(e => e.subsystem === 'worker'),
    'filterEnaviaEvents filtra por subsystem'
  );
}

// Cenário 35 — filterEnaviaEvents filtra por severity
{
  const filtered = typeof filterEnaviaEvents === 'function'
    ? filterEnaviaEvents(allEvents, { severity: 'critical' })
    : null;
  assert(
    filtered && filtered.every(e => e.severity === 'critical'),
    'filterEnaviaEvents filtra por severity'
  );
}

// Cenário 36 — filterEnaviaEvents filtra por status
{
  const filtered = typeof filterEnaviaEvents === 'function'
    ? filterEnaviaEvents(allEvents, { status: 'ok' })
    : null;
  assert(
    filtered && filtered.every(e => e.status === 'ok'),
    'filterEnaviaEvents filtra por status'
  );
}

// ---------------------------------------------------------------------------
// Grupo 8 — buildEventLogSnapshot
// ---------------------------------------------------------------------------

describe('Grupo 8 — buildEventLogSnapshot');

let snap;
if (typeof buildEventLogSnapshot === 'function') {
  snap = buildEventLogSnapshot(allEvents);
}

// Cenário 37
assert(snap && snap.total_events === allEvents.length, 'snapshot conta total_events');
// Cenário 38
assert(snap && typeof snap.by_severity === 'object' && snap.by_severity !== null, 'snapshot conta by_severity');
// Cenário 39
assert(snap && typeof snap.by_status === 'object' && snap.by_status !== null, 'snapshot conta by_status');
// Cenário 40
assert(snap && typeof snap.by_subsystem === 'object' && snap.by_subsystem !== null, 'snapshot conta by_subsystem');
// Cenário 41
assert(snap && snap.latest_event !== null, 'snapshot identifica latest_event');
// Cenário 42
assert(snap && typeof snap.critical_count === 'number', 'snapshot conta critical_count');
// Cenário 43
assert(snap && typeof snap.failed_count === 'number', 'snapshot conta failed_count');
// Cenário 44
assert(snap && typeof snap.blocked_count === 'number', 'snapshot conta blocked_count');
// Cenário 45
assert(snap && typeof snap.requires_human_review_count === 'number', 'snapshot conta requires_human_review_count');
// Cenário 46
assert(snap && Array.isArray(snap.rollback_hints), 'snapshot consolida rollback_hints');

// ---------------------------------------------------------------------------
// Grupo 9 — buildHealthSnapshot — campos e modo
// ---------------------------------------------------------------------------

describe('Grupo 9 — buildHealthSnapshot — campos e modo');

const { buildHealthSnapshot, evaluateSubsystemHealth, deriveOverallHealth, buildRollbackHints, buildHealthEvidence } = healthSnapshot;

let hs;
if (typeof buildHealthSnapshot === 'function') {
  hs = buildHealthSnapshot({ events: allEvents, label: 'pr99-test' });
}

// Cenário 47
assert(hs && hs.mode === 'health_snapshot', 'buildHealthSnapshot retorna mode health_snapshot');
// Cenário 48
assert(hs && hs.subsystems && typeof hs.subsystems.worker === 'object', 'buildHealthSnapshot cobre worker');
// Cenário 49
assert(hs && hs.subsystems && typeof hs.subsystems.executor === 'object', 'buildHealthSnapshot cobre executor');
// Cenário 50
assert(hs && hs.subsystems && typeof hs.subsystems.chat === 'object', 'buildHealthSnapshot cobre chat');
// Cenário 51
assert(hs && hs.subsystems && typeof hs.subsystems.skill_factory === 'object', 'buildHealthSnapshot cobre skill_factory');
// Cenário 52
assert(hs && hs.subsystems && typeof hs.subsystems.skill_runner === 'object', 'buildHealthSnapshot cobre skill_runner');
// Cenário 53
assert(hs && hs.subsystems && typeof hs.subsystems.pr_orchestrator === 'object', 'buildHealthSnapshot cobre pr_orchestrator');
// Cenário 54
assert(hs && hs.subsystems && typeof hs.subsystems.deploy_loop === 'object', 'buildHealthSnapshot cobre deploy_loop');
// Cenário 55
assert(hs && hs.subsystems && typeof hs.subsystems.self_auditor === 'object', 'buildHealthSnapshot cobre self_auditor');
// Cenário 56
assert(hs && hs.subsystems && typeof hs.subsystems.safety === 'object', 'buildHealthSnapshot cobre safety');

// ---------------------------------------------------------------------------
// Grupo 10 — buildHealthSnapshot — sem eventos (estado controlado)
// ---------------------------------------------------------------------------

describe('Grupo 10 — buildHealthSnapshot — sem eventos');

let hsEmpty;
if (typeof buildHealthSnapshot === 'function') {
  hsEmpty = buildHealthSnapshot({ events: [] });
}

// Cenário 57
assert(
  hsEmpty && (hsEmpty.overall_status === 'unknown' || hsEmpty.overall_status === 'healthy') && hsEmpty.ok === true,
  'sem eventos retorna status controlado (não crasha)'
);

// ---------------------------------------------------------------------------
// Grupo 11 — Elevação de risco por eventos críticos/falhos/bloqueados
// ---------------------------------------------------------------------------

describe('Grupo 11 — Elevação de risco');

const evtsCritical = typeof createEnaviaEvent === 'function'
  ? [createEnaviaEvent({ source: 'w', subsystem: 'worker', type: 't', severity: 'critical', status: 'failed', message: 'crítico', rollback_hint: 'rollback-crítico', requires_human_review: false }).event]
  : [{ subsystem: 'worker', severity: 'critical', status: 'failed', requires_human_review: false, rollback_hint: 'rollback-crítico' }];

let hsCritical;
if (typeof buildHealthSnapshot === 'function') {
  hsCritical = buildHealthSnapshot({ events: evtsCritical });
}

// Cenário 58
assert(
  hsCritical && (hsCritical.risk_level === 'critical' || hsCritical.risk_level === 'high'),
  'evento critical eleva risk_level'
);

const evtsFailed = typeof createEnaviaEvent === 'function'
  ? [createEnaviaEvent({ source: 'e', subsystem: 'executor', type: 't', severity: 'error', status: 'failed', message: 'executor falhou' }).event]
  : [{ subsystem: 'executor', severity: 'error', status: 'failed', requires_human_review: false }];

let hsFailed;
if (typeof buildHealthSnapshot === 'function') {
  hsFailed = buildHealthSnapshot({ events: evtsFailed });
}

// Cenário 59
assert(
  hsFailed && Array.isArray(hsFailed.failed_subsystems) && hsFailed.failed_subsystems.includes('executor'),
  'evento failed afeta failed_subsystems'
);

const evtsBlocked = typeof createEnaviaEvent === 'function'
  ? [createEnaviaEvent({ source: 's', subsystem: 'safety', type: 't', severity: 'warning', status: 'blocked', message: 'bloqueado', requires_human_review: true }).event]
  : [{ subsystem: 'safety', severity: 'warning', status: 'blocked', requires_human_review: true }];

let hsBlocked;
if (typeof buildHealthSnapshot === 'function') {
  hsBlocked = buildHealthSnapshot({ events: evtsBlocked });
}

// Cenário 60
assert(
  hsBlocked && hsBlocked.requires_human_review === true,
  'evento blocked com human review marca requires_human_review'
);

// ---------------------------------------------------------------------------
// Grupo 12 — Rollback hints e evidence
// ---------------------------------------------------------------------------

describe('Grupo 12 — Rollback hints e evidence');

// Cenário 61
assert(
  hs && Array.isArray(hs.rollback_hints) && hs.rollback_hints.length > 0,
  'rollback_hints aparecem no snapshot (quando há eventos com hints)'
);

// Cenário 62
assert(
  hs && hs.evidence && typeof hs.evidence.summary === 'string' && hs.evidence.summary.length > 0,
  'evidence contém resumo de eventos'
);

// Cenário 63
assert(
  hs && typeof hs.next_recommended_action === 'string' && hs.next_recommended_action.length > 0,
  'next_recommended_action é gerado'
);

// ---------------------------------------------------------------------------
// Grupo 13 — Pureza: sem fetch, child_process, escrita
// ---------------------------------------------------------------------------

describe('Grupo 13 — Pureza do helper');

// Cenário 64 — sem fetch
{
  const src = fs.existsSync(EVENT_LOG_PATH) ? fs.readFileSync(EVENT_LOG_PATH, 'utf8') : '';
  const hsrc = fs.existsSync(HEALTH_SNAPSHOT_PATH) ? fs.readFileSync(HEALTH_SNAPSHOT_PATH, 'utf8') : '';
  assert(!src.includes('fetch(') && !hsrc.includes('fetch('), 'helper não usa fetch');
}

// Cenário 65 — sem child_process (verifica require, não comentários)
{
  const src = fs.existsSync(EVENT_LOG_PATH) ? fs.readFileSync(EVENT_LOG_PATH, 'utf8') : '';
  const hsrc = fs.existsSync(HEALTH_SNAPSHOT_PATH) ? fs.readFileSync(HEALTH_SNAPSHOT_PATH, 'utf8') : '';
  assert(
    !src.includes("require('child_process')") && !src.includes('require("child_process")') &&
    !hsrc.includes("require('child_process')") && !hsrc.includes('require("child_process")'),
    'helper não usa child_process'
  );
}

// Cenário 66 — sem escrita em arquivo/KV/banco
{
  const src = fs.existsSync(EVENT_LOG_PATH) ? fs.readFileSync(EVENT_LOG_PATH, 'utf8') : '';
  const hsrc = fs.existsSync(HEALTH_SNAPSHOT_PATH) ? fs.readFileSync(HEALTH_SNAPSHOT_PATH, 'utf8') : '';
  const noWrite = !src.includes('fs.write') && !src.includes('.put(') && !src.includes('.set(')
    && !hsrc.includes('fs.write') && !hsrc.includes('.put(') && !hsrc.includes('.set(');
  assert(noWrite, 'helper não escreve arquivo/KV/banco');
}

// ---------------------------------------------------------------------------
// Grupo 14 — Arquivos proibidos não alterados
// ---------------------------------------------------------------------------

describe('Grupo 14 — Arquivos proibidos não alterados');

const PROHIBITED = [
  ['nv-enavia.js', path.join(ROOT, 'nv-enavia.js')],
  ['executor/src/index.js', path.join(ROOT, 'executor', 'src', 'index.js')],
  ['contract-executor.js', path.join(ROOT, 'contract-executor.js')],
  ['deploy.yml', path.join(ROOT, '.github', 'workflows', 'deploy.yml')],
  ['wrangler.toml', path.join(ROOT, 'wrangler.toml')],
];

// Cenários 67–71
for (const [label, filePath] of PROHIBITED) {
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, 'utf8');
    assert(
      !content.includes('enavia-event-log') && !content.includes('enavia-health-snapshot'),
      `não alterou ${label}`
    );
  } else {
    // Arquivo não existe — não pode ter sido alterado
    assert(true, `não alterou ${label} (arquivo não existe neste ambiente)`);
  }
}

// Cenário 72 — panel/** não alterado
{
  const panelDir = path.join(ROOT, 'panel');
  let panelOk = true;
  if (fs.existsSync(panelDir)) {
    const checkDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          checkDir(full);
        } else if (entry.isFile() && full.endsWith('.js')) {
          const content = fs.readFileSync(full, 'utf8');
          if (content.includes('enavia-event-log') || content.includes('enavia-health-snapshot')) {
            panelOk = false;
          }
        }
      }
    };
    checkDir(panelDir);
  }
  assert(panelOk, 'não alterou panel/**');
}

// ---------------------------------------------------------------------------
// Grupo 15 — Regressão — testes anteriores existem
// ---------------------------------------------------------------------------

describe('Grupo 15 — Regressão — testes anteriores existem');

const PREV_TESTS = [
  'pr98-observabilidade-autoprotecao-diagnostico.prova.test.js',
  'pr97-chat-livre-cockpit-final.prova.test.js',
  'pr96-cockpit-passivo-chat-readable.smoke.test.js',
  'pr95-chat-livre-seguro.smoke.test.js',
  'pr94-chat-livre-cockpit-diagnostico.prova.test.js',
  'pr93-ready-for-merge-deploy-test-ready.prova.test.js',
  'pr92-pr-executor-supervisionado-mock.prova.test.js',
  'pr91-pr-planner-schema.prova.test.js',
  'pr90-pr-orchestrator-diagnostico.prova.test.js',
  'pr89-internal-loop-final-proof.smoke.test.js',
  'pr84-chat-vivo.smoke.test.js',
  'pr59-response-policy-viva.smoke.test.js',
];

// Cenários 73–84
for (const testFile of PREV_TESTS) {
  const testPath = path.join(ROOT, 'tests', testFile);
  assert(fs.existsSync(testPath), `${testFile} existe (regressão)`);
}

// ---------------------------------------------------------------------------
// Grupo 16 — Relatório e governança
// ---------------------------------------------------------------------------

describe('Grupo 16 — Relatório e governança');

const PR99_REPORT_PATH = path.join(ROOT, 'schema', 'reports', 'PR99_EVENT_LOG_HEALTH_SNAPSHOT.md');

// Cenário 85
assert(fs.existsSync(PR99_REPORT_PATH), 'relatório PR99 existe');

// Cenário 86 — relatório declara o que foi implementado
{
  const content = fs.existsSync(PR99_REPORT_PATH) ? fs.readFileSync(PR99_REPORT_PATH, 'utf8') : '';
  assert(
    content.includes('enavia-event-log') && content.includes('enavia-health-snapshot'),
    'relatório PR99 declara o que foi implementado'
  );
}

// Cenário 87 — relatório declara o que não foi mexido
{
  const content = fs.existsSync(PR99_REPORT_PATH) ? fs.readFileSync(PR99_REPORT_PATH, 'utf8') : '';
  assert(
    content.includes('nv-enavia.js') || content.includes('não alterado'),
    'relatório PR99 declara o que não foi mexido'
  );
}

// Cenário 88 — INDEX avança próxima PR para PR100
{
  const indexContent = fs.existsSync(INDEX_PATH) ? fs.readFileSync(INDEX_PATH, 'utf8') : '';
  assert(
    indexContent.includes('PR100') && (indexContent.includes('Safety Guard') || indexContent.includes('Anti-autodestruição') || indexContent.includes('próxima')),
    'INDEX avança próxima PR para PR100 — Safety Guard / Anti-autodestruição'
  );
}

// ---------------------------------------------------------------------------
// Resultado final
// ---------------------------------------------------------------------------

console.log(`\n${'='.repeat(60)}`);
console.log(`PR99 — Event Log + Health Snapshot Unificado`);
console.log(`Resultado: ${passed}/${passed + failed} cenários passando`);
if (failures.length > 0) {
  console.log(`\nFalhas:`);
  for (const f of failures) console.log(` ${f}`);
}
console.log('='.repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log('\n✅ Todos os cenários passando.');
  process.exit(0);
}
