// ============================================================================
// ENAVIA Panel — useTargetState
//
// Hook para gerenciar o target operacional do Chat.
// Persiste em sessionStorage para durar a sessão do browser.
//
// Default seguro obrigatório:
//   repo=brunovasque/nv-enavia, worker=nv-enavia, branch=main,
//   environment=prod, mode=read_only
//
// Regra de segurança: mode write/patch/deploy é bloqueado na UI.
// O usuário pode alterar todos os campos, mas mode fica travado em read_only
// nesta fase (conforme spec).
// ============================================================================

import { useState, useCallback } from "react";

export const TARGET_STORAGE_KEY = "enavia_operational_target";

/**
 * Returns an ordered array of { label, value } pairs for a target object.
 * Used for both display (chip rendering) and summary formatting.
 * Fields with no value are excluded.
 */
export function targetFields(target) {
  if (!target || typeof target !== "object") return [];
  return [
    { label: "Worker", value: target.worker },
    { label: "Repo",   value: target.repo },
    { label: "Branch", value: target.branch },
    { label: "Env",    value: target.environment },
    { label: "Modo",   value: target.mode },
  ].filter((f) => Boolean(f.value));
}

export const DEFAULT_TARGET = {
  target_id:   "nv-enavia-prod",
  target_type: "cloudflare_worker",
  repo:        "brunovasque/nv-enavia",
  worker:      "nv-enavia",
  branch:      "main",
  environment: "prod",
  mode:        "read_only",
};

// Modes allowed in this phase (write/patch/deploy blocked)
export const ALLOWED_MODES = ["read_only"];

function _readFromStorage() {
  try {
    const raw = sessionStorage.getItem(TARGET_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return null;
    return parsed;
  } catch {
    return null;
  }
}

function _writeToStorage(target) {
  try {
    sessionStorage.setItem(TARGET_STORAGE_KEY, JSON.stringify(target));
  } catch { /* silent */ }
}

export function useTargetState() {
  const [target, setTargetState] = useState(() => {
    const stored = _readFromStorage();
    if (!stored) return { ...DEFAULT_TARGET };
    // Merge stored with defaults to ensure all fields are present
    return { ...DEFAULT_TARGET, ...stored, mode: "read_only" };
  });

  const updateTarget = useCallback((patch) => {
    setTargetState((prev) => {
      const next = { ...prev, ...patch, mode: "read_only" };
      _writeToStorage(next);
      return next;
    });
  }, []);

  const resetTarget = useCallback(() => {
    const fresh = { ...DEFAULT_TARGET };
    _writeToStorage(fresh);
    setTargetState(fresh);
  }, []);

  return { target, updateTarget, resetTarget };
}
