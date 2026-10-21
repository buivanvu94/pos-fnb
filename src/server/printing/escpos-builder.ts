/**
 * ESC/POS Command Builder for Thermal Printers (LAN Socket TCP:9100).
 * Generates raw byte buffers according to the ESC/POS standard specification.
 */

export class EscposBuilder {
  private buffers: Buffer[] = [];

  /**
   * Initializes printer, resetting internal buffers and formatting modes (ESC @).
   */
  init(): this {
    this.buffers.push(Buffer.from([0x1b, 0x40]));
    return this;
  }

  /**
   * Sets text alignment (ESC a n: 0 = left, 1 = center, 2 = right).
   */
  align(alignMode: "left" | "center" | "right"): this {
    const code = alignMode === "center" ? 0x01 : alignMode === "right" ? 0x02 : 0x00;
    this.buffers.push(Buffer.from([0x1b, 0x61, code]));
    return this;
  }

  /**
   * Sets emphasized / bold mode (ESC E n: 1 = on, 0 = off).
   */
  bold(enable = true): this {
    this.buffers.push(Buffer.from([0x1b, 0x45, enable ? 0x01 : 0x00]));
    return this;
  }

  /**
   * Sets character font size multipliers (GS ! n).
   * @param widthMul 1 to 8
   * @param heightMul 1 to 8
   */
  fontSize(widthMul = 1, heightMul = 1): this {
    const w = Math.min(Math.max(widthMul - 1, 0), 7);
    const h = Math.min(Math.max(heightMul - 1, 0), 7);
    const n = (w << 4) | h;
    this.buffers.push(Buffer.from([0x1d, 0x21, n]));
    return this;
  }

  /**
   * Feeds paper by n lines (LF).
   */
  feed(lines = 1): this {
    const count = Math.max(1, lines);
    this.buffers.push(Buffer.alloc(count, 0x0a));
    return this;
  }

  /**
   * Appends raw raster bit image using ESC/POS standard "GS v 0" (0x1D 0x76 0x30).
   * Automatically slices images into bands of max 256 rows per command (Point 7)
   * to avoid silent truncation and buffer overflows on physical thermal printers.
   * @param widthDot Width in dots (must be divisible by 8)
   * @param heightDot Height in dots
   * @param rasterData 1-bit monochrome data (1 = dot printed, 0 = white)
   */
  rasterImage(widthDot: number, heightDot: number, rasterData: Buffer): this {
    if (widthDot % 8 !== 0) {
      throw new Error(`Raster image widthDot must be a multiple of 8, received: ${widthDot}`);
    }
    const widthBytes = widthDot / 8;
    const expectedLength = widthBytes * heightDot;
    if (rasterData.length !== expectedLength) {
      throw new Error(
        `Raster data length mismatch: expected ${expectedLength} bytes (${widthBytes}x${heightDot}), received: ${rasterData.length}`,
      );
    }

    const MAX_BAND_HEIGHT = 256;
    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;

    let processedRows = 0;
    while (processedRows < heightDot) {
      const currentBandHeight = Math.min(MAX_BAND_HEIGHT, heightDot - processedRows);
      const startOffset = processedRows * widthBytes;
      const endOffset = startOffset + currentBandHeight * widthBytes;
      const bandData = rasterData.subarray(startOffset, endOffset);

      const yL = currentBandHeight & 0xff;
      const yH = (currentBandHeight >> 8) & 0xff;

      // GS v 0 m xL xH yL yH
      const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
      this.buffers.push(header, bandData);

      processedRows += currentBandHeight;
    }

    return this;
  }

  /**
   * Executes paper cut (GS V m n: 0x41 = Full cut, 0x42 = Partial cut).
   * Fixed in Point 8 to properly use the calculated mode argument.
   * @param partial Whether to execute partial cut (default true)
   */
  cut(partial = true): this {
    const mode = partial ? 0x42 : 0x41;
    this.buffers.push(Buffer.from([0x1d, 0x56, mode, 0x00]));
    return this;
  }

  /**
   * Sends cash drawer kick pulse (ESC p m t1 t2).
   * DEC-11: Activates drawer solenoid on standard RJ12 connector.
   * @param pin 0 = Pin 2, 1 = Pin 5 (default 0)
   * @param t1 On-time pulse duration (default 25 * 2ms = 50ms)
   * @param t2 Off-time pulse duration (default 250 * 2ms = 500ms)
   */
  drawerKick(pin = 0, t1 = 0x19, t2 = 0xfa): this {
    this.buffers.push(Buffer.from([0x1b, 0x70, pin, t1, t2]));
    return this;
  }

  /**
   * Concatenates all command buffers into a single binary Buffer.
   */
  build(): Buffer {
    return Buffer.concat(this.buffers);
  }
}
