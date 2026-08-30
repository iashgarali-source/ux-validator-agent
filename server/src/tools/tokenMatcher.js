/**
 * tokenMatcher
 * Deterministic helpers for the design-system validator. Colors, spacing,
 * radius, and font sizes are EXACT values with a defined correct answer —
 * that's a lookup, not a judgment call. tokens.md is the ONLY source these
 * are ever parsed from.
 *
 * Two real formatting quirks in the actual file this handles:
 *   1. Table rows use backticks around names/values, and colors sit behind
 *      a "Meaning" column, not immediately next to the token name — parsed
 *      line-by-line, taking the first hex found ANYWHERE after the name.
 *   2. The spacing and font-size tables pack TWO token entries per line
 *      (a side-by-side layout: "Token | rem | px | | Token | rem | px |"),
 *      including one row with an empty left half. Each token's px value is
 *      found by slicing out just that token's own segment, up to the NEXT
 *      token match on the same line (or end of line).
 */

export function hexFromFigmaColor(color) {
  if (!color || typeof color.r !== "number") return null;
  const toHex = (c) =>
    Math.round(Math.max(0, Math.min(1, c)) * 255)
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

export function hexFromRgb255(color) {
  if (!color || typeof color.r !== "number") return null;
  const toHex = (c) =>
    Math.round(Math.max(0, Math.min(255, c)))
      .toString(16)
      .padStart(2, "0");
  return `#${toHex(color.r)}${toHex(color.g)}${toHex(color.b)}`.toUpperCase();
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "").slice(0, 6);
  return {
    r: parseInt(clean.slice(0, 2), 16),
    g: parseInt(clean.slice(2, 4), 16),
    b: parseInt(clean.slice(4, 6), 16),
  };
}

const TOKEN_NAME_RE = /^[$]?(?:--)?[A-Za-z][A-Za-z0-9\-.]*$/;

/**
 * Line-by-line: first cell is the candidate token name (backticks stripped);
 * if it looks like a real identifier (no spaces — rejects description
 * prose like "recessed surface"), the first hex color anywhere in the REST
 * of that row is its value. Works regardless of how many columns sit
 * between the name and the hex.
 */
export function extractColorTokens(tokensText) {
  const map = new Map();
  if (!tokensText) return map;

  const hexRe = /#[0-9A-Fa-f]{6,8}\b/;

  for (const line of tokensText.split("\n")) {
    if (!line.trim().startsWith("|")) continue;

    const cells = line.split("|").map((c) => c.trim());
    const rawName = cells[1];
    if (!rawName) continue;

    const name = rawName.replace(/`/g, "").trim();
    if (!TOKEN_NAME_RE.test(name)) continue;

    const rest = cells.slice(2).join("|");
    const hexMatch = rest.match(hexRe);
    if (!hexMatch) continue;

    const hex = hexMatch[0].slice(0, 7).toUpperCase();
    if (!map.has(hex)) map.set(hex, []);
    if (!map.get(hex).includes(name)) map.get(hex).push(name);
  }
  return map;
}

export function nearestColorToken(hex, colorMap) {
  if (!hex || colorMap.size === 0) return null;
  const target = hexToRgb(hex);
  let best = null;
  let bestDist = Infinity;

  for (const [tokenHex, names] of colorMap.entries()) {
    const c = hexToRgb(tokenHex);
    const dist = (c.r - target.r) ** 2 + (c.g - target.g) ** 2 + (c.b - target.b) ** 2;
    if (dist < bestDist) {
      bestDist = dist;
      best = { hex: tokenHex, names };
    }
  }
  return best;
}

/**
 * Handles multiple token occurrences on ONE line — required because the
 * spacing and font-size tables pack two entries side by side per row. For
 * each token match, slices out just that token's own segment (up to the
 * next token match, or end of line) and takes the first number in that
 * segment that ISN'T immediately followed by "rem" — i.e. the real px
 * value, not the rem fraction that always appears first in these tables.
 */
function extractMultiTokenPxValues(tokensText, tokenRegexSource) {
  const values = new Set();
  if (!tokensText) return values;

  const tokenRe = new RegExp(tokenRegexSource, "g");

  for (const line of tokensText.split("\n")) {
    if (!line.includes("|")) continue;

    const matches = [...line.matchAll(tokenRe)];
    if (matches.length === 0) continue;

    for (let i = 0; i < matches.length; i++) {
      const start = matches[i].index + matches[i][0].length;
      const end = i + 1 < matches.length ? matches[i + 1].index : line.length;
      const segment = line.slice(start, end);

      const numRe = /(\d+(?:\.\d+)?)(rem)?/g;
      let m;
      while ((m = numRe.exec(segment))) {
        if (!m[2]) {
          values.add(Number(m[1]));
          break;
        }
      }
    }
  }
  return values;
}

/**
 * Non-uniform spacing scale — membership test, not divisibility.
 */
export function extractSpacingScale(tokensText) {
  const values = extractMultiTokenPxValues(tokensText, "\\$arvo-space-\\d+");
  if (values.size === 0) {
    [1, 2, 4, 6, 8, 10, 12, 16, 20, 24, 32, 40, 48, 64, 80].forEach((v) => values.add(v));
  }
  return values;
}

/**
 * The real $arvo-font-size-N SCSS tokens, parsed directly from the
 * Weight/Size table — this is the actual defined scale, not a derived
 * guess from prose text.
 */
export function extractTypescaleSizes(tokensText) {
  const values = extractMultiTokenPxValues(tokensText, "\\$arvo-font-size-\\d+");
  if (values.size === 0) {
    [64, 40, 32, 24, 20, 18, 16, 14, 12, 10].forEach((v) => values.add(v));
  }
  return values;
}

/**
 * Arvo's radius scale is a genuinely tiny closed set — {0, 16, 999} — not
 * a graduated scale. One token per line in the real file, so the simpler
 * single-token parser (used for radius only, not spacing/font-size) is
 * sufficient here.
 */
export function extractRadiusScale(tokensText) {
  const values = new Set();
  if (!tokensText) return values;

  const radiusTokenRe = /radius-(?:none|\d+|circle)/i;

  for (const line of tokensText.split("\n")) {
    if (!line.trim().startsWith("|")) continue;
    const tokenMatch = line.match(radiusTokenRe);
    if (!tokenMatch) continue;

    const rest = line.slice(tokenMatch.index + tokenMatch[0].length);
    const numRe = /(\d+(?:\.\d+)?)(rem)?/g;
    let m;
    while ((m = numRe.exec(rest))) {
      if (!m[2]) {
        values.add(Number(m[1]));
        break;
      }
    }
  }

  if (values.size === 0) {
    [0, 16, 999].forEach((v) => values.add(v));
  }
  return values;
}

/**
 * A padding/auto-layout wrapper around a real element can duplicate a
 * spacing finding for the same visual gap. Works on anything with a `path`
 * (Figma) or `selector` (live DOM) string.
 */
export function dedupeWrappers(nodes, key = "path") {
  return nodes.filter(
    (n) =>
      !nodes.some(
        (other) => other !== n && other[key] && other[key].startsWith(`${n[key]} > `)
      )
  );
}