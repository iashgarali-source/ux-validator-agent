/**
 * figmaHighlighter
 * The whole-frame image is fetched ONCE per run (memoized) and reused for
 * the single dimension-level overview. Per-checkpoint thumbnails are a
 * separate, much simpler thing: Figma can render any node directly, so a
 * failing element's thumbnail is just that node's own image — no cropping
 * math needed, Figma already renders it isolated.
 */

import { fetchFigmaFrameImage } from "./figmaClient.js";
import { annotateOverview, buildInteractiveOverlay } from "./imageHighlighter.js";

// Coordinates from Figma's node data are in 1x page units; the frame image
// is rendered at 2x for crispness, so positions get multiplied to match.
const RENDER_SCALE = 2;

export function createFrameHighlighter(frame) {
  let baseImagePromise = null;

  function getBaseImage() {
    if (!frame?.fileKey || !frame?.rootId) return Promise.resolve(null);
    if (!baseImagePromise) {
      baseImagePromise = fetchFigmaFrameImage(frame.fileKey, frame.rootId, RENDER_SCALE).catch(
        () => null
      );
    }
    return baseImagePromise;
  }

  /**
   * Shared by buildOverview and buildOverviewInteractive: fetches the base
   * image once (memoized), converts { node, label, severity } annotations
   * into pixel-space regions, and remaps the renderer's ranks back to the
   * caller's original array positions. `renderFn(base, regions)` must return
   * `{ image | html, ranks }` — matches both annotateOverview and
   * buildInteractiveOverlay's return shapes.
   */
  async function runOverview(renderFn, annotations) {
    const base = await getBaseImage();
    if (!base || !frame.rootBox) return null;

    const input = annotations || [];

    // originalIndex carried through so ranks can be reported back against
    // the caller's original array position, same contract as annotateOverview.
    const regions = input
      .map((a, originalIndex) => ({ ...a, originalIndex }))
      .filter((a) => a.node && typeof a.node.x === "number")
      .map((a) => ({
        x: (a.node.x - frame.rootBox.x) * RENDER_SCALE,
        y: (a.node.y - frame.rootBox.y) * RENDER_SCALE,
        width: (a.node.width || 0) * RENDER_SCALE,
        height: (a.node.height || 0) * RENDER_SCALE,
        label: a.label,
        severity: a.severity,
        originalIndex: a.originalIndex,
      }));

    if (regions.length === 0) return null;

    try {
      const result = await renderFn(base, regions);
      if (!result) return null;

      // result.ranks is aligned to `regions`; remap back to `input`'s
      // original indices so the caller never needs to know regions
      // dropped some entries.
      const ranks = new Array(input.length).fill(null);
      regions.forEach((r, regionIdx) => {
        ranks[r.originalIndex] = result.ranks[regionIdx];
      });

      const { ranks: _drop, ...rest } = result;
      return { ...rest, ranks };
    } catch {
      return null;
    }
  }

  return {
    /**
     * ONE image for the whole dimension — every failure boxed and numbered.
     * annotations: [{ node, label, severity }]. Returns null if there's
     * nothing to annotate or the base image couldn't be fetched. Otherwise
     * returns { image, ranks } — `ranks` is aligned to the `annotations`
     * array THIS function was called with (not the internal `regions` array,
     * which drops entries with no usable node position) — `ranks[i]` is the
     * numbered-dot rank for `annotations[i]`, or null if that entry had no
     * position and was never drawn.
     */
    async buildOverview(annotations) {
      return runOverview(annotateOverview, annotations);
    },

    /**
     * Same contract as buildOverview, but returns { html, ranks } — an
     * interactive HTML fragment (numbered dots with hover tooltips showing
     * each finding's full text) instead of a flattened PNG. This is the one
     * to use for dense screens where buildOverview's static image gets
     * unreadable (see imageHighlighter.js header comment) — pass `options`
     * straight through to buildInteractiveOverlay (imageSrc, dotSize, etc).
     */
    async buildOverviewInteractive(annotations, options) {
      return runOverview(
        (base, regions) => buildInteractiveOverlay(base, regions, options),
        annotations
      );
    },

    /**
     * A small isolated image of just ONE element, fetched directly from
     * Figma's own per-node render (not cropped from the frame screenshot).
     * Used for per-checkpoint thumbnails in the failing-rows table.
     */
    async getElementThumbnail(node) {
      if (!node?.id || !frame?.fileKey) return null;
      try {
        const buf = await fetchFigmaFrameImage(frame.fileKey, node.id, RENDER_SCALE);
        return buf ? buf.toString("base64") : null;
      } catch {
        return null;
      }
    },
  };
}