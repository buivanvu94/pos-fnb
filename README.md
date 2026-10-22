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
> Phiên đăng nhập có thời hạn 12 giờ và được xác thực hoàn toàn không trạng thái (stateless) qua giải thuật mã hóa HS256 mà không truy vấn cơ sở dữ liệu trên mỗi HTTP request. Sự đánh đổi này đem lại hiệu năng phản hồi cực nhanh cho quầy thu ngân và order tại bàn trong giờ cao điểm. Trong trường hợp cần thu hồi quyền ngay lập tức khi tài khoản nhân viên bị khóa, Phase 02+ có thể bổ sung cơ chế kiểm tra `token_version` hoặc danh sách đen (Redis/cache blacklist).

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
- `TRUST_PROXY`: Đặt `true` nếu triển khai sau reverse proxy tin cậy (Nginx/Traefik); mặc định `false` để ngăn chặn giả mạo IP client qua tiêu đề `X-Forwarded-For`.

### Migration và Seed dữ liệu mẫu
```bash
npm run db:migrate
npm run db:seed
```

### Nhập thực đơn từ file CSV (Phase 02 - Quản lý thực đơn)
Hệ thống cung cấp script nhập thực đơn và danh mục từ file CSV trước go-live (SRS mục 10, US-12):
```bash
npm run seed:menu -- duong_dan_file.csv
```
- **Cấu trúc cột CSV**: `nhom`, `ten`, `gia`, `don vi`, `trang thai` (hoặc `category`, `name`, `price`, `unit`, `status`).
- **Cơ chế Idempotent**: Định danh duy nhất theo cặp `(nhóm món, tên món)`. Chạy nhiều lần sẽ tự động cập nhật đơn giá, đơn vị tính và trạng thái mà không làm nhân đôi bản ghi.
- **Ràng buộc nghiệp vụ**: Đơn giá bán phải lớn hơn hoặc bằng 0 VNĐ (ERR-12, BR-14) và tên món không được để trống. Parser CSV tự động xử lý an toàn dấu nháy kép `""` và báo cáo rõ ràng các dòng lỗi nếu có.

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
  - `tests/unit/menu-csv-parser.test.ts`: Parser CSV thực đơn, xử lý nháy kép, phát hiện đơn giá âm (ERR-12) và báo cáo lỗi dòng.
  - `tests/api/menu-items.test.ts`: API quản lý món ăn, phân quyền QUAN_LY, chặn đơn giá âm, cập nhật trạng thái HET_HANG tức thời.
  - `tests/api/menu-categories-toppings.test.ts`: API danh mục, món ăn kèm topping và tính idempotent khi seed thực đơn CSV.
  - `tests/api/menu-images.test.ts`: Upload ảnh món ăn (giới hạn 2MB, định dạng PNG/JPG/WEBP) và chống tấn công path traversal.

## 3. Cấu trúc thư mục
```
src/
├── app/                  # Next.js App Router (login, tables, counter, admin, api)
├── components/           # UI Ant Design components (AntdProvider, MainLayout, menu)
├── db/                   # Drizzle ORM schema, migrations, seed, sequential code generator
├── lib/                  # Tiện ích tiền tệ (money), danh mục lỗi (error-catalog), phân quyền (permissions)
├── server/               # Logic backend, xác thực JWT (require-role, jwt), menu service
└── theme/                # Cấu hình Ant Design theme token (touch >= 44px, màu trạng thái bàn)
tests/                    # Bộ kiểm thử tự động Vitest
docs/                     # Tài liệu kiến trúc và hướng dẫn dự án
scripts/                  # Scripts tiện ích (seed-menu)
```

## 4. Bảo mật & Xác thực (Security Architecture)

- **Quyết định kiến trúc Cookie httpOnly thay vì Bearer Token**:
  - API sử dụng cookie `pos_token` mang thuộc tính `httpOnly`, `sameSite: "lax"`, và `secure` (tự động bật trên production hoặc cấu hình qua `COOKIE_SECURE`).
  - Khác biệt so với ghi chú ban đầu tại `ba/09-api.md` (truyền Bearer token qua header `Authorization`), đây là quyết định kiến trúc có chủ đích dành cho ứng dụng Same-Origin Web POS.
  - Lợi ích: Chống triệt để việc đánh cắp token qua tấn công XSS từ client scripts, tự động đính kèm thông tin phiên an toàn trên trình duyệt và tối ưu thao tác cảm ứng trên máy POS.

- **Thời hạn hiệu lực Token & Đánh đổi Stateless JWT (12-Hour Validity)**:
  - Token JWT có hạn 12 giờ, xác thực phi trạng thái bằng HS256 thông qua Next.js Middleware mà không query database trên từng request, bảo đảm độ trễ phản hồi thấp nhất cho quầy thu ngân.
  - **Đánh đổi bảo mật**: Việc thay đổi vai trò (role) hoặc vô hiệu hóa tài khoản nhân viên trong database chỉ có hiệu lực triệt để khi phiên làm việc hiện tại hết hạn hoặc người dùng đăng xuất.
  - **Mở rộng tương lai (Phase 02+)**: Nếu cần cơ chế thu hồi quyền ngay lập tức (immediate revocation), hệ thống có thể bổ sung trường `token_version` so khớp phiên hoặc quản lý danh sách đen (token blacklist) qua Redis/in-memory cache.

- **Chống giả mạo Header (Header Spoofing Protection)**:
  - Next.js Middleware tự động bóc tách (strip) toàn bộ header `x-user-*` được client gửi lên trước khi chuyển giao request cho server components hoặc API handlers.
  - Chỉ các request có cookie JWT hợp lệ mới được giải mã và gán header người dùng đã xác minh (`x-user-role`, `x-user-id`, `x-user-name`).

- **Bảo vệ đường dẫn tĩnh & Ngăn chặn Bypass**:
  - Biểu thức chính quy bỏ qua asset tĩnh (ảnh, css, js) không bao giờ áp dụng cho các tiền tố `/api/*` và `/admin/*`, ngăn chặn triệt để hành vi bypass xác thực qua đuôi file.


## 5. In ấn (Thermal Printing Architecture - Phase 05)

Hệ thống in nhiệt mạng LAN theo chuẩn ESC/POS phục vụ in phiếu chế biến KOT, phiếu tạm tính, hóa đơn thanh toán, phiếu thu chi tiền mặt, báo cáo kết ca (Z-Report) và điều khiển kích xung mở két tiền (RJ12).

### 5.1 Các tính năng & Quyết định cốt lõi
- **Định tuyến Bếp & Quầy Bar độc lập (DEC-07)**:
  - Khi nhân viên bấm "Gửi Bếp", hệ thống tự động tách danh sách món ăn chuyển tới máy in Bếp (`targetPrinter: "KITCHEN"`) và đồ uống chuyển tới máy in Bar (`targetPrinter: "BAR"`).
  - Một lần gửi bếp tách tối đa 2 phiếu chế biến độc lập, chỉ chứa các món chưa gửi.
- **Mở két tiền tự động RJ12 (DEC-11)**:
  - Tự động kích xung điện `ESC p 0 25 250` tới máy in hóa đơn sau khi hoàn tất thanh toán (tiền mặt và VietQR) hoặc khi lập phiếu thu/chi tiền mặt.
  - Có thể bật/tắt qua cờ cấu hình `drawer.enabled` trong bảng `settings`.
- **Hóa đơn có Logo & QR Wi-Fi (DEC-13)**:
  - In Logo quán ở đầu hóa đơn và in mã QR quét kết nối Wi-Fi miễn phí ở chân bill (`WIFI:S:<SSID>;T:<Security>;P:<Password>;;`).
- **Khổ giấy tương thích (NFR-06)**:
  - Hỗ trợ cả khổ 80mm (576 dots raster) và khổ 58mm (384 dots raster).
- **Chống lỗi máy in làm gián đoạn nghiệp vụ (AC-03-2, BR-12)**:
  - Hàng đợi `print_jobs` được ghi nhận `PENDING` ngay trong transaction nghiệp vụ; lệnh in được gửi sau khi transaction đã commit.
  - Nếu máy in bị rút dây mạng hoặc kẹt giấy, đơn hàng vẫn được lưu 200 OK trên POS kèm cảnh báo `ERR-06`: *"Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!"* và nút "Thử in lại" (`POST /api/v1/print-jobs/:id/retry`).
- **Phòng chống SSRF trên cấu hình máy in**:
  - API cài đặt máy in (`PUT /api/v1/settings/printers`) chỉ dành cho `QUAN_LY`, kiểm soát nghiêm ngặt địa chỉ IP thuộc các dải mạng riêng hợp lệ (RFC 1918: `10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16` và Loopback `127.0.0.0/8`), từ chối mọi IP công cộng nhằm ngăn chặn tấn công SSRF.

### 5.2 Scripts kiểm thử & Xem trước
- **Xem trước bản in (PNG)**:
  ```bash
  npm run print:preview
  ```
  Tạo tự động 12 file ảnh xem trước trực quan (cho 6 mẫu in x 2 khổ giấy 80mm & 58mm) vào thư mục `tmp/print-preview/`.
- **In thử nghiệm tới máy in thật**:
  ```bash
  npm run print:test -- <ip> <kitchen|bar|receipt>
  # Ví dụ:
  npm run print:test -- 192.168.1.200 kitchen
  npm run print:test -- 192.168.1.202 receipt
  ```


## 6. Xác thực PIN Quản lý & Nhật ký Kiểm toán (Phase 06)

Hệ thống cung cấp cơ chế phê duyệt bằng mã PIN Quản lý cho các thao tác nhạy cảm và ghi nhận nhật ký kiểm toán (`audit_logs`, chỉ ghi thêm qua ứng dụng; chưa có cơ chế chống sửa trực tiếp trong cơ sở dữ liệu) theo quy chuẩn US-06, FR-10, BR-03, BR-04, NFR-03, ERR-02, ERR-03.

### 6.1 Thao tác nhạy cảm yêu cầu phê duyệt Quản lý
- **Hủy / Giảm số lượng món đã gửi bếp** (`POST /api/v1/orders/:id/items`): Yêu cầu mã PIN Quản lý và lý do hủy tối thiểu 5 ký tự. Khi được duyệt, hệ thống tự động phát sinh phiếu in hủy bếp `KOT_CANCEL` hiển thị tên người duyệt (`approverName`).
- **Áp dụng giảm giá đơn hàng** (`POST /api/v1/orders/:id/discount`): Giảm theo số tiền cố định (VNĐ) hoặc phần trăm (%), yêu cầu mã PIN Quản lý và lý do. Cột `discount_percent` được lưu độc lập để tự động tính lại chính xác khi thay đổi món.
- **Hủy toàn bộ đơn hàng có món** (`POST /api/v1/orders/:id/cancel`): Yêu cầu mã PIN Quản lý và lý do tối thiểu 5 ký tự.
- **Bảo vệ Optimistic Locking (`expectedVersion`)**: API giảm giá và hủy đơn bắt buộc truyền `expectedVersion` nhằm ngăn chặn xung đột ghi đồng thời (trả về 409 Conflict khi phiên bản không khớp).

### 6.2 Chính sách bảo mật mã PIN & Khóa tài khoản
- **Độ phức tạp mã PIN (`src/server/approvals/pin-policy.ts`)**:
  - Mã PIN gồm từ 4 đến 6 chữ số (`^\d{4,6}$`).
  - Từ chối các mã PIN yếu hoặc dễ đoán: 4 chữ số trùng nhau (`1111`, `9999`), chuỗi tăng/giảm liên tiếp (`1234`, `4321`, `6789`), 2 cặp số lặp (`1212`, `6868`), và năm sinh phổ biến (1950 đến 2030).
  - Không cho phép trùng với mã PIN của Quản lý khác đang hoạt động trong hệ thống.
- **Cơ chế khóa tài khoản tự động (Account Lockout)**:
  - Sai liên tiếp 5 lần mã PIN Quản lý hoặc mật khẩu đăng nhập: Khóa tài khoản trong vòng 5 phút (`ERR-03`, HTTP 429 Too Many Requests).
  - Giao diện Modal trên POS hiển thị cảnh báo `ERR-02` kèm đồng hồ đếm ngược (`Statistic.Countdown`), giữ nguyên lý do đã nhập và xóa mã PIN để người dùng thử lại sau khi hết thời gian khóa.
  - Phục hồi an toàn: Nhập mật khẩu đúng sau khi hết hạn khóa sẽ tự động đặt lại bộ đếm lỗi về 0.

### 6.3 Nhật ký kiểm toán toàn vẹn (`audit_logs`)
- Bảng `audit_logs` lưu vết chi tiết: `user_id`, `username`, `action`, `entity_type`, `entity_id`, `reason` (>= 5 ký tự), `metadata`, `ip_address`, `user_agent`, và dấu thời gian `created_at`.
- Các hành động được kiểm toán tự động: `CANCEL_KITCHEN_ITEM`, `DISCOUNT_ORDER`, `CANCEL_ORDER`, `DELETE_EMPTY_ORDER`, `REMOVE_UNSENT_ITEM`, `SETTINGS_CHANGED`, `PIN_CHANGED`, `LOGIN_FAILED`, `LOGIN_LOCKED`.
- **Ghi chú rủi ro đã chấp nhận (Accepted Risk)**:
  Cơ chế khóa đăng nhập dựa theo `username` có thể bị kẻ xấu lợi dụng để tạm thời khóa tài khoản của người khác bằng cách cố ý gửi liên tiếp 5 lần mật khẩu sai. Rủi ro này được chấp nhận trong môi trường F&B nội bộ quán vì: (1) Các phiên làm việc đã đăng nhập trước đó vẫn hoạt động bình thường mà không bị ngắt quãng; (2) Tài khoản tự động mở khóa sau 5 phút; (3) Chưa áp dụng khóa theo địa chỉ IP do cờ `TRUST_PROXY` mặc định tắt (`false`) để tránh rủi ro giả mạo IP client trên mạng LAN.


## 7. Thanh toán tiền mặt, Bán tại quầy/mang về & Hủy hóa đơn (Phase 07)

Hệ thống cung cấp quy trình thanh toán tiền mặt tại quầy & tại bàn, in phiếu tạm tính, in lại hóa đơn, và hủy hóa đơn sau thanh toán có duyệt mã PIN Quản lý (US-05, US-07, FR-05, FR-11, FR-13, BR-08, BR-10, BR-12, ERR-08, ERR-10, DEC-11, DEC-12).

### 7.1 Thanh toán tiền mặt & Kích mở két tiền (SCR-06, DEC-11)
- **Phương thức thanh toán**: Tiền mặt (`TIEN_MAT`), chuẩn bị sẵn sàng mở rộng VietQR tĩnh và động ở Phase 08.
- **Hộp gợi ý tiền khách đưa nhanh**: Cung cấp các nút mệnh giá phổ biến VNĐ (500.000đ, 200.000đ, 100.000đ, 50.000đ, 20.000đ, 10.000đ, và "Đủ tiền"), tự động tính tiền thừa trả khách (`tienThua = tienKhachDua - finalAmount`). Chặn thanh toán nếu tiền khách đưa nhỏ hơn tổng tiền phải trả (ERR-08).
- **Giao dịch thanh toán nguyên tử (Atomic Payment Transaction)**:
  - Cập nhật đơn hàng: `status = 'DA_THANH_TOAN'`, `paymentStatus = 'PAID'`, `completedAt = now()`.
  - Khóa bàn: Đối với đơn tại bàn (`orderType = 'DINE_IN'`), tự động chuyển bàn về `BAN_TRONG` (trừ khi bàn có đơn ghép khác chưa thanh toán).
  - Bản ghi thanh toán: Tạo bản ghi trong bảng `payments` với trạng thái `COMPLETED`.
  - Sinh số thứ tự lấy đồ (`queue_number`): Áp dụng khóa `pg_advisory_xact_lock(hashtext('queue_number_YYYY-MM-DD'))` để cấp số thứ tự 1..N duy nhất và không ngắt quãng trong ngày cho cả đơn tại quầy và mang về (tự động quay về 1 khi bước qua 00:00 ngày mới).
  - Hàng đợi in: Tạo phiếu in hóa đơn thanh toán `RECEIPT_FINAL` (có cờ `kickDrawer: true` để kích xung mở két tiền) và phiếu lấy đồ `PICKUP_TICKET` cho khách mang về. Hỗ trợ tùy chọn bỏ qua in phiếu nhận đồ (`printPickupTicket: false`) qua checkbox trên giao diện thu ngân đối với đơn mang về chỉ gồm các món đóng gói sẵn không qua bếp/bar chế biến.
  - Ngăn chặn thanh toán kép đồng thời (Double Payment Protection): Sử dụng `expectedVersion` và khóa `FOR UPDATE` tuần tự hóa các yêu cầu thanh toán trùng lặp.

### 7.2 In phiếu tạm tính (Provisional Bill - FR-11)
- Cho phép in phiếu tạm tính (`RECEIPT_TEMP`) để khách hàng kiểm tra chi tiết các món trước khi thanh toán.
- Đổi trạng thái bàn thành `CHO_THANH_TOAN` (màu cam trên sơ đồ bàn).
- Lệnh in phiếu tạm tính không mở két tiền (`kickDrawer: false`).
- Xử lý cảnh báo lỗi máy in (`ERR-10`): Nếu máy in hóa đơn mất kết nối, hệ thống vẫn lưu trạng thái bàn `CHO_THANH_TOAN` và trả về cảnh báo để thu ngân biết mà không làm gián đoạn nghiệp vụ phục vụ.

### 7.3 Tính bất biến của hóa đơn sau thanh toán (BR-08) & In lại hóa đơn (FR-13)
- **Tính bất biến (Immutability)**: Ngay khi đơn hàng chuyển sang `DA_THANH_TOAN`, hệ thống đóng băng toàn bộ đơn hàng. Mọi hành vi sửa món, thêm món, giảm giá, hoặc hủy món đều bị chặn tuyệt đối (HTTP 409 Conflict).
- **In lại hóa đơn (`POST /api/v1/orders/:id/reprint`)**:
  - Hỗ trợ in lại hóa đơn đã thanh toán khi khách yêu cầu thêm liên hóa đơn hoặc máy in trước đó bị hết giấy.
  - Bản in lại được đóng dấu "BẢN IN LẠI / REPRINT" rõ ràng để chống gian lận.
  - Lệnh in lại KHÔNG kích mở két tiền (`kickDrawer: false`).

### 7.4 Hủy hóa đơn sau thanh toán (Void Bill - US-07, BR-10, DEC-12)
- Hỗ trợ xử lý trường hợp thu ngân bấm nhầm đơn hoặc khách đổi ý hoàn trả sau khi đã hoàn tất thanh toán.
- **Ràng buộc ca làm việc (BR-10)**: Chỉ được phép hủy hóa đơn trong ca làm việc đang mở (`DANG_MO`). Nếu ca đã chốt (Z-Report), hệ thống từ chối hủy (HTTP 409).
- **Phê duyệt Quản lý bắt buộc**: Yêu cầu xác thực mã PIN Quản lý (`withManagerApproval`) và lý do hủy tối thiểu 5 ký tự.
- **Giao dịch nguyên tử**:
  - Cập nhật trạng thái đơn hàng thành `DA_HUY`.
  - Cập nhật trạng thái thanh toán thành `VOIDED`.
  - Ghi nhận nhật ký kiểm toán `audit_logs` với hành động `VOID_BILL`, lưu vết người duyệt, mã PIN, lý do và metadata tài chính đối soát doanh thu ca.

### 7.5 Quầy bán mang về (Takeaway Counter - SCR-04, US-05)
- Màn hình bán hàng nhanh tại quầy (`/counter`), phục vụ khách mua mang về không gắn bàn (`orderType: 'TAKEAWAY'`).
- Tích hợp giỏ hàng chạm cảm ứng, phím tăng/giảm số lượng nhanh, chọn món ăn kèm, ghi chú món ăn.
- Tích hợp ngăn kéo xem danh sách "Hóa đơn trong ca" (`ShiftInvoicesDrawer`) giúp thu ngân tra cứu nhanh doanh thu ca, thực hiện in lại hóa đơn hoặc hủy hóa đơn nhanh chóng ngay tại quầy.
