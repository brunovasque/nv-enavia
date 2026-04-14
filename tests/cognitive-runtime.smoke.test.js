// ============================================================================
// 🧪 Smoke Tests — Núcleo Cognitivo Runtime (PR1)
//
// Prova objetiva de que:
//   1. Os módulos de identidade, capacidades e constituição exportam corretamente
//   2. A identidade NÃO invade capacidades de PRs futuras (memória, aprendizado)
//   3. As capacidades são mínimas e honestas para PR1
//   4. O compositor buildCognitiveRuntime monta o contexto completo
//   5. O buildCognitivePromptBlock gera texto válido com identidade canônica
//   6. O prompt block não expõe mecânica interna ao usuário
//
// Escopo: WORKER-ONLY. Pure unit tests. Sem KV, sem API, sem env.
// ============================================================================

import { strict as assert } from "node:assert";

import { getEnaviaIdentity } from "../schema/enavia-identity.js";
import { getEnaviaCapabilities } from "../schema/enavia-capabilities.js";
import { getEnaviaConstitution } from "../schema/enavia-constitution.js";
import {
  buildCognitiveRuntime,
  buildCognitivePromptBlock,
} from "../schema/enavia-cognitive-runtime.js";

async function runTests() {
  console.log(
    "\n=== ENAVIA Cognitive Runtime — Smoke Tests (PR1) ===\n"
  );

  let passed = 0;
  let failed = 0;

  function ok(condition, label) {
    if (condition) {
      console.log(`  ✅ ${label}`);
      passed++;
    } else {
      console.log(`  ❌ ${label}`);
      failed++;
    }
  }

  // --- Group 1: Identity module ---
  console.log("Group 1: enavia-identity.js");

  const identity = getEnaviaIdentity();
  ok(identity.name === "ENAVIA", "identity.name === ENAVIA");
  ok(typeof identity.role === "string" && identity.role.length > 0, "identity.role é string não vazia");
  ok(typeof identity.owner === "string" && identity.owner.length > 0, "identity.owner é string não vazia");
  ok(typeof identity.description === "string" && identity.description.length > 20, "identity.description é descritiva");
  ok(Array.isArray(identity.principles) && identity.principles.length > 0, "identity.principles é array não vazio");
  // PR1 honesty: identity must NOT claim advanced memory capabilities
  ok(!identity.description.includes("aprender continuamente"), "identity NÃO promete 'aprender continuamente' (PR5)");
  ok(!identity.description.includes("memória permanente"), "identity NÃO promete 'memória permanente' (PR5)");
  const principlesText = identity.principles.join(" ").toLowerCase();
  ok(!principlesText.includes("memória"), "principles NÃO mencionam memória avançada");
  ok(!principlesText.includes("aprender preferências"), "principles NÃO prometem 'aprender preferências' (PR5)");

  // --- Group 2: Capabilities module ---
  console.log("\nGroup 2: enavia-capabilities.js");

  const caps = getEnaviaCapabilities();
  ok(Array.isArray(caps.can) && caps.can.length > 0, "capabilities.can é array não vazio");
  ok(Array.isArray(caps.cannot_yet) && caps.cannot_yet.length > 0, "capabilities.cannot_yet é array não vazio");
  // PR1 honest capabilities must be present
  ok(caps.can.some((c) => c.toLowerCase().includes("chat")), "capabilities.can inclui chat");
  ok(caps.can.some((c) => c.toLowerCase().includes("identidade") || c.toLowerCase().includes("institucional")), "capabilities.can menciona base institucional");
  ok(caps.can.some((c) => c.toLowerCase().includes("limites") || c.toLowerCase().includes("guardrails") || c.toLowerCase().includes("aprovação")), "capabilities.can menciona guardrails/aprovação");
  // PR1 honesty: overpromised items must be in cannot_yet, not in can
  const canText = caps.can.join(" ").toLowerCase();
  ok(!canText.includes("pm4") && !canText.includes("pm9"), "capabilities.can NÃO inclui planner PM4→PM9");
  ok(!canText.includes("executor contratual"), "capabilities.can NÃO inclui executor contratual");
  ok(!canText.includes("braço de browser"), "capabilities.can NÃO inclui braço de browser");
  ok(!canText.includes("braço de github"), "capabilities.can NÃO inclui braço de GitHub/PR");
  ok(!canText.includes("kv"), "capabilities.can NÃO inclui consolidação KV como capacidade madura");
  // Overpromised items are in cannot_yet
  const cannotText = caps.cannot_yet.join(" ").toLowerCase();
  ok(cannotText.includes("memória"), "capabilities.cannot_yet menciona memória longa");
  ok(cannotText.includes("executor") || cannotText.includes("contratos"), "capabilities.cannot_yet menciona executor/contratos");

  // --- Group 3: Constitution module ---
  console.log("\nGroup 3: enavia-constitution.js");

  const constitution = getEnaviaConstitution();
  ok(typeof constitution.golden_rule === "string" && constitution.golden_rule.length > 0, "constitution.golden_rule é string não vazia");
  ok(Array.isArray(constitution.mandatory_order) && constitution.mandatory_order.length >= 5, "constitution.mandatory_order tem ao menos 5 passos");
  ok(Array.isArray(constitution.operational_security) && constitution.operational_security.length > 0, "constitution.operational_security é array não vazio");
  ok(Array.isArray(constitution.human_approval_required_when) && constitution.human_approval_required_when.length > 0, "constitution.human_approval_required_when é array não vazio");
  ok(constitution.mandatory_order[0] === "Entender", "mandatory_order começa com 'Entender'");
  // Constitution should NOT list "Consolidar memória" as a mandatory step in PR1
  ok(!constitution.mandatory_order.includes("Consolidar memória"), "mandatory_order NÃO inclui 'Consolidar memória' (PR5)");

  // --- Group 4: Cognitive Runtime compositor ---
  console.log("\nGroup 4: buildCognitiveRuntime()");

  const runtime = buildCognitiveRuntime();
  ok(typeof runtime === "object" && runtime !== null, "runtime é objeto");
  ok(typeof runtime.identity === "object", "runtime.identity existe");
  ok(typeof runtime.capabilities === "object", "runtime.capabilities existe");
  ok(typeof runtime.constitution === "object", "runtime.constitution existe");
  ok(runtime.identity.name === "ENAVIA", "runtime.identity.name === ENAVIA");

  // --- Group 5: Prompt block ---
  console.log("\nGroup 5: buildCognitivePromptBlock()");

  const block = buildCognitivePromptBlock({ ownerName: "Vasques" });
  ok(typeof block === "string" && block.length > 100, "prompt block é string substancial");
  ok(block.includes("ENAVIA"), "prompt block menciona ENAVIA");
  ok(block.includes("Vasques"), "prompt block inclui ownerName");
  ok(block.includes("Regra de ouro"), "prompt block inclui regra de ouro");
  ok(block.includes("Capacidades reais"), "prompt block inclui capacidades");
  ok(block.includes("Limitações atuais"), "prompt block inclui limitações");
  ok(block.includes("Princípios de segurança"), "prompt block inclui princípios");
  ok(!block.includes("JSON"), "prompt block NÃO expõe formato de resposta (mecânica do chat)");
  ok(!block.includes("use_planner"), "prompt block NÃO expõe mecânica do planner");
  // PR1 honesty: prompt block must not overpromise
  ok(!block.includes("aprender continuamente"), "prompt block NÃO promete aprendizado contínuo (PR5)");
  ok(!block.includes("memória permanente"), "prompt block NÃO promete memória permanente (PR5)");

  // --- Group 6: Default ownerName ---
  console.log("\nGroup 6: buildCognitivePromptBlock() sem ownerName");

  const blockDefault = buildCognitivePromptBlock();
  ok(blockDefault.includes("usuário"), "prompt block sem opts usa 'usuário' como fallback");

  // --- Summary ---
  console.log(`\n============================================================`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log(`============================================================`);

  if (failed > 0) process.exit(1);
}

runTests().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
