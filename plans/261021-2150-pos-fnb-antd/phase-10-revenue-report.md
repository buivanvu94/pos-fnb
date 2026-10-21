---
phase: 10
title: Báo cáo doanh thu
status: pending
priority: P2
depends: [07]
---

# Phase 10 — Báo cáo doanh thu (US-11 · SCR-09)

Brief: `ba/handoff/US-11.md`.

## Yêu cầu
FR-14, BR-13, ERR-11, AC-11-1/2. Theo ca, theo nhân viên, theo phương thức thanh toán, top món. Quản lý xem tất cả; Thu ngân chỉ doanh thu ca của mình (ma trận quyền); Phục vụ không xem.

## Việc cần làm
1. `GET /api/v1/reports/revenue?fromDate&toDate` (API-09): kiểm `fromDate ≤ toDate` ở server (ERR-11); trả tổng doanh thu thuần (sau giảm giá, không tính đơn hủy/void), số đơn, giá trị đơn trung bình, tỷ trọng tiền mặt/VietQR, doanh thu theo ca (kèm lệch tiền), theo nhân viên, top món (mặc định top 5).
2. Truy vấn SQL gom nhóm có chỉ mục theo `paid_at`, `shift_id`; múi giờ GMT+7 khi cắt ngày.
3. Thu ngân gọi thì server tự giới hạn theo ca của mình, không tin tham số từ client.

## Màn hình / antd
`DatePicker.RangePicker` + `Segmented` nhanh (Hôm nay, Hôm qua, 7 ngày) — chặn chọn ngược ngay ở UI và vẫn hiện ERR-11 nếu server từ chối; `Statistic` trong `Card`/`Row-Col` cho 3 chỉ số; `Pie` của `@ant-design/plots` cho tỷ trọng thanh toán; `Table` doanh thu theo ca và `Table` top món (có `sorter`, phân trang); `Skeleton`/`Empty` cho trạng thái tải và không có dữ liệu.

## Kiểm chứng
- Test dữ liệu thật qua các phase trước: tạo vài đơn tiền mặt/VietQR/hủy → tổng khớp tay.
- AC-11-2: từ 2026-10-25 đến 2026-10-20 → ERR-11, không truy vấn.
- Test phân quyền: Thu ngân không thấy ca người khác; Phục vụ 403.
- Biên giờ: đơn lúc 23:59 và 00:01 rơi đúng ngày theo GMT+7.

## Rủi ro / quay lui
Truy vấn chậm khi dữ liệu lớn; có chỉ mục là đủ cho 1 quán. Quay lui: trang chỉ đọc, bỏ route là xong.
