/**
 * vitest setup — RTL jest-dom matchers + per-test localStorage cleanup.
 *
 * 결정 이유
 *  - localStorage 잔존 상태가 createGameStore/persistedGameState 테스트 간 누수를 일으킴.
 *    afterEach에서 일괄 clear.
 *  - jest-dom matchers는 hook/UI 테스트에서 toBeInTheDocument 등으로 사용.
 */
import "@testing-library/jest-dom/vitest";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

afterEach(() => {
  cleanup();
  try {
    window.localStorage.clear();
  } catch {
    /* ignore */
  }
});
