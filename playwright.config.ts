import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  workers: 1,
  timeout: 90000,
  use: {
    baseURL: process.env.PW_BASE_URL || "http://127.0.0.1:5175",
    channel: "msedge",
    headless: true,
  },
  webServer: process.env.PW_BASE_URL
    ? undefined
    : {
        command: "node node_modules/vite/bin/vite.js --port 5175",
        url: "http://127.0.0.1:5175/api/status",
        timeout: 60000,
        reuseExistingServer: false,
        env: { LUSPACE_DATA_DIR: "../work/browser-" + Date.now() },
      },
  outputDir: "../work/playwright-results",
});
