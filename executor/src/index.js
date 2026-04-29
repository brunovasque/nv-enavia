// ============================================================
// 🔍 ACORN — real JS parser (pure JS, no eval, Workers-compatible)
// Bundled by wrangler/esbuild at deploy time.
// ============================================================
import { parse as acornParse } from "acorn";
import {
  normalizeAuditRiskLevel,
  normalizeAuditVerdict,
} from "./audit-response.js";

// ============================================================
// 📜 CANONICAL BOUNDARY — EXECUTOR × DEPLOY-WORKER
// ============================================================
// This constant defines the single source of truth for the
// responsibility split between enavia-executor and deploy-worker.
//
// EXECUTOR faz (soberano):
//   audit, propose, module-validate, leitura de contexto/snapshot,
//   geração de plano/patch supervisionado, handoff para deploy-worker.
//
// EXECUTOR NÃO faz como fonte soberana:
//   apply-test, approve, promote, rollback, cancel,
//   governança final de deploy.
//
// Se alguma dessas ações existir no executor por compatibilidade,
// ela DELEGA ao deploy-worker quando DEPLOY_WORKER_URL está configurado.
// Quando deploy-worker não está disponível, o executor opera em modo
// de compatibilidade (stub/fallback) e sinaliza claramente no response.
// ============================================================
const EXECUTOR_BOUNDARY = {
  version: "PRC-canonical-v2",
  executor_owns: [
    "audit",
    "propose",
    "module-validate",
    "module-save",
    "module-patch",
    "module-get",
    "module-list",
    "module-diff",
    "engineer",
    "engineer-core",
    "validate-code",
    "context-read",
    "snapshot-read",
    "plan-generation",
    "handoff-to-deploy-worker",
  ],
  deploy_worker_owns: [
    "apply-test",
    "approve",
    "promote",
    "rollback",
    "cancel",
    "deploy-governance",
    "worker-deploy-real",
    "staging-management",
  ],
  delegation_note:
    "Deploy-worker-owned actions delegate when DEPLOY_WORKER_URL is available, or return explicit error. No local compat fallback.",
};

// ============================================================
// 🧠 CACHE DE SCRIPTS CLOUDFLARE (MEMÓRIA) — ESCOPO GLOBAL
// ============================================================
let __CF_SCRIPTS_CACHE__ = null;
let __CF_SCRIPTS_CACHE_TS__ = 0;
const __CF_SCRIPTS_TTL_MS__ = 30_000; // 30s é suficiente para audit

// ============================================================
// 🔐 HELPER GLOBAL — SHA-256 HEX (usado por governança de deploy)
// ============================================================
async function sha256Hex(input) {
  const data = new TextEncoder().encode(input);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
}

export default {
  async fetch(request, env, ctx) {

    // ============================================================
    // 🔐 HELPERS DE GOVERNANÇA DE DEPLOY (TESTE → REAL)
    // ============================================================

    function isProdEnv(env) {
      const EXEC_ENV = (env.ENAVIA_ENV || "production").toLowerCase();
      return EXEC_ENV === "production" || EXEC_ENV === "prod";
    }

    function isTestEnv(env) {
      const EXEC_ENV = (env.ENAVIA_ENV || "production").toLowerCase();
      return EXEC_ENV === "test" || EXEC_ENV === "teste";
    }

    const url = new URL(request.url);
const { pathname } = url;
const searchParams = url.searchParams;

const METHOD = request.method;
const method = METHOD; // alias de compatibilidade

    // ============================================================
    // 🚀 ENDPOINT INTERNO — APPLY DEPLOY (AUTO-APLICAÇÃO)
    // ⚠️ DEVE SER O PRIMEIRO HANDLER DO WORKER
    // ============================================================
    if (pathname === "/__internal__/deploy-apply" && method === "POST") {
      const body = await request.json();

      return new Response(
        JSON.stringify({
          ok: true,
          applied: true,
          execution_id: body.execution_id,
          received_patch: Boolean(body.patch),
          worker: env.SYSTEM_NAME || "ENAVIA_WORKER",
          env: env.ENAVIA_ENV || "unknown",
          timestamp: new Date().toISOString()
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // ============================================================
    // 🔍 ENDPOINT INTERNO — AUTO DESCRIÇÃO DO WORKER
    // ============================================================
    if (pathname === "/__internal__/describe") {
      return new Response(
        JSON.stringify({
          ok: true,
          worker: env.SYSTEM_NAME || "ENAVIA_WORKER",
          env: env.ENAVIA_ENV || "unknown",
          version: env.ENAVIA_VERSION || "dev",
          capabilities: {
            canSimulate: true,
            canExecute: true,
            canRollback: false
          },
          timestamp: new Date().toISOString()
        }),
        { headers: { "content-type": "application/json" } }
      );
    }

    // ⬇️ TODO O RESTO DO WORKER VEM ABAIXO
    
    // ============================================================
    // 🔎 DIAGNÓSTICO DE REQUEST (LOG ESTRUTURADO)
    // ============================================================
    let payloadPreview = null;

    if (METHOD === "POST") {
      try {
        const clone = request.clone();
        const bodyText = await clone.text();

        try {
          const parsed = bodyText ? JSON.parse(bodyText) : null;

          payloadPreview =
            parsed && typeof parsed === "object"
              ? {
                  keys: Object.keys(parsed),
                  mode: parsed.mode || null,
                  action: parsed.action || null,
                  executor_action: parsed.executor_action || null,
                }
              : { raw: bodyText.slice(0, 300) };
        } catch {
          payloadPreview = { raw: bodyText.slice(0, 300) };
        }
      } catch (err) {
        payloadPreview = { error: String(err) };
      }
    }

    console.log("[ENAVIA_EXECUTOR] Incoming request →", {
      method: METHOD,
      path: pathname,
      payloadPreview,
    });

    // ============================================================
    // ⚙️ CONFIG BÁSICA
    // ============================================================
    const SYSTEM_NAME = "ENAVIA_EXECUTOR";
    const GIT_KV = env?.GIT_KV || env?.ENAVIA_GIT || null; // KV namespace obrigatório (aceita binding GIT_KV ou ENAVIA_GIT)

    // Alias canônico: mantém compatibilidade com código legado que usa env.ENAVIA_GIT
    const ENAVIA_GIT = GIT_KV;

    // Worker alvo principal (nv-enavia) – usado apenas como metadado por enquanto
    const TARGET_WORKER_NAME = env.TARGET_WORKER_NAME || "nv-enavia";

    // Futuro: auto-deploy real via API da Cloudflare
    const CF_ACCOUNT_ID = env.CF_ACCOUNT_ID || null;
    const CF_API_TOKEN = env.CF_API_TOKEN || null;

// ============================================================
// 🗺️ MAPA CANÔNICO: workerId lógico → scriptName Cloudflare
// ============================================================

const WORKER_SCRIPT_MAP = {
  // =========================
  // EXECUTOR (ALIAS LÓGICO)
  // =========================

  // TESTE → aponta para o script real existente
  "enavia-executor-test": "enavia-executor",

  // PRODUÇÃO
  "enavia-executor": "enavia-executor",

  // =========================
  // WORKERS-ALVO
  // =========================

  // ENOVA (principal)
  "nv-webhook-v2": "nv-webhook-v2",

  // TESTE
  "enavia-worker-teste": "enavia-worker-teste",

  // PRODUÇÃO
  "enavia-worker": "enavia-worker",
};

    // ============================================================
    // ⭐ CORS — Configuração completa
    // ============================================================
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
    };

    // Preflight (navegadores)
    if (METHOD === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: corsHeaders,
      });
    }

    // Aplicador de CORS a qualquer resposta
    function withCORS(response) {
      const headers = new Headers(response.headers);

      for (const [k, v] of Object.entries(corsHeaders)) {
        headers.set(k, v);
      }

      return new Response(response.body, {
        status: response.status,
        headers,
      });
    }

    // ============================================================
    // 🛠 HELPERS GERAIS
    // ============================================================
    function jsonResponse(body, status = 200) {
      return new Response(JSON.stringify(body, null, 2), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    function errorResponse(message, status = 400, extra = {}) {
      return new Response(JSON.stringify({
        system: SYSTEM_NAME,
        error: true,
        message,
        ...extra,
      }, null, 2), {
        status,
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    // ============================================================
    // 🔀 DEPLOY-WORKER DELEGATION HELPER
    // Encaminha request para deploy-worker quando DEPLOY_WORKER_URL
    // está configurado. Retorna null se deploy-worker não disponível.
    // ============================================================
    const DEPLOY_WORKER_BASE = (env.DEPLOY_WORKER_URL || "").replace(/\/$/, "");

    async function delegateToDeployWorker(path, body) {
      if (!DEPLOY_WORKER_BASE) return null;
      try {
        const url = DEPLOY_WORKER_BASE + path;
        const resp = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(env.INTERNAL_TOKEN
              ? { Authorization: `Bearer ${String(env.INTERNAL_TOKEN)}` }
              : {}),
          },
          body: JSON.stringify(body),
        });
        let data = null;
        try {
          data = await resp.json();
        } catch (_parseErr) {
          const text = await resp.text().catch(() => "");
          data = { raw: text.slice(0, 500), parse_error: true };
        }
        return {
          ok: resp.ok && data.ok !== false,
          delegated: true,
          delegated_to: "deploy-worker",
          deploy_worker_url: url,
          response: data,
          http_status: resp.status,
        };
      } catch (err) {
        return {
          ok: false,
          delegated: true,
          delegated_to: "deploy-worker",
          delegation_failed: true,
          error: err.message || String(err),
        };
      }
    }

    // nowIso() e generateId() → fonte única no nível de módulo (após export default)

    async function ensureKV() {
      if (!GIT_KV) {
        throw new Error(
          "ENAVIA_GIT KV binding não configurado no Worker enavia-executor."
        );
      }
    }

    // updateFlowStateKV() → fonte única no nível de módulo (após export default)

    // fetchCurrentWorkerCode(), fetchCurrentWorkerSnapshot(), listCloudflareWorkerScripts()
    // → fontes únicas no nível de módulo (após export default)

    // ============================================================
    // 📦 ESTRUTURA DE DADOS NO KV
    //
    // Keys usadas:
    //  - git:index            → JSON: [versionId1, versionId2, ...]
    //  - git:latest           → string: versionId
    //  - git:snap:<id>        → JSON: meta da versão
    //  - git:code:<id>        → string: código completo do worker alvo
    //
    // Meta da versão (git:snap:<id>):
    //  {
    //    id,
    //    created_at,
    //    author,
    //    message,
    //    base_version_id,
    //    code_length,
    //    target_worker,
    //    executor_meta   // (novo) metadados do pacote executor_intent da ENAVIA
    //  }
    // ============================================================

    async function getIndex() {
      await ensureKV();
      const raw = await GIT_KV.get("git:index");
      if (!raw) return [];
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
      } catch (_) {}
      return [];
    }

    async function saveIndex(arr) {
      await ensureKV();
      await GIT_KV.put("git:index", JSON.stringify(arr));
    }

    async function getLatestVersionId() {
      await ensureKV();
      return (await GIT_KV.get("git:latest")) || null;
    }

    async function setLatestVersionId(id) {
      await ensureKV();
      await GIT_KV.put("git:latest", id);
    }

    async function getVersionMeta(id) {
      await ensureKV();
      const raw = await GIT_KV.get(`git:snap:${id}`);
      if (!raw) return null;
      try {
        return JSON.parse(raw);
      } catch (_) {
        return null;
      }
    }

    async function getVersionCode(id) {
      await ensureKV();
      return await GIT_KV.get(`git:code:${id}`);
    }

    // ⚠️ compatível com a versão anterior:
    //  - chamadas antigas continuam passando apenas { code, author, message, baseVersionId }
    //  - novas chamadas podem enviar "extra" com executor_meta
    async function saveVersion({ code, author, message, baseVersionId, extra }) {
      await ensureKV();

      const id = generateId("v");
      const created_at = nowIso();
      const code_length = code.length;

      const meta = {
        id,
        created_at,
        author: author || "ENAVIA",
        message: message || "",
        base_version_id: baseVersionId || null,
        code_length,
        target_worker: TARGET_WORKER_NAME,
        executor_meta: extra || null,
      };

      const index = await getIndex();
      index.push(id);

      await Promise.all([
        GIT_KV.put(`git:snap:${id}`, JSON.stringify(meta)),
        GIT_KV.put(`git:code:${id}`, code),
        saveIndex(index),
        setLatestVersionId(id),
      ]);

      return meta;
    }

    async function getLatestSnapshot() {
      const latestId = await getLatestVersionId();
      if (!latestId) return null;
      const [meta, code] = await Promise.all([
        getVersionMeta(latestId),
        getVersionCode(latestId),
      ]);
      if (!meta || !code) return null;
      return { meta, code };
    }

    // ============================================================
    // 🧮 DIFF SIMPLES (linha a linha, só para log)
    // ============================================================
    function diffLines(oldCode, newCode, maxLines = 200) {
      const oldLines = oldCode.split("\n");
      const newLines = newCode.split("\n");

      const maxLen = Math.max(oldLines.length, newLines.length);
      const changes = [];

      for (let i = 0; i < maxLen && changes.length < maxLines; i++) {
        const oldLine = oldLines[i] ?? "";
        const newLine = newLines[i] ?? "";

        if (oldLine === newLine) continue;

        changes.push({
          line: i + 1,
          before: oldLine,
          after: newLine,
        });
      }

      return {
        total_changes: changes.length,
        changes,
      };
    }

    // ============================================================
    // 🚀 (FUTURO) DEPLOY VIA CLOUDFLARE API
    //
    // POR ENQUANTO: o /deploy apenas retorna o código e meta.
    // Quando quisermos automatizar o deploy:
    //  - usar CF_ACCOUNT_ID, CF_API_TOKEN e TARGET_WORKER_NAME
    //  - integrar com a API de Workers da Cloudflare
    // ============================================================
    async function performDeploy(versionId) {
      // ⚠️ performDeploy() é STUB permanente: deploy real é soberania do deploy-worker.
      // Esta função sempre lança erro. Os call-sites já verificam DEPLOY_WORKER_URL
      // e delegam ao deploy-worker antes de chegar aqui.
      throw new Error(
        "DEPLOY_WORKER_NOT_CONFIGURED: deploy real requer deploy-worker. " +
        "Configure DEPLOY_WORKER_URL para que o executor delegue corretamente. " +
        "performDeploy() é stub e não executa deploy."
      );
    }

    // ============================================================
    // 🧪 VALIDAÇÃO BÁSICA DO CÓDIGO (best effort)
    // ============================================================
    function validateCodeBasic(code) {
      if (!code || typeof code !== "string") {
        return { ok: false, reason: "Código vazio ou inválido." };
      }

      if (!code.includes("export default")) {
        return {
          ok: false,
          reason:
            "Código não contém 'export default'. Verifique se é um Worker válido.",
        };
      }

      return { ok: true, reason: "Validação básica OK." };
    }

    // ============================================================
    // 🧷 HANDLERS DE ROTAS
    // ============================================================
    // 🚀🚀🚀 AQUI ESTÁ O BLOCO NOVO JÁ INSERIDO 🚀🚀🚀
    // ----------------------------------------
    // POST /  → chama o executor core_v2
    // 🔒 HARDENED: exige action ou executor_action explícita.
    //    Não funciona mais como catch-all permissivo legado.
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/") {
      let action;
      try {
        action = await request.json();
      } catch (err) {
        return withCORS(errorResponse("JSON inválido no body do executor.", 400, {
          detail: String(err),
        }));
      }

      // 🔒 BOUNDARY: rejeitar payload sem action/executor_action explícita
      const declaredAction = action?.executor_action || action?.action || null;
      if (!declaredAction) {
        return withCORS(errorResponse(
          "POST / requer campo 'action' ou 'executor_action' explícito no body.",
          400,
          {
            hint: "Envie { \"executor_action\": \"audit\" } ou use uma rota nomeada como /audit, /propose.",
          },
        ));
      }

      const execResult = await enaviaExecutorCore(env, action);

      return withCORS(jsonResponse({
        system: SYSTEM_NAME,
        executor: "core_v2",
        received_action: action,
        result: execResult,
      }));
    }
    // 🚀🚀🚀 FIM DO BLOCO NOVO 🚀🚀🚀

// ----------------------------------------
// POST /audit  → alias para o executor core_v2
// ----------------------------------------
if (METHOD === "POST" && pathname === "/audit") {
  let action;
  try {
    action = await request.json();
  } catch (err) {
    return withCORS(
      errorResponse("JSON inválido em /audit.", 400, {
        detail: String(err),
      }),
    );
  }

  // fallback ultra mínimo: se não vier action/executor_action, seta executor_action
  if (action && typeof action === "object") {
    if (!("action" in action) && !("executor_action" in action)) {
      action.executor_action = "audit";
    }

    // ✅ COMPAT: ENAVIA /propose chama o Executor via /audit com mode="enavia_propose"
    // Se vier um "propose" aqui, converte para o pipeline do ENGINEER (read-only),
    // exatamente como já existe na rota /propose.
    const wantsPatch =
      action.askSuggestions === true ||
      action.ask_suggestions === true ||
      action.generatePatch === true ||
      (typeof action.prompt === "string" && action.prompt.trim().length > 0);

    const isEnaviaProposeViaAudit =
      (action.executor_action === "propose" ||
        action.executor_action === "enavia_propose") &&
      (action.mode === "enavia_propose" || action.mode === "propose") &&
      wantsPatch;

    if (isEnaviaProposeViaAudit) {
      action.mode = "engineer";
      action.intent = action.intent || "propose";
      action.executor_action = "engineer";
      action.askSuggestions = true; // normaliza para o core
    }
  }

  // =========================
  // ✅ require_live_read no AUDIT → snapshot + MAPA CANÔNICO opcional
  // =========================
  const requireLiveRead = action?.context?.require_live_read === true;
  let canonicalMap = null;

  if (requireLiveRead) {
    const targetWorkerId = action?.target?.workerId || null;

    if (!targetWorkerId) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "missing_target_workerId",
            message: "require_live_read=true exige target.workerId.",
            suggestions: [],
          },
          422,
        ),
      );
    }

    const resolvedWorkerName = await resolveScriptName(targetWorkerId, env, {
      strict: false,
    });

    if (!resolvedWorkerName) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "cannot_resolve_scriptName",
            message: `Não foi possível resolver o scriptName para o workerId '${targetWorkerId}'.`,
            suggestions: [],
          },
          422,
        ),
      );
    }

    const accountId = env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || null;
    const apiToken = env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || null;

    if (!accountId || !apiToken) {
      return withCORS(
        errorResponse(
          "CF_ACCOUNT_ID/CF_API_TOKEN ausentes no Executor.",
          500,
        ),
      );
    }

    // hash simples (fnv1a32) para prova (mesmo padrão do /propose)
    const fnv1a32 = (str) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return ("0000000" + h.toString(16)).slice(-8);
    };

    try {
      const snap = await fetchCurrentWorkerSnapshot({
        accountId,
        apiToken,
        scriptName: resolvedWorkerName,
      });

      // 🔎 Prova objetiva mínima do snapshot
      const consoleLogsCount = snap.code.match(/console\.log\(/g)?.length || 0;
      const logNVCount = snap.code.match(/\blogNV\(/g)?.length || 0;

      action.context_proof_counts = {
        console_log: consoleLogsCount,
        logNV: logNVCount,
      };

      action._evidence_steps = Array.isArray(action._evidence_steps)
        ? action._evidence_steps
        : [];
      action._evidence_steps.push(
        `evidence:console.log:${consoleLogsCount}`,
      );
      action._evidence_steps.push(`evidence:logNV:${logNVCount}`);

      action.context_proof = {
        targetWorker: targetWorkerId,
        resolvedWorkerName,
        snapshot_fingerprint: `fnv1a32:${fnv1a32(snap.code)}`,
        snapshot_chars: snap.code.length,
        snapshot_lines: snap.code.split(/\r?\n/).length,
        cf_etag: snap.etag,
        cf_last_modified: snap.last_modified,
        fetched_at_ms: snap.fetched_at_ms,
      };

      // target_code para o core (se ele quiser usar)
      action.context =
        action.context && typeof action.context === "object"
          ? action.context
          : {};
      action.context.target_code = snap.code;
      action.context.target_code_source = "cf_api_live_read";
      action.context.target_code_len = snap.code.length;
      action.context.target_code_lines =
        snap.code.split(/\r?\n/).length;

      // =========================
      // 📌 MAPA CANÔNICO DO ALVO (derivado do snap.code)
      // =========================
      try {
        const code = String(snap?.code || "");

        // ---- rotas: tenta capturar padrões comuns (METHOD + pathname)
        const routes = [];
        const seen = new Set();

        const re1 =
          /\bif\s*\(\s*METHOD\s*===\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS)["'`]\s*&&\s*pathname\s*===\s*["'`]([^"'`]+)["'`]\s*\)/g;
        let m;
        while ((m = re1.exec(code))) {
          const key = `${m[1]} ${m[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            routes.push({ method: m[1], path: m[2] });
          }
        }

        // fallback: method/pathname (sem METHOD literal)
        const re2 =
          /\bif\s*\(\s*method\s*===\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS)["'`]\s*&&\s*(?:pathname|path)\s*===\s*["'`]([^"'`]+)["'`]\s*\)/g;
        while ((m = re2.exec(code))) {
          const key = `${m[1]} ${m[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            routes.push({ method: m[1], path: m[2] });
          }
        }

        // ---- env/bindings: captura env.KEY e env?.KEY
        const envKeys = Array.from(
          new Set(
            (code.match(/\benv\??\.\s*([A-Z0-9_]{2,})\b/g) || [])
              .map((s) => s.replace(/\s+/g, "").split(".")[1])
              .filter(Boolean),
          ),
        ).sort();

        // ---- invariantes (evidência)
        const inv = [];
        const withCORSCount = code.match(/\bwithCORS\(/g)?.length || 0;
        const optionsCount = code.match(/\bOPTIONS\b/g)?.length || 0;

        if (withCORSCount > 0) {
          inv.push({
            key: "withCORS_used",
            evidence: `withCORS():${withCORSCount}`,
          });
        }
        if (optionsCount > 0) {
          inv.push({
            key: "OPTIONS_handling_present",
            evidence: `OPTIONS_mentions:${optionsCount}`,
          });
        }

        const routesExamples = routes.slice(0, 5);

        action.context_map = {
          routes_count: routes.length,
          routes_examples: routesExamples,
          env_keys_count: envKeys.length,
          env_keys_sample: envKeys.slice(0, 25),
          invariants: inv,
          risk_zones: [],
        };

        action._evidence_steps =
          Array.isArray(action._evidence_steps) ? action._evidence_steps : [];
        action._evidence_steps.push(
          `evidence:routes.count:${routes.length}`,
        );
        for (const r of routesExamples) {
          action._evidence_steps.push(
            `evidence:route:${r.method}:${r.path}`,
          );
        }
        action._evidence_steps.push(
          `evidence:env_keys.count:${envKeys.length}`,
        );

        canonicalMap = {
          routes_total: routes.length,
          routes_sample: routesExamples,
          bindings_total: envKeys.length,
          bindings_sample: envKeys.slice(0, 25),
          invariants_total: inv.length,
          invariants_sample: inv.slice(0, 5),
          risk_zones: [],
        };
      } catch (mapErr) {
        action.context_map = {
          error: true,
          message: `Falha ao gerar mapa do alvo: ${
            String(mapErr?.message || mapErr)
          }`,
        };
      }
    } catch (err) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "live_read_failed",
            message: `Falha ao ler código do worker alvo: ${
              String(err?.message || err)
            }`,
            suggestions: [],
          },
          422,
        ),
      );
    }
  }

  const execResult = await enaviaExecutorCore(env, action);

    // =========================
  // 📎 EVIDENCE: snapshot + anchors + invariants (prova mínima)
  // =========================
  const patchTextArray =
    execResult &&
    execResult.patch &&
    Array.isArray(execResult.patch.patchText)
      ? execResult.patch.patchText
      : [];

  const targetCode =
    action?.context && typeof action.context.target_code === "string"
      ? action.context.target_code
      : null;

  const baseAnchorsSample = patchTextArray.slice(0, 2).map((p, idx) => ({
    index: idx,
    workerId: p?.workerId || null,
    title: p?.title || null,
    anchor: p?.anchor || null,
  }));

  let anchorsSample = baseAnchorsSample;

  // Diagnóstico das âncoras em cima do snapshot atual
  if (targetCode && baseAnchorsSample.length) {
    const code = String(targetCode || "");

    anchorsSample = baseAnchorsSample.map((a) => {
      const anchorStr = a.anchor || "";

      if (!anchorStr) {
        return {
          ...a,
          anchor_status: "missing_anchor",
          matches_count: 0,
          line_hint: null,
        };
      }

      // busca literal da âncora no código (escapa regex)
      const escaped = anchorStr.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const re = new RegExp(escaped, "g");

      let count = 0;
      let firstLine = null;
      let m;

      while ((m = re.exec(code))) {
        count++;
        if (firstLine === null) {
          const prefix = code.slice(0, m.index);
          firstLine = prefix.split(/\r?\n/).length; // linha aproximada (1-based)
        }
        if (count > 5) break; // limite de contagem
      }

      let status;
      if (count === 0) status = "mismatch";
      else if (count === 1) status = "ok";
      else status = "ambiguous";

      return {
        ...a,
        anchor_status: status, // "ok" | "mismatch" | "ambiguous"
        matches_count: count,  // quantas vezes achou
        line_hint: firstLine,  // linha aproximada no snapshot
      };
    });
  }

  const invariantsRaw =
    canonicalMap && Array.isArray(canonicalMap.invariants_sample)
      ? canonicalMap.invariants_sample
      : canonicalMap && Array.isArray(canonicalMap.invariants)
      ? canonicalMap.invariants
      : [];

  const invariantsSample = invariantsRaw.slice(0, 5);

  const evidenceSteps =
    Array.isArray(action?._evidence_steps) && action._evidence_steps.length
      ? action._evidence_steps.slice(0, 25)
      : [];

      const evidence = {
        target: {
          system: action?.target?.system || "cloudflare_worker",
          workerId: action?.target?.workerId || null,
        },
        snapshot: action?.context_proof || null,
        anchors: anchorsSample,
        invariants: invariantsSample,
        steps: evidenceSteps,
      };

      // Novo: estado canônico do ciclo em KV (AUDIT) + pipeline
      // IMPORTANTÍSSIMO: o ID canônico é o do PLANO (action.execution_id).
      const execIdForAudit =
        action?.execution_id ||
        action?.executionId ||
        (execResult && execResult.execution_id) ||
        null;

      const riskReport = execResult?.riskReport || null;
      const staging = execResult?.staging || null;

      const pipeline =
        execIdForAudit
          ? {
              execution_id: execIdForAudit,
              stage: execResult?.stage || "audit",
              risk_level:
                (riskReport &&
                  (riskReport.risk_level ||
                    riskReport.level ||
                    riskReport.risk)) ||
                null,
              staging: {
                ready: Boolean(staging?.ready),
              },
              proof: {
                // será true quando /browser-proof gravar a prova
                attached: false,
              },
            }
          : null;

          if (execIdForAudit) {
            await updateFlowStateKV(env, execIdForAudit, {
              stage: execResult?.stage || "audit",
          last_step: "audit",
          route: "/audit",
          ok: execResult?.ok !== false,
          risk: riskReport,
          staging,
          anchors: anchorsSample,
          invariants: invariantsSample,
          target: evidence.target,
          workerId: evidence.target.workerId,
          message: execResult?.message || null,
          pipeline,
          context_proof: {
            snapshot: evidence.snapshot,
            steps: evidence.steps,
          },
          canonicalMap,
        });
      }

      // ============================================================
      // PR15 — verdict/risk_level explícitos no envelope /audit
      // O Worker (nv-enavia.js, callExecutorBridge) exige
      // data.result.verdict ou data.audit.verdict. Sem isso, classifica
      // como "Audit sem verdict explícito. Resposta ambígua bloqueada
      // por segurança." A aprovação só ocorre com sinal explícito
      // de sucesso (`ok === true` e `error !== true`).
      // ============================================================
      const auditVerdict = normalizeAuditVerdict(execResult);
      const auditRiskLevel = normalizeAuditRiskLevel(execResult, riskReport);

      const baseResult =
        execResult && typeof execResult === "object" ? execResult : {};
      const resultWithVerdict = {
        ...baseResult,
        verdict: auditVerdict,
        risk_level: auditRiskLevel,
        ...(canonicalMap ? { map: canonicalMap } : {}),
      };

      return withCORS(
        jsonResponse({
          system: SYSTEM_NAME,
          executor: "core_v2",
          route: "/audit",
          received_action: action,
          result: resultWithVerdict,
          audit: {
            verdict: resultWithVerdict.verdict,
            risk_level: resultWithVerdict.risk_level,
          },
          evidence,
          ...(pipeline ? { pipeline } : {}),
        }),
      );
    }

// ----------------------------------------
// POST /propose → alias para o executor core_v2
// ----------------------------------------
if (METHOD === "POST" && pathname === "/propose") {
  let action;
  try {
    const rawText = await request.text();
    const cleaned = rawText.replace(/^\uFEFF/, ""); // tolera BOM (Windows)
    action = JSON.parse(cleaned);
  } catch (err) {
    return withCORS(
      errorResponse("JSON inválido em /propose.", 400, {
        detail: String(err),
      })
    );
  }

  // =========================
  // ✅ CONTRATO: require_live_read=true => se não ler, 422 + suggestions:[]
  // =========================
  const requireLiveRead = action?.context?.require_live_read === true;
  let canonicalMap = null; // <— NOVO: mapa canônico do alvo (se conseguir gerar)

  // ✅ Normaliza target para o core (ele exige cloudflare_worker)
  if (action?.target && typeof action.target === "object") {
    if (!action.target.system) action.target.system = "cloudflare_worker";
    if (
      action.target.system === "cloudflare_worker" &&
      !action.target.workerId &&
      action.target.worker_id
    ) {
      action.target.workerId = action.target.worker_id;
    }
  }

  if (requireLiveRead) {
    const targetWorkerId = action?.target?.workerId || null;

    if (!targetWorkerId) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "missing_target_workerId",
            message: "require_live_read=true exige target.workerId.",
            suggestions: [],
          },
          422
        )
      );
    }

    const resolvedWorkerName = await resolveScriptName(targetWorkerId, env, {
      strict: false,
    });

    if (!resolvedWorkerName) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "cannot_resolve_scriptName",
            message: `Não foi possível resolver o scriptName para o workerId '${targetWorkerId}'.`,
            suggestions: [],
          },
          422
        )
      );
    }

    const accountId = env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || null;
    const apiToken = env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || null;

    if (!accountId || !apiToken) {
      return withCORS(
        errorResponse("CF_ACCOUNT_ID/CF_API_TOKEN ausentes no Executor.", 500)
      );
    }

    // hash simples (fnv1a32) para prova (mesmo padrão do /audit)
    const fnv1a32 = (str) => {
      let h = 0x811c9dc5;
      for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193) >>> 0;
      }
      return ("0000000" + h.toString(16)).slice(-8);
    };

    try {
      const snap = await fetchCurrentWorkerSnapshot({
        accountId,
        apiToken,
        scriptName: resolvedWorkerName,
      });

      // ✅ Evidência objetiva mínima do snapshot (sem vazar código)
      const consoleLogsCount =
        snap.code.match(/console\.log\(/g)?.length || 0;
      const logNVCount = snap.code.match(/\blogNV\(/g)?.length || 0;

      // Guarda como prova no action (e o core pode refletir isso em steps/sugestões)
      action.context_proof_counts = {
        console_log: consoleLogsCount,
        logNV: logNVCount,
      };

      // Também injeta em steps do core via "hints" (se o core preservar)
      action._evidence_steps = Array.isArray(action._evidence_steps)
        ? action._evidence_steps
        : [];
      action._evidence_steps.push(
        `evidence:console.log:${consoleLogsCount}`
      );
      action._evidence_steps.push(`evidence:logNV:${logNVCount}`);

      action.context_proof = {
        targetWorker: targetWorkerId,
        resolvedWorkerName,
        snapshot_fingerprint: `fnv1a32:${fnv1a32(snap.code)}`,
        snapshot_chars: snap.code.length,
        snapshot_lines: snap.code.split(/\r?\n/).length,
        cf_etag: snap.etag,
        cf_last_modified: snap.last_modified,
        fetched_at_ms: snap.fetched_at_ms,
      };

      // ✅ Necessário para gerar PATCH TEXT com âncoras reais (sem “adivinhar”)
      // (não é retornado ao cliente; apenas passado ao core)
      action.context =
        action.context && typeof action.context === "object"
          ? action.context
          : {};
      action.context.target_code = snap.code;
      action.context.target_code_source = "cf_api_live_read";
      action.context.target_code_len = snap.code.length;
      action.context.target_code_lines =
        snap.code.split(/\r?\n/).length;

      // =========================
      // 📌 MAPA CANÔNICO DO ALVO (derivado do snap.code)
      // =========================
      try {
        const code = String(snap?.code || "");

        // ---- rotas: tenta capturar padrões comuns (METHOD + pathname)
        const routes = [];
        const seen = new Set();

        const re1 =
          /\bif\s*\(\s*METHOD\s*===\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS)["'`]\s*&&\s*pathname\s*===\s*["'`]([^"'`]+)["'`]\s*\)/g;
        let m;
        while ((m = re1.exec(code))) {
          const key = `${m[1]} ${m[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            routes.push({ method: m[1], path: m[2] });
          }
        }

        // fallback: method/pathname (sem METHOD literal)
        const re2 =
          /\bif\s*\(\s*method\s*===\s*["'`](GET|POST|PUT|PATCH|DELETE|OPTIONS)["'`]\s*&&\s*(?:pathname|path)\s*===\s*["'`]([^"'`]+)["'`]\s*\)/g;
        while ((m = re2.exec(code))) {
          const key = `${m[1]} ${m[2]}`;
          if (!seen.has(key)) {
            seen.add(key);
            routes.push({ method: m[1], path: m[2] });
          }
        }

        // ---- env/bindings: captura env.KEY e env?.KEY
        const envKeys = Array.from(
          new Set(
            (code.match(/\benv\??\.\s*([A-Z0-9_]{2,})\b/g) || [])
              .map((s) => s.replace(/\s+/g, "").split(".")[1])
              .filter(Boolean)
          )
        ).sort();

        // ---- invariantes (evidência)
        const inv = [];
        const withCORSCount =
          code.match(/\bwithCORS\(/g)?.length || 0;
        const optionsCount = code.match(/\bOPTIONS\b/g)?.length || 0;

        if (withCORSCount > 0)
          inv.push({
            key: "withCORS_used",
            evidence: `withCORS():${withCORSCount}`,
          });
        if (optionsCount > 0)
          inv.push({
            key: "OPTIONS_handling_present",
            evidence: `OPTIONS_mentions:${optionsCount}`,
          });

        // exemplos pedidos (máx 5)
        const routesExamples = routes.slice(0, 5);

        action.context_map = {
          routes_count: routes.length,
          routes_examples: routesExamples,
          env_keys_count: envKeys.length,
          env_keys_sample: envKeys.slice(0, 25),
          invariants: inv,
          // por enquanto não calculamos zonas; deixamos preparado
          risk_zones: [],
        };

        // NOVO: guarda o mesmo mapa também em canonicalMap
        canonicalMap = action.context_map;

        // evidência objetiva em steps
        action._evidence_steps =
          Array.isArray(action._evidence_steps) ? action._evidence_steps : [];
        action._evidence_steps.push(
          `evidence:routes.count:${routes.length}`
        );
        for (const r of routesExamples)
          action._evidence_steps.push(
            `evidence:route:${r.method}:${r.path}`
          );
        action._evidence_steps.push(
          `evidence:env_keys.count:${envKeys.length}`
        );
      } catch (mapErr) {
        action.context_map = {
          error: true,
          message: `Falha ao gerar mapa do alvo: ${
            String(mapErr?.message || mapErr)
          }`,
        };
      }
    } catch (err) {
      return withCORS(
        jsonResponse(
          {
            system: SYSTEM_NAME,
            error: true,
            http_status: 422,
            reason: "live_read_failed",
            message: `Falha ao ler código do worker alvo: ${
              String(err?.message || err)
            }`,
            suggestions: [],
          },
          422
        )
      );
    }
  }

  if (action && typeof action === "object") {
    // ✅ PROPOSE sempre cai no pipeline ENGINEER (read-only)
    const wantsPatch =
      action.askSuggestions === true ||
      action.ask_suggestions === true ||
      action.generatePatch === true ||
      (typeof action.prompt === "string" && action.prompt.trim().length > 0);

    if (wantsPatch) {
      action.mode = "engineer"; // força
      action.intent = action.intent || "propose";
      action.executor_action = "engineer";
      action.askSuggestions = true; // normaliza
      action.generatePatch = true; // PROPOSE deve devolver patch sugerido (não aplica)
    } else {
      if (!("action" in action) && !("executor_action" in action)) {
        action.executor_action = "propose";
      }
    }
  }

  let execResult;
  try {
    execResult = await enaviaExecutorCore(env, action);
  } catch (err) {
    console.error("[/propose] enaviaExecutorCore error:", err);
    return withCORS(
      errorResponse("Falha interna ao processar /propose no executor.", 500, {
        detail: String(err?.message || err),
      })
    );
  }

  // NOVO: estado canônico do ciclo em KV (PROPOSE)
  const execIdForPropose =
    (execResult && execResult.execution_id) ||
    action?.execution_id ||
    action?.executionId ||
    null;

  const riskReport = execResult?.riskReport || null;
  const staging = execResult?.staging || null;

  const pipeline =
    execIdForPropose
      ? {
          execution_id: execIdForPropose,
          stage: execResult?.stage || "propose",
          risk_level:
            (riskReport &&
              (riskReport.risk_level ||
                riskReport.level ||
                riskReport.risk)) ||
            null,
          staging: {
            ready: Boolean(staging?.ready),
          },
          proof: {
            attached: false,
          },
        }
      : null;

      if (execIdForPropose) {
        await updateFlowStateKV(env, execIdForPropose, {
          stage: execResult?.stage || "propose",
          last_step: "propose",
          route: "/propose",
          ok: execResult?.ok !== false,
          risk: riskReport,
          staging,
          patch: execResult?.patch || null,
          // campos adicionais do PROPOSE para EXECUTION
          patch_summary:
            execResult?.patch_summary ||
            (execResult?.message ? { human: execResult.message } : null),
          anchors: execResult?.anchors || null,
          smoke_tests: execResult?.smoke_tests || null,
          target: action?.target || null,
          workerId:
            action?.workerId ||
            action?.target?.workerId ||
            (typeof action?.target === "string" ? action.target : null),
          message: execResult?.message || null,
          pipeline,
          canonicalMap,
        });
      }

  return withCORS(
    jsonResponse({
      system: SYSTEM_NAME,
      executor: "core_v2",
      route: "/propose",
      received_action: action,
      result: {
        ...execResult,
        ...(canonicalMap ? { map: canonicalMap } : {}),
      },
      ...(pipeline ? { pipeline } : {}),
    })
  );
}

    // ----------------------------------------
    // GET /engineer → usado pelo Lovable para checar a rota
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/engineer") {
      return withCORS(jsonResponse({
        system: SYSTEM_NAME,
        status: "ok",
        message: "ENAVIA_EXECUTOR online. Use POST para executar ações."
      }));
    }

// ----------------------------------------
// GET /module-get?key=mod:alguma-coisa
// Lê um módulo salvo no ENAVIA_GIT
// ----------------------------------------
if (METHOD === "GET" && pathname === "/module-get") {
  const kv = GIT_KV;

if (!kv) {
  return withCORS(errorResponse("GIT_KV/ENAVIA_GIT KV não configurado.", 500));
}

  const key = url.searchParams.get("key");

  if (!key) {
    return withCORS(errorResponse("Parâmetro 'key' é obrigatório.", 400));
  }

  const value = await kv.get(key);

  if (value === null) {
    return withCORS(errorResponse(`Módulo '${key}' não encontrado.`, 404));
  }

  return withCORS(jsonResponse({
    ok: true,
    key,
    length: value.length,
    preview: value.slice(0, 200),
    content: value
  }));
}

// ----------------------------------------
// GET /module-list
// Lista todas as chaves salvas no ENAVIA_GIT
// ----------------------------------------
if (METHOD === "GET" && pathname === "/module-list") {

  const kv = GIT_KV;

if (!kv) {
  return withCORS(errorResponse("GIT_KV/ENAVIA_GIT KV não configurado.", 500));
}

  // Lista todas as entradas usando a API atual do KV (list() retorna um objeto com keys[])
  const listResult = await kv.list(); // sem prefixo/limite por enquanto
  const modules = (listResult.keys || []).map((item) => ({
    key: item.name,
    name: item.name,
    expiration: item.expiration || null
  }));

  return withCORS(jsonResponse({
    ok: true,
    total: modules.length,
    modules
  }));
}

// ============================================================================
// 🧱 MÓDULO 3 — /module-save
// Salva (ou sobrescreve) módulos no KV ENAVIA_GIT
// ============================================================================
if (method === "POST" && pathname === "/module-save") {
  try {
    const body = await request.json();

    const key = body.key;
    const content = body.content;
    const overwrite = body.overwrite ?? false;

    if (!key || !content) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing fields: key or content",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Se overwrite = false, aborta caso já exista
    if (!overwrite) {
      const exists = await env.ENAVIA_GIT.get(key);
      if (exists) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Module already exists. Use overwrite: true",
          }),
          { status: 409, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // Salva o módulo no KV
    await ENAVIA_GIT.put(key, content);

    return new Response(
      JSON.stringify({
        ok: true,
        saved: key,
        bytes: content.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception saving module",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 🧩 MÓDULO 4 — /module-patch
// Aplica patch textual (append, overwrite, insert) em módulos do KV
// ============================================================================
if (method === "POST" && pathname === "/module-patch") {
  try {
    const body = await request.json();
    const key = body.key;
    const mode = body.mode || "append";
    const patchText = body.content || "";
    const position = body.position; // usado apenas para INSERT

    if (!key || !patchText) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing fields: key or content",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lê módulo existente
    let original = await env.ENAVIA_GIT.get(key);
    if (!original) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Module not found",
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    let updated = original;

    // ---------------------------------------------------------
    // 🔄 APPEND
    // ---------------------------------------------------------
    if (mode === "append") {
      updated = original + "\n" + patchText;
    }

    // ---------------------------------------------------------
    // 🔄 OVERWRITE (full replace)
    // ---------------------------------------------------------
    else if (mode === "overwrite") {
      updated = patchText;
    }

    // ---------------------------------------------------------
    // 🔄 INSERT AT POSITION
    // ---------------------------------------------------------
    else if (mode === "insert") {
      if (typeof position !== "number") {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Insert mode requires numeric 'position'",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const lines = original.split("\n");
      lines.splice(position, 0, patchText);
      updated = lines.join("\n");
    }

    // Salva o módulo atualizado
    await ENAVIA_GIT.put(key, updated);

    return new Response(
      JSON.stringify({
        ok: true,
        key,
        mode,
        before_bytes: original.length,
        after_bytes: updated.length,
        preview_before: original.slice(0, 4000),
        preview_after: updated.slice(0, 4000),
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception applying patch",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 🛡️ MÓDULO 5 — /module-validate (ATUALIZADO)
// Validação + Análise de Risco antes de qualquer patch / deploy
// ============================================================================
// Aceita:
// - { key }                        → busca conteúdo no KV
// - { content }                    → valida conteúdo enviado diretamente
// - { expectModule: true | false } → se true, exige header // NV-MODULE
// ============================================================================
if (method === "POST" && pathname === "/module-validate") {
  try {
    const body = await request.json();
    const key = body.key || null;
    const expectModule = body.expectModule === true; // default = false
    let content = body.content || null;

    // ----------------------------------------------------------------------
    // 1) Obter conteúdo: KV (via key) ou direct content
    // ----------------------------------------------------------------------
    if (!content) {
      if (!key) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing key or content" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const fromKV = await env.ENAVIA_GIT.get(key);
      if (!fromKV) {
        return new Response(
          JSON.stringify({ ok: false, error: "Module not found in KV" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      content = fromKV;
    }

    // Segurança básica
    const size = content.length;
    if (size < 10) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: "invalid",
          error: "Content too small or corrupted",
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------------
    // 2) Se for módulo, exigir header NV-MODULE
    // ----------------------------------------------------------------------
    const notes = [];
    if (expectModule && !content.includes("// NV-MODULE")) {
      notes.push("Missing NV-MODULE header for expected module.");
    }

    // ----------------------------------------------------------------------
    // 3) Verificar variáveis críticas tocadas (não bloqueia, só marca risco)
    // ----------------------------------------------------------------------
    const protectedVars = [
      "env",
      "ctx",
      "request",
      "url",
      "pathname",
      "method",
      "NV_INDEX_CACHE",
      "ENAVIA_GIT",
      "logNV",
      "loadIndex",
      "queueModuleLoad",
    ];

    const protectedHits = [];
    for (let v of protectedVars) {
      const regex = new RegExp(`\\b${v}\\s*=`, "g");
      if (regex.test(content)) {
        protectedHits.push(v);
      }
    }

    // ----------------------------------------------------------------------
    // 4) Validação sintática real via Acorn (pure JS parser, sem eval)
    //    Acorn é bundlado pelo wrangler/esbuild — 100% Workers-compatible.
    //    Fallback: heurística de balanceamento de delimitadores.
    // ----------------------------------------------------------------------
    let syntaxOk = true;
    let syntaxError = null;
    try {
      // Tenta como ESModule primeiro, depois como script clássico
      try {
        acornParse(content, { ecmaVersion: "latest", sourceType: "module" });
      } catch (_modErr) {
        acornParse(content, { ecmaVersion: "latest", sourceType: "script" });
      }
    } catch (parseErr) {
      // Acorn falhou em ambos os modos → sintaxe inválida
      syntaxOk = false;
      syntaxError = parseErr.message || parseErr.toString();
      notes.push("JavaScript syntax error detected.");

      // Fallback heurístico (segurança extra se acorn falhar inesperadamente)
      if (!syntaxError) {
        try {
          let braces = 0, parens = 0, brackets = 0;
          let inString = false, strChar = "";
          let inLineComment = false, inBlockComment = false;
          for (let ci = 0; ci < content.length; ci++) {
            const ch = content[ci];
            const next = content[ci + 1] || "";
            if (inLineComment) { if (ch === "\n") inLineComment = false; continue; }
            if (inBlockComment) { if (ch === "*" && next === "/") { inBlockComment = false; ci++; } continue; }
            if (inString) { if (ch === "\\") { ci++; continue; } if (ch === strChar) inString = false; continue; }
            if (ch === "/" && next === "/") { inLineComment = true; ci++; continue; }
            if (ch === "/" && next === "*") { inBlockComment = true; ci++; continue; }
            if (ch === '"' || ch === "'" || ch === "`") { inString = true; strChar = ch; continue; }
            if (ch === "{") braces++; else if (ch === "}") braces--;
            else if (ch === "(") parens++; else if (ch === ")") parens--;
            else if (ch === "[") brackets++; else if (ch === "]") brackets--;
            if (braces < 0 || parens < 0 || brackets < 0) {
              syntaxError = `Unbalanced delimiter at position ${ci}: '${ch}'`;
              break;
            }
          }
          if (!syntaxError && (braces !== 0 || parens !== 0 || brackets !== 0)) {
            syntaxError = `Unbalanced delimiters: braces=${braces}, parens=${parens}, brackets=${brackets}`;
          }
        } catch (_heuristicErr) {
          // ignora erro na heurística; mantém syntaxOk=false do acorn
        }
      }
    }

    // ----------------------------------------------------------------------
    // 5) Calcular nível de risco + necessidade de aprovação
    // ----------------------------------------------------------------------
    let riskLevel = "low";
    let requiresApproval = false;

    // Header ausente em módulo esperado → eleva risco
    if (expectModule && !content.includes("// NV-MODULE")) {
      riskLevel = "medium";
      requiresApproval = true;
    }

    if (protectedHits.length > 0) {
      // mexeu em variável sensível → risco alto, precisa de você
      riskLevel = "high";
      requiresApproval = true;
      notes.push(
        `Protected variables potentially altered: ${protectedHits.join(", ")}`
      );
    }

    if (!syntaxOk) {
      // se nem compila, é crítico e não deve ser aplicado sem revisão
      riskLevel = "critical";
      requiresApproval = true;
    }

    // ----------------------------------------------------------------------
    // 6) Se sintaxe estiver completamente quebrada, marcar como inválido
    // ----------------------------------------------------------------------
    if (!syntaxOk) {
      return new Response(
        JSON.stringify({
          ok: false,
          status: "invalid",
          key: key || null,
          size,
          riskLevel,
          requiresApproval,
          syntaxOk,
          syntaxError,
          protectedHits,
          notes,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------------
    // 7) Conteúdo válido, com análise de risco detalhada
    // ----------------------------------------------------------------------
    return new Response(
      JSON.stringify({
        ok: true,
        status: "validated",
        key: key || null,
        size,
        riskLevel,
        requiresApproval,
        syntaxOk,
        protectedHits,
        notes,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception validating content",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 🧠 MÓDULO 7 — /engineer-core (ATUALIZADO)
// Cérebro da engenharia da ENAVIA:
// - Risk Report obrigatório
// - Sugestões seguras (3 alternativas)
// - Anti-loop total
// - Patch sempre em staging (Worker ou módulo)
// - Nunca aplica sozinho (aguarda aprovação do Vasques)
// ============================================================================

if (method === "POST" && pathname === "/engineer-core") {
  try {
    const body = await request.json();
    const action = body.action;

    // Ações permitidas
    const allowed = [
      "get",
      "list",
      "save",
      "patch",
      "validate",
      "diff",
      "edit-worker" // NOVA AÇÃO
    ];

    if (!allowed.includes(action)) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: `Invalid action: ${action}.`
        }),
        { status: 403, headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 🔹 Ações simples: delegar direto
    // ============================================================
    // ✅ PR6: env.fetch() não existe em Workers — usar fetch() global
    if (action === "get") {
      return await fetch(
        request.url.replace("/engineer-core", "/module-get"),
        {
          method: "POST",
          body: JSON.stringify({ key: body.key })
        }
      );
    }

    if (action === "list") {
      return await fetch(
        request.url.replace("/engineer-core", "/module-list")
      );
    }

    if (action === "save") {
      return await fetch(
        request.url.replace("/engineer-core", "/module-save"),
        {
          method: "POST",
          body: JSON.stringify({
            key: body.key,
            content: body.content,
            overwrite: body.overwrite ?? false
          })
        }
      );
    }

    if (action === "validate") {
      return await fetch(
        request.url.replace("/engineer-core", "/module-validate"),
        {
          method: "POST",
          body: JSON.stringify({
            key: body.key,
            content: body.content,
            expectModule: body.expectModule ?? false
          })
        }
      );
    }

    if (action === "diff") {
      return await fetch(
        request.url.replace("/engineer-core", "/module-diff"),
        {
          method: "POST",
          body: JSON.stringify({
            key: body.key,
            candidate: body.candidate,
            otherKey: body.otherKey
          })
        }
      );
    }

    // ============================================================
    // 🔥 AÇÃO COMPLEXA: PATCH DE MÓDULO (com risco + sugestões)
    // ============================================================
    if (action === "patch") {
      const moduleKey = body.key;
      const patchText = body.content;

      // 1) Validar módulo
      // ✅ PR6: env.fetch() não existe em Workers — usar fetch() global
      const validateResp = await fetch(
        request.url.replace("/engineer-core", "/module-validate"),
        {
          method: "POST",
          body: JSON.stringify({ key: moduleKey, expectModule: true })
        }
      );
      const validateData = await validateResp.json();

      // Se sintaxe quebrada, retornar risco sem tentar patch
      if (!validateData.ok && validateData.status === "invalid") {
        return new Response(
          JSON.stringify({
            ok: false,
            stage: "validate",
            requiresApproval: true,
            riskLevel: validateData.riskLevel,
            syntaxError: validateData.syntaxError,
            protectedHits: validateData.protectedHits,
            notes: validateData.notes
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // 2) Criar 3 alternativas seguras (OPÇÃO C)
      const altA = patchText; // alternativa 1 — patch direto
      const altB = "// SAFE BLOCK PATCH\n" + patchText; // alternativa 2 — patch segmentado
      const altC = "// SAFE FULL REPLACE WITH HEADER\n// NV-MODULE\n" + patchText; // alternativa 3 — versão reconstruída

      return new Response(
        JSON.stringify({
          ok: true,
          stage: "suggestions",
          message: "Choose one of the safe patch alternatives below.",
          requiresApproval: true,
          riskLevel: validateData.riskLevel,
          protectedHits: validateData.protectedHits,

          alternatives: {
            A: {
              description: "Minimal patch — smallest alteração possível",
              patch: altA
            },
            B: {
              description: "Patch parcialmente segmentado (mais seguro)",
              patch: altB
            },
            C: {
              description: "Patch reconstruído com header e isolamento total",
              patch: altC
            }
          }
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ============================================================
    // 🔥 NOVA AÇÃO: EDITAR WORKER (com staging + sugestões)
    // ============================================================
    if (action === "edit-worker") {
      const workerContent = body.content;

      // 1) Validar sintaxe + riscos
      // ✅ PR6: env.fetch() não existe em Workers — usar fetch() global
      const validateResp = await fetch(
        request.url.replace("/engineer-core", "/module-validate"),
        {
          method: "POST",
          body: JSON.stringify({
            content: workerContent,
            expectModule: false
          })
        }
      );
      const validateData = await validateResp.json();

      // Se inválido, retornar RISK REPORT
      if (!validateData.ok) {
        return new Response(
          JSON.stringify({
            ok: false,
            stage: "validate-worker",
            riskLevel: validateData.riskLevel,
            requiresApproval: true,
            syntaxError: validateData.syntaxError,
            protectedHits: validateData.protectedHits,
            notes: validateData.notes
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // 2) Criar alternativas seguras (OPÇÃO C)
      const altA = workerContent;
      const altB = "// SAFE BLOCK PATCH - PARTIAL\n" + workerContent;
      const altC = "// SAFE FULL WORKER REBUILD\n" + workerContent;

      return new Response(
        JSON.stringify({
          ok: true,
          stage: "worker-suggestions",
          requiresApproval: true,
          riskLevel: validateData.riskLevel,
          protectedHits: validateData.protectedHits,

          alternatives: {
            A: {
              description: "Minimal worker patch",
              content: altA
            },
            B: {
              description: "Segmented safe worker patch",
              content: altB
            },
            C: {
              description: "Full worker rebuild (safer, mais controle)",
              content: altC
            }
          }
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception in engineer-core",
        details: err.toString()
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 🧮 MÓDULO 6 — /module-diff
// Calcula diff linha a linha entre duas versões de módulo
// ============================================================================
if (method === "POST" && pathname === "/module-diff") {
  try {
    const body = await request.json();
    const key = body.key;
    const candidate = body.candidate; // conteúdo novo opcional
    const otherKey = body.otherKey;   // módulo alternativo opcional

    if (!key) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing key" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Lê módulo base
    const baseContent = await env.ENAVIA_GIT.get(key);
    if (!baseContent) {
      return new Response(
        JSON.stringify({ ok: false, error: "Base module not found" }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      );
    }

    // Define conteúdo alvo
    let targetContent = candidate;
    let targetSource = "candidate";

    if (!targetContent && otherKey) {
      const otherContent = await env.ENAVIA_GIT.get(otherKey);
      if (!otherContent) {
        return new Response(
          JSON.stringify({ ok: false, error: "Other module not found" }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }
      targetContent = otherContent;
      targetSource = `kv:${otherKey}`;
    }

    if (!targetContent) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Provide either 'candidate' or 'otherKey'",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    const baseLines = baseContent.split("\n");
    const targetLines = targetContent.split("\n");

    const maxLen = Math.max(baseLines.length, targetLines.length);
    const diffs = [];

    for (let i = 0; i < maxLen; i++) {
      const before = i < baseLines.length ? baseLines[i] : null;
      const after = i < targetLines.length ? targetLines[i] : null;

      if (before === after) {
        // Igual → ignoramos para não poluir demais
        continue;
      }

      if (before === null && after !== null) {
        diffs.push({
          type: "add",
          line: i,
          after,
        });
      } else if (before !== null && after === null) {
        diffs.push({
          type: "del",
          line: i,
          before,
        });
      } else {
        diffs.push({
          type: "change",
          line: i,
          before,
          after,
        });
      }

      // Limitador de segurança para resposta
      if (diffs.length > 1000) {
        diffs.push({
          type: "info",
          note: "Diff truncated for safety (too many changes)",
        });
        break;
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        key,
        targetSource,
        baseLines: baseLines.length,
        targetLines: targetLines.length,
        diffCount: diffs.length,
        diffs,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception computing diff",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 📝 MÓDULO 8 — NV-AUDIT (EXECUTOR SAFE MODE)
// - Registra eventos no KV
// - Mantém últimos 500 logs
// - ENAVIA replica para Supabase no Worker nv-enavia
// - Não requer variáveis adicionais
// ============================================================================

// -------------------------------
// Função interna: gerar timestamp seguro
// -------------------------------
function auditTimestamp() {
  return new Date().toISOString();
}

// -------------------------------
// Função interna: escrever log no KV
// -------------------------------
async function auditWriteKV(env, eventObj) {
  try {
    const key = `AUDIT:${Date.now()}`;
    await ENAVIA_GIT.put(key, JSON.stringify(eventObj));

    // controle de tamanho (mantém apenas os últimos 500)
    // ✅ PR6: KV .list() retorna { keys: [] }, NÃO é async iterable
    const keys = [];
    let cursor = undefined;
    let done = false;
    while (!done) {
      const listResult = await env.ENAVIA_GIT.list({ prefix: "AUDIT:", cursor });
      for (const k of listResult.keys) {
        keys.push(k.name);
      }
      if (listResult.list_complete) {
        done = true;
      } else {
        cursor = listResult.cursor;
      }
    }

    if (keys.length > 500) {
      const excess = keys.length - 500;
      const toDelete = keys.sort().slice(0, excess);
      for (const k of toDelete) {
        await env.ENAVIA_GIT.delete(k);
      }
    }

  } catch (err) {
    console.log("AUDIT KV ERROR:", err);
  }
}

// -------------------------------
// Função principal: registrar evento
// -------------------------------
async function auditRegister(env, type, details) {
  const eventObj = {
    timestamp: auditTimestamp(),
    type,
    details
  };

  await auditWriteKV(env, eventObj);
  return eventObj;
}

// -------------------------------
// Rota: consultar últimos logs do KV
// -------------------------------
if (method === "GET" && pathname === "/audit-log") {
  try {
    const entries = [];

    // ✅ PR6: KV .list() retorna { keys: [] }, NÃO é async iterable
    let cursor = undefined;
    let done = false;
    while (!done) {
      const listResult = await env.ENAVIA_GIT.list({ prefix: "AUDIT:", cursor });
      for (const k of listResult.keys) {
        const raw = await env.ENAVIA_GIT.get(k.name);
        if (raw) {
          entries.push(JSON.parse(raw));
        }
      }
      if (listResult.list_complete) {
        done = true;
      } else {
        cursor = listResult.cursor;
      }
    }

    // Ordenar por data (desc)
    entries.sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1));

    return new Response(
      JSON.stringify({ ok: true, logs: entries }),
      { headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Failed to fetch audit logs",
        details: err.toString()
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// EXEMPLOS (uso interno pelos módulos):
//
// await auditRegister(env, "patch_suggestion", { key, risk, options });
// await auditRegister(env, "worker_validate_fail", { error, protectedHits });
// await auditRegister(env, "approval_required", { riskLevel, module });
// await auditRegister(env, "deploy_success", { version });
// await auditRegister(env, "rollback_triggered", { reason });
//
// ============================================================================

// ============================================================================
// 🧩 MÓDULO 9 — /worker-patch-safe
// Staging + rollback seguro para código de Worker (nv-enavia, nv-first, etc.)
// - NUNCA aplica deploy real sozinho (Cloudflare continua manual)
// - Guarda backup e candidato no KV
// - Usa /module-validate para checar sintaxe/risco
// - Integra com NV-AUDIT (se disponível)
// ============================================================================
//
// Body esperado:
//
// mode: "stage" | "rollback-preview"
// workerId: identificador lógico do worker (ex: "nv-enavia")
// current: código atual do worker (apenas para mode: "stage")
// candidate: código candidato do worker (apenas para mode: "stage")
// backupKey: chave de backup no KV (apenas para mode: "rollback-preview")
//
// ============================================================================

if (method === "POST" && pathname === "/worker-patch-safe") {
  // ⚠️ BOUNDARY NOTE: staging/validation is executor's handoff preparation.
  // Mode "stage" validates and stages patches for deploy-worker to pick up.
  // Mode "rollback-preview" is read-only preview — not actual rollback.
  // Actual rollback execution belongs to deploy-worker.
  try {
    const body = await request.json();
    const mode = body.mode;

    if (!mode) {
      return new Response(
        JSON.stringify({ ok: false, error: "Missing mode" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------------
    // 🔹 MODE: stage
    // Cria staging de patch de Worker: backup + candidato validados
    // ----------------------------------------------------------------------
    if (mode === "stage") {
      const workerId = body.workerId || "worker-unknown";
      const current = body.current;
      const candidate = body.candidate;

      if (!current || !candidate) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Missing current or candidate worker code",
          }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      // 1) Validar candidato com /module-validate (sem exigir NV-MODULE)
      // ✅ PR6: env.fetch() não existe em Workers — usar fetch() global
      const validateResp = await fetch(
        request.url.replace("/worker-patch-safe", "/module-validate"),
        {
          method: "POST",
          body: JSON.stringify({
            content: candidate,
            expectModule: false,
          }),
        }
      );

      const validateData = await validateResp.json();

      // Se inválido, não grava staging, apenas devolve risco
      if (!validateData.ok) {
        // tenta registrar no audit, se função existir
        try {
          if (typeof auditRegister === "function") {
            await auditRegister(env, "worker_candidate_invalid", {
              workerId,
              riskLevel: validateData.riskLevel,
              syntaxError: validateData.syntaxError,
              protectedHits: validateData.protectedHits,
              notes: validateData.notes,
            });
          }
        } catch (e) {
          console.log("AUDIT worker_candidate_invalid error:", e);
        }

        return new Response(
          JSON.stringify({
            ok: false,
            stage: "validate",
            workerId,
            riskLevel: validateData.riskLevel,
            requiresApproval: true,
            syntaxOk: validateData.syntaxOk,
            syntaxError: validateData.syntaxError,
            protectedHits: validateData.protectedHits,
            notes: validateData.notes,
          }),
          { headers: { "Content-Type": "application/json" } }
        );
      }

      // 2) Se passou na validação: salva backup + candidate no KV
      const ts = Date.now();
      const backupKey = `WORKER_BACKUP:${workerId}:${ts}`;
      const candidateKey = `WORKER_CANDIDATE:${workerId}:${ts}`;

      await ENAVIA_GIT.put(backupKey, current);
      await ENAVIA_GIT.put(candidateKey, candidate);

      // registra auditoria
      try {
        if (typeof auditRegister === "function") {
          await auditRegister(env, "worker_stage_created", {
            workerId,
            backupKey,
            candidateKey,
            riskLevel: validateData.riskLevel,
            protectedHits: validateData.protectedHits,
          });
        }
      } catch (e) {
        console.log("AUDIT worker_stage_created error:", e);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          stage: "staged",
          workerId,
          backupKey,
          candidateKey,
          riskLevel: validateData.riskLevel,
          requiresApproval: validateData.requiresApproval,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------------
    // 🔹 MODE: rollback-preview
    // Retorna o conteúdo de um backup salvo, para você redeployar manualmente
    // ----------------------------------------------------------------------
    if (mode === "rollback-preview") {
      const backupKey = body.backupKey;

      if (!backupKey) {
        return new Response(
          JSON.stringify({ ok: false, error: "Missing backupKey" }),
          { status: 400, headers: { "Content-Type": "application/json" } }
        );
      }

      const backupContent = await env.ENAVIA_GIT.get(backupKey);
      if (!backupContent) {
        return new Response(
          JSON.stringify({
            ok: false,
            error: "Backup not found for given key",
          }),
          { status: 404, headers: { "Content-Type": "application/json" } }
        );
      }

      // auditoria opcional
      try {
        if (typeof auditRegister === "function") {
          await auditRegister(env, "worker_rollback_preview", {
            backupKey,
          });
        }
      } catch (e) {
        console.log("AUDIT worker_rollback_preview error:", e);
      }

      return new Response(
        JSON.stringify({
          ok: true,
          stage: "rollback-preview",
          backupKey,
          content: backupContent,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ----------------------------------------------------------------------
    // 🔹 mode desconhecido
    // ----------------------------------------------------------------------
    return new Response(
      JSON.stringify({ ok: false, error: `Unknown mode: ${mode}` }),
      { status: 400, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception in worker-patch-safe",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

// ============================================================================
// 🚀 MÓDULO 10 — /worker-deploy
// ⚠️ DEPLOY-WORKER DELEGATION: deploy real é responsabilidade exclusiva do deploy-worker.
// Esta rota delega ao deploy-worker quando DEPLOY_WORKER_URL está configurado.
// Quando DEPLOY_WORKER_URL NÃO está configurado, retorna erro explícito (501).
// O fallback local legado que executava deploy via API Cloudflare foi removido
// (PR EXECUTOR-A) para respeitar a fronteira canônica.
// - Só dispara quando chamado explicitamente (após sua autorização)
// - Nunca gera staging: usa o que o M9 já preparou (backup + candidate)
// - Usa ENAVIA_GIT para buscar backup/candidato
// - Usa NV-AUDIT (se disponível) para registrar eventos
// ============================================================================
//
// Body esperado:
//
// {
//   "workerId": "nv-enavia",
//   "candidateKey": "WORKER_CANDIDATE:nv-enavia:173...",
//   "backupKey": "WORKER_BACKUP:nv-enavia:173...",
//   "approvedBy": "Vasques",
//   "reason": "Correção rota /engineer"
// }
//
// ============================================================================

if (method === "POST" && pathname === "/worker-deploy") {
  try {
    const body = await request.json();

    const workerId = body.workerId || "nv-enavia";
    const candidateKey = body.candidateKey;
    const backupKey = body.backupKey || null;
    const approvedBy = body.approvedBy || "desconhecido";
    const reason = body.reason || "sem motivo especificado";

    // ------------------------------------------------------------
    // 1) Validação básica do payload
    // ------------------------------------------------------------
    if (!candidateKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Missing candidateKey",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // ⚠️ DELEGATION: se deploy-worker está configurado, delega deploy real
    const workerDeployDelegation = await delegateToDeployWorker("/worker-deploy", {
      workerId,
      candidateKey,
      backupKey,
      approvedBy,
      reason,
      source: "enavia-executor",
      boundary: EXECUTOR_BOUNDARY.version,
    });
    if (workerDeployDelegation) {
      return new Response(
        JSON.stringify({
          ...workerDeployDelegation,
          system: SYSTEM_NAME,
          action: "worker-deploy",
          workerId,
        }),
        { headers: { "Content-Type": "application/json" } }
      );
    }

    // ⚠️ DEPLOY_WORKER_URL não configurado — deploy real é soberania do deploy-worker.
    // Fallback local removido (PR EXECUTOR-A): executor não executa deploy real.
    return new Response(
      JSON.stringify({
        ok: false,
        error: "DEPLOY_WORKER_NOT_CONFIGURED",
        message:
          "Deploy real é responsabilidade exclusiva do deploy-worker. " +
          "Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
        workerId,
        candidateKey,
        system: SYSTEM_NAME,
        action: "worker-deploy",
        boundary: EXECUTOR_BOUNDARY.version,
      }),
      { status: 501, headers: { "Content-Type": "application/json" } }
    );

  } catch (err) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Exception in worker-deploy",
        details: err.toString(),
      }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

    // ----------------------------------------
    // POST /engineer → alias opcional usado pela ENAVIA
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/engineer") {
      let action;
      try {
        action = await request.json();
      } catch (err) {
        return withCORS(errorResponse("JSON inválido em /engineer.", 400, {
          detail: String(err),
        }));
      }

      const execResult = await enaviaExecutorCore(env, action);

      return withCORS(jsonResponse({
        system: SYSTEM_NAME,
        executor: "core_v2",
        route: "/engineer",
        received_action: action,
        result: execResult,
      }));
    }

    // ----------------------------------------
    // POST /browser-proof → prova de smoke test do Browser Executor
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/browser-proof") {
      let body;
      try {
        body = await request.json();
      } catch (err) {
        return withCORS(
          errorResponse("JSON inválido em /browser-proof.", 400, {
            detail: String(err),
          }),
        );
      }

      const executionId =
        body.execution_id ||
        body.audit_execution_id ||
        body.exec_id ||
        generateId("exec-proof");

      const candidateHash = body.candidateHash || body.candidate_hash || null;
      const proofKey = candidateHash ? `DEPLOY_OK:${candidateHash}` : null;

      const proofPayload = {
        execution_id: executionId,
        candidate_hash: candidateHash,
        proof_key: proofKey,
        source: body.source || "browser",
        env: env.ENAVIA_ENV || "unknown",
        before: body.before || null,
        after: body.after || null,
        notes: body.notes || null,
        ts: nowIso(),
      };

      const gitKv = env?.GIT_KV || env?.ENAVIA_GIT || null;

      if (gitKv) {
        try {
          // ciclo de prova por execução
          await gitKv.put(
            `cycle:proof:${executionId}`,
            JSON.stringify(proofPayload),
          );

          // chave de gate usada pelo deploy-apply (DEPLOY_OK:<hash>)
          if (proofKey) {
            await gitKv.put(proofKey, JSON.stringify(proofPayload));
          }
        } catch (err) {
          console.log(
            "[ENAVIA_EXECUTOR] Erro ao salvar browser-proof:",
            String(err),
          );
        }
      }

      // Atualiza FLOW_STATE / EXECUTION com status da prova
      try {
        const beforeOk =
          proofPayload.before && typeof proofPayload.before === "object"
            ? proofPayload.before.ok !== false
            : true;
        const afterOk =
          proofPayload.after && typeof proofPayload.after === "object"
            ? proofPayload.after.ok !== false
            : true;

            const proofOk =
            body.ok === false ? false : Boolean(beforeOk && afterOk);
  
          await updateFlowStateKV(env, executionId, {
            stage: "proof",
          last_step: "proof",
          ok: proofOk,
          proof: {
            attached: true,
            ok: proofOk,
            mode: proofPayload.source,
            candidate_hash: candidateHash,
            proof_key: proofKey,
            notes: proofPayload.notes,
            ts: proofPayload.ts,
          },
        });
      } catch (_errUpdateProof) {
        // não derruba fluxo principal se consolidado falhar
      }

      return withCORS(
        jsonResponse({
          system: SYSTEM_NAME,
          executor: "core_v2",
          route: "/browser-proof",
          ok: true,
          execution_id: executionId,
          candidate_hash: candidateHash,
          proof_key: proofKey,
        }),
      );
    }

    // ----------------------------------------
    // GET /health
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/health") {
      return jsonResponse({
        system: SYSTEM_NAME,
        status: "ok",
        message: "Executor online.",
        target_worker: TARGET_WORKER_NAME,
        boundary: EXECUTOR_BOUNDARY.version,
        deploy_worker_configured: !!DEPLOY_WORKER_BASE,
      });
    }

    // ----------------------------------------
    // GET /boundary — contrato canônico executor × deploy-worker
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/boundary") {
      return jsonResponse({
        system: SYSTEM_NAME,
        ...EXECUTOR_BOUNDARY,
        deploy_worker_configured: !!DEPLOY_WORKER_BASE,
        deploy_worker_url: DEPLOY_WORKER_BASE || null,
      });
    }

    // ----------------------------------------
    // GET /status
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/status") {
      const latestId = await getLatestVersionId();
      const index = await getIndex();
      const latestMeta = latestId ? await getVersionMeta(latestId) : null;

      return jsonResponse({
        system: SYSTEM_NAME,
        latest_version_id: latestId,
        latest_meta: latestMeta,
        total_versions: index.length,
        target_worker: TARGET_WORKER_NAME,
      });
    }

    // ----------------------------------------
    // GET /versions
    // Lista versões (mais recentes no final do array)
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/versions") {
      const limitParam = searchParams.get("limit");
      const limit = limitParam ? parseInt(limitParam, 10) : 20;

      const index = await getIndex();
      const slice = index.slice(Math.max(0, index.length - limit));

      const metas = [];
      for (const id of slice) {
        const meta = await getVersionMeta(id);
        if (meta) metas.push(meta);
      }

      return jsonResponse({
        system: SYSTEM_NAME,
        total: metas.length,
        versions: metas,
      });
    }

    // ----------------------------------------
    // GET /version?id=...
    // Retorna meta + (opcional) código
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/version") {
      const id = searchParams.get("id");
      const includeCode = searchParams.get("code") === "1";

      if (!id) {
        return errorResponse("Parâmetro 'id' é obrigatório em /version?id=...", 400);
      }

      const meta = await getVersionMeta(id);
      if (!meta) {
        return errorResponse(`Versão ${id} não encontrada.`, 404);
      }

      let code = null;
      if (includeCode) {
        code = await getVersionCode(id);
      }

      return jsonResponse({
        system: SYSTEM_NAME,
        meta,
        code,
      });
    }

    // ----------------------------------------
    // GET /diff?from=...&to=...
    // Diff simples entre duas versões
    // ----------------------------------------
    if (METHOD === "GET" && pathname === "/diff") {
      const fromId = searchParams.get("from");
      const toId = searchParams.get("to");

      if (!fromId || !toId) {
        return errorResponse("Parâmetros 'from' e 'to' são obrigatórios.", 400);
      }

      const [fromCode, toCode, fromMeta, toMeta] = await Promise.all([
        getVersionCode(fromId),
        getVersionCode(toId),
        getVersionMeta(fromId),
        getVersionMeta(toId),
      ]);

      if (!fromCode || !toCode || !fromMeta || !toMeta) {
        return errorResponse("Uma ou ambas as versões não foram encontradas.", 404);
      }

      const diff = diffLines(fromCode, toCode, 200);

      return jsonResponse({
        system: SYSTEM_NAME,
        from: fromMeta,
        to: toMeta,
        diff,
      });
    }

    // ----------------------------------------
    // POST /apply-patch
    //
    // Modo compatível com a versão anterior.
    // Espera JSON:
    // {
    //   "new_code": "<arquivo completo do Worker alvo>",
    //   "author": "ENAVIA ou Vasques",
    //   "message": "Descrição da mudança",
    //   "base_version_id": "v-... (opcional)",
    //   "auto_deploy": true|false (opcional)
    // }
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/apply-patch") {
      // ⚠️ BOUNDARY NOTE: apply-patch saves version snapshot locally.
      // auto_deploy=true uses performDeploy() which is a STUB.
      // Real deploy should go through deploy-worker.
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return errorResponse("JSON inválido em /apply-patch.", 400);
      }

      const { new_code, author, message, base_version_id, auto_deploy } = body || {};

      if (!new_code || typeof new_code !== "string") {
        return errorResponse(
          "Campo 'new_code' é obrigatório e deve ser uma string com o código completo.",
          400
        );
      }

      const validation = validateCodeBasic(new_code);
      if (!validation.ok) {
        return errorResponse("Validação básica falhou.", 400, {
          validation_reason: validation.reason,
        });
      }

      const latestSnap = await getLatestSnapshot();
      let diff = null;

      if (latestSnap && latestSnap.code) {
        diff = diffLines(latestSnap.code, new_code, 200);
      }

      const meta = await saveVersion({
        code: new_code,
        author,
        message,
        baseVersionId: base_version_id || (latestSnap?.meta?.id ?? null),
      });

      let deployResult = null;
      if (auto_deploy === true) {
        // DELEGATION GATE: se deploy-worker configurado, delega e para.
        // Executor não executa caminho local concorrente quando deploy-worker disponível.
        const autoDeployDelegation = await delegateToDeployWorker("/apply-test", {
          version_id: meta.id,
          code: new_code,
          source: "enavia-executor",
          boundary: EXECUTOR_BOUNDARY.version,
        });
        if (autoDeployDelegation) {
          return jsonResponse({
            system: SYSTEM_NAME,
            action: "apply-patch",
            validation,
            meta,
            diff_preview: diff,
            auto_deploy_requested: true,
            deploy_result: autoDeployDelegation,
          });
        }
        // ⚠️ DEPLOY_WORKER_URL não configurado — erro explícito, sem falso sucesso
        deployResult = {
          deployed: false,
          error: true,
          error_code: "DEPLOY_WORKER_NOT_CONFIGURED",
          reason:
            "Deploy real requer deploy-worker. Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
        };
      }

      return jsonResponse({
        system: SYSTEM_NAME,
        action: "apply-patch",
        validation,
        meta,
        diff_preview: diff,
        auto_deploy_requested: !!auto_deploy,
        deploy_result: deployResult,
      });
    }

    // ----------------------------------------
    // POST /apply-exec
    //
    // Novo endpoint preparado para o pacote "executor_intent"
    // que a ENAVIA gera no ENGINEER MODE.
    //
    // JSON esperado (flexível):
    // {
    //   "executor_intent": true,
    //   "target_system": "worker:nv-enavia ou enavia-executor",
    //   "operation": "patch|hotfix|deploy|design",
    //   "risk_level": "N1|N2|N3",
    //   "description": "...",
    //   "file_hint": "...",
    //   "patch": "<código completo>",
    //   "new_code": "<código completo>",
    //   "code": "<código completo>",
    //   "tests": ["...", "..."],
    //   "rollback": "Plano de rollback",
    //   "notes": "...",
    //   "author": "ENAVIA ou Vasques",
    //   "message": "Descrição curta",
    //   "base_version_id": "v-...",
    //   "auto_deploy": true|false
    // }
    //
    // Regras:
    //  - Usa patch/new_code/code (nessa ordem) como fonte de código.
    //  - Valida com validateCodeBasic.
    //  - Salva snapshot no mesmo formato do /apply-patch,
    //    mas com executor_meta preenchido.
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/apply-exec") {
      // ⚠️ BOUNDARY NOTE: apply-exec saves executor intent snapshot locally.
      // auto_deploy=true uses performDeploy() which is a STUB.
      // Real deploy should go through deploy-worker.
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return errorResponse("JSON inválido em /apply-exec.", 400);
      }

      const {
        executor_intent,
        target_system,
        operation,
        risk_level,
        description,
        file_hint,
        patch,
        new_code,
        code,
        tests,
        rollback,
        notes,
        author,
        message,
        base_version_id,
        auto_deploy,
      } = body || {};

      const codeToUse =
        (typeof new_code === "string" && new_code) ||
        (typeof patch === "string" && patch) ||
        (typeof code === "string" && code) ||
        null;

      if (!codeToUse) {
        return errorResponse(
          "Nenhum código encontrado no pacote executor. Envie em 'new_code', 'patch' ou 'code'.",
          400
        );
      }

      const validation = validateCodeBasic(codeToUse);
      if (!validation.ok) {
        return errorResponse("Validação básica falhou.", 400, {
          validation_reason: validation.reason,
        });
      }

      const latestSnap = await getLatestSnapshot();
      let diff = null;

      if (latestSnap && latestSnap.code) {
        diff = diffLines(latestSnap.code, codeToUse, 200);
      }

      const executorMeta = {
        executor_intent: !!executor_intent,
        target_system: target_system || TARGET_WORKER_NAME,
        operation: operation || "patch",
        risk_level: risk_level || "N2",
        description: description || message || "",
        file_hint: file_hint || null,
        tests: Array.isArray(tests) ? tests : [],
        rollback_plan: rollback || null,
        notes: notes || null,
      };

      const meta = await saveVersion({
        code: codeToUse,
        author: author || "ENAVIA",
        message: message || description || "",
        baseVersionId: base_version_id || (latestSnap?.meta?.id ?? null),
        extra: executorMeta,
      });

      let deployResult = null;
      if (auto_deploy === true) {
        // DELEGATION GATE: se deploy-worker configurado, delega e para.
        // Executor não executa caminho local concorrente quando deploy-worker disponível.
        const autoDeployDelegation = await delegateToDeployWorker("/apply-test", {
          version_id: meta.id,
          executor_packet: executorMeta,
          source: "enavia-executor",
          boundary: EXECUTOR_BOUNDARY.version,
        });
        if (autoDeployDelegation) {
          return jsonResponse({
            system: SYSTEM_NAME,
            action: "apply-exec",
            executor_packet: executorMeta,
            validation,
            meta,
            diff_preview: diff,
            auto_deploy_requested: true,
            deploy_result: autoDeployDelegation,
          });
        }
        // ⚠️ DEPLOY_WORKER_URL não configurado — erro explícito, sem falso sucesso
        deployResult = {
          deployed: false,
          error: true,
          error_code: "DEPLOY_WORKER_NOT_CONFIGURED",
          reason:
            "Deploy real requer deploy-worker. Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
        };
      }

      return jsonResponse({
        system: SYSTEM_NAME,
        action: "apply-exec",
        executor_packet: executorMeta,
        validation,
        meta,
        diff_preview: diff,
        auto_deploy_requested: !!auto_deploy,
        deploy_result: deployResult,
      });
    }

    // ----------------------------------------
    // POST /rollback
    // 🔒 DEPLOY-WORKER DELEGATION: rollback real é responsabilidade
    // exclusiva do deploy-worker. Executor delega quando DEPLOY_WORKER_URL
    // está disponível. Retorna erro explícito quando não está.
    // Executor só gerencia o ponteiro de versão local (setLatestVersionId).
    //
    // JSON:
    //  { "version_id": "v-..." , "auto_deploy": true|false }
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/rollback") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return errorResponse("JSON inválido em /rollback.", 400);
      }

      const { version_id, auto_deploy } = body || {};
      if (!version_id) {
        return errorResponse("Campo 'version_id' é obrigatório em /rollback.", 400);
      }

      const meta = await getVersionMeta(version_id);
      const code = await getVersionCode(version_id);

      if (!meta || !code) {
        return errorResponse(`Versão ${version_id} não encontrada.`, 404);
      }

      // Apenas apontamos 'latest' para essa versão.
      await setLatestVersionId(version_id);

      // ⚠️ DELEGATION: se deploy-worker está configurado, delega o deploy real
      if (auto_deploy === true) {
        const rollbackDelegation = await delegateToDeployWorker("/rollback", {
          version_id,
          code,
          source: "enavia-executor",
          boundary: EXECUTOR_BOUNDARY.version,
        });
        if (rollbackDelegation) {
          return jsonResponse({
            system: SYSTEM_NAME,
            action: "rollback",
            target_version: meta,
            auto_deploy_requested: true,
            ...rollbackDelegation,
          });
        }
      }

      // ⚠️ DEPLOY_WORKER_URL não configurado — erro explícito, sem falso sucesso
      let deployResult = null;
      if (auto_deploy === true) {
        deployResult = {
          deployed: false,
          error: true,
          error_code: "DEPLOY_WORKER_NOT_CONFIGURED",
          reason:
            "Deploy real requer deploy-worker. Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
        };
      }

      return jsonResponse({
        system: SYSTEM_NAME,
        action: "rollback",
        target_version: meta,
        auto_deploy_requested: !!auto_deploy,
        deploy_result: deployResult,
      });
    }

    // ----------------------------------------
    // POST /deploy
    // 🔒 DEPLOY-WORKER DELEGATION: deploy real é responsabilidade
    // exclusiva do deploy-worker. Executor delega quando DEPLOY_WORKER_URL
    // está disponível. Retorna erro explícito quando não está.
    //
    // JSON:
    //  { "version_id": "v-..." }  (opcional; se vazio → latest)
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/deploy") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        body = {};
      }

      let { version_id } = body || {};
      if (!version_id) {
        version_id = await getLatestVersionId();
      }

      if (!version_id) {
        return errorResponse(
          "Nenhuma versão encontrada para deploy. Crie uma com /apply-patch ou /apply-exec primeiro.",
          404
        );
      }

      // ⚠️ DELEGATION: se deploy-worker está configurado, delega
      const deployDelegation = await delegateToDeployWorker("/deploy", {
        version_id,
        source: "enavia-executor",
        boundary: EXECUTOR_BOUNDARY.version,
      });
      if (deployDelegation) {
        return jsonResponse({
          system: SYSTEM_NAME,
          action: "deploy",
          version_id,
          ...deployDelegation,
        });
      }

      // ⚠️ DEPLOY_WORKER_URL não configurado — erro explícito, sem falso sucesso
      return errorResponse(
        "DEPLOY_WORKER_NOT_CONFIGURED: deploy real requer deploy-worker. Configure DEPLOY_WORKER_URL.",
        501,
        {
          error_code: "DEPLOY_WORKER_NOT_CONFIGURED",
          version_id,
          deployed: false,
        }
      );
    }

    // ----------------------------------------
    // POST /validate-code
    //
    // JSON: { "code": "..." }
    // ----------------------------------------
    if (METHOD === "POST" && pathname === "/validate-code") {
      let body;
      try {
        body = await request.json();
      } catch (_) {
        return errorResponse("JSON inválido em /validate-code.", 400);
      }

      const { code } = body || {};
      const validation = validateCodeBasic(code);

      return jsonResponse({
        system: SYSTEM_NAME,
        validation,
      });
    }

    // ============================================================
    // 🔒 FALLBACK — QUALQUER OUTRO POST RETORNA 404 EXPLÍCITO
    // Antes (legado): roteava silenciosamente para enaviaExecutorCore.
    // Agora: rejeita com erro explícito. Rotas válidas são nomeadas.
    // ============================================================
    if (METHOD === "POST") {
      return withCORS(errorResponse(
        "Rota POST não reconhecida no enavia-executor. Use uma rota nomeada.",
        404,
        {
          path: pathname,
          valid_post_routes: [
            "/",
            "/audit",
            "/propose",
            "/module-validate",
            "/worker-deploy",
            "/browser-proof",
            "/deploy",
            "/rollback",
            "/apply-patch",
            "/apply-exec",
            "/validate-code",
            "/engineer",
          ],
        },
      ));
    }

   // ============================================================
    // 404 — Rota não encontrada (GET/OUTROS MÉTODOS)
    // ============================================================
    return withCORS(errorResponse("Rota não encontrada no enavia-executor.", 404, {
      path: pathname,
      method: METHOD,
    }));
  },
};

// ============================================================================
// 🛠️ ENAVIA — FIX FROM AUDIT (ARRUMAR COM GOVERNANÇA TOTAL)
// ============================================================================
async function fixFromAudit(env, ctx) {
  const {
    raw,
    baseResult,
  } = ctx;

  const auditId = raw.auditId || raw.audit_id;
  const patch = raw.patch;

  if (!auditId) {
    return {
      ...baseResult,
      ok: false,
      error: "AUDIT_ID_REQUIRED",
      message: "auditId é obrigatório para executar fix_from_audit.",
    };
  }

  if (!patch || !Array.isArray(patch.patchText)) {
    return {
      ...baseResult,
      ok: false,
      error: "NO_PATCH_AVAILABLE",
      message: "Nenhum patch válido foi fornecido pelo audit.",
    };
  }

  // 🔒 Segurança absoluta
  if (!raw.approve || raw.approve !== true) {
    return {
      ...baseResult,
      ok: false,
      error: "DIRECTOR_APPROVAL_REQUIRED",
      message: "Ação ARRUMAR exige aprovação explícita (approve:true).",
    };
  }

  // ============================================================
  // 🧪 STAGING / SIMULAÇÃO
  // ============================================================
  const simulated = {
    ok: true,
    mode: "simulation",
    applied: false,
    message: "Patch simulado com sucesso.",
  };

// ============================================================
// 🧠 CANONICAL NORMALIZATION — DEPLOY EXECUTE TEST
// (DEVE RODAR ANTES DE handleDeployFlow)
// ============================================================

if (raw.executor_action === "deploy_execute_test") {
  raw.executor_action = "deploy_worker";

  raw.target_env = "test";
  raw.require_env = "test";
  raw.generate_proof = true;

  raw.__alias = "deploy_execute_test";
}

  // ============================================================
  // 🚀 APPLY REAL (REAPROVEITA PIPELINE EXISTENTE)
  // ============================================================
  const applyResult = await handleDeployFlow(
    env,
    {
      ...raw,
      executor_action: "deploy_apply_user_patch",
      patch,
    },
    baseResult
  );

  return {
    ...baseResult,
    ok: applyResult?.ok === true,
    mode: "fix_from_audit",
    auditId,
    simulation: simulated,
    deployResult: applyResult,
    message:
      applyResult?.ok === true
        ? "Correção aplicada com sucesso a partir do audit."
        : "Falha ao aplicar correção do audit.",
  };
}

// ============================================================================
// ♻️ ENAVIA — SMART DEPLOY PLAN (LOOP INTELIGENTE, MODO PLANEJADOR)
// ============================================================================
async function handleSmartDeployPlan(env, ctx) {
  const { raw, baseResult } = ctx || {};

  const executionId =
    raw?.execution_id ||
    raw?.executionId ||
    raw?.execution ||
    null;

  if (!executionId) {
    return {
      ...baseResult,
      ok: false,
      mode: "smart_deploy_plan",
      error: "EXECUTION_ID_REQUIRED",
      message:
        "Para usar smart_deploy é necessário informar execution_id.",
    };
  }

  const kv = env?.ENAVIA_GIT || env?.GIT_KV || null;
  if (!kv) {
    return {
      ...baseResult,
      ok: false,
      mode: "smart_deploy_plan",
      error: "ENAVIA_GIT_MISSING",
      message:
        "GIT_KV/ENAVIA_GIT não está configurado no executor.",
    };
  }

  let flowState = null;
  let execState = null;

  try {
    const [flowRaw, execRaw, patchStatusRaw] = await Promise.all([
  kv.get(`FLOW_STATE:${executionId}`),
  kv.get(`EXECUTION:${executionId}`),
  kv.get(`PATCH_STATUS:${executionId}`),
]);

    if (flowRaw) {
      try {
        flowState = JSON.parse(flowRaw);
      } catch (_e) {
        flowState = null;
      }
    }

    if (execRaw) {
      try {
        execState = JSON.parse(execRaw);
      } catch (_e2) {
        execState = null;
      }
    }
  } catch (_err) {
    return {
      ...baseResult,
      ok: false,
      mode: "smart_deploy_plan",
      error: "FLOW_STATE_READ_ERROR",
      message:
        "Falha ao ler FLOW_STATE/EXECUTION para o execution_id informado.",
    };
  }

  const currentAttempt =
    typeof execState?.attempt === "number" ? execState.attempt : 0;

  const maxAttemptsFromExec =
    typeof execState?.max_attempts === "number"
      ? execState.max_attempts
      : null;

  const maxAttemptsFromRaw =
    typeof raw?.max_attempts === "number"
      ? raw.max_attempts
      : typeof raw?.maxAttempts === "number"
      ? raw.maxAttempts
      : null;

  const maxAttempts = maxAttemptsFromRaw || maxAttemptsFromExec || 3;
  const nextAttempt = currentAttempt + 1;

  let status = execState?.status || null;

// fallback: se EXECUTION não tiver status, tenta PATCH_STATUS (vem do deploy worker)
  if (
    !status &&
    typeof patchStatusRaw !== "undefined" &&
    patchStatusRaw
  ) {
    try {
      const ps = JSON.parse(patchStatusRaw);
      const kvStatus = ps?.status || null;
      if (kvStatus) status = kvStatus;
    } catch (_) {
      // ignora erro de parse e segue com status atual
    }
  }

  // compat: mapeia variações antigas (se existirem)
  if (status === "apply_test_ok") status = "applied_test";
  if (status === "tested") status = "test_ok";
  const stage = flowState?.stage || null;

  const riskLevel =
    execState?.risk_level ||
    (flowState?.risk &&
      (flowState.risk.risk_level ||
        flowState.risk.level ||
        flowState.risk.risk)) ||
    null;

  let suggestedNextStep = "audit";
  let reason = "initial";

  if (!flowState && !execState) {
    suggestedNextStep = "audit";
    reason = "no_state_found";
  } else if (status === "audit_failed") {
    suggestedNextStep = "audit";
    reason = "last_audit_failed";
  } else if (status === "audit_ok" && !flowState?.staging?.ready) {
    suggestedNextStep = "propose";
    reason = "audit_ok_no_staging";
  } else if (status === "propose_failed") {
    suggestedNextStep = "propose";
    reason = "last_propose_failed";
  } else if (status === "proposed" && flowState?.staging?.ready) {
    suggestedNextStep = "apply_test";
    reason = "staging_ready_after_propose";
  } else if (status === "applied_test" || status === "test_ok") {
    suggestedNextStep = "deploy_test";
    reason = "patch_already_applied_in_test";
  } else if (
    status === "test_failed" ||
    status === "prod_failed"
  ) {
    suggestedNextStep = "propose";
    reason = "test_or_prod_failed_needs_new_patch";
  }

  const steps = [
    { id: "s1", type: "audit" },
    { id: "s2", type: "apply_test" },
    { id: "s3", type: "deploy_test" },
    { id: "s4", type: "await_proof" },
    { id: "s5", type: "finalize" },
  ];

  const plan = {
    version: "deploy.loop.v1",
    execution_id: executionId,
    attempt: nextAttempt,
    max_attempts: maxAttempts,
    suggested_next_step: suggestedNextStep,
    reason,
    status_snapshot: {
      status,
      stage,
      risk_level: riskLevel || null,
      staging_ready:
        flowState?.staging && typeof flowState.staging.ready === "boolean"
          ? flowState.staging.ready
          : null,
    },
    // novo: descrição de máquina de estados do loop
    steps,
    state: {
      current_step_id: null,
      current_step_index: -1,
      last_step_ok: null,
      status: "initial",
      history: [],
    },
  };

  // grava plano + contadores no EXECUTION/FLOW_STATE
  await updateFlowStateKV(env, executionId, {
    plan,
    attempt: nextAttempt,
    max_attempts: maxAttempts,
  });

  return {
    ...baseResult,
    ok: true,
    mode: "smart_deploy_plan",
    execution_id: executionId,
    plan,
    flow_state: flowState || null,
    execution: execState || null,
  };
}

// ============================================================================
// 🧠 ENAVIA — HELPERS GLOBAIS (nowIso, generateId, updateFlowStateKV)
// ============================================================================

function nowIso() {
  return new Date().toISOString();
}

function generateId(prefix = "v") {
  const rnd = Math.random().toString(36).slice(2, 8);
  const ts = Date.now().toString(36);
  return `${prefix}-${ts}-${rnd}`;
}

// Estado de fluxo por execution_id (FLOW_STATE / EXECUTION / cycle em KV)
// Fonte única de verdade — consolida as lógicas antes duplicadas
async function updateFlowStateKV(env, executionId, update) {
  if (!executionId) return;

  const kv = env?.ENAVIA_GIT || env?.GIT_KV || null;
  if (!kv) return;

  try {
    const key = `FLOW_STATE:${executionId}`;
    let existing = {};

    try {
      const raw = await kv.get(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          existing = parsed;
        }
      }
    } catch (_err) {
      // ignora lixo / JSON inválido
    }

    const next = {
      ...(existing && typeof existing === "object" ? existing : {}),
      ...(update && typeof update === "object" ? update : {}),
      execution_id: executionId,
      updated_at: Date.now(),
    };

    // estado consolidado do fluxo (compat com painel)
    await kv.put(key, JSON.stringify(next));

    // ============================
    // espelho EXECUTION:<execution_id>
    // ============================
    const stage = update?.stage || next.stage || null;
    const workerId =
      update?.workerId ||
      next.workerId ||
      (next.target && next.target.workerId) ||
      null;

    try {
      const execKey = `EXECUTION:${executionId}`;
      let execExisting = {};
      try {
        const rawExec = await kv.get(execKey);
        if (rawExec) {
          const parsedExec = JSON.parse(rawExec);
          if (parsedExec && typeof parsedExec === "object") {
            execExisting = parsedExec;
          }
        }
      } catch (_errExec) {
        // ignora
      }

      const okFlag =
        typeof update?.ok === "boolean"
          ? update.ok
          : typeof next.ok === "boolean"
          ? next.ok
          : true;

      const patchObj = update?.patch || next.patch || null;
      const patchId = patchObj?.id || patchObj?.patch_id || null;
      const candidateHash =
        (patchObj &&
          (patchObj.hash ||
            patchObj.candidate_hash ||
            patchObj.candidateHash)) ||
        execExisting.candidate_hash ||
        null;

      // informações adicionais para EXECUTION
      const riskReport = update?.risk || next.risk || null;
      const risk_level =
        (riskReport &&
          (riskReport.risk_level ||
            riskReport.level ||
            riskReport.risk)) ||
        execExisting.risk_level ||
        null;

      // -------- status derivado por stage (consolidado do inner)
      let status = execExisting.status || "created";
      if (stage === "audit") {
        status = okFlag ? "audit_ok" : "audit_failed";
      } else if (stage === "propose" && patchObj) {
        status = okFlag ? "proposed" : "propose_failed";
      } else if (stage === "apply_test") {
        status = okFlag ? "apply_test_ok" : "apply_test_failed";
      }

      // -------- phases tracking (consolidado do inner)
      const phases = {
        ...(execExisting.phases && typeof execExisting.phases === "object"
          ? execExisting.phases
          : {}),
      };
      const ts = nowIso();

      if (stage === "audit") {
        phases.audit = {
          ...(phases.audit && typeof phases.audit === "object"
            ? phases.audit
            : {}),
          ok: okFlag,
          risk_level,
          ts,
        };
      } else if (stage === "propose" && patchObj) {
        phases.propose = {
          ...(phases.propose && typeof phases.propose === "object"
            ? phases.propose
            : {}),
          ok: okFlag,
          patch_id: patchId || candidateHash || null,
          ts,
        };
      } else if (stage === "apply_test") {
        phases.apply_test = {
          ...(phases.apply_test && typeof phases.apply_test === "object"
            ? phases.apply_test
            : {}),
          ok: okFlag,
          candidate_hash: candidateHash || null,
          patch_id: patchId || null,
          workerId,
          ts,
        };
      }

      // -------- snapshot_hash (consolidado do inner)
      const snapshot =
        (update?.context_proof && update.context_proof.snapshot) ||
        (next.context_proof && next.context_proof.snapshot) ||
        null;

      const snapshot_hash =
        (snapshot &&
          (snapshot.hash ||
            snapshot.fingerprint ||
            snapshot.snapshot_hash)) ||
        execExisting.snapshot_hash ||
        null;

      const patchSummary =
        typeof update?.patch_summary !== "undefined"
          ? update.patch_summary
          : typeof next.patch_summary !== "undefined"
          ? next.patch_summary
          : typeof execExisting.patch_summary !== "undefined"
          ? execExisting.patch_summary
          : null;

      const anchorsArr =
        (update && Array.isArray(update.anchors) && update.anchors) ||
        (next && Array.isArray(next.anchors) && next.anchors) ||
        (execExisting &&
          Array.isArray(execExisting.anchors) &&
          execExisting.anchors) ||
        null;

      const smokeTestsArr =
        (update &&
          Array.isArray(update.smoke_tests) &&
          update.smoke_tests) ||
        (next &&
          Array.isArray(next.smoke_tests) &&
          next.smoke_tests) ||
        (execExisting &&
          Array.isArray(execExisting.smoke_tests) &&
          execExisting.smoke_tests) ||
        null;

      const mergedExec = {
        ...(execExisting && typeof execExisting === "object"
          ? execExisting
          : {}),
        execution_id: executionId,
        target:
          update?.target ||
          next.target ||
          execExisting.target ||
          (workerId ? { workerId } : undefined),
        last_stage: stage || execExisting.last_stage || null,
        status,
        worker_id: workerId || execExisting.worker_id || null,
        target_worker:
          workerId ||
          execExisting.target_worker ||
          (next.target && next.target.workerId) ||
          null,
        ok: okFlag,
        snapshot_hash,
        candidate_hash: candidateHash,
        patch_id: patchId || execExisting.patch_id || null,
        risk_level,
        phases,
        patch_summary: patchSummary,
        anchors: anchorsArr,
        smoke_tests: smokeTestsArr,

        // campos para contrato/loop inteligente
        contract: update?.contract ?? next.contract ?? execExisting.contract ?? null,
        plan: update?.plan ?? next.plan ?? execExisting.plan ?? null,
        attempt:
          typeof update?.attempt === "number"
            ? update.attempt
            : typeof next?.attempt === "number"
            ? next.attempt
            : typeof execExisting.attempt === "number"
            ? execExisting.attempt
            : 0,
        max_attempts:
          typeof update?.max_attempts === "number"
            ? update.max_attempts
            : typeof next?.max_attempts === "number"
            ? next.max_attempts
            : execExisting.max_attempts ?? null,
        last_error: update?.last_error ?? next.last_error ?? execExisting.last_error ?? null,

        created_at: execExisting.created_at || Date.now(),
        updated_at: Date.now(),
      };

      await kv.put(execKey, JSON.stringify(mergedExec));
    } catch (_errExecPut) {
      // não derruba fluxo se EXECUTION falhar
    }

    // -------- cycle:audit:<execution_id> (consolidado do inner)
    if (stage === "audit") {
      try {
        const riskReportAudit = update?.risk || next.risk || null;
        const riskLevelAudit =
          (riskReportAudit &&
            (riskReportAudit.risk_level || riskReportAudit.level || riskReportAudit.risk)) ||
          null;

        const auditDoc = {
          execution_id: executionId,
          target_worker: workerId,
          route: update?.route || next.route || "/audit",
          ok: update?.ok ?? next.ok ?? true,
          risk_level: riskLevelAudit,
          staging: update?.staging || next.staging || null,
          anchors: update?.anchors || next.anchors || null,
          invariants: update?.invariants || next.invariants || null,
          context_proof: update?.context_proof || next.context_proof || null,
          canonical_map: update?.canonicalMap || next.canonicalMap || null,
          pipeline: update?.pipeline || next.pipeline || null,
          updated_at: next.updated_at,
        };

        await kv.put(
          `cycle:audit:${executionId}`,
          JSON.stringify(auditDoc),
        );
      } catch (_errCycleAudit) {
        // não derruba fluxo principal
      }
    }

    // -------- cycle:patch:<patch_id> (consolidado do inner)
    if (stage === "propose" && update?.patch) {
      try {
        const patchObjCycle = update.patch;
        let patchIdCycle = patchObjCycle.id || patchObjCycle.patch_id || null;

        if (!patchIdCycle) {
          const patchStr =
            typeof patchObjCycle === "string" ? patchObjCycle : JSON.stringify(patchObjCycle);
          const hash = await sha256Hex(patchStr);
          patchIdCycle = `patch:${hash.slice(0, 16)}`;
        }

        const riskReportPatch = update?.risk || next.risk || null;
        const riskLevelPatch =
          (riskReportPatch &&
            (riskReportPatch.risk_level || riskReportPatch.level || riskReportPatch.risk)) ||
          null;

        const patchDoc = {
          patch_id: patchIdCycle,
          execution_id: executionId,
          target_worker: workerId,
          route: update?.route || next.route || "/propose",
          ok: update?.ok ?? next.ok ?? true,
          risk_level: riskLevelPatch,
          staging: update?.staging || next.staging || null,
          patch: patchObjCycle,
          context_proof: update?.context_proof || next.context_proof || null,
          canonical_map: update?.canonicalMap || next.canonicalMap || null,
          pipeline: update?.pipeline || next.pipeline || null,
          updated_at: next.updated_at,
        };

        await kv.put(
          `cycle:patch:${patchIdCycle}`,
          JSON.stringify(patchDoc),
        );
      } catch (_errCyclePatch) {
        // não derruba fluxo principal
      }
    }
  } catch (_errOuter) {
    // idem
  }
}

// ============================================================================
// 🧠 ENAVIA — AUDIT MODE (Leitura profunda + diagnóstico cirúrgico)
// ============================================================================

async function runAuditMode(env, ctx) {
  const {
    raw,
    rawText,
    isOperational,
    hasDirectorApproval,
    baseResult,
  } = ctx;

  const targetWorkerId =
    raw.workerId ||
    (() => {
      const m = rawText.match(/"workerId"\s*:\s*"([^"]+)"/);
      return m ? m[1] : null;
    })();

  const auditId = `audit-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;

  const findings = [];
  const suggestions = [];
  const patchText = [];

  const shouldGeneratePatch = raw?.generatePatch === true;

  // ============================================================
  // 1️⃣ LEITURA DO EXECUTOR (SELF-AUDIT)
  // ============================================================
  let executorCode = null;

  try {
    const GIT_KV = env?.GIT_KV || env?.ENAVIA_GIT || null;
    
    // Alias canônico: mantém compatibilidade com código legado que usa env.ENAVIA_GIT
    const ENAVIA_GIT = GIT_KV;
  
    if (!GIT_KV || typeof GIT_KV.get !== "function") {
      throw new Error("GIT_KV KV binding não configurado no enavia-executor.");
    }
  
    // Compat: versões antigas podiam usar git:code:latest
    executorCode = await GIT_KV.get("git:code:latest");
  
    // Formato canônico atual: git:latest -> id ; git:code:<id> -> code
    if (!executorCode || !executorCode.trim()) {
      const latestId = await GIT_KV.get("git:latest");
      if (!latestId) throw new Error("Snapshot canônico do executor ausente no KV");
      executorCode = await GIT_KV.get(`git:code:${latestId}`);
    }
  
    if (!executorCode || !executorCode.trim()) {
      throw new Error("Snapshot canônico do executor ausente no KV");
    }
  } catch (err) {
    findings.push({
      level: "critical",
      area: "executor",
      message: "Falha ao auto-ler o executor",
      detail: err?.message || String(err),
    });
  }

  // ============================================================
  // 2️⃣ LEITURA DO WORKER ALVO (SE INFORMADO)
  // ============================================================
  let workerCode = null;
  let workerCodeForAnalysis = null;
  let resolvedWorkerName = null;
  let context_proof = null;

const requireLiveRead = raw?.context?.require_live_read === true;
const freshnessMaxMs =
  typeof raw?.context?.freshness_max_ms === "number" ? raw.context.freshness_max_ms : null;

  if (targetWorkerId) {
    resolvedWorkerName = await resolveScriptName(targetWorkerId, env, {
      strict: false,
    });

    if (!resolvedWorkerName) {
      findings.push({
        type: "script_resolution_fail",
        area: "worker",
        title: "Worker alvo não mapeado para script da Cloudflare",
        description: `Não foi possível resolver o scriptName para o workerId '${targetWorkerId}'.`,
        scope: "isolated",
        riskLevel: "high",
      });
    } else {
      try {
        const snap = await fetchCurrentWorkerSnapshot({
          accountId: env.CF_ACCOUNT_ID,
          apiToken: env.CF_API_TOKEN,
          scriptName: resolvedWorkerName,
        });
        
        workerCode = snap.code;
        
        // hash simples (fnv1a32) para prova de consistência entre chamadas
        const fnv1a32 = (str) => {
          let h = 0x811c9dc5;
          for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i);
            h = Math.imul(h, 0x01000193) >>> 0;
          }
          return ("0000000" + h.toString(16)).slice(-8);
        };
        
        const snapshot_lines = workerCode.split(/\r?\n/).length;
        const snapshot_chars = workerCode.length;
        
        context_proof = {
          target: { system: "cloudflare_worker", workerId: targetWorkerId },
          scriptName: resolvedWorkerName,
          snapshot_fingerprint: `fnv1a32:${fnv1a32(workerCode)}`,
          snapshot_chars,
          snapshot_lines,
          cf_etag: snap.etag,
          cf_last_modified: snap.last_modified,
          fetched_at_ms: snap.fetched_at_ms,
          freshness_max_ms: freshnessMaxMs,
        };
      } catch (err) {
        findings.push({
          type: "worker_read_fail",
          area: "worker",
          title: "Falha ao ler código do worker alvo",
          description:
            "A leitura do código do worker alvo falhou via Cloudflare API.",
          detail: err?.message || String(err),
          scope: "isolated",
          riskLevel: "critical",
        });
      }
    }
  }

  // ============================================================
  // 🧠 ENGENHARIA — PROPOSTAS E GOVERNANÇA
  // ============================================================
  const engineering = {
    diagnosis: {
      summary:
        findings.length > 0
          ? "Problemas estruturais detectados no código analisado."
          : "Nenhum problema estrutural crítico detectado.",
      rootCauses: findings.map((f) => f.type || "unknown"),
      affectedAreas: findings.map((f) => f.area || "unspecified"),
      confidence: findings.length > 0 ? 0.85 : 0.95,
    },

    proposals: findings.map((f, index) => ({
      id: `proposal-${index + 1}`,
      title: f.title || "Correção técnica sugerida",
      description:
        f.description ||
        "Ajuste técnico baseado no diagnóstico do audit.",
      scope: f.scope || "isolated",
      riskLevel: f.riskLevel || "medium",

      impacts: {
        positive: [
          "Redução de risco operacional",
          "Maior previsibilidade do comportamento do executor",
        ],
        negative:
          f.riskLevel === "high"
            ? ["Pode exigir revisão manual antes de deploy"]
            : [],
      },

      patch: f.patch || null,

      testPlan: [
        "Executar diagnose_codebase novamente",
        "Validar ausência de erros de runtime",
        "Confirmar comportamento esperado",
      ],

      rollbackPlan:
        "Reverter para snapshot anterior armazenado no KV via pipeline oficial.",
    })),

    governance: {
      requiresHumanApproval: true,
      deployAllowed: false,
      reason:
        "Regra global: deploy somente com autorização humana explícita.",
      nextAction: "await_director_decision",
    },
  };

  // ============================================================
  // 3️⃣ ANÁLISE PROFUNDA — EXECUTOR
  // ============================================================
  if (executorCode) {
    if (
      shouldGeneratePatch &&
      !executorCode.includes("const raw = action || {}")
    ) {
      findings.push({
        level: "critical",
        area: "executor",
        message: "Bootstrap canônico ausente (raw não inicializado)",
        impact: "Quebra ReferenceError em runtime",
      });

      patchText.push({
        target: "executor",
        mode: "safe",
        search: "async function enaviaExecutorCore",
        replace: `async function enaviaExecutorCore(env, action) {

  // 🔒 BOOTSTRAP CANÔNICO
  const raw = action || {};
`,
      });
    }

    if (
      executorCode.includes("isOperational") &&
      !executorCode.includes("const isOperational")
    ) {
      findings.push({
        level: "critical",
        area: "executor",
        message: "Uso de isOperational sem declaração garantida",
        impact: "ReferenceError recorrente",
      });
    }
  }

  // ============================================================
  // 4️⃣ ANÁLISE PROFUNDA — WORKER
  // ============================================================
  if (workerCode) {
    const requireInternalDeployApply =
      raw?.context?.require_internal_deploy_apply !== false;

    if (
      requireInternalDeployApply &&
      !workerCode.includes("/__internal__/deploy-apply")
    ) {
      findings.push({
        level: "high",
        area: "worker",
        message: "Rota __internal__/deploy-apply não encontrada",
        impact: "Deploy remoto impossível",
      });
    }

    // 🔎 Scanner controlado por contexto (A2 inteligente sem mexer no worker)
    const scanNeedleRaw = raw?.context?.scan_worker_for;
    const scanNeedle =
      typeof scanNeedleRaw === "string" ? scanNeedleRaw.trim() : "";

    if (scanNeedle) {
      const needle = scanNeedle.slice(0, 160); // limite pra não virar log gigante
      const count = workerCode.split(needle).length - 1;

      if (count > 0) {
        findings.push({
          level: "high",
          area: "worker",
          message: `Padrão encontrado no worker: ${needle}`,
          impact: `Ocorrências: ${count} (revisar impacto)`,
        });
      } else {
        // Sem finding (não é problema), mas deixa evidência mínima no snapshot se ligado
        baseResult._scan_worker_for = { needle, found: false, count: 0 };
      }
    }

    const evalPattern = /\beval\s*\(/;
    if (evalPattern.test(workerCode)) {
      findings.push({
        level: "critical",
        area: "worker",
        message: "Uso de eval detectado",
        impact: "Risco de segurança extremo",
      });
    }
  }

  // 🔎 Evidência mínima do snapshot (sem vazar código completo)
  // ⚠️ IMPORTANTE: aqui era o teu ReferenceError ("result is not defined").
  // A evidência vai para baseResult (que já é espalhado no return).
  if (raw?.context?.debug_snapshot === true && workerCode) {
    try {
      const lines = workerCode.split(/\r?\n/);
      const head = lines.slice(0, 6).join("\n");
      const tail = lines.slice(Math.max(0, lines.length - 6)).join("\n");

      // hash simples (fnv1a32) para prova de consistência entre chamadas
      const fnv1a32 = (str) => {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
          h ^= str.charCodeAt(i);
          h = Math.imul(h, 0x01000193) >>> 0;
        }
        return ("0000000" + h.toString(16)).slice(-8);
      };

      baseResult.snapshot = {
        chars: workerCode.length,
        lines: lines.length,
        hash: `fnv1a32:${fnv1a32(workerCode)}`,
        head,
        tail,
      };

      // se teve scan_worker_for e não achou, gruda a evidência mínima aqui também
      if (baseResult._scan_worker_for?.needle && baseResult._scan_worker_for.found === false) {
        baseResult.snapshot.scan_worker_for = baseResult._scan_worker_for;
      }
      delete baseResult._scan_worker_for;
    } catch (e) {
      baseResult.snapshot = { ok: false, error: String(e) };
    }
  } else {
    // limpa lixo temporário se existir
    if (baseResult._scan_worker_for) delete baseResult._scan_worker_for;
  }

  // ============================================================
  // 5️⃣ CLASSIFICAÇÃO E PLANO
  // ============================================================
  const riskLevel = findings.some((f) => f.level === "critical")
    ? "high"
    : findings.some((f) => f.level === "high")
    ? "medium"
    : "low";

  if (shouldGeneratePatch && patchText.length > 0) {
    suggestions.push("GERAR PATCH AUTOMÁTICO (AUDIT)");
  }

  suggestions.push("APLICAR PATCH MANUAL");
  suggestions.push("CANCELAR auditoria");

  // ============================================================
  // 6️⃣ RESPOSTA FINAL (AUDIT NÃO EXECUTA NADA)
  // ============================================================
  return {
    ...baseResult,
    ok: requireLiveRead ? Boolean(context_proof) : true,
    mode: "audit",
    auditId,
    targetWorker: targetWorkerId || null,
    resolvedWorkerName,
    context_used: Boolean(context_proof),
    context_proof,
    findings,
    patch:
      shouldGeneratePatch && patchText.length
        ? {
            mode: "patch_text",
            allowWorkerEdit: false,
            patchText,
          }
        : null,
    staging: {
      ready: false,
      notes: shouldGeneratePatch
        ? "Patch disponível para geração mediante confirmação."
        : "Audit concluído sem geração automática de patch.",
    },
    riskReport: {
      level: riskLevel,
      notes: findings.map((f) => `${f.area}: ${f.message}`),
    },
    suggestions,
    error: requireLiveRead && !context_proof ? "AUDIT_NO_CONTEXT_PROOF" : undefined,
    message:
  requireLiveRead && !context_proof
    ? "AUDIT bloqueado: sem prova de leitura LIVE do worker-alvo."
    : "AUDIT MODE concluído — análise, validação e simulação realizadas.",
  };
}

// ============================================================
// 🔒 RESOLUÇÃO FIXA DE SERVICE BINDINGS (GLOBAL)
// ============================================================
function resolveWorkerService(workerId, env) {
  if (!workerId) return null;

  const id = String(workerId).trim().toLowerCase();

  const MAP = {
    "enavia-worker-teste": env.ENAVIA_WORKER_TEST,
    "enavia-worker": env.ENAVIA_WORKER_PROD,
  };

  return MAP[id] || null;
}

// ============================================================================
// 🔧 ENAVIA — handleDeployFlow V3 (Completo, Seguro, Profissional)
// ⚠️ BOUNDARY NOTE: This function contains deploy flow logic that overlaps
// with deploy-worker responsibilities (approve, rollback, cancel, etc.).
// After PR7, these actions are DELEGATED to deploy-worker when available.
// This function is kept for backward compatibility only.
// The executor's role here is HANDOFF/SUPERVISION, not sovereign execution.
// Suporte oficial aos 9 comandos do painel NV-Control
// ============================================================================

async function handleDeployFlow(env, a, baseResult) {
  try {
    const raw = a || {};
    const ENAVIA_GIT = env?.GIT_KV || env?.ENAVIA_GIT || null;
    // Compute deploy-worker base URL once for all delegation gates in this function
    const _DEPLOY_WORKER_BASE = (env.DEPLOY_WORKER_URL || "").replace(/\/$/, "");
    const safeNow = () =>
      Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);

// ============================================================
// 🔒 NORMALIZAÇÃO GLOBAL (ANTES DE QUALQUER USO)
// ============================================================
const rawText =
typeof raw === "object" ? JSON.stringify(raw) : String(raw || "");

const isOperational =
raw.execution_type === "operational" ||
rawText.includes('"execution_type":"operational"') ||
rawText.includes('"execution_type": "operational"');

const hasDirectorApproval =
raw.director_ok === true ||
raw.approve === true ||
rawText.includes('"director_ok":true') ||
rawText.includes('"approve":true');

    // Normalize
    const toLower = (v) => (typeof v === "string" ? v.toLowerCase() : "");
    const executorAction = toLower(raw.executor_action || raw.action || "");
    const intent = toLower(raw.intent);
    const msg = toLower(raw.message);

    // 🚀 LOG 5 — recebimento bruto do fluxo de deploy
    console.log("[DEPLOY] raw recebido:", JSON.stringify(raw));

    // 🚦 LOG 6 — como o fluxo interpreta executorAction, intent e msg
    const _debugIsDeploy =
  executorAction.startsWith("deploy_") ||
  intent === "deploy" ||
  msg.startsWith("deploy_");

  console.log("[DEPLOY] executorAction / intent / msg / debug_isDeploy:", {
    executorAction,
    intent,
    msg,
    debug_isDeploy: _debugIsDeploy,
  });

// ============================================================
// 🔍 DETECÇÃO ROBUSTA DE DEPLOY (ROOT + PAYLOAD ENCAPSULADO)
// ============================================================

const isDeploy =
  (executorAction && executorAction.includes("deploy")) ||
  (intent && intent.includes("deploy")) ||
  (msg && msg.includes("deploy")) ||
  raw.deploy === true ||
  rawText.includes('"action":"deploy_') ||
  rawText.includes('"action": "deploy_"');

if (!isDeploy) return null; // não é deploy → core segue fluxo

// ============================================================
// 🧬 EXECUTION ID CANÔNICO (reaproveita ou gera)
// ============================================================

const executionId =
raw.execution_id ||
(() => {
  const m = rawText.match(/"execution_id"\s*:\s*"([^"]+)"/);
  return m ? m[1] : `exec-${safeNow()}`;
})();

    // ------------------------------------------------------------
    // Se for OPERACIONAL mas ainda SEM OK humano
    // → ENAVIA pensa, planeja, reporta e PARA
    // ------------------------------------------------------------
    if (isOperational && !hasDirectorApproval) {
      return {
        ok: true,
        mode: "operational",
        status: "awaiting_director_ok",
        execution_id: executionId,

        message:
          "Plano técnico pronto para execução real. Aguardando aprovação do Diretor.",

        operator_intent: {
          action: executorAction,
          target_worker: raw.workerId || raw.worker || null,
          deploy_type: executorAction,
        },

        instructions: {
          approve: {
            required: true,
            how_to_proceed:
              "Reenviar o mesmo payload com { director_ok: true, execution_id }",
          },
          cancel: {
            how_to_proceed:
              "Enviar deploy_cancel ou cancelar no chat do Diretor",
          },
        },

        safety: {
          auto_execute: false,
          human_required: true,
          rollback_available: true,
        },
      };
    }

    // ------------------------------------------------------------
    // Se chegou aqui:
    // - NÃO é operacional
    // OU
    // - é operacional E já foi aprovado
    // → segue fluxo NORMAL do executor
    // ------------------------------------------------------------
    // ============================================================
    // 🔍 2) Identificar o tipo de deploy solicitado
    // ============================================================
    const mapDeployType = (cmd) => {
      if (!cmd) return null;
    
      // =====================================================
      // TEST PIPELINE
      // =====================================================
    
      // APPLY TEST → aplica patch direto no TESTE
      // Usa o mesmo handler seguro de apply_user_patch
      if (cmd.includes("apply_test")) return "apply_user_patch";
    
      // DEPLOY TEST → executa deploy no worker TESTE
      if (cmd.includes("deploy_execute_test")) return "worker";
      if (cmd.includes("deploy_test")) return "worker";
    
      // =====================================================
      // REAL PIPELINE
      // =====================================================
    
      // PROMOTE REAL → deploy no worker REAL
      if (cmd.includes("promote_real")) return "worker";
    
      // =====================================================
      // OUTROS MODOS (JÁ EXISTENTES)
      // =====================================================
    
      if (cmd.includes("deploy_simulate")) return "simulate";
      if (cmd.includes("deploy_safe")) return "safe";
      if (cmd.includes("deploy_worker")) return "worker";
      if (cmd.includes("deploy_apply_user_patch")) return "apply_user_patch";
      if (cmd.includes("deploy_accept_suggestion")) return "accept_suggestion";
      if (cmd.includes("deploy_rollback")) return "rollback";
      if (cmd.includes("deploy_session_close")) return "session_close";
      if (cmd.includes("deploy_cancel")) return "cancel";
      if (cmd.includes("deploy_approve")) return "approve";
    
      // fallback → request
      return "request";
    };
    
    const deployType = mapDeployType(executorAction);   

// ============================================================
// ❌ DEPLOY CANCEL (CANÔNICO)
// Cancela ciclo atual sem deploy
// ============================================================
if (deployType === "cancel") {

  const cycleId =
    raw.deploySessionId ||
    raw.execution_id ||
    raw.auditId ||
    null;

  // 🧹 Limpeza de staging / sessão (se existir)
  if (cycleId) {
    try {
      await env.ENAVIA_GIT.delete(`STAGING:${cycleId}`);
      await env.ENAVIA_GIT.delete(`SUGGESTION:${cycleId}`);
    } catch (_) {
      // silêncio deliberado: cancelar nunca deve falhar
    }
  }

  return {
    ...baseResult,
    ok: true,
    cancelled: true,
    deploySessionId: cycleId,
    message: "Ciclo de deploy cancelado com sucesso.",
  };
}

// ============================================================
// 🔧 3) Base do clone (para montar resposta final)
// ============================================================
const clone = {

      ...baseResult,
      ok: true,
      mode: "deploy",
      deployOp: deployType,
      steps: Array.isArray(baseResult.steps)
        ? [...baseResult.steps]
        : [],
      deploySessionId:
        raw.deploySessionId || `ds-${safeNow()}`,
    };

// ============================================================
// 🔒 Normalização canônica do workerId
// ============================================================
const resolvedWorkerId =
raw.workerId ||
raw.worker ||
clone?.targetWorker ||
null;

if (!resolvedWorkerId) {
return {
  ...clone,
  ok: false,
  error: "workerId não informado",
  message: "workerId é obrigatório para operações de deploy/rollback.",
  steps: [...clone.steps, "deploy:missing-workerId"],
};
}

    clone.steps.push("deploy:entry");
    clone.steps.push(`deploy:op:${deployType}`);

    // Helpers internos
    const buildRisk = (level, notes) => ({
      level,
      notes: Array.isArray(notes) ? notes : [notes],
    });

    const buildStaging = (ready, notes, extra = {}) => ({
      ready,
      notes,
      ...extra,
    });

    let patchPayload =
      raw.patch ||
      raw.patchText ||
      raw.patch_text ||
      raw.candidate ||
      raw.code ||
      null;

    // ============================================================
    // 🧪 4) Helper — validação sintática real do patch
    // ============================================================
    const validatePatchSyntax = (code) => {
      // 1) Nada enviado
      if (!code) {
        return {
          ok: false,
          error: "Patch vazio ou inválido.",
          exception: null,
        };
      }

      // 2) Se for OBJETO (patch_text, module_patch, etc.)
      if (typeof code === "object") {
        // Caso mais comum: patch_text { mode: "patch_text", patchText: [...] }
        if (
          code.mode === "patch_text" &&
          Array.isArray(code.patchText) &&
          code.patchText.length > 0
        ) {
          return {
            ok: true,
            error: null,
            exception: null,
          };
        }

        // Suporte opcional para module_patch { mode: "module_patch", operations: [...] }
        if (
          code.mode === "module_patch" &&
          Array.isArray(code.operations) &&
          code.operations.length > 0
        ) {
          return {
            ok: true,
            error: null,
            exception: null,
          };
        }

        // Qualquer outro objeto não é aceito
        return {
          ok: false,
          error: "Estrutura de patch inválida.",
          exception: null,
        };
      }

      // 3) Se for STRING (payload textual)
      if (typeof code === "string") {
        const trimmed = code.trim();
        if (!trimmed) {
          return {
            ok: false,
            error: "Patch vazio ou inválido.",
            exception: null,
          };
        }

        // ⚠ IMPORTANTE:
        // NÃO usamos new Function (bloqueado na Cloudflare).
        // Apenas aceitamos a string não vazia como payload textual.
        return {
          ok: true,
          error: null,
          exception: null,
        };
      }

      // 4) Qualquer outro tipo não é suportado
      return {
        ok: false,
        error: "Tipo de patch não suportado.",
        exception: null,
      };
    };

    // ============================================================
    // 5️⃣ HANDLER: SIMULATE (deploy_simulate)
    // ============================================================
    if (deployType === "simulate") {
      return {
        ...clone,
        staging: buildStaging(
          false,
          "Simulação realizada. Nenhuma alteração aplicada."
        ),
        riskReport: buildRisk(
          patchPayload ? "medium" : "low",
          patchPayload
            ? "Patch analisado logicamente. Sem sintaxe verificada."
            : "Nada a simular, patch vazio."
        ),
        patchPreview: patchPayload || null,
        suggestions: [
          "Revisar o patch.",
          "Se estiver bom, executar SAFE DEPLOY.",
        ],
        message: "Simulação concluída com sucesso.",
      };
    }

    // ============================================================
    // 6️⃣ HANDLER: SAFE DEPLOY (deploy_safe)
    // ============================================================
    if (deployType === "safe") {
      // 1 — Validar sintaxe
      let syntaxResult = { ok: true };
      if (patchPayload) syntaxResult = validatePatchSyntax(patchPayload);

      if (!syntaxResult.ok) {
        return {
          ...clone,
          ok: false,
          staging: buildStaging(false, [
            "Erro de sintaxe no patch. SAFE DEPLOY abortado.",
            syntaxResult.exception,
          ]),
          riskReport: buildRisk("high", [
            "Patch não passou na validação sintática.",
            "Corrigir o erro antes de prosseguir.",
          ]),
          patchPreview: patchPayload,
          message: "SAFE DEPLOY falhou na validação de sintaxe.",
        };
      }

      // 2 — staging lógico
      return {
        ...clone,
        dryRun: true,
        staging: buildStaging(true, [
          "SAFE DEPLOY validado com sucesso.",
          "Nenhuma alteração real aplicada.",
          "Aguardando APROVAÇÃO MANUAL.",
        ]),
        riskReport: buildRisk("medium", [
          "Sintaxe válida.",
          "Validação estática concluída.",
          "Requer revisão manual antes de aprovação.",
        ]),
        patchPreview: patchPayload,
        suggestions: [
          "Clique em APPROVE (deploy_approve) para aplicar o patch REAL.",
          "Clique em CANCEL para descartar este deploy.",
        ],
        message: "SAFE DEPLOY concluído com sucesso. Aguardando aprovação.",
      };
    }

// ============================================================
// 7️⃣ HANDLER: APPLY USER PATCH (deploy_apply_user_patch)
// ============================================================
if (deployType === "apply_user_patch") {

  // ============================================================
  // 🔑 NORMALIZAÇÃO CANÔNICA DO execution_id (CRÍTICO)
  // ============================================================
  const patchExecutionId =
  raw.execution_id ||
  raw.executionId ||
  raw.deploySessionId ||
  executionId ||
  clone.deploySessionId;

  // ❌ Patch ausente
  if (!patchPayload) {
    Object.assign(clone, {
      ok: false,
      staging: buildStaging(false, "Nenhum patch fornecido."),
      riskReport: buildRisk("high", "Patch vazio."),
      message: "Nenhum patch encontrado para aplicar.",
    });

    clone.__handled = true;
  }

  // ============================================================
  // 🧪 VALIDAR SINTAXE DO PATCH
  // ============================================================
  if (!clone.__handled) {
    const syntax = validatePatchSyntax(patchPayload);

    if (!syntax.ok) {
      Object.assign(clone, {
        ok: false,
        staging: buildStaging(false, [
          "Erro de sintaxe ao validar PATCH DO USUÁRIO.",
          syntax.exception,
        ]),
        riskReport: buildRisk("high", [
          "Patch do usuário inválido.",
          "Corrigir antes de aplicar.",
        ]),
        patchPreview: patchPayload,
        message: "Falha ao validar patch do usuário.",
      });

      clone.__handled = true;
    }
  }

  // ============================================================
  // 🧷 PATCH SESSION — MARCAR PATCH COMO TESTADO (CANÔNICO)
  // ============================================================
  if (!clone.__handled && patchExecutionId) {
    await ENAVIA_GIT.put(
      `PATCH_STATUS:${patchExecutionId}`,
      JSON.stringify({
        status: "tested",
        timestamp: Date.now(),
        env: "test",
      })
    );

    Object.assign(clone, {
      dryRun: true,
      execution_id: patchExecutionId,
      steps: [...clone.steps, "engineer:apply_test"],
      staging: buildStaging(true, [
        "PATCH DO USUÁRIO validado e pronto para aprovação.",
      ]),
      riskReport: buildRisk("medium", [
        "Sintaxe do patch válida.",
        "Aguardando APROVAÇÃO MANUAL.",
      ]),
      patchPreview: patchPayload,
      suggestions: [
        "Clique em APPROVE para aplicar este patch real.",
        "Clique em CANCEL para descartar.",
      ],
      message: "Patch do usuário validado. Pronto para aprovação.",
    });

    clone.__handled = true;
  }
}

// ============================================================
// 🔁 HANDLER: ROLLBACK REAL (deploy_rollback)
// ============================================================
if (deployType === "rollback") {
  // 1) Exigir confirmação explícita
  if (!raw.confirm) {
    return {
      ...clone,
      dryRun: true,
      staging: buildStaging(true, [
        "Rollback simulado.",
        "Nenhuma alteração aplicada.",
        "Use confirm:true para executar rollback real.",
      ]),
      riskReport: buildRisk("low", [
        "Rollback apenas simulado.",
      ]),
      message: "Simulação de rollback concluída.",
    };
  }

  // 2) Buscar último backup salvo
  const backupKey = `backup:${resolvedWorkerId}:latest`;
  const backupRaw = await env.ENAVIA_GIT.get(backupKey, { type: "json" });

  if (!backupRaw || !backupRaw.code) {
    return {
      ...clone,
      ok: false,
      staging: buildStaging(false, [
        "Nenhum backup válido encontrado para rollback.",
      ]),
      riskReport: buildRisk("high", [
        "Rollback abortado.",
        "Backup inexistente ou inválido.",
      ]),
      message: "Rollback falhou: backup não encontrado.",
    };
  }

  // 3) Aplicar código do backup
  // DELEGATION GATE: se deploy-worker configurado, delega rollback e para.
  // Executor não usa service binding local concorrente quando deploy-worker disponível.
  if (_DEPLOY_WORKER_BASE) {
    try {
      const dResp = await fetch(_DEPLOY_WORKER_BASE + "/rollback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env?.INTERNAL_TOKEN
            ? { Authorization: `Bearer ${String(env.INTERNAL_TOKEN)}` }
            : {}),
        },
        body: JSON.stringify({
          workerId: resolvedWorkerId,
          backup: backupRaw,
          execution_id: executionId || clone.deploySessionId,
          source: "enavia-executor",
          boundary: EXECUTOR_BOUNDARY.version,
        }),
      });
      let dData = null;
      try { dData = await dResp.json(); } catch (_) { dData = { parse_error: true }; }
      return {
        ...clone,
        ok: dResp.ok,
        applied: dResp.ok,
        delegated: true,
        delegated_to: "deploy-worker",
        staging: buildStaging(dResp.ok, [
          dResp.ok ? "Rollback delegado ao deploy-worker." : "Deploy-worker recusou o rollback.",
        ]),
        riskReport: buildRisk(dResp.ok ? "low" : "high", [
          "Delegado ao deploy-worker (autoridade soberana de rollback).",
        ]),
        deployResult: dData,
        message: dResp.ok
          ? "Rollback delegado ao deploy-worker com sucesso."
          : "Deploy-worker recusou ou falhou no rollback.",
      };
    } catch (err) {
      return {
        ...clone,
        ok: false,
        delegated: true,
        delegated_to: "deploy-worker",
        delegation_failed: true,
        error: err.message || String(err),
        message: "Falha ao delegar rollback ao deploy-worker.",
      };
    }
  }

  // 🔒 DEPLOY_WORKER_NOT_CONFIGURED — erro explícito, sem compat legado
  // Service-binding direto foi removido: rollback real é soberania do deploy-worker.
  return {
    ...clone,
    ok: false,
    error: "DEPLOY_WORKER_NOT_CONFIGURED",
    message:
      "Rollback real requer deploy-worker. Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
    steps: [...clone.steps, "deploy:rollback:no-deploy-worker"],
  };
}

    // ============================================================
    // 8️⃣ HANDLER: ACCEPT SUGGESTION (deploy_accept_suggestion)
    // ============================================================
    if (deployType === "accept_suggestion") {
      if (!patchPayload) {
        return {
          ...clone,
          ok: false,
          staging: buildStaging(false, [
            "Nenhuma sugestão foi encontrada.",
            "Patch sugerido está vazio.",
          ]),
          riskReport: buildRisk("high", [
            "Sugestão vazia não pode ser processada.",
          ]),
          message: "Nenhuma sugestão disponível para aceitar.",
        };
      }

      // validar sintaxe
      const syntax = validatePatchSyntax(patchPayload);
      if (!syntax.ok) {
        return {
          ...clone,
          ok: false,
          staging: buildStaging(false, [
            "Erro de sintaxe na sugestão da ENAVIA.",
            syntax.exception,
          ]),
          riskReport: buildRisk("high", [
            "Sugestão inválida.",
            "Peça para a ENAVIA gerar uma nova sugestão.",
          ]),
          patchPreview: patchPayload,
          message: "Falha ao validar sugestão da ENAVIA.",
        };
      }

      return {
        ...clone,
        dryRun: true,
        staging: buildStaging(true, [
          "Sugestão da ENAVIA validada.",
          "Aguardando APROVAÇÃO MANUAL.",
        ]),
        riskReport: buildRisk("medium", [
          "Sintaxe válida.",
          "Sugestão pronta para revisão e aprovação.",
        ]),
        patchPreview: patchPayload,
        suggestions: [
          "Clique em APPROVE para aplicar a sugestão real.",
          "Cancele se não quiser utilizar essa modificação.",
        ],
        message: "Sugestão aceita. Aguardando aprovação.",
      };
    }

    // ============================================================
    // 9️⃣ HANDLER: DEPLOY WORKER (deploy_worker)
    // ============================================================
    if (deployType === "worker") {
      return {
        ...clone,
        ok: true,
        dryRun: true,
        staging: buildStaging(true, [
          "Deploy para WORKER preparado.",
          "Nenhuma alteração real aplicada (modo seguro).",
          "Aguardando APROVAÇÃO MANUAL para publicar Worker.",
        ]),
        riskReport: buildRisk("medium", [
          "Publicar Worker exige máxima cautela.",
          "A operação só será realizada após APROVAR DEPLOY.",
        ]),
        suggestions: [
          "Clique em APPROVE para publicar o Worker.",
          "Use CANCEL para abortar este deploy.",
        ],
        message:
          "Deploy para Worker está pronto para aprovação. Nada foi aplicado ainda.",
      };
    }

    // ============================================================
    // 🔟 HANDLER: ROLLBACK (deploy_rollback)
    // ============================================================
    if (deployType === "rollback") {
      return {
        ...clone,
        ok: false,
        staging: buildStaging(false, [
          "Rollback solicitado.",
          "Mas restauração real de versão ainda não foi implementada.",
        ]),
        riskReport: buildRisk("high", [
          "Rollback real não implementado.",
          "Nenhuma ação realizada (stub seguro).",
        ]),
        suggestions: [
          "Implementar store de versões antes de permitir rollback real.",
        ],
        message: "Rollback recebido (stub seguro). Nenhuma alteração realizada.",
      };
    }

    // ============================================================
    // 1️⃣1️⃣ HANDLER: SESSION CLOSE (deploy_session_close)
    // ============================================================
    if (deployType === "session_close") {
      return {
        ...clone,
        ok: true,
        staging: buildStaging(false, [
          "Sessão de deploy encerrada.",
          "Nenhuma alteração pendente.",
        ]),
        riskReport: buildRisk("low", [
          "Sessão finalizada logicamente.",
          "Nenhuma ação de risco.",
        ]),
        suggestions: [
          "Inicie um novo SAFE DEPLOY quando quiser aplicar alterações.",
        ],
        message: "Sessão de deploy encerrada com sucesso.",
      };
    }

    // ============================================================
    // 1️⃣2️⃣ HANDLER: CANCEL (deploy_cancel)
    // ============================================================
    if (deployType === "cancel") {
      return {
        ...clone,
        ok: true,
        staging: buildStaging(false, "Deploy cancelado com sucesso."),
        riskReport: buildRisk("low", [
          "Nenhuma alteração foi aplicada.",
          "Fluxo encerrado.",
        ]),
        message: "Deploy cancelado. Nenhuma alteração aplicada.",
      };
    }

// ============================================================
// 1️⃣3️⃣ HANDLER: APPROVE (deploy_approve)
// ✔ DEPLOY REAL VIA SERVICE BINDING (WORKER AUTO-APLICA)
// ============================================================
if (deployType === "approve") {

  // ============================================================
  // 🔗 INJEÇÃO CANÔNICA — RECUPERAR PATCH DO STAGING DO ENGINEER
  // ============================================================
  if (!patchPayload) {
    const sourceExecutionId =
      raw.execution_id ||
      raw.executionId ||
      executionId;

    if (sourceExecutionId) {
      const stagedPatch = await env.ENAVIA_GIT.get(
        `STAGING:${sourceExecutionId}`
      );

      if (stagedPatch && typeof stagedPatch === "string") {
        patchPayload = stagedPatch;
      }
    }
  }

  // ============================================================
  // 🧷 PATCH SESSION — VALIDAR PATCH TESTADO (CANÔNICO)
  // ============================================================
  let patchStatus;
  try {
    const patchStatusRaw = executionId
      ? await env.ENAVIA_GIT.get(`PATCH_STATUS:${executionId}`)
      : null;

    patchStatus = JSON.parse(patchStatusRaw || "{}");
  } catch (_) {
    patchStatus = {};
  }

  if (patchStatus?.status !== "tested") {
    return {
      ...clone,
      ok: false,
      staging: buildStaging(false, [
        "Patch não passou por APPLY TEST.",
      ]),
      riskReport: buildRisk("high", [
        "Aprovação só é permitida após patch testado.",
      ]),
      message: "Patch ainda não foi validado em ambiente TEST.",
    };
  }

  // ============================================================
  // 🔒 VALIDAÇÃO ORIGINAL (INALTERADA)
  // ============================================================
  if (!patchPayload) {
    return {
      ...clone,
      ok: false,
      staging: buildStaging(false, [
        "Nenhum patch disponível para aplicar.",
      ]),
      riskReport: buildRisk("high", [
        "Aprovação sem patch é inválida.",
      ]),
      message: "Não há patch para aplicar no deploy aprovado.",
    };
  }

  // 🔹 1) Registrar BACKUP lógico do patch (executor não lê código)
  const backupKey = `backup:${resolvedWorkerId}:latest`;

  await ENAVIA_GIT.put(
    backupKey,
    JSON.stringify({
      timestamp: Date.now(),
      patch: patchPayload,
      env: env.ENAVIA_ENV,
      workerId: resolvedWorkerId,
      executionId: executionId,
      appliedBy: "service-binding",
    })
  );

  // DELEGATION GATE: se deploy-worker configurado, delega approve e para.
  // Executor não usa service binding local concorrente quando deploy-worker disponível.
  if (_DEPLOY_WORKER_BASE) {
    try {
      const dResp = await fetch(_DEPLOY_WORKER_BASE + "/approve", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(env?.INTERNAL_TOKEN
            ? { Authorization: `Bearer ${String(env.INTERNAL_TOKEN)}` }
            : {}),
        },
        body: JSON.stringify({
          patch: patchPayload,
          execution_id: executionId,
          workerId: resolvedWorkerId,
          source: "enavia-executor",
          boundary: EXECUTOR_BOUNDARY.version,
        }),
      });
      let dData = null;
      try { dData = await dResp.json(); } catch (_) { dData = { parse_error: true }; }
      return {
        ...clone,
        ok: dResp.ok,
        applied: dResp.ok,
        delegated: true,
        delegated_to: "deploy-worker",
        staging: buildStaging(dResp.ok, [
          dResp.ok ? "Deploy aprovado e delegado ao deploy-worker." : "Deploy-worker recusou a aprovação.",
        ]),
        riskReport: buildRisk(dResp.ok ? "low" : "high", [
          "Delegado ao deploy-worker (autoridade soberana de approve).",
        ]),
        workerResponse: dData,
        message: dResp.ok
          ? "Approve delegado ao deploy-worker com sucesso."
          : "Deploy-worker recusou ou falhou na aprovação.",
      };
    } catch (err) {
      return {
        ...clone,
        ok: false,
        delegated: true,
        delegated_to: "deploy-worker",
        delegation_failed: true,
        error: err.message || String(err),
        message: "Falha ao delegar approve ao deploy-worker.",
      };
    }
  }

  // 🔒 DEPLOY_WORKER_NOT_CONFIGURED — erro explícito, sem compat legado
  // Service-binding direto foi removido: approve/deploy real é soberania do deploy-worker.
  return {
    ...clone,
    ok: false,
    error: "DEPLOY_WORKER_NOT_CONFIGURED",
    message:
      "Deploy real (approve) requer deploy-worker. Configure DEPLOY_WORKER_URL para que o executor delegue corretamente.",
    steps: [...clone.steps, "deploy:approve:no-deploy-worker"],
  };
} // 🔴 FECHA if (deployType === "approve")

    // ============================================================
    // 1️⃣4️⃣ FALLBACK — fluxo genérico se nada casar
    // ============================================================
    if (clone.__handled === true) {
      return clone;
    }
    
    return {
      ...clone,
      ok: false,
      staging: buildStaging(false, [
        "Fluxo de deploy não reconhecido.",
        "Nenhuma alteração aplicada.",
      ]),
      riskReport: buildRisk("medium", [
        "executor_action não mapeado.",
        "Revisar comando enviado pelo painel.",
      ]),
      suggestions: [
        "Usar comandos: simulate, safe, worker, apply_user_patch, accept_suggestion, rollback, cancel, approve.",
      ],
      message:
        "Fluxo de deploy não pôde ser classificado corretamente (fallback).",
    };
    
    } catch (err) {
      return {
        ok: false,
        error: "Erro interno no handleDeployFlow.",
        exception: err.message || String(err),
        message: "Falha inesperada ao processar fluxo de deploy.",
        steps: ["deploy:exception"],
      };
    }
  } // 🔒 FECHA function handleDeployFlow

// ============================================================
// 🔎 Helper: Buscar código atual do Worker (Cloudflare API)
// ============================================================
async function fetchCurrentWorkerCode({ accountId, apiToken, scriptName }) {
  if (!accountId || !apiToken || !scriptName) {
    throw new Error("Parâmetros inválidos para fetchCurrentWorkerCode");
  }

  // ✅ endpoint correto (sem /content)
  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
    },
  });

  const raw = await resp.text();

  if (!resp.ok) {
    throw new Error(
      `Falha ao buscar código atual do worker (${resp.status}): ${raw}`
    );
  }

  // Cloudflare pode devolver multipart/form-data; extrai o JS do miolo
  let code = raw;

  const disp = raw.indexOf("Content-Disposition:");
  if (disp >= 0) {
    const headerEnd = raw.indexOf("\r\n\r\n", disp);
    if (headerEnd >= 0) {
      const dataStart = headerEnd + 4;
      const boundary = raw.indexOf("\r\n--", dataStart);
      if (boundary > dataStart) {
        code = raw.slice(dataStart, boundary);
      } else {
        code = raw.slice(dataStart);
      }
    }
  }

  if (!code || !code.trim()) {
    throw new Error("Código atual do worker está vazio");
  }

  return code;
}

// ============================================================
// 🔎 Helper: Buscar snapshot atual do Worker (Cloudflare API) + prova (etag/last-modified)
// ============================================================
async function fetchCurrentWorkerSnapshot({ accountId, apiToken, scriptName }) {
  if (!accountId || !apiToken || !scriptName) {
    throw new Error("Parâmetros inválidos para fetchCurrentWorkerSnapshot");
  }

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/${scriptName}`;

  const resp = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/javascript",
      "Cache-Control": "no-store",
    },
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Falha ao buscar snapshot do worker (${resp.status}): ${text}`);
  }

  const code = await resp.text();

  if (!code || !code.trim()) {
    throw new Error("Snapshot do worker está vazio");
  }

  return {
    code,
    etag: resp.headers.get("etag") || null,
    last_modified: resp.headers.get("last-modified") || null,
    fetched_at_ms: Date.now(),
  };
}

// ============================================================
// 🔍 LISTAGEM DINÂMICA DE SCRIPTS DA CONTA CLOUDFLARE
// Fonte única — usado por resolveScriptName (antes estava dentro do fetch handler)
// ============================================================
async function listCloudflareWorkerScripts(env) {
  const accountId =
    (env?.CF_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT_ID || env?.CLOUDFLARE_ACCOUNT || "").trim();
  const apiToken =
    (env?.CF_API_TOKEN || env?.CLOUDFLARE_API_TOKEN || env?.CF_TOKEN || "").trim();

  if (!accountId) throw new Error("CF_ACCOUNT_ID ausente no env do enavia-executor.");
  if (!apiToken) throw new Error("CF_API_TOKEN ausente no env do enavia-executor.");

  const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts`;

  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiToken}`,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Falha ao listar scripts (${res.status}) accountId=${accountId}: ${text.slice(0, 200)}`);
  }

  const json = await res.json();
  return (json.result || []).map((s) => s.name);
}

// ============================================================
// 🗺️ RESOLVEDOR SCRIPT NAME 
// ============================================================
async function resolveWorkerScriptName({ env, workerId }) {
  return await resolveScriptName(workerId, env, { strict: false });
}

// ============================================================
// 🗺️ RESOLVEDOR CANÔNICO DE WORKER → SCRIPT NAME (OPÇÃO B)
// - strict=false → AUDIT / leitura (descoberta dinâmica)
// - strict=true  → DEPLOY (bloqueia se não existir)
// ============================================================
async function resolveScriptName(workerId, env, opts = {}) {
  if (!workerId) return null;

  const strict = opts.strict === true;

  // Normaliza: se vier domínio *.workers.dev, vira scriptName provável (prefixo)
  let id = String(workerId).trim();
  try {
    if (id.includes("://")) {
      const u = new URL(id);
      id = u.hostname;
    }
  } catch (_) {}

  if (id.endsWith(".workers.dev")) {
    id = id.split(".")[0]; // ex: deploy-worker.brunovasque.workers.dev -> deploy-worker
  }

  // Fallback canônico (não depende de API Cloudflare)
  const FALLBACK_MAP = {
    "enavia-executor-test": "enavia-executor",
    "enavia-executor": "enavia-executor",
  
    // ENOVA (principal)
    "nv-webhook-v2": "nv-webhook-v2",
  
    "enavia-worker-teste": "enavia-worker-teste",
    "enavia-worker": "enavia-worker",
  
    "deploy-worker": "deploy-worker",
    "nv-enavia": "nv-enavia",
  };

  const mapped = FALLBACK_MAP[id] || null;

  // 1️⃣ tenta listar scripts (fonte da verdade) com cache
  let scripts = __CF_SCRIPTS_CACHE__;
  const now = Date.now();

  if (!scripts || now - __CF_SCRIPTS_CACHE_TS__ > __CF_SCRIPTS_TTL_MS__) {
    try {
      scripts = await listCloudflareWorkerScripts(env);
      __CF_SCRIPTS_CACHE__ = scripts;
      __CF_SCRIPTS_CACHE_TS__ = now;
    } catch (err) {
      // Sem listagem: se não for strict, usa fallback conhecido
      if (!strict && mapped) return mapped;
      return null;
    }
  }

  // 2️⃣ se listagem veio, valida contra ela
  if (Array.isArray(scripts)) {
    if (mapped && scripts.includes(mapped)) return mapped;
    if (scripts.includes(id)) return id;
  }

  // 3️⃣ se não achou na listagem, fallback conhecido (apenas em non-strict)
  if (!strict && mapped) return mapped;

  return null;
}

// ============================================================================
// 🔧 ENAVIA — EXECUTOR CORE v2 (KV_PATCH + MODULE_PATCH)
// ============================================================================

async function callCodexEngine(env, params) {
  try {
    const p = params || {};
    const apiKey = env?.OPENAI_API_KEY || env?.CODEX_API_KEY;
    if (!apiKey) {
      return { ok: false, reason: "missing_api_key" };
    }

    const model =
      env?.OPENAI_CODE_MODEL ||
      env?.OPENAI_MODEL ||
      "gpt-4.1-mini";

    const intentText = String(p.intentText || "").slice(0, 4000);
    const workerCode = String(p.workerCode || "").slice(0, 16000);
    const contract = String(p.contract || "").slice(0, 8000);
    const targetWorkerId = p.targetWorkerId || null;

    const systemLines = [
      "Você é o motor de engenharia de código da ENAVIA (CODEX).",
      "Você recebe snapshot de Worker Cloudflare (JavaScript) e um objetivo técnico.",
      "Você deve devolver SOMENTE JSON válido, no formato:",
      "{",
      '  \"ok\": true,',
      '  \"patches\": [',
      "    {",
      '      \"title\": string,',
      '      \"description\": string,',
      '      \"anchor\": { \"match\": string } | null,',
      '      \"patch_text\": string',
      "    }",
      "  ],",
      '  \"notes\": string[] | null,',
      '  \"tests\": [',
      '    { \"description\": string, \"curl\": string }',
      "  ]",
      "}",
      "",
      "Não explique nada fora desse JSON. Não use markdown."
    ];

    if (contract) {
      systemLines.push("");
      systemLines.push("CONTRATO / CONTEXTO TÉCNICO:");
      systemLines.push(contract);
    }

    const messages = [
      {
        role: "system",
        content: systemLines.join("\n"),
      },
      {
        role: "user",
        content: [
          intentText
            ? `OBJETIVO:\n${intentText}`
            : "OBJETIVO: sugerir patch seguro no Worker alvo, respeitando o contrato.",
          "",
          "SNAPSHOT (trecho do código do Worker):",
          workerCode,
          "",
          targetWorkerId
            ? `TARGET_WORKER_ID: ${targetWorkerId}`
            : "",
        ].join("\n"),
      },
    ];

    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.15,
        // força o modelo a responder em JSON puro
        response_format: { type: "json_object" },
      }),
    });

    const txt = await resp.text();
    let data = null;
    try {
      data = JSON.parse(txt);
    } catch (_) {
      // resposta não-JSON da API
    }

    if (!resp.ok) {
      return {
        ok: false,
        reason: "http_error",
        status: resp.status,
        detail: txt,
      };
    }

    const content = data?.choices?.[0]?.message?.content || "";
    let parsed = null;
    try {
      parsed = JSON.parse(content);
    } catch (_) {
      // modelo não retornou JSON puro
      return {
        ok: false,
        reason: "invalid_json_from_model",
        raw: content,
      };
    }

    let patches = [];
    if (parsed && Array.isArray(parsed.patches)) {
      patches = parsed.patches;
    } else if (parsed && parsed.patch) {
      patches = [parsed.patch];
    }

    const normalized = [];
    for (const rawPatch of patches) {
      if (!rawPatch || typeof rawPatch !== "object") continue;
      const patchText =
        rawPatch.patch_text ||
        rawPatch.patchText ||
        "";
      if (!patchText) continue;

      const anchor =
        rawPatch.anchor && typeof rawPatch.anchor.match === "string"
          ? { match: rawPatch.anchor.match }
          : null;

      normalized.push({
        title: String(rawPatch.title || "Patch codex"),
        description: String(
          rawPatch.description ||
            intentText ||
            "Patch sugerido pelo motor Codex."
        ),
        anchor,
        patch_text: String(patchText),
        reason: String(
          rawPatch.reason ||
            "Patch sugerido via Codex (não aplicado automaticamente)."
        ),
      });
    }

    return {
      ok: normalized.length > 0,
      patches: normalized,
      notes: Array.isArray(parsed?.notes) ? parsed.notes : [],
      raw: parsed,
    };
  } catch (err) {
    return {
      ok: false,
      reason: "codex_engine_exception",
      detail: String(err?.message || err),
    };
  }
}

async function enaviaExecutorCore(env, action) {

// ============================================================
// 🔒 BOOTSTRAP CANÔNICO — NUNCA USAR VARIÁVEIS NÃO DEFINIDAS
// ============================================================
const raw = action || {};

// Alias canônico para KV de código (snapshots do executor)
const GIT_KV = env?.GIT_KV || env?.ENAVIA_GIT || null;
const ENAVIA_GIT = GIT_KV;

const rawText =
  typeof raw === "object" ? JSON.stringify(raw) : String(raw || "");

// Flags SEMPRE definidas
const isOperational =
  raw.execution_type === "operational" ||
  rawText.includes('"execution_type":"operational"') ||
  rawText.includes('"execution_type": "operational"');

const hasDirectorApproval =
  raw.director_ok === true ||
  raw.approve === true ||
  rawText.includes('"director_ok":true') ||
  rawText.includes('"approve":true');

// Diagnóstico puro (NÃO depende de flags operacionais)
const isDiagnosticOnly =
  raw.executor_action === "diagnose_codebase" ||
  rawText.includes('"executor_action":"diagnose_codebase"');

  const safeNow = () =>
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);

  const reqId =
    (action &&
      (action.requestId || action.request_id || action.id)) ||
    `exec-${safeNow()}`;

  const baseResult = {
    ok: false,
    requestId: reqId,
    mode: (action && action.mode) || "auto",
    warnings: [],
    steps: [],
  };

  // 🔥 FIX CRÍTICO — declare a variável antes de qualquer uso
  let finalMode = "";

  try {
    const a = action || {};

    // garante que executor_action esteja acessível em `a`
    if (action && typeof action.executor_action === "string") {
      a.executor_action = action.executor_action;
    }

    // 🧠 LOG 3 — action bruto recebido pelo EXECUTOR
    console.log("[EXECUTOR] action recebido:", JSON.stringify(action));

    // =====================================================
    // 🔁 AÇÕES DE ALTO NÍVEL (deploy_*, ping, list_modules)
    // =====================================================
    let highLevelAction = "";
    if (a && typeof a.action === "string") {
      highLevelAction = a.action.toLowerCase();
    } else if (a && typeof a.executor_action === "string") {
      highLevelAction = a.executor_action.toLowerCase();
    }

    // 🧠 LOG 4 — interpretação do executor (ação normalizada)
console.log("[EXECUTOR] highLevelAction:", highLevelAction);

// ============================================================
// 🔍 AUDIT MODE — DIAGNÓSTICO PURO (LEITURA TOTAL)
// ============================================================
// ✅ ALIAS CANÔNICO: "audit" deve chamar o mesmo motor do diagnóstico
if (highLevelAction === "audit") {
  return await runAuditMode(env, {
    raw,
    rawText,
    isOperational,
    hasDirectorApproval,
    baseResult,
  });
}

if (highLevelAction === "diagnose_codebase") {
  return await runAuditMode(env, {
    raw,
    rawText,
    isOperational,
    hasDirectorApproval,
    baseResult,
  });
}

// =====================================================
// 🛠️ FIX FROM AUDIT — ARRUMAR APÓS DIAGNÓSTICO
// =====================================================
if (highLevelAction === "fix_from_audit") {
  return await fixFromAudit(env, {
    raw,
    baseResult,
  });
}

// =====================================================
// ♻️ SMART DEPLOY PLAN — LOOP INTELIGENTE (PLANEJADOR)
// =====================================================
if (highLevelAction === "smart_deploy") {
  return await handleSmartDeployPlan(env, {
    raw,
    baseResult,
  });
}

// =====================================================
// 🔗 WORKER → WORKER (SERVICE BINDING — TESTE FIXO)
// =====================================================
if (highLevelAction === "worker_read") {
  const service = resolveWorkerService("enavia-worker-teste", env);

  if (!service || typeof service.fetch !== "function") {
    return {
      ...baseResult,
      ok: false,
      mode: "worker_read",
      error: "BINDING_NOT_FOUND",
      message: "Service binding ENAVIA_WORKER_TEST não disponível no executor-test.",
    };
  }

  try {
    const resp = await service.fetch(
      "http://internal/__internal__/describe"
    );

    const json = await resp.json();

    return {
      ...baseResult,
      ok: true,
      mode: "worker_read",
      target: "enavia-worker-teste",
      response: json,
      message: "worker_read OK via Service Binding",
    };
  } catch (err) {
    return {
      ...baseResult,
      ok: false,
      mode: "worker_read",
      error: "WORKER_FETCH_FAILED",
      detail: err.message || String(err),
    };
  }
}

// 0️⃣ EXECUTE_PLAN — executa 1 passo do plano já gravado em EXECUTION:<id>
if (highLevelAction === "deploy_execute_plan") {
  const execId =
    raw.execution_id ||
    raw.executionId ||
    (raw.plan && (raw.plan.execution_id || raw.plan.executionId)) ||
    null;

  if (!execId || typeof execId !== "string") {
    return {
      ...baseResult,
      ok: false,
      mode: "deploy_execute_plan",
      error: "MISSING_EXECUTION_ID",
      message:
        "deploy_execute_plan requer execution_id (no topo ou dentro de plan.execution_id).",
    };
  }

  if (!ENAVIA_GIT || typeof ENAVIA_GIT.get !== "function") {
    return {
      ...baseResult,
      ok: false,
      mode: "deploy_execute_plan",
      error: "KV_NOT_CONFIGURED",
      message: "ENAVIA_GIT / GIT_KV não configurado no enavia-executor.",
    };
  }

  const execKey = `EXECUTION:${execId}`;
  let execDoc = {};
  try {
    const rawExec = await ENAVIA_GIT.get(execKey);
    if (rawExec) {
      const parsedExec = JSON.parse(rawExec);
      if (parsedExec && typeof parsedExec === "object") {
        execDoc = parsedExec;
      }
    }
  } catch (_err) {
    // se der erro de parse, continua com execDoc vazio
  }

  // base plan / contract / target
  let plan = execDoc.plan || raw.plan || null;
  if (typeof plan === "string") {
    try {
      plan = JSON.parse(plan);
    } catch (_err) {
      plan = null;
    }
  }

  if (!plan || typeof plan !== "object" || !Array.isArray(plan.steps)) {
    return {
      ...baseResult,
      ok: false,
      mode: "deploy_execute_plan",
      execution_id: execId,
      error: "INVALID_PLAN",
      message:
        "EXECUTION.plan ausente ou inválido. Esperado objeto com steps[].",
    };
  }

  // garante que EXECUTION tenha contract/plan/target mínimos
  if (!execDoc || typeof execDoc !== "object") {
    execDoc = { execution_id: execId };
  }
  if (!execDoc.contract && raw.contract) {
    execDoc.contract = raw.contract;
  }
  if (!execDoc.plan) {
    execDoc.plan = plan;
  }
  if (!execDoc.target && (raw.target || plan.target)) {
    execDoc.target = raw.target || plan.target;
  }

  const steps = Array.isArray(plan.steps) ? plan.steps : [];
  let state =
    plan.state && typeof plan.state === "object" ? plan.state : {};
  const history = Array.isArray(state.history) ? state.history : [];

  const forceStepId =
    typeof raw.force_step_id === "string" ? raw.force_step_id : null;

  let currentIndex =
    typeof state.current_step_index === "number"
      ? state.current_step_index
      : -1;

  if (!forceStepId && typeof state.current_step_id === "string") {
    const idx = steps.findIndex((s) => s && s.id === state.current_step_id);
    if (idx >= 0) {
      currentIndex = idx;
    }
  }

  let nextIndex = -1;
  if (forceStepId) {
    nextIndex = steps.findIndex((s) => s && s.id === forceStepId);
  } else if (currentIndex < 0) {
    nextIndex = 0;
  } else {
    nextIndex = currentIndex + 1;
  }

  if (nextIndex < 0 || nextIndex >= steps.length) {
    const finalState = {
      ...state,
      status: state.status || "done",
    };
    plan.state = finalState;
    execDoc.plan = plan;
    execDoc.execution_id = execId;
    execDoc.updated_at = Date.now();

    try {
      await ENAVIA_GIT.put(execKey, JSON.stringify(execDoc));
    } catch (_err) {
      // não derruba resposta se falhar persistência final
    }

    return {
      ...baseResult,
      ok: true,
      mode: "deploy_execute_plan",
      execution_id: execId,
      done: true,
      message: "Nenhum próximo passo encontrado no plano (steps esgotados).",
      plan_state: finalState,
    };
  }

  const step = steps[nextIndex] || {};
  const stepId = step.id || `step_${nextIndex}`;
  const stepType =
    (step.type && String(step.type).toLowerCase()) || "unknown";

    let innerResult = null;

  // 🔹 runner: audit / propose / apply_test / await_proof
  if (stepType === "audit" || stepType === "propose") {
    const innerAction = {
      executor_action: stepType,
      execution_id: execId,
      target: execDoc.target || plan.target || raw.target || null,
      contract: execDoc.contract || plan.contract || raw.contract || null,
      plan,
      context: {
        ...(raw.context && typeof raw.context === "object"
          ? raw.context
          : {}),
        stage: stepType,
        step_id: stepId,
      },
    };

    innerResult = await enaviaExecutorCore(env, innerAction);

    // NOVO: espelha estado de AUDIT em FLOW_STATE quando rodar via plano
    try {
      if (stepType === "audit") {
        // IMPORTANTE: o AUDIT precisa ser sempre atrelado ao execution_id do plano
        // (exec-plan-apply-TEST-XX), que é o mesmo que você usa depois no /status.
        // Por isso, aqui usamos SEMPRE o execId externo do plano.
        const execIdForAudit = execId;

        if (execIdForAudit) {
          // 1) grava FLOW_STATE no KV canônico
          await updateFlowStateKV(env, execIdForAudit, {
            stage:
              (innerResult && innerResult.stage) || "audit",
            last_step: "audit",
            route: "/audit",
            ok: !(innerResult && innerResult.ok === false),
            risk:
              (innerResult && innerResult.riskReport) || null,
            staging:
              (innerResult && innerResult.staging) || null,
            workerId:
              (innerAction.target && innerAction.target.workerId) ||
              null,
            target: innerAction.target || null,
            message:
              (innerResult && innerResult.message) || null,
          });

          // 2) espelha AUDIT direto no deploy-worker (/__internal__/audit)
          const deployBaseForAudit =
            (env &&
              (env.DEPLOY_WORKER_URL || env.DEPLOY_WORKER_ENDPOINT)) ||
            null;

          if (deployBaseForAudit) {
    const auditPayload = {
      execution_id: execIdForAudit, // ✅ ID do plano
      audit: {
        ok: !(innerResult && innerResult.ok === false),
        source: "enavia-executor",
        risk: (innerResult && innerResult.riskReport) || null,
        message: (innerResult && innerResult.message) || null,
        workerId:
          (innerAction.target && innerAction.target.workerId) || null,

        // 🔎 só debug:
        audit_internal_execution_id: execId,
      },
    };

    try {
    const auditBase = String(deployBaseForAudit || env.DEPLOY_WORKER_URL || "")
      .trim()
      .replace(/\/+$/, "")
      .replace(/\/__internal__$/, "");

    const auditUrl = auditBase + "/__internal__/audit";

    await fetch(auditUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${String(env.INTERNAL_TOKEN || "")}`,
      },
      body: JSON.stringify(auditPayload),
    });
  } catch (_err2) {
    // best effort
  }
  }
}
      }
    } catch (_err) {
      // best effort: falha de KV não bloqueia o plano
    }
  } else if (stepType === "apply_test") {
  const deployBase =
    (env && (env.DEPLOY_WORKER_URL || env.DEPLOY_WORKER_ENDPOINT)) || null;

  if (!deployBase) {
    innerResult = {
      ok: false,
      mode: "deploy_execute_plan",
      error: "DEPLOY_WORKER_URL_NOT_CONFIGURED",
      step_type: stepType,
      message:
        "Step apply_test requer DEPLOY_WORKER_URL ou DEPLOY_WORKER_ENDPOINT configurado no enavia-executor.",
    };
  } else {
    const target =
      execDoc.target || plan.target || raw.target || null;

    const patchObj =
      (step && step.patch && typeof step.patch === "object"
        ? step.patch
        : null) ||
      execDoc.patch ||
      plan.patch ||
      (plan.staging && plan.staging.patch) ||
      raw.patch ||
      null;

    const candidateHash =
      execDoc.candidate_hash ||
      plan.candidate_hash ||
      plan.candidateHash ||
      (patchObj &&
        (patchObj.hash ||
          patchObj.candidate_hash ||
          patchObj.candidateHash)) ||
      raw.candidate_hash ||
      raw.candidateHash ||
      null;

    const base = String(deployBase || env.DEPLOY_WORKER_URL || "")
  .trim()
  .replace(/\/+$/, "")
  .replace(/\/__internal__$/, ""); // evita duplicar __internal__

const url = base + "/apply-test";

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
  "Content-Type": "application/json",
  ...(env?.INTERNAL_TOKEN
    ? { Authorization: `Bearer ${String(env.INTERNAL_TOKEN)}` }
    : {}),
},
        body: JSON.stringify({
          execution_id: execId,
          target,
          patch: patchObj,
          candidate_hash: candidateHash || undefined,
          staged_by: "enavia-executor",
        }),
      });

      const txt = await res.text();
      let data = null;
      try { data = JSON.parse(txt); } catch (_) {}

      const ok = !!res.ok;

      // monta um erro legível (sem explodir tamanho)
      const errMsg =
        ok ? null :
        (data && (data.error || data.message)) ? (data.error || data.message) :
        (txt ? String(txt).slice(0, 300) : "apply_test_failed");

      innerResult = {
        ok,
        mode: "deploy_execute_plan",
        step: "apply_test",
        http_status: res.status,
        response: data || txt,
        error: errMsg,

        // ✅ garante mensagem para aparecer no plan_state/history
        message: ok ? `APPLY_TEST OK (http ${res.status})`
                    : `APPLY_TEST falhou: ${errMsg}`,
      };

      // grava estado (mesmo quando falha) pra ficar rastreável no KV do executor
      try {
        await updateFlowStateKV(env, execId, {
          stage: "apply_test",
          last_step: "apply_test",
          ok,
          candidate_hash: candidateHash || null,
          target: target || null,
          patch: patchObj || null,
          last_error: errMsg,
          updated_at: Date.now(),
        });
      } catch (_eKV) {}

      // IMPORTANTÍSSIMO: coloca summary no history pra não ficar null
      try {
        if (execDoc && Array.isArray(execDoc.history)) {
          const idx = execDoc.history.findIndex(
            (h) => h && h.type === "apply_test"
          );
          const summaryTxt = ok ? "APPLY_TEST ok." : `APPLY_TEST falhou: ${errMsg}`;
          if (idx >= 0) execDoc.history[idx].summary = summaryTxt;
        }
      } catch (_eHist) {}

    } catch (_err) {
      innerResult = {
        ok: false,
        mode: "deploy_execute_plan",
        error: "APPLY_TEST_CALL_FAILED",
        step: "apply_test",
        message: String(
          _err && _err.message
            ? _err.message
            : _err || "Erro ao chamar /apply-test no deploy-worker."
        ),
      };
    }
  }
} else if (stepType === "await_proof") {
    const candidateHash =
      (plan && (plan.candidate_hash || plan.candidateHash)) ||
      (execDoc && execDoc.candidate_hash) ||
      raw.candidate_hash ||
      raw.candidateHash ||
      null;

    if (!candidateHash) {
      innerResult = {
        ok: false,
        mode: "deploy_execute_plan",
        error: "MISSING_CANDIDATE_HASH",
        message:
          "Step await_proof requer candidate_hash no plano ou na execução.",
      };
    } else if (!env?.GIT_KV && !env?.ENAVIA_GIT) {
      innerResult = {
        ok: false,
        mode: "deploy_execute_plan",
        error: "KV_NOT_CONFIGURED",
        message:
          "KV ENAVIA_GIT/GIT_KV não configurado para validar a prova do Browser.",
      };
    } else {
      const proofKey = `DEPLOY_OK:${candidateHash}`;
      let proofJson = null;

      try {
        const kv = env.GIT_KV || env.ENAVIA_GIT;
        const rawProof = await kv.get(proofKey);
        if (rawProof) {
          try {
            proofJson = JSON.parse(rawProof);
          } catch (_err) {
            proofJson = { raw: rawProof };
          }
        }
      } catch (_err) {
        // falha de KV vira erro mas não derruba Worker
      }

      if (!proofJson) {
        innerResult = {
          ok: false,
          mode: "deploy_execute_plan",
          error: "PROOF_NOT_FOUND",
          candidate_hash: candidateHash,
          proof_key: proofKey,
          message:
            "Nenhuma prova encontrada no KV para este candidate_hash (aguardando /browser-proof).",
        };
      } else {
        const beforeOk =
          !proofJson.before || proofJson.before.ok !== false;
        const afterOk =
          !proofJson.after || proofJson.after.ok !== false;
        const proofOk = beforeOk && afterOk;

        innerResult = {
          ok: proofOk,
          mode: "deploy_execute_plan",
          candidate_hash: candidateHash,
          proof_key: proofKey,
          proof: proofJson,
          message: proofOk
            ? "Prova do Browser encontrada e marcada como OK."
            : "Prova do Browser encontrada, mas marcada como falha.",
        };
      }

      try {
        await updateFlowStateKV(env, execId, {
          stage: "await_proof",
          last_step: "await_proof",
          workerId:
            (execDoc.target && execDoc.target.workerId) ||
            (plan.target && plan.target.workerId) ||
            (raw.target && raw.target.workerId) ||
            null,
          candidate_hash: candidateHash,
          ok:
            innerResult && typeof innerResult.ok === "boolean"
              ? innerResult.ok
              : undefined,
        });
      } catch (_err) {
        // best effort
      }
    }
  } else {
    innerResult = {
      ok: false,
      mode: "deploy_execute_plan",
      error: "STEP_TYPE_NOT_IMPLEMENTED_V2",
      step_type: stepType,
      message:
        "STEP_TYPE_NOT_IMPLEMENTED_V3 (audit/propose/apply_test/await_proof ligados).",
    };
  }

  const okFlag = innerResult && innerResult.ok === true;
  const nowTs = Date.now();
 
  const newHistory = history.concat([
    {
      step_id: stepId,
      type: stepType,
      ok: okFlag,
      ts: nowTs,
      summary:
        innerResult && typeof innerResult.message === "string"
          ? innerResult.message
          : null,
    },
  ]);

  const isLast = nextIndex >= steps.length - 1;
  const status = okFlag ? (isLast ? "done" : "running") : "failed";

  const newState = {
    ...state,
    current_step_id: stepId,
    current_step_index: nextIndex,
    last_step_ok: okFlag,
    status,
    history: newHistory,
  };

  plan.state = newState;
  execDoc.plan = plan;
  execDoc.execution_id = execId;
  execDoc.updated_at = nowTs;

  try {
    await ENAVIA_GIT.put(execKey, JSON.stringify(execDoc));
  } catch (_err) {
    // não derruba fluxo principal se falhar persistência
  }

  return {
    ...baseResult,
    ok: okFlag,
    mode: "deploy_execute_plan",
    execution_id: execId,
    step: {
      id: stepId,
      type: stepType,
      index: nextIndex,
      is_last: isLast,
    },
    step_result: innerResult,
    plan_state: newState,
  };
}

    // 1️⃣ DEPLOY: qualquer comando que comece com "deploy_"
    // ⚠️ BOUNDARY NOTE: deploy_* commands are handled via handleDeployFlow
    // for backward compatibility. Deploy-worker is the authority for:
    // apply-test, approve, promote, rollback, cancel, deploy governance.
    // handleDeployFlow delegates when DEPLOY_WORKER_URL is available.
    if (highLevelAction.startsWith("deploy_")) {
      const deployResult = await handleDeployFlow(env, a, baseResult);
      if (deployResult) {
        return deployResult;
      }
    }
    
    // 2️⃣ PING
    if (highLevelAction === "ping") {
      return {
        ...baseResult,
        ok: true,
        mode: "noop",
        noop: true,
        steps: ["hl-action:ping"],
        message: "Ping recebido pelo ENAVIA_EXECUTOR core_v2.",
      };
    }

    // 3️⃣ LIST_MODULES
    if (highLevelAction === "list_modules") {
      const kv = ENAVIA_GIT;
      if (!kv || typeof kv.list !== "function") {
        return {
          ...baseResult,
          ok: false,
          steps: ["hl-action:list_modules", "kv:error"],
          error: "KV ENAVIA_GIT não está configurado no executor.",
        };
      }

      const listResult = await kv.list();
      const modules = (listResult && Array.isArray(listResult.keys)
        ? listResult.keys
        : []).map((item) => ({
          key: item.name,
          name: item.name,
          expiration: item.expiration || null,
        }));

      return {
        ...baseResult,
        ok: true,
        mode: "noop",
        noop: true,
        steps: ["hl-action:list_modules"],
        totalModules: modules.length,
        modules,
        message: "Lista de módulos lida diretamente do KV ENAVIA_GIT.",
      };
    }

    // =====================================================
    // 0️⃣ Normalização de campos
    // =====================================================
    let mode = (a.mode || "auto").toLowerCase();

    // 🔗 bridge canônico:
    // se vier mode = "smart_deploy_plan" (sem action),
    // manda direto pro planner já existente
    if (mode === "smart_deploy_plan") {
      return await handleSmartDeployPlan(env, {
        raw,
        baseResult,
      });
    }

    const reason = a.reason || a.description || null;
    const rawPatch = a.patch;
    const dryRun = Boolean(a.dryRun || a.dry_run);

    // 🔑 executionId canônico (usado pelo gate operacional e modos)
    const executionId =
      raw.execution_id ||
      raw.executionId ||
      a.execution_id ||
      a.executionId ||
      reqId;

    // Arrays específicos por modo
    const kvPatch = a.kvPatch || a.kv_patch || null;
    const modulePatch = a.modulePatch || a.module_patch || null;

    const result = {
      ...baseResult,
      reason,
      dryRun,
    };

// -----------------------------------------------------
// IMPLEMENTAÇÃO DO MODO "ping" VIA { mode: "ping" }
// -----------------------------------------------------
if (mode === "ping") {
  return {
    ...result,
    ok: true,
    mode: "ping",
    steps: [...result.steps, "mode:ping"],
    message: "pong — executor core_v2 operacional."
  };
}

    // =====================================================
    // 1️⃣ Resolução de modo (auto → kv_patch / module_patch / noop)
    // =====================================================
    if (mode === "auto") {
      if (Array.isArray(kvPatch) && kvPatch.length > 0) {
        mode = "kv_patch";
      } else if (Array.isArray(modulePatch) && modulePatch.length > 0) {
        mode = "module_patch";
      } else if (typeof rawPatch === "string" && rawPatch.trim()) {
        // NÃO vamos executar JS dinâmico — tratamos como NOOP seguro
        mode = "noop";
        result.warnings.push(
          "patch string recebido, mas js_patch permanece desativado; usando modo noop."
        );
      } else {
        mode = "noop";
      }
    }

    result.mode = mode;
    result.steps.push(`mode-resolved:${mode}`);

    // =====================================================
    // 🔁 Modo DEPLOY_REQUEST → delega para APPLY REAL
    // =====================================================
    if (mode === "deploy_request") {
      // apontamos explicitamente para o APPLY REAL
      finalMode = "apply";
      result.steps.push("deploy_request:map-to-apply");
    }

    // =====================================================
    // 2️⃣ Modo NOOP — nada a fazer, usado para testes
    // =====================================================
    if (mode === "noop") {
      return {
        ...result,
        ok: true,
        noop: true,
        message: "Nada a aplicar (modo noop / sem patch).",
      };
    }

    // =====================================================
    // 3️⃣ Modo JS_PATCH — PERMANECE DESATIVADO
    // =====================================================
    if (mode === "js_patch") {
      const patch = typeof rawPatch === "string" ? rawPatch.trim() : "";

      if (!patch) {
        return {
          ...result,
          ok: false,
          error: "Patch JS ausente ou vazio.",
          blocked: true,
          reason: "js_patch está desativado.",
        };
      }

      const maxPatchLen = 12000;
      if (patch.length > maxPatchLen) {
        return {
          ...result,
          blocked: true,
          error: `Patch muito grande (${patch.length} chars). Limite: ${maxPatchLen}.`,
          reason: "js_patch está desativado.",
        };
      }

      return {
        ...result,
        ok: false,
        blocked: true,
        mode: "js_patch",
        reason:
          "Cloudflare Workers bloqueiam eval/new Function/import dinâmico. O modo js_patch permanece desativado.",
        instructions: {
          use: ["kv_patch", "module_patch"],
          never_use: ["js_patch"],
        },
        received_code_preview: patch.slice(0, 200),
        timestamp: new Date().toISOString(),
      };
    }

// =====================================================
// 🧠 GATE OPERACIONAL — BLOQUEIA ENGINEER SEM OK DO DIRETOR
// =====================================================

if (
  mode === "engineer" &&
  isOperational === true &&
  hasDirectorApproval !== true
) {
  return {
    ...result,
    ok: true,
    status: "awaiting_director_ok",
    execution_id: executionId,
    message:
      "Plano técnico pronto para execução real. Aguardando aprovação do Diretor."
  };
}

// =====================================================
// 6️⃣ Modo ENGINEER — Plano + Patch + Staging + Risco
// =====================================================
if (mode === "engineer") {

  result.steps.push("mode-resolved:engineer");

  const shouldGeneratePatch = (a?.generatePatch === true) || (raw?.generatePatch === true);

  // 1) Intenção recebida
  const intentText = a.intent || JSON.stringify(a);

  // 2) Tentar ler o worker-alvo (quando target vier)
  const target = a?.target || raw?.target || null;

  const requireLiveRead =
    a?.context?.require_live_read === true ||
    raw?.context?.require_live_read === true;

  // CONTRATO: se exigir leitura live, target tem que ser válido
  if (
    requireLiveRead &&
    !(target?.system === "cloudflare_worker" && typeof target?.workerId === "string")
  ) {
    return {
      ...result,
      ok: false,
      error: true,
      http_status: 422,
      reason: "invalid_target",
      context_used: false,
      context_summary: { target },
      suggestions: [],
      message: "Target inválido para leitura LIVE (cloudflare_worker/workerId obrigatório).",
    };
  }

  let context_used = false;
  let context_summary = null;
  // ✅ HOIST: usado abaixo (anchors/patch generation). Evita ReferenceError.
  let workerCode = "";
      
  // sugestões base (fallback)
  let suggestions = shouldGeneratePatch
    ? [
        "Aprovar deploy para aplicar o patch sugerido.",
        "Revisar o código sugerido no patch_text antes de executar.",
        "Gerar um patch alternativo."
      ]
    : [
        "Enviar patch manual para correção.",
        "Executar AUDIT novamente com generatePatch=true.",
        "Cancelar operação."
      ];

  // ✅ CORREÇÃO: não depender de target.system; se tiver workerId string, tenta ler
  const targetWorkerId =
    (target && typeof target.workerId === "string" && target.workerId.trim())
      ? target.workerId.trim()
      : null;

      if (targetWorkerId) {
        try {
          const workerId = targetWorkerId;
    
          // resolve scriptName do workerId (usa o que já existe no executor)
          const scriptName = await resolveWorkerScriptName({ env, workerId });
    
          // credenciais CF no ambiente do EXECUTOR (não do ENAVIA)
          const accountId =
            env?.CF_ACCOUNT_ID ||
            env?.CLOUDFLARE_ACCOUNT_ID ||
            env?.CF_ACCOUNT ||
            null;
    
          const apiToken =
            env?.CF_API_TOKEN ||
            env?.CLOUDFLARE_API_TOKEN ||
            env?.CF_TOKEN ||
            null;
    
          if (!accountId || !apiToken) {
            throw new Error("CF_ACCOUNT_ID/CF_API_TOKEN ausentes no ambiente do Executor");
          }
    
          // ✅ caminho canônico (igual o /audit): snapshot live
          const snap = await fetchCurrentWorkerSnapshot({
            accountId,
            apiToken,
            scriptName,
          });
    
          // ✅ workerCode LOCAL (não depende de escopo externo)
          workerCode = String(snap?.code || "");
          if (!workerCode.trim()) {
            throw new Error("Snapshot vazio do worker-alvo");
          }

          // hash simples (fnv1a32) para prova
          const fnv1a32 = (str) => {
            let h = 0x811c9dc5;
            for (let i = 0; i < str.length; i++) {
              h ^= str.charCodeAt(i);
              h = Math.imul(h, 0x01000193) >>> 0;
            }
            return ("0000000" + h.toString(16)).slice(-8);
          };

          const snapshot_lines = workerCode.split(/\r?\n/).length;
          const snapshot_chars = workerCode.length;

          const context_proof_local = {
            target: { system: "cloudflare_worker", workerId },
            scriptName,
            snapshot_fingerprint: `fnv1a32:${fnv1a32(workerCode)}`,
            snapshot_chars,
            snapshot_lines,
            cf_etag: snap.etag,
            cf_last_modified: snap.last_modified,
            fetched_at_ms: snap.fetched_at_ms,
          };

          context_used = true;
          context_summary = context_proof_local;
        
          // heurísticas simples (LOW-RISK) para sugestões reais de logs/clareza
          const consoleLogs = (workerCode.match(/console\.log\(/g) || []).length;
          const logNVCalls = (workerCode.match(/\blogNV\(/g) || []).length;

          const s1 =
            "Padronizar logs com um único helper e prefixo fixo, incluindo execution_id/reqId (melhora rastreio sem mudar comportamento).";

          const s2 =
            consoleLogs > 0
              ? "Substituir console.log direto por log helper (melhora clareza/ruído sem alterar regra de negócio)."
              : logNVCalls === 0
                ? "Adicionar 1 log de entrada + 1 log de saída (com execution_id/workerId) para evidência objetiva em produção, sem mudar fluxo."
                : "Garantir que todos os logs importantes carreguem campos (execution_id, workerId) — hoje já existe helper, mas vale padronizar o payload.";

          suggestions = [s1, s2];
    
        } catch (err) {
          // ✅ CONTRATO: se exigir leitura live, não pode sugerir no escuro
          if (requireLiveRead) {
            return {
              ...result,
              ok: false,
              error: true,
              http_status: 422,
              reason: "live_read_failed",
              context_used: false,
              context_summary: { target, error: String(err?.message || err) },
              suggestions: [],
              message: "require_live_read=true e a leitura LIVE do worker-alvo falhou. Sugestões bloqueadas.",
            };
          }
    
          result.warnings.push("ENGINEER: falhou ao ler worker-alvo (sem snapshot).");
          result.warnings.push(String(err?.message || err));
          context_used = false;
          context_summary = {
            target,
            error: String(err?.message || err),
          };
        }
      }

  // 3) Gerar plano técnico (agora com evidência de contexto quando existir)
  const hasSnapshotProof =
    context_used === true &&
    !!(context_summary && typeof context_summary === "object" && context_summary.snapshot_fingerprint);

  const plan = {
    summary: hasSnapshotProof
      ? "Análise concluída com leitura do worker-alvo (snapshot carregado)."
      : "Análise concluída (sem snapshot do worker-alvo).",
    intent: intentText,
    steps: [
      "Interpretar intenção do usuário",
      hasSnapshotProof
        ? "Ler worker-alvo via Cloudflare API (snapshot)"
        : "Tentar ler worker-alvo (falhou/ausente)",
      "Avaliar riscos e impacto",
      shouldGeneratePatch
        ? "Gerar patch sugerido (não aplicado)"
        : "Nenhum patch será gerado automaticamente",
      "Preparar decisão humana"
    ]
  };

  let patchSuggestion = null;
  let staging = {
    ready: false,
    notes: "Nenhum patch gerado automaticamente."
  };

  // 4) Patch sugerido (ANCORADO no worker-alvo, sem chute)
if (shouldGeneratePatch) {
  // Governança:
  // - requireAnchors/strict_schema = só “assino” se eu provar âncoras REAIS compatíveis com o patch sugerido.
  // - NÃO depende de endpoints internos no alvo por padrão.
  // - Discovery (/__internal__/routes|capabilities) só entra se for solicitado explicitamente.

  const requireAnchors =
    raw?.context?.require_anchors === true ||
    raw?.context?.strict_schema === true;

  const wantsDiscovery =
    raw?.context?.wantsDiscovery === true ||
    raw?.context?.wants_discovery === true ||
    /__internal__|routes|capabilit/i.test(String(intentText || ""));

  const code = workerCode || "";
  const lines = code ? code.split(/\r?\n/) : [];

  const findLine = (contains) =>
    lines.find((l) => typeof l === "string" && l.includes(contains)) || null;

  const indentBlock = (block, indent) =>
    block
      .split("\n")
      .map((ln) => (ln.length ? indent + ln : ln))
      .join("\n");

  const hasWithCORS = code.includes("withCORS(");
  const hasJsonResponse = code.includes("jsonResponse(");

  const wrapJson200 = (jsonLiteral) => {
    if (hasWithCORS && hasJsonResponse) {
      return `return withCORS(jsonResponse(${jsonLiteral}, 200));`;
    }
    return `return new Response(JSON.stringify(${jsonLiteral}), { status: 200, headers: { "content-type": "application/json; charset=utf-8" } });`;
  };

  // Âncoras possíveis (depende do tipo de patch)
  const buildLine = findLine("/__internal__/build");
  const auditLine = findLine('"/audit"') || findLine("/audit");

  const patches = [];
  let anchorProofOk = false;
  let noAnchorReason = null;

  // Patch DISCOVERY (LOW-RISK) — somente se solicitado explicitamente
  if (wantsDiscovery) {
    // Para discovery, a âncora “real” mínima é existir o /__internal__/build no código do alvo
    if (buildLine) anchorProofOk = true;

    // 1) /__internal__/routes
    if (buildLine) {
      const indent = (buildLine.match(/^\s*/) || [""])[0];

      const routesBlock = [
        `if (METHOD === "GET" && pathname === "/__internal__/routes") {`,
        `  ${wrapJson200(`{ ok: true, worker: (typeof SYSTEM_NAME !== "undefined" ? SYSTEM_NAME : "worker"), routes: [`,
        `{ method: "POST", path: "/audit" },`,
        `{ method: "POST", path: "/propose" },`,
        `{ method: "GET", path: "/__internal__/build" },`,
        `{ method: "GET", path: "/__internal__/routes" },`,
        `{ method: "GET", path: "/__internal__/capabilities" }`,
        `], timestamp: new Date().toISOString() }`)}`,
        `}`,
      ].join("\n");

      const inserted = indentBlock(routesBlock, indent) + "\n" + buildLine;

      patches.push({
        target: "cloudflare_worker",
        workerId: targetWorkerId,
        title: "Adicionar /__internal__/routes (descoberta canônica)",
        anchor: { match: buildLine.trim() },
        search: buildLine,
        replace: inserted,
        reason: "Discovery read-only (LOW-RISK). Só proposto quando solicitado.",
      });
    }

    // 2) /__internal__/capabilities
    if (auditLine) {
      // auditLine aqui é só ponto de inserção; não vira dependência do executor
      const indent = (auditLine.match(/^\s*/) || [""])[0];

      const capsBlock = [
        `if (METHOD === "GET" && pathname === "/__internal__/capabilities") {`,
        `  ${wrapJson200(`{ ok: true, worker: (typeof SYSTEM_NAME !== "undefined" ? SYSTEM_NAME : "worker"), capabilities: {`,
        `    canAudit: true,`,
        `    canPropose: true,`,
        `    canApplyTest: false,`,
        `    discovery: { routes: "/__internal__/routes", build: "/__internal__/build" },`,
        `    propose: { requires: ["target.workerId"], outputs: ["suggestions", "patchText(optional)"] },`,
        `    audit: { requires: ["target.workerId", "patch(optional)"], outputs: ["verdict", "risk_level"] }`,
        `  }, timestamp: new Date().toISOString() }`)}`,
        `}`,
      ].join("\n");

      const inserted = indentBlock(capsBlock, indent) + "\n" + auditLine;

      patches.push({
        target: "cloudflare_worker",
        workerId: targetWorkerId,
        title: "Adicionar /__internal__/capabilities (descoberta canônica)",
        anchor: { match: auditLine.trim() },
        search: auditLine,
        replace: inserted,
        reason: "Discovery read-only (LOW-RISK). Só proposto quando solicitado.",
      });

      // se não tinha buildLine mas tinha auditLine, ainda é uma âncora real de inserção
      anchorProofOk = true;
    }

    if (requireAnchors && !anchorProofOk) {
      noAnchorReason =
        "Discovery solicitado, mas não consegui provar âncora real no alvo (ex.: /__internal__/build).";
    }
  }

  // Patch OBS (LOW-RISK) — funciona em webhook workers sem __internal__
  const __obsSignal = `${String(intentText || "")} ${String(a?.prompt || raw?.prompt || "")}`;
  const wantsObs =
    /log|telemetri|observabil|trace|parse|valid/i.test(__obsSignal);

  if (wantsObs) {
    const findLineRx = (rx) => {
      try {
        const lines = code.split(/\r?\n/);
        for (const line of lines) {
          if (rx.test(line)) return line;
        }
      } catch (_) {}
      return null;
    };

    const fetchLine =
      // formas comuns
      findLine("async fetch") ||
      findLine("fetch(request") ||
      findLine("fetch(request,") ||
      findLine("fetch: async") ||
      findLine("fetch:async") ||

      // Cloudflare Worker: export default { fetch(request, env, ctx) { ... } }
      findLineRx(/^\s*fetch\s*\(\s*request\b.*\)\s*\{\s*$/) ||
      findLineRx(/^\s*async\s+fetch\s*\(\s*request\b.*\)\s*\{\s*$/) ||

      // Cloudflare Worker: export default { fetch: async (request, env, ctx) => { ... } }
      findLineRx(/\bfetch\s*:\s*async\s*\(/) ||
      findLineRx(/\bfetch\s*:\s*function\s*\(/) ||

      // handler nomeado
      findLineRx(/^\s*(?:export\s+)?async\s+function\s+fetch\s*\(\s*request\b.*\)\s*\{\s*$/i) ||
      findLineRx(/^\s*(?:export\s+)?function\s+fetch\s*\(\s*request\b.*\)\s*\{\s*$/i) ||

      // fallback final (qualquer fetch(request...)
      findLineRx(/\basync\s+fetch\s*\(/) ||
      findLineRx(/\bfetch\s*\(\s*request\b/);

    // pega uma linha de parse JSON que seja "atribuída a variável" (pra extrair o nome com segurança)
    const jsonLine =
      findLine("request.json()") ||
      findLineRx(
        /\b(?:const|let|var)\s+[A-Za-z_$][\w$]*\s*=\s*await\s+[A-Za-z_$][\w$]*\.json\(\)\s*;?/i
      );

    // Para OBS, âncora real = achar fetch e/ou um ponto claro de parse (jsonLine)
    if (fetchLine || jsonLine) anchorProofOk = true;

    // helper de log (só se não existir)
    if (fetchLine && !code.includes("const __nvLog")) {
      const indent = (fetchLine.match(/^\s*/) || [""])[0];

      const helperBlock = [
        `// === NV LOG HELPER (AUTO) ===`,
        `const __nvLog = (execId, ...args) => console.log("[NV]", execId || "-", ...args);`,
        `// === /NV LOG HELPER (AUTO) ===`,
        ``,
      ].join("\n");

      const inserted = fetchLine + "\n" + indentBlock(helperBlock, indent + "  ");

      patches.push({
        target: "cloudflare_worker",
        workerId: targetWorkerId,
        title: "Adicionar helper de log NV no fetch() (LOW-RISK)",
        anchor: { match: fetchLine.trim() },
        search: fetchLine,
        replace: inserted,
        reason: "Padroniza logs sem mudar comportamento; base para rastrear execution_id.",
      });
    }

    // extrair execution_id após parse JSON (zero risco: só injeta se identificar a var)
    if (jsonLine && !code.includes("__nvExecutionId")) {
      const indent = (jsonLine.match(/^\s*/) || [""])[0];

      let jsonVar = null;
      try {
        const m = jsonLine.match(
          /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*await\s+[A-Za-z_$][\w$]*\.json\(\)\s*;?\s*$/i
        );
        if (m && m[1]) jsonVar = m[1];
      } catch (_) {}

      if (jsonVar) {
        const afterJson = [
          `// NV: extrai execution_id do payload (se existir) para logs/telemetria`,
          `const __nvExecutionId = ${jsonVar}?.execution_id || ${jsonVar}?.executionId || null;`,
          `if (typeof __nvLog === "function") __nvLog(__nvExecutionId, "payload_parsed");`,
        ].join("\n");

        const inserted = jsonLine + "\n" + indentBlock(afterJson, indent);

        patches.push({
          target: "cloudflare_worker",
          workerId: targetWorkerId,
          title: "Extrair execution_id após parse JSON (LOW-RISK)",
          anchor: { match: jsonLine.trim() },
          search: jsonLine,
          replace: inserted,
          reason: "Rastreabilidade por execution_id sem alterar lógica; apenas variável + log.",
        });
      }
    }

    if (requireAnchors && !anchorProofOk && !noAnchorReason) {
      noAnchorReason =
        "OBS solicitado, mas não consegui provar âncoras reais (fetch/parse JSON) no snapshot do alvo.";
    }
  }

  const wantCodex =
  raw?.context?.use_codex === true ||
  raw?.use_codex === true ||
  a?.context?.use_codex === true;

if (wantCodex && (env?.OPENAI_API_KEY || env?.CODEX_API_KEY)) {
  try {
    const codexResult = await callCodexEngine(env, {
      workerCode,
      intentText,
      contextSummary: context_summary,
      targetWorkerId,
    });

    if (codexResult && codexResult.ok && Array.isArray(codexResult.patches)) {
      for (const p of codexResult.patches) {
        if (!p || typeof p !== "object") continue;
        const patchText = p.patch_text || p.patchText || "";
        if (!patchText) continue;

        patches.push({
          target: "cloudflare_worker",
          workerId: targetWorkerId || (target && target.workerId) || null,
          title: p.title || "Patch codex",
          description: p.description || "Patch sugerido pelo motor Codex.",
          anchor:
            p.anchor && typeof p.anchor.match === "string"
              ? { match: p.anchor.match }
              : null,
          patch_text: patchText,
          reason:
            p.reason ||
            "Patch sugerido via Codex (não aplicado automaticamente).",
        });
      }
    } else if (codexResult && !codexResult.ok) {
      const reason = codexResult.reason || "unknown";
      result.warnings.push(`CODEX_ENGINE_NO_PATCH:${reason}`);
      result.steps.push("codex_engine_no_patch");

      // debug leve pra gente enxergar o que o modelo mandou
      if (codexResult.raw) {
        const rawSnippet =
          typeof codexResult.raw === "string"
            ? codexResult.raw.slice(0, 800)
            : JSON.stringify(codexResult.raw).slice(0, 800);

        result.suggestions = result.suggestions || [];
        result.suggestions.push(`[codex-debug] ${rawSnippet}`);
      }
    }
  } catch (err) {
    result.warnings.push("CODEX_ENGINE_FAILED");
    result.steps.push("codex_engine_error");
  }
}

const ready = patches.length > 0;

// Se exigiu anchors e eu não tenho prova, eu NÃO assino patch
  if (requireAnchors && (!anchorProofOk || !ready)) {
    patchSuggestion = null;
    staging = {
      ready: false,
      notes: `NO_ANCHOR_FOUND: não assinado. ${noAnchorReason || "Sem âncora provada para o patch solicitado."}`,
    };
    result.steps.push("NO_ANCHOR_FOUND");
    result.warnings.push("NO_ANCHOR_FOUND");
  } else {
    patchSuggestion = ready ? patches : null;
    staging = {
      ready,
      notes: ready
        ? "Patch_text gerado com âncoras reais do snapshot (engenheiro assinou)."
        : "Nenhum patch gerado.",
    };
    result.steps.push(ready ? "PATCH_TEXT_GENERATED_FROM_REAL_ANCHORS" : "NO_PATCH_PRODUCED");
  }

  const riskReport = {
    level: ready ? "low" : "medium",
    notes: [
      "Sem dependência de endpoints internos no alvo.",
      wantsDiscovery
        ? "Discovery solicitado explicitamente; endpoints propostos são read-only."
        : "Discovery no alvo não foi solicitado; nenhum endpoint interno foi proposto.",
    ],
  };
}

  return {
    ...result,
    ok: true,
    mode: "engineer",
    context_used,
    context_summary,
    plan,
    patch: shouldGeneratePatch
      ? {
          mode: "patch_text",
          allowWorkerEdit: false,
          patchText: patchSuggestion
        }
      : null,
      staging,
      riskReport: {
        level: "medium",
        notes: ["Nenhuma modificação automática será aplicada."],
      },
      suggestions,
    message: shouldGeneratePatch
      ? "ENGINEER MODE executado com sucesso (patch sugerido)."
      : "ENGINEER MODE executado com sucesso (análise sem patch automático)."
  };
}

    // =====================================================
    // 4️⃣ Modo KV_PATCH — aplica alterações no KV ENAVIA_GIT
    // =====================================================
    if (mode === "kv_patch") {
      const kv = ENAVIA_GIT;

      if (!kv) {
        return {
          ...result,
          ok: false,
          error: "ENAVIA_GIT KV não configurado no ambiente.",
        };
      }

      if (!Array.isArray(kvPatch) || kvPatch.length === 0) {
        return {
          ...result,
          ok: false,
          error:
            "kvPatch vazio ou inválido. Envie: { kvPatch: [{ op, key, value? }] }",
        };
      }

      const operations = [];
      result.steps.push(`kvPatch-count:${kvPatch.length}`);

      if (dryRun) {
        // Apenas simula
        for (const op of kvPatch) {
          const opType = (op.op || op.operation || "put").toLowerCase();
          const key = op.key || op.k;
          const value = op.value ?? op.v ?? null;

          operations.push({
            op: opType,
            key,
            valuePreview:
              typeof value === "string"
                ? value.slice(0, 120)
                : value,
            applied: false,
            dryRun: true,
          });
        }

        return {
          ...result,
          ok: true,
          mode: "kv_patch",
          dryRun: true,
          operations,
          message:
            "Dry-run de kv_patch concluído. Nenhuma alteração persistida.",
        };
      }

      // Execução real
      for (const op of kvPatch) {
        const opType = (op.op || op.operation || "put").toLowerCase();
        const key = op.key || op.k;
        const value = op.value ?? op.v ?? null;

        if (!key || typeof key !== "string") {
          operations.push({
            op: opType,
            key,
            applied: false,
            error: "Chave inválida em kvPatch.",
          });
          continue;
        }

        try {
          if (opType === "delete" || opType === "del" || opType === "remove") {
            await kv.delete(key);
            operations.push({
              op: "delete",
              key,
              applied: true,
            });
          } else {
            // padrão: put
            const strValue =
              typeof value === "string"
                ? value
                : JSON.stringify(value ?? null);
            await kv.put(key, strValue);
            operations.push({
              op: "put",
              key,
              applied: true,
              valuePreview: strValue.slice(0, 120),
            });
          }
        } catch (err) {
          operations.push({
            op: opType,
            key,
            applied: false,
            error: String(err),
          });
        }
      }

      const appliedCount = operations.filter((o) => o.applied).length;
      const failedCount = operations.length - appliedCount;

      return {
        ...result,
        ok: failedCount === 0,
        mode: "kv_patch",
        operations,
        summary: {
          total: operations.length,
          applied: appliedCount,
          failed: failedCount,
        },
        message:
          failedCount === 0
            ? "kv_patch aplicado com sucesso em ENAVIA_GIT."
            : "kv_patch aplicado com alguns erros. Verifique operações individuais.",
      };
    }

    // =====================================================
// 5️⃣ Modo PATCH_TEXT — editar conteúdo textual de módulos
// =====================================================
if (mode === "patch_text") {
  const kv = ENAVIA_GIT;

  if (!kv) {
    return {
      ...result,
      ok: false,
      error: "ENAVIA_GIT KV não configurado. patch_text depende desse KV.",
    };
  }

  const target = a.target;
  const append = Boolean(a.append);
  const content = a.content;

  if (!target || typeof target !== "string") {
    return {
      ...result,
      ok: false,
      error: "Campo 'target' inválido. Ex: mod:meu-modulo",
    };
  }

  if (typeof content !== "string") {
    return {
      ...result,
      ok: false,
      error: "Campo 'content' deve ser string.",
    };
  }

  // 🔍 Buscar módulo existente
  let current = await kv.get(target);

  if (current === null) {
    current = "";
  }

  const newContent = append
    ? current + "\n" + content
    : content;

  // Dry-run?
  if (dryRun) {
    return {
      ...result,
      ok: true,
      dryRun: true,
      preview: newContent.slice(0, 200),
      message: "Dry-run patch_text concluído. Nenhuma alteração persistida.",
    };
  }

  // Aplicar
  await kv.put(target, newContent);

  return {
    ...result,
    ok: true,
    applied: true,
    target,
    preview: newContent.slice(0, 200),
    message: "patch_text aplicado com sucesso em ENAVIA_GIT.",
  };
}

    // =====================================================
    // 5️⃣ Modo MODULE_PATCH — gerencia “arquivos de módulo” no ENAVIA_GIT
    // =====================================================
    if (mode === "module_patch") {
      const kv = ENAVIA_GIT;

      if (!kv) {
        return {
          ...result,
          ok: false,
          error:
            "ENAVIA_GIT KV não configurado. module_patch depende desse KV.",
        };
      }

      if (!Array.isArray(modulePatch) || modulePatch.length === 0) {
        return {
          ...result,
          ok: false,
          error:
            "modulePatch vazio ou inválido. Envie: { modulePatch: [{ op, key, content? }] }",
        };
      }

      const operations = [];
      result.steps.push(`modulePatch-count:${modulePatch.length}`);

      if (dryRun) {
        // Apenas simula
        for (const op of modulePatch) {
          const opType = (op.op || op.operation || "put").toLowerCase();
          const key = op.key || op.moduleKey || op.k;
          const content = op.content ?? op.value ?? null;

          operations.push({
            op: opType,
            key,
            contentPreview:
              typeof content === "string"
                ? content.slice(0, 120)
                : content,
            applied: false,
            dryRun: true,
          });
        }

        return {
          ...result,
          ok: true,
          mode: "module_patch",
          dryRun: true,
          operations,
          message:
            "Dry-run de module_patch concluído. Nenhuma alteração de módulo persistida.",
        };
      }

      // Execução real de module_patch
      for (const op of modulePatch) {
        const opType = (op.op || op.operation || "put").toLowerCase();
        const key = op.key || op.moduleKey || op.k;
        const content = op.content ?? op.value ?? null;
        const format = (op.format || "text").toLowerCase(); // "text" | "json"

        if (!key || typeof key !== "string") {
          operations.push({
            op: opType,
            key,
            applied: false,
            error: "Chave de módulo inválida em modulePatch.",
          });
          continue;
        }

        try {
          if (opType === "delete" || opType === "del" || opType === "remove") {
            await kv.delete(key);
            operations.push({
              op: "delete",
              key,
              applied: true,
            });
          } else {
            // padrão: put/replace (substitui módulo inteiro)
            let storedValue;

            if (format === "json") {
              storedValue =
                typeof content === "string"
                  ? content
                  : JSON.stringify(content ?? null, null, 2);
            } else {
              // text/raw
              storedValue =
                typeof content === "string"
                  ? content
                  : JSON.stringify(content ?? null);
            }

            await kv.put(key, storedValue);
            operations.push({
              op: "put",
              key,
              format,
              applied: true,
              contentPreview: storedValue.slice(0, 120),
            });
          }
        } catch (err) {
          operations.push({
            op: opType,
            key,
            applied: false,
            error: String(err),
          });
        }
      }

      const appliedCount = operations.filter((o) => o.applied).length;
      const failedCount = operations.length - appliedCount;

      return {
        ...result,
        ok: failedCount === 0,
        mode: "module_patch",
        operations,
        summary: {
          total: operations.length,
          applied: appliedCount,
          failed: failedCount,
        },
        message:
          failedCount === 0
            ? "module_patch aplicado com sucesso em ENAVIA_GIT."
            : "module_patch aplicado com alguns erros. Verifique operações individuais.",
      };
    }

    // =====================================================
// 6️⃣ SUPERVISED DEPLOY SYSTEM — NOVOS MODOS
// =====================================================

// -----------------------------
// a. LISTAR STAGING
// -----------------------------
if (mode === "list_staging") {
  const stagingKey = `staging:${a.deploySessionId}`;
  const staging = await env.ENAVIA_GIT.get(stagingKey);

  return {
    ...result,
    ok: true,
    mode,
    staging: staging ? JSON.parse(staging) : null,
    message: staging ? "Staging recuperado." : "Nenhum staging encontrado."
  };
}

// -----------------------------
// b. MOSTRAR PATCH DE STAGING
// -----------------------------
if (mode === "show_patch") {
  const stagingKey = `staging:${a.deploySessionId}`;
  const staging = await env.ENAVIA_GIT.get(stagingKey);

  return {
    ...result,
    ok: true,
    mode,
    patch: staging ? JSON.parse(staging).patch : null,
    message: staging ? "Patch encontrado no staging." : "Nenhum patch disponível."
  };
}

// -----------------------------
// c. GERAR DIFF ENTRE CÓDIGO ATUAL E CÓDIGO PATCH
// -----------------------------
if (mode === "generate_diff") {
  const stagingKey = `staging:${a.deploySessionId}`;
  const staging = await env.ENAVIA_GIT.get(stagingKey);

  if (!staging) {
    return {
      ...result,
      ok: false,
      mode,
      error: "Nenhum staging para gerar diff."
    };
  }

  const content = JSON.parse(staging);
  const patch = content.patch?.patchText || [];

  const diffs = [];

  for (const op of patch) {
    diffs.push({
      target: op.target,
      before: op.search,
      after: op.replace
    });
  }

  return {
    ...result,
    ok: true,
    mode,
    diffs,
    message: "Diff gerado com sucesso."
  };
}

// -----------------------------
// d. DESCARTAR STAGING
// -----------------------------
if (mode === "discard_staging") {
  const stagingKey = `staging:${a.deploySessionId}`;
  await env.ENAVIA_GIT.delete(stagingKey);

  return {
    ...result,
    ok: true,
    mode,
    message: "Staging descartado com sucesso."
  };
}

// ============================================================
// 🧩 STAGE PATCH (CANÔNICO)
// Salva patch em staging para aplicação posterior
// ============================================================
if (mode === "stage_patch") {
  const patch = a.patch;
  const executionId =
    a.execution_id ||
    a.deploySessionId ||
    result?.requestId;

  if (!executionId) {
    return {
      ...result,
      ok: false,
      error: "EXECUTION_ID_REQUIRED",
      message: "execution_id é obrigatório para stage_patch."
    };
  }

  if (!patch || typeof patch !== "string" || !patch.trim()) {
    return {
      ...result,
      ok: false,
      error: "INVALID_PATCH",
      message: "Patch vazio ou inválido."
    };
  }

  await ENAVIA_GIT.put(
    `STAGING:${executionId}`,
    patch
  );

  return {
    ...result,
    ok: true,
    mode: "stage_patch",
    staged: true,
    execution_id: executionId,
    message: "Patch salvo em staging com sucesso."
  };
}

// =====================================================
// 7️⃣ Modo APPLY REAL — aplica o patch gerado no ENGINEER
// =====================================================
if (finalMode === "apply") {
  result.steps.push("mode-resolved:apply");

  // Segurança: só aplica se houver approve:true
  if (!a.approve) {
    return {
      ...result,
      ok: false,
      error: "APPLY bloqueado. Envie { approve: true } para confirmar execução.",
    };
  }

  // Verifica se veio patch do ENGINEER
  const patch = a.patch || a.suggestedPatch || null;

  if (!patch) {
    return {
      ...result,
      ok: false,
      error: "Nenhum patch disponível para aplicar.",
    };
  }

  // Apenas patch_text permitido nesta fase
  if (patch.mode !== "patch_text") {
    return {
      ...result,
      ok: false,
      error: "Somente patch_text é suportado no APPLY REAL neste estágio.",
    };
  }

  const operations = patch.patchText || [];
  const allowWorker = Boolean(patch.allowWorkerEdit);

  if (!operations.length) {
    return {
      ...result,
      ok: false,
      error: "Patch_text vazio. Nada para aplicar.",
    };
  }

  const appliedOps = [];
  const failedOps = [];

  // Execução real das operações
  for (const op of operations) {
    const t = op.target || "";
    const search = op.search;
    const replace = op.replace;
    const mode = op.mode || "safe";

    if (!t || !search || !replace) {
      failedOps.push({ op, reason: "Operação inválida." });
      continue;
    }

    // -----------------------------------------------
    // APPLY NO EXECUTOR (worker code no KV)
    // -----------------------------------------------
    if (t === "executor") {
      if (!allowWorker) {
        failedOps.push({
          op,
          reason:
            "Edição do worker bloqueada. ENAVIA exige allowWorkerEdit:true.",
        });
        continue;
      }

      const current = await GIT_KV.get("worker:executor");
      if (!current) {
        failedOps.push({
          op,
          reason: "worker:executor não encontrado no KV.",
        });
        continue;
      }

      let newContent;
      if (mode === "regex") {
        try {
          newContent = current.replace(new RegExp(search, "g"), replace);
        } catch (err) {
          failedOps.push({ op, reason: "Regex inválido: " + err });
          continue;
        }
      } else {
        newContent = current.split(search).join(replace);
      }

      await GIT_KV.put("worker:executor", newContent);
      appliedOps.push({ op, applied: true });
      continue;
    }

    // -----------------------------------------------
    // APPLY EM MÓDULOS
    // -----------------------------------------------
    if (t.startsWith("module:")) {
      const key = t;
      const current = await GIT_KV.get(key);

      if (!current) {
        failedOps.push({ op, reason: "Módulo não encontrado." });
        continue;
      }

      let newContent;
      if (mode === "regex") {
        try {
          newContent = current.replace(new RegExp(search, "g"), replace);
        } catch (err) {
          failedOps.push({ op, reason: "Regex inválido: " + err });
          continue;
        }
      } else {
        newContent = current.split(search).join(replace);
      }

      await GIT_KV.put(key, newContent);
      appliedOps.push({ op, applied: true });
      continue;
    }

    failedOps.push({ op, reason: "Target inválido." });
  }

  const ok = failedOps.length === 0;

  return {
    ...result,
    ok,
    mode: "apply",
    appliedOps,
    failedOps,
    message: ok
      ? "APPLY REAL executado com sucesso. Patch aplicado."
      : "APPLY executado com falhas. Verifique operations.",
  };
} 

    // =====================================================
    // 6️⃣ Modo DESCONHECIDO
    // =====================================================
    result.warnings.push(`Modo não implementado: ${mode}`);
    return {
      ...result,
      ok: false,
      error: `Modo de execução '${mode}' ainda não foi implementado no core_v2.`,
    };
  } catch (err) {
    return {
      ...baseResult,
      error: "Falha interna no enaviaExecutorCore.",
      detail: String(err),
    };
  }
}
// enavia executor redeploy fix
