// ============================================================================
// ENAVIA Panel — plannerStore (P9)
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
// Persistência — chave: "enavia_planner_state"
//   Shape persistido: { realState, lastChatText }
//   Campos NÃO persistidos: demoOverride (visual temporário), visibleState (derivado).
//   demoOverride não reidrata. No reload, visibleState == realState reidratado.
//
// Comportamento para storage inválido:
//   - JSON inválido  → chave removida, fallback EMPTY.
//   - realState fora do enum → chave removida, fallback EMPTY.
//   - estrutura parcial/incompleta → chave removida, fallback EMPTY.
//   - lastChatText não-string → descartado silenciosamente (null), chave mantida.
//   - sessionStorage inacessível → capturado por try/catch, fallback EMPTY.
//   Nunca crash. Nunca hidratação ambígua.
//
// Estratégia de hidratação/escrita:
//   Leitura: UMA VEZ, na inicialização do módulo (antes do primeiro render).
//   Escrita: a cada onChatSuccess() — síncrona, antes de _rebuild() e _notify().
//   setDemoOverride/clearDemoOverride não escrevem em storage (in-memory apenas).
//   O sessionStorage é referenciado SOMENTE dentro deste arquivo.
// ============================================================================

import { useSyncExternalStore } from "react";
import { PLAN_STATUS } from "../api";

// ── Storage key — never hardcoded outside this file ──────────────────────────
export const PLANNER_STORAGE_KEY = "enavia_planner_state";

// ── Valid status set — used to guard setDemoOverride and hydration ────────────
const _VALID_STATUSES = new Set(Object.values(PLAN_STATUS));

// ── Storage helpers ──────────────────────────────────────────────────────────

function _readFromStorage() {
  try {
    const raw = sessionStorage.getItem(PLANNER_STORAGE_KEY);
    if (raw === null) return null; // key absent — use defaults
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !_VALID_STATUSES.has(parsed.realState)
    ) {
      // Invalid structure or out-of-enum realState — clean up and use defaults.
      sessionStorage.removeItem(PLANNER_STORAGE_KEY);
      return null;
    }
    return {
      realState:    parsed.realState,
      // lastChatText: discard if not a non-empty string; keep key intact.
      lastChatText: typeof parsed.lastChatText === "string" && parsed.lastChatText.length > 0
        ? parsed.lastChatText
        : null,
    };
  } catch {
    // JSON.parse error or sessionStorage unavailable — clean up if possible.
    try { sessionStorage.removeItem(PLANNER_STORAGE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function _writeToStorage(realState, lastChatText) {
  try {
    sessionStorage.setItem(
      PLANNER_STORAGE_KEY,
      JSON.stringify({ realState, lastChatText }),
    );
  } catch { /* sessionStorage unavailable — silent, state is still in-memory */ }
}

// ── Singleton state — hydrated once at module init ───────────────────────────

const _hydrated = _readFromStorage();

let _realState    = _hydrated ? _hydrated.realState    : PLAN_STATUS.EMPTY;
let _demoOverride = null; // never persisted — always starts as null
let _lastChatText = _hydrated ? _hydrated.lastChatText : null;

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
  // Transition: any realState → READY after a successful chat round-trip.
  // This is intentional even from COMPLETE: a new instruction starts a new cycle.
  _realState = PLAN_STATUS.READY;

  // Sanitize: keep only non-empty trimmed strings to avoid polluting the visual
  // fallback with whitespace-only or non-string values.
  const trimmed = typeof text === "string" ? text.trim() : "";
  _lastChatText = trimmed.length > 0 ? trimmed : null;

  // Persist real state. demoOverride is intentionally excluded — it is a
  // transient visual layer and must never survive a reload.
  _writeToStorage(_realState, _lastChatText);

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
  // Guard: silently ignore any value that is not a known PLAN_STATUS.
  // Prevents accidental string typos or external calls from corrupting visibleState.
  if (!_VALID_STATUSES.has(status)) return;
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
