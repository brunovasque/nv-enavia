# PR46 — LLM Core v1

**Data:** 2026-05-01
**Tipo:** PR-IMPL (Worker-only, patch cirúrgico)
**Branch:** `copilot/claudepr46-impl-llm-core-v1`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR45 — PR-DIAG — mergeada. Relatório: `schema/reports/PR45_PROMPT_CHAT_POS_BRAIN_DIAGNOSTICO.md`.

---

## 1. Objetivo

Implementar o LLM Core v1 da Enavia, consolidando identidade, capacidades, política
de resposta e relação com o Brain Context em uma camada central do prompt do chat,
reduzindo redundância sem perder segurança, anti-bot, governança ou envelope JSON.

A meta é eliminar a duplicação grosseira entre as antigas seções 1 (identidade),
1b (papel/proibições), 2 (tom), 3 (capacidades) e 4 (guardrails) do `buildChatSystemPrompt`,
substituindo-as por um único bloco compacto e auditável (LLM Core v1).

---

## 2. Diagnóstico usado

A PR45 (READ-ONLY) mediu o prompt em 6 cenários e identificou:

| Achado PR45 | Classificação | Endereçado em PR46? |
|-------------|:-------------:|:-------------------:|
| R2 — Capacidades duplicadas (seção 3 vs Brain blocks 2-3) | **problemática** | ✅ Sim — Core consolida sec 3 |
| R5 — "NV Imóveis" mencionada 9x (negação) | tolerável c/ atenção | ✅ Sim — reduzido a 3x |
| C3 — Conflito latente de autoridade (caps em 2 fontes) | latente | ✅ Sim — Core é referência runtime |
| C6 — Seção 1b volumosa (~1.142 chars) | tecnicamente supérfluo | ✅ Sim — reduzido a 1 bullet compacto |
| R1 — Identidade ENAVIA duplicada (11x) | tolerável | ✅ Parcial — caiu para ~6x |
| R3 — Guardrails duplicados | tolerável | ⏸ Mantido — Brain inalterado por escopo |
| R4 — Tom (sec 2 vs Brain block 5) | saudável | ✅ Mantido — Brain complementa |
| R6 — "aprovação" 8x / "contrato" 11x | saudável | ✅ Mantido (segurança em camadas) |

Brain Loader **não** foi alterado nesta PR — escopo do enunciado restringe `enavia-brain-loader.js`
a "expor helper/metadata sem mudar o snapshot principal", então toda a economia veio do Core
+ consolidação em `buildChatSystemPrompt`.

---

## 3. Arquitetura implementada

### Antes (PR43–PR45)

```
buildChatSystemPrompt(opts):
  sec 1   Identidade viva               (~548 chars)
  sec 1b  Papel operacional + proibido  (~1.142 chars)
  sec 2   Tom conversacional            (~1.025 chars)
  sec 3   Capacidades                   (~829 chars)
  sec 4   Guardrails                    (~485 chars)
  sec 5   Contexto dinâmico             (cond.)
  sec 5b  Operational Awareness         (cond.)
  sec 5c  Target informativo + read_only (cond.)
  sec 5c+ MODO OPERACIONAL ATIVO        (cond. is_operational_context=true)
  sec 6   Política Planner              (~1.620 chars)
  sec 7   Continuidade                  (~304 chars)
  sec 7b  Memória                       (~646 chars)
  sec 7c  Brain Context                 (~4.002 chars)
  sec 8   Envelope JSON                 (~344 chars)
```

### Depois (PR46)

```
buildChatSystemPrompt(opts):
  sec 1   LLM Core v1 (consolida 1+1b+2+3+4)  ~3.580 chars
  sec 5   Contexto dinâmico                   (cond.)
  sec 5b  Operational Awareness               (cond.)
  sec 5c  Target informativo + read_only      (cond.)
  sec 5c+ MODO OPERACIONAL ATIVO              (cond. is_operational_context=true)
  sec 6   Política Planner                    (~1.620 chars — inalterado)
  sec 7   Continuidade                        (~304 chars — inalterado)
  sec 7b  Memória                             (~646 chars — inalterado)
  sec 7c  Brain Context                       (~4.002 chars — inalterado)
  sec 8   Envelope JSON                       (~344 chars — inalterado)
```

`buildLLMCoreBlock({ ownerName })` é função pura, determinística, sem I/O,
exportada em `schema/enavia-llm-core.js`. Importa `getEnaviaIdentity`,
`getEnaviaCapabilities` e `getEnaviaConstitution` (fontes inalteradas) e
produz o bloco único.

---

## 4. Arquivos alterados

| Arquivo | Tipo | Motivo |
|---------|:----:|--------|
| `schema/enavia-llm-core.js` | **NOVO** | Camada LLM Core v1 — `buildLLMCoreBlock()` + `getLLMCoreMetadata()` |
| `schema/enavia-cognitive-runtime.js` | modificado | Substituiu seções 1, 1b, 2, 3, 4 por chamada ao `buildLLMCoreBlock` |
| `tests/pr46-llm-core-v1.smoke.test.js` | **NOVO** | Smoke test PR46 — 7 cenários (A–G), 43 asserts |
| `schema/reports/PR46_IMPL_LLM_CORE_V1.md` | **NOVO** | Este relatório |
| `schema/contracts/INDEX.md` | governança | Próxima PR autorizada → PR47 |
| `schema/status/ENAVIA_STATUS_ATUAL.md` | governança | Status pós-PR46 |
| `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | governança | Handoff PR46 → PR47 |
| `schema/execution/ENAVIA_EXECUTION_LOG.md` | governança | Registro PR46 |

**NÃO alterados (conforme escopo):**
`nv-enavia.js`, `schema/enavia-brain-loader.js` (snapshot principal preservado),
`schema/enavia-identity.js`, `schema/enavia-capabilities.js`, `schema/enavia-constitution.js`,
`schema/operational-awareness.js`, painel, executor, deploy worker, workflows,
`wrangler.toml`, `wrangler.executor.template.toml`, KV/bindings/secrets.

---

## 5. O que virou LLM Core

`buildLLMCoreBlock({ ownerName })` consolida em um único bloco:

1. **Identidade** — nome, papel, descrição (de `enavia-identity.js`).
2. **Relação com operador** — `ownerName` + dono da empresa + negação clara
   ("Você NÃO é a NV Imóveis nem a Enova"). Reduzido de ~5 linhas para 1 linha.
3. **Papel operacional** — orquestrador cognitivo, NÃO assistente comercial /
   atendente / organizadora de processos. Reduzido de 19 linhas (seção 1b
   inteira) para **1 linha**.
4. **Tom** — fala natural, LLM-first, sem templates rígidos, sem terceira pessoa.
   Reduzido de 11 bullets (seção 2) para **1 linha**.
5. **Capacidades reais agora** — bullets de `getEnaviaCapabilities().can`.
6. **Limitações atuais** — bullets de `getEnaviaCapabilities().cannot_yet`.
7. **Falsa capacidade bloqueada** — Skill Router runtime, `/skills/run`,
   Intent Engine completo, escrita automática de memória ainda NÃO existem;
   Brain Loader é READ-ONLY.
8. **Regra de ouro** — de `getEnaviaConstitution().golden_rule`.
9. **Ordem obrigatória** — Entender → Diagnosticar → Planejar → Validar → Executar → Revisar.
10. **Princípios de segurança operacional** — bullets de
    `getEnaviaConstitution().operational_security`.
11. **`read_only` como GATE de execução, NÃO regra de tom** — declaração explícita.
12. **Execução exige contrato + escopo + aprovação humana**.
13. **Relação com Brain Context** — Core é referência de runtime; Brain
    complementa com self-model documental sem autorizar execução.

`getLLMCoreMetadata()` exporta uma lista auditável das treze chaves para teste/introspecção.

---

## 6. O que foi reduzido

| Item | Antes (chars aprox.) | Depois | Δ |
|------|---------------------:|-------:|--:|
| Seção 1 — Identidade viva (verbosa, 6 linhas) | ~548 | ~250 (no Core) | -298 |
| Seção 1b — Papel + 4 papéis proibidos + 4 exemplos | ~1.142 | ~290 (1 bullet) | **-852** |
| Seção 2 — Tom conversacional (11 bullets) | ~1.025 | ~290 (1 bullet) | **-735** |
| Seção 3 — Capacidades (cabeçalhos + bullets) | ~829 | ~770 (consolidado, sem duplicação) | -59 |
| Seção 4 — Guardrails (cabeçalho + 10 bullets) | ~485 | ~440 | -45 |
| **Total redução em seções consolidadas** | **~4.029** | **~2.040** | **~-1.989** |

Mas o LLM Core também inclui novos componentes consolidados (falsa capacidade,
ordem obrigatória, read_only gate, relação com Brain) que somam ~1.540 chars.
Saldo líquido medido por cenário: **~-449 chars / -112 tokens por conversa**.

| Marcador | Antes | Depois |
|----------|------:|-------:|
| Ocorrências de "NV Imóveis" | **9** | **3** |
| Ocorrências de "ENAVIA" | 11 | ~7 |
| Bullets duplicados de capacidades em duas seções | 2 listas | 1 lista |

---

## 7. O que foi mantido

- ✅ **Brain Context** — `getEnaviaBrainContext()` continua injetado por padrão,
  desligável via `include_brain_context:false`, antes do envelope JSON, sem
  ativar tom operacional, sem autorizar execução, com limite de 4.000 chars.
  Snapshot do Brain Loader **inalterado** (escopo restringe alteração).
- ✅ **Envelope JSON** `{reply, use_planner}` — totalmente intacto.
- ✅ **Target informativo** — bloco factual `[ALVO OPERACIONAL ATIVO]` continua
  aparecendo quando `hasActiveTarget=true`, independente de contexto operacional.
- ✅ **`MODO OPERACIONAL ATIVO`** — só aparece quando `is_operational_context===true`
  (gate da PR38 inalterado).
- ✅ **`read_only` como gate** — nota factual continua aparecendo quando
  `target.mode==="read_only"`. Tratado também como gate explícito no LLM Core.
- ✅ **Sanitizers** — não alterados (estão em `nv-enavia.js`, fora do escopo).
- ✅ **Gates de execução** — não alterados.
- ✅ **Operational Awareness** (PR4) — `renderOperationalAwarenessBlock` inalterado.
- ✅ **Política de planner / `use_planner`** — seção 6 inalterada.
- ✅ **Continuidade de conversa + regras de uso/criação de memória** — seções 7/7b inalteradas.
- ✅ **Função `buildCognitivePromptBlock`** (consumidor histórico) — inalterada.
- ✅ **Helpers existentes** (`buildCognitiveRuntime`, `getEnaviaIdentity`,
  `getEnaviaCapabilities`, `getEnaviaConstitution`) — inalterados.

---

## 8. Medição de prompt pós-PR46

Medições executadas via Node.js sobre `buildChatSystemPrompt`, mesmos cenários da PR45.

| Cenário | Chars | Tokens (est.) | Brain | MODO OP |
|---------|------:|:-------------:|:-----:|:-------:|
| A — simples sem target | **10.496** | ~2.624 | ✅ | ❌ |
| B — simples com target read_only | **10.738** | ~2.685 | ✅ | ❌ |
| C — identidade | **10.496** | ~2.624 | ✅ | ❌ |
| D — capacidade | **10.496** | ~2.624 | ✅ | ❌ |
| E — operacional real | **12.363** | ~3.091 | ✅ | ✅ |
| F — operacional completo + awareness | **13.240** | ~3.310 | ✅ | ✅ |

---

## 9. Comparação com PR45

| Cenário | PR45 chars | PR46 chars | Δ chars | Δ tokens (est.) | % redução |
|---------|----------:|----------:|--------:|----------------:|----------:|
| A — simples sem target | 10.945 | 10.496 | **-449** | **-112** | **-4,1%** |
| B — simples target read_only | 11.187* | 10.738 | -449 | -112 | -4,0% |
| C — identidade | 10.945 | 10.496 | -449 | -112 | -4,1% |
| D — capacidade | 10.945 | 10.496 | -449 | -112 | -4,1% |
| E — operacional real | 12.812* | 12.363 | -449 | -112 | -3,5% |
| F — operacional completo | 13.689* | 13.240 | -449 | -112 | -3,3% |

> *Cenários B/E/F: pequenas diferenças de baseline vs relatório PR45 (11.205/12.840/13.743 lá)
> são por arredondamento dos parâmetros do `target` no medidor; o método é o mesmo.
> O delta `Δ` é consistente em todos os cenários: **-449 chars / ~-112 tokens** por conversa.

### Por que a economia foi menor que o estimado pela PR45?

A PR45 estimou ~400–450 tokens (14–16%) **assumindo que Brain blocks 1-3 seriam reduzidos**.
O escopo desta PR46 **proíbe alteração do snapshot principal do Brain Loader** ("schema/enavia-brain-loader.js,
somente se for necessário expor helper/metadata sem mudar o snapshot principal").

Por isso a economia veio só da consolidação das antigas seções 1+1b+2+3+4 do
`buildChatSystemPrompt` no LLM Core. Resultado real: **-112 tokens / -4,1% por conversa**.

A duplicação caps/limitações entre o Core e Brain blocks 2-3 (R2/C3 do PR45)
permanece — endereçável em PR futura quando autorizada alteração do Brain Loader.

**Não sacrificamos segurança para economizar tokens** — preservamos
todos os bullets de capacidades, limitações, princípios operacionais e gates.

---

## 10. Segurança e falsa capacidade

O LLM Core declara explicitamente como **NÃO existentes em runtime**:

- Skill Router runtime → "ainda NÃO existe"
- Endpoint `/skills/run` → "ainda NÃO existe"
- Intent Engine completo → "ainda NÃO existe"
- Escrita automática de memória → "ainda NÃO existe"
- Brain Loader → "READ-ONLY e não autoriza execução"

E declara explicitamente o que **EXIGE** para executar:

- Contrato ativo
- Escopo declarado
- Aprovação humana explícita

`read_only` continua sendo tratado como **gate** (não como tom):
"Em read_only você continua livre para conversar, raciocinar, explicar, diagnosticar
e planejar; o que fica bloqueado é deploy/patch/merge/escrita sem aprovação."

Sanitizers, gates, envelope JSON e Worker (`nv-enavia.js`) **não foram tocados**.

---

## 11. Testes executados

### Sintaxe (node --check)

```bash
node --check schema/enavia-llm-core.js              # OK
node --check schema/enavia-cognitive-runtime.js     # OK
node --check schema/enavia-brain-loader.js          # OK
node --check tests/pr46-llm-core-v1.smoke.test.js   # OK
```

### Smoke PR46 (novo)

```bash
node tests/pr46-llm-core-v1.smoke.test.js
# → 43 passed / 0 failed
```

### Regressões obrigatórias

| Teste | Resultado |
|-------|:---------:|
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | **38/38 ✅** |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | **32/32 ✅** |
| `tests/pr37-chat-runtime-anti-bot-real.smoke.test.js` | **56/56 ✅** |
| `tests/pr36-chat-runtime-anti-bot.smoke.test.js` | **26/26 ✅** |
| `tests/pr21-loop-status-states.smoke.test.js` | **53/53 ✅** |
| `tests/pr20-loop-status-in-progress.smoke.test.js` | **27/27 ✅** |
| `tests/pr19-advance-phase-e2e.smoke.test.js` | **52/52 ✅** |
| `tests/pr14-executor-deploy-real-loop.smoke.test.js` | **183/183 ✅** |
| `tests/pr13-hardening-operacional.smoke.test.js` | **91/91 ✅** |
| **TOTAL regressões** | **558/558 ✅** |
| **+ Smoke PR46** | **43/43 ✅** |
| **TOTAL geral** | **601/601 ✅** |

> Observação: a primeira execução de PR44 quebrou em 1 assert (`/consegue fazer agora/i`)
> porque o LLM Core inicialmente usava o cabeçalho "CAPACIDADES REAIS AGORA:". Foi
> ajustado cirurgicamente para "CAPACIDADES REAIS — o que você consegue fazer agora:"
> preservando a regressão sem alterar o teste.

---

## 12. Riscos restantes

1. **Duplicação Core ↔ Brain blocks 2-3 (R2/C3 PR45) ainda existe.**
   Endereçável em PR futura, quando o escopo permitir alterar o snapshot do
   Brain Loader. Hoje, é redundância segura — Core é a referência de runtime
   (declarado explicitamente no próprio Core).

2. **Economia menor que o estimado pela PR45 (-112 tok vs -400/-450 tok previstos).**
   Causa: escopo restringiu Brain Loader. Documentado.

3. **Headers do Brain (`### Bloco — fonte: ...`) continuam em formato documental.**
   Mantidos por escopo. Pode ser compactado em PR futura sem perder rastreabilidade.

4. **Seção 6 (Política Planner)** continua em ~1.620 chars / ~405 tokens.
   Candidato a compactação futura, fora do escopo desta PR (enunciado pediu
   "manter planner policy, salvo redução mínima se comprovadamente redundante" —
   nenhuma redundância grosseira identificada que justifique mexer agora).

5. **PR47 (PR-PROVA) precisa validar a resposta viva real com o LLM Core v1**
   em ambiente com LLM externo (não simulado), para confirmar que a redução de
   redundância não afetou a qualidade subjetiva da resposta.

---

## 13. Próxima PR recomendada

Se todos os testes passaram (✅ confirmado: 601/601):

```
PR47 — PR-PROVA — Teste de resposta viva com LLM Core v1
```

Objetivo: validar com cenários reais (chat live ou simulação com LLM externo)
que o LLM Core v1 produz respostas vivas, naturais e não engessadas, mantendo
anti-bot, gates de execução e falsa capacidade bloqueada.

Se algo falhar antes do PR47:

```
PR47 — PR-IMPL — Correção cirúrgica do LLM Core v1
```
