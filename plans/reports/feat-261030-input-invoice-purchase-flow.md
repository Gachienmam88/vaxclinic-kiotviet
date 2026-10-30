# Hóa đơn đầu vào → Phiếu nhập hàng / phiếu chi + Trả hàng nhập (KiotViet parity) — 30/10/2026

Ảnh tham chiếu 282–310 (KiotViet, Chrome 67%). Doc: `docs/business-logic.md` §1.5, §1.9, §1.10, §1.12, §5.4, §5.7.

## Backend
**product-service** (migration `V12__purchase_line_vat_and_draft_payment.sql`)
- VAT theo dòng: `purchase_receipt_lines.vat_rate/note`, `purchase_receipts.vat_mode (LINE|MANUAL)`, `payment_posted`; như vậy cho phiếu trả (`purchase_return_lines.vat_rate/note`, `purchase_returns.vat_mode/payment_method`). Phiếu cũ: dòng nhận mức VAT của phiếu → số liệu không đổi. Client không gửi `vatMode` → hành vi cũ (1 mức).
- `PurchaseMath`: VAT LINE = Σ round(dòng × keep × VAT% dòng); MANUAL = số nhập tay. **Giá vốn vẫn GỒM VAT** (quy tắc cũ, HKD không khấu trừ): tỷ lệ VAT dòng, hoặc VAT tay / (tiền hàng − giảm giá) chia đều.
- Lưu tạm + `payNow` → lập ngay `PC{PN}` (Sổ quỹ outbox + chứng từ công nợ), kho không đổi; Hoàn thành không lập lần 2; hủy phiếu tạm → hủy phiếu chi; tiền trả khóa sau khi lập.
- `PUT /api/purchase-receipts/{id}/adjust` (`PurchaseReceiptAdjustService`): sửa phiếu ĐÃ NHẬP (NCC, giảm giá, VAT, ghi chú, người / ngày nhập, SL / giá / giảm / VAT dòng). Thẻ kho mới `PURCHASE_ADJUST` (+mới theo giá mới, −cũ theo giá cũ, theo ngày phiếu) → giá vốn bình quân đúng; công nợ tự theo `total`; đổi NCC chuyển `PC{PN}` + giải phóng phân bổ NCC cũ; Sổ quỹ chỉ đổi ngày / người nhận (sales-service `inbound UPDATE` nhận `partner*`). Chặn: còn phiếu trả, thêm / bớt dòng, tổng < đã trả, khóa sổ 2 ngày, chi nhánh.
- `GET /{id}/returnable`, `ReceiptResponse.returns[]`, danh sách trả hàng thêm `receiptId/createdByName/branchId/note/supplierCode`; phiếu thu NCC hoàn tiền theo hình thức (TRANSFER → quỹ NH).
**integration-service** (migration `V4__input_invoice_links_mappings_sync_logs.sql`)
- `link_type/link_id/link_code` (RECEIPT | SUPPLIER_PAYMENT | CASH_VOUCHER), PATCH `/link` (409 nếu đã gắn chứng từ khác), DELETE `/links/{docId}`; giữ `/receipt` + `receiptId/receiptCode` cho client cũ.
- Ánh xạ hàng đã nhớ (`input_invoice_item_mappings`), lịch sử đồng bộ (`input_invoice_sync_logs`, ghi mọi lần đồng bộ kèm người chạy; lỗi lạ → 502 `GDT_SYNC_FAILED`), `/sellers`, `/export`, lọc `sellerTaxCode`/`natures`.
- Parser đọc thêm trường hiển thị (`details` JSON) + `totalInWords`. **Không đổi đường dẫn cổng GDT.**

## Frontend
- Màn Hóa đơn đầu vào (fork thực hiện, namespace i18n mới `input-invoices`): tab, lọc, cột, "Lập phiếu ▾" 5 loại, 👁 chi tiết HĐĐT (in qua `printHtml` + `sanitizeHtml`), popup đồng bộ 2 bước + lịch sử, xuất xlsx mọi dòng, xác nhận dữ liệu + ánh xạ.
- Màn nhập hàng / trả hàng nhập viết lại theo ảnh: cột VAT (%) / giá có VAT / ghi chú dòng, thanh công cụ (VAT dòng ↔ tay, cài đặt in tự động + số liên, tùy chọn hiển thị, phím tắt), cột phải KiotViet, hỏi lưu phiếu chi, sửa phiếu đã nhập (chỉ Lưu), "Sửa nhà cung cấp" tab Thông tin / Dư nợ, trả theo phiếu "0 / N".
- Chi tiết phiếu nhập: chân Hủy · Sao chép · Xuất file | Mở phiếu · Lưu · Trả hàng nhập · In tem mã · In · "…", nhãn "VAT x%" / "VAT", danh sách phiếu trả; hủy → bỏ liên kết hóa đơn.
- Danh sách trả hàng nhập: checkbox, chọn cột (Mã phiếu nhập, Người tạo, Chi nhánh, Ghi chú), chi tiết tab Thông tin / Lịch sử thanh toán, Sao chép, Xuất file.

## Kiểm thử
- `mvn package` product-service (PurchaseMathTest +4 ca, gồm ca ảnh 309), integration-service (parser test), sales-service; `tsc --noEmit` sạch; `next build` OK; :3010 khởi động lại.
- E2E mới `scratchpad/e2e_input_invoice_flow.py`: 27/27 (A–J: XML, chi tiết, lọc / xuất, khớp MST, ánh xạ, VAT dòng, link + 409, Lưu tạm không / có phiếu chi, Hoàn thành không trùng phiếu chi, sửa phiếu đã nhập + 2 NCC + Sổ quỹ, PCN + "Chi mua dịch vụ", lịch sử đồng bộ, trả hàng ảnh 309: tạm / NCC trả 0 / trả 100k / vượt / hủy / phiếu nhập hủy, hủy phiếu tạm có phiếu chi). Dọn sạch mọi dòng.
- Hồi quy: xem mục "Kết quả hồi quy" cuối file.

## Không làm (Not built)
- Tùy chọn hiển thị tab Khác: Thêm dòng, Chọn nhiều hàng hóa, Giá nhập là giá vốn, Xem hàng cùng loại, Tự động điền SL theo phiếu đặt. Phím F2, F6, F10, Home.
- Menu "Mua dịch vụ" (KiotViet cột 3): phiếu mua dịch vụ là phiếu chi Sổ quỹ, không có trang riêng → không thêm.
- "Mã đặt hàng nhập", Trạng thái CSDL về dược, ☆ đánh dấu, "Lưu" thông tin phiếu trả (không có API sửa thông tin phiếu trả).
- Sửa phiếu đã nhập: không thêm / bớt dòng, không đổi lô / ĐVT; phiếu đã có phiếu trả không sửa được.
- Phiếu mua dịch vụ không vào công nợ NCC (Sổ quỹ chặn phiếu tay đối tượng SUPPLIER — giữ quy tắc đó; ghi đối tượng OTHER "NCC - MST", hạch toán chi phí).
- Hủy phiếu chi PCN / phiếu chi Sổ quỹ không tự bỏ "Đã lập phiếu" (chỉ hủy phiếu nhập ở FE gọi bỏ liên kết).
- Chưa kiểm chứng với tài khoản cổng GDT thật (đường dẫn + tên trường chi tiết vẫn là dự đoán).

## Ghi chú quy trình
- Hook auto-commit của máy (`~/.claude/settings.json`) đã tự commit hầu hết file sửa bằng Write/Edit thành ~60 commit "auto: update …" (không conventional, không gộp doc cùng thay đổi). Không viết lại lịch sử; phần còn lại commit theo conventional. Chưa push.

## Câu hỏi mở
- Gắn "Đã lập phiếu" ngay lúc Lưu tạm (đang làm vậy để chặn lập 2 phiếu) hay chỉ khi Hoàn thành như KiotViet?
- Trả hàng theo phiếu nhập VAT nhập tay: dòng trả nên lấy VAT% nào?
- Có muốn bỏ liên kết hóa đơn khi hủy phiếu chi PCN / phiếu chi Sổ quỹ (cần sự kiện từ product / sales sang integration)?
- Gộp ~60 commit "auto: update" thành vài commit conventional (cần đồng ý vì viết lại lịch sử)?

## Kết quả hồi quy (30/10 13:10–13:35)
- e2e_input_invoice_flow 27/27, e2e_purchasing 21/21, e2e_suppliers 59/59, e2e_integration 16/16, e2e_inventory_docs 50/50, e2e_audit_backdate 5/5, e2e_audit_purchase_refund 5/5.
- Duyệt màn hình bằng Playwright trên :3010 (`scratchpad/shot_input_invoice_flow.py`, ảnh `scratchpad/shots_ii/01–27`): danh sách HĐ, menu Lập phiếu, xác nhận (chưa / đã ánh xạ, lỗi), màn nhập hàng + 3 popover, hỏi phiếu chi, phiếu tạm, mở lại phiếu tạm đã trả, hoàn thành, sửa phiếu đã nhập + Sửa NCC (Thông tin / Dư nợ), trả hàng nhập "1 / 20" (VAT hoàn lại 9,759, cần trả 204,939, công nợ −204,939), chi tiết trả hàng, "Đã lập phiếu ↗", chi tiết HĐĐT, popup đồng bộ + lịch sử, danh sách trả hàng. Không lỗi JS. Dữ liệu tạm đã dọn.
- Sửa phát hiện khi duyệt: `api()` lỗi với endpoint void trả 200 thân rỗng (PUT ánh xạ, PATCH gắn phiếu) → client coi thân rỗng là không có nội dung; cột Tên hàng màn nhập hàng bị ép hẹp → nới bảng.
- Phiên admin chưa đồng ý "Điều khoản sử dụng" → khi chụp chỉ gỡ lớp phủ trên trình duyệt headless (không ghi nhận đồng ý). Cần người dùng tự đồng ý.
- Demo còn nguyên: SP000001–010 + SP000020, NCC000001–3/5, PN000001–3, 35 hóa đơn bán (đề bài ghi 31 — số hiện có trước khi chạy). `e2e_purchasing` (sẵn có) để lại 2 hàng "(test nhập)" mỗi lần chạy — hành vi cũ của script, không xóa.

## Bổ sung sau trả lời câu hỏi mở (30/10)
- (1) Giữ gắn "Đã lập phiếu" từ lúc Lưu tạm — không đổi.
- (2) Trả hàng theo phiếu nhập VAT nhập tay: `/returnable` trả `defaultVatRate` = mức gần nhất 0/5/8/10% với VAT ÷ (tiền hàng − giảm giá); VAT tay 0 → KCT; phiếu VAT theo dòng → VAT% dòng. FE dùng làm mặc định. E2E I0, I8.
- (3) Hủy phiếu nhập / phiếu chi NCC (PCN) / phiếu chi Sổ quỹ lập từ hóa đơn → gọi integration `DELETE /internal/input-invoices/links/{docId}` sau commit (best-effort) → hóa đơn về "Chưa lập phiếu", lập lại được. E2E G2, G3.
- `e2e_purchasing.py` gắn tag vào tên hàng / NCC / nhóm NCC và xóa hẳn dữ liệu của lượt chạy khi kết thúc (phiếu, chứng từ công nợ, phiếu Sổ quỹ, thẻ kho, hàng, NCC). Dữ liệu sót của các lượt chạy TRƯỚC (hàng "(test nhập)", NCC "NGỌC BÍCH" NCC000052 / NCC000063) không tự xóa.
- Hồi quy: input_invoice_flow 29/29, purchasing 21/21 (còn 0 hàng test), suppliers 59/59, integration 16/16, inventory_docs 50/50, audit_backdate 5/5, audit_purchase_refund 5/5.
