/**
 * vitest config — hook/store 테스트를 위해 jsdom 환경 + RTL setup.
 */
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "jsdom",
    // Playwright E2E lives in e2e/tests/ — run via `bun run test:e2e`, not vitest.
    include: ["src/**/*.spec.{ts,tsx}", "e2e/utils/**/*.spec.ts"],
    environmentMatchGlobs: [["e2e/utils/**", "node"]],
    setupFiles: ["./src/test/setup.ts"],
    globals: false,
    css: false,
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
