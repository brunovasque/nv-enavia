# CONTRATO — ENAVIA — PAINEL + EXECUTORES — PR1 a PR7

## 0. Instrução obrigatória antes de qualquer ação

Antes de qualquer ação, leia obrigatoriamente o arquivo `CLAUDE.md` na raiz do repo e siga todas as regras dele.

Se não conseguir acessar ou ler `CLAUDE.md`, pare imediatamente e avise.

Depois de ler `CLAUDE.md`, leia também este contrato inteiro antes de diagnosticar, alterar, criar branch, editar arquivo, commitar ou abrir PR.

---

## 1. Objetivo macro

Transformar a ENAVIA em um sistema operacional governado pelo próprio repo, com:

- painel funcional enxergando contrato real;
- worker principal expondo superfície contratual estável;
- executor trazido para dentro do repo soberano;
- painel conectado ao backend real;
- health, execution e observabilidade com dados reais mínimos;
- loop contratual supervisionado;
- schemas existentes integrados à orquestração, quando fizer sentido.

O objetivo NÃO é refatorar a ENAVIA inteira.

O objetivo é executar a sequência PR1 → PR7 com escopo fechado, evidência real e sem misturar Worker, Panel e Executor na mesma PR.

---

## 2. Estado atual considerado como fonte de verdade

A ENAVIA já possui painel em Vercel com abas:

- Chat
- Plano
- Memória
- Execução
- Contrato
- Saúde
- Browser

A fase recente trabalhada foi:

Chat → Planner → Plano

O chat já está mais próximo do comportamento desejado:

- aceita conversa operacional;
- usa target ativo;
- aplica memória;
- permite reset de chat sem apagar memória;
- permite gerar plano a partir do contexto;
- o botão “Gerar plano” não deve virar o objetivo do plano;
- o plano nasce de `planner_brief`;
- uma única mensagem completa com objetivo, contexto, restrição e critério já pode gerar plano.

A aba Plano já renderiza plano vindo do backend, mas ainda pode precisar de lapidação visual depois.

A memória já aparece e é aplicada no chat, mas ainda precisa evoluir para cérebro de longo prazo.

O Worker da ENAVIA já chama executor por Service Binding, mas o executor ainda é uma peça separada e fora da governança total do repo principal.

---

## 3. Regra estrutural obrigatória

Não misturar escopos.

Cada PR deve ser fechada em apenas um domínio:

- Worker-only
- Executor-only
- Panel-only

Se uma correção exigir tocar outro domínio, registre como bloqueio ou próxima PR. Não resolva junto sem autorização explícita.

---

## 4. Ordem obrigatória das PRs

A ordem obrigatória é:

1. PR1 — Worker-only — `/contracts/active-surface`
2. PR2 — Executor-only — trazer `enavia-executor` para dentro do repo
3. PR3 — Panel-only — ligar painel no backend real
4. PR4 — Worker-only — fixes cirúrgicos de confiabilidade
5. PR5 — Worker-only — observabilidade real mínima consolidada
6. PR6 — Worker-only — loop contratual supervisionado
7. PR7 — Worker-only — integrar schemas desconectados

Não pule etapa.

Não antecipe PR futura.

Não abra PR2 antes de concluir PR1.

Não abra PR3 antes de concluir PR2.

E assim sucessivamente.

---

## 5. PR1 — Worker-only — `/contracts/active-surface`

### Objetivo

Criar a rota:

```txt
GET /contracts/active-surface

Essa rota deve destravar a surface contratual real que o painel espera.

Escopo permitido
Localizar onde o Worker principal roteia endpoints HTTP.
Criar rota GET /contracts/active-surface.
Ler o contrato ativo existente no repo/ambiente/estrutura atual.
Devolver shape estável e previsível para UI.
Preservar CORS se o padrão do Worker já exigir isso.
Não alterar painel nesta PR.
Não alterar executor nesta PR.
Shape mínimo esperado

A resposta deve ser JSON estável, contendo no mínimo:

{
  "ok": true,
  "source": "active-contract",
  "contract": {
    "id": "...",
    "title": "...",
    "status": "...",
    "current_phase": "...",
    "current_pr": "...",
    "updated_at": "..."
  },
  "surface": {
    "available": true,
    "next_action": "...",
    "blocked": false,
    "block_reason": null
  }
}

Se algum campo real ainda não existir, usar fallback explícito e documentado, sem inventar estado falso.

Critérios de aceite
Endpoint responde 200.
Resposta é JSON válido.
Não quebra endpoints existentes.
Smoke test documentado.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Sonnet.

6. PR2 — Executor-only — trazer enavia-executor para dentro do repo
Objetivo

Acabar com o ponto cego estrutural atual: o Worker chama env.EXECUTOR.fetch(...), mas o executor ainda não está governado dentro do repo soberano da ENAVIA.

Escopo permitido
Criar pasta própria para o executor dentro do repo.
Incluir código do executor existente ou reconstrução fiel baseada no comportamento atual.
Criar contrato de entrada/saída do executor.
Criar README curto explicando Service Binding.
Criar health mínimo do executor.
Provar compatibilidade com chamada via env.EXECUTOR.fetch(...).
Não alterar painel nesta PR.
Não alterar a lógica principal do Worker além do mínimo necessário para documentar/validar binding, se necessário.
Estrutura sugerida
executor/
  README.md
  CONTRACT.md
  src/
    index.ts
  tests/
    executor.contract.test.ts

Se a estrutura real do repo usar outro padrão, adaptar ao padrão existente sem refatorar o repo inteiro.

Health mínimo esperado

O executor deve ter uma rota ou handler equivalente que permita validar:

{
  "ok": true,
  "executor": "enavia-executor",
  "status": "healthy"
}
Compatibilidade obrigatória

A PR deve demonstrar que o Worker principal consegue continuar chamando:

env.EXECUTOR.fetch(...)

Sem quebrar o contrato atual.

Critérios de aceite
Executor está dentro do repo.
README explica como o binding funciona.
CONTRACT.md define entrada e saída.
Health mínimo existe.
Compatibilidade com env.EXECUTOR.fetch(...) documentada.
Nenhuma alteração de painel.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Opus.

7. PR3 — Panel-only — ligar painel no backend real
Objetivo

Tirar o painel do mock soberano e fazer as abas principais enxergarem backend real.

Escopo permitido
Ajustar variável VITE_NV_ENAVIA_URL ou equivalente.
Ativar modo real onde hoje houver mock.
Validar ContractPage contra backend real.
Validar HealthPage contra backend real.
Validar ExecutionPage contra backend real.
Não alterar Worker nesta PR.
Não alterar Executor nesta PR.
Critérios de aceite
Painel consome backend real.
Mock não é removido se ainda for útil como fallback/dev, mas não pode ser o caminho principal em produção.
ContractPage mostra dados reais.
HealthPage mostra dados reais.
ExecutionPage mostra dados reais.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Sonnet.

8. PR4 — Worker-only — fixes cirúrgicos de confiabilidade
Objetivo

Limpar ruídos comprovados antes de automatizar ciclo contratual.

Escopo permitido

Corrigir apenas estes pontos:

ENAVIA_BUILD.deployed_at não pode ficar hardcoded se houver forma real de derivar build/deploy.
Trocar executor.invalid por caminho interno correto, se isso estiver comprovadamente errado.
Decidir explicitamente consolidateAfterSave():
integrar se já houver base segura;
ou marcar formalmente como fora do escopo agora.
Critérios de aceite
Apenas correções cirúrgicas.
Nenhuma refatoração ampla.
Nenhuma alteração de painel.
Nenhuma alteração de executor, salvo se for só documentação de contrato.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Sonnet.

9. PR5 — Worker-only — observabilidade real mínima consolidada
Objetivo

Fazer /health e /execution refletirem estado real mínimo, não apenas casca visual ou último evento isolado.

Escopo permitido

Adicionar ou consolidar:

contadores reais mínimos;
últimos erros reais;
execuções bloqueadas reais;
execuções concluídas reais;
estado atual legível para painel.
Critérios de aceite
/health retorna sinais úteis reais.
/execution retorna estado útil real.
Não quebra formato usado pelo painel.
Se alterar shape, preservar compatibilidade ou documentar fallback.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Opus.

10. PR6 — Worker-only — loop contratual supervisionado
Objetivo

Tirar o contrato do modo “HTTP manual por etapa” e transformar em ciclo supervisionado.

Escopo permitido

Implementar um passo supervisionado usando, se existirem:

resolveNextAction()
executeCurrentMicroPr()
completion/advance com gates

Se esses nomes não existirem no repo, diagnosticar equivalentes antes de criar abstrações novas.

Regra crítica

Não criar automação cega.

O loop deve ser supervisionado, com gates claros, estado persistido e bloqueio quando faltar evidência.

Critérios de aceite
Existe ciclo supervisionado mínimo.
O sistema sabe dizer próxima ação.
O sistema sabe executar ou bloquear com motivo.
O sistema não avança sem evidência.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Opus.

11. PR7 — Worker-only — integrar schemas desconectados
Objetivo

Plugar schemas já existentes que estejam fora da orquestração principal, somente se ainda fizer sentido após PR6.

Escopo permitido
Mapear schemas desconectados.
Identificar quais são realmente úteis para a orquestração atual.
Integrar apenas os necessários.
Não integrar arquivo só porque existe.
Não refatorar a arquitetura inteira.
Critérios de aceite
Lista de schemas avaliados.
Lista de schemas integrados.
Justificativa dos schemas não integrados.
Nenhuma quebra de contrato anterior.
PR contém resumo, arquivos alterados, testes e rollback.
Modelo recomendado

Opus.

12. Regras obrigatórias de execução

Para cada PR:

Criar branch própria.
Não misturar escopos.
Diagnosticar antes de alterar.
Fazer patch cirúrgico.
Preservar comportamento existente.
Rodar smoke tests compatíveis com o escopo.
Fazer commit.
Fazer push.
Abrir PR.
Documentar evidências reais.

Formato sugerido de branch:

claude/pr1-active-surface
claude/pr2-executor-governado
claude/pr3-panel-backend-real
claude/pr4-worker-confiabilidade
claude/pr5-observabilidade-real
claude/pr6-loop-supervisionado
claude/pr7-schemas-orquestracao
13. Regra de bloqueio

Pare e avise se:

não conseguir ler CLAUDE.md;
não encontrar os arquivos obrigatórios citados por CLAUDE.md;
o repo atual não corresponder ao contrato;
uma PR depender de outra ainda não concluída;
for necessário misturar Worker + Panel + Executor na mesma PR;
testes básicos falharem;
houver risco de quebrar produção;
faltar variável/env/binding essencial.

Não force avanço.

Não invente estado.

Não feche etapa sem prova.

14. Formato obrigatório da resposta ao final de cada PR

Responder sempre em português com:

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
- Comando:
- Resultado:

Evidências:
- ...

Rollback:
- ...

Bloqueios:
- nenhum

Se houver bloqueio:

WORKFLOW_ACK: bloqueado

PR/Etapa:
Bloqueio:
Causa provável:
Evidência:
Próxima ação segura:
15. Definição de pronto

Este contrato só é considerado concluído quando:

PR1 concluída e aprovada;
PR2 concluída e aprovada;
PR3 concluída e aprovada;
PR4 concluída e aprovada;
PR5 concluída e aprovada;
PR6 concluída e aprovada;
PR7 concluída e aprovada ou formalmente marcada como desnecessária após diagnóstico.

Não considerar concluído apenas por criar arquivos.

Não considerar concluído sem testes.

Não considerar concluído sem PRs separadas.

16. Ordem executiva final

Execute nesta ordem:

1. Ler CLAUDE.md
2. Ler este contrato
3. Diagnosticar PR1
4. Executar PR1
5. Parar com evidências da PR1
6. Só depois seguir para PR2
7. Repetir o ciclo até PR7

Se o operador pedir execução completa, ainda assim respeite PRs separadas, branches separadas e evidências por etapa.


Depois, o prompt para abrir no Claude Code é este:

```text
Antes de qualquer ação, leia obrigatoriamente o arquivo `CLAUDE.md` na raiz do repo e siga todas as regras dele.
Se não conseguir acessar ou ler `CLAUDE.md`, pare e avise.

Depois leia integralmente:

schema/contracts/active/CONTRATO_ENAVIA_PAINEL_EXECUTORES_PR1_PR7.md

Execute o contrato exatamente como está escrito.

Regras absolutas:
- não pule PR;
- não misture Worker, Panel e Executor na mesma PR;
- não refatore por estética;
- não altere o que já funciona sem necessidade comprovada;
- faça diagnóstico antes de patch;
- crie branch separada por PR;
- faça commit e push;
- abra PR;
- pare ao final de cada PR com evidências reais.

Comece pela PR1 — Worker-only — `/contracts/active-surface`.

Se encontrar bloqueio real, pare e responda no formato de bloqueio previsto no contrato.
