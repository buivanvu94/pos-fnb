import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as uploadImageHandler } from "@/app/api/v1/menu/upload/route";
import { GET as getImageHandler } from "@/app/api/v1/menu/images/[file]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Menu Images API & Path Traversal Security", () => {
  const getTokens = async () => {
    const managerToken = await signAuthToken({ userId: 1, username: "quanly", fullName: "Quản Lý", role: "QUAN_LY" });
    const waiterToken = await signAuthToken({ userId: 3, username: "phucvu", fullName: "Phục Vụ", role: "PHUC_VU" });
    return { managerToken, waiterToken };
  };

  it("blocks path traversal attempts and malformed URIs on image route", async () => {
    // 1. Double dot traversal
    const res1 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/..%2F..%2Fpackage.json"), {
      params: Promise.resolve({ file: "..%2F..%2Fpackage.json" }),
    });
    expect(res1.status).toBe(400);

    // 2. Traversal with %2e%2e
    const res2 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/%2e%2e/%2e%2e/etc/passwd"), {
      params: Promise.resolve({ file: "%2e%2e/%2e%2e/etc/passwd" }),
    });
    expect(res2.status).toBe(400);

    // 3. Backslash traversal
    const res3 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/..\\..\\windows\\win.ini"), {
      params: Promise.resolve({ file: "..\\..\\windows\\win.ini" }),
    });
    expect(res3.status).toBe(400);

    // 4. Malformed URI component
    const res4 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/%E0%A4%A"), {
      params: Promise.resolve({ file: "%E0%A4%A" }),
    });
    expect(res4.status).toBe(400);
  });

  it("returns 404 for non-existent image or non-matching filename format", async () => {
    const res1 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/fake.png"), {
      params: Promise.resolve({ file: "fake.png" }),
    });
    expect(res1.status).toBe(404);

    const res2 = await getImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/images/1700000000000-abcdef123456.png"), {
      params: Promise.resolve({ file: "1700000000000-abcdef123456.png" }),
    });
    expect(res2.status).toBe(404);
  });

  it("rejects unauthorized and non-manager image upload", async () => {
    const { waiterToken } = await getTokens();

    const unauthRes = await uploadImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/upload", { method: "POST" }));
    expect(unauthRes.status).toBe(401);

    const waiterReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    expect((await uploadImageHandler(waiterReq)).status).toBe(403);
  });

  it("rejects files disguised as png but containing HTML (magic bytes check)", async () => {
    const { managerToken } = await getTokens();

    const fakeForm = new FormData();
    const fakeFile = new File(["<html><body>Fake image</body></html>"], "hacker.png", { type: "image/png" });
    fakeForm.append("file", fakeFile);

    const req = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: fakeForm,
    });
    const res = await uploadImageHandler(req);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toContain("Nội dung file không phải là ảnh hợp lệ");
  });

  it("enforces early 2MB limit via Content-Length (413) and file.size check", async () => {
    const { managerToken } = await getTokens();

    // Early Content-Length check
    const bigHeaderReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: {
        Cookie: `${AUTH_COOKIE_NAME}=${managerToken}`,
        "content-length": String(3 * 1024 * 1024),
      },
    });
    const earlyRes = await uploadImageHandler(bigHeaderReq);
    expect(earlyRes.status).toBe(413);

    // Actual file.size check
    const bigFormData = new FormData();
    const bigBlob = new Blob([new Uint8Array(2 * 1024 * 1024 + 100)], { type: "image/png" });
    bigFormData.append("file", new File([bigBlob], "big.png", { type: "image/png" }));

    const req = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: bigFormData,
    });
    const res = await uploadImageHandler(req);
    expect(res.status).toBe(400);
    expect((await res.json()).error).toContain("vượt quá giới hạn 2MB");
  });

  it("uploads valid PNG and serves it with nosniff header", async () => {
    const { managerToken } = await getTokens();

    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    ]);
    const formData = new FormData();
    formData.append("file", new File([pngHeader], "sample.png", { type: "image/png" }));

    const uploadRes = await uploadImageHandler(new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: formData,
    }));
    expect(uploadRes.status).toBe(201);
    const uploadData = await uploadRes.json();
    expect(uploadData.data.url).toMatch(/^\/api\/v1\/menu\/images\/\d+-[0-9a-f]{12}\.png$/);

    const filename = uploadData.data.filename;
    const fetchRes = await getImageHandler(new NextRequest(`http://localhost:3000/api/v1/menu/images/${filename}`), {
      params: Promise.resolve({ file: filename }),
    });
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.headers.get("Content-Type")).toBe("image/png");
    expect(fetchRes.headers.get("X-Content-Type-Options")).toBe("nosniff");
  });
});
