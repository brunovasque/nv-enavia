// patch-engine.js — PR108
// Motor de aplicação de patch cirúrgico sobre código fonte.
//
// applyPatch(originalCode, patches)
//   Aplica array de patches {anchor, search, replace} sobre o código original.
//   Estratégia: anchor.match localiza a região; search localiza a linha exata; replace substitui.
//   Invariantes de segurança:
//     - candidato vazio → EMPTY_CANDIDATE (bloqueio imediato)
//     - candidato < 50% do original → CANDIDATE_TOO_SMALL (patch destrutivo)
//     - search não encontrado → ANCHOR_NOT_FOUND
//     - múltiplos matches do search → AMBIGUOUS_MATCH (patch não cirúrgico)
//     - patch sem campo search → skipped com NO_SEARCH_TEXT

/**
 * @param {string} originalCode
 * @param {Array<{title?: string, anchor?: {match: string}|null, search: string, replace: string}>} patches
 * @returns {{ ok: boolean, candidate?: string, applied?: string[], skipped?: Array<{title:string,reason:string}>, error?: string, patch_title?: string|null, detail?: string }}
 */
export function applyPatch(originalCode, patches) {
  if (typeof originalCode !== 'string' || !originalCode.trim()) {
    return { ok: false, error: 'EMPTY_ORIGINAL', patch_title: null };
  }
  if (!Array.isArray(patches) || patches.length === 0) {
    return { ok: false, error: 'NO_PATCHES', patch_title: null };
  }

  let candidate = originalCode;
  const applied = [];
  const skipped = [];

  for (const patch of patches) {
    const title = typeof patch.title === 'string' ? patch.title : '(sem título)';
    const search = typeof patch.search === 'string' ? patch.search : '';
    const replace = typeof patch.replace === 'string' ? patch.replace : '';
    const anchorMatch =
      patch.anchor && typeof patch.anchor.match === 'string'
        ? patch.anchor.match
        : null;

    if (!search) {
      skipped.push({ title, reason: 'NO_SEARCH_TEXT' });
      continue;
    }

    // Verificar anchor se especificado
    if (anchorMatch) {
      const anchorIdx = candidate.indexOf(anchorMatch);
      if (anchorIdx === -1) {
        return { ok: false, error: 'ANCHOR_NOT_FOUND', patch_title: title };
      }
    }

    // Verificar que search existe no código atual
    const firstIdx = candidate.indexOf(search);
    if (firstIdx === -1) {
      return { ok: false, error: 'ANCHOR_NOT_FOUND', patch_title: title };
    }

    // Verificar unicidade (sem matches ambíguos)
    const secondIdx = candidate.indexOf(search, firstIdx + 1);
    if (secondIdx !== -1) {
      return { ok: false, error: 'AMBIGUOUS_MATCH', patch_title: title };
    }

    // Aplicar substituição
    candidate =
      candidate.slice(0, firstIdx) +
      replace +
      candidate.slice(firstIdx + search.length);

    applied.push(title);
  }

  // Invariante: candidato não pode ser vazio
  if (!candidate.trim()) {
    return { ok: false, error: 'EMPTY_CANDIDATE', patch_title: null };
  }

  // Invariante: candidato não pode ser < 50% do original (patch destrutivo)
  if (candidate.length < originalCode.length * 0.5) {
    return {
      ok: false,
      error: 'CANDIDATE_TOO_SMALL',
      patch_title: null,
      detail: `Candidato (${candidate.length} chars) é menor que 50% do original (${originalCode.length} chars). Patch abortado.`,
    };
  }

  return { ok: true, candidate, applied, skipped };
}
