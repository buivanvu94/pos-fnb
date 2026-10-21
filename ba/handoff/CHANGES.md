# Nhật ký thay đổi brief

<!-- Sinh bởi ba_handoff.py; mới nhất ở trên. -->

## 2026-10-20

### US-02

- Thêm: > **Sẵn sàng để làm** (đạt các điều kiện DoR kiểm tự động).
- Bỏ: > **CHƯA SẴN SÀNG.** Không bắt đầu code tới khi BA xử lý:
- Bỏ: >
- Bỏ: > - còn câu hỏi mở: OQ-08
- Bỏ: - **FR-03** — Hệ thống phải tự động gửi lệnh in phiếu chế biến (KOT) xuống máy in Bếp/Bar tương ứng ngay khi nhân viên bấm nút Gửi Bếp. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-03, AS-03)
- Thêm: - **FR-03** — Hệ thống phải tự động gửi lệnh in phiếu chế biến (KOT) xuống máy in Bếp/Bar tương ứng (tách 2 máy in Bar và Bếp độc lập) ngay khi nhân viên bấm nút Gửi Bếp. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-03, AS-03, DEC-07)
- Thêm: - **DEC-07** — In tách riêng phiếu chế biến KOT: Món ăn in tại Bếp, đồ uống in tại Quầy Bar qua 2 máy in nhiệt LAN độc lập (Phương án đã cân nhắc: In chung 1 máy in · Ai chốt, ngày: Khách hàng (Bùi Vũ), 2026-10-20)
- Bỏ: ## 13. Câu hỏi còn mở (chặn story này)
- Bỏ: - **OQ-08** — Có cần cấu hình phân luồng tự động món nước ra máy in Bar và món ăn ra máy in Bếp độc lập không? (Vì sao quan trọng: Ảnh hưởng đến logic định tuyến lệnh in KOT ở FR-03 · Hỏi ai: Quản lý quán · Trạng thái: Mở)
- Bỏ: ## 14. Kiểm chứng
- Thêm: ## 13. Kiểm chứng

### US-03

- Thêm: > **Sẵn sàng để làm** (đạt các điều kiện DoR kiểm tự động).
- Bỏ: > **CHƯA SẴN SÀNG.** Không bắt đầu code tới khi BA xử lý:
- Bỏ: >
- Bỏ: > - còn câu hỏi mở: OQ-08
- Bỏ: - **FR-03** — Hệ thống phải tự động gửi lệnh in phiếu chế biến (KOT) xuống máy in Bếp/Bar tương ứng ngay khi nhân viên bấm nút Gửi Bếp. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-03, AS-03)
- Thêm: - **FR-03** — Hệ thống phải tự động gửi lệnh in phiếu chế biến (KOT) xuống máy in Bếp/Bar tương ứng (tách 2 máy in Bar và Bếp độc lập) ngay khi nhân viên bấm nút Gửi Bếp. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-03, AS-03, DEC-07)
- Thêm: - **DEC-07** — In tách riêng phiếu chế biến KOT: Món ăn in tại Bếp, đồ uống in tại Quầy Bar qua 2 máy in nhiệt LAN độc lập (Phương án đã cân nhắc: In chung 1 máy in · Ai chốt, ngày: Khách hàng (Bùi Vũ), 2026-10-20)
- Bỏ: ## 13. Câu hỏi còn mở (chặn story này)
- Bỏ: - **OQ-08** — Có cần cấu hình phân luồng tự động món nước ra máy in Bar và món ăn ra máy in Bếp độc lập không? (Vì sao quan trọng: Ảnh hưởng đến logic định tuyến lệnh in KOT ở FR-03 · Hỏi ai: Quản lý quán · Trạng thái: Mở)
- Bỏ: ## 14. Kiểm chứng
- Thêm: ## 13. Kiểm chứng

### US-05

- Bỏ: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn trên màn hình để khách quét chuyển khoản. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04)
- Thêm: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn, đồng thời tự động nhận webhook từ cổng SePay để hoàn tất đơn hàng tức thì. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04, DEC-06)
- Thêm: - **DEC-06** — Tích hợp SePay nhận biến động số dư ngân hàng tự động qua Webhook, tự động hoàn tất hóa đơn VietQR ngay khi tiền vào tài khoản (Phương án đã cân nhắc: Thu ngân đối soát thủ công trên app ngân hàng · Ai chốt, ngày: Khách hàng (Bùi Vũ), 2026-10-20)

### US-07

- Bỏ: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn trên màn hình để khách quét chuyển khoản. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04)
- Thêm: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn, đồng thời tự động nhận webhook từ cổng SePay để hoàn tất đơn hàng tức thì. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04, DEC-06)
- Thêm: - **DEC-06** — Tích hợp SePay nhận biến động số dư ngân hàng tự động qua Webhook, tự động hoàn tất hóa đơn VietQR ngay khi tiền vào tài khoản (Phương án đã cân nhắc: Thu ngân đối soát thủ công trên app ngân hàng · Ai chốt, ngày: Khách hàng (Bùi Vũ), 2026-10-20)

### US-08

- Bỏ: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn trên màn hình để khách quét chuyển khoản. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04)
- Thêm: - **FR-12** — Hệ thống phải tạo và hiển thị mã VietQR động chứa chính xác số tiền cần thanh toán và mã hóa đơn, đồng thời tự động nhận webhook từ cổng SePay để hoàn tất đơn hàng tức thì. (Ưu tiên: Must · Kiểm chứng bằng: Test · Nguồn: OBJ-01, AS-04, DEC-06)
- Thêm: - **DEC-06** — Tích hợp SePay nhận biến động số dư ngân hàng tự động qua Webhook, tự động hoàn tất hóa đơn VietQR ngay khi tiền vào tài khoản (Phương án đã cân nhắc: Thu ngân đối soát thủ công trên app ngân hàng · Ai chốt, ngày: Khách hàng (Bùi Vũ), 2026-10-20)
## 2026-10-20

### US-02

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)

### US-03

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)

### US-04

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)

### US-05

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Bỏ: - **TC-22** — Xử lý máy in hóa đơn hết giấy / kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)
- Thêm: - **TC-22** — Xử lý máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)

### US-06

- Bỏ: - **TC-15** — Hủy món đã gửi bếp thành công với lý do >= 5 ký tự và mã PIN Quản lý (Truy vết: CHK-15 · AC-06-1 · BR-03 · FR-10 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-15** — Hủy món đã gửi bếp thành công với lý do tối thiểu 5 ký tự và mã PIN Quản lý (Truy vết: CHK-15 · AC-06-1 · BR-03 · FR-10 · Ưu tiên: Cao · Tự động hóa: Có)

### US-07

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Bỏ: - **TC-22** — Xử lý máy in hóa đơn hết giấy / kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)
- Thêm: - **TC-22** — Xử lý máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)

### US-08

- Bỏ: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (màu vàng) (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-19** — In phiếu tạm tính và chuyển màu bàn sang Chờ thanh toán (Truy vết: CHK-19 · AC-07-1 · FR-01 · FR-13 · Ưu tiên: Cao · Tự động hóa: Có)
- Bỏ: - **TC-22** — Xử lý máy in hóa đơn hết giấy / kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)
- Thêm: - **TC-22** — Xử lý máy in hóa đơn hết giấy hoặc kẹt giấy: ghi nhận thanh toán và cho in lại (Truy vết: CHK-22 · AC-07-3 · BR-12 · ERR-10 · FR-13 · Ưu tiên: Vừa · Tự động hóa: Không)

### US-09

- Bỏ: - **TC-28** — Chặn tạo phiếu thu chi với số tiền <= 0 VNĐ hoặc lý do để trống (Truy vết: CHK-28 · AC-09-1 · BR-05 · FR-07 · Ưu tiên: Vừa · Tự động hóa: Có)
- Thêm: - **TC-28** — Chặn tạo phiếu thu chi với số tiền nhỏ hơn hoặc bằng 0 hoặc lý do để trống (Truy vết: CHK-28 · AC-09-1 · BR-05 · FR-07 · Ưu tiên: Vừa · Tự động hóa: Có)

### US-12

- Bỏ: - **TC-35** — Chặn tạo hoặc cập nhật món ăn với đơn giá < 0 VNĐ hoặc tên để trống (Truy vết: CHK-35 · AC-12-2 · BR-14 · ERR-12 · FR-15 · Ưu tiên: Cao · Tự động hóa: Có)
- Thêm: - **TC-35** — Chặn tạo hoặc cập nhật món ăn với đơn giá nhỏ hơn 0 hoặc tên để trống (Truy vết: CHK-35 · AC-12-2 · BR-14 · ERR-12 · FR-15 · Ưu tiên: Cao · Tự động hóa: Có)
