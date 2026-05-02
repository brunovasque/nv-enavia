# ENAVIA — Runtime de Skills: Modelo de Segurança

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhum mecanismo de segurança implementado no runtime

---

## 1. Princípios de segurança

| Princípio | Descrição |
|-----------|-----------|
| **Least Privilege** | Skill só acessa recursos explicitamente declarados |
| **Deny by Default** | Qualquer skill_id desconhecida é negada imediatamente |
| **Allowlist only** | Apenas skills no allowlist podem executar |
| **Human in the loop** | Todo efeito externo exige humano no gate |
| **Evidence trail** | Toda execução (mesmo read-only) gera evidência |
| **Audit mandatory** | Self-Audit executa antes de retornar qualquer resultado |
| **No secret exposure** | Secrets nunca aparecem em outputs ou logs |
| **Rollback by design** | Toda ação reversível deve ter rollback definido antes de executar |

---

## 2. Categorias de risco

### `read_only`

**Descrição:** Skill acessa documentação, arquivos de schema, relatórios. Não gera efeito externo.

**Exemplos:**
- Ler contrato ativo
- Analisar relatório de diagnóstico
- Revisar diff de PR

**Controles:**
- Allowlist de fontes permitidas
- Log de leitura obrigatório
- Self-Audit obrigatório

---

### `repo_write`

**Descrição:** Skill propõe ou executa alterações em arquivos do repositório.

**Exemplos:**
- Atualizar System Map
- Criar relatório no schema
- Atualizar governança

**Controles:**
- Aprovação humana obrigatória
- Diff pré/pós obrigatório como evidência
- Rollback = revert do commit

---

### `deploy`

**Descrição:** Skill propõe ou executa deploy de Worker em TEST ou PROD.

**Exemplos:**
- Deploy de `nv-enavia.js` em TEST
- Promoção de TEST para PROD

**Controles:**
- Aprovação humana obrigatória (explícita, não automática)
- Checklist pré-deploy obrigatório
- Smoke test obrigatório pós-deploy
- Rollback definido antes de executar
- Health check pós-deploy

---

### `external_side_effect`

**Descrição:** Skill invoca API externa, webhook, serviço de terceiros.

**Exemplos:**
- Notificar canal externo
- Invocar API de integração

**Controles:**
- Aprovação humana obrigatória
- Idempotência obrigatória quando possível
- Log completo de request/response
- Sem credenciais em log

---

### `memory_write`

**Descrição:** Skill escreve no brain (memória de longo prazo) do sistema.

**Exemplos:**
- Propor atualização de `schema/brain/memories/`
- Criar novo bloco de memória

**Controles:**
- Aprovação humana obrigatória
- Revisão documental obrigatória
- Não criar antes do Runtime de Skills existir (G3 on-hold)

---

### `secret_sensitive`

**Descrição:** Skill acessa ou processa dados que podem expor secrets.

**Exemplos:**
- Análise de wrangler.toml
- Revisão de configurações de binding

**Controles:**
- **Blocking por padrão** — Self-Audit categoria `secret_exposure`
- Nunca retornar secret em output
- Mascarar qualquer valor sensível no log
- Aprovação humana obrigatória

---

### `irreversible_action`

**Descrição:** Qualquer ação que não pode ser desfeita automaticamente.

**Exemplos:**
- Merge de PR
- Delete de KV namespace
- Revogação de secret

**Controles:**
- **Blocking sem aprovação humana explícita**
- Rollback manual documentado antes de executar
- Log completo obrigatório
- Notificação ao operador obrigatória

---

## 3. Allowlist de skills

```json
{
  "skill_allowlist": [
    "CONTRACT_LOOP_OPERATOR",
    "DEPLOY_GOVERNANCE_OPERATOR",
    "SYSTEM_MAPPER",
    "CONTRACT_AUDITOR"
  ]
}
```

**Regra:** Qualquer `skill_id` fora desta lista → BLOCKED imediatamente.

---

## 4. Regras deny-by-default

| Condição | Ação |
|----------|------|
| `skill_id` não está no allowlist | BLOCKED — retornar erro seguro |
| `skill_id` está no allowlist mas `mode` é inválido | BLOCKED — retornar erro seguro |
| `approval.status !== 'approved'` para `approved_execution` | BLOCKED — não executar |
| `safety.risk_level === 'blocking'` | BLOCKED — não executar |
| Self-Audit detecta `secret_exposure` | BLOCKED — não retornar |
| `execution.evidence` vazia | BLOCKED — não retornar resultado |
| Runtime não reconhece tipo de execução | BLOCKED — fallback seguro |

---

## 5. Proteção de secrets

Secrets nunca devem aparecer em:

- Output retornado ao usuário
- Log de execução (mesmo interno)
- Evidência registrada
- Proposta de execução
- Resposta de erro

**Implementação futura:**
- Filtro de secrets no pipeline de output
- Self-Audit categoria `secret_exposure` bloqueia se detectar padrão de secret
- Allowlist de padrões sensíveis (tokens, keys, passwords)

---

## 6. Registro de evidência obrigatório

Para qualquer execução (mesmo read-only), o seguinte deve ser registrado antes de retornar resultado:

```json
{
  "execution_record": {
    "request_id": "UUID",
    "skill_id": "string",
    "mode": "string",
    "risk_level": "string",
    "approval_status": "string",
    "started_at": "ISO8601",
    "finished_at": "ISO8601",
    "evidence_count": 0,
    "self_audit_passed": false,
    "result_status": "completed | failed | blocked"
  }
}
```

---

## 7. Integração com Self-Audit

| Categoria Self-Audit | Ação no Runtime |
|---------------------|-----------------|
| `secret_exposure` | BLOCKED — mais alto prioridade |
| `fake_execution` | BLOCKED — skill não pode fingir ter executado |
| `unauthorized_action` | BLOCKED — ação fora do escopo da skill |
| `scope_violation` | BLOCKED — skill saiu do seu escopo |
| `false_capability` | BLOCKED — skill não pode afirmar capacidade que não tem |
| `runtime_vs_documentation_confusion` | WARNING — registrar e clarificar |
| `contract_drift` | WARNING — sinalizar para operador |
| `docs_over_product` | WARNING — sinalizar para operador |

---

## 8. Superfície de ataque mínima

Princípio: não expor mais do que o necessário.

| Item | Decisão |
|------|---------|
| Endpoints expostos | Mínimo necessário — não criar por conveniência |
| Skills ativas | Apenas allowlist — nada além |
| Modos de execução | 3 modos declarados — sem modo implícito |
| Acesso a KV | Declarado por skill no contrato de execução |
| Acesso a secrets | Proibido sem aprovação humana |
| Acesso a workers externos | Proibido sem contrato explícito |

---

## 9. O que este modelo NÃO implementa

- Não cria firewall de execução
- Não cria filtro de secrets em runtime
- Não ativa nenhuma regra de segurança no código atual
- Todas as regras aqui são para implementação futura
- A segurança atual do sistema está nos módulos existentes (Self-Audit, Response Policy)

---

## 10. Referência ao pacote de hardening (PR67)

**Data:** 2026-05-02 (PR67)

Este modelo de segurança foi aprofundado pelo pacote de hardening criado na PR67.
Consultar `schema/hardening/` como fonte de verdade para:

- **Deny-by-default:** `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 2 — regras D1–D10
- **Allowlist:** `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 3
- **Aprovação humana:** `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 5
- **Proteção de secrets:** `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 6
- **KV rules:** `schema/hardening/SKILLS_RUNTIME_HARDENING.md` seção 7
- **Blast radius:** `schema/hardening/BLAST_RADIUS.md`
- **Rollback policy:** `schema/hardening/ROLLBACK_POLICY.md`
- **Go/No-Go checklist:** `schema/hardening/GO_NO_GO_CHECKLIST.md`

### Reforço: deny-by-default

O princípio deny-by-default foi formalizado com 10 regras absolutas (D1–D10).
Destacando as mais críticas:

| Regra | Condição bloqueante |
|-------|-------------------|
| D1 | `skill_id` não está no allowlist |
| D5 | Self-Audit detecta `secret_exposure` |
| D8 | `/skills/run` chamado antes de `/skills/propose` existir |
| D9 | Endpoint novo sem PR-DIAG + PR-IMPL + PR-PROVA |
| D10 | Self-Audit bloqueante impede avanço em PR futura |

### Reforço: `/skills/run` não é permitido nesta fase

> **`/skills/run` não deve ser criado antes de `/skills/propose`.**
>
> A sequência obrigatória é:
> 1. Nenhum endpoint existe agora ← estado atual
> 2. `/skills/propose` ← primeiro endpoint permitido
> 3. `/skills/approve` ← após gate de aprovação implementado e validado
> 4. `/skills/run` ← SOMENTE Fase 5 (PR73+), gate de aprovação funcionando

Criar `/skills/run` antes desta sequência viola o princípio de governed execution
e cria risco de autonomia cega (Risco R10 em `schema/brain/learnings/future-risks.md`).
