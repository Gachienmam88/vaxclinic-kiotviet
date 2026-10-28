# Phase 04 — Bán hàng, khách hàng, hóa đơn, sổ quỹ, công nợ (sales-service :8086)

Priority: P0 | Status: in progress — đợt 1 xong 2026-10-28

## Quyết định
- sales-service mới (sales_db). Bán hàng gọi product-service `/internal/stock-docs` (JWT nội bộ, gateway không route /internal).
- Idempotent 2 lớp: id hóa đơn do máy bán hàng sinh + kho chống trùng theo (docId, docType) → đồng bộ offline gửi lại an toàn.
- Hàng theo lô: tự phân bổ FEFO trên lô CÒN HẠN; thiếu → chặn bán (không bán vắc xin hết hạn). Khóa dòng tồn trước khi đọc lô.
- Hủy hóa đơn: kiểm tra điều kiện TRƯỚC → hoàn đúng các lô đã xuất → hủy phiếu thu TT tự động → ghi giảm công nợ.
- Phiếu chi trả NCC: outbox trong product-service → sales-service `/internal/cashflows` (retry tới khi thành công).
- Màn bán hàng (sale) offline: danh mục + khách lưu localStorage, tab hóa đơn lưu máy, hàng đợi hóa đơn; lỗi nghiệp vụ khi đồng bộ được GIỮ LẠI chờ xử lý.

## Done (đợt 1)
- [x] Khách hàng: danh sách + lọc, form 2 tab, chi tiết (Thông tin / Lịch sử bán / Nợ cần thu)
- [x] Công nợ: thanh toán (phân bổ HĐ), điều chỉnh, chiết khấu thanh toán
- [x] Hóa đơn: danh sách + lọc + dòng tổng, chi tiết, lịch sử thanh toán, sửa người bán/ngày/ghi chú, hủy
- [x] Sổ quỹ: tiền mặt/ngân hàng/ví/tổng; đầu kỳ, thu, chi, tồn; phiếu thu/chi tay; chi tiết + phân bổ
- [x] Màn bán hàng (sale): Bán nhanh / Bán thường, nhiều tab, F3/F4/F9, quét mã, khách + thêm khách, offline + đồng bộ
- [x] Test: InvoiceMath (4 unit), E2E 22 kịch bản + mô phỏng đồng bộ offline song song

## Đợt 2 (2026-10-28)
- [x] Trả hàng: hoàn đúng lô đã bán (invoice_line_lots), phí trả hàng, chi trả khách (PC+mã) / trừ công nợ, hủy phiếu trả
- [x] Chỉnh sửa hóa đơn → tab Update_HD trên màn bán hàng; kho SALE_REPLACE 1 transaction; revision chống sửa đè
- [x] QR VietQR (EMVCo/NAPAS, CRC kiểm bằng vector chuẩn) + quản lý tài khoản ngân hàng; QR ở màn bán hàng + công nợ khách
- [x] Sửa tỷ lệ thuế dòng hóa đơn (khóa khi đã phát hành HĐĐT); xem giá bán gần nhất; xem chi tiết hàng trong giỏ
- [x] E2E 18 kịch bản sửa/trả/QR; lỗi tìm ra: FK dòng phiếu trả đã hủy chặn sửa HĐ (đã sửa, kiểm chứng tự lành)
- [ ] Bán giao hàng + COD — CHỜ user xác nhận có giao vắc xin không
- [ ] Đổi hàng trong cùng 1 thao tác (hiện: trả hàng rồi bán hóa đơn mới)
- [ ] Mẫu in (chờ mẫu từ user)
- Quyết định: KHÔNG tạo khách khi offline (user chốt)
