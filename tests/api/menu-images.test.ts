import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { POST as uploadImageHandler } from "@/app/api/v1/menu/upload/route";
import { GET as getImageHandler } from "@/app/api/v1/menu/images/[file]/route";
import { signAuthToken, AUTH_COOKIE_NAME } from "@/server/auth/jwt";

describe("Menu Images API & Path Traversal Security", () => {
  const getTokens = async () => {
    const managerToken = await signAuthToken({
      userId: 1,
      username: "quanly",
      fullName: "Quản Lý",
      role: "QUAN_LY",
    });
    const waiterToken = await signAuthToken({
      userId: 3,
      username: "phucvu",
      fullName: "Phục Vụ",
      role: "PHUC_VU",
    });
    return { managerToken, waiterToken };
  };

  it("blocks path traversal attempts on image route with 400", async () => {
    // 1. Double dot traversal
    const req1 = new NextRequest("http://localhost:3000/api/v1/menu/images/..%2F..%2Fpackage.json");
    const res1 = await getImageHandler(req1, {
      params: Promise.resolve({ file: "..%2F..%2Fpackage.json" }),
    });
    expect(res1.status).toBe(400);
    const data1 = await res1.json();
    expect(data1.error).toContain("Path Traversal detected");

    // 2. Direct slashes in param
    const req2 = new NextRequest("http://localhost:3000/api/v1/menu/images/etc/passwd");
    const res2 = await getImageHandler(req2, {
      params: Promise.resolve({ file: "etc/passwd" }),
    });
    expect(res2.status).toBe(400);

    // 3. Backslash traversal
    const req3 = new NextRequest("http://localhost:3000/api/v1/menu/images/..\\..\\windows\\win.ini");
    const res3 = await getImageHandler(req3, {
      params: Promise.resolve({ file: "..\\..\\windows\\win.ini" }),
    });
    expect(res3.status).toBe(400);
  });

  it("returns 404 for non-existent image", async () => {
    const req = new NextRequest("http://localhost:3000/api/v1/menu/images/non-existent-12345.png");
    const res = await getImageHandler(req, {
      params: Promise.resolve({ file: "non-existent-12345.png" }),
    });
    expect(res.status).toBe(404);
  });

  it("rejects unauthorized and non-manager image upload", async () => {
    const { waiterToken } = await getTokens();

    // 1. Unauthenticated -> 401
    const unauthReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
    });
    const unauthRes = await uploadImageHandler(unauthReq);
    expect(unauthRes.status).toBe(401);

    // 2. Phục vụ -> 403
    const waiterReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${waiterToken}` },
    });
    const waiterRes = await uploadImageHandler(waiterReq);
    expect(waiterRes.status).toBe(403);
  });

  it("rejects files exceeding 2MB limit or having invalid mime type", async () => {
    const { managerToken } = await getTokens();

    // 1. Invalid mime type (text/plain)
    const badTypeFormData = new FormData();
    const badFile = new File(["dummy text"], "test.txt", { type: "text/plain" });
    badTypeFormData.append("file", badFile);

    const badTypeReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: badTypeFormData,
    });
    const badTypeRes = await uploadImageHandler(badTypeReq);
    expect(badTypeRes.status).toBe(400);
    const badTypeData = await badTypeRes.json();
    expect(badTypeData.error).toContain("Chỉ chấp nhận PNG, JPG, WEBP");

    // 2. Exceeding 2MB
    const bigFormData = new FormData();
    const bigBlob = new Blob([new Uint8Array(2 * 1024 * 1024 + 100)], { type: "image/png" });
    const bigFile = new File([bigBlob], "big.png", { type: "image/png" });
    bigFormData.append("file", bigFile);

    const bigReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: bigFormData,
    });
    const bigRes = await uploadImageHandler(bigReq);
    expect(bigRes.status).toBe(400);
    const bigData = await bigRes.json();
    expect(bigData.error).toContain("vượt quá giới hạn 2MB");
  });

  it("successfully uploads valid PNG and serves it back via GET route", async () => {
    const { managerToken } = await getTokens();

    // Small 1x1 PNG transparent pixel
    const pngHeader = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
      0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
      0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
      0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89,
    ]);
    const validFile = new File([pngHeader], "sample.png", { type: "image/png" });
    const formData = new FormData();
    formData.append("file", validFile);

    const uploadReq = new NextRequest("http://localhost:3000/api/v1/menu/upload", {
      method: "POST",
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${managerToken}` },
      body: formData,
    });
    const uploadRes = await uploadImageHandler(uploadReq);
    expect(uploadRes.status).toBe(201);
    const uploadData = await uploadRes.json();
    expect(uploadData.ok).toBe(true);
    expect(uploadData.data.url).toMatch(/^\/api\/v1\/menu\/images\/.+\.png$/);

    const filename = uploadData.data.filename;
    const fetchReq = new NextRequest(`http://localhost:3000/api/v1/menu/images/${filename}`);
    const fetchRes = await getImageHandler(fetchReq, {
      params: Promise.resolve({ file: filename }),
    });
    expect(fetchRes.status).toBe(200);
    expect(fetchRes.headers.get("Content-Type")).toBe("image/png");
  });
});
