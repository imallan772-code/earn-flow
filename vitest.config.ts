/**
 * vitest config — hook/store 테스트를 위해 jsdom 환경 + RTL setup.
 *
 * 결정 이유
 *  - 기존 spec(순수 함수 5 파일, ~38 tests)은 환경 무관하게 통과해야 함 → jsdom 강제도 안전.
 *  - alias `@` 매핑은 tsconfig와 일치 (`./src/*`).
 *  - setupFiles로 jest-dom matchers + localStorage cleanup 주입.
 */
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
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
