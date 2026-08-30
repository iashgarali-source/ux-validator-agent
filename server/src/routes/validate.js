import { Router } from "express";
import { nanoid } from "nanoid";

import { buildPlan } from "../agent/planner.js";
import { saveRun } from "../agent/memory.js";
import { runDesignSystemValidator } from "../validators/designSystem.validator.js";
import { runAccessibilityValidator } from "../validators/accessibility.validator.js";
// import { runWorkflowValidator } from "../validators/workflow.validator.js";
import { assembleReport } from "../validators/confidenceScorer.js";

const router = Router();

const VALIDATOR_FNS = {
  "design-system": runDesignSystemValidator,
  accessibility: runAccessibilityValidator,
  // workflow: runWorkflowValidator,
};

// POST /api/validate  { figmaUrl?, liveUrl?, prd?, requirementId?, checks?: string[] }
// If `checks` is omitted, runs everything the Planner marks as applicable.
router.post("/", async (req, res, next) => {
  try {
    const { figmaUrl, liveUrl, prd, requirementId, checks } = req.body || {};
    if (!figmaUrl && !liveUrl) {
      return res.status(400).json({ error: "Provide at least a figmaUrl or a liveUrl" });
    }

    const plan = buildPlan({ figmaUrl, liveUrl, prd });
    const checksToRun = (checks && checks.length ? checks : plan.applicableChecks).filter(
      (id) => plan.applicableChecks.includes(id)
    );

    if (checksToRun.length === 0) {
      return res.status(400).json({
        error: "No applicable checks for the given input",
        plan,
      });
    }

    const validatorResults = await Promise.all(
      checksToRun.map(async (id) => {
        try {
          return await VALIDATOR_FNS[id]({ figmaUrl, liveUrl, requirementId });
        } catch (err) {
          // A single validator failing (e.g. Figma token missing) shouldn't
          // take down the whole run — surface it as a result with an error.
          return { validator: id, error: err.message, findings: [], dimensionScore: { score: null } };
        }
      })
    );

    const report = assembleReport({
      id: nanoid(10),
      input: { figmaUrl: figmaUrl || null, liveUrl: liveUrl || null, requirementId: requirementId || null },
      validatorResults,
    });

    saveRun(report);
    res.json(report);
  } catch (err) {
    next(err);
  }
});

export default router;
