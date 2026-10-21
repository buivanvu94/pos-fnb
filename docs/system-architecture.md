# System Architecture

## 1. Mô hình tổng quan
- **Client Tier**: Web App trên trình duyệt Chrome/Edge tối ưu cảm ứng, giao tiếp API qua HTTP/REST và cookie JWT httpOnly.
- **Server Tier**: Next.js App Router xử lý cả giao diện người dùng và API endpoints `/api/v1/*`.
- **Database Tier**: PostgreSQL quản lý lưu trữ quan hệ, khóa lạc quan bằng cột `version` trên hóa đơn.
- **Outbox Queue**: Bảng `outbox` lưu sự kiện để đồng bộ ngầm lên đám mây khi có kết nối Internet.
- **In ấn mạng nội bộ**: Kênh socket TCP 9100 trực tiếp tới máy in Bếp, Bar và Hóa đơn.
