---
phase: 03
title: Mở ca và thu/chi trong ca
status: completed
priority: P1
depends: [01]
---

# Phase 03 — Mở ca, thu/chi vặt (US-01, US-09 · SCR-01, SCR-07)

Brief: `ba/handoff/US-01.md`, `US-09.md`.

## Yêu cầu
FR-06, FR-07, BR-01, BR-05, ERR-01, AC-01-1/2, AC-09-1/2. Tiền đầu ca = 0 được chấp nhận (biên của UC-01).

## Việc cần làm
1. `POST /api/v1/shifts/open` (API-01, 201): chỉ một ca `DANG_MO` mỗi thu ngân; sinh `MaCa`; lưu giờ mở.
2. `GET /api/v1/shifts/current` (bổ sung) trả ca và tiền mặt lý thuyết hiện tại theo BR-05.
3. `POST /api/v1/shifts/cash-transaction` (API-07, 201): loại THU/CHI, số tiền > 0, lý do bắt buộc; ghi `cash_entries`; kích sự kiện in phiếu và mở két (nối ở phase 05 qua `PrintService`, phase này chỉ ghi hàng đợi `print_jobs` nếu service đã có, nếu chưa thì để TODO có test pending).
4. Guard dùng chung `requireOpenShift()` cho mọi API bán hàng; trả ERR-01 và route redirect về `/open-shift`.
5. Phục vụ không được mở ca/thu chi (ma trận quyền).

## Màn hình / antd
- SCR-01 `/open-shift`: `Card` giữa màn, `Form`, `InputNumber` lớn (formatter VND, `size="large"`), nút `Button type="primary"`; lỗi ERR-01 bằng `Alert`.
- SCR-07: `Modal` mở từ nút trên thanh công cụ ca; `Segmented` chọn Thu/Chi, `InputNumber`, `Input.TextArea`; sau khi lưu cập nhật `Statistic` tiền mặt lý thuyết.

## Kiểm chứng
- Test: mở ca 1.000.000 → ca `DANG_MO`; mở lần hai khi còn ca mở → bị chặn.
- Test bán hàng khi chưa mở ca → 4xx kèm chuỗi ERR-01 nguyên văn (AC-01-2).
- Test BR-05: đầu ca 1.000.000, chi 50.000, thu 200.000 → lý thuyết đúng công thức (chưa tính bán hàng).
- Số tiền ≤ 0 hoặc lý do rỗng bị chặn.

## Rủi ro / quay lui
Đua hai tab cùng mở ca: dùng ràng buộc unique một phần (`status='DANG_MO'` theo user). Quay lui: revert migration.
