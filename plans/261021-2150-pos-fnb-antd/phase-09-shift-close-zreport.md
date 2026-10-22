---
phase: 09
title: Kết ca, Z-Report, Telegram
status: completed
priority: P1
depends: [07]
---

# Phase 09 — Kết ca và ký duyệt (US-10 · SCR-08 · DEC-14)

Brief: `ba/handoff/US-10.md`.

## Yêu cầu
FR-08, FR-09, BR-05, BR-06, BR-07, ERR-04, ERR-05, AC-10-1/2/3. Vòng đời ca: DANG_MO → CHO_DUYET (thu ngân kết ca) → DA_DONG (Quản lý nhập PIN). DEC-14: gửi tóm tắt Telegram khi ca đóng.

## Việc cần làm
1. `POST /api/v1/shifts/close` (API-08): kiểm còn bàn chưa thanh toán → 409 + ERR-04 (đếm số bàn); tính `TienLyThuyet` theo BR-05, `DoLech = thực đếm − lý thuyết`; lệch ≠ 0 mà thiếu giải trình → 422 + ERR-05 (chuỗi có `{so_tien_lech}` định dạng có dấu, ví dụ `-50,000`); thành công chuyển CHO_DUYET.
2. `POST /api/v1/shifts/approve`: Quản lý nhập PIN (dùng cổng phase 06) → DA_DONG; khóa ca, in Z-Report, đăng xuất thu ngân, ghi sự kiện `ca_lam_viec_da_dong`.
3. Z-Report: đầu ca, doanh thu tiền mặt, VietQR, thu/chi vặt, lý thuyết, thực đếm, lệch, giải trình, số hóa đơn, hủy/giảm giá trong ca.
4. Telegram: gửi tóm tắt doanh thu, kênh thanh toán, lệch két qua Bot API; gửi qua outbox (thất bại không chặn đóng ca, thử lại sau); token chỉ ở biến môi trường.
5. Ca đã đóng chỉ đọc; không bán thêm vào ca đó.

## Màn hình / antd (SCR-08)
`Steps` (Kiểm đếm → Chờ duyệt → Đã đóng); `Descriptions`/`Statistic` thống kê ca; `InputNumber` tiền thực đếm; độ lệch bằng `Tag` màu (xanh 0đ, đỏ khác 0) hoặc `Alert`; `Input.TextArea` giải trình (bắt buộc khi lệch); bước ký duyệt dùng lại Modal PIN phase 06.

## Kiểm chứng
- AC-10-1: còn 1 bàn → 409 + chữ "Vẫn còn 1 bàn…" nguyên văn.
- AC-10-2: lý thuyết 3.500.000, thực đếm 3.500.000, PIN đúng → DA_DONG, có Z-Report trong hàng đợi in.
- AC-10-3: thiếu 50.000 không giải trình → 422 + ERR-05.
- Test công thức BR-05 với nhiều phiếu thu/chi và cả đơn VietQR (không tính vào tiền mặt).
- Test Telegram bằng server HTTP giả; lỗi Telegram không làm hỏng việc đóng ca.

## Rủi ro / quay lui
Lệch số tiền ca là rủi ro nghiệp vụ lớn nhất: chạy đối chiếu tự động (tổng hóa đơn tiền mặt = tổng bán hàng của ca). Quay lui: không cho sửa ca đã đóng; sai sót đi qua void bill trước khi đóng.
