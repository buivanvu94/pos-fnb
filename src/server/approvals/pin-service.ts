import bcrypt from "bcryptjs";
import { eq, and, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { ERROR_CATALOG } from "@/lib/error-catalog";
import { logAudit } from "./audit-log-service";
import type { PinVerifyResult, ManagerInfo } from "./approval-types";

export const PIN_LOCKOUT_MINUTES = 5;
export const MAX_PIN_FAILURES = 5;

/**
 * Validates Manager PIN for sensitive actions (FR-10, BR-04, ERR-02, ERR-03).
 * Counter and lockout reside on the acting user record.
 * Executes in an independent committed transaction so outer business rollbacks
 * cannot erase failed attempts or lockout status.
 */
export async function verifyManagerPin(
  actingUserId: number,
  pin: string,
  clientIp?: string,
): Promise<PinVerifyResult> {
  return await db.transaction(async (tx) => {
    const [actingUser] = await tx
      .select({
        id: users.id,
        pinFailedCount: users.pinFailedCount,
        pinLockedUntil: users.pinLockedUntil,
      })
      .from(users)
      .where(eq(users.id, actingUserId))
      .limit(1)
      .for("update");

    if (!actingUser) {
      return {
        valid: false,
        locked: false,
        status: 403,
        error: ERROR_CATALOG.ERR_02.message,
      };
    }

    const now = new Date();

    // 1. Check if user is currently locked out
    if (actingUser.pinLockedUntil && actingUser.pinLockedUntil.getTime() > now.getTime()) {
      return {
        valid: false,
        locked: true,
        status: 429,
        error: ERROR_CATALOG.ERR_03.message,
      };
    }

    // 2. Lockout has expired: reset failed count to 0
    let currentFailedCount = actingUser.pinFailedCount;
    if (actingUser.pinLockedUntil && actingUser.pinLockedUntil.getTime() <= now.getTime()) {
      currentFailedCount = 0;
    }

    // 3. Format check: PIN must be 4 to 6 digits
    const pinRegex = /^\d{4,6}$/;
    let matchedManager: ManagerInfo | null = null;

    if (pinRegex.test(pin)) {
      const activeManagers = await tx
        .select({
          id: users.id,
          username: users.username,
          fullName: users.fullName,
          pinHash: users.pinHash,
        })
        .from(users)
        .where(and(eq(users.role, "QUAN_LY"), isNotNull(users.pinHash)));

      for (const mgr of activeManagers) {
        if (mgr.pinHash && (await bcrypt.compare(pin, mgr.pinHash))) {
          matchedManager = {
            id: mgr.id,
            username: mgr.username,
            fullName: mgr.fullName,
          };
          break;
        }
      }
    }

    // 4. Correct PIN: Reset failure counter and clear lock
    if (matchedManager) {
      await tx
        .update(users)
        .set({
          pinFailedCount: 0,
          pinLockedUntil: null,
          updatedAt: now,
        })
        .where(eq(users.id, actingUserId));

      return {
        valid: true,
        approver: matchedManager,
      };
    }

    // 5. Wrong PIN: Increment counter atomically
    const nextFailedCount = currentFailedCount + 1;
    const isLocked = nextFailedCount >= MAX_PIN_FAILURES;
    const lockedUntil = isLocked
      ? new Date(now.getTime() + PIN_LOCKOUT_MINUTES * 60 * 1000)
      : null;

    await tx
      .update(users)
      .set({
        pinFailedCount: nextFailedCount,
        pinLockedUntil: lockedUntil,
        updatedAt: now,
      })
      .where(eq(users.id, actingUserId));

    // Audit failed attempt
    await logAudit(
      {
        userId: actingUserId,
        action: "PIN_FAILED",
        entityType: "users",
        entityId: actingUserId,
        reason: `Nhập sai mã PIN (lần ${nextFailedCount})`,
        metadata: { failedCount: nextFailedCount },
        ipAddress: clientIp,
      },
      tx,
    );

    if (isLocked) {
      await logAudit(
        {
          userId: actingUserId,
          action: "PIN_LOCKED",
          entityType: "users",
          entityId: actingUserId,
          reason: "Khóa chức năng nhập mã PIN trong 5 phút do sai quá 5 lần",
          metadata: {
            failedCount: nextFailedCount,
            lockedUntil: lockedUntil?.toISOString(),
          },
          ipAddress: clientIp,
        },
        tx,
      );

      return {
        valid: false,
        locked: true,
        status: 429,
        error: ERROR_CATALOG.ERR_03.message,
      };
    }

    return {
      valid: false,
      locked: false,
      status: 403,
      error: ERROR_CATALOG.ERR_02.message,
    };
  });
}
