import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://127.0.0.1:3100",
    headless: true,
  },
  webServer: {
    command: "npm --workspace @pagevelope/web run dev -- --hostname 127.0.0.1 --port 3100",
    url: "http://127.0.0.1:3100/builder",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
