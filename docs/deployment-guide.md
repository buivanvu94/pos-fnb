# Hướng dẫn triển khai POS F&B tại quán

Tài liệu này dành cho người cài đặt và vận hành. Yêu cầu nghiệp vụ nằm ở `ba/`, mô tả hệ thống ở `README.md`.

## 1. Kiến trúc triển khai

- **Một máy chủ đặt tại quán** (mini PC hoặc chính máy thu ngân) chạy ứng dụng Next.js và PostgreSQL. Các máy POS khác dùng trình duyệt truy cập qua mạng LAN.
- Máy chủ phải ở **cùng mạng LAN với máy in nhiệt** vì lệnh in đi qua TCP cổng 9100.
- Mất Internet không dừng bán hàng: gọi món, Gửi Bếp, in và thu tiền mặt đều chạy trong LAN. Chỉ có đồng bộ lên đám mây và Telegram phải chờ, chúng nằm trong hàng đợi `outbox` và tự gửi lại khi có mạng (mục 8).
- Thanh toán VietQR cần Internet (khách chuyển khoản, SePay gọi webhook về máy chủ, xem mục 7).

## 2. Yêu cầu

| Thành phần | Yêu cầu |
|---|---|
| Hệ điều hành | Windows 10/11 hoặc Linux |
| Node.js | 18 trở lên |
| PostgreSQL | Container Docker `pos-postgres`, cổng `15450` |
| Trình duyệt máy POS | Chrome hoặc Edge, màn hình 15-21 inch, ưu tiên cảm ứng |
| Máy in | ESC/POS qua LAN, khổ 80 mm hoặc 58 mm, cổng 9100 (bếp, bar, quầy hóa đơn) |

## 3. Cài đặt lần đầu

```bash
npm install
cp .env.example .env        # sau đó sửa các giá trị theo mục 4
npm run db:migrate          # áp dụng toàn bộ migration
npm run db:seed             # tài khoản quản lý đầu tiên (xem cảnh báo bên dưới)
npm run seed:menu -- duong_dan_file.csv   # nhập thực đơn trước go-live
```

Trên Windows có thể chạy `start.bat` ở thư mục gốc: nó tạo `.env` nếu thiếu, bật container, migrate rồi mở ứng dụng ở chế độ phát triển.

> **Cảnh báo seed:** tài khoản mẫu (`123456`, PIN `1234`) chỉ dành cho môi trường phát triển. Ở production, seed từ chối chạy nếu thiếu cờ `--force` và bắt buộc đặt `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_PIN`. Sau khi cài, Quản lý đổi PIN của mình (PIN 4-6 chữ số, không dùng số yếu).

## 4. Biến môi trường

Không đưa giá trị thật vào Git. `.env.example` chỉ chứa giá trị mẫu.

| Biến | Bắt buộc | Ý nghĩa |
|---|---|---|
| `DATABASE_URL` | Có | Chuỗi kết nối PostgreSQL của POS |
| `JWT_SECRET` | Có (production) | Khóa ký phiên, tối thiểu 32 ký tự |
| `COOKIE_SECURE` | Không | `true` khi chạy HTTPS, `false` khi chạy HTTP trong LAN quán |
| `TRUST_PROXY` | Không | `true` chỉ khi đứng sau reverse proxy tin cậy |
| `PRINTER_KITCHEN_IP`, `PRINTER_BAR_IP`, `PRINTER_RECEIPT_IP` | Không | IP máy in mặc định; Quản lý cũng chỉnh được trong màn hình cài đặt máy in. Chỉ chấp nhận dải IP nội bộ |
| `VIETQR_ENABLED`, `NEXT_PUBLIC_VIETQR_ENABLED` | Không | Bật hoặc tắt tab VietQR (đặt cả hai cùng giá trị) |
| `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO` | Khi dùng VietQR | Mã BIN ngân hàng và số tài khoản thụ hưởng |
| `SEPAY_API_KEY` (hoặc `SEPAY_WEBHOOK_SECRET`) | Khi dùng VietQR | Khóa xác thực webhook SePay. Thiếu khóa thì webhook từ chối mọi yêu cầu |
| `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` | Không | Gửi tóm tắt kết ca. Thiếu thì bỏ qua |
| `SYNC_TARGET_URL`, `SYNC_API_KEY` | Không | Đích đồng bộ lên đám mây. Thiếu `SYNC_TARGET_URL` thì sự kiện vẫn xếp hàng, không lỗi |
| `SYNC_WORKER_ENABLED` | Không | `true` để máy chủ tự gửi hàng đợi định kỳ. Mặc định tắt |
| `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_PIN` | Khi seed production | Mật khẩu và PIN của Quản lý đầu tiên |

## 5. Chạy production

```bash
npm run build
npm start            # mặc định cổng 3000
```

Để ứng dụng tự khởi động lại và chạy cùng máy:

- **PM2:** `pm2 start npm --name pos -- start`, rồi `pm2 save` và cài tự khởi động (`pm2-windows-startup` trên Windows, `pm2 startup` trên Linux).
- **Docker Compose / systemd:** chạy `npm start` với thư mục làm việc là thư mục dự án và nạp biến môi trường từ `.env`.

Chỉ chạy một bản ứng dụng cho mỗi cơ sở dữ liệu. Muốn đổi cổng: `npm start -- -p 8080`.

## 6. Máy in

1. Đặt IP tĩnh cho từng máy in, hoặc giữ chỗ trong DHCP.
2. Nhập IP trong màn hình cài đặt máy in của Quản lý (bếp, bar, quầy hóa đơn, khổ giấy, mở két).
3. In thử bằng máy thật: `npm run print:test -- <ip> <kitchen|bar|receipt>`.
4. Xem trước mẫu in mà không cần máy: `npm run print:preview` (ảnh ở `tmp/print-preview/`).

Máy in lỗi không chặn nghiệp vụ: đơn vẫn lưu, màn hình báo lỗi in và có nút "Thử in lại".

## 7. VietQR và SePay

1. Khai báo `VIETQR_BANK_BIN`, `VIETQR_ACCOUNT_NO`, `SEPAY_API_KEY` trong `.env`.
2. Trong SePay, cấu hình webhook về `POST https://<địa-chỉ-công-khai>/api/v1/webhooks/sepay` kèm khóa API ở header `Authorization: Apikey <khóa>`.
3. Máy chủ nằm trong LAN nên cần một đường vào công khai. Các lựa chọn: Cloudflare Tunnel hoặc ngrok chạy trên máy chủ quán, hoặc một relay đám mây. Quyết định này do chủ quán chọn; ứng dụng chỉ cần URL webhook tới được.
4. Tiền về không khớp hóa đơn (sai số tiền, sai nội dung, ca đã đóng) được ghi vào bảng `unmatched_transactions` để Quản lý xử lý, không tự hoàn tất đơn.
5. Mất Internet: khách vẫn trả được bằng tiền mặt. Có thể dùng QR tĩnh của ngân hàng và Quản lý xác nhận thủ công bằng PIN (có ghi nhật ký).

Khi cần tắt VietQR tạm thời: đặt `VIETQR_ENABLED=false` và `NEXT_PUBLIC_VIETQR_ENABLED=false`, build lại, thu tiền mặt như bình thường.

## 8. Đồng bộ và Telegram (hàng đợi outbox)

- Hóa đơn, ca, thu/chi và nhật ký quan trọng được ghi vào `outbox` **trong cùng giao dịch** với nghiệp vụ, nên không mất khi mất mạng.
- Bộ gửi thử lại với khoảng chờ tăng dần có trần. Lỗi mạng và lỗi 5xx không bao giờ chuyển thành lỗi vĩnh viễn; chỉ lỗi 4xx (phía nhận từ chối dữ liệu) mới đánh dấu lỗi.
- Thanh trên của ứng dụng có huy hiệu trạng thái: "Đã đồng bộ" hoặc "Còn N bản chờ đồng bộ". Không có nút xác nhận thủ công.
- Quản lý có thể kích gửi ngay hoặc đưa các bản lỗi về hàng đợi qua `POST /api/v1/sync/run`.
- Tin Telegram kết ca dùng chung hàng đợi; lỗi Telegram không chặn việc đóng ca.
- Phía nhận trên đám mây nằm ngoài phạm vi ứng dụng này. Khi chưa cấu hình `SYNC_TARGET_URL`, sự kiện nằm chờ.

## 9. Sao lưu và khôi phục

**Sao lưu** bằng `scripts/backup-db.ps1` (chạy `pg_dump` trong container, giữ 14 bản mới nhất ở thư mục `backups/`, không in mật khẩu):

```powershell
powershell -ExecutionPolicy Bypass -File scripts\backup-db.ps1
```

Đặt lịch hằng ngày bằng Windows Task Scheduler, ví dụ lúc 03:00:

```powershell
schtasks /Create /SC DAILY /ST 03:00 /TN "POS Backup" /TR "powershell -ExecutionPolicy Bypass -File \"D:\pos\scripts\backup-db.ps1\""
```

Trên Linux dùng `docker exec pos-postgres pg_dump -U <user> -d <db> --no-owner > backup.sql` trong cron. Nên sao chép thư mục `backups/` ra ổ khác hoặc lên đám mây.

**Khôi phục** vào cơ sở dữ liệu trống:

```bash
docker cp backups/pos-YYYYMMDD-HHMM.sql pos-postgres:/tmp/restore.sql
docker exec pos-postgres psql -U <user> -d <db> -f /tmp/restore.sql
```

Luôn sao lưu trước khi migration hoặc nâng cấp. Thử khôi phục ra một cơ sở dữ liệu tạm ít nhất một lần trước go-live.

## 10. Kiểm tra trước khi bàn giao

```bash
npm run lint
npx tsc --noEmit
npm test             # Vitest, dùng cơ sở dữ liệu test riêng (DATABASE_TEST_URL)
npm run build
npm run test:e2e     # Playwright: luồng chính và kịch bản lỗi
```

- Các bộ test dùng chung một cơ sở dữ liệu test, **không chạy hai lượt song song**.
- `test:e2e` tự khởi động một server riêng ở cổng 3100 trỏ vào cơ sở dữ liệu test, không đụng dữ liệu thật. Lần đầu cần `npx playwright install chromium`. Đặt `E2E_EDGE=1` để chạy thêm trên Edge.
- Chạy migration và seed ít nhất hai lần để chắc tính idempotent.

## 11. Cổng sẵn sàng production

Đối chiếu với `ba/09-api.md` mục 7. Những mục cần máy thật hoặc người thật nghiệm thu không thể tự động hóa:

- [ ] Cấu hình tài khoản ngân hàng, mã BIN và khóa SePay trong `.env`.
- [ ] Đã kiểm tra kết nối LAN tới máy in Bếp, Bar và quầy thu ngân, in thử cả khổ 80 mm và 58 mm.
- [ ] Đã chạy kiểm thử tự động toàn bộ 9 endpoint khớp `ba/api/pos-fnb.openapi.yaml` (bộ test đối chiếu có sẵn).
- [ ] Đã thử kịch bản mất Internet và mất máy in trên máy thật.
- [ ] Quản lý quán đã nghiệm thu quy trình kết ca, ký duyệt và Z-Report thực tế.
- [ ] Đã thử khôi phục từ bản sao lưu.

## 12. Chạy thử song song và quay lui

- Chạy song song với sổ tay trong khoảng 3 ngày, đối chiếu doanh thu mỗi ngày với báo cáo của hệ thống.
- Trong 24 giờ đầu giữ hóa đơn giấy dự phòng. Nếu phải quay lui, dữ liệu đã nhập vẫn giữ nguyên để đối chiếu.
- Số liệu đo hiệu năng (thêm món, Gửi Bếp đến khi ra phiếu) cần đo trên máy và máy in thật rồi ghi vào biên bản nghiệm thu.
