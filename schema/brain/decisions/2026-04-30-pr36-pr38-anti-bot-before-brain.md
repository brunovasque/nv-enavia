# Decisão: PR36–PR38 anti-bot antes de Brain

**Data:** 2026-04-30
**PR de referência:** PR33 (ajuste contratual) + PR36/PR37/PR38 (execução) + PR39+ (Brain)
**Estado:** Ativa

---

## Contexto

O contrato Jarvis Brain (PR31–PR60, depois ampliado para PR31–PR64) previa
inicialmente começar a construção do Obsidian Brain logo após a ativação
(PR31). A PR32 diagnosticou o problema do chat engessado e mostrou que o
runtime estava confundindo gate de execução com regra de tom.

A pergunta: **construir o Brain primeiro e corrigir o chat depois, ou corrigir
o chat primeiro e construir o Brain depois?**

---

## Problema

Construir Brain primeiro:

- Brain serve como contexto para o LLM Core futuro.
- Mas se o runtime do chat ainda gera respostas robóticas mesmo com bom
  contexto, qualquer integração futura herda o problema.
- Risco de o Brain virar "documentação bonita sobre runtime quebrado".

Corrigir chat primeiro:

- Atrasa o Brain.
- Mas garante que a base sobre a qual o Brain será conectado é estável.

---

## Decisão

PR33 ajustou o contrato para inserir uma **Frente 2 corretiva (PR33–PR36)**
focada em corrigir o chat engessado **antes** de construir o Obsidian Brain
(deslocado para PR37+, depois PR39+).

A sequência canônica passou a ser:

1. PR33 — ajuste contratual e Regras R1–R4.
2. PR34 — diagnóstico profundo de `read_only` / target / sanitizers.
3. PR35 — Mode Policy (3 modos canônicos).
4. PR36 — implementação cirúrgica do chat runtime.
5. PR37 — prova anti-bot real.
6. PR38 — correção dos achados de PR37.
7. **Frente Brain libera** (PR39 — arquitetura, PR40 — self-model, PR41 —
   popular brain).

---

## Alternativas consideradas

1. **Manter ordem original do contrato.** Rejeitada — Brain herdaria runtime
   quebrado.
2. **Corrigir chat e Brain em paralelo.** Rejeitada — viola "uma tarefa por
   PR" e mistura escopos.
3. **Corrigir chat primeiro, Brain depois (escolhida).** Frente 2 corretiva
   inserida; Brain deslocado. Encerramento da Frente 2 com PR-PROVA verde
   (56/56) destrava a frente Brain.

---

## Consequência

- Frente 2 corretiva (PR32–PR38) encerrada com 56/56 ✅ no anti-bot.
- Runtime estável após PR38 — `read_only` é gate, sanitizers preservam prosa
  útil, `isOperationalMessage` usa termos compostos.
- Brain começou em PR39 sobre base saudável.
- Tempo investido em diagnóstico + prova compensou: 5 achados reais foram
  capturados em PR37 e corrigidos em PR38, evitando regressão futura.
- Princípio reforçado: **"Não construir Brain sobre runtime quebrado"**.

---

## Fonte

- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (versão
  ampliada PR33)
- `schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md`
- `schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md`
- `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`
- `schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md`
- `schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md`
- `schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md`
- `schema/brain/incidents/chat-engessado-readonly.md`

---

## Como usar futuramente

- Generalizar o princípio: **se um runtime base está quebrado, parar a frente
  superior e corrigir antes**. Não construir camada nova sobre fundação ruim.
- Quando aparecer pressão para "saltar etapas e ir direto para o objetivo
  do contrato", reler esta decisão.
- Frentes futuras (Memory Brain runtime, LLM Core, Skill Router runtime)
  devem aplicar a mesma lógica: provar a base estável antes de construir
  a próxima camada.

---

## Backlinks

- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → brain/decisions/2026-04-30-read-only-gate-nao-tom.md
- → brain/decisions/2026-04-30-jarvis-brain-llm-first.md
- → brain/learnings/what-worked.md
- → brain/learnings/future-risks.md
