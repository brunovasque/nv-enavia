# ENAVIA — Latest Handoff

**Data:** 2026-05-01
**De:** PR47 — PR-PROVA — Prova de Resposta Viva com LLM Core v1
**Para:** PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1 (regras tonais truncadas)

## O que foi feito nesta sessão

### PR47 — PR-PROVA — Prova de Resposta Viva LLM Core v1

**Tipo:** `PR-PROVA` (sem alteração de runtime)
**Branch:** `copilot/claudepr47-prova-resposta-viva-llm-core-v1`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR46 ✅ (mergeada — PR #207)

**Objetivo:**
Provar que o LLM Core v1 (PR46) preserva ou melhora a qualidade da resposta da
Enavia, sem voltar ao comportamento robótico, sem criar falsa capacidade, sem
quebrar anti-bot, sem relaxar governança.

**Arquivos novos:**
- `tests/pr47-resposta-viva-llm-core-v1.prova.test.js` — 10 cenários A–J, 79 asserts
- `schema/reports/PR47_PROVA_RESPOSTA_VIVA_LLM_CORE_V1.md` — relatório completo

**Arquivos modificados:**
- `schema/contracts/INDEX.md` — próxima PR autorizada virou PR48 cirúrgica
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (este arquivo)
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

**Arquivos NÃO alterados (nenhum runtime tocado):**
`nv-enavia.js`, `schema/enavia-llm-core.js`, `schema/enavia-cognitive-runtime.js`,
`schema/enavia-brain-loader.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets,
sanitizers, prompt real, gates, endpoints.

**Resultado da prova: ⚠️ FALHOU PARCIALMENTE — 75/79 asserts (94,9%)**

| Cenário | Resultado |
|---------|-----------|
| A — Identidade viva | ✅ 12/12 |
| B — Pergunta de capacidade | ✅ 11/11 |
| C — Frustração / anti-bot emocional | ⚠️ 7/9 (2 achados) |
| D — Pedido de próxima PR | ⚠️ 4/6 (2 achados) |
| E — Pedido operacional real | ✅ 7/7 |
| F — Falsa capacidade bloqueada | ✅ 5/5 |
| G — `read_only` como gate | ✅ 7/7 |
| H — Tamanho/duplicação | ✅ 14/14 |
| I — Envelope JSON preservado | ✅ 5/5 |
| J — Sanitizers/gates preservados | ✅ 7/7 |

**4 achados reais (causa raiz única):** o snapshot do Brain Loader trunca em
4.000 chars antes de incluir regras 5–10 de
`schema/brain/self-model/how-to-answer.md`. Especificamente ausentes do
prompt em runtime:

- **C1:** "excesso documental" (regra 8)
- **C2:** "Isso é opcional. Não mexa agora." (regra 8)
- **D1:** "resposta curta + prompt completo" (regra 7)
- **D2:** "sem reabrir discussão" (regra 7)

**O que foi preservado integralmente:**
- Identidade viva (Enavia, IA operacional estratégica, LLM-first, não é Enova/NV/atendente).
- Capacidades sem falsa autonomia (Skill Router runtime / `/skills/run` /
  Intent Engine completo declarados como ainda NÃO existentes).
- Anti-bot operacional: frustração não ativa MODO OPERACIONAL.
- `read_only` como gate de execução, não tom.
- Skills documentais vs runtime: skills citadas como guias documentais.
- Tamanho/duplicação sem regressão: A=10.496 (-449), B=10.738 (-449),
  E=12.363 (-449), F=12.435 (-1.254) chars vs PR45 baseline. "NV Imóveis" 3x.
- Envelope JSON `{reply, use_planner}` preservado.

**Testes:**
- `node --check` em `enavia-llm-core.js`, `enavia-cognitive-runtime.js`,
  `enavia-brain-loader.js`, `pr47-resposta-viva-llm-core-v1.prova.test.js` → OK
- PR47 prova: **75/79 (4 achados documentados)**
- Regressões obrigatórias: PR46 (43/43) ✅, PR44 (38/38) ✅, PR43 (32/32) ✅,
  PR37 (56/56) ✅, PR36 (26/26) ✅, PR21 (53/53) ✅, PR20 (27/27) ✅,
  PR19 (52/52) ✅, PR14 (183/183) ✅, PR13 (91/91) ✅ → **601/601 ✅**

## Próxima etapa segura

**PR48 — PR-IMPL — Correção cirúrgica do LLM Core v1 (regras tonais truncadas)**

Conforme contrato PR47 ("Se a prova falhar… próxima PR deve ser PR48 — PR-IMPL —
Correção cirúrgica do LLM Core v1"), a próxima PR NÃO é o Classificador de
intenção, mas a correção cirúrgica.

**Escopo sugerido (a detalhar no prompt da PR48):**
1. Levar regras 6, 7 e 8 de `how-to-answer.md` para o **LLM Core** (ou para um
   bloco compacto adjacente), evitando depender do truncamento variável do
   Brain Loader.
2. Frase canônica "Isso é opcional. Não mexa agora." precisa estar no prompt
   em runtime.
3. Política "próxima PR = resumo curto + prompt completo + sem reabrir
   discussão" precisa estar no prompt em runtime.
4. Reavaliar o snapshot do Brain Loader: ou aumentar limite por bloco para a
   fonte `how-to-answer.md`, ou compactar as regras 1–4 para abrir espaço
   para 5–10. Manter limite total ≤ 4.000 chars como princípio.

**Escopo proibido em PR48 cirúrgica:**
- Não implementar Intent Engine.
- Não implementar Skill Router runtime.
- Não criar `/skills/run`.
- Worker-only / patch cirúrgico.

Após PR48 cirúrgica + nova PR-PROVA verde, então sim avançar para PR49 com o
Classificador de intenção (antiga PR48 — Intent Engine v1).

## Bloqueios

Nenhum bloqueio impeditivo de criar PR47. Branch sem conflitos com `main`.
Nenhum runtime alterado. Governança atualizada. Achados são tonais e estão
documentados no relatório PR47.

## Riscos restantes

1. **R1 (alto, mapeado):** Truncamento do Brain Loader corta regras 5–10 de
   how-to-answer. Endereçável na PR48 cirúrgica.
2. **R2 (baixo):** Identidade, capacidades, limitações e gates de segurança
   seguem firmes — os achados são tonais, não de segurança.
3. **R3 (baixo):** "próxima PR" aparece no prompt como capability, mas SEM a
   política de tom associada (regra 7). Endereçável na PR48 cirúrgica.
