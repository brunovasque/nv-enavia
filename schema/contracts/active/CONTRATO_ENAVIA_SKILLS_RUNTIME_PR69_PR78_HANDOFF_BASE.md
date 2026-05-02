# HANDOFF BASE — Skills Runtime PR69–PR78

Este arquivo registra o handoff usado como base para o contrato `CONTRATO_ENAVIA_SKILLS_RUNTIME_PR69_PR78.md`.

Origem: handoff pós-Jarvis Brain v1 fornecido pelo operador humano.

---

## Estado real resumido

A Enavia possui base cognitiva/governada criada e validada no ciclo Jarvis Brain v1:

- LLM Core
- Brain documental estilo Obsidian
- Brain Loader read-only
- Intent Classifier
- Skill Router read-only
- Intent Retrieval
- Self-Audit read-only
- Response Policy
- Blueprint documental do Runtime de Skills
- Diagnóstico técnico do Runtime de Skills
- Hardening de segurança/custo/limites

Mas ainda não possui Runtime de Skills operacional.

Ainda não existe:

- `schema/enavia-skill-executor.js`
- `/skills/propose`
- `/skills/run`
- approval gate técnico
- execução real de skills
- escrita automática/supervisionada de memória
- ações reais via chat
- orquestração Jarvis ponta a ponta

Resumo honesto:

> A Enavia pensa melhor, entende melhor e se protege melhor. Mas ainda não executa como Jarvis.

---

## Próximo passo prático definido

Primeira entrega funcional: Skill Execution Proposal read-only.

Escopo recomendado:

- criar `schema/enavia-skill-executor.js`
- exportar `buildSkillExecutionProposal(input)`
- aceitar `skillRouting`, `intentClassification`, `selfAudit`, `responsePolicy`
- retornar `skill_execution` em `mode="proposal"`
- status `proposed`, `not_applicable` ou `blocked`
- allowlist inicial: `CONTRACT_LOOP_OPERATOR`, `CONTRACT_AUDITOR`, `DEPLOY_GOVERNANCE_OPERATOR`, `SYSTEM_MAPPER`
- deny-by-default para skill desconhecida
- bloquear se Self-Audit tiver risco blocking ou secret exposure
- nunca executar skill
- nunca chamar fetch, KV, fs ou LLM externo
- integrar em `nv-enavia.js` como campo aditivo no `/chat/run`
- não alterar `reply` nem `use_planner`
- criar smoke test específico
- rodar regressões principais de self-audit, response-policy e skill-router

---

## Proibições herdadas

- não criar `/skills/propose` antes do módulo proposal-only validado
- não criar `/skills/run` neste início
- não criar endpoint na primeira PR
- não escrever KV
- não alterar `wrangler.toml`
- não alterar `contract-executor.js`
- não executar skill
- não mexer em produção

---

## Decisão de gestão

Este contrato existe para evitar nova fase pesada de documentação.

A partir daqui, cada PR deve entregar código ou prova objetiva.
Documentação deve ser mínima e diretamente ligada a decisão, teste, rollback ou handoff.
