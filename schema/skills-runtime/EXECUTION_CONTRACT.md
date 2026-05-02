# ENAVIA — Runtime de Skills: Contrato de Execução

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhum endpoint implementado

---

## 1. Aviso

> Este documento define o contrato de execução futuro do Runtime de Skills.
> **Nenhum endpoint foi criado. Nenhum runtime foi implementado.**
> Este contrato será usado em PR futura quando o runtime for implementado.

---

## 2. Formato do contrato de execução

```json
{
  "skill_execution": {
    "request_id": "string — UUID único por execução",
    "skill_id": "CONTRACT_AUDITOR | DEPLOY_GOVERNANCE_OPERATOR | SYSTEM_MAPPER | CONTRACT_LOOP_OPERATOR",
    "mode": "read_only | proposal | approved_execution",
    "requested_action": "string — descrição da ação solicitada",
    "inputs": {
      "context": "string — contexto da conversa",
      "parameters": {}
    },
    "approval": {
      "required": true,
      "status": "not_requested | pending | approved | rejected",
      "approved_by": "human | null",
      "approved_at": "string ISO8601 | null",
      "approval_reason": "string | null"
    },
    "execution": {
      "status": "not_started | running | completed | failed | blocked",
      "started_at": "string ISO8601 | null",
      "finished_at": "string ISO8601 | null",
      "evidence": [],
      "output": null
    },
    "safety": {
      "risk_level": "low | medium | high | blocking",
      "requires_human": true,
      "blocked_reason": "string | null",
      "rollback_available": false,
      "rollback_procedure": "string | null"
    },
    "audit": {
      "self_audit_result": null,
      "audit_categories": [],
      "audit_passed": false
    }
  }
}
```

---

## 3. Modos de execução

### `read_only`

- Skill acessa documentação e contexto do sistema
- Não gera efeito externo
- Aprovação humana: recomendada mas pode ser mais leve
- Evidência: obrigatória (log do que foi lido)
- Exemplos: análise de PR, diagnóstico de sistema, auditoria de contrato

### `proposal`

- Skill gera uma proposta (sugestão, recomendação, plano)
- Não executa a proposta
- Aprovação humana: necessária para avançar para execução
- Evidência: obrigatória (a proposta em si é a evidência)
- Exemplos: sugestão de próxima PR, plano de deploy, recomendação de skill

### `approved_execution`

- Skill executa ação com efeito externo
- Aprovação humana: **obrigatória e explícita** antes de iniciar
- Evidência: obrigatória (log completo de antes/durante/depois)
- Rollback: obrigatório definido antes de iniciar
- Exemplos: deploy, rollback, merge (futuras)

---

## 4. Ciclo de vida de uma execução

```
[REQUESTED]
    │
    ▼
[VALIDATION] — skill_id no allowlist? inputs válidos?
    │
    ├── falhou → [BLOCKED] — retornar erro seguro
    │
    ▼
[RISK_ASSESSMENT] — avaliar risk_level
    │
    ├── blocking → [BLOCKED] — Self-Audit ou Safety model bloqueou
    │
    ▼
[APPROVAL_CHECK]
    │
    ├── requires_human = true → [PENDING_APPROVAL] → aguardar humano
    │   │
    │   ├── rejected → [REJECTED] — encerrar com log
    │   │
    │   └── approved → continuar
    │
    ├── requires_human = false (read_only) → continuar com registro
    │
    ▼
[EXECUTING]
    │
    ▼
[EVIDENCE_COLLECTION]
    │
    ▼
[SELF_AUDIT]
    │
    ├── secret_exposure → [BLOCKED] — não retornar
    │
    ▼
[COMPLETED] — retornar resultado + evidência
    │
    ▼
[LOGGED] — persistir em execution log
```

---

## 5. Regras do contrato

| Regra | Descrição |
|-------|-----------|
| R1 | `skill_id` deve estar no allowlist de skills conhecidas |
| R2 | `mode` deve ser explícito — nunca inferido |
| R3 | `approved_execution` sem `approval.status === 'approved'` → bloquear imediatamente |
| R4 | `evidence` deve ter ao menos 1 item antes de retornar resultado |
| R5 | `self_audit_result` deve ser executado antes de retornar ao usuário |
| R6 | `request_id` deve ser único (UUID) por execução |
| R7 | Skills inexistentes retornam `blocked` com mensagem clara — sem simular execução |
| R8 | Qualquer erro na execução deve gerar log antes de retornar |
| R9 | `rollback_procedure` obrigatório para qualquer `approved_execution` com efeito irreversível |
| R10 | Contrato de execução deve ser salvo no log antes de iniciar execução |

---

## 6. Campos obrigatórios por modo

| Campo | `read_only` | `proposal` | `approved_execution` |
|-------|-------------|------------|---------------------|
| `request_id` | ✅ | ✅ | ✅ |
| `skill_id` | ✅ | ✅ | ✅ |
| `mode` | ✅ | ✅ | ✅ |
| `requested_action` | ✅ | ✅ | ✅ |
| `inputs` | ✅ | ✅ | ✅ |
| `approval.required` | opcional | ✅ | ✅ (= true) |
| `approval.status` | — | ✅ | ✅ (= 'approved') |
| `approval.approved_by` | — | — | ✅ |
| `execution.evidence` | ✅ | ✅ | ✅ |
| `safety.risk_level` | ✅ | ✅ | ✅ |
| `safety.rollback_available` | — | — | ✅ |
| `audit.self_audit_result` | ✅ | ✅ | ✅ |

---

## 7. Integração com módulos existentes

| Módulo | Papel no contrato |
|--------|------------------|
| `enavia-intent-classifier.js` | Preenche `requested_action` a partir da intenção detectada |
| `enavia-skill-router.js` | Preenche `skill_id` a partir do roteamento |
| `enavia-intent-retrieval.js` | Preenche `inputs.context` com contexto da skill |
| `enavia-self-audit.js` | Preenche `audit.self_audit_result` e `audit.audit_categories` |
| `enavia-response-policy.js` | Governa formato da resposta final após execução |

---

## 8. O que este documento NÃO é

- Este documento NÃO implementa nenhum endpoint
- Este documento NÃO cria nenhum módulo de runtime
- Este contrato será implementado em PR futura (após PR66 diagnóstico)
- Nenhuma execução de skill ocorre pela existência deste documento
