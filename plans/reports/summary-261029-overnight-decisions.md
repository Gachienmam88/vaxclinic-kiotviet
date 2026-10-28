# Tổng kết đêm 28→29/10/2026 — việc đã làm & quyết định thay chủ cửa hàng

## Trạng thái
- Hệ thống chạy tại http://localhost:3010 (bật: `powershell -ExecutionPolicy Bypass -File scripts\start-all-local.ps1`, tắt: `scripts\stop-all-local.ps1`).
- Kiểm thử: 21/21 bộ e2e đạt (sau khi sửa 3 bộ lỗi), 48 test frontend + unit test backend đạt, CI/CD GitHub xanh toàn bộ.
- Dữ liệu thử đã xóa; còn: thông tin cửa hàng, 1 chi nhánh CN001, admin, 7 vai trò, thiết lập, 7 thuế suất, 5 kênh bán, nhóm hàng "Vắc xin".
- Sao lưu trước khi xóa: `backups/261028-before-test-data-wipe/`, `backups/261029-before-final-test-data-wipe/` (pg_dump -Fc).

## Đã làm
| Mảng | Nội dung |
|---|---|
| Trả nhanh theo lô | Nhập lô mới (số lô + HSD); trùng số lô khác hạn → báo lỗi; hàng mới mặc định không quản lý lô |
| Hoa hồng | Phiếu trả nhanh trừ hoa hồng người lập phiếu |
| Thông báo | Hộp thư đến 3 tab Tất cả / Cảnh báo / Cập nhật; cảnh báo lô sắp hết hạn (30 ngày), dưới tồn tối thiểu, HĐĐT lỗi, đơn đặt đến hạn, chuyển hoàn, SePay, chữ ký số sắp hết hạn, hoàn kho tự động |
| Hồ sơ cửa hàng | Menu tài khoản, 2FA, thông tin gian hàng, đổi SĐT/tên/chuyển nhượng, bảo lưu, HĐĐT, chữ ký số, Điều khoản (bản nháp) |
| Chủ đề màu | 9 màu như KiotViet, chỉ khung (thanh menu, nút Bán hàng, avatar, thanh trên + nút thanh toán của màn bán hàng) đổi màu |
| Ngôn ngữ | Tiếng Việt, English, 中文, 日本語 (zh/ja "Bản thử nghiệm") toàn bộ giao diện |
| Kiến trúc | Báo cáo đồng bộ/bất đồng bộ, Redis, ElasticSearch, Saga, CI/CD: `plans/reports/architecture-261029-sync-async-redis-es-saga.md` |
| Sửa lỗi kiến trúc | Timeout mọi lời gọi nội bộ; tự đối soát hoàn kho khi lưu hóa đơn lỗi; khóa đăng nhập sau 5 lần sai; tìm không dấu |
| CI/CD | Repo riêng tư https://github.com/Gachienmam88/vaxclinic-kiotviet; CI + CD (6 image lên GHCR); triển khai chờ máy chủ; hướng dẫn `docs/deployment-guide.md` |

## Quyết định tôi đã tự đưa ra
1. Lô đã có nhưng tồn 0, nhập khác hạn → từ chối (an toàn hơn ghi đè hạn).
2. Admin đặt lại 2FA cho người khác: có. 2FA không bắt buộc.
3. Chủ đề màu chỉ đổi phần khung (đúng ảnh KiotViet 191); màu lưu theo từng máy (chưa có lưu trên server).
4. Ngôn ngữ: giữ VND và dd/MM/yyyy mọi ngôn ngữ; chứng từ in, HĐĐT, sổ sách thuế, điều khoản, tệp xuất kế toán/thuế giữ tiếng Việt; báo cáo tài chính ở en/ja/zh hiện bản dịch + thuật ngữ tiếng Việt; cột mẫu Excel import giữ tiếng Việt.
5. Không thêm RabbitMQ / Redis / ElasticSearch / công cụ Saga / Kubernetes ở quy mô 1 cửa hàng (mốc khi nào cần: xem báo cáo kiến trúc §roadmap).
6. Khóa đăng nhập theo tên đăng nhập (không theo IP thật).
7. Chặn mã/tên/ĐVT quá dài trước khi trừ kho; báo Hộp thư đến khi hệ thống tự hoàn kho.
8. Thiết lập cửa hàng làm mới nền mỗi 10 giây (đổi thiết lập có hiệu lực ≤ ~15 giây).
9. Lỗi phát hành HĐĐT báo cho nhân viên bán hàng (sales.perform).
10. CI/CD: GitHub Actions + GHCR + 1 VPS chạy docker compose, sao lưu trước mỗi lần triển khai, tự quay lại bản trước.
11. Gỡ lại hồ sơ MST thử 0260620017 (bài test tạo lại); khôi phục nhóm hàng mặc định "Vắc xin" đã lỡ xóa ở lần dọn đầu.

## Chưa xong / cần biết
- Việc anh/chị dừng giữa chừng: tách lớp Controller → Service → Repository cho Hồ sơ cửa hàng (mã vẫn dựng được) + 2 việc nhỏ kèm theo (chỉ ADMIN được đặt lại 2FA của ADMIN; báo cho người bị đặt lại) — CHƯA làm.
- Lỗi hiển thị #418 ở trang Hàng hóa tiếng Anh xuất hiện 1 lần ngay sau khởi động, không lặp lại.
- Từ ngữ tiếng Trung / Nhật cần người bản ngữ rà (danh sách trong `plans/reports/i18n-phase-2*-report.md`).
- Lần đầu đăng nhập sẽ hiện hộp "Điều khoản sử dụng" (admin chưa đồng ý) — đúng thiết kế.
- Hook trên máy tự commit mọi lần sửa file vào nhánh `feature/phase-01-foundation`; tôi đã đẩy lên `main` 1 lần để chạy CD.
