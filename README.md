# POS F&B - Phần Mềm Bán Hàng Nhà Hàng / Cafe

Hệ thống POS (Point of Sale) chuyên biệt cho ngành F&B (Nhà hàng, Quán cafe, Trà sữa) xây dựng trên nền tảng Next.js 15 (App Router), Ant Design 5, Drizzle ORM và PostgreSQL.

## 1. Yêu cầu môi trường & Cài đặt

- **Node.js**: >= 20.x
- **PostgreSQL**: 16+ (Chạy qua Docker container `pos-postgres` tại cổng `15450`)
- **Docker**:
  ```bash
  # Chạy database phát triển
  docker compose up -d pos-postgres
  ```

### Cài đặt dependencies & Chạy dự án:
```bash
npm ci
npm run db:migrate
npm run seed:menu   # Tải menu mẫu
npm run dev         # Khởi chạy Next.js dev server tại http://localhost:3000
```

### Biến môi trường (.env):
Xem chi tiết file `.env.example`. Một số biến quan trọng:
- `DATABASE_URL`: Đường dẫn kết nối database PostgreSQL dev.
- `DATABASE_TEST_URL`: Đường dẫn kết nối database chạy test tự động (`postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p06`).
- `JWT_SECRET`: Khóa bí mật ký token JWT (tối thiểu 32 ký tự trên production).
- `COOKIE_SECURE`: Cờ bật secure cookie (đặt `false` trong mạng LAN local HTTP).
- `TRUST_PROXY`: Cờ tin cậy reverse proxy (`true` nếu đứng sau Nginx/Cloudflare, `false` trong mạng LAN độc lập để tránh giả mạo IP).

---

## 2. Kiểm thử tự động (Testing)

Hệ thống sử dụng Vitest với database test riêng biệt:
```bash
# Chạy toàn bộ test suites
DATABASE_TEST_URL=postgres://pos:pos_dev_pw@127.0.0.1:15450/pos_test_p06 npm test

# Kiểm tra linting và typecheck
npm run lint
npx tsc --noEmit
npm run build
```

---

## 3. Quản lý in ấn nhiệt (ESC/POS Printing)

- Xem trước mẫu in trên canvas:
  ```bash
  npm run print:preview
  ```
  Ảnh PNG mẫu in được xuất tại thư mục `tmp/print-preview/`.

---

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
- **Thứ tự duyệt Quản lý ổn định**: `verifyManagerPin` so khớp mã PIN với các Quản lý theo thứ tự ID ổn định (`ORDER BY users.id`).

### 6.2 Các thao tác nhạy cảm được bảo vệ
- **Hủy hoặc giảm số lượng món đã gửi bếp (BR-03, FR-10)**:
  - Cho phép hủy hoặc giảm số lượng món đã in qua `POST /api/v1/orders/:id/items` khi có lý do tối thiểu 5 ký tự và mã PIN Quản lý.
  - Phê duyệt được xác thực trước khi mở transaction khóa đơn để tránh cạn kiệt connection pool.
  - Cập nhật dòng món (`isCancelled: true` hoặc giảm `quantity`), lưu `cancelReason`, tính toán lại tổng tiền và khách cần trả.
  - Tự động tạo phiếu báo hủy KOT (`KOT_CANCEL`) kèm tên người duyệt (`approverName`) gửi tới máy in Bếp (`targetPrinter: "KITCHEN"`) hoặc Bar (`targetPrinter: "BAR"`) tương ứng; dispatch sau khi transaction commit.
  - Xóa hoặc chỉnh sửa món chưa gửi bếp không yêu cầu mã PIN, ghi nhận audit log `REMOVE_UNSENT_ITEM`.
- **Giảm giá, chiết khấu hóa đơn (`POST /api/v1/orders/:id/discount`)**:
  - Hỗ trợ giảm giá theo số tiền cố định (VNĐ) hoặc theo phần trăm (0 - 100%).
  - Bắt buộc truyền `expectedVersion` để chống xung đột ghi đồng thời (HTTP 409 khi lệch version).
  - Từ chối nếu truyền đồng thời cả số tiền và phần trăm giảm giá (HTTP 400).
  - Phần trăm giảm giá được lưu bền vững vào cột `orders.discount_percent` (Migration 0005). Khi thêm/bớt món sau đó, hàm tính toán lại sẽ tự động áp dụng đúng tỷ lệ % này (kể cả đơn ban đầu rỗng với giảm giá 0đ). Nếu giảm theo số tiền cố định, `discount_percent` được đặt `null` và số tiền giảm được giới hạn tối đa theo tổng tiền mới.
- **Hủy hóa đơn đang phục vụ có món đã gửi bếp (`POST /api/v1/orders/:id/cancel`)**:
  - Bắt buộc `expectedVersion`, yêu cầu mã PIN Quản lý và lý do (>= 5 ký tự).
  - Chuyển trạng thái đơn về `DA_HUY`, giải phóng bàn về `TRONG`, tự động gửi phiếu báo hủy KOT cho các món đã gửi chế biến kèm tên người duyệt.
  - Lưu đầy đủ `tableId`, `tableName` và danh sách món hủy vào metadata nhật ký kiểm toán.
  - Hóa đơn đã thanh toán (`DA_THANH_TOAN`) bị chặn với HTTP 409 (BR-08).

### 6.3 Phân quyền & Ma trận thẩm quyền
- **Thứ tự kiểm tra thẩm quyền**: Hàm phê duyệt `withManagerApproval` luôn kiểm tra quyền hạn (`can()`) TRƯỚC KHI kiểm tra độ dài lý do. Các vai trò không đủ thẩm quyền (như Phục vụ yêu cầu giảm giá hoặc hủy đơn) luôn nhận mã lỗi HTTP 403 Forbidden bất kể lý do nhập vào có hợp lệ hay không.
- **Ma trận phân quyền (SRS mục 2.5)**:
  - `QUAN_LY`: Được phép tự thực hiện mọi thao tác nhạy cảm mà không cần nhập mã PIN (nhưng bắt buộc nhập lý do >= 5 ký tự và hệ thống vẫn ghi nhận nhật ký kiểm toán với người duyệt là chính mình).
  - `THU_NGAN`: Được phép hủy món, giảm giá và hủy đơn khi có mã PIN Quản lý.
  - `PHUC_VU`: Chỉ được phép hủy món đã gửi bếp khi có mã PIN Quản lý. Các thao tác giảm giá và hủy đơn bị chặn tuyệt đối (HTTP 403) kể cả khi cung cấp đúng mã PIN.

### 6.4 Khóa đăng nhập (Login Lockout) & Thời hạn phiên làm việc (12 giờ)
- **Khóa tài khoản khi đăng nhập sai (BR-04)**:
  - Bộ đếm sai và thời gian khóa lưu tại `users.login_failed_count` và `users.login_locked_until` (Migration 0005).
  - Nhập sai mật khẩu liên tiếp 5 lần sẽ khóa tài khoản trong 5 phút, trả về HTTP 429: *"Tài khoản đã bị tạm khóa do nhập sai mật khẩu quá 5 lần. Vui lòng thử lại sau 5 phút."*.
  - Trong thời gian khóa, hệ thống từ chối ngay mà không kiểm tra mật khẩu.
  - So khớp mật khẩu giả lập bcrypt với thời gian đồng đều cho username không tồn tại để chống tấn công dò tìm tài khoản (timing attack / username enumeration).
  - Ghi nhận nhật ký kiểm toán `LOGIN_FAILED` và `LOGIN_LOCKED`.
- **Áp dụng cho chức năng đổi PIN (`PUT /api/v1/users/me/pin`)**:
  - Quản lý nhập sai mật khẩu hiện tại khi đổi PIN cũng tính vào bộ đếm `login_failed_count` và chịu chung quy tắc khóa 5 phút.
- **Thời hạn JWT & Cookie (12 giờ)**:
  - Do máy POS được sử dụng chung giữa các nhân viên trong ca làm việc, thời hạn sống của Cookie JWT (`pos_token`) được cấu hình chính xác **12 giờ** (thay vì 7 ngày) nhằm đảm bảo an toàn phiên làm việc.

### 6.5 Chính sách mã PIN Quản lý
- **Quy tắc độ phức tạp mã PIN**:
  - Từ chối các mã PIN có các chữ số giống nhau hoàn toàn (`0000`, `1111`, `2222`...).
  - Từ chối dãy số tăng hoặc giảm liên tiếp (`1234`, `4321`, `123456`, `654321`...).
  - Từ chối các mẫu lặp cặp (`1212`, `1122`, `112233`...).
  - Từ chối các năm sinh từ 1950 đến 2030 đối với mã PIN 4 chữ số.
  - Từ chối mã PIN trùng khớp với mã PIN đang sử dụng của bất kỳ Quản lý nào khác trong hệ thống mà không làm lộ thông tin người dùng khác.
  - Ghi nhận nhật ký kiểm toán `PIN_CHANGED` (tuyệt đối không ghi nhận mã PIN).

### 6.6 Cấu hình hệ thống & Bảo vệ Proxy
- **Cấu hình `approval.pinRequired` (SRS mục 10)**:
  - Cờ cấu hình trong bảng `settings` (mặc định: `true`).
  - **CẢNH BÁO AN TOÀN**: Tùy chọn tắt yêu cầu mã PIN (`pinRequired = false`) **CHỈ CHO PHÉP TRONG MÔI TRƯỜNG DEV/TEST**. Trên môi trường `production` (`NODE_ENV === "production"`), thao tác tắt cờ này bị chặn tuyệt đối với HTTP 403.
  - Mọi thay đổi cấu hình đều ghi nhận nhật ký kiểm toán `SETTINGS_CHANGED` lưu trữ giá trị cũ và mới.
- **Biến môi trường `TRUST_PROXY`**:
  - `TRUST_PROXY=true`: Hệ thống mới đọc địa chỉ IP từ các tiêu đề `X-Forwarded-For` và `X-Real-IP`.
  - `TRUST_PROXY=false` (mặc định): Hệ thống ghi `ip_address: null` trong audit log để phòng chống kẻ tấn công giả mạo tiêu đề IP trong mạng nội bộ.
  - Mọi dòng nhật ký kiểm toán tự động lưu trữ `username` và `userAgent` (cắt tối đa 200 ký tự) vào trường `metadata`.
