package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InternalInvoiceService.Buyer;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

/** Người mua HĐĐT: thông tin nhập trên hóa đơn ưu tiên từng trường, trống thì theo hồ sơ khách. */
class InternalInvoiceBuyerTest {

    private static final Buyer PROFILE = new Buyer("KH000001", "Nguyễn Văn A", "Công ty A", "0101", "Hà Nội", "a@x.vn", "0900", "0011");

    @Test
    void noInvoiceBuyerKeepsProfile() {
        assertSame(PROFILE, InternalInvoiceService.withInvoiceBuyer(PROFILE, null));
    }

    @Test
    void invoiceFieldsOverrideFieldByField() {
        var b = new InvoiceDtos.EInvoiceBuyer("Trần Thị B", null, "0202", "  ", null, "0911");
        assertEquals(new Buyer("KH000001", "Trần Thị B", "Công ty A", "0202", "Hà Nội", "a@x.vn", "0911", "0011"),
                InternalInvoiceService.withInvoiceBuyer(PROFILE, b));
    }

    @Test
    void walkInUsesInvoiceBuyer() {
        var walkIn = new Buyer(null, "Khách lẻ", null, null, null, null, null, null);
        var b = new InvoiceDtos.EInvoiceBuyer(null, "Công ty C", "0303", "Vĩnh Phúc", "c@x.vn", null);
        assertEquals(new Buyer(null, "Khách lẻ", "Công ty C", "0303", "Vĩnh Phúc", "c@x.vn", null, null),
                InternalInvoiceService.withInvoiceBuyer(walkIn, b));
    }
}
