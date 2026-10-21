# Codebase Summary

## 1. Thành phần kiến trúc
- `src/theme/theme-config.ts`: Cấu hình token antd chạm >= 44px và màu bàn.
- `src/components/antd-provider.tsx`: Root client provider chứa `AntdRegistry`, `ConfigProvider`, `App`.
- `src/components/main-layout.tsx`: Khung giao diện chính với thanh điều hướng, ca làm việc, đồng hồ, menu admin.
- `src/db/schema/`: Định nghĩa 15 bảng Drizzle ORM (`users`, `areas`, `tables`, `categories`, `menu_items`, `toppings`, `shifts`, `cash_entries`, `orders`, `order_items`, `payments`, `print_jobs`, `audit_logs`, `outbox`, `settings`).
- `src/db/code-generator.ts`: Hàm sinh mã ca và hóa đơn trong transaction có khóa `pg_advisory_xact_lock`.
- `src/db/migrate.ts` & `src/db/seed.ts`: Quản lý migration và seed mẫu chuẩn idempotent.
- `src/lib/money.ts`: Xử lý tính toán tiền tệ VND và quy tắc quỹ tiền BR-05, BR-06.
- `src/lib/error-catalog.ts`: Danh mục lỗi ERR-01..12 nguyên văn.
- `src/lib/permissions.ts`: Ma trận phân quyền 17 hàng SRS 2.5 với hàm `can()`.
- `src/middleware.ts`: Kiểm soát route, chặn 403 cho tài khoản không phải Quản lý truy cập khu vực admin.
