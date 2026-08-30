import { Router } from "express";

const router = Router();

/**
 * POST /api/webhook/ado
 * Placeholder for the future automatic trigger: ADO fires this when a PR is
 * marked ready for UX review. Not wired to a real ADO project yet — validate
 * the payload shape and log it so the webhook contract can be agreed with the
 * platform team before enabling it for real.
 */
router.post("/ado", (req, res) => {
  const { pullRequestId, figmaUrl, previewUrl } = req.body || {};
  console.log("[webhook] received PR trigger", { pullRequestId, figmaUrl, previewUrl });
  res.status(202).json({
    received: true,
    note: "Webhook received but auto-run is not enabled yet — call POST /api/validate manually for now.",
  });
});

export default router;
