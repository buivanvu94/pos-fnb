import { defineConfig, devices } from "@playwright/test";
import { getTestDbUrl } from "./tests/setup/test-config";

// E2E chạy trên server dev riêng (cổng cố định) trỏ vào DB test, không đụng DB phát triển.
const E2E_PORT = 3100;
const E2E_BASE_URL = `http://localhost:${E2E_PORT}`;

export const E2E_SEPAY_API_KEY = "e2e-sepay-key-0123456789";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  // Các bước dùng chung một ca/hóa đơn nên chạy tuần tự.
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }]],
  timeout: 60_000,
  use: {
    baseURL: E2E_BASE_URL,
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Edge chỉ chạy khi đã cài trình duyệt (E2E_EDGE=1), tránh lỗi trên máy không có Edge.
    ...(process.env.E2E_EDGE === "1"
      ? [{ name: "msedge", use: { ...devices["Desktop Edge"], channel: "msedge" } }]
      : []),
  ],
  webServer: {
    command: `npx next dev -p ${E2E_PORT}`,
    url: `${E2E_BASE_URL}/login`,
    reuseExistingServer: false,
    timeout: 180_000,
    env: {
      DATABASE_URL: getTestDbUrl(),
      JWT_SECRET: "e2e-jwt-secret-must-be-at-least-32-characters-long",
      COOKIE_SECURE: "false",
      SEPAY_API_KEY: E2E_SEPAY_API_KEY,
      VIETQR_BANK_BIN: "970436",
      VIETQR_ACCOUNT_NO: "0123456789",
      VIETQR_ENABLED: "true",
      // Đích đồng bộ cố tình không tồn tại để kiểm tra kịch bản mất mạng Internet.
      SYNC_TARGET_URL: "http://127.0.0.1:9/sync",
      SYNC_WORKER_ENABLED: "false",
    },
  },
});
