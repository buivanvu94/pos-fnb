---
phase: 06
title: PIN quản lý và nhật ký kiểm toán
status: completed
priority: P1
depends: [04, 05]
---

# Phase 06 — Xác thực PIN và thao tác nhạy cảm (US-06 · SCR-05)

Brief: `ba/handoff/US-06.md`. Là cổng chung cho hủy món đã gửi bếp, giảm giá, hủy/xóa hóa đơn, void bill sau thanh toán (DEC-12), và ký duyệt đóng ca (phase 09).

## Yêu cầu
FR-10, BR-03 (lý do ≥ 5 ký tự), BR-04/NFR-03 (PIN 4-6 số, khóa 5 phút sau 5 lần sai), ERR-02, ERR-03, AC-06-1/2/3, BR-08 (hóa đơn đã thanh toán chỉ void qua PIN). Cờ cấu hình bật/tắt yêu cầu PIN (SRS 10).

## Việc cần làm
1. `POST /api/v1/auth/verify-pin` (API-04): nhận `pinCode`, `lyDo`, loại thao tác; so khớp với PIN băm của các Quản lý; trả 200 + token phê duyệt ngắn hạn dùng một lần gắn với thao tác; 403 (ERR-02) hoặc 429 (ERR-03).
2. Bộ đếm sai/khóa lưu DB (không lưu RAM, để sống qua restart); khóa theo người đang thao tác (xem câu hỏi mở 4).
3. Hàm `withManagerApproval(action)` bọc các API: hủy món đã gửi bếp (in phiếu hủy xuống đúng Bếp/Bar), giảm giá hóa đơn, hủy đơn, void bill (chỉ khi ca của hóa đơn chưa đóng, DEC-12). Quản lý tự thao tác thì vẫn ghi nhật ký, không phải nhập PIN.
4. `audit_logs`: loại thao tác, hóa đơn, lý do, người thao tác, Quản lý duyệt, thời điểm; ghi sự kiện `thao_tac_nhay_cam_da_duyet` (SRS 11).
5. Quản lý đặt/đổi PIN của mình trong hồ sơ; PIN không bao giờ lưu hay log dạng rõ.

## Màn hình / antd (SCR-05)
`Modal` dùng chung cho mọi hành động: tiêu đề hành động bằng `Typography.Title`, `Input.TextArea` lý do (đếm ký tự, tối thiểu 5), hiển thị PIN bằng các chấm, **bàn phím số tự viết** bằng lưới `Button` (0-9, xóa) vì antd không có; lỗi bằng `Alert`; khi khóa hiện `Statistic.Countdown` đếm ngược 5 phút và vô hiệu nút.

## Kiểm chứng
- Test: PIN đúng → món bị hủy, có phiếu hủy vào hàng đợi in, có dòng audit (AC-06-1).
- Test: sai 4 lần → ERR-02; lần 5 → ERR-03 và 429; trong 5 phút PIN đúng cũng bị từ chối; sau 5 phút (giả lập đồng hồ) hoạt động lại.
- Test: lý do 4 ký tự bị chặn; Phục vụ cố giảm giá bị chặn kể cả khi PIN đúng (ma trận quyền).
- Test: PIN không xuất hiện trong log/response.

## Rủi ro / quay lui
Dò PIN qua nhiều thiết bị: bộ đếm theo người dùng + theo IP. Quay lui: tắt qua cờ cấu hình chỉ cho môi trường thử, không cho production.
