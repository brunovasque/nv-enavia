# ENAVIA — Contrato Canônico de Memória v1

> **PR1 — Contrato de Memória Canônica**
> Documento normativo. Não contém código funcional.
> Escopo: fechar o contrato canônico da memória antes de codar.
> Próximas PRs devem seguir este contrato como fonte de verdade.

---

## 0. Propósito e Escopo

Este documento define o **contrato canônico da memória da ENAVIA**: os tipos de memória, os níveis de confiança, as regras de leitura e escrita, as políticas de expiração e conflito, e o formato obrigatório de cada registro.

Nenhuma implementação funcional está contida aqui. Este contrato é a base formal que guia as próximas PRs:

| PR | Escopo |
|----|--------|
| **PR1** (este documento) | Contrato canônico — definição, tipos, regras |
| PR2 | Persistência backend — schema de persistência real, KV/D1/R2 |
| PR3 | Retrieval — separação histórico × conversa atual, pipeline de busca |
| PR4 | Painel manual — inserção e edição de memória pelo operador |
| PR5 | Aprendizado controlado — promoção de memória com aprovação humana |
| PR6 | Telemetria e testes reais |

---

## 1. Tipos de Memória

A ENAVIA reconhece **cinco tipos canônicos de memória**. Cada tipo tem semântica, ciclo de vida e regras de acesso distintos.

### 1.1 `conversa_atual`

**Definição:** contexto vivo da conversa em andamento. Contém tudo que foi dito, inferido ou observado dentro da sessão ativa. É o tipo de mais alta prioridade de leitura e o mais curto em duração.

**Características:**
- Escopo: sessão única
- Duração: encerra com a sessão (sem persistência cross-session por padrão)
- Leitura: sempre disponível na sessão ativa — nunca filtrada
- Escrita: automática, em tempo real, ao longo da conversa
- Conflito com memória longa: a `conversa_atual` sempre prevalece

**Mapeamento ao schema existente (`memory-schema.js`):**
`MEMORY_TYPES.LIVE_CONTEXT` (`live_context`)

---

### 1.2 `memoria_longa`

**Definição:** conhecimento persistido sobre o usuário, projetos, preferências e histórico operacional. Acumulado ao longo de múltiplas sessões. É a memória de "quem é esse usuário e o que foi feito".

**Características:**
- Escopo: cross-session, persistente
- Duração: sem expiração padrão (a menos que definida explicitamente no campo `expires_at`)
- Leitura: recuperada no início de toda sessão, antes do planejamento
- Escrita: requer nível de confiança `sugerido` ou superior; nunca automática sem checagem
- Subtipos cobertos: identidade do usuário, projetos ativos, histórico de decisões

**Mapeamento ao schema existente (`memory-schema.js`):**
`MEMORY_TYPES.USER_PROFILE`, `MEMORY_TYPES.PROJECT`, `MEMORY_TYPES.OPERATIONAL_HISTORY`

---

### 1.3 `memoria_manual`

**Definição:** memória inserida ou editada diretamente pelo operador via painel. Tem precedência máxima dentro do seu domínio — representa a intenção explícita do humano.

**Características:**
- Escopo: persistente, source-of-truth para o domínio declarado
- Duração: indefinida até arquivamento explícito pelo operador
- Leitura: sempre incluída no contexto ativo (mesma prioridade que `conversa_atual`)
- Escrita: exclusivamente via ação humana direta (PR4); nunca automática
- Modificação: somente pelo operador — a ENAVIA não pode sobrescrever `memoria_manual` automaticamente
- Nível de confiança mínimo: `validado` (inserida por humano)

**Mapeamento ao schema existente (`memory-schema.js`):**
Sem tipo dedicado ainda. PR4 criará o campo `source: "panel"` e o tipo `MEMORY_TYPES.MANUAL` (ou flag `is_manual: true`).

---

### 1.4 `aprendizado_validado`

**Definição:** padrões, lições e regras que surgiram de ciclos operacionais e foram explicitamente aprovados por um humano. É o tipo de memória mais estável e raramente modificado. Representa o que a ENAVIA "aprendeu" de forma controlada.

**Características:**
- Escopo: global (cross-projeto, cross-sessão)
- Duração: permanente (`is_canonical: true`) — só alterado via deliberação formal
- Leitura: prioridade máxima — incluído antes de qualquer outro tipo no contexto do planner
- Escrita: somente após aprovação humana explícita (gate aprovado — PR5); nunca automática
- Revogação: requer aprovação humana; o registro anterior é arquivado (nunca deletado)

**Mapeamento ao schema existente (`memory-schema.js`):**
`MEMORY_TYPES.CANONICAL_RULES` com `is_canonical: true` e `status: "canonical"`

---

### 1.5 `memoria_temporaria`

**Definição:** contexto de curta duração gerado durante o ciclo planner → executor, válido apenas enquanto uma operação específica está em andamento. Não persiste após a conclusão da operação.

**Características:**
- Escopo: operação específica (intra-ciclo)
- Duração: TTL curto, definido explicitamente em `expires_at`; expira automaticamente
- Leitura: apenas durante o ciclo que a criou — não visível em sessões subsequentes
- Escrita: automática pelo planner; não requer aprovação humana
- Após expiração: status `expired`; não recuperável no pipeline padrão

**Mapeamento ao schema existente (`memory-schema.js`):**
Subconjunto de `MEMORY_TYPES.LIVE_CONTEXT` com `expires_at` definido e `priority: "low"`. PR2 pode criar tipo dedicado se necessário.

---

### Tabela Resumo dos Tipos

| Tipo | Duração | Escrita | Leitura | Confiança mínima | is_canonical |
|---|---|---|---|---|---|
| `conversa_atual` | Sessão | Automática | Sempre prioritária | qualquer | false |
| `memoria_longa` | Persistente | Checagem | Pré-sessão | `sugerido` | false |
| `memoria_manual` | Persistente | Humano (painel) | Alta prioridade | `validado` | false |
| `aprendizado_validado` | Permanente | Gate humano | Máxima prioridade | `validado` | true |
| `memoria_temporaria` | TTL curto | Automática | Ciclo ativo | qualquer | false |

---

## 2. Níveis de Confiança

Todo registro de memória carrega um **nível de confiança** que determina como a ENAVIA o trata ao ler, ao escrever e ao resolver conflitos.

### 2.1 `observado`

**Definição:** a informação foi percebida ou detectada, mas não confirmada. Pode ser uma inferência da conversa, um dado lido de uma fonte não verificada, ou um padrão observado uma única vez.

**Comportamento:**
- Pode ser incluído no contexto, mas nunca como verdade absoluta
- Deve ser marcado como hipótese quando apresentado ao usuário
- Não qualifica para persistência em `memoria_longa` sem promoção explícita
- Não bloqueia a execução — apenas sinaliza incerteza

**Mapeamento ao schema existente:** `MEMORY_CONFIDENCE.UNVERIFIED` / `MEMORY_CONFIDENCE.LOW`

---

### 2.2 `sugerido`

**Definição:** a informação foi inferida de contexto consistente ou de múltiplas observações, mas ainda não foi formalmente confirmada por humano. Tem grau de confiança suficiente para ser usada no planejamento, com ressalva.

**Comportamento:**
- Pode ser persistida em `memoria_longa` (com indicação de que é sugestão)
- Pode guiar o planejamento, mas não pode disparar execução irreversível sozinha
- Elegível para promoção a `validado` mediante confirmação humana

**Mapeamento ao schema existente:** `MEMORY_CONFIDENCE.MEDIUM`

---

### 2.3 `validado`

**Definição:** a informação foi confirmada explicitamente por um humano, ou por evidência técnica formal (teste passando, gate aprovado, auditoria confirmada). É a confiança que habilita persistência plena e uso no contexto crítico.

**Comportamento:**
- Qualifica para persistência como `aprendizado_validado`
- Pode ser usada em execuções irreversíveis quando combinada com gate aprovado
- Memórias de tipo `memoria_manual` têm nível `validado` por definição (inseridas por humano)

**Mapeamento ao schema existente:** `MEMORY_CONFIDENCE.HIGH` / `MEMORY_CONFIDENCE.CONFIRMED`

---

### 2.4 `bloqueado`

**Definição:** a informação foi explicitamente invalidada ou proibida de uso. Pode ser um fato desatualizado que o operador marcou como inválido, uma regra revogada, ou um dado que causou problema em produção.

**Comportamento:**
- Nunca incluído no contexto ativo — filtrado em qualquer pipeline de retrieval
- Permanece no storage para auditoria (nunca deletado)
- Bloqueia qualquer tentativa de re-escrita do mesmo conteúdo (colisão de identidade)
- Só pode ser desbloqueado por ação humana explícita

**Mapeamento ao schema existente:** Sem equivalente direto. PR2 adicionará `MEMORY_CONFIDENCE.BLOCKED` ou flag `is_blocked: true`. Por ora, usar `status: "archived"` + `flags: ["is_blocked"]`.

---

### Tabela Resumo dos Níveis de Confiança

| Nível | Origem | Persiste em `memoria_longa`? | Habilita execução irreversível? | Visível no contexto? |
|---|---|---|---|---|
| `observado` | Automática / inferência única | Não | Não | Sim, como hipótese |
| `sugerido` | Inferência consistente | Sim (com ressalva) | Não | Sim |
| `validado` | Confirmação humana / evidência formal | Sim | Sim (com gate) | Sim |
| `bloqueado` | Invalidação humana | N/A | Não | Nunca |

---

## 3. Regra de Ouro

> **Memória antiga nunca domina o contexto atual sem checagem.**

Esta regra é absoluta e não tem exceção.

### Detalhamento

**O que significa "dominar":** sobrescrever, filtrar, silenciar ou redirecionar o que o usuário disse ou está dizendo agora, com base em memória de sessões anteriores.

**O que significa "checagem":** qualquer um dos seguintes:
1. A ENAVIA apresenta ao usuário a memória recuperada e pede confirmação antes de agir com base nela
2. A memória tem nível `validado` E o contexto atual é consistente com ela (sem contradição)
3. É `aprendizado_validado` com `is_canonical: true` E o pedido atual não o contradiz explicitamente

**Casos concretos da Regra de Ouro:**

| Situação | Comportamento correto |
|---|---|
| Usuário diz X na sessão atual; memória longa diz não-X | `conversa_atual` prevalece. Memória longa é suspensa para esta sessão. |
| Usuário pede Y; existe `aprendizado_validado` sobre como fazer Y | Usar o aprendizado, mas checar se o pedido atual não contradiz |
| Memória de projeto de 6 meses atrás; sem confirmação nova | Apresentar ao usuário antes de planejar com ela |
| `memoria_manual` inserida ontem; conversa hoje não a menciona | Usar normalmente — foi inserida por humano recentemente |
| `memoria_temporaria` de ciclo anterior | Não recuperar — já expirou |

**Por que esta regra existe:** memórias antigas podem ser falsas, desatualizadas ou fora de contexto. A ENAVIA não tem como saber, sem a conversa atual, o que mudou. O usuário é a fonte de verdade do presente.

---

## 4. Critérios de Leitura

Define **quando** e **como** cada tipo de memória é recuperado e incluído no contexto.

### 4.1 Ordem de recuperação (prioridade decrescente)

1. `aprendizado_validado` (`is_canonical: true`) — sempre, incondicionalmente
2. `memoria_manual` — sempre, incondicionalmente
3. `conversa_atual` — sempre, é o próprio contexto ativo
4. `memoria_longa` (nível `validado`) — recuperada no início da sessão, por entidade/projeto
5. `memoria_longa` (nível `sugerido`) — recuperada apenas quando relevante ao pedido
6. `memoria_temporaria` — apenas durante o ciclo que a gerou; nunca em sessão nova
7. `memoria_longa` (nível `observado`) — somente se solicitado explicitamente; jamais como fato

### 4.2 Regras de filtragem na leitura

- Memórias com status `archived`, `expired`, `superseded` são **excluídas** do pipeline padrão
- Memórias com nível `bloqueado` são **excluídas** sempre, independente de status
- `memoria_temporaria` expirada (campo `expires_at` no passado) é tratada como `expired`
- Memória de projeto: filtrada por `entity_id` correspondente ao projeto ativo, exceto `aprendizado_validado` (global)

### 4.3 Condição de checagem obrigatória (Regra de Ouro aplicada)

Antes de usar qualquer memória do tipo `memoria_longa` em decisão de planejamento, verificar:
1. **Contradição com `conversa_atual`?** → se sim, suspender a memória longa para este ciclo
2. **Memória mais antiga que o limiar de staleness?** (PR3 definirá o limiar; por padrão: 30 dias sem atualização + sem confirmação = stale) → se sim, apresentar ao usuário antes de usar
3. **Nível `observado`?** → nunca usar em planejamento sem promoção explícita

### 4.4 O que não é leitura

- Busca semântica/vetorial: escopo de PR3, não definido aqui
- Retrieval automático em cada token de resposta: escopo de PR3
- Leitura de histórico de sessões anteriores completo: escopo de PR3

---

## 5. Critérios de Escrita

Define **quando** cada tipo de memória pode ser criado ou atualizado.

### 5.1 Regras por tipo

| Tipo | Quem escreve | Condição obrigatória | Nível mínimo |
|---|---|---|---|
| `conversa_atual` | ENAVIA (automático) | Sempre, ao longo da sessão | qualquer |
| `memoria_longa` | ENAVIA (com gate) | Nível `sugerido` ou superior; checagem de conflito | `sugerido` |
| `memoria_manual` | Operador (painel) | Ação humana direta via PR4 | `validado` (implícito) |
| `aprendizado_validado` | ENAVIA (gate humano) | Gate aprovado + nível `validado` + ciclo concluído | `validado` |
| `memoria_temporaria` | ENAVIA (automático) | Apenas durante ciclo ativo; `expires_at` obrigatório | qualquer |

### 5.2 Regras gerais de escrita

1. **Nunca criar duplicata:** antes de escrever, verificar se existe registro com mesmo `entity_id` + `memory_type` + semântica equivalente. Se existir, usar `updateMemory` (PR2), não criar novo.
2. **Nunca sobrescrever `aprendizado_validado` automaticamente:** qualquer tentativa de modificar memória com `is_canonical: true` requer gate humano aprovado. A ENAVIA não modifica silenciosamente.
3. **Nunca escrever memória `bloqueado`:** se a informação a ser escrita corresponde a um registro bloqueado, a escrita é rejeitada com erro explícito.
4. **`expires_at` obrigatório para `memoria_temporaria`:** memória temporária sem data de expiração é inválida.
5. **`source` sempre preenchido:** toda memória deve identificar de onde veio (ex: `"conversa"`, `"painel"`, `"planner"`, `"consolidacao"`, `"operador"`).

### 5.3 O que não é escrita (PR2+)

- Persistência real em KV/D1/R2: escopo de PR2
- Pipeline de consolidação pós-ciclo: escopo de PR5 (já parcialmente em `memory-consolidation.js`)
- Escrita via painel: escopo de PR4

---

## 6. Política de Expiração

Define como a ENAVIA trata o tempo de vida de cada registro de memória.

### 6.1 TTL por tipo

| Tipo | TTL padrão | Campo de controle | Comportamento pós-expiração |
|---|---|---|---|
| `conversa_atual` | Duração da sessão | (implícito — sem persistência cross-session) | Descartada ao fim da sessão |
| `memoria_longa` | Indefinido (sem expiração padrão) | `expires_at` (opcional) | Status → `expired` |
| `memoria_manual` | Indefinido | `expires_at` (opcional, definido pelo operador) | Status → `expired` |
| `aprendizado_validado` | Permanente — nunca expira automaticamente | `expires_at` deve ser `null` | N/A — só arquivado por deliberação |
| `memoria_temporaria` | Curto — obrigatoriamente definido em `expires_at` | `expires_at` (obrigatório) | Status → `expired` imediatamente |

### 6.2 Limiar de staleness (memória longa sem expiração explícita)

Mesmo sem `expires_at`, um registro de `memoria_longa` com nível `sugerido` ou `observado` é considerado **stale** após 30 dias sem atualização (`updated_at`). Memória stale não é deletada, mas:
- É marcada internamente como "requer confirmação"
- A Regra de Ouro se aplica obrigatoriamente (checar com o usuário antes de usar)
- PR3 implementará a detecção automática de staleness

### 6.3 Processo de expiração

1. Verificar `expires_at` a cada leitura: se `expires_at < now()`, atualizar status para `expired`
2. Registro expirado permanece no storage (nunca deletado) para auditoria
3. Registro expirado é excluído de todos os pipelines de recuperação ativos
4. Expiração nunca é reversível — se a informação ainda é válida, criar novo registro

### 6.4 O que não é expiração (PR2+)

- Processo de limpeza automática de memórias expiradas: escopo de PR2
- Notificação de memórias prestes a expirar: escopo de PR6

---

## 7. Política de Conflito

Define o comportamento da ENAVIA quando dois registros de memória contradizem entre si, ou quando uma escrita conflita com memória existente.

### 7.1 Hierarquia de resolução de conflito

Quando dois registros contradizem, a ENAVIA segue esta ordem de precedência:

```
conversa_atual > memoria_manual > aprendizado_validado > memoria_longa (validado) > memoria_longa (sugerido) > memoria_longa (observado)
```

**Regra:**
- O tipo de maior prioridade prevalece para o ciclo atual
- O tipo de menor prioridade não é deletado — é suspenso temporariamente e registrado como `conflito_detectado` nos metadados da sessão
- O operador é notificado se o conflito envolver `memoria_manual` ou `aprendizado_validado`

### 7.2 Conflito na escrita

Ao tentar escrever um registro que contradiz um existente:

| Situação | Ação |
|---|---|
| Nova memória contradiz `aprendizado_validado` (`is_canonical: true`) | Rejeitar a escrita; registrar tentativa de conflito; notificar operador |
| Nova memória contradiz `memoria_manual` | Rejeitar a escrita automática; só aceitar via ação humana no painel |
| Nova memória contradiz `memoria_longa` (nível `validado`) | Criar nova entrada com `superseded_by` no registro antigo; não deletar |
| Nova memória contradiz `memoria_longa` (nível `sugerido` ou `observado`) | Sobrescrever via `updateMemory`; registrar substituição |
| Nova memória com nível `bloqueado` em qualquer tipo | Rejeitar sempre |

### 7.3 Conflito de identidade (mesmo `entity_id` + `memory_type`)

Dois registros com mesmo `entity_id` e `memory_type` representando o mesmo fato não podem coexistir ativos simultaneamente:
1. O registro mais antigo recebe `status: "superseded"` e `content_structured._meta.superseded_by` apontando para o novo
2. O novo registro tem `status: "active"` (ou `"canonical"` se aplicável)
3. O histórico completo é preservado

### 7.4 Conflito entre sessões

Se a `conversa_atual` contradiz uma `memoria_longa`:
1. A `conversa_atual` prevalece para o ciclo ativo (Regra de Ouro)
2. A contradição é registrada como candidato à revisão da `memoria_longa`
3. Nenhuma atualização automática da `memoria_longa` ocorre sem confirmação humana (PR5)

---

## 8. Formato Canônico do Registro de Memória

Define o shape obrigatório de todo objeto de memória no sistema da ENAVIA.

### 8.1 Campos obrigatórios

```
memory_id          string (UUID ou ID único gerado)   — identificador único do registro
memory_type        string (enum: tipos da seção 1)    — tipo canônico da memória
entity_type        string (enum: ver 8.3)             — tipo da entidade associada
entity_id          string não-vazia                   — ID da entidade (usuário, projeto, etc.)
title              string não-vazia                   — título legível do registro
content_structured object (não-null, não-array)       — conteúdo estruturado (ver 8.4)
source             string não-vazia                   — origem do registro (ver 8.5)
created_at         string ISO 8601                    — data/hora de criação (UTC)
updated_at         string ISO 8601                    — data/hora da última atualização (UTC)
```

### 8.2 Campos opcionais com defaults

```
priority           string (enum: ver 8.6)     — default: "medium"
confidence         string (enum: níveis §2)   — default: "sugerido"
expires_at         string ISO 8601 | null      — default: null (sem expiração)
                   OBRIGATÓRIO para memoria_temporaria
is_canonical       boolean                    — default: false
                   true somente para aprendizado_validado
status             string (enum: ver 8.7)     — default: "active"
flags              string[]                   — default: []
```

### 8.3 Enum `entity_type`

```
"user"       — entidade é um usuário
"project"    — entidade é um projeto
"rule"       — entidade é uma regra ou contrato
"operation"  — entidade é uma operação ou ciclo
"context"    — entidade é um contexto de sessão
```

### 8.4 Campo `content_structured`

Plain object com conteúdo semântico do registro. Deve conter ao menos um campo com dados reais. Campos reservados (prefixo `_`):

```
_meta              — object — metadados internos do ciclo de vida
  _meta.superseded_by   — string — memory_id do registro substituto
  _meta.archived_by     — string — reason/operador que arquivou
  _meta.conflict_notes  — string — registro de conflito detectado
  _meta.staleness_flag  — boolean — true se marcado como stale
```

Estrutura interna do `content_structured` é livre por tipo, exceto pelos campos `_meta`.

### 8.5 Enum `source`

Valores canônicos para o campo `source`:

```
"conversa"       — originado da conversa ativa
"painel"         — inserido manualmente pelo operador
"planner"        — gerado pelo ciclo planner
"consolidacao"   — gerado por PM9 (memory-consolidation.js)
"operador"       — ação direta do operador (não via painel)
"importacao"     — migrado/importado de fonte externa
```

### 8.6 Enum `priority`

```
"critical"   — deve sempre ser recuperado
"high"       — recuperado em contextos relevantes
"medium"     — recuperado quando há espaço de contexto
"low"        — recuperado apenas se explicitamente solicitado
```

### 8.7 Enum `status`

```
"active"     — memória ativa e em uso
"archived"   — preservada mas removida do pipeline ativo
"superseded" — substituída por versão mais recente (ver 8.4 _meta.superseded_by)
"expired"    — validade expirada (expires_at ultrapassado)
"canonical"  — fato permanente aprovado (somente aprendizado_validado)
```

### 8.8 Mapeamento de níveis de confiança (§2) ao campo `confidence`

| Nível canônico (§2) | Valor no campo `confidence` |
|---|---|
| `observado` | `"unverified"` ou `"low"` |
| `sugerido` | `"medium"` |
| `validado` | `"high"` ou `"confirmed"` |
| `bloqueado` | flag `"is_blocked"` no array `flags` + `status: "archived"` |

> **Nota de evolução:** PR2 adicionará `"blocked"` como valor de `confidence` para eliminar a ambiguidade do mapeamento de `bloqueado`. Até lá, usar a convenção acima.

### 8.9 Exemplo canônico de registro

```json
{
  "memory_id": "mem_usr_001_proj_context",
  "memory_type": "memoria_longa",
  "entity_type": "project",
  "entity_id": "proj_nv_enavia",
  "title": "Projeto nv-enavia usa Cloudflare Workers com KV para persistência",
  "content_structured": {
    "infrastructure": "Cloudflare Workers",
    "persistence": "KV ENAVIA_BRAIN",
    "language": "JavaScript (ESM)",
    "deploy": "wrangler deploy (manual via workflow_dispatch)",
    "_meta": {}
  },
  "priority": "high",
  "confidence": "high",
  "source": "conversa",
  "created_at": "2026-04-15T00:00:00Z",
  "updated_at": "2026-04-15T00:00:00Z",
  "expires_at": null,
  "is_canonical": false,
  "status": "active",
  "flags": []
}
```

### 8.10 Referência ao schema existente

O shape acima é compatível com `MEMORY_CANONICAL_SHAPE` definido em `schema/memory-schema.js` (PM1). PR2 estenderá esse schema para incluir os novos tipos (`memoria_manual`, tipo dedicado para `memoria_temporaria`) e o nível `bloqueado`. O validator `validateMemoryObject()` do PM1 continuará válido para os campos existentes.

---

## 9. Reconciliação com Schema Existente

Esta seção mapeia os tipos e níveis deste contrato com o código já existente em `schema/memory-schema.js`, para que PR2+ saiba exatamente o que mudar.

### 9.1 Tipos de memória — mapeamento

| Tipo canônico (este contrato) | `MEMORY_TYPES` existente | Ação em PR2 |
|---|---|---|
| `conversa_atual` | `LIVE_CONTEXT` | Renomear ou criar alias |
| `memoria_longa` | `USER_PROFILE` + `PROJECT` + `OPERATIONAL_HISTORY` | Consolidar sob tipo semântico + manter subtipos técnicos |
| `memoria_manual` | (ausente) | Criar `MANUAL` ou usar `source: "painel"` + flag |
| `aprendizado_validado` | `CANONICAL_RULES` | Renomear ou criar alias |
| `memoria_temporaria` | Subconjunto de `LIVE_CONTEXT` com TTL | Separar em tipo próprio ou flag |

### 9.2 Níveis de confiança — mapeamento

| Nível canônico (este contrato) | `MEMORY_CONFIDENCE` existente | Ação em PR2 |
|---|---|---|
| `observado` | `UNVERIFIED` / `LOW` | Unificar sob valor semântico |
| `sugerido` | `MEDIUM` | Renomear ou criar alias |
| `validado` | `HIGH` / `CONFIRMED` | Unificar sob valor semântico |
| `bloqueado` | (ausente) | Criar `BLOCKED` em PR2 |

---

## 10. O Que Este Contrato Não Define (Deliberadamente)

Os itens abaixo pertencem a PRs futuras e **não foram incluídos** aqui por contrato:

| Item | PR responsável |
|---|---|
| Schema de persistência real executável (KV keys, D1 tables, R2 buckets) | PR2 |
| Pipeline de retrieval, busca semântica, separação histórico × conversa | PR3 |
| Interface do painel para leitura/escrita de `memoria_manual` | PR4 |
| Fluxo de aprovação humana para `aprendizado_validado` | PR5 |
| Telemetria de memória, alertas de staleness, testes reais de memória | PR6 |
| Integração com chat/runtime (uso em produção) | PR3+ |
| Código executável de qualquer operação de memória | PR2+ |
| Migração dos tipos existentes do schema para este contrato | PR2 |

---

## 11. Critério de Aceite da PR1

- [x] Contrato fechado com definição de todos os 5 tipos de memória
- [x] Contrato fechado com definição de todos os 4 níveis de confiança
- [x] Regra de ouro definida sem ambiguidade
- [x] Critérios de leitura documentados com ordem de prioridade
- [x] Critérios de escrita documentados por tipo
- [x] Política de expiração com TTL por tipo
- [x] Política de conflito com hierarquia de resolução
- [x] Formato canônico do registro com todos os campos
- [x] Sem código funcional de memória
- [x] Reconciliação com schema existente documentada
- [x] Arquitetura clara o suficiente para guiar PR2–PR6

---

*Documento gerado em: 2026-04-15 | Branch: `copilot/pr1-canonico-memoria-enavia` | Escopo: PR1 exclusivo*
