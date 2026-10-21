import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Role } from "@/lib/permissions";

export const AUTH_COOKIE_NAME = "pos_token";

export const TokenPayloadSchema = z.object({
  userId: z.number().int().positive(),
  username: z.string().min(1),
  fullName: z.string().default(""),
  role: z.enum(["QUAN_LY", "THU_NGAN", "PHUC_VU"]),
});

export type TokenPayload = z.infer<typeof TokenPayloadSchema> & {
  [key: string]: unknown;
};

/**
 * Retrieves the JWT signing secret from environment variables.
 * In production: throws if missing or less than 32 characters long.
 * In development/test: requires JWT_SECRET to be supplied via environment or test config.
 */
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  const isProduction = process.env.NODE_ENV === "production";

  if (isProduction) {
    if (!secret || secret.length < 32) {
      throw new Error(
        "JWT_SECRET environment variable is missing or shorter than 32 characters in production",
      );
    }
    return secret;
  }

  if (!secret) {
    throw new Error(
      "JWT_SECRET environment variable is not set. Please configure it in .env or test configuration.",
    );
  }
  return secret;
}

/**
 * Returns secret key as Uint8Array for jose cryptographic functions.
 */
export function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getJwtSecret());
}

/**
 * Determines whether authentication cookies must require HTTPS (Secure flag).
 * Reads from COOKIE_SECURE if provided (e.g. for local HTTP deployment over LAN);
 * defaults to true in production, false in development/test.
 */
export function isCookieSecure(): boolean {
  if (process.env.COOKIE_SECURE !== undefined) {
    return process.env.COOKIE_SECURE === "true" || process.env.COOKIE_SECURE === "1";
  }
  return process.env.NODE_ENV === "production";
}

/**
 * Signs a JWT token containing user details with a 7-day expiration.
 */
export async function signAuthToken(payload: TokenPayload): Promise<string> {
  const key = getSecretKey();
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(key);
}

/**
 * Verifies and decodes a signed JWT token using HS256 algorithm.
 * Returns null if the token is invalid or expired.
 */
export async function verifyAuthToken(token: string): Promise<TokenPayload | null> {
  try {
    const key = getSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ["HS256"],
    });
    const parsed = TokenPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return null;
    }
    return parsed.data;
  } catch {
    return null;
  }
}
