# Brain Map — Sistema Enavia (visão navegável)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Resumo navegável — não substitui `schema/system/ENAVIA_SYSTEM_MAP.md`

---

## 1. Para que serve este mapa

Este é o mapa de bolso da Enavia. Ele resume — em formato curto e navegável —
o que existe no sistema Enavia/Enova hoje. Não é a fonte de verdade; é a porta
de entrada do brain para entender de relance:

- Quais workers existem e qual o papel de cada um
- Quais grupos de rotas estão expostos
- Quais contratos governam o sistema
- Quais skills documentais estão disponíveis
- Quais playbooks e registries devem ser consultados
- Como `nv-enavia.js`, executor, deploy worker, browser, painel e schema se relacionam

> Fonte de verdade: `schema/system/ENAVIA_SYSTEM_MAP.md` (14 seções),
> `schema/system/ENAVIA_ROUTE_REGISTRY.json` (68 rotas),
> `schema/system/ENAVIA_WORKER_REGISTRY.md` (18 seções).

---

## 2. Workers conhecidos

| Worker | Tipo | Papel | Ambiente |
|--------|------|-------|----------|
| `nv-enavia` | Cloudflare Worker (main) | Roteador HTTP, loop contratual, chat runtime, memória, planner, bridge | PROD |
| `enavia-worker-teste` | Cloudflare Worker | Instância TEST do worker principal | TEST |
| `enavia-executor` | Cloudflare Worker (service binding) | Auditoria, propostas de patch, validação de módulos | PROD |
| `enavia-executor-test` | Cloudflare Worker | Executor TEST | TEST |
| `deploy-worker` | Cloudflare Worker (service binding) | Audit, apply-test, promoção PROD, rollback | PROD |
| `deploy-worker-test` | Cloudflare Worker | Deploy TEST | TEST |
| Browser Executor | Externo (URL) | Automação de browser (somente PROD; vazio em TEST) | externo |
| Director Cognitive | Externo (URL) | Director cognitivo / advisor | externo |
| Vercel Executor | Externo (URL) | Patches Vercel | externo |
| Painel ENAVIA | App Vite/React | Interface operacional do operador | externo (frontend) |

> Detalhes em `schema/system/ENAVIA_WORKER_REGISTRY.md` seção 4.

---

## 3. Service bindings principais

| Origem | Binding | Aponta para | Uso típico |
|--------|---------|-------------|-----------|
| `nv-enavia` | `EXECUTOR` | `enavia-executor` (PROD) / `enavia-executor-test` (TEST) | `POST /audit`, `POST /propose` |
| `nv-enavia` | `DEPLOY_WORKER` | `deploy-worker` (PROD) / `deploy-worker-test` (TEST) | `POST /audit`, `POST /apply-test` |

---

## 4. KV namespaces (sem valores de secret)

| Binding KV | Namespace | Uso macro |
|-----------|-----------|-----------|
| `ENAVIA_BRAIN` | `enavia-brain` (PROD) / `enavia-brain-test` (TEST) | Estado de contratos, memória, brain modules, decisões, trails de execução |
| `ENAVIA_GIT` / `GIT_KV` | `ENAVIA_GIT` / `ENAVIA_GIT_TEST` | Snapshots Git do worker (executor) |

> Detalhes e key shapes em `schema/system/ENAVIA_WORKER_REGISTRY.md` seções 6.1–6.3.

---

## 5. Grupos de rotas (visão macro)

68 rotas estão documentadas em `schema/system/ENAVIA_ROUTE_REGISTRY.json`. Os
grupos lógicos:

| Grupo | Exemplos | Worker |
|-------|----------|--------|
| Chat runtime | `/chat/run`, `/chat/draft` | `nv-enavia` |
| Loop contratual | `/contracts/execute-next`, `/contracts/complete-task`, `/contracts/advance-phase`, `/contracts/loop-status` | `nv-enavia` |
| Contratos | `/contracts/...` (CRUD, índice, estado) | `nv-enavia` |
| Memória / Brain | `/brain/...`, `/memory/...` | `nv-enavia` |
| Decisões | `/decisions/...` | `nv-enavia` |
| Executor | `/audit`, `/propose` (via service binding `EXECUTOR`) | `enavia-executor` |
| Deploy | `/audit`, `/apply-test` (via service binding `DEPLOY_WORKER`) | `deploy-worker` |
| Browser | rotas externas em `BROWSER_EXECUTOR_URL` (PROD; vazio em TEST) | externo |
| Cognitive / Advisor | `DIRECTOR_COGNITIVE_URL` | externo |

> Para rotas exatas, sempre consultar `schema/system/ENAVIA_ROUTE_REGISTRY.json`.
> O resumo navegável do brain por rota está em `brain/maps/route-map.md`.

---

## 6. Contratos

| Contrato | PRs | Estado |
|----------|-----|--------|
| `CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md` | PR1–PR7 | Encerrado ✅ |
| `CONTRATO_ENAVIA_OPERACIONAL_PR8_PR13.md` | PR8–PR16 (+ fixes) | Encerrado ✅ |
| `CONTRATO_ENAVIA_LOOP_SKILLS_SYSTEM_MAP_PR17_PR30.md` | PR0, PR17–PR30 | Encerrado ✅ |
| `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` | PR31–PR64 (ampliado) | Ativo 🟢 |

> Resumos navegáveis em `brain/contracts/active.md` e `brain/contracts/closed.md`.
> Fonte de verdade: `schema/contracts/INDEX.md`.

---

## 7. Skills documentais

4 skills documentais existem hoje (todas ativas no plano documental, nenhuma com
runtime executável):

| Skill | Quando usar |
|-------|-------------|
| Contract Loop Operator | Operar o loop contratual supervisionado (execute → complete → advance) |
| Deploy Governance Operator | Audit, apply-test, promoção PROD, rollback |
| System Mapper | Manter System Map / Route Registry / Worker Registry / Playbook / Skills Index |
| Contract Auditor | Auditar aderência contratual de PRs e tarefas |

> Resumo navegável em `brain/maps/skill-map.md`.
> Fonte: `schema/skills/INDEX.md` + arquivos individuais.

---

## 8. Playbooks e registries

| Documento | Localização | Função |
|-----------|------------|--------|
| Operational Playbook | `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` | 18 seções + Apêndice A — procedimentos operacionais |
| System Map | `schema/system/ENAVIA_SYSTEM_MAP.md` | Mapa macro de arquitetura |
| Route Registry | `schema/system/ENAVIA_ROUTE_REGISTRY.json` | 68 rotas, 0 violações |
| Worker Registry | `schema/system/ENAVIA_WORKER_REGISTRY.md` | Inventário de infraestrutura |
| Mode Policy | `schema/policies/MODE_POLICY.md` | 3 modos canônicos; `read_only` é gate, não tom |

---

## 9. Relação entre `nv-enavia.js`, executor, deploy worker, browser, painel e schema

```
[ painel (Vite/React) ]
        │  HTTP
        ▼
[ nv-enavia (Cloudflare Worker principal) ]
        │
        ├── KV ENAVIA_BRAIN  → estado de contratos, memória, decisões, trails
        ├── service binding EXECUTOR        → enavia-executor (audit/propose)
        ├── service binding DEPLOY_WORKER   → deploy-worker (audit/apply-test/rollback)
        ├── chamada HTTP externa            → Browser Executor (PROD)
        ├── chamada HTTP externa            → Director Cognitive
        └── chamada HTTP externa            → Vercel Executor

[ schema/ ]  (governança documental — não é runtime)
        ├── contracts/   → contratos vigentes e encerrados
        ├── system/      → System Map, Route Registry, Worker Registry
        ├── playbooks/   → procedimentos operacionais
        ├── skills/      → skills documentais
        ├── policies/    → Mode Policy
        ├── status/, handoffs/, execution/ → governança operacional
        ├── reports/     → relatórios PR a PR
        └── brain/       → Obsidian Brain documental
```

---

## 10. Como a Enavia deve usar este mapa

1. **Consultar antes de afirmar capacidade.** Se for falar sobre worker, rota,
   binding, KV ou contrato, abrir este mapa primeiro. Se a informação não
   estiver aqui ou na fonte de verdade, declarar incerteza.
2. **Consultar antes de sugerir PR técnica.** Antes de propor uma PR que toca
   roteamento, worker ou deploy, verificar este mapa para entender o que
   existe e o que está autorizado.
3. **Se mapa divergir do runtime, marcar como incerto e abrir diagnóstico.**
   Este mapa é documental. Se houver suspeita de divergência (ex: rota
   removida no código mas listada aqui), tratar como hipótese e propor
   PR-DIAG, nunca como fato.
4. **Não inventar rota, worker, binding ou secret.** Se não está aqui ou na
   fonte de verdade (`schema/system/`, `schema/contracts/`), não existe para
   a Enavia.
5. **Nunca documentar valor de secret.** Bindings, IDs públicos de KV (visíveis
   em `wrangler.toml`) e nomes de variáveis podem ser citados; **valores de
   secret jamais**.

---

## 11. Backlinks

- → schema/system/ENAVIA_SYSTEM_MAP.md
- → schema/system/ENAVIA_ROUTE_REGISTRY.json
- → schema/system/ENAVIA_WORKER_REGISTRY.md
- → schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md
- → schema/skills/INDEX.md
- → schema/policies/MODE_POLICY.md
- → schema/contracts/INDEX.md
- → brain/maps/route-map.md
- → brain/maps/worker-map.md
- → brain/maps/skill-map.md
- → brain/SYSTEM_AWARENESS.md
