import { readFile, readdir } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const KNOWLEDGE_ROOT = path.resolve(__dirname, "../knowledge");

/**
 * Memory
 * Context-isolation boundary: each validator declares which knowledge files
 * it needs and Memory loads only those — the accessibility validator never
 * sees design-system.md, and vice versa. This is what keeps token usage down.
 */

const KNOWLEDGE_MAP = {
  "design-system": [
    "design-system/tokens.md",
    "design-system/components.md",
    "design-system/patterns.md",
  ],
  accessibility: ["accessibility.md"],
  workflow: ["user-flows/module-template.md"],
};

export async function loadKnowledge(validatorId) {
  const files = KNOWLEDGE_MAP[validatorId] || [];
  const contents = await Promise.all(
    files.map(async (relPath) => {
      const fullPath = path.join(KNOWLEDGE_ROOT, relPath);
      try {
        const text = await readFile(fullPath, "utf-8");
        return { file: relPath, text };
      } catch (err) {
        return { file: relPath, text: "", error: `Could not read ${relPath}: ${err.message}` };
      }
    })
  );
  return contents;
}

/**
 * Loads a PRD by requirement id if present, otherwise returns null.
 * PRDs are dynamic — one file per requirement, not reused across features.
 */
export async function loadPrd(requirementId) {
  if (!requirementId) return null;
  const prdPath = path.join(KNOWLEDGE_ROOT, "prd", `${requirementId}.md`);
  try {
    return await readFile(prdPath, "utf-8");
  } catch {
    return null;
  }
}

export async function listUserFlowModules() {
  const dir = path.join(KNOWLEDGE_ROOT, "user-flows");
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

// --- Run history (in-memory for v1; swap for a real DB later) ---
const runHistory = [];

export function saveRun(report) {
  runHistory.unshift(report);
  if (runHistory.length > 200) runHistory.pop();
  return report;
}

export function listRuns() {
  return runHistory;
}

export function getRun(id) {
  return runHistory.find((r) => r.id === id) || null;
}
