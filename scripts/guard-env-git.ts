#!/usr/bin/env bun
/**
 * Block .env and other local secret files from git (staged or tracked).
 *
 * Usage:
 *   bun scripts/guard-env-git.ts --staged   # pre-commit
 *   bun scripts/guard-env-git.ts --tracked  # CI / bun run check
 */
import { execSync } from "node:child_process";

const ALLOWED_BASENAMES = new Set([".env.example"]);

function isBlockedSecretPath(filePath: string): boolean {
  const norm = filePath.replace(/\\/g, "/");
  const base = norm.split("/").pop() ?? norm;

  if (ALLOWED_BASENAMES.has(base)) return false;

  if (base === ".env" || base.startsWith(".env.")) return true;
  if (base === ".dev.vars") return true;
  if (norm.includes("/e2e/.auth/")) return true;

  return false;
}

function gitPaths(args: string): string[] {
  try {
    const out = execSync(`git ${args}`, { encoding: "utf8" }).trim();
    return out ? out.split(/\r?\n/) : [];
  } catch {
    return [];
  }
}

const mode = process.argv[2] ?? "--staged";
const files =
  mode === "--tracked" ? gitPaths("ls-files") : gitPaths("diff --cached --name-only --diff-filter=ACM");

const blocked = files.filter(isBlockedSecretPath);

if (blocked.length > 0) {
  console.error("✗ guard:env — .env / secret files must not be committed or tracked:");
  for (const f of blocked) console.error(`  · ${f}`);
  console.error("\nRemove from the index: git rm --cached <file>");
  process.exit(1);
}

console.log("✓ guard:env — no .env or secret files in git");
