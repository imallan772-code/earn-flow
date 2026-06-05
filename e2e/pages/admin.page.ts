import type { Page } from "@playwright/test";

export class AdminPage {
  constructor(readonly page: Page) {}

  async gotoDashboard() {
    await this.page.goto("/admin");
  }

  dashboardHeading() {
    return this.page.getByRole("heading", { name: "대시보드" });
  }

  deniedHeading() {
    return this.page.getByRole("heading", { name: "운영 콘솔 접근 불가" });
  }

  spinner() {
    return this.page.getByText("운영 권한 확인 중...");
  }
}
