# ENAVIA — Custo e Limites: Runtime de Skills

**Versão:** 1.0
**Data:** 2026-05-02 (PR67)
**Estado:** Documental — limites definidos antes de qualquer implementação de runtime

---

## 1. Contexto

O Runtime de Skills pode introduzir custos invisíveis se não houver limites explícitos desde o início. Este documento define limites operacionais recomendados para a fase inicial (proposal-only).

---

## 2. Riscos de custo identificados

### C1 — Prompt bloat

**Descrição:**
O payload enviado ao LLM pode crescer sem controle se o contexto de skills for acumulado sem truncamento.

**Causa:** Cada skill com contexto rico pode adicionar 500–2.000 tokens ao prompt.
**Sinal de alerta:** Prompt cresce por requisição sem depuração.
**Mitigação:** Limite de payload por proposta + truncamento com marcação obrigatória.

---

### C2 — Loops de execução

**Descrição:**
Skill que propõe outra skill que propõe outra skill — loop sem saída natural.

**Causa:** Falta de limite de profundidade de recursão.
**Sinal de alerta:** Mesmo `request_id` gera múltiplas propostas encadeadas.
**Mitigação:** `max_retries = 0` na fase proposal-only. Profundidade máxima = 1.

---

### C3 — Custo invisível de LLM

**Descrição:**
Chamadas internas ao LLM dentro do Skill Executor sem contabilização de tokens.

**Causa:** LLM extra dentro do executor não declarado no contrato de custo.
**Sinal de alerta:** Custo de inference aumenta sem nova funcionalidade visível.
**Mitigação:** Sem LLM extra dentro do Skill Executor na fase proposal-only.

---

### C4 — Custo de logs/evidências

**Descrição:**
Log de evidências por execução pode escalar em armazenamento e I/O.

**Causa:** Evidência detalhada por request em KV ou D1 sem política de retenção.
**Sinal de alerta:** KV namespace de execução cresce indefinidamente.
**Mitigação:** Evidência mínima na fase proposal-only. Sem persistência obrigatória nesta fase.

---

### C5 — Gasto invisível por request

**Descrição:**
Processamento adicional por request que não foi declarado na arquitetura.

**Causa:** Módulos adicionais chamados implicitamente sem declaração.
**Sinal de alerta:** Latência aumenta por request sem nova funcionalidade.
**Mitigação:** Todo módulo adicional deve ser declarado no contrato de execução.

---

## 3. Limites recomendados — fase proposal-only

### 3.1 Limites por request

| Limite | Valor | Justificativa |
|--------|-------|---------------|
| `max_skill_proposals_per_request` | **1** | Uma proposta por request — sem paralelismo na fase inicial |
| `max_retries` | **0** | Sem retry na fase proposal-only — falha é resultado válido |
| `max_execution_depth` | **1** | Sem skills invocando outras skills |
| `max_payload_size_chars` | **4.000** | Mesmo limite do Brain Loader (consistência) |
| `max_context_per_skill_chars` | **2.000** | Limite do Intent Retrieval (consistência) |
| `max_evidence_items` | **5** | Mínimo suficiente para rastreabilidade |

### 3.2 Limites de tempo

| Limite | Valor | Justificativa |
|--------|-------|---------------|
| `max_proposal_generation_ms` | **3.000** | 3 segundos — tolerável para proposta síncrona |
| `max_self_audit_ms` | **500** | Audit deve ser rápido — não pode bloquear response |
| `max_total_execution_ms` | **5.000** | 5 segundos total — inclui audit + proposta |

### 3.3 Limites de uso de LLM

| Limite | Valor | Justificativa |
|--------|-------|---------------|
| LLM extra dentro do Skill Executor | **❌ Proibido** | Fase proposal-only usa apenas o LLM do `/chat/run` |
| Chamadas externas dentro da proposta | **❌ Proibidas** | Fase proposal-only é pure function |
| Tokens extras por proposta | **≤ 500** | Overhead aceitável para contexto de skill |

### 3.4 Limites de escrita em KV

| Limite | Valor | Justificativa |
|--------|-------|---------------|
| Escrita em KV na fase proposal-only | **❌ Proibida** | Nenhuma persistência obrigatória |
| Leitura em KV na fase proposal-only | **Permitida com log** | Read-only é aceitável com evidência |
| Criação de namespace KV | **❌ Proibida sem PR-DIAG** | Requer diagnóstico dedicado |

---

## 4. Recomendações para fase proposal-only

```json
{
  "skill_executor_config_proposal_phase": {
    "max_skill_proposals_per_request": 1,
    "max_retries": 0,
    "max_execution_depth": 1,
    "max_payload_size_chars": 4000,
    "max_context_per_skill_chars": 2000,
    "max_evidence_items": 5,
    "max_proposal_generation_ms": 3000,
    "max_self_audit_ms": 500,
    "max_total_execution_ms": 5000,
    "allow_llm_extra_calls": false,
    "allow_external_calls": false,
    "allow_kv_write": false,
    "allow_kv_read": true,
    "require_evidence": true,
    "require_self_audit": true
  }
}
```

---

## 5. Política para evitar gasto invisível

| Regra | Descrição |
|-------|-----------|
| G1 | Toda chamada externa deve ser declarada no contrato de execução da skill |
| G2 | Nenhum LLM extra pode ser chamado sem declaração no corpo da PR |
| G3 | Nenhum KV write sem contabilização no log de execução |
| G4 | Todo módulo novo adicionado ao request deve ter custo estimado |
| G5 | PR-PROVA deve incluir medição de latência e tokens quando LLM for envolvido |
| G6 | Prompt gerado por proposta de skill deve ser medido em PR-DIAG antes de implementar |
| G7 | Toda persistência deve ter política de retenção e limpeza definida antes de implementar |

---

## 6. Monitoramento futuro recomendado

Quando o runtime existir, as seguintes métricas devem ser monitoradas:

| Métrica | Alerta |
|---------|--------|
| Tokens por request com skill | > 5.000 tokens |
| Propostas por minuto | > 10 propostas/min (possível loop) |
| Latência média de proposta | > 3.000ms |
| KV writes por hora | > 100 writes/hora (possível loop) |
| Requests sem evidência | > 0 (sempre alertar) |
| Self-Audit failures | > 0 (sempre alertar) |

---

## 7. O que este documento NÃO implementa

- Não configura nenhum limite no código atual
- Não cria monitoramento
- Não altera nenhum módulo de runtime
- Limites aqui são recomendações para PR-IMPL futura que implementar o Skill Executor

---

## Backlinks

- `schema/hardening/INDEX.md`
- `schema/hardening/SKILLS_RUNTIME_HARDENING.md`
- `schema/skills-runtime/EXECUTION_CONTRACT.md`
- `schema/reports/PR67_HARDENING_SEGURANCA_CUSTO_LIMITES.md`
