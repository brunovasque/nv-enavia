# Decisão: Jarvis Brain é LLM-first

**Data:** 2026-04-30
**PR de referência:** PR31 (ativação) + PR33 (ajuste contratual) + PR40/PR41 (consolidação documental)
**Estado:** Ativa

---

## Contexto

O contrato `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (ampliado para PR31–PR64
em PR33) estabelece a próxima fase do projeto: transformar a Enavia em uma IA
operacional viva. Antes desse contrato, a Enavia era um sistema governado /
documental, não um agente cognitivo real.

A pergunta arquitetural central: **a Enavia deve ser construída como pipeline
de regras com LLM auxiliar, ou como inteligência LLM com regras auxiliares?**

---

## Problema

Sistema construído como pipeline de regras com LLM auxiliar:

- Personalidade fica refém do código de regras (foi exatamente o que gerou o
  chat engessado).
- Mudança de comportamento exige PR-IMPL no runtime.
- Difícil estender para novos contextos.

Sistema construído como LLM com regras auxiliares (LLM-first):

- Personalidade é da inteligência LLM.
- Regras (Mode Policy, gates, sanitizers) restringem execução, não pensamento.
- Mais flexível, porém exige governança forte para não vazar para produção
  sem aprovação.

---

## Decisão

A Enavia é **LLM-first**. Ela é uma inteligência estratégica com ferramentas,
não uma ferramenta com frases automáticas.

Isso implica:

- O raciocínio vem primeiro; a estrutura serve ao raciocínio.
- Contratos, skills, mapas, workers e executores são **ferramentas da
  inteligência**, não a personalidade dela.
- A inteligência existe antes dos formulários; os formulários capturam o
  resultado da inteligência.
- Gates de execução (`read_only`, aprovação humana) restringem efeito
  colateral, **não** restringem pensamento, conversa ou diagnóstico.

Frase canônica:

> "A Enavia pensa livremente, lembra com estrutura, sugere com inteligência
> e executa somente com governança."

---

## Alternativas consideradas

1. **Pipeline-first com LLM auxiliar.** Rejeitada — gera o problema do chat
   engessado e travamento de personalidade.
2. **LLM puro sem governança.** Rejeitada — risco operacional inaceitável,
   especialmente no contexto Enova (deploy real, executor real).
3. **LLM-first com governança em camada separada (escolhida).** O LLM Core
   pensa livremente; a Mode Policy e os gates atuam só na camada de execução.

---

## Consequência

- O contrato Jarvis Brain prevê LLM Core, Memory Brain, Skill Router,
  Intent Engine, Self-Audit como peças de uma arquitetura LLM-first.
- O Obsidian Brain documental (PR39, PR40, PR41) é a base para a memória
  consultável pelo LLM Core futuro.
- O Self Model (`schema/brain/self-model/`) deixa explícita a identidade
  LLM-first, para que qualquer agente que opere a Enavia entenda esse
  princípio antes de tocar runtime.
- Frente 2 corretiva (PR32–PR38) precisava encerrar antes — não dá para
  construir LLM-first sobre runtime que confunde gate com tom.

---

## Fonte

- `schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
- `schema/reports/PR31_ATIVACAO_CONTRATO_JARVIS_BRAIN.md`
- `schema/reports/PR40_SELF_MODEL_ENAVIA_REPORT.md`
- `schema/brain/self-model/identity.md`
- `schema/policies/MODE_POLICY.md`

---

## Como usar futuramente

- Quando aparecer proposta de "regra dura no LLM" para resolver problema de
  comportamento, reler esta decisão. A solução correta é ajustar gate ou
  Mode Policy, não constranger o LLM.
- Quando aparecer proposta de "remover governança para destravar a Enavia",
  reler esta decisão. A solução correta é separar gate de execução do
  raciocínio, não remover gate.
- Toda decisão arquitetural futura (Memory Brain, Skill Router, Intent
  Engine) precisa ser coerente com LLM-first.

---

## Backlinks

- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → schema/brain/self-model/identity.md
- → schema/policies/MODE_POLICY.md
- → brain/memories/project-principles.md
- → brain/decisions/2026-04-30-read-only-gate-nao-tom.md
