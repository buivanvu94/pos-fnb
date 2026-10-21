# POS Bán Hàng F&B (Quán Ăn, Cafe) — Danh mục điều kiện kiểm thử

| Thông tin | Giá trị |
|---|---|
| Phiên bản | 1.0 · Đã duyệt |
| Đầu vào | 05-userstories.md v0.1 · 03-srs.md v0.1 |

<!-- Tương ứng Test Design Specification của ISO/IEC/IEEE 29119-3: liệt kê điều kiện cần kiểm trước khi viết từng bước.
Đầu vào: 05-userstories.md (AC), 03-srs.md (BR, ERR, NFR). Mỗi dòng trích ít nhất một AC, FR, BR, ERR hoặc NFR.
Kỹ thuật thiết kế theo ISO/IEC/IEEE 29119-4: phân vùng tương đương, giá trị biên, bảng quyết định, chuyển trạng thái.
Mục đích: để BA, QA và khách duyệt phạm vi test trước khi tốn công viết test case. -->

### US-01 / UC-01: Quản lý mở ca và quỹ tiền mặt ban đầu

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-01 | Mở ca thành công với số tiền mặt đầu ca hợp lệ (lớn hơn hoặc bằng 0 VNĐ) | AC-01-1 · FR-06 | Phân vùng tương đương | Cao | Có |
| CHK-02 | Chặn mọi thao tác tạo đơn hoặc phục vụ bàn khi ca làm việc chưa được mở | AC-01-2 · BR-01 · ERR-01 · FR-06 | Bảng quyết định | Cao | Có |
| CHK-03 | Chặn nhập số tiền mặt đầu ca âm hoặc định dạng không hợp lệ | AC-01-1 · FR-06 | Giá trị biên | Vừa | Có |

### US-02 / UC-02: Sơ đồ bàn, gọi món và ghi chú khẩu vị

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-04 | Hiển thị sơ đồ bàn trực quan theo đúng 3 trạng thái và mã màu quy định (Trống, Đang phục vụ, Chờ thanh toán) | AC-02-1 · FR-01 | Phân vùng tương đương | Cao | Có |
| CHK-05 | Chọn bàn trống và thêm món kèm số lượng, món ăn kèm (topping), ghi chú khẩu vị | AC-02-2 · FR-02 | Phân vùng tương đương | Cao | Có |
| CHK-06 | Chặn chọn hoặc thêm món ăn đang ở trạng thái hết hàng (HET_HANG) | AC-02-3 · BR-09 · ERR-07 · FR-02 · FR-15 | Bảng quyết định | Cao | Có |
| CHK-07 | Chặn chọn bàn đang có khách để tạo đơn mới đè lên khi chưa gộp bàn | AC-02-1 · BR-02 · FR-01 | Chuyển trạng thái | Vừa | Có |

### US-03 / UC-02: In phiếu chế biến Bếp/Bar tự động (KOT)

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-08 | Gửi lệnh in phiếu chế biến KOT xuống máy in qua mạng LAN và chuyển trạng thái bàn sang Đang dùng | AC-03-1 · FR-03 | Chuyển trạng thái | Cao | Có |
| CHK-09 | Xử lý ngoại lệ mất kết nối máy in Bếp: lưu đơn hàng nội bộ và hiển thị cảnh báo kèm nút Thử in lại | AC-03-2 · ERR-06 · FR-03 | Bảng quyết định | Cao | Không |
| CHK-10 | Tốc độ in phiếu chế biến KOT qua mạng nội bộ đạt ngưỡng dưới 2.5 giây | NFR-02 · FR-03 | Phi chức năng | Vừa | Không |

### US-04 / UC-03: Chuyển bàn và gộp bàn phục vụ

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-11 | Chuyển toàn bộ món từ bàn đang phục vụ sang bàn trống đích và giải phóng bàn cũ về Trống | AC-04-1 · BR-02 · FR-04 · FR-01 | Chuyển trạng thái | Cao | Có |
| CHK-12 | Gộp hai bàn đang phục vụ thành một đơn chung và tính đúng tổng tiền tích lũy | AC-04-2 · FR-04 | Bảng quyết định | Cao | Có |

### US-05 / UC-04: Bán hàng nhanh mang về tại quầy

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-13 | Tạo đơn mang về, thanh toán tại quầy và in hóa đơn kèm phiếu lấy đồ có số thứ tự tự động tăng | AC-05-1 · BR-10 · FR-05 | Phân vùng tương đương | Cao | Có |
| CHK-14 | Chặn bấm nút thanh toán quầy khi giỏ hàng chưa có bất kỳ món nào | AC-05-2 · BR-10 · ERR-08 · FR-05 | Giá trị biên | Cao | Có |

### US-06 / UC-05: Bảo mật và phê duyệt thao tác nhạy cảm bằng mã PIN

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-15 | Hủy món đã gửi bếp thành công khi có lý do tối thiểu 5 ký tự và mã PIN Quản lý hợp lệ | AC-06-1 · BR-03 · FR-10 | Quyền | Cao | Có |
| CHK-16 | Chặn hủy món đã gửi bếp khi lý do hủy để trống hoặc dưới 5 ký tự | AC-06-1 · BR-03 · FR-10 | Giá trị biên | Vừa | Có |
| CHK-17 | Chặn áp dụng giảm giá hóa đơn khi nhập sai mã PIN Quản lý | AC-06-2 · BR-04 · ERR-02 · FR-10 | Quyền | Cao | Có |
| CHK-18 | Khóa tạm thời chức năng nhập mã PIN trong 5 phút khi nhập sai liên tiếp 5 lần | AC-06-3 · BR-04 · ERR-03 · NFR-03 · FR-10 | Chuyển trạng thái | Cao | Có |

### US-07 / UC-06: In tạm tính, thanh toán tiền mặt và in bill

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-19 | In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) | AC-07-1 · FR-01 · FR-13 | Chuyển trạng thái | Cao | Có |
| CHK-20 | Thanh toán tiền mặt, tự động tính tiền thối, cập nhật trạng thái đã thanh toán và giải phóng bàn | AC-07-2 · BR-08 · FR-11 · FR-13 | Phân vùng tương đương | Cao | Có |
| CHK-21 | Chặn xác nhận thanh toán khi số tiền khách đưa nhỏ hơn số tiền cần thanh toán | AC-07-2 · FR-11 | Giá trị biên | Cao | Có |
| CHK-22 | Xử lý ngoại lệ máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận đơn đã thanh toán và cho phép in lại | AC-07-3 · BR-12 · ERR-10 · FR-13 | Bảng quyết định | Vừa | Không |

### US-08 / UC-06: Thanh toán không tiền mặt bằng VietQR động

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-23 | Tạo và hiển thị mã VietQR động chứa chính xác số tiền cần trả và mã đơn hàng | AC-08-1 · FR-12 | Phân vùng tương đương | Cao | Có |
| CHK-24 | Xác nhận đã nhận tiền chuyển khoản thành công và hoàn tất đơn hàng với phương thức VietQR | AC-08-2 · FR-12 | Chuyển trạng thái | Cao | Có |
| CHK-25 | Hết thời gian chờ quét QR quá 3 phút (180 giây): hiển thị cảnh báo và cho phép tạo lại mã QR | AC-08-3 · BR-11 · ERR-09 · FR-12 | Giá trị biên | Vừa | Có |

### US-09 / UC-07: Ghi nhận thu/chi tiền mặt khẩn cấp trong ca

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-26 | Ghi nhận phiếu chi tiền mặt khẩn cấp, in phiếu chi và tự động trừ vào tiền mặt lý thuyết | AC-09-1 · BR-05 · FR-07 | Phân vùng tương đương | Vừa | Có |
| CHK-27 | Ghi nhận phiếu thu tiền mặt nạp thêm, in phiếu thu và tự động cộng vào tiền mặt lý thuyết | AC-09-2 · BR-05 · FR-07 | Phân vùng tương đương | Vừa | Có |
| CHK-28 | Chặn tạo phiếu thu chi tiền mặt với số tiền nhỏ hơn hoặc bằng 0 hoặc lý do để trống | AC-09-1 · BR-05 · FR-07 | Giá trị biên | Vừa | Có |

### US-10 / UC-08: Kiểm kê tiền mặt kết ca và ký duyệt đóng ca

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-29 | Chặn đóng ca làm việc khi vẫn còn bàn ăn đang phục vụ chưa thanh toán xong | AC-10-1 · BR-07 · ERR-04 · FR-08 | Bảng quyết định | Cao | Có |
| CHK-30 | Kết ca thành công khi tiền thực tế khớp tiền lý thuyết (lệch 0 VNĐ) và in biên bản Z-Report | AC-10-2 · BR-05 · FR-08 · FR-09 | Chuyển trạng thái | Cao | Có |
| CHK-31 | Bắt buộc nhập lý do giải trình khi tiền mặt thực tế kiểm đếm bị lệch so với tiền lý thuyết | AC-10-3 · BR-06 · ERR-05 · FR-08 | Bảng quyết định | Cao | Có |

### US-11 / UC-09: Báo cáo doanh thu và phân tích hiệu quả

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-32 | Xem báo cáo doanh thu theo ca, theo nhân viên, tỷ trọng Tiền mặt vs VietQR và top 5 món bán chạy | AC-11-1 · FR-14 | Phân vùng tương đương | Cao | Có |
| CHK-33 | Chặn tra cứu báo cáo khi bộ lọc có ngày bắt đầu lớn hơn ngày kết thúc | AC-11-2 · BR-13 · ERR-11 · FR-14 | Giá trị biên | Vừa | Có |

### US-12 / UC-10: Quản lý thực đơn và cập nhật trạng thái món

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-34 | Tắt trạng thái kinh doanh của món ăn và kiểm tra đồng bộ tức thời ngăn không cho order | AC-12-1 · BR-09 · FR-15 | Chuyển trạng thái | Cao | Có |
| CHK-35 | Chặn tạo hoặc cập nhật món ăn với đơn giá nhỏ hơn 0 VNĐ hoặc tên món để trống | AC-12-2 · BR-14 · ERR-12 · FR-15 | Giá trị biên | Cao | Có |

### Kiểm tra phi chức năng và chất lượng hệ thống

| ID | Điều kiện cần kiểm | Truy vết | Kỹ thuật | Ưu tiên | Tự động hóa |
|---|---|---|---|---|---|
| CHK-36 | Thời gian phản hồi thao tác chạm thêm món, đổi trạng thái bàn trên POS dưới 0.5 giây | NFR-01 · FR-01 · FR-02 | Phi chức năng | Cao | Có |
| CHK-37 | Chế độ bán hàng ngoại tuyến: lưu đơn cục bộ và in bill nội bộ mạng LAN khi mất Internet | NFR-04 · FR-01 · FR-03 | Phi chức năng | Cao | Không |
| CHK-38 | Khả năng tiếp cận của nhân viên mới: hoàn thành đào tạo thao tác bán hàng dưới 15 phút | NFR-05 · FR-01 | Phi chức năng | Thấp | Không |
| CHK-39 | Tương thích in chuẩn ESC/POS trên cả hai khổ giấy nhiệt thông dụng 80mm và 58mm | NFR-06 · FR-03 · FR-13 | Phi chức năng | Vừa | Không |

## Ngoài phạm vi kiểm thử

- Đặt bàn trước (Reservation) theo lịch hẹn nhiều ngày (nằm ngoài phạm vi giai đoạn 1).
- Tách hóa đơn thành nhiều hóa đơn lẻ (Split bill).
- Kiosk tự phục vụ khách tự bấm gọi món (Self-ordering kiosk).
- Xác thực sinh trắc học vân tay / khuôn mặt.
- Quẹt thẻ qua máy mPOS cầm tay.
- Định lượng trừ kho nguyên liệu tự động (BOM) — đã hoãn sang giai đoạn sau theo DEC-04.
- Dự báo doanh thu bằng AI / học máy.

## Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi | Nguồn |
|---|---|---|---|
| 0.1 | 2026-10-20 | Khởi tạo 39 điều kiện kiểm thử (CHK-01 đến CHK-39) theo ISO/IEC/IEEE 29119-3 và 29119-4 phủ kín 29 AC, 15 FR, 14 BR, 12 ERR và 6 NFR | 05-userstories.md · 03-srs.md |
| 1.0 | 2026-10-20 | BA duyệt checklist điều kiện kiểm thử để tiến hành viết test case chi tiết | BA phê duyệt |
