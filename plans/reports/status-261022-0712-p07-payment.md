# Báo cáo Trạng thái & Kế hoạch Thực thi Phase 07: Thanh toán Tiền mặt & Bán Mang về

Thời điểm báo cáo: 2026-10-22 07:22
Nhánh: `buivanvu94/p07-payment`
Văn bản yêu cầu: [phase-07-payment-cash-takeaway.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/plans/261021-2150-pos-fnb-antd/phase-07-payment-cash-takeaway.md), [US-05.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/ba/handoff/US-05.md), [US-07.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/ba/handoff/US-07.md), [plan.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/plans/261021-2150-pos-fnb-antd/plan.md), [README.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/README.md).

---

## 1. Hiện trạng Mã nguồn & Cơ sở Dữ liệu

- **Điểm neo (Baseline)**: Commit [`6e12810`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/README.md) (Phase 06: Quản lý mã PIN & Nhật ký kiểm toán `audit_logs`).
- **Migration & Schema**:
  - Đã có sẵn dự thảo migration [`0006_foamy_guardsmen.sql`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/migrations/0006_foamy_guardsmen.sql) cùng snapshot [`meta/0006_snapshot.json`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/migrations/meta/0006_snapshot.json) và [`meta/_journal.json`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/migrations/meta/_journal.json).
  - Schema đã khai báo các trường bổ sung tại [`orders-payments.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/orders-payments.ts):
    - `orders.queue_number` (`integer`), `orders.queue_date` (`varchar(10)`).
    - `orders.paid_at` (`timestamp with time zone`).
    - `orders.voided_at` (`timestamp with time zone`), `orders.voided_by_id` (`integer` FK `users.id`), `orders.void_reason` (`varchar(255)`).
    - Chỉ mục duy nhất [`orders_queue_date_number_unique`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/orders-payments.ts#L45-L47).
    - Mở rộng trạng thái `payments.status`: `('PENDING', 'SUCCESS', 'FAILED', 'VOIDED')`.
  - Schema đã khai báo mở rộng tại [`operations.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/operations.ts):
    - Mở rộng `print_jobs.job_type` bổ sung `'PICKUP_TICKET'`.
- **Kiểm thử tự động hiện tại**:
  - Chạy `npm test` thành công: 42/42 test files, 279/279 tests pass trên database `pos_test_p07`.
  - Migration 0006 áp dụng thành công trên cơ sở dữ liệu kiểm thử.

---

## 2. Phạm vi Nghiệp vụ Phase 07 (Ownership & Specification)

### 2.1 Backend Services & Data Logic
1. **In tạm tính (Provisional Print)**:
   - Endpoint: `POST /api/v1/orders/:id/provisional-print`.
   - Quyền: Cả 3 vai trò (`QUAN_LY`, `THU_NGAN`, `PHUC_VU`).
   - Ràng buộc: Chỉ áp dụng cho đơn `TAI_BAN` ở trạng thái `DANG_PHUC_VU` có ít nhất 1 món chưa hủy. Yêu cầu `expectedVersion`.
   - Kết quả: Bàn chuyển sang `CHO_THANH_TOAN` (vàng), tăng `version`, tạo hàng đợi in [`RECEIPT_TEMP`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/operations.ts#L29) từ dữ liệu tạm tính, dispatch sau khi transaction commit.
   - Chịu lỗi: Lỗi in không hoàn tác trạng thái, trả HTTP 200 kèm `printWarning: ERR-10`.
2. **Thanh toán Tiền mặt (Cash Payment - API-06)**:
   - Endpoint: `POST /api/v1/payments/cash`.
   - Quyền: Chỉ `QUAN_LY` và `THU_NGAN` (`PHUC_VU` trả 403).
   - Ràng buộc:
     - Phải có ca đang mở (`DANG_MO`) của chính người thanh toán (nếu không có: `ERR-01`).
     - Đơn phải ở trạng thái `DANG_PHUC_VU`, có ít nhất 1 món chưa hủy và tổng tiền khách cần trả > 0 (nếu rỗng hoặc tổng 0: `ERR-08`).
     - `tienKhachDua >= khachCanTra`. Tiền nguyên VND, chặn tràn số 2.000.000.000đ.
     - Yêu cầu `expectedVersion` để chống xung đột đồng thời.
   - Giao dịch đơn (Atomic Transaction):
     - Khóa bản ghi theo thứ tự cố định (tránh deadlock).
     - Cập nhật `orders.status = 'DA_THANH_TOAN'`, `orders.paid_at = now()`, `orders.payment_method = 'TIEN_MAT'`.
     - Nếu là đơn `MANG_VE`: sinh số thứ tự `queue_number` tăng dần trong ngày `queue_date` (dựa trên chuỗi khóa an toàn đa luồng).
     - Tạo bản ghi [`payments`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/orders-payments.ts#L112) với phương thức `TIEN_MAT`, trạng thái `SUCCESS`, `cash_given`, `cash_returned`.
     - Giải phóng bàn ăn về `TRONG` (nếu là đơn `TAI_BAN`).
     - Thêm lệnh in [`RECEIPT_FINAL`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/operations.ts#L29) có cờ `kickDrawer: true` (kích xung mở két RJ12).
     - Nếu là đơn `MANG_VE`: thêm lệnh in `PICKUP_TICKET` (phiếu nhận đồ có số thứ tự).
     - Gửi lệnh in sau khi transaction commit. Lỗi in không hoàn tác thanh toán, trả về 200 kèm `printWarning: ERR-10`.
   - Chống thanh toán đúp: Khi gọi lại cùng đơn đã thanh toán trả HTTP 409 rõ ràng, không tạo payment thứ hai.
3. **Mở đơn Bán tại quầy / Mang về (Takeaway Order)**:
   - Mở rộng `POST /api/v1/orders` cho phép tạo đơn loại `MANG_VE` không cần `tableId`.
   - Gắn với ca đang mở của người tạo đơn.
4. **In lại hóa đơn (Reprint Receipt)**:
   - Endpoint: `POST /api/v1/orders/:id/reprint`.
   - Quyền: `QUAN_LY` và `THU_NGAN`.
   - Ràng buộc: Chỉ áp dụng cho đơn `DA_THANH_TOAN`.
   - Tạo lệnh in `RECEIPT_FINAL` (không kích mở két tiền).
5. **Hủy hóa đơn sau thanh toán (Void Bill - DEC-12, BR-08)**:
   - Endpoint: `POST /api/v1/orders/:id/void`.
   - Ràng buộc:
     - Đơn phải ở trạng thái `DA_THANH_TOAN`.
     - Ca mở của thanh toán (`payments.shift_id`) phải còn `DANG_MO` (nếu đã đóng ca: trả HTTP 409).
     - Yêu cầu `expectedVersion`.
     - Phê duyệt: `QUAN_LY` không cần PIN nhưng bắt buộc nhập lý do (>= 5 ký tự); `THU_NGAN` bắt buộc nhập đúng mã PIN Quản lý và lý do.
   - Thao tác:
     - Đặt `orders.status = 'DA_HUY'`, cập nhật `orders.voided_at`, `orders.voided_by_id`, `orders.void_reason`.
     - Cập nhật `payments.status = 'VOIDED'`.
     - Không thay đổi trạng thái bàn ăn (đã giải phóng từ trước).
     - Ghi nhận nhật ký kiểm toán [`audit_logs`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/db/schema/users.ts) hành động `VOID_BILL`.
6. **Bảo vệ Tính Bất biến Hóa đơn đã thanh toán (BR-08)**:
   - Đơn đã thanh toán (`DA_THANH_TOAN`) bị chặn mọi thao tác sửa đổi: thêm/sửa món, giảm giá, hủy đơn, chuyển bàn, gửi bếp, in tạm tính đều phải trả HTTP 409.
7. **Danh sách Hóa đơn trong Ca (Invoices)**:
   - Endpoint: `GET /api/v1/invoices?scope=shift`.
   - Trả danh sách hóa đơn đã thanh toán trong ca của nhân viên (hoặc tất cả ca đang mở nếu là `QUAN_LY`).

### 2.2 In ấn & Mẫu in (Templates)
1. **Phiếu nhận đồ (Pickup Ticket)**:
   - File template: [`render-pickup-ticket.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/printing/templates/render-pickup-ticket.ts).
   - Định dạng: Số thứ tự `queue_number` in lớn nổi bật, mã đơn hàng, ngày giờ, nhân viên thu ngân, danh sách món và tổng tiền.
   - Khai báo payload [`PickupTicketPayload`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/printing/print-payload-types.ts) và tích hợp vào engine in.

### 2.3 Giao diện Người dùng (UI Ant Design)
1. **Màn hình Bán tại quầy (`/counter` - SCR-04)**:
   - Tái cấu trúc [`src/app/counter/page.tsx`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/app/counter/page.tsx).
   - Tìm kiếm món nhanh bằng `Input.Search`.
   - Lưới thẻ món ăn trực quan (chạm tối đa 2 lần để thêm món).
   - Bảng giỏ hàng bằng `Table` với nút tăng/giảm số lượng, xóa món.
   - Nút "Thanh toán nhanh": Mở đơn ngầm khi chọn món đầu tiên, chặn nếu giỏ rỗng kèm thông báo `ERR-08`.
   - Khóa truy cập đối với `PHUC_VU` (chỉ `QUAN_LY` và `THU_NGAN`).
   - Nút mở `Drawer` "Hóa đơn trong ca" hiển thị danh sách hóa đơn, nút "In lại" và nút "Hủy hóa đơn" (kích hoạt modal PIN Quản lý).
2. **Màn hình Thanh toán (`/payment/[id]` - SCR-06)**:
   - Tạo trang [`src/app/payment/[id]/page.tsx`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/app/payment/[id]/page.tsx).
   - Bảng kê chi tiết bằng `Descriptions`: Tổng tiền hàng, Giảm giá, Khách cần trả.
   - Điều khiển chọn phương thức bằng `Segmented`: "Tiền mặt" và "Chuyển khoản VietQR" (VietQR bị vô hiệu hóa kèm Tooltip thông báo sẽ bật tại Phase 08).
   - Khung tiền mặt: `InputNumber` khách đưa (cỡ lớn, định dạng VND), các nút chọn nhanh mệnh giá (`50.000đ`, `100.000đ`, `200.000đ`, `500.000đ`, và nút "Đủ tiền").
   - Hiển thị tiền thối bằng `Statistic`.
   - Nút "Hoàn tất thanh toán" (hiệu ứng loading, chống bấm 2 lần).
   - Sau khi thanh toán thành công: hiển thị màn hình `Result` tóm tắt tiền thối và nút "In lại hóa đơn".
   - Nếu xảy ra cảnh báo máy in `ERR-10`: hiển thị `Alert` nguyên văn cảnh báo kèm nút "Thử in lại".
3. **Màn hình Gọi món tại bàn (`/tables` - SCR-02)**:
   - Kích hoạt nút "In tạm tính" (gọi API provisional print và đổi màu bàn sang vàng).
   - Nút "Thanh toán" chuyển hướng sang `/payment/[id]`.

---

## 3. Kế hoạch Triển khai Chi tiết

| Bước | Hạng mục | Tệp tin liên quan | Trạng thái |
|:---:|---|---|:---:|
| 1 | Cấu trúc Payload & Template In phiếu nhận đồ | [`print-payload-types.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/printing/print-payload-types.ts), [`render-pickup-ticket.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/printing/templates/render-pickup-ticket.ts), [`print-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/printing/print-service.ts) | Đã hoàn thành |
| 2 | Backend Service: Đơn mang về & Số thứ tự | [`order-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/orders/order-service.ts), [`queue-number-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/payments/queue-number-service.ts) | Đã hoàn thành |
| 3 | Backend Service: In tạm tính & In lại | [`provisional-print-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/payments/provisional-print-service.ts), [`reprint-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/payments/reprint-service.ts) | Đã hoàn thành |
| 4 | Backend Service: Thanh toán Tiền mặt & Mở két | [`cash-payment-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/payments/cash-payment-service.ts) | Đã hoàn thành |
| 5 | Backend Service: Hủy hóa đơn (Void Bill) | [`void-bill-service.ts`](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/src/server/payments/void-bill-service.ts) | Đã hoàn thành |
| 6 | API Routes | `src/app/api/v1/payments/cash`, `provisional-print`, `reprint`, `void`, `invoices` | Đã hoàn thành |
| 7 | Bảo vệ Bất biến Đơn đã thanh toán (BR-08) | Rà soát các API routes đơn hàng: items, discount, cancel, transfer, send-kitchen | Đã hoàn thành |
| 8 | Giao diện Thanh toán SCR-06 | `src/app/payment/[id]/page.tsx`, `src/components/payment/*` | Đã hoàn thành |
| 9 | Giao diện Bán tại quầy SCR-04 | `src/app/counter/page.tsx`, `src/components/counter/*` | Đã hoàn thành |
| 10 | Tích hợp Gọi món tại bàn SCR-02 | `src/components/ordering/order-cart.tsx`, `ordering-view.tsx` | Đã hoàn thành |
| 11 | Bộ Test Tự động Phase 07 | `tests/api/payment-*.test.ts`, `tests/api/invoices.test.ts`, `tests/unit/payment-*.test.ts` | Đã hoàn thành |
| 12 | Cập nhật Tài liệu & Kiểm tra Build | [README.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/README.md), `npm run lint`, `npx tsc --noEmit`, `npm run build` | Đã hoàn thành |

---

## 4. Danh sách Câu hỏi Chưa giải quyết (Unresolved Questions)

1. **In phiếu nhận đồ cho đơn mang về không có đồ uống/bếp**: Khi đơn mang về chỉ gồm các món đóng gói sẵn không qua bếp/bar chế biến, hệ thống vẫn in phiếu nhận đồ `PICKUP_TICKET` theo mặc định hay có cần tùy chọn bỏ qua? (Mặc định: Luôn in `PICKUP_TICKET` để khách có số thứ tự đối chiếu nhận đồ).
2. **Số thứ tự `queue_number` khi qua ngày mới**: Khóa đánh số thứ tự tính theo ngày `queue_date` (định dạng `YYYY-MM-DD`). Trong trường hợp ca làm việc mở xuyên đêm (ví dụ từ 22:00 ngày hôm trước đến 03:00 ngày hôm sau), số thứ tự sẽ tự động quay về 1 khi thời điểm thanh toán bước sang ngày mới. Xác nhận phương án này là phù hợp với nghiệp vụ quán?

---

## 5. Kết quả Kiểm thử & Nghiệm thu Hoàn tất (Verification Summary)

- **Vitest Test Suite**: 49/49 test files passed, 313/313 tests passed (100% green, 0 regressions trên database `pos_test_p07`).
  - `tests/api/payment-cash.test.ts`: 7/7 tests pass.
  - `tests/api/payment-takeaway.test.ts`: 3/3 tests pass (bao gồm kiểm thử đa luồng 10 thanh toán đồng thời cấp số thứ tự `queue_number` duy nhất).
  - `tests/api/payment-provisional-reprint.test.ts`: 4/4 tests pass.
  - `tests/api/payment-void-bill.test.ts`: 6/6 tests pass.
  - `tests/api/payment-immutability-br08.test.ts`: 8/8 tests pass (khóa chặn thêm, sửa, xóa, giảm giá, hủy sau thanh toán).
  - `tests/api/invoices.test.ts`: 4/4 tests pass.
  - `tests/unit/payment-queue-number.test.ts`: 2/2 tests pass.
- **ESLint & TypeScript**:
  - `npm run lint`: 0 errors, 0 warnings (`✔ No ESLint warnings or errors`).
  - `npx tsc --noEmit`: 0 errors.
- **Production Build**:
  - `npm run build`: Thành công 100%, 36/36 static/dynamic routes được biên dịch tối ưu (không phụ thuộc kết nối DB khi build).
- **In ấn & Mẫu in**:
  - `npm run print:preview`: Xuất 18 ảnh PNG (khổ 80mm và 58mm) tại `tmp/print-preview/`, bao gồm `pickup-ticket-80mm.png` và `pickup-ticket-58mm.png`.
- **Kiến trúc Modularization**:
  - Toàn bộ các tệp tin mới tạo đều tuân thủ nghiêm ngặt giới hạn dưới 200 dòng lệnh (LOC), đặt tên chuẩn kebab-case.
- **Tài liệu**:
  - Cập nhật mục 7 tại [README.md](file:///C:/Users/Administrator/orca/workspaces/POS/p07-payment/README.md) phản ánh đầy đủ quy trình nghiệp vụ Phase 07, không xóa hoặc làm xáo trộn bất kỳ phần nội dung nào trước đó. Line endings chuẩn LF.
