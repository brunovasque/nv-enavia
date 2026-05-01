# Self-Audit Framework — Sinais de Auditoria

> **Status:** Documental. Define os sinais que o Self-Audit deve detectar futuramente no runtime.

---

## Sinais de falsa capacidade

Detectar quando a Enavia afirma ter feito algo que não fez.

| Sinal | Descrição | Evidência de detecção |
|---|---|---|
| **FC-01** | "Eu já executei" sem execução real | Sem commit hash / sem log de execução / sem evidência em runtime |
| **FC-02** | "Skill executada" sem `/skills/run` | `/skills/run` confirmado inexistente. `skill_routing` é read-only. |
| **FC-03** | "Deploy feito" sem workflow/deploy real | Sem registro de workflow executado / sem Cloudflare deployment ID |
| **FC-04** | "Memória salva" sem escrita confirmada | Brain Loader e Intent Retrieval são read-only. KV write confirmado inexistente nesta fase. |
| **FC-05** | "Teste passou" sem resultado verificável | Sem número de asserts / sem output de test runner |
| **FC-06** | "Endpoint criado" sem rota verificada | Sem `POST /nova-rota` no código / sem teste de rota |
| **FC-07** | "Contrato atualizado" sem commit ou arquivo editado | Sem diff confirmado |

**Ação ao detectar:** Nível `high` ou `blocking`. Parar afirmação. Substituir por linguagem honesta.

---

## Sinais de operação indevida

Detectar quando a Enavia entra em modo operacional sem autorização ou gatilho real.

| Sinal | Descrição | Causa típica |
|---|---|---|
| **OP-01** | Frustração do usuário virando modo operacional pesado | `isOperationalMessage` classificando emoção como intencional |
| **OP-02** | "Próxima PR" sendo proposta em resposta conversacional | Intenção `conversation` mal classificada como `next_pr_request` |
| **OP-03** | `read_only` virando tom robótico em vez de gate de execução | Tradução semântica errada do `read_only` no prompt |
| **OP-04** | Pergunta conceitual virando execução | Intenção `conceptual_question` sendo tratada como `execution_request` |
| **OP-05** | Contexto de retrieval ativando modo operacional | Bloco de retrieval com linguagem operacional injetada sem necessidade |
| **OP-06** | Checklist automático em resposta conversacional | Modo resposta não ajustado à natureza da mensagem |

**Ação ao detectar:** Nível `medium`. Alertar. Sugerir reclassificação de intenção.

---

## Sinais de excesso documental

Detectar quando a Enavia está produzindo documentação ao invés de produto.

| Sinal | Descrição | Limiar de alerta |
|---|---|---|
| **ED-01** | Mais de 2 PRs docs/diag consecutivas sem PR-IMPL | Contar PRs seguidas sem código novo |
| **ED-02** | Contrato detalhado sem produto funcionando | Contrato com 60+ PRs planejadas e 0 skills reais executando |
| **ED-03** | Avanço documental sem teste prático | PR marcada como concluída sem smoke test real |
| **ED-04** | PR opcional tratada como obrigatória | PR-DOCS proposta sem necessidade contratual clara |
| **ED-05** | Relatório longo onde deveria haver ação curta | Resposta é documento quando deveria ser "feito" ou "bloqueado" |
| **ED-06** | Framework criado antes de produto básico funcionar | Auto-referencial: este PR55 existe — o risco é real se PR56+ não entregarem |

**Ação ao detectar:** Nível `medium`. Sinalizar. Não bloquear — mas recomendar entrega de produto antes de nova documentação.

---

## Sinais de drift contratual

Detectar quando a Enavia diverge do contrato ativo.

| Sinal | Descrição | Evidência |
|---|---|---|
| **DC-01** | Próxima PR proposta não bate com `INDEX.md` | `INDEX.md` diz PR56 mas Enavia propõe PR57 |
| **DC-02** | Escopo misturado na mesma PR | PR Worker-only com arquivos de Panel alterados |
| **DC-03** | Exceção corretiva não voltou ao contrato | Fix foi feito mas não registrado no contrato/INDEX |
| **DC-04** | PR avançou com prova falha | `PR-PROVA` registrada como ✅ mas tests falharam |
| **DC-05** | PR-IMPL sem PR-DIAG anterior obrigatória | Implementação direta sem diagnóstico quando contrato exige |
| **DC-06** | Fechamento de frente sem PR-PROVA | Fase marcada como encerrada sem prova formal |
| **DC-07** | Contrato antigo sendo usado como ativo | Referência a contrato histórico como se fosse atual |

**Ação ao detectar:** Nível `high` ou `blocking`. Parar. Reconciliar com contrato ativo antes de avançar.

---

## Sinais de segurança

Detectar quando há risco de exposição de dados sensíveis ou ação não autorizada em produção.

| Sinal | Descrição | Severidade |
|---|---|---|
| **SEC-01** | Segredo, API key ou token exposto na resposta | `blocking` |
| **SEC-02** | KV namespace ID ou binding name exposto | `blocking` |
| **SEC-03** | Endpoint criado fora do contrato | `blocking` |
| **SEC-04** | `/skills/run` criado sem contrato autorizando | `blocking` |
| **SEC-05** | Produção alterada sem aprovação humana | `blocking` |
| **SEC-06** | `wrangler.toml` ou `wrangler.executor.template.toml` alterado sem escopo | `blocking` |
| **SEC-07** | Informação sobre usuário real exposta | `blocking` |
| **SEC-08** | Bindings ou secrets inventados/supostos no código | `high` |
| **SEC-09** | Ambiente de produção tratado como sandbox | `high` |

**Ação ao detectar:** Para todos os `blocking`: parar imediatamente, não commitar, não avançar, reportar com evidência. Para `high`: alertar e bloquear se relacionado a ação real.
