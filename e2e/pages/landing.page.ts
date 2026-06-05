import type { Page } from "@playwright/test";

export class LandingPage {
  constructor(readonly page: Page) {}

  async goto() {
    await this.page.goto("/");
  }

  signupLink() {
    return this.page.getByRole("link", { name: "지금 무료 시작" });
  }

  loginLink() {
    return this.page.getByRole("link", { name: "로그인" });
  }

  brand() {
    return this.page.getByText("PHONARA", { exact: true });
  }
}
