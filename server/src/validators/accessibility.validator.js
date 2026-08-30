import { runAxeAudit } from "../tools/axeRunner.js";
import { fetchFigmaFrame, buildFigmaNodeUrl } from "../tools/figmaClient.js";
import { createFrameHighlighter } from "../tools/figmaHighlighter.js";
import { annotateOverview, cropRegion } from "../tools/imageHighlighter.js";
import { compareAgainstKnowledge } from "../tools/llmClient.js";
import { loadKnowledge } from "../agent/memory.js";
import { scoreDimension } from "../agent/reflector.js";

const IMPACT_TO_SEVERITY = {
  critical: "high",
  serious: "high",
  moderate: "med",
  minor: "low",
};

const SYSTEM_PROMPT = `You are the accessibility validator inside a UX Validator Agent,
running in Figma-only mode (no live build available yet). You are given a flat list of
nodes from a Figma frame — fills, font sizes, dimensions, names — along with
pre-computed contrast ratios, touch-target checks, and background/border-color
checks (already done separately — do not repeat those three).

Your knowledge file (accessibility.md) has a section called "What Arvo Already
Guarantees Automatically" — anything listed there (correct roles, ARIA wiring,
keyboard support, focus styles, focus trap/return, live-region announcements,
aria-busy, disabled semantics) is handled by Arvo whenever a real Arvo component
is used. Do NOT flag those as missing unless the frame gives clear evidence a
component was overridden or hand-rolled instead of using the real one — a
missing focus ring or missing ARIA wiring is NOT inferable from a static Figma
frame at all, so never invent that finding here regardless.

Also do not invent findings about keyboard navigation, focus order, error
announcements, or reduced-motion — none of those exist as concepts in a static
design file and can only be judged on a live, running page.

What you CAN judge from static Figma data: icon-only elements with no visible
text label (per the "Forms" / label-source rules in accessibility.md), and
anything else in the "Contract Violations Beyond Raw WCAG" list that's
genuinely visible in a picture of the screen.`;

function relativeLuminance({ r, g, b }) {
  const chan = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

function contrastRatio(colorA, colorB) {
  const lA = relativeLuminance(colorA) + 0.05;
  const lB = relativeLuminance(colorB) + 0.05;
  return Math.round((Math.max(lA, lB) / Math.min(lA, lB)) * 100) / 100;
}

function sameColor(colorA, colorB, tolerance = 0.02) {
  if (!colorA || !colorB) return false;
  return (
    Math.abs(colorA.r - colorB.r) < tolerance &&
    Math.abs(colorA.g - colorB.g) < tolerance &&
    Math.abs(colorA.b - colorB.b) < tolerance
  );
}

const INTERACTIVE_NAME_HINTS = /button|btn|input|field|checkbox|radio|toggle|switch|tab|link|icon/i;

/**
 * Reads the touch-target minimum straight out of accessibility.md instead
 * of assuming a number in code. Matches both "touch target" and "target
 * size" phrasing (AD05 uses the raw WCAG criterion name, not "touch
 * target"), so this works regardless of which term your file actually uses.
 */
function extractTouchTargetMinimum(accessibilityText) {
  if (!accessibilityText) return 24;
  const match = accessibilityText.match(
    /(?:touch targets?|target size)[\s\S]{0,200}?(\d+)\s*[×x]\s*\d+\s*px/i
  );
  return match ? Number(match[1]) : 24;
}

function dedupeWrappers(nodes) {
  return nodes.filter(
    (n) => !nodes.some((other) => other !== n && other.path && other.path.startsWith(`${n.path} > `))
  );
}

/**
 * Same pattern as the design-system validator: each failing check keeps a
 * private `_node` + `_label` (stripped before returning) so one overview
 * image and per-element thumbnails can be built once, after every failure
 * in this run is known.
 */
function runStaticChecks(frame, touchTargetMinimum) {
  const nodes = frame.summary || [];
  const background = nodes.find((n) => n.type === "FRAME")?.fills?.[0] || { r: 1, g: 1, b: 1 };
  const findings = [];

  for (const node of nodes) {
    if (node.fontSize && node.fills?.[0]) {
      const ratio = contrastRatio(node.fills[0], background);
      const isLargeText = node.fontSize >= 18 || (node.fontSize >= 14 && (node.fontWeight || 400) >= 700);
      const minRatio = isLargeText ? 3 : 4.5;
      const fails = ratio < minRatio;
      const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);

      findings.push({
        checkpoint: `contrast:${node.id}`,
        applicable: true,
        status: fails ? "fail" : "pass",
        severity: fails ? "high" : "low",
        issue: fails
          ? `"${node.name}" (${node.path}) has an estimated contrast ratio of ${ratio}:1 against the frame background (needs ${minRatio}:1). Approximate — checked against frame background only, not the immediate parent shape.`
          : null,
        recommendation: fails ? "Increase text/background contrast to meet WCAG AA (1.4.3)." : null,
        confidence: 0.6,
        nodePath: node.path,
        figmaLink,
        _node: fails ? node : null,
        _label: fails ? `Contrast ${ratio}:1, needs ${minRatio}:1` : null,
      });
    }

    if (node.fontSize && node.fontSize < 12) {
      const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);
      findings.push({
        checkpoint: `font-size:${node.id}`,
        applicable: true,
        status: "fail",
        severity: "med",
        issue: `"${node.name}" (${node.path}) uses ${node.fontSize}px text — below the 12pt/16px readability floor (1.4.12).`,
        recommendation: "Increase body text to at least 12pt (≈16px).",
        confidence: 0.85,
        nodePath: node.path,
        figmaLink,
        _node: node,
        _label: `Text ${node.fontSize}px too small`,
      });
    }

    // "Background and border painted with the same color value" — explicit
    // Contract Violation in accessibility.md, and fully checkable here:
    // Figma exposes both fills and strokes per node, no live DOM needed.
    if (node.fills?.[0] && node.strokes?.[0]) {
      const isSame = sameColor(node.fills[0], node.strokes[0]);
      const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);
      findings.push({
        checkpoint: `bg-border-contrast:${node.id}`,
        applicable: true,
        status: isSame ? "fail" : "pass",
        severity: isSame ? "med" : "low",
        issue: isSame
          ? `"${node.name}" (${node.path}) has its background and border painted the same color. Under Forced Colors / High Contrast mode both get replaced identically and the element loses all visual structure.`
          : null,
        recommendation: isSame ? "Use a distinct border color from the background (e.g. a real border token, not a fill difference)." : null,
        confidence: 0.75,
        nodePath: node.path,
        figmaLink,
        _node: isSame ? node : null,
        _label: isSame ? "Background/border same color" : null,
      });
    }
  }

  const touchCandidates = dedupeWrappers(
    nodes.filter((n) => INTERACTIVE_NAME_HINTS.test(n.name || "") && n.width && n.height)
  );

  for (const node of touchCandidates) {
    const meetsSize = node.width >= touchTargetMinimum && node.height >= touchTargetMinimum;
    const figmaLink = buildFigmaNodeUrl(frame.fileKey, node.id);

    findings.push({
      checkpoint: `touch-target:${node.id}`,
      applicable: true,
      status: meetsSize ? "pass" : "fail",
      severity: meetsSize ? "low" : "med",
      issue: meetsSize
        ? null
        : `"${node.name}" (${node.path}) is ${Math.round(node.width)}x${Math.round(node.height)}px — below the ${touchTargetMinimum}x${touchTargetMinimum}px touch target minimum (per accessibility.md).`,
      recommendation: meetsSize ? null : `Increase the tappable area to at least ${touchTargetMinimum}x${touchTargetMinimum}px.`,
      confidence: 0.85,
      nodePath: node.path,
      figmaLink,
      _node: meetsSize ? null : node,
      _label: meetsSize ? null : "Touch target too small",
    });
  }

  return findings;
}

export async function runAccessibilityValidator({ liveUrl, figmaUrl }) {
  if (!liveUrl && !figmaUrl) {
    throw Object.assign(new Error("accessibility validator requires a liveUrl or a figmaUrl"), {
      status: 400,
    });
  }

  const allFindings = [];
  let sources = [];
  let figmaOverview = null;
  let liveOverview = null;

  if (figmaUrl) {
    const knowledgeFiles = await loadKnowledge("accessibility");
    const knowledgeText = knowledgeFiles.map((k) => `### ${k.file}\n${k.text}`).join("\n\n");
    const touchTargetMinimum = extractTouchTargetMinimum(knowledgeText);

    const frame = await fetchFigmaFrame(figmaUrl);
    const highlighter = createFrameHighlighter(frame);
    const staticFindings = runStaticChecks(frame, touchTargetMinimum);

    let llmFindings = [];
    try {
      llmFindings = await compareAgainstKnowledge({
        systemPrompt: SYSTEM_PROMPT,
        knowledgeText,
        subjectData: frame,
        instructions:
          "Flag any icon-only elements with no visible text label, and anything else in the 'Contract Violations Beyond Raw WCAG' list that's genuinely inferable from a static picture of this screen. Do not repeat contrast, touch-target, font-size, or background/border-color findings — those are already computed separately. Do not flag anything listed under 'What Arvo Already Guarantees Automatically.'",
      });
    } catch {
      llmFindings = [];
    }

    const failingWithNodes = staticFindings.filter((f) => f.status === "fail" && f._node);
    const overviewResult = await highlighter.buildOverview(
      failingWithNodes.map((f) => ({ node: f._node, label: f._label, severity: f.severity }))
    );
    figmaOverview = overviewResult?.image || null;
    // buildOverview's ranks[] is aligned 1:1 with failingWithNodes (the
    // array we just passed it), so index i's rank belongs to failingWithNodes[i].
    if (overviewResult?.ranks) {
      failingWithNodes.forEach((f, i) => {
        f.overviewRank = overviewResult.ranks[i] ?? null;
      });
    }
    for (const f of failingWithNodes) {
      f.elementScreenshotBase64 = await highlighter.getElementThumbnail(f._node);
    }

    const cleanedStatic = staticFindings.map(({ _node, _label, ...rest }) => rest);

    for (const f of [...cleanedStatic, ...llmFindings]) {
      allFindings.push({ ...f, checkpoint: `figma:${f.checkpoint}`, source: "figma" });
    }
    sources.push("figma-static-precheck");
  }

  if (liveUrl) {
    // axe-core covers the overwhelming majority of accessibility.md
    // correctly and deterministically once there's a real DOM to check —
    // contrast, labels, roles, ARIA wiring, focus management, target size
    // (2.5.8, 24x24 AA) are all real axe-core rules under the wcag22aa tag.
    await loadKnowledge("accessibility");

    const audit = await runAxeAudit(liveUrl);
    const baseScreenshot = audit.screenshotBase64 ? Buffer.from(audit.screenshotBase64, "base64") : null;

    const overviewAnnotations = [];
    // Parallel array: overviewAnnotations[i] belongs to the violation at
    // liveFindingRefs[i] (a violation can produce multiple boxes/annotations,
    // so this is NOT a 1:1 index match with allFindings — tracked explicitly
    // instead of assumed).
    const liveFindingRefs = [];

    for (const v of audit.violations) {
      const severity = IMPACT_TO_SEVERITY[v.impact] || "med";
      const regions = v.nodes.map((n) => n.box).filter(Boolean);

      let elementScreenshotBase64 = null;
      if (baseScreenshot && regions[0]) {
        try {
          elementScreenshotBase64 = await cropRegion(baseScreenshot, regions[0]);
        } catch {
          elementScreenshotBase64 = null;
        }
      }

      const finding = {
        checkpoint: `live:${v.id}`,
        applicable: true,
        status: "fail",
        severity,
        issue: `${v.help} (${v.nodes.length} element${v.nodes.length === 1 ? "" : "s"} affected)`,
        recommendation: v.helpUrl,
        confidence: 0.95,
        source: "live",
        elementScreenshotBase64,
      };

      for (const box of regions) {
        overviewAnnotations.push({
          x: box.x,
          y: box.y,
          width: box.width,
          height: box.height,
          label: v.help,
          severity,
        });
        // Same finding object reference for every box it produced, so
        // whichever box's rank we pick below writes back to the one finding.
        liveFindingRefs.push(finding);
      }

      allFindings.push(finding);
    }

    if (baseScreenshot && overviewAnnotations.length > 0) {
      try {
        const overviewResult = await annotateOverview(baseScreenshot, overviewAnnotations);
        liveOverview = overviewResult?.image || null;
        // A violation with several boxes gets several ranks (one per box);
        // use the first — same severity means the collision-avoidance sort
        // is stable, so this is a real, reproducible number, not arbitrary.
        if (overviewResult?.ranks) {
          overviewResult.ranks.forEach((rank, i) => {
            const finding = liveFindingRefs[i];
            if (finding && finding.overviewRank == null && rank != null) {
              finding.overviewRank = rank;
            }
          });
        }
      } catch {
        liveOverview = null;
      }
    }

    for (let i = 0; i < audit.passes; i++) {
      allFindings.push({
        checkpoint: `live:axe-pass-${i}`,
        applicable: true,
        status: "pass",
        severity: "low",
        issue: null,
        recommendation: null,
        confidence: 0.95,
        source: "live",
      });
    }
    sources.push("axe-core");
  }

  const dimensionScreenshot = liveOverview || figmaOverview || null;

  return {
    validator: "accessibility",
    source: sources.join(" + "),
    findings: allFindings.filter((f) => f.status === "fail"),
    allFindings,
    dimensionScore: scoreDimension(allFindings),
    dimensionScreenshot,
  };
}