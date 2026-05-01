# Self-Audit Framework — Roadmap

> **Status:** Documental. Define o caminho do Self-Audit do contrato à implementação.

---

## Aviso importante

**Self-Audit runtime não existe nesta PR.**
**Self-Audit não executa correção automática.**
**Self-Audit não faz deploy.**
**Self-Audit não substitui revisão humana.**
**Este roadmap é uma previsão contratual, não uma garantia de execução.**

---

## Roadmap do Self-Audit (PR55–PR61+)

### PR55 — PR-DOCS — Self-Audit Framework ✅ (esta PR)

**Objetivo:** Criar o contrato documental completo do Self-Audit.

**Entregou:**
- `schema/self-audit/INDEX.md` — visão geral e conexões
- `schema/self-audit/FRAMEWORK.md` — arquitetura conceitual (10 camadas)
- `schema/self-audit/CHECKLISTS.md` — checklists por contexto (A–F)
- `schema/self-audit/RISK_MODEL.md` — 13 categorias de risco, 5 níveis
- `schema/self-audit/SIGNALS.md` — sinais de falsa capacidade, operação, excesso, drift, segurança
- `schema/self-audit/OUTPUT_CONTRACT.md` — contrato JSON de saída futura
- `schema/self-audit/ESCALATION_POLICY.md` — quando bloquear, alertar, observar
- `schema/self-audit/ROADMAP.md` (este arquivo)
- `schema/reports/PR55_SELF_AUDIT_FRAMEWORK.md`

**Não implementou:** Runtime, endpoint, prompt real, Worker, execução automática.

---

### PR56 — PR-IMPL — Self-Audit read-only

**Objetivo:** Implementar o módulo `schema/enavia-self-audit.js` com `runSelfAudit()`.

**Escopo:**
- Criar `schema/enavia-self-audit.js` com verificações das 10 camadas do FRAMEWORK.md
- Integrar como campo aditivo `self_audit` no response do `/chat/run` (não quebrante)
- Integrar após `buildChatSystemPrompt` e antes da resposta final
- Usar CHECKLISTS.md, RISK_MODEL.md e SIGNALS.md como fonte de verdade
- Seguir OUTPUT_CONTRACT.md para formato de saída

**Restrições:**
- read-only (não altera resposta principal)
- sem endpoint novo
- sem escrita em KV/memória
- sem alteração de Panel, Executor, Deploy Worker, workflows

---

### PR57 — PR-PROVA — Prova do Self-Audit read-only

**Objetivo:** Provar formalmente que o Self-Audit PR56 funciona como especificado.

**Escopo:**
- Criar `tests/pr57-self-audit-readonly.prova.test.js`
- Cenários: falsa capacidade detectada, falsa capacidade não detectada, execução indevida bloqueada, skill read-only sem alerta falso, modo correto, modo errado, drift contratual, segurança, resposta natural preservada
- Validar campo `self_audit` no response
- Validar `should_block` correto por cenário
- Rodar regressões completas

---

### PR58 — PR-IMPL ou PR-DOCS — Response Policy viva

**Objetivo:** Atualizar a Response Policy para incorporar os insights do Self-Audit.

**Possível escopo:**
- Atualizar `schema/policies/MODE_POLICY.md` ou criar `schema/policies/RESPONSE_POLICY.md`
- Definir regras de quando Self-Audit deve influenciar formato de resposta
- Definir quando `should_block` do Self-Audit deve ser usado pelo Worker para pausar resposta

**Decisão:** Contrato atual prevê PR-IMPL. Avaliar após PR57.

---

### PR59 — PR-PROVA — Prova anti-bot final

**Objetivo:** Prova end-to-end de que a Enavia responde de forma natural e não robótica com todos os módulos ativos (LLM Core + Brain Loader + Intent Classifier + Skill Router + Intent Retrieval + Self-Audit).

**Escopo:**
- Cenários reais de conversa: conversa casual, frustração, pergunta conceitual, pedido de deploy, revisão de PR, questão de skill, questão de memória
- Verificar que Self-Audit não torna a Enavia mais robótica
- Verificar que modo operacional só ativa com gatilho real
- Regressões completas

---

### PR60 — PR-DOCS ou PR-IMPL — Propor atualização de memória

**Objetivo:** Definir como e quando a Enavia pode propor atualizações ao Brain documental com base no que aprendeu.

**Possível escopo:**
- `schema/brain/MEMORY_UPDATE_POLICY.md` — regras de proposta de atualização
- Mecanismo de sugestão (não execução) de novos entries no Brain
- Aprovação humana obrigatória antes de qualquer escrita

**Nota:** Esta é a última PR do contrato original. Contrato foi ampliado para PR64.

---

### PR61+ — Runtime de Skills / evolução futura

**Objetivo:** Definir e implementar o runtime real de Skills (além das 4 documentais atuais).

**Pré-requisitos:**
- PR57 (prova do Self-Audit) concluída
- PR59 (prova anti-bot) concluída
- Contrato novo ou ampliação formal do contrato atual

**Nota:** `/skills/run` não existe hoje. Qualquer implementação de skills runtime exige contrato explícito.

---

## Dependências do roadmap

```
PR55 (DOCS — framework) → PR56 (IMPL — runtime) → PR57 (PROVA — validação)
                                                           ↓
                                               PR58 (Response Policy)
                                                           ↓
                                               PR59 (PROVA anti-bot final)
                                                           ↓
                                               PR60 (Memory Update Policy)
                                                           ↓
                                               PR61+ (Skills Runtime, se autorizado)
```

---

## O que este roadmap NÃO garante

- PR56 não pode ser executada sem que PR55 seja mergeada e validada.
- As datas são estimativas — o contrato governa, não o calendário.
- Qualquer PR pode gerar exceção corretiva que adie a próxima.
- O contrato pode ser atualizado antes de PR60 se necessário.
