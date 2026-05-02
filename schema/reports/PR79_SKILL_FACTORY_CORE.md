# PR79 — Skill Factory Core

## Escopo

- Tipo: `PR-IMPL`
- Escopo: `Worker-only + docs/status mínimos`
- Contrato ativo: `CONTRATO_ENAVIA_SKILL_FACTORY_REAL_PR79_PR81.md`

## Entrega

- Módulo novo: `schema/enavia-skill-factory.js`
  - `buildSkillSpec(input)`
  - `validateSkillSpec(spec)`
  - `buildSkillCreationPackage(spec, options)`
- Endpoints novos:
  - `POST /skills/factory/spec`
  - `POST /skills/factory/create`
- Teste novo:
  - `tests/pr79-skill-factory-core.smoke.test.js`

## Regras cumpridas

- Sem autorização explícita: só gera `skill_spec`.
- Com autorização explícita: gera pacote PR-ready sem criar arquivo runtime.
- `risk_level=blocked` nunca gera pacote.
- Sem deploy, sem merge automático, sem execução real de skill, sem `/skills/run`.
- Sem uso de KV/banco/filesystem runtime/fetch/comando externo/LLM externo novo.

## Evidências

- `skill_spec` contém campos obrigatórios do contrato.
- `/skills/factory/spec` retorna spec e nunca pacote.
- `/skills/factory/create` bloqueia sem autorização e retorna pacote com autorização.
- Erro controlado para JSON inválido e `METHOD_NOT_ALLOWED` para GET.

## Testes

- `node tests/pr79-skill-factory-core.smoke.test.js` ✅
- Regressões PR69–PR78 + PR51/PR57/PR59 ✅

## Rollback

- `git revert <commit-da-pr79>`
