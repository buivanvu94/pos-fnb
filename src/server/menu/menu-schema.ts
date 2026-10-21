import { z } from "zod";
import { ERROR_CATALOG } from "@/lib/error-catalog";

export const MAX_PRICE = 2_000_000_000;
export const MAX_PRICE_MESSAGE = "Đơn giá món ăn không được vượt quá 2.000.000.000 VNĐ";
export const MAX_TOPPING_PRICE_MESSAGE = "Đơn giá topping không được vượt quá 2.000.000.000 VNĐ";

export const IMAGE_URL_REGEX = /^\/api\/v1\/menu\/images\/\d+-[0-9a-f]{12}\.(png|jpg|webp)$/;

/**
 * Validation schema for creating a menu item.
 * BR-14: Price must be >= 0 VND and name must not be empty.
 * ERR-12: If price is negative, exact verbatim error message must be returned.
 * Cap: Maximum safe price is 2,000,000,000 VND.
 */
export const createMenuItemSchema = z.object({
  name: z
    .string({ required_error: "Tên món ăn không được để trống" })
    .trim()
    .min(1, { message: "Tên món ăn không được để trống" })
    .max(100, { message: "Tên món ăn không được vượt quá 100 ký tự" }),
  price: z
    .number({ required_error: "Đơn giá món ăn không được để trống" })
    .int({ message: "Đơn giá món ăn phải là số nguyên" })
    .refine((val) => val >= 0, {
      message: ERROR_CATALOG.ERR_12.message,
    })
    .refine((val) => val <= MAX_PRICE, {
      message: MAX_PRICE_MESSAGE,
    }),
  categoryId: z
    .number({ required_error: "Danh mục món ăn không được để trống" })
    .int()
    .positive({ message: "Danh mục không hợp lệ" }),
  code: z
    .string()
    .trim()
    .max(20, { message: "Mã món không vượt quá 20 ký tự" })
    .optional(),
  unit: z
    .string()
    .trim()
    .max(20, { message: "Đơn vị tính không vượt quá 20 ký tự" })
    .default("Phần"),
  status: z
    .enum(["DANG_BAN", "HET_HANG"], {
      errorMap: () => ({ message: "Trạng thái phải là DANG_BAN hoặc HET_HANG" }),
    })
    .default("DANG_BAN"),
  imageUrl: z
    .string()
    .trim()
    .refine((val) => val === "" || IMAGE_URL_REGEX.test(val), {
      message: "Đường dẫn ảnh không hợp lệ (chỉ chấp nhận ảnh tải lên từ hệ thống)",
    })
    .nullable()
    .optional(),
  targetPrinter: z
    .enum(["KITCHEN", "BAR"], {
      errorMap: () => ({ message: "Máy in đích phải là KITCHEN hoặc BAR" }),
    })
    .default("KITCHEN"),
});

export type CreateMenuItemInput = z.input<typeof createMenuItemSchema>;

/**
 * Validation schema for updating a menu item.
 */
export const updateMenuItemSchema = z.object({
  id: z.number().int().positive().optional(),
  name: z
    .string()
    .trim()
    .min(1, { message: "Tên món ăn không được để trống" })
    .max(100, { message: "Tên món ăn không được vượt quá 100 ký tự" })
    .optional(),
  price: z
    .number()
    .int({ message: "Đơn giá món ăn phải là số nguyên" })
    .refine((val) => val >= 0, {
      message: ERROR_CATALOG.ERR_12.message,
    })
    .refine((val) => val <= MAX_PRICE, {
      message: MAX_PRICE_MESSAGE,
    })
    .optional(),
  categoryId: z.number().int().positive().optional(),
  code: z.string().trim().max(20).optional(),
  unit: z.string().trim().max(20).optional(),
  status: z.enum(["DANG_BAN", "HET_HANG"]).optional(),
  imageUrl: z
    .string()
    .trim()
    .refine((val) => val === "" || IMAGE_URL_REGEX.test(val), {
      message: "Đường dẫn ảnh không hợp lệ (chỉ chấp nhận ảnh tải lên từ hệ thống)",
    })
    .nullable()
    .optional(),
  targetPrinter: z.enum(["KITCHEN", "BAR"]).optional(),
});

export type UpdateMenuItemInput = z.input<typeof updateMenuItemSchema>;

/**
 * Validation schema for updating menu item availability (FR-15, BR-09).
 */
export const updateAvailabilitySchema = z
  .object({
    status: z.enum(["DANG_BAN", "HET_HANG"]).optional(),
    isAvailable: z.boolean().optional(),
  })
  .refine((data) => data.status !== undefined || data.isAvailable !== undefined, {
    message: "Yêu cầu cung cấp trạng thái món (status hoặc isAvailable)",
  });

export type UpdateAvailabilityInput = z.input<typeof updateAvailabilitySchema>;

/**
 * Validation schema for category management.
 */
export const createCategorySchema = z.object({
  name: z
    .string({ required_error: "Tên danh mục không được để trống" })
    .trim()
    .min(1, { message: "Tên danh mục không được để trống" })
    .max(100, { message: "Tên danh mục không được vượt quá 100 ký tự" }),
  code: z.string().trim().max(20).optional(),
  displayOrder: z.number().int().optional().default(0),
});

export type CreateCategoryInput = z.input<typeof createCategorySchema>;

/**
 * Validation schema for toppings (FR-02).
 */
export const createToppingSchema = z.object({
  name: z
    .string({ required_error: "Tên topping không được để trống" })
    .trim()
    .min(1, { message: "Tên topping không được để trống" })
    .max(100, { message: "Tên topping không được vượt quá 100 ký tự" }),
  price: z
    .number()
    .int({ message: "Đơn giá topping phải là số nguyên" })
    .min(0, { message: "Đơn giá topping không được nhỏ hơn 0 VNĐ" })
    .max(MAX_PRICE, { message: MAX_TOPPING_PRICE_MESSAGE })
    .default(0),
  isAvailable: z.boolean().default(true),
});

export type CreateToppingInput = z.input<typeof createToppingSchema>;
