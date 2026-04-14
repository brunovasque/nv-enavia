// ============================================================================
// ⚙️ ENAVIA — Capacidades Reais em Runtime (PR1 — Núcleo Cognitivo Runtime)
//
// Módulo puro que exporta as capacidades reais que a Enavia possui hoje.
// Deve refletir a realidade do worker — não prometer o que não existe.
//
// Escopo: WORKER-ONLY. Sem side-effects. Sem dependências externas.
// ============================================================================

/**
 * Retorna as capacidades reais que a Enavia possui em runtime.
 * @returns {{ can: string[], cannot_yet: string[] }}
 */
export function getEnaviaCapabilities() {
  return {
    can: [
      "Conversar de forma natural e contextual (chat LLM-first)",
      "Classificar intenções e montar planos canônicos (planner PM4→PM9)",
      "Submeter planos ao gate de aprovação humana",
      "Executar contratos aprovados via executor contratual",
      "Ler e consolidar memórias do KV (brain)",
      "Fazer auditoria contratual e aderência de microetapas",
      "Operar braço de browser (leitura e ação via executor)",
      "Operar braço de GitHub/PR (leitura e ação via executor)",
      "Observar estado do sistema em modo read-only",
      "Registrar decisões humanas e trilha de execução",
    ],
    cannot_yet: [
      "Memória longa persistente entre sessões (em construção)",
      "Planejamento autônomo sem aprovação humana para ações relevantes",
      "Execução profunda de browser sem supervisão",
      "Telemetria avançada e observabilidade completa",
      "Lapidação de estilo de fala (personalidade rica)",
      "Automonitoramento proativo de estado do sistema",
    ],
  };
}
