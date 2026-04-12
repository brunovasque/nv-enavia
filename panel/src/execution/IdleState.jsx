// ============================================================================
// IdleState — estado vazio: nenhuma execução ativa
// Visual de produto, não de placeholder genérico
// ============================================================================

const SIGNALS = [
  {
    icon: "◆",
    label: "Plano carregado",
    desc: "Ciclo cognitivo entrega um plano canônico estruturado para execução",
  },
  {
    icon: "⏳",
    label: "Gate humano",
    desc: "Aprovação do responsável antes de acionar o executor",
  },
  {
    icon: "⇒",
    label: "Bridge acionado",
    desc: "Handoff do plano aprovado para o contract-executor",
  },
  {
    icon: "▷",
    label: "Etapas em sequência",
    desc: "Execução passo a passo com acompanhamento em tempo real",
  },
  {
    icon: "◎",
    label: "Resultado entregue",
    desc: "Saída estruturada disponível ao fim do ciclo",
  },
];

export default function IdleState() {
  return (
    <div style={s.wrap}>
      <div style={s.center}>
        {/* Mark */}
        <div style={s.markWrap} aria-hidden="true">
          <span style={s.mark}>◆</span>
          <div style={s.markRing} />
        </div>

        <h2 style={s.heading}>Nenhuma execução ativa</h2>
        <p style={s.sub}>
          Inicie uma instrução no Chat para que a Enavia planeje e execute um ciclo completo.
          O acompanhamento em tempo real estará disponível aqui.
        </p>

        {/* Cycle signals */}
        <div style={s.signals}>
          {SIGNALS.map(({ icon, label, desc }) => (
            <div key={label} style={s.signal}>
              <span style={s.signalIcon} aria-hidden="true">{icon}</span>
              <div>
                <p style={s.signalLabel}>{label}</p>
                <p style={s.signalDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Waiting hint */}
        <div style={s.hint}>
          <span style={s.hintDot} aria-hidden="true" />
          <span style={s.hintText}>Aguardando início de execução</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  wrap: {
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "32px 24px",
    minHeight: 0,
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "560px",
    width: "100%",
    textAlign: "center",
  },
  markWrap: {
    position: "relative",
    width: "64px",
    height: "64px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "20px",
  },
  mark: {
    fontSize: "32px",
    color: "var(--color-primary)",
    position: "relative",
    zIndex: 1,
    opacity: 0.4,
    textShadow: "0 0 24px rgba(0,180,216,0.3)",
  },
  markRing: {
    position: "absolute",
    inset: 0,
    borderRadius: "50%",
    border: "1px solid var(--color-primary-border)",
    background: "var(--color-primary-glow)",
  },
  heading: {
    fontSize: "18px",
    fontWeight: 700,
    color: "var(--text-primary)",
    marginBottom: "8px",
    letterSpacing: "0.2px",
  },
  sub: {
    fontSize: "13px",
    color: "var(--text-muted)",
    lineHeight: 1.7,
    marginBottom: "32px",
    maxWidth: "420px",
  },
  signals: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: "2px",
    marginBottom: "28px",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
  },
  signal: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "11px 16px",
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
  },
  signalIcon: {
    fontSize: "16px",
    color: "var(--color-primary)",
    opacity: 0.45,
    width: "20px",
    textAlign: "center",
    flexShrink: 0,
  },
  signalLabel: {
    fontSize: "13px",
    fontWeight: 600,
    color: "var(--text-secondary)",
    marginBottom: "1px",
  },
  signalDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.5,
  },
  hint: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  hintDot: {
    width: "6px",
    height: "6px",
    borderRadius: "50%",
    background: "var(--text-muted)",
    flexShrink: 0,
    opacity: 0.4,
  },
  hintText: {
    fontSize: "11px",
    color: "var(--text-muted)",
    letterSpacing: "0.5px",
  },
};
