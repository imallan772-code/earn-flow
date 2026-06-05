import type { Page } from "@playwright/test";

export class AppShell {
  constructor(readonly page: Page) {}

  navFeed() {
    return this.page.getByRole("link", { name: "피드" });
  }

  navEarn() {
    return this.page.getByRole("link", { name: "돈벌기" });
  }

  navTrade() {
    return this.page.getByRole("link", { name: "트레이드" });
  }

  navNotice() {
    return this.page.getByRole("link", { name: "알림" });
  }

  navMy() {
    return this.page.getByRole("link", { name: "마이" });
  }

  async gotoFeed() {
    await this.page.goto("/feed");
  }

  async gotoEarn() {
    await this.page.goto("/earn");
  }

  async ensureDemoMode() {
    await this.page.addInitScript(() => {
      localStorage.setItem("phonara.mode", "demo");
    });
  }
}
