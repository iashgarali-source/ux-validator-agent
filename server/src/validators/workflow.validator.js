import { simulateFlow } from "../tools/playwrightRunner.js";
import { fetchFigmaPrototypeFlow } from "../tools/figmaClient.js";
import { compareAgainstKnowledge } from "../tools/llmClient.js";
import { loadKnowledge, loadPrd } from "../agent/memory.js";
import { scoreDimension } from "../agent/reflector.js";

const LIVE_SYSTEM_PROMPT = `You are the workflow validator inside a UX Validator Agent.
You are given a skill file describing the expected steps of a user flow, and the
actual step-by-step results of walking that flow on the live build. Flag missing
steps, wrong sequence, dead ends, and navigation issues. If a PRD is provided,
also flag where the live flow does not fulfil the requirement's intent. Do not
evaluate visual design or accessibility — those are handled elsewhere.`;

const FIGMA_SYSTEM_PROMPT = `You are the workflow validator inside a UX Validator Agent,
running in Figma-only mode (no live build available yet). You are given a skill file
describing the expected steps of a user flow in plain language, and the ACTUAL
prototype graph extracted from the Figma file — every frame, and its outgoing
click/tap interactions with the destination frame name. Compare the expected
steps against this graph: does a frame matching each expected step exist? Does
it have an outgoing interaction that leads toward the next expected step's
frame? Flag missing steps (no matching frame), dead ends (a frame with no
outgoing interaction where one was expected), and steps that seem out of
order. This is based on prototype links, not a real click-through, so treat
ambiguous name matches as lower confidence rather than a hard fail.`;

function extractStepsFromSkillFile(text) {
  const match = text.match(/```steps\s*([\s\S]*?)```/);
  if (!match) return [];
  try {
    return JSON.parse(match[1]);
  } catch {
    return [];
  }
}

export async function runWorkflowValidator({ liveUrl, figmaUrl, requirementId }) {
  if (!liveUrl && !figmaUrl) {
    throw Object.assign(new Error("workflow validator requires a liveUrl or a figmaUrl"), {
      status: 400,
    });
  }

  const knowledgeFiles = await loadKnowledge("workflow");
  const knowledgeText = knowledgeFiles.map((k) => `### ${k.file}\n${k.text}`).join("\n\n");
  const steps = knowledgeFiles.flatMap((k) => extractStepsFromSkillFile(k.text));
  const prd = await loadPrd(requirementId);

  if (liveUrl) {
    const stepResults = steps.length ? await simulateFlow(liveUrl, steps) : [];

    const subjectData = {
      liveUrl,
      expectedStepCount: steps.length,
      stepResults,
      prd: prd || "(no PRD provided for this run)",
    };

    const findings = await compareAgainstKnowledge({
      systemPrompt: LIVE_SYSTEM_PROMPT,
      knowledgeText,
      subjectData,
      instructions:
        "Compare the expected user flow above against the actual step-walk results. For every expected step that was not found (found: false), flag it as a missing step. Also flag wrong ordering, dead ends, or (if a PRD is present) mismatches between the flow and the requirement's intent.",
    });

    return {
      validator: "workflow",
      source: steps.length ? "playwright-flow-walk" : "no-steps-defined",
      findings: findings.filter((f) => f.status === "fail"),
      allFindings: findings,
      dimensionScore: scoreDimension(findings),
    };
  }

  const flowGraph = await fetchFigmaPrototypeFlow(figmaUrl);

  const subjectData = {
    figmaUrl,
    expectedStepCount: steps.length,
    startFrameName: flowGraph.startFrameName,
    frames: flowGraph.frames,
    prd: prd || "(no PRD provided for this run)",
  };

  let findings = await compareAgainstKnowledge({
    systemPrompt: FIGMA_SYSTEM_PROMPT,
    knowledgeText,
    subjectData,
    instructions:
      "Compare the expected user flow steps above against the Figma prototype graph (frames + their outgoing interactions). Flag any expected step with no matching frame, any frame that dead-ends where a next step was expected, and any ordering mismatch. If a PRD is present, also flag mismatches with its intent.",
  });

  findings = findings.map((f) => ({ ...f, confidence: Math.min(f.confidence ?? 0.5, 0.65) }));

  return {
    validator: "workflow",
    source: "figma-prototype-graph",
    findings: findings.filter((f) => f.status === "fail"),
    allFindings: findings,
    dimensionScore: scoreDimension(findings),
  };
}