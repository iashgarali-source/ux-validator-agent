/**
 * claudeClient
 * Wraps the Claude API for the things validators (and the explain route) need:
 *   - structured comparison (fetched data + knowledge file -> JSON findings)
 *   - vision-based judgement (screenshot + knowledge file -> JSON findings)
 *   - plain-prose Q&A over an already-generated report (no JSON contract)
 *
 * The two "compare" calls ask for strict JSON so validators can parse it
 * directly. answerQuestion() deliberately does not — it's not producing new
 * findings, just explaining ones that already exist.
 */

import Anthropic from "@anthropic-ai/sdk";

let client = null;
function getClient() {
  if (!client) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw Object.assign(new Error("ANTHROPIC_API_KEY is not set on the server (.env)"), {
        status: 500,
      });
    }
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

const MODEL = "claude-sonnet-4-6";

function extractJson(text) {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/, "");
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw Object.assign(
      new Error(`Claude did not return valid JSON. Raw response: ${text.slice(0, 500)}`),
      { status: 502, cause: err }
    );
  }
}

/**
 * Text-only structured comparison: fetched data vs. one or more knowledge files.
 */
export async function compareAgainstKnowledge({ systemPrompt, knowledgeText, subjectData, instructions }) {
  const anthropic = getClient();

  const userMessage = [
    "## Company standard (source of truth)",
    knowledgeText,
    "",
    "## What was actually implemented (fetched data)",
    "```json",
    JSON.stringify(subjectData, null, 2),
    "```",
    "",
    "## Task",
    instructions,
    "",
    "Return one entry for EVERY applicable checkpoint you considered — including ones that PASS, not only failures. Do not silently omit passing checkpoints.",
    "",
    "Respond with ONLY valid JSON: an array of findings, each shaped as:",
    `{"checkpoint": string, "applicable": boolean, "status": "pass"|"fail", "severity": "high"|"med"|"low", "issue": string, "recommendation": string, "confidence": number (0-1)}`,
    "No prose, no markdown fences — JSON array only.",
  ].join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "[]";
  return extractJson(text);
}

/**
 * Vision-based comparison: a screenshot plus a knowledge file, used as a
 * fallback for the design-system validator when there's no Figma access,
 * and for general visual heuristic judgement.
 */
export async function compareScreenshotAgainstKnowledge({
  systemPrompt,
  knowledgeText,
  screenshotBase64,
  instructions,
}) {
  const anthropic = getClient();

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 4000,
    system: systemPrompt,
    messages: [
      {
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/png", data: screenshotBase64 } },
          {
            type: "text",
            text: [
              "## Company standard (source of truth)",
              knowledgeText,
              "",
              "## Task",
              instructions,
              "",
              "Return one entry for EVERY applicable checkpoint you considered — including ones that PASS, not only failures. Do not silently omit passing checkpoints.",
              "",
              "Respond with ONLY valid JSON: an array of findings, each shaped as:",
              `{"checkpoint": string, "applicable": boolean, "status": "pass"|"fail", "severity": "high"|"med"|"low", "issue": string, "recommendation": string, "confidence": number (0-1)}`,
              "No prose, no markdown fences — JSON array only.",
            ].join("\n"),
          },
        ],
      },
    ],
  });

  const text = response.content.find((b) => b.type === "text")?.text || "[]";
  return extractJson(text);
}

/**
 * Plain-prose Q&A over an already-generated report. Used by /api/explain so a
 * user can ask a follow-up question in chat ("why was X flagged?") without
 * re-running any validator. Returns a string, not JSON — no extractJson here.
 */
export async function answerQuestion({ systemPrompt, report, question }) {
  const anthropic = getClient();

  const userMessage = [
    "## UX health report (JSON)",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    "",
    "## Question",
    question,
  ].join("\n");

  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });

  const text = response.content.find((b) => b.type === "text")?.text;
  return text?.trim() || "I couldn't generate an answer from this report.";
}