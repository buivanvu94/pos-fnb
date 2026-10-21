import { NextRequest } from "next/server";

/**
 * Extracts client IP safely from request headers only when TRUST_PROXY=true.
 * In LAN/standalone POS environments without trusted reverse proxy, returns null.
 */
export function getClientIp(req: NextRequest): string | null {
  if (process.env.TRUST_PROXY !== "true") {
    return null;
  }

  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = req.headers.get("x-real-ip");
  if (realIp && realIp.trim()) {
    return realIp.trim();
  }

  return null;
}

/**
 * Extracts User-Agent string from request, truncated to max 200 characters.
 */
export function getUserAgent(req: NextRequest): string | null {
  const ua = req.headers.get("user-agent");
  if (!ua) return null;
  const trimmed = ua.trim();
  return trimmed ? trimmed.slice(0, 200) : null;
}
