import { describe, it, expect } from "vitest";
import { parsePrinterAddress, isValidPrinterAddress } from "@/server/printing/printer-address-validator";

describe("Printer Address & SSRF Protection Unit Tests (Point 3)", () => {
  it("accepts valid RFC 1918 and loopback IPv4 addresses with default port 9100", () => {
    const validAddresses = [
      "127.0.0.1",
      "10.0.0.1",
      "172.16.0.1",
      "172.31.255.254",
      "192.168.1.200",
      "192.168.0.1",
    ];

    for (const addr of validAddresses) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.host).toBe(addr);
        expect(res.port).toBe(9100);
        expect(res.formatted).toBe(`${addr}:9100`);
      }
      expect(isValidPrinterAddress(addr)).toBe(true);
    }
  });

  it("accepts valid ports within restricted range 9100..9109", () => {
    const validWithPorts = [
      { input: "127.0.0.1:9100", host: "127.0.0.1", port: 9100 },
      { input: "192.168.1.50:9101", host: "192.168.1.50", port: 9101 },
      { input: "10.10.10.10:9105", host: "10.10.10.10", port: 9105 },
      { input: "172.20.1.1:9109", host: "172.20.1.1", port: 9109 },
    ];

    for (const item of validWithPorts) {
      const res = parsePrinterAddress(item.input);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.host).toBe(item.host);
        expect(res.port).toBe(item.port);
        expect(res.formatted).toBe(item.input);
      }
    }
  });

  it("rejects octal notation with leading zeros (e.g. 010.1.1.1)", () => {
    const octalAddresses = ["010.1.1.1", "192.168.01.1", "127.000.000.001", "10.01.0.1"];
    for (const addr of octalAddresses) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(false);
      expect(isValidPrinterAddress(addr)).toBe(false);
    }
  });

  it("rejects hex and decimal IP representations", () => {
    const nonCanonical = ["0x7f000001", "2130706433", "0x7f.0.0.1", "017700000001"];
    for (const addr of nonCanonical) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects localhost and hostnames", () => {
    const hostnames = ["localhost", "localhost:9100", "printer.local", "my-printer.lan"];
    for (const host of hostnames) {
      const res = parsePrinterAddress(host);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects 0.0.0.0 and link-local 169.254.x.x addresses", () => {
    const rejected = ["0.0.0.0", "0.0.0.0:9100", "169.254.1.1", "169.254.100.200:9100"];
    for (const addr of rejected) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects public non-RFC1918 IPs (anti-SSRF)", () => {
    const publicIps = ["8.8.8.8", "1.1.1.1", "123.45.67.89", "172.32.0.1", "192.169.1.1"];
    for (const ip of publicIps) {
      const res = parsePrinterAddress(ip);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects IPv6 addresses", () => {
    const ipv6 = ["::1", "fe80::1", "[::1]:9100", "2001:db8::1"];
    for (const addr of ipv6) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(false);
    }
  });

  it("rejects ports outside the 9100..9109 restricted range (e.g. Postgres 5432, Redis 6379)", () => {
    const invalidPorts = [
      "127.0.0.1:5432", // Postgres
      "127.0.0.1:6379", // Redis
      "192.168.1.100:80", // HTTP
      "192.168.1.100:443", // HTTPS
      "192.168.1.100:9099", // Below 9100
      "192.168.1.100:9110", // Above 9109
      "192.168.1.100:0", // Invalid port
      "192.168.1.100:65536", // Out of range
    ];
    for (const addr of invalidPorts) {
      const res = parsePrinterAddress(addr);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error).toMatch(/9100\.\.9109|cổng/i);
      }
    }
  });

  it("rejects whitespace and strings longer than 21 characters", () => {
    const invalid = [
      " 192.168.1.100",
      "192.168.1.100 ",
      "192.168. 1.100",
      "192.168.1.100: 9100",
      "192.168.1.100:910000000000", // > 21 chars
      "192.168.001.001:91000",
    ];
    for (const item of invalid) {
      const res = parsePrinterAddress(item);
      expect(res.ok).toBe(false);
    }
  });
});
