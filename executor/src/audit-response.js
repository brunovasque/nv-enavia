function hasExplicitAuditSuccess(execResult) {
  return execResult?.ok === true && execResult?.error !== true;
}

export function normalizeAuditVerdict(execResult) {
  const currentVerdict = execResult?.verdict;

  if (currentVerdict === "reject") {
    return "reject";
  }

  if (currentVerdict === "approve" && hasExplicitAuditSuccess(execResult)) {
    return "approve";
  }

  return hasExplicitAuditSuccess(execResult) ? "approve" : "reject";
}

export function normalizeAuditRiskLevel(execResult, riskReport) {
  const candidates = [
    riskReport?.risk_level,
    riskReport?.level,
    riskReport?.risk,
    execResult?.risk_level,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "low";
}
