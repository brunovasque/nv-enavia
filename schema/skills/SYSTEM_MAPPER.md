# ENAVIA Skill — System Mapper

**Versão:** PR28 — 2026-04-30
**Tipo:** Skill supervisionada
**Status:** Ativa — documental
**Contrato de origem:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
**Documentos relacionados:**
- `schema/skills/CONTRACT_LOOP_OPERATOR.md` — primeira skill oficial (PR26)
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — segunda skill oficial (PR27)
- `schema/skills/INDEX.md` — índice de skills
- `schema/system/ENAVIA_SYSTEM_MAP.md` — mapa macro do sistema (PR22)
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — registry de rotas HTTP (PR23)
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — inventário de infraestrutura (PR25)
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` — playbook operacional (PR24)
- `schema/contracts/INDEX.md` — índice de contratos

---

## 1. Identidade da skill

| Atributo | Valor |
|----------|-------|
| **Nome** | System Mapper |
| **Tipo** | Skill supervisionada |
| **Escopo** | Manutenção dos mapas e registries do sistema ENAVIA |
| **Status** | Ativa — documental (PR28) |
| **Primeira versão** | PR28 — 2026-04-30 |
| **Contrato de origem** | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` |
| **Frente** | Skills (PR26–PR29) |
| **Dependências documentais** | PR22, PR23, PR24, PR25, PR26, PR27 |

Esta é a **terceira skill oficial supervisionada** da ENAVIA. Ela governa a manutenção e atualização dos documentos que descrevem o que o sistema tem, onde está, e como cada parte se conecta. Não altera runtime, não altera config, não inventa rota, worker, binding ou estado.

---

## 2. Objetivo

A skill **System Mapper** governa a atualização dos documentos que dizem **o que a ENAVIA tem** e **como o sistema está organizado**. Sua função é manter a documentação fiel ao sistema real — nem mais, nem menos.

A skill orienta quando atualizar:

- **`ENAVIA_SYSTEM_MAP.md`** — visão macro do sistema (componentes, frentes, fluxos).
- **`ENAVIA_ROUTE_REGISTRY.json`** — registry detalhado de rotas HTTP do Worker principal.
- **`ENAVIA_WORKER_REGISTRY.md`** — inventário de workers, bindings, secrets, KV, workflows.
- **`ENAVIA_OPERATIONAL_PLAYBOOK.md`** — procedimentos operacionais.
- **`schema/skills/INDEX.md`** — índice de skills supervisionadas.
- **`schema/status/ENAVIA_STATUS_ATUAL.md`** — estado corrente do repo.
- **`schema/handoffs/ENAVIA_LATEST_HANDOFF.md`** — handoff entre PRs.
- **`schema/execution/ENAVIA_EXECUTION_LOG.md`** — histórico cronológico.
- **`schema/contracts/INDEX.md`** — índice de contratos e próxima PR autorizada.

A skill **orienta e documenta** — não executa scanner automático, não gera registry por parser, não atualiza documentos fora de PR autorizada.

---

## 3. Princípio de mapeamento fiel

> **"Mapa bom não é mapa bonito; é mapa fiel ao sistema real."**

Esta skill opera sob o princípio de que documentação só vale se refletir o sistema real. Todo mapa, registry ou playbook deve ser comparado com a fonte primária antes de ser atualizado.

**Princípios obrigatórios:**

- Mapa não é imaginação — é reflexo do código e da configuração reais.
- Registry não é desejo — é inventário do que existe agora.
- Documentação não pode inventar runtime. Se a rota não existe no código, ela não entra no Route Registry.
- Se uma rota não está no `nv-enavia.js`, não entra no Route Registry como confirmada.
- Se um binding não está no `wrangler.toml` ou template equivalente, não entra como confirmado.
- Se um comportamento não está testado ou comprovado em código, marcar como **não provado**.
- Se algo não está confirmado mas é provável, marcar como `A VERIFICAR`.
- Toda dúvida vira marcação explícita, nunca afirmação imprecisa.

**O que a skill NUNCA faz:**

- Não altera `nv-enavia.js`, `contract-executor.js`, Panel, Executor ou Deploy Worker.
- Não altera `wrangler.toml`, `wrangler.executor.template.toml` ou workflows.
- Não altera secrets, bindings, KV ou env vars.
- Não cria endpoint nem teste.
- Não atualiza documento sem PR autorizada.
- Não inventa rota, worker, binding, secret ou estado.
- Não reescreve documento inteiro sem necessidade real.

**O que a skill PODE fazer:**

- Identificar quais documentos precisam ser atualizados quando algo real muda.
- Recomendar formato e estrutura para cada atualização.
- Marcar incertezas com `A VERIFICAR`.
- Apontar divergências entre documento e código real.
- Sugerir nova skill quando detectar área recorrente que precisa mapa próprio.

---

## 4. Quando ativar esta skill

Acionar **System Mapper** sempre que houver mudança real que deva ser refletida em algum documento de sistema:

**Triggers de runtime:**

- Nova rota HTTP criada no `nv-enavia.js`.
- Rota removida do `nv-enavia.js`.
- Handler alterado (assinatura, comportamento, status retornado).
- Novo worker adicionado ao ecossistema (Deploy Worker, Executor, etc.).
- Binding alterado (KV, Service Binding, Durable Object).
- Novo namespace KV.
- Novo secret ou env var configurado.
- Workflow GitHub Actions criado, alterado ou removido.

**Triggers documentais:**

- Novo contrato ativo.
- Nova skill criada.
- Novo playbook ou procedimento operacional.
- Mudança de estado operacional (frente nova, fase nova).
- Descoberta de divergência entre documento e código real.

**Triggers de operação:**

- Auditoria pede atualização de mapa.
- Operador pergunta: "o que a ENAVIA tem hoje?"
- Operador pergunta: "essa rota existe?"
- Operador pergunta: "esse binding está configurado?"

---

## 5. Quando NÃO ativar esta skill

Não acionar System Mapper em contextos onde outra skill ou frente é responsável:

- **Deploy** — usar **Deploy Governance Operator** (PR27).
- **Rollback** — usar **Deploy Governance Operator** (PR27).
- **Execução do loop contratual** — usar **Contract Loop Operator** (PR26).
- **Alteração de runtime** — exige PR-IMPL própria, fora do escopo desta skill.
- **Criação de endpoint** — exige PR-IMPL própria.
- **Correção de bug** — exige PR-IMPL própria.
- **Decisão de produto** — fora do escopo de qualquer skill documental.
- **Operação sem impacto em documentação sistêmica** — não precisa atualizar mapa.
- **PR que não autoriza docs** — não tocar em documentação fora do escopo.

**Skill/frente adequada para cada caso:**

| Contexto | Skill/frente correta |
|----------|----------------------|
| Loop contratual (execute-next, complete-task, advance-phase) | Contract Loop Operator |
| Deploy TEST/PROD, rollback, promoção | Deploy Governance Operator |
| Aderência ao contrato, validação de PR | Contract Auditor (PR29 — futura) |
| Implementação de runtime | PR-IMPL supervisionada (não é skill) |
| Mapeamento de sistema, registry, playbook | **System Mapper** (esta skill) |

---

## 6. Pré-condições obrigatórias

Antes de mapear ou atualizar qualquer documento de sistema:

1. **Contrato ativo lido** — confirmar em `schema/contracts/INDEX.md` qual contrato está ativo.
2. **Próxima PR autorizada confirmada** — verificar que a PR atual é a autorizada pelo contrato.
3. **Arquivos fonte lidos** — ler todos os arquivos relevantes ao escopo da mudança.
4. **Documento alvo identificado** — saber exatamente qual documento será atualizado.
5. **Evidência real localizada** — apontar a linha de código, config ou contrato que justifica a mudança.
6. **Escopo da PR confirmado** — escopo deve ser `PR-DOCS` ou outra PR autorizada que inclua docs.
7. **Para rotas:** confirmar em `nv-enavia.js` (ou worker correspondente) que a rota existe e está roteada.
8. **Para workers/bindings/KV:** confirmar em `wrangler.toml`, template, workflow ou registry oficial.
9. **Para skills:** confirmar em `schema/skills/INDEX.md` e no arquivo da skill.
10. **Para comportamentos:** confirmar em teste, contrato ou código (não basta intenção).

Se qualquer pré-condição falhar, **parar e reportar antes de alterar documento**.

---

## 7. Documentos sob responsabilidade da skill

| Documento | Função | Quando atualizar | Fonte primária |
|-----------|--------|------------------|----------------|
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Visão macro do sistema (componentes, frentes, fluxos) | Componente novo; frente nova/encerrada; mudança de visão macro | `nv-enavia.js`, contrato ativo, registries |
| `schema/system/ENAVIA_ROUTE_REGISTRY.json` | Registry detalhado de rotas HTTP | Rota nova, removida, alterada (método, path, handler, scope) | `nv-enavia.js` (e workers HTTP, se houver) |
| `schema/system/ENAVIA_WORKER_REGISTRY.md` | Inventário de workers, bindings, secrets, KV, workflows | Worker novo; binding novo; KV novo; secret novo; workflow alterado | `wrangler.toml`, `wrangler.executor.template.toml`, `.github/workflows/`, dashboard Cloudflare |
| `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` | Procedimentos operacionais (rollback, smoke, gates) | Procedimento muda; novo endpoint operacional; nova skill operacional | Skills, registries, contrato ativo |
| `schema/skills/INDEX.md` | Índice de skills supervisionadas | Skill nova mergeada; skill encerrada; skill sugerida aprovada | `schema/skills/*.md` |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Estado corrente do repo | Toda PR mergeada; mudança de estado | PR atual, contrato, registries |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff entre PRs | Toda PR concluída | PR atual, próxima PR autorizada |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Histórico cronológico de execuções | Toda PR concluída | PR atual |
| `schema/contracts/INDEX.md` | Índice de contratos + próxima PR autorizada | Contrato novo/encerrado; próxima PR muda | Contrato ativo |

---

## 8. Regras para atualizar o System Map

`schema/system/ENAVIA_SYSTEM_MAP.md` é o **mapa macro**. Mantém visão geral, não detalhe.

**Atualizar quando:**

- Componente novo surge (worker, módulo, integração).
- Worker, rota ou binding relevante muda a topologia macro.
- Frente nova inicia ou encerra (ex: frente Skills, frente Loop).
- Skill nova muda a visão macro do sistema (referência cruzada).
- Mudança de fluxo macro (entrada/saída, integração externa).

**NÃO usar System Map como:**

- Route registry detalhado (use `ENAVIA_ROUTE_REGISTRY.json`).
- Worker registry detalhado (use `ENAVIA_WORKER_REGISTRY.md`).
- Playbook operacional (use `ENAVIA_OPERATIONAL_PLAYBOOK.md`).

**Manter:**

- Visão macro: o que existe, como se conecta, qual frente cobre.
- Referências cruzadas para os registries detalhados.
- Sem poluir com detalhes repetidos que pertencem a outros documentos.

---

## 9. Regras para atualizar o Route Registry

`schema/system/ENAVIA_ROUTE_REGISTRY.json` é o **registry detalhado** de rotas HTTP do Worker principal.

**Atualizar quando:**

- Rota HTTP nova adicionada no `nv-enavia.js`.
- Rota removida do `nv-enavia.js`.
- Handler de rota alterado (método, status, contrato de input/output).
- Scope/auth/cors de rota muda.

**Cada rota exige os seguintes campos:**

- `method` — método HTTP (GET, POST, etc.).
- `path` — caminho da rota.
- `handler` — nome da função handler no código.
- `scope` — escopo (loop, contracts, panel, exec, ops, etc.).
- `status` — status conhecidos retornados.
- `auth` — autenticação exigida (se houver).
- `cors` — política de CORS aplicada.
- `input` — formato esperado.
- `output` — formato retornado.
- `evidence` — linha/arquivo onde a rota é definida.

**Regras de fidelidade:**

- Rota só entra no registry se existir no `nv-enavia.js` (ou worker HTTP correspondente).
- Rota citada em comentário, help text ou documentação **não basta** — precisa estar roteada.
- Rotas ambíguas devem ter `confidence` adequada (`alta`, `média`, `baixa`) ou marcação `A VERIFICAR`.
- O JSON deve ser válido (parseável) após cada atualização.
- Não inventar nome de handler — usar o nome real da função no código.
- Não duplicar entradas para a mesma rota.

---

## 10. Regras para atualizar o Worker Registry

`schema/system/ENAVIA_WORKER_REGISTRY.md` é o **inventário de infraestrutura**: workers, bindings, secrets, KV, env vars, workflows.

**Atualizar quando:**

- Worker novo adicionado ao ecossistema.
- Binding novo (Service Binding, KV Namespace, Durable Object).
- KV namespace novo.
- Secret ou env var novo configurado.
- Workflow GitHub Actions novo, alterado ou removido.

**Regras de segurança:**

- **Nunca registrar valor de secret.** Usar literalmente: `NUNCA DOCUMENTAR VALOR`.
- Documentar **nome** do secret/env, **escopo** (worker), **fonte de verdade** (wrangler/dashboard) — nunca o conteúdo.
- Separar claramente:
  - **Confirmado** — visto em `wrangler.toml`, workflow ou template oficial.
  - **`A VERIFICAR`** — citado mas não confirmado.
- Não alterar config real (wrangler/template/workflow) — apenas documentar o que existe.
- Se uma fonte divergir da outra (ex: wrangler diz X, workflow diz Y), **documentar conflito explicitamente** e parar antes de marcar como confirmado.

---

## 11. Regras para atualizar o Operational Playbook

`schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` é o **playbook prático** — diz como operar.

**Atualizar quando:**

- Procedimento operacional muda (smoke, rollback, gate, promoção).
- Novo endpoint operacional entra (ex: `/contracts/advance-phase`).
- Nova skill muda a forma de operar (ex: Deploy Governance redefine gate de PROD).
- Rollback, gate ou smoke suite muda.
- Workflow operacional novo.

**Manter:**

- **Prático** — passos executáveis, comandos, links para registries.
- **Não só descritivo** — playbook é instrumento de operação, não enciclopédia.
- Referências cruzadas para registries (rotas, workers) e skills (operadoras).
- Apêndices e exemplos quando ajudarem a evitar erro.

---

## 12. Regras para atualizar Skills Index

`schema/skills/INDEX.md` é o **índice oficial** de skills supervisionadas.

**Atualizar quando:**

- Skill prevista é criada via PR-DOCS aprovada — **mover de "previstas" para "ativas"**.
- Skill nova é sugerida e aprovada para virar PR — **registrar em "sugeridas"**.
- Skill é encerrada ou substituída — **mover para histórico** (criar seção se necessário).

**Regras de fidelidade:**

- **Não marcar skill como ativa sem o arquivo correspondente existir** em `schema/skills/`.
- **Não criar skill nova sem PR própria** (PR-DOCS dedicada).
- Manter relação entre skills (qual depende de qual, qual referencia qual).
- Atualizar a tabela de "Relação com documentos oficiais" quando uma skill nova trouxer novo documento.

---

## 13. Matriz de impacto documental

Quando algo real muda, esta matriz indica quais documentos precisam ser atualizados:

| Mudança real | Documentos a atualizar |
|--------------|------------------------|
| Nova rota HTTP no `nv-enavia.js` | `ENAVIA_ROUTE_REGISTRY.json` (obrigatório) + `ENAVIA_SYSTEM_MAP.md` (se relevante) + `ENAVIA_OPERATIONAL_PLAYBOOK.md` (se operacional) |
| Rota removida | `ENAVIA_ROUTE_REGISTRY.json` + Playbook (se operacional) |
| Novo worker no ecossistema | `ENAVIA_WORKER_REGISTRY.md` + `ENAVIA_SYSTEM_MAP.md` |
| Novo binding (KV, Service Binding) | `ENAVIA_WORKER_REGISTRY.md` + Playbook (se impactar operação) |
| Novo secret ou env var | `ENAVIA_WORKER_REGISTRY.md` (somente nome — `NUNCA DOCUMENTAR VALOR`) |
| Novo workflow GitHub Actions | `ENAVIA_WORKER_REGISTRY.md` + Playbook (se operacional) |
| Novo endpoint do loop contratual | `ENAVIA_ROUTE_REGISTRY.json` + Playbook + referenciar em `CONTRACT_LOOP_OPERATOR.md` (se PR de skill autorizada) |
| Nova skill criada (PR-DOCS) | `schema/skills/INDEX.md` + `ENAVIA_SYSTEM_MAP.md` (se relevante para visão macro) |
| Novo contrato ativo | `schema/contracts/INDEX.md` + `ENAVIA_STATUS_ATUAL.md` + `ENAVIA_LATEST_HANDOFF.md` + `ENAVIA_EXECUTION_LOG.md` |
| Mudança de fase do contrato | `ENAVIA_STATUS_ATUAL.md` + `ENAVIA_LATEST_HANDOFF.md` + `schema/contracts/INDEX.md` (próxima PR) |
| PR mergeada | `ENAVIA_STATUS_ATUAL.md` + `ENAVIA_LATEST_HANDOFF.md` + `ENAVIA_EXECUTION_LOG.md` + `schema/contracts/INDEX.md` |

---

## 14. Procedimento supervisionado de mapeamento

Passo a passo para qualquer atualização de mapa/registry/playbook/skills index:

1. **Identificar mudança real.** Qual código, config ou contrato mudou?
2. **Identificar fonte primária.** Onde está a evidência real (linha de código, arquivo de config, contrato)?
3. **Confirmar evidência.** Ler diretamente a fonte; não confiar em terceiros.
4. **Escolher documento alvo.** Usar a Matriz de Impacto Documental (Seção 13) para escolher quais documentos atualizar.
5. **Atualizar apenas o necessário.** Não reescrever seções inteiras sem motivo.
6. **Marcar incertezas.** Usar `A VERIFICAR` quando algo não puder ser confirmado.
7. **Validar formato.** Para JSON (Route Registry), validar que parseia. Para Markdown, manter estrutura existente.
8. **Atualizar governança.** `STATUS`, `HANDOFF`, `EXECUTION_LOG` e `INDEX.md` quando aplicável.
9. **Registrar próxima PR autorizada.** Atualizar `schema/contracts/INDEX.md` se a PR atual encerra um item do contrato.
10. **Se detectar divergência, parar e documentar.** Não tentar "consertar" o sistema através do mapa — abrir PR-DIAG ou reportar.

---

## 15. Como lidar com divergências

Quando documento e fonte real divergem, esta tabela indica a ação segura:

| Divergência | Ação segura |
|-------------|-------------|
| Rota no Route Registry mas não no `nv-enavia.js` | Marcar como `A VERIFICAR`. Não remover sem PR autorizada. Reportar como bloqueio se for crítica. |
| Rota no `nv-enavia.js` mas não no Route Registry | Adicionar ao registry com evidência (linha/arquivo). Atualizar System Map se relevante. |
| Worker no Worker Registry mas não no `wrangler.toml` ou template | Marcar como `A VERIFICAR`. Investigar se foi removido sem atualização. |
| Secret citado em código mas não confirmado em wrangler/dashboard | Marcar como `A VERIFICAR`. Nunca documentar valor. Reportar como bloqueio se for crítico. |
| Contrato ativo diverge entre `INDEX.md`, `STATUS` e `HANDOFF` | **Parar.** Não atualizar nada de runtime. Reportar inconsistência ao operador. Contrato ativo é fonte de verdade. |
| Skill marcada como ativa em `INDEX.md` mas sem arquivo `schema/skills/*.md` | Marcar como pendente. Se foi erro, abrir PR-DOCS para corrigir o índice. |
| Teste documentado mas inexistente no repo | Marcar como `A VERIFICAR`. Não criar teste fora de PR-PROVA autorizada. |
| Playbook manda ação que Route Registry não confirma | **Parar.** Conferir se rota existe. Atualizar registry primeiro, ou corrigir playbook. |
| Workflow GitHub Actions citado mas inexistente em `.github/workflows/` | Marcar como `A VERIFICAR`. Não criar workflow fora de PR autorizada. |

**Regra geral:** divergência nunca vira atualização silenciosa. Vira marcação explícita ou bloqueio reportado.

---

## 16. Relação com Contract Loop Operator

A skill **Contract Loop Operator** (PR26) usa os mapas mantidos por System Mapper para operar o loop contratual.

**Como se relacionam:**

- Contract Loop Operator **consulta** Route Registry para conhecer endpoints do loop (`/contracts/loop-status`, `/contracts/execute-next`, `/contracts/complete-task`, `/contracts/advance-phase`).
- Contract Loop Operator **consulta** System Map para entender visão macro do loop.
- Se o loop **cria ou usa endpoint novo** (via PR-IMPL autorizada), System Mapper é acionado para atualizar Route Registry e Playbook (em PR-DOCS subsequente).
- Se o loop **muda de comportamento** (novo estado, nova ação), System Mapper atualiza System Map e Playbook quando aplicável.

**Limites:**

- System Mapper **não executa** o loop.
- System Mapper **não decide** próxima ação do loop.
- Contract Loop Operator **não atualiza** mapa/registry/playbook por conta própria — solicita atualização via PR-DOCS.

---

## 17. Relação com Deploy Governance Operator

A skill **Deploy Governance Operator** (PR27) usa Worker Registry e Operational Playbook mantidos por System Mapper.

**Como se relacionam:**

- Deploy Governance **consulta** Worker Registry para validar workers, bindings, secrets, KV e workflows antes de deploy.
- Deploy Governance **consulta** Playbook para procedimentos de rollback, smoke e gates.
- Se o deploy **muda binding, workflow ou worker** (via PR-IMPL autorizada), System Mapper é acionado para atualizar Worker Registry (em PR-DOCS subsequente).
- Se o deploy **introduz novo gate ou rollback**, System Mapper atualiza Playbook quando aplicável.

**Limites:**

- System Mapper **não executa** deploy.
- System Mapper **não promove** PROD nem aprova rollback.
- Deploy Governance **não atualiza** registry por conta própria — solicita atualização via PR-DOCS.

---

## 18. Relação com Contract Auditor (PR29 — futura)

A skill **Contract Auditor**, prevista para PR29, validará aderência ao contrato ativo.

**Como se relacionarão:**

- Contract Auditor **consultará** os mapas e registries mantidos por System Mapper para validar se o sistema documentado corresponde ao contrato.
- Contract Auditor **poderá apontar** divergências documentais (ex: contrato exige rota X que não está no Route Registry).
- Contract Auditor **poderá pedir** correção documental via PR-DOCS, executada sob a skill System Mapper.
- System Mapper **não julga** mérito contratual final — apenas atualiza o mapa com base em evidência real, sem interpretar contrato além do que está escrito.

**Limites:**

- System Mapper **não decide** se uma PR está aderente ao contrato (isso é função do Contract Auditor).
- Contract Auditor **não atualiza** mapa diretamente — abre solicitação para PR-DOCS sob System Mapper.

---

## 19. Critérios para sugerir nova skill

System Mapper pode sugerir nova skill quando detectar:

- **Área recorrente que precisa mapa próprio** — domínio com manutenção frequente que pesa sobre uma skill genérica.
- **Documentação muito complexa** — registry/playbook que cresceu além do gerenciável por uma skill.
- **Fonte externa importante** — integração com sistema externo que merece skill dedicada (ex: Cloudflare API, GitHub API).
- **Divergências recorrentes** — área onde mapa e código divergem repetidas vezes (sintoma de falta de operador especializado).
- **Necessidade de operador especializado** — domínio com regras próprias que precisam ser documentadas em skill própria.
- **Risco de drift documental** — área onde a documentação tende a desatualizar rápido.

**Template de sugestão:**

```
Nome: <nome proposto da skill>
Problema: <qual lacuna ela cobre>
Documento afetado: <quais mapas/registries/playbooks ela governará>
Fonte: <fonte primária de verdade>
Risco: <o que acontece se não for criada>
Por que uma skill própria: <por que não cobrir com skill existente>
Tipo de PR recomendado: PR-DOCS
Prioridade: alta | média | baixa
Próxima ação segura: <abrir PR-DOCS dedicada após aprovação>
```

A sugestão deve ser registrada em `schema/skills/INDEX.md` na seção "Skills sugeridas" antes de virar PR.

---

## 20. Exemplos de uso

**Exemplo 1 — Nova rota adicionada ao `nv-enavia.js`:**

> Operador: "Adicionei `POST /contracts/advance-phase` no Worker. Atualize a documentação."
>
> System Mapper:
> 1. Confirma a rota existe em `nv-enavia.js` (linha X).
> 2. Adiciona entrada em `ENAVIA_ROUTE_REGISTRY.json` com método, path, handler, scope, status, evidence.
> 3. Atualiza `ENAVIA_OPERATIONAL_PLAYBOOK.md` se rota for operacional.
> 4. Não atualiza System Map, exceto se mudar visão macro.
> 5. Atualiza governança (status, handoff, execution log).

**Exemplo 2 — Binding alterado no `wrangler.toml`:**

> Operador: "Adicionei o KV namespace `CONTRACT_AUDIT_KV` ao Worker."
>
> System Mapper:
> 1. Confirma o binding em `wrangler.toml`.
> 2. Adiciona ao `ENAVIA_WORKER_REGISTRY.md` na seção de KV namespaces, marcando como confirmado.
> 3. Atualiza Playbook se o binding tem implicação operacional.
> 4. Não documenta valor (ID do KV pode ser citado, secret nunca).

**Exemplo 3 — Skill nova criada (PR-DOCS aprovada):**

> Operador: "PR29 mergeada — criou Contract Auditor."
>
> System Mapper:
> 1. Move `Contract Auditor` de "previstas" para "ativas" em `schema/skills/INDEX.md`.
> 2. Atualiza System Map se a skill muda visão macro.
> 3. Atualiza governança (status, handoff, execution log, INDEX de contratos com próxima PR autorizada).

**Exemplo 4 — Playbook ficou desatualizado:**

> Operador: "O playbook ainda fala em `/exec/run` mas agora é `/exec/start`."
>
> System Mapper:
> 1. Confirma a rota correta em `nv-enavia.js` e Route Registry.
> 2. Atualiza `ENAVIA_OPERATIONAL_PLAYBOOK.md` substituindo a rota antiga pela nova com evidência.
> 3. Marca a mudança em governança.

**Exemplo 5 — Registry diverge do código:**

> Auditor (futuro): "Route Registry tem `GET /panel/legacy` mas não acho no `nv-enavia.js`."
>
> System Mapper:
> 1. **Não remove** a entrada automaticamente.
> 2. Marca como `A VERIFICAR` no registry com nota de divergência.
> 3. Reporta bloqueio para o operador decidir: rota foi removida (atualizar registry) ou rota deveria existir (PR-IMPL).

**Exemplo 6 — Operador pergunta "o que existe hoje?":**

> Operador: "Quantas rotas a ENAVIA tem? Quais workers estão ativos?"
>
> System Mapper:
> 1. Responde com base em `ENAVIA_ROUTE_REGISTRY.json` (contagem + lista por scope).
> 2. Responde com base em `ENAVIA_WORKER_REGISTRY.md` (workers confirmados + a verificar).
> 3. Aponta diferenças entre confirmado e `A VERIFICAR`.
> 4. Não inventa nada que não esteja documentado.

---

## 21. Segurança e limites

**A skill nunca:**

- Altera runtime (`nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker).
- Altera config (`wrangler.toml`, `wrangler.executor.template.toml`, workflows).
- Altera secrets, bindings ou KV (nem documenta valor de secret).
- Inventa fonte primária — se não há evidência, marca como `A VERIFICAR`.
- Apaga histórico (execution log é cumulativo).
- Reescreve documento inteiro sem necessidade real.
- Transforma mapeamento em implementação (não cria código).
- Atualiza docs sem PR autorizada (todo update passa por PR-DOCS).
- Cria endpoint, teste ou workflow.
- Implementa parser automático ou scanner — atualizações são manuais e supervisionadas.

**A skill sempre:**

- Confirma evidência antes de afirmar.
- Marca incertezas explicitamente.
- Atualiza governança após cada PR concluída.
- Mantém escopo `PR-DOCS` (não mistura com Worker, Panel, Executor, Deploy).
- Aponta divergências sem corrigir runtime silenciosamente.

---

## 22. Itens opcionais — não mexer agora

> **Isso é opcional. Não mexa agora.**

A lista abaixo descreve melhorias que **não devem ser implementadas** sob esta skill nem nesta frente. São registradas apenas como visão futura:

- Gerador automático de Route Registry a partir do `nv-enavia.js` (parser de rotas).
- Scanner automático de workers a partir de `wrangler.toml` e workflows.
- Endpoint `/system/map` que retorna o System Map em JSON.
- UI de mapas no Panel (visualização de rotas/workers).
- Validação automática de divergências entre código e registry.
- Auto-sync entre docs e runtime (qualquer mecanismo automático).
- Bot de atualização documental (PR automática quando código muda).
- Integração com graph database para representar relações entre componentes.
- Documentação visual interativa (diagramas auto-gerados).

Cada um desses itens, se aprovado no futuro, exigirá PR-DIAG → PR-IMPL → PR-PROVA própria, fora do escopo desta skill documental.

---

## 23. Checklist final da skill

Antes de encerrar qualquer atualização sob esta skill, confirmar:

- [ ] Fonte real identificada (linha de código, arquivo de config, contrato).
- [ ] Documento correto escolhido (via Matriz de Impacto — Seção 13).
- [ ] Escopo `PR-DOCS` confirmado (sem mistura com Worker/Panel/Executor/Deploy).
- [ ] Nenhum runtime alterado (`nv-enavia.js`, `contract-executor.js`, Panel, Executor, Deploy Worker, workflows, `wrangler.toml`).
- [ ] Nenhum secret, binding, KV ou env var alterado.
- [ ] Incertezas marcadas com `A VERIFICAR`.
- [ ] Formato validado (JSON parseável para Route Registry; Markdown consistente para os demais).
- [ ] Governança atualizada (`STATUS`, `HANDOFF`, `EXECUTION_LOG`, `schema/contracts/INDEX.md`).
- [ ] Próxima PR autorizada registrada em `schema/contracts/INDEX.md`.
- [ ] Se sugeriu nova skill, registrou como sugestão em `schema/skills/INDEX.md` (sem marcar como ativa).
- [ ] Divergências detectadas foram documentadas, não corrigidas silenciosamente.
- [ ] Resposta final em `WORKFLOW_ACK: ok` com resumo, branch, commit, governança e bloqueios.
