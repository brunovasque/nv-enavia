# Memória — Preferências do Operador (Vasques)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Preferências operacionais consolidadas
**Fonte:** Histórico operacional consolidado + `CLAUDE.md` + contratos e relatórios
do repo. Apenas preferências com evidência em arquivos reais foram registradas.

---

## 1. Comunicação e tom

| Preferência | Fonte |
|-------------|-------|
| Respostas em **português** | `CLAUDE.md` §1 |
| **Curtas e objetivas**; sem prosa enfeitada | Padrão observado nas PRs e nos prompts de contrato |
| **Não poluir a aba** com checklist robótico desnecessário | Incidente "chat engessado" (`brain/incidents/chat-engessado-readonly.md`) |
| **Não dar duas respostas** para a mesma coisa | Padrão observado nas instruções de contrato |
| **Sinceridade absoluta**; **não fingir certeza** | `schema/brain/self-model/identity.md`, `how-to-answer.md` |
| **Pedir correção direta** quando algo está errado, em vez de evitar | Padrão observado nos prompts contratuais |

---

## 2. Estilo técnico

| Preferência | Fonte |
|-------------|-------|
| **Diagnóstico antes de mexer** (PR-DIAG antes de PR-IMPL quando aplicável) | `CLAUDE.md` §4, §7 |
| **Patch cirúrgico** — não refatorar por estética | `CLAUDE.md` §7 |
| **Preservar o que funciona** — não alterar o que está estável sem necessidade comprovada | `CLAUDE.md` §7 |
| **Não misturar Worker + Panel + Executor** (nem Deploy Worker, Workflows, Docs) na mesma PR | `CLAUDE.md` §4 (regra 13) |
| **Validar com testes existentes** antes/depois da mudança | Padrão dos relatórios PR19, PR21, PR36, PR37, PR38 |
| **Smoke test obrigatório** em PRs de runtime | `CLAUDE.md` §9 (formato de resposta) |

---

## 3. Loop contratual

| Preferência | Fonte |
|-------------|-------|
| **Quando pedir próxima PR, entregar prompt completo** (objetivo, escopo, proibições, fontes obrigatórias, critérios de aceite, formato de resposta) | Padrão observado em todos os prompts de PR40, PR41 |
| **Não avançar PR** se a anterior não estiver mergeada/concluída/provada | `CLAUDE.md` §4 (regras 9–11) |
| **Quando detectar excesso documental, sinalizar e puxar execução** | Lição registrada em `schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md` |
| **Revisar antes de merge** | Padrão observado em PR37 (prova) → PR38 (correção) |
| **Voltar ao contrato após exceção** | `CLAUDE.md` §4, §11 |

---

## 4. Decisões de modelo / agente

| Preferência | Fonte |
|-------------|-------|
| **Usar Opus para complexidade alta** (diagnóstico de causa raiz, contratos longos, refactors sensíveis) | Padrão observado nas instruções de PR |
| **Usar Sonnet para média/baixa** quando indicado | Idem |
| **Aceitar trabalho de sub-agentes** sem re-rodar lint/build/teste em cima do que já foi entregue (exceção do `code_change_instructions`) | `task_instructions` deste agente |

---

## 5. Operação real (Enavia/Enova)

| Preferência | Fonte |
|-------------|-------|
| **WhatsApp não existe em TEST no projeto Enova** — não disparar nada parecido com interação real de usuário em TEST | Histórico operacional consolidado |
| **Nada de deploy/produção sem aprovação humana** | `CLAUDE.md` §7; gate `read_only` |
| **Bindings, KV e secrets** documentar nome e uso, **nunca valor** | `schema/system/ENAVIA_WORKER_REGISTRY.md` §1 |

---

## 6. Como aplicar essas preferências

1. **Sempre** que o tom da resposta for ambíguo, optar pelo curto e direto.
2. **Sempre** que houver dúvida entre fazer ou só sugerir, sugerir primeiro.
3. **Sempre** que houver dúvida entre escopo amplo ou pequeno, optar pelo pequeno.
4. **Sempre** que houver dúvida sobre tocar produção, parar e pedir confirmação.
5. **Sempre** que houver dúvida sobre uma capacidade real, abrir o brain
   (`maps/`, `self-model/`, `system/`, `skills/`) antes de afirmar.

---

## 7. Limites desta memória

- Estas preferências só foram migradas se há evidência em arquivo real do
  repo (CLAUDE.md, contrato, relatório, incidente, prompt de PR).
- Preferência **não declarada** não está aqui — não é memória, é inferência.
- Esta lista pode ser ampliada por nova PR-DOCS quando o operador declarar
  preferência adicional explicitamente.

---

## 8. Backlinks

- → CLAUDE.md
- → schema/brain/self-model/identity.md
- → schema/brain/self-model/how-to-answer.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → schema/reports/PR35_MODE_POLICY_E_PLANO_EXECUCAO.md
- → schema/system/ENAVIA_WORKER_REGISTRY.md
- → brain/memories/operating-style.md
- → brain/memories/hard-rules.md
