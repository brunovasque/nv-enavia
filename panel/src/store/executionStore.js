// ============================================================================
// ENAVIA Panel — executionStore (P9)
//
// Singleton module-level store. Fonte única de verdade do estado da execução.
//
// Interface pública mínima — quem pode chamar cada função:
//
//   useExecutionStore()        → ExecutionPage.jsx apenas (hook de leitura)
//   setExecutionState(status)  → ExecutionPage.jsx apenas, via onStateChange prop
//   resetExecutionState()      → ExecutionPage.jsx apenas, se necessário
//
// Regras de visibilidade:
//   - Componentes visuais (ExecutionHeader, cards) não importam este módulo.
//   - ExecutionPage é o único ponto de acoplamento entre o store e a árvore visual.
//   - ExecutionHeader recebe onStateChange via prop (nunca importa o store).
//
// Persistência — chave: "enavia_execution_state"
//   Shape persistido: { currentState }
//   Campos NÃO persistidos: execution (carregado via fetchExecution a cada render).
//
// Comportamento para storage inválido:
//   - JSON inválido → chave removida, fallback IDLE.
//   - currentState fora do enum → chave removida, fallback IDLE.
//   - estrutura parcial/incompleta → chave removida, fallback IDLE.
//   - sessionStorage inacessível → capturado por try/catch, fallback IDLE.
//   Nunca crash. Nunca hidratação ambígua.
//
// Estratégia de hidratação/escrita:
//   Leitura: UMA VEZ, na inicialização do módulo (antes do primeiro render).
//   Escrita: a cada setExecutionState() — síncrona, antes de _rebuild() e _notify().
//   resetExecutionState() remove a chave (ausência = padrão IDLE; não grava IDLE).
//   O sessionStorage é referenciado SOMENTE dentro deste arquivo.
// ============================================================================

import { useSyncExternalStore } from "react";
import { EXECUTION_STATUS } from "../api";

// ── Storage key — never hardcoded outside this file ──────────────────────────
export const EXECUTION_STORAGE_KEY = "enavia_execution_state";

// ── Valid status set — used to guard setExecutionState and hydration ──────────
const _VALID_STATUSES = new Set(Object.values(EXECUTION_STATUS));

// ── Storage helpers ──────────────────────────────────────────────────────────

function _readFromStorage() {
  try {
    const raw = sessionStorage.getItem(EXECUTION_STORAGE_KEY);
    if (raw === null) return null; // key absent — use default
    const parsed = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !_VALID_STATUSES.has(parsed.currentState)
    ) {
      // Invalid structure or out-of-enum currentState — clean up and use default.
      sessionStorage.removeItem(EXECUTION_STORAGE_KEY);
      return null;
    }
    return { currentState: parsed.currentState };
  } catch {
    // JSON.parse error or sessionStorage unavailable — clean up if possible.
    try { sessionStorage.removeItem(EXECUTION_STORAGE_KEY); } catch { /* ignore */ }
    return null;
  }
}

function _writeToStorage(currentState) {
  try {
    sessionStorage.setItem(
      EXECUTION_STORAGE_KEY,
      JSON.stringify({ currentState }),
    );
  } catch { /* sessionStorage unavailable — silent, state is still in-memory */ }
}

// ── Singleton state — hydrated once at module init ───────────────────────────

const _hydrated = _readFromStorage();

let _currentState = _hydrated ? _hydrated.currentState : EXECUTION_STATUS.IDLE;

// ── Snapshot cache ───────────────────────────────────────────────────────────
// useSyncExternalStore exige referência estável quando o estado não mudou.

let _snapshot = { currentState: _currentState };

function _rebuild() {
  _snapshot = { currentState: _currentState };
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
 * Hook React para consumir o estado do executionStore.
 * Usado exclusivamente por ExecutionPage.jsx.
 *
 * Retorna: { currentState }
 */
export function useExecutionStore() {
  return useSyncExternalStore(_subscribe, _getSnapshot);
}

/**
 * Setter controlado do estado de execução.
 * Chamado exclusivamente por ExecutionPage.jsx (via prop onStateChange em ExecutionHeader).
 *
 * Valida o valor contra EXECUTION_STATUS antes de persistir.
 * Valores inválidos são ignorados silenciosamente.
 *
 * @param {string} status — um dos valores de EXECUTION_STATUS
 */
export function setExecutionState(status) {
  if (!_VALID_STATUSES.has(status)) return;
  _currentState = status;
  _writeToStorage(_currentState);
  _rebuild();
  _notify();
}

/**
 * Reseta o estado para IDLE e remove a chave do sessionStorage.
 * Ausência da chave equivale ao padrão (IDLE) — não grava IDLE explicitamente.
 * Chamado exclusivamente por ExecutionPage.jsx se necessário.
 */
export function resetExecutionState() {
  _currentState = EXECUTION_STATUS.IDLE;
  try { sessionStorage.removeItem(EXECUTION_STORAGE_KEY); } catch { /* ignore */ }
  _rebuild();
  _notify();
}
