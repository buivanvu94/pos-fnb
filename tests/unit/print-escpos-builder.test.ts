import { describe, it, expect } from "vitest";
import { EscposBuilder } from "@/server/printing/escpos-builder";

describe("EscposBuilder Unit Tests", () => {
  it("generates correct ESC @ printer initialization sequence", () => {
    const builder = new EscposBuilder();
    const buf = builder.init().build();
    expect(buf).toEqual(Buffer.from([0x1b, 0x40]));
  });

  it("generates correct GS V paper cut command for partial (0x42) and full (0x41) cut (Point 8)", () => {
    const builderPartial = new EscposBuilder();
    const bufPartial = builderPartial.cut(true).build();
    expect(bufPartial).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));

    const builderFull = new EscposBuilder();
    const bufFull = builderFull.cut(false).build();
    expect(bufFull).toEqual(Buffer.from([0x1d, 0x56, 0x41, 0x00]));
  });

  it("generates correct ESC p cash drawer kick command (DEC-11)", () => {
    const builder = new EscposBuilder();
    const buf = builder.drawerKick(0, 0x19, 0xfa).build();
    expect(buf).toEqual(Buffer.from([0x1b, 0x70, 0x00, 0x19, 0xfa]));
  });

  it("generates correct text formatting commands (align, bold, fontSize)", () => {
    const builder = new EscposBuilder();
    const buf = builder.align("center").bold(true).fontSize(2, 2).build();
    expect(buf).toEqual(
      Buffer.from([
        0x1b, 0x61, 0x01, // align center
        0x1b, 0x45, 0x01, // bold on
        0x1d, 0x21, 0x11, // 2x2 font size
      ]),
    );
  });

  it("generates correct GS v 0 raster header for 80mm (576 dots) and 58mm (384 dots)", () => {
    // 80mm: 576 dots = 72 bytes wide (xL=72, xH=0). Height 10 dots (yL=10, yH=0).
    const width80 = 576;
    const height10 = 10;
    const data80 = Buffer.alloc((width80 / 8) * height10, 0xaa);

    const b80 = new EscposBuilder();
    const buf80 = b80.rasterImage(width80, height10, data80).build();

    expect(buf80.subarray(0, 8)).toEqual(
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 72, 0, 10, 0]),
    );
    expect(buf80.subarray(8)).toEqual(data80);

    // 58mm: 384 dots = 48 bytes wide (xL=48, xH=0). Height 20 dots (yL=20, yH=0).
    const width58 = 384;
    const height20 = 20;
    const data58 = Buffer.alloc((width58 / 8) * height20, 0xff);

    const b58 = new EscposBuilder();
    const buf58 = b58.rasterImage(width58, height20, data58).build();

    expect(buf58.subarray(0, 8)).toEqual(
      Buffer.from([0x1d, 0x76, 0x30, 0x00, 48, 0, 20, 0]),
    );
    expect(buf58.subarray(8)).toEqual(data58);
  });

  it("slices large raster image (3000 rows) into bands of max 256 rows, summing to 3000 rows (Point 7)", () => {
    const widthDot = 576; // 72 bytes per row
    const widthBytes = widthDot / 8;
    const totalHeight = 3000;
    const data = Buffer.alloc(widthBytes * totalHeight, 0x55);

    const builder = new EscposBuilder();
    const bytes = builder.rasterImage(widthDot, totalHeight, data).build();

    // Parse all GS v 0 headers in output
    let offset = 0;
    let totalRowsCounted = 0;
    let chunkCount = 0;

    while (offset < bytes.length) {
      // Must start with GS v 0 0x00
      expect(bytes.subarray(offset, offset + 4)).toEqual(Buffer.from([0x1d, 0x76, 0x30, 0x00]));

      const xL = bytes[offset + 4];
      const xH = bytes[offset + 5];
      const wBytes = xL | (xH << 8);
      expect(wBytes).toBe(widthBytes);

      const yL = bytes[offset + 6];
      const yH = bytes[offset + 7];
      const bandHeight = yL | (yH << 8);

      expect(bandHeight).toBeLessThanOrEqual(256);
      expect(bandHeight).toBeGreaterThan(0);

      totalRowsCounted += bandHeight;
      chunkCount++;

      const payloadLength = wBytes * bandHeight;
      offset += 8 + payloadLength;
    }

    expect(totalRowsCounted).toBe(3000);
    // 3000 / 256 = 11.71 -> 12 chunks (11 chunks of 256 + 1 chunk of 184)
    expect(chunkCount).toBe(12);
    expect(offset).toBe(bytes.length);
  });

  it("throws on invalid width or data length mismatch", () => {
    const builder = new EscposBuilder();
    expect(() => builder.rasterImage(105, 10, Buffer.alloc(100))).toThrow(
      /must be a multiple of 8/,
    );

    expect(() => builder.rasterImage(576, 10, Buffer.alloc(50))).toThrow(
      /data length mismatch/,
    );
  });
});
