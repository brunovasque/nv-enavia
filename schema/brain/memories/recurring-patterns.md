# Memória — Padrões Recorrentes

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Padrões observados no histórico do projeto que tendem a se repetir.

---

## 1. Tendência a excesso documental

Toda vez que o projeto entra em fase com muitas PRs de governança / arquitetura
sem PR-IMPL, a quantidade de documentos cresce mais rápido do que a entrega
de produto. Isso já foi reconhecido formalmente em
`schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md` ("risco de excesso
documental reconhecido — objetivo agora é produto funcionando").

**Sinal de alerta:** três ou mais PR-DOCS consecutivas sem produto.

**Mitigação:** intercalar PR-IMPL ou PR-PROVA assim que possível;
recusar criação de novo documento se ele não reduz risco nem orienta execução.

---

## 2. Risco de "repo bonito / produto parado"

Padrão clássico onde a estrutura documental fica impecável (índices, tabelas,
backlinks) enquanto o produto entregue ao usuário não evolui. O operador
verbaliza esse risco repetidamente.

**Sinal de alerta:** semanas sem PR-IMPL; testes de runtime sem mudança;
chat / loop / executor sem evolução observável.

**Mitigação:** Princípio "documentação só vale se reduzir risco ou
orientar execução" (`brain/memories/project-principles.md` §1.8).

---

## 3. Necessidade de PR-PROVA após PR-IMPL

Toda PR-IMPL gera um risco que só PR-PROVA fecha. PR37 mostrou claramente
isso: PR36 pareceu fechar o problema, mas PR-PROVA encontrou 5 achados reais
que viraram PR38.

**Sinal de alerta:** PR-IMPL fechada sem PR-PROVA imediata na mesma frente.

**Mitigação:** sequência canônica `PR-DIAG → PR-IMPL → PR-PROVA` por frente.

---

## 4. Risco de `target` / `read_only` engessar chat

Padrão técnico crítico: qualquer mecanismo que confunda gate de execução com
regra de tom volta a engessar o chat. Já documentado e corrigido (PR32–PR38),
mas é a regressão mais provável neste runtime.

**Sinal de alerta:** prompt do sistema injetando bloco operacional pesado
quando `is_operational_context=false`; sanitizer removendo prosa natural;
checklists em conversa simples.

**Mitigação:** `brain/incidents/chat-engessado-readonly.md` +
`brain/decisions/2026-04-30-read-only-gate-nao-tom.md` + Mode Policy.

---

## 5. Risco de skills documentais serem confundidas com runtime

As 4 skills (`CONTRACT_LOOP_OPERATOR`, `DEPLOY_GOVERNANCE_OPERATOR`,
`SYSTEM_MAPPER`, `CONTRACT_AUDITOR`) são **documentais**. Quando alguém
pergunta "executa essa skill", a Enavia tende a responder como se houvesse
runtime. Não há.

**Sinal de alerta:** menção a `/skills/run`, "skill router decidiu", "skill
foi disparada".

**Mitigação:** `brain/maps/skill-map.md` §1 e §5 deixam isso explícito;
sempre dizer "documental" antes de descrever skill.

---

## 6. Necessidade de comparar documentação com runtime

Documento atualizado não é sinônimo de runtime atualizado. Várias vezes uma
seção do System Map refletia design intencional, não código real. PR-DIAG
existe justamente para esse confronto.

**Sinal de alerta:** afirmação "o sistema faz X" com fonte só em documento
(sem PR-PROVA, sem log, sem teste).

**Mitigação:** `brain/SYSTEM_AWARENESS.md` §7 ("Como evitar alucinação geral");
PR-DIAG sempre que possível antes de PR-IMPL.

---

## 7. Necessidade de preservar governança e tração simultaneamente

O projeto oscila entre dois extremos: governança apertada que mata tração,
ou tração rápida que perde governança. O equilíbrio é manter o loop
contratual (`CLAUDE.md` §4) sem deixar virar burocracia.

**Sinal de alerta:** PRs muito grandes (perda de governança) ou PRs muito
pequenas só de governança (perda de tração).

**Mitigação:** PR pequena com escopo claro + governança atualizada
sempre + PR-PROVA fechando frente.

---

## 8. Backlinks

- → schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md
- → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → schema/brain/SYSTEM_AWARENESS.md
- → brain/memories/project-principles.md
- → brain/memories/hard-rules.md
- → brain/learnings/what-worked.md
- → brain/learnings/what-failed.md
- → brain/learnings/future-risks.md
