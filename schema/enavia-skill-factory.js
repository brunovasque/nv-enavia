// ============================================================================
// 🏭 ENAVIA — Skill Factory Core (PR79)
//
// Pure functions. Determinístico. Sem I/O externo.
// Não usa fetch, filesystem runtime, KV, banco ou comandos externos.
// ============================================================================

export const SKILL_FACTORY_MODES = {
  READ_ONLY: "read_only",
  SUPERVISED_SIDE_EFFECT: "supervised_side_effect",
};

export const SKILL_FACTORY_RISK_LEVELS = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  BLOCKED: "blocked",
};

export const SKILL_FACTORY_STATUSES = {
  DRAFT: "draft",
  PROPOSED: "proposed",
  BLOCKED: "blocked",
};

const _FORBIDDEN_EFFECTS_BASE = [
  "deploy_automatico",
  "merge_automatico",
  "producao_direta",
  "browser_action",
  "acesso_credenciais_sensiveis",
  "execucao_comando_externo",
  "escrita_kv_ou_banco",
  "filesystem_runtime",
  "chamada_llm_externo_novo",
  "fetch_externo",
];

const _BLOCKED_PATTERNS = [
  { re: /\b(secret|secrets|token|apikey|api[_ -]?key|authorization|senha)\b/i, reason: "Pedido envolve credenciais sensíveis." },
  { re: /\b(deploy|produção|producao|rollout|merge automático|merge automatico|push automático|push automatico)\b/i, reason: "Pedido envolve deploy/merge/push automático." },
  { re: /\b(browser|playwright|puppeteer|navegador|abrir página|abrir pagina)\b/i, reason: "Pedido envolve browser action." },
  { re: /\b(exec|spawn|child_process|powershell|bash|cmd|shell|comando externo)\b/i, reason: "Pedido envolve execução de comando externo." },
  { re: /\b(database|banco|sql|postgres|mysql|mongodb|redis|kv)\b/i, reason: "Pedido envolve escrita em banco/KV." },
  { re: /\b(sem revisão|sem revis[aã]o|sem aprovação|sem aprova[cç][aã]o|autônom|autonom)\b/i, reason: "Pedido remove revisão/aprovação humana." },
  { re: /\b(faz tudo|faça tudo|qualquer coisa|tudo automático|tudo automatico)\b/i, reason: "Pedido amplo/difuso sem limites seguros." },
];

function _asObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _asStringArray(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => _asString(item)).filter(Boolean);
}

function _sanitizeText(text) {
  const raw = _asString(text);
  if (!raw) return "";
  return raw
    .replace(/openai_api_key/gi, "[REDACTED]")
    .replace(/\bapi[_ -]?key\b/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9_]*token[A-Za-z0-9_]*\b/gi, "[REDACTED]")
    .replace(/\b[A-Za-z0-9_]*secret[A-Za-z0-9_]*\b/gi, "[REDACTED]")
    .replace(/\bauthorization\b/gi, "[REDACTED]");
}

function _normalizeSkillId(value) {
  const base = _asString(value).toLowerCase();
  const slug = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");

  if (!slug) return "skill-sem-id";
  if (/^[a-z]/.test(slug)) return slug;
  return `skill-${slug}`;
}

function _extractHumanGoal(input) {
  const src = _asObject(input);
  return _asString(
    src.human_request ||
      src.request ||
      src.goal ||
      src.objective ||
      src.message ||
      src.description ||
      "",
  );
}

function _hasSideEffectIntent(text, mode) {
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) return true;
  return /\b(alterar arquivo|escrever em|editar arquivo|deletar arquivo|executar comando|rodar script|chamar api|deploy|produção|producao|browser)\b/i.test(text);
}

function _collectBlockedReasons(goal, mode, allowedEffects) {
  const reasons = [];
  for (const item of _BLOCKED_PATTERNS) {
    if (item.re.test(goal)) reasons.push(item.reason);
  }

  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT && allowedEffects.length === 0) {
    reasons.push("Skill com side effect exige allowed_effects explícitos.");
  }

  return Array.from(new Set(reasons));
}

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

function _defaultPurpose(goal) {
  if (goal) return goal.slice(0, 180);
  return "Nova capacidade Enavia a partir de pedido humano.";
}

function _defaultDescription(goal) {
  if (goal) return `Skill proposta para: ${goal}`;
  return "Spec inicial sem objetivo detalhado; revisar com humano antes de criar skill.";
}

function _defaultInputs(input, mode) {
  const provided = _asStringArray(input.inputs);
  if (provided.length > 0) return provided;
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) {
    return ["human_request", "approval_context", "allowed_effects"];
  }
  return ["human_request"];
}

function _defaultOutputs(input, mode) {
  const provided = _asStringArray(input.outputs);
  if (provided.length > 0) return provided;
  if (mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT) {
    return ["proposal", "evidence", "review_checklist"];
  }
  return ["structured_result", "evidence"];
}

export function buildSkillSpec(input) {
  const source = _asObject(input);
  const goalRaw = _extractHumanGoal(source);
  const goal = _sanitizeText(goalRaw);
  const modeRaw = _asString(source.mode);
  const explicitMode = modeRaw === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT
    ? SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT
    : SKILL_FACTORY_MODES.READ_ONLY;

  const sideEffectIntent = _hasSideEffectIntent(goalRaw, explicitMode);
  const mode = sideEffectIntent ? SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT : SKILL_FACTORY_MODES.READ_ONLY;

  const allowedEffects = _asStringArray(source.allowed_effects);
  const forbiddenEffects = Array.from(
    new Set([..._FORBIDDEN_EFFECTS_BASE, ..._asStringArray(source.forbidden_effects)]),
  );

  const skillIdSource = _asString(source.skill_id) || _asString(source.suggested_skill_id) || _defaultPurpose(goal);
  const skillId = _normalizeSkillId(skillIdSource);

  const blockedReasons = _collectBlockedReasons(goalRaw, mode, allowedEffects);
  const emptyGoal = goal.length === 0;
  const status = blockedReasons.length > 0
    ? SKILL_FACTORY_STATUSES.BLOCKED
    : (emptyGoal ? SKILL_FACTORY_STATUSES.DRAFT : SKILL_FACTORY_STATUSES.PROPOSED);

  const reasons = blockedReasons.length > 0
    ? blockedReasons
    : (emptyGoal ? ["Pedido incompleto; preencher objetivo humano."] : ["Pedido elegível para proposta supervisionada."]);

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
    files_to_create: _asStringArray(source.files_to_create).length > 0
      ? _asStringArray(source.files_to_create)
      : [`schema/skills/${skillId}.md`],
    tests_to_create: _asStringArray(source.tests_to_create).length > 0
      ? _asStringArray(source.tests_to_create)
      : [`tests/${fileBase}.smoke.test.js`],
    registry_changes: _asStringArray(source.registry_changes).length > 0
      ? _asStringArray(source.registry_changes)
      : ["schema/skills/INDEX.md"],
    approval_required: true,
    human_review_required: true,
    status,
    reasons,
    safety_notes: [
      "Sem autorização explícita, somente spec.",
      "Pacote de criação apenas com flags explícitas de aprovação humana.",
      "Sem deploy, merge automático, execução de skill, produção ou comandos externos nesta PR.",
    ],
  };
}

export function validateSkillSpec(spec) {
  const input = _asObject(spec);
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
    "safety_notes",
  ];

  for (const field of requiredFields) {
    if (!(field in input)) errors.push(`missing:${field}`);
  }

  if (!/^[a-z][a-z0-9-]*$/.test(_asString(input.skill_id))) {
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
    "safety_notes",
  ];
  for (const field of arrayFields) {
    if (!Array.isArray(input[field])) errors.push(`invalid:${field}`);
  }

  if (input.mode === SKILL_FACTORY_MODES.SUPERVISED_SIDE_EFFECT && (!Array.isArray(input.allowed_effects) || input.allowed_effects.length === 0)) {
    errors.push("invalid:allowed_effects_required_for_side_effect");
  }

  return {
    ok: errors.length === 0,
    errors,
  };
}

export function buildSkillCreationPackage(spec, options = {}) {
  const normalizedOptions = _asObject(options);
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
      executed: false,
    };
  }

  if (!approved || !authorizationText) {
    return {
      ok: false,
      blocked: true,
      error: "AUTHORIZATION_REQUIRED",
      detail: "Aprovação humana explícita é obrigatória para preparar pacote.",
      prepared: false,
      side_effects: false,
      executed: false,
    };
  }

  if (spec.risk_level === SKILL_FACTORY_RISK_LEVELS.BLOCKED || spec.status === SKILL_FACTORY_STATUSES.BLOCKED) {
    return {
      ok: false,
      blocked: true,
      error: "SKILL_SPEC_BLOCKED",
      detail: "Spec bloqueada não pode gerar pacote de criação.",
      prepared: false,
      side_effects: false,
      executed: false,
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
      human_review_acknowledged: true,
    },
    files_to_create: spec.files_to_create,
    tests_to_create: spec.tests_to_create,
    registry_changes: spec.registry_changes,
    suggested_paths: {
      skill_file_path: skillFilePath,
      test_file_path: testFilePath,
      registry_target: registryTarget,
    },
    proposed_content: {
      skill_file: `# ${spec.skill_id}\n\nPurpose: ${spec.purpose}\n\nDescription: ${spec.description}\n`,
      test_file: `// TODO: smoke test for ${spec.skill_id}\n`,
      registry_change: `- ${spec.skill_id} -> ${skillFilePath}`,
    },
    safe_patch_text: [
      "*** Begin Patch",
      `*** Add File: ${skillFilePath}`,
      `+# ${spec.skill_id}`,
      `+`,
      `+Purpose: ${spec.purpose}`,
      `+`,
      `+Description: ${spec.description}`,
      `*** End Patch`,
    ].join("\n"),
    human_review_checklist: [
      "Revisar escopo e riscos da spec.",
      "Confirmar modo e allowed_effects.",
      "Validar arquivos e testes sugeridos.",
      "Confirmar que não há deploy/merge automático.",
      "Aprovar somente após revisão humana completa.",
    ],
    rollback_suggested: [
      "Reverter o commit que adiciona skill/test/registry.",
      "Remover entrada da skill no registry.",
      "Rodar suíte de regressão da fase PR69-PR79.",
    ],
  };

  return {
    ok: true,
    blocked: false,
    prepared: true,
    side_effects: false,
    executed: false,
    skill_creation_package: packagePayload,
  };
}
