import { NextRequest, NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

interface RouteContext {
  params: Promise<{ file: string }>;
}

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};

/**
 * GET /api/v1/menu/images/:file
 * Serves uploaded menu item images with strict anti-path-traversal protection.
 */
export async function GET(req: NextRequest, context: RouteContext) {
  try {
    const { file: rawFile } = await Promise.resolve(context.params);
    if (!rawFile) {
      return NextResponse.json(
        { ok: false, error: "Tên file không hợp lệ" },
        { status: 400 },
      );
    }

    const decoded = decodeURIComponent(rawFile);

    // 1. Path traversal checks
    if (
      decoded.includes("..") ||
      decoded.includes("/") ||
      decoded.includes("\\") ||
      decoded.includes("\0") ||
      decoded.includes("%2e") ||
      decoded.includes("%2f")
    ) {
      return NextResponse.json(
        { ok: false, error: "Đường dẫn không hợp lệ (Path Traversal detected)" },
        { status: 400 },
      );
    }

    const uploadsDir = path.resolve(process.cwd(), "uploads", "menu");
    const resolvedPath = path.resolve(uploadsDir, decoded);

    // Ensure resolved path is strictly inside uploadsDir
    if (
      !resolvedPath.startsWith(uploadsDir + path.sep) &&
      resolvedPath !== uploadsDir
    ) {
      return NextResponse.json(
        { ok: false, error: "Đường dẫn không hợp lệ (Path Traversal detected)" },
        { status: 400 },
      );
    }

    // 2. Check file existence
    try {
      const stat = await fs.stat(resolvedPath);
      if (!stat.isFile()) {
        return NextResponse.json(
          { ok: false, error: "Không tìm thấy ảnh" },
          { status: 404 },
        );
      }
    } catch {
      return NextResponse.json(
        { ok: false, error: "Không tìm thấy ảnh" },
        { status: 404 },
      );
    }

    // 3. Read and stream file with appropriate mime type
    const buffer = await fs.readFile(resolvedPath);
    const ext = path.extname(decoded).toLowerCase();
    const contentType = MIME_MAP[ext] || "application/octet-stream";

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });
  } catch (error) {
    console.error("Failed to serve menu image:", error);
    return NextResponse.json(
      { ok: false, error: "Lỗi máy chủ khi đọc ảnh" },
      { status: 500 },
    );
  }
}
