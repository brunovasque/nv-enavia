# PR45 — Diagnóstico do Prompt Atual do Chat pós-Brain Loader

**Data:** 2026-05-01
**Tipo:** PR-DIAG (READ-ONLY)
**Branch:** `copilot/claudepr45-diag-prompt-atual-chat-pos-brain`
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`
**PR anterior validada:** PR44 — PR-PROVA — mergeada (PR #205). Relatório: `schema/reports/PR44_PROVA_BRAIN_LOADER_CHAT_RUNTIME.md`.

---

## 1. Objetivo

Diagnosticar, em modo READ-ONLY, o estado atual do prompt do chat depois da entrada do
Brain Loader (PR43/PR44). Medir tamanho, mapear todos os blocos, identificar redundâncias,
conflitos e riscos de engessamento. Decidir o escopo da PR46 com base em evidência.

**Nenhum runtime foi alterado nesta PR.**

---

## 2. Fontes analisadas

| Arquivo | Propósito |
|---------|-----------|
| `schema/enavia-cognitive-runtime.js` | Função `buildChatSystemPrompt` — montagem real do prompt |
| `schema/enavia-brain-loader.js` | `getEnaviaBrainContext` — Brain Context (seção 7c) |
| `schema/enavia-identity.js` | `getEnaviaIdentity` — identidade canônica |
| `schema/enavia-capabilities.js` | `getEnaviaCapabilities` — capacidades/limitações |
| `schema/enavia-constitution.js` | `getEnaviaConstitution` — guardrails |
| `schema/operational-awareness.js` | `renderOperationalAwarenessBlock` — awareness operacional |
| `schema/planner-classifier.js` | Classificador de pedidos (PM4) |
| `schema/planner-output-modes.js` | Modos de saída do planner (PM5) |
| `schema/memory-read.js` | Pipeline de leitura de memória (PM3) |
| `nv-enavia.js` | Worker principal — como `buildChatSystemPrompt` é chamado |
| `schema/brain/self-model/how-to-answer.md` | Como responder (Brain documental) |
| `schema/brain/self-model/current-state.md` | Estado atual (Brain documental) |
| `schema/brain/SYSTEM_AWARENESS.md` | System awareness (Brain documental) |
| `schema/reports/PR43_IMPL_BRAIN_LOADER_READONLY.md` | Relatório PR43 |
| `schema/reports/PR44_PROVA_BRAIN_LOADER_CHAT_RUNTIME.md` | Relatório PR44 |
| `tests/pr43-brain-loader-readonly.smoke.test.js` | Smoke PR43 — 32/32 ✅ |
| `tests/pr44-brain-loader-chat-runtime.prova.test.js` | Prova PR44 — 38/38 ✅ |

Método: leitura direta dos arquivos + execução read-only via Node.js do próprio código de
montagem do prompt (sem LLM externo, sem chamadas de rede, sem escrita).

---

## 3. Inventário do prompt atual

A função `buildChatSystemPrompt` em `schema/enavia-cognitive-runtime.js` monta o prompt
conversacional em 8 seções numeradas. A ordem real de montagem é:

| # | Seção | Arquivo/função origem | Objetivo | Chars aprox. | Tokens est. | Sempre injetado? |
|---|-------|-----------------------|----------|:------------:|:-----------:|:----------------:|
| 1 | Identidade viva | `enavia-identity.js` + `buildChatSystemPrompt` seção 1 | Quem a Enavia é | ~548 | ~137 | ✅ sim |
| 1b | Papel operacional + proibições | `buildChatSystemPrompt` seção 1b | Evitar papel antigo (assistente comercial) | ~1.142 | ~286 | ✅ sim |
| 2 | Tom conversacional | `buildChatSystemPrompt` seção 2 | Como falar | ~1.025 | ~256 | ✅ sim |
| 3 | Capacidades reais | `enavia-capabilities.js` + seção 3 | O que consegue fazer agora | ~829 | ~207 | ✅ sim |
| 4 | Guardrails (constituição) | `enavia-constitution.js` + seção 4 | Princípios de segurança | ~485 | ~121 | ✅ sim |
| 5 | Contexto dinâmico da sessão | `buildChatSystemPrompt` seção 5 | page/topic/recent_action/metadata | 0–200 | 0–50 | ⚙️ condicional (se context preenchido) |
| 5b | Operational Awareness | `operational-awareness.js` + seção 5b | Estado real dos braços operacionais | 0–500 | 0–125 | ⚙️ condicional (se `operational_awareness` passado) |
| 5c | Target informativo + nota read_only | `buildChatSystemPrompt` seção 5c | Alvo operacional ativo (factual) | 0–260 | 0–65 | ⚙️ condicional (se `hasActiveTarget`) |
| 5c+ | MODO OPERACIONAL ATIVO (bloco pesado) | `buildChatSystemPrompt` seção 5c + bloco pesado | Regras de comportamento operacional | 0–1.895 | 0–474 | ⚙️ condicional (apenas `is_operational_context=true`) |
| 6 | Política de planner/ferramentas | `buildChatSystemPrompt` seção 6 | Quando usar use_planner, regras do reply | ~1.620 | ~405 | ✅ sim |
| 7 | Continuidade de conversa | seção 7 | Histórico da conversa | ~304 | ~76 | ✅ sim |
| 7b | Uso e criação de memória | seção 7b | Regras de memória operacional | ~646 | ~162 | ✅ sim |
| 7c | Brain Context (PR43) | `enavia-brain-loader.js` | Self-model + system awareness do Brain documental | ~4.002 | ~1.001 | ✅ sim (flag `include_brain_context`, default true) |
| 8 | Envelope JSON | seção 8 | Contrato de formato `{reply, use_planner}` | ~344 | ~86 | ✅ sim |

> **Nota:** a memória recuperada do KV (PM3/PR3) é injetada como mensagem `system` separada
> (não dentro da string do `buildChatSystemPrompt`) pelo `nv-enavia.js`, entre o system
> prompt e o histórico de conversa. Ela NÃO entra na string do `buildChatSystemPrompt`.
> Seu tamanho é variável e depende do conteúdo do KV em runtime.

---

## 4. Medição por cenário

Medições executadas via Node.js (sem LLM externo) chamando diretamente
`buildChatSystemPrompt` com os parâmetros de cada cenário.

### Cenário A — Conversa simples sem target
Exemplo: `oi`

| Métrica | Valor |
|---------|-------|
| Chars totais | **10.945** |
| Tokens estimados (chars/4) | **~2.736** |
| Brain Context presente | ✅ sim |
| MODO OPERACIONAL ATIVO | ❌ não |
| Target informativo | ❌ não |
| Operational Awareness | ❌ não |
| Custo relativo | moderado |

### Cenário B — Conversa simples com target read_only
Exemplo: `Você está parecendo um bot`

| Métrica | Valor |
|---------|-------|
| Chars totais | **11.205** |
| Tokens estimados | **~2.801** |
| Brain Context presente | ✅ sim |
| MODO OPERACIONAL ATIVO | ❌ não (correto — só `is_operational_context=true`) |
| Target informativo | ✅ sim (factual) |
| Nota read_only | ✅ sim (gate, não tom) |
| Custo relativo | moderado |

### Cenário C — Pergunta de identidade
Exemplo: `Quem é você?`

Idêntico ao Cenário A (sem target nem op_context no sistema): **10.945 chars / ~2.736 tokens**

### Cenário D — Pergunta de capacidade
Exemplo: `Você sabe operar seu sistema?`

Idêntico ao Cenário A: **10.945 chars / ~2.736 tokens**

### Cenário E — Pedido operacional real
Exemplo: `Revise a PR 204 e veja se o Brain Loader quebrou o anti-bot`

| Métrica | Valor |
|---------|-------|
| Chars totais | **12.840** |
| Tokens estimados | **~3.210** |
| Brain Context presente | ✅ sim |
| MODO OPERACIONAL ATIVO | ✅ sim (`is_operational_context=true`) |
| Target informativo | ✅ sim |
| Custo relativo | moderado-alto |

### Cenário F — Contexto operacional real com target completo
Exemplo: target ativo + `is_operational_context=true` + `operational_awareness` preenchido

| Métrica | Valor |
|---------|-------|
| Chars totais | **13.743** |
| Tokens estimados | **~3.436** |
| Brain Context presente | ✅ sim |
| MODO OPERACIONAL ATIVO | ✅ sim |
| Target informativo | ✅ sim |
| Operational Awareness | ✅ sim |
| Custo relativo | alto (máximo do sistema atual) |

### Resumo comparativo

| Cenário | Chars | Tokens est. | Delta vs baseline |
|---------|------:|:-----------:|:-----------------:|
| Sem Brain Context (baseline) | 6.943 | ~1.736 | — |
| A (simples, sem target) | 10.945 | ~2.736 | +4.002 (+1.000 tok) |
| B (simples, target read_only) | 11.205 | ~2.801 | +4.262 (+1.065 tok) |
| E (operacional, is_op=true) | 12.840 | ~3.210 | +5.897 (+1.474 tok) |
| F (operacional completo + awareness) | 13.743 | ~3.436 | +6.800 (+1.700 tok) |

**O Brain Context adiciona exatamente +4.002 chars / ~+1.000 tokens a CADA conversa.**
O custo é constante e determinístico — Brain Loader é snapshot estático.

---

## 5. Blocos sempre injetados vs condicionais

### Sempre injetados (100% das conversas)

| Bloco | Chars | Tokens est. | % do total (baseline) |
|-------|------:|:-----------:|:---------------------:|
| Seções 1–4 (Identidade+Papel+Tom+Caps+Constituição) | ~4.029 | ~1.007 | 58% |
| Seção 6 (Política Planner/Ferramentas) | ~1.620 | ~405 | 23% |
| Seção 7/7b (Continuidade+Memória) | ~950 | ~238 | 14% |
| Seção 8 (Envelope JSON) | ~344 | ~86 | 5% |
| **Subtotal fixo (sem Brain)** | **~6.943** | **~1.736** | **100%** |
| Seção 7c (Brain Context — PR43) | ~4.002 | ~1.001 | — |
| **Total com Brain** | **~10.945** | **~2.736** | — |

### Condicionais

| Bloco | Condição | Chars aprox. |
|-------|----------|:------------:|
| Contexto dinâmico da sessão (seção 5) | `context.page/topic/recent_action/metadata` preenchidos | 0–200 |
| Operational Awareness (seção 5b) | `operational_awareness` passado pelo caller | 0–500 |
| Target informativo (seção 5c) | `hasActiveTarget = true` | ~150–260 |
| Nota factual read_only (seção 5c) | `target.mode === "read_only"` | ~200 |
| MODO OPERACIONAL ATIVO / bloco pesado (seção 5c+) | `is_operational_context === true` | ~1.895 |

---

## 6. Redundâncias encontradas

### R1 — Identidade ENAVIA duplicada entre seções 1-4 e Brain
**Classificação: tolerável**

- Seção 1 define: `Você é a ENAVIA — Inteligência operacional e cognitiva autônoma.`
- Brain block "Identidade" repete: `Você é a ENAVIA — IA operacional estratégica do projeto Enavia/Enova.`
- Seção 2 reforça: `Identidade fixa: você se chama ENAVIA.`
- Total: `ENAVIA` aparece **11x** no prompt com Brain (5x nas seções 1-4, 3x no Brain, 3x no envelope/seções finais).
- **Por que tolerável:** os ângulos são ligeiramente diferentes (runtime vs. self-model). O reforço de identidade ajuda a resistir a prompt injection. Custo: ~200 chars extras.

### R2 — Capacidades reais duplicadas entre seção 3 e Brain block 2
**Classificação: problemática**

- Seção 3 (`enavia-capabilities.js`) lista: `can` e `cannot_yet` completos.
- Brain block 2 "Capacidades atuais" re-lista praticamente o mesmo conteúdo, em formato diferente.
- Brain block 3 "Limites operacionais" re-lista a maioria do `cannot_yet` em formato bullet.
- **Impacto:** ~600–800 chars duplicados (~150–200 tokens desperdiçados) em toda conversa.
- **Risco:** duas listas de capacidades com ligeiramente wording diferente pode confundir o LLM sobre o que é autoritativo.
- **Recomendação PR46:** consolidar em uma única fonte.

### R3 — Guardrails duplicados entre seção 4 e Brain block 3+4
**Classificação: tolerável**

- Seção 4 (`enavia-constitution.js`) lista `operational_security` (10 princípios).
- Brain block 3 "Limites operacionais" repete ~7 dos mesmos princípios em wording diferente.
- Brain block 4 "Estado atual" reforça `read_only é gate` (mas este ponto é único no Brain — não está na seção 4).
- **Por que tolerável:** reforço de guardrails é saudável para segurança. O custo é baixo.

### R4 — Tom e naturalidade duplicados entre seção 2 e Brain block 5
**Classificação: saudável**

- Seção 2 define o tom conversacional: natural, direto, humano, não templates rígidos.
- Brain block 5 "Como responder" reforça com regras mais detalhadas (inteligência antes de checklist, não fingir certeza, separar modos, etc.).
- **O Brain adiciona valor real aqui:** as regras de `how-to-answer.md` são mais ricas e específicas do que a seção 2. Não são cópias exatas.
- **Classificação saudável:** os dois ângulos se complementam sem contradição.

### R5 — "NV Imóveis" mencionada 9x no total
**Classificação: tolerável com atenção**

- Seções 1, 1b, 2 mencionam NV Imóveis 8 vezes (para deixar claro que a Enavia NÃO é a NV Imóveis).
- Brain block 1 menciona mais 1 vez.
- **Risco:** volume alto de menções à empresa do operador pode confundir o LLM sobre a identidade principal. Mas todas as menções são no contexto de **negação** (`NÃO é a NV Imóveis`), então o risco é baixo.
- A seção 1b (Papel Operacional/Proibido) existe exatamente para corrigir comportamento antigo — pode ser reduzida na PR46 quando o LLM Core consolidar identidade.

### R6 — "aprovação" mencionada 8x e "contrato" 11x
**Classificação: saudável**

- O reforço de gates de execução (aprovação humana, contrato ativo) é **intencional e necessário** para segurança operacional.
- Não é redundância problemática — é proteção em camadas.

### Sumário de redundâncias

| ID | Redundância | Classificação | PR46? |
|----|-------------|:-------------:|:-----:|
| R1 | Identidade ENAVIA duplicada (11x no prompt) | tolerável | Consolidar |
| R2 | Capacidades can/cannot_yet duplicadas | problemática | ⚠️ Consolidar |
| R3 | Guardrails duplicados (seção 4 vs Brain) | tolerável | Consolidar oportunisticamente |
| R4 | Tom/naturalidade duplicado (seção 2 vs Brain 5) | saudável | Manter — Brain adiciona valor |
| R5 | NV Imóveis mencionada 9x (negação) | tolerável com atenção | Reduzir seção 1b na PR46 |
| R6 | "aprovação" 8x / "contrato" 11x | saudável | Manter |

---

## 7. Conflitos encontrados

### C1 — Brain: "inteligência antes de checklist" vs Envelope JSON: "responda SEMPRE em JSON"
**Status: mitigado / não bloqueador**

- **Origem:** Brain block 5 diz `"Inteligência antes de checklist. Responda primeiro como IA estratégica; lista só quando útil."` O envelope JSON (seção 8) diz `"Responda SEMPRE em JSON válido com exatamente dois campos: {reply, use_planner}"`.
- **Análise:** Não é conflito real. O `reply` dentro do JSON é fala natural — o envelope só define o **wrapper**, não proíbe inteligência nem naturalidade. A seção 6 (Política de Planner) reforça isso: `"o campo reply é SEMPRE fala natural"`.
- **Impacto:** baixo. Já tratado pelo design do sistema.
- **Necessita PR46?** Não urgente. Mas na PR46 o LLM Core pode deixar a distinção envelope/conteúdo ainda mais explícita para eliminar qualquer ambiguidade residual.

### C2 — Seção 1b (PAPEL PROIBIDO) vs Brain block 5 (fala natural sem templates)
**Status: complementar, não conflituante**

- **Origem:** Seção 1b lista papeis proibidos extensamente (6 bullets negativos). Brain block 5 incentiva naturalidade sem templates.
- **Análise:** As duas seções apontam para o mesmo objetivo de formas diferentes — uma via negação de papel, outra via afirmação de comportamento positivo. Complementar.
- **Impacto:** nenhum conflito funcional. A seção 1b é volumosa (~1.142 chars) para proteger contra um comportamento antigo que pode não existir mais após PR36/PR38. Oportunidade de redução na PR46.

### C3 — Seção 3 (enavia-capabilities.js) vs Brain block 2 (Capacidades atuais)
**Status: conflito latente de autoridade**

- **Origem:** Existem duas listas de capacidades com wording diferente. `enavia-capabilities.js` é mais enxuta e runtime-orientada. Brain block 2 é mais contextual e cobre mais nuances (ex: regra de não afirmar capacidade futura).
- **Impacto:** O LLM pode ficar confuso sobre qual lista é autoritativa. Se as duas divergirem em PRs futuras (ex: `enavia-capabilities.js` for atualizada sem o Brain), surge discrepância real.
- **Necessita PR46?** ✅ Sim — consolidar em única fonte.

### C4 — Memória recuperada (PM3/PR3 via KV, injetada separadamente no `nv-enavia.js`) vs Brain Context estático
**Status: gerenciado, não bloqueador**

- **Origem:** Brain Context (seção 7c) é estático e injetado **dentro** do `buildChatSystemPrompt`. A memória recuperada do KV (PM3) é injetada como mensagem `system` separada **fora** do `buildChatSystemPrompt`, pelo `nv-enavia.js`.
- **Análise:** São duas camadas de memória com papéis distintos. Brain = self-model documental fixo. Memória KV = memória operacional viva do usuário/sessão. Não há conflito — são complementares. A PR44 (cenário F) provou que coexistem.
- **Impacto:** baixo. Só pode virar problema se Brain e memória KV passarem a incluir conteúdo contraditório. Ainda não ocorre.

### C5 — `is_operational_context` vs Brain Context que menciona "contexto operacional"
**Status: mitigado pela PR38**

- **Origem:** Brain block 4 descreve o estado atual incluindo `is_operational_context=true` como critério para ativar o bloco pesado operacional. O LLM lê isso e pode tentar simular o critério.
- **Análise:** A PR38 separou cirurgicamente o gate — `is_operational_context` é determinado pelo `isOperationalMessage()` no Worker, não pelo LLM. O LLM não controla esse gate. O Brain apenas informa que o gate existe.
- **Impacto:** baixo — gate está no Worker, não no LLM.

### C6 — Seção 1b volumosa (proteção contra papel antigo) vs comportamento já corrigido
**Status: tecnicamente correto, mas potencialmente desnecessário**

- **Origem:** Seção 1b ("PAPEL OPERACIONAL / PAPEL PROIBIDO") foi criada para corrigir o comportamento de assistente comercial/atendente. Após PR36/PR38 essa correção está no runtime. A seção 1b continua injetada em toda conversa (~1.142 chars / ~286 tokens).
- **Impacto:** custo fixo de ~286 tokens para proteger contra comportamento que já foi corrigido. Risco de "PAPEL PROIBIDO" soar excessivamente defensivo ou artificialmente rígido.
- **Necessita PR46?** ✅ Sim — candidato à redução/consolidação no LLM Core.

### Sumário de conflitos

| ID | Conflito | Status | Necessita PR46? |
|----|----------|:------:|:---------------:|
| C1 | Brain "inteligência" vs JSON "SEMPRE" | mitigado | não urgente |
| C2 | Seção 1b (papeis proibidos) vs Brain (naturalidade) | complementar | oportunístico |
| C3 | Seção 3 (capabilities) vs Brain block 2 | latente — dois autoritativos | ✅ sim |
| C4 | Brain estático vs memória KV dinâmica | gerenciado | manter separados |
| C5 | Brain descreve gate vs LLM tenta simular gate | mitigado (PR38) | não urgente |
| C6 | Seção 1b volumosa vs comportamento já corrigido | tecnicamente supérfluo | ✅ sim — reduzir |

---

## 8. Risco de engessamento

### O Brain Loader engessou o prompt?

**Não. O Brain Loader não engessou o prompt.**

Evidência:
1. A PR44 provou que 38/38 asserts passam — incluindo Cenário E (não ativa tom operacional
   em conversa simples com target) e Cenário H (prompt suficiente para responder com
   naturalidade).
2. O Brain Context reforça regras de **naturalidade** (`inteligência antes de checklist`,
   `não usar templates rígidos`, `read_only é gate, não tom`).
3. O Brain Context adiciona ao prompt conteúdo que **reduz** engessamento (self-model
   filosófico, como responder bem, estado honesto do sistema).

### O prompt pós-Brain ficou mais robótico ou mais contextual?

**Mais contextual.** O Brain acrescenta self-model, system awareness e preferências
operacionais que antes não estavam acessíveis em runtime. A Enavia agora tem consciência
de por que ela existe e como deve responder — não apenas regras.

### Quais blocos ainda podem deixar a Enavia parecer bot?

Por ordem de risco:

1. **Seção 1b (PAPEL PROIBIDO)** — lista extensa de papéis proibidos, wording defensivo,
   volume alto (~286 tokens). Pode vazar para a fala como tom excessivamente formal.
2. **Seção 6 (Política Planner)** — 405 tokens de instruções sobre `use_planner`,
   `next_action`, campos mecânicos. Instrução legítima mas volumosa.
3. **Seção 3 (capabilities)** — listas de capacidades em bullets. Útil mas pode ser
   condensada quando consolidada com o Brain.
4. **Brain Context (seção 7c)** — por si só NÃO causa robótica. Mas 7 blocos de headers
   (`### Identidade — fonte: ...`) criam estrutura de documento que pode não ser a
   forma ideal para injeção em prompt conversacional.

### O risco maior hoje é Brain Context ou envelope/planner/sanitizer?

**O risco maior é a combinação: Seção 1b + Seção 6 (planner policy) + envelope JSON.**

O Brain Context, por si só, é aliado da naturalidade. O envelope JSON e a seção 6 são
necessários mas volumosos. A Seção 1b é candidata à redução.

### Há evidência de que o Brain Context ativa modo operacional indevido?

**Não.** A PR44 prova explicitamente (Cenário E): com Brain ativo + target + `is_operational_context=false`,
o bloco `MODO OPERACIONAL ATIVO` **não aparece**. O Brain Context não altera a lógica de gate.

### Há evidência de que o Brain Context gera falsa capacidade?

**Não.** A PR44 Cenário D prova: Brain descreve `Skill Router`, `Intent Engine` e `LLM Core`
explicitamente como **não existentes em runtime**. Brain bloco 4 ("Estado atual") lista
exatamente o que NÃO existe.

---

## 9. Impacto do Brain Context

### Positivo

| Aspecto | Impacto |
|---------|---------|
| Self-model no runtime | A Enavia agora sabe quem é e como deve responder via documental |
| "inteligência antes de checklist" | Reforça anti-bot sem conflito com seções 1-4 |
| "read_only é gate, não tom" | Reforça PR36/PR38 via Brain — dupla proteção |
| Estado atual honesto | Declara o que não existe em runtime — reduz risco de alucinação |
| System awareness | Orienta sobre como usar documentos do sistema (não duplicado em seções 1-4) |
| Preferências operacionais | "Patch cirúrgico", "Diagnóstico antes de implementar" — presentes só no Brain |
| Determinístico e auditável | Allowlist hard-coded, nenhum conteúdo inesperado |

### Negativo / Atenção

| Aspecto | Impacto |
|---------|---------|
| +1.000 tokens por conversa | Custo fixo constante, independente do contexto da mensagem |
| Duplicação com seções 1-4 | ~150–200 tokens desperdiçados em identidade/capacidades duplicadas |
| Formato de headers markdown no snapshot | `### Bloco — fonte: arquivo` é estilo de documento, não de prompt |
| Snapshot pode divergir do Brain real | Sem CI de sync — custo documental de manutenção |

### Síntese

O Brain Context está **ajudando sem engessar**. A adição de ~1.000 tokens é justificada
pelo valor real entregue (self-model, system awareness, preferências). O principal problema
não é o Brain em si, mas a **duplicação desnecessária** entre o Brain e as seções 1-4 do
prompt base.

---

## 10. O que falta para LLM Core v1

### Mapeamento

| Componente | Estado atual | Ação PR46 |
|------------|:------------:|:---------:|
| `buildEnaviaCorePrompt()` | ❌ não existe | Criar — função única que centraliza identidade + Brain + política |
| Identidade centralizada (única fonte) | ⚠️ duplicada em `enavia-identity.js` + seção 1 + Brain block 1 | Consolidar |
| Capacidades centralizadas (única fonte) | ⚠️ duplicadas em `enavia-capabilities.js` + seção 3 + Brain blocks 2-3 | Consolidar |
| Seção 1b (PAPEL PROIBIDO) | ⚠️ volumosa, possivelmente supérflua pós-PR38 | Reduzir/consolidar |
| Brain blocks 1-3 (Identidade+Caps+Limites) | ⚠️ duplicam seções 1-4 do prompt | Extrair para única fonte no Core |
| Brain blocks 4-7 (Estado+HowToAnswer+SysAwareness+Memories) | ✅ único — não duplicado | Manter no Core |
| Envelope JSON `{reply, use_planner}` | ✅ funcional | Manter intacto |
| Gate `is_operational_context` (Worker) | ✅ funcional — no Worker, não no LLM | Manter inalterado |
| Sanitizers | ✅ funcionais (PR36/PR38) | Não alterar na PR46 |
| Seção 6 (Planner policy) | ✅ funcional, ~405 tokens | Candidato a compactação futura |
| Hooks para Intent Engine | ❌ não existem | Não implementar na PR46 — preparar espaço |
| Separação prompt conversa/diagnóstico/execução | ⚠️ existe logicamente, não estruturalmente | Preparar na PR46 |

### O que já existe (manter)

- `getEnaviaBrainContext()` — snapshot estático determinístico ✅
- `buildChatSystemPrompt()` — arquitetura de seções ✅
- Gate `is_operational_context` no Worker ✅
- Sanitizers preservando prosa útil ✅
- Envelope JSON `{reply, use_planner}` ✅
- Distinção target informativo vs bloco pesado operacional ✅

### O que precisa ser extraído

- Identidade/capacidades/limitações de `enavia-identity.js`, `enavia-capabilities.js`
  e `enavia-constitution.js` para uma única função `buildLLMCoreBlock()` que o
  Brain Context complementa (sem duplicar).

### O que precisa ser consolidado

- Seções 1-4 do prompt atual + Brain blocks 1-3 → única fonte de verdade.
- Resultado: Brain blocks 4-7 permanecem como o diferencial do Brain (state, how-to-answer,
  system awareness, memories) sem o overhead de re-listar identidade e capacidades.

### O que precisa ser removido/reduzido

- Seção 1b (PAPEL PROIBIDO) — de ~1.142 chars para ~200 chars máximo.
- Brain blocks 1-3 (Identidade+Caps+Limites) — substituídos pelo Core consolidado.
- Wording de seção 2 pode ser compactado se identidade/tom estiverem no Core.

### Economia estimada de tokens com LLM Core v1

| Redução | Tokens est. |
|---------|:-----------:|
| Eliminar duplicação Caps (seção 3 vs Brain blocks 2-3) | ~150–200 tok |
| Reduzir seção 1b | ~200 tok |
| Compactar headers do Brain para prompt inline | ~50 tok |
| **Total potencial** | **~400–450 tokens** por conversa |

---

## 11. Recomendação objetiva para PR46

### Diagnóstico é: VIÁVEL para LLM Core v1

Não há bloqueio real. O prompt funciona, os testes passam (558/558), o Brain Context
está ajudando sem engessar. O que existe é **oportunidade clara de melhoria**:
consolidar identidade/capacidades de duas fontes em uma.

### Recomendação

```
PR46 — PR-IMPL — LLM Core v1: consolidar identidade, Brain Context e política de resposta
```

**Escopo mínimo e seguro para PR46:**

1. **Criar `buildLLMCoreBlock()`** em `schema/enavia-cognitive-runtime.js` ou novo
   `schema/enavia-llm-core.js` — função que combina identidade + capacidades +
   guardrails em um bloco único, eliminando duplicação com Brain blocks 1-3.

2. **Reduzir Brain blocks 1-3** (Identidade, Capacidades, Limites) no `enavia-brain-loader.js`
   — quando `buildLLMCoreBlock` existir, esses blocos tornam-se redundantes. Brain mantém
   blocks 4-7 (Estado, Como responder, System awareness, Preferências).

3. **Reduzir seção 1b (PAPEL PROIBIDO)** — de 1.142 chars para declaração concisa (~100 chars).
   O comportamento anti-assistente-comercial já está corrigido em runtime.

4. **Manter intactos:**
   - Gate `is_operational_context` (Worker — não tocar)
   - Sanitizers (não tocar)
   - Envelope JSON (não tocar)
   - Target informativo + nota read_only (não tocar)
   - Seção 6 (Planner policy) — candidato a compactação futura, mas não nesta PR

5. **Garantia:** todos os 558 testes devem continuar passando após a PR46.

**Economia esperada:** ~400–450 tokens por conversa (14–16% de redução do prompt).

---

## 12. O que NÃO foi feito

- ✅ Nenhum runtime alterado.
- ✅ `schema/enavia-brain-loader.js` não alterado.
- ✅ `schema/enavia-cognitive-runtime.js` não alterado.
- ✅ `nv-enavia.js` não alterado.
- ✅ Nenhum painel alterado.
- ✅ Nenhum endpoint criado.
- ✅ Nenhum prompt real alterado.
- ✅ Nenhum sanitizer alterado.
- ✅ Nenhum Brain Context alterado.
- ✅ LLM Core não implementado nesta PR.
- ✅ Intent Engine não implementado.
- ✅ Skill Router não implementado.
- ✅ KV/bindings/secrets não alterados.
- ✅ Deploy não executado.
- ✅ PR46 não iniciada.

---

## 13. Próxima PR

```
PR46 — PR-IMPL — LLM Core v1: consolidar identidade, Brain Context e política de resposta
```

Critério de entrada: este relatório (PR45) mergeado.
Escopo: Worker-only, patch cirúrgico.
Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`.

---

## Verificações

```
git diff --name-only
# Deve mostrar apenas: schema/reports/PR45_*,
# schema/contracts/INDEX.md, schema/status/*, schema/handoffs/*, schema/execution/*
```

Nenhum arquivo `.js` de runtime foi alterado nesta PR.
