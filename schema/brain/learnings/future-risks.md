# Aprendizado — Riscos Futuros

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Tipo:** Riscos identificados que podem se materializar em PRs futuras se
não forem mitigados.

---

## 1. Brain virar docs sem runtime

O Obsidian Brain pode crescer indefinidamente como documentação navegável
sem nunca ser conectado ao runtime. O resultado seria: ótima fonte de
leitura para humanos, zero impacto na Enavia operacional.

**Mitigação:** o contrato Jarvis Brain prevê PR42+ para diagnóstico da memória
runtime e PRs subsequentes para conexão. Não permitir o brain crescer sem
plano concreto de integração.

---

## 2. LLM Core nascer fraco

Quando o LLM Core for implementado (frente futura do contrato), há risco
de ele nascer com prompt monolítico, sem usar o brain como contexto
estruturado, ou com gates implícitos no prompt em vez de explícitos na
camada de execução.

**Mitigação:** reler `brain/decisions/2026-04-30-jarvis-brain-llm-first.md`
e `schema/policies/MODE_POLICY.md` antes de qualquer PR-IMPL do LLM Core.
Sequência canônica: PR-DIAG do prompt atual → PR-DOCS do design do LLM
Core → PR-IMPL → PR-PROVA.

---

## 3. Retrieval trazer memória errada

Quando houver retrieval automático do brain pelo LLM Core, o ranking pode
trazer memórias irrelevantes ou contraditórias entre si, levando a
respostas confusas.

**Mitigação:** `schema/brain/RETRIEVAL_POLICY.md` define a política inicial.
PRs de retrieval precisam de PR-PROVA com casos canônicos (intenção →
arquivos esperados).

---

## 4. Contexto ficar caro demais

Brain populado tem hoje várias dezenas de arquivos. Se o LLM Core injetar
tudo a cada chamada, custo e latência sobem rápido.

**Mitigação:** retrieval por intenção + limite de tokens explícito + cache
quando aplicável. Decisão será registrada em `brain/decisions/` quando o
runtime de retrieval for implementado.

---

## 5. Self-model ficar desatualizado

`schema/brain/self-model/` (PR40) reflete o estado pós-PR40. Se a Enavia
ganhar capacidade real (Brain conectado, LLM Core, Skill Router) e o
self-model não for atualizado, ela passa a se descrever errado.

**Mitigação:** `schema/brain/UPDATE_POLICY.md` deve ser referência sempre
que houver mudança de capacidade. Toda PR que muda runtime cognitivo
**deve** atualizar self-model na mesma frente.

---

## 6. Skills executarem sem governança

Se o Runtime de Skills for criado (`brain/contracts/next-candidates.md`
§1.1) sem gate robusto, uma skill mal projetada pode disparar efeito
colateral em produção.

**Mitigação:** Runtime de Skills só pode ser construído depois de:
(a) Mode Policy estável, (b) gate `read_only` validado também no novo
endpoint, (c) PR-PROVA específica de skill router. Deploy Governance
Operator obrigatório no design.

---

## 7. Excesso documental voltar

Padrão recorrente já documentado (`brain/memories/recurring-patterns.md`
§1). Pode reaparecer especialmente em fases de design (Brain, LLM Core,
Skill Router).

**Mitigação:** intercalar PR-IMPL/PR-PROVA com PR-DOCS; sinalizar quando
o ritmo documental estiver alto demais; recusar criar arquivo sem
propósito operacional.

---

## 8. Alucinação sobre capacidades

Risco transversal: a Enavia (ou agentes que a operam) afirmarem capacidades
que não existem ("já tenho Skill Router", "já consulto o brain
automaticamente", "já tenho memória persistente entre sessões").

**Mitigação:** `schema/brain/SYSTEM_AWARENESS.md` §7 + `self-model/limitations.md`
+ `self-model/capabilities.md`. Sempre marcar incerto quando não houver
fonte. Sempre usar tempo verbal correto ("ainda não existe", "será criado
em PR futura").

---

## 9. Brain divergindo do runtime sem ninguém perceber

Mesmo com governança, é possível que uma PR-IMPL altere comportamento sem
atualizar brain (ou vice-versa). Quanto mais o brain crescer, mais alto
fica esse risco.

**Mitigação:** UPDATE_POLICY já prevê que toda PR que muda runtime
cognitivo atualiza brain. Auditoria periódica via Contract Auditor +
System Mapper. Quando suspeito, abrir PR-DIAG comparando documentação ↔
código.

---

## 10. Backlinks

- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → schema/brain/RETRIEVAL_POLICY.md
- → schema/brain/UPDATE_POLICY.md
- → schema/brain/SYSTEM_AWARENESS.md
- → schema/brain/self-model/capabilities.md
- → schema/brain/self-model/limitations.md
- → schema/policies/MODE_POLICY.md
- → brain/contracts/next-candidates.md
- → brain/memories/recurring-patterns.md
- → brain/learnings/what-failed.md
- → brain/open-questions/unresolved-technical-gaps.md
- → brain/open-questions/strategic-questions.md
