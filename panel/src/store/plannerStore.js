// ============================================================================
// ENAVIA Panel — plannerStore (P8)
//
// Singleton module-level store. Fonte única de verdade do estado do planner.
//
// Interface pública mínima — quem pode chamar cada função:
//
//   onChatSuccess(text)      → useChatState.js apenas, após chatSend OK
//   setDemoOverride(status)  → PlanHeader.jsx apenas (via prop de PlanPage)
//   clearDemoOverride()      → PlanHeader.jsx apenas (via prop de PlanPage)
//   usePlannerStore()        → PlanPage.jsx apenas
//
// Regras de visibilidade:
//   - Componentes visuais (PlanHeader, PlanSteps, cards) não importam este módulo.
//   - PlanPage é o único ponto de acoplamento entre o store e a árvore visual.
//   - Páginas recebem dados via usePlannerStore(); ações chegam via import direto.
//
// Regra de precedência:
//   visibleState = demoOverride ?? realState
//   Estado real é soberano. Override é camada visual temporária, reversível.
//
// Comportamento no reload:
//   Store é in-memory. Ao recarregar a página, realState volta para EMPTY.
//   Comportamento aceito da P8 — persistência é escopo de fase futura.
// ============================================================================

import { useSyncExternalStore } from "react";
import { PLAN_STATUS } from "../api";

// ── Singleton state ──────────────────────────────────────────────────────────

let _realState    = PLAN_STATUS.EMPTY;
let _demoOverride = null;
let _lastChatText = null;

// ── Snapshot cache ───────────────────────────────────────────────────────────
// useSyncExternalStore exige referência estável quando o estado não mudou.

let _snapshot = {
  realState:    _realState,
  demoOverride: _demoOverride,
  visibleState: _demoOverride ?? _realState,
  lastChatText: _lastChatText,
};

function _rebuild() {
  _snapshot = {
    realState:    _realState,
    demoOverride: _demoOverride,
    visibleState: _demoOverride ?? _realState,
    lastChatText: _lastChatText,
  };
}

function _getSnapshot() {
  return _snapshot;
}

// ── Listeners ────────────────────────────────────────────────────────────────

const _listeners = new Set();

function _notify() {
  _listeners.forEach((l) => l());
}

function _subscribe(listener) {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Notifica o store que o chat enviou uma mensagem com sucesso.
 * Chamado exclusivamente por useChatState.js após chatSend retornar ok: true.
 *
 * Transição de estado real:
 *   - Qualquer estado → READY (inclusive BLOCKED e COMPLETE).
 *   - Não é chamado em falha de chatSend; o estado real não muda nesses casos.
 *   - Se houver demoOverride ativo, o estado real é atualizado por baixo.
 *     O visibleState continua sendo o override até clearDemoOverride() ser chamado.
 *
 * @param {string} text — texto enviado pelo usuário (fallback visual, não payload homologado)
 */
export function onChatSuccess(text) {
  _realState    = PLAN_STATUS.READY;
  _lastChatText = typeof text === "string" ? text.trim() || null : null;
  _rebuild();
  _notify();
}

/**
 * Ativa o override de estado para fins de pré-visualização de UX (demo).
 * Chamado exclusivamente por PlanHeader.jsx via prop repassada por PlanPage.
 *
 * O override é uma camada visual superficial. Não altera o estado real.
 * É reversível via clearDemoOverride(). Não persiste no reload.
 *
 * @param {string} status — um dos valores de PLAN_STATUS
 */
export function setDemoOverride(status) {
  _demoOverride = status;
  _rebuild();
  _notify();
}

/**
 * Remove o override de demo, expondo o estado real novamente.
 * Chamado exclusivamente por PlanHeader.jsx via prop repassada por PlanPage.
 * Chamar quando demoOverride já é null é um no-op seguro.
 */
export function clearDemoOverride() {
  if (_demoOverride === null) return;
  _demoOverride = null;
  _rebuild();
  _notify();
}

/**
 * Hook React para consumir o estado do plannerStore.
 * Usado exclusivamente por PlanPage.jsx.
 *
 * Retorna:
 *   { visibleState, realState, demoOverride, lastChatText }
 *
 * visibleState = demoOverride ?? realState  (soberano para a UI)
 * lastChatText = fallback visual temporário de apresentação.
 *   - NÃO é planner payload homologado.
 *   - NÃO representa resultado real do planner.
 *   - Serve apenas para o usuário reconhecer a origem da instrução
 *     enquanto não há plano real com request.text próprio.
 */
export function usePlannerStore() {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}
