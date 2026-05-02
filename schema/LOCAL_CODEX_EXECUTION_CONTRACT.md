# LOCAL_CODEX_EXECUTION_CONTRACT — NV-ENAVIA

Contrato operacional para uso do Codex local no repositório `nv-enavia`.

Este arquivo não substitui `CLAUDE.md` nem `schema/CODEX_WORKFLOW.md`.
Ele é uma camada complementar para execução local com microfases, Git local, permissões controladas e bloqueios explícitos.

---

## 1. Regra-mãe

Contrato grande orienta.
Microfase executa.

É proibido executar um contrato inteiro em bloco único.

O Codex local deve trabalhar sempre em unidade pequena, rastreável, testável e reversível.

---

## 2. Ordem obrigatória de leitura

Antes de qualquer ação, leia nesta ordem:

1. `CLAUDE.md`
2. `schema/CODEX_WORKFLOW.md`
3. `schema/LOCAL_CODEX_EXECUTION_CONTRACT.md`
4. `schema/MICROPHASES.md`
5. Contrato ativo em `schema/contracts/active/`, quando aplicável
6. `schema/status/ENAVIA_STATUS_ATUAL.md`, quando existir
7. `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`, quando existir
8. `schema/execution/ENAVIA_EXECUTION_LOG.md`, quando existir

Se algum arquivo obrigatório não puder ser lido, pare e reporte o bloqueio.

---

## 3. Modos locais oficiais

Existem dois modos locais permitidos.

### 3.1. Modo LOCAL-STAGING

Uso: explorar, diagnosticar, testar e preparar uma microfase localmente antes de abrir PR.

Permissões:

- pode ler arquivos;
- pode editar arquivos dentro do escopo da microfase;
- pode rodar testes locais;
- pode gerar diff;
- pode criar commit local;
- não deve fazer push;
- não deve abrir PR;
- deve parar ao final da microfase.

### 3.2. Modo LOCAL-PR

Uso: executar microfase já aprovada para virar PR oficial.

Permissões:

- pode ler arquivos;
- pode editar arquivos dentro do escopo da microfase;
- pode rodar testes locais;
- pode gerar diff;
- pode criar commit;
- pode fazer push no branch da microfase;
- pode preparar ou atualizar PR;
- deve seguir `CLAUDE.md` e `schema/CODEX_WORKFLOW.md` quanto a commit, push e evidências.

Neste modo, o push não é considerado indevido, porque faz parte do fluxo oficial autorizado.

---

## 4. Política de autorização no terminal

Dentro de uma microfase aprovada, o Codex local não deve pedir autorização para cada leitura, edição ou teste comum.

Estão pré-autorizados dentro do escopo declarado:

- ler arquivos do repo;
- editar arquivos listados ou compatíveis com o escopo;
- criar novos arquivos de documentação quando o escopo for `Docs-only`;
- rodar comandos de teste, lint, typecheck, build ou validação local;
- executar comandos Git seguros de inspeção, como status, diff, log e branch;
- criar commit local da microfase.

Exigem parada e autorização explícita:

- push, exceto quando a sessão estiver em modo `LOCAL-PR`;
- merge;
- alterações destrutivas de histórico;
- alteração de branch remota;
- mexer em produção;
- alterar secrets, bindings, variáveis de ambiente ou banco;
- criar tabela ou coluna;
- instalar dependência nova;
- alterar arquivos fora do escopo;
- avançar para próxima microfase;
- rodar comandos com risco de perda de dados.

---

## 5. Modo de execução permitido

O Codex local pode:

- diagnosticar;
- editar arquivos dentro do escopo autorizado;
- rodar testes locais;
- gerar diff;
- criar commit local;
- preparar instrução para PR;
- fazer push somente quando estiver em modo `LOCAL-PR`.

O Codex local não pode:

- executar contrato inteiro em loop cego;
- misturar escopos;
- alterar produção;
- fazer push em modo `LOCAL-STAGING`;
- avançar para a próxima microfase se a atual falhar;
- criar arquitetura paralela sem autorização;
- refatorar por estética;
- remover guardrails existentes;
- alterar comportamento funcional sem diagnóstico e teste.

---

## 6. Escopos isolados

Cada microfase deve declarar exatamente um escopo:

- `Docs-only`
- `Worker-only`
- `Panel-only`
- `Executor-only`
- `Deploy-worker-only`
- `Workflows-only`
- `Tests-only`

Se uma tarefa exigir mais de um escopo, divida em microfases separadas.

---

## 7. Ciclo obrigatório por microfase

Para cada microfase, siga o ciclo:

1. Ler a microfase inteira.
2. Confirmar objetivo único.
3. Confirmar escopo permitido.
4. Confirmar escopo proibido.
5. Fazer diagnóstico read-only.
6. Listar arquivos prováveis.
7. Aplicar patch mínimo somente se o diagnóstico confirmar a necessidade.
8. Rodar testes obrigatórios da microfase.
9. Mostrar `git diff --stat` e resumo do diff.
10. Criar commit local com o ID da microfase.
11. Se estiver em modo `LOCAL-PR`, fazer push no branch autorizado.
12. Parar.

A próxima microfase só pode começar depois de confirmação explícita.

---

## 8. Regra de parada obrigatória

Pare imediatamente se ocorrer qualquer item abaixo:

- teste falhou;
- diff tocou arquivo fora do escopo;
- diagnóstico não confirmou a causa;
- existe conflito entre contrato, handoff e status;
- a microfase depende de informação ausente;
- a tarefa exigiria mexer em produção;
- o Codex precisaria criar tabela, coluna, secret ou binding não previsto;
- o patch ficaria maior que o escopo declarado;
- o comando pretendido estiver na lista de ações que exigem autorização explícita.

Quando parar, responda com:

```md
WORKFLOW_ACK: bloqueado

Microfase:
Bloqueio:
Evidência:
Arquivos afetados:
Próxima ação segura:
```

---

## 9. Commits locais

Cada microfase concluída deve gerar um commit próprio.

Formato recomendado:

```text
<tipo>: microfase <ID> - <descrição curta>
```

Exemplos:

```text
docs: microfase LC-001 - add local codex governance
fix: microfase WK-003 - validate executor payload
```

Nunca juntar múltiplas microfases sem necessidade.

---

## 10. Push e PR

Push depende do modo da sessão:

- `LOCAL-STAGING`: push proibido; parar com commit local e relatório.
- `LOCAL-PR`: push permitido e esperado no branch autorizado da microfase.

Antes do push em modo `LOCAL-PR`, deve apresentar ou registrar:

- branch atual;
- commits criados;
- arquivos alterados;
- testes executados;
- rollback;
- risco residual.

---

## 11. Rollback

Toda microfase deve ter rollback claro.

Padrão mínimo: reverter o commit da microfase.

Se houver alteração de ambiente, segredo, binding, banco ou deploy, a microfase deve declarar rollback específico antes de implementar.

---

## 12. Formato obrigatório de resposta local

Ao concluir uma microfase:

```md
WORKFLOW_ACK: ok

Modo:
Microfase:
Escopo:
Branch local:
Commit local:
Push:

Resumo:
- ...

Arquivos alterados:
- ...

Testes:
- Comando:
- Resultado:

Diff:
- ...

Rollback:
- ...

Próxima microfase:
- aguardando aprovação
```

---

## 13. Princípio final

A Enavia pode usar Codex local como braço executor.
Mas o Codex local nunca deve substituir governança, contrato, microfase, teste, diff e aprovação humana.

O objetivo é reduzir pedidos repetitivos de permissão no terminal sem remover os freios importantes do projeto.
