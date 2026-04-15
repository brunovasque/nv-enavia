// ============================================================================
// SupervisorEnforcementBlock — P26-PR3 — Auditoria do Supervisor de Segurança
// Surface do resultado do Supervisor de Segurança no painel (panel-only).
//
// Renderiza apenas quando execution.supervisor_enforcement está presente.
// Degrada com segurança para payloads antigos (sem o campo) — retorna null.
// Não inventa dados: cada campo é renderizado somente se presente no payload.
//
// Campos renderizados (quando presentes no payload):
//   decision, reason_code, reason_text, risk_level, requires_human_approval,
//   scope_valid, autonomy_valid, evidence_sufficient, timestamp, supervisor_version
//
// Estados visuais:
//   allow              → verde discreto
//   block              → vermelho de alerta
//   needs_human_review → cor primária (revisão humana necessária)
// ============================================================================

import { formatTsFull } from "./mockExecution";

// ── Decision metadata ─────────────────────────────────────────────────────────

const DECISION_META = {
  allow: {
    label:  "Supervisor: permitido",
    icon:   "✓",
    color:  "#10B981",
    bg:     "rgba(16,185,129,0.08)",
    border: "rgba(16,185,129,0.25)",
  },
  block: {
    label:  "Supervisor: bloqueado",
    icon:   "⊘",
    color:  "#EF4444",
    bg:     "rgba(239,68,68,0.08)",
    border: "rgba(239,68,68,0.28)",
  },
  needs_human_review: {
    label:  "Supervisor: revisão humana",
    icon:   "⏳",
    color:  "var(--color-primary)",
    bg:     "var(--color-primary-glow)",
    border: "var(--color-primary-border)",
  },
};

const RISK_COLORS = {
  low:    { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.28)" },
  medium: { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)" },
  high:   { color: "#EF4444", bg: "rgba(239,68,68,0.10)",  border: "rgba(239,68,68,0.28)" },
};

// ── Boolean flag chip ─────────────────────────────────────────────────────────

function BoolFlag({ label, value }) {
  const color  = value ? "#10B981" : "#EF4444";
  const bg     = value ? "rgba(16,185,129,0.08)"  : "rgba(239,68,68,0.06)";
  const border = value ? "rgba(16,185,129,0.28)"  : "rgba(239,68,68,0.28)";
  return (
    <span style={{ ...s.chip, color, background: bg, borderColor: border }}>
      {value ? "✓" : "✕"} {label}
    </span>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * @param {{ supervisorEnforcement: object|null|undefined }} props
 */
export default function SupervisorEnforcementBlock({ supervisorEnforcement }) {
  if (!supervisorEnforcement) return null;

  const {
    decision,
    reason_code,
    reason_text,
    risk_level,
    requires_human_approval,
    scope_valid,
    autonomy_valid,
    evidence_sufficient,
    timestamp,
    supervisor_version,
  } = supervisorEnforcement;

  const meta  = DECISION_META[decision] ?? DECISION_META.allow;
  const riskC = risk_level ? (RISK_COLORS[risk_level] ?? null) : null;

  const hasBoolFlags =
    scope_valid          != null ||
    autonomy_valid       != null ||
    evidence_sufficient  != null ||
    requires_human_approval != null;

  return (
    <div
      style={{ ...s.wrap, background: meta.bg, borderColor: meta.border }}
      role="region"
      aria-label="Resultado do Supervisor de Segurança"
    >

      {/* ── Header: decision label + risk + code ─────────────────────────── */}
      <div style={s.header}>
        <div style={s.titleGroup}>
          <span style={{ ...s.decisionIcon, color: meta.color }} aria-hidden="true">
            {meta.icon}
          </span>
          <span style={{ ...s.decisionLabel, color: meta.color }}>
            {meta.label}
          </span>
        </div>

        <div style={s.headerRight}>
          {riskC && (
            <span
              style={{
                ...s.badge,
                color:       riskC.color,
                background:  riskC.bg,
                borderColor: riskC.border,
              }}
            >
              Risco: {risk_level}
            </span>
          )}
          {reason_code && (
            <span style={s.codeTag}>{reason_code}</span>
          )}
        </div>
      </div>

      {/* ── Reason text ──────────────────────────────────────────────────── */}
      {reason_text && (
        <p style={s.reasonText}>{reason_text}</p>
      )}

      {/* ── Boolean flags ────────────────────────────────────────────────── */}
      {hasBoolFlags && (
        <div style={s.flagsRow}>
          {scope_valid != null && (
            <BoolFlag label="Escopo" value={scope_valid} />
          )}
          {autonomy_valid != null && (
            <BoolFlag label="Autonomia" value={autonomy_valid} />
          )}
          {evidence_sufficient != null && (
            <BoolFlag label="Evidência" value={evidence_sufficient} />
          )}
          {requires_human_approval != null && (
            <span
              style={{
                ...s.chip,
                color:       requires_human_approval ? "#F59E0B" : "var(--text-muted)",
                borderColor: requires_human_approval ? "rgba(245,158,11,0.28)" : "var(--border)",
                background:  requires_human_approval ? "rgba(245,158,11,0.08)" : "transparent",
              }}
            >
              {requires_human_approval ? "⏳" : "—"} Aprovação humana
            </span>
          )}
        </div>
      )}

      {/* ── Footer: timestamp + version ──────────────────────────────────── */}
      {(timestamp || supervisor_version) && (
        <div style={s.footer}>
          {timestamp && (
            <span style={s.footerText}>{formatTsFull(timestamp)}</span>
          )}
          {supervisor_version && (
            <span style={s.footerText}>v{supervisor_version}</span>
          )}
        </div>
      )}

    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  wrap: {
    display:       "flex",
    flexDirection: "column",
    gap:           "10px",
    padding:       "14px 18px",
    border:        "1px solid",
    borderRadius:  "var(--radius-lg)",
    flexShrink:    0,
  },

  // Header
  header: {
    display:        "flex",
    alignItems:     "center",
    justifyContent: "space-between",
    gap:            "10px",
    flexWrap:       "wrap",
  },
  titleGroup: {
    display:    "flex",
    alignItems: "center",
    gap:        "8px",
  },
  decisionIcon: {
    fontSize:   "16px",
    fontWeight: 700,
    lineHeight: 1,
    flexShrink: 0,
  },
  decisionLabel: {
    fontSize:      "12px",
    fontWeight:    700,
    letterSpacing: "0.2px",
  },
  headerRight: {
    display:    "flex",
    alignItems: "center",
    gap:        "6px",
    flexWrap:   "wrap",
  },

  // Risk badge
  badge: {
    fontSize:      "9px",
    fontWeight:    700,
    letterSpacing: "0.6px",
    padding:       "2px 7px",
    borderRadius:  "4px",
    border:        "1px solid",
    textTransform: "uppercase",
  },

  // Reason code chip (mono)
  codeTag: {
    fontSize:     "10px",
    color:        "var(--text-muted)",
    fontFamily:   "var(--font-mono)",
    background:   "var(--bg-base)",
    border:       "1px solid var(--border)",
    padding:      "2px 7px",
    borderRadius: "3px",
  },

  // Reason text
  reasonText: {
    fontSize:   "12px",
    color:      "var(--text-primary)",
    lineHeight: 1.55,
    margin:     0,
  },

  // Boolean flags row
  flagsRow: {
    display:    "flex",
    flexWrap:   "wrap",
    gap:        "6px",
    alignItems: "center",
  },
  chip: {
    fontSize:      "10px",
    fontWeight:    600,
    padding:       "2px 8px",
    borderRadius:  "4px",
    border:        "1px solid",
    letterSpacing: "0.2px",
  },

  // Footer
  footer: {
    display:    "flex",
    alignItems: "center",
    gap:        "12px",
  },
  footerText: {
    fontSize:      "10px",
    color:         "var(--text-muted)",
    fontFamily:    "var(--font-mono)",
    letterSpacing: "0.3px",
  },
};
