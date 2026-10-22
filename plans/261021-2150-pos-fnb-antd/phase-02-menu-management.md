---
phase: 02
title: Quản lý thực đơn
status: completed
priority: P1
depends: [01]
---

# Phase 02 — Quản lý thực đơn (US-12 · FR-15 · SCR-10)

Brief: `ba/handoff/US-12.md`. Phải có trước vì bán hàng cần món.

## Yêu cầu
FR-15, BR-09 (món hết không được gọi), BR-14 (giá ≥ 0, tên không rỗng), ERR-12, AC-12-1, AC-12-2. Món có ảnh, nhóm món, topping (SRS FR-02).

## Việc cần làm
1. API: `GET/POST/PATCH /api/v1/menu/items`, `PATCH .../items/:id/availability`, `GET/POST /api/v1/menu/categories`, `GET/POST /api/v1/menu/toppings`. Chỉ Quản lý ghi; mọi vai trò đọc.
2. Zod: tên không rỗng, giá nguyên ≥ 0; lỗi giá âm trả đúng ERR-12.
3. Upload ảnh món lưu vào thư mục cục bộ có kiểm kích thước/loại.
4. Trang `/menu` (nhóm admin).
5. Nhập thực đơn từ Excel/CSV trước go-live (SRS 10): script `npm run seed:menu -- file.csv`.

## Màn hình / antd (SCR-10)
- Cây danh mục: `Menu` hoặc `Tree` ở cột trái.
- Danh sách món: `Table` (cột mã, tên, giá, trạng thái) với `Input.Search` lọc.
- Nút gạt Hết hàng: `Switch` trong cột; đổi tức thời, có `message.success`.
- Thêm/sửa: `Modal` + `Form` (`Input`, `InputNumber` formatter VND, `Select` nhóm, `Upload` ảnh); lỗi giá âm hiện ở `Form.Item`.

## Kiểm chứng
- Test API: giá -10000 → 400 + chuỗi ERR-12; tên rỗng → 400.
- Test: `PATCH availability` rồi `GET` thấy `HET_HANG`.
- Playwright: bật Switch, mở lại trang vẫn giữ.
- Phục vụ gọi `POST items` → 403.

## Rủi ro / quay lui
Ảnh lớn làm chậm lưới món; nén khi lưu. Quay lui: revert migration phase này.
