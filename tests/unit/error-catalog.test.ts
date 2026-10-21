import { describe, it, expect } from "vitest";
import {
  ERROR_CATALOG,
  formatErr04,
  formatErr05,
  formatErr07,
} from "@/lib/error-catalog";

describe("Error Catalog - BA/SRS Section 6 (Verbatim Messages ERR-01..12)", () => {
  it("contains all 12 error codes ERR-01 to ERR-12", () => {
    const errorKeys = Object.keys(ERROR_CATALOG);
    expect(errorKeys).toHaveLength(12);
    expect(ERROR_CATALOG.ERR_01.id).toBe("ERR-01");
    expect(ERROR_CATALOG.ERR_12.id).toBe("ERR-12");
  });

  it("verifies ERR-01 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_01.message).toBe(
      "Ca làm việc chưa được mở. Vui lòng mở ca và nhập số dư tiền mặt đầu ca để bắt đầu.",
    );
  });

  it("verifies ERR-02 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_02.message).toBe(
      "Mã PIN phê duyệt không chính xác. Vui lòng kiểm tra lại!",
    );
  });

  it("verifies ERR-03 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_03.message).toBe(
      "Bạn đã nhập sai mã PIN quá 5 lần. Chức năng xác thực bị khóa tạm thời trong 5 phút!",
    );
  });

  it("verifies ERR-04 and replaces {so_luong_ban} token", () => {
    expect(ERROR_CATALOG.ERR_04.message).toContain("{so_luong_ban}");
    const formatted = formatErr04(3);
    expect(formatted).toBe(
      "Không thể đóng ca! Vẫn còn 3 bàn chưa hoàn tất thanh toán. Vui lòng thanh toán hoặc bàn giao bàn.",
    );
  });

  it("verifies ERR-05 and replaces {so_tien_lech} token with formatted amount", () => {
    expect(ERROR_CATALOG.ERR_05.message).toContain("{so_tien_lech}");
    const formatted = formatErr05(50000);
    expect(formatted).toBe(
      "Tiền mặt thực tế bị lệch 50.000 VNĐ. Vui lòng nhập lý do giải trình để tiếp tục!",
    );
  });

  it("verifies ERR-06 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_06.message).toBe(
      "Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!",
    );
  });

  it("verifies ERR-07 and replaces {ten_mon} token", () => {
    expect(ERROR_CATALOG.ERR_07.message).toContain("{ten_mon}");
    const formatted = formatErr07("Trà đào cam sả");
    expect(formatted).toBe(
      "Món Trà đào cam sả hiện đã hết. Vui lòng chọn món khác!",
    );
  });

  it("verifies ERR-08 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_08.message).toBe(
      "Đơn hàng chưa có món ăn. Vui lòng chọn món trước khi thanh toán!",
    );
  });

  it("verifies ERR-09 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_09.message).toBe(
      "Hết thời gian chờ thanh toán VietQR. Vui lòng tạo mã QR mới hoặc thanh toán tiền mặt!",
    );
  });

  it("verifies ERR-10 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_10.message).toBe(
      "Máy in hóa đơn hết giấy hoặc bị kẹt. Vui lòng kiểm tra giấy và in lại!",
    );
  });

  it("verifies ERR-11 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_11.message).toBe(
      "Ngày bắt đầu không được lớn hơn ngày kết thúc!",
    );
  });

  it("verifies ERR-12 verbatim message", () => {
    expect(ERROR_CATALOG.ERR_12.message).toBe(
      "Đơn giá món ăn không được nhỏ hơn 0 VNĐ!",
    );
  });
});
