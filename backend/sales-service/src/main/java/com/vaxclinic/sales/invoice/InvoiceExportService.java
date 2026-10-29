package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.invoice.InvoiceExportDtos.ExportResponse;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

/** "Xuất file" danh sách hóa đơn: toàn bộ hóa đơn khớp bộ lọc hiện tại (không phân trang), tối đa 5000 hóa đơn. */
@Service
public class InvoiceExportService {

    private final InvoiceQuery query;
    private final InvoiceExportRepository repository;

    public InvoiceExportService(InvoiceQuery query, InvoiceExportRepository repository) {
        this.query = query;
        this.repository = repository;
    }

    public ExportResponse export(InvoiceListParams params, boolean detail) {
        var list = query.search(params.toFilter(0, InvoiceExportDtos.MAX_INVOICES));
        if (list.total() > InvoiceExportDtos.MAX_INVOICES) {
            throw BusinessException.badRequest("EXPORT_TOO_LARGE", "Có " + list.total() + " hóa đơn, mỗi lần xuất file tối đa "
                    + InvoiceExportDtos.MAX_INVOICES + " hóa đơn — hãy thu hẹp thời gian hoặc bộ lọc");
        }
        if (!detail) {
            return new ExportResponse(list.items(), List.of(), List.of());
        }
        List<UUID> ids = list.items().stream().map(InvoiceDtos.InvoiceListItem::id).toList();
        return new ExportResponse(list.items(), repository.extras(ids), repository.lines(ids));
    }
}
