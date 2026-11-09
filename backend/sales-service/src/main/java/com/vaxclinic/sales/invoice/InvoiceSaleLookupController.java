package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceSaleLookupQuery.LastPrice;
import com.vaxclinic.sales.invoice.InvoiceSaleLookupQuery.ReturnableFilter;
import com.vaxclinic.sales.invoice.InvoiceSaleLookupQuery.ReturnablePage;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

/**
 * Tra cứu hóa đơn cho màn bán hàng: giá bán gần nhất cho khách theo từng hàng / đơn vị, và
 * "Chọn hóa đơn trả hàng" (chỉ hóa đơn hoàn thành).
 */
@RestController
@PreAuthorize("hasAuthority('sales.perform')")
public class InvoiceSaleLookupController {

    private final InvoiceSaleLookupQuery query;

    public InvoiceSaleLookupController(InvoiceSaleLookupQuery query) {
        this.query = query;
    }

    /** Lần bán gần nhất (hóa đơn hoàn thành) cho khách của mỗi (hàng, đơn vị); price = đơn giá − giảm giá dòng. */
    @GetMapping("/api/invoices/last-prices")
    public List<LastPrice> lastPrices(@RequestParam UUID customerId, @RequestParam(required = false) List<UUID> productIds) {
        return query.lastPrices(customerId, productIds);
    }

    /** "Chọn hóa đơn trả hàng": lọc theo mã HĐ / mã vận đơn / lô / khách / hàng / thời gian / chi nhánh; mặc định 7 dòng. */
    @GetMapping("/api/invoices/returnable")
    public ReturnablePage returnable(@RequestParam(required = false) String code,
                                          @RequestParam(required = false) String shipmentCode,
                                          @RequestParam(required = false) String lot,
                                          @RequestParam(required = false) String customer,
                                          @RequestParam(required = false) String productCode,
                                          @RequestParam(required = false) String productName,
                                          @RequestParam(required = false) Instant from, @RequestParam(required = false) Instant to,
                                          @RequestParam(required = false) UUID branchId,
                                          @RequestParam(defaultValue = "desc") String sort,
                                          @RequestParam(defaultValue = "0") int page, @RequestParam(defaultValue = "7") int size) {
        return query.returnable(new ReturnableFilter(code, shipmentCode, lot, customer, productCode, productName, from, to,
                branchId, sort, page, size));
    }
}
