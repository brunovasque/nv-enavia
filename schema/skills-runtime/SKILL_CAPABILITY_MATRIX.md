# ENAVIA — Runtime de Skills: Matriz de Capacidades

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhuma skill executa automaticamente

---

## 1. Estado geral das skills

Todas as 4 skills da Enavia são **documentais e read-only** no momento.
O Runtime de Skills não existe. Nenhuma executa automaticamente.

---

## 2. Skill 1 — CONTRACT_LOOP_OPERATOR

**Arquivo:** `schema/skills/CONTRACT_LOOP_OPERATOR.md`
**PR de origem:** PR26 (contrato PR17-PR30)

### Estado atual

| Campo | Valor |
|-------|-------|
| Estado | Documental 📄 |
| Execução automática | ❌ Não possível sem runtime |
| Skill Router | ✅ Roteia para esta skill (read-only) |
| Intent Retrieval | ✅ Fornece contexto desta skill |

### O que a skill descreve (capacidade documental)

- Orientar operador sobre próxima PR autorizada pelo contrato
- Identificar bloqueios no loop contratual
- Sugerir sequência de PRs
- Gerar instrução para o agente executar a próxima PR

### Capacidade futura (quando runtime existir)

| Ação | Modo | Risco | Aprovação | Pode executar sozinha? |
|------|------|-------|-----------|----------------------|
| Orientar sobre próxima PR | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Sugerir sequência de PRs | `proposal` | low | Para executar | ❌ Só proposta |
| Identificar bloqueio contratual | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Gerar instrução de PR | `proposal` | medium | ✅ Obrigatória | ❌ Só proposta — não cria PR |
| Criar PR automaticamente | N/A | high | ✅ Obrigatória | ❌ Não — exige gate + aprovação humana |

### Evidência mínima

- Qual PR foi identificada como próxima
- Qual seção do contrato foi lida
- Por que a próxima PR é aquela e não outra

### Bloqueios atuais

- Runtime de Skills não existe
- Não há endpoint para receber solicitação
- Não há mecanismo de aprovação

### Próxima PR provável

PR66 (diagnóstico) identificará se esta skill precisa de evolução de schema para conectar ao runtime

---

## 3. Skill 2 — DEPLOY_GOVERNANCE_OPERATOR

**Arquivo:** `schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md`
**PR de origem:** PR27 (contrato PR17-PR30)

### Estado atual

| Campo | Valor |
|-------|-------|
| Estado | Documental 📄 |
| Execução automática | ❌ Não possível sem runtime |
| Skill Router | ✅ Roteia para esta skill (read-only) |
| Intent Retrieval | ✅ Fornece contexto desta skill |

### O que a skill descreve (capacidade documental)

- Governança de deploy em TEST e PROD
- Planejamento de rollback
- Sequência de promoção (TEST → PROD)
- Verificação de smoke tests antes de deploy

### Capacidade futura (quando runtime existir)

| Ação | Modo | Risco | Aprovação | Pode executar sozinha? |
|------|------|-------|-----------|----------------------|
| Preparar plano de deploy | `proposal` | medium | ✅ Para executar | ❌ Só proposta |
| Verificar checklist pré-deploy | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Executar deploy TEST | `approved_execution` | high | ✅ Obrigatória | ❌ Nunca sem gate |
| Executar deploy PROD | `approved_execution` | **blocking** | ✅ Obrigatória | ❌ Nunca — sem aprovação humana explícita |
| Executar rollback | `approved_execution` | high | ✅ Obrigatória | ❌ Nunca sem gate |
| Verificar health pós-deploy | `read_only` | low | Recomendada | ⚠️ Somente com evidência |

### Evidência mínima

- Checklist de deploy executado
- Estado do worker antes do deploy
- Resultado do deploy
- Health check pós-deploy

### Bloqueios atuais

- Runtime de Skills não existe
- Deploy exige comandos `wrangler` — não há integração com wrangler no runtime
- Qualquer deploy exige aprovação humana explícita

### Próxima PR provável

Esta skill tem o maior risco de todas. PR66 deve diagnosticar especificamente os requisitos de integração com wrangler.

---

## 4. Skill 3 — SYSTEM_MAPPER

**Arquivo:** `schema/skills/SYSTEM_MAPPER.md`
**PR de origem:** PR28 (contrato PR17-PR30)

### Estado atual

| Campo | Valor |
|-------|-------|
| Estado | Documental 📄 |
| Execução automática | ❌ Não possível sem runtime |
| Skill Router | ✅ Roteia para esta skill (read-only) |
| Intent Retrieval | ✅ Fornece contexto desta skill |

### O que a skill descreve (capacidade documental)

- Manutenção do System Map (`schema/system/ENAVIA_SYSTEM_MAP.md`)
- Atualização do Route Registry (`schema/system/ENAVIA_ROUTE_REGISTRY.json`)
- Atualização do Worker Registry (`schema/system/ENAVIA_WORKER_REGISTRY.md`)
- Atualização de Playbooks e Skills Index

### Capacidade futura (quando runtime existir)

| Ação | Modo | Risco | Aprovação | Pode executar sozinha? |
|------|------|-------|-----------|----------------------|
| Mapear estado atual do sistema | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Identificar rotas não documentadas | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Propor atualização de System Map | `proposal` | medium | ✅ Para executar | ❌ Só proposta |
| Atualizar System Map | `approved_execution` | medium | ✅ Obrigatória | ❌ Nunca sem gate |
| Atualizar Route Registry | `approved_execution` | medium | ✅ Obrigatória | ❌ Nunca sem gate |
| Inventar Worker/Rota | N/A | **blocking** | Proibido | ❌ Nunca — bloqueado por design |

### Evidência mínima

- Quais arquivos foram lidos para gerar o mapa
- Quais inconsistências foram identificadas
- Diff proposto para atualização

### Bloqueios atuais

- Runtime de Skills não existe
- SYSTEM_MAPPER pode mapear mas não pode inventar workers ou rotas

### Próxima PR provável

PR66 pode diagnosticar inconsistências entre o System Map atual e o estado real do sistema.

---

## 5. Skill 4 — CONTRACT_AUDITOR

**Arquivo:** `schema/skills/CONTRACT_AUDITOR.md`
**PR de origem:** PR29 (contrato PR17-PR30)

### Estado atual

| Campo | Valor |
|-------|-------|
| Estado | Documental 📄 |
| Execução automática | ❌ Não possível sem runtime |
| Skill Router | ✅ Roteia para esta skill (read-only) |
| Intent Retrieval | ✅ Fornece contexto desta skill |

### O que a skill descreve (capacidade documental)

- Auditoria de aderência de PRs ao contrato ativo
- Revisão de diff de PR
- Identificação de desvios contratuais
- Sugestão de correção ou merge

### Capacidade futura (quando runtime existir)

| Ação | Modo | Risco | Aprovação | Pode executar sozinha? |
|------|------|-------|-----------|----------------------|
| Revisar diff de PR | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Auditar aderência ao contrato | `read_only` | low | Recomendada | ⚠️ Somente com evidência |
| Sugerir merge | `proposal` | high | ✅ Obrigatória | ❌ Só proposta — não mergeia |
| Sugerir correção | `proposal` | medium | ✅ Para executar | ❌ Só proposta |
| Mergear PR | `approved_execution` | **blocking** | ✅ Obrigatória | ❌ Nunca — ação irreversível |
| Rejeitar PR | `approved_execution` | high | ✅ Obrigatória | ❌ Nunca sem gate |

### Evidência mínima

- Qual PR foi analisada
- Quais seções do contrato foram verificadas
- Lista de achados (conformes e não conformes)

### Bloqueios atuais

- Runtime de Skills não existe
- CONTRACT_AUDITOR pode sugerir merge/correção mas não mergeia automaticamente

### Próxima PR provável

Esta é provavelmente a skill mais segura para implementar primeiro no runtime (modo read_only/proposal com risco baixo).

---

## 6. Resumo da matriz

| Skill | Modo mais seguro | Risco mínimo | Prioridade de implementação |
|-------|-----------------|--------------|----------------------------|
| `CONTRACT_AUDITOR` | `read_only` | low | Alta — risco mais baixo |
| `CONTRACT_LOOP_OPERATOR` | `read_only` | low | Alta — orientação de loop |
| `SYSTEM_MAPPER` | `read_only` | low | Média — útil para diagnóstico |
| `DEPLOY_GOVERNANCE_OPERATOR` | `read_only` (checklist) | high (deploy) | Baixa — alto risco, exige gate robusto |

---

## 7. O que esta matriz NÃO implementa

- Não cria Skill Executor
- Não conecta skills ao runtime
- Não cria endpoints de execução
- Skills continuam documentais após esta PR
