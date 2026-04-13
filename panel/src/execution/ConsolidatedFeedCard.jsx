// ============================================================================
// ConsolidatedFeedCard — Nova Frente · PR3 (Feed consolidado + resumo limpo)
//
// Feed hierárquico de mudanças consolidadas: agrupa por arquivo e exibe,
// para cada mudança, o resumo, status, contadores de linhas e timestamp.
//
// Campos esperados (todos opcionais — ausência exibida honestamente):
//   changeHistory — array de grupos por arquivo:
//     [{ file, patchStatus, changes: [{ id, seq, summary, status, addedLines, removedLines, ts }] }]
//
//   patchStatus por grupo: "applied" | "partial" | "pending"
//   status por mudança:    "applied" | "pending" | "skipped"
//
// Regra: nenhum campo é inventado. Ausência = estado honesto.
// Esta PR exibe dados demo/mock — identificados com badge "DEMO".
// Integração com runtime real NÃO está nesta PR.
// ============================================================================

// ── Patch status display metadata ─────────────────────────────────────────────

const PATCH_STATUS_META = {
  applied: { label: "Aplicado",  color: "#10B981", bg: "rgba(16,185,129,0.10)",  border: "rgba(16,185,129,0.25)" },
  partial: { label: "Parcial",   color: "#F59E0B", bg: "rgba(245,158,11,0.10)",  border: "rgba(245,158,11,0.25)" },
  pending: { label: "Pendente",  color: "#64748B", bg: "rgba(100,116,139,0.10)", border: "rgba(100,116,139,0.25)" },
};

// ── Change status display metadata ────────────────────────────────────────────

const CHANGE_STATUS_META = {
  applied: { dot: "#10B981", label: "Aplicado",  color: "#10B981" },
  pending: { dot: "#F59E0B", label: "Pendente",  color: "#F59E0B" },
  skipped: { dot: "#64748B", label: "Ignorado",  color: "#64748B" },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatTs(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function PatchStatusBadge({ value }) {
  const meta = PATCH_STATUS_META[value] ?? PATCH_STATUS_META.pending;
  return (
    <span
      style={{
        fontSize: "9px",
        fontWeight: 700,
        letterSpacing: "0.8px",
        color: meta.color,
        background: meta.bg,
        border: `1px solid ${meta.border}`,
        borderRadius: "4px",
        padding: "2px 7px",
        flexShrink: 0,
      }}
    >
      {meta.label}
    </span>
  );
}

function ChangeStatusDot({ status }) {
  const meta = CHANGE_STATUS_META[status] ?? CHANGE_STATUS_META.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "5px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: meta.dot,
          flexShrink: 0,
        }}
        aria-hidden="true"
      />
      <span style={{ fontSize: "10px", fontWeight: 600, color: meta.color }}>
        {meta.label}
      </span>
    </span>
  );
}

function LineCountBadges({ addedLines, removedLines }) {
  const hasAdd = addedLines != null && addedLines > 0;
  const hasRemove = removedLines != null && removedLines > 0;
  if (!hasAdd && !hasRemove) return null;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
      {hasAdd && (
        <span style={s.addBadge}>+{addedLines}</span>
      )}
      {hasRemove && (
        <span style={s.removeBadge}>−{removedLines}</span>
      )}
    </span>
  );
}

function ChangeRow({ change, isLast }) {
  const absent = !change.summary;
  const ts = formatTs(change.ts);
  return (
    <div
      style={{
        ...s.changeRow,
        ...(isLast ? {} : s.changeRowBorder),
      }}
    >
      {/* Seq indicator */}
      <span style={s.changeSeq} aria-hidden="true">{change.seq ?? "·"}</span>

      {/* Body */}
      <div style={s.changeBody}>
        {/* Summary */}
        {absent ? (
          <span style={s.absent}>sem resumo disponível</span>
        ) : (
          <span style={s.changeSummary}>{change.summary}</span>
        )}

        {/* Footer: status + counts + ts */}
        <div style={s.changeFooter}>
          <ChangeStatusDot status={change.status} />
          <LineCountBadges
            addedLines={change.addedLines}
            removedLines={change.removedLines}
          />
          {ts && <span style={s.changeTs}>{ts}</span>}
          {!ts && change.status === "pending" && (
            <span style={s.absent}>sem timestamp</span>
          )}
        </div>
      </div>
    </div>
  );
}

function FileGroup({ group }) {
  const hasChanges =
    Array.isArray(group.changes) && group.changes.length > 0;
  return (
    <div style={s.fileGroup}>
      {/* File header */}
      <div style={s.fileGroupHeader}>
        <span style={s.fileGroupIcon} aria-hidden="true">⊡</span>
        <span style={s.fileGroupPath}>{group.file ?? "arquivo desconhecido"}</span>
        <PatchStatusBadge value={group.patchStatus} />
      </div>

      {/* Change list */}
      <div style={s.changeList}>
        {!hasChanges ? (
          <div style={{ padding: "8px 0 4px 26px" }}>
            <span style={s.absent}>sem mudanças registradas</span>
          </div>
        ) : (
          group.changes.map((ch, i) => (
            <ChangeRow
              key={ch.id ?? i}
              change={ch}
              isLast={i === group.changes.length - 1}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ── Patch summary footer ──────────────────────────────────────────────────────

function PatchSummaryFooter({ changeHistory }) {
  if (!Array.isArray(changeHistory) || changeHistory.length === 0) return null;

  let totalApplied = 0;
  let totalPending = 0;

  for (const group of changeHistory) {
    if (!Array.isArray(group.changes)) continue;
    for (const ch of group.changes) {
      if (ch.status === "applied") totalApplied += 1;
      else if (ch.status === "pending") totalPending += 1;
    }
  }

  return (
    <div style={s.patchSummary}>
      <span style={s.patchSummaryIcon} aria-hidden="true">≡</span>
      <div style={s.patchSummaryBody}>
        <span style={s.patchSummaryLabel}>Resumo do patch</span>
        <div style={s.patchSummaryStats}>
          <span style={s.appliedStat}>
            <span style={s.statDot} />
            {totalApplied} aplicad{totalApplied === 1 ? "a" : "as"}
          </span>
          <span style={s.pendingStat}>
            <span style={s.statDotPending} />
            {totalPending} pendente{totalPending !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ changeHistory: Array|null|undefined }} props
 *   changeHistory — array de grupos por arquivo:
 *     [{ file, patchStatus, changes: [...] }]
 *   Pode ser null/undefined (estado vazio honesto).
 */
export default function ConsolidatedFeedCard({ changeHistory }) {
  const isEmpty =
    !changeHistory ||
    !Array.isArray(changeHistory) ||
    changeHistory.length === 0;
  const isMinimalReal = !isEmpty && changeHistory[0]?._pr2Source === "exec_event";

  return (
    <div style={s.card}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.feedIcon} aria-hidden="true">☰</span>
          <p style={s.cardTitle}>Feed de mudanças</p>
        </div>
        <span style={isEmpty ? s.emptyBadge : isMinimalReal ? s.minimalBadge : s.demoBadge}>
          {isEmpty ? "SEM DADOS" : isMinimalReal ? "MÍNIMO REAL" : "DEMO"}
        </span>
      </div>

      {/* Content */}
      {isEmpty ? (
        <div style={s.emptyState}>
          <span style={s.emptyIcon} aria-hidden="true">☰</span>
          <p style={s.emptyText}>
            Nenhum histórico de mudanças disponível para o estado atual.
          </p>
          <p style={s.emptyHint}>
            Arquivo, sequência de mudanças, resumo, status e indicação de
            aplicado/pendente aparecerão aqui quando a execução estiver ativa.
          </p>
        </div>
      ) : (
        <>
          {/* File groups */}
          <div style={s.groupList}>
            {changeHistory.map((group, i) => (
              <FileGroup key={group.file ?? i} group={group} />
            ))}
          </div>

          {/* Patch summary footer */}
          <PatchSummaryFooter changeHistory={changeHistory} />
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
  feedIcon: {
    fontSize: "12px",
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
  minimalBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "#10B981",
    background: "rgba(16,185,129,0.10)",
    border: "1px solid rgba(16,185,129,0.30)",
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

  // Group list
  groupList: {
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  },

  // File group
  fileGroup: {
    border: "1px solid var(--border)",
    borderRadius: "6px",
    overflow: "hidden",
  },
  fileGroupHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    background: "var(--bg-base)",
    padding: "7px 12px",
    borderBottom: "1px solid var(--border)",
  },
  fileGroupIcon: {
    fontSize: "12px",
    color: "var(--color-primary)",
    opacity: 0.7,
    flexShrink: 0,
  },
  fileGroupPath: {
    flex: 1,
    minWidth: 0,
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    color: "var(--text-primary)",
    fontWeight: 600,
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },

  // Change list
  changeList: {
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
  },

  // Change row
  changeRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "8px 12px",
  },
  changeRowBorder: {
    borderBottom: "1px solid var(--border)",
  },
  changeSeq: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    opacity: 0.6,
    minWidth: "14px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "2px",
    fontFamily: "var(--font-mono)",
  },
  changeBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  changeSummary: {
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    fontWeight: 500,
  },
  changeFooter: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    flexWrap: "wrap",
  },
  changeTs: {
    fontSize: "10px",
    color: "var(--text-muted)",
    fontFamily: "var(--font-mono)",
    marginLeft: "auto",
  },

  // Line count badges
  addBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "0.5px",
    color: "#10B981",
    background: "rgba(16,185,129,0.10)",
    border: "1px solid rgba(16,185,129,0.25)",
    padding: "1px 5px",
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
    padding: "1px 5px",
    borderRadius: "4px",
    fontFamily: "var(--font-mono)",
  },

  // Absent / honesty text
  absent: {
    fontSize: "11px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },

  // Patch summary footer
  patchSummary: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    paddingTop: "6px",
    borderTop: "1px solid var(--border)",
  },
  patchSummaryIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.7,
    width: "18px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  patchSummaryBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "4px",
  },
  patchSummaryLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  patchSummaryStats: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },
  appliedStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#10B981",
  },
  pendingStat: {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    fontSize: "11px",
    fontWeight: 600,
    color: "#F59E0B",
  },
  statDot: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#10B981",
    flexShrink: 0,
  },
  statDotPending: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "#F59E0B",
    flexShrink: 0,
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
