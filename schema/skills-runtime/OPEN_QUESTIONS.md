# ENAVIA — Runtime de Skills: Perguntas Abertas

**Versão:** 0.1 — Blueprint
**Data:** 2026-05-02 (PR65)
**Estado:** Abertas — a serem respondidas na PR66 (PR-DIAG)

---

## 1. Objetivo

Estas perguntas foram identificadas durante o blueprint da PR65 e devem ser respondidas com evidência do repositório na PR66 (PR-DIAG — Diagnóstico técnico para Runtime de Skills).

Nenhuma pergunta deve ser respondida por suposição. Cada resposta deve citar a fonte (arquivo, linha, teste).

---

## 2. Perguntas abertas para PR66 diagnosticar

### Q1 — Onde o runtime deve viver?

**Pergunta:** O Runtime de Skills deve viver no Worker principal (`nv-enavia.js`) ou em um Worker separado?

**Por que importa:**
- Worker separado: isolamento maior, deploy independente, mas mais infraestrutura
- Worker principal: mais simples, mas aumenta complexidade de `nv-enavia.js`

**Como responder:** Analisar `nv-enavia.js`, `wrangler.toml`, `schema/system/ENAVIA_WORKER_REGISTRY.md` e avaliar trade-offs.

**Critério de resposta:** Decisão documentada com justificativa técnica e referência a arquivos analisados.

---

### Q2 — Primeiro endpoint: `/skills/propose` em vez de `/skills/run`?

**Pergunta:** O primeiro endpoint do runtime deve ser `/skills/propose` (gera proposta sem executar) e não `/skills/run` (executa diretamente)?

**Por que importa:**
- `/skills/propose` é mais seguro como primeiro endpoint
- `/skills/run` sem gate de aprovação = risco de autonomia cega
- Mas pode haver razão técnica para outra abordagem

**Como responder:** Verificar `ENAVIA_ROUTE_REGISTRY.json` para conflitos de rota. Consultar `ROLLOUT_PLAN.md` desta pasta.

**Critério de resposta:** Decisão com trade-offs documentados.

---

### Q3 — Como aprovar execução?

**Pergunta:** Como o operador humano aprova uma proposta de execução de skill?

**Opções possíveis:**
- Via PR (mecanismo vigente de governança)
- Via endpoint `/skills/approve` com token de aprovação
- Via webhook em canal externo
- Via flag em KV

**Como responder:** Avaliar o mecanismo vigente de governança (via PR) vs. mecanismo técnico integrado. Consultar `schema/brain/UPDATE_POLICY.md`.

**Critério de resposta:** Mecanismo escolhido com justificativa e diagrama de fluxo.

---

### Q4 — Onde registrar execuções?

**Pergunta:** Qual é o storage para o log de execuções do Runtime de Skills?

**Opções possíveis:**
- KV namespace existente (`ENAVIA_BRAIN`)
- Novo KV namespace dedicado
- D1 (banco relacional Cloudflare)
- R2 (object storage)
- Apenas no schema documental (sem persistência runtime)

**Como responder:** Verificar bindings existentes em `wrangler.toml` e `wrangler.executor.template.toml`.

**Critério de resposta:** Storage escolhido com justificativa técnica + lista de bindings necessários.

---

### Q5 — Quais bindings são necessários?

**Pergunta:** Quais KV namespaces, D1 databases, R2 buckets ou outros bindings o Runtime de Skills precisará?

**Como responder:** Analisar `wrangler.toml` para bindings existentes. Listar o que já existe e o que precisaria ser criado.

**Critério de resposta:** Tabela de bindings existentes vs. necessários, com impacto de criação.

---

### Q6 — Como relacionar execução com Self-Audit?

**Pergunta:** Como integrar o Self-Audit existente (`schema/enavia-self-audit.js`) no pipeline de execução de skills?

**Por que importa:**
- Self-Audit já detecta 10 categorias de risco
- Deve executar antes de retornar resultado de execução
- `secret_exposure` deve bloquear execução se detectado

**Como responder:** Analisar a assinatura atual de `runEnaviaSelfAudit()`. Identificar o que precisa mudar para receber contexto de execução de skill.

**Critério de resposta:** Contrato de integração proposto com signature esperada.

---

### Q7 — Como evitar falsa capacidade?

**Pergunta:** Como garantir que o sistema nunca afirme que executou uma skill quando não executou?

**Por que importa:**
- R2 (false_capability) é um dos principais riscos documentados
- Self-Audit detecta mas não bloqueia mecanicamente (exceto `secret_exposure`)

**Como responder:** Analisar como `enavia-self-audit.js` detecta `false_capability`. Identificar ponto de enforcement no pipeline.

**Critério de resposta:** Proposta de enforcement específica (onde bloquear mecanicamente).

---

### Q8 — Como proteger secrets no pipeline de execução?

**Pergunta:** Quais mecanismos técnicos garantem que secrets não vazam durante execução de skills?

**Por que importa:**
- Skills como DEPLOY_GOVERNANCE_OPERATOR podem acessar contexto com secrets
- Response Policy e Self-Audit orientam/detectam, mas não filtram mecanicamente

**Como responder:** Identificar pontos onde secrets podem aparecer no pipeline. Propor filtros.

**Critério de resposta:** Lista de pontos de risco + proposta de filtragem técnica.

---

### Q9 — Como testar sem executar ação real?

**Pergunta:** Como criar PR-PROVA para o Runtime de Skills sem que os testes executem ações reais (deploy, merge, etc.)?

**Por que importa:**
- Todos os testes atuais são pure unit tests (sem rede, KV, FS)
- Runtime de Skills pode precisar de mocks mais complexos
- Não queremos testes que disparam deploy acidental

**Como responder:** Analisar estrutura de testes existentes em `tests/`. Identificar padrão de mocking.

**Critério de resposta:** Estratégia de teste proposta com exemplos de mock.

---

### Q10 — O `contract-executor.js` deve ser reutilizado?

**Pergunta:** O módulo `contract-executor.js` existente tem alguma lógica reutilizável para o Skill Executor?

**Como responder:** Ler `contract-executor.js` e identificar lógicas compartilháveis (aprovação, execução, log).

**Critério de resposta:** Tabela: o que reutilizar vs. o que criar do zero.

---

### Q11 — Risco de confusão entre Skill Executor e Contract Executor?

**Pergunta:** Há risco de confusão de responsabilidades entre o futuro Skill Executor e o `contract-executor.js` existente?

**Como responder:** Mapear responsabilidades de `contract-executor.js`. Propor separação clara.

**Critério de resposta:** Diagrama de responsabilidades proposto.

---

### Q12 — Há conflitos de rota com o Route Registry?

**Pergunta:** `/skills/propose`, `/skills/run`, `/skills/approve` conflitam com rotas existentes no `ENAVIA_ROUTE_REGISTRY.json`?

**Como responder:** Verificar `schema/system/ENAVIA_ROUTE_REGISTRY.json`.

**Critério de resposta:** Lista de rotas verificadas + confirmação de ausência de conflito.

---

## 3. Perguntas de segunda ordem (para após PR66)

Estas perguntas não precisam ser respondidas na PR66, mas devem ser mantidas em mente:

- Como o brain será atualizado com aprendizados da execução de skills? (G3)
- Como o Finding I1 do Intent Classifier afeta o roteamento para skills? (G6)
- Como o Response Policy deve ser atualizada para incluir resultados de execução?
- Qual é o SLA de timeout para aprovação humana?

---

## 4. Próxima ação

**PR66 — PR-DIAG — Diagnóstico técnico para Runtime de Skills**

- Ler este arquivo como base de investigação
- Responder Q1–Q12 com evidência de arquivos do repositório
- Criar relatório `schema/reports/PR66_DIAG_RUNTIME_SKILLS.md`
- Não implementar nada — apenas diagnosticar
