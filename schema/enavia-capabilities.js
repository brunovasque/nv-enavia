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
 * Retorna as capacidades reais que a Enavia possui em runtime (atualizado PR84).
 * @returns {{ can: string[], cannot_yet: string[] }}
 */
export function getEnaviaCapabilities() {
  return {
    can: [
      "Conversar de forma natural e contextual no chat",
      "Classificar intenção da mensagem (Intent Classifier v1)",
      "Rotear para skill documental relevante (Skill Router v1, read-only)",
      "Executar skills aprovadas via /skills/run com gate de aprovação explícito",
      "Auditar o próprio Worker/sistema com SELF_WORKER_AUDITOR (read-only)",
      "Aplicar Response Policy viva para orientar tom e segurança",
      "Aplicar Self-Audit para detectar falsa capacidade, execução fake e outros riscos",
      "Identificar próxima PR autorizada pelo contrato ativo",
      "Diagnosticar, planejar e sugerir com base em evidências reais",
      "Respeitar guardrails e exigir aprovação humana antes de execução real",
    ],
    cannot_yet: [
      "Intent Engine completo com routing multi-step autônomo",
      "Executar contratos aprovados via executor contratual de forma autônoma",
      "Escrita automática de memória persistente entre sessões",
      "Leitura e consolidação de memórias do KV como fluxo estável",
      "Deploy autônomo para produção sem aprovação humana explícita",
      "Telemetria avançada e observabilidade completa",
      "Automonitoramento proativo de estado do sistema",
    ],
  };
}
