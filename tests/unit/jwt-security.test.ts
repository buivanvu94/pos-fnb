import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getJwtSecret, isCookieSecure, signAuthToken, verifyAuthToken } from "@/server/auth/jwt";

describe("JWT Security & Secret Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("throws error in production when JWT_SECRET is missing", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    delete process.env.JWT_SECRET;

    expect(() => getJwtSecret()).toThrowError(
      "JWT_SECRET environment variable is missing or shorter than 32 characters in production",
    );
  });

  it("throws error in production when JWT_SECRET is shorter than 32 characters", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.JWT_SECRET = "too_short_secret_key_123";

    expect(() => getJwtSecret()).toThrowError(
      "JWT_SECRET environment variable is missing or shorter than 32 characters in production",
    );
  });

  it("accepts valid JWT_SECRET >= 32 characters in production", () => {
    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    process.env.JWT_SECRET = "production_super_secret_key_at_least_32_characters_long";

    expect(getJwtSecret()).toBe("production_super_secret_key_at_least_32_characters_long");
  });

  it("evaluates isCookieSecure() based on COOKIE_SECURE and NODE_ENV", () => {
    delete process.env.COOKIE_SECURE;
    (process.env as Record<string, string | undefined>).NODE_ENV = "development";
    expect(isCookieSecure()).toBe(false);

    (process.env as Record<string, string | undefined>).NODE_ENV = "production";
    expect(isCookieSecure()).toBe(true);

    process.env.COOKIE_SECURE = "false";
    expect(isCookieSecure()).toBe(false);

    process.env.COOKIE_SECURE = "true";
    expect(isCookieSecure()).toBe(true);
  });

  it("signs and verifies tokens strictly using HS256", async () => {
    process.env.JWT_SECRET = "valid_test_secret_for_token_verification_min_32_chars";

    const token = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Nguyễn Văn Quản Lý",
      role: "QUAN_LY",
    });

    const payload = await verifyAuthToken(token);
    expect(payload).not.toBeNull();
    expect(payload?.role).toBe("QUAN_LY");
  });
});
