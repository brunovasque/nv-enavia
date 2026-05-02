# Aprendizado: Riscos Futuros — Enavia

**Data:** 2026-05-01
**Derivado de:** PR31–PR60 (ciclo Jarvis Brain)
**Tipo:** risco — padrões de falha identificados que podem se materializar em PRs futuras

---

## Aprendizado (frase direta)

> Os maiores riscos não são técnicos — são organizacionais e cognitivos.
> Documentação bonita, falsa capacidade e falta de prova são os padrões mais perigosos.

---

## Riscos identificados no ciclo PR31–PR60

### R1 — Documentação bonita sem produto

**Descrição:**
Ciclo de PRs que geram muita documentação (PR-DOCS, PR-DIAG) sem implementação real nem teste.

**Sinal de alerta:**
- 3+ PRs consecutivas sem PR-IMPL
- Brain cresce mas sistema não muda
- Relatórios bem escritos sem smoke test

**Como mitigar:**
- Equilibrar PR-DOCS/PR-DIAG com PR-IMPL + PR-PROVA
- Self-Audit categoria `docs_over_product` detecta esse padrão
- Contrato deve ter meta de produto, não apenas de documentação

**Fonte:** PR55 (Self-Audit Framework), PR60 Cenário B (frustração detectada)

**Nota PR63/PR64 — Decisão de adiar runtime de escrita de memória:**
> Implementar escrita de memória (`/memory/write`, `/brain/write`) antes do Runtime de Skills existir é uma instância clássica de R1: mais infraestrutura sem uso real.
> A decisão das PRs63/PR64 é deliberada: adiar o runtime de escrita até que:
> (a) Runtime de Skills exista e
> (b) Skills estejam produzindo conteúdo operacional real para memorizar.
> Criar `/memory/write` agora seria documentação de infraestrutura sem produto que a consuma.

---

### R2 — Falsa capacidade

**Descrição:**
Sistema ou agente afirma que algo existe ou funciona quando não existe ou não funciona.

**Sinal de alerta:**
- "Você já consegue fazer X" quando X não existe
- Afirmar que `/skills/run` existe
- Afirmar que skill foi executada sem runtime

**Como mitigar:**
- Self-Audit categoria `false_capability` detecta
- Response Policy regra `false_capability` orienta honestidade
- Skill Router retorna `status: documental` explicitamente

**Fonte:** PR51, PR56, PR59, PR60 Cenário F

---

### R3 — Confusão runtime vs documental

**Descrição:**
Módulo documental é apresentado como se fosse operacional (ou vice-versa).

**Sinal de alerta:**
- Skills descritas como "executáveis" quando são documentais
- Brain Loader descrito como "escrita em tempo real" quando é snapshot estático
- Self-Audit descrito como "blocking" quando é read-only (exceto secret_exposure)

**Como mitigar:**
- Self-Audit categoria `runtime_vs_documentation_confusion` detecta
- Manter distinção clara em todo relatório e handoff
- SYSTEM_AWARENESS.md deve ter tabela de estado atualizada

**Fonte:** PR55, PR56, PR60 Cenário O

---

### R4 — Prompt bloat

**Descrição:**
Prompt do sistema cresce sem controle, aumentando custo e degradando qualidade de resposta.

**Sinal de alerta:**
- Brain Loader em 4.000 chars constantes já é +1.000 tokens
- Cada módulo novo adiciona bloco ao prompt
- Seções duplicadas não consolidadas

**Como mitigar:**
- LLM Core consolidou seções 1-4 (PR46: -449 chars/-112 tokens)
- Brain Loader tem limite hard-coded de 4.000 chars
- PR-DIAG deve medir prompt antes de adicionar novos módulos

**Fonte:** PR45 (diagnóstico), PR46 (LLM Core), PR47 (prova com truncamento)

---

### R5 — Classifier edge cases

**Descrição:**
Intent Classifier não cobre todas as variações de linguagem natural.
Finding I1 é exemplo real: "você já consegue" não é detectado.

**Sinal de alerta:**
- Novas formas de perguntar sobre capacidade retornam `unknown`
- Operador usa advérbios, negações ou ênfases que o classifier não captura
- Regressões em intenções já classificadas por mudança de termos

**Como mitigar:**
- Cada PR-PROVA deve incluir cenários de edge case
- Finding documentado deve virar PR-IMPL corretiva própria
- Manter lista de termos canônicos atualizada

**Fonte:** PR49, PR50, PR60 Finding I1

---

### R6 — Excesso de PR-DOCS / PR-DIAG

**Descrição:**
Contrato acumula PRs de diagnóstico e documentação sem avançar para implementação.

**Sinal de alerta:**
- Contrato com 10+ PRs sem nenhuma PR-IMPL
- Diagnóstico repetindo o que o anterior já identificou
- "Mais diagnóstico" como substituto para decisão difícil

**Como mitigar:**
- CLAUDE.md regra: diagnóstico antes de alterar, mas não em loop
- Contrato deve ter gates: "PR-DIAG só autorizada uma vez por frente"
- Ao identificar problema, abrir PR-IMPL dentro do mesmo ciclo

**Fonte:** PR32-PR35 (3 PRs de diagnóstico/docs antes da PR36)

---

### R7 — Avançar contrato sem prova

**Descrição:**
Marcar frente como concluída sem PR-PROVA com evidência real.

**Sinal de alerta:**
- "PR-IMPL concluída" sem teste formal
- Handoff dizendo "funciona" sem número de testes
- PR mergeada sem smoke test

**Como mitigar:**
- CLAUDE.md regra: não fechar frente sem PR-PROVA
- Contrato exige PR-PROVA antes de avançar para próxima frente
- Execution log deve ter resultado numérico (X/X testes)

**Fonte:** PR37 (prova PR36), PR47 (prova LLM Core), PR57 (prova Self-Audit), PR60 (prova final)

---

### R8 — Misturar correção com prova

**Descrição:**
PR-PROVA que também corrige o que encontrou, em vez de abrir PR-IMPL separada.

**Sinal de alerta:**
- PR-PROVA com arquivos de runtime alterados
- "Corrigir durante o teste" para economizar PR
- Prova que passa porque foi alterada, não porque o sistema estava correto

**Como mitigar:**
- PR-PROVA é read-only para runtime
- Finding em PR-PROVA → PR-IMPL corretiva separada
- Exemplo correto: PR57 (prova com falha) → PR58 (impl corretiva) → PR57 re-passa

**Fonte:** PR57 (falha Cenário H), PR58 (correção cirúrgica)

---

### R9 — Criar endpoint antes de contrato

**Descrição:**
Implementar endpoint novo sem diagnóstico + aprovação no contrato.

**Sinal de alerta:**
- `/brain/write` criado em PR-DOCS
- `/skills/run` criado em PR-IMPL "rápida"
- Endpoint "temporário" que fica permanente

**Como mitigar:**
- CLAUDE.md regra: não criar endpoint sem contrato
- Self-Audit detecta `unauthorized_action`
- Todo endpoint exige PR-DIAG + PR-IMPL dedicadas

**Fonte:** PR56 (campo aditivo, não endpoint), PR60 Cenário E (gate de deploy)

---

## Como aplicar

1. Ao planejar nova fase, revisar esta lista de riscos.
2. Ao detectar sinal de alerta, parar e declarar o risco explicitamente.
3. Ao criar contrato, incluir regras de mitigação dos riscos mais relevantes.
4. Self-Audit e Response Policy já detectam/orientam vários desses riscos automaticamente.

---

## Backlinks

- `schema/brain/memories/JARVIS_BRAIN_PR31_PR60_MEMORY.md` — memória do ciclo
- `schema/brain/learnings/ANTI_BOT_FINAL_LEARNINGS.md` — aprendizados anti-bot
- `schema/self-audit/RISK_MODEL.md` — modelo de risco do Self-Audit
- `schema/self-audit/SIGNALS.md` — sinais de risco
