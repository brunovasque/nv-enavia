// ============================================================================
// EmptyMemoryState — product-grade empty state for no-memory condition
// ============================================================================

const MEMORY_LAYERS = [
  {
    icon: "◆",
    label: "Memória Canônica",
    desc: "Regras permanentes, identidade e constraints do sistema — persiste entre sessões",
    accent: "var(--color-primary)",
  },
  {
    icon: "○",
    label: "Memória Operacional",
    desc: "Decisões e aprendizados de sessões anteriores — candidatos à consolidação",
    accent: "var(--text-secondary)",
  },
  {
    icon: "●",
    label: "Contexto Vivo",
    desc: "Estado atual da sessão em execução — sinais, contratos e intent ativos",
    accent: "#10B981",
  },
  {
    icon: "↻",
    label: "Consolidação",
    desc: "Ciclo de avaliação que promove contexto operacional para memória forte canônica",
    accent: "#F59E0B",
  },
];

export default function EmptyMemoryState() {
  return (
    <div style={s.wrap}>
      <div style={s.center}>
        {/* Icon */}
        <div style={s.iconWrap} aria-hidden="true">
          <span style={s.icon}>🧠</span>
          <div style={s.iconRing} />
        </div>

        <h2 style={s.heading}>Memória vazia</h2>
        <p style={s.sub}>
          A Enavia ainda não acumulou memória nesta instância. Inicie uma sessão
          de trabalho para que o sistema comece a registrar e consolidar contexto.
        </p>

        {/* Memory layers preview */}
        <div style={s.layers} role="list">
          {MEMORY_LAYERS.map(({ icon, label, desc, accent }) => (
            <div key={label} style={s.layer} role="listitem">
              <span
                style={{ ...s.layerIcon, color: accent }}
                aria-hidden="true"
              >
                {icon}
              </span>
              <div style={s.layerText}>
                <p style={{ ...s.layerLabel, color: accent }}>{label}</p>
                <p style={s.layerDesc}>{desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Hint */}
        <div style={s.hint}>
          <span style={s.hintDot} aria-hidden="true" />
          <span style={s.hintText}>
            Aguardando primeira instrução para iniciar o ciclo de memória
          </span>
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
    padding: "40px 24px",
  },
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    maxWidth: "560px",
    width: "100%",
    textAlign: "center",
  },
  iconWrap: {
    position: "relative",
    width: "72px",
    height: "72px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: "24px",
  },
  icon: {
    fontSize: "36px",
    position: "relative",
    zIndex: 1,
    opacity: 0.4,
  },
  iconRing: {
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
    lineHeight: 1.6,
    marginBottom: "32px",
    maxWidth: "420px",
  },
  layers: {
    width: "100%",
    display: "flex",
    flexDirection: "column",
    background: "var(--bg-surface)",
    border: "1px solid var(--border-light)",
    borderRadius: "var(--radius-lg)",
    overflow: "hidden",
    marginBottom: "28px",
  },
  layer: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    padding: "12px 16px",
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
  },
  layerIcon: {
    fontSize: "18px",
    width: "24px",
    textAlign: "center",
    flexShrink: 0,
    opacity: 0.5,
  },
  layerText: {
    flex: 1,
  },
  layerLabel: {
    fontSize: "12px",
    fontWeight: 600,
    marginBottom: "1px",
    opacity: 0.8,
  },
  layerDesc: {
    fontSize: "11px",
    color: "var(--text-muted)",
    lineHeight: 1.4,
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
    opacity: 0.6,
    letterSpacing: "0.3px",
  },
};
