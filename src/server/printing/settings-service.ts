import { inArray } from "drizzle-orm";
import path from "path";
import { db } from "@/db";
import { settings } from "@/db/schema";
import { parsePrinterAddress, isValidPrinterAddress } from "./printer-address-validator";

export interface PrinterSettings {
  kitchenIp: string;
  barIp: string;
  receiptIp: string;
  paperWidth: 80 | 58;
  storeName: string;
  storeAddress: string;
  storePhone: string;
  storeLogo: string;
  wifiSsid: string;
  wifiPassword: string;
  wifiSecurity: string;
  drawerEnabled: boolean;
}

export const SETTING_KEYS = {
  KITCHEN_IP: "printer.kitchen.ip",
  BAR_IP: "printer.bar.ip",
  RECEIPT_IP: "printer.receipt.ip",
  PAPER_WIDTH: "printer.paperWidth",
  STORE_NAME: "store.name",
  STORE_ADDRESS: "store.address",
  STORE_PHONE: "store.phone",
  STORE_LOGO: "store.logo",
  WIFI_SSID: "wifi.ssid",
  WIFI_PASSWORD: "wifi.password",
  WIFI_SECURITY: "wifi.security",
  DRAWER_ENABLED: "drawer.enabled",
} as const;

export const LOGO_FILENAME_REGEX = /^\d+-[0-9a-f]{12}\.(png|jpg)$/;

/**
 * Validates whether an IP address belongs to RFC 1918 private ranges or Loopback (anti-SSRF).
 * Delegated to central parsePrinterAddress validator (Point 3).
 */
export function isPrivateOrLoopbackIp(rawIp: string): boolean {
  return isValidPrinterAddress(rawIp);
}

export async function getPrinterSettings(): Promise<PrinterSettings> {
  const keys = Object.values(SETTING_KEYS);
  const rows = await db
    .select({ key: settings.key, value: settings.value })
    .from(settings)
    .where(inArray(settings.key, keys));

  const map = new Map<string, string>();
  for (const row of rows) {
    map.set(row.key, row.value);
  }

  const paperWidthRaw = Number(map.get(SETTING_KEYS.PAPER_WIDTH));
  const paperWidth: 80 | 58 = paperWidthRaw === 58 ? 58 : 80;

  // Point 5: Removed hardcoded default IPs and Wi-Fi password. Default is empty string "".
  return {
    kitchenIp: map.get(SETTING_KEYS.KITCHEN_IP) || process.env.PRINTER_KITCHEN_IP || "",
    barIp: map.get(SETTING_KEYS.BAR_IP) || process.env.PRINTER_BAR_IP || "",
    receiptIp: map.get(SETTING_KEYS.RECEIPT_IP) || process.env.PRINTER_RECEIPT_IP || "",
    paperWidth,
    storeName: map.get(SETTING_KEYS.STORE_NAME) || "POS Cafe & Restaurant",
    storeAddress: map.get(SETTING_KEYS.STORE_ADDRESS) || "123 Đường Nguyễn Huệ, Quận 1, TP.HCM",
    storePhone: map.get(SETTING_KEYS.STORE_PHONE) || "0901234567",
    storeLogo: map.get(SETTING_KEYS.STORE_LOGO) || "",
    wifiSsid: map.get(SETTING_KEYS.WIFI_SSID) || "",
    wifiPassword: map.get(SETTING_KEYS.WIFI_PASSWORD) || "",
    wifiSecurity: map.get(SETTING_KEYS.WIFI_SECURITY) || "WPA",
    drawerEnabled: map.get(SETTING_KEYS.DRAWER_ENABLED) !== "false",
  };
}

export async function savePrinterSettings(
  partial: Partial<PrinterSettings>,
): Promise<PrinterSettings> {
  const entries: { key: string; value: string }[] = [];

  if (partial.kitchenIp !== undefined) {
    entries.push({ key: SETTING_KEYS.KITCHEN_IP, value: partial.kitchenIp });
  }
  if (partial.barIp !== undefined) {
    entries.push({ key: SETTING_KEYS.BAR_IP, value: partial.barIp });
  }
  if (partial.receiptIp !== undefined) {
    entries.push({ key: SETTING_KEYS.RECEIPT_IP, value: partial.receiptIp });
  }
  if (partial.paperWidth !== undefined) {
    entries.push({ key: SETTING_KEYS.PAPER_WIDTH, value: String(partial.paperWidth) });
  }
  if (partial.storeName !== undefined) {
    entries.push({ key: SETTING_KEYS.STORE_NAME, value: partial.storeName });
  }
  if (partial.storeAddress !== undefined) {
    entries.push({ key: SETTING_KEYS.STORE_ADDRESS, value: partial.storeAddress });
  }
  if (partial.storePhone !== undefined) {
    entries.push({ key: SETTING_KEYS.STORE_PHONE, value: partial.storePhone });
  }
  if (partial.storeLogo !== undefined) {
    // Point 6: store only the basename/filename
    const cleanLogoName = partial.storeLogo ? path.basename(partial.storeLogo) : "";
    entries.push({ key: SETTING_KEYS.STORE_LOGO, value: cleanLogoName });
  }
  if (partial.wifiSsid !== undefined) {
    entries.push({ key: SETTING_KEYS.WIFI_SSID, value: partial.wifiSsid });
  }
  if (partial.wifiPassword !== undefined) {
    entries.push({ key: SETTING_KEYS.WIFI_PASSWORD, value: partial.wifiPassword });
  }
  if (partial.wifiSecurity !== undefined) {
    entries.push({ key: SETTING_KEYS.WIFI_SECURITY, value: partial.wifiSecurity });
  }
  if (partial.drawerEnabled !== undefined) {
    entries.push({
      key: SETTING_KEYS.DRAWER_ENABLED,
      value: partial.drawerEnabled ? "true" : "false",
    });
  }

  for (const item of entries) {
    await db
      .insert(settings)
      .values({ key: item.key, value: item.value, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value: item.value, updatedAt: new Date() },
      });
  }

  return await getPrinterSettings();
}
