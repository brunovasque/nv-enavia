# Obsidian Brain — Política de Atualização (Update Policy)

**Versão:** 1.0
**Data:** 2026-04-30
**Estado:** Documental. Escrita automática de memória ainda não existe. Toda atualização
é manual ou por agente supervisionado.

---

## 1. Princípio

> O brain cresce com evidência, não com especulação.

Nenhuma memória é criada ou atualizada sem uma PR, um relatório ou uma declaração
explícita do operador como fonte. O brain reflete o que aconteceu — não o que
o agente acha que aconteceu.

---

## 2. Quando Criar Nova Memória

Criar novo arquivo no brain quando:

| Situação | Pasta | Exemplo |
|----------|-------|---------|
| Novo incidente documentado | `brain/incidents/` | Bug de sanitizer descoberto na PR37 |
| Nova decisão arquitetural tomada | `brain/decisions/` | Separar `read_only` de tom (PR35) |
| Novo aprendizado derivado de experiência | `brain/learnings/` | "Diagnóstico antes de implementar evita regressão" |
| Nova questão aberta identificada | `brain/open-questions/` | "Como o LLM Core vai priorizar fontes do brain?" |
| Nova preferência do operador declarada | `brain/memories/` | "Operador prefere respostas diretas sem bullet points obrigatórios" |
| Novo mapa de sistema disponível | `brain/maps/` | Mapa de workers de IA adicionado |
| Novo resumo de contrato para navegação | `brain/contracts/` | Resumo do contrato Jarvis Brain |
| Atualização significativa do self-model | `brain/self-model/` | Nova capacidade executável confirmada |

---

## 3. Quando Atualizar Memória Existente

Atualizar arquivo existente quando:

1. **Estado de incidente mudou** — foi resolvido, piorou, ou teve novo achado.
2. **Decisão foi revisada** — nova PR registra mudança de decisão anterior.
3. **Questão aberta foi respondida** — mover de `open-questions/` para `decisions/` ou `learnings/`.
4. **Mapa do sistema mudou** — nova rota, novo worker, novo endpoint.
5. **Self-model mudou** — nova capacidade ou limite confirmado.

**Regra:** Ao atualizar, sempre registrar: data da atualização, PR de referência, o que mudou.

---

## 4. Quando Criar Incidente

Criar arquivo em `brain/incidents/` quando:

- Um bug ou comportamento indesejado foi documentado em relatório de PR.
- Um teste falhou de forma significativa e a causa foi identificada.
- Uma regressão foi detectada.
- Um comportamento inesperado do sistema foi diagnosticado.

**Estrutura obrigatória de incidente:**
```
- Problema observado
- Causa diagnosticada
- PRs relacionadas
- Estado atual (resolvido / em aberto / monitorado)
- Como evitar regressão
```

---

## 5. Quando Criar Decisão

Criar arquivo em `brain/decisions/` quando:

- Uma escolha técnica ou arquitetural foi feita explicitamente em uma PR.
- Uma abordagem foi descartada em favor de outra, com justificativa documentada.
- Uma regra foi estabelecida que orienta PRs futuras.

**Estrutura obrigatória de decisão:**
```
- Contexto
- Alternativas consideradas
- Decisão tomada
- Justificativa
- PR de referência
- Impacto em PRs futuras
```

---

## 6. Quando Criar Aprendizado

Criar arquivo em `brain/learnings/` quando:

- Um padrão de sucesso se repetiu e pode ser generalizado.
- Uma falha se repetiu e o padrão de prevenção é claro.
- Um incidente gerou uma lição que transcende aquele incidente específico.

**Estrutura obrigatória de aprendizado:**
```
- Aprendizado (frase direta)
- Experiência base (incidente ou PR)
- Como aplicar
- Riscos se ignorado
```

---

## 7. Quando Registrar Open Question

Criar arquivo em `brain/open-questions/` quando:

- Uma decisão foi adiada por falta de informação.
- Uma questão técnica não tem resposta clara ainda.
- O contrato levanta uma questão não resolvida.
- Um incidente expõe uma lacuna estrutural não endereçada.

**Regra:** Open questions nunca ficam em aberto para sempre — cada uma deve ter
uma PR futura que as resolva ou as arquive como "won't fix".

---

## 8. Como Pedir Aprovação Antes de Gravar Memória

Até que o runtime supervisionado de atualização de memória exista (PR futura):

1. O agente deve propor a memória no handoff ou no relatório da PR.
2. O operador aprova ao mergear a PR.
3. Nenhuma memória é gravada sem PR aprovada e mergeada.

**Não existe escrita automática de memória nesta PR39.** Toda memória é criada
manualmente por agentes, sob revisão do operador.

---

## 9. Runtime de Update Supervisionado

O runtime de atualização supervisionada de memória está previsto para PRs futuras
do contrato Jarvis Brain. Quando implementado:

- O agente detectará intenções que exigem criação/atualização de memória.
- Propostas de memória serão geradas mas **não gravadas automaticamente**.
- O operador aprovará explicitamente antes da escrita.
- O brain nunca será modificado sem supervisão humana.

---

## 10. O Que Nunca Criar

| Proibido | Motivo |
|----------|--------|
| Memória sem fonte | Brain não especula |
| Decisão revertendo outra sem PR | Toda reversão exige registro |
| Incidente baseado em suspeita | Incidente exige evidência |
| Aprendizado contraditório ao contrato | Contrato tem precedência |
| Open question sobre algo já decidido | Criar link para a decisão existente |
