import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users, type User } from "@/db/schema";
import { logAudit } from "@/server/approvals/audit-log-service";

export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCKOUT_MINUTES = 5;
const DUMMY_BCRYPT_HASH = "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy";

export const LOGIN_LOCKOUT_MESSAGE = "Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau 5 phút.";
export const INVALID_CREDENTIALS_MESSAGE = "Tên đăng nhập hoặc mật khẩu không chính xác";

export type AuthResult = { ok: true; user: User } | { ok: false; status: 401 | 429; error: string };
export type VerifyPasswordResult = { ok: true; user: User } | { ok: false; status: 400 | 429; error: string };

async function recordPasswordFailure(
  userId: number, username: string, failureReason: string,
  clientIp?: string | null, userAgent?: string | null, extraMeta?: Record<string, unknown>,
): Promise<{ isLocked: boolean }> {
  return await db.transaction(async (tx) => {
    const [user] = await tx.select({ id: users.id, loginFailedCount: users.loginFailedCount, loginLockedUntil: users.loginLockedUntil })
      .from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!user) return { isLocked: false };

    const now = new Date();
    if (user.loginLockedUntil && user.loginLockedUntil.getTime() > now.getTime()) return { isLocked: true };

    const currentFailed = user.loginLockedUntil && user.loginLockedUntil.getTime() <= now.getTime() ? 0 : user.loginFailedCount;
    const nextFailedCount = currentFailed + 1;
    const isLocked = nextFailedCount >= MAX_LOGIN_FAILURES;
    const lockedUntil = isLocked ? new Date(now.getTime() + LOGIN_LOCKOUT_MINUTES * 60 * 1000) : null;

    await tx.update(users).set({ loginFailedCount: nextFailedCount, loginLockedUntil: lockedUntil, updatedAt: now }).where(eq(users.id, user.id));

    await logAudit({
      userId: user.id, username, action: "LOGIN_FAILED", entityType: "users", entityId: user.id,
      reason: `${failureReason} (lần ${nextFailedCount})`, metadata: { failedCount: nextFailedCount, ...extraMeta },
      ipAddress: clientIp, userAgent,
    }, tx);

    if (isLocked) {
      await logAudit({
        userId: user.id, username, action: "LOGIN_LOCKED", entityType: "users", entityId: user.id,
        reason: "Khóa tài khoản 5 phút do đăng nhập sai mật khẩu quá 5 lần",
        metadata: { failedCount: nextFailedCount, lockedUntil: lockedUntil?.toISOString() },
        ipAddress: clientIp, userAgent,
      }, tx);
    }

    return { isLocked };
  });
}

async function handlePasswordCheck(
  user: User, password: string, failureReason: string,
  clientIp?: string | null, userAgent?: string | null, extraMeta?: Record<string, unknown>,
): Promise<{ ok: true; user: User } | { ok: false; isLocked: boolean }> {
  if (user.loginLockedUntil && user.loginLockedUntil.getTime() > Date.now()) {
    return { ok: false, isLocked: true };
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (isPasswordValid) {
    const [latest] = await db.select({ loginLockedUntil: users.loginLockedUntil }).from(users).where(eq(users.id, user.id)).limit(1);
    if (latest?.loginLockedUntil && latest.loginLockedUntil.getTime() > Date.now()) {
      return { ok: false, isLocked: true };
    }
    await db.update(users).set({ loginFailedCount: 0, loginLockedUntil: null, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true, user };
  }

  const { isLocked } = await recordPasswordFailure(user.id, user.username, failureReason, clientIp, userAgent, extraMeta);
  return { ok: false, isLocked };
}

/**
 * Authenticates user credentials with atomic lockout tracking per username.
 * bcrypt comparison is performed OUTSIDE database transactions to prevent connection pool exhaustion.
 */
export async function authenticateUser(
  username: string, password: string, clientIp?: string | null, userAgent?: string | null,
): Promise<AuthResult> {
  const trimmed = username.trim();
  const [user] = await db.select().from(users).where(eq(users.username, trimmed)).limit(1);

  if (!user) {
    await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
    await logAudit({
      action: "LOGIN_FAILED", entityType: "users", entityId: null,
      reason: "Đăng nhập thất bại: tên đăng nhập không tồn tại",
      metadata: { attemptedUsername: trimmed.slice(0, 100) }, ipAddress: clientIp, userAgent,
    });
    return { ok: false, status: 401, error: INVALID_CREDENTIALS_MESSAGE };
  }

  const result = await handlePasswordCheck(user, password, "Đăng nhập thất bại: sai mật khẩu", clientIp, userAgent);
  if (result.ok) return { ok: true, user: result.user };
  return result.isLocked
    ? { ok: false, status: 429, error: LOGIN_LOCKOUT_MESSAGE }
    : { ok: false, status: 401, error: INVALID_CREDENTIALS_MESSAGE };
}

/**
 * Validates current user's password for sensitive settings updates (e.g. changing PIN).
 */
export async function verifyUserPassword(
  userId: number, password: string, clientIp?: string | null, userAgent?: string | null,
): Promise<VerifyPasswordResult> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { ok: false, status: 400, error: "Tài khoản không tồn tại" };

  const result = await handlePasswordCheck(user, password, "Xác thực mật khẩu đổi PIN thất bại", clientIp, userAgent, { actionTarget: "CHANGE_PIN" });
  if (result.ok) return { ok: true, user: result.user };
  return result.isLocked
    ? { ok: false, status: 429, error: LOGIN_LOCKOUT_MESSAGE }
    : { ok: false, status: 400, error: "Mật khẩu hiện tại không chính xác" };
}
