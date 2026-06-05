import { expect, type Page } from "@playwright/test";

const FATAL_COPY = ["This page didn't load", "Something went wrong on our end"];

/** Fail fast if TanStack error boundary rendered. */
export async function expectHealthyPage(page: Page) {
  for (const text of FATAL_COPY) {
    await expect(page.getByText(text, { exact: false })).toHaveCount(0);
  }
}

export async function expectNoConsoleErrors(page: Page, action: () => Promise<void>) {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  await action();
  const ignored = errors.filter(
    (e) => e.includes("favicon.ico") || e.includes("Failed to load resource") || e.includes("404"),
  );
  expect(ignored, `Unexpected console errors:\n${ignored.join("\n")}`).toHaveLength(0);
}
