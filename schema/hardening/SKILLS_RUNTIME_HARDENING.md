# ENAVIA — Hardening de Segurança: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — nenhum mecanismo de segurança implementado no runtime

---

## 1. Princípio fundamental

> **Deny by default. Allowlist apenas. Sem exceção.**
>
> Qualquer skill_id, modo ou ação desconhecida é bloqueada imediatamente.
> A permissão é a exceção, não a regra.

---

## 2. Deny-by-default — regras absolutas

| Regra | Condição | Ação |
|-------|----------|------|
| D1 | `skill_id` não está no allowlist | BLOCKED — erro seguro, sem detalhe interno |
| D2 | `mode` inválido ou não declarado | BLOCKED — erro seguro |
| D3 | `approval.status !== 'approved'` para `approved_execution` | BLOCKED — não executar |
| D4 | `safety.risk_level === 'blocking'` | BLOCKED — não executar |
| D5 | Self-Audit detecta `secret_exposure` | BLOCKED — não retornar resultado |
| D6 | `execution.evidence` vazia | BLOCKED — não retornar resultado |
| D7 | Runtime não reconhece tipo de execução | BLOCKED — fallback seguro |
| D8 | `/skills/run` chamado antes de `/skills/propose` existir | BLOCKED — endpoint não existe |
| D9 | Qualquer endpoint novo sem PR-DIAG + PR-IMPL + PR-PROVA | BLOCKED — não criar |
| D10 | Self-Audit bloqueante impede avanço em PR futura | BLOCKED — resolver antes de avançar |

---

## 3. Allowlist de skills (fase inicial)

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
**Alteração da allowlist:** Requer PR-IMPL dedicada com justificativa documentada.
**Fonte:** `schema/skills-runtime/SECURITY_MODEL.md` seção 3.

---

## 4. Sequência obrigatória de endpoints

```
1. Nenhum endpoint existe agora
2. /skills/propose  ← primeiro endpoint permitido (proposta sem execução)
3. /skills/approve  ← após gate de aprovação implementado e validado
4. /skills/run      ← SOMENTE após Fase 5 (PR73+), gate de aprovação funcionando
```

**Regra:** `/skills/run` nunca deve ser criado antes de `/skills/propose`.
**Regra:** Nenhum endpoint pode ser criado sem PR-DIAG + PR-IMPL + PR-PROVA dedicadas.

---

## 5. Aprovação humana — quando é obrigatória

| Ação | Aprovação humana | Justificativa |
|------|-----------------|---------------|
| Deploy (PROD ou TEST) | ✅ Obrigatória | Irreversível — afeta tráfego |
| Rollback de Worker | ✅ Obrigatória | Irreversível |
| Alterar `nv-enavia.js` | ✅ Obrigatória | Worker principal |
| Alterar `schema/enavia-*.js` | ✅ Obrigatória | Módulos de runtime |
| Criar novo endpoint | ✅ Obrigatória | Expande superfície de ataque |
| Alterar KV namespace | ✅ Obrigatória | Dados persistentes |
| Alterar binding/secret | ✅ Obrigatória | Segurança e autenticação |
| Escrita de memória no brain | ✅ Obrigatória | Altera estado do sistema |
| Alterar contrato ativo | ✅ Obrigatória | Governa todas as decisões |
| Merge/promoção de PR | ✅ Obrigatória | Irreversível em git |
| Criar nova skill no allowlist | ✅ Obrigatória | Expande capacidades |
| Execução de skill com side effect | ✅ Obrigatória | Efeito externo |
| Proposta de skill (read-only) | Recomendada | Registro obrigatório |
| Diagnóstico (read-only) | Recomendada | Registro obrigatório |

**Regra absoluta:** Sem aprovação automática. Sem auto-aprovação. Sem timeout como aprovação.

---

## 6. Proteção de secrets

Secrets **nunca** devem aparecer em:

- Output retornado ao usuário
- Log de execução (interno ou externo)
- Evidência registrada
- Proposta de execução
- Resposta de erro
- Corpo de PR ou commit message

**Implementação futura obrigatória:**
- Filtro de secrets no pipeline de output
- Self-Audit categoria `secret_exposure` bloqueia com `risk_level: blocking`
- Allowlist de padrões sensíveis (tokens, keys, passwords, env vars)
- Nenhum binding ou KV secret pode aparecer em JSON de resposta

---

## 7. Escrita em KV — regras antes de existir

| Regra | Descrição |
|-------|-----------|
| KV-1 | Nenhuma escrita em KV sem contrato que autorize explicitamente |
| KV-2 | Nenhuma escrita em KV em modo `proposal` ou `read_only` |
| KV-3 | Toda escrita em KV exige aprovação humana prévia |
| KV-4 | Nenhuma escrita em KV de secrets ou valores sensíveis |
| KV-5 | Log de escrita em KV obrigatório antes de executar |
| KV-6 | Rollback de escrita em KV deve ser definido antes de executar |
| KV-7 | Nenhum namespace de KV criado sem PR-DIAG dedicada |

---

## 8. Integração obrigatória com Self-Audit

| Categoria Self-Audit | Ação no Runtime de Skills |
|---------------------|--------------------------|
| `secret_exposure` | **BLOCKED** — prioridade máxima, não retornar nada |
| `fake_execution` | **BLOCKED** — skill não pode fingir ter executado |
| `unauthorized_action` | **BLOCKED** — ação fora do escopo da skill |
| `scope_violation` | **BLOCKED** — skill saiu do seu escopo |
| `false_capability` | **BLOCKED** — skill não pode afirmar capacidade inexistente |
| `runtime_vs_documentation_confusion` | **WARNING** — registrar e clarificar |
| `contract_drift` | **WARNING** — sinalizar para operador |
| `docs_over_product` | **WARNING** — sinalizar para operador |

**Regra:** Self-Audit deve ser executado **antes** de retornar qualquer resultado.
**Regra:** Self-Audit bloqueante impede avanço em PR futura até resolução.

---

## 9. Response Policy — papel no runtime

A Response Policy (`schema/enavia-response-policy.js`) **orienta** o LLM mas **não substitui** o gate técnico.

| Regra | Ação |
|-------|------|
| `fake_execution` | Orienta o LLM a não simular execução — gate técnico bloqueia |
| `false_capability` | Orienta o LLM a ser honesto — gate técnico valida |
| `secret_exposure` | Orienta o LLM — Self-Audit bloqueia mecanicamente |
| `unauthorized_action` | Orienta o LLM — gate técnico bloqueia |

**Conclusão:** Response Policy é camada de orientação. Gate técnico é camada de bloqueio. Ambos devem coexistir.

---

## 10. Evidência obrigatória por execução

Para qualquer execução (mesmo read-only), o seguinte deve ser registrado antes de retornar resultado:

```json
{
  "execution_record": {
    "request_id": "UUID",
    "skill_id": "string — deve estar no allowlist",
    "mode": "read_only | proposal | approved_execution",
    "risk_level": "safe | low | medium | high | blocking",
    "approval_status": "not_required | pending | approved | rejected",
    "started_at": "ISO8601",
    "finished_at": "ISO8601",
    "evidence_count": 0,
    "self_audit_passed": false,
    "result_status": "completed | failed | blocked"
  }
}
```

**Regra:** `execution.evidence` vazia → BLOCKED.
**Regra:** `self_audit_passed: false` → não retornar resultado.

---

## 11. Superfície de ataque mínima

| Item | Decisão |
|------|---------|
| Endpoints expostos | Mínimo necessário — não criar por conveniência |
| Skills ativas | Apenas allowlist — nada além |
| Modos de execução | 3 modos declarados — sem modo implícito |
| Acesso a KV | Declarado por skill no contrato de execução |
| Acesso a secrets | Proibido sem aprovação humana e contrato |
| Acesso a workers externos | Proibido sem contrato explícito |
| Logs externos | Proibido sem definição de retenção e acesso |
| Chamadas externas na fase proposal-only | ❌ Proibidas |

---

## 12. O que este documento NÃO implementa

- Não cria filtro de secrets em runtime
- Não ativa nenhuma regra de segurança no código atual
- Não cria nenhum endpoint
- Não implementa Self-Audit bloqueante para novas categorias
- Toda regra aqui é para implementação futura

**A segurança atual** está nos módulos existentes: `enavia-self-audit.js` e `enavia-response-policy.js`.

---

## Backlinks

- `schema/hardening/INDEX.md`
- `schema/skills-runtime/SECURITY_MODEL.md`
- `schema/skills-runtime/APPROVAL_GATES.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
