import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { db } from "@/db";
import { shifts, Shift } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { AUTH_COOKIE_NAME, verifyAuthToken, TokenPayload } from "@/server/auth/jwt";

export interface OpenShiftResultSuccess {
  authorized: true;
  user: TokenPayload;
  shift: Shift;
}

export interface OpenShiftResultFailure {
  authorized: false;
  response: NextResponse;
}

export type RequireOpenShiftResult =
  | OpenShiftResultSuccess
  | OpenShiftResultFailure;

/**
 * Finds an active shift (status = 'DANG_MO') for a specific cashier user.
 */
export async function getActiveShift(userId: number): Promise<Shift | null> {
  const [activeShift] = await db
    .select()
    .from(shifts)
    .where(and(eq(shifts.cashierId, userId), eq(shifts.status, "DANG_MO")))
    .limit(1);

  return activeShift ?? null;
}

/**
 * Finds any active shift ('DANG_MO') currently open in the store.
 * For PHUC_VU role: waiters cannot open shifts per permission matrix,
 * but can access table diagram / orders as long as ANY active shift is open (BR-01).
 */
export async function getAnyActiveShift(): Promise<Shift | null> {
  const [anyShift] = await db
    .select()
    .from(shifts)
    .where(eq(shifts.status, "DANG_MO"))
    .limit(1);

  return anyShift ?? null;
}

export const shiftLookup = {
  getActiveShift,
  getAnyActiveShift,
};

/**
 * Shared guard for API route handlers (FR-06, BR-01, ERR-01, AC-01-2).
 * Verifies authenticated session and checks shift status:
 * - For PHUC_VU: requires at least one active shift in the store.
 * - For QUAN_LY and THU_NGAN: requires an active shift belonging to the user.
 * Returns verbatim ERR-01 message with HTTP 400 on failure.
 *
 * @param req - Incoming NextRequest
 * @returns Result object with authorized user + shift or error response
 */
export async function requireOpenShift(req: NextRequest): Promise<RequireOpenShiftResult> {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: "Yêu cầu đăng nhập để truy cập tài nguyên này (401)" },
        { status: 401 },
      ),
    };
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    return {
      authorized: false,
      response: NextResponse.json(
        { ok: false, error: "Phiên đăng nhập không hợp lệ hoặc đã hết hạn (401)" },
        { status: 401 },
      ),
    };
  }

  // Evaluate active shift according to role
  const shift =
    user.role === "PHUC_VU"
      ? await shiftLookup.getAnyActiveShift()
      : await shiftLookup.getActiveShift(user.userId);

  if (!shift) {
    return {
      authorized: false,
      response: NextResponse.json(
        {
          ok: false,
          code: ERROR_CATALOG.ERR_01.id,
          error: ERROR_CATALOG.ERR_01.message,
        },
        { status: 400 },
      ),
    };
  }

  return {
    authorized: true,
    user,
    shift,
  };
}

/**
 * Server Component guard for POS pages (e.g. /tables, /counter).
 * Inspects request cookies, validates the active shift, and triggers
 * server-side redirect to /open-shift if conditions are not met (BR-01, ERR-01).
 *
 * @returns Current user and active shift
 */
export async function requireOpenShiftPage(): Promise<{ user: TokenPayload; shift: Shift }> {
  const cookieStore = await cookies();
  const token = cookieStore.get(AUTH_COOKIE_NAME)?.value;

  if (!token) {
    redirect("/login");
  }

  const user = await verifyAuthToken(token);
  if (!user) {
    redirect("/login");
  }

  const shift =
    user.role === "PHUC_VU"
      ? await shiftLookup.getAnyActiveShift()
      : await shiftLookup.getActiveShift(user.userId);

  if (!shift) {
    redirect("/open-shift");
  }

  return { user, shift };
}
