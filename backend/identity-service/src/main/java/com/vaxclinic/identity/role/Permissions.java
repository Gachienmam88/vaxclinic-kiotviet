package com.vaxclinic.identity.role;

import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Permission codes carried in the JWT "perms" claim and checked by every service.
 * Single source of truth: default permissions of system roles are synced from here at startup.
 */
public final class Permissions {

    private Permissions() {
    }

    // Thiết lập
    public static final String USER_MANAGE = "user.manage";
    public static final String BRANCH_MANAGE = "branch.manage";
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

    public static final List<String> ALL = List.of(
            USER_MANAGE, BRANCH_MANAGE, CATALOG_VIEW, CATALOG_MANAGE, INVENTORY_VIEW, INVENTORY_MANAGE,
            PATIENT_VIEW, PATIENT_MANAGE, RECEPTION_PERFORM, SCREENING_PERFORM, INJECTION_PERFORM,
            SALES_PERFORM, SALES_CANCEL, CASHBOOK_MANAGE, REPORT_VIEW);

    /** Default permissions per system role code (seeded in V1 migration). */
    public static final Map<String, Set<String>> DEFAULTS = Map.of(
            "ADMIN", Set.copyOf(ALL),
            "MANAGER", Set.of(CATALOG_VIEW, CATALOG_MANAGE, INVENTORY_VIEW, INVENTORY_MANAGE, PATIENT_VIEW,
                    PATIENT_MANAGE, RECEPTION_PERFORM, SALES_PERFORM, SALES_CANCEL, CASHBOOK_MANAGE, REPORT_VIEW),
            "RECEPTIONIST", Set.of(CATALOG_VIEW, PATIENT_VIEW, PATIENT_MANAGE, RECEPTION_PERFORM),
            "DOCTOR", Set.of(CATALOG_VIEW, PATIENT_VIEW, SCREENING_PERFORM),
            "NURSE", Set.of(CATALOG_VIEW, INVENTORY_VIEW, PATIENT_VIEW, INJECTION_PERFORM),
            "CASHIER", Set.of(CATALOG_VIEW, PATIENT_VIEW, SALES_PERFORM),
            "STOREKEEPER", Set.of(CATALOG_VIEW, INVENTORY_VIEW, INVENTORY_MANAGE));
}
