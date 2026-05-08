# CHECKLIST_FIM_DE_PR — Verificação obrigatória antes de declarar PR pronta

> Checklist que Claude Code **deve** rodar mentalmente (e reportar a Bruno) antes de marcar qualquer PR como "pronta para review".
> Cada item é obrigatório. Falha em algum = PR não pronta.

**Versão:** 1.0
**Data:** 2026-05-08
**Local no repo:** `schema/templates/CHECKLIST_FIM_DE_PR.md`

---

## QUANDO RODAR ESTE CHECKLIST

- Após implementar todos os commits do contrato
- Após executar E2E em produção
- **ANTES** de declarar "PR pronta para review" a Bruno

Se qualquer item falhar, **PR não está pronta**. Code resolve o item ou reporta a Bruno.

---

## CHECKLIST — 8 ITENS OBRIGATÓRIOS

### [1] PR_REVIEW.md gerado

- [ ] Arquivo existe em `docs/PR{N}_REVIEW.md`
- [ ] Análise critério-a-critério do contrato (todos os critérios cobertos)
- [ ] Cada critério marcado: ✅ PASS / ⚠️ PENDENTE / ❌ FAIL
- [ ] **Tabela resumo de critérios** preenchida
- [ ] **Prova E2E em produção** documentada na seção específica:
  - [ ] Comandos exatos rodados em produção real
  - [ ] Output completo dos comandos (sem edição)
  - [ ] Análise do que o output prova
  - [ ] Comparação com estado anterior (se aplicável)
- [ ] **Invariantes verificados** (tabela)
- [ ] **Veredito final**: APROVADO / REPROVADO / PENDENTE com justificativa
- [ ] Próximo passo declarado

**Validação:**
```powershell
Test-Path D:\nv-enavia\docs\PR{N}_REVIEW.md
Get-Content D:\nv-enavia\docs\PR{N}_REVIEW.md | Select-String "E2E EM PRODUÇÃO"
```

Se `False` ou ausência de seção E2E → ❌ falha.

---

### [2] schema/contracts/INDEX.md atualizado

- [ ] Entrada nova adicionada para a PR{N}
- [ ] Entrada usa template em `schema/templates/HANDOFF_INDEX_STATUS_TEMPLATES.md`
- [ ] Status marcado corretamente (Em review / Mergeada)
- [ ] Referência ao contrato (`docs/contratos/CONTRATO_PR{N}_*.md`)
- [ ] Referência ao PR_REVIEW (`docs/PR{N}_REVIEW.md`)
- [ ] Data e número da PR no GitHub

**Validação:**
```powershell
Get-Content D:\nv-enavia\schema\contracts\INDEX.md | Select-String "PR{N}"
```

Se nada aparecer → ❌ falha.

---

### [3] schema/handoffs/ENAVIA_LATEST_HANDOFF.md atualizado

- [ ] Entrada nova adicionada **no topo** do arquivo (mais recente primeiro)
- [ ] Inclui: data, PR{N}, título, contrato, branch, commits (lista de hashes), review path
- [ ] **Resultado de E2E** referenciado
- [ ] Status: EM REVIEW (ou MERGEADA se já foi merge)
- [ ] "Por que" — relação curta com contrato e fase do roadmap
- [ ] "Próximo passo" — PR{N+1} ou ajuste

**Validação:**
```powershell
Get-Content D:\nv-enavia\schema\handoffs\ENAVIA_LATEST_HANDOFF.md -TotalCount 30
```

Confirma que entrada nova está no topo, não enterrada no meio.

---

### [4] schema/status/ENAVIA_STATUS_ATUAL.md atualizado

- [ ] Estado refletindo PR{N} no topo
- [ ] Branch atual citada
- [ ] Último commit citado
- [ ] Bloqueios ativos atualizados (lista ou "nenhum")
- [ ] Próximos passos imediatos atualizados

**Validação:**
```powershell
Get-Content D:\nv-enavia\schema\status\ENAVIA_STATUS_ATUAL.md -TotalCount 30
```

---

### [5] schema/canonico/PLANO_MACRO_ENAVIA.md — Seção HANDOFF (Seção 5)

- [ ] Entrada cronológica nova **no topo** da Seção 5
- [ ] Formato:
  ```
  ### {data} — PR{N} — {título}
  - **Tipo:** PR-DOCS | PR-IMPL | PR-PROVA | PR-DIAG | PR-RECONCILIAÇÃO | PR-FIX
  - **Fase:** {fase do roadmap}
  - **Contrato:** docs/contratos/CONTRATO_PR{N}_*.md
  - **Branch:** {nome}
  - **Commits:** [{hash1}, {hash2}, ...]
  - **Review:** docs/PR{N}_REVIEW.md
  - **E2E:** {resultado real, com prova ou link}
  - **Status:** EM REVIEW (aguardando aprovação Bruno) | MERGEADA
  - **Por que:** {1-2 linhas relacionando ao contrato e à fase}
  - **Próximo passo:** PR{N+1} ou ajuste
  ```

**Validação:**
```powershell
Get-Content D:\nv-enavia\schema\canonico\PLANO_MACRO_ENAVIA.md | Select-String "PR{N}" -Context 0,5
```

---

### [6] schema/canonico/PLANO_MACRO_ENAVIA.md — Seção GOVERNANÇA (topo)

- [ ] "Última atualização" com data atual
- [ ] "Última PR mergeada" — atualizada (se PR foi mergeada nesta sessão)
- [ ] "PR em execução agora" — `nenhuma` (porque PR foi declarada pronta para review)
- [ ] "Próxima PR planejada" — PR{N+1} se já está clara, senão "TBD"
- [ ] "Bloqueios ativos" — atualizada (incluir/remover conforme aplicável)
- [ ] "Fase atual" — avançada se PR fechou a fase

**Validação:**
```powershell
Get-Content D:\nv-enavia\schema\canonico\PLANO_MACRO_ENAVIA.md -TotalCount 50
```

A seção GOVERNANÇA deve estar no topo do arquivo.

---

### [7] schema/contracts/ACTIVE_CONTRACT.md — atualização condicional

**Atualizar APENAS se:**
- A PR fecha um contrato macro
- A PR inicia um novo contrato macro
- A PR foi última de uma sequência (ex: PR130c fecha sequência PR130a/b/c)

**Caso contrário:** marcar `NÃO_APLICÁVEL` no checklist e justificar.

**Se atualizar:**
- [ ] Reflete contrato atual
- [ ] Status correto (Ativo / Encerrado em data X)
- [ ] Próxima PR autorizada citada (se aplicável)

---

### [8] schema/brain/SYSTEM_AWARENESS.md — atualização condicional

**Atualizar APENAS se:**
- A PR introduz capacidade nova (ex: skill executável real, novo endpoint canônico)
- A PR remove capacidade existente
- A PR modifica capacidade existente significativamente
- A PR descobre limitação não documentada

**Caso contrário:** marcar `NÃO_APLICÁVEL` no checklist e justificar.

**Se atualizar:**
- [ ] Adicionar seção nova (ex: "Seção 12 — Capacidades pós-PR{N}")
- [ ] **Não apagar histórico** — só adicionar
- [ ] Citar PR e contrato como evidência da mudança
- [ ] Atualizar estado mental do sistema (current-state se relevante)

---

## REPORTE A BRUNO

Após rodar o checklist, Code reporta exatamente conforme `schema/templates/RESPOSTA_CODE_TEMPLATE.md` MOMENTO 4.

Os 8 itens devem aparecer com status claro:
- ✅ se cumprido
- ❌ se falhou (PR não está pronta)
- `NÃO_APLICÁVEL` com justificativa explícita (apenas para itens 7 e 8)

---

## REGRA ANTI-FRÁGIL

> **Os itens 2, 3, 4, 5, 6 são SEMPRE obrigatórios.**
>
> Não há "PR pequena demais para atualizar handoff/index/status". Toda PR atualiza esses 5 documentos. Sem exceção.
>
> Esta regra é o que mantém o cabresto vivo entre sessões. Bruno deve **recusar PR** que não cumpre esses 5.

---

## VALIDAÇÃO RÁPIDA POR BRUNO

Se Bruno quiser validar manualmente que o checklist foi cumprido, roda:

```powershell
cd D:\nv-enavia

$N = "{numero-da-PR}"

Write-Host "===== VALIDACAO CHECKLIST PR$N ====="

Write-Host ""
Write-Host "[1] PR_REVIEW.md:"
$review = "docs\PR$N`_REVIEW.md"
if (Test-Path $review) {
    Write-Host "  ✅ Existe ($((Get-Item $review).Length) bytes)"
    if ((Get-Content $review -Raw) -match "E2E EM PRODUÇÃO|E2E em produ") {
        Write-Host "  ✅ Tem secao E2E"
    } else {
        Write-Host "  ❌ Falta secao E2E"
    }
} else {
    Write-Host "  ❌ NAO EXISTE"
}

Write-Host ""
Write-Host "[2] INDEX.md:"
$index = Get-Content "schema\contracts\INDEX.md" -Raw
if ($index -match "PR$N") {
    Write-Host "  ✅ Cita PR$N"
} else {
    Write-Host "  ❌ Nao cita PR$N"
}

Write-Host ""
Write-Host "[3] HANDOFF:"
$handoff = Get-Content "schema\handoffs\ENAVIA_LATEST_HANDOFF.md" -TotalCount 30 -Raw
if ($handoff -match "PR$N") {
    Write-Host "  ✅ Cita PR$N nas primeiras 30 linhas"
} else {
    Write-Host "  ❌ Nao cita PR$N no topo"
}

Write-Host ""
Write-Host "[4] STATUS_ATUAL:"
$status = Get-Content "schema\status\ENAVIA_STATUS_ATUAL.md" -TotalCount 30 -Raw
if ($status -match "PR$N") {
    Write-Host "  ✅ Cita PR$N"
} else {
    Write-Host "  ❌ Nao cita PR$N"
}

Write-Host ""
Write-Host "[5] PLANO HANDOFF (Secao 5):"
$plano = Get-Content "schema\canonico\PLANO_MACRO_ENAVIA.md" -Raw
if ($plano -match "PR$N") {
    Write-Host "  ✅ Cita PR$N"
} else {
    Write-Host "  ❌ Nao cita PR$N"
}

Write-Host ""
Write-Host "[6] PLANO GOVERNANCA (topo):"
$planoTopo = Get-Content "schema\canonico\PLANO_MACRO_ENAVIA.md" -TotalCount 50 -Raw
if ($planoTopo -match "Última atualização|ultima atualizacao") {
    Write-Host "  ⚠️ Verificar manualmente se data esta atualizada"
}

Write-Host ""
Write-Host "===== FIM DA VALIDACAO ====="
```

Cola num arquivo `validar-pr.ps1` e roda passando o número da PR como parâmetro.

---

## EXEMPLO DE FALHA TÍPICA — e como Bruno deve responder

**Code reporta:**
```
PR{N} pronta para review.
PR_REVIEW.md gerado.
```

**Bruno verifica e descobre:**
- INDEX.md não foi atualizado
- HANDOFF não foi atualizado
- Plano cabresto não foi atualizado

**Resposta correta de Bruno:**

```
PR não está pronta. CHECKLIST_FIM_DE_PR não foi cumprido:

❌ Item 2: schema/contracts/INDEX.md não cita PR{N}
❌ Item 3: schema/handoffs/ENAVIA_LATEST_HANDOFF.md não cita PR{N} no topo
❌ Item 5: schema/canonico/PLANO_MACRO_ENAVIA.md HANDOFF não tem entrada PR{N}
❌ Item 6: schema/canonico/PLANO_MACRO_ENAVIA.md GOVERNANÇA não foi atualizada

Cumpra os 4 itens, atualize o reporte do MOMENTO 4
(schema/templates/RESPOSTA_CODE_TEMPLATE.md), e só então declare PR pronta.
```

**Sob nenhuma circunstância mergear PR sem checklist completo.** É o que blinda contra defasagem futura.

---

**Fim do CHECKLIST_FIM_DE_PR.md v1.0.**
