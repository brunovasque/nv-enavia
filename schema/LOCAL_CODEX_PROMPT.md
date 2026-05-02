# LOCAL_CODEX_PROMPT — NV-ENAVIA

Prompt base para iniciar uma sessão local do Codex com segurança.

Use este prompt quando quiser executar uma microfase específica no ambiente local.

---

## Prompt canônico

Leia e siga estritamente estes arquivos, nesta ordem:

1. CLAUDE.md
2. schema/CODEX_WORKFLOW.md
3. schema/LOCAL_CODEX_EXECUTION_CONTRACT.md
4. schema/MICROPHASES.md
5. O contrato ativo em schema/contracts/active, se a microfase depender dele

Se não conseguir acessar ou ler qualquer arquivo obrigatório, pare e me avise.

Você está no repositório nv-enavia.

Modo da sessão: <LOCAL-STAGING ou LOCAL-PR>

Execute somente a microfase indicada abaixo:

Microfase alvo: <INFORMAR_ID_DA_MICROFASE>

Regras obrigatórias:

- Faça diagnóstico read-only antes de alterar qualquer arquivo.
- Confirme o objetivo único da microfase.
- Confirme o escopo permitido.
- Confirme o escopo proibido.
- Liste os arquivos que pretende tocar.
- Aplique patch cirúrgico somente dentro do escopo.
- Não misture Worker, Panel, Executor, Deploy-worker, Workflows e Docs.
- Não refatore por estética.
- Não remova guardrails existentes.
- Não execute a próxima microfase.
- Não peça autorização para cada leitura, edição ou teste comum dentro da microfase aprovada.
- Se estiver em LOCAL-STAGING, não faça push.
- Se estiver em LOCAL-PR, push é permitido no branch autorizado da microfase, seguindo CLAUDE.md e schema/CODEX_WORKFLOW.md.
- Se teste falhar, pare e reporte bloqueio.

Ações pré-autorizadas dentro do escopo:

- ler arquivos do repo;
- editar arquivos compatíveis com o escopo;
- rodar testes, lint, typecheck, build ou validação local;
- consultar status, diff, log e branch;
- criar commit local da microfase.

Ações que exigem parada e autorização explícita:

- push em modo LOCAL-STAGING;
- merge;
- alteração destrutiva de histórico;
- alteração de branch remota;
- produção;
- secrets, bindings, variáveis de ambiente ou banco;
- criação de tabela ou coluna;
- dependência nova;
- arquivo fora do escopo;
- próxima microfase;
- comando com risco de perda de dados.

Depois da alteração:

- Rode o teste obrigatório da microfase.
- Mostre resumo do diff.
- Crie commit local com o ID da microfase.
- Se estiver em LOCAL-PR, faça push no branch autorizado.
- Informe rollback.
- Pare aguardando aprovação para próxima microfase.

Formato de resposta:

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

---

## Prompt de bloqueio esperado

Se houver bloqueio, responder:

WORKFLOW_ACK: bloqueado

Microfase:
Bloqueio:
Evidência:
Arquivos afetados:
Próxima ação segura:
