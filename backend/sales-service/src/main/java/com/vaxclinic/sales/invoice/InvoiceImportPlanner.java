package com.vaxclinic.sales.invoice;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.sales.channel.SalesChannels;
import com.vaxclinic.sales.common.Actor;
import com.vaxclinic.sales.common.SalesRules;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportError;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRequest;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRow;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.PlannedInvoice;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.PlannedLine;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Catalog;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Lot;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.PriceBook;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.User;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.UUID;
import java.util.function.Function;

import static com.vaxclinic.sales.invoice.InvoiceImportCells.blank;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.invalid;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.number;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.text;

/**
 * Kiểm tra toàn bộ file import TRƯỚC khi lưu (báo lỗi theo số dòng Excel, tiếng Việt): mã hóa đơn, thời gian, người bán
 * (tên đăng nhập / họ tên), kênh bán (tên), khách (mã → điện thoại → tạo mới khi có tên), bảng giá (tên), dòng hàng
 * ({@link InvoiceImportLinePlanner}), giảm giá hóa đơn, thanh toán Tiền mặt / Thẻ / Chuyển khoản.
 */
@Component
public class InvoiceImportPlanner {

    public record Plan(List<PlannedInvoice> invoices, List<ImportError> errors) {
    }

    private final InvoiceImportRepository repo;
    private final SalesChannels channels;
    private final SalesRules rules;

    public InvoiceImportPlanner(InvoiceImportRepository repo, SalesChannels channels, SalesRules rules) {
        this.repo = repo;
        this.channels = channels;
        this.rules = rules;
    }

    public Plan plan(ImportRequest req, Actor actor, Catalog catalog, Function<UUID, List<Lot>> lots, List<User> users) {
        var errors = new ArrayList<ImportError>();
        var groups = new LinkedHashMap<String, List<ImportRow>>();
        for (ImportRow r : req.rows()) {
            if (blank(r.code())) errors.add(new ImportError(r.line(), "Thiếu Mã hóa đơn"));
            else groups.computeIfAbsent(text(r.code()).toUpperCase(), k -> new ArrayList<>()).add(r);
        }
        var existing = repo.existingCodes(List.copyOf(groups.keySet()));
        var lines = new InvoiceImportLinePlanner(catalog, lots, req.branchId(), rules.settings().sales().allowNegativeStock());
        var out = new ArrayList<PlannedInvoice>();
        for (var g : groups.entrySet()) {
            ImportRow h = g.getValue().get(0);
            String code = text(h.code());
            UUID id = UUID.nameUUIDFromBytes((req.id() + ":" + g.getKey()).getBytes(StandardCharsets.UTF_8));
            UUID found = existing.get(g.getKey());
            if (found != null && found.equals(id)) { // đã import ở lần gửi trước (cùng id import)
                out.add(new PlannedInvoice(id, code, h.line(), null, null, null, null, null, null, null, null, List.of(),
                        null, null, null, null, null, true));
                continue;
            }
            int n = errors.size();
            if (found != null) err(errors, h, "Mã hóa đơn " + code + " đã tồn tại");
            if (code.length() > 30) err(errors, h, "Mã hóa đơn tối đa 30 ký tự");
            else if (!code.matches("[A-Za-z0-9_./-]+")) err(errors, h, "Mã hóa đơn chỉ gồm chữ không dấu, số và - _ . /");
            else if (code.toUpperCase().matches("HD\\d+")) err(errors, h, "Mã dạng HD + số dành cho hệ thống tự sinh, hãy dùng mã khác (VD: HDIP00001)");
            Instant soldAt = soldAt(h, req.branchId(), errors);
            User seller = seller(h, users, errors);
            String channel = channel(h, errors);
            PriceBook book = priceBook(h, catalog, errors);
            UUID customerId = null;
            ImportRow newCustomer = null;
            if (!blank(h.customerCode())) {
                customerId = repo.customerByCode(h.customerCode());
                if (customerId == null && blank(h.customerName())) err(errors, h, "Không tìm thấy khách hàng mã " + text(h.customerCode()));
            } else if (!blank(h.phone())) {
                String digits = text(h.phone()).replaceAll("\\D", "");
                customerId = digits.isEmpty() ? null : repo.customerByPhone(digits);
                if (customerId == null && blank(h.customerName())) err(errors, h, "Không tìm thấy khách hàng số điện thoại " + text(h.phone()));
            }
            if (customerId == null && !blank(h.customerName())) newCustomer = h;
            var planned = new ArrayList<PlannedLine>();
            for (ImportRow r : g.getValue()) {
                PlannedLine l = lines.plan(r, book, errors);
                if (l != null) planned.add(l);
            }
            BigDecimal subtotal = planned.stream().map(l -> InvoiceMath.money(l.quantity().multiply(l.price().subtract(l.discount()))))
                    .reduce(BigDecimal.ZERO, BigDecimal::add);
            BigDecimal discount = invoiceDiscount(h, subtotal, errors);
            BigDecimal cash = money(h, h.cash(), "Tiền mặt", errors);
            BigDecimal card = money(h, h.card(), "Thẻ", errors);
            BigDecimal transfer = money(h, h.transfer(), "Chuyển khoản", errors);
            if (errors.size() > n) continue;
            BigDecimal total = subtotal.subtract(discount);
            BigDecimal paid = cash.add(card).add(transfer);
            if (paid.compareTo(total) > 0) err(errors, h, "Tổng thanh toán " + Actor.money(paid) + " vượt quá khách cần trả " + Actor.money(total));
            else if (customerId == null && newCustomer == null && paid.compareTo(total) < 0) {
                err(errors, h, "Khách lẻ phải thanh toán đủ " + Actor.money(total) + " — nhập khách hàng để ghi nợ");
            }
            out.add(new PlannedInvoice(id, code, h.line(), soldAt, seller == null ? actor.id() : seller.id(),
                    seller == null ? actor.name() : seller.fullName(), channel, customerId, newCustomer,
                    book == null ? null : book.id(), book == null ? null : book.name(), planned, discount, cash, card, transfer,
                    blank(h.note()) ? null : text(h.note()), false));
        }
        return new Plan(out, errors);
    }

    private Instant soldAt(ImportRow h, UUID branchId, List<ImportError> errors) {
        if (blank(h.time())) return Instant.now();
        Instant t = InvoiceImportCells.dateTime(h.time());
        if (t == null) {
            err(errors, h, "Thời gian không đúng định dạng dd/MM/yyyy hoặc dd/MM/yyyy HH:mm");
            return null;
        }
        if (t.isAfter(Instant.now().plus(Duration.ofMinutes(5)))) err(errors, h, "Thời gian bán không được ở tương lai");
        try {
            rules.checkNotLocked(branchId, t);
        } catch (BusinessException e) {
            err(errors, h, e.getMessage());
        }
        return t;
    }

    private static User seller(ImportRow h, List<User> users, List<ImportError> errors) {
        if (blank(h.seller())) return null;
        String s = text(h.seller());
        var u = users.stream().filter(x -> s.equalsIgnoreCase(x.username())).findFirst()
                .or(() -> users.stream().filter(x -> s.equalsIgnoreCase(x.fullName())).findFirst()).orElse(null);
        if (u == null) err(errors, h, "Không tìm thấy người bán " + s + " (nhập tên đăng nhập hoặc họ tên người dùng đang hoạt động)");
        return u;
    }

    private String channel(ImportRow h, List<ImportError> errors) {
        if (blank(h.channel())) return SalesChannels.DIRECT;
        String s = text(h.channel());
        var c = channels.list(false).stream().filter(x -> s.equalsIgnoreCase(x.name()) || s.equalsIgnoreCase(x.code())).findFirst();
        if (c.isEmpty()) err(errors, h, "Không tìm thấy kênh bán " + s + " (hoặc kênh đã ngừng hoạt động)");
        return c.map(SalesChannels.Channel::code).orElse(null);
    }

    private static PriceBook priceBook(ImportRow h, Catalog catalog, List<ImportError> errors) {
        String s = text(h.priceBook());
        if (s.isEmpty() || s.equalsIgnoreCase("Bảng giá chung")) return null;
        var b = (catalog.priceBooks() == null ? List.<PriceBook>of() : catalog.priceBooks()).stream()
                .filter(x -> s.equalsIgnoreCase(text(x.name()))).findFirst().orElse(null);
        if (b == null) err(errors, h, "Không tìm thấy bảng giá " + s + " (hoặc bảng giá chưa / hết hiệu lực)");
        return b;
    }

    private static BigDecimal invoiceDiscount(ImportRow h, BigDecimal subtotal, List<ImportError> errors) {
        BigDecimal amount = number(h.invoiceDiscount());
        BigDecimal pct = number(h.invoiceDiscountPercent());
        if (pct != null && (invalid(pct) || pct.signum() < 0 || pct.compareTo(BigDecimal.valueOf(100)) > 0)) {
            err(errors, h, "Giảm giá hóa đơn % phải từ 0 đến 100");
            return BigDecimal.ZERO;
        }
        if (amount != null && (invalid(amount) || amount.signum() < 0)) {
            err(errors, h, "Giảm giá hóa đơn không hợp lệ");
            return BigDecimal.ZERO;
        }
        BigDecimal d = pct != null ? InvoiceMath.money(subtotal.multiply(pct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))
                : amount == null ? BigDecimal.ZERO : InvoiceMath.money(amount);
        if (d.compareTo(subtotal) > 0) err(errors, h, "Giảm giá hóa đơn lớn hơn tổng tiền hàng");
        return d.min(subtotal);
    }

    private static BigDecimal money(ImportRow h, String cell, String label, List<ImportError> errors) {
        BigDecimal v = number(cell);
        if (v == null) return BigDecimal.ZERO;
        if (invalid(v) || v.signum() < 0) {
            err(errors, h, label + " không hợp lệ");
            return BigDecimal.ZERO;
        }
        return InvoiceMath.money(v);
    }

    private static void err(List<ImportError> errors, ImportRow r, String message) {
        errors.add(new ImportError(r.line(), message));
    }
}
