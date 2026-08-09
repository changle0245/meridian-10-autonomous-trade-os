import { expect, test, type Page } from "@playwright/test";

async function openWorkspace(page: Page, label: string, testId: string) {
  const menu = page.getByRole("button", { name: "打开菜单" });
  if (await menu.isVisible()) await menu.click();
  await page.getByRole("navigation", { name: "主导航" }).getByRole("button", { name: new RegExp(label) }).click();
  await expect(page.getByTestId(testId)).toBeVisible();
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("从第一条线索，到最后一美元利润。")).toBeVisible();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-ready", "true");
});

test("command center renders the complete synthetic boundary", async ({ page }) => {
  await expect(page.getByTestId("command-center")).toBeVisible();
  await expect(page.getByText("100% 虚构客户")).toBeVisible();
  await expect(page.getByText("真实外联").first()).toBeVisible();
  const menu = page.getByRole("button", { name: "打开菜单" });
  if (await menu.isVisible()) {
    await menu.click();
    await expect(page.getByRole("navigation", { name: "主导航" }).getByRole("button")).toHaveCount(15);
  } else {
    await expect(page.getByText("15 工作区")).toBeVisible();
  }
});

test("command palette navigates by keyboard", async ({ page }) => {
  await page.keyboard.press(process.platform === "darwin" ? "Meta+k" : "Control+k");
  await expect(page.getByRole("dialog", { name: "快速导航" })).toBeVisible();
  await page.getByPlaceholder("搜索工作区…").fill("库存");
  await page.getByRole("dialog", { name: "快速导航" }).getByRole("button", { name: /库存孪生/ }).click();
  await expect(page.getByTestId("inventory-view")).toBeVisible();
});

test("lead radar adds two scored fixtures and reports zero outreach", async ({ page }) => {
  await openWorkspace(page, "自主获客", "leads-view");
  await page.getByRole("button", { name: "运行一次获客扫描" }).click();
  await expect(page.getByRole("status")).toContainText(/2 个全新合成客户|没有创建重复线索/);
  await expect(page.getByText("Alpine Workshop Systems AG")).toBeVisible();
  await expect(page.getByTestId("leads-view").getByText("真实外联", { exact: true })).toBeVisible();
});

test("due diligence holds a potential name match for review", async ({ page }) => {
  await openWorkspace(page, "客户背调", "research-view");
  await page.getByRole("button", { name: /Kibo Industrial Partners/ }).click();
  await expect(page.getByText("HUMAN REVIEW", { exact: true })).toBeVisible();
  await expect(page.getByText("自动暂停")).toBeVisible();
  await expect(page.getByText(/Potential match - hold/)).toBeVisible();
});

test("customer 360 switches independent records", async ({ page }) => {
  await openWorkspace(page, "客户 360", "customers-view");
  await page.getByRole("button", { name: /MaplePro Hardware/ }).click();
  await expect(page.getByRole("heading", { name: "MaplePro Hardware Inc" })).toBeVisible();
  await expect(page.getByText("Complete pilot assortment")).toBeVisible();
  await page.getByRole("button", { name: "生成跟进草稿" }).click();
  await expect(page.getByRole("status")).toContainText("真实发送保持关闭");
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出客户档案" }).click();
  await expect((await downloadEvent).suggestedFilename()).toContain("synthetic-profile.json");
});

test("lookalike laboratory exposes explainable dimensions", async ({ page }) => {
  await openWorkspace(page, "相似客户", "lookalike-view");
  await expect(page.getByText("weighted-jaccard-v1")).toBeVisible();
  await expect(page.getByText("products").first()).toBeVisible();
  await expect(page.getByText("MATCH").first()).toBeVisible();
});

test("follow-up pipeline renders four evidence-driven stages", async ({ page }) => {
  await openWorkspace(page, "跟进漏斗", "pipeline-view");
  for (const stage of ["新线索", "已筛选", "已背调", "可联系"]) await expect(page.getByText(stage, { exact: true })).toBeVisible();
  await expect(page.getByText("NordWerk Distribution GmbH")).toBeVisible();
  await page.getByRole("button", { name: "草稿" }).first().click();
  await expect(page.getByRole("status")).toContainText("未执行真实外联");
});

test("quote cockpit recalculates discount and keeps a guardrail", async ({ page }) => {
  await openWorkspace(page, "报价驾驶舱", "quotes-view");
  const slider = page.getByLabel("折扣情景");
  await slider.fill("13");
  await expect(page.getByText("13.0%")).toBeVisible();
  await expect(page.getByText(/REVIEW|BLOCK/).first()).toBeVisible();
  await expect(page.getByText("净利率")).toBeVisible();
});

test("document factory serves all eight PDF types", async ({ page, request }) => {
  await openWorkspace(page, "贸易单证", "documents-view");
  await expect(page.getByRole("link", { name: "生成并打开 PDF" })).toHaveCount(8);
  const response = await request.get("/api/documents/commercial-invoice?order=SO-260731");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/pdf");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("fulfillment advances a milestone and queues a durable workflow", async ({ page }) => {
  await openWorkspace(page, "交付控制塔", "fulfillment-view");
  await page.getByRole("button", { name: "推进当前节点" }).click();
  await expect(page.getByRole("status")).toContainText("下一节点已激活");
  await page.getByRole("button", { name: "启动耐久流程" }).click();
  await expect(page.getByText("Workflow queued")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(/wrun_/)).toBeVisible();
});

test("customer portal removes internal costs and risk notes", async ({ page }) => {
  await page.goto("/portal/demo-nordwerk");
  await expect(page.getByTestId("customer-portal")).toBeVisible();
  await expect(page.getByText("COST-REDACTED VIEW")).toBeVisible();
  await expect(page.getByText("Your order is progressing on plan.")).toBeVisible();
  await expect(page.getByText(/supplier cost/i)).toBeVisible();
  await expect(page.getByText("采购成本")).toHaveCount(0);
});

test("supplier network ranks scorecards beyond price", async ({ page }) => {
  await openWorkspace(page, "供应商网络", "suppliers-view");
  await expect(page.getByText("Ningbo Nova Motors Co.")).toBeVisible();
  await expect(page.getByText("COMPOSITE").first()).toBeVisible();
  await expect(page.getByText("缺陷").first()).toBeVisible();
  await page.getByRole("button", { name: "运行供应商再平衡" }).click();
  await expect(page.getByRole("status")).toContainText("未自动下单");
});

test("inventory twin demonstrates idempotent reservations", async ({ page }) => {
  await openWorkspace(page, "库存孪生", "inventory-view");
  await page.getByRole("button", { name: "幂等请求演练" }).click();
  await expect(page.getByRole("status")).toContainText("Atomic reservation accepted");
  await page.getByRole("button", { name: "幂等请求演练" }).click();
  await expect(page.getByRole("status")).toContainText("already applied");
  await expect(page.getByText("IDEMPOTENT_REPLAY")).toBeVisible();
});

test("profit system recomputes freight stress", async ({ page }) => {
  await openWorkspace(page, "利润与费用", "finance-view");
  const sliders = page.locator('input[type="range"]');
  await sliders.nth(1).fill("100");
  await expect(page.getByText("+100%")).toBeVisible();
  await expect(page.getByText("情景影响")).toBeVisible();
});

test("compliance red team blocks every simulated attack", async ({ page }) => {
  await openWorkspace(page, "合规中心", "compliance-view");
  await page.getByRole("button", { name: "运行红队攻击演练" }).click();
  await expect(page.getByText("RED TEAM: 8/8 BLOCKED")).toBeVisible();
  await expect(page.getByText("Outbound delivery disabled")).toBeVisible();
});

test("automation center runs the complete dry-run control loop", async ({ page }) => {
  await openWorkspace(page, "自动化运行", "automations-view");
  await page.getByRole("button", { name: "运行完整控制循环" }).click();
  await expect(page.getByText("Full daily control loop")).toBeVisible();
  await expect(page.getByText("0 real messages, filings or payments")).toBeVisible();
});

test("audit center verifies its linked event chain", async ({ page }) => {
  await openWorkspace(page, "审计与恢复", "audit-view");
  await expect(page.getByText("完整且可重放")).toBeVisible();
  await page.getByRole("button", { name: "验证哈希链" }).click();
  await expect(page.getByRole("status")).toContainText("哈希链完整");
  await expect(page.getByText("fnv1a-", { exact: false }).first()).toBeVisible();
});

test("health, quote, inventory and cron boundaries stay coherent", async ({ request }) => {
  const health = await request.get("/api/health");
  expect((await health.json()).documentTypes).toBe(8);
  const reserve = await request.post("/api/inventory/reserve", { data: { requestId: "E2E-OVER", sku: "MT-DRL-18V", quantity: 99999 } });
  expect(reserve.status()).toBe(409);
  const cron = await request.get("/api/cron/daily");
  expect(cron.status()).toBe(401);
});
