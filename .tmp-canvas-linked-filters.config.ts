import { defineConfig } from "playwright/test";
import config from "./playwright.config";

export default defineConfig({
  ...config,
  outputDir: ".tmp-canvas-filter-test-results",
  use: { ...config.use, baseURL: "http://127.0.0.1:4185" },
  webServer: {
    command: "npm run dev -- --host 127.0.0.1 --port 4185 --strictPort",
    url: "http://127.0.0.1:4185",
    reuseExistingServer: false,
  },
});
