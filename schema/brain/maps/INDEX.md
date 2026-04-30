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

## Estado desta pasta na PR39

Pasta criada como esqueleto. Nenhum mapa foi populado nesta PR.
Os mapas serão adicionados em PRs futuras conforme o brain for populado.
