package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportError;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.ImportRow;
import com.vaxclinic.sales.invoice.InvoiceImportDtos.PlannedLine;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Catalog;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Lot;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.PriceBook;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Product;
import com.vaxclinic.sales.invoice.InvoiceImportLookupClient.Unit;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;

import static com.vaxclinic.sales.invoice.InvoiceImportCells.blank;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.invalid;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.number;
import static com.vaxclinic.sales.invoice.InvoiceImportCells.text;

/**
 * Kiểm tra dòng hàng của file import (1 đối tượng cho cả file → cộng dồn số lượng theo lô / theo hàng giữa các hóa đơn):
 * mã hàng = mã đơn vị tính (hoặc mã vạch) đang bán trực tiếp; đơn giá trống → giá bảng giá / giá chung; hàng theo lô
 * bắt buộc Lô có tại chi nhánh, còn hạn, đủ tồn, Hạn sử dụng (nếu nhập) phải đúng hạn của lô.
 */
final class InvoiceImportLinePlanner {

    private record Item(Product product, Unit unit) {
    }

    private final Map<String, Item> byCode = new HashMap<>();
    private final Function<UUID, List<Lot>> lots;
    private final UUID branchId;
    private final boolean allowNegativeStock;
    private final Map<String, BigDecimal> lotUse = new HashMap<>();
    private final Map<UUID, BigDecimal> stockUse = new HashMap<>();

    InvoiceImportLinePlanner(Catalog catalog, Function<UUID, List<Lot>> lots, UUID branchId, boolean allowNegativeStock) {
        this.lots = lots;
        this.branchId = branchId;
        this.allowNegativeStock = allowNegativeStock;
        for (Product p : catalog.products()) {
            for (Unit u : p.units()) {
                if (!blank(u.barcode())) byCode.putIfAbsent(u.barcode().trim().toUpperCase(), new Item(p, u));
            }
        }
        for (Product p : catalog.products()) { // mã hàng ưu tiên hơn mã vạch trùng
            for (Unit u : p.units()) byCode.put(u.code().trim().toUpperCase(), new Item(p, u));
        }
    }

    /** null = dòng lỗi (đã ghi vào errors). */
    PlannedLine plan(ImportRow r, PriceBook book, List<ImportError> errors) {
        int n = errors.size();
        String code = text(r.productCode());
        Item item = code.isEmpty() ? null : byCode.get(code.toUpperCase());
        if (code.isEmpty()) err(errors, r, "Thiếu Mã hàng");
        else if (item == null) err(errors, r, "Không tìm thấy hàng hóa mã " + code + " (hoặc hàng ngừng kinh doanh / không bán trực tiếp)");
        BigDecimal qty = number(r.quantity());
        if (qty == null || invalid(qty) || qty.signum() <= 0) err(errors, r, "Số lượng phải là số lớn hơn 0");
        BigDecimal price = number(r.price());
        if (price != null && (invalid(price) || price.signum() < 0)) err(errors, r, "Đơn giá không hợp lệ");
        BigDecimal pct = number(r.discountPercent());
        BigDecimal disc = number(r.discount());
        if (pct != null && (invalid(pct) || pct.signum() < 0 || pct.compareTo(BigDecimal.valueOf(100)) > 0)) {
            err(errors, r, "Giảm giá % phải từ 0 đến 100");
        }
        if (disc != null && (invalid(disc) || disc.signum() < 0)) err(errors, r, "Giảm giá không hợp lệ");
        if (errors.size() > n) return null;

        if (price == null) {
            BigDecimal bookPrice = book == null || book.prices() == null ? null : book.prices().get(item.unit().id());
            price = bookPrice != null ? bookPrice : item.unit().price();
        }
        price = InvoiceMath.money(price);
        BigDecimal discount = pct != null ? InvoiceMath.money(price.multiply(pct).divide(BigDecimal.valueOf(100), 4, RoundingMode.HALF_UP))
                : disc == null ? BigDecimal.ZERO : InvoiceMath.money(disc);
        if (discount.compareTo(price) > 0) {
            err(errors, r, "Giảm giá lớn hơn đơn giá");
            return null;
        }
        BigDecimal base = qty.multiply(item.unit().conversionRate());
        String lot = item.product().lotManaged() ? checkLot(r, item, base, errors) : null;
        if (!item.product().lotManaged()) checkStock(r, item, base, errors);
        if (errors.size() > n) return null;
        return new PlannedLine(r.line(), item.product(), item.unit(), qty, price, discount, lot);
    }

    private String checkLot(ImportRow r, Item item, BigDecimal base, List<ImportError> errors) {
        String lotNo = text(r.lot());
        String name = item.product().name();
        if (lotNo.isEmpty()) {
            err(errors, r, name + ": hàng quản lý theo lô, cần nhập Lô");
            return null;
        }
        Lot lot = lots.apply(item.product().id()).stream()
                .filter(l -> branchId.equals(l.branchId()) && lotNo.equalsIgnoreCase(l.lotNumber())).findFirst().orElse(null);
        if (lot == null) {
            err(errors, r, name + ": không có lô " + lotNo + " tại chi nhánh");
            return null;
        }
        if (!blank(r.expiry())) {
            LocalDate exp = InvoiceImportCells.date(r.expiry());
            if (exp == null) err(errors, r, "Hạn sử dụng không đúng định dạng dd/MM/yyyy");
            else if (!exp.equals(lot.expiryDate())) err(errors, r, name + ": hạn sử dụng của lô " + lotNo + " là " + vn(lot.expiryDate()));
        }
        if (lot.expiryDate().isBefore(LocalDate.now(InvoiceImportCells.VN))) {
            err(errors, r, name + ": lô " + lotNo + " đã hết hạn sử dụng (" + vn(lot.expiryDate()) + ")");
        }
        BigDecimal used = lotUse.merge(item.product().id() + "|" + lot.lotNumber(), base, BigDecimal::add);
        if (used.compareTo(lot.quantity()) > 0) {
            err(errors, r, name + ": lô " + lotNo + " không đủ tồn (còn " + plain(lot.quantity()) + ", file cần " + plain(used) + ")");
        }
        return lot.lotNumber();
    }

    private void checkStock(ImportRow r, Item item, BigDecimal base, List<ImportError> errors) {
        BigDecimal used = stockUse.merge(item.product().id(), base, BigDecimal::add);
        BigDecimal stock = item.product().stock() == null ? BigDecimal.ZERO : item.product().stock();
        if (!allowNegativeStock && used.compareTo(stock) > 0) {
            err(errors, r, item.product().name() + ": không đủ tồn kho (còn " + plain(stock) + ", file cần " + plain(used) + ")");
        }
    }

    private static void err(List<ImportError> errors, ImportRow r, String message) {
        errors.add(new ImportError(r.line(), message));
    }

    private static String plain(BigDecimal v) {
        return v.stripTrailingZeros().toPlainString();
    }

    private static String vn(LocalDate d) {
        return "%02d/%02d/%d".formatted(d.getDayOfMonth(), d.getMonthValue(), d.getYear());
    }
}
