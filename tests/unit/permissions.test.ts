import { describe, it, expect } from "vitest";
import {
  can,
  PERMISSION_ACTIONS,
  PERMISSION_MATRIX,
  getPermissionRule,
  requiresManagerPin,
  type Role,
  type PermissionAction,
} from "@/lib/permissions";

describe("Permissions Matrix - BA/SRS Section 2.5 (17 Rows)", () => {
  it("verifies the raw matrix defines exactly 17 actions", () => {
    const actionKeys = Object.keys(PERMISSION_ACTIONS);
    expect(actionKeys).toHaveLength(17);
    expect(Object.keys(PERMISSION_MATRIX)).toHaveLength(17);
  });

  // Row 1: Xem sơ đồ bàn và trạng thái bàn (FR-01)
  it("Row 1: VIEW_TABLES -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Có", () => {
    expect(getPermissionRule("QUAN_LY", "VIEW_TABLES")).toBe("CO");
    expect(getPermissionRule("THU_NGAN", "VIEW_TABLES")).toBe("CO");
    expect(getPermissionRule("PHUC_VU", "VIEW_TABLES")).toBe("CO");

    expect(can("QUAN_LY", "VIEW_TABLES")).toBe(true);
    expect(can("THU_NGAN", "VIEW_TABLES")).toBe(true);
    expect(can("PHUC_VU", "VIEW_TABLES")).toBe(true);
  });

  // Row 2: Tạo đơn gọi món và thêm món tại bàn (FR-02)
  it("Row 2: CREATE_ORDER_AT_TABLE -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Có", () => {
    expect(can("QUAN_LY", "CREATE_ORDER_AT_TABLE")).toBe(true);
    expect(can("THU_NGAN", "CREATE_ORDER_AT_TABLE")).toBe(true);
    expect(can("PHUC_VU", "CREATE_ORDER_AT_TABLE")).toBe(true);
  });

  // Row 3: Gửi lệnh in phiếu chế biến Bếp/Bar (FR-03)
  it("Row 3: PRINT_KITCHEN_ORDER -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Có", () => {
    expect(can("QUAN_LY", "PRINT_KITCHEN_ORDER")).toBe(true);
    expect(can("THU_NGAN", "PRINT_KITCHEN_ORDER")).toBe(true);
    expect(can("PHUC_VU", "PRINT_KITCHEN_ORDER")).toBe(true);
  });

  // Row 4: Chuyển bàn, gộp bàn (FR-04)
  it("Row 4: TRANSFER_MERGE_TABLE -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Có", () => {
    expect(can("QUAN_LY", "TRANSFER_MERGE_TABLE")).toBe(true);
    expect(can("THU_NGAN", "TRANSFER_MERGE_TABLE")).toBe(true);
    expect(can("PHUC_VU", "TRANSFER_MERGE_TABLE")).toBe(true);
  });

  // Row 5: Tạo đơn bán hàng nhanh tại quầy (FR-05)
  it("Row 5: CREATE_COUNTER_ORDER -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "CREATE_COUNTER_ORDER")).toBe(true);
    expect(can("THU_NGAN", "CREATE_COUNTER_ORDER")).toBe(true);
    expect(can("PHUC_VU", "CREATE_COUNTER_ORDER")).toBe(false);
  });

  // Row 6: Hủy món đã gửi bếp (Cần PIN) (FR-10)
  it("Row 6: CANCEL_KITCHEN_ITEM -> QUAN_LY: Có, THU_NGAN: Cần PIN, PHUC_VU: Cần PIN", () => {
    expect(can("QUAN_LY", "CANCEL_KITCHEN_ITEM")).toBe(true);

    expect(can("THU_NGAN", "CANCEL_KITCHEN_ITEM")).toBe(false);
    expect(can("THU_NGAN", "CANCEL_KITCHEN_ITEM", { hasManagerPin: true })).toBe(true);

    expect(can("PHUC_VU", "CANCEL_KITCHEN_ITEM")).toBe(false);
    expect(can("PHUC_VU", "CANCEL_KITCHEN_ITEM", { hasManagerPin: true })).toBe(true);

    expect(requiresManagerPin("THU_NGAN", "CANCEL_KITCHEN_ITEM")).toBe(true);
    expect(requiresManagerPin("PHUC_VU", "CANCEL_KITCHEN_ITEM")).toBe(true);
  });

  // Row 7: Giảm giá, chiết khấu hóa đơn (Cần PIN) (FR-10)
  it("Row 7: DISCOUNT_ORDER -> QUAN_LY: Có, THU_NGAN: Cần PIN, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "DISCOUNT_ORDER")).toBe(true);

    expect(can("THU_NGAN", "DISCOUNT_ORDER")).toBe(false);
    expect(can("THU_NGAN", "DISCOUNT_ORDER", { hasManagerPin: true })).toBe(true);

    expect(can("PHUC_VU", "DISCOUNT_ORDER")).toBe(false);
    expect(can("PHUC_VU", "DISCOUNT_ORDER", { hasManagerPin: true })).toBe(false);
  });

  // Row 8: Hủy hóa đơn đã tạo (Cần PIN) (FR-10)
  it("Row 8: CANCEL_ORDER -> QUAN_LY: Có, THU_NGAN: Cần PIN, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "CANCEL_ORDER")).toBe(true);

    expect(can("THU_NGAN", "CANCEL_ORDER")).toBe(false);
    expect(can("THU_NGAN", "CANCEL_ORDER", { hasManagerPin: true })).toBe(true);

    expect(can("PHUC_VU", "CANCEL_ORDER")).toBe(false);
    expect(can("PHUC_VU", "CANCEL_ORDER", { hasManagerPin: true })).toBe(false);
  });

  // Row 9: In phiếu tạm tính hóa đơn (FR-13)
  it("Row 9: PRINT_PROVISIONAL_BILL -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Có", () => {
    expect(can("QUAN_LY", "PRINT_PROVISIONAL_BILL")).toBe(true);
    expect(can("THU_NGAN", "PRINT_PROVISIONAL_BILL")).toBe(true);
    expect(can("PHUC_VU", "PRINT_PROVISIONAL_BILL")).toBe(true);
  });

  // Row 10: Thực hiện thanh toán và in bill cuối (FR-11, FR-12)
  it("Row 10: PAY_AND_PRINT_FINAL_BILL -> QUAN_LY: Có, THU_NGAN: Có, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "PAY_AND_PRINT_FINAL_BILL")).toBe(true);
    expect(can("THU_NGAN", "PAY_AND_PRINT_FINAL_BILL")).toBe(true);
    expect(can("PHUC_VU", "PAY_AND_PRINT_FINAL_BILL")).toBe(false);
  });

  // Row 11: Mở ca làm việc (Nhập tiền lẻ) (FR-06)
  it("Row 11: OPEN_SHIFT -> QUAN_LY: Có, THU_NGAN: Của mình, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "OPEN_SHIFT")).toBe(true);
    expect(can("THU_NGAN", "OPEN_SHIFT", { isSelf: true })).toBe(true);
    expect(can("THU_NGAN", "OPEN_SHIFT", { isSelf: false })).toBe(false);
    expect(can("PHUC_VU", "OPEN_SHIFT")).toBe(false);
  });

  // Row 12: Ghi nhận thu/chi vặt tiền mặt trong ca (FR-07)
  it("Row 12: RECORD_CASH_TRANSACTION -> QUAN_LY: Có, THU_NGAN: Của mình, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "RECORD_CASH_TRANSACTION")).toBe(true);
    expect(can("THU_NGAN", "RECORD_CASH_TRANSACTION", { isSelf: true })).toBe(true);
    expect(can("THU_NGAN", "RECORD_CASH_TRANSACTION", { isSelf: false })).toBe(false);
    expect(can("PHUC_VU", "RECORD_CASH_TRANSACTION")).toBe(false);
  });

  // Row 13: Kết ca kiểm đếm tiền thực tế (FR-08)
  it("Row 13: CLOSE_SHIFT_COUNT_CASH -> QUAN_LY: Có, THU_NGAN: Của mình, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "CLOSE_SHIFT_COUNT_CASH")).toBe(true);
    expect(can("THU_NGAN", "CLOSE_SHIFT_COUNT_CASH", { isSelf: true })).toBe(true);
    expect(can("THU_NGAN", "CLOSE_SHIFT_COUNT_CASH", { isSelf: false })).toBe(false);
    expect(can("PHUC_VU", "CLOSE_SHIFT_COUNT_CASH")).toBe(false);
  });

  // Row 14: Ký duyệt đóng ca làm việc (FR-09)
  it("Row 14: APPROVE_CLOSE_SHIFT -> QUAN_LY: Có, THU_NGAN: Không, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "APPROVE_CLOSE_SHIFT")).toBe(true);
    expect(can("THU_NGAN", "APPROVE_CLOSE_SHIFT")).toBe(false);
    expect(can("PHUC_VU", "APPROVE_CLOSE_SHIFT")).toBe(false);
  });

  // Row 15: Xem báo cáo doanh thu tổng hợp (FR-14)
  it("Row 15: VIEW_GENERAL_REVENUE_REPORT -> QUAN_LY: Có, THU_NGAN: Không, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "VIEW_GENERAL_REVENUE_REPORT")).toBe(true);
    expect(can("THU_NGAN", "VIEW_GENERAL_REVENUE_REPORT")).toBe(false);
    expect(can("PHUC_VU", "VIEW_GENERAL_REVENUE_REPORT")).toBe(false);
  });

  // Row 16: Xem doanh thu trong ca của chính mình (FR-14)
  it("Row 16: VIEW_OWN_SHIFT_REVENUE -> QUAN_LY: Có, THU_NGAN: Của mình, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "VIEW_OWN_SHIFT_REVENUE")).toBe(true);
    expect(can("THU_NGAN", "VIEW_OWN_SHIFT_REVENUE", { isSelf: true })).toBe(true);
    expect(can("THU_NGAN", "VIEW_OWN_SHIFT_REVENUE", { isSelf: false })).toBe(false);
    expect(can("PHUC_VU", "VIEW_OWN_SHIFT_REVENUE")).toBe(false);
  });

  // Row 17: Quản lý thực đơn, nhóm món, giá bán (FR-15)
  it("Row 17: MANAGE_MENU -> QUAN_LY: Có, THU_NGAN: Không, PHUC_VU: Không", () => {
    expect(can("QUAN_LY", "MANAGE_MENU")).toBe(true);
    expect(can("THU_NGAN", "MANAGE_MENU")).toBe(false);
    expect(can("PHUC_VU", "MANAGE_MENU")).toBe(false);
  });
});
