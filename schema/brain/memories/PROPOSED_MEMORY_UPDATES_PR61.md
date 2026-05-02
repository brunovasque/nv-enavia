# Memória: Proposta de Atualização de Memória — PR61

**Tipo:** proposta de memória permanente + delimitação do que não deve virar runtime ainda
**Fonte:** PR61 — ciclo PR31–PR60 consolidado
**Data:** 2026-05-01
**Estado:** Ativa — proposta documentada, não implementada como runtime

---

## Contexto

Esta proposta separa o que deve ser consolidado como memória permanente do brain, o que
não deve virar runtime ainda, e o que precisa de correção futura em PR dedicada.

Nenhum item desta lista foi implementado como runtime automático nesta PR.
Esta é uma proposta documental para orientar PRs futuras.

---

## Memórias que devem virar conhecimento permanente

### M1 — Stack cognitiva validada

A Enavia possui stack cognitiva completa e validada após PR60:
- LLM Core v1 (`schema/enavia-llm-core.js`)
- Brain Context read-only (`schema/enavia-brain-loader.js`)
- Intent Classifier v1 — 15 intenções (`schema/enavia-intent-classifier.js`)
- Skill Router read-only — 4 skills (`schema/enavia-skill-router.js`)
- Intent Retrieval v1 (`schema/enavia-intent-retrieval.js`)
- Self-Audit read-only — 10 categorias (`schema/enavia-self-audit.js`)
- Response Policy viva — 15 regras (`schema/enavia-response-policy.js`)

**Proposta:** Manter esta lista como memória permanente de referência de estado do sistema.

### M2 — Fluxo correto de prova/correção

Padrão validado no ciclo:
1. PR-DIAG (diagnóstico read-only)
2. PR-IMPL (implementação cirúrgica)
3. PR-PROVA (teste formal)
4. Se falhar: PR-IMPL corretiva + re-execução da prova

Exemplo: PR32 → PR36 → PR37 → PR38 → PR50 (com PR49) → PR52 (com PR51) etc.

**Proposta:** Registrar este padrão como decisão arquitetural permanente em `brain/decisions/`.

### M3 — Anti-bot final validado

16 cenários de comportamento correto validados em 236/236 (PR60).
Ver `schema/brain/learnings/ANTI_BOT_FINAL_LEARNINGS.md` para detalhe completo.

**Proposta:** Manter arquivo de aprendizados anti-bot como referência permanente de comportamento.

### M4 — Self-Audit read-only

Self-Audit detecta 10 categorias de risco mas não bloqueia fluxo mecanicamente.
Campo `self_audit` é aditivo e defensivo.

**Proposta:** Manter como memória permanente que Self-Audit é orientativo, não blocking.

### M5 — Response Policy viva

Response Policy tem 15 regras que orientam o LLM sobre como responder.
Não reescreve reply. Não bloqueia fluxo.

**Proposta:** Manter como memória permanente que Response Policy é orientação, não enforcement.

### M6 — Cuidados com falsa capacidade

- Enavia não simula execução de skill inexistente.
- /skills/run não existe.
- Self-Audit detecta false_capability.
- Response Policy orienta a ser honesta sobre limitações.

**Proposta:** Manter como regra permanente de comportamento — nunca fingir capacidade.

### M7 — Cuidados com documentação excessiva

- docs_over_product é categoria de Self-Audit.
- PR-DOCS não substitui PR-IMPL com teste real.
- Brain Loader trunca em 4.000 chars — mais docs não significa mais contexto útil.

**Proposta:** Manter como memória de risco — documentação sem produto é sinal de alerta.

---

## Memórias que NÃO devem virar runtime ainda

### NR1 — Escrita automática de memória

Nenhum módulo deve escrever no brain automaticamente sem aprovação humana explícita.
Implementar apenas com:
- PR-DIAG dedicada (diagnóstico do design)
- PR-IMPL dedicada (implementação segura)
- PR-PROVA dedicada (validação)
- Aprovação do operador em cada etapa

**Motivo:** Risco de memória corrompida, inventada ou inconsistente com fontes reais.

### NR2 — Execução de skill

Skills são documentais. Executar skill automaticamente exige:
- Skill Executor runtime implementado (não existe)
- /skills/run endpoint (não existe)
- Gate de aprovação humana
- PR-IMPL dedicada com PR-DIAG anterior

**Motivo:** Execução sem gate viola princípio de governança do contrato.

### NR3 — Bloqueio automático por Self-Audit

Self-Audit não deve bloquear fluxo mecanicamente (exceto secret_exposure que já é blocking).
Bloquear automaticamente sem aprovação humana é:
- Risco de falso positivo travar sistema legítimo
- Violação de princípio "orienta, não executa"

**Motivo:** Self-Audit é diagnostic tool, não firewall automático.

### NR4 — Endpoints novos

Nenhum endpoint novo deve ser criado sem:
- PR-DIAG do design
- Aprovação no contrato
- PR-IMPL dedicada
- PR-PROVA

**Motivo:** Endpoint sem contrato viola princípio de governed execution.

### NR5 — Classifier fix do Finding I1

Finding I1: "você já consegue executar" retorna `unknown` em vez de `capability_question`.
Correção identificada: adicionar "você já consegue" e variantes à `_CAPABILITY_TERMS`.

**Não implementar nesta PR.**
**Criar PR própria quando o contrato autorizar.**

---

## Correções futuras sugeridas

### CF1 — Finding I1: Classifier não reconhece variantes com advérbio

**Descrição:**
O Intent Classifier retorna `unknown` para frases como "você já consegue executar skills de verdade?".
Causa: "_CAPABILITY_TERMS" usa "você consegue" como substring, não captura "você já consegue".

**Recomendação futura:**
Adicionar variantes à lista `_CAPABILITY_TERMS` no `schema/enavia-intent-classifier.js`:
- `você já consegue`
- `já consegue`
- `consegue de verdade`
- `já tem capacidade de`
- `já consegue executar`

**Status:** Documentado. Baixo impacto (sistema seguro mesmo com unknown).

> **Não corrigir nesta PR. Criar PR própria se o contrato autorizar.**

### CF2 — Brain Loader: fontes estáticas podem desatualizar

**Descrição:**
O Brain Loader usa snapshot estático com allowlist hard-coded de 7 fontes.
À medida que o brain cresce, o snapshot pode ficar desatualizado.

**Recomendação futura:**
Avaliar se o allowlist deve ser expandido ou se deve haver mecanismo de atualização
controlada do snapshot. Exige PR-DIAG antes de qualquer mudança.

**Status:** Documentado. Não urgente.

### CF3 — Intent Classifier: 15 intenções podem ser insuficientes

**Descrição:**
15 intenções cobre os casos principais documentados até PR60.
Novos comportamentos do sistema podem exigir novas intenções.

**Recomendação futura:**
Revisar a lista de intenções ao iniciar nova fase do contrato.

**Status:** Documentado. Não urgente.
