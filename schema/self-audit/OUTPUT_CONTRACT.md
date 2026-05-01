# Self-Audit Framework — Contrato de Saída

> **Status:** Documental. Define o formato de saída que o Self-Audit read-only deve produzir na PR56.
> Este contrato não está implementado nesta PR.

---

## Formato JSON de saída

```json
{
  "self_audit": {
    "applied": true,
    "mode": "read_only",
    "risk_level": "none|low|medium|high|blocking",
    "findings": [
      {
        "id": "SA-001",
        "category": "false_capability",
        "severity": "high",
        "message": "Descrição clara do problema encontrado.",
        "evidence": "Trecho ou referência que evidencia o problema.",
        "recommendation": "O que deve ser feito para mitigar ou corrigir."
      }
    ],
    "should_block": false,
    "warnings": [
      "Texto de alerta não bloqueador, se houver."
    ],
    "next_safe_action": "Descrição da próxima ação segura recomendada pelo Self-Audit."
  }
}
```

---

## Campos obrigatórios

| Campo | Tipo | Descrição |
|---|---|---|
| `self_audit.applied` | `boolean` | Indica se o Self-Audit foi aplicado nesta resposta. |
| `self_audit.mode` | `string` | Sempre `"read_only"` nesta primeira versão. |
| `self_audit.risk_level` | `string` | Nível de risco mais alto encontrado: `none`, `low`, `medium`, `high`, `blocking`. |
| `self_audit.findings` | `array` | Lista de achados. Pode ser vazia (`[]`) se não houver problemas. |
| `self_audit.should_block` | `boolean` | `true` apenas se `risk_level === "blocking"` com evidência real. |
| `self_audit.warnings` | `array` | Lista de alertas não bloqueadores. Pode ser vazia. |
| `self_audit.next_safe_action` | `string` | Próxima ação segura recomendada. Obrigatório. |

---

## Campos de um achado (`findings[]`)

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | `string` | Identificador único do achado (ex: `"SA-001"`, `"SA-002"`). |
| `category` | `string` | Categoria do risco (ver `RISK_MODEL.md`): `false_capability`, `fake_execution`, etc. |
| `severity` | `string` | Severidade do achado: `none`, `low`, `medium`, `high`, `blocking`. |
| `message` | `string` | Descrição do problema em linguagem clara. |
| `evidence` | `string` | Evidência que justifica o achado. Obrigatório para `high` e `blocking`. |
| `recommendation` | `string` | Ação recomendada para mitigar o problema. |

---

## Regras do contrato de saída

1. **Output é aditivo.** O campo `self_audit` é adicionado à resposta existente sem substituir ou remover nada.
2. **Não expor segredos.** O campo `evidence` nunca deve conter API keys, tokens, KV IDs ou dados sensíveis.
3. **Não conter chain-of-thought.** O output não deve expor raciocínio interno extenso — apenas achados e recomendações.
4. **`should_block=true` somente com evidência real.** Não bloquear por hipótese ou precaução excessiva.
5. **Não alterar resposta automaticamente nesta primeira versão.** O Self-Audit apenas sinaliza — a ação cabe ao sistema ou ao humano.
6. **Usado como guardrail, não como personalidade.** O Self-Audit não deve mudar o tom da Enavia nem torná-la mais robótica.
7. **Falha com segurança.** Se o módulo de Self-Audit falhar internamente, o campo `self_audit` é omitido mas a resposta principal continua normalmente.

---

## Exemplos de saída

### Sem problemas detectados

```json
{
  "self_audit": {
    "applied": true,
    "mode": "read_only",
    "risk_level": "none",
    "findings": [],
    "should_block": false,
    "warnings": [],
    "next_safe_action": "Resposta segura. Prosseguir normalmente."
  }
}
```

### Com alerta não bloqueador

```json
{
  "self_audit": {
    "applied": true,
    "mode": "read_only",
    "risk_level": "medium",
    "findings": [
      {
        "id": "SA-001",
        "category": "docs_over_product",
        "severity": "medium",
        "message": "Terceira PR documental consecutiva sem PR-IMPL entre elas.",
        "evidence": "PR53=IMPL, PR54=PROVA, PR55=DOCS — padrão aceitável mas próxima deve ser IMPL.",
        "recommendation": "PR56 deve ser PR-IMPL para entregar produto antes de nova documentação."
      }
    ],
    "should_block": false,
    "warnings": [
      "Verificar se PR56 é PR-IMPL conforme contrato."
    ],
    "next_safe_action": "Prosseguir com PR55. Garantir que PR56 seja PR-IMPL."
  }
}
```

### Com bloqueio

```json
{
  "self_audit": {
    "applied": true,
    "mode": "read_only",
    "risk_level": "blocking",
    "findings": [
      {
        "id": "SA-001",
        "category": "fake_execution",
        "severity": "blocking",
        "message": "A resposta afirma que o deploy foi realizado, mas não há workflow executado nem Deployment ID.",
        "evidence": "Nenhum workflow 'deploy-worker' aparece nos logs. Nenhum commit de deploy existe.",
        "recommendation": "Remover afirmação de deploy. Verificar se o workflow existe antes de afirmar execução."
      }
    ],
    "should_block": true,
    "warnings": [],
    "next_safe_action": "Parar. Verificar estado real do deploy antes de prosseguir."
  }
}
```
