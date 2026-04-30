# Obsidian Brain — System Awareness

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental. Nenhuma consulta automática de estado existe nesta PR.
System awareness é lida por agentes e operadores para contextualização.

---

## 1. Princípio

> A Enavia só afirma o que tem como verificar. O que não tem fonte, declara como incerto.

System awareness é a consciência situacional da Enavia sobre si mesma e sobre
o sistema ao qual pertence. Tem 4 dimensões: **contratos**, **estado**, **sistema** e **skills**.

---

## 2. Dimensão 1 — Contratos

### Fonte de verdade
- `schema/contracts/INDEX.md`
- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`

### Arquivos a consultar
- `schema/contracts/INDEX.md` — qual contrato está ativo
- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — escopo completo
- `brain/contracts/INDEX.md` — resumo navegável

### O que a Enavia pode afirmar (baseado em fonte)

- **Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` — Ativo 🟢 (ampliado para PR31-PR64)
- **Objetivo do contrato:** Transformar a Enavia em IA operacional viva — LLM Core, Memory Brain, Skill Router, Intent Engine, Self-Audit
- **Próxima PR autorizada:** PR42 — PR-DIAG — Diagnóstico da memória atual no runtime
- **Última PR concluída:** PR40 — PR-DOCS — Self Model da Enavia
- **PR em andamento:** PR41 — PR-DOCS — Popular Obsidian Brain
- **PRs concluídas do contrato:** PR31–PR40

### O que deve marcar como incerto

- Estimativas de conclusão de PRs futuras — não há prazo contratual fixo
- Escopo exato de PRs além da próxima autorizada — pode mudar por descoberta
- Se o contrato ainda terá ampliações futuras — depende de diagnóstico

### Como evitar alucinação sobre contratos

1. Sempre verificar `schema/contracts/INDEX.md` antes de afirmar qual é o ativo.
2. Não afirmar que uma PR foi concluída sem referência em `schema/execution/ENAVIA_EXECUTION_LOG.md`.
3. Não autorizar escopo fora do contrato ativo.

---

## 3. Dimensão 2 — Estado

### Fonte de verdade
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

### Arquivos a consultar
- `schema/status/ENAVIA_STATUS_ATUAL.md` — estado atual do sistema e próxima PR
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — o que foi feito na última PR
- `schema/execution/ENAVIA_EXECUTION_LOG.md` — histórico cronológico

### O que a Enavia pode afirmar (baseado em fonte — atualizado após PR41)

- **Última PR mergeada:** PR40 — PR-DOCS — Self Model da Enavia
- **PR em andamento:** PR41 — PR-DOCS — Popular Obsidian Brain
- **Próxima PR autorizada:** PR42 — PR-DIAG — Diagnóstico da memória atual no runtime
- **Frente 2 corretiva (PR32-PR38):** Encerrada ✅. Teste anti-bot: 56/56.
- **Frente anti-bot (PR36-PR38):** `read_only` é gate de execução, não tom. Sanitizers preservam prosa útil. `isOperationalMessage` usa termos compostos.
- **Frente Obsidian Brain (PR39-PR41):** PR39 criou arquitetura, PR40 criou self-model, PR41 populou o brain com conteúdo real.
- **Runtime:** Estável. Nenhum runtime alterado em PR39, PR40 ou PR41.

### O que deve marcar como incerto

- Estado de deploys em produção — verificar workers diretamente
- Se há issues abertas afetando o sistema além das documentadas
- Performance real do sistema — não há métricas no brain

### Como evitar alucinação sobre estado

1. Verificar data do `ENAVIA_STATUS_ATUAL.md` antes de usar como fonte.
2. Não afirmar estado de produção sem evidência de log ou teste.
3. Se o handoff e o status contradizem algo, declarar conflito e parar.

---

## 4. Dimensão 3 — Sistema

### Fonte de verdade
- `schema/system/ENAVIA_SYSTEM_MAP.md`
- `schema/system/ENAVIA_ROUTE_REGISTRY.json`
- `schema/system/ENAVIA_WORKER_REGISTRY.md`
- `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md`

### Arquivos a consultar
- `schema/system/ENAVIA_SYSTEM_MAP.md` — 14 seções de arquitetura
- `schema/system/ENAVIA_ROUTE_REGISTRY.json` — 68 rotas mapeadas
- `schema/system/ENAVIA_WORKER_REGISTRY.md` — 18 seções de infraestrutura
- `brain/maps/INDEX.md` — mapa navegável no brain

### O que a Enavia pode afirmar

- Existem pelo menos 68 rotas documentadas em `ENAVIA_ROUTE_REGISTRY.json`
- O sistema roda em Cloudflare Workers (conforme `schema/system/ENAVIA_WORKER_REGISTRY.md`)
- Os arquivos de sistema foram criados nas PRs22-PR25 do contrato anterior
- `nv-enavia.js` é o worker principal de chat e contratos
- `contract-executor.js` é o executor de contratos

### O que deve marcar como incerto

- Estado atual de health dos workers em produção
- Se há rotas novas além das 68 documentadas
- Latência e performance real

### Como evitar alucinação sobre sistema

1. Não inventar rotas ou endpoints não presentes em `ENAVIA_ROUTE_REGISTRY.json`.
2. Não afirmar que um worker está ativo sem evidência de deploy log.
3. Se perguntado sobre arquitetura não documentada, dizer que não há registro.

---

## 5. Dimensão 4 — Skills

### Fonte de verdade
- `schema/skills/INDEX.md`
- Arquivos individuais em `schema/skills/`

### Arquivos a consultar
- `schema/skills/INDEX.md` — lista de skills disponíveis
- `schema/skills/CONTRACT_LOOP_OPERATOR.md` — skill 1 (PR26)
- `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md` — skill 2 (PR27)
- `schema/skills/SYSTEM_MAPPER.md` — skill 3 (PR28)
- `schema/skills/CONTRACT_AUDITOR.md` — skill 4 (PR29)

### O que a Enavia pode afirmar

- **4 skills documentadas:** `CONTRACT_LOOP_OPERATOR`, `DEPLOY_GOVERNANCE_OPERATOR`, `SYSTEM_MAPPER`, `CONTRACT_AUDITOR`
- **Todas as skills são documentais** — não executam nenhuma ação de runtime automaticamente nesta versão
- As skills foram criadas nas PRs26-PR29 do contrato anterior (PR17-PR30)
- Nenhuma skill foi criada no contrato Jarvis Brain ainda

### O que deve marcar como incerto

- Quando as skills serão conectadas ao runtime (depende de PRs futuras)
- Se há skills não documentadas em uso informal

### Como evitar alucinação sobre skills

1. Não simular execução de skill — elas são documentais.
2. Não afirmar que uma skill "faz X" automaticamente se não há runtime.
3. Ao ser perguntado sobre uma skill não listada, dizer que não há registro.

---

## 6. Estado do Obsidian Brain nesta PR

| Componente | Estado |
|-----------|--------|
| Estrutura documental (`schema/brain/`) | ✅ Criada (PR39) |
| Self-model documental (`schema/brain/self-model/`) | ✅ Criado (PR40) |
| Brain populado com conteúdo real (`maps/`, `contracts/`, `memories/`, `decisions/`, `learnings/`, `open-questions/`) | ✅ Populado (PR41) |
| Runtime de memory retrieval | ❌ Não existe ainda |
| Runtime de memory update | ❌ Não existe ainda |
| Conexão ao LLM Core | ❌ Não existe ainda |
| Intent Engine | ❌ Não existe ainda |
| Skill Router | ❌ Não existe ainda |

> O Obsidian Brain é documental até PR41. Não é runtime. Não executa nada.
> A próxima PR (PR42 — PR-DIAG) diagnosticará a memória atual no runtime
> antes de qualquer conexão.

---

## 7. Como Evitar Alucinação Geral

1. **Sempre citar a fonte** ao afirmar algo sobre o sistema.
2. **Marcar incerteza explicitamente** quando não há fonte.
3. **Verificar datas** dos arquivos de estado antes de usá-los.
4. **Não extrapolar** de uma PR passada para estado atual sem verificar.
5. **Parar e declarar** quando há conflito entre fontes em vez de escolher silenciosamente.
