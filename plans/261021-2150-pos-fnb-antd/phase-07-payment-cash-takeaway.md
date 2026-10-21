---
phase: 07
title: Thanh toán tiền mặt và bán tại quầy
status: pending
priority: P1
depends: [05, 06]
---

# Phase 07 — Thanh toán tiền mặt, bán mang về (US-05, US-07 · SCR-04, SCR-06)

Brief: `ba/handoff/US-05.md`, `US-07.md`.

## Yêu cầu
FR-05, FR-11, FR-13, BR-08, BR-10, BR-12, ERR-08, ERR-10, AC-05-1/2, AC-07-1/2/3. Bán tại quầy: trả trước, loại đơn MANG_VE, số thứ tự tăng dần (reset theo ca hoặc theo ngày: chọn theo ngày, ghi trong code).

## Việc cần làm
1. `POST /api/v1/orders/:id/provisional-print` (in tạm tính → bàn CHO_THANH_TOAN; gọi thêm món → quay DANG_DUNG).
2. `POST /api/v1/payments/cash` (API-06): nhận `tienKhachDua` (≥ khách cần trả), tính tiền thối, đặt `DA_THANH_TOAN`, giải phóng bàn, ghi vào ca, in hóa đơn + mở két, tất cả trong một transaction; lỗi in (500/ERR-10) không hoàn tác thanh toán, chỉ đánh dấu cần in lại. Thanh toán lặp (double click) idempotent theo `Idempotency-Key`.
3. Đơn quầy: tạo đơn MANG_VE ngầm khi thêm món đầu tiên, chặn thanh toán khi rỗng hoặc tổng 0 (ERR-08), in thêm phiếu nhận đồ có số thứ tự.
4. Giảm giá: dùng cổng PIN phase 06; `KhachCanTra = TongTien - GiamGia`.
5. Hóa đơn đã thanh toán chỉ đọc (BR-08); `POST /api/v1/orders/:id/reprint` cho In lại.

## Màn hình / antd
- SCR-04 `/counter`: `Input.Search` tìm món, lưới thẻ món lớn, giỏ `Table`, nút Thanh toán `Button type="primary" block`.
- SCR-06 `/payment/[id]`: `Descriptions` bảng kê (tổng, giảm giá, khách cần trả); `Tabs` hoặc `Segmented` Tiền mặt / VietQR; khung tiền mặt có `InputNumber` + các nút gợi ý mệnh giá (`Space` + `Button` 50k/100k/200k/500k) và `Statistic` tiền thối; hoàn tất bằng nút chính. `Result` sau khi xong; nút In lại hiện khi ERR-10.

## Kiểm chứng
- AC-07-2: 175.000, khách đưa 200.000 → thối 25.000, đơn `DA_THANH_TOAN`, bàn TRONG, có job in.
- AC-07-3: giả lập máy in lỗi → vẫn `DA_THANH_TOAN`, trả ERR-10, reprint chạy được.
- AC-05-1/2 và biên: tiền khách đưa < phải trả bị chặn; double-submit chỉ tạo một khoản thanh toán.
- Tổng tiền ca khớp tổng các hóa đơn tiền mặt (dùng ở phase 09).

## Rủi ro / quay lui
Làm tròn/tiền thối sai: chỉ số nguyên. Mất giữa chừng: transaction + idempotency. Quay lui: revert; hóa đơn đã thanh toán giữ nguyên.
