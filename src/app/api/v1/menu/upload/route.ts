import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";
import { requireRole } from "@/server/auth/require-role";

const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB
const ALLOWED_MIME_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
const ALLOWED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

/**
 * POST /api/v1/menu/upload
 * Handles menu item image upload.
 * Strictly requires QUAN_LY. Validates file size (max 2MB) and type (PNG, JPG, WEBP).
 */
export async function POST(req: NextRequest) {
  const auth = await requireRole(req, "QUAN_LY");
  if (!auth.authorized) {
    return auth.response;
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file || typeof file === "string") {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy file tải lên" },
        { status: 400 },
      );
    }

    // 1. Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { ok: false, error: "Dung lượng ảnh vượt quá giới hạn 2MB" },
        { status: 400 },
      );
    }

    // 2. Check file type
    const mimeType = file.type.toLowerCase();
    const originalExt = path.extname(file.name).toLowerCase();

    if (!ALLOWED_MIME_TYPES.has(mimeType) || !ALLOWED_EXTENSIONS.has(originalExt)) {
      return NextResponse.json(
        { ok: false, error: "Định dạng ảnh không hợp lệ. Chỉ chấp nhận PNG, JPG, WEBP" },
        { status: 400 },
      );
    }

    // 3. Ensure uploads/menu directory exists
    const uploadsDir = path.resolve(process.cwd(), "uploads", "menu");
    await fs.mkdir(uploadsDir, { recursive: true });

    // 4. Generate secure random filename
    const ext = originalExt === ".jpeg" ? ".jpg" : originalExt;
    const randomHex = crypto.randomBytes(6).toString("hex");
    const safeFilename = `${Date.now()}-${randomHex}${ext}`;
    const targetFilePath = path.join(uploadsDir, safeFilename);

    // 5. Write file to disk
    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(targetFilePath, buffer);

    const publicUrl = `/api/v1/menu/images/${safeFilename}`;

    return NextResponse.json(
      {
        ok: true,
        data: {
          url: publicUrl,
          filename: safeFilename,
        },
      },
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
