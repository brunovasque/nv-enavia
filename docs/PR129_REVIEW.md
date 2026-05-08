# PR129 — Review Canônico
# Hardening estrutural do ciclo autônomo: filtragem defensiva + validação de candidate + early-stop

**Data:** 2026-05-08  
**Branch:** `pr129-hardening-estrutural-ciclo-autonomo`  
**Tipo:** PR-IMPL (Executor-only + Worker-only)  
**Contrato:** `docs/CONTRATO_PR129.md`  
**PR anterior validada:** PR128 ✅ (mergeada — `fix/pr128-fetchsource-github-first`, PR #296)  

---

## Contexto

Diagnóstico identificou que o loop `_dispatchExecuteNextFromChat` falhava com `MAX_ATTEMPTS_REACHED` gastando 5 tentativas mesmo quando o erro era determinístico. Root cause: Codex (gpt-5.2) gera "patch de desistência" (search === replace, ou description "Não foi possível aplicar") que passa pelo normalizer, chega em `applyPatch` com AMBIGUOUS_MATCH/ANCHOR_NOT_FOUND, resulta em `candidate` nulo — que então é enviado ao `/worker-patch-safe` causando `worker_patch_safe_parse_error`. Loop tenta 5 vezes sem chance de sucesso.

---

## Deploy

| Worker | Versão | Resultado |
|--------|--------|-----------|
| `enavia-executor` | `8fc3e4fd-adb8-489a-bde4-62d9115a2c30` | ✅ Deployed (418.83 KiB) |
| `nv-enavia` | `8cd458eb-e293-4fcd-aa8b-64c5d44a994a` | ✅ Deployed |

---

## Critérios de aceite — análise

### C1 — Filtragem de patches de desistência

```
5955: const _rejectedPatches = []; // PR129: telemetria de patches descartados
5965: // PR129 — Gate 1: descartar "patch de desistência" do modelo
5969: const _isNoOp = String(search).trim() === String(replace).trim();
5970: const _isGiveUp = _desc.includes("não foi possível aplicar") || ...
5975: if (_isNoOp || _isGiveUp) {
5976:   _rejectedPatches.push({ title, reason, description_preview });
5977:   continue;
```

Patches com `search === replace` (no-op) e patches com descriptions de desistência são descartados antes de `applyPatch`. Aparecem em `_diagnostic.rejected_patches`.

**Resultado: ✅ PASS**

---

### C2 — Limitação a 1 patch

```
6008: // PR129 — Gate 2: limitar a 1 patch (defesa contra Codex desobediente)
6011: let _truncatedCount = 0;
6013:   _truncatedCount = normalized.length - 1;
6014:   normalized.length = 1;
```

Se Codex retornar 2+ patches válidos (após Gate 1), normalizer trunca para 1 e registra `_diagnostic.truncated_count`.

**Resultado: ✅ PASS**

---

### C3 — Validação de candidate antes de `/worker-patch-safe`

```
1468: // PR129 — Gate 3: validar candidate ANTES de chamar /worker-patch-safe
1472: const _candidateValid = patchResult?.candidate &&
1473:                         typeof patchResult.candidate === 'string' &&
1474:                         patchResult.candidate.length > 0 &&
1475:                         patchResult.candidate !== originalCode;
1477: if (!_candidateValid) {
1480:   error: 'NO_VALID_CANDIDATE',
1481:   detail: { candidate_present, candidate_type, candidate_length, ... }
```

Quando `candidate` é nulo, igual ao original, ou string vazia: retorna `{ ok: false, error: "NO_VALID_CANDIDATE", detail: {...} }` **sem chamar** o endpoint `/worker-patch-safe`.

**Resultado: ✅ PASS**

---

### C4 — Early-stop no loop

```
3722: let _previousErrorSignature = null; // PR129: detectar erros repetidos
3723: let _earlyStop = false;
3726: // PR129 — Early-stop: ...
3729: if (_earlyStop) {
3735:   lastError = `EARLY_STOP_DETERMINISTIC_ERROR: ${_previousErrorSignature}`;
3736:   break;

// NO_PATCH:
3805: if (_previousErrorSignature === _sig) _earlyStop = true;
3806: _previousErrorSignature = _sig;

// APPLY_ERROR:
3834: if (_previousErrorSignature === _sig) _earlyStop = true;
3835: _previousErrorSignature = _sig;

// NO_VALID_CANDIDATE:
3846: if (_previousErrorSignature === _sig) _earlyStop = true;
3847: _previousErrorSignature = _sig;
```

Quando 2 tentativas seguidas têm a mesma assinatura de erro (`NO_PATCH`, `APPLY_ERROR:reason`, `NO_VALID_CANDIDATE`), `_earlyStop = true` é ativado e o loop para na próxima iteração com `EARLY_STOP_DETERMINISTIC_ERROR`.

**Resultado: ✅ PASS**

---

### C5 — Tratamento de NO_VALID_CANDIDATE no loop

```
3839: // PR129 — detectar NO_VALID_CANDIDATE (mudança 3 do executor)
3840: const patchSafeError = proposeJson?.propose_result?.patch_safe_error || 
3841:                         proposeJson?.patch_safe_error || 
3842:                         proposeJson?.result?.patch_safe_error || null;
3843: if (patchSafeError && patchSafeError.error === "NO_VALID_CANDIDATE") {
3844:   lastError = `ATTEMPT_${attempt}_NO_VALID_CANDIDATE: ...`;
3845:   feedbackForExecutor = `Tentativa ${attempt}: applyPatch falhou ou todos os patches foram descartados...`;
```

`_dispatchExecuteNextFromChat` reconhece `NO_VALID_CANDIDATE` do executor e gera feedback contextualizado, ativando early-stop na repetição.

**Resultado: ✅ PASS**

---

### C6 — Telemetria

```
3903: const _finalError = _earlyStop ? "EARLY_STOP_DETERMINISTIC_ERROR" : "MAX_ATTEMPTS_REACHED";
3911: last_error_signature: _previousErrorSignature,
```

Retorno final inclui `error: "EARLY_STOP_DETERMINISTIC_ERROR"` (em vez de `MAX_ATTEMPTS_REACHED`) e `last_error_signature` com a assinatura do erro determinístico. `_gerarPossívelSolução` expandido com casos `EARLY_STOP_DETERMINISTIC_ERROR` e `NO_VALID_CANDIDATE`.

**Resultado: ✅ PASS**

---

### C7 — Sem regressão em ciclo feliz

Quando Codex gera 1 patch válido com âncora encontrada:
- Gate 1: `_isNoOp = false` e `_isGiveUp = false` → patch não é descartado
- Gate 2: `normalized.length === 1` → nada é truncado
- Gate 3: `_candidateValid = true` → `/worker-patch-safe` é chamado normalmente
- Early-stop: `_previousErrorSignature` nunca se repete em ciclo feliz → nenhum stop

Ciclo feliz intocado.

**Resultado: ✅ PASS (lógico — verificação E2E pendente)**

---

### C8 — Invariantes preservadas

```
7644: // merge_allowed=false sempre - gate humano obrigatório.
7712: merge_allowed: false,
```

- `merge_allowed=false`: ✅ intocado
- Gate humano antes de execute_next: ✅ não alterado
- GITHUB_TOKEN: ✅ não exposto (executor usa proxy)
- Branch nunca é main/master: ✅ não alterado
- `/worker-patch-safe` valida sintaxe antes de commit: ✅ gate mantido (Gate 3 apenas evita chamadas inválidas)

**Resultado: ✅ PASS**

---

## Resumo dos critérios

| # | Critério | Resultado |
|---|----------|-----------|
| C1 | Filtragem de patches de desistência | ✅ |
| C2 | Limitação a 1 patch + `_diagnostic` | ✅ |
| C3 | Validação de candidate antes de `/worker-patch-safe` | ✅ |
| C4 | Early-stop no loop (erro determinístico repetido) | ✅ |
| C5 | Tratamento de NO_VALID_CANDIDATE no loop | ✅ |
| C6 | Telemetria: `EARLY_STOP_DETERMINISTIC_ERROR` + `last_error_signature` | ✅ |
| C7 | Sem regressão em ciclo feliz | ✅ (lógico) |
| C8 | Invariantes preservadas | ✅ |

**8/8 verificados estáticos. E2E pendente de teste manual.**

---

## Commits

| # | Hash | Mensagem |
|---|------|---------|
| 1 | `19a70e9` | `feat(pr129): adiciona filtro de patches de desistência em callCodexEngine` |
| 2 | `bdbd993` | `feat(pr129): trunca normalized para 1 patch e adiciona _diagnostic` |
| 3 | `988a4b0` | `feat(pr129): valida candidate antes de chamar /worker-patch-safe` |
| 4 | `da3b334` | `feat(pr129): early-stop no loop de _dispatchExecuteNextFromChat` |
| 5 | `660a026` | `feat(pr129): trata NO_VALID_CANDIDATE no loop do chat` |
| 6 | (este commit) | `docs(pr129): adiciona PR129_REVIEW.md com análise completa` |

---

## Arquivos alterados

- `executor/src/index.js` — 3 pontos cirúrgicos:
  - `callCodexEngine`: Gate 1 (filtro desistência) + `_rejectedPatches` (linhas 5955-5982)
  - `callCodexEngine`: Gate 2 (truncar a 1) + `_diagnostic` no return (linhas 6008-6027)
  - Caller `/worker-patch-safe`: Gate 3 (`_candidateValid`) + `NO_VALID_CANDIDATE` (linhas 1468-1505)
- `nv-enavia.js` — 2 pontos cirúrgicos em `_dispatchExecuteNextFromChat`:
  - Variáveis early-stop + check no topo do loop (linhas 3722-3737)
  - Detecção assinatura em NO_PATCH, APPLY_ERROR, NO_VALID_CANDIDATE (linhas 3803-3848)
  - Telemetria no bloco final: `_finalError`, `last_error_signature`, `_gerarPossívelSolução` expandido

---

## Impacto esperado

| Cenário | Antes PR129 | Depois PR129 |
|---------|-------------|--------------|
| Codex gera patch de desistência | Passa para `applyPatch`, causa AMBIGUOUS_MATCH/ANCHOR_NOT_FOUND | Descartado no Gate 1 antes de `applyPatch` |
| Codex gera 2 patches válidos | Ambos chegam em `applyPatch` | Truncado para 1 pelo Gate 2 |
| `applyPatch` falha → candidate nulo | `/worker-patch-safe` chamado com `null` → `parse_error` | Gate 3 retorna `NO_VALID_CANDIDATE` sem chamar endpoint |
| Erro repetido 2x no loop | Loop esgota 5 tentativas → `MAX_ATTEMPTS_REACHED` | Loop para em 2 → `EARLY_STOP_DETERMINISTIC_ERROR` |
| Ciclo feliz (1 patch válido, âncora encontrada) | PR aberta normalmente | Inalterado |

---

## Invariantes verificados

| Invariante | Verificação |
|------------|-------------|
| `merge_allowed=false` | ✅ linha 7712, não tocado |
| Executor-only para mudanças 1-3 | ✅ apenas `executor/src/index.js` |
| Worker-only para mudança 4 | ✅ apenas `nv-enavia.js` |
| Patch cirúrgico | ✅ apenas `_dispatchExecuteNextFromChat` tocado em nv-enavia.js |
| Sem refatoração estética | ✅ apenas mudanças necessárias |
| `patch-engine.js` intocado | ✅ não alterado |
| `code-chunker.js` intocado | ✅ não alterado |

---

## Veredito

**APROVADO PARA MERGE** — 8/8 critérios estáticos verificados. E2E requer teste manual (chat → "melhora o X" → "sim" → verificar `EARLY_STOP_DETERMINISTIC_ERROR` em vez de 5 tentativas).
