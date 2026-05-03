/**
 * enavia-deploy-loop.js
 *
 * State machine pura para o loop de deploy da Enavia.
 * Sem chamadas de rede, sem filesystem, sem efeitos colaterais.
 * Usada para prova objetiva dos critérios de gate do deploy.
 *
 * Estados possíveis:
 *   draft        → proposta criada, aguardando aprovação
 *   proposed     → proposta submetida, aguardando aprovação formal
 *   approved     → aprovado para deploy TEST
 *   deployed_test  → deploy TEST realizado
 *   proof_collected → prova/smoke TEST coletada e aprovada
 *   promoted_prod  → deploy PROD realizado com gate
 *   rollback_ready → PROD ativo com rollback documentado e acessível
 *   rolled_back  → rollback executado — PROD voltou a versão anterior
 *   blocked      → fluxo bloqueado por falha de gate/smoke
 */

"use strict";

const VALID_STATES = [
  "draft",
  "proposed",
  "approved",
  "deployed_test",
  "proof_collected",
  "promoted_prod",
  "rollback_ready",
  "rolled_back",
  "blocked",
];

const VALID_ACTIONS = [
  "submit",
  "approve",
  "deploy_test",
  "collect_proof",
  "promote_prod",
  "mark_rollback_ready",
  "rollback",
  "block",
  "unblock",
];

/**
 * Cria estado inicial do loop de deploy.
 * @param {object} input
 * @param {string} [input.id] - identificador da proposta
 * @param {string} [input.author] - autor da proposta
 * @param {string} [input.description] - descrição
 * @returns {object} estado inicial
 */
function createDeployLoopState(input) {
  return {
    id: (input && input.id) || "deploy-" + Date.now(),
    author: (input && input.author) || "unknown",
    description: (input && input.description) || "",
    state: "draft",
    approval: null,
    test_deployed_at: null,
    proof: null,
    prod_deployed_at: null,
    rollback_ref: null,
    blocked_reason: null,
    history: [],
  };
}

/**
 * Retorna true se o estado permite deploy TEST.
 * Exige que o estado seja 'approved'.
 */
function canDeployTest(state) {
  return state && state.state === "approved";
}

/**
 * Retorna true se o estado permite coletar prova/smoke.
 * Exige que o deploy TEST já tenha ocorrido.
 */
function canCollectProof(state) {
  return state && state.state === "deployed_test";
}

/**
 * Retorna true se o estado permite promover para PROD.
 * Exige prova coletada (smoke TEST aprovado).
 */
function canPromoteProd(state) {
  return state && state.state === "proof_collected";
}

/**
 * Retorna true se o estado permite rollback.
 * Disponível em promoted_prod, rollback_ready ou blocked.
 */
function canRollback(state) {
  return (
    state &&
    (state.state === "promoted_prod" ||
      state.state === "rollback_ready" ||
      state.state === "blocked")
  );
}

/**
 * Aplica uma transição ao estado do loop.
 * Retorna novo estado (imutável — não muta o original).
 *
 * Ações válidas:
 *   submit           draft → proposed
 *   approve          proposed → approved
 *   deploy_test      approved → deployed_test
 *   collect_proof    deployed_test → proof_collected
 *   promote_prod     proof_collected → promoted_prod
 *   mark_rollback_ready  promoted_prod → rollback_ready
 *   rollback         promoted_prod|rollback_ready|blocked → rolled_back
 *   block            qualquer → blocked
 *   unblock          blocked → estado anterior (via history)
 *
 * @param {object} state - estado atual
 * @param {string} action - ação a aplicar
 * @param {object} [payload] - dados adicionais da transição
 * @returns {object} novo estado
 */
function transitionDeployLoop(state, action, payload) {
  if (!state || !VALID_STATES.includes(state.state)) {
    throw new Error("transitionDeployLoop: estado inválido — " + (state && state.state));
  }
  if (!VALID_ACTIONS.includes(action)) {
    throw new Error("transitionDeployLoop: ação inválida — " + action);
  }

  const now = (payload && payload.timestamp) || new Date().toISOString();
  const next = Object.assign({}, state, {
    history: state.history.concat({ from: state.state, action, at: now }),
  });

  switch (action) {
    case "submit":
      if (state.state !== "draft") {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "submit só permitido em draft" });
      }
      return Object.assign({}, next, { state: "proposed" });

    case "approve":
      if (state.state !== "proposed") {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "approve só permitido em proposed" });
      }
      return Object.assign({}, next, {
        state: "approved",
        approval: (payload && payload.approver) || "unknown",
      });

    case "deploy_test":
      if (!canDeployTest(state)) {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "deploy_test exige estado approved" });
      }
      return Object.assign({}, next, {
        state: "deployed_test",
        test_deployed_at: now,
      });

    case "collect_proof":
      if (!canCollectProof(state)) {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "collect_proof exige estado deployed_test" });
      }
      return Object.assign({}, next, {
        state: "proof_collected",
        proof: (payload && payload.proof) || { smoke_passed: true, at: now },
      });

    case "promote_prod":
      if (!canPromoteProd(state)) {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "promote_prod exige estado proof_collected" });
      }
      return Object.assign({}, next, {
        state: "promoted_prod",
        prod_deployed_at: now,
      });

    case "mark_rollback_ready":
      if (state.state !== "promoted_prod") {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "mark_rollback_ready exige estado promoted_prod" });
      }
      return Object.assign({}, next, {
        state: "rollback_ready",
        rollback_ref: (payload && payload.rollback_ref) || "previous-deployment",
      });

    case "rollback":
      if (!canRollback(state)) {
        return Object.assign({}, next, { state: "blocked", blocked_reason: "rollback exige promoted_prod, rollback_ready ou blocked" });
      }
      return Object.assign({}, next, {
        state: "rolled_back",
        blocked_reason: null,
      });

    case "block":
      return Object.assign({}, next, {
        state: "blocked",
        blocked_reason: (payload && payload.reason) || "blocked sem motivo especificado",
      });

    case "unblock": {
      if (state.state !== "blocked") {
        return next;
      }
      const lastValid = state.history
        .slice()
        .reverse()
        .find((h) => h.from !== "blocked" && VALID_STATES.includes(h.from));
      const previousState = (lastValid && lastValid.from) || "draft";
      return Object.assign({}, next, {
        state: previousState,
        blocked_reason: null,
      });
    }

    default:
      throw new Error("transitionDeployLoop: ação não tratada — " + action);
  }
}

module.exports = {
  createDeployLoopState,
  canDeployTest,
  canCollectProof,
  canPromoteProd,
  canRollback,
  transitionDeployLoop,
  VALID_STATES,
  VALID_ACTIONS,
};
