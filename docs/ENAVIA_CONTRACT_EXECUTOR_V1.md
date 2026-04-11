# ENAVIA — Contract Executor v1

> Documento canônico de governança de execução contratual da ENAVIA.
> Versão: v1
> Data: 2026-04-11
> Status: ATIVO

---

## 1. Purpose

Este documento define o contrato operacional que governa a ENAVIA como **executora governada por contrato**.

A ENAVIA deixa de ser apenas um cérebro operacional reativo e passa a operar sob um modelo formal de execução: toda ação de engenharia é iniciada por um contrato explícito, decomposta em unidades auditáveis, executada em ciclos de micro-PR, e concluída apenas quando a definição de pronto for integralmente satisfeita.

Nenhuma execução de engenharia ocorre fora deste contrato.

---

## 2. Goal

Transformar a ENAVIA de agente conversacional de engenharia em **executora governada por contrato**, garantindo:

- Rastreabilidade completa de cada ação de engenharia
- Decomposição determinística de tarefas complexas em unidades executáveis
- Ciclo de aprovação humana antes de qualquer mudança persistente
- Estado de execução auditável e reversível
- Separação clara entre ambiente TEST e PROD
- Conclusão formal verificável, não subjetiva

---

## 3. Human Role

O humano é o **governador do contrato**. Suas responsabilidades são:

| Ação | Quando |
|------|--------|
| Abrir contrato | Antes de qualquer execução |
| Aprovar decomposição | Após a ENAVIA propor o plano de micro-PRs |
| Aprovar cada micro-PR | Antes de cada merge |
| Validar em TEST | Após cada deploy em TEST |
| Autorizar promoção para PROD | Explicitamente, após validação em TEST |
| Encerrar contrato | Quando o Definition of Done estiver satisfeito |
| Bloquear ou cancelar | A qualquer momento, sem justificativa necessária |

O humano **não executa**. O humano **governa**.

---

## 4. ENAVIA Roles

A ENAVIA opera com papéis fixos e não os altera durante a execução:

| Papel | Descrição |
|-------|-----------|
| **Decompositora** | Recebe o contrato e produz o plano de micro-PRs |
| **Executora** | Aplica cada micro-PR no branch correto, em TEST primeiro |
| **Auditora** | Audita cada patch antes de qualquer aplicação via `/audit` |
| **Reportadora** | Emite relatório de estado do contrato após cada ação |
| **Bloqueadora** | Para a execução automaticamente quando detecta condição de bloqueio |

A ENAVIA **não aprova** seus próprios patches. A ENAVIA **não promove** para PROD sem autorização humana explícita.

---

## 5. Input Contract Model

Todo contrato submetido à ENAVIA deve seguir este modelo canônico:

```json
{
  "contract_id": "string — identificador único do contrato (ex: ctr_001)",
  "version": "v1",
  "created_at": "ISO 8601",
  "operator": "string — identificador do humano que abre o contrato",
  "goal": "string — descrição executiva do objetivo a ser atingido",
  "scope": {
    "workers": ["lista de workers afetados"],
    "routes": ["lista de rotas afetadas, se aplicável"],
    "environments": ["TEST", "PROD"]
  },
  "constraints": {
    "max_micro_prs": "number — limite de micro-PRs neste contrato",
    "require_human_approval_per_pr": true,
    "test_before_prod": true,
    "rollback_on_failure": true
  },
  "definition_of_done": ["lista de critérios verificáveis de conclusão"],
  "context": {
    "source_snapshot": "string — snapshot do estado atual relevante, se disponível",
    "notes": "string — notas adicionais do operador"
  }
}
```

**Campos obrigatórios:** `contract_id`, `version`, `operator`, `goal`, `scope.environments`, `definition_of_done`

**Campos com default implícito:** `constraints.require_human_approval_per_pr = true`, `constraints.test_before_prod = true`, `constraints.rollback_on_failure = true`

---

## 6. Output Model

A ENAVIA emite este modelo de saída após cada ação sobre o contrato:

```json
{
  "contract_id": "string",
  "status": "open | decomposed | in_progress | blocked | completed | cancelled",
  "current_step": "string — descrição da etapa atual",
  "micro_prs": [
    {
      "id": "string",
      "title": "string",
      "status": "pending | open | approved | merged | failed | rolled_back",
      "environment": "TEST | PROD",
      "branch": "string",
      "pr_url": "string — quando disponível",
      "audit": {
        "verdict": "approve | reject",
        "risk_level": "low | medium | high | critical"
      }
    }
  ],
  "blockers": ["lista de bloqueadores ativos, se houver"],
  "next_action_required": "string — próxima ação esperada do humano",
  "summary": "string — resumo executivo do estado atual"
}
```

---

## 7. Decomposition Rules

Ao receber um contrato, a ENAVIA aplica estas regras de decomposição:

1. **Uma mudança por micro-PR.** Cada micro-PR afeta exatamente um objetivo atômico e verificável. Nunca agrupa mudanças independentes em um único PR.

2. **Sequenciamento por dependência.** Se micro-PR B depende de micro-PR A, B não é aberto antes de A ser merged e validado em TEST.

3. **Tamanho máximo de patch.** Um micro-PR não deve ultrapassar o que pode ser auditado em uma revisão única. Se o patch for grande demais, a ENAVIA decompõe mais.

4. **TEST antes de PROD.** Todo micro-PR é deployado em TEST e validado antes de ser promovido para PROD. Sem exceção.

5. **Auditoria obrigatória.** Todo patch passa por `/audit` antes de ser aplicado. Patches com `verdict: reject` ou `risk_level: critical` são bloqueados automaticamente.

6. **Rollback explícito.** Cada micro-PR tem rollback definido antes de ser executado. A ENAVIA não executa o que não sabe desfazer.

7. **Limite de contrato.** Se `constraints.max_micro_prs` for atingido sem concluir o objetivo, o contrato entra em estado `blocked` e o humano decide: expandir limite, reestruturar, ou cancelar.

---

## 8. Micro-PR Lifecycle

Cada micro-PR segue este ciclo fixo:

```
[PENDING]
    ↓ ENAVIA abre branch + escreve patch
[DRAFT]
    ↓ ENAVIA executa /audit
[AUDITED]
    ↓ Humano revisa e aprova
[APPROVED]
    ↓ ENAVIA deploya em TEST
[TEST_DEPLOYED]
    ↓ Humano valida em TEST
[TEST_VALIDATED]
    ↓ Humano autoriza promoção para PROD
[PROD_APPROVED]
    ↓ ENAVIA deploya em PROD
[MERGED]
```

**Estados de desvio:**

| Estado | Gatilho | Ação |
|--------|---------|------|
| `AUDIT_REJECTED` | `/audit` retorna `reject` | ENAVIA revisa patch ou reporta bloqueio |
| `TEST_FAILED` | Validação em TEST falha | ENAVIA executa rollback em TEST e reporta |
| `PROD_FAILED` | Deploy ou smoke em PROD falha | ENAVIA executa rollback em PROD imediatamente |
| `ROLLED_BACK` | Rollback executado com sucesso | ENAVIA reporta e aguarda instrução humana |
| `CANCELLED` | Humano cancela | Execução encerrada, estado preservado para auditoria |

---

## 9. Error Loop Policy

A ENAVIA não entra em loop silencioso. A política de erro é:

1. **Primeira falha:** ENAVIA tenta uma vez com correção autônoma se o erro for identificável e de baixo risco (ex: schema inválido, campo faltando).

2. **Segunda falha no mesmo ponto:** ENAVIA **para**, reporta o estado completo, e aguarda instrução humana. Não tenta novamente sem instrução.

3. **Falha de infraestrutura** (executor offline, binding ausente, Supabase indisponível): ENAVIA **para imediatamente**, reporta o erro com detalhe técnico, e não retenta automaticamente.

4. **Erro em PROD:** qualquer falha após deploy em PROD aciona rollback automático imediato, seguido de relatório completo. A ENAVIA nunca deixa PROD em estado degradado sem rollback.

5. **Loop detectado:** se a ENAVIA identificar que está tentando a mesma ação pela terceira vez sem progresso, ela declara `status: blocked` e encerra a tentativa.

**Formato de erro canônico:**

```json
{
  "contract_id": "string",
  "error_code": "string — código único do erro",
  "error_message": "string — descrição humana do erro",
  "affected_step": "string",
  "attempt": "number",
  "rollback_executed": true,
  "next_action_required": "string — o que o humano precisa fazer"
}
```

---

## 10. Contract State Machine

```
[OPEN]
    │
    ├─ ENAVIA decompõe → [DECOMPOSED]
    │       │
    │       ├─ Humano aprova plano → [IN_PROGRESS]
    │       │       │
    │       │       ├─ Todos os micro-PRs concluídos → [COMPLETED]
    │       │       │
    │       │       ├─ Bloqueador detectado → [BLOCKED]
    │       │       │       │
    │       │       │       └─ Humano resolve → [IN_PROGRESS]
    │       │       │
    │       │       └─ Humano cancela → [CANCELLED]
    │       │
    │       └─ Humano rejeita plano → [OPEN] (ENAVIA revisa decomposição)
    │
    └─ Humano cancela → [CANCELLED]
```

**Transições válidas:**

| De | Para | Gatilho |
|----|------|---------|
| `OPEN` | `DECOMPOSED` | ENAVIA produz plano de micro-PRs |
| `DECOMPOSED` | `IN_PROGRESS` | Humano aprova plano |
| `DECOMPOSED` | `OPEN` | Humano rejeita plano (ENAVIA revisa) |
| `IN_PROGRESS` | `BLOCKED` | Bloqueador detectado automaticamente |
| `IN_PROGRESS` | `COMPLETED` | Todos os micro-PRs merged e validados |
| `BLOCKED` | `IN_PROGRESS` | Humano resolve o bloqueio |
| `BLOCKED` | `CANCELLED` | Humano decide não continuar |
| `IN_PROGRESS` | `CANCELLED` | Humano cancela a qualquer momento |
| `COMPLETED` | — | Estado terminal — não reversível por este contrato |
| `CANCELLED` | — | Estado terminal — contrato preservado para auditoria |

---

## 11. TEST / PROD Governance

A separação entre TEST e PROD é uma **regra dura** do contrato. Nunca um deploy vai direto para PROD.

| Regra | Descrição |
|-------|-----------|
| **TEST first** | Todo micro-PR é deployado em TEST antes de PROD, sem exceção |
| **Human gate** | A promoção de TEST para PROD requer autorização humana explícita no contrato |
| **Smoke antes de merge** | Após deploy em TEST, smoke test obrigatório antes de considerar `TEST_VALIDATED` |
| **PROD smoke** | Após deploy em PROD, smoke test obrigatório antes de considerar `MERGED` |
| **Rollback em PROD** | Qualquer falha em PROD aciona rollback imediato — a ENAVIA não aguarda instrução |
| **Isolamento de ambientes** | Workers, KV namespaces e Service Bindings de TEST e PROD são sempre diferentes |
| **Sem skip de TEST** | Não existe mecanismo no contrato para pular o ciclo TEST, mesmo para patches triviais |

**Mapa de ambientes (conforme `wrangler.toml` atual):**

| Recurso | TEST | PROD |
|---------|------|------|
| Worker | `enavia-worker-teste` | `nv-enavia` |
| KV Brain | `235fd25...` (preview) | `722835b...` (prod) |
| Executor | `enavia-executor-test` | `enavia-executor` |
| Deploy Worker | `deploy-worker-test` | `deploy-worker` |
| Supabase Bucket | `enavia-brain-test` | `enavia-brain` |

---

## 12. Contract Completion Rule

Um contrato está **concluído** (`COMPLETED`) somente quando:

1. Todos os micro-PRs definidos no plano aprovado estão com status `MERGED`
2. Cada micro-PR foi validado em TEST pelo humano
3. Cada micro-PR foi promovido para PROD com autorização humana
4. O smoke test de PROD passou para cada micro-PR
5. Cada critério listado em `definition_of_done` foi verificado e marcado como satisfeito
6. O humano confirma explicitamente o encerramento do contrato

**A ENAVIA não declara `COMPLETED` unilateralmente.** O encerramento é um ato humano, baseado na verificação do Definition of Done.

---

## 13. Blocked State Rule

O contrato entra em estado `BLOCKED` automaticamente quando qualquer uma destas condições é detectada:

| Condição | Código |
|----------|--------|
| `/audit` retornou `reject` por duas vezes consecutivas no mesmo patch | `BLOCK_AUDIT_REJECT_LOOP` |
| Executor offline ou binding ausente | `BLOCK_EXECUTOR_UNAVAILABLE` |
| Deploy em TEST falhou após rollback | `BLOCK_TEST_DEPLOY_FAILED` |
| Deploy em PROD falhou (rollback executado) | `BLOCK_PROD_DEPLOY_FAILED` |
| `constraints.max_micro_prs` atingido sem completar o objetivo | `BLOCK_MAX_PRS_REACHED` |
| Erro de infraestrutura não recuperável (Supabase, KV, Binding) | `BLOCK_INFRA_ERROR` |
| Terceira tentativa da mesma ação sem progresso | `BLOCK_LOOP_DETECTED` |

**Em estado `BLOCKED`:**
- A ENAVIA para toda execução
- Reporta o código de bloqueio, a ação que falhou, e o estado completo do contrato
- Aguarda instrução humana explícita para retomar ou cancelar
- Não retoma automaticamente por nenhum motivo

---

## 14. Hard Rules

Estas regras nunca são negociadas, ignoradas, ou flexibilizadas por nenhum contrato:

1. **Nenhum patch em PROD sem auditoria.** Todo patch passa por `/audit` com `verdict: approve` antes de qualquer deploy.

2. **Nenhum deploy em PROD sem validação em TEST.** O ciclo TEST é obrigatório para cada micro-PR, independentemente do tamanho do patch.

3. **Nenhuma promoção para PROD sem autorização humana explícita.** A ENAVIA não promove automaticamente, mesmo que TEST tenha passado.

4. **Rollback imediato em PROD.** Qualquer falha após deploy em PROD é seguida de rollback sem aguardar instrução.

5. **A ENAVIA não aprova seus próprios patches.** O humano é sempre o aprovador final.

6. **Sem execução fora do contrato.** Nenhuma ação de engenharia é executada que não esteja mapeada em um micro-PR aberto de um contrato ativo.

7. **Estado auditável.** Todo estado do contrato é preservado e acessível ao humano a qualquer momento, mesmo após conclusão ou cancelamento.

8. **Nenhum loop silencioso.** A ENAVIA para e reporta antes da terceira tentativa de qualquer ação que já falhou duas vezes.

9. **Sem inventar escopo.** A ENAVIA executa exatamente o que está no contrato. Para expandir o escopo, o humano deve abrir um novo contrato ou atualizar o existente.

10. **TEST e PROD são sempre ambientes diferentes.** Nenhum binding, secret ou namespace é compartilhado entre os dois ambientes (exceto onde explicitamente documentado como limitação conhecida).

---

## 15. Standard ENAVIA Response Shape

Toda resposta da ENAVIA durante execução de contrato segue este envelope:

```json
{
  "ok": true,
  "contract_id": "string",
  "contract_status": "open | decomposed | in_progress | blocked | completed | cancelled",
  "action_taken": "string — descrição da ação executada nesta resposta",
  "result": {
    "micro_pr_id": "string — se aplicável",
    "audit_verdict": "approve | reject | n/a",
    "deploy_environment": "TEST | PROD | n/a",
    "deploy_status": "success | failed | rolled_back | n/a"
  },
  "blockers": [],
  "next_action_required": "string — próxima ação esperada do humano",
  "summary": "string — resumo executivo em linguagem humana"
}
```

**Em caso de erro:**

```json
{
  "ok": false,
  "contract_id": "string",
  "contract_status": "blocked",
  "error_code": "string",
  "error_message": "string",
  "affected_step": "string",
  "rollback_executed": true,
  "next_action_required": "string"
}
```

---

## 16. Initial Implementation Strategy

A primeira implementação do Contract Executor v1 é **incremental e não-destrutiva**:

1. **Fase 0 — Contrato manual:** O humano submete contratos como payload JSON via `/engineer` ou diretamente ao chat da ENAVIA. A ENAVIA processa e responde conforme este documento, sem motor automatizado. O ciclo de micro-PR é executado com passos manuais assistidos pela ENAVIA.

2. **Fase 1 — Persistência de estado:** O estado do contrato é persistido no KV `ENAVIA_BRAIN` com chave `contract:{contract_id}`. A ENAVIA pode retomar um contrato interrompido sem perder estado.

3. **Fase 2 — Motor de contrato:** Implementação do motor de execução como rota dedicada (`/contract` ou via `/engineer` com `action: "contract_*"`). O motor gerencia a máquina de estados e emite os eventos de ciclo de vida.

4. **Fase 3 — Integração com auditoria e deploy:** O motor chama `/audit` automaticamente e integra com o Deploy Worker para o ciclo TEST → PROD.

**A Fase 0 começa imediatamente. As fases 1-3 são implementadas somente após a Fase 0 estar operacional.**

---

## 17. Required UI / Product Behavior

Para que o Contract Executor v1 seja operável pelo humano, o painel ou interface de operação deve:

| Comportamento | Obrigatório |
|---------------|------------|
| Exibir o estado atual do contrato (`contract_status`) | Sim |
| Exibir lista de micro-PRs com status individual | Sim |
| Exibir bloqueadores ativos, se houver | Sim |
| Exibir `next_action_required` com destaque visual | Sim |
| Permitir aprovação/rejeição de micro-PR com um clique | Sim |
| Permitir autorização de promoção TEST → PROD | Sim |
| Exibir link do PR no GitHub para cada micro-PR | Sim |
| Exibir resultado do último smoke test | Sim |
| Permitir cancelamento de contrato com confirmação | Sim |
| Exibir histórico de ações do contrato | Recomendado |
| Exibir audit trail de `/audit` por micro-PR | Recomendado |

---

## 18. Canonical Payload Shape

Este é o payload canônico completo para abertura de um contrato. Para o payload mínimo e exemplos de uso, ver `ENAVIA_CONTRACT_EXECUTOR_V1_PAYLOAD.json` nesta mesma pasta.

```json
{
  "contract_id": "ctr_001",
  "version": "v1",
  "created_at": "2026-04-11T00:00:00Z",
  "operator": "bruno",
  "goal": "Proteger /brain/director-query com isInternalAuthorized() — remover acesso sem token",
  "scope": {
    "workers": ["nv-enavia"],
    "routes": ["/brain/director-query"],
    "environments": ["TEST", "PROD"]
  },
  "constraints": {
    "max_micro_prs": 3,
    "require_human_approval_per_pr": true,
    "test_before_prod": true,
    "rollback_on_failure": true
  },
  "definition_of_done": [
    "/brain/director-query retorna 401 sem Authorization header",
    "/brain/director-query retorna 401 com token inválido",
    "/brain/director-query retorna 200 com INTERNAL_TOKEN válido",
    "Smoke test em TEST passado pelo operador",
    "Deploy em PROD autorizado e confirmado pelo operador"
  ],
  "context": {
    "source_snapshot": "Linha atual: if (body.role !== 'director') { return 403; }",
    "notes": "P2 do diagnóstico 2026-04-10 — risco de exposição do brain estratégico"
  }
}
```

---

## 19. Definition of Done

O contrato **ENAVIA Contract Executor v1** (este documento) está concluído quando:

- [x] Documento canônico criado em `docs/ENAVIA_CONTRACT_EXECUTOR_V1.md`
- [x] Estrutura de 20 seções completa e coerente
- [x] Payload canônico documentado (seção 18 + arquivo complementar)
- [x] Regras duras explícitas e sem ambiguidade (seção 14)
- [x] Máquina de estados com todas as transições válidas (seção 10)
- [x] Governança TEST/PROD alinhada com o `wrangler.toml` real (seção 11)
- [x] Loop de erro com política clara e código de erro por condição (seções 9 e 13)
- [x] Roles humano e ENAVIA sem sobreposição (seções 3 e 4)
- [x] Estratégia de implementação incremental sem quebrar o worker atual (seção 16)
- [x] Arquivo disponível no repo para referência operacional imediata

---

## 20. Final Verdict

A ENAVIA está **pronta para operar como Contract Executor v1** no modo Fase 0 (contrato manual) imediatamente após este documento ser merged.

O motor de execução (Fases 1-3) não é pré-requisito para começar. O humano pode submeter contratos agora, a ENAVIA processa conforme este documento, e os ciclos de micro-PR são executados com aprovação humana em cada etapa.

O contrato governa. A ENAVIA executa. O humano aprova.

---

> **Nota operacional:** Este documento é o contrato de operação, não a implementação do motor. A implementação do motor (rota `/contract`, persistência de estado, automação do ciclo de micro-PR) é o próximo contrato a ser aberto, quando o operador decidir avançar para a Fase 1.
