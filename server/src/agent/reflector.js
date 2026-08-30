/**
 * Reflector
 *
 * Implements the "contextual checkpoint matching" scoring model:
 *   - a validator only reports the checkpoints that were APPLICABLE to this screen
 *   - the score for that dimension = satisfied / applicable (not a fixed % weight)
 *
 * It also decides confidence per finding. HIGH confidence findings go straight
 * into the final report. LOW confidence findings are routed to escalation with
 * a specific open question instead of being silently included.
 */

const CONFIDENCE_THRESHOLD = {
  high: 0.75, // model-reported certainty >= this -> auto-include
};

export function scoreDimension(findings = []) {
  const applicable = findings.filter((f) => f.applicable !== false);
  const satisfied = applicable.filter((f) => f.status === "pass");
  const total = applicable.length;
  const score = total === 0 ? null : Math.round((satisfied.length / total) * 100);

  return {
    applicableCheckpoints: total,
    satisfiedCheckpoints: satisfied.length,
    score, // null when nothing in this dimension applied to the screen
  };
}

export function reflect(rawFindings = []) {
  const finalized = [];
  const escalations = [];

  for (const finding of rawFindings) {
    const certainty = typeof finding.confidence === "number" ? finding.confidence : 0.5;
    const entry = {
      ...finding,
      confidenceLabel: certainty >= CONFIDENCE_THRESHOLD.high ? "high" : "low",
    };

    if (entry.confidenceLabel === "high") {
      finalized.push(entry);
    } else {
      escalations.push({
        ...entry,
        escalationQuestion:
          finding.escalationQuestion ||
          `Low confidence on "${finding.issue}" — please confirm whether this should be flagged.`,
      });
    }
  }

  return { finalized, escalations };
}

export function overallConfidence(findings = []) {
  if (findings.length === 0) return "high";
  const avg =
    findings.reduce((sum, f) => sum + (typeof f.confidence === "number" ? f.confidence : 0.5), 0) /
    findings.length;
  return avg >= CONFIDENCE_THRESHOLD.high ? "high" : "low";
}
