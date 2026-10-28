# Phase 05 — Tích hợp thuế (integration-service :8088)

Priority: P0 | Status: code xong 2026-10-28, CHỜ chạy thử với tài khoản thật

## Quyết định (user chốt)
- Hóa đơn đầu vào: kết nối cổng hoadondientu.gdt.gov.vn bằng MST. Captcha người dùng tự nhập (không tự giải).
  Dự phòng: nhập file XML chuẩn TCT (luôn dùng được khi cổng đổi API).
- Hóa đơn điện tử bán ra: MISA meInvoice, loại khởi tạo từ máy tính tiền (không USB Token).
- Mật khẩu cổng thuế / MISA mã hóa AES-256-GCM (ENCRYPTION_KEY), không bao giờ trả ra API.

## Đã kiểm chứng
- MISA token endpoint `/api/v3/auth/token` trên testapi.meinvoice.vn: trả đúng `InvalidAppID` với AppID sai.
- Payload MISA: unit test số liệu HĐ HD015313 (390,000; "Ba trăm chín mươi nghìn đồng chẵn."), VAT tách ngược, giảm giá phân bổ khớp từng đồng.
- XML parser chặn XXE; nhập lại không trùng. E2E 16/16.

## CHƯA kiểm chứng (cần tài khoản thật của khách)
- [ ] Đường dẫn API nội bộ cổng thuế (/captcha, /security-taxpayer/authenticate, /query|/sco-query/invoices/purchase, /detail)
      — không truy cập được cổng từ máy dev. Chạy thử trên server đặt tại Việt Nam.
- [ ] MISA phát hành thật: cần AppID do MISA cấp; kiểm tra VATRateName cho hộ kinh doanh ("KCT") trên môi trường test.

## Chưa làm
- [ ] Xem trước / tải PDF hóa đơn điện tử (API publishview của MISA)
- [ ] Hủy / thay thế / điều chỉnh hóa đơn điện tử đã phát hành
- [ ] Tự phát hành ngay khi thanh toán (hiện bấm tay trong chi tiết hóa đơn)
