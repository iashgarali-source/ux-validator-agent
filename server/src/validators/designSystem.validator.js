import { fetchFigmaFrame, buildFigmaNodeUrl } from "../tools/figmaClient.js";
import { createFrameHighlighter } from "../tools/figmaHighlighter.js";
import { captureLiveDesignElements } from "../tools/playwrightRunner.js";
import { annotateOverview, cropRegion } from "../tools/imageHighlighter.js";
import { compareAgainstKnowledge } from "../tools/llmClient.js";
import {
  hexFromFigmaColor,
  hexFromRgb255,
  extractColorTokens,
  nearestColorToken,
  extractSpacingScale,
  extractRadiusScale,
  extractTypescaleSizes,
  dedupeWrappers,
} from "../tools/tokenMatcher.js";
import { loadKnowledge } from "../agent/memory.js";
import { scoreDimension } from "../agent/reflector.js";

/**
 * Design-system validator. Source of truth: tokens.md, components.md,
 * patterns.md — nothing else, nothing implied. Color/spacing/radius/
 * font-size are checked deterministically against tokens.md (exact
 * lookups, no LLM). Component usage and platform-pattern consistency go
 * through the LLM against components.md/patterns.md, since those are
 * closed-vocabulary judgment calls (e.g. "is this variant one of the
 * documented 10 for Button"), not a plain numeric lookup.
 */

const FIGMA_SYSTEM_PROMPT = `You are the design-system validator inside a UX Validator Agent.
Color, spacing, radius, and font-size have ALREADY been checked deterministically in code —
do not comment on them, and do not report a color, spacing, radius, or font-size finding
even if something looks off; those are out of scope for you. Your job is ONLY:
(1) component usage — does this element match an approved component from
components.md (check against its documented Variant and Size lists exactly —
components.md gives closed vocabularies per component, e.g. Button has exactly
10 valid variants), or is it a custom/hand-rolled element not in the library, and
(2) platform-pattern consistency from patterns.md, where clearly applicable.
Only flag checkpoints that are actually applicable to the frame you were given —
do not invent generic advice, and do not use general industry knowledge — every
finding must trace back to something explicitly stated in components.md or
patterns.md. When you reference an element, quote its exact "path" field from
the provided data so it can be located.`;

const LIVE_SYSTEM_PROMPT = `You are the design-system validator inside a UX Validator Agent,
checking a live, deployed page. Color, spacing, radius, and font-size have ALREADY been
checked deterministically against the real computed CSS of every element — do not comment
on them, and do not report a color, spacing, radius, or font-size finding even if something
looks off; those are out of scope for you. Your job is ONLY: component usage — does
each element look like an approved component from components.md (check against its
documented Variant and Size lists exactly)? Only flag checkpoints genuinely inferable
from the element list given, and do not use general industry knowledge — every finding
must trace back to something explicitly stated in components.md or patterns.md. When you
reference an element, quote its exact "selector" field so it can be located.`;

const TEXTY_TAGS = new Set(["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "label", "a", "button"]);

function runFigmaDeterministicChecks(
  frame,
  { colorTokenMap, spacingTokens, radiusTokens, typescaleSizes, spacingScaleText, typescaleSizesText, radiusScaleText }
) {
  const nodes = frame.summary || [];
  const findings = [];

  for (const node of nodes) {
    const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);

    if (node.fills?.[0]) {
      const hex = hexFromFigmaColor(node.fills[0]);
      if (hex) {
        const known = colorTokenMap.has(hex);
        const nearest = known ? null : nearestColorToken(hex, colorTokenMap);
        const suggestion = nearest ? ` Closest known token: ${nearest.names[0]} (${nearest.hex}).` : "";

        findings.push({
          checkpoint: `color:${node.id}`,
          applicable: true,
          status: known ? "pass" : "fail",
          severity: known ? "low" : "high",
          issue: known
            ? null
            : `"${node.name}" (${node.path}) uses ${hex}, which isn't in the approved palette.${suggestion}`,
          recommendation: known ? null : "Use a color from the approved palette (see tokens.md).",
          confidence: 0.9,
          nodePath: node.path,
          figmaLink,
          _node: known ? null : node,
          _label: known ? null : "Use a color from the approved palette",
        });
      }
    }

    if (node.fontSize) {
      const known = typescaleSizes.has(node.fontSize);
      findings.push({
        checkpoint: `font-size:${node.id}`,
        applicable: true,
        status: known ? "pass" : "fail",
        severity: known ? "low" : "med",
        issue: known
          ? null
          : `"${node.name}" (${node.path}) uses ${node.fontSize}px, not one of the confirmed Arvo typescale sizes (${typescaleSizesText}).`,
        recommendation: known ? null : "Use one of the confirmed typescale sizes (see tokens.md).",
        confidence: 0.85,
        nodePath: node.path,
        figmaLink,
        _node: known ? null : node,
        _label: known ? null : `Font ${node.fontSize}px not in scale`,
      });
    }

    if (typeof node.cornerRadius === "number") {
      const known = radiusTokens.has(Math.round(node.cornerRadius));
      findings.push({
        checkpoint: `radius:${node.id}`,
        applicable: true,
        status: known ? "pass" : "fail",
        severity: known ? "low" : "med",
        issue: known
          ? null
          : `"${node.name}" (${node.path}) has a corner radius of ${node.cornerRadius}px, which isn't one of Arvo's radius tokens (${radiusScaleText}).`,
        recommendation: known ? null : "Use an approved radius token (see tokens.md).",
        confidence: 0.85,
        nodePath: node.path,
        figmaLink,
        _node: known ? null : node,
        _label: known ? null : `Radius ${node.cornerRadius}px off-scale`,
      });
    }
  }

  const spacingCandidates = dedupeWrappers(
    nodes.filter((n) => (n.paddingLeft ?? n.paddingRight ?? n.itemSpacing) !== undefined),
    "path"
  );

  for (const node of spacingCandidates) {
    const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);
    const values = [
      ["paddingLeft", node.paddingLeft],
      ["paddingRight", node.paddingRight],
      ["itemSpacing", node.itemSpacing],
    ].filter(([, v]) => typeof v === "number" && v > 0);

    const failing = values.filter(([, v]) => !spacingTokens.has(v));
    const passing = values.filter(([, v]) => spacingTokens.has(v));

    for (const [prop] of passing) {
      findings.push({
        checkpoint: `spacing:${prop}:${node.id}`,
        applicable: true,
        status: "pass",
        severity: "low",
        issue: null,
        recommendation: null,
        confidence: 0.85,
        nodePath: node.path,
        figmaLink,
        _node: null,
        _label: null,
      });
    }

    if (failing.length > 0) {
      const propList = failing.map(([prop, value]) => `${prop} (${value}px)`).join(", ");
      const combinedLabel =
        failing.length === 1
          ? `${failing[0][0]} ${failing[0][1]}px off-scale`
          : `${failing.map(([p]) => p).join("/")} off-scale`;

      findings.push({
        checkpoint: `spacing:${failing.map(([p]) => p).join("+")}:${node.id}`,
        applicable: true,
        status: "fail",
        severity: "med",
        issue: `"${node.name}" (${node.path}) has ${propList}, which isn't on the Arvo spacing scale (${spacingScaleText}px).`,
        recommendation: "Use a value from the approved spacing scale (see tokens.md).",
        confidence: 0.85,
        nodePath: node.path,
        figmaLink,
        _node: node,
        _label: combinedLabel,
      });
    }
  }

  return findings;
}

function runLiveDeterministicChecks(
  elements,
  { colorTokenMap, spacingTokens, radiusTokens, typescaleSizes, spacingScaleText, typescaleSizesText, radiusScaleText }
) {
  const findings = [];

  for (const el of elements) {
    if (el.backgroundColor && el.backgroundColor.a > 0.05) {
      const hex = hexFromRgb255(el.backgroundColor);
      const known = colorTokenMap.has(hex);
      const nearest = known ? null : nearestColorToken(hex, colorTokenMap);
      const suggestion = nearest ? ` Closest known token: ${nearest.names[0]} (${nearest.hex}).` : "";

      findings.push({
        checkpoint: `bg-color:${el.selector}`,
        applicable: true,
        status: known ? "pass" : "fail",
        severity: known ? "low" : "high",
        issue: known
          ? null
          : `"${el.selector}" uses background ${hex}, which isn't in the approved palette.${suggestion}`,
        recommendation: known ? null : "Use a color from the approved palette (see tokens.md).",
        confidence: 0.9,
        nodePath: el.selector,
        _el: known ? null : el,
        _label: known ? null : "Use a color from the approved palette",
      });
    }

    if (TEXTY_TAGS.has(el.tag) && el.fontSize) {
      const rounded = Math.round(el.fontSize);
      const known = typescaleSizes.has(rounded);
      findings.push({
        checkpoint: `font-size:${el.selector}`,
        applicable: true,
        status: known ? "pass" : "fail",
        severity: known ? "low" : "med",
        issue: known
          ? null
          : `"${el.selector}" uses ${rounded}px text, not one of the confirmed Arvo typescale sizes (${typescaleSizesText}).`,
        recommendation: known ? null : "Use one of the confirmed typescale sizes (see tokens.md).",
        confidence: 0.85,
        nodePath: el.selector,
        _el: known ? null : el,
        _label: known ? null : `Font ${rounded}px not in scale`,
      });
    }

    if (typeof el.borderRadius === "string") {
      const firstValue = parseFloat(el.borderRadius);
      if (!Number.isNaN(firstValue) && firstValue > 0) {
        const known = radiusTokens.has(Math.round(firstValue));
        findings.push({
          checkpoint: `radius:${el.selector}`,
          applicable: true,
          status: known ? "pass" : "fail",
          severity: known ? "low" : "med",
          issue: known
            ? null
            : `"${el.selector}" has a corner radius of ${Math.round(firstValue)}px, which isn't one of Arvo's radius tokens (${radiusScaleText}).`,
          recommendation: known ? null : "Use an approved radius token (see tokens.md).",
          confidence: 0.8,
          nodePath: el.selector,
          _el: known ? null : el,
          _label: known ? null : `Radius ${Math.round(firstValue)}px off-scale`,
        });
      }
    }
  }

  const spacingCandidates = dedupeWrappers(
    elements.filter(
      (el) => el.paddingLeft > 0 || el.paddingRight > 0 || el.paddingTop > 0 || el.paddingBottom > 0
    ),
    "selector"
  );

  for (const el of spacingCandidates) {
    const values = [
      ["paddingLeft", el.paddingLeft],
      ["paddingRight", el.paddingRight],
      ["paddingTop", el.paddingTop],
      ["paddingBottom", el.paddingBottom],
    ]
      .filter(([, v]) => v > 0)
      .map(([prop, v]) => [prop, Math.round(v)]);

    const failing = values.filter(([, v]) => !spacingTokens.has(v));
    const passing = values.filter(([, v]) => spacingTokens.has(v));

    for (const [prop] of passing) {
      findings.push({
        checkpoint: `spacing:${prop}:${el.selector}`,
        applicable: true,
        status: "pass",
        severity: "low",
        issue: null,
        recommendation: null,
        confidence: 0.85,
        nodePath: el.selector,
        _el: null,
        _label: null,
      });
    }

    if (failing.length > 0) {
      const propList = failing.map(([prop, value]) => `${prop} (${value}px)`).join(", ");
      const combinedLabel =
        failing.length === 1
          ? `${failing[0][0]} ${failing[0][1]}px off-scale`
          : `${failing.map(([p]) => p).join("/")} off-scale`;

      findings.push({
        checkpoint: `spacing:${failing.map(([p]) => p).join("+")}:${el.selector}`,
        applicable: true,
        status: "fail",
        severity: "med",
        issue: `"${el.selector}" has ${propList}, which isn't on the Arvo spacing scale (${spacingScaleText}px).`,
        recommendation: "Use a value from the approved spacing scale (see tokens.md).",
        confidence: 0.85,
        nodePath: el.selector,
        _el: el,
        _label: combinedLabel,
      });
    }
  }

  return findings;
}

export async function runDesignSystemValidator({ figmaUrl, liveUrl }) {
  const knowledgeFiles = await loadKnowledge("design-system"); // tokens.md + components.md + patterns.md
  const knowledgeText = knowledgeFiles.map((k) => `### ${k.file}\n${k.text}`).join("\n\n");

  const tokensFile = knowledgeFiles.find((k) => k.file.endsWith("tokens.md"));
  const tokensText = tokensFile?.text || "";

  const colorTokenMap = extractColorTokens(tokensText);
  const spacingTokens = extractSpacingScale(tokensText);
  const radiusTokens = extractRadiusScale(tokensText);
  const typescaleSizes = extractTypescaleSizes(tokensText);

  const spacingScaleText = [...spacingTokens].sort((a, b) => a - b).join("/");
  const typescaleSizesText = [...typescaleSizes].sort((a, b) => b - a).join("/");
  const radiusScaleText = [...radiusTokens]
    .sort((a, b) => a - b)
    .map((v) => (v >= 999 ? `${v}px circle` : `${v}px`))
    .join(" / ");

  const scales = {
    colorTokenMap,
    spacingTokens,
    radiusTokens,
    typescaleSizes,
    spacingScaleText,
    typescaleSizesText,
    radiusScaleText,
  };

  if (figmaUrl) {
    const frame = await fetchFigmaFrame(figmaUrl);
    const highlighter = createFrameHighlighter(frame);

    const deterministicFindings = runFigmaDeterministicChecks(frame, scales);

    let llmFindings = [];
    try {
      llmFindings = await compareAgainstKnowledge({
        systemPrompt: FIGMA_SYSTEM_PROMPT,
        knowledgeText,
        subjectData: frame,
        instructions:
          "Only judge component usage (does each element match an approved component from components.md, or is it custom/unapproved) and any obvious platform-pattern inconsistency from patterns.md. Do NOT flag color, spacing, radius, or font-size — those have already been checked separately.",
      });
    } catch {
      llmFindings = [];
    }

    const failingWithNodes = deterministicFindings.filter((f) => f.status === "fail" && f._node);
    const overviewResult = await highlighter.buildOverview(
      failingWithNodes.map((f) => ({ node: f._node, label: f._label, severity: f.severity }))
    );
    const dimensionScreenshot = overviewResult?.image || null;
    // ranks[] is aligned 1:1 with failingWithNodes (the array just passed in).
    if (overviewResult?.ranks) {
      failingWithNodes.forEach((f, i) => {
        f.overviewRank = overviewResult.ranks[i] ?? null;
      });
    }
    for (const f of failingWithNodes) {
      f.elementScreenshotBase64 = await highlighter.getElementThumbnail(f._node);
    }

    const cleanedDeterministic = deterministicFindings.map(({ _node, _label, ...rest }) => rest);
    const findings = [
      ...cleanedDeterministic,
      ...llmFindings.map((f) => ({ ...f, source: "llm-component-check" })),
    ];

    return {
      validator: "design-system",
      source: "figma",
      findings: findings.filter((f) => f.status === "fail"),
      allFindings: findings,
      dimensionScore: scoreDimension(findings),
      dimensionScreenshot,
    };
  }

  if (liveUrl) {
    const capture = await captureLiveDesignElements(liveUrl);
    const baseScreenshot = Buffer.from(capture.screenshotBase64, "base64");

    const deterministicFindings = runLiveDeterministicChecks(capture.elements, scales);

    let llmFindings = [];
    try {
      llmFindings = await compareAgainstKnowledge({
        systemPrompt: LIVE_SYSTEM_PROMPT,
        knowledgeText,
        subjectData: {
          url: liveUrl,
          elements: capture.elements.map((e) => ({ tag: e.tag, text: e.text, selector: e.selector })),
        },
        instructions:
          "Only judge component usage — does each element look like an approved component from components.md, or a hand-rolled custom one? Do NOT flag color, spacing, radius, or font-size — those have already been checked separately against the real computed CSS.",
      });
    } catch {
      llmFindings = [];
    }

    const failingWithEl = deterministicFindings.filter((f) => f.status === "fail" && f._el);

    let dimensionScreenshot = null;
    if (failingWithEl.length > 0) {
      const overviewResult = await annotateOverview(
        baseScreenshot,
        failingWithEl.map((f) => ({
          x: f._el.x,
          y: f._el.y,
          width: f._el.width,
          height: f._el.height,
          label: f._label,
          severity: f.severity,
        }))
      );
      dimensionScreenshot = overviewResult?.image || null;
      // ranks[] is aligned 1:1 with failingWithEl (the array just passed in).
      if (overviewResult?.ranks) {
        failingWithEl.forEach((f, i) => {
          f.overviewRank = overviewResult.ranks[i] ?? null;
        });
      }
    }

    for (const f of failingWithEl) {
      try {
        f.elementScreenshotBase64 = await cropRegion(baseScreenshot, f._el);
      } catch {
        f.elementScreenshotBase64 = null;
      }
    }

    const cleanedDeterministic = deterministicFindings.map(({ _el, _label, ...rest }) => rest);
    const findings = [
      ...cleanedDeterministic,
      ...llmFindings.map((f) => ({ ...f, source: "llm-component-check" })),
    ];

    return {
      validator: "design-system",
      source: "live-dom",
      findings: findings.filter((f) => f.status === "fail"),
      allFindings: findings,
      dimensionScore: scoreDimension(findings),
      dimensionScreenshot,
    };
  }

  throw Object.assign(new Error("design-system validator requires a figmaUrl or liveUrl"), {
    status: 400,
  });
}