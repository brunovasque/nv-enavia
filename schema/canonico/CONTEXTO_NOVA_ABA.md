# CONTEXTO_NOVA_ABA — Como dar contexto completo a uma nova aba do Claude

> Documento canônico vinculante.
> Resolve o problema: "Quando eu abrir uma nova aba do Claude (chat web), como faço para que ele entenda o projeto inteiro sem eu precisar explicar do zero?"

**Versão:** 1.0
**Data:** 2026-05-08
**Local no repo:** `schema/canonico/CONTEXTO_NOVA_ABA.md`
**Aprovado por:** Bruno Vasques

---

## CONTEXTO

Claude (chat web) **não tem memória entre sessões**. Cada aba começa do zero. Se Bruno trocar de aba, máquina ou IA, o novo Claude começa sem nenhum conhecimento do projeto Enavia, das PRs anteriores, das decisões tomadas, do estado vivo.

A solução é estrutural: toda informação de estado vive em **arquivos versionados no repo**. Quando uma aba nova abre, Bruno cola o conteúdo desses arquivos no chat, e o novo Claude opera com contexto completo.

Este documento define **exatamente como fazer isso** — comando pronto, lista de arquivos, ordem de leitura.

---

## SEÇÃO 1 — KIT MÍNIMO DE CONTEXTO (8 arquivos)

Estes são os 8 arquivos que cobrem ~95% das situações em que uma aba nova precisa entender o projeto:

| # | Arquivo | O que contém |
|---|---------|--------------|
| 1 | `BOOTSTRAP_SESSAO.md` (raiz) | Primeira leitura obrigatória, define ritual da sessão |
| 2 | `CLAUDE.md` (raiz) | Cabresto operacional, regras de execução |
| 3 | `schema/canonico/PLANO_MACRO_ENAVIA.md` | Visão estratégica, roadmap, governança, HANDOFF cronológico |
| 4 | `schema/canonico/FLUXO_OPERACIONAL.md` | 3 papéis (Bruno, Claude chat, Code) e ciclo de PR |
| 5 | `schema/contracts/INDEX.md` | Índice de contratos do projeto |
| 6 | `schema/contracts/ACTIVE_CONTRACT.md` | Contrato ativo no momento |
| 7 | `schema/handoffs/ENAVIA_LATEST_HANDOFF.md` | Última PR e estado mais recente |
| 8 | `schema/status/ENAVIA_STATUS_ATUAL.md` | Status detalhado da última PR |
| 9 | `schema/brain/SYSTEM_AWARENESS.md` | Auto-consciência do sistema, capacidades atuais |

**Total estimado:** ~155 KB. Cabe em uma única mensagem do chat.

---

## SEÇÃO 2 — COMANDO POWERSHELL PRONTO

Bruno roda este comando para gerar um arquivo único com todo o kit mínimo concatenado:

```powershell
cd D:\nv-enavia

$arquivos = @(
    "BOOTSTRAP_SESSAO.md",
    "CLAUDE.md",
    "schema\canonico\PLANO_MACRO_ENAVIA.md",
    "schema\canonico\FLUXO_OPERACIONAL.md",
    "schema\contracts\INDEX.md",
    "schema\contracts\ACTIVE_CONTRACT.md",
    "schema\handoffs\ENAVIA_LATEST_HANDOFF.md",
    "schema\status\ENAVIA_STATUS_ATUAL.md",
    "schema\brain\SYSTEM_AWARENESS.md"
)

$output = @()
$output += "================================================================================"
$output += "BOOTSTRAP_LEITURA — Contexto completo do projeto Enavia"
$output += "Gerado em: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$output += "Branch atual: $(git branch --show-current)"
$output += "Ultimo commit: $(git log -1 --oneline)"
$output += "================================================================================"
$output += ""

foreach ($f in $arquivos) {
    $output += "================================================================================"
    $output += "ARQUIVO: $f"
    $output += "================================================================================"
    if (Test-Path $f) {
        $output += Get-Content $f -Raw
    } else {
        $output += "[ARQUIVO NAO ENCONTRADO]"
    }
    $output += ""
    $output += ""
}

$output -join "`n" | Out-File -FilePath "D:\nv-enavia\BOOTSTRAP_LEITURA.txt" -Encoding utf8
Write-Host ""
Write-Host "Arquivo gerado: D:\nv-enavia\BOOTSTRAP_LEITURA.txt"
Write-Host "Tamanho: $((Get-Item D:\nv-enavia\BOOTSTRAP_LEITURA.txt).Length) bytes"
Write-Host ""
Write-Host "Cole o conteudo deste arquivo no inicio da conversa com Claude (chat web) numa nova aba."
```

**O que o comando faz:**
1. Lê os 9 arquivos do kit mínimo
2. Concatena com separadores claros
3. Inclui no topo: data atual, branch atual, último commit (pra Claude saber em que ponto está)
4. Salva em `D:\nv-enavia\BOOTSTRAP_LEITURA.txt`
5. **Esse arquivo está no `.gitignore`** (regra `BLOCO*_LEITURA.txt` já cobre, ou adicionar `BOOTSTRAP_LEITURA.txt` específico)

---

## SEÇÃO 3 — PROCEDIMENTO COMPLETO PARA ABRIR NOVA ABA

### Passo 1 — Bruno garante que repo local está atualizado

```powershell
cd D:\nv-enavia
git pull origin main
```

Se houver branches abertas em andamento, garantir que estão sincronizadas.

### Passo 2 — Bruno gera o BOOTSTRAP_LEITURA

Roda o comando da Seção 2.

### Passo 3 — Bruno abre nova aba do Claude (chat web)

### Passo 4 — Bruno cola conteúdo do BOOTSTRAP_LEITURA na primeira mensagem

Junto com instrução breve. Modelo:

```
Estou abrindo uma nova aba do Claude para dar continuidade ao projeto Enavia.
Você não tem memória das conversas anteriores. Vou colar abaixo o contexto
completo do projeto (kit mínimo de 9 arquivos canônicos).

Antes de qualquer ação:
1. Leia tudo abaixo com disciplina
2. Confirme com WORKFLOW_ACK listando o estado real lido
3. Aguarde meu OK antes de qualquer proposta ou execução

[CONTEÚDO DO BOOTSTRAP_LEITURA.txt aqui]
```

### Passo 5 — Claude (nova aba) confirma WORKFLOW_ACK

Resposta esperada (formato do BOOTSTRAP_SESSAO.md Seção B.1):

```
WORKFLOW_ACK: ok

Estado lido:
- Última PR mergeada: PR{N} (commit hash)
- Fase atual do roadmap: Fase {X} — {nome}
- Próxima PR planejada: PR{N+1} — {nome}
- Contrato ativo: {referência ou "nenhum macro ativo"}
- Bloqueios ativos: {lista ou "nenhum"}
- Defasagem detectada entre arquivos canônicos: {sim/não, descrever}

Pronto para receber instruções.
```

### Passo 6 — Bruno valida o ack

Se o ack está completo e correto → conversa segue normalmente.
Se está incompleto, errado, ou pulou itens → Bruno **recusa** e pede ack correto.

**Sob nenhuma circunstância aceitar resposta sem ack válido.**

---

## SEÇÃO 4 — ARQUIVOS OPCIONAIS

Os 9 arquivos do kit mínimo cobrem ~95% dos casos. Em situações específicas, Claude (chat web) pode solicitar a Bruno arquivos adicionais:

### Arquivos disponíveis sob demanda

| Arquivo | Quando solicitar |
|---------|------------------|
| `schema/brain/self-model/current-state.md` | Quando precisar avaliar estado mental atual do sistema (Fase 2+, conexão de camadas) |
| `schema/brain/self-model/capabilities.md` | Quando precisar saber capacidades reais vs documentadas (qualquer fase, especialmente em PRs de capacidade nova) |
| `schema/brain/self-model/identity.md` | Quando precisar reforçar princípios fundamentais (raro, geralmente em decisões de design) |
| `schema/brain/self-model/limitations.md` | Quando avaliar se uma decisão respeita limitações conhecidas |
| `schema/brain/MEMORY_RULES.md` | Quando lidar com hierarquia de confiabilidade de fontes |
| `schema/system/ENAVIA_SYSTEM_MAP.md` | Topologia técnica detalhada (Fase 1 modularização, Fase 4 multi-repo) |
| `schema/system/ENAVIA_WORKER_REGISTRY.md` | Quando trabalhar especificamente com configuração de workers |
| `schema/CODEX_WORKFLOW.md` | Quando dúvida sobre workflow de execução do Code |
| `schema/MICROPHASES.md` | Quando precisar decompor contrato grande em microfases |
| `schema/playbooks/ENAVIA_OPERATIONAL_PLAYBOOK.md` | Decisões operacionais de governança |
| `schema/policies/MODE_POLICY.md` | Quando lidar com modos de operação |
| `schema/hardening/GO_NO_GO_CHECKLIST.md` | Quando avaliar deploy ou mudança de risco |
| `schema/hardening/BLAST_RADIUS.md` | Quando avaliar impacto de mudança |
| `schema/hardening/COST_LIMITS.md` | Quando lidar com custos de operação |
| `schema/hardening/ROLLBACK_POLICY.md` | Quando planejar rollback |
| `schema/skills-runtime/EXECUTION_CONTRACT.md` | Quando trabalhar com skills (Fase 2+) |
| `schema/skills-runtime/APPROVAL_GATES.md` | Quando lidar com gates de aprovação de skills |
| `schema/skills-runtime/SECURITY_MODEL.md` | Decisões de segurança em skills |
| `docs/diagnostico-macro-2026-05-08/` (toda pasta) | Quando precisar do diagnóstico read-only completo |

### Como Claude (chat web) solicita arquivo extra

Modelo de solicitação:

```
Para responder com qualidade preciso ler também {arquivo}.

Roda este comando e cola o output:

```powershell
Get-Content D:\nv-enavia\{caminho-do-arquivo} -Raw
```

Aguardo o conteúdo antes de prosseguir.
```

### Como Bruno responde

Bruno roda o comando e cola o conteúdo no chat. Claude lê e prossegue.

---

## SEÇÃO 5 — COMANDO PARA SOLICITAR MÚLTIPLOS ARQUIVOS DE UMA VEZ

Se Claude precisar de vários arquivos extras, pode solicitar todos de uma vez:

```powershell
cd D:\nv-enavia

$extras = @(
    "schema\brain\self-model\current-state.md",
    "schema\brain\self-model\capabilities.md",
    "schema\system\ENAVIA_SYSTEM_MAP.md"
)

$output = @()
foreach ($f in $extras) {
    $output += "================================================================================"
    $output += "ARQUIVO: $f"
    $output += "================================================================================"
    if (Test-Path $f) {
        $output += Get-Content $f -Raw
    } else {
        $output += "[ARQUIVO NAO ENCONTRADO]"
    }
    $output += ""
    $output += ""
}

$output -join "`n" | Out-File -FilePath "D:\nv-enavia\EXTRAS_LEITURA.txt" -Encoding utf8
Write-Host "Arquivo gerado: D:\nv-enavia\EXTRAS_LEITURA.txt"
```

`EXTRAS_LEITURA.txt` também está coberto pelo `.gitignore` (regra `BLOCO*_LEITURA.txt` ou similar).

---

## SEÇÃO 6 — VALIDAÇÃO DE QUE O KIT ESTÁ ATUALIZADO

Antes de gerar BOOTSTRAP_LEITURA, Bruno pode validar que os 9 arquivos canônicos estão atualizados:

```powershell
cd D:\nv-enavia

$arquivos = @(
    "BOOTSTRAP_SESSAO.md",
    "CLAUDE.md",
    "schema\canonico\PLANO_MACRO_ENAVIA.md",
    "schema\canonico\FLUXO_OPERACIONAL.md",
    "schema\contracts\INDEX.md",
    "schema\contracts\ACTIVE_CONTRACT.md",
    "schema\handoffs\ENAVIA_LATEST_HANDOFF.md",
    "schema\status\ENAVIA_STATUS_ATUAL.md",
    "schema\brain\SYSTEM_AWARENESS.md"
)

Write-Host "===== STATUS DOS 9 ARQUIVOS CANONICOS ====="
foreach ($f in $arquivos) {
    if (Test-Path $f) {
        $item = Get-Item $f
        $size = $item.Length
        $modificado = $item.LastWriteTime.ToString('yyyy-MM-dd HH:mm')
        Write-Host "[OK] $f  ($size bytes, modificado $modificado)"
    } else {
        Write-Host "[FALTA] $f"
    }
}

Write-Host ""
Write-Host "===== ULTIMA PR MERGEADA ====="
git log --oneline -1 main
```

Se algum arquivo estiver `[FALTA]` ou claramente defasado (data antiga), **abrir PR-RECONCILIAÇÃO antes** de gerar o BOOTSTRAP_LEITURA. Senão, a aba nova nasce com contexto enviesado.

---

## SEÇÃO 7 — REGRA DE OURO

> **Os 9 arquivos canônicos são o sistema imune do projeto contra perda de contexto.**
>
> Se eles estão atualizados, qualquer aba nova começa com contexto completo em < 5 minutos.
> Se eles estão defasados, mesmo a aba antiga já está operando às cegas.
>
> Por isso a regra do `FLUXO_OPERACIONAL.md` Seção 4 (atualização obrigatória ao fim de cada PR) é não-negociável.

---

**Fim do CONTEXTO_NOVA_ABA.md v1.0.**
