// code-chunker.js — PR108
// Estratégia de extração de chunk relevante para análise de código por LLM.
//
// extractRelevantChunk(code, intentText, maxChars)
//   Extrai seção relevante do código baseado na intenção, retornando janela
//   de contexto ao redor da âncora encontrada.
//   Se não encontrar âncora: retorna primeiros maxChars chars com aviso.
//
// Resolve o problema de truncamento linear de callCodexEngine (16K chars) para
// arquivos grandes (ex: nv-enavia.js ~350KB).

const DEFAULT_MAX_CHARS = 16000;

/**
 * @param {string} code - código completo
 * @param {string} intentText - intenção/objetivo (usado para busca de âncora)
 * @param {number} [maxChars=16000] - tamanho máximo do chunk em chars
 * @returns {{ chunk: string, offset: number, truncated: boolean, anchor_found: boolean, anchor_token?: string, warning?: string }}
 */
export function extractRelevantChunk(code, intentText, maxChars) {
  const limit =
    typeof maxChars === 'number' && maxChars > 0 ? maxChars : DEFAULT_MAX_CHARS;

  if (typeof code !== 'string' || !code) {
    return { chunk: '', offset: 0, truncated: false, anchor_found: false, warning: 'EMPTY_CODE' };
  }

  // Código cabe inteiro → retorna sem truncamento
  if (code.length <= limit) {
    return { chunk: code, offset: 0, truncated: false, anchor_found: false };
  }

  const intent = typeof intentText === 'string' ? intentText.trim() : '';

  if (!intent) {
    return {
      chunk: code.slice(0, limit),
      offset: 0,
      truncated: true,
      anchor_found: false,
      warning: 'NO_INTENT_TEXT_TRUNCATED_FROM_START',
    };
  }

  // Extrai tokens de busca do intentText (rotas, funções, identificadores)
  const tokens = _extractSearchTokens(intent);

  // Busca o primeiro token que aparece no código
  let bestOffset = -1;
  let bestToken = null;

  for (const token of tokens) {
    const idx = code.indexOf(token);
    if (idx !== -1) {
      bestOffset = idx;
      bestToken = token;
      break;
    }
  }

  if (bestOffset === -1) {
    return {
      chunk: code.slice(0, limit),
      offset: 0,
      truncated: true,
      anchor_found: false,
      warning: `ANCHOR_NOT_FOUND_TRUNCATED_FROM_START (tokens tentados: ${tokens.slice(0, 5).join(', ')})`,
    };
  }

  // Janela de contexto centralizada ao redor da âncora
  const halfWindow = Math.floor(limit / 2);
  let start = Math.max(0, bestOffset - halfWindow);
  let end = start + limit;

  if (end > code.length) {
    end = code.length;
    start = Math.max(0, end - limit);
  }

  return {
    chunk: code.slice(start, end),
    offset: start,
    truncated: end < code.length || start > 0,
    anchor_found: true,
    anchor_token: bestToken,
  };
}

/**
 * Extrai tokens de busca relevantes do intentText.
 * Prioridade: rotas HTTP, funções camelCase, identificadores UPPER_CASE, palavras longas.
 *
 * @param {string} intent
 * @returns {string[]}
 */
function _extractSearchTokens(intent) {
  const tokens = [];

  // Rotas HTTP: /propose, /audit, /github-bridge/proxy
  const routeMatches = intent.match(/\/[\w/-]+/g) || [];
  tokens.push(...routeMatches);

  // Funções/variáveis camelCase (mínimo 4 chars): callCodexEngine, applyPatch
  const camelMatches = intent.match(/\b[a-z][a-zA-Z0-9]{3,}\b/g) || [];
  tokens.push(...camelMatches);

  // Identificadores UPPER_CASE: GITHUB_TOKEN, INTERNAL_TOKEN
  const upperMatches = intent.match(/\b[A-Z][A-Z0-9_]{3,}\b/g) || [];
  tokens.push(...upperMatches);

  // Palavras genéricas com 5+ chars para evitar ruído
  const wordMatches = intent.match(/\b\w{5,}\b/g) || [];
  tokens.push(...wordMatches);

  // Deduplicar preservando ordem de prioridade
  const seen = new Set();
  return tokens.filter((t) => {
    if (seen.has(t)) return false;
    seen.add(t);
    return true;
  });
}
