---
phase: 08
title: VietQR động và webhook SePay
status: pending
priority: P1
depends: [07]
---

# Phase 08 — VietQR + SePay (US-08 · FR-12 · DEC-06)

Brief: `ba/handoff/US-08.md`. Lưu ý: AC-08-2 trong `05-userstories.md` còn ghi "bấm Xác nhận đã nhận tiền", nhưng DEC-06 và FR-12 đã đổi thành tự hoàn tất qua webhook SePay. Làm theo DEC-06; giữ nút xác nhận thủ công chỉ làm phương án dự phòng khi mất mạng và ghi vào audit (cần Chủ quán duyệt, câu hỏi mở).

## Yêu cầu
FR-12, BR-11 (QR sống 3 phút), ERR-09, AC-08-1/2/3, DEC-11 (mở két cả khi VietQR).

## Việc cần làm
1. `POST /api/v1/payments/vietqr` (API-05): sinh chuỗi VietQR theo chuẩn (EMVCo + CRC16) từ `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, số tiền, nội dung chuyển khoản = mã hóa đơn rút gọn (vd `HD0012`); lưu `payments(status=PENDING, expires_at=+180s)`.
2. `POST /api/v1/webhooks/sepay`: xác thực chữ ký/API key của SePay, đối chiếu nội dung chuyển khoản + số tiền khớp hóa đơn đang chờ, idempotent theo mã giao dịch SePay; khớp thì hoàn tất đơn (cùng logic hoàn tất như phase 07), in hóa đơn, mở két; sai tiền hoặc không khớp thì ghi `unmatched_transactions` để Quản lý xử lý, không tự hoàn tất.
3. UI nhận kết quả bằng polling `GET /api/v1/payments/:id` mỗi 2 s.
4. Hết 3 phút: trạng thái `EXPIRED`, hiện ERR-09, cho tạo QR mới hoặc đổi sang tiền mặt; nếu tiền về sau khi hết hạn vẫn đối chiếu được (không mất tiền khách).
5. Chế độ mất mạng: dùng QR tĩnh (SRS 9) và nút xác nhận thủ công có audit.

## Màn hình / antd
Trong SCR-06: `QRCode` của antd (truyền chuỗi VietQR; dùng `status="expired"` + `onRefresh` để tạo lại), `Statistic.Countdown` 3 phút, `Spin` khi chờ, `Result status="success"` khi nhận tiền, `Alert` ERR-09.

## Kiểm chứng
- Unit: CRC16/chuỗi QR so với vector mẫu chuẩn VietQR; quét thử bằng app ngân hàng thật.
- Test webhook: đúng chữ ký + khớp → `DA_THANH_TOAN`; gửi hai lần cùng mã → chỉ một lần; sai chữ ký → 401; thiếu tiền → không hoàn tất.
- AC-08-3 với đồng hồ giả lập.
- Thủ công: chuyển khoản thật số nhỏ qua tài khoản thử của SePay.

## Rủi ro / quay lui
URL công khai tới server quán (câu hỏi mở 1). Quay lui: ẩn tab VietQR bằng cờ cấu hình, thu tiền mặt như cũ.
