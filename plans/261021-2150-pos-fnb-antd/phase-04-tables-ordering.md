---
phase: 04
title: Sơ đồ bàn, gọi món, chuyển/gộp bàn
status: pending
priority: P1
depends: [02, 03]
---

# Phase 04 — Bàn và gọi món (US-02, US-04 · SCR-02, SCR-03)

Brief: `ba/handoff/US-02.md`, `US-04.md`. Phase này chỉ lưu đơn và trạng thái; việc in nằm ở phase 05 (nút Gửi Bếp gọi `PrintService`).

## Yêu cầu
FR-01, FR-02, FR-04, BR-02, BR-09, ERR-07, AC-02-1/2/3, AC-04-1/2. Trạng thái bàn theo SRS 8.1: TRONG → DANG_DUNG → CHO_THANH_TOAN (→ DANG_DUNG khi gọi thêm).

## Việc cần làm
1. API: `GET /api/v1/tables` (kèm khu vực và trạng thái), `POST /api/v1/orders` (mở đơn cho bàn), `POST /api/v1/orders/:id/items` (thêm/sửa số lượng/topping/ghi chú ≤ 100 ký tự), `POST /api/v1/orders/:id/send-kitchen` (lưu mốc "đã gửi", gọi in ở phase 05), `POST /api/v1/tables/transfer` (API-03: chuyển hoặc gộp).
2. Thêm món hết hàng bị chặn phía server (ERR-07, thay `{ten_mon}`), không chỉ phía UI.
3. Chuyển bàn: bàn đích phải TRONG. Gộp: bàn đích phải đang phục vụ, hợp nhất dòng món, bàn nguồn về TRONG, trong một transaction; tổng tiền tính lại (AC-04-2: 150.000 + 200.000 = 350.000).
4. Khóa lạc quan `orders.version`; xung đột trả 409 và UI tải lại.
5. Trạng thái bàn đổi tức thời: dùng polling 2-3 s qua React Query/SWR (đủ cho một quán; không cần websocket) để nhiều máy cùng thấy bàn.

## Màn hình / antd
- SCR-02: bố cục 2 cột. Trái: `Tabs` khu vực → lưới `Card`/`Badge.Ribbon` theo bàn (màu theo token: xanh/đỏ/vàng, có chữ trạng thái để không chỉ dựa vào màu); sau khi chọn bàn: `Segmented` danh mục + lưới món (`Card` ảnh, `Tag` "Hết hàng" và vô hiệu hóa). Phải: giỏ hàng bằng `List`/`Table` nhỏ với `InputNumber` hoặc nút ± , `Drawer` hoặc `Modal` chọn topping (`Checkbox.Group`) và ghi chú (`Input`).
- Thêm món ≤ 2 chạm (SRS 2.4): chạm món là thêm 1, topping/ghi chú là tùy chọn.
- SCR-03: `Modal` với `Segmented` (Chuyển/Gộp), `Descriptions` bàn nguồn, `Select` hoặc lưới bàn đích; khi hết bàn trống thì vô hiệu nút và hiện `Empty` giải thích.

## Kiểm chứng
- API test: AC-02-3 (món hết → ERR-07 đúng chữ), AC-04-1, AC-04-2, BR-02 (không đè bàn có khách).
- Test đồng thời: hai request thêm món cùng lúc không mất dòng.
- Playwright: chọn bàn → thêm 2 cà phê sữa + topping + ghi chú → giỏ đúng.
- Đo thủ công: thêm món < 0.5 s (NFR-01).

## Rủi ro / quay lui
Gộp bàn sai tiền là lỗi nặng: test bảng số liệu nhiều tổ hợp, so tổng trước/sau. Quay lui: revert migration; dữ liệu đơn nằm ở bảng riêng nên không ảnh hưởng ca.
