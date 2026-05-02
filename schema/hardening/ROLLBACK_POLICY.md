# ENAVIA — Política de Rollback: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — políticas definidas antes de qualquer implementação

---

## 1. Princípio

> **O rollback deve ser definido antes de executar, não depois.**
>
> Toda PR-IMPL deve declarar seu rollback no corpo da PR antes de ser mergeada.
> Toda ação de nível 3+ deve ter rollback testado ou documentado antes de executar.

---

## 2. Rollback por tipo de PR

### 2.1 PR documental (PR-DOCS / PR-DIAG / PR-HARDENING)

**Rollback:** `git revert <merge_commit_sha>`

**Passos:**
1. Identificar o SHA do merge commit da PR
2. Executar `git revert -m 1 <SHA>`
3. Criar nova PR com o revert
4. Aprovar e mergear o revert
5. Verificar que os arquivos voltaram ao estado anterior

**Impacto:** Apenas arquivos de documentação afetados.
**Risco:** Baixo. Nenhum runtime impactado.

---

### 2.2 Módulo proposal-only (PR-IMPL: Skill Executor proposal)

**Rollback:** Reverter `schema/enavia-skill-executor.js` e integração em `nv-enavia.js`

**Passos:**
1. `git revert <merge_commit_sha>` da PR-IMPL
2. Verificar que `schema/enavia-skill-executor.js` foi removido
3. Verificar que integração em `nv-enavia.js` foi revertida
4. Executar smoke tests de regressão
5. Confirmar que campo `skill_execution` sumiu do response

**Impacto:** Módulo proposal removido. Nenhum endpoint afetado.
**Risco:** Baixo. Nenhuma persistência, nenhum endpoint.
**Critério de sucesso:** Testes de regressão passando sem o campo `skill_execution`.

---

### 2.3 Endpoint `/skills/propose` (PR-IMPL: endpoint)

**Rollback:** Remover rota do worker principal

**Passos:**
1. `git revert <merge_commit_sha>` da PR-IMPL do endpoint
2. Verificar que rota `/skills/propose` foi removida de `nv-enavia.js`
3. Verificar que ENAVIA_ROUTE_REGISTRY.json foi atualizado
4. Deploy em TEST com `wrangler deploy --env test`
5. Confirmar que `/skills/propose` retorna 404
6. Smoke test de regressão nas rotas existentes
7. Se stable em TEST: deploy em PROD

**Impacto:** Endpoint removido. Usuários que usavam a rota perdem acesso.
**Risco:** Médio. Requer deploy.
**Critério de sucesso:** 404 em `/skills/propose`. Outras rotas inalteradas.

---

### 2.4 Gate de aprovação (PR-IMPL: mecanismo de aprovação)

**Rollback:** Reverter mecanismo de aprovação e retornar a modo proposal-only

**Passos:**
1. `git revert <merge_commit_sha>` do gate de aprovação
2. Verificar que lógica de aprovação foi removida
3. Verificar que propostas voltam a ser modo `proposal` sem gate
4. Executar smoke tests do Skill Executor sem gate
5. Deploy em TEST
6. Confirmar comportamento correto sem gate
7. Se stable em TEST: deploy em PROD

**Impacto:** Sistema volta a proposal-only sem gate de aprovação.
**Risco:** Médio. Requer deploy.

---

### 2.5 Execução read-only (PR-IMPL: Fase 5)

**Rollback:** Desabilitar execução real e retornar a proposal-only

**Passos:**
1. Flag de feature (`allow_real_execution: false`) se implementada
2. Ou `git revert <merge_commit_sha>` da PR-IMPL de execução
3. Verificar que nenhuma skill executa em modo `approved_execution`
4. Verificar que skills voltam a retornar apenas propostas
5. Smoke tests de regressão
6. Deploy em TEST → PROD

**Impacto:** Execução real desabilitada. Skills voltam a ser documentais.
**Risco:** Médio-alto. Requer deploy e validação de estado de execuções em andamento.
**Critério de sucesso:** Nenhuma skill executa. Apenas propostas retornadas.

---

### 2.6 Execução com side effect (PR-IMPL: Fase 6)

**Rollback:** Emergência — desabilitar execução imediatamente

**Passos (emergência):**
1. Se side effect irreversível já ocorreu: documentar dano e notificar operador
2. Desabilitar skill com side effect via flag de feature
3. Rollback do código via `git revert`
4. Deploy de emergência em TEST → PROD
5. Verificar que nenhum side effect adicional ocorre
6. Documentar o incidente
7. Abrir PR-DIAG para entender causa raiz antes de re-habilitar

**Impacto:** Alto. Side effects podem não ser revertíveis.
**Risco:** Alto. Requer análise de estado externo afetado.
**Regra:** Nunca tentar corrigir side effect na mesma PR. Documentar e abrir PR-IMPL cirúrgica.

---

## 3. Regra de PR-PROVA com falha

> **PR-PROVA que falhar não deve corrigir dentro dela mesma.**
> Deve documentar o achado como finding e abrir PR-IMPL cirúrgica separada.

**Sequência correta:**
```
PR-PROVA → falha encontrada → documentar finding → STOP
                                    ↓
                            PR-IMPL cirúrgica (nova PR)
                                    ↓
                            PR-PROVA re-executa (ou confirma fix)
```

**Exemplo histórico:** PR57 encontrou falha em Self-Audit → PR58 corrigiu cirurgicamente → PR57 ficou como evidência da falha original.

---

## 4. Quando parar e NÃO tentar corrigir na mesma PR

| Situação | Ação |
|----------|------|
| PR-PROVA encontra bug no runtime | Documentar finding. Abrir PR-IMPL separada. |
| Side effect inesperado em TEST | Parar. Documentar. Rollback. Não avançar para PROD. |
| Self-Audit retorna `secret_exposure` | Parar. Documentar. Não retornar resultado. |
| Gate de aprovação falha em validação | Parar. Documentar. Não criar `/skills/run`. |
| Smoke test de regressão falha | Parar. Documentar. Reverter a PR. |
| Blast radius real > blast radius declarado | Parar. Documentar. Re-avaliar antes de re-executar. |
| Custo de execução excede limite definido | Parar. Documentar. Revisar limites antes de re-executar. |

---

## 5. Política de escalonamento de rollback

| Nível de blast radius | Quem executa rollback | Tempo máximo para iniciar |
|----------------------|-----------------------|--------------------------|
| Nível 0–1 | Agente via PR | Próxima janela de PR |
| Nível 2 | Agente via PR + aprovação operador | < 24h |
| Nível 3 | Operador humano | < 4h |
| Nível 4 (produção) | Operador humano imediato | < 1h |

---

## 6. O que este documento NÃO implementa

- Não cria mecanismo automático de rollback
- Não cria flag de feature
- Não cria script de rollback
- Não altera nenhum módulo de runtime
- Todo conteúdo aqui é política para implementação futura

---

## Backlinks

- `schema/hardening/INDEX.md`
- `schema/hardening/BLAST_RADIUS.md`
- `schema/skills-runtime/ROLLOUT_PLAN.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
