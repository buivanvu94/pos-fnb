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
   * Appends a raw raster bit image using ESC/POS standard "GS v 0" (0x1D 0x76 0x30).
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

    const xL = widthBytes & 0xff;
    const xH = (widthBytes >> 8) & 0xff;
    const yL = heightDot & 0xff;
    const yH = (heightDot >> 8) & 0xff;

    // GS v 0 m xL xH yL yH
    const header = Buffer.from([0x1d, 0x76, 0x30, 0x00, xL, xH, yL, yH]);
    this.buffers.push(header, rasterData);
    return this;
  }

  /**
   * Executes paper cut (GS V m n: 0x42 = Partial cut with feed).
   * @param partial Whether to execute partial cut (default true)
   */
  cut(partial = true): this {
    // 0x1D 0x56 0x42 0x00: GS V B 0 (feeds paper and partial cuts)
    // 0x1D 0x56 0x41 0x00: GS V A 0 (feeds paper and full cuts)
    const mode = partial ? 0x42 : 0x41;
    this.buffers.push(Buffer.from([0x1d, 0x56, 0x42, 0x00]));
    return this;
  }

  /**
   * Sends cash drawer kick pulse (ESC p m t1 t2).
   * DEC-11: Activates drawer solenoid on standard RJ12 connector.
   * @param pin 0 = Pin 2, 1 = Pin 5 (default 0)
   * @param t1 Pulse ON time * 2ms (0x19 = 25 -> 50ms)
   * @param t2 Pulse OFF time * 2ms (0xFA = 250 -> 500ms)
   */
  drawerKick(pin: 0 | 1 = 0, t1 = 0x19, t2 = 0xfa): this {
    this.buffers.push(Buffer.from([0x1b, 0x70, pin, t1, t2]));
    return this;
  }

  /**
   * Appends raw buffer.
   */
  raw(buffer: Buffer): this {
    this.buffers.push(buffer);
    return this;
  }

  /**
   * Compiles all queued commands into a single contiguous Buffer.
   */
  build(): Buffer {
    return Buffer.concat(this.buffers);
  }
}
