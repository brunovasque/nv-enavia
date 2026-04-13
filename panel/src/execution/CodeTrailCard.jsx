// ============================================================================
// CodeTrailCard — F5-PR3 (Frente 5 — Observabilidade Operacional)
//
// Bloco "Código ao vivo": trilha de código da execução corrente.
// Campos esperados (todos opcionais — ausência exibida honestamente):
//   codeTrail.file          — arquivo sendo executado
//   codeTrail.block         — função ou bloco atual
//   codeTrail.operationType — tipo da operação (READ|WRITE|CALL|VALIDATE|MEMORY)
//   codeTrail.diffSummary   — diff resumido (linhas +/-)
//   codeTrail.justification — justificativa da mudança
//   codeTrail.outOfScope    — o que está fora do escopo desta execução
//
// Regra: nenhum campo é inventado. Ausência = "sem dado disponível".
// Esta PR exibe dados demo/mock — identificados com badge "DEMO".
// Replay completo e integração profunda com backend NÃO estão nesta PR.
// ============================================================================

// ── Operation type display metadata ──────────────────────────────────────────

const OP_TYPE_META = {
  READ:     { label: "READ",     color: "#00B4D8", bg: "rgba(0,180,216,0.10)",   border: "rgba(0,180,216,0.25)" },
  WRITE:    { label: "WRITE",    color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.25)" },
  CALL:     { label: "CALL",     color: "#8B5CF6", bg: "rgba(139,92,246,0.10)", border: "rgba(139,92,246,0.25)" },
  VALIDATE: { label: "VALIDATE", color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.25)" },
  MEMORY:   { label: "MEMORY",   color: "#64748B", bg: "rgba(100,116,139,0.10)",border: "rgba(100,116,139,0.25)" },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ icon, label, value, isLast, mono }) {
  const absent = value == null || value === "";
  return (
    <div
      style={{
        ...s.fieldRow,
        ...(isLast ? {} : s.fieldRowBorder),
      }}
    >
      <span style={s.fieldIcon} aria-hidden="true">{icon}</span>
      <div style={s.fieldBody}>
        <span style={s.fieldLabel}>{label}</span>
        {absent ? (
          <span style={s.fieldAbsent}>sem dado disponível</span>
        ) : (
          <span style={mono ? s.fieldValueMono : s.fieldValue}>{value}</span>
        )}
      </div>
    </div>
  );
}

function OpTypeBadge({ value }) {
  const absent = value == null || value === "";
  if (absent) {
    return (
      <div style={s.fieldRow}>
        <span style={s.fieldIcon} aria-hidden="true">⚙</span>
        <div style={s.fieldBody}>
          <span style={s.fieldLabel}>Tipo da operação</span>
          <span style={s.fieldAbsent}>sem dado disponível</span>
        </div>
      </div>
    );
  }
  const meta = OP_TYPE_META[value] ?? {
    label: value,
    color: "var(--text-muted)",
    bg: "rgba(100,116,139,0.10)",
    border: "rgba(100,116,139,0.25)",
  };
  return (
    <div style={{ ...s.fieldRow, ...s.fieldRowBorder }}>
      <span style={s.fieldIcon} aria-hidden="true">⚙</span>
      <div style={s.fieldBody}>
        <span style={s.fieldLabel}>Tipo da operação</span>
        <span
          style={{
            display: "inline-block",
            fontSize: "10px",
            fontWeight: 700,
            letterSpacing: "0.9px",
            color: meta.color,
            background: meta.bg,
            border: `1px solid ${meta.border}`,
            borderRadius: "4px",
            padding: "2px 8px",
            marginTop: "3px",
            fontFamily: "var(--font-mono)",
          }}
        >
          {meta.label}
        </span>
      </div>
    </div>
  );
}

function DiffBlock({ value }) {
  const absent = value == null || value === "";
  return (
    <div style={{ ...s.fieldRow, ...s.fieldRowBorder }}>
      <span style={s.fieldIcon} aria-hidden="true">±</span>
      <div style={s.fieldBody}>
        <span style={s.fieldLabel}>Diff resumido</span>
        {absent ? (
          <span style={s.fieldAbsent}>sem dado disponível</span>
        ) : (
          <pre style={s.diffBlock}>
            {value.split("\n").map((line, i) => {
              const isAdd = line.startsWith("+");
              const isRem = line.startsWith("-");
              return (
                <span
                  key={i}
                  style={{
                    display: "block",
                    color: isAdd ? "#10B981" : isRem ? "#EF4444" : "var(--text-secondary)",
                    fontWeight: isAdd || isRem ? 600 : 400,
                  }}
                >
                  {line}
                </span>
              );
            })}
          </pre>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ codeTrail: object|null|undefined }} props
 *   codeTrail — shape: { file, block, operationType, diffSummary, justification, outOfScope }
 *               pode ser null/undefined (estado vazio honesto).
 */
export default function CodeTrailCard({ codeTrail }) {
  const isEmpty = !codeTrail || typeof codeTrail !== "object";

  return (
    <div style={s.card}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.codeIcon} aria-hidden="true">⊞</span>
          <p style={s.cardTitle}>Código ao vivo</p>
        </div>
        <span style={isEmpty ? s.emptyBadge : s.demoBadge}>
          {isEmpty ? "SEM DADOS" : "DEMO"}
        </span>
      </div>

      {/* Fields */}
      <div style={s.fieldList}>
        {isEmpty ? (
          <div style={s.emptyState}>
            <span style={s.emptyIcon} aria-hidden="true">⊞</span>
            <p style={s.emptyText}>
              Nenhuma trilha de código disponível para o estado atual.
            </p>
            <p style={s.emptyHint}>
              Arquivo, função, tipo de operação e diff aparecerão aqui quando
              a execução estiver ativa e reportando estado de código.
            </p>
          </div>
        ) : (
          <>
            <FieldRow
              icon="⊡"
              label="Arquivo atual"
              value={codeTrail.file ?? null}
              mono
            />
            <FieldRow
              icon="⌥"
              label="Função / bloco"
              value={codeTrail.block ?? null}
              mono
            />
            <OpTypeBadge value={codeTrail.operationType ?? null} />
            <DiffBlock value={codeTrail.diffSummary ?? null} />
            <FieldRow
              icon="◆"
              label="Justificativa"
              value={codeTrail.justification ?? null}
            />
            <FieldRow
              icon="⊠"
              label="Fora do escopo"
              value={codeTrail.outOfScope ?? null}
              isLast
            />
          </>
        )}
      </div>
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
    gap: "12px",
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
  codeIcon: {
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

  // Field list
  fieldList: {
    display: "flex",
    flexDirection: "column",
  },
  fieldRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "9px 0",
  },
  fieldRowBorder: {
    borderBottom: "1px solid var(--border)",
  },
  fieldIcon: {
    fontSize: "13px",
    color: "var(--color-primary)",
    opacity: 0.7,
    width: "18px",
    textAlign: "center",
    flexShrink: 0,
    marginTop: "1px",
  },
  fieldBody: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "2px",
  },
  fieldLabel: {
    fontSize: "9px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "0.9px",
    textTransform: "uppercase",
  },
  fieldValue: {
    fontSize: "13px",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    fontWeight: 500,
  },
  fieldValueMono: {
    fontSize: "12px",
    color: "var(--text-primary)",
    lineHeight: 1.45,
    fontWeight: 500,
    fontFamily: "var(--font-mono)",
  },
  fieldAbsent: {
    fontSize: "12px",
    color: "var(--text-muted)",
    fontStyle: "italic",
  },

  // Diff block
  diffBlock: {
    margin: "4px 0 0",
    padding: "8px 10px",
    background: "var(--bg-base)",
    border: "1px solid var(--border)",
    borderRadius: "6px",
    fontSize: "11px",
    fontFamily: "var(--font-mono)",
    lineHeight: 1.6,
    overflowX: "auto",
    whiteSpace: "pre",
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
