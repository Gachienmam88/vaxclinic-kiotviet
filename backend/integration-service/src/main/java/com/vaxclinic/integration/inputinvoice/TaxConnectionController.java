package com.vaxclinic.integration.inputinvoice;

import com.vaxclinic.integration.inputinvoice.TaxConnectionRepository.ConnectionResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Hóa đơn đầu vào → "Danh sách kết nối" (tài khoản cổng thuế theo MST) + đồng bộ.
 * Đồng bộ 2 bước: (1) /captcha lấy ảnh captcha, (2) /sync gửi mã người dùng nhập + khoảng ngày.
 * Nghiệp vụ ở {@link TaxConnectionService}.
 */
@RestController
@PreAuthorize("hasAuthority('inventory.manage')")
public class TaxConnectionController {

    public record ConnectionRequest(@NotBlank(message = "Nhập mã số thuế") String taxCode,
                                    @NotBlank(message = "Nhập tên đăng nhập") String username, String password) {
    }

    public record SyncRequest(@NotBlank String captchaKey, @NotBlank(message = "Nhập mã captcha") String captchaValue,
                              @NotNull LocalDate from, @NotNull LocalDate to) {
    }

    private final TaxConnectionService service;

    public TaxConnectionController(TaxConnectionService service) {
        this.service = service;
    }

    @GetMapping("/api/tax-connections")
    public List<ConnectionResponse> list() {
        return service.list();
    }

    @PostMapping("/api/tax-connections")
    @ResponseStatus(HttpStatus.CREATED)
    public Map<String, UUID> create(@Valid @RequestBody ConnectionRequest req) {
        return service.create(req);
    }

    /** Sửa thiết lập; để trống mật khẩu = giữ mật khẩu cũ. */
    @PutMapping("/api/tax-connections/{id}")
    public void update(@PathVariable UUID id, @Valid @RequestBody ConnectionRequest req) {
        service.update(id, req);
    }

    @DeleteMapping("/api/tax-connections/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable UUID id) {
        service.delete(id);
    }

    @PostMapping("/api/tax-connections/{id}/captcha")
    public GdtPortalClient.Captcha captcha(@PathVariable UUID id) {
        return service.captcha(id);
    }

    @PostMapping("/api/tax-connections/{id}/sync")
    public Map<String, Integer> sync(@PathVariable UUID id, @Valid @RequestBody SyncRequest req) {
        return service.sync(id, req);
    }
}
