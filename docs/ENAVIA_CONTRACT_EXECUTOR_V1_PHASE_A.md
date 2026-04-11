# ENAVIA — Contract Executor v1 — Fase A

> Documento técnico da Fase A do Contract Executor.
> Versão: v1-fase-a
> Data: 2026-04-11
> Status: IMPLEMENTADO

---

## 1. O que a Fase A entrega

A Fase A implementa a **base mínima e governável** do Contract Executor v1:

| Capacidade | Status |
|------------|--------|
| Ingestão de contrato canônico | ✅ Implementado |
| Validação de payload | ✅ Implementado |
| Persistência de estado em KV | ✅ Implementado |
| Decomposição inicial (heurística) | ✅ Implementado |
| Leitura de estado completo | ✅ Implementado |
| Leitura de resumo do contrato | ✅ Implementado |
| Smoke tests | ✅ Implementado |

---

## 2. O que a Fase A NÃO entrega

| Capacidade | Status |
|------------|--------|
| Execução de micro-PRs | ❌ Fora do escopo |
| Promoção para PROD | ❌ Fora do escopo |
| Loop de erro automático | ❌ Fora do escopo |
| Motor de execução completo | ❌ Fora do escopo |
| Painel/front-end | ❌ Fora do escopo |
| Auditoria automática | ❌ Fora do escopo |
| Deploy automático | ❌ Fora do escopo |

---

## 3. Rotas

### POST /contracts — Criar contrato

**Descrição:** Recebe um payload de contrato canônico, valida, gera decomposição inicial e persiste.

**Payload mínimo:**

```json
{
  "contract_id": "ctr_001",
  "version": "v1",
  "operator": "bruno",
  "goal": "Descrição do objetivo a ser atingido",
  "scope": {
    "environments": ["TEST", "PROD"]
  },
  "definition_of_done": [
    "Critério verificável 1",
    "Critério verificável 2"
  ]
}
```

**Campos obrigatórios:**

| Campo | Tipo | Descrição |
|-------|------|-----------|
| `contract_id` | string | Identificador único do contrato |
| `version` | string | Deve ser `"v1"` |
| `operator` | string | Identificador do operador humano |
| `goal` | string | Objetivo executivo do contrato |
| `scope.environments` | string[] | Ambientes alvo (ex: `["TEST","PROD"]`) |
| `definition_of_done` | string[] | Lista de critérios verificáveis de conclusão |

**Campos opcionais:**

| Campo | Tipo | Default |
|-------|------|---------|
| `created_at` | string (ISO 8601) | Timestamp atual |
| `scope.workers` | string[] | `["nv-enavia"]` |
| `scope.routes` | string[] | `[]` |
| `constraints.max_micro_prs` | number | `10` |
| `constraints.require_human_approval_per_pr` | boolean | `true` |
| `constraints.test_before_prod` | boolean | `true` |
| `constraints.rollback_on_failure` | boolean | `true` |
| `context.source_snapshot` | string | `null` |
| `context.notes` | string | `null` |

**Respostas:**

| Status | Condição |
|--------|----------|
| 201 | Contrato criado com sucesso |
| 400 | JSON inválido ou payload falha validação |
| 409 | Contrato com mesmo `contract_id` já existe |

**Resposta de sucesso (201):**

```json
{
  "ok": true,
  "contract_id": "ctr_001",
  "status_global": "decomposed",
  "phases_count": 3,
  "tasks_count": 2,
  "micro_pr_candidates_count": 3,
  "next_action": "Revisar decomposição e aprovar plano de micro-PRs.",
  "created_at": "2026-04-11T00:00:00Z"
}
```

---

### GET /contracts?id=`<contract_id>` — Ler estado completo

**Descrição:** Retorna o estado completo do contrato e sua decomposição.

**Parâmetros:**

| Parâmetro | Tipo | Obrigatório |
|-----------|------|-------------|
| `id` | string (query) | Sim |

**Respostas:**

| Status | Condição |
|--------|----------|
| 200 | Contrato encontrado |
| 400 | Parâmetro `id` ausente |
| 404 | Contrato não encontrado |

---

### GET /contracts/summary?id=`<contract_id>` — Resumo do contrato

**Descrição:** Retorna um resumo compacto do estado do contrato.

**Resposta de sucesso (200):**

```json
{
  "ok": true,
  "contract_id": "ctr_001",
  "contract_name": "Descrição do objetivo",
  "status_global": "decomposed",
  "current_phase": "decomposition_complete",
  "current_task": null,
  "blockers": [],
  "next_action": "Revisar decomposição e aprovar plano de micro-PRs.",
  "phases_count": 3,
  "tasks_count": 2,
  "micro_pr_candidates_count": 3,
  "created_at": "2026-04-11T00:00:00Z",
  "updated_at": "2026-04-11T00:00:00Z"
}
```

---

## 4. Estados iniciais possíveis

Ao criar um contrato com sucesso, o estado será:

| Status | Condição |
|--------|----------|
| `decomposed` | Contrato válido, decomposição gerada com sucesso |
| `blocked` | Falha estrutural detectada (ex: scope vazio) |

Estados previstos para fases futuras:

| Status | Descrição |
|--------|-----------|
| `draft` | Contrato em rascunho (não implementado na Fase A) |
| `approved` | Decomposição aprovada pelo operador |
| `failed` | Erro irrecuperável na execução |

---

## 5. Persistência (KV)

A Fase A usa o KV `ENAVIA_BRAIN` existente com o seguinte esquema de chaves:

| Chave | Conteúdo |
|-------|----------|
| `contract:<id>:state` | JSON com estado completo do contrato |
| `contract:<id>:decomposition` | JSON com decomposição (phases, tasks, micro_pr_candidates) |
| `contract:index` | JSON array com lista de contract_ids |

---

## 6. Decomposição inicial

A decomposição na Fase A é **heurística e determinística**:

- Gera 3 fases fixas: Preparação, Implementação em TEST, Validação e PROD
- Gera 1 task por item em `definition_of_done`
- Gera 1 `micro_pr_candidate` por task + 1 para promoção PROD
- As tasks têm dependência sequencial
- Nenhuma micro-PR é executada na Fase A

---

## 7. Smoke Tests

Os testes estão em `tests/contracts-smoke.test.js`.

```bash
node tests/contracts-smoke.test.js
```

Testes cobertos:
1. Validar payload válido
2. Rejeitar payload inválido (vários cenários)
3. Construir estado inicial
4. Gerar decomposição
5. Criar contrato via handler
6. Rejeitar JSON inválido
7. Rejeitar campos faltantes
8. Rejeitar contrato duplicado
9. Ler contrato existente
10. Ler contrato não existente
11. Ler contrato sem id
12. Ler summary do contrato
13. Ler summary de contrato não existente
