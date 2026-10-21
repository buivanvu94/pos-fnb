import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireRole } from "@/server/auth/require-role";
import { savePrinterSettings } from "@/server/printing/settings-service";

const MAX_LOGO_SIZE = 1 * 1024 * 1024; // 1MB

function detectLogoMagicBytes(buffer: Buffer): "png" | "jpg" | null {
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "png";
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return "jpg";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_LOGO_SIZE + 32 * 1024) {
    return NextResponse.json(
      { ok: false, error: "Dung lượng logo vượt quá giới hạn 1MB" },
      { status: 413 },
    );
  }

  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu biểu mẫu không hợp lệ" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy file logo tải lên" },
        { status: 400 },
      );
    }

    if (file.size > MAX_LOGO_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Dung lượng logo vượt quá giới hạn 1MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const realExt = detectLogoMagicBytes(buffer);
    if (!realExt) {
      return NextResponse.json(
        { ok: false, error: "Định dạng file không hợp lệ (chỉ chấp nhận ảnh PNG hoặc JPG)" },
        { status: 400 },
      );
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads", "logo");
    await fs.mkdir(uploadsDir, { recursive: true });

    const randomHex = crypto.randomBytes(6).toString("hex");
    const safeFilename = `${Date.now()}-${randomHex}.${realExt}`;
    const targetFilePath = path.join(uploadsDir, safeFilename);

    await fs.writeFile(targetFilePath, buffer);

    const publicUrl = `/api/v1/settings/logo/${safeFilename}`;
    await savePrinterSettings({ storeLogo: targetFilePath });

    return NextResponse.json(
      { ok: true, data: { url: publicUrl, filename: safeFilename, path: targetFilePath } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to upload store logo:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi tải lên logo quán" },
      { status: 500 },
    );
  }
}
