# Deployment Guide

## 1. Môi trường triển khai quán (Local LAN Server)
- Ứng dụng chạy trên máy chủ mini PC hoặc máy POS đặt tại quán để trực tiếp kết nối máy in LAN cổng 9100.
- Docker PostgreSQL chạy cổng `15450`.
- Khởi động Next.js bằng `npm run build && npm start` hoặc pm2 / systemd service.

## 2. Kiểm tra trước khi bàn giao
- Chạy `npm run lint` để bảo đảm chất lượng code.
- Chạy `npm test` để xác minh toàn bộ 50 kiểm thử tự động.
- Chạy `npm run build` để kiểm tra đóng gói sản phẩm.
- Chạy migration và seed ít nhất 2 lần để đảm bảo tính idempotent.
