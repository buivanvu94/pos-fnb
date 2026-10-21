import { eq } from "drizzle-orm";
import { db } from "@/db";
import { settings } from "@/db/schema";

export const APPROVAL_PIN_REQUIRED_KEY = "approval.pinRequired";

/**
 * Checks whether Manager PIN approval is globally required.
 * Defaults to true (per SRS Section 10).
 */
export async function isPinRequired(): Promise<boolean> {
  const [row] = await db
    .select({ value: settings.value })
    .from(settings)
    .where(eq(settings.key, APPROVAL_PIN_REQUIRED_KEY))
    .limit(1);

  if (!row) {
    return true; // Default true per SRS 10
  }
  return row.value !== "false";
}

/**
 * Sets whether Manager PIN approval is required.
 * Only intended for testing environments.
 */
export async function setPinRequired(required: boolean): Promise<void> {
  const value = required ? "true" : "false";
  const [existing] = await db
    .select({ id: settings.id })
    .from(settings)
    .where(eq(settings.key, APPROVAL_PIN_REQUIRED_KEY))
    .limit(1);

  if (existing) {
    await db
      .update(settings)
      .set({
        value,
        updatedAt: new Date(),
      })
      .where(eq(settings.key, APPROVAL_PIN_REQUIRED_KEY));
  } else {
    await db.insert(settings).values({
      key: APPROVAL_PIN_REQUIRED_KEY,
      value,
      description: "Yêu cầu mã PIN Quản lý khi thao tác nhạy cảm (SRS 10)",
    });
  }
}
