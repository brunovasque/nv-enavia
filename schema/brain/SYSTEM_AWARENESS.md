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
- **Próxima PR autorizada:** PR40 — PR-DOCS — Self Model da Enavia
- **Última PR concluída:** PR39 — PR-DOCS — Arquitetura do Obsidian Brain
- **PRs concluídas do contrato:** PR31–PR39

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

### O que a Enavia pode afirmar (baseado em fonte — atualizado após PR39)

- **Última PR mergeada:** PR38 — PR-IMPL — Correção achados PR37 anti-bot (56/56 ✅)
- **Frente 2 corretiva (PR32-PR38):** Encerrada ✅. Teste anti-bot: 56/56.
- **Frente anti-bot (PR36-PR38):** `read_only` é gate de execução, não tom. Sanitizers preservam prosa útil. `isOperationalMessage` usa termos compostos.
- **Runtime:** Estável. Nenhum runtime alterado em PR39.
- **PR em andamento:** PR39 — PR-DOCS — Arquitetura do Obsidian Brain (esta PR)

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

## 6. Estado do sistema (atualizado após PR55)

| Componente | Estado |
|-----------|--------|
| Estrutura documental (`schema/brain/`) | ✅ Criada (PR39) |
| Brain Loader read-only | ✅ Ativo (PR43) |
| LLM Core v1 | ✅ Ativo (PR46+PR48) |
| Intent Classifier v1 | ✅ Ativo (PR49) |
| Skill Router read-only | ✅ Ativo (PR51) |
| Intent Retrieval v1 | ✅ Ativo (PR53) |
| Self-Audit Framework | ✅ Documental (PR55) — `schema/self-audit/` |
| Self-Audit runtime | ❌ Não existe ainda — previsto para PR56 |
| Runtime de memory update | ❌ Não existe ainda — previsto para PR60 |
| `/skills/run` | ❌ Não existe — skills são documentais |

> O Self-Audit Framework foi criado na PR55 como documentação.
> Nenhum runtime de Self-Audit existe ainda. A PR56 implementará `schema/enavia-self-audit.js`.
> Ver `schema/self-audit/INDEX.md` para detalhes do framework.

---

## 7. Estado após PR60 — Stack cognitiva validada

> **Atualizado em:** 2026-05-01 (PR61 — PR-DOCS/IMPL)
>
> **Alerta:** PR61 é documental/IMPL de memória proposta. Nenhum runtime foi alterado.
> Esta seção documenta o estado real do sistema após PR60.

### Módulos ativos no runtime

| Módulo | Arquivo | Integração | O que faz |
|--------|---------|------------|-----------|
| LLM Core v1 | `schema/enavia-llm-core.js` | `buildChatSystemPrompt` seções 1-4 | Identidade, capacidades, limites consolidados |
| Brain Context | `schema/enavia-brain-loader.js` | `buildChatSystemPrompt` seção 7c | Snapshot estático do brain (7 fontes, 4.000 chars) |
| Intent Classifier | `schema/enavia-intent-classifier.js` | `/chat/run` campo `intent_classification` | 15 intenções canônicas |
| Skill Router | `schema/enavia-skill-router.js` | `/chat/run` campo `skill_routing` | 4 skills documentais, roteamento read-only |
| Intent Retrieval | `schema/enavia-intent-retrieval.js` | `buildChatSystemPrompt` seção 7d | Contexto de skill por intenção, 2.000 chars |
| Self-Audit | `schema/enavia-self-audit.js` | `/chat/run` campo `self_audit` | 10 categorias de risco, read-only |
| Response Policy | `schema/enavia-response-policy.js` | `buildChatSystemPrompt` seção 7e | 15 regras de resposta, orientação ao LLM |

### Módulos read-only (detectam mas não executam)

| Módulo | O que detecta | O que NÃO faz |
|--------|---------------|----------------|
| Self-Audit | 10 categorias de risco | Não bloqueia fluxo (exceto secret_exposure) |
| Response Policy | Tipo de resposta adequado | Não reescreve reply automaticamente |
| Skill Router | Skill mais adequada | Não executa skill |
| Intent Retrieval | Contexto de skill por intenção | Não acessa KV/rede/FS em tempo real |

### Módulos inexistentes (documentados, não implementados)

| O que não existe | Por que importa saber |
|-----------------|----------------------|
| `/skills/run` | Skills são documentais — nenhuma executa automaticamente |
| Skill Executor runtime | Executor de skills não foi implementado |
| Escrita automática de memória | Brain é read-only — nenhum módulo escreve automaticamente |
| Self-Audit blocking mecânico | Audit detecta mas não bloqueia (exceto secret_exposure) |
| Response Policy rewrite | Policy orienta mas não reescreve reply mecanicamente |

### Próximo foco

- **PR61** (esta PR): Proposta de atualização de memória — documental/IMPL
- **PR62** (próxima): PR-DIAG — Planejamento da próxima fase pós-Jarvis Brain
  - Ou PR-DOCS se a memória estiver incompleta após PR61

### Finding I1 (documentado, não corrigido)

- "você já consegue executar skills de verdade?" retorna `unknown` em vez de `capability_question`
- Impacto: baixo — sistema seguro mesmo com unknown
- Correção: PR futura dedicada (adicionar variantes à `_CAPABILITY_TERMS`)

---

## 8. Estado após PR64 — modo vigente

> **Adicionado em:** 2026-05-02 (PR64 — PR-DOCS)
>
> Esta seção documenta o estado do sistema após a formalização documental da PR64.
> Nenhum runtime foi alterado. Nenhum endpoint foi criado.

### Mecanismo de atualização de memória

| Item | Estado |
|------|--------|
| Atualização de memória | **Manual via PR** — agente propõe, operador aprova ao mergear |
| Escrita automática de memória | **Inexistente / on-hold** |
| G3 (escrita automática) | **on-hold** — não blocking |
| `/memory/write` | **Não existe** — não criar antes do Runtime de Skills |
| `/brain/write` | **Não existe** — não criar antes do Runtime de Skills |

### Runtime de Skills

| Item | Estado |
|------|--------|
| Runtime de Skills | **Próxima frente liberada para blueprint** |
| `/skills/run` | **Não existe** — skills continuam documentais |
| Skill Executor | **Não existe** — não implementado |
| Blueprint Runtime de Skills | **Autorizado** — PR65 (PR-DOCS) |

### Decisão PR63/PR64

- Frente de atualização supervisionada de memória: **formalmente encerrada/absorvida** por enquanto.
- O fluxo manual via PR é o mecanismo vigente, supervisionado e suficiente.
- Não faz sentido implementar escrita automática antes de existirem skills executando e gerando conteúdo real.
- Finding I1 documentado, não corrigido — baixo impacto, PR futura dedicada.

---

## 9. Estado após PR65 — Blueprint Runtime de Skills

> **Adicionado em:** 2026-05-02 (PR65 — PR-DOCS)
>
> Esta seção documenta o estado do sistema após a criação do blueprint documental do Runtime de Skills.
> Nenhum runtime foi alterado. Nenhum endpoint foi criado.

### Blueprint criado

| Item | Estado |
|------|--------|
| Blueprint Runtime de Skills | ✅ Criado na PR65 — `schema/skills-runtime/` |
| Runtime de Skills | ❌ NÃO EXISTE — blueprint apenas |
| `/skills/run` | ❌ NÃO EXISTE |
| `/skills/propose` | ❌ NÃO EXISTE |
| Skill Executor | ❌ NÃO EXISTE |
| Execução de skill | ❌ Nenhuma skill executa automaticamente |

### O que o blueprint define

- **Arquitetura:** fluxo de 11 camadas — `schema/skills-runtime/ARCHITECTURE.md`
- **Contrato de execução:** formato JSON + regras — `schema/skills-runtime/EXECUTION_CONTRACT.md`
- **Gates de aprovação:** 3 categorias + gate absoluto — `schema/skills-runtime/APPROVAL_GATES.md`
- **Matriz de capacidades:** 4 skills, estado + futuro — `schema/skills-runtime/SKILL_CAPABILITY_MATRIX.md`
- **Modelo de segurança:** 7 categorias de risco + allowlist — `schema/skills-runtime/SECURITY_MODEL.md`
- **Rollout:** 7 fases (Fase 0–6) — `schema/skills-runtime/ROLLOUT_PLAN.md`
- **Open questions:** 12 perguntas para PR66 — `schema/skills-runtime/OPEN_QUESTIONS.md`

### Próxima etapa

**PR66 — PR-DIAG — Diagnóstico técnico para Runtime de Skills**
Responder 12 perguntas abertas com evidência do repositório. Não implementar.

---

## 10. Estado após PR67 — Hardening criado

> **Adicionado em:** 2026-05-02 (PR67 — PR-HARDENING)
>
> Esta seção documenta o estado do sistema após a criação do pacote de hardening do Runtime de Skills.
> Nenhum runtime foi alterado. Nenhum endpoint foi criado. Nenhum código alterado.

### Estado pós-PR67

| Item | Estado |
|------|--------|
| Blueprint Runtime de Skills | ✅ Criado na PR65 — `schema/skills-runtime/` |
| Diagnóstico técnico | ✅ Criado na PR66 — `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md` |
| Pacote de hardening | ✅ Criado na PR67 — `schema/hardening/` |
| Runtime de Skills | ❌ **NÃO EXISTE** — hardening criado, runtime aguarda PR-IMPL futura |
| `schema/enavia-skill-executor.js` | ❌ **NÃO EXISTE** — não foi criado |
| `/skills/propose` | ❌ **NÃO EXISTE** — endpoint não criado |
| `/skills/run` | ❌ **NÃO EXISTE** — endpoint não criado, aguarda Fase 5 (PR73+) |
| Execução de skill | ❌ **Nenhuma skill executa** — completamente documental |
| Binding/secrets novos | ❌ **Nenhum** — zero bindings adicionados |

### O que o hardening define

- **Segurança:** deny-by-default D1–D10, allowlist, aprovação humana — `schema/hardening/SKILLS_RUNTIME_HARDENING.md`
- **Custo e limites:** C1–C5 riscos, limites por request/tempo/LLM/KV — `schema/hardening/COST_LIMITS.md`
- **Blast radius:** níveis 0–4, gates mínimos, regras B1–B7 — `schema/hardening/BLAST_RADIUS.md`
- **Rollback policy:** por artefato, regra PR-PROVA com falha — `schema/hardening/ROLLBACK_POLICY.md`
- **Go/No-Go checklist:** 32 critérios, 5 categorias — `schema/hardening/GO_NO_GO_CHECKLIST.md`

### Restrições absolutas do estado atual

- **`/skills/run` não existe e NÃO deve ser criado antes de `/skills/propose`**
- **`/skills/propose` não existe e só pode ser criado após PR-IMPL autorizada pelo contrato**
- **Nenhuma skill executa** — todas são documentais
- **Fase proposal-only** está limitada a blast radius níveis 0 e 1

### Próxima etapa

**PR68 — PR-DOCS/PR-PROVA — Fechamento do Jarvis Brain v1**
(se hardening completo)

Ou **PR68 — PR-HARDENING** se algum critério do hardening estiver incompleto.

---

## 11. Estado após PR68 — Fechamento do Jarvis Brain v1

> **Adicionado em:** 2026-05-02 (PR68 — PR-DOCS/PR-PROVA)
>
> Esta seção documenta o estado final do sistema após o fechamento formal do ciclo Jarvis Brain v1.
> Nenhum runtime foi alterado. Nenhum endpoint foi criado. Esta é uma PR documental/governança pura.

### Estado final do Jarvis Brain v1

| Item | Estado |
|------|--------|
| Contrato Jarvis Brain v1 | ✅ **ENCERRADO FORMALMENTE** nesta PR68 |
| Frentes concluídas | ✅ 22 frentes concluídas ou formalmente absorvidas |
| Stack cognitiva | ✅ LLM Core + Brain Loader + Intent Classifier + Skill Router + Intent Retrieval + Self-Audit + Response Policy |
| Provas principais | ✅ 236/236 na prova anti-bot final (PR60) |
| Hardening | ✅ Pacote completo `schema/hardening/` criado na PR67 |
| Runtime de Skills | ❌ **NÃO EXISTE** — planejado, diagnosticado e hardenizado; aguarda novo contrato |
| `schema/enavia-skill-executor.js` | ❌ **NÃO EXISTE** — não criado neste ciclo |
| `/skills/propose` | ❌ **NÃO EXISTE** — aguarda novo contrato |
| `/skills/run` | ❌ **NÃO EXISTE** — aguarda novo contrato |
| `/memory/write` | ❌ **NÃO EXISTE** — mecanismo manual via PR é o vigente |
| Próxima PR autorizada | ⬜ **Aguardando novo contrato da próxima fase** |

### Lacunas non-blocking registradas

- G1: Runtime de Skills não implementado (por decisão)
- G2: Endpoint `/skills/propose` não criado (por decisão)
- G3: Escrita automática de memória on-hold (por decisão PR63/PR64)
- G4: Finding I1 (regex Self-Audit) não corrigido (baixo impacto)
- G5: Painel usa `target: read_only` como default (contornado por LLM Core)

### Restrições absolutas do estado atual

- **Nenhuma PR-IMPL pode ser iniciada sem novo contrato explícito**
- **Go/No-Go checklist (`schema/hardening/GO_NO_GO_CHECKLIST.md`) deve ser satisfeito antes de qualquer PR-IMPL de runtime**
- **`/skills/run` e `/skills/propose` não existem e não devem ser criados fora de contrato**
- **Operador humano deve criar o próximo contrato antes de retomar implementação**

### Artefatos de fechamento

- `schema/reports/PR68_FECHAMENTO_JARVIS_BRAIN_V1.md` — relatório completo
- `schema/reports/PR68_JARVIS_BRAIN_V1_CHECKLIST.md` — checklist de fechamento

---

## 12. Como Evitar Alucinação Geral

1. **Sempre citar a fonte** ao afirmar algo sobre o sistema.
2. **Marcar incerteza explicitamente** quando não há fonte.
3. **Verificar datas** dos arquivos de estado antes de usá-los.
4. **Não extrapolar** de uma PR passada para estado atual sem verificar.
5. **Parar e declarar** quando há conflito entre fontes em vez de escolher silenciosamente.
