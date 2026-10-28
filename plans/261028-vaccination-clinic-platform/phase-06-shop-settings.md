# Phase 06 — Thiết lập cửa hàng (KiotViet → Thiết lập)

Priority: P1 | Status: in progress — đợt 1, 2 xong 2026-10-28

## Mô hình
- Lưu ở identity-service, bảng `app_settings` (khóa → JSONB): `store`, `sales`, `customer`, `lock`. Quyền sửa: `settings.manage` (chỉ ADMIN mặc định).
- Service khác đọc `/internal/settings` qua `ShopSettingsClient` (common-lib), cache 30s → đổi thiết lập có hiệu lực sau ≤ 30s.
  identity-service không phản hồi → dùng bản đọc gần nhất; chưa đọc được lần nào → mặc định (quầy vẫn bán được).
- Chặn sửa/hủy HĐ đã phát hành HĐĐT: sales hỏi integration `/internal/einvoices/{id}/published`; không hỏi được → chặn.

## Done (đợt 1)
- [x] Khung Thiết lập: menu trái theo nhóm, ô tìm kiếm thiết lập (không dấu), mục lục phải; bánh răng → /settings
- [x] Hàng hóa: nhóm hàng (thêm/đổi tên/xóa), vị trí (thêm), giá vốn trung bình (thông tin)
- [x] Đơn hàng: cho phép bán khi hết tồn (chỉ hàng KHÔNG lô), giới hạn ngày trả hàng, khóa đổi thời gian giao dịch, chặn sửa/hủy HĐ đã phát hành HĐĐT, quy tắc mã giao dịch
- [x] Khách hàng: thông tin bắt buộc (backend kiểm tra + dấu * ở form), cảnh báo nợ vượt mức ở màn bán hàng
- [x] Sổ quỹ: tài khoản ngân hàng (chuyển vào khung) · Hóa đơn điện tử MISA (chuyển vào khung)
- [x] Thông tin cửa hàng + logo (thu nhỏ 256px, dùng cho mẫu in)
- [x] Quản lý người dùng: tab Tài khoản + tab Vai trò (tạo/sửa/sao chép/xóa, phân quyền theo nhóm); ADMIN luôn đủ quyền
- [x] Quản lý chi nhánh: thêm SL người dùng
- [x] Khóa sổ theo chi nhánh: chặn tạo/sửa/hủy HĐ, trả hàng, phiếu thu chi, thu nợ, nhập hàng, trả hàng nhập có ngày ≤ ngày khóa
- [x] E2E 28 kịch bản; lỗi tìm ra: tồn âm chặn cả chiều nhập lại (trả hàng/hủy HĐ) → chỉ chặn chiều xuất

## Done (đợt 2, 2026-10-28)
- [x] Mẫu in A5 (user chốt chỉ A5): 6 loại (hóa đơn, trả hàng, phiếu thu, phiếu chi, nhập hàng, trả hàng nhập); mẫu mặc định;
      trình sửa = mã HTML + chèn trường + xem trước; cú pháp {Truong}, {#Dong_Hang}..{/Dong_Hang}; lọc script trước khi in;
      nút In ở mọi chi tiết chứng từ + "In hóa đơn" ngay sau thanh toán ở màn bán hàng. Lưu: app_settings "print:{TYPE}".
- [x] Lịch sử thao tác: common-lib AuditLogger (HTTP, hàng đợi nền, gửi lại khi lỗi) → identity audit_logs; lọc, xuất CSV.
      Ghi: hóa đơn (tạo 1 lần kể cả đồng bộ lại), sửa, hủy, thuế; trả hàng; phiếu thu chi; thu nợ; khách hàng; nhập/trả hàng nhập;
      hàng hóa; thiết lập; mẫu in; người dùng, vai trò. Giới hạn: tắt service khi hàng đợi chưa gửi hết thì mất bản ghi đó.
- [x] SePay: webhook (Authorization: Apikey) qua tên miền web /api/payments/sepay/webhook; mã thanh toán VXC+8 ký tự trong nội dung QR;
      chống trùng theo id SePay; màn bán hàng (sale) hỏi trạng thái 3s/lần, đủ tiền → tự hoàn thành hóa đơn (tùy chọn). CHƯA thử với SePay thật.
- [x] Thuế & Kế toán HKD 2026: ngành nghề → % GTGT/TNCN; hồ sơ kê khai theo MST (nhóm 1–4, TNCN theo doanh thu / thu nhập),
      địa điểm kinh doanh ↔ chi nhánh; trang Thuế & Kế toán: tờ khai ước tính theo tháng/quý, sổ doanh thu S1a/S2a/S2b,
      sổ hàng hóa S2d, sổ tiền S2e; xuất CSV. Tỷ lệ lấy từ nguồn tổng hợp (MISA) — kế toán cần đối chiếu văn bản gốc.
- [x] E2E 23 kịch bản đợt 2; unit test tính thuế + đọc số bằng chữ

## Done (đợt 3, 2026-10-28)
- [x] Thuế theo ngành nghề: danh sách ngành tự khai (tên, % GTGT, % TNCN), ngành mặc định; gắn ngành cho nhóm hàng
      (nhóm con theo nhóm cha). Tờ khai + sổ doanh thu tách theo ngành. Ngưỡng 1 tỷ chia theo tỷ trọng doanh thu ngành
      trong kỳ (giả định, kế toán xác nhận). Sổ doanh thu trả theo ngày × mặt hàng × mã thuế.
- [x] Thiết lập → Sổ quỹ: tab Tài khoản ngân hàng / Ví điện tử, thêm / sửa / xóa (bank_accounts.kind, note)
- [x] E2E 12 kịch bản + unit test nhiều ngành; bộ cũ chạy lại đạt
- Quyết định: SePay bật sau khi có tên miền (user); chưa xuất XML tờ khai (user: chưa cần)

## Chưa làm / chờ user
- [ ] Xuất tờ khai XML nộp thẳng lên Cổng thuế (hiện: số liệu + CSV để kế toán nhập)
- [ ] Sổ S2c-HKD (chi tiết doanh thu, chi phí) dạng mẫu riêng; TNCN theo thuế suất từng mặt hàng (HKD_KCT_15...)
- [ ] Trình sửa mẫu in dạng kéo-thả như KiotViet (hiện sửa mã HTML)
- Bỏ qua (chưa có tính năng nền): giao hàng, SMS/Zalo, tiền tệ/ngoại tệ, cân điện tử, tích điểm/khuyến mại/voucher, đặt hàng, kết ca, thu khác, xóa dữ liệu gian hàng, bảo mật xuất file/2FA
