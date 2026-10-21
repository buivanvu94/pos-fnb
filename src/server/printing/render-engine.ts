import type { Canvas } from "@napi-rs/canvas";
import type { PrintPayload } from "./print-payload-types";
import { EscposBuilder } from "./escpos-builder";
import { canvasToMonochromeRaster } from "./render-bitmap";
import { WIDTH_80MM, WIDTH_58MM } from "./templates/canvas-helpers";
import { renderKotCanvas, renderKotCancelCanvas } from "./templates/render-kot";
import { renderProvisionalCanvas } from "./templates/render-provisional";
import { renderFinalReceiptCanvas } from "./templates/render-final-receipt";
import { renderCashReceiptCanvas, renderZReportCanvas } from "./templates/render-cash-z";

export type PaperWidth = 80 | 58;

export function getDotWidth(paperWidth: PaperWidth = 80): number {
  return paperWidth === 58 ? WIDTH_58MM : WIDTH_80MM;
}

/**
 * Dispatches payload to the corresponding canvas renderer.
 */
export async function renderPayloadToCanvas(
  payload: PrintPayload | Record<string, any>,
  paperWidth: PaperWidth = 80,
): Promise<Canvas> {
  const width = getDotWidth(paperWidth);
  const p = payload as Record<string, any>;

  // Normalize Phase 03 cash receipts without explicit 'kind'
  const kind = p.kind || (p.entryType ? "CASH_RECEIPT" : "");

  switch (kind) {
    case "KOT":
      return renderKotCanvas(p as any, width);
    case "KOT_CANCEL":
      return renderKotCancelCanvas(p as any, width);
    case "PROVISIONAL":
      return renderProvisionalCanvas(p as any, width);
    case "FINAL_RECEIPT":
      return await renderFinalReceiptCanvas(p as any, width);
    case "CASH_RECEIPT":
      return renderCashReceiptCanvas(p as any, width);
    case "Z_REPORT":
      return renderZReportCanvas(p as any, width);
    default:
      throw new Error(`Unsupported print payload kind: ${kind || JSON.stringify(payload)}`);
  }
}

/**
 * Compiles a print payload into ESC/POS thermal printer bytes.
 * Handles raster bitmap conversion, paper cutting, and cash drawer kick (DEC-11).
 */
export async function compilePrintPayloadToEscpos(
  payload: PrintPayload | Record<string, any>,
  options?: {
    paperWidth?: PaperWidth;
    enableDrawerKick?: boolean;
  },
): Promise<Buffer> {
  const paperWidth = options?.paperWidth ?? 80;
  const canvas = await renderPayloadToCanvas(payload, paperWidth);
  const ctx = canvas.getContext("2d");
  const raster = canvasToMonochromeRaster(ctx, canvas.width, canvas.height);

  const builder = new EscposBuilder();
  builder.init();
  builder.rasterImage(raster.width, raster.height, raster.data);
  builder.feed(2);
  builder.cut(true);

  // DEC-11: Cash drawer kick logic
  const p = payload as Record<string, any>;
  const isCashTransaction =
    p.kind === "CASH_RECEIPT" || Boolean(p.entryType);
  const shouldKickDrawer =
    options?.enableDrawerKick !== false &&
    (p.kickDrawer === true || isCashTransaction);

  if (shouldKickDrawer) {
    builder.drawerKick(0, 0x19, 0xfa);
  }

  return builder.build();
}

/**
 * Returns a PNG buffer of the rendered canvas for visual preview / inspection.
 */
export async function renderPayloadToPng(
  payload: PrintPayload | Record<string, any>,
  paperWidth: PaperWidth = 80,
): Promise<Buffer> {
  const canvas = await renderPayloadToCanvas(payload, paperWidth);
  return canvas.toBuffer("image/png");
}
