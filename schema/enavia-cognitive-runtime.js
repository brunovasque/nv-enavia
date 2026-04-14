// ============================================================================
// 🧠 ENAVIA — Cognitive Runtime Context (PR1 — Núcleo Cognitivo Runtime)
//
// Compositor/factory leve que monta o contexto cognitivo runtime da Enavia,
// unindo identidade + capacidades + constituição em um objeto consultável
// e em um bloco de texto pronto para injeção no system prompt.
//
// Escopo: WORKER-ONLY. Pure function. Sem side-effects.
// ============================================================================

import { getEnaviaIdentity } from "./enavia-identity.js";
import { getEnaviaCapabilities } from "./enavia-capabilities.js";
import { getEnaviaConstitution } from "./enavia-constitution.js";

/**
 * Monta o contexto cognitivo completo da Enavia em runtime.
 * @returns {{ identity: object, capabilities: object, constitution: object }}
 */
export function buildCognitiveRuntime() {
  return {
    identity: getEnaviaIdentity(),
    capabilities: getEnaviaCapabilities(),
    constitution: getEnaviaConstitution(),
  };
}

/**
 * Gera o bloco de texto cognitivo para injeção no system prompt.
 * Formato compacto — não expõe detalhes mecânicos ao usuário final,
 * mas dá ao LLM base institucional para se definir e operar.
 *
 * @param {{ ownerName?: string }} [opts]
 * @returns {string}
 */
export function buildCognitivePromptBlock(opts = {}) {
  const { identity, capabilities, constitution } = buildCognitiveRuntime();
  const ownerName = opts.ownerName || "usuário";

  const lines = [];

  // --- Identidade ---
  lines.push(`Você é a ${identity.name}, ${identity.role} da ${identity.owner}.`);
  lines.push(identity.description);
  lines.push(`O nome do operador é ${ownerName}.`);

  // --- Capacidades ---
  lines.push("");
  lines.push("Capacidades reais disponíveis agora:");
  for (const c of capabilities.can) {
    lines.push(`• ${c}`);
  }

  lines.push("");
  lines.push("Limitações atuais (não prometa o que ainda não existe):");
  for (const c of capabilities.cannot_yet) {
    lines.push(`• ${c}`);
  }

  // --- Constituição ---
  lines.push("");
  lines.push(`Regra de ouro: ${constitution.golden_rule}`);
  lines.push("");
  lines.push("Ordem obrigatória para ações relevantes:");
  lines.push(constitution.mandatory_order.join(" → "));
  lines.push("");
  lines.push("Princípios de segurança operacional:");
  for (const r of constitution.operational_security) {
    lines.push(`• ${r}`);
  }

  return lines.join("\n");
}
