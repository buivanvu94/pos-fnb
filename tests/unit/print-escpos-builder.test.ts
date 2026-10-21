import { describe, it, expect } from "vitest";
import { EscposBuilder } from "@/server/printing/escpos-builder";

describe("EscposBuilder Unit Tests", () => {
  it("generates correct ESC @ printer initialization sequence", () => {
    const builder = new EscposBuilder();
    const buf = builder.init().build();
    expect(buf).toEqual(Buffer.from([0x1b, 0x40]));
  });

  it("generates correct GS V paper cut command", () => {
    const builder = new EscposBuilder();
    const buf = builder.cut().build();
    expect(buf).toEqual(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
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
