# PR55 — Self-Audit Framework

**Tipo:** `PR-DOCS`
**Branch:** `copilot/claude-pr55-docs-self-audit-framework`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR54 ✅ (PR-PROVA — Prova de Memória Contextual — 93/93 + 1.465/1.465)
**Data:** 2026-05-01

---

## 1. Objetivo

Criar o Framework documental de Self-Audit da Enavia — o conjunto de regras, checklists, modelo de risco, sinais de alerta, contrato de saída e política de escalonamento que define como a Enavia vai se autoavaliar antes de responder, sugerir PR, revisar PR, usar skill, afirmar capacidade, orientar deploy ou sinalizar risco.

Esta PR prepara o terreno para a PR56 (PR-IMPL — Self-Audit read-only runtime).

---

## 2. PR54 validada

PR54 — PR-PROVA — Prova de Memória Contextual foi concluída com:
- 93 asserts PR54 (cenários A–M) ✅
- 1.372/1.372 regressões ✅
- Total 1.465/1.465 ✅
- Retrieval por Intenção v1 validado formalmente como memória contextual read-only
- Relatório: `schema/reports/PR54_PROVA_MEMORIA_CONTEXTUAL.md`

---

## 3. Arquivos criados

| Arquivo | Tamanho aproximado | Descrição |
|---|---|---|
| `schema/self-audit/INDEX.md` | ~3.8 KB | Visão geral, conexões com módulos, próxima PR |
| `schema/self-audit/FRAMEWORK.md` | ~6.1 KB | 10 camadas de auditoria + fluxo futuro + regras |
| `schema/self-audit/CHECKLISTS.md` | ~4.9 KB | Checklists A–F (responder, PR, revisão, skill, sistema, deploy) |
| `schema/self-audit/RISK_MODEL.md` | ~7.2 KB | 5 níveis + 13 categorias de risco com mitigações |
| `schema/self-audit/SIGNALS.md` | ~5.3 KB | Sinais FC, OP, ED, DC, SEC (30+ sinais) |
| `schema/self-audit/OUTPUT_CONTRACT.md` | ~5.0 KB | Contrato JSON de saída futura + exemplos |
| `schema/self-audit/ESCALATION_POLICY.md` | ~4.4 KB | Bloquear / alertar / observar + anti-excesso documental |
| `schema/self-audit/ROADMAP.md` | ~5.4 KB | PR55–PR61+ com dependências e restrições |
| `schema/reports/PR55_SELF_AUDIT_FRAMEWORK.md` | este arquivo | Relatório completo da PR55 |

---

## 4. Arquitetura do framework

O Self-Audit é uma camada de reflexão pós-LLM, pré-resposta. Opera em 10 camadas:

| # | Camada | Pergunta central |
|---|---|---|
| 1 | Identidade | A resposta preserva quem a Enavia é? |
| 2 | Capacidade | A resposta afirma algo que o sistema realmente faz? |
| 3 | Intenção | A resposta bate com a intenção detectada? |
| 4 | Skill | A skill foi usada corretamente? O usuário entende o que aconteceu? |
| 5 | Retrieval/Memória | A memória contextual foi usada corretamente? |
| 6 | Execução/Gates | Algo foi executado que não deveria ser? |
| 7 | Contrato | A ação está dentro do contrato ativo? |
| 8 | Falsa capacidade | A resposta afirma que fez algo que não fez? |
| 9 | Excesso documental | A resposta gera produto ou apenas documentação? |
| 10 | Resposta final | A resposta é a melhor possível dentro das restrições? |

**Fluxo futuro (PR56):**
```
message → intent → skill routing → retrieval → LLM Core → Self-Audit read-only → resposta
```

---

## 5. Checklists criados

6 checklists documentais com 48 itens no total:

| Checklist | Contexto | Itens |
|---|---|---|
| A | Antes de responder | 8 |
| B | Antes de sugerir a próxima PR | 8 |
| C | Ao revisar PR | 8 |
| D | Ao falar sobre skills | 6 |
| E | Ao falar sobre o sistema | 6 |
| F | Ao falar sobre deploy/execução | 8 |

---

## 6. Modelo de risco

5 níveis: `none`, `low`, `medium`, `high`, `blocking`

13 categorias:

| Categoria | Severidade padrão |
|---|---|
| `false_capability` | `high` |
| `fake_execution` | `blocking` |
| `unauthorized_action` | `blocking` |
| `wrong_mode` | `medium` |
| `prompt_bloat` | `low` |
| `docs_over_product` | `medium` |
| `stale_context` | `medium` |
| `missing_source` | `medium` |
| `contract_drift` | `high` |
| `scope_violation` | `blocking` |
| `regression_risk` | `high` |
| `secret_exposure` | `blocking` |
| `runtime_vs_documentation_confusion` | `medium` |

Regra de bloqueio: se `blocking`, parar, explicar, aguardar correção antes de avançar.

---

## 7. Sinais de auditoria

30+ sinais organizados em 5 grupos:

| Grupo | Prefixo | Sinais |
|---|---|---|
| Falsa capacidade | FC | FC-01 a FC-07 |
| Operação indevida | OP | OP-01 a OP-06 |
| Excesso documental | ED | ED-01 a ED-06 |
| Drift contratual | DC | DC-01 a DC-07 |
| Segurança | SEC | SEC-01 a SEC-09 |

---

## 8. Contrato de saída

Formato JSON aditivo para campo `self_audit` no response do `/chat/run`:

```json
{
  "self_audit": {
    "applied": true,
    "mode": "read_only",
    "risk_level": "none|low|medium|high|blocking",
    "findings": [],
    "should_block": false,
    "warnings": [],
    "next_safe_action": "string"
  }
}
```

Regras: output aditivo, não expõe segredo, não contém chain-of-thought, `should_block=true` só com evidência real, falha com segurança (campo omitido se módulo falhar, resposta principal continua).

---

## 9. Política de escalonamento

- **Bloquear:** 12 situações críticas (prova falha, arquivo proibido, endpoint indevido, segredo exposto, etc.)
- **Alertar:** limitações documentadas, prompt levemente maior, lacunas marcadas como futuras
- **Observar:** melhorias de docs, duplicação leve, riscos baixos documentados

Anti-excesso: regras para evitar que Self-Audit vire mais documentação sobre documentação.

---

## 10. Roadmap

| PR | Tipo | Objetivo |
|---|---|---|
| PR55 | PR-DOCS | Framework documental ✅ (esta PR) |
| PR56 | PR-IMPL | Self-Audit read-only runtime |
| PR57 | PR-PROVA | Prova do Self-Audit read-only |
| PR58 | PR-IMPL/DOCS | Response Policy viva |
| PR59 | PR-PROVA | Prova anti-bot final |
| PR60 | PR-DOCS/IMPL | Propor atualização de memória |
| PR61+ | PR-IMPL | Runtime de Skills / evolução futura |

---

## 11. O que NÃO foi implementado nesta PR

Esta PR é puramente documental. Os seguintes itens **não existem, não foram criados e não foram alterados**:

- ❌ Self-Audit runtime **não foi implementado**
- ❌ Nenhum endpoint foi criado (`/self-audit`, `/audit/run` ou qualquer outro)
- ❌ Nenhum Worker runtime foi alterado (`nv-enavia.js`, `enavia-cognitive-runtime.js`, `enavia-llm-core.js`, `enavia-brain-loader.js`, `enavia-intent-classifier.js`, `enavia-skill-router.js`, `enavia-intent-retrieval.js`)
- ❌ Nenhuma resposta foi alterada (prompt real intocado)
- ❌ Nenhuma execução automática existe
- ❌ Nenhum deploy ou gate foi alterado
- ❌ Nenhum painel foi alterado
- ❌ Nenhum Executor foi alterado
- ❌ Nenhum workflow foi alterado
- ❌ `wrangler.toml` intocado
- ❌ `wrangler.executor.template.toml` intocado
- ❌ Nenhum KV, binding ou secret foi criado ou alterado
- ❌ `schema/enavia-self-audit.js` não existe — será criado na PR56

---

## 12. Próxima PR recomendada

**PR56 — PR-IMPL — Self-Audit read-only**

Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
Escopo: criar `schema/enavia-self-audit.js` com `runSelfAudit()`, integrar como campo aditivo `self_audit` no response, seguindo o OUTPUT_CONTRACT.md desta PR55.

Pré-requisito: PR55 mergeada ✅

---

## Verificações

```bash
git diff --name-only
```

Arquivos alterados:
- `schema/self-audit/INDEX.md` (novo)
- `schema/self-audit/FRAMEWORK.md` (novo)
- `schema/self-audit/CHECKLISTS.md` (novo)
- `schema/self-audit/RISK_MODEL.md` (novo)
- `schema/self-audit/SIGNALS.md` (novo)
- `schema/self-audit/OUTPUT_CONTRACT.md` (novo)
- `schema/self-audit/ESCALATION_POLICY.md` (novo)
- `schema/self-audit/ROADMAP.md` (novo)
- `schema/reports/PR55_SELF_AUDIT_FRAMEWORK.md` (novo)
- `schema/contracts/INDEX.md` (atualizado)
- `schema/status/ENAVIA_STATUS_ATUAL.md` (atualizado)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (atualizado)
- `schema/execution/ENAVIA_EXECUTION_LOG.md` (atualizado)

Nenhum arquivo `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` foi alterado.

---

## Rollback

Esta PR é puramente documental. Rollback = reverter os arquivos criados em `schema/self-audit/` e este relatório. Nenhuma funcionalidade de runtime foi alterada — rollback não impacta nenhum serviço em produção.
