# DIAGNÓSTICO — PR107: Self-patch supervisionado

**Data:** 2026-05-04  
**Tipo:** PR-DIAG (read-only)  
**Contrato ativo:** a definir (PR107 requer novo contrato antes de PR-IMPL)  
**Base:** código real lido de `executor/src/index.js` (7827 linhas) e `schema/enavia-self-worker-auditor-skill.js`

---

## 1. ESTADO ATUAL DO EXECUTOR — Endpoints reais e capacidades

### Endpoints existentes

| Endpoint | Método | O que faz de fato |
|----------|--------|-------------------|
| `/__internal__/deploy-apply` | POST | Retorna ACK estático — **não aplica nada**. É uma resposta de confirmação apenas. |
| `/__internal__/describe` | GET | Retorna metadata do Worker (name, env, version). `canRollback: false` hardcoded. |
| `/` | POST | Roteador raiz — delega para `enaviaExecutorCore` se tiver `action`/`executor_action`. |
| `/audit` | POST | Executa `runAuditMode`: lê snapshot do executor do KV (`git:code:latest`), opcionalmente lê código do Worker-alvo via Cloudflare API (requer `CF_ACCOUNT_ID` + `CF_API_TOKEN`). Gera `findings[]` e `suggestions[]`. **Não modifica nada.** |
| `/propose` | POST | Proposta de patch. Com `require_live_read=true` lê código do Worker via CF API. Com `use_codex=true` chama OpenAI `gpt-4.1-mini` para gerar `patch_text`. Retorna sugestões — **nunca aplica automaticamente.** |
| `/engineer` / `/engineer-core` | GET/POST | Motor de engenharia. Lê snapshot, gera patches sugeridos. Mesma lógica de `/propose`. |
| `/module-get` `/module-list` | GET | Leitura de módulos no KV (`ENAVIA_GIT`). Read-only. |
| `/module-save` `/module-patch` | POST | Salva/patcha conteúdo de módulo no KV. Não faz deploy. |
| `/module-validate` | POST | Valida sintaxe de código JS. Retorna `syntaxOk`, `riskLevel`, `protectedHits`. |
| `/module-diff` | POST | Calcula diff textual entre dois conteúdos. |
| `/worker-patch-safe` (mode=stage) | POST | Valida candidato via `/module-validate`, salva `WORKER_BACKUP:{id}:{ts}` e `WORKER_CANDIDATE:{id}:{ts}` no KV. **Não faz deploy.** |
| `/worker-deploy` | POST | Delega para `DEPLOY_WORKER_URL` se configurado. Sem deploy-worker: retorna **501** explícito. Executor não executa deploy real sozinho. |
| `/audit-log` | GET | Lê eventos de auditoria do KV (`ENAVIA_GIT:audit:{ts}:{type}`). |
| `/health` `/boundary` `/status` | GET | Informação operacional. Read-only. |
| `/versions` `/version` `/diff` | GET | Histórico de snapshots do código no KV. |
| `/apply-patch` `/apply-exec` | POST | Aplicam patch em staging (KV). **Não fazem deploy real.** |
| `/rollback` | POST | Recomendação de rollback — **não executa rollback real** sem deploy-worker. |
| `/deploy` | POST | Delega para deploy-worker. Sem deploy-worker: bloqueado. |
| `/browser-proof` | POST | Registra prova de browser (`DEPLOY_OK:{hash}`) no KV para `await_proof`. |

### `enaviaExecutorCore` — actions dispatch

| Action | O que faz |
|--------|-----------|
| `smart_deploy` | Cria plano de execução (`handleSmartDeployPlan`) com steps: audit/propose/apply_test/await_proof/deploy_test/finalize. Grava em `EXECUTION:{id}` no KV. |
| `deploy_execute_plan` | Executa o próximo passo do plano: `audit` e `propose` recursivamente chamam `enaviaExecutorCore`; `apply_test` faz POST no deploy-worker; `deploy_test` é **simulado** (`real_deploy: false`); `finalize` é **lógico** (sem side effects). |
| `worker_read` | Lê Worker via service binding `ENAVIA_WORKER_TEST`. Só funciona se o binding estiver configurado. |
| `audit` | Alias de `runAuditMode`. |
| `ping` | Noop. |

### `callCodexEngine` — integração OpenAI real

Existe e funciona quando `OPENAI_API_KEY` ou `CODEX_API_KEY` está configurado:

1. Recebe até 16.000 chars do `workerCode` + até 4.000 chars de `intentText`
2. Chama `POST https://api.openai.com/v1/chat/completions` com `gpt-4.1-mini`
3. Retorna `patches[]` com `{ title, description, anchor: { match }, patch_text, reason }`
4. Os patches são **sugestões de texto** — não são aplicados nem validados sintaticamente

### `fetchCurrentWorkerSnapshot` — leitura real do código via CF API

Existe e funciona quando `CF_ACCOUNT_ID` e `CF_API_TOKEN` estão configurados:

```
GET https://api.cloudflare.com/client/v4/accounts/{accountId}/workers/scripts/{scriptName}
```

Retorna o código JS do Worker deployado com etag e last-modified. O executor usa essa função em `/audit` e `/propose` quando `require_live_read=true` ou `workerId` está presente.

---

## 2. O QUE O SELF_WORKER_AUDITOR JÁ CONSEGUE FAZER HOJE

`schema/enavia-self-worker-auditor-skill.js` — helper puro (PR82)

### O que faz de fato

- Retorna um diagnóstico **estático e hardcoded** baseado no estado do repo até PR81
- 10 achados em 6 categorias (S1/S2: security, T1/T2: telemetry, D1/D2: deploy_loop, C1/C2: chat_rigidity, G1/G2: governance)
- Requer `proposal_status === "approved"` para executar (gate de aprovação humana)
- `executed: false`, `side_effects: false` — 100% read-only

### O que NÃO faz

- **Não lê o código em tempo real** — diagnóstico é baseado em snapshot de PR81. As mudanças de PR82–PR106 não aparecem nos achados.
- **Não está conectado ao Executor** — é um helper puro em `schema/`. Não existe rota nem handler no Worker ou no Executor que chame `buildSelfWorkerAuditorResult()` para diagnosticar o estado atual.
- **Não gera patches** — retorna só texto descritivo de recomendações como `priority_actions[]`.
- **Não tem integração com GitHub Bridge** — nenhuma referência a `create_branch`, `create_commit`, `open_pr`.

### Relação com o Executor

O Executor tem seu próprio modo de auditoria (`runAuditMode` em `/audit`) que lê o código do KV (`git:code:latest`) e opcionalmente via CF API. **Esses dois sistemas são independentes e não se comunicam.** O `SELF_WORKER_AUDITOR` de `schema/` nunca é chamado pelo Executor.

---

## 3. O QUE FALTA PARA FECHAR O CICLO: auditar → propor patch → criar branch → commitar → abrir PR

### Mapa do estado atual

```
EXECUTOR (/audit + /propose + callCodexEngine)
  ├── Lê código do Worker via CF API  ✅ EXISTE (requer CF_ACCOUNT_ID + CF_API_TOKEN)
  ├── Gera patch_text via OpenAI       ✅ EXISTE (requer OPENAI_API_KEY)
  ├── Valida sintaxe do patch          ✅ EXISTE (/module-validate)
  └── Faz commit/branch/PR no GitHub  ❌ NÃO EXISTE

WORKER (nv-enavia.js / enavia-github-adapter.js)
  ├── create_branch via GitHub API     ✅ EXISTE (PR106)
  ├── create_commit via GitHub API     ✅ EXISTE (PR106)
  ├── open_pr via GitHub API           ✅ EXISTE (PR106)
  └── Lê código próprio para proposta  ❌ NÃO EXISTE

ORQUESTRADOR (conecta os dois sistemas)
  └── INEXISTENTE                      ❌ NÃO EXISTE
```

### Gaps específicos

#### Gap A — O Executor não tem acesso ao GITHUB_TOKEN

O `GITHUB_TOKEN` é um secret do Worker (`nv-enavia.js`) configurado via `wrangler secret put GITHUB_TOKEN`. O Executor (`enavia-executor`) não tem esse secret no `wrangler.toml` e não há nenhuma referência a `GITHUB_TOKEN` em `executor/src/index.js`. 

**Consequência:** O Executor não consegue chamar diretamente `create_branch`, `create_commit`, `open_pr` do GitHub Bridge — não tem o token.

#### Gap B — O Executor não tem endpoints de GitHub Bridge

O Executor tem endpoints para audit/propose/apply/deploy. Não tem `create_branch`, `create_commit`, `open_pr`. Para criar branch e commitar, precisaria ou:
- Chamar o Worker (`nv-enavia.js`) via service binding (`POST /github-bridge/execute`)
- Ou ter o `GITHUB_TOKEN` e chamar a CF API diretamente

Nenhum dos dois existe no Executor hoje.

#### Gap C — O Worker não tem capacidade de propor patches

O Worker (`nv-enavia.js`) tem o GitHub Bridge mas não tem:
- `callCodexEngine` — isso está no Executor
- `fetchCurrentWorkerCode` — está no Executor
- Nenhuma rota que leia o próprio código e proponha mudança

#### Gap D — Não existe orquestrador do ciclo completo

O ciclo self-patch exige:
```
1. Ler código atual do Worker (CF API ou KV)
2. Gerar patch via LLM (Codex)
3. Validar sintaxe do patch
4. Criar branch no GitHub
5. Commitar patch na branch
6. Abrir PR com merge_allowed=false
7. Aguardar aprovação humana
```

Passos 1–3 existem no **Executor**. Passos 4–6 existem no **Worker** (via GitHub Bridge). Passo 7 é o gate humano (já existe como invariante).

Não existe um componente que una os dois lados. É necessário criar uma rota nova — provavelmente no Worker — que:
- Chame o Executor para obter o patch proposto (ou contenha a lógica de proposta diretamente)
- Use o GitHub Bridge para criar branch + commit + PR

#### Gap E — O `patch_text` do Executor é texto livre, não diff aplicável

O `callCodexEngine` retorna `patch_text` como string de texto livre (ex: "substitua a linha X por Y"). Não é um `diff` unificado nem um bloco de substituição aplicável mecanicamente. Para commitar, alguém precisa:
1. Ler o arquivo alvo no GitHub (`GET /contents/{path}`)
2. Aplicar o `patch_text` (como? string replace? regex? manual?)
3. Escrever o resultado no `create_commit`

A lógica de aplicação de `patch_text` não existe em nenhum dos dois sistemas.

#### Gap F — O arquivo a ser commitado precisa ser determinado

O `create_commit` do PR106 commita **um único arquivo** (`file_path`, `content`). Para um self-patch de `nv-enavia.js` (que tem 9000+ linhas), o patch precisa:
- Determinar qual arquivo alterar
- Aplicar o patch nesse arquivo
- O resultado inteiro do arquivo vai como `content` do commit

Isso requer que o Worker leia o arquivo atual via `GET /repos/{owner}/{repo}/contents/{path}` (já existe em `_executeCreateCommit`) e aplique o patch antes de escrever.

---

## 4. RISCOS REAIS DE SELF-PATCH

### Risco 1 — O LLM propõe patches incorretos em código que não leu completamente

`callCodexEngine` trunca o código do Worker em **16.000 chars**. `nv-enavia.js` tem **~320.000 chars** (9000+ linhas). O modelo recebe menos de 5% do código. Qualquer patch gerado pode:
- Referenciar funções ou variáveis que não existem no trecho visto
- Criar conflitos com código que está fora da janela
- Propor âncoras (`anchor.match`) que aparecem múltiplas vezes no arquivo

**Não há como detectar isso automaticamente antes do commit.**

### Risco 2 — Sem validação sintática do arquivo resultante antes do commit

O `create_commit` do GitHub Bridge recebe `content` (base64 do arquivo completo) e commita diretamente. Não há `node --check` nem nenhuma validação antes do commit. Se o patch gerar JS inválido, o commit vai para o GitHub com código quebrado. A PR ficará com código quebrado e o CI/CD pode falhar ou não existir.

**Mitigação necessária:** Validar com `/module-validate` no Executor antes de commitar.

### Risco 3 — O código deployado no Cloudflare ≠ código no repositório

`fetchCurrentWorkerCode` lê o código **deployado** via CF API. O repositório pode ter commits mais recentes não deployados. Se o self-patch for baseado no código deployado e não no código do repo, o patch pode:
- Conflitar com mudanças recentes no repositório
- Criar diff que não tem sentido com o HEAD do repo

**Não há sincronização entre CF deployed e GitHub HEAD.**

### Risco 4 — Self-modifying code pode burlar guardrails

O sistema propõe um patch no próprio código. Se o patch alterar as funções de Safety Guard, ALWAYS_BLOCKED, ou os gates de `merge_allowed`, o Executor provavelmente não vai detectar isso — ele não audita o conteúdo semântico do patch, apenas a sintaxe JS.

O `SELF_WORKER_AUDITOR` atual é estático e não detectaria uma regressão de segurança no patch. O `/module-validate` verifica `protectedHits` (busca strings como `"merge"`, `"secret"`) mas essa heurística é superficial.

**Risco crítico:** Um patch mal gerado poderia remover ou enfraquecer um guardrail, e a PR poderia ser aprovada por um revisor que não percebeu a mudança no meio de um diff grande.

### Risco 5 — O token GITHUB_TOKEN identifica um humano nos commits

Os commits criados via `create_commit` do GitHub Bridge vão aparecer como feitos pelo usuário dono do `GITHUB_TOKEN`. O histórico do repo não vai indicar que foi gerado por LLM. Isso pode confundir o revisor sobre a autoria real do patch.

**Mitigação:** Usar mensagem de commit explícita com `[SELF-PATCH]` e co-authorship, como já é feito nas PRs atuais.

### Risco 6 — Limpeza falha deixa branches/PRs abertas

O ciclo de prova real do PR106 inclui limpeza (fechar PR + deletar branch). Um self-patch que falha na etapa de abertura de PR pode deixar uma branch orfã no repositório. Se o Executor não tem garantia de limpeza em caso de falha parcial, o repositório vai acumular branches de teste.

### Risco 7 — O ciclo completo requer 5+ credenciais configuradas corretamente

Para o self-patch funcionar end-to-end:
- `CF_ACCOUNT_ID` + `CF_API_TOKEN` (Executor — para ler código deployado)
- `OPENAI_API_KEY` (Executor — para gerar patch)
- `GITHUB_TOKEN` (Worker — para criar branch/commit/PR)
- Service binding Executor ↔ Worker (ou endpoint HTTP entre eles)

Se qualquer uma dessas credenciais estiver ausente ou inválida, o ciclo falha em um ponto diferente. Não existe fallback nem mensagem de erro unificada que cubra todos os casos de falha.

---

## 5. SÍNTESE — O QUE PRECISA ACONTECER NA PR107

### O que já existe e pode ser reutilizado

| Componente | Estado |
|------------|--------|
| Leitura do Worker via CF API (`fetchCurrentWorkerSnapshot`) | ✅ Executor |
| Geração de patch via OpenAI (`callCodexEngine`) | ✅ Executor |
| Validação sintática (`/module-validate`) | ✅ Executor |
| `create_branch` com SHA dinâmico | ✅ Worker (PR106) |
| `create_commit` com base64 | ✅ Worker (PR106) |
| `open_pr` com `merge_allowed=false` | ✅ Worker (PR106) |
| Gate humano antes do merge | ✅ Invariante do PR106 |
| Event Log + Safety Guard | ✅ PR99/PR100 |

### O que precisa ser construído (scope mínimo da PR107)

1. **Uma rota nova no Worker** — `POST /self-patch/propose` — que:
   - Leia o arquivo-alvo no GitHub via `GET /contents/{path}` (não via CF API — assim o código é o do repo, não o deployado)
   - Repasse o conteúdo para o Executor via service binding ou HTTP (`/propose` com `use_codex=true`)
   - Receba o `patch_text` gerado
   - Aplique o patch no conteúdo original (lógica de substituição baseada no `anchor.match`)
   - Valide a sintaxe do resultado
   - Se válido: retorne o patch proposto para aprovação humana
   - Se inválido: retorne erro — nenhum commit

2. **Uma rota nova no Worker** — `POST /self-patch/execute` — que:
   - Receba o patch aprovado (branch_name, file_path, conteúdo patchado, mensagem de commit)
   - Chame `create_branch` → `create_commit` → `open_pr` via o GitHub Bridge existente
   - Retorne os dados da PR criada para que o humano possa aprovar o merge

3. **Lógica de aplicação de `patch_text`** — substituição baseada em âncora (`anchor.match`) aplicada no texto do arquivo original. Sem isso, o `patch_text` do Codex é inutilizável mecanicamente.

### Recomendação de sequência

```
PR107-DIAG: este diagnóstico ✅
PR108: contrato formal da PR107 (defines interfaces, constraints, invariantes)
PR109-IMPL: /self-patch/propose (leitura + proposta + validação sintática)
PR110-PROVA: prova da proposta sem commit real
PR111-IMPL: /self-patch/execute (branch + commit + PR via GitHub Bridge)
PR112-PROVA: prova real com GITHUB_TOKEN + CF credenciais
```

**Nenhuma implementação de self-patch pode acontecer sem PR-DIAG + contrato aprovado por Bruno primeiro.**

---

## 6. VEREDITO

```
PR107 BLOQUEADA PARA IMPL — REQUER CONTRATO FORMAL ANTES
```

O ciclo self-patch depende de dois sistemas (Executor e Worker) que hoje não se comunicam. Montar a ponte sem um contrato claro de interfaces, invariantes e rollback criaria exatamente o tipo de acoplamento ad-hoc que os contratos anteriores foram criados para evitar.

**O que deve acontecer a seguir:**
1. Bruno aprova e faz merge da PR #272 (PR106)
2. Um novo contrato é escrito (PR107-DOCS) definindo:
   - Qual sistema é responsável pela leitura do código (Worker via GitHub API recomendado — evita dependência do código deployado)
   - Qual sistema é responsável pela geração do patch (Executor via callCodexEngine)
   - Como os dois se comunicam (service binding ou HTTP)
   - Quais invariantes garantem que o patch nunca seja aplicado sem aprovação humana explícita
   - Critérios de conclusão: prova real com 24/24 testes antes de qualquer merge de self-patch
3. Apenas após o contrato aprovado, iniciar PR-IMPL
