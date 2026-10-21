# POS Bán Hàng F&B (Quán Ăn, Cafe) — Phiếu tiếp nhận yêu cầu

| Thông tin | Giá trị |
|---|---|
| Mã sáng kiến | pos-fnb |
| Phiên bản | 0.1 · Nháp |
| Ngày tiếp nhận | 2026-10-20 |
| Kênh | Chat trực tiếp với người dùng |
| Người yêu cầu | Chủ quán / Quản lý F&B |
| BA phụ trách | Antigravity BA Agent |

## 1. Yêu cầu nguyên văn

> "POS bán hàng quán ăn , cafe , có quản lý doanh thu , nhân viên , ca"

| ID | Nguồn | Loại | Ngày / phiên bản | Mức đọc |
|---|---|---|---|---|
| SRC-01 | Chat yêu cầu trực tiếp từ người dùng | Tin nhắn | 2026-10-20 | Toàn bộ yêu cầu ban đầu |

## 2. Vấn đề và mong muốn

- Vấn đề hiện tại: Cần hệ thống POS chuyên cho ngành F&B (quán ăn, cafe) để phục vụ gọi món, thanh toán nhanh, theo dõi dòng tiền doanh thu chính xác, minh bạch công ca và tiền mặt giữa các ca làm việc của nhân viên.
- Kết quả mong muốn: Phần mềm POS trực quan, kiểm soát luồng order/bàn/mang về, chốt ca kết ca chuẩn xác, phân quyền nhân viên rõ ràng, báo cáo doanh thu tức thời.
- Vì sao cần lúc này: Chuẩn bị triển khai vận hành kinh doanh thực tế cho mô hình quán ăn/cafe.

## 3. Phân loại

| Câu hỏi | Trả lời |
|---|---|
| Loại yêu cầu | Sản phẩm mới |
| Hệ thống liên quan đã có chưa | Chưa (xây dựng từ đầu) |
| Quy mô sơ bộ | Vừa (nhiều luồng nghiệp vụ: Bán hàng/Bàn, Quản lý ca/tiền mặt, Nhân viên & Phân quyền, Báo cáo doanh thu) |

## 4. Bên liên quan đã biết

| Vai trò | Quan tâm chính | Ai quyết định |
|---|---|---|
| Chủ quán / Quản lý | Báo cáo doanh thu, lệch tiền ca, quản lý nhân viên và thực đơn | Có |
| Thu ngân / Nhân viên order | Thao tác bán hàng, in bill, mở ca, bàn giao tiền cuối ca | Không |
| Nhân viên Bếp / Bar | Nhận order (KOT/ticket), thời gian chế biến món | Không |

## 5. Ràng buộc đã biết

- Nghiệp vụ F&B đặc thù: Giờ cao điểm order dồn dập, chia/gộp bàn, chuyển bàn, order mang về (takeaway) vs tại bàn (dine-in).
- Quản lý ca bắt buộc phải có kiểm kê tiền mặt đầu ca - cuối ca để phát hiện lệch tiền.

## 6. Giả định ban đầu

| ID | Giả định | Cần ai xác nhận |
|---|---|---|
| AS-01 | Giai đoạn 1 tập trung vào 1 cửa hàng độc lập trước khi mở rộng chuỗi đa chi nhánh | Chủ quán |
| AS-02 | Hỗ trợ in bill hóa đơn nhiệt (80mm/58mm) và quét mã VietQR tĩnh/động khi thanh toán | Chủ quán |

## 7. Câu hỏi còn mở

| ID | Câu hỏi | Vì sao quan trọng | Hỏi ai | Trạng thái |
|---|---|---|---|---|
| OQ-01 | Mô hình phục vụ chính của quán là trả trước tại quầy (Fast-casual/Cafe) hay gọi món tại bàn trả tiền sau (Full-service)? | Định hình luồng màn hình POS chính và quy trình order | Chủ quán | Đã trả lời (DEC-01) |
| OQ-02 | Quy trình bàn giao ca có yêu cầu Quản lý duyệt chốt ca không, hay Thu ngân tự chốt? | Quyết định quy trình kiểm soát thất thoát tiền mặt | Chủ quán | Đã trả lời (DEC-02) |
| OQ-03 | Có cần quản lý định lượng kho nguyên vật liệu (Inventory BOM) ngay đợt 1 không? | Ảnh hưởng lớn đến phạm vi kiến trúc và thời gian phát triển | Chủ quán | Đã trả lời (DEC-04) |
| OQ-04 | Nền tảng thiết bị triển khai chính là Web trên PC/máy POS chạm hay Tablet/Mobile? | Quyết định thiết kế UX/UI màn hình và thiết bị ngoại vi | Chủ quán | Đã trả lời (DEC-05) |

## 8. Sẵn sàng sang brainstorm

- [x] Biết ai là người dùng chính và ai quyết định.
- [x] Biết vấn đề nghiệp vụ, không chỉ giải pháp khách tự đề xuất.
- [x] Các câu hỏi chặn phạm vi đã ghi ở mục 7.

{dev} Bước tiếp: `brainstorm pos-fnb`.

## Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi | Nguồn |
|---|---|---|---|
| 0.1 | 2026-10-20 | Tạo phiếu tiếp nhận từ yêu cầu của người dùng | Tin nhắn trực tiếp |
