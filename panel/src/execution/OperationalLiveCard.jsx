// ============================================================================
// OperationalLiveCard — F5-PR1 (Frente 5 — Observabilidade Operacional)
//
// Bloco "Operação ao vivo": exibe os campos operacionais da execução corrente.
// Campos esperados (todos opcionais — ausência é exibida honestamente):
//   operation.action     — ação que o agente está executando agora
//   operation.contract   — contrato canônico em uso
//   operation.microStep  — microetapa dentro da etapa corrente
//   operation.reason     — motivo/raciocínio por trás da ação
//   operation.nextStep   — próximo passo planejado
//
// Regra: nenhum campo é inventado. Ausência = "sem dado disponível".
// Integração profunda com Browser Executor/noVNC NÃO está nesta PR.
// ============================================================================

// ── Field descriptor ─────────────────────────────────────────────────────────

const FIELDS = [
  { key: "action",    label: "Ação atual",     icon: "▷" },
  { key: "contract",  label: "Contrato",        icon: "⇒" },
  { key: "microStep", label: "Microetapa",      icon: "◎" },
  { key: "reason",    label: "Motivo",          icon: "◆" },
  { key: "nextStep",  label: "Próximo passo",   icon: "⏭" },
];

// ── Sub-components ────────────────────────────────────────────────────────────

function FieldRow({ icon, label, value, isLast }) {
  const absent = value == null || value === "";
  return (
    <div
      style={{
        ...s.fieldRow,
        ...(isLast ? {} : s.fieldRowBorder),
      }}
    >
      {/* Icon */}
      <span style={s.fieldIcon} aria-hidden="true">{icon}</span>

      {/* Label + value */}
      <div style={s.fieldBody}>
        <span style={s.fieldLabel}>{label}</span>
        {absent ? (
          <span style={s.fieldAbsent}>sem dado disponível</span>
        ) : (
          <span style={s.fieldValue}>{value}</span>
        )}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ operation: object|null|undefined }} props
 *   operation — shape: { action, contract, microStep, reason, nextStep }
 *               pode ser null/undefined (estado vazio honesto).
 */
export default function OperationalLiveCard({ operation }) {
  const isEmpty = !operation || typeof operation !== "object";

  return (
    <div style={s.card}>
      {/* Card header */}
      <div style={s.cardHeader}>
        <div style={s.titleGroup}>
          <span style={s.liveIndicator} aria-hidden="true" />
          <p style={s.cardTitle}>Operação ao vivo</p>
        </div>
        {isEmpty && (
          <span style={s.emptyBadge}>SEM DADOS</span>
        )}
        {!isEmpty && (
          <span style={s.liveBadge}>AO VIVO</span>
        )}
      </div>

      {/* Fields */}
      <div style={s.fieldList}>
        {isEmpty ? (
          <div style={s.emptyState}>
            <span style={s.emptyIcon} aria-hidden="true">◎</span>
            <p style={s.emptyText}>
              Nenhum dado operacional disponível para o estado atual.
            </p>
            <p style={s.emptyHint}>
              Campos aparecerão aqui quando a execução estiver ativa e o agente
              estiver reportando estado operacional.
            </p>
          </div>
        ) : (
          FIELDS.map(({ key, label, icon }, idx) => (
            <FieldRow
              key={key}
              icon={icon}
              label={label}
              value={operation[key] ?? null}
              isLast={idx === FIELDS.length - 1}
            />
          ))
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
  liveIndicator: {
    display: "inline-block",
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--color-primary)",
    flexShrink: 0,
  },
  cardTitle: {
    fontSize: "10px",
    fontWeight: 700,
    color: "var(--text-muted)",
    letterSpacing: "1.2px",
    textTransform: "uppercase",
  },
  liveBadge: {
    fontSize: "9px",
    fontWeight: 700,
    letterSpacing: "1px",
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    border: "1px solid var(--color-primary-border)",
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
  fieldAbsent: {
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
