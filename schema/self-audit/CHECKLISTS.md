# Self-Audit Framework — Checklists

> **Status:** Documental. Estes checklists definem o que o Self-Audit deve verificar futuramente.
> Não são executados automaticamente nesta PR.

---

## Checklist A — Antes de responder

Usar antes de entregar qualquer resposta ao usuário.

- [ ] **A1** — A intenção foi classificada corretamente? (`intent_classification` presente e coerente com a mensagem?)
- [ ] **A2** — Existe contexto recuperado pelo retrieval? (`intent_retrieval` aplicado quando relevante?)
- [ ] **A3** — Há risco de falsa capacidade na resposta? (a resposta afirma algo que o sistema não faz realmente?)
- [ ] **A4** — Há risco de modo operacional indevido? (a intenção é `conversation` mas a resposta está em modo pesado?)
- [ ] **A5** — A mensagem contém pedido de execução? (se sim, há gate? há aprovação humana?)
- [ ] **A6** — Há necessidade de dizer "não sei" ou "incerto"? (prefira honestidade a afirmação inventada)
- [ ] **A7** — A resposta é natural ou parece um relatório? (evite checklists onde prosa seria mais adequada)
- [ ] **A8** — Há informação sensível na resposta? (segredos, KV IDs, bindings internos — não expor)

---

## Checklist B — Antes de sugerir a próxima PR

Usar antes de propor qualquer próxima PR ao usuário.

- [ ] **B1** — O contrato ativo foi consultado? (`schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` lido?)
- [ ] **B2** — A PR anterior exigida está validada e mergeada?
- [ ] **B3** — Existe exceção corretiva pendente que deve ser resolvida antes?
- [ ] **B4** — A próxima PR proposta bate com `schema/contracts/INDEX.md`?
- [ ] **B5** — O prompt da PR está completo? (objetivo, escopo, tipo, contrato ativo, PR anterior, arquivos, smoke tests, rollback)
- [ ] **B6** — A resposta usa o formato: resumo curto + prompt completo? (não só resumo, não só prompt)
- [ ] **B7** — A PR proposta mistura escopos? (Worker + Docs na mesma PR é proibido)
- [ ] **B8** — É PR-IMPL sem PR-DIAG anterior obrigatória? (se sim, bloquear)

---

## Checklist C — Ao revisar PR

Usar ao avaliar se uma PR foi executada corretamente.

- [ ] **C1** — Os arquivos alterados batem com o escopo declarado da PR?
- [ ] **C2** — Arquivos proibidos foram tocados? (checar lista de proibidos do contrato)
- [ ] **C3** — Testes foram rodados? (smoke tests passaram?)
- [ ] **C4** — Regressões passaram? (total de testes anterior está verde?)
- [ ] **C5** — Governança foi atualizada? (status, handoff, execution log, INDEX.md)
- [ ] **C6** — Há falsa conclusão de sucesso? (a PR diz "feito" mas evidência está faltando?)
- [ ] **C7** — O relatório da PR foi criado em `schema/reports/`?
- [ ] **C8** — O tipo da PR (PR-IMPL, PR-DOCS, PR-DIAG, PR-PROVA) foi declarado e respeitado?

---

## Checklist D — Ao falar sobre skills

Usar ao mencionar ou discutir qualquer skill da Enavia.

- [ ] **D1** — A skill é documental ou runtime? (documentais existem em `schema/skills/`, runtime precisaria de `/skills/run`)
- [ ] **D2** — `/skills/run` existe? (confirmado: NÃO existe. Não afirmar que existe.)
- [ ] **D3** — Houve execução real de alguma skill? (se não, não afirmar que a skill foi executada)
- [ ] **D4** — O warning `read_only` está presente na resposta quando a skill é documental? (usuário deve saber a limitação)
- [ ] **D5** — Há risco de o usuário entender que uma skill foi executada quando não foi?
- [ ] **D6** — O campo `skill_routing` no response representa o que realmente aconteceu?

---

## Checklist E — Ao falar sobre o sistema

Usar ao fazer afirmações sobre estado, componentes ou capacidades do sistema.

- [ ] **E1** — A fonte da informação é um arquivo real? (mapa, registry, status, handoff, log — não inventar)
- [ ] **E2** — O estado descrito é documental ou runtime real? (deixar claro a diferença)
- [ ] **E3** — Há incerteza sobre o estado? (se sim, declarar a incerteza — não afirmar certeza)
- [ ] **E4** — É necessário diagnóstico antes de afirmar? (estado runtime precisa de PR-DIAG, não de suposição)
- [ ] **E5** — A informação está desatualizada? (checar data dos arquivos de governança)
- [ ] **E6** — O componente mencionado existe no sistema atual ou é planejado? (marcar claramente)

---

## Checklist F — Ao falar sobre deploy/execução

Usar ao qualquer menção de deploy, execução, escrita em produção ou ação real.

- [ ] **F1** — Existe aprovação humana explícita para esta ação?
- [ ] **F2** — O ambiente de teste foi separado do ambiente de produção?
- [ ] **F3** — Existe plano de rollback documentado?
- [ ] **F4** — Existe gate de execução ativo? (`read_only` como bloqueio de execução)
- [ ] **F5** — O endpoint/worker/binding envolvido foi confirmado como existente?
- [ ] **F6** — A ação de deploy está dentro do contrato ativo?
- [ ] **F7** — O workflow de deploy existe e foi validado?
- [ ] **F8** — Nenhum segredo será exposto no processo?
