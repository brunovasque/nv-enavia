# ENAVIA Skill — Contract Auditor

**Versão:** PR29 — 2026-04-30
**Tipo:** Skill supervisionada
**Status:** Ativa — documental
**Contrato de origem:** `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md`
**Documentos relacionados:**
- `schema/skills/CONTRACT_LOOP_OPERATOR.md` — primeira skill oficial (PR26)
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — segunda skill oficial (PR27)
- `schema/skills/SYSTEM_MAPPER.md` — terceira skill oficial (PR28)
- `schema/system/ENAVIA_SYSTEM_MAP.md` — mapa macro do sistema (PR22)
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — registry de 68 rotas HTTP (PR23)
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` — playbook operacional (PR24)
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — inventário de infraestrutura (PR25)
- `schema/contracts/active/CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` — contrato ativo
- `schema/contracts/INDEX.md` — índice de contratos

---

## 1. Identidade da skill

| Atributo | Valor |
|----------|-------|
| **Nome** | Contract Auditor |
| **Tipo** | Skill supervisionada |
| **Escopo** | Auditoria de aderência contratual |
| **Status** | Ativa — documental (PR29) |
| **Primeira versão** | PR29 — 2026-04-30 |
| **Contrato de origem** | `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` |
| **Frente** | Skills (PR26–PR29) |
| **Dependências documentais** | PR22, PR23, PR24, PR25, PR26, PR27, PR28 |

Esta skill é a **quarta skill oficial supervisionada** da ENAVIA. Ela audita aderência contratual de PRs, tarefas e execuções, mas não executa, corrige, faz deploy nem altera documentos automaticamente.

---

## 2. Objetivo

A skill **Contract Auditor** valida se uma PR, tarefa ou execução está aderente ao contrato ativo e à governança do repositório.

Ela responde às seguintes perguntas de auditoria:

- A PR está na **ordem correta** segundo o contrato?
- O **tipo da PR** está correto (PR-DIAG, PR-IMPL, PR-PROVA, PR-DOCS)?
- O **escopo declarado** bate com os arquivos realmente alterados?
- O **runtime foi alterado indevidamente** por uma PR que não deveria alterar?
- A **governança foi atualizada** (status, handoff, execution log, INDEX)?
- Os **testes/provas foram executados** e são compatíveis com o escopo?
- O **rollback está documentado** com comando e impacto?
- A **próxima PR autorizada** está correta no INDEX?
- A **PR pode seguir para merge** ou precisa de correção antes?

A skill **audita** — não executa, não corrige e não aprova autonomamente. Toda decisão final de merge ou produção requer aprovação explícita do operador humano.

---

## 3. Princípio de auditoria justa e firme

> **"Auditoria boa não é a que bloqueia tudo; é a que separa risco real de ruído."**

Esta skill opera sob os seguintes princípios:

**Firmeza — o auditor bloqueia quando há violação real:**
- Runtime alterado por PR que não deveria alterar.
- PR fora de ordem contratual sem justificativa.
- Testes ausentes em PR-IMPL ou PR-PROVA.
- Produção promovida sem aprovação humana explícita.
- Secret ou binding exposto.

**Justiça — o auditor não inventa problema:**
- Divergência documental de baixa gravidade não é bloqueio; é pedido de correção.
- PR-DOCS com pequena inconsistência textual não bloqueia merge automaticamente.
- Ausência de item opcional não é violação de contrato.
- Auditoria não exige perfeição cosmética — exige aderência ao contrato ativo.

**Limites do auditor:**
- Não corrige automaticamente.
- Não aprova merge por conta própria.
- Não atualiza governança nem mapas diretamente.
- Não inventa violação onde não há evidência.
- Não ignora evidência de violação real.

---

## 4. Quando ativar esta skill

Ativar o Contract Auditor nos seguintes cenários:

- Usuário envia link de PR para revisão antes do merge.
- PR nova foi aberta e precisa de revisão contratual.
- Antes de merge — validar aderência ao contrato ativo.
- Após correção do Copilot/Claude — validar se a correção respeitou o escopo.
- Quando há dúvida se a PR respeitou o contrato ativo.
- Quando arquivos alterados parecem fora do escopo declarado.
- Quando smoke tests não correspondem ao escopo da PR.
- Quando governança (status, handoff, execution log) parece inconsistente.
- Quando a próxima PR autorizada parece ter mudado sem registro.
- Quando uma nova skill ou documento foi criado — validar cobertura documental.
- Quando deploy ou rollback foi solicitado — validar se segue o contrato.
- Quando existe conflito entre contrato, status, handoff e execution log.
- Quando o operador suspeita de drift contratual acumulado.
- Quando uma fase foi declarada completa — validar se todas as PRs da fase foram concluídas.

---

## 5. Quando NÃO ativar esta skill

Não ativar o Contract Auditor nestes cenários — use a skill ou frente adequada:

| Cenário | Skill/frente adequada |
|---------|----------------------|
| Executar o loop contratual (execute-next, complete-task, advance-phase) | Contract Loop Operator (PR26) |
| Decidir se deploy pode ir para PROD ou TEST | Deploy Governance Operator (PR27) |
| Atualizar System Map, Route Registry, Worker Registry, Playbook ou Skills Index | System Mapper (PR28) |
| Diagnóstico técnico profundo de bug sem objetivo de auditoria contratual | PR-DIAG independente |
| Criar nova skill sem contexto de auditoria | PR-DOCS via contrato |
| Gerar patch de código | PR-IMPL supervisionada |
| Corrigir comportamento de runtime | PR-IMPL supervisionada |

O Contract Auditor não substitui o loop contratual, o processo de deploy nem o mapeamento de sistema. Ele avalia **aderência** — não executa nem corrige.

---

## 6. Pré-condições obrigatórias

Antes de iniciar qualquer auditoria, verificar:

1. **Contrato ativo lido** — `schema/contracts/active/` + `schema/contracts/INDEX.md`.
2. **INDEX.md lido** — identificar a próxima PR autorizada.
3. **Status atual lido** — `schema/status/ENAVIA_STATUS_ATUAL.md`.
4. **Handoff lido** — `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`.
5. **Execution log lido** — `schema/execution/ENAVIA_EXECUTION_LOG.md`.
6. **PR anterior validada confirmada** — não auditar PR sem saber qual foi a anterior.
7. **Tipo de PR identificado** — PR-DIAG, PR-IMPL, PR-PROVA ou PR-DOCS.
8. **Arquivos alterados listados** — diff ou resumo com evidência.
9. **Critérios de aceite da PR localizados** — no contrato ativo ou na descrição da PR.
10. **Testes/verificações informados** — quais foram executados e qual resultado.
11. **Rollback informado** — comando e impacto declarados.
12. **Próxima PR autorizada identificada** — verificar se o INDEX aponta corretamente.

Se alguma pré-condição não puder ser atendida, declarar bloqueio antes de auditar.

---

## 7. Entradas esperadas

O auditor recebe os seguintes inputs para análise:

| Input | Obrigatório | Descrição |
|-------|-------------|-----------|
| Link da PR | Sim | URL da PR no GitHub |
| Número da PR | Sim | Número sequencial (ex: PR29) |
| Branch | Sim | Nome da branch (ex: `claude/pr29-...`) |
| Commit | Sim | Hash do commit principal |
| Tipo de PR | Sim | PR-DIAG, PR-IMPL, PR-PROVA, PR-DOCS |
| Contrato ativo | Sim | Nome do arquivo do contrato |
| PR anterior | Sim | Número e status (mergeada/pendente) |
| Arquivos alterados | Sim | Lista de arquivos do diff |
| Diff | Recomendado | Resumo ou texto completo do diff |
| Descrição da PR | Sim | Objetivo, escopo, testes, rollback |
| Smoke tests | Sim | Comandos executados e resultados |
| Evidências | Recomendado | Logs, screenshots, saídas de teste |
| Rollback | Sim | Comando e impacto declarados |
| Status/handoff/execution log | Sim | Estado atual da governança |
| Comentário do Copilot/Claude | Opcional | Resposta automatizada na PR |
| Bloqueios declarados | Opcional | Impedimentos conhecidos |

---

## 8. Saídas esperadas

O auditor produz os seguintes outputs:

| Output | Descrição |
|--------|-----------|
| **Decisão** | Pode mergear / Precisa correção / Bloquear / Pedir diagnóstico / Pedir prova |
| **Resumo de aderência** | Avaliação geral da PR contra o contrato |
| **Violações encontradas** | Lista com severidade (BLOCKER, HIGH, MEDIUM, LOW, INFO) |
| **Risco** | Avaliação de risco geral (alto/médio/baixo) |
| **Correção recomendada** | O que deve ser corrigido antes do merge |
| **Comentário pronto para PR** | Texto formatado para colar como comentário na PR |
| **Próxima PR autorizada** | Confirmação ou correção do que o INDEX aponta |
| **Checklist final** | Checklist preenchido de aderência contratual |

---

## 9. Matriz de auditoria por tipo de PR

| Tipo de PR | O que deve alterar | O que não pode alterar | Evidência mínima |
|-----------|-------------------|------------------------|-----------------|
| **PR-DIAG** | Apenas documentos de diagnóstico/análise (nenhum runtime) | `.js`, `.ts`, `.toml`, `.yml`, runtime, dados | Relatório de análise com arquivos e âncoras identificados; pré-condição para PR-IMPL quando exigida pelo contrato |
| **PR-IMPL** | Runtime (`.js`, `.ts`) e/ou configuração (`.toml`, `.yml`) conforme escopo | Arquivos fora do escopo declarado; documentos de outra frente | Diagnóstico anterior confirmado (quando exigido); smoke tests executados; rollback documentado; governança atualizada |
| **PR-PROVA** | Arquivos de teste (`.test.js`, `.spec.ts`, etc.) e documentação de prova | Runtime, lógica de negócio, configuração de deploy | Testes passando; cobertura compatível com o escopo; nenhum comportamento de runtime alterado |
| **PR-DOCS** | Apenas arquivos `schema/` e documentação (`docs/`, `README`) | `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml`, runtime | Verificação de estrutura/arquivos; frase obrigatória presente (quando exigida); referências corretas; governança atualizada |

**Regras gerais:**
- PR-DIAG não altera runtime — qualquer alteração em `.js`/`.ts`/`.toml`/`.yml` é BLOCKER.
- PR-DOCS não altera runtime — qualquer alteração em `.js`/`.ts`/`.toml`/`.yml` é BLOCKER.
- PR-PROVA não corrige comportamento de runtime — apenas prova o que já existe.
- PR-IMPL deve ter diagnóstico anterior quando o contrato exigir — sem diagnóstico é BLOCKER.
- PR-IMPL deve ter prova/regressão compatível com o escopo.
- Qualquer PR deve atualizar governança quando o contrato exige — omissão é HIGH.

---

## 10. Checklist de aderência contratual

Usar este checklist em toda auditoria:

- [ ] **Contrato ativo correto** — a PR referencia o contrato certo?
- [ ] **Próxima PR correta** — o INDEX.md aponta esta PR como a próxima autorizada?
- [ ] **PR anterior validada** — a PR anterior exigida está concluída (mergeada ou confirmada)?
- [ ] **Tipo da PR correto** — PR-DIAG, PR-IMPL, PR-PROVA ou PR-DOCS, conforme o contrato?
- [ ] **Escopo respeitado** — nenhuma frente misturada (Worker, Panel, Executor, Docs)?
- [ ] **Arquivos alterados compatíveis** — diff bate com o tipo e escopo declarados?
- [ ] **Runtime alterado apenas se permitido** — PR-DIAG/PR-DOCS não alteram `.js`/`.ts`/`.toml`/`.yml`?
- [ ] **Testes/verificações compatíveis** — executados, passando e compatíveis com o escopo?
- [ ] **Rollback documentado** — comando correto, impacto declarado?
- [ ] **Governança atualizada** — status, handoff, execution log e INDEX atualizados?
- [ ] **INDEX aponta próxima PR correta** — a próxima PR autorizada está corretamente registrada?
- [ ] **Nenhuma autonomia cega** — nenhuma ação automática sem aprovação humana?
- [ ] **Nenhuma produção sem aprovação** — PROD bloqueado sem gate humano?

---

## 11. Auditoria de arquivos alterados

Regras de verificação para arquivos alterados:

**Bloqueios imediatos (BLOCKER):**
- Se PR-DOCS alterar `.js`, `.ts`, `.jsx`, `.tsx`, `.toml`, `.yml` → **bloquear**.
- Se PR-PROVA alterar runtime (lógica de negócio em `.js`/`.ts`) → **bloquear**.
- Se PR-DIAG alterar runtime → **bloquear**.
- Se PR-IMPL alterar arquivo de outra frente sem justificativa no contrato → **bloquear**.

**Alto risco (HIGH):**
- Se qualquer PR alterar arquivo de workflow (`.github/workflows/`) → tratar como **alto risco**, exigir revisão adicional.
- Se qualquer PR alterar `wrangler.toml`, `wrangler.executor.template.toml`, bindings ou secrets → tratar como **alto risco**, exigir diagnóstico específico.

**Exigência de diagnóstico específico:**
- Se alterar KV, migrations ou dados persistentes → exigir PR-DIAG específica de dados antes de PR-IMPL.

**Pedido de correção (MEDIUM):**
- Se PR-IMPL alterar documentação sem atualizar governança → pedir correção.
- Se arquivos alterados incluem itens inesperados que não estão no escopo declarado → pedir justificativa.

---

## 12. Auditoria de governança

Validar os seguintes arquivos em toda auditoria:

| Arquivo | O que verificar |
|---------|----------------|
| `schema/contracts/INDEX.md` | Próxima PR autorizada correta; contrato ativo correto |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | Data atualizada; branch correta; última tarefa correta |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Handoff aponta PR correta; lista arquivos alterados; registra próxima ação |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | Bloco da PR no topo; escopo correto; arquivos alterados listados |
| `schema/skills/INDEX.md` | Atualizado quando PR envolve criação/alteração de skill |
| Próximo passo autorizado | Coerente entre INDEX, status e handoff |
| Histórico recente | PR anterior registrada como concluída |
| PR anterior mergeada | Confirmado por commit merge ou PR mergeada |

Se qualquer desses arquivos não foi atualizado quando deveria ter sido → classificar como HIGH.
Se a governança contradiz o diff real → classificar como HIGH ou BLOCKER conforme gravidade.

---

## 13. Auditoria de testes e provas

Regras por tipo de PR:

| Tipo | Exigência mínima | Falha → ação |
|------|-----------------|--------------|
| **PR-DOCS** | Verificações de arquivo/estrutura (ex: `grep`, `git diff --name-only`) | Se não executado → pedir execução antes do merge |
| **PR-PROVA** | Teste/prova real com resultado documentado (ex: `npm test`, suite de smoke) | Se teste falhou → bloquear merge |
| **PR-IMPL** | Smoke tests compatíveis com o escopo + regressão quando disponível | Se teste falhou → bloquear merge; se não executado → pedir execução |
| **PR-DIAG** | Nenhum teste de runtime exigido; apenas análise documentada | Se análise ausente → pedir complementação |

**Regras gerais de testes:**
- Se teste falhou → bloquear merge independentemente do tipo de PR.
- Se teste não foi executado em PR-IMPL ou PR-PROVA → pedir execução antes de aprovação.
- Se teste não corresponde ao escopo (ex: teste de outra frente) → pedir ajuste ou justificativa.
- Se número de testes citado na PR diverge da governança → pedir consistência.

---

## 14. Auditoria de rollback

Validar rollback em toda PR que altere runtime ou produção:

| Cenário | Exigência |
|---------|-----------|
| PR-DOCS sem alteração de runtime | Rollback por revert do commit é suficiente — sem exigência adicional |
| PR-IMPL com alteração de runtime | Rollback com comando documentado + smoke pós-revert |
| PR com alteração de KV ou dados persistentes | Rollback **não pode ser automático** sem diagnóstico prévio de impacto em dados |
| PR de deploy/produção | Rollback exige gate humano antes da execução |
| PR-PROVA (apenas testes) | Rollback por revert é suficiente |

**Verificações de rollback:**
- Rollback existe e está documentado.
- Comando está correto e executável.
- Impacto do rollback está declarado (o que reverterá, o que pode não reverter).
- Se runtime foi alterado → smoke pós-revert exigido.
- Se KV/dados foram alterados → diagnóstico específico antes de qualquer rollback automático.

---

## 15. Auditoria de segurança

Verificar em toda PR:

- [ ] **Nenhum secret exposto** — tokens, chaves, senhas não aparecem no diff.
- [ ] **Nenhuma produção sem aprovação explícita** — PROD requer gate humano.
- [ ] **Nenhum bypass de gate** — fluxos de aprovação não podem ser contornados.
- [ ] **Nenhum relaxamento de auth** — validação de autenticação não pode ser enfraquecida.
- [ ] **Nenhum CORS inseguro novo** — headers CORS não podem abrir acesso irrestrito sem justificativa.
- [ ] **Nenhum endpoint administrativo sem guard** — endpoints de administração requerem autenticação.
- [ ] **Nenhuma alteração de binding/secret sem diagnóstico** — bindings e secrets são alto risco.
- [ ] **Nenhuma autonomia cega** — nenhuma ação de produção ou deploy sem aprovação humana.

Qualquer violação de segurança é automaticamente classificada como **BLOCKER**.

---

## 16. Critérios de severidade

| Nível | Significado | Ação exigida |
|-------|-------------|--------------|
| **BLOCKER** | Violação crítica — não pode mergear | Bloquear merge; pedir correção obrigatória antes de qualquer revisão futura |
| **HIGH** | Problema sério — precisa correção antes do merge | Solicitar correção; não recomendar merge até resolução |
| **MEDIUM** | Divergência documental ou inconsistência de baixa gravidade | Solicitar ajuste; merge pode aguardar correção documental |
| **LOW** | Observação técnica ou melhoria opcional | Registrar; não bloqueia; deixar para o operador decidir |
| **INFO** | Nota informacional sem impacto de compliance | Registrar para histórico; sem ação exigida |

**Exemplos por severidade:**

| Severidade | Exemplo |
|-----------|---------|
| BLOCKER | PR-DOCS alterou `nv-enavia.js` |
| BLOCKER | PR-IMPL sem diagnóstico anterior obrigatório |
| BLOCKER | Secret exposto no diff |
| BLOCKER | Deploy para PROD sem aprovação humana |
| BLOCKER | Teste falhou e PR-IMPL quer mergear |
| HIGH | Governança não atualizada (status/handoff/log ausentes) |
| HIGH | PR fora de ordem contratual sem justificativa |
| HIGH | Rollback ausente em PR-IMPL com alteração de runtime |
| MEDIUM | Frase obrigatória ausente em skill PR-DOCS |
| MEDIUM | INDEX aponta PR errada como próxima |
| LOW | Comentário de código inconsistente com escopo |
| INFO | Arquivo opcional não criado |

---

## 17. Relação com Contract Loop Operator

`schema/skills/CONTRACT_LOOP_OPERATOR.md` — PR26

O Contract Auditor **não executa o loop contratual**. Essa é a responsabilidade exclusiva do Contract Loop Operator.

| Responsabilidade | Contract Auditor | Contract Loop Operator |
|-----------------|-----------------|----------------------|
| Executar execute-next | ❌ | ✅ |
| Executar complete-task | ❌ | ✅ |
| Executar advance-phase | ❌ | ✅ |
| Validar se o loop foi respeitado | ✅ | ❌ |
| Verificar se execute-next/complete-task/advance-phase estão documentados | ✅ | ❌ |
| Verificar se ações do loop estão provadas | ✅ | ❌ |
| Orientar próxima ação segura no loop | ❌ | ✅ |

**Quando encaminhar para Contract Loop Operator:**
- Quando o problema detectado pelo auditor é operacional do loop (ex: ação bloqueada, endpoint retornando estado errado, fase não avançou).
- Quando a auditoria identifica que o loop precisa ser executado antes do merge.
- Quando a documentação da PR cita execute-next/complete-task/advance-phase e há dúvida sobre execução real.

---

## 18. Relação com Deploy Governance Operator

`schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — PR27

O Contract Auditor **não decide deploy** nem executa rollback. Essa é a responsabilidade do Deploy Governance Operator.

| Responsabilidade | Contract Auditor | Deploy Governance Operator |
|-----------------|-----------------|--------------------------|
| Decidir se PR vai para TEST | ❌ | ✅ |
| Decidir se PR vai para PROD | ❌ | ✅ |
| Executar rollback | ❌ | ✅ |
| Validar se deploy/rollback respeitou contrato | ✅ | ❌ |
| Verificar se PROD foi aprovado por humano | ✅ | ❌ |
| Bloquear PROD sem aprovação | ✅ (recomendação) | ✅ (execução) |
| Auditar aderência de PR de deploy ao contrato | ✅ | ❌ |

**Quando encaminhar para Deploy Governance Operator:**
- Quando a auditoria identifica que o deploy precisa ser avaliado para TEST ou PROD.
- Quando rollback precisa ser executado após violação identificada.
- Quando há dúvida se o ambiente de destino (TEST/PROD) é adequado para a PR.

**Regra inegociável:** PROD sem aprovação humana é sempre **BLOCKER**.

---

## 19. Relação com System Mapper

`schema/skills/SYSTEM_MAPPER.md` — PR28

O Contract Auditor **não atualiza mapas diretamente**. Se identificar divergência documental, deve recomendar PR-DOCS via System Mapper.

| Responsabilidade | Contract Auditor | System Mapper |
|-----------------|-----------------|--------------|
| Atualizar System Map | ❌ | ✅ |
| Atualizar Route Registry | ❌ | ✅ |
| Atualizar Worker Registry | ❌ | ✅ |
| Atualizar Operational Playbook | ❌ | ✅ |
| Atualizar Skills Index | ❌ | ✅ |
| Detectar divergência documental | ✅ | ✅ |
| Recomendar PR-DOCS para corrigir mapa | ✅ | ❌ |
| Executar PR-DOCS de correção de mapa | ❌ | ✅ |
| Validar se correção documental aderiu ao contrato | ✅ | ❌ |

**Fluxo de correção documental:**
1. Contract Auditor detecta divergência (ex: rota no Runtime não está no Route Registry).
2. Contract Auditor recomenda PR-DOCS via System Mapper com escopo preciso.
3. System Mapper executa PR-DOCS de atualização do documento divergente.
4. Contract Auditor valida se a correção aderiu ao contrato na próxima revisão.

---

## 20. Critérios para sugerir nova skill

O Contract Auditor pode sugerir nova skill quando encontrar:

- **Tipo de auditoria recorrente** que demanda skill própria (ex: auditoria de segredos).
- **Área com risco próprio** não coberta pelas skills existentes.
- **Necessidade de release audit** (validação de ciclo completo antes de release).
- **Necessidade de security audit** (auditoria específica de segurança).
- **Necessidade de PR template audit** (validação de conformidade de template de PR).
- **Necessidade de test coverage audit** (cobertura de testes vs. contrato).
- **Necessidade de secrets audit** (varredura de secrets/bindings nos diffs).

**Template para sugestão de nova skill:**

```
Nome:
Problema:
Risco:
Quando ativar:
Quando não ativar:
Fontes:
Escopo:
Tipo de PR recomendado:
Prioridade:
Próxima ação segura:
```

Toda sugestão deve ser registrada em `schema/skills/INDEX.md` (seção "Skills sugeridas") antes de virar PR. A implementação requer PR-DOCS aprovada pelo contrato ativo ou pelo operador humano.

---

## 21. Exemplos de uso

### Exemplo 1 — PR-DOCS correta: pode mergear

**Cenário:** PR29 cria `schema/skills/CONTRACT_AUDITOR.md`, atualiza `schema/skills/INDEX.md` e governança. Nenhum `.js`/`.ts`/`.toml`/`.yml` alterado. Frase obrigatória presente. Referências corretas. Governança atualizada.

**Auditoria:**
- Tipo correto: PR-DOCS ✅
- Escopo respeitado: Docs-only ✅
- Runtime não alterado ✅
- Governança atualizada ✅
- INDEX aponta PR30 como próxima ✅

**Decisão:** Pode mergear.

---

### Exemplo 2 — PR-DOCS alterou `.js`: bloquear

**Cenário:** PR declarada como PR-DOCS altera `nv-enavia.js` além dos arquivos `schema/`.

**Auditoria:**
- Tipo declarado: PR-DOCS.
- Arquivo `.js` alterado: violação direta de escopo.

**Decisão:** BLOCKER — PR-DOCS não pode alterar runtime. Remover a alteração de `.js` ou reclassificar como PR-IMPL com diagnóstico anterior.

---

### Exemplo 3 — PR-IMPL sem diagnóstico anterior: bloquear

**Cenário:** PR-IMPL altera `nv-enavia.js` para implementar novo endpoint. O contrato exige PR-DIAG anterior. Nenhum PR-DIAG foi executado para esta frente.

**Auditoria:**
- Contrato exige PR-DIAG antes de PR-IMPL desta frente.
- PR-DIAG não encontrado no execution log nem no handoff.

**Decisão:** BLOCKER — executar PR-DIAG primeiro, documentar análise, depois retornar com PR-IMPL.

---

### Exemplo 4 — PR-PROVA tentou corrigir runtime: bloquear

**Cenário:** PR declarada como PR-PROVA altera lógica em `contract-executor.js` enquanto adiciona testes.

**Auditoria:**
- Tipo declarado: PR-PROVA.
- Arquivo de runtime alterado: violação de escopo.

**Decisão:** BLOCKER — PR-PROVA não pode alterar runtime. Separar a correção em PR-IMPL independente com diagnóstico e aprovação.

---

### Exemplo 5 — Deploy sem aprovação PROD: bloquear

**Cenário:** PR-IMPL descreve deploy direto para PROD sem evidência de aprovação humana.

**Auditoria:**
- PROD sem gate humano: violação de segurança e contrato.

**Decisão:** BLOCKER — PROD requer aprovação humana explícita. Reclassificar como deploy para TEST primeiro, depois solicitar aprovação para PROD via Deploy Governance Operator.

---

### Exemplo 6 — PR com governança esquecida: pedir correção

**Cenário:** PR-IMPL correta no código, mas `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` e `schema/execution/ENAVIA_EXECUTION_LOG.md` não foram atualizados.

**Auditoria:**
- Runtime alterado corretamente ✅
- Testes passando ✅
- Rollback documentado ✅
- Governança não atualizada ❌

**Decisão:** HIGH — atualizar governança antes do merge. Adicionar os arquivos faltantes no mesmo commit/PR.

---

### Exemplo 7 — PR com divergência documental: acionar System Mapper

**Cenário:** PR-IMPL adiciona nova rota `/contracts/new-action`, mas `schema/system/ENAVIA_ROUTE_REGISTRY.json` não foi atualizado.

**Auditoria:**
- Nova rota adicionada ao runtime.
- Route Registry não atualizado — divergência documental.

**Decisão:** MEDIUM — a PR pode mergear após correção. Criar PR-DOCS via System Mapper para atualizar `ENAVIA_ROUTE_REGISTRY.json` com a nova rota. Registrar como tarefa pendente no handoff.

---

## 22. Segurança e limites

O Contract Auditor opera dentro dos seguintes limites inegociáveis:

**O que o auditor NUNCA faz:**
- Não corrige automaticamente nenhum arquivo.
- Não altera runtime nem código de produção.
- Não atualiza documentos de governança por conta própria.
- Não executa deploy nem rollback.
- Não aprova produção.
- Não ignora evidência de violação real.
- Não inventa violação onde não há evidência.
- Não faz merge de PR.
- Apenas recomenda decisão — a aprovação final é sempre humana.

**O que o auditor PODE fazer:**
- Identificar violações com severidade definida.
- Recomendar bloqueio quando há risco real.
- Recomendar aprovação quando a PR está aderente.
- Sugerir correções precisas e acionáveis.
- Acionar a skill/frente adequada para resolver o problema detectado.
- Registrar observações para histórico sem bloquear merge.

---

## 23. Itens opcionais — não mexer agora

Isso é opcional. Não mexa agora.

- Auditor automático de PR via GitHub Action.
- GitHub Action de auditoria contratual executada a cada PR aberta.
- Endpoint `/contract-audit/run` para auditoria via API.
- UI de auditoria contratual integrada ao painel.
- Integração automática com Copilot para sugestões de auditoria inline.
- Scoring automático de risco de PR (1–10) com base em matriz de severidade.
- Bloqueio automático de merge via branch protection rules baseado em score.
- Leitura automática de diff por IA com geração de relatório estruturado.
- Geração automática de comentários de auditoria na PR.

---

## 24. Checklist final da skill

Usar antes de encerrar qualquer auditoria:

- [ ] PR analisada — link, número e branch identificados.
- [ ] Tipo da PR confirmado — PR-DIAG, PR-IMPL, PR-PROVA ou PR-DOCS.
- [ ] Contrato ativo confirmado — nome correto do arquivo do contrato.
- [ ] Arquivos alterados conferidos — diff ou lista verificada.
- [ ] Testes conferidos — executados, passando e compatíveis com o escopo.
- [ ] Governança conferida — status, handoff, execution log e INDEX atualizados.
- [ ] Rollback conferido — comando correto e impacto declarado.
- [ ] Severidade definida — nenhuma violação sem nível atribuído.
- [ ] Decisão clara — pode mergear / precisa correção / bloquear / pedir diagnóstico / pedir prova.
- [ ] Comentário de correção pronto, se necessário — texto formatado para colar na PR.
- [ ] Próxima PR autorizada validada — INDEX aponta corretamente.
