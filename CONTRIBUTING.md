# Hướng dẫn đóng góp (Contributing Guide)

Cảm ơn bạn đã quan tâm đến dự án **POS F&B**! Chúng tôi hoan nghênh và đánh giá cao mọi đóng góp từ cộng đồng nhà phát triển, từ sửa lỗi nhỏ, cải thiện tài liệu đến đề xuất tính năng mới.

---

## 📜 Quy tắc ứng xử (Code of Conduct)

Dự án tuân theo [Code of Conduct](CODE_OF_CONDUCT.md). Vui lòng tôn trọng và đối xử văn minh với mọi thành viên trong cộng đồng.

---

## 🛠️ Thiết lập môi trường phát triển (Local Development)

### Yêu cầu tiên quyết
- **Node.js**: >= 18.x
- **PostgreSQL**: 16.x (hoặc Docker & Docker Compose)
- **Git**

### Các bước cài đặt:
1. **Fork và clone repository:**
   ```bash
   git clone https://github.com/<tai-khoan-cua-ban>/pos-fnb.git
   cd pos-fnb
   ```

2. **Cài đặt thư viện dependencies:**
   ```bash
   npm install
   ```

3. **Cấu hình môi trường:**
   ```bash
   cp .env.example .env
   ```
   Điều chỉnh chuỗi kết nối cơ sở dữ liệu `DATABASE_URL` trong file `.env` nếu cần.

4. **Khởi động database (Docker):**
   ```bash
   docker compose up -d
   ```

5. **Chạy Migration & Seed:**
   ```bash
   npm run db:migrate
   npm run db:seed
   ```

6. **Khởi chạy máy chủ phát triển:**
   ```bash
   npm run dev
   ```
   Mở trình duyệt tại [http://localhost:3000](http://localhost:3000).

---

## 🧪 Kiểm thử & Chất lượng mã nguồn

Trước khi gửi Pull Request, hãy đảm bảo rằng toàn bộ kiểm tra chất lượng và unit/integration tests đều vượt qua:

```bash
# Kiểm tra định dạng và lỗi linter
npm run lint

# Chạy toàn bộ Unit & Integration tests
npm run test

# Chạy End-to-End tests (Playwright)
npm run test:e2e
```

---

## 🌿 Quy tắc nhánh và Commit (Conventional Commits)

### Tên nhánh:
- `feat/<ten-tinh-nang>`: Tính năng mới
- `fix/<ten-loi>`: Sửa lỗi
- `docs/<ten-tai-lieu>`: Tài liệu
- `refactor/<ten-thay-doi>`: Tối ưu cấu trúc code

### Cú pháp Commit Message:
Sử dụng chuẩn [Conventional Commits](https://www.conventionalcommits.org/):
- `feat: thêm modal tách hóa đơn cho bàn nhiều khách`
- `fix: xử lý timeout khi in ESC/POS qua mạng LAN chậm`
- `refactor: tối ưu hóa giỏ hàng và bộ nhớ đệm thực đơn`
- `test: bổ sung integration test cho luồng kết ca Z-Report`
- `docs: cập nhật sơ đồ kiến trúc và hướng dẫn triển khai`

---

## 🚀 Quy trình gửi Pull Request (PR)

1. Tạo nhánh mới từ `main`.
2. Thực hiện thay đổi của bạn, viết unit test nếu có logic mới.
3. Chạy `npm run lint` và `npm run test` để đảm bảo không có hồi quy (regression).
4. Đẩy nhánh lên fork của bạn:
   ```bash
   git push origin feat/<ten-tinh-nang>
   ```
5. Mở Pull Request vào nhánh `main` của repository gốc.
6. Điền đầy đủ thông tin theo mẫu PR Template, giải thích lý do thay đổi và đính kèm ảnh chụp màn hình (nếu có thay đổi giao diện).

Cảm ơn bạn đã chung tay xây dựng giải pháp POS F&B mã nguồn mở cho cộng đồng!
