/**
 * Workspace + Cursor cache cleanup — reduces file-watcher / indexing load.
 *
 * Usage: bun run cleanup:workspace
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { runE2eArtifactCleanup } from "../e2e/utils/cleanup-artifacts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const WORKSPACE_DIRS = [
  "dist",
  "dist-ssr",
  ".output",
  ".vinxi",
  ".tanstack",
  ".nitro",
  ".wrangler",
  "node_modules/.vite",
  "supabase/.temp",
] as const;

const CURSOR_PROJECT = path.join(
  process.env.USERPROFILE ?? process.env.HOME ?? "",
  ".cursor",
  "projects",
  "c-Users-PC-earn-flow",
);

const CURSOR_DIRS = ["agent-tools", "assets"] as const;

function rmDir(rel: string, base = ROOT): boolean {
  const full = path.join(base, rel);
  if (!fs.existsSync(full)) return false;
  try {
    fs.rmSync(full, { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

function trimTerminals(maxKeep = 8): number {
  const dir = path.join(CURSOR_PROJECT, "terminals");
  if (!fs.existsSync(dir)) return 0;
  const files = fs
    .readdirSync(dir)
    .map((name) => ({ name, mtime: fs.statSync(path.join(dir, name)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);
  let removed = 0;
  for (const f of files.slice(maxKeep)) {
    try {
      fs.rmSync(path.join(dir, f.name), { force: true });
      removed++;
    } catch {
      /* ignore */
    }
  }
  return removed;
}

function main() {
  console.log("→ cleanup:workspace");

  runE2eArtifactCleanup(ROOT);

  const removedWorkspace: string[] = [];
  for (const dir of WORKSPACE_DIRS) {
    if (rmDir(dir)) removedWorkspace.push(dir);
  }
  if (removedWorkspace.length > 0) {
    console.log(`✓ Removed workspace: ${removedWorkspace.join(", ")}`);
  } else {
    console.log("○ No workspace build/cache dirs to remove");
  }

  if (fs.existsSync(CURSOR_PROJECT)) {
    const removedCursor: string[] = [];
    for (const dir of CURSOR_DIRS) {
      if (rmDir(dir, CURSOR_PROJECT)) removedCursor.push(dir);
    }
    const terminalsRemoved = trimTerminals();
    if (removedCursor.length > 0) {
      console.log(`✓ Removed Cursor cache: ${removedCursor.join(", ")}`);
    }
    if (terminalsRemoved > 0) {
      console.log(`✓ Trimmed ${terminalsRemoved} old terminal log(s)`);
    }
    if (removedCursor.length === 0 && terminalsRemoved === 0) {
      console.log("○ Cursor project cache already lean");
    }
  }

  console.log("✓ cleanup:workspace done");
}

main();
