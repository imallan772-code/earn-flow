import type { Page } from "@playwright/test";

export class AuthPage {
  constructor(readonly page: Page) {}

  async gotoLogin() {
    await this.page.goto("/login");
  }

  async gotoSignup() {
    await this.page.goto("/signup");
  }

  async useEmailTab() {
    await this.page.getByRole("button", { name: "이메일" }).click();
  }

  emailInput() {
    return this.page.getByTestId("auth-email");
  }

  passwordInput() {
    return this.page.getByTestId("auth-password");
  }

  submitButton() {
    return this.page.getByTestId("auth-submit");
  }

  async login(email: string, password: string) {
    await this.useEmailTab();
    await this.emailInput().fill(email);
    await this.passwordInput().fill(password);
    await this.submitButton().click();
  }
}
