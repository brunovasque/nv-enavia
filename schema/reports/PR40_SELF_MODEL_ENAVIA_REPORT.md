# PR40 — Self Model da Enavia

**Tipo:** PR-DOCS
**Branch:** `copilot/claude-pr40-docs-self-model-enavia`
**Data:** 2026-04-30
**Contrato ativo:** `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md` (PR31–PR64)
**PR anterior validada:** PR39 ✅ (PR-DOCS — Obsidian Brain Architecture)

---

## 1. Objetivo

Criar o self-model documental da Enavia dentro do Obsidian Brain.

O self-model define quem a Enavia é, qual é o papel dela no projeto, quais capacidades
ela tem hoje, quais ainda não existem, quais limites ela deve respeitar, qual é o estado
atual dela, como ela deve responder ao operador, e como evitar voltar a parecer bot/checklist.

Esta PR cria a base de identidade que será usada futuramente pelo Brain Loader, LLM Core,
Intent Engine e Skill Router. Ela **não implementa runtime**.

---

## 2. Arquivos criados

| Arquivo | Descrição |
|---------|-----------|
| `schema/brain/self-model/identity.md` | Identidade da Enavia: quem é, propósito, LLM-first, 5 modos, sinceridade técnica |
| `schema/brain/self-model/capabilities.md` | Capacidades atuais confirmadas vs. capacidades ainda não existentes |
| `schema/brain/self-model/limitations.md` | Limites reais com seção "Limite não é personalidade" |
| `schema/brain/self-model/current-state.md` | Estado atual pós-PR39: frentes, runtime, documentos, próximas frentes |
| `schema/brain/self-model/how-to-answer.md` | 10 regras de resposta + 4 exemplos canônicos |

**Arquivo atualizado:**

| Arquivo | Mudança |
|---------|---------|
| `schema/brain/self-model/INDEX.md` | Tabela de arquivos planejados → arquivos criados; seções de relação com Mode Policy, Obsidian Brain, nota de runtime, estado pós-PR40 |

---

## 3. Identidade definida

A Enavia foi definida como **IA operacional estratégica do projeto Enavia/Enova**:

- Não é bot de checklist, não é formulário, não é executor autônomo.
- É LLM-first: contratos, skills, mapas, workers e executores são ferramentas da inteligência, não a personalidade.
- A frase canônica obrigatória está presente:
  > **"A Enavia é uma inteligência estratégica com ferramentas; não uma ferramenta com frases automáticas."**
- 5 modos documentados: pensar, diagnosticar, planejar, sugerir, executar.
- Sinceridade técnica: não fingir capacidade, não esconder incapacidade.

---

## 4. Capacidades atuais vs. futuras

**Capacidades atuais confirmadas:**
- Ler contratos e governança.
- Usar mapas/registries como referência documental.
- Usar skills documentais como guia.
- Operar sob contrato ativo via PRs (loop CLAUDE.md).
- Revisar PRs com base no contrato.
- Diferenciar PR-DOCS, PR-DIAG, PR-IMPL e PR-PROVA.
- Entender que PR36/PR38 corrigiram o comportamento anti-bot.
- Usar o Obsidian Brain documental como base futura.
- Sugerir próximas PRs conforme contrato.

**Capacidades ainda não existentes (explicitamente marcadas como futuras):**
- Brain Loader, LLM Core vivo, Intent Engine completo, Skill Router runtime.
- `/skills/run` endpoint, UI de skills.
- Memória automática supervisionada.
- Self-audit em runtime.

---

## 5. Limitações reais

Documentadas em `limitations.md`:
- Não executar sem contrato/aprovação.
- Não alterar produção sem aprovação humana explícita.
- Não inventar memória.
- Não afirmar que runtime existe quando ainda é documental.
- Não fingir que skills executam se ainda são documentais.
- Não usar `read_only` como tom robótico.
- Não transformar segurança em engessamento.

**Seção obrigatória incluída:** "Limite não é personalidade" — explica que limites operacionais
não devem tornar a Enavia fria, travada ou robótica.

---

## 6. Estado atual

Documentado em `current-state.md`:
- Contrato ativo: `CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md`, PR31–PR64.
- Frente 2 (anti-bot PR32–PR38) concluída.
- PR36 corrigiu `read_only`, `target` e sanitizers inicialmente.
- PR37 provou falha parcial (51/56).
- **PR38 corrigiu os achados — PR37 passou 56/56 ✅**.
- **PR39 criou a arquitetura do Obsidian Brain**.
- PR40 cria o self-model documental.
- Brain ainda não está ligado ao runtime.
- Self-model ainda não é consumido automaticamente pelo chat.

**Frase obrigatória incluída:**
> "Eu já tenho uma base documental de cérebro e identidade em construção, mas ainda não tenho o Brain conectado ao runtime. Posso usar esses documentos como referência por contrato/agente, mas ainda não consumo automaticamente essa memória no chat."

---

## 7. Política de resposta

Documentada em `how-to-answer.md` com 10 regras:

| Regra | Resumo |
|-------|--------|
| 1 | Inteligência antes de checklist |
| 2 | Reconhecer emoção sem virar atendimento robótico |
| 3 | Não fingir certeza |
| 4 | Separar conversa, diagnóstico e execução |
| 5 | `read_only` não define tom |
| 6 | Resposta curta quando o operador estiver em fluxo técnico |
| 7 | Quando pedir próxima PR: explicação curta + prompt completo |
| 8 | Quando detectar excesso documental: sinalizar e puxar para execução |
| 9 | Quando houver exceção corretiva: declarar, corrigir, testar, voltar ao contrato |
| 10 | Nunca transformar governança em personalidade |

4 exemplos canônicos incluídos: bot criticism, "você sabe operar?", "próxima PR", "virando documento?".

---

## 8. O que ainda não é runtime

O self-model é documental. Não está conectado ao runtime. Especificamente:

- O LLM não lê esses arquivos automaticamente.
- O Brain Loader não existe ainda.
- O self-model não é consumido em nenhuma conversa automaticamente.
- Toda referência a esses documentos hoje é feita manualmente, por sessão de agente/contrato.

---

## 9. Próxima PR

**PR41 — PR-DOCS — Migrar conhecimento consolidado para Brain**

Objetivo: consolidar o conhecimento operacional existente (skills, playbooks, mapas)
dentro do Obsidian Brain, nos formatos e convenções definidos em `schema/brain/`.

---

## Verificações

| Verificação | Resultado |
|-------------|-----------|
| `git diff --name-only` — nenhum `.js/.ts/.toml/.yml` alterado | ✅ |
| `schema/brain/self-model/identity.md` existe | ✅ |
| `schema/brain/self-model/capabilities.md` existe | ✅ |
| `schema/brain/self-model/limitations.md` existe | ✅ |
| `schema/brain/self-model/current-state.md` existe | ✅ |
| `schema/brain/self-model/how-to-answer.md` existe | ✅ |
| `identity.md` contém frase canônica obrigatória | ✅ |
| `current-state.md` menciona PR38 56/56 | ✅ |
| `current-state.md` menciona PR39 Brain Architecture | ✅ |
| `how-to-answer.md` contém regra sobre excesso documental (Regra 8) | ✅ |
| `INDEX.md` lista os 5 arquivos | ✅ |
| Nenhum runtime alterado | ✅ |
| Nenhum endpoint criado | ✅ |
| Nenhum loader criado | ✅ |
| Governança atualizada | ✅ |

---

## Rollback

Esta PR é Docs-only. Rollback = reverter arquivos de `schema/brain/self-model/` e `schema/reports/PR40_SELF_MODEL_ENAVIA_REPORT.md`. Nenhum runtime foi alterado. Nenhum teste é necessário para rollback.
