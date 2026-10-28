-- Thanh toán tại quầy = 2 bước ở 2 dịch vụ: (1) trừ kho @product-service, (2) lưu hóa đơn @sales-service.
-- Bước 2 lỗi mà máy bán hàng không gửi lại → kho đã trừ nhưng không có hóa đơn. Bảng này ghi lại MỖI lần thanh toán
-- TRƯỚC khi trừ kho; lưu hóa đơn thành công đánh dấu DONE cùng transaction; job đối soát (5 phút) hoàn kho
-- (SALE_CANCEL) cho lần thanh toán PENDING quá 5 phút mà không có hóa đơn → COMPENSATED.
-- Trạng thái: PENDING (đang / chưa xong) | DONE | FAILED (kho từ chối, không trừ gì) | COMPENSATING | COMPENSATED.
CREATE TABLE checkout_attempts (
    id            UUID PRIMARY KEY,                 -- = id hóa đơn do máy bán hàng sinh
    stock_doc_id  UUID         NOT NULL,            -- chứng từ SALE hiện hành ở product-service
    round         INT          NOT NULL DEFAULT 1,  -- lần trừ kho thứ mấy (tăng sau mỗi lần bị hoàn kho)
    status        VARCHAR(20)  NOT NULL,
    branch_id     UUID         NOT NULL,
    doc_code      VARCHAR(30)  NOT NULL,            -- mã HĐ đã cấp cho lần thử gần nhất (ghi thẻ kho)
    partner_name  VARCHAR(200),
    user_id       UUID,
    payload_hash  VARCHAR(64)  NOT NULL,            -- SHA-256 nội dung yêu cầu (đối chiếu khi cần)
    summary       TEXT         NOT NULL,            -- tóm tắt cho người vận hành: mã, số dòng, tổng tiền, khách
    last_error    TEXT,
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX idx_checkout_attempts_open ON checkout_attempts (updated_at) WHERE status IN ('PENDING', 'COMPENSATING');
