# Code Standards & Conventions

## 1. Quy ước đặt tên và cấu trúc
- Tên file tuân theo chuẩn `kebab-case`.
- Mọi file mã nguồn không vượt quá 200 dòng code; tách nhỏ module nếu dài.
- Chú thích code rõ ràng, mang tính mô tả logic nghiệp vụ.

## 2. Quy ước Ant Design
- Sử dụng duy nhất Ant Design cho giao diện người dùng; không pha trộn thư viện UI khác.
- Chiều cao chạm tối thiểu `controlHeight >= 44px` cho toàn bộ nút bấm và ô nhập liệu.
- Bọc toàn bộ ứng dụng trong `ConfigProvider` locale `vi_VN` và component `App` của antd.
- Màu sắc trạng thái bàn:
  - Bàn trống: `#52c41a` (Xanh lá)
  - Đang phục vụ: `#ff4d4f` (Đỏ)
  - Chờ thanh toán: `#faad14` (Vàng)

## 3. Quy ước Dữ liệu & Tiền tệ
- Tiền tệ VND là số nguyên không âm, không có phần thập phân.
- Định dạng hiển thị chuẩn `vi-VN`.
- Mã ca `CA-YYYYMMDD-nn` và mã hóa đơn `HD-YYYYMMDD-nnnn` phải được sinh bên trong transaction kèm khóa giao dịch.
