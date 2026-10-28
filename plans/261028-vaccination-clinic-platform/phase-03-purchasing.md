# Phase 03 — Mua hàng (trong product-service)

Priority: P0 | Status: in progress (core done 2026-10-28)

## Quyết định
- Mua hàng nằm trong `product-service`: "Hoàn thành" phiếu = cộng kho + giá vốn + thẻ kho trong 1 transaction.
- Giá vốn tính theo giá ĐÃ GỒM VAT (đơn vị không khấu trừ VAT đầu vào) — khớp số liệu KiotViet của khách (Shingrix).
- VAT 1 mức / phiếu, làm tròn TỪNG DÒNG rồi cộng (khớp phiếu PN000103: 450,642). Giảm giá phiếu phân bổ theo tỷ lệ.
- Hàng theo lô: mỗi dòng phiếu nhập = 1 lô (số lô + HSD bắt buộc khi hoàn thành).
- Hủy phiếu nhập đã hoàn thành = trừ lại kho + tính lại giá vốn; bị chặn nếu phiếu đã có trả hàng nhập.
- Trả hàng nhập theo phiếu: không trả vượt số đã nhập (theo hàng + lô, cộng dồn các lần trả).

## Done
- [x] Nhà cung cấp: danh sách, tạo/sửa (địa chỉ, nhóm, ghi chú, thông tin xuất hóa đơn), mã NCC tự sinh
- [x] Phiếu nhập: lưu tạm / hoàn thành / hủy / sao chép / mở phiếu tạm / sửa thông tin phiếu đã nhập
- [x] Danh sách nhập hàng: lọc trạng thái, thời gian, người tạo, người nhập, số HĐ đầu vào; dòng tổng; chi tiết mở dưới dòng
- [x] Trả hàng nhập: theo phiếu nhập hoặc trả nhanh, chọn lô đang tồn; hủy → nhập lại kho
- [x] Unit test PurchaseMath (5) + E2E 21 kịch bản
- [x] Màn Nhà cung cấp kiểu KiotViet (2026-10-28): nhóm NCC, lọc tổng mua/nợ/trạng thái, ngừng hoạt động/xóa, import CSV/XLSX; sổ công nợ NCC (thanh toán → phiếu chi Sổ quỹ, phân bổ vào phiếu nhập, chiết khấu thanh toán, điều chỉnh) — xem `plans/reports/implementer-261028-suppliers-screen.md`

## Chưa làm
- [ ] Hóa đơn đầu vào (kết nối cơ quan thuế) — chờ user chốt cách A/B/C
- [ ] Đặt hàng nhập (PO)
- [ ] Xuất file Excel, in phiếu, in tem mã, import dòng hàng từ Excel
- [ ] Trạng thái CSDL về dược (liên thông cơ sở dữ liệu dược quốc gia)
- [ ] Danh mục Tỉnh/Phường-Xã chuẩn (đang nhập tay)
