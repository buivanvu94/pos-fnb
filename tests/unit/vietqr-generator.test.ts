import { describe, it, expect } from "vitest";
import { crc16Ccitt } from "@/server/payments/vietqr-crc16";
import {
  formatVietqrTransferContent,
  generateVietQrString,
  formatTlv,
} from "@/server/payments/vietqr-generator";

describe("VietQR EMVCo & CRC16 Generator (FR-12, AC-08-1)", () => {
  it("computes CRC16-CCITT for standard vector 123456789", () => {
    expect(crc16Ccitt("123456789")).toBe("29B1");
  });

  it("formats TLV with 2-digit tag, 2-digit length, and value", () => {
    expect(formatTlv("00", "01")).toBe("000201");
    expect(formatTlv("58", "VN")).toBe("5802VN");
    expect(formatTlv("54", "150000")).toBe("5406150000");
  });

  it("shortens HD-YYYYMMDD-nnnn to HDnnnn per AC-08-1", () => {
    expect(formatVietqrTransferContent("HD-20261020-0012")).toBe("HD0012");
    expect(formatVietqrTransferContent("HD-20261022-0001")).toBe("HD0001");
    expect(formatVietqrTransferContent("HD-0042")).toBe("HD0042");
    expect(formatVietqrTransferContent("HD9999")).toBe("HD9999");
    expect(formatVietqrTransferContent("Custom123")).toBe("CUSTOM123");
  });

  it("generates valid dynamic VietQR payload for AC-08-1 (150,000 VND, HD0012)", () => {
    const qrString = generateVietQrString({
      bankBin: "970422",
      accountNo: "0123456789",
      amount: 150000,
      transferContent: "HD0012",
      isDynamic: true,
    });

    // Verify root tags
    expect(qrString.startsWith("000201010212")).toBe(true);
    // Verify Napas GUID A000000727
    expect(qrString).toContain("0010A000000727");
    // Verify Bank BIN & Account No
    expect(qrString).toContain("0006970422");
    expect(qrString).toContain("01100123456789");
    // Verify currency 704 (VND)
    expect(qrString).toContain("5303704");
    // Verify amount 150,000
    expect(qrString).toContain("5406150000");
    // Verify country code VN
    expect(qrString).toContain("5802VN");
    // Verify transfer content HD0012
    expect(qrString).toContain("62100806HD0012");
    // Verify Tag 63 CRC
    expect(qrString).toContain("6304");

    // Checksum verification
    const bodyBeforeCrc = qrString.slice(0, -4);
    const expectedCrc = qrString.slice(-4);
    expect(crc16Ccitt(bodyBeforeCrc)).toBe(expectedCrc);
  });

  it("generates valid static VietQR when amount is omitted", () => {
    const qrString = generateVietQrString({
      bankBin: "970422",
      accountNo: "0123456789",
      isDynamic: false,
    });

    expect(qrString.startsWith("000201010211")).toBe(true);
    expect(qrString).toContain("53037045802VN"); // Tag 58 directly follows Tag 53 without Tag 54 (amount)
    const bodyBeforeCrc = qrString.slice(0, -4);
    const expectedCrc = qrString.slice(-4);
    expect(crc16Ccitt(bodyBeforeCrc)).toBe(expectedCrc);
  });
});
