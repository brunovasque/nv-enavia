export default {
  async fetch(request, env) {
    try {

    // =========================
    // 🌐 CORS — PREFLIGHT (TEM QUE SER O PRIMEIRO RETURN)
    // =========================
    if (request.method === "OPTIONS") {
      const origin = request.headers.get("Origin") || "https://nv-control.vercel.app";

      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": origin,
          "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Max-Age": "86400",
          "Vary": "Origin",
        },
      });
    }

    const url = new URL(request.url);
    const method = request.method;
    const path = url.pathname;

    // =========================
    // 🌐 CORS — NV-CONTROL (OBRIGATÓRIO)
    // =========================
    const ALLOWED_ORIGINS = new Set([
      "https://nv-control.vercel.app",
      "http://localhost:3000",
      "http://localhost:5173",
    ]);

    const corsHeaders = (request) => {
      const origin = request.headers.get("Origin");
      const allowOrigin =
        origin && ALLOWED_ORIGINS.has(origin)
          ? origin
          : "https://nv-control.vercel.app";

      return {
        "Access-Control-Allow-Origin": allowOrigin,
        "Vary": "Origin",
        "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      };
    };

    const withCors = (request, response) => {
      const headers = new Headers(response.headers);
      const cors = corsHeaders(request);
      for (const [k, v] of Object.entries(cors)) headers.set(k, v);
      return new Response(response.body, {
        status: response.status,
        headers,
      });
    };

    // =========================
    // NORMALIZA ROTA INTERNA
    // =========================
    const internalPath = path.startsWith("/__internal__/")
      ? path.slice("/__internal__".length)
      : path;

    // =========================
    // DEBUG — CONFIRMAR ENV VAR (SAFE)
    // =========================
    if (method === "GET" && path === "/debug-target") {
      let targetUrl = null;
      let tokenStatus = "MISSING";

      try {
        targetUrl =
          typeof env.TARGET_WORKER_URL === "string"
            ? env.TARGET_WORKER_URL
            : null;

        tokenStatus =
          typeof env.INTERNAL_TOKEN === "string"
            ? "SET"
            : "MISSING";
      } catch (_) { }

      return json({
        ok: true,
        TARGET_WORKER_URL: targetUrl,
        INTERNAL_TOKEN: tokenStatus,
      });
    }

    // =========================
    // HEALTH CHECK
    // =========================
    if (method === "GET" && path === "/health") {
      return json({
        ok: true,
        system: "DEPLOY_WORKER",
        version: "v0",
        time: new Date().toISOString(),
      });
    }

    // =========================
    // STATUS — READ ONLY (KV)
    // GET /status/<execution_id>
    // GET /status?execution_id=...
    // =========================
    if (method === "GET" && (path === "/status" || path.startsWith("/status/"))) {
      const executionId =
        path.startsWith("/status/")
          ? decodeURIComponent(path.slice("/status/".length))
          : url.searchParams.get("execution_id");

      if (!executionId) return error(400, "execution_id obrigatório");

      const stagingKey = `STAGING:${executionId}`;
      const statusKey = `PATCH_STATUS:${executionId}`;
      const auditKey = `AUDIT:${executionId}`;
      const suggestionKey = `SUGGESTION:${executionId}`;

      const [stagingRaw, statusRaw, auditRaw, suggestionRaw] = await Promise.all([
        env.DEPLOY_KV.get(stagingKey),
        env.DEPLOY_KV.get(statusKey),
        env.DEPLOY_KV.get(auditKey),
        env.DEPLOY_KV.get(suggestionKey),
      ]);

      const safeParse = (s) => {
        if (!s) return null;
        try { return JSON.parse(s); } catch { return s; }
      };

      const staging = safeParse(stagingRaw);
      const patchStatus = safeParse(statusRaw);
      const audit = safeParse(auditRaw);
      const suggestion = safeParse(suggestionRaw);

      return json({
        ok: true,
        execution_id: executionId,
        exists: {
          staging: Boolean(stagingRaw),
          patch_status: Boolean(statusRaw),
          audit: Boolean(auditRaw),
          suggestion: Boolean(suggestionRaw),
        },
        patch_status: patchStatus || null,
        staging_summary: stagingRaw
          ? {
            has_patch: Boolean(staging?.patch?.content),
            target: staging?.target || null,
            approved_by: staging?.approved_by || null,
            created_at: staging?.created_at || null,
            current_revision: staging?.current_revision || null,
            revisions_count: Array.isArray(staging?.revisions) ? staging.revisions.length : 0,
          }
          : null,
        audit: audit || null,
        suggestion: suggestion || null,
      });
    }

    // =========================
    // PROBE TARGET — SERVICE BINDING
    // =========================
    if (method === "GET" && path === "/probe-target") {
      if (!env.TARGET_WORKER) {
        return error(500, "TARGET_WORKER_BINDING_MISSING");
      }

      if (typeof env.INTERNAL_TOKEN !== "string") {
        return error(500, "INTERNAL_TOKEN_MISSING");
      }

      const headers = {
        "Authorization": `Bearer ${env.INTERNAL_TOKEN}`,
        "Content-Type": "application/json",
      };

      const safeCall = async (request) => {
        try {
          const r = await env.TARGET_WORKER.fetch(request);
          const txt = await r.text().catch(() => "");
          return {
            ok: r.ok,
            http_status: r.status,
            body_preview: txt.slice(0, 300),
          };
        } catch (e) {
          return {
            ok: false,
            http_status: 0,
            error: String(e?.message || e),
          };
        }
      };

      const describe = await safeCall(
        new Request("https://internal/__internal__/describe", {
          method: "GET",
          headers,
        })
      );

      const deployApply = await safeCall(
        new Request("https://internal/__internal__/deploy-apply", {
          method: "POST",
          headers,
          body: JSON.stringify({ probe: true }),
        })
      );

      return json({
        ok: true,
        target: "service-binding:TARGET_WORKER",
        checks: {
          __internal__describe: describe,
          __internal__deploy_apply: deployApply,
        },
      });
    }

    // ============================================================
    //  DEPLOY ACTIVE — Cloudflare deployments por workerId
    //  GET /deploy-active?workerId=nv-enavia&env=test|real
    // ============================================================
    if (method === "GET" && path === "/deploy-active") {
      const workerId =
        url.searchParams.get("workerId") || url.searchParams.get("worker_id");

      const envParamRaw = (url.searchParams.get("env") || "real").toLowerCase();
      const envParam = envParamRaw === "test" ? "test" : "real";

      if (!workerId) {
        return withCors(
          request,
          error(400, "workerId obrigatório", {
            message: "Parâmetro ?workerId é obrigatório",
          })
        );
      }

      const accountId = env.CF_ACCOUNT_ID;
      const apiToken = env.CF_API_TOKEN;

      const diag = url.searchParams.get("diag") === "1";

      const sha256Hex8 = async (s) => {
        if (!s) return null;
        const buf = await crypto.subtle.digest(
          "SHA-256",
          new TextEncoder().encode(String(s))
        );
        return [...new Uint8Array(buf)]
          .map((b) => b.toString(16).padStart(2, "0"))
          .join("")
          .slice(0, 8);
      };

      const diagInfo = diag
        ? {
            account_id_len: accountId ? String(accountId).length : 0,
            token_present: !!apiToken,
            token_len: apiToken ? String(apiToken).length : 0,
            token_fp8: await sha256Hex8(apiToken),
          }
        : null;

        if (!accountId || !apiToken) {
          return withCors(
            request,
            error(500, "CF_API_CONFIG_MISSING", {
              message: "CF_ACCOUNT_ID / CF_API_TOKEN não configurados no Deploy Worker",
            })
          );
        }
  
        // nome base vem do que o painel mandou
        let scriptName = workerId;
  
        // se env=test e tiver mapa de teste, resolve para o worker de teste
        if (envParam === "test" && env.CF_TEST_WORKER_MAP) {
          const pairs = String(env.CF_TEST_WORKER_MAP)
            .split(";")
            .map((s) => s.trim())
            .filter(Boolean);
  
          for (const pair of pairs) {
            const idx = pair.indexOf("=");
            if (idx === -1) continue;
  
            const from = pair.slice(0, idx).trim();
            const to = pair.slice(idx + 1).trim();
  
            if (from && to && from === workerId) {
              scriptName = to;
              break;
            }
          }
        }
  
        const buildDeploymentsUrl = (kind) =>
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/${kind}/${encodeURIComponent(
            scriptName
          )}/deployments`;

      try {
        const kinds = ["scripts"];
        let cfRes = null;
        let cfJson = null;
        let usedKind = null;
        let lastRes = null;
        let lastJson = null;
        let lastKind = null;

        for (const kind of kinds) {
          const apiUrl = buildDeploymentsUrl(kind);

          const res = await fetch(apiUrl, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${apiToken}`,
              "Content-Type": "application/json",
            },
          });

          const jsonData = await res.json().catch(() => null);

          lastRes = res;
          lastJson = jsonData;
          lastKind = kind;

          // se deu erro de rota/identificador (7003 / 404), tenta o próximo tipo
          const errorsArr = jsonData?.errors || [];
          const isRouteError7003 = errorsArr.some((e) => e?.code === 7003);

          if (
            !res.ok ||
            !jsonData ||
            jsonData.success === false
          ) {
            if (res.status === 404 || isRouteError7003) {
              // tenta o próximo kind (services -> scripts)
              continue;
            }

            // erro "real" da CF: já devolve
            return withCors(
              request,
              error(res.status || 500, "CF_DEPLOYMENTS_FETCH_FAILED", {
                workerId: scriptName,
                http_status: res.status || 0,
                success: jsonData?.success ?? null,
                errors: errorsArr,
                cf_kind: kind,
                diag: diagInfo,
              })
            );
          }

          // sucesso: guarda e sai do loop
          cfRes = res;
          cfJson = jsonData;
          usedKind = kind;
          break;
        }

        // se nenhum dos dois (services/scripts) deu certo
        if (!cfRes || !cfJson) {
          return withCors(
            request,
            error(lastRes?.status || 404, "CF_DEPLOYMENTS_FETCH_FAILED", {
              workerId: scriptName,
              http_status: lastRes?.status || 0,
              success: lastJson?.success ?? null,
              errors: lastJson?.errors ?? null,
              cf_kind: lastKind,
              diag: diagInfo,
            })
          );
        }

        const root = cfJson || {};
        const list = Array.isArray(root.result)
          ? root.result
          : Array.isArray(root.result?.deployments)
          ? root.result.deployments
          : Array.isArray(root.deployments)
          ? root.deployments
          : [];

        if (!list.length) {
          return withCors(
            request,
            error(404, "CF_DEPLOYMENTS_NOT_FOUND", { workerId: scriptName })
          );
        }

        const active = list[0];
        const deployedAt =
          active.deployed_on ||
          active.deployedAt ||
          active.created_on ||
          active.createdAt ||
          active.timestamp ||
          null;

        // Tenta extrair a tag de versão do script (ex.: vfe67dd78)
        let scriptVersionTag = null;

        // 1) Se a própria resposta de deployments trouxer versões, usa a primeira
        if (Array.isArray(active.versions) && active.versions.length) {
          const v0 = active.versions[0];
          scriptVersionTag = v0.id || v0.tag || null;
        }

        // 2) Se ainda não tiver versão, consulta /workers/scripts/{scriptName}/versions
        //    e tenta casar pelo "number" do deployment (funciona até em rollback)
        if (!scriptVersionTag) {
          try {
            const versionsUrl =
              `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/` +
              `${encodeURIComponent(scriptName)}/versions?per_page=25`;

            const vRes = await fetch(versionsUrl, {
              method: "GET",
              headers: {
                Authorization: `Bearer ${apiToken}`,
                "Content-Type": "application/json",
              },
            });

            if (vRes.ok) {
              const vJson = await vRes.json().catch(() => null);

              const items = Array.isArray(vJson?.result?.items)
                ? vJson.result.items
                : Array.isArray(vJson?.result)
                ? vJson.result
                : [];

              if (items.length) {
                const targetNumber = active.number ?? null;

                const hit =
                  targetNumber != null
                    ? items.find((it) => it && it.number === targetNumber) || items[0]
                    : items[0];

                const vid = hit?.id ? String(hit.id) : "";
                const short = (vid.split("-")[0] || "").trim();

                if (short) scriptVersionTag = `v${short}`; // ex.: v194a5dc1
              }
            }
          } catch (e) {
            // Falha em /versions não quebra o fluxo principal
          }
        }

        return withCors(
          request,
          json({
            ok: true,
            target: scriptName,
            env: envParam,
            deployment: {
              id: active.id || null,
              version: active.version || null,
              number: active.number || null,
              deployed_at: deployedAt,
              script_version: scriptVersionTag,
              // 🔹 Campos ricos repassados da Cloudflare (se existirem)
              source: active.source || null,
              author_email: active.author_email || null,
              triggered_by: active.triggered_by || null,
              message: active.message || null,
              annotations: active.annotations || null,
            },
          })
        );
      } catch (e) {
        return withCors(
          request,
          error(500, "CF_DEPLOYMENTS_EXCEPTION", {
            workerId: scriptName,
            message: String(e?.message || e),
          })
        );
      }
    }

    // ============================================================
  //  DEPLOY HISTORY — Histórico de deployments por workerId
  //  GET /deploy-history?workerId=nv-enavia&env=test|real
  // ============================================================
  if (method === "GET" && path === "/deploy-history") {
    const workerId =
      url.searchParams.get("workerId") || url.searchParams.get("worker_id");

    const envParamRaw = (url.searchParams.get("env") || "real").toLowerCase();
    const envParam = envParamRaw === "test" ? "test" : "real";

    if (!workerId) {
      return withCors(
        request,
        error(400, "workerId obrigatório", {
          message: "Parâmetro ?workerId é obrigatório",
        })
      );
    }

    const accountId = env.CF_ACCOUNT_ID;
    const apiToken = env.CF_API_TOKEN;

    if (!accountId || !apiToken) {
      return withCors(
        request,
        error(500, "CF_API_CONFIG_MISSING", {
          message:
            "CF_ACCOUNT_ID / CF_API_TOKEN não configurados no Deploy Worker",
        })
      );
    }

    let scriptName = workerId;

    // mesmo mapeamento de alias do /deploy-active
    const aliasRaw = env.WORKER_ALIAS_TARGETS || "";
    if (aliasRaw && typeof aliasRaw === "string") {
      const pairs = aliasRaw.split(",");
      for (const p of pairs) {
        const pair = p.trim();
        if (!pair) continue;
        const idx = pair.indexOf("=");
        if (idx === -1) continue;

        const from = pair.slice(0, idx).trim();
        const to = pair.slice(idx + 1).trim();

        if (from && to && from === workerId) {
          scriptName = to;
          break;
        }
      }
    }

    const deploymentsUrl =
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/` +
      `${encodeURIComponent(scriptName)}/deployments?per_page=10`;

    try {
      const res = await fetch(deploymentsUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const jsonData = await res.json().catch(() => null);

      if (!res.ok || !jsonData || jsonData.success === false) {
        return withCors(
          request,
          error(res.status || 500, "CF_DEPLOYMENTS_FETCH_FAILED", {
            workerId: scriptName,
            http_status: res.status || 0,
            success: jsonData?.success ?? null,
            errors: jsonData?.errors ?? null,
            cf_kind: "scripts",
          })
        );
      }

      const root = jsonData || {};
      const list = Array.isArray(root.result)
        ? root.result
        : Array.isArray(root.result?.deployments)
        ? root.result.deployments
        : Array.isArray(root.deployments)
        ? root.deployments
        : [];

      if (!list.length) {
        return withCors(
          request,
          error(404, "CF_DEPLOYMENTS_NOT_FOUND", { workerId: scriptName })
        );
      }

      const historyList = list.slice(0, 10);

      // Mapa número -> tag da versão (vxxxxxxx), opcional via /versions
      let versionMap = null;

      try {
        const versionsUrl =
          `https://api.cloudflare.com/client/v4/accounts/${accountId}/workers/scripts/` +
          `${encodeURIComponent(scriptName)}/versions?per_page=25`;

        const vRes = await fetch(versionsUrl, {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        });

        if (vRes.ok) {
          const vJson = await vRes.json().catch(() => null);

          const items = Array.isArray(vJson?.result?.items)
            ? vJson.result.items
            : Array.isArray(vJson?.result)
            ? vJson.result
            : [];

          if (items.length) {
            versionMap = new Map();
            for (const it of items) {
              if (!it) continue;
              const num = it.number ?? null;
              const vid = it.id ? String(it.id) : "";
              const short = (vid.split("-")[0] || "").trim();
              if (num != null && short) {
                versionMap.set(num, `v${short}`);
              }
            }
          }
        }
      } catch (e) {
        // falha em /versions não bloqueia o histórico
      }

      const history = historyList
        .map((d) => {
          if (!d) return null;

          const deployedAt =
            d.deployed_on ||
            d.deployedAt ||
            d.created_on ||
            d.createdAt ||
            d.timestamp ||
            null;

          const number = d.number ?? d.version ?? null;
          let scriptVersion = null;

          if (versionMap && number != null && versionMap.has(number)) {
            scriptVersion = versionMap.get(number);
          }

          return {
            id: d.id || null,
            number,
            deployed_at: deployedAt,
            script_version: scriptVersion,
            source: d.source || null,
            author_email: d.author_email || null,
            triggered_by: d.triggered_by || null,
            message: d.message || null,
            annotations: d.annotations || null,
          };
        })
        .filter(Boolean);

      return withCors(
        request,
        json({
          ok: true,
          target: scriptName,
          env: envParam,
          history,
        })
      );
    } catch (e) {
      return withCors(
        request,
        error(500, "CF_DEPLOYMENTS_EXCEPTION", {
          workerId: scriptName,
          message: String(e?.message || e),
        })
      );
    }
  }

  // ============================================================
    //  DEPLOY HEALTH — resumo leve da saúde do worker alvo
    //  GET /deploy-health?workerId=nv-enavia&env=test|real&window=5m
    //
    //  ⚠️ IMPORTANTE:
    //  - Esta rota é só para o Card 3 da aba Deploy (visão rápida).
    //  - A telemetria pesada vai ter rota própria em outra aba.
    // ============================================================
    if (method === "GET" && path === "/deploy-health") {
      const workerId =
        url.searchParams.get("workerId") || url.searchParams.get("worker_id");

      const envParamRaw = (url.searchParams.get("env") || "real").toLowerCase();
      const envParam = envParamRaw === "test" ? "test" : "real";

      if (!workerId) {
        return withCors(
          request,
          error(400, "workerId obrigatório", {
            message: "Parâmetro ?workerId é obrigatório",
          })
        );
      }

      // janela de tempo "leve" para o card (sem métrica real ainda)
      const rawWindow = (url.searchParams.get("window") || "5m").toLowerCase();
      const allowedWindows = new Set(["5m", "15m", "1h"]);
      const windowParam = allowedWindows.has(rawWindow) ? rawWindow : "5m";

      // mesmo mapeamento de alias do /deploy-active
      let scriptName = workerId;

      if (envParam === "test" && env.CF_TEST_WORKER_MAP) {
        const pairs = String(env.CF_TEST_WORKER_MAP)
          .split(";")
          .map((s) => s.trim())
          .filter(Boolean);

        for (const pair of pairs) {
          const idx = pair.indexOf("=");
          if (idx === -1) continue;

          const from = pair.slice(0, idx).trim();
          const to = pair.slice(idx + 1).trim();

          if (from && to && from === workerId) {
            scriptName = to;
            break;
          }
        }
      }

      // ⚠️ Nesta fase NÃO buscamos métrica real na Cloudflare:
      //     - não inventamos números
      //     - preparamos só o formato para o Card 3
      return withCors(
        request,
        json({
          ok: true,
          target: scriptName,
          env: envParam,
          window: windowParam,
          // formato pensado para o Card 3
          has_data: false,
          requests: null,
          error_rate: null,
          p95_ms: null,
          last_error_ts: null,
          last_error_message: null,
          note: "telemetria_resumida_off", // evita confusão com a aba de telemetria pesada
        })
      );
    }

    // ============================================================
    // 🔒 HELPERS INTERNOS — GATES / KV / TARGET CALL
    // ============================================================
    const now = () => Date.now();

    const statusKeyOf = (id) => `PATCH_STATUS:${id}`;
    const stagingKeyOf = (id) => `STAGING:${id}`;
    const auditKeyOf = (id) => `AUDIT:${id}`;
    const suggestionKeyOf = (id) => `SUGGESTION:${id}`;

    const safeJson = async (req) => {
      try { return await req.json(); } catch { return null; }
    };

    const getKVJson = async (key) => {
      if (!env?.DEPLOY_KV) throw new Error("DEPLOY_KV_BINDING_MISSING");
      const raw = await env.DEPLOY_KV.get(key);
      if (!raw) return null;
      try { return JSON.parse(raw); } catch { return raw; }
    };

  const putKVJson = async (key, obj) => {
  if (!env?.DEPLOY_KV) throw new Error("DEPLOY_KV_BINDING_MISSING");
  const payload = JSON.stringify(obj);

  // fonte primária (Deploy Worker)
  await env.DEPLOY_KV.put(key, payload);

  // espelho canônico (para o loop do Executor / ENAVIA)
  // se ENAVIA_GIT existir, mantém os estados sincronizados
  try {
    if (env.ENAVIA_GIT && typeof env.ENAVIA_GIT.put === "function") {
      await env.ENAVIA_GIT.put(key, payload);
    }
  } catch (_err) {
    // não quebra fluxo por falha de KV espelho
  }
};
  
    const setStatus = async (execution_id, patchStatus) => {
      await putKVJson(statusKeyOf(execution_id), patchStatus);
    };
  
    const getStatus = async (execution_id) => {
      return await getKVJson(statusKeyOf(execution_id));
    };
  
    // Novo: ler FLOW_STATE:<execution_id> na ENAVIA_GIT (fallback DEPLOY_KV)
    const getFlowState = async (execution_id) => {
      if (!execution_id) return null;
  
      const store = env.ENAVIA_GIT || env.DEPLOY_KV;
      if (!store) return null;
  
      try {
        const raw = await store.get(`FLOW_STATE:${execution_id}`);
        if (!raw) return null;
  
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_err) {
        // Falha de KV não pode quebrar o fluxo
        return null;
      }
    };
  
    const requireTarget = () => {
      if (!env.TARGET_WORKER) return { ok: false, error: "TARGET_WORKER_BINDING_MISSING" };
      if (typeof env.INTERNAL_TOKEN !== "string") return { ok: false, error: "INTERNAL_TOKEN_MISSING" };
      return { ok: true };
    };

    const callTargetInternal = async (internalPath, payload) => {
      const reqOk = requireTarget();
      if (!reqOk.ok) {
        return { ok: false, http_status: 0, error: reqOk.error };
      }

      const headers = {
        "Authorization": `Bearer ${env.INTERNAL_TOKEN}`,
        "Content-Type": "application/json",
      };

      try {
        const r = await env.TARGET_WORKER.fetch(
          new Request(`https://internal${internalPath}`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload || {}),
          })
        );
        const txt = await r.text().catch(() => "");
        return { ok: r.ok, http_status: r.status, body: txt.slice(0, 2000) };
      } catch (e) {
        return { ok: false, http_status: 0, error: String(e?.message || e) };
      }
    };

    // ============================================================
    // 🚀 ROTAS CANÔNICAS — CASCA OPERACIONAL MÍNIMA (PR2)
    // Estas rotas usam `path` (não internalPath) para interceptar
    // chamadas diretas ao deploy-worker. Rotas /__internal__/ do
    // executor continuam caindo nas implementações existentes.
    // ============================================================
    const CANONICAL_ROUTES = new Set([]);

    if (method === "POST" && CANONICAL_ROUTES.has(path)) {
      const action = path.slice(1); // remove leading /
      const body = await safeJson(request);

      if (body === null) {
        return withCors(
          request,
          json(
            {
              system: "DEPLOY_WORKER",
              action,
              ok: false,
              status: "invalid_payload",
              mode: "canonical",
              stub: false,
              message: "Payload JSON inválido ou ausente.",
              received: null,
              timestamp: new Date().toISOString(),
              boundary: "deploy-worker",
              contract_version: "v0.2",
            },
            400
          )
        );
      }

      // Campos esperados por rota
      const EXPECTED_FIELDS = {
        deploy: ["target"],
        rollback: ["execution_id"],
        "worker-deploy": ["target"],
        "apply-test": ["execution_id"],
        approve: ["execution_id", "approved_by"],
      };

      const expected = EXPECTED_FIELDS[action] || [];
      const missing = expected.filter((f) => !body[f]);

      if (missing.length > 0) {
        return withCors(
          request,
          json(
            {
              system: "DEPLOY_WORKER",
              action,
              ok: false,
              status: "missing_fields",
              mode: "canonical",
              stub: false,
              message: `Campos obrigatórios ausentes: ${missing.join(", ")}`,
              missing_fields: missing,
              received: {
                execution_id: body.execution_id || null,
                target: body.target || null,
              },
              timestamp: new Date().toISOString(),
              boundary: "deploy-worker",
              contract_version: "v0.2",
            },
            422
          )
        );
      }

      // Resumo do payload recebido (sem expor dados sensíveis)
      const receivedSummary = {
        execution_id: body.execution_id || null,
        target: body.target || null,
        has_patch: Boolean(body.patch),
        approved_by: body.approved_by || null,
        env: body.env || null,
      };

      return withCors(
        request,
        json({
          system: "DEPLOY_WORKER",
          action,
          ok: true,
          status: "accepted_stub",
          mode: "canonical",
          stub: true,
          message: `Rota /${action} registrada com sucesso. Ação real ainda não implementada nesta fase — casca operacional ativa.`,
          received: receivedSummary,
          timestamp: new Date().toISOString(),
          boundary: "deploy-worker",
          contract_version: "v0.2",
        })
      );
    }

    // ============================================================
    // 🧪 PRE-CHECKS (GATE TÉCNICO) — DEPLOY TESTE
    // ============================================================
    function basicBracketCheck(text) {
      const stack = [];
      const pairs = { ")": "(", "]": "[", "}": "{" };
      const opens = new Set(["(", "[", "{"]);
      const closes = new Set([")", "]", "}"]);
      let inStr = null;
      let esc = false;

      for (let i = 0; i < text.length; i++) {
        const ch = text[i];

        if (inStr) {
          if (esc) { esc = false; continue; }
          if (ch === "\\") { esc = true; continue; }
          if (ch === inStr) { inStr = null; continue; }
          continue;
        }

        if (ch === '"' || ch === "'" || ch === "`") {
          inStr = ch;
          continue;
        }

        if (opens.has(ch)) stack.push(ch);
        else if (closes.has(ch)) {
          const need = pairs[ch];
          const got = stack.pop();
          if (got !== need) {
            return { ok: false, reason: `BRACKET_MISMATCH at ${i}: expected ${need} got ${got || "EMPTY"}` };
          }
        }
      }

      if (inStr) return { ok: false, reason: "UNTERMINATED_STRING" };
      if (stack.length) return { ok: false, reason: `UNCLOSED_BRACKETS: ${stack.join("")}` };
      return { ok: true };
    }

    function containsExportDefault(text) {
      // gate simples para evitar patch tentando redefinir módulo inteiro
      return /export\s+default\s*\{/.test(text) || /export\s+default\s+async\s+function/.test(text);
    }

    function triesProd(text) {
      // heurística conservadora: qualquer menção explícita a prod/promote/production
      return /\bprod\b|\bproduction\b|\bpromote\b/i.test(text);
    }

    // =========================
    // 1) AUDIT — STORE RESULT (READ ONLY)
    // =========================
    if (method === "POST" && internalPath === "/audit") {
      const body = await safeJson(request);
      if (!body) return error(400, "INVALID_JSON");

      const { execution_id, audit } = body || {};
      if (!execution_id) return error(400, "execution_id obrigatório");
      if (!audit) return error(400, "audit obrigatório");

      await putKVJson(auditKeyOf(execution_id), {
        execution_id,
        audit,
        stored_at: now(),
      });

      return json({
        ok: true,
        execution_id,
        message: "AUDIT armazenado (read-only).",
      });
    }

    // =========================
    // 2) PROPOSE — STORE SUGGESTION (READ ONLY)
    // =========================
    if (
      method === "POST" &&
      (internalPath === "/propose" ||
        internalPath === "/suggest" ||
        internalPath === "/suggestion")
    ) {
      const body = await safeJson(request);
      if (!body) return error(400, "INVALID_JSON");

      const { execution_id, suggestion } = body || {};
      if (!execution_id) return error(400, "execution_id obrigatório");
      if (!suggestion) return error(400, "suggestion obrigatório");

      // 🔒 GATE: PROPOSE só é permitido se já existir AUDIT ok=true
const auditRecord = await getKVJson(auditKeyOf(execution_id));
if (!auditRecord || auditRecord.audit?.ok !== true) {
  return error(403, "AUDIT_REQUIRED", {
    execution_id,
    message: "propose bloqueado: rode AUDIT e obtenha ok=true antes de solicitar sugestões",
  });
}

      await putKVJson(suggestionKeyOf(execution_id), {
        execution_id,
        suggestion,
        stored_at: now(),
      });

      return json({
        ok: true,
        execution_id,
        message: "PROPOSE armazenado (read-only).",
      });
    }

    // =========================
    // 3) APPLY TEST — STAGING ONLY (NO EXECUTION)
    // v1.1: grava STAGING + PATCH_STATUS=staged
    // =========================
    if (method === "POST" && (internalPath === "/apply-test" || path === "/deploy" || path === "/worker-deploy")) {
      const body = await safeJson(request);
      if (!body) return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id, target, patch, staged_by, candidate_hash } = body || {};

// 🔒 GATE OBRIGATÓRIO — AUDIT / FLOW_STATE

const auditKey = auditKeyOf(execution_id);
let auditRecord = await getKVJson(auditKey);

// lê o FLOW_STATE canônico da ENAVIA uma vez só
let flowState = null;
try {
  flowState = await getFlowState(execution_id);
} catch (eFs) {
  console.error("apply-test:getFlowState_error", { execution_id, error: String(eFs) });
}

// se NÃO existe AUDIT no KV, mas existe FLOW_STATE com audit.ok === true,
// usa como prova e grava AUDIT:<id> no KV
if (!auditRecord && flowState && flowState.audit && flowState.audit.ok === true) {
  auditRecord = {
    audit: flowState.audit,
    from: "flow_state",
  };

  try {
    await putKVJson(auditKey, auditRecord);
  } catch (eKV) {
    console.error("apply-test:auditKV_write_error", { execution_id, error: String(eKV) });
  }
}

// se depois de tudo isso ainda NÃO tem auditoria ok, bloqueia
if (!auditRecord || !auditRecord.audit || auditRecord.audit.ok !== true) {
  return withCors(
    request,
    json(
      {
        ok: false,
        error: "AUDIT_REQUIRED",
        message: "apply-test bloqueado: auditoria inexistente ou não aprovada",
        execution_id,
        has_flow_state: !!flowState,
      },
      403
    )
  );
}

// 🔒 GATE OPCIONAL — risco alto bloqueia
if (flowState) {
  const riskReport = flowState.risk || {};
  const riskLevel =
    riskReport.risk_level ||
    riskReport.level ||
    riskReport.severity ||
    "low";

  if (String(riskLevel).toLowerCase() === "high") {
    console.error("apply-test:risk_blocked", { execution_id, risk: riskReport });

    return withCors(
      request,
      json(
        {
          ok: false,
          error: "HIGH_RISK_BLOCKED",
          message: "apply-test bloqueado por risco alto na auditoria",
          execution_id,
          risk: riskReport,
        },
        403
      )
    );
  }
}

      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      if (!target?.workerId)
        return withCors(request, error(400, "target.workerId obrigatório"));

      if (!patch?.content)
        return withCors(request, error(400, "patch.content obrigatório"));

      const stagingKey = stagingKeyOf(execution_id);

      // Fonte da verdade (STAGING)
      await putKVJson(stagingKey, {
        execution_id,
        staged_by: staged_by || null,
        target,
        patch: {
          ...patch,
          content: String(patch.content),
        },
        // hash do candidato para o gate do promote-real
        candidate_hash: candidate_hash || null,
        created_at: now(),
        current_revision: 1,
        revisions: [{ rev: 1, note: "original", at: now() }],
      });

      // Status correto (v1.1)
      await setStatus(execution_id, {
        status: "staged",
        env: "staging",
        timestamp: now(),
        candidate_hash: candidate_hash || null,
      });

      return withCors(
        request,
        json({
          ok: true,
          execution_id,
          status: "staged",
          message: "Patch armazenado em STAGING (nenhuma execução realizada).",
        })
      );
    }

    // =========================
    // DEPLOY TEST — EXECUÇÃO REAL EM TEST
    // POST /deploy-test
    // =========================
    if (method === "POST" && internalPath === "/deploy-test") {
      let body;
      try {
        body = await request.json();
      } catch {
        return withCors(request, error(400, "INVALID_JSON"));
      }

      const { execution_id } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      const stagingKey = `STAGING:${execution_id}`;
      const statusKey = `PATCH_STATUS:${execution_id}`;

      const stagingRaw = await env.DEPLOY_KV.get(stagingKey);
      if (!stagingRaw)
        return withCors(request, error(404, "STAGING_NOT_FOUND"));

      const staging = JSON.parse(stagingRaw);

      // 🔒 PRÉ-CHECKS CANÔNICOS (CONTRATO v1.1)
      const patchText = staging?.patch?.content || "";
      if (!patchText)
        return withCors(request, error(400, "PATCH_EMPTY"));

      // checks básicos de sintaxe (heurístico)
      const opens = (s, c) =>
        (s.match(new RegExp(`\\${c}`, "g")) || []).length;

      if (opens(patchText, "{") !== opens(patchText, "}")) {
        await setStatus(execution_id, { status: "test_failed", reason: "syntax_braces" });          
        return withCors(request, error(422, "SYNTAX_ERROR_BRACES"));
      }

      // 🚫 Nunca permitir PROD aqui
      if (/prod(uction)?/i.test(patchText)) {
        await setStatus(execution_id, { status: "test_failed", reason: "prod_detected" });
        return withCors(request, error(403, "PROD_REFERENCE_DETECTED"));
      }

      // =========================
      // EXECUÇÃO REAL EM TEST
      // =========================
      try {
        const headers = {
          "Authorization": `Bearer ${env.INTERNAL_TOKEN}`,
          "Content-Type": "application/json",
        };

        const res = await env.TARGET_WORKER.fetch(
          new Request("https://internal/__internal__/deploy-apply", {
            method: "POST",
            headers,
            body: JSON.stringify({
              execution_id,
              patch: staging.patch,
              mode: "test",
            }),
          })
        );

        if (!res.ok) throw new Error("TARGET_EXECUTION_FAILED");

await setStatus(execution_id, {
  status: "tested",
  env: "test",
  timestamp: Date.now(),
});

        return withCors(
          request,
          json({
            ok: true,
            execution_id,
            status: "tested",
            message: "Deploy executado com sucesso em TEST.",
          })
        );

      } catch (err) {
        // 🔁 ROLLBACK AUTOMÁTICO EM TEST
  await setStatus(execution_id, {
    status: "test_failed",
    error: String(err),
    timestamp: Date.now(),
  });

        return withCors(
          request,
          error(500, "DEPLOY_TEST_FAILED", { detail: String(err) })
        );
      }
    }

    // =========================
    // 5) FIX LOOP SEGURO — SOMENTE PATCH EM STAGING
    // - só após test_failed
    // - não executa nada
    // - atualiza revision e status=fix_ready
    // =========================
    if (method === "POST" && internalPath === "/fix-loop") {
      const body = await safeJson(request);
      if (!body)
        return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id, fixed_patch_content, note } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      if (!fixed_patch_content)
        return withCors(
          request,
          error(400, "fixed_patch_content obrigatório")
        );

      const st = await getStatus(execution_id);
      const currentStatus = String(st?.status || "");
      if (currentStatus !== "test_failed") {
        return withCors(
          request,
          error(409, "INVALID_STATUS_FOR_FIX_LOOP", {
            expected: ["test_failed"],
            got: currentStatus || null,
          })
        );
      }

      const stagingKey = stagingKeyOf(execution_id);
      const staging = await getKVJson(stagingKey);
      if (!staging?.patch?.content)
        return withCors(
          request,
          error(404, "STAGING_NOT_FOUND_OR_EMPTY")
        );

      const nextRev = Number(staging.current_revision || 1) + 1;

      staging.patch.content = String(fixed_patch_content);
      staging.current_revision = nextRev;
      staging.revisions = Array.isArray(staging.revisions)
        ? staging.revisions
        : [];
      staging.revisions.push({
        rev: nextRev,
        note: note || "fix",
        at: now(),
      });

      await putKVJson(stagingKey, staging);

      await setStatus(execution_id, {
        status: "fix_ready",
        env: "staging",
        timestamp: now(),
        current_revision: nextRev,
      });

      return withCors(
        request,
        json({
          ok: true,
          execution_id,
          status: "fix_ready",
          current_revision: nextRev,
          message:
            "Patch corrigido em STAGING. Necessário novo clique humano em DEPLOY TESTE.",
        })
      );
    }

    // =========================
    // 6) APPROVE — HUMANO (PRÉ-PROMOTE)
    // - só se status=tested
    // - não executa nada
    // =========================
    if (method === "POST" && internalPath === "/approve") {
      const body = await safeJson(request);
      if (!body)
        return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id, approved_by } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      if (!approved_by)
        return withCors(request, error(400, "approved_by obrigatório"));

      const st = await getStatus(execution_id);
      const currentStatus = String(st?.status || "");
      if (currentStatus !== "tested") {
        return withCors(
          request,
          error(409, "INVALID_STATUS_FOR_APPROVE", {
            expected: ["tested"],
            got: currentStatus || null,
          })
        );
      }

      await setStatus(execution_id, {
        status: "approved",
        env: "test",
        approved: true,
        approved_by,
        timestamp: now(),
      });

      // também grava no STAGING (para rastreio)
      const stagingKey = stagingKeyOf(execution_id);
      const staging = await getKVJson(stagingKey);
      if (staging && typeof staging === "object") {
        staging.approved_by = approved_by;
        staging.approved_at = now();
        await putKVJson(stagingKey, staging);
      }

      return withCors(
        request,
        json({
          ok: true,
          execution_id,
          status: "approved",
          message:
            "Aprovado pelo humano (pré-promote). Nenhuma execução realizada.",
        })
      );
    }

    // =========================
    // 7) PROMOTE REAL — EXECUÇÃO FINAL (PROD)
    // POST /promote  |  POST /__internal__/promote-real
    // - só se status=approved
    // - se falhar: rollback automático (PROD)
    // - status: applied | prod_failed
    // =========================
    if (method === "POST" && (internalPath === "/promote-real" || path === "/promote")) {
      const body = await safeJson(request);
      if (!body)
        return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      const st = await getStatus(execution_id);
      const currentStatus = String(st?.status || "");
      if (currentStatus !== "approved") {
        return withCors(
          request,
          error(409, "INVALID_STATUS_FOR_PROMOTE", {
            expected: ["approved"],
            got: currentStatus || null,
          })
        );
      }

      const staging = await getKVJson(stagingKeyOf(execution_id));
      if (!staging?.patch?.content)
        return withCors(
          request,
          error(404, "STAGING_NOT_FOUND_OR_EMPTY")
        );

      // 🔎 GATE CANÔNICO — carimbo da ENAVIA (FLOW_STATE/EXECUTION)
      const flowState = await getFlowState(execution_id);
      if (flowState) {
        // risco: qualquer coisa diferente de "low" bloqueia PROD
        const riskObj =
          flowState.pipeline?.risk ||
          flowState.risk ||
          null;

        const rawRiskLevel =
          (riskObj &&
            (riskObj.risk_level || riskObj.level || riskObj.risk)) ||
          flowState.risk_level ||
          null;

        const riskLevel = String(rawRiskLevel || "").toLowerCase();
        if (riskLevel && riskLevel !== "low") {
          return withCors(
            request,
            error(403, "RISK_TOO_HIGH_FOR_PROD", {
              execution_id,
              risk_level: rawRiskLevel,
              message:
                "promote-real bloqueado: risk_level no Executor não permite aplicar em produção.",
            })
          );
        }

        // staging: se o fluxo disser explicitamente que NÃO está pronto, bloqueia
        const stagingInfo =
          flowState.pipeline?.staging || flowState.staging || null;

        // GATE OPCIONAL: só bloqueia se REQUIRE_FLOW_STAGING_READY="1"
        const requireFlowReady =
          String(env.REQUIRE_FLOW_STAGING_READY || "").trim() === "1";

        if (requireFlowReady && stagingInfo && stagingInfo.ready === false) {
          return withCors(
            request,
            error(403, "STAGING_NOT_READY_FOR_PROD", {
              execution_id,
              message:
                "promote-real bloqueado: fluxo ainda não marcou staging como pronto para produção.",
            })
          );
        }

        // workerId: se o alvo do fluxo não bater com o alvo em STAGING, bloqueia
        const flowWorkerId =
          flowState.workerId || flowState.target?.workerId || null;

        if (
          flowWorkerId &&
          staging.target?.workerId &&
          flowWorkerId !== staging.target.workerId
        ) {
          return withCors(
            request,
            error(403, "TARGET_MISMATCH_FOR_PROD", {
              execution_id,
              expected: flowWorkerId,
              got: staging.target.workerId,
              message:
                "promote-real bloqueado: workerId do fluxo não bate com o alvo em STAGING.",
            })
          );
        }

        // candidate_hash: se o fluxo tiver hash e não bater com o staged, bloqueia
        const flowCandidateHash =
          (stagingInfo &&
            (stagingInfo.candidate_hash || stagingInfo.candidateHash)) ||
          (flowState.proof &&
            (flowState.proof.candidate_hash ||
              flowState.proof.candidateHash)) ||
          null;

        const stagedCandidate = staging.candidate_hash || null;

        if (
          flowCandidateHash &&
          stagedCandidate &&
          flowCandidateHash !== stagedCandidate
        ) {
          return withCors(
            request,
            error(403, "CANDIDATE_HASH_MISMATCH", {
              execution_id,
              expected: flowCandidateHash,
              got: stagedCandidate,
              message:
                "promote-real bloqueado: candidate_hash do fluxo não bate com o patch em STAGING.",
            })
          );
        }
      }

      // 🔒 GATE OPCIONAL — PROVA DE BROWSER
      // Ativa se REQUIRE_BROWSER_PROOF="1"
      const candidateHash = staging.candidate_hash || null;
      const requireProof =
        String(env.REQUIRE_BROWSER_PROOF || "").trim() === "1";

      if (requireProof) {
        if (!candidateHash) {
          return withCors(
            request,
            error(403, "BROWSER_PROOF_REQUIRED", {
              execution_id,
              message:
                "promote-real bloqueado: candidate_hash ausente; rode o browser-proof ou desative REQUIRE_BROWSER_PROOF.",
            })
          );
        }

        const proofKey = `DEPLOY_OK:${candidateHash}`;

        // tenta achar o KV de prova na ordem:
        // 1) ENAVIA_GIT (mesma KV do executor)
        // 2) PROOF_KV (alias dedicado)
        // 3) DEPLOY_KV (fallback)
        const proofStore =
          env.ENAVIA_GIT || env.PROOF_KV || env.DEPLOY_KV;

        if (!proofStore) {
          return withCors(
            request,
            error(500, "PROOF_STORE_MISSING", {
              execution_id,
              proof_key: proofKey,
              message:
                "REQUIRE_BROWSER_PROOF=1, mas nenhum KV de prova está configurado (ENAVIA_GIT/PROOF_KV/DEPLOY_KV).",
            })
          );
        }

        const proofRaw = await proofStore.get(proofKey);
        if (!proofRaw) {
          return withCors(
            request,
            error(403, "BROWSER_PROOF_REQUIRED", {
              execution_id,
              candidate_hash: candidateHash,
              proof_key: proofKey,
              message:
                "promote-real bloqueado: prova de browser não encontrada (rode o browser-proof antes).",
            })
          );
        }

        // Usa o carimbo da ENAVIA pra saber se a prova foi OK ou FAIL
        const proofMeta =
          flowState?.proof || flowState?.pipeline?.proof || null;

        // fallback: se o payload da prova tiver um campo ok, também respeita
        let proofPayload = null;
        try {
          proofPayload = JSON.parse(proofRaw);
        } catch (_) {
          // se não der pra ler, ignora e confia só no proofMeta
        }

        const metaOk =
          typeof proofMeta?.ok === "boolean" ? proofMeta.ok : null;
        const payloadOk =
          typeof proofPayload?.ok === "boolean" ? proofPayload.ok : null;

        const finalOk =
          metaOk !== null
            ? metaOk
            : payloadOk !== null
            ? payloadOk
            : true; // se não tiver info, assume OK pra não travar legado

        if (!finalOk) {
          return withCors(
            request,
            error(403, "BROWSER_PROOF_FAILED", {
              execution_id,
              candidate_hash: candidateHash,
              proof_key: proofKey,
              message:
                "promote-real bloqueado: última prova do browser foi marcada como falha.",
            })
          );
        }
      }

      const apply = await callTargetInternal("/__internal__/deploy-apply", {
        execution_id,
        env: "prod",
        target: staging.target || null,
        patch: staging.patch || null,
        rollback_on_fail: true,
        source: "DEPLOY_WORKER",
      });

      if (apply.ok) {
        await setStatus(execution_id, {
          status: "applied",
          env: "prod",
          timestamp: now(),
        });

        return withCors(
          request,
          json({
            ok: true,
            execution_id,
            status: "applied",
            message: "PROMOTE REAL aplicado com sucesso (PROD).",
            target_apply: apply,
          })
        );
      }

      const rollback = await callTargetInternal("/__internal__/deploy-rollback", {
        execution_id,
        env: "prod",
        source: "DEPLOY_WORKER",
      });

      await setStatus(execution_id, {
        status: "prod_failed",
        env: "prod",
        timestamp: now(),
        target_apply: apply,
        rollback_attempt: rollback,
      });

      return withCors(
        request,
        json(
          {
            ok: false,
            execution_id,
            status: "prod_failed",
            message: "PROMOTE REAL falhou. Rollback PROD tentado.",
            target_apply: apply,
            rollback_attempt: rollback,
          },
          500
        )
      );
    }

    // =========================
    // 9) CANCELAR — encerra ciclo
    // POST /cancel  |  POST /__internal__/cancel
    // - opcional limpar STAGING/PATCH_STATUS/AUDIT/SUGGESTION
    // =========================
    if (method === "POST" && internalPath === "/cancel") {
      const body = await safeJson(request);
      if (!body)
        return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id, cleanup } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      await setStatus(execution_id, {
        status: "cancelled",
        env: null,
        timestamp: now(),
      });

      if (cleanup === true) {
        await Promise.all([
          env.DEPLOY_KV.delete(stagingKeyOf(execution_id)),
          env.DEPLOY_KV.delete(statusKeyOf(execution_id)),
          env.DEPLOY_KV.delete(auditKeyOf(execution_id)),
          env.DEPLOY_KV.delete(suggestionKeyOf(execution_id)),
        ]);
      }

      return withCors(
        request,
        json({
          ok: true,
          execution_id,
          status: "cancelled",
          cleaned: cleanup === true,
          message: "Ciclo cancelado.",
        })
      );
    }

    // =========================
    // 10) ROLLBACK — REVERSÃO REAL
    // POST /rollback  |  POST /__internal__/rollback
    // - lê status atual
    // - valida se é rollbackável
    // - chama TARGET_WORKER rollback
    // - atualiza status
    // =========================
    if (method === "POST" && internalPath === "/rollback") {
      const body = await safeJson(request);
      if (!body)
        return withCors(request, error(400, "INVALID_JSON"));

      const { execution_id, reason } = body || {};
      if (!execution_id)
        return withCors(request, error(400, "execution_id obrigatório"));

      const st = await getStatus(execution_id);
      const currentStatus = String(st?.status || "");

      // Estados que permitem rollback e seu ambiente correspondente
      const ROLLBACKABLE = {
        applied: "prod",
        prod_failed: "prod",
        tested: "test",
        test_failed: "test",
      };

      if (!(currentStatus in ROLLBACKABLE)) {
        return withCors(
          request,
          error(409, "INVALID_STATUS_FOR_ROLLBACK", {
            execution_id,
            expected: Object.keys(ROLLBACKABLE),
            got: currentStatus || null,
            message:
              "rollback só é possível quando existe deploy ativo (applied, prod_failed, tested, test_failed).",
          })
        );
      }

      const envTarget = ROLLBACKABLE[currentStatus];

      // Chama o TARGET_WORKER para executar o rollback real
      const rollbackResult = await callTargetInternal(
        "/__internal__/deploy-rollback",
        {
          execution_id,
          env: envTarget,
          source: "DEPLOY_WORKER",
          reason: reason || "manual_rollback",
        }
      );

      if (rollbackResult.ok) {
        await setStatus(execution_id, {
          status: "rolled_back",
          env: envTarget,
          reason: reason || "manual_rollback",
          timestamp: now(),
        });

        return withCors(
          request,
          json({
            ok: true,
            execution_id,
            status: "rolled_back",
            env: envTarget,
            message: `Rollback executado com sucesso em ${envTarget}.`,
          })
        );
      }

      // Rollback falhou
      await setStatus(execution_id, {
        status: "rollback_failed",
        env: envTarget,
        reason: reason || "manual_rollback",
        timestamp: now(),
        rollback_error: rollbackResult.error || null,
      });

      return withCors(
        request,
        json(
          {
            ok: false,
            execution_id,
            status: "rollback_failed",
            env: envTarget,
            message: `Rollback falhou em ${envTarget}.`,
            rollback_result: rollbackResult,
          },
          500
        )
      );
    }

    // =========================
    // APPLY PATCH — GENERIC (DUMMY)
    // =========================
    if (method === "POST" && internalPath === "/apply") {
      const body = await request.json().catch(() => ({}));

      return withCors(
        request,
        json({
          ok: true,
          system: "DEPLOY_WORKER",
          received: {
            execution_id: body.execution_id || null,
            approved: body.approved === true,
            target: body.target || null,
            has_patch: Boolean(body.patch),
          },
          message: "Patch recebido pelo deploy-worker (modo passivo).",
        })
      );
    }

    return withCors(request, error(404, "NOT_FOUND"));

    } catch (err) {
      let _errRoute = "unknown";
      try { _errRoute = new URL(request.url).pathname; } catch (_) {}
      const _errOrigin = request.headers.get("Origin") || "https://nv-control.vercel.app";
      console.error({
        route: _errRoute,
        method: request.method,
        error: err.message,
        stack: err.stack ? err.stack.split("\n").slice(0, 3).join("\n") : undefined,
      });
      return new Response(JSON.stringify({
        ok: false,
        error: "UNHANDLED_RUNTIME_ERROR",
        message: err.message,
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": _errOrigin,
          "Vary": "Origin",
        },
      });
    }
  },
};

// =========================
// HELPERS
// =========================
function json(data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function error(status, code, extra = {}) {
  return json(
    {
      ok: false,
      error: code,
      ...extra,
    },
    status
  );
}
