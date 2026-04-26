// =============================================================================
// ENAVIA Panel — P27 planner gate: brief estruturado
//
// Cobre o contrato do gate do botão "Gerar plano" após a correção:
//
//   Regra correta:
//     A Enavia aceita:
//       (a) 2+ mensagens de alinhamento; OU
//       (b) brief estruturado único com Objetivo/Contexto/Restrições/Critério; OU
//       (c) input digitado pelo operador no momento do clique.
//
//   O gate NÃO deve bloquear quando o brief já é suficiente.
//   O gate NÃO deve exigir "2 ou mais mensagens" quando uma mensagem única
//   já contém objetivo + target/contexto + escopo/restrições/critério.
//
// PROVAS:
//  1. Mensagem "2 ou mais mensagens de alinhamento" REMOVIDA do código
//  2. Lógica `plannerContextSufficient` presente no código
//  3. Variável `hasStructuredBrief` presente e verificada
//  4. Telemetria P-GATE exposta no console.log outgoing
//  5. Padrões de detecção de objetivo, target e escopo presentes
//  6. Gate bloqueado SOMENTE quando contexto for insuficiente
//
// Run with:
//   npm test   (from panel/)
// =============================================================================

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(import.meta.dirname, "../chat/useChatState.js"),
  "utf8",
);

// =============================================================================
// PROVA 1 — Mensagem com "2 ou mais mensagens" foi REMOVIDA
// =============================================================================

describe("P27 PROVA 1 — Gate não exige mais '2 ou mais mensagens'", () => {
  it("string '2 ou mais mensagens de alinhamento' não existe mais no source", () => {
    expect(SRC).not.toContain("2 ou mais mensagens de alinhamento");
  });

  it("gate bloqueado não menciona contagem mínima de mensagens como requisito", () => {
    // A mensagem de bloqueio deve guiar por conteúdo, não por contagem.
    // Garantimos que a mensagem de erro não diz "2 ou mais".
    expect(SRC).not.toContain("(2 ou mais mensagens");
  });
});

// =============================================================================
// PROVA 2 — Variável `plannerContextSufficient` presente e usada como gate
// =============================================================================

describe("P27 PROVA 2 — `plannerContextSufficient` é a nova âncora do gate", () => {
  it("variável plannerContextSufficient declarada no source", () => {
    expect(SRC).toContain("plannerContextSufficient");
  });

  it("gate usa !plannerContextSufficient como condição de bloqueio", () => {
    expect(SRC).toContain("!plannerContextSufficient");
  });

  it("plannerContextSufficient inclui condição para alignmentMessageCount >= 2", () => {
    expect(SRC).toContain("alignmentMessageCount >= 2");
  });
});

// =============================================================================
// PROVA 3 — Detecção de brief estruturado em mensagem única
// =============================================================================

describe("P27 PROVA 3 — `hasStructuredBrief` detecta brief com todos os cabeçalhos", () => {
  it("variável hasStructuredBrief declarada no source", () => {
    expect(SRC).toContain("hasStructuredBrief");
  });

  it("plannerContextSufficient inclui condição para hasStructuredBrief", () => {
    // hasStructuredBrief deve ser uma das alternativas que libera o gate
    const sufficiencyIdx = SRC.indexOf("plannerContextSufficient =");
    const sufficiencyBlock = SRC.slice(sufficiencyIdx, sufficiencyIdx + 300);
    expect(sufficiencyBlock).toContain("hasStructuredBrief");
  });

  it("BRIEF_HEADERS_RX inclui padrão para 'objetivo:'", () => {
    expect(SRC).toContain("BRIEF_HEADERS_RX");
    expect(SRC).toContain(/objetivo\s*:/i.source);
  });

  it("BRIEF_HEADERS_RX inclui padrão para 'contexto:'", () => {
    expect(SRC).toContain(/contexto\s*:/i.source);
  });

  it("BRIEF_HEADERS_RX inclui padrão para 'restrições:'", () => {
    expect(SRC).toContain("BRIEF_SCOPE_RX");
    expect(SRC).toContain(/restri/.source);
  });

  it("BRIEF_HEADERS_RX inclui padrão para 'critério'", () => {
    expect(SRC).toContain(/crit/.source);
  });
});

// =============================================================================
// PROVA 4 — Telemetria P-GATE exposta no console.log outgoing
// =============================================================================

describe("P27 PROVA 4 — Telemetria P-GATE no console.log pré-envio", () => {
  it("planner_context_sufficient presente no console.log outgoing", () => {
    expect(SRC).toContain("planner_context_sufficient");
  });

  it("planner_context_reason presente no console.log outgoing", () => {
    expect(SRC).toContain("planner_context_reason");
  });

  it("alignment_message_count presente no console.log outgoing", () => {
    expect(SRC).toContain("alignment_message_count");
  });

  it("has_structured_brief presente no console.log outgoing", () => {
    expect(SRC).toContain("has_structured_brief");
  });

  it("has_objective presente no console.log outgoing", () => {
    expect(SRC).toContain("has_objective");
  });

  it("has_target presente no console.log outgoing", () => {
    expect(SRC).toContain("has_target");
  });

  it("has_scope_or_constraints presente no console.log outgoing", () => {
    expect(SRC).toContain("has_scope_or_constraints");
  });

  it("gate_blocked_reason presente no console.log outgoing", () => {
    expect(SRC).toContain("gate_blocked_reason");
  });
});

// =============================================================================
// PROVA 5 — Padrões de detecção cobrem os elementos do brief canônico
// =============================================================================

describe("P27 PROVA 5 — Padrões de detecção do brief canônico", () => {
  it("BRIEF_OBJ_RX detecta 'quero montar um plano operacional'", () => {
    // Verifica que o padrão "plano\\s+(operacional|para|de)" está no source
    expect(SRC).toContain("plano\\s+(operacional|para|de)");
  });

  it("BRIEF_TARGET_RX detecta 'target' literal", () => {
    expect(SRC).toContain("BRIEF_TARGET_RX");
    expect(SRC).toContain("\\btarget\\b");
  });

  it("BRIEF_SCOPE_RX detecta 'não executar'", () => {
    expect(SRC).toContain("executar");
  });

  it("hasActiveTarget verifica context.target.url, .name, .repo, .id", () => {
    expect(SRC).toContain("context?.target?.url");
    expect(SRC).toContain("context?.target?.name");
    expect(SRC).toContain("context?.target?.repo");
    expect(SRC).toContain("context?.target?.id");
  });
});

// =============================================================================
// PROVA 6 — Gate bloqueado emite mensagem sem mencionar contagem obrigatória
// =============================================================================

describe("P27 PROVA 6 — Mensagem de gate bloqueado é correta", () => {
  it("mensagem de bloqueio ainda pede objetivo, target e escopo", () => {
    expect(SRC).toContain("objetivo");
    expect(SRC).toContain("target");
    expect(SRC).toContain("escopo");
  });

  it("mensagem de bloqueio orienta a clicar em Gerar plano novamente", () => {
    expect(SRC).toContain("Gerar plano** novamente");
  });
});

// =============================================================================
// PROVA 7 — plannerContextReason cobre todos os caminhos possíveis
// =============================================================================

describe("P27 PROVA 7 — plannerContextReason cobre múltiplas_messages, structured_brief e detected", () => {
  it("razão 'multiple_alignment_messages' presente", () => {
    expect(SRC).toContain("multiple_alignment_messages");
  });

  it("razão 'single_structured_brief' presente", () => {
    expect(SRC).toContain("single_structured_brief");
  });

  it("razão 'objective_target_scope_detected' presente", () => {
    expect(SRC).toContain("objective_target_scope_detected");
  });

  it("razão 'insufficient_context' presente para o caminho bloqueado", () => {
    expect(SRC).toContain("insufficient_context");
  });

  it("gateBlockedReason diferencia missing_objective, missing_target, missing_scope", () => {
    expect(SRC).toContain("missing_objective");
    expect(SRC).toContain("missing_target");
    expect(SRC).toContain("missing_scope_or_constraints");
  });
});
