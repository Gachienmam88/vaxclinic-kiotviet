package com.vaxclinic.identity.branch;

import com.vaxclinic.identity.branch.BranchDtos.BranchRequest;
import com.vaxclinic.identity.branch.BranchDtos.BranchResponse;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

/** CRUD điểm tiêm. Mọi user đăng nhập được xem; chỉ quyền branch.manage được sửa. */
@RestController
@RequestMapping("/api/branches")
public class BranchController {

    private final BranchService service;

    public BranchController(BranchService service) {
        this.service = service;
    }

    @GetMapping
    public List<BranchResponse> list() {
        return service.list();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAuthority('branch.manage')")
    public BranchResponse create(@Valid @RequestBody BranchRequest req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAuthority('branch.manage')")
    public BranchResponse update(@PathVariable UUID id, @Valid @RequestBody BranchRequest req) {
        return service.update(id, req);
    }
}
