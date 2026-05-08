# BOOTSTRAP_SESSAO.md — REPO nv-enavia

> **Primeira leitura obrigatória de qualquer sessão**, em qualquer máquina, qualquer aba, qualquer IA.
> Este arquivo existe para garantir que o trabalho **sobreviva à mudança de contexto**.

---

## QUEM ESTÁ LENDO ESTE ARQUIVO?

Se você é **Bruno** abrindo o repo em uma nova máquina, leia a Seção A.
Se você é **Claude Code** começando uma nova sessão, leia a Seção B.
Se você é **Claude (chat web — cérebro estratégico)** começando nova aba, leia a Seção C.

---

## SEÇÃO A — Bruno em nova máquina

### A.1 Sincronizar repo
```powershell
cd <pasta-do-projeto>
git pull origin main
```

### A.2 Abrir o estado vivo
Abrir e ler em ordem:
1. `docs/canonico/PLANO_MACRO_ENAVIA.md` — visão estratégica e roadmap
2. `schema/contracts/INDEX.md` — qual contrato está ativo
3. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` — última PR e estado
4. `schema/status/ENAVIA_STATUS_ATUAL.md` — última PR detalhada

### A.3 Verificar coerência
- A última PR mergeada no GitHub bate com o que está em GOVERNANÇA do Plano Macro?
- O contrato ativo no INDEX é o mesmo declarado em ACTIVE_CONTRACT?
- Se houver divergência: **bug de governança** — abrir issue antes de iniciar nova PR

### A.4 Continuar de onde parou
Você consulta GOVERNANÇA do Plano Macro:
- "Próxima PR planejada" → essa é a PR a executar
- "Bloqueios ativos" → resolver primeiro se houver
- "Decisões estratégicas pendentes" → resolver antes de codar

---

## SEÇÃO B — Claude Code em nova sessão

### B.1 Confirmar leitura
Antes de qualquer ação, ler na ordem:

```
1. CLAUDE.md (raiz do repo)
2. BOOTSTRAP_SESSAO.md (este arquivo)
3. docs/canonico/PLANO_MACRO_ENAVIA.md (INTEIRO — especialmente seções GOVERNANÇA e Ritual)
4. schema/contracts/INDEX.md
5. schema/contracts/ACTIVE_CONTRACT.md
6. schema/handoffs/ENAVIA_LATEST_HANDOFF.md
7. schema/status/ENAVIA_STATUS_ATUAL.md
8. schema/brain/SYSTEM_AWARENESS.md
9. schema/CODEX_WORKFLOW.md
10. Contrato específico da PR atual (docs/contratos/CONTRATO_PR{N}_*.md)
```

Confirmar leitura respondendo:
```
WORKFLOW_ACK: ok
PR alvo: PR{N} — <título>
Contrato: docs/contratos/CONTRATO_PR{N}_*.md
Fase atual: <fase do roadmap>
Bloqueios ativos detectados: <lista ou "nenhum">
Defasagem entre documentos canônicos: <sim/não, descrever se sim>
```

### B.2 Verificar coerência (CRÍTICO)

Antes de qualquer linha de código, verificar se há **defasagem entre documentos do `schema/`**:

- `schema/contracts/INDEX.md` cita até PR `X`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` cita até PR `Y`
- `schema/status/ENAVIA_STATUS_ATUAL.md` cita até PR `Z`

Se `X`, `Y`, `Z` **não baterem**, isso é defasagem. **PARAR e reportar a Bruno.** Esse é o bug P4 do plano cabresto v2.

### B.3 Atualizar GOVERNANÇA antes de tocar em código

Editar `docs/canonico/PLANO_MACRO_ENAVIA.md` seção GOVERNANÇA:
- "PR em execução agora: PR{N} — <título>"
- "Última atualização: <data atual>"

Commit dessa atualização **antes** de qualquer mudança de código.

### B.4 Executar conforme contrato

Seguir o ritual da Seção 4 do Plano Macro:
- Branch conforme contrato
- Commits atômicos
- Sem desvios sem adendo formal

### B.5 Encerrar tarefa com 6 critérios de "feito"

Ver Seção 3.5 do Plano Macro. Os 6 critérios. Sem qualquer um deles, não pedir merge.

**Especialmente crítico:** atualizar os 4 documentos canônicos do `schema/` antes do PR ficar pronto para review:
- `schema/contracts/INDEX.md` (use template em `schema/templates/INDEX_ENTRY_TEMPLATE.md`)
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` (use template em `schema/templates/HANDOFF_ENTRY_TEMPLATE.md`)
- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/brain/SYSTEM_AWARENESS.md` (se houver mudança de capacidade)

E também o HANDOFF do Plano Macro (Seção 5).

---

## SEÇÃO C — Claude (chat web — cérebro estratégico) em nova aba

### C.1 Não tem acesso direto ao repo

Você (Claude chat) trabalha por conversa com Bruno. Você não tem acesso filesystem direto.

### C.2 Solicitar a Bruno os documentos vivos

Pedir a Bruno (em PowerShell):

```powershell
$files = @(
    "docs\canonico\PLANO_MACRO_ENAVIA.md",
    "schema\contracts\INDEX.md",
    "schema\contracts\ACTIVE_CONTRACT.md",
    "schema\handoffs\ENAVIA_LATEST_HANDOFF.md",
    "schema\status\ENAVIA_STATUS_ATUAL.md",
    "schema\brain\SYSTEM_AWARENESS.md"
)
$output = @()
foreach ($f in $files) {
    $output += "================================================================================"
    $output += "ARQUIVO: $f"
    $output += "================================================================================"
    if (Test-Path $f) { $output += Get-Content $f -Raw } else { $output += "[NAO ENCONTRADO]" }
    $output += ""; $output += ""
}
$output -join "`n" | Out-File -FilePath "BOOTSTRAP_LEITURA.txt" -Encoding utf8
```

Bruno cola o `BOOTSTRAP_LEITURA.txt` no chat. Você lê com a mesma disciplina que se estivesse lendo direto do filesystem.

### C.3 Confirmar que tem o estado vivo

Antes de propor qualquer plano, confirmar a Bruno:

```
Estado lido:
- Última PR mergeada: PR{N}
- Fase atual do roadmap: <fase>
- Próxima PR planejada: PR{M}
- Bloqueios ativos: <lista>
- Defasagem detectada: <sim/não>

Posso prosseguir?
```

Sem essa confirmação, não montar contrato, não propor PR, não escrever código.

### C.4 Quando montar contrato novo

Usar o template em `schema/templates/CONTRATO_TEMPLATE.md` (pedir a Bruno o conteúdo se não tiver).

Salvar em `docs/contratos/CONTRATO_PR{N}_<NOME>.md`.

---

## REGRA UNIVERSAL — Sincronização local ↔ repo

Toda alteração documental ou de código segue:

1. Trabalho feito local (Bruno na máquina dele OU Claude Code editando arquivos)
2. `git add` + `git commit` em branch da PR
3. `git push` para o branch
4. PR aberta no GitHub
5. Após merge: `git pull origin main` em todas as máquinas/abas que estiverem usando

**Nunca trabalhar sem `git pull` recente.** O repo é a fonte de verdade. Local desatualizado = trabalho perdido.

---

## EM CASO DE EMERGÊNCIA / DEFASAGEM

Se ao iniciar uma sessão você detectar:
- INDEX desatualizado em > 1 PR
- HANDOFF e STATUS apontando para PRs diferentes
- SYSTEM_AWARENESS contradizendo capabilities visíveis no código
- Contrato ativo no ACTIVE_CONTRACT que não existe em `docs/contratos/`

**PARAR. Reportar a Bruno. Abrir PR de reconciliação ANTES de qualquer outra coisa.**

A primeira reconciliação após o cabresto v2 está prevista como Pré-Fase 0 (PR130-132) no Plano Macro.

---

**Versão deste arquivo:** 1.0
**Última atualização:** 2026-05-08
**Mantido por:** Bruno + Claude (chat web)
**Local no repo:** raiz (`/BOOTSTRAP_SESSAO.md`)
