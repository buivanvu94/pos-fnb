# Design Guidelines

## 1. Nguyên tắc tối ưu màn hình cảm ứng
- Thiết kế cho màn hình POS 15-21 inch đặt tại quầy và thiết bị tablet nhân viên.
- Khoảng cách chạm rộng rãi, nút bấm lớn, không sử dụng menu chuột phải hoặc phím tắt phức tạp trên giao diện chạm.
- Màn hình bàn ăn cung cấp nhận diện trạng thái tức thời qua màu sắc viền thẻ bàn (Xanh/Đỏ/Vàng).

## 2. Thông báo & Lỗi người dùng
- Mọi thông báo lỗi nghiệp vụ bắt buộc phải trích xuất từ `error-catalog.ts` để đảm bảo hiển thị đúng 100% nguyên văn đặc tả BA.
- Không tự ý thêm bớt từ ngữ trong các thông báo chặn (ERR-01 đến ERR-12).
