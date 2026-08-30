import OpenAI from "openai";

function getClient() {
  return new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
  });
}

const MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-120b";

function extractJson(text) {
  const cleaned = text
    .trim()
    .replace(/^```json\s*/i, "")
    .replace(/```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw Object.assign(
      new Error(
        `Groq did not return valid JSON.\n\nRaw response:\n${text.slice(0, 1000)}`
      ),
      { status: 502, cause: err }
    );
  }
}

function buildTaskText({
  knowledgeText,
  subjectData,
  instructions,
}) {
  return [
    "## Company standard (source of truth)",
    knowledgeText,
    "",
    subjectData !== undefined
      ? [
          "## What was actually implemented (fetched data)",
          "```json",
          JSON.stringify(subjectData, null, 2),
          "```",
          "",
        ].join("\n")
      : "",
    "## Task",
    instructions,
    "",
    "Return ONLY a valid JSON array.",
    "",
    "Each item MUST be:",
    `{
      "checkpoint": string,
      "applicable": boolean,
      "status": "pass" | "fail",
      "severity": "high" | "med" | "low",
      "issue": string,
      "recommendation": string,
      "confidence": number
    }`,
    "",
    "Do not explain.",
    "Do not wrap in markdown.",
    "Return only the JSON array.",
  ].join("\n");
}

async function callGroq(systemPrompt, taskText) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(
      new Error("GROQ_API_KEY is not set in .env"),
      { status: 500 }
    );
  }
const client = getClient();
  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.2,
    messages: [
      {
        role: "system",
        content: systemPrompt,
      },
      {
        role: "user",
        content: taskText,
      },
    ],
  });

  const text = response.choices?.[0]?.message?.content || "[]";

  return extractJson(text);
}

export async function compareAgainstKnowledge({
  systemPrompt,
  knowledgeText,
  subjectData,
  instructions,
}) {
  const taskText = buildTaskText({
    knowledgeText,
    subjectData,
    instructions,
  });

  return callGroq(systemPrompt, taskText);
}

// Placeholder until you add screenshot support.
export async function compareScreenshotAgainstKnowledge({
  systemPrompt,
  knowledgeText,
  instructions,
}) {
  const taskText = buildTaskText({
    knowledgeText,
    subjectData: undefined,
    instructions,
  });

  return callGroq(systemPrompt, taskText);
}

/**
 * Plain-prose Q&A over an already-generated report. Same contract as
 * claudeClient's answerQuestion — returns a string, not JSON, since this
 * isn't producing new findings, just explaining existing ones.
 */
export async function answerQuestion({ systemPrompt, report, question }) {
  if (!process.env.GROQ_API_KEY) {
    throw Object.assign(new Error("GROQ_API_KEY is not set in .env"), { status: 500 });
  }

  const client = getClient();

  const userMessage = [
    "## UX health report (JSON)",
    "```json",
    JSON.stringify(report, null, 2),
    "```",
    "",
    "## Question",
    question,
  ].join("\n");

  const response = await client.chat.completions.create({
    model: MODEL,
    temperature: 0.3,
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userMessage },
    ],
  });

  const text = response.choices?.[0]?.message?.content;
  return text?.trim() || "I couldn't generate an answer from this report.";
}