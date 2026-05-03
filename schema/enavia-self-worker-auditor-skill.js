// ============================================================================
// 🔍 ENAVIA — SELF_WORKER_AUDITOR Skill (PR82)
//
// Skill read-only de autoauditoria do Worker/repo.
// Sem I/O externo, sem KV, sem filesystem runtime, sem fetch, sem LLM externo.
// Retorna diagnóstico estruturado, pequeno e determinístico.
// ============================================================================

export const SELF_WORKER_AUDITOR_SKILL_ID = "SELF_WORKER_AUDITOR";
export const SELF_WORKER_AUDITOR_MODE = "read_only";

const VALID_SEVERITIES = new Set(["critical", "high", "medium", "low", "info"]);
const VALID_CATEGORIES = new Set([
  "security",
  "telemetry",
  "deploy_loop",
  "chat_rigidity",
  "tests",
  "governance",
]);

function _asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _normalizeProposalStatus(input) {
  const root = _asObject(input);
  const approval = _asObject(root.approval);
  const fromRoot = _asString(root.proposal_status || root.proposalStatus).toLowerCase();
  const fromApproval = _asString(
    approval.status || approval.proposal_status,
  ).toLowerCase();
  return fromRoot || fromApproval || "unknown";
}

// ----------------------------------------------------------------------------
// Snapshot estático de achados — baseado no diagnóstico do repo até PR81.
// NÃO usa filesystem runtime, NÃO faz fetch, NÃO lê arquivos em tempo de execução.
// ----------------------------------------------------------------------------
function _buildFindings() {
  return [
    {
      id: "S1",
      severity: "high",
      category: "security",
      title: "Endpoints públicos sem rate limiting explícito",
      evidence:
        "nv-enavia.js expõe /chat/run, /skills/propose, /skills/run sem middleware de rate limit. Cloudflare Workers pode ter limites de plataforma, mas não há controle aplicacional documentado.",
      recommendation:
        "Implementar contagem de requisições por IP/session em memória ou via CF limit rules antes de PR85.",
    },
    {
      id: "S2",
      severity: "medium",
      category: "security",
      title: "Mensagens de erro podem expor detalhes internos",
      evidence:
        "Bloqueios do runner e do approval gate retornam campos 'detail' e 'errors' que descrevem lógica interna (ex: 'blocked:proposal_status:proposed'). Em produção, detalhes operacionais devem ser reduzidos ao mínimo exposto.",
      recommendation:
        "Criar campo 'internal_detail' (não serializado para o cliente) e retornar apenas código de erro e mensagem genérica.",
    },
    {
      id: "T1",
      severity: "high",
      category: "telemetry",
      title: "Ausência de telemetria estruturada nos endpoints",
      evidence:
        "Nenhum dos handlers em nv-enavia.js emite logs estruturados (JSON) por request. Não há campos de latência, run_id de request, skill_id, nem status de resposta nos logs.",
      recommendation:
        "Adicionar log estruturado mínimo por request: {timestamp, path, status_code, run_id, latency_ms} usando console.log(JSON.stringify(...)). Não requer binding extra.",
    },
    {
      id: "T2",
      severity: "medium",
      category: "telemetry",
      title: "run_id do skill runner não é propagado para a resposta HTTP",
      evidence:
        "schema/enavia-skill-runner.js gera run_id no resultado, mas nv-enavia.js não o inclui no body HTTP de /skills/run de forma padronizada.",
      recommendation:
        "Garantir que run_id apareça sempre no body de resposta de /skills/run para rastreabilidade.",
    },
    {
      id: "D1",
      severity: "high",
      category: "deploy_loop",
      title: "Loop de deploy incompleto — falta caminho test→promote→prod",
      evidence:
        "wrangler.toml e workflows existentes configuram deploy básico, mas o fluxo pedido→plano→aprovação→deploy/test→prova→promote/prod não está automatizado nem documentado como testável ponta a ponta.",
      recommendation:
        "PR83 deve diagnosticar e completar o loop: definir fluxo canônico, criar smoke test do caminho deploy/test/rollback.",
    },
    {
      id: "D2",
      severity: "medium",
      category: "deploy_loop",
      title: "Rollback de deploy não documentado como ação ativável",
      evidence:
        "schema/execution/ENAVIA_EXECUTION_LOG.md menciona rollback conceitualmente em PR80/PR81, mas não existe um runbook ativo com comando/passo claro para reverter um deploy falho.",
      recommendation:
        "PR83 deve criar runbook de rollback com passos verificáveis e smoke test de rollback.",
    },
    {
      id: "C1",
      severity: "high",
      category: "chat_rigidity",
      title: "Tom do chat excessivamente robótico e formal",
      evidence:
        "Diagnóstico PR32/PR34 documentou que o sistema prompt traduz read_only como regra de tom e sanitizadores pós-LLM substituem respostas vivas por frases fixas. Problema persiste como debt técnico até PR84.",
      recommendation:
        "PR84 deve ajustar camada de resposta/policy/cognitive runtime de forma cirúrgica para reduzir engessamento sem remover guardrails.",
    },
    {
      id: "C2",
      severity: "medium",
      category: "chat_rigidity",
      title: "Prompt do sistema carregado de regras contratuais expostas ao LLM",
      evidence:
        "schema/enavia-cognitive-runtime.js injeta seções de governança e contrato diretamente no system prompt. O LLM responde como auditor em vez de assistente conversacional.",
      recommendation:
        "PR84 deve separar regras de bloqueio (imutáveis) de tom/contexto (ajustável), reduzindo ruído contratual no system prompt.",
    },
    {
      id: "TE1",
      severity: "medium",
      category: "tests",
      title: "Cobertura de teste de /skills/run para novas skills não garantida",
      evidence:
        "tests/pr80-skill-registry-runner.smoke.test.js cobre SYSTEM_MAPPER. Skills novas (ex: SELF_WORKER_AUDITOR) exigem teste próprio. O runner retorna SKILL_RUNNER_NOT_IMPLEMENTED para skills sem handler — risco de falha silenciosa.",
      recommendation:
        "Criar teste pr82-self-worker-auditor.smoke.test.js cobrindo todos os cenários obrigatórios do contrato.",
    },
    {
      id: "G1",
      severity: "low",
      category: "governance",
      title: "Atualização de governança (STATUS/HANDOFF/LOG) é manual",
      evidence:
        "CLAUDE.md seção 6 exige atualização manual dos 3 arquivos de governança ao final de cada PR. Não há mecanismo automatizado para detectar quando estão desatualizados.",
      recommendation:
        "Futuramente criar skill GOVERNANCE_AUDITOR para verificar coerência entre contrato ativo, status e handoff.",
    },
  ];
}

function _buildPriorityActions() {
  return [
    {
      target_pr: "PR83",
      action: "Diagnosticar e completar o loop de deploy real",
      reason:
        "Achados D1/D2 mostram que o fluxo deploy/test/rollback está incompleto. PR83 deve criar caminho verificável ponta a ponta.",
    },
    {
      target_pr: "PR84",
      action: "Corrigir engessamento do chat — ajuste cirúrgico na camada de resposta/policy",
      reason:
        "Achados C1/C2 confirmam dívida técnica conhecida desde PR32/PR34. PR84 deve reduzir tom robótico sem remover guardrails.",
    },
    {
      target_pr: "future",
      action: "Adicionar telemetria estruturada por request em nv-enavia.js",
      reason:
        "Achados T1/T2 indicam ausência de logs rastreáveis. Sem telemetria, debugging em produção é cego.",
    },
    {
      target_pr: "future",
      action: "Implementar rate limiting aplicacional nos endpoints públicos",
      reason:
        "Achado S1 aponta ausência de controle de taxa. Proteção de plataforma (CF) é necessária mas não substitui controle aplicacional.",
    },
    {
      target_pr: "future",
      action: "Reduzir detalhes internos retornados em respostas de erro",
      reason:
        "Achado S2 — mensagens de erro com lógica interna são surface de ataque e debugging desnecessário para o cliente.",
    },
  ];
}

function _buildSafetyNotes() {
  return [
    "SELF_WORKER_AUDITOR é read-only. Nenhum arquivo foi alterado, nenhuma variável de runtime foi modificada.",
    "Diagnóstico baseado em snapshot estático do repo — não usa filesystem runtime, fetch ou KV.",
    "Achados são informativos. Correção exige nova PR com aprovação humana.",
    "Forbidden effects aplicados: deploy_automatico, merge_automatico, producao_direta, browser_action, acesso_credenciais_sensiveis, execucao_comando_externo, escrita_kv_ou_banco, filesystem_runtime, chamada_llm_externo_novo, fetch_externo.",
  ];
}

// ----------------------------------------------------------------------------
// Função principal exportada
// ----------------------------------------------------------------------------
export function buildSelfWorkerAuditorResult(input) {
  const normalized = _asObject(input);
  const proposalStatus = _normalizeProposalStatus(normalized);
  const requireApproval =
    normalized.require_approved_proposal !== false &&
    normalized.requireApprovedProposal !== false;
  const approvalSatisfied = proposalStatus === "approved";

  if (requireApproval && !approvalSatisfied) {
    return {
      ok: false,
      skill_id: SELF_WORKER_AUDITOR_SKILL_ID,
      mode: SELF_WORKER_AUDITOR_MODE,
      executed: false,
      side_effects: false,
      summary: "SELF_WORKER_AUDITOR bloqueada — proposal não aprovada.",
      findings: [],
      priority_actions: [],
      safety_notes: _buildSafetyNotes(),
      gate: {
        requires_approved_proposal: true,
        proposal_status: proposalStatus,
        approved: false,
        blocked: true,
      },
    };
  }

  const findings = _buildFindings();
  const priority_actions = _buildPriorityActions();

  return {
    ok: true,
    skill_id: SELF_WORKER_AUDITOR_SKILL_ID,
    mode: SELF_WORKER_AUDITOR_MODE,
    executed: true,
    side_effects: false,
    summary:
      "Diagnóstico estático do Worker/repo concluído. 10 achados identificados em 6 categorias. 2 ações críticas recomendadas para PR83 (deploy loop) e PR84 (chat engessado).",
    findings,
    priority_actions,
    safety_notes: _buildSafetyNotes(),
    gate: {
      requires_approved_proposal: requireApproval,
      proposal_status: proposalStatus,
      approved: !requireApproval || approvalSatisfied,
      blocked: false,
    },
  };
}

// ----------------------------------------------------------------------------
// Helpers exportados para testes
// ----------------------------------------------------------------------------
export function getValidSeverities() {
  return Array.from(VALID_SEVERITIES);
}

export function getValidCategories() {
  return Array.from(VALID_CATEGORIES);
}
