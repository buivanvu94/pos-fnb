# POS F&B (Quán Ăn, Cafe) — Next.js + Ant Design

Hệ thống POS bán hàng F&B chuyên nghiệp cho quán ăn, cafe chạy trên PC/màn hình cảm ứng 15-21", tối ưu hóa thao tác chạm, in nhiệt ESC/POS mạng LAN và đồng bộ đám mây outbox.

## 1. Công nghệ chính
- **Frontend / Framework**: Next.js 15 (App Router) + TypeScript + React 19
- **Giao diện người dùng**: Ant Design (`antd`) 5.x + `@ant-design/nextjs-registry` + `@ant-design/icons`
- **Cơ sở dữ liệu**: PostgreSQL + Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`)
- **Xác thực & Bảo mật**: JWT (`jose`) qua cookie httpOnly, mật khẩu băm bằng `bcryptjs`
- **Kiểm thử**: Vitest (Unit & Integration tests) + Playwright (E2E)

## 2. Thiết lập môi trường & Chạy dự án

### Yêu cầu tiên quyết
- Node.js >= 18
- Docker PostgreSQL chạy sẵn tại `127.0.0.1:15450` (container `pos-postgres`)

### Cài đặt dependencies
```bash
npm install
```

### Biến môi trường
Sao chép `.env.example` thành `.env` (file `.env` được gitignore):
```bash
cp .env.example .env
```

### Migration và Seed dữ liệu mẫu
```bash
npm run db:migrate
npm run db:seed
```

Tài khoản mẫu được tạo tự động:
- **Quản lý**: `quanly` / `123456` (Mã PIN duyệt: `1234`)
- **Thu ngân**: `thungan` / `123456`
- **Phục vụ**: `phucvu` / `123456`

### Khởi chạy môi trường phát triển
```bash
npm run dev
```
Truy cập: `http://localhost:3000`

### Kiểm thử và Build
```bash
# Chạy Unit & Integration tests
npm test

# Kiểm tra cú pháp và kiểu dữ liệu
npm run lint

# Build sản phẩm hoàn chỉnh
npm run build
```

## 3. Cấu trúc thư mục
```
src/
├── app/                  # Next.js App Router (login, tables, counter, admin, api)
├── components/           # UI Ant Design components (AntdProvider, MainLayout)
├── db/                   # Drizzle ORM schema, migrations, seed, sequential code generator
├── lib/                  # Tiện ích tiền tệ (money), danh mục lỗi (error-catalog), phân quyền (permissions)
├── server/               # Logic backend, xác thực JWT
└── theme/                # Cấu hình Ant Design theme token (touch >= 44px, màu trạng thái bàn)
tests/                    # Bộ kiểm thử tự động Vitest
docs/                     # Tài liệu kiến trúc và hướng dẫn dự án
```
