# Decisão: `read_only` é gate de execução, não regra de tom

**Data:** 2026-04-30
**PR de referência:** PR35 (definição) + PR36/PR38 (implementação)
**Estado:** Ativa

---

## Contexto

Até a PR32, todo o runtime tratava `target.mode = "read_only"` (enviado pelo
painel via target default `__global__`) como instrução de comportamento e tom
para o LLM. O resultado era a Enavia respondendo de forma robótica em
conversas simples — o incidente "chat engessado" documentado em
`brain/incidents/chat-engessado-readonly.md`.

PR32 e PR34 diagnosticaram a causa em 7 camadas, evidenciando que estavam
misturadas três coisas distintas:

1. Intenção da mensagem (conversa, diagnóstico, execução).
2. Permissão de execução (deploy, escrita, mutação).
3. Tom da resposta (estratégico, técnico, operacional, acolhedor).

---

## Problema

Misturar gate de execução com regra de tom faz com que qualquer mensagem em
sessão padrão do painel ative comportamento operacional pesado, mesmo quando
a intenção é só conversa. Isso destrói a personalidade da Enavia e a torna
indistinguível de um bot de checklist.

---

## Decisão

`read_only` é **bloqueio de execução, escrita, deploy e mutação de estado**.
`read_only` **não é** bloqueio de raciocínio, conversa, explicação, discordância,
acolhimento, diagnóstico ou planejamento.

A Enavia em `read_only`:

- pode conversar com naturalidade;
- pode discordar, sugerir, acolher;
- pode raciocinar em voz alta;
- pode diagnosticar e planejar;
- **não pode** executar deploy, escrever em produção, mutar contratos ou
  workers, criar/alterar endpoints reais, ou qualquer ação irreversível.

Detalhes formais em `schema/policies/MODE_POLICY.md` §2.

---

## Alternativas consideradas

1. **Manter `read_only` como tom + adicionar override por intenção.** Rejeitada:
   acoplamento continua frágil; falsos positivos voltam.
2. **Remover `read_only` do prompt de sistema.** Rejeitada parcialmente: o
   gate ainda precisa existir na camada de execução, então `read_only`
   continua como nota factual — mas não como regra de comportamento.
3. **Separar gate de tom (escolhida).** Define 3 modos canônicos
   (`conversation`, `diagnosis`, `execution`) baseados em intenção; o `read_only`
   age só na camada de execução.

---

## Consequência

- Implementação em PR36 corrigiu `buildChatSystemPrompt` para que
  `MODO OPERACIONAL ATIVO` só seja injetado com `is_operational_context=true`.
- PR37 provou e encontrou 5 achados (system prompt ainda injetando o bloco
  em alguns casos; falsos positivos com palavras isoladas; falso negativo
  com verbo imperativo "Revise").
- PR38 corrigiu os 5 achados; teste anti-bot 56/56 ✅.
- Telemetria `sanitization: {applied, layer, reason}` foi adicionada como
  campo aditivo no `/chat/run` para observar regressão.

---

## Fonte

- `schema/policies/MODE_POLICY.md` — política formal
- `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`
- `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`
- `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`
- `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md`
- `schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md`
- `schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md`
- `schema/brain/incidents/chat-engessado-readonly.md`

---

## Como usar futuramente

- Antes de qualquer mudança em prompt, sanitizer ou envelope do `/chat/run`,
  reler esta decisão e a Mode Policy.
- Se aparecer pressão para "limitar tom em read_only", recusar — é regressão
  conhecida.
- Se aparecer regressão observável (chat voltando a parecer bot), abrir
  PR-DIAG citando esta decisão e o incidente `chat-engessado-readonly.md`.

---

## Backlinks

- → schema/policies/MODE_POLICY.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → brain/memories/hard-rules.md
- → brain/learnings/what-worked.md
- → brain/learnings/future-risks.md
