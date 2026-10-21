import fs from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import {
  getPrinterSettings,
  savePrinterSettings,
  LOGO_FILENAME_REGEX,
} from "@/server/printing/settings-service";
import { parsePrinterAddress } from "@/server/printing/printer-address-validator";

function validateOptionalPrinterIp(ip: string | undefined): boolean {
  if (!ip || ip.trim() === "") return true;
  return parsePrinterAddress(ip.trim()).ok;
}

const updatePrintersSchema = z.object({
  kitchenIp: z
    .string()
    .trim()
    .refine(validateOptionalPrinterIp, {
      message: "IP máy in bếp không hợp lệ hoặc nằm ngoài dải mạng riêng (RFC1918 / Loopback) nhằm chống SSRF",
    })
    .optional(),
  barIp: z
    .string()
    .trim()
    .refine(validateOptionalPrinterIp, {
      message: "IP máy in bar không hợp lệ hoặc nằm ngoài dải mạng riêng (RFC1918 / Loopback) nhằm chống SSRF",
    })
    .optional(),
  receiptIp: z
    .string()
    .trim()
    .refine(validateOptionalPrinterIp, {
      message: "IP máy in hóa đơn không hợp lệ hoặc nằm ngoài dải mạng riêng (RFC1918 / Loopback) nhằm chống SSRF",
    })
    .optional(),
  paperWidth: z
    .number({ invalid_type_error: "Khổ giấy chỉ chấp nhận 80mm hoặc 58mm" })
    .refine((val) => val === 80 || val === 58, {
      message: "Khổ giấy chỉ chấp nhận 80mm hoặc 58mm",
    })
    .optional(),
  storeName: z.string().max(255).optional(),
  storeAddress: z.string().max(255).optional(),
  storePhone: z.string().max(50).optional(),
  storeLogo: z
    .string()
    .trim()
    .refine(
      (val) => {
        if (!val) return true;
        if (!LOGO_FILENAME_REGEX.test(val)) return false;
        const fullPath = path.join(process.cwd(), "uploads", "logo", val);
        return fs.existsSync(fullPath);
      },
      {
        message: "Tên file logo không hợp lệ hoặc file không tồn tại trong thư mục uploads/logo",
      },
    )
    .optional(),
  wifiSsid: z.string().max(100).optional(),
  wifiPassword: z.string().max(100).optional(),
  wifiSecurity: z.string().max(50).optional(),
  drawerEnabled: z.boolean().optional(),
});

/**
 * GET /api/v1/settings/printers
 * Returns printing and store configuration.
 * Point 6: QUAN_LY sees all. Other roles receive only public store metadata.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const settings = await getPrinterSettings();

    // Point 6: Non-managers only receive non-sensitive UI settings
    if (auth.user.role !== "QUAN_LY") {
      return NextResponse.json({
        ok: true,
        data: {
          paperWidth: settings.paperWidth,
          drawerEnabled: settings.drawerEnabled,
          storeName: settings.storeName,
        },
      });
    }

    return NextResponse.json({ ok: true, data: settings });
  } catch (error) {
    console.error("Failed to get printer settings:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi lấy cấu hình máy in" },
      { status: 500 },
    );
  }
}

/**
 * PUT /api/v1/settings/printers
 * Updates printer and store configuration. Only QUAN_LY is authorized.
 */
export async function PUT(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const rawBody = await req.json().catch(() => null);
  if (!rawBody || typeof rawBody !== "object") {
    return NextResponse.json(
      { ok: false, error: "Dữ liệu JSON không hợp lệ" },
      { status: 400 },
    );
  }

  const parsed = updatePrintersSchema.safeParse(rawBody);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json(
      { ok: false, error: firstIssue?.message || "Dữ liệu cấu hình không hợp lệ" },
      { status: 400 },
    );
  }

  try {
    const updated = await savePrinterSettings(parsed.data);
    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    console.error("Failed to save printer settings:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi lưu cấu hình máy in" },
      { status: 500 },
    );
  }
}
