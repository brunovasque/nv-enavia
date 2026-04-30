# Obsidian Brain — Grafo de Relações

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental. Grafo textual — não há visualização automática nesta PR.

---

## 1. Como os arquivos se conectam

O brain não é uma pasta plana. Os arquivos se relacionam por referência textual:
links diretos entre arquivos, `→` para indicar fluxo lógico, e backlinks que permitem
navegar de qualquer ponto para sua origem.

---

## 2. Padrão de Backlink Textual

Todo arquivo do brain que referencia outro deve usar o padrão:

```
→ [arquivo referenciado](caminho/relativo/ao/arquivo.md)
```

Quando um arquivo de relatório, policy ou contrato for a fonte, usar caminho absoluto:

```
→ schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md
→ schema/policies/MODE_POLICY.md
→ schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
```

---

## 3. Grafo Principal do Brain

```
brain/INDEX.md
├── brain/ARCHITECTURE.md
├── brain/GRAPH.md (este arquivo)
├── brain/MEMORY_RULES.md
├── brain/RETRIEVAL_POLICY.md
├── brain/UPDATE_POLICY.md
├── brain/SYSTEM_AWARENESS.md
│
├── brain/maps/INDEX.md
│   └── → schema/system/ENAVIA_SYSTEM_MAP.md
│   └── → schema/system/ENAVIA_ROUTE_REGISTRY.json
│   └── → schema/system/ENAVIA_WORKER_REGISTRY.md
│
├── brain/decisions/INDEX.md
│   └── → schema/reports/ (decisões registradas nos relatórios)
│   └── → schema/contracts/active/ (decisões contratuais)
│
├── brain/contracts/INDEX.md
│   └── → schema/contracts/INDEX.md
│   └── → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
│
├── brain/memories/INDEX.md
│   └── → schema/policies/MODE_POLICY.md
│   └── → schema/handoffs/ENAVIA_LATEST_HANDOFF.md
│
├── brain/incidents/INDEX.md
│   └── brain/incidents/chat-engessado-readonly.md
│       └── → schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md
│       └── → schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md
│       └── → schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md
│       └── → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md
│       └── → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md
│       └── → schema/policies/MODE_POLICY.md
│       └── → brain/self-model/INDEX.md
│
├── brain/learnings/INDEX.md
│   └── → brain/incidents/ (aprendizados derivados de incidentes)
│
├── brain/open-questions/INDEX.md
│   └── → schema/contracts/active/ (questões abertas pelo contrato)
│
└── brain/self-model/INDEX.md
    └── → schema/policies/MODE_POLICY.md
    └── → schema/skills/INDEX.md
    └── → brain/SYSTEM_AWARENESS.md
```

---

## 4. Exemplo de Grafo — Incidente Chat Engessado

Este é o grafo de relações do incidente mais documentado até a PR39:

```
brain/incidents/chat-engessado-readonly.md
    → schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md   (diagnóstico original)
    → schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md  (refinamento técnico)
    → schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md (decisão de mode policy)
    → schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md     (implementação)
    → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md  (prova com achados)
    → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md   (correção final)
    → schema/policies/MODE_POLICY.md                       (policy resultante)
    → brain/self-model/INDEX.md                            (como isso afeta identidade)
    → brain/decisions/INDEX.md                             (decisão de separar gate de tom)
    → brain/learnings/INDEX.md                             (aprendizado do ciclo PR32-PR38)
```

---

## 5. Relações entre Camadas do Brain e Resto do Sistema

```
[Contrato Ativo]
schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
    → brain/contracts/INDEX.md        (resumo navegável)
    → brain/decisions/INDEX.md        (decisões que derivam do contrato)
    → brain/open-questions/INDEX.md   (questões abertas do contrato)
    → brain/SYSTEM_AWARENESS.md       (fonte de verdade: contrato ativo)

[Mapas de Sistema]
schema/system/ENAVIA_SYSTEM_MAP.md
schema/system/ENAVIA_ROUTE_REGISTRY.json
schema/system/ENAVIA_WORKER_REGISTRY.md
    → brain/maps/INDEX.md             (mapa navegável no brain)
    → brain/SYSTEM_AWARENESS.md       (consciência situacional)

[Skills Documentais]
schema/skills/INDEX.md
schema/skills/CONTRACT_LOOP_OPERATOR.md
schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md
schema/skills/SYSTEM_MAPPER.md
schema/skills/CONTRACT_AUDITOR.md
    → brain/self-model/INDEX.md       (capacidades reais)
    → brain/SYSTEM_AWARENESS.md       (skills ativas vs. futuras)

[Mode Policy]
schema/policies/MODE_POLICY.md
    → brain/MEMORY_RULES.md           (regra: read_only é gate, não tom)
    → brain/incidents/chat-engessado-readonly.md  (incidente que gerou a policy)
    → brain/self-model/INDEX.md       (como responder)
    → brain/memories/INDEX.md         (preferências de operação)
```

---

## 6. Relações entre Tipos de Memória

```
incidents/ → learnings/     (incidente gera aprendizado)
incidents/ → decisions/     (incidente pode gerar decisão de arquitetura)
decisions/ → memories/      (decisão pode virar regra operacional recorrente)
learnings/ → open-questions/ (aprendizado pode abrir nova questão)
open-questions/ → decisions/ (questão respondida vira decisão)
self-model/ → memories/     (identidade alimenta preferências)
contracts/ → decisions/     (contrato orienta decisões)
maps/ → SYSTEM_AWARENESS    (mapa alimenta consciência situacional)
```

---

## 7. Evolução do Grafo

O grafo cresce a cada PR que:
- Cria novo incidente
- Registra nova decisão
- Documenta novo aprendizado
- Responde questão aberta
- Atualiza self-model
- Adiciona mapa

Nenhuma conexão de runtime existe ainda. As conexões são todas textuais e navegáveis por operadores.
