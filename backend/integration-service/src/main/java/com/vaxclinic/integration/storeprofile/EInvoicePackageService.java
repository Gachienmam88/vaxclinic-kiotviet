package com.vaxclinic.integration.storeprofile;

import com.vaxclinic.common.error.BusinessException;
import com.vaxclinic.common.settings.ShopSettings;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Pkg;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.PkgUsage;
import com.vaxclinic.integration.storeprofile.EInvoicePackageAllocator.Result;
import com.vaxclinic.integration.storeprofile.EInvoicePackageDtos.PackageRequest;
import com.vaxclinic.integration.storeprofile.EInvoicePackageDtos.Summary;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Tài khoản MISA (từ thiết lập HĐĐT), tổng tài nguyên / đã phát hành / còn lại và danh sách gói hóa đơn (nhập tay).
 * "Còn lại" = tổng số còn lại của các gói chưa hết hạn.
 */
@Service
public class EInvoicePackageService {

    private final EInvoicePackageRepository repo;

    public EInvoicePackageService(EInvoicePackageRepository repo) {
        this.repo = repo;
    }

    public Summary summary() {
        LocalDate today = LocalDate.now(ShopSettings.ZONE);
        List<Pkg> pkgs = repo.findPackages();
        Map<LocalDate, Long> byDate = repo.publishedByDate();
        Result r = EInvoicePackageAllocator.allocate(pkgs, byDate, today);
        var settings = repo.findSettingsRows();
        String account = settings.isEmpty() ? null : (String) settings.get(0).get("username");
        boolean configured = !settings.isEmpty() && settings.get(0).get("password_enc") != null;
        long total = r.packages().stream().mapToLong(PkgUsage::quantity).sum();
        long published = byDate.values().stream().mapToLong(Long::longValue).sum();
        long remaining = r.packages().stream().filter(p -> !"EXPIRED".equals(p.status())).mapToLong(PkgUsage::remaining).sum();
        LocalDate expiry = pkgs.stream().map(Pkg::endDate).max(LocalDate::compareTo).orElse(null);
        return new Summary(account, configured, "MISA meInvoice", total, published, remaining, r.unallocated(), expiry, r.packages());
    }

    public Summary create(PackageRequest r) {
        validate(r);
        repo.insert(UUID.randomUUID(), r.name().trim(), r.quantity(), r.startDate(), r.endDate());
        return summary();
    }

    public Summary update(UUID id, PackageRequest r) {
        validate(r);
        int n = repo.update(id, r.name().trim(), r.quantity(), r.startDate(), r.endDate());
        if (n == 0) {
            throw BusinessException.notFound("PACKAGE_NOT_FOUND", "Không tìm thấy gói hóa đơn");
        }
        return summary();
    }

    public Summary delete(UUID id) {
        repo.delete(id);
        return summary();
    }

    private static void validate(PackageRequest r) {
        if (r.endDate().isBefore(r.startDate())) {
            throw BusinessException.badRequest("INVALID_PACKAGE_DATES", "Ngày hết hạn phải từ ngày bắt đầu trở đi");
        }
    }
}
