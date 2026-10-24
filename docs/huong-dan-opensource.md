# Hướng dẫn từng bước xuất bản Dự án mã nguồn mở (Open Source Guide)

Tài liệu này hướng dẫn chi tiết từ A đến Z giúp bạn tự tin xuất bản hệ thống **POS F&B** lên GitHub dưới dạng mã nguồn mở (AGPL-3.0) một cách an toàn và chuyên nghiệp nhất.

---

## BƯỚC 1: Chụp 4 ảnh giao diện (Screenshots)

Hình ảnh trực quan là yếu tố quan trọng nhất giúp dự án nhận được nhiều Star và sự chú ý trên GitHub.

### 1.1 Khởi động dự án ở máy bạn
Mở terminal hoặc chạy `start.bat`:
```bash
npm run dev
```
Truy cập trình duyệt tại: `http://localhost:3000`

### 1.2 Chụp các màn hình chính và lưu vào `docs/screenshots/`
Đăng nhập tài khoản mẫu: `quanly` / mật khẩu `123456` (hoặc `thungan`).

1. **Ảnh 1 — Màn hình bán hàng / Gọi món**:
   - Truy cập vào một bàn bất kỳ hoặc màn hình Thu ngân gọi món (`/pos` hoặc click vào bàn có món).
   - Chọn vài món vào giỏ hàng, mở topping.
   - Chụp màn hình và lưu với tên: `docs/screenshots/01-ban-hang-pos.png`.
2. **Ảnh 2 — Sơ đồ bàn & Trạng thái**:
   - Truy cập màn hình Sơ đồ bàn (`/tables`).
   - Hiển thị các bàn với các trạng thái khác nhau (bàn xanh trống, bàn vàng có khách).
   - Chụp màn hình và lưu với tên: `docs/screenshots/02-so-do-ban.png`.
3. **Ảnh 3 — Thanh toán VietQR động**:
   - Tại bàn có đơn hàng, bấm nút "Thanh toán", chọn phương thức **VietQR**.
   - Màn hình hiển thị mã QR kèm số tiền và đồng hồ đếm ngược.
   - Chụp màn hình và lưu với tên: `docs/screenshots/03-thanh-toan-vietqr.png`.
4. **Ảnh 4 — Quản lý ca & Bàn giao tiền mặt**:
   - Truy cập màn hình Quản lý ca (`/shifts` hoặc click thông tin ca ở góc trên).
   - Chụp màn hình mở ca/kết ca kiểm kê tiền mặt và lưu với tên: `docs/screenshots/04-quan-ly-ca.png`.

> **Mẹo**: Nhấn tổ hợp phím `Windows + Shift + S` trên Windows để chụp nhanh vùng cửa sổ trình duyệt.

---

## BƯỚC 2: Kiểm tra bảo mật lần cuối

Trước khi đẩy lên mạng, hãy đảm bảo:
1. File `.env` **KHÔNG** nằm trong danh sách file chuẩn bị commit (chỉ có `.env.example`).
2. Không có mật khẩu thật, số tài khoản cá nhân thật hoặc token Telegram thật được hardcode trong code.
3. Chạy lệnh kiểm tra:
```bash
git status
```
Đảm bảo các file `.env`, thư mục `.claude/`, `uploads/` không xuất hiện trong danh sách staging.

---

## BƯỚC 3: Lưu lại toàn bộ mã nguồn vào Git

Chạy các lệnh sau trong terminal để lưu commit:

```bash
# 1. Thêm toàn bộ các file mới và thay đổi
git add .

# 2. Tạo commit chuẩn bị xuất bản Open Source
git commit -m "chore: prepare repository for open source release under AGPL-3.0"
```

---

## BƯỚC 4: Tạo Repository trên GitHub và Đẩy mã nguồn lên

### 4.1 Tạo Repo trên GitHub
1. Đăng nhập vào tài khoản [GitHub](https://github.com).
2. Nhấn nút **New repository** (hoặc truy cập `https://github.com/new`).
3. Điền thông tin:
   - **Repository name**: `pos-fnb` (hoặc tên bạn thích, ví dụ: `fnb-pos-nextjs`).
   - **Description**: `Hệ thống POS bán hàng F&B (Quán ăn, Cafe) chuyên nghiệp — Next.js 15, React 19, Ant Design, VietQR, in nhiệt LAN ESC/POS.`
   - **Visibility**: Chọn **Public** (hoặc chọn **Private** trước nếu bạn muốn kiểm tra lại lần cuối trên GitHub rồi bấm Public sau).
   - **Khởi tạo**: *Bỏ chọn* (Không tích) vào "Add a README file", "Add .gitignore" vì dự án local của bạn đã có sẵn đầy đủ.
4. Nhấn **Create repository**.

### 4.2 Đẩy code từ máy tính lên GitHub
Sau khi tạo xong, GitHub sẽ hiển thị đường link repository dạng:
`https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git`

Chạy 3 lệnh sau trên máy tính của bạn:

```bash
# 1. Đổi tên nhánh chính thành main (nếu chưa)
git branch -M main

# 2. Gán link GitHub của bạn vào remote origin
git remote add origin https://github.com/<tai-khoan-cua-ban>/<ten-repo>.git

# 3. Đẩy toàn bộ mã nguồn lên GitHub
git push -u origin main
```

---

## BƯỚC 5: Tối ưu trang GitHub Repo để thu hút cộng đồng

Sau khi push thành công, vào trang repo trên GitHub và thực hiện:

1. **Chỉnh sửa mục About (bên góc phải giao diện GitHub)**:
   - **Description**: `Hệ thống POS bán hàng F&B cho quán ăn, cafe — Next.js 15 App Router, React 19, Ant Design 5, PostgreSQL, VietQR & ESC/POS LAN printing.`
   - **Topics / Tags** (thêm các thẻ sau để người dùng dễ search thấy):
     `pos`, `fnb`, `restaurant-pos`, `point-of-sale`, `nextjs15`, `react19`, `typescript`, `ant-design`, `vietqr`, `escpos-printer`, `postgresql`, `drizzle-orm`, `vietnam`
2. **Kiểm tra hiển thị README.md**:
   - Đảm bảo các badge và hình ảnh chụp màn hình hiển thị sắc nét.
3. **Mời gọi đóng góp**:
   - Nếu có người mở Issue hoặc Pull Request, hãy đón nhận và thảo luận cởi mở.
