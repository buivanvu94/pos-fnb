# Codebase Summary

## 1. Thành phần kiến trúc
- `src/theme/theme-config.ts`: Cấu hình token antd chạm >= 44px và màu bàn.
- `src/components/antd-provider.tsx`: Root client provider chứa `@ant-design/v5-patch-for-react-19`, `AntdRegistry`, `ConfigProvider`, `App`.
- `src/components/main-layout.tsx`: Khung giao diện chính với thanh điều hướng, ca làm việc, đồng hồ, menu admin.
- `src/db/schema/`: Định nghĩa 15 bảng Drizzle ORM với đầy đủ CHECK constraints, partial unique indexes (`shifts_cashier_active_unique`, `orders_table_active_unique`), unique index (`tables_area_id_name_unique`) và foreign key indexes.
- `src/db/code-generator.ts`: Hàm sinh mã ca và hóa đơn trong transaction có khóa `pg_advisory_xact_lock` và xử lý MAX số nguyên (tránh lỗi sắp xếp chuỗi khi đạt 100).
- `src/db/migrate.ts` & `src/db/seed.ts` & `src/db/seed-data.ts`: Quản lý migration và seed mẫu chuẩn idempotent, kiểm tra cờ `--force` khi chạy production, không ghi đè mật khẩu của user đã tồn tại.
- `src/lib/money.ts`: Xử lý tính toán tiền tệ VND và quy tắc quỹ tiền BR-05, BR-06.
- `src/lib/error-catalog.ts`: Danh mục lỗi ERR-01..12 nguyên văn.
- `src/lib/permissions.ts`: Ma trận phân quyền 17 hàng SRS 2.5 với hàm `can()` tuân theo nguyên tắc an toàn fail-closed cho quyền `CUA_MINH`.
- `src/middleware.ts`: Kiểm soát route, xóa triệt để header `x-user-*` giả mạo, lọc file tĩnh bằng regex, chặn 403 cho tài khoản không phải Quản lý truy cập khu vực admin.
- `src/server/auth/require-role.ts`: Helper xác thực cookie JWT trực tiếp cho API route thay vì tin tưởng header.
