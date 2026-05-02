# Questões Abertas: Lacunas Técnicas Não Resolvidas

**Data de abertura:** 2026-04-30 (PR39)
**Atualizado em:** 2026-05-01 (PR61)
**Estado:** Ativas — múltiplas lacunas, cada uma com próxima ação sugerida

---

## Lacunas identificadas até PR39

| Questão | Estado | Impacto |
|---------|--------|---------|
| Como o LLM Core vai priorizar fontes do brain? | Aberta | Alto — define design do Intent Engine |
| Quando o Skill Router vai usar o brain como contexto? | Aberta | Alto — conecta brain ao runtime |
| Como o brain vai distinguir memória de curto vs. longo prazo? | Aberta | Médio — design de retrieval |
| Como evitar que o brain cresça sem curadoria? | Aberta | Médio — sustentabilidade do brain |

---

## Seção PR31–PR60 — Lacunas do ciclo Jarvis Brain

Adicionada na PR61 após consolidação do ciclo.

### G1 — Skill Executor runtime não existe

**Estado:** Aberta — blueprint criado na PR65
**PR de referência:** PR51, PR52, PR60, PR65

**Contexto:**
Skill Router read-only foi implementado (PR51) e validado (PR52).
Mas o Skill Executor — o módulo que executaria a skill — não existe.
PR65 criou o blueprint documental do Runtime de Skills (`schema/skills-runtime/`).

**Questão em aberto:**
Como implementar execução de skill de forma segura, com gate de aprovação humana e sem autonomia cega?

**Por que está aberta:**
Implementar sem PR-DIAG + PR-IMPL + PR-PROVA dedicadas viola o contrato.
PR65 criou o blueprint, mas não o runtime.

**Impacto se não resolvida:**
Skills continuam documentais indefinidamente. Enavia não executa nenhuma skill.

**Próxima ação:**
PR66 — PR-DIAG — Diagnóstico técnico: responder 12 perguntas abertas de `schema/skills-runtime/OPEN_QUESTIONS.md`.

---

### G2 — /skills/run não existe

**Estado:** Aberta — blueprint criado na PR65
**PR de referência:** PR52, PR53, PR54, PR60, PR65

**Contexto:**
Intent Retrieval retorna contexto de skills, Skill Router faz roteamento read-only.
Mas o endpoint `/skills/run` que executaria a skill não foi criado.
PR65 criou o blueprint e definiu que o primeiro endpoint deve ser `/skills/propose` (não `/skills/run` direto).

**Questão em aberto:**
Quando e como criar `/skills/propose` (primeiro endpoint) de forma segura?

**Por que está aberta:**
Criar endpoint sem contrato viola princípio de governed execution.
Blueprint criado, mas diagnóstico técnico (PR66) ainda é necessário.

**Impacto se não resolvida:**
Usuário não pode solicitar execução de skill via API.

**Próxima ação:**
PR66 — PR-DIAG — Diagnosticar onde o runtime deve viver, quais bindings são necessários, e confirmar que `/skills/propose` é o primeiro endpoint.

---

### G3 — Escrita automática de memória não existe

**Estado:** on-hold (não blocking)
**Atualizado em:** 2026-05-02 (PR64)
**PR de referência:** PR41, PR43, PR60, PR63, PR64

**Contexto:**
Brain Loader lê do brain (snapshot estático, read-only).
Nenhum módulo escreve no brain automaticamente.
PR63 diagnosticou que a camada documental foi concluída pela PR61.
O fluxo manual via PR é o mecanismo vigente e suficiente por ora.

**Decisão PR63/PR64:**
G3 está formalmente **on-hold**. Não bloqueia o Runtime de Skills.
Implementar escrita automática antes de Runtime de Skills existir incorre no risco R1 (docs_over_product).

**Motivo:**
O fluxo manual via PR (agente propõe → operador aprova ao mergear) é funcional, supervisionado e seguro.
Não há skills executando que gerariam conteúdo real para memorizar automaticamente.

**O que NÃO fazer agora:**
- Não criar `/memory/write`
- Não criar `/brain/write`
- Não implementar módulo de escrita automática de memória

**Próxima ação:**
Reavaliar após Runtime de Skills existir e haver conteúdo operacional real para memorizar.

---

### G4 — Self-Audit não bloqueia mecanicamente

**Estado:** Parcialmente resolvida (by design)
**PR de referência:** PR56, PR58, PR59, PR60

**Contexto:**
Self-Audit detecta 10 categorias de risco. Por decisão arquitetural, não bloqueia
o fluxo mecanicamente (exceto `secret_exposure` em modo `blocking`).

**Questão em aberto:**
Quando (se algum dia) deve o Self-Audit bloquear automaticamente outros riscos além de secret_exposure?

**Por que está aberta:**
Bloquear automaticamente pode travar operações legítimas por falso positivo.

**Impacto se não resolvida:**
Self-Audit continua sendo diagnóstico, não firewall. Operador precisa tomar ação manual com base nos findings.

**Próxima ação sugerida:**
Avaliar no planejamento da próxima fase se algum categoria adicional merece blocking.

---

### G5 — Response Policy orienta, não reescreve

**Estado:** Parcialmente resolvida (by design)
**PR de referência:** PR59, PR60

**Contexto:**
Response Policy tem 15 regras mas não altera `reply` automaticamente.
Orienta o LLM via prompt, mas não há enforcement mecânico.

**Questão em aberto:**
Como verificar se o LLM está seguindo as orientações da Response Policy em produção real?

**Por que está aberta:**
Sem LLM externo em harness de teste, não é possível validar resposta real.

**Impacto se não resolvida:**
Response Policy pode ser ignorada pelo LLM sem que o sistema detecte.

**Próxima ação sugerida:**
Avaliar harness de teste com LLM real em nova fase do contrato.

---

### G6 — Finding I1: Intent Classifier não reconhece variantes com advérbio

**Estado:** Aberta (baixo impacto)
**PR de referência:** PR60 Cenário I

**Contexto:**
"você já consegue executar skills de verdade?" retorna `unknown` em vez de `capability_question`.
Causa: `_CAPABILITY_TERMS` usa "você consegue" como substring, não captura "você já consegue".

**Questão em aberto:**
Adicionar variantes com advérbio ("já consegue", "já tem capacidade de") à lista de termos.

**Por que está aberta:**
Impacto baixo — sistema se comporta com segurança mesmo com unknown.
Correção merece PR dedicada, não cirúrgica junto com outra coisa.

**Impacto se não resolvida:**
Frases com "já" antes de termos de capacidade retornam `unknown`.
Sistema não ativa roteamento `capability_question` para esses casos.

**Próxima ação sugerida:**
PR-IMPL cirúrgica dedicada quando contrato autorizar (Finding I1).

---

### G7 — Validação real com LLM externo

**Estado:** Aberta
**PR de referência:** PR44, PR47, PR50, PR60

**Contexto:**
Todos os testes do ciclo são pure unit tests — sem rede, KV, FS ou LLM externo real.
O harness atual não testa o comportamento real do LLM com os prompts gerados.

**Questão em aberto:**
Como criar harness seguro para validar comportamento real do LLM em produção?

**Por que está aberta:**
Requer ambiente controlado, credenciais de LLM, e definição de asserções sobre comportamento.

**Impacto se não resolvida:**
Gap entre testes unitários e comportamento real do sistema em produção.

**Próxima ação sugerida:**
Avaliar no planejamento da próxima fase (PR62 PR-DIAG).
