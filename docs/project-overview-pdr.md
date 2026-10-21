# Project Overview & Product Definition (PDR)

## 1. Mục tiêu sản phẩm
Hệ thống POS F&B (Quán Ăn, Cafe) là giải pháp quản trị bán hàng tại điểm bán phục vụ cho một cửa hàng độc lập, chạy trên thiết bị cảm ứng hoặc PC tại quán, kết nối máy in nhiệt LAN và hiển thị mã thanh toán VietQR động.

## 2. Phạm vi giai đoạn 1 (Phase 01 - Foundation)
- Khởi tạo kiến trúc nền tảng Next.js App Router + TypeScript + Ant Design.
- Cấu hình cơ sở dữ liệu PostgreSQL với Drizzle ORM bao gồm 15 bảng nghiệp vụ.
- Quy định đơn vị tiền tệ VND nguyên số và cơ chế kiểm soát chênh lệch tiền ca làm việc.
- Danh mục lỗi chuẩn ERR-01 đến ERR-12 theo đúng nguyên văn BA/SRS.
- Ma trận phân quyền 17 hàng phủ 3 vai trò: Quản lý (`QUAN_LY`), Thu ngân (`THU_NGAN`), Phục vụ (`PHUC_VU`).
- Đăng nhập bảo mật tài khoản/mật khẩu, sinh JWT cookie httpOnly, bảo vệ route bằng Middleware.
