# POS Bán Hàng F&B (Quán Ăn, Cafe) — Test case

| Thông tin | Giá trị |
|---|---|
| Phiên bản | 1.0 · Đã duyệt |
| Đầu vào | 06-test-checklist.md v1.0 |
| Môi trường | POS Web/Desktop, máy in nhiệt ESC/POS (LAN và USB), Cổng VietQR giả lập Sandbox |

<!-- Tương ứng Test Case Specification của ISO/IEC/IEEE 29119-3.
Đầu vào: 06-test-checklist.md đã duyệt. Mỗi test case trích CHK và AC (hoặc FR, BR, ERR, NFR) mà nó chứng minh.
Kết quả mong đợi phải quan sát được: câu chữ nguyên văn, giá trị, trạng thái; không viết "hiển thị đúng". -->

## Danh mục

| ID | Tiêu đề | Truy vết | Ưu tiên | Tự động hóa |
|---|---|---|---|---|
| TC-01 | Mở ca thành công với số tiền mặt đầu ca hợp lệ | CHK-01 · AC-01-1 · FR-06 | Cao | Có |
| TC-02 | Chặn thao tác tạo đơn hoặc phục vụ bàn khi ca chưa mở | CHK-02 · AC-01-2 · BR-01 · ERR-01 · FR-06 | Cao | Có |
| TC-03 | Chặn nhập số tiền mặt đầu ca âm hoặc định dạng sai | CHK-03 · AC-01-1 · FR-06 | Vừa | Có |
| TC-04 | Hiển thị sơ đồ bàn trực quan theo đúng 3 trạng thái và mã màu | CHK-04 · AC-02-1 · FR-01 | Cao | Có |
| TC-05 | Chọn bàn trống và thêm món kèm số lượng, topping, ghi chú | CHK-05 · AC-02-2 · FR-02 | Cao | Có |
| TC-06 | Chặn chọn hoặc thêm món ăn đã được đánh dấu hết hàng | CHK-06 · AC-02-3 · BR-09 · ERR-07 · FR-02 · FR-15 | Cao | Có |
| TC-07 | Chặn chọn bàn đang có khách để tạo đơn mới đè lên | CHK-07 · AC-02-1 · BR-02 · FR-01 | Vừa | Có |
| TC-08 | In phiếu chế biến KOT xuống bếp qua mạng LAN và chuyển trạng thái bàn | CHK-08 · AC-03-1 · FR-03 | Cao | Có |
| TC-09 | Xử lý ngoại lệ mất kết nối máy in Bếp: lưu đơn và cảnh báo thử in lại | CHK-09 · AC-03-2 · ERR-06 · FR-03 | Cao | Không |
| TC-10 | Tốc độ in phiếu chế biến KOT qua mạng LAN dưới 2.5 giây | CHK-10 · NFR-02 · FR-03 | Vừa | Không |
| TC-11 | Chuyển toàn bộ món từ bàn đang phục vụ sang bàn trống đích | CHK-11 · AC-04-1 · BR-02 · FR-04 · FR-01 | Cao | Có |
| TC-12 | Gộp hai bàn đang phục vụ thành một đơn chung và tính tổng tiền tích lũy | CHK-12 · AC-04-2 · FR-04 | Cao | Có |
| TC-13 | Tạo đơn mang về, thanh toán tại quầy và in hóa đơn kèm số thứ tự | CHK-13 · AC-05-1 · BR-10 · FR-05 | Cao | Có |
| TC-14 | Chặn bấm thanh toán quầy khi giỏ hàng chưa có món nào | CHK-14 · AC-05-2 · BR-10 · ERR-08 · FR-05 | Cao | Có |
| TC-15 | Hủy món đã gửi bếp thành công với lý do tối thiểu 5 ký tự và mã PIN Quản lý | CHK-15 · AC-06-1 · BR-03 · FR-10 | Cao | Có |
| TC-16 | Chặn hủy món đã gửi bếp khi lý do để trống hoặc dưới 5 ký tự | CHK-16 · AC-06-1 · BR-03 · FR-10 | Vừa | Có |
| TC-17 | Chặn áp dụng giảm giá hóa đơn khi nhập sai mã PIN Quản lý | CHK-17 · AC-06-2 · BR-04 · ERR-02 · FR-10 | Cao | Có |
| TC-18 | Khóa tạm thời chức năng nhập mã PIN trong 5 phút khi sai liên tiếp 5 lần | CHK-18 · AC-06-3 · BR-04 · ERR-03 · NFR-03 · FR-10 | Cao | Có |
| TC-19 | In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán | CHK-19 · AC-07-1 · FR-01 · FR-13 | Cao | Có |
| TC-20 | Thanh toán tiền mặt, tự động tính tiền thối và giải phóng bàn | CHK-20 · AC-07-2 · BR-08 · FR-11 · FR-13 | Cao | Có |
| TC-21 | Chặn xác nhận thanh toán khi tiền khách đưa nhỏ hơn tổng tiền cần trả | CHK-21 · AC-07-2 · FR-11 | Cao | Có |
| TC-22 | Xử lý máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận thanh toán và cho in lại | CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 | Vừa | Không |
| TC-23 | Tạo và hiển thị mã VietQR động chứa chính xác số tiền và mã đơn | CHK-23 · AC-08-1 · FR-12 | Cao | Có |
| TC-24 | Xác nhận nhận tiền chuyển khoản thành công và hoàn tất đơn VietQR | CHK-24 · AC-08-2 · FR-12 | Cao | Có |
| TC-25 | Hết thời gian chờ quét QR quá 3 phút: hiển thị cảnh báo và cho tạo lại | CHK-25 · AC-08-3 · BR-11 · ERR-09 · FR-12 | Vừa | Có |
| TC-26 | Ghi nhận phiếu chi tiền mặt khẩn cấp và tự động trừ tiền lý thuyết | CHK-26 · AC-09-1 · BR-05 · FR-07 | Vừa | Có |
| TC-27 | Ghi nhận phiếu thu tiền mặt nạp thêm và tự động cộng tiền lý thuyết | CHK-27 · AC-09-2 · BR-05 · FR-07 | Vừa | Có |
| TC-28 | Chặn tạo phiếu thu chi với số tiền nhỏ hơn hoặc bằng 0 hoặc lý do để trống | CHK-28 · AC-09-1 · BR-05 · FR-07 | Vừa | Có |
| TC-29 | Chặn đóng ca khi vẫn còn bàn ăn đang phục vụ chưa thanh toán xong | CHK-29 · AC-10-1 · BR-07 · ERR-04 · FR-08 | Cao | Có |
| TC-30 | Kết ca thành công khi tiền thực tế khớp lý thuyết và in Z-Report | CHK-30 · AC-10-2 · BR-05 · FR-08 · FR-09 | Cao | Có |
| TC-31 | Bắt buộc nhập lý do giải trình khi tiền mặt kiểm đếm bị lệch | CHK-31 · AC-10-3 · BR-06 · ERR-05 · FR-08 | Cao | Có |
| TC-32 | Xem báo cáo doanh thu theo ca, phương thức và top 5 món bán chạy | CHK-32 · AC-11-1 · FR-14 | Cao | Có |
| TC-33 | Chặn tra cứu báo cáo khi ngày bắt đầu lớn hơn ngày kết thúc | CHK-33 · AC-11-2 · BR-13 · ERR-11 · FR-14 | Vừa | Có |
| TC-34 | Tắt trạng thái kinh doanh của món ăn và đồng bộ tức thời ngăn order | CHK-34 · AC-12-1 · BR-09 · FR-15 | Cao | Có |
| TC-35 | Chặn tạo hoặc cập nhật món ăn với đơn giá nhỏ hơn 0 hoặc tên để trống | CHK-35 · AC-12-2 · BR-14 · ERR-12 · FR-15 | Cao | Có |
| TC-36 | Thời gian phản hồi thao tác chạm POS dưới 0.5 giây | CHK-36 · NFR-01 · FR-01 · FR-02 | Cao | Có |
| TC-37 | Chế độ bán hàng ngoại tuyến: lưu đơn và in LAN khi mất Internet | CHK-37 · NFR-04 · FR-01 · FR-03 | Cao | Không |
| TC-38 | Khả năng tiếp cận của nhân viên mới: hoàn thành đào tạo dưới 15 phút | CHK-38 · NFR-05 · FR-01 | Thấp | Không |
| TC-39 | Tương thích in chuẩn ESC/POS trên cả khổ 80mm và 58mm | CHK-39 · NFR-06 · FR-03 · FR-13 | Vừa | Không |

---

### TC-01 Mở ca thành công với số tiền mặt đầu ca hợp lệ

- Truy vết: CHK-01 · AC-01-1 · FR-06
- Điều kiện trước: Tài khoản thu ngân TN-01 đã đăng nhập hệ thống, chưa có ca làm việc nào đang mở.
- Dữ liệu test: Số tiền mặt ban đầu: "1,000,000" VNĐ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình Mở ca (SCR-01) | Màn hình hiển thị trường nhập "Số tiền mặt đầu ca (VNĐ)" và nút "Xác nhận mở ca" |
| 2 | Nhập 1000000 vào ô số tiền mặt đầu ca và bấm "Xác nhận mở ca" | Hệ thống tạo bản ghi ca mới trạng thái DANG_MO, ghi nhận TienDauCa là 1,000,000 VNĐ, thông báo "Mở ca làm việc thành công", điều hướng sang Sơ đồ bàn (SCR-02) |

---

### TC-02 Chặn thao tác tạo đơn hoặc phục vụ bàn khi ca chưa mở

- Truy vết: CHK-02 · AC-01-2 · BR-01 · ERR-01 · FR-06
- Điều kiện trước: Hệ thống ở trạng thái chưa mở ca làm việc nào.
- Dữ liệu test: Bàn "Bàn 01 - Tầng 1" (trạng thái TRONG).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Truy cập màn hình Sơ đồ bàn (SCR-02) và nhấn chọn "Bàn 01 - Tầng 1" để gọi món | Hệ thống chặn không cho mở màn hình gọi món, hiển thị hộp thoại cảnh báo: "Ca làm việc chưa được mở. Vui lòng mở ca và nhập số dư tiền mặt đầu ca để bắt đầu." |
| 2 | Nhấn nút "Đồng ý" trên hộp thoại cảnh báo | Hệ thống tự động chuyển hướng người dùng về màn hình Mở ca (SCR-01) |

---

### TC-03 Chặn nhập số tiền mặt đầu ca âm hoặc định dạng sai

- Truy vết: CHK-03 · AC-01-1 · FR-06
- Điều kiện trước: Đang ở màn hình Mở ca (SCR-01).
- Dữ liệu test: Trường hợp 1: -500,000 VNĐ; Trường hợp 2: abc123.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập -500000 vào ô tiền đầu ca và bấm "Xác nhận mở ca" | Ô nhập hiển thị lỗi viền đỏ: "Số tiền đầu ca phải lớn hơn hoặc bằng 0 VNĐ", nút xác nhận bị vô hiệu hóa |
| 2 | Nhập chuỗi abc123 vào ô tiền đầu ca | Ô chỉ nhận số, tự động lọc bỏ ký tự chữ; không tạo ca |

---

### TC-04 Hiển thị sơ đồ bàn trực quan theo đúng 3 trạng thái và mã màu

- Truy vết: CHK-04 · AC-02-1 · FR-01
- Điều kiện trước: Ca làm việc đang mở. Quán có cấu hình 3 bàn: Bàn 01 (trống), Bàn 02 (đang phục vụ chưa in tạm tính), Bàn 03 (đã in tạm tính).
- Dữ liệu test: Khu vực Tầng 1.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở màn hình Sơ đồ bàn (SCR-02), chọn tab khu vực Tầng 1 | Hiển thị đầy đủ danh sách bàn thuộc Tầng 1 |
| 2 | Quan sát Bàn 01 | Thẻ bàn hiển thị trạng thái TRONG, nhãn "Trống", màu nền xanh lá (#10B981) |
| 3 | Quan sát Bàn 02 | Thẻ bàn hiển thị trạng thái DANG_DUNG, nhãn "Đang phục vụ", màu nền đỏ (#EF4444), hiển thị thời gian ngồi 15 phút và số tiền tạm tính |
| 4 | Quan sát Bàn 03 | Thẻ bàn hiển thị trạng thái CHO_THANH_TOAN, nhãn "Chờ thanh toán", màu nền vàng cam (#F59E0B) |

---

### TC-05 Chọn bàn trống và thêm món kèm số lượng, topping, ghi chú

- Truy vết: CHK-05 · AC-02-2 · FR-02
- Điều kiện trước: Ca làm việc đang mở. Bàn 04 đang ở trạng thái Trống.
- Dữ liệu test: Món "Cà phê sữa đá" (đơn giá 35,000 VNĐ), Số lượng: 2, Topping: "Thạch cà phê" (+5,000 VNĐ), Ghi chú: "Ít đường nhiều đá".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại SCR-02, nhấn chọn Bàn 04 | Mở màn hình Gọi món (SCR-03) hiển thị thực đơn theo danh mục và giỏ hàng bàn 04 trống |
| 2 | Nhấn vào món "Cà phê sữa đá", tăng số lượng lên 2, tích chọn topping "Thạch cà phê", nhập ghi chú "Ít đường nhiều đá" | Giỏ hàng hiển thị: 2 x Cà phê sữa đá (kèm Thạch cà phê), ghi chú "Ít đường nhiều đá", thành tiền tạm tính: 80,000 VNĐ |

---

### TC-06 Chặn chọn hoặc thêm món ăn đã được đánh dấu hết hàng

- Truy vết: CHK-06 · AC-02-3 · BR-09 · ERR-07 · FR-02 · FR-15
- Điều kiện trước: Món "Bạc xỉu đặc biệt" có trạng thái HET_HANG. Đang ở màn hình Gọi món (SCR-03).
- Dữ liệu test: Món "Bạc xỉu đặc biệt".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tìm kiếm món "Bạc xỉu đặc biệt" trên danh mục thực đơn | Thẻ món bị làm mờ, có nhãn huy hiệu "HẾT HÀNG", nút chọn món bị vô hiệu hóa |
| 2 | Cố tình nhấn chạm vào thẻ món | Hệ thống chặn thao tác, hiển thị thông báo lỗi: "Món Bạc xỉu đặc biệt hiện đã hết. Vui lòng chọn món khác!", giỏ hàng không thêm món |

---

### TC-07 Chặn chọn bàn đang có khách để tạo đơn mới đè lên

- Truy vết: CHK-07 · AC-02-1 · BR-02 · FR-01
- Điều kiện trước: Bàn 02 đang có trạng thái DANG_DUNG với đơn hàng hiện hữu 120,000 VNĐ.
- Dữ liệu test: Bàn 02.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại màn hình Sơ đồ bàn (SCR-02), nhấn vào Bàn 02 | Mở màn hình đơn hàng hiện tại của Bàn 02 với danh sách món đã gọi trước đó; không tạo mới đơn trống đè lên dữ liệu cũ |
| 2 | Kiểm tra nút chức năng | Không có nút tạo đơn mới đè lên bàn đang phục vụ; chỉ hiển thị các nút thao tác nghiệp vụ hợp lệ |

---

### TC-08 In phiếu chế biến KOT xuống bếp qua mạng LAN và chuyển trạng thái bàn

- Truy vết: CHK-08 · AC-03-1 · FR-03
- Điều kiện trước: Bàn 05 (trạng thái TRONG) vừa được chọn món: 1 "Trà đào cam sả" (45,000 VNĐ, không đường). Máy in Bếp/Bar sẵn sàng.
- Dữ liệu test: Bàn 05.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại SCR-03, nhấn nút "Gửi Bếp/Bar" | Hệ thống gửi lệnh in ESC/POS qua mạng LAN tới máy in bếp, hiển thị thông báo "Đã gửi thực đơn xuống Bếp thành công" |
| 2 | Kiểm tra phiếu in tại máy in Bếp/Bar | Phiếu KOT in ra chứa: Mã bàn "Bàn 05", Thời gian, Tên món "Trà đào cam sả", Số lượng "1", Ghi chú "không đường" |
| 3 | Quay lại Sơ đồ bàn (SCR-02) | Bàn 05 tự động đổi màu sang Đỏ (#EF4444), trạng thái chuyển thành DANG_DUNG |

---

### TC-09 Xử lý ngoại lệ mất kết nối máy in Bếp: lưu đơn và cảnh báo thử in lại

- Truy vết: CHK-09 · AC-03-2 · ERR-06 · FR-03
- Điều kiện trước: Máy in Bếp bị rút dây mạng LAN. Đang có giỏ hàng Bàn 06.
- Dữ liệu test: Bàn 06, 2 "Trà chanh sả".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn nút "Gửi Bếp/Bar" | Đơn hàng vẫn được lưu vào hệ thống ở trạng thái DANG_DUNG. Màn hình hiển thị hộp thoại cảnh báo: "Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!" |
| 2 | Quan sát nút hành động trên màn hình | Xuất hiện nút "Thử in lại" kèm biểu tượng cảnh báo lỗi in |
| 3 | Cắm lại dây mạng máy in và nhấn "Thử in lại" | Lệnh in KOT được thực thi thành công, thông báo in hoàn tất và ẩn cảnh báo |

---

### TC-10 Tốc độ in phiếu chế biến KOT qua mạng LAN dưới 2.5 giây

- Truy vết: CHK-10 · NFR-02 · FR-03
- Điều kiện trước: Mạng LAN nội bộ quán hoạt động bình thường, máy in nhiệt KOT 80mm sẵn sàng.
- Dữ liệu test: Đơn hàng gồm 3 món khác nhau.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm nút "Gửi Bếp/Bar" và bấm đồng hồ đo thời gian | Từ thời điểm bấm nút đến khi máy in nhiệt bắt đầu đẩy giấy in phiếu KOT đo được dưới 2.5 giây |

---

### TC-11 Chuyển toàn bộ món từ bàn đang phục vụ sang bàn trống đích

- Truy vết: CHK-11 · AC-04-1 · BR-02 · FR-04 · FR-01
- Điều kiện trước: Bàn 02 đang phục vụ (DANG_DUNG) có 2 món (tổng 90,000 VNĐ). Bàn 07 đang trống (TRONG).
- Dữ liệu test: Nguồn: Bàn 02; Đích: Bàn 07.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại màn hình chi tiết Bàn 02, bấm nút "Chuyển bàn" (SCR-04) | Hiển thị danh sách các bàn trống khả dụng |
| 2 | Chọn "Bàn 07" và nhấn "Xác nhận chuyển" | Hệ thống hiển thị thông báo "Chuyển bàn thành công từ Bàn 02 sang Bàn 07" |
| 3 | Quay lại Sơ đồ bàn (SCR-02) kiểm tra trạng thái | Bàn 02 chuyển về trạng thái TRONG (màu xanh lá); Bàn 07 chuyển sang trạng thái DANG_DUNG (màu đỏ) chứa đầy đủ 2 món và số tiền 90,000 VNĐ |

---

### TC-12 Gộp hai bàn đang phục vụ thành một đơn chung và tính tổng tiền tích lũy

- Truy vết: CHK-12 · AC-04-2 · FR-04
- Điều kiện trước: Bàn 03 đang phục vụ có đơn 100,000 VNĐ. Bàn 08 đang phục vụ có đơn 150,000 VNĐ.
- Dữ liệu test: Bàn nguồn: Bàn 08; Bàn đích: Bàn 03.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở Bàn 08, bấm nút "Gộp bàn", chọn Bàn 03 làm bàn đích gộp | Hệ thống hiển thị bảng xác nhận danh sách món gộp và tổng tiền dự kiến: 250,000 VNĐ |
| 2 | Nhấn "Xác nhận gộp bàn" | Thông báo "Gộp bàn thành công". Bàn 08 giải phóng về trạng thái TRONG. Bàn 03 tiếp tục ở trạng thái DANG_DUNG với tổng tiền mới là 250,000 VNĐ gồm toàn bộ món của cả hai bàn |

---

### TC-13 Tạo đơn mang về, thanh toán tại quầy và in hóa đơn kèm số thứ tự

- Truy vết: CHK-13 · AC-05-1 · BR-10 · FR-05
- Điều kiện trước: Ca làm việc đang mở. Số thứ tự mang về hiện tại là 14.
- Dữ liệu test: Khách mua 1 "Trà sữa trân châu" (40,000 VNĐ), thanh toán tiền mặt 50,000 VNĐ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại màn hình POS, chuyển sang tab "Bán mang về" (SCR-05) | Giao diện mở nhanh giỏ hàng mang về độc lập, không gắn với sơ đồ bàn |
| 2 | Chọn 1 "Trà sữa trân châu", nhấn "Thanh toán", nhập tiền khách đưa 50000 VNĐ | Tiền thối hiển thị 10,000 VNĐ |
| 3 | Nhấn "Hoàn tất và In bill" | Đơn hoàn tất, máy in in đồng thời: (a) Hóa đơn thanh toán 40,000 VNĐ, và (b) Phiếu lấy đồ có in to số thứ tự số 15; bộ đếm tăng lên 15 |

---

### TC-14 Chặn bấm thanh toán quầy khi giỏ hàng chưa có món nào

- Truy vết: CHK-14 · AC-05-2 · BR-10 · ERR-08 · FR-05
- Điều kiện trước: Đang ở tab "Bán mang về" (SCR-05), giỏ hàng rỗng (0 món, 0 VNĐ).
- Dữ liệu test: Giỏ hàng rỗng.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhấn nút "Thanh toán nhanh" | Nút bị mờ hoặc vô hiệu hóa. Nếu bấm vào, hệ thống chặn thao tác và hiển thị thông báo lỗi: "Đơn hàng chưa có món ăn. Vui lòng chọn món trước khi thanh toán!" |

---

### TC-15 Hủy món đã gửi bếp thành công với lý do tối thiểu 5 ký tự và mã PIN Quản lý

- Truy vết: CHK-15 · AC-06-1 · BR-03 · FR-10
- Điều kiện trước: Bàn 01 có món "Cà phê đen" đã gửi bếp. Mã PIN Quản lý đúng là 123456.
- Dữ liệu test: Lý do hủy: "Khách đổi ý sang bạc xỉu", Mã PIN: 123456.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại giỏ hàng Bàn 01, bấm nút Xóa món "Cà phê đen" | Hệ thống bật popup yêu cầu: "Nhập lý do hủy món" và "Mã PIN Quản lý duyệt" (SCR-06) |
| 2 | Nhập lý do "Khách đổi ý sang bạc xỉu", nhập PIN 123456, nhấn "Xác nhận" | Món được xóa khỏi đơn, tổng tiền giảm tương ứng, ghi nhận nhật ký hủy món; in phiếu hủy món xuống Bếp thông báo ngừng làm |

---

### TC-16 Chặn hủy món đã gửi bếp khi lý do để trống hoặc dưới 5 ký tự

- Truy vết: CHK-16 · AC-06-1 · BR-03 · FR-10
- Điều kiện trước: Popup hủy món đã gửi bếp đang mở.
- Dữ liệu test: Trường hợp 1: lý do để trống; Trường hợp 2: lý do "hủy" (3 ký tự).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Để trống ô lý do, nhập PIN 123456 và bấm Xác nhận | Báo lỗi viền đỏ: "Lý do hủy món bắt buộc nhập tối thiểu 5 ký tự"; không thực hiện hủy món |
| 2 | Nhập lý do "hủy" và bấm Xác nhận | Báo lỗi: "Lý do hủy món bắt buộc nhập tối thiểu 5 ký tự"; không thực hiện hủy món |

---

### TC-17 Chặn áp dụng giảm giá hóa đơn khi nhập sai mã PIN Quản lý

- Truy vết: CHK-17 · AC-06-2 · BR-04 · ERR-02 · FR-10
- Điều kiện trước: Đơn hàng Bàn 02 trị giá 200,000 VNĐ. Mã PIN Quản lý hợp lệ là 123456.
- Dữ liệu test: Nhập giảm giá 10%, mã PIN nhập sai: 999999.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm chọn nút "Giảm giá hóa đơn", chọn 10%, hiển thị popup xác thực PIN Quản lý | Nhập PIN 999999 và bấm "Xác nhận" |
| 2 | Quan sát phản hồi | Hệ thống hiển thị thông báo lỗi: "Mã PIN phê duyệt không chính xác. Vui lòng kiểm tra lại!", không áp dụng giảm giá, giữ nguyên tổng tiền 200,000 VNĐ |

---

### TC-18 Khóa tạm thời chức năng nhập mã PIN trong 5 phút khi sai liên tiếp 5 lần

- Truy vết: CHK-18 · AC-06-3 · BR-04 · ERR-03 · NFR-03 · FR-10
- Điều kiện trước: Popup phê duyệt mã PIN nhạy cảm đang mở.
- Dữ liệu test: Nhập mã PIN sai liên tiếp 5 lần: 000000.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập sai mã PIN lần 1, 2, 3, 4 | Mỗi lần báo lỗi ERR-02 và đếm số lần sai còn lại |
| 2 | Nhập sai mã PIN lần thứ 5 | Hệ thống khóa trường nhập mã PIN, hiển thị thông báo: "Bạn đã nhập sai mã PIN quá 5 lần. Chức năng xác thực bị khóa tạm thời trong 5 phút!" |
| 3 | Thử thao tác nhập lại ngay sau đó | Nút xác nhận bị khóa, hiển thị bộ đếm ngược thời gian chờ 5 phút |

---

### TC-19 In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán

- Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13
- Điều kiện trước: Bàn 09 đang ở trạng thái DANG_DUNG (màu đỏ) với hóa đơn 150,000 VNĐ.
- Dữ liệu test: Bàn 09.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở chi tiết Bàn 09, nhấn nút "In tạm tính" (SCR-07) | Máy in hóa đơn tại quầy in ra phiếu Tạm tính ghi rõ "PHIẾU TẠM TÍNH - CHƯA PHẢI HÓA ĐƠN" |
| 2 | Quan sát trạng thái Bàn 09 trên Sơ đồ bàn (SCR-02) | Bàn 09 chuyển sang trạng thái CHO_THANH_TOAN và hiển thị màu vàng cam (#F59E0B) |

---

### TC-20 Thanh toán tiền mặt, tự động tính tiền thối và giải phóng bàn

- Truy vết: CHK-20 · AC-07-2 · BR-08 · FR-11 · FR-13
- Điều kiện trước: Bàn 09 trạng thái CHO_THANH_TOAN, tổng tiền cần thanh toán là 150,000 VNĐ.
- Dữ liệu test: Phương thức "Tiền mặt", Tiền khách đưa: 200,000 VNĐ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại màn hình Thanh toán (SCR-08), chọn phương thức "Tiền mặt", nhập tiền khách đưa 200000 | Trường Tiền thối tự động hiển thị: 50,000 VNĐ |
| 2 | Nhấn "Xác nhận thanh toán và In hóa đơn" | Máy in in hóa đơn bán lẻ đầy đủ; đơn hàng chuyển trạng thái DA_THANH_TOAN; Bàn 09 được giải phóng về trạng thái TRONG (màu xanh lá) |
| 3 | Kiểm tra quỹ tiền mặt ca | Tiền mặt lý thuyết trong ca tăng thêm 150,000 VNĐ |

---

### TC-21 Chặn xác nhận thanh toán khi tiền khách đưa nhỏ hơn tổng tiền cần trả

- Truy vết: CHK-21 · AC-07-2 · FR-11
- Điều kiện trước: Đơn hàng cần thanh toán là 150,000 VNĐ.
- Dữ liệu test: Tiền khách đưa: 100,000 VNĐ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số tiền khách đưa 100000 | Ô tiền thối báo âm hoặc không đủ, nút "Xác nhận thanh toán" bị vô hiệu hóa mờ đi |
| 2 | Cố tình bấm Enter | Hệ thống báo lỗi: "Số tiền khách đưa chưa đủ để thanh toán đơn hàng", không ghi nhận giao dịch |

---

### TC-22 Xử lý máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận thanh toán và cho in lại

- Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13
- Điều kiện trước: Máy in hóa đơn quầy bị mở nắp hoặc hết cuộn giấy nhiệt.
- Dữ liệu test: Đơn hàng thanh toán 85,000 VNĐ.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm xác nhận thanh toán | Giao dịch thanh toán vẫn được ghi nhận thành công trong cơ sở dữ liệu (DA_THANH_TOAN), bàn được giải phóng. Màn hình hiển thị cảnh báo: "Máy in hóa đơn hết giấy hoặc bị kẹt. Vui lòng kiểm tra giấy và in lại!" |
| 2 | Lắp cuộn giấy nhiệt mới vào máy in và nhấn nút "In lại bill" | Máy in in ra hóa đơn thanh toán hoàn chỉnh, thông báo in thành công |

---

### TC-23 Tạo và hiển thị mã VietQR động chứa chính xác số tiền và mã đơn

- Truy vết: CHK-23 · AC-08-1 · FR-12
- Điều kiện trước: Đơn hàng Bàn 03 trị giá 175,000 VNĐ, mã đơn "HD-20261020-001".
- Dữ liệu test: Thông tin tài khoản quán: Ngân hàng MB, STK: 9999888899, Chủ TK: "QUAN CAFE TEST".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Tại màn hình thanh toán SCR-08, chọn phương thức "VietQR" | Màn hình sinh và hiển thị mã VietQR động chuẩn NAPAS247 (SCR-09) kèm thông tin: Số tiền 175,000 VNĐ, Nội dung chuyển khoản "HD-20261020-001" |
| 2 | Dùng ứng dụng ngân hàng quét mã QR trên màn hình | Ứng dụng ngân hàng tự động điền đúng STK 9999888899, số tiền 175,000 VNĐ và nội dung chuyển khoản "HD-20261020-001", không cho sửa số tiền |

---

### TC-24 Xác nhận nhận tiền chuyển khoản thành công và hoàn tất đơn VietQR

- Truy vết: CHK-24 · AC-08-2 · FR-12
- Điều kiện trước: Mã VietQR động đang hiển thị trên màn hình.
- Dữ liệu test: Webhook ngân hàng báo Có biến động số dư +175,000 VNĐ đúng mã HD-20261020-001.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thu ngân nhận thông báo tiền đã vào tài khoản và bấm nút "Xác nhận đã nhận tiền" | Màn hình hiển thị dấu tích xanh "Thanh toán VietQR thành công", máy in in hóa đơn ghi rõ Phương thức: VIETQR |
| 2 | Kiểm tra trạng thái đơn và bàn | Đơn hàng hoàn tất, bàn trở về trạng thái TRONG, doanh thu ca ghi nhận 175,000 VNĐ vào mục VietQR |

---

### TC-25 Hết thời gian chờ quét QR quá 3 phút: hiển thị cảnh báo và cho tạo lại

- Truy vết: CHK-25 · AC-08-3 · BR-11 · ERR-09 · FR-12
- Điều kiện trước: Màn hình hiển thị mã VietQR động đang bật bộ đếm thời gian 180 giây.
- Dữ liệu test: Đợi hết 180 giây không có giao dịch thanh toán.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Để bộ đếm đếm ngược từ 180 giây về 0 giây | Mã QR bị làm mờ, xuất hiện thông báo cảnh báo: "Hết thời gian chờ thanh toán VietQR. Vui lòng tạo mã QR mới hoặc thanh toán tiền mặt!" |
| 2 | Nhấn nút "Tạo lại mã QR" | Hệ thống sinh chuỗi mã VietQR mới với thời gian đếm ngược 180 giây được làm mới |

---

### TC-26 Ghi nhận phiếu chi tiền mặt khẩn cấp và tự động trừ tiền lý thuyết

- Truy vết: CHK-26 · AC-09-1 · BR-05 · FR-07
- Điều kiện trước: Ca đang mở, tiền mặt hiện tại trong két là 1,500,000 VNĐ.
- Dữ liệu test: Loại: "CHI", Số tiền: 200,000 VNĐ, Lý do: "Mua đá lạnh cấp đông khẩn cấp", Người nhận: "Đại lý đá sạch".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở menu "Thu/Chi trong ca", chọn "Tạo phiếu chi" | Mở popup tạo phiếu chi tiền mặt |
| 2 | Nhập số tiền 200000, lý do "Mua đá lạnh cấp đông khẩn cấp", người nhận "Đại lý đá sạch", bấm "Xác nhận chi" | Hệ thống ghi nhận phiếu chi, máy in in phiếu chi tiền mặt (2 liên), tiền mặt lý thuyết trong ca tự động giảm từ 1,500,000 xuống 1,300,000 VNĐ |

---

### TC-27 Ghi nhận phiếu thu tiền mặt nạp thêm và tự động cộng tiền lý thuyết

- Truy vết: CHK-27 · AC-09-2 · BR-05 · FR-07
- Điều kiện trước: Ca đang mở, tiền mặt hiện tại là 1,300,000 VNĐ.
- Dữ liệu test: Loại: "THU", Số tiền: 500,000 VNĐ, Lý do: "Chủ quán đổi thêm tiền lẻ đầu ca", Người nộp: "Chủ quán".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Mở menu "Thu/Chi trong ca", chọn "Tạo phiếu thu" | Mở popup tạo phiếu thu tiền mặt |
| 2 | Nhập số tiền 500000, lý do "Chủ quán đổi thêm tiền lẻ đầu ca", người nộp "Chủ quán", bấm "Xác nhận thu" | Hệ thống lưu phiếu thu, in phiếu thu tiền, tiền mặt lý thuyết ca tự động tăng từ 1,300,000 lên 1,800,000 VNĐ |

---

### TC-28 Chặn tạo phiếu thu chi với số tiền nhỏ hơn hoặc bằng 0 hoặc lý do để trống

- Truy vết: CHK-28 · AC-09-1 · BR-05 · FR-07
- Điều kiện trước: Popup tạo phiếu thu chi đang mở.
- Dữ liệu test: Trường hợp 1: Số tiền 0 VNĐ; Trường hợp 2: Số tiền 100,000 VNĐ nhưng để trống lý do.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số tiền 0 và nhập lý do hợp lệ, bấm Xác nhận | Báo lỗi viền đỏ: "Số tiền thu/chi phải lớn hơn 0 VNĐ", không tạo phiếu |
| 2 | Nhập số tiền 100000 nhưng để trống ô lý do, bấm Xác nhận | Báo lỗi viền đỏ: "Lý do thu/chi bắt buộc nhập tối thiểu 5 ký tự", không tạo phiếu |

---

### TC-29 Chặn đóng ca khi vẫn còn bàn ăn đang phục vụ chưa thanh toán xong

- Truy vết: CHK-29 · AC-10-1 · BR-07 · ERR-04 · FR-08
- Điều kiện trước: Còn 2 bàn (Bàn 01 và Bàn 04) đang ở trạng thái DANG_DUNG chưa thanh toán.
- Dữ liệu test: Thao tác đóng ca.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thu ngân bấm vào chức năng "Kết ca / Đóng ca" (SCR-10) | Hệ thống chặn không cho mở form kiểm đếm tiền, hiển thị hộp thoại cảnh báo: "Không thể đóng ca! Vẫn còn 2 bàn chưa hoàn tất thanh toán. Vui lòng thanh toán hoặc bàn giao bàn." |
| 2 | Kiểm tra hành động kế tiếp | Thu ngân phải thanh toán hết các bàn hoặc bàn giao bàn trước khi thực hiện đóng ca |

---

### TC-30 Kết ca thành công khi tiền thực tế khớp lý thuyết và in Z-Report

- Truy vết: CHK-30 · AC-10-2 · BR-05 · FR-08 · FR-09
- Điều kiện trước: Tất cả bàn đã thanh toán. Tiền mặt lý thuyết hệ thống tính: 3,250,000 VNĐ.
- Dữ liệu test: Tiền thực tế kiểm đếm: 3,250,000 VNĐ (chênh lệch 0 VNĐ).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bấm "Kết ca / Đóng ca", nhập số tiền mặt thực tế kiểm đếm 3250000 | Trường Chênh lệch hiển thị 0 VNĐ (màu xanh lá), ô Giải trình không bắt buộc |
| 2 | Nhấn "Xác nhận đóng ca" | Ca chuyển trạng thái DA_DONG, hệ thống tự động gửi lệnh in biên bản Z-Report tổng kết ca (Doanh thu tổng, Tiền mặt, VietQR, Thu/Chi, Chênh lệch = 0) và đăng xuất thu ngân |

---

### TC-31 Bắt buộc nhập lý do giải trình khi tiền mặt kiểm đếm bị lệch

- Truy vết: CHK-31 · AC-10-3 · BR-06 · ERR-05 · FR-08
- Điều kiện trước: Tiền mặt lý thuyết là 3,250,000 VNĐ.
- Dữ liệu test: Tiền mặt thực tế đếm: 3,200,000 VNĐ (lệch thiếu -50,000 VNĐ).

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập số tiền thực tế 3200000 | Trường Chênh lệch hiển thị -50,000 VNĐ (màu đỏ cảnh báo), ô "Lý do giải trình chênh lệch" hiển thị dấu sao đỏ bắt buộc |
| 2 | Để trống ô giải trình và nhấn "Xác nhận đóng ca" | Hệ thống chặn đóng ca, hiển thị thông báo lỗi: "Tiền mặt thực tế bị lệch -50000 VNĐ. Vui lòng nhập lý do giải trình để tiếp tục!" |
| 3 | Nhập lý do "Thối nhầm tiền cho bàn 3 khách đông" và bấm Xác nhận | Ca đóng thành công, biên bản Z-Report in ra dòng cảnh báo chênh lệch -50,000 VNĐ kèm nguyên văn lý do giải trình |

---

### TC-32 Xem báo cáo doanh thu theo ca, phương thức và top 5 món bán chạy

- Truy vết: CHK-32 · AC-11-1 · FR-14
- Điều kiện trước: Tài khoản Quản lý đã đăng nhập, hệ thống đã phát sinh doanh thu từ các ca trước.
- Dữ liệu test: Khoảng ngày từ ngày đầu tháng đến ngày hiện tại.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Quản lý truy cập màn hình Báo cáo doanh thu | Màn hình hiển thị biểu đồ tổng doanh thu, thẻ số liệu tổng quan (Tổng doanh thu, Tổng số đơn, Tỷ trọng Tiền mặt vs VietQR) |
| 2 | Quan sát bảng chi tiết doanh thu theo ca | Liệt kê đầy đủ danh sách các ca với: Mã ca, Thu ngân, Giờ mở/đóng, Doanh thu tiền mặt, Doanh thu VietQR, Chênh lệch tiền két |
| 3 | Quan sát bảng Top món bán chạy | Hiển thị chính xác danh sách 5 món có số lượng bán cao nhất sắp xếp giảm dần |

---

### TC-33 Chặn tra cứu báo cáo khi ngày bắt đầu lớn hơn ngày kết thúc

- Truy vết: CHK-33 · AC-11-2 · BR-13 · ERR-11 · FR-14
- Điều kiện trước: Đang ở màn hình Báo cáo doanh thu.
- Dữ liệu test: Từ ngày: 2026-10-25; Đến ngày: 2026-10-20.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Chọn Từ ngày là 2026-10-25 và Đến ngày là 2026-10-20, bấm nút "Xem báo cáo" | Hệ thống chặn không gửi yêu cầu truy vấn, hiển thị thông báo lỗi: "Ngày bắt đầu không được lớn hơn ngày kết thúc!" |

---

### TC-34 Tắt trạng thái kinh doanh của món ăn và đồng bộ tức thời ngăn order

- Truy vết: CHK-34 · AC-12-1 · BR-09 · FR-15
- Điều kiện trước: Món "Trà đào cam sả" đang ở trạng thái DANG_BAN.
- Dữ liệu test: Món "Trà đào cam sả".

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Quản lý truy cập Quản lý thực đơn, tìm "Trà đào cam sả" và gạt công tắc kinh doanh sang Tắt (HET_HANG) | Hệ thống cập nhật trạng thái món thành HET_HANG, thông báo "Cập nhật trạng thái món thành công" |
| 2 | Tại máy POS của nhân viên thu ngân (màn hình SCR-03), kiểm tra món "Trà đào cam sả" | Món lập tức hiển thị nhãn "HẾT HÀNG", không thể nhấn thêm vào giỏ hàng |

---

### TC-35 Chặn tạo hoặc cập nhật món ăn với đơn giá nhỏ hơn 0 hoặc tên để trống

- Truy vết: CHK-35 · AC-12-2 · BR-14 · ERR-12 · FR-15
- Điều kiện trước: Màn hình Thêm/Sửa món ăn đang mở.
- Dữ liệu test: Trường hợp 1: Đơn giá -10,000 VNĐ; Trường hợp 2: Tên món để trống.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Nhập tên món "Bánh ngọt", đơn giá -10000, bấm Lưu | Báo lỗi viền đỏ: "Đơn giá món ăn không được nhỏ hơn 0 VNĐ!", chặn lưu dữ liệu |
| 2 | Để trống ô tên món, đơn giá 30000, bấm Lưu | Báo lỗi viền đỏ: "Tên món ăn bắt buộc nhập tối thiểu 2 ký tự", chặn lưu dữ liệu |

---

### TC-36 Thời gian phản hồi thao tác chạm POS dưới 0.5 giây

- Truy vết: CHK-36 · NFR-01 · FR-01 · FR-02
- Điều kiện trước: Ứng dụng POS chạy trên thiết bị cảm ứng (màn hình cảm ứng POS hoặc iPad/Android tablet).
- Dữ liệu test: 50 lượt chạm thêm món và chuyển tab danh mục liên tiếp.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Thực hiện chạm vào món ăn trên thực đơn và theo dõi thời gian giỏ hàng cập nhật số lượng | Thời gian từ lúc chạm ngón tay đến khi giao diện phản hồi dưới 0.5 giây trong 100% các lần thử |

---

### TC-37 Chế độ bán hàng ngoại tuyến: lưu đơn và in LAN khi mất Internet

- Truy vết: CHK-37 · NFR-04 · FR-01 · FR-03
- Điều kiện trước: Rút dây mạng WAN ra khỏi modem (mất kết nối Internet ra ngoài nhưng mạng LAN nội bộ vẫn chạy).
- Dữ liệu test: Tạo đơn gọi món Bàn 01.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Bật đơn, chọn món và bấm "Gửi Bếp/Bar" | Hệ thống phát hiện mất kết nối Internet, hiển thị huy hiệu "Ngoại tuyến (Offline)". Lệnh in KOT qua mạng LAN vẫn chạy và in ra phiếu bình thường |
| 2 | Thu ngân tiến hành thanh toán tiền mặt và in bill | Hóa đơn được in bình thường qua máy in quầy; đơn hàng được lưu vào bộ nhớ cục bộ SQLite hoặc IndexedDB của máy POS |
| 3 | Cắm lại dây mạng Internet | Hệ thống tự động đồng bộ ngầm toàn bộ đơn hàng ngoại tuyến lên máy chủ trung tâm khi có mạng trở lại |

---

### TC-38 Khả năng tiếp cận của nhân viên mới: hoàn thành đào tạo dưới 15 phút

- Truy vết: CHK-38 · NFR-05 · FR-01
- Điều kiện trước: 03 nhân viên mới chưa từng sử dụng hệ thống POS.
- Dữ liệu test: Kịch bản kiểm thử mẫu: Mở ca -> Chọn bàn -> Gọi món -> Gửi bếp -> In tạm tính -> Thanh toán tiền mặt -> Đóng ca.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Hướng dẫn nhân viên theo tài liệu nhanh trong 10 phút, sau đó cho nhân viên tự thực hiện trọn vẹn kịch bản | 3/3 nhân viên hoàn thành kịch bản bán hàng và đóng ca độc lập không cần trợ giúp trong vòng dưới 15 phút |

---

### TC-39 Tương thích in chuẩn ESC/POS trên cả khổ 80mm và 58mm

- Truy vết: CHK-39 · NFR-06 · FR-03 · FR-13
- Điều kiện trước: Cấu hình hệ thống lần lượt với 2 máy in nhiệt: Máy 1 (Khổ 80mm), Máy 2 (Khổ 58mm).
- Dữ liệu test: In hóa đơn thanh toán mẫu có 4 món ăn kèm giảm giá.

| Bước | Thao tác | Kết quả mong đợi |
|---|---|---|
| 1 | Cấu hình máy in khổ 80mm và thực hiện in hóa đơn | Hóa đơn dàn trang chuẩn khổ 80mm (48 ký tự/dòng), không bị rớt dòng lỗi font tiếng Việt có dấu |
| 2 | Cấu hình máy in khổ 58mm và thực hiện in hóa đơn | Hóa đơn tự động co giãn dàn trang chuẩn khổ 58mm (32 ký tự/dòng), canh lề rõ ràng, mã barcode/QR và chữ không bị mất góc |

---

## Ngoài phạm vi kiểm thử

- Đặt bàn trước (Reservation) theo lịch hẹn nhiều ngày (nằm ngoài phạm vi giai đoạn 1).
- Tách hóa đơn thành nhiều hóa đơn lẻ (Split bill).
- Kiosk tự phục vụ khách tự bấm gọi món (Self-ordering kiosk).
- Xác thực sinh trắc học vân tay / khuôn mặt.
- Quẹt thẻ qua máy mPOS cầm tay.
- Định lượng trừ kho nguyên liệu tự động (BOM) — đã hoãn sang giai đoạn sau theo DEC-04.
- Dự báo doanh thu bằng AI / học máy.

---

## Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi | Nguồn |
|---|---|---|---|
| 1.0 | 2026-10-20 | Khởi tạo đầy đủ 39 test case (TC-01 đến TC-39) tương ứng 39 điều kiện kiểm thử CHK theo ISO/IEC/IEEE 29119-3 phủ kín 29 AC, 15 FR, 14 BR, 12 ERR và 6 NFR | 06-test-checklist.md v1.0 |
