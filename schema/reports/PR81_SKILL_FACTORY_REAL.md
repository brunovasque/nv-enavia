# PR81 — Skill Factory Real v1 (Fechamento ponta a ponta)

Data: 2026-05-02  
Branch: `codex/pr81-skill-factory-real-fechamento`  
Escopo: `Worker-only + Tests + Docs mínimo`

## O que existe

- `POST /skills/factory/spec` gera `skill_spec` válida e segura.
- `POST /skills/factory/create` exige autorização humana explícita e retorna pacote `PR-ready`.
- O pacote inclui: sugestão de arquivo da skill, teste, mudança de registry, checklist humano e rollback.
- O pacote **não** cria arquivo real no runtime, **não** abre PR sozinho e **não** faz deploy.
- `schema/enavia-skill-registry.js` registra skills executáveis com deny-by-default.
- `schema/enavia-skill-runner.js` executa apenas skill registrada + aprovada.
- `POST /skills/run` existe com erro controlado e retorno estruturado (`run_id`, `executed`, `side_effects`, `result`, `evidence`).
- `SYSTEM_MAPPER` está registrada e executável com `proposal_status=approved`, mantendo `side_effects=false`.
- Guardrails preservados: bloqueio para skill desconhecida, sem approval, status `proposed/rejected/blocked`, sem fetch/KV/FS runtime/comando externo/LLM novo.

## O que ainda não existe

- Skill real nova criada automaticamente no runtime.
- Merge automático, deploy automático ou push automático fora do fluxo humano.
- Execução de spec/pacote da factory diretamente em `/skills/run`.
- Execução de comando externo pelo Worker para criar skill.
- Integração de criação automática de PR no GitHub externo nesta fase.

## Declaração explícita

- A skill `SELF_WORKER_AUDITOR` **ainda não foi criada** nesta PR.

## Como autorizar criação de skill

1. Enviar pedido humano para `POST /skills/factory/spec`.
2. Revisar `skill_spec` (riscos, arquivos, testes, registry).
3. Enviar `POST /skills/factory/create` com:
   - `approved_to_prepare_package=true`
   - `human_authorization_text` não vazio.
4. Aplicar o pacote no repo via revisão humana e PR humana.
5. Após merge/deploy humano, registrar/rodar via runtime governado.

## Dependências de merge/deploy

- A criação da skill permanece em modo pacote/PR-ready; a skill só existe em runtime após integração humana no código e deploy humano.

## Próxima recomendação

- Próxima skill recomendada: `SELF_WORKER_AUDITOR` (contrato dedicado, com escopo supervisionado e guardrails mantidos).
