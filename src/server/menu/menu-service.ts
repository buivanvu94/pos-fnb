import { eq, and, ilike, or, asc, sql } from "drizzle-orm";
import { db } from "@/db";
import { menuItems, categories, toppings } from "@/db/schema";
import type {
  CreateMenuItemInput,
  UpdateMenuItemInput,
  CreateCategoryInput,
  CreateToppingInput,
} from "./menu-schema";

export interface MenuFilterParams {
  categoryId?: number;
  status?: "DANG_BAN" | "HET_HANG";
  search?: string;
}

/**
 * Generate a unique code for a menu item if none provided.
 */
function generateItemCode(): string {
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `MON-${Date.now().toString().slice(-4)}${rand}`;
}

/**
 * Generate a unique category code if none provided.
 */
function generateCategoryCode(): string {
  const rand = Math.floor(100 + Math.random() * 900);
  return `CAT-${Date.now().toString().slice(-4)}${rand}`;
}

/**
 * Fetch menu items with joined category information.
 */
export async function getMenuItems(filters: MenuFilterParams = {}) {
  const conditions = [];

  if (filters.categoryId) {
    conditions.push(eq(menuItems.categoryId, filters.categoryId));
  }
  if (filters.status) {
    conditions.push(eq(menuItems.status, filters.status));
  }
  if (filters.search && filters.search.trim()) {
    const term = `%${filters.search.trim()}%`;
    conditions.push(or(ilike(menuItems.name, term), ilike(menuItems.code, term)));
  }

  const query = db
    .select({
      id: menuItems.id,
      code: menuItems.code,
      categoryId: menuItems.categoryId,
      categoryName: categories.name,
      categoryCode: categories.code,
      name: menuItems.name,
      price: menuItems.price,
      unit: menuItems.unit,
      status: menuItems.status,
      imageUrl: menuItems.imageUrl,
      targetPrinter: menuItems.targetPrinter,
      createdAt: menuItems.createdAt,
      updatedAt: menuItems.updatedAt,
    })
    .from(menuItems)
    .leftJoin(categories, eq(menuItems.categoryId, categories.id))
    .orderBy(asc(categories.displayOrder), asc(menuItems.name));

  if (conditions.length > 0) {
    return await query.where(and(...conditions));
  }
  return await query;
}

/**
 * Fetch a single menu item by ID.
 */
export async function getMenuItemById(id: number) {
  const items = await db
    .select({
      id: menuItems.id,
      code: menuItems.code,
      categoryId: menuItems.categoryId,
      categoryName: categories.name,
      categoryCode: categories.code,
      name: menuItems.name,
      price: menuItems.price,
      unit: menuItems.unit,
      status: menuItems.status,
      imageUrl: menuItems.imageUrl,
      targetPrinter: menuItems.targetPrinter,
      createdAt: menuItems.createdAt,
      updatedAt: menuItems.updatedAt,
    })
    .from(menuItems)
    .leftJoin(categories, eq(menuItems.categoryId, categories.id))
    .where(eq(menuItems.id, id))
    .limit(1);

  return items[0] || null;
}

/**
 * Create a new menu item.
 */
export async function createMenuItem(input: CreateMenuItemInput) {
  const code = input.code?.trim() || generateItemCode();

  const [created] = await db
    .insert(menuItems)
    .values({
      code,
      categoryId: input.categoryId,
      name: input.name.trim(),
      price: input.price,
      unit: input.unit?.trim() || "Phần",
      status: input.status || "DANG_BAN",
      imageUrl: input.imageUrl?.trim() || null,
      targetPrinter: input.targetPrinter || "KITCHEN",
    })
    .returning();

  return created;
}

/**
 * Update an existing menu item.
 */
export async function updateMenuItem(id: number, input: UpdateMenuItemInput) {
  const updateData: Record<string, unknown> = {
    updatedAt: sql`NOW()`,
  };

  if (input.name !== undefined) updateData.name = input.name.trim();
  if (input.price !== undefined) updateData.price = input.price;
  if (input.categoryId !== undefined) updateData.categoryId = input.categoryId;
  if (input.code !== undefined) updateData.code = input.code.trim();
  if (input.unit !== undefined) updateData.unit = input.unit.trim();
  if (input.status !== undefined) updateData.status = input.status;
  if (input.imageUrl !== undefined) updateData.imageUrl = input.imageUrl?.trim() || null;
  if (input.targetPrinter !== undefined) updateData.targetPrinter = input.targetPrinter;

  const [updated] = await db
    .update(menuItems)
    .set(updateData)
    .where(eq(menuItems.id, id))
    .returning();

  return updated || null;
}

/**
 * Update availability of an item (FR-15, BR-09).
 */
export async function updateMenuItemAvailability(
  id: number,
  status: "DANG_BAN" | "HET_HANG",
) {
  const [updated] = await db
    .update(menuItems)
    .set({
      status,
      updatedAt: sql`NOW()`,
    })
    .where(eq(menuItems.id, id))
    .returning();

  return updated || null;
}

/**
 * Categories listing and creation.
 */
export async function getCategories() {
  return await db
    .select()
    .from(categories)
    .where(eq(categories.isActive, true))
    .orderBy(asc(categories.displayOrder), asc(categories.id));
}

export async function createCategory(input: CreateCategoryInput) {
  const code = input.code?.trim() || generateCategoryCode();

  const [created] = await db
    .insert(categories)
    .values({
      code,
      name: input.name.trim(),
      displayOrder: input.displayOrder ?? 0,
      isActive: true,
    })
    .returning();

  return created;
}

/**
 * Toppings listing and creation (FR-02).
 */
export async function getToppings() {
  return await db
    .select()
    .from(toppings)
    .orderBy(asc(toppings.name));
}

export async function createTopping(input: CreateToppingInput) {
  const [created] = await db
    .insert(toppings)
    .values({
      name: input.name.trim(),
      price: input.price ?? 0,
      isAvailable: input.isAvailable ?? true,
    })
    .returning();

  return created;
}
