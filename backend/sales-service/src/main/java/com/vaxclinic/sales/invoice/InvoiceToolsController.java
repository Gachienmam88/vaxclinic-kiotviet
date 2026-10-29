package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.invoice.InvoiceExportDtos.ExportResponse;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRequest;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportResult;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.CandidatesResponse;
import com.vaxclinic.sales.invoice.InvoiceMergeDtos.MergeRequest;
import jakarta.validation.Valid;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.ModelAttribute;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/** Công cụ của danh sách Hóa đơn: Xuất file (tổng quan / chi tiết), Import file, Gộp đơn. */
@RestController
@RequestMapping("/api/invoices")
public class InvoiceToolsController {

    private final InvoiceExportService exports;
    private final InvoiceImportService imports;
    private final InvoiceMergeService merges;

    public InvoiceToolsController(InvoiceExportService exports, InvoiceImportService imports, InvoiceMergeService merges) {
        this.exports = exports;
        this.imports = imports;
        this.merges = merges;
    }

    /** Mọi hóa đơn khớp bộ lọc (tối đa 5000); detail = true kèm thanh toán / giao hàng / dòng hàng. */
    @GetMapping("/export")
    @PreAuthorize("hasAuthority('sales.perform') or hasAuthority('report.view')")
    public ExportResponse export(@ModelAttribute InvoiceListParams params, @RequestParam(defaultValue = "false") boolean detail) {
        return exports.export(params, detail);
    }

    @PostMapping("/import")
    @PreAuthorize("hasAuthority('sales.perform')")
    public ImportResult importFile(@Valid @RequestBody ImportRequest req, @AuthenticationPrincipal Jwt jwt) {
        return imports.importRows(req, Actor.of(jwt), jwt.getTokenValue());
    }

    @GetMapping("/merge-candidates")
    @PreAuthorize("hasAuthority('sales.perform')")
    public CandidatesResponse mergeCandidates(@RequestParam UUID branchId, @AuthenticationPrincipal Jwt jwt) {
        return merges.candidates(branchId, Actor.of(jwt));
    }

    /** Gộp hóa đơn — hóa đơn gốc bị hủy nên cần thêm quyền hủy hóa đơn. */
    @PostMapping("/merge")
    @PreAuthorize("hasAuthority('sales.perform') and hasAuthority('sales.cancel')")
    public InvoiceDtos.InvoiceResponse merge(@Valid @RequestBody MergeRequest req, @AuthenticationPrincipal Jwt jwt) {
        return merges.merge(req, Actor.of(jwt));
    }
}
