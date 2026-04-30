# Aprendizado — O que falhou

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Síntese consolidada de padrões de falha observados nos contratos
PR1–PR40.

---

## 1. Excesso documental gerando desconfiança

Em alguns períodos o ritmo de PR-DOCS sem PR-IMPL/PR-PROVA fez o operador
desconfiar do projeto: "está virando repo bonito sem produto". O reconhecimento
formal está em `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md`.

> Generalização: documentação só vale quando reduz risco ou orienta execução.
> Doc cosmético não conta — vira ruído e mina confiança.

**Como evitar:** alternar PR-DOCS com PR-IMPL/PR-PROVA; recusar criar
documento sem propósito operacional; sinalizar quando o ritmo documental
estiver alto demais.

---

## 2. Chat respondendo robótico por `target` / `read_only` mal interpretados

`target.mode = "read_only"` enviado pelo painel via target default
(`__global__`) ativava "MODO OPERACIONAL ATIVO read_only" em **toda** sessão
de chat, mesmo conversa simples. Resultado: respostas em bullet points,
frases estereotipadas, falta de naturalidade.

> Generalização: misturar gate de execução com regra de tom destrói a
> personalidade. É a regressão mais provável neste runtime.

**Como evitar:** `brain/decisions/2026-04-30-read-only-gate-nao-tom.md` é
referência canônica. Qualquer mudança em prompt, sanitizer ou envelope do
`/chat/run` exige PR-DIAG citando o incidente.

> Fonte: `schema/brain/incidents/chat-engessado-readonly.md`.

---

## 3. Falsos positivos com palavras genéricas

`isOperationalMessage` tinha termos isolados ("sistema", "contrato") que
ativavam contexto operacional em qualquer mensagem que mencionasse essas
palavras. PR37 capturou isso (achados C1, G5).

> Generalização: detecção de intenção baseada em palavra isolada gera ruído
> demais. Termos compostos ou padrões mais ricos são necessários.

**Como evitar:** `brain/memories/hard-rules.md` §3 — termos compostos
("estado do contrato", "contrato ativo", "runtime", "gate") + verbos
imperativos ("revise", "verifique", "cheque", "inspecione"). Reler antes
de adicionar termo novo a `_CHAT_OPERATIONAL_INTENT_TERMS`.

---

## 4. Confundir skills documentais com runtime

Em diversas interações, agentes responderam como se houvesse runtime de
skills (`/skills/run`, "skill router decidiu", "skill foi disparada"). Não
há. As 4 skills (`CONTRACT_LOOP_OPERATOR`, `DEPLOY_GOVERNANCE_OPERATOR`,
`SYSTEM_MAPPER`, `CONTRACT_AUDITOR`) são **documentais**.

> Generalização: documento operacional ≠ runtime. Se não há executor, não
> há execução.

**Como evitar:** sempre dizer "documental" antes de descrever skill.
`brain/maps/skill-map.md` §1 e §5 deixam isso explícito.

---

## 5. Latest Handoff virando histórico em vez de handoff curto

`schema/handoffs/ENAVIA_LATEST_HANDOFF.md` em algumas sessões foi inflado
para descrever toda a história da PR anterior em vez de apenas: o que foi
feito + o que ficou aberto + qual a próxima PR autorizada.

> Generalização: handoff é entrega rápida entre sessões — não substitui
> relatório de PR (`schema/reports/PRxx_*.md`).

**Como evitar:** handoff curto, focado em: arquivos alterados + próximo
passo + bloqueios. Detalhes ficam no relatório. Status atual é a foto do
estado, não a história.

---

## 6. Backlinks

- → schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md
- → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md
- → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → brain/decisions/2026-04-30-read-only-gate-nao-tom.md
- → brain/decisions/2026-04-30-skills-documentais-antes-de-runtime.md
- → brain/memories/hard-rules.md
- → brain/memories/recurring-patterns.md
- → brain/learnings/future-risks.md
