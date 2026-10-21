# POS Bán Hàng F&B (Quán Ăn, Cafe) — User story và tiêu chí chấp nhận

| Thông tin | Giá trị |
|---|---|
| Phiên bản | 0.1 · Nháp |
| Đầu vào | 03-srs.md v0.1 · 04-usecases.md v0.1 |

## Danh sách story

| ID | Là ... | Tôi muốn ... | Để ... | Ưu tiên | Ước lượng | Truy vết |
|---|---|---|---|---|---|---|
| US-01 | Thu ngân | Mở ca làm việc và nhập tiền lẻ đầu ca trong két | Bắt đầu bán hàng và phân định trách nhiệm tiền mặt rõ ràng | Must | 3 SP | FR-06 · UC-01 |
| US-02 | Nhân viên phục vụ | Xem sơ đồ bàn, tạo đơn gọi món và ghi chú khẩu vị cho từng món | Phục vụ đúng bàn và chuẩn bị món đúng ý khách | Must | 5 SP | FR-01 · FR-02 · UC-02 |
| US-03 | Nhân viên phục vụ | Gửi lệnh in phiếu chế biến KOT xuống khu vực Bếp và Bar qua mạng LAN | Bếp và Bar nhận thông tin order tức thì mà không cần chạy vào đưa giấy | Must | 5 SP | FR-03 · UC-02 |
| US-04 | Nhân viên phục vụ | Chuyển bàn hoặc gộp nhiều bàn đang phục vụ thành một đơn chung | Linh hoạt xử lý khi khách đổi vị trí ngồi hoặc nhập tiệc | Must | 3 SP | FR-04 · UC-03 |
| US-05 | Thu ngân | Bán hàng nhanh tại quầy mang về và in số thứ tự nhận món | Phục vụ khách mua mang đi nhanh chóng trong giờ cao điểm | Must | 5 SP | FR-05 · UC-04 |
| US-06 | Chủ quán / Quản lý | Yêu cầu xác thực mã PIN Quản lý khi nhân viên hủy món, chiết khấu bill hoặc xóa đơn | Kiểm soát chặt chẽ các hành vi có nguy cơ thất thoát và gian lận | Must | 5 SP | FR-10 · UC-05 |
| US-07 | Thu ngân | In phiếu tạm tính, thu tiền mặt và tự động tính tiền thối giao khách | Khách kiểm tra hóa đơn trước khi thanh toán và hoàn tất giao dịch tiền mặt chính xác | Must | 5 SP | FR-11 · FR-13 · UC-06 |
| US-08 | Thu ngân | Tạo và hiển thị mã VietQR động chứa chính xác số tiền cần trả | Khách thanh toán chuyển khoản không tiền mặt nhanh chóng và tiện lợi | Must | 5 SP | FR-12 · UC-06 |
| US-09 | Thu ngân | Ghi nhận các khoản nạp rút tiền mặt khẩn cấp trong ca (Cash In/Out) | Quỹ tiền mặt sổ sách luôn khớp đúng với thực tế trong két | Should | 2 SP | FR-07 · UC-07 |
| US-10 | Thu ngân và Quản lý | Kiểm đếm tiền mặt thực tế khi kết ca, giải trình độ lệch và ký duyệt đóng ca | Đối soát minh bạch dòng tiền và in biên bản bàn giao Z-Report | Must | 5 SP | FR-08 · FR-09 · UC-08 |
| US-11 | Chủ quán / Quản lý | Xem báo cáo doanh thu theo ca, theo nhân viên và theo phương thức thanh toán | Đánh giá hiệu quả kinh doanh và nắm bắt dòng tiền tức thời | Must | 5 SP | FR-14 · UC-09 |
| US-12 | Chủ quán / Quản lý | Quản lý danh mục món ăn, giá bán và bật tắt trạng thái hết món tức thời | Đảm bảo giá bán luôn cập nhật và nhân viên không order món đã hết nguyên liệu | Must | 3 SP | FR-15 · UC-10 |

## Tiêu chí chấp nhận

### Tiêu chí cho US-01 Mở ca làm việc và nhập tiền lẻ đầu ca

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-01-1 | Thu ngân chưa có ca làm việc nào đang mở | Thu ngân nhập số tiền mặt đầu ca là 1000000 VNĐ và bấm Xác nhận mở ca | Hệ thống tạo ca làm việc mới ở trạng thái DANG_MO, ghi nhận tiền đầu ca và chuyển sang màn hình Sơ đồ bàn | FR-06 |
| AC-01-2 | Thu ngân chưa mở ca làm việc | Thu ngân cố gắng chọn bàn hoặc tạo đơn bán hàng | Hệ thống chặn thao tác và hiển thị thông báo lỗi nguyên văn: "Ca làm việc chưa được mở. Vui lòng mở ca và nhập số dư tiền mặt đầu ca để bắt đầu." | BR-01 · ERR-01 |

**Ngoài phạm vi:** Đếm phân loại chi tiết từng mệnh giá tiền polyme (500k, 200k, 100k) ở màn hình mở ca.

**Kiểm INVEST:** Đạt (Độc lập, ước lượng 3 SP, kiểm thử được).

---

### Tiêu chí cho US-02 Xem sơ đồ bàn và gọi món tại bàn

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-02-1 | Sơ đồ bàn hiển thị các bàn Bàn 01 (Trống, xanh lá), Bàn 02 (Đang dùng, đỏ), Bàn 03 (Chờ thanh toán, vàng) | Nhân viên chọn Bàn 01 | Hệ thống mở giao diện gọi món cho Bàn 01 với giỏ hàng rỗng | FR-01 · FR-02 |
| AC-02-2 | Nhân viên đang ở màn hình gọi món của bàn | Nhân viên chọn 2 Cà phê sữa, chọn topping Thạch cà phê và nhập ghi chú "Ít ngọt" | Hệ thống thêm 2 dòng món vào đơn hàng với đơn giá và ghi chú chính xác | FR-02 |
| AC-02-3 | Món Sinh tố bơ đang ở trạng thái HET_HANG trong thực đơn | Nhân viên bấm chọn món Sinh tố bơ | Hệ thống chặn thêm món và hiển thị thông báo: "Món Sinh tố bơ hiện đã hết. Vui lòng chọn món khác!" | BR-09 · ERR-07 |

**Ngoài phạm vi:** Đặt bàn trước (Reservation) theo lịch hẹn trước nhiều ngày.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-03 In phiếu chế biến Bếp/Bar tự động

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-03-1 | Bàn 01 đã chọn 2 Cà phê muối và 1 Mì bò trứng | Nhân viên bấm nút Gửi Bếp | Hệ thống lưu đơn hàng, chuyển trạng thái Bàn 01 sang Đang dùng và gửi lệnh in phiếu KOT xuống máy in qua mạng LAN | FR-03 |
| AC-03-2 | Dây mạng máy in Bếp bị rút hoặc máy in bị tắt nguồn | Nhân viên bấm nút Gửi Bếp | Đơn hàng vẫn được lưu trên POS và hệ thống hiển thị cảnh báo: "Không thể kết nối tới máy in bếp. Vui lòng kiểm tra nguồn điện và dây mạng của máy in!" kèm nút Thử in lại | ERR-06 |

**Ngoài phạm vi:** Màn hình điều phối chế biến điện tử không dùng giấy (KDS Screen) ở giai đoạn 1.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-04 Chuyển bàn và gộp bàn phục vụ

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-04-1 | Bàn 01 đang có khách với 3 món, Bàn 05 đang trống | Nhân viên chọn Bàn 01, bấm Chuyển bàn, chọn Bàn 05 và xác nhận | Toàn bộ 3 món chuyển sang Bàn 05, Bàn 05 chuyển sang Đang dùng, Bàn 01 trở về trạng thái Trống | FR-01 · FR-04 · BR-02 |
| AC-04-2 | Bàn 01 có hóa đơn 150000 VNĐ, Bàn 02 có hóa đơn 200000 VNĐ | Nhân viên thực hiện gộp Bàn 02 vào Bàn 01 | Bàn 01 chứa toàn bộ món của cả 2 bàn với tổng tiền 350000 VNĐ, Bàn 02 chuyển về trạng thái Trống | FR-04 |

**Ngoài phạm vi:** Tách một bàn đang dùng thành nhiều hóa đơn thanh toán riêng lẻ cho từng người (Split bill).

**Kiểm INVEST:** Đạt (Ước lượng 3 SP, kiểm thử được).

---

### Tiêu chí cho US-05 Bán hàng nhanh tại quầy mang về

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-05-1 | Thu ngân ở tab Bán tại quầy và đã chọn 1 Trà sữa trân châu | Thu ngân chọn thanh toán tiền mặt 35000 VNĐ và bấm Hoàn tất | Hệ thống tạo hóa đơn loại MANG_VE, in hóa đơn giao khách và in phiếu nhận đồ có số thứ tự tự động tăng | FR-05 · BR-10 |
| AC-05-2 | Giỏ hàng tại quầy chưa có bất kỳ món nào | Thu ngân bấm nút Thanh toán | Hệ thống chặn thao tác và hiển thị thông báo lỗi: "Đơn hàng chưa có món ăn. Vui lòng chọn món trước khi thanh toán!" | BR-10 · ERR-08 |

**Ngoài phạm vi:** Tích hợp gọi đồ trực tiếp từ màn hình tương tác tự phục vụ của khách (Self-ordering kiosk).

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-06 Bảo mật thao tác nhạy cảm bằng mã PIN Quản lý

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-06-1 | Bàn 02 có món Trà đào đã gửi bếp | Nhân viên bấm Hủy món, nhập lý do "Khách đổi món" và Quản lý nhập đúng mã PIN 1234 | Món được xóa khỏi hóa đơn bàn, hệ thống tự động in phiếu Báo hủy món xuống quầy Bar và ghi nhật ký kiểm toán | FR-10 · BR-03 |
| AC-06-2 | Nhân viên bấm nút Giảm giá 20% trên hóa đơn | Quản lý nhập sai mã PIN | Hệ thống chặn giảm giá và hiển thị thông báo: "Mã PIN phê duyệt không chính xác. Vui lòng kiểm tra lại!" | BR-04 · ERR-02 |
| AC-06-3 | Người dùng cố gắng thử mã PIN liên tục | Người dùng nhập sai mã PIN lần thứ 5 liên tiếp | Hệ thống khóa chức năng nhập mã PIN trong 5 phút và hiển thị: "Bạn đã nhập sai mã PIN quá 5 lần. Chức năng xác thực bị khóa tạm thời trong 5 phút!" | BR-04 · ERR-03 |

**Ngoài phạm vi:** Xác thực sinh trắc học (vân tay, khuôn mặt) trên máy POS.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-07 Thanh toán tiền mặt và in hóa đơn

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-07-1 | Bàn 03 có tổng tiền khách cần trả là 175000 VNĐ | Thu ngân bấm In tạm tính | Bàn 03 chuyển sang màu vàng (Chờ thanh toán) và máy in xuất phiếu tạm tính | FR-01 · FR-13 |
| AC-07-2 | Hóa đơn cần trả 175000 VNĐ | Thu ngân chọn Tiền mặt, nhập khách đưa 200000 VNĐ và bấm Hoàn tất | Hệ thống hiển thị tiền thối 25000 VNĐ, cập nhật đơn sang DA_THANH_TOAN, giải phóng bàn về TRONG và in bill thanh toán | FR-11 · FR-13 · BR-08 |
| AC-07-3 | Máy in hóa đơn bị hết giấy | Thu ngân bấm thanh toán hoàn tất | Hệ thống lưu trạng thái đơn đã thanh toán thành công và cảnh báo: "Máy in hóa đơn hết giấy hoặc bị kẹt. Vui lòng kiểm tra giấy và in lại!" | BR-12 · ERR-10 |

**Ngoài phạm vi:** Thanh toán bằng điểm tích lũy thành viên hoặc voucher điện tử của bên thứ ba.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-08 Thanh toán bằng mã VietQR động

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-08-1 | Hóa đơn HD-20261020-0012 có số tiền cần thanh toán 150000 VNĐ | Thu ngân chọn phương thức thanh toán Chuyển khoản VietQR | Hệ thống tạo và hiển thị mã VietQR động chứa chính xác số tài khoản quán, số tiền 150000 và nội dung chuyển khoản HD0012 | FR-12 |
| AC-08-2 | Khách quét mã chuyển khoản và tiền vào tài khoản quán | Thu ngân bấm nút Xác nhận đã nhận tiền | Hóa đơn chuyển sang DA_THANH_TOAN với kênh thanh toán là VIETQR và in hóa đơn giao khách | FR-12 |
| AC-08-3 | Màn hình hiển thị mã VietQR động quá 3 phút khách chưa quét | Thời gian chờ vượt quá 3 phút (180 giây) | Hệ thống cảnh báo: "Hết thời gian chờ thanh toán VietQR. Vui lòng tạo mã QR mới hoặc thanh toán tiền mặt!" kèm nút Tạo lại mã QR | BR-11 · ERR-09 |

**Ngoài phạm vi:** Quẹt thẻ ngân hàng qua máy POS quẹt thẻ POS cầm tay (máy mPOS).

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-09 Ghi nhận thu chi tiền mặt khẩn cấp trong ca

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-09-1 | Ca làm việc đang mở | Thu ngân chọn Chi tiền mặt, nhập số tiền 50000 VNĐ, lý do "Mua đá uống gấp" và bấm Xác nhận | Hệ thống tạo phiếu chi tiền mặt, tự động trừ 50000 VNĐ vào Tiền mặt lý thuyết của ca và in phiếu chi | FR-07 · BR-05 |
| AC-09-2 | Ca làm việc đang mở | Thu ngân chọn Thu tiền mặt, nhập số tiền 200000 VNĐ, lý do "Nạp thêm tiền lẻ thối" và bấm Xác nhận | Hệ thống tạo phiếu thu tiền mặt, tự động cộng 200000 VNĐ vào Tiền mặt lý thuyết của ca và in phiếu thu | FR-07 · BR-05 |

**Ngoài phạm vi:** Quản lý ngân sách quỹ chi tiêu chi tiết theo kế hoạch tài chính năm.

**Kiểm INVEST:** Đạt (Ước lượng 2 SP, kiểm thử được).

---

### Tiêu chí cho US-10 Kiểm kê tiền mặt kết ca và ký duyệt đóng ca

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-10-1 | Bàn 04 vẫn đang phục vụ khách chưa thanh toán | Thu ngân bấm Kết ca làm việc | Hệ thống chặn đóng ca và thông báo lỗi: "Không thể đóng ca! Vẫn còn 1 bàn chưa hoàn tất thanh toán. Vui lòng thanh toán hoặc bàn giao bàn." | BR-07 · ERR-04 |
| AC-10-2 | Mọi bàn đã thanh toán xong, Tiền mặt lý thuyết tính ra là 3500000 VNĐ | Thu ngân kiểm đếm két và nhập tiền thực tế là 3500000 VNĐ (lệch 0 VNĐ), Quản lý nhập PIN duyệt | Ca chuyển sang DA_DONG, hệ thống in biên bản bàn giao Z-Report và đăng xuất tài khoản | FR-08 · FR-09 · BR-05 |
| AC-10-3 | Tiền mặt lý thuyết là 3500000 VNĐ, tiền thực đếm trong két là 3450000 VNĐ (thiếu 50000 VNĐ) | Thu ngân không nhập lý do giải trình mà bấm Xác nhận | Hệ thống chặn và hiển thị: "Tiền mặt thực tế bị lệch -50,000 VNĐ. Vui lòng nhập lý do giải trình để tiếp tục!" | BR-06 · ERR-05 |

**Ngoài phạm vi:** Đóng gói cất tiền vào két sắt điện tử tự động kết nối qua cổng IoT.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-11 Xem báo cáo doanh thu theo ca và phương thức thanh toán

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-11-1 | Quản lý quán đang ở màn hình Báo cáo doanh thu | Quản lý chọn khoảng thời gian Hôm nay | Hệ thống hiển thị tổng doanh thu thuần, biểu đồ tỷ trọng Tiền mặt vs VietQR, doanh thu theo từng ca và top 5 món bán chạy nhất | FR-14 |
| AC-11-2 | Quản lý chọn bộ lọc tùy chọn khoảng ngày | Quản lý chọn Từ ngày 2026-10-25 đến ngày 2026-10-20 (ngày bắt đầu lớn hơn ngày kết thúc) | Hệ thống chặn tìm kiếm và hiển thị thông báo lỗi: "Ngày bắt đầu không được lớn hơn ngày kết thúc!" | BR-13 · ERR-11 |

**Ngoài phạm vi:** Dự báo doanh thu bằng mô hình AI học máy (Machine Learning) trong tương lai.

**Kiểm INVEST:** Đạt (Ước lượng 5 SP, kiểm thử được).

---

### Tiêu chí cho US-12 Quản lý thực đơn và cập nhật trạng thái món

| ID | Cho (Given) | Khi (When) | Thì (Then) | Liên quan |
|---|---|---|---|---|
| AC-12-1 | Quản lý truy cập màn hình Danh mục thực đơn | Quản lý bấm nút tắt kinh doanh cho món Trà sữa matcha | Trạng thái món chuyển sang HET_HANG, toàn bộ màn hình POS của phục vụ không cho chọn món này nữa | FR-15 · BR-09 |
| AC-12-2 | Quản lý nhập thông tin tạo món mới | Quản lý nhập đơn giá là -10000 VNĐ và bấm Lưu | Hệ thống chặn lưu và hiển thị thông báo lỗi: "Đơn giá món ăn không được nhỏ hơn 0 VNĐ!" | BR-14 · ERR-12 |

**Ngoài phạm vi:** Đồng bộ thực đơn tự động với các sàn thương mại điện tử giao đồ ăn.

**Kiểm INVEST:** Đạt (Ước lượng 3 SP, kiểm thử được).

---

## Sẵn sàng để làm (Definition of Ready)

- Story trích FR hoặc UC, và mọi ID nó trích đã được định nghĩa.
- Có 2–6 tiêu chí chấp nhận cho mỗi story, ít nhất một tiêu chí cho lỗi hoặc quy tắc (ERR / BR).
- Không còn câu hỏi mở (OQ) chặn phạm vi triển khai của story.
- Không còn giá trị "đề xuất" chưa xác nhận trong các dòng nó dùng.
- Đã ghi rõ ràng dòng "Ngoài phạm vi" cho từng story.
- Đội phát triển đã ước lượng được Story Point (SP).

## Định nghĩa hoàn thành (Definition of Done)

- Mọi tiêu chí chấp nhận đều có test case và kiểm thử tự động/thủ công đã vượt qua.
- Thông báo lỗi hiển thị đúng nguyên văn như đã định nghĩa trong bảng ERR.
- Không có hành vi tự ý phát sinh ngoài các tiêu chí đã duyệt.
- Cập nhật tài liệu đối chiếu code (10-drift.md) sau khi nghiệm thu từng story.
- Đã kiểm tra tương thích trên máy in nhiệt ESC/POS và thiết bị màn hình chạm.

## Lịch sử thay đổi

| Phiên bản | Ngày | Thay đổi | Nguồn |
|---|---|---|---|
| 0.1 | 2026-10-20 | Khởi tạo 12 user story theo chuẩn INVEST và tiêu chí Gherkin Cho/Khi/Thì phủ kín 15 FR | 03-srs.md · 04-usecases.md |
