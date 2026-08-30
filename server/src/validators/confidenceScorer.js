import { reflect, overallConfidence } from "../agent/reflector.js";

const SEVERITY_ORDER = { high: 0, med: 1, low: 2 };

/**
 * Takes the raw output of each validator (design-system, accessibility,
 * workflow) and assembles the final UX health report.
 *
 * Two kinds of visual evidence flow through here now:
 *   - dimensionScreenshots: ONE annotated overview image per validator —
 *     every failure boxed + labeled on a single picture of the whole
 *     screen/frame. Lives at the top level of the report, not per-finding.
 *   - elementScreenshotBase64: a small, isolated thumbnail of just ONE
 *     failing element, attached per-finding — used in both the Issues
 *     table and the checkpoint breakdown. Passing rows never carry one.
 */
export function assembleReport({ id, input, validatorResults }) {
  const failedValidators = validatorResults.filter((v) => v.error);
  const okValidators = validatorResults.filter((v) => !v.error);

  const allFindingsWithSource = okValidators.flatMap((v) =>
    (v.findings || [])
      .filter((f) => f.status === "fail" || f.applicable === false)
      .map((f) => ({ ...f, category: v.validator }))
  );

  const { finalized, escalations } = reflect(allFindingsWithSource);

  const issues = finalized
    .filter((f) => f.status === "fail")
    .map((f) => ({
      checkpoint: f.checkpoint || null,
      severity: f.severity || "med",
      category: f.category,
      issue: f.issue,
      recommendation: f.recommendation,
      confidence: f.confidence,
      nodePath: f.nodePath || null,
      figmaLink: f.figmaLink || null,
      elementScreenshotBase64: f.elementScreenshotBase64 || null,
      // The number drawn in the circle on that dimension's overview image
      // for this exact finding — null if this finding wasn't drawn on the
      // overview at all (e.g. an LLM component-usage finding with no node
      // position, or the dimension had no overview image). Scoped PER
      // DIMENSION, not globally unique across the whole report — e.g.
      // design-system's #1 and accessibility's #1 are different circles on
      // different tabs. Pair with `category` in the UI to disambiguate.
      overviewRank: f.overviewRank ?? null,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

  const dimensionScores = Object.fromEntries(
    validatorResults.map((v) => [v.validator, v.error ? { score: null, error: v.error } : v.dimensionScore])
  );

  // One overview screenshot per validator that actually produced one —
  // validators with no visual equivalent (workflow) or that errored simply
  // don't appear as a key here; the client treats a missing key as "no
  // visual overview available for this dimension."
  const dimensionScreenshots = Object.fromEntries(
    okValidators.filter((v) => v.dimensionScreenshot).map((v) => [v.validator, v.dimensionScreenshot])
  );

  const checkpointsByCategory = Object.fromEntries(
    okValidators.map((v) => [
      v.validator,
      (v.allFindings || v.findings || []).map((f) => ({
        checkpoint: f.checkpoint,
        status: f.status,
        applicable: f.applicable !== false,
        severity: f.severity,
        issue: f.issue,
        recommendation: f.recommendation,
        confidence: f.confidence,
        source: f.source || null,
        nodePath: f.nodePath || null,
        figmaLink: f.figmaLink || null,
        elementScreenshotBase64: f.elementScreenshotBase64 || null,
        overviewRank: f.overviewRank ?? null,
      })),
    ])
  );

  const confidence = failedValidators.length > 0 ? "low" : overallConfidence(allFindingsWithSource);

  return {
    id,
    createdAt: new Date().toISOString(),
    input,
    dimensionScores,
    dimensionScreenshots,
    checkpointsByCategory,
    confidence,
    issues,
    validatorErrors: failedValidators.map((v) => ({
      validator: v.validator,
      error: v.error,
    })),
    escalations: escalations.map((e) => ({
      category: e.category,
      issue: e.issue,
      escalationQuestion: e.escalationQuestion,
      confidence: e.confidence,
    })),
    summary: {
      totalIssues: issues.length,
      high: issues.filter((i) => i.severity === "high").length,
      med: issues.filter((i) => i.severity === "med").length,
      low: issues.filter((i) => i.severity === "low").length,
      escalated: escalations.length,
      failedChecks: failedValidators.length,
    },
  };
}