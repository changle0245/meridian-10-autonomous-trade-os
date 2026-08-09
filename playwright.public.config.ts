import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e-public",
  fullyParallel: true,
  retries: 2,
  reporter: "list",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
