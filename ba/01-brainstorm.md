# POS Bán Hàng F&B (Quán Ăn, Cafe) — Kết quả khơi gợi yêu cầu

| Thông tin | Giá trị |
|---|---|
| Phiên bản | 0.1 · Nháp |
| Đầu vào | 00-intake.md v0.1 |
| Kỹ thuật khơi gợi | Phỏng vấn trực tiếp làm rõ yêu cầu nghiệp vụ |
| Người tham gia | Chủ quán / Quản lý F&B (Người dùng), Antigravity BA Agent |
| Ngày | 2026-10-20 |

## 1. Nhu cầu đã xác nhận

| Nhu cầu | Của ai | Nguồn |
|---|---|---|
| Bán hàng linh hoạt cả gọi món tại bàn (trả sau) lẫn order nhanh tại quầy (trả trước) | Thu ngân, Phục vụ | DEC-01, intake §1 |
| Quản lý chặt chẽ tiền mặt theo ca làm việc, tránh thất thoát tiền thu ngân | Chủ quán, Quản lý | DEC-02, intake §1 |
| Ngăn chặn gian lận khi nhân viên hủy món, chiết khấu hoặc xóa hóa đơn | Chủ quán | DEC-03 |
| Xem báo cáo doanh thu tức thời theo ca, theo nhân viên và theo kênh thanh toán | Chủ quán, Quản lý | DEC-04, intake §1 |

## 2. Phạm vi đề xuất

- **Trong phạm vi đợt 1:**
  - Sơ đồ bàn, trạng thái bàn (Trống, Đang dùng, Chờ thanh toán).
  - Nghiệp vụ bán hàng: Gọi món, thêm ghi chú (ít đường, không đá, không hành), in phiếu bếp/bar, tách/gộp bàn, chuyển bàn.
  - Quản lý ca làm việc: Mở ca (nhập tiền lẻ đầu ca), ghi nhận thu/chi vặt trong ca, kết ca (kiểm đếm tiền thực tế, tính thừa/thiếu), quản lý duyệt ca.
  - Phân quyền & Bảo mật: 3 vai trò (Quản lý, Thu ngân, Phục vụ); cơ chế mã PIN phê duyệt thao tác nhạy cảm.
  - Thanh toán đa phương thức: Tiền mặt, Chuyển khoản ngân hàng (quét mã VietQR động/tĩnh).
  - Báo cáo doanh thu: Doanh thu theo ca, theo ngày, phương thức thanh toán, top món bán chạy.
- **Ngoài phạm vi đợt này:**
  - Quản lý kho định lượng nguyên vật liệu chi tiết (BOM: gram thịt, ml sữa, hạt cafe) -> Chuyển sang giai đoạn 2.
  - Chuỗi nhiều chi nhánh (Multi-branch sync) -> Đợt 1 chạy độc lập cho 1 cửa hàng.
  - Tích hợp các app giao đồ ăn bên thứ ba (GrabFood, ShopeeFood) -> Đợt sau.

## 3. Năng lực ứng viên

| Năng lực | Phục vụ nhu cầu | MoSCoW | Nguồn |
|---|---|---|---|
| Bán hàng tại bàn (Gọi món, tách gộp bàn, in bếp, thanh toán sau) | Phục vụ khách ăn/uống tại chỗ | Must | DEC-01 |
| Bán mang về / Tại quầy (Order nhanh, in số thứ tự, thu tiền ngay) | Phục vụ khách mua mang đi hoặc quán tự phục vụ | Must | DEC-01 |
| Quản lý ca làm việc & Kiểm kê tiền mặt đầu - cuối ca | Chống thất thoát tiền mặt | Must | DEC-02 |
| Duyệt mã PIN Quản lý khi hủy món, giảm giá, hủy hóa đơn | Ngăn chặn nhân viên gian lận | Must | DEC-03 |
| Thanh toán VietQR & In hóa đơn nhiệt | Thanh toán nhanh, tiện lợi | Must | AS-02 |
| Báo cáo doanh thu theo ca, theo nhân viên và phương thức thanh toán | Kiểm soát hiệu quả kinh doanh | Must | DEC-04 |
| Quản lý thực đơn (Món, nhóm món, topping, giá, trạng thái hết món) | Vận hành bán hàng hàng ngày | Must | intake §1 |
| Ghi nhận khoản thu/chi tiền mặt khẩn cấp trong ca (Cash In/Out) | Minh bạch quỹ tiền mặt tại quầy | Should | DEC-02 |
| Chấm công nhân viên theo giờ làm qua ca POS | Tính lương nhân viên | Could | intake §1 |
| Định lượng kho nguyên vật liệu (BOM) | Quản lý kho chi tiết | Won't | DEC-04 |

## 4. Kịch bản đã khơi gợi

### Kịch bản 1: Mở ca làm việc
- Thu ngân đăng nhập vào hệ thống khi bắt đầu ca làm việc.
- Hệ thống yêu cầu nhập số tiền mặt đầu ca (tiền lẻ thối ban đầu).
- Thu ngân đếm tiền trong két, nhập số tiền, bấm "Xác nhận mở ca".
- Hệ thống in phiếu xác nhận mở ca (tùy chọn) và chuyển sang màn hình bán hàng.

### Kịch bản 2: Bán hàng tại bàn (Dine-in)
- Nhân viên phục vụ hoặc thu ngân chọn bàn trên sơ đồ phòng/bàn.
- Bàn chuyển sang màu đỏ (Đang dùng). Nhân viên chọn món, thêm topping hoặc ghi chú bếp.
- Bấm "Gửi bếp/bar": Hệ thống in phiếu chế biến (KOT) xuống máy in bếp hoặc hiển thị màn hình bếp.
- Khách gọi thêm món: Chọn bàn đó và thêm món, bấm gửi bổ sung.
- Khách yêu cầu thanh toán: Bấm "Tạm tính / In phiếu thanh toán", bàn chuyển sang trạng thái "Chờ thanh toán".
- Thu ngân nhận tiền mặt hoặc khách quét VietQR -> Bấm "Hoàn tất thanh toán" -> Bàn tự động chuyển về màu xanh (Trống).

### Kịch bản 3: Hủy món hoặc giảm giá hóa đơn (Thao tác nhạy cảm)
- Khách đã order món và đã gửi bếp, nhưng sau đó báo hết món hoặc khách đổi ý.
- Nhân viên bấm "Hủy món" hoặc "Giảm giá hóa đơn": Hệ thống hiện pop-up yêu cầu "Mã PIN Quản lý phê duyệt" và nhập lý do hủy.
- Quản lý nhập mã PIN 4-6 số.
- Nếu PIN đúng: Món được hủy khỏi hóa đơn, hệ thống tự động in phiếu báo hủy xuống bếp và ghi nhật ký kiểm toán (Audit log).
- Nếu PIN sai: Từ chối thao tác, thông báo "Mã PIN quản lý không chính xác".

### Kịch bản 4: Kết ca và bàn giao tiền mặt
- Cuối ca, thu ngân bấm "Kết ca làm việc".
- Hệ thống hiển thị form kiểm đếm tiền mặt: Thu ngân kiểm tiền thực tế trong két và nhập số tiền thực đếm.
- Hệ thống tự động so khớp:
  - Tiền mặt lý thuyết = Tiền đầu ca + Tiền mặt thu trong ca + Thu khác - Chi khác.
  - Độ lệch = Tiền mặt thực đếm - Tiền mặt lý thuyết.
- Quản lý kiểm tra xác nhận, ký duyệt đóng ca. Hệ thống in "Biên bản bàn giao ca" (Z-Report).

## 5. Quy tắc và giá trị ứng viên

| Loại | Nội dung | Giá trị | Nguồn |
|---|---|---|---|
| Giới hạn | Độ dài mã PIN phê duyệt của Quản lý | 4 đến 6 chữ số | DEC-03 |
| Giới hạn | Ngưỡng lệch tiền mặt cần cảnh báo đỏ khi chốt ca | Lệch > 0 VNĐ (dù thừa hay thiếu) | DEC-02 |
| Điều kiện | Điều kiện được phép đóng ca | Toàn bộ bàn đang phục vụ trong ca phải được thanh toán hoặc bàn giao cho ca tiếp theo | DEC-02 |
| Điều kiện | Hủy món sau khi đã gửi bếp | Bắt buộc có mã PIN Quản lý + Lý do hủy tối thiểu 5 ký tự | DEC-03 |
| Trạng thái | Vòng đời của bàn ăn | Trống -> Đang dùng -> Chờ thanh toán -> Trống | DEC-01 |
| Trạng thái | Vòng đời ca làm việc | Chưa mở -> Đang mở -> Chờ duyệt đóng ca -> Đã đóng | DEC-02 |
| Thông điệp | Cảnh báo lệch tiền khi đóng ca | "Cảnh báo: Tiền mặt thực tế lệch {so_tien_lech} VNĐ so với số liệu sổ sách!" | Đề xuất |
| Thông điệp | Từ chối hủy món không có quyền | "Thao tác yêu cầu quyền Quản lý. Vui lòng nhập mã PIN phê duyệt." | Đề xuất |

## 6. Quyết định

| ID | Quyết định | Phương án đã cân nhắc | Ai chốt, ngày |
|---|---|---|---|
| DEC-01 | Hỗ trợ song song 2 mô hình: Bán hàng tại quầy (Fast-casual/Takeaway) và Bán hàng theo sơ đồ bàn (Dine-in) | Chỉ làm bán tại quầy HOẶC chỉ làm bán theo bàn | Chủ quán, 2026-10-20 |
| DEC-02 | Quản lý ca chặt chẽ: Nhập tiền lẻ đầu ca, kiểm đếm tiền mặt thực tế cuối ca, hệ thống tính thừa/thiếu, Quản lý ký duyệt chốt ca | Thu ngân tự chốt không cần duyệt; hoặc chỉ tổng kết doanh thu theo giờ | Chủ quán, 2026-10-20 |
| DEC-03 | 3 vai trò (Quản lý, Thu ngân, Phục vụ). Các thao tác hủy món đã in bếp, giảm giá bill, xóa hóa đơn bắt buộc nhập mã PIN Quản lý | 2 vai trò, nhân viên tự do thao tác không cần mã PIN duyệt | Chủ quán, 2026-10-20 |
| DEC-04 | Đợt 1 tập trung báo cáo doanh thu chuyên sâu (theo ca, nhân viên, phương thức thanh toán, món hot); TẠM HOÃN định lượng kho (BOM) sang đợt sau | Làm kho định lượng BOM ngay từ đợt 1 | Chủ quán, 2026-10-20 |
| DEC-05 | Nền tảng thiết bị triển khai chính là Web trên máy tính PC để bàn / Máy POS chạm Windows (Màn hình 15-21 inch) tại quầy thu ngân và phục vụ | Tablet hoặc Mobile cầm tay | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-06 | Tích hợp SePay nhận biến động số dư ngân hàng tự động qua Webhook, tự động hoàn tất hóa đơn VietQR ngay khi tiền vào tài khoản | Thu ngân đối soát thủ công trên app ngân hàng | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-07 | In tách riêng phiếu chế biến KOT: Món ăn in tại Bếp, đồ uống in tại Quầy Bar qua 2 máy in nhiệt LAN độc lập | In chung 1 máy in | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-08 | Tỷ lệ ca lệch tiền mặt hiện tại của quán là 0.5% số ca (làm baseline đo lường cho OBJ-02) | Ước lượng cảm tính không có số liệu | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-09 | Tiêu chuẩn nghiệm thu NFR-05: Thời gian đào tạo tối đa để nhân viên mới thành thạo thao tác bán hàng cơ bản trên POS là 30 phút | 15 phút hoặc 60 phút | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-10 | Vận hành ngoại tuyến (Offline): Khi có mạng Internet trở lại, hệ thống tự động đồng bộ ngầm toàn bộ dữ liệu đơn hàng cục bộ lên máy chủ đám mây | Nút bấm xác nhận đồng bộ thủ công | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-11 | Két tiền mặt tại quầy (RJ12) tự động kích xung điện bật mở với mọi giao dịch thanh toán thành công (cả Tiền mặt lẫn VietQR) và khi tạo phiếu Thu/Chi | Chỉ mở khi thanh toán tiền mặt | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-12 | Hủy hóa đơn sau thanh toán (Void bill): Quản lý được phép hủy hóa đơn sai sót bất kỳ lúc nào trong ca làm việc, miễn là ca đó chưa bị đóng (chưa chốt Z-Report) | Giới hạn 30 phút hoặc bất kỳ lúc nào trong ngày | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-13 | Mẫu in hóa đơn: In đầy đủ Logo quán ở đầu bill, chi tiết thanh toán, và mã QR quét đăng nhập Wi-Fi miễn phí ở chân bill | Chỉ in văn bản thuần túy | Khách hàng (Bùi Vũ), 2026-10-20 |
| DEC-14 | Thông báo chốt ca tự động: Hệ thống tự động gửi tin nhắn tóm tắt doanh thu, phương thức thanh toán và chênh lệch két qua Telegram Bot cho Chủ quán ngay khi Quản lý duyệt đóng ca | Chỉ xem trên màn hình POS hoặc gửi email | Khách hàng (Bùi Vũ), 2026-10-20 |

## 7. Giả định và rủi ro

| ID | Giả định | Nếu sai thì |
|---|---|---|
| AS-03 | Quán sử dụng máy in nhiệt tiêu chuẩn (hỗ trợ lệnh ESC/POS qua cổng LAN hoặc USB) để in bill và in phiếu bếp | Cần phát triển thêm module driver riêng cho từng loại máy in |
| AS-04 | Thiết bị thanh toán VietQR tạo mã QR động chứa số tiền và mã hóa đơn để khách quét thanh toán tức thì | Thu ngân phải kiểm tra biến động số dư thủ công trên app ngân hàng |

| ID | Rủi ro | Khả năng | Ảnh hưởng | Cách giảm |
|---|---|---|---|---|
| RSK-01 | Giờ cao điểm mất kết nối mạng Internet khiến nhân viên không thể order hoặc thu tiền | Vừa | Cao | Thiết kế POS có khả năng hoạt động offline tạm thời và đồng bộ lại khi có mạng |
| RSK-02 | Thu ngân thông đồng với phục vụ hủy món sau khi khách đã trả tiền mặt để chiếm đoạt tiền | Vừa | Cao | Bắt buộc mã PIN Quản lý khi hủy món + Bếp chỉ hủy làm khi có phiếu in hủy từ hệ thống |

## 8. Câu hỏi còn mở

| ID | Câu hỏi | Vì sao quan trọng | Hỏi ai | Trạng thái |
|---|---|---|---|---|
| OQ-05 | Có cần tích hợp tự động đồng bộ biến động số dư ngân hàng (Webhook/Cassette) khi khách quét VietQR không, hay thu ngân bấm nút "Đã nhận tiền"? | Ảnh hưởng đến độ trễ lúc khách đông và việc kết nối cổng thanh toán | Chủ quán | Đã trả lời (DEC-06) |
| OQ-06 | Quán có yêu cầu in tách riêng phiếu Bar (đồ uống) và phiếu Bếp (món ăn) tới 2 máy in nhiệt khác nhau không? | Quyết định cấu hình chia luồng máy in KOT trong hệ thống | Chủ quán | Đã trả lời (DEC-07) |

## 9. Xác nhận kết quả khơi gợi

| Người xem lại | Ngày | Ý kiến |
|---|---|---|
| Chủ quán / Quản lý | 2026-10-20 | Đã xác nhận các quyết định kiến trúc chính (DEC-01 -> DEC-04) qua phiên phỏng vấn |

## Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi | Nguồn |
|---|---|---|---|
| 0.1 | 2026-10-20 | Tạo tài liệu khơi gợi yêu cầu sau phiên phỏng vấn 4 quyết định then chốt | Phiên phỏng vấn trực tiếp |
