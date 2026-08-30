/**
 * Planner
 * Classifies the incoming input (figmaUrl / liveUrl / prd) and decides which
 * validators are applicable. This keeps runs cheap — a live-URL-only run never
 * loads the design-system knowledge or calls the Figma API.
 */

const VALIDATOR_REQUIREMENTS = {
  "design-system": {
    label: "Design system",
    requiresAnyOf: ["figmaUrl", "liveUrl"],
    reason: (available) =>
      available.figmaUrl
        ? "Compares implemented tokens/components against design-system.md"
        : "No Figma URL — comparing a live screenshot against design-system.md instead of reading tokens directly",
  },
  accessibility: {
    label: "Accessibility",
    requiresAnyOf: ["liveUrl", "figmaUrl"],
    reason: (available) =>
      available.liveUrl
        ? "Runs axe-core against the live DOM for WCAG 2.2 checkpoints"
        : "No live URL — running a Figma-only pre-check (contrast, font size, touch target) instead of a full axe-core audit",
  },
  // workflow: {
  //   label: "Workflow",
  //   requiresAnyOf: ["liveUrl", "figmaUrl"],
  //   reason: (available) =>
  //     available.liveUrl
  //       ? "Walks the live flow with Playwright and checks it against user-flows.md"
  //       : "No live URL — reading the Figma prototype's click/tap interactions between frames instead of walking a live page",
  // },
};

export function buildPlan(input) {
  const { figmaUrl, liveUrl, prd } = input;
  const available = {
    figmaUrl: Boolean(figmaUrl),
    liveUrl: Boolean(liveUrl),
    prd: Boolean(prd),
  };

  const checks = Object.entries(VALIDATOR_REQUIREMENTS).map(([id, def]) => {
    const applicable = def.requiresAnyOf.some((key) => available[key]);
    return {
      id,
      label: def.label,
      applicable,
      reason: applicable
        ? typeof def.reason === "function"
          ? def.reason(available)
          : def.reason
        : `Skipped — needs ${def.requiresAnyOf.join(" or ")}`,
    };
  });

  const applicableChecks = checks.filter((c) => c.applicable).map((c) => c.id);

  return {
    input: { figmaUrl: figmaUrl || null, liveUrl: liveUrl || null, hasPrd: available.prd },
    checks,
    applicableChecks,
  };
}