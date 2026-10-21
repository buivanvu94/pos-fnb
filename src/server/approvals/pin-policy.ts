import bcrypt from "bcryptjs";
import { eq, and, ne, isNotNull } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";

export interface PinPolicyValidationResult {
  valid: boolean;
  error?: string;
}

/**
 * Validates PIN complexity according to POS security policy:
 * - 4 to 6 numeric digits
 * - Rejects trivial patterns (identical digits, sequential, repetitive pairs)
 * - Rejects birth years (1950 - 2030 for 4-digit PINs)
 * - Rejects PIN collisions with any other active manager
 */
export async function validatePinPolicy(
  newPin: string,
  userId: number,
): Promise<PinPolicyValidationResult> {
  if (!/^\d{4,6}$/.test(newPin)) {
    return { valid: false, error: "Mã PIN phải từ 4 đến 6 chữ số" };
  }

  // 1. Identical digits: e.g. 0000, 1111, 2222, 111111
  if (/^(\d)\1+$/.test(newPin)) {
    return {
      valid: false,
      error: "Mã PIN không được chứa các chữ số hoàn toàn giống nhau",
    };
  }

  // 2. Sequential numbers: e.g. 1234, 4321, 123456, 654321
  let isAscending = true;
  let isDescending = true;
  for (let i = 1; i < newPin.length; i++) {
    if (newPin.charCodeAt(i) !== newPin.charCodeAt(i - 1) + 1) isAscending = false;
    if (newPin.charCodeAt(i) !== newPin.charCodeAt(i - 1) - 1) isDescending = false;
  }
  if (isAscending || isDescending) {
    return {
      valid: false,
      error: "Mã PIN không được là dãy số tăng hoặc giảm liên tiếp",
    };
  }

  // 3. Repeating patterns: e.g. 1212, 1122, 121212, 112233, 123123
  if (newPin.length === 4) {
    if (newPin.slice(0, 2) === newPin.slice(2, 4) || (newPin[0] === newPin[1] && newPin[2] === newPin[3])) {
      return { valid: false, error: "Mã PIN không được chứa các cặp số lặp lại" };
    }
  } else if (newPin.length === 6) {
    if (
      (newPin.slice(0, 2) === newPin.slice(2, 4) && newPin.slice(2, 4) === newPin.slice(4, 6)) ||
      newPin.slice(0, 3) === newPin.slice(3, 6) ||
      (newPin[0] === newPin[1] && newPin[2] === newPin[3] && newPin[4] === newPin[5])
    ) {
      return { valid: false, error: "Mã PIN không được chứa các mẫu số lặp lại" };
    }
  }

  // 4. Birth years (1950 - 2030)
  if (newPin.length === 4) {
    const yearVal = parseInt(newPin, 10);
    if (yearVal >= 1950 && yearVal <= 2030) {
      return { valid: false, error: "Không được sử dụng năm sinh (1950 - 2030) làm mã PIN" };
    }
  }

  // 5. Explicit trivial blacklist
  const trivialPins = ["1234", "0000", "1111", "123456", "654321", "112233"];
  if (trivialPins.includes(newPin)) {
    return { valid: false, error: "Mã PIN quá đơn giản hoặc dễ đoán" };
  }

  // 6. Collision check with other managers' existing PINs
  const otherManagers = await db
    .select({
      id: users.id,
      pinHash: users.pinHash,
    })
    .from(users)
    .where(
      and(
        eq(users.role, "QUAN_LY"),
        ne(users.id, userId),
        isNotNull(users.pinHash),
      ),
    );

  for (const mgr of otherManagers) {
    if (mgr.pinHash && (await bcrypt.compare(newPin, mgr.pinHash))) {
      return {
        valid: false,
        error: "Mã PIN này đã được sử dụng bởi một quản lý khác. Vui lòng chọn mã PIN khác.",
      };
    }
  }

  return { valid: true };
}
