// ============================================================================
// ⚙️ ENAVIA — Capacidades Reais em Runtime (PR1 — Núcleo Cognitivo Runtime)
//
// Módulo puro que exporta as capacidades reais que a Enavia possui hoje.
// Deve refletir estritamente o que está maduro nesta PR1 — não prometer
// o que pertence a PRs futuras (planner tool completo, braços, memória avançada).
//
// Escopo: WORKER-ONLY. Sem side-effects. Sem dependências externas.
// ============================================================================

/**
 * Retorna as capacidades reais que a Enavia possui em runtime na PR1.
 * @returns {{ can: string[], cannot_yet: string[] }}
 */
export function getEnaviaCapabilities() {
  return {
    can: [
      "Conversar de forma natural e contextual no chat atual",
      "Responder com base institucional e identidade canônica da Enavia",
      "Informar quem ela é e quais são seus limites básicos",
      "Respeitar guardrails e exigir aprovação humana quando necessário",
      "Estruturar entendimento inicial e diagnóstico do pedido",
    ],
    cannot_yet: [
      "Planner completo com tool arbitration (PM4→PM9) como fluxo consolidado",
      "Executar contratos aprovados via executor contratual de forma autônoma",
      "Operar braço de browser de forma madura",
      "Operar braço de GitHub/PR de forma madura",
      "Memória longa persistente entre sessões",
      "Leitura e consolidação de memórias do KV como fluxo estável",
      "Telemetria avançada e observabilidade completa",
      "Automonitoramento proativo de estado do sistema",
    ],
  };
}
