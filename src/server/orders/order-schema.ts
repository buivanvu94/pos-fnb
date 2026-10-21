import { z } from "zod";

export const MAX_ORDER_AMOUNT = 2_000_000_000; // 2 tỷ VNĐ

export const createOrderSchema = z.object({
  tableId: z.coerce.number().int().positive({ message: "Mã bàn không hợp lệ" }),
});

export const orderItemInputSchema = z.object({
  id: z.coerce.number().int().positive().optional(),
  menuItemId: z.coerce.number().int().positive({ message: "Mã món không hợp lệ" }),
  quantity: z.coerce.number().int().min(1, { message: "Số lượng phải lớn hơn 0" }).default(1),
  notes: z
    .string()
    .max(100, { message: "Ghi chú không được vượt quá 100 ký tự" })
    .optional()
    .nullable(),
  toppingIds: z.array(z.coerce.number().int().positive()).optional().default([]),
});

export const modifyOrderItemsSchema = z.object({
  expectedVersion: z.coerce.number().int().optional(),
  action: z.enum(["add", "update", "delete"]).optional().default("add"),
  orderItemId: z.coerce.number().int().positive().optional(),
  menuItemId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce.number().int().min(0).optional(),
  notes: z
    .string()
    .max(100, { message: "Ghi chú không được vượt quá 100 ký tự" })
    .optional()
    .nullable(),
  toppingIds: z.array(z.coerce.number().int().positive()).optional(),
  items: z.array(orderItemInputSchema).optional(),
});

export const transferTableSchema = z.object({
  banNguonId: z.union([z.string().min(1), z.number().int()]),
  banDichId: z.union([z.string().min(1), z.number().int()]),
  loai: z.enum(["CHUYEN", "GOP"]).optional().default("CHUYEN"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type ModifyOrderItemsInput = z.infer<typeof modifyOrderItemsSchema>;
export type TransferTableInput = z.infer<typeof transferTableSchema>;
