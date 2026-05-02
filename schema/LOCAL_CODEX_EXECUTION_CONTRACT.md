# LOCAL_CODEX_EXECUTION_CONTRACT — NV-ENAVIA

Contrato operacional para uso do Codex local no repositório `nv-enavia`.

Este arquivo não substitui `CLAUDE.md` nem `schema/CODEX_WORKFLOW.md`.
Ele é uma camada complementar para execução local com microfases, Git local e bloqueios explícitos.

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

## 3. Modo de execução permitido

O Codex local pode:

- diagnosticar;
- editar arquivos dentro do escopo autorizado;
- rodar testes locais;
- gerar diff;
- criar commit local;
- preparar instrução para PR.

O Codex local não pode:

- executar contrato inteiro em loop cego;
- misturar escopos;
- alterar produção;
- fazer push sem autorização explícita;
- avançar para a próxima microfase se a atual falhar;
- criar arquitetura paralela sem autorização;
- refatorar por estética;
- remover guardrails existentes;
- alterar comportamento funcional sem diagnóstico e teste.

---

## 4. Escopos isolados

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

## 5. Ciclo obrigatório por microfase

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
11. Parar.

A próxima microfase só pode começar depois de confirmação explícita.

---

## 6. Regra de parada obrigatória

Pare imediatamente se ocorrer qualquer item abaixo:

- teste falhou;
- diff tocou arquivo fora do escopo;
- diagnóstico não confirmou a causa;
- existe conflito entre contrato, handoff e status;
- a microfase depende de informação ausente;
- a tarefa exigiria mexer em produção;
- o Codex precisaria criar tabela, coluna, secret ou binding não previsto;
- o patch ficaria maior que o escopo declarado.

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

## 7. Commits locais

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

## 8. Push e PR

O Codex local não deve fazer push automaticamente.

Push só é permitido quando o usuário autorizar explicitamente.

Antes do push, deve apresentar:

- branch atual;
- commits criados;
- arquivos alterados;
- testes executados;
- rollback;
- risco residual.

---

## 9. Rollback

Toda microfase deve ter rollback claro.

Padrão mínimo:

```bash
git revert <commit_hash>
```

Se houver alteração de ambiente, segredo, binding, banco ou deploy, a microfase deve declarar rollback específico antes de implementar.

---

## 10. Formato obrigatório de resposta local

Ao concluir uma microfase:

```md
WORKFLOW_ACK: ok

Microfase:
Escopo:
Branch local:
Commit local:

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

## 11. Princípio final

A Enavia pode usar Codex local como braço executor.
Mas o Codex local nunca deve substituir governança, contrato, microfase, teste, diff e aprovação humana.
