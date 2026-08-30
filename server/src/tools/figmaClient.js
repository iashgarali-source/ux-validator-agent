/**
 * figmaClient
 * Thin wrapper around the Figma REST API. Fetches the file's node tree and
 * resolves local styles (colours, typography, spacing) so the design-system
 * validator can compare real values against knowledge/design-system/tokens.md.
 */

const FIGMA_API_BASE = "https://api.figma.com/v1";

function extractFileKey(figmaUrl) {
  if (/figma\.com\/make\//.test(figmaUrl)) {
    throw Object.assign(
      new Error(
        "This is a Figma Make link, not a Figma design file. Figma Make apps aren't accessible via the Figma Files REST API. Use a regular Figma design file URL (figma.com/design/... or figma.com/file/...) instead, or paste the live/deployed URL and it will fall back to a screenshot-based comparison."
      ),
      { status: 400 }
    );
  }

  const match = figmaUrl.match(/figma\.com\/(?:file|design)\/([a-zA-Z0-9]+)/);
  if (!match) {
    throw Object.assign(new Error(`Could not parse a Figma file key from: ${figmaUrl}`), { status: 400 });
  }
  return match[1];
}

function extractNodeId(figmaUrl) {
  try {
    const url = new URL(figmaUrl);
    const nodeId = url.searchParams.get("node-id");
    return nodeId ? nodeId.replace("-", ":") : null;
  } catch {
    return null;
  }
}

/**
 * Builds a Figma URL that deep-links straight to a specific node/layer, so a
 * finding can be clicked/copied instead of just naming a node id.
 */
export function buildFigmaNodeUrl(fileKey, nodeId) {
  if (!fileKey || !nodeId) return null;
  const dashId = nodeId.replace(/:/g, "-");
  return `https://www.figma.com/design/${fileKey}?node-id=${encodeURIComponent(dashId)}`;
}

async function figmaFetch(endpoint) {
  const token = process.env.FIGMA_ACCESS_TOKEN;
  if (!token) {
    throw Object.assign(
      new Error("FIGMA_ACCESS_TOKEN is not set on the server (.env)"),
      { status: 500 }
    );
  }
  const res = await fetch(`${FIGMA_API_BASE}${endpoint}`, {
    headers: { "X-Figma-Token": token },
  });
  if (!res.ok) {
    const text = await res.text();
    throw Object.assign(new Error(`Figma API error ${res.status}: ${text}`), {
      status: res.status,
    });
  }
  return res.json();
}

/**
 * Returns a compact summary of the frame: fills, text styles, spacing hints,
 * position, and component instances. Kept deliberately small — this gets fed
 * straight into the Claude prompt for comparison against the design tokens.
 *
 * rootId/rootBox are captured alongside the summary so a whole-frame image
 * can later be rendered and individual nodes highlighted within it — x/y are
 * absolute (page) coordinates, matching Figma's own coordinate space, so a
 * node's position relative to the frame is just (node.x - rootBox.x, node.y
 * - rootBox.y).
 */
export async function fetchFigmaFrame(figmaUrl) {
  const fileKey = extractFileKey(figmaUrl);
  const nodeId = extractNodeId(figmaUrl);

  const fileData = nodeId
    ? await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`)
    : await figmaFetch(`/files/${fileKey}?depth=2`);

  const rootNode = nodeId
    ? Object.values(fileData.nodes || {})[0]?.document
    : fileData.document;

  const box = rootNode?.absoluteBoundingBox;

  return {
    fileKey,
    nodeId,
    rootId: rootNode?.id || null,
    rootBox: box ? { x: box.x, y: box.y, width: box.width, height: box.height } : null,
    name: rootNode?.name || "Untitled frame",
    summary: summarizeNode(rootNode),
  };
}

/**
 * `path` is a breadcrumb of ancestor names (e.g. "Screen > Header > Actions >
 * Button") — lets a validator tell apart two nodes sharing a name/size, and
 * lets us detect when a matched node is just a layout wrapper around another
 * matched node (its path will be a strict prefix of the child's path).
 */
function summarizeNode(node, depth = 0, out = [], parentPath = "") {
  if (!node || depth > 4) return out;

  const path = parentPath ? `${parentPath} > ${node.name}` : node.name;
  const box = node.absoluteBoundingBox;

  out.push({
    id: node.id,
    name: node.name,
    type: node.type,
    path,
    x: box?.x,
    y: box?.y,
    fills: (node.fills || []).map((f) => f.color).filter(Boolean),
    fontSize: node.style?.fontSize,
    fontWeight: node.style?.fontWeight,
    cornerRadius: node.cornerRadius,
    paddingLeft: node.paddingLeft,
    paddingRight: node.paddingRight,
    itemSpacing: node.itemSpacing,
    width: box?.width,
    height: box?.height,
  });

  for (const child of node.children || []) {
    summarizeNode(child, depth + 1, out, path);
  }
  return out;
}

/**
 * Fetches a real rendered PNG of a node (e.g. the whole frame) from Figma's
 * Images API. The API itself only returns a temporary S3 URL, not the image
 * bytes — this does the second fetch to actually download it, and returns a
 * Buffer ready for compositing.
 */
export async function fetchFigmaFrameImage(fileKey, nodeId, scale = 2) {
  if (!fileKey || !nodeId) return null;

  const data = await figmaFetch(
    `/images/${fileKey}?ids=${encodeURIComponent(nodeId)}&format=png&scale=${scale}`
  );
  const url = data.images?.[nodeId];
  if (!url) return null;

  const res = await fetch(url);
  if (!res.ok) return null;

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

export async function fetchFigmaPrototypeFlow(figmaUrl) {
  const fileKey = extractFileKey(figmaUrl);
  const nodeId = extractNodeId(figmaUrl);

  const fileData = nodeId
    ? await figmaFetch(`/files/${fileKey}/nodes?ids=${encodeURIComponent(nodeId)}`)
    : await figmaFetch(`/files/${fileKey}`);

  const rootNode = nodeId
    ? Object.values(fileData.nodes || {})[0]?.document
    : fileData.document;

  const startNodeId =
    fileData.prototypeStartNodeID ||
    (nodeId ? Object.values(fileData.nodes || {})[0]?.prototypeStartNodeID : null) ||
    null;

  const idToName = {};
  collectNames(rootNode, idToName);

  const frames = [];
  collectFramesWithInteractions(rootNode, frames);

  for (const frame of frames) {
    for (const t of frame.triggers) {
      t.destinationName = t.destinationId ? idToName[t.destinationId] || "(unknown frame)" : null;
    }
  }

  return {
    fileKey,
    startFrameName: startNodeId ? idToName[startNodeId] || null : null,
    frames,
  };
}

function collectNames(node, out, depth = 0) {
  if (!node || depth > 10) return;
  out[node.id] = node.name;
  for (const child of node.children || []) {
    collectNames(child, out, depth + 1);
  }
}

function collectFramesWithInteractions(node, out, depth = 0) {
  if (!node || depth > 6) return;

  const isFrameLike = node.type === "FRAME" || node.type === "COMPONENT" || node.type === "INSTANCE";
  if (isFrameLike) {
    const triggers = extractInteractions(node);
    if (triggers.length > 0 || depth <= 1) {
      out.push({ id: node.id, name: node.name, type: node.type, triggers });
    }
  }

  for (const child of node.children || []) {
    collectFramesWithInteractions(child, out, depth + 1);
  }
}

function extractInteractions(node) {
  const triggers = [];

  for (const interaction of node.interactions || []) {
    for (const action of interaction.actions || []) {
      if (action.type === "NODE" || action.type === "NAVIGATE") {
        triggers.push({
          trigger: interaction.trigger?.type || "UNKNOWN",
          action: action.navigation || action.type,
          destinationId: action.destinationId || null,
        });
      }
    }
  }

  if (node.transitionNodeID) {
    triggers.push({
      trigger: "ON_CLICK",
      action: node.transitionDuration ? "SMART_ANIMATE" : "NAVIGATE",
      destinationId: node.transitionNodeID,
    });
  }

  return triggers;
}