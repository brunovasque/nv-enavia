/**
 * enavia-github-adapter.js — PR105 (base) + PR106 (create_branch validado, create_commit, open_pr)
 *
 * Adapter HTTP real para operações GitHub supervisionadas.
 * Responsabilidades:
 *   - executeGithubOperation(operation, token) — executa operação real via fetch ao GitHub API
 *   - executeGithubBridgeRequest(operation, token) — pipeline completo:
 *       validateGithubOperation → evaluateSafetyGuard → Event Log → executeGithubOperation → Event Log
 *
 * Operações suportadas (PR105 + PR106):
 *   - comment_pr   — comenta em PR existente
 *   - create_branch — cria branch com SHA base dinâmico (GET ref → POST git/refs)
 *   - create_commit — cria ou atualiza arquivo em branch (GET contents → PUT contents)
 *   - open_pr       — abre PR real (POST pulls), sem merge automático
 *
 * Invariantes obrigatórias:
 *   - merge / deploy_prod / secret_change: sempre bloqueados — sem exceção
 *   - commit direto em main/master: sempre bloqueado
 *   - merge de PR: sempre bloqueado (gate humano obrigatório)
 *   - Token nunca exposto em evidence, event ou response
 *   - Safety Guard sempre antes de executeGithubOperation
 *   - Event Log sempre registra tentativa e resultado
 *   - Operação sem token: erro claro, sem execução silenciosa
 *   - content vazio em create_commit: erro imediato
 *
 * Contratos: CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105.md (base)
 *            CONTRATO_ENAVIA_GITHUB_BRIDGE_PR106.md (extensão)
 */

'use strict';

const { validateGithubOperation } = require('./enavia-github-bridge');
const { evaluateSafetyGuard } = require('./enavia-safety-guard');
const { createEnaviaEvent } = require('./enavia-event-log');

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const ALWAYS_BLOCKED = ['merge', 'deploy_prod', 'secret_change'];

// Branches protegidas — commit direto proibido
const PROTECTED_BRANCHES = ['main', 'master'];

const SUPPORTED_OPERATIONS = ['comment_pr', 'create_branch', 'create_commit', 'open_pr'];

const SOURCE_PR = 'PR105';
const SOURCE_PR_106 = 'PR106';
const CONTRACT_ID = 'CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105';
const CONTRACT_ID_106 = 'CONTRATO_ENAVIA_GITHUB_BRIDGE_PR106';
const USER_AGENT = 'enavia-github-bridge/PR106';

// ---------------------------------------------------------------------------
// _executeCommentPr — executa comentário real em PR do GitHub
// ---------------------------------------------------------------------------

async function _executeCommentPr(operation, token) {
  const repo = typeof operation.repo === 'string' ? operation.repo.trim() : '';
  const pr_number = operation.pr_number;
  const comment = typeof operation.comment === 'string' ? operation.comment.trim() : '';

  const parts = repo.split('/');
  const owner = parts[0] || '';
  const repoName = parts[1] || '';

  if (!owner || !repoName) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'comment_pr',
      error: 'repo deve ter formato owner/repo',
      evidence: [],
    };
  }
  if (!pr_number || typeof pr_number !== 'number') {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'comment_pr',
      error: 'pr_number ausente ou inválido (deve ser número)',
      evidence: [],
    };
  }
  if (!comment) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'comment_pr',
      error: 'comment ausente ou vazio',
      evidence: [],
    };
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/issues/${pr_number}/comments`;

  let response, responseData;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ body: comment }),
    });
    responseData = await response.json().catch(() => ({}));
  } catch (err) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'comment_pr',
      error: `Falha de rede ao chamar GitHub API: ${String(err)}`,
      evidence: [],
    };
  }

  const ok = response.status === 201;
  const comment_id = ok ? (responseData.id || null) : null;
  const html_url = ok ? (responseData.html_url || null) : null;

  const evidence = ok
    ? [
        `Comentário criado na PR #${pr_number} do repo ${repo}`,
        `comment_id=${comment_id}`,
        html_url ? `url=${html_url}` : null,
      ].filter(Boolean)
    : [`Falha ao comentar na PR #${pr_number} do repo ${repo}: HTTP ${response.status}`];

  return {
    ok,
    executed: true,
    github_execution: true,
    operation_type: 'comment_pr',
    repo,
    pr_number,
    response_status: response.status,
    comment_id,
    html_url,
    evidence,
    error: ok ? null : `GitHub API retornou HTTP ${response.status}`,
    source_pr: SOURCE_PR,
  };
}

// ---------------------------------------------------------------------------
// _executeCreateBranch — cria branch real no GitHub
// ---------------------------------------------------------------------------

async function _executeCreateBranch(operation, token) {
  const repo = typeof operation.repo === 'string' ? operation.repo.trim() : '';
  const base_branch = typeof operation.base_branch === 'string' ? operation.base_branch.trim() : '';
  const head_branch = typeof operation.head_branch === 'string' ? operation.head_branch.trim() : '';

  const parts = repo.split('/');
  const owner = parts[0] || '';
  const repoName = parts[1] || '';

  if (!owner || !repoName) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: 'repo deve ter formato owner/repo',
      evidence: [],
    };
  }
  if (!base_branch) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: 'base_branch ausente',
      evidence: [],
    };
  }
  if (!head_branch) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: 'head_branch ausente',
      evidence: [],
    };
  }

  // Passo 1: obter SHA da branch base
  const shaUrl = `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${base_branch}`;
  let shaResponse, shaData;
  try {
    shaResponse = await fetch(shaUrl, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    shaData = await shaResponse.json().catch(() => ({}));
  } catch (err) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: `Falha de rede ao obter SHA de ${base_branch}: ${String(err)}`,
      evidence: [],
    };
  }

  if (!shaResponse.ok) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: `Falha ao obter SHA de ${base_branch}: HTTP ${shaResponse.status}`,
      evidence: [],
    };
  }

  const sha = shaData && shaData.object && shaData.object.sha;
  if (!sha) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: `SHA não encontrado para branch ${base_branch}`,
      evidence: [],
    };
  }

  // Passo 2: criar a branch
  const createUrl = `https://api.github.com/repos/${owner}/${repoName}/git/refs`;
  let createResponse, createData;
  try {
    createResponse = await fetch(createUrl, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ ref: `refs/heads/${head_branch}`, sha }),
    });
    createData = await createResponse.json().catch(() => ({}));
  } catch (err) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_branch',
      error: `Falha de rede ao criar branch ${head_branch}: ${String(err)}`,
      evidence: [],
    };
  }

  const ok = createResponse.status === 201;
  const alreadyExists = createResponse.status === 422;
  const created_ref = ok ? (createData && createData.ref ? createData.ref : null) : null;

  const evidence = ok
    ? [
        `Branch ${head_branch} criada a partir de ${base_branch} no repo ${repo}`,
        `SHA base: ${sha.slice(0, 7)}`,
        created_ref ? `ref=${created_ref}` : null,
      ].filter(Boolean)
    : alreadyExists
      ? [`Branch ${head_branch} já existe no repo ${repo} (HTTP 422)`]
      : [`Falha ao criar branch ${head_branch} no repo ${repo}: HTTP ${createResponse.status}`];

  return {
    ok,
    executed: true,
    github_execution: true,
    operation_type: 'create_branch',
    repo,
    base_branch,
    head_branch,
    sha_used: ok ? sha : null,
    response_status: createResponse.status,
    already_exists: alreadyExists,
    evidence,
    error: ok ? null : alreadyExists
      ? `Branch ${head_branch} já existe no repo ${repo}`
      : `GitHub API retornou HTTP ${createResponse.status}`,
    source_pr: SOURCE_PR_106,
  };
}

// ---------------------------------------------------------------------------
// _toBase64 — encode UTF-8 string para base64 (compatível com Workers e Node.js)
// ---------------------------------------------------------------------------

function _toBase64(str) {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf-8').toString('base64');
  }
  // Workers/browser fallback: encode UTF-8 chars corretamente
  return btoa(
    encodeURIComponent(str).replace(/%([0-9A-F]{2})/gi, (_, p1) =>
      String.fromCharCode(parseInt(p1, 16)),
    ),
  );
}

// ---------------------------------------------------------------------------
// _executeCreateCommit — cria ou atualiza arquivo em branch real do GitHub
//
// Sequência obrigatória (contrato PR106 seção 2.1):
//   1. GET /repos/{owner}/{repo}/contents/{path}?ref={branch} — obter SHA se arquivo existir
//   2. PUT /repos/{owner}/{repo}/contents/{path} — criar ou atualizar arquivo
//
// Invariantes:
//   - content nunca pode ser vazio
//   - branch de destino nunca pode ser "main" ou "master"
//   - commit em branch protegida = bloqueio duro
// ---------------------------------------------------------------------------

async function _executeCreateCommit(operation, token) {
  const repo = typeof operation.repo === 'string' ? operation.repo.trim() : '';
  const branch = typeof operation.branch === 'string' ? operation.branch.trim() : '';
  const file_path = typeof operation.file_path === 'string' ? operation.file_path.trim() : '';
  const content = typeof operation.content === 'string' ? operation.content : '';
  const commit_message = typeof operation.commit_message === 'string' ? operation.commit_message.trim() : '';

  const parts = repo.split('/');
  const owner = parts[0] || '';
  const repoName = parts[1] || '';

  if (!owner || !repoName) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'create_commit', error: 'repo deve ter formato owner/repo', evidence: [] };
  }

  // Invariante: branch protegida = bloqueio duro
  if (!branch) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'create_commit', error: 'branch de destino ausente', evidence: [] };
  }
  if (PROTECTED_BRANCHES.includes(branch)) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_commit',
      blocked: true,
      error: `Commit direto em "${branch}" é proibido pelo GitHub Bridge — use uma branch de feature`,
      evidence: [],
      source_pr: SOURCE_PR_106,
    };
  }

  // Invariante: content nunca pode ser vazio
  if (!content) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'create_commit', error: 'content não pode ser vazio', evidence: [] };
  }

  if (!file_path) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'create_commit', error: 'file_path ausente', evidence: [] };
  }

  if (!commit_message) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'create_commit', error: 'commit_message ausente', evidence: [] };
  }

  // Passo 1: GET SHA do arquivo se existir (para update)
  const contentsUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${file_path}`;
  let existingSha = null;
  try {
    const getResponse = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (getResponse.status === 200) {
      const getData = await getResponse.json().catch(() => ({}));
      existingSha = getData.sha || null;
    }
    // 404 = arquivo não existe — ok para create
  } catch (_) {
    // Falha de rede ao checar existência — prossegue sem sha (create)
  }

  // Passo 2: PUT para criar ou atualizar arquivo
  const contentBase64 = _toBase64(content);
  const putBody = {
    message: commit_message,
    content: contentBase64,
    branch,
    ...(existingSha ? { sha: existingSha } : {}),
  };

  let putResponse, putData;
  try {
    putResponse = await fetch(contentsUrl, {
      method: 'PUT',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(putBody),
    });
    putData = await putResponse.json().catch(() => ({}));
  } catch (err) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'create_commit',
      error: `Falha de rede ao criar commit em ${file_path}: ${String(err)}`,
      evidence: [],
    };
  }

  const ok = putResponse.status === 200 || putResponse.status === 201;
  const operation_kind = existingSha ? 'update' : 'create';
  const commit_sha = ok && putData.commit ? (putData.commit.sha || null) : null;
  const html_url = ok && putData.content ? (putData.content.html_url || null) : null;

  const evidence = ok
    ? [
        `Arquivo ${file_path} ${operation_kind === 'update' ? 'atualizado' : 'criado'} na branch ${branch} do repo ${repo}`,
        commit_sha ? `commit_sha=${commit_sha.slice(0, 7)}` : null,
        html_url ? `url=${html_url}` : null,
        `operation_kind=${operation_kind}`,
      ].filter(Boolean)
    : [`Falha ao criar commit em ${file_path} na branch ${branch} do repo ${repo}: HTTP ${putResponse.status}`];

  return {
    ok,
    executed: true,
    github_execution: true,
    operation_type: 'create_commit',
    repo,
    branch,
    file_path,
    operation_kind,
    response_status: putResponse.status,
    commit_sha,
    html_url,
    evidence,
    error: ok ? null : `GitHub API retornou HTTP ${putResponse.status}`,
    source_pr: SOURCE_PR_106,
  };
}

// ---------------------------------------------------------------------------
// _executeOpenPr — abre PR real no GitHub
//
// Payload obrigatório: { title, head, base }
// Payload opcional: { body }
// Retorna: { pr_number, html_url, pr_state, merge_allowed: false }
//
// Invariante: merge_allowed é sempre false — gate humano obrigatório antes do merge.
// ---------------------------------------------------------------------------

async function _executeOpenPr(operation, token) {
  const repo = typeof operation.repo === 'string' ? operation.repo.trim() : '';
  const title = typeof operation.title === 'string' ? operation.title.trim() : '';
  const body = typeof operation.body === 'string' ? operation.body : '';
  const head = typeof operation.head === 'string' ? operation.head.trim() : '';
  const base = typeof operation.base === 'string' ? operation.base.trim() : '';

  const parts = repo.split('/');
  const owner = parts[0] || '';
  const repoName = parts[1] || '';

  if (!owner || !repoName) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'open_pr', error: 'repo deve ter formato owner/repo', evidence: [] };
  }
  if (!title) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'open_pr', error: 'title ausente', evidence: [] };
  }
  if (!head) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'open_pr', error: 'head ausente (branch de origem)', evidence: [] };
  }
  if (!base) {
    return { ok: false, executed: false, github_execution: false, operation_type: 'open_pr', error: 'base ausente (branch de destino)', evidence: [] };
  }

  const url = `https://api.github.com/repos/${owner}/${repoName}/pulls`;
  let response, responseData;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `token ${token}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify({ title, body, head, base }),
    });
    responseData = await response.json().catch(() => ({}));
  } catch (err) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: 'open_pr',
      error: `Falha de rede ao abrir PR: ${String(err)}`,
      evidence: [],
    };
  }

  const ok = response.status === 201;
  const pr_number = ok ? (responseData.number || null) : null;
  const html_url = ok ? (responseData.html_url || null) : null;
  const pr_state = ok ? (responseData.state || null) : null;

  const evidence = ok
    ? [
        `PR aberta: "${title}" (${head} → ${base}) no repo ${repo}`,
        pr_number ? `PR #${pr_number}` : null,
        html_url ? `url=${html_url}` : null,
        `merge_allowed=false — gate humano obrigatório`,
      ].filter(Boolean)
    : [`Falha ao abrir PR no repo ${repo}: HTTP ${response.status}`];

  return {
    ok,
    executed: true,
    github_execution: true,
    operation_type: 'open_pr',
    repo,
    head,
    base,
    response_status: response.status,
    pr_number,
    html_url,
    pr_state,
    merge_allowed: false,
    evidence,
    error: ok ? null : `GitHub API retornou HTTP ${response.status}`,
    source_pr: SOURCE_PR_106,
  };
}

// ---------------------------------------------------------------------------
// executeGithubOperation — adapter HTTP puro (sem Safety Guard aqui)
//
// Responsabilidade única: traduzir operation → chamada HTTP GitHub API → resultado.
// Safety Guard e Event Log ficam em executeGithubBridgeRequest.
//
// @param {object} operation - operação validada
// @param {string} token - GitHub token (nunca exposto em resposta)
// @returns {Promise<object>}
// ---------------------------------------------------------------------------

async function executeGithubOperation(operation, token) {
  const safeOp = operation && typeof operation === 'object' ? operation : {};
  const opType = typeof safeOp.type === 'string' ? safeOp.type.toLowerCase().trim() : 'unknown';

  // Bloqueios duros — nunca executados, sem exceção
  if (ALWAYS_BLOCKED.includes(opType)) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: opType,
      blocked: true,
      error: `${opType} é sempre bloqueado pelo GitHub Bridge — nunca executado`,
      evidence: [],
      source_pr: SOURCE_PR,
    };
  }

  // Token obrigatório
  if (!token || typeof token !== 'string' || !token.trim()) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: opType,
      blocked: false,
      error: 'GITHUB_TOKEN ausente ou inválido — operação não executada',
      evidence: [],
      source_pr: SOURCE_PR,
    };
  }

  // Roteamento para operações suportadas
  if (opType === 'comment_pr') return _executeCommentPr(safeOp, token);
  if (opType === 'create_branch') return _executeCreateBranch(safeOp, token);
  if (opType === 'create_commit') return _executeCreateCommit(safeOp, token);
  if (opType === 'open_pr') return _executeOpenPr(safeOp, token);

  return {
    ok: false,
    executed: false,
    github_execution: false,
    operation_type: opType,
    blocked: false,
    error: `Operação "${opType}" não suportada pelo adapter atual (suportadas: ${SUPPORTED_OPERATIONS.join(', ')})`,
    evidence: [],
    source_pr: SOURCE_PR_106,
  };
}

// ---------------------------------------------------------------------------
// executeGithubBridgeRequest — pipeline completo supervisionado
//
// Fluxo:
//   1. validateGithubOperation (PR103) — validação estrutural + Safety Guard interno
//   2. evaluateSafetyGuard — gate de segurança externo
//   3. createEnaviaEvent — registra tentativa
//   4. executeGithubOperation — execução real (somente se não bloqueado)
//   5. createEnaviaEvent — registra resultado
//
// Token nunca passa para Event Log ou evidence.
//
// @param {object} operation
// @param {string} token
// @returns {Promise<object>}
// ---------------------------------------------------------------------------

async function executeGithubBridgeRequest(operation, token) {
  const safeOp = operation && typeof operation === 'object' ? operation : {};
  const opType = typeof safeOp.type === 'string' ? safeOp.type.toLowerCase().trim() : 'unknown';

  // --- 1. Validação estrutural via GitHub Bridge (PR103) ---
  const validation = validateGithubOperation(safeOp, {});

  // --- 2. Safety Guard externo ---
  const safetyAction = {
    type: 'external_integration',
    blast_radius: 'external',
    description: `GitHub Bridge Execute: ${opType}`,
    rollback_hint: `Rollback: nenhuma ação GitHub executada se bloqueado (${opType})`,
  };
  const safetyResult = evaluateSafetyGuard(safetyAction, {});

  const isBlocked =
    validation.blocked ||
    safetyResult.decision === 'block';

  const requiresReview =
    (!isBlocked) && (
      validation.requires_human_review ||
      safetyResult.decision === 'require_human_review'
    );

  const blockedReasons = [
    ...(validation.reasons || []),
    ...(safetyResult.blocked || []),
  ].filter(Boolean);

  // --- 3. Event Log — registra tentativa ---
  const attemptEvent = createEnaviaEvent({
    source: 'github_bridge',
    subsystem: 'github_bridge',
    type: `github_execute_attempt`,
    severity: isBlocked ? 'error' : (requiresReview ? 'warning' : 'info'),
    status: isBlocked ? 'blocked' : 'ok',
    message: isBlocked
      ? `GitHub Bridge Execute: operação ${opType} bloqueada (${blockedReasons.slice(0, 1).join('; ')})`
      : `GitHub Bridge Execute: tentativa de ${opType} iniciada`,
    requires_human_review: requiresReview || isBlocked,
    rollback_hint: isBlocked
      ? `Nenhuma ação GitHub executada — operação bloqueada antes do fetch`
      : null,
    evidence: {
      operation_type: opType,
      repo: validation.repo || null,
      blocked: isBlocked,
      requires_human_review: requiresReview,
      safety_decision: safetyResult.decision,
      validation_reasons: validation.reasons || [],
      github_execution: false,
      side_effects: false,
      source_pr: SOURCE_PR,
      contract_id: CONTRACT_ID,
    },
    metadata: { source_pr: SOURCE_PR, operation_type: opType },
  });

  // --- 4. Retorno antecipado se bloqueado ---
  if (isBlocked) {
    return {
      ok: false,
      executed: false,
      github_execution: false,
      side_effects: false,
      blocked: true,
      requires_human_review: true,
      operation_type: opType,
      repo: validation.repo || null,
      reasons: blockedReasons,
      safety_decision: safetyResult.decision,
      attempt_event: attemptEvent.ok ? attemptEvent.event : null,
      result_event: null,
      evidence: [],
      source_pr: SOURCE_PR,
    };
  }

  // --- 5. Execução real via adapter HTTP ---
  let execResult;
  try {
    execResult = await executeGithubOperation(safeOp, token);
  } catch (err) {
    execResult = {
      ok: false,
      executed: false,
      github_execution: false,
      operation_type: opType,
      error: `Exceção no adapter: ${String(err)}`,
      evidence: [],
    };
  }

  // --- 6. Event Log — registra resultado ---
  const resultEvent = createEnaviaEvent({
    source: 'github_bridge',
    subsystem: 'github_bridge',
    type: `github_execute_result`,
    severity: execResult.ok ? 'info' : 'error',
    status: execResult.ok ? 'ok' : 'failed',
    message: execResult.ok
      ? `GitHub Bridge Execute: ${opType} executado com sucesso`
      : `GitHub Bridge Execute: ${opType} falhou — ${execResult.error || 'erro desconhecido'}`,
    requires_human_review: !execResult.ok,
    evidence: {
      operation_type: opType,
      repo: execResult.repo || validation.repo || null,
      executed: execResult.executed,
      github_execution: execResult.github_execution,
      response_status: execResult.response_status || null,
      evidence_list: execResult.evidence || [],
      source_pr: SOURCE_PR,
      contract_id: CONTRACT_ID,
      // token nunca incluído aqui
    },
    metadata: { source_pr: SOURCE_PR, operation_type: opType, executed: execResult.executed },
  });

  return {
    ok: execResult.ok,
    executed: execResult.executed,
    github_execution: execResult.github_execution,
    side_effects: execResult.executed && execResult.github_execution,
    blocked: false,
    requires_human_review: requiresReview || !execResult.ok,
    operation_type: opType,
    repo: execResult.repo || validation.repo || null,
    evidence: execResult.evidence || [],
    attempt_event: attemptEvent.ok ? attemptEvent.event : null,
    result_event: resultEvent.ok ? resultEvent.event : null,
    error: execResult.error || null,
    safety_decision: safetyResult.decision,
    source_pr: SOURCE_PR,
    ...(execResult.comment_id !== undefined ? { comment_id: execResult.comment_id } : {}),
    ...(execResult.html_url !== undefined ? { html_url: execResult.html_url } : {}),
    ...(execResult.sha_used !== undefined ? { sha_used: execResult.sha_used } : {}),
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = {
  executeGithubOperation,
  executeGithubBridgeRequest,
  ALWAYS_BLOCKED,
  SUPPORTED_OPERATIONS,
};
