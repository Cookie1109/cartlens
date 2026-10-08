import { defineConfig } from "@playwright/test"
export default defineConfig({
  testDir: "./tests", workers: 1, fullyParallel: false, timeout: 90000,
  use: { baseURL: process.env.CARTLENS_E2E_URL || "http://127.0.0.1:5174", headless: true, viewport: { width: 1440,height: 1000 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  reporter: [["list"],["json",{ outputFile: "test-results/report.json" }]],
})
