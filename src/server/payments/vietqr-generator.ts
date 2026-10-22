import { crc16Ccitt } from "./vietqr-crc16";

export interface VietQrGenerateOptions {
  bankBin: string;
  accountNo: string;
  amount?: number;
  transferContent?: string;
  isDynamic?: boolean;
}

/**
 * Formats a single EMVCo TLV element (Tag-Length-Value).
 * Tag: 2 chars, Length: 2 digits (zero padded), Value: string content.
 */
export function formatTlv(tag: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${tag}${len}${value}`;
}

/**
 * Formats the human-readable order code into a compact transfer content (e.g. HD-20261020-0012 -> HD0012).
 * Strictly alphanumeric for banking app compatibility (AC-08-1).
 */
export function formatVietqrTransferContent(orderCode: string): string {
  const clean = orderCode.trim().toUpperCase();
  // If format is HD-YYYYMMDD-XXXX, shorten to HDXXXX per AC-08-1 (e.g. HD0012)
  const fullMatch = clean.match(/^HD-\d{8}-(\d+)$/);
  if (fullMatch) {
    return `HD${fullMatch[1]}`;
  }
  // If format is HD-XXXX
  const shortMatch = clean.match(/^HD-(\d+)$/);
  if (shortMatch) {
    return `HD${shortMatch[1]}`;
  }
  // Otherwise, remove non-alphanumeric chars and limit to 25 chars
  return clean.replace(/[^A-Z0-9]/g, "").slice(0, 25);
}

/**
 * Generates an EMVCo compliant VietQR string (NAPAS247 standard, FR-12, AC-08-1).
 */
export function generateVietQrString(options: VietQrGenerateOptions): string {
  const { bankBin, accountNo, amount, transferContent, isDynamic = true } = options;

  // 1. Tag 00: Payload Format Indicator ("01")
  const tag00 = formatTlv("00", "01");

  // 2. Tag 01: Point of Initiation Method ("12" = Dynamic, "11" = Static)
  const tag01 = formatTlv("01", isDynamic ? "12" : "11");

  // 3. Tag 38: Merchant Account Information (NAPAS247 VietQR)
  const sub38_00 = formatTlv("00", "A000000727"); // GUID NAPAS
  const sub38_01_00 = formatTlv("00", bankBin.trim());
  const sub38_01_01 = formatTlv("01", accountNo.trim());
  const sub38_01 = formatTlv("01", sub38_01_00 + sub38_01_01);
  const sub38_02 = formatTlv("02", "QRIBFTTA"); // Fast transfer to Account
  const tag38 = formatTlv("38", sub38_00 + sub38_01 + sub38_02);

  // 4. Tag 53: Transaction Currency ("704" for VND)
  const tag53 = formatTlv("53", "704");

  // 5. Tag 54: Transaction Amount (if specified and > 0)
  let tag54 = "";
  if (amount !== undefined && amount > 0) {
    tag54 = formatTlv("54", Math.round(amount).toString());
  }

  // 6. Tag 58: Country Code ("VN")
  const tag58 = formatTlv("58", "VN");

  // 7. Tag 62: Additional Data Field Template (transfer content / purpose)
  let tag62 = "";
  if (transferContent && transferContent.trim().length > 0) {
    const sub62_08 = formatTlv("08", transferContent.trim());
    tag62 = formatTlv("62", sub62_08);
  }

  // 8. Tag 63: CRC16 Checksum
  const payloadBeforeCrc = `${tag00}${tag01}${tag38}${tag53}${tag54}${tag58}${tag62}6304`;
  const checksum = crc16Ccitt(payloadBeforeCrc);

  return `${payloadBeforeCrc}${checksum}`;
}
