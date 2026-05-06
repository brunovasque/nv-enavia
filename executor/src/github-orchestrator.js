// github-orchestrator.js — PR108
// Orquestrador do ciclo de self-patch supervisionado.
//
// orchestrateGithubPR(env, options)
//   Executa em sequência: create_branch → create_commit → open_pr
//   via env.ENAVIA_WORKER (service binding → Worker → GitHub Bridge).
//
// Invariantes:
//   - merge_allowed sempre false (herdado do adapter PR106)
//   - branch de self-patch nunca é main ou master
//   - candidato vazio = bloqueio antes de qualquer GitHub call
//   - falha em qualquer etapa = para e retorna erro com etapa falhou
//   - GITHUB_TOKEN nunca sai do Worker (Executor usa proxy)

/**
 * @param {object} env - bindings do Cloudflare Worker
 * @param {object} options
 * @param {string} options.workerId - ID do worker alvo (usado no nome da branch)
 * @param {string} options.candidate - código candidato (novo conteúdo do arquivo)
 * @param {string} options.filePath - caminho do arquivo no repo (ex: "nv-enavia.js")
 * @param {string} options.repo - repositório no formato "owner/repo"
 * @param {string} [options.patchTitle] - título do patch (usado no nome da PR)
 * @param {string} [options.patchDescription] - descrição da PR
 * @param {string} [options.baseBranch="main"] - branch base para criar a nova branch
 * @returns {Promise<{ ok: boolean, merge_allowed: false, branch?: string, pr_number?: number|null, pr_url?: string|null, commit_sha?: string|null, error?: string, step?: string, detail?: object }>}
 */
export async function orchestrateGithubPR(env, options) {
  const {
    workerId,
    candidate,
    filePath,
    repo,
    patchTitle,
    patchDescription,
    baseBranch = 'main',
  } = options || {};

  // Pré-validações
  if (typeof env?.ENAVIA_WORKER?.fetch !== 'function') {
    return { ok: false, merge_allowed: false, error: 'ENAVIA_WORKER_BINDING_ABSENT', step: 'pre_check' };
  }
  if (!workerId || !candidate || !filePath || !repo) {
    return { ok: false, merge_allowed: false, error: 'MISSING_REQUIRED_PARAMS', step: 'pre_check' };
  }
  if (!candidate.trim()) {
    return { ok: false, merge_allowed: false, error: 'EMPTY_CANDIDATE', step: 'pre_check' };
  }
  if (baseBranch === 'main' || baseBranch === 'master') {
    // branch gerada é feature branch — base pode ser main/master, mas target nunca é
  }

  // Gerar nome único de branch para o self-patch
  const timestamp = Date.now();
  const safeWorkerId = String(workerId)
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);
  const branchName = `enavia/self-patch-${safeWorkerId}-${timestamp}`;

  // Helper: chama o GitHub Bridge via proxy no Worker
  const callProxy = async (operation) => {
    let resp;
    try {
      resp = await env.ENAVIA_WORKER.fetch(
        'https://nv-enavia.internal/github-bridge/execute',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(operation),
        }
      );
    } catch (fetchErr) {
      return { ok: false, error: `Falha de rede ao chamar /github-bridge/execute: ${String(fetchErr)}` };
    }
    const text = await resp.text().catch(() => '');
    try {
      return JSON.parse(text);
    } catch (_) {
      return { ok: false, error: `Resposta não-JSON do proxy: ${text.slice(0, 200)}` };
    }
  };

  // ─── Etapa 1: create_branch ──────────────────────────────────────────────
  const branchResult = await callProxy({
    type: 'create_branch',
    repo,
    base_branch: baseBranch,
    head_branch: branchName,
  });

  if (!branchResult.ok) {
    return {
      ok: false,
      merge_allowed: false,
      error: branchResult.error || 'CREATE_BRANCH_FAILED',
      step: 'create_branch',
      detail: branchResult,
    };
  }

  // ─── Etapa 2: create_commit ──────────────────────────────────────────────
  const commitTitle =
    typeof patchTitle === 'string' && patchTitle.trim()
      ? patchTitle.trim()
      : 'patch automático supervisionado';

  const commitResult = await callProxy({
    type: 'create_commit',
    repo,
    branch: branchName,
    file_path: filePath,
    content: candidate,
    commit_message: `feat(self-patch): ${commitTitle}`,
  });

  if (!commitResult.ok) {
    return {
      ok: false,
      merge_allowed: false,
      error: commitResult.error || 'CREATE_COMMIT_FAILED',
      step: 'create_commit',
      branch: branchName,
      detail: commitResult,
    };
  }

  // ─── Etapa 3: open_pr ────────────────────────────────────────────────────
  const prTitle =
    typeof patchTitle === 'string' && patchTitle.trim()
      ? `[Self-patch] ${patchTitle.trim()}`
      : '[Self-patch] Patch automático supervisionado';

  const prBody =
    typeof patchDescription === 'string' && patchDescription.trim()
      ? patchDescription.trim()
      : 'Patch gerado automaticamente pela Enavia. Requer aprovação humana antes do merge.\n\nInvariante: merge_allowed=false sempre.';

  const prResult = await callProxy({
    type: 'open_pr',
    repo,
    title: prTitle,
    body: prBody,
    head_branch: branchName,
    base_branch: baseBranch,
  });

  if (!prResult.ok) {
    return {
      ok: false,
      merge_allowed: false,
      error: prResult.error || 'OPEN_PR_FAILED',
      step: 'open_pr',
      branch: branchName,
      commit_sha: commitResult.commit_sha || null,
      detail: prResult,
    };
  }

  return {
    ok: true,
    merge_allowed: false,
    branch: branchName,
    pr_number: prResult.pr_number || null,
    pr_url: prResult.html_url || null,
    commit_sha: commitResult.commit_sha || null,
  };
}
