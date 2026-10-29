package com.vaxclinic.sales.invoice;

import com.vaxclinic.sales.invoice.InvoiceDtos.LineInput;
import com.vaxclinic.sales.invoice.InvoiceTaxReduction.Plan;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.ProductTax;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.Sector;
import com.vaxclinic.sales.invoice.TaxReductionLookupClient.TaxSettings;
import org.springframework.stereotype.Service;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;

/**
 * Xác định dòng được "Giảm thuế" bằng dữ liệu server tự tra — bỏ qua mọi cờ máy bán hàng gửi lên:
 * cờ "Áp dụng giảm thuế" + mã thuế suất của hàng (product-service), phương pháp tính thuế + ngành nghề (thiết lập thuế).
 * Khấu trừ: chỉ hàng có cờ và thuế suất VAT10. Trực tiếp: hàng có cờ, tỷ lệ % GTGT theo ngành của nhóm hàng
 * (nhóm con chưa gắn ngành → nhóm cha → ngành mặc định); tỷ lệ 0 thì không giảm.
 */
@Service
public class TaxReductionPlanner {

    private final TaxReductionLookupClient lookup;

    public TaxReductionPlanner(TaxReductionLookupClient lookup) {
        this.lookup = lookup;
    }

    /** requested: người bán bật "Giảm thuế"; soldAt: ngày bán (ngoài thời gian áp dụng → không giảm). */
    public Plan plan(List<LineInput> lines, boolean requested, Instant soldAt) {
        if (!requested || !InvoiceTaxReduction.inWindow(soldAt) || lines.isEmpty()) {
            return Plan.none(lines.size());
        }
        Map<UUID, ProductTax> products = lookup.products(lines.stream().map(LineInput::productId).distinct().toList()).stream()
                .collect(Collectors.toMap(ProductTax::productId, Function.identity(), (a, b) -> a));
        TaxSettings settings = lookup.settings();
        boolean direct = settings != null && InvoiceTaxReduction.DIRECT.equals(settings.vatMethod());
        var eligible = new ArrayList<Boolean>();
        var rates = new ArrayList<BigDecimal>();
        for (LineInput l : lines) {
            ProductTax p = products.get(l.productId());
            boolean flagged = p != null && p.taxReduction();
            BigDecimal rate = direct && flagged ? sectorRate(p, settings) : null;
            eligible.add(direct ? flagged && rate != null && rate.signum() > 0 : flagged && "VAT10".equals(p.taxCode()));
            rates.add(rate);
        }
        return new Plan(direct ? InvoiceTaxReduction.DIRECT : InvoiceTaxReduction.DEDUCTION, eligible, rates);
    }

    /** Tỷ lệ % GTGT của ngành: nhóm hàng gần nhất đã gắn ngành, không có thì ngành mặc định. */
    static BigDecimal sectorRate(ProductTax p, TaxSettings s) {
        Map<UUID, String> map = s.categorySectors() == null ? Map.of() : s.categorySectors();
        String code = p.categoryPath() == null ? null : p.categoryPath().stream().map(map::get).filter(c -> c != null).findFirst().orElse(null);
        String sector = code != null ? code : s.defaultSector();
        return s.sectors() == null ? null : s.sectors().stream().filter(x -> x.code().equals(sector)).map(Sector::vatRate)
                .findFirst().orElse(null);
    }
}
