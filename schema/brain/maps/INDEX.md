# brain/maps — Índice

**Pasta:** `schema/brain/maps/`
**Versão:** 1.0
**Data:** 2026-04-30

---

## Finalidade

Esta pasta contém mapas de arquitetura, rotas, workers, skills e topologia geral
do sistema Enavia. São representações navegáveis que permitem à Enavia ter
consciência situacional da própria infraestrutura.

---

## Tipo de arquivo que mora aqui

- Mapas de arquitetura de alto nível
- Representações simplificadas de rotas e endpoints
- Mapas de dependência entre workers
- Mapas de skills por domínio
- Topologias de deploy
- Referências cruzadas para `schema/system/`

---

## Quando consultar

- Ao responder pergunta sobre arquitetura do sistema
- Ao planejar uma PR que afeta roteamento ou workers
- Ao fazer diagnóstico de um problema de infraestrutura
- Ao verificar se uma rota ou worker existe antes de afirmar

---

## Quando atualizar

- Quando uma nova rota for adicionada ao sistema
- Quando um worker for criado, modificado ou removido
- Quando a topologia de deploy mudar
- Quando um mapa de sistema existente em `schema/system/` for atualizado

---

## Fontes primárias (arquivos em `schema/system/`)

| Arquivo | Conteúdo |
|---------|----------|
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Mapa geral de arquitetura (14 seções) |
| `schema/system/ENAVIA_ROUTE_REGISTRY.json` | 68 rotas documentadas, 0 violações |
| `schema/system/ENAVIA_WORKER_REGISTRY.md` | 18 seções de infraestrutura de workers |

> Os mapas desta pasta são resumos ou derivados dos arquivos acima.
> Para a fonte de verdade, sempre consultar `schema/system/`.

---

## Exemplos de nomes de arquivos

```
system-topology-overview.md
chat-worker-routes.md
executor-worker-routes.md
worker-dependency-map.md
skill-domain-map.md
```

---

## Limites

- Mapas não substituem a fonte primária em `schema/system/`.
- Não criar mapa de algo que não está documentado em `schema/system/`.
- Não descrever estado de produção sem evidência de log ou teste.

---

## Arquivos populados (PR41)

| Arquivo | Conteúdo | Quando consultar |
|---------|----------|------------------|
| `system-map.md` | Resumo navegável do sistema (workers, rotas, contratos, skills, playbooks, registries, relação `nv-enavia.js` ↔ executor ↔ deploy worker ↔ browser ↔ painel ↔ schema) | Antes de afirmar capacidade do sistema; antes de sugerir PR técnica |
| `route-map.md` | Resumo navegável das 68 rotas agrupadas por finalidade (chat, loop, contratos, memória, executor, deploy, externo, admin) | Para revisar endpoint; para responder se uma rota existe; antes de propor rota nova |
| `worker-map.md` | Workers confirmados (PROD/TEST), bindings, KVs, diferenças PROD↔TEST, workers centrais | Antes de afirmar capacidade de worker; antes de tocar deploy/binding/KV |
| `skill-map.md` | 4 skills documentais; quando usar cada uma; o que cada uma **não** faz; status documental vs. ausência de runtime de skills | Para escolher skill; para responder "essa skill executa X?" |

## Estado desta pasta na PR41

Pasta populada com 4 mapas reais derivados de fontes verificadas em
`schema/system/`, `schema/skills/`, `schema/contracts/` e `schema/playbooks/`.
Os mapas são resumos navegáveis — fonte de verdade continua nos arquivos
originais.
