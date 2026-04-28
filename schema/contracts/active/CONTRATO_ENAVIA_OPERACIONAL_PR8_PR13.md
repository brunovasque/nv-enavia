# CONTRATO — ENAVIA OPERACIONAL — PR8 a PR13

## 0. Instrução obrigatória

Antes de qualquer ação, leia obrigatoriamente o arquivo `CLAUDE.md` na raiz do repo e siga todas as regras dele.

Se não conseguir acessar ou ler `CLAUDE.md`, pare e avise.

Depois leia integralmente este contrato e os arquivos:

- `schema/status/ENAVIA_STATUS_ATUAL.md`
- `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`
- `schema/execution/ENAVIA_EXECUTION_LOG.md`

---

## 1. Objetivo macro

Transformar a ENAVIA de loop contratual read-only para loop operacional supervisionado.

Hoje existe:

- `GET /contracts/loop-status`
- leitura de próxima ação
- estado supervisionado
- health/execution com observabilidade mínima
- executor espelhado/documentado

Agora o objetivo é permitir:

1. consultar próxima ação;
2. validar se há evidência suficiente;
3. pedir aprovação humana quando necessário;
4. executar a próxima ação de forma supervisionada;
5. registrar resultado;
6. atualizar estado;
7. bloquear com motivo quando não for seguro;
8. nunca executar ação destrutiva sem gate.

---

## 2. Regra de ouro

Não criar autonomia cega.

Toda execução deve passar por:

- diagnóstico;
- próxima ação explícita;
- validação de evidência;
- gate de segurança;
- execução controlada;
- registro em log;
- rollback documentado.

Se faltar evidência, o sistema deve bloquear.

---

## 3. Ordem obrigatória das PRs

A ordem é:

```txt
PR8  — Worker-only — contrato operacional de ações e estado
PR9  — Worker-only — execute-next supervisionado
PR10 — Worker-only — gates, evidências e rollback
PR11 — Worker-only — integração segura com executor
PR12 — Panel-only  — botões operacionais no painel
PR13 — Worker-only — hardening final e encerramento
```

Não pule etapas.

Não misture Worker e Panel na mesma PR.

---

## 4. PR8 — Worker-only — contrato operacional de ações e estado

### Objetivo

Criar a base operacional para transformar `loop-status` em ciclo executável.

### Escopo permitido

- Diagnosticar rotas atuais:
  - `GET /contracts/loop-status`
  - `POST /contracts/execute`
  - `POST /contracts/complete-task`
  - `POST /contracts/close-final`
- Mapear quais ações reais já existem.
- Criar um contrato interno de ações possíveis.
- Criar shape canônico para ação operacional.

### Shape esperado

```json
{
  "action_id": "...",
  "contract_id": "...",
  "type": "execute_next | approve | reject | close_final | block",
  "requires_human_approval": true,
  "evidence_required": [],
  "can_execute": false,
  "block_reason": null
}
```

### Regras

- Não executar nada ainda.
- Não alterar executor.
- Não alterar painel.
- Apenas preparar contrato operacional.

### Critérios de aceite

- Existe mapeamento claro entre `nextAction` e ação operacional.
- Existe shape canônico.
- Nenhuma execução automática.
- Governança atualizada.

---

## 5. PR9 — Worker-only — `POST /contracts/execute-next` supervisionado

### Objetivo

Criar endpoint operacional para executar a próxima ação somente quando for seguro.

### Endpoint

```txt
POST /contracts/execute-next
```

### Comportamento esperado

O endpoint deve:

1. ler contrato ativo;
2. chamar `resolveNextAction`;
3. validar se a ação pode prosseguir;
4. se não puder, retornar bloqueio;
5. se puder, executar somente a ação permitida;
6. registrar resultado.

### Regras duras

- Não executar se `loop.blocked = true`.
- Não executar se faltar evidência.
- Não executar se a ação exigir aprovação humana e não houver aprovação.
- Não inventar estado.
- Não chamar deploy.
- Não fazer produção automática.

### Resultado esperado

```json
{
  "ok": true,
  "executed": false,
  "status": "blocked | awaiting_approval | executed",
  "reason": "...",
  "nextAction": {},
  "evidence": {},
  "audit_id": "..."
}
```

---

## 6. PR10 — Worker-only — gates, evidências e rollback

### Objetivo

Adicionar camada de freio antes da execução real.

### Escopo permitido

- Criar validação de evidências mínimas.
- Criar status de bloqueio.
- Criar registro de rollback recomendado.
- Criar trilha auditável.

### Exemplos de bloqueio

- contrato ausente;
- fase ausente;
- task ausente;
- ação sem endpoint seguro;
- aprovação humana pendente;
- executor indisponível;
- evidência insuficiente;
- estado terminal.

### Critérios de aceite

- Toda ação bloqueada explica o motivo.
- Toda ação executável tem evidência mínima.
- Toda execução tem rollback sugerido.
- Nenhum avanço silencioso.

---

## 7. PR11 — Worker-only — integração segura com executor

### Objetivo

Permitir que ações operacionais chamem o executor apenas quando passarem pelos gates.

### Escopo permitido

- Reusar Service Binding `env.EXECUTOR.fetch`.
- Integrar somente ações já mapeadas como seguras.
- Adicionar timeout/falha legível.
- Registrar resposta do executor.
- Não alterar o repo externo do executor.
- Não alterar pasta `executor/` salvo documentação se necessário.

### Regras

- Se executor falhar, estado não deve avançar como sucesso.
- Se resposta for ambígua, bloquear.
- Se executor retornar erro, registrar erro e rollback.
- Não tentar corrigir executor nesta PR.

---

## 8. PR12 — Panel-only — botões operacionais no painel

### Objetivo

Ligar o painel ao loop operacional.

### Escopo permitido

Adicionar botões no painel para:

- consultar status do loop;
- executar próxima ação;
- aprovar ação humana;
- bloquear/rejeitar;
- ver motivo de bloqueio;
- ver evidência e rollback.

### Regras

- Panel-only.
- Não alterar Worker.
- Não alterar Executor.
- Não criar lógica de decisão no front.
- O painel apenas chama endpoints e mostra resposta.

### Critérios de aceite

- Botão não executa se backend bloquear.
- Mostra `blockReason`.
- Mostra `availableActions`.
- Mostra resultado da execução.
- Mostra rollback sugerido.

---

## 9. PR13 — Worker-only — hardening final

### Objetivo

Fechar o contrato operacional com segurança mínima.

### Escopo permitido

- Revisar rotas novas.
- Confirmar CORS.
- Confirmar logs.
- Confirmar rollback.
- Confirmar que não há execução cega.
- Confirmar que todos os endpoints retornam JSON estável.
- Atualizar governança final.

### Critérios de aceite

- PR8 a PR13 concluídas.
- Loop operacional funcionando com supervisão.
- Painel consegue operar.
- Nenhuma autonomia destrutiva.
- Contrato encerrado formalmente.

---

## 10. O que é opcional

Os itens abaixo são opcionais. Não mexa agora.

- remover `consolidateAfterSave`;
- integrar `contract-adherence-engine`;
- integrar `contract-cognitive-orchestrator`;
- criar autonomia completa;
- criar deploy automático de produção;
- refatorar schemas antigos;
- mexer no executor externo.

Isso é opcional. Não mexa agora.

---

## 11. Definição de pronto

Este contrato estará pronto quando a ENAVIA conseguir:

1. consultar próxima ação;
2. decidir se pode executar;
3. bloquear se faltar evidência;
4. pedir aprovação humana;
5. executar ação segura;
6. registrar auditoria;
7. mostrar tudo no painel;
8. sugerir rollback;
9. nunca avançar sem prova.

---

## 12. Resposta obrigatória ao fim de cada PR

```txt
WORKFLOW_ACK: ok

PR executada:
Branch:
Commit:
Link da PR:

Resumo:
- ...

Arquivos alterados:
- ...

Smoke tests:
- ...

Evidências:
- ...

Rollback:
- ...

Bloqueios:
- nenhum
```

Se houver bloqueio:

```txt
WORKFLOW_ACK: bloqueado

Etapa:
Bloqueio:
Causa provável:
Evidência:
Próxima ação segura:
```
