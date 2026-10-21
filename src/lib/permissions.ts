/**
 * Permission Matrix implementation for POS F&B based on BA/SRS Section 2.5.
 * Strictly covers all 17 rows across 3 roles: QUAN_LY, THU_NGAN, PHUC_VU.
 */

export type Role = "QUAN_LY" | "THU_NGAN" | "PHUC_VU";

export type PermissionRuleValue = "CO" | "KHONG" | "CAN_PIN_QUAN_LY" | "CUA_MINH";

export interface PermissionContext {
  /** Indicates whether the entity (e.g. shift) belongs to the requesting user */
  readonly isSelf?: boolean;
  /** Indicates whether manager PIN has been successfully verified */
  readonly hasManagerPin?: boolean;
}

export const PERMISSION_ACTIONS = {
  VIEW_TABLES: "VIEW_TABLES", // 1. Xem sơ đồ bàn và trạng thái bàn (FR-01)
  CREATE_ORDER_AT_TABLE: "CREATE_ORDER_AT_TABLE", // 2. Tạo đơn gọi món và thêm món tại bàn (FR-02)
  PRINT_KITCHEN_ORDER: "PRINT_KITCHEN_ORDER", // 3. Gửi lệnh in phiếu chế biến Bếp/Bar (FR-03)
  TRANSFER_MERGE_TABLE: "TRANSFER_MERGE_TABLE", // 4. Chuyển bàn, gộp bàn (FR-04)
  CREATE_COUNTER_ORDER: "CREATE_COUNTER_ORDER", // 5. Tạo đơn bán hàng nhanh tại quầy (FR-05)
  CANCEL_KITCHEN_ITEM: "CANCEL_KITCHEN_ITEM", // 6. Hủy món đã gửi bếp (Cần PIN) (FR-10)
  DISCOUNT_ORDER: "DISCOUNT_ORDER", // 7. Giảm giá, chiết khấu hóa đơn (Cần PIN) (FR-10)
  CANCEL_ORDER: "CANCEL_ORDER", // 8. Hủy hóa đơn đã tạo (Cần PIN) (FR-10)
  PRINT_PROVISIONAL_BILL: "PRINT_PROVISIONAL_BILL", // 9. In phiếu tạm tính hóa đơn (FR-13)
  PAY_AND_PRINT_FINAL_BILL: "PAY_AND_PRINT_FINAL_BILL", // 10. Thực hiện thanh toán và in bill cuối (FR-11, FR-12)
  OPEN_SHIFT: "OPEN_SHIFT", // 11. Mở ca làm việc (Nhập tiền lẻ) (FR-06)
  RECORD_CASH_TRANSACTION: "RECORD_CASH_TRANSACTION", // 12. Ghi nhận thu/chi vặt tiền mặt trong ca (FR-07)
  CLOSE_SHIFT_COUNT_CASH: "CLOSE_SHIFT_COUNT_CASH", // 13. Kết ca kiểm đếm tiền thực tế (FR-08)
  APPROVE_CLOSE_SHIFT: "APPROVE_CLOSE_SHIFT", // 14. Ký duyệt đóng ca làm việc (FR-09)
  VIEW_GENERAL_REVENUE_REPORT: "VIEW_GENERAL_REVENUE_REPORT", // 15. Xem báo cáo doanh thu tổng hợp (FR-14)
  VIEW_OWN_SHIFT_REVENUE: "VIEW_OWN_SHIFT_REVENUE", // 16. Xem doanh thu trong ca của chính mình (FR-14)
  MANAGE_MENU: "MANAGE_MENU", // 17. Quản lý thực đơn, nhóm món, giá bán (FR-15)
} as const;

export type PermissionAction = keyof typeof PERMISSION_ACTIONS;

/**
 * Raw permission matrix mapped directly from SRS Section 2.5
 */
export const PERMISSION_MATRIX: Record<PermissionAction, Record<Role, PermissionRuleValue>> = {
  VIEW_TABLES: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "CO" },
  CREATE_ORDER_AT_TABLE: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "CO" },
  PRINT_KITCHEN_ORDER: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "CO" },
  TRANSFER_MERGE_TABLE: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "CO" },
  CREATE_COUNTER_ORDER: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "KHONG" },
  CANCEL_KITCHEN_ITEM: { QUAN_LY: "CO", THU_NGAN: "CAN_PIN_QUAN_LY", PHUC_VU: "CAN_PIN_QUAN_LY" },
  DISCOUNT_ORDER: { QUAN_LY: "CO", THU_NGAN: "CAN_PIN_QUAN_LY", PHUC_VU: "KHONG" },
  CANCEL_ORDER: { QUAN_LY: "CO", THU_NGAN: "CAN_PIN_QUAN_LY", PHUC_VU: "KHONG" },
  PRINT_PROVISIONAL_BILL: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "CO" },
  PAY_AND_PRINT_FINAL_BILL: { QUAN_LY: "CO", THU_NGAN: "CO", PHUC_VU: "KHONG" },
  OPEN_SHIFT: { QUAN_LY: "CO", THU_NGAN: "CUA_MINH", PHUC_VU: "KHONG" },
  RECORD_CASH_TRANSACTION: { QUAN_LY: "CO", THU_NGAN: "CUA_MINH", PHUC_VU: "KHONG" },
  CLOSE_SHIFT_COUNT_CASH: { QUAN_LY: "CO", THU_NGAN: "CUA_MINH", PHUC_VU: "KHONG" },
  APPROVE_CLOSE_SHIFT: { QUAN_LY: "CO", THU_NGAN: "KHONG", PHUC_VU: "KHONG" },
  VIEW_GENERAL_REVENUE_REPORT: { QUAN_LY: "CO", THU_NGAN: "KHONG", PHUC_VU: "KHONG" },
  VIEW_OWN_SHIFT_REVENUE: { QUAN_LY: "CO", THU_NGAN: "CUA_MINH", PHUC_VU: "KHONG" },
  MANAGE_MENU: { QUAN_LY: "CO", THU_NGAN: "KHONG", PHUC_VU: "KHONG" },
};

/**
 * Checks whether a given role can perform a specific action.
 * Evaluates contextual constraints such as `isSelf` and `hasManagerPin`.
 *
 * @param role - The user's role ('QUAN_LY' | 'THU_NGAN' | 'PHUC_VU')
 * @param action - The action being attempted
 * @param context - Optional context parameters (isSelf, hasManagerPin)
 * @returns boolean indicating whether the action is permitted
 */
export function can(
  role: Role,
  action: PermissionAction,
  context: PermissionContext = {},
): boolean {
  const rule = PERMISSION_MATRIX[action]?.[role];
  if (!rule || rule === "KHONG") {
    return false;
  }
  if (rule === "CO") {
    return true;
  }
  if (rule === "CAN_PIN_QUAN_LY") {
    return Boolean(context.hasManagerPin);
  }
  if (rule === "CUA_MINH") {
    // Fail-closed: only permitted when context.isSelf is explicitly true
    return context.isSelf === true;
  }
  return false;
}

/**
 * Checks whether an action requires Manager PIN authorization for the given role.
 */
export function requiresManagerPin(role: Role, action: PermissionAction): boolean {
  return PERMISSION_MATRIX[action]?.[role] === "CAN_PIN_QUAN_LY";
}

/**
 * Returns raw rule value from matrix for an action and role.
 */
export function getPermissionRule(role: Role, action: PermissionAction): PermissionRuleValue {
  return PERMISSION_MATRIX[action][role];
}
