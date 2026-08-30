import { Router } from "express";
import { listRuns, getRun } from "../agent/memory.js";

const router = Router();

// GET /api/reports  -> run history for the dashboard/trends view
router.get("/", (_req, res) => {
  res.json(listRuns());
});

// GET /api/reports/:id
router.get("/:id", (req, res) => {
  const run = getRun(req.params.id);
  if (!run) return res.status(404).json({ error: "Report not found" });
  res.json(run);
});

export default router;
