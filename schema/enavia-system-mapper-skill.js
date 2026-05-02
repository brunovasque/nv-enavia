// ============================================================================
// 🧭 ENAVIA — SYSTEM_MAPPER Skill (PR75)
//
// Skill limitada read-only. Sem side effects. Sem KV/rede/FS/LLM/comandos.
// Retorna um mapa pequeno, deterministico e seguro das capacidades conhecidas.
// ============================================================================

import { SKILL_EXECUTION_ALLOWLIST } from "./enavia-skill-executor.js";

export const SYSTEM_MAPPER_SKILL_ID = "SYSTEM_MAPPER";
export const SYSTEM_MAPPER_MODE = "read_only";

function _asObject(value) {
  return value && typeof value === "object" ? value : null;
}

function _asBoolean(value) {
  return value === true;
}

function _asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function _normalizeProposalStatus(input) {
  const root = _asObject(input) || {};
  const approval = _asObject(root.approval);
  const fromRoot = _asString(root.proposal_status || root.proposalStatus).toLowerCase();
  const fromApproval = _asString(approval?.status || approval?.proposal_status).toLowerCase();
  return fromRoot || fromApproval || "unknown";
}

function _buildKnownEndpoints() {
  return {
    skills: {
      propose: { method: "POST", path: "/skills/propose", exists: true },
      approve: { method: "POST", path: "/skills/approve", exists: true },
      reject: { method: "POST", path: "/skills/reject", exists: true },
      run: { method: "POST", path: "/skills/run", exists: false },
    },
  };
}

function _buildCapabilitiesMap() {
  const allowlist = Array.from(SKILL_EXECUTION_ALLOWLIST).sort();
  return {
    allowlist,
    endpoints: _buildKnownEndpoints(),
    proposal_gate: {
      available: true,
      lifecycle: ["proposed", "approved", "rejected", "expired", "blocked"],
      persistence: "in_memory_per_instance_only",
    },
    limitations: [
      "read_only_only",
      "no_side_effects",
      "no_skills_run_endpoint",
      "no_runtime_filesystem",
      "no_external_network_or_llm",
      "no_kv_or_database_writes",
    ],
  };
}

export function buildSystemMapperResult(input) {
  const normalized = _asObject(input) || {};
  const requireApprovedProposal = _asBoolean(
    normalized.require_approved_proposal || normalized.requireApprovedProposal,
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
        approved: false,
      },
      result: null,
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
      approved: !requireApprovedProposal || approvalSatisfied,
    },
    result: _buildCapabilitiesMap(),
  };
}
