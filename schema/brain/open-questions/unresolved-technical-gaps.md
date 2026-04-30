# Questões abertas — Lacunas técnicas não resolvidas

**Versão:** 1.0
**Data:** 2026-04-30
**PR de referência:** PR41
**Estado:** Lacunas reais, sem solução implementada nem decidida.

---

## 1. Como o Brain Loader vai carregar arquivos

**Estado:** Aberta
**Impacto:** Alto — define design do LLM Core.

Ainda não existe um Brain Loader. Quando ele for criado, precisará decidir:

- Ler do disco do worker? Bundle no deploy? Servir via KV?
- Carregar tudo no startup ou sob demanda por intenção?
- Cachear o quê, por quanto tempo, com que invalidação?

**Próxima ação sugerida:** PR-DIAG depois de PR42 (que diagnostica memória
runtime atual) para mapear opções e custos.

---

## 2. Como limitar contexto enviado ao LLM Core

**Estado:** Aberta
**Impacto:** Alto — afeta custo, latência e qualidade da resposta.

O brain populado tem dezenas de arquivos. Mandar tudo a cada chamada do LLM
é inviável. Precisa decidir:

- Limite por tokens? Por número de arquivos? Por relevância?
- Estratégia de truncamento — preservar headers? sumarizar?
- Como medir relevância sem retrieval semântico ainda?

**Próxima ação sugerida:** PR-DOCS de design de retrieval junto da PR de
LLM Core.

---

## 3. Como ranquear memórias quando intenção for ambígua

**Estado:** Aberta
**Impacto:** Médio — afeta precisão do retrieval.

`schema/brain/RETRIEVAL_POLICY.md` define ordem por intenção, mas há casos
em que a intenção é ambígua (ex: "como vai o sistema?" pode ser
`status` ou `diagnosis`).

**Próxima ação sugerida:** registrar os casos ambíguos como sub-questões
quando aparecerem; iterar a Retrieval Policy.

---

## 4. Como atualizar Brain após PR

**Estado:** Aberta parcialmente
**Impacto:** Médio — sustenta consistência brain ↔ runtime.

`schema/brain/UPDATE_POLICY.md` define quando atualizar. Faltam:

- Quem é o responsável: agente que abriu a PR? Operador? Auditor?
- Como detectar que uma PR alterou runtime cognitivo e exige update do
  self-model / decisões / mapas?
- Como evitar update redundante (várias PRs tocando o mesmo arquivo do brain).

**Próxima ação sugerida:** Memory Update Supervision (candidato em
`brain/contracts/next-candidates.md` §1.7), em contrato futuro.

---

## 5. Como validar divergência docs ↔ runtime

**Estado:** Aberta
**Impacto:** Médio — risco crônico de alucinação por documentação obsoleta.

Hoje a divergência é detectada apenas por inspeção humana ou PR-DIAG ad-hoc.
Falta:

- Mecanismo de check periódico (CI? worker?).
- Sinalização automática quando documentação contradiz código.

**Próxima ação sugerida:** candidato Auditoria automática de PR
(`brain/contracts/next-candidates.md` §1.4).

---

## 6. Como conectar LLM Core sem quebrar segurança

**Estado:** Aberta
**Impacto:** Alto — toca produção, gates, autorização.

Quando o LLM Core for ligado ao runtime:

- O gate `read_only` continua na camada de execução (sem regressão).
- Como garantir que o LLM não emita instrução de execução por engano?
- Como isolar contexto sensível (secrets, IDs internos) do prompt?

**Próxima ação sugerida:** PR-DOCS de design de segurança do LLM Core
**antes** de qualquer PR-IMPL.

---

## 7. Como evitar custo alto no LLM Core

**Estado:** Aberta
**Impacto:** Médio/Alto — sustentabilidade financeira.

Sem retrieval inteligente, contexto inflado e número de chamadas
descontrolado podem fazer o custo subir rápido.

**Próxima ação sugerida:** definir orçamento por endpoint e telemetria de
tokens antes de PR-IMPL do LLM Core.

---

## 8. Como logar retrieval de forma auditável

**Estado:** Aberta
**Impacto:** Médio — auditoria, depuração, prova.

Quando o retrieval for runtime, cada resposta deve ser rastreável: que
arquivos do brain foram consultados, em que ordem, com que peso.

**Próxima ação sugerida:** decisão de logging junto da PR-IMPL do
retrieval, possivelmente espelhando o padrão `sanitization: {applied,
layer, reason}` de PR36.

---

## 9. Backlinks

- → schema/brain/RETRIEVAL_POLICY.md
- → schema/brain/UPDATE_POLICY.md
- → schema/brain/MEMORY_RULES.md
- → schema/brain/SYSTEM_AWARENESS.md
- → schema/contracts/active/CONTRATO_ENAVIA_JARVIS_BRAIN_PR31_PR60.md
- → brain/contracts/next-candidates.md
- → brain/learnings/future-risks.md
- → brain/open-questions/strategic-questions.md
