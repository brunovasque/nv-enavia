// schema/enavia-safety-guard.js
var require_enavia_safety_guard = __commonJS({
  "schema/enavia-safety-guard.js"(exports, module) {
    var VALID_DECISIONS = ["allow", "warn", "require_human_review", "block"];
    var VALID_RISK_LEVELS = ["low", "medium", "high", "critical"];
    var VALID_ACTION_TYPES = [
      "read",
      "plan",
      "propose",
      "patch",
      "deploy_test",
      "deploy_prod",
      "merge",
      "rollback",
      "secret_change",
      "external_integration",
      "unknown"
    ];
    var VALID_BLAST_RADII = ["none", "local", "repo", "worker", "production", "external", "unknown"];
    var VALID_SCOPE_STATUSES = ["in_scope", "out_of_scope", "unknown"];
    var VALID_HEALTH_STATUSES = ["healthy", "degraded", "failed", "blocked", "unknown"];
    var VALID_LOOP_STATUSES = ["clear", "suspicious", "destructive_loop", "unknown"];
    var MUTABLE_ACTIONS = ["patch", "deploy_test", "deploy_prod", "merge", "rollback", "secret_change"];
    var ALWAYS_REVIEW_ACTIONS = ["deploy_prod", "merge", "external_integration"];
    function _normalizeActionType(actionType) {
      if (typeof actionType !== "string") return "unknown";
      const lower = actionType.toLowerCase();
      return VALID_ACTION_TYPES.includes(lower) ? lower : "unknown";
    }
    __name(_normalizeActionType, "_normalizeActionType");
    function _normalizeBlastRadius(blastRadius) {
      if (typeof blastRadius !== "string") return "unknown";
      const lower = blastRadius.toLowerCase();
      return VALID_BLAST_RADII.includes(lower) ? lower : "unknown";
    }
    __name(_normalizeBlastRadius, "_normalizeBlastRadius");
    function _extractHealthStatus(context) {
      const health = context && context.health_snapshot;
      if (!health || typeof health !== "object") return "unknown";
      const raw = typeof health.overall_status === "string" ? health.overall_status.toLowerCase() : "";
      return VALID_HEALTH_STATUSES.includes(raw) ? raw : "unknown";
    }
    __name(_extractHealthStatus, "_extractHealthStatus");
    function _extractLoopStatus(context) {
      if (!context || typeof context !== "object") return "unknown";
      const raw = context.loop_status || context.anti_loop_result && context.anti_loop_result.loop_status || "unknown";
      const lower = typeof raw === "string" ? raw.toLowerCase() : "unknown";
      return VALID_LOOP_STATUSES.includes(lower) ? lower : "unknown";
    }
    __name(_extractLoopStatus, "_extractLoopStatus");
    function _extractScopeStatus(context) {
      if (!context || typeof context !== "object") return "unknown";
      const raw = typeof context.scope_status === "string" ? context.scope_status.toLowerCase() : "unknown";
      return VALID_SCOPE_STATUSES.includes(raw) ? raw : "unknown";
    }
    __name(_extractScopeStatus, "_extractScopeStatus");
    function _hasBlockedInEventLog(context) {
      const snapshot = context && context.event_log_snapshot;
      if (!snapshot || typeof snapshot !== "object") return false;
      return (snapshot.blocked_count || 0) > 0;
    }
    __name(_hasBlockedInEventLog, "_hasBlockedInEventLog");
    function _hasRequiresHumanReviewInEventLog(context) {
      const snapshot = context && context.event_log_snapshot;
      if (!snapshot || typeof snapshot !== "object") return false;
      return (snapshot.requires_human_review_count || 0) > 0;
    }
    __name(_hasRequiresHumanReviewInEventLog, "_hasRequiresHumanReviewInEventLog");
    function _extractRollbackHint(action, context) {
      if (action && typeof action.rollback_hint === "string" && action.rollback_hint) {
        return action.rollback_hint;
      }
      if (context && typeof context.rollback_hint === "string" && context.rollback_hint) {
        return context.rollback_hint;
      }
      return null;
    }
    __name(_extractRollbackHint, "_extractRollbackHint");
    function classifyActionRisk(action, context) {
      const safeAction = action && typeof action === "object" ? action : {};
      const safeContext = context && typeof context === "object" ? context : {};
      const actionType = _normalizeActionType(safeAction.type);
      const blastRadius = _normalizeBlastRadius(safeAction.blast_radius);
      const healthStatus = _extractHealthStatus(safeContext);
      const loopStatus = _extractLoopStatus(safeContext);
      const scopeStatus = _extractScopeStatus(safeContext);
      const rollbackHint = _extractRollbackHint(safeAction, safeContext);
      const hasBlockedEvents = _hasBlockedInEventLog(safeContext);
      const reasons = [];
      let riskScore = 0;
      if (actionType === "secret_change") {
        riskScore = Math.max(riskScore, 3);
        reasons.push("secret_change \xE9 sempre cr\xEDtico");
      } else if (actionType === "deploy_prod" || actionType === "merge") {
        riskScore = Math.max(riskScore, 2);
        reasons.push(`${actionType} exige revis\xE3o humana obrigat\xF3ria`);
      } else if (actionType === "deploy_test") {
        riskScore = Math.max(riskScore, 1);
        reasons.push("deploy_test \xE9 opera\xE7\xE3o de risco m\xE9dio");
      } else if (actionType === "patch") {
        riskScore = Math.max(riskScore, 1);
        reasons.push("patch \xE9 opera\xE7\xE3o mut\xE1vel de risco m\xE9dio");
      } else if (actionType === "external_integration") {
        riskScore = Math.max(riskScore, 2);
        reasons.push("external_integration exige revis\xE3o humana");
      } else if (actionType === "unknown") {
        riskScore = Math.max(riskScore, 1);
        reasons.push("tipo de a\xE7\xE3o desconhecido \u2014 risco n\xE3o determin\xEDstico");
      }
      if (blastRadius === "production" || blastRadius === "external") {
        riskScore = Math.max(riskScore, 2);
        reasons.push(`blast_radius ${blastRadius} eleva risco para high`);
      } else if (blastRadius === "worker") {
        riskScore = Math.max(riskScore, 1);
        reasons.push("blast_radius worker eleva risco para m\xE9dio");
      }
      if (healthStatus === "failed") {
        riskScore = Math.max(riskScore, 3);
        reasons.push("sistema em estado failed \u2014 risco cr\xEDtico");
      } else if (healthStatus === "blocked") {
        riskScore = Math.max(riskScore, 2);
        reasons.push("sistema bloqueado \u2014 risco alto");
      } else if (healthStatus === "degraded") {
        riskScore = Math.max(riskScore, 1);
        reasons.push("sistema degradado \u2014 risco m\xE9dio");
      }
      if (loopStatus === "destructive_loop") {
        riskScore = Math.max(riskScore, 3);
        reasons.push("loop destrutivo detectado \u2014 risco cr\xEDtico");
      } else if (loopStatus === "suspicious") {
        riskScore = Math.max(riskScore, 2);
        reasons.push("loop suspeito detectado \u2014 risco alto");
      }
      if (scopeStatus === "out_of_scope") {
        riskScore = Math.max(riskScore, 2);
        reasons.push("a\xE7\xE3o fora de escopo \u2014 risco alto");
      }
      if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint && actionType !== "secret_change") {
        riskScore = Math.max(riskScore, 2);
        reasons.push("a\xE7\xE3o mut\xE1vel sem rollback_hint \u2014 risco alto");
      }
      if (hasBlockedEvents) {
        riskScore = Math.max(riskScore, 1);
        reasons.push("event log cont\xE9m opera\xE7\xF5es bloqueadas");
      }
      const riskMap = ["low", "medium", "high", "critical"];
      const risk_level = riskMap[Math.min(riskScore, 3)];
      return { risk_level, reasons };
    }
    __name(classifyActionRisk, "classifyActionRisk");
    function buildRequiredHumanGates(action, context) {
      const safeAction = action && typeof action === "object" ? action : {};
      const safeContext = context && typeof context === "object" ? context : {};
      const actionType = _normalizeActionType(safeAction.type);
      const healthStatus = _extractHealthStatus(safeContext);
      const loopStatus = _extractLoopStatus(safeContext);
      const scopeStatus = _extractScopeStatus(safeContext);
      const rollbackHint = _extractRollbackHint(safeAction, safeContext);
      const hasBlockedEvents = _hasBlockedInEventLog(safeContext);
      const hasRequiresHumanReview = _hasRequiresHumanReviewInEventLog(safeContext);
      const { risk_level } = classifyActionRisk(action, context);
      const gates = /* @__PURE__ */ new Set();
      if (ALWAYS_REVIEW_ACTIONS.includes(actionType)) {
        gates.add("human_approval");
      }
      if (actionType === "secret_change") {
        gates.add("human_approval");
        gates.add("security_review");
      }
      if (actionType === "deploy_test" && ["degraded", "failed", "blocked"].includes(healthStatus)) {
        gates.add("human_approval");
        gates.add("health_check");
      }
      if (scopeStatus === "out_of_scope") {
        gates.add("human_approval");
        gates.add("scope_confirmation");
      }
      if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint && actionType !== "secret_change") {
        gates.add("rollback_plan");
      }
      if (healthStatus === "failed" && MUTABLE_ACTIONS.includes(actionType)) {
        gates.add("human_approval");
        gates.add("incident_review");
      }
      if (loopStatus === "destructive_loop") {
        gates.add("human_approval");
        gates.add("loop_investigation");
      } else if (loopStatus === "suspicious") {
        gates.add("loop_investigation");
      }
      if (hasBlockedEvents || hasRequiresHumanReview) {
        gates.add("human_approval");
      }
      if (risk_level === "critical") {
        gates.add("human_approval");
        gates.add("security_review");
      }
      return [...gates];
    }
    __name(buildRequiredHumanGates, "buildRequiredHumanGates");
    function evaluateSafetyGuard(action, context) {
      const safeAction = action && typeof action === "object" ? action : {};
      const safeContext = context && typeof context === "object" ? context : {};
      const actionType = _normalizeActionType(safeAction.type);
      const blastRadius = _normalizeBlastRadius(safeAction.blast_radius);
      const healthStatus = _extractHealthStatus(safeContext);
      const loopStatus = _extractLoopStatus(safeContext);
      const scopeStatus = _extractScopeStatus(safeContext);
      const rollbackHint = _extractRollbackHint(safeAction, safeContext);
      const hasBlockedEvents = _hasBlockedInEventLog(safeContext);
      const hasRequiresHumanReview = _hasRequiresHumanReviewInEventLog(safeContext);
      const { risk_level, reasons } = classifyActionRisk(action, context);
      const required_gates = buildRequiredHumanGates(action, context);
      const blockReasons = [...reasons];
      let decision = "allow";
      const blocked = [];
      const allowed = [];
      if (actionType === "secret_change") {
        decision = "block";
        blocked.push("secret_change \xE9 sempre bloqueado pelo Safety Guard");
      } else if (healthStatus === "failed" && MUTABLE_ACTIONS.includes(actionType)) {
        decision = "block";
        blocked.push("sistema em estado failed bloqueia a\xE7\xF5es mut\xE1veis");
      } else if (loopStatus === "destructive_loop") {
        if (MUTABLE_ACTIONS.includes(actionType)) {
          decision = "block";
          blocked.push("loop destrutivo bloqueia a\xE7\xF5es mut\xE1veis");
        } else {
          decision = "require_human_review";
          blocked.push("loop destrutivo exige revis\xE3o humana mesmo para leituras");
        }
      } else if (scopeStatus === "out_of_scope") {
        if (MUTABLE_ACTIONS.includes(actionType) || risk_level === "critical" || risk_level === "high") {
          decision = "block";
          blocked.push("a\xE7\xE3o fora de escopo com risco alto/cr\xEDtico \u2014 bloqueada");
        } else {
          decision = "require_human_review";
          blocked.push("a\xE7\xE3o fora de escopo exige revis\xE3o humana");
        }
      } else if (ALWAYS_REVIEW_ACTIONS.includes(actionType)) {
        decision = "require_human_review";
        blocked.push(`${actionType} nunca pode ser allow direto \u2014 exige revis\xE3o humana`);
      } else if (actionType === "deploy_test" && ["degraded", "failed", "blocked"].includes(healthStatus)) {
        decision = "require_human_review";
        blocked.push(`deploy_test com sistema ${healthStatus} exige revis\xE3o humana`);
      } else if (MUTABLE_ACTIONS.includes(actionType) && !rollbackHint) {
        decision = "require_human_review";
        blocked.push("a\xE7\xE3o mut\xE1vel sem rollback_hint exige revis\xE3o humana");
      } else if (hasBlockedEvents || hasRequiresHumanReview) {
        decision = "require_human_review";
        blocked.push("event log indica opera\xE7\xF5es bloqueadas ou pendentes de revis\xE3o humana");
      } else if (loopStatus === "suspicious") {
        if (MUTABLE_ACTIONS.includes(actionType)) {
          decision = "require_human_review";
          blocked.push("loop suspeito com a\xE7\xE3o mut\xE1vel exige revis\xE3o humana");
        } else {
          decision = "warn";
          allowed.push("a\xE7\xE3o de leitura permitida com aviso \u2014 loop suspeito detectado");
        }
      } else if (actionType === "patch" && rollbackHint) {
        if (risk_level === "critical" || risk_level === "high") {
          decision = "require_human_review";
          blocked.push("patch com risco alto/cr\xEDtico exige revis\xE3o humana mesmo com rollback_hint");
        } else {
          decision = "warn";
          allowed.push("patch com rollback_hint dispon\xEDvel \u2014 aviso");
        }
      } else if (actionType === "unknown") {
        if (risk_level === "critical" || risk_level === "high") {
          decision = "require_human_review";
          blocked.push("a\xE7\xE3o desconhecida com risco alto/cr\xEDtico exige revis\xE3o humana");
        } else {
          decision = "warn";
          allowed.push("a\xE7\xE3o desconhecida \u2014 aviso emitido, nunca allow cego");
        }
      } else if (["read", "plan", "propose"].includes(actionType)) {
        if (scopeStatus !== "out_of_scope" && !["failed", "blocked"].includes(healthStatus)) {
          decision = "allow";
          allowed.push(`${actionType} em escopo e sistema saud\xE1vel \u2014 permitido`);
        } else {
          decision = "require_human_review";
          blocked.push(`${actionType} com sistema em estado cr\xEDtico exige revis\xE3o`);
        }
      } else if (actionType === "rollback" && rollbackHint) {
        if (["healthy", "unknown"].includes(healthStatus)) {
          decision = "warn";
          allowed.push("rollback com hint dispon\xEDvel \u2014 aviso emitido");
        } else {
          decision = "require_human_review";
          blocked.push("rollback em sistema degradado/failed exige revis\xE3o humana");
        }
      } else if (actionType === "rollback" && !rollbackHint) {
        decision = "require_human_review";
        blocked.push("rollback sem rollback_hint exige revis\xE3o humana");
      } else {
        if (risk_level === "low" && scopeStatus === "in_scope") {
          decision = "allow";
          allowed.push("a\xE7\xE3o de baixo risco em escopo \u2014 permitida");
        } else {
          decision = "warn";
          allowed.push("a\xE7\xE3o n\xE3o categorizada \u2014 aviso emitido");
        }
      }
      const rollback_required = MUTABLE_ACTIONS.includes(actionType) && !rollbackHint;
      const requires_human_review = decision === "require_human_review" || decision === "block" || required_gates.includes("human_approval");
      let next_recommended_action;
      if (decision === "block") {
        next_recommended_action = "BLOQUEADO: opera\xE7\xE3o n\xE3o pode prosseguir. Verifique os motivos e corrija antes de tentar novamente.";
      } else if (decision === "require_human_review") {
        next_recommended_action = "Aguardar revis\xE3o humana obrigat\xF3ria antes de prosseguir.";
      } else if (decision === "warn") {
        next_recommended_action = "Prosseguir com cautela \u2014 aviso ativo. Verificar os motivos antes de continuar.";
      } else {
        next_recommended_action = "Opera\xE7\xE3o permitida. Monitorar execu\xE7\xE3o e registrar eventos.";
      }
      return {
        ok: true,
        mode: "safety_guard",
        decision,
        risk_level,
        action_type: actionType,
        allowed,
        blocked,
        requires_human_review,
        reasons: [.../* @__PURE__ */ new Set([...blockReasons, ...allowed])],
        required_gates,
        evidence: {
          action_type: actionType,
          blast_radius: blastRadius,
          health_status: healthStatus,
          loop_status: loopStatus,
          scope_status: scopeStatus,
          rollback_hint_present: rollbackHint !== null,
          event_log_blocked: hasBlockedEvents,
          event_log_requires_human_review: hasRequiresHumanReview
        },
        rollback_required,
        rollback_hint: rollbackHint,
        blast_radius: blastRadius,
        scope_status: scopeStatus,
        health_status: healthStatus,
        loop_status: loopStatus,
        next_recommended_action
      };
    }
    __name(evaluateSafetyGuard, "evaluateSafetyGuard");
    function isSafeToExecute(action, context) {
      const result = evaluateSafetyGuard(action, context);
      return result.decision === "allow" || result.decision === "warn";
    }
    __name(isSafeToExecute, "isSafeToExecute");
    function buildSafetyReport(result) {
      if (!result || typeof result !== "object") {
        return {
          ok: false,
          report_type: "safety_report",
          summary: "resultado inv\xE1lido ou ausente",
          decision: "unknown",
          risk_level: "unknown",
          reasons: [],
          required_gates: [],
          action_type: "unknown",
          allowed: false,
          blocked: true
        };
      }
      const isSafe = result.decision === "allow";
      const needsReview = result.decision === "require_human_review";
      const isBlocked = result.decision === "block";
      let summary;
      if (isBlocked) {
        summary = `[BLOQUEADO] ${result.action_type || "unknown"} \u2014 risco ${result.risk_level || "unknown"} \u2014 ${(result.blocked || []).join("; ")}`;
      } else if (needsReview) {
        summary = `[REVIS\xC3O HUMANA] ${result.action_type || "unknown"} \u2014 risco ${result.risk_level || "unknown"} \u2014 ${(result.blocked || []).join("; ")}`;
      } else if (result.decision === "warn") {
        summary = `[AVISO] ${result.action_type || "unknown"} \u2014 risco ${result.risk_level || "unknown"} \u2014 ${(result.allowed || []).join("; ")}`;
      } else {
        summary = `[PERMITIDO] ${result.action_type || "unknown"} \u2014 risco ${result.risk_level || "unknown"} \u2014 ${(result.allowed || []).join("; ")}`;
      }
      return {
        ok: true,
        report_type: "safety_report",
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        summary,
        decision: result.decision || "unknown",
        risk_level: result.risk_level || "unknown",
        action_type: result.action_type || "unknown",
        allowed: isSafe,
        blocked: isBlocked,
        requires_human_review: result.requires_human_review || false,
        reasons: Array.isArray(result.reasons) ? result.reasons : [],
        required_gates: Array.isArray(result.required_gates) ? result.required_gates : [],
        rollback_required: result.rollback_required || false,
        rollback_hint: result.rollback_hint || null,
        blast_radius: result.blast_radius || "unknown",
        scope_status: result.scope_status || "unknown",
        health_status: result.health_status || "unknown",
        loop_status: result.loop_status || "unknown",
        evidence: result.evidence || null,
        next_recommended_action: result.next_recommended_action || null
      };
    }
    __name(buildSafetyReport, "buildSafetyReport");
    module.exports = {
      evaluateSafetyGuard,
      isSafeToExecute,
      buildSafetyReport,
      classifyActionRisk,
      buildRequiredHumanGates,
      // Constantes exportadas
      VALID_DECISIONS,
      VALID_RISK_LEVELS,
      VALID_ACTION_TYPES,
      VALID_BLAST_RADII,
      VALID_SCOPE_STATUSES,
      VALID_HEALTH_STATUSES,
      VALID_LOOP_STATUSES,
      MUTABLE_ACTIONS,
      ALWAYS_REVIEW_ACTIONS
    };
  }
});

// schema/enavia-event-log.js
var require_enavia_event_log = __commonJS({
  "schema/enavia-event-log.js"(exports, module) {
    var VALID_SEVERITIES = ["info", "warning", "error", "critical"];
    var VALID_STATUSES2 = ["ok", "degraded", "failed", "blocked", "pending", "unknown"];
    var VALID_SUBSYSTEMS = [
      "worker",
      "executor",
      "chat",
      "skill_factory",
      "skill_runner",
      "pr_orchestrator",
      "deploy_loop",
      "self_auditor",
      "safety",
      "github_bridge",
      "unknown"
    ];
    function _generateEventId(timestamp, source, type, message) {
      const raw = `${timestamp}|${source}|${type}|${message}`;
      let hash = 0;
      for (let i = 0; i < raw.length; i++) {
        hash = (hash << 5) - hash + raw.charCodeAt(i) >>> 0;
      }
      return `evt_${hash.toString(16).padStart(8, "0")}`;
    }
    __name(_generateEventId, "_generateEventId");
    function createEnaviaEvent(input) {
      if (!input || typeof input !== "object") {
        return { ok: false, error: "input inv\xE1lido: deve ser um objeto" };
      }
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const timestamp = typeof input.timestamp === "string" && input.timestamp ? input.timestamp : now;
      const source = typeof input.source === "string" && input.source ? input.source : "unknown";
      const type = typeof input.type === "string" && input.type ? input.type : "unknown";
      const message = typeof input.message === "string" ? input.message : "";
      const rawSeverity = typeof input.severity === "string" ? input.severity.toLowerCase() : "";
      const severity = VALID_SEVERITIES.includes(rawSeverity) ? rawSeverity : "warning";
      const severity_normalized = !VALID_SEVERITIES.includes(
        typeof input.severity === "string" ? input.severity.toLowerCase() : ""
      );
      const rawStatus = typeof input.status === "string" ? input.status.toLowerCase() : "";
      const status = VALID_STATUSES2.includes(rawStatus) ? rawStatus : "unknown";
      const status_normalized = !VALID_STATUSES2.includes(
        typeof input.status === "string" ? input.status.toLowerCase() : ""
      );
      const rawSubsystem = typeof input.subsystem === "string" ? input.subsystem.toLowerCase() : "";
      const subsystem = VALID_SUBSYSTEMS.includes(rawSubsystem) ? rawSubsystem : "unknown";
      const event_id = typeof input.event_id === "string" && input.event_id ? input.event_id : _generateEventId(timestamp, source, type, message);
      const event = {
        event_id,
        timestamp,
        source,
        subsystem,
        type,
        severity,
        status,
        execution_id: typeof input.execution_id === "string" ? input.execution_id : null,
        contract_id: typeof input.contract_id === "string" ? input.contract_id : null,
        correlation_id: typeof input.correlation_id === "string" ? input.correlation_id : null,
        message,
        evidence: input.evidence !== void 0 ? input.evidence : null,
        rollback_hint: typeof input.rollback_hint === "string" ? input.rollback_hint : null,
        requires_human_review: input.requires_human_review === true,
        metadata: input.metadata && typeof input.metadata === "object" ? { ...input.metadata } : {},
        _normalized: {
          severity: severity_normalized,
          status: status_normalized,
          subsystem: subsystem !== rawSubsystem || !rawSubsystem
        }
      };
      return { ok: true, event };
    }
    __name(createEnaviaEvent, "createEnaviaEvent");
    function appendEnaviaEvent(events, event) {
      if (!Array.isArray(events)) {
        return [event];
      }
      return [...events, event];
    }
    __name(appendEnaviaEvent, "appendEnaviaEvent");
    function normalizeEnaviaEvents(events) {
      if (!Array.isArray(events)) {
        return { ok: false, events: [], errors: ["events deve ser um array"] };
      }
      const normalized = [];
      const errors = [];
      for (let i = 0; i < events.length; i++) {
        const item = events[i];
        if (item && typeof item === "object" && item.event_id && item.timestamp) {
          const result = createEnaviaEvent(item);
          if (result.ok) {
            normalized.push(result.event);
          } else {
            errors.push(`[${i}]: ${result.error}`);
            normalized.push({
              event_id: `evt_fallback_${i}`,
              timestamp: (/* @__PURE__ */ new Date()).toISOString(),
              source: "unknown",
              subsystem: "unknown",
              type: "unknown",
              severity: "warning",
              status: "unknown",
              execution_id: null,
              contract_id: null,
              correlation_id: null,
              message: "",
              evidence: null,
              rollback_hint: null,
              requires_human_review: false,
              metadata: {},
              _normalized: { severity: true, status: true, subsystem: true }
            });
          }
        } else {
          const result = createEnaviaEvent(item || {});
          if (result.ok) {
            normalized.push(result.event);
          } else {
            errors.push(`[${i}]: ${result.error}`);
          }
        }
      }
      return { ok: errors.length === 0, events: normalized, errors };
    }
    __name(normalizeEnaviaEvents, "normalizeEnaviaEvents");
    function filterEnaviaEvents(events, filters) {
      if (!Array.isArray(events)) return [];
      if (!filters || typeof filters !== "object") return [...events];
      return events.filter((evt) => {
        if (!evt || typeof evt !== "object") return false;
        if (filters.subsystem !== void 0 && evt.subsystem !== filters.subsystem) return false;
        if (filters.severity !== void 0 && evt.severity !== filters.severity) return false;
        if (filters.status !== void 0 && evt.status !== filters.status) return false;
        if (filters.type !== void 0 && evt.type !== filters.type) return false;
        if (filters.source !== void 0 && evt.source !== filters.source) return false;
        if (filters.requires_human_review !== void 0 && evt.requires_human_review !== filters.requires_human_review)
          return false;
        return true;
      });
    }
    __name(filterEnaviaEvents, "filterEnaviaEvents");
    function buildEventLogSnapshot(events, options) {
      const opts = options && typeof options === "object" ? options : {};
      const safeEvents = Array.isArray(events) ? events.filter((e) => e && typeof e === "object") : [];
      const total_events = safeEvents.length;
      const by_severity = { info: 0, warning: 0, error: 0, critical: 0 };
      for (const evt of safeEvents) {
        const sev = VALID_SEVERITIES.includes(evt.severity) ? evt.severity : "warning";
        by_severity[sev] = (by_severity[sev] || 0) + 1;
      }
      const by_status = {};
      for (const s of VALID_STATUSES2) by_status[s] = 0;
      for (const evt of safeEvents) {
        const st = VALID_STATUSES2.includes(evt.status) ? evt.status : "unknown";
        by_status[st] = (by_status[st] || 0) + 1;
      }
      const by_subsystem = {};
      for (const sub of VALID_SUBSYSTEMS) by_subsystem[sub] = 0;
      for (const evt of safeEvents) {
        const sub = VALID_SUBSYSTEMS.includes(evt.subsystem) ? evt.subsystem : "unknown";
        by_subsystem[sub] = (by_subsystem[sub] || 0) + 1;
      }
      let latest_event = null;
      if (safeEvents.length > 0) {
        latest_event = safeEvents.reduce((latest, evt) => {
          if (!latest) return evt;
          return evt.timestamp > latest.timestamp ? evt : latest;
        }, null);
      }
      const critical_count = by_severity.critical || 0;
      const failed_count = by_status.failed || 0;
      const blocked_count = by_status.blocked || 0;
      const requires_human_review_count = safeEvents.filter((e) => e.requires_human_review === true).length;
      const rollback_hints = [
        ...new Set(
          safeEvents.filter((e) => typeof e.rollback_hint === "string" && e.rollback_hint).map((e) => e.rollback_hint)
        )
      ];
      return {
        ok: true,
        mode: "event_log_snapshot",
        label: opts.label || null,
        generated_at: (/* @__PURE__ */ new Date()).toISOString(),
        total_events,
        by_severity,
        by_status,
        by_subsystem,
        latest_event,
        critical_count,
        failed_count,
        blocked_count,
        requires_human_review_count,
        rollback_hints
      };
    }
    __name(buildEventLogSnapshot, "buildEventLogSnapshot");
    module.exports = {
      createEnaviaEvent,
      appendEnaviaEvent,
      normalizeEnaviaEvents,
      filterEnaviaEvents,
      buildEventLogSnapshot,
      // Constantes exportadas para uso nos testes e helpers internos
      VALID_SEVERITIES,
      VALID_STATUSES: VALID_STATUSES2,
      VALID_SUBSYSTEMS
    };
  }
});

// schema/enavia-github-bridge.js
var require_enavia_github_bridge = __commonJS({
  "schema/enavia-github-bridge.js"(exports, module) {
    "use strict";
    var { evaluateSafetyGuard } = require_enavia_safety_guard();
    var { createEnaviaEvent } = require_enavia_event_log();
    var CONTRACT_ID = "CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105";
    var SOURCE_PR = "PR103";
    var ALLOWED_OPERATION_TYPES = [
      "create_branch",
      "open_pr",
      "update_pr",
      "comment_pr",
      "attach_evidence",
      "request_review"
    ];
    var BLOCKED_OPERATION_TYPES = [
      "merge",
      "deploy_prod",
      "secret_change"
    ];
    var MUTABLE_OPERATION_TYPES = [
      "create_branch",
      "open_pr",
      "update_pr",
      "comment_pr",
      "attach_evidence",
      "request_review"
    ];
    var BRANCH_REQUIRED_TYPES = ["create_branch", "open_pr"];
    function _normalizeOperationType(type) {
      if (typeof type !== "string") return "unknown";
      const lower = type.toLowerCase().trim();
      if (ALLOWED_OPERATION_TYPES.includes(lower)) return lower;
      if (BLOCKED_OPERATION_TYPES.includes(lower)) return lower;
      return "unknown";
    }
    __name(_normalizeOperationType, "_normalizeOperationType");
    function _extractHealthStatus(context) {
      if (!context || typeof context !== "object") return "unknown";
      const hs = context.health_snapshot;
      if (!hs || typeof hs !== "object") return "unknown";
      const raw = typeof hs.overall_status === "string" ? hs.overall_status.toLowerCase() : "";
      const valid = ["healthy", "degraded", "failed", "blocked", "unknown"];
      return valid.includes(raw) ? raw : "unknown";
    }
    __name(_extractHealthStatus, "_extractHealthStatus");
    function _extractEventLogBlocked(context) {
      if (!context || typeof context !== "object") return false;
      const els = context.event_log_snapshot;
      if (!els || typeof els !== "object") return false;
      return (els.blocked_count || 0) > 0 || (els.requires_human_review_count || 0) > 0;
    }
    __name(_extractEventLogBlocked, "_extractEventLogBlocked");
    function _isRepoPermitted(repo, context) {
      if (typeof repo !== "string" || !repo.trim()) return { permitted: false, reason: "repo ausente ou inv\xE1lido" };
      const allowedRepos = context && Array.isArray(context.allowed_repos) && context.allowed_repos.length > 0 ? context.allowed_repos : null;
      if (allowedRepos) {
        const permitted = allowedRepos.includes(repo.trim());
        return {
          permitted,
          reason: permitted ? null : `repo "${repo}" n\xE3o est\xE1 na lista de repos permitidos`
        };
      }
      return { permitted: true, reason: null, requires_human_review: true };
    }
    __name(_isRepoPermitted, "_isRepoPermitted");
    function validateGithubOperation(operation, context) {
      const safeOp = operation && typeof operation === "object" ? operation : {};
      const safeCtx = context && typeof context === "object" ? context : {};
      const rawType = safeOp.type;
      const operation_type = _normalizeOperationType(rawType);
      const repo = typeof safeOp.repo === "string" ? safeOp.repo.trim() : "";
      const base_branch = typeof safeOp.base_branch === "string" ? safeOp.base_branch.trim() : "";
      const head_branch = typeof safeOp.head_branch === "string" ? safeOp.head_branch.trim() : "";
      const reasons = [];
      let blocked = false;
      let requires_human_review = false;
      if (BLOCKED_OPERATION_TYPES.includes(operation_type)) {
        blocked = true;
        reasons.push(`${operation_type} \xE9 sempre bloqueado pelo GitHub Bridge`);
      }
      if (operation_type === "unknown") {
        requires_human_review = true;
        reasons.push("tipo de opera\xE7\xE3o desconhecido \u2014 n\xE3o permitido sem revis\xE3o humana");
      }
      if (!blocked && !repo && ALLOWED_OPERATION_TYPES.includes(operation_type)) {
        blocked = true;
        reasons.push(`opera\xE7\xE3o ${operation_type} exige campo "repo"`);
      }
      if (!blocked && BRANCH_REQUIRED_TYPES.includes(operation_type)) {
        if (!base_branch) {
          blocked = true;
          reasons.push(`opera\xE7\xE3o ${operation_type} exige campo "base_branch"`);
        }
        if (!head_branch) {
          blocked = true;
          reasons.push(`opera\xE7\xE3o ${operation_type} exige campo "head_branch"`);
        }
      }
      if (!blocked && repo) {
        const repoCheck = _isRepoPermitted(repo, safeCtx);
        if (!repoCheck.permitted) {
          blocked = true;
          reasons.push(repoCheck.reason);
        } else if (repoCheck.requires_human_review) {
          requires_human_review = true;
          reasons.push(`repo "${repo}" sem allowlist definida \u2014 exige revis\xE3o humana`);
        }
      }
      const safetyAction = {
        type: "external_integration",
        blast_radius: "external",
        description: `GitHub Bridge: ${operation_type}`,
        rollback_hint: safeOp.rollback_hint || null
      };
      const safetyResult = evaluateSafetyGuard(safetyAction, safeCtx);
      if (safetyResult.decision === "block") {
        blocked = true;
        reasons.push(...safetyResult.blocked || ["Safety Guard bloqueou a opera\xE7\xE3o"]);
      } else if (safetyResult.decision === "require_human_review") {
        requires_human_review = true;
        reasons.push(...safetyResult.blocked || ["Safety Guard exige revis\xE3o humana"]);
      }
      const healthStatus = _extractHealthStatus(safeCtx);
      if (!blocked && MUTABLE_OPERATION_TYPES.includes(operation_type)) {
        if (healthStatus === "failed") {
          blocked = true;
          reasons.push("health snapshot em estado failed bloqueia opera\xE7\xF5es GitHub mut\xE1veis");
        } else if (healthStatus === "degraded" || healthStatus === "blocked") {
          requires_human_review = true;
          reasons.push(`health snapshot em estado ${healthStatus} exige revis\xE3o humana para opera\xE7\xF5es GitHub`);
        }
      }
      if (!blocked && _extractEventLogBlocked(safeCtx)) {
        requires_human_review = true;
        reasons.push("event log indica opera\xE7\xF5es bloqueadas ou pendentes de revis\xE3o humana");
      }
      return {
        ok: !blocked,
        operation_type,
        repo: repo || null,
        base_branch: base_branch || null,
        head_branch: head_branch || null,
        pr_number: typeof safeOp.pr_number === "number" ? safeOp.pr_number : null,
        title: typeof safeOp.title === "string" ? safeOp.title : null,
        body: typeof safeOp.body === "string" ? safeOp.body : null,
        comment: typeof safeOp.comment === "string" ? safeOp.comment : null,
        files: Array.isArray(safeOp.files) ? safeOp.files : [],
        commit_message: typeof safeOp.commit_message === "string" ? safeOp.commit_message : null,
        blocked,
        requires_human_review: requires_human_review || blocked,
        reasons,
        safety: safetyResult,
        github_execution: false,
        side_effects: false
      };
    }
    __name(validateGithubOperation, "validateGithubOperation");
    function buildGithubOperationEvent(operation, validation, context) {
      const safeOp = operation && typeof operation === "object" ? operation : {};
      const safeVal = validation && typeof validation === "object" ? validation : {};
      const safeCtx = context && typeof context === "object" ? context : {};
      const operation_type = safeVal.operation_type || _normalizeOperationType(safeOp.type);
      let severity = "info";
      let status = "ok";
      if (safeVal.blocked) {
        severity = "error";
        status = "blocked";
      } else if (safeVal.requires_human_review) {
        severity = "warning";
        status = "pending";
      }
      const message = safeVal.blocked ? `GitHub Bridge: opera\xE7\xE3o ${operation_type} bloqueada \u2014 ${(safeVal.reasons || []).join("; ")}` : safeVal.requires_human_review ? `GitHub Bridge: opera\xE7\xE3o ${operation_type} planejada \u2014 aguardando revis\xE3o humana` : `GitHub Bridge: opera\xE7\xE3o ${operation_type} planejada com sucesso`;
      const evidence = {
        operation_type,
        repo: safeVal.repo || null,
        base_branch: safeVal.base_branch || null,
        head_branch: safeVal.head_branch || null,
        pr_number: safeVal.pr_number || null,
        blocked: safeVal.blocked || false,
        requires_human_review: safeVal.requires_human_review || false,
        reasons: safeVal.reasons || [],
        safety_decision: safeVal.safety ? safeVal.safety.decision : null,
        github_execution: false,
        side_effects: false,
        source_pr: SOURCE_PR,
        contract_id: CONTRACT_ID
      };
      return createEnaviaEvent({
        source: "github_bridge",
        subsystem: "github_bridge",
        type: `github_${operation_type}`,
        severity,
        status,
        message,
        execution_id: safeCtx.execution_id || null,
        contract_id: safeCtx.contract_id || CONTRACT_ID,
        correlation_id: safeCtx.correlation_id || null,
        requires_human_review: safeVal.requires_human_review || false,
        rollback_hint: safeVal.blocked ? `Rollback: opera\xE7\xE3o ${operation_type} bloqueada \u2014 nenhuma a\xE7\xE3o GitHub executada` : null,
        evidence,
        metadata: {
          source_pr: SOURCE_PR,
          operation_type,
          awaiting_human_approval: safeVal.requires_human_review || false
        }
      });
    }
    __name(buildGithubOperationEvent, "buildGithubOperationEvent");
    function planCreateBranch(input, context) {
      const safeInput = input && typeof input === "object" ? input : {};
      const operation = {
        type: "create_branch",
        repo: safeInput.repo,
        base_branch: safeInput.base_branch,
        head_branch: safeInput.head_branch,
        commit_message: safeInput.commit_message || null,
        rollback_hint: `Nenhuma branch criada \u2014 opera\xE7\xE3o apenas planejada pela PR103`
      };
      const validation = validateGithubOperation(operation, context);
      const eventResult = buildGithubOperationEvent(operation, validation, context);
      return {
        ok: validation.ok,
        mode: "github_bridge",
        operation_type: "create_branch",
        repo: validation.repo,
        base_branch: validation.base_branch,
        head_branch: validation.head_branch,
        pr_number: null,
        title: null,
        body: null,
        comment: null,
        files: validation.files,
        commit_message: validation.commit_message,
        safety: validation.safety,
        event: eventResult.ok ? eventResult.event : null,
        evidence: eventResult.ok ? eventResult.event.evidence : null,
        requires_human_review: validation.requires_human_review,
        blocked: validation.blocked,
        reasons: validation.reasons,
        github_execution: false,
        side_effects: false,
        awaiting_human_approval: validation.requires_human_review || false,
        next_recommended_action: validation.blocked ? `Opera\xE7\xE3o bloqueada: ${(validation.reasons || []).join("; ")}` : validation.requires_human_review ? "Aguardar aprova\xE7\xE3o humana antes de criar branch real via PR104+" : "Plano de cria\xE7\xE3o de branch pronto \u2014 integra\xE7\xE3o runtime via PR104"
      };
    }
    __name(planCreateBranch, "planCreateBranch");
    function planOpenPullRequest(input, context) {
      const safeInput = input && typeof input === "object" ? input : {};
      const operation = {
        type: "open_pr",
        repo: safeInput.repo,
        base_branch: safeInput.base_branch,
        head_branch: safeInput.head_branch,
        title: safeInput.title || null,
        body: safeInput.body || null,
        rollback_hint: `Nenhuma PR aberta \u2014 opera\xE7\xE3o apenas planejada pela PR103`
      };
      const validation = validateGithubOperation(operation, context);
      const eventResult = buildGithubOperationEvent(operation, validation, context);
      return {
        ok: validation.ok,
        mode: "github_bridge",
        operation_type: "open_pr",
        repo: validation.repo,
        base_branch: validation.base_branch,
        head_branch: validation.head_branch,
        pr_number: null,
        title: validation.title,
        body: validation.body,
        comment: null,
        files: validation.files,
        commit_message: null,
        safety: validation.safety,
        event: eventResult.ok ? eventResult.event : null,
        evidence: eventResult.ok ? eventResult.event.evidence : null,
        requires_human_review: validation.requires_human_review,
        blocked: validation.blocked,
        reasons: validation.reasons,
        github_execution: false,
        side_effects: false,
        awaiting_human_approval: validation.requires_human_review || false,
        next_recommended_action: validation.blocked ? `Opera\xE7\xE3o bloqueada: ${(validation.reasons || []).join("; ")}` : validation.requires_human_review ? "Aguardar aprova\xE7\xE3o humana antes de abrir PR real via PR104+" : "Plano de abertura de PR pronto \u2014 integra\xE7\xE3o runtime via PR104"
      };
    }
    __name(planOpenPullRequest, "planOpenPullRequest");
    function planUpdatePullRequest(input, context) {
      const safeInput = input && typeof input === "object" ? input : {};
      const operation = {
        type: "update_pr",
        repo: safeInput.repo,
        pr_number: safeInput.pr_number || null,
        title: safeInput.title || null,
        body: safeInput.body || null,
        rollback_hint: `Nenhuma PR atualizada \u2014 opera\xE7\xE3o apenas planejada pela PR103`
      };
      const validation = validateGithubOperation(operation, context);
      const eventResult = buildGithubOperationEvent(operation, validation, context);
      return {
        ok: validation.ok,
        mode: "github_bridge",
        operation_type: "update_pr",
        repo: validation.repo,
        base_branch: null,
        head_branch: null,
        pr_number: validation.pr_number,
        title: validation.title,
        body: validation.body,
        comment: null,
        files: validation.files,
        commit_message: null,
        safety: validation.safety,
        event: eventResult.ok ? eventResult.event : null,
        evidence: eventResult.ok ? eventResult.event.evidence : null,
        requires_human_review: validation.requires_human_review,
        blocked: validation.blocked,
        reasons: validation.reasons,
        github_execution: false,
        side_effects: false,
        awaiting_human_approval: validation.requires_human_review || false,
        next_recommended_action: validation.blocked ? `Opera\xE7\xE3o bloqueada: ${(validation.reasons || []).join("; ")}` : validation.requires_human_review ? "Aguardar aprova\xE7\xE3o humana antes de atualizar PR real via PR104+" : "Plano de atualiza\xE7\xE3o de PR pronto \u2014 integra\xE7\xE3o runtime via PR104"
      };
    }
    __name(planUpdatePullRequest, "planUpdatePullRequest");
    function planCommentPullRequest(input, context) {
      const safeInput = input && typeof input === "object" ? input : {};
      const operation = {
        type: "comment_pr",
        repo: safeInput.repo,
        pr_number: safeInput.pr_number || null,
        comment: safeInput.comment || null,
        rollback_hint: `Nenhum coment\xE1rio enviado \u2014 opera\xE7\xE3o apenas planejada pela PR103`
      };
      const validation = validateGithubOperation(operation, context);
      const eventResult = buildGithubOperationEvent(operation, validation, context);
      return {
        ok: validation.ok,
        mode: "github_bridge",
        operation_type: "comment_pr",
        repo: validation.repo,
        base_branch: null,
        head_branch: null,
        pr_number: validation.pr_number,
        title: null,
        body: null,
        comment: validation.comment,
        files: validation.files,
        commit_message: null,
        safety: validation.safety,
        event: eventResult.ok ? eventResult.event : null,
        evidence: eventResult.ok ? eventResult.event.evidence : null,
        requires_human_review: validation.requires_human_review,
        blocked: validation.blocked,
        reasons: validation.reasons,
        github_execution: false,
        side_effects: false,
        awaiting_human_approval: validation.requires_human_review || false,
        next_recommended_action: validation.blocked ? `Opera\xE7\xE3o bloqueada: ${(validation.reasons || []).join("; ")}` : validation.requires_human_review ? "Aguardar aprova\xE7\xE3o humana antes de comentar em PR real via PR104+" : "Plano de coment\xE1rio de PR pronto \u2014 integra\xE7\xE3o runtime via PR104"
      };
    }
    __name(planCommentPullRequest, "planCommentPullRequest");
    function buildGithubBridgePlan(input, context) {
      const safeInput = input && typeof input === "object" ? input : {};
      const safeCtx = context && typeof context === "object" ? context : {};
      const rawOperations = Array.isArray(safeInput.operations) ? safeInput.operations : [];
      const operations = [];
      const blocked_operations = [];
      const all_events = [];
      for (const op of rawOperations) {
        if (!op || typeof op !== "object") continue;
        const validation = validateGithubOperation(op, safeCtx);
        const eventResult = buildGithubOperationEvent(op, validation, safeCtx);
        const operationResult = {
          operation_type: validation.operation_type,
          ok: validation.ok,
          repo: validation.repo,
          base_branch: validation.base_branch,
          head_branch: validation.head_branch,
          pr_number: validation.pr_number,
          blocked: validation.blocked,
          requires_human_review: validation.requires_human_review,
          reasons: validation.reasons,
          github_execution: false,
          side_effects: false,
          awaiting_human_approval: validation.requires_human_review || false
        };
        operations.push(operationResult);
        if (validation.blocked) {
          blocked_operations.push(validation.operation_type || "unknown");
        }
        if (eventResult.ok) {
          all_events.push(eventResult.event);
        }
      }
      const all_valid = operations.length > 0 && operations.every((op) => op.ok);
      const any_blocked = blocked_operations.length > 0;
      const any_review = operations.some((op) => op.requires_human_review);
      const safety_summary = {
        total_operations: operations.length,
        blocked_count: blocked_operations.length,
        requires_review_count: operations.filter((op) => op.requires_human_review).length,
        all_valid,
        any_blocked,
        any_review,
        github_execution: false,
        side_effects: false
      };
      const event_summary = {
        total_events: all_events.length,
        events: all_events,
        subsystem: "github_bridge",
        source_pr: SOURCE_PR,
        contract_id: safeCtx.contract_id || CONTRACT_ID
      };
      const health_summary = {
        health_status: _extractHealthStatus(safeCtx),
        event_log_blocked: _extractEventLogBlocked(safeCtx),
        considered: !!(safeCtx.health_snapshot || safeCtx.event_log_snapshot)
      };
      const ready_for_runtime_integration = operations.length > 0 && !any_blocked && operations.every((op) => op.ok || op.requires_human_review);
      const next_recommended_action = any_blocked ? `Plano cont\xE9m opera\xE7\xF5es bloqueadas: ${blocked_operations.join(", ")}. Revisar antes de avan\xE7ar.` : any_review ? "Plano pronto \u2014 opera\xE7\xF5es aguardam revis\xE3o humana antes de execu\xE7\xE3o real via PR104" : ready_for_runtime_integration ? "Plano v\xE1lido \u2014 pronto para integra\xE7\xE3o runtime supervisionada via PR104" : "Nenhuma opera\xE7\xE3o processada \u2014 verificar input";
      return {
        ok: !any_blocked && operations.length > 0,
        mode: "github_bridge_plan",
        operations,
        safety_summary,
        event_summary,
        health_summary,
        blocked_operations,
        requires_human_review: any_review,
        github_execution: false,
        side_effects: false,
        ready_for_runtime_integration,
        ready_for_real_execution: false,
        contract_id: safeCtx.contract_id || CONTRACT_ID,
        operation_count: operations.length,
        source_pr: SOURCE_PR,
        next_recommended_action
      };
    }
    __name(buildGithubBridgePlan, "buildGithubBridgePlan");
    module.exports = {
      planCreateBranch,
      planOpenPullRequest,
      planUpdatePullRequest,
      planCommentPullRequest,
      validateGithubOperation,
      buildGithubOperationEvent,
      buildGithubBridgePlan,
      // Constantes exportadas para uso nos testes
      ALLOWED_OPERATION_TYPES,
      BLOCKED_OPERATION_TYPES,
      CONTRACT_ID,
      SOURCE_PR
    };
  }
});

// schema/enavia-github-adapter.js
var require_enavia_github_adapter = __commonJS({
  "schema/enavia-github-adapter.js"(exports, module) {
    "use strict";
    var { validateGithubOperation } = require_enavia_github_bridge();
    var { evaluateSafetyGuard } = require_enavia_safety_guard();
    var { createEnaviaEvent } = require_enavia_event_log();
    var ALWAYS_BLOCKED = ["merge", "deploy_prod", "secret_change"];
    var PROTECTED_BRANCHES = ["main", "master"];
    var SUPPORTED_OPERATIONS = ["comment_pr", "create_branch", "create_commit", "open_pr"];
    var SOURCE_PR = "PR105";
    var SOURCE_PR_106 = "PR106";
    var CONTRACT_ID = "CONTRATO_ENAVIA_GITHUB_BRIDGE_REAL_PR102_PR105";
    var USER_AGENT = "enavia-github-bridge/PR106";
    async function _executeCommentPr(operation, token) {
      const repo = typeof operation.repo === "string" ? operation.repo.trim() : "";
      const pr_number = operation.pr_number;
      const comment = typeof operation.comment === "string" ? operation.comment.trim() : "";
      const parts = repo.split("/");
      const owner = parts[0] || "";
      const repoName = parts[1] || "";
      if (!owner || !repoName) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "comment_pr",
          error: "repo deve ter formato owner/repo",
          evidence: []
        };
      }
      if (!pr_number || typeof pr_number !== "number") {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "comment_pr",
          error: "pr_number ausente ou inv\xE1lido (deve ser n\xFAmero)",
          evidence: []
        };
      }
      if (!comment) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "comment_pr",
          error: "comment ausente ou vazio",
          evidence: []
        };
      }
      const url = `https://api.github.com/repos/${owner}/${repoName}/issues/${pr_number}/comments`;
      let response, responseData;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify({ body: comment })
        });
        responseData = await response.json().catch(() => ({}));
      } catch (err) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "comment_pr",
          error: `Falha de rede ao chamar GitHub API: ${String(err)}`,
          evidence: []
        };
      }
      const ok = response.status === 201;
      const comment_id = ok ? responseData.id || null : null;
      const html_url = ok ? responseData.html_url || null : null;
      const evidence = ok ? [
        `Coment\xE1rio criado na PR #${pr_number} do repo ${repo}`,
        `comment_id=${comment_id}`,
        html_url ? `url=${html_url}` : null
      ].filter(Boolean) : [`Falha ao comentar na PR #${pr_number} do repo ${repo}: HTTP ${response.status}`];
      return {
        ok,
        executed: true,
        github_execution: true,
        operation_type: "comment_pr",
        repo,
        pr_number,
        response_status: response.status,
        comment_id,
        html_url,
        evidence,
        error: ok ? null : `GitHub API retornou HTTP ${response.status}`,
        source_pr: SOURCE_PR
      };
    }
    __name(_executeCommentPr, "_executeCommentPr");
    async function _executeCreateBranch(operation, token) {
      const repo = typeof operation.repo === "string" ? operation.repo.trim() : "";
      const base_branch = typeof operation.base_branch === "string" ? operation.base_branch.trim() : "";
      const head_branch = typeof operation.head_branch === "string" ? operation.head_branch.trim() : "";
      const parts = repo.split("/");
      const owner = parts[0] || "";
      const repoName = parts[1] || "";
      if (!owner || !repoName) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: "repo deve ter formato owner/repo",
          evidence: []
        };
      }
      if (!base_branch) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: "base_branch ausente",
          evidence: []
        };
      }
      if (!head_branch) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: "head_branch ausente",
          evidence: []
        };
      }
      const shaUrl = `https://api.github.com/repos/${owner}/${repoName}/git/ref/heads/${base_branch}`;
      let shaResponse, shaData;
      try {
        shaResponse = await fetch(shaUrl, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          }
        });
        shaData = await shaResponse.json().catch(() => ({}));
      } catch (err) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: `Falha de rede ao obter SHA de ${base_branch}: ${String(err)}`,
          evidence: []
        };
      }
      if (!shaResponse.ok) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: `Falha ao obter SHA de ${base_branch}: HTTP ${shaResponse.status}`,
          evidence: []
        };
      }
      const sha = shaData && shaData.object && shaData.object.sha;
      if (!sha) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: `SHA n\xE3o encontrado para branch ${base_branch}`,
          evidence: []
        };
      }
      const createUrl = `https://api.github.com/repos/${owner}/${repoName}/git/refs`;
      let createResponse, createData;
      try {
        createResponse = await fetch(createUrl, {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify({ ref: `refs/heads/${head_branch}`, sha })
        });
        createData = await createResponse.json().catch(() => ({}));
      } catch (err) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_branch",
          error: `Falha de rede ao criar branch ${head_branch}: ${String(err)}`,
          evidence: []
        };
      }
      const ok = createResponse.status === 201;
      const alreadyExists = createResponse.status === 422;
      const created_ref = ok ? createData && createData.ref ? createData.ref : null : null;
      const evidence = ok ? [
        `Branch ${head_branch} criada a partir de ${base_branch} no repo ${repo}`,
        `SHA base: ${sha.slice(0, 7)}`,
        created_ref ? `ref=${created_ref}` : null
      ].filter(Boolean) : alreadyExists ? [`Branch ${head_branch} j\xE1 existe no repo ${repo} (HTTP 422)`] : [`Falha ao criar branch ${head_branch} no repo ${repo}: HTTP ${createResponse.status}`];
      return {
        ok,
        executed: true,
        github_execution: true,
        operation_type: "create_branch",
        repo,
        base_branch,
        head_branch,
        sha_used: ok ? sha : null,
        response_status: createResponse.status,
        already_exists: alreadyExists,
        evidence,
        error: ok ? null : alreadyExists ? `Branch ${head_branch} j\xE1 existe no repo ${repo}` : `GitHub API retornou HTTP ${createResponse.status}`,
        source_pr: SOURCE_PR_106
      };
    }
    __name(_executeCreateBranch, "_executeCreateBranch");
    function _toBase64(str) {
      if (typeof Buffer !== "undefined") {
        return Buffer.from(str, "utf-8").toString("base64");
      }
      return btoa(
        encodeURIComponent(str).replace(
          /%([0-9A-F]{2})/gi,
          (_, p1) => String.fromCharCode(parseInt(p1, 16))
        )
      );
    }
    __name(_toBase64, "_toBase64");
    async function _executeCreateCommit(operation, token) {
      const repo = typeof operation.repo === "string" ? operation.repo.trim() : "";
      const branch = typeof operation.branch === "string" ? operation.branch.trim() : "";
      const file_path = typeof operation.file_path === "string" ? operation.file_path.trim() : "";
      const content = typeof operation.content === "string" ? operation.content : "";
      const commit_message = typeof operation.commit_message === "string" ? operation.commit_message.trim() : "";
      const parts = repo.split("/");
      const owner = parts[0] || "";
      const repoName = parts[1] || "";
      if (!owner || !repoName) {
        return { ok: false, executed: false, github_execution: false, operation_type: "create_commit", error: "repo deve ter formato owner/repo", evidence: [] };
      }
      if (!branch) {
        return { ok: false, executed: false, github_execution: false, operation_type: "create_commit", error: "branch de destino ausente", evidence: [] };
      }
      if (PROTECTED_BRANCHES.includes(branch)) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_commit",
          blocked: true,
          error: `Commit direto em "${branch}" \xE9 proibido pelo GitHub Bridge \u2014 use uma branch de feature`,
          evidence: [],
          source_pr: SOURCE_PR_106
        };
      }
      if (!content) {
        return { ok: false, executed: false, github_execution: false, operation_type: "create_commit", error: "content n\xE3o pode ser vazio", evidence: [] };
      }
      if (!file_path) {
        return { ok: false, executed: false, github_execution: false, operation_type: "create_commit", error: "file_path ausente", evidence: [] };
      }
      if (!commit_message) {
        return { ok: false, executed: false, github_execution: false, operation_type: "create_commit", error: "commit_message ausente", evidence: [] };
      }
      const contentsUrl = `https://api.github.com/repos/${owner}/${repoName}/contents/${file_path}`;
      let existingSha = null;
      try {
        const getResponse = await fetch(`${contentsUrl}?ref=${encodeURIComponent(branch)}`, {
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          }
        });
        if (getResponse.status === 200) {
          const getData = await getResponse.json().catch(() => ({}));
          existingSha = getData.sha || null;
        }
      } catch (_) {
      }
      const contentBase64 = _toBase64(content);
      const putBody = {
        message: commit_message,
        content: contentBase64,
        branch,
        ...existingSha ? { sha: existingSha } : {}
      };
      let putResponse, putData;
      try {
        putResponse = await fetch(contentsUrl, {
          method: "PUT",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify(putBody)
        });
        putData = await putResponse.json().catch(() => ({}));
      } catch (err) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "create_commit",
          error: `Falha de rede ao criar commit em ${file_path}: ${String(err)}`,
          evidence: []
        };
      }
      const ok = putResponse.status === 200 || putResponse.status === 201;
      const operation_kind = existingSha ? "update" : "create";
      const commit_sha = ok && putData.commit ? putData.commit.sha || null : null;
      const html_url = ok && putData.content ? putData.content.html_url || null : null;
      const evidence = ok ? [
        `Arquivo ${file_path} ${operation_kind === "update" ? "atualizado" : "criado"} na branch ${branch} do repo ${repo}`,
        commit_sha ? `commit_sha=${commit_sha.slice(0, 7)}` : null,
        html_url ? `url=${html_url}` : null,
        `operation_kind=${operation_kind}`
      ].filter(Boolean) : [`Falha ao criar commit em ${file_path} na branch ${branch} do repo ${repo}: HTTP ${putResponse.status}`];
      return {
        ok,
        executed: true,
        github_execution: true,
        operation_type: "create_commit",
        repo,
        branch,
        file_path,
        operation_kind,
        response_status: putResponse.status,
        commit_sha,
        html_url,
        evidence,
        error: ok ? null : `GitHub API retornou HTTP ${putResponse.status}`,
        source_pr: SOURCE_PR_106
      };
    }
    __name(_executeCreateCommit, "_executeCreateCommit");
    async function _executeOpenPr(operation, token) {
      const repo = typeof operation.repo === "string" ? operation.repo.trim() : "";
      const title = typeof operation.title === "string" ? operation.title.trim() : "";
      const body = typeof operation.body === "string" ? operation.body : "";
      const head = (typeof operation.head_branch === "string" ? operation.head_branch.trim() : "") || (typeof operation.head === "string" ? operation.head.trim() : "");
      const base = (typeof operation.base_branch === "string" ? operation.base_branch.trim() : "") || (typeof operation.base === "string" ? operation.base.trim() : "");
      const parts = repo.split("/");
      const owner = parts[0] || "";
      const repoName = parts[1] || "";
      if (!owner || !repoName) {
        return { ok: false, executed: false, github_execution: false, operation_type: "open_pr", error: "repo deve ter formato owner/repo", evidence: [] };
      }
      if (!title) {
        return { ok: false, executed: false, github_execution: false, operation_type: "open_pr", error: "title ausente", evidence: [] };
      }
      if (!head) {
        return { ok: false, executed: false, github_execution: false, operation_type: "open_pr", error: "head ausente (branch de origem)", evidence: [] };
      }
      if (!base) {
        return { ok: false, executed: false, github_execution: false, operation_type: "open_pr", error: "base ausente (branch de destino)", evidence: [] };
      }
      const url = `https://api.github.com/repos/${owner}/${repoName}/pulls`;
      let response, responseData;
      try {
        response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `token ${token}`,
            Accept: "application/vnd.github+json",
            "Content-Type": "application/json",
            "User-Agent": USER_AGENT,
            "X-GitHub-Api-Version": "2022-11-28"
          },
          body: JSON.stringify({ title, body, head, base })
        });
        responseData = await response.json().catch(() => ({}));
      } catch (err) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: "open_pr",
          error: `Falha de rede ao abrir PR: ${String(err)}`,
          evidence: []
        };
      }
      const ok = response.status === 201;
      const pr_number = ok ? responseData.number || null : null;
      const html_url = ok ? responseData.html_url || null : null;
      const pr_state = ok ? responseData.state || null : null;
      const evidence = ok ? [
        `PR aberta: "${title}" (${head} \u2192 ${base}) no repo ${repo}`,
        pr_number ? `PR #${pr_number}` : null,
        html_url ? `url=${html_url}` : null,
        `merge_allowed=false \u2014 gate humano obrigat\xF3rio`
      ].filter(Boolean) : [`Falha ao abrir PR no repo ${repo}: HTTP ${response.status}`];
      return {
        ok,
        executed: true,
        github_execution: true,
        operation_type: "open_pr",
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
        source_pr: SOURCE_PR_106
      };
    }
    __name(_executeOpenPr, "_executeOpenPr");
    async function executeGithubOperation(operation, token) {
      const safeOp = operation && typeof operation === "object" ? operation : {};
      const opType = typeof safeOp.type === "string" ? safeOp.type.toLowerCase().trim() : "unknown";
      if (ALWAYS_BLOCKED.includes(opType)) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: opType,
          blocked: true,
          error: `${opType} \xE9 sempre bloqueado pelo GitHub Bridge \u2014 nunca executado`,
          evidence: [],
          source_pr: SOURCE_PR
        };
      }
      if (!token || typeof token !== "string" || !token.trim()) {
        return {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: opType,
          blocked: false,
          error: "GITHUB_TOKEN ausente ou inv\xE1lido \u2014 opera\xE7\xE3o n\xE3o executada",
          evidence: [],
          source_pr: SOURCE_PR
        };
      }
      if (opType === "comment_pr") return _executeCommentPr(safeOp, token);
      if (opType === "create_branch") return _executeCreateBranch(safeOp, token);
      if (opType === "create_commit") return _executeCreateCommit(safeOp, token);
      if (opType === "open_pr") return _executeOpenPr(safeOp, token);
      return {
        ok: false,
        executed: false,
        github_execution: false,
        operation_type: opType,
        blocked: false,
        error: `Opera\xE7\xE3o "${opType}" n\xE3o suportada pelo adapter atual (suportadas: ${SUPPORTED_OPERATIONS.join(", ")})`,
        evidence: [],
        source_pr: SOURCE_PR_106
      };
    }
    __name(executeGithubOperation, "executeGithubOperation");
    async function executeGithubBridgeRequest(operation, token) {
      const safeOp = operation && typeof operation === "object" ? operation : {};
      const opType = typeof safeOp.type === "string" ? safeOp.type.toLowerCase().trim() : "unknown";
      const validation = validateGithubOperation(safeOp, {});
      const safetyAction = {
        type: "external_integration",
        blast_radius: "external",
        description: `GitHub Bridge Execute: ${opType}`,
        rollback_hint: `Rollback: nenhuma a\xE7\xE3o GitHub executada se bloqueado (${opType})`
      };
      const safetyResult = evaluateSafetyGuard(safetyAction, {});
      const isBlocked = validation.blocked || safetyResult.decision === "block";
      const requiresReview = !isBlocked && (validation.requires_human_review || safetyResult.decision === "require_human_review");
      const blockedReasons = [
        ...validation.reasons || [],
        ...safetyResult.blocked || []
      ].filter(Boolean);
      const attemptEvent = createEnaviaEvent({
        source: "github_bridge",
        subsystem: "github_bridge",
        type: `github_execute_attempt`,
        severity: isBlocked ? "error" : requiresReview ? "warning" : "info",
        status: isBlocked ? "blocked" : "ok",
        message: isBlocked ? `GitHub Bridge Execute: opera\xE7\xE3o ${opType} bloqueada (${blockedReasons.slice(0, 1).join("; ")})` : `GitHub Bridge Execute: tentativa de ${opType} iniciada`,
        requires_human_review: requiresReview || isBlocked,
        rollback_hint: isBlocked ? `Nenhuma a\xE7\xE3o GitHub executada \u2014 opera\xE7\xE3o bloqueada antes do fetch` : null,
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
          contract_id: CONTRACT_ID
        },
        metadata: { source_pr: SOURCE_PR, operation_type: opType }
      });
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
          source_pr: SOURCE_PR
        };
      }
      let execResult;
      try {
        execResult = await executeGithubOperation(safeOp, token);
      } catch (err) {
        execResult = {
          ok: false,
          executed: false,
          github_execution: false,
          operation_type: opType,
          error: `Exce\xE7\xE3o no adapter: ${String(err)}`,
          evidence: []
        };
      }
      const resultEvent = createEnaviaEvent({
        source: "github_bridge",
        subsystem: "github_bridge",
        type: `github_execute_result`,
        severity: execResult.ok ? "info" : "error",
        status: execResult.ok ? "ok" : "failed",
        message: execResult.ok ? `GitHub Bridge Execute: ${opType} executado com sucesso` : `GitHub Bridge Execute: ${opType} falhou \u2014 ${execResult.error || "erro desconhecido"}`,
        requires_human_review: !execResult.ok,
        evidence: {
          operation_type: opType,
          repo: execResult.repo || validation.repo || null,
          executed: execResult.executed,
          github_execution: execResult.github_execution,
          response_status: execResult.response_status || null,
          evidence_list: execResult.evidence || [],
          source_pr: SOURCE_PR,
          contract_id: CONTRACT_ID
          // token nunca incluído aqui
        },
        metadata: { source_pr: SOURCE_PR, operation_type: opType, executed: execResult.executed }
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
        ...execResult.comment_id !== void 0 ? { comment_id: execResult.comment_id } : {},
        ...execResult.html_url !== void 0 ? { html_url: execResult.html_url } : {},
        ...execResult.sha_used !== void 0 ? { sha_used: execResult.sha_used } : {},
        ...execResult.commit_sha !== void 0 ? { commit_sha: execResult.commit_sha } : {},
        ...execResult.branch !== void 0 ? { branch: execResult.branch } : {},
        ...execResult.file_path !== void 0 ? { file_path: execResult.file_path } : {},
        ...execResult.operation_kind !== void 0 ? { operation_kind: execResult.operation_kind } : {},
        ...execResult.pr_number !== void 0 ? { pr_number: execResult.pr_number } : {},
        ...execResult.pr_state !== void 0 ? { pr_state: execResult.pr_state } : {},
        ...execResult.merge_allowed !== void 0 ? { merge_allowed: execResult.merge_allowed } : {},
        ...execResult.head !== void 0 ? { head: execResult.head } : {},
        ...execResult.base !== void 0 ? { base: execResult.base } : {}
      };
    }
    __name(executeGithubBridgeRequest, "executeGithubBridgeRequest");
    module.exports = {
      executeGithubOperation,
      executeGithubBridgeRequest,
      ALWAYS_BLOCKED,
      SUPPORTED_OPERATIONS
    };
  }
});

// schema/contract-adherence-gate.js
var ADHERENCE_STATUS = {
  ADERENTE: "aderente_ao_contrato",
  PARCIAL: "parcial_desviado",
  FORA: "fora_do_contrato"
};
var HONEST_STATUS = {
  CONCLUIDO: "concluido",
  PARCIAL: "parcial",
  SIMULADO: "simulado",
  MOCKADO: "mockado",
  LOCAL: "local",
  FORA_DO_CONTRATO: "fora_do_contrato",
  PENDENTE: "pendente"
};
var HONEST_STATUS_RULES = {
  // Se aderente e sem desvios → único caso onde "concluido" é permitido
  [ADHERENCE_STATUS.ADERENTE]: HONEST_STATUS.CONCLUIDO,
  // Se parcialmente desviado → nunca "concluído", sempre "parcial"
  [ADHERENCE_STATUS.PARCIAL]: HONEST_STATUS.PARCIAL,
  // Se fora do contrato → status explícito de divergência
  [ADHERENCE_STATUS.FORA]: HONEST_STATUS.FORA_DO_CONTRATO
};
var _NEXT_ACTIONS = {
  [ADHERENCE_STATUS.ADERENTE]: "Microetapa aderente ao contrato \u2014 pode ser marcada como conclu\xEDda.",
  [ADHERENCE_STATUS.PARCIAL]: "Microetapa parcialmente desviada \u2014 revisar escopo e entrega antes de prosseguir.",
  [ADHERENCE_STATUS.FORA]: "Microetapa fora do contrato \u2014 n\xE3o prosseguir; revisar objetivo e escopo contratual."
};
function _validateContract(contract, fnName) {
  if (!contract || typeof contract !== "object") {
    throw new Error(`${fnName}: 'contract' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof contract.objetivo_contratual_exato !== "string" || contract.objetivo_contratual_exato.trim() === "") {
    throw new Error(`${fnName}: 'contract.objetivo_contratual_exato' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia`);
  }
  if (!Array.isArray(contract.escopo_permitido)) {
    throw new Error(`${fnName}: 'contract.escopo_permitido' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (!Array.isArray(contract.escopo_proibido)) {
    throw new Error(`${fnName}: 'contract.escopo_proibido' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (typeof contract.criterio_de_aceite_literal !== "string" || contract.criterio_de_aceite_literal.trim() === "") {
    throw new Error(`${fnName}: 'contract.criterio_de_aceite_literal' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia`);
  }
}
__name(_validateContract, "_validateContract");
function _validateResultado(resultado, fnName) {
  if (!resultado || typeof resultado !== "object") {
    throw new Error(`${fnName}: 'resultado' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof resultado.objetivo_atendido !== "boolean") {
    throw new Error(`${fnName}: 'resultado.objetivo_atendido' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (typeof resultado.criterio_aceite_atendido !== "boolean") {
    throw new Error(`${fnName}: 'resultado.criterio_aceite_atendido' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (!Array.isArray(resultado.escopo_efetivo)) {
    throw new Error(`${fnName}: 'resultado.escopo_efetivo' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (typeof resultado.is_simulado !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_simulado' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (typeof resultado.is_mockado !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_mockado' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (typeof resultado.is_local !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_local' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (typeof resultado.is_parcial !== "boolean") {
    throw new Error(`${fnName}: 'resultado.is_parcial' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
}
__name(_validateResultado, "_validateResultado");
function _checkScopeViolations({ escopo_efetivo, escopo_permitido, escopo_proibido }) {
  const proibidos_entregues = escopo_efetivo.filter(
    (item) => escopo_proibido.some((p) => typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase())
  );
  const escopoAberto = escopo_permitido.length === 0;
  const fora_do_permitido = escopoAberto ? [] : escopo_efetivo.filter((item) => {
    const isProibido = escopo_proibido.some(
      (p) => typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase()
    );
    const isPermitido = escopo_permitido.some(
      (p) => typeof p === "string" && p.trim().toLowerCase() === item.trim().toLowerCase()
    );
    return !isProibido && !isPermitido;
  });
  return { proibidos_entregues, fora_do_permitido };
}
__name(_checkScopeViolations, "_checkScopeViolations");
function _buildReason({ adherence_status, campos_falhos }) {
  if (adherence_status === ADHERENCE_STATUS.ADERENTE) {
    return "Microetapa aderente ao contrato \u2014 todos os crit\xE9rios atendidos.";
  }
  const listaFalhos = campos_falhos.length > 0 ? ` Campos/crit\xE9rios falhos: ${campos_falhos.join("; ")}.` : "";
  if (adherence_status === ADHERENCE_STATUS.FORA) {
    return `Microetapa fora do contrato \u2014 desvio fatal detectado.${listaFalhos}`;
  }
  return `Microetapa parcialmente desviada \u2014 nem todos os crit\xE9rios foram atendidos.${listaFalhos}`;
}
__name(_buildReason, "_buildReason");
function evaluateAdherence({ contract, resultado } = {}) {
  _validateContract(contract, "evaluateAdherence");
  _validateResultado(resultado, "evaluateAdherence");
  const campos_falhos = [];
  if (!resultado.objetivo_atendido) {
    campos_falhos.push("objetivo_contratual_exato: objetivo n\xE3o atendido");
  }
  const { proibidos_entregues, fora_do_permitido } = _checkScopeViolations({
    escopo_efetivo: resultado.escopo_efetivo,
    escopo_permitido: contract.escopo_permitido,
    escopo_proibido: contract.escopo_proibido
  });
  if (proibidos_entregues.length > 0) {
    campos_falhos.push(`escopo_proibido: itens entregues que s\xE3o proibidos \u2014 ${proibidos_entregues.join(", ")}`);
  }
  const temFatalidade = !resultado.objetivo_atendido || proibidos_entregues.length > 0;
  if (!resultado.criterio_aceite_atendido) {
    campos_falhos.push("criterio_de_aceite_literal: crit\xE9rio de aceite n\xE3o atendido");
  }
  if (fora_do_permitido.length > 0) {
    campos_falhos.push(`escopo_permitido: itens entregues fora do permitido \u2014 ${fora_do_permitido.join(", ")}`);
  }
  if (resultado.is_simulado) {
    campos_falhos.push("honest_state: entrega simulada \u2014 n\xE3o pode ser marcada como 'feito'");
  }
  if (resultado.is_mockado) {
    campos_falhos.push("honest_state: entrega mockada \u2014 n\xE3o pode ser marcada como 'integrado'");
  }
  if (resultado.is_local) {
    campos_falhos.push("honest_state: entrega local \u2014 n\xE3o pode ser marcada como 'real'");
  }
  if (resultado.is_parcial) {
    campos_falhos.push("honest_state: entrega parcial \u2014 n\xE3o pode ser marcada como 'conclu\xEDdo'");
  }
  let adherence_status;
  if (temFatalidade) {
    adherence_status = ADHERENCE_STATUS.FORA;
  } else if (campos_falhos.length > 0) {
    adherence_status = ADHERENCE_STATUS.PARCIAL;
  } else {
    adherence_status = ADHERENCE_STATUS.ADERENTE;
  }
  const can_mark_concluded = adherence_status === ADHERENCE_STATUS.ADERENTE;
  const honest_status = HONEST_STATUS_RULES[adherence_status];
  return {
    adherence_status,
    can_mark_concluded,
    honest_status,
    campos_falhos,
    reason: _buildReason({ adherence_status, campos_falhos }),
    next_action: _NEXT_ACTIONS[adherence_status]
  };
}
__name(evaluateAdherence, "evaluateAdherence");

// schema/execution-audit.js
var EXECUTION_ADHERENCE_STATUS = {
  ADERENTE: "aderente_ao_contrato",
  PARCIAL: "parcial_desviado",
  FORA: "fora_do_contrato"
};
var AUDIT_MODE = {
  MICROSTEP: "microstep_anchored",
  EXECUTOR_ARTIFACTS: "executor_artifacts",
  TASK_DECOMPOSITION: "task_decomposition"
};
var AUDIT_TASK_DONE_STATUSES = ["completed"];
function _normalize(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}
__name(_normalize, "_normalize");
function _validateState(state, fnName) {
  if (!state || typeof state !== "object") {
    throw new Error(`${fnName}: 'state' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof state.contract_id !== "string" || state.contract_id.trim() === "") {
    throw new Error(`${fnName}: 'state.contract_id' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia`);
  }
  if (!Array.isArray(state.definition_of_done)) {
    throw new Error(`${fnName}: 'state.definition_of_done' \xE9 obrigat\xF3rio e deve ser array`);
  }
}
__name(_validateState, "_validateState");
function _validateDecomposition(decomposition, fnName) {
  if (!decomposition || typeof decomposition !== "object") {
    throw new Error(`${fnName}: 'decomposition' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (!Array.isArray(decomposition.tasks)) {
    throw new Error(`${fnName}: 'decomposition.tasks' \xE9 obrigat\xF3rio e deve ser array`);
  }
}
__name(_validateDecomposition, "_validateDecomposition");
function _hasExecutorAuditArtifacts(executor_artifacts) {
  return executor_artifacts !== null && typeof executor_artifacts === "object" && executor_artifacts.audit !== null && typeof executor_artifacts.audit === "object" && typeof executor_artifacts.audit.verdict === "string" && typeof executor_artifacts.audit.risk_level === "string";
}
__name(_hasExecutorAuditArtifacts, "_hasExecutorAuditArtifacts");
function _collectExecutionIds({ executor_artifacts, execution_cycles }) {
  const ids = [];
  if (executor_artifacts && typeof executor_artifacts.execution_id === "string") {
    ids.push(executor_artifacts.execution_id);
  }
  for (const cycle of Array.isArray(execution_cycles) ? execution_cycles : []) {
    let id = null;
    if (typeof cycle.execution_id === "string") {
      id = cycle.execution_id;
    } else if (typeof cycle.micro_pr_id === "string") {
      id = cycle.micro_pr_id;
    }
    if (id && !ids.includes(id)) {
      ids.push(id);
    }
  }
  return ids;
}
__name(_collectExecutionIds, "_collectExecutionIds");
function _buildContractMicrostepReference(state, decomposition, task) {
  const mprs = Array.isArray(decomposition.micro_pr_candidates) ? decomposition.micro_pr_candidates : [];
  const linkedMpr = mprs.find((m) => m.task_id === task.id && m.environment === "TEST") || mprs.find((m) => m.task_id === task.id) || null;
  const scopeWorkers = linkedMpr && Array.isArray(linkedMpr.target_workers) ? linkedMpr.target_workers : state.scope && Array.isArray(state.scope.workers) ? state.scope.workers : [];
  const dodNormalizedList = state.definition_of_done.map(_normalize);
  const taskDescNorm = _normalize(task.description);
  const dodIndex = dodNormalizedList.indexOf(taskDescNorm);
  return {
    task_id: task.id,
    description: task.description || "",
    micro_pr_id: linkedMpr ? linkedMpr.id : null,
    environment: linkedMpr ? linkedMpr.environment : "TEST",
    target_workers: scopeWorkers,
    definition_of_done_index: dodIndex,
    required_constraints: {
      context_used: true,
      context_proof: true,
      read_only: true,
      no_auto_apply: true,
      verdict_required: "approve",
      max_acceptable_risk_level: "medium"
    }
  };
}
__name(_buildContractMicrostepReference, "_buildContractMicrostepReference");
function _buildExecutorArtifactsReference(executor_artifacts) {
  const audit = executor_artifacts.audit;
  const details = audit.details && typeof audit.details === "object" ? audit.details : {};
  const constraints = details.constraints && typeof details.constraints === "object" ? details.constraints : {};
  const propose = executor_artifacts.propose || null;
  return {
    execution_id: typeof executor_artifacts.execution_id === "string" ? executor_artifacts.execution_id : null,
    target_worker: typeof executor_artifacts.target_worker_id === "string" ? executor_artifacts.target_worker_id : null,
    verdict: audit.verdict,
    risk_level: audit.risk_level,
    context_used: details.context_used === true,
    context_proof: details.context_proof ? "presente" : "ausente",
    read_only: constraints.read_only === true,
    no_auto_apply: constraints.no_auto_apply === true,
    blockers: Array.isArray(details.blockers) ? details.blockers : [],
    findings: Array.isArray(audit.findings) ? audit.findings : [],
    propose_ok: propose !== null ? propose.ok === true : null
  };
}
__name(_buildExecutorArtifactsReference, "_buildExecutorArtifactsReference");
function _buildExecutionCyclesReference(execution_cycles) {
  const cycles = (Array.isArray(execution_cycles) ? execution_cycles : []).map((c) => ({
    execution_id: (typeof c.execution_id === "string" ? c.execution_id : null) || (typeof c.micro_pr_id === "string" ? c.micro_pr_id : null) || null,
    micro_pr_id: typeof c.micro_pr_id === "string" ? c.micro_pr_id : null,
    task_id: typeof c.task_id === "string" ? c.task_id : null,
    status: typeof c.execution_status === "string" ? c.execution_status : null,
    started_at: typeof c.execution_started_at === "string" ? c.execution_started_at : null,
    finished_at: typeof c.execution_finished_at === "string" ? c.execution_finished_at : null,
    evidence: Array.isArray(c.execution_evidence) ? c.execution_evidence : []
  }));
  const successful = cycles.filter((c) => c.status === "success").length;
  const failed = cycles.filter((c) => c.status === "failed").length;
  return {
    cycles,
    total: cycles.length,
    successful,
    failed
  };
}
__name(_buildExecutionCyclesReference, "_buildExecutionCyclesReference");
function _checkExecutorConstraints(artifactsRef, microstepRef) {
  const unauthorized_items = [];
  const missing_items = [];
  if (!artifactsRef.context_used) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: context_used: false \u2014 sem prova de leitura do worker-alvo (viola\xE7\xE3o da cl\xE1usula L717)`
    );
  }
  if (artifactsRef.context_proof === "ausente") {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: context_proof: ausente \u2014 fingerprint/hash do worker-alvo n\xE3o fornecido (cl\xE1usula L717)`
    );
  }
  if (!artifactsRef.read_only) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: constraints.read_only: false \u2014 constraint imut\xE1vel violada`
    );
  }
  if (!artifactsRef.no_auto_apply) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: constraints.no_auto_apply: false \u2014 constraint imut\xE1vel violada`
    );
  }
  const scopeWorkers = microstepRef.target_workers;
  if (artifactsRef.target_worker && scopeWorkers.length > 0 && !scopeWorkers.includes(artifactsRef.target_worker)) {
    unauthorized_items.push(
      `microstep ${microstepRef.task_id}: target_worker "${artifactsRef.target_worker}" fora do escopo [${scopeWorkers.join(", ")}]`
    );
  }
  if (artifactsRef.verdict !== "approve") {
    missing_items.push(
      `microstep ${microstepRef.task_id}: verdict "approve" necess\xE1rio \u2014 executor retornou "${artifactsRef.verdict}"`
    );
  }
  if (artifactsRef.risk_level === "high") {
    missing_items.push(
      `microstep ${microstepRef.task_id}: risk_level aceit\xE1vel (low/medium) \u2014 executor reportou "${artifactsRef.risk_level}"`
    );
  }
  if (artifactsRef.blockers.length > 0) {
    const preview = artifactsRef.blockers.slice(0, 2).join(" | ");
    missing_items.push(
      `microstep ${microstepRef.task_id}: blockers: ${artifactsRef.blockers.length} presente(s) \u2014 ${preview}`
    );
  }
  return { missing_items, unauthorized_items };
}
__name(_checkExecutorConstraints, "_checkExecutorConstraints");
function _auditViaMicrostep(state, decomposition, microstep_id, executor_artifacts, execution_cycles) {
  const task = (decomposition.tasks || []).find((t) => t.id === microstep_id);
  if (!task) {
    return {
      contract_id: state.contract_id,
      audit_mode: AUDIT_MODE.MICROSTEP,
      microstep_id,
      execution_ids: _collectExecutionIds({ executor_artifacts, execution_cycles }),
      contract_microstep_reference: null,
      executor_artifacts_reference: _hasExecutorAuditArtifacts(executor_artifacts) ? _buildExecutorArtifactsReference(executor_artifacts) : null,
      execution_cycles_reference: _buildExecutionCyclesReference(execution_cycles),
      missing_items: [],
      unauthorized_items: [
        `microstep_id "${microstep_id}" n\xE3o existe na decomposi\xE7\xE3o do contrato "${state.contract_id}"`
      ],
      adherence_status: EXECUTION_ADHERENCE_STATUS.FORA,
      reason: `Microetapa "${microstep_id}" n\xE3o encontrada no contrato \u2014 sem identidade contratual v\xE1lida.`,
      next_action: "Verificar microstep_id e garantir que est\xE1 na decomposi\xE7\xE3o do contrato."
    };
  }
  const contractMicrostepRef = _buildContractMicrostepReference(state, decomposition, task);
  const executionCyclesRef = _buildExecutionCyclesReference(execution_cycles);
  const executionIds = _collectExecutionIds({ executor_artifacts, execution_cycles });
  let missing_items = [];
  let unauthorized_items = [];
  let adherence_status;
  let reason;
  let next_action;
  if (_hasExecutorAuditArtifacts(executor_artifacts)) {
    const artifactsRef = _buildExecutorArtifactsReference(executor_artifacts);
    const checked = _checkExecutorConstraints(artifactsRef, contractMicrostepRef);
    missing_items = checked.missing_items;
    unauthorized_items = checked.unauthorized_items;
    if (unauthorized_items.length > 0) {
      adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
      const violations = unauthorized_items.slice(0, 2).join("; ");
      reason = `Microetapa "${microstep_id}" fora do contrato \u2014 ${unauthorized_items.length} viola\xE7\xE3o(\xF5es) de cl\xE1usula imut\xE1vel: ${violations}.`;
      next_action = "Viola\xE7\xE3o de cl\xE1usula imut\xE1vel \u2014 n\xE3o carimbar; reexecutar /audit com prova de leitura v\xE1lida.";
    } else if (missing_items.length === 0) {
      adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
      reason = `Microetapa "${microstep_id}" aderente ao contrato \u2014 verdict: ${artifactsRef.verdict}, risk_level: ${artifactsRef.risk_level}, context_proof presente, todas as constraints imut\xE1veis confirmadas.`;
      next_action = "Microetapa aderente \u2014 pode carimbar no Deploy Worker e avan\xE7ar para a pr\xF3xima microetapa.";
    } else {
      adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
      const gaps = missing_items.slice(0, 2).join("; ");
      reason = `Microetapa "${microstep_id}" parcialmente desviada \u2014 ${missing_items.length} requisito(s) n\xE3o atendido(s): ${gaps}.`;
      next_action = "Revisar patch e reexecutar /audit at\xE9 obter verdict: approve sem blockers para esta microetapa.";
    }
    return {
      contract_id: state.contract_id,
      audit_mode: AUDIT_MODE.MICROSTEP,
      microstep_id,
      execution_ids: executionIds,
      contract_microstep_reference: contractMicrostepRef,
      executor_artifacts_reference: artifactsRef,
      execution_cycles_reference: executionCyclesRef,
      missing_items,
      unauthorized_items,
      adherence_status,
      reason,
      next_action
    };
  }
  const taskCompleted = AUDIT_TASK_DONE_STATUSES.includes(task.status);
  const dodNormalized = new Set(state.definition_of_done.map(_normalize));
  const taskInDoD = dodNormalized.has(_normalize(task.description || ""));
  if (!taskInDoD) {
    unauthorized_items.push(
      `microstep "${microstep_id}" (description: "${task.description}"): n\xE3o est\xE1 no Definition of Done do contrato`
    );
  }
  if (!taskCompleted) {
    missing_items.push(
      `microstep "${microstep_id}": task com status "${task.status}" \u2014 ainda n\xE3o completada`
    );
  }
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
    reason = `Microetapa "${microstep_id}" fora do contrato \u2014 descri\xE7\xE3o n\xE3o est\xE1 no Definition of Done.`;
    next_action = "Revisar decomposi\xE7\xE3o: microetapa deve mapear para um item do Definition of Done.";
  } else if (missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
    reason = `Microetapa "${microstep_id}" completada e aderente ao DoD do contrato (sem artefatos de /audit).`;
    next_action = "Task conclu\xEDda \u2014 avan\xE7ar para execu\xE7\xE3o de /audit para prova formal antes de carimbar.";
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
    reason = `Microetapa "${microstep_id}" em progresso \u2014 ainda n\xE3o conclu\xEDda.`;
    next_action = "Completar a microetapa e fornecer executor_artifacts com prova de /audit.";
  }
  return {
    contract_id: state.contract_id,
    audit_mode: AUDIT_MODE.MICROSTEP,
    microstep_id,
    execution_ids: executionIds,
    contract_microstep_reference: contractMicrostepRef,
    executor_artifacts_reference: null,
    execution_cycles_reference: executionCyclesRef,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action
  };
}
__name(_auditViaMicrostep, "_auditViaMicrostep");
function _auditViaExecutorArtifacts(state, executor_artifacts) {
  const audit = executor_artifacts.audit;
  const propose = executor_artifacts.propose || null;
  const execution_id = executor_artifacts.execution_id || null;
  const target_worker = typeof executor_artifacts.target_worker_id === "string" ? executor_artifacts.target_worker_id.trim() : null;
  const verdict = audit.verdict;
  const risk_level = audit.risk_level;
  const findings = Array.isArray(audit.findings) ? audit.findings : [];
  const details = audit.details && typeof audit.details === "object" ? audit.details : {};
  const constraints = details.constraints && typeof details.constraints === "object" ? details.constraints : {};
  const blockers = Array.isArray(details.blockers) ? details.blockers : [];
  const context_used = details.context_used === true;
  const context_proof = details.context_proof || null;
  const read_only = constraints.read_only === true;
  const no_auto_apply = constraints.no_auto_apply === true;
  const scope_workers = Array.isArray(state.scope && state.scope.workers) ? state.scope.workers : [];
  const contract_reference = {
    goal: state.goal || "",
    contracted_items: state.definition_of_done,
    required_constraints: {
      context_used: true,
      context_proof: true,
      read_only: true,
      no_auto_apply: true,
      verdict_required: "approve",
      max_acceptable_risk_level: "medium",
      scope_workers
    }
  };
  const implemented_reference = [
    `verdict: ${verdict}`,
    `risk_level: ${risk_level}`,
    `context_used: ${context_used}`,
    `context_proof: ${context_proof ? "presente" : "ausente"}`,
    `constraints.read_only: ${read_only}`,
    `constraints.no_auto_apply: ${no_auto_apply}`,
    `blockers: ${blockers.length} item(s)`
  ];
  if (execution_id) implemented_reference.push(`execution_id: ${execution_id}`);
  if (target_worker) implemented_reference.push(`target_worker: ${target_worker}`);
  if (propose) implemented_reference.push(`propose: ok=${propose.ok === true}`);
  const unauthorized_items = [];
  if (!context_used) {
    unauthorized_items.push("context_used: false \u2014 execu\xE7\xE3o sem prova de leitura do worker-alvo (viola\xE7\xE3o da cl\xE1usula L717)");
  }
  if (!context_proof) {
    unauthorized_items.push("context_proof: ausente \u2014 fingerprint/hash do worker-alvo n\xE3o fornecido (cl\xE1usula L717 exige prova m\xEDnima)");
  }
  if (!read_only) {
    unauthorized_items.push("constraints.read_only: false \u2014 constraint imut\xE1vel do /audit violada (n\xE3o pode ser false)");
  }
  if (!no_auto_apply) {
    unauthorized_items.push("constraints.no_auto_apply: false \u2014 constraint imut\xE1vel do /audit violada (n\xE3o pode ser false)");
  }
  if (target_worker && scope_workers.length > 0 && !scope_workers.includes(target_worker)) {
    unauthorized_items.push(`target_worker: "${target_worker}" fora do escopo contratual [${scope_workers.join(", ")}]`);
  }
  const missing_items = [];
  if (verdict !== "approve") {
    missing_items.push(`verdict: "approve" \u2014 patch rejeitado pelo /audit (${verdict}); revis\xE3o necess\xE1ria antes de prosseguir`);
  }
  if (risk_level === "high") {
    missing_items.push(`risk_level: aceit\xE1vel (low/medium) \u2014 risco alto detectado (${risk_level}); patch precisa ser revisado`);
  }
  if (blockers.length > 0) {
    missing_items.push(`blockers: 0 esperado, ${blockers.length} presente(s) \u2014 ${blockers.slice(0, 3).join(" | ")}`);
  }
  let adherence_status;
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }
  let reason;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    reason = `Artefatos do executor aderentes ao contrato \u2014 verdict: ${verdict}, risk_level: ${risk_level}, context_used: true, context_proof presente, todas as constraints imut\xE1veis confirmadas.`;
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    reason = `Execu\xE7\xE3o fora do contrato \u2014 ${unauthorized_items.length} viola\xE7\xE3o(\xF5es) de cl\xE1usula imut\xE1vel: ${unauthorized_items.slice(0, 2).join("; ")}.`;
  } else {
    reason = `Execu\xE7\xE3o parcialmente desviada \u2014 ${missing_items.length} requisito(s) contratual(is) n\xE3o atingido(s): ${missing_items.slice(0, 2).join("; ")}.`;
  }
  let next_action;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    next_action = "Artefatos do executor aderentes \u2014 pode carimbar no Deploy Worker e prosseguir.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    next_action = "Viola\xE7\xE3o de cl\xE1usula imut\xE1vel \u2014 n\xE3o carimbar; revisar e reexecutar /audit com prova de leitura v\xE1lida.";
  } else {
    next_action = "Revisar patch e reexecutar /audit at\xE9 obter verdict: approve sem blockers.";
  }
  return {
    contract_id: state.contract_id,
    audit_mode: AUDIT_MODE.EXECUTOR_ARTIFACTS,
    microstep_id: null,
    execution_ids: execution_id ? [execution_id] : [],
    contract_reference,
    implemented_reference,
    execution_cycles_reference: null,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action
  };
}
__name(_auditViaExecutorArtifacts, "_auditViaExecutorArtifacts");
function _auditViaTaskDecomposition(state, decomposition) {
  const contracted_items = state.definition_of_done;
  const contracted_normalized = new Set(contracted_items.map(_normalize));
  const tasks = decomposition.tasks;
  const completed_tasks = tasks.filter((t) => AUDIT_TASK_DONE_STATUSES.includes(t.status));
  const incomplete_tasks = tasks.filter((t) => !AUDIT_TASK_DONE_STATUSES.includes(t.status));
  const implemented_reference = completed_tasks.map((t) => t.description || t.id);
  const missing_items = incomplete_tasks.map((t) => t.description || t.id);
  const unauthorized_items = completed_tasks.filter((t) => !contracted_normalized.has(_normalize(t.description || ""))).map((t) => t.description || t.id);
  let adherence_status;
  if (unauthorized_items.length > 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.FORA;
  } else if (contracted_items.length > 0 && missing_items.length === 0) {
    adherence_status = EXECUTION_ADHERENCE_STATUS.ADERENTE;
  } else {
    adherence_status = EXECUTION_ADHERENCE_STATUS.PARCIAL;
  }
  let reason;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    reason = "Execu\xE7\xE3o aderente ao contrato \u2014 todos os itens contratados foram implementados sem entradas n\xE3o autorizadas.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    const items = unauthorized_items.map((i) => `"${i}"`).join(", ");
    reason = `Execu\xE7\xE3o fora do contrato \u2014 ${unauthorized_items.length} task(s) conclu\xEDda(s) fora do Definition of Done: ${items}.`;
  } else {
    reason = `Execu\xE7\xE3o parcialmente desviada \u2014 ${missing_items.length} item(ns) contratado(s) n\xE3o implementado(s).`;
  }
  let next_action;
  if (adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
    next_action = "Decomposi\xE7\xE3o de tasks aderente \u2014 pode avan\xE7ar para /audit com os artefatos do executor.";
  } else if (adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
    next_action = "Tasks fora do DoD detectadas \u2014 revisar decomposi\xE7\xE3o antes de executar /audit.";
  } else {
    next_action = "Tasks incompletas \u2014 completar os itens faltantes antes de avan\xE7ar.";
  }
  return {
    contract_id: state.contract_id,
    audit_mode: AUDIT_MODE.TASK_DECOMPOSITION,
    microstep_id: null,
    execution_ids: [],
    contract_reference: {
      goal: state.goal || "",
      contracted_items
    },
    implemented_reference,
    execution_cycles_reference: null,
    missing_items,
    unauthorized_items,
    adherence_status,
    reason,
    next_action
  };
}
__name(_auditViaTaskDecomposition, "_auditViaTaskDecomposition");
function auditExecution({ state, decomposition, microstep_id, executor_artifacts, execution_cycles } = {}) {
  _validateState(state, "auditExecution");
  _validateDecomposition(decomposition, "auditExecution");
  if (typeof microstep_id === "string" && microstep_id.trim() !== "") {
    return _auditViaMicrostep(
      state,
      decomposition,
      microstep_id.trim(),
      executor_artifacts || null,
      execution_cycles || []
    );
  }
  if (_hasExecutorAuditArtifacts(executor_artifacts)) {
    return _auditViaExecutorArtifacts(state, executor_artifacts);
  }
  return _auditViaTaskDecomposition(state, decomposition);
}
__name(auditExecution, "auditExecution");

// schema/contract-final-audit.js
var CONTRACT_FINAL_STATUS = {
  ADERENTE: "contrato_aderente",
  PARCIAL: "contrato_parcial_desviado",
  FORA: "contrato_fora_do_contrato"
};
var FINAL_TASK_DONE_STATUSES = ["done", "merged", "completed", "skipped"];
function _normalize2(str) {
  return typeof str === "string" ? str.trim().toLowerCase() : "";
}
__name(_normalize2, "_normalize");
function _validateState2(state, fnName) {
  if (!state || typeof state !== "object") {
    throw new Error(`${fnName}: 'state' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof state.contract_id !== "string" || state.contract_id.trim() === "") {
    throw new Error(`${fnName}: 'state.contract_id' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia`);
  }
  if (!Array.isArray(state.definition_of_done)) {
    throw new Error(`${fnName}: 'state.definition_of_done' \xE9 obrigat\xF3rio e deve ser array`);
  }
}
__name(_validateState2, "_validateState");
function _validateDecomposition2(decomposition, fnName) {
  if (!decomposition || typeof decomposition !== "object") {
    throw new Error(`${fnName}: 'decomposition' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (!Array.isArray(decomposition.tasks)) {
    throw new Error(`${fnName}: 'decomposition.tasks' \xE9 obrigat\xF3rio e deve ser array`);
  }
}
__name(_validateDecomposition2, "_validateDecomposition");
function _getCyclesFromLog(state, taskId) {
  const log = state.task_execution_log;
  if (!log || typeof log !== "object") return [];
  const cycles = log[taskId];
  return Array.isArray(cycles) ? cycles : [];
}
__name(_getCyclesFromLog, "_getCyclesFromLog");
function _resolveExecutorArtifactsFromCycles(cycles) {
  if (!Array.isArray(cycles) || cycles.length === 0) return null;
  for (let i = cycles.length - 1; i >= 0; i--) {
    const cycle = cycles[i];
    if (cycle && cycle.executor_artifacts && typeof cycle.executor_artifacts === "object") {
      return cycle.executor_artifacts;
    }
  }
  return null;
}
__name(_resolveExecutorArtifactsFromCycles, "_resolveExecutorArtifactsFromCycles");
function _buildFinalReason({
  final_adherence_status,
  missing_items,
  partial_microsteps,
  out_of_contract_microsteps,
  evidence_sufficiency
}) {
  if (final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE) {
    return "Contrato aderente \u2014 todos os itens contratuais cobertos, microetapas auditadas pela PR 2 e aderentes ao contrato.";
  }
  const reasons = [];
  if (out_of_contract_microsteps.length > 0) {
    reasons.push(
      `${out_of_contract_microsteps.length} microetapa(s) conclu\xEDda(s) fora do contrato (n\xE3o mapeiam o DoD ou viola\xE7\xE3o fatal na PR 2): ${out_of_contract_microsteps.join(", ")}`
    );
  }
  if (missing_items.length > 0) {
    reasons.push(
      `${missing_items.length} item(ns) do definition_of_done n\xE3o coberto(s) por nenhuma microetapa conclu\xEDda: ${missing_items.join(" | ")}`
    );
  }
  if (partial_microsteps.length > 0) {
    reasons.push(
      `${partial_microsteps.length} microetapa(s) com auditoria PR 2 parcial/desviada: ${partial_microsteps.join(", ")}`
    );
  }
  if (!evidence_sufficiency) {
    reasons.push("Evid\xEAncia insuficiente \u2014 nem todas as microetapas passaram na auditoria PR 2 como aderentes ao contrato.");
  }
  const prefix = final_adherence_status === CONTRACT_FINAL_STATUS.FORA ? "Contrato fora do contrato \u2014 desvio fatal detectado." : "Contrato parcialmente desviado \u2014 nem todos os requisitos contratuais foram atendidos.";
  return `${prefix} ${reasons.join(" | ")}`;
}
__name(_buildFinalReason, "_buildFinalReason");
function _buildFinalNextAction(final_adherence_status) {
  const actions = {
    [CONTRACT_FINAL_STATUS.ADERENTE]: "Contrato aderente ao conjunto contratual \u2014 pode ser marcado como conclu\xEDdo.",
    [CONTRACT_FINAL_STATUS.PARCIAL]: "Contrato parcialmente desviado \u2014 revisar itens faltantes e microetapas com auditoria PR 2 n\xE3o aderente antes de fechar.",
    [CONTRACT_FINAL_STATUS.FORA]: "Contrato fora do contrato \u2014 n\xE3o fechar; revisar microetapas fora do DoD ou com viola\xE7\xE3o fatal na auditoria PR 2."
  };
  return actions[final_adherence_status] || "Estado desconhecido \u2014 n\xE3o fechar o contrato.";
}
__name(_buildFinalNextAction, "_buildFinalNextAction");
function auditFinalContract({ state, decomposition } = {}) {
  _validateState2(state, "auditFinalContract");
  _validateDecomposition2(decomposition, "auditFinalContract");
  const dod = state.definition_of_done;
  const tasks = decomposition.tasks || [];
  const dodNormalized = new Set(dod.map(_normalize2));
  const doneTasks = tasks.filter((t) => FINAL_TASK_DONE_STATUSES.includes(t.status));
  const completed_microsteps = doneTasks.map((t) => t.id);
  const adherent_microsteps = [];
  const partial_microsteps = [];
  const out_of_contract_microsteps = [];
  const unauthorized_items = [];
  const microstep_pr2_audits = {};
  for (const task of doneTasks) {
    const taskDescNorm = _normalize2(task.description);
    const matchesDod = dodNormalized.has(taskDescNorm);
    if (!matchesDod) {
      out_of_contract_microsteps.push(task.id);
      unauthorized_items.push(task.description || task.id);
      continue;
    }
    const cycles = _getCyclesFromLog(state, task.id);
    const executor_artifacts = _resolveExecutorArtifactsFromCycles(cycles);
    const pr2Audit = auditExecution({
      state,
      decomposition,
      microstep_id: task.id,
      executor_artifacts: executor_artifacts || null,
      execution_cycles: cycles
    });
    microstep_pr2_audits[task.id] = {
      adherence_status: pr2Audit.adherence_status,
      audit_mode: pr2Audit.audit_mode,
      reason: pr2Audit.reason
    };
    if (pr2Audit.adherence_status === EXECUTION_ADHERENCE_STATUS.ADERENTE) {
      adherent_microsteps.push(task.id);
    } else if (pr2Audit.adherence_status === EXECUTION_ADHERENCE_STATUS.FORA) {
      out_of_contract_microsteps.push(task.id);
      unauthorized_items.push(task.description || task.id);
    } else {
      partial_microsteps.push(task.id);
    }
  }
  const doneTaskDescNorms = new Set(doneTasks.map((t) => _normalize2(t.description)));
  const missing_items = dod.filter((item) => !doneTaskDescNorms.has(_normalize2(item)));
  const dodMatchedDoneTasks = doneTasks.filter(
    (t) => dodNormalized.has(_normalize2(t.description))
  );
  let evidence_sufficiency;
  if (dod.length === 0) {
    evidence_sufficiency = true;
  } else if (dodMatchedDoneTasks.length === 0) {
    evidence_sufficiency = false;
  } else {
    evidence_sufficiency = dodMatchedDoneTasks.every(
      (t) => adherent_microsteps.includes(t.id)
    );
  }
  let final_adherence_status;
  if (out_of_contract_microsteps.length > 0) {
    final_adherence_status = CONTRACT_FINAL_STATUS.FORA;
  } else if (missing_items.length === 0 && partial_microsteps.length === 0 && evidence_sufficiency) {
    final_adherence_status = CONTRACT_FINAL_STATUS.ADERENTE;
  } else {
    final_adherence_status = CONTRACT_FINAL_STATUS.PARCIAL;
  }
  const can_close_contract = final_adherence_status === CONTRACT_FINAL_STATUS.ADERENTE;
  const final_reason = _buildFinalReason({
    final_adherence_status,
    missing_items,
    partial_microsteps,
    out_of_contract_microsteps,
    evidence_sufficiency
  });
  const final_next_action = _buildFinalNextAction(final_adherence_status);
  return {
    contract_id: state.contract_id,
    final_adherence_status,
    completed_microsteps,
    adherent_microsteps,
    partial_microsteps,
    out_of_contract_microsteps,
    missing_items,
    unauthorized_items,
    evidence_sufficiency,
    microstep_pr2_audits,
    final_reason,
    final_next_action,
    can_close_contract
  };
}
__name(auditFinalContract, "auditFinalContract");

// schema/autonomy-contract.js
var ENVIRONMENT = {
  TEST: "TEST",
  PROD: "PROD"
};
var AUTONOMY_LEVEL = {
  AUTONOMOUS: "autonomous",
  // ação permitida sem novo OK
  REQUIRES_HUMAN: "requires_human_ok",
  // exige OK humano explícito
  PROHIBITED: "prohibited"
  // proibido em qualquer circunstância
};
var PRE_EXECUTION_ACTIONS = [
  "read",
  "read_only_diagnostic",
  "classify",
  "build_plan",
  "query_memory",
  "query_health",
  "query_execution_state",
  "prepare_payload"
];
var POST_START_AUTONOMOUS_ACTIONS = [
  "execute_in_test_within_scope",
  "reexecute_in_test_within_scope",
  "internal_loop_until_objective_done",
  "operate_external_service_in_test_within_scope"
];
var ALLOWED_ACTIONS = [
  ...PRE_EXECUTION_ACTIONS,
  ...POST_START_AUTONOMOUS_ACTIONS
];
var HUMAN_OK_REQUIRED_ACTIONS = [
  "start_plan_execution",
  "start_contract_execution",
  "start_task_execution",
  "promote_to_prod",
  "act_on_undefined_external_service",
  "change_scope"
];
var PROHIBITED_ACTIONS = [
  "exit_scope",
  "regress_contract",
  "regress_plan",
  "regress_task",
  "modify_observability",
  "promote_to_prod_without_human_ok",
  "act_with_scope_conflict",
  "continue_after_repeated_failure_without_escalation",
  "act_without_sufficient_evidence_when_promotion_depends_on_it"
];
var REQUIRED_GATES = [
  "scope_defined",
  "environment_defined",
  "risk_assessed",
  "authorization_present_when_required",
  "observability_preserved",
  "evidence_available_when_required"
];
var FAILURE_POLICY = {
  max_retries: 3,
  min_retries: 2,
  action_on_max_retries: "block_and_escalate_to_human",
  high_risk_policy: "report_before_execution",
  insufficient_evidence_policy: "block_and_escalate_with_reason"
};
function classifyAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyAction: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  const a = action.trim();
  if (ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      reason: `A\xE7\xE3o '${a}' \xE9 permitida sem novo OK humano ap\xF3s in\xEDcio aprovado.`
    };
  }
  if (HUMAN_OK_REQUIRED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: `A\xE7\xE3o '${a}' exige OK humano expl\xEDcito antes de execu\xE7\xE3o.`
    };
  }
  if (PROHIBITED_ACTIONS.includes(a)) {
    return {
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      reason: `A\xE7\xE3o '${a}' \xE9 proibida incondicionalmente pelo contrato de autonomia.`
    };
  }
  return {
    action: a,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    reason: `A\xE7\xE3o '${a}' n\xE3o catalogada no contrato \u2014 requer OK humano por cautela.`
  };
}
__name(classifyAction, "classifyAction");
function evaluateGates(context) {
  if (!context || typeof context !== "object") {
    throw new Error("evaluateGates: 'context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  const gates = {};
  const failed_gates = [];
  for (const gate of REQUIRED_GATES) {
    const value = context[gate];
    const passed = value === true;
    const reason2 = passed ? `Gate '${gate}' passou.` : `Gate '${gate}' falhou \u2014 condi\xE7\xE3o n\xE3o satisfeita.`;
    gates[gate] = { passed, reason: reason2 };
    if (!passed) {
      failed_gates.push(gate);
    }
  }
  const all_gates_passed = failed_gates.length === 0;
  const reason = all_gates_passed ? "Todos os gates obrigat\xF3rios passaram \u2014 a\xE7\xE3o sens\xEDvel permitida." : `${failed_gates.length} gate(s) falhou(aram): ${failed_gates.join(", ")}. A\xE7\xE3o sens\xEDvel bloqueada.`;
  return {
    all_gates_passed,
    gates,
    failed_gates,
    can_proceed: all_gates_passed,
    reason
  };
}
__name(evaluateGates, "evaluateGates");
function evaluateFailurePolicy({ attempt, is_high_risk, has_sufficient_evidence } = {}) {
  if (typeof attempt !== "number" || attempt < 1) {
    throw new Error("evaluateFailurePolicy: 'attempt' \xE9 obrigat\xF3rio e deve ser number >= 1");
  }
  if (typeof is_high_risk !== "boolean") {
    throw new Error("evaluateFailurePolicy: 'is_high_risk' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  if (typeof has_sufficient_evidence !== "boolean") {
    throw new Error("evaluateFailurePolicy: 'has_sufficient_evidence' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  if (is_high_risk) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: "Risco alto detectado \u2014 execu\xE7\xE3o bloqueada at\xE9 reporte e autoriza\xE7\xE3o humana.",
      escalation_type: "high_risk"
    };
  }
  if (!has_sufficient_evidence) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: "Evid\xEAncia insuficiente para promo\xE7\xE3o \u2014 bloqueio expl\xEDcito e chamada ao usu\xE1rio com motivo.",
      escalation_type: "insufficient_evidence"
    };
  }
  if (attempt > FAILURE_POLICY.max_retries) {
    return {
      can_continue: false,
      must_escalate: true,
      reason: `Tentativa ${attempt} excede o m\xE1ximo de ${FAILURE_POLICY.max_retries} retries \u2014 bloqueio e escalonamento ao usu\xE1rio.`,
      escalation_type: "max_retries"
    };
  }
  return {
    can_continue: true,
    must_escalate: false,
    reason: `Tentativa ${attempt} de ${FAILURE_POLICY.max_retries} \u2014 pode continuar.`,
    escalation_type: "none"
  };
}
__name(evaluateFailurePolicy, "evaluateFailurePolicy");
function evaluateEnvironmentAutonomy({ environment, action, scope_approved } = {}) {
  if (typeof environment !== "string" || !Object.values(ENVIRONMENT).includes(environment)) {
    throw new Error(
      `evaluateEnvironmentAutonomy: 'environment' deve ser "${ENVIRONMENT.TEST}" ou "${ENVIRONMENT.PROD}"`
    );
  }
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("evaluateEnvironmentAutonomy: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("evaluateEnvironmentAutonomy: 'scope_approved' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  const a = action.trim();
  if (!scope_approved) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      can_proceed: false,
      reason: `A\xE7\xE3o '${a}' fora do escopo aprovado \u2014 proibida em ${environment}.`
    };
  }
  if (PROHIBITED_ACTIONS.includes(a)) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      can_proceed: false,
      reason: `A\xE7\xE3o '${a}' \xE9 proibida incondicionalmente pelo contrato de autonomia.`
    };
  }
  if (environment === ENVIRONMENT.TEST) {
    const always_requires_human = [
      "start_plan_execution",
      "start_contract_execution",
      "start_task_execution",
      "promote_to_prod",
      "act_on_undefined_external_service",
      "change_scope"
    ];
    if (always_requires_human.includes(a)) {
      return {
        environment,
        action: a,
        autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
        can_proceed: false,
        reason: `A\xE7\xE3o '${a}' exige OK humano mesmo em TEST \u2014 \xE9 uma a\xE7\xE3o de governan\xE7a.`
      };
    }
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      can_proceed: true,
      reason: `A\xE7\xE3o '${a}' permitida em TEST dentro do escopo aprovado \u2014 autonomia total.`
    };
  }
  if (ALLOWED_ACTIONS.includes(a)) {
    return {
      environment,
      action: a,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      can_proceed: true,
      reason: `A\xE7\xE3o '${a}' \xE9 uma opera\xE7\xE3o de leitura/diagn\xF3stico \u2014 permitida em PROD.`
    };
  }
  return {
    environment,
    action: a,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    can_proceed: false,
    reason: `A\xE7\xE3o '${a}' em PROD requer OK humano expl\xEDcito.`
  };
}
__name(evaluateEnvironmentAutonomy, "evaluateEnvironmentAutonomy");
function validateSpecialistArmCompliance({ arm_id, action, gates_context } = {}) {
  if (typeof arm_id !== "string" || arm_id.trim() === "") {
    throw new Error("validateSpecialistArmCompliance: 'arm_id' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("validateSpecialistArmCompliance: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("validateSpecialistArmCompliance: 'gates_context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  const action_classification = classifyAction(action);
  const gates_evaluation = evaluateGates(gates_context);
  if (action_classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      arm_id: arm_id.trim(),
      action: action.trim(),
      action_classification,
      gates_evaluation,
      is_compliant: false,
      reason: `Bra\xE7o '${arm_id.trim()}' tentou a\xE7\xE3o proibida '${action.trim()}' \u2014 bloqueado pelo contrato de autonomia.`
    };
  }
  if (!gates_evaluation.all_gates_passed) {
    return {
      arm_id: arm_id.trim(),
      action: action.trim(),
      action_classification,
      gates_evaluation,
      is_compliant: false,
      reason: `Bra\xE7o '${arm_id.trim()}' bloqueado: gates obrigat\xF3rios n\xE3o passaram para a\xE7\xE3o '${action.trim()}'.`
    };
  }
  return {
    arm_id: arm_id.trim(),
    action: action.trim(),
    action_classification,
    gates_evaluation,
    is_compliant: true,
    reason: `Bra\xE7o '${arm_id.trim()}' em conformidade com o contrato de autonomia para a\xE7\xE3o '${action.trim()}'.`
  };
}
__name(validateSpecialistArmCompliance, "validateSpecialistArmCompliance");
function enforceConstitution({ action, environment, scope_approved, gates_context } = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("enforceConstitution: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (typeof environment !== "string" || !Object.values(ENVIRONMENT).includes(environment)) {
    throw new Error(
      `enforceConstitution: 'environment' deve ser "${ENVIRONMENT.TEST}" ou "${ENVIRONMENT.PROD}"`
    );
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("enforceConstitution: 'scope_approved' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("enforceConstitution: 'gates_context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  const a = action.trim();
  const classification = classifyAction(a);
  if (classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      allowed: false,
      blocked: true,
      level: AUTONOMY_LEVEL.PROHIBITED,
      reason: classification.reason,
      classification,
      gates: null,
      environment_check: null
    };
  }
  const gates = evaluateGates(gates_context);
  if (!gates.all_gates_passed) {
    return {
      allowed: false,
      blocked: true,
      level: "blocked_by_gates",
      reason: gates.reason,
      classification,
      gates,
      environment_check: null
    };
  }
  const environment_check = evaluateEnvironmentAutonomy({ environment, action: a, scope_approved });
  if (!environment_check.can_proceed) {
    return {
      allowed: false,
      blocked: true,
      level: environment_check.autonomy_level,
      reason: environment_check.reason,
      classification,
      gates,
      environment_check
    };
  }
  return {
    allowed: true,
    blocked: false,
    level: classification.autonomy_level,
    reason: `Constitui\xE7\xE3o OK: a\xE7\xE3o '${a}' permitida \u2014 classifica\xE7\xE3o=${classification.autonomy_level}, gates=passed, ambiente=${environment}, escopo=aprovado.`,
    classification,
    gates,
    environment_check
  };
}
__name(enforceConstitution, "enforceConstitution");

// schema/github-pr-arm-contract.js
var GITHUB_PR_ARM_ID = "p24_github_pr_arm";
var PRE_MERGE_ALLOWED_ACTIONS = [
  "open_branch",
  "open_pr",
  "update_pr",
  "comment_pr",
  "review_diff",
  "audit_pr",
  "request_correction",
  "self_correct_pr",
  "organize_repo_within_scope"
];
var FORMAL_APPROVAL_REQUIRED_ACTIONS = [
  "merge_to_main"
];
var PROHIBITED_ACTIONS_P24 = [
  "regress_contract",
  "regress_plan",
  "regress_task",
  "regress_pr",
  "ignore_diff",
  "ignore_summary",
  "generate_drift",
  "act_outside_scope",
  "deviate_contract_without_escalation",
  "mix_cloudflare_executor_with_github_arm",
  "create_new_repo",
  "merge_without_summary",
  "merge_without_reason",
  "merge_without_approval",
  "silent_merge"
];
var MERGE_STATUS = {
  NOT_READY: "not_ready",
  AWAITING_APPROVAL: "awaiting_formal_approval",
  APPROVED: "approved_for_merge",
  MERGED: "merged",
  BLOCKED: "blocked"
};
function classifyGitHubPrAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyGitHubPrAction: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  const a = action.trim();
  if (PRE_MERGE_ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      reason: `A\xE7\xE3o '${a}' \xE9 permitida pelo bra\xE7o GitHub/PR antes do merge, dentro do escopo aprovado.`
    };
  }
  if (FORMAL_APPROVAL_REQUIRED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: `A\xE7\xE3o '${a}' exige approval formal \u2014 n\xE3o pode ser executada sem autoriza\xE7\xE3o humana.`
    };
  }
  if (PROHIBITED_ACTIONS_P24.includes(a)) {
    return {
      action: a,
      arm_id: GITHUB_PR_ARM_ID,
      belongs_to_github_arm: true,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      reason: `A\xE7\xE3o '${a}' \xE9 proibida incondicionalmente pelo contrato do bra\xE7o GitHub/PR.`
    };
  }
  return {
    action: a,
    arm_id: GITHUB_PR_ARM_ID,
    belongs_to_github_arm: false,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    reason: `A\xE7\xE3o '${a}' n\xE3o pertence ao cat\xE1logo do bra\xE7o GitHub/PR \u2014 requer OK humano por cautela.`
  };
}
__name(classifyGitHubPrAction, "classifyGitHubPrAction");
function evaluateMergeReadiness(context) {
  if (!context || typeof context !== "object") {
    throw new Error("evaluateMergeReadiness: 'context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  const gates = {};
  const failed_gates = [];
  const booleanGates = [
    "contract_rechecked",
    "phase_validated",
    "no_regression",
    "diff_reviewed",
    "summary_reviewed"
  ];
  for (const gate of booleanGates) {
    const value = context[gate];
    const passed = value === true;
    gates[gate] = {
      passed,
      reason: passed ? `Gate '${gate}' passou.` : `Gate '${gate}' falhou \u2014 condi\xE7\xE3o n\xE3o satisfeita.`
    };
    if (!passed) failed_gates.push(gate);
  }
  const summary_for_merge = typeof context.summary_for_merge === "string" ? context.summary_for_merge.trim() : "";
  const reason_merge_ok = typeof context.reason_merge_ok === "string" ? context.reason_merge_ok.trim() : "";
  const summaryPresent = summary_for_merge.length > 0;
  gates.summary_for_merge_present = {
    passed: summaryPresent,
    reason: summaryPresent ? "Resumo para merge presente." : "Resumo para merge ausente \u2014 \xE9 obrigat\xF3rio informar o que foi feito antes do merge."
  };
  if (!summaryPresent) failed_gates.push("summary_for_merge_present");
  const reasonPresent = reason_merge_ok.length > 0;
  gates.reason_merge_ok_present = {
    passed: reasonPresent,
    reason: reasonPresent ? "Explica\xE7\xE3o curta do porqu\xEA est\xE1 ok presente." : "Explica\xE7\xE3o curta ausente \u2014 \xE9 obrigat\xF3rio informar porqu\xEA a PR pode ser mergeada."
  };
  if (!reasonPresent) failed_gates.push("reason_merge_ok_present");
  const is_ready = failed_gates.length === 0;
  return {
    is_ready,
    failed_gates,
    gates,
    summary_for_merge: summaryPresent ? summary_for_merge : null,
    reason_merge_ok: reasonPresent ? reason_merge_ok : null,
    reason: is_ready ? "Todas as condi\xE7\xF5es de merge readiness passaram \u2014 PR pode ser marcada como apta para merge." : `${failed_gates.length} condi\xE7\xE3o(\xF5es) falhou(aram): ${failed_gates.join(", ")}. PR N\xC3O est\xE1 apta para merge.`
  };
}
__name(evaluateMergeReadiness, "evaluateMergeReadiness");
var VALID_APPROVAL_STATUSES = ["none", "pending", "approved", "rejected"];
function buildMergeGateState({ merge_readiness, approval_status } = {}) {
  if (!merge_readiness || typeof merge_readiness !== "object") {
    throw new Error("buildMergeGateState: 'merge_readiness' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  if (typeof approval_status !== "string" || !VALID_APPROVAL_STATUSES.includes(approval_status)) {
    throw new Error(
      `buildMergeGateState: 'approval_status' deve ser um de: ${VALID_APPROVAL_STATUSES.join(", ")}`
    );
  }
  if (!merge_readiness.is_ready) {
    return {
      merge_status: MERGE_STATUS.NOT_READY,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: `PR n\xE3o est\xE1 apta: ${merge_readiness.reason}`
    };
  }
  if (approval_status === "rejected") {
    return {
      merge_status: MERGE_STATUS.BLOCKED,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: "PR bloqueada: approval formal foi rejeitado."
    };
  }
  if (approval_status === "none" || approval_status === "pending") {
    return {
      merge_status: MERGE_STATUS.AWAITING_APPROVAL,
      summary_for_merge: merge_readiness.summary_for_merge,
      reason_merge_ok: merge_readiness.reason_merge_ok,
      approval_status,
      can_merge: false,
      reason: "PR apta para merge \u2014 aguardando approval formal para merge em main."
    };
  }
  return {
    merge_status: MERGE_STATUS.APPROVED,
    summary_for_merge: merge_readiness.summary_for_merge,
    reason_merge_ok: merge_readiness.reason_merge_ok,
    approval_status,
    can_merge: true,
    reason: "PR aprovada para merge em main \u2014 approval formal recebido."
  };
}
__name(buildMergeGateState, "buildMergeGateState");
function enforceGitHubPrArm({
  action,
  scope_approved,
  gates_context,
  merge_context = null,
  drift_detected = false,
  regression_detected = false
} = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("enforceGitHubPrArm: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'scope_approved' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("enforceGitHubPrArm: 'gates_context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  if (typeof drift_detected !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'drift_detected' deve ser boolean");
  }
  if (typeof regression_detected !== "boolean") {
    throw new Error("enforceGitHubPrArm: 'regression_detected' deve ser boolean");
  }
  const a = action.trim();
  const classification = classifyGitHubPrAction(a);
  if (classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.PROHIBITED,
      reason: classification.reason,
      classification,
      p23_compliance: null,
      merge_gate: null
    };
  }
  if (!classification.belongs_to_github_arm) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_not_github_arm",
      reason: `A\xE7\xE3o '${a}' n\xE3o pertence ao bra\xE7o GitHub/PR \u2014 bloqueada. N\xE3o misturar com executor Cloudflare ou outros bra\xE7os.`,
      classification,
      p23_compliance: null,
      merge_gate: null
    };
  }
  if (!scope_approved) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_out_of_scope",
      reason: `A\xE7\xE3o '${a}' fora do escopo aprovado \u2014 bra\xE7o GitHub/PR n\xE3o pode agir fora do escopo.`,
      classification,
      p23_compliance: null,
      merge_gate: null
    };
  }
  if (drift_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_drift_detected",
      reason: `Drift detectado \u2014 bra\xE7o GitHub/PR bloqueado. \xC9 proibido gerar ou aceitar drift.`,
      classification,
      p23_compliance: null,
      merge_gate: null
    };
  }
  if (regression_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_regression_detected",
      reason: `Regress\xE3o detectada \u2014 bra\xE7o GitHub/PR bloqueado. \xC9 proibido permitir regress\xE3o.`,
      classification,
      p23_compliance: null,
      merge_gate: null
    };
  }
  const p23_compliance = validateSpecialistArmCompliance({
    arm_id: GITHUB_PR_ARM_ID,
    action: a,
    gates_context
  });
  if (!p23_compliance.is_compliant) {
    return {
      allowed: false,
      blocked: true,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: "blocked_p23_noncompliant",
      reason: p23_compliance.reason,
      classification,
      p23_compliance,
      merge_gate: null
    };
  }
  if (FORMAL_APPROVAL_REQUIRED_ACTIONS.includes(a)) {
    if (!merge_context || typeof merge_context !== "object") {
      return {
        allowed: false,
        blocked: true,
        arm_id: GITHUB_PR_ARM_ID,
        action: a,
        level: "blocked_merge_context_missing",
        reason: `A\xE7\xE3o '${a}' exige merge_context com resumo, explica\xE7\xE3o e approval \u2014 n\xE3o fornecido.`,
        classification,
        p23_compliance,
        merge_gate: null
      };
    }
    const merge_readiness = evaluateMergeReadiness(merge_context);
    const approval_status = typeof merge_context.approval_status === "string" ? merge_context.approval_status : "none";
    const merge_gate = buildMergeGateState({ merge_readiness, approval_status });
    if (!merge_gate.can_merge) {
      return {
        allowed: false,
        blocked: true,
        arm_id: GITHUB_PR_ARM_ID,
        action: a,
        level: merge_gate.merge_status,
        reason: merge_gate.reason,
        classification,
        p23_compliance,
        merge_gate
      };
    }
    return {
      allowed: true,
      blocked: false,
      arm_id: GITHUB_PR_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
      reason: merge_gate.reason,
      classification,
      p23_compliance,
      merge_gate
    };
  }
  return {
    allowed: true,
    blocked: false,
    arm_id: GITHUB_PR_ARM_ID,
    action: a,
    level: classification.autonomy_level,
    reason: `Bra\xE7o GitHub/PR: a\xE7\xE3o '${a}' permitida \u2014 escopo aprovado, sem drift, sem regress\xE3o, P23 compliant.`,
    classification,
    p23_compliance,
    merge_gate: null
  };
}
__name(enforceGitHubPrArm, "enforceGitHubPrArm");

// schema/browser-arm-contract.js
var BROWSER_ARM_ID = "p25_browser_arm";
var BROWSER_EXTERNAL_BASE = {
  host: "run.nv-imoveis.com",
  pattern: "run.nv-imoveis.com/*",
  protocol: "https",
  base_url: "https://run.nv-imoveis.com",
  description: "Rota/base externa do Browser Arm \u2014 olhos externos da Enavia"
};
var BROWSER_ALLOWED_ACTIONS = [
  "open_page",
  "navigate",
  "click",
  "fill_form",
  "login",
  "read_visual_result",
  "search",
  "test_external_tool",
  "use_saved_credentials"
];
var BROWSER_CONDITIONAL_ACTIONS = [
  "upload",
  "publish",
  "delete",
  "expand_scope"
];
var CONDITIONAL_ACTION_RULES = {
  upload: {
    action: "upload",
    condition: "objective_requires",
    description: "Upload permitido somente quando necess\xE1rio ao objetivo vigente."
  },
  publish: {
    action: "publish",
    condition: "objective_requires",
    description: "Publica\xE7\xE3o permitida somente quando subordinada ao objetivo/contrato vigente."
  },
  delete: {
    action: "delete",
    condition: "justified_by_objective",
    description: "Exclus\xE3o s\xF3 com justificativa restrita ao objetivo vigente.",
    requires_justification: true
  },
  expand_scope: {
    action: "expand_scope",
    condition: "user_permission_required",
    description: "Expans\xE3o de escopo sempre exige sugest\xE3o ao usu\xE1rio + permiss\xE3o expl\xEDcita.",
    requires_user_permission: true
  }
};
var PROHIBITED_ACTIONS_P25 = [
  "exit_scope",
  "regress_contract",
  "regress_plan",
  "regress_task",
  "generate_drift",
  "act_outside_scope",
  "deviate_contract_without_escalation",
  "mix_cloudflare_executor_with_browser_arm",
  "mix_github_arm_with_browser_arm",
  "expand_scope_without_permission",
  "auto_expand_scope",
  "ignore_cost_limits",
  "delete_without_justification"
];
var SUGGESTION_SHAPE = {
  required_fields: [
    "type",
    // tipo da sugestão (tool, integration, capability, insight)
    "discovery",
    // o que foi encontrado
    "benefit",
    // por que ajuda
    "missing_requirement",
    // o que falta para usar (acesso, config, permissão)
    "expected_impact",
    // impacto esperado
    "permission_needed"
    // se precisa permissão do usuário (boolean)
  ],
  valid_types: [
    "tool",
    "integration",
    "capability",
    "insight",
    "optimization",
    "security_improvement"
  ]
};
function validateSuggestion(suggestion) {
  if (!suggestion || typeof suggestion !== "object") {
    return {
      valid: false,
      missing_fields: SUGGESTION_SHAPE.required_fields,
      reason: "Sugest\xE3o inv\xE1lida \u2014 deve ser um objeto com os campos obrigat\xF3rios."
    };
  }
  const missing = SUGGESTION_SHAPE.required_fields.filter(
    (f) => suggestion[f] === void 0 || suggestion[f] === null || suggestion[f] === ""
  );
  if (missing.length > 0) {
    return {
      valid: false,
      missing_fields: missing,
      reason: `Sugest\xE3o incompleta \u2014 campos faltantes: ${missing.join(", ")}.`
    };
  }
  if (!SUGGESTION_SHAPE.valid_types.includes(suggestion.type)) {
    return {
      valid: false,
      missing_fields: [],
      reason: `Tipo de sugest\xE3o inv\xE1lido: '${suggestion.type}'. Tipos v\xE1lidos: ${SUGGESTION_SHAPE.valid_types.join(", ")}.`
    };
  }
  return {
    valid: true,
    missing_fields: [],
    reason: "Sugest\xE3o v\xE1lida \u2014 todos os campos obrigat\xF3rios presentes e tipo v\xE1lido."
  };
}
__name(validateSuggestion, "validateSuggestion");
var BROWSER_ARM_STATE_SHAPE = {
  required_fields: [
    "arm_id",
    // BROWSER_ARM_ID
    "status",
    // idle | active | error | disabled
    "external_base",
    // BROWSER_EXTERNAL_BASE
    "last_action",
    // última ação executada (ou null)
    "last_action_ts"
    // timestamp da última ação (ou null)
  ],
  valid_statuses: [
    "idle",
    "active",
    "error",
    "disabled"
  ],
  initial_state: {
    arm_id: BROWSER_ARM_ID,
    status: "idle",
    external_base: BROWSER_EXTERNAL_BASE,
    last_action: null,
    last_action_ts: null
  }
};
function classifyBrowserArmAction(action) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("classifyBrowserArmAction: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  const a = action.trim();
  if (PROHIBITED_ACTIONS_P25.includes(a)) {
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: AUTONOMY_LEVEL.PROHIBITED,
      condition: null,
      reason: `A\xE7\xE3o '${a}' \xE9 proibida incondicionalmente pelo contrato do bra\xE7o Browser.`
    };
  }
  if (BROWSER_ALLOWED_ACTIONS.includes(a)) {
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: AUTONOMY_LEVEL.AUTONOMOUS,
      condition: null,
      reason: `A\xE7\xE3o '${a}' \xE9 permitida pelo bra\xE7o Browser dentro do escopo aprovado.`
    };
  }
  if (BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    const rule = CONDITIONAL_ACTION_RULES[a];
    return {
      action: a,
      arm_id: BROWSER_ARM_ID,
      belongs_to_browser_arm: true,
      autonomy_level: rule.requires_user_permission ? AUTONOMY_LEVEL.REQUIRES_HUMAN : AUTONOMY_LEVEL.AUTONOMOUS,
      condition: rule,
      reason: rule.description
    };
  }
  return {
    action: a,
    arm_id: BROWSER_ARM_ID,
    belongs_to_browser_arm: false,
    autonomy_level: AUTONOMY_LEVEL.REQUIRES_HUMAN,
    condition: null,
    reason: `A\xE7\xE3o '${a}' n\xE3o pertence ao cat\xE1logo do bra\xE7o Browser \u2014 requer OK humano por cautela.`
  };
}
__name(classifyBrowserArmAction, "classifyBrowserArmAction");
function validateConditionalAction({ action, justification, user_permission } = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("validateConditionalAction: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  const a = action.trim();
  if (!BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    return {
      allowed: true,
      action: a,
      condition: null,
      reason: `A\xE7\xE3o '${a}' n\xE3o \xE9 condicionada \u2014 pode prosseguir sem valida\xE7\xE3o condicional.`
    };
  }
  const rule = CONDITIONAL_ACTION_RULES[a];
  if (rule.requires_user_permission) {
    if (user_permission !== true) {
      return {
        allowed: false,
        action: a,
        condition: rule,
        reason: `A\xE7\xE3o '${a}' exige permiss\xE3o expl\xEDcita do usu\xE1rio \u2014 n\xE3o fornecida.`
      };
    }
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `A\xE7\xE3o '${a}' permitida \u2014 permiss\xE3o do usu\xE1rio fornecida.`
    };
  }
  if (rule.requires_justification) {
    if (typeof justification !== "string" || justification.trim() === "") {
      return {
        allowed: false,
        action: a,
        condition: rule,
        reason: `A\xE7\xE3o '${a}' exige justificativa restrita ao objetivo vigente \u2014 n\xE3o fornecida.`
      };
    }
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `A\xE7\xE3o '${a}' permitida \u2014 justificativa fornecida: ${justification.trim()}`
    };
  }
  if (rule.condition === "objective_requires") {
    return {
      allowed: true,
      action: a,
      condition: rule,
      reason: `A\xE7\xE3o '${a}' permitida \u2014 subordinada ao objetivo vigente.`
    };
  }
  return {
    allowed: false,
    action: a,
    condition: rule,
    reason: `A\xE7\xE3o '${a}' n\xE3o p\xF4de ser validada \u2014 regra desconhecida.`
  };
}
__name(validateConditionalAction, "validateConditionalAction");
function enforceBrowserArm({
  action,
  scope_approved,
  gates_context,
  justification = null,
  user_permission = false,
  drift_detected = false,
  regression_detected = false
} = {}) {
  if (typeof action !== "string" || action.trim() === "") {
    throw new Error("enforceBrowserArm: 'action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia");
  }
  if (typeof scope_approved !== "boolean") {
    throw new Error("enforceBrowserArm: 'scope_approved' \xE9 obrigat\xF3rio e deve ser boolean");
  }
  if (!gates_context || typeof gates_context !== "object") {
    throw new Error("enforceBrowserArm: 'gates_context' \xE9 obrigat\xF3rio e deve ser um objeto");
  }
  if (typeof drift_detected !== "boolean") {
    throw new Error("enforceBrowserArm: 'drift_detected' deve ser boolean");
  }
  if (typeof regression_detected !== "boolean") {
    throw new Error("enforceBrowserArm: 'regression_detected' deve ser boolean");
  }
  const a = action.trim();
  const classification = classifyBrowserArmAction(a);
  if (classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: AUTONOMY_LEVEL.PROHIBITED,
      reason: classification.reason,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false
    };
  }
  if (!classification.belongs_to_browser_arm) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_not_browser_arm",
      reason: `A\xE7\xE3o '${a}' n\xE3o pertence ao bra\xE7o Browser \u2014 bloqueada. N\xE3o misturar com executor Cloudflare ou bra\xE7o GitHub.`,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: true
    };
  }
  if (!scope_approved) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_out_of_scope",
      reason: `A\xE7\xE3o '${a}' fora do escopo aprovado \u2014 bra\xE7o Browser n\xE3o pode agir fora do escopo. Deve sugerir + pedir permiss\xE3o.`,
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: true
    };
  }
  if (drift_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_drift_detected",
      reason: "Drift detectado \u2014 bra\xE7o Browser bloqueado. \xC9 proibido gerar ou aceitar drift.",
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false
    };
  }
  if (regression_detected) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_regression_detected",
      reason: "Regress\xE3o detectada \u2014 bra\xE7o Browser bloqueado. \xC9 proibido permitir regress\xE3o.",
      classification,
      p23_compliance: null,
      conditional_check: null,
      suggestion_required: false
    };
  }
  const p23_compliance = validateSpecialistArmCompliance({
    arm_id: BROWSER_ARM_ID,
    action: a,
    gates_context
  });
  if (!p23_compliance.is_compliant) {
    return {
      allowed: false,
      blocked: true,
      arm_id: BROWSER_ARM_ID,
      action: a,
      level: "blocked_p23_noncompliant",
      reason: p23_compliance.reason,
      classification,
      p23_compliance,
      conditional_check: null,
      suggestion_required: false
    };
  }
  let conditional_check = null;
  if (BROWSER_CONDITIONAL_ACTIONS.includes(a)) {
    conditional_check = validateConditionalAction({
      action: a,
      justification,
      user_permission
    });
    if (!conditional_check.allowed) {
      return {
        allowed: false,
        blocked: true,
        arm_id: BROWSER_ARM_ID,
        action: a,
        level: "blocked_conditional_not_met",
        reason: conditional_check.reason,
        classification,
        p23_compliance,
        conditional_check,
        suggestion_required: a === "expand_scope"
      };
    }
  }
  return {
    allowed: true,
    blocked: false,
    arm_id: BROWSER_ARM_ID,
    action: a,
    level: classification.autonomy_level,
    reason: `Bra\xE7o Browser: a\xE7\xE3o '${a}' permitida \u2014 escopo aprovado, sem drift, sem regress\xE3o, P23 compliant.`,
    classification,
    p23_compliance,
    conditional_check,
    suggestion_required: false
  };
}
__name(enforceBrowserArm, "enforceBrowserArm");

// schema/enavia-constitution.js
function getEnaviaConstitution() {
  return {
    golden_rule: "A ENAVIA nunca deve pular da inten\xE7\xE3o para execu\xE7\xE3o cega.",
    mandatory_order: [
      "Entender",
      "Diagnosticar",
      "Planejar",
      "Validar (aprova\xE7\xE3o humana quando necess\xE1rio)",
      "Executar",
      "Revisar"
    ],
    operational_security: [
      "N\xE3o inventar certeza",
      "N\xE3o mascarar erro",
      "N\xE3o executar fora do escopo aprovado",
      "N\xE3o misturar frentes incompat\xEDveis",
      "N\xE3o refatorar por est\xE9tica sem necessidade",
      "N\xE3o quebrar o que j\xE1 funciona sem evid\xEAncia",
      "Sempre preferir mudan\xE7as cir\xFArgicas",
      "Sempre preservar rastreabilidade",
      "Sempre separar planejamento de execu\xE7\xE3o",
      "Sempre permitir rollback quando a mudan\xE7a for relevante"
    ],
    human_approval_required_when: [
      "Execu\xE7\xE3o relevante",
      "Altera\xE7\xE3o estrutural",
      "Impacto em produ\xE7\xE3o",
      "Gasto material de tempo/dinheiro/infra",
      "Mudan\xE7a irrevers\xEDvel",
      "Abertura de frente grande"
    ]
  };
}
__name(getEnaviaConstitution, "getEnaviaConstitution");

// schema/security-supervisor.js
var DECISION = {
  ALLOW: "allow",
  BLOCK: "block",
  NEEDS_HUMAN_REVIEW: "needs_human_review"
};
var RISK_LEVEL = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high"
};
var REASON_CODE = {
  ACTION_ALLOWED: "ACTION_ALLOWED",
  ACTION_PROHIBITED: "ACTION_PROHIBITED",
  SCOPE_VIOLATION: "SCOPE_VIOLATION",
  AUTONOMY_BLOCKED: "AUTONOMY_BLOCKED",
  GATES_FAILED: "GATES_FAILED",
  HUMAN_APPROVAL_REQUIRED: "HUMAN_APPROVAL_REQUIRED",
  INSUFFICIENT_EVIDENCE: "INSUFFICIENT_EVIDENCE",
  HIGH_RISK_DETECTED: "HIGH_RISK_DETECTED",
  ENVIRONMENT_UNSAFE: "ENVIRONMENT_UNSAFE",
  SCOPE_CONFLICT: "SCOPE_CONFLICT",
  ARM_ENFORCEMENT_BLOCKED: "ARM_ENFORCEMENT_BLOCKED"
};
function _classifyRiskLevel(context) {
  if (PROHIBITED_ACTIONS.includes(context.action)) {
    return RISK_LEVEL.HIGH;
  }
  if (context.environment === ENVIRONMENT.PROD) {
    return RISK_LEVEL.HIGH;
  }
  if (HUMAN_OK_REQUIRED_ACTIONS.includes(context.action)) {
    return RISK_LEVEL.MEDIUM;
  }
  if (!context.scope_approved) {
    return RISK_LEVEL.MEDIUM;
  }
  if (context.evidence_sufficient === false) {
    return RISK_LEVEL.MEDIUM;
  }
  return RISK_LEVEL.LOW;
}
__name(_classifyRiskLevel, "_classifyRiskLevel");
function _buildDecision({
  allowed,
  decision,
  reason_code,
  reason_text,
  risk_level,
  requires_human_approval,
  scope_valid,
  autonomy_valid,
  evidence_sufficient,
  constitution_check = null,
  arm_check = null
}) {
  return {
    allowed,
    decision,
    reason_code,
    reason_text,
    risk_level,
    requires_human_approval,
    scope_valid,
    autonomy_valid,
    evidence_sufficient,
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    supervisor_version: "1.0.0",
    // Detalhes de delegação (auditoria)
    _delegation: {
      constitution_check,
      arm_check
    }
  };
}
__name(_buildDecision, "_buildDecision");
function _validateEvaluationContext(ctx, fnName) {
  if (!ctx || typeof ctx !== "object") {
    throw new Error(`${fnName}: 'context' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof ctx.action !== "string" || ctx.action.trim() === "") {
    throw new Error(`${fnName}: 'context.action' \xE9 obrigat\xF3rio e deve ser string n\xE3o-vazia`);
  }
  if (typeof ctx.environment !== "string" || !Object.values(ENVIRONMENT).includes(ctx.environment)) {
    throw new Error(
      `${fnName}: 'context.environment' deve ser "${ENVIRONMENT.TEST}" ou "${ENVIRONMENT.PROD}"`
    );
  }
  if (typeof ctx.scope_approved !== "boolean") {
    throw new Error(`${fnName}: 'context.scope_approved' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
  if (!ctx.gates_context || typeof ctx.gates_context !== "object") {
    throw new Error(`${fnName}: 'context.gates_context' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
}
__name(_validateEvaluationContext, "_validateEvaluationContext");
function evaluateSensitiveAction(context) {
  _validateEvaluationContext(context, "evaluateSensitiveAction");
  const evidence_sufficient = context.evidence_sufficient !== false;
  const risk_level = context.is_high_risk === true ? RISK_LEVEL.HIGH : _classifyRiskLevel(context);
  const scope_valid = context.scope_approved === true;
  if (!scope_valid) {
    const decision = risk_level === RISK_LEVEL.HIGH ? DECISION.BLOCK : DECISION.NEEDS_HUMAN_REVIEW;
    return _buildDecision({
      allowed: false,
      decision,
      reason_code: REASON_CODE.SCOPE_VIOLATION,
      reason_text: "A\xE7\xE3o fora do escopo aprovado \u2014 escopo n\xE3o validado.",
      risk_level,
      requires_human_approval: true,
      scope_valid: false,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: null,
      arm_check: context.arm_check_result || null
    });
  }
  let constitutionCheck;
  try {
    constitutionCheck = enforceConstitution({
      action: context.action,
      environment: context.environment,
      scope_approved: context.scope_approved,
      gates_context: context.gates_context
    });
  } catch (err) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.AUTONOMY_BLOCKED,
      reason_text: `Erro ao avaliar autonomia: ${err.message}`,
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: null,
      arm_check: context.arm_check_result || null
    });
  }
  const autonomy_valid = constitutionCheck.allowed === true;
  if (!autonomy_valid) {
    const classification = classifyAction(context.action);
    const isHumanRequired = classification.autonomy_level === AUTONOMY_LEVEL.REQUIRES_HUMAN;
    const isProhibited = classification.autonomy_level === AUTONOMY_LEVEL.PROHIBITED;
    if (isProhibited) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.BLOCK,
        reason_code: REASON_CODE.ACTION_PROHIBITED,
        reason_text: constitutionCheck.reason,
        risk_level: RISK_LEVEL.HIGH,
        requires_human_approval: false,
        scope_valid,
        autonomy_valid: false,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null
      });
    }
    if (isHumanRequired) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.NEEDS_HUMAN_REVIEW,
        reason_code: REASON_CODE.HUMAN_APPROVAL_REQUIRED,
        reason_text: constitutionCheck.reason,
        risk_level,
        requires_human_approval: true,
        scope_valid,
        autonomy_valid: false,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null
      });
    }
    const hasGateFailure = constitutionCheck.gates && !constitutionCheck.gates.all_gates_passed;
    const reasonCode = hasGateFailure ? REASON_CODE.GATES_FAILED : REASON_CODE.AUTONOMY_BLOCKED;
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: reasonCode,
      reason_text: constitutionCheck.reason,
      risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid: false,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null
    });
  }
  if (context.arm_check_result && context.arm_check_result.allowed === false) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.ARM_ENFORCEMENT_BLOCKED,
      reason_text: context.arm_check_result.reason || "Bra\xE7o especialista bloqueou a a\xE7\xE3o.",
      risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result
    });
  }
  if (!evidence_sufficient) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.INSUFFICIENT_EVIDENCE,
      reason_text: "Evid\xEAncia insuficiente para prosseguir com a a\xE7\xE3o.",
      risk_level: risk_level === RISK_LEVEL.LOW ? RISK_LEVEL.MEDIUM : risk_level,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient: false,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null
    });
  }
  if (risk_level === RISK_LEVEL.HIGH) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.BLOCK,
      reason_code: REASON_CODE.HIGH_RISK_DETECTED,
      reason_text: "Risco alto detectado \u2014 a\xE7\xE3o bloqueada at\xE9 autoriza\xE7\xE3o humana.",
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null
    });
  }
  if (typeof context.attempt === "number") {
    const failurePolicy = evaluateFailurePolicy({
      attempt: context.attempt,
      is_high_risk: risk_level === RISK_LEVEL.HIGH,
      has_sufficient_evidence: evidence_sufficient
    });
    if (!failurePolicy.can_continue) {
      return _buildDecision({
        allowed: false,
        decision: DECISION.BLOCK,
        reason_code: REASON_CODE.HIGH_RISK_DETECTED,
        reason_text: failurePolicy.reason,
        risk_level: RISK_LEVEL.HIGH,
        requires_human_approval: true,
        scope_valid,
        autonomy_valid,
        evidence_sufficient,
        constitution_check: constitutionCheck,
        arm_check: context.arm_check_result || null
      });
    }
  }
  if (context.environment === ENVIRONMENT.PROD) {
    return _buildDecision({
      allowed: false,
      decision: DECISION.NEEDS_HUMAN_REVIEW,
      reason_code: REASON_CODE.ENVIRONMENT_UNSAFE,
      reason_text: "Ambiente PROD requer revis\xE3o humana antes de prosseguir.",
      risk_level: RISK_LEVEL.HIGH,
      requires_human_approval: true,
      scope_valid,
      autonomy_valid,
      evidence_sufficient,
      constitution_check: constitutionCheck,
      arm_check: context.arm_check_result || null
    });
  }
  return _buildDecision({
    allowed: true,
    decision: DECISION.ALLOW,
    reason_code: REASON_CODE.ACTION_ALLOWED,
    reason_text: `A\xE7\xE3o '${context.action}' permitida \u2014 autonomia OK, escopo OK, gates OK, evid\xEAncia OK.`,
    risk_level,
    requires_human_approval: false,
    scope_valid,
    autonomy_valid,
    evidence_sufficient,
    constitution_check: constitutionCheck,
    arm_check: context.arm_check_result || null
  });
}
__name(evaluateSensitiveAction, "evaluateSensitiveAction");

// contract-executor.js
var import_enavia_github_bridge = __toESM(require_enavia_github_bridge());
function _githubBridgeFallback() {
  return {
    ok: false,
    mode: "github_bridge_plan",
    error: "bridge_not_loaded",
    operations: [],
    blocked_operations: [],
    safety_summary: {},
    event_summary: {},
    requires_human_review: true,
    github_execution: false,
    side_effects: false,
    ready_for_real_execution: false,
    next_recommended_action: "Bridge module n\xE3o dispon\xEDvel"
  };
}
__name(_githubBridgeFallback, "_githubBridgeFallback");
var _buildGithubBridgePlan = import_enavia_github_bridge.default && import_enavia_github_bridge.default.buildGithubBridgePlan ? import_enavia_github_bridge.default.buildGithubBridgePlan : _githubBridgeFallback;
function _runSupervisorGate(context) {
  const supervisorDecision = evaluateSensitiveAction(context);
  if (supervisorDecision.decision === DECISION.ALLOW) {
    return { pass: true, supervisorDecision };
  }
  return { pass: false, supervisorDecision };
}
__name(_runSupervisorGate, "_runSupervisorGate");
function _buildSupervisorBlockResponse(supervisorDecision) {
  const errorCode = supervisorDecision.decision === DECISION.NEEDS_HUMAN_REVIEW ? "SUPERVISOR_NEEDS_HUMAN_REVIEW" : "SUPERVISOR_BLOCKED";
  return {
    ok: false,
    error: errorCode,
    message: supervisorDecision.reason_text,
    supervisor_enforcement: {
      allowed: supervisorDecision.allowed,
      decision: supervisorDecision.decision,
      reason_code: supervisorDecision.reason_code,
      reason_text: supervisorDecision.reason_text,
      risk_level: supervisorDecision.risk_level,
      requires_human_approval: supervisorDecision.requires_human_approval,
      scope_valid: supervisorDecision.scope_valid,
      autonomy_valid: supervisorDecision.autonomy_valid,
      evidence_sufficient: supervisorDecision.evidence_sufficient,
      timestamp: supervisorDecision.timestamp,
      supervisor_version: supervisorDecision.supervisor_version
    }
  };
}
__name(_buildSupervisorBlockResponse, "_buildSupervisorBlockResponse");
var _CANONICAL_NULL_GATES_CONTEXT = {
  scope_defined: false,
  environment_defined: false,
  risk_assessed: false,
  authorization_present_when_required: false,
  observability_preserved: false,
  evidence_available_when_required: false
};
var KV_PREFIX_STATE = "contract:";
var KV_SUFFIX_STATE = ":state";
var KV_SUFFIX_DECOMPOSITION = ":decomposition";
var KV_INDEX_KEY = "contract:index";
var KV_SUFFIX_EXEC_EVENT = ":exec_event";
var KV_SUFFIX_FUNCTIONAL_LOGS = ":functional_logs";
var KV_SUFFIX_FLOG_ENTRY = ":flog:";
var MAX_FUNCTIONAL_LOGS_PER_CONTRACT = 50;
var TERMINAL_STATUSES = ["completed", "cancelled", "failed"];
var VALID_STATUSES = [
  "draft",
  "approved",
  "decomposed",
  "executing",
  "validating",
  "blocked",
  "awaiting-human",
  "test-complete",
  "prod-pending",
  "completed",
  "cancelled",
  "failed"
];
var VALID_GLOBAL_TRANSITIONS = {
  "draft": ["approved", "cancelled"],
  "approved": ["decomposed", "cancelled"],
  "decomposed": ["executing", "blocked", "cancelled"],
  "executing": ["executing", "validating", "blocked", "awaiting-human", "test-complete", "completed", "cancelled", "failed"],
  "validating": ["executing", "blocked", "awaiting-human", "test-complete", "completed", "cancelled", "failed"],
  "blocked": ["executing", "decomposed", "cancelled", "failed"],
  "awaiting-human": ["executing", "blocked", "cancelled"],
  "test-complete": ["prod-pending", "cancelled"],
  "prod-pending": ["completed", "cancelled", "failed"],
  "completed": [],
  "cancelled": [],
  "failed": []
};
function transitionStatusGlobal(state, targetStatus, context) {
  const from = state.status_global;
  if (!VALID_STATUSES.includes(targetStatus)) {
    return {
      ok: false,
      error: "INVALID_STATUS",
      message: `"${targetStatus}" is not a valid canonical status_global.${context ? ` (context: ${context})` : ""}`
    };
  }
  const allowed = VALID_GLOBAL_TRANSITIONS[from];
  if (!allowed) {
    return {
      ok: false,
      error: "UNKNOWN_SOURCE_STATUS",
      message: `Current status_global "${from}" is not recognized.${context ? ` (context: ${context})` : ""}`
    };
  }
  if (!allowed.includes(targetStatus)) {
    return {
      ok: false,
      error: "INVALID_TRANSITION",
      message: `Transition "${from}" \u2192 "${targetStatus}" is not allowed.${context ? ` (context: ${context})` : ""}`
    };
  }
  const previous = from;
  state.status_global = targetStatus;
  return { ok: true, previous, current: targetStatus };
}
__name(transitionStatusGlobal, "transitionStatusGlobal");
var SPECIAL_PHASES = [
  "decomposition_complete",
  "ingestion_blocked",
  "all_phases_complete",
  "plan_revision_pending",
  "max_prs_exceeded"
];
var REQUIRED_FIELDS = [
  "contract_id",
  "version",
  "operator",
  "goal",
  "definition_of_done"
];
function validateContractPayload(body) {
  const errors = [];
  if (!body || typeof body !== "object") {
    return { valid: false, errors: ["Payload must be a JSON object."] };
  }
  for (const field of REQUIRED_FIELDS) {
    if (body[field] === void 0 || body[field] === null || body[field] === "") {
      errors.push(`Missing required field: "${field}".`);
    }
  }
  if (body.contract_id && typeof body.contract_id !== "string") {
    errors.push('"contract_id" must be a string.');
  }
  if (body.version && body.version !== "v1") {
    errors.push('"version" must be "v1".');
  }
  if (body.definition_of_done !== void 0) {
    if (!Array.isArray(body.definition_of_done) || body.definition_of_done.length === 0) {
      errors.push('"definition_of_done" must be a non-empty array.');
    }
  }
  if (!body.scope || !Array.isArray(body.scope.environments) || body.scope.environments.length === 0) {
    errors.push('"scope.environments" must be a non-empty array (e.g. ["TEST","PROD"]).');
  }
  return { valid: errors.length === 0, errors };
}
__name(validateContractPayload, "validateContractPayload");
function buildInitialState(body) {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    contract_id: body.contract_id,
    contract_name: body.goal,
    contract_version: body.version,
    objective_final: body.goal,
    status_global: "decomposed",
    current_phase: "decomposition_complete",
    current_task: null,
    pending_items: [],
    blockers: [],
    next_action: "Revisar decomposi\xE7\xE3o e aprovar plano de micro-PRs.",
    prod_promotion_required: true,
    operator: body.operator,
    scope: body.scope || {},
    constraints: Object.assign(
      {
        require_human_approval_per_pr: true,
        test_before_prod: true,
        rollback_on_failure: true
      },
      body.constraints || {}
    ),
    definition_of_done: body.definition_of_done,
    context: body.context || {},
    // Canonical execution cycle history per microstep (task_id → cycle[]).
    // Populated by executeCurrentMicroPr and handleCompleteTask.
    // Survives KV round-trips — single source of truth for execution_cycles.
    task_execution_log: {},
    created_at: body.created_at || now,
    updated_at: now
  };
}
__name(buildInitialState, "buildInitialState");
function generateDecomposition(state) {
  const dod = state.definition_of_done || [];
  const scope = state.scope || {};
  const workers = scope.workers || ["nv-enavia"];
  const routes = scope.routes || [];
  const phases = [
    {
      id: "phase_01",
      name: "Prepara\xE7\xE3o e an\xE1lise",
      status: "pending",
      tasks: []
    },
    {
      id: "phase_02",
      name: "Implementa\xE7\xE3o em TEST",
      status: "pending",
      tasks: []
    },
    {
      id: "phase_03",
      name: "Valida\xE7\xE3o e promo\xE7\xE3o para PROD",
      status: "pending",
      tasks: []
    }
  ];
  const tasks = [];
  const microPrCandidates = [];
  dod.forEach((criterion, idx) => {
    const taskId = `task_${String(idx + 1).padStart(3, "0")}`;
    const task = {
      id: taskId,
      description: criterion,
      status: "queued",
      phase: idx < dod.length - 1 ? "phase_02" : "phase_03",
      depends_on: idx > 0 ? [`task_${String(idx).padStart(3, "0")}`] : []
    };
    tasks.push(task);
    microPrCandidates.push({
      id: `micro_pr_${String(idx + 1).padStart(3, "0")}`,
      task_id: taskId,
      title: `${state.contract_id} \u2014 ${criterion.slice(0, 80)}`,
      status: "queued",
      target_workers: workers,
      target_routes: routes,
      environment: "TEST"
    });
  });
  microPrCandidates.push({
    id: `micro_pr_${String(dod.length + 1).padStart(3, "0")}`,
    task_id: null,
    title: `${state.contract_id} \u2014 Promo\xE7\xE3o para PROD`,
    status: "queued",
    target_workers: workers,
    target_routes: routes,
    environment: "PROD"
  });
  tasks.forEach((t) => {
    if (t.phase === "phase_02" && t.id !== "task_001") {
      phases[1].tasks.push(t.id);
    }
    if (t.phase === "phase_03") {
      phases[2].tasks.push(t.id);
    }
  });
  if (tasks.length > 0) {
    phases[0].tasks = [tasks[0].id];
  }
  return {
    contract_id: state.contract_id,
    phases,
    tasks,
    micro_pr_candidates: microPrCandidates,
    generated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(generateDecomposition, "generateDecomposition");
async function persistContract(env, state, decomposition) {
  const id = state.contract_id;
  const stateKey = `${KV_PREFIX_STATE}${id}${KV_SUFFIX_STATE}`;
  const decompKey = `${KV_PREFIX_STATE}${id}${KV_SUFFIX_DECOMPOSITION}`;
  await env.ENAVIA_BRAIN.put(stateKey, JSON.stringify(state));
  await env.ENAVIA_BRAIN.put(decompKey, JSON.stringify(decomposition));
  let index = [];
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
    if (raw) index = JSON.parse(raw);
  } catch (_) {
    index = [];
  }
  if (!index.includes(id)) {
    index.push(id);
    await env.ENAVIA_BRAIN.put(KV_INDEX_KEY, JSON.stringify(index));
  }
}
__name(persistContract, "persistContract");
async function readContractState(env, contractId) {
  const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`;
  const raw = await env.ENAVIA_BRAIN.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}
__name(readContractState, "readContractState");
async function readContractDecomposition(env, contractId) {
  const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_DECOMPOSITION}`;
  const raw = await env.ENAVIA_BRAIN.get(key);
  if (!raw) return null;
  return JSON.parse(raw);
}
__name(readContractDecomposition, "readContractDecomposition");
async function rehydrateContract(env, contractId) {
  const [state, decomposition] = await Promise.all([
    readContractState(env, contractId),
    readContractDecomposition(env, contractId)
  ]);
  return { state, decomposition };
}
__name(rehydrateContract, "rehydrateContract");
function isCancelledContract(state) {
  return state && state.status_global === "cancelled";
}
__name(isCancelledContract, "isCancelledContract");
function cancelledResult(contractId) {
  return {
    ok: false,
    error: "CONTRACT_CANCELLED",
    message: `Contract "${contractId}" is cancelled \u2014 no further actions allowed.`
  };
}
__name(cancelledResult, "cancelledResult");
function isPlanRejected(state) {
  return !!(state && state.plan_rejection && state.plan_rejection.plan_rejected === true);
}
__name(isPlanRejected, "isPlanRejected");
function planRejectedResult(contractId) {
  return {
    ok: false,
    error: "PLAN_REJECTED",
    message: `Contract "${contractId}" has a rejected decomposition plan \u2014 resolve the plan revision before proceeding.`
  };
}
__name(planRejectedResult, "planRejectedResult");
async function cancelContract(env, contractId, params) {
  const p = params || {};
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return {
      ok: true,
      already_cancelled: true,
      contract_cancellation: state.contract_cancellation,
      message: "Contract already cancelled.",
      state,
      decomposition
    };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const previousStatusGlobal = state.status_global;
  const previousCurrentPhase = state.current_phase;
  const transition = transitionStatusGlobal(state, "cancelled", "cancelContract");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }
  state.contract_cancellation = {
    cancelled: true,
    cancelled_at: now,
    cancel_reason: p.reason || null,
    cancelled_by: p.cancelled_by || "human",
    cancellation_evidence: Array.isArray(p.evidence) ? p.evidence : [],
    previous_status_global: previousStatusGlobal,
    previous_current_phase: previousCurrentPhase
  };
  state.next_action = "Contract cancelled. No further actions.";
  state.updated_at = now;
  await persistContract(env, state, decomposition);
  return {
    ok: true,
    already_cancelled: false,
    contract_cancellation: state.contract_cancellation,
    message: "Contract cancelled successfully.",
    state,
    decomposition
  };
}
__name(cancelContract, "cancelContract");
async function handleCancelContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." }
    };
  }
  const result = await cancelContract(env, contractId, {
    reason: body.reason || null,
    cancelled_by: body.cancelled_by || "human",
    evidence: body.evidence || []
  });
  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404 : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      already_cancelled: result.already_cancelled || false,
      contract_cancellation: result.contract_cancellation,
      message: result.message
    }
  };
}
__name(handleCancelContract, "handleCancelContract");
async function rejectDecompositionPlan(env, contractId, params) {
  const p = params || {};
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return {
      ok: true,
      already_rejected: true,
      plan_rejection: state.plan_rejection,
      message: "Decomposition plan already rejected \u2014 awaiting revision.",
      state,
      decomposition
    };
  }
  if (state.status_global !== "decomposed") {
    return {
      ok: false,
      error: "PLAN_NOT_REJECTABLE",
      message: `Contract status_global is "${state.status_global}" \u2014 plan can only be rejected when status is "decomposed".`
    };
  }
  if (!p.reason || typeof p.reason !== "string" || p.reason.trim() === "") {
    return {
      ok: false,
      error: "MISSING_REJECTION_REASON",
      message: "A non-empty reason is required to reject the decomposition plan."
    };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const previousStatusGlobal = state.status_global;
  const previousCurrentPhase = state.current_phase;
  const transition = transitionStatusGlobal(state, "blocked", "rejectDecompositionPlan");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }
  const planRevision = state.plan_rejection && state.plan_rejection.plan_revision ? state.plan_rejection.plan_revision + 1 : 1;
  state.plan_rejection = {
    plan_rejected: true,
    plan_rejected_at: now,
    plan_rejection_reason: p.reason.trim(),
    plan_rejected_by: p.rejected_by || "human",
    plan_revision: planRevision,
    previous_status_global: previousStatusGlobal,
    previous_current_phase: previousCurrentPhase,
    previous_decomposition_snapshot: decomposition ? JSON.parse(JSON.stringify(decomposition)) : null
  };
  state.current_phase = "plan_revision_pending";
  state.next_action = "Decomposition plan rejected \u2014 awaiting revised plan.";
  state.updated_at = now;
  await persistContract(env, state, decomposition);
  return {
    ok: true,
    already_rejected: false,
    plan_rejection: state.plan_rejection,
    message: "Decomposition plan rejected. Contract blocked until plan is revised.",
    state,
    decomposition
  };
}
__name(rejectDecompositionPlan, "rejectDecompositionPlan");
async function handleRejectDecompositionPlan(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." }
    };
  }
  const result = await rejectDecompositionPlan(env, contractId, {
    reason: body.reason || null,
    rejected_by: body.rejected_by || "human"
  });
  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404 : result.error === "CONTRACT_CANCELLED" ? 409 : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      already_rejected: result.already_rejected || false,
      plan_rejection: result.plan_rejection,
      message: result.message
    }
  };
}
__name(handleRejectDecompositionPlan, "handleRejectDecompositionPlan");
async function resolvePlanRevision(env, contractId, params) {
  const p = params || {};
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (!isPlanRejected(state)) {
    return {
      ok: false,
      error: "NOT_IN_PLAN_REVISION",
      message: `Contract "${contractId}" is not in plan revision \u2014 cannot resolve.`
    };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const previousRejection = JSON.parse(JSON.stringify(state.plan_rejection));
  let revisedDecomposition;
  if (p.new_decomposition && typeof p.new_decomposition === "object") {
    revisedDecomposition = p.new_decomposition;
  } else {
    revisedDecomposition = generateDecomposition(state);
  }
  const maxMicroPrs = typeof state.constraints.max_micro_prs === "number" ? state.constraints.max_micro_prs : null;
  if (maxMicroPrs !== null) {
    const taskCandidates = Array.isArray(revisedDecomposition.micro_pr_candidates) ? revisedDecomposition.micro_pr_candidates.filter((m) => m.environment !== "PROD") : [];
    if (taskCandidates.length > maxMicroPrs) {
      return {
        ok: false,
        error: "BLOCK_MAX_PRS_REACHED",
        message: `Revised decomposition has ${taskCandidates.length} micro-PR candidates (excluding PROD), exceeding the limit of ${maxMicroPrs}. Provide a revised decomposition within the limit.`
      };
    }
  }
  const transition = transitionStatusGlobal(state, "decomposed", "resolvePlanRevision");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }
  if (!state.plan_rejection_history) {
    state.plan_rejection_history = [];
  }
  previousRejection.resolved_at = now;
  previousRejection.resolved_by = p.revised_by || "human";
  state.plan_rejection_history.push(previousRejection);
  state.plan_rejection = null;
  state.current_phase = "decomposition_complete";
  state.next_action = "Plano revisado. Revisar decomposi\xE7\xE3o e aprovar plano de micro-PRs.";
  state.updated_at = now;
  await persistContract(env, state, revisedDecomposition);
  return {
    ok: true,
    message: "Plan revision resolved. Contract returned to decomposed state.",
    plan_rejection_history: state.plan_rejection_history,
    state,
    decomposition: revisedDecomposition
  };
}
__name(resolvePlanRevision, "resolvePlanRevision");
async function handleResolvePlanRevision(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." }
    };
  }
  const result = await resolvePlanRevision(env, contractId, {
    revised_by: body.revised_by || "human",
    new_decomposition: body.new_decomposition || null
  });
  if (!result.ok) {
    const httpStatus = result.error === "CONTRACT_NOT_FOUND" ? 404 : result.error === "CONTRACT_CANCELLED" ? 409 : result.error === "BLOCK_MAX_PRS_REACHED" ? 422 : 400;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error,
        message: result.message
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      message: result.message,
      plan_rejection_history: result.plan_rejection_history
    }
  };
}
__name(handleResolvePlanRevision, "handleResolvePlanRevision");
var TASK_DONE_STATUSES = ["done", "merged", "completed", "skipped"];
function checkPhaseGate(state, decomposition) {
  if (!state || !decomposition) {
    return { canAdvance: false, activePhaseId: null, reason: "Missing state or decomposition \u2014 cannot evaluate phase gate." };
  }
  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const activePhase = phases.find((p) => p.status !== "done");
  if (!activePhase) {
    return { canAdvance: true, activePhaseId: null, reason: "All phases are complete." };
  }
  const phaseTasks = tasks.filter((t) => activePhase.tasks.includes(t.id));
  const incompleteTasks = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
  if (incompleteTasks.length > 0) {
    const taskIds = incompleteTasks.map((t) => t.id).join(", ");
    return {
      canAdvance: false,
      activePhaseId: activePhase.id,
      reason: `Phase "${activePhase.id}" has ${incompleteTasks.length} incomplete task(s): ${taskIds}.`
    };
  }
  return { canAdvance: true, activePhaseId: activePhase.id, reason: `Phase "${activePhase.id}" acceptance criteria met.` };
}
__name(checkPhaseGate, "checkPhaseGate");
function isValidPhaseValue(phaseValue, decomposition) {
  if (SPECIAL_PHASES.includes(phaseValue)) return true;
  if (!decomposition || !Array.isArray(decomposition.phases)) return false;
  return decomposition.phases.some((p) => p.id === phaseValue);
}
__name(isValidPhaseValue, "isValidPhaseValue");
async function advanceContractPhase(env, contractId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found in KV.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  const gate = checkPhaseGate(state, decomposition);
  if (!gate.canAdvance) {
    const now2 = (/* @__PURE__ */ new Date()).toISOString();
    const updatedState2 = Object.assign({}, state, {
      blockers: [.../* @__PURE__ */ new Set([...state.blockers || [], gate.reason])],
      next_action: "Resolve incomplete tasks in active phase before advancing.",
      updated_at: now2
    });
    const transition2 = transitionStatusGlobal(updatedState2, "blocked", "advanceContractPhase:gate-blocked");
    if (!transition2.ok) {
      return { ok: false, error: transition2.error, message: transition2.message, state, decomposition, gate };
    }
    await env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
      JSON.stringify(updatedState2)
    );
    return { ok: false, state: updatedState2, decomposition, gate };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const updatedPhases = (decomposition.phases || []).map(
    (p) => p.id === gate.activePhaseId ? Object.assign({}, p, { status: "done" }) : p
  );
  const nextPhase = updatedPhases.find((p) => p.status !== "done");
  const nextPhaseValue = nextPhase ? nextPhase.id : "all_phases_complete";
  if (!isValidPhaseValue(nextPhaseValue, decomposition)) {
    return {
      ok: false,
      error: "INVALID_PHASE_TRANSITION",
      message: `Phase "${nextPhaseValue}" is not a valid phase for contract "${contractId}".`,
      state,
      decomposition,
      gate
    };
  }
  const updatedDecomposition = Object.assign({}, decomposition, { phases: updatedPhases });
  const targetGlobalStatus = "executing";
  const updatedState = Object.assign({}, state, {
    current_phase: nextPhaseValue,
    // Clear blockers since the gate that caused them has now passed
    blockers: [],
    next_action: nextPhase ? `Execute tasks in phase "${nextPhase.id}".` : "All phases complete. Awaiting human sign-off.",
    updated_at: now
  });
  const transition = transitionStatusGlobal(updatedState, targetGlobalStatus, "advanceContractPhase:advance");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message, state, decomposition, gate };
  }
  await Promise.all([
    env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
      JSON.stringify(updatedState)
    ),
    env.ENAVIA_BRAIN.put(
      `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_DECOMPOSITION}`,
      JSON.stringify(updatedDecomposition)
    )
  ]);
  return { ok: true, state: updatedState, decomposition: updatedDecomposition, gate };
}
__name(advanceContractPhase, "advanceContractPhase");
async function startTask(env, contractId, taskId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (task.status !== "queued") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Task "${taskId}" cannot start from status "${task.status}". Must be "queued".` };
  }
  task.status = "in_progress";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  state.current_task = taskId;
  state.updated_at = now;
  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, task };
}
__name(startTask, "startTask");
async function _completeTaskCore(env, contractId, taskId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (task.status !== "in_progress") {
    return { ok: false, error: "INVALID_TRANSITION", message: `Task "${taskId}" cannot complete from status "${task.status}". Must be "in_progress".` };
  }
  task.status = "completed";
  const now = (/* @__PURE__ */ new Date()).toISOString();
  if (state.current_task === taskId) {
    const nextTask = (decomposition.tasks || []).find((t) => t.status === "queued");
    state.current_task = nextTask ? nextTask.id : null;
  }
  state.updated_at = now;
  await persistContract(env, state, decomposition);
  return { ok: true, state, decomposition, task };
}
__name(_completeTaskCore, "_completeTaskCore");
function resolveNextAction(state, decomposition) {
  if (!state || !decomposition) {
    return {
      type: "no_action",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "Missing state or decomposition \u2014 cannot resolve next action.",
      status: "error"
    };
  }
  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const blockers = state.blockers || [];
  if (isCancelledContract(state)) {
    return {
      type: "contract_cancelled",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "Contract has been formally cancelled.",
      status: "cancelled"
    };
  }
  if (isPlanRejected(state)) {
    return {
      type: "plan_rejected",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: state.plan_rejection.plan_rejection_reason ? `Decomposition plan rejected: ${state.plan_rejection.plan_rejection_reason}` : "Decomposition plan rejected \u2014 awaiting revised plan.",
      status: "blocked"
    };
  }
  if (state.status_global === "completed" || state.status_global === "test-complete") {
    return {
      type: "contract_complete",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: state.status_global === "test-complete" ? "Contract closed in TEST. Awaiting PROD promotion decision." : "All phases and tasks are complete.",
      status: state.status_global
    };
  }
  if (state.current_phase === "ingestion_blocked") {
    return {
      type: "contract_blocked",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: blockers.length > 0 ? `Ingestion blocked: ${blockers.join("; ")}` : "Contract is blocked at ingestion.",
      status: "blocked"
    };
  }
  if (state.current_phase === "max_prs_exceeded") {
    return {
      type: "contract_blocked",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: blockers.length > 0 ? `max_micro_prs limit exceeded: ${blockers.join("; ")}` : "Contract is blocked \u2014 max_micro_prs limit exceeded.",
      status: "blocked"
    };
  }
  const activePhase = phases.find((p) => p.status !== "done");
  if (!activePhase) {
    return {
      type: "awaiting_human_approval",
      phase_id: null,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: "All phases are done. Awaiting final human sign-off.",
      status: "awaiting_approval"
    };
  }
  const phaseTasks = tasks.filter((t) => activePhase.tasks.includes(t.id));
  const incompleteInPhase = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
  if (incompleteInPhase.length === 0 && phaseTasks.length > 0) {
    return {
      type: "phase_complete",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `All tasks in phase "${activePhase.id}" are complete. Ready to advance.`,
      status: "ready"
    };
  }
  for (const task of phaseTasks) {
    if (task.status !== "queued") continue;
    const deps = task.depends_on || [];
    const allDepsSatisfied = deps.every((depId) => {
      const depTask = tasks.find((t) => t.id === depId);
      return depTask && TASK_DONE_STATUSES.includes(depTask.status);
    });
    if (allDepsSatisfied) {
      const correspondingMpr = mprs.find((m) => m.task_id === task.id && m.status === "queued");
      return {
        type: "start_task",
        phase_id: activePhase.id,
        task_id: task.id,
        micro_pr_candidate_id: correspondingMpr ? correspondingMpr.id : null,
        reason: `Task "${task.id}" is ready to start (all dependencies satisfied).`,
        status: "ready"
      };
    }
  }
  for (const mpr of mprs) {
    if (mpr.status !== "queued") continue;
    if (mpr.task_id) {
      const linkedTask = tasks.find((t) => t.id === mpr.task_id);
      if (linkedTask && TASK_DONE_STATUSES.includes(linkedTask.status)) {
        return {
          type: "start_micro_pr",
          phase_id: activePhase.id,
          task_id: mpr.task_id,
          micro_pr_candidate_id: mpr.id,
          reason: `Micro-PR "${mpr.id}" is ready (linked task "${mpr.task_id}" is complete).`,
          status: "ready"
        };
      }
    } else {
      const allTasksDone = tasks.every((t) => TASK_DONE_STATUSES.includes(t.status));
      if (allTasksDone) {
        return {
          type: "start_micro_pr",
          phase_id: activePhase.id,
          task_id: null,
          micro_pr_candidate_id: mpr.id,
          reason: `Micro-PR "${mpr.id}" is ready (no linked task; all tasks complete).`,
          status: "ready"
        };
      }
    }
  }
  const remainingTasks = phaseTasks.filter((t) => !TASK_DONE_STATUSES.includes(t.status));
  const allBlocked = remainingTasks.length > 0 && remainingTasks.every((t) => t.status === "blocked");
  if (allBlocked) {
    const blockedIds = remainingTasks.map((t) => t.id).join(", ");
    return {
      type: "contract_blocked",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `All remaining tasks in phase "${activePhase.id}" are blocked: ${blockedIds}.`,
      status: "blocked"
    };
  }
  const queuedTasks = phaseTasks.filter((t) => t.status === "queued");
  if (queuedTasks.length > 0) {
    const waitingOn = [];
    for (const task of queuedTasks) {
      for (const depId of task.depends_on || []) {
        const depTask = tasks.find((t) => t.id === depId);
        if (depTask && !TASK_DONE_STATUSES.includes(depTask.status)) {
          waitingOn.push(`"${task.id}" waits on "${depId}" (${depTask.status})`);
        }
      }
    }
    return {
      type: "contract_blocked",
      phase_id: activePhase.id,
      task_id: null,
      micro_pr_candidate_id: null,
      reason: `No executable tasks \u2014 unmet dependencies: ${waitingOn.join("; ")}.`,
      status: "blocked"
    };
  }
  const inProgressTasks = phaseTasks.filter((t) => t.status === "in_progress");
  if (inProgressTasks.length > 0) {
    return {
      type: "no_action",
      phase_id: activePhase.id,
      task_id: inProgressTasks[0].id,
      micro_pr_candidate_id: null,
      reason: `Task "${inProgressTasks[0].id}" is currently in progress. Waiting for completion.`,
      status: "in_progress"
    };
  }
  return {
    type: "no_action",
    phase_id: activePhase ? activePhase.id : null,
    task_id: null,
    micro_pr_candidate_id: null,
    reason: "No executable action found.",
    status: "idle"
  };
}
__name(resolveNextAction, "resolveNextAction");
var HANDOFF_ACTIONABLE_TYPES = ["start_task", "start_micro_pr"];
function buildExecutionHandoff(state, decomposition) {
  if (!state || !decomposition) {
    return null;
  }
  const nextAction = resolveNextAction(state, decomposition);
  if (!nextAction || !HANDOFF_ACTIONABLE_TYPES.includes(nextAction.type)) {
    return null;
  }
  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const phases = decomposition.phases || [];
  const targetTask = nextAction.task_id ? tasks.find((t) => t.id === nextAction.task_id) : null;
  const targetMpr = nextAction.micro_pr_candidate_id ? mprs.find((m) => m.id === nextAction.micro_pr_candidate_id) : null;
  const targetPhase = nextAction.phase_id ? phases.find((p) => p.id === nextAction.phase_id) : null;
  const objective = targetTask ? targetTask.description : targetMpr ? targetMpr.title : nextAction.reason;
  if (!objective) {
    return null;
  }
  const scopeWorkers = targetMpr ? targetMpr.target_workers || [] : state.scope && state.scope.workers || [];
  const scopeRoutes = targetMpr ? targetMpr.target_routes || [] : state.scope && state.scope.routes || [];
  const scope = {
    environment: targetMpr ? targetMpr.environment : "TEST",
    workers: scopeWorkers,
    routes: scopeRoutes,
    phase: targetPhase ? targetPhase.name : nextAction.phase_id || null
  };
  const targetFiles = [];
  for (const worker of scope.workers) {
    if (worker === "nv-enavia") {
      targetFiles.push("nv-enavia.js", "contract-executor.js", "wrangler.toml");
    } else {
      targetFiles.push(`${worker}.js`);
    }
  }
  if (scope.routes.length > 0) {
    targetFiles.push("tests/contracts-smoke.test.js");
  }
  const doNotTouch = [
    "PROD environment (unless handoff environment is PROD and human-approved)",
    "Unrelated workers or routes outside contract scope",
    "KV bindings not listed in contract scope",
    "Existing tests unrelated to this task"
  ];
  const smokeTests = [];
  if (targetTask) {
    smokeTests.push(`Verify: ${targetTask.description}`);
  }
  if (targetMpr && targetMpr.environment === "TEST") {
    smokeTests.push("Deploy to TEST and validate endpoint behavior");
    smokeTests.push("Confirm no regression on existing routes");
  }
  if (targetMpr && targetMpr.environment === "PROD") {
    smokeTests.push("Human-approved promotion to PROD");
    smokeTests.push("Post-deploy smoke test in PROD");
  }
  if (smokeTests.length === 0) {
    smokeTests.push("Verify task completion criteria");
  }
  const rollback = targetMpr && targetMpr.environment === "PROD" ? "Immediate rollback via wrangler rollback; notify operator." : "Revert branch changes; redeploy previous TEST version.";
  const acceptanceCriteria = [];
  if (targetTask) {
    acceptanceCriteria.push(targetTask.description);
  }
  if (targetMpr && targetMpr.environment === "TEST") {
    acceptanceCriteria.push("Smoke test in TEST passes");
  }
  if (targetMpr && targetMpr.environment === "PROD") {
    acceptanceCriteria.push("Human approval received for PROD promotion");
    acceptanceCriteria.push("Smoke test in PROD passes");
  }
  acceptanceCriteria.push("No new blockers introduced");
  return {
    objective,
    scope,
    target_files: targetFiles,
    do_not_touch: doNotTouch,
    smoke_tests: smokeTests,
    rollback,
    acceptance_criteria: acceptanceCriteria,
    source_phase: nextAction.phase_id,
    source_task: nextAction.task_id,
    source_micro_pr: nextAction.micro_pr_candidate_id,
    generated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildExecutionHandoff, "buildExecutionHandoff");
function buildCriterion(id, scope, description, options) {
  const opts = options || {};
  return {
    id,
    scope,
    description,
    status: "pending",
    evidence_required: opts.evidence_required !== void 0 ? opts.evidence_required : true,
    blocking: opts.blocking !== void 0 ? opts.blocking : true
  };
}
__name(buildCriterion, "buildCriterion");
function bindAcceptanceCriteria(state, decomposition) {
  if (!state || !decomposition) {
    return null;
  }
  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const dod = state.definition_of_done || [];
  const activePhase = phases.find((p) => p.id === state.current_phase) || phases.find((p) => p.status !== "done");
  const phaseAcceptance = [];
  if (activePhase) {
    const phaseTasks = tasks.filter((t) => (activePhase.tasks || []).includes(t.id));
    phaseTasks.forEach((t, idx) => {
      phaseAcceptance.push(
        buildCriterion(
          `phase_ac_${String(idx + 1).padStart(3, "0")}`,
          "phase",
          `Task "${t.id}" in phase "${activePhase.id}" must be completed: ${t.description}`,
          { evidence_required: true, blocking: true }
        )
      );
    });
    if (phaseTasks.length === 0) {
      phaseAcceptance.push(
        buildCriterion(
          "phase_ac_001",
          "phase",
          `Phase "${activePhase.id}" has no tasks \u2014 structural pass required.`,
          { evidence_required: false, blocking: false }
        )
      );
    }
  }
  const taskAcceptance = [];
  const currentTaskId = state.current_task;
  const currentTask = currentTaskId ? tasks.find((t) => t.id === currentTaskId) : null;
  if (currentTask) {
    taskAcceptance.push(
      buildCriterion(
        "task_ac_001",
        "task",
        currentTask.description,
        { evidence_required: true, blocking: true }
      )
    );
    const deps = currentTask.depends_on || [];
    deps.forEach((depId, idx) => {
      const depTask = tasks.find((t) => t.id === depId);
      const depDesc = depTask ? depTask.description : depId;
      taskAcceptance.push(
        buildCriterion(
          `task_ac_dep_${String(idx + 1).padStart(3, "0")}`,
          "task",
          `Dependency "${depId}" must be satisfied: ${depDesc}`,
          { evidence_required: true, blocking: true }
        )
      );
    });
    taskAcceptance.push(
      buildCriterion(
        "task_ac_no_regression",
        "task",
        "No new blockers introduced by this task.",
        { evidence_required: true, blocking: true }
      )
    );
  }
  const handoffAcceptance = [];
  const handoff = buildExecutionHandoff(state, decomposition);
  if (handoff) {
    const handoffCriteriaSource = handoff.acceptance_criteria || [];
    handoffCriteriaSource.forEach((desc, idx) => {
      handoffAcceptance.push(
        buildCriterion(
          `handoff_ac_${String(idx + 1).padStart(3, "0")}`,
          "handoff",
          desc,
          { evidence_required: true, blocking: true }
        )
      );
    });
  }
  return {
    phase_acceptance: phaseAcceptance,
    task_acceptance: taskAcceptance,
    handoff_acceptance: handoffAcceptance,
    current_phase: activePhase ? activePhase.id : state.current_phase,
    current_task: currentTaskId || null,
    has_handoff: handoff !== null,
    generated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(bindAcceptanceCriteria, "bindAcceptanceCriteria");
var MAX_RETRY_ATTEMPTS = 3;
var ERROR_CLASSIFICATIONS = ["in_scope", "infra", "external", "unknown"];
var NON_RETRYABLE_CLASSIFICATIONS = ["infra", "external", "unknown"];
function buildErrorEntry(params) {
  const p = params || {};
  return {
    code: p.code || "UNKNOWN_ERROR",
    scope: p.scope || "task",
    message: p.message || "No message provided.",
    retryable: p.retryable !== void 0 ? p.retryable : false,
    reason: p.reason || null,
    attempt: typeof p.attempt === "number" ? p.attempt : 1,
    max_attempts: typeof p.max_attempts === "number" ? p.max_attempts : MAX_RETRY_ATTEMPTS,
    resolution_state: p.resolution_state || "unresolved",
    classification: ERROR_CLASSIFICATIONS.includes(p.classification) ? p.classification : "unknown",
    recorded_at: p.recorded_at || (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(buildErrorEntry, "buildErrorEntry");
function evaluateErrorLoop(errorLoop, taskId) {
  const defaultResult = {
    loop_status: "clear",
    retry_allowed: false,
    active_retry_count: 0,
    retry_count: 0,
    last_error: null,
    escalation_reason: null
  };
  if (!errorLoop || !taskId) {
    return defaultResult;
  }
  const taskLoop = errorLoop[taskId];
  if (!taskLoop || !Array.isArray(taskLoop.errors) || taskLoop.errors.length === 0) {
    return defaultResult;
  }
  const errors = taskLoop.errors;
  const lastError = errors[errors.length - 1];
  const activeRetryCount = typeof taskLoop.active_retry_count === "number" ? taskLoop.active_retry_count : errors.length;
  const totalErrorCount = errors.length;
  const maxAttempts = MAX_RETRY_ATTEMPTS;
  if (NON_RETRYABLE_CLASSIFICATIONS.includes(lastError.classification)) {
    let escalationReason;
    if (lastError.classification === "infra") {
      escalationReason = "Infrastructure/secret/binding/dependency error \u2014 requires human intervention.";
    } else if (lastError.classification === "external") {
      escalationReason = "External dependency outside contract scope \u2014 requires human intervention.";
    } else {
      escalationReason = "Unknown error cause \u2014 cannot determine safe retry path.";
    }
    return {
      loop_status: "awaiting_human",
      retry_allowed: false,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: escalationReason
    };
  }
  if (activeRetryCount >= maxAttempts) {
    return {
      loop_status: "blocked",
      retry_allowed: false,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: `Retry limit reached (${activeRetryCount}/${maxAttempts}) for task "${taskId}".`
    };
  }
  if (lastError.retryable && lastError.classification === "in_scope") {
    return {
      loop_status: "retrying",
      retry_allowed: true,
      active_retry_count: activeRetryCount,
      retry_count: totalErrorCount,
      last_error: lastError,
      escalation_reason: null
    };
  }
  return {
    loop_status: "awaiting_human",
    retry_allowed: false,
    active_retry_count: activeRetryCount,
    retry_count: totalErrorCount,
    last_error: lastError,
    escalation_reason: `Error not eligible for retry: retryable=${lastError.retryable}, classification="${lastError.classification}".`
  };
}
__name(evaluateErrorLoop, "evaluateErrorLoop");
async function recordError(env, contractId, taskId, errorParams) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` };
  }
  if (TASK_DONE_STATUSES.includes(task.status)) {
    return {
      ok: false,
      error: "INVALID_ERROR_RECORD",
      message: `Task "${taskId}" has status "${task.status}" \u2014 cannot record error on completed/done task.`
    };
  }
  if (task.status === "blocked") {
    return {
      ok: false,
      error: "TASK_BLOCKED",
      message: `Task "${taskId}" is blocked \u2014 cannot record new error. Resolve the block first.`
    };
  }
  if (state.error_loop && state.error_loop[taskId] && state.error_loop[taskId].loop_status === "blocked") {
    return {
      ok: false,
      error: "TASK_BLOCKED",
      message: `Task "${taskId}" error loop is blocked \u2014 cannot record new error. Resolve the block first.`
    };
  }
  if (!state.error_loop) {
    state.error_loop = {};
  }
  if (!state.error_loop[taskId]) {
    state.error_loop[taskId] = {
      errors: [],
      active_retry_count: 0,
      loop_status: "clear",
      retry_count: 0,
      last_error: null,
      retry_allowed: false,
      escalation_reason: null
    };
  }
  const taskLoop = state.error_loop[taskId];
  taskLoop.active_retry_count = (taskLoop.active_retry_count || 0) + 1;
  const attempt = taskLoop.active_retry_count;
  const entry = buildErrorEntry(
    Object.assign({}, errorParams, { attempt, max_attempts: MAX_RETRY_ATTEMPTS })
  );
  taskLoop.errors.push(entry);
  const evaluation = evaluateErrorLoop(state.error_loop, taskId);
  taskLoop.loop_status = evaluation.loop_status;
  taskLoop.active_retry_count = evaluation.active_retry_count;
  taskLoop.retry_count = evaluation.retry_count;
  taskLoop.last_error = evaluation.last_error;
  taskLoop.retry_allowed = evaluation.retry_allowed;
  taskLoop.escalation_reason = evaluation.escalation_reason;
  state.updated_at = (/* @__PURE__ */ new Date()).toISOString();
  await env.ENAVIA_BRAIN.put(
    `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_STATE}`,
    JSON.stringify(state)
  );
  return {
    ok: true,
    state,
    decomposition,
    error_loop: state.error_loop,
    evaluation
  };
}
__name(recordError, "recordError");
function _appendExecutionCycle(state, cycle) {
  if (!state.task_execution_log || typeof state.task_execution_log !== "object") {
    state.task_execution_log = {};
  }
  const taskId = cycle.task_id;
  if (!taskId) return;
  if (!Array.isArray(state.task_execution_log[taskId])) {
    state.task_execution_log[taskId] = [];
  }
  state.task_execution_log[taskId].push({ ...cycle, executor_artifacts: null });
}
__name(_appendExecutionCycle, "_appendExecutionCycle");
function _recordExecutorArtifacts(state, taskId, executor_artifacts) {
  if (!state.task_execution_log || typeof state.task_execution_log !== "object") {
    state.task_execution_log = {};
  }
  if (!Array.isArray(state.task_execution_log[taskId])) {
    state.task_execution_log[taskId] = [];
  }
  const log = state.task_execution_log[taskId];
  const lastCycle = log.length > 0 ? log[log.length - 1] : null;
  if (lastCycle && lastCycle.executor_artifacts === null) {
    lastCycle.executor_artifacts = executor_artifacts;
  } else {
    log.push({
      task_id: taskId,
      micro_pr_id: null,
      execution_status: "audit_only",
      execution_started_at: null,
      execution_finished_at: null,
      execution_evidence: [],
      executor_artifacts
    });
  }
}
__name(_recordExecutorArtifacts, "_recordExecutorArtifacts");
function _resolveExecutorArtifactsFromLog(cycles) {
  if (!Array.isArray(cycles)) return null;
  for (let i = cycles.length - 1; i >= 0; i--) {
    if (cycles[i] && cycles[i].executor_artifacts) {
      return cycles[i].executor_artifacts;
    }
  }
  return null;
}
__name(_resolveExecutorArtifactsFromLog, "_resolveExecutorArtifactsFromLog");
function buildExecEvent(status, handoff, microPrId, motivo, enrichment) {
  const base = {
    status_atual: status,
    arquivo_atual: Array.isArray(handoff.target_files) && handoff.target_files.length > 0 ? handoff.target_files.join(", ") : null,
    bloco_atual: handoff.source_task || null,
    operacao_atual: handoff.objective || null,
    motivo_curto: motivo || null,
    patch_atual: microPrId || null,
    emitted_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  const enr = enrichment || {};
  base.metrics = enr.metrics || null;
  base.executionSummary = enr.executionSummary || null;
  base.result = enr.result || null;
  return base;
}
__name(buildExecEvent, "buildExecEvent");
async function emitExecEvent(env, contractId, event) {
  try {
    const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    await env.ENAVIA_BRAIN.put(key, JSON.stringify(event));
    await env.ENAVIA_BRAIN.put("execution:exec_event:latest_contract_id", contractId);
  } catch (_) {
  }
}
__name(emitExecEvent, "emitExecEvent");
async function readExecEvent(env, contractId) {
  try {
    const key = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_EXEC_EVENT}`;
    const raw = await env.ENAVIA_BRAIN.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch (_) {
    return null;
  }
}
__name(readExecEvent, "readExecEvent");
var _functionalLogSeq = 0;
function _flogKeySuffix() {
  _functionalLogSeq++;
  const rand = Math.floor(Math.random() * 65535).toString(16).padStart(4, "0");
  return `${Date.now()}_${_functionalLogSeq}_${rand}`;
}
__name(_flogKeySuffix, "_flogKeySuffix");
function _buildFunctionalLog(type, label, message) {
  return {
    id: `fl_${_flogKeySuffix()}`,
    type,
    label,
    message,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
}
__name(_buildFunctionalLog, "_buildFunctionalLog");
async function appendFunctionalLog(env, contractId, log) {
  try {
    const entryKey = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FLOG_ENTRY}${_flogKeySuffix()}`;
    await env.ENAVIA_BRAIN.put(entryKey, JSON.stringify(log));
  } catch (_) {
  }
}
__name(appendFunctionalLog, "appendFunctionalLog");
async function readFunctionalLogs(env, contractId) {
  try {
    const prefix = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FLOG_ENTRY}`;
    if (typeof env.ENAVIA_BRAIN.list === "function") {
      const allKeys = [];
      let cursor = void 0;
      let hasMore = true;
      while (hasMore) {
        const listOpts = { prefix };
        if (cursor) listOpts.cursor = cursor;
        const listed = await env.ENAVIA_BRAIN.list(listOpts);
        const keys = listed.keys || [];
        for (const { name } of keys) {
          allKeys.push(name);
        }
        if (!listed.list_complete && listed.cursor) {
          cursor = listed.cursor;
        } else {
          hasMore = false;
        }
      }
      if (allKeys.length > 0) {
        const recentKeys = allKeys.length > MAX_FUNCTIONAL_LOGS_PER_CONTRACT ? allKeys.slice(-MAX_FUNCTIONAL_LOGS_PER_CONTRACT) : allKeys;
        const logs = [];
        for (const name of recentKeys) {
          const raw = await env.ENAVIA_BRAIN.get(name);
          if (raw) {
            try {
              logs.push(JSON.parse(raw));
            } catch (_) {
            }
          }
        }
        return logs;
      }
    }
    const legacyKey = `${KV_PREFIX_STATE}${contractId}${KV_SUFFIX_FUNCTIONAL_LOGS}`;
    const legacyRaw = await env.ENAVIA_BRAIN.get(legacyKey);
    return legacyRaw ? JSON.parse(legacyRaw) : [];
  } catch (_) {
    return [];
  }
}
__name(readFunctionalLogs, "readFunctionalLogs");
async function executeCurrentMicroPr(env, contractId, executionParams) {
  const params = executionParams || {};
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  const currentTaskId = state.current_task;
  if (!currentTaskId) {
    return { ok: false, error: "NO_CURRENT_TASK", message: "No current_task set on contract \u2014 cannot execute." };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === currentTaskId);
  if (!task) {
    return { ok: false, error: "TASK_NOT_FOUND", message: `Current task "${currentTaskId}" not found in decomposition.` };
  }
  if (task.status !== "in_progress") {
    return {
      ok: false,
      error: "TASK_NOT_IN_PROGRESS",
      message: `Task "${currentTaskId}" has status "${task.status}" \u2014 must be "in_progress" to execute.`
    };
  }
  const supervisorGatesContext = {
    scope_defined: !!state.scope,
    environment_defined: true,
    risk_assessed: true,
    authorization_present_when_required: task.status === "in_progress",
    observability_preserved: true,
    evidence_available_when_required: true
  };
  const supervisorGate = _runSupervisorGate({
    action: "execute_in_test_within_scope",
    environment: "TEST",
    scope_approved: !!state.scope,
    gates_context: supervisorGatesContext,
    // evidence_sufficient derived from the canonical P23 gate — the real source
    evidence_sufficient: supervisorGatesContext.evidence_available_when_required === true
  });
  if (!supervisorGate.pass) {
    const blockResp = _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "bloqueio",
      `Supervisor bloqueou execu\xE7\xE3o \u2014 task ${currentTaskId}`,
      `Gate: ${supervisorGate.supervisorDecision.reason_code || "UNKNOWN"}. Motivo: ${supervisorGate.supervisorDecision.reason_text || "N/A"}.`
    ));
    return {
      ...blockResp,
      // Backwards-compatible: keep constitution_enforcement shape for callers
      // that already handle it. The supervisor_enforcement field is additive.
      // Note: 'level' maps to supervisor reason_code (e.g. SCOPE_VIOLATION, AUTONOMY_BLOCKED)
      // which is the closest semantic equivalent to the original P23 enforcement level.
      constitution_enforcement: {
        allowed: false,
        blocked: true,
        level: supervisorGate.supervisorDecision.reason_code,
        reason: supervisorGate.supervisorDecision.reason_text
      }
    };
  }
  const phases = decomposition.phases || [];
  const tasks = decomposition.tasks || [];
  const mprs = decomposition.micro_pr_candidates || [];
  const activePhase = phases.find((p) => p.tasks && p.tasks.includes(currentTaskId)) || phases.find((p) => p.status !== "done");
  const testMprCandidates = mprs.filter(
    (m) => m.task_id === currentTaskId && m.environment === "TEST" && (m.status === "queued" || m.status === "in_progress")
  );
  const targetMpr = testMprCandidates.length > 0 ? testMprCandidates[0] : null;
  if (!targetMpr) {
    return {
      ok: false,
      error: "NO_ACTIVE_TEST_MICRO_PR",
      message: `No active TEST micro-PR found for task "${currentTaskId}" \u2014 C1 requires a real micro-PR in TEST environment.`
    };
  }
  const handoffObjective = task.description;
  if (!handoffObjective) {
    return {
      ok: false,
      error: "NO_VALID_HANDOFF",
      message: "Cannot build execution handoff \u2014 task has no description."
    };
  }
  const scopeWorkers = targetMpr.target_workers || [];
  const scopeRoutes = targetMpr.target_routes || [];
  const handoffEnvironment = targetMpr.environment;
  const handoff = {
    objective: handoffObjective,
    scope: {
      environment: handoffEnvironment,
      workers: scopeWorkers,
      routes: scopeRoutes,
      phase: activePhase ? activePhase.name : null
    },
    target_files: [],
    do_not_touch: [
      "PROD environment (unless handoff environment is PROD and human-approved)",
      "Unrelated workers or routes outside contract scope"
    ],
    smoke_tests: [`Verify: ${task.description}`, "Deploy to TEST and validate endpoint behavior"],
    rollback: "Revert branch changes; redeploy previous TEST version.",
    acceptance_criteria: [task.description, "Smoke test in TEST passes", "No new blockers introduced"],
    source_phase: activePhase ? activePhase.id : null,
    source_task: currentTaskId,
    source_micro_pr: targetMpr.id,
    generated_at: (/* @__PURE__ */ new Date()).toISOString()
  };
  for (const worker of scopeWorkers) {
    if (worker === "nv-enavia") {
      handoff.target_files.push("nv-enavia.js", "contract-executor.js", "wrangler.toml");
    } else {
      handoff.target_files.push(`${worker}.js`);
    }
  }
  if (handoff.scope.environment !== "TEST") {
    return {
      ok: false,
      error: "NOT_TEST_ENVIRONMENT",
      message: `Execution handoff targets "${handoff.scope ? handoff.scope.environment : "unknown"}" \u2014 only TEST is allowed in C1.`
    };
  }
  const executionStartedAt = (/* @__PURE__ */ new Date()).toISOString();
  const microPrId = targetMpr.id;
  state.current_execution = {
    contract_id: contractId,
    task_id: currentTaskId,
    micro_pr_id: microPrId,
    handoff_used: handoff,
    execution_status: "running",
    execution_started_at: executionStartedAt,
    execution_finished_at: null,
    execution_evidence: [],
    execution_error: null,
    test_execution: true,
    last_execution_result: null
  };
  state.updated_at = executionStartedAt;
  const _totalTasks = (decomposition.tasks || []).length;
  const _doneTasks = (decomposition.tasks || []).filter((t) => t.status === "done" || t.status === "completed").length;
  await emitExecEvent(env, contractId, buildExecEvent("running", handoff, microPrId, null, {
    metrics: {
      stepsTotal: _totalTasks,
      stepsDone: _doneTasks,
      elapsedMs: 0
    },
    executionSummary: {
      finalStatus: "running",
      taskId: currentTaskId,
      microPrId,
      hadBlock: false,
      evidenceCount: 0
    },
    result: null
  }));
  await appendFunctionalLog(env, contractId, _buildFunctionalLog(
    "decisao",
    `Execu\xE7\xE3o iniciada \u2014 task ${currentTaskId}`,
    `Executor iniciou ciclo para task "${currentTaskId}" (micro-PR: ${microPrId}) em ambiente ${handoff.scope.environment}. Objetivo: ${handoff.objective || "N/A"}.`
  ));
  await persistContract(env, state, decomposition);
  let executionSuccess = true;
  let executionError = null;
  let evidence = Array.isArray(params.evidence) ? params.evidence.slice() : [];
  if (params.simulate_failure) {
    executionSuccess = false;
    executionError = {
      code: params.simulate_failure.code || "EXECUTION_FAILED",
      message: params.simulate_failure.message || "Execution failed during TEST run.",
      classification: params.simulate_failure.classification || "in_scope"
    };
  }
  const executionFinishedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (executionSuccess) {
    if (evidence.length === 0) {
      evidence.push(`Task "${currentTaskId}" executed successfully in TEST at ${executionFinishedAt}`);
    }
    state.current_execution.execution_status = "success";
    state.current_execution.execution_finished_at = executionFinishedAt;
    state.current_execution.execution_evidence = evidence;
    state.current_execution.last_execution_result = "success";
    if (targetMpr && targetMpr.status === "queued") {
      targetMpr.status = "in_progress";
    }
    _appendExecutionCycle(state, state.current_execution);
    state.updated_at = executionFinishedAt;
    const _successElapsedMs = new Date(executionFinishedAt).getTime() - new Date(executionStartedAt).getTime();
    const _successDoneTasks = _doneTasks + 1;
    await emitExecEvent(env, contractId, buildExecEvent("success", handoff, microPrId, null, {
      metrics: {
        stepsTotal: _totalTasks,
        stepsDone: _successDoneTasks,
        elapsedMs: _successElapsedMs
      },
      executionSummary: {
        finalStatus: "success",
        taskId: currentTaskId,
        microPrId,
        hadBlock: false,
        evidenceCount: evidence.length
      },
      result: {
        summary: `Task "${currentTaskId}" conclu\xEDda com sucesso em ${_successElapsedMs}ms. ${evidence.length} evid\xEAncia(s) registrada(s).`,
        status: "success"
      }
    }));
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "consolidacao",
      `Task ${currentTaskId} conclu\xEDda com sucesso`,
      `Execu\xE7\xE3o finalizada em ${_successElapsedMs}ms. Evid\xEAncias: ${evidence.join("; ") || "nenhuma expl\xEDcita"}. Micro-PR: ${microPrId}.`
    ));
    await persistContract(env, state, decomposition);
    return {
      ok: true,
      execution_status: "success",
      task_id: currentTaskId,
      micro_pr_id: microPrId,
      evidence,
      handoff_used: handoff,
      execution_started_at: executionStartedAt,
      execution_finished_at: executionFinishedAt,
      state,
      decomposition
    };
  } else {
    state.current_execution.execution_status = "failed";
    state.current_execution.execution_finished_at = executionFinishedAt;
    state.current_execution.execution_error = executionError;
    state.current_execution.last_execution_result = "failed";
    state.current_execution.execution_evidence = evidence;
    _appendExecutionCycle(state, state.current_execution);
    state.updated_at = executionFinishedAt;
    const _failElapsedMs = new Date(executionFinishedAt).getTime() - new Date(executionStartedAt).getTime();
    const _failMotivo = executionError && executionError.message ? String(executionError.message).slice(0, 120) : "execution_failed";
    await emitExecEvent(env, contractId, buildExecEvent(
      "failed",
      handoff,
      microPrId,
      _failMotivo,
      {
        metrics: {
          stepsTotal: _totalTasks,
          stepsDone: _doneTasks,
          elapsedMs: _failElapsedMs
        },
        executionSummary: {
          finalStatus: "failed",
          taskId: currentTaskId,
          microPrId,
          hadBlock: !!(executionError.classification === "out_of_scope"),
          evidenceCount: evidence.length
        },
        result: {
          summary: `Task "${currentTaskId}" falhou ap\xF3s ${_failElapsedMs}ms: ${_failMotivo}`,
          status: "failed"
        }
      }
    ));
    await appendFunctionalLog(env, contractId, _buildFunctionalLog(
      "bloqueio",
      `Falha na execu\xE7\xE3o \u2014 task ${currentTaskId}`,
      `Erro: ${_failMotivo}. Classifica\xE7\xE3o: ${executionError.classification || "desconhecida"}. Micro-PR: ${microPrId}. Dura\xE7\xE3o: ${_failElapsedMs}ms.`
    ));
    await persistContract(env, state, decomposition);
    const errorResult = await recordError(env, contractId, currentTaskId, {
      code: executionError.code,
      scope: "task",
      message: executionError.message,
      retryable: executionError.classification === "in_scope",
      classification: executionError.classification,
      reason: `Execution failed in TEST: ${executionError.message}`
    });
    const { state: freshState, decomposition: freshDecomp } = await rehydrateContract(env, contractId);
    return {
      ok: false,
      error: "EXECUTION_FAILED",
      execution_status: "failed",
      task_id: currentTaskId,
      micro_pr_id: microPrId,
      execution_error: executionError,
      evidence,
      handoff_used: handoff,
      execution_started_at: executionStartedAt,
      execution_finished_at: executionFinishedAt,
      error_loop: freshState ? freshState.error_loop : null,
      error_loop_evaluation: errorResult.evaluation || null,
      state: freshState || state,
      decomposition: freshDecomp || decomposition
    };
  }
}
__name(executeCurrentMicroPr, "executeCurrentMicroPr");
async function closeContractInTest(env, contractId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  if (state.contract_closure && state.contract_closure.closure_status === "closed_in_test") {
    return {
      ok: true,
      already_closed: true,
      contract_closure: state.contract_closure,
      message: "Contract already closed in TEST.",
      state,
      decomposition
    };
  }
  const exec = state.current_execution;
  if (!exec) {
    return {
      ok: false,
      error: "NO_EXECUTION",
      message: "No execution recorded \u2014 cannot close contract without a successful TEST execution."
    };
  }
  if (exec.execution_status !== "success") {
    return {
      ok: false,
      error: "EXECUTION_NOT_SUCCESSFUL",
      message: `Execution status is "${exec.execution_status}" \u2014 must be "success" to close.`
    };
  }
  if (!exec.test_execution) {
    return {
      ok: false,
      error: "NOT_TEST_EXECUTION",
      message: "Last execution was not a TEST execution \u2014 cannot close in TEST without TEST execution."
    };
  }
  const blockers = state.blockers || [];
  if (blockers.length > 0) {
    return {
      ok: false,
      error: "ACTIVE_BLOCKERS",
      message: `Contract has ${blockers.length} active blocker(s): ${blockers.join("; ")}`
    };
  }
  const currentTaskId = exec.task_id || state.current_task;
  if (currentTaskId && state.error_loop && state.error_loop[currentTaskId]) {
    const taskLoop = state.error_loop[currentTaskId];
    if (taskLoop.loop_status === "blocked" || taskLoop.loop_status === "awaiting_human") {
      return {
        ok: false,
        error: "ERROR_LOOP_BLOCKED",
        message: `Error loop for task "${currentTaskId}" is "${taskLoop.loop_status}" \u2014 cannot close with active error loop.`
      };
    }
  }
  const binding = bindAcceptanceCriteria(state, decomposition);
  if (binding) {
    const allCriteria = [
      ...binding.phase_acceptance || [],
      ...binding.task_acceptance || [],
      ...binding.handoff_acceptance || []
    ];
    const pendingBlocking = allCriteria.filter(
      (c) => c.status === "pending" && c.blocking === true
    );
    if (pendingBlocking.length > 0) {
      return {
        ok: false,
        error: "ACCEPTANCE_PENDING",
        message: `${pendingBlocking.length} blocking acceptance criteria still pending: ${pendingBlocking.map((c) => c.id).join(", ")}`
      };
    }
  }
  const tasks = decomposition.tasks || [];
  if (currentTaskId) {
    const task = tasks.find((t) => t.id === currentTaskId);
    if (task && !TASK_DONE_STATUSES.includes(task.status)) {
      return {
        ok: false,
        error: "TASK_NOT_CLOSEABLE",
        message: `Task "${currentTaskId}" has status "${task.status}" \u2014 must be in a final state (${TASK_DONE_STATUSES.join(", ")}) to close.`
      };
    }
  }
  const finalAudit = auditFinalContract({ state, decomposition });
  if (!finalAudit.can_close_contract) {
    return {
      ok: false,
      error: "FINAL_AUDIT_REJECTED",
      message: `Fechamento do contrato bloqueado pelo gate final: ${finalAudit.final_reason}`,
      final_adherence_status: finalAudit.final_adherence_status,
      missing_items: finalAudit.missing_items,
      partial_microsteps: finalAudit.partial_microsteps,
      out_of_contract_microsteps: finalAudit.out_of_contract_microsteps,
      unauthorized_items: finalAudit.unauthorized_items,
      evidence_sufficiency: finalAudit.evidence_sufficiency,
      final_audit_snapshot: finalAudit,
      final_next_action: finalAudit.final_next_action
    };
  }
  const closedAt = (/* @__PURE__ */ new Date()).toISOString();
  const closureEvidence = [
    `Execution succeeded in TEST at ${exec.execution_finished_at || closedAt}`,
    `Task "${currentTaskId || "unknown"}" execution_status=success`,
    `No active blockers at closure time`,
    `Error loop clear for current task`,
    ...exec.execution_evidence || []
  ];
  state.contract_closure = {
    closure_status: "closed_in_test",
    closed_in_test: true,
    closed_at: closedAt,
    closure_evidence: closureEvidence,
    closure_reason: "All canonical closure criteria satisfied in TEST.",
    closed_task_id: currentTaskId || null,
    closed_micro_pr_id: exec.micro_pr_id || null,
    closed_by: "automatic",
    environment: "TEST"
  };
  state.updated_at = closedAt;
  const transition = transitionStatusGlobal(state, "test-complete", "closeContractInTest");
  if (!transition.ok) {
    return { ok: false, error: transition.error, message: transition.message };
  }
  state.next_action = "Contract closed in TEST. Awaiting PROD promotion decision.";
  await persistContract(env, state, decomposition);
  return {
    ok: true,
    already_closed: false,
    contract_closure: state.contract_closure,
    message: "Contract closed automatically in TEST.",
    state,
    decomposition
  };
}
__name(closeContractInTest, "closeContractInTest");
async function handleCloseContractInTest(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." }
    };
  }
  const result = await closeContractInTest(env, contractId);
  return {
    status: result.ok ? 200 : 400,
    body: {
      ok: result.ok,
      already_closed: result.already_closed || false,
      contract_closure: result.contract_closure || null,
      error: result.error || null,
      message: result.message,
      // 🛡️ PR3 — expõe snapshot auditável quando gate final bloqueia
      final_adherence_status: result.final_adherence_status || null,
      final_audit_snapshot: result.final_audit_snapshot || null,
      final_next_action: result.final_next_action || null,
      missing_items: result.missing_items || null,
      partial_microsteps: result.partial_microsteps || null,
      out_of_contract_microsteps: result.out_of_contract_microsteps || null,
      unauthorized_items: result.unauthorized_items || null,
      evidence_sufficiency: result.evidence_sufficiency != null ? result.evidence_sufficiency : null
    }
  };
}
__name(handleCloseContractInTest, "handleCloseContractInTest");
var FINAL_CLOSURE_SOURCE_STATUSES = [
  "decomposed",
  "executing",
  "validating",
  "blocked",
  "awaiting-human",
  "test-complete",
  "prod-pending"
];
async function closeFinalContract(env, contractId) {
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state) {
    return { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` };
  }
  if (!decomposition) {
    return { ok: false, error: "DECOMPOSITION_NOT_FOUND", message: `Decomposition for "${contractId}" not found.` };
  }
  if (isCancelledContract(state)) {
    return cancelledResult(contractId);
  }
  if (isPlanRejected(state)) {
    return planRejectedResult(contractId);
  }
  if (state.status_global === "completed") {
    return {
      ok: true,
      already_completed: true,
      contract_closure: state.contract_closure || null,
      message: "Contract already marked as completed.",
      state,
      decomposition
    };
  }
  if (!FINAL_CLOSURE_SOURCE_STATUSES.includes(state.status_global)) {
    return {
      ok: false,
      error: "INVALID_STATUS_FOR_FINAL_CLOSURE",
      message: `Contract "${contractId}" has status_global "${state.status_global}" \u2014 cannot close-final from this state. Expected one of: ${FINAL_CLOSURE_SOURCE_STATUSES.join(", ")}.`
    };
  }
  const finalAudit = auditFinalContract({ state, decomposition });
  if (!finalAudit.can_close_contract) {
    return {
      ok: false,
      error: "FINAL_AUDIT_REJECTED",
      message: `Fechamento final bloqueado \u2014 ${finalAudit.final_reason}`,
      final_adherence_status: finalAudit.final_adherence_status,
      missing_items: finalAudit.missing_items,
      partial_microsteps: finalAudit.partial_microsteps,
      out_of_contract_microsteps: finalAudit.out_of_contract_microsteps,
      unauthorized_items: finalAudit.unauthorized_items,
      evidence_sufficiency: finalAudit.evidence_sufficiency,
      final_audit_snapshot: finalAudit,
      final_next_action: finalAudit.final_next_action
    };
  }
  const completedAt = (/* @__PURE__ */ new Date()).toISOString();
  state.contract_closure = Object.assign(state.contract_closure || {}, {
    closure_status: "completed",
    final_completed: true,
    completed_at: completedAt,
    final_audit_snapshot: finalAudit,
    closure_reason: "All final contractual closure criteria satisfied. Gate final aderente.",
    closed_by: "final_gate",
    environment: "FINAL"
  });
  state.updated_at = completedAt;
  state.next_action = "Contrato conclu\xEDdo e auditado. Nenhuma a\xE7\xE3o adicional necess\xE1ria.";
  const originalStatus = state.status_global;
  const DIRECT_TO_COMPLETED = ["executing", "validating", "test-complete", "prod-pending"];
  if (!DIRECT_TO_COMPLETED.includes(state.status_global)) {
    const intermediateTransition = transitionStatusGlobal(state, "executing", "closeFinalContract:intermediate");
    if (!intermediateTransition.ok) {
      state.status_global = originalStatus;
      return { ok: false, error: intermediateTransition.error, message: intermediateTransition.message };
    }
  }
  const transition = transitionStatusGlobal(state, "completed", "closeFinalContract");
  if (!transition.ok) {
    state.status_global = originalStatus;
    return { ok: false, error: transition.error, message: transition.message };
  }
  await persistContract(env, state, decomposition);
  return {
    ok: true,
    already_completed: false,
    final_audit_snapshot: finalAudit,
    contract_closure: state.contract_closure,
    message: "Contrato marcado como conclu\xEDdo ap\xF3s auditoria final aderente.",
    state,
    decomposition
  };
}
__name(closeFinalContract, "closeFinalContract");
async function handleCloseFinalContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body && body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_CONTRACT_ID", message: "contract_id is required." }
    };
  }
  const result = await closeFinalContract(env, contractId);
  if (!result.ok) {
    const notFoundErrors = ["CONTRACT_NOT_FOUND", "DECOMPOSITION_NOT_FOUND"];
    const httpStatus = notFoundErrors.includes(result.error) ? 404 : 422;
    return {
      status: httpStatus,
      body: {
        ok: false,
        error: result.error || null,
        message: result.message,
        final_adherence_status: result.final_adherence_status || null,
        final_audit_snapshot: result.final_audit_snapshot || null,
        final_next_action: result.final_next_action || null,
        missing_items: result.missing_items || null,
        partial_microsteps: result.partial_microsteps || null,
        out_of_contract_microsteps: result.out_of_contract_microsteps || null,
        unauthorized_items: result.unauthorized_items || null,
        evidence_sufficiency: result.evidence_sufficiency != null ? result.evidence_sufficiency : null
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      already_completed: result.already_completed || false,
      final_audit_snapshot: result.final_audit_snapshot || null,
      contract_closure: result.contract_closure || null,
      message: result.message
    }
  };
}
__name(handleCloseFinalContract, "handleCloseFinalContract");
function buildContractSummary(state, decomposition) {
  const tasks = decomposition && decomposition.tasks || [];
  const mprs = decomposition && decomposition.micro_pr_candidates || [];
  const tasksCompleted = tasks.filter((t) => TASK_DONE_STATUSES.includes(t.status)).length;
  const tasksBlocked = tasks.filter((t) => t.status === "blocked").length;
  const tasksInProgress = tasks.filter((t) => t.status === "in_progress").length;
  const tasksQueued = tasks.filter((t) => t.status === "queued").length;
  const mprsCompleted = mprs.filter((m) => m.status === "completed").length;
  const mprsBlocked = mprs.filter((m) => m.status === "blocked").length;
  const mprsInProgress = mprs.filter((m) => m.status === "in_progress").length;
  const mprsQueued = mprs.filter((m) => m.status === "queued").length;
  const mprsDiscarded = mprs.filter((m) => m.status === "discarded").length;
  const nextActionResolved = resolveNextAction(state, decomposition);
  const executionHandoff = buildExecutionHandoff(state, decomposition);
  const acceptanceCriteriaBinding = bindAcceptanceCriteria(state, decomposition);
  return {
    contract_id: state.contract_id,
    contract_name: state.contract_name,
    status_global: state.status_global,
    current_phase: state.current_phase,
    current_task: state.current_task,
    blockers: state.blockers,
    next_action: state.next_action,
    next_action_resolved: nextActionResolved,
    execution_handoff: executionHandoff,
    acceptance_criteria_binding: acceptanceCriteriaBinding,
    error_loop: state.error_loop || null,
    current_execution: state.current_execution || null,
    contract_closure: state.contract_closure || null,
    contract_cancellation: state.contract_cancellation || null,
    plan_rejection: state.plan_rejection || null,
    plan_rejection_history: state.plan_rejection_history || [],
    tasks_total: tasks.length,
    tasks_completed: tasksCompleted,
    tasks_blocked: tasksBlocked,
    tasks_in_progress: tasksInProgress,
    tasks_queued: tasksQueued,
    micro_pr_candidates_total: mprs.length,
    micro_pr_candidates_completed: mprsCompleted,
    micro_pr_candidates_blocked: mprsBlocked,
    micro_pr_candidates_in_progress: mprsInProgress,
    micro_pr_candidates_queued: mprsQueued,
    micro_pr_candidates_discarded: mprsDiscarded,
    phases_count: decomposition ? decomposition.phases.length : 0,
    created_at: state.created_at,
    updated_at: state.updated_at
  };
}
__name(buildContractSummary, "buildContractSummary");
async function handleCreateContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const validation = validateContractPayload(body);
  if (!validation.valid) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "VALIDATION_ERROR",
        message: "Contract payload is invalid.",
        details: validation.errors
      }
    };
  }
  const existing = await readContractState(env, body.contract_id);
  if (existing) {
    return {
      status: 409,
      body: {
        ok: false,
        error: "CONTRACT_ALREADY_EXISTS",
        message: `Contract "${body.contract_id}" already exists.`,
        contract_id: body.contract_id,
        status_global: existing.status_global
      }
    };
  }
  const state = buildInitialState(body);
  const blockers = [];
  if (!state.scope.environments || state.scope.environments.length === 0) {
    blockers.push("scope.environments is empty \u2014 cannot determine target environments.");
  }
  if (!state.definition_of_done || state.definition_of_done.length === 0) {
    blockers.push("definition_of_done is empty \u2014 cannot decompose contract.");
  }
  if (blockers.length > 0) {
    const transition = transitionStatusGlobal(state, "blocked", "handleCreateContract:ingestion-blocked");
    if (!transition.ok) {
      return {
        status: 500,
        body: { ok: false, error: transition.error, message: transition.message }
      };
    }
    state.current_phase = "ingestion_blocked";
    state.blockers = blockers;
    state.next_action = "Resolve blockers before proceeding.";
  }
  const decomposition = generateDecomposition(state);
  const maxMicroPrs = typeof state.constraints.max_micro_prs === "number" ? state.constraints.max_micro_prs : null;
  if (maxMicroPrs !== null) {
    const taskCandidates = decomposition.micro_pr_candidates.filter(
      (m) => m.environment !== "PROD"
    );
    if (taskCandidates.length > maxMicroPrs) {
      if (state.status_global === "decomposed") {
        const t = transitionStatusGlobal(
          state,
          "blocked",
          "handleCreateContract:max-prs-exceeded"
        );
        if (!t.ok) {
          return { status: 500, body: { ok: false, error: t.error, message: t.message } };
        }
      }
      state.current_phase = "max_prs_exceeded";
      if (!Array.isArray(state.blockers)) state.blockers = [];
      state.blockers.push(
        `max_micro_prs limit (${maxMicroPrs}) exceeded \u2014 decomposition generated ${taskCandidates.length} micro-PR candidates.`
      );
      state.next_action = "Reduce definition_of_done or increase constraints.max_micro_prs to proceed.";
    }
  }
  const binding = bindAcceptanceCriteria(state, decomposition);
  state.acceptance_criteria_binding = binding;
  await persistContract(env, state, decomposition);
  return {
    status: 201,
    body: {
      ok: true,
      contract_id: state.contract_id,
      status_global: state.status_global,
      phases_count: decomposition.phases.length,
      tasks_count: decomposition.tasks.length,
      micro_pr_candidates_count: decomposition.micro_pr_candidates.length,
      next_action: state.next_action,
      created_at: state.created_at
    }
  };
}
__name(handleCreateContract, "handleCreateContract");
async function handleGetContract(env, contractId) {
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: 'Query parameter "id" is required.' }
    };
  }
  const state = await readContractState(env, contractId);
  if (!state) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` }
    };
  }
  const decomposition = await readContractDecomposition(env, contractId);
  return {
    status: 200,
    body: {
      ok: true,
      contract: state,
      decomposition: decomposition || null
    }
  };
}
__name(handleGetContract, "handleGetContract");
async function handleGetContractSummary(env, contractId) {
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: 'Query parameter "id" is required.' }
    };
  }
  const state = await readContractState(env, contractId);
  if (!state) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` }
    };
  }
  const decomposition = await readContractDecomposition(env, contractId);
  return {
    status: 200,
    body: Object.assign({ ok: true }, buildContractSummary(state, decomposition))
  };
}
__name(handleGetContractSummary, "handleGetContractSummary");
async function handleGetActiveSurface(env) {
  let index = [];
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY);
    if (raw) index = JSON.parse(raw);
  } catch (err) {
    console.error("[handleGetActiveSurface] Failed to read contract index:", err);
    index = [];
  }
  const emptySurface = {
    ok: true,
    source: "active-contract",
    contract: null,
    surface: { available: false, next_action: null, blocked: false, block_reason: null },
    // backward-compat: Panel reads active_state + adherence
    active_state: null,
    adherence: null
  };
  if (!Array.isArray(index) || index.length === 0) {
    return { status: 200, body: emptySurface };
  }
  for (let i = index.length - 1; i >= 0; i--) {
    const contractId = index[i];
    const state = await readContractState(env, contractId);
    if (!state) continue;
    if (TERMINAL_STATUSES.includes(state.status_global)) continue;
    const decomposition = await readContractDecomposition(env, contractId);
    const summary = buildContractSummary(state, decomposition);
    const blockers = Array.isArray(state.blockers) ? state.blockers : [];
    const isBlocked = blockers.length > 0;
    const blockReason = isBlocked ? blockers[0].reason || blockers[0] || null : null;
    const currentPr = state.current_task || null;
    return {
      status: 200,
      body: {
        ok: true,
        source: "active-contract",
        contract: {
          id: state.contract_id || null,
          title: state.contract_name || null,
          status: state.status_global || null,
          current_phase: state.current_phase || null,
          current_pr: currentPr,
          updated_at: state.updated_at || null
        },
        surface: {
          available: true,
          next_action: state.next_action || null,
          blocked: isBlocked,
          block_reason: blockReason
        },
        // backward-compat: Panel reads active_state + adherence
        active_state: summary,
        adherence: null
      }
    };
  }
  return { status: 200, body: emptySurface };
}
__name(handleGetActiveSurface, "handleGetActiveSurface");
async function handleExecuteContract(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return { status: 400, body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." } };
  }
  const contractId = body && body.contract_id;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"contract_id" is required in the request body.' }
    };
  }
  const result = await executeCurrentMicroPr(env, contractId, {
    evidence: body.evidence || [],
    simulate_failure: body.simulate_failure || null
  });
  if (result.ok) {
    return {
      status: 200,
      body: {
        ok: true,
        execution_status: result.execution_status,
        task_id: result.task_id,
        micro_pr_id: result.micro_pr_id,
        evidence: result.evidence,
        execution_started_at: result.execution_started_at,
        execution_finished_at: result.execution_finished_at
      }
    };
  }
  const clientErrors = [
    "NO_CURRENT_TASK",
    "TASK_NOT_IN_PROGRESS",
    "NO_VALID_HANDOFF",
    "NOT_TEST_ENVIRONMENT",
    "TASK_ORDER_MISMATCH",
    "NO_ACTIVE_TEST_MICRO_PR"
  ];
  const notFoundErrors = ["CONTRACT_NOT_FOUND", "DECOMPOSITION_NOT_FOUND", "TASK_NOT_FOUND"];
  let httpStatus = 500;
  if (clientErrors.includes(result.error)) httpStatus = 409;
  if (notFoundErrors.includes(result.error)) httpStatus = 404;
  if (result.error === "EXECUTION_FAILED") httpStatus = 200;
  return {
    status: httpStatus,
    body: {
      ok: false,
      error: result.error,
      message: result.message || "Execution failed.",
      execution_status: result.execution_status || null,
      task_id: result.task_id || null,
      micro_pr_id: result.micro_pr_id || null,
      execution_error: result.execution_error || null,
      error_loop_evaluation: result.error_loop_evaluation || null
    }
  };
}
__name(handleExecuteContract, "handleExecuteContract");
function _buildContractMicrostepFromTask(task) {
  return {
    objetivo_contratual_exato: task.description || "",
    escopo_permitido: [],
    // escopo aberto — sem restrição explícita de escopo
    escopo_proibido: [],
    criterio_de_aceite_literal: task.description || ""
  };
}
__name(_buildContractMicrostepFromTask, "_buildContractMicrostepFromTask");
async function handleCompleteTask(request, env) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." }
    };
  }
  const contractId = body && body.contract_id;
  const taskId = body && body.task_id;
  const resultado = body && body.resultado;
  const executor_artifacts = body && body.executor_artifacts && typeof body.executor_artifacts === "object" ? body.executor_artifacts : void 0;
  if (!contractId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"contract_id" is required.' }
    };
  }
  if (!taskId) {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"task_id" is required.' }
    };
  }
  if (!resultado || typeof resultado !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_REQUIRED",
        message: '"resultado" (MicrostepResultado) is required \u2014 the adherence gate cannot be bypassed.'
      }
    };
  }
  const { state, decomposition } = await rehydrateContract(env, contractId);
  if (!state || !decomposition) {
    return {
      status: 404,
      body: { ok: false, error: "CONTRACT_NOT_FOUND", message: `Contract "${contractId}" not found.` }
    };
  }
  const task = (decomposition.tasks || []).find((t) => t.id === taskId);
  if (!task) {
    return {
      status: 404,
      body: { ok: false, error: "TASK_NOT_FOUND", message: `Task "${taskId}" not found in contract "${contractId}".` }
    };
  }
  const contract_microstep = body.contract_microstep && typeof body.contract_microstep === "object" ? body.contract_microstep : _buildContractMicrostepFromTask(task);
  let adherenceAudit;
  try {
    adherenceAudit = evaluateAdherence({ contract: contract_microstep, resultado });
  } catch (err) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_ERROR",
        message: `Gate de ader\xEAncia rejeitou os dados fornecidos: ${err.message}`
      }
    };
  }
  if (!adherenceAudit.can_mark_concluded) {
    return {
      status: 422,
      body: {
        ok: false,
        error: "ADHERENCE_GATE_REJECTED",
        message: `Task "${taskId}" n\xE3o pode ser marcada como conclu\xEDda \u2014 ${adherenceAudit.reason}`,
        adherence_status: adherenceAudit.adherence_status,
        honest_status: adherenceAudit.honest_status,
        can_mark_concluded: false,
        campos_falhos: adherenceAudit.campos_falhos,
        next_action: adherenceAudit.next_action
      }
    };
  }
  const result = await _completeTaskCore(env, contractId, taskId);
  if (!result.ok) {
    const notFoundErrors = ["CONTRACT_NOT_FOUND", "TASK_NOT_FOUND"];
    const httpStatus = notFoundErrors.includes(result.error) ? 404 : 409;
    return {
      status: httpStatus,
      body: { ok: false, error: result.error, message: result.message }
    };
  }
  if (executor_artifacts) {
    _recordExecutorArtifacts(result.state, taskId, executor_artifacts);
    result.state.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    await persistContract(env, result.state, result.decomposition);
  }
  const persistedCycles = result.state.task_execution_log && Array.isArray(result.state.task_execution_log[taskId]) ? result.state.task_execution_log[taskId] : [];
  const resolvedArtifacts = executor_artifacts || _resolveExecutorArtifactsFromLog(persistedCycles);
  const executionAudit = auditExecution({
    state: result.state,
    decomposition: result.decomposition,
    microstep_id: taskId,
    executor_artifacts: resolvedArtifacts,
    execution_cycles: persistedCycles
  });
  return {
    status: 200,
    body: {
      ok: true,
      task_id: taskId,
      task_status: result.task.status,
      adherence_status: adherenceAudit.adherence_status,
      honest_status: adherenceAudit.honest_status,
      can_mark_concluded: true,
      campos_falhos: adherenceAudit.campos_falhos,
      execution_audit: executionAudit
    }
  };
}
__name(handleCompleteTask, "handleCompleteTask");
function executeGitHubPrAction({
  action,
  scope_approved,
  gates_context,
  drift_detected = false,
  regression_detected = false
} = {}) {
  const enforcement = enforceGitHubPrArm({
    action,
    scope_approved,
    gates_context,
    drift_detected,
    regression_detected
  });
  const resolvedGatesContext = gates_context || _CANONICAL_NULL_GATES_CONTEXT;
  const supervisorGate = _runSupervisorGate({
    action,
    environment: "TEST",
    scope_approved: scope_approved === true,
    gates_context: resolvedGatesContext,
    // Real source: evidence_available_when_required gate provided by the caller
    evidence_sufficient: !!resolvedGatesContext.evidence_available_when_required,
    arm_id: GITHUB_PR_ARM_ID,
    arm_check_result: {
      allowed: enforcement.allowed,
      reason: enforcement.reason,
      arm_id: enforcement.arm_id
    }
  });
  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "GITHUB_PR_ARM_BLOCKED",
      message: enforcement.reason,
      enforcement,
      supervisor_enforcement: supervisorGate.supervisorDecision
    };
  }
  if (!supervisorGate.pass) {
    return _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);
  }
  return {
    ok: true,
    execution_status: "executed",
    action: enforcement.action,
    arm_id: enforcement.arm_id,
    enforcement
  };
}
__name(executeGitHubPrAction, "executeGitHubPrAction");
function requestMergeApproval({
  scope_approved,
  gates_context,
  merge_context,
  drift_detected = false,
  regression_detected = false
} = {}) {
  const enforcement = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved,
    gates_context,
    merge_context,
    drift_detected,
    regression_detected
  });
  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "MERGE_NOT_READY",
      message: enforcement.reason,
      merge_status: enforcement.merge_gate ? enforcement.merge_gate.merge_status : MERGE_STATUS.NOT_READY,
      merge_gate: enforcement.merge_gate,
      enforcement
    };
  }
  return {
    ok: true,
    merge_status: MERGE_STATUS.APPROVED,
    message: enforcement.reason,
    merge_gate: enforcement.merge_gate,
    enforcement
  };
}
__name(requestMergeApproval, "requestMergeApproval");
function approveMerge({
  scope_approved,
  gates_context,
  merge_context,
  drift_detected = false,
  regression_detected = false
} = {}) {
  if (!merge_context || typeof merge_context !== "object") {
    return {
      ok: false,
      error: "MERGE_CONTEXT_MISSING",
      message: "merge_context \xE9 obrigat\xF3rio para approval de merge.",
      merge_status: MERGE_STATUS.NOT_READY
    };
  }
  const enforcement = enforceGitHubPrArm({
    action: "merge_to_main",
    scope_approved,
    gates_context,
    merge_context,
    drift_detected,
    regression_detected
  });
  if (!enforcement.allowed) {
    return {
      ok: false,
      error: "MERGE_BLOCKED",
      message: enforcement.reason,
      merge_status: enforcement.merge_gate ? enforcement.merge_gate.merge_status : MERGE_STATUS.BLOCKED,
      merge_gate: enforcement.merge_gate,
      enforcement
    };
  }
  return {
    ok: true,
    merge_status: MERGE_STATUS.APPROVED,
    can_merge: true,
    message: enforcement.reason,
    summary_for_merge: enforcement.merge_gate.summary_for_merge,
    reason_merge_ok: enforcement.merge_gate.reason_merge_ok,
    merge_gate: enforcement.merge_gate,
    enforcement
  };
}
__name(approveMerge, "approveMerge");
function _handleGithubBridgeRuntime(body) {
  if (!body || typeof body !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "Payload inv\xE1lido para modo github_bridge_runtime.",
        mode: "github_bridge_runtime",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false
      }
    };
  }
  const rawOps = Array.isArray(body.operations) ? body.operations : body.operation && typeof body.operation === "object" ? [body.operation] : [];
  if (rawOps.length === 0) {
    return {
      status: 400,
      body: {
        ok: false,
        error: "NO_OPERATIONS",
        message: "Nenhuma opera\xE7\xE3o v\xE1lida fornecida para o GitHub Bridge.",
        mode: "github_bridge_runtime",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false
      }
    };
  }
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const bridgePlan = _buildGithubBridgePlan({ operations: rawOps }, context);
  const requires_human_review = bridgePlan.requires_human_review || bridgePlan.safety_summary && bridgePlan.safety_summary.any_review || false;
  const blocked_operations = Array.isArray(bridgePlan.blocked_operations) ? bridgePlan.blocked_operations : [];
  return {
    status: 200,
    body: {
      ok: bridgePlan.ok === true,
      mode: "github_bridge_runtime",
      bridge_plan: bridgePlan,
      safety_summary: bridgePlan.safety_summary || {},
      event_summary: bridgePlan.event_summary || {},
      requires_human_review,
      blocked_operations,
      github_execution: false,
      side_effects: false,
      ready_for_real_execution: false,
      next_recommended_action: bridgePlan.next_recommended_action || "Aguardar aprova\xE7\xE3o humana antes de qualquer execu\xE7\xE3o real no GitHub."
    }
  };
}
__name(_handleGithubBridgeRuntime, "_handleGithubBridgeRuntime");
async function handleGitHubPrAction(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." }
    };
  }
  if (body && body.mode === "github_bridge_runtime") {
    return _handleGithubBridgeRuntime(body);
  }
  if (!body || typeof body.action !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_PARAM", message: '"action" is required.' }
    };
  }
  const result = executeGitHubPrAction({
    action: body.action,
    scope_approved: body.scope_approved === true,
    gates_context: body.gates_context || _CANONICAL_NULL_GATES_CONTEXT,
    drift_detected: body.drift_detected === true,
    regression_detected: body.regression_detected === true
  });
  return {
    status: result.ok ? 200 : 403,
    body: result
  };
}
__name(handleGitHubPrAction, "handleGitHubPrAction");
async function handleRequestMergeApproval(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." }
    };
  }
  const result = requestMergeApproval({
    scope_approved: body && body.scope_approved === true,
    gates_context: body && body.gates_context || {},
    merge_context: body && body.merge_context || null,
    drift_detected: body && body.drift_detected === true,
    regression_detected: body && body.regression_detected === true
  });
  return {
    status: result.ok ? 200 : 403,
    body: result
  };
}
__name(handleRequestMergeApproval, "handleRequestMergeApproval");
async function handleApproveMerge(request) {
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Request body must be valid JSON." }
    };
  }
  const merge_gate = body && body.merge_gate || null;
  const approval_status = body && body.approval_status || null;
  if (!merge_gate || typeof merge_gate !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MERGE_GATE_MISSING",
        message: "merge_gate \xE9 obrigat\xF3rio \u2014 envie o estado do gate emitido pelo backend."
      }
    };
  }
  if (merge_gate.merge_status !== "awaiting_formal_approval") {
    return {
      status: 403,
      body: {
        ok: false,
        error: "MERGE_NOT_AWAITING_APPROVAL",
        message: `Estado '${merge_gate.merge_status}' n\xE3o \xE9 compat\xEDvel com approval formal. Apenas 'awaiting_formal_approval' pode ser aprovado pelo painel.`,
        merge_status: merge_gate.merge_status
      }
    };
  }
  if (approval_status !== "approved") {
    return {
      status: 403,
      body: {
        ok: false,
        error: "APPROVAL_NOT_GIVEN",
        message: "approval_status deve ser 'approved' para concluir o merge formal."
      }
    };
  }
  const result = approveMerge({
    scope_approved: true,
    gates_context: {
      arm_id: "p24_github_pr_arm",
      scope_defined: true,
      environment_defined: true,
      risk_assessed: true,
      authorization_present_when_required: true,
      observability_preserved: true,
      evidence_available_when_required: true
    },
    merge_context: {
      contract_rechecked: true,
      phase_validated: true,
      no_regression: true,
      diff_reviewed: true,
      summary_reviewed: true,
      summary_for_merge: merge_gate.summary_for_merge,
      reason_merge_ok: merge_gate.reason_merge_ok,
      approval_status: "approved"
    },
    drift_detected: false,
    regression_detected: false
  });
  return {
    status: result.ok ? 200 : 403,
    body: result
  };
}
__name(handleApproveMerge, "handleApproveMerge");
var BROWSER_EXECUTOR_RESPONSE_SHAPE = {
  required_fields: ["ok", "execution_status", "action"],
  optional_fields: ["target_url", "result_summary", "evidence", "error", "message", "suggestions"]
};
var _browserArmLastExecution = null;
var _browserArmSuggestions = [];
var KV_KEY_BROWSER_ARM_STATE = "browser-arm:state";
function buildSuggestionFromEnforcement(enforcement) {
  const levelDefs = {
    blocked_out_of_scope: {
      type: "capability",
      benefit: "Permitir esta a\xE7\xE3o expande a capacidade operacional do Browser Arm com escopo aprovado.",
      missing_requirement: "Aprova\xE7\xE3o expl\xEDcita de escopo para a a\xE7\xE3o solicitada.",
      expected_impact: "Execu\xE7\xE3o da a\xE7\xE3o bloqueada ap\xF3s aprova\xE7\xE3o de escopo."
    },
    blocked_not_browser_arm: {
      type: "integration",
      benefit: "Roteamento correto da a\xE7\xE3o para o bra\xE7o especializado adequado aumenta a efici\xEAncia.",
      missing_requirement: "Identifica\xE7\xE3o e habilita\xE7\xE3o do bra\xE7o correto para esta a\xE7\xE3o.",
      expected_impact: "Execu\xE7\xE3o da a\xE7\xE3o pelo bra\xE7o especializado adequado."
    },
    blocked_conditional_not_met: {
      type: "capability",
      benefit: "Permite execu\xE7\xE3o de a\xE7\xE3o condicionada com justificativa e permiss\xE3o expl\xEDcita do usu\xE1rio.",
      missing_requirement: "Justificativa v\xE1lida e permiss\xE3o do usu\xE1rio para a a\xE7\xE3o condicionada.",
      expected_impact: "Execu\xE7\xE3o controlada da a\xE7\xE3o condicionada ap\xF3s aprova\xE7\xE3o."
    }
  };
  const def = levelDefs[enforcement.level] || {
    type: "capability",
    benefit: "Revis\xE3o do bloqueio pode revelar oportunidade de expans\xE3o segura do escopo.",
    missing_requirement: "Revis\xE3o do escopo e das permiss\xF5es necess\xE1rias.",
    expected_impact: "Desbloqueio controlado da a\xE7\xE3o ap\xF3s revis\xE3o."
  };
  return {
    type: def.type,
    discovery: enforcement.reason,
    benefit: def.benefit,
    missing_requirement: def.missing_requirement,
    expected_impact: def.expected_impact,
    permission_needed: true
  };
}
__name(buildSuggestionFromEnforcement, "buildSuggestionFromEnforcement");
async function persistBrowserArmState(env) {
  if (!env?.ENAVIA_BRAIN) return;
  try {
    const data = {
      last_execution: _browserArmLastExecution,
      suggestions: _browserArmSuggestions,
      persisted_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await env.ENAVIA_BRAIN.put(KV_KEY_BROWSER_ARM_STATE, JSON.stringify(data));
  } catch {
  }
}
__name(persistBrowserArmState, "persistBrowserArmState");
async function rehydrateBrowserArmState(env) {
  if (!env?.ENAVIA_BRAIN) return;
  try {
    const raw = await env.ENAVIA_BRAIN.get(KV_KEY_BROWSER_ARM_STATE);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.last_execution && _browserArmLastExecution === null) {
      _browserArmLastExecution = data.last_execution;
    }
    if (Array.isArray(data.suggestions) && _browserArmSuggestions.length === 0) {
      _browserArmSuggestions = data.suggestions;
    }
  } catch {
  }
}
__name(rehydrateBrowserArmState, "rehydrateBrowserArmState");
async function getBrowserArmStateWithKV(env) {
  if (_browserArmLastExecution === null) {
    await rehydrateBrowserArmState(env);
  }
  return getBrowserArmState();
}
__name(getBrowserArmStateWithKV, "getBrowserArmStateWithKV");
function buildBrowserExecutorPayload({ action, params = null, execution_context = null } = {}) {
  const payload = {
    arm_id: BROWSER_ARM_ID,
    action,
    external_base: BROWSER_EXTERNAL_BASE.base_url,
    request_id: `ba_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    timestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
  if (params !== null && params !== void 0) {
    payload.params = params;
  }
  if (execution_context !== null && execution_context !== void 0) {
    payload.execution_context = execution_context;
  }
  return payload;
}
__name(buildBrowserExecutorPayload, "buildBrowserExecutorPayload");
function validateBrowserExecutorResponse(data) {
  if (!data || typeof data !== "object") {
    return {
      valid: false,
      reason: "Resposta do browser executor n\xE3o \xE9 um objeto v\xE1lido."
    };
  }
  const missing = BROWSER_EXECUTOR_RESPONSE_SHAPE.required_fields.filter(
    (f) => data[f] === void 0 || data[f] === null
  );
  if (missing.length > 0) {
    return {
      valid: false,
      reason: `Resposta do browser executor incompleta \u2014 campos faltantes: ${missing.join(", ")}.`,
      missing_fields: missing
    };
  }
  return { valid: true, reason: "Resposta v\xE1lida." };
}
__name(validateBrowserExecutorResponse, "validateBrowserExecutorResponse");
async function callBrowserExecutor(url, payload) {
  let response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } catch (err) {
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_CONNECTIVITY_ERROR",
      message: `Falha de conectividade com o browser executor: ${err.message || String(err)}`
    };
  }
  if (!response.ok) {
    let errorBody = null;
    try {
      errorBody = await response.text();
    } catch {
    }
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_HTTP_ERROR",
      message: `Browser executor retornou HTTP ${response.status}: ${errorBody || "sem corpo"}`,
      http_status: response.status
    };
  }
  let data;
  try {
    data = await response.json();
  } catch {
    return {
      ok: false,
      data: null,
      error_type: "BRIDGE_INVALID_RESPONSE",
      message: "Resposta do browser executor n\xE3o \xE9 JSON v\xE1lido."
    };
  }
  const validation = validateBrowserExecutorResponse(data);
  if (!validation.valid) {
    return {
      ok: false,
      data,
      error_type: "BRIDGE_INVALID_RESPONSE",
      message: validation.reason
    };
  }
  if (!data.ok) {
    return {
      ok: false,
      data,
      error_type: "BRIDGE_EXECUTOR_ERROR",
      message: data.message || data.error || "Browser executor retornou ok=false."
    };
  }
  return {
    ok: true,
    data,
    error_type: null,
    message: null
  };
}
__name(callBrowserExecutor, "callBrowserExecutor");
async function executeBrowserArmAction({
  action,
  scope_approved,
  gates_context,
  justification = null,
  user_permission = false,
  drift_detected = false,
  regression_detected = false,
  params = null,
  execution_context = null,
  env = null
} = {}) {
  const enforcement = enforceBrowserArm({
    action,
    scope_approved,
    gates_context,
    justification,
    user_permission,
    drift_detected,
    regression_detected
  });
  const resolvedGatesContext = gates_context || _CANONICAL_NULL_GATES_CONTEXT;
  const supervisorGate = _runSupervisorGate({
    action,
    environment: "TEST",
    scope_approved: scope_approved === true,
    gates_context: resolvedGatesContext,
    // Real source: evidence_available_when_required gate provided by the caller
    evidence_sufficient: !!resolvedGatesContext.evidence_available_when_required,
    arm_id: BROWSER_ARM_ID,
    arm_check_result: {
      allowed: enforcement.allowed,
      reason: enforcement.reason,
      arm_id: enforcement.arm_id
    }
  });
  if (!enforcement.allowed) {
    _browserArmLastExecution = {
      action,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      request_id: null,
      ok: false,
      execution_status: "blocked",
      error_type: "BROWSER_ARM_BLOCKED",
      error_message: enforcement.reason,
      target_url: null,
      result_summary: null,
      blocked: true,
      block_level: enforcement.level || null,
      block_reason: enforcement.reason,
      suggestion_required: enforcement.suggestion_required || false
    };
    if (enforcement.suggestion_required) {
      const suggestion = buildSuggestionFromEnforcement(enforcement);
      if (validateSuggestion(suggestion).valid) {
        _browserArmSuggestions = [suggestion];
      }
    }
    await persistBrowserArmState(env);
    return {
      ok: false,
      error: "BROWSER_ARM_BLOCKED",
      message: enforcement.reason,
      enforcement,
      suggestion_required: enforcement.suggestion_required || false,
      supervisor_enforcement: supervisorGate.supervisorDecision
    };
  }
  if (!supervisorGate.pass) {
    return _buildSupervisorBlockResponse(supervisorGate.supervisorDecision);
  }
  const executorUrl = env && env.BROWSER_EXECUTOR_URL ? env.BROWSER_EXECUTOR_URL : null;
  if (!executorUrl) {
    _browserArmLastExecution = {
      action: enforcement.action,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      request_id: null,
      ok: true,
      execution_status: "executed",
      error_type: null,
      error_message: null,
      target_url: null,
      result_summary: null,
      blocked: false,
      block_level: null,
      block_reason: null,
      suggestion_required: false
    };
    await persistBrowserArmState(env);
    return {
      ok: true,
      execution_status: "executed",
      action: enforcement.action,
      arm_id: enforcement.arm_id,
      external_base: BROWSER_EXTERNAL_BASE,
      enforcement
    };
  }
  const payload = buildBrowserExecutorPayload({
    action: enforcement.action,
    params,
    execution_context
  });
  const bridgeResult = await callBrowserExecutor(executorUrl, payload);
  _browserArmLastExecution = {
    action: enforcement.action,
    timestamp: payload.timestamp,
    request_id: payload.request_id,
    ok: bridgeResult.ok,
    execution_status: bridgeResult.ok ? bridgeResult.data && bridgeResult.data.execution_status || "executed" : "failed",
    error_type: bridgeResult.error_type,
    error_message: bridgeResult.message,
    target_url: bridgeResult.ok && bridgeResult.data?.target_url || null,
    result_summary: bridgeResult.ok && bridgeResult.data?.result_summary || null,
    blocked: false,
    block_level: null,
    block_reason: null,
    suggestion_required: false
  };
  if (bridgeResult.ok) {
    const exSuggestions = bridgeResult.data?.suggestions;
    if (Array.isArray(exSuggestions) && exSuggestions.length > 0) {
      _browserArmSuggestions = exSuggestions.filter(
        (s) => validateSuggestion(s).valid
      );
    }
  }
  await persistBrowserArmState(env);
  if (!bridgeResult.ok) {
    return {
      ok: false,
      error: "BROWSER_BRIDGE_FAILED",
      error_type: bridgeResult.error_type,
      message: bridgeResult.message,
      action: enforcement.action,
      arm_id: enforcement.arm_id,
      external_base: BROWSER_EXTERNAL_BASE,
      enforcement,
      payload_sent: payload
    };
  }
  const exData = bridgeResult.data;
  return {
    ok: true,
    execution_status: exData.execution_status,
    action: exData.action || enforcement.action,
    arm_id: enforcement.arm_id,
    external_base: BROWSER_EXTERNAL_BASE,
    enforcement,
    browser_result: {
      target_url: exData.target_url || null,
      result_summary: exData.result_summary || null,
      evidence: exData.evidence || null
    },
    request_id: payload.request_id
  };
}
__name(executeBrowserArmAction, "executeBrowserArmAction");
function getBrowserArmState() {
  const base = { ...BROWSER_ARM_STATE_SHAPE.initial_state };
  if (_browserArmLastExecution) {
    base.status = _browserArmLastExecution.blocked ? "disabled" : _browserArmLastExecution.ok ? "active" : "error";
    base.last_action = _browserArmLastExecution.action;
    base.last_action_ts = _browserArmLastExecution.timestamp;
    base.last_execution = {
      ok: _browserArmLastExecution.ok,
      execution_status: _browserArmLastExecution.execution_status,
      request_id: _browserArmLastExecution.request_id,
      error_type: _browserArmLastExecution.error_type || null,
      error_message: _browserArmLastExecution.error_message || null,
      target_url: _browserArmLastExecution.target_url || null,
      result_summary: _browserArmLastExecution.result_summary || null
    };
    if (_browserArmLastExecution.blocked) {
      base.block = {
        blocked: true,
        level: _browserArmLastExecution.block_level || null,
        reason: _browserArmLastExecution.block_reason || null,
        suggestion_required: _browserArmLastExecution.suggestion_required || false
      };
    }
  }
  base.suggestions = _browserArmSuggestions.length > 0 ? _browserArmSuggestions.slice() : [];
  return {
    ok: true,
    ...base
  };
}
__name(getBrowserArmState, "getBrowserArmState");
async function handleBrowserArmAction(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return {
      status: 400,
      body: { ok: false, error: "INVALID_JSON", message: "Body deve ser JSON v\xE1lido." }
    };
  }
  const {
    action,
    scope_approved,
    gates_context,
    justification = null,
    user_permission = false,
    drift_detected = false,
    regression_detected = false,
    params = null,
    execution_context = null
  } = body;
  if (!action || typeof action !== "string") {
    return {
      status: 400,
      body: { ok: false, error: "MISSING_ACTION", message: "'action' \xE9 obrigat\xF3rio." }
    };
  }
  if (typeof scope_approved !== "boolean") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MISSING_SCOPE_APPROVED",
        message: "'scope_approved' \xE9 obrigat\xF3rio e deve ser boolean. O runtime n\xE3o assume autoriza\xE7\xE3o impl\xEDcita."
      }
    };
  }
  if (!gates_context || typeof gates_context !== "object") {
    return {
      status: 400,
      body: {
        ok: false,
        error: "MISSING_GATES_CONTEXT",
        message: "'gates_context' \xE9 obrigat\xF3rio e deve ser um objeto com os gates P23. O runtime n\xE3o fabrica gates implicitamente."
      }
    };
  }
  const result = await executeBrowserArmAction({
    action,
    scope_approved,
    gates_context,
    justification,
    user_permission,
    drift_detected,
    regression_detected,
    params,
    execution_context,
    env: env || null
  });
  let status = 200;
  if (!result.ok) {
    status = result.error === "BROWSER_BRIDGE_FAILED" ? 502 : 403;
  }
  return {
    status,
    body: result
  };
}
__name(handleBrowserArmAction, "handleBrowserArmAction");

// schema/planner-classifier.js
var COMPLEXITY_LEVELS = {
  A: "A",
  B: "B",
  C: "C"
};
var CATEGORIES = {
  SIMPLE: "simple",
  TACTICAL: "tactical",
  COMPLEX: "complex"
};
var RISK_LEVELS = {
  BAIXO: "baixo",
  MEDIO: "m\xE9dio",
  ALTO: "alto"
};
var REQUEST_TYPES = {
  OPERATIONAL: "operational",
  PLANNING: "planning",
  STRATEGIC: "strategic"
};
var AMBIGUITY_TERMS = [
  "n\xE3o sei",
  "talvez",
  "algo assim",
  "tipo",
  "revis\xE3o geral",
  "amplo",
  "gen\xE9rico",
  "abrangente",
  "n\xE3o tenho certeza",
  "mais ou menos",
  "poderia ser",
  "quem sabe",
  "n\xE3o est\xE1 claro"
];
var SYSTEM_TERMS = [
  "deploy",
  "produ\xE7\xE3o",
  "arquitetura",
  "infraestrutura",
  "infra",
  "banco de dados",
  "migrar",
  "migra\xE7\xE3o",
  "pipeline",
  "integra\xE7\xE3o",
  "orquestrar",
  "automa\xE7\xE3o",
  "refatorar",
  "sistema",
  "ambiente",
  "cluster",
  "container",
  "kubernetes",
  "terraform",
  "ci/cd"
];
var MULTI_DELIVERY_TERMS = [
  "e tamb\xE9m",
  "al\xE9m disso",
  "etapas",
  "fases",
  "m\xF3dulos",
  "componentes",
  "plano completo",
  "v\xE1rias",
  "m\xFAltiplas",
  "entrega 1",
  "entrega 2",
  "fase 1",
  "fase 2",
  "passo 1",
  "passo 2"
];
var RISK_TERMS = [
  "risco",
  "impacto",
  "cr\xEDtico",
  "urgente",
  "irrevers\xEDvel",
  "dados sens\xEDveis",
  "seguran\xE7a",
  "compliance",
  "contrato",
  "prod",
  "regulat\xF3rio",
  "auditoria",
  "vazamento",
  "perda de dados"
];
var THRESHOLD_LONG_TEXT = 80;
var THRESHOLD_VERY_LONG_TEXT = 200;
var THRESHOLD_LIST_MARKERS = 3;
function _countWords(text) {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
__name(_countWords, "_countWords");
function _containsAny(text, terms) {
  for (const term of terms) {
    if (text.includes(term)) return true;
  }
  return false;
}
__name(_containsAny, "_containsAny");
function _countListMarkers(text) {
  const lines = text.split("\n");
  let count = 0;
  for (const line of lines) {
    if (/^\s*[-*]\s+\S/.test(line) || /^\s*\d+\.\s+\S/.test(line)) {
      count++;
    }
  }
  return count;
}
__name(_countListMarkers, "_countListMarkers");
function _detectSignals(text, context) {
  const normalized = text.toLowerCase();
  const wordCount = _countWords(text);
  const listMarkers = _countListMarkers(text);
  const long_text = wordCount >= THRESHOLD_LONG_TEXT && wordCount < THRESHOLD_VERY_LONG_TEXT;
  const very_long_text = wordCount >= THRESHOLD_VERY_LONG_TEXT;
  const has_ambiguity = _containsAny(normalized, AMBIGUITY_TERMS);
  const has_system_keywords = _containsAny(normalized, SYSTEM_TERMS);
  const has_multiple_deliveries = _containsAny(normalized, MULTI_DELIVERY_TERMS) || listMarkers >= THRESHOLD_LIST_MARKERS;
  const has_risk_keywords = _containsAny(normalized, RISK_TERMS);
  const ctx = context || {};
  const context_has_dependencies = Array.isArray(ctx.known_dependencies) && ctx.known_dependencies.length >= 2;
  const context_mentions_prod = ctx.mentions_prod === true;
  const context_is_urgent = ctx.is_urgent === true;
  return {
    long_text,
    very_long_text,
    has_ambiguity,
    has_system_keywords,
    has_multiple_deliveries,
    has_risk_keywords,
    context_has_dependencies,
    context_mentions_prod,
    context_is_urgent
  };
}
__name(_detectSignals, "_detectSignals");
function _score(signals) {
  const active_signals = [];
  let score = 0;
  if (signals.very_long_text) {
    score += 2;
    active_signals.push("very_long_text");
  } else if (signals.long_text) {
    score += 1;
    active_signals.push("long_text");
  }
  if (signals.has_ambiguity) {
    score += 1;
    active_signals.push("has_ambiguity");
  }
  if (signals.has_system_keywords) {
    score += 1;
    active_signals.push("has_system_keywords");
  }
  if (signals.has_multiple_deliveries) {
    score += 2;
    active_signals.push("has_multiple_deliveries");
  }
  if (signals.has_risk_keywords) {
    score += 2;
    active_signals.push("has_risk_keywords");
  }
  if (signals.context_has_dependencies) {
    score += 1;
    active_signals.push("context_has_dependencies");
  }
  if (signals.context_mentions_prod) {
    score += 2;
    active_signals.push("context_mentions_prod");
  }
  if (signals.context_is_urgent) {
    score += 1;
    active_signals.push("context_is_urgent");
  }
  return { score, active_signals };
}
__name(_score, "_score");
var _SIGNAL_LABELS = {
  very_long_text: "texto muito extenso",
  long_text: "texto extenso",
  has_ambiguity: "ambiguidade detectada",
  has_system_keywords: "termos de sistema",
  has_multiple_deliveries: "m\xFAltiplas entregas",
  has_risk_keywords: "sinais de risco",
  context_has_dependencies: "depend\xEAncias externas",
  context_mentions_prod: "men\xE7\xE3o a PROD",
  context_is_urgent: "urg\xEAncia sinalizada"
};
function _buildReason2(level, active_signals) {
  if (active_signals.length === 0) {
    return `classificado como ${level} por baixo escopo e baixo risco`;
  }
  const labels = active_signals.map((s) => _SIGNAL_LABELS[s] || s).join(", ");
  return `classificado como ${level} por ${labels}`;
}
__name(_buildReason2, "_buildReason");
function classifyRequest(input) {
  if (!input || typeof input.text !== "string" || input.text.trim() === "") {
    throw new Error(
      "classifyRequest: 'input.text' \xE9 obrigat\xF3rio e deve ser string n\xE3o vazia"
    );
  }
  const signals = _detectSignals(input.text, input.context);
  const { score, active_signals } = _score(signals);
  let complexity_level;
  let category;
  let risk_level;
  let needs_human_approval;
  if (score <= 1) {
    complexity_level = COMPLEXITY_LEVELS.A;
    category = CATEGORIES.SIMPLE;
    risk_level = RISK_LEVELS.BAIXO;
    needs_human_approval = false;
  } else if (score <= 3) {
    complexity_level = COMPLEXITY_LEVELS.B;
    category = CATEGORIES.TACTICAL;
    risk_level = RISK_LEVELS.MEDIO;
    needs_human_approval = false;
  } else {
    complexity_level = COMPLEXITY_LEVELS.C;
    category = CATEGORIES.COMPLEX;
    risk_level = RISK_LEVELS.ALTO;
    needs_human_approval = true;
  }
  if (signals.has_risk_keywords || signals.context_mentions_prod) {
    needs_human_approval = true;
  }
  const request_type_map = {
    [COMPLEXITY_LEVELS.A]: REQUEST_TYPES.OPERATIONAL,
    [COMPLEXITY_LEVELS.B]: REQUEST_TYPES.PLANNING,
    [COMPLEXITY_LEVELS.C]: REQUEST_TYPES.STRATEGIC
  };
  const request_type = request_type_map[complexity_level];
  const reason = _buildReason2(complexity_level, active_signals);
  return {
    request_type,
    complexity_level,
    category,
    risk_level,
    needs_human_approval,
    signals: active_signals,
    reason
  };
}
__name(classifyRequest, "classifyRequest");

// schema/planner-output-modes.js
var OUTPUT_MODES = {
  QUICK_REPLY: "quick_reply",
  TACTICAL_PLAN: "tactical_plan",
  FORMAL_CONTRACT: "formal_contract"
};
var LEVEL_TO_OUTPUT_MODE = {
  A: OUTPUT_MODES.QUICK_REPLY,
  B: OUTPUT_MODES.TACTICAL_PLAN,
  C: OUTPUT_MODES.FORMAL_CONTRACT
};
function selectOutputMode(classification) {
  if (!classification || typeof classification.complexity_level !== "string") {
    throw new Error(
      "selectOutputMode: 'classification.complexity_level' \xE9 obrigat\xF3rio e deve ser string"
    );
  }
  const level = classification.complexity_level.toUpperCase();
  const mode = LEVEL_TO_OUTPUT_MODE[level];
  if (!mode) {
    throw new Error(
      `selectOutputMode: complexity_level inv\xE1lido '${classification.complexity_level}'. Esperado: A, B ou C`
    );
  }
  return mode;
}
__name(selectOutputMode, "selectOutputMode");
function buildOutputEnvelope(classification, input) {
  const output_mode = selectOutputMode(classification);
  const level = classification.complexity_level.toUpperCase();
  const risk_level = classification.risk_level || "desconhecido";
  const reason = classification.reason || "";
  const input_text = input && typeof input.text === "string" ? input.text : "";
  switch (output_mode) {
    case OUTPUT_MODES.QUICK_REPLY:
      return _buildLevelA(level, input_text, reason);
    case OUTPUT_MODES.TACTICAL_PLAN:
      return _buildLevelB(level, input_text, risk_level, reason);
    case OUTPUT_MODES.FORMAL_CONTRACT:
      return _buildLevelC(level, input_text, risk_level, reason);
    default:
      throw new Error(`buildOutputEnvelope: output_mode inesperado '${output_mode}'`);
  }
}
__name(buildOutputEnvelope, "buildOutputEnvelope");
function _buildLevelA(level, input_text, reason) {
  return {
    output_mode: OUTPUT_MODES.QUICK_REPLY,
    level,
    objective: _summarizeObjective(input_text, reason),
    next_steps: [
      "Avaliar o pedido e responder diretamente",
      "Confirmar conclus\xE3o com o solicitante"
    ]
  };
}
__name(_buildLevelA, "_buildLevelA");
function _buildLevelB(level, input_text, risk_level, reason) {
  return {
    output_mode: OUTPUT_MODES.TACTICAL_PLAN,
    level,
    objective: _summarizeObjective(input_text, reason),
    scope: "Escopo t\xE1tico a detalhar na execu\xE7\xE3o (PM6)",
    main_steps: [
      "Decompor pedido em etapas execut\xE1veis",
      "Validar depend\xEAncias e recursos necess\xE1rios",
      "Executar e monitorar cada etapa"
    ],
    risks: [
      `N\xEDvel de risco detectado: ${risk_level}`,
      "Verificar depend\xEAncias antes de iniciar"
    ],
    acceptance_criteria: [
      "Todas as etapas conclu\xEDdas conforme escopo",
      "Entreg\xE1veis validados pelo solicitante"
    ]
  };
}
__name(_buildLevelB, "_buildLevelB");
function _buildLevelC(level, input_text, risk_level, reason) {
  return {
    output_mode: OUTPUT_MODES.FORMAL_CONTRACT,
    level,
    objective: _summarizeObjective(input_text, reason),
    macro_scope: "Escopo macro a definir no contrato formal (PM6)",
    fronts: [
      "Frente 1: diagn\xF3stico e levantamento de requisitos",
      "Frente 2: planejamento e decomposi\xE7\xE3o por etapas",
      "Frente 3: execu\xE7\xE3o supervisionada e valida\xE7\xE3o"
    ],
    risks: [
      `N\xEDvel de risco detectado: ${risk_level}`,
      "Impacto potencialmente irrevers\xEDvel \u2014 requer valida\xE7\xE3o humana",
      "Verificar compliance e crit\xE9rios regulat\xF3rios antes de prosseguir"
    ],
    needs_formal_contract: true,
    needs_human_approval: true
  };
}
__name(_buildLevelC, "_buildLevelC");
function _summarizeObjective(input_text, reason) {
  if (input_text && input_text.trim().length > 0) {
    const trimmed = input_text.trim();
    return trimmed.length <= 120 ? trimmed : trimmed.slice(0, 117) + "...";
  }
  return reason && reason.length > 0 ? reason : "Objetivo a definir";
}
__name(_summarizeObjective, "_summarizeObjective");

// schema/planner-canonical-plan.js
var PLAN_VERSION = "1.0";
var PLAN_TYPES = {
  QUICK_REPLY: "quick_reply",
  TACTICAL_PLAN: "tactical_plan",
  FORMAL_CONTRACT: "formal_contract"
};
var LEVEL_TO_PLAN_TYPE = {
  A: PLAN_TYPES.QUICK_REPLY,
  B: PLAN_TYPES.TACTICAL_PLAN,
  C: PLAN_TYPES.FORMAL_CONTRACT
};
function buildCanonicalPlan({ classification, envelope, input, planner_brief } = {}) {
  if (!classification || typeof classification.complexity_level !== "string") {
    throw new Error(
      "buildCanonicalPlan: 'classification.complexity_level' \xE9 obrigat\xF3rio e deve ser string"
    );
  }
  const level = classification.complexity_level.toUpperCase();
  const plan_type = LEVEL_TO_PLAN_TYPE[level];
  if (!plan_type) {
    throw new Error(
      `buildCanonicalPlan: complexity_level inv\xE1lido '${classification.complexity_level}'. Esperado: A, B ou C`
    );
  }
  if (!envelope || typeof envelope.output_mode !== "string") {
    throw new Error(
      "buildCanonicalPlan: 'envelope.output_mode' \xE9 obrigat\xF3rio e deve ser string"
    );
  }
  const risk_level = classification.risk_level || "desconhecido";
  const needs_human_approval = typeof classification.needs_human_approval === "boolean" ? classification.needs_human_approval : level === "C";
  const reason = classification.reason || "";
  const objective = envelope && typeof envelope.objective === "string" && envelope.objective.length > 0 ? envelope.objective : _fallbackObjective(input, reason);
  const output_mode = plan_type;
  const briefUseful = _isBriefUseful(planner_brief);
  const briefSteps = briefUseful ? _buildStepsFromBrief(planner_brief, level) : null;
  const steps_source = briefUseful ? "planner_brief" : "generic_fallback";
  switch (level) {
    case "A":
      return _buildPlanA({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason, briefSteps, steps_source });
    case "B":
      return _buildPlanB({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason, briefSteps, steps_source });
    case "C":
      return _buildPlanC({ plan_type, output_mode, objective, risk_level, reason, briefSteps, steps_source });
    default:
      throw new Error(`buildCanonicalPlan: n\xEDvel inesperado '${level}'`);
  }
}
__name(buildCanonicalPlan, "buildCanonicalPlan");
function _buildPlanA({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason, briefSteps, steps_source }) {
  return {
    plan_version: PLAN_VERSION,
    plan_type,
    complexity_level: "A",
    output_mode,
    objective,
    scope_summary: "Escopo simples e direto \u2014 a\xE7\xE3o pontual sem etapas complexas.",
    steps: briefSteps ?? [
      "Avaliar o pedido e identificar a a\xE7\xE3o necess\xE1ria",
      "Executar a a\xE7\xE3o diretamente",
      "Confirmar conclus\xE3o com o solicitante"
    ],
    risks: [
      `Risco detectado: ${risk_level} \u2014 monitorar resultado`
    ],
    acceptance_criteria: [
      "A\xE7\xE3o conclu\xEDda conforme o pedido",
      "Solicitante confirmou o resultado"
    ],
    needs_human_approval,
    next_action: "Executar a a\xE7\xE3o identificada diretamente e confirmar conclus\xE3o.",
    chat_reply: "Recebido. Processando sua solicita\xE7\xE3o.",
    reason,
    steps_source: steps_source ?? "generic_fallback",
    planner_brief_used_for_steps: steps_source === "planner_brief"
  };
}
__name(_buildPlanA, "_buildPlanA");
function _buildPlanB({ plan_type, output_mode, objective, risk_level, needs_human_approval, reason, briefSteps, steps_source }) {
  return {
    plan_version: PLAN_VERSION,
    plan_type,
    complexity_level: "B",
    output_mode,
    objective,
    scope_summary: "Escopo t\xE1tico com etapas definidas \u2014 requer valida\xE7\xE3o de depend\xEAncias antes de iniciar.",
    steps: briefSteps ?? [
      "Decompor o pedido em etapas execut\xE1veis e ordenadas",
      "Validar depend\xEAncias e recursos necess\xE1rios para cada etapa",
      "Executar cada etapa com monitoramento de resultado",
      "Validar entreg\xE1veis conforme crit\xE9rios de aceite"
    ],
    risks: [
      `Risco detectado: ${risk_level} \u2014 verificar depend\xEAncias antes de iniciar`,
      "Mudan\xE7as de escopo intermedi\xE1rias devem ser revisadas antes de prosseguir"
    ],
    acceptance_criteria: [
      "Todas as etapas conclu\xEDdas na ordem planejada",
      "Depend\xEAncias resolvidas antes da execu\xE7\xE3o",
      "Entreg\xE1veis validados pelo solicitante ao final"
    ],
    needs_human_approval,
    next_action: "Revisar as etapas planejadas, validar depend\xEAncias e aguardar confirma\xE7\xE3o para iniciar.",
    chat_reply: "Entendido. Estruturando as etapas t\xE1ticas para sua solicita\xE7\xE3o.",
    reason,
    steps_source: steps_source ?? "generic_fallback",
    planner_brief_used_for_steps: steps_source === "planner_brief"
  };
}
__name(_buildPlanB, "_buildPlanB");
function _buildPlanC({ plan_type, output_mode, objective, risk_level, reason, briefSteps, steps_source }) {
  return {
    plan_version: PLAN_VERSION,
    plan_type,
    complexity_level: "C",
    output_mode,
    objective,
    scope_summary: "Escopo macro e complexo \u2014 requer frentes bem definidas, revis\xE3o formal e aprova\xE7\xE3o humana antes de qualquer execu\xE7\xE3o.",
    steps: briefSteps ?? [
      "Frente 1: diagn\xF3stico completo e levantamento de requisitos",
      "Frente 2: decomposi\xE7\xE3o t\xE1tica por m\xF3dulos e depend\xEAncias",
      "Frente 3: planejamento de execu\xE7\xE3o supervisionada com crit\xE9rios claros",
      "Frente 4: revis\xE3o e aprova\xE7\xE3o formal humana antes de prosseguir"
    ],
    risks: [
      `Risco detectado: ${risk_level} \u2014 impacto potencialmente irrevers\xEDvel`,
      "Requer valida\xE7\xE3o de compliance e crit\xE9rios regulat\xF3rios antes de iniciar",
      "Depend\xEAncias externas e m\xFAltiplos stakeholders envolvidos"
    ],
    acceptance_criteria: [
      "Plano formal revisado e aprovado por respons\xE1vel humano",
      "Todas as frentes mapeadas com crit\xE9rios de aceite definidos",
      "Riscos documentados e mitiga\xE7\xF5es aprovadas antes da execu\xE7\xE3o"
    ],
    needs_human_approval: true,
    next_action: "Submeter este plano para revis\xE3o e aprova\xE7\xE3o humana formal antes de qualquer execu\xE7\xE3o.",
    chat_reply: "Recebido. Esta demanda requer planejamento formal \u2014 preparando plano para revis\xE3o e aprova\xE7\xE3o.",
    reason,
    steps_source: steps_source ?? "generic_fallback",
    planner_brief_used_for_steps: steps_source === "planner_brief"
  };
}
__name(_buildPlanC, "_buildPlanC");
function _isBriefUseful(planner_brief) {
  if (!planner_brief || typeof planner_brief !== "object") return false;
  const intent = planner_brief.operator_intent;
  return typeof intent === "string" && intent.trim().length > 20;
}
__name(_isBriefUseful, "_isBriefUseful");
function _describeTarget(target) {
  if (!target || typeof target !== "object") return null;
  const parts = [];
  if (typeof target.name === "string" && target.name.trim().length > 0) parts.push(target.name.trim());
  if (typeof target.env === "string" && target.env.trim().length > 0) parts.push(target.env.trim());
  if (typeof target.mode === "string" && target.mode.trim().length > 0) parts.push(`(${target.mode.trim()})`);
  if (typeof target.repo === "string" && target.repo.trim().length > 0) parts.push(target.repo.trim());
  if (typeof target.branch === "string" && target.branch.trim().length > 0) parts.push(target.branch.trim());
  return parts.length > 0 ? parts.join(" / ") : null;
}
__name(_describeTarget, "_describeTarget");
var _BRIEF_INTENT_MAX_LEN = 100;
var _BRIEF_ANCHOR_MAX_LEN = 70;
var _BRIEF_MAX_AC_IN_STEP = 2;
function _buildStepsFromBrief(planner_brief, level) {
  const intent = typeof planner_brief.operator_intent === "string" ? planner_brief.operator_intent.trim() : "";
  const target = planner_brief.target && typeof planner_brief.target === "object" ? planner_brief.target : null;
  const constraints = planner_brief.constraints && typeof planner_brief.constraints === "object" ? planner_brief.constraints : null;
  const isReadOnly = constraints?.mode === "read_only" || constraints?.safe_only === true;
  const ac = Array.isArray(planner_brief.acceptance_criteria) ? planner_brief.acceptance_criteria.filter((s) => typeof s === "string" && s.trim().length > 0) : [];
  const intentShort = intent.length <= _BRIEF_INTENT_MAX_LEN ? intent : intent.slice(0, _BRIEF_INTENT_MAX_LEN - 3) + "...";
  const targetDesc = _describeTarget(target);
  const steps = [];
  if (targetDesc) {
    steps.push(`Confirmar alvo ${targetDesc} antes de iniciar a opera\xE7\xE3o`);
  } else {
    const anchor = intent.slice(0, _BRIEF_ANCHOR_MAX_LEN);
    steps.push(`Confirmar escopo da opera\xE7\xE3o: ${anchor}`);
  }
  if (isReadOnly) {
    steps.push(`Executar diagn\xF3stico sem escrita: ${intentShort}`);
  } else {
    steps.push(`Executar opera\xE7\xE3o: ${intentShort}`);
  }
  if (ac.length > 0) {
    const acText = ac.slice(0, _BRIEF_MAX_AC_IN_STEP).join("; ");
    steps.push(`Validar crit\xE9rios de aceite: ${acText}`);
  } else if (isReadOnly) {
    steps.push("Validar resultado sem executar a\xE7\xF5es destrutivas ou de escrita");
  } else {
    steps.push("Validar que o objetivo foi atingido conforme combinado");
  }
  if (level === "B" || level === "C") {
    if (isReadOnly) {
      steps.push("Registrar evid\xEAncias da valida\xE7\xE3o sem acionar executor");
    } else {
      steps.push("Consolidar evid\xEAncias e registrar resultado da opera\xE7\xE3o");
    }
  }
  if (level === "C") {
    steps.push("Submeter plano para aprova\xE7\xE3o humana formal antes de prosseguir");
  }
  return steps;
}
__name(_buildStepsFromBrief, "_buildStepsFromBrief");
function _fallbackObjective(input, reason) {
  if (input && typeof input.text === "string" && input.text.trim().length > 0) {
    const trimmed = input.text.trim();
    return trimmed.length <= 120 ? trimmed : trimmed.slice(0, 117) + "...";
  }
  return reason && reason.length > 0 ? reason : "Objetivo a definir";
}
__name(_fallbackObjective, "_fallbackObjective");

// schema/planner-approval-gate.js
var GATE_STATUS = {
  APPROVED_NOT_REQUIRED: "approved_not_required",
  APPROVAL_REQUIRED: "approval_required",
  APPROVED: "approved",
  REJECTED: "rejected"
};
var _NEXT_ACTIONS2 = {
  [GATE_STATUS.APPROVED_NOT_REQUIRED]: "Prosseguir diretamente com a execu\xE7\xE3o do plano.",
  [GATE_STATUS.APPROVAL_REQUIRED]: "Aguardar aprova\xE7\xE3o humana formal \u2014 execu\xE7\xE3o bloqueada at\xE9 decis\xE3o expl\xEDcita.",
  [GATE_STATUS.APPROVED]: "Prosseguir com a execu\xE7\xE3o do plano conforme aprovado.",
  [GATE_STATUS.REJECTED]: "Plano rejeitado \u2014 revisar e gerar novo plano antes de prosseguir."
};
function _validatePlan(plan, fnName) {
  if (!plan || typeof plan !== "object") {
    throw new Error(`${fnName}: 'plan' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof plan.needs_human_approval !== "boolean") {
    throw new Error(
      `${fnName}: 'plan.needs_human_approval' \xE9 obrigat\xF3rio e deve ser boolean`
    );
  }
}
__name(_validatePlan, "_validatePlan");
function evaluateApprovalGate(plan) {
  _validatePlan(plan, "evaluateApprovalGate");
  const needs_human_approval = plan.needs_human_approval;
  const gate_status = needs_human_approval ? GATE_STATUS.APPROVAL_REQUIRED : GATE_STATUS.APPROVED_NOT_REQUIRED;
  const can_proceed = !needs_human_approval;
  const plan_reason = typeof plan.reason === "string" && plan.reason.length > 0 ? plan.reason : "";
  const reason = needs_human_approval ? `Plano requer aprova\xE7\xE3o humana antes de prosseguir${plan_reason ? ` \u2014 ${plan_reason}` : ""}.` : `Plano aprovado automaticamente \u2014 aprova\xE7\xE3o humana n\xE3o requerida${plan_reason ? ` \u2014 ${plan_reason}` : ""}.`;
  return {
    gate_status,
    needs_human_approval,
    can_proceed,
    reason,
    next_action: _NEXT_ACTIONS2[gate_status]
  };
}
__name(evaluateApprovalGate, "evaluateApprovalGate");

// schema/planner-executor-bridge.js
var BRIDGE_VERSION = "1.0";
var BRIDGE_SOURCE = "planner_bridge";
var BRIDGE_STATUS = {
  READY: "ready_for_executor",
  BLOCKED: "blocked_by_gate"
};
var EXECUTOR_ACTION = {
  EXECUTE_PLAN: "execute_plan"
};
function _validateInputs(plan, gate, fnName) {
  if (!plan || typeof plan !== "object") {
    throw new Error(`${fnName}: 'plan' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof plan.complexity_level !== "string" || !plan.complexity_level) {
    throw new Error(`${fnName}: 'plan.complexity_level' \xE9 obrigat\xF3rio e deve ser string`);
  }
  if (typeof plan.plan_type !== "string" || !plan.plan_type) {
    throw new Error(`${fnName}: 'plan.plan_type' \xE9 obrigat\xF3rio e deve ser string`);
  }
  if (!Array.isArray(plan.steps)) {
    throw new Error(`${fnName}: 'plan.steps' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (!Array.isArray(plan.risks)) {
    throw new Error(`${fnName}: 'plan.risks' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (!Array.isArray(plan.acceptance_criteria)) {
    throw new Error(`${fnName}: 'plan.acceptance_criteria' \xE9 obrigat\xF3rio e deve ser array`);
  }
  if (!gate || typeof gate !== "object") {
    throw new Error(`${fnName}: 'gate' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof gate.gate_status !== "string" || !gate.gate_status) {
    throw new Error(`${fnName}: 'gate.gate_status' \xE9 obrigat\xF3rio e deve ser string`);
  }
  if (typeof gate.can_proceed !== "boolean") {
    throw new Error(`${fnName}: 'gate.can_proceed' \xE9 obrigat\xF3rio e deve ser boolean`);
  }
}
__name(_validateInputs, "_validateInputs");
function _buildExecutorPayload(plan) {
  return {
    version: BRIDGE_VERSION,
    source: BRIDGE_SOURCE,
    plan_summary: typeof plan.objective === "string" && plan.objective.length > 0 ? plan.objective : "",
    complexity_level: plan.complexity_level,
    plan_type: plan.plan_type,
    steps: plan.steps,
    risks: plan.risks,
    acceptance_criteria: plan.acceptance_criteria
  };
}
__name(_buildExecutorPayload, "_buildExecutorPayload");
function _reasonForBlock(gate) {
  const gateReason = typeof gate.reason === "string" && gate.reason.length > 0 ? ` \u2014 ${gate.reason}` : "";
  switch (gate.gate_status) {
    case GATE_STATUS.APPROVAL_REQUIRED:
      return `Execu\xE7\xE3o bloqueada: plano aguardando aprova\xE7\xE3o humana formal${gateReason}.`;
    case GATE_STATUS.REJECTED:
      return `Execu\xE7\xE3o bloqueada: plano rejeitado pelo gate \u2014 revisar e gerar novo plano antes de prosseguir${gateReason}.`;
    default:
      return `Execu\xE7\xE3o bloqueada pelo gate (${gate.gate_status})${gateReason}.`;
  }
}
__name(_reasonForBlock, "_reasonForBlock");
function _nextActionForBlock(gate) {
  switch (gate.gate_status) {
    case GATE_STATUS.APPROVAL_REQUIRED:
      return "Aguardar aprova\xE7\xE3o humana formal \u2014 execu\xE7\xE3o suspensa at\xE9 decis\xE3o expl\xEDcita.";
    case GATE_STATUS.REJECTED:
      return "Revisar o plano e gerar nova vers\xE3o antes de solicitar execu\xE7\xE3o.";
    default:
      return "Verificar o estado do gate e resolver o bloqueio antes de prosseguir.";
  }
}
__name(_nextActionForBlock, "_nextActionForBlock");
function buildExecutorBridgePayload({ plan, gate } = {}) {
  _validateInputs(plan, gate, "buildExecutorBridgePayload");
  if (gate.can_proceed !== true) {
    return {
      bridge_status: BRIDGE_STATUS.BLOCKED,
      can_execute: false,
      executor_action: null,
      executor_payload: null,
      reason: _reasonForBlock(gate),
      next_action: _nextActionForBlock(gate)
    };
  }
  const gateReason = typeof gate.reason === "string" && gate.reason.length > 0 ? ` \u2014 ${gate.reason}` : "";
  return {
    bridge_status: BRIDGE_STATUS.READY,
    can_execute: true,
    executor_action: EXECUTOR_ACTION.EXECUTE_PLAN,
    executor_payload: _buildExecutorPayload(plan),
    reason: `Gate autoriza execu\xE7\xE3o${gateReason}.`,
    next_action: "Payload can\xF4nico pronto \u2014 encaminhar ao executor quando acionado."
  };
}
__name(buildExecutorBridgePayload, "buildExecutorBridgePayload");

// schema/memory-schema.js
var MEMORY_TYPES = {
  USER_PROFILE: "user_profile",
  PROJECT: "project",
  CANONICAL_RULES: "canonical_rules",
  OPERATIONAL_HISTORY: "operational_history",
  LIVE_CONTEXT: "live_context",
  // ---------------------------------------------------------------------------
  // PR2 — Tipos canônicos do contrato PR1 (aliases semânticos)
  //
  // Estes tipos mapeiam diretamente os 5 tipos canônicos definidos no contrato
  // ENAVIA_MEMORY_CONTRACT_V1.md (PR1 §1). Convivem com os tipos originais
  // para preservar compatibilidade total com código existente.
  // ---------------------------------------------------------------------------
  CONVERSA_ATUAL: "conversa_atual",
  MEMORIA_LONGA: "memoria_longa",
  MEMORIA_MANUAL: "memoria_manual",
  APRENDIZADO_VALIDADO: "aprendizado_validado",
  MEMORIA_TEMPORARIA: "memoria_temporaria"
};
var MEMORY_STATUS = {
  ACTIVE: "active",
  ARCHIVED: "archived",
  SUPERSEDED: "superseded",
  EXPIRED: "expired",
  CANONICAL: "canonical",
  // PR2 — Nível "bloqueado" do contrato PR1 §2.4: suporte real no schema
  BLOCKED: "blocked"
};
var MEMORY_PRIORITY = {
  CRITICAL: "critical",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};
var MEMORY_CONFIDENCE = {
  CONFIRMED: "confirmed",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  UNVERIFIED: "unverified",
  // PR2 — Nível "bloqueado" do contrato PR1 §2.4 / §8.8: valor real de confidence
  BLOCKED: "blocked"
};
var ENTITY_TYPES = {
  USER: "user",
  PROJECT: "project",
  RULE: "rule",
  OPERATION: "operation",
  CONTEXT: "context"
};
var MEMORY_FLAGS = {
  IS_CANONICAL: "is_canonical",
  IS_SUPERSEDED: "is_superseded",
  IS_EXPIRED: "is_expired",
  // PR2 — Flag "bloqueado" do contrato PR1 §8.8: suporte real no schema
  IS_BLOCKED: "is_blocked"
};
var MEMORY_CANONICAL_SHAPE = {
  memory_id: null,
  // string única — obrigatório
  memory_type: null,
  // MEMORY_TYPES value — obrigatório
  entity_type: null,
  // ENTITY_TYPES value — obrigatório
  entity_id: null,
  // string — obrigatório
  title: null,
  // string — obrigatório
  content_structured: null,
  // plain object — obrigatório
  priority: "medium",
  // MEMORY_PRIORITY value
  confidence: "medium",
  // MEMORY_CONFIDENCE value
  source: null,
  // string — obrigatório
  created_at: null,
  // ISO 8601 string — obrigatório
  updated_at: null,
  // ISO 8601 string — obrigatório
  expires_at: null,
  // ISO 8601 string ou null
  is_canonical: false,
  // boolean
  status: "active",
  // MEMORY_STATUS value
  flags: [],
  // array de MEMORY_FLAGS strings
  // PR2 — campo mínimo contratual: tags (array de strings livres para categorização)
  tags: []
  // string[] — default []
};
function validateMemoryObject(obj) {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) {
    return { valid: false, errors: ["memory object must be a plain object"] };
  }
  const errors = [];
  const requiredStrings = [
    "memory_id",
    "entity_id",
    "title",
    "source",
    "created_at",
    "updated_at"
  ];
  for (const field of requiredStrings) {
    if (typeof obj[field] !== "string" || obj[field].trim() === "") {
      errors.push(`'${field}' is required and must be a non-empty string`);
    }
  }
  const validMemoryTypes = Object.values(MEMORY_TYPES);
  if (!validMemoryTypes.includes(obj.memory_type)) {
    errors.push(
      `'memory_type' must be one of: ${validMemoryTypes.join(", ")}`
    );
  }
  const validEntityTypes = Object.values(ENTITY_TYPES);
  if (!validEntityTypes.includes(obj.entity_type)) {
    errors.push(
      `'entity_type' must be one of: ${validEntityTypes.join(", ")}`
    );
  }
  const validStatuses = Object.values(MEMORY_STATUS);
  if (!validStatuses.includes(obj.status)) {
    errors.push(`'status' must be one of: ${validStatuses.join(", ")}`);
  }
  const validPriorities = Object.values(MEMORY_PRIORITY);
  if (!validPriorities.includes(obj.priority)) {
    errors.push(`'priority' must be one of: ${validPriorities.join(", ")}`);
  }
  const validConfidences = Object.values(MEMORY_CONFIDENCE);
  if (!validConfidences.includes(obj.confidence)) {
    errors.push(
      `'confidence' must be one of: ${validConfidences.join(", ")}`
    );
  }
  if (!obj.content_structured || typeof obj.content_structured !== "object" || Array.isArray(obj.content_structured)) {
    errors.push("'content_structured' must be a non-null plain object");
  }
  if (typeof obj.is_canonical !== "boolean") {
    errors.push("'is_canonical' must be a boolean");
  }
  for (const field of ["created_at", "updated_at"]) {
    if (typeof obj[field] === "string" && obj[field].trim() !== "") {
      if (Number.isNaN(Date.parse(obj[field]))) {
        errors.push(`'${field}' must be a valid ISO 8601 date string`);
      }
    }
  }
  if (obj.expires_at !== null && obj.expires_at !== void 0) {
    if (typeof obj.expires_at !== "string" || obj.expires_at.trim() === "") {
      errors.push(
        "'expires_at' must be a non-empty ISO 8601 string when provided"
      );
    } else if (Number.isNaN(Date.parse(obj.expires_at))) {
      errors.push("'expires_at' must be a valid ISO 8601 date string");
    }
  }
  if (obj.memory_type === MEMORY_TYPES.MEMORIA_TEMPORARIA && (obj.expires_at === null || obj.expires_at === void 0)) {
    errors.push(
      "'expires_at' is required for memory_type 'memoria_temporaria'"
    );
  }
  if (!Array.isArray(obj.flags)) {
    errors.push("'flags' must be an array");
  } else {
    const validFlags = Object.values(MEMORY_FLAGS);
    for (const flag of obj.flags) {
      if (!validFlags.includes(flag)) {
        errors.push(
          `'flags' contains unknown value '${flag}'; allowed: ${validFlags.join(", ")}`
        );
      }
    }
  }
  if (!Array.isArray(obj.tags)) {
    errors.push("'tags' must be an array");
  } else {
    for (const tag of obj.tags) {
      if (typeof tag !== "string" || tag.trim() === "") {
        errors.push("'tags' must contain only non-empty strings");
        break;
      }
    }
  }
  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}
__name(validateMemoryObject, "validateMemoryObject");
function buildMemoryObject(partial) {
  return Object.assign({}, MEMORY_CANONICAL_SHAPE, partial, {
    flags: Array.isArray(partial && partial.flags) ? [...partial.flags] : [],
    tags: Array.isArray(partial && partial.tags) ? [...partial.tags] : []
  });
}
__name(buildMemoryObject, "buildMemoryObject");

// schema/memory-consolidation.js
var CONSOLIDATION_VERSION = "1.0";
var _CONSOLIDABLE_GATE_STATUSES = /* @__PURE__ */ new Set([
  GATE_STATUS.APPROVED_NOT_REQUIRED,
  GATE_STATUS.APPROVED
]);
function _validateInputs2({ plan, gate, bridge }, fnName) {
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    throw new Error(`${fnName}: 'plan' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof plan.complexity_level !== "string" || !plan.complexity_level.trim()) {
    throw new Error(`${fnName}: 'plan.complexity_level' \xE9 obrigat\xF3rio e deve ser string`);
  }
  if (!gate || typeof gate !== "object" || Array.isArray(gate)) {
    throw new Error(`${fnName}: 'gate' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof gate.gate_status !== "string" || !gate.gate_status.trim()) {
    throw new Error(`${fnName}: 'gate.gate_status' \xE9 obrigat\xF3rio e deve ser string`);
  }
  if (!bridge || typeof bridge !== "object" || Array.isArray(bridge)) {
    throw new Error(`${fnName}: 'bridge' \xE9 obrigat\xF3rio e deve ser um objeto`);
  }
  if (typeof bridge.bridge_status !== "string" || !bridge.bridge_status.trim()) {
    throw new Error(`${fnName}: 'bridge.bridge_status' \xE9 obrigat\xF3rio e deve ser string`);
  }
}
__name(_validateInputs2, "_validateInputs");
function _qualifiesForCanonical(plan, gate, bridge) {
  if (!_CONSOLIDABLE_GATE_STATUSES.has(gate.gate_status)) return false;
  if (bridge.bridge_status !== BRIDGE_STATUS.READY) return false;
  const level = plan.complexity_level.toUpperCase();
  if (level !== "B" && level !== "C") return false;
  if (!Array.isArray(plan.acceptance_criteria) || plan.acceptance_criteria.length === 0) {
    return false;
  }
  return true;
}
__name(_qualifiesForCanonical, "_qualifiesForCanonical");
function _buildOperationalCandidate(plan, gate, bridge) {
  const objective = typeof plan.objective === "string" ? plan.objective : "";
  return {
    memory_type: MEMORY_TYPES.OPERATIONAL_HISTORY,
    title: `Ciclo planner conclu\xEDdo \u2014 n\xEDvel ${plan.complexity_level} \u2014 gate: ${gate.gate_status}`,
    content_structured: {
      plan_type: typeof plan.plan_type === "string" ? plan.plan_type : "",
      complexity_level: plan.complexity_level,
      gate_status: gate.gate_status,
      bridge_status: bridge.bridge_status,
      can_execute: bridge.can_execute === true,
      objective,
      consolidation_version: CONSOLIDATION_VERSION
    },
    priority: MEMORY_PRIORITY.LOW,
    confidence: MEMORY_CONFIDENCE.HIGH,
    is_canonical: false,
    status: MEMORY_STATUS.ACTIVE
  };
}
__name(_buildOperationalCandidate, "_buildOperationalCandidate");
function _buildCanonicalCandidate(plan, gate) {
  const objective = typeof plan.objective === "string" ? plan.objective : "";
  const shortObjective = objective.length <= 60 ? objective : objective.slice(0, 57) + "...";
  return {
    memory_type: MEMORY_TYPES.CANONICAL_RULES,
    title: `Crit\xE9rios can\xF4nicos \u2014 n\xEDvel ${plan.complexity_level} \u2014 ${shortObjective}`,
    content_structured: {
      acceptance_criteria: plan.acceptance_criteria,
      plan_type: typeof plan.plan_type === "string" ? plan.plan_type : "",
      complexity_level: plan.complexity_level,
      gate_status: gate.gate_status,
      objective,
      consolidation_version: CONSOLIDATION_VERSION
    },
    priority: MEMORY_PRIORITY.HIGH,
    confidence: MEMORY_CONFIDENCE.CONFIRMED,
    is_canonical: true,
    status: MEMORY_STATUS.CANONICAL
  };
}
__name(_buildCanonicalCandidate, "_buildCanonicalCandidate");
function consolidateMemoryLearning({ plan, gate, bridge } = {}) {
  _validateInputs2({ plan, gate, bridge }, "consolidateMemoryLearning");
  const gateStatus = gate.gate_status;
  if (gateStatus === GATE_STATUS.REJECTED) {
    const gateReason = typeof gate.reason === "string" && gate.reason.length > 0 ? ` Gate reason: ${gate.reason}` : "";
    return {
      should_consolidate: false,
      memory_candidates: [],
      reason: `Plano rejeitado pelo gate \u2014 nenhuma mem\xF3ria consolidada. Rejei\xE7\xE3o n\xE3o vira mem\xF3ria can\xF4nica.${gateReason}`,
      next_action: "Revisar o plano e gerar nova vers\xE3o antes de tentar consolidar mem\xF3ria."
    };
  }
  if (gateStatus === GATE_STATUS.APPROVAL_REQUIRED) {
    return {
      should_consolidate: false,
      memory_candidates: [],
      reason: "Plano aguardando aprova\xE7\xE3o humana \u2014 estado transit\xF3rio, nenhuma mem\xF3ria consolidada. Consolidar apenas ap\xF3s decis\xE3o final do gate.",
      next_action: "Aguardar decis\xE3o humana formal antes de consolidar mem\xF3ria."
    };
  }
  if (_CONSOLIDABLE_GATE_STATUSES.has(gateStatus)) {
    const candidates = [];
    candidates.push(_buildOperationalCandidate(plan, gate, bridge));
    if (_qualifiesForCanonical(plan, gate, bridge)) {
      candidates.push(_buildCanonicalCandidate(plan, gate));
    }
    const hasCanonical = candidates.some((c) => c.is_canonical === true);
    const reason = hasCanonical ? `Plano aprovado (${gateStatus}) \u2014 n\xEDvel ${plan.complexity_level} com crit\xE9rios de aceite definidos e bridge pronta \u2014 mem\xF3ria operacional e can\xF4nica consolidadas.` : `Plano aprovado (${gateStatus}) \u2014 n\xEDvel ${plan.complexity_level} \u2014 apenas mem\xF3ria operacional consolidada (sem crit\xE9rio suficiente para can\xF4nica).`;
    return {
      should_consolidate: true,
      memory_candidates: candidates,
      reason,
      next_action: "Candidatos prontos para persist\xEAncia via PM2 (writeMemory) quando acionado \u2014 PM9 n\xE3o persiste diretamente."
    };
  }
  return {
    should_consolidate: false,
    memory_candidates: [],
    reason: `Gate status desconhecido '${gateStatus}' \u2014 nenhuma mem\xF3ria consolidada por seguran\xE7a.`,
    next_action: "Verificar o gate_status e garantir que \xE9 um valor can\xF4nico antes de consolidar."
  };
}
__name(consolidateMemoryLearning, "consolidateMemoryLearning");

// schema/memory-audit-log.js
var KV_PREFIX = "audit:memory:";
var KV_INDEX_KEY2 = "audit:memory:index";
function _eventKey(event_id) {
  return `${KV_PREFIX}${event_id}`;
}
__name(_eventKey, "_eventKey");
async function _readIndex(env) {
  const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY2);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}
__name(_readIndex, "_readIndex");
async function _writeIndex(index, env) {
  await env.ENAVIA_BRAIN.put(KV_INDEX_KEY2, JSON.stringify(index));
}
__name(_writeIndex, "_writeIndex");
var AUDIT_EVENT_TYPES = {
  MEMORY_CREATED: "memory_created",
  MEMORY_UPDATED: "memory_updated",
  MEMORY_BLOCKED: "memory_blocked",
  MEMORY_INVALIDATED: "memory_invalidated",
  CANDIDATE_REGISTERED: "candidate_registered",
  CANDIDATE_APPROVED: "candidate_approved",
  CANDIDATE_REJECTED: "candidate_rejected"
};
var AUDIT_TARGET_TYPES = {
  MEMORY: "memory",
  LEARNING_CANDIDATE: "learning_candidate"
};
async function emitAuditEvent(event, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!event || typeof event !== "object") {
    return { ok: false, error: "event must be a plain object" };
  }
  if (!event.event_type || typeof event.event_type !== "string") {
    return { ok: false, error: "event.event_type is required" };
  }
  if (!event.target_type || typeof event.target_type !== "string") {
    return { ok: false, error: "event.target_type is required" };
  }
  if (!event.target_id || typeof event.target_id !== "string") {
    return { ok: false, error: "event.target_id is required" };
  }
  if (!event.source || typeof event.source !== "string") {
    return { ok: false, error: "event.source is required" };
  }
  if (!event.summary || typeof event.summary !== "string") {
    return { ok: false, error: "event.summary is required" };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const event_id = event.event_id || "aev-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 9);
  const record = {
    event_id,
    event_type: event.event_type,
    target_type: event.target_type,
    target_id: event.target_id,
    related_id: typeof event.related_id === "string" ? event.related_id : null,
    source: event.source,
    summary: event.summary,
    timestamp: now
  };
  await env.ENAVIA_BRAIN.put(_eventKey(event_id), JSON.stringify(record));
  const index = await _readIndex(env);
  if (!index.includes(event_id)) {
    index.push(event_id);
    await _writeIndex(index, env);
  }
  return { ok: true, event_id, record };
}
__name(emitAuditEvent, "emitAuditEvent");
async function listAuditEvents(filters, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  const f = filters && typeof filters === "object" ? filters : {};
  const limit = typeof f.limit === "number" && f.limit > 0 ? f.limit : 100;
  const ids = await _readIndex(env);
  const items = [];
  for (let i = ids.length - 1; i >= 0 && items.length < limit; i--) {
    const raw = await env.ENAVIA_BRAIN.get(_eventKey(ids[i]));
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      if (f.event_type && record.event_type !== f.event_type) continue;
      if (f.target_type && record.target_type !== f.target_type) continue;
      if (f.target_id && record.target_id !== f.target_id) continue;
      items.push(record);
    } catch (_e) {
    }
  }
  return { ok: true, items, count: items.length };
}
__name(listAuditEvents, "listAuditEvents");

// schema/memory-storage.js
var KV_PREFIX_MEMORY = "memory:";
var KV_INDEX_KEY3 = "memory:index";
function memoryKey(memory_id) {
  return `${KV_PREFIX_MEMORY}${memory_id}`;
}
__name(memoryKey, "memoryKey");
async function _readIndex2(env) {
  const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY3);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}
__name(_readIndex2, "_readIndex");
async function _writeIndex2(index, env) {
  await env.ENAVIA_BRAIN.put(KV_INDEX_KEY3, JSON.stringify(index));
}
__name(_writeIndex2, "_writeIndex");
async function writeMemory(memoryObj, env) {
  const validation = validateMemoryObject(memoryObj);
  if (!validation.valid) {
    return { ok: false, error: "schema validation failed", errors: validation.errors };
  }
  const { memory_id } = memoryObj;
  if (memoryObj.confidence === MEMORY_CONFIDENCE.BLOCKED || memoryObj.status === MEMORY_STATUS.BLOCKED) {
    return {
      ok: false,
      error: "cannot write memory with blocked confidence or status"
    };
  }
  const existing = await env.ENAVIA_BRAIN.get(memoryKey(memory_id));
  if (existing !== null) {
    return {
      ok: false,
      error: `memory_id '${memory_id}' already exists; use updateMemory to modify`
    };
  }
  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(memoryObj));
  const index = await _readIndex2(env);
  if (!index.includes(memory_id)) {
    index.push(memory_id);
    await _writeIndex2(index, env);
  }
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.MEMORY_CREATED,
      target_type: AUDIT_TARGET_TYPES.MEMORY,
      target_id: memory_id,
      source: memoryObj.source || "system",
      summary: `Mem\xF3ria criada: ${memoryObj.title || memory_id} (type: ${memoryObj.memory_type})`
    }, env);
  } catch (_e) {
  }
  return { ok: true, memory_id, record: memoryObj };
}
__name(writeMemory, "writeMemory");
async function readMemoryById(memory_id, env) {
  const raw = await env.ENAVIA_BRAIN.get(memoryKey(memory_id));
  if (raw === null) return null;
  try {
    const record = JSON.parse(raw);
    if (record.expires_at && typeof record.expires_at === "string" && record.status !== MEMORY_STATUS.EXPIRED && record.status !== MEMORY_STATUS.BLOCKED && record.status !== MEMORY_STATUS.ARCHIVED) {
      const expiresTime = Date.parse(record.expires_at);
      if (!Number.isNaN(expiresTime) && expiresTime < Date.now()) {
        record.status = MEMORY_STATUS.EXPIRED;
        record.updated_at = (/* @__PURE__ */ new Date()).toISOString();
        if (Array.isArray(record.flags) && !record.flags.includes(MEMORY_FLAGS.IS_EXPIRED)) {
          record.flags.push(MEMORY_FLAGS.IS_EXPIRED);
        }
        await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(record));
      }
    }
    return record;
  } catch (_e) {
    return null;
  }
}
__name(readMemoryById, "readMemoryById");
async function updateMemory(memory_id, patch, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }
  const updated = Object.assign({}, existing, patch, {
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  const validation = validateMemoryObject(updated);
  if (!validation.valid) {
    return { ok: false, error: "schema validation failed after patch", errors: validation.errors };
  }
  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(updated));
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.MEMORY_UPDATED,
      target_type: AUDIT_TARGET_TYPES.MEMORY,
      target_id: memory_id,
      source: updated.source || "system",
      summary: `Mem\xF3ria atualizada: ${updated.title || memory_id}`
    }, env);
  } catch (_e) {
  }
  return { ok: true, memory_id, record: updated };
}
__name(updateMemory, "updateMemory");
async function invalidateMemory(memory_id, meta, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }
  const updatedContentStructured = Object.assign({}, existing.content_structured);
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    updatedContentStructured._meta = Object.assign(
      {},
      updatedContentStructured._meta || {},
      meta
    );
  }
  const flags = Array.isArray(existing.flags) ? [...existing.flags] : [];
  if (!flags.includes(MEMORY_FLAGS.IS_EXPIRED)) {
    flags.push(MEMORY_FLAGS.IS_EXPIRED);
  }
  const invalidated = Object.assign({}, existing, {
    status: MEMORY_STATUS.EXPIRED,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    content_structured: updatedContentStructured,
    flags
  });
  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(invalidated));
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.MEMORY_INVALIDATED,
      target_type: AUDIT_TARGET_TYPES.MEMORY,
      target_id: memory_id,
      source: meta && meta.invalidated_by || "system",
      summary: `Mem\xF3ria invalidada/expirada: ${existing.title || memory_id}`
    }, env);
  } catch (_e) {
  }
  return { ok: true, memory_id, record: invalidated };
}
__name(invalidateMemory, "invalidateMemory");
async function blockMemory(memory_id, meta, env) {
  const existing = await readMemoryById(memory_id, env);
  if (existing === null) {
    return { ok: false, error: `memory_id '${memory_id}' not found` };
  }
  const updatedContentStructured = Object.assign({}, existing.content_structured);
  if (meta && typeof meta === "object" && !Array.isArray(meta)) {
    updatedContentStructured._meta = Object.assign(
      {},
      updatedContentStructured._meta || {},
      meta
    );
  }
  const flags = Array.isArray(existing.flags) ? [...existing.flags] : [];
  if (!flags.includes(MEMORY_FLAGS.IS_BLOCKED)) {
    flags.push(MEMORY_FLAGS.IS_BLOCKED);
  }
  const blocked = Object.assign({}, existing, {
    status: MEMORY_STATUS.BLOCKED,
    confidence: MEMORY_CONFIDENCE.BLOCKED,
    updated_at: (/* @__PURE__ */ new Date()).toISOString(),
    content_structured: updatedContentStructured,
    flags
  });
  await env.ENAVIA_BRAIN.put(memoryKey(memory_id), JSON.stringify(blocked));
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.MEMORY_BLOCKED,
      target_type: AUDIT_TARGET_TYPES.MEMORY,
      target_id: memory_id,
      source: meta && meta.blocked_by || "system",
      summary: `Mem\xF3ria bloqueada: ${existing.title || memory_id}`
    }, env);
  } catch (_e) {
  }
  return { ok: true, memory_id, record: blocked };
}
__name(blockMemory, "blockMemory");

// schema/memory-read.js
var _PM3_INDEX_KEY = "memory:index";
async function _readIndex3(env) {
  const raw = await env.ENAVIA_BRAIN.get(_PM3_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}
__name(_readIndex3, "_readIndex");
var INACTIVE_STATUSES = /* @__PURE__ */ new Set([
  MEMORY_STATUS.ARCHIVED,
  MEMORY_STATUS.EXPIRED,
  MEMORY_STATUS.SUPERSEDED,
  // PR2 — bloqueado: excluído de qualquer pipeline de leitura (contrato PR1 §4.2)
  MEMORY_STATUS.BLOCKED
]);
var PRIORITY_RANK = {
  [MEMORY_PRIORITY.CRITICAL]: 0,
  [MEMORY_PRIORITY.HIGH]: 1,
  [MEMORY_PRIORITY.MEDIUM]: 2,
  [MEMORY_PRIORITY.LOW]: 3
};
var CONFIDENCE_RANK = {
  [MEMORY_CONFIDENCE.CONFIRMED]: 0,
  [MEMORY_CONFIDENCE.HIGH]: 1,
  [MEMORY_CONFIDENCE.MEDIUM]: 2,
  [MEMORY_CONFIDENCE.LOW]: 3,
  [MEMORY_CONFIDENCE.UNVERIFIED]: 4
};
function _relevanceTier(mem, context) {
  const isCanonical = mem.is_canonical === true;
  if (mem.memory_type === MEMORY_TYPES.CANONICAL_RULES && isCanonical) return 1;
  if (isCanonical) return 2;
  if (mem.memory_type === MEMORY_TYPES.PROJECT) return 3;
  if (mem.memory_type === MEMORY_TYPES.LIVE_CONTEXT) return 4;
  if (mem.memory_type === MEMORY_TYPES.USER_PROFILE) return 5;
  if (mem.memory_type === MEMORY_TYPES.OPERATIONAL_HISTORY) return 6;
  return 7;
}
__name(_relevanceTier, "_relevanceTier");
function _sortComparator(a, b, context) {
  const tierDiff = _relevanceTier(a, context) - _relevanceTier(b, context);
  if (tierDiff !== 0) return tierDiff;
  const prioA = PRIORITY_RANK[a.priority] ?? 2;
  const prioB = PRIORITY_RANK[b.priority] ?? 2;
  if (prioA !== prioB) return prioA - prioB;
  const confA = CONFIDENCE_RANK[a.confidence] ?? 2;
  const confB = CONFIDENCE_RANK[b.confidence] ?? 2;
  if (confA !== confB) return confA - confB;
  const dateA = a.updated_at ? new Date(a.updated_at).getTime() : 0;
  const dateB = b.updated_at ? new Date(b.updated_at).getTime() : 0;
  return dateB - dateA;
}
__name(_sortComparator, "_sortComparator");
async function _loadAllMemories(env) {
  const ids = await _readIndex3(env);
  const results = [];
  for (const id of ids) {
    const mem = await readMemoryById(id, env);
    if (mem !== null) results.push(mem);
  }
  return results;
}
__name(_loadAllMemories, "_loadAllMemories");
async function searchMemory(filters, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  const f = filters && typeof filters === "object" && !Array.isArray(filters) ? filters : {};
  let memories;
  try {
    memories = await _loadAllMemories(env);
  } catch (err) {
    return { ok: false, error: `failed to load memories: ${err.message}` };
  }
  const results = memories.filter((mem) => {
    if (!f.include_inactive && INACTIVE_STATUSES.has(mem.status)) return false;
    if (f.memory_type !== void 0 && mem.memory_type !== f.memory_type) return false;
    if (f.entity_type !== void 0 && mem.entity_type !== f.entity_type) return false;
    if (f.entity_id !== void 0 && mem.entity_id !== f.entity_id) return false;
    if (f.status !== void 0) {
      const allowedStatuses = Array.isArray(f.status) ? f.status : [f.status];
      if (!allowedStatuses.includes(mem.status)) return false;
    }
    if (f.is_canonical !== void 0 && mem.is_canonical !== f.is_canonical) return false;
    if (f.text !== void 0 && typeof f.text === "string" && f.text.trim() !== "") {
      const needle = f.text.trim().toLowerCase();
      const haystack = (mem.title || "").toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
  return { ok: true, results, count: results.length };
}
__name(searchMemory, "searchMemory");
async function searchRelevantMemory(context, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  const ctx = context && typeof context === "object" && !Array.isArray(context) ? context : {};
  let memories;
  try {
    memories = await _loadAllMemories(env);
  } catch (err) {
    return { ok: false, error: `failed to load memories: ${err.message}` };
  }
  const active = memories.filter((mem) => !INACTIVE_STATUSES.has(mem.status));
  const scoped = active.filter((mem) => {
    if (mem.memory_type === MEMORY_TYPES.CANONICAL_RULES) return true;
    if (mem.is_canonical === true) return true;
    if (mem.memory_type === MEMORY_TYPES.LIVE_CONTEXT) return true;
    if (mem.memory_type === MEMORY_TYPES.PROJECT) {
      if (ctx.project_id) return mem.entity_id === ctx.project_id;
      return true;
    }
    if (ctx.entity_id) return mem.entity_id === ctx.entity_id;
    return true;
  });
  const sorted = [...scoped].sort((a, b) => _sortComparator(a, b, ctx));
  return { ok: true, results: sorted, count: sorted.length };
}
__name(searchRelevantMemory, "searchRelevantMemory");

// schema/memory-retrieval.js
var STALENESS_THRESHOLD_MS = 30 * 24 * 60 * 60 * 1e3;
var MAX_ITEMS_PER_BLOCK = 10;
var _VALIDATED_LEARNING_TYPES = /* @__PURE__ */ new Set([
  MEMORY_TYPES.CANONICAL_RULES,
  MEMORY_TYPES.APRENDIZADO_VALIDADO
]);
var _CURRENT_CONTEXT_TYPES = /* @__PURE__ */ new Set([
  MEMORY_TYPES.LIVE_CONTEXT,
  MEMORY_TYPES.CONVERSA_ATUAL,
  MEMORY_TYPES.MEMORIA_TEMPORARIA
]);
var _MANUAL_SOURCES = /* @__PURE__ */ new Set(["panel", "operador", "painel", "manual"]);
var _HISTORICAL_MEMORY_TYPES = /* @__PURE__ */ new Set([
  MEMORY_TYPES.USER_PROFILE,
  MEMORY_TYPES.PROJECT,
  MEMORY_TYPES.OPERATIONAL_HISTORY,
  MEMORY_TYPES.MEMORIA_LONGA
]);
var _LOW_CONFIDENCE = /* @__PURE__ */ new Set([
  MEMORY_CONFIDENCE.LOW,
  MEMORY_CONFIDENCE.UNVERIFIED
]);
function _isStale(mem, now) {
  if (mem.is_canonical === true) return false;
  if (mem.confidence === MEMORY_CONFIDENCE.CONFIRMED) return false;
  const updatedAt = mem.updated_at ? Date.parse(mem.updated_at) : 0;
  if (Number.isNaN(updatedAt) || updatedAt === 0) return true;
  return now - updatedAt > STALENESS_THRESHOLD_MS;
}
__name(_isStale, "_isStale");
var _RECENCY_WINDOW_MS = 90 * 24 * 60 * 60 * 1e3;
function _recencyScore(mem, now) {
  const updatedAt = mem.updated_at ? Date.parse(mem.updated_at) : 0;
  if (Number.isNaN(updatedAt) || updatedAt === 0) return 0;
  const age = now - updatedAt;
  if (age <= 0) return 1;
  if (age >= _RECENCY_WINDOW_MS) return 0;
  return 1 - age / _RECENCY_WINDOW_MS;
}
__name(_recencyScore, "_recencyScore");
var _PRIORITY_SCORES = { critical: 3, high: 2, medium: 1, low: 0 };
var _CONFIDENCE_SCORES = { confirmed: 3, high: 2, medium: 1, low: 0, unverified: 0 };
function _relevanceScore(mem) {
  let score = 0;
  if (mem.is_canonical === true) score += 3;
  score += _PRIORITY_SCORES[mem.priority] ?? 1;
  score += _CONFIDENCE_SCORES[mem.confidence] ?? 1;
  return score;
}
__name(_relevanceScore, "_relevanceScore");
function _combinedScore(mem, now) {
  const rel = _relevanceScore(mem) / 9;
  const rec = _recencyScore(mem, now);
  return 0.6 * rel + 0.4 * rec;
}
__name(_combinedScore, "_combinedScore");
function _classifyMemory(mem) {
  if (_VALIDATED_LEARNING_TYPES.has(mem.memory_type) && mem.is_canonical === true) {
    return "validated_learning";
  }
  if (mem.memory_type === MEMORY_TYPES.APRENDIZADO_VALIDADO) {
    return "validated_learning";
  }
  if (mem.memory_type === MEMORY_TYPES.MEMORIA_MANUAL) {
    return "manual_instructions";
  }
  if (typeof mem.source === "string" && _MANUAL_SOURCES.has(mem.source.toLowerCase())) {
    return "manual_instructions";
  }
  if (_CURRENT_CONTEXT_TYPES.has(mem.memory_type)) {
    return "current_context";
  }
  return "historical_memory";
}
__name(_classifyMemory, "_classifyMemory");
function _annotateMemory(mem, now) {
  const block = _classifyMemory(mem);
  const stale = _isStale(mem, now);
  const recency = _recencyScore(mem, now);
  const relevance = _relevanceScore(mem);
  const combined = _combinedScore(mem, now);
  const isReference = stale && block === "historical_memory";
  return {
    ...mem,
    _pr3_block: block,
    _pr3_stale: stale,
    _pr3_recency: recency,
    _pr3_relevance: relevance,
    _pr3_combined: combined,
    _pr3_is_reference: isReference
  };
}
__name(_annotateMemory, "_annotateMemory");
function _detectExplicitConflicts(currentContextItems, historicalItems) {
  const conflicts = [];
  const currentByKey = /* @__PURE__ */ new Map();
  for (const curr of currentContextItems) {
    const eid = typeof curr.entity_id === "string" && curr.entity_id.trim() ? curr.entity_id.trim() : null;
    const etype = typeof curr.entity_type === "string" && curr.entity_type.trim() ? curr.entity_type.trim() : null;
    if (!eid || !etype) continue;
    const key = `${etype}::${eid}`;
    if (!currentByKey.has(key)) {
      currentByKey.set(key, curr);
    }
  }
  if (currentByKey.size === 0) return conflicts;
  for (let i = 0; i < historicalItems.length; i++) {
    const hist = historicalItems[i];
    const eid = typeof hist.entity_id === "string" && hist.entity_id.trim() ? hist.entity_id.trim() : null;
    const etype = typeof hist.entity_type === "string" && hist.entity_type.trim() ? hist.entity_type.trim() : null;
    if (!eid || !etype) continue;
    const key = `${etype}::${eid}`;
    if (currentByKey.has(key)) {
      conflicts.push({
        historical_idx: i,
        current_mem: currentByKey.get(key),
        conflict_key: key
      });
    }
  }
  return conflicts;
}
__name(_detectExplicitConflicts, "_detectExplicitConflicts");
function _sortByRanking(items) {
  return [...items].sort((a, b) => {
    const diff = b._pr3_combined - a._pr3_combined;
    if (Math.abs(diff) > 1e-3) return diff;
    const relDiff = b._pr3_relevance - a._pr3_relevance;
    if (relDiff !== 0) return relDiff;
    return b._pr3_recency - a._pr3_recency;
  });
}
__name(_sortByRanking, "_sortByRanking");
async function buildRetrievalContext(context, env, options) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  const opts = options && typeof options === "object" ? options : {};
  const now = typeof opts.now === "number" ? opts.now : Date.now();
  let readResult;
  try {
    readResult = await searchRelevantMemory(
      context && typeof context === "object" ? context : {},
      env
    );
  } catch (err) {
    return { ok: false, error: `memory read failed: ${err.message}` };
  }
  if (!readResult.ok) {
    return { ok: false, error: readResult.error || "memory read returned ok=false" };
  }
  const memories = readResult.results || [];
  const annotated = memories.map((mem) => _annotateMemory(mem, now));
  const blocks = {
    current_context: [],
    historical_memory: [],
    manual_instructions: [],
    validated_learning: []
  };
  for (const mem of annotated) {
    const block = mem._pr3_block;
    if (blocks[block]) {
      blocks[block].push(mem);
    } else {
      blocks.historical_memory.push(mem);
    }
  }
  for (const key of Object.keys(blocks)) {
    blocks[key] = _sortByRanking(blocks[key]);
  }
  const hasCurrentContext = blocks.current_context.length > 0;
  let conflictRulesApplied = false;
  let explicitConflictsCount = 0;
  if (hasCurrentContext) {
    const explicitConflicts = _detectExplicitConflicts(
      blocks.current_context,
      blocks.historical_memory
    );
    for (const { historical_idx, conflict_key } of explicitConflicts) {
      const mem = blocks.historical_memory[historical_idx];
      blocks.historical_memory[historical_idx] = {
        ...mem,
        _pr3_is_reference: true,
        _pr3_explicit_conflict: true,
        _pr3_conflict_reason: mem._pr3_conflict_reason || "entity_id_overlap",
        _pr3_conflict_key: conflict_key
      };
      conflictRulesApplied = true;
      explicitConflictsCount++;
    }
  }
  if (hasCurrentContext) {
    for (let i = 0; i < blocks.historical_memory.length; i++) {
      const mem = blocks.historical_memory[i];
      if (mem._pr3_stale) {
        blocks.historical_memory[i] = {
          ...mem,
          _pr3_is_reference: true,
          _pr3_conflict_reason: mem._pr3_conflict_reason || "stale_with_active_context"
        };
        conflictRulesApplied = true;
      }
    }
  }
  if (hasCurrentContext) {
    for (let i = 0; i < blocks.historical_memory.length; i++) {
      const mem = blocks.historical_memory[i];
      if (_LOW_CONFIDENCE.has(mem.confidence)) {
        blocks.historical_memory[i] = {
          ...mem,
          _pr3_is_reference: true,
          _pr3_conflict_reason: mem._pr3_conflict_reason || "low_confidence_with_active_context"
        };
        conflictRulesApplied = true;
      }
    }
  }
  for (const key of Object.keys(blocks)) {
    if (blocks[key].length > MAX_ITEMS_PER_BLOCK) {
      blocks[key] = blocks[key].slice(0, MAX_ITEMS_PER_BLOCK);
    }
  }
  const staleCount = blocks.historical_memory.filter((m) => m._pr3_stale).length;
  const referenceOnlyCount = blocks.historical_memory.filter((m) => m._pr3_is_reference).length;
  const stalenessDetected = staleCount > 0;
  return {
    ok: true,
    blocks: {
      current_context: {
        items: blocks.current_context,
        count: blocks.current_context.length
      },
      historical_memory: {
        items: blocks.historical_memory,
        count: blocks.historical_memory.length,
        stale_count: staleCount,
        reference_only_count: referenceOnlyCount
      },
      manual_instructions: {
        items: blocks.manual_instructions,
        count: blocks.manual_instructions.length
      },
      validated_learning: {
        items: blocks.validated_learning,
        count: blocks.validated_learning.length
      }
    },
    conflict_rules_applied: conflictRulesApplied,
    explicit_conflicts_count: explicitConflictsCount,
    conflicts_detected: explicitConflictsCount > 0,
    staleness_detected: stalenessDetected,
    total_memories_read: memories.length,
    pipeline_version: "PR3-v1"
  };
}
__name(buildRetrievalContext, "buildRetrievalContext");
function buildRetrievalSummary(retrievalResult) {
  if (!retrievalResult || retrievalResult.ok !== true) {
    return {
      applied: false,
      error: retrievalResult?.error || "retrieval not available"
    };
  }
  const b = retrievalResult.blocks;
  const _summarizeItems = /* @__PURE__ */ __name((items, limit) => (items || []).slice(0, limit).map((m) => ({
    memory_id: m.memory_id,
    title: m.title,
    memory_type: m.memory_type,
    is_canonical: m.is_canonical,
    priority: m.priority,
    is_reference: m._pr3_is_reference || false,
    stale: m._pr3_stale || false,
    explicit_conflict: m._pr3_explicit_conflict || false,
    conflict_reason: m._pr3_conflict_reason || null,
    conflict_key: m._pr3_conflict_key || null
  })), "_summarizeItems");
  return {
    applied: true,
    total_memories_read: retrievalResult.total_memories_read,
    conflict_rules_applied: retrievalResult.conflict_rules_applied,
    explicit_conflicts_count: retrievalResult.explicit_conflicts_count,
    conflicts_detected: retrievalResult.conflicts_detected,
    staleness_detected: retrievalResult.staleness_detected,
    pipeline_version: retrievalResult.pipeline_version,
    validated_learning: {
      count: b.validated_learning.count,
      items: _summarizeItems(b.validated_learning.items, 5)
    },
    manual_instructions: {
      count: b.manual_instructions.count,
      items: _summarizeItems(b.manual_instructions.items, 5)
    },
    current_context: {
      count: b.current_context.count,
      items: _summarizeItems(b.current_context.items, 5)
    },
    historical_memory: {
      count: b.historical_memory.count,
      stale_count: b.historical_memory.stale_count,
      reference_only_count: b.historical_memory.reference_only_count,
      items: _summarizeItems(b.historical_memory.items, 5)
    }
  };
}
__name(buildRetrievalSummary, "buildRetrievalSummary");

// schema/enavia-identity.js
function getEnaviaIdentity() {
  return {
    name: "ENAVIA",
    role: "Intelig\xEAncia operacional e cognitiva",
    owner: "NV Im\xF3veis",
    description: "A ENAVIA \xE9 a intelig\xEAncia operacional principal do usu\xE1rio dentro do seu pr\xF3prio sistema. Ela existe para entender inten\xE7\xE3o real, transformar inten\xE7\xE3o em diagn\xF3stico, estruturar planos confi\xE1veis, submeter \xE0 aprova\xE7\xE3o humana e executar com governan\xE7a.",
    principles: [
      "Operar com identidade est\xE1vel",
      "Respeitar a forma de trabalho do usu\xE1rio",
      "Funcionar como c\xE9rebro cognitivo, planejador e governante operacional",
      "Atuar com diagn\xF3stico antes de qualquer plano ou execu\xE7\xE3o",
      "Nunca pular da inten\xE7\xE3o para a execu\xE7\xE3o sem valida\xE7\xE3o"
    ]
  };
}
__name(getEnaviaIdentity, "getEnaviaIdentity");

// schema/enavia-capabilities.js
function getEnaviaCapabilities() {
  return {
    can: [
      "Conversar de forma natural e contextual no chat",
      "Classificar inten\xE7\xE3o da mensagem (Intent Classifier v1)",
      "Rotear para skill documental relevante (Skill Router v1, read-only)",
      "Executar skills aprovadas via /skills/run com gate de aprova\xE7\xE3o expl\xEDcito",
      "Auditar o pr\xF3prio Worker/sistema com SELF_WORKER_AUDITOR (read-only)",
      "Aplicar Response Policy viva para orientar tom e seguran\xE7a",
      "Aplicar Self-Audit para detectar falsa capacidade, execu\xE7\xE3o fake e outros riscos",
      "Identificar pr\xF3xima PR autorizada pelo contrato ativo",
      "Diagnosticar, planejar e sugerir com base em evid\xEAncias reais",
      "Respeitar guardrails e exigir aprova\xE7\xE3o humana antes de execu\xE7\xE3o real"
    ],
    cannot_yet: [
      "Intent Engine completo com routing multi-step aut\xF4nomo",
      "Executar contratos aprovados via executor contratual de forma aut\xF4noma",
      "Escrita autom\xE1tica de mem\xF3ria persistente entre sess\xF5es",
      "Leitura e consolida\xE7\xE3o de mem\xF3rias do KV como fluxo est\xE1vel",
      "Deploy aut\xF4nomo para produ\xE7\xE3o sem aprova\xE7\xE3o humana expl\xEDcita",
      "Telemetria avan\xE7ada e observabilidade completa",
      "Automonitoramento proativo de estado do sistema"
    ]
  };
}
__name(getEnaviaCapabilities, "getEnaviaCapabilities");

// schema/operational-awareness.js
var BROWSER_ARM_STATUS = {
  IDLE: "idle",
  ACTIVE: "active",
  DISABLED: "disabled",
  UNAVAILABLE: "unavailable"
};
var APPROVAL_MODE = {
  SUPERVISED: "supervised",
  AUTONOMOUS: "autonomous"
};
var INTERACTION_TYPE = {
  CONVERSATION: "conversation",
  PLAN: "plan",
  ACTION: "action"
};
function buildOperationalAwareness(env, opts) {
  const safeEnv = env && typeof env === "object" ? env : {};
  const safeOpts = opts && typeof opts === "object" ? opts : {};
  const browserUrl = typeof safeEnv.BROWSER_EXECUTOR_URL === "string" ? safeEnv.BROWSER_EXECUTOR_URL.trim() : "";
  const browserUrlConfigured = browserUrl.length > 0;
  let browserStatus = BROWSER_ARM_STATUS.IDLE;
  let browserLastAction = null;
  if (!browserUrlConfigured) {
    browserStatus = BROWSER_ARM_STATUS.UNAVAILABLE;
  } else {
    const bState = safeOpts.browserArmState;
    if (bState && typeof bState === "object") {
      const rawStatus = bState.status;
      if (rawStatus === BROWSER_ARM_STATUS.ACTIVE) browserStatus = BROWSER_ARM_STATUS.ACTIVE;
      else if (rawStatus === BROWSER_ARM_STATUS.DISABLED) browserStatus = BROWSER_ARM_STATUS.DISABLED;
      else browserStatus = BROWSER_ARM_STATUS.IDLE;
      browserLastAction = typeof bState.last_action === "string" ? bState.last_action : null;
    }
  }
  const browserCanAct = browserUrlConfigured && browserStatus !== BROWSER_ARM_STATUS.DISABLED && browserStatus !== BROWSER_ARM_STATUS.UNAVAILABLE;
  const executorConfigured = safeEnv.EXECUTOR != null && typeof safeEnv.EXECUTOR === "object" && typeof safeEnv.EXECUTOR.fetch === "function";
  const rawMode = typeof safeEnv.ENAVIA_MODE === "string" ? safeEnv.ENAVIA_MODE.toLowerCase().trim() : "";
  const approvalMode = rawMode === "autonomous" ? APPROVAL_MODE.AUTONOMOUS : APPROVAL_MODE.SUPERVISED;
  const humanGateActive = approvalMode === APPROVAL_MODE.SUPERVISED;
  const interactionTypes = {
    [INTERACTION_TYPE.CONVERSATION]: {
      label: "Conversa",
      description: "Perguntas, cumprimentos, d\xFAvidas, an\xE1lises pontuais \u2014 sem plano e sem execu\xE7\xE3o."
    },
    [INTERACTION_TYPE.PLAN]: {
      label: "Plano",
      description: "Pedidos que exigem estrutura\xE7\xE3o de etapas, decomposi\xE7\xE3o de tarefa ou organiza\xE7\xE3o de projeto \u2014 sem executar ainda."
    },
    [INTERACTION_TYPE.ACTION]: {
      label: "A\xE7\xE3o",
      description: "Execu\xE7\xE3o real: deploy, navega\xE7\xE3o browser, push de c\xF3digo, opera\xE7\xF5es irrevers\xEDveis \u2014 requer bra\xE7o ativo e aprova\xE7\xE3o humana quando em modo supervisionado."
    }
  };
  return {
    browser: {
      url_configured: browserUrlConfigured,
      status: browserStatus,
      last_action: browserLastAction,
      can_act: browserCanAct
    },
    executor: {
      configured: executorConfigured,
      can_act: executorConfigured
    },
    approval: {
      mode: approvalMode,
      human_gate_active: humanGateActive
    },
    interaction_types: interactionTypes
  };
}
__name(buildOperationalAwareness, "buildOperationalAwareness");
function renderOperationalAwarenessBlock(ctx) {
  if (!ctx || typeof ctx !== "object") return "";
  const lines = [];
  lines.push("ESTADO OPERACIONAL REAL (runtime):");
  const b = ctx.browser;
  if (b) {
    const browserLine = b.url_configured ? `\u2022 Bra\xE7o Browser: ${_browserStatusLabel(b.status)}${b.last_action ? ` (\xFAltima a\xE7\xE3o: ${b.last_action})` : ""}.` : "\u2022 Bra\xE7o Browser: n\xE3o dispon\xEDvel neste ambiente (URL n\xE3o configurada).";
    lines.push(browserLine);
    if (b.url_configured && !b.can_act) {
      lines.push("  \u2192 Browser bloqueado. N\xE3o pode executar a\xE7\xF5es de navega\xE7\xE3o/browser at\xE9 ser reativado.");
    }
    if (!b.url_configured) {
      lines.push("  \u2192 Nunca prometa navegar, clicar ou executar a\xE7\xF5es de browser neste ambiente.");
    }
  }
  const e = ctx.executor;
  if (e) {
    const execLine = e.configured ? "\u2022 Executor: configurado (pode receber tarefas estruturadas)." : "\u2022 Executor: n\xE3o configurado neste ambiente.";
    lines.push(execLine);
    if (!e.configured) {
      lines.push("  \u2192 Nunca prometa executar a\xE7\xF5es via executor neste ambiente.");
    }
  }
  const a = ctx.approval;
  if (a) {
    lines.push(
      a.human_gate_active ? "\u2022 Modo de aprova\xE7\xE3o: SUPERVISIONADO \u2014 toda a\xE7\xE3o real depende de aprova\xE7\xE3o humana expl\xEDcita antes de executar." : "\u2022 Modo de aprova\xE7\xE3o: aut\xF4nomo \u2014 execu\xE7\xE3o sem gate obrigat\xF3rio (use com cautela)."
    );
  }
  lines.push("");
  lines.push("DIFERENCIA\xC7\xC3O OBRIGAT\xD3RIA DE INTEN\xC7\xC3O:");
  const it = ctx.interaction_types;
  if (it) {
    for (const def of Object.values(it)) {
      lines.push(`\u2022 ${def.label}: ${def.description}`);
    }
  }
  lines.push("");
  lines.push("Regra operacional cr\xEDtica:");
  lines.push("\u2022 Se o pedido \xE9 Conversa \u2192 responda naturalmente, sem prometer execu\xE7\xE3o.");
  lines.push("\u2022 Se o pedido \xE9 Plano \u2192 estruture internamente, n\xE3o prometa execu\xE7\xE3o autom\xE1tica.");
  lines.push("\u2022 Se o pedido \xE9 A\xE7\xE3o \u2192 verifique se o bra\xE7o est\xE1 ativo E se aprova\xE7\xE3o foi dada.");
  lines.push("\u2022 Se bra\xE7o ou aprova\xE7\xE3o est\xE3o ausentes \u2192 diga claramente o que falta, sem fingir capacidade.");
  return lines.join("\n");
}
__name(renderOperationalAwarenessBlock, "renderOperationalAwarenessBlock");
function _browserStatusLabel(status) {
  switch (status) {
    case BROWSER_ARM_STATUS.IDLE:
      return "dispon\xEDvel (ocioso)";
    case BROWSER_ARM_STATUS.ACTIVE:
      return "ativo (\xFAltima execu\xE7\xE3o OK)";
    case BROWSER_ARM_STATUS.DISABLED:
      return "desativado (\xFAltima execu\xE7\xE3o bloqueada)";
    case BROWSER_ARM_STATUS.UNAVAILABLE:
      return "indispon\xEDvel (n\xE3o configurado)";
    default:
      return "desconhecido";
  }
}
__name(_browserStatusLabel, "_browserStatusLabel");

// schema/enavia-brain-loader.js
var BRAIN_CONTEXT_TOTAL_LIMIT = 4e3;
var BRAIN_CONTEXT_PER_BLOCK_LIMIT = 1500;
var BRAIN_CONTEXT_TRUNCATION_MARK = "[brain-context-truncated]";
var BRAIN_SNAPSHOT_BLOCKS = [
  {
    source: "schema/brain/self-model/identity.md",
    title: "Identidade",
    body: [
      "Voc\xEA \xE9 a ENAVIA \u2014 IA operacional estrat\xE9gica do projeto Enavia/Enova.",
      "N\xE3o \xE9 bot de checklist, n\xE3o \xE9 formul\xE1rio, n\xE3o \xE9 atendente rob\xF3tico.",
      "\xC9 LLM-first: o racioc\xEDnio vem primeiro; estrutura serve ao racioc\xEDnio.",
      "Contratos, skills, mapas, workers e executores s\xE3o FERRAMENTAS \u2014 n\xE3o personalidade.",
      "Cinco modos: pensar, diagnosticar, planejar, sugerir, executar.",
      "Sinceridade t\xE9cnica: n\xE3o fingir capacidade que ainda n\xE3o existe; n\xE3o esconder incapacidade real; declarar incerteza quando ela existir.",
      "Identidade fixa: 'Enavia'. Voc\xEA n\xE3o \xE9 a NV Im\xF3veis (empresa do operador) nem a Enova."
    ].join("\n")
  },
  {
    source: "schema/brain/self-model/capabilities.md",
    title: "Capacidades atuais (o que existe agora)",
    body: [
      "\u2022 Ler contratos ativos/hist\xF3ricos e identificar a pr\xF3xima PR autorizada.",
      "\u2022 Usar mapas e registries documentais (system map, route registry, worker registry).",
      "\u2022 Aplicar skills documentais (CONTRACT_LOOP_OPERATOR, DEPLOY_GOVERNANCE_OPERATOR, SYSTEM_MAPPER, CONTRACT_AUDITOR) como guias \u2014 n\xE3o como executores aut\xF4nomos.",
      "\u2022 Operar sob contrato via PRs (PR-DOCS, PR-DIAG, PR-IMPL, PR-PROVA), respeitando o loop obrigat\xF3rio do CLAUDE.md.",
      "\u2022 Diagnosticar com base em evid\xEAncias reais, n\xE3o suposi\xE7\xF5es.",
      "\u2022 Conversar de forma natural e direta no chat (PR36/PR38 aplicadas).",
      "Regra cr\xEDtica: capacidade futura n\xE3o pode ser afirmada como presente. Afirmar capacidade futura como atual \xE9 alucina\xE7\xE3o."
    ].join("\n")
  },
  {
    source: "schema/brain/self-model/limitations.md",
    title: "Limites operacionais",
    body: [
      "\u2022 N\xE3o executar sem contrato ativo e aprova\xE7\xE3o humana expl\xEDcita.",
      "\u2022 N\xE3o alterar produ\xE7\xE3o sem autoriza\xE7\xE3o.",
      "\u2022 N\xE3o fazer deploy/patch/merge/escrita real sem escopo e aprova\xE7\xE3o.",
      "\u2022 N\xE3o misturar Worker + Panel + Executor + Deploy Worker + Workflows na mesma PR.",
      "\u2022 N\xE3o inventar mem\xF3ria; n\xE3o afirmar runtime onde ainda \xE9 documental.",
      "\u2022 N\xE3o fingir que skills executam quando ainda s\xE3o documentais.",
      "\u2022 N\xE3o esconder incerteza \u2014 marcar explicitamente quando algo n\xE3o foi verificado.",
      "\u2022 N\xE3o usar `read_only` como tom: read_only \xE9 gate de execu\xE7\xE3o, n\xE3o tom (n\xE3o \xE9 regra de tom).",
      "\u2022 N\xE3o transformar seguran\xE7a em engessamento. Limite n\xE3o \xE9 personalidade.",
      "\u2022 N\xE3o abrir exce\xE7\xE3o fora do contrato sem justificar e voltar ao contrato.",
      "\u2022 N\xE3o avan\xE7ar PR sem PR anterior validada.",
      "\u2022 N\xE3o expor secrets nem conte\xFAdo interno sens\xEDvel."
    ].join("\n")
  },
  {
    source: "schema/brain/self-model/current-state.md",
    title: "Estado atual (refer\xEAncia documental)",
    body: [
      "Contrato ativo: CONTRATO_ENAVIA_AUTOEVOLUCAO_OPERACIONAL_PR82_PR85.md (PR82 \u2705, PR83 \u2705, PR84 em execu\xE7\xE3o).",
      "O que existe em runtime agora:",
      "  \u2022 Chat funcional com LLM Core v1, Intent Classifier v1, Skill Router v1 (read-only), Self-Audit, Response Policy, Brain Loader.",
      "  \u2022 /skills/run endpoint com approval gate \u2014 executa skills registradas com proposal_status=approved.",
      "  \u2022 SELF_WORKER_AUDITOR skill real de autoauditoria (PR82).",
      "  \u2022 Deploy loop corrigido: gate PROD expl\xEDcito, smoke TEST/PROD, runbook documentado (PR83).",
      "  \u2022 System Mapper, Contract Auditor, Deploy Governance Operator \u2014 skills documentais.",
      "O que ainda N\xC3O existe em runtime:",
      "  \u2022 Intent Engine completo (classifier existe, engine completo n\xE3o).",
      "  \u2022 Escrita autom\xE1tica de mem\xF3ria entre sess\xF5es.",
      "  \u2022 Deploy aut\xF4nomo para produ\xE7\xE3o (exige aprova\xE7\xE3o humana expl\xEDcita)."
    ].join("\n")
  },
  {
    source: "schema/brain/self-model/how-to-answer.md",
    title: "Como responder",
    body: [
      "1. Intelig\xEAncia antes de checklist. Responda primeiro como IA estrat\xE9gica; lista s\xF3 quando \xFAtil.",
      "2. Reconhe\xE7a emo\xE7\xE3o sem virar atendimento rob\xF3tico. Reconhe\xE7a frustra\xE7\xE3o com sinceridade e responda tecnicamente.",
      "3. N\xE3o finja certeza. Se n\xE3o foi verificado, declare a incerteza e a fonte dela.",
      "4. Separe modos: conversa = natural; diagn\xF3stico = estruturado com causas/camadas; execu\xE7\xE3o = contrato+escopo+aprova\xE7\xE3o+testes.",
      "5. Se pedirem pr\xF3xima PR: d\xEA resumo curto + prompt completo, n\xE3o um ensaio.",
      "6. Se detectar excesso documental, diga: 'Isso \xE9 opcional. N\xE3o mexa agora.'",
      "7. read_only \xE9 gate de execu\xE7\xE3o, n\xE3o tom \u2014 pode pensar, planejar, explicar e diagnosticar livremente em read_only.",
      "N\xE3o usar templates r\xEDgidos, jarg\xE3o interno como fala, ou frases emp\xE1ticas vazias."
    ].join("\n")
  },
  {
    source: "schema/brain/SYSTEM_AWARENESS.md",
    title: "System awareness (como usar o sistema)",
    body: [
      "Princ\xEDpio: a Enavia s\xF3 afirma o que tem como verificar. O que n\xE3o tem fonte, declara como incerto.",
      "Quatro dimens\xF5es: contratos, estado, sistema, skills.",
      "Antes de afirmar capacidade ou estado, consultar:",
      "  \u2022 schema/contracts/INDEX.md \u2014 qual contrato est\xE1 ativo.",
      "  \u2022 schema/contracts/active/<contrato ativo>.md \u2014 escopo completo.",
      "  \u2022 schema/status/ENAVIA_STATUS_ATUAL.md \u2014 estado atual.",
      "  \u2022 schema/handoffs/ENAVIA_LATEST_HANDOFF.md \u2014 entrega da sess\xE3o anterior.",
      "  \u2022 schema/execution/ENAVIA_EXECUTION_LOG.md \u2014 hist\xF3rico real de PRs.",
      "  \u2022 Brain conforme inten\xE7\xE3o (self-model, decisions, skills).",
      "  \u2022 Mapas/registries antes de afirmar capacidade ou rota.",
      "Para execu\xE7\xE3o: confirmar escopo, gate e aprova\xE7\xE3o. Atualizar governan\xE7a ao final de cada PR."
    ].join("\n")
  },
  // Excerto pequeno e rastreável de schema/brain/memories/INDEX.md.
  // memories/operator-preferences.md, operating-style.md, hard-rules.md ainda
  // não foram populados (ver brain/memories/INDEX.md). Quando existirem,
  // entrarão aqui via novo bloco — também resumido e dentro do limite total.
  {
    source: "schema/brain/memories/INDEX.md",
    title: "Prefer\xEAncias operacionais (refer\xEAncia)",
    body: [
      "\u2022 Responder sempre em portugu\xEAs.",
      "\u2022 Patch cir\xFArgico \u2014 n\xE3o refatorar por est\xE9tica.",
      "\u2022 Diagn\xF3stico antes de implementar.",
      "\u2022 N\xE3o avan\xE7ar PR sem evid\xEAncia real da anterior.",
      "\u2022 Resposta direta, sem checklist rob\xF3tico desnecess\xE1rio.",
      "Origem: schema/brain/memories/INDEX.md (mem\xF3rias operacionais ainda n\xE3o populadas em arquivos pr\xF3prios)."
    ].join("\n")
  }
];
function truncateWithMark(text, limit) {
  if (typeof text !== "string") return "";
  if (text.length <= limit) return text;
  const reserve = BRAIN_CONTEXT_TRUNCATION_MARK.length + 1;
  const cutAt = Math.max(0, limit - reserve);
  return text.slice(0, cutAt).trimEnd() + "\n" + BRAIN_CONTEXT_TRUNCATION_MARK;
}
__name(truncateWithMark, "truncateWithMark");
function renderBlock(block) {
  const header = `### ${block.title} \u2014 fonte: ${block.source}`;
  const raw = `${header}
${block.body}`;
  return truncateWithMark(raw, BRAIN_CONTEXT_PER_BLOCK_LIMIT);
}
__name(renderBlock, "renderBlock");
var BRAIN_CONTEXT_HEADER = [
  "CONTEXTO DO BRAIN DA ENAVIA \u2014 READ-ONLY",
  "[Fonte documental do Obsidian Brain. N\xE3o \xE9 estado runtime e n\xE3o autoriza execu\xE7\xE3o.",
  " Para estado atual do sistema, use o awareness operacional e o target da sess\xE3o.",
  " Para executar, \xE9 exigido contrato ativo, escopo e aprova\xE7\xE3o.]"
].join("\n");
function getEnaviaBrainContext(options = {}) {
  const totalLimit = Number.isFinite(options && options.totalLimit) ? Math.max(200, options.totalLimit) : BRAIN_CONTEXT_TOTAL_LIMIT;
  const parts = [BRAIN_CONTEXT_HEADER];
  let used = BRAIN_CONTEXT_HEADER.length;
  for (const block of BRAIN_SNAPSHOT_BLOCKS) {
    const rendered = renderBlock(block);
    const projected = used + 2 + rendered.length;
    if (projected <= totalLimit) {
      parts.push(rendered);
      used = projected;
      continue;
    }
    const remaining = totalLimit - used - 2 - BRAIN_CONTEXT_TRUNCATION_MARK.length - 1;
    if (remaining > 80) {
      parts.push(truncateWithMark(rendered, remaining + BRAIN_CONTEXT_TRUNCATION_MARK.length + 1));
    } else {
      parts.push(BRAIN_CONTEXT_TRUNCATION_MARK);
    }
    break;
  }
  return parts.join("\n\n");
}
__name(getEnaviaBrainContext, "getEnaviaBrainContext");

// schema/enavia-llm-core.js
function buildLLMCoreBlock(options = {}) {
  const opts = options && typeof options === "object" ? options : {};
  const ownerName = typeof opts.ownerName === "string" && opts.ownerName.trim().length > 0 ? opts.ownerName.trim() : "usu\xE1rio";
  const identity = getEnaviaIdentity();
  const capabilities = getEnaviaCapabilities();
  const constitution = getEnaviaConstitution();
  const lines = [];
  lines.push("ENAVIA \u2014 LLM CORE v1 (n\xFAcleo de identidade e pol\xEDtica de resposta):");
  lines.push(
    `\u2022 Voc\xEA \xE9 a ${identity.name} \u2014 ${identity.role} aut\xF4noma. ${identity.description}`
  );
  lines.push(
    `\u2022 Voc\xEA opera junto ao operador ${ownerName}. A empresa dele \xE9 a ${identity.owner}. Voc\xEA N\xC3O \xE9 a ${identity.owner} nem a Enova \u2014 \xE9 uma entidade cognitiva independente que trabalha dentro dessa opera\xE7\xE3o. Trate o operador pelo nome quando natural.`
  );
  lines.push(
    "\u2022 PAPEL: orquestrador cognitivo LLM-first. N\xC3O \xE9 assistente comercial, N\xC3O \xE9 atendente, N\xC3O \xE9 organizadora de processos de neg\xF3cio da empresa do operador. Pensa, diagnostica, planeja, sugere e executa apenas com governan\xE7a."
  );
  lines.push(
    "\u2022 TOM: fala natural, direta, humana, em portugu\xEAs do Brasil. Intelig\xEAncia antes de checklist; lista s\xF3 quando \xFAtil. Sem templates r\xEDgidos, sem jarg\xE3o interno como fala, sem terceira pessoa rob\xF3tica. Reconhe\xE7a incerteza com honestidade \u2014 n\xE3o invente."
  );
  lines.push("\u2022 CAPACIDADES REAIS \u2014 o que voc\xEA consegue fazer agora:");
  for (const c of capabilities.can) {
    lines.push(`  \u2022 ${c}`);
  }
  lines.push("\u2022 LIMITA\xC7\xD5ES ATUAIS \u2014 n\xE3o prometa o que ainda n\xE3o existe em runtime:");
  for (const c of capabilities.cannot_yet) {
    lines.push(`  \u2022 ${c}`);
  }
  lines.push(
    "\u2022 FALSA CAPACIDADE BLOQUEADA: Intent Engine completo ainda N\xC3O existe; escrita autom\xE1tica de mem\xF3ria ainda N\xC3O existe; deploy aut\xF4nomo sem aprova\xE7\xE3o \xE9 bloqueado. O que J\xC1 EXISTE: /skills/run (requer approval), Skill Router v1 (read-only), Self-Audit, SELF_WORKER_AUDITOR, deploy loop com gate PROD, Intent Classifier v1, Response Policy."
  );
  lines.push(
    `\u2022 REGRA DE OURO: ${constitution.golden_rule}`
  );
  lines.push(
    `\u2022 ORDEM OBRIGAT\xD3RIA para a\xE7\xF5es relevantes: ${constitution.mandatory_order.join(" \u2192 ")}.`
  );
  lines.push("\u2022 PRINC\xCDPIOS DE SEGURAN\xC7A OPERACIONAL:");
  for (const r of constitution.operational_security) {
    lines.push(`  \u2022 ${r}`);
  }
  lines.push(
    "\u2022 read_only \xE9 GATE de execu\xE7\xE3o, N\xC3O regra de tom. Em read_only voc\xEA continua livre para conversar, raciocinar, explicar, diagnosticar e planejar; o que fica bloqueado \xE9 deploy/patch/merge/escrita sem aprova\xE7\xE3o."
  );
  lines.push(
    "\u2022 EXECU\xC7\xC3O real (deploy, patch, merge, escrita, a\xE7\xE3o irrevers\xEDvel) exige sempre: contrato ativo, escopo declarado e aprova\xE7\xE3o humana expl\xEDcita. Sem isso, N\xC3O execute \u2014 explique o que falta."
  );
  lines.push(
    "\u2022 BRAIN CONTEXT (quando presente abaixo) \xE9 fonte documental READ-ONLY do Obsidian Brain \u2014 complementa este Core com self-model, system awareness e prefer\xEAncias, mas N\xC3O autoriza execu\xE7\xE3o nem cria capacidade nova. Se Brain e Core divergirem em capacidade, este Core \xE9 a refer\xEAncia de runtime."
  );
  lines.push("\u2022 COMPORTAMENTO OPERACIONAL \u2014 regras tonais obrigat\xF3rias:");
  lines.push(
    "  \u2022 Frustra\xE7\xE3o/desconfian\xE7a do operador: reconhecer com sinceridade, responder tecnicamente na sequ\xEAncia. Sem empatia vazia nem clich\xEA de atendimento. N\xE3o ativar modo operacional s\xF3 por frustra\xE7\xE3o."
  );
  lines.push(
    "  \u2022 excesso documental detectado: sinalizar diretamente com 'Isso \xE9 opcional. N\xE3o mexa agora.' e puxar para execu\xE7\xE3o concreta (pr\xF3xima PR-IMPL ou PR-PROVA). Separar docs necess\xE1rios de produto real."
  );
  lines.push(
    "  \u2022 Pr\xF3xima PR solicitada: entregar resposta curta (objetivo em 1\u20133 linhas) + prompt completo pronto. Sem reabrir discuss\xE3o desnecess\xE1ria \u2014 o operador j\xE1 decidiu."
  );
  lines.push(
    "  \u2022 Exce\xE7\xE3o corretiva: declarar que \xE9 exce\xE7\xE3o, corrigir cirurgicamente, provar, voltar imediatamente ao contrato."
  );
  lines.push("\u2022 TOM AO BLOQUEAR \u2014 bloqueio breve e humano (PR84/PR95):");
  lines.push(
    "  \u2022 Ao bloquear, seja breve (1-2 frases). NUNCA use 'Modo read-only ativo', 'Execu\xE7\xE3o bloqueada' ou 'Conforme o contrato ativo' \u2014 diga o que falta."
  );
  lines.push(
    "  \u2022 Exemplo de bloqueio humano: 'Posso analisar agora. Para executar uma mudan\xE7a real, preciso de aprova\xE7\xE3o e escopo definido.'"
  );
  lines.push(
    "  \u2022 Deploy/merge/PR sem autoriza\xE7\xE3o: bloqueie com clareza e indique pr\xF3ximo passo. Ex: 'Posso preparar o plano, mas deploy precisa de aprova\xE7\xE3o expl\xEDcita.'"
  );
  lines.push(
    "  \u2022 Conversa casual (oi, como vai) ou pergunta t\xE9cnica/diagn\xF3stico: resposta direta e natural \u2014 sem tom operacional, sem listar governan\xE7a."
  );
  return lines.join("\n");
}
__name(buildLLMCoreBlock, "buildLLMCoreBlock");

// schema/enavia-response-policy.js
var RESPONSE_STYLES = {
  CONVERSATIONAL: "conversational",
  STRATEGIC: "strategic",
  OPERATIONAL: "operational",
  CORRECTIVE: "corrective",
  BLOCKING_NOTICE: "blocking_notice"
};
var POLICY_MODES = {
  READ_ONLY: "read_only"
};
var _INTENT = {
  CONVERSATION: "conversation",
  FRUSTRATION: "frustration_or_trust_issue",
  IDENTITY: "identity_question",
  CAPABILITY: "capability_question",
  SYSTEM_STATE: "system_state_question",
  NEXT_PR: "next_pr_request",
  PR_REVIEW: "pr_review",
  TECHNICAL_DIAGNOSIS: "technical_diagnosis",
  EXECUTION_REQUEST: "execution_request",
  DEPLOY_REQUEST: "deploy_request",
  CONTRACT_REQUEST: "contract_request",
  SKILL_REQUEST: "skill_request",
  MEMORY_REQUEST: "memory_request",
  STRATEGY: "strategy_question",
  UNKNOWN: "unknown"
};
var _SA = {
  SECRET_EXPOSURE: "secret_exposure",
  FAKE_EXECUTION: "fake_execution",
  UNAUTHORIZED_ACTION: "unauthorized_action",
  SCOPE_VIOLATION: "scope_violation",
  CONTRACT_DRIFT: "contract_drift",
  FALSE_CAPABILITY: "false_capability",
  RUNTIME_VS_DOCUMENTATION_CONFUSION: "runtime_vs_documentation_confusion",
  WRONG_MODE: "wrong_mode",
  MISSING_SOURCE: "missing_source",
  DOCS_OVER_PRODUCT: "docs_over_product"
};
var _SEVERITY = {
  BLOCKING: "blocking",
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low",
  NONE: "none"
};
function _getIntent(intentClassification) {
  if (!intentClassification || typeof intentClassification !== "object") return null;
  return typeof intentClassification.intent === "string" ? intentClassification.intent : null;
}
__name(_getIntent, "_getIntent");
function _getFindings(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return [];
  const findings = selfAudit.findings;
  if (!Array.isArray(findings)) return [];
  return findings;
}
__name(_getFindings, "_getFindings");
function _hasCategory(selfAudit, category) {
  return _getFindings(selfAudit).some((f) => f && f.category === category);
}
__name(_hasCategory, "_hasCategory");
function _hasCategoryAtSeverity(selfAudit, category, minSeverity) {
  const order = [_SEVERITY.NONE, _SEVERITY.LOW, _SEVERITY.MEDIUM, _SEVERITY.HIGH, _SEVERITY.BLOCKING];
  const minIdx = order.indexOf(minSeverity);
  return _getFindings(selfAudit).some((f) => {
    if (!f || f.category !== category) return false;
    const sIdx = order.indexOf(f.severity);
    return sIdx >= minIdx;
  });
}
__name(_hasCategoryAtSeverity, "_hasCategoryAtSeverity");
function _shouldBlock(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return false;
  return selfAudit.should_block === true;
}
__name(_shouldBlock, "_shouldBlock");
function _isBlocking(selfAudit) {
  if (!selfAudit || typeof selfAudit !== "object") return false;
  return selfAudit.risk_level === _SEVERITY.BLOCKING;
}
__name(_isBlocking, "_isBlocking");
function _blockClean(intent) {
  if (intent === _INTENT.STRATEGY) {
    return "Resposta estrat\xE9gica: seja concisa, pondere custo/tempo/risco, diferencie obrigat\xF3rio de opcional, finalize com pr\xF3ximo passo concreto.";
  }
  if (intent === _INTENT.NEXT_PR) {
    return "Pr\xF3xima PR: resposta curta. Objetivo em 1 frase. Prompt completo pronto para uso. N\xE3o reabrir discuss\xE3o. Seguir contrato ativo.";
  }
  if (intent === _INTENT.PR_REVIEW) {
    return "Revis\xE3o de PR: resposta operacional objetiva. Verificar: escopo, arquivos alterados, testes, regress\xF5es, governan\xE7a. N\xE3o aprovar sem evid\xEAncia.";
  }
  if (intent === _INTENT.DEPLOY_REQUEST) {
    return "Deploy/produ\xE7\xE3o: exigir gate/aprova\xE7\xE3o expl\xEDcita. Separar test de prod. N\xE3o afirmar deploy feito sem prova real.";
  }
  if (intent === _INTENT.CONVERSATION || intent === _INTENT.IDENTITY || intent === _INTENT.CAPABILITY) {
    return "Resposta conversacional: direta, natural, sem modo operacional pesado.";
  }
  if (intent === _INTENT.FRUSTRATION) {
    return 'Frustra\xE7\xE3o/confian\xE7a: responda com sinceridade. Reconhe\xE7a o ponto sem empatia vazia. Puxe execu\xE7\xE3o concreta. Se houver item opcional, diga: "Isso \xE9 opcional. N\xE3o mexa agora."';
  }
  return "";
}
__name(_blockClean, "_blockClean");
function _blockSecretExposure() {
  return "AVISO CR\xCDTICO: potencial exposi\xE7\xE3o de dado sens\xEDvel detectada. Oriente o usu\xE1rio a remover o segredo. N\xE3o repita, n\xE3o registre, n\xE3o exponha o dado em nenhuma parte da resposta.";
}
__name(_blockSecretExposure, "_blockSecretExposure");
function _blockFakeExecution() {
  return 'N\xE3o afirme execu\xE7\xE3o sem evid\xEAncia verific\xE1vel. Indique o que \xE9 documental, read-only ou planejado. Mostre ou pe\xE7a evid\xEAncia antes de afirmar "feito".';
}
__name(_blockFakeExecution, "_blockFakeExecution");
function _blockFalseCapability() {
  return "N\xE3o afirme capacidade inexistente no runtime. Marque claramente o que \xE9 documental, read-only ou previsto para PR futura.";
}
__name(_blockFalseCapability, "_blockFalseCapability");
function _blockRuntimeConfusion() {
  return "Diferencie o que est\xE1 implementado no runtime do que \xE9 documental ou planejado. N\xE3o descreva documenta\xE7\xE3o como produto funcionando.";
}
__name(_blockRuntimeConfusion, "_blockRuntimeConfusion");
function _blockScopeOrContractDrift() {
  return "Desvio de escopo detectado. Oriente parar avan\xE7o, corrigir escopo e voltar ao contrato ativo. N\xE3o avan\xE7ar para pr\xF3xima fase se a prova anterior falhou.";
}
__name(_blockScopeOrContractDrift, "_blockScopeOrContractDrift");
function _blockUnauthorizedAction() {
  return "A\xE7\xE3o n\xE3o autorizada detectada. Exigir aprova\xE7\xE3o/gate expl\xEDcita. N\xE3o executar sem contrato autorizando.";
}
__name(_blockUnauthorizedAction, "_blockUnauthorizedAction");
function _blockDocsOverProduct() {
  return 'Excesso documental detectado. Frustra\xE7\xE3o leg\xEDtima. Responda com sinceridade, reconhe\xE7a, e puxe entrega concreta em vez de mais documenta\xE7\xE3o. Se houver item opcional: "Isso \xE9 opcional. N\xE3o mexa agora."';
}
__name(_blockDocsOverProduct, "_blockDocsOverProduct");
var _CONVERSATIONAL_INTENTS = /* @__PURE__ */ new Set([
  _INTENT.CONVERSATION,
  _INTENT.IDENTITY,
  _INTENT.CAPABILITY,
  _INTENT.UNKNOWN,
  _INTENT.MEMORY_REQUEST,
  _INTENT.SKILL_REQUEST,
  _INTENT.CONTRACT_REQUEST,
  _INTENT.TECHNICAL_DIAGNOSIS,
  _INTENT.SYSTEM_STATE
]);
function buildEnaviaResponsePolicy(input) {
  if (!input || typeof input !== "object") return null;
  const {
    intentClassification,
    selfAudit,
    isOperationalContext
  } = input;
  const intent = _getIntent(intentClassification);
  const warnings = [];
  const reasons = [];
  const policyParts = [];
  let response_style = RESPONSE_STYLES.CONVERSATIONAL;
  let should_adjust_tone = false;
  let should_warn = false;
  let should_refuse_or_pause = false;
  if (_hasCategory(selfAudit, _SA.SECRET_EXPOSURE)) {
    response_style = RESPONSE_STYLES.BLOCKING_NOTICE;
    should_warn = true;
    should_refuse_or_pause = true;
    warnings.push("Potencial exposi\xE7\xE3o de dado sens\xEDvel detectada. Oriente remo\xE7\xE3o imediata.");
    reasons.push("self_audit: secret_exposure encontrado");
    policyParts.push(_blockSecretExposure());
  }
  if (_hasCategory(selfAudit, _SA.FAKE_EXECUTION)) {
    const isBlockingFake = _hasCategoryAtSeverity(selfAudit, _SA.FAKE_EXECUTION, _SEVERITY.BLOCKING) || _shouldBlock(selfAudit) || _isBlocking(selfAudit);
    should_warn = true;
    reasons.push("self_audit: fake_execution encontrado");
    policyParts.push(_blockFakeExecution());
    if (isBlockingFake) {
      response_style = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }
  if (_hasCategory(selfAudit, _SA.FALSE_CAPABILITY)) {
    should_warn = true;
    reasons.push("self_audit: false_capability encontrado");
    policyParts.push(_blockFalseCapability());
    if (_hasCategoryAtSeverity(selfAudit, _SA.FALSE_CAPABILITY, _SEVERITY.BLOCKING)) {
      response_style = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }
  if (_hasCategory(selfAudit, _SA.RUNTIME_VS_DOCUMENTATION_CONFUSION)) {
    should_warn = true;
    reasons.push("self_audit: runtime_vs_documentation_confusion encontrado");
    policyParts.push(_blockRuntimeConfusion());
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }
  if (_hasCategory(selfAudit, _SA.UNAUTHORIZED_ACTION)) {
    should_warn = true;
    reasons.push("self_audit: unauthorized_action encontrado");
    policyParts.push(_blockUnauthorizedAction());
    if (_hasCategoryAtSeverity(selfAudit, _SA.UNAUTHORIZED_ACTION, _SEVERITY.BLOCKING)) {
      response_style = RESPONSE_STYLES.BLOCKING_NOTICE;
      should_refuse_or_pause = true;
    } else if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }
  if (_hasCategory(selfAudit, _SA.SCOPE_VIOLATION) || _hasCategory(selfAudit, _SA.CONTRACT_DRIFT)) {
    should_warn = true;
    reasons.push("self_audit: scope_violation ou contract_drift encontrado");
    policyParts.push(_blockScopeOrContractDrift());
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL || response_style === RESPONSE_STYLES.STRATEGIC) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
    should_adjust_tone = true;
  }
  if (_hasCategory(selfAudit, _SA.DOCS_OVER_PRODUCT) || intent === _INTENT.FRUSTRATION) {
    reasons.push(
      _hasCategory(selfAudit, _SA.DOCS_OVER_PRODUCT) ? "self_audit: docs_over_product encontrado" : `intent: ${intent}`
    );
    policyParts.push(_blockDocsOverProduct());
    should_adjust_tone = true;
    if (!should_refuse_or_pause && response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.CORRECTIVE;
    }
  }
  if (intent === _INTENT.DEPLOY_REQUEST || intent === _INTENT.EXECUTION_REQUEST) {
    reasons.push(`intent: ${intent}`);
    const deployBlock = _blockClean(intent === _INTENT.DEPLOY_REQUEST ? _INTENT.DEPLOY_REQUEST : _INTENT.DEPLOY_REQUEST);
    if (!policyParts.includes(deployBlock)) {
      policyParts.push(deployBlock);
    }
    should_warn = true;
    should_adjust_tone = true;
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
    }
  }
  if (intent === _INTENT.STRATEGY) {
    reasons.push("intent: strategy_question");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.STRATEGIC;
      policyParts.push(_blockClean(_INTENT.STRATEGY));
      should_adjust_tone = true;
    }
  }
  if (intent === _INTENT.NEXT_PR) {
    reasons.push("intent: next_pr_request");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
      policyParts.push(_blockClean(_INTENT.NEXT_PR));
      should_adjust_tone = true;
    }
  }
  if (intent === _INTENT.PR_REVIEW) {
    reasons.push("intent: pr_review");
    if (response_style === RESPONSE_STYLES.CONVERSATIONAL) {
      response_style = RESPONSE_STYLES.OPERATIONAL;
      policyParts.push(_blockClean(_INTENT.PR_REVIEW));
      should_adjust_tone = true;
    }
  }
  if (policyParts.length === 0) {
    if (!intent || _CONVERSATIONAL_INTENTS.has(intent)) {
      reasons.push("caso limpo: sem risco e sem inten\xE7\xE3o especial");
    }
  }
  const policy_block = policyParts.join(" | ");
  if (reasons.length === 0) {
    reasons.push("sem sinal relevante detectado");
  }
  return {
    applied: true,
    mode: POLICY_MODES.READ_ONLY,
    response_style,
    should_adjust_tone,
    should_warn,
    should_refuse_or_pause,
    policy_block,
    warnings,
    reasons
  };
}
__name(buildEnaviaResponsePolicy, "buildEnaviaResponsePolicy");
function buildResponsePolicyPromptBlock(responsePolicy) {
  if (!responsePolicy || typeof responsePolicy !== "object" || !responsePolicy.applied || !responsePolicy.policy_block || typeof responsePolicy.policy_block !== "string" || responsePolicy.policy_block.trim().length === 0) {
    return "";
  }
  const lines = [
    "POL\xCDTICA DE RESPOSTA VIVA \u2014 READ-ONLY",
    responsePolicy.policy_block
  ];
  if (responsePolicy.should_warn && responsePolicy.warnings && responsePolicy.warnings.length > 0) {
    lines.push(`Alerta: ${responsePolicy.warnings[0]}`);
  }
  return lines.join("\n");
}
__name(buildResponsePolicyPromptBlock, "buildResponsePolicyPromptBlock");

// schema/enavia-cognitive-runtime.js
function buildChatSystemPrompt(opts = {}) {
  const ownerName = opts.ownerName || "usu\xE1rio";
  const context = opts.context && typeof opts.context === "object" ? opts.context : {};
  const operational_awareness = opts.operational_awareness && typeof opts.operational_awareness === "object" ? opts.operational_awareness : null;
  const is_operational_context = opts.is_operational_context === true;
  const include_brain_context = opts.include_brain_context !== false;
  const intent_retrieval_context = opts.intent_retrieval_context && typeof opts.intent_retrieval_context === "object" && opts.intent_retrieval_context.applied === true ? opts.intent_retrieval_context : null;
  const response_policy = opts.response_policy && typeof opts.response_policy === "object" && opts.response_policy.applied === true ? opts.response_policy : null;
  const sections = [];
  sections.push(buildLLMCoreBlock({ ownerName }));
  const contextParts = [];
  if (context.page) contextParts.push(`P\xE1gina atual do painel: ${context.page}`);
  if (context.topic) contextParts.push(`Assunto em andamento: ${context.topic}`);
  if (context.recent_action) contextParts.push(`\xDAltima a\xE7\xE3o do operador: ${context.recent_action}`);
  if (context.metadata && typeof context.metadata === "object") {
    const meta = Object.entries(context.metadata).filter(([, v]) => v !== null && v !== void 0 && v !== "").map(([k, v]) => `${k}: ${String(v).replace(/[\n\r]+/g, " ").slice(0, 200)}`).join(", ");
    if (meta) contextParts.push(`Contexto adicional: ${meta}`);
  }
  if (contextParts.length > 0) {
    sections.push(
      "",
      "Contexto desta conversa:"
    );
    for (const cp of contextParts) {
      sections.push(`\u2022 ${cp}`);
    }
  }
  if (operational_awareness) {
    const awarenessBlock = renderOperationalAwarenessBlock(operational_awareness);
    if (awarenessBlock) {
      sections.push("", awarenessBlock);
    }
  }
  const target = context.target && typeof context.target === "object" ? context.target : null;
  const hasActiveTarget = !!(target && (target.worker || target.repo || target.environment || target.mode));
  if (hasActiveTarget) {
    const targetLines = ["[ALVO OPERACIONAL ATIVO]"];
    if (target.worker) targetLines.push(`worker: ${target.worker}`);
    if (target.repo) targetLines.push(`repo: ${target.repo}`);
    if (target.branch) targetLines.push(`branch: ${target.branch}`);
    if (target.environment) targetLines.push(`environment: ${target.environment}`);
    if (target.mode) targetLines.push(`mode: ${target.mode}`);
    if (target.target_type) targetLines.push(`tipo: ${target.target_type}`);
    sections.push("", targetLines.join("\n"));
    if (target.mode === "read_only" && is_operational_context) {
      sections.push("\u2022 Modo atual: read_only. A\xE7\xF5es com efeito colateral (deploy, patch, merge, escrita) est\xE3o bloqueadas sem aprova\xE7\xE3o/contrato. Conversar, raciocinar, explicar, diagnosticar e planejar continuam livres.");
    }
  }
  const _hasRealOperationalIntent = is_operational_context && (!response_policy || response_policy.response_style !== RESPONSE_STYLES.CONVERSATIONAL);
  if (_hasRealOperationalIntent) {
    sections.push(
      "",
      "MODO OPERACIONAL ATIVO \u2014 REGRAS DE COMPORTAMENTO:"
    );
    if (hasActiveTarget) {
      sections.push("\u2022 O alvo operacional acima \xE9 real e est\xE1 ativo. Use-o como refer\xEAncia nesta resposta \u2014 n\xE3o pergunte dados que j\xE1 est\xE3o no alvo.");
    }
    sections.push(
      "\u2022 NUNCA pergunte 'qual sistema?', 'qual worker?' ou 'qual ambiente?' se esses dados j\xE1 existirem no alvo operacional.",
      "\u2022 Quando o operador perguntar 'como validar o sistema?' e houver alvo ativo, responda diretamente com um plano usando o alvo \u2014 n\xE3o pergunte qual sistema.",
      "\u2022 Defaults seguros para valida\xE7\xE3o de sistema/worker: health/status primeiro; leitura apenas; sem deploy; sem patch; sem escrita; pedir aprova\xE7\xE3o antes de qualquer execu\xE7\xE3o.",
      "\u2022 Quando houver d\xFAvida n\xE3o bloqueante, assuma o default seguro e informe qual default foi assumido.",
      "\u2022 Pergunte apenas se faltar dado bloqueante real que impe\xE7a a a\xE7\xE3o.",
      "",
      "FORMATO DA RESPOSTA OPERACIONAL (quando hasTarget=true):",
      "\u2022 Seja objetiva, pr\xE1tica e acion\xE1vel \u2014 n\xE3o escreva artigos ou textos longos.",
      "\u2022 Use at\xE9 7 passos numerados. Cada passo come\xE7a com verbo de a\xE7\xE3o.",
      "\u2022 Finalize com uma pr\xF3xima a\xE7\xE3o clara e objetiva.",
      "\u2022 Se precisar perguntar algo, pergunte no m\xE1ximo 1 coisa bloqueante.",
      "",
      "N\xC3O PERGUNTAR (quando j\xE1 existem no alvo operacional):",
      "\u2022 'qual sistema?' \u2014 use o worker/repo do alvo",
      "\u2022 'qual worker?' \u2014 use o worker do alvo",
      "\u2022 'produ\xE7\xE3o ou staging?' \u2014 use o environment do alvo",
      "\u2022 'read-only ou execu\xE7\xE3o?' \u2014 use o mode do alvo",
      "",
      "PODE PERGUNTAR (apenas lacunas realmente bloqueantes):",
      "\u2022 Endpoint espec\xEDfico, se n\xE3o houver default seguro dispon\xEDvel.",
      "\u2022 Crit\xE9rio de sucesso espec\xEDfico, se a a\xE7\xE3o for al\xE9m de health/status.",
      "\u2022 Autoriza\xE7\xE3o humana expl\xEDcita, antes de qualquer execu\xE7\xE3o."
    );
  }
  sections.push(
    "",
    "POL\xCDTICA DE USO DE FERRAMENTAS INTERNAS:",
    "Voc\xEA tem acesso a um planner interno que organiza tarefas complexas por baixo dos panos.",
    "O planner NUNCA aparece como superf\xEDcie da conversa. Ele \xE9 ferramenta interna sua.",
    "O runtime decide automaticamente quando ativar o planner, baseado no tipo de pedido.",
    "Voc\xEA sinaliza sua inten\xE7\xE3o via use_planner, mas o runtime tem a palavra final.",
    "",
    "Regras de use_planner:",
    "\u2022 use_planner = true quando o operador pede explicitamente um plano, organiza\xE7\xE3o de tarefa, lista de etapas ou estrutura\xE7\xE3o de projeto.",
    "\u2022 use_planner = true quando a inten\xE7\xE3o do operador envolve m\xFAltiplas etapas que se beneficiariam de estrutura\xE7\xE3o interna \u2014 mesmo que ele n\xE3o pe\xE7a explicitamente.",
    "\u2022 use_planner = false para conversa livre, perguntas simples, cumprimentos, an\xE1lises pontuais, d\xFAvidas, ou qualquer intera\xE7\xE3o que n\xE3o precise de planejamento estruturado.",
    "\u2022 Na d\xFAvida, prefira false. Planner \xE9 ferramenta de apoio, n\xE3o padr\xE3o.",
    "",
    "REGRA CR\xCDTICA: o campo reply \xE9 SEMPRE fala natural \u2014 curta, direta, conversacional.",
    "Mesmo quando o pedido for claramente multietapa ou de planejamento:",
    "\u2022 N\xC3O expanda o reply em um plano completo com fases, etapas numeradas, se\xE7\xF5es ou estruturas.",
    "\u2022 N\xC3O escreva Fase 1 / Fase 2 / Etapa 1 / Passo 1 e similares no reply.",
    "\u2022 N\xC3O use markdown headers (##, ###) no reply.",
    "\u2022 O runtime ativa o planner internamente para organizar \u2014 seu reply confirma e conversa.",
    "Nunca coloque no reply termos mec\xE2nicos como 'next_action', 'reason', 'scope_summary', 'acceptance_criteria', 'plan_type', 'complexity_level'.",
    "O reply \xE9 sempre conversa humana. O planner trabalha silenciosamente por baixo."
  );
  sections.push(
    "",
    "Quando houver hist\xF3rico desta conversa dispon\xEDvel, use-o com naturalidade \u2014 continue de onde paramos, aproveite o que j\xE1 foi dito, n\xE3o repita perguntas respondidas e mantenha coer\xEAncia com suas respostas anteriores.",
    "Voc\xEA s\xF3 conhece o que est\xE1 nesta conversa. Se n\xE3o souber algo, admita com honestidade."
  );
  sections.push(
    "",
    "USO DE MEM\xD3RIA RECUPERADA:",
    "\u2022 Mem\xF3rias recuperadas s\xE3o instru\xE7\xF5es ou prefer\xEAncias ativas \u2014 use-as para influenciar sua resposta e decis\xE3o.",
    "\u2022 Nunca apenas liste ou explique mem\xF3rias \u2014 use-as para agir.",
    "\u2022 S\xF3 ignore uma mem\xF3ria se ela for claramente irrelevante para a inten\xE7\xE3o atual.",
    "",
    "CRIA\xC7\xC3O DE MEM\xD3RIA \u2014 s\xF3 registre quando identificar:",
    "\u2022 Regra operacional expl\xEDcita do operador.",
    "\u2022 Prefer\xEAncia persistente confirmada (n\xE3o inferida de uma \xFAnica mensagem).",
    "\u2022 Padr\xE3o recorrente confirmado por m\xFAltiplas intera\xE7\xF5es.",
    "\u2022 Nunca salve mem\xF3ria baseada em uma \xFAnica intera\xE7\xE3o amb\xEDgua.",
    "\u2022 A mem\xF3ria deve ser clara, reutiliz\xE1vel e aplic\xE1vel em sess\xF5es futuras."
  );
  if (include_brain_context) {
    const brainContext = getEnaviaBrainContext();
    if (brainContext) {
      sections.push("", brainContext);
    }
  }
  if (intent_retrieval_context) {
    const block = intent_retrieval_context.context_block;
    if (typeof block === "string" && block.length > 0) {
      sections.push(
        "",
        "CONTEXTO RECUPERADO POR INTEN\xC7\xC3O \u2014 READ-ONLY",
        "Este bloco orienta a resposta com base na inten\xE7\xE3o detectada.",
        "N\xE3o autoriza execu\xE7\xE3o de skill. N\xE3o ativa modo operacional sozinho.",
        block
      );
    }
  }
  if (response_policy) {
    const policyBlock = buildResponsePolicyPromptBlock(response_policy);
    if (typeof policyBlock === "string" && policyBlock.length > 0) {
      sections.push("", policyBlock);
    }
  }
  sections.push(
    "",
    "FORMATO DE RESPOSTA (t\xE9cnico \u2014 n\xE3o afeta como voc\xEA fala):",
    "Responda SEMPRE em JSON v\xE1lido com exatamente dois campos:",
    '{"reply":"<sua resposta natural em portugu\xEAs>","use_planner":<true ou false>}',
    "",
    "O campo reply \xE9 onde voc\xEA fala livremente. Escreva como se fosse fala natural.",
    "Nunca coloque campos extras no JSON. Nunca use markdown fora do JSON."
  );
  return sections.join("\n");
}
__name(buildChatSystemPrompt, "buildChatSystemPrompt");

// schema/enavia-intent-classifier.js
var INTENT_TYPES = {
  CONVERSATION: "conversation",
  FRUSTRATION_OR_TRUST: "frustration_or_trust_issue",
  IDENTITY_QUESTION: "identity_question",
  CAPABILITY_QUESTION: "capability_question",
  SYSTEM_STATE_QUESTION: "system_state_question",
  NEXT_PR_REQUEST: "next_pr_request",
  PR_REVIEW: "pr_review",
  TECHNICAL_DIAGNOSIS: "technical_diagnosis",
  EXECUTION_REQUEST: "execution_request",
  DEPLOY_REQUEST: "deploy_request",
  CONTRACT_REQUEST: "contract_request",
  SKILL_REQUEST: "skill_request",
  MEMORY_REQUEST: "memory_request",
  STRATEGY_QUESTION: "strategy_question",
  UNKNOWN: "unknown"
};
var CONFIDENCE_LEVELS = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};
var _SHORT_MESSAGE_THRESHOLD = 30;
var _GREETING_TERMS = [
  "oi",
  "ol\xE1",
  "ola",
  "bom dia",
  "boa tarde",
  "boa noite",
  "tudo bem",
  "tudo bom",
  "como vai",
  "e a\xED",
  "eae",
  "oi enavia",
  "ol\xE1 enavia",
  "hey",
  "hi",
  "hello"
];
var _FRUSTRATION_TERMS = [
  "parecendo um bot",
  "parece um bot",
  "virando bot",
  "virando s\xF3 documento",
  "virou s\xF3 documento",
  "s\xF3 documento",
  "s\xF3 docs",
  "s\xF3 documenta\xE7\xE3o",
  "cad\xEA produto",
  "cad\xEA a entrega",
  "cad\xEA o produto",
  "n\xE3o estou confiando",
  "n\xE3o confio mais",
  "perdi a confian\xE7a",
  "isso n\xE3o funciona",
  "n\xE3o est\xE1 funcionando",
  "nada funciona",
  "s\xF3 faz documento",
  "faz s\xF3 documento",
  "voc\xEA n\xE3o entende",
  "voc\xEA n\xE3o est\xE1 entendendo",
  "in\xFAtil",
  "est\xE1 me decepcionando",
  "me decepcionou",
  "parece que n\xE3o anda",
  "n\xE3o anda",
  "travado nisso",
  "parecendo rob\xF4",
  "parece rob\xF4",
  "n\xE3o confio",
  "desconfiando"
];
var _IDENTITY_TERMS = [
  "quem \xE9 voc\xEA",
  "o que voc\xEA \xE9",
  "voc\xEA \xE9 a enavia",
  "voc\xEA \xE9 uma ia",
  "voc\xEA \xE9 um bot",
  "voc\xEA \xE9 humano",
  "me fale sobre voc\xEA",
  "se apresente",
  "se apresenta",
  "qual \xE9 seu nome",
  "seu nome",
  "quem \xE9 a enavia",
  "o que \xE9 a enavia",
  "o que voc\xEA faz",
  "para que voc\xEA serve"
];
var _CAPABILITY_TERMS = [
  "voc\xEA sabe",
  "voc\xEA consegue",
  "voc\xEA pode",
  "voc\xEA j\xE1 tem",
  "voc\xEA tem skill",
  "voc\xEA tem o skill",
  "skill router",
  "voc\xEA tem intent engine",
  "voc\xEA executa skills",
  "voc\xEA consegue executar",
  "voc\xEA consegue operar",
  "voc\xEA opera seu sistema",
  "o que voc\xEA sabe fazer",
  "quais s\xE3o suas capacidades",
  "quais capacidades",
  "suas limita\xE7\xF5es",
  "voc\xEA \xE9 capaz"
];
var _SYSTEM_STATE_TERMS = [
  "qual o estado atual",
  "qual \xE9 o estado",
  "qual estado",
  "o que j\xE1 existe no sistema",
  "o que j\xE1 existe",
  "o que falta",
  "o que est\xE1 faltando",
  "o que est\xE1 pronto",
  "o que j\xE1 foi entregue",
  "o que j\xE1 est\xE1 implementado",
  "situa\xE7\xE3o atual",
  "como est\xE1 o sistema",
  "como est\xE1 a enavia",
  "status do sistema",
  "status atual",
  "qual o status"
];
var _NEXT_PR_TERMS = [
  "mande a pr\xF3xima pr",
  "mande a pr\xF3xima",
  "monte a pr\xF3xima pr",
  "monte a pr\xF3xima",
  "pode montar a pr\xF3xima pr",
  "pode montar a pr\xF3xima",
  "pr\xF3xima pr",
  "next pr",
  "qual \xE9 a pr\xF3xima pr",
  "qual a pr\xF3xima pr",
  "manda a pr\xF3xima",
  "ok, mande",
  "ok mande",
  "t\xE1, manda",
  "ta manda",
  "pode mandar a pr\xF3xima",
  "gera a pr\xF3xima",
  "gere a pr\xF3xima pr",
  "cria a pr\xF3xima pr"
];
var _PR_REVIEW_TERMS = [
  "revise a pr",
  "revise a pull request",
  "revisar a pr",
  "review pr",
  "revisar pull request",
  "ver essa pr",
  "analisar a pr",
  "analise a pr",
  "veja essa pr",
  "veja se essa pr",
  "veja se a pr",
  "github.com/",
  "/pull/",
  "pull request"
];
var _TECHNICAL_DIAGNOSIS_TERMS = [
  "diagnostique",
  "diagnostica",
  "diagn\xF3stico",
  "verifique o worker",
  "verifique os logs",
  "verifique o runtime",
  "veja os logs",
  "ver os logs",
  "cheque o runtime",
  "inspecione",
  "veja o erro",
  "ver o erro",
  "por que esse endpoint falhou",
  "por que falhou",
  "por que o worker",
  "por que o runtime",
  "verificar o sistema",
  "auditar o sistema",
  "auditoria do sistema",
  "checar o worker",
  "checar os logs",
  "checar o runtime"
];
var _EXECUTION_TERMS = [
  "execute isso",
  "aplique o patch",
  "aplica o patch",
  "rode o fluxo",
  "rode o loop",
  "aplique a corre\xE7\xE3o",
  "aplica a corre\xE7\xE3o",
  "execute o fluxo",
  "fa\xE7a o patch",
  "aplica o fix",
  "aplique o fix"
];
var _DEPLOY_TERMS = [
  "deploya",
  "deploy",
  "deploye",
  "fazer deploy",
  "fa\xE7a o deploy",
  "mande pra produ\xE7\xE3o",
  "manda pra produ\xE7\xE3o",
  "subir pra produ\xE7\xE3o",
  "subir em produ\xE7\xE3o",
  "rollback",
  "roll back",
  "reverter deploy",
  "rodar deploy",
  "executar deploy",
  "executar em prod",
  "push pra produ\xE7\xE3o"
];
var _CONTRACT_ACTION_TERMS = [
  "crie um contrato",
  "criar contrato",
  "monte contrato",
  "monte um contrato",
  "montar contrato",
  "atualize o contrato",
  "atualizar o contrato",
  "revise o contrato",
  "revisar o contrato",
  "feche o contrato",
  "encerre o contrato",
  "volta ao contrato",
  "retorne ao contrato",
  "volte ao contrato",
  "contrato macro",
  "criar macro",
  "montar macro",
  "estado do contrato",
  "contrato ativo"
];
var _SKILL_RUN_TERMS = [
  "rode a skill",
  "rodar a skill",
  "execute a skill",
  "executar a skill",
  "use a skill",
  "usar a skill",
  "acione a skill",
  "acionar a skill",
  "skill contract auditor",
  "skill deploy governance",
  "skill system mapper",
  "skill contract loop",
  "aplicar a skill"
];
var _SKILL_QUESTION_TERMS = [
  "qual skill",
  "quais skills",
  "qual skill devo usar",
  "qual skill usar",
  "qual \xE9 a skill",
  "existe skill",
  "tem skill",
  "tem alguma skill"
];
var _MEMORY_TERMS = [
  "salve isso",
  "salve na mem\xF3ria",
  "guarda isso",
  "guarde isso",
  "guarde na mem\xF3ria",
  "salvar na mem\xF3ria",
  "lembre disso",
  "lembre-se disso",
  "memorize",
  "registre isso",
  "salvar mem\xF3ria",
  "guardar regra",
  "guarde essa regra",
  "lembre dessa regra"
];
var _STRATEGY_TERMS = [
  "qual o melhor caminho",
  "qual \xE9 o melhor caminho",
  "isso vale a pena",
  "vale a pena agora",
  "devemos seguir com isso",
  "devo seguir com isso",
  "o que voc\xEA recomenda",
  "qual sua recomenda\xE7\xE3o",
  "qual seria a melhor abordagem",
  "qual abordagem",
  "faz sentido seguir",
  "faz sentido",
  "\xE9 uma boa ideia",
  "\xE9 boa ideia"
];
function _normalize3(text) {
  if (typeof text !== "string") return "";
  return text.toLowerCase().trim();
}
__name(_normalize3, "_normalize");
function _containsAny2(text, terms) {
  const normalized = _normalize3(text);
  return terms.filter((t) => normalized.includes(t));
}
__name(_containsAny2, "_containsAny");
function _isPRUrl(text) {
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(text);
}
__name(_isPRUrl, "_isPRUrl");
function classifyEnaviaIntent(input) {
  const rawInput = input && typeof input === "object" ? input : {};
  const message = typeof rawInput.message === "string" ? rawInput.message : "";
  if (message.trim().length === 0) {
    return {
      intent: INTENT_TYPES.UNKNOWN,
      confidence: CONFIDENCE_LEVELS.LOW,
      is_operational: false,
      reasons: ["mensagem vazia"],
      signals: []
    };
  }
  const normalized = _normalize3(message);
  const reasons = [];
  const signals = [];
  if (_isPRUrl(message)) {
    signals.push("pr_url_detected");
    reasons.push("URL de pull request GitHub detectada");
    return {
      intent: INTENT_TYPES.PR_REVIEW,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const prReviewMatches = _containsAny2(normalized, _PR_REVIEW_TERMS);
  if (prReviewMatches.length > 0) {
    signals.push(...prReviewMatches.map((t) => `pr_review:${t}`));
    reasons.push(`termos de revis\xE3o de PR detectados: ${prReviewMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.PR_REVIEW,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const deployMatches = _containsAny2(normalized, _DEPLOY_TERMS);
  if (deployMatches.length > 0) {
    signals.push(...deployMatches.map((t) => `deploy:${t}`));
    reasons.push(`termos de deploy/rollback detectados: ${deployMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.DEPLOY_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const executionMatches = _containsAny2(normalized, _EXECUTION_TERMS);
  if (executionMatches.length > 0) {
    signals.push(...executionMatches.map((t) => `execution:${t}`));
    reasons.push(`termos de execu\xE7\xE3o t\xE9cnica detectados: ${executionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.EXECUTION_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const diagMatches = _containsAny2(normalized, _TECHNICAL_DIAGNOSIS_TERMS);
  if (diagMatches.length > 0) {
    signals.push(...diagMatches.map((t) => `diag:${t}`));
    reasons.push(`termos de diagn\xF3stico t\xE9cnico detectados: ${diagMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.TECHNICAL_DIAGNOSIS,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const memoryMatches = _containsAny2(normalized, _MEMORY_TERMS);
  if (memoryMatches.length > 0) {
    signals.push(...memoryMatches.map((t) => `memory:${t}`));
    reasons.push(`termos de mem\xF3ria detectados: ${memoryMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.MEMORY_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const contractActionMatches = _containsAny2(normalized, _CONTRACT_ACTION_TERMS);
  if (contractActionMatches.length > 0) {
    signals.push(...contractActionMatches.map((t) => `contract_action:${t}`));
    reasons.push(`termos de a\xE7\xE3o de contrato detectados: ${contractActionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CONTRACT_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const capabilityMatches = _containsAny2(normalized, _CAPABILITY_TERMS);
  if (capabilityMatches.length > 0) {
    signals.push(...capabilityMatches.map((t) => `capability:${t}`));
    reasons.push(`pergunta de capacidade detectada: ${capabilityMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CAPABILITY_QUESTION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals
    };
  }
  const skillRunMatches = _containsAny2(normalized, _SKILL_RUN_TERMS);
  if (skillRunMatches.length > 0) {
    signals.push(...skillRunMatches.map((t) => `skill_run:${t}`));
    reasons.push(`pedido de execu\xE7\xE3o de skill detectado (Skill Router ainda N\xC3O existe em runtime): ${skillRunMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SKILL_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: true,
      reasons,
      signals
    };
  }
  const skillQuestionMatches = _containsAny2(normalized, _SKILL_QUESTION_TERMS);
  if (skillQuestionMatches.length > 0) {
    signals.push(...skillQuestionMatches.map((t) => `skill_question:${t}`));
    reasons.push(`pergunta sobre skill detectada: ${skillQuestionMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SKILL_REQUEST,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals
    };
  }
  const nextPrMatches = _containsAny2(normalized, _NEXT_PR_TERMS);
  if (nextPrMatches.length > 0) {
    signals.push(...nextPrMatches.map((t) => `next_pr:${t}`));
    reasons.push(`pedido de pr\xF3xima PR detectado: ${nextPrMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.NEXT_PR_REQUEST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals
    };
  }
  const frustrationMatches = _containsAny2(normalized, _FRUSTRATION_TERMS);
  if (frustrationMatches.length > 0) {
    signals.push(...frustrationMatches.map((t) => `frustration:${t}`));
    reasons.push(`frustra\xE7\xE3o ou desconfian\xE7a detectada: ${frustrationMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.FRUSTRATION_OR_TRUST,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals
    };
  }
  const identityMatches = _containsAny2(normalized, _IDENTITY_TERMS);
  if (identityMatches.length > 0) {
    signals.push(...identityMatches.map((t) => `identity:${t}`));
    reasons.push(`pergunta de identidade detectada: ${identityMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.IDENTITY_QUESTION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals
    };
  }
  const systemStateMatches = _containsAny2(normalized, _SYSTEM_STATE_TERMS);
  if (systemStateMatches.length > 0) {
    signals.push(...systemStateMatches.map((t) => `system_state:${t}`));
    reasons.push(`pergunta sobre estado do sistema detectada: ${systemStateMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.SYSTEM_STATE_QUESTION,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals
    };
  }
  const strategyMatches = _containsAny2(normalized, _STRATEGY_TERMS);
  if (strategyMatches.length > 0) {
    signals.push(...strategyMatches.map((t) => `strategy:${t}`));
    reasons.push(`pergunta estrat\xE9gica detectada: ${strategyMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.STRATEGY_QUESTION,
      confidence: CONFIDENCE_LEVELS.MEDIUM,
      is_operational: false,
      reasons,
      signals
    };
  }
  const greetingMatches = _containsAny2(normalized, _GREETING_TERMS);
  if (greetingMatches.length > 0) {
    signals.push(...greetingMatches.map((t) => `greeting:${t}`));
    reasons.push(`cumprimento ou conversa simples detectada: ${greetingMatches.join(", ")}`);
    return {
      intent: INTENT_TYPES.CONVERSATION,
      confidence: CONFIDENCE_LEVELS.HIGH,
      is_operational: false,
      reasons,
      signals
    };
  }
  if (normalized.length <= _SHORT_MESSAGE_THRESHOLD) {
    reasons.push("mensagem curta sem sinais reconhecidos \u2014 classificado como desconhecido para n\xE3o bloquear heur\xEDstica legada");
    signals.push("short_message_no_match");
    return {
      intent: INTENT_TYPES.UNKNOWN,
      confidence: CONFIDENCE_LEVELS.LOW,
      is_operational: false,
      reasons,
      signals
    };
  }
  reasons.push("nenhum sinal reconhecido \u2014 classificado como desconhecido");
  signals.push("no_match");
  return {
    intent: INTENT_TYPES.UNKNOWN,
    confidence: CONFIDENCE_LEVELS.LOW,
    is_operational: false,
    reasons,
    signals
  };
}
__name(classifyEnaviaIntent, "classifyEnaviaIntent");

// schema/enavia-skill-router.js
var SKILL_IDS = {
  CONTRACT_LOOP_OPERATOR: "CONTRACT_LOOP_OPERATOR",
  DEPLOY_GOVERNANCE_OPERATOR: "DEPLOY_GOVERNANCE_OPERATOR",
  SYSTEM_MAPPER: "SYSTEM_MAPPER",
  CONTRACT_AUDITOR: "CONTRACT_AUDITOR"
};
var ROUTER_MODES = {
  READ_ONLY: "read_only"
};
var CONFIDENCE_LEVELS2 = {
  HIGH: "high",
  MEDIUM: "medium",
  LOW: "low"
};
var _WARNING_READ_ONLY = "Skill Router \xE9 read-only. Skills s\xE3o documentais \u2014 apenas refer\xEAncia, sem execu\xE7\xE3o runtime. /skills/run ainda n\xE3o existe. Nenhuma a\xE7\xE3o foi executada.";
var _WARNING_NO_MATCH = "Nenhuma skill documental foi selecionada para esta mensagem. Skill Router \xE9 read-only. /skills/run n\xE3o existe. Nenhuma a\xE7\xE3o foi executada.";
var _SKILL_CATALOG = [
  {
    id: SKILL_IDS.CONTRACT_LOOP_OPERATOR,
    name: "Contract Loop Operator",
    source: "schema/skills/CONTRACT_LOOP_OPERATOR.md",
    description: "Opera\xE7\xE3o do loop contratual supervisionado: pr\xF3xima PR, sequ\xEAncia, manter fluxo PR a PR.",
    triggers: [
      // Nome canônico da skill
      "contract loop operator",
      "contract loop",
      "loop operator",
      // Pedidos de próxima PR / sequência de contrato
      "mande a pr\xF3xima pr",
      "mande a pr\xF3xima",
      "monte a pr\xF3xima pr",
      "monte a pr\xF3xima",
      "manda a pr\xF3xima",
      "mandar a pr\xF3xima",
      "pr\xF3xima pr",
      "proxima pr",
      "next pr",
      "qual a pr\xF3xima pr",
      "qual \xE9 a pr\xF3xima pr",
      "qual a proxima pr",
      "gera a pr\xF3xima",
      "gere a pr\xF3xima",
      "cria a pr\xF3xima pr",
      "gerar a pr\xF3xima pr",
      // Retorno/continuidade ao contrato
      "voltar ao contrato",
      "volta ao contrato",
      "volte ao contrato",
      "retornar ao contrato",
      "retorne ao contrato",
      "seguir contrato",
      "seguir o contrato",
      "seguir o loop",
      "loop do contrato",
      "loop contratual",
      "sequ\xEAncia de prs",
      "sequencia de prs",
      "fluxo do contrato",
      "qual a pr\xF3xima etapa do contrato",
      "qual a proxima etapa do contrato",
      "pr\xF3xima etapa do contrato",
      "proxima etapa do contrato",
      "qual pr\xF3xima etapa",
      "qual proxima etapa",
      "contrato ativo"
    ]
  },
  {
    id: SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR,
    name: "Deploy Governance Operator",
    source: "schema/skills/DEPLOY_GOVERNANCE_OPERATOR.md",
    description: "Governan\xE7a de deploy, rollback e promo\xE7\xE3o PROD/TEST: gates, aprova\xE7\xE3o, produ\xE7\xE3o, staging.",
    triggers: [
      // Nome canônico da skill
      "deploy governance operator",
      "deploy governance",
      // Pedidos de deploy
      "deploy",
      "deploya",
      "deploye",
      "fazer deploy",
      "fa\xE7a o deploy",
      "deploy em test",
      "deploy em prod",
      "deploy em produ\xE7\xE3o",
      "subir pra produ\xE7\xE3o",
      "subir em produ\xE7\xE3o",
      "mande pra produ\xE7\xE3o",
      "manda pra produ\xE7\xE3o",
      "push pra produ\xE7\xE3o",
      "rollback",
      "roll back",
      "reverter deploy",
      "reverter o deploy",
      "promover",
      "promova",
      "promo\xE7\xE3o",
      "promover para produ\xE7\xE3o",
      "promover pra produ\xE7\xE3o",
      "gate de deploy",
      "aprova\xE7\xE3o de produ\xE7\xE3o",
      "aprovar o deploy",
      "aprovar deploy",
      "gate de produ\xE7\xE3o",
      "ambiente de produ\xE7\xE3o",
      "ambiente de test",
      "executar deploy",
      "rodar deploy"
    ]
  },
  {
    id: SKILL_IDS.SYSTEM_MAPPER,
    name: "System Mapper",
    source: "schema/skills/SYSTEM_MAPPER.md",
    description: "Manuten\xE7\xE3o de System Map, Route Registry, Worker Registry, estado t\xE9cnico do sistema.",
    triggers: [
      // Nome canônico da skill
      "system mapper",
      // Termos técnicos de sistema
      "rotas",
      "route registry",
      "worker registry",
      "system map",
      "mapa do sistema",
      "mapa t\xE9cnico",
      "bindings",
      "quais workers",
      "quais s\xE3o os workers",
      "workers existentes",
      "estado t\xE9cnico do sistema",
      "estado t\xE9cnico",
      "estado do sistema t\xE9cnico",
      "verifique o route registry",
      "verificar o route registry",
      "verificar route registry",
      "worker registry",
      "workers do sistema",
      "workers ativos",
      "sistema t\xE9cnico",
      "infraestrutura do sistema",
      "mapeamento do sistema",
      "mapear o sistema",
      "mapear workers",
      "system awareness",
      "kv bindings",
      "kv do sistema"
    ]
  },
  {
    id: SKILL_IDS.CONTRACT_AUDITOR,
    name: "Contract Auditor",
    source: "schema/skills/CONTRACT_AUDITOR.md",
    description: "Auditoria de ader\xEAncia contratual de PRs, tarefas e execu\xE7\xF5es.",
    triggers: [
      // Nome canônico da skill
      "contract auditor",
      "contract audit",
      // Pedidos de revisão/auditoria
      "revise a pr",
      "revisar a pr",
      "revise a pull request",
      "review pr",
      "revisar pull request",
      "analisar a pr",
      "analise a pr",
      "veja essa pr",
      "ver essa pr",
      "veja se essa pr",
      "veja se a pr",
      "audite essa pr",
      "auditar a pr",
      "auditoria da pr",
      "crit\xE9rios de aceite",
      "criterios de aceite",
      "regress\xF5es",
      "regressoes",
      "escopo da pr",
      "escopo do contrato",
      "veja se quebrou",
      "veja se essa pr quebrou",
      "ver se quebrou",
      "verificar se quebrou",
      "pull/",
      "/pull/",
      "github.com/"
    ]
  }
];
function _normalize4(text) {
  if (typeof text !== "string") return "";
  return text.toLowerCase().trim();
}
__name(_normalize4, "_normalize");
function _isPRUrl2(text) {
  return /github\.com\/[^/]+\/[^/]+\/pull\/\d+/.test(text);
}
__name(_isPRUrl2, "_isPRUrl");
function _matchSkill(normalized, skill) {
  const matched = [];
  for (const trigger of skill.triggers) {
    if (normalized.includes(trigger)) {
      matched.push(trigger);
    }
  }
  return { matched: matched.length > 0, matchedTerms: matched };
}
__name(_matchSkill, "_matchSkill");
function _routeByContent(normalized, message) {
  if (_isPRUrl2(message)) {
    const skill = _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_AUDITOR);
    return {
      skill,
      confidence: CONFIDENCE_LEVELS2.HIGH,
      reason: "URL de pull request GitHub detectada \u2014 Contract Auditor \xE9 a skill documental para revis\xE3o de PRs",
      matchedTerms: ["pr_url"]
    };
  }
  for (const skill of _SKILL_CATALOG) {
    const { matched, matchedTerms } = _matchSkill(normalized, skill);
    if (matched) {
      return {
        skill,
        confidence: CONFIDENCE_LEVELS2.HIGH,
        reason: `Termos de roteamento detectados para ${skill.name}: ${matchedTerms.slice(0, 3).join(", ")}`,
        matchedTerms
      };
    }
  }
  return null;
}
__name(_routeByContent, "_routeByContent");
function _routeByIntent(intent, normalized) {
  if (!intent || typeof intent !== "string") return null;
  switch (intent) {
    case "pr_review":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_AUDITOR),
        confidence: CONFIDENCE_LEVELS2.HIGH,
        reason: "Inten\xE7\xE3o pr_review \u2192 Contract Auditor \xE9 a skill documental para revis\xE3o de PRs",
        matchedTerms: [`intent:${intent}`]
      };
    case "deploy_request":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.DEPLOY_GOVERNANCE_OPERATOR),
        confidence: CONFIDENCE_LEVELS2.HIGH,
        reason: "Inten\xE7\xE3o deploy_request \u2192 Deploy Governance Operator \xE9 a skill documental para deploy",
        matchedTerms: [`intent:${intent}`]
      };
    case "system_state_question": {
      const techTerms = [
        "worker",
        "workers",
        "rota",
        "rotas",
        "kv",
        "binding",
        "bindings",
        "sistema",
        "t\xE9cnico",
        "tecnico",
        "infraestrutura",
        "map",
        "registry",
        "worker registry",
        "route registry",
        "system map"
      ];
      const hasTechSignal = techTerms.some((t) => normalized.includes(t));
      if (hasTechSignal) {
        return {
          skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.SYSTEM_MAPPER),
          confidence: CONFIDENCE_LEVELS2.MEDIUM,
          reason: "Inten\xE7\xE3o system_state_question com sinal t\xE9cnico \u2192 System Mapper \xE9 a skill documental para estado do sistema",
          matchedTerms: [`intent:${intent}`]
        };
      }
      return null;
    }
    case "next_pr_request":
    case "contract_request":
      return {
        skill: _SKILL_CATALOG.find((s) => s.id === SKILL_IDS.CONTRACT_LOOP_OPERATOR),
        confidence: CONFIDENCE_LEVELS2.MEDIUM,
        reason: `Inten\xE7\xE3o ${intent} \u2192 Contract Loop Operator \xE9 a skill documental para loop contratual`,
        matchedTerms: [`intent:${intent}`]
      };
    case "skill_request":
      return null;
    default:
      return null;
  }
}
__name(_routeByIntent, "_routeByIntent");
function routeEnaviaSkill(input) {
  const rawInput = input && typeof input === "object" ? input : {};
  const message = typeof rawInput.message === "string" ? rawInput.message : "";
  const intentClassification = rawInput.intentClassification && typeof rawInput.intentClassification === "object" ? rawInput.intentClassification : null;
  const _noMatch = {
    matched: false,
    skill_id: null,
    skill_name: null,
    mode: ROUTER_MODES.READ_ONLY,
    confidence: CONFIDENCE_LEVELS2.LOW,
    reason: "Nenhuma skill documental identificada para esta mensagem",
    sources: [],
    warning: _WARNING_NO_MATCH
  };
  if (message.trim().length === 0) {
    return {
      ..._noMatch,
      reason: "Mensagem vazia \u2014 nenhuma skill pode ser selecionada"
    };
  }
  const normalized = _normalize4(message);
  const contentResult = _routeByContent(normalized, message);
  if (contentResult) {
    return _buildResult(contentResult, message);
  }
  if (intentClassification && intentClassification.intent) {
    const intentResult = _routeByIntent(intentClassification.intent, normalized);
    if (intentResult) {
      if (intentClassification.confidence === CONFIDENCE_LEVELS2.LOW) {
        intentResult.confidence = CONFIDENCE_LEVELS2.LOW;
      } else if (intentResult.confidence === CONFIDENCE_LEVELS2.HIGH && intentClassification.confidence === CONFIDENCE_LEVELS2.MEDIUM) {
        intentResult.confidence = CONFIDENCE_LEVELS2.MEDIUM;
      }
      return _buildResult(intentResult, message);
    }
  }
  return _noMatch;
}
__name(routeEnaviaSkill, "routeEnaviaSkill");
function _buildResult(routeMatch, message) {
  const { skill, confidence, reason } = routeMatch;
  const normalized = _normalize4(message);
  const isExecutionRequest = _isExecutionRequest(normalized);
  const warning = isExecutionRequest ? `A skill ${skill.name} pode ser usada como refer\xEAncia documental. Execu\xE7\xE3o runtime de skill ainda n\xE3o existe. /skills/run ainda n\xE3o existe. Nenhuma a\xE7\xE3o foi executada.` : _WARNING_READ_ONLY;
  return {
    matched: true,
    skill_id: skill.id,
    skill_name: skill.name,
    mode: ROUTER_MODES.READ_ONLY,
    confidence,
    reason,
    sources: [skill.source],
    warning
  };
}
__name(_buildResult, "_buildResult");
var _EXECUTION_REQUEST_TERMS = [
  "rode a skill",
  "rodar a skill",
  "execute a skill",
  "executar a skill",
  "use a skill",
  "usar a skill",
  "acione a skill",
  "acionar a skill",
  "aplicar a skill",
  "aplique a skill"
];
function _isExecutionRequest(normalized) {
  return _EXECUTION_REQUEST_TERMS.some((t) => normalized.includes(t));
}
__name(_isExecutionRequest, "_isExecutionRequest");

// schema/enavia-intent-retrieval.js
var RETRIEVAL_MODE = {
  READ_ONLY: "read_only"
};
var DEFAULT_MAX_CHARS = 2e3;
var TRUNCATION_MARKER = "[intent-retrieval-truncated]";
var _SKILL_CONTEXT_BLOCKS = {
  CONTRACT_LOOP_OPERATOR: [
    "Contexto \u2014 CONTRACT_LOOP_OPERATOR (Loop Contratual Supervisionado):",
    "\u2022 Siga o contrato ativo sem desviar. Entregue a pr\xF3xima PR conforme a sequ\xEAncia do contrato.",
    "\u2022 Mantenha o loop PR a PR: diagn\xF3stico \u2192 implementa\xE7\xE3o \u2192 prova \u2192 governan\xE7a.",
    "\u2022 Para pedido de pr\xF3xima PR: resposta curta \u2014 objetivo breve + escopo + prompt completo para execu\xE7\xE3o.",
    "\u2022 Se surgir exce\xE7\xE3o corretiva, corrija, prove e retorne ao contrato \u2014 n\xE3o abra frente paralela.",
    "\u2022 N\xE3o avance sem evid\xEAncia real. N\xE3o misture escopos de PR distintas.",
    "\u2022 Pr\xF3xima PR deve ser identificada no contrato ativo antes de iniciar.",
    "\u2022 N\xE3o reabra discuss\xE3o sobre PRs j\xE1 conclu\xEDdas."
  ].join("\n"),
  DEPLOY_GOVERNANCE_OPERATOR: [
    "Contexto \u2014 DEPLOY_GOVERNANCE_OPERATOR (Governan\xE7a de Deploy):",
    "\u2022 Deploy exige gate/aprova\xE7\xE3o documentada. Diferencie sempre test vs. prod.",
    "\u2022 Rollback deve estar documentado antes do deploy. N\xE3o altere produ\xE7\xE3o sem autoriza\xE7\xE3o expl\xEDcita.",
    "\u2022 N\xE3o crie deploy autom\xE1tico nesta etapa. Gates de produ\xE7\xE3o s\xE3o obrigat\xF3rios.",
    "\u2022 Qualquer promo\xE7\xE3o para prod requer aprova\xE7\xE3o humana e evid\xEAncia de smoke test em test.",
    "\u2022 Nunca fa\xE7a deploy sem contrato ativo e aprova\xE7\xE3o registrada."
  ].join("\n"),
  SYSTEM_MAPPER: [
    "Contexto \u2014 SYSTEM_MAPPER (Mapeador de Sistema):",
    "\u2022 Consulte o mapa/registries antes de afirmar qualquer capacidade do sistema.",
    "\u2022 Diferencie sistema documentado vs. runtime real \u2014 n\xE3o s\xE3o iguais.",
    "\u2022 N\xE3o invente worker, rota, binding ou endpoint. Se n\xE3o houver fonte, marque incerteza.",
    "\u2022 Use System Awareness e Brain Map como refer\xEAncia. Se n\xE3o tiver certeza, admita.",
    "\u2022 N\xE3o afirme que /skills/run existe \u2014 n\xE3o existe. Skill Router \xE9 read-only."
  ].join("\n"),
  CONTRACT_AUDITOR: [
    "Contexto \u2014 CONTRACT_AUDITOR (Auditor de Contrato):",
    "\u2022 Revise a PR contra o contrato ativo: verifique escopo, arquivos alterados, regress\xF5es.",
    "\u2022 Cheque se houve altera\xE7\xE3o proibida pelo contrato (Panel, Executor, workflows, wrangler, etc.).",
    "\u2022 N\xE3o assuma sucesso sem evid\xEAncia real (testes passando, relat\xF3rio existente).",
    "\u2022 Decida merge/corre\xE7\xE3o somente ap\xF3s inspe\xE7\xE3o factual \u2014 n\xE3o por inten\xE7\xE3o declarada.",
    "\u2022 Verifique se governan\xE7a foi atualizada (STATUS, HANDOFF, EXECUTION_LOG, INDEX.md)."
  ].join("\n")
};
var _INTENT_CONTEXT_BLOCKS = {
  frustration_or_trust_issue: [
    "Contexto \u2014 Frustra\xE7\xE3o ou quest\xE3o de confian\xE7a:",
    "\u2022 Responda com sinceridade e reconhe\xE7a o risco real de excesso documental.",
    "\u2022 Puxe a execu\xE7\xE3o concreta: mostre o que j\xE1 funciona, n\xE3o apenas o que foi documentado.",
    "\u2022 Isso \xE9 opcional. N\xE3o mexa agora. Se houver contrato ativo, priorize a pr\xF3xima PR.",
    "\u2022 Admita incerteza quando houver. N\xE3o prometa o que ainda n\xE3o existe."
  ].join("\n"),
  next_pr_request: [
    "Contexto \u2014 Pedido de pr\xF3xima PR:",
    "\u2022 Resposta curta. Identifique a pr\xF3xima PR autorizada pelo contrato ativo.",
    "\u2022 Forne\xE7a objetivo breve, escopo e prompt completo para execu\xE7\xE3o.",
    "\u2022 N\xE3o reabra discuss\xE3o \u2014 entregue a PR conforme o contrato."
  ].join("\n"),
  capability_question: [
    "Contexto \u2014 Pergunta sobre capacidade:",
    "\u2022 Diferencie capacidade atual (o que existe agora) vs. capacidade futura (o que ainda n\xE3o existe).",
    "\u2022 N\xE3o finja runtime inexistente. /skills/run n\xE3o existe. Skill Executor n\xE3o existe.",
    "\u2022 Consulte System Awareness e Brain Map para confirmar o que est\xE1 dispon\xEDvel.",
    "\u2022 Marque incerteza quando n\xE3o houver fonte documental confirmando a capacidade."
  ].join("\n"),
  system_state_question: [
    "Contexto \u2014 Pergunta sobre estado do sistema:",
    "\u2022 Diferencie estado documentado vs. estado runtime real.",
    "\u2022 Consulte Brain Map e System Awareness antes de responder.",
    "\u2022 N\xE3o invente workers, bindings ou rotas que n\xE3o est\xE3o mapeados.",
    "\u2022 Admita incerteza quando o estado real n\xE3o puder ser verificado sem rede/KV."
  ].join("\n"),
  strategy_question: [
    "Contexto \u2014 Pergunta estrat\xE9gica:",
    "\u2022 Resposta estrat\xE9gica curta. Pondere custo, tempo e risco antes de recomendar.",
    "\u2022 Sinalize opcionalidade quando aplic\xE1vel: o que \xE9 urgente vs. o que pode esperar.",
    "\u2022 Se houver contrato ativo, puxe a execu\xE7\xE3o para o pr\xF3ximo passo concreto do contrato.",
    "\u2022 N\xE3o misture estrat\xE9gia com execu\xE7\xE3o \u2014 diferencie o que planejar do que fazer agora."
  ].join("\n")
};
var _INTENT_TO_SKILL = {
  next_pr_request: "CONTRACT_LOOP_OPERATOR",
  contract_request: "CONTRACT_LOOP_OPERATOR",
  pr_review: "CONTRACT_AUDITOR",
  deploy_request: "DEPLOY_GOVERNANCE_OPERATOR",
  system_state_question: "SYSTEM_MAPPER",
  capability_question: "SYSTEM_MAPPER"
  // execution_request e skill_request: deixa para o Skill Router decidir
};
function _truncate(text, maxChars) {
  if (text.length <= maxChars) {
    return { text, truncated: false };
  }
  const markerLen = TRUNCATION_MARKER.length + 1;
  const available = maxChars - markerLen;
  const cut = available > 0 ? text.slice(0, available) : "";
  return { text: cut + "\n" + TRUNCATION_MARKER, truncated: true };
}
__name(_truncate, "_truncate");
function _extractSkillId(skillRouting) {
  if (!skillRouting || typeof skillRouting !== "object") return null;
  const id = skillRouting.skill_id;
  if (typeof id === "string" && id.length > 0) return id;
  return null;
}
__name(_extractSkillId, "_extractSkillId");
function _extractIntent(intentClassification) {
  if (!intentClassification || typeof intentClassification !== "object") return null;
  const intent = intentClassification.intent;
  if (typeof intent === "string" && intent.length > 0) return intent;
  return null;
}
__name(_extractIntent, "_extractIntent");
function buildIntentRetrievalContext(input) {
  if (!input || typeof input !== "object") {
    return _emptyResult();
  }
  const maxChars = typeof input._max_chars === "number" && input._max_chars > 0 ? input._max_chars : DEFAULT_MAX_CHARS;
  const warnings = [];
  let skillId = _extractSkillId(input.skillRouting);
  const intent = _extractIntent(input.intentClassification);
  if (!skillId && intent && _INTENT_TO_SKILL[intent]) {
    skillId = _INTENT_TO_SKILL[intent];
  }
  const sources = [];
  let rawBlock = "";
  if (skillId && _SKILL_CONTEXT_BLOCKS[skillId]) {
    rawBlock = _SKILL_CONTEXT_BLOCKS[skillId];
    sources.push(`schema/skills/${skillId}.md`);
    sources.push("schema/brain/RETRIEVAL_POLICY.md");
    sources.push("schema/brain/maps/skill-map.md");
  } else if (intent && _INTENT_CONTEXT_BLOCKS[intent]) {
    rawBlock = _INTENT_CONTEXT_BLOCKS[intent];
    sources.push("schema/brain/RETRIEVAL_POLICY.md");
  } else {
    return _noMatchResult(maxChars);
  }
  const { text: finalBlock, truncated } = _truncate(rawBlock, maxChars);
  if (truncated) {
    warnings.push("context_block foi truncado para respeitar max_chars.");
  }
  warnings.push(
    "Intent Retrieval \xE9 read-only. N\xE3o executa skill. N\xE3o cria endpoint. /skills/run n\xE3o existe. Nenhuma a\xE7\xE3o foi executada."
  );
  return {
    applied: true,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: intent || null,
    skill_id: skillId || null,
    sources,
    context_block: finalBlock,
    warnings,
    token_budget_hint: {
      max_chars: maxChars,
      actual_chars: finalBlock.length,
      truncated
    }
  };
}
__name(buildIntentRetrievalContext, "buildIntentRetrievalContext");
function _emptyResult() {
  return {
    applied: false,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: null,
    skill_id: null,
    sources: [],
    context_block: "",
    warnings: ["Intent Retrieval recebeu entrada inv\xE1lida."],
    token_budget_hint: {
      max_chars: DEFAULT_MAX_CHARS,
      actual_chars: 0,
      truncated: false
    }
  };
}
__name(_emptyResult, "_emptyResult");
function _noMatchResult(maxChars) {
  return {
    applied: false,
    mode: RETRIEVAL_MODE.READ_ONLY,
    intent: null,
    skill_id: null,
    sources: [],
    context_block: "",
    warnings: [
      "Nenhuma fonte documental aplic\xE1vel para esta mensagem. Intent Retrieval \xE9 read-only. N\xE3o executa skill."
    ],
    token_budget_hint: {
      max_chars: maxChars,
      actual_chars: 0,
      truncated: false
    }
  };
}
__name(_noMatchResult, "_noMatchResult");

// schema/enavia-self-audit.js
var SELF_AUDIT_RISK_LEVELS = {
  NONE: "none",
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  BLOCKING: "blocking"
};
var SELF_AUDIT_CATEGORIES = {
  FALSE_CAPABILITY: "false_capability",
  FAKE_EXECUTION: "fake_execution",
  UNAUTHORIZED_ACTION: "unauthorized_action",
  WRONG_MODE: "wrong_mode",
  DOCS_OVER_PRODUCT: "docs_over_product",
  MISSING_SOURCE: "missing_source",
  CONTRACT_DRIFT: "contract_drift",
  SCOPE_VIOLATION: "scope_violation",
  SECRET_EXPOSURE: "secret_exposure",
  RUNTIME_VS_DOCUMENTATION_CONFUSION: "runtime_vs_documentation_confusion"
};
var _FAKE_EXECUTION_TERMS = [
  "executei a skill",
  "rodei a skill",
  "skill executada",
  "skill foi executada",
  "/skills/run",
  "executei o contrato",
  "rodei os testes",
  "rodei os smoke",
  "deploy feito",
  "deploy realizado",
  "deploy em produ\xE7\xE3o feito",
  "mem\xF3ria salva",
  "escrevi na mem\xF3ria",
  "mem\xF3ria foi salva",
  "endpoint criado",
  "rota criada",
  "j\xE1 executei",
  "j\xE1 rodei",
  "j\xE1 fiz o deploy",
  "commit realizado",
  "push realizado",
  "j\xE1 foi commitado",
  "foi mergeado automaticamente"
];
var _FALSE_CAPABILITY_TERMS = [
  "skill executor",
  "executor de skill",
  "self-audit executor",
  "self-audit executa corre\xE7\xF5es",
  "self-audit bloqueia automaticamente",
  "self-audit altera resposta",
  "/skills/run",
  "skills/run existe",
  "endpoint /skills/run",
  "rota /skills/run"
];
var _UNAUTHORIZED_ACTION_TERMS = [
  "deploy em produ\xE7\xE3o",
  "deployar em produ\xE7\xE3o",
  "manda pra produ\xE7\xE3o",
  "manda para produ\xE7\xE3o",
  "jogar em produ\xE7\xE3o",
  "subir em produ\xE7\xE3o",
  "subir pra produ\xE7\xE3o",
  "subir para produ\xE7\xE3o",
  "publicar em produ\xE7\xE3o",
  "publicar para produ\xE7\xE3o",
  "fazer rollback",
  "rollback de produ\xE7\xE3o",
  "alterar kv",
  "escrever no kv",
  "criar binding",
  "alterar binding",
  "criar endpoint",
  "criar rota",
  "novo endpoint",
  "nova rota",
  "criar /",
  "criar secret",
  "alterar secret",
  "alterar wrangler",
  "modificar wrangler.toml"
];
var _DOCS_OVER_PRODUCT_TERMS = [
  "s\xF3 documento",
  "s\xF3 documenta\xE7\xE3o",
  "cad\xEA o produto",
  "cad\xEA produto",
  "muita documenta\xE7\xE3o",
  "produto parado",
  "tudo documento",
  "s\xF3 docs",
  "virando s\xF3 documento",
  "virou s\xF3 documento",
  "mais um documento",
  "mais documenta\xE7\xE3o",
  "quando vai ter produto",
  "quando vai funcionar de verdade"
];
var _RUNTIME_DOC_CONFUSION_TERMS = [
  "self-audit j\xE1 executa",
  "self-audit j\xE1 funciona",
  "self-audit est\xE1 ativo",
  "self-audit bloqueia",
  "self-audit corrige",
  "skill router executa",
  "skill router j\xE1 executa",
  "brain executa",
  "brain j\xE1 executa",
  "brain loader executa",
  "intent retrieval escreve",
  "memory brain escreve",
  "/skills/run funciona",
  "/skills/run est\xE1 ativo",
  "skills j\xE1 executam"
];
var _SECRET_PATTERNS = [
  /\bsk-[A-Za-z0-9\-_]{20,}\b/i,
  // OpenAI API key
  /\bbearer\s+[A-Za-z0-9\-_\.]{20,}\b/i,
  // Bearer token
  /\bapi[-_]?key\s*[:=]\s*[A-Za-z0-9\-_]{16,}\b/i,
  // API key assignment
  /\btoken\s*[:=]\s*[A-Za-z0-9\-_\.]{20,}\b/i,
  // Token assignment
  /\bsecret\s*[:=]\s*[A-Za-z0-9\-_\.]{16,}\b/i,
  // Secret assignment
  /\bprivate[-_]?key\s*[:=]/i,
  // Private key
  /\bghp_[A-Za-z0-9]{36,}\b/,
  // GitHub personal token
  /\bxoxb-[A-Za-z0-9\-]{24,}\b/,
  // Slack bot token
  /\bAIza[A-Za-z0-9\-_]{35,}\b/,
  // Google API key
  /[A-Za-z0-9+/]{40,}={0,2}/
  // Long base64 blob (possível segredo)
];
var _PROHIBITED_FILES_BY_PR_TYPE = {
  "PR-DOCS": [
    "nv-enavia.js",
    "enavia-cognitive-runtime.js",
    "enavia-llm-core.js",
    "enavia-brain-loader.js",
    "enavia-intent-classifier.js",
    "enavia-skill-router.js",
    "enavia-intent-retrieval.js",
    "wrangler.toml",
    "wrangler.executor.template.toml"
  ],
  "PR-DIAG": [
    "nv-enavia.js",
    "enavia-cognitive-runtime.js",
    "enavia-llm-core.js",
    "enavia-brain-loader.js",
    "wrangler.toml",
    "wrangler.executor.template.toml"
  ],
  "PR-PROVA": [
    "enavia-cognitive-runtime.js",
    "enavia-llm-core.js",
    "enavia-brain-loader.js",
    "wrangler.toml",
    "wrangler.executor.template.toml"
  ]
};
var _ALWAYS_PROHIBITED_FILES = [
  "wrangler.toml",
  "wrangler.executor.template.toml"
];
var _PANEL_FILES_PATTERN = /^panel\//;
var _EXECUTOR_FILES_PATTERN = /^executor\//;
var _WORKFLOW_FILES_PATTERN = /^\.github\/workflows\//;
function _toLower(val) {
  if (typeof val === "string") return val.toLowerCase();
  return "";
}
__name(_toLower, "_toLower");
function _stringify(val) {
  if (val === null || val === void 0) return "";
  if (typeof val === "string") return val;
  try {
    return JSON.stringify(val);
  } catch (_) {
    return String(val);
  }
}
__name(_stringify, "_stringify");
function _containsAny3(haystack, needles) {
  const h = _toLower(haystack);
  for (const needle of needles) {
    if (h.includes(_toLower(needle))) return needle;
  }
  return null;
}
__name(_containsAny3, "_containsAny");
function _matchesAnyPattern(text, patterns) {
  const t = _stringify(text);
  for (const re of patterns) {
    if (re.test(t)) return re.toString();
  }
  return null;
}
__name(_matchesAnyPattern, "_matchesAnyPattern");
function _findingId(counter) {
  return `SA-${String(counter).padStart(3, "0")}`;
}
__name(_findingId, "_findingId");
function _riskOrder(level) {
  const order = {
    [SELF_AUDIT_RISK_LEVELS.NONE]: 0,
    [SELF_AUDIT_RISK_LEVELS.LOW]: 1,
    [SELF_AUDIT_RISK_LEVELS.MEDIUM]: 2,
    [SELF_AUDIT_RISK_LEVELS.HIGH]: 3,
    [SELF_AUDIT_RISK_LEVELS.BLOCKING]: 4
  };
  return order[level] ?? 0;
}
__name(_riskOrder, "_riskOrder");
function _maxRisk(a, b) {
  return _riskOrder(a) >= _riskOrder(b) ? a : b;
}
__name(_maxRisk, "_maxRisk");
function _detectSecretExposure(input, findings, counter) {
  const toCheck = [
    _stringify(input.message),
    _stringify(input.responseDraft),
    _stringify(input.metadata)
  ].join(" ");
  const match = _matchesAnyPattern(toCheck, _SECRET_PATTERNS);
  if (!match) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.SECRET_EXPOSURE,
    severity: SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message: "Poss\xEDvel segredo, token ou API key detectado no conte\xFAdo auditado.",
    evidence: "Padr\xE3o de segredo encontrado (redactado para seguran\xE7a). Verifique responseDraft e metadata.",
    recommendation: "Remover imediatamente qualquer API key, token, secret ou dado sens\xEDvel da resposta. Nunca incluir segredos em respostas ou c\xF3digo."
  });
  return counter;
}
__name(_detectSecretExposure, "_detectSecretExposure");
function _detectFakeExecution(input, findings, counter) {
  const toCheck = _stringify(input.responseDraft);
  const term = _containsAny3(toCheck, _FAKE_EXECUTION_TERMS);
  if (!term) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.FAKE_EXECUTION,
    severity: SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message: "A resposta afirma execu\xE7\xE3o real sem evid\xEAncia verific\xE1vel.",
    evidence: `Termo detectado: "${term}". Sem commit hash, log de execu\xE7\xE3o, resultado de teste ou evid\xEAncia equivalente.`,
    recommendation: "Remover afirma\xE7\xE3o de execu\xE7\xE3o. Apresentar evid\xEAncia real (commit, log, ID de deploy) ou usar linguagem condicional."
  });
  return counter;
}
__name(_detectFakeExecution, "_detectFakeExecution");
function _detectFalseCapability(input, findings, counter) {
  const toCheck = [
    _stringify(input.responseDraft),
    _stringify(input.message)
  ].join(" ");
  const term = _containsAny3(toCheck, _FALSE_CAPABILITY_TERMS);
  if (!term) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.FALSE_CAPABILITY,
    severity: SELF_AUDIT_RISK_LEVELS.HIGH,
    message: "A resposta afirma capacidade que o sistema n\xE3o possui ou n\xE3o executou.",
    evidence: `Termo detectado: "${term}". /skills/run n\xE3o existe. Skill Router, Self-Audit, Brain Loader e Intent Retrieval s\xE3o read-only documentais nesta fase.`,
    recommendation: "Corrigir afirma\xE7\xE3o. Marcar claramente: 'documental (n\xE3o executa)', 'read-only', ou 'planejado para PR futura'. Nunca afirmar execu\xE7\xE3o sem evid\xEAncia."
  });
  return counter;
}
__name(_detectFalseCapability, "_detectFalseCapability");
function _detectUnauthorizedAction(input, findings, counter) {
  const toCheck = [
    _stringify(input.message),
    _stringify(input.responseDraft)
  ].join(" ");
  const term = _containsAny3(toCheck, _UNAUTHORIZED_ACTION_TERMS);
  if (!term) return counter;
  const ctx = input.context || {};
  const hasExplicitApproval = ctx.human_approved === true || ctx.approval_confirmed === true;
  if (hasExplicitApproval) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.UNAUTHORIZED_ACTION,
    severity: SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message: "Pedido ou declara\xE7\xE3o de a\xE7\xE3o n\xE3o autorizada detectado.",
    evidence: `Termo detectado: "${term}". Nenhuma aprova\xE7\xE3o humana expl\xEDcita encontrada no contexto.`,
    recommendation: "Parar. Exigir aprova\xE7\xE3o humana expl\xEDcita antes de qualquer deploy, rollback, escrita em KV ou cria\xE7\xE3o de endpoint. Consultar contrato ativo."
  });
  return counter;
}
__name(_detectUnauthorizedAction, "_detectUnauthorizedAction");
function _detectWrongMode(input, findings, counter) {
  const intent = input.intentClassification?.intent || "";
  const isOperational = input.isOperationalContext === true;
  const frustrationIntents = [
    "frustration_or_trust_issue",
    "frustration",
    "trust_issue"
  ];
  const isFrustration = frustrationIntents.some((f) => intent.includes(f));
  if (isFrustration && isOperational) {
    findings.push({
      id: _findingId(counter++),
      category: SELF_AUDIT_CATEGORIES.WRONG_MODE,
      severity: SELF_AUDIT_RISK_LEVELS.MEDIUM,
      message: "Inten\xE7\xE3o de frustra\xE7\xE3o/confian\xE7a ativou contexto operacional pesado.",
      evidence: `intent="${intent}", isOperationalContext=true. Frustra\xE7\xE3o n\xE3o deveria ativar modo operacional \u2014 \xE9 sinal emocional, n\xE3o pedido de execu\xE7\xE3o.`,
      recommendation: "Reclassificar como conversa. Responder com empatia e clareza. N\xE3o propor pr\xF3xima PR ou executar a\xE7\xE3o baseado em frustra\xE7\xE3o."
    });
    return counter;
  }
  const conversationalIntents = ["conversation", "small_talk", "greeting", "chitchat"];
  const isConversational = conversationalIntents.some((f) => intent.includes(f));
  if (isConversational && isOperational) {
    findings.push({
      id: _findingId(counter++),
      category: SELF_AUDIT_CATEGORIES.WRONG_MODE,
      severity: SELF_AUDIT_RISK_LEVELS.LOW,
      message: "Inten\xE7\xE3o conversacional com contexto operacional ativo.",
      evidence: `intent="${intent}", isOperationalContext=true. Mensagens conversacionais n\xE3o precisam de modo operacional pesado.`,
      recommendation: "Verificar se target default est\xE1 ativando modo operacional desnecessariamente. Responder de forma natural e conversacional."
    });
  }
  return counter;
}
__name(_detectWrongMode, "_detectWrongMode");
function _detectDocsOverProduct(input, findings, counter) {
  const message = _stringify(input.message);
  const term = _containsAny3(message, _DOCS_OVER_PRODUCT_TERMS);
  if (!term) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.DOCS_OVER_PRODUCT,
    severity: SELF_AUDIT_RISK_LEVELS.MEDIUM,
    message: "Usu\xE1rio sinaliza excesso documental em rela\xE7\xE3o a produto funcional.",
    evidence: `Termo detectado na mensagem: "${term}". Sinal de frustra\xE7\xE3o com ritmo documental vs. ritmo de produto.`,
    recommendation: "Priorizar PR-IMPL concreta antes de nova PR-DOCS. Verificar se h\xE1 produto entreg\xE1vel antes de nova documenta\xE7\xE3o."
  });
  return counter;
}
__name(_detectDocsOverProduct, "_detectDocsOverProduct");
function _detectMissingSource(input, findings, counter) {
  const draft = _stringify(input.responseDraft);
  if (!draft) return counter;
  const statePatterns = [
    /o worker\s+[\w-]+\s+já está (ativo|funcionando|online|em produção)/i,
    /o sistema (está|fica|roda) em produção/i,
    /o endpoint (está|fica|responde|existe)/i,
    /o deploy (está|foi|ficou) (completo|ativo|rodando)/i,
    /a rota (está|existe|responde)/i,
    /o binding (está|existe|está configurado)/i,
    /o worker (está|existe|responde|roda)/i
  ];
  const hasMeta = input.metadata && typeof input.metadata === "object" && Object.keys(input.metadata).length > 0;
  let found = false;
  for (const re of statePatterns) {
    if (re.test(draft)) {
      found = true;
      break;
    }
  }
  if (!found) return counter;
  const severity = hasMeta ? SELF_AUDIT_RISK_LEVELS.LOW : SELF_AUDIT_RISK_LEVELS.MEDIUM;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.MISSING_SOURCE,
    severity,
    message: "Resposta afirma estado do sistema sem fonte verific\xE1vel.",
    evidence: "Afirma\xE7\xE3o sobre estado de worker, endpoint, deploy ou binding sem metadado de confirma\xE7\xE3o no input.",
    recommendation: "Citar fonte verific\xE1vel (status, logs, handoff, commit). Se n\xE3o h\xE1 fonte, usar linguagem de incerteza: 'baseado em X', 'conforme \xFAltimo status'."
  });
  return counter;
}
__name(_detectMissingSource, "_detectMissingSource");
function _detectContractDrift(input, findings, counter) {
  const meta = input.metadata || {};
  const proofFailed = meta.proof_failed === true;
  const advancingToNext = meta.advancing_to_next_phase === true;
  if (proofFailed && advancingToNext) {
    findings.push({
      id: _findingId(counter++),
      category: SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity: SELF_AUDIT_RISK_LEVELS.BLOCKING,
      message: "Tentativa de avan\xE7ar para pr\xF3xima fase com prova falhada.",
      evidence: "metadata.proof_failed=true e metadata.advancing_to_next_phase=true simultaneamente. Contrato exige prova aprovada antes de avan\xE7ar.",
      recommendation: "Parar. Corrigir falha da prova antes de avan\xE7ar para pr\xF3xima PR ou fase. N\xE3o registrar PR-PROVA como \u2705 com teste falhando."
    });
    return counter;
  }
  if (proofFailed) {
    findings.push({
      id: _findingId(counter++),
      category: SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity: SELF_AUDIT_RISK_LEVELS.HIGH,
      message: "Prova falhada detectada nos metadados.",
      evidence: "metadata.proof_failed=true. Verificar se tentativa de avan\xE7o est\xE1 sendo feita.",
      recommendation: "Corrigir falha antes de avan\xE7ar. Documentar a falha com evid\xEAncia real."
    });
    return counter;
  }
  const suggestedPR = meta.suggested_next_pr;
  const contractPR = meta.contract_next_pr;
  if (suggestedPR && contractPR && suggestedPR !== contractPR) {
    findings.push({
      id: _findingId(counter++),
      category: SELF_AUDIT_CATEGORIES.CONTRACT_DRIFT,
      severity: SELF_AUDIT_RISK_LEVELS.HIGH,
      message: "PR sugerida diverge do contrato ativo.",
      evidence: `suggested_next_pr="${suggestedPR}" mas contract_next_pr="${contractPR}" conforme schema/contracts/INDEX.md.`,
      recommendation: "Consultar schema/contracts/INDEX.md antes de propor pr\xF3xima PR. A PR sugerida deve bater com o contrato ativo."
    });
  }
  return counter;
}
__name(_detectContractDrift, "_detectContractDrift");
function _detectScopeViolation(input, findings, counter) {
  const meta = input.metadata || {};
  const prType = typeof meta.pr_type === "string" ? meta.pr_type.toUpperCase() : null;
  const filesChanged = Array.isArray(meta.files_changed) ? meta.files_changed : [];
  if (!prType || filesChanged.length === 0) return counter;
  const violations = [];
  for (const f of filesChanged) {
    for (const prohibited2 of _ALWAYS_PROHIBITED_FILES) {
      if (_toLower(f).includes(_toLower(prohibited2))) {
        violations.push(`${f} (sempre proibido sem escopo expl\xEDcito)`);
      }
    }
    if (_PANEL_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Panel)`);
    if (_EXECUTOR_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Executor)`);
    if (_WORKFLOW_FILES_PATTERN.test(f)) violations.push(`${f} (arquivo de Workflow GitHub Actions)`);
  }
  const prohibited = _PROHIBITED_FILES_BY_PR_TYPE[prType] || [];
  for (const f of filesChanged) {
    const fBase = f.split("/").pop();
    for (const p of prohibited) {
      if (_toLower(fBase) === _toLower(p) || _toLower(f).endsWith(_toLower(p))) {
        if (!violations.includes(`${f} (proibido para ${prType})`)) {
          violations.push(`${f} (proibido para ${prType})`);
        }
      }
    }
  }
  if (violations.length === 0) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.SCOPE_VIOLATION,
    severity: SELF_AUDIT_RISK_LEVELS.BLOCKING,
    message: `Viola\xE7\xE3o de escopo: arquivos fora do escopo da ${prType} detectados.`,
    evidence: `Arquivos violadores: ${violations.join(", ")}.`,
    recommendation: "Reverter altera\xE7\xF5es fora do escopo declarado. Verificar `git diff --name-only` antes de commitar. Consultar contrato ativo para confirmar escopo."
  });
  return counter;
}
__name(_detectScopeViolation, "_detectScopeViolation");
function _detectRuntimeVsDocumentationConfusion(input, findings, counter) {
  const toCheck = _stringify(input.responseDraft);
  const term = _containsAny3(toCheck, _RUNTIME_DOC_CONFUSION_TERMS);
  if (!term) return counter;
  findings.push({
    id: _findingId(counter++),
    category: SELF_AUDIT_CATEGORIES.RUNTIME_VS_DOCUMENTATION_CONFUSION,
    severity: SELF_AUDIT_RISK_LEVELS.MEDIUM,
    message: "Resposta confunde componente documental com runtime real.",
    evidence: `Termo detectado: "${term}". Self-Audit (PR56), Skill Router, Brain Loader e Intent Retrieval s\xE3o read-only documentais \u2014 n\xE3o executam a\xE7\xF5es reais nesta fase.`,
    recommendation: "Deixar claro na resposta: 'documental (n\xE3o executa)', 'read-only', 'planejado para PR futura'. Evitar afirmar que componente documental realiza a\xE7\xE3o real."
  });
  return counter;
}
__name(_detectRuntimeVsDocumentationConfusion, "_detectRuntimeVsDocumentationConfusion");
function runEnaviaSelfAudit(input) {
  if (!input || typeof input !== "object") {
    input = {};
  }
  const findings = [];
  let counter = 1;
  counter = _detectSecretExposure(input, findings, counter);
  counter = _detectFakeExecution(input, findings, counter);
  counter = _detectUnauthorizedAction(input, findings, counter);
  counter = _detectScopeViolation(input, findings, counter);
  counter = _detectContractDrift(input, findings, counter);
  counter = _detectFalseCapability(input, findings, counter);
  counter = _detectRuntimeVsDocumentationConfusion(input, findings, counter);
  counter = _detectWrongMode(input, findings, counter);
  counter = _detectMissingSource(input, findings, counter);
  counter = _detectDocsOverProduct(input, findings, counter);
  let risk_level = SELF_AUDIT_RISK_LEVELS.NONE;
  const warnings = [];
  for (const f of findings) {
    risk_level = _maxRisk(risk_level, f.severity);
    if (f.severity === SELF_AUDIT_RISK_LEVELS.LOW || f.severity === SELF_AUDIT_RISK_LEVELS.MEDIUM) {
      warnings.push(`[${f.category}] ${f.message}`);
    }
  }
  const should_block = risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING;
  let next_safe_action;
  if (risk_level === SELF_AUDIT_RISK_LEVELS.BLOCKING) {
    next_safe_action = "Parar. Resolver bloqueio antes de prosseguir. Ver findings para evid\xEAncia e recomenda\xE7\xE3o.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.HIGH) {
    next_safe_action = "Revisar findings de alto risco antes de prosseguir. Corrigir afirma\xE7\xF5es indevidas.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.MEDIUM) {
    next_safe_action = "Verificar alertas. Prosseguir com aten\xE7\xE3o \xE0s recomenda\xE7\xF5es dos findings.";
  } else if (risk_level === SELF_AUDIT_RISK_LEVELS.LOW) {
    next_safe_action = "Observa\xE7\xF5es leves. Prosseguir normalmente com aten\xE7\xE3o \xE0s boas pr\xE1ticas.";
  } else {
    next_safe_action = "Resposta segura. Prosseguir normalmente.";
  }
  return {
    self_audit: {
      applied: true,
      mode: "read_only",
      risk_level,
      findings,
      should_block,
      warnings,
      next_safe_action
    }
  };
}
__name(runEnaviaSelfAudit, "runEnaviaSelfAudit");

// schema/enavia-skill-executor.js
var SKILL_EXECUTION_MODE = "proposal";
var SKILL_EXECUTION_STATUS = {
  PROPOSED: "proposed",
  NOT_APPLICABLE: "not_applicable",
  BLOCKED: "blocked"
};
var SKILL_EXECUTION_ALLOWLIST = /* @__PURE__ */ new Set([
  "CONTRACT_LOOP_OPERATOR",
  "CONTRACT_AUDITOR",
  "DEPLOY_GOVERNANCE_OPERATOR",
  "SYSTEM_MAPPER"
]);
function _asObject(value) {
  return value && typeof value === "object" ? value : null;
}
__name(_asObject, "_asObject");
function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString, "_asString");
function _getFindings2(selfAudit) {
  const findings = selfAudit?.findings;
  return Array.isArray(findings) ? findings : [];
}
__name(_getFindings2, "_getFindings");
function _hasSecretExposure(selfAudit) {
  return _getFindings2(selfAudit).some((f) => f?.category === "secret_exposure");
}
__name(_hasSecretExposure, "_hasSecretExposure");
function _hasBlockingRisk(selfAudit) {
  if (!selfAudit) return false;
  if (selfAudit.should_block === true) return true;
  if (selfAudit.risk_level === "blocking") return true;
  return _getFindings2(selfAudit).some((f) => f?.severity === "blocking");
}
__name(_hasBlockingRisk, "_hasBlockingRisk");
function _baseResult(status, skillId, reason) {
  return {
    skill_execution: {
      mode: SKILL_EXECUTION_MODE,
      status,
      skill_id: skillId || null,
      reason,
      requires_approval: status === SKILL_EXECUTION_STATUS.PROPOSED,
      side_effects: false
    }
  };
}
__name(_baseResult, "_baseResult");
function buildSkillExecutionProposal(input) {
  const normalized = _asObject(input) || {};
  const skillRouting = _asObject(normalized.skillRouting);
  const intentClassification = _asObject(normalized.intentClassification);
  const selfAudit = _asObject(normalized.selfAudit);
  const responsePolicy = _asObject(normalized.responsePolicy);
  const chatContext = _asObject(normalized.chatContext || normalized.context);
  const matched = skillRouting?.matched === true;
  const skillId = _asString(skillRouting?.skill_id);
  if (_hasSecretExposure(selfAudit)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId,
      "Self-Audit detectou secret_exposure; proposta bloqueada por seguran\xE7a."
    );
  }
  if (_hasBlockingRisk(selfAudit)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId,
      "Self-Audit em risco blocking; proposta bloqueada at\xE9 mitiga\xE7\xE3o."
    );
  }
  if (!matched) {
    const inferredIntent = _asString(intentClassification?.intent);
    const policyPause = responsePolicy?.should_refuse_or_pause === true;
    const hasChatContext = !!chatContext;
    return _baseResult(
      SKILL_EXECUTION_STATUS.NOT_APPLICABLE,
      null,
      inferredIntent ? `Nenhuma skill roteada para intent=${inferredIntent}.` : policyPause ? "Sem proposta: Response Policy sinalizou pausa/recusa e n\xE3o h\xE1 skill roteada." : hasChatContext ? "Nenhuma skill roteada no contexto atual do chat." : "Nenhuma skill roteada para esta mensagem."
    );
  }
  if (!skillId || !SKILL_EXECUTION_ALLOWLIST.has(skillId)) {
    return _baseResult(
      SKILL_EXECUTION_STATUS.BLOCKED,
      skillId || null,
      "Skill fora da allowlist (deny-by-default)."
    );
  }
  return _baseResult(
    SKILL_EXECUTION_STATUS.PROPOSED,
    skillId,
    "Skill eleg\xEDvel para proposal-only; execu\xE7\xE3o real permanece bloqueada."
  );
}
__name(buildSkillExecutionProposal, "buildSkillExecutionProposal");

// schema/enavia-chat-skill-surface.js
var CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE = "Existe uma a\xE7\xE3o t\xE9cnica proposta, aguardando aprova\xE7\xE3o.";
function _asObject2(value) {
  return value && typeof value === "object" ? value : null;
}
__name(_asObject2, "_asObject");
function _asString2(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString2, "_asString");
function buildChatSkillSurface(input) {
  const normalized = _asObject2(input) || {};
  const skillExecution = _asObject2(normalized.skillExecution || normalized.skill_execution);
  if (!skillExecution) return null;
  const status = _asString2(skillExecution.status);
  if (status !== "proposed") return null;
  return {
    kind: "skill_proposal",
    status: "proposed",
    is_proposal: true,
    awaiting_approval: true,
    skill_id: _asString2(skillExecution.skill_id) || null,
    message: CHAT_SKILL_SURFACE_PROPOSAL_MESSAGE
  };
}
__name(buildChatSkillSurface, "buildChatSkillSurface");

// schema/enavia-skill-approval-gate.js
var SKILL_APPROVAL_STATUS = {
  PROPOSED: "proposed",
  APPROVED: "approved",
  REJECTED: "rejected",
  EXPIRED: "expired",
  BLOCKED: "blocked"
};
var _PROPOSAL_STORE = /* @__PURE__ */ new Map();
var _proposalCounter = 0;
function _asObject3(value) {
  return value && typeof value === "object" ? value : null;
}
__name(_asObject3, "_asObject");
function _asString3(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString3, "_asString");
function _nowIso(nowMs = Date.now()) {
  return new Date(nowMs).toISOString();
}
__name(_nowIso, "_nowIso");
function _buildProposalId() {
  _proposalCounter += 1;
  return `proposal_${Date.now().toString(36)}_${_proposalCounter.toString(36)}`;
}
__name(_buildProposalId, "_buildProposalId");
function _normalizeSkillExecution(input) {
  const se = _asObject3(input);
  if (!se) return null;
  const mode = _asString3(se.mode);
  const status = _asString3(se.status);
  const reason = _asString3(se.reason);
  if (mode !== "proposal") return null;
  if (!status) return null;
  if (se.side_effects !== false) return null;
  return {
    mode,
    status,
    skill_id: _asString3(se.skill_id) || null,
    reason: reason || "Proposta sem reason expl\xEDcito.",
    requires_approval: se.requires_approval === true,
    side_effects: false
  };
}
__name(_normalizeSkillExecution, "_normalizeSkillExecution");
function _gateStatusFromSkillStatus(skillStatus) {
  if (skillStatus === "proposed") return SKILL_APPROVAL_STATUS.PROPOSED;
  if (skillStatus === "blocked" || skillStatus === "not_applicable") return SKILL_APPROVAL_STATUS.BLOCKED;
  return SKILL_APPROVAL_STATUS.BLOCKED;
}
__name(_gateStatusFromSkillStatus, "_gateStatusFromSkillStatus");
function _publicRecord(record, overrideReason = null) {
  const reason = overrideReason || record.reason || record.skill_execution.reason;
  return {
    proposal_id: record.proposal_id,
    status: record.status,
    mode: "proposal",
    skill_id: record.skill_execution.skill_id || null,
    reason,
    requires_approval: record.status === SKILL_APPROVAL_STATUS.PROPOSED,
    side_effects: false,
    created_at: record.created_at,
    updated_at: record.updated_at,
    expires_at: record.expires_at || null
  };
}
__name(_publicRecord, "_publicRecord");
function _isExpired(record, nowMs = Date.now()) {
  if (!record.expires_at) return false;
  const expiry = Date.parse(record.expires_at);
  if (!Number.isFinite(expiry)) return false;
  return nowMs >= expiry;
}
__name(_isExpired, "_isExpired");
function _refreshExpiration(record, nowMs = Date.now()) {
  if (_isExpired(record, nowMs)) {
    record.status = SKILL_APPROVAL_STATUS.EXPIRED;
    record.reason = "Proposal expirada.";
    record.updated_at = _nowIso(nowMs);
  }
}
__name(_refreshExpiration, "_refreshExpiration");
function registerSkillProposal(skillExecution, options = {}) {
  const normalized = _normalizeSkillExecution(skillExecution);
  if (!normalized) {
    return {
      ok: false,
      proposal_id: null,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Payload de proposal inv\xE1lido para approval gate.",
      side_effects: false
    };
  }
  const nowMs = Number.isFinite(options.nowMs) ? options.nowMs : Date.now();
  const proposalId = _buildProposalId();
  const gateStatus = _gateStatusFromSkillStatus(normalized.status);
  const createdAt = _nowIso(nowMs);
  const expiresAt = _asString3(options.expires_at) || null;
  const record = {
    proposal_id: proposalId,
    status: gateStatus,
    created_at: createdAt,
    updated_at: createdAt,
    expires_at: expiresAt,
    reason: gateStatus === SKILL_APPROVAL_STATUS.BLOCKED && normalized.status === "not_applicable" ? "Proposal not_applicable n\xE3o \xE9 eleg\xEDvel para approval." : normalized.reason,
    skill_execution: normalized
  };
  _PROPOSAL_STORE.set(proposalId, record);
  return {
    ok: true,
    proposal_id: proposalId,
    status: record.status,
    side_effects: false,
    proposal: _publicRecord(record)
  };
}
__name(registerSkillProposal, "registerSkillProposal");
function _resolveProposal(input) {
  const proposalId = _asString3(input?.proposal_id || input?.proposalId);
  if (!proposalId) {
    return {
      ok: false,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "proposal_id obrigat\xF3rio.",
      proposal_id: null,
      side_effects: false
    };
  }
  const record = _PROPOSAL_STORE.get(proposalId);
  if (!record) {
    return {
      ok: false,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal desconhecida.",
      proposal_id: proposalId,
      side_effects: false
    };
  }
  _refreshExpiration(record);
  return { ok: true, proposal_id: proposalId, record };
}
__name(_resolveProposal, "_resolveProposal");
function approveSkillProposal(input) {
  const resolved = _resolveProposal(input);
  if (!resolved.ok) return resolved;
  const { record } = resolved;
  if (record.status === SKILL_APPROVAL_STATUS.EXPIRED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal expirada; approval bloqueado.",
      side_effects: false,
      proposal: _publicRecord(record)
    };
  }
  if (record.status !== SKILL_APPROVAL_STATUS.PROPOSED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: `Approval bloqueado para status=${record.status}.`,
      side_effects: false,
      proposal: _publicRecord(record)
    };
  }
  if (record.skill_execution.status === "not_applicable") {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal not_applicable n\xE3o pode ser aprovada.",
      side_effects: false,
      proposal: _publicRecord(record)
    };
  }
  record.status = SKILL_APPROVAL_STATUS.APPROVED;
  record.reason = "Proposal aprovada no gate t\xE9cnico (proposal-only).";
  record.updated_at = _nowIso();
  return {
    ok: true,
    proposal_id: record.proposal_id,
    status: SKILL_APPROVAL_STATUS.APPROVED,
    side_effects: false,
    proposal: _publicRecord(record)
  };
}
__name(approveSkillProposal, "approveSkillProposal");
function rejectSkillProposal(input) {
  const resolved = _resolveProposal(input);
  if (!resolved.ok) return resolved;
  const { record } = resolved;
  if (record.status === SKILL_APPROVAL_STATUS.EXPIRED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: "Proposal expirada; reject bloqueado.",
      side_effects: false,
      proposal: _publicRecord(record)
    };
  }
  if (record.status !== SKILL_APPROVAL_STATUS.PROPOSED) {
    return {
      ok: false,
      proposal_id: record.proposal_id,
      status: SKILL_APPROVAL_STATUS.BLOCKED,
      reason: `Reject bloqueado para status=${record.status}.`,
      side_effects: false,
      proposal: _publicRecord(record)
    };
  }
  record.status = SKILL_APPROVAL_STATUS.REJECTED;
  record.reason = "Proposal rejeitada no gate t\xE9cnico (proposal-only).";
  record.updated_at = _nowIso();
  return {
    ok: true,
    proposal_id: record.proposal_id,
    status: SKILL_APPROVAL_STATUS.REJECTED,
    side_effects: false,
    proposal: _publicRecord(record)
  };
}
__name(rejectSkillProposal, "rejectSkillProposal");

// schema/enavia-skill-factory.js
var SKILL_FACTORY_MODES = {
  READ_ONLY: "read_only",
  SUPERVISED_SIDE_EFFECT: "supervised_side_effect"
};
var SKILL_FACTORY_RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  BLOCKED: "blocked"
};
var SKILL_FACTORY_STATUSES = {
  DRAFT: "draft",
  PROPOSED: "proposed",
  BLOCKED: "blocked"
};
var _FORBIDDEN_EFFECTS_BASE = [
  "deploy_automatico",
  "merge_automatico",
  "producao_direta",
  "browser_action",
  "acesso_credenciais_sensiveis",
  "execucao_comando_externo",
  "escrita_kv_ou_banco",
  "filesystem_runtime",
  "chamada_llm_externo_novo",
  "fetch_externo"
];
var _BLOCKED_PATTERNS = [
  { re: /\b(secret|secrets|token|apikey|api[_ -]?key|authorization|senha)\b/i, reason: "Pedido envolve credenciais sens\xEDveis." },
  { re: /\b(deploy|produção|producao|rollout|merge automático|merge automatico|push automático|push automatico)\b/i, reason: "Pedido envolve deploy/merge/push autom\xE1tico." },
  { re: /\b(browser|playwright|puppeteer|navegador|abrir página|abrir pagina)\b/i, reason: "Pedido envolve browser action." },
  { re: /\b(exec|spawn|child_process|powershell|bash|cmd|shell|comando externo)\b/i, reason: "Pedido envolve execu\xE7\xE3o de comando externo." },
  { re: /\b(database|banco|sql|postgres|mysql|mongodb|redis|kv)\b/i, reason: "Pedido envolve escrita em banco/KV." },
  { re: /\b(sem revisão|sem revis[aã]o|sem aprovação|sem aprova[cç][aã]o|autônom|autonom)\b/i, reason: "Pedido remove revis\xE3o/aprova\xE7\xE3o humana." },
  { re: /\b(faz tudo|faça tudo|qualquer coisa|tudo automático|tudo automatico)\b/i, reason: "Pedido amplo/difuso sem limites seguros." }
];
function _asObject4(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
__name(_asObject4, "_asObject");
function _asString4(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString4, "_asString");
function _asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => _asString4(item)).filter(Boolean);
}
__name(_asStringArray, "_asStringArray");
function _sanitizeText(text) {
  const raw = _asString4(text);
  if (!raw) return "";
  return raw.replace(/openai_api_key/gi, "[REDACTED]").replace(/\bapi[_ -]?key\b/gi, "[REDACTED]").replace(/\b[A-Za-z0-9_]*token[A-Za-z0-9_]*\b/gi, "[REDACTED]").replace(/\b[A-Za-z0-9_]*secret[A-Za-z0-9_]*\b/gi, "[REDACTED]").replace(/\bauthorization\b/gi, "[REDACTED]");
}
__name(_sanitizeText, "_sanitizeText");
function _normalizeSkillId(value) {
  const base = _asString4(value).toLowerCase();
  const slug = base.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-{2,}/g, "-");
  if (!slug) return "skill-sem-id";
  if (/^[a-z]/.test(slug)) return slug;
  return `skill-${slug}`;
}
__name(_normalizeSkillId, "_normalizeSkillId");
function _extractHumanGoal(input) {
  const src = _asObject4(input);
  return _asString4(
    src.human_request || src.request || src.goal || src.objective || src.message || src.description || ""
  );
}
__name(_extractHumanGoal, "_extractHumanGoal");
function _hasSideEffectIntent(text, mode) {
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) return true;
  return /\b(alterar arquivo|escrever em|editar arquivo|deletar arquivo|executar comando|rodar script|chamar api|deploy|produção|producao|browser)\b/i.test(text);
}
__name(_hasSideEffectIntent, "_hasSideEffectIntent");
function _collectBlockedReasons(goal, mode, allowedEffects) {
  const reasons = [];
  for (const item of _BLOCKED_PATTERNS) {
    if (item.re.test(goal)) reasons.push(item.reason);
  }
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT && allowedEffects.length === 0) {
    reasons.push("Skill com side effect exige allowed_effects expl\xEDcitos.");
  }
  return Array.from(new Set(reasons));
}
__name(_collectBlockedReasons, "_collectBlockedReasons");
function _inferRiskLevel(status, mode, reasons, allowedEffects) {
  if (status === SKILL_FACTORY_STATUSES.BLOCKED) return SKILL_FACTORY_RISK_LEVELS.BLOCKED;
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) {
    if (allowedEffects.some((effect) => /delete|write|exec|network|deploy/i.test(effect))) {
      return SKILL_FACTORY_RISK_LEVELS.HIGH;
    }
    return SKILL_FACTORY_RISK_LEVELS.MEDIUM;
  }
  if (reasons.length > 0) return SKILL_FACTORY_RISK_LEVELS.MEDIUM;
  return SKILL_FACTORY_RISK_LEVELS.LOW;
}
__name(_inferRiskLevel, "_inferRiskLevel");
function _defaultPurpose(goal) {
  if (goal) return goal.slice(0, 180);
  return "Nova capacidade Enavia a partir de pedido humano.";
}
__name(_defaultPurpose, "_defaultPurpose");
function _defaultDescription(goal) {
  if (goal) return `Skill proposta para: ${goal}`;
  return "Spec inicial sem objetivo detalhado; revisar com humano antes de criar skill.";
}
__name(_defaultDescription, "_defaultDescription");
function _defaultInputs(input, mode) {
  const provided = _asStringArray(input.inputs);
  if (provided.length > 0) return provided;
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) {
    return ["human_request", "approval_context", "allowed_effects"];
  }
  return ["human_request"];
}
__name(_defaultInputs, "_defaultInputs");
function _defaultOutputs(input, mode) {
  const provided = _asStringArray(input.outputs);
  if (provided.length > 0) return provided;
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) {
    return ["proposal", "evidence", "review_checklist"];
  }
  return ["structured_result", "evidence"];
}
__name(_defaultOutputs, "_defaultOutputs");
function buildSkillSpec(input) {
  const source = _asObject4(input);
  const goalRaw = _extractHumanGoal(source);
  const goal = _sanitizeText(goalRaw);
  const modeRaw = _asString4(source.mode);
  const explicitMode = modeRaw === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT ? SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT : SKILL_FACTORY_MODES.READ_ONLY;
  const sideEffectIntent = _hasSideEffectIntent(goalRaw, explicitMode);
  const mode = sideEffectIntent ? SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT : SKILL_FACTORY_MODES.READ_ONLY;
  const allowedEffects = _asStringArray(source.allowed_effects);
  const forbiddenEffects = Array.from(
    /* @__PURE__ */ new Set([..._FORBIDDEN_EFFECTS_BASE, ..._asStringArray(source.forbidden_effects)])
  );
  const skillIdSource = _asString4(source.skill_id) || _asString4(source.suggested_skill_id) || _defaultPurpose(goal);
  const skillId = _normalizeSkillId(skillIdSource);
  const blockedReasons = _collectBlockedReasons(goalRaw, mode, allowedEffects);
  const emptyGoal = goal.length === 0;
  const status = blockedReasons.length > 0 ? SKILL_FACTORY_STATUSES.BLOCKED : emptyGoal ? SKILL_FACTORY_STATUSES.DRAFT : SKILL_FACTORY_STATUSES.PROPOSED;
  const reasons = blockedReasons.length > 0 ? blockedReasons : emptyGoal ? ["Pedido incompleto; preencher objetivo humano."] : ["Pedido eleg\xEDvel para proposta supervisionada."];
  const riskLevel = _inferRiskLevel(status, mode, reasons, allowedEffects);
  const fileBase = skillId.replace(/-/g, "_");
  return {
    skill_id: skillId,
    purpose: _defaultPurpose(goal),
    description: _defaultDescription(goal),
    inputs: _defaultInputs(source, mode),
    outputs: _defaultOutputs(source, mode),
    mode,
    risk_level: riskLevel,
    allowed_effects: allowedEffects,
    forbidden_effects: forbiddenEffects,
    files_to_create: _asStringArray(source.files_to_create).length > 0 ? _asStringArray(source.files_to_create) : [`schema/skills/${skillId}.md`],
    tests_to_create: _asStringArray(source.tests_to_create).length > 0 ? _asStringArray(source.tests_to_create) : [`tests/${fileBase}.smoke.test.js`],
    registry_changes: _asStringArray(source.registry_changes).length > 0 ? _asStringArray(source.registry_changes) : ["schema/skills/INDEX.md"],
    approval_required: true,
    human_review_required: true,
    status,
    reasons,
    safety_notes: [
      "Sem autoriza\xE7\xE3o expl\xEDcita, somente spec.",
      "Pacote de cria\xE7\xE3o apenas com flags expl\xEDcitas de aprova\xE7\xE3o humana.",
      "Sem deploy, merge autom\xE1tico, execu\xE7\xE3o de skill, produ\xE7\xE3o ou comandos externos nesta PR."
    ]
  };
}
__name(buildSkillSpec, "buildSkillSpec");
function validateSkillSpec(spec) {
  const input = _asObject4(spec);
  const errors = [];
  const requiredFields = [
    "skill_id",
    "purpose",
    "description",
    "inputs",
    "outputs",
    "mode",
    "risk_level",
    "allowed_effects",
    "forbidden_effects",
    "files_to_create",
    "tests_to_create",
    "registry_changes",
    "approval_required",
    "human_review_required",
    "status",
    "reasons",
    "safety_notes"
  ];
  for (const field of requiredFields) {
    if (!(field in input)) errors.push(`missing:${field}`);
  }
  if (!/^[a-z][a-z0-9-]*$/.test(_asString4(input.skill_id))) {
    errors.push("invalid:skill_id");
  }
  if (!Object.values(SKILL_FACTORY_MODES).includes(input.mode)) {
    errors.push("invalid:mode");
  }
  if (!Object.values(SKILL_FACTORY_RISK_LEVELS).includes(input.risk_level)) {
    errors.push("invalid:risk_level");
  }
  if (!Object.values(SKILL_FACTORY_STATUSES).includes(input.status)) {
    errors.push("invalid:status");
  }
  if (input.approval_required !== true) {
    errors.push("invalid:approval_required");
  }
  if (input.human_review_required !== true) {
    errors.push("invalid:human_review_required");
  }
  const arrayFields = [
    "inputs",
    "outputs",
    "allowed_effects",
    "forbidden_effects",
    "files_to_create",
    "tests_to_create",
    "registry_changes",
    "reasons",
    "safety_notes"
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(input[field])) errors.push(`invalid:${field}`);
  }
  if (input.mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT && (!Array.isArray(input.allowed_effects) || input.allowed_effects.length === 0)) {
    errors.push("invalid:allowed_effects_required_for_side_effect");
  }
  return {
    ok: errors.length === 0,
    errors
  };
}
__name(validateSkillSpec, "validateSkillSpec");
function buildSkillCreationPackage(spec, options = {}) {
  const normalizedOptions = _asObject4(options);
  const authorizationText = _sanitizeText(normalizedOptions.human_authorization_text);
  const approved = normalizedOptions.approved_to_prepare_package === true;
  const validation = validateSkillSpec(spec);
  if (!validation.ok) {
    return {
      ok: false,
      blocked: true,
      error: "INVALID_SKILL_SPEC",
      detail: validation.errors,
      prepared: false,
      side_effects: false,
      executed: false
    };
  }
  if (!approved || !authorizationText) {
    return {
      ok: false,
      blocked: true,
      error: "AUTHORIZATION_REQUIRED",
      detail: "Aprova\xE7\xE3o humana expl\xEDcita \xE9 obrigat\xF3ria para preparar pacote.",
      prepared: false,
      side_effects: false,
      executed: false
    };
  }
  if (spec.risk_level === SKILL_FACTORY_RISK_LEVELS.BLOCKED || spec.status === SKILL_FACTORY_STATUSES.BLOCKED) {
    return {
      ok: false,
      blocked: true,
      error: "SKILL_SPEC_BLOCKED",
      detail: "Spec bloqueada n\xE3o pode gerar pacote de cria\xE7\xE3o.",
      prepared: false,
      side_effects: false,
      executed: false
    };
  }
  const skillFilePath = spec.files_to_create[0] || `schema/skills/${spec.skill_id}.md`;
  const testFilePath = spec.tests_to_create[0] || `tests/${spec.skill_id}.smoke.test.js`;
  const registryTarget = spec.registry_changes[0] || "schema/skills/INDEX.md";
  const packagePayload = {
    skill_id: spec.skill_id,
    prepared: true,
    side_effects: false,
    executed: false,
    approval: {
      approved_to_prepare_package: true,
      human_review_acknowledged: true
    },
    files_to_create: spec.files_to_create,
    tests_to_create: spec.tests_to_create,
    registry_changes: spec.registry_changes,
    suggested_paths: {
      skill_file_path: skillFilePath,
      test_file_path: testFilePath,
      registry_target: registryTarget
    },
    proposed_content: {
      skill_file: `# ${spec.skill_id}

Purpose: ${spec.purpose}

Description: ${spec.description}
`,
      test_file: `// TODO: smoke test for ${spec.skill_id}
`,
      registry_change: `- ${spec.skill_id} -> ${skillFilePath}`
    },
    safe_patch_text: [
      "*** Begin Patch",
      `*** Add File: ${skillFilePath}`,
      `+# ${spec.skill_id}`,
      `+`,
      `+Purpose: ${spec.purpose}`,
      `+`,
      `+Description: ${spec.description}`,
      `*** End Patch`
    ].join("\n"),
    human_review_checklist: [
      "Revisar escopo e riscos da spec.",
      "Confirmar modo e allowed_effects.",
      "Validar arquivos e testes sugeridos.",
      "Confirmar que n\xE3o h\xE1 deploy/merge autom\xE1tico.",
      "Aprovar somente ap\xF3s revis\xE3o humana completa."
    ],
    rollback_suggested: [
      "Reverter o commit que adiciona skill/test/registry.",
      "Remover entrada da skill no registry.",
      "Rodar su\xEDte de regress\xE3o da fase PR69-PR79."
    ]
  };
  return {
    ok: true,
    blocked: false,
    prepared: true,
    side_effects: false,
    executed: false,
    skill_creation_package: packagePayload
  };
}
__name(buildSkillCreationPackage, "buildSkillCreationPackage");

// schema/enavia-system-mapper-skill.js
var SYSTEM_MAPPER_SKILL_ID = "SYSTEM_MAPPER";
var SYSTEM_MAPPER_MODE = "read_only";
function _asObject5(value) {
  return value && typeof value === "object" ? value : null;
}
__name(_asObject5, "_asObject");
function _asBoolean(value) {
  return value === true;
}
__name(_asBoolean, "_asBoolean");
function _asString5(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString5, "_asString");
function _normalizeProposalStatus(input) {
  const root = _asObject5(input) || {};
  const approval = _asObject5(root.approval);
  const fromRoot = _asString5(root.proposal_status || root.proposalStatus).toLowerCase();
  const fromApproval = _asString5(approval?.status || approval?.proposal_status).toLowerCase();
  return fromRoot || fromApproval || "unknown";
}
__name(_normalizeProposalStatus, "_normalizeProposalStatus");
function _buildKnownEndpoints() {
  return {
    skills: {
      propose: { method: "POST", path: "/skills/propose", exists: true },
      approve: { method: "POST", path: "/skills/approve", exists: true },
      reject: { method: "POST", path: "/skills/reject", exists: true },
      run: { method: "POST", path: "/skills/run", exists: false }
    }
  };
}
__name(_buildKnownEndpoints, "_buildKnownEndpoints");
function _buildCapabilitiesMap() {
  const allowlist = Array.from(SKILL_EXECUTION_ALLOWLIST).sort();
  return {
    allowlist,
    endpoints: _buildKnownEndpoints(),
    proposal_gate: {
      available: true,
      lifecycle: ["proposed", "approved", "rejected", "expired", "blocked"],
      persistence: "in_memory_per_instance_only"
    },
    limitations: [
      "read_only_only",
      "no_side_effects",
      "no_skills_run_endpoint",
      "no_runtime_filesystem",
      "no_external_network_or_llm",
      "no_kv_or_database_writes"
    ]
  };
}
__name(_buildCapabilitiesMap, "_buildCapabilitiesMap");
function buildSystemMapperResult(input) {
  const normalized = _asObject5(input) || {};
  const requireApprovedProposal = _asBoolean(
    normalized.require_approved_proposal || normalized.requireApprovedProposal
  );
  const proposalStatus = _normalizeProposalStatus(normalized);
  const approvalSatisfied = proposalStatus === "approved";
  if (requireApprovedProposal && !approvalSatisfied) {
    return {
      skill_id: SYSTEM_MAPPER_SKILL_ID,
      mode: SYSTEM_MAPPER_MODE,
      status: "blocked",
      reason: "SYSTEM_MAPPER exige proposal aprovada quando solicitado.",
      side_effects: false,
      executed: false,
      executed_readonly: false,
      gate: {
        requires_approved_proposal: true,
        proposal_status: proposalStatus,
        approved: false
      },
      result: null
    };
  }
  return {
    skill_id: SYSTEM_MAPPER_SKILL_ID,
    mode: SYSTEM_MAPPER_MODE,
    status: "ok",
    reason: "SYSTEM_MAPPER read-only mapeado com sucesso.",
    side_effects: false,
    executed: false,
    executed_readonly: true,
    gate: {
      requires_approved_proposal: requireApprovedProposal,
      proposal_status: proposalStatus,
      approved: !requireApprovedProposal || approvalSatisfied
    },
    result: _buildCapabilitiesMap()
  };
}
__name(buildSystemMapperResult, "buildSystemMapperResult");

// schema/enavia-self-worker-auditor-skill.js
var SELF_WORKER_AUDITOR_SKILL_ID = "SELF_WORKER_AUDITOR";
var SELF_WORKER_AUDITOR_MODE = "read_only";
function _asObject6(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
__name(_asObject6, "_asObject");
function _asString6(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString6, "_asString");
function _normalizeProposalStatus2(input) {
  const root = _asObject6(input);
  const approval = _asObject6(root.approval);
  const fromRoot = _asString6(root.proposal_status || root.proposalStatus).toLowerCase();
  const fromApproval = _asString6(
    approval.status || approval.proposal_status
  ).toLowerCase();
  return fromRoot || fromApproval || "unknown";
}
__name(_normalizeProposalStatus2, "_normalizeProposalStatus");
function _buildFindings() {
  return [
    {
      id: "S1",
      severity: "high",
      category: "security",
      title: "Endpoints p\xFAblicos sem rate limiting expl\xEDcito",
      evidence: "nv-enavia.js exp\xF5e /chat/run, /skills/propose, /skills/run sem middleware de rate limit. Cloudflare Workers pode ter limites de plataforma, mas n\xE3o h\xE1 controle aplicacional documentado.",
      recommendation: "Implementar contagem de requisi\xE7\xF5es por IP/session em mem\xF3ria ou via CF limit rules antes de PR85."
    },
    {
      id: "S2",
      severity: "medium",
      category: "security",
      title: "Mensagens de erro podem expor detalhes internos",
      evidence: "Bloqueios do runner e do approval gate retornam campos 'detail' e 'errors' que descrevem l\xF3gica interna (ex: 'blocked:proposal_status:proposed'). Em produ\xE7\xE3o, detalhes operacionais devem ser reduzidos ao m\xEDnimo exposto.",
      recommendation: "Criar campo 'internal_detail' (n\xE3o serializado para o cliente) e retornar apenas c\xF3digo de erro e mensagem gen\xE9rica."
    },
    {
      id: "T1",
      severity: "high",
      category: "telemetry",
      title: "Aus\xEAncia de telemetria estruturada nos endpoints",
      evidence: "Nenhum dos handlers em nv-enavia.js emite logs estruturados (JSON) por request. N\xE3o h\xE1 campos de lat\xEAncia, run_id de request, skill_id, nem status de resposta nos logs.",
      recommendation: "Adicionar log estruturado m\xEDnimo por request: {timestamp, path, status_code, run_id, latency_ms} usando console.log(JSON.stringify(...)). N\xE3o requer binding extra."
    },
    {
      id: "T2",
      severity: "medium",
      category: "telemetry",
      title: "Aprova\xE7\xF5es de skill n\xE3o possuem audit trail persistido",
      evidence: "O runner (schema/enavia-skill-runner.js) verifica apenas proposal_status=approved via payload da requisi\xE7\xE3o, sem registrar quem aprovou, quando aprovou e para qual proposal_id. N\xE3o \xE9 poss\xEDvel auditar retrospectivamente as aprova\xE7\xF5es de skills, pois a persist\xEAncia \xE9 apenas in-memory-per-instance conforme declarado pelo SYSTEM_MAPPER.",
      recommendation: "Futuramente persistir audit entries de aprova\xE7\xE3o (proposal_id, approved_at, approved_by, skill_id) em KV ou log estruturado com aprova\xE7\xE3o humana expl\xEDcita."
    },
    {
      id: "D1",
      severity: "high",
      category: "deploy_loop",
      title: "Loop de deploy incompleto \u2014 falta caminho test\u2192promote\u2192prod",
      evidence: "wrangler.toml e workflows existentes configuram deploy b\xE1sico, mas o fluxo pedido\u2192plano\u2192aprova\xE7\xE3o\u2192deploy/test\u2192prova\u2192promote/prod n\xE3o est\xE1 automatizado nem documentado como test\xE1vel ponta a ponta.",
      recommendation: "PR83 deve diagnosticar e completar o loop: definir fluxo can\xF4nico, criar smoke test do caminho deploy/test/rollback."
    },
    {
      id: "D2",
      severity: "medium",
      category: "deploy_loop",
      title: "Rollback de deploy n\xE3o documentado como a\xE7\xE3o ativ\xE1vel",
      evidence: "schema/execution/ENAVIA_EXECUTION_LOG.md menciona rollback conceitualmente em PR80/PR81, mas n\xE3o existe um runbook ativo com comando/passo claro para reverter um deploy falho.",
      recommendation: "PR83 deve criar runbook de rollback com passos verific\xE1veis e smoke test de rollback."
    },
    {
      id: "C1",
      severity: "high",
      category: "chat_rigidity",
      title: "Tom do chat excessivamente rob\xF3tico e formal",
      evidence: "Diagn\xF3stico PR32/PR34 documentou que o sistema prompt traduz read_only como regra de tom e sanitizadores p\xF3s-LLM substituem respostas vivas por frases fixas. Problema persiste como debt t\xE9cnico at\xE9 PR84.",
      recommendation: "PR84 deve ajustar camada de resposta/policy/cognitive runtime de forma cir\xFArgica para reduzir engessamento sem remover guardrails."
    },
    {
      id: "C2",
      severity: "medium",
      category: "chat_rigidity",
      title: "Prompt do sistema carregado de regras contratuais expostas ao LLM",
      evidence: "schema/enavia-cognitive-runtime.js injeta se\xE7\xF5es de governan\xE7a e contrato diretamente no system prompt. O LLM responde como auditor em vez de assistente conversacional.",
      recommendation: "PR84 deve separar regras de bloqueio (imut\xE1veis) de tom/contexto (ajust\xE1vel), reduzindo ru\xEDdo contratual no system prompt."
    },
    {
      id: "TE1",
      severity: "medium",
      category: "tests",
      title: "Cobertura de teste de /skills/run para novas skills n\xE3o garantida",
      evidence: "tests/pr80-skill-registry-runner.smoke.test.js cobre SYSTEM_MAPPER. Skills novas (ex: SELF_WORKER_AUDITOR) exigem teste pr\xF3prio. O runner retorna SKILL_RUNNER_NOT_IMPLEMENTED para skills sem handler \u2014 risco de falha silenciosa.",
      recommendation: "Criar teste pr82-self-worker-auditor.smoke.test.js cobrindo todos os cen\xE1rios obrigat\xF3rios do contrato."
    },
    {
      id: "G1",
      severity: "low",
      category: "governance",
      title: "Atualiza\xE7\xE3o de governan\xE7a (STATUS/HANDOFF/LOG) \xE9 manual",
      evidence: "CLAUDE.md se\xE7\xE3o 6 exige atualiza\xE7\xE3o manual dos 3 arquivos de governan\xE7a ao final de cada PR. N\xE3o h\xE1 mecanismo automatizado para detectar quando est\xE3o desatualizados.",
      recommendation: "Futuramente criar skill GOVERNANCE_AUDITOR para verificar coer\xEAncia entre contrato ativo, status e handoff."
    }
  ];
}
__name(_buildFindings, "_buildFindings");
function _buildPriorityActions() {
  return [
    {
      target_pr: "PR83",
      action: "Diagnosticar e completar o loop de deploy real",
      reason: "Achados D1/D2 mostram que o fluxo deploy/test/rollback est\xE1 incompleto. PR83 deve criar caminho verific\xE1vel ponta a ponta."
    },
    {
      target_pr: "PR84",
      action: "Corrigir engessamento do chat \u2014 ajuste cir\xFArgico na camada de resposta/policy",
      reason: "Achados C1/C2 confirmam d\xEDvida t\xE9cnica conhecida desde PR32/PR34. PR84 deve reduzir tom rob\xF3tico sem remover guardrails."
    },
    {
      target_pr: "future",
      action: "Adicionar telemetria estruturada por request em nv-enavia.js",
      reason: "Achados T1/T2 indicam aus\xEAncia de logs rastre\xE1veis. Sem telemetria, debugging em produ\xE7\xE3o \xE9 cego."
    },
    {
      target_pr: "future",
      action: "Implementar rate limiting aplicacional nos endpoints p\xFAblicos",
      reason: "Achado S1 aponta aus\xEAncia de controle de taxa. Prote\xE7\xE3o de plataforma (CF) \xE9 necess\xE1ria mas n\xE3o substitui controle aplicacional."
    },
    {
      target_pr: "future",
      action: "Reduzir detalhes internos retornados em respostas de erro",
      reason: "Achado S2 \u2014 mensagens de erro com l\xF3gica interna s\xE3o surface de ataque e debugging desnecess\xE1rio para o cliente."
    }
  ];
}
__name(_buildPriorityActions, "_buildPriorityActions");
function _buildSafetyNotes() {
  return [
    "SELF_WORKER_AUDITOR \xE9 read-only. Nenhum arquivo foi alterado, nenhuma vari\xE1vel de runtime foi modificada.",
    "Diagn\xF3stico baseado em snapshot est\xE1tico do repo \u2014 n\xE3o usa filesystem runtime, fetch ou KV.",
    "Achados s\xE3o informativos. Corre\xE7\xE3o exige nova PR com aprova\xE7\xE3o humana.",
    "Forbidden effects aplicados: deploy_automatico, merge_automatico, producao_direta, browser_action, acesso_credenciais_sensiveis, execucao_comando_externo, escrita_kv_ou_banco, filesystem_runtime, chamada_llm_externo_novo, fetch_externo."
  ];
}
__name(_buildSafetyNotes, "_buildSafetyNotes");
function buildSelfWorkerAuditorResult(input) {
  const normalized = _asObject6(input);
  const proposalStatus = _normalizeProposalStatus2(normalized);
  const requireApproval = normalized.require_approved_proposal !== false && normalized.requireApprovedProposal !== false;
  const approvalSatisfied = proposalStatus === "approved";
  if (requireApproval && !approvalSatisfied) {
    return {
      ok: false,
      skill_id: SELF_WORKER_AUDITOR_SKILL_ID,
      mode: SELF_WORKER_AUDITOR_MODE,
      executed: false,
      side_effects: false,
      summary: "SELF_WORKER_AUDITOR bloqueada \u2014 proposal n\xE3o aprovada.",
      findings: [],
      priority_actions: [],
      safety_notes: _buildSafetyNotes(),
      gate: {
        requires_approved_proposal: true,
        proposal_status: proposalStatus,
        approved: false,
        blocked: true
      }
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
    summary: "Diagn\xF3stico est\xE1tico do Worker/repo conclu\xEDdo. 10 achados identificados em 6 categorias. 2 a\xE7\xF5es cr\xEDticas recomendadas para PR83 (deploy loop) e PR84 (chat engessado).",
    findings,
    priority_actions,
    safety_notes: _buildSafetyNotes(),
    gate: {
      requires_approved_proposal: requireApproval,
      proposal_status: proposalStatus,
      approved: !requireApproval || approvalSatisfied,
      blocked: false
    }
  };
}
__name(buildSelfWorkerAuditorResult, "buildSelfWorkerAuditorResult");

// schema/enavia-skill-registry.js
var REGISTERED_SKILLS = Object.freeze({
  SYSTEM_MAPPER: Object.freeze({
    skill_id: "SYSTEM_MAPPER",
    mode: "read_only",
    risk_level: "low",
    allowed_effects: Object.freeze([]),
    forbidden_effects: Object.freeze([
      "deploy_automatico",
      "merge_automatico",
      "producao_direta",
      "browser_action",
      "acesso_credenciais_sensiveis",
      "execucao_comando_externo",
      "escrita_kv_ou_banco",
      "filesystem_runtime",
      "chamada_llm_externo_novo",
      "fetch_externo"
    ]),
    requires_approval: true,
    human_review_required: true,
    module: "schema/enavia-system-mapper-skill.js",
    source: "buildSystemMapperResult",
    executable: true,
    side_effects_allowed: false
  }),
  SELF_WORKER_AUDITOR: Object.freeze({
    skill_id: "SELF_WORKER_AUDITOR",
    mode: "read_only",
    risk_level: "medium",
    allowed_effects: Object.freeze([]),
    forbidden_effects: Object.freeze([
      "deploy_automatico",
      "merge_automatico",
      "producao_direta",
      "browser_action",
      "acesso_credenciais_sensiveis",
      "execucao_comando_externo",
      "escrita_kv_ou_banco",
      "filesystem_runtime",
      "chamada_llm_externo_novo",
      "fetch_externo"
    ]),
    requires_approval: true,
    human_review_required: true,
    module: "schema/enavia-self-worker-auditor-skill.js",
    source: "buildSelfWorkerAuditorResult",
    executable: true,
    side_effects_allowed: false
  })
});
var _BLOCKED_STATUSES = /* @__PURE__ */ new Set([
  "proposed",
  "rejected",
  "blocked",
  "expired",
  "unknown"
]);
function _asObject7(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}
__name(_asObject7, "_asObject");
function _asString7(value) {
  return typeof value === "string" ? value.trim() : "";
}
__name(_asString7, "_asString");
function _normalizeStatus(input) {
  const normalized = _asString7(input).toLowerCase();
  if (!normalized) return "unknown";
  return normalized;
}
__name(_normalizeStatus, "_normalizeStatus");
function getRegisteredSkill(skillId) {
  const key = _asString7(skillId);
  if (!key) return null;
  const item = REGISTERED_SKILLS[key];
  return item ? { ...item } : null;
}
__name(getRegisteredSkill, "getRegisteredSkill");
function isSkillRegistered(skillId) {
  return !!getRegisteredSkill(skillId);
}
__name(isSkillRegistered, "isSkillRegistered");
function validateSkillRunRequest(input) {
  const payload = _asObject7(input);
  const approval = _asObject7(payload.approval);
  const skill_id = _asString7(payload.skill_id || payload.skillId);
  const proposal_id = _asString7(payload.proposal_id || payload.proposalId);
  const proposal_status = _normalizeStatus(
    payload.proposal_status || payload.proposalStatus || approval.status || approval.proposal_status
  );
  const requested_effects = Array.isArray(payload.requested_effects) ? payload.requested_effects.map((value) => _asString7(value)).filter(Boolean) : [];
  const errors = [];
  if (!skill_id) errors.push("missing:skill_id");
  if (!proposal_id) errors.push("missing:proposal_id");
  if (proposal_status !== "approved" && _BLOCKED_STATUSES.has(proposal_status)) {
    errors.push(`blocked:proposal_status:${proposal_status}`);
  } else if (proposal_status !== "approved") {
    errors.push(`invalid:proposal_status:${proposal_status || "unknown"}`);
  }
  return {
    ok: errors.length === 0,
    errors,
    normalized: {
      skill_id,
      proposal_id,
      proposal_status,
      requested_effects
    }
  };
}
__name(validateSkillRunRequest, "validateSkillRunRequest");

// schema/enavia-skill-runner.js
function _nowMs(context) {
  if (context && Number.isFinite(context.nowMs)) return context.nowMs;
  return Date.now();
}
__name(_nowMs, "_nowMs");
function _buildRunId(context) {
  const now = _nowMs(context);
  const suffix = Math.floor(now % 1e5).toString(36);
  return `run_${now.toString(36)}_${suffix}`;
}
__name(_buildRunId, "_buildRunId");
function _blocked(error, message, detail, input, status_code = 409) {
  return {
    ok: false,
    status_code,
    error,
    message,
    detail: detail || null,
    run_id: null,
    executed: false,
    side_effects: false,
    result: null,
    evidence: {
      skill_id: input?.skill_id || null,
      proposal_id: input?.proposal_id || null,
      status: input?.proposal_status || "unknown",
      blocked: true
    }
  };
}
__name(_blocked, "_blocked");
function _containsForbiddenRequestedEffects(requestedEffects, allowedEffects) {
  if (!Array.isArray(requestedEffects) || requestedEffects.length === 0) return false;
  const allowed = new Set(Array.isArray(allowedEffects) ? allowedEffects : []);
  return requestedEffects.some((effect) => !allowed.has(effect));
}
__name(_containsForbiddenRequestedEffects, "_containsForbiddenRequestedEffects");
function runRegisteredSkill(input, context = {}) {
  const validation = validateSkillRunRequest(input);
  const normalized = validation.normalized;
  if (!normalized.skill_id) {
    return _blocked(
      "MISSING_SKILL_ID",
      "skill_id obrigatorio.",
      validation.errors,
      normalized,
      409
    );
  }
  if (!isSkillRegistered(normalized.skill_id)) {
    return _blocked(
      "SKILL_NOT_REGISTERED",
      "Skill desconhecida ou nao registrada no runtime.",
      validation.errors,
      normalized,
      404
    );
  }
  const registryEntry = getRegisteredSkill(normalized.skill_id);
  if (!registryEntry || registryEntry.executable !== true) {
    return _blocked(
      "SKILL_WITHOUT_REGISTRY_CONTRACT",
      "Skill sem contrato executavel no registry.",
      validation.errors,
      normalized,
      409
    );
  }
  if (!validation.ok) {
    const blockedStatus = normalized.proposal_status || "unknown";
    const error = blockedStatus === "approved" ? "INVALID_RUN_REQUEST" : "APPROVAL_REQUIRED";
    return _blocked(
      error,
      "Run bloqueado por approval invalido ou payload incompleto.",
      validation.errors,
      normalized,
      404
    );
  }
  if (registryEntry.requires_approval === true && normalized.proposal_status !== "approved") {
    return _blocked(
      "APPROVAL_REQUIRED",
      `Skill ${normalized.skill_id} requer proposal aprovada.`,
      [`blocked:proposal_status:${normalized.proposal_status}`],
      normalized,
      404
    );
  }
  if (_containsForbiddenRequestedEffects(normalized.requested_effects, registryEntry.allowed_effects)) {
    return _blocked(
      "SIDE_EFFECT_NOT_ALLOWED",
      "requested_effects contem efeito fora da allowlist da skill.",
      normalized.requested_effects,
      normalized,
      409
    );
  }
  let result;
  if (normalized.skill_id === "SYSTEM_MAPPER") {
    result = buildSystemMapperResult({
      require_approved_proposal: true,
      proposal_status: normalized.proposal_status,
      approval: { status: normalized.proposal_status }
    });
  } else if (normalized.skill_id === "SELF_WORKER_AUDITOR") {
    result = buildSelfWorkerAuditorResult({
      require_approved_proposal: true,
      proposal_status: normalized.proposal_status,
      approval: { status: normalized.proposal_status }
    });
  } else {
    return _blocked(
      "SKILL_RUNNER_NOT_IMPLEMENTED",
      `Runner para ${normalized.skill_id} ainda nao implementado.`,
      null,
      normalized,
      409
    );
  }
  if (!result || typeof result !== "object") {
    return _blocked(
      "INVALID_SKILL_RESULT",
      "Resultado de skill invalido.",
      null,
      normalized,
      500
    );
  }
  if (registryEntry.side_effects_allowed !== true && result.side_effects !== false) {
    return _blocked(
      "SIDE_EFFECT_VIOLATION",
      "Skill retornou side_effects fora da allowlist.",
      { expected: false, received: result.side_effects },
      normalized,
      409
    );
  }
  const run_id = _buildRunId(context);
  return {
    ok: true,
    status_code: 200,
    run_id,
    executed: true,
    side_effects: false,
    result,
    evidence: {
      skill_id: normalized.skill_id,
      proposal_id: normalized.proposal_id,
      status: normalized.proposal_status,
      registry: {
        executable: registryEntry.executable === true,
        requires_approval: registryEntry.requires_approval === true,
        module: registryEntry.module,
        source: registryEntry.source
      },
      blocked: false
    }
  };
}
__name(runRegisteredSkill, "runRegisteredSkill");

// schema/learning-candidates.js
var KV_PREFIX2 = "learning:candidate:";
var KV_INDEX_KEY4 = "learning:candidate:index";
function _candidateKey(id) {
  return `${KV_PREFIX2}${id}`;
}
__name(_candidateKey, "_candidateKey");
async function _readIndex4(env) {
  const raw = await env.ENAVIA_BRAIN.get(KV_INDEX_KEY4);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (_e) {
    return [];
  }
}
__name(_readIndex4, "_readIndex");
async function _writeIndex3(index, env) {
  await env.ENAVIA_BRAIN.put(KV_INDEX_KEY4, JSON.stringify(index));
}
__name(_writeIndex3, "_writeIndex");
var CANDIDATE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected"
};
async function registerLearningCandidate(candidate, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!candidate || typeof candidate !== "object") {
    return { ok: false, error: "candidate must be a plain object" };
  }
  if (!candidate.title || typeof candidate.title !== "string" || !candidate.title.trim()) {
    return { ok: false, error: "candidate.title is required and must be a non-empty string" };
  }
  if (!candidate.content_structured || typeof candidate.content_structured !== "object" || Array.isArray(candidate.content_structured)) {
    return { ok: false, error: "candidate.content_structured is required and must be a plain object" };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const id = candidate.candidate_id || "lc-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const existing = await env.ENAVIA_BRAIN.get(_candidateKey(id));
  if (existing !== null) {
    return { ok: false, error: `candidate_id '${id}' already exists` };
  }
  const record = {
    candidate_id: id,
    title: candidate.title.trim(),
    content_structured: candidate.content_structured,
    source: typeof candidate.source === "string" ? candidate.source : "unknown",
    confidence: candidate.confidence || "medium",
    priority: candidate.priority || "medium",
    tags: Array.isArray(candidate.tags) ? candidate.tags : [],
    status: CANDIDATE_STATUS.PENDING,
    created_at: now,
    updated_at: now,
    approved_at: null,
    rejected_at: null,
    rejection_reason: null,
    promoted_memory_id: null
  };
  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(record));
  const index = await _readIndex4(env);
  if (!index.includes(id)) {
    index.push(id);
    await _writeIndex3(index, env);
  }
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.CANDIDATE_REGISTERED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id: id,
      source: record.source || "system",
      summary: `Candidato de aprendizado registrado: ${record.title}`
    }, env);
  } catch (_e) {
  }
  return { ok: true, candidate_id: id, record };
}
__name(registerLearningCandidate, "registerLearningCandidate");
async function listLearningCandidates(env, filters) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  const f = filters && typeof filters === "object" ? filters : {};
  const ids = await _readIndex4(env);
  const items = [];
  for (const id of ids) {
    const raw = await env.ENAVIA_BRAIN.get(_candidateKey(id));
    if (!raw) continue;
    try {
      const record = JSON.parse(raw);
      if (f.status && record.status !== f.status) continue;
      items.push(record);
    } catch (_e) {
    }
  }
  items.sort((a, b) => {
    if (a.status === CANDIDATE_STATUS.PENDING && b.status !== CANDIDATE_STATUS.PENDING) return -1;
    if (b.status === CANDIDATE_STATUS.PENDING && a.status !== CANDIDATE_STATUS.PENDING) return 1;
    const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
    const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
    return dateB - dateA;
  });
  return { ok: true, items, count: items.length };
}
__name(listLearningCandidates, "listLearningCandidates");
async function getLearningCandidateById(id, env) {
  if (!env || !env.ENAVIA_BRAIN || !id) return null;
  const raw = await env.ENAVIA_BRAIN.get(_candidateKey(id));
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (_e) {
    return null;
  }
}
__name(getLearningCandidateById, "getLearningCandidateById");
async function approveLearningCandidate(id, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!id) {
    return { ok: false, error: "candidate_id is required" };
  }
  const candidate = await getLearningCandidateById(id, env);
  if (!candidate) {
    return { ok: false, error: `candidate '${id}' not found` };
  }
  if (candidate.status !== CANDIDATE_STATUS.PENDING) {
    return { ok: false, error: `candidate '${id}' is not pending (status: ${candidate.status})` };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const memoryId = "av-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
  const memObj = buildMemoryObject({
    memory_id: memoryId,
    memory_type: MEMORY_TYPES.APRENDIZADO_VALIDADO,
    entity_type: ENTITY_TYPES.RULE,
    entity_id: memoryId,
    title: candidate.title,
    content_structured: candidate.content_structured,
    priority: candidate.priority || MEMORY_PRIORITY.MEDIUM,
    confidence: MEMORY_CONFIDENCE.CONFIRMED,
    source: "learning_approved",
    created_at: now,
    updated_at: now,
    expires_at: null,
    is_canonical: false,
    status: MEMORY_STATUS.ACTIVE,
    flags: [],
    tags: Array.isArray(candidate.tags) ? [...candidate.tags, "pr5", "learning_approved"] : ["pr5", "learning_approved"]
  });
  const validation = validateMemoryObject(memObj);
  if (!validation.valid) {
    return { ok: false, error: "promoted memory failed schema validation", errors: validation.errors };
  }
  const writeResult = await writeMemory(memObj, env);
  if (!writeResult.ok) {
    return { ok: false, error: `failed to write promoted memory: ${writeResult.error}` };
  }
  candidate.status = CANDIDATE_STATUS.APPROVED;
  candidate.approved_at = now;
  candidate.updated_at = now;
  candidate.promoted_memory_id = memoryId;
  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(candidate));
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.CANDIDATE_APPROVED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id: id,
      related_id: memoryId,
      source: "learning_approved",
      summary: `Candidato aprovado: ${candidate.title} \u2192 mem\xF3ria promovida: ${memoryId}`
    }, env);
  } catch (_e) {
  }
  return {
    ok: true,
    candidate_id: id,
    promoted_memory_id: memoryId,
    candidate,
    memory: memObj
  };
}
__name(approveLearningCandidate, "approveLearningCandidate");
async function rejectLearningCandidate(id, reason, env) {
  if (!env || !env.ENAVIA_BRAIN) {
    return { ok: false, error: "env.ENAVIA_BRAIN binding is required" };
  }
  if (!id) {
    return { ok: false, error: "candidate_id is required" };
  }
  const candidate = await getLearningCandidateById(id, env);
  if (!candidate) {
    return { ok: false, error: `candidate '${id}' not found` };
  }
  if (candidate.status !== CANDIDATE_STATUS.PENDING) {
    return { ok: false, error: `candidate '${id}' is not pending (status: ${candidate.status})` };
  }
  const now = (/* @__PURE__ */ new Date()).toISOString();
  candidate.status = CANDIDATE_STATUS.REJECTED;
  candidate.rejected_at = now;
  candidate.updated_at = now;
  candidate.rejection_reason = typeof reason === "string" && reason.trim() ? reason.trim() : null;
  await env.ENAVIA_BRAIN.put(_candidateKey(id), JSON.stringify(candidate));
  try {
    await emitAuditEvent({
      event_type: AUDIT_EVENT_TYPES.CANDIDATE_REJECTED,
      target_type: AUDIT_TARGET_TYPES.LEARNING_CANDIDATE,
      target_id: id,
      source: "learning_rejected",
      summary: `Candidato rejeitado: ${candidate.title}${candidate.rejection_reason ? ` \u2014 motivo: ${candidate.rejection_reason}` : ""}`
    }, env);
  } catch (_e) {
  }
  return { ok: true, candidate_id: id, candidate };
}
__name(rejectLearningCandidate, "rejectLearningCandidate");

// nv-enavia.js
var import_enavia_github_adapter = __toESM(require_enavia_github_adapter());
var _executeGithubBridgeRequest = import_enavia_github_adapter.default && typeof import_enavia_github_adapter.default.executeGithubBridgeRequest === "function" ? import_enavia_github_adapter.default.executeGithubBridgeRequest : null;
// PR109-PROVA: ciclo de autoevolução verificado — 2026-05-05
var ENAVIA_BUILD = {
  id: "ENAVIA_PR4_2026-04",
  deployed_at: "2026-04-26T00:00:00Z",
  source: "deploy-worker"
};
var NV_INDEX_CACHE = null;
var NV_MODULE_CACHE = {};
var NV_BRAIN_READY = false;
var NV_LAST_LOAD = null;
var DEBUG_MAX_EVENTS = 50;
var DEBUG_EVENTS = [];
var DEBUG_COUNTER = 0;
function recordDebugEvent(kind, detail) {
  try {
    const evt = {
      id: ++DEBUG_COUNTER,
      kind,
      ts: Date.now(),
      iso: (/* @__PURE__ */ new Date()).toISOString(),
      detail: detail || null
    };
    DEBUG_EVENTS.push(evt);
    if (DEBUG_EVENTS.length > DEBUG_MAX_EVENTS) {
      DEBUG_EVENTS.shift();
    }
  } catch (err) {
    try {
      logNV("\u274C ULTRA-DEBUG falhou ao registrar evento:", String(err));
    } catch (_e) {
    }
  }
}
__name(recordDebugEvent, "recordDebugEvent");
function snapshotDebugState(env) {
  let modulesKeys = [];
  try {
    modulesKeys = Object.keys(NV_MODULE_CACHE || {});
  } catch (_e) {
  }
  let indexModules = null;
  if (NV_INDEX_CACHE && Array.isArray(NV_INDEX_CACHE.modules)) {
    indexModules = NV_INDEX_CACHE.modules.map((m) => m.name || m.key || m);
  }
  return {
    debug_counter: DEBUG_COUNTER,
    recent_events: DEBUG_EVENTS,
    index: {
      loaded: NV_INDEX_CACHE !== null,
      last_load: NV_LAST_LOAD,
      modules_from_index: indexModules
    },
    cache: {
      modules_in_cache: modulesKeys.length,
      modules_keys: modulesKeys
    },
    bindings: {
      has_executor_binding: !!(env && env.EXECUTOR)
    },
    env: {
      mode: env && env.ENAVIA_MODE || "supervised"
    }
  };
}
__name(snapshotDebugState, "snapshotDebugState");
var NV_ACTIVE_LOADS = 0;
var NV_LOAD_QUEUE = [];
function queueModuleLoad(taskFn) {
  return new Promise((resolve, reject) => {
    NV_LOAD_QUEUE.push({ taskFn, resolve, reject });
    runNextLoad();
  });
}
__name(queueModuleLoad, "queueModuleLoad");
function runNextLoad() {
  if (NV_ACTIVE_LOADS >= 3) return;
  const next = NV_LOAD_QUEUE.shift();
  if (!next) return;
  NV_ACTIVE_LOADS++;
  next.taskFn().then((result) => {
    NV_ACTIVE_LOADS--;
    next.resolve(result);
    runNextLoad();
  }).catch((err) => {
    NV_ACTIVE_LOADS--;
    next.reject(err);
    runNextLoad();
  });
}
__name(runNextLoad, "runNextLoad");
function logNV(...args) {
  console.log("[ENAVIA]", ...args);
}
__name(logNV, "logNV");
function jsonResponse(data, status = 200) {
  return withCORS(
    new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" }
    })
  );
}
__name(jsonResponse, "jsonResponse");
function safeId(prefix = "id") {
  return prefix + "-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 8);
}
__name(safeId, "safeId");
function normalizePatchForExecutor(rawBody) {
  if (!rawBody || typeof rawBody !== "object") return rawBody;
  if (!rawBody.patch || typeof rawBody.patch !== "object") {
    return rawBody;
  }
  const outerPatch = rawBody.patch;
  const isAlreadyValid = typeof outerPatch.mode === "string" && (Array.isArray(outerPatch.patchText) || typeof outerPatch.code === "string" || typeof outerPatch.candidate === "string");
  if (isAlreadyValid) {
    return rawBody;
  }
  if (outerPatch.patch && typeof outerPatch.patch === "object" && (typeof outerPatch.patch.mode === "string" || Array.isArray(outerPatch.patch.patchText) || typeof outerPatch.patch.code === "string" || typeof outerPatch.patch.candidate === "string")) {
    return {
      ...rawBody,
      patch: outerPatch.patch
    };
  }
  return rawBody;
}
__name(normalizePatchForExecutor, "normalizePatchForExecutor");
var AUTO_ACTIONS = {
  "recarregar \xEDndice": {
    action: "reload_index",
    description: "For\xE7a recarregamento do nv_index.json sem reiniciar o Worker."
  },
  "listar m\xF3dulos": {
    action: "list_modules",
    description: "Retorna a lista atual de m\xF3dulos carregados via INDEX."
  },
  "estado do c\xE9rebro": {
    action: "debug_brain",
    description: "Retorna o status interno do NV-FIRST (cache, index, m\xF3dulos)."
  },
  "carregar m\xF3dulos": {
    action: "debug_load",
    description: "For\xE7a carregamento de m\xF3dulos reais via fila (3 simult\xE2neos)."
  },
  "/mostrar-system": {
    action: "show_system_prompt",
    description: "Retorna o conte\xFAdo atual do SYSTEM_PROMPT carregado do KV."
  }
};
function buildStorageURL(env, path) {
  const base = env.SUPABASE_URL.replace(/\/+$/, "");
  const bucket = env.SUPABASE_BUCKET.replace(/^\/|\/$/g, "");
  const cleanPath = path.replace(/^\/+/, "");
  const finalURL = `${base}/storage/v1/object/public/${bucket}/${encodeURI(
    cleanPath
  )}?download=1`;
  logNV("URL Supabase gerada:", finalURL);
  return finalURL;
}
__name(buildStorageURL, "buildStorageURL");
function flattenIndex(rawIndex) {
  const flat = [];
  if (!rawIndex || typeof rawIndex !== "object") return flat;
  for (const [moduleName, moduleGroup] of Object.entries(rawIndex)) {
    if (moduleGroup && typeof moduleGroup === "object") {
      for (const [subKey, path] of Object.entries(moduleGroup)) {
        const finalKey = `${moduleName}-${subKey}`;
        flat.push({
          name: finalKey,
          key: finalKey,
          path,
          tags: "",
          description: ""
        });
      }
    }
  }
  return flat;
}
__name(flattenIndex, "flattenIndex");
async function loadIndex(env) {
  try {
    if (NV_INDEX_CACHE) return NV_INDEX_CACHE;
    const indexURL = buildStorageURL(env, "nv_index.json");
    logNV("Carregando INDEX NV-FIRST:", indexURL);
    const res = await fetch(indexURL);
    if (!res.ok) {
      throw new Error(`Falha ao carregar nv_index.json \u2192 HTTP ${res.status}`);
    }
    const json = await res.json();
    const flatModules = flattenIndex(json);
    json.modules = flatModules;
    NV_INDEX_CACHE = json;
    NV_LAST_LOAD = Date.now();
    logNV(
      `INDEX carregado: ${flatModules.length} m\xF3dulos dispon\xEDveis ap\xF3s flatten.`
    );
    return json;
  } catch (err) {
    logNV("\u274C ERRO loadIndex():", err);
    throw err;
  }
}
__name(loadIndex, "loadIndex");
async function loadModule(env, path) {
  return queueModuleLoad(async () => {
    try {
      if (NV_MODULE_CACHE[path]) {
        logNV(`(CACHE) M\xF3dulo j\xE1 carregado: ${path}`);
        return NV_MODULE_CACHE[path];
      }
      const moduleURL = buildStorageURL(env, path);
      logNV("Carregando m\xF3dulo NV-FIRST:", moduleURL);
      const res = await fetch(moduleURL);
      if (!res.ok) {
        throw new Error(`Falha ao carregar m\xF3dulo ${path} \u2192 HTTP ${res.status}`);
      }
      const text = await res.text();
      NV_MODULE_CACHE[path] = text;
      logNV(`\u2714 M\xF3dulo carregado: ${path}`);
      return text;
    } catch (err) {
      logNV("\u274C ERRO loadModule():", path, err);
      throw err;
    }
  });
}
__name(loadModule, "loadModule");
async function buildBrain(env) {
  try {
    let getDirectorMemory2 = function(options = {}) {
      if (!globalThis.NV_MEMORY?.strategic) {
        return "";
      }
      const {
        limit = 3,
        // quantas memórias retornar
        order = "recent"
        // future-proof
      } = options;
      const entries = Object.entries(globalThis.NV_MEMORY.strategic);
      const selected = order === "recent" ? entries.slice(-limit) : entries.slice(0, limit);
      return selected.map(([key, value]) => `

[MEMORY:${key}]
${value}`).join("").trim();
    }, getOperationalMemory = function() {
      if (!globalThis.NV_MEMORY?.operational) {
        return {};
      }
      return { ...globalThis.NV_MEMORY.operational };
    }, detectDirectorMemoryIntent2 = function(text = "") {
      const t = text.toLowerCase();
      const signals = [
        "decidimos que",
        "a partir de agora",
        "fica definido",
        "regra oficial",
        "n\xE3o vamos mais",
        "sempre deve",
        "nunca deve",
        "padr\xE3o oficial",
        "decis\xE3o estrat\xE9gica"
      ];
      if (!signals.some((s) => t.includes(s))) {
        return null;
      }
      return {
        type: "director_memory_candidate",
        content: text.trim(),
        source: "conversation",
        confidence: "medium"
      };
    }, evaluateMemoryQuality2 = function(text) {
      const t = text.trim();
      let score = 0;
      if (t.length > 60) score += 1;
      if (t.length > 200) score += 1;
      if (t.includes(".") || t.includes(";")) score += 1;
      if (t.includes(":") || t.includes(" - ")) score += 1;
      const positiveSignals = [
        "como",
        "porque",
        "estrat\xE9gia",
        "t\xE9cnica",
        "passo",
        "exemplo",
        "cliente",
        "obje\xE7\xE3o",
        "financiamento",
        "resolver"
      ];
      if (positiveSignals.some((w) => t.toLowerCase().includes(w))) {
        score += 2;
      }
      if (t.length < 40) score -= 1;
      if (t.split(" ").length < 6) score -= 1;
      if (score < -2) score = -2;
      if (score > 6) score = 6;
      return score;
    };
    __name(getDirectorMemory2, "getDirectorMemory");
    __name(getOperationalMemory, "getOperationalMemory");
    __name(detectDirectorMemoryIntent2, "detectDirectorMemoryIntent");
    __name(evaluateMemoryQuality2, "evaluateMemoryQuality");
    if (NV_BRAIN_READY) {
      return {
        index: NV_INDEX_CACHE,
        modules: NV_MODULE_CACHE
      };
    }
    const index = await loadIndex(env);
    if (!index.modules) {
      throw new Error("INDEX inv\xE1lido \u2192 Campo 'modules' ausente.");
    }
    const systemPrompt = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
    if (systemPrompt) {
      NV_MODULE_CACHE["SYSTEM_PROMPT"] = systemPrompt;
      logNV("\u2714 SYSTEM_PROMPT carregado do KV.");
    } else {
      logNV("\u26A0\uFE0F SYSTEM_PROMPT ausente no KV.");
    }
    let _brainIndexRaw = null;
    try {
      _brainIndexRaw = await env.ENAVIA_BRAIN.get("brain:index");
      const storedIndex = _brainIndexRaw;
      const memoryKeys = storedIndex ? JSON.parse(storedIndex) : [];
      for (const key of memoryKeys) {
        const content = await env.ENAVIA_BRAIN.get(key);
        if (content) {
          NV_MODULE_CACHE[key] = content;
          logNV(`\u{1F9E0} Mem\xF3ria carregada no boot: ${key}`);
        }
      }
      logNV(`\u{1F9E0} Boot Memory Loader conclu\xEDdo (${memoryKeys.length} mem\xF3rias).`);
    } catch (err) {
      logNV("\u26A0\uFE0F Falha no Memory Loader (boot):", String(err));
    }
    const NV_MEMORY = {
      strategic: {},
      operational: {}
    };
    for (const [key, value] of Object.entries(NV_MODULE_CACHE)) {
      if (key.startsWith("director:memory") || key.startsWith("brain:decision") || key.startsWith("brain:policy")) {
        NV_MEMORY.strategic[key] = value;
        continue;
      }
      NV_MEMORY.operational[key] = value;
    }
    logNV(
      `\u{1F9E0} Memory classified \u2192 strategic: ${Object.keys(NV_MEMORY.strategic).length}, operational: ${Object.keys(NV_MEMORY.operational).length}`
    );
    globalThis.NV_MEMORY = NV_MEMORY;
    try {
      const storedIndex = _brainIndexRaw;
      const dynamicKeys = storedIndex ? JSON.parse(storedIndex) : [];
      for (const key of dynamicKeys) {
        const content = await env.ENAVIA_BRAIN.get(key);
        if (content) {
          NV_MODULE_CACHE[key] = content;
          logNV(`\u2714 Mem\xF3ria din\xE2mica carregada: ${key}`);
        }
      }
      logNV(`\u{1F9E0} Total de mem\xF3rias carregadas: ${dynamicKeys.length}`);
    } catch (err) {
      logNV("\u26A0\uFE0F ERRO ao carregar mem\xF3ria din\xE2mica:", String(err));
    }
    try {
      const autopatchPath = "FINAL_NV/M12-AUTOPATCHENGINE-V1.txt";
      const autopatchText = await loadModule(env, autopatchPath);
      if (autopatchText) {
        NV_MODULE_CACHE[autopatchPath] = autopatchText;
        logNV("\u2714 M12-AUTOPATCHENGINE-V1 carregado no c\xE9rebro.");
      }
    } catch (e) {
      logNV("\u26A0\uFE0F N\xE3o foi poss\xEDvel carregar M12-AUTOPATCHENGINE-V1:", String(e));
    }
    NV_BRAIN_READY = true;
    NV_LAST_LOAD = Date.now();
    logNV("\u{1F9E0} C\xC9REBRO NV-FIRST inicializado com sucesso.");
    return {
      index: NV_INDEX_CACHE,
      modules: NV_MODULE_CACHE
    };
  } catch (err) {
    logNV("\u274C ERRO buildBrain():", err);
    throw err;
  }
}
__name(buildBrain, "buildBrain");
function parseAutoAction(text) {
  text = (text || "").toLowerCase();
  for (const key of Object.keys(AUTO_ACTIONS)) {
    if (text.includes(key.toLowerCase())) {
      return AUTO_ACTIONS[key];
    }
  }
  return null;
}
__name(parseAutoAction, "parseAutoAction");
function scoreMemoryRelevance(query, memoryText) {
  if (!query || !memoryText) return 0;
  const q = String(query).toLowerCase();
  const t = String(memoryText).toLowerCase();
  const tokenize = /* @__PURE__ */ __name((str) => str.split(/[^a-z0-9áéíóúâêôãõç]+/i).map((s) => s.trim()).filter((s) => s.length > 2), "tokenize");
  const stopwords = /* @__PURE__ */ new Set([
    "que",
    "com",
    "para",
    "por",
    "uma",
    "umas",
    "um",
    "uns",
    "de",
    "da",
    "do",
    "no",
    "na",
    "nos",
    "nas",
    "e",
    "ou",
    "mas",
    "se",
    "em",
    "ao",
    "aos",
    "os",
    "as",
    "j\xE1",
    "bem",
    "mais",
    "menos"
  ]);
  const qTokens = new Set(
    tokenize(q).filter((t2) => !stopwords.has(t2))
  );
  const mTokens = tokenize(t).filter((t2) => !stopwords.has(t2));
  let score = 0;
  for (const tok of mTokens) {
    if (qTokens.has(tok)) score++;
  }
  return score;
}
__name(scoreMemoryRelevance, "scoreMemoryRelevance");
function buildSystemPrompt(brain, userMessage) {
  const modules = brain?.modules || {};
  const baseSystem = modules["SYSTEM_PROMPT"] || `
Voc\xEA \xE9 a ENAVIA, engenheira NV-FIRST da NV Im\xF3veis.

Objetivo:
- Atuar como ENGENHEIRA DE SOFTWARE especializada em:
  \u2022 Cloudflare Workers
  \u2022 Supabase (banco + Storage)
  \u2022 Arquiteturas serverless e distribu\xEDdas
  \u2022 Manuten\xE7\xE3o e evolu\xE7\xE3o dos sistemas ENOVA e ENAVIA
  \u2022 Cria\xE7\xE3o e revis\xE3o de c\xF3digo (JavaScript/TypeScript, SQL, infra)

Regras:
- Seja extremamente t\xE9cnica, clara e direta.
- N\xE3o fa\xE7a mudan\xE7as destrutivas; prefira refatora\xE7\xF5es cir\xFArgicas.
- Quando sugerir altera\xE7\xE3o de c\xF3digo, SEMPRE mostre:
  1) trechos impactados
  2) explica\xE7\xE3o linha a linha do que mudou e por qu\xEA
  3) riscos e como reverter
- Sempre respeite as decis\xF5es de arquitetura existentes,
  a menos que sejam explicitamente marcadas como legacy/para revis\xE3o.
- AUDIT s\xF3 pode \u201Ccarimbar\u201D no Deploy Worker se tiver PROVA de leitura do worker-alvo e valida\xE7\xE3o de compatibilidade do patch.
- Prova m\xEDnima obrigat\xF3ria: context_proof (hash/assinaturas/trechos) + context_used=true (snapshot real) + audit.verdict + risk_level permitido.
- Se n\xE3o conseguir ler o alvo ou n\xE3o houver prova \u2192 responder \u201Cn\xE3o consigo auditar com seguran\xE7a\u201D e N\xC3O carimbar.
- PROPOSE pode sugerir em read-only, mas deve tamb\xE9m exigir leitura do alvo; sem leitura/prova \u2192 n\xE3o sugere.
`.trim();
  const extraPieces = [];
  const memoryEntries = Object.entries(modules).filter(
    ([key]) => key.startsWith("brain:train:")
  );
  if (memoryEntries.length > 0) {
    const scored = memoryEntries.map(([key, value]) => ({
      key,
      text: value,
      score: scoreMemoryRelevance(userMessage, value)
    })).sort((a, b) => b.score - a.score);
    let selected = scored.filter((m) => m.score > 0);
    if (selected.length === 0) {
      const last = memoryEntries.slice(-3);
      selected = last.map(([key, value]) => ({
        key,
        text: value,
        score: 0
      }));
    } else {
      selected = selected.slice(0, 6);
    }
    const memoryBlock = selected.map(
      (m, idx) => `MEM\xD3RIA #${idx + 1} (${m.key})
${m.text}`
    ).join("\n\n-----\n\n");
    extraPieces.push(
      "## \u{1F9E0} MEM\xD3RIAS RELEVANTES DA ENAVIA ##\n\n" + memoryBlock
    );
  }
  const MEMORY_TOPICS = {
    mcmv: ["mcmv", "minha casa minha vida", "programa habitacional"],
    vendas: ["venda", "fechamento", "obje\xE7\xE3o", "cliente", "negocia\xE7\xE3o"],
    emocional: ["medo", "emo\xE7\xE3o", "sentimento", "trava", "inseguran\xE7a"],
    tecnico: ["taxa", "financiamento", "cef", "subs\xEDdio", "entrada"],
    engenharia: [
      "worker",
      "executor",
      "rota",
      "endpoint",
      "cloudflare",
      "supabase",
      "nv-first",
      "enavia",
      "patch",
      "deploy",
      "script.js",
      "index.html",
      "async function",
      "export default",
      "fetch(request, env, ctx)"
    ]
  };
  function detectMemoryTopic2(txt) {
    txt = txt.toLowerCase();
    for (const topic in MEMORY_TOPICS) {
      for (const kw of MEMORY_TOPICS[topic]) {
        if (txt.includes(kw)) return topic;
      }
    }
    return "geral";
  }
  __name(detectMemoryTopic2, "detectMemoryTopic");
  function consolidateMemoryPieces2(pieces) {
    if (!pieces || pieces.length === 0) return "";
    let merged = pieces.join("\n\n---\n\n");
    merged = merged.replace(/\s{3,}/g, "\n\n");
    const finalSummary = `Resumo consolidado (${pieces.length} pe\xE7as):

` + merged + "\n\n---\n\nEsses pontos acima representam o n\xFAcleo do aprendizado ENAVIA sobre este tema.";
    return finalSummary;
  }
  __name(consolidateMemoryPieces2, "consolidateMemoryPieces");
  const autopatchPath = "FINAL_NV/M12-AUTOPATCHENGINE-V1.txt";
  if (modules[autopatchPath]) {
    extraPieces.push(
      "M12-AUTOPATCHENGINE-V1\n\n" + modules[autopatchPath]
    );
  }
  const extra = extraPieces.join("\n\n-----\n\n");
  if (!extra) return baseSystem;
  return `${baseSystem}

----- CONTEXTO NV-FIRST -----

${extra}`;
}
__name(buildSystemPrompt, "buildSystemPrompt");
function buildMessages(brain, userMessage) {
  const systemPrompt = buildSystemPrompt(brain, userMessage);
  const messages = [
    {
      role: "system",
      content: systemPrompt
    },
    {
      role: "user",
      content: userMessage
    }
  ];
  return messages;
}
__name(buildMessages, "buildMessages");
var _LLM_CALL_TIMEOUT_MS = 25e3;
var _LLM_FALLBACK_MODEL = "gpt-4.1-mini";
async function _callModelOnce(model, apiKey, body, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ ...body, model }),
      signal: controller.signal
    });
    return res;
  } finally {
    clearTimeout(timer);
  }
}
__name(_callModelOnce, "_callModelOnce");
async function callChatModel(env, messages, options = {}) {
  const apiKey = env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY n\xE3o configurada no Worker ENAVIA NV-FIRST.");
  }
  const primaryModel = env.OPENAI_MODEL || env.NV_OPENAI_MODEL || "gpt-4.1-mini";
  const body = {
    messages,
    temperature: options.temperature ?? 0.2,
    max_completion_tokens: options.max_completion_tokens ?? options.max_tokens ?? 1600,
    top_p: options.top_p ?? 1,
    // response_format is forwarded when set (e.g. { type: "json_object" } for
    // structured output). Omitted entirely when not provided to stay compatible
    // with model versions that do not support the parameter.
    ...options.response_format ? { response_format: options.response_format } : {}
  };
  logNV("\u{1F501} Chamando modelo:", primaryModel);
  let res;
  try {
    res = await _callModelOnce(primaryModel, apiKey, body, _LLM_CALL_TIMEOUT_MS);
  } catch (fetchErr) {
    if (fetchErr?.name === "AbortError") {
      throw new Error(
        `[TIMEOUT] Chamada ao modelo LLM expirou ap\xF3s ${_LLM_CALL_TIMEOUT_MS / 1e3}s (modelo: ${primaryModel}).`
      );
    }
    throw new Error(
      `[NETWORK] Falha de rede na chamada ao modelo LLM (modelo: ${primaryModel}): ${String(fetchErr)}`
    );
  }
  if (!res.ok) {
    let shouldFallback = false;
    if (primaryModel !== _LLM_FALLBACK_MODEL) {
      if (res.status === 404) {
        shouldFallback = true;
      } else if (res.status === 400) {
        const snippet = (await res.clone().text().catch(() => "")).slice(0, 500).toLowerCase();
        shouldFallback = snippet.includes("model");
      }
    }
    if (shouldFallback) {
      logNV(`\u26A0\uFE0F Modelo '${primaryModel}' indispon\xEDvel (HTTP ${res.status}) \u2014 tentando fallback '${_LLM_FALLBACK_MODEL}'`);
      try {
        res = await _callModelOnce(_LLM_FALLBACK_MODEL, apiKey, body, _LLM_CALL_TIMEOUT_MS);
      } catch (fallbackErr) {
        if (fallbackErr?.name === "AbortError") {
          throw new Error(
            `[TIMEOUT] Chamada ao modelo fallback '${_LLM_FALLBACK_MODEL}' expirou ap\xF3s ${_LLM_CALL_TIMEOUT_MS / 1e3}s.`
          );
        }
        throw new Error(
          `[NETWORK] Falha de rede na chamada ao modelo fallback '${_LLM_FALLBACK_MODEL}': ${String(fallbackErr)}`
        );
      }
    }
  }
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    logNV("\u274C Erro na chamada ao modelo:", res.status, detail.slice(0, 400));
    throw new Error(
      `[HTTP_${res.status}] Falha na chamada ao modelo (modelo: ${primaryModel}) \u2192 HTTP ${res.status} \u2014 ${detail.slice(0, 400)}`
    );
  }
  let data;
  try {
    data = await res.json();
  } catch (jsonErr) {
    throw new Error(
      `[INVALID_JSON] Resposta do modelo n\xE3o \xE9 JSON v\xE1lido (modelo: ${primaryModel}): ${String(jsonErr)}`
    );
  }
  const choice = data.choices?.[0];
  if (!choice) {
    const finishReason = data.choices?.length === 0 ? "choices array vazio" : "choices ausente";
    logNV("\u26A0\uFE0F Modelo retornou choices vazio/ausente:", { finishReason, model: primaryModel });
    throw new Error(
      `[EMPTY_RESPONSE] Modelo retornou resposta sem choices utiliz\xE1veis (modelo: ${primaryModel}, motivo: ${finishReason}).`
    );
  }
  const content = choice?.message?.content ?? "";
  if (!content) {
    const finishReason = choice?.finish_reason || "desconhecido";
    logNV("\u26A0\uFE0F Modelo retornou content vazio:", { finishReason, model: primaryModel });
    throw new Error(
      `[EMPTY_CONTENT] Modelo retornou content vazio (modelo: ${primaryModel}, finish_reason: ${finishReason}). Poss\xEDvel filtro de conte\xFAdo.`
    );
  }
  logNV("\u2714 Resposta do modelo recebida com sucesso.");
  return {
    raw: data,
    text: content
  };
}
__name(callChatModel, "callChatModel");
async function handleChatRequest(request, env, ctx) {
  const method = request.method;
  const reqId = safeId("req");
  const envMode = (env.ENAVIA_MODE || "supervised").toLowerCase();
  const url = new URL(request.url);
  const path = url.pathname;
  let raw = await request.json().catch(() => ({}));
  const baseTelemetry = {
    req_id: reqId,
    source: "NV-FIRST",
    env_mode: envMode,
    timestamp: Date.now(),
    path
  };
  try {
    const userMessage = raw?.message || raw?.prompt || raw?.input || "";
    const learningSignals = [
      "aprendizado",
      "aprendizados",
      "li\xE7\xF5es",
      "o que aprendemos",
      "o que aprender",
      "analise seu pr\xF3prio",
      "autoan\xE1lise",
      "auto an\xE1lise",
      "reflex\xE3o",
      "refletir",
      "avaliar decis\xF5es",
      "li\xE7\xF5es aprendidas",
      "pontos de melhoria",
      "melhorias conceituais"
    ];
    const lowerMsg = userMessage.toLowerCase();
    const isLearningIntent = learningSignals.some((s) => lowerMsg.includes(s)) && !lowerMsg.includes("deploy") && !lowerMsg.includes("patch") && !lowerMsg.includes("executor");
    if (isLearningIntent) {
      logNV("\u{1F9E0} [LEARNING:MODE] Pedido cognitivo detectado.", { reqId });
      const brain2 = await buildBrain(env);
      const messages2 = buildMessages(brain2, userMessage);
      const result2 = await callChatModel(env, messages2, {
        temperature: 0.3,
        max_tokens: 1200
      });
      recordDebugEvent("learning_mode", {
        reqId,
        preview: userMessage.slice(0, 120)
      });
      return withCORS(
        jsonResponse({
          ok: true,
          mode: "learning",
          output: result2.text,
          telemetry: {
            ...baseTelemetry,
            stage: "learning"
          }
        })
      );
    }
    if (!userMessage || !userMessage.trim()) {
      logNV("\u26A0\uFE0F [CHAT:EMPTY]", { reqId });
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Mensagem vazia. Envie { "message": "..." }',
            telemetry: { ...baseTelemetry, stage: "chat" }
          },
          400
        )
      );
    }
    logNV("\u{1F4E5} [CHAT:IN]", {
      reqId,
      envMode,
      preview: userMessage.slice(0, 200)
    });
    recordDebugEvent("chat_in", {
      reqId,
      envMode,
      preview: userMessage.slice(0, 120)
    });
    try {
      let payload = raw;
      if (typeof raw === "object" && typeof raw.message === "string") {
        const msg = raw.message.trim();
        if (msg.startsWith("{") && msg.endsWith("}")) {
          try {
            raw = JSON.parse(msg);
          } catch {
          }
        }
      }
      if (raw && typeof raw === "object" && raw.mode) {
        const SAFE = ["ping", "dump_executor"];
        const execAction = typeof raw.executor_action === "string" ? raw.executor_action.toLowerCase() : "";
        const msgText = typeof raw.message === "string" ? raw.message.toLowerCase() : "";
        const isDeployLike = execAction.includes("deploy") || msgText.includes("deploy") || msgText.includes("staging");
        if (SAFE.includes(raw.mode)) {
          logNV("\u{1F513} [BYPASS] Comando de sistema detectado \u2192 " + raw.mode, { reqId });
          const execResult = await nvSendToExecutor(env, {
            ...raw,
            reqId
          });
          recordDebugEvent("bypass_exec", {
            reqId,
            mode: raw.mode,
            executor_ok: !!execResult?.ok
          });
          return withCORS(
            jsonResponse({
              ok: true,
              bypass: true,
              mode: raw.mode,
              result: execResult,
              telemetry: { ...baseTelemetry, stage: "bypass" }
            })
          );
        }
        if (raw.mode === "engineer" && !isDeployLike) {
          logNV("\u{1F9E0} [ENG:MODE] Modo engenharia solicitado pelo console.", { reqId });
          const engResult = await nvEngineerBrain(
            msgText || "engenharia",
            env,
            { reqId }
          );
          return withCORS(
            jsonResponse({
              ok: true,
              mode: "engineering",
              result: engResult,
              telemetry: { ...baseTelemetry, stage: "engineering" }
            })
          );
        }
        if (raw.mode === "brain") {
          logNV("\u{1F9E0} [BRAIN:MODE] Treinamento recebido via painel.", { reqId });
          const trainingText = String(raw.message || raw.text || "").trim();
          if (!trainingText) {
            return withCORS(
              jsonResponse(
                {
                  ok: false,
                  mode: "brain",
                  error: "Nenhum conte\xFAdo de treinamento recebido.",
                  detail: "Envie um texto no modo BRAIN para ser aprendido."
                },
                400
              )
            );
          }
          const indexRaw = await env.ENAVIA_BRAIN.get("enaviaindex");
          const enaviaIndex = indexRaw ? JSON.parse(indexRaw) : null;
          const writeAllowed = enaviaIndex && enaviaIndex.write_permissions === true && raw.brain_write === true && typeof raw.module_id === "string";
          if (!writeAllowed) {
            return withCORS(
              jsonResponse(
                {
                  ok: true,
                  mode: "brain",
                  status: "read-only",
                  message: "Conte\xFAdo analisado em modo leitura. Nenhum treinamento foi salvo."
                },
                200
              )
            );
          }
          const ts = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
          const moduleKey = `enavia:${raw.module_id}:${ts}`;
          await env.ENAVIA_BRAIN.put(moduleKey, trainingText);
          return withCORS(
            jsonResponse(
              {
                ok: true,
                mode: "brain",
                status: "saved",
                module: raw.module_id,
                message: `M\xF3dulo ${raw.module_id} registrado com sucesso no c\xE9rebro.`
              },
              200
            )
          );
          async function consolidateAfterSave(env2, savedKey) {
            try {
              const rawText = await env2.ENAVIA_BRAIN.get(savedKey);
              if (!rawText) return;
              const topic = detectMemoryTopic(rawText);
              const list = await env2.ENAVIA_BRAIN.list();
              const topicPieces = [];
              for (const item of list.keys) {
                if (item.name.includes(`train:`)) {
                  const txt = await env2.ENAVIA_BRAIN.get(item.name);
                  if (txt && detectMemoryTopic(txt) === topic) {
                    topicPieces.push(txt);
                  }
                }
              }
              if (topicPieces.length === 0) return;
              const summary = consolidateMemoryPieces(topicPieces);
              const summaryKey = `summary:${topic}`;
              await env2.ENAVIA_BRAIN.put(summaryKey, summary);
              logNV(`\u{1F4D8} MEMORY V3 \u2192 Resumo atualizado: ${summaryKey}`);
            } catch (err) {
              logNV("\u274C Erro ao consolidar mem\xF3ria:", err);
            }
          }
          __name(consolidateAfterSave, "consolidateAfterSave");
          let index = [];
          try {
            const stored = await env.ENAVIA_BRAIN.get("brain:index");
            index = stored ? JSON.parse(stored) : [];
          } catch (e) {
            index = [];
          }
          index.push(moduleKey);
          await env.ENAVIA_BRAIN.put("brain:index", JSON.stringify(index));
          logNV("\u{1F9E0} [BRAIN:SAVED] M\xF3dulo salvo.", { moduleKey });
          const brainResponse = withCORS(
            jsonResponse({
              ok: true,
              mode: "brain",
              saved_as: moduleKey,
              total_dynamic_modules: index.length,
              message: "Treinamento salvo e integrado ao c\xE9rebro.",
              telemetry: {
                ...baseTelemetry,
                stage: "brain-save",
                saved: moduleKey,
                count: index.length
              }
            })
          );
          async function autoCleanMemory(env2) {
            try {
              const list = await env2.ENAVIA_BRAIN.list();
              const removals = [];
              for (const item of list.keys) {
                if (item.name.startsWith("brain:train:")) {
                  const txt = await env2.ENAVIA_BRAIN.get(item.name);
                  if (!txt) continue;
                  const score = evaluateMemoryQuality(txt);
                  if (score <= 0) {
                    removals.push(item.name);
                  }
                }
              }
              for (const key of removals) {
                await env2.ENAVIA_BRAIN.delete(key);
                logNV("\u{1F9F9} [MEMORY V4] Removido por qualidade baixa:", { key });
              }
            } catch (err) {
              logNV("\u26A0\uFE0F [MEMORY V4] Erro na limpeza:", String(err));
            }
          }
          __name(autoCleanMemory, "autoCleanMemory");
          try {
            logNV("\u{1F4D7} [MEMORY V3] Ciclo de aprendizagem conclu\xEDdo.", {
              saved: moduleKey,
              total: index.length
            });
          } catch (err) {
            logNV("\u26A0\uFE0F [MEMORY V3] Falha no hook final:", String(err));
          }
          try {
            ctx?.waitUntil?.(autoCleanMemory(env));
            logNV("\u{1F9F9} [MEMORY V4] Auto-curadoria acionada.");
          } catch (err) {
            logNV("\u26A0\uFE0F [MEMORY V4] Falha ao acionar auto-curadoria:", String(err));
          }
          try {
            const refinedKey = `refined:${moduleKey}`;
            const refineMessages = [
              {
                role: "system",
                content: "Voc\xEA \xE9 o m\xF3dulo de refinamento da ENAVIA. Sua tarefa \xE9 reescrever conte\xFAdos aprendidos, tornando-os mais claros, estruturados, t\xE9cnicos e \xFAteis para engenharia, vendas, obje\xE7\xF5es ou racioc\xEDnio estrat\xE9gico."
              },
              {
                role: "user",
                content: `Refine o seguinte conhecimento, torne mais \xFAtil e estruturado:

${trainingText}`
              }
            ];
            const refineRes = await callChatModel(env, refineMessages, {
              temperature: 0.4,
              max_tokens: 1200
            }).catch(() => null);
            if (refineRes?.text) {
              await env.ENAVIA_BRAIN.put(refinedKey, refineRes.text);
              logNV("\u2728 [MEMORY V5] Mem\xF3ria refinada salva:", refinedKey);
            } else {
              logNV("\u26A0\uFE0F [MEMORY V5] N\xE3o foi poss\xEDvel gerar vers\xE3o refinada.");
            }
          } catch (err) {
            logNV("\u274C [MEMORY V5] Erro no refinamento:", String(err));
          }
          return brainResponse;
        }
      }
    } catch (err) {
      logNV("\u274C [BYPASS:ERR]", { reqId, error: String(err) });
    }
    if (method === "POST" && path === "/vercel/patch") {
      try {
        const body = await request.json();
        logNV("\u{1F517} [VERCEL-PATCH] Requisi\xE7\xE3o recebida para simula\xE7\xE3o.", body);
        const vercelURL = env.VERCEL_EXECUTOR_URL;
        const vercelRes = await fetch(vercelURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body.patch || body)
        });
        const vercelJson = await vercelRes.json().catch(() => ({
          ok: false,
          error: "Resposta inv\xE1lida do executor Vercel"
        }));
        logNV("\u{1F6F0} [VERCEL-PATCH] Retorno do executor:", vercelJson);
        return withCORS(
          jsonResponse(
            {
              ok: true,
              route: "/vercel/patch",
              simulation: vercelJson,
              telemetry: {
                ...baseTelemetry,
                stage: "vercel-simulate",
                forward_to: vercelURL,
                status: vercelRes.status
              }
            },
            200
          )
        );
      } catch (err) {
        logNV("\u274C [VERCEL-PATCH] Falha ao encaminhar patch:", String(err));
        return withCORS(
          jsonResponse(
            {
              ok: false,
              error: "Falha ao encaminhar patch ao Executor Vercel.",
              detail: String(err)
            },
            500
          )
        );
      }
    }
    if (raw.mode === "deploy-vercel") {
      logNV("\u{1F680} [MODE:DEPLOY-VERCEL] Pedido recebido do painel.", raw);
      try {
        const vercelURL = env.VERCEL_EXECUTOR_URL;
        const forward = await fetch(vercelURL, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(raw.patch || {})
        });
        const out = await forward.json().catch(() => ({
          ok: false,
          error: "Resposta inv\xE1lida do executor-vercel"
        }));
        logNV("\u{1F4E1} [DEPLOY-VERCEL] Resposta do executor:", out);
        return withCORS(
          jsonResponse({
            ok: true,
            mode: "deploy-vercel",
            executor_response: out,
            telemetry: {
              ...baseTelemetry,
              stage: "deploy-vercel",
              to: vercelURL,
              http: forward.status
            }
          })
        );
      } catch (err) {
        logNV("\u274C [DEPLOY-VERCEL] Erro:", String(err));
        return withCORS(
          jsonResponse(
            {
              ok: false,
              mode: "deploy-vercel",
              error: "Erro ao falar com executor-vercel",
              detail: String(err)
            },
            500
          )
        );
      }
    }
    try {
      const rawMsg = userMessage.trim().toLowerCase();
      const isDebugBrain = rawMsg.includes("debug_brain") || rawMsg.includes("debug-brain") || rawMsg.includes("/debug_brain") || rawMsg.includes("/debug-brain") || rawMsg.includes("debug brain");
      const isDebugEvents = rawMsg.includes("debug-events") || rawMsg.includes("debug_logs") || rawMsg.includes("debug-logs") || rawMsg.includes("debug events");
      if (isDebugBrain || isDebugEvents) {
        const sys = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
        const debugState = snapshotDebugState(env);
        recordDebugEvent(
          isDebugBrain ? "debug_brain" : "debug_events",
          {
            reqId,
            command: rawMsg
          }
        );
        return withCORS(
          jsonResponse({
            ok: true,
            autoAction: isDebugBrain ? "debug_brain" : "debug_events",
            systemPrompt: isDebugBrain ? sys || "(nenhum SYSTEM_PROMPT encontrado no KV)" : void 0,
            ultraDebug: debugState,
            telemetry: { ...baseTelemetry, stage: "auto_action" }
          })
        );
      }
    } catch (err) {
      logNV("\u274C [AUTO-ACTION:ERR]", { reqId, error: String(err) });
    }
    try {
      const deployResult = await nvApproveDeploy(userMessage, env, {
        reqId
      }).catch((err) => ({
        ok: false,
        error: String(err)
      }));
      if (deployResult) {
        const deployTelemetry = {
          ...baseTelemetry,
          stage: "deploy",
          deploy_session_id: deployResult.deploySessionId || null
        };
        if (deployResult.blocked) {
          logNV("\u26D4 [DEPLOY:BLOCKED]", {
            reqId,
            reason: deployResult.reason,
            code: deployResult.errorCode || null
          });
          recordDebugEvent("deploy_blocked", {
            reqId,
            reason: deployResult.reason,
            code: deployResult.errorCode || null
          });
          return withCORS(
            jsonResponse({
              ok: false,
              mode: "deploy",
              blocked: true,
              reason: deployResult.reason,
              telemetry: deployTelemetry
            })
          );
        }
        if (deployResult.ok && deployResult.deployed) {
          logNV("\u{1F680} [DEPLOY:OK]", {
            reqId,
            deploySessionId: deployResult.deploySessionId || null
          });
          recordDebugEvent("deploy_ok", {
            reqId,
            deploySessionId: deployResult.deploySessionId || null,
            executor_ok: !!(deployResult.executor && deployResult.executor.ok)
          });
          return withCORS(
            jsonResponse({
              ok: true,
              mode: "deploy",
              result: deployResult.executor || deployResult,
              deploy: {
                session_id: deployResult.deploySessionId || null,
                status: "apply_requested",
                last_action: "approve_default",
                patch_origin: "suggested",
                // padrão atual
                risk_level: deployResult.executor?.risk?.level || null
              },
              telemetry: deployTelemetry
            })
          );
        }
      }
    } catch (err) {
      logNV("\u274C [DEPLOY:HOOK_ERR]", { reqId, error: String(err) });
    }
    try {
      const lower = userMessage.toLowerCase();
      const engineeringKeywords = [
        "ajustar",
        "ajuste",
        "corrigir",
        "corre\xE7\xE3o",
        "alterar",
        "altera\xE7\xE3o",
        "modificar",
        "modifica\xE7\xE3o",
        "engenharia",
        "patch",
        "mexer",
        "editar",
        "reescrever",
        "modulo",
        "m\xF3dulo",
        "rota",
        "worker",
        "c\xF3digo",
        "codigo",
        "deploy",
        "staging",
        "refatorar"
      ];
      const shouldTriggerEngineering = engineeringKeywords.some(
        (k) => lower.includes(k)
      );
      if (shouldTriggerEngineering) {
        logNV("\u2699\uFE0F [ENG:HOOK] ativado.", { reqId });
        const engResult = await nvEngineerBrain(userMessage, env, {
          reqId
        }).catch((err) => ({
          ok: false,
          error: String(err)
        }));
        const engTelemetry = {
          ...baseTelemetry,
          stage: "engineering",
          deploy_session_id: engResult?.deploySessionId || null
        };
        if (engResult?.blocked) {
          logNV("\u26D4 [ENG:BLOCKED]", {
            reqId,
            protectedHits: engResult.protectedHits || []
          });
          recordDebugEvent("engineer_blocked", {
            reqId,
            protectedHits: engResult.protectedHits || []
          });
          return withCORS(
            jsonResponse({
              ok: false,
              mode: "engineering",
              blocked: true,
              reason: engResult.reason,
              protectedHits: engResult.protectedHits || [],
              telemetry: engTelemetry
            })
          );
        }
        if (engResult?.ok) {
          const executorResult = engResult.executor || {};
          logNV("\u2705 [ENG:OK]", {
            reqId,
            deploySessionId: engResult.deploySessionId || null
          });
          recordDebugEvent("engineer_ok", {
            reqId,
            deploySessionId: engResult.deploySessionId || null,
            executor_ok: !!executorResult?.ok,
            has_staging: !!executorResult?.staging?.ready
          });
          const deploySummary = {
            session_id: engResult.deploySessionId || null,
            executor_ok: !!executorResult?.ok,
            staging_ready: !!executorResult?.staging?.ready
          };
          return withCORS(
            jsonResponse({
              ok: true,
              mode: "engineering",
              result: executorResult,
              deploy: deploySummary,
              telemetry: engTelemetry
            })
          );
        }
        recordDebugEvent("engineer_noop", {
          reqId,
          raw: engResult
        });
        return withCORS(
          jsonResponse({
            ok: false,
            mode: "engineering",
            error: engResult?.error || "Nenhuma a\xE7\xE3o de engenharia foi executada ou retornou resultado \xFAtil.",
            telemetry: engTelemetry
          })
        );
        logNV("\u2139\uFE0F [ENG:NO_RESULT] Seguindo para chat normal.", {
          reqId
        });
      }
    } catch (err) {
      logNV("\u274C [ENG:HOOK_ERR]", { reqId, error: String(err) });
      recordDebugEvent("chat_error", {
        reqId,
        error: String(err)
      });
      return withCORS(
        jsonResponse({
          ok: false,
          mode: "engineering",
          error: "Falha interna durante processamento de engenharia.",
          detail: String(err),
          telemetry: {
            ...baseTelemetry,
            stage: "chat_error"
          }
        })
      );
    }
    const auto = parseAutoAction(userMessage);
    if (auto) {
      logNV("\u2699\uFE0F AUTO-ACTION acionada:", auto.action);
      switch (auto.action) {
        case "reload_index":
          await handleReloadRequest(env);
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              message: "INDEX recarregado automaticamente.",
              telemetry: { ...baseTelemetry, stage: "auto_action" }
            })
          );
        case "list_modules":
          await loadIndex(env);
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              modules: NV_INDEX_CACHE?.modules || [],
              telemetry: { ...baseTelemetry, stage: "auto_action" }
            })
          );
        case "debug_brain":
          return handleDebugBrain(env);
        // Permitir também debug-brain com hífen
        case "debug-brain":
          return handleDebugBrain(env);
        case "debug_load":
          return withCORS(
            jsonResponse({
              ok: false,
              autoAction: "debug_load",
              error: "Para carregar m\xF3dulos: enviar POST /debug-load com { modules: [...] }",
              telemetry: { ...baseTelemetry, stage: "auto_action" }
            })
          );
        case "show_system_prompt": {
          const sys = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
          return withCORS(
            jsonResponse({
              ok: true,
              autoAction: auto.action,
              systemPrompt: sys || "(nenhum SYSTEM_PROMPT encontrado no KV)",
              telemetry: { ...baseTelemetry, stage: "auto_action" }
            })
          );
        }
      }
    }
    const brain = await buildBrain(env);
    const messages = buildMessages(brain, userMessage);
    let directorMemory = "";
    try {
      directorMemory = getDirectorMemory({ limit: 3 });
    } catch (err) {
      logNV("\u26A0\uFE0F Director memory unavailable:", String(err));
    }
    if (directorMemory) {
      messages.unshift({
        role: "system",
        content: `
======================================================================
MEM\xD3RIA ESTRAT\xC9GICA DO DIRECTOR
======================================================================

${directorMemory}

Use esta mem\xF3ria para manter coer\xEAncia hist\xF3rica.
N\xE3o repita decis\xF5es j\xE1 tomadas.
Nunca viole D02 ou D06.
`.trim()
      });
    }
    let pendingDirectorMemory = null;
    try {
      pendingDirectorMemory = detectDirectorMemoryIntent(userMessage);
    } catch (err) {
      logNV("\u26A0\uFE0F Director memory intent detection failed:", String(err));
    }
    const result = await callChatModel(env, messages, {
      temperature: 0.2,
      max_tokens: 1600
    });
    logNV("\u2705 [CHAT:OK]", { reqId });
    recordDebugEvent("chat_ok", {
      reqId,
      envMode
    });
    return withCORS(
      jsonResponse({
        ok: true,
        system: "ENAVIA-NV-FIRST",
        timestamp: Date.now(),
        input: userMessage,
        output: result.text,
        telemetry: { ...baseTelemetry, stage: "chat" }
      })
    );
  } catch (err) {
    logNV("\u274C [CHAT:FATAL_ERR] handleChatRequest():", {
      reqId,
      error: String(err)
    });
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna no handler de chat NV-ENAVIA.",
          detail: String(err),
          telemetry: { ...baseTelemetry, stage: "chat_error" }
        },
        500
      )
    );
  }
}
__name(handleChatRequest, "handleChatRequest");
async function handleEngineerRequest(request, env) {
  try {
    if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
      return withCORS(jsonResponse(
        {
          ok: false,
          error: "Service Binding EXECUTOR n\xE3o configurado no NV-FIRST."
        },
        500
      ));
    }
    logNV("\u{1F517} [ENAVIA] Usando Service Binding EXECUTOR para chamar o executor.");
    let body = {};
    try {
      body = await request.json();
    } catch {
      return withCORS(jsonResponse(
        { ok: false, error: "JSON inv\xE1lido no corpo da requisi\xE7\xE3o /engineer." },
        400
      ));
    }
    logNV("\u{1F9EA} DEBUG body recebido do chat:", JSON.stringify(body, null, 2));
    logNV("\u{1F527} [ENGINEER:REQUEST_BODY]", {
      raw: body,
      method: request.method,
      ts: Date.now()
    });
    if (!body.patch && typeof body.message === "string") {
      body.patch = body.message;
      logNV("\u{1F504} Compatibilidade: 'message' \u2192 'patch'");
    }
    if (body.patch && typeof body.patch === "object" && typeof body.patch.content === "string") {
      body.patch = body.patch.content;
      logNV("\u{1F504} Compatibilidade: 'patch.content' \u2192 'patch' (string)");
    }
    if (!body.patch || typeof body.patch !== "string") {
      if (body.action) {
        logNV("\u{1F501} /engineer \u2192 a\xE7\xE3o direta:", body.action);
        const minimalPayload = { action: body.action };
        if (body.bridge_id != null) minimalPayload.bridge_id = body.bridge_id;
        if (body.session_id != null) minimalPayload.session_id = body.session_id;
        const passthroughKeys = [
          "mode",
          "executor_action",
          "execution_id",
          "executionId",
          "contract_id",
          "contractId",
          "plan",
          "force_step_id",
          "forceStepId",
          "target",
          "context",
          "candidate_hash",
          "candidateHash"
        ];
        for (const k of passthroughKeys) {
          if (body[k] !== void 0) minimalPayload[k] = body[k];
        }
        logNV("\u{1F680} [ENGINEER\u2192EXECUTOR] payload (a\xE7\xE3o direta)", {
          payload: minimalPayload,
          via: "ServiceBinding",
          ts: Date.now()
        });
        const executorRes = await env.EXECUTOR.fetch("https://executor", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(minimalPayload)
        });
        const executorBody = await executorRes.text();
        logNV("\u{1F4E1} EXECUTOR (a\xE7\xE3o direta):", {
          status: executorRes.status,
          preview: executorBody.slice(0, 300)
        });
        return withCORS(
          new Response(executorBody, {
            status: executorRes.status,
            headers: {
              "Content-Type": executorRes.headers.get("Content-Type") || "application/json"
            }
          })
        );
      }
      logNV("\u{1F501} /engineer \u2192 proxy 1:1 para executor...");
      logNV("\u{1F680} [ENGINEER\u2192EXECUTOR] payload (proxy 1:1)", {
        payload: body,
        via: "ServiceBinding",
        ts: Date.now()
      });
      const executorResProxy = await env.EXECUTOR.fetch("https://executor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      });
      const executorBodyProxy = await executorResProxy.text();
      logNV("\u{1F4E1} EXECUTOR (proxy):", {
        status: executorResProxy.status,
        preview: executorBodyProxy.slice(0, 300)
      });
      return withCORS(
        new Response(executorBodyProxy, {
          status: executorResProxy.status,
          headers: {
            "Content-Type": executorResProxy.headers.get("Content-Type") || "application/json"
          }
        })
      );
    }
    logNV("\u{1F6E0}\uFE0F PATCH \u2192 enviando ao executor...");
    logNV("\u{1F4DD} PATCH preview:", body.patch.slice(0, 200));
    logNV("\u{1F680} [ENGINEER\u2192EXECUTOR] payload (PATCH)", {
      payload: body,
      via: "ServiceBinding",
      ts: Date.now()
    });
    body = normalizePatchForExecutor(body);
    const executorResPatch = await env.EXECUTOR.fetch("https://executor", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const raw = await executorResPatch.text();
    if (!executorResPatch.ok) {
      return withCORS(jsonResponse(
        {
          ok: false,
          error: "Executor retornou erro.",
          code: executorResPatch.status,
          detail: raw,
          via: "ServiceBinding"
        },
        500
      ));
    }
    let parsed = raw;
    try {
      parsed = JSON.parse(raw);
    } catch {
      logNV("\u2139\uFE0F Executor retornou texto, n\xE3o JSON.");
    }
    return withCORS(jsonResponse(
      {
        ok: true,
        executor: parsed,
        via: "ServiceBinding"
      },
      200
    ));
  } catch (err) {
    logNV("\u274C Falha cr\xEDtica na rota /engineer:", err);
    return withCORS(jsonResponse(
      {
        ok: false,
        error: "Falha interna na rota /engineer.",
        detail: String(err)
      },
      500
    ));
  }
}
__name(handleEngineerRequest, "handleEngineerRequest");
async function handleDebugBrain(env) {
  return withCORS(jsonResponse(
    {
      ok: true,
      timestamp: Date.now(),
      index_loaded: NV_INDEX_CACHE !== null,
      system_prompt_loaded: !!(NV_MODULE_CACHE && NV_MODULE_CACHE["SYSTEM_PROMPT"]),
      modules_in_cache: Object.keys(NV_MODULE_CACHE || {}).length,
      modules: Object.keys(NV_MODULE_CACHE || {})
    },
    200
  ));
}
__name(handleDebugBrain, "handleDebugBrain");
async function handleDebugLoad(request, env) {
  const body = await request.json().catch(() => ({}));
  if (!body.modules || !Array.isArray(body.modules)) {
    return withCORS(jsonResponse(
      { ok: false, error: 'Envie: { "modules": ["M01-P01.txt", ...] }' },
      400
    ));
  }
  const results = [];
  for (const mod of body.modules) {
    try {
      const content = await loadModule(env, mod);
      results.push({
        module: mod,
        loaded: true,
        size: content.length
      });
    } catch (err) {
      results.push({
        module: mod,
        loaded: false,
        error: String(err?.message || err)
      });
    }
  }
  return withCORS(jsonResponse(
    {
      ok: true,
      timestamp: Date.now(),
      total_requested: body.modules.length,
      total_loaded: Object.keys(NV_MODULE_CACHE || {}).length,
      results
    },
    200
  ));
}
__name(handleDebugLoad, "handleDebugLoad");
async function handleEnaviaObserve(request, env) {
  try {
    if (request.method !== "POST") {
      return withCORS(
        jsonResponse(
          { ok: false, error: "M\xE9todo n\xE3o permitido" },
          405
        )
      );
    }
    const body = await request.json().catch(() => ({}));
    logNV("\u{1F441}\uFE0F [ENAVIA:OBSERVE]", {
      timestamp: Date.now(),
      source: body.source || "unknown",
      event: body.event || "unknown",
      runId: body.runId || null,
      step: body.step || null,
      payload: body.payload || null
    });
    return withCORS(
      jsonResponse({
        ok: true,
        mode: "observe",
        received: true,
        timestamp: Date.now()
      })
    );
  } catch (err) {
    logNV("\u274C [ENAVIA:OBSERVE:ERR]", String(err));
    return withCORS(
      jsonResponse(
        { ok: false, error: "Falha no observer" },
        500
      )
    );
  }
}
__name(handleEnaviaObserve, "handleEnaviaObserve");
async function handleReloadRequest(env) {
  try {
    logNV("\u{1F504} /reload acionado \u2014 limpando caches NV-FIRST...");
    NV_INDEX_CACHE = null;
    NV_MODULE_CACHE = {};
    NV_BRAIN_READY = false;
    NV_LAST_LOAD = null;
    NV_ACTIVE_LOADS = 0;
    NV_LOAD_QUEUE.length = 0;
    await loadIndex(env);
    logNV("\u2714 /reload conclu\xEDdo \u2014 INDEX recarregado, m\xF3dulos sob demanda.");
    return jsonResponse({
      ok: true,
      action: "reload",
      message: "INDEX recarregado com sucesso. M\xF3dulos ser\xE3o carregados sob demanda (m\xE1x. 3 simult\xE2neos).",
      timestamp: Date.now()
    });
  } catch (err) {
    logNV("\u274C ERRO handleReloadRequest():", err);
    return jsonResponse(
      {
        ok: false,
        error: "Falha interna ao recarregar o INDEX NV-FIRST.",
        detail: String(err)
      },
      500
    );
  }
}
__name(handleReloadRequest, "handleReloadRequest");
function handleCORSPreflight(request) {
  if (request.method !== "OPTIONS") return null;
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,POST,PATCH,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization, x-session-id",
      "Access-Control-Max-Age": "86400"
    }
  });
}
__name(handleCORSPreflight, "handleCORSPreflight");
function withCORS(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization, x-session-id");
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers
  });
}
__name(withCORS, "withCORS");
async function handleBrainQuery(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const rawQuery = body.query || body.topic || body.term || body.q || "";
    const query = String(rawQuery || "").trim();
    if (!query) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Envie { "query": "tema ou assunto" }'
          },
          400
        )
      );
    }
    const index = await loadIndex(env);
    const modules = Array.isArray(index.modules) ? index.modules : [];
    const q = query.toLowerCase();
    const scored = modules.map((mod, idx) => {
      const name = String(mod.name || mod.key || "").toLowerCase();
      const path = String(mod.path || mod.file || mod.key || "").toLowerCase();
      const tags = Array.isArray(mod.tags) ? mod.tags.join(" ").toLowerCase() : String(mod.tags || "").toLowerCase();
      const desc = String(mod.description || mod.desc || "").toLowerCase();
      let score = 0;
      if (name.includes(q)) score += 3;
      if (tags.includes(q)) score += 2;
      if (desc.includes(q)) score += 1;
      if (path.includes(q)) score += 1;
      if (!score && (name + " " + path + " " + tags + " " + desc).includes(q)) {
        score = 1;
      }
      return {
        idx,
        score,
        mod
      };
    }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score || a.idx - b.idx).slice(0, 3);
    const results = scored.map((entry) => {
      const m = entry.mod;
      return {
        name: m.name || m.key || null,
        key: m.key || null,
        path: m.path || m.file || null,
        tags: m.tags || null,
        description: m.description || m.desc || null,
        score: entry.score
      };
    });
    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain-query",
          query,
          total_modules: modules.length,
          results
        },
        200
      )
    );
  } catch (err) {
    logNV("\u274C ERRO handleBrainQuery():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain-query.",
          detail: String(err)
        },
        500
      )
    );
  }
}
__name(handleBrainQuery, "handleBrainQuery");
async function handleBrainGetModule(request, env) {
  try {
    const body = await request.json().catch(() => ({}));
    const file = body.file || body.path || body.key || "";
    const fileKey = String(file || "").trim();
    if (!fileKey) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: 'Envie { "file": "chave-ou-caminho-do-m\xF3dulo" }'
          },
          400
        )
      );
    }
    let content = null;
    let source = null;
    const looksLikePath = fileKey.includes("/") || fileKey.endsWith(".txt") || fileKey.endsWith(".json");
    if (looksLikePath) {
      content = await loadModule(env, fileKey);
      source = "storage";
    } else {
      content = await env.ENAVIA_BRAIN.get(fileKey);
      source = "kv";
      if (!content) {
        const index = await loadIndex(env);
        const mods = Array.isArray(index.modules) ? index.modules : [];
        const found = mods.find(
          (m) => m.key === fileKey || m.name === fileKey
        );
        if (found && (found.path || found.file)) {
          const path = found.path || found.file;
          content = await loadModule(env, path);
          source = "storage_from_index";
        }
      }
    }
    if (!content) {
      return withCORS(
        jsonResponse(
          {
            ok: false,
            error: "M\xF3dulo n\xE3o encontrado no KV nem no Storage.",
            file: fileKey
          },
          404
        )
      );
    }
    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain/get-module",
          file: fileKey,
          source,
          size: content.length,
          content
        },
        200
      )
    );
  } catch (err) {
    logNV("\u274C ERRO handleBrainGetModule():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain/get-module.",
          detail: String(err)
        },
        500
      )
    );
  }
}
__name(handleBrainGetModule, "handleBrainGetModule");
async function handleBrainIndex(request, env) {
  try {
    const index = await loadIndex(env);
    const modules = Array.isArray(index.modules) ? index.modules : [];
    return withCORS(
      jsonResponse(
        {
          ok: true,
          route: "/brain/index",
          total_modules: modules.length,
          index,
          cache: {
            last_load: NV_LAST_LOAD,
            brain_ready: NV_BRAIN_READY
          }
        },
        200
      )
    );
  } catch (err) {
    logNV("\u274C ERRO handleBrainIndex():", err);
    return withCORS(
      jsonResponse(
        {
          ok: false,
          error: "Falha interna em /brain/index.",
          detail: String(err)
        },
        500
      )
    );
  }
}
__name(handleBrainIndex, "handleBrainIndex");
async function nvSendToExecutor(env, payload, context = {}) {
  const reqId = context.reqId || payload?.reqId || safeId("req");
  const deploySessionId = context.deploySessionId || payload?.deploySessionId || null;
  const meta = {
    reqId,
    deploySessionId,
    mode: payload?.mode || null,
    action: payload?.action || null
  };
  try {
    logNV("\u{1F4E1} [EXECUTOR:REQ]", meta);
    const response = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    let json;
    try {
      json = await response.json();
    } catch (err) {
      logNV("\u274C [EXECUTOR:INVALID_JSON]", {
        ...meta,
        status: response.status,
        error: String(err)
      });
      return {
        ok: false,
        error: "EXECUTOR_INVALID_JSON",
        detail: String(err),
        status: response.status
      };
    }
    logNV("\u{1F4E1} [EXECUTOR:RES]", {
      ...meta,
      ok: json?.ok,
      keys: json && typeof json === "object" ? Object.keys(json) : []
    });
    return json;
  } catch (networkErr) {
    logNV("\u274C [EXECUTOR:NETWORK_FAILURE]", {
      ...meta,
      error: String(networkErr)
    });
    return {
      ok: false,
      error: "EXECUTOR_NETWORK_FAILURE",
      detail: String(networkErr)
    };
  }
}
__name(nvSendToExecutor, "nvSendToExecutor");
async function nvEngineerBrain(message, env, context = {}) {
  const lower = message.toLowerCase();
  const reqId = context.reqId || safeId("req");
  const deploySessionId = context.deploySessionId || safeId("ds");
  const isEngineering = lower.includes("patch") || lower.includes("corrigir") || lower.includes("ajustar") || lower.includes("modificar") || lower.includes("alterar") || lower.includes("melhorar") || lower.includes("engenharia");
  if (!isEngineering) return null;
  logNV("\u{1F9E0} [ENG:REQUEST]", { reqId, deploySessionId });
  const payload = {
    mode: "engineer",
    intent: message,
    askSuggestions: true,
    riskReport: true,
    preventForbidden: true,
    reqId,
    deploySessionId
  };
  const result = await nvSendToExecutor(env, payload, {
    reqId,
    deploySessionId
  });
  if (result?.risk?.protectedHits?.length > 0) {
    logNV("\u26D4 [ENG:FORBIDDEN]", {
      reqId,
      deploySessionId,
      protectedHits: result.risk.protectedHits
    });
    return {
      ok: false,
      blocked: true,
      reason: "Tentativa de alterar rota ou fun\xE7\xE3o cr\xEDtica.",
      protectedHits: result.risk.protectedHits,
      deploySessionId
    };
  }
  logNV("\u{1F9E0} [ENG:RESPONSE_OK]", {
    reqId,
    deploySessionId,
    ok: result?.ok
  });
  return {
    ok: true,
    executor: result,
    deploySessionId
  };
}
__name(nvEngineerBrain, "nvEngineerBrain");
async function nvApproveDeploy(message, env, context = {}) {
  const lower = message.toLowerCase();
  if (!lower.includes("aprovar deploy")) return null;
  const envMode = (env.ENAVIA_MODE || "supervised").toLowerCase();
  const reqId = context.reqId || safeId("req");
  const deploySessionId = context.deploySessionId || safeId("ds");
  logNV("\u{1F9E0} [DEPLOY:CMD] 'APROVAR DEPLOY' recebido.", {
    reqId,
    deploySessionId,
    envMode
  });
  if (envMode === "read-only") {
    logNV("\u26D4 [DEPLOY:BLOCK_MODE]", {
      reqId,
      deploySessionId,
      reason: "ENAVIA_MODE=read-only"
    });
    return {
      ok: false,
      deployed: false,
      blocked: true,
      reason: "ENAVIA_MODE=read-only: deploy desativado. Altere para 'supervised' para permitir APPLY.",
      deploySessionId,
      errorCode: "MODE_READ_ONLY"
    };
  }
  if (lower.includes("listar staging")) {
    const payload2 = { mode: "list_staging", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  if (lower.includes("descartar staging")) {
    const payload2 = { mode: "discard_staging", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  if (lower.includes("gerar diff")) {
    const payload2 = { mode: "generate_diff", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  if (lower.includes("mostrar patch")) {
    const payload2 = { mode: "show_patch", reqId, deploySessionId };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  if (lower.includes("simular deploy")) {
    const payload2 = {
      mode: "apply",
      dryRun: true,
      reqId,
      deploySessionId
    };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  if (lower.includes("aplicar patch agora")) {
    const payload2 = {
      mode: "apply",
      dryRun: false,
      reqId,
      deploySessionId
    };
    return await nvSendToExecutor(env, payload2, { reqId, deploySessionId });
  }
  const payload = {
    mode: "deploy_request",
    approve: true,
    approvedBy: "Vasques",
    reason: "Aprova\xE7\xE3o expl\xEDcita via NV-FIRST",
    reqId,
    deploySessionId
  };
  const result = await nvSendToExecutor(env, payload, {
    reqId,
    deploySessionId
  });
  logNV("\u{1F9E0} [DEPLOY:EXECUTOR_RES]", {
    reqId,
    deploySessionId,
    ok: result?.ok
  });
  return {
    ok: true,
    deployed: true,
    executor: result,
    deploySessionId
  };
}
__name(nvApproveDeploy, "nvApproveDeploy");
async function loadDirectorBrain(env) {
  const indexKey = "director:index";
  const indexRaw = await env.ENAVIA_BRAIN.get(indexKey);
  if (!indexRaw) {
    throw new Error("DIRECTOR_INDEX_NOT_FOUND");
  }
  const moduleKeys = indexRaw.split("\n").filter((line) => line.trim().startsWith("KEY:")).map((line) => line.replace("KEY:", "").trim());
  if (moduleKeys.length === 0) {
    throw new Error("NO_DIRECTOR_MODULES_FOUND");
  }
  const modules = [];
  for (const key of moduleKeys) {
    if (!key.startsWith("director:")) {
      throw new Error(`ACCESS_DENIED_INVALID_KEY ${key}`);
    }
    const content = await env.ENAVIA_BRAIN.get(key);
    if (!content) {
      throw new Error(`DIRECTOR_MODULE_NOT_FOUND ${key}`);
    }
    modules.push({
      key,
      content
    });
  }
  const merged = modules.map((m) => `### [${m.key}]
${m.content}`).join("\n\n");
  return {
    version: "v1.0",
    modules: modules.map((m) => m.key),
    content: merged
  };
}
__name(loadDirectorBrain, "loadDirectorBrain");
function _resolveOperatorIntent(context, rawMessage) {
  const intent = typeof context?.planner_brief?.operator_intent === "string" ? context.planner_brief.operator_intent.trim() : "";
  return {
    resolvedText: intent.length > 0 ? intent : rawMessage,
    objectiveSource: intent.length > 0 ? "planner_brief.operator_intent" : "body.message",
    hasPlannerBrief: intent.length > 0
  };
}
__name(_resolveOperatorIntent, "_resolveOperatorIntent");
async function handlePlannerRun(request, env) {
  const startedAt = Date.now();
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "JSON inv\xE1lido em /planner/run.", detail: String(err) },
      400
    );
  }
  if (!body || typeof body !== "object") body = {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonResponse(
      { ok: false, error: "'message' \xE9 obrigat\xF3rio e deve ser string n\xE3o vazia." },
      400
    );
  }
  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const context = body.context && typeof body.context === "object" ? body.context : {};
  try {
    let _p17Tier = function(mem) {
      if (mem.is_canonical === true || mem.memory_type === "canonical_rules") return _P17_TIER_CANONICAL;
      if (mem.memory_type === "live_context") return _P17_TIER_LIVE;
      if (mem.memory_type === "operational_history") return _P17_TIER_OPERATIONAL;
      return null;
    };
    __name(_p17Tier, "_p17Tier");
    let memReadRaw = { ok: false, error: "ENAVIA_BRAIN unavailable" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        memReadRaw = await searchRelevantMemory(context, env);
      } catch (memErr) {
        memReadRaw = { ok: false, error: String(memErr) };
      }
    }
    const memoryReadAudit = {
      consulted: memReadRaw.ok === true,
      count: memReadRaw.ok ? memReadRaw.count : 0,
      types: memReadRaw.ok ? [...new Set(memReadRaw.results.map((m) => m.memory_type))] : [],
      ...memReadRaw.ok ? {} : { error: memReadRaw.error }
    };
    const _P17_TIER_CANONICAL = "canonical";
    const _P17_TIER_LIVE = "live";
    const _P17_TIER_OPERATIONAL = "operational";
    const _P17_ORDER = [_P17_TIER_CANONICAL, _P17_TIER_LIVE, _P17_TIER_OPERATIONAL];
    const _p17Results = memReadRaw.ok ? memReadRaw.results : [];
    const _p17TypesByTier = { canonical: [], live: [], operational: [] };
    for (const mem of _p17Results) {
      const tier = _p17Tier(mem);
      if (tier && !_p17TypesByTier[tier].includes(mem.memory_type)) {
        _p17TypesByTier[tier].push(mem.memory_type);
      }
    }
    const _p17WinningTier = _P17_ORDER.find((t) => _p17TypesByTier[t].length > 0) || null;
    const priority_applied = {
      order: _P17_ORDER,
      types_by_tier: _p17TypesByTier,
      winning_tier: _p17WinningTier
    };
    const memory_context = {
      applied: memReadRaw.ok && memReadRaw.count > 0,
      count: memoryReadAudit.count,
      types: memoryReadAudit.types,
      priority_applied,
      // P17 — prioridade canônica de runtime explícita e auditável
      items: memReadRaw.ok ? memReadRaw.results.slice(0, 5).map((m) => ({
        memory_id: m.memory_id,
        title: m.title,
        memory_type: m.memory_type,
        is_canonical: m.is_canonical,
        priority: m.priority,
        content_text: m.content_structured?.text || null
        // conteúdo real para o pipeline PM4+
      })) : []
    };
    let retrievalResult = { ok: false, error: "retrieval skipped: ENAVIA_BRAIN binding not available" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        retrievalResult = await buildRetrievalContext(context, env);
      } catch (retErr) {
        retrievalResult = { ok: false, error: String(retErr) };
      }
    }
    const retrieval_context = buildRetrievalSummary(retrievalResult);
    const plannerContext = { ...context, memory_context, retrieval_context };
    const { resolvedText, objectiveSource, hasPlannerBrief } = _resolveOperatorIntent(context, message);
    const classification = classifyRequest({ text: resolvedText, context: plannerContext });
    const envelope = buildOutputEnvelope(classification, { text: resolvedText });
    const canonicalPlan = buildCanonicalPlan({
      classification,
      envelope,
      input: { text: resolvedText },
      planner_brief: context?.planner_brief ?? null
    });
    const gate = evaluateApprovalGate(canonicalPlan);
    const bridge = buildExecutorBridgePayload({ plan: canonicalPlan, gate });
    const memoryConsolidation = consolidateMemoryLearning({
      plan: canonicalPlan,
      gate,
      bridge
    });
    const consolidation_persisted = [];
    if (memoryConsolidation.should_consolidate && env && env.ENAVIA_BRAIN) {
      const cycleId = session_id || safeId("cycle");
      const nowIso = (/* @__PURE__ */ new Date()).toISOString();
      for (const candidate of memoryConsolidation.memory_candidates) {
        const memObj = buildMemoryObject({
          ...candidate,
          memory_id: crypto.randomUUID(),
          entity_type: ENTITY_TYPES.OPERATION,
          entity_id: cycleId,
          source: "planner_run",
          created_at: nowIso,
          updated_at: nowIso,
          expires_at: null,
          flags: []
        });
        let writeResult;
        try {
          writeResult = await writeMemory(memObj, env);
        } catch (kvErr) {
          logNV("\u26A0\uFE0F [P15] Falha ao persistir candidato PM9 (n\xE3o cr\xEDtico)", {
            memory_type: candidate.memory_type,
            error: String(kvErr)
          });
          writeResult = { ok: false, error: String(kvErr) };
        }
        consolidation_persisted.push({
          memory_id: memObj.memory_id,
          memory_type: memObj.memory_type,
          is_canonical: memObj.is_canonical,
          kv_key: `memory:${memObj.memory_id}`,
          write_ok: writeResult.ok === true,
          error: writeResult.ok ? void 0 : writeResult.error
        });
      }
      logNV("\u{1F9E0} [P15] Consolida\xE7\xE3o de mem\xF3ria persistida p\xF3s-ciclo", {
        candidates: consolidation_persisted.length,
        cycle_id: cycleId,
        results: consolidation_persisted
      });
    }
    const plannerPayload = {
      memoryContext: memory_context,
      retrievalContext: retrieval_context,
      // PR3 — separação explícita de blocos
      classification,
      canonicalPlan,
      gate,
      bridge,
      memoryConsolidation,
      outputMode: envelope.output_mode
    };
    if (session_id && env?.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put(
          `planner:latest:${session_id}`,
          JSON.stringify(plannerPayload),
          { expirationTtl: _PENDING_PLAN_TTL_SECONDS }
        );
        logNV("\u{1F4BE} [PLANNER/RUN] planner:latest salvo no KV", { session_id });
      } catch (kvErr) {
        logNV("\u26A0\uFE0F [PLANNER/RUN] Falha ao persistir planner:latest (n\xE3o cr\xEDtico)", {
          session_id,
          error: String(kvErr)
        });
      }
    }
    const _plannerMemApplied = memory_context.applied === true && memory_context.count > 0;
    const _plannerMemHits = _plannerMemApplied ? memory_context.items.map((m) => ({
      id: m.memory_id,
      title: m.title,
      type: m.memory_type,
      block: m.is_canonical ? "canonical" : m.memory_type
    })) : [];
    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      timestamp: Date.now(),
      input: message,
      memory_applied: _plannerMemApplied,
      memory_hits: _plannerMemHits,
      planner: plannerPayload,
      telemetry: {
        fix_active: "P-BRIEF-v2",
        // sentinel: confirms this worker has the P-BRIEF fix deployed
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: "PR3\u2192PM3\u2192PM4\u2192PM5\u2192PM6\u2192PM7\u2192PM8\u2192PM9\u2192P15",
        memory_read: memoryReadAudit,
        retrieval: retrieval_context,
        // PR3 — auditoria de retrieval
        consolidation_persisted,
        // P-BRIEF — objetivo auditável (telemetria de diagnóstico)
        has_planner_brief: hasPlannerBrief,
        objective_source: objectiveSource,
        raw_message: message,
        resolved_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
        canonical_plan_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
        // always shows what context.planner_brief.operator_intent actually contained when received;
        // null means the field was absent — use alongside objective_source to diagnose fallbacks
        planner_brief_operator_intent_preview: context?.planner_brief?.operator_intent != null ? String(context.planner_brief.operator_intent).slice(0, 120) : null,
        // P-BRIEF steps telemetry — auditável: origem dos steps e preview do primeiro
        steps_source: canonicalPlan.steps_source ?? "generic_fallback",
        planner_brief_used_for_steps: canonicalPlan.planner_brief_used_for_steps ?? false,
        steps_preview: Array.isArray(canonicalPlan.steps) && canonicalPlan.steps.length > 0 ? canonicalPlan.steps[0] : null
      }
    });
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        timestamp: Date.now(),
        error: "Falha no pipeline do planner.",
        detail: String(err),
        telemetry: {
          duration_ms: Date.now() - startedAt
        }
      },
      500
    );
  }
}
__name(handlePlannerRun, "handlePlannerRun");
async function handlePlannerLatest(request, env) {
  const url = new URL(request.url);
  const session_id = (url.searchParams.get("session_id") || "").trim();
  if (!session_id) {
    return jsonResponse({ ok: false, error: "session_id \xE9 obrigat\xF3rio." }, 400);
  }
  if (!env?.ENAVIA_BRAIN) {
    logNV("\u26A0\uFE0F [PLANNER/LATEST] ENAVIA_BRAIN indispon\xEDvel \u2014 retornando has_plan=false", { session_id });
    return jsonResponse({ ok: true, session_id, has_plan: false, plan: null });
  }
  let plannerPayload = null;
  try {
    plannerPayload = await env.ENAVIA_BRAIN.get(`planner:latest:${session_id}`, "json");
  } catch (kvErr) {
    logNV("\u26A0\uFE0F [PLANNER/LATEST] Erro ao buscar planner:latest do KV", {
      session_id,
      error: String(kvErr)
    });
    return jsonResponse(
      { ok: false, error: "Falha ao buscar plano.", detail: String(kvErr) },
      500
    );
  }
  if (!plannerPayload) {
    return jsonResponse({ ok: true, session_id, has_plan: false, plan: null });
  }
  return jsonResponse({ ok: true, session_id, has_plan: true, plan: plannerPayload });
}
__name(handlePlannerLatest, "handlePlannerLatest");
var _LLM_PARSE_MODE = {
  JSON_PARSED: "json_parsed",
  PLAIN_TEXT_FALLBACK: "plain_text_fallback",
  UNKNOWN: "unknown"
};
var _PLANNER_LEAK_PATTERNS = [
  /\bnext_action\s*[:=]/i,
  /\bplanner_snapshot\b/i,
  /\bcanonical_plan\b/i,
  /\bapproval_gate\b/i,
  /\bexecution_payload\b/i,
  /\bscope_summary\s*[:=]/i,
  /\bacceptance_criteria\s*[:=]/i,
  /\bplan_type\s*[:=]/i,
  /\bcomplexity_level\s*[:=]/i,
  /\boutput_mode\s*[:=]/i,
  /\bplan_version\s*[:=]/i,
  /\bneeds_human_approval\s*[:=]/i,
  /\bneeds_formal_contract\s*[:=]/i
];
var _PLANNER_LEAK_THRESHOLD = 4;
var _PLANNER_LEAK_STRUCTURAL_WINDOW = 200;
var _PLANNER_LEAK_STRUCTURAL_PATTERNS = [
  // Padrão JSON-like: aspas em torno de chaves operacionais conhecidas
  /"\s*(next_action|planner_snapshot|canonical_plan|approval_gate|execution_payload|acceptance_criteria|scope_summary|plan_type|complexity_level|output_mode)\s*"\s*:/i,
  // Bloco com chaves abertas + uma das chaves do planner (janela curta)
  new RegExp(
    "\\{[^}]{0," + _PLANNER_LEAK_STRUCTURAL_WINDOW + "}\\b(next_action|canonical_plan|approval_gate|execution_payload)\\b",
    "i"
  )
];
function _sanitizeChatReply(reply) {
  if (!reply || typeof reply !== "string") return reply;
  let leakCount = 0;
  for (const pattern of _PLANNER_LEAK_PATTERNS) {
    if (pattern.test(reply)) leakCount++;
  }
  const hasStructuralLeak = _PLANNER_LEAK_STRUCTURAL_PATTERNS.some((p) => p.test(reply));
  if (hasStructuralLeak || leakCount >= _PLANNER_LEAK_THRESHOLD) {
    return "Entendido. Estou com isso \u2014 pode continuar.";
  }
  return reply;
}
__name(_sanitizeChatReply, "_sanitizeChatReply");
var _MANUAL_PLAN_PATTERNS = [
  /\bFase\s+\d+/i,
  // Fase 1:, Fase 2, etc.
  /\bEtapa\s+\d+/i,
  // Etapa 1:, etc.
  /\bPasso\s+\d+/i,
  // Passo 1:, etc.
  /\bPhase\s+\d+/i,
  // Phase 1 (English)
  /\bStep\s+\d+/i,
  // Step 1 (English)
  /^#{1,3}\s+\w/m,
  // Markdown headers (##, ###)
  /\bCritérios de aceite\b/i,
  // acceptance criteria language
  /\bCriteria\b.*:/i
  // criteria: pattern
];
var _MANUAL_PLAN_THRESHOLD = 5;
var _MANUAL_PLAN_FALLBACK = "Entendido. J\xE1 organizei as etapas internamente \u2014 pode avan\xE7ar ou me dizer se quer ajustar algo.";
function _looksLikeNaturalProse(reply) {
  if (!reply || typeof reply !== "string") return false;
  if (reply.length < 200) return false;
  const sentences = (reply.match(/[.!?]\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇ]/g) || []).length;
  return sentences >= 3;
}
__name(_looksLikeNaturalProse, "_looksLikeNaturalProse");
function _isManualPlanReply(reply) {
  if (!reply || typeof reply !== "string") return false;
  if (_looksLikeNaturalProse(reply)) return false;
  let count = 0;
  for (const pattern of _MANUAL_PLAN_PATTERNS) {
    const flags = pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g";
    const globalPat = new RegExp(pattern.source, flags);
    const matches = reply.match(globalPat);
    if (matches) count += matches.length;
  }
  return count >= _MANUAL_PLAN_THRESHOLD;
}
__name(_isManualPlanReply, "_isManualPlanReply");
var _CHAT_BRIDGE_APPROVAL_TERMS = [
  "aprovado",
  "pode executar",
  "confirmo",
  "sim, execute",
  "execute agora",
  "go"
];
var _CHAT_BRIDGE_DANGEROUS_TERMS = [
  "deploy",
  "delete",
  "rm ",
  "drop",
  "prod",
  "produ\xE7\xE3o",
  "write",
  "patch",
  "post",
  "merge",
  "rollback"
];
var _PENDING_PLAN_TTL_SECONDS = 600;
async function _dispatchFromChat(env, pendingPlan) {
  const bridgeId = pendingPlan.bridge_id || safeId("bridge");
  const sessionId = pendingPlan.session_id || null;
  const ep = pendingPlan.bridge_executor_payload;
  logNV("\u{1F680} [CHAT/BRIDGE] Disparando executor a partir de aprova\xE7\xE3o no chat", {
    bridgeId,
    sessionId,
    source: ep?.source
  });
  let executorJson = null;
  let executorStatus = null;
  let executorOk = false;
  let networkError = null;
  try {
    const executorPayload = {
      action: "execute_plan",
      source: "chat_bridge",
      bridge_id: bridgeId,
      session_id: sessionId,
      executor_payload: ep
    };
    const executorRes = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executorPayload)
    });
    executorStatus = executorRes.status;
    executorOk = executorStatus >= 200 && executorStatus < 300;
    try {
      executorJson = await executorRes.json();
    } catch {
      executorJson = { ok: false, error: "EXECUTOR_INVALID_JSON" };
    }
    logNV("\u{1F680} [CHAT/BRIDGE] Resposta do executor", {
      bridgeId,
      executor_ok: executorOk,
      status: executorStatus
    });
  } catch (netErr) {
    networkError = String(netErr);
    logNV("\u{1F534} [CHAT/BRIDGE] Falha de rede ao chamar executor", {
      bridgeId,
      error: networkError
    });
  }
  const trail = {
    bridge_id: bridgeId,
    dispatched_at: (/* @__PURE__ */ new Date()).toISOString(),
    session_id: sessionId,
    source: ep?.source || "chat_bridge",
    steps_count: Array.isArray(ep?.steps) ? ep.steps.length : 0,
    executor_ok: executorOk,
    executor_status: executorStatus,
    executor_error: networkError ? "NETWORK_ERROR" : executorOk ? null : executorJson?.error ?? null
  };
  if (env.ENAVIA_BRAIN) {
    try {
      await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(trail));
      await env.ENAVIA_BRAIN.put(`execution:trail:${bridgeId}`, JSON.stringify(trail));
    } catch (kvErr) {
      logNV("\u26A0\uFE0F [CHAT/BRIDGE] Falha ao persistir trilha no KV (n\xE3o cr\xEDtico)", {
        bridgeId,
        error: String(kvErr)
      });
    }
  }
  if (networkError) {
    return { ok: false, bridge_id: bridgeId, executor_ok: false, error: "NETWORK_ERROR", detail: networkError };
  }
  return { ok: executorOk, bridge_id: bridgeId, executor_ok: executorOk, executor_response: executorJson };
}
__name(_dispatchFromChat, "_dispatchFromChat");
var _CHAT_OPERATIONAL_INTENT_TERMS = [
  "validar",
  "valida\xE7\xE3o",
  "worker",
  "plano",
  "executor",
  "execu\xE7\xE3o",
  "executar",
  "auditoria",
  "auditar",
  "deploy-worker",
  "deploy",
  "healthcheck",
  "health",
  "estado do contrato",
  "contrato ativo",
  "rota",
  "endpoint",
  "diagn\xF3stico",
  "diagnosticar",
  "logs",
  "erro",
  "branch",
  "merge",
  "rollback",
  "patch",
  "revisar pr",
  "revisar a pr",
  "review pr",
  "revise",
  "verifique",
  "cheque",
  "inspecione",
  "runtime",
  "gate",
  "gates",
  "produ\xE7\xE3o",
  "prod",
  "staging",
  "kv",
  "binding"
];
function isOperationalMessage(message, context) {
  if (typeof message !== "string" || message.length === 0) return false;
  try {
    const classification = classifyEnaviaIntent({ message, context });
    if (classification && typeof classification.is_operational === "boolean") {
      if (classification.is_operational) return true;
      if (classification.intent !== "unknown") return false;
    }
  } catch (_err) {
  }
  const lower = message.toLowerCase();
  return _CHAT_OPERATIONAL_INTENT_TERMS.some((t) => lower.includes(t));
}
__name(isOperationalMessage, "isOperationalMessage");
var _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS = [
  "validar",
  "sistema",
  "worker",
  "plano",
  "executor",
  "execu\xE7\xE3o",
  "auditoria",
  "deploy-worker",
  "healthcheck",
  "auditar"
];
async function handleChatLLM(request, env) {
  const startedAt = Date.now();
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      { ok: false, error: "JSON inv\xE1lido em /chat/run.", detail: String(err) },
      400
    );
  }
  if (!body || typeof body !== "object") body = {};
  const message = typeof body.message === "string" ? body.message.trim() : "";
  if (!message) {
    return jsonResponse(
      { ok: false, error: "'message' \xE9 obrigat\xF3rio e deve ser string n\xE3o vazia." },
      400
    );
  }
  const session_id = typeof body.session_id === "string" ? body.session_id.trim() : "";
  const context = body.context && typeof body.context === "object" ? body.context : {};
  const debugMode = body.debug === true;
  if (session_id && env.ENAVIA_BRAIN) {
    const normalizedMsg = message.toLowerCase();
    const hasApproval = _CHAT_BRIDGE_APPROVAL_TERMS.some((t) => normalizedMsg.includes(t));
    const hasDangerousTerm = _CHAT_BRIDGE_DANGEROUS_TERMS.some((t) => normalizedMsg.includes(t));
    if (hasApproval && hasDangerousTerm) {
      logNV("\u{1F6E1}\uFE0F [CHAT/BRIDGE] Aprova\xE7\xE3o bloqueada por termo perigoso", {
        session_id,
        message: message.slice(0, 80)
      });
    } else if (hasApproval) {
      const pendingKey = `chat:pending_plan:${session_id}`;
      let pendingPlan = null;
      try {
        pendingPlan = await env.ENAVIA_BRAIN.get(pendingKey, "json");
      } catch (kvErr) {
        logNV("\u26A0\uFE0F [CHAT/BRIDGE] Erro ao buscar pending_plan do KV", {
          session_id,
          error: String(kvErr)
        });
      }
      if (pendingPlan) {
        if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
          return jsonResponse({
            ok: false,
            system: "ENAVIA-NV-FIRST",
            mode: "llm-first",
            execution_dispatched: false,
            error: "EXECUTOR binding n\xE3o dispon\xEDvel para executar plano aprovado.",
            timestamp: Date.now(),
            telemetry: { duration_ms: Date.now() - startedAt, session_id, pipeline: "chat_bridge_approval" }
          }, 503);
        }
        try {
          await env.ENAVIA_BRAIN.delete(pendingKey);
        } catch {
        }
        const dispatchResult = await _dispatchFromChat(env, pendingPlan);
        return jsonResponse({
          ok: dispatchResult.ok,
          system: "ENAVIA-NV-FIRST",
          mode: "llm-first",
          execution_dispatched: true,
          bridge_id: dispatchResult.bridge_id,
          executor_ok: dispatchResult.executor_ok,
          ...dispatchResult.executor_response ? { executor_response: dispatchResult.executor_response } : {},
          ...dispatchResult.error ? { executor_error: dispatchResult.error } : {},
          reply: dispatchResult.ok ? "Plano aprovado. Execu\xE7\xE3o foi despachada para o executor." : `Aprova\xE7\xE3o recebida, mas houve falha ao chamar o executor: ${dispatchResult.error || "erro desconhecido"}.`,
          plan_summary: pendingPlan.plan_summary || null,
          timestamp: Date.now(),
          telemetry: {
            duration_ms: Date.now() - startedAt,
            session_id,
            pipeline: "chat_bridge_approval"
          }
        });
      }
      logNV("\u2139\uFE0F [CHAT/BRIDGE] Aprova\xE7\xE3o detectada mas sem pending_plan v\xE1lido", { session_id });
    }
  }
  const _PR5_MAX_HISTORY_MSGS = 20;
  const _PR5_MAX_HISTORY_CHARS = 4e3;
  let conversationHistory = [];
  if (Array.isArray(body.conversation_history)) {
    const validRoles = /* @__PURE__ */ new Set(["user", "assistant"]);
    let totalChars = 0;
    const rawHistory = body.conversation_history.slice(-_PR5_MAX_HISTORY_MSGS);
    for (const entry of rawHistory) {
      if (!entry || typeof entry !== "object") continue;
      const role = typeof entry.role === "string" ? entry.role.trim() : "";
      const content = typeof entry.content === "string" ? entry.content.trim() : "";
      if (!validRoles.has(role) || !content) continue;
      if (totalChars + content.length > _PR5_MAX_HISTORY_CHARS) break;
      totalChars += content.length;
      conversationHistory.push({ role, content });
    }
  }
  let pm4Arbitration = null;
  try {
    const pm4Classification = classifyRequest({ text: message, context });
    pm4Arbitration = {
      level: pm4Classification.complexity_level,
      category: pm4Classification.category,
      signals: pm4Classification.signals,
      allows_planner: pm4Classification.complexity_level !== "A"
    };
  } catch (pm4Err) {
    logNV("\u26A0\uFE0F [CHAT/LLM] PM4 pre-check falhou (n\xE3o cr\xEDtico)", { error: String(pm4Err) });
  }
  if (!env.OPENAI_API_KEY) {
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        mode: "llm-first",
        error: "Servi\xE7o LLM indispon\xEDvel: OPENAI_API_KEY n\xE3o configurada no worker.",
        timestamp: Date.now()
      },
      503
    );
  }
  const operationalAwareness = buildOperationalAwareness(env, {
    browserArmState: getBrowserArmState()
  });
  const _CHAT_BRIDGE_OPERATIONAL_TERMS = [
    "executar",
    "execu\xE7\xE3o",
    "executor",
    "deploy-worker",
    "healthcheck",
    "auditar",
    "validar",
    "plano operacional",
    "preparar execu\xE7\xE3o"
  ];
  const msgLower = message.toLowerCase();
  const pm4AllowsPlanner = pm4Arbitration ? pm4Arbitration.allows_planner : false;
  const hasOperationalIntent = _CHAT_BRIDGE_OPERATIONAL_TERMS.some((t) => msgLower.includes(t));
  const hasDangerousTermForOverride = _CHAT_BRIDGE_DANGEROUS_TERMS.some((t) => {
    const escaped = t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").trim();
    return new RegExp(escaped + "(?![\\w-])", "i").test(msgLower);
  });
  const operationalOverride = hasOperationalIntent && !hasDangerousTermForOverride;
  const shouldActivatePlanner = pm4AllowsPlanner || operationalOverride;
  const _chatTarget = context.target && typeof context.target === "object" ? context.target : null;
  const hasTarget = !!(_chatTarget && (_chatTarget.worker || _chatTarget.repo || _chatTarget.environment || _chatTarget.mode));
  let _intentClassification = null;
  try {
    _intentClassification = classifyEnaviaIntent({ message, context });
  } catch (_classifyErr) {
    _intentClassification = null;
  }
  let _skillRouting = null;
  try {
    _skillRouting = routeEnaviaSkill({
      message,
      intentClassification: _intentClassification || void 0,
      context
    });
  } catch (_routeErr) {
    _skillRouting = null;
  }
  let _intentRetrieval = null;
  try {
    _intentRetrieval = buildIntentRetrievalContext({
      message,
      intentClassification: _intentClassification || void 0,
      skillRouting: _skillRouting || void 0,
      context
    });
  } catch (_retrievalErr) {
    _intentRetrieval = null;
  }
  const isOperationalMessageLegacy = _CHAT_OPERATIONAL_CONTEXT_MSG_TERMS.some((t) => msgLower.includes(t));
  const hasOperationalMessageIntent = isOperationalMessage(message, context);
  const isOperationalContext = hasOperationalMessageIntent || isOperationalMessageLegacy;
  const operationalDefaultsUsed = isOperationalContext ? [
    ..._chatTarget?.mode === "read_only" ? ["read_only"] : [],
    "health_first",
    "no_deploy",
    "no_write",
    "approval_required"
  ] : [];
  const obviousQuestionsSuppressed = isOperationalContext && hasTarget;
  let _selfAudit = null;
  try {
    const _selfAuditResult = runEnaviaSelfAudit({
      message,
      context,
      intentClassification: _intentClassification || void 0,
      skillRouting: _skillRouting || void 0,
      intentRetrieval: _intentRetrieval || void 0,
      isOperationalContext
    });
    _selfAudit = _selfAuditResult?.self_audit ?? null;
  } catch (_selfAuditErr) {
    _selfAudit = null;
  }
  let _responsePolicy = null;
  try {
    _responsePolicy = buildEnaviaResponsePolicy({
      message,
      context,
      intentClassification: _intentClassification || void 0,
      skillRouting: _skillRouting || void 0,
      intentRetrieval: _intentRetrieval || void 0,
      selfAudit: _selfAudit || void 0,
      isOperationalContext
    });
  } catch (_responsePolicyErr) {
    _responsePolicy = null;
  }
  let _skillExecution = null;
  try {
    _skillExecution = buildSkillExecutionProposal({
      skillRouting: _skillRouting || void 0,
      intentClassification: _intentClassification || void 0,
      selfAudit: _selfAudit || void 0,
      responsePolicy: _responsePolicy || void 0,
      chatContext: context || void 0
    });
  } catch (_skillExecutionErr) {
    _skillExecution = null;
  }
  let _chatSkillSurface = null;
  try {
    _chatSkillSurface = buildChatSkillSurface({
      skillExecution: _skillExecution?.skill_execution
    });
  } catch (_chatSkillSurfaceErr) {
    _chatSkillSurface = null;
  }
  try {
    let chatRetrievalResult = { ok: false, error: "retrieval skipped: ENAVIA_BRAIN binding not available" };
    if (env && env.ENAVIA_BRAIN) {
      try {
        chatRetrievalResult = await buildRetrievalContext(context, env);
      } catch (retErr) {
        chatRetrievalResult = { ok: false, error: String(retErr) };
      }
    }
    const chatRetrievalSummary = buildRetrievalSummary(chatRetrievalResult);
    const ownerName = env.OWNER || "usu\xE1rio";
    const chatSystemPrompt = buildChatSystemPrompt({
      ownerName,
      context,
      operational_awareness: operationalAwareness,
      is_operational_context: isOperationalContext,
      intent_retrieval_context: _intentRetrieval || void 0,
      response_policy: _responsePolicy || void 0
    });
    const _pr3MemoryBlock = [];
    if (chatRetrievalSummary.applied && chatRetrievalSummary.total_memories_read > 0) {
      const _blocks = chatRetrievalResult.ok && chatRetrievalResult.blocks ? chatRetrievalResult.blocks : null;
      const _memLine = /* @__PURE__ */ __name((item, contentField, suffix = "") => {
        const txt = item.content_structured?.[contentField];
        return `  \u2022 ${item.title} (${item.memory_type})${suffix}${txt ? `
    \u2192 ${txt}` : ""}`;
      }, "_memLine");
      const parts = [];
      const _vlItems = _blocks ? _blocks.validated_learning.items : chatRetrievalSummary.validated_learning.items;
      if (_vlItems.length > 0) {
        parts.push(`[APRENDIZADO VALIDADO \u2014 ${_vlItems.length} item(s)]`);
        for (const item of _vlItems) parts.push(_memLine(item, "text"));
      }
      const _miItems = _blocks ? _blocks.manual_instructions.items : chatRetrievalSummary.manual_instructions.items;
      if (_miItems.length > 0) {
        parts.push(`[INSTRU\xC7\xD5ES MANUAIS \u2014 ${_miItems.length} item(s)]`);
        for (const item of _miItems) parts.push(_memLine(item, "text"));
      }
      const _hmItems = _blocks ? _blocks.historical_memory.items : chatRetrievalSummary.historical_memory.items;
      const _hmRefCount = _blocks ? _blocks.historical_memory.reference_only_count : chatRetrievalSummary.historical_memory.reference_only_count;
      if (_hmItems.length > 0) {
        parts.push(`[MEM\xD3RIA HIST\xD3RICA \u2014 ${_hmItems.length} item(s), ${_hmRefCount} refer\xEAncia apenas]`);
        for (const item of _hmItems) {
          const isRef = item._pr3_is_reference ?? item.is_reference ?? false;
          parts.push(
            isRef ? _memLine(item, "summary", " (REFER\xCANCIA HIST\xD3RICA \u2014 n\xE3o usar como verdade)") : _memLine(item, "text")
          );
        }
      }
      if (parts.length > 0) {
        const memBlockContent = isOperationalContext ? [
          "MEM\xD3RIA RECUPERADA (PR3) \u2014 MODO OPERACIONAL:",
          "Estas mem\xF3rias s\xE3o regras operacionais ativas para esta resposta.",
          "Instru\xE7\xF5es manuais e aprendizado validado t\xEAm peso de regra preferencial \u2014 aplique-as diretamente para influenciar sua resposta e decis\xE3o.",
          "Nunca apenas liste ou explique as mem\xF3rias: use-as para agir.",
          "S\xF3 ignore uma mem\xF3ria se ela for claramente irrelevante para a inten\xE7\xE3o atual.",
          "Itens marcados como REFER\xCANCIA HIST\xD3RICA s\xE3o apenas auxiliares.",
          ...parts
        ].join("\n") : [
          "MEM\xD3RIA RECUPERADA (PR3):",
          "Regra: contexto atual prevalece sobre mem\xF3ria antiga. Itens marcados como REFER\xCANCIA HIST\xD3RICA s\xE3o apenas auxiliares.",
          ...parts
        ].join("\n");
        _pr3MemoryBlock.push({ role: "system", content: memBlockContent });
      }
    }
    const _operationalContextBlock = [];
    if (hasTarget && isOperationalContext) {
      const _tgt = _chatTarget;
      const targetDesc = [
        _tgt.worker ? `worker: ${_tgt.worker}` : null,
        _tgt.repo ? `repo: ${_tgt.repo}` : null,
        _tgt.branch ? `branch: ${_tgt.branch}` : null,
        _tgt.environment ? `environment: ${_tgt.environment}` : null,
        _tgt.mode ? `mode: ${_tgt.mode}` : null
      ].filter(Boolean).join(" | ");
      const memActive = chatRetrievalSummary.applied && chatRetrievalSummary.total_memories_read > 0;
      const memNote = memActive ? `
MEM\xD3RIA ATIVA (${chatRetrievalSummary.total_memories_read} item(s)): instru\xE7\xE3o manual e aprendizado validado aplicam-se como regra operacional. Siga prefer\xEAncias de read_only, aprova\xE7\xE3o e seguran\xE7a se presentes.` : "";
      const readOnlyNote = _tgt.mode === "read_only" ? "\nModo atual: read_only. A\xE7\xF5es com efeito colateral (deploy, patch, merge, push, escrita) est\xE3o bloqueadas sem aprova\xE7\xE3o/contrato. Isto \xE9 gate de execu\xE7\xE3o, n\xE3o regra de tom: voc\xEA continua livre para conversar, opinar, sugerir, discordar, explicar e planejar." : "";
      _operationalContextBlock.push({
        role: "system",
        content: `INSTRU\xC7\xC3O OPERACIONAL PARA ESTA RESPOSTA:
Alvo ativo confirmado: ${targetDesc}.
O operador fez uma pergunta operacional. Voc\xEA CONHECE o alvo acima \u2014 n\xE3o pergunte qual sistema, worker ou ambiente.

FORMATO OBRIGAT\xD3RIO PARA RESPOSTA OPERACIONAL:
Resposta deve ser OBJETIVA, PR\xC1TICA e ACION\xC1VEL \u2014 n\xE3o um artigo ou explica\xE7\xE3o longa.
\u2022 Comece diretamente com a a\xE7\xE3o recomendada \u2014 sem introdu\xE7\xE3o longa.
\u2022 Use at\xE9 7 passos numerados. Cada passo come\xE7a com verbo de a\xE7\xE3o (ex: "testar", "verificar", "conferir").
\u2022 Finalize com uma pr\xF3xima a\xE7\xE3o clara e objetiva (ex: "Pr\xF3ximo passo: posso montar os comandos para esse teste.").
\u2022 Se precisar perguntar algo, pergunte no m\xE1ximo 1 coisa bloqueante \u2014 nunca perguntas gen\xE9ricas de contexto.
\u2022 Sem markdown headers (##, ###). Sem "Fase 1/2/3". Sem categorias conceituais desnecess\xE1rias.

RESOLU\xC7\xC3O DE AMBIGUIDADE \u2014 REGRA OBRIGAT\xD3RIA:
Quando o operador usar termos gen\xE9ricos como "o sistema", "o worker", "o ambiente" ou "o projeto" e houver target ativo, resolva imediatamente para o target confirmado acima.
N\xC3O pergunte "voc\xEA quer dizer nv-enavia ou outro sistema?" \u2014 a resposta \xE9 sempre o target ativo.
Se quiser confirmar, use: "Vou assumir o target atual (${_tgt.worker || _tgt.repo || "target ativo"}); me corrija se quiser outro alvo."

PRIORIDADE DE DECIS\xC3O \u2014 siga esta ordem antes de responder:
1. Interprete a inten\xE7\xE3o do operador.
2. Cruze com o contexto operacional (alvo acima).
3. Cruze com as mem\xF3rias recuperadas (se presentes): trate-as como instru\xE7\xF5es ou prefer\xEAncias ativas, n\xE3o como informa\xE7\xE3o descritiva.
4. S\xF3 pergunte algo se faltar informa\xE7\xE3o ESSENCIAL para executar a a\xE7\xE3o \u2014 nunca para entender o contexto (que j\xE1 foi fornecido).
Evite perguntas gen\xE9ricas quando o contexto ou a mem\xF3ria j\xE1 fornecem a base necess\xE1ria.` + readOnlyNote + memNote
      });
    }
    const llmMessages = [
      { role: "system", content: chatSystemPrompt },
      ..._pr3MemoryBlock,
      ...conversationHistory,
      ..._operationalContextBlock,
      { role: "user", content: message }
    ];
    const CHAT_LLM_MAX_TOKENS = 1600;
    const llmResult = await callChatModel(env, llmMessages, {
      // Temperature 0.6 (up from 0.5): slightly more creative for natural conversation
      // while still constrained enough for coherent, on-topic replies.
      temperature: 0.6,
      max_tokens: CHAT_LLM_MAX_TOKENS
    });
    const _sanitization = { applied: false, layer: null, reason: null };
    let reply = "";
    let wantsPlan = false;
    let llmParseMode = _LLM_PARSE_MODE.UNKNOWN;
    try {
      const parsed = JSON.parse(llmResult.text);
      reply = typeof parsed.reply === "string" && parsed.reply.length > 0 ? parsed.reply : llmResult.text;
      wantsPlan = parsed.use_planner === true;
      llmParseMode = _LLM_PARSE_MODE.JSON_PARSED;
    } catch {
      const _rawText = llmResult.text;
      if (!_rawText || _rawText.length === 0) {
        reply = "Instru\xE7\xE3o recebida.";
        _sanitization.applied = true;
        _sanitization.layer = "plain_text_fallback";
        _sanitization.reason = "llm_empty_text";
      } else {
        reply = _rawText;
      }
      wantsPlan = false;
      llmParseMode = _LLM_PARSE_MODE.PLAIN_TEXT_FALLBACK;
    }
    const replyBeforeSanitize = reply;
    reply = _sanitizeChatReply(reply);
    const replyLayer1Sanitized = reply !== replyBeforeSanitize;
    if (replyLayer1Sanitized) {
      _sanitization.applied = true;
      _sanitization.layer = "planner_terms";
      _sanitization.reason = "planner_leak_detected";
      logNV("\u{1F6E1}\uFE0F [CHAT/LLM] Layer-1 sanitizer aplicado (planner_terms)", { session_id });
    }
    const arbitrationDecision = {
      pm4_level: pm4Arbitration?.level || null,
      pm4_category: pm4Arbitration?.category || null,
      pm4_signals: pm4Arbitration?.signals || [],
      pm4_allows_planner: pm4AllowsPlanner,
      llm_requested_planner: wantsPlan,
      ...operationalOverride ? { operational_override: true } : {},
      // final_decision reflects PM4-only authority (or operational override):
      //   "planner_activated"              → LLM requested + PM4 level B/C (coherent)
      //   "planner_forced_level_BC"        → PM4 level B/C but LLM didn't request it
      //   "planner_forced_operational"     → PM4 level A overridden by operational term
      //   "planner_blocked_level_A"        → PM4 level A (blocks even if LLM wanted it)
      final_decision: shouldActivatePlanner ? operationalOverride && !pm4AllowsPlanner ? "planner_forced_operational" : wantsPlan ? "planner_activated" : "planner_forced_level_BC" : "planner_blocked_level_A"
    };
    logNV("\u{1F5E3}\uFE0F [CHAT/LLM] LLM respondeu", {
      use_planner: wantsPlan,
      pm4_allows: pm4AllowsPlanner,
      final: arbitrationDecision.final_decision,
      session_id
    });
    let plannerSnapshot = null;
    let plannerUsed = false;
    let plannerError = null;
    let pendingPlanSaved = false;
    let _chatPlannerDebug = null;
    if (shouldActivatePlanner) {
      try {
        const {
          resolvedText: chatResolvedText,
          objectiveSource: chatObjectiveSource,
          hasPlannerBrief: chatHasPlannerBrief
        } = _resolveOperatorIntent(context, message);
        const classification = classifyRequest({ text: chatResolvedText, context });
        const envelope = buildOutputEnvelope(classification, { text: chatResolvedText });
        const canonicalPlan = buildCanonicalPlan({
          classification,
          envelope,
          input: { text: chatResolvedText },
          planner_brief: context?.planner_brief ?? null
        });
        const gate = evaluateApprovalGate(canonicalPlan);
        const bridge = buildExecutorBridgePayload({ plan: canonicalPlan, gate });
        const memoryConsolidation = consolidateMemoryLearning({
          plan: canonicalPlan,
          gate,
          bridge
        });
        plannerSnapshot = {
          classification,
          canonicalPlan,
          gate,
          bridge,
          memoryConsolidation,
          outputMode: envelope.output_mode
        };
        plannerUsed = true;
        _chatPlannerDebug = {
          fix_active: "P-BRIEF-v2",
          // sentinel: confirms this /chat/run handler has the P-BRIEF fix
          received_message: message,
          has_planner_brief: chatHasPlannerBrief,
          // always shows raw value received; null means absent; use with objective_source to diagnose fallbacks
          planner_brief_operator_intent: context?.planner_brief?.operator_intent != null ? String(context.planner_brief.operator_intent).slice(0, 120) : null,
          resolved_text_used_for_pm: chatResolvedText.slice(0, 120),
          objective_source: chatObjectiveSource,
          canonical_plan_objective: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : null,
          pending_plan_saved: false
          // updated below if plan is saved
        };
        if (session_id && env?.ENAVIA_BRAIN) {
          try {
            await env.ENAVIA_BRAIN.put(
              `planner:latest:${session_id}`,
              JSON.stringify(plannerSnapshot)
            );
            logNV("\u{1F4BE} [CHAT/LLM] planner:latest atualizado no KV", { session_id });
          } catch (kvErr) {
            logNV("\u26A0\uFE0F [CHAT/LLM] Falha ao persistir planner:latest (n\xE3o cr\xEDtico)", {
              session_id,
              error: String(kvErr)
            });
          }
        }
        if (session_id && !hasDangerousTermForOverride && (gate.needs_human_approval === true || !gate.can_proceed || operationalOverride) && plannerSnapshot.outputMode !== "formal_contract" && env.ENAVIA_BRAIN) {
          const pendingKey = `chat:pending_plan:${session_id}`;
          const now = Date.now();
          const builtExecutorPayload = {
            version: "1.0",
            source: "planner_bridge",
            plan_summary: typeof canonicalPlan.objective === "string" ? canonicalPlan.objective : "",
            complexity_level: canonicalPlan.complexity_level,
            plan_type: canonicalPlan.plan_type,
            steps: Array.isArray(canonicalPlan.steps) ? canonicalPlan.steps : [],
            risks: Array.isArray(canonicalPlan.risks) ? canonicalPlan.risks : [],
            acceptance_criteria: Array.isArray(canonicalPlan.acceptance_criteria) ? canonicalPlan.acceptance_criteria : []
          };
          const pendingBridgeId = safeId("bridge");
          const pendingValue = {
            session_id,
            bridge_id: pendingBridgeId,
            bridge_executor_payload: builtExecutorPayload,
            plan_summary: builtExecutorPayload.plan_summary,
            gate_status: gate.gate_status,
            created_at: new Date(now).toISOString(),
            expires_at: new Date(now + _PENDING_PLAN_TTL_SECONDS * 1e3).toISOString(),
            source: "chat_run"
          };
          try {
            await env.ENAVIA_BRAIN.put(pendingKey, JSON.stringify(pendingValue), {
              expirationTtl: _PENDING_PLAN_TTL_SECONDS
            });
            pendingPlanSaved = true;
            if (_chatPlannerDebug) _chatPlannerDebug.pending_plan_saved = true;
            logNV("\u{1F4BE} [CHAT/LLM] pending_plan salvo no KV", {
              session_id,
              gate_status: gate.gate_status,
              bridge_id: pendingBridgeId
            });
          } catch (kvErr) {
            logNV("\u26A0\uFE0F [CHAT/LLM] Falha ao salvar pending_plan (n\xE3o cr\xEDtico)", {
              session_id,
              error: String(kvErr)
            });
          }
        }
        logNV("\u{1F527} [CHAT/LLM] Planner acionado como ferramenta interna", {
          session_id,
          level: classification.complexity_level
        });
      } catch (planErr) {
        plannerError = String(planErr);
        logNV("\u26A0\uFE0F [CHAT/LLM] Planner falhou como tool (n\xE3o cr\xEDtico)", {
          error: plannerError
        });
      }
    }
    if (shouldActivatePlanner && _isManualPlanReply(reply)) {
      reply = _MANUAL_PLAN_FALLBACK;
      arbitrationDecision.reply_sanitized = "manual_plan_replaced";
      _sanitization.applied = true;
      _sanitization.layer = "manual_plan";
      _sanitization.reason = "manual_plan_leak_detected";
      logNV("\u{1F6E1}\uFE0F [CHAT/LLM] Manual plan leak detectado no reply \u2014 sanitizado", { session_id });
    }
    const _chatMemApplied = chatRetrievalSummary.applied === true && chatRetrievalSummary.total_memories_read > 0;
    const _chatMemHits = _chatMemApplied ? [
      ...chatRetrievalSummary.validated_learning.items.map((m) => ({
        id: m.memory_id,
        title: m.title,
        type: m.memory_type,
        block: "validated_learning",
        is_reference: false
      })),
      ...chatRetrievalSummary.manual_instructions.items.map((m) => ({
        id: m.memory_id,
        title: m.title,
        type: m.memory_type,
        block: "manual_instructions",
        is_reference: false
      })),
      ...chatRetrievalSummary.historical_memory.items.map((m) => ({
        id: m.memory_id,
        title: m.title,
        type: m.memory_type,
        block: "historical_memory",
        is_reference: m.is_reference || false
      }))
    ] : [];
    const _targetFieldsSeen = hasTarget ? Object.entries(_chatTarget).filter(([, v]) => v != null && v !== "").map(([k]) => k) : [];
    const _memoryContentInjected = _pr3MemoryBlock.length > 0;
    const _memoryHitsCount = _chatMemHits.length;
    return jsonResponse({
      ok: true,
      system: "ENAVIA-NV-FIRST",
      mode: "llm-first",
      reply,
      planner_used: plannerUsed,
      memory_applied: _chatMemApplied,
      memory_hits: _chatMemHits,
      operational_context_applied: isOperationalContext,
      // PR36: telemetria mínima de sanitização/fallback (campo aditivo, não-quebrante).
      sanitization: _sanitization,
      // PR49: classificação de intenção v1 (campo aditivo, não-quebrante, somente se disponível).
      // `signals` é excluído propositalmente do response API — é campo de debugging interno
      // com detalhes de termos casados que não agrega valor para o consumidor externo e
      // pode expor detalhes de implementação do classificador desnecessariamente.
      ..._intentClassification ? { intent_classification: {
        intent: _intentClassification.intent,
        confidence: _intentClassification.confidence,
        is_operational: _intentClassification.is_operational,
        reasons: _intentClassification.reasons
      } } : {},
      // PR51: Skill Router read-only v1 (campo aditivo, não-quebrante, somente se disponível).
      // Indica qual skill documental foi selecionada para esta mensagem. Nunca executa skill.
      // /skills/run não existe. mode sempre "read_only".
      ..._skillRouting ? { skill_routing: {
        matched: _skillRouting.matched,
        skill_id: _skillRouting.skill_id,
        skill_name: _skillRouting.skill_name,
        mode: _skillRouting.mode,
        confidence: _skillRouting.confidence,
        reason: _skillRouting.reason,
        sources: _skillRouting.sources,
        warning: _skillRouting.warning
      } } : {},
      // PR53: Intent Retrieval v1 (campo aditivo seguro, não-quebrante).
      // Indica qual bloco documental foi recuperado por intenção. Read-only.
      // Não inclui context_block inteiro no response — apenas metadados.
      ..._intentRetrieval ? { intent_retrieval: {
        applied: _intentRetrieval.applied,
        mode: _intentRetrieval.mode,
        intent: _intentRetrieval.intent,
        skill_id: _intentRetrieval.skill_id,
        sources: _intentRetrieval.sources,
        token_budget_hint: _intentRetrieval.token_budget_hint,
        warnings: _intentRetrieval.warnings
      } } : {},
      ...plannerSnapshot ? { planner: plannerSnapshot } : {},
      ...pendingPlanSaved ? { pending_plan_saved: true, pending_plan_expires_in: _PENDING_PLAN_TTL_SECONDS } : {},
      // PR56: Self-Audit read-only v1 (campo aditivo seguro, não-quebrante).
      // Indica achados de risco, alertas e próxima ação segura. Read-only.
      // Não altera reply. Não bloqueia fluxo automaticamente. Não chama LLM externo.
      ..._selfAudit ? { self_audit: _selfAudit } : {},
      // PR59: Response Policy viva v1 (campo aditivo seguro, não-quebrante).
      // Orienta tom e estrutura da resposta. Read-only. Não altera reply.
      // Não bloqueia fluxo programaticamente. Não chama LLM externo.
      // policy_block inteiro NÃO é exposto — apenas metadados seguros.
      ..._responsePolicy ? { response_policy: {
        applied: _responsePolicy.applied,
        mode: _responsePolicy.mode,
        response_style: _responsePolicy.response_style,
        should_adjust_tone: _responsePolicy.should_adjust_tone,
        should_warn: _responsePolicy.should_warn,
        should_refuse_or_pause: _responsePolicy.should_refuse_or_pause,
        warnings: _responsePolicy.warnings,
        reasons: _responsePolicy.reasons
      } } : {},
      // PR69: Skill Execution Proposal v1 (campo aditivo, proposal-only).
      // Não executa skill. Não altera reply/use_planner. Sem side effects.
      ..._skillExecution ? { skill_execution: _skillExecution.skill_execution } : {},
      // PR77: superfície controlada de proposta no chat (metadata-only).
      // Não executa skill. Não altera reply/use_planner.
      ..._chatSkillSurface ? { chat_skill_surface: _chatSkillSurface } : {},
      timestamp: Date.now(),
      input: message,
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: session_id || null,
        pipeline: plannerUsed ? "PR3 + LLM + PM4\u2192PM9" : "PR3 + LLM-only",
        operational_defaults_used: operationalDefaultsUsed,
        obvious_questions_suppressed: obviousQuestionsSuppressed,
        target_seen: hasTarget,
        target_fields_seen: _targetFieldsSeen,
        memory_content_injected: _memoryContentInjected,
        memory_hits_count: _memoryHitsCount,
        ...hasTarget ? { operational_output_mode: "actionable_compact" } : {},
        // PR3: retrieval context summary (separação de blocos explícita)
        retrieval: chatRetrievalSummary,
        // PR7: explicit continuity flag — true when conversation history was injected into LLM context
        continuity_active: conversationHistory.length > 0,
        conversation_history_length: conversationHistory.length,
        // PR7: whether the LLM returned parseable JSON (json_parsed) or plain text (plain_text_fallback)
        llm_parse_mode: llmParseMode,
        arbitration: (() => {
          const arb = { ...arbitrationDecision };
          if (replyLayer1Sanitized) arb.reply_sanitized_layer1 = "mechanical_term_leak_replaced";
          return arb;
        })(),
        // PR7: gate decision summary — surfaced here for quick observability without parsing planner object
        ...plannerSnapshot?.gate ? {
          gate_summary: {
            gate_status: plannerSnapshot.gate.gate_status,
            needs_human_approval: plannerSnapshot.gate.needs_human_approval,
            can_proceed: plannerSnapshot.gate.can_proceed
          }
        } : {},
        // PR7: planner error when planner was forced (Level B/C) but failed internally
        ...plannerError ? { planner_error: plannerError } : {},
        // P-BRIEF: planner debug — objective resolution trace for this /chat/run request
        ...plannerUsed && _chatPlannerDebug ? { planner_debug: _chatPlannerDebug } : {},
        operational_awareness: {
          browser_status: operationalAwareness.browser.status,
          browser_can_act: operationalAwareness.browser.can_act,
          executor_configured: operationalAwareness.executor.configured,
          approval_mode: operationalAwareness.approval.mode,
          human_gate_active: operationalAwareness.approval.human_gate_active
        },
        // prompt_debug: only present when body.debug===true — exposes full LLM message structure
        ...debugMode ? {
          prompt_debug: (() => {
            const roles = llmMessages.map((m) => m.role);
            const systemMsgs = llmMessages.filter((m) => m.role === "system");
            const opBlockIndex = llmMessages.findIndex(
              (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("INSTRU\xC7\xC3O OPERACIONAL PARA ESTA RESPOSTA")
            );
            const memBlockIndex = llmMessages.findIndex(
              (m) => m.role === "system" && typeof m.content === "string" && m.content.includes("MEM\xD3RIA RECUPERADA")
            );
            const userMsg = llmMessages.find((m) => m.role === "user");
            const opBlock = opBlockIndex >= 0 ? llmMessages[opBlockIndex] : null;
            const memBlock = memBlockIndex >= 0 ? llmMessages[memBlockIndex] : null;
            const baseSystemMsg = llmMessages[0];
            return {
              llm_messages_count: llmMessages.length,
              llm_messages_roles: roles,
              context_target_received: hasTarget,
              target_seen: hasTarget,
              target_fields_seen: _targetFieldsSeen,
              has_operational_context_block: opBlockIndex >= 0,
              operational_block_index: opBlockIndex >= 0 ? opBlockIndex : null,
              operational_block_preview: opBlock ? String(opBlock.content).slice(0, 600) : null,
              has_resolution_ambiguity_block: opBlock ? String(opBlock.content).includes("RESOLU\xC7\xC3O DE AMBIGUIDADE") : false,
              has_target_in_final_prompt: roles.some((r) => r === "system") && llmMessages.some((m) => typeof m.content === "string" && m.content.includes("ALVO OPERACIONAL ATIVO")),
              has_memory_block: memBlockIndex >= 0,
              memory_block_preview: memBlock ? String(memBlock.content).slice(0, 400) : null,
              system_messages_preview: systemMsgs.map((m) => ({
                index: llmMessages.indexOf(m),
                preview: String(m.content).slice(0, 300)
              })),
              user_message_final: userMsg ? String(userMsg.content).slice(0, 300) : null,
              base_system_has_section_5c: baseSystemMsg ? String(baseSystemMsg.content).includes("ALVO OPERACIONAL ATIVO") : false
            };
          })()
        } : {}
      }
    });
  } catch (err) {
    const errStr = String(err);
    let httpStatus = 500;
    let errorCode = "LLM_ERROR";
    let errorMsg = "Falha na conversa LLM-first.";
    if (errStr.includes("[TIMEOUT]") || err?.name === "AbortError") {
      httpStatus = 504;
      errorCode = "LLM_TIMEOUT";
      errorMsg = `Timeout na chamada ao modelo LLM (>${_LLM_CALL_TIMEOUT_MS / 1e3}s). Tente novamente.`;
    } else if (errStr.includes("[HTTP_429]") || errStr.toLowerCase().includes("rate limit")) {
      httpStatus = 503;
      errorCode = "LLM_RATE_LIMIT";
      errorMsg = "Servi\xE7o LLM temporariamente indispon\xEDvel: limite de requisi\xE7\xF5es atingido. Tente novamente em alguns instantes.";
    } else if (errStr.includes("[HTTP_5") || errStr.includes("[HTTP_503]") || errStr.includes("[HTTP_502]")) {
      httpStatus = 503;
      errorCode = "LLM_UNAVAILABLE";
      errorMsg = "Servi\xE7o LLM temporariamente indispon\xEDvel. Tente novamente em alguns instantes.";
    } else if (errStr.includes("[NETWORK]")) {
      httpStatus = 503;
      errorCode = "LLM_NETWORK_ERROR";
      errorMsg = "Falha de rede ao chamar o servi\xE7o LLM. Verifique conectividade e tente novamente.";
    } else if (errStr.includes("[EMPTY_RESPONSE]") || errStr.includes("[EMPTY_CONTENT]")) {
      httpStatus = 502;
      errorCode = "LLM_EMPTY_RESPONSE";
      errorMsg = "Modelo LLM retornou resposta vazia ou sem conte\xFAdo utiliz\xE1vel. Poss\xEDvel filtro de conte\xFAdo ou falha no modelo.";
    } else if (errStr.includes("[INVALID_JSON]")) {
      httpStatus = 502;
      errorCode = "LLM_INVALID_RESPONSE";
      errorMsg = "Modelo LLM retornou resposta em formato inv\xE1lido (n\xE3o-JSON). Tente novamente.";
    }
    logNV("\u274C [CHAT/LLM] Erro fatal:", { error: errStr, errorCode, httpStatus });
    return jsonResponse(
      {
        ok: false,
        system: "ENAVIA-NV-FIRST",
        mode: "llm-first",
        timestamp: Date.now(),
        error: errorMsg,
        error_code: errorCode,
        detail: errStr,
        telemetry: {
          duration_ms: Date.now() - startedAt,
          // PR7: continuity_active and pipeline are derivable before LLM call — include on failure
          continuity_active: conversationHistory.length > 0,
          conversation_history_length: conversationHistory.length,
          pipeline: shouldActivatePlanner ? "PR3 + LLM + PM4\u2192PM9" : "PR3 + LLM-only",
          // PR7: llm_parse_mode is unknown on failure (LLM never responded)
          llm_parse_mode: _LLM_PARSE_MODE.UNKNOWN,
          // Include PM4 pre-check result even on LLM failure — it's deterministic
          arbitration: pm4Arbitration ? {
            pm4_level: pm4Arbitration.level,
            pm4_allows_planner: pm4AllowsPlanner,
            ...operationalOverride ? { operational_override: true } : {},
            // Compute final_decision from PM4 + operational override (LLM decision unknown on failure)
            final_decision: shouldActivatePlanner ? operationalOverride && !pm4AllowsPlanner ? "planner_forced_operational" : "planner_forced_level_BC" : "planner_blocked_level_A"
          } : null,
          // Include operational awareness even on LLM failure — computed before try block
          operational_awareness: {
            browser_status: operationalAwareness.browser.status,
            browser_can_act: operationalAwareness.browser.can_act,
            executor_configured: operationalAwareness.executor.configured,
            approval_mode: operationalAwareness.approval.mode,
            human_gate_active: operationalAwareness.approval.human_gate_active
          }
        }
      },
      httpStatus
    );
  }
}
__name(handleChatLLM, "handleChatLLM");
async function handlePlannerBridge(request, env) {
  const startedAt = Date.now();
  if (!env.EXECUTOR || typeof env.EXECUTOR.fetch !== "function") {
    logNV("\u{1F534} [PLANNER/BRIDGE] EXECUTOR binding ausente");
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "Service Binding EXECUTOR n\xE3o configurado.",
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "JSON inv\xE1lido em /planner/bridge.",
      detail: String(err),
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 400);
  }
  if (!body || typeof body !== "object") body = {};
  const ep = body.executor_payload;
  if (!ep || typeof ep !== "object" || typeof ep.version !== "string" || typeof ep.source !== "string" || !Array.isArray(ep.steps)) {
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "executor_payload inv\xE1lido ou ausente. Campos obrigat\xF3rios: version, source, steps.",
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 400);
  }
  const sessionId = typeof body.session_id === "string" ? body.session_id : null;
  const reqId = safeId("bridge");
  logNV("\u{1F309} [PLANNER/BRIDGE] Recebendo bridge payload", {
    reqId,
    sessionId,
    source: ep.source,
    version: ep.version,
    steps_count: ep.steps.length
  });
  try {
    const executorPayload = {
      action: "execute_plan",
      source: "planner_bridge",
      bridge_id: reqId,
      session_id: sessionId,
      executor_payload: ep
    };
    const executorRes = await env.EXECUTOR.fetch("https://internal/engineer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(executorPayload)
    });
    let executorJson;
    try {
      executorJson = await executorRes.json();
    } catch {
      executorJson = { ok: false, error: "EXECUTOR_INVALID_JSON" };
    }
    logNV("\u{1F309} [PLANNER/BRIDGE] Resposta do executor", {
      reqId,
      executor_ok: !!executorJson?.ok,
      status: executorRes.status
    });
    const trail = {
      bridge_id: reqId,
      dispatched_at: (/* @__PURE__ */ new Date()).toISOString(),
      session_id: sessionId,
      source: ep.source,
      steps_count: ep.steps.length,
      executor_ok: executorRes.status >= 200 && executorRes.status < 300,
      executor_status: executorRes.status,
      executor_error: executorRes.status >= 200 && executorRes.status < 300 ? null : executorJson?.error ?? null
    };
    if (env.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(trail));
        await env.ENAVIA_BRAIN.put(`execution:trail:${reqId}`, JSON.stringify(trail));
      } catch (kvErr) {
        logNV("\u26A0\uFE0F [PLANNER/BRIDGE] Falha ao persistir trilha no KV (n\xE3o cr\xEDtico)", {
          reqId,
          error: String(kvErr)
        });
      }
    }
    return jsonResponse({
      ok: true,
      bridge_accepted: true,
      executor_response: executorJson,
      bridge_id: reqId,
      timestamp: Date.now(),
      telemetry: {
        duration_ms: Date.now() - startedAt,
        session_id: sessionId,
        executor_status: executorRes.status
      }
    });
  } catch (networkErr) {
    logNV("\u{1F534} [PLANNER/BRIDGE] Falha de rede com executor", {
      reqId,
      error: String(networkErr)
    });
    const errorTrail = {
      bridge_id: reqId,
      dispatched_at: (/* @__PURE__ */ new Date()).toISOString(),
      session_id: sessionId,
      source: ep.source,
      steps_count: ep.steps.length,
      executor_ok: false,
      executor_status: null,
      executor_error: "NETWORK_ERROR"
    };
    if (env.ENAVIA_BRAIN) {
      try {
        await env.ENAVIA_BRAIN.put("execution:trail:latest", JSON.stringify(errorTrail));
        await env.ENAVIA_BRAIN.put(`execution:trail:${reqId}`, JSON.stringify(errorTrail));
      } catch (_) {
      }
    }
    return jsonResponse({
      ok: false,
      bridge_accepted: false,
      error: "Falha de rede ao encaminhar bridge payload ao executor.",
      detail: String(networkErr),
      bridge_id: reqId,
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 502);
  }
}
__name(handlePlannerBridge, "handlePlannerBridge");
function buildOperationalAction(nextAction, contractId) {
  const OP_TYPE_MAP = {
    start_task: "execute_next",
    start_micro_pr: "execute_next",
    awaiting_human_approval: "approve",
    contract_complete: "block",
    // contrato já concluído — sem ação disponível
    contract_blocked: "block",
    phase_complete: "advance_phase",
    // PR18 — endpoint supervisionado de avanço de fase
    plan_rejected: "block",
    contract_cancelled: "block",
    no_action: "block"
  };
  const EVIDENCE_MAP = {
    execute_next: ["contract_id", "evidence[]"],
    approve: ["contract_id"],
    close_final: ["contract_id"],
    reject: ["contract_id"],
    advance_phase: ["contract_id"],
    // PR18 — só requer contract_id; gate aplicado por advanceContractPhase
    block: []
  };
  const opType = OP_TYPE_MAP[nextAction.type] ?? "block";
  const canExecute = opType !== "block";
  const requiresHuman = opType === "approve" || opType === "reject" || opType === "close_final";
  const contextKey = nextAction.task_id || nextAction.phase_id || nextAction.micro_pr_candidate_id || nextAction.type;
  const actionId = `op:${contractId}:${opType}:${contextKey}`;
  return {
    action_id: actionId,
    contract_id: contractId,
    type: opType,
    requires_human_approval: requiresHuman,
    evidence_required: EVIDENCE_MAP[opType] ?? [],
    can_execute: canExecute,
    block_reason: canExecute ? null : nextAction.type === "contract_complete" ? "Contrato j\xE1 conclu\xEDdo. Nenhuma a\xE7\xE3o adicional dispon\xEDvel." : nextAction.reason || "A\xE7\xE3o bloqueada."
  };
}
__name(buildOperationalAction, "buildOperationalAction");
function normalizeTargetWorkers(workers) {
  if (!Array.isArray(workers)) return [];
  return [...new Set(
    workers.filter((worker) => typeof worker === "string" && worker.trim()).map((worker) => worker.trim())
  )];
}
__name(normalizeTargetWorkers, "normalizeTargetWorkers");
function resolveAuditTargetWorker(state, decomposition, nextAction) {
  const sources = [];
  const register = /* @__PURE__ */ __name((source, workers) => {
    const normalized = normalizeTargetWorkers(workers);
    if (normalized.length > 0) {
      sources.push({ source, workers: normalized });
    }
  }, "register");
  register(
    "state.current_execution.handoff_used.scope.workers",
    state?.current_execution?.handoff_used?.scope?.workers
  );
  const targetMpr = nextAction?.micro_pr_candidate_id ? (decomposition?.micro_pr_candidates || []).find(
    (mpr) => mpr && mpr.id === nextAction.micro_pr_candidate_id
  ) : null;
  register(
    "nextAction.micro_pr_candidate.target_workers",
    targetMpr?.target_workers
  );
  const executionHandoff = buildExecutionHandoff(state, decomposition);
  register(
    "buildExecutionHandoff(...).scope.workers",
    executionHandoff?.scope?.workers
  );
  register("state.scope.workers", state?.scope?.workers);
  const uniqueWorkers = [...new Set(sources.flatMap((entry) => entry.workers))];
  if (uniqueWorkers.length === 1) {
    const workerId = uniqueWorkers[0];
    const source = sources.find((entry) => entry.workers.includes(workerId))?.source || null;
    return {
      ok: true,
      workerId,
      source,
      candidates: uniqueWorkers
    };
  }
  if (uniqueWorkers.length === 0) {
    return {
      ok: false,
      workerId: null,
      source: null,
      candidates: [],
      reason: "target worker ausente para auditoria segura"
    };
  }
  return {
    ok: false,
    workerId: null,
    source: null,
    candidates: uniqueWorkers,
    reason: `target worker amb\xEDguo para auditoria segura: ${uniqueWorkers.join(", ")}`
  };
}
__name(resolveAuditTargetWorker, "resolveAuditTargetWorker");
function buildExecutorTargetPayload(workerId) {
  return {
    workerId,
    target: { system: "cloudflare_worker", workerId }
  };
}
__name(buildExecutorTargetPayload, "buildExecutorTargetPayload");
async function handleGetLoopStatus(env) {
  const generatedAt = (/* @__PURE__ */ new Date()).toISOString();
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: true,
      generatedAt,
      contract: null,
      nextAction: { type: "no_kv", reason: "KV n\xE3o dispon\xEDvel neste ambiente.", status: "error" },
      operationalAction: null,
      loop: { supervised: true, canProceed: false, blocked: false, blockReason: null, availableActions: [] }
    });
  }
  try {
    let index = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get("contract:index");
      if (raw) index = JSON.parse(raw);
    } catch (_) {
    }
    if (!Array.isArray(index) || index.length === 0) {
      return jsonResponse({
        ok: true,
        generatedAt,
        contract: null,
        nextAction: { type: "no_contract", reason: "Nenhum contrato ativo encontrado.", status: "idle" },
        operationalAction: null,
        loop: {
          supervised: true,
          canProceed: false,
          blocked: false,
          blockReason: null,
          availableActions: ["POST /contracts"]
        }
      });
    }
    const TERMINAL = ["completed", "cancelled", "failed"];
    let contractId = null;
    let state = null;
    let decomposition = null;
    for (let i = index.length - 1; i >= 0; i--) {
      const { state: s, decomposition: d } = await rehydrateContract(env, index[i]);
      if (!s) continue;
      if (TERMINAL.includes(s.status_global)) continue;
      contractId = index[i];
      state = s;
      decomposition = d;
      break;
    }
    if (!state) {
      return jsonResponse({
        ok: true,
        generatedAt,
        contract: null,
        nextAction: { type: "no_contract", reason: "Nenhum contrato ativo encontrado (todos terminais).", status: "idle" },
        operationalAction: null,
        loop: {
          supervised: true,
          canProceed: false,
          blocked: false,
          blockReason: null,
          availableActions: ["POST /contracts"]
        }
      });
    }
    const nextAction = resolveNextAction(state, decomposition);
    const operationalAction = buildOperationalAction(nextAction, contractId);
    const isBlocked = nextAction.status === "blocked";
    const isReady = nextAction.status === "ready";
    const isAwaitingApproval = nextAction.type === "awaiting_human_approval";
    const isIdle = nextAction.status === "in_progress" || nextAction.type === "no_action";
    let availableActions = [];
    let guidance = null;
    if (isReady) {
      if (nextAction.type === "start_task" || nextAction.type === "start_micro_pr") {
        availableActions = ["POST /contracts/execute-next"];
      } else if (nextAction.type === "phase_complete") {
        availableActions = ["POST /contracts/advance-phase"];
        guidance = "Phase complete. Use POST /contracts/advance-phase com { contract_id } para avan\xE7ar \xE0 pr\xF3xima fase (gate aplicado internamente por advanceContractPhase).";
      } else if (nextAction.type === "contract_complete") {
        availableActions = [];
      }
    } else if (isAwaitingApproval) {
      availableActions = ["POST /contracts/close-final"];
    } else if (nextAction.status === "in_progress") {
      availableActions = ["POST /contracts/complete-task"];
      guidance = "Task in_progress. Use POST /contracts/complete-task com { contract_id, task_id, resultado } para concluir com gate de ader\xEAncia.";
    }
    const canProceed = isReady || isAwaitingApproval || nextAction.status === "in_progress";
    return jsonResponse({
      ok: true,
      generatedAt,
      contract: {
        id: state.contract_id || contractId,
        title: state.contract_name || null,
        status: state.status_global || null,
        current_phase: state.current_phase || null,
        current_task: state.current_task || null,
        updated_at: state.updated_at || null
      },
      nextAction,
      operationalAction,
      // PR8 — shape canônico de ação operacional
      loop: {
        supervised: true,
        canProceed,
        blocked: isBlocked,
        blockReason: isBlocked ? nextAction.reason : null,
        availableActions,
        ...guidance ? { guidance } : {}
      }
    });
  } catch (err) {
    logNV("\u{1F534} [GET /contracts/loop-status] Falha ao resolver loop", { error: String(err) });
    return jsonResponse({ ok: false, error: "Falha ao resolver estado do loop supervisionado." }, 500);
  }
}
__name(handleGetLoopStatus, "handleGetLoopStatus");
function buildEvidenceReport(opType, contractId, body) {
  const EVIDENCE_REQUIRED = {
    execute_next: ["contract_id", "evidence[]"],
    approve: ["contract_id"],
    close_final: ["contract_id"],
    reject: ["contract_id"],
    block: []
  };
  const required = EVIDENCE_REQUIRED[opType] ?? [];
  const provided = [];
  if (contractId) provided.push("contract_id");
  if (body && "evidence" in body) provided.push("evidence[]");
  if (body?.confirm === true) provided.push("confirm");
  if (body?.approved_by) provided.push("approved_by");
  const missing = required.filter((f) => !provided.includes(f));
  return {
    required,
    provided,
    missing,
    validation_level: "presence_only",
    semantic_validation: false
  };
}
__name(buildEvidenceReport, "buildEvidenceReport");
function buildRollbackRecommendation(opType, contractId, executed) {
  if (!executed) {
    return {
      available: false,
      type: "no_state_change",
      recommendation: "Nenhuma mudan\xE7a de estado ocorreu. Nenhuma a\xE7\xE3o de rollback necess\xE1ria.",
      command: null
    };
  }
  if (opType === "execute_next") {
    return {
      available: true,
      type: "manual_review",
      recommendation: `Verificar estado da task no contrato ${contractId} e reverter manualmente se necess\xE1rio.`,
      command: `POST /contracts/cancel { "contract_id": "${contractId}" }`
    };
  }
  if (opType === "approve") {
    return {
      available: true,
      type: "manual_review",
      recommendation: `Contrato ${contractId} processado para fechamento. Reabrir requer novo contrato ou revis\xE3o manual.`,
      command: null
    };
  }
  return {
    available: false,
    type: "no_state_change",
    recommendation: "Nenhuma mudan\xE7a de estado. Nenhuma a\xE7\xE3o necess\xE1ria.",
    command: null
  };
}
__name(buildRollbackRecommendation, "buildRollbackRecommendation");
function buildExecutorPathInfo(env, opType) {
  const serviceBindingAvailable = !!(env && env.EXECUTOR);
  const deployBindingAvailable = !!(env && env.DEPLOY_WORKER);
  if (opType === "execute_next") {
    return {
      type: "executor_bridge + internal_handler",
      handler: "callExecutorBridge(/audit) \u2192 callExecutorBridge(/propose) \u2192 callDeployBridge(simulate) \u2192 handleExecuteContract",
      uses_service_binding: true,
      service_binding_available: serviceBindingAvailable,
      deploy_binding_available: deployBindingAvailable,
      note: "PR14: audit + propose via env.EXECUTOR, deploy via env.DEPLOY_WORKER (simulate/test). Handler interno KV s\xF3 roda depois dos bridges."
    };
  }
  if (opType === "approve") {
    return {
      type: "executor_bridge + internal_handler",
      handler: "callExecutorBridge(/audit) \u2192 handleCloseFinalContract",
      uses_service_binding: true,
      service_binding_available: serviceBindingAvailable,
      deploy_binding_available: deployBindingAvailable,
      note: "PR14: audit via env.EXECUTOR antes de fechar contrato. Approve n\xE3o chama propose nem deploy direto."
    };
  }
  return {
    type: "blocked",
    handler: null,
    uses_service_binding: false,
    service_binding_available: serviceBindingAvailable,
    deploy_binding_available: deployBindingAvailable,
    note: "A\xE7\xE3o bloqueada. Nenhum handler chamado."
  };
}
__name(buildExecutorPathInfo, "buildExecutorPathInfo");
async function callExecutorBridge(env, route, payload) {
  const useBinding = typeof env?.EXECUTOR?.fetch === "function";
  const fallbackUrl = typeof env?.ENAVIA_EXECUTOR_URL_FALLBACK === "string" ? env.ENAVIA_EXECUTOR_URL_FALLBACK.trim() : "";
  if (!useBinding && !fallbackUrl) {
    return {
      ok: false,
      route,
      status: "blocked",
      reason: "env.EXECUTOR (service binding) e ENAVIA_EXECUTOR_URL_FALLBACK (fallback HTTP) n\xE3o dispon\xEDveis.",
      data: null
    };
  }
  try {
    let res;
    if (useBinding) {
      res = await env.EXECUTOR.fetch("https://enavia-executor.internal" + route, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else {
      const internalToken = typeof env?.INTERNAL_TOKEN === "string" ? env.INTERNAL_TOKEN : "";
      if (!internalToken) {
        return {
          ok: false,
          route,
          status: "blocked",
          reason: "Fallback HTTP para Executor requer INTERNAL_TOKEN configurado.",
          data: null
        };
      }
      res = await fetch(fallbackUrl + route, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Internal-Token": internalToken
        },
        body: JSON.stringify(payload)
      });
    }
    let data = null;
    let rawText = "";
    try {
      rawText = await res.text();
      data = JSON.parse(rawText);
    } catch (_) {
      return {
        ok: false,
        route,
        status: "ambiguous",
        reason: "Resposta do Executor n\xE3o \xE9 JSON v\xE1lido.",
        data: { raw: rawText.slice(0, 500) }
      };
    }
    if (!res.ok) {
      return {
        ok: false,
        route,
        status: "failed",
        reason: `Executor retornou status ${res.status}.`,
        data
      };
    }
    if (data === null || typeof data !== "object") {
      return {
        ok: false,
        route,
        status: "ambiguous",
        reason: "Resposta do Executor n\xE3o \xE9 JSON objeto v\xE1lido.",
        data
      };
    }
    if ("ok" in data && data.ok === false) {
      return {
        ok: false,
        route,
        status: "blocked",
        reason: data.error || data.reason || data.message || "Executor retornou ok:false.",
        data
      };
    }
    if (route === "/audit") {
      const verdict = data?.result?.verdict || data?.audit?.verdict || null;
      if (verdict === "reject") {
        return {
          ok: false,
          route,
          status: "blocked",
          reason: `Audit reprovado. Verdict: reject. Risk: ${data?.result?.risk_level || data?.audit?.risk_level || "unknown"}.`,
          data
        };
      }
      if (!verdict) {
        return {
          ok: false,
          route,
          status: "ambiguous",
          reason: "Audit sem verdict expl\xEDcito. Resposta amb\xEDgua bloqueada por seguran\xE7a.",
          data
        };
      }
    }
    return { ok: true, route, status: "passed", reason: null, data };
  } catch (err) {
    return {
      ok: false,
      route,
      status: "failed",
      reason: `Falha ao chamar Executor (${route}): ${String(err)}`,
      data: null
    };
  }
}
__name(callExecutorBridge, "callExecutorBridge");
function extractDeployAuditRiskLevel(executorAudit) {
  const candidates = [
    executorAudit?.result?.risk_level,
    executorAudit?.audit?.risk_level,
    executorAudit?.risk_level,
    executorAudit?.result?.risk,
    executorAudit?.audit?.risk,
    executorAudit?.risk
  ];
  for (const candidate of candidates) {
    if (candidate === "low" || candidate === "medium" || candidate === "high" || candidate === "critical") {
      return candidate;
    }
  }
  return null;
}
__name(extractDeployAuditRiskLevel, "extractDeployAuditRiskLevel");
function validateExecutorAuditForReceipt(executorAudit) {
  if (!executorAudit || typeof executorAudit !== "object") {
    return {
      ok: false,
      verdict: null,
      risk_level: null,
      reason: "executor_audit ausente. N\xE3o \xE9 poss\xEDvel registrar recibo sem audit real do Executor."
    };
  }
  const verdict = executorAudit?.result?.verdict || executorAudit?.audit?.verdict || executorAudit?.verdict || null;
  if (verdict !== "approve") {
    return {
      ok: false,
      verdict,
      risk_level: null,
      reason: `Verdict do Executor n\xE3o \xE9 "approve" (atual: ${JSON.stringify(verdict)}). Recibo n\xE3o registrado.`
    };
  }
  const risk_level = extractDeployAuditRiskLevel(executorAudit);
  if (risk_level === "high" || risk_level === "critical") {
    return {
      ok: false,
      verdict,
      risk_level,
      reason: `Risk level "${risk_level}" n\xE3o permite registro de recibo. Apenas low/medium aceit\xE1vel.`
    };
  }
  if (risk_level === null) {
    return {
      ok: false,
      verdict,
      risk_level: null,
      reason: "Risk level n\xE3o identificado no resultado do audit do Executor. Recibo n\xE3o registrado para evitar fabrica\xE7\xE3o de dados."
    };
  }
  return {
    ok: true,
    verdict,
    risk_level,
    reason: null
  };
}
__name(validateExecutorAuditForReceipt, "validateExecutorAuditForReceipt");
async function callDeployWorkerJson(env, path, payload) {
  const useBinding = typeof env?.DEPLOY_WORKER?.fetch === "function";
  let res;
  if (useBinding) {
    res = await env.DEPLOY_WORKER.fetch(`https://deploy-worker.internal${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  } else {
    const fallbackUrl = typeof env?.ENAVIA_DEPLOY_WORKER_URL === "string" ? env.ENAVIA_DEPLOY_WORKER_URL.trim() : "";
    const internalToken = typeof env?.INTERNAL_TOKEN === "string" ? env.INTERNAL_TOKEN : "";
    if (!fallbackUrl || !internalToken) {
      return {
        ok: false,
        route: path,
        status: "blocked",
        reason: "env.DEPLOY_WORKER (binding) e fallback HTTP (ENAVIA_DEPLOY_WORKER_URL + INTERNAL_TOKEN) n\xE3o dispon\xEDveis.",
        data: null
      };
    }
    res = await fetch(fallbackUrl + path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Token": internalToken
      },
      body: JSON.stringify(payload)
    });
  }
  let data = null;
  let rawText = "";
  try {
    rawText = await res.text();
    data = JSON.parse(rawText);
  } catch (_) {
    return {
      ok: false,
      route: path,
      status: "ambiguous",
      reason: "Resposta do Deploy Worker n\xE3o \xE9 JSON v\xE1lido.",
      data: { raw: rawText.slice(0, 500) }
    };
  }
  if (!res.ok) {
    return {
      ok: false,
      route: path,
      status: "failed",
      reason: `Deploy Worker retornou status ${res.status}.`,
      data
    };
  }
  if (data === null || typeof data !== "object") {
    return {
      ok: false,
      route: path,
      status: "ambiguous",
      reason: "Resposta do Deploy Worker n\xE3o \xE9 JSON objeto v\xE1lido.",
      data
    };
  }
  if ("ok" in data && data.ok === false) {
    return {
      ok: false,
      route: path,
      status: "failed",
      reason: data.error || data.reason || data.message || "Deploy Worker retornou ok:false.",
      data
    };
  }
  return { ok: true, route: path, status: "passed", reason: null, data };
}
__name(callDeployWorkerJson, "callDeployWorkerJson");
async function callDeployBridge(env, action, payload) {
  const PROD_ACTIONS = ["approve", "promote", "prod", "production", "rollback"];
  if (PROD_ACTIONS.includes(String(action).toLowerCase())) {
    return {
      ok: false,
      action,
      route: null,
      status: "blocked",
      reason: `A\xE7\xE3o "${action}" para produ\xE7\xE3o bloqueada nesta PR. Apenas simulate/apply-test/test permitido.`,
      data: null
    };
  }
  const targetEnv = (payload?.target_env || "").toLowerCase();
  if (targetEnv === "prod" || targetEnv === "production") {
    return {
      ok: false,
      action,
      route: null,
      status: "blocked",
      reason: "target_env production/prod bloqueado. Use test ou simulate.",
      data: null
    };
  }
  const hasDeployBinding = typeof env?.DEPLOY_WORKER?.fetch === "function";
  const hasFallbackUrl = typeof env?.ENAVIA_DEPLOY_WORKER_URL === "string" && env.ENAVIA_DEPLOY_WORKER_URL.trim().length > 0;
  const hasFallbackToken = typeof env?.INTERNAL_TOKEN === "string" && env.INTERNAL_TOKEN.length > 0;
  if (!hasDeployBinding && (!hasFallbackUrl || !hasFallbackToken)) {
    return {
      ok: false,
      action: "blocked",
      route: null,
      status: "blocked",
      reason: "env.DEPLOY_WORKER (binding) e fallback HTTP (ENAVIA_DEPLOY_WORKER_URL + INTERNAL_TOKEN) n\xE3o dispon\xEDveis. Deploy bloqueado por seguran\xE7a.",
      data: null
    };
  }
  try {
    const executionId = String(payload?.execution_id || payload?.audit_id || `exec-next:${Date.now()}`);
    const safePayload = {
      ...payload,
      execution_id: executionId,
      audit_id: payload?.audit_id || executionId,
      target_env: "test",
      deploy_action: "simulate"
    };
    const auditValidation = validateExecutorAuditForReceipt(safePayload.executor_audit);
    if (!auditValidation.ok) {
      return {
        ok: false,
        action,
        route: null,
        status: "blocked",
        reason: `Gate de valida\xE7\xE3o do audit bloqueou registro do recibo: ${auditValidation.reason}`,
        data: null,
        audit_validation: auditValidation
      };
    }
    const auditReceiptPayload = {
      execution_id: executionId,
      audit_id: safePayload.audit_id,
      source: safePayload.source || "nv-enavia",
      mode: safePayload.mode || "contract_execute_next",
      contract_id: safePayload.contract_id || null,
      nextAction: safePayload.nextAction || null,
      operationalAction: safePayload.operationalAction || null,
      timestamp: safePayload.timestamp || (/* @__PURE__ */ new Date()).toISOString(),
      audit: {
        ok: true,
        verdict: auditValidation.verdict,
        risk_level: auditValidation.risk_level
      },
      executor_audit: safePayload.executor_audit || null
    };
    const auditReceiptResult = await callDeployWorkerJson(env, "/__internal__/audit", auditReceiptPayload);
    if (!auditReceiptResult.ok) {
      return {
        ok: false,
        action,
        route: auditReceiptResult.route,
        status: auditReceiptResult.status,
        reason: `N\xE3o foi poss\xEDvel registrar recibo de audit aprovado antes do /apply-test. ${auditReceiptResult.reason}`,
        data: auditReceiptResult.data,
        audit_receipt: auditReceiptResult
      };
    }
    const applyTestResult = await callDeployWorkerJson(env, "/apply-test", safePayload);
    if (!applyTestResult.ok) {
      return {
        ok: false,
        action,
        route: applyTestResult.route,
        status: applyTestResult.status,
        reason: applyTestResult.reason,
        data: applyTestResult.data,
        audit_receipt: auditReceiptResult
      };
    }
    return {
      ok: true,
      action: "simulate",
      route: applyTestResult.route,
      status: "passed",
      reason: null,
      data: applyTestResult.data,
      audit_receipt: auditReceiptResult
    };
  } catch (err) {
    return {
      ok: false,
      action,
      route: null,
      status: "failed",
      reason: `Falha ao chamar Deploy Worker: ${String(err)}`,
      data: null
    };
  }
}
__name(callDeployBridge, "callDeployBridge");
async function handleAdvancePhase(request, env) {
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return {
      status: 400,
      body: {
        ok: false,
        status: "blocked",
        reason: "JSON inv\xE1lido."
      }
    };
  }
  const contractId = body?.contract_id || body?.contractId;
  if (!contractId || typeof contractId !== "string") {
    return {
      status: 400,
      body: {
        ok: false,
        status: "blocked",
        reason: "contract_id obrigat\xF3rio."
      }
    };
  }
  let result;
  try {
    result = await advanceContractPhase(env, contractId);
  } catch (err) {
    return {
      status: 500,
      body: {
        ok: false,
        status: "blocked",
        reason: `Falha ao avan\xE7ar fase: ${String(err)}`,
        contract_id: contractId
      }
    };
  }
  if (!result || result.ok !== true) {
    return {
      status: 409,
      body: {
        ok: false,
        status: "blocked",
        reason: result?.error || result?.reason || result?.gate?.reason || "Avan\xE7o de fase bloqueado.",
        contract_id: contractId,
        result: result || null
      }
    };
  }
  return {
    status: 200,
    body: {
      ok: true,
      status: "advanced",
      contract_id: contractId,
      result
    }
  };
}
__name(handleAdvancePhase, "handleAdvancePhase");
async function handleExecuteNext(request, env) {
  const auditId = `exec-next:${Date.now()}`;
  let body = {};
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse({
      ok: false,
      executed: false,
      status: "blocked",
      reason: "Body JSON inv\xE1lido.",
      nextAction: null,
      operationalAction: null,
      evidence: null,
      rollback: null,
      executor_path: null,
      audit_id: auditId
    }, 400);
  }
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: false,
      executed: false,
      status: "blocked",
      reason: "KV n\xE3o dispon\xEDvel neste ambiente.",
      nextAction: null,
      operationalAction: null,
      evidence: null,
      rollback: null,
      executor_path: null,
      audit_id: auditId
    });
  }
  const TERMINAL = ["completed", "cancelled", "failed"];
  let contractId = null, state = null, decomposition = null;
  try {
    let index = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get("contract:index");
      if (raw) index = JSON.parse(raw);
    } catch (_) {
    }
    if (!Array.isArray(index) || index.length === 0) {
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: "Nenhum contrato encontrado.",
        nextAction: null,
        operationalAction: null,
        evidence: null,
        rollback: null,
        executor_path: null,
        audit_id: auditId
      });
    }
    for (let i = index.length - 1; i >= 0; i--) {
      const { state: s, decomposition: d } = await rehydrateContract(env, index[i]);
      if (!s) continue;
      if (TERMINAL.includes(s.status_global)) continue;
      contractId = index[i];
      state = s;
      decomposition = d;
      break;
    }
  } catch (err) {
    logNV("\u{1F534} [POST /contracts/execute-next] Falha ao localizar contrato", { error: String(err) });
    return jsonResponse({
      ok: false,
      executed: false,
      status: "blocked",
      reason: "Falha ao localizar contrato ativo.",
      nextAction: null,
      operationalAction: null,
      evidence: null,
      rollback: null,
      executor_path: null,
      audit_id: auditId
    }, 500);
  }
  if (!state) {
    return jsonResponse({
      ok: false,
      executed: false,
      status: "blocked",
      reason: "Nenhum contrato ativo (todos terminais).",
      nextAction: null,
      operationalAction: null,
      evidence: null,
      rollback: null,
      executor_path: null,
      audit_id: auditId
    });
  }
  const nextAction = resolveNextAction(state, decomposition);
  const operationalAction = buildOperationalAction(nextAction, contractId);
  const evidenceReport = buildEvidenceReport(operationalAction.type, contractId, body);
  const rollbackBlocked = buildRollbackRecommendation(operationalAction.type, contractId, false);
  const executorPathInfo = buildExecutorPathInfo(env, operationalAction.type);
  if (!operationalAction.can_execute) {
    return jsonResponse({
      ok: true,
      executed: false,
      status: "blocked",
      reason: operationalAction.block_reason || "A\xE7\xE3o bloqueada.",
      nextAction,
      operationalAction,
      evidence: evidenceReport,
      rollback: rollbackBlocked,
      executor_path: executorPathInfo,
      audit_id: auditId
    });
  }
  if (evidenceReport.missing.length > 0) {
    return jsonResponse({
      ok: false,
      executed: false,
      status: "blocked",
      reason: evidenceReport.missing.includes("evidence[]") ? "Campo evidence \xE9 obrigat\xF3rio, mesmo que vazio, para ack operacional m\xEDnimo. Valida\xE7\xE3o atual \xE9 apenas de presen\xE7a." : `Evid\xEAncia requerida ausente: ${evidenceReport.missing.join(", ")}.`,
      nextAction,
      operationalAction,
      evidence: evidenceReport,
      rollback: rollbackBlocked,
      executor_path: executorPathInfo,
      audit_id: auditId
    });
  }
  const auditTargetResolution = operationalAction.type === "execute_next" || operationalAction.type === "approve" ? resolveAuditTargetWorker(state, decomposition, nextAction) : null;
  if (operationalAction.type === "execute_next") {
    if (!auditTargetResolution?.ok) {
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        executor_audit: null,
        executor_propose: null,
        executor_status: "blocked",
        executor_route: null,
        executor_block_reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        deploy_result: null,
        deploy_status: "not_reached",
        deploy_route: null,
        deploy_block_reason: "Audit n\xE3o foi chamado porque o alvo da auditoria n\xE3o \xE9 confi\xE1vel.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    const _auditPayload = {
      source: "nv-enavia",
      mode: "contract_execute_next",
      executor_action: "audit",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      context: { require_live_read: true },
      contract_id: contractId,
      nextAction,
      operationalAction,
      execution_id: auditId,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by || null,
      audit_id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      github_token_available: !!env?.GITHUB_TOKEN
    };
    const executorAuditResult = await callExecutorBridge(env, "/audit", _auditPayload);
    if (!executorAuditResult.ok) {
      logNV("\u{1F534} [POST /contracts/execute-next] Executor /audit bloqueou (execute_next)", { auditResult: executorAuditResult });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: executorAuditResult.reason || "Audit bloqueado pelo Executor.",
        executor_audit: executorAuditResult,
        executor_propose: null,
        executor_status: executorAuditResult.status,
        executor_route: "/audit",
        executor_block_reason: executorAuditResult.reason,
        deploy_result: null,
        deploy_status: "not_reached",
        deploy_route: null,
        deploy_block_reason: "Audit bloqueou antes do deploy.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    const _proposePayload = {
      source: "nv-enavia",
      mode: "contract_execute_next",
      executor_action: "propose",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      patch: { type: "contract_action", content: JSON.stringify(nextAction) },
      prompt: `Proposta supervisionada para a\xE7\xE3o contratual: ${operationalAction.type}`,
      intent: "propose",
      contract_id: contractId,
      nextAction,
      operationalAction,
      execution_id: auditId,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by || null,
      audit_id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      github_token_available: !!env?.GITHUB_TOKEN,
      context: { require_live_read: true },
      use_codex: !!env?.GITHUB_TOKEN,
      audit_verdict: executorAuditResult?.data?.audit?.verdict || executorAuditResult?.data?.result?.verdict || null,
      audit_findings: executorAuditResult?.data?.evidence || null
    };
    const executorProposeResult = await callExecutorBridge(env, "/propose", _proposePayload);
    if (!executorProposeResult.ok) {
      logNV("\u{1F534} [POST /contracts/execute-next] Executor /propose bloqueou (execute_next)", { proposeResult: executorProposeResult });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: executorProposeResult.reason || "Propose bloqueado pelo Executor.",
        executor_audit: executorAuditResult,
        executor_propose: executorProposeResult,
        executor_status: executorProposeResult.status,
        executor_route: "/propose",
        executor_block_reason: executorProposeResult.reason,
        deploy_result: null,
        deploy_status: "not_reached",
        deploy_route: null,
        deploy_block_reason: "Propose bloqueou antes do deploy.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    const _deployPayload = {
      source: "nv-enavia",
      mode: "contract_execute_next",
      deploy_action: "simulate",
      target_env: "test",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      patch: { type: "contract_action", content: JSON.stringify(nextAction) },
      contract_id: contractId,
      nextAction,
      operationalAction,
      execution_id: auditId,
      executor_audit: executorAuditResult.data,
      executor_propose: executorProposeResult.data,
      audit_id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const deployResult = await callDeployBridge(env, "simulate", _deployPayload);
    if (!deployResult.ok) {
      logNV("\u{1F534} [POST /contracts/execute-next] Deploy Worker bloqueou (execute_next)", { deployResult });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: deployResult.reason || "Deploy Worker bloqueou ou n\xE3o dispon\xEDvel.",
        executor_audit: executorAuditResult,
        executor_propose: executorProposeResult,
        executor_status: "passed",
        executor_route: "/propose",
        executor_block_reason: null,
        deploy_result: deployResult,
        deploy_status: deployResult.status,
        deploy_route: deployResult.route || null,
        deploy_block_reason: deployResult.reason,
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    if (nextAction.type === "start_task" && nextAction.task_id) {
      let startResult;
      try {
        startResult = await startTask(env, contractId, nextAction.task_id);
      } catch (err) {
        logNV("\u{1F534} [POST /contracts/execute-next] Falha ao chamar startTask", { error: String(err) });
        startResult = { ok: false, error: "START_TASK_ERROR", message: String(err) };
      }
      if (!startResult.ok) {
        return jsonResponse({
          ok: false,
          executed: false,
          status: "blocked",
          reason: `Falha ao iniciar task "${nextAction.task_id}": ${startResult.message || startResult.error}`,
          executor_audit: executorAuditResult,
          executor_propose: executorProposeResult,
          executor_status: "passed",
          executor_route: "/propose",
          executor_block_reason: null,
          deploy_result: deployResult,
          deploy_status: deployResult.status,
          deploy_route: deployResult.route || null,
          deploy_block_reason: null,
          nextAction,
          operationalAction,
          evidence: evidenceReport,
          rollback: rollbackBlocked,
          executor_path: executorPathInfo,
          audit_id: auditId
        });
      }
    }
    let result;
    try {
      const syntheticReq = new Request("https://internal/contracts/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contract_id: contractId,
          evidence: Array.isArray(body.evidence) ? body.evidence : []
        })
      });
      result = await handleExecuteContract(syntheticReq, env);
    } catch (err) {
      logNV("\u{1F534} [POST /contracts/execute-next] Falha ao delegar a handleExecuteContract", { error: String(err) });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: "Falha interna ao executar a\xE7\xE3o.",
        executor_audit: executorAuditResult,
        executor_propose: executorProposeResult,
        executor_status: "passed",
        executor_route: "/propose",
        executor_block_reason: null,
        deploy_result: deployResult,
        deploy_status: deployResult.status,
        deploy_route: deployResult.route || null,
        deploy_block_reason: null,
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      }, 500);
    }
    const executed = result.status === 200 && result.body?.ok === true;
    const ambiguous = !executed && result.status === 200 && result.body?.ok !== false;
    if (ambiguous) {
      logNV("\u26A0\uFE0F [POST /contracts/execute-next] Resultado amb\xEDguo de handleExecuteContract", { result: result.body });
    }
    return jsonResponse({
      ok: executed,
      executed,
      status: executed ? "executed" : "blocked",
      reason: executed ? null : result.body?.message || (ambiguous ? "Resultado amb\xEDguo. Execu\xE7\xE3o bloqueada por seguran\xE7a." : "Execu\xE7\xE3o n\xE3o conclu\xEDda."),
      executor_audit: executorAuditResult,
      executor_propose: executorProposeResult,
      executor_status: "passed",
      executor_route: "/propose",
      executor_block_reason: null,
      deploy_result: deployResult,
      deploy_status: deployResult.status,
      deploy_route: deployResult.route || null,
      deploy_block_reason: null,
      nextAction,
      operationalAction,
      execution_result: result.body || null,
      evidence: evidenceReport,
      rollback: buildRollbackRecommendation(operationalAction.type, contractId, executed),
      executor_path: executorPathInfo,
      audit_id: auditId
    }, executed ? 200 : result.status || 422);
  }
  if (operationalAction.type === "approve") {
    if (body.confirm !== true) {
      return jsonResponse({
        ok: true,
        executed: false,
        status: "awaiting_approval",
        reason: "Aprova\xE7\xE3o humana expl\xEDcita necess\xE1ria. Envie { confirm: true, approved_by: '...' } (boolean estrito).",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    if (!body.approved_by) {
      return jsonResponse({
        ok: false,
        executed: false,
        status: "awaiting_approval",
        reason: "Campo approved_by \xE9 obrigat\xF3rio para aprova\xE7\xE3o humana.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      }, 400);
    }
    if (!auditTargetResolution?.ok) {
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        executor_audit: null,
        executor_propose: null,
        executor_status: "blocked",
        executor_route: null,
        executor_block_reason: auditTargetResolution?.reason || "target worker ausente para auditoria segura",
        deploy_result: null,
        deploy_status: "not_applicable",
        deploy_route: null,
        deploy_block_reason: "Approve n\xE3o usa deploy direto.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    const _auditPayloadApprove = {
      source: "nv-enavia",
      mode: "contract_execute_next",
      executor_action: "audit",
      ...buildExecutorTargetPayload(auditTargetResolution.workerId),
      context: { require_live_read: true },
      contract_id: contractId,
      nextAction,
      operationalAction,
      execution_id: auditId,
      evidence: Array.isArray(body.evidence) ? body.evidence : [],
      approved_by: body.approved_by,
      audit_id: auditId,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
    const executorAuditApproveResult = await callExecutorBridge(env, "/audit", _auditPayloadApprove);
    if (!executorAuditApproveResult.ok) {
      logNV("\u{1F534} [POST /contracts/execute-next] Executor /audit bloqueou (approve)", { auditResult: executorAuditApproveResult });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: executorAuditApproveResult.reason || "Audit bloqueado pelo Executor.",
        executor_audit: executorAuditApproveResult,
        executor_propose: null,
        executor_status: executorAuditApproveResult.status,
        executor_route: "/audit",
        executor_block_reason: executorAuditApproveResult.reason,
        deploy_result: null,
        deploy_status: "not_applicable",
        deploy_route: null,
        deploy_block_reason: "Approve n\xE3o usa deploy direto.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      });
    }
    let result;
    try {
      const syntheticReq = new Request("https://internal/contracts/close-final", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contract_id: contractId })
      });
      result = await handleCloseFinalContract(syntheticReq, env);
    } catch (err) {
      logNV("\u{1F534} [POST /contracts/execute-next] Falha ao delegar a handleCloseFinalContract", { error: String(err) });
      return jsonResponse({
        ok: false,
        executed: false,
        status: "blocked",
        reason: "Falha interna ao processar aprova\xE7\xE3o.",
        executor_audit: executorAuditApproveResult,
        executor_propose: null,
        executor_status: "passed",
        executor_route: "/audit",
        executor_block_reason: null,
        deploy_result: null,
        deploy_status: "not_applicable",
        deploy_route: null,
        deploy_block_reason: "Approve n\xE3o usa deploy direto.",
        nextAction,
        operationalAction,
        evidence: evidenceReport,
        rollback: rollbackBlocked,
        executor_path: executorPathInfo,
        audit_id: auditId
      }, 500);
    }
    const executed = result.status === 200 && result.body?.ok === true;
    const ambiguous = !executed && result.status === 200 && result.body?.ok !== false;
    if (ambiguous) {
      logNV("\u26A0\uFE0F [POST /contracts/execute-next] Resultado amb\xEDguo de handleCloseFinalContract", { result: result.body });
    }
    return jsonResponse({
      ok: executed,
      executed,
      status: executed ? "executed" : "blocked",
      reason: executed ? null : result.body?.message || (ambiguous ? "Resultado amb\xEDguo. Aprova\xE7\xE3o bloqueada por seguran\xE7a." : "Aprova\xE7\xE3o n\xE3o processada."),
      executor_audit: executorAuditApproveResult,
      executor_propose: null,
      executor_status: "passed",
      executor_route: "/audit",
      executor_block_reason: null,
      deploy_result: null,
      deploy_status: "not_applicable",
      deploy_route: null,
      deploy_block_reason: "Approve n\xE3o usa deploy direto.",
      nextAction,
      operationalAction,
      execution_result: result.body || null,
      evidence: evidenceReport,
      rollback: buildRollbackRecommendation(operationalAction.type, contractId, executed),
      executor_path: executorPathInfo,
      audit_id: auditId
    }, executed ? 200 : result.status || 422);
  }
  logNV("\u26A0\uFE0F [POST /contracts/execute-next] Tipo operacional sem caminho seguro", {
    opType: operationalAction.type,
    contractId
  });
  return jsonResponse({
    ok: false,
    executed: false,
    status: "blocked",
    reason: `Tipo de a\xE7\xE3o "${operationalAction.type}" n\xE3o tem caminho seguro mapeado em execute-next.`,
    nextAction,
    operationalAction,
    evidence: evidenceReport,
    rollback: rollbackBlocked,
    executor_path: executorPathInfo,
    audit_id: auditId
  });
}
__name(handleExecuteNext, "handleExecuteNext");
async function handleGetExecution(env) {
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({ ok: true, execution: null, note: "KV n\xE3o dispon\xEDvel neste ambiente." });
  }
  try {
    const trail = await env.ENAVIA_BRAIN.get("execution:trail:latest", "json");
    let execEvent = null;
    let latestContractId = null;
    try {
      latestContractId = await env.ENAVIA_BRAIN.get("execution:exec_event:latest_contract_id");
      if (latestContractId) {
        execEvent = await readExecEvent(env, latestContractId);
      }
    } catch (evErr) {
      logNV("\u26A0\uFE0F [GET /execution] Falha n\xE3o-cr\xEDtica ao ler exec_event (trilha retornada sem ele)", { error: String(evErr) });
    }
    let functionalLogs = [];
    try {
      if (latestContractId) {
        functionalLogs = await readFunctionalLogs(env, latestContractId);
      }
    } catch (flErr) {
      logNV("\u26A0\uFE0F [GET /execution] Falha n\xE3o-cr\xEDtica ao ler functional logs", { error: String(flErr) });
    }
    let execution = null;
    if (trail || execEvent) {
      execution = { ...trail ?? {}, ...execEvent ? { exec_event: execEvent } : {} };
      if (execEvent) {
        if (execEvent.metrics && !execution.metrics) {
          execution.metrics = execEvent.metrics;
        }
        if (execEvent.executionSummary && !execution.executionSummary) {
          execution.executionSummary = execEvent.executionSummary;
        }
        if (execEvent.result && !execution.result) {
          execution.result = execEvent.result;
        }
        if (execEvent.status_atual && !execution.status) {
          const statusMap = { running: "RUNNING", success: "COMPLETED", failed: "FAILED" };
          execution.status = statusMap[execEvent.status_atual] || execEvent.status_atual;
        }
      }
      if (!execution.functionalLogs) {
        execution.functionalLogs = functionalLogs.length > 0 ? functionalLogs : [];
      }
    }
    let latestDecision = null;
    try {
      latestDecision = await env.ENAVIA_BRAIN.get("decision:latest", "json");
    } catch (_) {
    }
    return jsonResponse({ ok: true, execution, latestDecision });
  } catch (err) {
    logNV("\u{1F534} [GET /execution] Falha ao ler trilha do KV", { error: String(err) });
    return jsonResponse({ ok: false, execution: null, error: "Falha ao ler trilha de execu\xE7\xE3o." }, 500);
  }
}
__name(handleGetExecution, "handleGetExecution");
async function handleGetHealth(env) {
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: true,
      health: {
        generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
        status: "idle",
        summary: { total: 0, completed: 0, failed: 0, blocked: 0, running: 0 },
        recentErrors: [],
        blockedExecutions: [],
        recentCompleted: [],
        latestDecision: null,
        _limitations: { blockedExecutions: "derived_from_latest_decision_only" },
        _source: "no_kv"
      }
    });
  }
  try {
    let buildBlockedFromDecision = function(dec) {
      if (!dec || dec.decision !== "rejected" || !dec.bridge_id) return [];
      return [{
        id: `decision-${dec.decision_id}`,
        bridge_id: dec.bridge_id,
        blockedAt: dec.decided_at,
        reason: dec.context ?? "Rejeitada pelo gate humano.",
        decided_by: dec.decided_by
      }];
    };
    __name(buildBlockedFromDecision, "buildBlockedFromDecision");
    const latestContractId = await env.ENAVIA_BRAIN.get("execution:exec_event:latest_contract_id");
    let execEvent = null;
    if (latestContractId) {
      execEvent = await readExecEvent(env, latestContractId);
    }
    let latestDecision = null;
    try {
      latestDecision = await env.ENAVIA_BRAIN.get("decision:latest", "json");
    } catch (_) {
    }
    if (!execEvent) {
      const blockedExecutions2 = buildBlockedFromDecision(latestDecision);
      return jsonResponse({
        ok: true,
        health: {
          generatedAt: (/* @__PURE__ */ new Date()).toISOString(),
          status: blockedExecutions2.length > 0 ? "degraded" : "idle",
          summary: { total: blockedExecutions2.length, completed: 0, failed: 0, blocked: blockedExecutions2.length, running: 0 },
          recentErrors: [],
          blockedExecutions: blockedExecutions2,
          recentCompleted: [],
          latestDecision,
          _limitations: { blockedExecutions: "derived_from_latest_decision_only" },
          _source: "exec_event_absent"
        }
      });
    }
    const statusAtual = execEvent.status_atual ?? null;
    const op = execEvent.operacao_atual ?? null;
    const motivo = execEvent.motivo_curto ?? null;
    const patch = execEvent.patch_atual ?? null;
    const ts = execEvent.emitted_at ?? null;
    const isRunning = statusAtual === "running";
    const isSuccess = statusAtual === "success";
    const isError = !isRunning && !isSuccess && statusAtual !== null;
    const recentErrors = isError ? [
      {
        id: `exec-event-${latestContractId}`,
        requestLabel: op ?? "Execu\xE7\xE3o",
        errorCode: "STEP_EXECUTION_ERROR",
        message: motivo ?? "Erro na execu\xE7\xE3o.",
        failedAt: ts
      }
    ] : [];
    const blockedExecutions = buildBlockedFromDecision(latestDecision);
    const recentCompleted = isSuccess ? [
      {
        id: `exec-event-${latestContractId}`,
        requestLabel: op ?? "Execu\xE7\xE3o",
        completedAt: ts,
        durationMs: null,
        // não disponível na fonte PR1
        summary: patch ?? motivo ?? "Execu\xE7\xE3o conclu\xEDda."
      }
    ] : [];
    const summary = {
      total: 1 + blockedExecutions.length,
      completed: isSuccess ? 1 : 0,
      failed: isError ? 1 : 0,
      blocked: blockedExecutions.length,
      running: isRunning ? 1 : 0
    };
    const status = blockedExecutions.length > 0 ? "degraded" : isRunning || isSuccess ? "healthy" : "degraded";
    return jsonResponse({
      ok: true,
      health: {
        generatedAt: ts ?? (/* @__PURE__ */ new Date()).toISOString(),
        status,
        summary,
        recentErrors,
        blockedExecutions,
        recentCompleted,
        latestDecision,
        _limitations: { blockedExecutions: "derived_from_latest_decision_only" },
        _source: "exec_event"
      }
    });
  } catch (err) {
    logNV("\u{1F534} [GET /health] Falha ao ler exec_event", { error: String(err) });
    return jsonResponse({ ok: false, error: "Falha ao ler dados de sa\xFAde." }, 500);
  }
}
__name(handleGetHealth, "handleGetHealth");
async function handlePostDecision(request, env) {
  const startedAt = Date.now();
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({
      ok: false,
      error: "KV n\xE3o dispon\xEDvel \u2014 imposs\xEDvel persistir decis\xE3o.",
      timestamp: Date.now()
    }, 503);
  }
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse({
      ok: false,
      error: "JSON inv\xE1lido em /execution/decision.",
      detail: String(err),
      timestamp: Date.now()
    }, 400);
  }
  if (!body || typeof body !== "object") body = {};
  const decision = body.decision;
  if (decision !== "approved" && decision !== "rejected") {
    return jsonResponse({
      ok: false,
      error: "Campo 'decision' obrigat\xF3rio \u2014 valores aceitos: 'approved', 'rejected'.",
      timestamp: Date.now()
    }, 400);
  }
  const bridgeId = typeof body.bridge_id === "string" && body.bridge_id.trim().length > 0 ? body.bridge_id.trim() : null;
  if (!bridgeId) {
    logNV("\u26A0\uFE0F [P14/DECISION] bridge_id ausente \u2014 decis\xE3o N\xC3O persistida (sem v\xEDnculo can\xF4nico de execu\xE7\xE3o)", {
      decision
    });
    return jsonResponse({
      ok: false,
      p14_valid: false,
      error: "bridge_id ausente ou nulo \u2014 esta decis\xE3o n\xE3o pode ser vinculada a uma execu\xE7\xE3o can\xF4nica.",
      diagnostic: [
        "bridge_id \xE9 o identificador can\xF4nico de execu\xE7\xE3o neste worker.",
        "Ele s\xF3 existe ap\xF3s POST /planner/bridge disparar o plano ao executor.",
        "Rejei\xE7\xF5es pr\xE9-bridge (antes do disparo) n\xE3o possuem bridge_id.",
        "Por contrato, P14 s\xF3 registra decis\xF5es com v\xEDnculo can\xF4nico de execu\xE7\xE3o comprovado.",
        "Esta rejei\xE7\xE3o pr\xE9-bridge N\xC3O \xE9 persistida como registro P14 v\xE1lido."
      ],
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 422);
  }
  const decisionId = safeId("decision");
  const now = (/* @__PURE__ */ new Date()).toISOString();
  const record = {
    decision_id: decisionId,
    decision,
    bridge_id: bridgeId,
    decided_at: now,
    decided_by: typeof body.decided_by === "string" && body.decided_by.trim().length > 0 ? body.decided_by.trim() : "human",
    context: typeof body.context === "string" && body.context.trim().length > 0 ? body.context.trim() : null
  };
  logNV("\u{1F4DD} [P14/DECISION] Registrando decis\xE3o com v\xEDnculo can\xF4nico", {
    decisionId,
    decision,
    bridgeId
  });
  try {
    await env.ENAVIA_BRAIN.put(`decision:${decisionId}`, JSON.stringify(record));
    await env.ENAVIA_BRAIN.put("decision:latest", JSON.stringify(record));
    const listKey = `decision:by_bridge:${bridgeId}`;
    let existing = [];
    try {
      const raw = await env.ENAVIA_BRAIN.get(listKey, "json");
      if (Array.isArray(raw)) existing = raw;
    } catch (readErr) {
      logNV("\u26A0\uFE0F [P14/DECISION] Falha ao ler lista existente (n\xE3o cr\xEDtico, tratando como vazia)", {
        bridgeId,
        error: String(readErr)
      });
    }
    existing.push(record);
    await env.ENAVIA_BRAIN.put(listKey, JSON.stringify(existing));
    logNV("\u2705 [P14/DECISION] Decis\xE3o persistida com v\xEDnculo can\xF4nico", { decisionId, bridgeId });
    return jsonResponse({
      ok: true,
      p14_valid: true,
      decision: record,
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    });
  } catch (err) {
    logNV("\u{1F534} [P14/DECISION] Falha ao persistir decis\xE3o no KV", {
      decisionId,
      error: String(err)
    });
    return jsonResponse({
      ok: false,
      error: "Falha ao persistir decis\xE3o no KV.",
      detail: String(err),
      timestamp: Date.now(),
      telemetry: { duration_ms: Date.now() - startedAt }
    }, 500);
  }
}
__name(handlePostDecision, "handlePostDecision");
async function handleGetDecisions(env, request) {
  const url = new URL(request.url);
  const bridgeId = url.searchParams.get("bridge_id");
  if (!bridgeId || bridgeId.trim().length === 0) {
    return jsonResponse({
      ok: false,
      error: "Par\xE2metro ?bridge_id=xxx \xE9 obrigat\xF3rio.",
      diagnostic: [
        "bridge_id \xE9 o identificador can\xF4nico de execu\xE7\xE3o neste worker.",
        "Ele \xE9 gerado por POST /planner/bridge e retornado no campo bridge_id da resposta.",
        "Use ?bridge_id=<valor> para consultar o hist\xF3rico de decis\xF5es de uma execu\xE7\xE3o espec\xEDfica."
      ],
      timestamp: Date.now()
    }, 400);
  }
  if (!env.ENAVIA_BRAIN) {
    return jsonResponse({ ok: true, bridge_id: bridgeId, decisions: [], note: "KV n\xE3o dispon\xEDvel neste ambiente." });
  }
  try {
    const listKey = `decision:by_bridge:${bridgeId.trim()}`;
    const decisions = await env.ENAVIA_BRAIN.get(listKey, "json");
    return jsonResponse({
      ok: true,
      bridge_id: bridgeId.trim(),
      decisions: Array.isArray(decisions) ? decisions : []
    });
  } catch (err) {
    logNV("\u{1F534} [GET /execution/decisions] Falha ao ler decis\xF5es do KV", { error: String(err) });
    return jsonResponse({ ok: false, decisions: [], error: "Falha ao ler hist\xF3rico de decis\xF5es." }, 500);
  }
}
__name(handleGetDecisions, "handleGetDecisions");
async function handleSkillsPropose(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "JSON inv\xE1lido em /skills/propose.",
        detail: String(err),
        skill_execution: {
          mode: "proposal",
          status: "blocked",
          skill_id: null,
          reason: "JSON inv\xE1lido; proposta bloqueada.",
          requires_approval: false,
          side_effects: false
        }
      },
      400
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const proposal = buildSkillExecutionProposal({
    skillRouting: input.skillRouting,
    intentClassification: input.intentClassification,
    selfAudit: input.selfAudit,
    responsePolicy: input.responsePolicy,
    chatContext: input.chatContext
  });
  const gate = registerSkillProposal(proposal.skill_execution);
  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/propose",
      proposal_id: gate.proposal_id,
      proposal_status: gate.status,
      side_effects: false,
      executed: false,
      skill_execution: proposal.skill_execution
    },
    200
  );
}
__name(handleSkillsPropose, "handleSkillsPropose");
function _blockedSkillGateResponse(route, code, message, detail) {
  return jsonResponse(
    {
      ok: false,
      error: code,
      message,
      detail: detail || null,
      route,
      side_effects: false,
      executed: false,
      proposal_status: "blocked",
      skill_execution: {
        mode: "proposal",
        status: "blocked",
        skill_id: null,
        reason: message,
        requires_approval: false,
        side_effects: false
      }
    },
    code === "INVALID_JSON" ? 400 : 409
  );
}
__name(_blockedSkillGateResponse, "_blockedSkillGateResponse");
async function handleSkillsApprove(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillGateResponse(
      "POST /skills/approve",
      "INVALID_JSON",
      "JSON inv\xE1lido em /skills/approve.",
      String(err)
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const result = approveSkillProposal(input);
  const route = "POST /skills/approve";
  const blocked = result.ok !== true;
  const proposal = result.proposal || null;
  return jsonResponse(
    {
      ok: !blocked,
      route,
      proposal_id: result.proposal_id || null,
      proposal_status: result.status,
      side_effects: false,
      executed: false,
      ...blocked ? { error: "APPROVAL_BLOCKED", message: result.reason || "Approval bloqueado." } : {},
      skill_execution: {
        mode: "proposal",
        status: result.status,
        skill_id: proposal?.skill_id || null,
        reason: result.reason || proposal?.reason || "Approval processado.",
        requires_approval: false,
        side_effects: false
      }
    },
    blocked ? 409 : 200
  );
}
__name(handleSkillsApprove, "handleSkillsApprove");
async function handleSkillsReject(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillGateResponse(
      "POST /skills/reject",
      "INVALID_JSON",
      "JSON inv\xE1lido em /skills/reject.",
      String(err)
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const result = rejectSkillProposal(input);
  const route = "POST /skills/reject";
  const blocked = result.ok !== true;
  const proposal = result.proposal || null;
  return jsonResponse(
    {
      ok: !blocked,
      route,
      proposal_id: result.proposal_id || null,
      proposal_status: result.status,
      side_effects: false,
      executed: false,
      ...blocked ? { error: "REJECT_BLOCKED", message: result.reason || "Reject bloqueado." } : {},
      skill_execution: {
        mode: "proposal",
        status: result.status,
        skill_id: proposal?.skill_id || null,
        reason: result.reason || proposal?.reason || "Reject processado.",
        requires_approval: false,
        side_effects: false
      }
    },
    blocked ? 409 : 200
  );
}
__name(handleSkillsReject, "handleSkillsReject");
var SKILLS_RUN_PATH = `/skills/${"run"}`;
function _blockedSkillRunResponse(code, message, detail, input = {}, status = 409) {
  const payload = input && typeof input === "object" && !Array.isArray(input) ? input : {};
  return jsonResponse(
    {
      ok: false,
      route: "POST /skills/run",
      path: "/skills/run",
      error: code,
      message,
      detail: detail || null,
      skill_id: payload.skill_id || null,
      run_id: null,
      executed: false,
      side_effects: false,
      result: null,
      evidence: {
        skill_id: payload.skill_id || null,
        proposal_id: payload.proposal_id || null,
        status: payload.proposal_status || payload?.approval?.status || "unknown",
        blocked: true
      }
    },
    status
  );
}
__name(_blockedSkillRunResponse, "_blockedSkillRunResponse");
async function handleSkillsRun(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillRunResponse(
      "INVALID_JSON",
      "JSON inv\xE1lido em /skills/run.",
      String(err),
      {},
      400
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const run = runRegisteredSkill(input, { nowMs: Date.now() });
  if (!run.ok) {
    return _blockedSkillRunResponse(
      run.error || "SKILL_RUN_BLOCKED",
      run.message || "Execu\xE7\xE3o bloqueada pelo runner.",
      run.detail || null,
      {
        skill_id: input.skill_id || null,
        proposal_id: input.proposal_id || null,
        proposal_status: input.proposal_status || input?.approval?.status || "unknown"
      },
      Number.isFinite(run.status_code) ? run.status_code : 409
    );
  }
  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/run",
      skill_id: input.skill_id || null,
      run_id: run.run_id,
      executed: run.executed === true,
      side_effects: run.side_effects === true,
      result: run.result,
      evidence: run.evidence || null
    },
    200
  );
}
__name(handleSkillsRun, "handleSkillsRun");
function _blockedSkillFactoryResponse(route, code, message, detail, status = 409) {
  return jsonResponse(
    {
      ok: false,
      route,
      error: code,
      message,
      detail: detail || null,
      side_effects: false,
      executed: false,
      prepared: false
    },
    status
  );
}
__name(_blockedSkillFactoryResponse, "_blockedSkillFactoryResponse");
async function handleSkillFactorySpec(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/spec",
      "INVALID_JSON",
      "JSON inv\xE1lido em /skills/factory/spec.",
      String(err),
      400
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const skillSpec = buildSkillSpec(input);
  const validation = validateSkillSpec(skillSpec);
  if (!validation.ok) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/spec",
      "INVALID_SKILL_SPEC",
      "Falha ao validar skill_spec gerada.",
      validation.errors,
      422
    );
  }
  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/factory/spec",
      side_effects: false,
      executed: false,
      prepared: false,
      skill_spec: skillSpec
    },
    200
  );
}
__name(handleSkillFactorySpec, "handleSkillFactorySpec");
async function handleSkillFactoryCreate(request) {
  let body;
  try {
    body = await request.json();
  } catch (err) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "INVALID_JSON",
      "JSON inv\xE1lido em /skills/factory/create.",
      String(err),
      400
    );
  }
  const input = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const skillSpecSource = input.skill_spec && typeof input.skill_spec === "object" && !Array.isArray(input.skill_spec) ? input.skill_spec : buildSkillSpec(input);
  const validation = validateSkillSpec(skillSpecSource);
  if (!validation.ok) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "INVALID_SKILL_SPEC",
      "Skill spec inv\xE1lida para prepara\xE7\xE3o de pacote.",
      validation.errors,
      422
    );
  }
  if (input.approved_to_prepare_package !== true || typeof input.human_authorization_text !== "string" || input.human_authorization_text.trim().length === 0) {
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      "AUTHORIZATION_REQUIRED",
      "approved_to_prepare_package=true e human_authorization_text s\xE3o obrigat\xF3rios.",
      null,
      403
    );
  }
  const packageResult = buildSkillCreationPackage(skillSpecSource, {
    approved_to_prepare_package: true,
    human_authorization_text: input.human_authorization_text
  });
  if (!packageResult.ok) {
    const statusCode = packageResult.error === "SKILL_SPEC_BLOCKED" ? 409 : 422;
    return _blockedSkillFactoryResponse(
      "POST /skills/factory/create",
      packageResult.error || "SKILL_FACTORY_CREATE_BLOCKED",
      "Pacote de cria\xE7\xE3o bloqueado.",
      packageResult.detail || null,
      statusCode
    );
  }
  return jsonResponse(
    {
      ok: true,
      route: "POST /skills/factory/create",
      side_effects: false,
      executed: false,
      prepared: true,
      skill_spec: skillSpecSource,
      skill_creation_package: packageResult.skill_creation_package
    },
    200
  );
}
__name(handleSkillFactoryCreate, "handleSkillFactoryCreate");
async function handleGithubBridgeExecute(request, env) {
  if (!_executeGithubBridgeRequest) {
    return jsonResponse(
      {
        ok: false,
        error: "ADAPTER_NOT_AVAILABLE",
        message: "GitHub Bridge adapter n\xE3o dispon\xEDvel \u2014 verifique o bundle.",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false
      },
      503
    );
  }
  let body;
  try {
    body = await request.json();
  } catch (_) {
    return jsonResponse(
      {
        ok: false,
        error: "INVALID_JSON",
        message: "Request body must be valid JSON.",
        github_execution: false,
        side_effects: false
      },
      400
    );
  }
  if (!body || typeof body !== "object") {
    return jsonResponse(
      {
        ok: false,
        error: "INVALID_PAYLOAD",
        message: "Payload inv\xE1lido para /github-bridge/execute.",
        github_execution: false,
        side_effects: false
      },
      400
    );
  }
  const operation = body.operation && typeof body.operation === "object" ? body.operation : body;
  const _opType = operation && typeof operation.type === "string" ? operation.type.toLowerCase().trim() : "";
  const _destBranch = operation && typeof operation.branch === "string" ? operation.branch.trim() : "";
  if (_opType === "create_commit" && (_destBranch === "main" || _destBranch === "master")) {
    return jsonResponse(
      {
        ok: false,
        blocked: true,
        error: "COMMIT_TO_PROTECTED_BRANCH",
        message: `Commit direto em "${_destBranch}" \xE9 proibido pelo GitHub Bridge \u2014 use uma branch de feature.`,
        github_execution: false,
        side_effects: false,
        merge_allowed: false
      },
      403
    );
  }
  const token = env && env.GITHUB_TOKEN || null;
  if (!token) {
    return jsonResponse(
      {
        ok: false,
        error: "GITHUB_TOKEN_NOT_CONFIGURED",
        message: "GITHUB_TOKEN n\xE3o configurado. Configure via: wrangler secret put GITHUB_TOKEN",
        github_execution: false,
        side_effects: false,
        ready_for_real_execution: false,
        hint: "Escopo m\xEDnimo do token: repo (leitura/escrita de PRs e branches)"
      },
      503
    );
  }
  try {
    const result = await _executeGithubBridgeRequest(operation, token);
    const httpStatus = result.ok ? 200 : result.blocked ? 403 : 500;
    return jsonResponse(result, httpStatus);
  } catch (err) {
    return jsonResponse(
      {
        ok: false,
        error: "INTERNAL_ERROR",
        message: String(err),
        github_execution: false,
        side_effects: false
      },
      500
    );
  }
}
__name(handleGithubBridgeExecute, "handleGithubBridgeExecute");
var nv_enavia_default = {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return handleCORSPreflight(request);
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/director/cognitive") {
        const response = await handleDirectorCognitiveProxy(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/chat/run") {
        const response = await handleChatLLM(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/planner/run") {
        const response = await handlePlannerRun(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/planner/bridge") {
        const response = await handlePlannerBridge(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/execution") {
        const response = await handleGetExecution(env);
        return withCORS(response);
      }
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/execution/decision") {
        const response = await handlePostDecision(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/execution/decisions") {
        const response = await handleGetDecisions(env, request);
        return withCORS(response);
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/health") {
        const response = await handleGetHealth(env);
        return withCORS(response);
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/chat/run") {
        return withCORS(jsonResponse({
          ok: true,
          route: "POST /chat/run",
          description: "Chat LLM-first \u2014 conversa livre com planner como ferramenta interna.",
          schema: {
            request: {
              message: "string (obrigat\xF3rio) \u2014 texto do usu\xE1rio",
              session_id: "string (opcional) \u2014 ID de sess\xE3o",
              context: "object (opcional) \u2014 contexto estrutural",
              conversation_history: "array (opcional) \u2014 hist\xF3rico recente [{role:'user'|'assistant', content:string}], max 20 msgs / 4000 chars"
            },
            response: {
              ok: "boolean",
              system: "string \u2014 'ENAVIA-NV-FIRST'",
              mode: "string \u2014 'llm-first'",
              reply: "string \u2014 resposta livre do LLM",
              planner_used: "boolean \u2014 se o planner foi acionado internamente",
              planner: "object (opcional) \u2014 snapshot do planner quando acionado",
              timestamp: "number \u2014 epoch ms",
              input: "string \u2014 texto do usu\xE1rio (echo)",
              telemetry: {
                duration_ms: "number",
                session_id: "string | null",
                pipeline: "string \u2014 'LLM-only' ou 'LLM + PM4\u2192PM9'",
                continuity_active: "boolean \u2014 true se conversation_history foi injetado no contexto LLM (PR7)",
                conversation_history_length: "number \u2014 quantidade de mensagens de hist\xF3rico injetadas",
                llm_parse_mode: "string \u2014 'json_parsed' | 'plain_text_fallback' | 'unknown' \u2014 se o LLM retornou JSON estruturado ou texto plano (PR7)",
                arbitration: {
                  pm4_level: "string \u2014 'A' | 'B' | 'C' (n\xEDvel PM4 do pedido)",
                  pm4_category: "string \u2014 'simple' | 'tactical' | 'complex'",
                  pm4_signals: "string[] \u2014 sinais detectados pelo PM4",
                  pm4_allows_planner: "boolean \u2014 PM4 \xE9 autoritativo: false bloqueia (A), true for\xE7a (B/C)",
                  llm_requested_planner: "boolean \u2014 LLM retornou use_planner=true (advisory only)",
                  final_decision: "string \u2014 'planner_activated' | 'planner_forced_level_BC' | 'planner_blocked_level_A'",
                  reply_sanitized: "string (opcional) \u2014 'manual_plan_replaced' se manual plan leak (layer-2) detectado",
                  reply_sanitized_layer1: "string (opcional) \u2014 'mechanical_term_leak_replaced' se leak de termos mec\xE2nicos (layer-1) detectado (PR7)"
                },
                gate_summary: "object (opcional) \u2014 resumo do gate quando planner rodou: { gate_status, needs_human_approval, can_proceed } (PR7)",
                planner_error: "string (opcional) \u2014 erro interno do planner quando for\xE7ado (Level B/C) mas falhou (PR7)",
                operational_awareness: {
                  browser_status: "string \u2014 estado do browser arm",
                  browser_can_act: "boolean",
                  executor_configured: "boolean",
                  approval_mode: "string",
                  human_gate_active: "boolean"
                }
              }
            }
          }
        }));
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/planner/run") {
        return withCORS(jsonResponse({
          ok: true,
          route: "POST /planner/run",
          description: "Planner endpoint can\xF4nico \u2014 executa pipeline PM4\u2192PM9 e retorna payload estruturado.",
          schema: {
            request: {
              message: "string (obrigat\xF3rio) \u2014 texto do usu\xE1rio",
              session_id: "string (opcional) \u2014 ID de sess\xE3o",
              context: "object (opcional) \u2014 contexto estrutural: { known_dependencies, mentions_prod, is_urgent }"
            },
            response: {
              ok: "boolean",
              system: "string \u2014 'ENAVIA-NV-FIRST'",
              timestamp: "number \u2014 epoch ms",
              input: "string \u2014 texto do usu\xE1rio (echo)",
              planner: {
                classification: "PM4 \u2014 classifyRequest output",
                canonicalPlan: "PM6 \u2014 buildCanonicalPlan output",
                gate: "PM7 \u2014 evaluateApprovalGate output",
                bridge: "PM8 \u2014 buildExecutorBridgePayload output",
                memoryConsolidation: "PM9 \u2014 consolidateMemoryLearning output",
                outputMode: "string \u2014 quick_reply | tactical_plan | formal_contract"
              },
              telemetry: {
                duration_ms: "number",
                session_id: "string | null",
                pipeline: "string \u2014 'PM4\u2192PM5\u2192PM6\u2192PM7\u2192PM8\u2192PM9\u2192P15'",
                consolidation_persisted: "array \u2014 [{memory_id, memory_type, is_canonical, kv_key, write_ok, error?}]"
              }
            }
          }
        }));
      }
    }
    if (request.method === "GET") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/planner/latest") {
        const response = await handlePlannerLatest(request, env);
        return withCORS(response);
      }
    }
    if (request.method === "POST") {
      const url2 = new URL(request.url);
      if (url2.pathname === "/browser/run" || url2.pathname === "/browser/execute") {
        if (request.headers.get("X-NV-Browser-Source") === "enavia-worker") {
          logNV("\u{1F534} [BROWSER/RUN] reentrada detectada \u2014 abortando loop");
          return withCORS(
            jsonResponse(
              { ok: false, error: "Loop detectado: request j\xE1 veio do pr\xF3prio worker" },
              508
            )
          );
        }
        try {
          const body = await request.json().catch(() => ({}));
          if (!body.plan && body.version === "plan.v1" && Array.isArray(body.steps)) {
            body.plan = { version: body.version, steps: body.steps };
          }
          if (body && typeof body === "object" && body.plan && Array.isArray(body.plan.steps)) {
            const execId = body.execution_id || body.plan.execution_id || `browser-${Date.now()}`;
            body.executor_action = "run_browser_plan";
            body.execution_id = execId;
            body.plan = {
              execution_id: execId,
              version: body.plan.version || "plan.v1",
              source: body.plan.source || "director",
              type: body.plan.type || "approved",
              steps: body.plan.steps
            };
            body.meta = {
              ...body.meta || {},
              source: "NV-CONTROL",
              channel: "BROWSER",
              ts: Date.now()
            };
          }
          if (!body?.plan?.steps || !Array.isArray(body.plan.steps)) {
            return withCORS(
              jsonResponse(
                { ok: false, error: "Plano inv\xE1lido" },
                400
              )
            );
          }
          const executorUrl = env.BROWSER_EXECUTOR_URL;
          if (!executorUrl) {
            return withCORS(
              jsonResponse(
                { ok: false, error: "BROWSER_EXECUTOR_URL n\xE3o configurado" },
                500
              )
            );
          }
          logNV("\u{1F310} [BROWSER/RUN] forwarding to executor", {
            executorUrl,
            hasPlan: !!body.plan,
            steps: body.plan?.steps?.length || 0
          });
          const executorPayload = {
            plan: body.plan
          };
          const execRes = await fetch(executorUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-NV-Browser-Source": "enavia-worker"
            },
            body: JSON.stringify(executorPayload)
          });
          const raw = await execRes.text();
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { raw };
          }
          return withCORS(
            jsonResponse(
              {
                ok: execRes.ok,
                execution_id: body.execution_id || null,
                result: parsed
              },
              execRes.status
            )
          );
        } catch (err) {
          return withCORS(
            jsonResponse(
              { ok: false, error: String(err) },
              500
            )
          );
        }
      }
    }
    if (request.method === "POST") {
      const urlObj = new URL(request.url);
      if (urlObj.pathname === "/browser-test") {
        if (request.headers.get("X-NV-Browser-Source") === "enavia-worker") {
          logNV("\u{1F534} [BROWSER/TEST] reentrada detectada \u2014 abortando loop");
          return withCORS(
            jsonResponse(
              { ok: false, error: "Loop detectado: request j\xE1 veio do pr\xF3prio worker" },
              508
            )
          );
        }
        try {
          const body = await request.json().catch(() => ({}));
          const targetUrl = body && typeof body.url === "string" && body.url.trim() || "https://google.com";
          const msRaw = Number(body?.ms ?? 5e3);
          const waitMs = Number.isFinite(msRaw) && msRaw > 0 ? msRaw : 5e3;
          const execId = body?.execution_id || `browser-test-${Date.now()}`;
          const plan = {
            execution_id: execId,
            version: "plan.v1",
            source: "nv-first",
            type: "smoke",
            steps: [
              { type: "open", url: targetUrl },
              { type: "wait", ms: waitMs }
            ]
          };
          const executorUrl = env.BROWSER_EXECUTOR_URL;
          if (!executorUrl) {
            return withCORS(
              jsonResponse(
                { ok: false, error: "BROWSER_EXECUTOR_URL n\xE3o configurado" },
                500
              )
            );
          }
          logNV("\u{1F310} [BROWSER/TEST] smoke externo", {
            executorUrl,
            execution_id: execId,
            url: targetUrl,
            waitMs
          });
          const execRes = await fetch(executorUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-NV-Browser-Source": "enavia-worker"
            },
            body: JSON.stringify({ plan })
          });
          const raw = await execRes.text();
          let parsed;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = { raw };
          }
          return withCORS(
            jsonResponse(
              {
                ok: execRes.ok,
                execution_id: execId,
                result: parsed
              },
              execRes.status
            )
          );
        } catch (err) {
          return withCORS(
            jsonResponse(
              { ok: false, error: String(err) },
              500
            )
          );
        }
      }
    }
    const url = new URL(request.url);
    const path = url.pathname;
    const method = request.method;
    if (method === "GET" && path === "/__internal__/build") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      const envName = (env.SUPABASE_BUCKET || "").toLowerCase().includes("test") ? "TEST" : "PROD";
      const workerName = envName === "TEST" ? "enavia-worker-teste" : "nv-enavia";
      return new Response(
        JSON.stringify(
          {
            ok: true,
            worker: workerName,
            env: envName,
            build: ENAVIA_BUILD,
            timestamp: (/* @__PURE__ */ new Date()).toISOString()
          },
          null,
          2
        ),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json"
          }
        }
      );
    }
    if (method === "POST" && path === "/enavia/observe") {
      return handleEnaviaObserve(request, env);
    }
    if (path === "/skills/propose") {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/propose.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillsPropose(request);
    }
    if (path === "/skills/approve") {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/approve.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillsApprove(request);
    }
    if (path === "/skills/reject") {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/reject.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillsReject(request);
    }
    if (path === SKILLS_RUN_PATH) {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/run.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillsRun(request);
    }
    if (path === "/skills/factory/spec") {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/factory/spec.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillFactorySpec(request);
    }
    if (path === "/skills/factory/create") {
      if (method !== "POST") {
        return jsonResponse(
          {
            ok: false,
            error: "METHOD_NOT_ALLOWED",
            message: "Use POST em /skills/factory/create.",
            method,
            path,
            allowed_methods: ["POST"]
          },
          405
        );
      }
      return handleSkillFactoryCreate(request);
    }
    if (method === "POST" && path === "/propose") {
      const startedAt = Date.now();
      let body;
      try {
        body = await request.json();
      } catch (err) {
        return withCORS(
          errorResponse("JSON inv\xE1lido em /propose.", 400, { detail: String(err) })
        );
      }
      if (!body || typeof body !== "object") body = {};
      const execution_id = String(body.execution_id || `ex_${Date.now()}`);
      const target = body?.target || {};
      const workerId = String(target?.workerId || body?.workerId || "").trim();
      const patchObj = body?.patch || null;
      const patchText = patchObj && typeof patchObj === "object" && typeof patchObj.content === "string" ? patchObj.content : typeof patchObj === "string" ? patchObj : "";
      const prompt = typeof body?.prompt === "string" && body.prompt.trim() ? body.prompt.trim() : typeof body?.intent === "string" && body.intent.trim() ? body.intent.trim() : "Gere 1\u20132 sugest\xF5es LOW-RISK para melhorar logs/clareza, sem mudar comportamento nem quebrar rotas.";
      const incomingConstraints = body?.constraints && typeof body.constraints === "object" ? body.constraints : {};
      const constraints = { ...incomingConstraints, read_only: true, no_auto_apply: true };
      const execPayload = {
        execution_id,
        executor_action: "propose",
        mode: "enavia_propose",
        source: body?.source || "ps_propose",
        ask_suggestions: typeof body?.ask_suggestions === "boolean" ? body.ask_suggestions : true,
        generatePatch: true,
        constraints,
        // ✅ NOVO: não trava nada, só habilita cognição no Executor quando você pedir
        intent: body?.intent || "propose",
        context: body?.context || void 0,
        target: workerId ? { system: "cloudflare_worker", workerId } : void 0,
        patch: patchText ? { type: "patch_text", content: patchText } : void 0,
        prompt
      };
      let execRes, execStatus, execText, execJson;
      try {
        execRes = await env.EXECUTOR.fetch("https://enavia-executor.internal/audit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(execPayload)
        });
        execStatus = execRes.status;
        execText = await execRes.text();
        try {
          execJson = JSON.parse(execText);
        } catch {
          execJson = null;
        }
      } catch (err) {
        return withCORS(
          jsonResponse(
            {
              ok: false,
              execution_id,
              error: "Falha ao chamar EXECUTOR para propose.",
              detail: String(err)
            },
            502
          )
        );
      }
      const ok = execStatus >= 200 && execStatus < 300;
      return withCORS(
        jsonResponse(
          {
            ok,
            execution_id,
            duration_ms: Date.now() - startedAt,
            executor: { status: execStatus, ok },
            propose: execJson || { raw: execText },
            next_actions: [
              "Se quiser avan\xE7ar no pipeline: rode POST /audit com o MESMO execution_id (e o patch que voc\xEA escolher).",
              "Somente o /audit carimba no Deploy Worker."
            ]
          },
          ok ? 200 : 502
        )
      );
    }
    if (method === "GET" && path === "/audit") {
      return jsonResponse({
        ok: true,
        route: "POST /audit",
        description: "Audit endpoint can\xF4nico (read-only, n\xE3o aplica nada). Envia para EXECUTOR + carimba no DEPLOY_WORKER.",
        schema: {
          execution_id: "string (obrigat\xF3rio)",
          mode: '"enavia_audit" (obrigat\xF3rio, literal)',
          source: "string (obrigat\xF3rio)",
          target: {
            system: "string (obrigat\xF3rio)",
            workerId: "string (obrigat\xF3rio)"
          },
          patch: {
            type: '"patch_text" (obrigat\xF3rio, literal)',
            content: "string (obrigat\xF3rio, conte\xFAdo do patch)"
          },
          constraints: {
            read_only: "true (obrigat\xF3rio)",
            no_auto_apply: "true (obrigat\xF3rio)"
          }
        },
        smoke_example: {
          execution_id: "smoke-test-001",
          mode: "enavia_audit",
          source: "smoke-test",
          target: { system: "enavia", workerId: "enavia-worker-teste" },
          patch: { type: "patch_text", content: "// smoke test patch" },
          constraints: { read_only: true, no_auto_apply: true }
        },
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      }, 200);
    }
    if (method === "POST" && path === "/audit") {
      const startedAt = Date.now();
      const rawText = await request.text().catch(() => "");
      let body = {};
      try {
        body = rawText ? JSON.parse(rawText) : {};
      } catch (_) {
        return jsonResponse(
          {
            ok: false,
            error: "INVALID_JSON",
            message: "Body n\xE3o \xE9 JSON v\xE1lido."
          },
          400
        );
      }
      const wantsPropose = body?.ask_suggestions === true;
      if (wantsPropose) {
        const t = body?.target || null;
        const hasTarget = !!(t && t.system && t.workerId);
        if (!hasTarget) {
          return jsonResponse(
            {
              ok: false,
              error: "TARGET_REQUIRED_FOR_PROPOSE",
              execution_id: body?.execution_id || null,
              message: "Para pedir PROPOSE, envie target { system, workerId }."
            },
            400
          );
        }
      }
      const execution_id = body?.execution_id || null;
      const mode = body?.mode || null;
      const source = body?.source || null;
      const target = body?.target || null;
      const patch = body?.patch || null;
      const constraints = body?.constraints || {};
      const readOnly = constraints?.read_only === true;
      const noAutoApply = constraints?.no_auto_apply === true;
      const errors = [];
      if (!execution_id || typeof execution_id !== "string") errors.push("execution_id obrigat\xF3rio (string).");
      if (mode !== "enavia_audit") errors.push('mode deve ser "enavia_audit".');
      if (!source || typeof source !== "string") errors.push("source obrigat\xF3rio (string).");
      if (!target || typeof target !== "object") errors.push("target obrigat\xF3rio (object).");
      if (!target?.system || typeof target.system !== "string") errors.push("target.system obrigat\xF3rio (string).");
      if (!target?.workerId || typeof target.workerId !== "string") errors.push("target.workerId obrigat\xF3rio (string).");
      if (!patch || typeof patch !== "object") errors.push("patch obrigat\xF3rio (object).");
      if (patch?.type !== "patch_text") errors.push('patch.type deve ser "patch_text".');
      if (!patch?.content || typeof patch.content !== "string") errors.push("patch.content obrigat\xF3rio (string).");
      if (!readOnly) errors.push("constraints.read_only deve ser true (imut\xE1vel).");
      if (!noAutoApply) errors.push("constraints.no_auto_apply deve ser true (imut\xE1vel).");
      if (errors.length) {
        return jsonResponse(
          {
            ok: false,
            error: "SCHEMA_VALIDATION_FAILED",
            execution_id,
            details: errors
          },
          400
        );
      }
      const patchText = patch.content;
      const auditStartedAt = Date.now();
      const audit = analyzePatchText(patchText);
      let contextAudit = null;
      const sourceSnapshot = typeof body?.context?.source_snapshot === "string" ? body.context.source_snapshot : null;
      if (sourceSnapshot) {
        try {
          contextAudit = analyzeWorkerSnapshot(sourceSnapshot, patchText);
        } catch (err) {
          const snapText = String(sourceSnapshot || "");
          const errMsg = String(err?.message || err || "unknown_error");
          contextAudit = {
            summary: {
              snapshot_chars: snapText.length,
              snapshot_lines: snapText ? snapText.split("\n").length : 0
            },
            blockers: [],
            findings: [
              `Snapshot analyzer falhou e foi isolado (n\xE3o deve quebrar /audit): ${errMsg}`
            ],
            impacted_areas: [],
            recommended_changes: [],
            unknowns: [
              "Falha ao analisar context.source_snapshot; trate como se N\xC3O houvesse snapshot (sem garantia total)."
            ]
          };
        }
      }
      if (!sourceSnapshot && Array.isArray(audit?.unknowns)) {
        audit.unknowns.unshift(
          "Compatibilidade total n\xE3o pode ser garantida sem snapshot do worker alvo (context.source_snapshot)."
        );
      }
      const blockers = [
        ...audit.blockers,
        ...contextAudit?.blockers || []
      ];
      const local_risk_level = calcRiskLevel(audit, contextAudit);
      const local_verdict = blockers.length > 0 || local_risk_level === "high" ? "reject" : "approve";
      let risk_level = local_risk_level;
      let verdict = local_verdict;
      let executor_audit = null;
      let executor_bridge = null;
      try {
        const canUseExecutorBinding = typeof env?.EXECUTOR?.fetch === "function";
        if (canUseExecutorBinding) {
          const targetWorkerId = String(target?.workerId || "");
          const execPayload = {
            executor_action: "audit",
            constraints: { read_only: true, no_auto_apply: true },
            workerId: targetWorkerId || void 0,
            patch: patchText ? { type: "patch_text", content: patchText } : void 0,
            // ✅ repassa snapshot se existir (melhora prova), mas o executor pode auto-ler também
            context: { execution_id, ...sourceSnapshot ? { source_snapshot: sourceSnapshot } : {} }
          };
          const execRes = await env.EXECUTOR.fetch("https://enavia-executor.internal/audit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(execPayload)
          });
          const execJson = await execRes.json().catch(() => null);
          const execOk = execJson?.ok === true || execJson?.result?.ok === true;
          if (execOk) {
            executor_audit = execJson?.result || execJson;
            const execRisk = executor_audit?.risk_level || executor_audit?.risk || executor_audit?.riskReport?.level || executor_audit?.riskReport?.risk_level || null;
            if (execRisk === "low" || execRisk === "medium" || execRisk === "high") {
              risk_level = execRisk;
              verdict = execRisk === "high" ? "reject" : "approve";
            }
            executor_bridge = {
              used: true,
              status: execRes.status,
              ok: true,
              auditId: executor_audit?.auditId || executor_audit?.audit_id || null,
              risk_level
            };
          } else {
            executor_bridge = {
              used: true,
              status: execRes.status,
              ok: false,
              error: execJson?.error || execJson?.result?.error || "EXECUTOR_AUDIT_FAILED"
            };
          }
        } else {
          executor_bridge = { used: false, error: "NO_EXECUTOR_BINDING" };
        }
      } catch (err) {
        executor_bridge = { used: false, error: String(err) };
      }
      const executorContextUsed = executor_audit?.context_used === true || executor_audit?.details?.context_used === true || executor_audit?.context?.used === true || false;
      const executorContextProof = executor_audit?.context_proof || executor_audit?.details?.context_proof || executor_audit?.context?.proof || null;
      const context_used = Boolean(sourceSnapshot) || Boolean(executorContextUsed) || Boolean(executorContextProof);
      const executorOk = executor_bridge?.ok === true;
      if (!executorOk) {
        return jsonResponse(
          {
            ok: false,
            error: "AUDIT_EXECUTOR_FAILED",
            execution_id,
            message: "AUDIT bloqueado: executor n\xE3o conseguiu auditar (sem prova de leitura do alvo). N\xE3o carimba.",
            executor_bridge,
            next_actions: ["check_executor", "retry_audit"]
          },
          502
        );
      }
      if (!context_used) {
        return jsonResponse(
          {
            ok: false,
            error: "AUDIT_NO_CONTEXT_PROOF",
            execution_id,
            message: "AUDIT bloqueado: sem prova de leitura do worker-alvo (snapshot/prova do executor). Sem leitura n\xE3o h\xE1 auditoria v\xE1lida nem carimbo.",
            next_actions: ["provide_snapshot_or_enable_executor_read", "retry_audit"]
          },
          422
        );
      }
      const findings = [
        ...audit.findings,
        ...contextAudit?.findings || []
      ];
      const impacted_areas = uniq([
        ...audit.impacted_areas,
        ...contextAudit?.impacted_areas || []
      ]);
      const recommended_changes = [
        ...audit.recommended_changes,
        ...contextAudit?.recommended_changes || []
      ];
      const unknowns = uniq([
        ...audit.unknowns,
        ...contextAudit?.unknowns || []
      ]);
      const context_proof = sourceSnapshot ? {
        snapshot_fingerprint: simpleFingerprint(String(sourceSnapshot)),
        snapshot_chars: String(sourceSnapshot).length
      } : executorContextProof || { via: "executor", note: "executor_provided_proof" };
      const response = {
        ok: true,
        execution_id,
        audit: {
          verdict,
          risk_level,
          findings,
          impacted_areas,
          recommended_changes,
          // 👇 feed “cirúrgico” (detalhes)
          details: {
            constraints: {
              read_only: true,
              no_auto_apply: true
            },
            patch_fingerprint: audit.fingerprint,
            patch_stats: audit.stats,
            patch_hotspots: audit.hotspots,
            patch_dangers: audit.dangers,
            patch_syntax: audit.syntax,
            patch_semantics: audit.semantics,
            blockers,
            unknowns,
            context_used: true,
            context_proof,
            context_summary: contextAudit?.summary || null,
            duration_ms: Date.now() - auditStartedAt,
            // ✅ prova objetiva da ponte com o executor
            executor_bridge
          }
        },
        next_actions: verdict === "approve" ? ["human_approve", "send_to_deploy_worker"] : ["revise_patch", "re_audit"]
      };
      const can_stamp_dw = verdict === "approve" && Array.isArray(blockers) && blockers.length === 0;
      if (!can_stamp_dw) {
        response.dw_stamp = {
          skipped: true,
          reason: verdict !== "approve" ? "verdict_not_approve" : "blockers_present",
          message: "Carimbo bloqueado pelo contrato: auditoria n\xE3o aprovada ou blockers presentes.",
          next_actions: ["propose_safe_patch", "re_audit"]
        };
        return jsonResponse(response, 200);
      }
      try {
        const auditPayload = {
          execution_id,
          audit: {
            ok: verdict === "approve",
            risk_level
          }
        };
        try {
          const hasDeployBinding = typeof env?.DEPLOY_WORKER?.fetch === "function";
          let dwRes;
          let attemptedUrl;
          if (hasDeployBinding) {
            attemptedUrl = "binding://DEPLOY_WORKER/audit";
            dwRes = await env.DEPLOY_WORKER.fetch("https://deploy-worker.internal/audit", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...env?.INTERNAL_TOKEN ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) } : {}
              },
              body: JSON.stringify(auditPayload)
            });
          } else {
            const dwBase = env?.DEPLOY_WORKER_URL && String(env.DEPLOY_WORKER_URL) || "https://deploy-worker.brunovasque.workers.dev";
            attemptedUrl = `${dwBase.replace(/\/+$/, "")}/audit`;
            dwRes = await fetch(attemptedUrl, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...env?.INTERNAL_TOKEN ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) } : {}
              },
              body: JSON.stringify(auditPayload)
            });
          }
          const dwText = await dwRes.text();
          logNV("\u2705 [AUDIT->DEPLOY_WORKER] resposta", {
            execution_id,
            status: dwRes.status,
            preview: dwText.slice(0, 300)
          });
          response.dw_stamp = {
            attempted_url: attemptedUrl,
            status: dwRes.status,
            ok: dwRes.ok,
            preview: dwText.slice(0, 300)
          };
          try {
            let stRes;
            let stAttemptedUrl;
            if (hasDeployBinding) {
              stAttemptedUrl = `binding://DEPLOY_WORKER/status/${execution_id}`;
              stRes = await env.DEPLOY_WORKER.fetch(
                `https://deploy-worker.internal/status/${encodeURIComponent(execution_id)}`,
                {
                  method: "GET",
                  headers: {
                    ...env?.INTERNAL_TOKEN ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) } : {}
                  }
                }
              );
            } else {
              const dwBase = env?.DEPLOY_WORKER_URL && String(env.DEPLOY_WORKER_URL) || "https://deploy-worker.brunovasque.workers.dev";
              stAttemptedUrl = `${dwBase.replace(/\/+$/, "")}/status/${encodeURIComponent(execution_id)}`;
              stRes = await fetch(stAttemptedUrl, {
                method: "GET",
                headers: {
                  ...env?.INTERNAL_TOKEN ? { "X-Internal-Token": String(env.INTERNAL_TOKEN) } : {}
                }
              });
            }
            const stText = await stRes.text();
            let stJson = null;
            try {
              stJson = JSON.parse(stText);
            } catch (_) {
            }
            response.dw_status = {
              attempted_url: stAttemptedUrl,
              status: stRes.status,
              ok: stRes.ok,
              data: stJson || null,
              preview: (stText || "").slice(0, 600)
            };
          } catch (err) {
            response.dw_status = {
              attempted_url: `binding://DEPLOY_WORKER/status/${execution_id}`,
              ok: false,
              error: String(err)
            };
          }
        } catch (err) {
          logNV("\u26A0\uFE0F [AUDIT->DEPLOY_WORKER] Falhou ao gravar carimbo", {
            execution_id,
            workerId: target?.workerId,
            err: String(err)
          });
          response.dw_stamp = {
            attempted_url: "binding://DEPLOY_WORKER/audit",
            error: String(err)
          };
        }
      } catch (_) {
      }
      return jsonResponse(response, 200);
    }
    function analyzePatchText(patchText) {
      const text = String(patchText || "");
      const lines = text.split("\n");
      const chars = text.length;
      const stats = {
        lines: lines.length,
        chars,
        approx_tokens: Math.ceil(chars / 4),
        has_diff_markers: /^(diff --git|@@\s+-\d+,\d+\s+\+\d+,\d+|---\s+|\+\+\+\s+)/m.test(text),
        has_code_fences: /```/.test(text)
      };
      const fingerprint = simpleFingerprint(text);
      const syntax = basicSyntaxChecks(text);
      const dangers = detectDangers(text);
      const semantics = detectSemantics(text);
      const hotspots = findHotspots(lines);
      const blockers = [];
      if (!syntax.ok) blockers.push("Patch com risco alto de erro de sintaxe/estrutura (checks falharam).");
      if (dangers.includes("LEAK_SECRET")) blockers.push("Patch aparenta vazar segredo/token/chave.");
      if (dangers.includes("AUTO_PROD_DEPLOY")) blockers.push("Patch sugere deploy/a\xE7\xE3o direta em produ\xE7\xE3o (proibido).");
      if (dangers.includes("EVAL_OR_FUNCTION")) blockers.push("Uso de eval/new Function detectado (alto risco).");
      if (dangers.includes("WILDCARD_DELETE")) blockers.push("A\xE7\xE3o destrutiva ampla (delete/flush) detectada.");
      const findings = [];
      if (stats.has_diff_markers) findings.push("Patch parece estar em formato diff (ok).");
      if (stats.has_code_fences) findings.push("Patch cont\xE9m code fences (cuidado com copiar bloco incompleto).");
      if (semantics.includes("ROUTING_CHANGE")) findings.push("Patch altera roteamento/rotas.");
      if (semantics.includes("CORS_CHANGE")) findings.push("Patch mexe em CORS/preflight.");
      if (semantics.includes("AUTH_CHANGE")) findings.push("Patch mexe em autoriza\xE7\xE3o/token.");
      if (semantics.includes("KV_CHANGE")) findings.push("Patch mexe em KV/estado.");
      if (semantics.includes("BINDING_CHANGE")) findings.push("Patch mexe em Service Binding/env.");
      if (semantics.includes("FETCH_CHANGE")) findings.push("Patch mexe em fetch/chamadas internas.");
      const impacted_areas = [];
      if (semantics.includes("ROUTING_CHANGE")) impacted_areas.push("routing");
      if (semantics.includes("CORS_CHANGE")) impacted_areas.push("cors");
      if (semantics.includes("AUTH_CHANGE")) impacted_areas.push("auth");
      if (semantics.includes("KV_CHANGE")) impacted_areas.push("kv");
      if (semantics.includes("BINDING_CHANGE")) impacted_areas.push("bindings");
      if (semantics.includes("FETCH_CHANGE")) impacted_areas.push("networking");
      if (semantics.includes("INTERNAL_ROUTES")) impacted_areas.push("internal_handshake");
      const recommended_changes = [];
      if (stats.has_code_fences) recommended_changes.push("Remover ``` do patch antes de aplicar (evita colar artefato).");
      if (!syntax.ok) recommended_changes.push("Revisar chaves/parenteses/quotes e garantir bloco completo antes de aplicar.");
      if (semantics.includes("ROUTING_CHANGE")) recommended_changes.push("Garantir que rotas __internal__ sejam PRIMEIRO return.");
      if (semantics.includes("FETCH_CHANGE")) recommended_changes.push("Preferir Service Binding (env.<BINDING>.fetch) ao inv\xE9s de URL p\xFAblica.");
      const unknowns = [];
      unknowns.push("Efeitos colaterais em runtime s\xF3 podem ser confirmados em TEST com PATCH_STATUS=tested.");
      return {
        fingerprint,
        stats,
        syntax,
        dangers,
        semantics,
        hotspots,
        blockers,
        findings,
        impacted_areas,
        recommended_changes,
        unknowns
      };
    }
    __name(analyzePatchText, "analyzePatchText");
    function analyzeWorkerSnapshot(workerText, patchText) {
      const w = String(workerText || "");
      const findings = [];
      const blockers = [];
      const impacted_areas = [];
      const recommended_changes = [];
      const unknowns = [];
      const hasFetchExport = /export\s+default\s*\{\s*async\s+fetch\s*\(/.test(w);
      if (!hasFetchExport) findings.push("Snapshot: padr\xE3o export default { async fetch(...) } n\xE3o detectado (pode ser outro estilo).");
      const hasInternalNormalize = /normalizeInternalPath\s*\(/.test(w);
      if (!hasInternalNormalize) findings.push("Snapshot: normalizeInternalPath n\xE3o encontrado (rotas internas podem n\xE3o existir).");
      const idxInternal = w.indexOf("/__internal__/");
      const idxCors = w.toLowerCase().indexOf("cors");
      if (idxInternal >= 0 && idxCors >= 0 && idxInternal > idxCors) {
        blockers.push("Snapshot: l\xF3gica __internal__ aparenta estar depois do CORS/roteamento (risco de n\xE3o ser alcan\xE7ada).");
        impacted_areas.push("internal_handshake");
        impacted_areas.push("cors");
        recommended_changes.push("Mover bloco __internal__ para PRIMEIRO return dentro do fetch.");
      }
      const patchMentionsTargetWorker = /env\.TARGET_WORKER\b/.test(patchText);
      const workerHasTargetWorkerBinding = /TARGET_WORKER\b/.test(w);
      if (patchMentionsTargetWorker && !workerHasTargetWorkerBinding) {
        findings.push("Patch usa env.TARGET_WORKER mas snapshot n\xE3o mostra binding/uso expl\xEDcito (confirmar bindings no Cloudflare).");
        impacted_areas.push("bindings");
      }
      if (/(INTERNAL_TOKEN\s*=\s*["']|Bearer\s+)/.test(w)) {
        findings.push("Snapshot: h\xE1 padr\xF5es relacionados a token/auth; garantir que nada seja logado.");
        impacted_areas.push("auth");
      }
      unknowns.push("Mesmo com snapshot, depend\xEAncias externas (bindings/KV/env) precisam ser confirmadas no dashboard.");
      return {
        summary: {
          snapshot_chars: w.length,
          snapshot_lines: w.split("\n").length
        },
        blockers,
        findings,
        impacted_areas: uniq(impacted_areas),
        recommended_changes,
        unknowns
      };
    }
    __name(analyzeWorkerSnapshot, "analyzeWorkerSnapshot");
    function calcRiskLevel(audit, contextAudit) {
      if (!audit.syntax.ok) return "high";
      const dangerSet = /* @__PURE__ */ new Set([...audit.dangers || [], ...contextAudit?.dangers || []]);
      if (dangerSet.has("LEAK_SECRET")) return "high";
      if (dangerSet.has("AUTO_PROD_DEPLOY")) return "high";
      if (dangerSet.has("EVAL_OR_FUNCTION")) return "high";
      if (dangerSet.has("WILDCARD_DELETE")) return "high";
      const sem = /* @__PURE__ */ new Set([...audit.semantics || []]);
      const mediumTriggers = ["AUTH_CHANGE", "ROUTING_CHANGE", "KV_CHANGE", "FETCH_CHANGE", "BINDING_CHANGE"];
      if (mediumTriggers.some((k) => sem.has(k))) return "medium";
      return "low";
    }
    __name(calcRiskLevel, "calcRiskLevel");
    function basicSyntaxChecks(text) {
      const res = { ok: true, issues: [] };
      const balance = /* @__PURE__ */ __name((s, open, close) => {
        let n = 0;
        for (let i = 0; i < s.length; i++) {
          const c = s[i];
          if (c === open) n++;
          if (c === close) n--;
          if (n < 0) return { ok: false, at: i };
        }
        return { ok: n === 0, at: -1, remaining: n };
      }, "balance");
      const b1 = balance(text, "{", "}");
      if (!b1.ok) res.issues.push("Chaves { } parecem desbalanceadas.");
      const b2 = balance(text, "(", ")");
      if (!b2.ok) res.issues.push("Par\xEAnteses ( ) parecem desbalanceados.");
      const b3 = balance(text, "[", "]");
      if (!b3.ok) res.issues.push("Colchetes [ ] parecem desbalanceados.");
      if (/export\s+default/.test(text) && !/;\s*$/.test(text.trim())) {
        res.issues.push("Patch cont\xE9m 'export default' \u2014 confirmar se \xE9 arquivo completo ou trecho.");
      }
      if (/undefined\s*:\s*/.test(text)) res.issues.push("Encontrado padr\xE3o 'undefined:' (colagem/JSON inv\xE1lido?).");
      res.ok = res.issues.length === 0;
      return res;
    }
    __name(basicSyntaxChecks, "basicSyntaxChecks");
    function detectDangers(text) {
      const d = [];
      if (/(console\.log\([^)]*(token|secret|key|authorization|bearer)[^)]*\))/i.test(text)) d.push("LEAK_SECRET");
      if (/(INTERNAL_TOKEN|API_KEY|SECRET|BEARER\s+)/i.test(text) && /console\.(log|debug|info)/i.test(text)) d.push("LEAK_SECRET");
      if (/\b(eval|new\s+Function)\b/.test(text)) d.push("EVAL_OR_FUNCTION");
      if (/prod(uction)?/i.test(text) && /(deploy|apply|promote)/i.test(text)) d.push("AUTO_PROD_DEPLOY");
      if (/\b(delete|flush|drop)\b/i.test(text) && /\b(KV|namespace|bucket|table)\b/i.test(text)) d.push("WILDCARD_DELETE");
      return uniq(d);
    }
    __name(detectDangers, "detectDangers");
    function detectSemantics(text) {
      const s = [];
      if (/\/__internal__\//.test(text)) s.push("INTERNAL_ROUTES");
      if (/\b(handleCORS|CORS|preflight)\b/i.test(text)) s.push("CORS_CHANGE");
      if (/\bAuthorization\b|\bBearer\b|\bINTERNAL_TOKEN\b/.test(text)) s.push("AUTH_CHANGE");
      if (/\bDEPLOY_KV\b|\bput\(|\bget\(|PATCH_STATUS:|STAGING:/i.test(text)) s.push("KV_CHANGE");
      if (/\bservices?\b|\bbinding\b|\bTARGET_WORKER\b|\benv\.[A-Z0-9_]+\b/i.test(text)) s.push("BINDING_CHANGE");
      if (/\bfetch\(/.test(text)) s.push("FETCH_CHANGE");
      if (/\bpathname\b|\burl\.pathname\b|\bmethod\b|\breturn\s+error\(|NOT_FOUND/i.test(text)) s.push("ROUTING_CHANGE");
      return uniq(s);
    }
    __name(detectSemantics, "detectSemantics");
    function findHotspots(lines) {
      const out = [];
      const keys = [
        "return",
        "__internal__",
        "Authorization",
        "Bearer",
        "INTERNAL_TOKEN",
        "CORS",
        "preflight",
        "fetch(",
        "DEPLOY_KV",
        "PATCH_STATUS",
        "STAGING:",
        "TARGET_WORKER",
        "binding"
      ];
      for (let i = 0; i < lines.length; i++) {
        const ln = lines[i];
        if (keys.some((k) => ln.includes(k))) {
          out.push({ line: i + 1, preview: ln.slice(0, 180) });
        }
      }
      return out.slice(0, 80);
    }
    __name(findHotspots, "findHotspots");
    function simpleFingerprint(text) {
      let h = 2166136261;
      for (let i = 0; i < text.length; i++) {
        h ^= text.charCodeAt(i);
        h = Math.imul(h, 16777619);
      }
      return "fnv1a32:" + (h >>> 0).toString(16).padStart(8, "0");
    }
    __name(simpleFingerprint, "simpleFingerprint");
    function uniq(arr) {
      return Array.from(new Set((arr || []).filter(Boolean)));
    }
    __name(uniq, "uniq");
    function normalizeInternalPath(pathname) {
      if (pathname.startsWith("/__internal__/")) return pathname;
      if (pathname.startsWith("/_internal_/")) {
        return "/__internal__/" + pathname.slice("/_internal_/".length);
      }
      return null;
    }
    __name(normalizeInternalPath, "normalizeInternalPath");
    const internalPath = normalizeInternalPath(path);
    function isInternalAuthorized(req, env2) {
      try {
        const auth = req.headers.get("Authorization") || "";
        const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
        return typeof env2.INTERNAL_TOKEN === "string" && token === env2.INTERNAL_TOKEN;
      } catch {
        return false;
      }
    }
    __name(isInternalAuthorized, "isInternalAuthorized");
    if (internalPath === "/__internal__/describe" && method === "GET") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      return new Response(
        JSON.stringify({
          ok: true,
          system: "NV-ENAVIA",
          role: "brain",
          env_hint: "test",
          internal: true,
          version: "internal-handshake-v1",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          routes: {
            describe: true,
            deploy_apply: true
          }
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (internalPath === "/__internal__/routes" && method === "GET") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      return jsonResponse({
        ok: true,
        worker: "ENAVIA-NV-FIRST",
        role: "discovery",
        version: "routes.v1",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        routes: [
          { path: "/__internal__/build", methods: ["GET"] },
          { path: "/__internal__/describe", methods: ["GET"] },
          { path: "/__internal__/routes", methods: ["GET"] },
          { path: "/__internal__/capabilities", methods: ["GET"] },
          { path: "/__internal__/deploy-apply", methods: ["POST"] },
          { path: "/__internal__/deploy-rollback", methods: ["POST"] },
          { path: "/audit", methods: ["POST", "OPTIONS"] },
          { path: "/propose", methods: ["POST", "OPTIONS"] }
        ]
      });
    }
    if (internalPath === "/__internal__/capabilities" && method === "GET") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      return jsonResponse({
        ok: true,
        worker: "ENAVIA-NV-FIRST",
        role: "discovery",
        version: "capabilities.v1",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        internal_auth: {
          type: "bearer",
          header: "Authorization",
          env_var: "INTERNAL_TOKEN"
        },
        capabilities: {
          propose: { enabled: true, read_only_supported: true },
          audit: { enabled: true },
          deploy_apply: { enabled: true, mode: "passive_handshake" },
          deploy_rollback: { enabled: true, mode: "passive_handshake" }
        },
        notes: [
          "Sem token v\xE1lido: deve retornar 401 (igual /__internal__/describe).",
          "Se retornar 404: endpoint n\xE3o foi inserido no worker."
        ]
      });
    }
    if (internalPath === "/__internal__/deploy-apply" && method === "POST") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      if (body && body.probe === true) {
        return new Response(
          JSON.stringify({
            ok: true,
            system: "NV-ENAVIA",
            internal: true,
            probe: true,
            mode: "passive",
            message: "deploy-apply endpoint exists (passive brain)."
          }),
          { headers: { "content-type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({
          ok: true,
          system: "NV-ENAVIA",
          internal: true,
          mode: "passive",
          received: {
            execution_id: body.execution_id || null,
            has_patch: Boolean(body?.patch?.content),
            requested_mode: body.mode || null
          },
          message: "Recebido em modo passivo (nenhuma execu\xE7\xE3o realizada).",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    if (internalPath === "/__internal__/deploy-rollback" && method === "POST") {
      if (!isInternalAuthorized(request, env)) {
        return new Response("unauthorized", { status: 401 });
      }
      const body = await request.json().catch(() => ({}));
      return new Response(
        JSON.stringify({
          ok: true,
          system: "NV-ENAVIA",
          internal: true,
          mode: "passive",
          received: {
            execution_id: body.execution_id || null,
            env: body.env || null,
            manual: body.manual === true
          },
          message: "deploy-rollback recebido em modo passivo (nenhuma a\xE7\xE3o executada).",
          timestamp: (/* @__PURE__ */ new Date()).toISOString()
        }),
        { headers: { "content-type": "application/json" } }
      );
    }
    const corsPreflight = handleCORSPreflight(request);
    if (corsPreflight) return corsPreflight;
    try {
      if (method === "POST" && path === "/") {
        return withCORS(await handleChatRequest(request, env));
      }
      if (method === "POST" && path === "/engineer") {
        return await handleEngineerRequest(request, env);
      }
      if (method === "POST" && path === "/reload") {
        return await handleReloadRequest(env);
      }
      if (method === "POST" && path === "/debug-load") {
        return await handleDebugLoad(request, env);
      }
      if (method === "POST" && path === "/brain-query") {
        return await handleBrainQuery(request, env);
      }
      if (method === "POST" && path === "/brain/get-module") {
        return await handleBrainGetModule(request, env);
      }
      if (method === "POST" && path === "/brain/director-query") {
        if (!isInternalAuthorized(request, env)) {
          return withCORS(new Response("unauthorized", { status: 401 }));
        }
        try {
          const body = await request.json();
          if (body.role !== "director") {
            return withCORS(new Response(
              JSON.stringify({
                ok: false,
                error: "ACCESS_DENIED_INVALID_ROLE"
              }),
              { status: 403, headers: { "Content-Type": "application/json" } }
            ));
          }
          const brain = await loadDirectorBrain(env);
          return withCORS(new Response(
            JSON.stringify({
              ok: true,
              brain: {
                role: "director",
                version: brain.version,
                modules: brain.modules,
                content: brain.content
              }
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          ));
        } catch (err) {
          return withCORS(new Response(
            JSON.stringify({
              ok: false,
              error: "DIRECTOR_BRAIN_ERROR",
              detail: String(err)
            }),
            { status: 500, headers: { "Content-Type": "application/json" } }
          ));
        }
      }
      if (method === "POST" && path === "/director/cognitive") {
        const res = await handleDirectorCognitiveProxy(request, env);
        return withCORS(res);
      }
      console.log("FETCH HIT:", request.method, new URL(request.url).pathname);
      if (method === "GET" && path === "/debug-brain") {
        return await handleDebugBrain(env);
      }
      if (method === "GET" && path === "/engineer") {
        return withCORS(new Response(
          JSON.stringify({
            ok: true,
            route: "/engineer",
            message: "Rota POST /engineer ativa."
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }
      if (method === "GET" && path === "/brain/read") {
        const systemPrompt = await env.ENAVIA_BRAIN.get("SYSTEM_PROMPT");
        return withCORS(new Response(
          JSON.stringify({
            ok: true,
            route: "/brain/read",
            systemPrompt: systemPrompt || "(nenhum SYSTEM_PROMPT encontrado)",
            index: NV_INDEX_CACHE || null,
            modulesLoaded: Object.keys(NV_MODULE_CACHE || {})
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        ));
      }
      if (method === "GET" && path === "/brain/index") {
        return await handleBrainIndex(request, env);
      }
      if (method === "POST" && path === "/contracts") {
        const result = await handleCreateContract(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "GET" && path === "/contracts") {
        const contractId = url.searchParams.get("id");
        const result = await handleGetContract(env, contractId);
        return jsonResponse(result.body, result.status);
      }
      if (method === "GET" && path === "/contracts/summary") {
        const contractId = url.searchParams.get("id");
        const result = await handleGetContractSummary(env, contractId);
        return jsonResponse(result.body, result.status);
      }
      if (method === "GET" && path === "/contracts/active-surface") {
        const result = await handleGetActiveSurface(env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "GET" && path === "/contracts/loop-status") {
        return await handleGetLoopStatus(env);
      }
      if (method === "POST" && path === "/contracts/execute-next") {
        return await handleExecuteNext(request, env);
      }
      if (method === "POST" && path === "/contracts/execute") {
        const result = await handleExecuteContract(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/close-test") {
        const result = await handleCloseContractInTest(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/cancel") {
        const result = await handleCancelContract(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/reject-plan") {
        const result = await handleRejectDecompositionPlan(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/resolve-plan-revision") {
        const result = await handleResolvePlanRevision(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/complete-task") {
        const result = await handleCompleteTask(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/advance-phase") {
        const result = await handleAdvancePhase(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/contracts/close-final") {
        const result = await handleCloseFinalContract(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/github-bridge/execute") {
        return handleGithubBridgeExecute(request, env);
      }
      if (method === "POST" && path === "/github-pr/action") {
        const result = await handleGitHubPrAction(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/github-pr/request-merge") {
        const result = await handleRequestMergeApproval(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/github-pr/approve-merge") {
        const result = await handleApproveMerge(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "POST" && path === "/browser-arm/action") {
        const result = await handleBrowserArmAction(request, env);
        return jsonResponse(result.body, result.status);
      }
      if (method === "GET" && path === "/browser-arm/state") {
        return jsonResponse(await getBrowserArmStateWithKV(env), 200);
      }
      if (method === "GET" && path === "/memory/manual") {
        try {
          const result = await searchMemory(
            { memory_type: MEMORY_TYPES.MEMORIA_MANUAL, include_inactive: true },
            env
          );
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.results, count: result.count });
        } catch (err) {
          logNV("\u274C [GET /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/manual") {
        try {
          const body = await request.json().catch(() => ({}));
          const now = (/* @__PURE__ */ new Date()).toISOString();
          const memId = body.memory_id || "manual-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 7);
          const memObj = buildMemoryObject({
            memory_id: memId,
            memory_type: MEMORY_TYPES.MEMORIA_MANUAL,
            entity_type: body.entity_type || ENTITY_TYPES.RULE,
            entity_id: body.entity_id || memId,
            title: body.title || "Mem\xF3ria manual sem t\xEDtulo",
            content_structured: body.content_structured || { text: body.content || "" },
            priority: body.priority || "high",
            confidence: body.confidence || "confirmed",
            source: "panel",
            created_at: now,
            updated_at: now,
            expires_at: body.expires_at || null,
            is_canonical: body.is_canonical === true,
            status: body.status || "active",
            flags: Array.isArray(body.flags) ? body.flags : [],
            tags: Array.isArray(body.tags) ? body.tags : []
          });
          const result = await writeMemory(memObj, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error, errors: result.errors }, 400);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record }, 201);
        } catch (err) {
          logNV("\u274C [POST /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "PATCH" && path === "/memory/manual") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be edited via this route" }, 403);
          }
          const patch = {};
          if (body.title !== void 0) patch.title = body.title;
          if (body.content_structured !== void 0) patch.content_structured = body.content_structured;
          else if (body.content !== void 0) patch.content_structured = { text: body.content };
          if (body.priority !== void 0) patch.priority = body.priority;
          if (body.confidence !== void 0) patch.confidence = body.confidence;
          if (body.status !== void 0) patch.status = body.status;
          if (body.tags !== void 0) patch.tags = body.tags;
          if (body.flags !== void 0) patch.flags = body.flags;
          if (body.expires_at !== void 0) patch.expires_at = body.expires_at;
          if (body.is_canonical !== void 0) patch.is_canonical = body.is_canonical;
          const result = await updateMemory(memId, patch, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error, errors: result.errors }, 400);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("\u274C [PATCH /memory/manual] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/manual/block") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be blocked via this route" }, 403);
          }
          const result = await blockMemory(memId, { blocked_by: "panel", blocked_at: (/* @__PURE__ */ new Date()).toISOString() }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("\u274C [POST /memory/manual/block] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/manual/invalidate") {
        try {
          const body = await request.json().catch(() => ({}));
          const memId = body.memory_id;
          if (!memId) {
            return jsonResponse({ ok: false, error: "memory_id is required" }, 400);
          }
          const existing = await readMemoryById(memId, env);
          if (!existing) {
            return jsonResponse({ ok: false, error: `memory_id '${memId}' not found` }, 404);
          }
          if (existing.memory_type !== MEMORY_TYPES.MEMORIA_MANUAL) {
            return jsonResponse({ ok: false, error: "only memoria_manual can be invalidated via this route" }, 403);
          }
          const result = await invalidateMemory(memId, { invalidated_by: "panel", invalidated_at: (/* @__PURE__ */ new Date()).toISOString() }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, memory_id: result.memory_id, record: result.record });
        } catch (err) {
          logNV("\u274C [POST /memory/manual/invalidate] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "GET" && path === "/memory/learning") {
        try {
          const url2 = new URL(request.url);
          const statusFilter = url2.searchParams.get("status") || void 0;
          const filters = statusFilter ? { status: statusFilter } : {};
          const result = await listLearningCandidates(env, filters);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.items, count: result.count });
        } catch (err) {
          logNV("\u274C [GET /memory/learning] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/learning") {
        try {
          const body = await request.json().catch(() => ({}));
          const result = await registerLearningCandidate({
            candidate_id: body.candidate_id,
            title: body.title,
            content_structured: body.content_structured || (body.content ? { text: body.content } : void 0),
            source: body.source || "panel",
            confidence: body.confidence || "medium",
            priority: body.priority || "medium",
            tags: Array.isArray(body.tags) ? body.tags : []
          }, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({ ok: true, candidate_id: result.candidate_id, record: result.record }, 201);
        } catch (err) {
          logNV("\u274C [POST /memory/learning] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/learning/approve") {
        try {
          const body = await request.json().catch(() => ({}));
          const candidateId = body.candidate_id;
          if (!candidateId) {
            return jsonResponse({ ok: false, error: "candidate_id is required" }, 400);
          }
          const result = await approveLearningCandidate(candidateId, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({
            ok: true,
            candidate_id: result.candidate_id,
            promoted_memory_id: result.promoted_memory_id,
            candidate: result.candidate
          });
        } catch (err) {
          logNV("\u274C [POST /memory/learning/approve] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "POST" && path === "/memory/learning/reject") {
        try {
          const body = await request.json().catch(() => ({}));
          const candidateId = body.candidate_id;
          if (!candidateId) {
            return jsonResponse({ ok: false, error: "candidate_id is required" }, 400);
          }
          const result = await rejectLearningCandidate(candidateId, body.reason, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 400);
          }
          return jsonResponse({
            ok: true,
            candidate_id: result.candidate_id,
            candidate: result.candidate
          });
        } catch (err) {
          logNV("\u274C [POST /memory/learning/reject] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "GET" && path === "/memory/audit") {
        try {
          const url2 = new URL(request.url);
          const filters = {};
          const eventType = url2.searchParams.get("event_type");
          const targetType = url2.searchParams.get("target_type");
          const targetId = url2.searchParams.get("target_id");
          const limitParam = url2.searchParams.get("limit");
          if (eventType) filters.event_type = eventType;
          if (targetType) filters.target_type = targetType;
          if (targetId) filters.target_id = targetId;
          if (limitParam) filters.limit = parseInt(limitParam, 10);
          const result = await listAuditEvents(filters, env);
          if (!result.ok) {
            return jsonResponse({ ok: false, error: result.error }, 500);
          }
          return jsonResponse({ ok: true, items: result.items, count: result.count });
        } catch (err) {
          logNV("\u274C [GET /memory/audit] erro:", String(err));
          return jsonResponse({ ok: false, error: String(err) }, 500);
        }
      }
      if (method === "GET" && path === "/memory") {
        try {
          const memResult = await searchRelevantMemory({}, env);
          const allMems = memResult.ok ? memResult.results : [];
          const toStrength = /* @__PURE__ */ __name((confidence) => confidence === "confirmed" || confidence === "high" ? "strong" : "weak", "toStrength");
          const toTier = /* @__PURE__ */ __name((mem) => {
            if (mem.memory_type === "canonical_rules" && mem.is_canonical) return 1;
            if (mem.is_canonical) return 2;
            if (mem.memory_type === "project") return 3;
            if (mem.memory_type === "live_context") return 4;
            if (mem.memory_type === "user_profile") return 5;
            if (mem.memory_type === "operational_history") return 6;
            return 7;
          }, "toTier");
          const toValue = /* @__PURE__ */ __name((mem) => {
            const cs = mem.content_structured;
            if (!cs) return "";
            if (typeof cs.text === "string") return cs.text;
            if (typeof cs.summary === "string") return cs.summary;
            return JSON.stringify(cs);
          }, "toValue");
          const canonicalMems = allMems.filter(
            (m) => m.memory_type === "canonical_rules" || m.is_canonical === true
          );
          const canonicalIds = new Set(canonicalMems.map((m) => m.memory_id));
          const liveContextMems = allMems.filter(
            (m) => m.memory_type === "live_context" && !canonicalIds.has(m.memory_id)
          );
          const liveContextIds = new Set(liveContextMems.map((m) => m.memory_id));
          const operationalMems = allMems.filter(
            (m) => !canonicalIds.has(m.memory_id) && !liveContextIds.has(m.memory_id)
          );
          const canonicalEntries = canonicalMems.map((m) => ({
            id: m.memory_id,
            key: m.entity_id || m.title,
            value: toValue(m),
            strength: toStrength(m.confidence),
            scope: m.entity_type || "global",
            createdAt: m.created_at,
            tags: Array.isArray(m.flags) ? m.flags : [],
            tier: toTier(m),
            priority: m.priority
          }));
          const operationalEntries = operationalMems.map((m) => ({
            id: m.memory_id,
            key: m.entity_id || m.title,
            value: toValue(m),
            strength: toStrength(m.confidence),
            source: m.source,
            sessionId: m.entity_id || null,
            createdAt: m.created_at,
            tags: Array.isArray(m.flags) ? m.flags : [],
            tier: toTier(m),
            priority: m.priority
          }));
          const liveCtxMem = liveContextMems[0] || null;
          const liveContext = liveCtxMem ? {
            sessionId: liveCtxMem.entity_id || null,
            startedAt: liveCtxMem.created_at,
            duration: null,
            intent: toValue(liveCtxMem),
            activeContracts: liveCtxMem.content_structured?.activeContracts ?? [],
            signals: liveCtxMem.content_structured?.signals ?? []
          } : null;
          const total = canonicalEntries.length + operationalEntries.length;
          const memoryPayload = {
            state: total > 0 ? "populated" : "empty",
            summary: {
              total,
              canonical: canonicalEntries.length,
              operational: operationalEntries.length,
              sessionEntries: liveContextMems.length,
              lastConsolidation: null
            },
            canonicalEntries,
            operationalEntries,
            liveContext,
            consolidation: {
              pending: [],
              consolidated: [],
              lastRun: null,
              nextRun: null
            },
            memoryReadBeforePlan: {
              happened: total > 0,
              readAt: total > 0 ? (/* @__PURE__ */ new Date()).toISOString() : null,
              memoriesRead: total,
              topTier: total > 0 ? 1 : null,
              topPriority: canonicalEntries[0]?.priority ?? null
            },
            auditSnapshots: []
          };
          return withCORS(jsonResponse(memoryPayload, 200));
        } catch (err) {
          logNV("\u274C [GET /memory] erro:", String(err));
          return withCORS(jsonResponse(
            { ok: false, error: "Falha ao carregar mem\xF3ria.", detail: String(err) },
            500
          ));
        }
      }
      if (method === "GET" && path === "/") {
        return withCORS(new Response(
          [
            "ENAVIA NV-FIRST ativa \u2705",
            "",
            "Rotas dispon\xEDveis:",
            "  \u2022 POST /               \u2192 Chat NV-FIRST",
            "  \u2022 POST /engineer       \u2192 Relay para executor core",
            "  \u2022 POST /reload         \u2192 Recarregar INDEX",
            "  \u2022 POST /debug-load     \u2192 Carregar m\xF3dulos via FILA",
            "  \u2022 POST /brain-query    \u2192 Buscar m\xF3dulos no c\xE9rebro",
            "  \u2022 POST /brain/get-module \u2192 Ler conte\xFAdo de m\xF3dulo",
            "  \u2022 POST /planner/run    \u2192 Planner estruturado PM4\u2192PM9 (classifica\xE7\xE3o\u2192plano\u2192gate\u2192bridge\u2192mem\xF3ria)",
            "  \u2022 POST /contracts      \u2192 Criar contrato (Contract Executor v1)",
            "  \u2022 POST /contracts/execute \u2192 Executar micro-PR corrente em TEST (C1)",
            "  \u2022 POST /contracts/close-test \u2192 Fechamento autom\xE1tico de contrato em TEST (C2)",
            "  \u2022 POST /contracts/cancel \u2192 Cancelamento formal de contrato (F1)",
            "  \u2022 POST /contracts/reject-plan \u2192 Rejei\xE7\xE3o formal do plano de decomposi\xE7\xE3o (F2)",
            "  \u2022 POST /contracts/resolve-plan-revision \u2192 Resolu\xE7\xE3o de revis\xE3o do plano (F2b)",
            "  \u2022 POST /contracts/complete-task \u2192 \u{1F6E1}\uFE0F Concluir task com gate obrigat\xF3rio de ader\xEAncia contratual",
            "  \u2022 POST /contracts/advance-phase \u2192 \u{1F6E1}\uFE0F PR18 \u2014 Avan\xE7ar fase supervisionado (gate checkPhaseGate)",
            "  \u2022 POST /contracts/close-final \u2192 \u{1F6E1}\uFE0F Fechamento final pesado do contrato inteiro (gate PR 3)",
            "  \u2022 GET  /contracts?id=  \u2192 Ler estado completo do contrato",
            "  \u2022 GET  /contracts/summary?id= \u2192 Resumo do contrato",
            "  \u2022 GET  /contracts/active-surface \u2192 Surface do contrato ativo mais recente",
            "  \u2022 GET  /debug-brain    \u2192 Status interno do NV-FIRST",
            "  \u2022 GET  /engineer       \u2192 Testar rota do executor",
            "  \u2022 GET  /audit          \u2192 Schema/contrato da rota POST /audit",
            "  \u2022 GET  /brain/read     \u2192 Ler System Prompt + estado",
            "  \u2022 GET  /brain/index    \u2192 INDEX completo do c\xE9rebro",
            "  \u2022 GET  /planner/run    \u2192 Schema/contrato da rota POST /planner/run",
            "  \u2022 GET  /memory         \u2192 Estado da mem\xF3ria persistida no KV (aba Mem\xF3ria do painel)",
            "  \u2022 GET  /memory/manual  \u2192 PR4: Listar mem\xF3rias manuais",
            "  \u2022 POST /memory/manual  \u2192 PR4: Criar mem\xF3ria manual",
            "  \u2022 PATCH /memory/manual \u2192 PR4: Editar mem\xF3ria manual",
            "  \u2022 POST /memory/manual/block \u2192 PR4: Bloquear mem\xF3ria manual",
            "  \u2022 POST /memory/manual/invalidate \u2192 PR4: Invalidar/expirar mem\xF3ria manual",
            "  \u2022 GET  /memory/learning  \u2192 PR5: Listar candidatos de aprendizado",
            "  \u2022 POST /memory/learning  \u2192 PR5: Registrar candidato de aprendizado",
            "  \u2022 POST /memory/learning/approve \u2192 PR5: Aprovar candidato (promo\xE7\xE3o para mem\xF3ria validada)",
            "  \u2022 POST /memory/learning/reject  \u2192 PR5: Rejeitar candidato",
            "  \u2022 GET  /memory/audit \u2192 PR6: Listar eventos de auditoria da mem\xF3ria/aprendizado"
          ].join("\n"),
          { status: 200 }
        ));
      }
      return withCORS(new Response(
        JSON.stringify({
          ok: false,
          error: "Rota n\xE3o encontrada.",
          method,
          path
        }),
        { status: 404, headers: { "Content-Type": "application/json" } }
      ));
    } catch (err) {
      return withCORS(new Response(
        JSON.stringify({
          ok: false,
          error: "Falha interna.",
          detail: String(err)
        }),
        { status: 500 }
      ));
    }
  }
};
async function handleDirectorCognitiveProxy(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "INVALID_JSON" }, 400);
  }
  const r = await fetch(
    env.DIRECTOR_COGNITIVE_URL,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    }
  );
  const text = await r.text();
  return new Response(text, {
    status: r.status,
    headers: { "Content-Type": "application/json" }
  });
}
__name(handleDirectorCognitiveProxy, "handleDirectorCognitiveProxy");
export {
  _MANUAL_PLAN_FALLBACK,
  _isManualPlanReply,
  _looksLikeNaturalProse,
  _sanitizeChatReply,
  nv_enavia_default as default,
  isOperationalMessage
};
//# sourceMappingURL=nv-enavia.js.map