import { defineConfig } from "vitest/config";
import path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 20000,
    env: {
      DATABASE_URL:
        process.env.DATABASE_TEST_URL ||
        "postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p01",
      JWT_SECRET: "test_jwt_secret_key_must_be_at_least_32_characters_long_for_tests",
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
