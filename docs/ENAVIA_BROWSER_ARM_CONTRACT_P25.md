# ENAVIA — Contrato do Braço Browser v1.0 (P25)

> Contrato canônico do braço Browser da Enavia — olhos externos.
> Versão: v1.0
> Data: 2026-04-14
> Status: ATIVO — contrato + enforcement em runtime; binding externo real ainda não implementado nesta PR1
> Implementação: `schema/browser-arm-contract.js`
> Testes (contrato): `tests/browser-arm-contract.smoke.test.js` (140 casos)
> Testes (runtime): `tests/browser-arm-runtime.integration.test.js` (59 casos)
> Fonte soberana: `schema/CONSTITUIÇÃO`
> Contrato superior: `schema/autonomy-contract.js` (P23)

---

## 1. Hierarquia de Fontes

| Nível | Arquivo | Papel |
|-------|---------|-------|
| **SOBERANA** | `schema/CONSTITUIÇÃO` | Princípios macro, ordem obrigatória |
| **INTERMEDIÁRIA** | `schema/autonomy-contract.js` | Contrato de autonomia P23 — base de governança |
| **SUBORDINADA** | `schema/browser-arm-contract.js` | Contrato do braço Browser — ESTE ARQUIVO |

Em caso de ambiguidade: CONSTITUIÇÃO > P23 > P25.

---

## 2. Divisão Operacional

| Domínio | Responsável |
|---------|-------------|
| Workers / Cloudflare / service binding / runtime / deploy worker | **Executor nativo** (separado) |
| Branch / PR / repo / review / correção / parecer / approval merge | **Braço GitHub/PR** (P24) |
| Navegação / pesquisa / operação visual / validação externa | **Braço Browser** (P25 — ESTE) |

Estas responsabilidades **não se misturam**.

---

## 3. Função do Braço

O Browser Arm é o braço externo da Enavia para:

- **Olhos externos** — enxergar fora do ambiente interno da Enavia
- **Pesquisa externa** — buscar informações, ferramentas, novidades
- **Navegação e operação visual/web** — abrir páginas, clicar, preencher, ler
- **Teste e validação de fluxos externos** — testar ferramentas e serviços
- **Exploração de ferramentas úteis** — descobrir o que pode melhorar a Enavia
- **Fonte de evolução/sugestões** — sugerir melhorias ao usuário

---

## 4. Rota/Base Externa Canônica

| Campo | Valor |
|-------|-------|
| Host | `run.nv-imoveis.com` |
| Pattern | `run.nv-imoveis.com/*` |
| Protocol | `https` |
| Base URL | `https://run.nv-imoveis.com` |
| Var em wrangler.toml | `BROWSER_EXECUTOR_URL` |

---

## 5. Ações Permitidas

| Ação | Descrição |
|------|-----------|
| `open_page` | Abrir página |
| `navigate` | Navegar |
| `click` | Clicar |
| `fill_form` | Preencher formulário |
| `login` | Fazer login |
| `read_visual_result` | Ler resultado visual/textual |
| `search` | Pesquisar |
| `test_external_tool` | Testar ferramenta externa |
| `use_saved_credentials` | Usar credenciais salvas |

Todas são **autônomas** dentro do escopo aprovado.

---

## 6. Ações Condicionadas

| Ação | Condição | Descrição |
|------|----------|-----------|
| `upload` | Objetivo vigente exige | Upload quando necessário ao objetivo |
| `publish` | Objetivo vigente exige | Publicação subordinada ao objetivo/contrato |
| `delete` | Justificativa obrigatória | Exclusão só com justificativa restrita |
| `expand_scope` | Permissão do usuário | Expansão de escopo exige sugestão + permissão |

---

## 7. Ações Proibidas Incondicionalmente

| Ação | Descrição |
|------|-----------|
| `exit_scope` | Sair do escopo |
| `regress_contract` | Retroceder contrato |
| `regress_plan` | Retroceder plano |
| `regress_task` | Retroceder tarefa |
| `generate_drift` | Gerar drift |
| `act_outside_scope` | Agir fora do escopo |
| `deviate_contract_without_escalation` | Desviar contrato sem escalar |
| `mix_cloudflare_executor_with_browser_arm` | Misturar executor Cloudflare com browser |
| `mix_github_arm_with_browser_arm` | Misturar braço GitHub com browser |
| `expand_scope_without_permission` | Expandir escopo sem permissão |
| `auto_expand_scope` | Auto-expandir escopo |
| `ignore_cost_limits` | Ignorar limites de custo |
| `delete_without_justification` | Deletar sem justificativa |

---

## 8. Obrigações

1. **Nunca sair do escopo** sem escalar ao usuário
2. **Sempre pedir permissão** quando encontrar oportunidade fora do escopo
3. **Sempre sugerir** melhoria/evolução/ferramenta útil
4. **Sempre descrever** descobertas com contexto completo:
   - O que encontrou
   - Por que ajuda
   - O que falta para usar
   - Impacto esperado
   - Se precisa permissão
5. **Respeitar limites de custo** para rotinas recorrentes

---

## 9. Estrutura de Sugestão

Quando o browser encontra algo interessante, deve gerar sugestão com:

| Campo | Descrição |
|-------|-----------|
| `type` | Tipo: tool, integration, capability, insight, optimization, security_improvement |
| `discovery` | O que foi encontrado |
| `benefit` | Por que ajuda |
| `missing_requirement` | O que falta para usar (acesso, config, permissão) |
| `expected_impact` | Impacto esperado |
| `permission_needed` | Se precisa permissão do usuário (boolean) |

Regras:
- **Sempre sugere** — nunca ignora descoberta útil
- **Sempre pede permissão** — nunca assume expansão de escopo sozinho
- Validação via `validateSuggestion()` garante campos obrigatórios

---

## 10. Estrutura de Rotina de Pesquisa/Evolução

Base para rotina recorrente controlável (sem automação pesada nesta PR):

| Campo | Descrição |
|-------|-----------|
| `routine_id` | Identificador da rotina |
| `objective` | Objetivo da pesquisa |
| `frequency` | on_demand, daily, weekly, monthly |
| `cost_limit` | Limite de custo/uso por execução |
| `active` | Se a rotina está ativa (default: false) |

---

## 11. Enforcement em Runtime

### Ponto único: `enforceBrowserArm()`

`enforceBrowserArm()` é chamado antes de qualquer ação sensível do braço Browser.
Combina classificação + escopo + drift + regressão + P23 compliance + ação condicionada.

**Resultado sempre auditável:**
```
{ allowed, blocked, arm_id, action, level, reason, classification, p23_compliance, conditional_check, suggestion_required }
```

### O que valida

| Verificação | Descrição |
|-------------|-----------|
| Pertencimento | Se a ação pertence ao braço Browser |
| Escopo | Escopo aprovado |
| Drift | Ausência de drift |
| Regressão | Ausência de regressão |
| P23 | Conformidade com contrato de autonomia (gates obrigatórios) |
| Condicional | Justificativa/permissão para ações condicionadas |
| Sugestão | `suggestion_required` quando ação fora do escopo → deve sugerir + pedir permissão |

### Se violar

- Bloqueia
- Explica o motivo (reason auditável)
- Não age
- Se fora do escopo: sinaliza `suggestion_required = true`

### Onde está no runtime

- **`contract-executor.js` → `executeBrowserArmAction()`** — ponto de entrada runtime
- **`contract-executor.js` → `handleBrowserArmAction()`** — route handler
- **`contract-executor.js` → `getBrowserArmState()`** — estado canônico do braço
- **`nv-enavia.js` → `POST /browser-arm/action`** — rota HTTP do braço Browser
- **`nv-enavia.js` → `GET /browser-arm/state`** — rota HTTP de estado

Separado do executor Cloudflare (`executeCurrentMicroPr`) e do braço GitHub (`executeGitHubPrAction`).

---

## 12. Runtime Functions

| Função | Descrição |
|--------|-----------|
| `executeBrowserArmAction({...})` | Runtime: executa ação com enforcement P25 |
| `handleBrowserArmAction(req)` | Route handler: `POST /browser-arm/action` |
| `getBrowserArmState()` | Retorna estado canônico do braço |

---

## 13. Funções Públicas (Contrato)

| Função | Descrição |
|--------|-----------|
| `classifyBrowserArmAction(action)` | Classifica ação no contexto do braço Browser |
| `validateConditionalAction({...})` | Valida ação condicionada (justificativa/permissão) |
| `validateSuggestion(suggestion)` | Valida estrutura de sugestão |
| **`enforceBrowserArm({...})`** | **Ponto único de enforcement em runtime do P25** |

---

## 14. Arquivo Canônico

- **Schema:** `schema/browser-arm-contract.js`
- **Runtime:** `contract-executor.js` → `executeBrowserArmAction()`, `handleBrowserArmAction()`, `getBrowserArmState()`
- **Rotas:** `nv-enavia.js` → `POST /browser-arm/action`, `GET /browser-arm/state`
- **Testes (contrato):** `tests/browser-arm-contract.smoke.test.js` (140 casos)
- **Testes (runtime):** `tests/browser-arm-runtime.integration.test.js` (59 casos)
- **Docs:** `docs/ENAVIA_BROWSER_ARM_CONTRACT_P25.md` (este arquivo)
- **Fonte soberana:** `schema/CONSTITUIÇÃO`
- **Contrato superior:** `schema/autonomy-contract.js` (P23)

---

## 15. O que está VIVO nesta PR1

| Componente | Status |
|------------|--------|
| Contrato canônico P25 (`schema/browser-arm-contract.js`) | ✅ Ativo |
| Enforcement em runtime (`enforceBrowserArm()`) | ✅ Ativo |
| Runtime functions (`executeBrowserArmAction`, `handleBrowserArmAction`, `getBrowserArmState`) | ✅ Ativo |
| Rotas HTTP (`POST /browser-arm/action`, `GET /browser-arm/state`) | ✅ Ativo |
| Mapeamento canônico de `run.nv-imoveis.com/*` | ✅ Mapeado |
| Handler exige `scope_approved` + `gates_context` explícitos | ✅ Sem defaults permissivos |

## 16. O que NÃO está vivo nesta PR1

| Componente | Status |
|------------|--------|
| Binding operacional real com browser externo (`run.nv-imoveis.com`) | ❌ Ainda não implementado |
| Execução real de navegação/browser | ❌ Ainda não implementado |
| Persistência de estado do braço em KV | ❌ Ainda não implementado |
| Automação de rotina de pesquisa/evolução | ❌ Ainda não implementado |
| UX/painel do browser | ❌ Ainda não implementado |

O mapeamento de `run.nv-imoveis.com/*` é **canônico** nesta etapa: a rota/base está definida e referenciada, mas o binding operacional completo com o browser executor físico externo será implementado em PRs futuras.

---

## 17. O que NÃO está neste contrato

- Executor Cloudflare (Workers/runtime/deploy)
- GitHub/PR arm (P24)
- Deploy/test como braço (P26)
- LLM / embeddings
- Persistência / I/O direto
- Implementação completa do browser
- UX/painel do browser
- Automação pesada de pesquisa/evolução

---

## 18. Prova de Não-Regressão

Todos os testes existentes passaram após a adição do P25:

| Arquivo de teste | Resultado |
|-----------------|-----------|
| `browser-arm-contract.smoke.test.js` | 140 passed, 0 failed |
| `browser-arm-runtime.integration.test.js` | 59 passed, 0 failed |
| `autonomy-contract.smoke.test.js` | 119 passed, 0 failed |
| `github-pr-arm-contract.smoke.test.js` | 153 passed, 0 failed |
| `github-pr-arm-runtime.integration.test.js` | 88 passed, 0 failed |
| `contracts-smoke.test.js` | 1187 passed, 0 failed |
| `contract-adherence-gate.smoke.test.js` | 68 passed, 0 failed |
| `contract-final-audit.smoke.test.js` | 146 passed, 0 failed |
| `execution-audit.smoke.test.js` | 142 passed, 0 failed |
| `pipeline-end-to-end.integration.test.js` | 52 passed, 0 failed |
