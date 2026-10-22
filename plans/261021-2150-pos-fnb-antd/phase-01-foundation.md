---
phase: 01
title: Nền tảng
status: completed
priority: P1
depends: []
---

# Phase 01 — Nền tảng

## Mục tiêu
Có app Next.js chạy được với antd, DB, đăng nhập, phân quyền theo ma trận SRS 2.5, danh mục lỗi nguyên văn, và bộ test chạy được. Chưa có nghiệp vụ.

## Việc cần làm
1. Scaffold Next.js + TS tại thư mục POS (cùng cấp `ba/`). Cài `antd`, `@ant-design/nextjs-registry`, `@ant-design/icons`, `@ant-design/plots`, `dayjs`, `drizzle-orm`, `drizzle-kit`, `pg`, `zod`, `jose`, `argon2` (hoặc `bcryptjs` nếu argon2 khó build trên Windows), `vitest`, `@playwright/test`. Ghim phiên bản; xác nhận API antd theo docs hiện hành.
2. `src/app/layout.tsx`: `AntdRegistry` + `ConfigProvider` (vi_VN, token chạm lớn, màu trạng thái bàn) + `App`.
3. Khung màn hình bằng `Layout`: thanh trên có tên thu ngân, giờ ca, nút Kết ca; `Menu` quản trị chỉ hiện với Quản lý.
4. Schema Drizzle cho toàn bộ thực thể SRS 7.1 cộng bảng phụ: `users(role, password_hash, pin_hash)`, `areas`, `tables`, `categories`, `menu_items`, `toppings`, `shifts`, `cash_entries`, `orders`(`version`), `order_items`, `payments`, `print_jobs`, `audit_logs`, `outbox`, `settings`. Mã `CA-YYYYMMDD-nn`, `HD-YYYYMMDD-nnnn` sinh trong transaction.
5. `src/lib/money.ts` (số nguyên VND, định dạng `vi-VN`), `src/lib/error-catalog.ts` (ERR-01..12 nguyên văn, có chỗ thay `{ten_mon}`, `{so_luong_ban}`, `{so_tien_lech}`), `src/lib/permissions.ts` (ma trận quyền → hàm `can(role, action)`).
6. Auth: `POST /api/v1/auth/login`, cookie JWT, middleware chặn route theo vai trò; seed 1 Quản lý, 1 Thu ngân, 1 Phục vụ, dữ liệu khu vực/bàn mẫu.
7. Cấu hình `.env.example` (BA 09: `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `PRINTER_KITCHEN_IP`, thêm `PRINTER_BAR_IP`, `PRINTER_RECEIPT_IP`, `SEPAY_*`, `TELEGRAM_*`, `SYNC_TARGET_URL`). Không commit `.env`.

## Màn hình / antd
`/login`: `Form` + `Input.Password` + `Button` lớn trong `Card`. Khung chung: `Layout`, `Menu`, `Dropdown`.

## File
Tạo toàn bộ cấu trúc ở `plan.md`; sửa: không (dự án mới).

## Kiểm chứng
- `npm run build`, `npm run lint`, `npm test` qua.
- Unit test `permissions.can` phủ đủ 17 hàng ma trận SRS 2.5.
- Test login đúng/sai; Phục vụ gọi route admin bị 403.
- Chạy migration + seed trên DB trống, hai lần liên tiếp không lỗi.

## Rủi ro / quay lui
Sai cấu hình registry antd gây lệch style SSR; kiểm bằng cách tải lại trang trống không nháy. Quay lui: xóa DB dev, chạy lại migration (làm việc trên DB dev, backup trước khi đổi schema thật).
