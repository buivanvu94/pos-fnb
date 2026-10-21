import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireRole } from "@/server/auth/require-role";
import {
  getPrinterSettings,
  savePrinterSettings,
  isPrivateOrLoopbackIp,
} from "@/server/printing/settings-service";

const updatePrintersSchema = z.object({
  kitchenIp: z
    .string()
    .trim()
    .refine((ip) => isPrivateOrLoopbackIp(ip), {
      message: "IP máy in bếp không hợp lệ hoặc nằm ngoài dải mạng riêng (RFC1918 / Loopback) nhằm chống SSRF",
    })
    .optional(),
  barIp: z
    .string()
    .trim()
    .refine((ip) => isPrivateOrLoopbackIp(ip), {
      message: "IP máy in bar không hợp lệ hoặc nằm ngoài dải mạng riêng (RFC1918 / Loopback) nhằm chống SSRF",
    })
    .optional(),
  receiptIp: z
    .string()
    .trim()
    .refine((ip) => isPrivateOrLoopbackIp(ip), {
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
  storeLogo: z.string().max(255).optional(),
  wifiSsid: z.string().max(100).optional(),
  wifiPassword: z.string().max(100).optional(),
  wifiSecurity: z.string().max(50).optional(),
  drawerEnabled: z.boolean().optional(),
});

/**
 * GET /api/v1/settings/printers
 * Returns current printing and store configuration.
 */
export async function GET(req: NextRequest) {
  const auth = await requireRole(req);
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const settings = await getPrinterSettings();
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
 * Strictly verifies IPv4 addresses against RFC1918 / Loopback to block SSRF.
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
    console.error("Failed to update printer settings:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi cập nhật cấu hình máy in" },
      { status: 500 },
    );
  }
}
