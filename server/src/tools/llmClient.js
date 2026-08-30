/**
 * llmClient
 * Provider switch so validators never import claudeClient/geminiClient
 * directly. Controlled entirely by LLM_PROVIDER in .env:
 *   LLM_PROVIDER=gemini    -> uses your Gemini key (GEMINI_API_KEY)
 *   LLM_PROVIDER=anthropic -> uses your Claude key (ANTHROPIC_API_KEY) [default]
 *
 * To move from Gemini to Claude later: set ANTHROPIC_API_KEY in .env, change
 * LLM_PROVIDER to "anthropic" (or just delete the line), restart the server.
 * No validator code changes required.
 */

import * as claude from "./claudeClient.js";
import * as gemini from "./geminiClient.js";

function getProvider() {
  const provider = (process.env.LLM_PROVIDER || "anthropic").toLowerCase();
  if (provider === "gemini") return gemini;
  return claude;
}

export async function compareAgainstKnowledge(args) {
  return getProvider().compareAgainstKnowledge(args);
}

export async function compareScreenshotAgainstKnowledge(args) {
  return getProvider().compareScreenshotAgainstKnowledge(args);
}

// Plain-prose Q&A over an already-generated report — used by /api/explain.
// Distinct from the two functions above: no JSON-array contract, just an
// answer string, since this isn't producing new findings.
export async function answerQuestion(args) {
  return getProvider().answerQuestion(args);
}