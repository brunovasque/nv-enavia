# Aprendizado — O que funcionou

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Síntese consolidada de padrões de sucesso observados nos contratos
PR1–PR40.

---

## 1. Diagnóstico antes de implementação

PR-DIAG profundo antes de PR-IMPL evitou regressões e direcionou correções
cirúrgicas. PR32 e PR34 mapearam o chat engessado em 7 camadas; PR36 conseguiu
corrigir cirurgicamente porque sabia exatamente onde mexer.

> Generalização: para problemas com mais de uma camada possível de causa,
> abrir PR-DIAG separada antes de qualquer PR-IMPL.

**Como aplicar:** sempre que houver bug com sintoma observável mas causa
não trivial, PR-DIAG primeiro. Citar relatório de diagnóstico na PR-IMPL.

---

## 2. PR-PROVA revelando falhas reais

PR37 (prova) encontrou 5 achados reais que PR36 (implementação) não havia
capturado: system prompt ainda injetando bloco operacional pesado em alguns
casos, falsos positivos com palavras isoladas ("sistema", "contrato"), falso
negativo com verbo imperativo "Revise".

> Generalização: PR-IMPL "verde" não é PR-IMPL "completa". PR-PROVA é o
> filtro final.

**Como aplicar:** toda PR-IMPL gera obrigatoriamente uma PR-PROVA na mesma
frente. Frente só é fechada com PR-PROVA verde.

---

## 3. PR38 corrigindo exceção e voltando ao contrato

PR38 corrigiu os 5 achados de PR37 sem ampliar escopo (não tocou Brain, não
tocou painel, não tocou executor). Cumpriu a regra "se houver exceção,
corrigir e voltar ao contrato".

> Generalização: ciclo `PR-PROVA encontra → PR-IMPL pequena corrige → volta
> ao contrato` funciona sem inflar contrato.

**Como aplicar:** quando uma PR-PROVA quebrar, abrir PR-IMPL de correção
mínima (não nova frente), validar com mesma PR-PROVA, retomar plano.

---

## 4. Separar `read_only` de tom

Decisão consolidada em PR35 e implementada em PR36/PR38: gate de execução
e tom da resposta passaram a viver em camadas separadas. O resultado é
mensurável — anti-bot 56/56 ✅, prosa natural preservada, telemetria de
sanitização disponível.

> Generalização: sempre que uma flag de runtime estiver atuando como tom
> + permissão + intenção ao mesmo tempo, separar nas três camadas.

**Como aplicar:** `brain/decisions/2026-04-30-read-only-gate-nao-tom.md` é a
referência canônica. Reler antes de tocar prompt do `/chat/run`.

---

## 5. Sanitizers menos destrutivos

PR36 substituiu sanitizer "amplo demais" por sanitizer cirúrgico que preserva
prosa natural útil e bloqueia apenas snapshot JSON-like do planner.
Telemetria `sanitization: {applied, layer, reason}` foi adicionada para
observar regressão.

> Generalização: regra de bloqueio deve ser tão estreita quanto possível e
> tão observável quanto necessário.

**Como aplicar:** ao adicionar / alterar sanitizer ou validador, definir
critério positivo (o que **deve** passar) tão importante quanto critério
negativo (o que **não** pode passar). Telemetria sempre.

---

## 6. Governança + teste como proteção

Cada PR atualiza `status / handoff / execution log / INDEX`. Cada PR corre
smoke + regressões. Esse par governança+teste é o que mantém o sistema
auditável e estável ao longo de 40+ PRs.

> Generalização: governança documental sem teste é teatro; teste sem
> governança vira refactor invisível.

**Como aplicar:** PR sem governança atualizada está incompleta. PR sem
smoke / regressão (quando aplicável) está incompleta. Os dois são
obrigatórios juntos.

---

## 7. Skills documentais primeiro

Criar 4 skills documentais (PR26–PR29) antes de pensar em runtime de skills
permitiu auditar o design de cada skill com baixíssimo risco. Hoje as 4
skills são referência operacional usada por humanos e agentes — sem ter
custado nada de runtime.

**Como aplicar:** toda nova capacidade orientadora (skill, playbook, mode,
self-model) começa documental.

---

## 8. Backlinks

- → schema/reports/PR32_CHAT_ENGESSADO_DIAGNOSTICO.md
- → schema/reports/PR34_READONLY_TARGET_SANITIZERS_DIAGNOSTICO.md
- → schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md
- → schema/reports/PR37_PROVA_CHAT_RUNTIME_ANTI_BOT.md
- → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → brain/decisions/2026-04-30-read-only-gate-nao-tom.md
- → brain/decisions/2026-04-30-skills-documentais-antes-de-runtime.md
- → brain/decisions/2026-04-30-pr36-pr38-anti-bot-before-brain.md
- → brain/memories/recurring-patterns.md
