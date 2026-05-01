# Self-Audit Framework — Arquitetura Conceitual

> **Status:** Documental. Não implementado em runtime nesta PR.

---

## Visão geral

O Self-Audit é uma camada de reflexão que a Enavia aplica **após processar uma intenção e antes de entregar uma resposta final**. Seu papel é detectar riscos, falsa capacidade, drift contratual e ações indevidas — preservando a naturalidade da resposta quando não há problemas.

O Self-Audit **não é um prompt de auditoria visível ao usuário**. É um guardrail interno, silencioso, que sinaliza riscos para o sistema e, em casos bloqueadores, impede a resposta de avançar.

---

## Fluxo futuro

```
message
  → intent classification (enavia-intent-classifier.js)
  → skill routing (enavia-skill-router.js)
  → intent retrieval / context (enavia-intent-retrieval.js)
  → LLM Core prompt assembly (enavia-llm-core.js + enavia-cognitive-runtime.js)
  → [resposta do LLM]
  → Self-Audit read-only (enavia-self-audit.js) ← PR56
  → resposta final (com campo aditivo self_audit)
```

Este fluxo é o objetivo da PR56. Nesta PR55 apenas o contrato documental é definido.

---

## Camadas obrigatórias do Self-Audit

### Camada 1 — Auditoria de Identidade

Verifica se a resposta gerada é consistente com a identidade declarada da Enavia:
- Enavia não é um bot de atendimento simples.
- Enavia não é um sistema humano ou pessoal.
- Enavia não afirma ser algo que não é.
- Enavia não nega seus limites de forma evasiva.

**Pergunta central:** A resposta preserva quem a Enavia é?

---

### Camada 2 — Auditoria de Capacidade

Verifica se a resposta afirma capacidades reais:
- Toda capacidade afirmada deve existir no runtime atual ou estar claramente marcada como futura/documental.
- Skills documentais são mencionáveis; skills runtime precisam de confirmação de existência.
- `/skills/run` não existe — qualquer menção de execução via esse endpoint é falsa capacidade.
- Brain Loader, LLM Core, Skill Router, Intent Retrieval são read-only e documentais.

**Pergunta central:** A resposta afirma algo que o sistema realmente faz?

---

### Camada 3 — Auditoria de Intenção

Verifica se a intenção classificada é coerente com o que a resposta entrega:
- Intenção `conversation` não deve gerar resposta operacional pesada.
- Intenção `deploy` ou `execution` deve ter gate e aprovação humana.
- Frustração do usuário não deve ativar modo operacional.
- Pergunta conceitual não deve virar execução.

**Pergunta central:** A resposta bate com a intenção detectada?

---

### Camada 4 — Auditoria de Skill

Verifica o uso de skills na resposta:
- Skill mencionada é documental ou runtime?
- Se runtime, foi realmente executada?
- O campo `skill_routing` no response é honesto?
- O warning `read_only` está presente quando necessário?
- Há risco de o usuário achar que uma skill foi executada quando não foi?

**Pergunta central:** A skill foi usada corretamente e o usuário entende o que aconteceu?

---

### Camada 5 — Auditoria de Retrieval/Memória Contextual

Verifica o uso do contexto recuperado:
- O contexto de retrieval foi aplicado ou ignorado de forma intencional?
- A resposta usa informação do retrieval sem inventar dados?
- O campo `intent_retrieval` no response é honesto?
- Nenhuma "memória" foi afirmada como persistente quando só é contextual.

**Pergunta central:** A memória contextual foi usada corretamente?

---

### Camada 6 — Auditoria de Execução/Gates

Verifica se há execução indevida:
- Nenhuma escrita em KV, banco ou memória sem aprovação.
- Nenhum deploy sem workflow aprovado.
- Nenhum endpoint criado sem contrato.
- Gates de execução (`read_only`) são respeitados.
- O modo operacional pesado só é ativado com `is_operational_context=true`.

**Pergunta central:** Algo foi executado que não deveria ser?

---

### Camada 7 — Auditoria de Contrato

Verifica alinhamento com o contrato ativo:
- A ação proposta bate com a próxima PR autorizada no contrato?
- O escopo da PR não foi misturado?
- A PR anterior exigida está validada?
- `schema/contracts/INDEX.md` foi consultado?

**Pergunta central:** A ação proposta está dentro do contrato ativo?

---

### Camada 8 — Auditoria de Risco de Falsa Capacidade

Verifica afirmações que podem enganar o usuário:
- "Eu já executei" sem execução real.
- "A skill foi ativada" sem `/skills/run`.
- "O deploy foi feito" sem workflow/deploy real.
- "A memória foi salva" sem escrita confirmada.
- "O sistema está funcionando" sem verificação real.

**Pergunta central:** A resposta afirma que fez algo que não fez?

---

### Camada 9 — Auditoria de Excesso Documental

Verifica se a Enavia está gerando documentação ao invés de produto:
- Muitas PRs docs/diag consecutivas sem implementação.
- Contrato bonito sem produto funcionando.
- Avanço documental sem teste prático.
- PR opcional tratada como obrigatória.
- Resposta que é um relatório quando deveria ser uma ação.

**Pergunta central:** A resposta gera produto ou apenas documentação?

---

### Camada 10 — Auditoria de Resposta Final

Verifica a qualidade da resposta antes de entregar:
- A resposta é natural ou robótica?
- O tamanho é adequado para a intenção?
- Há checklist desnecessário onde deveria haver prosa?
- Há informação sensível exposta?
- A resposta preserva o tom humano da Enavia?

**Pergunta central:** A resposta é a melhor resposta possível dentro das restrições do sistema?

---

## Regras fundamentais do Self-Audit

1. **Self-Audit não executa.** Ele observa e sinaliza — não age por conta própria.
2. **Self-Audit não altera resposta sozinho** nesta primeira fase (PR56 será read-only + aditivo).
3. **Self-Audit sinaliza riscos** usando os níveis do `RISK_MODEL.md`.
4. **Self-Audit diferencia** erro bloqueador (`blocking`), alerta (`high`/`medium`) e observação (`low`/`none`).
5. **Self-Audit preserva naturalidade.** Não transforma a Enavia em um checklist robótico.
6. **Self-Audit não substitui revisão humana.** É uma camada de apoio, não de controle total.
7. **Self-Audit falha com segurança.** Se o módulo falhar, a resposta principal continua — apenas sem o campo `self_audit`.
