// ============================================================================
// 🧪 Smoke Tests — Contract Adherence Gate v1 (Blindagem Contratual PR 1)
//
// Run: node tests/contract-adherence-gate.smoke.test.js
//
// Tests:
//   Group 1:  Integridade dos enums
//   Group 2:  T1 — microetapa totalmente aderente → aderente_ao_contrato
//   Group 3:  T2 — microetapa com entrega parcial ou troca de escopo → parcial_desviado
//   Group 4:  T3 — microetapa claramente fora do contrato → fora_do_contrato
//   Group 5:  T4 — status "feito/concluído/real/integrado" não aparece quando desviado
//   Group 6:  T5 — camada auditável: campos_falhos explícitos, sem quebrar fluxo atual
//   Group 7:  T6 — validação de input inválido lança erro
//   Group 8:  T7 — shape canônico completo (AdherenceAudit)
//   Group 9:  T8 — determinismo: mesma entrada → mesma saída
//   Group 10: T9 — escopo proibido entregue → fora_do_contrato
//   Group 11: T10 — entrega mockada → campos_falhos registra desvio, can_mark_concluded=false
// ============================================================================

import {
  evaluateAdherence,
  ADHERENCE_STATUS,
  HONEST_STATUS,
  HONEST_STATUS_RULES,
} from "../schema/contract-adherence-gate.js";

let passed = 0;
let failed = 0;

function assert(condition, name) {
  if (condition) {
    console.log(`  ✅ ${name}`);
    passed++;
  } else {
    console.error(`  ❌ ${name}`);
    failed++;
  }
}

function assertThrows(fn, name) {
  try {
    fn();
    console.error(`  ❌ ${name} (expected throw, got none)`);
    failed++;
  } catch (_) {
    console.log(`  ✅ ${name}`);
    passed++;
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

// Contrato canônico: sistema de contabilidade
const contratoContabilidade = {
  objetivo_contratual_exato:  "Entregar sistema de contabilidade com lançamentos e relatórios fiscais",
  escopo_permitido:           ["lançamentos contábeis", "relatórios fiscais", "plano de contas"],
  escopo_proibido:            ["sistema financeiro", "módulo de folha de pagamento", "CRM"],
  criterio_de_aceite_literal: "Sistema registra lançamentos e gera relatório fiscal auditável",
};

// Resultado aderente: entregou exatamente o que o contrato pede
const resultadoAderente = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["lançamentos contábeis", "relatórios fiscais"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// Resultado parcial: entregou funcionalidade adjacente não listada no permitido
const resultadoParcialEscopoDesvio = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: false,   // critério de aceite não atendido
  escopo_efetivo:           ["lançamentos contábeis", "dashboard financeiro"],  // "dashboard financeiro" não está em escopo_permitido
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               true,   // entrega parcial
};

// Resultado fora do contrato: entregou sistema financeiro (proibido)
const resultadoForaContrato = {
  objetivo_atendido:        false,  // objetivo contratual não atendido
  criterio_aceite_atendido: false,
  escopo_efetivo:           ["sistema financeiro"],   // item explicitamente proibido
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// Resultado simulado
const resultadoSimulado = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["lançamentos contábeis"],
  is_simulado:              true,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

// Resultado mockado
const resultadoMockado = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["lançamentos contábeis", "relatórios fiscais"],
  is_simulado:              false,
  is_mockado:               true,
  is_local:                 false,
  is_parcial:               false,
};

// Resultado local
const resultadoLocal = {
  objetivo_atendido:        true,
  criterio_aceite_atendido: true,
  escopo_efetivo:           ["lançamentos contábeis", "relatórios fiscais"],
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 true,
  is_parcial:               false,
};

// ---------------------------------------------------------------------------
// Group 1 — Integridade dos enums
// ---------------------------------------------------------------------------
console.log("\nGroup 1: Integridade dos enums");

assert(ADHERENCE_STATUS.ADERENTE  === "aderente_ao_contrato", "ADHERENCE_STATUS.ADERENTE = 'aderente_ao_contrato'");
assert(ADHERENCE_STATUS.PARCIAL   === "parcial_desviado",     "ADHERENCE_STATUS.PARCIAL = 'parcial_desviado'");
assert(ADHERENCE_STATUS.FORA      === "fora_do_contrato",     "ADHERENCE_STATUS.FORA = 'fora_do_contrato'");

assert(HONEST_STATUS.CONCLUIDO        === "concluido",        "HONEST_STATUS.CONCLUIDO = 'concluido'");
assert(HONEST_STATUS.PARCIAL          === "parcial",          "HONEST_STATUS.PARCIAL = 'parcial'");
assert(HONEST_STATUS.FORA_DO_CONTRATO === "fora_do_contrato", "HONEST_STATUS.FORA_DO_CONTRATO = 'fora_do_contrato'");

assert(HONEST_STATUS_RULES[ADHERENCE_STATUS.ADERENTE] === HONEST_STATUS.CONCLUIDO,        "ADERENTE → honest = 'concluido'");
assert(HONEST_STATUS_RULES[ADHERENCE_STATUS.PARCIAL]  === HONEST_STATUS.PARCIAL,          "PARCIAL  → honest = 'parcial'");
assert(HONEST_STATUS_RULES[ADHERENCE_STATUS.FORA]     === HONEST_STATUS.FORA_DO_CONTRATO, "FORA     → honest = 'fora_do_contrato'");

// ---------------------------------------------------------------------------
// Group 2 — T1: microetapa totalmente aderente → aderente_ao_contrato
// ---------------------------------------------------------------------------
console.log("\nGroup 2: T1 — Microetapa totalmente aderente");

const auditAderente = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoAderente });

assert(auditAderente.adherence_status   === ADHERENCE_STATUS.ADERENTE, "T1: adherence_status = 'aderente_ao_contrato'");
assert(auditAderente.can_mark_concluded === true,                       "T1: can_mark_concluded = true");
assert(auditAderente.honest_status      === HONEST_STATUS.CONCLUIDO,   "T1: honest_status = 'concluido'");
assert(auditAderente.campos_falhos.length === 0,                        "T1: campos_falhos vazio");
assert(typeof auditAderente.reason      === "string",                   "T1: reason é string");
assert(typeof auditAderente.next_action === "string",                   "T1: next_action é string");

// ---------------------------------------------------------------------------
// Group 3 — T2: microetapa com entrega parcial ou troca silenciosa de escopo → parcial_desviado
// ---------------------------------------------------------------------------
console.log("\nGroup 3: T2 — Microetapa com entrega parcial / desvio de escopo");

const auditParcial = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoParcialEscopoDesvio });

assert(auditParcial.adherence_status   === ADHERENCE_STATUS.PARCIAL, "T2: adherence_status = 'parcial_desviado'");
assert(auditParcial.can_mark_concluded === false,                     "T2: can_mark_concluded = false");
assert(auditParcial.honest_status      === HONEST_STATUS.PARCIAL,    "T2: honest_status = 'parcial'");
assert(auditParcial.campos_falhos.length > 0,                        "T2: campos_falhos não vazio");
assert(auditParcial.campos_falhos.some(c => c.includes("criterio_de_aceite_literal")),
  "T2: campos_falhos registra falha no criterio_de_aceite_literal");
assert(auditParcial.campos_falhos.some(c => c.includes("is_parcial") || c.includes("parcial")),
  "T2: campos_falhos registra entrega parcial");

// ---------------------------------------------------------------------------
// Group 4 — T3: microetapa claramente fora do contrato → fora_do_contrato
// ---------------------------------------------------------------------------
console.log("\nGroup 4: T3 — Microetapa fora do contrato");

const auditFora = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoForaContrato });

assert(auditFora.adherence_status   === ADHERENCE_STATUS.FORA,          "T3: adherence_status = 'fora_do_contrato'");
assert(auditFora.can_mark_concluded === false,                           "T3: can_mark_concluded = false");
assert(auditFora.honest_status      === HONEST_STATUS.FORA_DO_CONTRATO, "T3: honest_status = 'fora_do_contrato'");
assert(auditFora.campos_falhos.length > 0,                              "T3: campos_falhos não vazio");
assert(auditFora.campos_falhos.some(c => c.includes("objetivo")),
  "T3: campos_falhos registra falha no objetivo_contratual_exato");
assert(auditFora.campos_falhos.some(c => c.includes("proibido") || c.includes("sistema financeiro")),
  "T3: campos_falhos registra item proibido entregue");

// ---------------------------------------------------------------------------
// Group 5 — T4: status "feito/concluído/real/integrado" não aparece quando desviado
// ---------------------------------------------------------------------------
console.log("\nGroup 5: T4 — Status honestos não aparecem quando classificação não permite");

// Simulado → não pode ser "feito"
const auditSimulado = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoSimulado });
assert(auditSimulado.adherence_status   !== ADHERENCE_STATUS.ADERENTE, "T4: simulado → não é aderente_ao_contrato");
assert(auditSimulado.can_mark_concluded === false,                      "T4: simulado → can_mark_concluded = false");
assert(auditSimulado.honest_status      !== HONEST_STATUS.CONCLUIDO,   "T4: simulado → honest_status ≠ 'concluido'");
assert(auditSimulado.campos_falhos.some(c => c.includes("simulad")),
  "T4: simulado → campos_falhos registra 'feito' bloqueado");

// Mockado → não pode ser "integrado"
const auditMockado = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoMockado });
assert(auditMockado.adherence_status   !== ADHERENCE_STATUS.ADERENTE, "T4: mockado → não é aderente_ao_contrato");
assert(auditMockado.can_mark_concluded === false,                      "T4: mockado → can_mark_concluded = false");
assert(auditMockado.campos_falhos.some(c => c.includes("mockad")),
  "T4: mockado → campos_falhos registra 'integrado' bloqueado");

// Local → não pode ser "real"
const auditLocal = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoLocal });
assert(auditLocal.adherence_status   !== ADHERENCE_STATUS.ADERENTE, "T4: local → não é aderente_ao_contrato");
assert(auditLocal.can_mark_concluded === false,                      "T4: local → can_mark_concluded = false");
assert(auditLocal.campos_falhos.some(c => c.includes("local")),
  "T4: local → campos_falhos registra 'real' bloqueado");

// ---------------------------------------------------------------------------
// Group 6 — T5: camada auditável: campos_falhos explícitos, sem quebrar fluxo atual
// ---------------------------------------------------------------------------
console.log("\nGroup 6: T5 — Camada auditável e sem quebrar fluxo existente");

// Gate puro: sem I/O, sem efeitos colaterais
assert(typeof evaluateAdherence === "function",    "T5: evaluateAdherence é função pura exportada");
assert(typeof ADHERENCE_STATUS  === "object",      "T5: ADHERENCE_STATUS é objeto exportado");
assert(typeof HONEST_STATUS     === "object",      "T5: HONEST_STATUS é objeto exportado");

// Resultado é serializável (sem funções, sem símbolos, sem circular)
const auditParaSerializer = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoAderente });
const serialized = JSON.stringify(auditParaSerializer);
assert(typeof serialized === "string" && serialized.length > 0, "T5: AdherenceAudit é serializável via JSON.stringify");

// Resultado é determinístico: chamada dupla com mesma entrada → mesmo resultado
const audit1 = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoParcialEscopoDesvio });
const audit2 = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoParcialEscopoDesvio });
assert(audit1.adherence_status === audit2.adherence_status,   "T5: determinístico — adherence_status estável");
assert(audit1.can_mark_concluded === audit2.can_mark_concluded, "T5: determinístico — can_mark_concluded estável");
assert(audit1.campos_falhos.length === audit2.campos_falhos.length, "T5: determinístico — campos_falhos estável");

// Não importa nem usa contract-executor.js (não polui fluxo atual)
const gateSource = await import("../schema/contract-adherence-gate.js");
assert(!Object.keys(gateSource).some(k => k.toLowerCase().includes("executor")),
  "T5: gate não expõe símbolos do executor (fluxo atual intacto)");

// ---------------------------------------------------------------------------
// Group 7 — T6: validação de input inválido lança erro
// ---------------------------------------------------------------------------
console.log("\nGroup 7: T6 — Input inválido lança erro");

assertThrows(() => evaluateAdherence({}),
  "T6: contract ausente → lança erro");
assertThrows(() => evaluateAdherence({ contract: null, resultado: resultadoAderente }),
  "T6: contract null → lança erro");
assertThrows(() => evaluateAdherence({ contract: contratoContabilidade, resultado: null }),
  "T6: resultado null → lança erro");
assertThrows(() => evaluateAdherence({ contract: { objetivo_contratual_exato: "" }, resultado: resultadoAderente }),
  "T6: objetivo_contratual_exato vazio → lança erro");
assertThrows(() => evaluateAdherence({
    contract: contratoContabilidade,
    resultado: { ...resultadoAderente, objetivo_atendido: "sim" },  // string em vez de boolean
  }),
  "T6: objetivo_atendido não-boolean → lança erro");

// ---------------------------------------------------------------------------
// Group 8 — T7: shape canônico completo (AdherenceAudit)
// ---------------------------------------------------------------------------
console.log("\nGroup 8: T7 — Shape canônico completo (AdherenceAudit)");

const auditShape = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoAderente });

assert("adherence_status"   in auditShape, "T7: shape tem adherence_status");
assert("can_mark_concluded" in auditShape, "T7: shape tem can_mark_concluded");
assert("honest_status"      in auditShape, "T7: shape tem honest_status");
assert("campos_falhos"      in auditShape, "T7: shape tem campos_falhos");
assert("reason"             in auditShape, "T7: shape tem reason");
assert("next_action"        in auditShape, "T7: shape tem next_action");
assert(Array.isArray(auditShape.campos_falhos), "T7: campos_falhos é array");
assert(typeof auditShape.can_mark_concluded === "boolean", "T7: can_mark_concluded é boolean");

// ---------------------------------------------------------------------------
// Group 9 — T8: determinismo
// ---------------------------------------------------------------------------
console.log("\nGroup 9: T8 — Resultado é determinístico");

const det1 = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoForaContrato });
const det2 = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoForaContrato });

assert(det1.adherence_status   === det2.adherence_status,   "T8: adherence_status estável para fora_do_contrato");
assert(det1.can_mark_concluded === det2.can_mark_concluded, "T8: can_mark_concluded estável");
assert(JSON.stringify(det1.campos_falhos) === JSON.stringify(det2.campos_falhos), "T8: campos_falhos idênticos");

// ---------------------------------------------------------------------------
// Group 10 — T9: escopo proibido entregue → fora_do_contrato
// ---------------------------------------------------------------------------
console.log("\nGroup 10: T9 — Escopo proibido entregue");

const resultadoProibido = {
  objetivo_atendido:        true,   // objetivo declarado atendido
  criterio_aceite_atendido: true,   // critério declarado atendido
  escopo_efetivo:           ["lançamentos contábeis", "módulo de folha de pagamento"],  // proibido!
  is_simulado:              false,
  is_mockado:               false,
  is_local:                 false,
  is_parcial:               false,
};

const auditProibido = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoProibido });
assert(auditProibido.adherence_status   === ADHERENCE_STATUS.FORA,   "T9: item proibido entregue → fora_do_contrato");
assert(auditProibido.can_mark_concluded === false,                    "T9: can_mark_concluded = false");
assert(auditProibido.campos_falhos.some(c => c.includes("proibido")),
  "T9: campos_falhos registra item proibido");

// ---------------------------------------------------------------------------
// Group 11 — T10: entrega mockada → registra desvio
// ---------------------------------------------------------------------------
console.log("\nGroup 11: T10 — Entrega mockada registra desvio honesto");

const auditMockadoFull = evaluateAdherence({ contract: contratoContabilidade, resultado: resultadoMockado });
assert(auditMockadoFull.adherence_status   === ADHERENCE_STATUS.PARCIAL, "T10: mockado → parcial_desviado");
assert(auditMockadoFull.can_mark_concluded === false,                     "T10: mockado → can_mark_concluded = false");
assert(auditMockadoFull.honest_status      === HONEST_STATUS.PARCIAL,    "T10: mockado → honest_status = 'parcial'");
assert(auditMockadoFull.campos_falhos.some(c => c.includes("integrado") || c.includes("mockad")),
  "T10: campos_falhos referencia bloqueio de 'integrado'");

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log(`\n${"=".repeat(60)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
}
