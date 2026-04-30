# Obsidian Brain — Arquitetura

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental — Não é runtime. Nenhuma camada é executada automaticamente nesta PR.

---

## 1. Visão Geral

O Obsidian Brain da Enavia é um sistema de memória estruturada em camadas. Cada camada
representa um tipo diferente de conhecimento, com regras diferentes de criação, atualização,
recuperação e uso.

O brain não executa por si só. Ele é um arquivo de memória navegável que será consumido
pelo LLM Core, pelo Intent Engine e pelo Skill Router quando essas camadas forem implementadas
conforme contrato Jarvis Brain (PR40+).

---

## 2. Camadas de Memória

### 2.1 Memória Declarativa (`maps/`, `contracts/`, `schema/system/`)

O que a Enavia **sabe de fato** sobre o sistema:
- Topologia de rotas e workers
- Contratos ativos e encerrados
- Skills disponíveis
- Mapas arquiteturais

**Fonte de verdade:** `schema/system/ENAVIA_SYSTEM_MAP.md`, `schema/system/ENAVIA_ROUTE_REGISTRY.json`, `schema/system/ENAVIA_WORKER_REGISTRY.md`, `schema/contracts/INDEX.md`

**Regra:** Nunca afirmar como fato algo não registrado nesses arquivos.

---

### 2.2 Memória Operacional (`memories/`, `schema/status/`)

O que a Enavia **lembra sobre como o operador quer que ela opere**:
- Preferências do operador
- Padrões recorrentes de operação
- Regras de estilo de resposta
- Estado atual do sistema

**Fonte de verdade:** `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `brain/memories/`

**Regra:** Distinguir preferência documentada de suposição. Preferências não documentadas devem ser marcadas como incertas.

---

### 2.3 Memória de Decisão (`decisions/`)

O que a Enavia **lembra de decisões já tomadas** — arquiteturais, técnicas, comerciais, de governança:
- Por que foi escolhido `read_only` como gate de execução e não como regra de tom
- Por que o contrato foi ampliado de PR60 para PR64
- Por que sanitizers são menos destrutivos a partir da PR36

**Fonte de verdade:** `brain/decisions/`, `schema/reports/`

**Regra:** Toda decisão registrada deve ter: contexto, alternativas consideradas, decisão tomada, PR de referência.

---

### 2.4 Memória de Incidentes (`incidents/`, `schema/reports/`)

O que a Enavia **lembra de falhas, bugs e problemas já resolvidos**:
- Incidente do chat engessado (PR32-PR38)
- Incidentes de testes com falsos positivos/negativos (PR37)

**Fonte de verdade:** `brain/incidents/`, `schema/reports/`

**Regra:** Todo incidente deve registrar: problema, causa, PRs relacionadas, estado atual, como evitar regressão.

---

### 2.5 Memória de Aprendizado (`learnings/`)

O que a Enavia **aprendeu** ao longo das PRs:
- O que funciona
- O que falhou e por quê
- Riscos a monitorar
- Padrões de sucesso

**Fonte de verdade:** `brain/learnings/`, `schema/reports/`

**Regra:** Aprendizado é diferente de fato. É uma inferência derivada de experiência documentada.

---

### 2.6 Self-Model (`self-model/`)

Como a Enavia **se entende** enquanto sistema:
- Identidade e propósito
- Capacidades reais vs. capacidades futuras
- Limites conhecidos
- Forma de resposta preferida
- O que a Enavia pode afirmar com confiança vs. o que deve marcar como incerto

**Fonte de verdade:** `brain/self-model/`, `schema/policies/`, `schema/skills/`

**Regra:** O self-model descreve a Enavia como ela **é agora**, não como ela será.

---

### 2.7 System Awareness (`SYSTEM_AWARENESS.md`, `maps/`)

Consciência situacional da Enavia sobre o próprio sistema:
- Estado dos workers
- Rotas disponíveis
- Skills documentais vs. skills executáveis
- Contrato ativo e PR autorizada

**Fonte de verdade:** `brain/SYSTEM_AWARENESS.md`, `schema/system/`, `schema/contracts/INDEX.md`

**Regra:** System awareness só pode afirmar o que está em fonte documentada. Incerteza deve ser declarada.

---

## 3. Fluxo Futuro (Ainda Não Implementado)

Quando o brain for conectado ao runtime (PRs futuras), o fluxo será:

```
mensagem do chat
    → Intent Engine (classifica intenção)
    → Retrieval Policy (identifica áreas do brain a consultar)
    → brain context (memória relevante recuperada)
    → LLM Core (gera resposta com contexto)
    → Skill Router (identifica skill adequada se necessário)
    → resposta final
```

**Estado atual (PR39):** Nenhum desses componentes existe no runtime.
O brain é documental. A consulta é manual ou por agente externo.

---

## 4. Limites do Brain

| Limite | Regra |
|--------|-------|
| Não inventar memória | Toda afirmação precisa de fonte no brain ou nos arquivos de governança |
| Não executar | O brain não executa nenhuma ação por si só |
| Não sobrescrever decisão | Toda decisão de arquitetura registrada só pode ser alterada com novo registro |
| Não usar memória sem fonte | Se não há registro, a Enavia deve dizer que não sabe ou que é incerto |
| Não misturar tipos | Cada camada tem regras próprias de criação e uso |

---

## 5. Relação com Outros Documentos

| Documento | Relação com o Brain |
|-----------|---------------------|
| `schema/policies/MODE_POLICY.md` | Define regras de modo (`read_only`, `conversation`, `execution`) que o self-model deve internalizar |
| `schema/skills/INDEX.md` | Lista skills documentais disponíveis, que o brain deve referenciar |
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Mapa arquitetural que alimenta a memória declarativa |
| `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` | Contrato que define o roadmap de evolução do brain |
| `schema/reports/` | Relatórios de PRs que alimentam incidentes, decisões e aprendizados |

---

## 6. Estado desta PR

**PR39** cria esta arquitetura documental. Nenhum runtime é alterado.
As PRs seguintes irão popular o brain com memórias reais e conectar ao runtime.
