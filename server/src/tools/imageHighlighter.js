/**
 * imageHighlighter
 * Three jobs:
 *   - annotateOverview: ONE static PNG, every failure marked with a small
 *     numbered severity-colored dot. Numbered 1, 2, 3... in severity order,
 *     so #1 is always the worst issue shown. Returns { image, ranks } —
 *     `ranks` lets a caller match each of ITS OWN findings (by array
 *     position) back to the number drawn for it, so the same number can be
 *     surfaced next to that finding elsewhere (the Issues table).
 *   - buildInteractiveOverlay: the SAME numbering over the SAME image, but as
 *     a self-contained HTML fragment where each dot is a real marker that
 *     shows the finding's full text in a tooltip on hover/focus. No leader
 *     lines, no label collision math needed — the browser's own hit-testing
 *     does the job the PNG had to fake with geometry.
 *   - cropRegion: a small, tightly-cropped picture of just ONE element —
 *     used for per-checkpoint thumbnails.
 *
 * WHY THE PNG NO LONGER DRAWS LABELS
 * The old version burned the full label text + a leader line into the pixels
 * for every finding. That reads fine at ~20 findings. At real-world density
 * (100+ findings on one dense dashboard screen) the collision-avoidance code
 * runs out of room: labels stack, leader lines cross, and the image becomes
 * the wall-of-string-and-numbers screenshot this was built to avoid. Text-in-
 * pixels doesn't scale because there's a fixed amount of image around each
 * cluster of dots and no more of it appears as findings increase.
 *
 * A numbered dot does scale — dots can sit a few px apart without becoming
 * unreadable, since there's no text to collide. So the PNG now draws dots
 * only (for e-mail/Slack/PDF contexts with no hover), and the interactive
 * HTML version is the one meant for actually reading findings on a busy
 * screen: hover a dot, get the exact text, nothing else on screen moves.
 */

import sharp from "sharp";

const SEVERITY_ORDER = { high: 0, med: 1, low: 2 };
const SEVERITY_COLOR = { high: "#D9311B", med: "#C7880D", low: "#27A644" };
const SEVERITY_LABEL = { high: "HIGH", med: "MED", low: "LOW" };

function escapeXml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function escapeHtml(str) {
  return escapeXml(str);
}

/**
 * Shared prep: sorts by severity (so #1 is always worst), clamps each
 * annotation's box into image bounds, and computes the dot's true anchor
 * point. Both the PNG and the HTML renderer draw from this same list, so the
 * numbering and positions are always identical between the two outputs —
 * you can generate both from one findings array and they'll agree.
 */
function prepareItems(annotations, imgW, imgH) {
  const sorted = (annotations || [])
    .map((a, originalIndex) => ({ ...a, originalIndex }))
    .filter((a) => typeof a.x === "number" && typeof a.y === "number")
    .sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 1) - (SEVERITY_ORDER[b.severity] ?? 1));

  return sorted.map((a, idx) => {
    const rank = idx + 1;
    const color = SEVERITY_COLOR[a.severity] || SEVERITY_COLOR.med;

    const rectX = Math.max(0, Math.min(a.x, imgW - 1));
    const rectY = Math.max(0, Math.min(a.y, imgH - 1));
    const rectW = Math.max(1, Math.min(a.width || 0, imgW - rectX));
    const rectH = Math.max(1, Math.min(a.height || 0, imgH - rectY));

    return {
      rank,
      originalIndex: a.originalIndex,
      severity: a.severity,
      color,
      label: a.label,
      rectX,
      rectY,
      rectW,
      rectH,
      cx: rectX + rectW / 2,
      cy: rectY + rectH / 2,
    };
  });
}

/**
 * annotations: [{ x, y, width, height, label, severity }] — all in the SAME
 * pixel space as the base image.
 *
 * Returns { image, ranks } — `ranks` is aligned to the INPUT `annotations`
 * array (same length/order; `null` for any entry filtered out for missing
 * x/y) — so a caller can zip its own findings array against `ranks` by
 * position and know exactly which finding got which numbered dot.
 */
export async function annotateOverview(baseImageBuffer, annotations, options = {}) {
  const { strokeWidth = 3, dotRadius = 13, fontSize = 13 } = options;

  const meta = await sharp(baseImageBuffer).metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH) return null;

  const items = prepareItems(annotations, imgW, imgH);
  if (items.length === 0) return null;

  const parts = [];

  for (const it of items) {
    const { rank, color, rectX, rectY, rectW, rectH } = it;

    // Thin box around the element itself — still useful at a glance, and
    // unlike a label it never needs to move or collide with anything.
    parts.push(
      `<rect x="${rectX}" y="${rectY}" width="${rectW}" height="${rectH}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-opacity="0.85" />`
    );

    // Numbered dot at the box's top-left corner. Corner rather than center:
    // dots on adjacent/overlapping elements land at different points instead
    // of stacking on top of each other, which happens constantly on dense
    // toolbars and grids like the one this was built for.
    const dotCx = rectX;
    const dotCy = rectY;
    parts.push(`<circle cx="${dotCx}" cy="${dotCy}" r="${dotRadius}" fill="${color}" stroke="white" stroke-width="2" />`);
    parts.push(
      `<text x="${dotCx}" y="${dotCy + dotRadius * 0.35}" font-family="Arial, sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle">${rank}</text>`
    );
  }

  const svgOverlay = Buffer.from(
    `<svg width="${imgW}" height="${imgH}" xmlns="http://www.w3.org/2000/svg">${parts.join("\n")}</svg>`
  );

  const composited = await sharp(baseImageBuffer)
    .composite([{ input: svgOverlay, top: 0, left: 0 }])
    .png()
    .toBuffer();

  const ranks = new Array((annotations || []).length).fill(null);
  for (const it of items) {
    ranks[it.originalIndex] = it.rank;
  }

  return { image: composited.toString("base64"), ranks };
}

/**
 * The interactive counterpart to annotateOverview: same image, same
 * numbering, same severity colors — but as HTML, with a real hover tooltip
 * per dot instead of text baked into the pixels. Pure CSS `:hover`/`:focus`,
 * no client-side JS, so it drops straight into a static report page or an
 * iframe.
 *
 * Positioning uses percentages of image dimensions, so it stays correct if
 * the embedding page scales the image (e.g. `max-width: 100%`) — the caller
 * doesn't need to know the image's rendered pixel size, only its natural
 * pixel size (imgW/imgH), which this reads from the buffer itself.
 *
 * Returns { html, ranks } — `ranks` has the exact same alignment contract as
 * annotateOverview, so both can be generated from one findings array and
 * stay numbered identically.
 *
 * `imageSrc` lets the caller point at an already-hosted URL instead of
 * inlining the image as base64 (keeps the HTML small when the image is
 * served separately); if omitted, the base image is inlined as a data URI.
 */
export async function buildInteractiveOverlay(baseImageBuffer, annotations, options = {}) {
  const { imageSrc = null, dotSize = 26, containerId = "uxva-overlay" } = options;

  const meta = await sharp(baseImageBuffer).metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH) return null;

  const items = prepareItems(annotations, imgW, imgH);
  if (items.length === 0) return null;

  const src = imageSrc || `data:image/png;base64,${baseImageBuffer.toString("base64")}`;

  const markers = items
    .map((it) => {
      const leftPct = (it.cx / imgW) * 100;
      const topPct = (it.cy / imgH) * 100;

      // Flip the tooltip to whichever side has room, computed once here
      // (server-side) rather than at hover-time in the browser, since we
      // already know the dot's position relative to the image edges.
      const nearTop = topPct < 15;
      const nearLeft = leftPct < 15;
      const nearRight = leftPct > 85;

      const vSide = nearTop ? "below" : "above";
      const hAlign = nearLeft ? "left" : nearRight ? "right" : "center";

      const boxPct = {
        left: (it.rectX / imgW) * 100,
        top: (it.rectY / imgH) * 100,
        width: (it.rectW / imgW) * 100,
        height: (it.rectH / imgH) * 100,
      };

      return `
      <div class="uxva-box" style="
        left:${boxPct.left}%; top:${boxPct.top}%;
        width:${boxPct.width}%; height:${boxPct.height}%;
        border-color:${it.color};
      "></div>
      <button type="button" class="uxva-marker uxva-${vSide} uxva-${hAlign}"
        style="left:${leftPct}%; top:${topPct}%; --uxva-color:${it.color}; --uxva-size:${dotSize}px;"
        aria-label="Finding ${it.rank}: ${escapeHtml(it.label || "")}">
        <span class="uxva-dot">${it.rank}</span>
        <span class="uxva-tooltip" role="tooltip">
          <span class="uxva-tooltip-sev" style="background:${it.color}">${SEVERITY_LABEL[it.severity] || "MED"}</span>
          <span class="uxva-tooltip-text">${escapeHtml(it.label || "")}</span>
        </span>
      </button>`;
    })
    .join("\n");

  const html = `
<div id="${containerId}" class="uxva-overlay-root">
  <style>
    #${containerId} { position: relative; display: inline-block; line-height: 0; max-width: 100%; }
    #${containerId} img.uxva-base { display: block; width: 100%; height: auto; }
    #${containerId} .uxva-box {
      position: absolute; border: 2px solid; border-radius: 2px;
      pointer-events: none; opacity: 0.85;
    }
    #${containerId} .uxva-marker {
      position: absolute; transform: translate(-50%, -50%);
      width: var(--uxva-size); height: var(--uxva-size);
      border-radius: 50%; background: var(--uxva-color);
      border: 2px solid white; box-shadow: 0 1px 4px rgba(0,0,0,0.35);
      color: white; font: 700 12px/1 Arial, sans-serif;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; padding: 0; z-index: 1;
    }
    #${containerId} .uxva-marker:hover,
    #${containerId} .uxva-marker:focus-visible { z-index: 2; outline: none; }
    #${containerId} .uxva-marker:hover .uxva-tooltip,
    #${containerId} .uxva-marker:focus-visible .uxva-tooltip {
      visibility: visible; opacity: 1;
    }
    #${containerId} .uxva-tooltip {
      visibility: hidden; opacity: 0; transition: opacity 0.1s ease;
      position: absolute; width: max-content; max-width: 240px;
      background: #1a1a1a; color: #fff; border-radius: 6px;
      padding: 8px 10px; font: 400 12.5px/1.4 Arial, sans-serif;
      box-shadow: 0 4px 14px rgba(0,0,0,0.3); text-align: left;
      pointer-events: none;
    }
    #${containerId} .uxva-above .uxva-tooltip { bottom: calc(100% + 10px); }
    #${containerId} .uxva-below .uxva-tooltip { top: calc(100% + 10px); }
    #${containerId} .uxva-center .uxva-tooltip { left: 50%; transform: translateX(-50%); }
    #${containerId} .uxva-left .uxva-tooltip { left: 0; }
    #${containerId} .uxva-right .uxva-tooltip { right: 0; }
    #${containerId} .uxva-tooltip-sev {
      display: inline-block; font: 700 10px/1 Arial, sans-serif;
      padding: 2px 6px; border-radius: 3px; margin-bottom: 5px;
    }
    #${containerId} .uxva-tooltip-text { display: block; }
  </style>
  <img class="uxva-base" src="${src}" width="${imgW}" height="${imgH}" alt="Annotated screen" />
  ${markers}
</div>`.trim();

  const ranks = new Array((annotations || []).length).fill(null);
  for (const it of items) {
    ranks[it.originalIndex] = it.rank;
  }

  return { html, ranks };
}

/**
 * Crops a small region (with a little padding) out of a full screenshot —
 * used where there's no per-element render API to fall back on (the live/
 * axe-core path), unlike Figma which can render one node directly.
 */
export async function cropRegion(baseImageBuffer, region, padding = 8) {
  const meta = await sharp(baseImageBuffer).metadata();
  const imgW = meta.width || 0;
  const imgH = meta.height || 0;
  if (!imgW || !imgH || typeof region?.x !== "number") return null;

  const left = Math.max(0, Math.floor(region.x - padding));
  const top = Math.max(0, Math.floor(region.y - padding));
  const width = Math.min(imgW - left, Math.ceil((region.width || 0) + padding * 2));
  const height = Math.min(imgH - top, Math.ceil((region.height || 0) + padding * 2));
  if (width <= 0 || height <= 0) return null;

  const cropped = await sharp(baseImageBuffer).extract({ left, top, width, height }).png().toBuffer();
  return cropped.toString("base64");
}