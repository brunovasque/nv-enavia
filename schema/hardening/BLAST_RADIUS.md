# ENAVIA — Blast Radius: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — nenhum runtime implementado

---

## 1. Definição

**Blast radius** é o alcance máximo de dano que uma ação incorreta, não autorizada ou acidental pode causar ao sistema e ao ambiente externo.

Mapear o blast radius antes de implementar permite:
- Definir gates proporcionais ao risco real
- Priorizar proteções onde o impacto é maior
- Definir rollback antes de executar

---

## 2. Níveis de blast radius

### Nível 0 — Sem side effect

**Descrição:** Ação não altera nenhum estado. Completamente reversível ou sem efeito externo.

**Exemplos de ações neste nível:**
- Gerar proposta de skill (proposal-only)
- Classificar intenção do usuário
- Rotear skill (read-only)
- Gerar contexto de execução
- Auditar resposta (Self-Audit)
- Classificar risco de execução

**Blast radius:** Sistema interno apenas. Nenhum dado externo afetado.

**Gate mínimo:**
- `skill_id` válido no allowlist ✅
- `mode: proposal` ou `mode: read_only` declarado ✅
- Self-Audit executado ✅
- Evidence registrada ✅
- Sem aprovação humana obrigatória (mas recomendada)

---

### Nível 1 — Leitura

**Descrição:** Ação lê dados do sistema mas não altera nada. Reversível por natureza.

**Exemplos de ações neste nível:**
- Ler documentos do repositório
- Ler status do sistema
- Ler registry de skills
- Ler relatórios de diagnóstico
- Ler contrato ativo
- Inspecionar diff de PR

**Blast radius:** Nenhum dado alterado. Risco de exposição de informação sensível se não filtrado.

**Gate mínimo:**
- `skill_id` válido no allowlist ✅
- `mode: read_only` declarado ✅
- Allowlist de fontes permitidas ✅
- Self-Audit executado ✅
- Evidence com lista de fontes lidas ✅
- Filtro de secrets obrigatório no output ✅

---

### Nível 2 — Escrita documental

**Descrição:** Ação cria ou altera arquivos no repositório via PR. Reversível por revert.

**Exemplos de ações neste nível:**
- Criar/alterar arquivos em `schema/`
- Atualizar contrato ativo
- Atualizar memória do brain via PR
- Criar relatório de diagnóstico
- Atualizar governança

**Blast radius:** Repositório afetado. Operações revertíveis por `git revert`.
Risco de propagação: agente futuro pode ler estado incorreto se PR com erro for mergeada.

**Gate mínimo:**
- Aprovação humana explícita (merge da PR) ✅
- Diff pré/pós documentado ✅
- Contrato autoriza o escopo ✅
- Rollback = revert do commit ✅
- Nenhum arquivo `.js`, `.ts`, `.toml`, `.yml` alterado fora do escopo ✅

---

### Nível 3 — Ação operacional

**Descrição:** Ação afeta ambiente de teste/staging. Reversível com esforço.

**Exemplos de ações neste nível:**
- Deploy em ambiente TEST
- Rollback em ambiente TEST
- Acionar executor em TEST
- Alterar Worker em ambiente de teste
- Criar/alterar binding em TEST

**Blast radius:** Ambiente TEST afetado. Possível quebra de smoke tests.
Risco de propagação: dados de teste podem ser perdidos. Configurações de TEST podem ficar em estado inconsistente.

**Gate mínimo:**
- Aprovação humana explícita e documentada ✅
- Checklist pré-operação completo ✅
- Smoke test definido pós-operação ✅
- Health check pós-operação ✅
- Rollback definido antes de executar ✅
- Rollback testado previamente (ou documentado) ✅
- Notificação ao operador obrigatória ✅

---

### Nível 4 — Produção / Sensível

**Descrição:** Ação afeta produção, secrets ou tem efeito externo irreversível.

**Exemplos de ações neste nível:**
- Deploy em PROD
- Alteração de secrets
- Alteração de KV em PROD
- Criação de endpoint público
- Side effects externos (webhooks, APIs de terceiros)
- Merge automático de PR
- Revogação de credencial

**Blast radius:** Sistema de produção afetado. Usuários reais impactados.
Risco de propagação: perda de dados, exposição de secrets, indisponibilidade do serviço, efeitos em sistemas externos.

**Gate mínimo:**
- Aprovação humana explícita, documentada e rastreável ✅
- Checklist pré-deploy completo ✅
- Smoke test definido e executado pós-deploy ✅
- Health check contínuo pós-deploy ✅
- Rollback imediato definido, testado e documentado ✅
- Janela de manutenção ou baixo tráfego preferida ✅
- Nenhuma operação automática sem gate humano ✅
- Log completo de operação retido ✅
- Notificação ao operador antes E depois ✅

---

## 3. Matriz de blast radius por skill

| Skill | Modo | Nível | Gate mínimo |
|-------|------|-------|-------------|
| `CONTRACT_LOOP_OPERATOR` | `read_only` | Nível 1 | Allowlist + Self-Audit + Evidence |
| `CONTRACT_LOOP_OPERATOR` | `proposal` | Nível 0 | Allowlist + Self-Audit + Evidence |
| `CONTRACT_AUDITOR` | `read_only` | Nível 1 | Allowlist + Self-Audit + Evidence |
| `CONTRACT_AUDITOR` | `proposal` | Nível 0 | Allowlist + Self-Audit + Evidence |
| `SYSTEM_MAPPER` | `read_only` | Nível 1 | Allowlist + Self-Audit + Evidence |
| `SYSTEM_MAPPER` | `proposal` (repo_write) | Nível 2 | Aprovação humana + Diff + Rollback |
| `DEPLOY_GOVERNANCE_OPERATOR` | `proposal` | Nível 0 | Allowlist + Self-Audit + Evidence |
| `DEPLOY_GOVERNANCE_OPERATOR` | `approved_execution` (TEST) | Nível 3 | Gate completo de nível 3 |
| `DEPLOY_GOVERNANCE_OPERATOR` | `approved_execution` (PROD) | Nível 4 | Gate completo de nível 4 |

---

## 4. Regras de contenção

| Regra | Descrição |
|-------|-----------|
| B1 | Toda PR-IMPL deve declarar o nível de blast radius das ações que implementa |
| B2 | Nenhuma PR-IMPL de nível 3 ou 4 sem PR-DIAG dedicada desta operação |
| B3 | Nenhuma PR-IMPL de nível 4 sem gate de aprovação funcional e validado (PR-PROVA) |
| B4 | Escalação de nível é permitida apenas com contrato explícito |
| B5 | Skills que atingem nível 3 ou 4 devem ter rollback definido antes de implementar |
| B6 | Toda transição de nível 2 para 3 exige nova PR-DIAG |
| B7 | Fase proposal-only é limitada a níveis 0 e 1 — sem exceção |

---

## 5. Estado atual do blast radius

| Estado | Valor |
|--------|-------|
| Nível máximo atual | **Nível 0** (apenas propostas documentais) |
| Runtime de Skills | ❌ Não existe |
| Endpoints de skills | ❌ Não existem |
| Blast radius real | Nenhum — sistema completamente documental |

---

## 6. O que este documento NÃO implementa

- Não cria mecanismo de contenção no código atual
- Não ativa nenhum gate de blast radius
- Não limita nenhuma skill existente
- Todo conteúdo aqui é documentação para implementação futura

---

## Backlinks

- `schema/hardening/INDEX.md`
- `schema/hardening/SKILLS_RUNTIME_HARDENING.md`
- `schema/skills-runtime/APPROVAL_GATES.md`
- `schema/skills-runtime/ROLLOUT_PLAN.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
