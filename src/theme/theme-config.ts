import type { ThemeConfig } from "antd";

/**
 * Custom color palette for table statuses specified in SRS Section 3 (FR-01):
 * - Bàn trống (Empty): Xanh lá (#52c41a)
 * - Đang phục vụ (Serving): Đỏ (#ff4d4f)
 * - Chờ thanh toán (Waiting payment): Vàng (#faad14)
 */
export const TABLE_STATUS_COLORS = {
  TRONG: "#52c41a", // Green
  DANG_DUNG: "#ff4d4f", // Red
  CHO_THANH_TOAN: "#faad14", // Yellow
} as const;

/**
 * Ant Design Theme Configuration.
 * - Touch-friendly controlHeight >= 44px (SRS 2.4 touch optimization)
 * - Vietnamese typography and color palette
 */
export const themeConfig: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    colorSuccess: TABLE_STATUS_COLORS.TRONG,
    colorError: TABLE_STATUS_COLORS.DANG_DUNG,
    colorWarning: TABLE_STATUS_COLORS.CHO_THANH_TOAN,
    controlHeight: 44, // Minimum 44px for touch interfaces
    fontSize: 15,
    borderRadius: 8,
  },
  components: {
    Button: {
      controlHeight: 44,
      controlHeightSM: 44, // nút size="small" vẫn giữ vùng chạm tối thiểu 44px
      fontSize: 16,
      borderRadius: 8,
    },
    Input: {
      controlHeight: 44,
      fontSize: 16,
      borderRadius: 8,
    },
    Select: {
      controlHeight: 44,
      fontSize: 16,
      borderRadius: 8,
    },
  },
};
