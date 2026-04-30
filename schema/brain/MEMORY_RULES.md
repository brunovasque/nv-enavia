# Obsidian Brain — Regras de Memória

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental. As regras definem o que conta como memória válida no brain.

---

## 1. Regra Fundamental

> **Memória nunca é chute.**

Toda informação registrada no brain como fato deve ter uma fonte verificável:
um arquivo de relatório, um contrato, um resultado de teste, um handoff ou
um arquivo de sistema.

Se não há fonte, a informação deve ser marcada como **incerta**, **a verificar** ou
simplesmente não registrada.

---

## 2. Tipos de Memória e suas Regras

### 2.1 Regra Operacional

**Definição:** Regra que governa o comportamento da Enavia em operação.

**Fonte válida:** `schema/policies/`, `schema/contracts/active/`, `schema/CODEX_WORKFLOW.md`

**Exemplos:**
- `read_only` é gate de execução, não regra de tom.
- Não alterar runtime em PR-DOCS ou PR-DIAG.
- Não avançar PR sem evidência real da anterior.

**Regra:** Toda regra operacional deve citar sua fonte. Regras sem fonte são hipóteses.

---

### 2.2 Preferência do Operador

**Definição:** Como o operador quer que a Enavia se comporte, responda e priorize.

**Fonte válida:** Declarações explícitas do operador em issues, PRs ou contratos.

**Exemplos:**
- Responder sempre em português.
- Patch cirúrgico — não refatorar por estética.
- Diagnóstico antes de alterar.

**Regra:** Preferência não documentada não é memória. Se o operador nunca declarou
explicitamente, registrar como **inferência**, não como preferência confirmada.

---

### 2.3 Decisão de Arquitetura

**Definição:** Escolha técnica ou estrutural já tomada e registrada.

**Fonte válida:** `schema/reports/`, contratos, handoffs.

**Exemplos:**
- `read_only` separado de tom a partir da PR35/PR36.
- Sanitizers preservam prosa natural, bloqueiam snapshots JSON do planner (PR36).
- `isOperationalMessage` usa termos compostos, não palavras isoladas (PR38).

**Regra:** Decisão registrada tem precedência sobre suposição. Para rever uma decisão,
é necessário abrir nova PR com justificativa — não silenciosamente substituir.

---

### 2.4 Incidente

**Definição:** Falha, bug, regressão ou comportamento indesejado já documentado.

**Fonte válida:** `schema/reports/`, handoffs, resultados de testes.

**Estrutura obrigatória:**
- Problema observado
- Causa diagnosticada
- PRs relacionadas
- Estado atual (resolvido / em aberto)
- Como evitar regressão

**Regra:** Incidente não é apenas registro de problema — é insumo para decisão e aprendizado.

---

### 2.5 Aprendizado

**Definição:** Inferência derivada de experiência documentada — o que funcionou, o que falhou,
o que evitar, o que replicar.

**Fonte válida:** Incidentes documentados, relatórios de PRs, resultados de testes.

**Regra:** Aprendizado é diferente de fato. Deve ser marcado como tal. Não é regra —
é conhecimento acumulado que orienta decisão futura.

---

### 2.6 Estado Atual

**Definição:** Snapshot do estado do sistema em determinado momento.

**Fonte válida:** `schema/status/ENAVIA_STATUS_ATUAL.md`, `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Regra:** Estado atual caduca. Sempre verificar a data do arquivo antes de usar como
base para afirmações. Estado desatualizado deve ser marcado como histórico.

---

## 3. Distinções Críticas

### 3.1 Regra de Segurança vs. Tom/Persona

| Tipo | Definição | Exemplo |
|------|-----------|---------|
| **Regra de segurança** | Gate de execução que protege o sistema | `read_only=true` bloqueia execuções. Regra dura. |
| **Regra de tom** | Preferência sobre como responder | "Responder em português" |
| **Persona** | Identidade comportamental | "Enavia é direta e não robótica" |

**Regra:** Não misturar. `read_only` é regra de segurança — não é instrução de tom.
Transformar regra de segurança em instrução de tom causou o incidente do chat engessado
(PR32-PR38). Ver `brain/incidents/chat-engessado-readonly.md`.

---

### 3.2 `read_only` é Gate de Execução, Não Regra de Tom

> Esta distinção é explícita porque a confusão causou o maior incidente documentado até PR39.

- `read_only = true` significa: **nenhuma ação de runtime pode ser executada**.
- `read_only = true` **não significa**: "responda de forma mais formal", "ative modo de alerta", "liste tudo em bullet points", "adicione aviso em toda resposta".
- A Enavia pode ter uma conversa fluida mesmo com `read_only = true`.
- A Mode Policy (`schema/policies/MODE_POLICY.md`) define os 3 modos: `conversation`, `diagnosis`, `execution`. `read_only` é controle de execução, não de conversa.

---

### 3.3 Checklist Robótico vs. Resposta Viva

> Não transformar memória em checklist robótico.

A Enavia não deve responder com listas de bullets genéricas, avisos desnecessários ou
frases de alerta a toda mensagem. Memória de regras não é script de resposta.

O brain define o que a Enavia **sabe** e **como pensa**. A resposta deve ser natural,
contextualizada, proporcionada à intenção detectada.

---

## 4. Hierarquia de Confiabilidade

```
1. Contrato ativo             (mais autoritativo)
2. Schema de políticas        (schema/policies/)
3. Relatórios de PR           (schema/reports/)
4. Status e handoff           (schema/status/, schema/handoffs/)
5. Brain decisions            (brain/decisions/)
6. Brain incidents            (brain/incidents/)
7. Brain learnings            (brain/learnings/)
8. Brain memories             (brain/memories/)
9. Inferências não documentadas (menos autoritativo — marcar como incerto)
```

---

## 5. O Que Nunca Conta como Memória

- Suposição sem evidência
- Dedução sobre o que o operador "provavelmente quer"
- Extrapolação de comportamento futuro não contratado
- Repetição de regra sem verificar se ainda está ativa
- Afirmação de estado sem verificar data do arquivo de referência
