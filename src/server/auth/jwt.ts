import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@/lib/permissions";

const JWT_SECRET =
  process.env.JWT_SECRET || "pos_fnb_secret_key_change_in_production_min_32_chars";
const secretKey = new TextEncoder().encode(JWT_SECRET);

export const AUTH_COOKIE_NAME = "pos_token";

export interface TokenPayload {
  userId: number;
  username: string;
  fullName: string;
  role: Role;
  [key: string]: unknown;
}

/**
 * Signs a JWT token containing user details with a 7-day expiration.
 */
export async function signAuthToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(secretKey);
}

/**
 * Verifies and decodes a signed JWT token.
 * Returns null if the token is invalid or expired.
 */
export async function verifyAuthToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secretKey);
    return {
      userId: payload.userId as number,
      username: payload.username as string,
      fullName: payload.fullName as string,
      role: payload.role as Role,
    };
  } catch {
    return null;
  }
}
