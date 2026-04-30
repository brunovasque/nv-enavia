# Brain Map — Rotas (visão navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Resumo navegável — fonte de verdade: `schema/system/ENAVIA_ROUTE_REGISTRY.json`

---

## 1. Para que serve este mapa

Este mapa agrupa as 68 rotas documentadas em `ENAVIA_ROUTE_REGISTRY.json` por
finalidade, para que a Enavia consiga responder de forma rápida:

- A rota X existe?
- Para que serve este grupo?
- Qual rota é operacional, qual é só leitura, qual é administrativa?
- Antes de criar rota nova, o que já existe?

Não substitui o registry. Para qualquer afirmação técnica precisa, abrir o JSON.

---

## 2. Grupos de rotas (visão lógica)

### 2.1 — Chat runtime

| Rota | Tipo | Finalidade |
|------|------|-----------|
| `POST /chat/run` | Operacional | Entrada principal do chat. Roteia mensagem para LLM, aplica sanitizers, retorna `{reply, use_planner, sanitization}` |
| `POST /chat/draft` | Auxiliar | Geração de rascunho usado pelo painel |

> Cuidado: `/chat/run` é onde mora o ciclo de prompt + sanitizers que foi alvo
> de PR32→PR38. Qualquer alteração aqui exige PR-DIAG + PR-IMPL + PR-PROVA.

### 2.2 — Loop contratual

| Rota | Tipo | Finalidade |
|------|------|-----------|
| `POST /contracts/execute-next` | Loop | Pega próxima task autorizada, marca `in_progress` |
| `POST /contracts/complete-task` | Loop | Marca task atual como concluída |
| `POST /contracts/advance-phase` | Loop | Avança para próxima fase quando `phase_complete` |
| `GET  /contracts/loop-status` | Loop | Retorna estado consolidado do loop (queued, in_progress, complete, phase_complete) |

> Estas 4 rotas formam o motor do loop contratual. Foram entregues e provadas
> nas PRs PR17–PR21 (52/52 e 53/53 verdes).

### 2.3 — Contratos (CRUD e leitura)

| Rota | Tipo | Finalidade |
|------|------|-----------|
| `GET /contracts/...` | Leitura | Listar, buscar, ler estado e decomposição de contratos |
| `POST /contracts/...` | Mutação | Criar / atualizar contrato (operações administrativas) |

> Rotas de mutação só podem ser exercidas com gate de execução (não em
> `read_only` operacional).

### 2.4 — Memória / Brain

| Rota | Tipo | Finalidade |
|------|------|-----------|
| `GET /brain/...` | Leitura | Consultar módulos de brain armazenados em KV |
| `POST /brain/...` | Mutação | Atualizar módulos de brain (sob gate) |
| `GET /memory/...` | Leitura | Consultar trails, decisões, eventos |
| `POST /memory/...` | Mutação | Registrar eventos / consolidar memória |

> O Obsidian Brain documental (`schema/brain/`) **não é o mesmo** que
> `ENAVIA_BRAIN` KV. O KV é runtime; o Obsidian Brain é documentação navegável.

### 2.5 — Decisões

| Rota | Tipo | Finalidade |
|------|------|-----------|
| `POST /decisions/...` | Mutação | Registrar decisão (key shapes `decision:latest`, `decision:{id}`) |
| `GET  /decisions/...` | Leitura | Consultar decisões registradas |

### 2.6 — Executor (via service binding `EXECUTOR`)

| Rota | Worker | Finalidade |
|------|--------|-----------|
| `POST /audit` | `enavia-executor` | Auditoria de patch / módulo proposto |
| `POST /propose` | `enavia-executor` | Geração de proposta de patch |

### 2.7 — Deploy (via service binding `DEPLOY_WORKER`)

| Rota | Worker | Finalidade |
|------|--------|-----------|
| `POST /audit` | `deploy-worker` | Audit pré-deploy |
| `POST /apply-test` | `deploy-worker` | Aplicar patch em ambiente TEST |

### 2.8 — Browser (externo)

| Rota | Worker | Finalidade |
|------|--------|-----------|
| `POST /browser/run` | externo (`BROWSER_EXECUTOR_URL`) | Automação de browser (somente PROD; vazio em TEST) |

### 2.9 — Cognitive / Advisor (externo)

| Rota | Worker | Finalidade |
|------|--------|-----------|
| `POST /director/cognitive` | externo (`DIRECTOR_COGNITIVE_URL`) | Director cognitivo / advisor |

### 2.10 — Vercel

| Rota | Worker | Finalidade |
|------|--------|-----------|
| `POST /vercel/patch` | externo (`VERCEL_EXECUTOR_URL`) | Aplicação de patches Vercel |

### 2.11 — Administrativas / Health

| Rota | Tipo | Finalidade |
|------|------|-----------|
| Rotas de health, snapshot, ingestion, audit-log | Administrativa | Inspeção, snapshot e logs operacionais |

> Para o nome exato das rotas, consultar sempre `ENAVIA_ROUTE_REGISTRY.json`.

---

## 3. Rotas que exigem cuidado especial

| Rota / grupo | Motivo |
|--------------|--------|
| `POST /chat/run` | Caminho do LLM + sanitizers + envelope. Foi causa do incidente "chat engessado" (PR32–PR38). |
| `POST /contracts/advance-phase` | Move estado de contrato. PR-DIAG obrigatório antes de qualquer mudança. |
| `POST /audit`, `POST /apply-test` (deploy-worker) | Tocam infra real. Sempre supervisionar com Deploy Governance Operator. |
| Qualquer rota mutadora externa (`/browser/run`, `/vercel/patch`, `/director/cognitive`) | Efeito colateral fora do worker; gate `read_only` deve impedir execução não aprovada. |

---

## 4. Como usar este mapa

### 4.1 — Para revisar um endpoint

1. Localizar o grupo aqui (chat / loop / contratos / memória / executor / deploy / externo).
2. Abrir `ENAVIA_ROUTE_REGISTRY.json` para obter rota, método e binding exatos.
3. Verificar se o endpoint está no `nv-enavia.js` ou em outro worker (executor / deploy).
4. Verificar se há reportes de PR (`schema/reports/`) que tocaram a rota.

### 4.2 — Para responder se uma rota existe

- Se está aqui, está documentada — verificar no registry para confirmar.
- Se não está aqui, **não afirmar que existe**. Abrir o registry; se não estiver lá, declarar que não há registro.
- Nunca inventar rota.

### 4.3 — Para identificar se cabe rota nova

1. Verificar se um grupo já cobre a finalidade.
2. Se sim, propor extensão — não criar rota duplicada.
3. Se não, abrir PR-DIAG no contrato ativo antes de propor PR-IMPL com nova rota.
4. Toda rota nova deve ser refletida em `ENAVIA_ROUTE_REGISTRY.json` (regra do System Mapper).

---

## 5. Backlinks

- → schema/system/ENAVIA_ROUTE_REGISTRY.json
- → schema/system/ENAVIA_SYSTEM_MAP.md
- → schema/system/ENAVIA_WORKER_REGISTRY.md
- → schema/skills/SYSTEM_MAPPER.md
- → brain/maps/system-map.md
- → brain/maps/worker-map.md
- → brain/incidents/chat-engessado-readonly.md
