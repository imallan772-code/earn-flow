/**
 * Remove Playwright E2E artifacts that bloat the workspace and slow Cursor indexing.
 * Skipped when CI=1 or E2E_KEEP_ARTIFACTS=1 (debug / upload).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

const ARTIFACT_DIRS = ["playwright-report", "test-results", "blob-report"] as const;

export function shouldKeepE2eArtifacts(): boolean {
  return (
    process.env.CI === "1" || process.env.CI === "true" || process.env.E2E_KEEP_ARTIFACTS === "1"
  );
}

export function cleanupE2eArtifacts(rootDir = ROOT): { removed: string[]; skipped: string[] } {
  const removed: string[] = [];
  const skipped: string[] = [];

  for (const dir of ARTIFACT_DIRS) {
    const full = path.join(rootDir, dir);
    if (!fs.existsSync(full)) continue;
    try {
      fs.rmSync(full, { recursive: true, force: true });
      removed.push(dir);
    } catch {
      skipped.push(dir);
    }
  }

  return { removed, skipped };
}

export function runE2eArtifactCleanup(rootDir = ROOT): void {
  if (shouldKeepE2eArtifacts()) {
    console.log("[e2e:cleanup] Skipped (CI or E2E_KEEP_ARTIFACTS=1).");
    return;
  }

  const { removed, skipped } = cleanupE2eArtifacts(rootDir);
  if (removed.length > 0) {
    console.log(`[e2e:cleanup] Removed: ${removed.join(", ")}`);
  }
  if (skipped.length > 0) {
    console.warn(`[e2e:cleanup] Could not remove: ${skipped.join(", ")}`);
  }
  if (removed.length === 0 && skipped.length === 0) {
    console.log("[e2e:cleanup] Nothing to remove.");
  }
}
