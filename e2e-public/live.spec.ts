import { expect, test } from "@playwright/test";

test("production command center is reachable and synthetic", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("从第一条线索，到最后一美元利润。")).toBeVisible();
  await expect(page.getByText("100% 虚构客户")).toBeVisible();
});

test("production health endpoint reports Level 10", async ({ request }) => {
  const response = await request.get("/api/health");
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body.release).toBe("integrated-core-v1");
  expect(body.workflow).toBe("vercel-wdk");
});

test("production PDF is downloadable", async ({ request }) => {
  const response = await request.get("/api/documents/packing-list?order=SO-260731");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["x-synthetic-demo"]).toBe("true");
  expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
});

test("production durable workflow queues", async ({ request }) => {
  const response = await request.post("/api/workflows/order", { data: { orderId: "SO-260731", tenantId: "tenant-meridian-demo", customerId: "CUS-2401", dryRun: true } });
  expect(response.status()).toBe(202);
  const body = await response.json();
  expect(body.runId).toMatch(/^wrun_/);
  expect(body.durable).toBe(true);
});

test("production customer portal is cost-redacted", async ({ page }) => {
  await page.goto("/portal/demo-nordwerk");
  await expect(page.getByText("COST-REDACTED VIEW")).toBeVisible();
  await expect(page.getByText("Your order is progressing on plan.")).toBeVisible();
  await expect(page.getByText("采购成本")).toHaveCount(0);
});

test("production blocks cron without bearer secret", async ({ request }) => {
  const response = await request.get("/api/cron/daily");
  expect(response.status()).toBe(401);
});
