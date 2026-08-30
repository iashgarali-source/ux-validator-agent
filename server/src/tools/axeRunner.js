/**
 * axeRunner
 * Injects axe-core into the live page via Playwright and runs a WCAG 2.2
 * audit against the real DOM. This is the "ground truth" tool for the
 * accessibility validator — deterministic, no LLM judgement needed for the
 * pass/fail itself.
 *
 * Also captures a full-page screenshot and, for every violation, the
 * on-screen bounding box of each affected element — taken from the SAME
 * page/DOM state axe just audited, so a highlight box drawn later lines up
 * with what's actually pictured. Playwright's locator.boundingBox() already
 * returns document-relative coordinates (not just viewport-relative), which
 * is exactly what a full-page screenshot needs.
 */

import { chromium } from "playwright";
import { readFileSync } from "fs";
import { createRequire } from "module";

const require = createRequire(import.meta.url);
const axeCorePath = require.resolve("axe-core/axe.min.js");
const axeSource = readFileSync(axeCorePath, "utf-8");

export async function runAxeAudit(url) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.addScriptTag({ content: axeSource });

    const results = await page.evaluate(async () => {
      // eslint-disable-next-line no-undef
      return await axe.run(document, {
        runOnly: {
          type: "tag",
          values: ["wcag2a", "wcag2aa", "wcag22aa"],
        },
      });
    });

    const screenshotBuffer = await page.screenshot({ fullPage: true, type: "png" });

    const violations = [];
    for (const v of results.violations) {
      const nodes = [];
      for (const n of v.nodes) {
        // Multi-part targets (e.g. into an iframe/shadow root) aren't a
        // single locatable CSS selector — skip the box lookup rather than
        // risk a bad match, the finding itself is unaffected either way.
        const selector = typeof n.target?.[0] === "string" && n.target.length === 1 ? n.target[0] : null;
        let box = null;
        if (selector) {
          try {
            box = await page.locator(selector).first().boundingBox({ timeout: 2000 });
          } catch {
            box = null;
          }
        }
        nodes.push({
          target: n.target,
          html: n.html?.slice(0, 200),
          box, // {x, y, width, height} in document coords, or null
        });
      }
      violations.push({
        id: v.id,
        impact: v.impact, // "minor" | "moderate" | "serious" | "critical"
        description: v.description,
        help: v.help,
        helpUrl: v.helpUrl,
        nodes,
      });
    }

    return {
      url,
      violations,
      passes: results.passes.length,
      incomplete: results.incomplete.length,
      screenshotBase64: screenshotBuffer.toString("base64"),
    };
  } finally {
    await browser.close();
  }
}