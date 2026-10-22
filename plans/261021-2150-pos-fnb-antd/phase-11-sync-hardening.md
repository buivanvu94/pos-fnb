---
phase: 11
title: Đồng bộ outbox, kiểm thử tổng, triển khai
status: in-progress
priority: P1
depends: [01, 02, 03, 04, 05, 06, 07, 08, 09, 10]
---

# Phase 11 — Đồng bộ, kiểm thử tổng, go-live (NFR-04 · DEC-10)

## Yêu cầu
NFR-04 (không mất đơn khi mất mạng, đồng bộ ngầm khi có lại, DEC-10), RSK-01, SRS 10 (triển khai), 09-api mục 7 (cổng production). Kiến trúc server tại quán đã giúp order/in/thu tiền mặt chạy khi mất Internet; phase này làm phần đồng bộ lên đám mây và kiểm toàn bộ.

## Việc cần làm
1. Worker outbox: hàng đợi `outbox` (hóa đơn, ca, thu/chi, audit) gửi `SYNC_TARGET_URL` với retry lũy thừa, idempotent theo id; chỉ báo trạng thái (đã đồng bộ / còn N bản chờ) bằng `Badge` nhỏ trên thanh trên, không có nút xác nhận thủ công (DEC-10). Dùng cả cho Telegram.
2. Phía nhận đám mây ngoài phạm vi trừ khi được xác nhận (câu hỏi mở 2). Nếu chưa có, worker vẫn xếp hàng và không lỗi.
3. Playwright e2e các luồng chính: mở ca → gọi món → Gửi Bếp → chuyển/gộp → tạm tính → thanh toán tiền mặt → thu/chi → kết ca → PIN duyệt → báo cáo. Thêm luồng VietQR với webhook giả lập.
4. Kiểm kịch bản mất mạng Internet (chặn đầu ra, vẫn bán và in), mất máy in, F5 giữa chừng, hai máy thao tác cùng một bàn.
5. Chạy hết `ba/06-test-checklist.md` / `07-test-cases.md`; đối chiếu 9 endpoint với `pos-fnb.openapi.yaml`.
6. Đóng gói: hướng dẫn cài (Postgres, biến môi trường, chạy bằng service/PM2 hoặc Docker), sao lưu DB định kỳ, nhập thực đơn. Viết `README.md` gốc và `docs/deployment-guide.md` (đây là đầu ra cần thiết vì thêm sản phẩm mới, không phải phát sinh ngoài yêu cầu).
7. Chạy thử 3 ngày song song với sổ tay (SRS 10), đối chiếu doanh thu hằng ngày.

## Kiểm chứng
- E2E xanh trên Chrome và Edge, màn hình cảm ứng 15-21".
- Đo NFR-01 và NFR-02, ghi số liệu.
- Kịch bản mất mạng: không mất đơn, sau khi có mạng outbox về 0.
- Cổng production ở `ba/09-api.md` mục 7 tick hết.

## Rủi ro / quay lui
Rollback 24 giờ đầu: dùng hóa đơn giấy dự phòng như SRS 10; dữ liệu đã nhập giữ nguyên để đối chiếu.
