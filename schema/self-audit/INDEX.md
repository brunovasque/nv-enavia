# Self-Audit Framework — Índice

> **Status:** Documental. Não roda automaticamente. Nenhum runtime implementado nesta PR.
> **PR que criou este framework:** PR55 — PR-DOCS
> **Próxima PR:** PR56 — PR-IMPL — Self-Audit read-only

---

## O que é o Self-Audit Framework

O Self-Audit Framework é o conjunto de regras, checklists, modelo de risco, sinais de alerta e política de escalonamento que define **como a Enavia vai se autoavaliar** antes de:

- responder a uma mensagem;
- sugerir ou executar uma próxima PR;
- revisar uma PR;
- usar ou mencionar uma skill;
- afirmar capacidade operacional;
- orientar deploy ou execução;
- falar sobre memória, contexto ou estado do sistema;
- sinalizar risco ou bloqueio.

Este framework **não é uma personalidade robótica**. É um guardrail silencioso que preserva naturalidade enquanto detecta riscos antes de agir.

---

## Estado atual

| Componente | Estado |
|---|---|
| Framework documental | ✅ Criado (PR55) |
| Self-Audit runtime | ❌ Não existe ainda |
| Endpoint `/self-audit` | ❌ Não criado |
| Endpoint `/audit/run` | ❌ Não criado |
| Execução automática | ❌ Não implementada |
| Integração com prompt | ❌ PR56 fará isso |

---

## Quando consultar este framework

- Ao implementar PR56 (Self-Audit read-only runtime).
- Ao revisar respostas da Enavia que pareçam afirmar capacidade não comprovada.
- Ao planejar novas PRs que toquem runtime, deploy ou prompts.
- Ao identificar sinais de drift contratual ou excesso documental.
- Ao avaliar se um bloqueio deve parar o avanço da próxima PR.

---

## Conexão com os módulos do sistema

| Módulo | Arquivo | Conexão com Self-Audit |
|---|---|---|
| LLM Core | `schema/enavia-llm-core.js` | Self-Audit opera após o Core gerar o bloco de resposta |
| Brain Loader | `schema/enavia-brain-loader.js` | Self-Audit verifica se o contexto documental está sendo usado corretamente |
| Intent Classifier | `schema/enavia-intent-classifier.js` | Self-Audit valida se a intenção classificada é coerente com a resposta gerada |
| Skill Router | `schema/enavia-skill-router.js` | Self-Audit verifica se skill roteada é documental e se nenhuma execução indevida ocorreu |
| Intent Retrieval | `schema/enavia-intent-retrieval.js` | Self-Audit confirma se contexto recuperado foi usado ou ignorado corretamente |
| Contratos | `schema/contracts/active/` | Self-Audit verifica alinhamento entre resposta/ação e contrato ativo |
| Governança | `schema/status/`, `schema/handoffs/`, `schema/execution/` | Self-Audit verifica se atualizações obrigatórias foram feitas |

---

## Arquivos do framework

| Arquivo | Descrição |
|---|---|
| `INDEX.md` (este arquivo) | Visão geral, conexões, próxima PR |
| `FRAMEWORK.md` | Arquitetura conceitual: camadas, fluxo futuro, regras |
| `CHECKLISTS.md` | Checklists por contexto (responder, PR, revisão, skill, sistema, deploy) |
| `RISK_MODEL.md` | Níveis e categorias de risco, mitigações, quando bloquear |
| `SIGNALS.md` | Sinais de alerta: falsa capacidade, operação indevida, excesso documental, drift, segurança |
| `OUTPUT_CONTRACT.md` | Contrato de saída futura do Self-Audit read-only (formato JSON) |
| `ESCALATION_POLICY.md` | Quando bloquear, alertar ou registrar como observação |
| `ROADMAP.md` | Roadmap PR55–PR61+ do Self-Audit |

---

## Próxima PR autorizada

**PR56 — PR-IMPL — Self-Audit read-only**

Objetivo: implementar o módulo `schema/enavia-self-audit.js` com `runSelfAudit()` (read-only, aditivo, sem alterar resposta), integrado ao fluxo do chat como camada pós-LLM Core, pré-resposta final.

Restrições da PR56:
- read-only (não altera resposta automaticamente);
- campo aditivo `self_audit` no response (não quebrante);
- sem endpoint novo;
- sem escrita em KV/memória;
- sem alteração de Panel, Executor, Deploy Worker.
