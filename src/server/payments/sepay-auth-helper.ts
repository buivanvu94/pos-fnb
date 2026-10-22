import crypto from "crypto";

/**
 * Validates SePay webhook API key or secret token against environment configuration.
 * Uses constant-time comparison (crypto.timingSafeEqual with sha256) to prevent timing attacks.
 * Fails closed if neither SEPAY_API_KEY nor SEPAY_WEBHOOK_SECRET is configured.
 */
export function verifySepayWebhookAuth(authHeader: string | null, xApiKey: string | null): boolean {
  const configuredApiKey = process.env.SEPAY_API_KEY;
  const configuredSecret = process.env.SEPAY_WEBHOOK_SECRET;

  const validTokens = [configuredApiKey, configuredSecret].filter(Boolean) as string[];
  if (validTokens.length === 0) {
    return false; // Fail-closed when unconfigured
  }

  const checkValue = (token: string | null | undefined): boolean => {
    if (!token) return false;
    const cleanToken = token.replace(/^(Apikey|Bearer)\s+/i, "").trim();

    return validTokens.some((valid) => {
      const hashA = crypto.createHash("sha256").update(cleanToken).digest();
      const hashB = crypto.createHash("sha256").update(valid.trim()).digest();
      return crypto.timingSafeEqual(hashA, hashB);
    });
  };

  return checkValue(authHeader) || checkValue(xApiKey);
}
