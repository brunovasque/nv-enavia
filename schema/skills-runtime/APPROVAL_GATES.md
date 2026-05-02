# ENAVIA — Runtime de Skills: Gates de Aprovação Humana

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Documental — nenhum mecanismo implementado

---

## 1. Princípio

> Toda ação irreversível, todo efeito externo e toda modificação de sistema exige aprovação humana explícita. Sem exceção.

O Runtime de Skills opera em três níveis de aprovação:

1. **Sempre exige aprovação humana** — qualquer ação externa irreversível
2. **Pode ser proposta sem executar** — sugestões, recomendações, análises
3. **Read-only permitido, mas com evidência** — consultas e diagnósticos

---

## 2. Categoria A — Sempre exige aprovação humana

Qualquer skill que solicitar uma das ações abaixo **deve aguardar aprovação humana explícita antes de qualquer execução**. Não há exceção. Não há auto-aprovação.

| Ação | Justificativa |
|------|---------------|
| Deploy de Worker (PROD ou TEST) | Irreversível — afeta tráfego de produção |
| Rollback de Worker | Irreversível — restaura versão anterior |
| Alteração de `nv-enavia.js` | Worker principal — alto impacto |
| Alteração de qualquer `schema/enavia-*.js` | Módulos de runtime — alto impacto |
| Criação de novo endpoint | Expande superfície de ataque |
| Alteração de KV namespace | Afeta dados persistentes |
| Alteração de binding/secret | Afeta segurança e autenticação |
| Escrita de memória (quando existir) | Altera estado do brain |
| Alteração de contrato ativo | Governa todas as outras decisões |
| Merge/promoção de PR | Ação irreversível em git |
| Criação de nova skill | Expande capacidades — requer revisão |
| Qualquer ação externa irreversível | Princípio geral — não enumerar exaustivamente |

### Mecanismo futuro

```
PROPOSTA GERADA
      │
      ▼
NOTIFICAÇÃO AO OPERADOR (canal a definir)
      │
      ▼
AGUARDAR approval.status === 'approved' | 'rejected'
      │
      ├── rejected → ENCERRAR + LOG
      │
      └── approved → EXECUÇÃO CONTROLADA
```

> **Atenção:** O mecanismo de notificação e aprovação **não existe ainda**. Será definido em PR66 (diagnóstico) e implementado em PR futura.

---

## 3. Categoria B — Pode ser proposta sem executar

Ações que podem ser geradas como proposta pelo runtime, mas **não executadas** sem aprovação humana.

| Ação | Skill responsável | O que a skill faz | O que NÃO faz |
|------|-------------------|-------------------|----------------|
| Revisar PR | `CONTRACT_AUDITOR` | Analisa diff, aponta achados | Não aprova/rejeita automaticamente |
| Sugerir próxima PR | `CONTRACT_LOOP_OPERATOR` | Recomenda próxima PR baseado no contrato | Não cria PR automaticamente |
| Gerar prompt | `CONTRACT_LOOP_OPERATOR` | Gera instrução para próxima PR | Não executa a instrução |
| Mapear sistema | `SYSTEM_MAPPER` | Gera mapa atual do sistema | Não altera o sistema |
| Auditar contrato | `CONTRACT_AUDITOR` | Verifica aderência ao contrato | Não modifica o contrato |
| Planejar deploy | `DEPLOY_GOVERNANCE_OPERATOR` | Prepara plano de deploy | Não executa o deploy |
| Recomendar skill | `CONTRACT_LOOP_OPERATOR` | Sugere qual skill usar | Não ativa a skill |

### Formato de proposta

```json
{
  "mode": "proposal",
  "execution": {
    "status": "not_started",
    "output": {
      "type": "proposal",
      "content": "...",
      "requires_approval_to_execute": true
    }
  }
}
```

---

## 4. Categoria C — Read-only permitido, mas com evidência

Operações de consulta e diagnóstico que podem avançar sem aprovação humana explícita, **mas ainda exigem evidência registrada**.

| Ação | Condição | Evidência mínima |
|------|----------|-----------------|
| Leitura de docs do repo | skill_id válido + modo declarado como read_only | Log: quais arquivos lidos |
| Análise de relatórios | skill_id válido + modo declarado como read_only | Log: relatório analisado + achados |
| Análise de testes | skill_id válido + modo declarado como read_only | Log: arquivo de teste + resultado |
| Inspeção de diff | skill_id válido + modo declarado como read_only | Log: diff analisado |
| Diagnóstico sem alteração | skill_id válido + modo declarado como read_only | Log: diagnóstico completo |

### Regra de evidência obrigatória

Mesmo para operações read-only:
1. `execution.evidence` deve ter ao menos 1 item
2. O item deve conter: `source`, `action`, `timestamp`
3. Self-Audit deve ser executado antes de retornar resultado

```json
{
  "execution": {
    "evidence": [
      {
        "source": "schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md",
        "action": "read",
        "timestamp": "2026-05-02T01:30:00Z",
        "summary": "Lidos os critérios de aceite da PR65"
      }
    ]
  }
}
```

---

## 5. Matriz de aprovação

| Categoria | Aprovação humana | Evidência | Auto-aprovação | Exemplo |
|-----------|-----------------|-----------|----------------|---------|
| Ação irreversível | ✅ Obrigatória | ✅ Obrigatória | ❌ Proibida | deploy, merge |
| Efeito externo | ✅ Obrigatória | ✅ Obrigatória | ❌ Proibida | escrita em KV |
| Proposta | ✅ Para executar | ✅ Obrigatória | ❌ Proibida | sugerir PR |
| Read-only | Recomendada | ✅ Obrigatória | ⚠️ Permitida com log | ler docs |

---

## 6. Gate de segurança absoluto

Independente de categoria ou aprovação, as seguintes condições **sempre bloqueiam**:

1. `skill_id` não está no allowlist → BLOCKED
2. `safety.risk_level === 'blocking'` → BLOCKED
3. `audit.audit_categories` contém `secret_exposure` → BLOCKED
4. `approval.status !== 'approved'` para `approved_execution` → BLOCKED
5. `execution.evidence` vazia para qualquer modo → BLOCKED

---

## 7. O que este documento NÃO implementa

- Não cria mecanismo de aprovação
- Não cria canal de notificação ao operador
- Não cria `/skills/approve`
- Não cria `/skills/run`
- Nenhum gate está ativo no runtime atual
- Toda a governança atual é manual via PR (mecanismo vigente conforme `schema/brain/UPDATE_POLICY.md`)
