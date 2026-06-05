import { describe, it, expect, beforeEach, afterEach } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  cleanupE2eArtifacts,
  shouldKeepE2eArtifacts,
} from "./cleanup-artifacts";

describe("cleanup-artifacts", () => {
  const prevCi = process.env.CI;
  const prevKeep = process.env.E2E_KEEP_ARTIFACTS;
  let tmpRoot = "";

  beforeEach(() => {
    delete process.env.CI;
    delete process.env.E2E_KEEP_ARTIFACTS;
    tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "e2e-cleanup-"));
    fs.mkdirSync(path.join(tmpRoot, "playwright-report"));
    fs.mkdirSync(path.join(tmpRoot, "test-results"));
  });

  afterEach(() => {
    if (prevCi === undefined) delete process.env.CI;
    else process.env.CI = prevCi;
    if (prevKeep === undefined) delete process.env.E2E_KEEP_ARTIFACTS;
    else process.env.E2E_KEEP_ARTIFACTS = prevKeep;
    fs.rmSync(tmpRoot, { recursive: true, force: true });
  });

  it("removes artifact dirs under a temp root", () => {
    const { removed } = cleanupE2eArtifacts(tmpRoot);
    expect(removed).toContain("playwright-report");
    expect(removed).toContain("test-results");
    expect(fs.existsSync(path.join(tmpRoot, "playwright-report"))).toBe(false);
  });

  it("shouldKeepE2eArtifacts when CI or E2E_KEEP_ARTIFACTS", () => {
    expect(shouldKeepE2eArtifacts()).toBe(false);
    process.env.CI = "1";
    expect(shouldKeepE2eArtifacts()).toBe(true);
    delete process.env.CI;
    process.env.E2E_KEEP_ARTIFACTS = "1";
    expect(shouldKeepE2eArtifacts()).toBe(true);
  });
});
