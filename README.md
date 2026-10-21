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
├── components/           # UI Ant Design components (AntdProvider, MainLayout, menu, approval)
├── db/                   # Drizzle ORM schema, migrations, seed, sequential code generator
├── lib/                  # Tiện ích tiền tệ (money), danh mục lỗi (error-catalog), phân quyền (permissions)
├── server/               # Logic backend, xác thực JWT (require-role, jwt), menu service, approvals
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

- **Thời hạn hiệu lực Token & Đánh đổi Stateless JWT (7-Day Validity)**:
  - Token JWT có hạn 7 ngày, xác thực phi trạng thái bằng HS256 thông qua Next.js Middleware mà không query database trên từng request, bảo đảm độ trễ phản hồi thấp nhất cho quầy thu ngân.
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

## 6. Xác thực PIN Quản lý & Nhật ký kiểm toán (Phase 06)

Hệ thống xác thực mã PIN phê duyệt của Quản lý cho các thao tác nhạy cảm (US-06, FR-10, BR-03, BR-04, NFR-03, ERR-02, ERR-03) nhằm phòng chống gian lận và thất thoát doanh thu (RSK-02, DEC-03).

### 6.1 Cơ chế xác thực & Khóa an toàn
- **Độ dài mã PIN**: 4 đến 6 chữ số (`/^\d{4,6}$/`), băm bảo mật bằng `bcryptjs`. Tuyệt đối không lưu trữ, ghi nhật ký hay phản hồi mã PIN dạng văn bản rõ.
- **Bộ đếm sai & Khóa theo người thao tác**: Cột `pin_failed_count` và `pin_locked_until` nằm trên dòng người dùng đang thực hiện yêu cầu trong bảng `users`.
- **Khóa 5 phút khi sai quá 5 lần (BR-04, ERR-03)**:
  - Nếu nhập sai liên tiếp 5 lần, tài khoản bị khóa xác thực trong 5 phút, trả về mã lỗi HTTP 429 kèm thông báo `ERR-03`: *"Bạn đã nhập sai mã PIN quá 5 lần. Chức năng xác thực bị khóa tạm thời trong 5 phút!"*.
  - Trong thời gian 5 phút hiệu lực của khóa, mọi yêu cầu xác thực đều bị từ chối ngay lập tức với HTTP 429 `ERR-03` mà không thực hiện so khớp mã PIN (kể cả khi nhập đúng mã PIN).
  - Khi thời hạn khóa kết thúc, hệ thống tự động mở khóa và đặt lại bộ đếm về 0 ở lần xác thực tiếp theo.
- **Tính nguyên tử & Độc lập giao dịch**:
  - Việc tăng bộ đếm sai và gán khóa được thực thi trong một transaction độc lập đã commit với cơ chế khóa dòng (`FOR UPDATE`). Do đó, kể cả khi lệnh nghiệp vụ của người dùng bị roll back, bộ đếm số lần sai và trạng thái khóa vẫn được giữ nguyên vẹn.
  - Đảm bảo an toàn khi có nhiều request sai gửi đồng thời: hệ thống tuần tự hóa và khóa chính xác tại ngưỡng 5 lần mà không bị lọt.

### 6.2 Các thao tác nhạy cảm được bảo vệ
- **Hủy hoặc giảm số lượng món đã gửi bếp (BR-03, FR-10)**:
  - Cho phép hủy hoặc giảm số lượng món đã in qua `POST /api/v1/orders/:id/items` khi có lý do tối thiểu 5 ký tự và mã PIN Quản lý.
  - Cập nhật dòng món (`isCancelled: true` hoặc giảm `quantity`), lưu `cancelReason`, tính toán lại tổng tiền và khách cần trả.
  - Tự động tạo phiếu báo hủy KOT (`KOT_CANCEL`) gửi tới máy in Bếp (`targetPrinter: "KITCHEN"`) hoặc Bar (`targetPrinter: "BAR"`) tương ứng; dispatch sau khi transaction commit.
  - Xóa hoặc chỉnh sửa món chưa gửi bếp không yêu cầu mã PIN như thông thường.
- **Giảm giá, chiết khấu hóa đơn (`POST /api/v1/orders/:id/discount`)**:
  - Hỗ trợ giảm giá theo số tiền cố định (VNĐ) hoặc theo phần trăm (0 - 100%).
  - Ràng buộc: `0 <= GiảmGiá <= TổngTiền`, `KháchCầnTrả = TổngTiền - GiảmGiá` (không âm).
  - Tự động tính toán lại chính xác khi thêm/bớt món sau đó: nếu giảm theo phần trăm thì áp dụng lại tỷ lệ phần trăm trên tổng mới; nếu theo số tiền cố định thì giữ nguyên và giới hạn tối đa không vượt quá tổng mới.
- **Hủy hóa đơn đang phục vụ có món đã gửi bếp (`POST /api/v1/orders/:id/cancel`)**:
  - Yêu cầu mã PIN Quản lý và lý do (>= 5 ký tự).
  - Chuyển trạng thái đơn về `DA_HUY`, giải phóng bàn về `TRONG`, tự động gửi phiếu báo hủy KOT cho các món đã gửi chế biến.
  - Hóa đơn đã thanh toán (`DA_THANH_TOAN`) bị chặn với HTTP 409 (BR-08).

### 6.3 Phân quyền & Cờ cấu hình
- **Ma trận phân quyền (SRS mục 2.5)**:
  - `QUAN_LY`: Được phép tự thực hiện mọi thao tác nhạy cảm mà không cần nhập mã PIN (nhưng bắt buộc nhập lý do >= 5 ký tự và hệ thống vẫn ghi nhận nhật ký kiểm toán với người duyệt là chính mình).
  - `THU_NGAN`: Được phép hủy món, giảm giá và hủy đơn khi có mã PIN Quản lý.
  - `PHUC_VU`: Chỉ được phép hủy món đã gửi bếp khi có mã PIN Quản lý. Các thao tác giảm giá và hủy đơn bị chặn tuyệt đối (HTTP 403) kể cả khi cung cấp đúng mã PIN.
- **Cấu hình `approval.pinRequired` (SRS mục 10)**:
  - Cờ cấu hình trong bảng `settings` (mặc định: `true`).
  - Quản lý có thể cập nhật qua API `PUT /api/v1/settings/approval`.
  - **CẢNH BÁO AN TOÀN**: Tùy chọn tắt yêu cầu mã PIN (`pinRequired = false`) **CHỈ DÙNG TRONG MÔI TRƯỜNG PHÁT TRIỂN / KIỂM THỬ**. Khi tắt, hệ thống vẫn bắt buộc nhập lý do tối thiểu 5 ký tự và ghi nhật ký kiểm toán đầy đủ.
- **Đổi mã PIN Quản lý (`PUT /api/v1/users/me/pin`)**:
  - Quản lý có thể tự đặt hoặc đổi mã PIN cá nhân của mình sau khi xác thực mật khẩu đăng nhập hiện tại. Đặt lại bộ đếm sai về 0 và mở khóa.
