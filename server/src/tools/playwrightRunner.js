/**
 * playwrightRunner
 * Opens the live URL in a headless browser and captures:
 *   - a screenshot (for visual/vision comparison)
 *   - the rendered DOM/CSSOM snapshot (for token/spacing checks)
 *   - the accessibility tree via axe-core (delegated to axeRunner)
 *   - optional interaction simulation for the workflow validator
 *   - real computed-style + position data per element, for deterministic
 *     design-system checks (captureLiveDesignElements)
 *
 * ---------------------------------------------------------------------------
 * WHY THIS FILE LOOKS THE WAY IT DOES
 *
 * Modern SPA dashboards (React + react-grid-layout + Recharts, o9/arvo-style
 * shells, etc.) defeat the naive "goto + networkidle + screenshot" recipe in
 * four distinct ways. Each is handled explicitly below:
 *
 *   1. SKELETON RACE. The real content is gated behind a timer or a query,
 *      e.g. `setTimeout(() => setLoading(false), 550)`. `networkidle` is
 *      useless as a proxy here: a self-contained bundle has no subresources,
 *      so "idle" fires ~500ms after the document and we screenshot the
 *      skeleton — aria-hidden divs with no text, which produce ZERO findings
 *      and a blank region in the report.  -> waitForContentReady()
 *
 *   2. NO LAYOUT PASS AFTER RESIZE. Recharts' ResponsiveContainer and
 *      react-grid-layout's WidthProvider re-measure via ResizeObserver /
 *      window resize. They need frames, not network. `waitForLoadState
 *      ("networkidle")` after setViewportSize returns instantly.  -> settle()
 *
 *   3. HEIGHT-FORCING BREAKS FLEX/PERCENT CHAINS. Setting `height: auto` on a
 *      scroll container removes the definite height that `height: 100%` and
 *      `flex: 1 1 auto` descendants resolve against. ResponsiveContainer then
 *      measures 0 and renders NOTHING — charts vanish from the screenshot we
 *      were trying to fix. Always pin an explicit pixel height instead, and
 *      unclip EVERY scroller, not just the tallest one (each dashboard widget
 *      body is typically its own `overflow: auto` box).  -> expandScrollers()
 *
 *   4. SELECTOR BLINDNESS. `button, a, input, h1-h6, p, span, label` cannot
 *      see: KPI cards (`div.kpi`), KPI values (`<b>`), widget titles (`<b>`),
 *      pivot cells (`td`/`th`), or chart axis ticks (SVG `<text>`). The audit
 *      silently reports nothing for the most important part of the screen.
 *      -> CANDIDATE_SELECTOR + isMeaningful() + cap applied AFTER filtering.
 * ---------------------------------------------------------------------------
 */

import { chromium } from "playwright";

const DEFAULTS = {
  viewport: { width: 1440, height: 900 },
  maxCaptureHeight: 15000,
  elementCap: 400,
  interactiveCap: 200,
  navTimeout: 30000,
  readyTimeout: 15000,
  /**
   * Class/attribute fragments that mean "still loading". If any element
   * matching these is present, the page is NOT ready. Extend per design system.
   */
  loadingSelectors: [
    "[class*='skel']",
    "[class*='skeleton']",
    "[class*='shimmer']",
    "[class*='placeholder-loading']",
    "[aria-busy='true']",
    "[data-loading='true']",
    "[role='progressbar']",
  ],
  /**
   * Noise filters. Both default ON — these categories generate high volumes of
   * unactionable findings that bury the real ones.
   *
   * skipIconOnly:        icon-only buttons (back/bell/avatar/send). Their
   *                      font-size sizes a glyph, not text, so typescale checks
   *                      are meaningless. Set false when you're ready to audit
   *                      icon sizing properly (hit-area, box size, not type).
   * skipChartInternals:  Recharts/ECharts/D3 <svg> internals. The chart library
   *                      owns those colours and inline font sizes, not the
   *                      design system.
   */
  skipIconOnly: true,
  skipChartInternals: true,
  /**
   * Optional: selectors that must EXIST before we consider the page ready.
   * Leave empty for generic runs; pass per-screen for high-value pages, e.g.
   * [".mfp-kpis .kpi:not(.skel)", "[data-swid]", ".recharts-surface"].
   */
  requiredSelectors: [],
};

/* -------------------------------------------------------------------------- */
/* Readiness + settling helpers                                               */
/* -------------------------------------------------------------------------- */

/**
 * Waits for two RAFs and for every running CSS animation/transition and Web
 * Animation to finish. This is what actually covers:
 *   - entry animations (`.mfp-landing { animation: mfpFadeIn .35s }`)
 *   - grid item transitions (`.react-grid-item { transition: all .2s }`)
 *   - post-resize relayout of ResponsiveContainer / WidthProvider
 * `reducedMotion: "reduce"` kills most of these at the source; this is the
 * belt-and-braces for design systems that don't honour the media query.
 */
async function settle(page, { frames = 2 } = {}) {
  await page
    .evaluate(async (n) => {
      for (let i = 0; i < n; i++) {
        await new Promise((r) => requestAnimationFrame(() => r()));
      }
      if (typeof document.getAnimations === "function") {
        const running = document
          .getAnimations()
          .filter((a) => a.playState === "running");
        await Promise.race([
          Promise.all(running.map((a) => a.finished.catch(() => {}))),
          new Promise((r) => setTimeout(r, 2000)),
        ]);
      }
      await new Promise((r) => requestAnimationFrame(() => r()));
    }, frames)
    .catch(() => {});
}

/**
 * Waits until the DOM stops mutating for `quietMs`. Catches deferred renders
 * that no explicit signal announces (data arriving, virtualised rows filling
 * in, chart surfaces mounting).
 */
async function waitForDomQuiet(page, { quietMs = 400, timeout = 8000 } = {}) {
  await page
    .evaluate(
      ({ quietMs, timeout }) =>
        new Promise((resolve) => {
          let timer = null;
          const done = () => {
            observer.disconnect();
            clearTimeout(timer);
            clearTimeout(hardStop);
            resolve();
          };
          const bump = () => {
            clearTimeout(timer);
            timer = setTimeout(done, quietMs);
          };
          const observer = new MutationObserver(bump);
          observer.observe(document.documentElement, {
            childList: true,
            subtree: true,
            attributes: true,
            characterData: true,
          });
          const hardStop = setTimeout(done, timeout);
          bump();
        }),
      { quietMs, timeout }
    )
    .catch(() => {});
}

/**
 * The single most important fix: do not screenshot the skeleton.
 * Resolves as soon as (a) no loading placeholders remain AND (b) every
 * requiredSelector is present. Non-fatal on timeout — we still capture, but
 * we flag it on the result so the report can say "captured in loading state"
 * instead of silently emitting an empty design audit.
 */
async function waitForContentReady(page, opts) {
  const { loadingSelectors, requiredSelectors, readyTimeout } = opts;
  let ready = true;

  try {
    await page.waitForFunction(
      ({ loading, required }) => {
        const stillLoading = loading.some((sel) => {
          const nodes = document.querySelectorAll(sel);
          for (const el of nodes) {
            const r = el.getBoundingClientRect();
            if (r.width > 0 && r.height > 0) return true;
          }
          return false;
        });
        if (stillLoading) return false;
        return required.every((sel) => document.querySelector(sel));
      },
      { loading: loadingSelectors, required: requiredSelectors },
      { timeout: readyTimeout, polling: 100 }
    );
  } catch {
    ready = false;
    console.warn(
      "[WARN] content-ready wait timed out — page may still be in a loading/skeleton state"
    );
  }

  await waitForDomQuiet(page);
  await settle(page);
  return ready;
}

/* -------------------------------------------------------------------------- */
/* Scroll container expansion                                                 */
/* -------------------------------------------------------------------------- */

/**
 * The outer <body> can stay a fixed viewport height (an app shell with a
 * pinned sidebar/topbar) while the REAL content lives inside child elements
 * with their own overflow-y: auto/scroll — and there is usually MORE THAN ONE
 * (a main scroller, plus one per dashboard widget body).
 *
 * Critically, we pin an explicit pixel height rather than `height: auto`:
 * descendants using `height: 100%` / `flex: 1 1 auto` (Recharts'
 * ResponsiveContainer, react-grid-layout items) resolve against a definite
 * height. `auto` makes it indefinite and those subtrees collapse to zero.
 *
 * Returns the measured full-content height so the caller can size the viewport.
 */
/**
 * ONE expansion pass: find every scroller that is currently clipping, pin it
 * to a definite height, escape flex/grid sizing, and unclip hidden ancestors.
 * Returns how many elements it had to touch.
 */
async function expandPass(page) {
  return page.evaluate(() => {
    let touched = 0;

    // Descendants come before ancestors in reversed document order, so a
    // child grows before we measure the parent that contains it.
    const all = Array.from(document.querySelectorAll("*")).reverse();

    // Take an element out of its parent's flex/grid height negotiation. A
    // height set on a flex ITEM is only a hint — the flex algorithm resolves
    // the used height from the parent's line and overrides it.
    function escapeParentSizing(el, needed) {
      const parent = el.parentElement;
      const ps = parent ? getComputedStyle(parent) : null;
      if (!ps) return;
      if (
        ps.display === "flex" ||
        ps.display === "inline-flex" ||
        ps.display === "grid" ||
        ps.display === "inline-grid"
      ) {
        el.style.flex = "none";
        el.style.alignSelf = "start";
        el.style.minHeight = `${needed}px`;
      }
    }

    for (const el of all) {
      const style = getComputedStyle(el);
      const scrollableY =
        style.overflowY === "auto" ||
        style.overflowY === "scroll" ||
        style.overflow === "auto" ||
        style.overflow === "scroll" ||
        el.hasAttribute("data-uxva-scroll-target"); // re-check ones we already grew
      if (!scrollableY) continue;
      if (el.scrollHeight <= el.clientHeight + 1) continue;

      const needed = el.scrollHeight;

      if (!el.hasAttribute("data-uxva-scroll-target")) {
        el.setAttribute("data-uxva-scroll-target", "true");
        el.dataset.uxvaPrevHeight = el.style.height || "";
        el.dataset.uxvaPrevMaxHeight = el.style.maxHeight || "";
        el.dataset.uxvaPrevOverflow = el.style.overflow || "";
      }

      // Definite pixel height — NOT "auto".
      el.style.height = `${needed}px`;
      el.style.minHeight = `${needed}px`;
      el.style.maxHeight = "none";
      el.style.overflow = "visible";
      escapeParentSizing(el, needed);
      touched++;
    }

    // A widget shell like `.swidget { height: 100%; overflow: hidden }` will
    // re-clip the body we just grew, so walk up and unpin those too.
    for (const el of document.querySelectorAll("[data-uxva-scroll-target]")) {
      let node = el.parentElement;
      let hops = 0;
      while (node && hops < 8) {
        const s = getComputedStyle(node);
        if (s.overflow === "hidden" || s.overflowY === "hidden") {
          if (s.overflow !== "visible") node.style.overflow = "visible";
          if (node.scrollHeight > node.clientHeight + 1) {
            const needed = node.scrollHeight;
            node.style.height = `${needed}px`;
            node.style.minHeight = `${needed}px`;
            node.style.maxHeight = "none";
            escapeParentSizing(node, needed);
            touched++;
          }
        }
        node = node.parentElement;
        hops++;
      }
    }

    // Force ResizeObserver-driven components (Recharts ResponsiveContainer,
    // react-grid-layout WidthProvider) to re-measure against the new box.
    window.dispatchEvent(new Event("resize"));

    return touched;
  });
}

/** Reads the ACTUAL resolved geometry of every scroller we touched. */
async function measureScrollers(page) {
  return page.evaluate(() => {
    const measured = Array.from(
      document.querySelectorAll("[data-uxva-scroll-target]")
    ).map((el) => {
      const cn =
        typeof el.className === "string"
          ? el.className
          : (el.className && el.className.baseVal) || "";
      return {
        selector:
          el.tagName.toLowerCase() +
          (el.id ? `#${el.id}` : "") +
          (cn.trim() ? "." + cn.trim().split(/\s+/).slice(0, 2).join(".") : ""),
        scrollHeight: el.scrollHeight,
        clientHeight: el.clientHeight,
        stillClipping: el.scrollHeight > el.clientHeight + 1,
      };
    });

    return {
      count: measured.length,
      expanded: measured.slice(0, 10),
      stillClipping: measured.filter((m) => m.stillClipping),
      documentHeight: Math.max(
        document.body.scrollHeight,
        document.documentElement.scrollHeight
      ),
    };
  });
}

/**
 * The outer <body> can stay a fixed viewport height (an app shell with a
 * pinned sidebar/topbar) while the REAL content lives inside child elements
 * with their own overflow-y: auto/scroll — and there is usually MORE THAN ONE
 * (a main scroller, plus one per dashboard widget body).
 *
 * Critically, we pin an explicit pixel height rather than `height: auto`:
 * descendants using `height: 100%` / `flex: 1 1 auto` (Recharts'
 * ResponsiveContainer, react-grid-layout items) resolve against a definite
 * height. `auto` makes it indefinite and those subtrees collapse to zero.
 *
 * ITERATES TO A FIXED POINT. Growing a nested scroller increases the content
 * height of every scroller above it, so an outer container pinned during pass 1
 * is measured against a stale inner height and starts clipping again the moment
 * the child expands. One pass cannot converge on nested scrollers; we repeat
 * until a pass touches nothing, settling layout between passes so the
 * measurements we read are resolved rather than requested.
 */
async function expandScrollers(page, { maxPasses = 5 } = {}) {
  let passes = 0;

  for (let i = 0; i < maxPasses; i++) {
    const touched = await expandPass(page);
    passes++;
    if (touched === 0) break;
    // Let the layout engine resolve before the next pass measures.
    await settle(page, { frames: 1 });
  }

  const info = await measureScrollers(page);
  return { ...info, passes };
}

/* -------------------------------------------------------------------------- */
/* Page lifecycle                                                             */
/* -------------------------------------------------------------------------- */

async function withPage(url, fn, options = {}) {
  const opts = { ...DEFAULTS, ...options };
  const browser = await chromium.launch({ headless: true });

  try {
    const context = await browser.newContext({
      viewport: opts.viewport,
      reducedMotion: "reduce", // kills entry animations at the source
      deviceScaleFactor: 1,
    });
    const page = await context.newPage();

    page.on("console", (msg) => console.log(`[PAGE CONSOLE ${msg.type()}]`, msg.text()));
    page.on("pageerror", (err) => console.error("[PAGE ERROR]", err.message));
    page.on("requestfailed", (req) =>
      console.warn("[REQUEST FAILED]", req.url(), req.failure()?.errorText)
    );

    // "load" rather than "domcontentloaded": module scripts and stylesheets
    // must have executed before we start asking whether content is ready.
    await page.goto(url, { waitUntil: "load", timeout: opts.navTimeout });
    await page
      .waitForLoadState("networkidle", { timeout: 5000 })
      .catch(() => {});

    // 1) Don't capture the skeleton.
    const contentReady = await waitForContentReady(page, opts);

    // 2) Unclip every scroller with definite heights.
    const scrollInfo = await expandScrollers(page);
    console.log(
      "[DEBUG] expanded scroll containers:",
      scrollInfo.count,
      `(converged in ${scrollInfo.passes} pass${scrollInfo.passes === 1 ? "" : "es"})`,
      scrollInfo.expanded
    );

    // Every row above should read scrollHeight === clientHeight. Anything left
    // here is content that will be missing from the screenshot and from the
    // element capture — a silent hole in the audit, so say it out loud.
    if (scrollInfo.stillClipping.length > 0) {
      console.warn(
        "[WARN] scroller(s) STILL CLIPPING after expansion — content will be missing from capture:",
        scrollInfo.stillClipping
      );
    }

    // 3) Grow the viewport to the real content height.
    const targetHeight = await page.evaluate(() =>
      Math.max(document.body.scrollHeight, document.documentElement.scrollHeight)
    );
    console.log("[DEBUG] final target height:", targetHeight);

    if (targetHeight > opts.viewport.height) {
      await page.setViewportSize({
        width: opts.viewport.width,
        height: Math.min(targetHeight, opts.maxCaptureHeight),
      });
      // A resize invalidates every ResizeObserver-driven measurement. Give the
      // page frames, not network time.
      await page.evaluate(() => window.dispatchEvent(new Event("resize")));
      await waitForDomQuiet(page, { quietMs: 300, timeout: 4000 });
      await settle(page);
    }

    return await fn(page, { contentReady, scrollInfo, targetHeight });
  } finally {
    await browser.close();
  }
}

/* -------------------------------------------------------------------------- */
/* Shared in-page helpers (injected as source strings)                        */
/* -------------------------------------------------------------------------- */

/**
 * Broad enough to see the things a design-system audit actually cares about:
 * KPI cards (div), KPI values and widget titles (b/i/em/strong), pivot cells
 * (td/th), list rows (li), section shells, and chart text (SVG <text>).
 */
const CANDIDATE_SELECTOR = [
  "button", "a", "input", "select", "textarea", "[role='button']",
  "h1", "h2", "h3", "h4", "h5", "h6",
  "p", "span", "label", "li", "dt", "dd",
  "b", "strong", "i", "em",
  "td", "th", "caption",
  "div", "section", "article", "header", "footer", "aside",
  "svg", "text",
].join(", ");

const IN_PAGE_HELPERS = `
  function parseRgb(str) {
    const m = str && str.match(/rgba?\\(([^)]+)\\)/);
    if (!m) return null;
    const parts = m[1].split(",").map((s) => parseFloat(s.trim()));
    return { r: parts[0], g: parts[1], b: parts[2], a: parts[3] ?? 1 };
  }

  function isSvg(el) {
    return el.namespaceURI === "http://www.w3.org/2000/svg";
  }

  function ownText(el) {
    let t = "";
    for (const node of el.childNodes) {
      if (node.nodeType === 3) t += node.nodeValue;
    }
    return t.trim();
  }

  function isVisible(el, style, rect) {
    if (rect.width === 0 || rect.height === 0) return false;
    if (style.visibility === "hidden" || style.display === "none") return false;
    if (parseFloat(style.opacity) === 0) return false;
    if (el.closest("[aria-hidden='true']")) return false;
    return true;
  }

  /**
   * Chart-library internals: Recharts/D3/ECharts render their own <svg> with
   * their own colours and inline font sizes that no design system controls.
   * Auditing them produces dozens of unactionable findings per chart.
   */
  function isChartInternal(el) {
    if (isSvg(el)) return true;
    return Boolean(
      el.closest &&
        el.closest(
          "svg, .recharts-wrapper, .recharts-surface, [class*='recharts'], [class*='echarts'], canvas"
        )
    );
  }

  /**
   * An icon-only control: no real text, just a glyph. Its font-size sizes the
   * ICON, not type, so typescale checks on it are meaningless — which is what
   * was flagging back/bell/avatar buttons at 15/19/13px.
   */
  function isIconOnly(el) {
    const t = ownText(el);
    // Icon fonts render a single private-use-area codepoint (Material, FA).
    if (t.length === 1) {
      const cp = t.codePointAt(0);
      if (cp >= 0xe000 && cp <= 0xf8ff) return true;
    }
    if (t.length > 0) return false;
    if (!el.querySelector) return false;
    // Empty of text but contains a glyph/graphic.
    const hasGlyph = el.querySelector(
      "svg, img, [class*='icon'], [class*='Icon'], i[class], use"
    );
    if (!hasGlyph) return false;
    // ...and is roughly square and small — a real button with an icon plus a
    // label would be wider than it is tall and would have own text somewhere.
    const r = el.getBoundingClientRect();
    const ratio = r.width / Math.max(r.height, 1);
    return r.width <= 64 && r.height <= 64 && ratio > 0.6 && ratio < 1.7;
  }

  /** Text this element actually paints itself (not via descendants). */
  function rendersText(el) {
    return ownText(el).length > 0;
  }


  function isMeaningful(el, style) {
    const tag = el.tagName.toLowerCase();
    if (["button", "a", "input", "select", "textarea", "th", "td", "text"].includes(tag)) return true;
    if (el.getAttribute("role") === "button") return true;
    if (ownText(el).length > 0) return true;              // renders its own text
    const hasBg = style.backgroundColor && style.backgroundColor !== "rgba(0, 0, 0, 0)" &&
                  style.backgroundColor !== "transparent";
    const hasBorder = parseFloat(style.borderTopWidth) > 0 ||
                      parseFloat(style.borderLeftWidth) > 0;
    const hasRadius = parseFloat(style.borderTopLeftRadius) > 0;
    const hasShadow = style.boxShadow && style.boxShadow !== "none";
    // A surface: card, chip, panel. Exactly what KPI cards are.
    return hasBg || hasBorder || hasRadius || hasShadow;
  }

  function buildSelector(el) {
    const parts = [];
    let node = el;
    while (node && node.nodeType === 1 && parts.length < 5) {
      let piece = node.tagName.toLowerCase();
      if (node.id) {
        piece += "#" + node.id;
      } else {
        const cn = typeof node.className === "string"
          ? node.className
          : (node.className && node.className.baseVal) || "";
        if (cn && cn.trim()) piece += "." + cn.trim().split(/\\s+/).slice(0, 2).join(".");
      }
      parts.unshift(piece);
      node = node.parentElement;
    }
    return parts.join(" > ");
  }
`;

/* -------------------------------------------------------------------------- */
/* Public capture API                                                         */
/* -------------------------------------------------------------------------- */

export async function captureLiveScreen(url, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  return withPage(
    url,
    async (page, meta) => {
      const screenshot = await page.screenshot({ fullPage: true, type: "png" });

      const elements = await page.evaluate(
        ({ helpers, cap }) => {
          eval(helpers);
          const nodes = Array.from(
            document.querySelectorAll(
              "button, a, input, select, textarea, [role='button']"
            )
          );

          return nodes
            .map((el) => {
              const style = getComputedStyle(el);
              const rect = el.getBoundingClientRect();
              if (!isVisible(el, style, rect)) return null;
              return {
                tag: el.tagName.toLowerCase(),
                text: (el.textContent || el.getAttribute("placeholder") || "")
                  .trim()
                  .slice(0, 60),
                hasLabel: Boolean(
                  el.getAttribute("aria-label") ||
                    el.getAttribute("aria-labelledby") ||
                    (el.id && document.querySelector('label[for="' + el.id + '"]'))
                ),
                fontSize: style.fontSize,
                fontWeight: style.fontWeight,
                color: style.color,
                backgroundColor: style.backgroundColor,
                padding: style.padding,
                borderRadius: style.borderRadius,
                width: Math.round(rect.width),
                height: Math.round(rect.height),
              };
            })
            .filter(Boolean)
            // Cap AFTER filtering, so invisible nodes never eat the budget.
            .slice(0, cap);
        },
        { helpers: IN_PAGE_HELPERS, cap: opts.interactiveCap }
      );

      return {
        url,
        screenshotBase64: screenshot.toString("base64"),
        elements,
        title: await page.title(),
        contentReady: meta.contentReady,
        capturedHeight: meta.targetHeight,
      };
    },
    opts
  );
}

/**
 * Real computed CSS + position per element, in the SAME shape/philosophy as
 * fetchFigmaFrame's node summary — meant to be checked by exact lookup
 * (tokenMatcher.js), not handed to an LLM to guess at.
 *
 * Colors come back as {r,g,b,a} with 0-255 channels (parsed from the computed
 * "rgb(...)"/"rgba(...)" string) — use hexFromRgb255, NOT hexFromFigmaColor.
 *
 * NOTE for chart elements: SVG <text> nodes carry `fill`, not `color`, and
 * their font-size usually arrives as a presentation attribute set inline by
 * the chart library (e.g. Recharts `tick={{ fontSize: 10.5 }}`) rather than
 * from a stylesheet. Both are resolved into computed style, so they compare
 * correctly against the type scale — but expect genuine off-scale values here,
 * because chart libraries rarely respect a design system's type ramp. Each
 * element is tagged with `isSvg` and `styleOrigin` so the reporter can group
 * or downgrade those findings instead of drowning the report in them.
 */
export async function captureLiveDesignElements(url, options = {}) {
  const opts = { ...DEFAULTS, ...options };

  return withPage(
    url,
    async (page, meta) => {
      const screenshot = await page.screenshot({ fullPage: true, type: "png" });

      const elements = await page.evaluate(
        ({ helpers, selector, cap, skipIcons, skipChartInternals }) => {
          eval(helpers);

          const nodes = Array.from(document.querySelectorAll(selector));
          const out = [];
          const skipped = { icons: 0, chartInternals: 0 };

          for (const el of nodes) {
            if (out.length >= cap) break;

            const style = getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            if (!isVisible(el, style, rect)) continue;
            if (!isMeaningful(el, style)) continue;

            // --- noise filters -------------------------------------------
            if (skipChartInternals && isChartInternal(el)) {
              skipped.chartInternals++;
              continue;
            }
            if (skipIcons && isIconOnly(el)) {
              skipped.icons++;
              continue;
            }
            // -------------------------------------------------------------

            const svg = isSvg(el);
            const paintsText = rendersText(el);
            const inlineFontSize =
              el.getAttribute && (el.getAttribute("font-size") || (el.style && el.style.fontSize));

            out.push({
              tag: el.tagName.toLowerCase(),
              isSvg: svg,
              text: (el.textContent || el.getAttribute("placeholder") || "")
                .trim()
                .slice(0, 60),
              ownText: ownText(el).slice(0, 60),
              rendersText: paintsText,
              selector: buildSelector(el),
              // SVG text paints with fill; HTML text paints with color.
              color: parseRgb(svg ? style.fill : style.color),
              // NOT style.fill for SVG — an <svg> node has no background, and
              // reporting its fill as one produced findings like "axis tick
              // uses background #767676", which is its text colour.
              backgroundColor: svg ? null : parseRgb(style.backgroundColor),
              // Typography only means something on elements that actually
              // paint text. A wrapper's font-size is inherited, and an icon
              // button's font-size sizes a glyph — checking either against the
              // typescale is a false positive.
              fontSize: paintsText ? parseFloat(style.fontSize) || null : null,
              fontWeight: paintsText ? style.fontWeight : null,
              fontFamily: paintsText ? style.fontFamily : null,
              styleOrigin: inlineFontSize ? "inline" : "stylesheet",
              paddingLeft: parseFloat(style.paddingLeft) || 0,
              paddingRight: parseFloat(style.paddingRight) || 0,
              paddingTop: parseFloat(style.paddingTop) || 0,
              paddingBottom: parseFloat(style.paddingBottom) || 0,
              borderRadius: parseFloat(style.borderTopLeftRadius) || 0,
              borderWidth: parseFloat(style.borderTopWidth) || 0,
              // Absolute page coordinates. Because every scroller was unclipped
              // and pinned to a definite height before capture, layout position
              // now matches the fullPage screenshot 1:1 — no per-scroller
              // scrollTop correction needed, and no annotations landing in the
              // wrong place.
              x: rect.x + window.scrollX,
              y: rect.y + window.scrollY,
              width: rect.width,
              height: rect.height,
            });
          }

          return { out, skipped };
        },
        {
          helpers: IN_PAGE_HELPERS,
          selector: CANDIDATE_SELECTOR,
          cap: opts.elementCap,
          skipIcons: opts.skipIconOnly,
          skipChartInternals: opts.skipChartInternals,
        }
      );

      const { out: captured, skipped } = elements;

      const counts = captured.reduce((acc, e) => {
        acc[e.tag] = (acc[e.tag] || 0) + 1;
        return acc;
      }, {});
      console.log("[DEBUG] captured elements:", captured.length, counts);
      console.log(
        `[DEBUG] filtered out: ${skipped.icons} icon-only, ${skipped.chartInternals} chart-internal`
      );

      return {
        url,
        screenshotBase64: screenshot.toString("base64"),
        elements: captured,
        skipped,
        title: await page.title(),
        contentReady: meta.contentReady,
        capturedHeight: meta.targetHeight,
        scrollContainersExpanded: meta.scrollInfo.count,
      };
    },
    opts
  );
}

/**
 * Walks a sequence of Playwright-style step definitions against the live page,
 * recording whether each expected step's target element was actually found and
 * clickable/visible. Used by the workflow validator against user-flows.md.
 *
 * steps: [{ description, selectorHints: ["text=Submit", "role=button[name=Next]"] }]
 */
export async function simulateFlow(url, steps = [], options = {}) {
  const opts = { ...DEFAULTS, ...options };

  return withPage(
    url,
    async (page) => {
      const results = [];

      for (const step of steps) {
        let found = false;
        let matchedSelector = null;

        for (const hint of step.selectorHints || []) {
          try {
            const locator = page.locator(hint).first();
            const count = await locator.count();
            if (count > 0 && (await locator.isVisible())) {
              found = true;
              matchedSelector = hint;
              break;
            }
          } catch {
            // hint wasn't a valid selector on this page — try the next one
          }
        }

        results.push({ description: step.description, found, matchedSelector });

        if (found && step.click !== false) {
          try {
            await page.locator(matchedSelector).first().click({ timeout: 3000 });
            // After a click the next view has the same skeleton problem as the
            // first paint, so re-run readiness rather than waiting on network.
            await waitForContentReady(page, opts);
          } catch {
            // non-fatal — step is still recorded as "found"
          }
        }
      }

      return results;
    },
    opts
  );
}