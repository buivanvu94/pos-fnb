import type { SKRSContext2D } from "@napi-rs/canvas";

export interface MonochromeRaster {
  width: number;
  height: number;
  data: Buffer;
}

/**
 * Converts canvas RGBA pixels into 1-bit monochrome ESC/POS raster data.
 * 1 = black dot printed, 0 = white paper.
 * Pixels are packed horizontally MSB first (bit 7 to bit 0).
 */
export function canvasToMonochromeRaster(
  ctx: SKRSContext2D,
  width: number,
  height: number,
): MonochromeRaster {
  if (width % 8 !== 0) {
    throw new Error(`Raster width must be a multiple of 8, got: ${width}`);
  }

  const imageData = ctx.getImageData(0, 0, width, height);
  const rgba = imageData.data;
  const bytesPerRow = width / 8;
  const buffer = Buffer.alloc(bytesPerRow * height, 0);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * bytesPerRow;
    const rgbaRowOffset = y * width * 4;

    for (let byteIdx = 0; byteIdx < bytesPerRow; byteIdx++) {
      let byteVal = 0;
      const pixelXStart = byteIdx * 8;

      for (let bit = 0; bit < 8; bit++) {
        const x = pixelXStart + bit;
        const offset = rgbaRowOffset + x * 4;
        const r = rgba[offset];
        const g = rgba[offset + 1];
        const b = rgba[offset + 2];
        const a = rgba[offset + 3];

        // If alpha < 128, consider transparent / white paper
        if (a >= 128) {
          // Standard ITU-R BT.601 luminance
          const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
          if (luminance < 128) {
            byteVal |= 0x80 >> bit;
          }
        }
      }

      buffer[rowOffset + byteIdx] = byteVal;
    }
  }

  return {
    width,
    height,
    data: buffer,
  };
}
