import path from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, devices } from "@playwright/test";
import { getE2eBaseUrl, hasE2eCredentials } from "./e2e/utils/env";

const rootDir = path.dirname(fileURLToPath(import.meta.url));

const baseURL = getE2eBaseUrl();
const hasAuthCreds = hasE2eCredentials();

const projects: Parameters<typeof defineConfig>[0]["projects"] = [
  {
    name: "public",
    testMatch: /.*\.public\.spec\.ts/,
    use: { ...devices["iPhone 14"] },
  },
];

if (hasAuthCreds) {
  projects.push({
    name: "authenticated",
    testMatch: /.*\.auth-ed\.spec\.ts/,
    use: { ...devices["iPhone 14"] },
  });
}

export default defineConfig({
  testDir: "./e2e/tests",
  globalSetup: path.resolve(rootDir, "e2e/global-setup.ts"),
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
