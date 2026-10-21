import crypto from "crypto";

/**
 * Shared code generator helper for menu items and categories.
 * Generates compact, collision-resistant codes within 20 chars (varchar(20)).
 */
export function generateItemCode(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `MON-${time}-${rand}`.slice(0, 20);
}

export function generateCategoryCode(): string {
  const time = Date.now().toString(36).toUpperCase();
  const rand = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `CAT-${time}-${rand}`.slice(0, 20);
}
