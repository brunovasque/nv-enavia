// ============================================================================
// IncrementalDiffCard — Nova Frente · PR2 (Diff incremental visual)
//
// Surface de diff incremental: mostra, de forma clara e honesta,
// as linhas adicionadas (+) e removidas (−) da operação em andamento,
// acompanhadas de um resumo curto da mudança.
//
// Campos esperados (todos opcionais — ausência exibida honestamente):
//   incrementalDiff.file          — arquivo modificado
//   incrementalDiff.block         — função/bloco modificado
//   incrementalDiff.lines         — array de { type: 'add'|'remove'|'neutral', content }
//   incrementalDiff.changeSummary — resumo curto da mudança
//
// Regra: nenhum campo é inventado. Ausência = estado honesto.
// Esta PR exibe dados demo/mock — identificados com badge "DEMO".
// Integração com backend real NÃO está nesta PR.
// ============================================================================

// ── Line type display metadata ────────────────────────────────────────────────

const LINE_META = {
  add:     { prefix: "+", color: "#10B981", bg: "rgba(16,185,129,0.08)", border: "rgba(16,185,129,0.20)" },
  remove:  { prefix: "−", color: "#EF4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.20)"  },
  neutral: { prefix: " ", color: "var(--text-muted)", bg: "transparent",  border: "transparent" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function DiffLine({ line }) {
  const meta = LINE_META[line.type] ?? LINE_META.neutral;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "0",
        background: meta.bg,
        borderLeft: `2px solid ${meta.border}`,
        padding: "1px 8px",
        fontFamily: "var(--font-mono)",
        fontSize: "11px",
        lineHeight: 1.6,
        whiteSpace: "pre",
        overflowX: "auto",
      }}
    >
      <span
        style={{
          color: meta.color,
          fontWeight: 700,
          minWidth: "14px",
          flexShrink: 0,
          userSelect: "none",
        }}
        aria-hidden="true"
      >
        {meta.prefix}
      </span>
      <span style={{ color: line.type === "neutral" ? "var(--text-muted)" : meta.color }}>
        {line.content}
      </span>
    </div>
  );
}

function DiffSummaryRow({ value }) {
  const absent = value == null || value === "";
  return (
    <div style={s.summaryRow}>
      <span style={s.summaryIcon} aria-hidden="true">≡</span>
      <div style={s.summaryBody}>
        <span style={s.summaryLabel}>Resumo da mudança</span>
        {absent ? (
          <span style={s.summaryAbsent}>sem dado disponível</span>
        ) : (
          <span style={s.summaryValue}>{value}</span>
        )}
      </div>
    </div>
  );
}

function FileRow({ file, block }) {
  const absentFile = file == null || file === "";
  const absentBlock = block == null || block === "";
  return (
    <div style={s.fileRow}>
      <span style={s.fileIcon} aria-hidden="true">⊡</span>
      <div style={s.fileBody}>
        {absentFile ? (
          <span style={s.summaryAbsent}>arquivo não disponível</span>
        ) : (
          <span style={s.filePath}>{file}</span>
        )}
        {!absentBlock && (
          <span style={s.fileBlock}>{block}</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ incrementalDiff: object|null|undefined }} props
 *   incrementalDiff — shape:
 *     { file, block, lines: [{ type, content }], changeSummary }
 *   Pode ser null/undefined (estado vazio honesto).
 */
export default function IncrementalDiffCard({ incrementalDiff }) {
  const isEmpty = !incrementalDiff || typeof incrementalDiff !== "object";
  const lines = (!isEmpty && Array.isArray(incrementalDiff.lines))
    ? incrementalDiff.lines
    : [];
  const hasLines = lines.length > 0;

  const addCount    = lines.filter((l) => l.type === "add").length;
  const removeCount = lines.filter((l) => l.type === "remove").length;

  return (
    <div style={s.card}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.diffIcon} aria-hidden="true">±</span>
          <p style={s.cardTitle}>Diff em andamento</p>
        </div>
        <div style={s.headerRight}>
          {!isEmpty && hasLines && (
            <div style={s.statsBadges}>
              <span style={s.addBadge}>+{addCount}</span>
              <span style={s.removeBadge}>−{removeCount}</span>
            </div>
          )}
          <span style={isEmpty ? s.emptyBadge : s.demoBadge}>
            {isEmpty ? "SEM DADOS" : "DEMO"}
          </span>
        </div>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div style={s.emptyState}>
          <span style={s.emptyIcon} aria-hidden="true">±</span>
          <p style={s.emptyText}>
            Nenhum diff incremental disponível para o estado atual.
          </p>
          <p style={s.emptyHint}>
            Linhas adicionadas, removidas e o resumo da mudança aparecerão
            aqui quando a execução estiver modificando código.
          </p>
        </div>
      ) : (
        <>
          {/* File anchor */}
          <FileRow
            file={incrementalDiff.file ?? null}
            block={incrementalDiff.block ?? null}
          />

          {/* Diff block */}
          <div style={s.diffBlock}>
            {hasLines ? (
              lines.map((line, i) => (
                <DiffLine key={i} line={line} />
              ))
            ) : (
              <div style={s.noDiffLines}>
                <span style={s.summaryAbsent}>sem linhas de diff disponíveis</span>
              </div>
            )}
          </div>

          {/* Change summary */}
          <DiffSummaryRow value={incrementalDiff.changeSummary ?? null} />
        </>
      )}
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  card: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    padding: "16px 20px",
    display: "flex",
    flexDirection: "column",
    gap: "10px",
    flexShrink: 0,
  },

  // Header
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  diffIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.8,
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  headerRight: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  statsBadges: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  addBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    color: "#10B981",
    background: "rgba(16,185,129,0.10)",
    border: "1px solid rgba(16,185,129,0.25)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  removeBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    color: "#EF4444",
    background: "rgba(239,68,68,0.10)",
    border: "1px solid rgba(239,68,68,0.25)",
    padding: "2px 6px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },
  demoBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#F59E0B",
    background: "rgba(245,158,11,0.10)",
    border: "1px solid rgba(245,158,11,0.30)",
    padding: "2px 7px",
    borderRadius: "4px",
  },
  emptyBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--text-muted)",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    padding: "2px 7px",
    borderRadius: "4px",
  },

  // File row
  fileRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "8px",
    paddingBottom: "8px",
    borderBottom: "1px solid var(--border)",
  },
  fileIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.7,
    width: "18px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  fileBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  filePath: {
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-primary)",
    fontWeight: 600,
  },
  fileBlock: {
    fontSize: "10px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-muted)",
    fontWeight: 500,
  },

  // Diff block
  diffBlock: {
    borderRadius: "6px",
    border: "1px solid var(--border)",
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-base)",
  },
  noDiffLines: {
    padding: "10px 12px",
    textAlign: "center",
  },

  // Summary row
  summaryRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    paddingTop: "6px",
    borderTop: "1px solid var(--border)",
  },
  summaryIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.7,
    width: "18px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  summaryBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  summaryLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  summaryValue: {
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    fontWeight: 500,
  },
  summaryAbsent: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },

  // Empty state
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "16px 8px",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "20px",
    color: "var(--text-muted)",
    opacity: 0.35,
  },
  emptyText: {
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  emptyHint: {
    fontSize: "11px",
    color: "var(--text-muted)",
    opacity: 0.7,
    lineHeight: 1.5,
    maxWidth: "320px",
  },
};
