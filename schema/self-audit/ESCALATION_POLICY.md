# Self-Audit Framework — Política de Escalonamento

> **Status:** Documental. Define quando escalar, alertar ou registrar como observação.

---

## Níveis de escalonamento

### 🔴 Bloqueia avanço (`should_block: true`)

Situações que impedem o avanço para a próxima PR ou para a entrega da resposta:

| Situação | Categoria de risco |
|---|---|
| Prova (PR-PROVA) falhou — qualquer assert | `regression_risk` / `fake_execution` |
| Arquivo proibido alterado na PR | `scope_violation` |
| Endpoint criado fora do contrato | `unauthorized_action` |
| `/skills/run` criado sem contrato autorizando | `unauthorized_action` |
| Falsa capacidade detectada em conclusão de PR | `false_capability` |
| Deploy/produção alterado sem aprovação humana | `unauthorized_action` |
| Segredo, token ou API key exposto | `secret_exposure` |
| Regressões falharam | `regression_risk` |
| `schema/contracts/INDEX.md` e PR proposta divergem | `contract_drift` |
| PR-IMPL executada sem PR-DIAG anterior obrigatória | `contract_drift` / `scope_violation` |
| Fechamento de frente sem PR-PROVA formal | `contract_drift` |

**Como reportar bloqueio:**

```
WORKFLOW_ACK: bloqueado

Etapa: [nome da etapa em que o bloqueio foi detectado]
Bloqueio: [descrição clara do problema]
Causa provável: [hipótese de causa]
Evidência: [referência a arquivo, linha, log ou resultado]
Próxima ação segura: [o que deve ser feito antes de avançar]
```

---

### 🟡 Alerta, mas não bloqueia (`should_block: false`, `risk_level: medium|high`)

Situações que requerem atenção mas não impedem o avanço imediato:

| Situação | Categoria de risco | Severidade |
|---|---|---|
| Aumento pequeno de prompt sem duplicação real | `prompt_bloat` | `low` |
| PR-DOCS necessária e justificada pelo contrato | `docs_over_product` | `low` |
| Limitação de harness sem LLM externo, quando documentada | `runtime_vs_documentation_confusion` | `low` |
| Warning `read_only` presente e adequado | — | nenhum |
| Lacuna futura claramente marcada como "PR futura" | — | nenhum |
| Contexto potencialmente desatualizado mas não crítico | `stale_context` | `medium` |
| Incerteza sobre estado de componente, mas declarada | `missing_source` | `low` |
| Modo ligeiramente mais formal que o ideal | `wrong_mode` | `low` |

**Como reportar alerta:**

Incluir no campo `warnings` do output JSON ou no relatório de PR:

```
⚠️ ALERTA [categoria]: [descrição do alerta]
Evidência: [referência]
Recomendação: [ação sugerida para próxima PR ou sessão]
```

---

### 🔵 Observação (`risk_level: low|none`)

Situações de risco baixo, informativas, que não requerem ação imediata:

| Situação | Exemplo |
|---|---|
| Melhoria de documentação possível | Frase pouco clara num arquivo de brain |
| Duplicação leve sem impacto funcional | Duas menções ao mesmo conceito em arquivos diferentes |
| Risco baixo documentado e conhecido | "Esta limitação é conhecida e será endereçada na PR58" |
| Próximas PRs futuras identificadas mas não urgentes | Roadmap além da PR60 |

**Como reportar observação:**

Incluir no campo `findings` com `severity: "low"` e `should_block: false`.

---

## Como voltar ao contrato após exceção

Quando uma exceção corretiva foi necessária (ex: PR de fix fora do roadmap normal):

1. Documentar a exceção no relatório da PR com justificativa.
2. Atualizar `schema/execution/ENAVIA_EXECUTION_LOG.md` com a exceção.
3. Atualizar `schema/contracts/INDEX.md` se o número de PRs mudou.
4. Declarar explicitamente qual é a próxima PR autorizada após a exceção.
5. Confirmar que o contrato ativo ainda é válido ou propor atualização.

**Nunca avançar como se a exceção não tivesse ocorrido.** Sempre reconciliar com o contrato.

---

## Como evitar documentação infinita

A maior armadilha do Self-Audit é se tornar mais documentação em cima de documentação.

Regras anti-excesso:

1. **Uma PR-DOCS por frente, não uma por conceito.** Cada frente (Self-Audit, Skills, Brain) tem no máximo 1–2 PRs docs antes de uma PR-IMPL.
2. **PR-DOCS só se justificada pelo contrato.** Sem contrato autorizando = sem PR-DOCS.
3. **Roadmap não é produto.** Um roadmap bonito não substitui testes passando.
4. **Se o contrato diz PR-IMPL, a PR deve ser PR-IMPL.** Transformar em PR-DOCS sem justificativa é drift.
5. **Self-Audit deve detectar excesso documental em si mesmo.** Se a Enavia criar mais docs sobre o Self-Audit sem implementá-lo, o sinal `docs_over_product` deve ser ativado.
