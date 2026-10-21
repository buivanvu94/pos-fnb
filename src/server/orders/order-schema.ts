import { z } from "zod";

export const MAX_ORDER_AMOUNT = 2_000_000_000; // 2 tỷ VNĐ

export const createOrderSchema = z.object({
  tableId: z.coerce.number().int().positive({ message: "Mã bàn không hợp lệ" }),
});

export const orderItemInputSchema = z
  .object({
    id: z.coerce.number().int().positive().optional(),
    menuItemId: z.coerce.number().int().positive().optional(),
    quantity: z.coerce
      .number()
      .int()
      .min(1, { message: "Số lượng phải lớn hơn 0" })
      .max(999, { message: "Số lượng không được vượt quá 999" })
      .default(1),
    notes: z
      .string()
      .max(100, { message: "Ghi chú không được vượt quá 100 ký tự" })
      .optional()
      .nullable(),
    toppingIds: z.array(z.coerce.number().int().positive()).optional().default([]),
  })
  .refine((data) => data.id !== undefined || data.menuItemId !== undefined, {
    message: "Cần cung cấp mã dòng món (id) hoặc mã món (menuItemId)",
  });

export const modifyOrderItemsSchema = z.object({
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
  action: z.enum(["add", "update", "delete"]).optional().default("add"),
  orderItemId: z.coerce.number().int().positive().optional(),
  menuItemId: z.coerce.number().int().positive().optional(),
  quantity: z.coerce
    .number()
    .int()
    .min(0, { message: "Số lượng không được âm" })
    .max(999, { message: "Số lượng không được vượt quá 999" })
    .optional(),
  notes: z
    .string()
    .max(100, { message: "Ghi chú không được vượt quá 100 ký tự" })
    .optional()
    .nullable(),
  toppingIds: z.array(z.coerce.number().int().positive()).optional(),
  items: z.array(orderItemInputSchema).optional(),
  pinCode: z.string().optional(),
  lyDo: z.string().max(255).optional(),
});

export const sendKitchenSchema = z.object({
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
});

export const deleteOrderSchema = z.object({
  expectedVersion: z
    .number({
      required_error: "expectedVersion là bắt buộc",
      invalid_type_error: "expectedVersion phải là số nguyên",
    })
    .int()
    .min(1, { message: "expectedVersion phải lớn hơn 0" }),
});

export const transferTableSchema = z.object({
  banNguonId: z.union([z.string().min(1), z.number().int()]),
  banDichId: z.union([z.string().min(1), z.number().int()]),
  loai: z.enum(["CHUYEN", "GOP"]).optional().default("CHUYEN"),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
export type OrderItemInput = z.infer<typeof orderItemInputSchema>;
export type ModifyOrderItemsInput = z.infer<typeof modifyOrderItemsSchema>;
export type SendKitchenInput = z.infer<typeof sendKitchenSchema>;
export type DeleteOrderInput = z.infer<typeof deleteOrderSchema>;
export type TransferTableInput = z.infer<typeof transferTableSchema>;
