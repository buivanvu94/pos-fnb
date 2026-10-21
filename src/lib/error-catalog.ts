/**
 * Error catalog defining verbatim user error messages according to BA/SRS Section 6.
 * Note: Error messages must strictly match the verbatim strings defined in SRS Section 6.
 */

export interface ErrorDefinition {
  readonly id: string;
  readonly message: string;
  readonly level: "Chặn" | "Cảnh báo";
  readonly remedy: string;
  readonly references: string;
}

export const ERROR_CATALOG = {
  ERR_01: {
    id: "ERR-01",
    message: "Ca làm việc chưa được mở. Vui lòng mở ca và nhập số dư tiền mặt đầu ca để bắt đầu.",
    level: "Chặn",
    remedy: "Điều hướng thu ngân về màn hình Mở ca",
    references: "FR-06, BR-01",
  },
  ERR_02: {
    id: "ERR-02",
    message: "Mã PIN phê duyệt không chính xác. Vui lòng kiểm tra lại!",
    level: "Chặn",
    remedy: "Yêu cầu nhập lại mã PIN đúng",
    references: "FR-10, BR-04",
  },
  ERR_03: {
    id: "ERR-03",
    message: "Bạn đã nhập sai mã PIN quá 5 lần. Chức năng xác thực bị khóa tạm thời trong 5 phút!",
    level: "Chặn",
    remedy: "Chờ hết 5 phút hoặc dùng tài khoản Quản lý cấp cao mở khóa",
    references: "FR-10, BR-04",
  },
  ERR_04: {
    id: "ERR-04",
    message: "Không thể đóng ca! Vẫn còn {so_luong_ban} bàn chưa hoàn tất thanh toán. Vui lòng thanh toán hoặc bàn giao bàn.",
    level: "Chặn",
    remedy: "Thanh toán hết các bàn đang phục vụ trước khi đóng ca",
    references: "FR-08, BR-07",
  },
  ERR_05: {
    id: "ERR-05",
    message: "Tiền mặt thực tế bị lệch {so_tien_lech} VNĐ. Vui lòng nhập lý do giải trình để tiếp tục!",
    level: "Chặn",
    remedy: "Nhập lý do giải trình vào ô ghi chú",
    references: "FR-08, BR-06",
  },
  ERR_06: {
    id: "ERR-06",
    message: "Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!",
    level: "Cảnh báo",
    remedy: "Kiểm tra máy in và bấm nút Thử in lại",
    references: "FR-03, AS-03",
  },
  ERR_07: {
    id: "ERR-07",
    message: "Món {ten_mon} hiện đã hết. Vui lòng chọn món khác!",
    level: "Chặn",
    remedy: "Chọn món thay thế hoặc báo khách đổi món",
    references: "FR-02, BR-09",
  },
  ERR_08: {
    id: "ERR-08",
    message: "Đơn hàng chưa có món ăn. Vui lòng chọn món trước khi thanh toán!",
    level: "Chặn",
    remedy: "Chọn ít nhất một món vào đơn hàng",
    references: "FR-05, BR-10",
  },
  ERR_09: {
    id: "ERR-09",
    message: "Hết thời gian chờ thanh toán VietQR. Vui lòng tạo mã QR mới hoặc thanh toán tiền mặt!",
    level: "Cảnh báo",
    remedy: "Bấm tạo lại mã QR hoặc chọn phương thức tiền mặt",
    references: "FR-12, BR-11",
  },
  ERR_10: {
    id: "ERR-10",
    message: "Máy in hóa đơn hết giấy hoặc bị kẹt. Vui lòng kiểm tra giấy và in lại!",
    level: "Cảnh báo",
    remedy: "Nạp thêm cuộn giấy nhiệt và bấm nút In lại bill",
    references: "FR-13, BR-12",
  },
  ERR_11: {
    id: "ERR-11",
    message: "Ngày bắt đầu không được lớn hơn ngày kết thúc!",
    level: "Chặn",
    remedy: "Chọn lại khoảng thời gian lọc hợp lệ",
    references: "FR-14, BR-13",
  },
  ERR_12: {
    id: "ERR-12",
    message: "Đơn giá món ăn không được nhỏ hơn 0 VNĐ!",
    level: "Chặn",
    remedy: "Nhập giá bán món ăn hợp lệ",
    references: "FR-15, BR-14",
  },
} as const satisfies Record<string, ErrorDefinition>;

export type ErrorCode = keyof typeof ERROR_CATALOG;

/**
 * Formats ERR-04 error message by replacing {so_luong_ban} token.
 */
export function formatErr04(soLuongBan: number | string): string {
  return ERROR_CATALOG.ERR_04.message.replace("{so_luong_ban}", String(soLuongBan));
}

/**
 * Formats ERR-05 error message by replacing {so_tien_lech} token.
 */
export function formatErr05(soTienLech: number | string): string {
  const formattedAmount =
    typeof soTienLech === "number"
      ? new Intl.NumberFormat("vi-VN").format(soTienLech)
      : String(soTienLech);
  return ERROR_CATALOG.ERR_05.message.replace("{so_tien_lech}", formattedAmount);
}

/**
 * Formats ERR-07 error message by replacing {ten_mon} token.
 */
export function formatErr07(tenMon: string): string {
  return ERROR_CATALOG.ERR_07.message.replace("{ten_mon}", tenMon);
}
