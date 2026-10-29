package com.vaxclinic.identity.settings;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;
import java.util.UUID;

/**
 * Mẫu in đã sửa (Thiết lập → Mẫu in). Chỉ lưu mẫu người dùng đã sửa; loại chưa sửa → trình duyệt dùng mẫu mặc định.
 * Xử lý ở {@link PrintTemplateService}. Trình duyệt lọc bỏ script trước khi in.
 */
@RestController
@RequestMapping("/api/print-templates")
public class PrintTemplateController {

    public record TemplateRequest(@NotBlank @Size(max = 200_000) String html) {
    }

    private final PrintTemplateService service;

    public PrintTemplateController(PrintTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public Map<String, String> list() {
        return service.list();
    }

    @PutMapping("/{type}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, String> save(@PathVariable String type, @Valid @RequestBody TemplateRequest req,
                                    @AuthenticationPrincipal Jwt jwt) {
        return service.save(type, req, UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"));
    }

    /** Đặt lại về mẫu mặc định. */
    @DeleteMapping("/{type}")
    @PreAuthorize("hasAuthority('settings.manage')")
    public Map<String, String> reset(@PathVariable String type, @AuthenticationPrincipal Jwt jwt) {
        return service.reset(type, UUID.fromString(jwt.getSubject()), jwt.getClaimAsString("name"));
    }
}
