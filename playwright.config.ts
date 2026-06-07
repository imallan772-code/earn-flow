import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { getE2eBaseUrl, hasE2eCredentials } from "./e2e/utils/env";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const authFile = path.join(rootDir, "e2e/.auth/user.json");

const baseURL = getE2eBaseUrl();
const hasAuthCreds = hasE2eCredentials();

const projects: NonNullable<Parameters<typeof defineConfig>[0]["projects"]> = [];

if (hasAuthCreds) {
  projects.push({
    name: "setup",
    testMatch: /auth\.setup\.ts/,
  });
}

projects.push({
  name: "public",
  testMatch: /.*\.public\.spec\.ts/,
  dependencies: hasAuthCreds ? ["setup"] : undefined,
  use: { ...devices["iPhone 14"] },
});

if (hasAuthCreds) {
  projects.push({
    name: "authenticated",
    testMatch: /.*\.auth-ed\.spec\.ts/,
    testIgnore: /betting-(demo|real)\.auth-ed\.spec\.ts/,
    dependencies: ["setup"],
    use: {
      ...devices["iPhone 14"],
      storageState: authFile,
    },
  });

  projects.push({
    name: "betting-matrix-demo",
    testMatch: /betting-demo\.auth-ed\.spec\.ts/,
    dependencies: ["setup"],
    timeout: 90_000,
    use: {
      ...devices["iPhone 14"],
      storageState: authFile,
    },
  });

  projects.push({
    name: "betting-matrix-real",
    testMatch: /betting-real\.auth-ed\.spec\.ts/,
    dependencies: ["setup", "betting-matrix-demo"],
    timeout: 90_000,
    use: {
      ...devices["iPhone 14"],
      storageState: authFile,
    },
  });
}

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: path.resolve(rootDir, "e2e/global-setup.ts"),
  globalTeardown: path.resolve(rootDir, "e2e/global-teardown.ts"),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 2 : undefined,
  timeout: 60_000,
  expect: { timeout: 15_000 },
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
    ...(process.env.CI ? ([["github"] as const] as const) : []),
  ],
  use: {
    baseURL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    ...devices["iPhone 14"],
  },
  projects,
  webServer: {
    command: "bun run dev",
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    stdout: "pipe",
    stderr: "pipe",
  },
  metadata: {
    hasAuthCreds: String(hasAuthCreds),
  },
});
