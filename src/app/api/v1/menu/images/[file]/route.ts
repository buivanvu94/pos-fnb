import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface RouteContext {
  params: Promise<{ file: string }>;
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
};

const FILENAME_REGEX = /^\d+-[0-9a-f]{12}\.(png|jpg|webp)$/;

export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { file: rawFile } = await context.params;
    if (!rawFile) {
      return NextResponse.json({ ok: false, error: "Tên file không hợp lệ" }, { status: 400 });
    }

    let decoded: string;
    try {
      decoded = decodeURIComponent(rawFile);
    } catch {
      return NextResponse.json({ ok: false, error: "Tên file không hợp lệ" }, { status: 400 });
    }

    // 1. Explicit path traversal check
    if (
      decoded.includes("..") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.toLowerCase().includes("%2e") ||
      decoded.toLowerCase().includes("%2f") ||
      decoded.toLowerCase().includes("%5c")
    ) {
      return NextResponse.json(
        { ok: false, error: "Đường dẫn không hợp lệ (Path Traversal detected)" },
        { status: 400 },
      );
    }

    // 2. Whitelist filename regex
    if (!FILENAME_REGEX.test(decoded)) {
      return NextResponse.json({ ok: false, error: "Không tìm thấy ảnh" }, { status: 404 });
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads", "menu");
    const resolvedPath = path.resolve(uploadsDir, decoded);

    if (!resolvedPath.startsWith(uploadsDir + path.sep)) {
      return NextResponse.json(
        { ok: false, error: "Đường dẫn không hợp lệ (Path Traversal detected)" },
        { status: 400 },
      );
    }

    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return NextResponse.json({ ok: false, error: "Không tìm thấy ảnh" }, { status: 404 });
      }
    } catch {
      return NextResponse.json({ ok: false, error: "Không tìm thấy ảnh" }, { status: 404 });
    }

    const buffer = await fs.readFile(resolvedPath);
    const ext = path.extname(decoded).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Failed to serve menu image:", error);
    return NextResponse.json({ ok: false, error: "Lỗi máy chủ khi đọc ảnh" }, { status: 500 });
  }
}
