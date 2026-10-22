/**
 * Unified feature flag and configuration helper for VietQR payment method.
 * Controlled by VIETQR_ENABLED environment variable (defaults to true if unset).
 */
export function isVietQrEnabled(): boolean {
  const envVal = process.env.VIETQR_ENABLED;
  if (envVal === undefined || envVal === "") {
    return true;
  }
  return envVal.toLowerCase() === "true" || envVal === "1";
}
