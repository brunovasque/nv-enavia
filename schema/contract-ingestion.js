// ============================================================================
// 📜 ENAVIA — Canonical Long Contract Ingestion (PR1)
//
// Responsabilidades:
//   1. Quebrar contrato longo em blocos estruturados (contract_blocks)
//   2. Gerar mapa estrutural macro (contract_structure)
//   3. Extrair elementos canônicos para navegação futura
//   4. Persistir artefatos em KV (ENAVIA_BRAIN)
//
// Honestidade estrutural:
//   - Campos não detectáveis = null (nunca inventados)
//   - Resumo curto só quando trivial e honesto
//   - Tipo do bloco via heurística simples, nunca IA
//
// Anchors para PRs futuras:
//   - PR2: memória/estado contratual ativo (contract_memory)
//   - PR3: motor de aderência contratual (contract_adherence)
//   - PR4: surface/rastreio no painel (contract_panel)
//
// NÃO faz (deliberadamente):
//   - Memória viva contratual
//   - Motor de aderência / gate
//   - Surface / painel
//   - Cognição / IA — apenas parsing determinístico
// ============================================================================

// ---------------------------------------------------------------------------
// KV Key Constants — Canonical prefixes for ingested contract artifacts
// ---------------------------------------------------------------------------
const KV_PREFIX_INGESTION = "contract_ingestion:";
const KV_SUFFIX_BLOCKS    = ":blocks";
const KV_SUFFIX_STRUCTURE = ":structure";
const KV_SUFFIX_INDEX     = ":index";
const KV_INGESTION_REGISTRY = "contract_ingestion:registry";

// ---------------------------------------------------------------------------
// Block type detection heuristics
// ---------------------------------------------------------------------------
const BLOCK_TYPE_PATTERNS = [
  { type: "clause",         pattern: /^\s*(?:cláusula|clause)\s+/i },
  { type: "definition",     pattern: /^\s*(?:defini[çc][ãõ][oe]s?|definitions?)\s*/i },
  { type: "obligation",     pattern: /(?:dever[áa]|must|shall|obriga[çc][ãa]o)/i },
  { type: "penalty",        pattern: /(?:multa|penalidade|penalty|san[çc][ãa]o)/i },
  { type: "termination",    pattern: /(?:rescis[ãa]o|termina[çc][ãa]o|termination)/i },
  { type: "payment",        pattern: /(?:pagamento|payment|remunera[çc][ãa]o|pre[çc]o|price)/i },
  { type: "deadline",       pattern: /(?:prazo|deadline|vig[êe]ncia|dura[çc][ãa]o|term)/i },
  { type: "acceptance",     pattern: /(?:aceite|acceptance|aprova[çc][ãa]o|criteria|crit[ée]rio)/i },
  { type: "confidentiality", pattern: /(?:confidencial|confidentiality|sigilo|nda)/i },
  { type: "liability",      pattern: /(?:responsabilidade|liability|indeniza[çc][ãa]o)/i },
  { type: "general",        pattern: /(?:disposi[çc][ãõo]es?\s+gerais|general\s+provisions)/i },
  { type: "scope",          pattern: /(?:objeto|escopo|scope|purpose)/i },
  { type: "parties",        pattern: /(?:partes|parties|contratante|contratad[oa])/i },
];

// ---------------------------------------------------------------------------
// Heading detection patterns (used to split blocks)
// ---------------------------------------------------------------------------
const HEADING_PATTERNS = [
  // Numbered clauses: "CLÁUSULA 1", "Cláusula Primeira", "1.", "1 -", "1)"
  /^(?:CL[ÁA]USULA|CLAUSE)\s+\w+/i,
  /^\d{1,3}\s*[\.\)\-–—]\s+\S/,
  /^\d{1,3}\s*[\.\)]\d{0,2}[\.\)]?\s+\S/,
  // Roman numerals: "I.", "II -", "III)"
  /^(?:I{1,3}|IV|VI{0,3}|IX|XI{0,3})\s*[\.\)\-–—]\s+\S/i,
  // Markdown-style headings
  /^#{1,4}\s+\S/,
  // ALL CAPS headings (min 3 words)
  /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-ZÁÉÍÓÚÂÊÔÃÕÇ\s]{8,}$/,
  // "Seção", "Capítulo", "Artigo", "Part", "Section", "Article"
  /^(?:SE[ÇC][ÃA]O|CAP[ÍI]TULO|ARTIGO|PART[E]?|SECTION|ARTICLE|CHAPTER)\s+/i,
  // "DO OBJETO", "DA VIGÊNCIA", "DAS OBRIGAÇÕES" (pt-br contract style)
  /^(?:D[OA]S?)\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/,
];

// ---------------------------------------------------------------------------
// Structural signal extraction patterns
// ---------------------------------------------------------------------------
const SIGNAL_PATTERNS = {
  hard_rules:       [
    /(?:é\s+proibido|proibido|vedado|não\s+(?:pode|poderá|deverá))/i,
    /(?:is\s+prohibited|must\s+not|shall\s+not|forbidden)/i,
    /(?:obrigatoriamente|obrigat[óo]ri[oa]|mandatório)/i,
    /(?:mandatory|required|compulsory)/i,
  ],
  acceptance_criteria: [
    /(?:crit[ée]rio[s]?\s+de\s+aceite|acceptance\s+criteria)/i,
    /(?:defini[çc][ãa]o\s+de\s+(?:pronto|done)|definition\s+of\s+done)/i,
    /(?:entrega\s+(?:aceita|aprovada)|deliverable\s+accepted)/i,
  ],
  approval_points: [
    /(?:aprova[çc][ãa]o\s+(?:humana|do\s+(?:cliente|gestor|contratante)))/i,
    /(?:human\s+approval|client\s+approval|sign[\s-]?off)/i,
    /(?:homologa[çc][ãa]o|valida[çc][ãa]o\s+formal)/i,
  ],
  deadlines: [
    /(?:\d+\s*(?:dias?|meses?|horas?|semanas?|days?|months?|hours?|weeks?))/i,
    /(?:prazo\s+(?:de|para|m[áa]ximo)|deadline|due\s+date)/i,
  ],
  blocking_points: [
    /(?:bloqueio|bloqueante|blocking|blocked?\s+until)/i,
    /(?:condi[çc][ãa]o\s+suspensiva|condition\s+precedent)/i,
    /(?:antes\s+de|before|prior\s+to|prerequisite)/i,
  ],
};

// ---------------------------------------------------------------------------
// isHeading(line) — Returns true if the line looks like a section heading
// ---------------------------------------------------------------------------
function isHeading(line) {
  const trimmed = line.trim();
  if (!trimmed) return false;
  return HEADING_PATTERNS.some((rx) => rx.test(trimmed));
}

// ---------------------------------------------------------------------------
// detectBlockType(text) — Heuristic block type based on content
// Returns the first matching type or "general" if none matches.
// ---------------------------------------------------------------------------
function detectBlockType(text) {
  for (const { type, pattern } of BLOCK_TYPE_PATTERNS) {
    if (pattern.test(text)) return type;
  }
  return "general";
}

// ---------------------------------------------------------------------------
// extractHeading(lines) — Extracts heading from the first line(s) of a block
// Returns { heading, headingLine } or { heading: null, headingLine: -1 }
// ---------------------------------------------------------------------------
function extractHeading(lines) {
  if (!lines || lines.length === 0) return { heading: null, headingLine: -1 };
  const first = lines[0].trim();
  if (isHeading(first)) {
    return { heading: first.replace(/^#+\s*/, "").trim(), headingLine: 0 };
  }
  return { heading: null, headingLine: -1 };
}

// ---------------------------------------------------------------------------
// buildShortSummary(text, maxLen) — Honest short summary (first meaningful sentence)
// Returns null if text is too short to summarize meaningfully.
// ---------------------------------------------------------------------------
function buildShortSummary(text, maxLen = 200) {
  if (!text || text.length < 40) return null;
  // Take first sentence or first maxLen chars
  const sentences = text.split(/(?<=[.!?])\s+/);
  const first = sentences[0] || "";
  if (first.length > 10 && first.length <= maxLen) return first.trim();
  if (first.length > maxLen) return first.slice(0, maxLen).trim() + "…";
  return null;
}

// ---------------------------------------------------------------------------
// extractSignals(text) — Extract structural signals from block text
// Returns an object with detected signals (arrays of matches) or empty arrays.
// ---------------------------------------------------------------------------
function extractSignals(text) {
  const signals = {};
  for (const [category, patterns] of Object.entries(SIGNAL_PATTERNS)) {
    const matches = [];
    for (const rx of patterns) {
      const m = text.match(rx);
      if (m) matches.push(m[0]);
    }
    signals[category] = matches.length > 0 ? matches : [];
  }
  return signals;
}

// ---------------------------------------------------------------------------
// splitContractIntoBlocks(contractText)
//
// Splits a contract text into structured blocks using heading detection.
// If no headings are found, splits by paragraph groups (double newline).
// Falls back to a single block for very short contracts.
//
// Returns: Array<{
//   block_id: string,
//   index: number,
//   heading: string | null,
//   block_type: string,
//   content: string,
//   summary: string | null,
//   signals: { hard_rules: [], acceptance_criteria: [], ... }
// }>
// ---------------------------------------------------------------------------
function splitContractIntoBlocks(contractText) {
  if (!contractText || typeof contractText !== "string") {
    return [];
  }

  const text = contractText.trim();
  if (!text) return [];

  const lines = text.split("\n");

  // --- Strategy 1: Split by headings ---
  const headingIndices = [];
  lines.forEach((line, idx) => {
    if (isHeading(line)) headingIndices.push(idx);
  });

  let rawBlocks = [];

  if (headingIndices.length >= 2) {
    // Split at heading boundaries
    for (let i = 0; i < headingIndices.length; i++) {
      const start = headingIndices[i];
      const end = i + 1 < headingIndices.length ? headingIndices[i + 1] : lines.length;
      const blockLines = lines.slice(start, end);
      // Include any preamble before first heading as block 0
      if (i === 0 && start > 0) {
        const preambleLines = lines.slice(0, start);
        const preambleText = preambleLines.join("\n").trim();
        if (preambleText) {
          rawBlocks.push(preambleLines);
        }
      }
      rawBlocks.push(blockLines);
    }
  } else {
    // --- Strategy 2: Split by paragraph groups (double newline) ---
    const paragraphs = text.split(/\n\s*\n/);
    if (paragraphs.length >= 2) {
      rawBlocks = paragraphs.map((p) => p.split("\n"));
    } else {
      // --- Strategy 3: Single block ---
      rawBlocks = [lines];
    }
  }

  // Build structured blocks
  return rawBlocks.map((blockLines, idx) => {
    const content = blockLines.join("\n").trim();
    const { heading } = extractHeading(blockLines);
    const blockType = detectBlockType(content);
    const summary = buildShortSummary(content);
    const signals = extractSignals(content);

    return {
      block_id: `blk_${String(idx + 1).padStart(4, "0")}`,
      index: idx,
      heading: heading || null,
      block_type: blockType,
      content,
      summary: summary || null,
      signals,
    };
  });
}

// ---------------------------------------------------------------------------
// buildContractStructureMap(blocks, metadata)
//
// Generates a macro structural map from ingested blocks.
// Extracts only what is honestly detectable — marks absent fields as null.
//
// Returns: {
//   macro_objective: string | null,
//   sections: Array<{ index, heading, block_type }>,
//   hard_rules: string[],
//   acceptance_criteria: string[],
//   execution_order: Array<{ index, heading }>,
//   approval_points: string[],
//   blocking_points: string[],
//   deadlines: string[],
//   detected_phases: Array<{ index, heading, block_type }> | null,
//   confidence: { ... }
// }
// ---------------------------------------------------------------------------
function buildContractStructureMap(blocks, metadata) {
  if (!blocks || blocks.length === 0) {
    return _emptyStructureMap();
  }

  // Macro objective: try to find a "scope" or "object" block, or use first block
  const scopeBlock = blocks.find((b) => b.block_type === "scope");
  const macroObjective = scopeBlock
    ? (scopeBlock.summary || scopeBlock.heading || null)
    : (metadata && metadata.goal) ? metadata.goal
    : (blocks[0].summary || blocks[0].heading || null);

  // Sections overview
  const sections = blocks.map((b) => ({
    index: b.index,
    heading: b.heading,
    block_type: b.block_type,
  }));

  // Aggregate signals across all blocks
  const allSignals = {
    hard_rules: [],
    acceptance_criteria: [],
    approval_points: [],
    blocking_points: [],
    deadlines: [],
  };

  for (const block of blocks) {
    for (const category of Object.keys(allSignals)) {
      if (block.signals && block.signals[category]) {
        for (const signal of block.signals[category]) {
          allSignals[category].push({
            signal,
            block_id: block.block_id,
            block_index: block.index,
            heading: block.heading,
          });
        }
      }
    }
  }

  // Detected phases: blocks that look like major structural sections
  const phaseTypes = new Set(["scope", "obligation", "payment", "deadline", "acceptance", "termination", "general"]);
  const detectedPhases = blocks
    .filter((b) => b.heading && phaseTypes.has(b.block_type))
    .map((b) => ({ index: b.index, heading: b.heading, block_type: b.block_type }));

  // Execution order: all blocks in their natural order
  const executionOrder = blocks.map((b) => ({
    index: b.index,
    heading: b.heading,
  }));

  // Confidence markers
  const confidence = {
    has_headings: blocks.some((b) => b.heading !== null),
    has_hard_rules: allSignals.hard_rules.length > 0,
    has_acceptance_criteria: allSignals.acceptance_criteria.length > 0,
    has_approval_points: allSignals.approval_points.length > 0,
    has_blocking_points: allSignals.blocking_points.length > 0,
    has_deadlines: allSignals.deadlines.length > 0,
    blocks_count: blocks.length,
    detected_phases_count: detectedPhases.length,
  };

  return {
    macro_objective: macroObjective,
    sections,
    hard_rules: allSignals.hard_rules,
    acceptance_criteria: allSignals.acceptance_criteria,
    execution_order: executionOrder,
    approval_points: allSignals.approval_points,
    blocking_points: allSignals.blocking_points,
    deadlines: allSignals.deadlines,
    detected_phases: detectedPhases.length > 0 ? detectedPhases : null,
    confidence,
  };
}

function _emptyStructureMap() {
  return {
    macro_objective: null,
    sections: [],
    hard_rules: [],
    acceptance_criteria: [],
    execution_order: [],
    approval_points: [],
    blocking_points: [],
    deadlines: [],
    detected_phases: null,
    confidence: {
      has_headings: false,
      has_hard_rules: false,
      has_acceptance_criteria: false,
      has_approval_points: false,
      has_blocking_points: false,
      has_deadlines: false,
      blocks_count: 0,
      detected_phases_count: 0,
    },
  };
}

// ---------------------------------------------------------------------------
// buildContractIndex(contractId, blocks, structureMap, metadata)
//
// Builds the canonical contract_index artifact: a lightweight summary
// pointing to blocks and structure for quick lookups.
//
// Returns: {
//   contract_id: string,
//   ingested_at: string (ISO),
//   blocks_count: number,
//   block_ids: string[],
//   structure_summary: { ... },
//   metadata: { ... },
//   version: "v1"
// }
// ---------------------------------------------------------------------------
function buildContractIndex(contractId, blocks, structureMap, metadata) {
  return {
    contract_id: contractId,
    ingested_at: new Date().toISOString(),
    blocks_count: blocks.length,
    block_ids: blocks.map((b) => b.block_id),
    structure_summary: {
      macro_objective: structureMap.macro_objective,
      sections_count: structureMap.sections.length,
      hard_rules_count: structureMap.hard_rules.length,
      acceptance_criteria_count: structureMap.acceptance_criteria.length,
      approval_points_count: structureMap.approval_points.length,
      blocking_points_count: structureMap.blocking_points.length,
      deadlines_count: structureMap.deadlines.length,
      has_detected_phases: structureMap.detected_phases !== null,
    },
    metadata: metadata || {},
    // Anchor: PR2 will add contract_memory_ref here
    // Anchor: PR3 will add adherence_gate_ref here
    version: "v1",
  };
}

// ---------------------------------------------------------------------------
// persistContractIngestion(env, contractId, blocks, structureMap, index)
//
// Persists the three canonical artifacts to KV:
//   - contract_ingestion:<id>:blocks     → Array<Block>
//   - contract_ingestion:<id>:structure  → StructureMap
//   - contract_ingestion:<id>:index      → ContractIndex
//   - contract_ingestion:registry        → [contractId, ...]
// ---------------------------------------------------------------------------
async function persistContractIngestion(env, contractId, blocks, structureMap, index) {
  const prefix = `${KV_PREFIX_INGESTION}${contractId}`;

  await env.ENAVIA_BRAIN.put(
    `${prefix}${KV_SUFFIX_BLOCKS}`,
    JSON.stringify(blocks)
  );
  await env.ENAVIA_BRAIN.put(
    `${prefix}${KV_SUFFIX_STRUCTURE}`,
    JSON.stringify(structureMap)
  );
  await env.ENAVIA_BRAIN.put(
    `${prefix}${KV_SUFFIX_INDEX}`,
    JSON.stringify(index)
  );

  // Update registry (list of ingested contract IDs)
  let registry = [];
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_INGESTION_REGISTRY);
    if (raw) registry = JSON.parse(raw);
  } catch (_) {
    registry = [];
  }
  if (!registry.includes(contractId)) {
    registry.push(contractId);
    await env.ENAVIA_BRAIN.put(KV_INGESTION_REGISTRY, JSON.stringify(registry));
  }

  return { ok: true, keys_written: 3, registry_updated: true };
}

// ---------------------------------------------------------------------------
// readContractIngestion(env, contractId)
//
// Reads all ingestion artifacts for a contract.
// Returns: { index, blocks, structure } or null if not found.
// ---------------------------------------------------------------------------
async function readContractIngestion(env, contractId) {
  const prefix = `${KV_PREFIX_INGESTION}${contractId}`;

  const [blocksRaw, structureRaw, indexRaw] = await Promise.all([
    env.ENAVIA_BRAIN.get(`${prefix}${KV_SUFFIX_BLOCKS}`),
    env.ENAVIA_BRAIN.get(`${prefix}${KV_SUFFIX_STRUCTURE}`),
    env.ENAVIA_BRAIN.get(`${prefix}${KV_SUFFIX_INDEX}`),
  ]);

  if (!indexRaw) return null;

  return {
    index: JSON.parse(indexRaw),
    blocks: blocksRaw ? JSON.parse(blocksRaw) : [],
    structure: structureRaw ? JSON.parse(structureRaw) : _emptyStructureMap(),
  };
}

// ---------------------------------------------------------------------------
// ingestLongContract(env, contractId, contractText, metadata)
//
// Main orchestrator: splits → maps → indexes → persists.
//
// Parameters:
//   env          — Cloudflare Workers env (must have ENAVIA_BRAIN KV binding)
//   contractId   — Canonical contract ID string
//   contractText — Raw contract text (string)
//   metadata     — Optional { goal, operator, source, ... }
//
// Returns: {
//   ok: boolean,
//   contract_id: string,
//   blocks_count: number,
//   structure_summary: { ... },
//   index: { ... },
//   error?: string
// }
// ---------------------------------------------------------------------------
async function ingestLongContract(env, contractId, contractText, metadata) {
  // Validate inputs
  if (!contractId || typeof contractId !== "string") {
    return { ok: false, error: "INVALID_CONTRACT_ID", message: "contractId must be a non-empty string." };
  }
  if (!contractText || typeof contractText !== "string") {
    return { ok: false, error: "INVALID_CONTRACT_TEXT", message: "contractText must be a non-empty string." };
  }
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "MISSING_KV_BINDING", message: "env.ENAVIA_BRAIN is required." };
  }

  // Step 1: Split contract into blocks
  const blocks = splitContractIntoBlocks(contractText);
  if (blocks.length === 0) {
    return { ok: false, error: "EMPTY_CONTRACT", message: "Contract text produced zero blocks." };
  }

  // Step 2: Build structural map
  const structureMap = buildContractStructureMap(blocks, metadata);

  // Step 3: Build index
  const index = buildContractIndex(contractId, blocks, structureMap, metadata);

  // Step 4: Persist
  const persistResult = await persistContractIngestion(env, contractId, blocks, structureMap, index);

  return {
    ok: persistResult.ok,
    contract_id: contractId,
    blocks_count: blocks.length,
    structure_summary: index.structure_summary,
    index,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------
export {
  // Core splitting / mapping
  splitContractIntoBlocks,
  buildContractStructureMap,
  buildContractIndex,

  // Persistence
  persistContractIngestion,
  readContractIngestion,

  // Orchestrator
  ingestLongContract,

  // Helpers (exported for testing)
  isHeading,
  detectBlockType,
  extractHeading,
  buildShortSummary,
  extractSignals,

  // KV Constants (exported for testing / future PRs)
  KV_PREFIX_INGESTION,
  KV_SUFFIX_BLOCKS,
  KV_SUFFIX_STRUCTURE,
  KV_SUFFIX_INDEX,
  KV_INGESTION_REGISTRY,

  // Patterns (exported for testing)
  BLOCK_TYPE_PATTERNS,
  HEADING_PATTERNS,
  SIGNAL_PATTERNS,
};
