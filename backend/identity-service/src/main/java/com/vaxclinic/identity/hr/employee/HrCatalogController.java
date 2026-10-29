package com.vaxclinic.identity.hr.employee;

import com.vaxclinic.identity.hr.HrActor;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/**
 * Danh mục Phòng ban (/api/hr/departments) và Chức danh (/api/hr/job-titles) — nút "Tạo mới" ở bộ lọc danh sách nhân viên.
 * Nghiệp vụ ở {@link HrCatalogService}.
 */
@RestController
@PreAuthorize("hasAuthority('hr.manage')")
public class HrCatalogController {

    public record CatalogItem(UUID id, String name, int employeeCount) {
    }

    public record CatalogRequest(@NotBlank @Size(max = 100) String name) {
    }

    private final HrCatalogService service;

    public HrCatalogController(HrCatalogService service) {
        this.service = service;
    }

    @GetMapping("/api/hr/{kind:departments|job-titles}")
    public List<CatalogItem> list(@PathVariable("kind") String path) {
        return service.list(path);
    }

    @PostMapping("/api/hr/{kind:departments|job-titles}")
    @ResponseStatus(HttpStatus.CREATED)
    public CatalogItem create(@PathVariable("kind") String path, @Valid @RequestBody CatalogRequest req, @AuthenticationPrincipal Jwt jwt) {
        return service.create(path, req.name(), HrActor.of(jwt));
    }

    @PutMapping("/api/hr/{kind:departments|job-titles}/{id}")
    public CatalogItem update(@PathVariable("kind") String path, @PathVariable UUID id, @Valid @RequestBody CatalogRequest req,
                              @AuthenticationPrincipal Jwt jwt) {
        return service.update(path, id, req.name(), HrActor.of(jwt));
    }

    @DeleteMapping("/api/hr/{kind:departments|job-titles}/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable("kind") String path, @PathVariable UUID id, @AuthenticationPrincipal Jwt jwt) {
        service.delete(path, id, HrActor.of(jwt));
    }
}
