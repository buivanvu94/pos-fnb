import net from "net";

export interface ParsedPrinterAddress {
  ok: true;
  host: string;
  port: number;
  formatted: string;
}

export interface ParseAddressError {
  ok: false;
  error: string;
}

export type ParsePrinterAddressResult = ParsedPrinterAddress | ParseAddressError;

/**
 * Validates and parses a thermal printer LAN address strictly against specification.
 * Blocks SSRF vulnerabilities by restricting to canonical RFC1918 / Loopback IPv4
 * and constraining network ports to 9100..9109 (preventing port-scanning internal DBs/services).
 */
export function parsePrinterAddress(raw: string | undefined | null): ParsePrinterAddressResult {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Địa chỉ máy in không được để trống" };
  }

  // Reject strings exceeding max length of standard IPv4 + :port (e.g. 255.255.255.255:65535 = 21 chars)
  if (raw.length > 21) {
    return { ok: false, error: "Địa chỉ máy in quá dài (tối đa 21 ký tự)" };
  }

  // Reject whitespace anywhere in address
  if (/\s/.test(raw)) {
    return { ok: false, error: "Địa chỉ máy in không được chứa khoảng trắng" };
  }

  // Regex format: Dotted decimal IPv4 with optional port in 1..65535
  const match = raw.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{1,5}))?$/);
  if (!match) {
    return {
      ok: false,
      error: "Địa chỉ máy in phải theo định dạng IPv4 chuẩn (vd: 192.168.1.200 hoặc 192.168.1.200:9100)",
    };
  }

  const host = match[1];
  const portStr = match[2];

  // net.isIPv4 rejects leading zeros (octal 010.1.1.1), hex, and non-canonical forms
  if (!net.isIPv4(host)) {
    return {
      ok: false,
      error: "Địa chỉ IPv4 không hợp lệ (không chấp nhận số 0 đứng đầu hoặc dạng bát phân/thập phân)",
    };
  }

  // Explicitly reject 0.0.0.0
  if (host === "0.0.0.0") {
    return { ok: false, error: "Không được phép sử dụng địa chỉ 0.0.0.0" };
  }

  const [a, b] = host.split(".").map(Number);

  // Explicitly reject link-local (169.254.0.0/16)
  if (a === 169 && b === 254) {
    return { ok: false, error: "Không được phép sử dụng dải link-local 169.254.x.x" };
  }

  // Must belong to RFC 1918 private ranges or Loopback (127.0.0.0/8)
  const isLoopback = a === 127;
  const isClassA = a === 10;
  const isClassB = a === 172 && b >= 16 && b <= 31;
  const isClassC = a === 192 && b === 168;

  if (!isLoopback && !isClassA && !isClassB && !isClassC) {
    return {
      ok: false,
      error: "Địa chỉ IP phải thuộc dải mạng LAN riêng (RFC1918: 10/8, 172.16/12, 192.168/16) hoặc Loopback (127/8)",
    };
  }

  let port = 9100;
  if (portStr !== undefined) {
    const p = Number(portStr);
    if (!Number.isInteger(p) || p < 1 || p > 65535) {
      return { ok: false, error: "Cổng máy in phải nằm trong khoảng 1..65535" };
    }

    // Non-9100 ports are restricted to 9100..9109 to prevent targeting internal DBs/services (e.g. Postgres 5432, Redis 6379)
    if (p < 9100 || p > 9109) {
      return { ok: false, error: "Cổng máy in chỉ được phép trong khoảng 9100..9109" };
    }
    port = p;
  }

  return {
    ok: true,
    host,
    port,
    formatted: `${host}:${port}`,
  };
}

export function isValidPrinterAddress(raw: string | undefined | null): boolean {
  return parsePrinterAddress(raw).ok;
}
