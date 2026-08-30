import { Router } from "express";
import { getRun } from "../agent/memory.js";
import { answerQuestion } from "../tools/llmClient.js";

const router = Router();

const SYSTEM_PROMPT = `You are the UX Validator Agent's assistant. You have already
generated a UX health report (provided below as JSON) and the user is asking a
follow-up question about it. Answer using ONLY the information in the report —
issues, escalations, dimension scores, and checkpoint details. Speak in plain,
concise, human language, not JSON. Reference the specific issue/checkpoint/category
the question is about when relevant. If the report doesn't contain enough
information to answer, say so honestly instead of guessing. Do not invent findings
that aren't in the report, and do not suggest re-running a validator — you're only
explaining what's already there.`;

/**
 * The report carries base64 screenshots (dimensionScreenshots, and
 * elementScreenshotBase64 on individual issues/checkpoints) added by the
 * highlighter features. Those can be 50,000+ characters EACH — sending them
 * as text in an LLM prompt has no benefit (the model can't "see" base64
 * text as an image here, it's just huge irrelevant text) and reliably blows
 * past context limits on smaller-context providers like Groq. Strip them
 * before the report ever reaches a prompt; the model only needs the
 * structured findings to answer a question about them.
 */
function stripImagesForLLM(report) {
  if (!report) return report;

  const { dimensionScreenshots, ...rest } = report;

  const stripIssue = ({ elementScreenshotBase64, ...issue }) => issue;

  const clean = { ...rest };

  if (Array.isArray(clean.issues)) {
    clean.issues = clean.issues.map(stripIssue);
  }

  if (clean.checkpointsByCategory) {
    clean.checkpointsByCategory = Object.fromEntries(
      Object.entries(clean.checkpointsByCategory).map(([category, checkpoints]) => [
        category,
        Array.isArray(checkpoints) ? checkpoints.map(stripIssue) : checkpoints,
      ])
    );
  }

  return clean;
}

// POST /api/explain  { question, report?, reportId? }
// Either a full report object (as already held client-side from the chat) or a
// reportId (looked up from run history) works — no re-validation happens here.
router.post("/", async (req, res, next) => {
  try {
    const { question, report, reportId } = req.body || {};

    if (!question || !question.trim()) {
      return res.status(400).json({ error: "Provide a question" });
    }

    const resolvedReport = report || (reportId ? getRun(reportId) : null);
    if (!resolvedReport) {
      return res.status(400).json({ error: "Provide a report object or a valid reportId" });
    }

    const answer = await answerQuestion({
      systemPrompt: SYSTEM_PROMPT,
      report: stripImagesForLLM(resolvedReport),
      question,
    });

    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

export default router;