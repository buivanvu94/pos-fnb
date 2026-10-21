import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireRole } from "@/server/auth/require-role";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const MAX_CONTENT_LENGTH = MAX_FILE_SIZE + 32 * 1024; // 2MB + multipart overhead

function detectImageMagicBytes(buffer: Buffer): "png" | "jpg" | "webp" | null {
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
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString("ascii") === "RIFF" &&
    buffer.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  // Early 2MB limit check via Content-Length header (413 Payload Too Large)
  const contentLength = req.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_CONTENT_LENGTH) {
    return NextResponse.json(
      { ok: false, error: "Dung lượng ảnh vượt quá giới hạn 2MB (413 Payload Too Large)" },
      { status: 413 },
    );
  }

  try {
    const formData = await req.formData().catch(() => null);
    if (!formData) {
      return NextResponse.json(
        { ok: false, error: "Dữ liệu form không hợp lệ" },
        { status: 400 },
      );
    }

    const file = formData.get("file") as File | null;
    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy file tải lên" },
        { status: 400 },
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Dung lượng ảnh vượt quá giới hạn 2MB" },
        { status: 400 },
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const realExt = detectImageMagicBytes(buffer);
    if (!realExt) {
      return NextResponse.json(
        { ok: false, error: "Nội dung file không phải là ảnh hợp lệ (chỉ chấp nhận PNG, JPG, WEBP)" },
        { status: 400 },
      );
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads", "menu");
    await fs.mkdir(uploadsDir, { recursive: true });

    const randomHex = crypto.randomBytes(6).toString("hex");
    const safeFilename = `${Date.now()}-${randomHex}.${realExt}`;
    const targetFilePath = path.join(uploadsDir, safeFilename);

    await fs.writeFile(targetFilePath, buffer);

    const publicUrl = `/api/v1/menu/images/${safeFilename}`;
    return NextResponse.json(
      { ok: true, data: { url: publicUrl, filename: safeFilename } },
      { status: 201 },
    );
  } catch (error) {
    console.error("Failed to upload menu image:", error);
    return NextResponse.json(
      { ok: false, error: "Không thể xử lý tải lên ảnh" },
      { status: 500 },
    );
  }
}
