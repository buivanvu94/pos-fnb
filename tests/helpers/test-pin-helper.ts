import { inArray } from "drizzle-orm";
import * as schema from "@/db/schema";

/**
 * Generates a random unique safe PIN that complies with pin-policy:
 * - 4 digits
 * - Not identical digits
 * - Not sequential ascending or descending
 * - Not repeating pairs (1212, 1122)
 * - Not a birth year (1950 - 2030)
 * - Not in trivial blacklist
 */
export function generateSafeTestPin(): string {
  while (true) {
    const num = Math.floor(Math.random() * (9876 - 2031 + 1)) + 2031;
    const pin = String(num);
    if (pin.length !== 4) continue;
    if (/^(\d)\1+$/.test(pin)) continue;

    let isAsc = true;
    let isDesc = true;
    for (let i = 1; i < 4; i++) {
      if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) + 1) isAsc = false;
      if (pin.charCodeAt(i) !== pin.charCodeAt(i - 1) - 1) isDesc = false;
    }
    if (isAsc || isDesc) continue;

    if (pin.slice(0, 2) === pin.slice(2, 4)) continue;
    if (pin[0] === pin[1] && pin[2] === pin[3]) continue;
    if (num >= 1950 && num <= 2030) continue;
    if (["1234", "0000", "1111"].includes(pin)) continue;

    return pin;
  }
}

/**
 * Resets pinHash to null for specified manager users in tests.
 * Prevents manager PIN collisions and ordering discrepancies across test runs.
 */
export async function clearManagerPinHash(
  db: any,
  managerIds: number | number[],
): Promise<void> {
  const ids = Array.isArray(managerIds) ? managerIds : [managerIds];
  if (!db || ids.length === 0) return;
  await db
    .update(schema.users)
    .set({ pinHash: null })
    .where(inArray(schema.users.id, ids));
}
