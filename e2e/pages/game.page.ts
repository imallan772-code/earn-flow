import type { Page } from "@playwright/test";

export class GamePage {
  constructor(readonly page: Page) {}

  async goto(path: string) {
    return this.page.goto(path);
  }

  betButton() {
    return this.page.getByRole("button", { name: "베팅", exact: true });
  }

  async placeDemoBetIfReady() {
    const bet = this.betButton();
    await bet.waitFor({ state: "visible", timeout: 15_000 });
    if (await bet.isEnabled()) {
      await bet.click();
    }
  }
}
