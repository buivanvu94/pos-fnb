import { formatVnd } from "@/lib/money";
import type { ShiftCloseTelegramPayload } from "./outbox-types";

/**
 * Formats shift close summary into a structured Telegram message.
 * Pure function: takes payload and produces readable Markdown text.
 */
export function formatShiftCloseTelegramMessage(
  payload: ShiftCloseTelegramPayload,
): string {
  const diffLabel =
    payload.difference === 0
      ? "Khớp (0 ₫)"
      : `${payload.difference > 0 ? "+" : ""}${formatVnd(payload.difference)}`;

  const lines = [
    `🔔 *BÁO CÁO KẾT CA: ${payload.shiftCode}*`,
    `👤 Thu ngân: ${payload.cashierName}`,
  ];

  if (payload.approverName) {
    lines.push(`✅ Quản lý duyệt: ${payload.approverName}`);
  }

  lines.push(
    `⏱️ Mở: ${new Date(payload.openedAt).toLocaleString("vi-VN")}`,
    `⏱️ Đóng: ${new Date(payload.closedAt).toLocaleString("vi-VN")}`,
    `─────────────────`,
    `💰 *DOANH THU CA:*`,
    `• Tiền mặt: ${formatVnd(payload.cashSales)}`,
    `• VietQR: ${formatVnd(payload.vietqrSales)}`,
    `• *Tổng doanh thu:* ${formatVnd(payload.totalSales)}`,
    `─────────────────`,
    `💵 *KIỂM KÊ KÉT TIỀN:*`,
    `• Tiền đầu ca: ${formatVnd(payload.initialCash)}`,
    `• Thu vặt (+): ${formatVnd(payload.cashIn)}`,
    `• Chi vặt (-): ${formatVnd(payload.cashOut)}`,
    `• Tiền mặt lý thuyết: ${formatVnd(payload.expectedCash)}`,
    `• Tiền thực đếm: ${formatVnd(payload.actualCash)}`,
    `• *Độ lệch két:* ${diffLabel}`,
  );

  if (payload.explanation) {
    lines.push(`📝 *Giải trình lệch:* ${payload.explanation}`);
  }

  lines.push(
    `─────────────────`,
    `🧾 Số hóa đơn: ${payload.invoiceCount}`,
  );

  if (payload.cancelledCount && payload.cancelledCount > 0) {
    lines.push(
      `❌ Đơn hủy: ${payload.cancelledCount} (${formatVnd(payload.cancelledAmount ?? 0)})`,
    );
  }

  if (payload.discountAmount && payload.discountAmount > 0) {
    lines.push(`🏷️ Giảm giá: ${formatVnd(payload.discountAmount)}`);
  }

  return lines.join("\n");
}
