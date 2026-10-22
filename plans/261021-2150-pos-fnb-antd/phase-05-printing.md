---
phase: 05
title: In KOT, phiếu tạm tính, hóa đơn, mở két
status: completed
priority: P1
depends: [04]
---

# Phase 05 — In ấn và két tiền (US-03 · FR-03, FR-13 · DEC-07, DEC-11, DEC-13)

Brief: `ba/handoff/US-03.md`. Cũng phục vụ phiếu tạm tính (US-07), phiếu thu/chi (US-09), Z-Report (US-10).

## Yêu cầu
FR-03, NFR-02 (< 2.5 s), NFR-06 (80mm và 58mm), BR-12, ERR-06, ERR-10, AC-03-1/2. DEC-07: món ăn → máy Bếp, đồ uống → máy Bar (hai máy LAN độc lập). DEC-11: mở két với mọi thanh toán thành công (tiền mặt và VietQR) và khi tạo phiếu thu/chi. DEC-13: bill có Logo đầu bill và QR Wi-Fi cuối bill.

## Việc cần làm
1. **Spike 1 ngày với máy in thật** (80mm và 58mm): in bitmap chữ Việt, logo, QR, lệnh cắt giấy, xung mở két RJ12 (`ESC p`). Chốt kích thước ảnh theo khổ giấy trước khi làm mẫu.
2. `src/server/printing/`: `escpos-builder` (khởi tạo, ảnh raster, cắt, mở két), `render-receipt` (dựng HTML/canvas → bitmap), `tcp-printer` (socket 9100, timeout), `print-service` (hàng đợi `print_jobs`: lưu trước, gửi sau, thử lại).
3. Định tuyến: món có `station` BEP hoặc BAR (cột mới trên `menu_items`/`categories`); một lần Gửi Bếp tách thành ≤ 2 phiếu, mỗi phiếu chỉ chứa dòng chưa gửi, ghi chú và topping rõ.
4. Mẫu in: KOT, phiếu hủy món (cho phase 06), phiếu tạm tính, hóa đơn cuối (có Logo + QR Wi-Fi), phiếu số thứ tự mang về, phiếu thu/chi, Z-Report.
5. Lỗi máy in: không làm mất đơn; trả 503 + ERR-06, lưu job `FAILED`; endpoint `POST /api/v1/print-jobs/:id/retry`. Bill: thanh toán đã lưu, ERR-10 và nút In lại (BR-12).
6. Cấu hình máy in và khổ giấy ở trang cài đặt Quản lý (IP, khổ giấy, logo, chuỗi Wi-Fi).
7. `POST /api/v1/orders/kitchen-print` (API-02) gọi cùng service.

## Màn hình / antd
Nút Gửi Bếp ở SCR-02 dùng `Button loading`; lỗi in bằng `notification` có nút "Thử in lại"; trang cài đặt máy in bằng `Form` + `Input` IP + `Segmented` khổ giấy + `Upload` logo + nút "In thử".

## Kiểm chứng
- Unit: `escpos-builder` so byte chuẩn; định tuyến Bếp/Bar đúng (đơn hỗn hợp tách 2 phiếu).
- Test với máy in giả là socket TCP cục bộ ghi lại byte (đây là test hạ tầng, không phải dữ liệu giả cho nghiệp vụ); test timeout → ERR-06, đơn vẫn lưu (AC-03-2).
- Thủ công trên máy in thật: đo Gửi Bếp → phiếu ra < 2.5 s; két bật khi thanh toán và khi thu/chi.

## Rủi ro / quay lui
Rủi ro lớn nhất của plan (font, bitmap, khác hãng máy in). Mitigation: spike đầu phase; nếu bitmap chậm quá thì cache ảnh logo/QR. Quay lui: tắt in qua cờ cấu hình, đơn vẫn lưu.
