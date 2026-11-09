package com.vaxclinic.identity.hr.attendance.controller;

import com.vaxclinic.identity.hr.attendance.service.MachineImportService;
import com.vaxclinic.identity.hr.dto.HrActor;
import com.vaxclinic.identity.hr.attendance.dto.AttendanceDtos.ImportResult;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.UUID;

/** Máy chấm công: nhập file log xuất từ máy vân tay / khuôn mặt (CSV, TXT, XLSX) — xem {@link MachineImportService}. */
@RestController
@PreAuthorize("hasAuthority('hr.manage')")
public class MachineImportController {

    private final MachineImportService service;

    public MachineImportController(MachineImportService service) {
        this.service = service;
    }

    @PostMapping("/api/hr/attendance/import")
    public ImportResult importFile(@RequestParam("file") MultipartFile file, @RequestParam(required = false) UUID branchId,
                                   @AuthenticationPrincipal Jwt jwt) throws IOException {
        return service.importFile(file, branchId, HrActor.of(jwt));
    }
}
