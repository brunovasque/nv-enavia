# CODEX WORKFLOW — NV-ENAVIA (INICIAL)

> Workflow inicial do repositório **nv-enavia**.
> Este arquivo existe para destravar o trabalho do Codex/Agents enquanto o repositório ainda não possui os schemas auxiliares da Enova.
> Portanto, **este documento é a fonte única de verdade por enquanto**.

## HEADER FIXO (colar antes de qualquer tarefa)

Leia `schema/CODEX_WORKFLOW.md` e siga como regra absoluta.
Confirme que leu e diga exatamente:

`WORKFLOW_ACK: ok`

Se este arquivo não existir, pare e avise.
Se existir, prossiga normalmente **sem exigir outros schemas**.

---

## REGRA CENTRAL

Enquanto o repositório `nv-enavia` ainda não tiver contratos auxiliares próprios, é **proibido bloquear a execução** por ausência de arquivos como:

- `CANONICO_GATE_PRESERVATION.md`
- `SUPABASE_CHANGE_GUARD.md`
- contratos cognitivos
- diagnósticos shadow
- qualquer outro schema herdado da Enova

Esses arquivos poderão ser criados depois.
**Por agora, o único obrigatório é este workflow.**

---

## ESCOPO E DISCIPLINA

- 1 tarefa = 1 PR = 1 branch até terminar.
- Se já existir PR aberta para o mesmo assunto, reutilizar o **mesmo branch**.
- Todo follow-up deve gerar **novo commit no mesmo branch**.
- Nunca misturar escopos no mesmo PR.
- Separar por frente:
  - Worker-only
  - Panel-only
  - Workflows-only
  - Docs-only
- Sem commit hash = considerar **não feito**.
- Se não conseguir commitar/push, declarar explicitamente.

---

## PROCESSO PADRÃO

### Fase 1 — Diagnóstico (READ-ONLY)

Obrigatório antes de qualquer mudança:

1. Identificar exatamente os arquivos e âncoras.
2. Explicar a causa do problema com objetividade.
3. Propor patch mínimo.
4. Listar smoke tests objetivos.
5. Declarar impacto:
   - arquivos tocados
   - variáveis/segredos relevantes
   - rotas/endpoints afetados
   - bindings afetados
   - tabelas/colunas lidas e escritas, se houver persistência
6. Parar e aguardar aprovação explícita do usuário.

### Fase 2 — Implementação (após OK)

1. Aplicar patch cirúrgico.
2. Não refatorar fora do necessário.
3. Não renomear por estética.
4. Não mover blocos funcionais sem necessidade comprovada.
5. Fazer commit real no mesmo branch/PR.
6. Rodar smoke tests.
7. Entregar report final.

---

## PATCH SAFETY GUARD

É proibido:

- refatorar sem necessidade comprovada;
- alterar comportamento de algo funcional sem prova de causa;
- misturar correção com melhoria opcional no mesmo PR;
- criar abstrações “bonitas” que aumentem risco;
- trocar contratos de API sem declarar impacto;
- inventar persistência improvisada.

Toda correção deve seguir:

`diagnóstico -> prova da causa -> patch mínimo -> smoke test -> report final`

---

## PERSISTÊNCIA / DADOS

Se a tarefa tocar persistência, antes de implementar o agente deve listar:

- tabelas lidas;
- colunas lidas;
- tabelas escritas;
- colunas escritas;
- se haverá criação nova de tabela/coluna;
- se existe ação manual necessária.

Se não souber responder com segurança, deve parar no READ-ONLY.

Não mexer em coluna/tabela só porque existe.
Confirmar antes se é campo **vivo** no fluxo atual.

---

## DEPLOY / TESTE

Padrão obrigatório:

1. Diagnóstico read-only primeiro.
2. Patch cirúrgico por PR.
3. Validar em TEST quando aplicável.
4. Rodar smoke tests para garantir que o que já funciona não quebrou.
5. Se quebrar, parar e reportar rollback.
6. Só depois considerar promoção para PROD.

---

## FORMATO OBRIGATÓRIO DE RESPOSTA DO AGENTE

### No diagnóstico

- `WORKFLOW_ACK: ok`
- Resumo do problema
- Arquivos/âncoras
- Causa provável
- Plano de patch mínimo
- Smoke tests
- Impacto em dados/bindings/endpoints
- Status: aguardando OK para implementar

### Na implementação

- `WORKFLOW_ACK: ok`
- PR #
- Branch
- Commit hash
- Arquivos alterados
- Resumo do diff
- Smoke tests executados + resultado
- Rollback
- Impacto em dados/bindings/endpoints
- Houve ação manual necessária: sim/não

---

## PROMPT CANÔNICO — INÍCIO

Cole isso no começo de qualquer tarefa do Codex/Agent:

```md
Leia e siga estritamente `schema/CODEX_WORKFLOW.md`.
Se não conseguir acessar/ler esse arquivo, pare e me avise.
Trabalhe sempre no MESMO branch/PR existente e faça commit de cada alteração.
Inclua explicitamente a etapa de `git push` para o mesmo branch/PR.
Responda no formato:
WORKFLOW_ACK: ok
Summary
PR/Branch/Commit/Rollback
Smoke tests
Provas
```

---

## PROMPT CANÔNICO — DIAGNÓSTICO → IMPLEMENTAÇÃO

```md
[CODEX_WORKFLOW_NV_ENAVIA]
Você está trabalhando no repositório nv-enavia.

Objetivo
<descreva a tarefa em 1–3 linhas>

Escopo obrigatório
Este PR é APENAS: <Worker-only OU Panel-only OU Workflows-only OU Docs-only>.
Proibido editar qualquer coisa fora desse escopo.

Fase 1 — DIAGNÓSTICO READ-ONLY
1. Identifique arquivos e âncoras exatas.
2. Explique a causa do problema.
3. Liste o patch mínimo.
4. Liste smoke tests.
5. Liste impactos em endpoints, bindings, secrets e persistência.
6. Pare e aguarde: "OK, pode implementar".

Fase 2 — IMPLEMENTAÇÃO
1. Faça patch cirúrgico.
2. Use a mesma PR/branch.
3. Faça commit real.
4. Faça push no mesmo branch.
5. Rode smoke tests.
6. Entregue report final com PR, branch, commit, diff, testes e rollback.

Proibições
- não refatorar fora do necessário
- não inventar estruturas paralelas
- não misturar escopos
- não dizer que fez sem commit hash
```

---

## OBSERVAÇÃO FINAL

Quando novos contratos auxiliares do `nv-enavia` forem criados, este workflow pode ser expandido para referenciá-los.
Até lá, o agente deve operar normalmente usando **apenas este arquivo** como regra principal.
