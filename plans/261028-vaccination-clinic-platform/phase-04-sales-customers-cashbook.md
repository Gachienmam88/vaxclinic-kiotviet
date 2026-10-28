# Phase 04 — Bán hàng, khách hàng, hóa đơn, sổ quỹ, công nợ (sales-service :8086)

Priority: P0 | Status: in progress — đợt 1 xong 2026-10-28

## Quyết định
- sales-service mới (sales_db). Bán hàng gọi product-service `/internal/stock-docs` (JWT nội bộ, gateway không route /internal).
- Idempotent 2 lớp: id hóa đơn do máy POS sinh + kho chống trùng theo (docId, docType) → đồng bộ offline gửi lại an toàn.
- Hàng theo lô: tự phân bổ FEFO trên lô CÒN HẠN; thiếu → chặn bán (không bán vắc xin hết hạn). Khóa dòng tồn trước khi đọc lô.
- Hủy hóa đơn: kiểm tra điều kiện TRƯỚC → hoàn đúng các lô đã xuất → hủy phiếu thu TT tự động → ghi giảm công nợ.
- Phiếu chi trả NCC: outbox trong product-service → sales-service `/internal/cashflows` (retry tới khi thành công).
- POS offline: danh mục + khách lưu localStorage, tab hóa đơn lưu máy, hàng đợi hóa đơn; lỗi nghiệp vụ khi đồng bộ được GIỮ LẠI chờ xử lý.

## Done (đợt 1)
- [x] Khách hàng: danh sách + lọc, form 2 tab, chi tiết (Thông tin / Lịch sử bán / Nợ cần thu)
- [x] Công nợ: thanh toán (phân bổ HĐ), điều chỉnh, chiết khấu thanh toán
- [x] Hóa đơn: danh sách + lọc + dòng tổng, chi tiết, lịch sử thanh toán, sửa người bán/ngày/ghi chú, hủy
- [x] Sổ quỹ: tiền mặt/ngân hàng/ví/tổng; đầu kỳ, thu, chi, tồn; phiếu thu/chi tay; chi tiết + phân bổ
- [x] POS: Bán nhanh / Bán thường, nhiều tab, F3/F4/F9, quét mã, khách + thêm khách, offline + đồng bộ
- [x] Test: InvoiceMath (4 unit), E2E 22 kịch bản + mô phỏng đồng bộ offline song song

## Đợt 2
- [ ] Bán giao hàng + COD + đối tác giao hàng, địa chỉ nhận hàng
- [ ] Trả hàng / đổi hàng; "Chỉnh sửa" hóa đơn → về màn bán hàng
- [ ] Mẫu in (K80/A4), xem trước HĐĐT, QR VietQR, sửa tỷ lệ thuế hàng hóa
- [ ] Xem giá bán gần nhất, xem chi tiết hàng trong giỏ; tạo khách khi offline
