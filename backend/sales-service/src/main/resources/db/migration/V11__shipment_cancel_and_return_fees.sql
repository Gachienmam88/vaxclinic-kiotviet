-- Hủy vận đơn không hủy hóa đơn: 1 hóa đơn có thể có nhiều vận đơn, nhưng chỉ 1 vận đơn chưa hủy tại một thời điểm.
DO $$
DECLARE c TEXT;
BEGIN
    FOR c IN SELECT con.conname FROM pg_constraint con
             JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
             WHERE con.conrelid = 'shipments'::regclass AND con.contype = 'u' AND a.attname = 'invoice_id'
                   AND array_length(con.conkey, 1) = 1
    LOOP
        EXECUTE format('ALTER TABLE shipments DROP CONSTRAINT %I', c);
    END LOOP;
END $$;
CREATE UNIQUE INDEX ux_shipments_active_invoice ON shipments (invoice_id) WHERE status <> 'CANCELLED';
CREATE INDEX idx_shipments_invoice ON shipments (invoice_id);

-- Đã chuyển hoàn: phí chuyển hoàn cửa hàng chịu (ngoài phí giao hàng); fee_posted = phí giao hàng + phí chuyển hoàn đã ghi sổ đối tác.
ALTER TABLE shipments ADD COLUMN return_fee NUMERIC(18, 0) NOT NULL DEFAULT 0 CHECK (return_fee >= 0);
