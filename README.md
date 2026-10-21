# POS F&B (Quán Ăn, Cafe) — Next.js + Ant Design

Hệ thống POS bán hàng F&B chuyên nghiệp cho quán ăn, cafe chạy trên PC/màn hình cảm ứng 15-21", tối ưu hóa thao tác chạm, in nhiệt ESC/POS mạng LAN và đồng bộ đám mây outbox.

## 1. Công nghệ chính
- **Frontend / Framework**: Next.js 15 (App Router) + TypeScript + React 19 + `@ant-design/v5-patch-for-react-19`
- **Giao diện người dùng**: Ant Design (`antd`) 5.x + `@ant-design/nextjs-registry` + `@ant-design/icons`
- **Cơ sở dữ liệu**: PostgreSQL + Drizzle ORM (`drizzle-orm`, `drizzle-kit`, `pg`)
- **Xác thực & Bảo mật**: JWT (`jose`) qua cookie httpOnly, mật khẩu băm bằng `bcryptjs`
- **Kiểm thử**: Vitest (Unit & Integration tests) + Playwright (E2E)

> [!WARNING]
> **CẢNH BÁO BẢO MẬT DỮ LIỆU SEED MẶC ĐỊNH**:
> Các tài khoản và mật khẩu mặc định (`123456`) cùng mã PIN (`1234`) **CHỈ DÙNG TRONG MÔI TRƯỜNG PHÁT TRIỂN (DEV)**.
> Khi triển khai Production, hệ thống từ chối chạy seed nếu không có cờ `--force` và bắt buộc phải thiết lập mật khẩu/PIN mới thông qua biến môi trường `SEED_ADMIN_PASSWORD` và `SEED_ADMIN_PIN`.

> [!NOTE]
> **QUYẾT ĐỊNH THIẾT KẾ XÁC THỰC (JWT COOKIE HTTPONLY)**:
> Ứng dụng POS sử dụng cookie `pos_token` gắn cờ `httpOnly` và `sameSite: "lax"` thay vì truyền Bearer token trong tiêu đề HTTP (như ghi chú ban đầu tại `ba/09-api.md`). Đây là quyết định kiến trúc có chủ đích dành cho Web App cùng origin (Same-Origin Web POS), giúp chống rò rỉ token qua tấn công XSS, tự động đính kèm phiên làm việc an toàn và tối ưu trải nghiệm chạm trên màn hình cảm ứng.
>
> **Thời hạn hiệu lực Token & Đánh đổi bảo mật (Stateless JWT)**:
> Phiên đăng nhập có thời hạn 7 ngày và được xác thực hoàn toàn không trạng thái (stateless) qua giải thuật mã hóa HS256 mà không truy vấn cơ sở dữ liệu trên mỗi HTTP request. Sự đánh đổi này đem lại hiệu năng phản hồi cực nhanh cho quầy thu ngân và order tại bàn trong giờ cao điểm. Trong trường hợp cần thu hồi quyền ngay lập tức khi tài khoản nhân viên bị khóa, Phase 02+ có thể bổ sung cơ chế kiểm tra `token_version` hoặc danh sách đen (Redis/cache blacklist).

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
Các cấu hình quan trọng:
- `JWT_SECRET`: Chuỗi khóa ký bảo mật tối thiểu 32 ký tự (bắt buộc trong production).
- `COOKIE_SECURE`: Đặt `true` nếu chạy qua HTTPS; đặt `false` nếu triển khai mạng nội bộ quán (LAN HTTP).

### Migration và Seed dữ liệu mẫu
```bash
npm run db:migrate
npm run db:seed
```

Tài khoản mẫu phát triển:
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

# Kiểm tra cú pháp và quy chuẩn mã nguồn
npm run lint

# Kiểm tra kiểu TypeScript
npx tsc --noEmit

# Build sản phẩm hoàn chỉnh (kiểm tra lazy database pool không yêu cầu DB lúc build)
npm run build
```

#### Kiến trúc kiểm thử tự động (Vitest Suite)
- **Cơ sở dữ liệu kiểm thử độc lập**: Bộ test sử dụng database riêng biệt `pos_test_p01` (khai báo tại `DATABASE_TEST_URL`).
- **Tự động áp dụng Migration**: Cấu hình `globalSetup` (`tests/setup/global-setup.ts`) tự động chạy toàn bộ migrations lên test database trước khi thực thi bộ test, bảo đảm schema luôn chuẩn xác.
- **Dữ liệu động (Zero Seed Dependency)**: Các ca kiểm thử tự tạo dữ liệu độc lập (user, area, bàn, ca làm việc) bằng các hàm sinh định danh ngẫu nhiên, không phụ thuộc vào thứ tự ID của seed tĩnh.
- **Kiểm thử toàn diện**:
  - `tests/unit/permissions.test.ts`: Ma trận 16 quyền hạn theo ma trận phân quyền F&B (QUAN_LY, THU_NGAN, PHUC_VU).
  - `tests/unit/money.test.ts`: Làm tròn tiền mặt 1.000đ và định dạng tiền tệ VND.
  - `tests/unit/error-catalog.test.ts`: Danh mục lỗi song ngữ chuẩn hóa kèm gợi ý xử lý.
  - `tests/unit/jwt-security.test.ts`: Bảo mật JWT, độ dài secret >= 32 ký tự, xác thực Zod payload.
  - `tests/unit/code-generator.test.ts`: Sinh mã ca (CA-...) và đơn hàng (HD-...) tuần tự theo ngày an toàn đa luồng.
  - `tests/unit/schema-constraints.test.ts`: Ràng buộc toàn vẹn PostgreSQL (mã 23505 ca mở/bàn mở, mã 23514 CHECK, mã 23503 khóa ngoại).
  - `tests/api/auth-login.test.ts`: API đăng nhập, mật khẩu bcrypt, cấp cookie httpOnly, từ chối payload không hợp lệ.
  - `tests/api/admin-authorization.test.ts`: Chống vượt quyền qua đuôi file tĩnh, loại bỏ header giả mạo, kiểm soát route quản trị.

## 3. Cấu trúc thư mục
```
src/
├── app/                  # Next.js App Router (login, tables, counter, admin, api)
├── components/           # UI Ant Design components (AntdProvider, MainLayout)
├── db/                   # Drizzle ORM schema, migrations, seed, sequential code generator
├── lib/                  # Tiện ích tiền tệ (money), danh mục lỗi (error-catalog), phân quyền (permissions)
├── server/               # Logic backend, xác thực JWT (require-role, jwt)
└── theme/                # Cấu hình Ant Design theme token (touch >= 44px, màu trạng thái bàn)
tests/                    # Bộ kiểm thử tự động Vitest
docs/                     # Tài liệu kiến trúc và hướng dẫn dự án
```

## 4. Bảo mật & Xác thực (Security Architecture)

- **Quyết định kiến trúc Cookie httpOnly thay vì Bearer Token**:
  - API sử dụng cookie `pos_token` mang thuộc tính `httpOnly`, `sameSite: "lax"`, và `secure` (tự động bật trên production hoặc cấu hình qua `COOKIE_SECURE`).
  - Khác biệt so với ghi chú ban đầu tại `ba/09-api.md` (truyền Bearer token qua header `Authorization`), đây là quyết định kiến trúc có chủ đích dành cho ứng dụng Same-Origin Web POS.
  - Lợi ích: Chống triệt để việc đánh cắp token qua tấn công XSS từ client scripts, tự động đính kèm thông tin phiên an toàn trên trình duyệt và tối ưu thao tác cảm ứng trên máy POS.

- **Thời hạn hiệu lực Token & Đánh đổi Stateless JWT (7-Day Validity)**:
  - Token JWT có hạn 7 ngày, xác thực phi trạng thái bằng HS256 thông qua Next.js Middleware mà không query database trên từng request, bảo đảm độ trễ phản hồi thấp nhất cho quầy thu ngân.
  - **Đánh đổi bảo mật**: Việc thay đổi vai trò (role) hoặc vô hiệu hóa tài khoản nhân viên trong database chỉ có hiệu lực triệt để khi phiên làm việc hiện tại hết hạn hoặc người dùng đăng xuất.
  - **Mở rộng tương lai (Phase 02+)**: Nếu cần cơ chế thu hồi quyền ngay lập tức (immediate revocation), hệ thống có thể bổ sung trường `token_version` so khớp phiên hoặc quản lý danh sách đen (token blacklist) qua Redis/in-memory cache.

- **Chống giả mạo Header (Header Spoofing Protection)**:
  - Next.js Middleware tự động bóc tách (strip) toàn bộ header `x-user-*` được client gửi lên trước khi chuyển giao request cho server components hoặc API handlers.
  - Chỉ các request có cookie JWT hợp lệ mới được giải mã và gán header người dùng đã xác minh (`x-user-role`, `x-user-id`, `x-user-name`).

- **Bảo vệ đường dẫn tĩnh & Ngăn chặn Bypass**:
  - Biểu thức chính quy bỏ qua asset tĩnh (ảnh, css, js) không bao giờ áp dụng cho các tiền tố `/api/*` và `/admin/*`, ngăn chặn triệt để hành vi bypass xác thực qua đuôi file.
