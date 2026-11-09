package com.vaxclinic.identity.role.service;

import java.util.List;

/**
 * Permission codes carried in the JWT "perms" claim and checked by every service.
 * Default permissions of system roles are seeded by migrations; ADMIN always gets ALL at startup.
 */
public final class Permissions {

    private Permissions() {
    }

    // Thiết lập
    public static final String USER_MANAGE = "user.manage";
    public static final String BRANCH_MANAGE = "branch.manage";
    public static final String SETTINGS_MANAGE = "settings.manage";
    // Danh mục vắc xin, gói tiêm, bảng giá
    public static final String CATALOG_VIEW = "catalog.view";
    public static final String CATALOG_MANAGE = "catalog.manage";
    // Kho
    public static final String INVENTORY_VIEW = "inventory.view";
    public static final String INVENTORY_MANAGE = "inventory.manage";
    // Khách hàng & hồ sơ tiêm
    public static final String PATIENT_VIEW = "patient.view";
    public static final String PATIENT_MANAGE = "patient.manage";
    // Quy trình tiêm
    public static final String RECEPTION_PERFORM = "reception.perform";
    public static final String SCREENING_PERFORM = "screening.perform";
    public static final String INJECTION_PERFORM = "injection.perform";
    // Thu ngân, sổ quỹ
    public static final String SALES_PERFORM = "sales.perform";
    public static final String SALES_CANCEL = "sales.cancel";
    public static final String CASHBOOK_MANAGE = "cashbook.manage";
    // Báo cáo
    public static final String REPORT_VIEW = "report.view";
    // Nhân viên: hồ sơ, lịch làm việc, chấm công, bảng lương, hoa hồng, thiết lập nhân viên
    public static final String HR_MANAGE = "hr.manage";

    public static final List<String> ALL = List.of(
            USER_MANAGE, BRANCH_MANAGE, SETTINGS_MANAGE, CATALOG_VIEW, CATALOG_MANAGE, INVENTORY_VIEW, INVENTORY_MANAGE,
            PATIENT_VIEW, PATIENT_MANAGE, RECEPTION_PERFORM, SCREENING_PERFORM, INJECTION_PERFORM,
            SALES_PERFORM, SALES_CANCEL, CASHBOOK_MANAGE, REPORT_VIEW, HR_MANAGE);
}
