# Self-Audit Framework — Modelo de Risco

> **Status:** Documental. Define os níveis e categorias de risco para uso futuro pelo Self-Audit runtime.

---

## Níveis de risco

| Nível | Código | Descrição | Ação |
|---|---|---|---|
| Nenhum | `none` | Nenhum risco detectado. Resposta segura. | Prosseguir normalmente. |
| Baixo | `low` | Risco menor, informativo. Não impede avanço. | Registrar como observação. |
| Médio | `medium` | Risco real mas não bloqueador. Requer atenção. | Alertar e documentar. |
| Alto | `high` | Risco significativo. Pode comprometer a qualidade ou confiança. | Alertar com recomendação clara. |
| Bloqueador | `blocking` | Risco crítico. A ação não deve prosseguir. | Parar, explicar bloqueio, aguardar correção. |

**Regra de bloqueio:** Se houver risco `blocking`, a Enavia deve parar, explicar o bloqueio com evidência clara e pedir correção ou diagnóstico antes de avançar para a próxima PR ou resposta.

---

## Categorias de risco

### `false_capability`

- **Descrição:** A resposta afirma capacidade que o sistema não possui ou não executou.
- **Exemplos:** "A skill foi executada" (sem `/skills/run`). "O deploy foi feito" (sem workflow). "A memória foi salva" (sem escrita em KV). "O endpoint responde" (sem verificação real).
- **Severidade padrão:** `high`
- **Mitigação:** Verificar se a ação descrita tem evidência no runtime. Se não houver, usar linguagem condicional ou negar.
- **Bloquear avanço quando:** A falsa capacidade faz parte de uma conclusão de PR ("PR55 implementou runtime" quando não implementou).

---

### `fake_execution`

- **Descrição:** A resposta descreve execução que não ocorreu no sistema real.
- **Exemplos:** "Executei o contrato". "Rodei os testes". "Deploy realizado". "Escrevi na memória".
- **Severidade padrão:** `blocking`
- **Mitigação:** Sempre apresentar commit hash, resultado de teste ou evidência equivalente. Sem evidência = não feito.
- **Bloquear avanço quando:** Sempre que afirmação de execução não tiver evidência verificável.

---

### `unauthorized_action`

- **Descrição:** Uma ação foi realizada sem aprovação explícita no contrato ou pelo usuário.
- **Exemplos:** Criar endpoint fora do contrato. Alterar `wrangler.toml` sem autorização. Escrever em KV sem aprovação. Alterar Panel sem escopo.
- **Severidade padrão:** `blocking`
- **Mitigação:** Consultar contrato antes de qualquer ação. Parar se não autorizado.
- **Bloquear avanço quando:** Sempre.

---

### `wrong_mode`

- **Descrição:** A Enavia respondeu em modo incompatível com a intenção.
- **Exemplos:** Intenção `conversation` gerou modo operacional pesado. Frustração do usuário ativou planejamento de PR. Pergunta conceitual virou execução.
- **Severidade padrão:** `medium`
- **Mitigação:** Reclassificar intenção. Ajustar tom para o modo correto.
- **Bloquear avanço quando:** O modo errado gerou ação indevida (ex: PR proposta incorretamente).

---

### `prompt_bloat`

- **Descrição:** O prompt do sistema ficou excessivamente grande sem necessidade real.
- **Exemplos:** Duplicação de regras entre seções. Brain context repetindo o que já está no LLM Core. Documentação interna exposta no prompt do usuário.
- **Severidade padrão:** `low`
- **Mitigação:** Consolidar seções duplicadas. Limitar contexto de retrieval. Manter economia de tokens.
- **Bloquear avanço quando:** Não bloqueia — registrar como observação para PR futura.

---

### `docs_over_product`

- **Descrição:** A Enavia está gerando documentação ao invés de produto funcional.
- **Exemplos:** Mais de 2 PRs docs/diag consecutivas sem implementação. Contrato detalhado sem produto. Avanço documental sem teste prático. Roadmap crescendo sem entregas.
- **Severidade padrão:** `medium`
- **Mitigação:** Priorizar PR-IMPL após PR-DIAG confirmada. Não criar PR-DOCS desnecessária.
- **Bloquear avanço quando:** O contrato ativo não autoriza mais PRs docs e já existem docs suficientes.

---

### `stale_context`

- **Descrição:** A resposta usa informação desatualizada sobre o estado do sistema.
- **Exemplos:** Status de componente desatualizado. Handoff de PR anterior sendo usado como atual. Contrato antigo sendo referenciado como ativo.
- **Severidade padrão:** `medium`
- **Mitigação:** Sempre ler `ENAVIA_STATUS_ATUAL.md` e `ENAVIA_LATEST_HANDOFF.md` antes de afirmar estado.
- **Bloquear avanço quando:** O contexto desatualizado levaria a uma PR incorreta.

---

### `missing_source`

- **Descrição:** A resposta afirma algo sem fonte verificável.
- **Exemplos:** "O sistema tem 12 endpoints" (sem checar registry). "A skill X existe" (sem checar `schema/skills/INDEX.md`). "O teste passou" (sem commit ou log).
- **Severidade padrão:** `medium`
- **Mitigação:** Citar sempre a fonte. Se não há fonte, usar linguagem de incerteza.
- **Bloquear avanço quando:** A falta de fonte compromete uma decisão de PR.

---

### `contract_drift`

- **Descrição:** A ação ou resposta diverge do contrato ativo.
- **Exemplos:** PR proposta não bate com `INDEX.md`. Escopo misturado. Exceção não voltou ao contrato. PR avançou com prova falha.
- **Severidade padrão:** `high`
- **Mitigação:** Consultar `schema/contracts/INDEX.md` antes de propor PR. Parar se houver divergência.
- **Bloquear avanço quando:** A PR proposta não é a próxima autorizada pelo contrato.

---

### `scope_violation`

- **Descrição:** A PR tocou arquivos fora do escopo declarado.
- **Exemplos:** PR Worker-only alterou Panel. PR Docs-only alterou runtime. PR-IMPL sem PR-DIAG anterior obrigatória.
- **Severidade padrão:** `blocking`
- **Mitigação:** Verificar `git diff --name-only` antes de commitar. Reverter se necessário.
- **Bloquear avanço quando:** Sempre.

---

### `regression_risk`

- **Descrição:** A mudança pode quebrar funcionalidade existente que já estava validada.
- **Exemplos:** Alteração em `enavia-cognitive-runtime.js` sem rodar regressões. Mudança em `nv-enavia.js` que afeta rotas existentes.
- **Severidade padrão:** `high`
- **Mitigação:** Sempre rodar regressões completas após qualquer PR-IMPL. Documentar número total de testes antes e depois.
- **Bloquear avanço quando:** Regressões falharam.

---

### `secret_exposure`

- **Descrição:** Segredo, token, KV ID, binding name ou dado sensível foi exposto na resposta ou no código.
- **Exemplos:** API key no código. KV namespace ID no prompt. Binding name exposto na resposta do chat.
- **Severidade padrão:** `blocking`
- **Mitigação:** Nunca incluir segredos em respostas ou commits. Usar variáveis de ambiente e bindings.
- **Bloquear avanço quando:** Sempre.

---

### `runtime_vs_documentation_confusion`

- **Descrição:** A resposta não deixa claro se o componente mencionado é documental (existe apenas em arquivos) ou runtime (existe e executa no Worker).
- **Exemplos:** "O Skill Router executa a skill X" (Skill Router é read-only documental). "A memória foi atualizada" (Brain Loader é read-only). "O Self-Audit bloqueou a resposta" (Self-Audit ainda é documental).
- **Severidade padrão:** `medium`
- **Mitigação:** Sempre marcar claramente: "documental (não executa)", "read-only", "planejado para PR56", etc.
- **Bloquear avanço quando:** A confusão gera falsa capacidade ou ação indevida.
