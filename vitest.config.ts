import { defineConfig } from "vitest/config";
import path from "path";
import * as dotenv from "dotenv";
import { DEFAULT_TEST_DB_URL, TEST_JWT_SECRET } from "./tests/setup/test-config";

dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    globalSetup: ["./tests/setup/global-setup.ts"],
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    fileParallelism: false,
    env: {
      DATABASE_URL: process.env.DATABASE_TEST_URL || DEFAULT_TEST_DB_URL,
      JWT_SECRET: TEST_JWT_SECRET,
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
