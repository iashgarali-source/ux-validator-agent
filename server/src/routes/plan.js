import { Router } from "express";
import { buildPlan } from "../agent/planner.js";

const router = Router();

// POST /api/plan  { figmaUrl?, liveUrl?, prd? }
router.post("/", (req, res, next) => {
  try {
    const { figmaUrl, liveUrl, prd } = req.body || {};
    if (!figmaUrl && !liveUrl) {
      return res.status(400).json({ error: "Provide at least a figmaUrl or a liveUrl" });
    }
    const plan = buildPlan({ figmaUrl, liveUrl, prd });
    res.json(plan);
  } catch (err) {
    next(err);
  }
});

export default router;
