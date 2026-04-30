# Memória — Regras Duras (hard rules)

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Regras inegociáveis — só reversíveis por nova PR-DOCS aprovada pelo operador.

---

## 1. Regras de escopo de PR

- **Não alterar runtime em PR-DOCS ou PR-DIAG.** Estas PRs são puramente
  documentais ou de leitura. Tocar runtime aqui é violação de contrato.
- **Não avançar para a próxima PR se a prova falhar.** PR-PROVA com qualquer
  achado bloqueia até correção.
- **Não mascarar teste.** Se um smoke ou regressão falha, registrar e corrigir;
  jamais comentar, ignorar ou desabilitar para passar.
- **Não criar contrato novo se o contrato atual basta.** Mudança de contrato
  é evento explícito, não atalho.
- **Não misturar escopos.** Worker / Panel / Executor / Deploy Worker /
  Workflows / Docs nunca na mesma PR.

---

## 2. Regras de honestidade técnica

- **Não inventar rota, worker, binding ou secret.** Se não está no registry,
  não existe para a Enavia.
- **Não registrar valor de secret** em nenhum arquivo do repo (brain, schema,
  relatório, comentário). Apenas nome e uso.
- **Não inventar memória.** Toda entrada do brain precisa de fonte: PR,
  relatório, contrato, incidente, declaração explícita do operador.
- **Não registrar como fato algo sem fonte.** Marcar como hipótese ou
  incerto e declarar a lacuna.

---

## 3. Regras de execução real

- **Não executar produção sem aprovação humana.** Mesmo com gate `read_only`
  desligado, qualquer ação com efeito colateral irreversível exige aprovação.
- **`read_only` é gate de execução, não tom.** Esta é uma regra dura confirmada
  por PR35/PR36/PR38. Reaplicar `read_only` como tom é regressão.
- **`isOperationalMessage` exige termos compostos.** Termos isolados como
  "sistema" ou "contrato" não ativam contexto operacional. Termos compostos
  ("estado do contrato", "contrato ativo", "runtime", "gate") sim. Verbos
  imperativos ("revise", "verifique", "cheque", "inspecione") sim.
- **Sanitizers preservam prosa natural útil.** Bloqueiam apenas snapshot
  JSON-like do planner. Bloquear prosa genérica de novo é regressão.

---

## 4. Regras de comunicação

- **Se algo é opcional, dizer:** "Isso é opcional. Não mexa agora."
- **Se houver exceção** ao contrato, corrigir, provar e voltar ao contrato.
  Não normalizar exceção.
- **Sinceridade absoluta.** Não inflar resultado, não esconder achado, não
  fingir certeza.
- **Resposta canônica final** sempre no formato `WORKFLOW_ACK: ok` ou
  `WORKFLOW_ACK: bloqueado` (ver `CLAUDE.md` §9).

---

## 5. Regras de governança

- **Toda PR atualiza:** `schema/status/ENAVIA_STATUS_ATUAL.md`,
  `schema/handoffs/ENAVIA_LATEST_HANDOFF.md`,
  `schema/execution/ENAVIA_EXECUTION_LOG.md`. PR sem esses três updates está
  incompleta.
- **`schema/contracts/INDEX.md` é atualizado** sempre que houver mudança
  de fase, estado ou contrato.
- **Contratos encerrados não são editados.** Apenas referenciados.
- **Brain não substitui contrato.** Em conflito, o contrato ativo prevalece.

---

## 6. Regras de runtime já corrigidas (não regredir)

| Item | PR de origem | Não regredir |
|------|-------------|---------------|
| `read_only` separado de tom | PR35 / PR36 | Sim |
| `MODO OPERACIONAL ATIVO` só com `is_operational_context=true` | PR38 | Sim |
| Termos compostos em `isOperationalMessage` | PR38 | Sim |
| Sanitizer preserva prosa natural útil | PR36 | Sim |
| Snapshot JSON-like do planner continua bloqueado | PR36 | Sim (manter bloqueio) |
| Telemetria `sanitization: {applied, layer, reason}` no `/chat/run` | PR36 | Manter (campo aditivo) |

---

## 7. Backlinks

- → CLAUDE.md
- → schema/policies/MODE_POLICY.md
- → schema/brain/MEMORY_RULES.md
- → schema/brain/incidents/chat-engessado-readonly.md
- → schema/reports/PR36_IMPL_CHAT_RUNTIME_REPORT.md
- → schema/reports/PR38_IMPL_CORRECAO_ACHADOS_PR37.md
- → brain/memories/operator-preferences.md
- → brain/memories/operating-style.md
- → brain/decisions/INDEX.md
