---
title: "POS F&B (quán ăn, cafe) trên Next.js + Ant Design"
description: "Xây mới POS F&B theo bộ BA trong ba/: bán tại bàn và tại quầy, ca và quỹ tiền mặt, PIN quản lý, VietQR/SePay, in ESC/POS, báo cáo doanh thu; giao diện hoàn toàn bằng Ant Design."
status: in-progress
priority: P1
effort: ~51 SP story + nền tảng (ước 5-6 tuần một dev)
tags: [feature, frontend, backend, database, api, auth]
blockedBy: []
blocks: []
created: 2026-10-21
---

# POS F&B — kế hoạch triển khai

Nguồn yêu cầu: `ba/` (00-intake → 09-api, `ba/handoff/US-01..12.md`, `ba/wireframes/pos-fnb.html`, `ba/api/pos-fnb.openapi.yaml`). Brief trong `ba/handoff/` là nguồn chính cho từng story; plan này chỉ sắp thứ tự, chọn kỹ thuật và nối các story lại.

## Kết quả mong muốn

Một web app POS chạy trên PC/màn hình cảm ứng 15-21" (DEC-05), cho 1 cửa hàng (AS-01), đủ 12 user story, 15 FR, 14 BR, 12 ERR trong `ba/03-srs.md`.

Không làm (theo BA): kho BOM, nhiều chi nhánh, app giao đồ ăn, KDS, đặt bàn trước, tách bill, voucher/điểm, mPOS, chấm công.

## Quyết định kỹ thuật (do plan chọn, có thể đổi)

| Chủ đề | Chọn | Lý do |
|---|---|---|
| Framework | Next.js (App Router) + TypeScript | Khớp stack v-prd của user; route handler làm luôn API `/api/v1/*` đúng `09-api.md` |
| UI | **Ant Design** (bản mới nhất ổn định, kiểm tra khi scaffold) + `@ant-design/nextjs-registry` + `@ant-design/plots` | Yêu cầu "dùng antd cho chuẩn"; không trộn thư viện UI khác. Chi tiết ở mục Quy ước antd |
| DB | PostgreSQL + Drizzle ORM, tiền là số nguyên VND | Khớp stack; BA: VND không thập phân |
| Kiến trúc triển khai | **Server đặt tại quán (LAN)**, DB cục bộ; đồng bộ lên đám mây bằng hàng đợi outbox | Máy in LAN cổng 9100 chỉ với tới được từ trong mạng quán. Mất Internet vẫn order/in/thu tiền mặt bình thường, nên NFR-04 và DEC-10 thành bài toán "đẩy outbox khi có mạng" thay vì app offline trong trình duyệt |
| In | Server mở TCP 9100 tới máy in; bill dựng thành ảnh bitmap | Tiếng Việt có dấu, logo và QR Wi-Fi (DEC-13) khó in bằng codepage; KOT dùng cùng cơ chế để đồng nhất |
| Đăng nhập | Tài khoản + mật khẩu, cookie JWT httpOnly; PIN quản lý là thứ riêng (băm) | BA không nói cách đăng nhập; đây là mặc định hợp lý |
| Test | Vitest (logic, API), Playwright (luồng chính) | DoD của BA: mỗi AC có test |

## Quy ước Ant Design (áp dụng mọi phase)

- Một `ConfigProvider` gốc: locale `vi_VN`, `dayjs` locale `vi`, `theme.token` cho màu trạng thái bàn (xanh/đỏ/vàng) và `controlHeight` lớn (≥ 44px) để chạm tốt (SRS 2.4); dùng `algorithm` để sau này bật dark mode nếu cần.
- Dùng `App` của antd và `App.useApp()` cho `message`/`notification`/`modal`; không gọi API tĩnh `message.xxx` ngoài context.
- Form dùng `Form` + `Form.Item rules`; thông báo lỗi lấy từ một file hằng `error-catalog` chứa nguyên văn ERR-01..12 (DoD: lỗi hiển thị đúng nguyên văn).
- Ưu tiên component có sẵn: `Layout`, `Menu`, `Tabs`, `Segmented`, `Card`, `Badge`, `List`, `Table`, `Modal`, `Drawer`, `Descriptions`, `Statistic` (+`Statistic.Countdown` cho 3 phút VietQR), `QRCode` (có `status="expired"` + `onRefresh`), `InputNumber` (formatter VND), `DatePicker.RangePicker`, `Switch`, `Upload`, `Result`, `Alert`. Chỉ tự viết bàn phím số PIN (không có sẵn), bằng lưới `Button`.
- Không CSS tùy biến lớn; chỉnh bằng token và `styles`/`classNames` của component.
- Mapping màn hình → component nằm trong từng phase.

## Phase

| # | Phase | Story / yêu cầu | Phụ thuộc |
|---|---|---|---|
| 01 | [Nền tảng](phase-01-foundation.md) | hạ tầng, FR phân quyền | — |
| 02 | [Quản lý thực đơn](phase-02-menu-management.md) | US-12 · FR-15 | 01 |
| 03 | [Mở ca và thu/chi](phase-03-shift-open-cash.md) | US-01, US-09 | 01 |
| 04 | [Sơ đồ bàn, gọi món, chuyển/gộp](phase-04-tables-ordering.md) | US-02, US-04 | 02, 03 |
| 05 | [In KOT, phiếu, két tiền](phase-05-printing.md) | US-03 · FR-13 · DEC-07/11/13 | 04 |
| 06 | [PIN quản lý và nhật ký](phase-06-manager-pin-audit.md) | US-06 | 04, 05 |
| 07 | [Thanh toán tiền mặt, bán tại quầy](phase-07-payment-cash-takeaway.md) | US-05, US-07 | 05, 06 |
| 08 | [VietQR + SePay](phase-08-vietqr-sepay.md) | US-08 | 07 |
| 09 | [Kết ca, Z-Report, Telegram](phase-09-shift-close-zreport.md) | US-10 · DEC-14 | 07 (08 nếu có VietQR trong ca) |
| 10 | [Báo cáo doanh thu](phase-10-revenue-report.md) | US-11 | 07 |
| 11 | [Đồng bộ outbox, e2e, triển khai](phase-11-sync-hardening.md) | NFR-04 · DEC-10 | tất cả |

Hai nhánh có thể làm song song sau phase 07: (08) và (09+10). Không có phase nào sửa chung file với phase khác ngoài `db/schema` và `error-catalog`, nên dùng migration nối tiếp, không song song migration.

## Cấu trúc thư mục đích

```
src/app/(auth)/login · src/app/(pos)/{open-shift,tables,counter,payment/[id],close-shift}
src/app/(admin)/{reports,menu}            # chỉ Quản lý
src/app/api/v1/...                        # đúng 09-api.md (+ endpoint bổ sung ghi ở từng phase)
src/db/{schema,migrations,seed}           # Drizzle
src/server/{auth,shifts,orders,tables,payments,printing,reports,sync}
src/lib/{money,error-catalog,permissions}
src/components/...                        # chỉ ghép antd, không tạo design system riêng
tests/{unit,api,e2e}
```

## Tiêu chí hoàn thành toàn plan

- Mọi AC trong `ba/05-userstories.md` có test tự động hoặc kịch bản thủ công trong `ba/06-test-checklist.md` đã chạy qua.
- 9 endpoint khớp `ba/api/pos-fnb.openapi.yaml`; thông báo ERR đúng nguyên văn.
- NFR: thêm món/đổi trạng thái bàn < 0.5 s; Gửi Bếp → ra phiếu < 2.5 s (đo trên máy in thật); PIN khóa 5 phút sau 5 lần sai.
- Chạy thử với máy in 80mm và 58mm, ít nhất một ca thật từ mở đến Z-Report.

## Rủi ro chính

| Rủi ro | Giảm bằng |
|---|---|
| In tiếng Việt/logo/QR Wi-Fi sai trên máy in thật | Dựng bitmap; làm spike 1 ngày ở phase 05 với máy thật trước khi viết hết mẫu bill |
| SePay cần URL công khai tới server đặt trong LAN | Quyết định ở phase 08 (tunnel hoặc relay đám mây); xem câu hỏi mở |
| Hai người cùng sửa một bàn (tranh chấp) | Khóa lạc quan bằng cột `version` trên hóa đơn, trả 409 và tải lại |
| Mất điện khi đang gửi bếp | In theo hàng đợi lưu DB (`print_jobs`), thử lại được; đơn đã lưu trước khi in |

## Câu hỏi còn mở (cần Chủ quán/anh trả lời; có mặc định để không chặn)

1. Cổng ra mạng của SePay: dùng Cloudflare Tunnel/ngrok về server quán, hay có sẵn máy chủ đám mây làm relay? Mặc định phase 08: endpoint webhook nằm trong app, quán tự lo tunnel.
2. "Đám mây" nhận đồng bộ (DEC-10) là hệ thống nào, đã có chưa? Mặc định phase 11: chỉ làm phía gửi (outbox + gọi `SYNC_TARGET_URL`), phía nhận ngoài phạm vi.
3. Đăng nhập: tài khoản + mật khẩu có ổn không, hay muốn đăng nhập bằng PIN nhân viên cho nhanh? Mặc định: tài khoản + mật khẩu.
4. Bộ đếm sai PIN tính theo người đang thao tác hay theo từng Quản lý có PIN? Mặc định: theo người đang đăng nhập thao tác.
5. Phiên bản Ant Design: bản 6 như v-prd hay 5? Mặc định: bản ổn định mới nhất, xác nhận khi scaffold.
6. Xóa hóa đơn "đang phục vụ" (SRS FR-10 "xóa/hủy đơn") và Void bill sau thanh toán (DEC-12) dùng chung luồng PIN; đồng ý?

## Tình trạng thực hiện (2026-10-22)

Phase 01-10 hoàn tất và đã merge. Phase 11 đã làm phần mã và tài liệu: đồng bộ outbox với retry có trần, huy hiệu trạng thái, e2e Playwright (13 kịch bản), test đối chiếu 9 endpoint với OpenAPI, script sao lưu, `docs/deployment-guide.md`. Plan giữ trạng thái `in-progress` vì còn các việc cần máy thật hoặc người nghiệm thu:

- [ ] In thử trên máy in 80mm và 58mm thật, đo Gửi Bếp đến khi ra phiếu (NFR, < 2.5 s).
- [ ] Chạy hết `ba/06-test-checklist.md` và `ba/07-test-cases.md` bằng tay; ghi kết quả.
- [ ] Chạy e2e trên Edge (`E2E_EDGE=1`) và màn hình cảm ứng 15-21".
- [ ] Chuyển khoản thật số nhỏ qua tài khoản thử SePay; dựng đường vào công khai cho webhook.
- [ ] Chạy thử 3 ngày song song với sổ tay, thử khôi phục từ bản sao lưu, Quản lý nghiệm thu Z-Report.

Câu hỏi mở phát sinh khi làm:

1. ERR-05: AC-10-3 ghi `-50,000` nhưng định dạng vi-VN cho ra `-50.000`. Chốt định dạng nào?
2. ERR-04 chỉ đếm bàn chưa thanh toán; đơn mang về còn dang dở có chặn kết ca không (hiện không chặn).
3. Phía nhận đồng bộ trên đám mây (câu hỏi mở 2 ở trên) vẫn chưa có.
4. Nút xác nhận VietQR thủ công đang yêu cầu PIN Quản lý và lý do; Chủ quán có đồng ý giữ dự phòng này không.
