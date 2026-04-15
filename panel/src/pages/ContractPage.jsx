// ============================================================================
// ENAVIA Panel — ContractPage (PR4)
//
// Surface de contrato ativo e rastreio de aderência no painel.
// Panel-only. Consome dados da API (mock ou real).
//
// Estados visuais:
//   - loading
//   - vazio / sem contrato ativo
//   - contrato ativo com ALLOW
//   - contrato ativo com WARN
//   - contrato ativo com BLOCK
//   - contrato ativo sem decisão recente
//   - erro de carregamento
// ============================================================================

import { useState, useEffect } from "react";
import { fetchContractSurface, CONTRACT_SURFACE_STATUS } from "../api";
import ActiveContractCard from "../contract/ActiveContractCard";
import AdherenceGateCard from "../contract/AdherenceGateCard";
import EvidenceTrailCard from "../contract/EvidenceTrailCard";
import RelevantBlocksCard from "../contract/RelevantBlocksCard";

// ---------------------------------------------------------------------------
// State selector — cycles through mock states for demonstration
// ---------------------------------------------------------------------------
const STATES = [
  { key: CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW,  label: "Ativo + ALLOW" },
  { key: CONTRACT_SURFACE_STATUS.ACTIVE_WARN,   label: "Ativo + WARN"  },
  { key: CONTRACT_SURFACE_STATUS.ACTIVE_BLOCK,  label: "Ativo + BLOCK" },
  { key: CONTRACT_SURFACE_STATUS.NO_CONTRACT,   label: "Sem contrato"  },
];

// Decision → visual style for top banner
const DECISION_STYLE = {
  ALLOW: { color: "#10B981", bg: "rgba(16,185,129,0.10)", border: "rgba(16,185,129,0.28)", label: "ADERENTE" },
  WARN:  { color: "#F59E0B", bg: "rgba(245,158,11,0.10)", border: "rgba(245,158,11,0.28)", label: "ATENÇÃO" },
  BLOCK: { color: "#EF4444", bg: "rgba(239,68,68,0.08)",  border: "rgba(239,68,68,0.25)",  label: "BLOQUEADO" },
};

export default function ContractPage() {
  const [surfaceState, setSurfaceState] = useState(CONTRACT_SURFACE_STATUS.ACTIVE_ALLOW);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  useEffect(() => {
    let stale = false;
    setLoading(true);
    setFetchError(null);

    fetchContractSurface({ _mockState: surfaceState }).then((r) => {
      if (stale) return;
      if (r.ok) {
        setData(r.data);
      } else {
        setData(null);
        setFetchError(r.error?.message ?? "Erro ao carregar contrato.");
      }
      setLoading(false);
    });

    return () => { stale = true; };
  }, [surfaceState]);

  // ── Loading ──────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={s.page} role="main">
        <_PageHeader />
        <div style={s.loadingBlock} data-testid="contract-loading">
          <span style={s.loadingIcon} aria-hidden="true">◌</span>
          <p style={s.loadingText}>Carregando dados do contrato…</p>
        </div>
      </div>
    );
  }

  // ── Error ────────────────────────────────────────────────────────────────
  if (fetchError) {
    return (
      <div style={s.page} role="main">
        <_PageHeader />
        <div style={s.errorBlock} data-testid="contract-error">
          <span style={s.errorIcon} aria-hidden="true">⚠</span>
          <p style={s.errorText}>{fetchError}</p>
        </div>
      </div>
    );
  }

  const activeState = data?.active_state || null;
  const adherence = data?.adherence || null;
  const hasContract = !!activeState;
  const decision = adherence?.decision || null;
  const decisionStyle = decision ? DECISION_STYLE[decision] : null;

  return (
    <div style={s.page} role="main">

      {/* ── Page header + state selector ──────────────────────────────────── */}
      <div style={s.topRow}>
        <_PageHeader />
        <div style={s.stateSelector} role="group" aria-label="Estado do contrato">
          {STATES.map(({ key, label }) => (
            <button
              key={key}
              style={{
                ...s.stateBtn,
                ...(surfaceState === key ? s.stateBtnActive : {}),
              }}
              onClick={() => setSurfaceState(key)}
              aria-pressed={surfaceState === key}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Decision banner (when there's an active adherence decision) ──── */}
      {hasContract && decisionStyle && (
        <div
          style={{
            ...s.banner,
            color: decisionStyle.color,
            background: decisionStyle.bg,
            borderColor: decisionStyle.border,
          }}
          role="status"
          data-testid="decision-banner"
        >
          <span style={s.bannerLabel}>{decisionStyle.label}</span>
          <span style={s.bannerText}>
            {adherence.reason_text || `Decisão: ${adherence.decision}`}
          </span>
        </div>
      )}

      {/* ── Empty / no contract ──────────────────────────────────────────── */}
      {!hasContract && (
        <div style={s.emptyBlock} data-testid="no-contract">
          <span style={s.emptyIcon} aria-hidden="true">◎</span>
          <p style={s.emptyTitle}>Nenhum contrato ativo</p>
          <p style={s.emptySub}>
            O sistema não possui contrato ativo no momento. Quando um contrato for ingerido e ativado,
            os detalhes aparecerão aqui.
          </p>
        </div>
      )}

      {/* ── Active contract + adherence layout ───────────────────────────── */}
      {hasContract && (
        <div style={s.body}>
          {/* Left column: contract info + relevant blocks */}
          <div style={s.leftCol}>
            <ActiveContractCard activeState={activeState} />
            <RelevantBlocksCard activeState={activeState} adherence={adherence} />
          </div>

          {/* Right column: adherence gate + evidence trail */}
          <div style={s.rightCol}>
            <AdherenceGateCard adherence={adherence} />
            <EvidenceTrailCard adherence={adherence} />

            {/* No adherence data yet */}
            {!adherence && (
              <div style={s.noAdherenceBlock} data-testid="no-adherence">
                <span style={s.noAdherenceIcon} aria-hidden="true">◌</span>
                <p style={s.noAdherenceText}>
                  Contrato ativo sem avaliação de aderência recente.
                  O gate será executado na próxima ação candidata.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page header sub-component ───────────────────────────────────────────────

function _PageHeader() {
  return (
    <div style={s.pageHeader}>
      <div style={s.titleGroup}>
        <span style={s.titleIcon} aria-hidden="true">📜</span>
        <h1 style={s.pageTitle}>Contrato & Aderência</h1>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = {
  page: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
    padding: "20px 24px",
    height: "100%",
    overflowY: "auto",
    boxSizing: "border-box",
  },

  topRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexWrap: "wrap",
    gap: "12px",
    flexShrink: 0,
  },

  pageHeader: {
    display: "flex",
    alignItems: "center",
    flexShrink: 0,
  },
  titleGroup: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  titleIcon: { fontSize: "16px", lineHeight: 1 },
  pageTitle: {
    margin: 0,
    fontSize: "15px",
    fontWeight: 700,
    color: "var(--text-primary)",
    letterSpacing: "0.3px",
  },

  // State selector
  stateSelector: {
    display: "flex",
    gap: "4px",
    flexWrap: "wrap",
  },
  stateBtn: {
    fontSize: "10px",
    fontWeight: 500,
    color: "var(--text-muted)",
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "5px",
    padding: "4px 10px",
    cursor: "pointer",
    fontFamily: "var(--font-body)",
    transition: "all 0.15s ease",
  },
  stateBtnActive: {
    color: "var(--color-primary)",
    background: "var(--color-primary-glow)",
    borderColor: "var(--color-primary-border)",
    fontWeight: 700,
  },

  // Decision banner
  banner: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "10px 16px",
    borderRadius: "var(--radius-lg)",
    border: "1px solid",
    flexShrink: 0,
  },
  bannerLabel: {
    fontSize: "11px",
    fontWeight: 700,
    letterSpacing: "1px",
    flexShrink: 0,
  },
  bannerText: {
    fontSize: "12px",
    lineHeight: 1.4,
    opacity: 0.9,
  },

  // Body layout
  body: {
    display: "flex",
    gap: "16px",
    flex: 1,
    minHeight: 0,
  },
  leftCol: {
    width: "340px",
    minWidth: "300px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
    flexShrink: 0,
  },
  rightCol: {
    flex: 1,
    minWidth: 0,
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    overflowY: "auto",
  },

  // Empty state
  emptyBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "48px 24px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    textAlign: "center",
  },
  emptyIcon: {
    fontSize: "32px",
    color: "var(--text-muted)",
    opacity: 0.4,
  },
  emptyTitle: {
    margin: 0,
    fontSize: "14px",
    fontWeight: 600,
    color: "var(--text-secondary)",
  },
  emptySub: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    maxWidth: "400px",
  },

  // Loading state
  loadingBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "48px 24px",
    textAlign: "center",
  },
  loadingIcon: {
    fontSize: "28px",
    color: "var(--color-primary)",
    opacity: 0.5,
  },
  loadingText: {
    margin: 0,
    fontSize: "13px",
    color: "var(--text-muted)",
  },

  // Error state
  errorBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: "8px",
    padding: "48px 24px",
    textAlign: "center",
  },
  errorIcon: {
    fontSize: "28px",
    color: "#EF4444",
  },
  errorText: {
    margin: 0,
    fontSize: "13px",
    color: "#EF4444",
  },

  // No adherence data
  noAdherenceBlock: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "24px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    textAlign: "center",
  },
  noAdherenceIcon: {
    fontSize: "24px",
    color: "var(--text-muted)",
    opacity: 0.4,
  },
  noAdherenceText: {
    margin: 0,
    fontSize: "12px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
    maxWidth: "360px",
  },
};
