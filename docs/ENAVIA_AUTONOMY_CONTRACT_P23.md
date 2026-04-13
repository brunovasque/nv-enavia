# ENAVIA — Contrato de Autonomia v1 (P23)

> Contrato canônico de autonomia da Enavia — Frente 6: Autonomia e Braços Especialistas.
> Versão: v1.1
> Data: 2026-04-13
> Status: ATIVO
> Implementação: `schema/autonomy-contract.js`
> Testes: `tests/autonomy-contract.smoke.test.js` (82 casos, 36 cenários)

---

## 1. Propósito

Este documento define o **contrato-base de autonomia** da Enavia para as frentes P24/P25/P26.
Ele determina:

1. O que a Enavia pode fazer sozinha
2. O que exige OK humano explícito
3. O que é proibido incondicionalmente
4. Quais gates precisam ser validados antes de ação sensível
5. Como os futuros braços especialistas deverão obedecer este contrato

**Este contrato NÃO implementa braços especialistas.** Ele é a base canônica que P24/P25/P26 devem obedecer.

---

## 2. Decisões Fechadas pelo Usuário

| # | Decisão |
|---|---------|
| 1 | Após definição do plano/contrato/tarefa, a Enavia só inicia execução com OK humano explícito |
| 2 | Após início, ela pode e deve entrar em loop até finalizar o objetivo |
| 3 | Em TEST, tem autonomia total (inclusive serviços externos) dentro do escopo aprovado |
| 4 | Em serviços não definidos, deve declarar o que precisa; com OK humano, pode seguir |
| 5 | Nunca pode promover para PROD sem autorização explícita |
| 6 | Nunca pode sair do escopo |
| 7 | Proibido regredir contrato/plano/tarefa |
| 8 | Proibido mexer na observabilidade |
| 9 | OK humano é só o inicial; microetapas seguem por memória/loop |
| 10 | Risco alto deve ser medido e informado antes |
| 11 | Conflito de escopo deve ser detectado antes de execução |
| 12 | Falha repetida: 2–3 retries, depois escalar ao usuário |
| 13 | Dúvida de ambiente não deve existir em runtime |
| 14 | Evidência insuficiente para promover → tentar gerar; se não, escalar |

---

## 3. A1 — Ações de Pré-Execução (antes do OK humano inicial)

Ações que a Enavia pode fazer **sem nenhum OK humano**. São leitura, diagnóstico, classificação, planejamento e preparação. Não iniciam execução.

| Ação | Descrição |
|------|-----------|
| `read` | Leitura |
| `read_only_diagnostic` | Diagnóstico read-only |
| `classify` | Classificação |
| `build_plan` | Montagem de plano |
| `query_memory` | Consulta de memória |
| `query_health` | Consulta de health |
| `query_execution_state` | Consulta de estado de execução |
| `prepare_payload` | Preparação de payloads |

---

## 4. A2 — Ações Autônomas Pós-Início (após OK humano inicial)

Após o OK humano que **inicia a execução**, a Enavia entra em loop autônomo e pode executar estas ações até finalizar o objetivo, desde que dentro do escopo aprovado. O OK humano é só o inicial; microetapas internas seguem por memória/loop.

| Ação | Descrição |
|------|-----------|
| `execute_in_test_within_scope` | Execução em TEST dentro do escopo |
| `reexecute_in_test_within_scope` | Reexecução em TEST dentro do escopo |
| `internal_loop_until_objective_done` | Loop interno até finalizar objetivo |
| `operate_external_service_in_test_within_scope` | Operação em serviço externo em TEST, dentro do escopo |

---

## 5. B — Ações que Exigem OK Humano Explícito (SEMPRE, em qualquer ambiente)

Estas ações **nunca** são autônomas, nem mesmo em TEST. O usuário definiu que iniciar execução exige OK humano explícito.

| Ação | Descrição |
|------|-----------|
| `start_plan_execution` | Iniciar execução de plano (sempre exige OK) |
| `start_contract_execution` | Iniciar execução de contrato (sempre exige OK) |
| `start_task_execution` | Iniciar execução de tarefa (sempre exige OK) |
| `promote_to_prod` | Qualquer promoção para PROD |
| `act_on_undefined_external_service` | Ação em serviço externo não definido |
| `change_scope` | Qualquer mudança de escopo |

---

## 6. C — Ações Proibidas Incondicionalmente

| Ação | Descrição |
|------|-----------|
| `exit_scope` | Sair do escopo |
| `regress_contract` | Regredir contrato |
| `regress_plan` | Regredir plano |
| `regress_task` | Regredir tarefa |
| `modify_observability` | Mexer na observabilidade |
| `promote_to_prod_without_human_ok` | Promover sem OK |
| `act_with_scope_conflict` | Agir com conflito de escopo |
| `continue_after_repeated_failure_without_escalation` | Continuar após falha repetida sem escalar |
| `act_without_sufficient_evidence_when_promotion_depends_on_it` | Agir sem evidência quando promoção depende |

---

## 7. D — Gates Obrigatórios antes de Ação Sensível

| Gate | Descrição |
|------|-----------|
| `scope_defined` | Escopo definido |
| `environment_defined` | Ambiente definido |
| `risk_assessed` | Risco avaliado |
| `authorization_present_when_required` | Autorização presente quando exigida |
| `observability_preserved` | Observabilidade preservada |
| `evidence_available_when_required` | Evidência disponível quando necessária |

Todos os gates devem passar antes de permitir ação sensível. Se qualquer gate falhar, a ação é bloqueada.

---

## 8. E — Política de Falha e Escalonamento

| Regra | Comportamento |
|-------|---------------|
| Retry | 2 a 3 tentativas máximas |
| Após max retries | Bloquear e escalar ao usuário com motivo claro |
| Risco alto | Reportar ANTES da execução; bloquear até autorização |
| Evidência insuficiente | Bloqueio explícito e chamada ao usuário |

---

## 9. F — Compatibilidade com P24/P25/P26

| Braço | Política |
|-------|----------|
| P24 (GitHub Arm) | Subordinado ao contrato de autonomia |
| P25 (Browser Arm) | Subordinado ao contrato de autonomia |
| P26 (Deploy/Test) | Deve validar gate + autonomia + escopo antes de ação sensível |
| Regra geral | Nenhum braço pode sobrescrever o contrato de autonomia |

A função `validateSpecialistArmCompliance()` em `schema/autonomy-contract.js` é o ponto de validação que todo braço futuro deve chamar antes de executar ação sensível.

---

## 10. Regra de Ambiente

| Ambiente | Comportamento |
|----------|---------------|
| **TEST** | Pré-execução: autônomo. Pós-início aprovado: autonomia total dentro do escopo. **Início de execução exige OK humano.** Promoção para PROD, mudança de escopo e ação em serviço externo não definido **continuam** exigindo OK humano. |
| **PROD** | Leituras e diagnósticos permitidos. Qualquer ação operacional, início de execução ou promoção exige OK humano explícito. |

A autonomia total em TEST **não autoriza**:
- iniciar execução sem OK humano
- sair do escopo
- degradar observabilidade

---

## 11. Funções Públicas

| Função | Descrição |
|--------|-----------|
| `classifyAction(action)` | Classifica ação como autonomous / requires_human / prohibited |
| `evaluateGates(context)` | Avalia todos os gates obrigatórios |
| `evaluateFailurePolicy({...})` | Avalia política de retry/risco/evidência |
| `evaluateEnvironmentAutonomy({...})` | Avalia autonomia por ambiente e escopo |
| `validateSpecialistArmCompliance({...})` | Valida conformidade de braço especialista |

---

## 12. Arquivo Canônico

- **Schema:** `schema/autonomy-contract.js`
- **Testes:** `tests/autonomy-contract.smoke.test.js` (82 casos, 36 cenários)
- **Docs:** `docs/ENAVIA_AUTONOMY_CONTRACT_P23.md` (este arquivo)

---

## 13. O que NÃO está neste contrato

- Implementação de braço GitHub (P24)
- Implementação de browser executor (P25)
- Implementação de deploy/test como braço (P26)
- LLM / embeddings / heurística opaca
- Persistência / I/O
- Painel / UX visual
- Reescrita de fluxos existentes

---

## 14. Prova de Não-Regressão

Todos os testes existentes passaram após a correção deste contrato:

| Arquivo de teste | Resultado |
|-----------------|-----------|
| `autonomy-contract.smoke.test.js` | 82 passed, 0 failed |
| `contract-adherence-gate-integration.smoke.test.js` | 40 passed, 0 failed |
| `contract-adherence-gate.smoke.test.js` | 68 passed, 0 failed |
| `contract-final-audit.smoke.test.js` | 146 passed, 0 failed |
| `contracts-smoke.test.js` | 1187 passed, 0 failed |
| `decision-history.smoke.test.js` | 63 passed, 0 failed |
| `exec-event.smoke.test.js` | 57 passed, 0 failed |
| `execution-audit.smoke.test.js` | 142 passed, 0 failed |
| `execution-trail.smoke.test.js` | 51 passed, 0 failed |
| ... (todos os demais) | 0 failed |
